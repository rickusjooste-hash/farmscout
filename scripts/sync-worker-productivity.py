"""
FCS Worker Productivity Sync — FCS VW_X_PW → Supabase
======================================================
Reads daily RFID tap data from FCS (all activities), aggregates per
employee/orchard/activity, computes productivity metrics, and upserts
into public.worker_daily_productivity.

For picking activities, computes correction factor using production_bins
team totals and commodities.bags_per_bin.

Requirements:
  pip install pyodbc requests schedule

Setup:
  1. Ensure ODBC DSN 'fcs_db2' is configured pointing to FCS Firebird DB.
  2. Run: python sync-worker-productivity.py
     The script runs immediately (yesterday's data), then repeats daily at 07:00.
  3. For specific date: python sync-worker-productivity.py --date 2026-03-25
  4. For date range:    python sync-worker-productivity.py --from 2026-03-01 --to 2026-03-25
"""

import os
import sys
import time
import json
import argparse
import logging
from datetime import datetime, date, timedelta, timezone

try:
    import pyodbc
    import requests
    import schedule
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install pyodbc requests schedule")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
ORG_ID       = '93d1760e-a484-4379-95fb-6cad294e2191'
DSN          = 'fcs_db2'
STANDARD_DAY_HOURS = 9  # for units_per_man_day normalization
PICKING_ACTIVITY = 'Harvest/Pick/Sort/uitry'

COMPANY_FARM_MAP = {
    "MOUTONS VALLEY":       "1a52f7f3-aeab-475c-a6e9-53a5e302fddb",
    "STAWELKLIP":           "10b61388-8abf-4ff3-86de-bacaac7c004d",
}

def _read_env_local():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local')
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return ''

SERVICE_KEY = _read_env_local()

HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates',
}

ENDPOINT = f'{SUPABASE_URL}/rest/v1/worker_daily_productivity?on_conflict=farm_id,employee_id,work_date,fcs_orchard_nr,activity_name'


# ── Reference data fetchers ──────────────────────────────────────────────────

def _fetch_employees():
    """Fetch qc_employees → {employee_nr: {id, farm_id}} lookup."""
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/qc_employees?is_active=eq.true&select=id,employee_nr,farm_id',
        headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
        timeout=30,
    )
    resp.raise_for_status()
    lookup = {}
    for emp in resp.json():
        key = (emp['farm_id'], emp['employee_nr'])
        lookup[key] = emp['id']
    return lookup


def _fetch_orchard_map():
    """Fetch fcs_orchard_map → {fcs_orchard_nr: orchard_id} lookup."""
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/fcs_orchard_map?organisation_id=eq.{ORG_ID}&select=fcs_orchard_nr,orchard_id',
        headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
        timeout=30,
    )
    resp.raise_for_status()
    return {row['fcs_orchard_nr']: row['orchard_id'] for row in resp.json()}


def _fetch_production_bins(work_date_str):
    """Fetch production_bins for a given date → {supervisor: total_bins}."""
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/production_bins?received_date=eq.{work_date_str}&select=team,total',
        headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
        timeout=30,
    )
    resp.raise_for_status()
    team_bins = {}
    for row in resp.json():
        team = (row.get('team') or '').strip()
        if team:
            team_bins[team] = team_bins.get(team, 0) + (row.get('total') or 0)
    return team_bins


def _fetch_orchard_commodities():
    """Fetch orchards → {orchard_id: bags_per_bin} via commodity join."""
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/orchards?is_active=eq.true&select=id,commodity_id,commodities(bags_per_bin)',
        headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
        timeout=30,
    )
    resp.raise_for_status()
    lookup = {}
    for o in resp.json():
        bpb = None
        if o.get('commodities') and o['commodities'].get('bags_per_bin'):
            bpb = o['commodities']['bags_per_bin']
        lookup[o['id']] = bpb
    return lookup


# ── Main sync function ───────────────────────────────────────────────────────

def sync(target_date: date):
    date_str = target_date.isoformat()
    log.info("Syncing worker productivity for %s", date_str)
    start = datetime.now(timezone.utc)

    # 1. Fetch reference data
    try:
        employees = _fetch_employees()
        orchard_map = _fetch_orchard_map()
        orchard_bpb = _fetch_orchard_commodities()
    except Exception as e:
        log.error("Failed to fetch reference data: %s", e)
        return

    log.info("Reference data: %d employees, %d orchard mappings", len(employees), len(orchard_map))

    # 2. Read from FCS
    try:
        with pyodbc.connect(f'DSN={DSN}', timeout=30) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT FIRST 10000
                    EMPLOYEENUMBER,
                    ORCHARDNUMBER,
                    ORCHARDNAME,
                    ACTIVITYNAME,
                    UNITS,
                    HOURS,
                    MINUTES,
                    COMPANYNAME,
                    SUPERVISORNAME
                FROM VW_X_PW
                WHERE DATEWORKED = ?
            """, (target_date,))
            rows = cursor.fetchall()
    except pyodbc.Error as exc:
        log.error("ODBC error: %s", exc)
        return

    log.info("Read %d rows from FCS for %s", len(rows), date_str)
    if not rows:
        log.info("No data for %s — nothing to sync", date_str)
        return

    # 3. Aggregate rows by (employee, orchard, activity) — FCS may return multiple
    #    entries per day for the same combo (morning + afternoon shifts, etc.)
    synced_at = datetime.now(timezone.utc).isoformat()
    agg = {}  # key: (farm_id, employee_id, fcs_orchard_nr, activity) → aggregated record
    skipped_employees = 0
    unmapped_orchards = set()

    for row in rows:
        emp_nr = str(row[0]).strip() if row[0] else ''
        if not emp_nr:
            continue

        company = str(row[7]).strip().upper() if row[7] else ''
        farm_id = COMPANY_FARM_MAP.get(company)
        if not farm_id:
            continue

        employee_id = employees.get((farm_id, emp_nr))
        if not employee_id:
            skipped_employees += 1
            continue

        fcs_orchard_nr = int(row[1]) if row[1] else 0
        fcs_orchard_name = str(row[2]).strip() if row[2] else None
        activity = str(row[3]).strip() if row[3] else 'Unknown'
        units = float(row[4]) if row[4] else 0
        hours = float(row[5]) if row[5] else 0
        minutes = int(row[6]) if row[6] else 0
        supervisor = str(row[8]).strip() if row[8] else None

        key = (farm_id, employee_id, fcs_orchard_nr, activity)
        if key not in agg:
            # Resolve orchard
            orchard_id = orchard_map.get(fcs_orchard_nr) if fcs_orchard_nr else None
            if fcs_orchard_nr and not orchard_id:
                unmapped_orchards.add((fcs_orchard_nr, fcs_orchard_name))

            agg[key] = {
                'organisation_id': ORG_ID,
                'farm_id':          farm_id,
                'employee_id':      employee_id,
                'work_date':        date_str,
                'orchard_id':       orchard_id,
                'fcs_orchard_nr':   fcs_orchard_nr,
                'fcs_orchard_name': fcs_orchard_name,
                'activity_name':    activity,
                'supervisor':       supervisor,
                'units':            0,
                'hours':            0,
                'minutes':          0,
                'status':           'pending',
                'synced_at':        synced_at,
            }
        agg[key]['units'] += units
        agg[key]['hours'] += hours
        agg[key]['minutes'] += minutes
        # Keep last supervisor seen (in case it differs across rows)
        if supervisor:
            agg[key]['supervisor'] = supervisor

    # Compute productivity metrics on aggregated data
    payload = []
    for rec in agg.values():
        h = rec['hours']
        if h and h > 0:
            rec['units_per_hour'] = round(rec['units'] / h, 2)
            rec['units_per_man_day'] = round((rec['units'] / h) * STANDARD_DAY_HOURS, 2)
        else:
            rec['units_per_hour'] = None
            rec['units_per_man_day'] = None
        rec['hours'] = round(rec['hours'], 2) if rec['hours'] else None
        rec['minutes'] = rec['minutes'] if rec['minutes'] else None
        payload.append(rec)

    if skipped_employees:
        log.warning("Skipped %d rows — employee not found in qc_employees", skipped_employees)
    if unmapped_orchards:
        log.warning("Unmapped FCS orchards: %s", [(nr, name) for nr, name in unmapped_orchards])

    # 4. Delete existing rows for this date, then insert fresh
    #    (handles orchard corrections in FCS — old orchard row gets removed)
    try:
        del_resp = requests.delete(
            f'{SUPABASE_URL}/rest/v1/worker_daily_productivity?work_date=eq.{date_str}',
            headers={**HEADERS, 'Prefer': 'return=minimal'},
            timeout=30,
        )
        if del_resp.status_code < 400:
            log.info("Cleared existing rows for %s", date_str)
        else:
            log.warning("Failed to clear rows for %s: %d", date_str, del_resp.status_code)
    except requests.RequestException as exc:
        log.warning("Clear request failed: %s", exc)

    total_upserted = 0
    batch_size = 500
    for i in range(0, len(payload), batch_size):
        batch = payload[i:i + batch_size]
        try:
            resp = requests.post(ENDPOINT, headers=HEADERS, json=batch, timeout=60)
            if resp.status_code >= 400:
                log.error("Supabase upsert failed (batch %d): %d %s", i // batch_size, resp.status_code, resp.text[:500])
                continue
            total_upserted += len(batch)
        except requests.RequestException as exc:
            log.error("Supabase request error (batch %d): %s", i // batch_size, exc)

    log.info("Upserted %d / %d rows", total_upserted, len(payload))

    # 5. Apply correction factor for picking rows
    _apply_correction(date_str, orchard_bpb)

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    log.info("Sync complete for %s in %.1fs", date_str, elapsed)


def _apply_correction(date_str, orchard_bpb):
    """Compute and apply correction factor for picking rows."""
    # Fetch team bins for this date
    team_bins = _fetch_production_bins(date_str)
    if not team_bins:
        log.info("No production_bins data for %s — correction factor not applied", date_str)
        return

    # Fetch picking rows for this date
    from urllib.parse import quote
    resp = requests.get(
        f'{SUPABASE_URL}/rest/v1/worker_daily_productivity'
        f'?work_date=eq.{date_str}&activity_name=eq.{quote(PICKING_ACTIVITY)}'
        f'&select=id,supervisor,units,orchard_id',
        headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'},
        timeout=30,
    )
    resp.raise_for_status()
    picking_rows = resp.json()

    if not picking_rows:
        return

    # Normalize team_bins keys to uppercase for case-insensitive matching
    team_bins_upper = {k.upper(): v for k, v in team_bins.items()}

    # Aggregate total bags per supervisor (team)
    team_total_bags = {}
    for r in picking_rows:
        sup = (r.get('supervisor') or '').strip().upper()
        if sup:
            team_total_bags[sup] = team_total_bags.get(sup, 0) + float(r.get('units') or 0)

    # Compute correction per row
    patches = []
    for r in picking_rows:
        sup = (r.get('supervisor') or '').strip().upper()
        actual_bins = team_bins_upper.get(sup)
        total_bags = team_total_bags.get(sup)
        orchard_id = r.get('orchard_id')

        if not actual_bins or not total_bags or total_bags == 0:
            continue

        # Look up bags_per_bin from orchard's commodity
        bags_per_bin = orchard_bpb.get(orchard_id) or 53

        factor = (actual_bins * bags_per_bin) / total_bags
        units = float(r.get('units') or 0)
        corrected_bags = round(units * factor, 2)
        corrected_bins = round(corrected_bags / bags_per_bin, 4)

        patches.append({
            'id': r['id'],
            'correction_factor': round(factor, 4),
            'corrected_bags': corrected_bags,
            'corrected_bins': corrected_bins,
            '_bags_per_bin': bags_per_bin,
        })

    # Apply corrections via single RPC call instead of individual PATCHes
    # Build a JSON payload: [{id, factor, bags_per_bin}, ...]
    corrections = []
    for p in patches:
        corrections.append({
            'row_id': p['id'],
            'factor': p['correction_factor'],
            'bpb': p.get('_bags_per_bin', 53),
        })

    if corrections:
        try:
            resp = requests.post(
                f'{SUPABASE_URL}/rest/v1/rpc/apply_productivity_corrections',
                headers={**HEADERS, 'Prefer': ''},
                json={'p_corrections': json.dumps(corrections)},
                timeout=60,
            )
            if resp.status_code < 400:
                patched = len(corrections)
            else:
                log.warning("RPC correction failed: %d %s", resp.status_code, resp.text[:300])
        except requests.RequestException as exc:
            log.warning("RPC correction request failed: %s", exc)

    log.info("Applied correction factor to %d / %d picking rows (teams with bins: %s)",
             patched, len(picking_rows), list(team_bins.keys()))


# ── Schedule ─────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Sync FCS worker productivity to Supabase')
    parser.add_argument('--date', help='Sync a specific date (YYYY-MM-DD)')
    parser.add_argument('--from', dest='date_from', help='Start of date range (YYYY-MM-DD)')
    parser.add_argument('--to', dest='date_to', help='End of date range (YYYY-MM-DD)')
    args = parser.parse_args()

    if args.date:
        sync(date.fromisoformat(args.date))
    elif args.date_from:
        d = date.fromisoformat(args.date_from)
        end = date.fromisoformat(args.date_to) if args.date_to else date.today()
        while d <= end:
            sync(d)
            d += timedelta(days=1)
    else:
        # Default: sync yesterday
        yesterday = date.today() - timedelta(days=1)
        sync(yesterday)

        # Then schedule daily at 07:00
        schedule.every().day.at('04:00').do(lambda: sync(date.today() - timedelta(days=1)))
        log.info("Scheduler running — next sync at 04:00 daily. Ctrl+C to stop.")

        while True:
            schedule.run_pending()
            time.sleep(60)

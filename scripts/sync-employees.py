"""
QC Employee Sync — Farm Costing Solutions → Supabase
=====================================================
Reads the FCS payroll DB via ODBC and upserts into public.qc_employees.
Uses COMPANYNAME column to route employees to the correct farm.

Requirements:
  pip install pyodbc requests schedule

Setup:
  1. Configure a Windows ODBC DSN named 'FCS' pointing to the FCS database.
  2. Run: python sync-employees.py
     The script runs immediately on start, then repeats daily at 06:00.
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone

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

# FCS COMPANYNAME → Supabase farm_id mapping
COMPANY_FARM_MAP = {
    "STAWELKLIP":      "10b61388-8abf-4ff3-86de-bacaac7c004d",
    "MOUTON'S VALLEY": "1a52f7f3-aeab-475c-a6e9-53a5e302fddb",
}

# Read service key from .env.local
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

ENDPOINT = f'{SUPABASE_URL}/rest/v1/qc_employees?on_conflict=farm_id,employee_nr'


# ── Main sync function ────────────────────────────────────────────────────────

def sync():
    log.info("Starting employee sync from DSN=%s", DSN)
    start = datetime.now(timezone.utc)

    # 1. Read from FCS (now including COMPANYNAME)
    try:
        conn_str = f'DSN={DSN}'
        with pyodbc.connect(conn_str, timeout=30) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT FIRST 5000
                    EMPLOYEENUMBER,
                    FIRSTNAME,
                    SURNAME,
                    LEVEL3NAME,
                    TAGNUMBER,
                    COMPANYNAME
                FROM VW_X_EMP_DETAILED
                WHERE ENDDATE IS NULL
            """)
            rows = cursor.fetchall()
    except pyodbc.Error as exc:
        log.error("ODBC error: %s", exc)
        return

    log.info("Read %d active employees from FCS", len(rows))

    if not rows:
        log.warning("No employees found — skipping upsert to avoid wiping table")
        return

    # 2. Build payload per farm (deduplicate by farm_id + employee_nr)
    synced_at = datetime.now(timezone.utc).isoformat()
    # Key: (farm_id, employee_nr) → record
    seen = {}
    skipped_companies = set()

    for row in rows:
        emp_nr = str(row[0]).strip()
        if not emp_nr:
            continue

        company = str(row[5]).strip().upper() if row[5] else ''
        farm_id = COMPANY_FARM_MAP.get(company)
        if not farm_id:
            skipped_companies.add(company)
            continue

        tag_raw = str(row[4]).strip()[-4:].lstrip('0') if row[4] else None
        seen[(farm_id, emp_nr)] = {
            'organisation_id': ORG_ID,
            'farm_id':         farm_id,
            'employee_nr':     emp_nr,
            'full_name':       f"{str(row[1]).strip()} {str(row[2]).strip()}",
            'team':            str(row[3]).strip() if row[3] else None,
            'rfid_tag':        tag_raw,
            'is_active':       True,
            'synced_at':       synced_at,
        }

    if skipped_companies:
        log.warning("Skipped companies not in mapping: %s", skipped_companies)

    payload = list(seen.values())
    # Count per farm
    farm_counts = {}
    for rec in payload:
        farm_counts[rec['farm_id']] = farm_counts.get(rec['farm_id'], 0) + 1
    for fid, cnt in farm_counts.items():
        company = next((c for c, f in COMPANY_FARM_MAP.items() if f == fid), fid)
        log.info("  %s: %d employees", company, cnt)

    log.info("Deduplicated to %d unique employees across %d farms", len(payload), len(farm_counts))

    # 3. Upsert to Supabase (merge-duplicates on farm_id + employee_nr unique constraint)
    try:
        resp = requests.post(ENDPOINT, headers=HEADERS, json=payload, timeout=60)
        if resp.status_code >= 400:
            log.error("Supabase upsert failed: %d %s", resp.status_code, resp.text[:500])
            return
    except requests.RequestException as exc:
        log.error("Supabase request error: %s", exc)
        return

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    log.info("Synced %d employees in %.1fs", len(payload), elapsed)

    # 4. Deactivate employees no longer in FCS (per farm)
    #    Safety: skip deactivation if FCS returned <50 employees for a farm
    #    (protects against FCS query issues / ENDDATE bulk changes wiping the table)
    MIN_EMPLOYEES_FOR_DEACTIVATION = 50
    for farm_id, count in farm_counts.items():
        active_nrs = [p['employee_nr'] for p in payload if p['farm_id'] == farm_id]
        if not active_nrs:
            continue
        if count < MIN_EMPLOYEES_FOR_DEACTIVATION:
            company = next((c for c, f in COMPANY_FARM_MAP.items() if f == farm_id), farm_id)
            log.warning(
                "Skipping deactivation for %s — only %d employees from FCS (min %d required). "
                "Check COMPANYNAME mapping or ENDDATE values in FCS.",
                company, count, MIN_EMPLOYEES_FOR_DEACTIVATION,
            )
            continue
        try:
            nr_list = ','.join(active_nrs)
            deactivate_resp = requests.patch(
                f'{SUPABASE_URL}/rest/v1/qc_employees?farm_id=eq.{farm_id}&employee_nr=not.in.({nr_list})',
                headers={**HEADERS, 'Prefer': ''},
                json={'is_active': False},
                timeout=30,
            )
            deactivate_resp.raise_for_status()
            company = next((c for c, f in COMPANY_FARM_MAP.items() if f == farm_id), farm_id)
            log.info("Deactivated stale employees for %s", company)
        except requests.RequestException as exc:
            log.warning("Could not deactivate stale employees for %s: %s", farm_id, exc)


# ── Schedule ──────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    # Run once immediately on startup
    sync()

    # Then schedule daily at 06:00
    schedule.every().day.at('06:00').do(sync)
    log.info("Scheduler running — next sync at 06:00 daily. Ctrl+C to stop.")

    while True:
        schedule.run_pending()
        time.sleep(60)

"""
ICC Irrigation Data Sync — Stawelklip
======================================
Reads the latest ICC report XLS, aggregates per orchard per day,
and upserts into Supabase irrigation_events.

Requirements:
  pip install xlrd requests

Setup:
  1. Install Python 3.x (check "Add to PATH")
  2. Run setup.bat
  3. Scheduled task runs daily at 06:00
"""

import os
import sys
import glob
import logging
from datetime import datetime, timezone
from collections import defaultdict

try:
    import xlrd
    import requests
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install xlrd requests")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sync.log')),
    ]
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
ORG_ID       = '93d1760e-a484-4379-95fb-6cad294e2191'
FARM_ID      = '10b61388-8abf-4ff3-86de-bacaac7c004d'  # Stawelklip
ICC_DATA_DIR = r'C:\ProgramData\IccWaterControl\ICCPRO\Reports'

def _read_config():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.txt')
    try:
        with open(config_path) as f:
            for line in f:
                if line.strip().startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    return line.strip().split('=', 1)[1]
    except FileNotFoundError:
        log.error("config.txt not found!")
        sys.exit(1)
    return ''

SERVICE_KEY = _read_config()

HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates',
}

ENDPOINT = f'{SUPABASE_URL}/rest/v1/irrigation_events?on_conflict=farm_id,legacy_id,event_date'

# ── Caches ────────────────────────────────────────────────────────────────────

_orchard_cache = {}
_weather_station_id = None
_eto_cache = {}
_kc_cache = {}


def _fetch_orchard_map():
    global _orchard_cache
    _orchard_cache = {}
    url = (f'{SUPABASE_URL}/rest/v1/orchards'
           f'?organisation_id=eq.{ORG_ID}&is_active=eq.true'
           f'&select=id,legacy_id,commodity_id,variety_group,farm_id,ha,spitters_per_ha,spitter_types(flow_rate_lph)'
           f'&legacy_id=not.is.null')
    try:
        resp = requests.get(url, headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'}, timeout=30)
        resp.raise_for_status()
        for row in resp.json():
            lid = row.get('legacy_id')
            if lid is not None:
                st = row.get('spitter_types') or {}
                _orchard_cache[int(lid)] = {
                    'orchard_id': row['id'], 'commodity_id': row['commodity_id'],
                    'variety_group': row.get('variety_group'), 'farm_id': row['farm_id'],
                    'ha': float(row['ha']) if row.get('ha') else None,
                    'spitters_per_ha': float(row['spitters_per_ha']) if row.get('spitters_per_ha') else None,
                    'flow_rate_lph': float(st['flow_rate_lph']) if st.get('flow_rate_lph') else None,
                }
    except requests.RequestException as exc:
        log.error("Failed to fetch orchard map: %s", exc)
    log.info("Orchard cache: %d orchards", len(_orchard_cache))


def _fetch_weather_station():
    global _weather_station_id
    url = (f'{SUPABASE_URL}/rest/v1/weather_stations'
           f'?organisation_id=eq.{ORG_ID}&is_active=eq.true&select=id&limit=1')
    try:
        resp = requests.get(url, headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'}, timeout=30)
        resp.raise_for_status()
        rows = resp.json()
        _weather_station_id = rows[0]['id'] if rows else None
    except requests.RequestException as exc:
        log.error("Failed to fetch weather station: %s", exc)
        _weather_station_id = None


def _fetch_eto(dates):
    global _eto_cache
    _eto_cache = {}
    if not _weather_station_id or not dates: return
    date_list = ','.join(sorted(dates))
    url = (f'{SUPABASE_URL}/rest/v1/weather_daily'
           f'?station_id=eq.{_weather_station_id}&reading_date=in.({date_list})&select=reading_date,eto_mm')
    try:
        resp = requests.get(url, headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'}, timeout=30)
        resp.raise_for_status()
        for row in resp.json():
            _eto_cache[row['reading_date']] = row['eto_mm']
    except requests.RequestException as exc:
        log.error("Failed to fetch ETo: %s", exc)
    log.info("ETo cache: %d days", len(_eto_cache))


def _fetch_kc(commodity_vg_months):
    global _kc_cache
    _kc_cache = {}
    if not commodity_vg_months: return
    commodity_ids = set(cm[0] for cm in commodity_vg_months)
    months = set(cm[2] for cm in commodity_vg_months)
    cid_list = ','.join(commodity_ids)
    month_list = ','.join(str(m) for m in months)
    url = (f'{SUPABASE_URL}/rest/v1/crop_coefficients'
           f'?commodity_id=in.({cid_list})&month=in.({month_list})'
           f'&select=organisation_id,commodity_id,variety_group,month,kc'
           f'&order=organisation_id.desc.nullslast')
    try:
        resp = requests.get(url, headers={'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}'}, timeout=30)
        resp.raise_for_status()
        for row in resp.json():
            key = (row['commodity_id'], row.get('variety_group'), row['month'])
            if key not in _kc_cache:
                org = row.get('organisation_id')
                if org is not None and org != ORG_ID: continue
                _kc_cache[key] = row['kc']
    except requests.RequestException as exc:
        log.error("Failed to fetch Kc: %s", exc)
    log.info("Kc cache: %d entries", len(_kc_cache))


# ── XLS parsing ──────────────────────────────────────────────────────────────

def _parse_duration(val):
    if not val or not isinstance(val, str): return 0.0
    parts = val.strip().split(':')
    if len(parts) != 3: return 0.0
    try:
        h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
        return h * 60 + m + s / 60.0
    except (ValueError, IndexError):
        return 0.0


def _parse_date(val):
    if not val or not isinstance(val, str): return None
    try:
        parts = val.strip().split('/')
        if len(parts) == 3:
            m, d, y = int(parts[0]), int(parts[1]), int(parts[2])
            return f'{y:04d}-{m:02d}-{d:02d}'
    except (ValueError, IndexError):
        pass
    return None


def _find_latest_xls():
    pattern = os.path.join(ICC_DATA_DIR, 'ALL FARM_*.xls')
    files = glob.glob(pattern)
    if not files: return None
    files.sort(key=lambda f: os.path.getmtime(f))
    return files[-1]


def parse_xls(filepath):
    log.info("Parsing XLS: %s", filepath)
    wb = xlrd.open_workbook(filepath)
    ws = wb.sheet_by_index(0)

    agg = defaultdict(lambda: {'volume_m3': 0.0, 'duration_min': 0.0, 'area_ha': 0.0, 'valve_count': 0})
    skipped = 0
    parsed = 0

    for i in range(1, ws.nrows):
        valve = ws.cell_value(i, 0)
        date_val = ws.cell_value(i, 1)
        area_val = ws.cell_value(i, 2)
        qty_val = ws.cell_value(i, 3)
        duration_val = ws.cell_value(i, 5)
        desc_val = ws.cell_value(i, 7)

        if isinstance(valve, str) and _parse_date(valve) and not date_val: continue
        if isinstance(valve, str) and valve.strip().lower().startswith('total'): continue
        if desc_val == '' or desc_val is None: skipped += 1; continue

        try: legacy_id = int(float(desc_val))
        except (ValueError, TypeError): skipped += 1; continue

        if area_val == '': skipped += 1; continue

        event_date = _parse_date(str(date_val) if not isinstance(date_val, str) else date_val)
        if not event_date: skipped += 1; continue

        try: area = float(area_val) if area_val != '' else 0.0
        except (ValueError, TypeError): area = 0.0
        try: volume = float(qty_val) if qty_val != '' else 0.0
        except (ValueError, TypeError): volume = 0.0

        duration = _parse_duration(str(duration_val) if not isinstance(duration_val, str) else duration_val)

        key = (legacy_id, event_date)
        agg[key]['duration_min'] += duration
        agg[key]['valve_count'] += 1
        if volume > 0: agg[key]['volume_m3'] += volume
        if area > 0: agg[key]['area_ha'] += area
        parsed += 1

    log.info("Parsed %d rows, skipped %d, aggregated %d events", parsed, skipped, len(agg))

    results = []
    for (legacy_id, event_date), vals in agg.items():
        results.append({
            'legacy_id': legacy_id, 'event_date': event_date,
            'volume_m3': round(vals['volume_m3'], 2),
            'duration_min': round(vals['duration_min'], 2),
            'area_ha': round(vals['area_ha'], 3),
            'valve_count': vals['valve_count'],
        })
    return results


# ── Main sync ────────────────────────────────────────────────────────────────

def sync(filepath=None):
    log.info("=" * 50)
    log.info("Starting ICC sync — Stawelklip")
    start = datetime.now(timezone.utc)

    xls_path = filepath or _find_latest_xls()
    if not xls_path or not os.path.isfile(xls_path):
        log.error("No XLS file found (dir=%s)", ICC_DATA_DIR)
        return

    events = parse_xls(xls_path)
    if not events:
        log.warning("No events parsed")
        return

    _fetch_orchard_map()
    _fetch_weather_station()

    unique_dates = set()
    commodity_vg_months = set()
    for ev in events:
        unique_dates.add(ev['event_date'])
        lid = ev['legacy_id']
        if lid in _orchard_cache:
            cid = _orchard_cache[lid]['commodity_id']
            vg = _orchard_cache[lid].get('variety_group')
            month = int(ev['event_date'].split('-')[1])
            commodity_vg_months.add((cid, vg, month))

    _fetch_eto(unique_dates)
    _fetch_kc(commodity_vg_months)

    payload = []
    unresolved = set()

    for ev in events:
        lid = ev['legacy_id']
        orchard_info = _orchard_cache.get(lid)
        orchard_id = None
        event_farm_id = FARM_ID
        eto_mm = None
        kc = None

        if orchard_info:
            orchard_id = orchard_info['orchard_id']
            event_farm_id = orchard_info['farm_id']
            commodity_id = orchard_info['commodity_id']
            variety_group = orchard_info.get('variety_group')
            month = int(ev['event_date'].split('-')[1])
            eto_mm = _eto_cache.get(ev['event_date'])
            kc = _kc_cache.get((commodity_id, variety_group, month))
            if kc is None:
                kc = _kc_cache.get((commodity_id, None, month))
        else:
            unresolved.add(lid)

        volume = ev['volume_m3']
        if volume == 0 and ev['duration_min'] > 0 and orchard_info:
            flow = orchard_info.get('flow_rate_lph')
            sph = orchard_info.get('spitters_per_ha')
            ha = orchard_info.get('ha')
            if flow and sph and ha:
                volume = round((ev['duration_min'] / 60) * sph * ha * flow / 1000, 2)

        payload.append({
            'organisation_id': ORG_ID, 'farm_id': event_farm_id,
            'orchard_id': orchard_id, 'legacy_id': lid,
            'event_date': ev['event_date'], 'volume_m3': volume,
            'duration_min': ev['duration_min'], 'area_ha': ev['area_ha'],
            'valve_count': ev['valve_count'], 'eto_mm': eto_mm, 'kc': kc,
        })

    estimated = len([p for p in payload if p['volume_m3'] > 0]) - len([e for e in events if e['volume_m3'] > 0])
    if estimated > 0:
        log.info("Estimated volume for %d unmetered events", estimated)

    if unresolved:
        log.warning("Unresolved legacy_ids: %s", sorted(unresolved))

    log.info("Upserting %d events...", len(payload))
    try:
        resp = requests.post(ENDPOINT, headers=HEADERS, json=payload, timeout=60)
        if resp.status_code >= 400:
            log.error("Upsert failed: %d %s", resp.status_code, resp.text[:500])
            return
    except requests.RequestException as exc:
        log.error("Request error: %s", exc)
        return

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    log.info("Synced %d events in %.1fs", len(payload), elapsed)
    log.info("=" * 50)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', type=str, help='Specific XLS file path')
    args = parser.parse_args()
    sync(filepath=args.file)

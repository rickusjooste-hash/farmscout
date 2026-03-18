"""
Import historic rainfall data from Excel → Supabase rain_readings.

Reads data/rain/Data.xlsx (openpyxl), maps gauge short IDs to deterministic
UUIDs, and upserts to rain_readings via Supabase REST in batches of 500.
Idempotent: duplicate (gauge_id, reading_date) rows are summed before upsert.

Requirements:
  pip install openpyxl requests

Usage:
  python scripts/import-rain-data.py
"""

import os
import sys
import logging
from datetime import datetime
from collections import defaultdict

try:
    import openpyxl
    import requests
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install openpyxl requests")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'

EXCEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'rain', 'Data.xlsx')

# Gauge short ID → deterministic UUID (padded)
GAUGE_UUID_MAP = {
    '4c804313': '4c804313-0000-0000-0000-000000000000',  # Mouton's Valley
    '7b0b2cd7': '7b0b2cd7-0000-0000-0000-000000000000',  # Stawelklip
    'bc8217f5': 'bc8217f5-0000-0000-0000-000000000000',  # MorningSide
}

BATCH_SIZE = 500

# ── Read service key from .env.local ──────────────────────────────────────────

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
if not SERVICE_KEY:
    log.error("SUPABASE_SERVICE_ROLE_KEY not found in .env.local")
    sys.exit(1)

HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates',
}

ENDPOINT = f'{SUPABASE_URL}/rest/v1/rain_readings?on_conflict=gauge_id,reading_date'

# ── Main ──────────────────────────────────────────────────────────────────────

def load_excel():
    """Read Data sheet, return list of {gauge_id, reading_date, value_mm}."""
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True, read_only=True)
    ws = wb['Data']

    # Aggregate by (gauge_id, date) to handle duplicate same-day readings
    agg = defaultdict(float)

    row_count = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        date_val, value, gauge_short = row[0], row[1], row[2]

        if date_val is None or value is None or gauge_short is None:
            continue

        gauge_short = str(gauge_short).strip()
        gauge_uuid = GAUGE_UUID_MAP.get(gauge_short)
        if not gauge_uuid:
            log.warning(f"Unknown gauge ID: {gauge_short}, skipping")
            continue

        if isinstance(date_val, datetime):
            date_str = date_val.strftime('%Y-%m-%d')
        elif isinstance(date_val, str):
            date_str = date_val[:10]
        else:
            log.warning(f"Unexpected date type: {type(date_val)} = {date_val}")
            continue

        try:
            val = float(value)
        except (ValueError, TypeError):
            continue

        agg[(gauge_uuid, date_str)] += val
        row_count += 1

    wb.close()

    records = []
    for (gauge_uuid, date_str), total_mm in agg.items():
        records.append({
            'gauge_id': gauge_uuid,
            'reading_date': date_str,
            'value_mm': round(total_mm, 2),
        })

    log.info(f"Read {row_count} rows → {len(records)} unique (gauge, date) records")
    return records


def upsert_batch(batch):
    """POST a batch of records to Supabase REST."""
    resp = requests.post(ENDPOINT, json=batch, headers=HEADERS, timeout=30)
    if resp.status_code not in (200, 201):
        log.error(f"Upsert failed ({resp.status_code}): {resp.text[:300]}")
        return False
    return True


def main():
    log.info(f"Loading Excel: {EXCEL_PATH}")
    records = load_excel()
    if not records:
        log.warning("No records to import")
        return

    total = len(records)
    sent = 0
    failed = 0

    for i in range(0, total, BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        if upsert_batch(batch):
            sent += len(batch)
            log.info(f"  Upserted {sent}/{total}")
        else:
            failed += len(batch)

    log.info(f"Done. Upserted: {sent}, Failed: {failed}")


if __name__ == '__main__':
    main()

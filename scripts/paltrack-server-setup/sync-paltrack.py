"""
Paltrack Pallet Sync — SQL Server → Supabase
=============================================
Runs on the Paltrack server (FAR-SHED-7).
Reads completed pallets from local Paltrack database and upserts to Supabase.

Requirements:
  pip install pyodbc requests

Setup:
  1. Install Python 3.x
  2. pip install pyodbc requests
  3. Create scheduled task to run daily at 18:00
"""

import os
import sys
import logging
from datetime import datetime, timezone

try:
    import pyodbc
    import requests
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install pyodbc requests")
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

SUPABASE_URL   = 'https://agktzdeskpyevurhabpg.supabase.co'
SERVICE_KEY    = ''  # Will be read from config.txt
ORG_ID         = '93d1760e-a484-4379-95fb-6cad294e2191'
SEASON         = '2026'

# Local SQL Server connection (running on this machine)
PALTRACK_INSTANCE = r'.\SQLEXPRESS'
PALTRACK_DB       = 'Paltrack'

def _read_config():
    """Read service key from config.txt in same directory."""
    global SERVICE_KEY
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.txt')
    try:
        with open(config_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    SERVICE_KEY = line.split('=', 1)[1].strip()
    except FileNotFoundError:
        log.error("config.txt not found! Create it with: SUPABASE_SERVICE_ROLE_KEY=your_key_here")
        sys.exit(1)

_read_config()

HEADERS = {
    'apikey':        SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates',
}


def paltrack_connect():
    """Connect to local Paltrack SQL Server using Windows auth."""
    conn_str = (
        f'DRIVER={{SQL Server}};'
        f'SERVER={PALTRACK_INSTANCE};'
        f'DATABASE={PALTRACK_DB};'
        f'Trusted_Connection=yes;'
        f'Connection Timeout=15;'
    )
    return pyodbc.connect(conn_str)


# ── Sync reference data ─────────────────────────────────────────────────────

def sync_reference_data(conn):
    cursor = conn.cursor()

    # 1. Box types from in_det
    log.info("Pulling box type combos...")
    cursor.execute('''
        SELECT
            RTRIM(s.PACK) as pack_code,
            RTRIM(s.GRADE) as grade,
            MAX(s.CTN_QTY) as cartons_per_pallet,
            RTRIM(p.LONG_DESC) as pack_desc,
            p.NET_MASS as weight_per_carton
        FROM in_det s
        LEFT JOIN pack p ON p.PACK = s.PACK AND p.COMMODITY = s.COMMODITY
            AND p.ORGZN = s.ORGZN
        WHERE s.SEASON = ?
        GROUP BY s.PACK, s.GRADE, p.LONG_DESC, p.NET_MASS
        ORDER BY s.PACK, s.GRADE
    ''', SEASON)

    box_types = []
    seen_codes = set()
    for row in cursor.fetchall():
        code = f"{row.pack_code} {row.grade}"
        if code in seen_codes:
            continue
        seen_codes.add(code)
        weight = float(row.weight_per_carton) if row.weight_per_carton else None
        cpp = int(row.cartons_per_pallet) if row.cartons_per_pallet else 56
        desc = row.pack_desc or row.pack_code
        box_types.append({
            'organisation_id': ORG_ID, 'code': code,
            'name': f"{desc} {row.grade}", 'pack_code': row.pack_code,
            'grade': row.grade, 'cartons_per_pallet': cpp,
            'weight_per_carton_kg': weight, 'season': SEASON, 'is_active': True,
        })

    if box_types:
        log.info("Upserting %d box types...", len(box_types))
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/packout_box_types?on_conflict=organisation_id,code,season',
            headers=HEADERS, json=box_types, timeout=30)
        if resp.status_code >= 400:
            log.error("Box types failed: %d %s", resp.status_code, resp.text[:300])
        else:
            log.info("Box types OK")

    # 2. Sizes
    log.info("Pulling sizes...")
    cursor.execute('''
        SELECT DISTINCT RTRIM(SIZE_COUNT) as size_count
        FROM sizes WHERE COMMODITY = 'AP' AND ACTIVE = 'Y'
          AND PACK IN (SELECT DISTINCT PACK FROM in_det WHERE SEASON = ?)
        UNION
        SELECT DISTINCT RTRIM(SIZE_COUNT) FROM in_det WHERE SEASON = ?
        ORDER BY 1
    ''', SEASON, SEASON)

    sizes = []
    for i, row in enumerate(cursor.fetchall()):
        sz = row.size_count.strip()
        if not sz: continue
        try: sort = int(sz)
        except ValueError: sort = (i + 1) * 10
        sizes.append({'organisation_id': ORG_ID, 'label': sz, 'sort_order': sort, 'is_active': True})

    if sizes:
        log.info("Upserting %d sizes...", len(sizes))
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/packout_sizes?on_conflict=organisation_id,label',
            headers=HEADERS, json=sizes, timeout=30)
        if resp.status_code >= 400:
            log.error("Sizes failed: %d %s", resp.status_code, resp.text[:300])
        else:
            log.info("Sizes OK")

    # 3. Valid combos
    log.info("Building combos...")
    cursor.execute('''
        SELECT DISTINCT RTRIM(PACK) as pack_code, RTRIM(SIZE_COUNT) as size_count
        FROM sizes WHERE COMMODITY = 'AP' AND ACTIVE = 'Y'
          AND PACK IN (SELECT DISTINCT PACK FROM in_det WHERE SEASON = ?)
        ORDER BY pack_code, size_count
    ''', SEASON)

    paltrack_combos = [(row.pack_code, row.size_count.strip()) for row in cursor.fetchall()]
    if not paltrack_combos:
        log.warning("No combos found")
        return

    hdrs = {k: v for k, v in HEADERS.items() if k != 'Prefer'}
    bt_resp = requests.get(f'{SUPABASE_URL}/rest/v1/packout_box_types?organisation_id=eq.{ORG_ID}&season=eq.{SEASON}&select=id,pack_code,grade', headers=hdrs, timeout=15)
    sz_resp = requests.get(f'{SUPABASE_URL}/rest/v1/packout_sizes?organisation_id=eq.{ORG_ID}&select=id,label', headers=hdrs, timeout=15)

    if bt_resp.status_code >= 400 or sz_resp.status_code >= 400:
        log.error("Failed to fetch lookups for combos")
        return

    bt_by_pack = {}
    for bt in bt_resp.json():
        bt_by_pack.setdefault(bt['pack_code'], []).append(bt['id'])
    sz_by_label = {s['label']: s['id'] for s in sz_resp.json()}

    combos = []
    for pack_code, size_label in paltrack_combos:
        size_id = sz_by_label.get(size_label)
        if not size_id: continue
        for bt_id in bt_by_pack.get(pack_code, []):
            combos.append({'organisation_id': ORG_ID, 'box_type_id': bt_id, 'size_id': size_id, 'is_active': True})

    if combos:
        log.info("Upserting %d combos...", len(combos))
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/packout_box_type_sizes?on_conflict=organisation_id,box_type_id,size_id',
            headers=HEADERS, json=combos, timeout=30)
        if resp.status_code >= 400:
            log.error("Combos failed: %d %s", resp.status_code, resp.text[:300])
        else:
            log.info("Combos OK")


# ── Sync pallets ─────────────────────────────────────────────────────────────

def sync_pallets(conn):
    cursor = conn.cursor()
    log.info("Pulling pallets (last 7 days)...")
    cursor.execute('''
        SELECT IN_DET_ID, RTRIM(PALLET_ID) as pallet_id, RTRIM(PACKH_CODE) as packh_code,
            RTRIM(FARM) as farm, RTRIM(ORCHARD) as orchard, RTRIM(COMMODITY) as commodity,
            RTRIM(VARIETY) as variety, RTRIM(PACK) as pack, RTRIM(GRADE) as grade,
            RTRIM(SIZE_COUNT) as size_count, CTN_QTY, CAST(INTAKE_DATE AS DATE) as pack_date,
            RTRIM(SEASON) as season
        FROM in_det WHERE SEASON = ? AND INTAKE_DATE >= DATEADD(day, -7, GETDATE()) ORDER BY IN_DET_ID
    ''', SEASON)

    rows = cursor.fetchall()
    log.info("Read %d pallets", len(rows))
    if not rows: return

    payload = []
    for row in rows:
        payload.append({
            'organisation_id': ORG_ID, 'paltrack_id': str(row.IN_DET_ID),
            'pallet_nr': row.pallet_id, 'pack_date': str(row.pack_date) if row.pack_date else None,
            'carton_count': row.CTN_QTY or 0, 'commodity': row.commodity,
            'variety': row.variety, 'pack_code': row.pack, 'grade': row.grade,
            'size_count': row.size_count, 'farm_code': row.farm,
            'orchard_code': row.orchard, 'season': row.season,
        })

    BATCH = 200
    total_ok = 0
    for i in range(0, len(payload), BATCH):
        batch = payload[i:i + BATCH]
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/packout_pallets?on_conflict=organisation_id,paltrack_id',
            headers=HEADERS, json=batch, timeout=60)
        if resp.status_code >= 400:
            log.error("Pallet batch %d failed: %d %s", i // BATCH, resp.status_code, resp.text[:300])
        else:
            total_ok += len(batch)
    log.info("Synced %d / %d pallets", total_ok, len(payload))


# ── Resolve FK references ────────────────────────────────────────────────────

def resolve_references():
    log.info("Resolving FK references...")

    def fetch(table, select, filter=''):
        url = f'{SUPABASE_URL}/rest/v1/{table}?{filter}&select={select}'
        r = requests.get(url, headers={k: v for k, v in HEADERS.items() if k != 'Prefer'}, timeout=15)
        return r.json() if r.status_code < 400 else []

    packhouses = {p['code']: p['id'] for p in fetch('packhouses', 'id,code', f'organisation_id=eq.{ORG_ID}')}
    box_types = {bt['code']: bt['id'] for bt in fetch('packout_box_types', 'id,code', f'organisation_id=eq.{ORG_ID}&season=eq.{SEASON}')}
    sizes = {s['label']: s['id'] for s in fetch('packout_sizes', 'id,label', f'organisation_id=eq.{ORG_ID}')}

    orchard_map = {}
    for m in fetch('packout_orchard_map', 'paltrack_orchard_code,paltrack_variety,orchard_id', f'organisation_id=eq.{ORG_ID}'):
        orchard_map[(m['paltrack_orchard_code'], m['paltrack_variety'])] = m['orchard_id']
    log.info("Loaded %d orchard mappings", len(orchard_map))

    unresolved = fetch('packout_pallets', 'id,pack_code,grade,size_count,farm_code,orchard_code,variety,box_type_id,orchard_id',
        f'organisation_id=eq.{ORG_ID}&or=(box_type_id.is.null,orchard_id.is.null)')
    log.info("Found %d unresolved pallets", len(unresolved))

    updated = 0
    for pallet in unresolved:
        patch = {}
        if packhouses:
            patch['packhouse_id'] = list(packhouses.values())[0]
        if not pallet.get('box_type_id'):
            bt_code = f"{pallet['pack_code']} {pallet['grade']}"
            if bt_code in box_types: patch['box_type_id'] = box_types[bt_code]
        sz = (pallet.get('size_count') or '').strip()
        if sz in sizes: patch['size_id'] = sizes[sz]
        if not pallet.get('orchard_id'):
            orch_code = (pallet.get('orchard_code') or '').strip()
            variety = (pallet.get('variety') or '').strip()
            orch_id = orchard_map.get((orch_code, variety))
            if orch_id: patch['orchard_id'] = orch_id
        if patch:
            resp = requests.patch(
                f'{SUPABASE_URL}/rest/v1/packout_pallets?id=eq.{pallet["id"]}',
                headers={**HEADERS, 'Prefer': ''}, json=patch, timeout=15)
            if resp.status_code < 400: updated += 1

    log.info("Resolved %d pallets", updated)


# ── Main ─────────────────────────────────────────────────────────────────────

def sync():
    log.info("=" * 60)
    log.info("Starting Paltrack sync")
    start = datetime.now(timezone.utc)

    try:
        conn = paltrack_connect()
        log.info("Connected to Paltrack")
    except pyodbc.Error as exc:
        log.error("Connection failed: %s", exc)
        return

    try:
        sync_reference_data(conn)
        sync_pallets(conn)
        conn.close()
        resolve_references()
    except Exception as exc:
        log.error("Sync error: %s", exc, exc_info=True)
    finally:
        try: conn.close()
        except: pass

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    log.info("Paltrack sync complete in %.1fs", elapsed)
    log.info("=" * 60)


if __name__ == '__main__':
    sync()

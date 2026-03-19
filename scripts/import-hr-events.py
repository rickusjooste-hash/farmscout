"""
Import historical HR events from data/hr/HR Events.xlsx into hr_events table.

Usage: C:/Python314/python.exe scripts/import-hr-events.py [--dry-run]

Excel columns:
  Number, EventType, Date, Reason, Comments, Status, CreatedBy, ActionedBy,
  AttachedForm, Form 1, Form 2, Form 3, Company, ChairPerson

Mappings:
  Company: 1 = MV, 2 = SK
  EventType (Excel → DB):
    1 → 1 (Red Light)
    2 → 2 (Green Light)
    3 → 3 (Schedule Disciplinary Hearing)
    4 → 6 (First Written Warning)
    5 → 7 (Second Written Warning)
    6 → 8 (Final Written Warning)
    7 → 4 (Verbal Warning)
    8 → 5 (Absenteeism Formal Letter)
  Employee number: Company 1 = str(Number), Company 2 = strip "SK" prefix
"""

import sys
import os
import json
import urllib.request
import openpyxl
from datetime import datetime, timedelta

DRY_RUN = '--dry-run' in sys.argv

# ── Config ──────────────────────────────────────────────────────────────────

EXCEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'hr', 'HR Events.xlsx')
ORG_ID = '93d1760e-a484-4379-95fb-6cad294e2191'

FARM_MAP = {
    1: '1a52f7f3-aeab-475c-a6e9-53a5e302fddb',  # MV
    2: '10b61388-8abf-4ff3-86de-bacaac7c004d',  # SK
}

# Excel EventType ID → DB hr_event_types.id
EVENT_TYPE_MAP = {
    1: 1,  # Red Light
    2: 2,  # Green Light
    3: 3,  # Schedule Disciplinary Hearing
    4: 6,  # First Written Warning
    5: 7,  # Second Written Warning
    6: 8,  # Final Written Warning
    7: 4,  # Verbal Warning
    8: 5,  # Absenteeism Formal Letter
}

# DB event type validity in months (for expires_at calculation)
VALIDITY_MONTHS = {
    1: None,  # Red Light
    2: None,  # Green Light
    3: None,  # Hearing
    4: 3,     # Verbal Warning
    5: 3,     # Absenteeism Formal Letter
    6: 6,     # First Written
    7: 6,     # Second Written
    8: 12,    # Final Written
}

# ── Supabase helpers ────────────────────────────────────────────────────────

env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
SVC_KEY = ''
SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'

with open(env_path) as f:
    for line in f:
        if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
            SVC_KEY = line.strip().split('=', 1)[1]


def supabase_get(path):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/{path}',
        headers={'apikey': SVC_KEY, 'Authorization': f'Bearer {SVC_KEY}'}
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())


def supabase_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/{path}',
        data=body,
        method='POST',
        headers={
            'apikey': SVC_KEY,
            'Authorization': f'Bearer {SVC_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        }
    )
    resp = urllib.request.urlopen(req)
    return resp.status


# ── Load employee lookup ────────────────────────────────────────────────────

print('Loading employees from qc_employees...')
employees = {}  # (farm_id, employee_nr) → uuid

for farm_label, farm_id in FARM_MAP.items():
    emps = supabase_get(f'qc_employees?select=id,employee_nr,farm_id&farm_id=eq.{farm_id}')
    for e in emps:
        employees[(farm_id, str(e['employee_nr']))] = e['id']

print(f'  Loaded {len(employees)} employees')

# ── Read Excel ──────────────────────────────────────────────────────────────

print(f'Reading {EXCEL_PATH}...')
wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
ws = wb['Sheet1']
rows = list(ws.iter_rows(values_only=True))
headers = rows[0]
data_rows = rows[1:]
print(f'  {len(data_rows)} rows')

# ── Process rows ────────────────────────────────────────────────────────────

inserts = []
skipped = []

for i, row in enumerate(data_rows):
    emp_nr_raw = row[0]   # Number
    event_type_xl = row[1]  # EventType (Excel ID)
    date_val = row[2]     # Date
    reason = row[3]       # Reason
    comments = row[4]     # Comments
    status = row[5]       # Status (all seem to be 1 = active)
    actioned_by = row[7]  # ActionedBy
    company = row[12]     # Company
    chair_person = row[13]  # ChairPerson

    # Skip rows with missing essential data
    if emp_nr_raw is None or event_type_xl is None or date_val is None or company is None:
        skipped.append((i + 2, 'missing essential data', emp_nr_raw, event_type_xl, company))
        continue

    # Map farm
    farm_id = FARM_MAP.get(company)
    if not farm_id:
        skipped.append((i + 2, f'unknown company {company}', emp_nr_raw))
        continue

    # Map employee number — try exact match first, then numeric-only fallback
    if isinstance(emp_nr_raw, (int, float)):
        emp_nr = str(int(emp_nr_raw))
    else:
        emp_nr = str(emp_nr_raw).strip()

    employee_id = employees.get((farm_id, emp_nr))

    # Fallback: if exact match fails, try with/without SK prefix
    if not employee_id and emp_nr.startswith('SK'):
        employee_id = employees.get((farm_id, emp_nr[2:]))  # Try without prefix
    if not employee_id and not emp_nr.startswith('SK') and company == 2:
        employee_id = employees.get((farm_id, f'SK{emp_nr}'))  # Try with prefix

    if not employee_id:
        skipped.append((i + 2, f'employee not found: {emp_nr} on farm {farm_id[:8]}', emp_nr_raw))
        continue

    # Map event type
    db_event_type_id = EVENT_TYPE_MAP.get(event_type_xl)
    if not db_event_type_id:
        skipped.append((i + 2, f'unknown event type {event_type_xl}', emp_nr_raw))
        continue

    # Parse date
    if isinstance(date_val, datetime):
        event_date = date_val.strftime('%Y-%m-%d')
    else:
        skipped.append((i + 2, f'unparseable date {date_val}', emp_nr_raw))
        continue

    # Compute expires_at
    validity = VALIDITY_MONTHS.get(db_event_type_id)
    expires_at = None
    if validity:
        exp_date = date_val
        # Add months
        month = exp_date.month + validity
        year = exp_date.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        day = min(exp_date.day, 28)  # Safe day
        expires_at = f'{year:04d}-{month:02d}-{day:02d}'

    # Compute status: if expires_at is in the past, mark expired
    hr_status = 'active'
    if expires_at and expires_at < datetime.now().strftime('%Y-%m-%d'):
        hr_status = 'expired'

    record = {
        'organisation_id': ORG_ID,
        'farm_id': farm_id,
        'employee_id': employee_id,
        'event_type_id': db_event_type_id,
        'event_date': event_date,
        'reason': str(reason).strip() if reason else None,
        'comments': str(comments).strip() if comments else None,
        'status': hr_status,
        'expires_at': expires_at,
        'actioned_by': str(actioned_by).strip() if actioned_by else None,
        'chair_person': str(chair_person).strip() if chair_person else None,
    }
    inserts.append(record)

# ── Report ──────────────────────────────────────────────────────────────────

print(f'\nReady to insert: {len(inserts)} events')
print(f'Skipped: {len(skipped)} rows')

if skipped:
    print('\nSkipped details (first 20):')
    for s in skipped[:20]:
        print(f'  Row {s[0]}: {s[1]} (raw: {s[2:]})')

# Count by status
from collections import Counter
status_counts = Counter(r['status'] for r in inserts)
type_counts = Counter(r['event_type_id'] for r in inserts)
print(f'\nBy status: {dict(status_counts)}')
print(f'By event type ID: {dict(type_counts)}')

if DRY_RUN:
    print('\n[DRY RUN] No data inserted.')
    sys.exit(0)

# ── Insert in batches ───────────────────────────────────────────────────────

BATCH_SIZE = 200
inserted = 0

for batch_start in range(0, len(inserts), BATCH_SIZE):
    batch = inserts[batch_start:batch_start + BATCH_SIZE]
    try:
        status = supabase_post('hr_events', batch)
        inserted += len(batch)
        print(f'  Inserted batch {batch_start // BATCH_SIZE + 1}: {len(batch)} rows (HTTP {status})')
    except Exception as e:
        print(f'  ERROR inserting batch at row {batch_start}: {e}')
        # Try one by one for this batch
        for j, record in enumerate(batch):
            try:
                supabase_post('hr_events', record)
                inserted += 1
            except Exception as e2:
                print(f'    Failed row {batch_start + j}: {e2}')

print(f'\nDone. Inserted {inserted}/{len(inserts)} events.')

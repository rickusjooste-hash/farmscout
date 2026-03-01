// Derives scout_zone_assignments from trap inspection history.
// For each unique (scout_id, zone_id) pair found via trap → zone join,
// creates an open-ended assignment using the earliest inspection date.
//
// Run: node scripts/assign-zones-from-trap-inspections.mjs
// Safe to re-run — skips pairs that already have an assignment.

const SUPA_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFna3R6ZGVza3B5ZXZ1cmhhYnBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk0NjA1MSwiZXhwIjoyMDg3NTIyMDUxfQ.wqXh8tEmB74pkO764SjfXpMkWnzseQWyWydZOfpDkDg'
const REST = `${SUPA_URL}/rest/v1`
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }

async function get(path) {
  const res = await fetch(`${REST}${path}`, { headers: H })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${REST}${path}`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`)
  return res.status
}

async function main() {
  // 1. Fetch all trap_inspections that have a scout_id
  console.log('Fetching trap inspections with scout_id…')
  const inspections = await get('/trap_inspections?select=scout_id,trap_id,inspected_at&scout_id=not.is.null&limit=10000&order=inspected_at.asc')
  console.log(`  Found ${inspections.length} inspections with scout_id`)

  if (inspections.length === 0) {
    console.log('Nothing to do.')
    return
  }

  // 2. Fetch all traps to get zone_id
  console.log('Fetching traps…')
  const traps = await get('/traps?select=id,zone_id&limit=10000')
  const trapZone = new Map(traps.map(t => [t.id, t.zone_id]))

  // 3. Build unique (user_id, zone_id) → earliest inspection date
  // trap_inspections.scout_id IS user_profiles.id (same as scouts.user_id)
  const pairs = new Map() // key: "user_id|zone_id" → { user_id, zone_id, assigned_from }

  for (const { scout_id: userId, trap_id, inspected_at } of inspections) {
    const zoneId = trapZone.get(trap_id)
    if (!zoneId) continue  // trap has no zone — skip

    const key = `${userId}|${zoneId}`
    const existing = pairs.get(key)
    if (!existing || inspected_at < existing.assigned_from) {
      pairs.set(key, { user_id: userId, zone_id: zoneId, assigned_from: inspected_at.slice(0, 10) })
    }
  }

  console.log(`  Resolved ${pairs.size} unique (scout, zone) pairs`)

  if (pairs.size === 0) {
    console.log('No zones could be resolved (traps may be missing zone_id). Nothing inserted.')
    return
  }

  // 4. Fetch existing assignments to skip duplicates
  console.log('Fetching existing scout_zone_assignments…')
  const existing = await get('/scout_zone_assignments?select=user_id,zone_id&limit=10000')
  const existingSet = new Set(existing.map(r => `${r.user_id}|${r.zone_id}`))
  console.log(`  ${existingSet.size} assignments already exist`)

  // 5. Filter to only new pairs
  const toInsert = [...pairs.values()].filter(p => !existingSet.has(`${p.user_id}|${p.zone_id}`))

  if (toInsert.length === 0) {
    console.log('All assignments already exist — nothing to insert.')
    return
  }

  console.log(`\nInserting ${toInsert.length} new assignments:`)
  for (const row of toInsert) {
    // Look up scout name for readable output
    process.stdout.write(`  user ${row.user_id.slice(0, 8)}… | zone ${row.zone_id.slice(0, 8)}… | from ${row.assigned_from}`)
  }
  console.log()

  const rows = toInsert.map(p => ({
    user_id: p.user_id,
    zone_id: p.zone_id,
    assigned_from: p.assigned_from,
    // assigned_until left null = open-ended
  }))

  const status = await post('/scout_zone_assignments', rows)
  console.log(`\n✓ Inserted ${toInsert.length} zone assignments (HTTP ${status})`)

  // 6. Summary
  console.log('\nSummary by scout:')
  const byScout = new Map()
  for (const row of toInsert) {
    const list = byScout.get(row.user_id) || []
    list.push(row.zone_id)
    byScout.set(row.user_id, list)
  }
  for (const [userId, zones] of byScout) {
    console.log(`  ${userId} → ${zones.length} zone(s) assigned`)
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1) })

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_TABLES = new Set([
  'inspection_sessions',
  'inspection_trees',
  'inspection_observations',
])

// FK ordering — sessions must exist before trees, trees before observations
const TABLE_ORDER = ['inspection_sessions', 'inspection_trees', 'inspection_observations']

// POST /api/scout/tree-sync
// Single:  { table: string, record: object }
// Batch:   { records: [{ table: string, record: object }] }
// Verifies the scout's Bearer token once, then upserts using service role (bypasses RLS).
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = await req.json()

  // ── Batch mode ────────────────────────────────────────────────────────────
  if (Array.isArray(body.records)) {
    const byTable: Record<string, object[]> = {}
    for (const item of body.records) {
      if (!ALLOWED_TABLES.has(item.table)) continue
      if (!byTable[item.table]) byTable[item.table] = []
      byTable[item.table].push(item.record)
    }

    for (const table of TABLE_ORDER) {
      const records = byTable[table]
      if (!records?.length) continue
      const { error: upsertError } = await supabase
        .from(table)
        .upsert(records, { onConflict: 'id' })
      if (upsertError) {
        return NextResponse.json({ error: `${table}: ${upsertError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, count: body.records.length })
  }

  // ── Single mode (backwards compat) ────────────────────────────────────────
  const { table, record } = body
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Table not allowed' }, { status: 400 })
  }

  const { error: upsertError } = await supabase
    .from(table)
    .upsert(record, { onConflict: 'id' })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

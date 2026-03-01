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

// POST /api/scout/tree-sync
// Accepts: { table: string, record: object }
// Verifies the scout's Bearer token, then upserts using service role (bypasses RLS).
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

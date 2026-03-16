import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function anonSupabase(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } }
  )
}

function svcSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/applicators?farm_id=<uuid>
export async function GET(req: NextRequest) {
  const farmId = req.nextUrl.searchParams.get('farm_id')
  if (!farmId) return NextResponse.json({ error: 'farm_id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = svcSupabase()

  // Get farm's org
  const { data: farm } = await svc.from('farms').select('organisation_id').eq('id', farmId).single()
  if (!farm) return NextResponse.json({ error: 'Farm not found' }, { status: 404 })

  // Get all users with farm access
  const { data: farmUsers } = await svc
    .from('user_farm_access')
    .select('user_id, user_profiles!inner(id, full_name)')
    .eq('farm_id', farmId)

  // Get sections for this farm
  const { data: sections } = await svc
    .from('sections')
    .select('id, name, section_nr')
    .eq('farm_id', farmId)
    .order('section_nr')

  // Get current assignments
  const { data: assignments } = await svc
    .from('fert_section_assignments')
    .select('id, user_id, section_id, assigned_from, assigned_until')
    .eq('organisation_id', farm.organisation_id)
    .or('assigned_until.is.null,assigned_until.gte.' + new Date().toISOString().slice(0, 10))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = (farmUsers || []).map((fu: any) => ({
    id: fu.user_profiles.id,
    full_name: fu.user_profiles.full_name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments: (assignments || []).filter((a: any) => a.user_id === fu.user_profiles.id),
  }))

  return NextResponse.json({ users, sections: sections || [] })
}

// POST /api/applicators — create assignment
export async function POST(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { user_id, section_id, organisation_id } = body as {
    user_id: string
    section_id: string
    organisation_id: string
  }

  if (!user_id || !section_id || !organisation_id) {
    return NextResponse.json({ error: 'user_id, section_id, organisation_id required' }, { status: 400 })
  }

  const svc = svcSupabase()
  const { error } = await svc.from('fert_section_assignments').insert({
    user_id,
    section_id,
    organisation_id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/applicators — remove assignment
export async function DELETE(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { assignment_id } = body as { assignment_id: string }
  if (!assignment_id) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })

  const svc = svcSupabase()
  const { error } = await svc.from('fert_section_assignments').delete().eq('id', assignment_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

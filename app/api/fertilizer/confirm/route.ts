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

async function checkAccess(req: NextRequest, farmId: string) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, user: null, orgUser: null }

  const { data: orgUser } = await anon
    .from('organisation_users')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .single()
  if (!orgUser) return { error: 'Forbidden', status: 403, user: null, orgUser: null }

  if (orgUser.role !== 'super_admin') {
    if (orgUser.role === 'org_admin') {
      const { data: farm } = await anon.from('farms').select('organisation_id').eq('id', farmId).single()
      if (!farm || farm.organisation_id !== orgUser.organisation_id)
        return { error: 'Forbidden', status: 403, user: null, orgUser: null }
    } else {
      const { data: access } = await anon
        .from('user_farm_access').select('id').eq('user_id', user.id).eq('farm_id', farmId).single()
      if (!access) return { error: 'Forbidden', status: 403, user: null, orgUser: null }
    }
  }

  return { error: null, status: 200, user, orgUser }
}

// GET /api/fertilizer/confirm?farm_id=<uuid>&season=<text>&view=dashboard
export async function GET(req: NextRequest) {
  const farmId = req.nextUrl.searchParams.get('farm_id')
  const season = req.nextUrl.searchParams.get('season')
  const view = req.nextUrl.searchParams.get('view')

  if (!farmId) return NextResponse.json({ error: 'farm_id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rpcName = view === 'dashboard' ? 'get_fert_dashboard_summary' : 'get_fert_application_status'
  const { data, error } = await anon.rpc(rpcName, {
    p_farm_ids: [farmId],
    p_season: season || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// POST /api/fertilizer/confirm  body: { line_ids, confirmed, date_applied? }
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { line_ids, confirmed, date_applied } = body as {
    line_ids: string[]
    confirmed: boolean
    date_applied?: string
  }

  if (!Array.isArray(line_ids) || line_ids.length === 0)
    return NextResponse.json({ error: 'line_ids required' }, { status: 400 })

  // Look up farm_id from first line's recommendation for access check
  const svc = svcSupabase()
  const { data: lineRec } = await svc
    .from('fert_recommendation_lines')
    .select('recommendation_id, fert_recommendations!inner(farm_id, organisation_id)')
    .eq('id', line_ids[0])
    .single()
  if (!lineRec) return NextResponse.json({ error: 'Line not found' }, { status: 404 })

  const rec = lineRec.fert_recommendations as unknown as { farm_id: string; organisation_id: string }
  const { error: accessErr, status, user } = await checkAccess(req, rec.farm_id)
  if (accessErr) return NextResponse.json({ error: accessErr }, { status })

  if (confirmed) {
    // Upsert confirmations
    const rows = line_ids.map(lid => ({
      organisation_id: rec.organisation_id,
      line_id: lid,
      confirmed: true,
      date_applied: date_applied || null,
      confirmed_by: user!.id,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await svc
      .from('fert_applications')
      .upsert(rows, { onConflict: 'line_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    // Delete confirmations
    const { error } = await svc
      .from('fert_applications')
      .delete()
      .in('line_id', line_ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

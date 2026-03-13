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

// GET /api/fertilizer?farm_id=<uuid>&season=<text>
export async function GET(req: NextRequest) {
  const farmId = req.nextUrl.searchParams.get('farm_id')
  const season = req.nextUrl.searchParams.get('season')

  if (!farmId) return NextResponse.json({ error: 'farm_id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await anon.rpc('get_fert_recommendation_summary', {
    p_farm_ids: [farmId],
    p_season: season || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// DELETE /api/fertilizer body: { id }
export async function DELETE(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: rec } = await anon
    .from('fert_recommendations')
    .select('farm_id')
    .eq('id', id)
    .single()
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error: accessErr, status } = await checkAccess(req, rec.farm_id)
  if (accessErr) return NextResponse.json({ error: accessErr }, { status })

  const svc = svcSupabase()
  // ON DELETE CASCADE handles timings + lines
  const { error } = await svc.from('fert_recommendations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

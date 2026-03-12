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

async function getOrgUser(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return null
  const { data: orgUser } = await anon
    .from('organisation_users')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .single()
  return orgUser
}

// GET /api/leaf-analysis/norms?commodity_id=xxx
export async function GET(req: NextRequest) {
  const commodityId = req.nextUrl.searchParams.get('commodity_id')

  const orgUser = await getOrgUser(req)
  if (!orgUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service role to bypass RLS on nutrient_norms/nutrients reference tables
  const svc = svcSupabase()

  let query = svc
    .from('nutrient_norms')
    .select('id, organisation_id, commodity_id, nutrient_id, sample_type, variety, min_optimal, max_optimal, min_adequate, max_adequate, unit, source, nutrients!inner(code, name, category, display_order)')
    .or(`organisation_id.is.null,organisation_id.eq.${orgUser.organisation_id}`)

  if (commodityId) {
    query = query.eq('commodity_id', commodityId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Also fetch nutrients list for the full grid
  const { data: nutrients } = await svc
    .from('nutrients')
    .select('id, code, name, category, default_unit, display_order')
    .order('display_order')

  // Fetch varieties for the commodity (from orchards)
  let varieties: string[] = []
  if (commodityId) {
    const { data: orchData } = await svc
      .from('orchards')
      .select('variety')
      .eq('commodity_id', commodityId)
      .eq('is_active', true)
      .not('variety', 'is', null)

    varieties = [...new Set((orchData || []).map((o: any) => o.variety as string))].sort()
  }

  return NextResponse.json({ norms: data || [], nutrients: nutrients || [], varieties })
}

// PUT /api/leaf-analysis/norms — upsert org-specific norm
export async function PUT(req: NextRequest) {
  const orgUser = await getOrgUser(req)
  if (!orgUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['super_admin', 'org_admin', 'manager'].includes(orgUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { commodity_id, nutrient_id, variety, min_optimal, max_optimal, min_adequate, max_adequate, unit, source } = body
  if (!commodity_id || !nutrient_id || min_optimal == null || max_optimal == null)
    return NextResponse.json({ error: 'commodity_id, nutrient_id, min_optimal, max_optimal required' }, { status: 400 })

  const svc = svcSupabase()

  // Check if row already exists
  let q = svc
    .from('nutrient_norms')
    .select('id')
    .eq('organisation_id', orgUser.organisation_id)
    .eq('commodity_id', commodity_id)
    .eq('nutrient_id', nutrient_id)
    .eq('sample_type', 'mid-season')

  if (variety) {
    q = q.eq('variety', variety)
  } else {
    q = q.is('variety', null)
  }

  const { data: existing } = await q.maybeSingle()

  const row = {
    organisation_id: orgUser.organisation_id,
    commodity_id,
    nutrient_id,
    sample_type: 'mid-season',
    variety: variety || null,
    min_optimal: Number(min_optimal),
    max_optimal: Number(max_optimal),
    min_adequate: min_adequate != null ? Number(min_adequate) : null,
    max_adequate: max_adequate != null ? Number(max_adequate) : null,
    unit: unit || '%',
    source: source || 'Custom',
  }

  if (existing) {
    const { error } = await svc.from('nutrient_norms').update(row).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: existing.id })
  } else {
    const { data: created, error } = await svc.from('nutrient_norms').insert(row).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: created.id })
  }
}

// DELETE /api/leaf-analysis/norms — remove org override
export async function DELETE(req: NextRequest) {
  const orgUser = await getOrgUser(req)
  if (!orgUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['super_admin', 'org_admin', 'manager'].includes(orgUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const svc = svcSupabase()

  // Only allow deleting org-specific rows
  const { error } = await svc
    .from('nutrient_norms')
    .delete()
    .eq('id', body.id)
    .eq('organisation_id', orgUser.organisation_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

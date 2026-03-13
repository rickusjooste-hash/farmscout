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

// GET /api/leaf-analysis?farm_id=<uuid>&season=<text>
export async function GET(req: NextRequest) {
  const farmId = req.nextUrl.searchParams.get('farm_id')
  const season = req.nextUrl.searchParams.get('season')
  const orchardId = req.nextUrl.searchParams.get('orchard_id')

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // If requesting trend for specific orchard
  if (orchardId) {
    const { data, error } = await anon.rpc('get_leaf_analysis_trend', {
      p_orchard_id: orchardId,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ?? [])
  }

  // Summary for farm(s)
  if (!farmId) return NextResponse.json({ error: 'farm_id or orchard_id required' }, { status: 400 })

  const { data, error } = await anon.rpc('get_leaf_analysis_summary', {
    p_farm_ids: [farmId],
    p_season: season || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// POST /api/leaf-analysis — create single analysis
// body: { farm_id, orchard_id, season, sample_date, sample_type, lab_name, lab_reference, notes, results: [{ nutrient_id, value, unit }] }
export async function POST(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { farm_id, orchard_id, season, sample_date, sample_type, lab_name, lab_reference, notes, results } = body
  if (!farm_id || !orchard_id || !season || !sample_date || !results?.length)
    return NextResponse.json({ error: 'farm_id, orchard_id, season, sample_date, results required' }, { status: 400 })

  const { error: accessErr, status, user, orgUser } = await checkAccess(req, farm_id)
  if (accessErr) return NextResponse.json({ error: accessErr }, { status })

  // Get org_id from farm
  const anon = anonSupabase(req)
  const { data: farm } = await anon.from('farms').select('organisation_id').eq('id', farm_id).single()
  if (!farm) return NextResponse.json({ error: 'Farm not found' }, { status: 404 })

  const svc = svcSupabase()

  // Insert leaf_analyses row
  const { data: analysis, error: aErr } = await svc
    .from('leaf_analyses')
    .insert({
      organisation_id: farm.organisation_id,
      farm_id,
      orchard_id,
      season,
      sample_date,
      sample_type: sample_type || 'mid-season',
      lab_name: lab_name || null,
      lab_reference: lab_reference || null,
      notes: notes || null,
      imported_by: user!.id,
    })
    .select('id')
    .single()

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 400 })

  // Insert results
  const resultRows = results.map((r: any) => ({
    analysis_id: analysis.id,
    nutrient_id: r.nutrient_id,
    value: r.value,
    unit: r.unit,
  }))

  const { error: rErr } = await svc.from('leaf_analysis_results').insert(resultRows)
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 })

  return NextResponse.json({ ok: true, id: analysis.id })
}

// PATCH /api/leaf-analysis — attach PDF to all analyses for a farm+season
// body: { farm_id, season, pdf_url }
export async function PATCH(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { farm_id, season, pdf_url } = body
  if (!farm_id || !season || !pdf_url)
    return NextResponse.json({ error: 'farm_id, season, pdf_url required' }, { status: 400 })

  const { error: accessErr, status } = await checkAccess(req, farm_id)
  if (accessErr) return NextResponse.json({ error: accessErr }, { status })

  const svc = svcSupabase()
  const { error, count } = await svc
    .from('leaf_analyses')
    .update({ pdf_url })
    .eq('farm_id', farm_id)
    .eq('season', season)
    .is('pdf_url', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, updated: count })
}

// DELETE /api/leaf-analysis body: { id }
export async function DELETE(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: analysis } = await anon
    .from('leaf_analyses')
    .select('farm_id')
    .eq('id', id)
    .single()
  if (!analysis) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error: accessErr, status } = await checkAccess(req, analysis.farm_id)
  if (accessErr) return NextResponse.json({ error: accessErr }, { status })

  const svc = svcSupabase()
  // ON DELETE CASCADE handles leaf_analysis_results
  const { error } = await svc.from('leaf_analyses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

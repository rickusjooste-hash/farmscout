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

// GET /api/benchmarks/targets?org_id=<uuid>
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = svcSupabase()

  // Org targets
  const { data: targets } = await svc
    .from('org_production_targets')
    .select('id, commodity_id, variety_group, target_t_ha, commodities!inner(name)')
    .eq('organisation_id', orgId)
    .order('commodity_id')

  // Industry benchmarks
  const { data: benchmarks } = await svc
    .from('industry_benchmarks')
    .select('id, commodity_id, variety_group, target_t_ha, source, commodities!inner(name)')
    .order('commodity_id')

  return NextResponse.json({
    targets: (targets || []).map((t: any) => ({
      ...t,
      commodity_name: t.commodities?.name || '',
    })),
    benchmarks: (benchmarks || []).map((b: any) => ({
      ...b,
      commodity_name: b.commodities?.name || '',
    })),
  })
}

// POST /api/benchmarks/targets — upsert org target
export async function POST(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { organisation_id, commodity_id, variety_group, target_t_ha } = body as {
    organisation_id: string
    commodity_id: string
    variety_group?: string
    target_t_ha: number
  }

  if (!organisation_id || !commodity_id || !target_t_ha) {
    return NextResponse.json({ error: 'organisation_id, commodity_id, target_t_ha required' }, { status: 400 })
  }

  const svc = svcSupabase()
  const { error } = await svc
    .from('org_production_targets')
    .upsert({
      organisation_id,
      commodity_id,
      variety_group: variety_group || null,
      target_t_ha,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organisation_id,commodity_id,COALESCE(variety_group,\'\')' })

  // If upsert fails due to unique index, try insert
  if (error) {
    // Fallback: delete existing and insert
    await svc
      .from('org_production_targets')
      .delete()
      .eq('organisation_id', organisation_id)
      .eq('commodity_id', commodity_id)
      .is('variety_group', variety_group || null)

    const { error: err2 } = await svc.from('org_production_targets').insert({
      organisation_id,
      commodity_id,
      variety_group: variety_group || null,
      target_t_ha,
    })
    if (err2) return NextResponse.json({ error: err2.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/benchmarks/targets
export async function DELETE(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id } = body as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const svc = svcSupabase()
  const { error } = await svc.from('org_production_targets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

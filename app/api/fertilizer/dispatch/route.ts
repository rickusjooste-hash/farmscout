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

// GET /api/fertilizer/dispatch?farm_id=<uuid>
export async function GET(req: NextRequest) {
  const farmId = req.nextUrl.searchParams.get('farm_id')
  if (!farmId) return NextResponse.json({ error: 'farm_id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = svcSupabase()

  // Fetch dispatches with orchard details + applicator name
  const { data, error } = await svc
    .from('fert_dispatches')
    .select(`
      id, farm_id, timing_id, product_id, dispatched_by, dispatched_to, dispatched_at, status, notes,
      fert_timings!inner(label, sort_order),
      fert_products!inner(name),
      fert_dispatch_orchards(orchard_id, line_id, orchards!inner(name, orchard_nr, variety)),
      applicant:user_profiles!dispatched_to(full_name)
    `)
    .eq('farm_id', farmId)
    .order('dispatched_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatches = (data || []).map((d: any) => {
    const timing = d.fert_timings
    const product = d.fert_products
    const orchards = (d.fert_dispatch_orchards || []).map((do_: any) => ({
      orchard_id: do_.orchard_id,
      line_id: do_.line_id,
      orchard_name: do_.orchards?.name || '',
      orchard_nr: do_.orchards?.orchard_nr || null,
      variety: do_.orchards?.variety || null,
    }))
    return {
      id: d.id,
      farm_id: d.farm_id,
      timing_id: d.timing_id,
      timing_label: timing?.label || '',
      timing_sort: timing?.sort_order || 0,
      product_id: d.product_id,
      product_name: product?.name || '',
      dispatched_by: d.dispatched_by,
      dispatched_to: d.dispatched_to,
      dispatched_to_name: d.applicant?.full_name || null,
      dispatched_at: d.dispatched_at,
      status: d.status,
      notes: d.notes,
      orchards,
    }
  })

  return NextResponse.json(dispatches)
}

// POST /api/fertilizer/dispatch — create a new dispatch with orchard-level targeting
export async function POST(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { farm_id, timing_id, product_id, line_ids, notes, organisation_id, dispatched_to } = body as {
    farm_id: string
    timing_id: string
    product_id: string
    line_ids: string[]
    notes?: string
    organisation_id: string
    dispatched_to?: string
  }

  if (!farm_id || !timing_id || !product_id || !line_ids?.length || !organisation_id) {
    return NextResponse.json({ error: 'farm_id, timing_id, product_id, line_ids, organisation_id required' }, { status: 400 })
  }

  const svc = svcSupabase()

  // Look up orchard_id for each line_id from fert_recommendation_lines
  const { data: lines, error: linesErr } = await svc
    .from('fert_recommendation_lines')
    .select('id, orchard_id')
    .in('id', line_ids)

  if (linesErr || !lines?.length) {
    return NextResponse.json({ error: linesErr?.message || 'Lines not found' }, { status: 400 })
  }

  // Create dispatch
  const { data: dispatch, error: dispErr } = await svc
    .from('fert_dispatches')
    .insert({
      organisation_id,
      farm_id,
      timing_id,
      product_id,
      dispatched_by: user.id,
      dispatched_to: dispatched_to || null,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (dispErr || !dispatch) return NextResponse.json({ error: dispErr?.message || 'Failed to create dispatch' }, { status: 400 })

  // Insert into fert_dispatch_orchards
  const orchardRows = lines.map(l => ({
    dispatch_id: dispatch.id,
    orchard_id: l.orchard_id,
    line_id: l.id,
  }))
  const { error: orchErr } = await svc.from('fert_dispatch_orchards').insert(orchardRows)
  if (orchErr) return NextResponse.json({ error: orchErr.message }, { status: 400 })

  return NextResponse.json({ ok: true, dispatch_id: dispatch.id })
}

// PATCH /api/fertilizer/dispatch — cancel/complete a dispatch
export async function PATCH(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { dispatch_id, status } = body as { dispatch_id: string; status: 'cancelled' | 'completed' }
  if (!dispatch_id || !status) return NextResponse.json({ error: 'dispatch_id and status required' }, { status: 400 })

  const svc = svcSupabase()
  const { error } = await svc
    .from('fert_dispatches')
    .update({ status })
    .eq('id', dispatch_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

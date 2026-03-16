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

// GET /api/fertilizer/spreaders?farm_id=<uuid>
export async function GET(req: NextRequest) {
  const farmId = req.nextUrl.searchParams.get('farm_id')
  if (!farmId) return NextResponse.json({ error: 'farm_id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = svcSupabase()
  const { data, error } = await svc
    .from('spreaders')
    .select(`
      id, name, fixed_speed_kmh,
      spreader_chart_entries(id, product_id, width_m, opening, kg_per_ha)
    `)
    .eq('farm_id', farmId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spreaders = (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    fixed_speed_kmh: s.fixed_speed_kmh,
    chart_entries: s.spreader_chart_entries || [],
  }))

  return NextResponse.json(spreaders)
}

// POST /api/fertilizer/spreaders
export async function POST(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  // Chart entry upsert mode
  if (body.type === 'chart') {
    const { spreader_id, product_id, entries } = body as {
      type: string; spreader_id: string; product_id: string
      entries: { width_m: number; opening: number; kg_per_ha: number }[]
    }
    if (!spreader_id || !product_id) {
      return NextResponse.json({ error: 'spreader_id, product_id required' }, { status: 400 })
    }
    const svc = svcSupabase()
    // Delete existing entries for this spreader+product, then insert new ones
    const { error: delErr } = await svc
      .from('spreader_chart_entries')
      .delete()
      .eq('spreader_id', spreader_id)
      .eq('product_id', product_id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    if (entries?.length) {
      const rows = entries.map(e => ({
        spreader_id, product_id,
        width_m: e.width_m, opening: e.opening, kg_per_ha: e.kg_per_ha,
      }))
      const { error } = await svc
        .from('spreader_chart_entries')
        .insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  // Create spreader
  const { farm_id, organisation_id, name, fixed_speed_kmh } = body as {
    farm_id: string; organisation_id: string; name: string; fixed_speed_kmh: number
  }
  if (!farm_id || !organisation_id || !name || !fixed_speed_kmh) {
    return NextResponse.json({ error: 'farm_id, organisation_id, name, fixed_speed_kmh required' }, { status: 400 })
  }

  const svc = svcSupabase()
  const { data, error } = await svc
    .from('spreaders')
    .insert({ farm_id, organisation_id, name, fixed_speed_kmh })
    .select('id, name, fixed_speed_kmh')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// PATCH /api/fertilizer/spreaders
export async function PATCH(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id, ...fields } = body as { id: string; name?: string; fixed_speed_kmh?: number }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (fields.name !== undefined) update.name = fields.name
  if (fields.fixed_speed_kmh !== undefined) update.fixed_speed_kmh = fields.fixed_speed_kmh

  const svc = svcSupabase()
  const { error } = await svc.from('spreaders').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/fertilizer/spreaders
export async function DELETE(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id } = body as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const svc = svcSupabase()
  const { error } = await svc.from('spreaders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

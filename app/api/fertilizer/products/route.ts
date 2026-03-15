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

async function getOrgId(req: NextRequest): Promise<{ orgId: string | null; error: string | null; status: number }> {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return { orgId: null, error: 'Unauthorized', status: 401 }

  const { data: orgUser } = await anon
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()
  if (!orgUser) return { orgId: null, error: 'Forbidden', status: 403 }

  return { orgId: orgUser.organisation_id, error: null, status: 200 }
}

// GET /api/fertilizer/products
export async function GET(req: NextRequest) {
  const { orgId, error, status } = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error }, { status })

  const svc = svcSupabase()
  const { data, error: dbErr } = await svc
    .from('fert_products')
    .select('*')
    .eq('organisation_id', orgId)
    .order('name')

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// PATCH /api/fertilizer/products  body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const { orgId, error, status } = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error }, { status })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id, ...fields } = body as { id: string; [key: string]: unknown }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Only allow known fields
  const allowed = ['name', 'registration_no', 'n_pct', 'p_pct', 'k_pct', 'ca_pct', 'mg_pct', 's_pct', 'default_unit', 'bag_weight_kg']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key]
  }

  const svc = svcSupabase()
  const { error: dbErr } = await svc
    .from('fert_products')
    .update(update)
    .eq('id', id)
    .eq('organisation_id', orgId)

  if (dbErr) {
    if (dbErr.code === '23505') return NextResponse.json({ error: 'A product with this name already exists' }, { status: 409 })
    return NextResponse.json({ error: dbErr.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

// POST /api/fertilizer/products  body: { name, ...fields }
export async function POST(req: NextRequest) {
  const { orgId, error, status } = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error }, { status })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { name } = body as { name: string }
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const svc = svcSupabase()
  const { data, error: dbErr } = await svc
    .from('fert_products')
    .insert({
      organisation_id: orgId,
      name: name.trim(),
      registration_no: (body.registration_no as string) || null,
      n_pct: Number(body.n_pct) || 0,
      p_pct: Number(body.p_pct) || 0,
      k_pct: Number(body.k_pct) || 0,
      ca_pct: Number(body.ca_pct) || 0,
      mg_pct: Number(body.mg_pct) || 0,
      s_pct: Number(body.s_pct) || 0,
      default_unit: (body.default_unit as string) || 'kg/ha',
    })
    .select()
    .single()

  if (dbErr) {
    if (dbErr.code === '23505') return NextResponse.json({ error: 'A product with this name already exists' }, { status: 409 })
    return NextResponse.json({ error: dbErr.message }, { status: 400 })
  }
  return NextResponse.json(data)
}

// DELETE /api/fertilizer/products  body: { id }
export async function DELETE(req: NextRequest) {
  const { orgId, error, status } = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error }, { status })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id } = body as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const svc = svcSupabase()
  const { error: dbErr } = await svc
    .from('fert_products')
    .delete()
    .eq('id', id)
    .eq('organisation_id', orgId)

  if (dbErr) {
    if (dbErr.code === '23503') return NextResponse.json({ error: 'Product is in use by recommendations and cannot be deleted' }, { status: 409 })
    return NextResponse.json({ error: dbErr.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

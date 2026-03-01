import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Verify session via SSR cookies
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgUser } = await anonClient
    .from('organisation_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (orgUser?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { type } = body

  if (type === 'create') {
    const { name, scientific_name, commodityId, observationMethod, category, displayOrder, displayName } = body
    if (!name || !commodityId || !observationMethod || !category) {
      return NextResponse.json({ error: 'name, commodityId, observationMethod and category are required' }, { status: 400 })
    }

    const { data: pest, error: pestError } = await svc
      .from('pests')
      .insert({ name: name.trim(), scientific_name: scientific_name?.trim() || null })
      .select('id')
      .single()

    if (pestError) return NextResponse.json({ error: pestError.message }, { status: 400 })

    const { error: cpError } = await svc.from('commodity_pests').insert({
      pest_id: pest.id,
      commodity_id: commodityId,
      category,
      display_name: displayName?.trim() || null,
      display_order: displayOrder ?? 0,
      observation_method: observationMethod,
      is_active: true,
    })

    if (cpError) return NextResponse.json({ error: cpError.message }, { status: 400 })
    return NextResponse.json({ ok: true, pestId: pest.id })
  }

  if (type === 'add-to-commodity') {
    const { pestId, commodityId, observationMethod, category, displayOrder, displayName } = body
    if (!pestId || !commodityId || !observationMethod || !category) {
      return NextResponse.json({ error: 'pestId, commodityId, observationMethod and category are required' }, { status: 400 })
    }

    const { error } = await svc.from('commodity_pests').insert({
      pest_id: pestId,
      commodity_id: commodityId,
      category,
      display_name: displayName?.trim() || null,
      display_order: displayOrder ?? 0,
      observation_method: observationMethod,
      is_active: true,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (type === 'update') {
    const { commodityPestId, observationMethod, displayOrder, isActive, displayName } = body
    if (!commodityPestId) {
      return NextResponse.json({ error: 'commodityPestId is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (observationMethod !== undefined) updates.observation_method = observationMethod
    if (displayOrder !== undefined) updates.display_order = displayOrder
    if (isActive !== undefined) updates.is_active = isActive
    if (displayName !== undefined) updates.display_name = displayName?.trim() || null

    const { error } = await svc.from('commodity_pests').update(updates).eq('id', commodityPestId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

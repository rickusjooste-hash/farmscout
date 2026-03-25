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

  if (!orgUser || !['super_admin', 'org_admin'].includes(orgUser.role)) {
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

  // ── Trap Types ──────────────────────────────────────────────────────────

  if (type === 'create-trap-type') {
    const { name } = body
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const { data, error } = await svc.from('trap_types').insert({ name: name.trim() }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: data.id })
  }

  if (type === 'update-trap-type') {
    const { id, name } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name.trim()
    const { error } = await svc.from('trap_types').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (type === 'toggle-trap-type') {
    const { id, isActive } = body
    if (!id || isActive === undefined) return NextResponse.json({ error: 'id and isActive are required' }, { status: 400 })
    const { error } = await svc.from('trap_types').update({ is_active: isActive }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Lure Types ──────────────────────────────────────────────────────────

  if (type === 'create-lure-type') {
    const { name, pestId, rebaitWeeks, description } = body
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const { data, error } = await svc.from('lure_types').insert({
      name: name.trim(),
      pest_id: pestId || null,
      rebait_weeks: rebaitWeeks || null,
      description: description || null,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: data.id })
  }

  if (type === 'update-lure-type') {
    const { id, name, pestId, rebaitWeeks, description } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name.trim()
    if (pestId !== undefined) updates.pest_id = pestId || null
    if (rebaitWeeks !== undefined) updates.rebait_weeks = rebaitWeeks || null
    if (description !== undefined) updates.description = description || null
    const { error } = await svc.from('lure_types').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (type === 'toggle-lure-type') {
    const { id, isActive } = body
    if (!id || isActive === undefined) return NextResponse.json({ error: 'id and isActive are required' }, { status: 400 })
    const { error } = await svc.from('lure_types').update({ is_active: isActive }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Valid Combinations ──────────────────────────────────────────────────

  if (type === 'add-combination') {
    const { trapTypeId, lureTypeId, isDefault } = body
    if (!trapTypeId) return NextResponse.json({ error: 'trapTypeId is required' }, { status: 400 })
    const { data, error } = await svc.from('trap_type_lure_types').insert({
      trap_type_id: trapTypeId,
      lure_type_id: lureTypeId || null,
      is_default: isDefault || false,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: data.id })
  }

  if (type === 'remove-combination') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { error } = await svc.from('trap_type_lure_types').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (type === 'set-default') {
    const { id, trapTypeId } = body
    if (!id || !trapTypeId) return NextResponse.json({ error: 'id and trapTypeId are required' }, { status: 400 })
    // Clear other defaults for this trap type, then set the new one
    const { error: clearErr } = await svc.from('trap_type_lure_types').update({ is_default: false }).eq('trap_type_id', trapTypeId)
    if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 400 })
    const { error } = await svc.from('trap_type_lure_types').update({ is_default: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

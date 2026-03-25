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

  if (!orgUser || !['super_admin', 'org_admin', 'manager'].includes(orgUser.role)) {
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
    const { farmId, orchardId, zoneId, trapTypeId, organisationId, lureTypeId, pestId, trapNr } = body
    if (!farmId || !orchardId || !zoneId || !trapTypeId || !organisationId) {
      return NextResponse.json({ error: 'farmId, orchardId, zoneId, trapTypeId, organisationId are required' }, { status: 400 })
    }

    let nextTrapNr = trapNr
    if (!nextTrapNr) {
      const { data: maxRow } = await svc
        .from('traps')
        .select('trap_nr')
        .eq('farm_id', farmId)
        .order('trap_nr', { ascending: false })
        .limit(1)
        .single()
      nextTrapNr = (maxRow?.trap_nr || 0) + 1
    }

    const { data: trap, error } = await svc
      .from('traps')
      .insert({
        organisation_id: organisationId,
        farm_id: farmId,
        orchard_id: orchardId,
        zone_id: zoneId,
        trap_type_id: trapTypeId,
        lure_type_id: lureTypeId || null,
        pest_id: pestId || null,
        trap_nr: nextTrapNr,
        is_active: true,
      })
      .select('id, trap_nr')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, trap })
  }

  if (type === 'update') {
    const { trapId, orchardId, zoneId, trapTypeId, lureTypeId, pestId, trapNr, isActive } = body
    if (!trapId) return NextResponse.json({ error: 'trapId is required' }, { status: 400 })

    const updates: Record<string, any> = {}
    if (orchardId !== undefined) updates.orchard_id = orchardId
    if (zoneId !== undefined) updates.zone_id = zoneId
    if (trapTypeId !== undefined) updates.trap_type_id = trapTypeId
    if (lureTypeId !== undefined) updates.lure_type_id = lureTypeId || null
    if (pestId !== undefined) updates.pest_id = pestId || null
    if (trapNr !== undefined) updates.trap_nr = trapNr
    if (isActive !== undefined) updates.is_active = isActive

    const { error } = await svc.from('traps').update(updates).eq('id', trapId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (type === 'toggle-active') {
    const { trapId, isActive } = body
    if (!trapId || isActive === undefined) {
      return NextResponse.json({ error: 'trapId and isActive are required' }, { status: 400 })
    }
    const { error } = await svc.from('traps').update({ is_active: isActive }).eq('id', trapId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

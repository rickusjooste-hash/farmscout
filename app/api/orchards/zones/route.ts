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
  if (!user) return { error: 'Unauthorized', status: 401 }

  const { data: orgUser } = await anon
    .from('organisation_users')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .single()
  if (!orgUser) return { error: 'Forbidden', status: 403 }

  if (orgUser.role !== 'super_admin') {
    if (orgUser.role === 'org_admin') {
      const { data: farm } = await anon.from('farms').select('organisation_id').eq('id', farmId).single()
      if (!farm || farm.organisation_id !== orgUser.organisation_id)
        return { error: 'Forbidden', status: 403 }
    } else {
      const { data: access } = await anon
        .from('user_farm_access').select('id').eq('user_id', user.id).eq('farm_id', farmId).single()
      if (!access) return { error: 'Forbidden', status: 403 }
    }
  }

  return { error: null, status: 200 }
}

// GET /api/orchards/zones?orchard_id=<uuid>
export async function GET(req: NextRequest) {
  const orchardId = req.nextUrl.searchParams.get('orchard_id')
  if (!orchardId) return NextResponse.json({ error: 'orchard_id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await anon
    .from('zones')
    .select('id, name, zone_nr, zone_letter')
    .eq('orchard_id', orchardId)
    .order('zone_nr')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

// POST /api/orchards/zones
// body: { type: 'generate', orchardId, ha } | { type: 'create', orchardId, zoneLetter, zoneNr, name }
export async function POST(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { type, orchardId } = body
  if (!type || !orchardId) return NextResponse.json({ error: 'type and orchardId required' }, { status: 400 })

  // Get orchard to find farm + section + org
  const anon = anonSupabase(req)
  const { data: orchard } = await anon
    .from('orchards')
    .select('name, variety, farm_id, section_id, organisation_id')
    .eq('id', orchardId)
    .single()
  if (!orchard) return NextResponse.json({ error: 'Orchard not found' }, { status: 404 })

  const { error: accessErr, status } = await checkAccess(req, orchard.farm_id)
  if (accessErr) return NextResponse.json({ error: accessErr }, { status })

  const svc = svcSupabase()

  if (type === 'generate') {
    const ha = parseFloat(body.ha)
    if (!ha || ha <= 0) return NextResponse.json({ error: 'ha must be a positive number' }, { status: 400 })
    const count = Math.ceil(ha / 2)

    // Delete existing zones first
    const { error: delErr } = await svc.from('zones').delete().eq('orchard_id', orchardId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

    // Create new zones — zones table has no farm_id column
    const rows = Array.from({ length: count }, (_, i) => {
      const letter = String.fromCharCode(65 + i) // A, B, C…
      return {
        organisation_id: orchard.organisation_id,
        orchard_id: orchardId,
        section_id: orchard.section_id,
        zone_nr: i + 1,
        zone_letter: letter,
        name: `${orchard.name}${orchard.variety ? ` (${orchard.variety})` : ''} - Zone ${letter}`,
      }
    })

    const { data: inserted, error: insErr } = await svc
      .from('zones').insert(rows).select('id, name, zone_nr, zone_letter')
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
    return NextResponse.json(inserted ?? [])
  }

  if (type === 'create') {
    const { zoneLetter, zoneNr, name } = body
    if (!zoneLetter || !zoneNr || !name)
      return NextResponse.json({ error: 'zoneLetter, zoneNr, name required' }, { status: 400 })

    const { data: inserted, error: insErr } = await svc
      .from('zones')
      .insert({
        organisation_id: orchard.organisation_id,
        orchard_id: orchardId,
        section_id: orchard.section_id,
        zone_nr: zoneNr,
        zone_letter: zoneLetter,
        name,
      })
      .select('id, name, zone_nr, zone_letter')
      .single()
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
    return NextResponse.json(inserted)
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

// PATCH /api/orchards/zones  body: { id, name }
export async function PATCH(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id, name } = body
  if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 })

  // zones has no farm_id — join through orchard
  const anon = anonSupabase(req)
  const { data: zone } = await anon
    .from('zones')
    .select('orchard_id, orchards!inner(farm_id)')
    .eq('id', id)
    .single()
  if (!zone) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })

  const farmId = (zone.orchards as any)?.farm_id
  const { error: accessErr, status } = await checkAccess(req, farmId)
  if (accessErr) return NextResponse.json({ error: accessErr }, { status })

  const svc = svcSupabase()
  const { error } = await svc.from('zones').update({ name }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/orchards/zones  body: { id }
export async function DELETE(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // zones has no farm_id — join through orchard
  const anon = anonSupabase(req)
  const { data: zone } = await anon
    .from('zones')
    .select('orchard_id, orchards!inner(farm_id)')
    .eq('id', id)
    .single()
  if (!zone) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })

  const farmId = (zone.orchards as any)?.farm_id
  const { error: accessErr, status } = await checkAccess(req, farmId)
  if (accessErr) return NextResponse.json({ error: accessErr }, { status })

  const svc = svcSupabase()
  const { error } = await svc.from('zones').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

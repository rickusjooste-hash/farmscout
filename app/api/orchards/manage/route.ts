import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
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

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    type, id, farmId, name, commodityId, sectionId,
    orchardNr, variety, varietyGroup, rootstock,
    ha, yearPlanted, treesPerHa, nrOfTrees,
    plantDistance, rowWidth, legacyId, boundary,
  } = body

  if (!type || !['create', 'update'].includes(type)) {
    return NextResponse.json({ error: 'type must be "create" or "update"' }, { status: 400 })
  }
  if (!name || !commodityId) {
    return NextResponse.json({ error: 'name and commodityId are required' }, { status: 400 })
  }

  if (!farmId) {
    return NextResponse.json({ error: 'farmId is required' }, { status: 400 })
  }

  // For access check on update, use the orchard's CURRENT farm (not the new one)
  let accessFarmId = farmId
  if (type === 'update') {
    if (!id) return NextResponse.json({ error: 'id is required for update' }, { status: 400 })
    const { data: orchard } = await anonClient
      .from('orchards')
      .select('farm_id')
      .eq('id', id)
      .single()
    if (!orchard) return NextResponse.json({ error: 'Orchard not found' }, { status: 404 })
    accessFarmId = orchard.farm_id
  }

  // Access check (against current/original farm)
  const { data: orgUser } = await anonClient
    .from('organisation_users')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .single()

  if (!orgUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (orgUser.role !== 'super_admin') {
    if (orgUser.role === 'org_admin') {
      const { data: farm } = await anonClient
        .from('farms')
        .select('organisation_id')
        .eq('id', accessFarmId)
        .single()
      if (!farm || farm.organisation_id !== orgUser.organisation_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const { data: access } = await anonClient
        .from('user_farm_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('farm_id', accessFarmId)
        .single()
      if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Get organisation_id from the target farm (needed for both create and update)
  const { data: targetFarm } = await anonClient
    .from('farms')
    .select('organisation_id')
    .eq('id', farmId)
    .single()
  if (!targetFarm) return NextResponse.json({ error: 'Farm not found' }, { status: 404 })
  const organisationId = targetFarm.organisation_id

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: orchardId, error } = await svc.rpc('upsert_orchard', {
    p_id:              type === 'update' ? id : undefined,
    p_organisation_id: organisationId,
    p_farm_id:         farmId,
    p_commodity_id:    commodityId,
    p_name:            name,
    p_section_id:      sectionId ?? null,
    p_orchard_nr:      orchardNr ?? null,
    p_variety:         variety ?? null,
    p_variety_group:   varietyGroup ?? null,
    p_rootstock:       rootstock ?? null,
    p_ha:              ha ?? null,
    p_year_planted:    yearPlanted ?? null,
    p_trees_per_ha:    treesPerHa ?? null,
    p_nr_of_trees:     nrOfTrees ?? null,
    p_plant_distance:  plantDistance ?? null,
    p_row_width:       rowWidth ?? null,
    p_legacy_id:       legacyId ?? null,
    p_boundary:        boundary ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, orchardId })
}

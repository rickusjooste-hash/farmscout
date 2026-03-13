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

// POST /api/fertilizer/import
// body: {
//   farm_id, season, commodity_id?, program_type?, soil_scientist?, reference_no?,
//   products: [{ name, registration_no?, n_pct, p_pct, k_pct, ca_pct, mg_pct, s_pct, default_unit }],
//   timings: [{ label, sort_order, products: [{ product_name, unit }] }],
//   lines: [{ timing_label, product_name, orchard_id?, legacy_orchard_id?, source_block_name, rate_per_ha, unit, total_qty, ha, target_ton_ha }],
//   orchard_mappings?: [{ source_name, orchard_id }]
// }
export async function POST(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { farm_id, season, commodity_id, program_type, soil_scientist, reference_no, products, timings, lines, orchard_mappings } = body
  if (!farm_id || !season || !lines?.length)
    return NextResponse.json({ error: 'farm_id, season, lines required' }, { status: 400 })

  // Auth check
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgUser } = await anon
    .from('organisation_users')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .single()
  if (!orgUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (orgUser.role !== 'super_admin') {
    if (orgUser.role === 'org_admin') {
      const { data: farm } = await anon.from('farms').select('organisation_id').eq('id', farm_id).single()
      if (!farm || farm.organisation_id !== orgUser.organisation_id)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else {
      const { data: access } = await anon
        .from('user_farm_access').select('id').eq('user_id', user.id).eq('farm_id', farm_id).single()
      if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Get org_id from farm
  const { data: farm } = await anon.from('farms').select('organisation_id').eq('id', farm_id).single()
  if (!farm) return NextResponse.json({ error: 'Farm not found' }, { status: 404 })

  const svc = svcSupabase()
  const orgId = farm.organisation_id
  const progType = program_type || 'standard'

  // Delete existing recommendation for same farm+season+commodity+program_type (re-import replaces)
  // Only dedup when a specific commodity is selected; when commodity is null/mixed,
  // skip the delete to avoid wiping other commodities' data
  if (commodity_id) {
    await svc
      .from('fert_recommendations')
      .delete()
      .eq('farm_id', farm_id)
      .eq('season', season)
      .eq('program_type', progType)
      .eq('commodity_id', commodity_id)
  }

  // Upsert products
  const productIdMap: Record<string, string> = {}
  if (products?.length) {
    for (const p of products) {
      const { data: upserted, error: pErr } = await svc
        .from('fert_products')
        .upsert({
          organisation_id: orgId,
          name: p.name,
          registration_no: p.registration_no || null,
          n_pct: p.n_pct || 0,
          p_pct: p.p_pct || 0,
          k_pct: p.k_pct || 0,
          ca_pct: p.ca_pct || 0,
          mg_pct: p.mg_pct || 0,
          s_pct: p.s_pct || 0,
          default_unit: p.default_unit || 'kg/ha',
        }, { onConflict: 'organisation_id,name' })
        .select('id, name')
        .single()
      if (!pErr && upserted) productIdMap[p.name] = upserted.id
    }
  }

  // Also fetch any existing products for this org (in case lines reference products not in the products list)
  const { data: allProducts } = await svc
    .from('fert_products')
    .select('id, name')
    .eq('organisation_id', orgId)
  if (allProducts) {
    for (const p of allProducts) {
      if (!productIdMap[p.name]) productIdMap[p.name] = p.id
    }
  }

  // Create recommendation
  const { data: rec, error: recErr } = await svc
    .from('fert_recommendations')
    .insert({
      organisation_id: orgId,
      farm_id,
      commodity_id: commodity_id || null,
      season,
      program_type: progType,
      soil_scientist: soil_scientist || null,
      reference_no: reference_no || null,
      imported_by: user.id,
    })
    .select('id')
    .single()

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 400 })

  // Create timings
  const timingIdMap: Record<string, string> = {}
  if (timings?.length) {
    for (const t of timings) {
      const { data: timing, error: tErr } = await svc
        .from('fert_timings')
        .insert({
          recommendation_id: rec.id,
          label: t.label,
          sort_order: t.sort_order,
        })
        .select('id')
        .single()
      if (!tErr && timing) timingIdMap[t.label] = timing.id
    }
  }

  // Insert lines
  let importedCount = 0
  let skippedCount = 0

  for (const line of lines) {
    const timingId = timingIdMap[line.timing_label]
    const productId = productIdMap[line.product_name]

    if (!timingId || !productId) {
      skippedCount++
      continue
    }

    const { error: lErr } = await svc
      .from('fert_recommendation_lines')
      .insert({
        recommendation_id: rec.id,
        timing_id: timingId,
        product_id: productId,
        orchard_id: line.orchard_id || null,
        legacy_orchard_id: line.legacy_orchard_id || null,
        source_block_name: line.source_block_name || null,
        rate_per_ha: line.rate_per_ha ?? 0,
        unit: line.unit || 'kg/ha',
        total_qty: line.total_qty ?? null,
        ha: line.ha ?? null,
        target_ton_ha: line.target_ton_ha ?? null,
      })

    if (lErr) {
      skippedCount++
    } else {
      importedCount++
    }
  }

  // Save orchard mappings for future imports
  if (orchard_mappings?.length) {
    for (const m of orchard_mappings) {
      if (!m.source_name || !m.orchard_id) continue
      await svc.from('fert_orchard_map').upsert(
        {
          organisation_id: orgId,
          farm_id,
          source_name: m.source_name,
          orchard_id: m.orchard_id,
        },
        { onConflict: 'organisation_id,farm_id,source_name' }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    recommendation_id: rec.id,
    imported: importedCount,
    skipped: skippedCount,
    total: lines.length,
    products: Object.keys(productIdMap).length,
    timings: Object.keys(timingIdMap).length,
  })
}

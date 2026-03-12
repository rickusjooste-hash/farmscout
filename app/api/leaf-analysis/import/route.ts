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

// POST /api/leaf-analysis/import
// body: {
//   farm_id, season, lab_name?,
//   rows: [{ orchard_id, sample_date, sample_type?, results: { nutrient_code: value, ... } }],
//   orchard_mappings?: [{ source_name, orchard_id }]
// }
export async function POST(req: NextRequest) {
  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { farm_id, season, lab_name, rows, orchard_mappings } = body
  if (!farm_id || !season || !rows?.length)
    return NextResponse.json({ error: 'farm_id, season, rows required' }, { status: 400 })

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

  // Get nutrients lookup
  const { data: nutrients } = await anon.from('nutrients').select('id, code').order('display_order')
  if (!nutrients?.length) return NextResponse.json({ error: 'No nutrients configured' }, { status: 500 })
  const nutrientByCode: Record<string, string> = {}
  for (const n of nutrients) nutrientByCode[n.code] = n.id

  const svc = svcSupabase()
  let importedCount = 0
  let skippedCount = 0

  for (const row of rows) {
    const { orchard_id, sample_date, sample_type, results } = row
    if (!orchard_id || !sample_date || !results) {
      skippedCount++
      continue
    }

    // Check for existing analysis (idempotent — same orchard + season + sample_date = skip)
    const { data: existing } = await svc
      .from('leaf_analyses')
      .select('id')
      .eq('orchard_id', orchard_id)
      .eq('season', season)
      .eq('sample_date', sample_date)
      .limit(1)

    if (existing && existing.length > 0) {
      skippedCount++
      continue
    }

    // Insert leaf_analyses row
    const { data: analysis, error: aErr } = await svc
      .from('leaf_analyses')
      .insert({
        organisation_id: farm.organisation_id,
        farm_id,
        orchard_id,
        season,
        sample_date,
        sample_type: sample_type || 'mid-season',
        lab_name: lab_name || null,
        imported_by: user.id,
      })
      .select('id')
      .single()

    if (aErr) {
      skippedCount++
      continue
    }

    // Insert results
    const resultRows = []
    for (const [code, value] of Object.entries(results)) {
      const nutrientId = nutrientByCode[code]
      if (!nutrientId || value === null || value === undefined || value === '') continue
      const numVal = parseFloat(String(value))
      if (isNaN(numVal)) continue

      const nutrient = nutrients.find(n => n.code === code)
      const unit = nutrient ? (['N', 'P', 'K', 'Ca', 'Mg', 'S'].includes(code) ? '%' : 'mg/kg') : '%'

      resultRows.push({
        analysis_id: analysis.id,
        nutrient_id: nutrientId,
        value: numVal,
        unit,
      })
    }

    if (resultRows.length > 0) {
      await svc.from('leaf_analysis_results').insert(resultRows)
      importedCount++
    } else {
      // No valid results — delete the empty analysis
      await svc.from('leaf_analyses').delete().eq('id', analysis.id)
      skippedCount++
    }
  }

  // Save orchard mappings for future imports
  if (orchard_mappings?.length) {
    for (const m of orchard_mappings) {
      if (!m.source_name || !m.orchard_id) continue
      await svc.from('leaf_analysis_orchard_map').upsert(
        {
          organisation_id: farm.organisation_id,
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
    imported: importedCount,
    skipped: skippedCount,
    total: rows.length,
  })
}

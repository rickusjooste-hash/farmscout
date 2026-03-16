import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

function anonSupabase(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } }
  )
}

// GET /api/benchmarks?farm_ids=<uuid,uuid>&season=<text>&commodity_id=<uuid>
export async function GET(req: NextRequest) {
  const farmIdsParam = req.nextUrl.searchParams.get('farm_ids')
  const season = req.nextUrl.searchParams.get('season')
  const commodityId = req.nextUrl.searchParams.get('commodity_id')

  if (!farmIdsParam) return NextResponse.json({ error: 'farm_ids required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const farmIds = farmIdsParam.split(',')

  const { data, error } = await anon.rpc('get_production_benchmarks', {
    p_farm_ids: farmIds,
    p_season: season || null,
    p_commodity_id: commodityId || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

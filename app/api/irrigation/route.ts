import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

function anonSupabase(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } }
  )
}

// GET /api/irrigation?farm_ids=uuid1,uuid2&days=14
export async function GET(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const farmIdsParam = req.nextUrl.searchParams.get('farm_ids')
  const days = parseInt(req.nextUrl.searchParams.get('days') || '14')

  if (!farmIdsParam) return NextResponse.json({ error: 'farm_ids required' }, { status: 400 })
  const farmIds = farmIdsParam.split(',').filter(Boolean)

  const [summaryRes, eventsRes, seasonRes] = await Promise.all([
    anon.rpc('get_irrigation_summary', { p_farm_ids: farmIds, p_days: days }),
    anon.rpc('get_irrigation_events', { p_farm_ids: farmIds, p_days: days }),
    anon.rpc('get_irrigation_season_totals', { p_farm_ids: farmIds }),
  ])

  if (summaryRes.error) return NextResponse.json({ error: summaryRes.error.message }, { status: 500 })

  return NextResponse.json({
    summary: summaryRes.data || [],
    events: eventsRes.data || [],
    seasonTotals: seasonRes.data || [],
  })
}

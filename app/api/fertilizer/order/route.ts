import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

function anonSupabase(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } }
  )
}

// GET /api/fertilizer/order?farm_id=<uuid>&season=<text>
export async function GET(req: NextRequest) {
  const farmId = req.nextUrl.searchParams.get('farm_id')
  const season = req.nextUrl.searchParams.get('season')

  if (!farmId) return NextResponse.json({ error: 'farm_id required' }, { status: 400 })

  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await anon.rpc('get_fert_order_list', {
    p_farm_ids: [farmId],
    p_season: season || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

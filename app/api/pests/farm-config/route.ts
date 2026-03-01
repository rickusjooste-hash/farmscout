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

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { commodityPestId, farmId, isActive } = body
  if (!commodityPestId || !farmId || typeof isActive !== 'boolean') {
    return NextResponse.json({ error: 'commodityPestId, farmId and isActive are required' }, { status: 400 })
  }

  // Verify caller has access to this farm
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
        .eq('id', farmId)
        .single()
      if (!farm || farm.organisation_id !== orgUser.organisation_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const { data: access } = await anonClient
        .from('user_farm_access')
        .select('id')
        .eq('user_id', user.id)
        .eq('farm_id', farmId)
        .single()
      if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await svc
    .from('farm_commodity_pest_config')
    .upsert(
      { farm_id: farmId, commodity_pest_id: commodityPestId, is_active: isActive },
      { onConflict: 'farm_id,commodity_pest_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

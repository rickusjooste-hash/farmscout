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

/** PATCH — update a bag session (e.g. reassign orchard) */
export async function PATCH(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  const admin = svcSupabase()

  const updates: Record<string, any> = {}
  if (body.orchard_id) updates.orchard_id = body.orchard_id
  if (body.collection_lat !== undefined) updates.collection_lat = body.collection_lat
  if (body.collection_lng !== undefined) updates.collection_lng = body.collection_lng

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await admin
    .from('qc_bag_sessions')
    .update(updates)
    .eq('id', body.session_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When orchard changes, re-map size bins on existing fruit records
  if (body.orchard_id) {
    await remapSizeBins(admin, body.session_id, body.orchard_id)
  }

  return NextResponse.json({ success: true })
}

/** Re-assign size_bin_id on all qc_fruit for a session based on new orchard's commodity */
async function remapSizeBins(admin: ReturnType<typeof svcSupabase>, sessionId: string, orchardId: string) {
  // 1. Get new orchard's commodity_id
  const { data: orchard } = await admin
    .from('orchards')
    .select('commodity_id')
    .eq('id', orchardId)
    .single()
  if (!orchard?.commodity_id) return

  // 2. Get size bins for that commodity
  const { data: bins } = await admin
    .from('size_bins')
    .select('id, weight_min_g, weight_max_g')
    .eq('commodity_id', orchard.commodity_id)
    .eq('is_active', true)
  if (!bins) return

  // 3. Get all fruit for this session
  const { data: fruit } = await admin
    .from('qc_fruit')
    .select('id, weight_g')
    .eq('session_id', sessionId)
  if (!fruit?.length) return

  // 4. Re-map each fruit to the correct size bin
  for (const f of fruit) {
    const match = bins.find(b => f.weight_g >= b.weight_min_g && f.weight_g <= b.weight_max_g)
    await admin
      .from('qc_fruit')
      .update({ size_bin_id: match?.id ?? null })
      .eq('id', f.id)
  }
}

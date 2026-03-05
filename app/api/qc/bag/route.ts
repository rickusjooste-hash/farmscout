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

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await admin
    .from('qc_bag_sessions')
    .update(updates)
    .eq('id', body.session_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

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

/** GET — list QC/Runner users for the caller's org */
export async function GET(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgUser } = await anon
    .from('organisation_users')
    .select('organisation_id, role')
    .eq('user_id', user.id)
    .single()

  if (!orgUser) return NextResponse.json({ error: 'No org membership' }, { status: 403 })

  const admin = svcSupabase()

  // Get QC/Runner org_users
  const { data: orgUsers, error } = await admin
    .from('organisation_users')
    .select('id, user_id, role, created_at')
    .eq('organisation_id', orgUser.organisation_id)
    .in('role', ['runner', 'qc_worker'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!orgUsers?.length) return NextResponse.json({ users: [] })

  // Get profiles
  const userIds = orgUsers.map(u => u.user_id)
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, full_name')
    .in('id', userIds)

  // Get emails from auth.users via admin API
  const emailMap: Record<string, string> = {}
  for (const uid of userIds) {
    const { data } = await admin.auth.admin.getUserById(uid)
    if (data?.user?.email) emailMap[uid] = data.user.email
  }

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]))

  const users = orgUsers.map(ou => ({
    id: ou.id,
    user_id: ou.user_id,
    full_name: profileMap[ou.user_id] || '—',
    email: emailMap[ou.user_id] || '—',
    role: ou.role,
    created_at: ou.created_at,
  }))

  return NextResponse.json({ users })
}

/** DELETE — revoke a QC/Runner user's access */
export async function DELETE(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgUser } = await anon
    .from('organisation_users')
    .select('organisation_id, role')
    .eq('user_id', user.id)
    .single()

  if (!orgUser) return NextResponse.json({ error: 'No org membership' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body?.user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const admin = svcSupabase()

  // Verify the target user belongs to same org and is runner/qc_worker
  const { data: target } = await admin
    .from('organisation_users')
    .select('id, role')
    .eq('organisation_id', orgUser.organisation_id)
    .eq('user_id', body.user_id)
    .in('role', ['runner', 'qc_worker'])
    .single()

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Delete org membership
  await admin.from('organisation_users').delete().eq('id', target.id)

  // Delete farm access
  await admin.from('user_farm_access').delete().eq('user_id', body.user_id)

  // Delete the auth user + profile
  await admin.from('user_profiles').delete().eq('id', body.user_id)
  await admin.auth.admin.deleteUser(body.user_id)

  return NextResponse.json({ success: true })
}

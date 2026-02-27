import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing service role key' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let body: {
    full_name: string
    email: string
    password: string
    organisation_id: string
    farm_id?: string
    farm_ids?: string[]
    employee_nr?: string
    type: 'scout' | 'manager'
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { full_name, email, password, organisation_id, farm_id, farm_ids, employee_nr, type } = body

  if (!full_name || !email || !password || !organisation_id || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData?.user) {
    return NextResponse.json({ error: authError?.message || 'Failed to create auth user' }, { status: 400 })
  }

  const userId = authData.user.id

  // 2. Insert user_profiles
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({ id: userId, full_name })

  if (profileError) {
    // Clean up auth user on failure
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: `Failed to create profile: ${profileError.message}` }, { status: 500 })
  }

  if (type === 'scout') {
    if (!farm_id) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'farm_id required for scout creation' }, { status: 400 })
    }

    // 3. Insert scout record
    const { data: scoutData, error: scoutError } = await supabase
      .from('scouts')
      .insert({
        user_id: userId,
        organisation_id,
        farm_id,
        full_name,
        email,
        employee_nr: employee_nr || null,
        is_active: true,
      })
      .select('id')
      .single()

    if (scoutError) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: `Failed to create scout: ${scoutError.message}` }, { status: 500 })
    }

    // 4. Insert organisation_users
    const { error: orgUserError } = await supabase
      .from('organisation_users')
      .insert({ organisation_id, user_id: userId, role: 'scout' as const })

    if (orgUserError) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: `Failed to create org membership: ${orgUserError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, scout_id: scoutData.id })
  }

  if (type === 'manager') {
    // 3. Insert organisation_users
    const { error: orgUserError } = await supabase
      .from('organisation_users')
      .insert({ organisation_id, user_id: userId, role: 'manager' })

    if (orgUserError) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: `Failed to create org membership: ${orgUserError.message}` }, { status: 500 })
    }

    // 4. Insert user_farm_access for each farm
    const farms = farm_ids?.length ? farm_ids : farm_id ? [farm_id] : []
    if (farms.length > 0) {
      const farmAccessRows = farms.map((fid) => ({
        organisation_id,
        user_id: userId,
        farm_id: fid,
      }))
      const { error: farmAccessError } = await supabase
        .from('user_farm_access')
        .insert(farmAccessRows)

      if (farmAccessError) {
        await supabase.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: `Failed to assign farm access: ${farmAccessError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

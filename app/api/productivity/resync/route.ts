import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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

  const { data: orgUser } = await anonClient
    .from('organisation_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!orgUser || !['super_admin', 'org_admin', 'manager'].includes(orgUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dateParam = req.nextUrl.searchParams.get('date')
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'date parameter required (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    const python = process.env.PYTHON_PATH || 'C:/Python314/python.exe'
    const script = 'scripts/sync-worker-productivity.py'
    const { stdout, stderr } = await execAsync(
      `"${python}" "${script}" --date ${dateParam}`,
      { cwd: process.cwd(), timeout: 120000 }
    )

    const output = (stdout + '\n' + stderr).trim()
    return NextResponse.json({ ok: true, output })
  } catch (err: any) {
    const output = (err.stdout || '') + '\n' + (err.stderr || '')
    return NextResponse.json({ error: 'Sync failed', output: output.trim() }, { status: 500 })
  }
}

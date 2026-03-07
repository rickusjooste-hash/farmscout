import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders(prefer?: string) {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    ...(prefer ? { 'Prefer': prefer } : {}),
  }
}

// GET /api/qc/assignments?organisation_id=xxx
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('organisation_id')
    if (!orgId) return NextResponse.json({ error: 'Missing organisation_id' }, { status: 400 })

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/qc_runner_assignments?organisation_id=eq.${orgId}&select=id,runner_user_id,qc_worker_user_id,created_at`,
      { headers: serviceHeaders() }
    )
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }
    const assignments = await res.json()

    // Collect unique user IDs to fetch display names
    const userIds = new Set<string>()
    for (const a of assignments) {
      userIds.add(a.runner_user_id)
      userIds.add(a.qc_worker_user_id)
    }

    let nameMap: Record<string, string> = {}
    if (userIds.size > 0) {
      const ids = Array.from(userIds)
      const filter = ids.length === 1
        ? `id=eq.${ids[0]}`
        : `id=in.(${ids.join(',')})`
      const profilesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_profiles?${filter}&select=id,full_name`,
        { headers: serviceHeaders() }
      )
      if (profilesRes.ok) {
        const profiles: { id: string; full_name: string }[] = await profilesRes.json()
        nameMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]))
      }
    }

    const enriched = assignments.map((a: any) => ({
      ...a,
      runner_name: nameMap[a.runner_user_id] || 'Unknown',
      qc_worker_name: nameMap[a.qc_worker_user_id] || 'Unknown',
    }))

    return NextResponse.json({ assignments: enriched })
  } catch (err) {
    console.error('/api/qc/assignments GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/qc/assignments { runner_user_id, qc_worker_user_id, organisation_id }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { runner_user_id, qc_worker_user_id, organisation_id } = body
    if (!runner_user_id || !qc_worker_user_id || !organisation_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/qc_runner_assignments`, {
      method: 'POST',
      headers: serviceHeaders('return=representation'),
      body: JSON.stringify({ runner_user_id, qc_worker_user_id, organisation_id }),
    })

    if (!res.ok) {
      const text = await res.text()
      if (text.includes('duplicate') || text.includes('unique')) {
        return NextResponse.json({ error: 'This assignment already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: text }, { status: res.status })
    }

    const created = await res.json()
    return NextResponse.json({ assignment: created[0] || created })
  } catch (err) {
    console.error('/api/qc/assignments POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/qc/assignments { id }
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const res = await fetch(`${SUPABASE_URL}/rest/v1/qc_runner_assignments?id=eq.${id}`, {
      method: 'DELETE',
      headers: serviceHeaders('return=minimal'),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('/api/qc/assignments DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

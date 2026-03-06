import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/inspections/reassign
// Body: { mode: 'tree' | 'session', tree_id?: string, session_id: string, zone_id: string }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode, tree_id, session_id, zone_id } = body

  if (!session_id || !zone_id || !mode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Look up zone → orchard_id
  const { data: zone, error: zoneErr } = await supabase
    .from('zones')
    .select('id, orchard_id')
    .eq('id', zone_id)
    .single()
  if (zoneErr || !zone) {
    return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
  }

  if (mode === 'session') {
    // Move the entire session to the new zone
    const { error } = await supabase
      .from('inspection_sessions')
      .update({ zone_id: zone.id, orchard_id: zone.orchard_id })
      .eq('id', session_id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, moved: 'session' })
  }

  if (mode === 'tree' && tree_id) {
    // Get the original session to copy its metadata
    const { data: origSession } = await supabase
      .from('inspection_sessions')
      .select('*')
      .eq('id', session_id)
      .single()
    if (!origSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Find or create a session for this zone in the same week
    const weekStart = new Date(origSession.inspected_at)
    weekStart.setUTCHours(0, 0, 0, 0)
    const dow = (weekStart.getUTCDay() + 6) % 7
    weekStart.setUTCDate(weekStart.getUTCDate() - dow)
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)

    const { data: existing } = await supabase
      .from('inspection_sessions')
      .select('id')
      .eq('zone_id', zone_id)
      .eq('scout_id', origSession.scout_id)
      .gte('inspected_at', weekStart.toISOString())
      .lt('inspected_at', weekEnd.toISOString())
      .limit(1)

    let targetSessionId: string
    if (existing && existing.length > 0) {
      targetSessionId = existing[0].id
    } else {
      // Create a new session for the target zone
      const newSession = {
        id: crypto.randomUUID(),
        organisation_id: origSession.organisation_id,
        farm_id: origSession.farm_id,
        orchard_id: zone.orchard_id,
        zone_id: zone.id,
        scout_id: origSession.scout_id,
        inspected_at: origSession.inspected_at,
        week_nr: origSession.week_nr,
        tree_count: origSession.tree_count,
      }
      const { error: createErr } = await supabase
        .from('inspection_sessions')
        .insert(newSession)
      if (createErr) {
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }
      targetSessionId = newSession.id
    }

    // Move the tree to the target session
    const { error: moveErr } = await supabase
      .from('inspection_trees')
      .update({ session_id: targetSessionId })
      .eq('id', tree_id)
    if (moveErr) {
      return NextResponse.json({ error: moveErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, moved: 'tree', target_session_id: targetSessionId })
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
}

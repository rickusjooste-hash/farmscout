import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // days back to Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

// GET /api/scout/pull-week-progress
// Returns this week's inspection_sessions + inspection_trees for the scout.
// Used to restore progress after IndexedDB is cleared.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const weekStart = getWeekStart()

  // Fetch this week's sessions for this scout
  const { data: sessions, error: sessErr } = await supabase
    .from('inspection_sessions')
    .select('*')
    .eq('scout_id', user.id)
    .gte('inspected_at', weekStart)

  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 })
  }

  // Fetch trees for those sessions
  let trees: any[] = []
  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map((s: any) => s.id)
    const { data: treesData, error: treesErr } = await supabase
      .from('inspection_trees')
      .select('*')
      .in('session_id', sessionIds)

    if (treesErr) {
      return NextResponse.json({ error: treesErr.message }, { status: 500 })
    }
    trees = treesData || []
  }

  return NextResponse.json({ sessions: sessions || [], trees })
}

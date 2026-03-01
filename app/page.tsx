'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import PestTrendChart from '@/app/components/PestTrendChart'
import OrchardPressureMap from '@/app/components/OrchardPressureMap'
import PestAlertSummary from '@/app/components/PestAlertSummary'
import TreeScoutingAlertSummary from '@/app/components/TreeScoutingAlertSummary'
import { useRouter } from 'next/navigation'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] })


interface Orchard {
  id: string
  name: string
  variety: string
  ha: number
  is_active: boolean
}


export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [weekSessions, setWeekSessions] = useState<string[]>([])
  const [weekExpanded, setWeekExpanded] = useState(false)
  const [trapWeekExpanded, setTrapWeekExpanded] = useState(false)
  const [trapWeekData, setTrapWeekData] = useState<{
    totalTraps: number
    inspectedTraps: number
    perScout: Array<{ name: string; count: number }>
  }>({ totalTraps: 0, inspectedTraps: 0, perScout: [] })
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()
  const [loading, setLoading] = useState(true)
  const [selectedPestId, setSelectedPestId] = useState<string | undefined>()
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const pressureMapRef = useRef<HTMLDivElement>(null)

  function handlePestSelect(pestId: string) {
    setSelectedPestId(pestId)
    pressureMapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    if (!contextLoaded) return
    async function fetchData() {
      try {
        const isSuperAdminUser = isSuperAdmin

        // Orchards + active trap IDs — scoped to accessible farms, fetched in parallel
        let orchardQuery = supabase
          .from('orchards')
          .select('id, name, variety, ha, is_active')
          .eq('is_active', true)
          .order('name')
        let trapIdsQuery = supabase.from('traps').select('id').eq('is_active', true)
        let farmIdsQuery = supabase.from('farms').select('id').eq('is_active', true)
        if (!isSuperAdminUser && farmIds.length > 0) {
          orchardQuery = orchardQuery.in('farm_id', farmIds)
          trapIdsQuery = trapIdsQuery.in('farm_id', farmIds)
          farmIdsQuery = farmIdsQuery.in('id', farmIds)
        }
        const [{ data: orchardData }, { data: activeTrapData }, { data: farmData }] = await Promise.all([orchardQuery, trapIdsQuery, farmIdsQuery])
        setEffectiveFarmIds((farmData || []).map((f: any) => f.id))
        const activeTrapIds = (activeTrapData || []).map((t: any) => t.id)

        const orchardIds = (orchardData || []).map(o => o.id)

        // ISO Monday of current week
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
        weekStart.setHours(0, 0, 0, 0)

        // Build scout query scoped to all accessible farms
        let scoutQuery = supabase.from('scouts').select('user_id, full_name').eq('is_active', true)
        if (!isSuperAdminUser && farmIds.length > 0) {
          scoutQuery = scoutQuery.in('farm_id', farmIds)
        }

        // Run all remaining queries in parallel
        const [
          { data: weekData },
          { data: trapInspData },
          { data: scoutData },
        ] = await Promise.all([
          orchardIds.length > 0
            ? supabase.from('inspection_sessions')
                .select('orchard_id')
                .gte('inspected_at', weekStart.toISOString())
                .in('orchard_id', orchardIds)
            : Promise.resolve({ data: [], error: null, count: null, status: 200, statusText: 'OK' }),
          // Trap inspections this week — just IDs and scout_id, no join
          activeTrapIds.length > 0
            ? supabase.from('trap_inspections')
                .select('trap_id, scout_id')
                .gte('inspected_at', weekStart.toISOString())
                .in('trap_id', activeTrapIds)
            : Promise.resolve({ data: [], error: null, count: null, status: 200, statusText: 'OK' }),
          scoutQuery,
        ])

        // Build scout lookup: user_id → name
        const scoutLookup: Record<string, string> = {}
        ;(scoutData || []).forEach((s: any) => { scoutLookup[s.user_id] = s.full_name })

        // Aggregate trap inspections per scout this week
        const scoutInspMap: Record<string, { name: string; traps: Set<string> }> = {}
        ;(trapInspData || []).forEach((r: any) => {
          const sid = r.scout_id || 'unknown'
          const name = scoutLookup[sid] || 'Unknown'
          if (!scoutInspMap[sid]) scoutInspMap[sid] = { name, traps: new Set() }
          scoutInspMap[sid].traps.add(r.trap_id)
        })
        const inspectedThisWeek = new Set((trapInspData || []).map((r: any) => r.trap_id)).size
        const perScout = Object.values(scoutInspMap)
          .map(s => ({ name: s.name, count: s.traps.size }))
          .sort((a, b) => b.count - a.count)

        setTrapWeekData({ totalTraps: activeTrapIds.length, inspectedTraps: inspectedThisWeek, perScout })
        setOrchards(orchardData || [])
        setWeekSessions([...new Set((weekData || []).map((r: any) => r.orchard_id))])
      } catch (err) {
        console.error('Dashboard fetchData error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [contextLoaded])

  // Week label from ISO Monday
  const weekStartLabel = new Date()
  weekStartLabel.setDate(weekStartLabel.getDate() - ((weekStartLabel.getDay() + 6) % 7))
  weekStartLabel.setHours(0, 0, 0, 0)
  const weekLabel = weekStartLabel.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })

  const totalOrchards = orchards.length
  const weekPct = totalOrchards > 0 ? Math.round((weekSessions.length / totalOrchards) * 100) : 0
  const trapPct = trapWeekData.totalTraps > 0 ? Math.round((trapWeekData.inspectedTraps / trapWeekData.totalTraps) * 100) : 0

  return (
    <div className={inter.className}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Inter', sans-serif;
          background: #f4f1eb;
          color: #1a1a1a;
          min-height: 100vh;
        }

        .app { display: flex; min-height: 100vh; }

        /* Sidebar */
        .sidebar {
          width: 220px;
          height: 100vh;
          position: sticky;
          top: 0;
          overflow-y: auto;
          background: #1c3a2a;
          padding: 32px 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }
        .logo {
          font-family: 'Inter', sans-serif;
          font-size: 22px;
          color: #a8d5a2;
          margin-bottom: 32px;
          letter-spacing: -0.5px;
        }
        .logo span { color: #fff; }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          color: #8aab96;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
        }
        .nav-item:hover { background: #2a4f38; color: #fff; }
        .nav-item.active { background: #2a4f38; color: #a8d5a2; }
        .nav-icon { font-size: 16px; }
        .sidebar-footer {
          margin-top: auto;
          padding-top: 24px;
          border-top: 1px solid #2a4f38;
          font-size: 12px;
          color: #4a7a5a;
        }

        /* Main content */
        .main { flex: 1; padding: 40px; overflow-y: auto; }

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 28px;
        }
        .page-title {
          font-family: 'Inter', sans-serif;
          font-size: 32px;
          color: #1c3a2a;
          letter-spacing: -0.5px;
          line-height: 1;
        }
        .page-subtitle {
          font-size: 14px;
          color: #7a8a80;
          margin-top: 6px;
          font-weight: 300;
        }
        .live-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #1c3a2a;
          color: #a8d5a2;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .live-dot {
          width: 7px; height: 7px;
          background: #4caf72;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Week scouting card */
        .week-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e4dc;
          padding: 24px 28px;
          margin-bottom: 28px;
          position: relative;
          overflow: hidden;
        }
        .week-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #2a6e45, #a8d5a2);
        }
        .week-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .week-card-title {
          font-family: 'Inter', sans-serif;
          font-size: 18px;
          color: #1c3a2a;
        }
        .week-card-meta {
          font-size: 13px;
          color: #9aaa9f;
        }
        .week-progress-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }
        .week-progress-bar-bg {
          flex: 1;
          height: 12px;
          background: #f0ede6;
          border-radius: 6px;
          overflow: hidden;
        }
        .week-progress-bar-fill {
          height: 100%;
          border-radius: 6px;
          background: linear-gradient(90deg, #2a6e45, #6abf7a);
          transition: width 0.6s ease;
        }
        .week-progress-label {
          font-size: 14px;
          font-weight: 600;
          color: #1c3a2a;
          white-space: nowrap;
        }
        .orchard-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .orchard-pill {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .orchard-pill.done {
          background: #e8f5ee;
          color: #2a6e45;
          border: 1px solid #c0e0cc;
        }
        .orchard-pill.pending {
          background: #f4f1eb;
          color: #9aaa9f;
          border: 1px solid #e0ddd5;
        }

        /* Trap week card accent */
        .week-card.trap-card::before {
          background: linear-gradient(90deg, #b36a00, #f0a500);
        }

        /* Per-scout rows (inside trap week expansion) */
        .scout-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .scout-row:last-child { margin-bottom: 0; }
        .scout-name {
          font-size: 13px;
          color: #3a4a40;
          width: 160px;
          flex-shrink: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .scout-count {
          font-size: 13px;
          font-weight: 600;
          color: #1c3a2a;
          width: 70px;
          text-align: right;
          flex-shrink: 0;
        }

        /* Stats grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }
        .stat-card {
          background: #fff;
          border-radius: 14px;
          padding: 24px;
          border: 1px solid #e8e4dc;
          position: relative;
          overflow: hidden;
        }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #2a6e45, #a8d5a2);
        }
        .stat-card.alert-card::before {
          background: linear-gradient(90deg, #c0392b, #e05c4b);
        }
        .stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #9aaa9f;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .stat-value {
          font-family: 'Inter', sans-serif;
          font-size: 38px;
          color: #1c3a2a;
          line-height: 1;
        }
        .stat-value.alert-value { color: #c0392b; }
        .stat-sub {
          font-size: 12px;
          color: #b0bdb5;
          margin-top: 6px;
        }

        /* Map + right col layout */
        .map-row {
          display: grid;
          grid-template-columns: 55fr 45fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .map-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e4dc;
          overflow: hidden;
        }
        .map-card-header {
          padding: 16px 20px 14px;
          border-bottom: 1px solid #f0ede6;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .map-legend {
          display: flex;
          gap: 14px;
          font-size: 12px;
          color: #7a8a80;
          align-items: center;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .legend-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .right-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Cards */
        .card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e4dc;
          overflow: hidden;
        }
        .card-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid #f0ede6;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .card-title {
          font-family: 'Inter', sans-serif;
          font-size: 17px;
          color: #1c3a2a;
        }
        .card-badge {
          background: #f0f7f2;
          color: #3a7a52;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .card-body { padding: 20px 24px; }

        /* Pest bars */
        .pest-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .pest-row:last-child { margin-bottom: 0; }
        .pest-name {
          font-size: 13px;
          color: #3a4a40;
          width: 130px;
          flex-shrink: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pest-bar-bg {
          flex: 1;
          height: 7px;
          background: #f0ede6;
          border-radius: 4px;
          overflow: hidden;
        }
        .pest-bar-fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, #2a6e45, #6abf7a);
          transition: width 0.6s ease;
        }
        .pest-count {
          font-size: 13px;
          font-weight: 600;
          color: #1c3a2a;
          width: 42px;
          text-align: right;
          flex-shrink: 0;
        }

        /* Activity */
        .activity-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 9px 0;
          border-bottom: 1px solid #f9f7f3;
        }
        .activity-item:last-child { border-bottom: none; }
        .activity-dot {
          width: 8px; height: 8px;
          background: #4caf72;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .activity-orchard { font-size: 13.5px; font-weight: 500; color: #1c3a2a; }
        .activity-date { font-size: 12px; color: #9aaa9f; margin-left: auto; }

        /* Loading */
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: 'Inter', sans-serif;
          font-size: 24px;
          color: #1c3a2a;
          background: #f4f1eb;
        }
      `}</style>

      {loading ? (
        <div className="loading">Loading FarmScout…</div>
      ) : (
        <div className="app">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="logo"><span>Farm</span>Scout</div>
<a href="/" className="nav-item active"><span className="nav-icon">📊</span> Dashboard</a>
<a href="/orchards" className="nav-item"><span className="nav-icon">🏡</span> Orchards</a>
<a href="/pests" className="nav-item"><span className="nav-icon">🐛</span> Pests</a>
<a className="nav-item"><span className="nav-icon">🪤</span> Traps</a>
<a className="nav-item"><span className="nav-icon">🔍</span> Inspections</a>
<a href="/scouts" className="nav-item"><span>👷</span> Scouts</a>
<a href="/scouts/new" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>➕</span> New Scout</a>
<a href="/scouts/sections" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>🗂️</span> Sections</a>
{isSuperAdmin && <a href="/admin" className="nav-item"><span>⚙️</span> Admin</a>}
            <div className="sidebar-footer">
  Mouton's Valley Group<br />
  <span style={{ color: '#2a6e45' }}>●</span> Connected
  <br />
  <button onClick={handleLogout} style={{
    marginTop: 10, background: 'none', border: '1px solid #2a4f38',
    color: '#6aaa80', borderRadius: 6, padding: '4px 10px',
    fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif'
  }}>
    Sign out
  </button>
</div>
          </aside>

          {/* Main */}
          <main className="main">
            <div className="page-header">
              <div>
                <div className="page-title">Farm Overview</div>
                <div className="page-subtitle">All farms · Season 2024/25</div>
              </div>
              <div className="live-badge">
                <div className="live-dot" />
                Live
              </div>
            </div>

            {/* This Week's Scouting */}
            <div className="week-card">
              <div className="week-card-header">
                <div className="week-card-title">This Week's Scouting</div>
                <div className="week-card-meta">Week of {weekLabel}</div>
              </div>
              <div className="week-progress-row">
                <div className="week-progress-bar-bg">
                  <div className="week-progress-bar-fill" style={{ width: `${weekPct}%` }} />
                </div>
                <div className="week-progress-label">
                  {weekSessions.length} of {totalOrchards} orchards ({weekPct}%)
                </div>
                <button
                  onClick={() => setWeekExpanded(e => !e)}
                  style={{
                    marginLeft: 12, background: 'none', border: '1px solid #e0ddd5',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                    fontSize: 13, color: '#7a8a80', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}
                  title={weekExpanded ? 'Hide orchards' : 'Show orchards'}
                >
                  <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: weekExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
              </div>
              {weekExpanded && (
                <div className="orchard-pills">
                  {orchards.map(o => (
                    <div
                      key={o.id}
                      className={`orchard-pill ${weekSessions.includes(o.id) ? 'done' : 'pending'}`}
                    >
                      {weekSessions.includes(o.id) ? '✓ ' : ''}{o.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* This Week's Trap Inspections */}
            <div className="week-card trap-card">
              <div className="week-card-header">
                <div className="week-card-title">This Week's Trap Inspections</div>
                <div className="week-card-meta">Week of {weekLabel}</div>
              </div>
              <div className="week-progress-row">
                <div className="week-progress-bar-bg">
                  <div
                    className="week-progress-bar-fill"
                    style={{
                      width: `${trapPct}%`,
                      background: 'linear-gradient(90deg, #b36a00, #f0a500)',
                    }}
                  />
                </div>
                <div className="week-progress-label">
                  {trapWeekData.inspectedTraps} of {trapWeekData.totalTraps} traps ({trapPct}%)
                </div>
                <button
                  onClick={() => setTrapWeekExpanded(e => !e)}
                  style={{
                    marginLeft: 12, background: 'none', border: '1px solid #e0ddd5',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                    fontSize: 13, color: '#7a8a80', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}
                  title={trapWeekExpanded ? 'Hide scouts' : 'Show per scout'}
                >
                  <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: trapWeekExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
              </div>
              {trapWeekExpanded && (
                <div style={{ marginTop: 4 }}>
                  {trapWeekData.perScout.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#9aaa9f' }}>No trap inspections recorded this week.</div>
                  ) : trapWeekData.perScout.map(s => (
                    <div className="scout-row" key={s.name}>
                      <div className="scout-name">{s.name}</div>
                      <div className="pest-bar-bg">
                        <div
                          className="pest-bar-fill"
                          style={{
                            width: `${trapWeekData.totalTraps > 0 ? (s.count / trapWeekData.totalTraps) * 100 : 0}%`,
                            background: 'linear-gradient(90deg, #b36a00, #f0a500)',
                          }}
                        />
                      </div>
                      <div className="scout-count">{s.count} traps</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <PestAlertSummary farmIds={effectiveFarmIds} onPestSelect={handlePestSelect} />

            <div ref={pressureMapRef} id="pressure-map">
              <OrchardPressureMap key={selectedPestId ?? 'default'} initialPestId={selectedPestId} />
            </div>

            <TreeScoutingAlertSummary farmIds={effectiveFarmIds} />

            <PestTrendChart />
          </main>
        </div>
      )}
    </div>
  )
}

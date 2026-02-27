'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-auth'
import PestTrendChart from '@/app/components/PestTrendChart'
import { useRouter } from 'next/navigation'


interface Orchard {
  id: string
  name: string
  variety: string
  ha: number
  is_active: boolean
}

interface PestSummary {
  pest_name: string
  total: number
}

interface RecentSession {
  id: string
  inspected_at: string
  orchard_id: string
  orchard_name?: string
}

interface Stats {
  orchards: number
  sessions: number
  observations: number
  pests: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [pestSummary, setPestSummary] = useState<PestSummary[]>([])
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [stats, setStats] = useState<Stats>({ orchards: 0, sessions: 0, observations: 0, pests: 0 })
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: orgUser } = await supabase
          .from('organisation_users')
          .select('role')
          .eq('user_id', user.id)
          .single()
        if (orgUser?.role === 'super_admin') setIsSuperAdmin(true)
      }
      // Orchards
      const { data: orchardData } = await supabase
        .from('orchards')
        .select('id, name, variety, ha, is_active')
        .eq('is_active', true)
        .order('name')

      // Recent inspection sessions
      const { data: sessionData } = await supabase
        .from('inspection_sessions')
        .select('id, inspected_at, orchard_id')
        .order('inspected_at', { ascending: false })
        .limit(8)

      // Top pests by observation count
      const { data: obsData } = await supabase
        .from('inspection_observations')
        .select('pest_id, count, pests(name)')
        .gt('count', 0)
        .limit(1000)

      // Aggregate pest counts
      const pestTotals: Record<string, { name: string; total: number }> = {}
      obsData?.forEach((o: any) => {
        const name = o.pests?.name || 'Unknown'
        if (!pestTotals[o.pest_id]) pestTotals[o.pest_id] = { name, total: 0 }
        pestTotals[o.pest_id].total += o.count || 0
      })
      const sorted = Object.values(pestTotals)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map(p => ({ pest_name: p.name, total: p.total }))

      // Enrich sessions with orchard names
      const orchardLookup: Record<string, string> = {}
      orchardData?.forEach(o => { orchardLookup[o.id] = o.name })
      const enrichedSessions = sessionData?.map(s => ({
        ...s,
        orchard_name: orchardLookup[s.orchard_id] || 'Unknown'
      })) || []

      // Stats counts
      const { count: sessionCount } = await supabase
        .from('inspection_sessions')
        .select('*', { count: 'exact', head: true })
      const { count: obsCount } = await supabase
        .from('inspection_observations')
        .select('*', { count: 'exact', head: true })
      const { count: pestCount } = await supabase
        .from('pests')
        .select('*', { count: 'exact', head: true })

      setOrchards(orchardData || [])
      setPestSummary(sorted)
      setRecentSessions(enrichedSessions)
      setStats({
        orchards: orchardData?.length || 0,
        sessions: sessionCount || 0,
        observations: obsCount || 0,
        pests: pestCount || 0,
      })
      setLoading(false)
    }

    fetchData()
  }, [])

  const maxPest = pestSummary[0]?.total || 1

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #f4f1eb;
          color: #1a1a1a;
          min-height: 100vh;
        }

        .app { display: flex; min-height: 100vh; }

        /* Sidebar */
        .sidebar {
          width: 220px;
          min-height: 100vh;
          background: #1c3a2a;
          padding: 32px 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }
        .logo {
          font-family: 'DM Serif Display', serif;
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
          margin-bottom: 36px;
        }
        .page-title {
          font-family: 'DM Serif Display', serif;
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

        /* Stats grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 32px;
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
        .stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #9aaa9f;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .stat-value {
          font-family: 'DM Serif Display', serif;
          font-size: 38px;
          color: #1c3a2a;
          line-height: 1;
        }
        .stat-sub {
          font-size: 12px;
          color: #b0bdb5;
          margin-top: 6px;
        }

        /* Two column layout */
        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
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
          font-family: 'DM Serif Display', serif;
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
          margin-bottom: 14px;
        }
        .pest-name {
          font-size: 13px;
          color: #3a4a40;
          width: 160px;
          flex-shrink: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pest-bar-bg {
          flex: 1;
          height: 8px;
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
          width: 50px;
          text-align: right;
          flex-shrink: 0;
        }

        /* Table */
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #9aaa9f;
          font-weight: 600;
          padding: 0 0 12px 0;
          border-bottom: 1px solid #f0ede6;
        }
        .data-table td {
          padding: 12px 0;
          font-size: 13.5px;
          color: #3a4a40;
          border-bottom: 1px solid #f9f7f3;
          vertical-align: middle;
        }
        .data-table tr:last-child td { border-bottom: none; }
        .orchard-name { font-weight: 500; color: #1c3a2a; }
        .variety-tag {
          display: inline-block;
          background: #f0f7f2;
          color: #3a7a52;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }
        .ha-val { color: #9aaa9f; font-size: 13px; }

        /* Activity */
        .activity-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 0;
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
          font-family: 'DM Serif Display', serif;
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
<a href="/orchards" className="nav-item"><span className="nav-icon">🌳</span> Orchards</a>
<a className="nav-item"><span className="nav-icon">🐛</span> Pests</a>
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
    fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
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

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Active Orchards</div>
                <div className="stat-value">{stats.orchards}</div>
                <div className="stat-sub">across all farms</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Inspections</div>
                <div className="stat-value">{stats.sessions.toLocaleString()}</div>
                <div className="stat-sub">total recorded</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Observations</div>
                <div className="stat-value">{(stats.observations / 1000).toFixed(0)}k</div>
                <div className="stat-sub">pest data points</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pest Types</div>
                <div className="stat-value">{stats.pests}</div>
                <div className="stat-sub">being monitored</div>
              </div>
            </div>

            {/* Two columns */}
            <div className="two-col">
              {/* Top pests */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Top Pest Pressure</div>
                  <div className="card-badge">All Time</div>
                </div>
                <div className="card-body">
                  {pestSummary.map(p => (
                    <div className="pest-row" key={p.pest_name}>
                      <div className="pest-name">{p.pest_name}</div>
                      <div className="pest-bar-bg">
                        <div
                          className="pest-bar-fill"
                          style={{ width: `${(p.total / maxPest) * 100}%` }}
                        />
                      </div>
                      <div className="pest-count">{p.total.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Recent Inspections</div>
                  <div className="card-badge">Latest 8</div>
                </div>
                <div className="card-body">
                  {recentSessions.map(s => (
                    <div className="activity-item" key={s.id}>
                      <div className="activity-dot" />
                      <div className="activity-orchard">{s.orchard_name}</div>
                      <div className="activity-date">{formatDate(s.inspected_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <PestTrendChart />
            {/* Orchard table */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Active Orchards</div>
                <div className="card-badge">{stats.orchards} total</div>
              </div>
              <div className="card-body">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Orchard</th>
                      <th>Variety</th>
                      <th>Hectares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orchards.map(o => (
                      <tr key={o.id}>
                        <td><span className="orchard-name">{o.name}</span></td>
                        <td>{o.variety ? <span className="variety-tag">{o.variety}</span> : '—'}</td>
                        <td><span className="ha-val">{o.ha ? `${o.ha} ha` : '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      )}
    </>
  )
}

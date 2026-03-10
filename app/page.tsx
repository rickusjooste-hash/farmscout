'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import PestTrendChart from '@/app/components/PestTrendChart'
import OrchardPressureMap from '@/app/components/OrchardPressureMap'
import PestAlertSummary from '@/app/components/PestAlertSummary'
import TreeScoutingAlertSummary from '@/app/components/TreeScoutingAlertSummary'
import RebaitSummaryPanel from '@/app/components/RebaitSummaryPanel'
import { useRouter } from 'next/navigation'
import { Inter } from 'next/font/google'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import { useOrgModules } from '@/lib/useOrgModules'

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] })


interface Orchard {
  id: string
  name: string
  variety: string
  ha: number
  is_active: boolean
  section_id: string | null
}


export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [weekSessions, setWeekSessions] = useState<string[]>([])
  const [weekExpanded, setWeekExpanded] = useState(false)
  const [weekScoutMap, setWeekScoutMap] = useState<Record<string, { name: string; orchardIds: string[]; assignedOrchardIds: string[] }>>({})
  const [expandedWeekScout, setExpandedWeekScout] = useState<string | null>(null)
  const [trapWeekExpanded, setTrapWeekExpanded] = useState(false)
  const [trapWeekData, setTrapWeekData] = useState<{
    totalTraps: number
    inspectedTraps: number
    perScout: Array<{ name: string; count: number; routeLength: number }>
  }>({ totalTraps: 0, inspectedTraps: 0, perScout: [] })
  const { farmIds, isSuperAdmin, contextLoaded, orgId } = useUserContext()
  const modules = useOrgModules()
  const [loading, setLoading] = useState(true)
  const [selectedPestId, setSelectedPestId] = useState<string | undefined>()
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [farms, setFarms] = useState<{ id: string; full_name: string }[]>([])
  const [trapAlertCount, setTrapAlertCount] = useState(0)
  const [treeAlertCount, setTreeAlertCount] = useState(0)
  const pressureMapRef = useRef<HTMLDivElement>(null)
  const alertsSectionRef = useRef<HTMLDivElement>(null)
  const treeSectionRef = useRef<HTMLDivElement>(null)

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
          .select('id, name, variety, ha, is_active, section_id')
          .eq('is_active', true)
          .order('name')
        let trapIdsQuery = supabase.from('traps').select('id').eq('is_active', true)
        let farmIdsQuery = supabase.from('farms').select('id, full_name').eq('is_active', true)
        if (!isSuperAdminUser && farmIds.length > 0) {
          orchardQuery = orchardQuery.in('farm_id', farmIds)
          trapIdsQuery = trapIdsQuery.in('farm_id', farmIds)
          farmIdsQuery = farmIdsQuery.in('id', farmIds)
        }
        const [{ data: orchardData }, { data: activeTrapData }, { data: farmData }] = await Promise.all([orchardQuery, trapIdsQuery, farmIdsQuery])
        const farmList = (farmData || []) as { id: string; full_name: string }[]
        const resolvedFarmIds = farmList.map(f => f.id)
        setEffectiveFarmIds(resolvedFarmIds)
        setFarms(farmList)


        const activeTrapIds = (activeTrapData || []).map((t: any) => t.id)

        const orchardIds = (orchardData || []).map(o => o.id)

        // ISO Monday of current week
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
        weekStart.setHours(0, 0, 0, 0)

        // Build scout query scoped to all accessible farms
        let scoutQuery = supabase.from('scouts').select('user_id, full_name, first_trap_id, section_id').eq('is_active', true)
        if (!isSuperAdminUser && farmIds.length > 0) {
          scoutQuery = scoutQuery.in('farm_id', farmIds)
        }

        // Run all remaining queries in parallel
        const [
          { data: weekData },
          { data: trapInspData },
          { data: scoutData },
          { data: trapAlertData },
          { data: treeAlertData },
        ] = await Promise.all([
          orchardIds.length > 0
            ? supabase.from('inspection_sessions')
                .select('orchard_id, scout_id')
                .gte('inspected_at', weekStart.toISOString())
                .in('orchard_id', orchardIds)
            : Promise.resolve({ data: [], error: null, count: null, status: 200, statusText: 'OK' }),
          // Trap inspections this week — filter by orchard_id (avoids huge trap ID list in URL)
          orchardIds.length > 0
            ? supabase.from('trap_inspections')
                .select('trap_id, scout_id')
                .gte('inspected_at', weekStart.toISOString())
                .in('orchard_id', orchardIds)
            : Promise.resolve({ data: [], error: null, count: null, status: 200, statusText: 'OK' }),
          scoutQuery,
          resolvedFarmIds.length > 0
            ? supabase.rpc('get_farm_pest_pressure_summary', { p_farm_ids: resolvedFarmIds })
            : Promise.resolve({ data: [], error: null }),
          resolvedFarmIds.length > 0
            ? supabase.rpc('get_tree_pest_pressure_summary', { p_farm_ids: resolvedFarmIds })
            : Promise.resolve({ data: [], error: null }),
        ])

        // Build scout lookup: user_id → { name, first_trap_id, sectionId }
        const scoutLookup: Record<string, { name: string; firstTrapId: string | null; sectionId: string | null }> = {}
        ;(scoutData || []).forEach((s: any) => { scoutLookup[s.user_id] = { name: s.full_name, firstTrapId: s.first_trap_id, sectionId: s.section_id } })

        // Fetch route lengths for each scout that has a route
        const scoutRouteLengths: Record<string, number> = {}
        const routeLengthPromises = (scoutData || [])
          .filter((s: any) => s.first_trap_id)
          .map(async (s: any) => {
            try {
              const { data } = await supabase.rpc('get_route_length', { first_trap_id: s.first_trap_id })
              scoutRouteLengths[s.user_id] = typeof data === 'number' ? data : 0
            } catch { scoutRouteLengths[s.user_id] = 0 }
          })
        await Promise.all(routeLengthPromises)

        // Seed all active scouts with routes (so scouts with 0 inspections still appear)
        const scoutInspMap: Record<string, { name: string; traps: Set<string> }> = {}
        ;(scoutData || []).forEach((s: any) => {
          if (s.first_trap_id) {
            scoutInspMap[s.user_id] = { name: s.full_name, traps: new Set() }
          }
        })
        // Aggregate trap inspections per scout this week
        ;(trapInspData || []).forEach((r: any) => {
          const sid = r.scout_id || 'unknown'
          const name = scoutLookup[sid]?.name || 'Unknown'
          if (!scoutInspMap[sid]) scoutInspMap[sid] = { name, traps: new Set() }
          scoutInspMap[sid].traps.add(r.trap_id)
        })
        const inspectedThisWeek = new Set((trapInspData || []).map((r: any) => r.trap_id)).size
        const perScout = Object.entries(scoutInspMap)
          .map(([sid, s]) => ({
            name: s.name, count: s.traps.size, routeLength: scoutRouteLengths[sid] || 0,
          }))
          .sort((a, b) => b.count - a.count)

        setTrapWeekData({ totalTraps: activeTrapIds.length, inspectedTraps: inspectedThisWeek, perScout })
        setOrchards(orchardData || [])
        setWeekSessions([...new Set((weekData || []).map((r: any) => r.orchard_id))])

        // Build section → orchards map for scout assignment
        const sectionOrchards: Record<string, string[]> = {}
        ;(orchardData || []).forEach((o: any) => {
          if (o.section_id) {
            if (!sectionOrchards[o.section_id]) sectionOrchards[o.section_id] = []
            sectionOrchards[o.section_id].push(o.id)
          }
        })

        // Build per-scout tree scouting map
        const scoutOrchardSets: Record<string, Set<string>> = {}
        ;(weekData || []).forEach((r: any) => {
          const sid = r.scout_id || 'unknown'
          if (!scoutOrchardSets[sid]) scoutOrchardSets[sid] = new Set()
          scoutOrchardSets[sid].add(r.orchard_id)
        })
        const scoutMapResult: Record<string, { name: string; orchardIds: string[]; assignedOrchardIds: string[] }> = {}
        Object.entries(scoutOrchardSets).forEach(([sid, orchardSet]) => {
          const sectionId = scoutLookup[sid]?.sectionId
          const assigned = sectionId && sectionOrchards[sectionId] ? sectionOrchards[sectionId] : []
          scoutMapResult[sid] = { name: scoutLookup[sid]?.name || 'Unknown', orchardIds: [...orchardSet], assignedOrchardIds: assigned }
        })
        setWeekScoutMap(scoutMapResult)
        setTrapAlertCount((trapAlertData || []).filter((r: any) => Number(r.red_orchards) > 0).length)
        setTreeAlertCount((treeAlertData || []).filter((r: any) => Number(r.red_orchards) > 0).length)
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

        /* Mobile responsive */
        @media (max-width: 768px) {
          .app { flex-direction: column; }
          .main { padding: 16px 14px 80px; }
          .page-header { flex-direction: column; align-items: flex-start; gap: 8px; margin-bottom: 16px; }
          .page-title { font-size: 22px; }
          .live-badge { display: none; }
          .week-card { padding: 16px; margin-bottom: 16px; }
          .week-card-header { flex-direction: column; gap: 4px; margin-bottom: 10px; }
          .week-card-title { font-size: 16px; }
          .week-progress-row { gap: 10px; }
          .week-progress-label { font-size: 12px; }
          .scout-name { width: 100px; font-size: 12px; }
          .scout-count { font-size: 12px; width: 50px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
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

        /* ===== Dashboard mobile responsive (dash- prefix) ===== */

        /* Mobile-only elements */
        .dash-mobile-only { display: none; }
        .dash-desktop-only { display: flex; }

        /* General mobile — tablets + phones */
        @media (max-width: 768px) {
          body { background: #fff !important; }
          .dash-main {
            padding: 0 0 80px 0 !important;
            background: #fff !important;
          }
          .dash-desktop-only { display: none !important; }
          .dash-mobile-only { display: block !important; }
          .dash-mobile-reorder {
            display: flex;
            flex-direction: column;
            padding: 0 14px;
          }
          .dash-section-kpi    { order: 0; }
          .dash-section-alerts { order: 1; }
          .dash-section-weeks  { order: 2; display: none; }
          .dash-section-map    { order: 3; }
          .dash-section-tree   { order: 4; }
          .dash-section-trend  { order: 5; display: none; }
          .dash-section-rebait { order: 6; display: none; }

          .dash-expand-btn {
            min-height: 44px !important;
            min-width: 44px !important;
            justify-content: center !important;
          }
        }

        /* Phone-specific (390px-class screens) */
        @media (max-width: 480px) {
          .page-title {
            font-size: 22px !important;
          }
          .page-subtitle {
            font-size: 13px !important;
          }
        }
      `}</style>

      {loading ? (
        <div className="loading">Loading FarmScout...</div>
      ) : (
        <div className="app">
          <ManagerSidebarStyles />
          <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} onLogout={handleLogout} />

          {/* Main */}
          <main className="main dash-main">
            {/* Desktop header */}
            <div className="page-header dash-page-header dash-desktop-only">
              <div>
                <div className="page-title">Farm Overview</div>
                <div className="page-subtitle">All farms &middot; Season 2024/25</div>
              </div>
              <div className="live-badge">
                <div className="live-dot" />
                Live
              </div>
            </div>

            {/* Mobile top bar */}
            <div className="dash-mobile-only" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
              background: '#fff', borderBottom: '1px solid #e8e4dc',
            }}>
              <button
                onClick={() => window.location.reload()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#3a4a40', lineHeight: 0 }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
              <img src="/allfarm-logo.svg" alt="allFarm" style={{ height: 36, width: 36, borderRadius: 10 }} />
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#3a4a40', lineHeight: 0, position: 'relative' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {(trapAlertCount + treeAlertCount) > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#e85a4a',
                  }} />
                )}
              </button>
            </div>

            <div className="dash-mobile-reorder">

            {/* Mobile KPI cards + progress bars */}
            <div className="dash-section-kpi dash-mobile-only">
              {/* KPI cards */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, marginTop: 4 }}>
                <div
                  onClick={() => alertsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{
                    flex: 1, background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc',
                    padding: '18px 16px', cursor: 'pointer',
                    borderLeft: `4px solid ${trapAlertCount > 0 ? '#e85a4a' : '#4caf72'}`,
                  }}
                >
                  <div style={{ fontSize: 36, fontWeight: 700, color: trapAlertCount > 0 ? '#e85a4a' : '#1c3a2a', lineHeight: 1 }}>
                    {trapAlertCount}
                  </div>
                  <div style={{ height: 2, background: '#f0ede6', margin: '8px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7a8a80', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Trap Alerts
                  </div>
                </div>
                <div
                  onClick={() => treeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{
                    flex: 1, background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc',
                    padding: '18px 16px', cursor: 'pointer',
                    borderLeft: `4px solid ${treeAlertCount > 0 ? '#e85a4a' : '#4caf72'}`,
                  }}
                >
                  <div style={{ fontSize: 36, fontWeight: 700, color: treeAlertCount > 0 ? '#e85a4a' : '#1c3a2a', lineHeight: 1 }}>
                    {treeAlertCount}
                  </div>
                  <div style={{ height: 2, background: '#f0ede6', margin: '8px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7a8a80', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tree Alerts
                  </div>
                </div>
              </div>
              {/* Progress bars */}
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>Trap Inspections</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1c3a2a' }}>{trapPct}%</span>
                </div>
                <div style={{ height: 8, background: '#f0ede6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${trapPct}%`, background: 'linear-gradient(90deg, #b36a00, #f0a500)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: '#9aaa9f', marginTop: 4 }}>
                  {trapWeekData.inspectedTraps} of {trapWeekData.totalTraps} traps this week
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>Tree Scouting</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1c3a2a' }}>{weekPct}%</span>
                </div>
                <div style={{ height: 8, background: '#f0ede6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${weekPct}%`, background: 'linear-gradient(90deg, #2a6e45, #6abf7a)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: '#9aaa9f', marginTop: 4 }}>
                  {weekSessions.length} of {totalOrchards} orchards this week
                </div>
              </div>
            </div>

            {/* Pest Alerts */}
            <div className="dash-section-alerts" ref={alertsSectionRef}>
              <PestAlertSummary farmIds={effectiveFarmIds} onPestSelect={handlePestSelect} />
            </div>

            {/* Week Cards */}
            <div className="dash-section-weeks">
            {/* This Week's Scouting */}
            <div className="week-card">
              <div className="week-card-header">
                <div className="week-card-title">This Week&apos;s Scouting</div>
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
                  className="dash-expand-btn"
                  onClick={() => setWeekExpanded(e => !e)}
                  style={{
                    marginLeft: 12, background: 'none', border: '1px solid #e0ddd5',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                    fontSize: 13, color: '#7a8a80', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}
                  title={weekExpanded ? 'Hide orchards' : 'Show orchards'}
                >
                  <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: weekExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#x25BC;</span>
                </button>
              </div>
              {weekExpanded && (
                <div style={{ marginTop: 4 }}>
                  {Object.keys(weekScoutMap).length === 0 ? (
                    <div style={{ fontSize: 13, color: '#9aaa9f' }}>No tree scouting recorded this week.</div>
                  ) : (
                    Object.entries(weekScoutMap)
                      .sort((a, b) => b[1].orchardIds.length - a[1].orchardIds.length)
                      .map(([scoutId, { name, orchardIds, assignedOrchardIds }]) => {
                        const scoutTotal = assignedOrchardIds.length > 0 ? assignedOrchardIds.length : totalOrchards
                        const pct = scoutTotal > 0 ? Math.round((orchardIds.length / scoutTotal) * 100) : 0
                        const isScoutExpanded = expandedWeekScout === scoutId
                        // Show assigned orchards if available, otherwise all orchards
                        const displayOrchards = assignedOrchardIds.length > 0
                          ? orchards.filter(o => assignedOrchardIds.includes(o.id))
                          : orchards
                        return (
                          <div key={scoutId}>
                            <div
                              className="scout-row"
                              onClick={() => setExpandedWeekScout(prev => prev === scoutId ? null : scoutId)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="scout-name">{name}</div>
                              <div className="pest-bar-bg">
                                <div className="pest-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <div className="scout-count">{pct}%</div>
                              <span style={{
                                fontSize: 11, color: '#7a8a80', transition: 'transform 0.2s',
                                display: 'inline-block', transform: isScoutExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}>&#x25BC;</span>
                            </div>
                            {isScoutExpanded && (
                              <div className="orchard-pills" style={{ paddingLeft: 12, marginBottom: 8 }}>
                                {displayOrchards.map(o => {
                                  const done = orchardIds.includes(o.id)
                                  return (
                                    <div key={o.id} className={`orchard-pill ${done ? 'done' : 'pending'}`}>
                                      {done ? '\u2713 ' : ''}{o.name}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })
                  )}
                </div>
              )}
            </div>

            {/* This Week's Trap Inspections */}
            <div className="week-card trap-card">
              <div className="week-card-header">
                <div className="week-card-title">This Week&apos;s Trap Inspections</div>
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
                  className="dash-expand-btn"
                  onClick={() => setTrapWeekExpanded(e => !e)}
                  style={{
                    marginLeft: 12, background: 'none', border: '1px solid #e0ddd5',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                    fontSize: 13, color: '#7a8a80', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}
                  title={trapWeekExpanded ? 'Hide scouts' : 'Show per scout'}
                >
                  <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: trapWeekExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#x25BC;</span>
                </button>
              </div>
              {trapWeekExpanded && (
                <div style={{ marginTop: 4 }}>
                  {trapWeekData.perScout.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#9aaa9f' }}>No trap inspections recorded this week.</div>
                  ) : trapWeekData.perScout.map(s => {
                    const pct = s.routeLength > 0 ? (s.count / s.routeLength) * 100 : 0
                    return (
                    <div className="scout-row" key={s.name}>
                      <div className="scout-name">{s.name}</div>
                      <div className="pest-bar-bg">
                        <div
                          className="pest-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 100 ? 'linear-gradient(90deg, #2a6e45, #4caf72)' : 'linear-gradient(90deg, #b36a00, #f0a500)',
                          }}
                        />
                      </div>
                      <div className="scout-count">{s.count}/{s.routeLength}</div>
                    </div>
                  )})}
                </div>
              )}
            </div>
            </div>{/* end dash-section-weeks */}

            {/* Orchard Pressure Map */}
            <div className="dash-section-map" ref={pressureMapRef} id="pressure-map">
              <OrchardPressureMap key={selectedPestId ?? 'default'} initialPestId={selectedPestId} />
            </div>

            {/* Tree Scouting Alerts */}
            <div className="dash-section-tree" ref={treeSectionRef}>
              <TreeScoutingAlertSummary farmIds={effectiveFarmIds} onPestSelect={() => router.push('/inspections')} />
            </div>

            {/* Pest Trend Chart */}
            <div className="dash-section-trend">
              <PestTrendChart />
            </div>

            {/* Rebait Summary Panels */}
            <div className="dash-section-rebait">
              {orgId && farms.map(farm => (
                <RebaitSummaryPanel key={farm.id} orgId={orgId} farmId={farm.id} farmName={farm.full_name} />
              ))}
            </div>

            </div>{/* end dash-mobile-reorder */}
          </main>

          <MobileNav isSuperAdmin={isSuperAdmin} modules={modules} />
        </div>
      )}
    </div>
  )
}

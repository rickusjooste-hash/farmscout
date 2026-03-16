'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import WeatherStrip from '@/app/components/WeatherStrip'
import WaterBalanceTable, { WaterBalanceRow } from '@/app/components/irrigation/WaterBalanceTable'
import IrrigationMapPanel from '@/app/components/irrigation/IrrigationMapPanel'
import WeeklyBalanceChart from '@/app/components/irrigation/WeeklyBalanceChart'
import { SeasonTotal } from '@/app/components/irrigation/AppliedVsDemandChart'

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; name: string }

interface WeatherSummary {
  today_eto: number | null
  eto_7day: number | null
  rainfall_7day: number | null
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function IrrigationPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [farms, setFarms] = useState<Farm[]>([])
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null)
  const [days, setDays] = useState(14)

  const [summary, setSummary] = useState<WaterBalanceRow[]>([])
  const [seasonTotals, setSeasonTotals] = useState<SeasonTotal[]>([])
  const [weather, setWeather] = useState<WeatherSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)

  // Load farms
  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const supabase = createClient()
      if (farmIds.length === 0 && isSuperAdmin) {
        const { data } = await supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('code')
        const f = (data || []).map(d => ({ id: d.id, code: d.code, name: d.full_name }))
        setFarms(f)
        setEffectiveFarmIds(f.map(d => d.id))
      } else {
        const { data } = await supabase.from('farms').select('id, code, full_name').in('id', farmIds).order('code')
        const f = (data || []).map(d => ({ id: d.id, code: d.code, name: d.full_name }))
        setFarms(f)
        setEffectiveFarmIds(farmIds)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin])

  const activeFarmIds = useMemo(() => {
    if (selectedFarm) return [selectedFarm]
    return effectiveFarmIds
  }, [selectedFarm, effectiveFarmIds])

  // Fetch rolling-period data (depends on days selector)
  useEffect(() => {
    if (activeFarmIds.length === 0) return
    setLoading(true)

    const params = new URLSearchParams({ farm_ids: activeFarmIds.join(','), days: String(days) })

    Promise.all([
      fetch(`/api/irrigation?${params}`).then(r => r.json()),
      fetch(`/api/weather?${params}`).then(r => r.json()),
    ])
      .then(([irrigData, weatherData]) => {
        setSummary(irrigData.summary || [])
        // Season totals come from the same API call but don't depend on days
        // Only update on first load or farm change (handled by separate effect below)
        if (seasonTotals.length === 0) setSeasonTotals(irrigData.seasonTotals || [])
        setWeather(weatherData.summary?.[0] || null)
      })
      .catch(err => console.error('Irrigation fetch error:', err))
      .finally(() => setLoading(false))
  }, [activeFarmIds, days])

  // Fetch season totals separately when farm changes (not when days changes)
  useEffect(() => {
    if (activeFarmIds.length === 0) return
    const params = new URLSearchParams({ farm_ids: activeFarmIds.join(','), days: '14' })
    fetch(`/api/irrigation?${params}`)
      .then(r => r.json())
      .then(data => setSeasonTotals(data.seasonTotals || []))
      .catch(() => {})
  }, [activeFarmIds])

  // KPIs
  const seasonTotalM3 = useMemo(() =>
    seasonTotals.reduce((sum, r) => sum + (r.season_volume_m3 ?? 0), 0),
    [seasonTotals]
  )
  const avgSeasonCubesPerHa = useMemo(() => {
    const totalHa = seasonTotals.reduce((sum, r) => sum + (r.ha ?? 0), 0)
    if (totalHa === 0) return 0
    const totalM3 = seasonTotals.reduce((sum, r) => sum + (r.season_volume_m3 ?? 0), 0)
    return totalM3 / totalHa
  }, [seasonTotals])
  const orchardsBehind = summary.filter(r => r.net_deficit_mm > 0).length
  const orchardCount = summary.length

  if (!contextLoaded) return null

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        @media (max-width: 768px) {
          .irr-main { padding: 16px !important; padding-bottom: 80px !important; }
          .irr-kpi-strip { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={s.page}>
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
        <main style={s.main} className="irr-main">
          {/* Header */}
          <div style={s.pageHeader}>
            <div>
              <h1 style={s.pageTitle}>Irrigation</h1>
              <div style={s.pageSub}>Season water usage, crop needs, and orchard status</div>
            </div>
          </div>

          {/* Controls: farm pills + days selector */}
          <div style={s.controls}>
            <div style={s.filterGroup}>
              <button
                style={selectedFarm === null ? s.pillActive : s.pill}
                onClick={() => setSelectedFarm(null)}
              >
                All Farms
              </button>
              {farms.map(f => (
                <button
                  key={f.id}
                  style={selectedFarm === f.id ? s.pillActive : s.pill}
                  onClick={() => setSelectedFarm(f.id)}
                >
                  {f.code}
                </button>
              ))}
            </div>
            <div style={s.divider} />
            <select
              style={s.select}
              value={days}
              onChange={e => setDays(parseInt(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>

          {/* KPI strip */}
          <div style={s.kpiStrip} className="irr-kpi-strip">
            <div style={s.kpiCard}>
              <div style={s.kpiAccent} />
              <div style={s.kpiLabel}>Season Total</div>
              <div style={s.kpiValue}>
                {seasonTotalM3 > 0 ? Math.round(seasonTotalM3).toLocaleString() : '—'}
                <span style={{ fontSize: 14, color: '#8a95a0', fontWeight: 400, marginLeft: 4 }}>m³</span>
              </div>
            </div>
            <div style={s.kpiCard}>
              <div style={s.kpiAccent} />
              <div style={s.kpiLabel}>Avg Season Usage</div>
              <div style={s.kpiValue}>
                {avgSeasonCubesPerHa > 0 ? Math.round(avgSeasonCubesPerHa).toLocaleString() : '—'}
                <span style={{ fontSize: 14, color: '#8a95a0', fontWeight: 400, marginLeft: 4 }}>m³/ha</span>
              </div>
            </div>
            <div style={s.kpiCard}>
              <div style={s.kpiAccent} />
              <div style={s.kpiLabel}>7-day Rainfall</div>
              <div style={{ ...s.kpiValue, color: '#3a8fd9' }}>
                {weather?.rainfall_7day != null ? `${weather.rainfall_7day.toFixed(1)}` : '0'}
                <span style={{ fontSize: 14, color: '#8a95a0', fontWeight: 400, marginLeft: 4 }}>mm</span>
              </div>
            </div>
            <div style={s.kpiCard}>
              <div style={{
                ...s.kpiAccent,
                background: orchardsBehind > 0
                  ? 'linear-gradient(90deg, #e85a4a, #f5c842)'
                  : 'linear-gradient(90deg, #4caf72, #a0c4f0)',
              }} />
              <div style={s.kpiLabel}>Orchards Behind</div>
              <div style={{ ...s.kpiValue, color: orchardsBehind > 0 ? '#e85a4a' : '#4caf72' }}>
                {orchardsBehind}
                <span style={{ fontSize: 14, color: '#8a95a0', fontWeight: 400, marginLeft: 4 }}>
                  / {orchardCount}
                </span>
              </div>
            </div>
          </div>

          {/* Weather strip */}
          <WeatherStrip farmIds={activeFarmIds} />

          {/* Map + compact table panel */}
          <IrrigationMapPanel
            seasonTotals={seasonTotals}
            summary={summary}
            loading={loading}
            selectedOrchardId={selectedOrchardId}
            onSelectOrchard={setSelectedOrchardId}
          />

          {/* Weekly given vs need chart */}
          <WeeklyBalanceChart
            farmIds={activeFarmIds}
            selectedOrchardId={selectedOrchardId}
            selectedOrchardName={
              selectedOrchardId
                ? seasonTotals.find(r => r.orchard_id === selectedOrchardId)?.orchard_name
                  ?? summary.find(r => r.orchard_id === selectedOrchardId)?.orchard_name
                  ?? null
                : null
            }
            selectedOrchardCommodity={
              selectedOrchardId
                ? summary.find(r => r.orchard_id === selectedOrchardId)?.commodity_code ?? null
                : null
            }
            selectedOrchardVarietyGroup={
              selectedOrchardId
                ? seasonTotals.find(r => r.orchard_id === selectedOrchardId)?.variety_group ?? null
                : null
            }
          />

          {/* Water balance detail — collapsible, collapsed by default */}
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc',
            overflow: 'hidden', marginBottom: 20,
          }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: detailExpanded ? '1px solid #f0ede8' : 'none',
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              }}
              onClick={() => setDetailExpanded(e => !e)}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>
                Water Balance Detail
              </div>
              <span style={{
                fontSize: 12, color: '#8a95a0', marginLeft: 4,
              }}>
                ({days}-day rolling)
              </span>
              <span style={{
                fontSize: 13, color: '#7a8a9a', transition: 'transform 0.2s',
                display: 'inline-block', transform: detailExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                marginLeft: 'auto',
              }}>
                {'\u25BC'}
              </span>
            </div>
            {detailExpanded && (
              <WaterBalanceTable data={summary} loading={loading} embedded />
            )}
          </div>
        </main>
        <MobileNav modules={modules} />
      </div>
    </>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:        { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
  main:        { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, paddingBottom: 100 },
  pageHeader:  { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  pageTitle:   { fontSize: 32, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px', lineHeight: 1 },
  pageSub:     { fontSize: 14, color: '#8a95a0', marginTop: 6 },
  controls:    { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 28 },
  filterGroup: { display: 'flex', gap: 6 },
  pill:        { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:  { padding: '6px 14px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  divider:     { width: 1, height: 24, background: '#d4cfca' },
  select:      { padding: '6px 12px', borderRadius: 8, border: '1px solid #d4cfca', background: '#fff', fontSize: 13, fontFamily: 'inherit', color: '#1a2a3a', cursor: 'pointer' },
  kpiStrip:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 },
  kpiCard:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative' as const, overflow: 'hidden' },
  kpiAccent:   { position: 'absolute' as const, top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2176d9, #a0c4f0)' },
  kpiLabel:    { fontSize: 12, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  kpiValue:    { fontSize: 32, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 },
}

'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState, useRef, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface TreePestRow {
  pest_id: string
  pest_name: string
  observation_method: string
  tw_trees_inspected: number
  tw_trees_affected: number
  tw_total_count: number
  lw_trees_inspected: number
  lw_trees_affected: number
  lw_total_count: number
  orchards_affected: number
  red_orchards: number
  yellow_orchards: number
  green_orchards: number
  worst_orchard_id: string | null
  worst_orchard_name: string | null
  worst_severity: number
}

interface OrchardSeverityRow {
  orchard_id: string
  orchard_name: string
  severity: number
  status: string
}

interface TrendWeek {
  week_label: string
  week_start: string
  trees_inspected: number
  trees_affected: number
  total_count: number
  severity: number
  status: string
}

interface Props {
  farmIds: string[]
  onPestSelect?: (pestId: string) => void
}

function calcSeverity(method: string, treesInspected: number, treesAffected: number, totalCount: number): number {
  if (treesInspected === 0) return 0
  switch (method) {
    case 'leaf_inspection':
      return (totalCount / (treesInspected * 5)) * 100
    case 'present_absent':
      return (treesAffected / treesInspected) * 100
    default:
      return totalCount / treesInspected
  }
}

function formatSeverity(value: number, method: string): string {
  if (method === 'count') return `${value.toFixed(1)}/tree`
  return `${value.toFixed(1)}%`
}

const METHOD_LABELS: Record<string, string> = {
  present_absent: 'Incidence',
  leaf_inspection: 'Severity',
  count: 'Avg',
}

function trendBadge(twSev: number, lwSev: number) {
  if (lwSev === 0 && twSev > 0) {
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#e8924a',
        background: '#fff3e0', padding: '2px 7px', borderRadius: 10,
      }}>New</span>
    )
  }
  if (lwSev === 0) return <span style={{ fontSize: 12, color: '#8a95a0' }}>&mdash;</span>
  const pct = Math.round(((twSev - lwSev) / lwSev) * 100)
  if (pct === 0) return <span style={{ fontSize: 12, color: '#8a95a0' }}>&mdash;</span>
  if (pct > 0) return <span style={{ fontSize: 12, color: '#e8924a', fontWeight: 600 }}>&uarr; {pct}%</span>
  return <span style={{ fontSize: 12, color: '#4caf72', fontWeight: 600 }}>&darr; {Math.abs(pct)}%</span>
}

function rowBorderColor(row: TreePestRow): string {
  const method = row.observation_method
  if (method !== 'count') {
    if (Number(row.red_orchards) > 0) return '#e85a4a'
    if (Number(row.yellow_orchards) > 0) return '#f5c842'
    if (Number(row.green_orchards) > 0) return '#4caf72'
    return '#aaaaaa'
  }
  const twSev = calcSeverity('count', Number(row.tw_trees_inspected), 0, Number(row.tw_total_count))
  const lwSev = calcSeverity('count', Number(row.lw_trees_inspected), 0, Number(row.lw_total_count))
  if (lwSev === 0 && twSev > 0) return '#e85a4a'
  if (twSev > lwSev) return '#f5c842'
  if (twSev < lwSev) return '#4caf72'
  return '#aaaaaa'
}

const MAP_COLORS: Record<string, string> = {
  red: '#e85a4a',
  yellow: '#f5c842',
  green: '#4caf72',
}

const MAP_LEGEND = [
  { status: 'red', color: '#e85a4a', label: 'High (>=50%)' },
  { status: 'yellow', color: '#f5c842', label: 'Moderate (>=20%)' },
  { status: 'green', color: '#4caf72', label: 'Low (<20%)' },
  { status: 'grey', color: '#aaaaaa', label: 'No data' },
]

const STATUS_DOT_COLORS: Record<string, string> = {
  red: '#e85a4a',
  yellow: '#f5c842',
  green: '#4caf72',
}

// ── Week helpers ─────────────────────────────────────────────────────
function getISOWeekStart(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = day === 0 ? 6 : day - 1
  dt.setDate(dt.getDate() - diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function getISOWeekNumber(d: Date): number {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7))
  const yearStart = new Date(dt.getFullYear(), 0, 4)
  return Math.round(((dt.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7) + 1
}

function getWeekEnd(start: Date): Date {
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return end
}

function formatWeekLabel(start: Date): string {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const weekNum = getISOWeekNumber(start)
  const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  return `W${weekNum} \u00B7 ${fmt(start)} \u2013 ${fmt(end)}`
}

function formatDateParam(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function TreeScoutingAlertSummary({ farmIds }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<TreePestRow[]>([])
  const [loading, setLoading] = useState(() => farmIds.length > 0)
  const [expanded, setExpanded] = useState(false)

  // Map state (desktop)
  const [selectedPestId, setSelectedPestId] = useState<string | null>(null)
  const [orchardPressure, setOrchardPressure] = useState<Record<string, { status: string; severity: number }>>({})
  const [mapReady, setMapReady] = useState(false)

  // Desktop detail panel state
  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)
  const selectedOrchardIdRef = useRef<string | null>(null)
  const [trendData, setTrendData] = useState<TrendWeek[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  // Mobile drill-down state
  const [isMobile, setIsMobile] = useState(false)
  const [mobileDrilldown, setMobileDrilldown] = useState<{ pestId: string; pestName: string; method: string } | null>(null)
  const [drilldownWeekStart, setDrilldownWeekStart] = useState(() => getISOWeekStart(new Date()))
  const [drilldownOrchards, setDrilldownOrchards] = useState<OrchardSeverityRow[]>([])
  const [drilldownLoading, setDrilldownLoading] = useState(false)

  const currentWeekStart = getISOWeekStart(new Date())

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const boundariesCacheRef = useRef<any[] | null>(null)
  const orchardsCacheRef = useRef<{ id: string; name: string }[]>([])
  const hasInitialBoundsRef = useRef(false)
  const selectedMethodRef = useRef('count')

  // Keep method ref in sync for use in effect closures
  const selectedRow = rows.find(r => r.pest_id === selectedPestId)
  selectedMethodRef.current = selectedRow?.observation_method || 'count'

  // ── Mobile detection ──────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    function handler(e: MediaQueryListEvent) { setIsMobile(e.matches) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Fetch summary data ──────────────────────────────────────────────
  useEffect(() => {
    if (farmIds.length === 0) return
    supabase
      .rpc('get_tree_pest_pressure_summary', { p_farm_ids: farmIds })
      .then(({ data, error }) => {
        if (error) console.error('get_tree_pest_pressure_summary error:', JSON.stringify(error))
        setRows((data as TreePestRow[]) || [])
        setLoading(false)
      })
  }, [farmIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch orchards for boundary filtering ───────────────────────────
  useEffect(() => {
    if (farmIds.length === 0) return
    supabase.from('orchards').select('id, name').eq('is_active', true).in('farm_id', farmIds)
      .then(({ data }) => { orchardsCacheRef.current = (data || []) as { id: string; name: string }[] })
  }, [farmIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-select first pest on expand (desktop only) ────────────────
  useEffect(() => {
    if (expanded && rows.length > 0 && !selectedPestId && !isMobile) {
      setSelectedPestId(rows[0].pest_id)
    }
  }, [expanded, rows.length, isMobile])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch per-orchard severity when pest selected (desktop map) ────
  useEffect(() => {
    if (!selectedPestId || farmIds.length === 0 || isMobile) return
    const weekEnd = getWeekEnd(currentWeekStart)
    supabase.rpc('get_tree_orchard_severity', {
      p_farm_ids: farmIds,
      p_pest_id: selectedPestId,
      p_week_start: formatDateParam(currentWeekStart),
      p_week_end: formatDateParam(weekEnd),
    })
      .then(({ data, error }) => {
        if (error) console.error('get_tree_orchard_severity error:', JSON.stringify(error))
        const pressureMap: Record<string, { status: string; severity: number }> = {}
        ;(data || []).forEach((r: any) => {
          pressureMap[r.orchard_id] = { status: r.status, severity: Number(r.severity) }
        })
        setOrchardPressure(pressureMap)
      })
  }, [selectedPestId, farmIds.join(','), isMobile])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch drill-down orchard data (mobile) ────────────────────────
  const fetchDrilldown = useCallback(async (pestId: string, weekStart: Date) => {
    if (farmIds.length === 0) return
    setDrilldownLoading(true)
    const weekEnd = getWeekEnd(weekStart)
    const { data, error } = await supabase.rpc('get_tree_orchard_severity', {
      p_farm_ids: farmIds,
      p_pest_id: pestId,
      p_week_start: formatDateParam(weekStart),
      p_week_end: formatDateParam(weekEnd),
    })
    if (error) console.error('get_tree_orchard_severity drill-down error:', JSON.stringify(error))
    setDrilldownOrchards((data as OrchardSeverityRow[]) || [])
    setDrilldownLoading(false)
  }, [farmIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when drill-down week changes
  useEffect(() => {
    if (!mobileDrilldown) return
    fetchDrilldown(mobileDrilldown.pestId, drilldownWeekStart)
  }, [mobileDrilldown?.pestId, drilldownWeekStart.getTime()])  // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selectedOrchardIdRef in sync
  useEffect(() => { selectedOrchardIdRef.current = selectedOrchardId }, [selectedOrchardId])

  // ── Fetch trend data when orchard + pest selected (desktop) ─────
  useEffect(() => {
    if (!selectedOrchardId || !selectedPestId || farmIds.length === 0 || isMobile) {
      setTrendData([])
      return
    }
    setTrendLoading(true)
    // Season: Aug 1 of previous year (or current year if past Aug)
    const now = new Date()
    const seasonYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
    const seasonStart = new Date(seasonYear, 7, 1) // Aug 1
    supabase.rpc('get_tree_orchard_pest_trend', {
      p_farm_ids: farmIds,
      p_orchard_id: selectedOrchardId,
      p_pest_id: selectedPestId,
      p_from: seasonStart.toISOString(),
      p_to: new Date().toISOString(),
    }).then(({ data, error }) => {
      if (error) console.error('get_tree_orchard_pest_trend error:', JSON.stringify(error))
      setTrendData((data as TrendWeek[]) || [])
      setTrendLoading(false)
    })
  }, [selectedOrchardId, selectedPestId, farmIds.join(','), isMobile])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Invalidate map size when detail panel opens/closes ──────────
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const timer = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(timer)
  }, [selectedOrchardId])

  // ── Init / destroy map on expand / collapse (desktop only) ─────────
  useEffect(() => {
    if (!expanded || isMobile) return
    const container = mapContainerRef.current
    if (!container) return

    let cancelled = false
    let map: any = null

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled) return
      leafletRef.current = L
      map = L.map(container, { zoomControl: true, attributionControl: false, scrollWheelZoom: true, maxZoom: 19 })
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 18 },
      ).addTo(map)
      mapInstanceRef.current = map
      setTimeout(() => { if (!cancelled) map.invalidateSize() }, 150)
      setMapReady(true)
    })()

    return () => {
      cancelled = true
      if (map) { try { map.remove() } catch { /* container may be gone */ } }
      mapInstanceRef.current = null
      geoLayerRef.current = null
      hasInitialBoundsRef.current = false
      setMapReady(false)
    }
  }, [expanded, isMobile])

  // ── Draw / redraw polygons ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const map = mapInstanceRef.current
    if (!L || !map) return

    if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null }

    ;(async () => {
      // Load boundaries once (cached across expand/collapse)
      if (!boundariesCacheRef.current) {
        const { data } = await supabase.rpc('get_orchard_boundaries')
        boundariesCacheRef.current = data || []
      }
      const boundaries = boundariesCacheRef.current!

      const orchards = orchardsCacheRef.current
      const orchardIdSet = new Set(orchards.map(o => o.id))
      const myBoundaries = boundaries.filter((b: any) => orchardIdSet.has(b.id))
      if (!myBoundaries.length) return

      const orchardLookup: Record<string, string> = {}
      orchards.forEach(o => { orchardLookup[o.id] = o.name })

      const method = selectedMethodRef.current
      const pressure = orchardPressure

      const selId = selectedOrchardIdRef.current

      const layer = L.geoJSON(
        {
          type: 'FeatureCollection',
          features: myBoundaries.map((o: any) => ({
            type: 'Feature',
            properties: { id: o.id, name: o.name },
            geometry: o.boundary,
          })),
        },
        {
          style: (f: any) => {
            const p = pressure[f.properties.id]
            const color = p ? (MAP_COLORS[p.status] || '#aaaaaa') : '#aaaaaa'
            const isSel = f.properties.id === selId
            return {
              fillColor: color,
              fillOpacity: isSel ? 0.95 : 0.7,
              color: isSel ? '#fff' : '#fff',
              weight: isSel ? 3 : 1.5,
            }
          },
          onEachFeature: (f: any, lyr: any) => {
            const id = f.properties.id
            const name = orchardLookup[id] || f.properties.name || ''
            const p = pressure[id]
            const tooltipText = p
              ? `${name} \u00B7 ${formatSeverity(p.severity, method)}`
              : name
            lyr.bindTooltip(tooltipText, { permanent: false, className: 'tsa-tooltip' })
            lyr.on('mouseover', () => {
              if (id !== selectedOrchardIdRef.current) lyr.setStyle({ fillOpacity: 0.9 })
            })
            lyr.on('mouseout', () => {
              if (id !== selectedOrchardIdRef.current) lyr.setStyle({ fillOpacity: 0.7 })
            })
            lyr.on('click', () => {
              setSelectedOrchardId(prev => prev === id ? null : id)
            })
          },
        },
      ).addTo(map)

      geoLayerRef.current = layer
      if (layer.getBounds().isValid() && !hasInitialBoundsRef.current) {
        map.fitBounds(layer.getBounds(), { padding: [16, 16] })
        hasInitialBoundsRef.current = true
      }
    })()
  }, [mapReady, orchardPressure, selectedOrchardId])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Week nav helpers ──────────────────────────────────────────────
  function goWeekBack() {
    const prev = new Date(drilldownWeekStart)
    prev.setDate(prev.getDate() - 7)
    setDrilldownWeekStart(prev)
  }

  function goWeekForward() {
    const next = new Date(drilldownWeekStart)
    next.setDate(next.getDate() + 7)
    if (next.getTime() <= currentWeekStart.getTime()) {
      setDrilldownWeekStart(next)
    }
  }

  const isCurrentWeek = drilldownWeekStart.getTime() >= currentWeekStart.getTime()

  // ── Handle pest click ─────────────────────────────────────────────
  function handlePestClick(row: TreePestRow) {
    if (isMobile) {
      setDrilldownWeekStart(getISOWeekStart(new Date()))
      setMobileDrilldown({ pestId: row.pest_id, pestName: row.pest_name, method: row.observation_method })
    } else {
      setSelectedPestId(row.pest_id)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes tsa-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1a2a3a', marginBottom: 12 }}>Tree Scouting This Week</div>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 48, background: '#f4f1eb', borderRadius: 8, marginBottom: 8, animation: 'tsa-pulse 1.5s ease infinite' }} />
          ))}
        </div>
      </>
    )
  }

  if (rows.length === 0) return null

  const alertCount = rows.filter(r => Number(r.red_orchards) > 0).length

  return (
    <>
      <style>{`
        .tsa-tooltip {
          background: #1a2a3a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .tsa-tooltip::before { display: none !important; }
        .tsa-worst-label { display: none; }
        .tsa-detail-panel {
          flex: 0 0 340px; border-left: 1px solid #e8e4dc; display: flex;
          flex-direction: column; background: #fff; overflow-y: auto;
        }
        .tsa-detail-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 16px 16px 12px; border-bottom: 1px solid #f0ede6;
        }
        .tsa-detail-close {
          background: none; border: none; cursor: pointer; font-size: 20px;
          color: #8a95a0; line-height: 1; padding: 0 0 0 8px; flex-shrink: 0;
        }
        .tsa-detail-close:hover { color: #1a2a3a; }
        .tsa-detail-body { padding: 16px; flex: 1; }
        .tsa-section-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.8px; color: #8a95a0; margin-bottom: 8px; margin-top: 16px;
        }
        .tsa-severity-badge {
          display: inline-block; padding: 2px 10px; border-radius: 10px;
          font-size: 12px; font-weight: 700; margin-left: 8px;
        }
        @media (max-width: 768px) {
          .tsa-body { flex-direction: column !important; height: auto !important; }
          .tsa-pest-list { max-height: none !important; border-right: none !important; border-bottom: none !important; }
          .tsa-pest-item { min-height: 44px !important; padding: 14px 16px !important; }
          .tsa-map-panel { display: none !important; }
          .tsa-detail-panel { display: none !important; }
          .tsa-worst-label { display: block !important; }
        }
      `}</style>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 20 }}>
        {/* Header — always visible */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: expanded ? '1px solid #f0ede6' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => { setExpanded(e => !e); setMobileDrilldown(null); setSelectedOrchardId(null) }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1a2a3a' }}>Tree Scouting This Week</div>
            <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 3 }}>
              {expanded
                ? (isMobile ? 'Tap a pest to see orchard detail' : 'Click a pest to see orchard severity on the map')
                : `${rows.length} pest${rows.length !== 1 ? 's' : ''} observed \u00B7 ${alertCount} with alerts`}
            </div>
          </div>
          <span style={{
            fontSize: 13, color: '#7a8a9a', transition: 'transform 0.2s',
            display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>{'\u25BC'}</span>
        </div>

        {/* Body: pest list + map (or drill-down on mobile) */}
        {expanded && (
          <div className="tsa-body" style={{ display: 'flex', height: 660 }}>
            {/* Mobile drill-down view */}
            {isMobile && mobileDrilldown ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                {/* Back button */}
                <button
                  onClick={() => setMobileDrilldown(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '12px 16px 8px', fontSize: 15, color: '#3478F6',
                    fontFamily: 'Inter, sans-serif', fontWeight: 500,
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{'\u2039'}</span> Back to pests
                </button>

                {/* Pest name + week nav */}
                <div style={{ padding: '0 16px 12px' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a', marginBottom: 10 }}>
                    {mobileDrilldown.pestName}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  }}>
                    <button
                      onClick={goWeekBack}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 22, color: '#3478F6', lineHeight: 1, padding: '4px 8px',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >{'\u2039'}</button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a' }}>
                      {formatWeekLabel(drilldownWeekStart)}
                    </span>
                    <button
                      onClick={goWeekForward}
                      disabled={isCurrentWeek}
                      style={{
                        background: 'none', border: 'none',
                        cursor: isCurrentWeek ? 'default' : 'pointer',
                        fontSize: 22, color: isCurrentWeek ? '#d0cdc6' : '#3478F6',
                        lineHeight: 1, padding: '4px 8px',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >{'\u203A'}</button>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: '#e8e4dc' }} />

                {/* Orchard list */}
                {drilldownLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#8a95a0', fontSize: 13 }}>Loading...</div>
                ) : drilldownOrchards.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#8a95a0', fontSize: 13 }}>No observations this week</div>
                ) : (
                  <>
                    {drilldownOrchards.map(o => (
                      <div
                        key={o.orchard_id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '12px 16px',
                          borderBottom: '1px solid #f9f7f3',
                        }}
                      >
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                          background: STATUS_DOT_COLORS[o.status] || '#aaaaaa',
                        }} />
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#1a2a3a' }}>
                          {o.orchard_name}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#3a4a40' }}>
                          {formatSeverity(Number(o.severity), mobileDrilldown.method)}
                        </span>
                      </div>
                    ))}
                    {/* Summary */}
                    <div style={{
                      padding: '12px 16px', fontSize: 12, color: '#8a95a0', fontWeight: 500,
                      borderTop: '1px solid #e8e4dc',
                    }}>
                      {drilldownOrchards.length} orchard{drilldownOrchards.length !== 1 ? 's' : ''} affected
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Left: pest list */}
                <div className="tsa-pest-list" style={{ flex: selectedOrchardId ? '0 0 30%' : '0 0 35%', overflowY: 'auto', borderRight: '1px solid #e8e4dc', transition: 'flex 0.2s' }}>
                  {rows.map(row => {
                    const method = row.observation_method
                    const twSev = calcSeverity(method, Number(row.tw_trees_inspected), Number(row.tw_trees_affected), Number(row.tw_total_count))
                    const lwSev = calcSeverity(method, Number(row.lw_trees_inspected), Number(row.lw_trees_affected), Number(row.lw_total_count))
                    const borderColor = rowBorderColor(row)
                    const isSelected = selectedPestId === row.pest_id

                    return (
                      <div
                        key={row.pest_id}
                        className="tsa-pest-item"
                        onClick={() => handlePestClick(row)}
                        style={{
                          borderLeft: `4px solid ${borderColor}`,
                          padding: '12px 16px',
                          borderBottom: '1px solid #f9f7f3',
                          cursor: 'pointer',
                          background: isSelected && !isMobile ? '#f0f4fa' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a' }}>{row.pest_name}</span>
                          <span style={{ fontSize: 11, color: '#8a95a0', fontWeight: 500 }}>
                            {METHOD_LABELS[method] || method}
                          </span>
                        </div>
                        {/* Worst orchard label — mobile only */}
                        {row.worst_orchard_name && (
                          <div className="tsa-worst-label" style={{ fontSize: 11, color: '#8a95a0', marginTop: 2 }}>
                            Worst: {row.worst_orchard_name}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a' }}>
                            {formatSeverity(twSev, method)}
                          </span>
                          {trendBadge(twSev, lwSev)}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Right: map (desktop only — hidden on mobile via CSS) */}
                <div className="tsa-map-panel" style={{ flex: selectedOrchardId ? '1 1 0' : '0 0 65%', position: 'relative', transition: 'flex 0.2s' }}>
                  <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
                  {/* Legend */}
                  <div style={{
                    position: 'absolute', bottom: 12, left: 12,
                    background: 'rgba(255,255,255,0.95)', borderRadius: 8,
                    border: '1px solid #e8e4dc', padding: '8px 12px', zIndex: 1000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.8px', color: '#8a95a0', marginBottom: 5,
                    }}>Severity</div>
                    {MAP_LEGEND.map(item => (
                      <div key={item.status} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 11, color: '#3a4a40', marginBottom: 3,
                      }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: 3,
                          background: item.color, flexShrink: 0,
                        }} />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detail panel (desktop only) */}
                {selectedOrchardId && !isMobile && (() => {
                  const orchardName = orchardsCacheRef.current.find(o => o.id === selectedOrchardId)?.name || 'Orchard'
                  const op = orchardPressure[selectedOrchardId]
                  const sevValue = op?.severity ?? 0
                  const sevStatus = op?.status || 'grey'
                  const method = selectedRow?.observation_method || 'count'
                  const isCountMethod = method === 'count'
                  const badgeBg = sevStatus === 'red' ? '#fde8e6' : sevStatus === 'yellow' ? '#fff8e1' : sevStatus === 'green' ? '#e8f5e9' : '#f0f0f0'
                  const badgeColor = sevStatus === 'red' ? '#e85a4a' : sevStatus === 'yellow' ? '#c59a00' : sevStatus === 'green' ? '#2e7d32' : '#888'

                  return (
                    <div className="tsa-detail-panel">
                      <div className="tsa-detail-header">
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>
                            {orchardName}
                            <span className="tsa-severity-badge" style={{ background: badgeBg, color: badgeColor }}>
                              {sevStatus === 'red' ? 'High' : sevStatus === 'yellow' ? 'Moderate' : sevStatus === 'green' ? 'Low' : 'No data'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 2 }}>
                            {formatSeverity(sevValue, method)}
                          </div>
                        </div>
                        <button className="tsa-detail-close" onClick={() => setSelectedOrchardId(null)}>&times;</button>
                      </div>

                      <div className="tsa-detail-body">
                        {/* This week summary */}
                        <div className="tsa-section-label" style={{ marginTop: 0 }}>
                          {selectedRow?.pest_name || 'Pest'} &middot; This Week
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2a3a' }}>
                          {formatSeverity(sevValue, method)}
                        </div>
                        <div style={{ fontSize: 11, color: '#8a95a0', marginTop: 2 }}>
                          {METHOD_LABELS[method] || method}
                        </div>

                        {/* Season trend chart */}
                        <div className="tsa-section-label">Season Trend</div>
                        {trendLoading ? (
                          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a95a0', fontSize: 13 }}>
                            Loading...
                          </div>
                        ) : trendData.length === 0 ? (
                          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a95a0', fontSize: 13 }}>
                            No trend data
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" />
                              <XAxis
                                dataKey="week_label"
                                tick={{ fontSize: 10, fill: '#8a95a0' }}
                                axisLine={{ stroke: '#e8e4dc' }}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: '#8a95a0' }}
                                axisLine={false}
                                tickLine={false}
                                domain={isCountMethod ? ['auto', 'auto'] : [0, (max: number) => Math.max(max, 55)]}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: '#1a2a3a', border: 'none', borderRadius: 6,
                                  fontSize: 12, color: '#fff', padding: '6px 10px',
                                }}
                                labelStyle={{ color: '#8a95a0', fontSize: 11, marginBottom: 4 }}
                                formatter={(value: number | undefined) => [formatSeverity(value ?? 0, method), METHOD_LABELS[method] || method]}
                              />
                              {!isCountMethod && (
                                <>
                                  <ReferenceLine y={50} stroke="#e85a4a" strokeDasharray="4 4" strokeWidth={1} />
                                  <ReferenceLine y={20} stroke="#f5c842" strokeDasharray="4 4" strokeWidth={1} />
                                </>
                              )}
                              <Line
                                type="monotone"
                                dataKey="severity"
                                stroke="#4caf72"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#4caf72', stroke: '#fff', strokeWidth: 1 }}
                                activeDot={{ r: 5, fill: '#4caf72', stroke: '#fff', strokeWidth: 2 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

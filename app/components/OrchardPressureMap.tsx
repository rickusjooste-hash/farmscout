'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const LINE_COLORS = [
  '#2a6e45', '#e8924a', '#6b7fa8', '#e8c44a',
  '#9b6bb5', '#c4744a', '#4a9e6b', '#e85a4a',
]

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

interface OrchardInfo {
  id: string
  name: string
  commodity_id: string
}

interface PestOption {
  id: string
  name: string
}

interface OrchardPressure {
  orchard_id: string
  total_count: number
  trap_count: number
  threshold: number | null
  status: 'green' | 'yellow' | 'red' | 'blue' | 'grey'
}

interface TrapDetailRow {
  trap_nr: number | null
  trap_seq: number | null
  count: number
  status: 'green' | 'yellow' | 'red' | 'blue' | 'grey'
}

const STATUS_COLORS = {
  green:  { fill: '#4caf72', label: 'Below threshold' },
  yellow: { fill: '#f5c842', label: 'Approaching (≥50%)' },
  red:    { fill: '#e85a4a', label: 'Above threshold' },
  blue:   { fill: '#6b7fa8', label: 'No threshold set' },
  grey:   { fill: '#aaaaaa', label: 'No data' },
}

function currentISOWeek(): { year: number; week: number } {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function isoWeekRange(year: number, week: number): { from: Date; to: Date } {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const weekStart = new Date(jan4.getTime() - (dow - 1) * 86400000 + (week - 1) * 7 * 86400000)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return { from: weekStart, to: weekEnd }
}

function weekLabel(year: number, week: number): string {
  const { from, to } = isoWeekRange(year, week)
  const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  return `W${week} · ${fmt(from)} – ${fmt(to)}`
}

function prevWeek(year: number, week: number) {
  return week === 1 ? { year: year - 1, week: 52 } : { year, week: week - 1 }
}
function nextWeek(year: number, week: number) {
  return week === 52 ? { year: year + 1, week: 1 } : { year, week: week + 1 }
}

function statusFromCount(count: number, threshold: number | null): OrchardPressure['status'] {
  if (threshold === null) return 'blue'
  if (count >= threshold) return 'red'
  if (count >= threshold * 0.5) return 'yellow'
  return 'green'
}

const dot = (status: string) => (
  <span style={{
    display: 'inline-block', width: 10, height: 10, borderRadius: 3, flexShrink: 0,
    background: STATUS_COLORS[status as keyof typeof STATUS_COLORS]?.fill || '#aaa',
  }} />
)

// Unique map ID to avoid conflicts with the dashboard's other map
const MAP_ID = 'orchard-pressure-inline-map'

export default function OrchardPressureMap() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()

  const mapRef      = useRef<any>(null)
  const leafletRef  = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)

  const [orchards, setOrchards]         = useState<OrchardInfo[]>([])
  const [pests, setPests]               = useState<PestOption[]>([])
  const [selectedPest, setSelectedPest] = useState<PestOption | null>(null)
  const [pressure, setPressure]         = useState<Record<string, OrchardPressure>>({})
  const [mapReady, setMapReady]         = useState(false)
  const [loading, setLoading]           = useState(false)

  const { year: curYear, week: curWeek } = currentISOWeek()
  const [weekYear, setWeekYear] = useState(curYear)
  const [weekNum, setWeekNum]   = useState(curWeek)

  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)
  const [trapDetail, setTrapDetail]               = useState<TrapDetailRow[]>([])
  const [loadingDetail, setLoadingDetail]         = useState(false)

  const [chartData, setChartData]   = useState<Array<Record<string, number | string>>>([])
  const [chartPests, setChartPests] = useState<string[]>([])
  const [chartLoading, setChartLoading] = useState(false)

  // ── Load orchards ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded) return
    let q = supabase.from('orchards').select('id, name, commodity_id').eq('is_active', true)
    if (!isSuperAdmin && farmIds.length > 0) q = q.in('farm_id', farmIds)
    q.then(({ data }) => setOrchards((data as any) || []))
  }, [contextLoaded])

  // ── Load season chart data ────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded) return
    async function loadChart() {
      setChartLoading(true)
      const now = new Date()
      const yr = now.getFullYear()
      const mo = now.getMonth() + 1
      const seasonStart = `${mo < 8 ? yr - 1 : yr}-08-01`

      // Single query: join trap_counts → trap_inspections for date filter
      // Avoids passing hundreds of IDs in the URL; RLS scopes to org
      const { data, error } = await supabase
        .from('trap_counts')
        .select('pest_id, count, pests(name), trap_inspections!inner(inspected_at)')
        .gte('trap_inspections.inspected_at', seasonStart)
        .gt('count', 0)
        .limit(5000)

      if (error || !data?.length) { setChartLoading(false); return }

      const weekPestMap: Record<string, Record<string, number>> = {}
      const pestNameById: Record<string, string> = {}

      data.forEach((c: any) => {
        const inspAt = c.trap_inspections?.inspected_at
        if (!inspAt) return
        const wk = getISOWeekKey(new Date(inspAt))
        const name = c.pests?.name || 'Unknown'
        pestNameById[c.pest_id] = name
        if (!weekPestMap[wk]) weekPestMap[wk] = {}
        weekPestMap[wk][name] = (weekPestMap[wk][name] || 0) + c.count
      })

      const allPestNames = [...new Set(Object.values(pestNameById))].sort()
      const sortedWeeks = Object.keys(weekPestMap).sort()
      const rows = sortedWeeks.map(wk => {
        const row: Record<string, number | string> = { week: 'W' + wk.split('-W')[1] }
        allPestNames.forEach(p => { row[p] = weekPestMap[wk][p] || 0 })
        return row
      })

      setChartPests(allPestNames)
      setChartData(rows)
      setChartLoading(false)
    }
    loadChart()
  }, [contextLoaded])

  // ── Load pests ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('trap_counts').select('pest_id, pests(id, name)').limit(1000)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<string>()
        const unique: PestOption[] = []
        data.forEach((r: any) => {
          if (r.pests && !seen.has(r.pests.id)) {
            seen.add(r.pests.id)
            unique.push({ id: r.pests.id, name: r.pests.name })
          }
        })
        unique.sort((a, b) => a.name.localeCompare(b.name))
        setPests(unique)
        if (unique.length > 0) setSelectedPest(unique[0])
      })
  }, [])

  // ── Load pressure ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPest || orchards.length === 0) return
    async function load() {
      setLoading(true)
      const { from, to } = isoWeekRange(weekYear, weekNum)
      const orchardIds = orchards.map(o => o.id)

      const { data: inspections } = await supabase
        .from('trap_inspections')
        .select('id, orchard_id, trap_id, inspected_at')
        .gte('inspected_at', from.toISOString())
        .lte('inspected_at', to.toISOString())
        .in('orchard_id', orchardIds)

      if (!inspections?.length) { setPressure({}); setLoading(false); return }

      const inspectionIds = inspections.map(i => i.id)
      const [{ data: counts }, { data: thresholds }] = await Promise.all([
        supabase.from('trap_counts').select('inspection_id, count')
          .eq('pest_id', selectedPest!.id).in('inspection_id', inspectionIds.slice(0, 500)),
        supabase.from('trap_thresholds').select('threshold, commodity_id').eq('pest_id', selectedPest!.id),
      ])

      const countByInsp: Record<string, number> = {}
      counts?.forEach((c: any) => { countByInsp[c.inspection_id] = (countByInsp[c.inspection_id] || 0) + c.count })

      const agg: Record<string, { total: number; traps: Set<string> }> = {}
      inspections.forEach(i => {
        if (!agg[i.orchard_id]) agg[i.orchard_id] = { total: 0, traps: new Set() }
        agg[i.orchard_id].total += countByInsp[i.id] || 0
        agg[i.orchard_id].traps.add(i.trap_id)
      })

      const newPressure: Record<string, OrchardPressure> = {}
      Object.entries(agg).forEach(([oid, a]) => {
        const orchard = orchards.find(o => o.id === oid)
        const threshold = thresholds?.find(t => !t.commodity_id || t.commodity_id === orchard?.commodity_id)?.threshold ?? null
        newPressure[oid] = {
          orchard_id: oid, total_count: a.total, trap_count: a.traps.size,
          threshold, status: statusFromCount(a.total, threshold),
        }
      })
      setPressure(newPressure)
      setLoading(false)
    }
    load()
  }, [selectedPest, weekYear, weekNum, orchards])

  // ── Load trap detail ──────────────────────────────────────────────────
  const loadTrapDetail = useCallback(async (orchardId: string) => {
    if (!selectedPest) return
    setLoadingDetail(true); setTrapDetail([])
    const { from, to } = isoWeekRange(weekYear, weekNum)
    const { data: inspections } = await supabase
      .from('trap_inspections').select('id, trap_id, inspected_at')
      .eq('orchard_id', orchardId)
      .gte('inspected_at', from.toISOString()).lte('inspected_at', to.toISOString())

    if (!inspections?.length) { setLoadingDetail(false); return }
    const inspectionIds = inspections.map(i => i.id)
    const trapIds = [...new Set(inspections.map(i => i.trap_id))]
    const [{ data: trapsData }, { data: countsData }] = await Promise.all([
      supabase.from('traps').select('id, trap_nr, seq').in('id', trapIds),
      supabase.from('trap_counts').select('inspection_id, count')
        .eq('pest_id', selectedPest.id).in('inspection_id', inspectionIds),
    ])
    const trapMap: Record<string, any> = {}
    trapsData?.forEach(t => { trapMap[t.id] = t })
    const countMap: Record<string, number> = {}
    countsData?.forEach((c: any) => { countMap[c.inspection_id] = (countMap[c.inspection_id] || 0) + c.count })
    const threshold = pressure[orchardId]?.threshold ?? null
    const rows: TrapDetailRow[] = inspections.map(insp => ({
      trap_nr: trapMap[insp.trap_id]?.trap_nr ?? null,
      trap_seq: trapMap[insp.trap_id]?.seq ?? null,
      count: countMap[insp.id] ?? 0,
      status: statusFromCount(countMap[insp.id] ?? 0, threshold),
    })).sort((a, b) => b.count - a.count)
    setTrapDetail(rows); setLoadingDetail(false)
  }, [selectedPest, weekYear, weekNum, pressure])

  useEffect(() => {
    if (selectedOrchardId) loadTrapDetail(selectedOrchardId)
    else setTrapDetail([])
  }, [selectedOrchardId, loadTrapDetail])

  // ── Init Leaflet ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mapReady || !mapRef.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      leafletRef.current = L
      if (!mapRef.current._leaflet_id) {
        const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false, scrollWheelZoom: true })
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map)
        mapRef.current._map = map
        setMapReady(true)
      }
    })()
  }, [])

  // ── Draw polygons ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || orchards.length === 0) return
    ;(async () => {
      const L = leafletRef.current
      const map = mapRef.current._map
      if (geoLayerRef.current) geoLayerRef.current.remove()
      const { data: boundaryData } = await supabase.rpc('get_orchard_boundaries')
      if (!boundaryData?.length) return

      const lookup: Record<string, OrchardInfo> = {}
      orchards.forEach(o => { lookup[o.id] = o })

      // RPC uses SECURITY DEFINER so returns all orgs — filter to this user's orchards only
      const myBoundaries = boundaryData.filter((o: any) => lookup[o.id])
      if (!myBoundaries.length) return

      const layer = L.geoJSON(
        { type: 'FeatureCollection', features: myBoundaries.map((o: any) => ({ type: 'Feature', properties: { id: o.id, name: o.name }, geometry: o.boundary })) },
        {
          style: (f: any) => {
            const p = pressure[f.properties.id]
            const color = p ? STATUS_COLORS[p.status].fill : STATUS_COLORS.grey.fill
            const sel = f.properties.id === selectedOrchardId
            return { fillColor: color, fillOpacity: sel ? 0.95 : 0.7, color: '#fff', weight: sel ? 3 : 1.5 }
          },
          onEachFeature: (f: any, lyr: any) => {
            const id = f.properties.id
            lyr.on('mouseover', () => { if (id !== selectedOrchardId) lyr.setStyle({ fillOpacity: 0.88 }) })
            lyr.on('mouseout',  () => { if (id !== selectedOrchardId) lyr.setStyle({ fillOpacity: 0.7 }) })
            lyr.on('click', () => setSelectedOrchardId(prev => prev === id ? null : id))
            lyr.bindTooltip(lookup[id]?.name || f.properties.name || '', { permanent: false, className: 'opm-tooltip' })
          },
        }
      ).addTo(map)
      geoLayerRef.current = layer
      if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [16, 16] })
    })()
  }, [mapReady, orchards, pressure, selectedOrchardId])

  const orchardsSorted = orchards.filter(o => pressure[o.id]).sort((a, b) => (pressure[b.id]?.total_count || 0) - (pressure[a.id]?.total_count || 0))
  const selectedOrchard = orchards.find(o => o.id === selectedOrchardId)
  const { year: ny, week: nw } = nextWeek(weekYear, weekNum)
  const canGoForward = ny < curYear || (ny === curYear && nw <= curWeek)

  const arrowBtn = (label: string, onClick: () => void, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: 26, height: 26, borderRadius: '50%', border: '1.5px solid #e0ddd6',
      background: '#fff', color: disabled ? '#ccc' : '#3a4a40', fontSize: 14,
      cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, lineHeight: 1,
    }}>{label}</button>
  )

  return (
    <>
      <style>{`
        .opm-tooltip {
          background: #1c3a2a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .opm-tooltip::before { display: none !important; }
        .opm-th {
          position: sticky; top: 0; background: #f9f7f3; text-align: left;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
          color: #9aaa9f; font-weight: 700; padding: 8px 14px;
          border-bottom: 1px solid #f0ede6;
        }
        .opm-td { padding: 9px 14px; font-size: 13px; color: #3a4a40; border-bottom: 1px solid #f9f7f3; }
        .opm-tr-click { cursor: pointer; }
        .opm-tr-click:hover .opm-td { background: #f9f7f3; }
        .opm-tr-sel .opm-td { background: #f0f7f2; }
      `}</style>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 20 }}>

        {/* Card header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a', flexShrink: 0 }}>Orchard Trap Pressure</div>

          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {arrowBtn('‹', () => { const p = prevWeek(weekYear, weekNum); setWeekYear(p.year); setWeekNum(p.week) })}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a', whiteSpace: 'nowrap', minWidth: 170, textAlign: 'center' }}>
              {weekLabel(weekYear, weekNum)}
            </span>
            {arrowBtn('›', () => { if (canGoForward) { const n = nextWeek(weekYear, weekNum); setWeekYear(n.year); setWeekNum(n.week) } }, !canGoForward)}
            {(weekYear !== curYear || weekNum !== curWeek) && (
              <button onClick={() => { setWeekYear(curYear); setWeekNum(curWeek) }} style={{
                padding: '3px 10px', borderRadius: 20, border: '1.5px solid #e0ddd6',
                background: '#fff', color: '#6a7a70', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}>This week</button>
            )}
          </div>

          {/* Pest pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, color: '#9aaa9f', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pest</span>
            {pests.map(p => (
              <button key={p.id} onClick={() => setSelectedPest(p)} style={{
                padding: '3px 10px', borderRadius: 20,
                border: `1.5px solid ${selectedPest?.id === p.id ? '#1c3a2a' : '#e0ddd6'}`,
                background: selectedPest?.id === p.id ? '#1c3a2a' : '#fff',
                color: selectedPest?.id === p.id ? '#a8d5a2' : '#6a7a70',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}>{p.name}</button>
            ))}
          </div>
        </div>

        {/* Loading bar */}
        {loading && (
          <div style={{ height: 3, background: 'linear-gradient(90deg, #2a6e45, #a8d5a2)', animation: 'shimmer 1s infinite' }} />
        )}

        {/* Body: map + table */}
        <div style={{ display: 'flex', height: 440 }}>

          {/* Map */}
          <div style={{ flex: '0 0 60%', position: 'relative' }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            {/* Legend */}
            <div style={{
              position: 'absolute', bottom: 16, left: 12, background: 'rgba(255,255,255,0.95)',
              borderRadius: 8, border: '1px solid #e8e4dc', padding: '10px 14px', zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9aaa9f', marginBottom: 7 }}>Threshold</div>
              {Object.entries(STATUS_COLORS).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#3a4a40', marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: v.fill, flexShrink: 0 }} />
                  {v.label}
                </div>
              ))}
            </div>
          </div>

          {/* Table panel */}
          <div style={{ flex: '0 0 40%', borderLeft: '1px solid #e8e4dc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {selectedOrchardId ? (
                <>
                  <button onClick={() => setSelectedOrchardId(null)} style={{ fontSize: 12, color: '#2a6e45', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}>‹ All orchards</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>{selectedOrchard?.name}</span>
                  <span style={{ fontSize: 12, color: '#9aaa9f', marginLeft: 'auto' }}>{trapDetail.length} traps</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>{selectedPest?.name || '—'}</span>
                  <span style={{ fontSize: 12, color: '#9aaa9f', marginLeft: 'auto' }}>{orchardsSorted.length} orchards</span>
                </>
              )}
            </div>

            {/* Table scroll */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {selectedOrchardId ? (
                loadingDetail ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#9aaa9f', fontSize: 13 }}>Loading…</div>
                ) : trapDetail.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#9aaa9f', fontSize: 13 }}>No trap data this week.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th className="opm-th">Trap</th>
                      <th className="opm-th">Count</th>
                      <th className="opm-th">Threshold</th>
                      <th className="opm-th">Status</th>
                    </tr></thead>
                    <tbody>
                      {trapDetail.map((row, i) => (
                        <tr key={i}>
                          <td className="opm-td">T{row.trap_nr ?? row.trap_seq ?? '—'}</td>
                          <td className="opm-td" style={{ fontWeight: 600, color: '#1c3a2a' }}>{row.count}</td>
                          <td className="opm-td" style={{ color: '#9aaa9f' }}>{pressure[selectedOrchardId!]?.threshold ?? 'Not set'}</td>
                          <td className="opm-td" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {dot(row.status)}
                            <span style={{ fontSize: 11, color: STATUS_COLORS[row.status as keyof typeof STATUS_COLORS]?.fill }}>{STATUS_COLORS[row.status as keyof typeof STATUS_COLORS]?.label}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                orchardsSorted.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#9aaa9f', fontSize: 13 }}>No trap data for this week.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th className="opm-th">Orchard</th>
                      <th className="opm-th">Count</th>
                      <th className="opm-th">Traps</th>
                      <th className="opm-th">Status</th>
                    </tr></thead>
                    <tbody>
                      {orchardsSorted.map(o => {
                        const p = pressure[o.id]
                        return (
                          <tr key={o.id} className={`opm-tr-click${selectedOrchardId === o.id ? ' opm-tr-sel' : ''}`}
                            onClick={() => setSelectedOrchardId(o.id)}>
                            <td className="opm-td" style={{ fontWeight: 500, color: '#1c3a2a' }}>{o.name}</td>
                            <td className="opm-td" style={{ fontWeight: 600, color: '#1c3a2a' }}>{p.total_count}</td>
                            <td className="opm-td" style={{ color: '#9aaa9f' }}>{p.trap_count}</td>
                            <td className="opm-td">{dot(p.status)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>

        {/* Season trend chart — full width */}
        {(chartLoading || chartData.length > 0) && (
          <div style={{ padding: '20px 24px 24px', borderTop: '1px solid #f0ede6' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9aaa9f', marginBottom: 14 }}>
              Season Trap Counts by Week{selectedPest ? ` · ${selectedPest.name}` : ''}
            </div>
            {chartLoading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aaa9f', fontSize: 13 }}>
                Loading chart…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
                    tickLine={false}
                    axisLine={{ stroke: '#f0ede6' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1c3a2a', border: 'none', borderRadius: 10,
                      padding: '10px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    }}
                    labelStyle={{ color: '#a8d5a2', fontSize: 12, fontWeight: 600, marginBottom: 6 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  {chartPests.map((name, i) => {
                    const isSelected = selectedPest?.name === name
                    const dimmed = selectedPest !== null && !isSelected
                    return (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={isSelected ? 2.5 : dimmed ? 0.8 : 2}
                        strokeOpacity={dimmed ? 0.25 : 1}
                        dot={false}
                        activeDot={dimmed ? false : { r: 4 }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </>
  )
}

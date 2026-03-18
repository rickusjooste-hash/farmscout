'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import { useEffect, useState, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface IssueOption { id: string; name: string }
interface BoundaryRow { id: string; name: string; boundary: object | null }

// ── ISO week helpers ───────────────────────────────────────────────────────

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
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
  return { from: weekStart, to: weekEnd }
}

function weekLabel(year: number, week: number): string {
  const { from, to } = isoWeekRange(year, week)
  const toDay = new Date(to.getTime() - 86400000)
  const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `W${String(week).padStart(2, '0')} \u00b7 ${fmt(from)} \u2013 ${fmt(toDay)}`
}

function prevWeek(year: number, week: number) {
  return week === 1 ? { year: year - 1, week: 52 } : { year, week: week - 1 }
}
function nextWeek(year: number, week: number) {
  return week === 52 ? { year: year + 1, week: 1 } : { year, week: week + 1 }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function QcHeatmapPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes, allowed } = usePageGuard()
  const modules = useOrgModules()

  const mapDivRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const heatLayerRef = useRef<any>(null)
  const outlineRef = useRef<any>(null)
  const boundariesRef = useRef<BoundaryRow[]>([])

  const [mapReady, setMapReady] = useState(false)
  const { year: curYear, week: curWeek } = currentISOWeek()
  const [weekYear, setWeekYear] = useState(curYear)
  const [weekNum, setWeekNum] = useState(curWeek)
  const [issues, setIssues] = useState<IssueOption[]>([])
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [rawValues, setRawValues] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])

  // ── Resolve farm IDs ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    if (isSuperAdmin) {
      supabase.from('farms').select('id').eq('is_active', true)
        .then(({ data }) => setEffectiveFarmIds((data || []).map((f: any) => f.id)))
    } else {
      setEffectiveFarmIds(farmIds)
    }
  }, [contextLoaded, isSuperAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load issue options (QC issues with data in selected week) ──────────────

  useEffect(() => {
    if (!effectiveFarmIds.length) return
    ;(async () => {
      const { from: wStart, to: wEnd } = isoWeekRange(weekYear, weekNum)

      // All QC/picking issue types
      const { data: orchData } = await supabase
        .from('orchards').select('commodity_id')
        .in('farm_id', effectiveFarmIds).eq('is_active', true).eq('status', 'active')
      const commodityIds = [...new Set((orchData || []).map((o: any) => o.commodity_id as string))]
      if (!commodityIds.length) { setIssues([]); return }
      const { data: cpData } = await supabase
        .from('commodity_pests')
        .select('pest_id, pests(id, name), display_order')
        .in('commodity_id', commodityIds)
        .in('category', ['qc_issue', 'picking_issue'])
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (!cpData) return
      const seen = new Set<string>()
      const allIssues: IssueOption[] = []
      cpData.forEach((r: any) => {
        if (r.pests && !seen.has(r.pests.id)) {
          seen.add(r.pests.id)
          allIssues.push({ id: r.pests.id, name: r.pests.name })
        }
      })

      // Filter to those with actual data in this week
      const { data: weekData } = await supabase
        .from('qc_bag_issues')
        .select('pest_id, qc_bag_sessions!inner(collected_at)')
        .gt('count', 0)
        .gte('qc_bag_sessions.collected_at', wStart.toISOString())
        .lt('qc_bag_sessions.collected_at', wEnd.toISOString())
        .limit(5000)
      const activePestIds = new Set((weekData || []).map((r: any) => r.pest_id as string))
      const filtered = allIssues.filter(p => activePestIds.has(p.id))
      setIssues(filtered)
      setSelectedIssueId(prev => filtered.find(p => p.id === prev)?.id ?? filtered[0]?.id ?? null)
    })()
  }, [effectiveFarmIds, weekYear, weekNum]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init Leaflet map ───────────────────────────────────────────────────────

  useEffect(() => {
    if (mapReady || !mapDivRef.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      if ((mapDivRef.current as any)?._leaflet_id) return
      const map = L.map(mapDivRef.current!, {
        zoomControl: true, attributionControl: false, scrollWheelZoom: true, maxZoom: 19,
      })
      map.createPane('outlinePane')
      map.getPane('outlinePane')!.style.zIndex = '500'
      map.getPane('outlinePane')!.style.pointerEvents = 'none'

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 18 }
      ).addTo(map)
      leafletMapRef.current = map
      setMapReady(true)
    })()
  }, [])

  // ── Load orchard boundaries (once) ─────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || boundariesRef.current.length > 0) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const { data, error } = await supabase.rpc('get_orchard_boundaries')
      if (error) { console.error('[qc-heatmap] boundaries:', error); return }
      if (!data?.length) return
      boundariesRef.current = data as BoundaryRow[]
      const map = leafletMapRef.current
      const features = (data as BoundaryRow[]).filter(b => b.boundary).map(b => ({
        type: 'Feature' as const,
        properties: { id: b.id, name: b.name },
        geometry: b.boundary,
      }))

      outlineRef.current = L.geoJSON({ type: 'FeatureCollection', features } as any, {
        pane: 'outlinePane',
        style: () => ({ fillOpacity: 0, color: '#ffffff', weight: 1.5, opacity: 0.5 }),
        onEachFeature: (f: any, lyr: any) => {
          lyr.bindTooltip(f.properties.name || '', {
            permanent: false, className: 'qhm-tooltip', pane: 'tooltipPane',
          })
        },
      }).addTo(map)

      if (outlineRef.current.getBounds().isValid()) {
        map.fitBounds(outlineRef.current.getBounds(), { padding: [24, 24] })
      }
    })()
  }, [mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch heat data + render ───────────────────────────────────────────────

  useEffect(() => {
    if (!selectedIssueId || !effectiveFarmIds.length || !mapReady) return
    ;(async () => {
      setLoading(true)
      const { from: wStart, to: wEnd } = isoWeekRange(weekYear, weekNum)
      const newRaw = new Map<string, number>()

      const L = (await import('leaflet')).default
      await import('leaflet.heat')
      const map = leafletMapRef.current
      if (!map) { setLoading(false); return }

      if (heatLayerRef.current) { heatLayerRef.current.remove(); heatLayerRef.current = null }

      // Fetch GPS heat points + orchard aggregates in parallel
      const [heatRes, aggRes] = await Promise.all([
        supabase.rpc('get_qc_heat_points', {
          p_farm_ids: effectiveFarmIds,
          p_pest_id: selectedIssueId,
          p_from: wStart.toISOString(),
          p_to: wEnd.toISOString(),
        }),
        supabase.rpc('get_qc_heat_orchard_agg', {
          p_farm_ids: effectiveFarmIds,
          p_pest_id: selectedIssueId,
          p_from: wStart.toISOString(),
          p_to: wEnd.toISOString(),
        }),
      ])

      // Build orchard aggregate map for tooltips
      ;(aggRes.data || []).forEach((r: any) => {
        newRaw.set(r.orchard_id, Number(r.total_count) || 0)
      })

      // Build heat points from GPS data
      let heatPoints: [number, number, number][] = []
      if (heatRes.data?.length) {
        const pts = heatRes.data as { lat: number; lng: number; count: number }[]
        const maxC = Math.max(...pts.map(p => p.count), 0.001)
        heatPoints = pts.map(p => [Number(p.lat), Number(p.lng), p.count / maxC])
      }

      // Synthetic grid fallback when no GPS points but we have orchard aggregates
      if (!heatPoints.length && newRaw.size) {
        const maxVal = Math.max(...newRaw.values(), 0.001)
        for (const b of boundariesRef.current) {
          if (!b.boundary) continue
          const raw = newRaw.get(b.id) ?? 0
          if (raw <= 0) continue
          const norm = raw / maxVal
          try {
            const bounds = L.geoJSON(b.boundary as any).getBounds()
            if (!bounds.isValid()) continue
            const latR = bounds.getNorth() - bounds.getSouth()
            const lngR = bounds.getEast() - bounds.getWest()
            const GRID = 4
            for (let i = 0; i < GRID; i++)
              for (let j = 0; j < GRID; j++)
                heatPoints.push([
                  bounds.getSouth() + ((i + 0.5) / GRID) * latR,
                  bounds.getWest() + ((j + 0.5) / GRID) * lngR,
                  norm,
                ])
          } catch {
            const c = L.geoJSON(b.boundary as any).getBounds().getCenter()
            heatPoints.push([c.lat, c.lng, norm])
          }
        }
      }

      setRawValues(newRaw)

      if (heatPoints.length) {
        heatLayerRef.current = (L as any).heatLayer(heatPoints, {
          radius: 40,
          blur: 28,
          maxZoom: 17,
          max: 1.0,
          minOpacity: 0.35,
          gradient: { 0.2: '#4caf72', 0.5: '#f5c842', 0.75: '#e8924a', 1.0: '#e85a4a' },
        }).addTo(map)
      }

      setLoading(false)
    })()
  }, [selectedIssueId, weekYear, weekNum, effectiveFarmIds, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update outline tooltips ────────────────────────────────────────────────

  useEffect(() => {
    if (!outlineRef.current) return
    outlineRef.current.eachLayer((lyr: any) => {
      const id = lyr.feature?.properties?.id
      const name = lyr.feature?.properties?.name || ''
      const raw = rawValues.get(id) ?? 0
      const valStr = raw > 0 ? `${raw} issue${raw === 1 ? '' : 's'}` : ''
      lyr.setTooltipContent(raw > 0 ? `<b>${name}</b><br/>${valStr}` : name)
    })
  }, [rawValues])

  // ── Nav ────────────────────────────────────────────────────────────────────

  const { year: ny, week: nw } = nextWeek(weekYear, weekNum)
  const canGoForward = ny < curYear || (ny === curYear && nw <= curWeek)

  const arrowBtn = (label: string, onClick: () => void, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: 28, height: 28, borderRadius: '50%',
      border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)',
      color: disabled ? 'rgba(255,255,255,0.25)' : '#fff',
      fontSize: 15, cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{label}</button>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!allowed) return null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <ManagerSidebarStyles />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        .qhm-tooltip {
          background: #1a4ba0 !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 5px 10px !important; font-family: 'Inter', sans-serif !important; line-height: 1.5 !important;
        }
        .qhm-tooltip::before { display: none !important; }
        .qhm-pill:hover { opacity: 0.85; }
        @keyframes qhm-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1a2a1a' }}>

        {/* Toolbar */}
        <div style={{
          padding: '10px 20px', background: '#1a4ba0', borderBottom: '1px solid #1a5fb8',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', flexShrink: 0 }}>QC Issue Heat Map</span>

          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {arrowBtn('\u2039', () => { const p = prevWeek(weekYear, weekNum); setWeekYear(p.year); setWeekNum(p.week) })}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', minWidth: 170, textAlign: 'center' }}>
              {weekLabel(weekYear, weekNum)}
            </span>
            {arrowBtn('\u203a', () => { if (canGoForward) { const n = nextWeek(weekYear, weekNum); setWeekYear(n.year); setWeekNum(n.week) } }, !canGoForward)}
            {(weekYear !== curYear || weekNum !== curWeek) && (
              <button onClick={() => { setWeekYear(curYear); setWeekNum(curWeek) }} style={{
                padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)', color: '#a0c4f0', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}>This week</button>
            )}
          </div>

          {/* Issue pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {loading && <span style={{ fontSize: 11, color: '#6a9fd4', marginRight: 4 }}>Loading\u2026</span>}
            {issues.map(p => (
              <button key={p.id} className="qhm-pill" onClick={() => setSelectedIssueId(p.id)} style={{
                padding: '3px 12px', borderRadius: 20,
                border: `1.5px solid ${selectedIssueId === p.id ? '#a0c4f0' : 'rgba(255,255,255,0.2)'}`,
                background: selectedIssueId === p.id ? '#a0c4f0' : 'transparent',
                color: selectedIssueId === p.id ? '#1a2a3a' : '#7a8fa0',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}>{p.name}</button>
            ))}
          </div>
        </div>

        {/* Loading bar */}
        {loading && (
          <div style={{
            height: 3, flexShrink: 0,
            background: 'linear-gradient(90deg,#2176d9,#a0c4f0,#2176d9)',
            backgroundSize: '200% 100%', animation: 'qhm-shimmer 1.4s linear infinite',
          }} />
        )}

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 24, left: 16, zIndex: 1000,
            background: 'rgba(28,58,42,0.93)', borderRadius: 10, padding: '12px 16px',
            boxShadow: '0 2px 14px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#a0c4f0', marginBottom: 8 }}>
              QC Issues
            </div>
            <div style={{
              width: 120, height: 12, borderRadius: 6, marginBottom: 4,
              background: 'linear-gradient(to right, #4caf72, #f5c842, #e8924a, #e85a4a)',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7a8fa0' }}>
              <span>Low</span><span>High</span>
            </div>
          </div>

          {/* Empty state */}
          {!loading && rawValues.size === 0 && mapReady && selectedIssueId && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              background: 'rgba(28,58,42,0.88)', borderRadius: 12, padding: '20px 32px',
              zIndex: 999, textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, color: '#a0c4f0', fontWeight: 600 }}>No data this week</div>
              <div style={{ fontSize: 12, color: '#6a9fd4', marginTop: 4 }}>
                Try a different issue or navigate to a previous week.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

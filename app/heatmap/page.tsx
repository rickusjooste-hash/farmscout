'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useRef } from 'react'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

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
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return { from: weekStart, to: weekEnd }
}

function weekLabel(year: number, week: number): string {
  const { from, to } = isoWeekRange(year, week)
  const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  return `W${String(week).padStart(2, '0')} · ${fmt(from)} – ${fmt(to)}`
}

function prevWeek(year: number, week: number) {
  return week === 1 ? { year: year - 1, week: 52 } : { year, week: week - 1 }
}
function nextWeek(year: number, week: number) {
  return week === 52 ? { year: year + 1, week: 1 } : { year, week: week + 1 }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface PestOption { id: string; name: string }
interface BoundaryRow { id: string; name: string; boundary: object | null }

// ── Page ───────────────────────────────────────────────────────────────────

export default function HeatmapPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()

  const mapDivRef     = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const heatLayerRef  = useRef<any>(null)   // leaflet.heat canvas layer
  const outlineRef    = useRef<any>(null)   // white polygon outline layer
  const boundariesRef = useRef<BoundaryRow[]>([])

  const [mapReady,        setMapReady]        = useState(false)
  const [mode,             setMode]            = useState<'trap' | 'tree'>('trap')
  const { year: curYear, week: curWeek }       = currentISOWeek()
  const [weekYear,         setWeekYear]        = useState(curYear)
  const [weekNum,          setWeekNum]         = useState(curWeek)
  const [pests,            setPests]           = useState<PestOption[]>([])
  const [selectedPestId,   setSelectedPestId]  = useState<string | null>(null)
  const [rawValues,        setRawValues]       = useState<Map<string, number>>(new Map())
  const [loading,          setLoading]         = useState(false)
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])

  // ── Resolve farm IDs ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded) return
    if (isSuperAdmin) {
      supabase.from('farms').select('id').eq('is_active', true)
        .then(({ data }) => setEffectiveFarmIds((data || []).map((f: any) => f.id)))
    } else {
      setEffectiveFarmIds(farmIds)
    }
  }, [contextLoaded, isSuperAdmin])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load pests — mode + week aware ───────────────────────────────────────
  // Only show pests that actually have data for the selected week.
  // Trap: commodity_pests list filtered by one trap_inspections week query.
  // Tree (current week): get_tree_pest_pressure_summary already week-filtered.
  // Tree (past week): parallel get_tree_orchard_intensity batch-check.
  useEffect(() => {
    if (!effectiveFarmIds.length) return
    ;(async () => {
      const { from: wStart, to: wEnd } = isoWeekRange(weekYear, weekNum)

      if (mode === 'trap') {
        // Load full commodity pest list
        const { data: orchardData } = await supabase
          .from('orchards').select('commodity_id')
          .in('farm_id', effectiveFarmIds).eq('is_active', true)
        const commodityIds = [...new Set((orchardData || []).map((o: any) => o.commodity_id as string))]
        if (!commodityIds.length) { setPests([]); return }
        const { data: cpData } = await supabase
          .from('commodity_pests')
          .select('pest_id, pests(id, name), display_order')
          .in('commodity_id', commodityIds).eq('is_active', true)
          .order('display_order', { ascending: true })
        if (!cpData) return
        const seen = new Set<string>()
        const allPests: PestOption[] = []
        cpData.forEach((r: any) => {
          if (r.pests && !seen.has(r.pests.id)) {
            seen.add(r.pests.id)
            allPests.push({ id: r.pests.id, name: r.pests.name })
          }
        })
        // Filter to pests with actual catches (count > 0) in this week.
        // Use trap_counts as base — same pattern as OrchardPressureMap (RLS-safe for managers).
        const { data: weekData } = await supabase
          .from('trap_counts')
          .select('pest_id, trap_inspections!inner(inspected_at)')
          .gt('count', 0)
          .gte('trap_inspections.inspected_at', wStart.toISOString())
          .lte('trap_inspections.inspected_at', wEnd.toISOString())
          .limit(5000)
        const activePestIds = new Set((weekData || []).map((r: any) => r.pest_id as string))
        const filtered = allPests.filter(p => activePestIds.has(p.id))
        setPests(filtered)
        setSelectedPestId(prev => filtered.find(p => p.id === prev)?.id ?? filtered[0]?.id ?? null)

      } else {
        // Tree: get full pest candidate list via SECURITY DEFINER RPC
        const { data: rpcData, error } = await supabase.rpc('get_tree_pest_pressure_summary', {
          p_farm_ids: effectiveFarmIds,
        })
        if (error) console.error('[heatmap] tree pest list:', error)
        // Current week: filter by tw_trees_affected > 0 || tw_total_count > 0
        // (pests with inspections but zero affected trees are excluded)
        const allPests: PestOption[] = ((rpcData as any[]) || [])
          .filter((r: any) => (r.tw_trees_affected > 0) || (r.tw_total_count > 0))
          .map(r => ({ id: r.pest_id as string, name: r.pest_name as string }))
          .sort((a, b) => a.name.localeCompare(b.name))

        if (!allPests.length) { setPests([]); setSelectedPestId(null); return }

        // Past week: batch-check via get_tree_orchard_intensity — keep only pests with trees_affected > 0.
        const isCurrentWeek = weekYear === curYear && weekNum === curWeek
        let filtered = allPests
        if (!isCurrentWeek) {
          const wEndExcl = new Date(wEnd.getTime() + 1)
          const checks = await Promise.all(
            allPests.map(p =>
              supabase.rpc('get_tree_orchard_intensity', {
                p_farm_ids:   effectiveFarmIds,
                p_pest_id:    p.id,
                p_week_start: wStart.toISOString(),
                p_week_end:   wEndExcl.toISOString(),
              }).then(({ data }) => ((data as any[]) || []).some((r: any) => r.trees_affected > 0))
            )
          )
          filtered = allPests.filter((_, i) => checks[i])
        }
        setPests(filtered)
        setSelectedPestId(prev => filtered.find(p => p.id === prev)?.id ?? filtered[0]?.id ?? null)
      }
    })()
  }, [effectiveFarmIds, mode, weekYear, weekNum])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init Leaflet map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mapReady || !mapDivRef.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      if ((mapDivRef.current as any)?._leaflet_id) return
      const map = L.map(mapDivRef.current!, {
        zoomControl: true, attributionControl: false, scrollWheelZoom: true, maxZoom: 19,
      })
      // Outline pane sits above the heat canvas (overlayPane z=400)
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

  // ── Load orchard boundaries → white outline layer (once) ─────────────────
  useEffect(() => {
    if (!mapReady || boundariesRef.current.length > 0) return
    ;(async () => {
      const L = (await import('leaflet')).default
      const { data, error } = await supabase.rpc('get_orchard_boundaries')
      if (error) { console.error('[heatmap] boundaries:', error); return }
      if (!data?.length) return
      boundariesRef.current = data as BoundaryRow[]
      const map = leafletMapRef.current
      const features = (data as BoundaryRow[]).filter(b => b.boundary).map(b => ({
        type: 'Feature' as const,
        properties: { id: b.id, name: b.name },
        geometry: b.boundary,
      }))

      // Outlines only — the heat layer provides the colour fill
      outlineRef.current = L.geoJSON({ type: 'FeatureCollection', features } as any, {
        pane: 'outlinePane',
        style: () => ({ fillOpacity: 0, color: '#ffffff', weight: 1.5, opacity: 0.5 }),
        onEachFeature: (f: any, lyr: any) => {
          lyr.bindTooltip(f.properties.name || '', {
            permanent: false, className: 'hm-tooltip', pane: 'tooltipPane',
          })
        },
      }).addTo(map)

      if (outlineRef.current.getBounds().isValid()) {
        map.fitBounds(outlineRef.current.getBounds(), { padding: [24, 24] })
      }
    })()
  }, [mapReady])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch data + render heat layer ───────────────────────────────────────
  // Strategy:
  //   1. Try GPS-point RPCs (get_tree_inspection_points / get_trap_intensity_points)
  //      → real positions, intra-orchard variation, hot where pest was found
  //   2. If no GPS data → fall back to 4×4 synthetic grid per orchard bbox
  //      → uniform per-orchard colour, still better than a single blob
  // rawValues (per-orchard aggregates) are always fetched for hover tooltips.
  useEffect(() => {
    if (!selectedPestId || !effectiveFarmIds.length || !mapReady) return
    ;(async () => {
      setLoading(true)
      const { from: wStart, to: wEnd } = isoWeekRange(weekYear, weekNum)
      const wEndExcl = new Date(wEnd.getTime() + 1)
      const newRaw   = new Map<string, number>()

      const L = (await import('leaflet')).default
      await import('leaflet.heat')
      const map = leafletMapRef.current
      if (!map) { setLoading(false); return }

      if (heatLayerRef.current) { heatLayerRef.current.remove(); heatLayerRef.current = null }

      let heatPoints: [number, number, number][] = []

      if (mode === 'trap') {
        // Per-orchard aggregates (for tooltips) + GPS points (for heat) in parallel
        const [trapRes, gpsRes] = await Promise.all([
          supabase
            .from('trap_counts')
            .select('count, trap_inspections!inner(orchard_id, inspected_at)')
            .eq('pest_id', selectedPestId)
            .gte('trap_inspections.inspected_at', wStart.toISOString())
            .lte('trap_inspections.inspected_at', wEnd.toISOString())
            .limit(5000),
          supabase.rpc('get_trap_intensity_points', {
            p_farm_ids:   effectiveFarmIds,
            p_pest_id:    selectedPestId,
            p_week_start: wStart.toISOString(),
            p_week_end:   wEndExcl.toISOString(),
          }),
        ])
        if (trapRes.error) console.error('[heatmap] trap_counts:', trapRes.error)
        trapRes.data?.forEach((r: any) => {
          const oid = r.trap_inspections?.orchard_id
          if (oid) newRaw.set(oid, (newRaw.get(oid) || 0) + (r.count || 0))
        })
        if (gpsRes.data?.length) {
          const pts = gpsRes.data as { lat: number; lng: number; count: number }[]
          const maxC = Math.max(...pts.map(p => p.count), 0.001)
          heatPoints = pts.map(p => [p.lat, p.lng, p.count / maxC])
        }
      } else {
        // Per-orchard aggregates (for tooltips) + GPS points (for heat) in parallel
        const [orchRes, gpsRes] = await Promise.all([
          supabase.rpc('get_tree_orchard_intensity', {
            p_farm_ids:   effectiveFarmIds,
            p_pest_id:    selectedPestId,
            p_week_start: wStart.toISOString(),
            p_week_end:   wEndExcl.toISOString(),
          }),
          supabase.rpc('get_tree_inspection_points', {
            p_farm_ids:   effectiveFarmIds,
            p_pest_id:    selectedPestId,
            p_week_start: wStart.toISOString(),
            p_week_end:   wEndExcl.toISOString(),
          }),
        ])
        if (orchRes.error) console.error('[heatmap] tree_intensity:', orchRes.error)
        orchRes.data?.forEach((r: any) => {
          if (r.trees_inspected > 0)
            newRaw.set(r.orchard_id, r.trees_affected / r.trees_inspected)
        })
        if (gpsRes.data?.length) {
          const pts = gpsRes.data as { lat: number; lng: number; count: number }[]
          const maxC = Math.max(...pts.map(p => p.count), 0.001)
          heatPoints = pts.map(p => [p.lat, p.lng, p.count / maxC])
        }
      }

      // If no GPS points: fall back to 4×4 synthetic grid across each orchard bbox
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
            const lngR = bounds.getEast()  - bounds.getWest()
            const GRID = 4
            for (let i = 0; i < GRID; i++)
              for (let j = 0; j < GRID; j++)
                heatPoints.push([
                  bounds.getSouth() + ((i + 0.5) / GRID) * latR,
                  bounds.getWest()  + ((j + 0.5) / GRID) * lngR,
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
          radius:     40,
          blur:       28,
          maxZoom:    17,
          max:        1.0,
          minOpacity: 0.35,
          gradient:   { 0.2: '#4caf72', 0.5: '#f5c842', 0.75: '#e8924a', 1.0: '#e85a4a' },
        }).addTo(map)
      }

      setLoading(false)
    })()
  }, [selectedPestId, mode, weekYear, weekNum, effectiveFarmIds, mapReady])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update outline tooltips ───────────────────────────────────────────────
  useEffect(() => {
    if (!outlineRef.current) return
    outlineRef.current.eachLayer((lyr: any) => {
      const id   = lyr.feature?.properties?.id
      const name = lyr.feature?.properties?.name || ''
      const raw  = rawValues.get(id) ?? 0
      const valStr = raw > 0
        ? (mode === 'trap' ? `${raw} catch${raw === 1 ? '' : 'es'}` : `${Math.round(raw * 100)}% trees affected`)
        : ''
      lyr.setTooltipContent(raw > 0 ? `<b>${name}</b><br/>${valStr}` : name)
    })
  }, [rawValues, mode])

  // ── Nav ───────────────────────────────────────────────────────────────────
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

  const navLinks: [string, string, string][] = [
    ['/', '📊', 'Dashboard'],
    ['/orchards', '🏡', 'Orchards'],
    ['/pests', '🐛', 'Pests'],
    ['/trap-inspections', '🪤', 'Trap Inspections'],
    ['/inspections', '🔍', 'Inspections'],
    ['/heatmap', '🌡️', 'Heat Map'],
    ['/scouts', '👷', 'Scouts'],
    ['/settings', '🔔', 'Settings'],
  ]
  const navStyle = (href: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
    background: href === '/heatmap' ? '#1a5fb8' : 'transparent',
    color: href === '/heatmap' ? '#a0c4f0' : '#7a8fa0',
    fontSize: 13.5, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', textDecoration: 'none',
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={inter.className} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }
        .hm-sb:hover { background: #1a5fb8 !important; color: #fff !important; }
        .hm-tooltip {
          background: #1a4ba0 !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 5px 10px !important; font-family: 'Inter', sans-serif !important; line-height: 1.5 !important;
        }
        .hm-tooltip::before { display: none !important; }
        .hm-mode:hover { opacity: 0.85; }
        .hm-pill:hover { opacity: 0.85; }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .hm-sidebar { display: none !important; }
          .hm-toolbar { padding: 8px 12px !important; gap: 8px !important; }
          .hm-toolbar > span { font-size: 13px !important; }
          .hm-pills-row { overflow-x: auto; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; }
        }
      `}</style>

      {/* Sidebar */}
      <aside className="hm-sidebar" style={{
        width: 220, height: '100vh', overflowY: 'auto', background: 'linear-gradient(180deg, #2176d9, #1148a8)',
        padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
      }}>
        <div style={{ fontSize: 22, color: '#a0c4f0', marginBottom: 32, letterSpacing: '-0.5px', fontWeight: 700 }}>
          <span style={{ color: '#fff' }}>Farm</span>Scout
        </div>
        {navLinks.map(([href, icon, label]) => (
          <a key={href} href={href} className="hm-sb" style={navStyle(href)}><span>{icon}</span>{label}</a>
        ))}
        <a href="/scouts/new" className="hm-sb" style={{ ...navStyle('/scouts/new'), paddingLeft: 28, fontSize: 13 }}>
          <span>➕</span> New Scout
        </a>
        <a href="/scouts/sections" className="hm-sb" style={{ ...navStyle('/scouts/sections'), paddingLeft: 28, fontSize: 13 }}>
          <span>🗂️</span> Sections
        </a>
        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #1a5fb8', fontSize: 12, color: '#5a7a8a' }}>
          Mouton&apos;s Valley Group<br />
          <span style={{ color: '#2176d9' }}>●</span> Connected
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1a2a1a' }}>

        {/* Toolbar */}
        <div className="hm-toolbar" style={{
          padding: '10px 20px', background: '#1a4ba0', borderBottom: '1px solid #1a5fb8',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', flexShrink: 0 }}>Pest Heat Map</span>

          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {arrowBtn('‹', () => { const p = prevWeek(weekYear, weekNum); setWeekYear(p.year); setWeekNum(p.week) })}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', minWidth: 170, textAlign: 'center' }}>
              {weekLabel(weekYear, weekNum)}
            </span>
            {arrowBtn('›', () => { if (canGoForward) { const n = nextWeek(weekYear, weekNum); setWeekYear(n.year); setWeekNum(n.week) } }, !canGoForward)}
            {(weekYear !== curYear || weekNum !== curWeek) && (
              <button onClick={() => { setWeekYear(curYear); setWeekNum(curWeek) }} style={{
                padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)', color: '#a0c4f0', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              }}>This week</button>
            )}
          </div>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 3, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 3, flexShrink: 0 }}>
            {(['trap', 'tree'] as const).map(m => (
              <button key={m} className="hm-mode" onClick={() => setMode(m)} style={{
                padding: '4px 16px', borderRadius: 6,
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#1a2a3a' : '#7a8fa0',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              }}>{m === 'trap' ? 'Trap' : 'Tree'}</button>
            ))}
          </div>

          {/* Pest pills */}
          <div className="hm-pills-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {loading && <span style={{ fontSize: 11, color: '#6a9fd4', marginRight: 4 }}>Loading…</span>}
            {pests.map(p => (
              <button key={p.id} className="hm-pill" onClick={() => setSelectedPestId(p.id)} style={{
                padding: '3px 12px', borderRadius: 20,
                border: `1.5px solid ${selectedPestId === p.id ? '#a0c4f0' : 'rgba(255,255,255,0.2)'}`,
                background: selectedPestId === p.id ? '#a0c4f0' : 'transparent',
                color: selectedPestId === p.id ? '#1a2a3a' : '#7a8fa0',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}>{p.name}</button>
            ))}
          </div>
        </div>

        {/* Loading bar */}
        {loading && (
          <>
            <style>{`@keyframes hm-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
            <div style={{
              height: 3, flexShrink: 0,
              background: 'linear-gradient(90deg,#2176d9,#a0c4f0,#2176d9)',
              backgroundSize: '200% 100%', animation: 'hm-shimmer 1.4s linear infinite',
            }} />
          </>
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
              {mode === 'trap' ? 'Trap Catches' : 'Trees Affected'}
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
          {!loading && rawValues.size === 0 && mapReady && selectedPestId && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              background: 'rgba(28,58,42,0.88)', borderRadius: 12, padding: '20px 32px',
              zIndex: 999, textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, color: '#a0c4f0', fontWeight: 600 }}>No data this week</div>
              <div style={{ fontSize: 12, color: '#6a9fd4', marginTop: 4 }}>
                Try a different pest or navigate to a previous week.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

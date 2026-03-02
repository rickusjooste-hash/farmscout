'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useRef, useMemo } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface TreeDot {
  tree_id: string
  session_id: string
  tree_nr: number
  lat: number
  lng: number
  has_location: boolean
  inspected_at: string
  comments: string | null
  image_url: string | null
  orchard_id: string
  orchard_name: string
  zone_name: string
  scout_id: string
  scout_name: string
  total_count: number
  pest_count: number
}

interface TreeObservation {
  pest_id: string
  pest_name: string
  scientific_name: string | null
  count: number
  severity: string | null
  observation_method: string | null
}

interface Farm {
  id: string
  full_name: string
  code: string
}

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
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000) // exclusive (Monday of next week)
  return { from: weekStart, to: weekEnd }
}

function weekLabel(year: number, week: number): string {
  const { from, to } = isoWeekRange(year, week)
  const toDay = new Date(to.getTime() - 86400000) // last day (Sunday)
  const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `W${week} · ${fmt(from)} – ${fmt(toDay)}`
}

function prevWeek(year: number, week: number) {
  return week === 1 ? { year: year - 1, week: 52 } : { year, week: week - 1 }
}
function nextWeek(year: number, week: number) {
  return week === 52 ? { year: year + 1, week: 1 } : { year, week: week + 1 }
}

// ── Dot color ──────────────────────────────────────────────────────────────

function dotColor(d: TreeDot): string {
  if (d.total_count === 0) return '#4caf72'
  if (d.total_count >= 5) return '#e85a4a'
  return '#f5c842'
}

function countBadgeColor(count: number): string {
  if (count === 0) return '#4caf72'
  if (count >= 5) return '#e85a4a'
  return '#f5c842'
}

// ── Component ──────────────────────────────────────────────────────────────

export default function InspectionsPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()

  const [farms, setFarms] = useState<Farm[]>([])
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])

  const { year: curYear, week: curWeek } = currentISOWeek()
  const [weekYear, setWeekYear] = useState(curYear)
  const [weekNum, setWeekNum] = useState(curWeek)

  const [dots, setDots] = useState<TreeDot[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(null)
  const [selectedTree, setSelectedTree] = useState<TreeDot | null>(null)
  const [observations, setObservations] = useState<TreeObservation[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const dotsLayerRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [geoLoaded, setGeoLoaded] = useState(false)

  // ── Derived values ────────────────────────────────────────────────────────

  const uniqueScouts = useMemo(() => {
    const seen = new Set<string>()
    return dots
      .filter(d => { if (seen.has(d.scout_id)) return false; seen.add(d.scout_id); return true })
      .map(d => ({ id: d.scout_id, name: d.scout_name }))
  }, [dots])

  const visibleDots = useMemo(
    () => dots.filter(d => d.has_location && (!selectedScoutId || d.scout_id === selectedScoutId)),
    [dots, selectedScoutId]
  )

  const allFilteredDots = useMemo(
    () => dots.filter(d => !selectedScoutId || d.scout_id === selectedScoutId),
    [dots, selectedScoutId]
  )

  const noGpsCount = allFilteredDots.length - visibleDots.length
  const treesWithPests = visibleDots.filter(d => d.pest_count > 0).length

  // ── Load farms ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    async function loadFarms() {
      let q = supabase.from('farms').select('id, full_name, code').eq('is_active', true).order('full_name')
      if (!isSuperAdmin && farmIds.length > 0) q = q.in('id', farmIds)
      const { data } = await q
      const farmList = (data || []) as Farm[]
      setFarms(farmList)
      setEffectiveFarmIds(farmList.map(f => f.id))
    }
    loadFarms()
  }, [contextLoaded])

  // ── Load dots ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    async function loadDots() {
      setLoading(true)
      setSelectedTree(null)
      setSelectedScoutId(null)
      const { from, to } = isoWeekRange(weekYear, weekNum)
      const { data, error } = await supabase.rpc('get_tree_inspection_dots', {
        p_farm_ids: effectiveFarmIds,
        p_week_start: from.toISOString(),
        p_week_end: to.toISOString(),
      })
      if (!error) setDots((data || []) as TreeDot[])
      setLoading(false)
    }
    loadDots()
  }, [effectiveFarmIds, weekYear, weekNum])

  // ── Load detail on tree select ────────────────────────────────────────────

  useEffect(() => {
    if (!selectedTree) { setObservations([]); return }
    async function loadDetail() {
      setLoadingDetail(true)
      const treeId = selectedTree!.tree_id
      const { data } = await supabase.rpc('get_tree_inspection_detail', { p_tree_id: treeId })
      setObservations((data || []) as TreeObservation[])
      setLoadingDetail(false)
    }
    loadDetail()
  }, [selectedTree])

  // ── Init Leaflet ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (mapReady || !mapContainerRef.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      leafletRef.current = L
      if (!(mapContainerRef.current as any)._leaflet_id) {
        const map = L.map(mapContainerRef.current!, {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: true,
        })
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19 }
        ).addTo(map)
        // Custom pane for tree dots — sits above the default overlayPane (z-index 400)
        // so dots are always clickable regardless of polygon add order
        map.createPane('dotsPane')
        ;(map.getPane('dotsPane') as HTMLElement).style.zIndex = '650'
        mapRef.current = map
        setMapReady(true)
      }
    })()
  }, [])

  // ── Draw orchard polygons (once per farm set) ─────────────────────────────

  useEffect(() => {
    if (!mapReady || effectiveFarmIds.length === 0 || geoLoaded) return
    ;(async () => {
      const L = leafletRef.current
      const map = mapRef.current
      if (geoLayerRef.current) geoLayerRef.current.remove()

      const { data: boundaryData } = await supabase.rpc('get_orchard_boundaries')
      if (!boundaryData?.length) return

      const effectiveSet = new Set(effectiveFarmIds)
      // get_orchard_boundaries returns all orgs (SECURITY DEFINER) — filter client-side
      // We need farm_id on each boundary; use orchard id cross-ref via effectiveFarmIds
      // Since the RPC doesn't return farm_id, we filter by checking orchards we know about
      const filtered = boundaryData.filter((o: any) => o.boundary)

      if (!filtered.length) return

      const layer = L.geoJSON(
        {
          type: 'FeatureCollection',
          features: filtered.map((o: any) => ({
            type: 'Feature',
            properties: { id: o.id, name: o.name },
            geometry: o.boundary,
          })),
        },
        {
          style: () => ({
            fillColor: '#888',
            fillOpacity: 0.12,
            color: '#fff',
            weight: 1.5,
            dashArray: '4 3',
          }),
          onEachFeature: (f: any, lyr: any) => {
            lyr.bindTooltip(f.properties.name || '', { permanent: false, className: 'tim-tooltip' })
            lyr.on('click', () => {
              map.fitBounds(lyr.getBounds(), { padding: [40, 40], maxZoom: 17 })
            })
          },
        }
      ).addTo(map)

      geoLayerRef.current = layer
      if (layer.getBounds().isValid()) {
        map.fitBounds(layer.getBounds(), { padding: [16, 16] })
      }
      setGeoLoaded(true)
    })()
  }, [mapReady, effectiveFarmIds, geoLoaded])

  // ── Rebuild dots layer ────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const map = mapRef.current

    if (dotsLayerRef.current) dotsLayerRef.current.remove()

    if (visibleDots.length === 0) {
      dotsLayerRef.current = null
      return
    }

    const layer = L.layerGroup()

    visibleDots.forEach(d => {
      const isSelected = selectedTree?.tree_id === d.tree_id

      // Outer ring for high-load trees
      if (d.total_count >= 5) {
        L.circleMarker([d.lat, d.lng], {
          radius: 13,
          fillOpacity: 0,
          color: '#e85a4a',
          weight: 1.5,
          opacity: 0.45,
          interactive: false,
          pane: 'dotsPane',
        }).addTo(layer)
      }

      // Main dot
      L.circleMarker([d.lat, d.lng], {
        radius: isSelected ? 10 : 7,
        fillColor: dotColor(d),
        fillOpacity: 0.92,
        color: '#fff',
        weight: isSelected ? 3 : 1.5,
        pane: 'dotsPane',
      })
        .bindTooltip(
          `Tree #${d.tree_nr} · ${d.zone_name}<br/>${d.orchard_name} · ${d.scout_name}`,
          { className: 'tim-tooltip' }
        )
        .on('click', () => setSelectedTree(prev => prev?.tree_id === d.tree_id ? null : d))
        .addTo(layer)
    })

    layer.addTo(map)
    dotsLayerRef.current = layer

    // Auto-fit on first load (no tree selected)
    if (!selectedTree && visibleDots.length > 0) {
      map.fitBounds(
        L.latLngBounds(visibleDots.map(d => [d.lat, d.lng])),
        { padding: [40, 40], maxZoom: 17 }
      )
    }
  }, [mapReady, visibleDots, selectedTree])

  // ── Nav helpers ───────────────────────────────────────────────────────────

  const { year: ny, week: nw } = nextWeek(weekYear, weekNum)
  const canGoForward = ny < curYear || (ny === curYear && nw <= curWeek)

  const arrowBtn = (label: string, onClick: () => void, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #d0cdc6',
      background: '#fff', color: disabled ? '#ccc' : '#3a4a40', fontSize: 15,
      cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
    }}>{label}</button>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f4f1ea; }
        .app { display: flex; height: 100vh; overflow: hidden; }
        .sidebar {
          width: 220px; min-width: 220px; background: #1c3a2a; display: flex;
          flex-direction: column; padding: 24px 14px; overflow-y: auto;
        }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #a8d5a2; margin-bottom: 32px; }
        .logo span { color: #fff; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 8px; color: #8aab96; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .nav-item:hover { background: #2a4f38; color: #fff; }
        .nav-item.active { background: #2a4f38; color: #a8d5a2; }
        .sidebar-footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #2a4f38; font-size: 12px; color: #4a7a5a; }
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-bar {
          background: #fff; border-bottom: 1px solid #e8e4dc;
          padding: 12px 20px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
        }
        .page-title { font-size: 17px; font-weight: 700; color: #1c3a2a; }
        .scout-pills-bar {
          background: #fff; border-bottom: 1px solid #f0ede6;
          padding: 8px 20px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 44px;
        }
        .tim-scout-pill {
          padding: 4px 12px; border-radius: 20px; border: 1.5px solid #e0ddd6;
          background: #fff; color: #6a7a70; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .tim-scout-pill.active {
          background: #1c3a2a; border-color: #1c3a2a; color: #a8d5a2;
        }
        .tim-scout-pill:hover:not(.active) { background: #f4f1ea; }
        .body-row { flex: 1; display: flex; overflow: hidden; position: relative; }
        .map-wrap { flex: 1; position: relative; }
        .tim-legend {
          position: absolute; bottom: 16px; left: 16px; z-index: 1000;
          background: rgba(255,255,255,0.90); border-radius: 8px; padding: 8px 12px;
          font-size: 11px; color: #3a4a40; line-height: 1.8;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .tim-legend-row { display: flex; align-items: center; gap: 6px; }
        .tim-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .tim-side-panel {
          width: 340px; min-width: 340px; background: #fff; border-left: 1px solid #e8e4dc;
          display: flex; flex-direction: column; overflow-y: auto;
        }
        .tim-panel-header {
          padding: 14px 16px; border-bottom: 1px solid #f0ede6;
          display: flex; align-items: flex-start; gap: 10px;
        }
        .tim-panel-close {
          margin-left: auto; background: none; border: none; font-size: 18px;
          color: #9aaa9f; cursor: pointer; padding: 0 4px; line-height: 1; flex-shrink: 0;
        }
        .tim-panel-close:hover { color: #3a4a40; }
        .tim-panel-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
        .tim-section-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.8px; color: #9aaa9f; margin-bottom: 4px;
        }
        .tim-obs-row {
          display: flex; align-items: center; gap: 10px; padding: 8px 0;
          border-bottom: 1px solid #f4f1ea;
        }
        .tim-obs-row:last-child { border-bottom: none; }
        .tim-obs-names { flex: 1; min-width: 0; }
        .tim-count-badge {
          padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 700;
          color: #fff; flex-shrink: 0;
        }
        .tim-tooltip {
          background: #1c3a2a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .tim-tooltip::before { display: none !important; }
        .tim-empty-overlay {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px; z-index: 500;
          pointer-events: none;
        }
        .tim-empty-card {
          background: rgba(255,255,255,0.92); border-radius: 12px; padding: 20px 28px;
          text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.10);
        }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item"><span>🏡</span> Orchards</a>
          <a href="/pests" className="nav-item"><span>🐛</span> Pests</a>
          <a href="/trap-inspections" className="nav-item"><span>🪤</span> Trap Inspections</a>
          <a href="/inspections" className="nav-item active"><span>🔍</span> Inspections</a>
          <a href="/scouts" className="nav-item"><span>👷</span> Scouts</a>
          <a href="/scouts/new" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>➕</span> New Scout</a>
          <a href="/scouts/sections" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>🗂️</span> Sections</a>
          <a href="/settings" className="nav-item"><span>🔔</span> Settings</a>
          <div className="sidebar-footer">
            Mouton&apos;s Valley Group<br />
            <span style={{ color: '#2a6e45' }}>●</span> Connected
          </div>
        </aside>

        {/* Main */}
        <div className="main">

          {/* Top bar */}
          <div className="top-bar">
            <div className="page-title">Tree Inspections</div>

            {/* Week navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {arrowBtn('‹', () => {
                const p = prevWeek(weekYear, weekNum)
                setWeekYear(p.year)
                setWeekNum(p.week)
              })}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a', whiteSpace: 'nowrap', minWidth: 180, textAlign: 'center' }}>
                {weekLabel(weekYear, weekNum)}
              </span>
              {arrowBtn('›', () => {
                if (canGoForward) {
                  const n = nextWeek(weekYear, weekNum)
                  setWeekYear(n.year)
                  setWeekNum(n.week)
                }
              }, !canGoForward)}
              {(weekYear !== curYear || weekNum !== curWeek) && (
                <button
                  onClick={() => { setWeekYear(curYear); setWeekNum(curWeek) }}
                  style={{
                    padding: '3px 10px', borderRadius: 20, border: '1.5px solid #e0ddd6',
                    background: '#fff', color: '#6a7a70', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  }}
                >This week</button>
              )}
            </div>

            {/* Stats */}
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#6a7a70', display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading ? (
                <span style={{ color: '#9aaa9f' }}>Loading…</span>
              ) : (
                <>
                  <span><strong style={{ color: '#1c3a2a' }}>{allFilteredDots.length}</strong> trees</span>
                  <span style={{ color: '#d0cdc6' }}>·</span>
                  <span><strong style={{ color: treesWithPests > 0 ? '#e85a4a' : '#1c3a2a' }}>{treesWithPests}</strong> with pests</span>
                  <span style={{ color: '#d0cdc6' }}>·</span>
                  <span><strong style={{ color: '#1c3a2a' }}>{uniqueScouts.length}</strong> scouts</span>
                  {noGpsCount > 0 && (
                    <>
                      <span style={{ color: '#d0cdc6' }}>·</span>
                      <span style={{ color: '#9aaa9f' }}>{noGpsCount} without GPS</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Loading bar */}
          {loading && (
            <div style={{ height: 3, background: 'linear-gradient(90deg, #2a6e45, #a8d5a2)', animation: 'shimmer 1s infinite' }} />
          )}

          {/* Scout pills bar */}
          <div className="scout-pills-bar">
            <span style={{ fontSize: 11, color: '#9aaa9f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scout</span>
            <button
              className={`tim-scout-pill${!selectedScoutId ? ' active' : ''}`}
              onClick={() => setSelectedScoutId(null)}
            >All</button>
            {uniqueScouts.map(s => (
              <button
                key={s.id}
                className={`tim-scout-pill${selectedScoutId === s.id ? ' active' : ''}`}
                onClick={() => setSelectedScoutId(prev => prev === s.id ? null : s.id)}
              >{s.name}</button>
            ))}
          </div>

          {/* Body: map + side panel */}
          <div className="body-row">

            {/* Map */}
            <div className="map-wrap">
              <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

              {/* Legend */}
              <div className="tim-legend">
                <div className="tim-legend-row">
                  <div className="tim-legend-dot" style={{ background: '#4caf72' }} />
                  <span>No pests detected</span>
                </div>
                <div className="tim-legend-row">
                  <div className="tim-legend-dot" style={{ background: '#f5c842' }} />
                  <span>Pests present</span>
                </div>
                <div className="tim-legend-row">
                  <div className="tim-legend-dot" style={{ background: '#e85a4a' }} />
                  <span>High load (5+)</span>
                </div>
              </div>

              {/* Empty state */}
              {!loading && dots.length === 0 && mapReady && (
                <div className="tim-empty-overlay">
                  <div className="tim-empty-card">
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1c3a2a', marginBottom: 6 }}>
                      No tree inspections recorded for W{weekNum}
                    </div>
                    <div style={{ fontSize: 13, color: '#9aaa9f' }}>← Go to a previous week</div>
                  </div>
                </div>
              )}
            </div>

            {/* Side panel */}
            {selectedTree && (
              <div className="tim-side-panel">
                <div className="tim-panel-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1c3a2a' }}>
                      Tree #{selectedTree.tree_nr} · {selectedTree.zone_name}
                    </div>
                    <div style={{ fontSize: 13, color: '#6a7a70', marginTop: 2 }}>
                      {selectedTree.orchard_name}
                    </div>
                  </div>
                  <button className="tim-panel-close" onClick={() => setSelectedTree(null)}>✕</button>
                </div>

                <div className="tim-panel-body">
                  {/* Scout + timestamp */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#3a4a40' }}>
                      {selectedTree.scout_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#9aaa9f' }}>
                      {new Date(selectedTree.inspected_at).toLocaleString('en-ZA', {
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Photo */}
                  {selectedTree.image_url && (
                    <img
                      src={selectedTree.image_url}
                      alt={`Tree #${selectedTree.tree_nr}`}
                      style={{
                        width: '100%', maxHeight: 180, objectFit: 'cover',
                        borderRadius: 8, display: 'block',
                      }}
                    />
                  )}

                  {/* Comments */}
                  {selectedTree.comments && (
                    <div style={{ fontSize: 13, color: '#5a6a60', fontStyle: 'italic', lineHeight: 1.5 }}>
                      &ldquo;{selectedTree.comments}&rdquo;
                    </div>
                  )}

                  {/* Observations */}
                  <div>
                    <div className="tim-section-label">Observations</div>
                    {loadingDetail ? (
                      <div style={{ fontSize: 13, color: '#9aaa9f', padding: '8px 0' }}>Loading…</div>
                    ) : observations.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#9aaa9f', padding: '8px 0' }}>No observations recorded.</div>
                    ) : (
                      observations.map((obs, i) => (
                        <div key={obs.pest_id ?? i} className="tim-obs-row">
                          <div className="tim-obs-names">
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>{obs.pest_name}</div>
                            {obs.scientific_name && (
                              <div style={{ fontSize: 11, color: '#9aaa9f', fontStyle: 'italic' }}>{obs.scientific_name}</div>
                            )}
                            {obs.observation_method && (
                              <div style={{ fontSize: 11, color: '#b0bdb5' }}>{obs.observation_method}</div>
                            )}
                          </div>
                          <div
                            className="tim-count-badge"
                            style={{ background: countBadgeColor(obs.count) }}
                          >{obs.count}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

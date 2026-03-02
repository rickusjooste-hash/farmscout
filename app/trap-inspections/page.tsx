'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useRef, useMemo } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface TrapDot {
  inspection_id: string
  trap_id: string
  trap_nr: number | null
  lat: number
  lng: number
  has_location: boolean
  inspected_at: string
  rebaited: boolean
  nfc_scanned: boolean
  orchard_id: string
  orchard_name: string
  zone_name: string
  scout_id: string
  scout_name: string
  pest_id: string
  pest_name: string
  lure_name: string | null
  total_count: number
  threshold: number | null
  status: string
}

interface TrapCoverage {
  trap_id: string
  trap_nr: number | null
  orchard_id: string
  orchard_name: string
  zone_name: string
  pest_id: string
  pest_name: string
  lure_name: string | null
  inspected: boolean
  rebaited: boolean
  total_count: number
  threshold: number | null
  status: string
  scout_name: string | null
}

interface TrapCountRow {
  pest_id: string
  pest_name: string
  count: number
}

interface Farm {
  id: string
  full_name: string
  code: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { fill: string; label: string }> = {
  green:  { fill: '#4caf72', label: 'Below threshold' },
  yellow: { fill: '#f5c842', label: 'Approaching (≥50%)' },
  red:    { fill: '#e85a4a', label: 'Above threshold' },
  blue:   { fill: '#6b7fa8', label: 'No threshold set' },
  grey:   { fill: '#aaaaaa', label: 'Not inspected' },
}

const STATUS_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3, grey: 4 }

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
  return `W${week} · ${fmt(from)} – ${fmt(toDay)}`
}

function prevWeek(year: number, week: number) {
  return week === 1 ? { year: year - 1, week: 52 } : { year, week: week - 1 }
}
function nextWeek(year: number, week: number) {
  return week === 52 ? { year: year + 1, week: 1 } : { year, week: week + 1 }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TrapInspectionsPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()

  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])

  const { year: curYear, week: curWeek } = currentISOWeek()
  const [weekYear, setWeekYear] = useState(curYear)
  const [weekNum, setWeekNum] = useState(curWeek)

  const [dots, setDots] = useState<TrapDot[]>([])
  const [coverage, setCoverage] = useState<TrapCoverage[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(null)
  const [selectedPestId, setSelectedPestId] = useState<string | null>(null)
  const [selectedDot, setSelectedDot] = useState<TrapDot | null>(null)
  const [trapCounts, setTrapCounts] = useState<TrapCountRow[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showCoverage, setShowCoverage] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const dotsLayerRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [geoLoaded, setGeoLoaded] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────

  const uniqueScouts = useMemo(() => {
    const seen = new Set<string>()
    return dots
      .filter(d => { if (seen.has(d.scout_id)) return false; seen.add(d.scout_id); return true })
      .map(d => ({ id: d.scout_id, name: d.scout_name }))
  }, [dots])

  const uniquePests = useMemo(() => {
    const seen = new Set<string>()
    return dots
      .filter(d => { if (seen.has(d.pest_id)) return false; seen.add(d.pest_id); return true })
      .map(d => ({ id: d.pest_id, name: d.pest_name }))
  }, [dots])

  const visibleDots = useMemo(() =>
    dots.filter(d =>
      d.has_location &&
      (!selectedScoutId || d.scout_id === selectedScoutId) &&
      (!selectedPestId  || d.pest_id  === selectedPestId)
    ),
    [dots, selectedScoutId, selectedPestId]
  )

  const filteredCoverage = useMemo(() =>
    coverage.filter(c => !selectedPestId || c.pest_id === selectedPestId),
    [coverage, selectedPestId]
  )

  const totalInspected = useMemo(() =>
    dots.filter(d =>
      (!selectedScoutId || d.scout_id === selectedScoutId) &&
      (!selectedPestId  || d.pest_id  === selectedPestId)
    ).length,
    [dots, selectedScoutId, selectedPestId]
  )

  const inspectedTraps = filteredCoverage.filter(c => c.inspected).length
  const totalTraps = filteredCoverage.length

  // ── Load farms ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    async function loadFarms() {
      let q = supabase.from('farms').select('id, full_name, code').eq('is_active', true).order('full_name')
      if (!isSuperAdmin && farmIds.length > 0) q = q.in('id', farmIds)
      const { data } = await q
      const farmList = (data || []) as Farm[]
      setEffectiveFarmIds(farmList.map(f => f.id))
    }
    loadFarms()
  }, [contextLoaded])

  // ── Load dots + coverage ──────────────────────────────────────────────────

  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    async function loadData() {
      setLoading(true)
      setSelectedDot(null)
      setSelectedScoutId(null)
      setSelectedPestId(null)
      const { from, to } = isoWeekRange(weekYear, weekNum)
      const params = {
        p_farm_ids: effectiveFarmIds,
        p_week_start: from.toISOString(),
        p_week_end: to.toISOString(),
      }
      const [dotsRes, covRes] = await Promise.all([
        supabase.rpc('get_trap_inspection_dots', params),
        supabase.rpc('get_trap_week_coverage', params),
      ])
      if (!dotsRes.error) setDots((dotsRes.data || []) as TrapDot[])
      if (!covRes.error) setCoverage((covRes.data || []) as TrapCoverage[])
      setLoading(false)
    }
    loadData()
  }, [effectiveFarmIds, weekYear, weekNum])

  // ── Load trap counts on dot select ───────────────────────────────────────

  useEffect(() => {
    if (!selectedDot) { setTrapCounts([]); return }
    async function loadCounts() {
      setLoadingDetail(true)
      const { data } = await supabase
        .from('trap_counts')
        .select('count, pests(id, name)')
        .eq('inspection_id', selectedDot!.inspection_id)
      const rows: TrapCountRow[] = (data || []).map((r: any) => ({
        pest_id: r.pests?.id ?? '',
        pest_name: r.pests?.name ?? '—',
        count: r.count,
      }))
      setTrapCounts(rows)
      setLoadingDetail(false)
    }
    loadCounts()
  }, [selectedDot])

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
            lyr.bindTooltip(f.properties.name || '', { permanent: false, className: 'tri-tooltip' })
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
      const isSelected = selectedDot?.inspection_id === d.inspection_id
      const color = STATUS_COLORS[d.status]?.fill ?? '#aaaaaa'

      // Outer ring for above-threshold traps
      if (d.status === 'red') {
        L.circleMarker([d.lat, d.lng], {
          radius: 13,
          fillOpacity: 0,
          color: '#e85a4a',
          weight: 1.5,
          opacity: 0.4,
          interactive: false,
          pane: 'dotsPane',
        }).addTo(layer)
      }

      L.circleMarker([d.lat, d.lng], {
        radius: isSelected ? 10 : 7,
        fillColor: color,
        fillOpacity: 0.92,
        color: '#fff',
        weight: isSelected ? 3 : 1.5,
        pane: 'dotsPane',
      })
        .bindTooltip(
          `Trap #${d.trap_nr ?? '?'} · ${d.zone_name}<br/>${d.orchard_name} · ${d.pest_name}`,
          { className: 'tri-tooltip' }
        )
        .on('click', () => setSelectedDot(prev =>
          prev?.inspection_id === d.inspection_id ? null : d
        ))
        .addTo(layer)
    })

    layer.addTo(map)
    dotsLayerRef.current = layer

    // Auto-fit when no dot is selected
    if (!selectedDot && visibleDots.length > 0) {
      map.fitBounds(
        L.latLngBounds(visibleDots.map(d => [d.lat, d.lng])),
        { padding: [40, 40], maxZoom: 17 }
      )
    }
  }, [mapReady, visibleDots, selectedDot])

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

  // Panel mode
  const showDetailPanel = selectedDot !== null
  const showCoveragePanel = !showDetailPanel && showCoverage

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
        .pills-bar {
          background: #fff; border-bottom: 1px solid #f0ede6;
          padding: 8px 20px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 42px;
        }
        .tri-scout-pill, .tri-pest-pill {
          padding: 4px 12px; border-radius: 20px; border: 1.5px solid #e0ddd6;
          background: #fff; color: #6a7a70; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .tri-scout-pill.active, .tri-pest-pill.active {
          background: #1c3a2a; border-color: #1c3a2a; color: #a8d5a2;
        }
        .tri-scout-pill:hover:not(.active), .tri-pest-pill:hover:not(.active) { background: #f4f1ea; }
        .tri-coverage-btn {
          padding: 5px 12px; border-radius: 8px; border: 1.5px solid #d0cdc6;
          background: #fff; color: #5a6a70; font-size: 12.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 5px;
        }
        .tri-coverage-btn.open {
          background: #eef5f1; border-color: #1c3a2a; color: #1c3a2a;
        }
        .tri-coverage-btn:hover:not(.open) { background: #f4f1ea; }
        .body-row { flex: 1; display: flex; overflow: hidden; position: relative; }
        .map-wrap { flex: 1; position: relative; }
        .tri-legend {
          position: absolute; bottom: 16px; left: 16px; z-index: 1000;
          background: rgba(255,255,255,0.90); border-radius: 8px; padding: 8px 12px;
          font-size: 11px; color: #3a4a40; line-height: 1.8;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .tri-legend-row { display: flex; align-items: center; gap: 6px; }
        .tri-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .tri-side-panel {
          width: 340px; min-width: 340px; background: #fff; border-left: 1px solid #e8e4dc;
          display: flex; flex-direction: column; overflow: hidden;
        }
        .tri-panel-header {
          padding: 14px 16px; border-bottom: 1px solid #f0ede6;
          display: flex; align-items: flex-start; gap: 10px; flex-shrink: 0;
        }
        .tri-panel-close {
          margin-left: auto; background: none; border: none; font-size: 18px;
          color: #9aaa9f; cursor: pointer; padding: 0 4px; line-height: 1; flex-shrink: 0;
        }
        .tri-panel-close:hover { color: #3a4a40; }
        .tri-panel-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; flex: 1; }
        .tri-section-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.8px; color: #9aaa9f; margin-bottom: 6px;
        }
        .tri-count-row {
          display: flex; align-items: center; gap: 10px; padding: 7px 0;
          border-bottom: 1px solid #f4f1ea;
        }
        .tri-count-row:last-child { border-bottom: none; }
        .tri-count-badge {
          padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 700;
          color: #fff; flex-shrink: 0;
        }
        .tri-status-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #fff;
        }
        .tri-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 9px; border-radius: 10px; font-size: 11.5px; font-weight: 500;
        }
        .tri-badge.rebaited { background: #eef7f1; color: #2a7a4a; border: 1px solid #b8e4c8; }
        .tri-badge.not-rebaited { background: #fef2f2; color: #9a3a3a; border: 1px solid #f8c8c8; }
        .tri-badge.nfc { background: #eef1f7; color: #2a4a7a; border: 1px solid #b8c8e8; }
        .tri-coverage-panel { display: flex; flex-direction: column; overflow: hidden; height: 100%; }
        .tri-coverage-table { overflow-y: auto; flex: 1; }
        .tri-coverage-row {
          display: grid; grid-template-columns: 28px 1fr 80px 70px 56px 46px 52px;
          align-items: center; gap: 4px; padding: 7px 12px;
          border-bottom: 1px solid #f4f1ea; font-size: 12px;
        }
        .tri-coverage-row.header {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.5px; color: #9aaa9f; background: #fafaf8;
          border-bottom: 1px solid #e8e4dc; position: sticky; top: 0; z-index: 1;
        }
        .tri-coverage-row.uninspected { color: #9aaa9f; }
        .tri-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .tri-tooltip {
          background: #1c3a2a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .tri-tooltip::before { display: none !important; }
        .tri-empty-overlay {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px; z-index: 500;
          pointer-events: none;
        }
        .tri-empty-card {
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
          <a href="/trap-inspections" className="nav-item active"><span>🪤</span> Trap Inspections</a>
          <a href="/inspections" className="nav-item"><span>🔍</span> Inspections</a>
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
            <div className="page-title">🪤 Trap Inspections</div>

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

            {/* Coverage toggle */}
            <button
              className={`tri-coverage-btn${showCoverage ? ' open' : ''}`}
              onClick={() => {
                if (!showCoverage) setSelectedDot(null)
                setShowCoverage(v => !v)
              }}
            >
              📋 Coverage
              {totalTraps > 0 && (
                <span style={{
                  marginLeft: 3, background: inspectedTraps === totalTraps ? '#4caf72' : '#f5c842',
                  color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                }}>
                  {inspectedTraps}/{totalTraps}
                </span>
              )}
            </button>

            {/* Stats */}
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#6a7a70', display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading ? (
                <span style={{ color: '#9aaa9f' }}>Loading…</span>
              ) : (
                <>
                  <span><strong style={{ color: '#1c3a2a' }}>{totalInspected}</strong> inspections</span>
                  <span style={{ color: '#d0cdc6' }}>·</span>
                  <span><strong style={{ color: '#1c3a2a' }}>{visibleDots.length}</strong> on map</span>
                  {totalTraps > 0 && (
                    <>
                      <span style={{ color: '#d0cdc6' }}>·</span>
                      <span>
                        <strong style={{ color: inspectedTraps < totalTraps ? '#e85a4a' : '#4caf72' }}>{inspectedTraps}</strong>
                        <span style={{ color: '#9aaa9f' }}>/{totalTraps} traps checked</span>
                      </span>
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

          {/* Scout pills row */}
          <div className="pills-bar">
            <span style={{ fontSize: 11, color: '#9aaa9f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scout</span>
            <button
              className={`tri-scout-pill${!selectedScoutId ? ' active' : ''}`}
              onClick={() => setSelectedScoutId(null)}
            >All</button>
            {uniqueScouts.map(s => (
              <button
                key={s.id}
                className={`tri-scout-pill${selectedScoutId === s.id ? ' active' : ''}`}
                onClick={() => setSelectedScoutId(prev => prev === s.id ? null : s.id)}
              >{s.name}</button>
            ))}
          </div>

          {/* Pest pills row */}
          <div className="pills-bar">
            <span style={{ fontSize: 11, color: '#9aaa9f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pest</span>
            <button
              className={`tri-pest-pill${!selectedPestId ? ' active' : ''}`}
              onClick={() => setSelectedPestId(null)}
            >All</button>
            {uniquePests.map(p => (
              <button
                key={p.id}
                className={`tri-pest-pill${selectedPestId === p.id ? ' active' : ''}`}
                onClick={() => setSelectedPestId(prev => prev === p.id ? null : p.id)}
              >{p.name}</button>
            ))}
          </div>

          {/* Body: map + optional right panel */}
          <div className="body-row">

            {/* Map */}
            <div className="map-wrap">
              <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

              {/* Legend */}
              <div className="tri-legend">
                {Object.entries(STATUS_COLORS).map(([key, { fill, label }]) => (
                  <div key={key} className="tri-legend-row">
                    <div className="tri-legend-dot" style={{ background: fill }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* Empty state */}
              {!loading && dots.length === 0 && mapReady && (
                <div className="tri-empty-overlay">
                  <div className="tri-empty-card">
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1c3a2a', marginBottom: 6 }}>
                      No trap inspections with GPS for W{weekNum}
                    </div>
                    <div style={{ fontSize: 13, color: '#9aaa9f' }}>← Try a previous week</div>
                  </div>
                </div>
              )}
            </div>

            {/* Detail panel */}
            {showDetailPanel && selectedDot && (
              <div className="tri-side-panel">
                <div className="tri-panel-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1c3a2a' }}>
                      Trap #{selectedDot.trap_nr ?? '?'} · {selectedDot.zone_name}
                    </div>
                    <div style={{ fontSize: 13, color: '#6a7a70', marginTop: 2 }}>
                      {selectedDot.orchard_name}
                    </div>
                  </div>
                  <button className="tri-panel-close" onClick={() => setSelectedDot(null)}>✕</button>
                </div>

                <div className="tri-panel-body">
                  {/* Pest + lure */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1c3a2a' }}>{selectedDot.pest_name}</div>
                    {selectedDot.lure_name && (
                      <div style={{ fontSize: 12, color: '#9aaa9f', marginTop: 2 }}>{selectedDot.lure_name}</div>
                    )}
                  </div>

                  {/* Scout + timestamp */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#3a4a40' }}>{selectedDot.scout_name}</div>
                    <div style={{ fontSize: 12, color: '#9aaa9f', marginTop: 2 }}>
                      {new Date(selectedDot.inspected_at).toLocaleString('en-ZA', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className="tri-status-chip"
                      style={{ background: STATUS_COLORS[selectedDot.status]?.fill ?? '#aaa' }}
                    >
                      {STATUS_COLORS[selectedDot.status]?.label ?? selectedDot.status}
                    </span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={`tri-badge ${selectedDot.rebaited ? 'rebaited' : 'not-rebaited'}`}>
                      {selectedDot.rebaited ? '✓ Rebaited' : '✗ Not rebaited'}
                    </span>
                    {selectedDot.nfc_scanned && (
                      <span className="tri-badge nfc">📱 NFC</span>
                    )}
                  </div>

                  {/* Pest counts */}
                  <div>
                    <div className="tri-section-label">Pest Counts</div>
                    {loadingDetail ? (
                      <div style={{ fontSize: 13, color: '#9aaa9f', padding: '8px 0' }}>Loading…</div>
                    ) : trapCounts.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#9aaa9f', padding: '8px 0' }}>No counts recorded.</div>
                    ) : (
                      trapCounts.map((tc, i) => {
                        const bgColor = tc.count === 0 ? '#4caf72'
                          : selectedDot.threshold && tc.count >= selectedDot.threshold ? '#e85a4a'
                          : selectedDot.threshold && tc.count >= selectedDot.threshold * 0.5 ? '#f5c842'
                          : '#4caf72'
                        return (
                          <div key={tc.pest_id || i} className="tri-count-row">
                            <div style={{ flex: 1, fontSize: 13, color: '#1c3a2a', fontWeight: 500 }}>
                              {tc.pest_name}
                            </div>
                            <div className="tri-count-badge" style={{ background: bgColor }}>
                              {tc.count}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Coverage panel */}
            {showCoveragePanel && (
              <div className="tri-side-panel">
                <div className="tri-panel-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1c3a2a' }}>
                      Coverage · W{weekNum}
                    </div>
                    <div style={{ fontSize: 13, color: '#6a7a70', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          background: inspectedTraps === totalTraps ? '#4caf72' : '#f5c842',
                          color: '#fff', borderRadius: 10, padding: '1px 8px',
                          fontSize: 12, fontWeight: 700,
                        }}
                      >{inspectedTraps}/{totalTraps} inspected</span>
                    </div>
                  </div>
                  <button className="tri-panel-close" onClick={() => setShowCoverage(false)}>✕</button>
                </div>

                <div className="tri-coverage-panel">
                  {/* Table header */}
                  <div className="tri-coverage-row header">
                    <span>#</span>
                    <span>Orchard</span>
                    <span>Zone</span>
                    <span>Pest</span>
                    <span>Status</span>
                    <span>Cnt</span>
                    <span>Rebait</span>
                  </div>
                  <div className="tri-coverage-table">
                    {[...filteredCoverage]
                      .sort((a, b) => {
                        // Inspected first (sorted by status), then uninspected alpha by orchard
                        if (a.inspected && !b.inspected) return -1
                        if (!a.inspected && b.inspected) return 1
                        if (a.inspected && b.inspected) {
                          const so = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
                          if (so !== 0) return so
                        }
                        return a.orchard_name.localeCompare(b.orchard_name) || (a.trap_nr ?? 0) - (b.trap_nr ?? 0)
                      })
                      .map((c, i) => (
                        <div
                          key={c.trap_id}
                          className={`tri-coverage-row${!c.inspected ? ' uninspected' : ''}`}
                        >
                          <span style={{ fontWeight: 600, color: c.inspected ? '#1c3a2a' : '#c0ccc4' }}>
                            {c.trap_nr ?? '?'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={c.orchard_name}>
                            {c.orchard_name}
                          </span>
                          <span style={{ color: '#6a7a70', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={c.zone_name}>
                            {c.zone_name}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={c.pest_name}>
                            {c.pest_name}
                          </span>
                          <span>
                            <span style={{
                              display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
                              background: STATUS_COLORS[c.status]?.fill ?? '#aaa',
                              verticalAlign: 'middle', marginRight: 4,
                            }} />
                          </span>
                          <span style={{ fontWeight: 600 }}>{c.inspected ? c.total_count : '—'}</span>
                          <span style={{ color: c.rebaited ? '#2a7a4a' : '#c0ccc4', fontWeight: 600 }}>
                            {c.rebaited ? '✓' : '—'}
                          </span>
                        </div>
                      ))
                    }
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

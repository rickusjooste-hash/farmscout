'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useOrgModules } from '@/lib/useOrgModules'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import { useEffect, useState, useRef, useMemo } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface BagDot {
  session_id: string
  bag_seq: number | null
  lat: number | null
  lng: number | null
  has_location: boolean
  collected_at: string
  sampled_at: string | null
  orchard_id: string
  orchard_name: string
  employee_name: string
  fruit_count: number
  issue_count: number
  status: string
}

interface BagDetail {
  session: {
    id: string
    orchard_name: string
    employee_name: string
    collected_at: string
    sampled_at: string | null
    bag_seq: number | null
    collection_lat: number | null
    collection_lng: number | null
    status: string
  }
  fruit: Array<{ seq: number; weight_g: number; bin_label: string | null }>
  issues: Array<{ pest_name: string; pest_name_af: string; category: string; count: number }>
}

interface IssueOption { id: string; name: string }


// ── Date helpers ───────────────────────────────────────────────────────────

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

function dayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date)
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { from, to }
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}

function prevDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return d
}
function nextDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d
}
function isToday(date: Date): boolean {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

// ── Dot colour ─────────────────────────────────────────────────────────────

function dotColor(d: BagDot): string {
  if (d.issue_count === 0) return '#4caf72'
  if (d.issue_count >= 5) return '#e85a4a'
  return '#f5c842'
}

// ── Nav arrow ──────────────────────────────────────────────────────────────

function NavArrow({ dir, onClick, disabled }: { dir: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #d0cdc6',
      background: '#fff', color: disabled ? '#ccc' : '#3a4a40', fontSize: 15,
      cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
    }}>{dir}</button>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function QcBagMapPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()
  const modules = useOrgModules()

  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])

  const { year: curYear, week: curWeek } = currentISOWeek()
  const [weekYear, setWeekYear] = useState(curYear)
  const [weekNum, setWeekNum] = useState(curWeek)

  const [dateMode, setDateMode] = useState<'today' | 'week'>('today')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setSelectedDate(d)
  }, [])

  const [dots, setDots] = useState<BagDot[]>([])
  const [loading, setLoading] = useState(false)

  const [issues, setIssues] = useState<IssueOption[]>([])
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)


  const [selectedBag, setSelectedBag] = useState<BagDot | null>(null)
  const [bagDetail, setBagDetail] = useState<BagDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Drag-to-relocate state
  const [draggedLatLng, setDraggedLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [savingLocation, setSavingLocation] = useState(false)
  const dragMarkerRef = useRef<any>(null)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const dotsLayerRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const [geoLoaded, setGeoLoaded] = useState(false)

  // ── Derived values ─────────────────────────────────────────────────────────

  const visibleDots = useMemo(
    () => dots.filter(d => d.has_location && d.lat != null && d.lng != null),
    [dots]
  )

  const noGpsCount = dots.length - visibleDots.length
  const withIssues = visibleDots.filter(d => d.issue_count > 0).length



  // ── Load farms ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    async function loadFarms() {
      let q = supabase.from('farms').select('id').eq('is_active', true)
      if (!isSuperAdmin && farmIds.length > 0) q = q.in('id', farmIds)
      const { data } = await q
      setEffectiveFarmIds((data || []).map((f: any) => f.id))
    }
    loadFarms()
  }, [contextLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load issue options ─────────────────────────────────────────────────────

  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    ;(async () => {
      const { data: orchData } = await supabase
        .from('orchards').select('commodity_id')
        .in('farm_id', effectiveFarmIds).eq('is_active', true)
      const commodityIds = [...new Set((orchData || []).map((o: any) => o.commodity_id as string))]
      if (!commodityIds.length) return
      const { data: cpData } = await supabase
        .from('commodity_pests')
        .select('pest_id, pests(id, name), display_order')
        .in('commodity_id', commodityIds)
        .in('category', ['qc_issue', 'picking_issue'])
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (!cpData) return
      const seen = new Set<string>()
      const opts: IssueOption[] = []
      cpData.forEach((r: any) => {
        if (r.pests && !seen.has(r.pests.id)) {
          seen.add(r.pests.id)
          opts.push({ id: r.pests.id, name: r.pests.name })
        }
      })
      setIssues(opts)
    })()
  }, [effectiveFarmIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load dots + picker breakdown ────────────────────────────────────────────

  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    if (dateMode === 'today' && !selectedDate) return
    ;(async () => {
      setLoading(true)
      setSelectedBag(null)
      const { from, to } = dateMode === 'today'
        ? dayRange(selectedDate!)
        : isoWeekRange(weekYear, weekNum)
      const { data, error } = await supabase.rpc('get_qc_bag_dots', {
        p_farm_ids: effectiveFarmIds,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      })
      if (!error) setDots((data || []) as BagDot[])
      setLoading(false)
    })()
  }, [effectiveFarmIds, weekYear, weekNum, dateMode, selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load detail on bag select ──────────────────────────────────────────────

  useEffect(() => {
    if (!selectedBag) { setBagDetail(null); setDraggedLatLng(null); return }
    setDraggedLatLng(null)
    ;(async () => {
      setLoadingDetail(true)
      const { data } = await supabase.rpc('get_qc_bag_detail', { p_session_id: selectedBag.session_id })
      setBagDetail(data as BagDetail)
      setLoadingDetail(false)
    })()
  }, [selectedBag]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draggable marker for selected bag ──────────────────────────────────────

  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const map = mapRef.current

    // Remove previous drag marker
    if (dragMarkerRef.current) { dragMarkerRef.current.remove(); dragMarkerRef.current = null }

    if (!selectedBag || !selectedBag.has_location) return

    const lat = draggedLatLng?.lat ?? selectedBag.lat!
    const lng = draggedLatLng?.lng ?? selectedBag.lng!

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:20px;height:20px;border-radius:50%;
        background:${dotColor(selectedBag)};border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        cursor:grab;
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })

    const marker = L.marker([lat, lng], {
      icon,
      draggable: true,
      pane: 'dotsPane',
      zIndexOffset: 1000,
    }).addTo(map)

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      setDraggedLatLng({ lat: pos.lat, lng: pos.lng })
    })

    dragMarkerRef.current = marker
    return () => { if (dragMarkerRef.current) { dragMarkerRef.current.remove(); dragMarkerRef.current = null } }
  }, [mapReady, selectedBag, draggedLatLng]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save dragged location ──────────────────────────────────────────────────

  async function saveLocation() {
    if (!selectedBag || !draggedLatLng) return
    setSavingLocation(true)
    try {
      const res = await fetch('/api/qc/bag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedBag.session_id,
          collection_lat: draggedLatLng.lat,
          collection_lng: draggedLatLng.lng,
        }),
      })
      if (res.ok) {
        // Update local state so dot moves immediately
        setDots(prev => prev.map(d =>
          d.session_id === selectedBag.session_id
            ? { ...d, lat: draggedLatLng.lat, lng: draggedLatLng.lng, has_location: true }
            : d
        ))
        setSelectedBag(prev => prev ? { ...prev, lat: draggedLatLng.lat, lng: draggedLatLng.lng, has_location: true } : null)
        setDraggedLatLng(null)
      }
    } finally {
      setSavingLocation(false)
    }
  }

  // ── Init Leaflet ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (mapReady || !mapContainerRef.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      if (!(mapContainerRef.current as any)?._leaflet_id) {
        const map = L.map(mapContainerRef.current!, {
          zoomControl: true, attributionControl: false, scrollWheelZoom: true, maxZoom: 19,
        })
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19, maxNativeZoom: 18 }
        ).addTo(map)
        map.createPane('dotsPane')
        ;(map.getPane('dotsPane') as HTMLElement).style.zIndex = '650'
        mapRef.current = map
        leafletRef.current = L
        setMapReady(true)
      }
    })()
  }, [])

  // ── Draw orchard polygons ──────────────────────────────────────────────────

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
            fillColor: '#888', fillOpacity: 0.12, color: '#fff', weight: 1.5, dashArray: '4 3',
          }),
          onEachFeature: (f: any, lyr: any) => {
            lyr.bindTooltip(f.properties.name || '', { permanent: false, className: 'qbm-tooltip' })
          },
        }
      ).addTo(map)

      geoLayerRef.current = layer
      if (layer.getBounds().isValid()) {
        map.fitBounds(layer.getBounds(), { padding: [16, 16] })
      }
      setGeoLoaded(true)
    })()
  }, [mapReady, effectiveFarmIds, geoLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild dots layer ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const map = mapRef.current

    if (dotsLayerRef.current) dotsLayerRef.current.remove()

    const filtered = selectedIssueId
      ? visibleDots // we can't client-filter by issue from the dots RPC — show all, dim later via opacity
      : visibleDots

    if (filtered.length === 0) { dotsLayerRef.current = null; return }

    const layer = L.layerGroup()

    filtered.forEach((d: BagDot) => {
      const isSelected = selectedBag?.session_id === d.session_id
      // Skip selected dot — it's rendered as a draggable marker instead
      if (isSelected) return

      if (d.issue_count >= 5) {
        L.circleMarker(L.latLng(d.lat!, d.lng!), {
          radius: 13, fillOpacity: 0, color: '#e85a4a', weight: 1.5, opacity: 0.45,
          interactive: false, pane: 'dotsPane',
        }).addTo(layer)
      }

      L.circleMarker(L.latLng(d.lat!, d.lng!), {
        radius: 7,
        fillColor: dotColor(d),
        fillOpacity: 0.92,
        color: '#fff',
        weight: 1.5,
        pane: 'dotsPane',
      })
        .bindTooltip(
          `Bag #${d.bag_seq ?? '?'} \u00b7 ${d.employee_name}<br/>${d.orchard_name}`,
          { className: 'qbm-tooltip' }
        )
        .on('click', () => setSelectedBag(prev => prev?.session_id === d.session_id ? null : d))
        .addTo(layer)
    })

    layer.addTo(map)
    dotsLayerRef.current = layer

    if (!selectedBag && filtered.length > 0) {
      map.fitBounds(
        L.latLngBounds(filtered.map((d: BagDot) => L.latLng(d.lat!, d.lng!))),
        { padding: [40, 40], maxZoom: 17 }
      )
    }
  }, [mapReady, visibleDots, selectedBag, selectedIssueId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Nav helpers ────────────────────────────────────────────────────────────

  const { year: ny, week: nw } = nextWeek(weekYear, weekNum)
  const canGoForward = ny < curYear || (ny === curYear && nw <= curWeek)
  const canGoForwardDay = selectedDate ? !isToday(selectedDate) : false

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f4f1ea; overflow: hidden; }
        .qbm-app { display: flex; height: 100vh; overflow: hidden; }
        .qbm-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .qbm-top-bar {
          background: #fff; border-bottom: 1px solid #e8e4dc;
          padding: 12px 20px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
        }
        .qbm-page-title { font-size: 17px; font-weight: 700; color: #1a2a3a; }
        .qbm-pills-bar {
          background: #fff; border-bottom: 1px solid #f0ede6;
          padding: 8px 20px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 44px;
        }
        .qbm-pill {
          padding: 4px 12px; border-radius: 20px; border: 1.5px solid #e0ddd6;
          background: #fff; color: #6a7a70; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .qbm-pill.active { background: #1a2a3a; border-color: #1a2a3a; color: #a0c4f0; }
        .qbm-pill:hover:not(.active) { background: #f4f1ea; }
        .qbm-body-row { flex: 1; display: flex; overflow: hidden; position: relative; }
        .qbm-map-wrap { flex: 1; position: relative; }
        .qbm-legend {
          position: absolute; bottom: 16px; left: 16px; z-index: 1000;
          background: rgba(255,255,255,0.90); border-radius: 8px; padding: 8px 12px;
          font-size: 11px; color: #3a4a40; line-height: 1.8;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .qbm-legend-row { display: flex; align-items: center; gap: 6px; }
        .qbm-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .qbm-side-panel {
          width: 340px; min-width: 340px; background: #fff; border-left: 1px solid #e8e4dc;
          display: flex; flex-direction: column; overflow-y: auto;
        }
        .qbm-panel-header {
          padding: 14px 16px; border-bottom: 1px solid #f0ede6;
          display: flex; align-items: flex-start; gap: 10px;
        }
        .qbm-panel-close {
          margin-left: auto; background: none; border: none; font-size: 18px;
          color: #8a95a0; cursor: pointer; padding: 0 4px; line-height: 1; flex-shrink: 0;
        }
        .qbm-panel-close:hover { color: #3a4a40; }
        .qbm-panel-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
        .qbm-section-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.8px; color: #8a95a0; margin-bottom: 4px;
        }
        .qbm-obs-row {
          display: flex; align-items: center; gap: 10px; padding: 8px 0;
          border-bottom: 1px solid #f4f1ea;
        }
        .qbm-obs-row:last-child { border-bottom: none; }
        .qbm-count-badge {
          padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 700;
          color: #fff; flex-shrink: 0;
        }
        .qbm-tooltip {
          background: #1a2a3a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .qbm-tooltip::before { display: none !important; }
        .qbm-empty-overlay {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px; z-index: 500;
          pointer-events: none;
        }
        .qbm-empty-card {
          background: rgba(255,255,255,0.92); border-radius: 12px; padding: 20px 28px;
          text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.10);
        }
        .qbm-status-badge {
          display: inline-block; padding: 2px 8px; border-radius: 12px;
          font-size: 11px; font-weight: 600;
        }
        @keyframes qbm-shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      <div className="qbm-app">
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />

        <div className="qbm-main">

          {/* Top bar */}
          <div className="qbm-top-bar">
            <div className="qbm-page-title">QC Bag Map</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Mode toggle */}
              <div style={{ display: 'flex', background: '#f4f1ea', borderRadius: 20, padding: 2, gap: 2 }}>
                <button
                  onClick={() => setDateMode('today')}
                  style={{
                    padding: '4px 14px', borderRadius: 18, border: 'none', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: dateMode === 'today' ? '#1a2a3a' : 'transparent',
                    color: dateMode === 'today' ? '#a0c4f0' : '#6a7a70',
                  }}
                >Today</button>
                <button
                  onClick={() => setDateMode('week')}
                  style={{
                    padding: '4px 14px', borderRadius: 18, border: 'none', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: dateMode === 'week' ? '#1a2a3a' : 'transparent',
                    color: dateMode === 'week' ? '#a0c4f0' : '#6a7a70',
                  }}
                >This Week</button>
              </div>

              {/* Date / week navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {dateMode === 'today' ? (
                  <>
                    <NavArrow dir={'\u2039'} onClick={() => selectedDate && setSelectedDate(prevDay(selectedDate))} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a', whiteSpace: 'nowrap', minWidth: 140, textAlign: 'center' }}>
                      {selectedDate ? (isToday(selectedDate) ? 'Today \u00b7 ' : '') + dayLabel(selectedDate) : '\u2026'}
                    </span>
                    <NavArrow dir={'\u203a'} onClick={() => { if (canGoForwardDay && selectedDate) setSelectedDate(nextDay(selectedDate)) }} disabled={!canGoForwardDay} />
                  </>
                ) : (
                  <>
                    <NavArrow dir={'\u2039'} onClick={() => {
                      const p = prevWeek(weekYear, weekNum)
                      setWeekYear(p.year); setWeekNum(p.week)
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a', whiteSpace: 'nowrap', minWidth: 180, textAlign: 'center' }}>
                      {weekLabel(weekYear, weekNum)}
                    </span>
                    <NavArrow dir={'\u203a'} onClick={() => {
                      if (canGoForward) {
                        const n = nextWeek(weekYear, weekNum)
                        setWeekYear(n.year); setWeekNum(n.week)
                      }
                    }} disabled={!canGoForward} />
                    <button
                      onClick={() => { setWeekYear(curYear); setWeekNum(curWeek) }}
                      style={{
                        padding: '3px 10px', borderRadius: 20, border: '1.5px solid #e0ddd6',
                        background: '#fff', color: '#6a7a70', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        display: (weekYear !== curYear || weekNum !== curWeek) ? 'inline-block' : 'none',
                      }}
                    >This week</button>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#6a7a70', display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading ? (
                <span style={{ color: '#8a95a0' }}>Loading\u2026</span>
              ) : (
                <>
                  <span><strong style={{ color: '#1a2a3a' }}>{dots.length}</strong> bags</span>
                  <span style={{ color: '#d0cdc6' }}>\u00b7</span>
                  <span><strong style={{ color: withIssues > 0 ? '#e85a4a' : '#1a2a3a' }}>{withIssues}</strong> with issues</span>
                  {noGpsCount > 0 && (
                    <>
                      <span style={{ color: '#d0cdc6' }}>\u00b7</span>
                      <span style={{ color: '#8a95a0' }}>{noGpsCount} without GPS</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Loading bar */}
          {loading && (
            <div style={{ height: 3, background: 'linear-gradient(90deg, #2176d9, #a0c4f0)', animation: 'qbm-shimmer 1s infinite' }} />
          )}

          {/* Issue pills bar */}
          <div className="qbm-pills-bar">
            <span style={{ fontSize: 11, color: '#8a95a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issue</span>
            <button
              className={`qbm-pill${!selectedIssueId ? ' active' : ''}`}
              onClick={() => setSelectedIssueId(null)}
            >All</button>
            {issues.map(p => (
              <button
                key={p.id}
                className={`qbm-pill${selectedIssueId === p.id ? ' active' : ''}`}
                onClick={() => setSelectedIssueId(prev => prev === p.id ? null : p.id)}
              >{p.name}</button>
            ))}
          </div>

          {/* Body: map + side panel */}
          <div className="qbm-body-row">

            {/* Map */}
            <div className="qbm-map-wrap">
              <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

              {/* Legend */}
              <div className="qbm-legend">
                <div className="qbm-legend-row">
                  <div className="qbm-legend-dot" style={{ background: '#4caf72' }} />
                  <span>No issues</span>
                </div>
                <div className="qbm-legend-row">
                  <div className="qbm-legend-dot" style={{ background: '#f5c842' }} />
                  <span>1\u20134 issues</span>
                </div>
                <div className="qbm-legend-row">
                  <div className="qbm-legend-dot" style={{ background: '#e85a4a' }} />
                  <span>5+ issues</span>
                </div>
              </div>

              {/* Empty state */}
              {!loading && dots.length === 0 && mapReady && (
                <div className="qbm-empty-overlay">
                  <div className="qbm-empty-card">
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2a3a', marginBottom: 6 }}>
                      {dateMode === 'today'
                        ? `No QC bags recorded for ${selectedDate ? dayLabel(selectedDate) : 'today'}`
                        : `No QC bags recorded for W${weekNum}`}
                    </div>
                    <div style={{ fontSize: 13, color: '#8a95a0' }}>
                      {dateMode === 'today' ? '\u2190 Go to a previous day' : '\u2190 Go to a previous week'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Side panel */}
            {selectedBag && (
              <div className="qbm-side-panel">
                <div className="qbm-panel-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>
                      Bag #{selectedBag.bag_seq ?? '?'}
                    </div>
                    <div style={{ fontSize: 13, color: '#6a7a70', marginTop: 2 }}>
                      {selectedBag.orchard_name}
                    </div>
                  </div>
                  <button className="qbm-panel-close" onClick={() => setSelectedBag(null)}>{'\u2715'}</button>
                </div>

                <div className="qbm-panel-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#3a4a40' }}>
                      {selectedBag.employee_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a95a0' }}>
                      {new Date(selectedBag.collected_at).toLocaleString('en-ZA', {
                        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span
                        className="qbm-status-badge"
                        style={{
                          background: selectedBag.status === 'sampled' ? '#e8f5e9' : '#fff8e1',
                          color: selectedBag.status === 'sampled' ? '#2176d9' : '#7a5c00',
                        }}
                      >
                        {selectedBag.status === 'sampled' ? 'Sampled' : 'Collected'}
                      </span>
                    </div>
                  </div>

                  {/* Drag-to-relocate controls */}
                  {selectedBag.has_location && (
                    <div style={{
                      background: draggedLatLng ? '#fff8e1' : '#f7f5f0',
                      borderRadius: 8, padding: '10px 12px',
                      border: draggedLatLng ? '1px solid #f5c842' : '1px solid #e8e4dc',
                    }}>
                      {draggedLatLng ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#7a5c00', fontWeight: 600 }}>
                            Pin moved — save new position?
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={saveLocation}
                              disabled={savingLocation}
                              style={{
                                flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none',
                                background: '#2176d9', color: '#fff', fontSize: 12, fontWeight: 600,
                                cursor: savingLocation ? 'wait' : 'pointer',
                              }}
                            >{savingLocation ? 'Saving\u2026' : 'Save location'}</button>
                            <button
                              onClick={() => setDraggedLatLng(null)}
                              style={{
                                padding: '6px 12px', borderRadius: 6, border: '1px solid #d4cfca',
                                background: '#fff', color: '#5a6a60', fontSize: 12, fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#8a95a0' }}>
                          Drag the pin to correct its position
                        </div>
                      )}
                    </div>
                  )}

                  {loadingDetail ? (
                    <div style={{ fontSize: 13, color: '#8a95a0', padding: '8px 0' }}>Loading\u2026</div>
                  ) : bagDetail ? (
                    <>
                      <div>
                        <div className="qbm-section-label">Fruit</div>
                        <div style={{ fontSize: 13, color: '#3a4a40' }}>
                          {bagDetail.fruit.length} fruit
                          {bagDetail.fruit.length > 0 && (
                            <span style={{ color: '#8a95a0' }}>
                              {' '}\u00b7 avg {Math.round(bagDetail.fruit.reduce((s, f) => s + f.weight_g, 0) / bagDetail.fruit.length)}g
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="qbm-section-label">Issues</div>
                        {bagDetail.issues.length === 0 ? (
                          <div style={{ fontSize: 13, color: '#8a95a0', padding: '8px 0' }}>No issues recorded.</div>
                        ) : (
                          bagDetail.issues.map((iss, i) => (
                            <div key={i} className="qbm-obs-row">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a' }}>{iss.pest_name}</div>
                                <div style={{ fontSize: 11, color: '#b0bdb5' }}>{iss.category === 'picking_issue' ? 'Picking' : 'QC'}</div>
                              </div>
                              <div
                                className="qbm-count-badge"
                                style={{ background: iss.count >= 5 ? '#e85a4a' : iss.count >= 1 ? '#f5c842' : '#4caf72' }}
                              >{iss.count}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

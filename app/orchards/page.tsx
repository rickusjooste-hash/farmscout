'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState, useRef } from 'react'

interface OrchardInfo {
  id: string
  name: string
  variety: string
  ha: number
  legacy_id: number
  is_active: boolean
  commodities: { code: string; name: string }
}

interface PestOption {
  id: string
  name: string
}

interface OrchardPressure {
  orchard_id: string
  latest_count: number
  threshold: number | null
  last_inspected: string
  status: 'green' | 'yellow' | 'red' | 'grey' | 'blue'
}

interface SelectedOrchard {
  name: string
  variety: string
  commodity: string
  ha: number
  legacy_id: number
  status: string
  latest_count: number | null
  threshold: number | null
  last_inspected: string | null
}

const STATUS_COLORS = {
  green:  { fill: '#4caf72', label: 'Below threshold' },
  yellow: { fill: '#f5c842', label: 'Approaching threshold' },
  red:    { fill: '#e85a4a', label: 'Above threshold' },
  blue:   { fill: '#6b7fa8', label: 'No threshold set' },
  grey:   { fill: '#aaaaaa', label: 'No trap data' },
}

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  const startYr = mo < 8 ? yr - 1 : yr
  return `${startYr}/${(startYr + 1).toString().slice(-2)}`
}

function buildSeasonOptions(fromYear: number): string[] {
  const current = getCurrentSeason()
  const currentStartYr = parseInt(current.split('/')[0])
  const seasons = []
  for (let yr = fromYear; yr <= currentStartYr; yr++) {
    seasons.push(`${yr}/${(yr + 1).toString().slice(-2)}`)
  }
  return seasons.reverse()
}

function getSeasonRange(season: string): { from: Date; to: Date } {
  const startYr = parseInt(season.split('/')[0])
  return {
    from: new Date(`${startYr}-08-01`),
    to:   new Date(`${startYr + 1}-07-31`),
  }
}

function getWeekDates(season: string, weekNr: number): { from: string; to: string } {
  const startYr = parseInt(season.split('/')[0])
  // Week 1 starts Aug 1 of start year — use ISO week logic from a date
  // Simpler: find the actual date for week weekNr of the season
  // Weeks 31-52 are in startYr, weeks 1-30 are in startYr+1
  const yr = weekNr >= 31 ? startYr : startYr + 1
  const jan1 = new Date(yr, 0, 1)
  const dayOffset = (weekNr - 1) * 7
  const weekStart = new Date(jan1.getTime() + dayOffset * 86400000)
  const weekEnd   = new Date(weekStart.getTime() + 6 * 86400000)
  weekEnd.setHours(23, 59, 59)
  return { from: weekStart.toISOString(), to: weekEnd.toISOString() }
}

function getWeeksInSeason(season: string): number[] {
  // SA fruit season: roughly Aug (W31) to Jun (W26) next year
  const weeks: number[] = []
  for (let w = 31; w <= 52; w++) weeks.push(w)
  for (let w = 1;  w <= 26; w++) weeks.push(w)
  return weeks
}

function currentWeekNr(): number {
  const now = new Date()
  const yr  = now.getFullYear()
  const start = new Date(yr, 0, 1)
  return Math.ceil((now.getTime() - start.getTime()) / 604800000)
}

export default function OrchardsPage() {
  const supabase         = createClient()
  const mapRef          = useRef<any>(null)
  const leafletRef      = useRef<any>(null)
  const geoLayerRef     = useRef<any>(null)

  
  const [orchards, setOrchards]           = useState<OrchardInfo[]>([])
  const [pests, setPests]                 = useState<PestOption[]>([])
  const [selectedPest, setSelectedPest]   = useState<PestOption | null>(null)
  const [pressure, setPressure]           = useState<Record<string, OrchardPressure>>({})
  const [selected, setSelected]           = useState<SelectedOrchard | null>(null)
  const [mapReady, setMapReady]           = useState(false)
  const [loadingPressure, setLoadingPressure] = useState(false)

  const seasons = buildSeasonOptions(2023)
  const [season, setSeason]               = useState(getCurrentSeason())
  const [selectedWeek, setSelectedWeek]   = useState<number>(currentWeekNr())
  const weeks = getWeeksInSeason(season)

  
  // Load orchards
   // Load orchards
  useEffect(() => {
    
    supabase
      .from('orchards')
      .select('id, name, variety, ha, legacy_id, is_active, commodity_id, commodities(code, name)')
      .eq('is_active', true)
      .then(({ data, error }) => {
        console.log('Orchards data:', data)
        console.log('Orchards error:', error)
        setOrchards((data as any) || [])
      })
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      console.log('Current user:', data.user?.id, data.user?.email)
    })
  }, [])

  // Load pests that have trap counts
  useEffect(() => {
    supabase
      .from('trap_counts')
      .select('pest_id, pests(id, name)')
      .limit(1000)
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

  // Load pressure for selected pest + week
  useEffect(() => {
    if (!selectedPest || orchards.length === 0) return

    async function loadPressure() {
      setLoadingPressure(true)

      const { from, to } = getWeekDates(season, selectedWeek)

      // Get all inspections in selected week
      const { data: inspections } = await supabase
        .from('trap_inspections')
        .select('id, orchard_id, inspected_at')
        .gte('inspected_at', from)
        .lte('inspected_at', to)
        .order('inspected_at', { ascending: false })

      if (!inspections || inspections.length === 0) {
        setPressure({})
        setLoadingPressure(false)
        return
      }

      // Latest inspection per orchard within the week
      const latestPerOrchard: Record<string, any> = {}
      inspections.forEach(i => {
        if (i.orchard_id && !latestPerOrchard[i.orchard_id]) {
          latestPerOrchard[i.orchard_id] = i
        }
      })

      const inspectionIds = Object.values(latestPerOrchard).map((i: any) => i.id)

      // Get counts for selected pest
      const { data: counts } = await supabase
        .from('trap_counts')
        .select('inspection_id, count')
        .eq('pest_id', selectedPest!.id)
        .in('inspection_id', inspectionIds.slice(0, 500))

      const countByInspection: Record<string, number> = {}
      counts?.forEach((c: any) => {
        countByInspection[c.inspection_id] = (countByInspection[c.inspection_id] || 0) + c.count
      })

      // Get thresholds for this pest
      const { data: thresholds } = await supabase
        .from('trap_thresholds')
        .select('threshold, commodity_id')
        .eq('pest_id', selectedPest!.id)

      const newPressure: Record<string, OrchardPressure> = {}
      Object.entries(latestPerOrchard).forEach(([orchardId, inspection]: [string, any]) => {
        const count     = countByInspection[inspection.id] ?? null
        const threshold = thresholds?.[0]?.threshold ?? null

        let status: OrchardPressure['status'] = 'grey'
        if (count === null)           status = 'grey'
        else if (threshold === null)  status = 'blue'
        else if (count >= threshold)  status = 'red'
        else if (count >= threshold * 0.5) status = 'yellow'
        else                          status = 'green'

        newPressure[orchardId] = {
          orchard_id:     orchardId,
          latest_count:   count ?? 0,
          threshold,
          last_inspected: inspection.inspected_at,
          status,
        }
      })

      setPressure(newPressure)
      setLoadingPressure(false)
    }

    loadPressure()
  }, [selectedPest, season, selectedWeek, orchards])

  // Init Leaflet
  useEffect(() => {
    if (mapReady) return
    async function initMap() {
       console.log('initMap called, mapRef:', mapRef.current)
      const L = (await import('leaflet')).default
      console.log('Leaflet loaded:', L)
      leafletRef.current = L
      if (mapRef.current && !mapRef.current._leaflet_id) {
        console.log('Creating map...')
        const map = L.map(mapRef.current, { center: [-32.785, 18.715], zoom: 13 })
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '© Esri', maxZoom: 19,
        }).addTo(map)
        mapRef.current._map = map
        setMapReady(true)
      }
    }
    initMap()
  }, [])

  // Redraw polygons when pressure changes
  useEffect(() => {
    if (!mapReady || orchards.length === 0) return

    async function drawPolygons() {
      console.log('drawPolygons called, orchards:', orchards.length)
      const L = leafletRef.current
      const map = mapRef.current._map
      if (geoLayerRef.current) geoLayerRef.current.remove()

      const res = await fetch('/OrchardPolygons.geojson')
      console.log('GeoJSON fetch status:', res.status)
      const geojson = await res.json()

      const lookup: Record<number, OrchardInfo> = {}
      orchards.forEach(o => { if (o.legacy_id) lookup[o.legacy_id] = o })

      const layer = L.geoJSON(geojson, {
        style: (feature: any) => {
          const oid  = parseInt(feature.properties.OrchardID?.toString().replace(/"/g, '') || '0')
          const info = lookup[oid]
          if (!info) return { fillColor: '#000', fillOpacity: 0, color: '#000', weight: 0, opacity: 0 }
          const p = pressure[info.id]
          const color = p ? STATUS_COLORS[p.status].fill : STATUS_COLORS.grey.fill
          return { fillColor: color, fillOpacity: 0.7, color: '#fff', weight: 1.5 }
        },
        onEachFeature: (feature: any, lyr: any) => {
          const oid  = parseInt(feature.properties.OrchardID?.toString().replace(/"/g, '') || '0')
          const info = lookup[oid]
          const p    = info ? pressure[info.id] : null

          lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.95, weight: 2.5 }))
          lyr.on('mouseout',  () => lyr.setStyle({ fillOpacity: 0.7,  weight: 1.5 }))
          lyr.on('click', () => {
            setSelected(info ? {
              name:           info.name,
              variety:        info.variety,
              commodity:      (info.commodities as any)?.name || '—',
              ha:             info.ha,
              legacy_id:      info.legacy_id,
              status:         p?.status || 'grey',
              latest_count:   p?.latest_count ?? null,
              threshold:      p?.threshold ?? null,
              last_inspected: p?.last_inspected || null,
            } : null)
          })

          const label = info?.name || feature.properties.name || `ID ${oid}`
          lyr.bindTooltip(label, { permanent: false, direction: 'center', className: 'orchard-tooltip' })
        },
      }).addTo(map)

      geoLayerRef.current = layer
      if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [20, 20] })
    }

    drawPolygons()
  }, [mapReady, orchards, pressure])

  const formatDate = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days} days ago`
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f1eb; }
        .app { display: flex; min-height: 100vh; }
        .sidebar {
          width: 220px; min-height: 100vh; background: #1c3a2a;
          padding: 32px 20px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
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
          padding: 12px 24px; background: #fff; border-bottom: 1px solid #e8e4dc;
          display: flex; align-items: center; gap: 16px; flex-shrink: 0; flex-wrap: wrap;
        }
        .page-title { font-family: 'DM Serif Display', serif; font-size: 20px; color: #1c3a2a; flex-shrink: 0; margin-right: 4px; }
        .divider { width: 1px; height: 24px; background: #e8e4dc; flex-shrink: 0; }
        .filter-group { display: flex; align-items: center; gap: 8px; }
        .filter-label { font-size: 11px; color: #9aaa9f; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; flex-shrink: 0; }
        .filter-pills { display: flex; gap: 5px; flex-wrap: wrap; }
        .pill {
          padding: 5px 12px; border-radius: 20px; border: 1.5px solid #e0ddd6;
          background: #fff; color: #6a7a70; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif;
        }
        .pill:hover { border-color: #2a6e45; color: #2a6e45; }
        .pill.active { background: #1c3a2a; color: #a8d5a2; border-color: #1c3a2a; }

        .week-select {
          padding: 5px 10px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
          color: #1c3a2a; background: #fff; cursor: pointer; outline: none;
        }
        .week-select:focus { border-color: #2a6e45; }

        .loading-bar { height: 3px; background: linear-gradient(90deg, #2a6e45, #a8d5a2); animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        .map-container { flex: 1; position: relative; min-height: 600px; }
        #map { width: 100%; height: 100%; min-height: 600px; }

        .info-panel {
          position: absolute; top: 16px; right: 16px; width: 240px;
          background: #fff; border-radius: 12px; border: 1px solid #e8e4dc;
          padding: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); z-index: 1000;
        }
        .info-title { font-family: 'DM Serif Display', serif; font-size: 16px; color: #1c3a2a; margin-bottom: 3px; }
        .info-sub { font-size: 12px; color: #9aaa9f; margin-bottom: 12px; }
        .status-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f4f1eb; font-size: 13px; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #9aaa9f; }
        .info-value { font-weight: 500; color: #1c3a2a; }

        .legend {
          position: absolute; bottom: 32px; left: 16px; background: #fff;
          border-radius: 10px; border: 1px solid #e8e4dc; padding: 14px 16px;
          z-index: 1000; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .legend-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #9aaa9f; margin-bottom: 10px; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #3a4a40; margin-bottom: 6px; }
        .legend-item:last-child { margin-bottom: 0; }
        .legend-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }

        .week-indicator {
          position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
          background: rgba(28,58,42,0.85); color: #a8d5a2; padding: 8px 18px;
          border-radius: 20px; font-size: 13px; font-weight: 600; z-index: 1000;
          font-family: 'DM Sans', sans-serif; backdrop-filter: blur(4px);
        }

        .placeholder { color: #9aaa9f; font-size: 13px; font-style: italic; text-align: center; padding-top: 8px; }
        .orchard-tooltip {
          background: #1c3a2a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-family: 'DM Sans', sans-serif !important;
          font-size: 12px !important; font-weight: 500 !important; padding: 4px 10px !important;
        }
        .orchard-tooltip::before { display: none !important; }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item active"><span>🌳</span> Orchards</a>
          <a className="nav-item"><span>🐛</span> Pests</a>
          <a className="nav-item"><span>🪤</span> Traps</a>
          <a className="nav-item"><span>🔍</span> Inspections</a>
          <a className="nav-item"><span>👷</span> Scouts</a>
           <div className="sidebar-footer">
            Mouton's Valley Group<br />
            <span style={{ color: '#2a6e45' }}>●</span> Connected
            <br />
            <button onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }} style={{
              marginTop: 10, background: 'none', border: '1px solid #2a4f38',
              color: '#6aaa80', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
            }}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="main">
          <div className="top-bar">
            <div className="page-title">Orchard Map</div>
            <div className="divider" />

            {/* Season */}
            <div className="filter-group">
              <span className="filter-label">Season</span>
              <div className="filter-pills">
                {seasons.map(s => (
                  <button key={s} className={`pill${season === s ? ' active' : ''}`}
                    onClick={() => { setSeason(s); setSelectedWeek(currentWeekNr()) }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider" />

             {/* Week */}
            <div className="filter-group">
              <span className="filter-label">Week {selectedWeek}</span>
              <input
                type="range"
                min={0}
                max={weeks.length - 1}
                value={weeks.indexOf(selectedWeek)}
                onChange={e => setSelectedWeek(weeks[parseInt(e.target.value)])}
                style={{
                  width: 160,
                  accentColor: '#2a6e45',
                  cursor: 'pointer',
                }}
              />
            </div>

            <div className="divider" />

            {/* Pest */}
            <div className="filter-group">
              <span className="filter-label">Pest</span>
              <div className="filter-pills">
                {pests.map(p => (
                  <button key={p.id} className={`pill${selectedPest?.id === p.id ? ' active' : ''}`}
                    onClick={() => setSelectedPest(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingPressure && <div className="loading-bar" />}

          <div className="map-container">
            <div id="map" ref={mapRef} />

            {/* Info panel */}
            <div className="info-panel">
              {selected ? (
                <>
                  <div className="info-title">{selected.name}</div>
                  <div className="info-sub">{selected.variety || selected.commodity}</div>
                  <div className="status-badge" style={{
                    background: STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS]?.fill + '22',
                    color:      STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS]?.fill,
                  }}>
                    <div className="status-dot" style={{ background: STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS]?.fill }} />
                    {STATUS_COLORS[selected.status as keyof typeof STATUS_COLORS]?.label}
                  </div>
                  <div className="info-row">
                    <span className="info-label">Count (W{selectedWeek})</span>
                    <span className="info-value">{selected.latest_count !== null ? selected.latest_count : '—'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Threshold</span>
                    <span className="info-value">{selected.threshold !== null ? selected.threshold : 'Not set'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Inspected</span>
                    <span className="info-value">{selected.last_inspected ? formatDate(selected.last_inspected) : '—'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Hectares</span>
                    <span className="info-value">{selected.ha ? `${selected.ha} ha` : '—'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="info-title" style={{ marginBottom: 8 }}>
                    {selectedPest ? selectedPest.name : 'Select a pest'}
                  </div>
                  <div className="info-sub">Season {season} · Week {selectedWeek}</div>
                  <div className="placeholder">Click an orchard polygon to see trap details</div>
                </>
              )}
            </div>

            {/* Week indicator */}
            <div className="week-indicator">
              {season} · Week {selectedWeek} · {selectedPest?.name || '—'}
            </div>

            {/* Legend */}
            <div className="legend">
              <div className="legend-title">Trap Pressure</div>
              {Object.entries(STATUS_COLORS).map(([key, val]) => (
                <div className="legend-item" key={key}>
                  <div className="legend-dot" style={{ background: val.fill }} />
                  {val.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

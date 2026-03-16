'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState, useRef, useCallback, createRef } from 'react'
import type { SeasonTotal } from './AppliedVsDemandChart'
import type { WaterBalanceRow } from './WaterBalanceTable'

const STATUS_COLORS: Record<string, { fill: string; label: string }> = {
  critical: { fill: '#e85a4a', label: 'Needs Water' },
  warning:  { fill: '#f5c842', label: 'Watch' },
  ok:       { fill: '#4caf72', label: 'OK' },
  grey:     { fill: '#aaaaaa', label: 'No data' },
}

interface Props {
  seasonTotals: SeasonTotal[]
  summary: WaterBalanceRow[]
  loading?: boolean
  selectedOrchardId: string | null
  onSelectOrchard: (id: string | null) => void
}

export default function IrrigationMapPanel({ seasonTotals, summary, loading, selectedOrchardId, onSelectOrchard }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const boundaryCache = useRef<any[] | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const selectedId = selectedOrchardId
  const setSelectedId = onSelectOrchard
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  // Build status lookup from summary
  const statusMapRef = useRef<Record<string, string>>({})
  statusMapRef.current = {}
  summary.forEach(r => { statusMapRef.current[r.orchard_id] = r.stress_risk })

  // Orchard IDs we have data for
  const orchardIdSet = new Set([
    ...seasonTotals.map(r => r.orchard_id),
    ...summary.map(r => r.orchard_id),
  ])
  const orchardCount = orchardIdSet.size

  // Init Leaflet map — re-check when data arrives (map div may not exist on first render)
  const hasData = seasonTotals.length > 0 || summary.length > 0
  useEffect(() => {
    if (mapReady || !hasData || !mapContainerRef.current) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapContainerRef.current) return
      leafletRef.current = L

      // Western Cape default view
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        maxZoom: 19,
        center: [-33.9, 19.1],
        zoom: 12,
      })
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 18 }
      ).addTo(map)
      mapInstanceRef.current = map
      setTimeout(() => map.invalidateSize(), 300)
      setMapReady(true)
    })()
    return () => { cancelled = true }
  }, [hasData])

  // Draw / redraw polygons
  const drawPolygons = useCallback(async () => {
    const L = leafletRef.current
    const map = mapInstanceRef.current
    if (!L || !map) return

    if (geoLayerRef.current) geoLayerRef.current.remove()

    // Fetch boundaries once, then cache
    if (!boundaryCache.current) {
      const supabase = createClient()
      const { data } = await supabase.rpc('get_orchard_boundaries')
      boundaryCache.current = data || []
    }
    if (!boundaryCache.current!.length) return

    const myBoundaries = boundaryCache.current!.filter((o: any) => orchardIdSet.has(o.id))
    if (!myBoundaries.length) return

    const statusMap = statusMapRef.current
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
          const status = statusMap[f.properties.id] || 'grey'
          const color = STATUS_COLORS[status]?.fill || '#aaa'
          const sel = f.properties.id === selectedId
          return {
            fillColor: color,
            fillOpacity: sel ? 0.95 : 0.7,
            color: '#fff',
            weight: sel ? 3 : 1.5,
          }
        },
        onEachFeature: (f: any, lyr: any) => {
          const id = f.properties.id
          lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.88 }))
          lyr.on('mouseout', () => lyr.setStyle({ fillOpacity: 0.7 }))
          lyr.on('click', () => {
            const newId = selectedId === id ? null : id
            setSelectedId(newId)
            if (newId) map.fitBounds(lyr.getBounds(), { padding: [60, 60], maxZoom: 17 })
          })
          lyr.bindTooltip(f.properties.name || '', {
            permanent: false,
            className: 'irr-map-tooltip',
          })
        },
      }
    ).addTo(map)
    geoLayerRef.current = layer
    if (layer.getBounds().isValid() && !selectedId) {
      map.fitBounds(layer.getBounds(), { padding: [16, 16] })
    }
  }, [orchardCount, summary, selectedId])

  useEffect(() => {
    if (mapReady && orchardCount > 0) drawPolygons()
  }, [mapReady, drawPolygons])

  // Scroll selected row into view
  useEffect(() => {
    if (selectedId && rowRefs.current[selectedId]) {
      rowRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedId])

  // Zoom map to selected orchard from table click
  const selectFromTable = useCallback((orchardId: string) => {
    const newId = selectedId === orchardId ? null : orchardId
    setSelectedId(newId)
    if (newId && geoLayerRef.current && mapInstanceRef.current) {
      geoLayerRef.current.eachLayer((lyr: any) => {
        if (lyr.feature?.properties?.id === newId) {
          mapInstanceRef.current.fitBounds(lyr.getBounds(), { padding: [60, 60], maxZoom: 17 })
        }
      })
    }
  }, [selectedId, setSelectedId])

  // Sorted table rows (Needs Water first, then by shortfall)
  const tableRows = [...seasonTotals].sort((a, b) => {
    const sa = statusMapRef.current[a.orchard_id] || 'ok'
    const sb = statusMapRef.current[b.orchard_id] || 'ok'
    const order: Record<string, number> = { critical: 0, warning: 1, ok: 2 }
    const cmp = (order[sa] ?? 2) - (order[sb] ?? 2)
    if (cmp !== 0) return cmp
    return (b.season_need_cubes_per_ha - b.season_cubes_per_ha) - (a.season_need_cubes_per_ha - a.season_cubes_per_ha)
  })

  if (!hasData) {
    if (loading) {
      return (
        <div style={s.card}>
          <div style={s.cardHeader}>Irrigation Overview</div>
          <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading...</div>
        </div>
      )
    }
    return null
  }

  return (
    <>
      <style>{`
        .irr-map-tooltip {
          background: #1a4ba0 !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .irr-map-tooltip::before { display: none !important; }
        .irr-panel-tr:hover td { background: #f9f7f3; }
        .irr-panel-tr-sel td { background: #f0f4fa; }
        @media (max-width: 768px) {
          .irr-panel-body { flex-direction: column !important; height: auto !important; }
          .irr-panel-map { flex: none !important; height: 50vh !important; width: 100% !important; }
          .irr-panel-table { flex: none !important; width: 100% !important; border-left: none !important; border-top: 1px solid #e8e4dc; max-height: 320px; }
        }
      `}</style>

      <div style={s.card}>
        <div style={s.cardHeader}>Irrigation Overview</div>
        <div className="irr-panel-body" style={{ display: 'flex', height: 440 }}>
          {/* Map */}
          <div className="irr-panel-map" style={{ flex: '0 0 55%', position: 'relative' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            {/* Legend */}
            <div style={{
              position: 'absolute', bottom: 16, left: 12, background: 'rgba(255,255,255,0.95)',
              borderRadius: 8, border: '1px solid #e8e4dc', padding: '10px 14px', zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#8a95a0', marginBottom: 7 }}>Status</div>
              {Object.entries(STATUS_COLORS).filter(([k]) => k !== 'grey').map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#3a4a40', marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: v.fill, flexShrink: 0 }} />
                  {v.label}
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="irr-panel-table" style={{ flex: '0 0 45%', borderLeft: '1px solid #e8e4dc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a' }}>Season to Date</span>
              <span style={{ fontSize: 12, color: '#8a95a0', marginLeft: 'auto' }}>{tableRows.length} orchards</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.th}>Orchard</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Given</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Need</th>
                    <th style={{ ...s.th, textAlign: 'center', width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(row => {
                    const status = statusMapRef.current[row.orchard_id] || 'ok'
                    const sc = STATUS_COLORS[status] || STATUS_COLORS.ok
                    const given = row.season_cubes_per_ha ?? 0
                    const need = row.season_need_cubes_per_ha ?? 0
                    const sel = selectedId === row.orchard_id
                    const label = row.orchard_nr != null
                      ? `${row.orchard_nr} ${row.orchard_name}`
                      : row.orchard_name
                    const subtitle = row.variety || ''
                    return (
                      <tr
                        key={row.orchard_id}
                        ref={el => { rowRefs.current[row.orchard_id] = el }}
                        className={`irr-panel-tr${sel ? ' irr-panel-tr-sel' : ''}`}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f5f3ef' }}
                        onClick={() => selectFromTable(row.orchard_id)}
                      >
                        <td style={s.tdName}>
                          <div style={{ fontWeight: 500, color: '#1a2a3a', fontSize: 13, lineHeight: 1.2 }}>{label}</div>
                          {subtitle && <div style={{ fontSize: 11, color: '#8a95a0', lineHeight: 1.2 }}>{subtitle}</div>}
                        </td>
                        <td style={{ ...s.tdNum, color: '#2176d9', fontWeight: 600 }}>
                          {given > 0 ? Math.round(given).toLocaleString() : '—'}
                        </td>
                        <td style={s.tdNum}>
                          {need > 0 ? Math.round(need).toLocaleString() : '—'}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block', width: 10, height: 10,
                            borderRadius: 3, background: sc.fill,
                          }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e8e4dc',
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1a2a3a',
    padding: '16px 20px 12px',
    borderBottom: '1px solid #f0ede8',
  },
  th: {
    position: 'sticky' as const,
    top: 0,
    background: '#f9f7f3',
    textAlign: 'left' as const,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    color: '#8a95a0',
    fontWeight: 700,
    padding: '8px 10px',
    borderBottom: '1px solid #eef2fa',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '8px 10px',
    color: '#1a2a3a',
    whiteSpace: 'nowrap' as const,
  },
  tdName: {
    padding: '8px 10px',
    whiteSpace: 'nowrap' as const,
  },
  tdNum: {
    padding: '8px 10px',
    color: '#1a2a3a',
    textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap' as const,
    fontSize: 13,
  },
}

'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState, useRef } from 'react'

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
  if (lwSev === 0) return <span style={{ fontSize: 12, color: '#9aaa9f' }}>—</span>
  const pct = Math.round(((twSev - lwSev) / lwSev) * 100)
  if (pct === 0) return <span style={{ fontSize: 12, color: '#9aaa9f' }}>—</span>
  if (pct > 0) return <span style={{ fontSize: 12, color: '#e8924a', fontWeight: 600 }}>↑ {pct}%</span>
  return <span style={{ fontSize: 12, color: '#4caf72', fontWeight: 600 }}>↓ {Math.abs(pct)}%</span>
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

export default function TreeScoutingAlertSummary({ farmIds }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<TreePestRow[]>([])
  const [loading, setLoading] = useState(() => farmIds.length > 0)
  const [expanded, setExpanded] = useState(false)

  // Map state
  const [selectedPestId, setSelectedPestId] = useState<string | null>(null)
  const [orchardPressure, setOrchardPressure] = useState<Record<string, { status: string; severity: number }>>({})
  const [mapReady, setMapReady] = useState(false)

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

  // ── Auto-select first pest on expand ────────────────────────────────
  useEffect(() => {
    if (expanded && rows.length > 0 && !selectedPestId) {
      setSelectedPestId(rows[0].pest_id)
    }
  }, [expanded, rows.length])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch per-orchard severity when pest selected ───────────────────
  useEffect(() => {
    if (!selectedPestId || farmIds.length === 0) return
    supabase.rpc('get_tree_orchard_severity', { p_farm_ids: farmIds, p_pest_id: selectedPestId })
      .then(({ data, error }) => {
        if (error) console.error('get_tree_orchard_severity error:', JSON.stringify(error))
        const pressureMap: Record<string, { status: string; severity: number }> = {}
        ;(data || []).forEach((r: any) => {
          pressureMap[r.orchard_id] = { status: r.status, severity: Number(r.severity) }
        })
        setOrchardPressure(pressureMap)
      })
  }, [selectedPestId, farmIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init / destroy map on expand / collapse ─────────────────────────
  useEffect(() => {
    if (!expanded) return
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
  }, [expanded])

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
            return { fillColor: color, fillOpacity: 0.7, color: '#fff', weight: 1.5 }
          },
          onEachFeature: (f: any, lyr: any) => {
            const id = f.properties.id
            const name = orchardLookup[id] || f.properties.name || ''
            const p = pressure[id]
            const tooltipText = p
              ? `${name} · ${formatSeverity(p.severity, method)}`
              : name
            lyr.bindTooltip(tooltipText, { permanent: false, className: 'tsa-tooltip' })
            lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.9 }))
            lyr.on('mouseout', () => lyr.setStyle({ fillOpacity: 0.7 }))
          },
        },
      ).addTo(map)

      geoLayerRef.current = layer
      if (layer.getBounds().isValid() && !hasInitialBoundsRef.current) {
        map.fitBounds(layer.getBounds(), { padding: [16, 16] })
        hasInitialBoundsRef.current = true
      }
    })()
  }, [mapReady, orchardPressure])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes tsa-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a', marginBottom: 12 }}>Tree Scouting This Week</div>
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
          background: #1c3a2a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .tsa-tooltip::before { display: none !important; }
        @media (max-width: 768px) {
          .tsa-body { flex-direction: column !important; height: auto !important; }
          .tsa-pest-list { max-height: none !important; border-right: none !important; border-bottom: none !important; }
          .tsa-pest-item { min-height: 44px !important; padding: 14px 16px !important; }
          .tsa-map-panel { display: none !important; }
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
          onClick={() => setExpanded(e => !e)}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a' }}>Tree Scouting This Week</div>
            <div style={{ fontSize: 12, color: '#9aaa9f', marginTop: 3 }}>
              {expanded
                ? 'Click a pest to see orchard severity on the map'
                : `${rows.length} pest${rows.length !== 1 ? 's' : ''} observed · ${alertCount} with alerts`}
            </div>
          </div>
          <span style={{
            fontSize: 13, color: '#7a8a80', transition: 'transform 0.2s',
            display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>▼</span>
        </div>

        {/* Body: pest list + map */}
        {expanded && (
          <div className="tsa-body" style={{ display: 'flex', height: 660 }}>
            {/* Left: pest list */}
            <div className="tsa-pest-list" style={{ flex: '0 0 35%', overflowY: 'auto', borderRight: '1px solid #e8e4dc' }}>
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
                    onClick={() => setSelectedPestId(row.pest_id)}
                    style={{
                      borderLeft: `4px solid ${borderColor}`,
                      padding: '12px 16px',
                      borderBottom: '1px solid #f9f7f3',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f7f2' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>{row.pest_name}</span>
                      <span style={{ fontSize: 11, color: '#9aaa9f', fontWeight: 500 }}>
                        {METHOD_LABELS[method] || method}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>
                        {formatSeverity(twSev, method)}
                      </span>
                      {trendBadge(twSev, lwSev)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: map */}
            <div className="tsa-map-panel" style={{ flex: '0 0 65%', position: 'relative' }}>
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
                  letterSpacing: '0.8px', color: '#9aaa9f', marginBottom: 5,
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
          </div>
        )}
      </div>
    </>
  )
}

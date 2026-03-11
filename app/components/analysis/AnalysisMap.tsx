'use client'

import { useEffect, useRef, useState } from 'react'

const STATUS_COLORS: Record<string, { fill: string; label: string }> = {
  green:  { fill: '#4caf72', label: 'Below threshold' },
  yellow: { fill: '#f5c842', label: 'Approaching' },
  red:    { fill: '#e85a4a', label: 'Above threshold' },
  blue:   { fill: '#6b7fa8', label: 'No threshold' },
  grey:   { fill: '#aaaaaa', label: 'No data' },
}

function tonHaColor(v: number | null): string {
  if (v == null) return '#aaa'
  if (v >= 50) return '#2176d9'
  if (v >= 30) return '#4caf72'
  if (v >= 15) return '#f5c842'
  return '#e85a4a'
}

export type ColorMode = 'commodity' | 'variety' | 'tonha' | 'pest'

export interface OrchardMapData {
  id: string
  name: string
  commodityId: string
  variety: string | null
  tonHa: number | null
  pestStatus: string
}

interface Props {
  orchards: OrchardMapData[]
  boundaries: any[]
  colorMode: ColorMode
  commodityColors: Record<string, string>
  varietyColors: Record<string, string>
  selectedOrchardId: string | null
  onOrchardSelect: (id: string | null) => void
}

const TONHA_LEGEND = [
  { color: '#2176d9', label: '≥ 50 t/ha' },
  { color: '#4caf72', label: '30–49' },
  { color: '#f5c842', label: '15–29' },
  { color: '#e85a4a', label: '< 15' },
  { color: '#aaa', label: 'No data' },
]

export default function AnalysisMap({
  orchards, boundaries, colorMode, commodityColors, varietyColors,
  selectedOrchardId, onOrchardSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)

  function getColor(o: OrchardMapData): string {
    switch (colorMode) {
      case 'commodity': return commodityColors[o.commodityId] || '#aaa'
      case 'variety': return varietyColors[o.variety || ''] || '#aaa'
      case 'tonha': return tonHaColor(o.tonHa)
      case 'pest': return STATUS_COLORS[o.pestStatus]?.fill || '#aaa'
    }
  }

  // Init map
  useEffect(() => {
    if (mapReady || !containerRef.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      leafletRef.current = L
      if (!(containerRef.current as any)._leaflet_id) {
        const map = L.map(containerRef.current!, {
          zoomControl: true, attributionControl: false,
          scrollWheelZoom: true, maxZoom: 19,
        })
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19, maxNativeZoom: 18 }
        ).addTo(map)
        mapInstanceRef.current = map
        setMapReady(true)
      }
    })()
  }, [])

  // Draw polygons
  useEffect(() => {
    if (!mapReady || boundaries.length === 0) return
    const L = leafletRef.current
    const map = mapInstanceRef.current
    if (geoLayerRef.current) geoLayerRef.current.remove()

    const lookup: Record<string, OrchardMapData> = {}
    orchards.forEach(o => { lookup[o.id] = o })
    const myBoundaries = boundaries.filter((b: any) => lookup[b.id])
    if (!myBoundaries.length) return

    const features = myBoundaries.map((b: any) => ({
      type: 'Feature' as const,
      properties: { id: b.id, name: b.name },
      geometry: b.boundary,
    }))

    const layer = L.geoJSON({ type: 'FeatureCollection', features }, {
      style: (f: any) => {
        const o = lookup[f.properties.id]
        const color = o ? getColor(o) : '#aaa'
        const sel = f.properties.id === selectedOrchardId
        return { fillColor: color, fillOpacity: sel ? 0.95 : 0.7, color: '#fff', weight: sel ? 3 : 1.5 }
      },
      onEachFeature: (f: any, lyr: any) => {
        const id = f.properties.id
        lyr.on('mouseover', () => { if (id !== selectedOrchardId) lyr.setStyle({ fillOpacity: 0.88 }) })
        lyr.on('mouseout', () => { if (id !== selectedOrchardId) lyr.setStyle({ fillOpacity: 0.7 }) })
        lyr.on('click', () => {
          onOrchardSelect(selectedOrchardId === id ? null : id)
          map.fitBounds(lyr.getBounds(), { padding: [60, 60], maxZoom: 17 })
        })
        const o = lookup[id]
        let tip = o?.name || f.properties.name || ''
        if (colorMode === 'tonha' && o?.tonHa != null) tip += ` · ${o.tonHa} t/ha`
        lyr.bindTooltip(tip, { permanent: false, className: 'oa-tooltip' })
      },
    }).addTo(map)

    geoLayerRef.current = layer
    if (layer.getBounds().isValid() && !selectedOrchardId) {
      map.fitBounds(layer.getBounds(), { padding: [16, 16] })
    }
  }, [mapReady, boundaries, orchards, colorMode, selectedOrchardId])

  // Build legend entries based on color mode
  const legendEntries = (() => {
    switch (colorMode) {
      case 'commodity': {
        const seen = new Set<string>()
        return orchards.filter(o => { if (seen.has(o.commodityId)) return false; seen.add(o.commodityId); return true })
          .map(o => ({ color: commodityColors[o.commodityId] || '#aaa', label: o.commodityId }))
          // We'll pass commodity names from parent — for now use id as label
      }
      case 'variety': {
        const seen = new Set<string>()
        return orchards.filter(o => { const k = o.variety || ''; if (seen.has(k)) return false; seen.add(k); return true })
          .slice(0, 10)
          .map(o => ({ color: varietyColors[o.variety || ''] || '#aaa', label: o.variety || 'Unknown' }))
      }
      case 'tonha':
        return TONHA_LEGEND
      case 'pest':
        return Object.entries(STATUS_COLORS).map(([, v]) => ({ color: v.fill, label: v.label }))
    }
  })()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <style>{`
        .oa-tooltip {
          background: #1a4ba0 !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .oa-tooltip::before { display: none !important; }
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, background: 'rgba(255,255,255,0.92)',
        borderRadius: 8, padding: '8px 12px', fontSize: 11, lineHeight: '18px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 1000, maxWidth: 180,
      }}>
        {legendEntries.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: e.color, flexShrink: 0 }} />
            <span style={{ color: '#3a4a40' }}>{e.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; name: string }

type AlertLevel = 'no_data' | 'critical' | 'warning' | 'ok' | 'dormant'

interface AlertRow {
  orchard_id: string
  orchard_name: string
  orchard_nr: number | null
  variety: string | null
  variety_group: string | null
  commodity_code: string
  ha: number | null
  total_etc_mm: number
  total_applied_mm: number
  total_rainfall_mm: number
  net_deficit_mm: number
  available_water_mm: number
  kc_current: number
  stress_risk: AlertLevel
  last_irrigation_date: string | null
  days_since_irrigation: number | null
  season_volume_m3: number
  season_cubes_per_ha: number | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AlertLevel, { label: string; bg: string; text: string; border: string; fill: string }> = {
  no_data:  { label: 'Not Irrigated', bg: '#f3e5f5', text: '#7b1fa2', border: '#9c27b0', fill: '#9c27b0' },
  critical: { label: 'Needs Water',   bg: '#fce4ec', text: '#c0392b', border: '#e85a4a', fill: '#e85a4a' },
  warning:  { label: 'Watch',         bg: '#fff8e1', text: '#e67e22', border: '#f5c842', fill: '#f5c842' },
  ok:       { label: 'OK',            bg: '#e8f5e9', text: '#2e7d32', border: '#4caf72', fill: '#4caf72' },
  dormant:  { label: 'Dormant',       bg: '#f5f5f5', text: '#757575', border: '#aaaaaa', fill: '#aaaaaa' },
}

const ALERT_ORDER: Record<AlertLevel, number> = { no_data: 0, critical: 1, warning: 2, ok: 3, dormant: 4 }

function mmToCubes(mm: number): number {
  return Math.round(mm * 10 * 10) / 10
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IrrigationIntelligencePage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [farms, setFarms] = useState<Farm[]>([])
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null)
  const [days, setDays] = useState(14)
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showDormant, setShowDormant] = useState(false)
  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)

  // Load farms
  useEffect(() => {
    if (!contextLoaded) return
    const supabase = createClient()
    async function load() {
      if (farmIds.length === 0 && isSuperAdmin) {
        const { data } = await supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('code')
        const f = (data || []).map(d => ({ id: d.id, code: d.code, name: d.full_name }))
        setFarms(f)
        setEffectiveFarmIds(f.map(d => d.id))
      } else {
        const { data } = await supabase.from('farms').select('id, code, full_name').in('id', farmIds).order('code')
        const f = (data || []).map(d => ({ id: d.id, code: d.code, name: d.full_name }))
        setFarms(f)
        setEffectiveFarmIds(farmIds)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin])

  const activeFarmIds = useMemo(() => {
    if (selectedFarm) return [selectedFarm]
    return effectiveFarmIds
  }, [selectedFarm, effectiveFarmIds])

  // Fetch alerts
  useEffect(() => {
    if (activeFarmIds.length === 0) return
    setLoading(true)

    const params = new URLSearchParams({ farm_ids: activeFarmIds.join(','), days: String(days) })
    fetch(`/api/irrigation/alerts?${params}`)
      .then(r => r.json())
      .then(data => setAlerts(data.alerts || []))
      .catch(err => console.error('Irrigation alerts fetch error:', err))
      .finally(() => setLoading(false))
  }, [activeFarmIds, days])

  // Counts
  const counts = useMemo(() => {
    const c = { no_data: 0, critical: 0, warning: 0, ok: 0, dormant: 0, total: alerts.length }
    for (const a of alerts) c[a.stress_risk] = (c[a.stress_risk] || 0) + 1
    return c
  }, [alerts])

  // Filtered + sorted rows
  const visibleRows = useMemo(() => {
    let rows = showDormant ? alerts : alerts.filter(a => a.stress_risk !== 'dormant')
    return [...rows].sort((a, b) => {
      const cmp = ALERT_ORDER[a.stress_risk] - ALERT_ORDER[b.stress_risk]
      if (cmp !== 0) return cmp
      return (b.net_deficit_mm ?? 0) - (a.net_deficit_mm ?? 0)
    })
  }, [alerts, showDormant])

  // Urgent orchards for alert banner
  const urgentOrchards = useMemo(() =>
    alerts.filter(a => a.stress_risk === 'no_data' || a.stress_risk === 'critical'),
    [alerts]
  )

  if (!contextLoaded) return null

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        @media (max-width: 768px) {
          .intel-main { padding: 16px !important; padding-bottom: 80px !important; }
          .intel-kpi-strip { grid-template-columns: repeat(2, 1fr) !important; }
          .intel-map-wrap { height: 300px !important; }
        }
        .intel-tr:hover td { background: #f9f7f3; }
        .intel-tr-sel td { background: #f0f4fa !important; }
      `}</style>

      <div style={s.page}>
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
        <main style={s.main} className="intel-main">
          {/* Header */}
          <div style={s.pageHeader}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a href="/irrigation" style={s.backLink}>&larr; Irrigation</a>
              </div>
              <h1 style={s.pageTitle}>Irrigation Intelligence</h1>
              <div style={s.pageSub}>
                Real-time stress risk classification across all orchards
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={s.controls}>
            <div style={s.filterGroup}>
              <button
                style={selectedFarm === null ? s.pillActive : s.pill}
                onClick={() => setSelectedFarm(null)}
              >All Farms</button>
              {farms.map(f => (
                <button
                  key={f.id}
                  style={selectedFarm === f.id ? s.pillActive : s.pill}
                  onClick={() => setSelectedFarm(f.id)}
                >{f.code}</button>
              ))}
            </div>
            <div style={s.divider} />
            <select
              style={s.select}
              value={days}
              onChange={e => setDays(parseInt(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#8a95a0' }}>Loading intelligence data...</div>
          ) : (
            <>
              {/* KPI Strip */}
              <div style={s.kpiStrip} className="intel-kpi-strip">
                <KpiCard
                  label="Not Irrigated"
                  value={counts.no_data}
                  accent="linear-gradient(90deg, #9c27b0, #ce93d8)"
                  color={counts.no_data > 0 ? '#7b1fa2' : '#4caf72'}
                  suffix={`/ ${counts.total - counts.dormant}`}
                />
                <KpiCard
                  label="Needs Water"
                  value={counts.critical}
                  accent="linear-gradient(90deg, #e85a4a, #ef9a9a)"
                  color={counts.critical > 0 ? '#c0392b' : '#4caf72'}
                  suffix={`/ ${counts.total - counts.dormant}`}
                />
                <KpiCard
                  label="Watch"
                  value={counts.warning}
                  accent="linear-gradient(90deg, #f5c842, #ffe082)"
                  color={counts.warning > 0 ? '#e67e22' : '#4caf72'}
                  suffix={`/ ${counts.total - counts.dormant}`}
                />
                <KpiCard
                  label="OK"
                  value={counts.ok}
                  accent="linear-gradient(90deg, #4caf72, #a5d6a7)"
                  color="#2e7d32"
                  suffix={`/ ${counts.total - counts.dormant}`}
                />
                <KpiCard
                  label="Dormant"
                  value={counts.dormant}
                  accent="linear-gradient(90deg, #aaaaaa, #d4d4d4)"
                  color="#757575"
                />
              </div>

              {/* Alert Banner */}
              {urgentOrchards.length > 0 && (
                <AlertBanner orchards={urgentOrchards} onSelect={setSelectedOrchardId} />
              )}

              {/* Map */}
              <AlertMap
                alerts={alerts}
                selectedOrchardId={selectedOrchardId}
                onSelectOrchard={setSelectedOrchardId}
              />

              {/* Table */}
              <div style={s.card}>
                <div style={s.cardHeaderRow}>
                  <div style={s.cardHeader}>Orchard Status</div>
                  <label style={s.dormantToggle}>
                    <input
                      type="checkbox"
                      checked={showDormant}
                      onChange={e => setShowDormant(e.target.checked)}
                      style={{ marginRight: 6 }}
                    />
                    Show dormant
                  </label>
                </div>
                <AlertTable
                  rows={visibleRows}
                  selectedId={selectedOrchardId}
                  onSelect={setSelectedOrchardId}
                />
              </div>
            </>
          )}
        </main>
        <MobileNav modules={modules} />
      </div>
    </>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent, color, suffix }: {
  label: string; value: number; accent: string; color: string; suffix?: string
}) {
  return (
    <div style={s.kpiCard}>
      <div style={{ ...s.kpiAccent, background: accent }} />
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiValue, color }}>
        {value}
        {suffix && <span style={{ fontSize: 14, color: '#8a95a0', fontWeight: 400, marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  )
}

// ── Alert Banner ──────────────────────────────────────────────────────────────

function AlertBanner({ orchards, onSelect }: { orchards: AlertRow[]; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const noData = orchards.filter(o => o.stress_risk === 'no_data')
  const critical = orchards.filter(o => o.stress_risk === 'critical')

  const PREVIEW_LIMIT = 5

  return (
    <div style={s.alertBanner}>
      <div style={s.alertBannerAccent} />
      <div style={s.alertBannerContent}>
        <div style={s.alertBannerHeader}>
          <span style={s.alertBannerIcon}>!</span>
          <span style={s.alertBannerTitle}>
            {orchards.length} orchard{orchards.length !== 1 ? 's' : ''} need{orchards.length === 1 ? 's' : ''} attention
          </span>
        </div>

        <div style={s.alertBannerSections}>
          {noData.length > 0 && (
            <div style={s.alertSection}>
              <div style={{ ...s.alertSectionLabel, color: '#7b1fa2' }}>
                Not Irrigated ({noData.length})
              </div>
              <div style={s.alertChips}>
                {(expanded ? noData : noData.slice(0, PREVIEW_LIMIT)).map(o => (
                  <button
                    key={o.orchard_id}
                    style={{ ...s.alertChip, borderColor: '#9c27b0', color: '#7b1fa2' }}
                    onClick={() => onSelect(o.orchard_id)}
                  >
                    {o.orchard_nr ? `${o.orchard_nr}. ` : ''}{o.orchard_name}
                    {o.days_since_irrigation != null
                      ? <span style={s.alertChipDays}>{o.days_since_irrigation}d</span>
                      : <span style={s.alertChipDays}>never</span>
                    }
                  </button>
                ))}
                {!expanded && noData.length > PREVIEW_LIMIT && (
                  <button style={s.alertMoreBtn} onClick={() => setExpanded(true)}>
                    +{noData.length - PREVIEW_LIMIT} more
                  </button>
                )}
              </div>
            </div>
          )}

          {critical.length > 0 && (
            <div style={s.alertSection}>
              <div style={{ ...s.alertSectionLabel, color: '#c0392b' }}>
                Needs Water ({critical.length})
              </div>
              <div style={s.alertChips}>
                {(expanded ? critical : critical.slice(0, PREVIEW_LIMIT)).map(o => (
                  <button
                    key={o.orchard_id}
                    style={{ ...s.alertChip, borderColor: '#e85a4a', color: '#c0392b' }}
                    onClick={() => onSelect(o.orchard_id)}
                  >
                    {o.orchard_nr ? `${o.orchard_nr}. ` : ''}{o.orchard_name}
                    <span style={s.alertChipDays}>
                      {o.days_since_irrigation != null ? `${o.days_since_irrigation}d` : '—'}
                    </span>
                  </button>
                ))}
                {!expanded && critical.length > PREVIEW_LIMIT && (
                  <button style={s.alertMoreBtn} onClick={() => setExpanded(true)}>
                    +{critical.length - PREVIEW_LIMIT} more
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Alert Map ─────────────────────────────────────────────────────────────────

function AlertMap({ alerts, selectedOrchardId, onSelectOrchard }: {
  alerts: AlertRow[]
  selectedOrchardId: string | null
  onSelectOrchard: (id: string | null) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const boundaryCache = useRef<any[] | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const statusMap = useRef<Record<string, AlertLevel>>({})
  statusMap.current = {}
  alerts.forEach(a => { statusMap.current[a.orchard_id] = a.stress_risk })

  const orchardIds = useMemo(() => new Set(alerts.map(a => a.orchard_id)), [alerts])

  // Init map
  useEffect(() => {
    if (mapReady || alerts.length === 0 || !mapContainerRef.current) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapContainerRef.current) return
      leafletRef.current = L
      const map = L.map(mapContainerRef.current, {
        zoomControl: true, attributionControl: false, scrollWheelZoom: true,
        maxZoom: 19, center: [-33.9, 19.1], zoom: 12,
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
  }, [alerts.length])

  // Draw polygons
  const drawPolygons = useCallback(async () => {
    const L = leafletRef.current
    const map = mapInstanceRef.current
    if (!L || !map) return

    if (geoLayerRef.current) geoLayerRef.current.remove()

    if (!boundaryCache.current) {
      const supabase = createClient()
      const { data } = await supabase.rpc('get_orchard_boundaries')
      boundaryCache.current = data || []
    }
    if (!boundaryCache.current!.length) return

    const myBoundaries = boundaryCache.current!.filter((o: any) => orchardIds.has(o.id))
    if (!myBoundaries.length) return

    const sm = statusMap.current
    const selId = selectedOrchardId

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
          const status = sm[f.properties.id] || 'dormant'
          const color = STATUS_CONFIG[status]?.fill || '#aaa'
          const sel = f.properties.id === selId
          return { fillColor: color, fillOpacity: sel ? 0.95 : 0.7, color: '#fff', weight: sel ? 3 : 1.5 }
        },
        onEachFeature: (f: any, lyr: any) => {
          const id = f.properties.id
          lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.88 }))
          lyr.on('mouseout', () => lyr.setStyle({ fillOpacity: 0.7 }))
          lyr.on('click', () => {
            onSelectOrchard(selId === id ? null : id)
            if (selId !== id) map.fitBounds(lyr.getBounds(), { padding: [60, 60], maxZoom: 17 })
          })
          const status = sm[id] || 'dormant'
          lyr.bindTooltip(`${f.properties.name || ''} — ${STATUS_CONFIG[status]?.label || ''}`, {
            permanent: false,
            className: 'intel-map-tooltip',
          })
        },
      }
    ).addTo(map)
    geoLayerRef.current = layer
    if (layer.getBounds().isValid() && !selId) {
      map.fitBounds(layer.getBounds(), { padding: [16, 16] })
    }
  }, [orchardIds.size, alerts, selectedOrchardId])

  useEffect(() => {
    if (mapReady && orchardIds.size > 0) drawPolygons()
  }, [mapReady, drawPolygons])

  if (alerts.length === 0) return null

  return (
    <>
      <style>{`
        .intel-map-tooltip {
          background: #1a4ba0 !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important;
          padding: 4px 10px !important; font-family: 'Inter', sans-serif !important;
        }
        .intel-map-tooltip::before { display: none !important; }
      `}</style>
      <div style={s.card}>
        <div style={s.cardHeader}>Farm Overview</div>
        <div style={{ display: 'flex' }}>
          <div className="intel-map-wrap" style={{ flex: 1, height: 420, position: 'relative' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            {/* Legend */}
            <div style={{
              position: 'absolute', bottom: 16, left: 12, background: 'rgba(255,255,255,0.95)',
              borderRadius: 8, border: '1px solid #e8e4dc', padding: '10px 14px', zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#8a95a0', marginBottom: 7 }}>Alert Level</div>
              {(Object.entries(STATUS_CONFIG) as [AlertLevel, typeof STATUS_CONFIG[AlertLevel]][]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#3a4a40', marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: v.fill, flexShrink: 0 }} />
                  {v.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Alert Table ───────────────────────────────────────────────────────────────

function AlertTable({ rows, selectedId, onSelect }: {
  rows: AlertRow[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  if (rows.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>No orchards to display</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Status</th>
            <th style={s.th}>Orchard</th>
            <th style={s.th}>Variety</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Ha</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Given (m3/ha)</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Crop Need (m3/ha)</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Shortfall (m3/ha)</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Kc</th>
            <th style={s.th}>Last Watered</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Season (m3/ha)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const cfg = STATUS_CONFIG[row.stress_risk] || STATUS_CONFIG.ok
            const sel = selectedId === row.orchard_id
            const shortfall = mmToCubes(row.net_deficit_mm)
            return (
              <tr
                key={row.orchard_id}
                className={`intel-tr${sel ? ' intel-tr-sel' : ''}`}
                style={{ cursor: 'pointer', borderBottom: '1px solid #f5f3ef' }}
                onClick={() => onSelect(sel ? null : row.orchard_id)}
              >
                <td style={s.td}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                    fontSize: 11, fontWeight: 600,
                    background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {cfg.label}
                  </span>
                </td>
                <td style={s.tdName}>
                  {row.orchard_nr ? `${row.orchard_nr}. ` : ''}{row.orchard_name}
                </td>
                <td style={s.td}>{row.variety || '—'}</td>
                <td style={s.tdNum}>{row.ha?.toFixed(1) ?? '—'}</td>
                <td style={{ ...s.tdNum, color: '#2176d9', fontWeight: 600 }}>
                  {row.total_applied_mm > 0 ? mmToCubes(row.total_applied_mm).toFixed(1) : '0'}
                </td>
                <td style={s.tdNum}>
                  {mmToCubes(row.total_etc_mm).toFixed(1)}
                </td>
                <td style={{ ...s.tdNum, fontWeight: 600, color: row.net_deficit_mm > 0 ? '#e85a4a' : '#4caf72' }}>
                  {shortfall > 0 ? '+' : ''}{shortfall.toFixed(1)}
                </td>
                <td style={{ ...s.tdNum, color: '#8a95a0' }}>
                  {row.kc_current?.toFixed(2) ?? '—'}
                </td>
                <td style={s.td}>
                  {row.stress_risk === 'no_data' && !row.last_irrigation_date
                    ? <span style={{ color: '#7b1fa2', fontWeight: 600 }}>Never</span>
                    : row.days_since_irrigation != null
                      ? <span style={{
                          color: row.days_since_irrigation >= 7 ? '#e85a4a' : row.days_since_irrigation >= 5 ? '#e67e22' : '#1a2a3a',
                          fontWeight: row.days_since_irrigation >= 5 ? 600 : 400,
                        }}>
                          {row.days_since_irrigation}d ago
                        </span>
                      : '—'
                  }
                </td>
                <td style={s.tdNum}>
                  {row.season_cubes_per_ha != null && row.season_cubes_per_ha > 0
                    ? Math.round(row.season_cubes_per_ha).toLocaleString()
                    : '0'
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:        { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
  main:        { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, paddingBottom: 100 },
  pageHeader:  { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  backLink:    { fontSize: 13, color: '#2176d9', textDecoration: 'none', fontWeight: 500 },
  pageTitle:   { fontSize: 28, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px', lineHeight: 1, marginTop: 8 },
  pageSub:     { fontSize: 14, color: '#8a95a0', marginTop: 6 },
  controls:    { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 28 },
  filterGroup: { display: 'flex', gap: 6 },
  pill:        { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:  { padding: '6px 14px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  divider:     { width: 1, height: 24, background: '#d4cfca' },
  select:      { padding: '6px 12px', borderRadius: 8, border: '1px solid #d4cfca', background: '#fff', fontSize: 13, fontFamily: 'inherit', color: '#1a2a3a', cursor: 'pointer' },

  // KPI
  kpiStrip:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 28 },
  kpiCard:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative' as const, overflow: 'hidden' },
  kpiAccent:   { position: 'absolute' as const, top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2176d9, #a0c4f0)' },
  kpiLabel:    { fontSize: 12, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  kpiValue:    { fontSize: 32, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 },

  // Alert Banner
  alertBanner: { position: 'relative' as const, background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 20 },
  alertBannerAccent: { position: 'absolute' as const, top: 0, left: 0, bottom: 0, width: 4, background: 'linear-gradient(180deg, #9c27b0, #e85a4a)' },
  alertBannerContent: { padding: '16px 20px 16px 24px' },
  alertBannerHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  alertBannerIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 12, background: '#e85a4a', color: '#fff', fontSize: 14, fontWeight: 700 },
  alertBannerTitle: { fontSize: 15, fontWeight: 700, color: '#1a2a3a' },
  alertBannerSections: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  alertSection: {},
  alertSectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 6 },
  alertChips: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  alertChip: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 16, border: '1px solid #d4cfca', background: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  alertChipDays: { fontSize: 11, color: '#8a95a0', fontWeight: 400 },
  alertMoreBtn: { padding: '4px 12px', borderRadius: 16, border: '1px dashed #d4cfca', background: 'none', fontSize: 12, color: '#8a95a0', cursor: 'pointer', fontFamily: 'inherit' },

  // Card
  card: { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 20 },
  cardHeaderRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid #f0ede8' },
  cardHeader: { fontSize: 15, fontWeight: 700, color: '#1a2a3a' },
  dormantToggle: { fontSize: 12, color: '#8a95a0', cursor: 'pointer', display: 'flex', alignItems: 'center' },

  // Table
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, color: '#8a95a0', borderBottom: '1px solid #f0ede8', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', color: '#1a2a3a', whiteSpace: 'nowrap' as const },
  tdName: { padding: '10px 12px', color: '#1a2a3a', fontWeight: 600, whiteSpace: 'nowrap' as const },
  tdNum: { padding: '10px 12px', color: '#1a2a3a', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' as const },
}

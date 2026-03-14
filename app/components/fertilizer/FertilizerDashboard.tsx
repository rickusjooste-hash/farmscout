'use client'

import { useMemo } from 'react'

export interface DashboardRow {
  timing_id: string
  timing_label: string
  timing_sort: number
  window_start: string | null
  window_end: string | null
  commodity_name: string | null
  product_id: string
  product_name: string
  total_orchards: number
  confirmed_orchards: number
  total_qty_prescribed: number
  total_qty_confirmed: number
  n_pct: number
  p_pct: number
  k_pct: number
}

export interface LeafNutrientFlag {
  orchardId: string
  orchardName: string
  orchardNr: number | null
  variety: string | null
  nutrientCode: string
  status: 'low' | 'high'
  appliedProducts: string[]
}

export interface ProductionEnrichment {
  orchardId: string
  orchardName: string
  tonHa: number | null
}

interface Props {
  data: DashboardRow[]
  loading: boolean
  season: string
  onNavigateConfirm: (timingId?: string) => void
  productionByOrchard?: Record<string, { tonHa: number | null }>
  leafFlags?: LeafNutrientFlag[]
  confirmData?: { orchard_id: string; orchard_name: string; confirmed: boolean }[]
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatKg(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`
  return `${Math.round(v)}`
}

type TimingStatus = 'overdue' | 'current' | 'upcoming' | 'completed'

// When window_start/end aren't set, infer approximate end date from the timing label + season.
// SA deciduous fruit timing patterns: Winter (Jun-Aug), Flowering (Sep-Oct),
// Pip Hardening (Nov), Summer (Dec-Feb), Autumn (Mar-May)
function inferEndDate(label: string, season: string): string | null {
  const startYr = parseInt(season.split('/')[0])
  const endYr = startYr + 1
  const lower = label.toLowerCase()

  // Extract explicit year from label if present (e.g. "Winter 2025" → 2025)
  const ym = label.match(/\b(20\d{2})\b/)
  const labelYr = ym ? parseInt(ym[1]) : null

  if (lower.includes('winter')) return `${labelYr || startYr}-08-31`
  if (lower.includes('flower') || lower.includes('bloom') && !lower.includes('after')) return `${startYr}-10-31`
  if (lower.includes('pip hard')) return `${startYr}-11-30`
  if (lower.includes('after') && (lower.includes('bloom') || lower.includes('full bloom'))) return `${startYr}-12-31`
  if (lower.includes('after') && lower.includes('pip')) return `${endYr}-01-15`
  if (lower.includes('november')) return `${startYr}-11-30`
  if (lower.includes('december') || lower.includes('after harvest')) return `${endYr}-01-31`
  if (lower.includes('summer')) return `${endYr}-02-28`
  if (lower.includes('autumn') || lower.includes('herfs')) return `${labelYr || endYr}-05-31`

  // Year in label but no keyword — estimate from year position in season
  if (labelYr && labelYr <= startYr) return `${labelYr}-12-31`
  if (labelYr && labelYr === endYr) return `${endYr}-06-30`

  return null
}

function getTimingStatus(
  windowStart: string | null,
  windowEnd: string | null,
  confirmedOrchards: number,
  totalOrchards: number,
  label: string,
  season: string,
): TimingStatus {
  const today = todayStr()
  if (confirmedOrchards >= totalOrchards && totalOrchards > 0) return 'completed'

  // Use explicit windows if set
  if (windowEnd && today > windowEnd) return 'overdue'
  if (windowStart && windowEnd && today >= windowStart && today <= windowEnd) return 'current'
  if (windowStart || windowEnd) return 'upcoming'

  // No windows — infer from label + season
  const inferred = inferEndDate(label, season)
  if (inferred && today > inferred) return 'overdue'

  return 'upcoming'
}

export default function FertilizerDashboard({ data, loading, season, onNavigateConfirm, productionByOrchard, leafFlags, confirmData }: Props) {
  // Aggregate by timing
  const timings = useMemo(() => {
    const map = new Map<string, {
      id: string; label: string; displayLabel: string; sort: number
      windowStart: string | null; windowEnd: string | null
      totalOrchards: number; confirmedOrchards: number
      products: { name: string; totalOrchards: number; confirmedOrchards: number }[]
    }>()

    for (const row of data) {
      let t = map.get(row.timing_id)
      if (!t) {
        const displayLabel = row.commodity_name
          ? `${row.timing_label} (${row.commodity_name})`
          : row.timing_label
        t = {
          id: row.timing_id, label: row.timing_label, displayLabel, sort: row.timing_sort,
          windowStart: row.window_start, windowEnd: row.window_end,
          totalOrchards: 0, confirmedOrchards: 0, products: [],
        }
        map.set(row.timing_id, t)
      }
      t.totalOrchards += row.total_orchards
      t.confirmedOrchards += row.confirmed_orchards
      t.products.push({
        name: row.product_name,
        totalOrchards: row.total_orchards,
        confirmedOrchards: row.confirmed_orchards,
      })
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort)
  }, [data])

  // Grand totals
  const grandTotal = useMemo(() => {
    let total = 0, confirmed = 0
    let nPrescribed = 0, pPrescribed = 0, kPrescribed = 0
    let nConfirmed = 0, pConfirmed = 0, kConfirmed = 0

    for (const row of data) {
      total += row.total_orchards
      confirmed += row.confirmed_orchards
      nPrescribed += (row.total_qty_prescribed || 0) * (row.n_pct || 0) / 100
      pPrescribed += (row.total_qty_prescribed || 0) * (row.p_pct || 0) / 100
      kPrescribed += (row.total_qty_prescribed || 0) * (row.k_pct || 0) / 100
      nConfirmed += (row.total_qty_confirmed || 0) * (row.n_pct || 0) / 100
      pConfirmed += (row.total_qty_confirmed || 0) * (row.p_pct || 0) / 100
      kConfirmed += (row.total_qty_confirmed || 0) * (row.k_pct || 0) / 100
    }
    return {
      total, confirmed,
      pct: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      nPrescribed, pPrescribed, kPrescribed,
      nConfirmed, pConfirmed, kConfirmed,
    }
  }, [data])

  // Current timing (first non-completed timing, preferring 'current' status)
  const currentTiming = useMemo(() => {
    const withStatus = timings.map(t => ({
      ...t,
      status: getTimingStatus(t.windowStart, t.windowEnd, t.confirmedOrchards, t.totalOrchards, t.label, season),
    }))
    return withStatus.find(t => t.status === 'current')
      || withStatus.find(t => t.status === 'overdue')
      || withStatus.find(t => t.status === 'upcoming')
      || withStatus[0]
  }, [timings])

  // Overdue timings for alerts
  const overdueTimings = useMemo(() => {
    return timings
      .filter(t => {
        const status = getTimingStatus(t.windowStart, t.windowEnd, t.confirmedOrchards, t.totalOrchards, t.label, season)
        return status === 'overdue'
      })
      .map(t => ({
        ...t,
        unconfirmedProducts: t.products.filter(p => p.confirmedOrchards < p.totalOrchards),
      }))
      .filter(t => t.unconfirmedProducts.length > 0)
  }, [timings])

  // Overdue orchards count
  const overdueOrchardCount = useMemo(() => {
    let count = 0
    for (const t of overdueTimings) {
      for (const p of t.unconfirmedProducts) {
        count += p.totalOrchards - p.confirmedOrchards
      }
    }
    return count
  }, [overdueTimings])

  // Heat map: build orchard × timing grid
  // We need to derive per-orchard status from the aggregated data
  // Since the dashboard RPC is aggregated, we track per timing: confirmed/total
  const heatMapData = useMemo(() => {
    // Group by timing: get list of unique orchards across all data
    // For the heat map we need per-orchard status — build from the full confirm data
    // Since we have aggregated data, we approximate: each timing shows confirmed/total %
    // A more precise heat map would need per-orchard data, so we'll use the timing-level summary

    // Instead, group data by timing and show a row per timing × product with progress
    return timings.map(t => {
      const status = getTimingStatus(t.windowStart, t.windowEnd, t.confirmedOrchards, t.totalOrchards, t.label, season)
      const pct = t.totalOrchards > 0 ? Math.round((t.confirmedOrchards / t.totalOrchards) * 100) : 0
      return { ...t, status, pct }
    })
  }, [timings])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 60, background: '#fff', borderRadius: 12, animation: 'fd-pulse 1.5s ease infinite' }} />
        ))}
        <style>{`@keyframes fd-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    )
  }

  if (data.length === 0) return null

  return (
    <div>
      {/* KPI Strip */}
      <div style={st.kpiStrip}>
        <div style={st.kpiCard}>
          <div style={st.kpiValue}>{grandTotal.pct}%</div>
          <div style={st.kpiLabel}>Applied</div>
          <div style={st.progressTrack}>
            <div style={{ ...st.progressFill, width: `${grandTotal.pct}%` }} />
          </div>
        </div>
        <div style={st.kpiCard}>
          <div style={{ ...st.kpiValue, fontSize: 18 }}>{currentTiming?.displayLabel || '\u2014'}</div>
          <div style={st.kpiLabel}>
            {currentTiming
              ? currentTiming.status === 'current' ? 'Due now'
                : currentTiming.status === 'overdue' ? 'Overdue'
                : currentTiming.status === 'completed' ? 'Completed'
                : 'Upcoming'
              : 'No timings'}
          </div>
        </div>
        <div style={st.kpiCard}>
          <div style={{ ...st.kpiValue, color: overdueOrchardCount > 0 ? '#e85a4a' : '#4caf72' }}>
            {overdueOrchardCount}
          </div>
          <div style={st.kpiLabel}>Overdue</div>
        </div>
        <div style={st.kpiCard}>
          <div style={{ ...st.kpiValue, fontSize: 14, lineHeight: '28px' }}>
            {grandTotal.nPrescribed > 0 && <span>N: {formatKg(grandTotal.nConfirmed)}/{formatKg(grandTotal.nPrescribed)} </span>}
            {grandTotal.pPrescribed > 0 && <span>P: {formatKg(grandTotal.pConfirmed)}/{formatKg(grandTotal.pPrescribed)} </span>}
            {grandTotal.kPrescribed > 0 && <span>K: {formatKg(grandTotal.kConfirmed)}/{formatKg(grandTotal.kPrescribed)}</span>}
            {grandTotal.nPrescribed === 0 && grandTotal.pPrescribed === 0 && grandTotal.kPrescribed === 0 && '\u2014'}
          </div>
          <div style={st.kpiLabel}>NPK Applied / Prescribed</div>
        </div>
      </div>

      {/* Overdue Alerts */}
      {overdueTimings.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {overdueTimings.map(t => (
            <div key={t.id} style={st.alertCard}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={st.alertIcon}>!</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#1a2a3a', fontSize: 14 }}>
                    {t.displayLabel}
                  </div>
                  {t.unconfirmedProducts.map(p => (
                    <div key={p.name} style={{ fontSize: 13, color: '#6a7a70', marginTop: 2 }}>
                      {p.name} &mdash; {p.totalOrchards - p.confirmedOrchards} of {p.totalOrchards} orchards NOT confirmed
                    </div>
                  ))}
                  {t.windowStart && t.windowEnd && (
                    <div style={{ fontSize: 12, color: '#e85a4a', marginTop: 4 }}>
                      Window: {formatDate(t.windowStart)} &ndash; {formatDate(t.windowEnd)} (OVERDUE)
                    </div>
                  )}
                  <button
                    onClick={() => onNavigateConfirm(t.id)}
                    style={st.alertLink}
                  >
                    Go to Confirm &rarr;
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compliance Progress Table */}
      <div style={st.tableCard}>
        <div style={st.tableHeader}>Application Progress by Timing</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={st.table}>
            <thead>
              <tr>
                <th style={st.th}>Timing</th>
                <th style={st.th}>Window</th>
                <th style={st.th}>Status</th>
                <th style={{ ...st.th, textAlign: 'right' }}>Orchards</th>
                <th style={{ ...st.th, minWidth: 160 }}>Progress</th>
                <th style={{ ...st.th, textAlign: 'right' }}>Products</th>
                <th style={{ ...st.th, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {heatMapData.map((t, idx) => {
                const stripe = idx % 2 === 1
                return (
                  <tr key={t.id} style={{ background: stripe ? '#f8f6f2' : '#fff' }}>
                    <td style={{ ...st.td, fontWeight: 500 }}>{t.displayLabel}</td>
                    <td style={{ ...st.td, color: '#6a7a70', fontSize: 12 }}>
                      {t.windowStart && t.windowEnd
                        ? `${formatDate(t.windowStart)} \u2013 ${formatDate(t.windowEnd)}`
                        : '\u2014'}
                    </td>
                    <td style={st.td}>
                      <span style={{
                        ...st.statusBadge,
                        background: statusColors[t.status].bg,
                        color: statusColors[t.status].text,
                      }}>
                        {statusLabels[t.status]}
                      </span>
                    </td>
                    <td style={{ ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {t.confirmedOrchards}/{t.totalOrchards}
                    </td>
                    <td style={st.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={st.progressTrackTable}>
                          <div style={{
                            ...st.progressFillTable,
                            width: `${t.pct}%`,
                            background: statusColors[t.status].bar,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#6a7a70', minWidth: 32, textAlign: 'right' }}>
                          {t.pct}%
                        </span>
                      </div>
                    </td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70', fontSize: 12 }}>
                      {t.products.length}
                    </td>
                    <td style={st.td}>
                      <button
                        onClick={() => onNavigateConfirm(t.id)}
                        style={st.goBtn}
                        title="Go to Confirm"
                      >
                        &rarr;
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product breakdown per timing */}
      <div style={{ marginTop: 16 }}>
        <div style={st.tableCard}>
          <div style={st.tableHeader}>Product Detail</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={st.table}>
              <thead>
                <tr>
                  <th style={st.th}>Timing</th>
                  <th style={st.th}>Product</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Orchards</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Qty Prescribed</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Qty Confirmed</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>N (kg)</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>P (kg)</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>K (kg)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => {
                  const stripe = idx % 2 === 1
                  const nPre = (row.total_qty_prescribed || 0) * (row.n_pct || 0) / 100
                  const pPre = (row.total_qty_prescribed || 0) * (row.p_pct || 0) / 100
                  const kPre = (row.total_qty_prescribed || 0) * (row.k_pct || 0) / 100
                  return (
                    <tr key={`${row.timing_id}-${row.product_id}`} style={{ background: stripe ? '#f8f6f2' : '#fff' }}>
                      <td style={{ ...st.td, color: '#6a7a70', fontSize: 12 }}>
                        {row.commodity_name ? `${row.timing_label} (${row.commodity_name})` : row.timing_label}
                      </td>
                      <td style={{ ...st.td, fontWeight: 500 }}>{row.product_name}</td>
                      <td style={{ ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.confirmed_orchards}/{row.total_orchards}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatKg(row.total_qty_prescribed || 0)}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {formatKg(row.total_qty_confirmed || 0)}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontSize: 12, color: nPre > 0 ? '#1a2a3a' : '#ccc' }}>
                        {nPre > 0 ? formatKg(nPre) : '\u2014'}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontSize: 12, color: pPre > 0 ? '#1a2a3a' : '#ccc' }}>
                        {pPre > 0 ? formatKg(pPre) : '\u2014'}
                      </td>
                      <td style={{ ...st.td, textAlign: 'right', fontSize: 12, color: kPre > 0 ? '#1a2a3a' : '#ccc' }}>
                        {kPre > 0 ? formatKg(kPre) : '\u2014'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Attention Needed — diagnostic table (Phase 3) */}
      {leafFlags && leafFlags.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={st.tableCard}>
            <div style={{ ...st.tableHeader, color: '#e8924a' }}>Attention Needed</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={st.table}>
                <thead>
                  <tr>
                    <th style={st.th}>Orchard</th>
                    <th style={st.th}>Leaf Status</th>
                    <th style={st.th}>Fert Applied</th>
                    {productionByOrchard && <th style={{ ...st.th, textAlign: 'right' }}>T/Ha</th>}
                    <th style={st.th}>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {leafFlags.map((flag, idx) => {
                    const stripe = idx % 2 === 1
                    const prod = productionByOrchard?.[flag.orchardId]
                    const nutrientLabel = flag.nutrientCode === 'N' ? 'N-containing' : flag.nutrientCode === 'K' ? 'K-containing' : flag.nutrientCode
                    let recommendation: string
                    if (flag.status === 'low') {
                      recommendation = flag.appliedProducts.length > 0
                        ? `${flag.nutrientCode} deficient despite ${flag.appliedProducts.join(', ')} applied \u2014 investigate soil pH, root health, or antagonism`
                        : `${flag.nutrientCode} deficient \u2014 apply ${nutrientLabel} product at next opportunity`
                    } else {
                      recommendation = flag.appliedProducts.length > 0
                        ? `${flag.nutrientCode} excess \u2014 reduce ${nutrientLabel} rates next season; check soil supply`
                        : `${flag.nutrientCode} excess \u2014 withhold ${nutrientLabel} products; review programme rates`
                    }
                    return (
                      <tr key={`${flag.orchardId}-${flag.nutrientCode}`} style={{ background: stripe ? '#f8f6f2' : '#fff' }}>
                        <td style={{ ...st.td, fontWeight: 500 }}>
                          {flag.orchardNr != null ? `${flag.orchardNr} ` : ''}{flag.orchardName}{flag.variety ? ` (${flag.variety})` : ''}
                        </td>
                        <td style={st.td}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                            background: 'rgba(232,90,74,0.12)', color: '#c23616',
                          }}>
                            {flag.status === 'low' ? 'Low' : 'High'} {flag.nutrientCode}
                          </span>
                        </td>
                        <td style={{ ...st.td, fontSize: 12, color: '#6a7a70' }}>
                          {flag.appliedProducts.length > 0 ? flag.appliedProducts.join(', ') : 'Not applied'}
                        </td>
                        {productionByOrchard && (
                          <td style={{
                            ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                            color: tonHaColor(prod?.tonHa ?? null),
                            fontWeight: prod?.tonHa != null ? 600 : 400,
                          }}>
                            {prod?.tonHa != null ? prod.tonHa.toFixed(1) : '\u2014'}
                          </td>
                        )}
                        <td style={{ ...st.td, fontSize: 12, color: '#6a7a70', whiteSpace: 'normal', maxWidth: 300 }}>
                          {recommendation}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function tonHaColor(tonHa: number | null): string {
  if (tonHa == null) return '#aaa'
  if (tonHa >= 50) return '#2176d9'
  if (tonHa >= 30) return '#4caf72'
  if (tonHa >= 15) return '#f5c842'
  return '#e85a4a'
}

const statusLabels: Record<TimingStatus, string> = {
  completed: 'Completed',
  current: 'Due Now',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
}

const statusColors: Record<TimingStatus, { bg: string; text: string; bar: string }> = {
  completed: { bg: 'rgba(76,175,114,0.12)', text: '#2d8a4e', bar: '#4caf72' },
  current: { bg: 'rgba(33,118,217,0.10)', text: '#1a5fb4', bar: '#2176d9' },
  overdue: { bg: 'rgba(232,90,74,0.12)', text: '#c23616', bar: '#e85a4a' },
  upcoming: { bg: 'rgba(200,196,190,0.20)', text: '#8a95a0', bar: '#c0bbb5' },
}

const st: Record<string, React.CSSProperties> = {
  kpiStrip: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12, marginBottom: 20,
  },
  kpiCard: {
    background: '#fff', borderRadius: 12, padding: '16px 18px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  kpiValue: {
    fontSize: 22, fontWeight: 700, color: '#1a2a3a',
    fontVariantNumeric: 'tabular-nums',
  },
  kpiLabel: {
    fontSize: 12, color: '#6a7a70', marginTop: 2, marginBottom: 6,
  },
  progressTrack: {
    height: 6, borderRadius: 3, background: '#e8e4dc', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3, background: '#4caf72',
    transition: 'width 0.3s ease',
  },
  alertCard: {
    background: '#fff', borderRadius: 12, padding: '14px 18px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    borderLeft: '4px solid #e85a4a', marginBottom: 10,
  },
  alertIcon: {
    width: 24, height: 24, borderRadius: '50%',
    background: '#e85a4a', color: '#fff', fontSize: 14, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  alertLink: {
    background: 'none', border: 'none', color: '#2176d9',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0,
    marginTop: 6, fontFamily: 'Inter, sans-serif',
  },
  tableCard: {
    background: '#fff', borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  tableHeader: {
    padding: '14px 18px', fontWeight: 600, fontSize: 14, color: '#1a2a3a',
    borderBottom: '1px solid #f0ede6',
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif',
    fontSize: 13,
  },
  th: {
    textAlign: 'left', padding: '10px 12px', fontWeight: 600,
    color: '#5a6a60', fontSize: 12, borderBottom: '2px solid #e0dbd4',
    whiteSpace: 'nowrap', background: '#f2efea',
  },
  td: {
    padding: '10px 12px', borderBottom: '1px solid #f0ede6',
    color: '#1a2a3a', whiteSpace: 'nowrap',
  },
  statusBadge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 12,
    fontSize: 11, fontWeight: 600,
  },
  progressTrackTable: {
    flex: 1, height: 8, borderRadius: 4, background: '#e8e4dc', overflow: 'hidden',
  },
  progressFillTable: {
    height: '100%', borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  goBtn: {
    background: 'none', border: '1px solid #d4cfca', borderRadius: 6,
    width: 28, height: 28, cursor: 'pointer', color: '#6a7a70',
    fontSize: 14, fontFamily: 'Inter, sans-serif',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}

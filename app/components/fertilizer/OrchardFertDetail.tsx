'use client'

import { useEffect, useState, useMemo } from 'react'

interface ConfirmLine {
  line_id: string
  timing_id: string
  timing_label: string
  timing_sort: number
  product_id: string
  product_name: string
  orchard_id: string
  orchard_name: string
  orchard_nr: number | null
  variety: string | null
  commodity_name: string | null
  rate_per_ha: number
  unit: string
  total_qty: number | null
  ha: number | null
  confirmed: boolean
  date_applied: string | null
  confirmed_by_name: string | null
}

interface SummaryRow {
  orchard_id: string
  product_name: string
  n_pct: number
  p_pct: number
  k_pct: number
  ca_pct?: number
  mg_pct?: number
  s_pct?: number
}

interface Props {
  orchardId: string
  confirmData: ConfirmLine[]
  summaryData: SummaryRow[]
  onClose: () => void
}

const NUTRIENTS = ['N', 'P', 'K', 'Ca', 'Mg', 'S'] as const

export default function OrchardFertDetail({ orchardId, confirmData, summaryData, onClose }: Props) {
  const lines = useMemo(() => confirmData.filter(l => l.orchard_id === orchardId), [confirmData, orchardId])
  const productNpk = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const r of summaryData) {
      if (r.orchard_id === orchardId && !map[r.product_name]) {
        map[r.product_name] = { N: r.n_pct || 0, P: r.p_pct || 0, K: r.k_pct || 0, Ca: (r as any).ca_pct || 0, Mg: (r as any).mg_pct || 0, S: (r as any).s_pct || 0 }
      }
    }
    return map
  }, [summaryData, orchardId])

  if (lines.length === 0) return null

  const first = lines[0]
  const ha = first.ha || 0

  // Get unique timings and products
  const timings = [...new Map(lines.map(l => [l.timing_id, { id: l.timing_id, label: l.timing_label, sort: l.timing_sort }])).values()]
    .sort((a, b) => a.sort - b.sort)
  const products = [...new Set(lines.map(l => l.product_name))].sort()

  // Build matrix: product × timing → line
  const matrix: Record<string, Record<string, ConfirmLine>> = {}
  for (const l of lines) {
    if (!matrix[l.product_name]) matrix[l.product_name] = {}
    matrix[l.product_name][l.timing_id] = l
  }

  // NPK totals per timing
  const nutrientTotals: Record<string, Record<string, number>> = {}
  const grandTotals: Record<string, number> = {}
  for (const n of NUTRIENTS) grandTotals[n] = 0

  for (const t of timings) {
    nutrientTotals[t.id] = {}
    for (const n of NUTRIENTS) nutrientTotals[t.id][n] = 0

    for (const prod of products) {
      const line = matrix[prod]?.[t.id]
      if (!line) continue
      const qty = line.total_qty || (line.rate_per_ha * ha)
      const npk = productNpk[prod]
      if (!npk) continue
      for (const n of NUTRIENTS) {
        const kg = qty * (npk[n] || 0) / 100
        nutrientTotals[t.id][n] += kg
        grandTotals[n] += kg
      }
    }
  }

  const confirmed = lines.filter(l => l.confirmed).length
  const total = lines.length

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={st.header}>
          <div>
            <div style={st.orchardName}>
              {first.orchard_nr ? `${first.orchard_nr}. ` : ''}{first.orchard_name}
            </div>
            <div style={st.orchardMeta}>
              {first.variety && <span>{first.variety} &middot; </span>}
              {first.commodity_name} &middot; {ha.toFixed(2)} ha
            </div>
          </div>
          <button onClick={onClose} style={st.closeBtn}>&times;</button>
        </div>

        {/* Progress */}
        <div style={st.progressRow}>
          <div style={st.progressBar}>
            <div style={{ ...st.progressFill, width: `${total > 0 ? (confirmed / total) * 100 : 0}%` }} />
          </div>
          <span style={st.progressText}>{confirmed}/{total} confirmed</span>
        </div>

        {/* Products x Timings Matrix */}
        <div style={st.section}>
          <div style={st.sectionTitle}>Application Matrix</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={st.table}>
              <thead>
                <tr>
                  <th style={st.th}>Product</th>
                  {timings.map(t => <th key={t.id} style={{ ...st.th, textAlign: 'right' }}>{t.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {products.map(prod => (
                  <tr key={prod}>
                    <td style={{ ...st.td, fontWeight: 500 }}>{prod}</td>
                    {timings.map(t => {
                      const line = matrix[prod]?.[t.id]
                      if (!line) return <td key={t.id} style={{ ...st.td, textAlign: 'right', color: '#ccc' }}>&mdash;</td>
                      const bg = line.confirmed ? '#e8f5e8' : line.rate_per_ha > 0 ? '#fff8e0' : 'transparent'
                      return (
                        <td key={t.id} style={{ ...st.td, textAlign: 'right', background: bg }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{formatRate(line.rate_per_ha)}</div>
                          {line.confirmed && <div style={{ fontSize: 10, color: '#4a7a4a' }}>&#10003; {line.date_applied || ''}</div>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* NPK totals per timing */}
        <div style={st.section}>
          <div style={st.sectionTitle}>Nutrient Budget (kg)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={st.table}>
              <thead>
                <tr>
                  <th style={st.th}>Nutrient</th>
                  {timings.map(t => <th key={t.id} style={{ ...st.th, textAlign: 'right' }}>{t.label}</th>)}
                  <th style={{ ...st.th, textAlign: 'right', fontWeight: 700 }}>Total</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>kg/ha</th>
                </tr>
              </thead>
              <tbody>
                {NUTRIENTS.map(n => {
                  const total = grandTotals[n]
                  if (total === 0) return null
                  return (
                    <tr key={n}>
                      <td style={{ ...st.td, fontWeight: 600 }}>{n}</td>
                      {timings.map(t => (
                        <td key={t.id} style={{ ...st.td, textAlign: 'right' }}>
                          {nutrientTotals[t.id][n] > 0 ? Math.round(nutrientTotals[t.id][n]) : '\u2014'}
                        </td>
                      ))}
                      <td style={{ ...st.td, textAlign: 'right', fontWeight: 700 }}>{Math.round(total)}</td>
                      <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70' }}>
                        {ha > 0 ? Math.round(total / ha) : '\u2014'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Application details */}
        <div style={st.section}>
          <div style={st.sectionTitle}>Application Details</div>
          {lines.map(l => (
            <div key={l.line_id} style={st.detailRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{l.product_name}</div>
                <div style={{ fontSize: 11, color: '#6a7a70' }}>{l.timing_label} &middot; {l.rate_per_ha} {l.unit}/ha</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {l.confirmed ? (
                  <div>
                    <div style={{ fontSize: 12, color: '#2e6a3e', fontWeight: 600 }}>Confirmed</div>
                    {l.date_applied && <div style={{ fontSize: 11, color: '#6a7a70' }}>{l.date_applied}</div>}
                    {l.confirmed_by_name && <div style={{ fontSize: 11, color: '#6a7a70' }}>{l.confirmed_by_name}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#c5a030', fontWeight: 600 }}>Pending</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatRate(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString()
  if (v >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

const st: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.3)', zIndex: 50,
    display: 'flex', justifyContent: 'flex-end',
  },
  panel: {
    width: 480, maxWidth: '100vw', height: '100%', background: '#fff',
    overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
    fontFamily: 'Inter, sans-serif',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '24px 24px 16px', borderBottom: '1px solid #eae6df',
  },
  orchardName: { fontSize: 18, fontWeight: 700, color: '#1a2a3a' },
  orchardMeta: { fontSize: 13, color: '#6a7a70', marginTop: 4 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 24, color: '#6a7a70',
    cursor: 'pointer', padding: '0 4px',
  },
  progressRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 24px', background: '#f8f6f2',
  },
  progressBar: {
    flex: 1, height: 6, background: '#e8e4dc', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: '#4caf72', borderRadius: 3, transition: 'width 0.3s',
  },
  progressText: { fontSize: 12, color: '#6a7a70', whiteSpace: 'nowrap' },
  section: { padding: '16px 24px', borderBottom: '1px solid #f0ede6' },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#6a7a70', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 10,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#6a7a70',
    fontSize: 11, borderBottom: '1px solid #e8e4dc', whiteSpace: 'nowrap',
  },
  td: { padding: '6px 8px', borderBottom: '1px solid #f0ede6', fontSize: 12 },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #f5f3f0',
  },
}

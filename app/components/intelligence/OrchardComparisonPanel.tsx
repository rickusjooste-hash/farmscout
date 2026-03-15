'use client'

import { useState, useMemo } from 'react'
import type { NormRange } from './insightEngine'
import { generateComparisonInsights, type CompareOrchardData } from './comparisonInsightEngine'

interface FertProduct {
  timing_label: string
  timing_sort: number
  product_name: string
  confirmed: boolean
  rate_per_ha: number
  unit: string
  n_pct: number
  p_pct: number
  k_pct: number
}

interface FertStatus {
  confirmed: number
  total: number
  products: FertProduct[]
}

interface ProductionData {
  tonHa: number | null
  tons: number
  bins: number
}

interface SizeData {
  dominantLabel: string
  avgWeightG: number
}

interface QcIssue {
  pest_name: string
  pct_of_fruit: number
}

interface OrchardRow {
  id: string
  name: string
  orchard_nr: number | null
  variety: string | null
  variety_group: string | null
  rootstock: string | null
  ha: number | null
  score: number
  commodity_id: string
  farm_id: string
}

interface Props {
  orchardIds: string[]
  orchards: OrchardRow[]
  fertByOrchard: Record<string, FertStatus>
  productionByOrchard: Record<string, ProductionData>
  prevProductionByOrchard: Record<string, ProductionData>
  sizeByOrchard: Record<string, SizeData>
  qcByOrchard: Record<string, QcIssue[]>
  nutrientsByOrchard: Record<string, Record<string, number>>
  normsByOrchard: Record<string, Record<string, NormRange>>
  varietyGroupAvgTonHa: Record<string, number>
  open: boolean
  onClose: () => void
  onRemoveOrchard: (id: string) => void
}

function normColor(value: number, norm: NormRange | undefined): string {
  if (!norm) return '#1a2a3a'
  if (value >= norm.min_optimal && value <= norm.max_optimal) return '#4caf72'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return '#f5c842'
  }
  if (norm.min_adequate != null || norm.max_adequate != null) return '#e85a4a'
  return '#1a2a3a'
}

function normDot(value: number | undefined, norm: NormRange | undefined): string {
  if (value == null || !norm) return '#d0ccc6'
  return normColor(value, norm)
}

function scoreColor(score: number): string {
  if (score >= 75) return '#4caf72'
  if (score >= 50) return '#f5c842'
  if (score >= 25) return '#e8924a'
  return '#e85a4a'
}

// Best/worst highlighting
type Direction = 'higher' | 'lower' | 'norm' | 'none'

function cellBg(
  value: number | null,
  allValues: (number | null)[],
  direction: Direction,
): string {
  if (value == null || direction === 'none') return 'transparent'
  const valid = allValues.filter((v): v is number => v != null)
  if (valid.length < 2) return 'transparent'
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  if (min === max) return 'transparent'
  // Skip highlighting if difference < 5% and only 2 values
  if (valid.length === 2 && max > 0 && ((max - min) / max) < 0.05) return 'transparent'

  if (direction === 'higher') {
    if (value === max) return 'rgba(76,175,114,0.08)'
    if (value === min) return 'rgba(232,90,74,0.06)'
  }
  if (direction === 'lower') {
    if (value === min) return 'rgba(76,175,114,0.08)'
    if (value === max) return 'rgba(232,90,74,0.06)'
  }
  return 'transparent'
}

const SEVERITY_STYLES = {
  warning: {
    bg: 'rgba(245,200,66,0.08)', border: 'rgba(245,200,66,0.25)',
    iconBg: '#f5c842', iconColor: '#5a4a00', titleColor: '#9a7b1a',
  },
  info: {
    bg: 'rgba(33,118,217,0.06)', border: 'rgba(33,118,217,0.15)',
    iconBg: '#2176d9', iconColor: '#fff', titleColor: '#1a5fb4',
  },
}

export default function OrchardComparisonPanel(props: Props) {
  const {
    orchardIds, orchards, fertByOrchard, productionByOrchard, prevProductionByOrchard,
    sizeByOrchard, qcByOrchard, nutrientsByOrchard, normsByOrchard,
    varietyGroupAvgTonHa, open, onClose, onRemoveOrchard,
  } = props

  const [sameVariety, setSameVariety] = useState(false)

  // Resolve orchard objects in order
  const compared = useMemo(() =>
    orchardIds.map(id => orchards.find(o => o.id === id)).filter(Boolean) as OrchardRow[]
  , [orchardIds, orchards])

  const firstVariety = (compared[0]?.variety_group || compared[0]?.variety)?.toLowerCase() ?? null

  // Build comparison data for insight engine
  const comparisonData: CompareOrchardData[] = useMemo(() =>
    compared.map(o => {
      const nuts = nutrientsByOrchard[o.id] || {}
      const norms = normsByOrchard[o.id] || {}
      const prod = productionByOrchard[o.id]
      const prevProd = prevProductionByOrchard[o.id]
      const fert = fertByOrchard[o.id]
      const qcIssues = qcByOrchard[o.id] || []
      const size = sizeByOrchard[o.id]
      const totalIssueRate = qcIssues.length > 0
        ? qcIssues.reduce((s, q) => s + q.pct_of_fruit, 0) : null
      const topIssue = qcIssues[0] ? { name: qcIssues[0].pest_name, pct: qcIssues[0].pct_of_fruit } : null

      // NPK totals from all products (prescribed, not just confirmed) — matches scorecard display
      let fertN = 0, fertP = 0, fertK = 0
      if (fert) {
        for (const p of fert.products) {
          fertN += p.rate_per_ha * (p.n_pct || 0) / 100
          fertP += p.rate_per_ha * (p.p_pct || 0) / 100
          fertK += p.rate_per_ha * (p.k_pct || 0) / 100
        }
      }

      return {
        orchardId: o.id,
        orchardName: `${o.orchard_nr != null ? o.orchard_nr + ' ' : ''}${o.name}`,
        variety: o.variety,
        score: o.score,
        tonHa: prod?.tonHa ?? null,
        prevTonHa: prevProd?.tonHa ?? null,
        leafN: nuts['N'] ?? null,
        leafK: nuts['K'] ?? null,
        leafCa: nuts['Ca'] ?? null,
        nNorm: norms['N'] ?? null,
        kNorm: norms['K'] ?? null,
        caNorm: norms['Ca'] ?? null,
        fertConfirmedPct: fert ? (fert.total > 0 ? (fert.confirmed / fert.total) * 100 : null) : null,
        fertNKgHa: fertN > 0 ? fertN : null,
        fertPKgHa: fertP > 0 ? fertP : null,
        fertKKgHa: fertK > 0 ? fertK : null,
        avgWeightG: size?.avgWeightG ?? null,
        totalIssueRate,
        topIssue,
      }
    })
  , [compared, nutrientsByOrchard, normsByOrchard, productionByOrchard, prevProductionByOrchard, fertByOrchard, qcByOrchard, sizeByOrchard])

  const comparisonInsights = useMemo(() => generateComparisonInsights(comparisonData), [comparisonData])

  // Helper: is this orchard dimmed by same-variety filter?
  const isDimmed = (o: OrchardRow) =>
    sameVariety && firstVariety != null && (o.variety_group || o.variety)?.toLowerCase() !== firstVariety

  // Column width
  const colCount = compared.length
  const metricColWidth = 120
  const orchardColWidth = colCount <= 2 ? 200 : colCount === 3 ? 180 : 160

  // Build metric rows
  type MetricRow = {
    section: string
    label: string
    direction: Direction
    values: { display: string; raw: number | null; normBased?: string }[]
  }

  const rows: MetricRow[] = useMemo(() => {
    const r: MetricRow[] = []

    // Section A: Fertilizer
    r.push({
      section: 'Fertilizer', label: 'Compliance', direction: 'higher',
      values: compared.map(o => {
        const f = fertByOrchard[o.id]
        if (!f || f.total === 0) return { display: '\u2014', raw: null }
        const pct = Math.round(f.confirmed / f.total * 100)
        return { display: `${f.confirmed}/${f.total} (${pct}%)`, raw: pct }
      }),
    })
    r.push({
      section: 'Fertilizer', label: 'N applied kg/ha', direction: 'none',
      values: compared.map(o => {
        const cd = comparisonData.find(c => c.orchardId === o.id)
        return cd?.fertNKgHa != null ? { display: cd.fertNKgHa.toFixed(1), raw: cd.fertNKgHa } : { display: '\u2014', raw: null }
      }),
    })
    r.push({
      section: 'Fertilizer', label: 'P applied kg/ha', direction: 'none',
      values: compared.map(o => {
        const cd = comparisonData.find(c => c.orchardId === o.id)
        return cd?.fertPKgHa != null ? { display: cd.fertPKgHa.toFixed(1), raw: cd.fertPKgHa } : { display: '\u2014', raw: null }
      }),
    })
    r.push({
      section: 'Fertilizer', label: 'K applied kg/ha', direction: 'none',
      values: compared.map(o => {
        const cd = comparisonData.find(c => c.orchardId === o.id)
        return cd?.fertKKgHa != null ? { display: cd.fertKKgHa.toFixed(1), raw: cd.fertKKgHa } : { display: '\u2014', raw: null }
      }),
    })

    // Section B: Leaf Analysis
    for (const code of ['N', 'K', 'Ca', 'Mg']) {
      r.push({
        section: 'Leaf Analysis', label: code, direction: 'norm',
        values: compared.map(o => {
          const val = nutrientsByOrchard[o.id]?.[code]
          const norm = normsByOrchard[o.id]?.[code]
          if (val == null) return { display: '\u2014', raw: null }
          return { display: `${val.toFixed(2)}%`, raw: val, normBased: normDot(val, norm) }
        }),
      })
    }
    // N:K ratio
    r.push({
      section: 'Leaf Analysis', label: 'N:K ratio', direction: 'none',
      values: compared.map(o => {
        const n = nutrientsByOrchard[o.id]?.['N']
        const k = nutrientsByOrchard[o.id]?.['K']
        if (n == null || k == null || k === 0) return { display: '\u2014', raw: null }
        const ratio = n / k
        return { display: `${ratio.toFixed(1)}:1`, raw: ratio }
      }),
    })

    // Section C: Production
    r.push({
      section: 'Production', label: 'T/Ha', direction: 'higher',
      values: compared.map(o => {
        const p = productionByOrchard[o.id]
        return p?.tonHa != null ? { display: p.tonHa.toFixed(1), raw: p.tonHa } : { display: '\u2014', raw: null }
      }),
    })
    r.push({
      section: 'Production', label: 'vs Prev Season', direction: 'higher',
      values: compared.map(o => {
        const cur = productionByOrchard[o.id]?.tonHa
        const prev = prevProductionByOrchard[o.id]?.tonHa
        if (cur == null || prev == null || prev === 0) return { display: '\u2014', raw: null }
        const delta = ((cur - prev) / prev) * 100
        return { display: `${delta >= 0 ? '\u2191' : '\u2193'}${Math.abs(delta).toFixed(0)}%`, raw: delta }
      }),
    })
    r.push({
      section: 'Production', label: 'vs Variety Avg', direction: 'higher',
      values: compared.map(o => {
        const cur = productionByOrchard[o.id]?.tonHa
        const groupKey = (o.variety_group || o.variety || '__none__').toLowerCase()
        const groupAvg = varietyGroupAvgTonHa[groupKey]
        if (cur == null || groupAvg == null || groupAvg === 0) return { display: '\u2014', raw: null }
        const delta = ((cur - groupAvg) / groupAvg) * 100
        return { display: `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`, raw: delta }
      }),
    })

    // Section D: Fruit Size
    r.push({
      section: 'Fruit Size', label: 'Avg Weight', direction: 'higher',
      values: compared.map(o => {
        const s = sizeByOrchard[o.id]
        return s ? { display: `${s.avgWeightG.toFixed(0)}g`, raw: s.avgWeightG } : { display: '\u2014', raw: null }
      }),
    })
    r.push({
      section: 'Fruit Size', label: 'Dominant Bin', direction: 'none',
      values: compared.map(o => {
        const s = sizeByOrchard[o.id]
        return s ? { display: s.dominantLabel, raw: null } : { display: '\u2014', raw: null }
      }),
    })

    // Section E: Quality
    r.push({
      section: 'Quality', label: 'Total Issue Rate', direction: 'lower',
      values: compared.map(o => {
        const issues = qcByOrchard[o.id] || []
        if (issues.length === 0) return { display: '\u2014', raw: null }
        const total = issues.reduce((s, q) => s + q.pct_of_fruit, 0)
        return { display: `${total.toFixed(1)}%`, raw: total }
      }),
    })
    r.push({
      section: 'Quality', label: 'Top Issue', direction: 'lower',
      values: compared.map(o => {
        const top = qcByOrchard[o.id]?.[0]
        return top ? { display: `${top.pest_name} ${top.pct_of_fruit.toFixed(1)}%`, raw: top.pct_of_fruit } : { display: '\u2014', raw: null }
      }),
    })
    r.push({
      section: 'Quality', label: '2nd Issue', direction: 'lower',
      values: compared.map(o => {
        const second = qcByOrchard[o.id]?.[1]
        return second ? { display: `${second.pest_name} ${second.pct_of_fruit.toFixed(1)}%`, raw: second.pct_of_fruit } : { display: '\u2014', raw: null }
      }),
    })

    return r
  }, [compared, fertByOrchard, comparisonData, nutrientsByOrchard, normsByOrchard, productionByOrchard, prevProductionByOrchard, varietyGroupAvgTonHa, sizeByOrchard, qcByOrchard])

  if (compared.length < 2) return null

  return (
    <>
      <style>{`
        .iocp-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.2);
          z-index: 8000; opacity: 0; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .iocp-overlay.open { opacity: 1; pointer-events: auto; }
        .iocp-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 900px; max-width: 100vw; background: #fff;
          z-index: 8001; overflow-y: auto;
          transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: -4px 0 24px rgba(0,0,0,0.08);
          font-family: 'Inter', sans-serif;
        }
        .iocp-panel.open { transform: translateX(0); }
        @media (max-width: 900px) { .iocp-panel { width: 100vw; } }
      `}</style>

      <div className={`iocp-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`iocp-panel${open ? ' open' : ''}`}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #eef2fa',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#fff', zIndex: 2,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2a3a' }}>
            Comparing {compared.length} Orchards
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6a7a70', cursor: 'pointer' }}>
              Same variety only
              <button
                onClick={() => setSameVariety(!sameVariety)}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none',
                  background: sameVariety ? '#2176d9' : '#d4cfca', cursor: 'pointer',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: sameVariety ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }} />
              </button>
            </label>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e4dc',
              background: '#fff', fontSize: 16, cursor: 'pointer', color: '#6a7a70',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>&times;</button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ padding: '16px 24px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            {/* Orchard column headers */}
            <thead>
              <tr>
                <th style={{ ...st.metricTh, width: metricColWidth }} />
                {compared.map(o => (
                  <th key={o.id} style={{
                    ...st.orchTh,
                    width: orchardColWidth,
                    opacity: isDimmed(o) ? 0.35 : 1,
                  }}>
                    <div style={{ fontWeight: 700, color: '#1a2a3a', fontSize: 14 }}>
                      {o.orchard_nr != null ? `${o.orchard_nr} ` : ''}{o.name}
                      {(o.variety_group || o.variety) ? ` (${o.variety_group || o.variety})` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#8a95a0', marginTop: 2 }}>
                      {o.rootstock || '\u2014'} {'\u00B7'} {o.ha ? `${o.ha} ha` : '\u2014'}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 8,
                        background: `${scoreColor(o.score)}18`, color: scoreColor(o.score),
                        fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      }}>
                        {o.score}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveOrchard(o.id)}
                      style={{
                        marginTop: 6, padding: '2px 8px', fontSize: 11, color: '#8a95a0',
                        background: 'none', border: '1px solid #e8e4dc', borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      &times; remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, ri) => {
                // Section header
                const isFirstInSection = ri === 0 || rows[ri - 1].section !== row.section
                const allRaw = row.values.map(v => v.raw)

                return [
                  isFirstInSection && (
                    <tr key={`section-${row.section}`}>
                      <td
                        colSpan={1 + colCount}
                        style={{
                          padding: '14px 0 6px', fontSize: 11, fontWeight: 700,
                          color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.8px',
                          borderBottom: '1px solid #eef2fa',
                        }}
                      >
                        {row.section}
                      </td>
                    </tr>
                  ),
                  <tr key={`row-${ri}`}>
                    <td style={st.metricTd}>{row.label}</td>
                    {row.values.map((v, ci) => {
                      const o = compared[ci]
                      const bg = row.direction === 'norm' && v.normBased
                        ? (v.raw != null ? `${v.normBased}18` : 'transparent')
                        : cellBg(v.raw, allRaw, row.direction)
                      return (
                        <td key={o.id} style={{
                          ...st.valueTd,
                          background: bg,
                          opacity: isDimmed(o) ? 0.35 : 1,
                        }}>
                          {row.direction === 'norm' && v.normBased && v.raw != null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <span style={{
                                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                                background: v.normBased,
                              }} />
                              {v.display}
                            </div>
                          ) : (
                            <span style={{ color: v.raw == null ? '#d0ccc6' : '#1a2a3a' }}>{v.display}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>,
                ]
              })}
            </tbody>
          </table>
        </div>

        {/* Comparison Insights */}
        {comparisonInsights.length > 0 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #eef2fa' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase',
              letterSpacing: '0.8px', marginBottom: 12,
            }}>
              Comparison Insights
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comparisonInsights.map((ins, i) => {
                const s = SEVERITY_STYLES[ins.severity]
                return (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: s.bg, border: `1px solid ${s.border}`,
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: s.iconBg, color: s.iconColor,
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginTop: 1,
                      }}>
                        {ins.severity === 'warning' ? '!' : 'i'}
                      </div>
                      <div style={{ fontSize: 12, color: '#1a2a3a', lineHeight: 1.5 }}>
                        {ins.text}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

const st: Record<string, React.CSSProperties> = {
  metricTh: {
    textAlign: 'left', padding: '10px 8px', fontWeight: 600,
    color: '#5a6a60', fontSize: 12, verticalAlign: 'bottom',
  },
  orchTh: {
    textAlign: 'center', padding: '12px 8px', verticalAlign: 'bottom',
    borderBottom: '2px solid #e0dbd4',
  },
  metricTd: {
    padding: '8px 8px', fontWeight: 500, color: '#5a6a60', fontSize: 12,
    borderBottom: '1px solid #f0ede6', whiteSpace: 'nowrap',
  },
  valueTd: {
    padding: '8px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #f0ede6', fontSize: 13,
  },
}

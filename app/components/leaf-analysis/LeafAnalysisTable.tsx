'use client'

import { useState, useMemo } from 'react'

interface SummaryRow {
  orchard_id: string
  orchard_name: string
  commodity_name: string
  season: string
  sample_date: string
  sample_type: string
  lab_name: string
  nutrient_code: string
  nutrient_name: string
  category: string
  value: number
  unit: string
  display_order: number
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

interface NormRange {
  min_optimal: number
  max_optimal: number
  min_adequate: number | null
  max_adequate: number | null
}

interface Props {
  data: SummaryRow[]
  selectedOrchardId: string | null
  onSelectOrchard: (id: string) => void
  loading?: boolean
  productionByOrchard?: Record<string, ProductionData>
  sizeByOrchard?: Record<string, SizeData>
  normsLookup?: Record<string, NormRange>  // key: "commodity_id:nutrient_code"
  commodityByOrchard?: Record<string, string>  // orchard_id → commodity_id
  varietyByOrchard?: Record<string, string>  // orchard_id → variety
  pdfByOrchard?: Record<string, string>  // orchard_id → pdf_url
}

const MACRO_CODES = new Set(['N', 'P', 'K', 'Ca', 'Mg', 'S'])

function tonHaColor(tonHa: number | null): string {
  if (tonHa == null) return '#aaa'
  if (tonHa >= 50) return '#2176d9'
  if (tonHa >= 30) return '#4caf72'
  if (tonHa >= 15) return '#f5c842'
  return '#e85a4a'
}

function tonHaBg(tonHa: number | null): string {
  if (tonHa == null) return 'transparent'
  if (tonHa >= 50) return 'rgba(33,118,217,0.10)'
  if (tonHa >= 30) return 'rgba(76,175,114,0.10)'
  if (tonHa >= 15) return 'rgba(245,200,66,0.10)'
  return 'rgba(232,90,74,0.10)'
}

function normBg(value: number, norm: NormRange | undefined): string {
  if (!norm) return 'transparent'
  if (value >= norm.min_optimal && value <= norm.max_optimal) return 'rgba(76,175,114,0.12)'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return 'rgba(245,200,66,0.12)'
  }
  // Outside adequate = red (only if norms are populated)
  if (norm.min_adequate != null || norm.max_adequate != null) return 'rgba(232,90,74,0.12)'
  return 'transparent'
}

function normTooltip(value: number, norm: NormRange | undefined, code: string, unit: string): string | undefined {
  if (!norm) return undefined
  const isMacro = MACRO_CODES.has(code)
  const dec = isMacro ? 2 : 0
  const status = value >= norm.min_optimal && value <= norm.max_optimal
    ? 'Optimal'
    : (norm.min_adequate != null && norm.max_adequate != null && value >= norm.min_adequate && value <= norm.max_adequate)
      ? 'Adequate'
      : 'Outside range'
  let tip = `${code}: ${value.toFixed(isMacro ? 2 : 1)} ${unit}\n`
  tip += `Optimal: ${norm.min_optimal.toFixed(dec)} \u2013 ${norm.max_optimal.toFixed(dec)}\n`
  if (norm.min_adequate != null && norm.max_adequate != null) {
    tip += `Adequate: ${norm.min_adequate.toFixed(dec)} \u2013 ${norm.max_adequate.toFixed(dec)}\n`
  }
  tip += `\u2192 ${status}`
  return tip
}

export default function LeafAnalysisTable({
  data, selectedOrchardId, onSelectOrchard, loading,
  productionByOrchard, sizeByOrchard, normsLookup, commodityByOrchard, varietyByOrchard,
  pdfByOrchard,
}: Props) {
  const [sortCol, setSortCol] = useState<string>('orchard_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const hasProduction = productionByOrchard && Object.keys(productionByOrchard).length > 0
  const hasSize = sizeByOrchard && Object.keys(sizeByOrchard).length > 0
  const hasPdf = pdfByOrchard && Object.keys(pdfByOrchard).length > 0

  // Discover all nutrients present in the data, ordered by display_order
  const nutrientCols = useMemo(() => {
    const seen = new Map<string, { code: string; unit: string; order: number }>()
    for (const r of data) {
      if (!seen.has(r.nutrient_code)) {
        seen.set(r.nutrient_code, { code: r.nutrient_code, unit: r.unit, order: r.display_order })
      }
    }
    return [...seen.values()].sort((a, b) => a.order - b.order)
  }, [data])

  // Pivot data: one row per orchard with nutrient values as columns
  const orchardRows = useMemo(() => {
    const map = new Map<string, {
      orchard_id: string
      orchard_name: string
      commodity_name: string
      season: string
      sample_date: string
      lab_name: string
      nutrients: Record<string, { value: number; unit: string }>
    }>()

    for (const r of data) {
      let row = map.get(r.orchard_id)
      if (!row) {
        row = {
          orchard_id: r.orchard_id,
          orchard_name: r.orchard_name,
          commodity_name: r.commodity_name,
          season: r.season,
          sample_date: r.sample_date,
          lab_name: r.lab_name,
          nutrients: {},
        }
        map.set(r.orchard_id, row)
      }
      row.nutrients[r.nutrient_code] = { value: r.value, unit: r.unit }
    }

    return [...map.values()]
  }, [data])

  const nutrientCodeSet = useMemo(() => new Set(nutrientCols.map(n => n.code)), [nutrientCols])

  // Sort
  const sorted = useMemo(() => {
    return [...orchardRows].sort((a, b) => {
      let va: any, vb: any
      if (sortCol === 'variety') {
        va = varietyByOrchard?.[a.orchard_id] ?? ''
        vb = varietyByOrchard?.[b.orchard_id] ?? ''
      } else if (sortCol === 'tonHa') {
        va = productionByOrchard?.[a.orchard_id]?.tonHa ?? -1
        vb = productionByOrchard?.[b.orchard_id]?.tonHa ?? -1
      } else if (sortCol === 'size') {
        va = sizeByOrchard?.[a.orchard_id]?.avgWeightG ?? 0
        vb = sizeByOrchard?.[b.orchard_id]?.avgWeightG ?? 0
      } else if (nutrientCodeSet.has(sortCol)) {
        va = a.nutrients[sortCol]?.value ?? -1
        vb = b.nutrients[sortCol]?.value ?? -1
      } else {
        va = (a as any)[sortCol] ?? ''
        vb = (b as any)[sortCol] ?? ''
      }
      if (typeof va === 'string') {
        const cmp = va.localeCompare(vb)
        return sortDir === 'asc' ? cmp : -cmp
      }
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [orchardRows, sortCol, sortDir, nutrientCodeSet, productionByOrchard, sizeByOrchard, varietyByOrchard])

  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const arrow = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''

  // Build norm lookup helper: variety-specific → commodity-level → undefined
  function getNorm(orchardId: string, nutrientCode: string): NormRange | undefined {
    if (!normsLookup || !commodityByOrchard) return undefined
    const commId = commodityByOrchard[orchardId]
    if (!commId) return undefined
    // Try variety-specific first
    const variety = varietyByOrchard?.[orchardId]
    if (variety) {
      const varNorm = normsLookup[`${commId}:${variety}:${nutrientCode}`]
      if (varNorm) return varNorm
    }
    return normsLookup[`${commId}:${nutrientCode}`]
  }

  if (loading) {
    return (
      <div style={s.card}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ height: 40, background: '#f4f1eb', borderRadius: 8, marginBottom: 8, animation: 'lat-pulse 1.5s ease infinite' }} />
        ))}
        <style>{`@keyframes lat-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    )
  }

  if (orchardRows.length === 0) {
    return (
      <div style={{ ...s.card, textAlign: 'center', color: '#999', padding: 40 }}>
        No leaf analysis data for this selection
      </div>
    )
  }

  const hasNorms = normsLookup && Object.keys(normsLookup).length > 0
  const hasAnyColor = hasNorms || hasProduction

  return (
    <div style={s.card}>
      {/* Legend */}
      {hasAnyColor && (
        <div style={s.legend}>
          {hasNorms && (
            <>
              <span style={s.legendLabel}>Nutrients:</span>
              <span style={s.legendItem}><span style={{ ...s.legendSwatch, background: 'rgba(76,175,114,0.18)' }} />Optimal</span>
              <span style={s.legendItem}><span style={{ ...s.legendSwatch, background: 'rgba(245,200,66,0.18)' }} />Adequate</span>
              <span style={s.legendItem}><span style={{ ...s.legendSwatch, background: 'rgba(232,90,74,0.18)' }} />Outside range</span>
              <a href="/orchards/leaf-analysis/norms" style={{ color: '#2176d9', fontSize: 11, textDecoration: 'none', marginLeft: 4 }}>
                Manage norms &rarr;
              </a>
            </>
          )}
          {hasNorms && hasProduction && <span style={{ width: 1, height: 14, background: '#e0dbd4' }} />}
          {hasProduction && (
            <>
              <span style={s.legendLabel}>T/Ha:</span>
              <span style={s.legendItem}><span style={{ ...s.legendSwatch, background: 'rgba(33,118,217,0.15)' }} />{'\u2265'}50</span>
              <span style={s.legendItem}><span style={{ ...s.legendSwatch, background: 'rgba(76,175,114,0.15)' }} />{'\u2265'}30</span>
              <span style={s.legendItem}><span style={{ ...s.legendSwatch, background: 'rgba(245,200,66,0.15)' }} />{'\u2265'}15</span>
              <span style={s.legendItem}><span style={{ ...s.legendSwatch, background: 'rgba(232,90,74,0.15)' }} />{'<'}15</span>
            </>
          )}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, position: 'sticky', left: 0, zIndex: 2, background: '#f2efea' }} onClick={() => handleSort('orchard_name')}>
                Orchard{arrow('orchard_name')}
              </th>
              <th style={s.th} onClick={() => handleSort('commodity_name')}>
                Commodity{arrow('commodity_name')}
              </th>
              <th style={s.th} onClick={() => handleSort('variety')}>
                Variety{arrow('variety')}
              </th>
              {hasProduction && (
                <th style={{ ...s.th, ...s.thNum }} onClick={() => handleSort('tonHa')}>
                  T/Ha{arrow('tonHa')}
                </th>
              )}
              {hasSize && (
                <th style={{ ...s.th, ...s.thNum }} onClick={() => handleSort('size')}>
                  Size{arrow('size')}
                </th>
              )}
              {nutrientCols.map(({ code, unit }) => (
                <th key={code} style={{ ...s.th, ...s.thNum }} onClick={() => handleSort(code)}>
                  {code}
                  <div style={{ fontSize: 10, fontWeight: 400, color: '#999' }}>{unit}</div>
                  {arrow(code)}
                </th>
              ))}
              <th style={s.th}>Date</th>
              <th style={s.th}>Lab</th>
              <th style={{ ...s.th, textAlign: 'center' }}>PDF</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const isSelected = row.orchard_id === selectedOrchardId
              const prod = productionByOrchard?.[row.orchard_id]
              const size = sizeByOrchard?.[row.orchard_id]
              const stripe = idx % 2 === 1
              const rowBg = isSelected ? '#e8f0fe' : stripe ? '#f8f6f2' : '#fff'
              return (
                <tr
                  key={row.orchard_id}
                  onClick={() => onSelectOrchard(row.orchard_id)}
                  style={{
                    ...s.tr,
                    background: rowBg,
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ ...s.td, position: 'sticky', left: 0, background: rowBg, fontWeight: 500 }}>
                    {row.orchard_name}
                  </td>
                  <td style={{ ...s.td, color: '#6a7a70' }}>{row.commodity_name}</td>
                  <td style={{ ...s.td, color: '#6a7a70' }}>{varietyByOrchard?.[row.orchard_id] || '\u2014'}</td>
                  {hasProduction && (
                    <td style={{
                      ...s.td, ...s.tdNum,
                      background: isSelected ? '#e8f0fe' : tonHaBg(prod?.tonHa ?? null) !== 'transparent' ? tonHaBg(prod?.tonHa ?? null) : rowBg,
                      color: tonHaColor(prod?.tonHa ?? null),
                      fontWeight: prod?.tonHa != null ? 600 : 400,
                    }}>
                      {prod?.tonHa != null ? prod.tonHa.toFixed(1) : '\u2014'}
                    </td>
                  )}
                  {hasSize && (
                    <td style={{ ...s.td, ...s.tdNum, color: '#6a7a70', fontSize: 12 }}>
                      {size ? (
                        <span title={size.dominantLabel}>{size.avgWeightG}g</span>
                      ) : '\u2014'}
                    </td>
                  )}
                  {nutrientCols.map(({ code }) => {
                    const n = row.nutrients[code]
                    const norm = getNorm(row.orchard_id, code)
                    const cellNormBg = n && !isSelected ? normBg(n.value, norm) : 'transparent'
                    const tooltip = n ? normTooltip(n.value, norm, code, n.unit) : undefined
                    return (
                      <td key={code} title={tooltip} style={{
                        ...s.td, ...s.tdNum,
                        background: cellNormBg !== 'transparent' ? cellNormBg : rowBg,
                      }}>
                        {n ? n.value.toFixed(MACRO_CODES.has(code) ? 2 : 1) : '\u2014'}
                      </td>
                    )
                  })}
                  <td style={{ ...s.td, color: '#6a7a70', fontSize: 12 }}>
                    {row.sample_date ? new Date(row.sample_date + 'T00:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) : '\u2014'}
                  </td>
                  <td style={{ ...s.td, color: '#6a7a70', fontSize: 12 }}>{row.lab_name || '\u2014'}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    {pdfByOrchard?.[row.orchard_id] ? (
                      <a
                        href={pdfByOrchard[row.orchard_id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        title="View lab report PDF"
                        style={{ color: '#2176d9', textDecoration: 'none', fontSize: 16 }}
                      >
                        &#128196;
                      </a>
                    ) : '\u2014'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  legend: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    padding: '10px 12px', borderBottom: '1px solid #f0ede6',
    fontSize: 11, color: '#6a7a70',
  },
  legendLabel: {
    fontWeight: 600, color: '#5a6a60', fontSize: 11,
  },
  legendItem: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  legendSwatch: {
    display: 'inline-block', width: 14, height: 14, borderRadius: 3,
    border: '1px solid rgba(0,0,0,0.06)',
  },
  card: {
    background: '#fff', borderRadius: 14, padding: 0,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif',
    fontSize: 13,
  },
  th: {
    textAlign: 'left', padding: '10px 8px', fontWeight: 600,
    color: '#5a6a60', fontSize: 12, borderBottom: '2px solid #e0dbd4',
    cursor: 'pointer', whiteSpace: 'nowrap',
    background: '#f2efea', userSelect: 'none',
  },
  thNum: { textAlign: 'right' },
  tr: {
    transition: 'background 0.1s',
  },
  td: {
    padding: '10px 8px', borderBottom: '1px solid #f0ede6',
    color: '#1a2a3a', whiteSpace: 'nowrap',
  },
  tdNum: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
}

'use client'

import { useMemo, useState } from 'react'

interface SummaryRow {
  recommendation_id: string
  orchard_id: string
  orchard_name: string
  timing_id: string
  timing_label: string
  timing_sort: number
  product_id: string
  product_name: string
  rate_per_ha: number
  unit: string
  total_qty: number | null
  ha: number | null
  n_pct: number
  p_pct: number
  k_pct: number
}

interface Props {
  data: SummaryRow[]
  loading: boolean
}

export default function FertilizerTable({ data, loading }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Build structure: timings (sorted), products per timing, orchards
  const timings = useMemo(() => {
    const map = new Map<string, { id: string; label: string; sort: number; products: Map<string, string> }>()
    for (const row of data) {
      if (!map.has(row.timing_id)) {
        map.set(row.timing_id, { id: row.timing_id, label: row.timing_label, sort: row.timing_sort, products: new Map() })
      }
      map.get(row.timing_id)!.products.set(row.product_id, row.product_name)
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort)
  }, [data])

  // Flat column list: timing+product combos
  const columns = useMemo(() => {
    const cols: Array<{ timingId: string; timingLabel: string; productId: string; productName: string }> = []
    for (const t of timings) {
      const prods = [...t.products.entries()].sort((a, b) => a[1].localeCompare(b[1]))
      for (const [pid, pname] of prods) {
        cols.push({ timingId: t.id, timingLabel: t.label, productId: pid, productName: pname })
      }
    }
    return cols
  }, [timings])

  // Build orchard rows
  const orchardRows = useMemo(() => {
    const map = new Map<string, { orchardId: string; orchardName: string; ha: number | null; values: Record<string, number> }>()
    for (const row of data) {
      if (!row.orchard_id) continue
      if (!map.has(row.orchard_id)) {
        map.set(row.orchard_id, { orchardId: row.orchard_id, orchardName: row.orchard_name || 'Unknown', ha: row.ha, values: {} })
      }
      const key = `${row.timing_id}:${row.product_id}`
      map.get(row.orchard_id)!.values[key] = row.rate_per_ha
    }
    let rows = [...map.values()]

    // Sort
    if (sortCol === 'orchard') {
      rows.sort((a, b) => sortDir === 'asc' ? a.orchardName.localeCompare(b.orchardName) : b.orchardName.localeCompare(a.orchardName))
    } else if (sortCol === 'ha') {
      rows.sort((a, b) => sortDir === 'asc' ? (a.ha ?? 0) - (b.ha ?? 0) : (b.ha ?? 0) - (a.ha ?? 0))
    } else if (sortCol) {
      rows.sort((a, b) => {
        const va = a.values[sortCol] ?? 0
        const vb = b.values[sortCol] ?? 0
        return sortDir === 'asc' ? va - vb : vb - va
      })
    } else {
      rows.sort((a, b) => a.orchardName.localeCompare(b.orchardName))
    }

    return rows
  }, [data, sortCol, sortDir])

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6a7a70' }}>Loading...</div>
  }

  if (data.length === 0) return null

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e8e4dc', borderRadius: 12, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <table style={st.table}>
        <thead>
          {/* Timing group headers */}
          <tr>
            <th style={{ ...st.th, borderBottom: '1px solid #e8e4dc' }} colSpan={2}></th>
            {timings.map(t => {
              const colCount = columns.filter(c => c.timingId === t.id).length
              return (
                <th key={t.id} colSpan={colCount} style={{ ...st.th, textAlign: 'center', borderBottom: '1px solid #e8e4dc', background: '#edf4fd', color: '#2176d9', fontSize: 11 }}>
                  {t.label}
                </th>
              )
            })}
          </tr>
          {/* Product sub-headers */}
          <tr>
            <th
              style={{ ...st.th, position: 'sticky', left: 0, zIndex: 3, background: '#f5f3ee', minWidth: 160, cursor: 'pointer' }}
              onClick={() => toggleSort('orchard')}
            >
              Orchard {sortCol === 'orchard' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
            </th>
            <th
              style={{ ...st.th, textAlign: 'right', minWidth: 50, cursor: 'pointer' }}
              onClick={() => toggleSort('ha')}
            >
              Ha {sortCol === 'ha' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
            </th>
            {columns.map(c => {
              const key = `${c.timingId}:${c.productId}`
              return (
                <th
                  key={key}
                  style={{ ...st.th, textAlign: 'right', minWidth: 70, cursor: 'pointer', fontSize: 10 }}
                  onClick={() => toggleSort(key)}
                  title={`${c.timingLabel} \u2192 ${c.productName}`}
                >
                  {c.productName}
                  {sortCol === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {orchardRows.map(row => (
            <tr key={row.orchardId}>
              <td style={{ ...st.td, position: 'sticky', left: 0, background: '#fff', fontWeight: 500, fontSize: 12, zIndex: 1 }}>
                {row.orchardName}
              </td>
              <td style={{ ...st.td, textAlign: 'right', fontSize: 12, color: '#6a7a70' }}>
                {row.ha != null ? row.ha.toFixed(1) : '\u2014'}
              </td>
              {columns.map(c => {
                const key = `${c.timingId}:${c.productId}`
                const val = row.values[key]
                return (
                  <td key={key} style={{ ...st.td, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {val != null && val > 0 ? (
                      <span style={{ color: '#1a2a3a' }}>{formatRate(val)}</span>
                    ) : (
                      <span style={{ color: '#ddd' }}>&mdash;</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatRate(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString()
  if (v >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

const st: Record<string, React.CSSProperties> = {
  table: {
    width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12,
  },
  th: {
    textAlign: 'left', padding: '8px 6px', fontWeight: 600, color: '#6a7a70',
    fontSize: 11, borderBottom: '2px solid #e8e4dc', background: '#f5f3ee',
    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2,
  },
  td: {
    padding: '6px 6px', borderBottom: '1px solid #f0ede6',
  },
}

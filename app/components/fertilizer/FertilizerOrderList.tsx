'use client'

import { useMemo, useState } from 'react'

interface OrderRow {
  timing_label: string
  timing_sort: number
  product_id: string
  product_name: string
  unit: string
  total_qty: number | null
  total_ha: number | null
  avg_rate_per_ha: number | null
  orchard_count: number
  n_pct: number
  p_pct: number
  k_pct: number
}

interface Props {
  data: OrderRow[]
  loading: boolean
}

type GroupBy = 'timing' | 'product'

export default function FertilizerOrderList({ data, loading }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>('timing')

  const grouped = useMemo(() => {
    if (groupBy === 'timing') {
      const map = new Map<string, { label: string; sort: number; rows: OrderRow[] }>()
      for (const row of data) {
        if (!map.has(row.timing_label)) {
          map.set(row.timing_label, { label: row.timing_label, sort: row.timing_sort, rows: [] })
        }
        map.get(row.timing_label)!.rows.push(row)
      }
      return [...map.values()].sort((a, b) => a.sort - b.sort)
    } else {
      const map = new Map<string, { label: string; sort: number; rows: OrderRow[] }>()
      for (const row of data) {
        if (!map.has(row.product_name)) {
          map.set(row.product_name, { label: row.product_name, sort: 0, rows: [] })
        }
        map.get(row.product_name)!.rows.push(row)
      }
      return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
    }
  }, [data, groupBy])

  function exportCSV() {
    const headers = ['Group', 'Product', 'Timing', 'Unit', 'Total Qty', 'Total Ha', 'Avg Rate/Ha', 'Orchards', 'N%', 'P%', 'K%']
    const rows = data.map(r => [
      groupBy === 'timing' ? r.timing_label : r.product_name,
      r.product_name,
      r.timing_label,
      r.unit,
      r.total_qty?.toFixed(1) ?? '',
      r.total_ha?.toFixed(1) ?? '',
      r.avg_rate_per_ha?.toFixed(2) ?? '',
      r.orchard_count,
      r.n_pct, r.p_pct, r.k_pct,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fertilizer_order_list.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6a7a70' }}>Loading...</div>
  }

  if (data.length === 0) return null

  // Grand totals
  const grandTotalQty = data.reduce((s, r) => s + (r.total_qty ?? 0), 0)
  const grandTotalHa = data.reduce((s, r) => s + (r.total_ha ?? 0), 0)

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => setGroupBy('timing')}
            style={{ ...st.toggleBtn, ...(groupBy === 'timing' ? st.toggleBtnActive : {}) }}
          >
            By Timing
          </button>
          <button
            onClick={() => setGroupBy('product')}
            style={{ ...st.toggleBtn, ...(groupBy === 'product' ? st.toggleBtnActive : {}) }}
          >
            By Product
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={st.actionBtn}>Export CSV</button>
          <button onClick={() => window.print()} style={st.actionBtn}>Print</button>
        </div>
      </div>

      {/* Groups */}
      {grouped.map(group => (
        <div key={group.label} style={{ marginBottom: 20 }}>
          <div style={st.groupHeader}>{group.label}</div>
          <div style={{ border: '1px solid #e8e4dc', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            <table style={st.table}>
              <thead>
                <tr>
                  <th style={st.th}>{groupBy === 'timing' ? 'Product' : 'Timing'}</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Avg Rate/Ha</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Unit</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Total Ha</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Total Qty</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>Orchards</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>N%</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>P%</th>
                  <th style={{ ...st.th, textAlign: 'right' }}>K%</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...st.td, fontWeight: 500 }}>
                      {groupBy === 'timing' ? row.product_name : row.timing_label}
                    </td>
                    <td style={{ ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {row.avg_rate_per_ha != null ? formatNum(row.avg_rate_per_ha) : '\u2014'}
                    </td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70' }}>{row.unit}</td>
                    <td style={{ ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {row.total_ha != null ? row.total_ha.toFixed(1) : '\u2014'}
                    </td>
                    <td style={{ ...st.td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {row.total_qty != null ? formatNum(row.total_qty) : '\u2014'}
                    </td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70' }}>{row.orchard_count}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70' }}>{row.n_pct > 0 ? row.n_pct : ''}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70' }}>{row.p_pct > 0 ? row.p_pct : ''}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70' }}>{row.k_pct > 0 ? row.k_pct : ''}</td>
                  </tr>
                ))}
                {/* Subtotal */}
                <tr style={{ background: '#f9f8f5' }}>
                  <td style={{ ...st.td, fontWeight: 600, color: '#6a7a70', fontSize: 11 }}>Subtotal</td>
                  <td style={st.td}></td>
                  <td style={st.td}></td>
                  <td style={st.td}></td>
                  <td style={{ ...st.td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatNum(group.rows.reduce((s, r) => s + (r.total_qty ?? 0), 0))}
                  </td>
                  <td style={st.td} colSpan={4}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Grand Total */}
      <div style={st.grandTotal}>
        <span>Grand Total: <strong>{formatNum(grandTotalQty)}</strong> across {grandTotalHa.toFixed(1)} ha</span>
      </div>
    </div>
  )
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (Math.abs(v) >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

const st: Record<string, React.CSSProperties> = {
  table: {
    width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 13,
  },
  th: {
    textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#6a7a70',
    fontSize: 11, borderBottom: '2px solid #e8e4dc', background: '#f5f3ee',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 10px', borderBottom: '1px solid #f0ede6', fontSize: 13,
  },
  groupHeader: {
    fontSize: 14, fontWeight: 600, color: '#1a2a3a', marginBottom: 8,
    fontFamily: 'Inter, sans-serif',
  },
  toggleBtn: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #d4cfca',
    background: '#fff', color: '#6a7a70', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  toggleBtnActive: {
    background: '#1a2a3a', color: '#fff', border: '1px solid #1a2a3a',
  },
  actionBtn: {
    padding: '6px 14px', borderRadius: 8, border: '1px solid #d4cfca',
    background: '#fff', color: '#1a2a3a', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  grandTotal: {
    padding: '12px 16px', background: '#f5f3ee', borderRadius: 10,
    fontSize: 14, color: '#1a2a3a', fontFamily: 'Inter, sans-serif',
  },
}

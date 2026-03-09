'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

export interface OrchardRow {
  id: string
  name: string
  variety: string | null
  commodityName: string
  ha: number | null
  tons: number
  tonHa: number | null
  bins: number
  bruisingPct: number | null
  pestStatus: string
  pestCount: number
}

interface Props {
  orchards: OrchardRow[]
  weeklyBins: Record<string, number[]>
  selectedOrchardId: string | null
  onOrchardSelect: (id: string | null) => void
  hasProduction: boolean
}

const STATUS_DOT: Record<string, string> = {
  green: '#4caf72', yellow: '#f5c842', red: '#e85a4a', blue: '#6b7fa8', grey: '#aaaaaa',
}

type SortKey = 'name' | 'variety' | 'ha' | 'tons' | 'tonHa' | 'bins' | 'bruisingPct' | 'pestCount'

function tonHaColor(v: number | null): string {
  if (v == null) return '#aaa'
  if (v >= 50) return '#2a6e45'
  if (v >= 30) return '#4caf72'
  if (v >= 15) return '#f5c842'
  return '#e85a4a'
}

export default function OrchardRankingTable({ orchards, weeklyBins, selectedOrchardId, onOrchardSelect, hasProduction }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(hasProduction ? 'tonHa' : 'name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(hasProduction ? 'desc' : 'asc')

  const sorted = useMemo(() => {
    const copy = [...orchards]
    copy.sort((a, b) => {
      let av: any = a[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
      let bv: any = b[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv as string).toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [orchards, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'name' || key === 'variety' ? 'asc' : 'desc') }
  }

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`
        .oa-th {
          position: sticky; top: 0; background: #f9f7f3; text-align: left;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
          color: #9aaa9f; font-weight: 700; padding: 8px 10px;
          border-bottom: 1px solid #f0ede6; cursor: pointer; white-space: nowrap;
          user-select: none;
        }
        .oa-th:hover { color: #1c3a2a; }
        .oa-td { padding: 8px 10px; font-size: 13px; color: #3a4a40; border-bottom: 1px solid #f9f7f3; }
        .oa-tr { cursor: pointer; transition: background 0.1s; }
        .oa-tr:hover .oa-td { background: #f9f7f3; }
        .oa-tr.oa-sel .oa-td { background: #f0f7f2; }
        @media (max-width: 768px) {
          .oa-ranking-table thead { display: none; }
          .oa-ranking-table .oa-tr {
            display: flex; flex-wrap: wrap; padding: 10px 14px;
            border-bottom: 1px solid #f0ede6; gap: 4px 12px;
          }
          .oa-ranking-table .oa-td { border-bottom: none; padding: 0; }
        }
      `}</style>
      <table className="oa-ranking-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="oa-th" onClick={() => toggleSort('name')}>Orchard{arrow('name')}</th>
            <th className="oa-th" onClick={() => toggleSort('variety')}>Variety{arrow('variety')}</th>
            <th className="oa-th" onClick={() => toggleSort('ha')} style={{ textAlign: 'right' }}>Ha{arrow('ha')}</th>
            {hasProduction && (
              <>
                <th className="oa-th" onClick={() => toggleSort('tonHa')} style={{ textAlign: 'right' }}>T/Ha{arrow('tonHa')}</th>
                <th className="oa-th" style={{ textAlign: 'center', width: 64 }}>Trend</th>
                <th className="oa-th" onClick={() => toggleSort('bins')} style={{ textAlign: 'right' }}>Bins{arrow('bins')}</th>
              </>
            )}
            <th className="oa-th" style={{ textAlign: 'center', width: 40 }}>Pest</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(o => {
            const sparkData = weeklyBins[o.id]
            const sel = o.id === selectedOrchardId
            return (
              <tr
                key={o.id}
                className={`oa-tr${sel ? ' oa-sel' : ''}`}
                onClick={() => onOrchardSelect(sel ? null : o.id)}
              >
                <td className="oa-td" style={{ fontWeight: 500 }}>{o.name}</td>
                <td className="oa-td" style={{ color: '#6a7a70', fontSize: 12 }}>{o.variety || '—'}</td>
                <td className="oa-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {o.ha != null ? o.ha.toLocaleString('en-ZA', { maximumFractionDigits: 1 }) : '—'}
                </td>
                {hasProduction && (
                  <>
                    <td className="oa-td" style={{ textAlign: 'right', fontWeight: 600, color: tonHaColor(o.tonHa), fontVariantNumeric: 'tabular-nums' }}>
                      {o.tonHa != null ? o.tonHa.toLocaleString('en-ZA', { maximumFractionDigits: 1 }) : '—'}
                    </td>
                    <td className="oa-td" style={{ textAlign: 'center' }}>
                      {sparkData && sparkData.length > 1 ? (
                        <ResponsiveContainer width={56} height={22}>
                          <LineChart data={sparkData.map((v, i) => ({ w: i, v }))}>
                            <Line type="monotone" dataKey="v" stroke="#2a6e45" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td className="oa-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {o.bins > 0 ? Math.round(o.bins).toLocaleString('en-ZA') : '—'}
                    </td>
                  </>
                )}
                <td className="oa-td" style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: 3,
                    background: STATUS_DOT[o.pestStatus] || '#aaa',
                  }} />
                </td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={hasProduction ? 7 : 4} className="oa-td" style={{ textAlign: 'center', color: '#9aaa9f', padding: 32 }}>No orchards found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

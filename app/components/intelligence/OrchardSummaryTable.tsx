'use client'

import { useState, useMemo } from 'react'
import type { NormRange } from './insightEngine'

interface FertStatus {
  confirmed: number
  total: number
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
  ha: number | null
  score: number
}

interface Props {
  orchards: OrchardRow[]
  fertByOrchard: Record<string, FertStatus>
  productionByOrchard: Record<string, ProductionData>
  prevProductionByOrchard: Record<string, ProductionData>
  sizeByOrchard: Record<string, SizeData>
  qcByOrchard: Record<string, QcIssue[]>
  nutrientsByOrchard: Record<string, Record<string, number>>
  normsByOrchard: Record<string, Record<string, NormRange>>
  farmAvgTonHa: number | null
  selectedOrchardId: string | null
  onSelectOrchard: (id: string) => void
  loading: boolean
}

type SortKey = 'name' | 'fert' | 'n' | 'k' | 'ca' | 'tonha' | 'delta' | 'size' | 'issue' | 'score'

function tonHaColor(tonHa: number | null): string {
  if (tonHa == null) return '#aaa'
  if (tonHa >= 50) return '#2176d9'
  if (tonHa >= 30) return '#4caf72'
  if (tonHa >= 15) return '#f5c842'
  return '#e85a4a'
}

function normDotColor(value: number | undefined, norm: NormRange | undefined): string {
  if (value == null || !norm) return '#d0ccc6'
  if (value >= norm.min_optimal && value <= norm.max_optimal) return '#4caf72'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return '#f5c842'
  }
  if (norm.min_adequate != null || norm.max_adequate != null) return '#e85a4a'
  return '#d0ccc6'
}

function scoreColor(score: number): string {
  if (score >= 75) return '#4caf72'
  if (score >= 50) return '#f5c842'
  if (score >= 25) return '#e8924a'
  return '#e85a4a'
}

export default function OrchardSummaryTable(props: Props) {
  const {
    orchards, fertByOrchard, productionByOrchard, prevProductionByOrchard,
    sizeByOrchard, qcByOrchard, nutrientsByOrchard, normsByOrchard,
    selectedOrchardId, onSelectOrchard, loading,
  } = props

  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortAsc, setSortAsc] = useState(true)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'score' || key === 'tonha' ? true : true) }
  }

  const sortedOrchards = useMemo(() => {
    const arr = [...orchards]
    const dir = sortAsc ? 1 : -1
    arr.sort((a, b) => {
      let av: number, bv: number
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'score':
          return dir * (a.score - b.score)
        case 'fert':
          av = fertByOrchard[a.id] ? fertByOrchard[a.id].confirmed / Math.max(fertByOrchard[a.id].total, 1) : -1
          bv = fertByOrchard[b.id] ? fertByOrchard[b.id].confirmed / Math.max(fertByOrchard[b.id].total, 1) : -1
          return dir * (av - bv)
        case 'n':
          av = nutrientsByOrchard[a.id]?.['N'] ?? -999
          bv = nutrientsByOrchard[b.id]?.['N'] ?? -999
          return dir * (av - bv)
        case 'k':
          av = nutrientsByOrchard[a.id]?.['K'] ?? -999
          bv = nutrientsByOrchard[b.id]?.['K'] ?? -999
          return dir * (av - bv)
        case 'ca':
          av = nutrientsByOrchard[a.id]?.['Ca'] ?? -999
          bv = nutrientsByOrchard[b.id]?.['Ca'] ?? -999
          return dir * (av - bv)
        case 'tonha':
          av = productionByOrchard[a.id]?.tonHa ?? -999
          bv = productionByOrchard[b.id]?.tonHa ?? -999
          return dir * (av - bv)
        case 'delta': {
          const getDelta = (id: string) => {
            const cur = productionByOrchard[id]?.tonHa
            const prev = prevProductionByOrchard[id]?.tonHa
            if (cur == null || prev == null || prev === 0) return -999
            return ((cur - prev) / prev) * 100
          }
          return dir * (getDelta(a.id) - getDelta(b.id))
        }
        case 'size':
          av = sizeByOrchard[a.id]?.avgWeightG ?? -999
          bv = sizeByOrchard[b.id]?.avgWeightG ?? -999
          return dir * (av - bv)
        case 'issue': {
          const topIssue = (id: string) => qcByOrchard[id]?.[0]?.pct_of_fruit ?? -999
          return dir * (topIssue(a.id) - topIssue(b.id))
        }
        default: return 0
      }
    })
    return arr
  }, [orchards, sortKey, sortAsc, fertByOrchard, productionByOrchard, prevProductionByOrchard, sizeByOrchard, qcByOrchard, nutrientsByOrchard])

  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 48, background: i % 2 ? '#f8f6f2' : '#fff', animation: 'isc-pulse 1.5s ease infinite' }} />
        ))}
        <style>{`@keyframes isc-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    )
  }

  if (orchards.length === 0) return null

  const sortArrow = (key: SortKey) => sortKey === key ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''

  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={st.table}>
          <thead>
            <tr>
              <th style={st.th} onClick={() => handleSort('name')}>Orchard{sortArrow('name')}</th>
              <th style={{ ...st.th, textAlign: 'center' }} onClick={() => handleSort('fert')}>Fert{sortArrow('fert')}</th>
              <th style={{ ...st.th, textAlign: 'center' }} onClick={() => handleSort('n')}>N{sortArrow('n')}</th>
              <th style={{ ...st.th, textAlign: 'center' }} onClick={() => handleSort('k')}>K{sortArrow('k')}</th>
              <th style={{ ...st.th, textAlign: 'center' }} onClick={() => handleSort('ca')}>Ca{sortArrow('ca')}</th>
              <th style={{ ...st.th, textAlign: 'right' }} onClick={() => handleSort('tonha')}>T/Ha{sortArrow('tonha')}</th>
              <th style={{ ...st.th, textAlign: 'right' }} onClick={() => handleSort('delta')}>{'\u0394'} Prev{sortArrow('delta')}</th>
              <th style={{ ...st.th, textAlign: 'center' }} onClick={() => handleSort('size')}>Size{sortArrow('size')}</th>
              <th style={st.th} onClick={() => handleSort('issue')}>Top Issue{sortArrow('issue')}</th>
              <th style={{ ...st.th, textAlign: 'right' }} onClick={() => handleSort('score')}>Score{sortArrow('score')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrchards.map((o, idx) => {
              const fert = fertByOrchard[o.id]
              const prod = productionByOrchard[o.id]
              const prevProd = prevProductionByOrchard[o.id]
              const size = sizeByOrchard[o.id]
              const issues = qcByOrchard[o.id]
              const nuts = nutrientsByOrchard[o.id] || {}
              const normsMap = normsByOrchard[o.id] || {}
              const topIssue = issues?.[0]
              const isSelected = selectedOrchardId === o.id

              const delta = prod?.tonHa != null && prevProd?.tonHa != null && prevProd.tonHa > 0
                ? ((prod.tonHa - prevProd.tonHa) / prevProd.tonHa * 100)
                : null

              const fertPct = fert ? Math.round(fert.confirmed / Math.max(fert.total, 1) * 100) : null

              return (
                <tr
                  key={o.id}
                  onClick={() => onSelectOrchard(o.id)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(33,118,217,0.06)' : idx % 2 ? '#f8f6f2' : '#fff',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget.style.background = '#f4f1eb') }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget.style.background = idx % 2 ? '#f8f6f2' : '#fff') }}
                >
                  {/* Orchard name */}
                  <td style={{ ...st.td, fontWeight: 500 }}>
                    {o.orchard_nr != null ? `${o.orchard_nr} ` : ''}{o.name}{o.variety ? ` (${o.variety})` : ''}
                  </td>

                  {/* Fert mini bar */}
                  <td style={{ ...st.td, textAlign: 'center' }}>
                    {fertPct != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <div style={{ width: 40, height: 6, borderRadius: 3, background: '#e8e4dc', overflow: 'hidden' }}>
                          <div style={{
                            width: `${fertPct}%`, height: '100%', borderRadius: 3,
                            background: fertPct >= 100 ? '#4caf72' : fertPct >= 50 ? '#f5c842' : '#e85a4a',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#6a7a70' }}>{fertPct}%</span>
                      </div>
                    ) : (
                      <span style={{ color: '#d0ccc6', fontSize: 11 }}>{'\u2014'}</span>
                    )}
                  </td>

                  {/* Leaf N K Ca dots */}
                  {['N', 'K', 'Ca'].map(code => (
                    <td key={code} style={{ ...st.td, textAlign: 'center' }}>
                      {nuts[code] != null ? (
                        <span title={`${code}: ${nuts[code].toFixed(2)}`}>
                          <span style={{
                            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                            background: normDotColor(nuts[code], normsMap[code]),
                          }} />
                        </span>
                      ) : (
                        <span style={{ color: '#d0ccc6', fontSize: 11 }}>{'\u2014'}</span>
                      )}
                    </td>
                  ))}

                  {/* T/Ha */}
                  <td style={{ ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: tonHaColor(prod?.tonHa ?? null) }}>
                    {prod?.tonHa != null ? prod.tonHa.toFixed(1) : '\u2014'}
                  </td>

                  {/* Delta prev */}
                  <td style={{
                    ...st.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12,
                    color: delta == null ? '#d0ccc6' : delta >= 0 ? '#4caf72' : '#e85a4a',
                  }}>
                    {delta != null ? `${delta >= 0 ? '\u2191' : '\u2193'}${Math.abs(delta).toFixed(0)}%` : '\u2014'}
                  </td>

                  {/* Size */}
                  <td style={{ ...st.td, textAlign: 'center' }}>
                    {size ? (
                      <span
                        title={size.dominantLabel}
                        style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                          background: 'rgba(33,118,217,0.08)', color: '#1a5fb4',
                          fontSize: 11, fontWeight: 600,
                        }}
                      >
                        {size.avgWeightG.toFixed(0)}g
                      </span>
                    ) : (
                      <span style={{ color: '#d0ccc6', fontSize: 11 }}>{'\u2014'}</span>
                    )}
                  </td>

                  {/* Top Issue */}
                  <td style={st.td}>
                    {topIssue ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 12, color: topIssue.pct_of_fruit > 2 ? '#c23616' : '#6a7a70',
                          fontWeight: topIssue.pct_of_fruit > 2 ? 600 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100,
                        }}>
                          {topIssue.pest_name}
                        </span>
                        <span style={{ fontSize: 11, color: '#8a95a0' }}>{topIssue.pct_of_fruit.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span style={{ color: '#d0ccc6', fontSize: 11 }}>{'\u2014'}</span>
                    )}
                  </td>

                  {/* Score */}
                  <td style={{ ...st.td, textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 10,
                      background: `${scoreColor(o.score)}18`,
                      color: scoreColor(o.score),
                      fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    }}>
                      {o.score}
                    </span>
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

const st: Record<string, React.CSSProperties> = {
  table: {
    width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 13,
  },
  th: {
    textAlign: 'left', padding: '10px 12px', fontWeight: 600,
    color: '#5a6a60', fontSize: 12, borderBottom: '2px solid #e0dbd4',
    whiteSpace: 'nowrap', background: '#f2efea', cursor: 'pointer',
    position: 'sticky', top: 0, zIndex: 2,
    userSelect: 'none',
  },
  td: {
    padding: '10px 12px', borderBottom: '1px solid #f0ede6',
    color: '#1a2a3a', whiteSpace: 'nowrap',
  },
}

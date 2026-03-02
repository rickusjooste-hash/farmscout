'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'

interface PestSummaryRow {
  pest_id: string
  pest_name: string
  this_week_total: number
  last_week_total: number
  red_orchards: number
  yellow_orchards: number
  green_orchards: number
  worst_orchard_id: string | null
  worst_orchard_name: string | null
  worst_count: number
}

interface Props {
  farmIds: string[]
  onPestSelect: (pestId: string) => void
}

function trendBadge(thisWeek: number, lastWeek: number) {
  const tw = Number(thisWeek)
  const lw = Number(lastWeek)
  if (lw === 0 && tw > 0) {
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#e8924a',
        background: '#fff3e0', padding: '2px 7px', borderRadius: 10,
      }}>New</span>
    )
  }
  if (lw === 0) return <span style={{ fontSize: 12, color: '#9aaa9f' }}>—</span>
  const pct = Math.round(((tw - lw) / lw) * 100)
  if (pct === 0) return <span style={{ fontSize: 12, color: '#9aaa9f' }}>— no change</span>
  if (pct > 0) return <span style={{ fontSize: 12, color: '#e8924a', fontWeight: 600 }}>↑ {pct}%</span>
  return <span style={{ fontSize: 12, color: '#4caf72', fontWeight: 600 }}>↓ {Math.abs(pct)}%</span>
}

function rowBorderColor(row: PestSummaryRow): string {
  if (Number(row.red_orchards) > 0) return '#e85a4a'
  if (Number(row.yellow_orchards) > 0) return '#f5c842'
  if (Number(row.green_orchards) > 0) return '#4caf72'
  return '#aaaaaa'
}

export default function PestAlertSummary({ farmIds, onPestSelect }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<PestSummaryRow[]>([])
  const [loading, setLoading] = useState(() => farmIds.length > 0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (farmIds.length === 0) return
    supabase
      .rpc('get_farm_pest_pressure_summary', { p_farm_ids: farmIds })
      .then(({ data, error }) => {
        if (error) console.error('get_farm_pest_pressure_summary error:', error)
        setRows((data as PestSummaryRow[]) || [])
        setLoading(false)
      })
  }, [farmIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a', marginBottom: 12 }}>Pest Alerts</div>
        <div style={{ color: '#9aaa9f', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  if (rows.length === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '16px 20px', borderBottom: expanded ? '1px solid #f0ede6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a' }}>Pest Alerts</div>
          <div style={{ fontSize: 12, color: '#9aaa9f', marginTop: 3 }}>
            {expanded ? 'This week vs last week — click View to jump to map' : `${rows.length} pest${rows.length !== 1 ? 's' : ''} tracked · ${rows.filter(r => Number(r.red_orchards) > 0).length} with alerts`}
          </div>
        </div>
        <span style={{ fontSize: 13, color: '#7a8a80', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </div>

      {expanded && <div>
        {rows.map(row => {
          const muted = Number(row.red_orchards) === 0 && Number(row.yellow_orchards) === 0
          const borderColor = rowBorderColor(row)

          return (
            <div
              key={row.pest_id}
              style={{
                borderLeft: `4px solid ${borderColor}`,
                padding: '14px 20px',
                borderBottom: '1px solid #f9f7f3',
                opacity: muted ? 0.6 : 1,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              {/* Left: name + chips + worst orchard */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1c3a2a' }}>{row.pest_name}</span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {Number(row.red_orchards) > 0 && (
                      <span style={{ fontSize: 12, background: '#fdecea', color: '#e85a4a', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                        🔴 {row.red_orchards}
                      </span>
                    )}
                    {Number(row.yellow_orchards) > 0 && (
                      <span style={{ fontSize: 12, background: '#fff8e1', color: '#c49a00', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                        🟡 {row.yellow_orchards}
                      </span>
                    )}
                    {Number(row.green_orchards) > 0 && (
                      <span style={{ fontSize: 12, background: '#e8f5ee', color: '#2a6e45', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                        🟢 {row.green_orchards}
                      </span>
                    )}
                  </div>
                </div>
                {Number(row.red_orchards) > 0 && row.worst_orchard_name && (
                  <div style={{ fontSize: 12, color: '#9aaa9f', marginTop: 4 }}>
                    Worst: {row.worst_orchard_name} · {Number(row.worst_count).toLocaleString()} catches
                  </div>
                )}
              </div>

              {/* Right: count + trend + button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>
                  {Number(row.this_week_total).toLocaleString()} catches
                </span>
                {trendBadge(row.this_week_total, row.last_week_total)}
                <button
                  onClick={() => onPestSelect(row.pest_id)}
                  style={{
                    padding: '5px 12px', borderRadius: 8,
                    border: '1.5px solid #e0ddd6',
                    background: '#f9f7f3', color: '#3a4a40',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View →
                </button>
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )
}

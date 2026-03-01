'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'

interface TreePestRow {
  pest_id: string
  pest_name: string
  this_week_total: number
  last_week_total: number
  orchards_affected: number
  worst_orchard_id: string | null
  worst_orchard_name: string | null
  worst_count: number
}

interface Props { farmIds: string[] }

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

function rowBorderColor(row: TreePestRow): string {
  const tw = Number(row.this_week_total)
  const lw = Number(row.last_week_total)
  if (lw === 0 && tw > 0) return '#e85a4a'  // new this week
  if (tw > lw) return '#f5c842'              // increasing
  if (tw < lw) return '#4caf72'              // decreasing
  return '#aaaaaa'                           // no change
}

export default function TreeScoutingAlertSummary({ farmIds }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<TreePestRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (farmIds.length === 0) return
    setLoading(true)
    supabase
      .rpc('get_tree_pest_pressure_summary', { p_farm_ids: farmIds })
      .then(({ data, error }) => {
        if (error) console.error('get_tree_pest_pressure_summary error:', JSON.stringify(error))
        setRows((data as TreePestRow[]) || [])
        setLoading(false)
      })
  }, [farmIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a', marginBottom: 12 }}>Tree Scouting This Week</div>
        <div style={{ color: '#9aaa9f', fontSize: 13 }}>Loading…</div>
      </div>
    )
  }

  if (rows.length === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ede6' }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a' }}>Tree Scouting This Week</div>
        <div style={{ fontSize: 12, color: '#9aaa9f', marginTop: 3 }}>Observations from tree walk · vs last week</div>
      </div>

      <div>
        {rows.map(row => {
          const borderColor = rowBorderColor(row)

          return (
            <div
              key={row.pest_id}
              style={{
                borderLeft: `4px solid ${borderColor}`,
                padding: '14px 20px',
                borderBottom: '1px solid #f9f7f3',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              {/* Left: name + chip + worst orchard */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1c3a2a' }}>{row.pest_name}</span>
                  <span style={{ fontSize: 12, background: '#f0f7f2', color: '#2a6e45', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                    🌿 {Number(row.orchards_affected)} orchard{Number(row.orchards_affected) !== 1 ? 's' : ''}
                  </span>
                </div>
                {row.worst_orchard_name && (
                  <div style={{ fontSize: 12, color: '#9aaa9f', marginTop: 4 }}>
                    Worst: {row.worst_orchard_name} · {Number(row.worst_count).toLocaleString()} observations
                  </div>
                )}
              </div>

              {/* Right: count + trend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>
                  {Number(row.this_week_total).toLocaleString()} observations
                </span>
                {trendBadge(row.this_week_total, row.last_week_total)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

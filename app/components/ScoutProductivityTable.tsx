'use client'

import { useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────

export interface DailyRow {
  scout_id: string
  scout_name: string
  day: string
  first_inspection: string
  last_inspection: string
  active_minutes: number
  longest_gap_minutes: number
  break_count: number
  lunch_detected: boolean
  traps_inspected: number
  route_size: number
  trap_completion_pct: number
  avg_seconds_per_trap: number
  trees_inspected: number
  zones_completed: number
  avg_seconds_per_tree: number
  distance_walked_m: number
}

export interface WeeklyRow {
  scout_id: string
  scout_name: string
  week_nr: number
  week_start: string
  active_days: number
  total_traps: number
  total_trees: number
  avg_traps_per_day: number
  avg_trees_per_day: number
  avg_seconds_per_trap: number
  avg_seconds_per_tree: number
  trap_completion_pct: number
  quality_score: number
  traps_delta_pct: number | null
  trees_delta_pct: number | null
  speed_delta_pct: number | null
}

export interface QualityFlag {
  scout_id: string
  scout_name: string
  day: string
  flag_type: string
  flag_detail: string
  severity: string
  evidence_count: number
}

interface Props {
  dailyData: DailyRow[]
  weeklyData: WeeklyRow[]
  qualityFlags: QualityFlag[]
  mode: 'day' | 'week'
  selectedDate: string
  onSelectScout: (scoutId: string) => void
  selectedScoutId: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })
}

function fmtDuration(mins: number): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtSeconds(s: number): string {
  if (!s) return '—'
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m}m ${sec}s`
}

function fmtDistance(m: number): string {
  if (!m) return '—'
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function qualityColor(score: number): string {
  if (score > 0.8) return '#4caf72'
  if (score > 0.5) return '#f5c842'
  return '#e85a4a'
}

function deltaChip(val: number | null): string {
  if (val === null || val === undefined) return ''
  if (val > 0) return `↑${val}%`
  if (val < 0) return `↓${Math.abs(val)}%`
  return '—'
}

function deltaColor(val: number | null): string {
  if (val === null || val === undefined) return '#9aaa9f'
  return val > 0 ? '#4caf72' : val < 0 ? '#e85a4a' : '#9aaa9f'
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ScoutProductivityTable({
  dailyData, weeklyData, qualityFlags, mode, selectedDate,
  onSelectScout, selectedScoutId,
}: Props) {

  // Aggregate daily rows per scout (for day mode with multi-day range)
  const scoutSummaries = useMemo(() => {
    if (mode === 'week') {
      // Group weekly by scout, show current week
      const byScout = new Map<string, WeeklyRow[]>()
      for (const w of weeklyData) {
        const arr = byScout.get(w.scout_id) || []
        arr.push(w)
        byScout.set(w.scout_id, arr)
      }
      return Array.from(byScout.entries()).map(([sid, weeks]) => {
        const sorted = weeks.sort((a, b) => b.week_start.localeCompare(a.week_start))
        const current = sorted[0]
        return {
          ...current,
          sparkline: sorted.slice().reverse().map(w => ({ v: w.total_traps + w.total_trees })),
        }
      }).sort((a, b) => (b.total_traps + b.total_trees) - (a.total_traps + a.total_trees))
    }

    // Day mode: one row per scout per day (or aggregated)
    return dailyData.map(d => {
      const flagCount = qualityFlags.filter(f => f.scout_id === d.scout_id && f.day === d.day).length
      const highFlags = qualityFlags.filter(f => f.scout_id === d.scout_id && f.day === d.day && f.severity === 'high').length
      const qScore = Math.max(0, 1 - highFlags * 0.15 - (flagCount - highFlags) * 0.05)
      return { ...d, quality_score: qScore, flagCount }
    }).sort((a, b) => (b.traps_inspected + b.trees_inspected) - (a.traps_inspected + a.trees_inspected))
  }, [dailyData, weeklyData, qualityFlags, mode])

  // Team medians for peer comparison
  const teamMedian = useMemo(() => {
    if (mode !== 'week' || !weeklyData.length) return null
    const current = weeklyData.filter(w => w.week_start === weeklyData[0]?.week_start)
    if (!current.length) return null
    const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b)
    const median = (arr: number[]) => {
      const s = sorted(arr)
      const mid = Math.floor(s.length / 2)
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
    }
    return {
      traps: median(current.map(c => c.total_traps)),
      trees: median(current.map(c => c.total_trees)),
      speed: median(current.filter(c => c.avg_seconds_per_trap > 0).map(c => c.avg_seconds_per_trap)),
    }
  }, [weeklyData, mode])

  if (mode === 'day') {
    return (
      <div>
        <div style={{ overflowX: 'auto' }}>
          <table className="spt-table">
            <thead>
              <tr>
                <th>Scout</th>
                <th>Start</th>
                <th>End</th>
                <th>Active</th>
                <th>Traps</th>
                <th>Trees</th>
                <th>Zones</th>
                <th>Avg/Trap</th>
                <th>Avg/Tree</th>
                <th>Distance</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {scoutSummaries.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: '#9aaa9f', padding: 32 }}>No inspection data for this period</td></tr>
              )}
              {(scoutSummaries as (DailyRow & { quality_score: number; flagCount: number })[]).map((row) => {
                const isSelected = selectedScoutId === row.scout_id
                const trapPct = row.route_size > 0 ? Math.round(row.traps_inspected / row.route_size * 100) : null
                const smallSample = (row.traps_inspected + row.trees_inspected) < 10
                return (
                  <tr
                    key={row.scout_id + row.day}
                    className={`spt-row${isSelected ? ' selected' : ''}`}
                    onClick={() => onSelectScout(row.scout_id)}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: '#1c3a2a' }}>{row.scout_name}</div>
                      {smallSample && <div style={{ fontSize: 10, color: '#c0a050' }}>Small sample</div>}
                    </td>
                    <td>{fmtTime(row.first_inspection)}</td>
                    <td>{fmtTime(row.last_inspection)}</td>
                    <td>
                      <span>{fmtDuration(row.active_minutes)}</span>
                      {row.break_count > 0 && (
                        <span style={{ fontSize: 10, color: '#9aaa9f', marginLeft: 4 }}>
                          ({row.break_count} break{row.break_count > 1 ? 's' : ''})
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{row.traps_inspected}</span>
                      {trapPct !== null && (
                        <span style={{ fontSize: 11, color: '#9aaa9f' }}>/{row.route_size} ({trapPct}%)</span>
                      )}
                    </td>
                    <td>{row.trees_inspected || '—'}</td>
                    <td>{row.zones_completed || '—'}</td>
                    <td style={{ color: row.avg_seconds_per_trap < 30 ? '#e85a4a' : '#1c3a2a' }}>
                      {fmtSeconds(row.avg_seconds_per_trap)}
                    </td>
                    <td style={{ color: row.avg_seconds_per_tree < 20 ? '#e85a4a' : '#1c3a2a' }}>
                      {fmtSeconds(row.avg_seconds_per_tree)}
                    </td>
                    <td>{fmtDistance(row.distance_walked_m)}</td>
                    <td>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 10,
                        background: qualityColor(row.quality_score) + '22',
                        color: qualityColor(row.quality_score),
                        fontWeight: 600, fontSize: 12,
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: qualityColor(row.quality_score),
                        }} />
                        {Math.round(row.quality_score * 100)}%
                        {row.flagCount > 0 && <span style={{ fontSize: 10, opacity: 0.8 }}> ({row.flagCount})</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <style>{`
          .spt-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            font-family: 'Inter', sans-serif;
          }
          .spt-table th {
            text-align: left;
            padding: 8px 10px;
            font-size: 11px;
            font-weight: 600;
            color: #9aaa9f;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            border-bottom: 2px solid #f0ede6;
            white-space: nowrap;
          }
          .spt-table td {
            padding: 10px 10px;
            border-bottom: 1px solid #f9f7f3;
            white-space: nowrap;
          }
          .spt-row {
            cursor: pointer;
            transition: background 0.15s;
          }
          .spt-row:hover {
            background: #f9f7f3;
          }
          .spt-row.selected {
            background: #e8f5e9;
          }
          @media (max-width: 768px) {
            .spt-table th:nth-child(n+6),
            .spt-table td:nth-child(n+6) {
              display: none;
            }
          }
        `}</style>
      </div>
    )
  }

  // Week mode
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table className="spt-table">
          <thead>
            <tr>
              <th>Scout</th>
              <th>Days</th>
              <th>Traps</th>
              <th>Trees</th>
              <th>Avg/Trap</th>
              <th>Avg/Tree</th>
              <th>Completion</th>
              <th>Quality</th>
              <th style={{ width: 80 }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {scoutSummaries.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9aaa9f', padding: 32 }}>No data for this period</td></tr>
            )}
            {(scoutSummaries as (WeeklyRow & { sparkline: { v: number }[] })[]).map((row) => {
              const isSelected = selectedScoutId === row.scout_id
              return (
                <tr
                  key={row.scout_id}
                  className={`spt-row${isSelected ? ' selected' : ''}`}
                  onClick={() => onSelectScout(row.scout_id)}
                >
                  <td>
                    <div style={{ fontWeight: 600, color: '#1c3a2a' }}>{row.scout_name}</div>
                    <div style={{ fontSize: 10, color: '#9aaa9f' }}>{row.active_days} day{row.active_days !== 1 ? 's' : ''} active</div>
                  </td>
                  <td>{row.active_days}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{row.total_traps}</span>
                    {row.traps_delta_pct !== null && (
                      <span style={{ fontSize: 10, color: deltaColor(row.traps_delta_pct), marginLeft: 4 }}>
                        {deltaChip(row.traps_delta_pct)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{row.total_trees}</span>
                    {row.trees_delta_pct !== null && (
                      <span style={{ fontSize: 10, color: deltaColor(row.trees_delta_pct), marginLeft: 4 }}>
                        {deltaChip(row.trees_delta_pct)}
                      </span>
                    )}
                  </td>
                  <td>{fmtSeconds(row.avg_seconds_per_trap)}</td>
                  <td>{fmtSeconds(row.avg_seconds_per_tree)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        flex: 1, height: 8, background: '#f0ede6', borderRadius: 4,
                        overflow: 'hidden', minWidth: 40, maxWidth: 80,
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, row.trap_completion_pct)}%`,
                          background: row.trap_completion_pct >= 90 ? '#4caf72'
                            : row.trap_completion_pct >= 70 ? '#f5c842' : '#e85a4a',
                          borderRadius: 4,
                        }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{Math.round(row.trap_completion_pct)}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 10,
                      background: qualityColor(row.quality_score) + '22',
                      color: qualityColor(row.quality_score),
                      fontWeight: 600, fontSize: 12,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: qualityColor(row.quality_score),
                      }} />
                      {Math.round(row.quality_score * 100)}%
                    </div>
                  </td>
                  <td>
                    {row.sparkline && row.sparkline.length > 1 && (
                      <ResponsiveContainer width={70} height={24}>
                        <LineChart data={row.sparkline}>
                          <Line
                            dataKey="v"
                            stroke="#2a6e45"
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {teamMedian && (
        <div style={{
          marginTop: 12, padding: '8px 14px', background: '#f9f7f3',
          borderRadius: 8, fontSize: 12, color: '#6a7a70',
          display: 'flex', gap: 20,
        }}>
          <span>Team median:</span>
          <span>Traps: <strong>{teamMedian.traps}</strong></span>
          <span>Trees: <strong>{teamMedian.trees}</strong></span>
          <span>Speed: <strong>{fmtSeconds(teamMedian.speed)}</strong>/trap</span>
        </div>
      )}

      <style>{`
        .spt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
        }
        .spt-table th {
          text-align: left;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #9aaa9f;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 2px solid #f0ede6;
          white-space: nowrap;
        }
        .spt-table td {
          padding: 10px 10px;
          border-bottom: 1px solid #f9f7f3;
          white-space: nowrap;
        }
        .spt-row {
          cursor: pointer;
          transition: background 0.15s;
        }
        .spt-row:hover {
          background: #f9f7f3;
        }
        .spt-row.selected {
          background: #e8f5e9;
        }
        @media (max-width: 768px) {
          .spt-table th:nth-child(n+5),
          .spt-table td:nth-child(n+5) {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

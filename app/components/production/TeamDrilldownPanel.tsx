'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, ReferenceLine,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkerRow {
  employee_id: string
  employee_name: string
  supervisor: string
  raw_bags: number
  corrected_bins: number | null
  units_per_man_day: number | null
  hours: number | null
}

interface QualityRow {
  employee_id: string
  bags_sampled: number
  fruit_sampled: number
  fruit_with_issues: number
  issue_pct: number
  avg_fruit_weight_g: number | null
}

interface Props {
  workers: WorkerRow[]
  quality: QualityRow[]
  loading: boolean
  selectedTeam?: string
  onTeamChange?: (team: string) => void
  farmAvgBins?: number
}

// ── Colors ───────────────────────────────────────────────────────────────────

function binsColor(val: number, farmAvg: number): string {
  if (farmAvg <= 0) return '#2176d9'
  if (val < farmAvg) return '#e85a4a'
  return '#4caf72'
}

function issueColor(pct: number): string {
  if (pct <= 5) return '#4caf72'
  if (pct <= 15) return '#f5c842'
  return '#e85a4a'
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  card:       { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader: { padding: '20px 24px 16px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 },
  cardTitle:  { fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
  pill:       { padding: '4px 10px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive: { padding: '4px 10px', borderRadius: 20, border: '1px solid #e65100', background: '#e65100', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  th:         { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #e8e4dc', whiteSpace: 'nowrap' as const },
  td:         { padding: '7px 10px', borderBottom: '1px solid #eef2fa', fontSize: 12 },
  empty:      { padding: 40, textAlign: 'center' as const, color: '#8a95a0', fontSize: 13 },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TeamDrilldownPanel({ workers, quality, loading, selectedTeam: externalTeam, onTeamChange, farmAvgBins = 0 }: Props) {
  const supervisors = useMemo(() => [...new Set(workers.filter(w => w.supervisor).map(w => w.supervisor))].sort(), [workers])
  const [internalTeam, setInternalTeam] = useState<string>('')

  const selectedTeam = externalTeam || internalTeam
  const setSelectedTeam = (team: string) => {
    setInternalTeam(team)
    onTeamChange?.(team)
  }

  // Auto-select first team
  if (supervisors.length > 0 && !selectedTeam) {
    setInternalTeam(supervisors[0])
  }

  // Build quality lookup
  const qualityMap = useMemo(() => {
    const map: Record<string, QualityRow> = {}
    quality.forEach(q => { map[q.employee_id] = q })
    return map
  }, [quality])

  // Filter to picking workers for selected team (case-insensitive)
  const teamWorkers = useMemo(() => {
    const sel = selectedTeam?.toUpperCase()
    return workers
      .filter(w => w.supervisor?.toUpperCase() === sel)
      .sort((a, b) => (b.corrected_bins || 0) - (a.corrected_bins || 0))
  }, [workers, selectedTeam])

  const teamAvgBins = useMemo(() => {
    const valid = teamWorkers.filter(w => w.corrected_bins != null && w.corrected_bins > 0)
    if (valid.length === 0) return 0
    return valid.reduce((s, w) => s + w.corrected_bins!, 0) / valid.length
  }, [teamWorkers])

  // Chart data
  const chartData = useMemo(() => {
    return teamWorkers.map(w => ({
      name: w.employee_name.length > 15 ? w.employee_name.slice(0, 13) + '..' : w.employee_name,
      fullName: w.employee_name,
      bins: w.corrected_bins || 0,
      employeeId: w.employee_id,
    }))
  }, [teamWorkers])

  if (workers.length === 0 && !loading) return null

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.cardTitle}>Team Drilldown</span>
          <span style={{ fontSize: 10, background: '#e65100', color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>FCS + QC</span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {supervisors.map(sup => (
            <button key={sup} style={selectedTeam === sup ? s.pillActive : s.pill} onClick={() => setSelectedTeam(sup)}>
              {sup}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={s.empty}>Loading...</div>
      ) : teamWorkers.length === 0 ? (
        <div style={s.empty}>No picking data for {selectedTeam || 'this team'}</div>
      ) : (
        <>
          {/* Ranked bar chart */}
          <div style={{ padding: '16px 24px 8px' }}>
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 32 + 40)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} tick={{ fill: '#8a95a0' }} />
                <YAxis type="category" dataKey="name" width={110} fontSize={11} tick={{ fill: '#1a2a3a' }} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toFixed(2)} bins`, 'Corrected Bins']}
                  labelFormatter={(label: any) => {
                    const d = chartData.find(c => c.name === String(label))
                    return d?.fullName || String(label)
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                {farmAvgBins > 0 && (
                  <ReferenceLine x={undefined} y={farmAvgBins} stroke="#e85a4a" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Farm Avg ${farmAvgBins.toFixed(1)}`, position: 'right', fontSize: 9, fill: '#e85a4a', fontWeight: 600 }} />
                )}
                <Bar dataKey="bins" radius={[0, 4, 4, 0]} barSize={22}>
                  {chartData.map(d => (
                    <Cell key={d.employeeId} fill={binsColor(d.bins, farmAvgBins)} />
                  ))}
                  <LabelList dataKey="bins" position="right" fontSize={10} formatter={(v: any) => Number(v).toFixed(2)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table with quality data */}
          <div style={{ overflowX: 'auto', borderTop: '1px solid #eef2fa' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7f5f0' }}>
                  <th style={{ ...s.th, textAlign: 'left' }}>Employee</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Bags</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Corr. Bins</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Units/Day</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Hours</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>vs Avg</th>
                  <th style={{ ...s.th, textAlign: 'right', borderLeft: '2px solid #e8e4dc' }}>Bags Sampled</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Fruit</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Issues</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Issue %</th>
                </tr>
              </thead>
              <tbody>
                {teamWorkers.map(w => {
                  const q = qualityMap[w.employee_id]
                  const pct = farmAvgBins > 0 && w.corrected_bins ? (w.corrected_bins / farmAvgBins) * 100 : 0
                  return (
                    <tr key={w.employee_id}>
                      <td style={{ ...s.td, fontWeight: 500 }}>{w.employee_name}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{w.raw_bags.toLocaleString()}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: '#2176d9' }}>
                        {w.corrected_bins != null ? w.corrected_bins.toFixed(2) : '—'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{w.units_per_man_day?.toFixed(1) || '—'}</td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>{w.hours?.toFixed(1) || '—'}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: pct >= 120 ? '#4caf72' : pct >= 80 ? '#2176d9' : '#e85a4a' }}>
                        {pct > 0 ? `${pct.toFixed(0)}%` : '—'}
                      </td>
                      {/* QC quality columns */}
                      <td style={{ ...s.td, textAlign: 'right', borderLeft: '2px solid #eef2fa', color: '#6a7a70' }}>
                        {q ? q.bags_sampled : '—'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>
                        {q ? q.fruit_sampled : '—'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>
                        {q ? q.fruit_with_issues : '—'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: q ? issueColor(q.issue_pct) : '#aaa' }}>
                        {q ? `${q.issue_pct}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

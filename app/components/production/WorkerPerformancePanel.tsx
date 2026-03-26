'use client'

import { useMemo, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkerRow {
  employee_id: string
  employee_name: string
  employee_nr: string
  supervisor: string
  activity_name: string
  raw_bags: number
  corrected_bags: number | null
  corrected_bins: number | null
  units_per_man_day: number | null
  hours: number | null
  orchard_count: number
}

interface Props {
  workers: WorkerRow[]
  loading: boolean
}

// ── Color helpers ────────────────────────────────────────────────────────────

function performanceColor(pct: number): string {
  if (pct >= 120) return '#4caf72'
  if (pct >= 80) return '#f5c842'
  return '#e85a4a'
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  card:       { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader: { padding: '20px 24px 16px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 },
  cardTitle:  { fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
  th:         { padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #e8e4dc', whiteSpace: 'nowrap' as const },
  td:         { padding: '9px 8px', borderBottom: '1px solid #eef2fa', fontSize: 13 },
  empty:      { padding: 24, textAlign: 'center' as const, color: '#8a95a0', fontSize: 13 },
  pill:       { padding: '4px 10px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive: { padding: '4px 10px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WorkerPerformancePanel({ workers, loading }: Props) {
  const [activityFilter, setActivityFilter] = useState('Harvest/Pick/Sort/uitry')
  const [supervisorFilter, setSupervisorFilter] = useState('__all__')

  const activities = useMemo(() => [...new Set(workers.map(w => w.activity_name))].sort(), [workers])
  const supervisors = useMemo(() => [...new Set(workers.map(w => w.supervisor))].sort(), [workers])

  const filtered = useMemo(() => {
    let list = workers
    if (activityFilter !== '__all__') list = list.filter(w => w.activity_name === activityFilter)
    if (supervisorFilter !== '__all__') list = list.filter(w => w.supervisor === supervisorFilter)
    return list
  }, [workers, activityFilter, supervisorFilter])

  const isPicking = activityFilter === 'Harvest/Pick/Sort/uitry'

  // Team average for "vs avg" column
  const teamAvg = useMemo(() => {
    if (filtered.length === 0) return 0
    if (isPicking) {
      const total = filtered.reduce((s, w) => s + (w.corrected_bins || 0), 0)
      return total / filtered.length
    }
    const total = filtered.reduce((s, w) => s + (w.units_per_man_day || 0), 0)
    return total / filtered.length
  }, [filtered, isPicking])

  // Sort by corrected_bins desc (picking) or units_per_man_day desc (other)
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (isPicking) return (b.corrected_bins || 0) - (a.corrected_bins || 0)
      return (b.units_per_man_day || 0) - (a.units_per_man_day || 0)
    })
  }, [filtered, isPicking])

  if (workers.length === 0 && !loading) return null

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.cardTitle}>Worker Performance</span>
          <span style={{ fontSize: 10, background: '#e65100', color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>FCS</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Activity pills */}
          <button style={activityFilter === '__all__' ? s.pillActive : s.pill} onClick={() => setActivityFilter('__all__')}>All</button>
          {activities.map(a => (
            <button key={a} style={activityFilter === a ? s.pillActive : s.pill} onClick={() => setActivityFilter(a)}>
              {a.length > 25 ? a.slice(0, 22) + '...' : a}
            </button>
          ))}
          {/* Supervisor filter */}
          {supervisors.length > 1 && (
            <select
              value={supervisorFilter}
              onChange={e => setSupervisorFilter(e.target.value)}
              style={{ border: '1px solid #d4cfca', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#5a6a60', fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="__all__">All teams</option>
              {supervisors.map(sup => <option key={sup} value={sup}>{sup}</option>)}
            </select>
          )}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f5f0' }}>
              <th style={{ ...s.th, textAlign: 'left' }}>Employee</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Team</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Units</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Hours</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Units/Day</th>
              {isPicking && <>
                <th style={{ ...s.th, textAlign: 'right' }}>Corr. Bags</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Corr. Bins</th>
              </>}
              <th style={{ ...s.th, textAlign: 'right' }}>Orchards</th>
              <th style={{ ...s.th, textAlign: 'right' }}>vs Avg</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isPicking ? 9 : 7} style={s.empty}>Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={isPicking ? 9 : 7} style={s.empty}>No approved worker data</td></tr>
            ) : (
              sorted.map(w => {
                const val = isPicking ? (w.corrected_bins || 0) : (w.units_per_man_day || 0)
                const pct = teamAvg > 0 ? (val / teamAvg) * 100 : 0
                return (
                  <tr key={`${w.employee_id}-${w.activity_name}`}>
                    <td style={{ ...s.td, fontWeight: 500 }}>{w.employee_name}</td>
                    <td style={{ ...s.td, color: '#6a7a70' }}>{w.supervisor}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{w.raw_bags.toLocaleString()}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>{w.hours != null ? w.hours.toFixed(1) : '—'}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{w.units_per_man_day != null ? w.units_per_man_day.toFixed(1) : '—'}</td>
                    {isPicking && <>
                      <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>{w.corrected_bags != null ? w.corrected_bags.toFixed(1) : '—'}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: '#2176d9' }}>{w.corrected_bins != null ? w.corrected_bins.toFixed(2) : '—'}</td>
                    </>}
                    <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>{w.orchard_count}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: performanceColor(pct) }}>
                      {pct > 0 ? `${pct.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

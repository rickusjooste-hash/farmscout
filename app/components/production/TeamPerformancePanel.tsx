'use client'

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamBinAgg {
  team: string
  teamName: string
  bins: number
  headcount: number
  binsPerPerson: number | null
}

interface TeamPickingAgg {
  team: string
  inspections: number
  avgDrops: number
  avgShiners: number
}

interface Props {
  teamBins: TeamBinAgg[]
  teamPicking: TeamPickingAgg[]
}

// ── Color helpers ────────────────────────────────────────────────────────────

function binsPerPersonColor(val: number | null): string {
  if (val == null) return '#aaa'
  if (val >= 50) return '#4caf72'
  if (val >= 30) return '#f5c842'
  return '#e85a4a'
}

function dropsColor(val: number): string {
  if (val < 2) return '#4caf72'
  if (val <= 5) return '#f5c842'
  return '#e85a4a'
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  card:       { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader: { padding: '20px 24px 16px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:  { fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
  cardBody:   { padding: '12px 24px 20px' },
  th:         { padding: '10px 8px', fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #e8e4dc', whiteSpace: 'nowrap' as const },
  td:         { padding: '9px 8px', borderBottom: '1px solid #eef2fa', fontSize: 13 },
  empty:      { padding: 24, textAlign: 'center' as const, color: '#8a95a0', fontSize: 13 },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TeamPerformancePanel({ teamBins, teamPicking }: Props) {
  if (teamBins.length === 0 && teamPicking.length === 0) return null

  // Merge bins + picking data by team code
  const pickingMap: Record<string, TeamPickingAgg> = {}
  teamPicking.forEach(p => { pickingMap[p.team] = p })

  const hasPicking = teamPicking.length > 0

  // Sort by bins descending
  const sorted = [...teamBins].sort((a, b) => b.bins - a.bins)

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.cardTitle}>Team Performance</span>
          <span style={{ fontSize: 10, background: '#2176d9', color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>TEAMS</span>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f5f0' }}>
              <th style={{ ...s.th, textAlign: 'left' }}>Team</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Bins</th>
              <th style={{ ...s.th, textAlign: 'right' }}>People</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Bins/Person</th>
              {hasPicking && <>
                <th style={{ ...s.th, textAlign: 'right' }}>Inspections</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Avg Drops</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Avg Shiners</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const picking = pickingMap[row.team]
              return (
                <tr key={row.team}>
                  <td style={{ ...s.td, fontWeight: 500 }}>{row.teamName || row.team}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{row.bins.toLocaleString('en-ZA')}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>{row.headcount}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: binsPerPersonColor(row.binsPerPerson) }}>
                    {row.binsPerPerson != null ? row.binsPerPerson.toFixed(1) : '–'}
                  </td>
                  {hasPicking && <>
                    <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>
                      {picking ? picking.inspections : '–'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: picking ? dropsColor(picking.avgDrops) : '#aaa' }}>
                      {picking ? picking.avgDrops.toFixed(1) : '–'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: picking ? dropsColor(picking.avgShiners) : '#aaa' }}>
                      {picking ? picking.avgShiners.toFixed(1) : '–'}
                    </td>
                  </>}
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={hasPicking ? 7 : 4} style={s.empty}>No team data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

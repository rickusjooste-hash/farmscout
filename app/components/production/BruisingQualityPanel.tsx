'use client'

import { useMemo, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface BruisingRow {
  orchard_id: string | null
  orchard_name: string
  variety: string | null
  bruising_pct: number | null
  stem_pct: number | null
  injury_pct: number | null
  bin_weight_kg: number | null
  team: string | null
  team_name: string | null
  week_num: number | null
}

interface BruisingAgg {
  orchard_id: string | null
  name: string
  variety: string | null
  team: string | null
  teamName: string | null
  samples: number
  bruising: number
  stem: number
  injury: number
  avgWeight: number | null
}

type Metric = 'bruising' | 'stem' | 'injury'

interface Props {
  bruisingData: BruisingRow[]
  bruisingSummary: BruisingAgg[]
}

// ── Color helpers ────────────────────────────────────────────────────────────

function qualityColor(pct: number): string {
  if (pct < 5) return '#4caf72'
  if (pct < 10) return '#f5c842'
  return '#e85a4a'
}

function heatmapBg(pct: number): string {
  if (pct <= 0) return '#f5f5f5'
  if (pct < 3) return '#e8f5e9'
  if (pct < 5) return '#fff8e1'
  if (pct < 8) return '#fff3e0'
  if (pct < 10) return '#fbe9e7'
  return '#e85a4a'
}

function heatmapText(pct: number): string {
  return pct >= 10 ? '#fff' : '#1c3a2a'
}

const METRIC_LABELS: Record<Metric, string> = {
  bruising: 'Bruising',
  stem: 'Stem',
  injury: 'Injury',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BruisingQualityPanel({ bruisingData, bruisingSummary }: Props) {
  const [metric, setMetric] = useState<Metric>('bruising')
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)

  // ── Team summaries ───────────────────────────────────────────────────────
  const teamSummaries = useMemo(() => {
    const map: Record<string, { bruisingSum: number; stemSum: number; injurySum: number; count: number; name: string }> = {}
    bruisingData.forEach(row => {
      const key = row.team || '_none'
      if (!map[key]) map[key] = { bruisingSum: 0, stemSum: 0, injurySum: 0, count: 0, name: row.team_name || row.team || 'Unknown' }
      map[key].count++
      map[key].bruisingSum += row.bruising_pct || 0
      map[key].stemSum += row.stem_pct || 0
      map[key].injurySum += row.injury_pct || 0
    })
    return Object.entries(map).map(([key, val]) => ({
      key,
      name: val.name,
      samples: val.count,
      bruising: val.count > 0 ? val.bruisingSum / val.count : 0,
      stem: val.count > 0 ? val.stemSum / val.count : 0,
      injury: val.count > 0 ? val.injurySum / val.count : 0,
    })).sort((a, b) => b[metric] - a[metric])
  }, [bruisingData, metric])

  // ── Sparkline data: per-team weekly averages ─────────────────────────────
  const sparklineData = useMemo(() => {
    const map: Record<string, Record<number, { sum: number; count: number }>> = {}
    bruisingData.forEach(row => {
      if (row.week_num == null) return
      const teamKey = row.team || '_none'
      if (!map[teamKey]) map[teamKey] = {}
      if (!map[teamKey][row.week_num]) map[teamKey][row.week_num] = { sum: 0, count: 0 }
      const val = metric === 'bruising' ? (row.bruising_pct || 0)
        : metric === 'stem' ? (row.stem_pct || 0)
        : (row.injury_pct || 0)
      map[teamKey][row.week_num].sum += val
      map[teamKey][row.week_num].count++
    })
    const result: Record<string, { week: number; value: number }[]> = {}
    Object.entries(map).forEach(([teamKey, weeks]) => {
      const seasonSort = (wk: number) => wk >= 31 ? wk - 31 : wk + 21
      result[teamKey] = Object.entries(weeks)
        .map(([wk, { sum, count }]) => ({ week: Number(wk), value: Math.round((sum / count) * 100) / 100 }))
        .sort((a, b) => seasonSort(a.week) - seasonSort(b.week))
    })
    return result
  }, [bruisingData, metric])

  // ── Trend arrows (last week vs previous) ─────────────────────────────────
  const trendArrows = useMemo(() => {
    const result: Record<string, string> = {}
    Object.entries(sparklineData).forEach(([teamKey, data]) => {
      if (data.length < 2) { result[teamKey] = '─'; return }
      const last = data[data.length - 1].value
      const prev = data[data.length - 2].value
      if (last > prev + 0.5) result[teamKey] = '↑'
      else if (last < prev - 0.5) result[teamKey] = '↓'
      else result[teamKey] = '─'
    })
    return result
  }, [sparklineData])

  // ── Heatmap data: teams × orchards ───────────────────────────────────────
  const heatmapData = useMemo(() => {
    // Get unique teams (sorted worst-first by current metric)
    const teams = teamSummaries.map(t => ({ key: t.key, name: t.name }))

    // Build cells from bruisingSummary (already grouped by orchard+team)
    const cells: Record<string, { bruising: number; stem: number; injury: number; samples: number; orchardName: string; teamName: string }> = {}
    const orchardAgg: Record<string, { sum: number; count: number; name: string }> = {}

    bruisingSummary.forEach(row => {
      const teamKey = row.team || '_none'
      const orchardKey = row.orchard_id || `_${row.name}`
      const cellKey = `${teamKey}::${orchardKey}`
      cells[cellKey] = {
        bruising: row.bruising,
        stem: row.stem,
        injury: row.injury,
        samples: row.samples,
        orchardName: row.name,
        teamName: row.teamName || row.team || 'Unknown',
      }
      // Aggregate per-orchard for sorting
      if (!orchardAgg[orchardKey]) orchardAgg[orchardKey] = { sum: 0, count: 0, name: row.name }
      orchardAgg[orchardKey].sum += row[metric] * row.samples
      orchardAgg[orchardKey].count += row.samples
    })

    // Sort orchards worst-first
    const orchards = Object.entries(orchardAgg)
      .map(([key, val]) => ({ key, name: val.name, avg: val.count > 0 ? val.sum / val.count : 0 }))
      .sort((a, b) => b.avg - a.avg)

    return { teams, orchards, cells }
  }, [teamSummaries, bruisingSummary, metric])

  // ── Team avg per metric for the heatmap "Avg" column ─────────────────────
  const teamAvgForMetric = useMemo(() => {
    const result: Record<string, number> = {}
    teamSummaries.forEach(t => { result[t.key] = t[metric] })
    return result
  }, [teamSummaries, metric])

  if (bruisingSummary.length === 0) return null

  const metricLabel = METRIC_LABELS[metric]

  return (
    <div style={styles.card}>
      {/* Header with metric tabs */}
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>Quality Summary ({metricLabel})</span>
        <div style={styles.tabRow}>
          {(['bruising', 'stem', 'injury'] as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={m === metric ? styles.tabActive : styles.tab}
            >
              {m === metric && <span style={styles.tabDot} />}
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.cardBody}>
        {/* Layer 1: Team Summary Cards */}
        <div style={styles.teamCardsRow}>
          {teamSummaries.map(team => {
            const value = team[metric]
            const color = qualityColor(value)
            const spark = sparklineData[team.key] || []
            const arrow = trendArrows[team.key] || '─'
            const arrowColor = arrow === '↑' ? '#e85a4a' : arrow === '↓' ? '#4caf72' : '#9aaa9f'
            return (
              <div key={team.key} style={{ ...styles.teamCard, borderLeftColor: color }}>
                <div style={styles.teamName}>{team.name}</div>
                <div style={styles.teamValueRow}>
                  <span style={{ ...styles.teamValue, color }}>{value.toFixed(1)}%</span>
                  <span style={{ ...styles.teamArrow, color: arrowColor }}>{arrow}</span>
                </div>
                {spark.length > 1 && (
                  <div style={styles.sparkContainer}>
                    <ResponsiveContainer width="100%" height={24}>
                      <LineChart data={spark} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div style={styles.teamSub}>{team.samples} samples</div>
              </div>
            )
          })}
        </div>

        {/* Layer 2: Heatmap Grid */}
        {heatmapData.orchards.length > 0 && heatmapData.teams.length > 0 && (
          <div style={styles.heatmapWrap}>
            <table style={styles.heatmapTable}>
              <thead>
                <tr>
                  <th style={styles.heatmapCorner} />
                  {heatmapData.orchards.map(o => (
                    <th key={o.key} style={styles.heatmapColHeader} title={o.name}>
                      {o.name.length > 10 ? o.name.slice(0, 9) + '…' : o.name}
                    </th>
                  ))}
                  <th style={{ ...styles.heatmapColHeader, fontWeight: 700, borderLeft: '2px solid #e8e4dc' }}>Avg</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.teams.map(team => (
                  <tr key={team.key}>
                    <td style={styles.heatmapRowHeader}>{team.name}</td>
                    {heatmapData.orchards.map(orchard => {
                      const cellKey = `${team.key}::${orchard.key}`
                      const cell = heatmapData.cells[cellKey]
                      if (!cell) {
                        return <td key={orchard.key} style={styles.heatmapEmpty} />
                      }
                      const value = cell[metric]
                      const bg = heatmapBg(value)
                      const textColor = heatmapText(value)
                      const isHovered = hoveredCell === cellKey
                      return (
                        <td
                          key={orchard.key}
                          style={{
                            ...styles.heatmapCell,
                            background: bg,
                            color: textColor,
                            outline: isHovered ? '2px solid #1c3a2a' : 'none',
                            zIndex: isHovered ? 2 : undefined,
                            position: 'relative' as const,
                          }}
                          onMouseEnter={() => setHoveredCell(cellKey)}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {value.toFixed(1)}
                          {isHovered && (
                            <div style={styles.tooltip}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>{cell.teamName} — {cell.orchardName}</div>
                              <div>Bruising: {cell.bruising.toFixed(1)}%</div>
                              <div>Stem: {cell.stem.toFixed(1)}%</div>
                              <div>Injury: {cell.injury.toFixed(1)}%</div>
                              <div>Samples: {cell.samples}</div>
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td style={{
                      ...styles.heatmapCell,
                      background: heatmapBg(teamAvgForMetric[team.key] || 0),
                      color: heatmapText(teamAvgForMetric[team.key] || 0),
                      fontWeight: 700,
                      borderLeft: '2px solid #e8e4dc',
                    }}>
                      {(teamAvgForMetric[team.key] || 0).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e8e4dc',
    overflow: 'hidden',
    marginBottom: 24,
  },
  cardHeader: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid #f0ede6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#1c3a2a',
  },
  cardBody: {
    padding: '20px 24px',
  },
  tabRow: {
    display: 'flex',
    gap: 4,
  },
  tab: {
    padding: '5px 14px',
    borderRadius: 20,
    border: '1px solid #d4cfca',
    background: '#fff',
    color: '#5a6a60',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  tabActive: {
    padding: '5px 14px',
    borderRadius: 20,
    border: '1px solid #2a6e45',
    background: '#2a6e45',
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#fff',
    display: 'inline-block',
  },
  // Team cards
  teamCardsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  teamCard: {
    flex: '1 1 160px',
    maxWidth: 220,
    minWidth: 140,
    background: '#fafaf6',
    borderRadius: 10,
    border: '1px solid #e8e4dc',
    borderLeft: '4px solid #ccc',
    padding: '14px 16px',
  },
  teamName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1c3a2a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  teamValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  teamValue: {
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  teamArrow: {
    fontSize: 18,
    fontWeight: 600,
  },
  sparkContainer: {
    marginTop: 6,
    marginBottom: 4,
    height: 24,
  },
  teamSub: {
    fontSize: 11,
    color: '#9aaa9f',
  },
  // Heatmap
  heatmapWrap: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  heatmapTable: {
    borderCollapse: 'collapse',
    fontSize: 12,
    width: '100%',
    minWidth: 400,
  },
  heatmapCorner: {
    padding: '8px 10px',
    background: '#fff',
    position: 'sticky' as const,
    left: 0,
    zIndex: 3,
  },
  heatmapColHeader: {
    padding: '8px 6px',
    fontSize: 10,
    fontWeight: 600,
    color: '#9aaa9f',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    maxWidth: 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  heatmapRowHeader: {
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: '#1c3a2a',
    whiteSpace: 'nowrap',
    background: '#fff',
    position: 'sticky' as const,
    left: 0,
    zIndex: 2,
    borderBottom: '1px solid #f0ede6',
  },
  heatmapCell: {
    padding: '7px 6px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 500,
    borderBottom: '1px solid #f0ede6',
    borderRight: '1px solid #f5f3ef',
    cursor: 'default',
    whiteSpace: 'nowrap',
  },
  heatmapEmpty: {
    padding: '7px 6px',
    background: '#f9f9f7',
    borderBottom: '1px solid #f0ede6',
    borderRight: '1px solid #f5f3ef',
  },
  tooltip: {
    position: 'absolute' as const,
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1c3a2a',
    color: '#e8f0e0',
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 1.5,
    whiteSpace: 'nowrap',
    zIndex: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    pointerEvents: 'none',
  },
}

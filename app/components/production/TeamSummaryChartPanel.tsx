'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, Legend, ReferenceLine,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamData {
  team: string
  correctedBinsPerPerson: number | null
  dropsPerTree: number | null
  shinersPerTree: number | null
  bruisingPct: number | null
  headcount: number
}

interface Props {
  teams: TeamData[]
  onTeamClick?: (team: string) => void
}

// ── Colors ───────────────────────────────────────────────────────────────────

const SERIES_COLORS = {
  bins: '#2176d9',
  bruising: '#e85a4a',
  drops: '#f5c842',
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  card:       { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader: { padding: '20px 24px 16px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 },
  cardTitle:  { fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
  empty:      { padding: 40, textAlign: 'center' as const, color: '#8a95a0', fontSize: 13 },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TeamSummaryChartPanel({ teams, onTeamClick }: Props) {
  const chartData = useMemo(() => {
    return teams
      .filter(t => (t.correctedBinsPerPerson || 0) > 0 || (t.bruisingPct || 0) > 0 || (t.dropsPerTree || 0) > 0)
      .map(t => ({
        team: t.team,
        bins: t.correctedBinsPerPerson != null ? Math.round(t.correctedBinsPerPerson * 10) / 10 : 0,
        bruising: t.bruisingPct != null ? Math.round(t.bruisingPct * 10) / 10 : 0,
        drops: Math.round(((t.dropsPerTree || 0) + (t.shinersPerTree || 0)) * 10) / 10,
      }))
      .sort((a, b) => b.bins - a.bins)
  }, [teams])

  const avgBins = useMemo(() => {
    const valid = chartData.filter(d => d.bins > 0)
    if (valid.length === 0) return 0
    return Math.round(valid.reduce((s, d) => s + d.bins, 0) / valid.length * 10) / 10
  }, [chartData])

  if (teams.length === 0 || chartData.length === 0) return null

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.cardTitle}>Team Comparison</span>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#8a95a0' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: SERIES_COLORS.bins, display: 'inline-block' }} />
            Corr. Bins/Person
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: SERIES_COLORS.bruising, display: 'inline-block' }} />
            Bruising %
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: SERIES_COLORS.drops, display: 'inline-block' }} />
            Drops+Shiners/Tree
          </span>
        </div>
      </div>
      <div style={{ padding: '16px 24px 20px' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 5 }} onClick={(e: any) => { if (e?.activeLabel && onTeamClick) onTeamClick(e.activeLabel) }} style={{ cursor: onTeamClick ? 'pointer' : undefined }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="team" fontSize={13} tick={{ fill: '#1a2a3a', fontWeight: 600 }} interval={0} />
            <YAxis yAxisId="left" fontSize={10} tick={{ fill: '#8a95a0' }} />
            <YAxis yAxisId="right" orientation="right" fontSize={10} tick={{ fill: '#8a95a0' }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
              formatter={(val: any, name: any) => {
                const v = Number(val).toFixed(1)
                if (name === 'bins') return [v, 'Corr. Bins/Person']
                if (name === 'bruising') return [`${v}%`, 'Bruising']
                return [v, 'Drops+Shiners/Tree']
              }}
            />
            {avgBins > 0 && (
              <ReferenceLine yAxisId="left" y={avgBins} stroke="#2176d9" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `Avg ${avgBins}`, position: 'right', fontSize: 10, fill: '#2176d9', fontWeight: 600 }} />
            )}
            <Bar yAxisId="left" dataKey="bins" fill={SERIES_COLORS.bins} radius={[4, 4, 0, 0]} barSize={20} name="bins">
              <LabelList dataKey="bins" position="top" fontSize={9} formatter={(v: any) => Number(v).toFixed(1)} />
            </Bar>
            <Bar yAxisId="right" dataKey="bruising" fill={SERIES_COLORS.bruising} radius={[4, 4, 0, 0]} barSize={20} name="bruising">
              <LabelList dataKey="bruising" position="top" fontSize={9} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
            </Bar>
            <Bar yAxisId="right" dataKey="drops" fill={SERIES_COLORS.drops} radius={[4, 4, 0, 0]} barSize={20} name="drops">
              <LabelList dataKey="drops" position="top" fontSize={9} formatter={(v: any) => Number(v).toFixed(1)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, Legend,
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
}

// ── Colors ───────────────────────────────────────────────────────────────────

const COLORS = ['#2176d9', '#4caf72', '#f5c842', '#e85a4a', '#9c27b0', '#00bcd4', '#ff9800', '#607d8b', '#8bc34a', '#e91e63']

function metricColor(metric: 'bins' | 'bruising' | 'drops', val: number): string {
  if (metric === 'bins') return val >= 5 ? '#4caf72' : val >= 3 ? '#f5c842' : '#e85a4a'
  if (metric === 'bruising') return val <= 5 ? '#4caf72' : val <= 15 ? '#f5c842' : '#e85a4a'
  // drops/shiners — lower is better
  return val < 2 ? '#4caf72' : val <= 5 ? '#f5c842' : '#e85a4a'
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  card:       { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader: { padding: '20px 24px 16px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 },
  cardTitle:  { fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
  pill:       { padding: '4px 10px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive: { padding: '4px 10px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  empty:      { padding: 40, textAlign: 'center' as const, color: '#8a95a0', fontSize: 13 },
}

type Metric = 'bins' | 'bruising' | 'drops'

const METRIC_CONFIG: Record<Metric, { label: string; key: keyof TeamData; unit: string; lowerBetter: boolean }> = {
  bins:     { label: 'Corr. Bins/Person', key: 'correctedBinsPerPerson', unit: ' bins', lowerBetter: false },
  bruising: { label: 'Avg Bruising %',    key: 'bruisingPct',           unit: '%',     lowerBetter: true },
  drops:    { label: 'Drops + Shiners/Tree', key: 'dropsPerTree',       unit: '',      lowerBetter: true },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TeamSummaryChartPanel({ teams }: Props) {
  const [metric, setMetric] = useState<Metric>('bins')

  const chartData = useMemo(() => {
    const cfg = METRIC_CONFIG[metric]
    return teams
      .map(t => {
        let val: number
        if (metric === 'drops') {
          val = (t.dropsPerTree || 0) + (t.shinersPerTree || 0)
        } else {
          val = (t[cfg.key] as number) || 0
        }
        return { team: t.team, value: val, headcount: t.headcount }
      })
      .filter(d => d.value > 0)
      .sort((a, b) => cfg.lowerBetter ? a.value - b.value : b.value - a.value)
  }, [teams, metric])

  if (teams.length === 0) return null

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={s.cardTitle}>Team Comparison</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['bins', 'bruising', 'drops'] as Metric[]).map(m => (
            <button key={m} style={metric === m ? s.pillActive : s.pill} onClick={() => setMetric(m)}>
              {METRIC_CONFIG[m].label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 24px 20px' }}>
        {chartData.length === 0 ? (
          <div style={s.empty}>No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40 + 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={11} tick={{ fill: '#8a95a0' }} />
              <YAxis type="category" dataKey="team" width={90} fontSize={12} tick={{ fill: '#1a2a3a' }} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toFixed(1)}${METRIC_CONFIG[metric].unit}`, METRIC_CONFIG[metric].label]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                {chartData.map((d, i) => (
                  <Cell key={d.team} fill={metricColor(metric, d.value)} />
                ))}
                <LabelList dataKey="value" position="right" fontSize={11} formatter={(v: any) => Number(v).toFixed(1)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

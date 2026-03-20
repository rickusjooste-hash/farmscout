'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface CumulativePoint {
  weekLabel: string
  actualCumMm: number
  medianCumMm: number
}

interface Props {
  actualMm: number
  fullSeasonMedian: number
  medianToDate: number
  cumulativeData: CumulativePoint[]
  seasonLabel: string
}

export default function SeasonBudgetTracker({ actualMm, fullSeasonMedian, medianToDate, cumulativeData, seasonLabel }: Props) {
  const pct = fullSeasonMedian > 0 ? (actualMm / fullSeasonMedian) * 100 : 0
  const medianPct = fullSeasonMedian > 0 ? (medianToDate / fullSeasonMedian) * 100 : 0
  const delta = actualMm - medianToDate
  const ahead = delta >= 0
  const deltaColor = ahead ? '#4caf72' : '#e85a4a'

  return (
    <div style={s.card}>
      <div style={s.title}>Season Budget &mdash; {seasonLabel}</div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8a95a0', marginBottom: 6 }}>
          <span>{Math.round(actualMm)} mm</span>
          <span>{Math.round(fullSeasonMedian)} mm (median)</span>
        </div>
        <div style={s.barTrack}>
          <div style={{
            ...s.barFill,
            width: `${Math.min(100, pct)}%`,
            background: ahead ? '#4caf72' : '#e85a4a',
          }} />
          {/* Median marker */}
          <div style={{
            position: 'absolute',
            left: `${Math.min(100, medianPct)}%`,
            top: -2,
            bottom: -2,
            width: 2,
            background: '#1a2a3a',
            borderRadius: 1,
          }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: deltaColor }}>
          {ahead ? '+' : ''}{Math.round(delta)} mm {ahead ? 'ahead' : 'behind'}
        </div>
      </div>

      {/* Cumulative sparkline */}
      {cumulativeData.length > 2 && (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={cumulativeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="weekLabel" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} width={36} unit=" mm" />
            <Tooltip formatter={(v) => `${v} mm`} />
            <Area
              type="monotone"
              dataKey="medianCumMm"
              name="Median"
              stroke="#999"
              strokeDasharray="6 3"
              fill="none"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="actualCumMm"
              name="Actual"
              stroke="#2176d9"
              fill="#2176d9"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px' },
  title:    { fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 16 },
  barTrack: { position: 'relative', height: 10, borderRadius: 5, background: '#f0ede8', overflow: 'visible' },
  barFill:  { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 5, transition: 'width 0.4s ease' },
}

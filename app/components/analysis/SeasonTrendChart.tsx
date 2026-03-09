'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface Props {
  data: Array<Record<string, number | string>>
  commodities: string[]
  commodityColors: Record<string, string>
  currentWeek?: number
}

const DEFAULT_COLORS = [
  '#2a6e45', '#e8924a', '#6b7fa8', '#e8c44a',
  '#9b6bb5', '#c4744a', '#4a9e6b', '#e85a4a',
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1c3a2a', color: '#e8f0e0', padding: '10px 14px',
      borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#a8d5a2' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 2 }}>
          <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
          <span style={{ fontWeight: 600, fontSize: 12 }}>{typeof p.value === 'number' ? p.value.toLocaleString('en-ZA') : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function SeasonTrendChart({ data, commodities, commodityColors, currentWeek }: Props) {
  if (data.length === 0) {
    return <div style={{ color: '#9aaa9f', fontSize: 13, textAlign: 'center', padding: 40 }}>No weekly production data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
          tickLine={false}
          axisLine={{ stroke: '#f0ede6' }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        {currentWeek && (
          <ReferenceLine
            x={`W${currentWeek}`}
            stroke="#1c3a2a"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{ value: 'Now', position: 'insideTopRight', fontSize: 10, fill: '#1c3a2a' }}
          />
        )}
        {commodities.map((c, i) => (
          <Area
            key={c}
            type="monotone"
            dataKey={c}
            stackId="1"
            fill={commodityColors[c] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            stroke={commodityColors[c] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            fillOpacity={0.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

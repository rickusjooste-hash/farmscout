'use client'

import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Legend,
} from 'recharts'

interface WheelPoint {
  month: string
  average: number
  current: number
}

interface Props {
  data: WheelPoint[]
  yearsOfData: number
}

export default function SeasonalWheel({ data, yearsOfData }: Props) {
  const showAverage = yearsOfData >= 3

  return (
    <div style={s.card}>
      <div style={s.title}>Seasonal Pattern</div>
      {!showAverage && (
        <div style={{ fontSize: 12, color: '#e8924a', marginBottom: 8 }}>
          Limited data &mdash; fewer than 3 years available
        </div>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#e8e4dc" />
          <PolarAngleAxis dataKey="month" tick={{ fontSize: 11, fill: '#5a6a60' }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: '#8a95a0' }} />
          {showAverage && (
            <Radar
              name="Long-term avg"
              dataKey="average"
              stroke="#2176d9"
              fill="#2176d9"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          )}
          <Radar
            name="Current season"
            dataKey="current"
            stroke="#e8924a"
            fill="#e8924a"
            fillOpacity={0.05}
            strokeWidth={2}
            strokeDasharray="5 3"
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card:  { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px' },
  title: { fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 12 },
}

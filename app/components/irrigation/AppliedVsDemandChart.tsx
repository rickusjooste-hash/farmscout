'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

export interface SeasonTotal {
  orchard_id: string
  orchard_nr: number | null
  orchard_name: string
  variety: string | null
  variety_group: string | null
  ha: number | null
  season_volume_m3: number
  season_cubes_per_ha: number
  season_need_cubes_per_ha: number
  season_rainfall_mm: number
  last_irrigation_date: string | null
  days_since_irrigation: number | null
}

interface Props {
  data: SeasonTotal[]
  loading?: boolean
}

export default function SeasonCubesChart({ data, loading }: Props) {
  const chartData = useMemo(() => {
    return data
      .map(d => ({
        name: d.orchard_name,
        given: Math.round((d.season_cubes_per_ha ?? 0) * 10) / 10,
        cropNeed: Math.round((d.season_need_cubes_per_ha ?? 0) * 10) / 10,
      }))
      .sort((a, b) => b.given - a.given)
  }, [data])

  if (loading) {
    return (
      <div style={s.card}>
        <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading chart...</div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return null
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>Season Given vs Crop Need by Orchard</div>
      <div style={{ padding: '12px 16px 16px' }}>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 28 + 60)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 20, left: 10, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#8a95a0' }} unit=" m³/ha" />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11, fill: '#1a2a3a' }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e4dc' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [`${Number(value ?? 0).toFixed(1)} m³/ha`, String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="cropNeed" name="Crop Need" fill="#e85a4a" radius={[0, 4, 4, 0]} barSize={14} />
            <Bar dataKey="given" name="Given" fill="#2176d9" radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e8e4dc',
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1a2a3a',
    padding: '16px 20px 12px',
    borderBottom: '1px solid #f0ede8',
  },
}

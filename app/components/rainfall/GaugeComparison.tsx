'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'

interface Reading { gauge_id: string; reading_date: string; value_mm: number }
interface Gauge { id: string; farm_id: string; name: string }

interface Props {
  readings: Reading[]
  gauges: Gauge[]
  gaugeColors: Record<string, string>
}

export default function GaugeComparison({ readings, gauges, gaugeColors }: Props) {
  const data = useMemo(() => {
    // Find last 20 dates where any gauge had rain
    const dateSet = new Set<string>()
    readings.forEach(r => { if (r.value_mm > 0) dateSet.add(r.reading_date) })
    const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a)).slice(0, 20).reverse()

    // Build per-date rows with per-gauge values
    const byDateGauge: Record<string, Record<string, number>> = {}
    readings.forEach(r => {
      if (!dates.includes(r.reading_date)) return
      if (!byDateGauge[r.reading_date]) byDateGauge[r.reading_date] = {}
      const gauge = gauges.find(g => g.id === r.gauge_id)
      if (gauge) byDateGauge[r.reading_date][gauge.name] = r.value_mm
    })

    return dates.map(d => {
      const vals = byDateGauge[d] || {}
      const row: Record<string, string | number | boolean> = {
        date: new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
      }
      gauges.forEach(g => { row[g.name] = vals[g.name] || 0 })

      // Check divergence: any two gauges differ by > 5mm
      const gVals = gauges.map(g => (vals[g.name] || 0) as number)
      let diverges = false
      for (let i = 0; i < gVals.length && !diverges; i++) {
        for (let j = i + 1; j < gVals.length; j++) {
          if (Math.abs(gVals[i] - gVals[j]) > 5) { diverges = true; break }
        }
      }
      row._diverges = diverges
      return row
    })
  }, [readings, gauges])

  if (data.length === 0) return null

  return (
    <div style={s.card}>
      <div style={s.title}>Gauge Comparison &mdash; Last 20 Rain Events</div>
      <ResponsiveContainer width="100%" height={Math.max(280, data.length * 28 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} unit=" mm" />
          <YAxis type="category" dataKey="date" tick={{ fontSize: 10 }} width={60} />
          <Tooltip formatter={(v) => `${v} mm`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {gauges.map(g => (
            <Bar
              key={g.id}
              dataKey={g.name}
              fill={gaugeColors[g.name] || '#8a95a0'}
              radius={[0, 3, 3, 0]}
              barSize={8}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card:  { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px' },
  title: { fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 12 },
}

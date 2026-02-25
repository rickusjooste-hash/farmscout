'use client'
import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

interface WeeklyData {
  week: string
  [pestName: string]: number | string
}

const LINE_COLORS = [
  '#2a6e45', '#e8924a', '#6b7fa8', '#e8c44a',
  '#9b6bb5', '#c4744a', '#4a9e6b', '#e85a4a'
]

// South African fruit season runs roughly Aug–May
// e.g. "2024/25" = Aug 2024 – May 2025
function getSeasonRange(season: string): { from: string; to: string } {
  const [startYr] = season.split('/').map(Number)
  const fullEndYr = Math.floor(startYr / 100) * 100 + (startYr % 100) + 1
  return {
    from: `${startYr}-08-01`,
    to: `${fullEndYr}-07-31`,
  }
}

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1 // 1-12
  // If before August, we're in the season that started last year
  const startYr = mo < 8 ? yr - 1 : yr
  const endYr = (startYr + 1).toString().slice(-2)
  return `${startYr}/${endYr}`
}

function buildSeasonOptions(fromYear: number): string[] {
  const current = getCurrentSeason()
  const currentStartYr = parseInt(current.split('/')[0])
  const seasons = []
  for (let yr = fromYear; yr <= currentStartYr; yr++) {
    const endYr = (yr + 1).toString().slice(-2)
    seasons.push(`${yr}/${endYr}`)
  }
  return seasons.reverse() // most recent first
}

export default function PestTrendChart() {
  const supabase = createClient()
  const [chartData, setChartData] = useState<WeeklyData[]>([])
  const [pestNames, setPestNames] = useState<string[]>([])
  const [selectedPests, setSelectedPests] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [season, setSeason] = useState<string>(getCurrentSeason())
  const seasons = buildSeasonOptions(2023)

  useEffect(() => {
    async function fetchTrends() {
      setLoading(true)
      setError(null)
      setChartData([])
      setPestNames([])

      try {
        const { from, to } = getSeasonRange(season)

        const { data, error } = await supabase
          .rpc('get_pest_trend', { p_from: from, p_to: to })

        if (error) throw new Error(error.message)
        if (!data || data.length === 0) {
          setError(`No pest observations found for ${season}`)
          setLoading(false)
          return
        }

        // Aggregate into chart format
        const pestTotals: Record<string, number> = {}
        const weekPest: Record<string, Record<string, number>> = {}

        data.forEach((row: any) => {
          const { week_label, pest_name, total_count } = row
          if (!weekPest[week_label]) weekPest[week_label] = {}
          weekPest[week_label][pest_name] = total_count
          pestTotals[pest_name] = (pestTotals[pest_name] || 0) + total_count
        })

        const topPests = Object.entries(pestTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name]) => name)

        const sortedWeeks = Object.keys(weekPest).sort((a, b) => {
          const [ya, wa] = a.split('-W').map(Number)
          const [yb, wb] = b.split('-W').map(Number)
          return ya !== yb ? ya - yb : wa - wb
        })

        const chartRows = sortedWeeks.map(week => {
          const row: WeeklyData = { week: 'W' + week.split('-W')[1] }
          topPests.forEach(p => { row[p] = weekPest[week]?.[p] || 0 })
          return row
        })

        setPestNames(topPests)
        setSelectedPests(new Set(topPests))
        setChartData(chartRows)

      } catch (err: any) {
        console.error(err)
        setError(err.message)
      }

      setLoading(false)
    }

    fetchTrends()
  }, [season])

  function togglePest(name: string) {
    setSelectedPests(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: '#1c3a2a', borderRadius: 10, padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ color: '#a8d5a2', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{label} · {season}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
            <span style={{ color: p.color, fontSize: 12 }}>{p.name}</span>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{p.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px', borderBottom: '1px solid #f0ede6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 17, color: '#1c3a2a' }}>
          Pest Pressure Trend
        </div>

        {/* Season selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#9aaa9f', fontFamily: 'DM Sans, sans-serif' }}>Season</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {seasons.map(s => (
              <button key={s} onClick={() => setSeason(s)} style={{
                padding: '5px 12px', borderRadius: 20,
                border: `1.5px solid ${season === s ? '#1c3a2a' : '#e0ddd6'}`,
                background: season === s ? '#1c3a2a' : '#fff',
                color: season === s ? '#a8d5a2' : '#6a7a70',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pest toggles */}
      {pestNames.length > 0 && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0ede6', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pestNames.map((name, i) => (
            <button key={name} onClick={() => togglePest(name)} style={{
              padding: '4px 12px', borderRadius: 20,
              border: `1.5px solid ${selectedPests.has(name) ? LINE_COLORS[i] : '#e0ddd6'}`,
              background: selectedPests.has(name) ? LINE_COLORS[i] + '22' : '#fff',
              color: selectedPests.has(name) ? LINE_COLORS[i] : '#9aaa9f',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
            }}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Chart body */}
      <div style={{ padding: '24px 24px 16px' }}>
        {loading && (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aaa9f', fontSize: 14 }}>
            Loading {season} season data…
          </div>
        )}
        {!loading && error && (
          <div style={{ height: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#e8924a', fontSize: 14, gap: 8 }}>
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'DM Sans' }}
                tickLine={false}
                axisLine={{ stroke: '#f0ede6' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'DM Sans' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {pestNames.map((name, i) =>
                selectedPests.has(name) ? (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={LINE_COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

'use client'
import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'
import { useUserContext } from '@/lib/useUserContext'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface WeeklyData {
  week: string
  [pestName: string]: number | string
}

interface Farm {
  id: string
  full_name: string
}

interface Commodity {
  id: string
  name: string
}

const LINE_COLORS = [
  '#2a6e45', '#e8924a', '#6b7fa8', '#e8c44a',
  '#9b6bb5', '#c4744a', '#4a9e6b', '#e85a4a'
]

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
  const mo = now.getMonth() + 1
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
  return seasons.reverse()
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 20,
      border: `1.5px solid ${active ? '#1c3a2a' : '#e0ddd6'}`,
      background: active ? '#1c3a2a' : '#fff',
      color: active ? '#a8d5a2' : '#6a7a70',
      fontSize: 12, fontWeight: 500, cursor: 'pointer',
      fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

export default function PestTrendChart() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()

  const [chartData, setChartData] = useState<WeeklyData[]>([])
  const [pestNames, setPestNames] = useState<string[]>([])
  const [selectedPests, setSelectedPests] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [season, setSeason] = useState<string>(getCurrentSeason())
  const seasons = buildSeasonOptions(2023)

  const [thresholdByPest, setThresholdByPest] = useState<Record<string, number>>({})

  const [farms, setFarms] = useState<Farm[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string>('')
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>('')

  // Load farms and commodities once context is ready
  useEffect(() => {
    if (!contextLoaded) return
    async function loadFilters() {
      let farmQuery = supabase
        .from('farms')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name')
      if (!isSuperAdmin && farmIds.length > 0) {
        farmQuery = farmQuery.in('id', farmIds)
      }
      const [{ data: farmData }, { data: commodityData }] = await Promise.all([
        farmQuery,
        supabase.from('commodities').select('id, name').order('name'),
      ])
      setFarms(farmData || [])
      setCommodities(commodityData || [])
    }
    loadFilters()
  }, [contextLoaded])

  // Fetch trend data whenever season or filters change
  useEffect(() => {
    if (!contextLoaded) return
    async function fetchTrends() {
      setLoading(true)
      setError(null)
      setChartData([])
      setPestNames([])

      try {
        const { from, to } = getSeasonRange(season)

        const [{ data, error }, { data: thresholdData }] = await Promise.all([
          supabase.rpc('get_pest_trend', {
            p_from: from,
            p_to: to,
            p_farm_id: selectedFarmId || null,
            p_commodity_id: selectedCommodityId || null,
          }),
          supabase.from('trap_thresholds').select('threshold, pests(name)'),
        ])

        // Compute min threshold per pest name
        const newThresholds: Record<string, number> = {}
        ;(thresholdData || []).forEach((t: any) => {
          const name = t.pests?.name
          if (!name || t.threshold == null) return
          if (newThresholds[name] === undefined || t.threshold < newThresholds[name]) {
            newThresholds[name] = t.threshold
          }
        })
        setThresholdByPest(newThresholds)

        if (error) {
          console.error('get_pest_trend RPC error:', error)
          throw new Error(error.message)
        }
        console.log(`get_pest_trend returned ${data?.length ?? 0} rows for ${season} (${from} → ${to})`)
        if (!data || data.length === 0) {
          setError(`No pest data found for ${season}${selectedFarmId ? ' · selected farm' : ''}${selectedCommodityId ? ' · selected commodity' : ''}`)
          setLoading(false)
          return
        }

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
  }, [season, selectedFarmId, selectedCommodityId, contextLoaded])

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
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
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
      {/* Header row — title + season buttons */}
      <div style={{
        padding: '20px 24px 14px', borderBottom: '1px solid #f0ede6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a' }}>
          Pest Pressure Trend
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#9aaa9f' }}>Season</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {seasons.map(s => (
              <button key={s} onClick={() => setSeason(s)} style={{
                padding: '5px 12px', borderRadius: 20,
                border: `1.5px solid ${season === s ? '#1c3a2a' : '#e0ddd6'}`,
                background: season === s ? '#1c3a2a' : '#fff',
                color: season === s ? '#a8d5a2' : '#6a7a70',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter row — farm + commodity pills */}
      {(farms.length > 0 || commodities.length > 0) && (
        <div style={{
          padding: '10px 24px', borderBottom: '1px solid #f0ede6',
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          {farms.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Farm</span>
              <FilterPill label="All" active={!selectedFarmId} onClick={() => setSelectedFarmId('')} />
              {farms.map(f => (
                <FilterPill
                  key={f.id}
                  label={f.full_name}
                  active={selectedFarmId === f.id}
                  onClick={() => setSelectedFarmId(selectedFarmId === f.id ? '' : f.id)}
                />
              ))}
            </div>
          )}

          {farms.length > 0 && commodities.length > 0 && (
            <div style={{ width: 1, height: 20, background: '#e8e4dc', flexShrink: 0 }} />
          )}

          {commodities.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Commodity</span>
              <FilterPill label="All" active={!selectedCommodityId} onClick={() => setSelectedCommodityId('')} />
              {commodities.map(c => (
                <FilterPill
                  key={c.id}
                  label={c.name}
                  active={selectedCommodityId === c.id}
                  onClick={() => setSelectedCommodityId(selectedCommodityId === c.id ? '' : c.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pest toggles */}
      {pestNames.length > 0 && (
        <div style={{ padding: '10px 24px', borderBottom: '1px solid #f0ede6', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pestNames.map((name, i) => (
            <button key={name} onClick={() => togglePest(name)} style={{
              padding: '4px 12px', borderRadius: 20,
              border: `1.5px solid ${selectedPests.has(name) ? LINE_COLORS[i] : '#e0ddd6'}`,
              background: selectedPests.has(name) ? LINE_COLORS[i] + '22' : '#fff',
              color: selectedPests.has(name) ? LINE_COLORS[i] : '#9aaa9f',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
            }}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={{ padding: '24px 24px 16px' }}>
        {loading && (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aaa9f', fontSize: 14 }}>
            Loading {season} season data…
          </div>
        )}
        {!loading && error && (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8924a', fontSize: 14 }}>
            {error}
          </div>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
              {pestNames.map((name, i) =>
                selectedPests.has(name) && thresholdByPest[name] !== undefined ? (
                  <ReferenceLine
                    key={`threshold-${name}`}
                    y={thresholdByPest[name]}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeDasharray="5 3"
                    strokeOpacity={0.5}
                    label={{ value: `${name} limit`, position: 'insideTopRight', fontSize: 10, fill: LINE_COLORS[i % LINE_COLORS.length] }}
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

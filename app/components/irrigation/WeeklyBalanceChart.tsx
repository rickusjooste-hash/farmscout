'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'

interface WeeklyRow {
  week_start: string
  week_label: string
  given_cubes_per_ha: number
  need_cubes_per_ha: number
  rainfall_mm: number
}

interface Props {
  farmIds: string[]
  selectedOrchardId: string | null
  selectedOrchardName: string | null
  selectedOrchardCommodity: string | null
  selectedOrchardVarietyGroup: string | null
}

// ── Phenological stage constants ─────────────────────────────────────────────

export const STAGE_COLORS: Record<string, string> = {
  D:  '#d4cfca',
  BB: '#c8e6c9',
  BL: '#f8bbd0',
  CD: '#b3e5fc',
  FF: '#fff9c4',
  H:  '#ffe0b2',
  PH: '#e1bee7',
  LF: '#d7ccc8',
}

export const STAGE_LABELS: Record<string, string> = {
  D:  'Dormant',
  BB: 'Bud Break',
  BL: 'Bloom',
  CD: 'Cell Div',
  FF: 'Fruit Fill',
  H:  'Harvest',
  PH: 'Post-Harv',
  LF: 'Leaf Fall',
}

export const STAGES = ['D', 'BB', 'BL', 'CD', 'FF', 'H', 'PH', 'LF'] as const

interface StageSpan {
  stage: string
  startIdx: number
  endIdx: number
}

function groupStageSpans(stages: (string | null)[]): StageSpan[] {
  const spans: StageSpan[] = []
  let current: StageSpan | null = null
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i]
    if (!st) { current = null; continue }
    if (current && current.stage === st) {
      current.endIdx = i
    } else {
      current = { stage: st, startIdx: i, endIdx: i }
      spans.push(current)
    }
  }
  return spans
}

export default function WeeklyBalanceChart({
  farmIds, selectedOrchardId, selectedOrchardName,
  selectedOrchardCommodity, selectedOrchardVarietyGroup,
}: Props) {
  const [data, setData] = useState<WeeklyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [stageMap, setStageMap] = useState<Record<number, string> | null>(null)

  // Fetch weekly irrigation data
  useEffect(() => {
    if (farmIds.length === 0) return
    setLoading(true)

    const supabase = createClient()
    const params: Record<string, any> = { p_farm_ids: farmIds }
    if (selectedOrchardId) params.p_orchard_id = selectedOrchardId

    supabase.rpc('get_irrigation_weekly', params)
      .then(({ data: rows, error }) => {
        if (error) {
          console.error('Weekly irrigation fetch error:', error)
          setData([])
        } else {
          setData(rows || [])
        }
        setLoading(false)
      })
  }, [farmIds, selectedOrchardId])

  // Fetch phenological stages from DB when orchard selection changes
  useEffect(() => {
    if (!selectedOrchardId || !selectedOrchardCommodity || !selectedOrchardVarietyGroup) {
      setStageMap(null)
      return
    }
    const supabase = createClient()
    supabase.rpc('get_phenological_stages', {
      p_commodity_code: selectedOrchardCommodity,
      p_variety_group: selectedOrchardVarietyGroup,
    }).then(({ data: rows, error }) => {
      if (error || !rows || rows.length === 0) {
        setStageMap(null)
        return
      }
      const map: Record<number, string> = {}
      for (const r of rows) map[r.month] = r.stage
      setStageMap(map)
    })
  }, [selectedOrchardId, selectedOrchardCommodity, selectedOrchardVarietyGroup])

  const chartData = useMemo(() =>
    data.map(d => ({
      week: 'W' + (d.week_label?.split('-')[1] || ''),
      weekStart: d.week_start,
      given: d.given_cubes_per_ha ?? 0,
      need: d.need_cubes_per_ha ?? 0,
      rain: d.rainfall_mm ?? 0,
    })),
    [data]
  )

  const stageSpans = useMemo(() => {
    if (!stageMap || chartData.length === 0) return []
    const stages = chartData.map(d => {
      const month = new Date(d.weekStart).getMonth() + 1
      return stageMap[month] || null
    })
    return groupStageSpans(stages)
  }, [stageMap, chartData])

  const title = selectedOrchardName
    ? `Weekly Water Balance — ${selectedOrchardName}`
    : 'Weekly Water Balance — All Orchards'

  if (loading && chartData.length === 0) {
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>{title}</div>
        <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading...</div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return null
  }

  const showTimeline = stageSpans.length > 0

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        {title}
        <span style={{ fontSize: 12, color: '#8a95a0', fontWeight: 400, marginLeft: 8 }}>
          Season to date · m³/ha
        </span>
      </div>
      <div style={{ padding: '12px 16px 16px' }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#8a95a0' }}
              tickLine={false}
              axisLine={{ stroke: '#e8e4dc' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#8a95a0' }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e8e4dc' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const unit = name === 'Rain' ? 'mm' : 'm³/ha'
                return [`${Number(value ?? 0).toFixed(1)} ${unit}`, String(name)]
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#e8e4dc" />
            <Bar dataKey="need" name="Crop Need" fill="#e85a4a" radius={[3, 3, 0, 0]} barSize={16} opacity={0.7} />
            <Bar dataKey="given" name="Given" fill="#2176d9" radius={[3, 3, 0, 0]} barSize={16} />
            <Bar dataKey="rain" name="Rain" fill="#3a8fd9" radius={[3, 3, 0, 0]} barSize={10} opacity={0.4} />
          </BarChart>
        </ResponsiveContainer>

        {/* Phenological stage timeline strip */}
        {showTimeline && (
          <div style={s.timelineWrap}>
            <div style={s.timelineLabel}>Growth Stage</div>
            <div style={s.timeline}>
              <div style={{ width: 50, flexShrink: 0 }} />
              <div style={s.timelineCells}>
                {chartData.map((d, i) => {
                  const span = stageSpans.find(sp => i >= sp.startIdx && i <= sp.endIdx)
                  if (!span) return <div key={i} style={s.timelineCell} />
                  const isStart = i === span.startIdx
                  const isEnd = i === span.endIdx
                  const color = STAGE_COLORS[span.stage] || '#eee'
                  return (
                    <div
                      key={i}
                      style={{
                        ...s.timelineCell,
                        background: color,
                        borderTopLeftRadius: isStart ? 4 : 0,
                        borderBottomLeftRadius: isStart ? 4 : 0,
                        borderTopRightRadius: isEnd ? 4 : 0,
                        borderBottomRightRadius: isEnd ? 4 : 0,
                      }}
                      title={STAGE_LABELS[span.stage] || span.stage}
                    >
                      {isStart && (span.endIdx - span.startIdx >= 1) && (
                        <span style={s.timelineCellLabel}>
                          {STAGE_LABELS[span.stage] || span.stage}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ width: 20, flexShrink: 0 }} />
            </div>
          </div>
        )}
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
  timelineWrap: {
    marginTop: 4,
  },
  timelineLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: '#8a95a0',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 4,
    paddingLeft: 50,
  },
  timeline: {
    display: 'flex',
    alignItems: 'stretch',
  },
  timelineCells: {
    display: 'flex',
    flex: 1,
    gap: 1,
  },
  timelineCell: {
    flex: 1,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  timelineCellLabel: {
    fontSize: 9,
    fontWeight: 600,
    color: '#5a5a5a',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0 2px',
  },
}

'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { createClient } from '@/lib/supabase-auth'

const LINE_COLORS = [
  '#2176d9', '#e8924a', '#6b7fa8', '#e8c44a',
  '#9b6bb5', '#c4744a', '#4a9e6b', '#e85a4a',
  '#3a8a6b', '#d46b8a', '#7a6bb5', '#b89a4a',
  '#4a7ac4', '#c45a6b',
]

interface TrendRow {
  season: string
  sample_date: string
  sample_type: string
  nutrient_code: string
  nutrient_name: string
  category: string
  value: number
  unit: string
  display_order: number
}

interface Props {
  orchardId: string
  orchardName: string
  onClose?: () => void
}

export default function NutrientTrendChart({ orchardId, orchardName, onClose }: Props) {
  const [data, setData] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'macro' | 'micro'>('macro')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    const supabase = createClient()
    async function load() {
      try {
        const { data: rows } = await supabase.rpc('get_leaf_analysis_trend', { p_orchard_id: orchardId })
        setData(rows || [])
        const codes = (rows || []).filter((r: TrendRow) => r.category === tab).map((r: TrendRow) => r.nutrient_code)
        setSelected(new Set(codes.slice(0, 4)))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orchardId])

  // Recalculate selected when tab changes
  useEffect(() => {
    const codes = data.filter(r => r.category === tab).map(r => r.nutrient_code)
    setSelected(new Set(codes.slice(0, 4)))
  }, [tab, data])

  // Get unique nutrients for current tab
  const nutrients = [...new Map(
    data.filter(r => r.category === tab).map(r => [r.nutrient_code, r])
  ).values()].sort((a, b) => a.display_order - b.display_order)

  // Build chart data: { season, N: value, P: value, ... }
  const seasons = [...new Set(data.map(r => r.season))].sort()
  const chartData = seasons.map(s => {
    const row: Record<string, any> = { season: s }
    data.filter(r => r.season === s && r.category === tab).forEach(r => {
      row[r.nutrient_code] = r.value
    })
    return row
  })

  const unit = tab === 'macro' ? '%' : 'mg/kg'

  function toggleNutrient(code: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={s.title}>Nutrient Trend — {orchardName}</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setTab('macro')}
              style={{ ...s.tabBtn, ...(tab === 'macro' ? s.tabActive : {}) }}
            >
              Macro
            </button>
            <button
              onClick={() => setTab('micro')}
              style={{ ...s.tabBtn, ...(tab === 'micro' ? s.tabActive : {}) }}
            >
              Micro
            </button>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        )}
      </div>

      {/* Nutrient toggles */}
      <div style={s.toggleRow}>
        {nutrients.map((n, i) => {
          const color = LINE_COLORS[i % LINE_COLORS.length]
          const active = selected.has(n.nutrient_code)
          return (
            <button
              key={n.nutrient_code}
              onClick={() => toggleNutrient(n.nutrient_code)}
              style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                border: `1.5px solid ${active ? color : '#e0ddd6'}`,
                background: active ? `${color}18` : '#fff',
                color: active ? color : '#999',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              }}
            >
              {n.nutrient_code} ({n.unit})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
          Loading...
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
          No data for this orchard
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" />
            <XAxis dataKey="season" tick={{ fontSize: 12, fill: '#6a7a70' }} />
            <YAxis
              tick={{ fontSize: 12, fill: '#6a7a70' }}
              label={{ value: unit, angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6a7a70' } }}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} />
            {nutrients.filter(n => selected.has(n.nutrient_code)).map((n, i) => (
              <Line
                key={n.nutrient_code}
                type="monotone"
                dataKey={n.nutrient_code}
                stroke={LINE_COLORS[nutrients.indexOf(n) % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a4ba0', borderRadius: 10, padding: '12px 16px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
      <div style={{ color: '#a0c4f0', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: '#fff', fontSize: 12, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#a0c4f0' }}>{p.dataKey}:</span>
          <span style={{ fontWeight: 600 }}>{p.value != null ? `${p.value} ${unit}` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 16,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16, fontWeight: 600, color: '#1a2a3a', margin: 0,
    fontFamily: 'Inter, sans-serif',
  },
  tabBtn: {
    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
    border: '1px solid #d4cfca', background: '#fff', color: '#6a7a70',
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  tabActive: {
    background: '#1a2a3a', color: '#fff', border: '1px solid #1a2a3a',
  },
  toggleRow: {
    display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 16,
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, color: '#999',
    cursor: 'pointer', padding: '4px 8px',
  },
}

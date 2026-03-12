'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase-auth'

interface NutrientValue {
  code: string
  name: string
  value: number
  unit: string
  category: string
}

interface NormRange {
  min_optimal: number
  max_optimal: number
  min_adequate: number | null
  max_adequate: number | null
}

interface ProductionData {
  tonHa: number | null
  tons: number
  bins: number
}

interface SizeData {
  dominantLabel: string
  avgWeightG: number
}

interface SizeBin {
  bin_label: string
  display_order: number
  fruit_count: number
  avg_weight_g: number
}

interface TrendRow {
  season: string
  nutrient_code: string
  category: string
  value: number
}

interface Props {
  orchardId: string
  orchardName: string
  commodityName: string
  nutrients: NutrientValue[]
  production: ProductionData | null
  sizeInfo: SizeData | null
  normsLookup?: Record<string, NormRange>  // key: "nutrient_code"
  farmIds: string[]
  season: string
  open: boolean
  onClose: () => void
}

function tonHaColor(tonHa: number | null): string {
  if (tonHa == null) return '#aaa'
  if (tonHa >= 50) return '#2176d9'
  if (tonHa >= 30) return '#4caf72'
  if (tonHa >= 15) return '#f5c842'
  return '#e85a4a'
}

function normColor(value: number, norm: NormRange | undefined): string {
  if (!norm) return '#1a2a3a'
  if (value >= norm.min_optimal && value <= norm.max_optimal) return '#4caf72'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return '#f5c842'
  }
  if (norm.min_adequate != null || norm.max_adequate != null) return '#e85a4a'
  return '#1a2a3a'
}

function normBg(value: number, norm: NormRange | undefined): string {
  if (!norm) return 'transparent'
  if (value >= norm.min_optimal && value <= norm.max_optimal) return 'rgba(76,175,114,0.10)'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return 'rgba(245,200,66,0.10)'
  }
  if (norm.min_adequate != null || norm.max_adequate != null) return 'rgba(232,90,74,0.10)'
  return 'transparent'
}

function normLabel(value: number, norm: NormRange | undefined): string {
  if (!norm) return ''
  if (value >= norm.min_optimal && value <= norm.max_optimal) return 'Optimal'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return 'Adequate'
  }
  if (value < (norm.min_adequate ?? norm.min_optimal)) return 'Low'
  if (value > (norm.max_adequate ?? norm.max_optimal)) return 'High'
  return ''
}

function seasonDateRange(season: string): { from: string; to: string } {
  const startYr = parseInt(season.split('/')[0])
  return {
    from: `${startYr}-08-01T00:00:00Z`,
    to: `${startYr + 1}-07-31T23:59:59Z`,
  }
}

const MACRO_CODES = new Set(['N', 'P', 'K', 'Ca', 'Mg', 'S'])

const LINE_COLORS = [
  '#2176d9', '#e8924a', '#6b7fa8', '#e8c44a',
  '#9b6bb5', '#c4744a', '#4a9e6b', '#e85a4a',
]

export default function OrchardSeasonCard({
  orchardId, orchardName, commodityName, nutrients, production,
  sizeInfo, normsLookup, farmIds, season, open, onClose,
}: Props) {
  const [sizeDist, setSizeDist] = useState<SizeBin[]>([])
  const [sizeLoading, setSizeLoading] = useState(false)
  const [trendData, setTrendData] = useState<TrendRow[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  // Lazy-load size distribution + trend data when card opens
  useEffect(() => {
    if (!open || !orchardId) return
    const supabase = createClient()
    const { from, to } = seasonDateRange(season)

    setSizeLoading(true)
    setTrendLoading(true)

    Promise.all([
      supabase.rpc('get_orchard_size_distribution_bulk', {
        p_farm_ids: farmIds,
        p_from: from,
        p_to: to,
        p_orchard_id: orchardId,
      }),
      supabase.rpc('get_leaf_analysis_trend', { p_orchard_id: orchardId }),
    ]).then(([sizeRes, trendRes]) => {
      setSizeDist((sizeRes.data || []).map((r: any) => ({
        bin_label: r.bin_label,
        display_order: r.display_order,
        fruit_count: Number(r.fruit_count),
        avg_weight_g: Number(r.avg_weight_g),
      })))
      setTrendData(trendRes.data || [])
      setSizeLoading(false)
      setTrendLoading(false)
    })
  }, [open, orchardId, season, farmIds])

  // Split nutrients into macro and micro
  const macros = nutrients.filter(n => n.category === 'macro').sort((a, b) => {
    const order = ['N', 'P', 'K', 'Ca', 'Mg', 'S']
    return order.indexOf(a.code) - order.indexOf(b.code)
  })
  const micros = nutrients.filter(n => n.category === 'micro')

  // Size distribution chart data
  const maxCount = Math.max(...sizeDist.map(s => s.fruit_count), 1)

  // Trend sparkline data: macro nutrients across seasons
  const trendSeasons = [...new Set(trendData.map(r => r.season))].sort()
  const trendNutrients = [...new Map(
    trendData.filter(r => r.category === 'macro').map(r => [r.nutrient_code, r])
  ).values()].slice(0, 4)

  const sparkData = trendSeasons.map(s => {
    const row: Record<string, any> = { season: s }
    trendData.filter(r => r.season === s && r.category === 'macro').forEach(r => {
      row[r.nutrient_code] = r.value
    })
    return row
  })

  return (
    <>
      <style>{`
        .osc-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.2);
          z-index: 8000; opacity: 0; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .osc-overlay.open { opacity: 1; pointer-events: auto; }
        .osc-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 420px; max-width: 100vw; background: #fff;
          z-index: 8001; overflow-y: auto;
          transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: -4px 0 24px rgba(0,0,0,0.08);
          font-family: 'Inter', sans-serif;
        }
        .osc-panel.open { transform: translateX(0); }
        @media (max-width: 480px) { .osc-panel { width: 100vw; } }
      `}</style>

      <div className={`osc-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`osc-panel${open ? ' open' : ''}`}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2a3a' }}>{orchardName}</div>
            <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 2 }}>{commodityName} &middot; {season}</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e4dc',
            background: '#fff', fontSize: 16, cursor: 'pointer', color: '#6a7a70',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>&times;</button>
        </div>

        {/* Production KPIs */}
        {production && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
            <div style={st.sectionTitle}>Production</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={st.kpiLabel}>Bins</div>
                <div style={st.kpiValue}>{Math.round(production.bins).toLocaleString('en-ZA')}</div>
              </div>
              <div>
                <div style={st.kpiLabel}>Tons</div>
                <div style={st.kpiValue}>{production.tons.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}</div>
              </div>
              <div>
                <div style={st.kpiLabel}>T/Ha</div>
                <div style={{ ...st.kpiValue, color: tonHaColor(production.tonHa) }}>
                  {production.tonHa != null ? production.tonHa.toFixed(1) : '\u2014'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nutrient Values — Macros */}
        {macros.length > 0 && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
            <div style={st.sectionTitle}>Macro Nutrients (%)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 12px' }}>
              {macros.map(n => {
                const norm = normsLookup?.[n.code]
                return (
                  <div key={n.code} style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: normBg(n.value, norm),
                  }}>
                    <div style={{ fontSize: 11, color: '#8a95a0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{n.code}</span>
                      {norm && <span style={{ fontSize: 9, color: normColor(n.value, norm), fontWeight: 600 }}>{normLabel(n.value, norm)}</span>}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: normColor(n.value, norm), fontVariantNumeric: 'tabular-nums' }}>
                      {n.value.toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Nutrient Values — Micros */}
        {micros.length > 0 && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
            <div style={st.sectionTitle}>Micro Nutrients (mg/kg)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 8px' }}>
              {micros.map(n => {
                const norm = normsLookup?.[n.code]
                return (
                  <div key={n.code} style={{
                    padding: '6px 8px', borderRadius: 6,
                    background: normBg(n.value, norm),
                  }}>
                    <div style={{ fontSize: 10, color: '#8a95a0' }}>{n.code}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: normColor(n.value, norm), fontVariantNumeric: 'tabular-nums' }}>
                      {n.value.toFixed(1)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Size Distribution */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
          <div style={st.sectionTitle}>
            Fruit Size Distribution
            {sizeInfo && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 8 }}>
              Dominant: {sizeInfo.dominantLabel}
            </span>}
          </div>
          {sizeLoading ? (
            <div style={{ color: '#8a95a0', fontSize: 12 }}>Loading...</div>
          ) : sizeDist.length === 0 ? (
            <div style={{ color: '#8a95a0', fontSize: 12 }}>No QC data for this season</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sizeDist.map(bin => {
                const pct = maxCount > 0 ? (bin.fruit_count / maxCount) * 100 : 0
                return (
                  <div key={bin.bin_label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 72, fontSize: 11, color: '#6a7a70', textAlign: 'right', flexShrink: 0 }}>
                      {bin.bin_label}
                    </div>
                    <div style={{ flex: 1, height: 18, background: '#f4f1eb', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', background: '#2176d9',
                        borderRadius: 4, minWidth: pct > 0 ? 2 : 0,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <div style={{ width: 40, fontSize: 11, color: '#6a7a70', fontVariantNumeric: 'tabular-nums' }}>
                      {bin.fruit_count}
                    </div>
                    <div style={{ width: 40, fontSize: 10, color: '#8a95a0' }}>
                      {bin.avg_weight_g}g
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Nutrient Trend Sparklines */}
        <div style={{ padding: '16px 24px' }}>
          <div style={st.sectionTitle}>Nutrient Trend</div>
          {trendLoading ? (
            <div style={{ color: '#8a95a0', fontSize: 12 }}>Loading...</div>
          ) : sparkData.length < 2 ? (
            <div style={{ color: '#8a95a0', fontSize: 12 }}>Need 2+ seasons for trends</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={sparkData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2fa" />
                <XAxis dataKey="season" tick={{ fontSize: 10, fill: '#8a95a0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8a95a0' }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ background: '#1a4ba0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <div style={{ color: '#a0c4f0', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                        {payload.map((p: any) => (
                          <div key={p.dataKey} style={{ color: '#fff', fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ width: 6, height: 6, borderRadius: 3, background: p.color }} />
                            <span style={{ color: '#a0c4f0' }}>{p.dataKey}:</span>
                            <strong>{p.value?.toFixed(2) ?? '\u2014'}</strong>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                {trendNutrients.map((n, i) => (
                  <Line
                    key={n.nutrient_code}
                    type="monotone"
                    dataKey={n.nutrient_code}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          {/* Trend legend */}
          {sparkData.length >= 2 && trendNutrients.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {trendNutrients.map((n, i) => (
                <div key={n.nutrient_code} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6a7a70' }}>
                  <span style={{ width: 8, height: 3, borderRadius: 1, background: LINE_COLORS[i % LINE_COLORS.length] }} />
                  {n.nutrient_code}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const st: Record<string, React.CSSProperties> = {
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase',
    letterSpacing: '0.8px', marginBottom: 12,
  },
  kpiLabel: { color: '#8a95a0', fontSize: 11 },
  kpiValue: { fontSize: 22, fontWeight: 700, color: '#1a2a3a', fontVariantNumeric: 'tabular-nums' },
}

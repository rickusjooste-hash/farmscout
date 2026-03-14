'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-auth'
import InsightCard from './InsightCard'
import { generateInsights, type OrchardData, type FarmAverages, type NormRange } from './insightEngine'

interface FertProduct {
  timing_label: string
  timing_sort: number
  product_name: string
  confirmed: boolean
  date_applied: string | null
  rate_per_ha: number
  unit: string
  n_pct: number
  p_pct: number
  k_pct: number
}

interface FertStatus {
  confirmed: number
  total: number
  products: FertProduct[]
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

interface QcIssue {
  pest_name: string
  category: string
  total_count: number
  fruit_sampled: number
  pct_of_fruit: number
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
  orchardNr: number | null
  orchardName: string
  variety: string | null
  rootstock: string | null
  yearPlanted: number | null
  commodityId: string
  commodityName: string
  ha: number | null
  season: string
  farmIds: string[]
  open: boolean
  onClose: () => void
  // Pre-fetched data
  nutrients: Record<string, number>
  norms: Record<string, NormRange>
  production: ProductionData | null
  prevProduction: ProductionData | null
  fertStatus: FertStatus | null
  sizeInfo: SizeData | null
  prevSizeInfo: SizeData | null
  qcIssues: QcIssue[]
  farmAvgTonHa: number | null
  pctSmallBins: number | null
  pctLargeBins: number | null
  commodityCode: string | null
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
  return { from: `${startYr}-08-01T00:00:00Z`, to: `${startYr + 1}-07-31T23:59:59Z` }
}

const MACRO_ORDER = ['N', 'P', 'K', 'Ca', 'Mg', 'S']

export default function OrchardScorecard(props: Props) {
  const {
    orchardId, orchardNr, orchardName, variety, rootstock, yearPlanted, commodityId,
    commodityName, ha, season, farmIds, open, onClose,
    nutrients, norms, production, prevProduction, fertStatus,
    sizeInfo, prevSizeInfo, qcIssues, farmAvgTonHa,
    pctSmallBins, pctLargeBins, commodityCode,
  } = props

  const [sizeDist, setSizeDist] = useState<SizeBin[]>([])
  const [sizeLoading, setSizeLoading] = useState(false)
  const [trendData, setTrendData] = useState<TrendRow[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  // Lazy-load size distribution + trend
  useEffect(() => {
    if (!open || !orchardId) return
    let cancelled = false
    const supabase = createClient()
    const { from, to } = seasonDateRange(season)

    async function load() {
      setSizeLoading(true)
      setTrendLoading(true)

      const [sizeRes, trendRes] = await Promise.all([
        supabase.rpc('get_orchard_size_distribution_bulk', {
          p_farm_ids: farmIds,
          p_from: from,
          p_to: to,
          p_orchard_id: orchardId,
        }),
        supabase.rpc('get_leaf_analysis_trend', { p_orchard_id: orchardId }),
      ])
      if (cancelled) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSizeDist((sizeRes.data || []).map((r: any) => ({
        bin_label: r.bin_label,
        display_order: r.display_order,
        fruit_count: Number(r.fruit_count),
        avg_weight_g: Number(r.avg_weight_g),
      })))
      setTrendData(trendRes.data || [])
      setSizeLoading(false)
      setTrendLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [open, orchardId, season, farmIds])

  // Compute NPK applied kg/ha (confirmed applications only)
  const fertNPKApplied = fertStatus ? (() => {
    let totalN = 0, totalP = 0, totalK = 0
    for (const p of fertStatus.products) {
      if (p.confirmed) {
        totalN += p.rate_per_ha * (p.n_pct || 0) / 100
        totalP += p.rate_per_ha * (p.p_pct || 0) / 100
        totalK += p.rate_per_ha * (p.k_pct || 0) / 100
      }
    }
    return { n: totalN, p: totalP, k: totalK }
  })() : null

  // Build insight engine data
  const issuesMap: Record<string, number> = {}
  for (const q of qcIssues) issuesMap[q.pest_name] = q.pct_of_fruit

  const orchardData: OrchardData = {
    orchardId, orchardName, variety, rootstock, yearPlanted,
    commodityId, commodityCode, ha,
    leafNutrients: nutrients,
    norms,
    tonHa: production?.tonHa ?? null,
    prevTonHa: prevProduction?.tonHa ?? null,
    fertConfirmedPct: fertStatus ? (fertStatus.total > 0 ? (fertStatus.confirmed / fertStatus.total) * 100 : null) : null,
    fertNAppliedKgHa: fertNPKApplied?.n ?? null,
    fertPAppliedKgHa: fertNPKApplied?.p ?? null,
    fertKAppliedKgHa: fertNPKApplied?.k ?? null,
    dominantSizeBin: sizeInfo?.dominantLabel ?? null,
    avgWeightG: sizeInfo?.avgWeightG ?? null,
    prevAvgWeightG: prevSizeInfo?.avgWeightG ?? null,
    pctSmallBins, pctLargeBins,
    issues: issuesMap,
  }

  const farmAvg: FarmAverages = { tonHa: farmAvgTonHa }
  const insights = generateInsights(orchardData, farmAvg)

  // Group macros
  const macros = MACRO_ORDER
    .filter(code => nutrients[code] != null)
    .map(code => ({ code, value: nutrients[code] }))

  // Fert products by timing + NPK totals per ha
  const fertByTiming = new Map<string, FertProduct[]>()
  let fertTotalN = 0, fertTotalP = 0, fertTotalK = 0
  if (fertStatus) {
    for (const p of [...fertStatus.products].sort((a, b) => a.timing_sort - b.timing_sort)) {
      const arr = fertByTiming.get(p.timing_label) || []
      arr.push(p)
      fertByTiming.set(p.timing_label, arr)
      // Accumulate NPK kg/ha from all products (prescribed, not just confirmed)
      fertTotalN += p.rate_per_ha * (p.n_pct || 0) / 100
      fertTotalP += p.rate_per_ha * (p.p_pct || 0) / 100
      fertTotalK += p.rate_per_ha * (p.k_pct || 0) / 100
    }
  }

  // Prev season delta
  const prevDelta = production?.tonHa != null && prevProduction?.tonHa != null && prevProduction.tonHa > 0
    ? ((production.tonHa - prevProduction.tonHa) / prevProduction.tonHa * 100)
    : null

  // Size dist chart
  const maxSizeCount = Math.max(...sizeDist.map(s => s.fruit_count), 1)

  // Issue bars
  const maxIssueCount = Math.max(...qcIssues.map(q => q.pct_of_fruit), 1)

  // Trend sparkline
  const trendSeasons = [...new Set(trendData.map(r => r.season))].sort()
  const trendNutrientCodes = [...new Set(
    trendData.filter(r => r.category === 'macro').map(r => r.nutrient_code)
  )].slice(0, 4)

  return (
    <>
      <style>{`
        .isc-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.2);
          z-index: 8000; opacity: 0; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .isc-overlay.open { opacity: 1; pointer-events: auto; }
        .isc-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 420px; max-width: 100vw; background: #fff;
          z-index: 8001; overflow-y: auto;
          transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: -4px 0 24px rgba(0,0,0,0.08);
          font-family: 'Inter', sans-serif;
        }
        .isc-panel.open { transform: translateX(0); }
        @media (max-width: 480px) { .isc-panel { width: 100vw; } }
      `}</style>

      <div className={`isc-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`isc-panel${open ? ' open' : ''}`}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2a3a' }}>
              {orchardNr != null ? `${orchardNr} ` : ''}{orchardName}{variety ? ` (${variety})` : ''}
            </div>
            <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 2 }}>
              {commodityName}
              {rootstock && ` \u00B7 ${rootstock}`}
              {ha && ` \u00B7 ${ha} ha`}
              {' \u00B7 '}{season}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e4dc',
            background: '#fff', fontSize: 16, cursor: 'pointer', color: '#6a7a70',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>&times;</button>
        </div>

        {/* A. Fertilizer (Input) */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
          <div style={st.sectionTitle}>Fertilizer Programme</div>
          {fertStatus && fertStatus.products.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e8e4dc', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: fertStatus.confirmed >= fertStatus.total ? '#4caf72' : '#f5c842',
                    width: `${fertStatus.total > 0 ? (fertStatus.confirmed / fertStatus.total * 100) : 0}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6a7a70' }}>
                  {fertStatus.confirmed}/{fertStatus.total}
                </span>
              </div>
              {/* NPK kg/ha totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#8a95a0' }}>N kg/ha</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a', fontVariantNumeric: 'tabular-nums' }}>
                    {fertTotalN > 0 ? fertTotalN.toFixed(1) : '\u2014'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#8a95a0' }}>P kg/ha</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a', fontVariantNumeric: 'tabular-nums' }}>
                    {fertTotalP > 0 ? fertTotalP.toFixed(1) : '\u2014'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#8a95a0' }}>K kg/ha</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a', fontVariantNumeric: 'tabular-nums' }}>
                    {fertTotalK > 0 ? fertTotalK.toFixed(1) : '\u2014'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...fertByTiming.entries()].map(([timing, products]) => {
                  const allConf = products.every(p => p.confirmed)
                  const anyConf = products.some(p => p.confirmed)
                  return (
                    <div key={timing} style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: 12,
                      background: allConf ? 'rgba(76,175,114,0.06)' : anyConf ? 'rgba(245,200,66,0.06)' : 'rgba(232,90,74,0.06)',
                      border: `1px solid ${allConf ? 'rgba(76,175,114,0.15)' : anyConf ? 'rgba(245,200,66,0.15)' : 'rgba(232,90,74,0.15)'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: '#1a2a3a' }}>{timing}</span>
                        <span style={{ fontWeight: 600, color: allConf ? '#2d8a4e' : anyConf ? '#9a7b1a' : '#c23616' }}>
                          {allConf ? '\u2713' : anyConf ? '\u25D0' : '\u2717'}
                        </span>
                      </div>
                      <div style={{ color: '#6a7a70' }}>
                        {products.map(p => `${p.product_name} ${p.rate_per_ha} ${p.unit}`).join(' \u00B7 ')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={st.noData}>No fertilizer programme</div>
          )}
        </div>

        {/* B. Leaf Analysis (Uptake) */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
          <div style={st.sectionTitle}>Leaf Analysis</div>
          {macros.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 12px' }}>
              {macros.map(({ code, value }) => {
                const norm = norms[code]
                return (
                  <div key={code} style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: normBg(value, norm),
                  }}>
                    <div style={{ fontSize: 11, color: '#8a95a0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{code}</span>
                      {norm && <span style={{ fontSize: 9, color: normColor(value, norm), fontWeight: 600 }}>{normLabel(value, norm)}</span>}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: normColor(value, norm), fontVariantNumeric: 'tabular-nums' }}>
                      {value.toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={st.noData}>No leaf analysis data</div>
          )}
          {/* Mini trend */}
          {trendLoading && <div style={{ color: '#8a95a0', fontSize: 11, marginTop: 8 }}>Loading trend...</div>}
          {!trendLoading && trendSeasons.length >= 2 && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#6a7a70' }}>
              Trend: {trendNutrientCodes.map(code => {
                const vals = trendSeasons.map(s => trendData.find(r => r.season === s && r.nutrient_code === code)?.value)
                const latest = vals[vals.length - 1]
                const prev = vals[vals.length - 2]
                if (latest == null || prev == null) return null
                const delta = latest - prev
                const arrow = delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2192'
                return `${code} ${arrow}${Math.abs(delta).toFixed(2)}`
              }).filter(Boolean).join(' \u00B7 ')}
            </div>
          )}
        </div>

        {/* C. Production (Output) */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
          <div style={st.sectionTitle}>Production</div>
          {production ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              <div>
                <div style={st.kpiLabel}>T/Ha</div>
                <div style={{ ...st.kpiValue, color: tonHaColor(production.tonHa) }}>
                  {production.tonHa != null ? production.tonHa.toFixed(1) : '\u2014'}
                </div>
              </div>
              <div>
                <div style={st.kpiLabel}>Tons</div>
                <div style={st.kpiValue}>{production.tons.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}</div>
              </div>
              <div>
                <div style={st.kpiLabel}>Bins</div>
                <div style={st.kpiValue}>{Math.round(production.bins).toLocaleString('en-ZA')}</div>
              </div>
              <div>
                <div style={st.kpiLabel}>{'\u0394'} Prev</div>
                <div style={{
                  ...st.kpiValue,
                  color: prevDelta == null ? '#aaa' : prevDelta >= 0 ? '#4caf72' : '#e85a4a',
                }}>
                  {prevDelta != null ? `${prevDelta >= 0 ? '+' : ''}${prevDelta.toFixed(0)}%` : '\u2014'}
                </div>
              </div>
            </div>
          ) : (
            <div style={st.noData}>No production data</div>
          )}
        </div>

        {/* D. Size Distribution (Value) */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
          <div style={st.sectionTitle}>
            Fruit Size
            {sizeInfo && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 8 }}>
              Dominant: {sizeInfo.dominantLabel} {'\u00B7'} {sizeInfo.avgWeightG.toFixed(0)}g
            </span>}
          </div>
          {sizeLoading ? (
            <div style={{ color: '#8a95a0', fontSize: 12 }}>Loading...</div>
          ) : sizeDist.length === 0 ? (
            <div style={st.noData}>No QC size data</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sizeDist.map((bin, i) => {
                const pct = maxSizeCount > 0 ? (bin.fruit_count / maxSizeCount) * 100 : 0
                return (
                  <div key={`${bin.bin_label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 72, fontSize: 11, color: '#6a7a70', textAlign: 'right', flexShrink: 0 }}>
                      {bin.bin_label}
                    </div>
                    <div style={{ flex: 1, height: 16, background: '#f4f1eb', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', background: '#2176d9',
                        borderRadius: 4, minWidth: pct > 0 ? 2 : 0,
                      }} />
                    </div>
                    <div style={{ width: 40, fontSize: 11, color: '#6a7a70', fontVariantNumeric: 'tabular-nums' }}>
                      {bin.fruit_count}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* E. Quality (Issues) */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
          <div style={st.sectionTitle}>Quality Issues</div>
          {qcIssues.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {qcIssues.map(q => (
                <div key={q.pest_name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 100, fontSize: 12, color: '#1a2a3a', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.pest_name}
                  </div>
                  <div style={{ flex: 1, height: 14, background: '#f4f1eb', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${maxIssueCount > 0 ? (q.pct_of_fruit / maxIssueCount) * 100 : 0}%`,
                      height: '100%', background: q.pct_of_fruit > 2 ? '#e85a4a' : q.pct_of_fruit > 1 ? '#f5c842' : '#6b7fa8',
                      borderRadius: 3, minWidth: q.pct_of_fruit > 0 ? 2 : 0,
                    }} />
                  </div>
                  <div style={{ width: 40, fontSize: 11, color: '#6a7a70', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {q.pct_of_fruit.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={st.noData}>No QC issues recorded</div>
          )}
        </div>

        {/* F. Auto-Insights */}
        <div style={{ padding: '16px 24px' }}>
          <div style={st.sectionTitle}>Insights</div>
          {insights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
            </div>
          ) : (
            <div style={st.noData}>No issues detected</div>
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
  kpiValue: { fontSize: 20, fontWeight: 700, color: '#1a2a3a', fontVariantNumeric: 'tabular-nums' },
  noData: { color: '#b0a99f', fontSize: 12, fontStyle: 'italic' },
}

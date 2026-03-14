'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import OrchardSummaryTable from '@/app/components/intelligence/OrchardSummaryTable'
import OrchardScorecard from '@/app/components/intelligence/OrchardScorecard'
import { calculateScore, type NormRange } from '@/app/components/intelligence/scoreCalculator'

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  return `${mo < 8 ? yr - 1 : yr}/${String(mo < 8 ? yr : yr + 1).slice(-2)}`
}

function prevSeason(season: string): string {
  const yr = parseInt(season.split('/')[0])
  return `${yr - 1}/${String(yr).slice(-2)}`
}

function buildSeasonOptions(fromYear: number): string[] {
  const currentStartYr = parseInt(getCurrentSeason().split('/')[0])
  const seasons: string[] = []
  for (let yr = fromYear; yr <= currentStartYr; yr++)
    seasons.push(`${yr}/${String(yr + 1).slice(-2)}`)
  return seasons.reverse()
}

function seasonDateRange(season: string): { from: string; to: string } {
  const startYr = parseInt(season.split('/')[0])
  return { from: `${startYr}-08-01T00:00:00Z`, to: `${startYr + 1}-07-31T23:59:59Z` }
}

interface Farm { id: string; full_name: string; code: string }
interface Commodity { id: string; code: string; name: string }
interface Orchard {
  id: string; name: string; orchard_nr: number | null; variety: string | null; rootstock: string | null
  ha: number | null; commodity_id: string; year_planted: number | null
}
interface ProdRow { orchard_id: string; ton_ha: number | null; tons: number; bins: number }
interface SizeRow { orchard_id: string; dominant_label: string; avg_weight_g: number; fruit_count: number; total_fruit: number }
interface LeafRow {
  orchard_id: string; nutrient_code: string; value: number; category: string
}
interface QcIssueRow {
  orchard_id: string; pest_name: string; category: string
  total_count: number; fruit_sampled: number; pct_of_fruit: number
}
interface FertLine {
  line_id: string; orchard_id: string; timing_label: string; timing_sort: number
  product_name: string; confirmed: boolean; date_applied: string | null
  rate_per_ha: number; unit: string
}
interface FertSummaryLine {
  product_name: string; n_pct: number; p_pct: number; k_pct: number
}
interface FertOrchardStatus {
  confirmed: number; total: number
  products: {
    timing_label: string; timing_sort: number; product_name: string
    confirmed: boolean; date_applied: string | null
    rate_per_ha: number; unit: string; n_pct: number; p_pct: number; k_pct: number
  }[]
}

export default function IntelligencePage() {
  const { farmIds, isSuperAdmin, contextLoaded, orgId, allowedRoutes, allowed } = usePageGuard()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [farms, setFarms] = useState<Farm[]>([])
  const [modules, setModules] = useState<string[]>(['farmscout'])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])

  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [season, setSeason] = useState(getCurrentSeason())
  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)

  // Data lookups
  const [productionByOrchard, setProductionByOrchard] = useState<Record<string, { tonHa: number | null; tons: number; bins: number }>>({})
  const [prevProductionByOrchard, setPrevProductionByOrchard] = useState<Record<string, { tonHa: number | null; tons: number; bins: number }>>({})
  const [sizeByOrchard, setSizeByOrchard] = useState<Record<string, { dominantLabel: string; avgWeightG: number }>>({})
  const [prevSizeByOrchard, setPrevSizeByOrchard] = useState<Record<string, { dominantLabel: string; avgWeightG: number }>>({})
  const [nutrientsByOrchard, setNutrientsByOrchard] = useState<Record<string, Record<string, number>>>({})
  const [normsLookup, setNormsLookup] = useState<Record<string, NormRange>>({})
  const [qcByOrchard, setQcByOrchard] = useState<Record<string, QcIssueRow[]>>({})
  const [fertByOrchard, setFertByOrchard] = useState<Record<string, FertOrchardStatus>>({})


  const seasonOptions = buildSeasonOptions(2018)

  // Load farms + modules
  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const [{ data: farmData }, { data: commData }] = await Promise.all([
        isSuperAdmin
          ? supabase.from('farms').select('id, full_name, code').eq('is_active', true).order('full_name')
          : supabase.from('farms').select('id, full_name, code').in('id', farmIds).eq('is_active', true).order('full_name'),
        supabase.from('commodities').select('id, code, name').order('name'),
      ])
      setFarms(farmData || [])
      setCommodities((commData || []) as Commodity[])
      if (farmData?.length && !selectedFarmId) setSelectedFarmId(farmData[0].id)

      if (orgId) {
        const { data: org } = await supabase.from('organisations').select('modules').eq('id', orgId).single()
        if (org?.modules) setModules(org.modules)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin, orgId])

  // Load norms once
  useEffect(() => {
    if (!contextLoaded) return
    async function loadNorms() {
      try {
        const res = await fetch('/api/leaf-analysis/norms')
        if (!res.ok) return
        const { norms: normsData } = await res.json()
        if (!normsData?.length) return

        const lookup: Record<string, NormRange> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sorted = [...(normsData as any[])].sort((a: any, b: any) => {
          const aScore = (a.organisation_id ? 1 : 0) + (a.variety ? 1 : 0)
          const bScore = (b.organisation_id ? 1 : 0) + (b.variety ? 1 : 0)
          return aScore - bScore
        })
        for (const n of sorted) {
          const code = n.nutrients?.code
          if (!code) continue
          const range: NormRange = {
            min_optimal: Number(n.min_optimal),
            max_optimal: Number(n.max_optimal),
            min_adequate: n.min_adequate != null ? Number(n.min_adequate) : null,
            max_adequate: n.max_adequate != null ? Number(n.max_adequate) : null,
          }
          if (!n.variety) lookup[`${n.commodity_id}:${code}`] = range
          if (n.variety) lookup[`${n.commodity_id}:${n.variety}:${code}`] = range
        }
        setNormsLookup(lookup)
      } catch { /* non-critical */ }
    }
    loadNorms()
  }, [contextLoaded])

  // Fetch all data when farm/season changes
  const fetchData = useCallback(async () => {
    if (!selectedFarmId) return
    setLoading(true)
    setSelectedOrchardId(null)

    const { from, to } = seasonDateRange(season)
    const prev = prevSeason(season)
    const { from: prevFrom, to: prevTo } = seasonDateRange(prev)

    try {
      // Core data — these RPCs all exist and are required
      const [
        { data: orchardData },
        { data: leafData },
        { data: prodData },
        { data: prevProdData },
        { data: sizeData },
        { data: prevSizeData },
      ] = await Promise.all([
        supabase.from('orchards')
          .select('id, orchard_nr, name, variety, rootstock, ha, commodity_id, year_planted')
          .eq('farm_id', selectedFarmId)
          .eq('is_active', true)
          .order('name'),
        supabase.rpc('get_leaf_analysis_summary', {
          p_farm_ids: [selectedFarmId],
          p_season: season,
        }),
        supabase.rpc('get_production_summary', {
          p_farm_ids: [selectedFarmId],
          p_season: season,
        }),
        supabase.rpc('get_production_summary', {
          p_farm_ids: [selectedFarmId],
          p_season: prev,
        }),
        supabase.rpc('get_orchard_dominant_sizes', {
          p_farm_ids: [selectedFarmId],
          p_from: from,
          p_to: to,
        }),
        supabase.rpc('get_orchard_dominant_sizes', {
          p_farm_ids: [selectedFarmId],
          p_from: prevFrom,
          p_to: prevTo,
        }),
      ])

      setOrchards((orchardData || []) as Orchard[])

      // Production lookup
      const prodMap: Record<string, { tonHa: number | null; tons: number; bins: number }> = {}
      for (const r of (prodData || []) as ProdRow[]) {
        prodMap[r.orchard_id] = { tonHa: r.ton_ha != null ? Number(r.ton_ha) : null, tons: Number(r.tons || 0), bins: Number(r.bins || 0) }
      }
      setProductionByOrchard(prodMap)

      // Previous production
      const prevProdMap: Record<string, { tonHa: number | null; tons: number; bins: number }> = {}
      for (const r of (prevProdData || []) as ProdRow[]) {
        prevProdMap[r.orchard_id] = { tonHa: r.ton_ha != null ? Number(r.ton_ha) : null, tons: Number(r.tons || 0), bins: Number(r.bins || 0) }
      }
      setPrevProductionByOrchard(prevProdMap)

      // Size lookup
      const sizeMap: Record<string, { dominantLabel: string; avgWeightG: number }> = {}
      for (const r of (sizeData || []) as SizeRow[]) {
        sizeMap[r.orchard_id] = { dominantLabel: r.dominant_label, avgWeightG: Number(r.avg_weight_g) }
      }
      setSizeByOrchard(sizeMap)

      // Previous size lookup
      const prevSizeMap: Record<string, { dominantLabel: string; avgWeightG: number }> = {}
      for (const r of (prevSizeData || []) as SizeRow[]) {
        prevSizeMap[r.orchard_id] = { dominantLabel: r.dominant_label, avgWeightG: Number(r.avg_weight_g) }
      }
      setPrevSizeByOrchard(prevSizeMap)

      // Leaf nutrients per orchard
      const nutMap: Record<string, Record<string, number>> = {}
      for (const r of (leafData || []) as LeafRow[]) {
        if (!nutMap[r.orchard_id]) nutMap[r.orchard_id] = {}
        nutMap[r.orchard_id][r.nutrient_code] = r.value
      }
      setNutrientsByOrchard(nutMap)

      // QC issues — separate call (RPC may not be deployed yet)
      try {
        const { data: qcData } = await supabase.rpc('get_qc_issues_by_orchard', {
          p_farm_ids: [selectedFarmId],
          p_from: from,
          p_to: to,
        })
        const qcMap: Record<string, QcIssueRow[]> = {}
        for (const r of (qcData || []) as QcIssueRow[]) {
          if (!qcMap[r.orchard_id]) qcMap[r.orchard_id] = []
          qcMap[r.orchard_id].push(r)
        }
        setQcByOrchard(qcMap)
      } catch (err) {
        console.error('[Intelligence] QC issues fetch failed:', err)
        setQcByOrchard({})
      }

      // Fert data (via API, non-blocking)
      try {
        const fertRes = await fetch(`/api/fertilizer/confirm?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`)
        if (fertRes.ok) {
          const fertData = await fertRes.json() as FertLine[]
          const fertSummaryRes = await fetch(`/api/fertilizer?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`)
          const fertSummary = fertSummaryRes.ok ? await fertSummaryRes.json() as FertSummaryLine[] : []
          const productNutrients: Record<string, { n_pct: number; p_pct: number; k_pct: number }> = {}
          for (const fs of fertSummary) {
            if (!productNutrients[fs.product_name]) {
              productNutrients[fs.product_name] = { n_pct: fs.n_pct || 0, p_pct: fs.p_pct || 0, k_pct: fs.k_pct || 0 }
            }
          }
          const fertMap: Record<string, FertOrchardStatus> = {}
          for (const r of fertData) {
            if (!r.orchard_id) continue
            if (!fertMap[r.orchard_id]) fertMap[r.orchard_id] = { confirmed: 0, total: 0, products: [] }
            fertMap[r.orchard_id].total++
            if (r.confirmed) fertMap[r.orchard_id].confirmed++
            const pn = productNutrients[r.product_name] || { n_pct: 0, p_pct: 0, k_pct: 0 }
            fertMap[r.orchard_id].products.push({
              timing_label: r.timing_label, timing_sort: r.timing_sort,
              product_name: r.product_name, confirmed: r.confirmed,
              date_applied: r.date_applied, rate_per_ha: r.rate_per_ha, unit: r.unit,
              n_pct: pn.n_pct, p_pct: pn.p_pct, k_pct: pn.k_pct,
            })
          }
          setFertByOrchard(fertMap)
        } else {
          setFertByOrchard({})
        }
      } catch { setFertByOrchard({}) }

    } catch {
      setOrchards([])
    } finally {
      setLoading(false)
    }
  }, [selectedFarmId, season])

  useEffect(() => {
    if (selectedFarmId) fetchData()
  }, [fetchData, selectedFarmId])

  // Commodity code lookup
  const commodityCodeById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of commodities) map[c.id] = c.code
    return map
  }, [commodities])

  // Compute norms per orchard (resolve commodity + variety overrides)
  const normsByOrchard = useMemo(() => {
    const result: Record<string, Record<string, NormRange>> = {}
    for (const o of orchards) {
      const normsForOrchard: Record<string, NormRange> = {}
      for (const [key, range] of Object.entries(normsLookup)) {
        const parts = key.split(':')
        if (parts.length === 2 && parts[0] === o.commodity_id) {
          normsForOrchard[parts[1]] = range
        }
        // Variety-specific overrides
        if (parts.length === 3 && parts[0] === o.commodity_id && o.variety && parts[1].toLowerCase() === o.variety.toLowerCase()) {
          normsForOrchard[parts[2]] = range
        }
      }
      result[o.id] = normsForOrchard
    }
    return result
  }, [orchards, normsLookup])

  // Farm avg T/Ha
  const farmAvgTonHa = useMemo(() => {
    const vals = Object.values(productionByOrchard).map(p => p.tonHa).filter((v): v is number => v != null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }, [productionByOrchard])

  // Compute scores
  const scoredOrchards = useMemo(() => {
    return orchards.map(o => {
      const nuts = nutrientsByOrchard[o.id] || {}
      const norms = normsByOrchard[o.id] || {}
      const prod = productionByOrchard[o.id]
      const qcIssues = qcByOrchard[o.id] || []
      const fert = fertByOrchard[o.id]
      const size = sizeByOrchard[o.id]

      // Total issue rate
      const totalIssueRate = qcIssues.length > 0
        ? qcIssues.reduce((sum, q) => sum + q.pct_of_fruit, 0)
        : null

      // Compute pct upper bins — estimate from dominant bin label
      // We'll use a simple heuristic: if we have size data
      let pctUpperBins: number | null = null
      // We don't have full bin distribution at the summary level,
      // so we'll leave this null and let the score use the neutral fallback

      const score = calculateScore({
        tonHa: prod?.tonHa ?? null,
        farmAvgTonHa,
        leafNutrients: nuts,
        norms,
        issueRate: totalIssueRate,
        fertConfirmedPct: fert ? (fert.total > 0 ? (fert.confirmed / fert.total) * 100 : null) : null,
        dominantSizeBin: size?.dominantLabel ?? null,
        pctUpperBins,
      })

      return { ...o, score }
    })
  }, [orchards, nutrientsByOrchard, normsByOrchard, productionByOrchard, qcByOrchard, fertByOrchard, sizeByOrchard, farmAvgTonHa])

  // Selected orchard details
  const selectedOrchard = orchards.find(o => o.id === selectedOrchardId)

  // KPIs
  const orchardCount = orchards.length
  const orchWithLeaf = Object.keys(nutrientsByOrchard).length
  const orchWithProd = Object.keys(productionByOrchard).length
  const orchWithQc = Object.keys(qcByOrchard).length
  const avgScore = scoredOrchards.length > 0
    ? Math.round(scoredOrchards.reduce((s, o) => s + o.score, 0) / scoredOrchards.length)
    : 0

  if (!allowed) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eae6df', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={st.main}>
        {/* Header */}
        <div style={st.headerRow}>
          <div>
            <h1 style={st.pageTitle}>Orchard Intelligence</h1>
            <p style={st.subtitle}>Cross-stream performance analysis: Input {'\u2192'} Uptake {'\u2192'} Output {'\u2192'} Value {'\u2192'} Quality</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={season} onChange={e => setSeason(e.target.value)} style={st.seasonSelect}>
              {seasonOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Farm pills */}
        <div style={st.filterRow}>
          <div style={st.pillGroup}>
            {farms.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFarmId(f.id)}
                style={{ ...st.pill, ...(selectedFarmId === f.id ? st.pillActive : {}) }}
              >
                {f.code || f.full_name}
              </button>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div style={st.kpiStrip}>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{orchardCount}</div>
            <div style={st.kpiLabel}>Orchards</div>
          </div>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{orchWithLeaf}</div>
            <div style={st.kpiLabel}>With Leaf Data</div>
          </div>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{orchWithProd}</div>
            <div style={st.kpiLabel}>With Production</div>
          </div>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{orchWithQc}</div>
            <div style={st.kpiLabel}>With QC Data</div>
          </div>
          <div style={st.kpiCard}>
            <div style={{ ...st.kpiValue, color: avgScore >= 50 ? '#4caf72' : '#e85a4a' }}>{avgScore}</div>
            <div style={st.kpiLabel}>Avg Score</div>
          </div>
          {farmAvgTonHa != null && (
            <div style={st.kpiCard}>
              <div style={st.kpiValue}>{farmAvgTonHa.toFixed(1)}</div>
              <div style={st.kpiLabel}>Farm Avg T/Ha</div>
            </div>
          )}
        </div>

        {/* Summary table */}
        <OrchardSummaryTable
          orchards={scoredOrchards}
          fertByOrchard={fertByOrchard}
          productionByOrchard={productionByOrchard}
          prevProductionByOrchard={prevProductionByOrchard}
          sizeByOrchard={sizeByOrchard}
          qcByOrchard={qcByOrchard}
          nutrientsByOrchard={nutrientsByOrchard}
          normsByOrchard={normsByOrchard}
          farmAvgTonHa={farmAvgTonHa}
          selectedOrchardId={selectedOrchardId}
          onSelectOrchard={id => setSelectedOrchardId(prev => prev === id ? null : id)}
          loading={loading}
        />

        {/* Empty state */}
        {!loading && orchards.length === 0 && (
          <div style={st.emptyState}>
            <h3 style={{ color: '#1a2a3a', margin: '0 0 8px' }}>No orchards found</h3>
            <p style={{ color: '#6a7a70', fontSize: 14, margin: 0 }}>
              Select a farm with active orchards to view intelligence data.
            </p>
          </div>
        )}
      </main>

      {/* Scorecard slide-in */}
      {selectedOrchardId && selectedOrchard && (
        <OrchardScorecard
          orchardId={selectedOrchardId}
          orchardNr={selectedOrchard.orchard_nr}
          orchardName={selectedOrchard.name}
          variety={selectedOrchard.variety}
          rootstock={selectedOrchard.rootstock}
          yearPlanted={selectedOrchard.year_planted}
          commodityId={selectedOrchard.commodity_id}
          commodityCode={commodityCodeById[selectedOrchard.commodity_id] || null}
          commodityName=""
          ha={selectedOrchard.ha}
          season={season}
          farmIds={selectedFarmId ? [selectedFarmId] : []}
          open={true}
          onClose={() => setSelectedOrchardId(null)}
          nutrients={nutrientsByOrchard[selectedOrchardId] || {}}
          norms={normsByOrchard[selectedOrchardId] || {}}
          production={productionByOrchard[selectedOrchardId] || null}
          prevProduction={prevProductionByOrchard[selectedOrchardId] || null}
          fertStatus={fertByOrchard[selectedOrchardId] || null}
          sizeInfo={sizeByOrchard[selectedOrchardId] || null}
          prevSizeInfo={prevSizeByOrchard[selectedOrchardId] || null}
          qcIssues={qcByOrchard[selectedOrchardId] || []}
          farmAvgTonHa={farmAvgTonHa}
          pctSmallBins={null}
          pctLargeBins={null}
        />
      )}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  main: {
    flex: 1, padding: '32px 40px', overflowY: 'auto', minHeight: '100vh',
  },
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 24, flexWrap: 'wrap', gap: 12,
  },
  pageTitle: {
    fontSize: 24, fontWeight: 700, color: '#1a2a3a', margin: 0,
  },
  subtitle: {
    fontSize: 14, color: '#6a7a70', margin: '4px 0 0',
  },
  seasonSelect: {
    padding: '8px 12px', border: '1px solid #d4cfca', borderRadius: 8,
    fontSize: 14, background: '#fff', color: '#1a2a3a', outline: 'none',
    fontFamily: 'Inter, sans-serif',
  },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
    flexWrap: 'wrap',
  },
  pillGroup: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
  },
  pill: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca',
    background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'all 0.15s',
  },
  pillActive: {
    border: '1px solid #2176d9', background: '#2176d9', color: '#fff',
  },
  kpiStrip: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12, marginBottom: 20,
  },
  kpiCard: {
    background: '#fff', borderRadius: 12, padding: '16px 18px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  kpiValue: {
    fontSize: 22, fontWeight: 700, color: '#1a2a3a',
    fontVariantNumeric: 'tabular-nums',
  },
  kpiLabel: {
    fontSize: 12, color: '#6a7a70', marginTop: 2,
  },
  emptyState: {
    textAlign: 'center', padding: 60, background: '#fff',
    borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
}

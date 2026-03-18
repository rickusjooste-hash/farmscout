'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import OrchardSummaryTable from '@/app/components/intelligence/OrchardSummaryTable'
import OrchardScorecard from '@/app/components/intelligence/OrchardScorecard'
import OrchardComparisonPanel from '@/app/components/intelligence/OrchardComparisonPanel'
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
  id: string; name: string; orchard_nr: number | null; variety: string | null; variety_group: string | null
  rootstock: string | null; ha: number | null; commodity_id: string; year_planted: number | null; farm_id: string
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
  const [comparedIds, setComparedIds] = useState<Set<string>>(new Set())
  const [compareOpen, setCompareOpen] = useState(false)

  // Data lookups
  const [productionByOrchard, setProductionByOrchard] = useState<Record<string, { tonHa: number | null; tons: number; bins: number }>>({})
  const [prevProductionByOrchard, setPrevProductionByOrchard] = useState<Record<string, { tonHa: number | null; tons: number; bins: number }>>({})
  const [sizeByOrchard, setSizeByOrchard] = useState<Record<string, { dominantLabel: string; avgWeightG: number }>>({})
  const [prevSizeByOrchard, setPrevSizeByOrchard] = useState<Record<string, { dominantLabel: string; avgWeightG: number }>>({})
  const [nutrientsByOrchard, setNutrientsByOrchard] = useState<Record<string, Record<string, number>>>({})
  const [normsLookup, setNormsLookup] = useState<Record<string, NormRange>>({})
  const [qcByOrchard, setQcByOrchard] = useState<Record<string, QcIssueRow[]>>({})
  const [fertByOrchard, setFertByOrchard] = useState<Record<string, FertOrchardStatus>>({})
  const [benchmarksByOrchard, setBenchmarksByOrchard] = useState<Record<string, number>>({})


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
      if (farmData?.length && !selectedFarmId) {
        setSelectedFarmId(farmData.length > 1 ? 'all' : farmData[0].id)
      }

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

  // Resolve active farm IDs for queries
  const activeFarmIds = useMemo(() => {
    if (selectedFarmId === 'all') return farms.map(f => f.id)
    if (selectedFarmId) return [selectedFarmId]
    return []
  }, [selectedFarmId, farms])

  // Size + QC — per-orchard queries to avoid qc_fruit full-table scans
  interface SizeDistRow { orchard_id: string; bin_label: string; fruit_count: number; avg_weight_g: number }
  interface IssueCountRow { orchard_id: string; pest_name: string; category: string; total_count: number }

  const fetchHeavyData = useCallback(async (
    orchardIds: string[], farmIds: string[], from: string, to: string, prevFrom: string, prevTo: string,
  ) => {
    // Size data — use get_orchard_size_distribution_bulk per-orchard (works in scorecard)
    // Batch 5 at a time to avoid overwhelming the connection pool
    try {
      const sizeMap: Record<string, { dominantLabel: string; avgWeightG: number }> = {}
      const prevSizeMap: Record<string, { dominantLabel: string; avgWeightG: number }> = {}

      const BATCH = 5
      for (let i = 0; i < orchardIds.length; i += BATCH) {
        const batch = orchardIds.slice(i, i + BATCH)
        const results = await Promise.all(batch.flatMap(oid => [
          supabase.rpc('get_orchard_size_distribution_bulk', {
            p_farm_ids: farmIds, p_from: from, p_to: to, p_orchard_id: oid,
          }).then(res => ({ oid, season: 'cur', data: res.data, error: res.error })),
          supabase.rpc('get_orchard_size_distribution_bulk', {
            p_farm_ids: farmIds, p_from: prevFrom, p_to: prevTo, p_orchard_id: oid,
          }).then(res => ({ oid, season: 'prev', data: res.data, error: res.error })),
        ]))

        for (const { oid, season: s, data } of results) {
          if (!data || data.length === 0) continue
          const rows = data as SizeDistRow[]
          let bestBin = '', bestCount = 0, totalCount = 0, totalWeight = 0
          for (const r of rows) {
            const cnt = Number(r.fruit_count)
            const wt = Number(r.avg_weight_g)
            if (cnt > bestCount) { bestBin = r.bin_label; bestCount = cnt }
            totalCount += cnt
            totalWeight += wt * cnt
          }
          if (totalCount > 0) {
            const entry = { dominantLabel: bestBin, avgWeightG: Math.round(totalWeight / totalCount) }
            if (s === 'cur') sizeMap[oid] = entry
            else prevSizeMap[oid] = entry
          }
        }
      }

      setSizeByOrchard(sizeMap)
      setPrevSizeByOrchard(prevSizeMap)
    } catch {
      console.warn('[Intelligence] Size fetch failed')
    }

    // QC issues — qc_bag_issues is small (165K rows), use original RPC per farm
    try {
      const qcMap: Record<string, QcIssueRow[]> = {}
      await Promise.all(farmIds.map(async (fid) => {
        const issueRes = await supabase.rpc('get_qc_issue_counts', { p_farm_id: fid, p_from: from, p_to: to })
        if (issueRes.error) { console.warn('[Intelligence] QC issues:', fid, issueRes.error.message); return }

        // Fruit counts per orchard — per-orchard via size_distribution_bulk (already fetched above, reuse)
        // For pct, use total fruit from sizeByOrchard (will be set by now or from prev render)
        const byOrchard: Record<string, IssueCountRow[]> = {}
        for (const r of (issueRes.data || []) as IssueCountRow[]) {
          if (!byOrchard[r.orchard_id]) byOrchard[r.orchard_id] = []
          byOrchard[r.orchard_id].push(r)
        }

        // Get fruit counts for this farm's orchards — batch per-orchard
        const farmOrchardIds = orchardIds.filter(oid => {
          // We don't have farm-to-orchard mapping here, so just query all
          return byOrchard[oid] != null
        })
        const fruitCounts: Record<string, number> = {}
        const BATCH = 5
        for (let i = 0; i < farmOrchardIds.length; i += BATCH) {
          const batch = farmOrchardIds.slice(i, i + BATCH)
          const results = await Promise.all(batch.map(oid =>
            supabase.rpc('get_orchard_size_distribution_bulk', {
              p_farm_ids: [fid], p_from: from, p_to: to, p_orchard_id: oid,
            }).then(res => ({ oid, data: res.data }))
          ))
          for (const { oid, data } of results) {
            if (data) {
              fruitCounts[oid] = (data as SizeDistRow[]).reduce((s, r) => s + Number(r.fruit_count), 0)
            }
          }
        }

        for (const [oid, issues] of Object.entries(byOrchard)) {
          const sampled = fruitCounts[oid] || 0
          qcMap[oid] = issues.slice(0, 5).map(r => ({
            orchard_id: oid,
            pest_name: r.pest_name,
            category: r.category,
            total_count: Number(r.total_count),
            fruit_sampled: sampled,
            pct_of_fruit: sampled > 0 ? Math.round(Number(r.total_count) / sampled * 1000) / 10 : 0,
          }))
        }
      }))
      setQcByOrchard(qcMap)
    } catch {
      console.warn('[Intelligence] QC issues fetch failed')
      setQcByOrchard({})
    }
  }, [])

  // Fetch all data when farm/season changes
  const fetchData = useCallback(async () => {
    if (!selectedFarmId || activeFarmIds.length === 0) return
    setLoading(true)
    setSelectedOrchardId(null)
    setComparedIds(new Set())
    setCompareOpen(false)

    const { from, to } = seasonDateRange(season)
    const prev = prevSeason(season)
    const { from: prevFrom, to: prevTo } = seasonDateRange(prev)

    try {
      // Orchards query — single farm or all farms
      const orchardQuery = supabase.from('orchards')
        .select('id, orchard_nr, name, variety, variety_group, rootstock, ha, commodity_id, year_planted, farm_id')
        .eq('is_active', true)
        .eq('status', 'active')
        .order('name')
      if (selectedFarmId !== 'all') orchardQuery.eq('farm_id', selectedFarmId)
      else orchardQuery.in('farm_id', activeFarmIds)

      // Core data — RPCs all accept farm_id arrays
      const [
        { data: orchardData },
        { data: leafData },
        { data: prodData },
        { data: prevProdData },
      ] = await Promise.all([
        orchardQuery,
        supabase.rpc('get_leaf_analysis_summary', {
          p_farm_ids: activeFarmIds,
          p_season: season,
        }),
        supabase.rpc('get_production_summary', {
          p_farm_ids: activeFarmIds,
          p_season: season,
        }),
        supabase.rpc('get_production_summary', {
          p_farm_ids: activeFarmIds,
          p_season: prev,
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

      // Leaf nutrients per orchard
      const nutMap: Record<string, Record<string, number>> = {}
      for (const r of (leafData || []) as LeafRow[]) {
        if (!nutMap[r.orchard_id]) nutMap[r.orchard_id] = {}
        nutMap[r.orchard_id][r.nutrient_code] = r.value
      }
      setNutrientsByOrchard(nutMap)

      // Heavy QC queries (size + issues) — per-orchard to avoid qc_fruit timeout
      const oids = (orchardData || []).map((o: Orchard) => o.id)
      fetchHeavyData(oids, activeFarmIds, from, to, prevFrom, prevTo)

      // Fert data — API takes single farm_id, so fetch per farm and merge
      try {
        const fertMap: Record<string, FertOrchardStatus> = {}
        const productNutrients: Record<string, { n_pct: number; p_pct: number; k_pct: number }> = {}

        await Promise.all(activeFarmIds.map(async (fid) => {
          const [fertRes, fertSummaryRes] = await Promise.all([
            fetch(`/api/fertilizer/confirm?farm_id=${fid}&season=${encodeURIComponent(season)}`),
            fetch(`/api/fertilizer?farm_id=${fid}&season=${encodeURIComponent(season)}`),
          ])
          if (!fertRes.ok) return
          const fertData = await fertRes.json() as FertLine[]
          const fertSummary = fertSummaryRes.ok ? await fertSummaryRes.json() as FertSummaryLine[] : []
          for (const fs of fertSummary) {
            if (!productNutrients[fs.product_name]) {
              productNutrients[fs.product_name] = { n_pct: fs.n_pct || 0, p_pct: fs.p_pct || 0, k_pct: fs.k_pct || 0 }
            }
          }
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
        }))
        setFertByOrchard(fertMap)
      } catch { setFertByOrchard({}) }

      // Benchmarks
      try {
        const benchRes = await fetch(`/api/benchmarks?farm_ids=${activeFarmIds.join(',')}&season=${encodeURIComponent(season)}`)
        if (benchRes.ok) {
          const benchData = await benchRes.json() as { orchard_id: string; org_target: number | null; industry_target: number | null }[]
          const bMap: Record<string, number> = {}
          for (const r of benchData) {
            const target = r.org_target ?? r.industry_target
            if (target != null) bMap[r.orchard_id] = target
          }
          setBenchmarksByOrchard(bMap)
        }
      } catch { setBenchmarksByOrchard({}) }

    } catch {
      setOrchards([])
    } finally {
      setLoading(false)
    }
  }, [selectedFarmId, season, activeFarmIds])

  useEffect(() => {
    if (selectedFarmId) fetchData()
  }, [fetchData, selectedFarmId])

  // Commodity code lookup
  const commodityCodeById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of commodities) map[c.id] = c.code
    return map
  }, [commodities])

  // Farm code lookup (for multi-farm "All" view)
  const farmCodeById = useMemo(() => {
    if (selectedFarmId !== 'all') return undefined
    const map: Record<string, string> = {}
    for (const f of farms) map[f.id] = f.code || f.full_name
    return map
  }, [selectedFarmId, farms])

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

  // Variety group avg T/Ha — orchards are benchmarked against their own variety group
  const varietyGroupAvgTonHa = useMemo(() => {
    const grouped: Record<string, number[]> = {}
    for (const o of orchards) {
      const key = (o.variety_group || o.variety || '__none__').toLowerCase()
      const tonHa = productionByOrchard[o.id]?.tonHa
      if (tonHa != null) {
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(tonHa)
      }
    }
    const avgs: Record<string, number> = {}
    for (const [key, vals] of Object.entries(grouped)) {
      avgs[key] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    return avgs
  }, [orchards, productionByOrchard])

  // Helper: get the avg T/Ha for an orchard's variety group
  function getGroupAvgTonHa(o: Orchard): number | null {
    const key = (o.variety_group || o.variety || '__none__').toLowerCase()
    return varietyGroupAvgTonHa[key] ?? null
  }

  // Overall farm avg (for KPI display only)
  const farmAvgTonHa = useMemo(() => {
    const vals = Object.values(productionByOrchard).map(p => p.tonHa).filter((v): v is number => v != null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }, [productionByOrchard])

  // Compute scores — each orchard benchmarked against its variety group avg
  const scoredOrchards = useMemo(() => {
    return orchards.map(o => {
      const nuts = nutrientsByOrchard[o.id] || {}
      const norms = normsByOrchard[o.id] || {}
      const prod = productionByOrchard[o.id]
      const qcIssues = qcByOrchard[o.id] || []
      const fert = fertByOrchard[o.id]
      const size = sizeByOrchard[o.id]

      const totalIssueRate = qcIssues.length > 0
        ? qcIssues.reduce((sum, q) => sum + q.pct_of_fruit, 0)
        : null

      let pctUpperBins: number | null = null

      const score = calculateScore({
        tonHa: prod?.tonHa ?? null,
        farmAvgTonHa: getGroupAvgTonHa(o),
        benchmarkTarget: benchmarksByOrchard[o.id] ?? null,
        leafNutrients: nuts,
        norms,
        issueRate: totalIssueRate,
        fertConfirmedPct: fert ? (fert.total > 0 ? (fert.confirmed / fert.total) * 100 : null) : null,
        dominantSizeBin: size?.dominantLabel ?? null,
        pctUpperBins,
      })

      return { ...o, score }
    })
  }, [orchards, nutrientsByOrchard, normsByOrchard, productionByOrchard, qcByOrchard, fertByOrchard, sizeByOrchard, varietyGroupAvgTonHa, benchmarksByOrchard])

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
    <div style={{ display: 'flex', height: '100vh', background: '#eae6df', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={st.main}>
        {/* Header */}
        <div style={st.headerRow}>
          <div>
            <h1 style={st.pageTitle}>Orchard Intelligence</h1>
            <p style={st.subtitle}>
              Cross-stream performance analysis: Input {'\u2192'} Uptake {'\u2192'} Output {'\u2192'} Value {'\u2192'} Quality
              {' \u00B7 '}
              <a href="/orchards/intelligence/rules" style={{ color: '#2176d9', textDecoration: 'none', fontWeight: 500 }}>
                View Rules
              </a>
            </p>
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
            {farms.length > 1 && (
              <button
                onClick={() => setSelectedFarmId('all')}
                style={{ ...st.pill, ...(selectedFarmId === 'all' ? st.pillActive : {}) }}
              >
                All Farms
              </button>
            )}
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
          selectedOrchardId={selectedOrchardId}
          onSelectOrchard={id => setSelectedOrchardId(prev => prev === id ? null : id)}
          loading={loading}
          comparedIds={comparedIds}
          onToggleCompare={(id: string) => {
            setComparedIds(prev => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else if (next.size < 4) next.add(id)
              return next
            })
          }}
          maxCompareReached={comparedIds.size >= 4}
          onOpenCompare={() => { setCompareOpen(true); setSelectedOrchardId(null) }}
          onClearCompare={() => { setComparedIds(new Set()); setCompareOpen(false) }}
          farmCodeById={farmCodeById}
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

      {/* Comparison panel slide-in */}
      {compareOpen && comparedIds.size >= 2 && (
        <OrchardComparisonPanel
          orchardIds={[...comparedIds]}
          orchards={scoredOrchards}
          fertByOrchard={fertByOrchard}
          productionByOrchard={productionByOrchard}
          prevProductionByOrchard={prevProductionByOrchard}
          sizeByOrchard={sizeByOrchard}
          qcByOrchard={qcByOrchard}
          nutrientsByOrchard={nutrientsByOrchard}
          normsByOrchard={normsByOrchard}
          varietyGroupAvgTonHa={varietyGroupAvgTonHa}
          open={true}
          onClose={() => setCompareOpen(false)}
          onRemoveOrchard={(id: string) => {
            setComparedIds(prev => {
              const next = new Set(prev)
              next.delete(id)
              if (next.size < 2) setCompareOpen(false)
              return next
            })
          }}
        />
      )}

      {/* Scorecard slide-in */}
      {!compareOpen && selectedOrchardId && selectedOrchard && (
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
          farmIds={activeFarmIds}
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
          farmAvgTonHa={selectedOrchard ? getGroupAvgTonHa(selectedOrchard) : null}
          pctSmallBins={null}
          pctLargeBins={null}
        />
      )}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  main: {
    flex: 1, padding: '32px 40px', overflowY: 'auto',
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

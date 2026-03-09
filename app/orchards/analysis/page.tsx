'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import OrchardRankingTable from '@/app/components/analysis/OrchardRankingTable'
import PerformanceComparison from '@/app/components/analysis/PerformanceComparison'
import VarietyTreemap from '@/app/components/analysis/VarietyTreemap'
import SeasonTrendChart from '@/app/components/analysis/SeasonTrendChart'
import BlockDetailPanel from '@/app/components/analysis/BlockDetailPanel'
import OrchardAgeAnalysis from '@/app/components/analysis/OrchardAgeAnalysis'

const AnalysisMap = dynamic(() => import('@/app/components/analysis/AnalysisMap'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; name: string }
interface Commodity { id: string; name: string; code: string }
interface OrchardRaw {
  id: string; name: string; variety: string | null; variety_group: string | null;
  rootstock: string | null; ha: number | null; year_planted: number | null;
  nr_of_trees: number | null; commodity_id: string; farm_id: string;
  commodities: { name: string; code: string } | null;
}
interface ProductionRow {
  orchard_id: string; orchard_name: string; variety: string;
  ha: number; bins: number; juice: number; total: number;
  bin_weight_kg: number; tons: number; ton_ha: number | null;
}
interface BruisingRow {
  orchard_id: string; avg_bruising_pct: number | null;
}

export interface OrchardAnalysis {
  id: string; name: string;
  variety: string | null; varietyGroup: string | null;
  rootstock: string | null; commodityId: string; commodityName: string;
  farmId: string; farmCode: string;
  ha: number | null; yearPlanted: number | null; nrOfTrees: number | null;
  bins: number; juice: number; total: number; tons: number; tonHa: number | null;
  bruisingPct: number | null;
  pestStatus: 'green' | 'yellow' | 'red' | 'blue' | 'grey';
  pestCount: number;
}

type ColorMode = 'commodity' | 'variety' | 'tonha' | 'pest'

// ── Helpers ────────────────────────────────────────────────────────────────

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  return `${mo < 8 ? yr - 1 : yr}/${String(mo < 8 ? yr : yr + 1).slice(-2)}`
}

function buildSeasonOptions(fromYear: number): string[] {
  const currentStartYr = parseInt(getCurrentSeason().split('/')[0])
  const seasons: string[] = []
  for (let yr = fromYear; yr <= currentStartYr; yr++) seasons.push(`${yr}/${String(yr + 1).slice(-2)}`)
  return seasons.reverse()
}

function previousSeason(s: string): string {
  const startYr = parseInt(s.split('/')[0])
  return `${startYr - 1}/${String(startYr).slice(-2)}`
}

function currentISOWeek(): number {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function isoWeekRange(): { from: Date; to: Date } {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const dow = jan4.getUTCDay() || 7
  const weekStart = new Date(jan4.getTime() - (dow - 1) * 86400000 + (week - 1) * 7 * 86400000)
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000)
  weekEnd.setUTCHours(23, 59, 59, 999)
  return { from: weekStart, to: weekEnd }
}

const PALETTE = [
  '#2a6e45', '#e8924a', '#6b7fa8', '#e8c44a', '#9b6bb5',
  '#c4744a', '#4a9e6b', '#e85a4a', '#3498db', '#1abc9c',
]

// ── Styles ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:        { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1c3a2a' },
  main:        { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, paddingBottom: 100 },
  pageHeader:  { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  pageTitle:   { fontSize: 32, fontWeight: 700, color: '#1c3a2a', letterSpacing: '-0.5px', lineHeight: 1 },
  pageSub:     { fontSize: 14, color: '#9aaa9f', marginTop: 6 },
  controls:    { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 28 },
  filterGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  pill:        { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:  { padding: '6px 14px', borderRadius: 20, border: '1px solid #2a6e45', background: '#2a6e45', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  select:      { padding: '6px 12px', borderRadius: 8, border: '1px solid #d4cfca', background: '#fff', fontSize: 13, fontFamily: 'inherit', color: '#1c3a2a', cursor: 'pointer' },
  divider:     { width: 1, height: 24, background: '#d4cfca' },
  kpiStrip:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 28 },
  kpiCard:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative' as const, overflow: 'hidden' },
  kpiAccent:   { position: 'absolute' as const, top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2a6e45, #a8d5a2)' },
  kpiLabel:    { fontSize: 12, color: '#9aaa9f', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  kpiValue:    { fontSize: 28, fontWeight: 700, color: '#1c3a2a', lineHeight: 1 },
  kpiSub:      { fontSize: 12, color: '#9aaa9f', marginTop: 6 },
  card:        { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader:  { padding: '20px 24px 16px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 },
  cardTitle:   { fontSize: 17, fontWeight: 600, color: '#1c3a2a' },
  cardBody:    { padding: '20px 24px' },
  loading:     { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#9aaa9f', fontSize: 14 },
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function OrchardAnalysisPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, orgId } = useUserContext()
  const modules = useOrgModules()
  const hasProduction = modules.includes('production')

  // Filter state
  const [allFarms, setAllFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [selectedCommodityId, setSelectedCommodityId] = useState<string | null>(null)
  const [season, setSeason] = useState(getCurrentSeason())
  const seasons = useMemo(() => buildSeasonOptions(2020), [])

  // Raw data
  const [orchardRaw, setOrchardRaw] = useState<OrchardRaw[]>([])
  const [production, setProduction] = useState<ProductionRow[]>([])
  const [prevProduction, setPrevProduction] = useState<ProductionRow[]>([])
  const [historicalProduction, setHistoricalProduction] = useState<Record<string, ProductionRow[]>>({})
  const [bruising, setBruising] = useState<BruisingRow[]>([])
  const [boundaries, setBoundaries] = useState<any[]>([])
  const [pestPressure, setPestPressure] = useState<Record<string, { status: string; count: number }>>({})
  const [weeklyBins, setWeeklyBins] = useState<Record<string, number[]>>({})
  const [weeklyByCommodity, setWeeklyByCommodity] = useState<Array<Record<string, number | string>>>([])
  const [weekCommodities, setWeekCommodities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [colorMode, setColorMode] = useState<ColorMode>('commodity')
  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null)
  const [selectedAgeBand, setSelectedAgeBand] = useState<string | null>(null)
  const [showMobileMap, setShowMobileMap] = useState(false)

  const effectiveFarmIds = useMemo(() => {
    if (selectedFarmId) return [selectedFarmId]
    return allFarms.map(f => f.id)
  }, [allFarms, selectedFarmId])

  // ── Load farms + commodities ────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded) return
    async function init() {
      const farmQ = supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('full_name')
      const { data: farmsData } = isSuperAdmin ? await farmQ : await farmQ.in('id', farmIds)
      setAllFarms((farmsData || []).map((f: any) => ({ id: f.id, code: f.code, name: f.full_name })))
      const { data: commData } = await supabase.from('commodities').select('id, name, code').order('name')
      setCommodities((commData || []) as Commodity[])
    }
    init()
  }, [contextLoaded])

  // ── Load main data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded || effectiveFarmIds.length === 0) return
    async function fetchData() {
      setLoading(true)
      try {
        // Build 5 seasons for historical comparison
        const histSeasons: string[] = [season]
        for (let i = 0; i < 4; i++) histSeasons.push(previousSeason(histSeasons[histSeasons.length - 1]))
        const prevSeason = histSeasons[1]

        const [orchRes, boundRes, bruRes, weekRes, ...histProdResults] = await Promise.all([
          supabase.from('orchards')
            .select('id, name, variety, variety_group, rootstock, ha, year_planted, nr_of_trees, commodity_id, farm_id, commodities(name, code)')
            .in('farm_id', effectiveFarmIds)
            .eq('is_active', true),
          supabase.rpc('get_orchard_boundaries'),
          hasProduction
            ? supabase.rpc('get_production_bruising_summary', { p_farm_ids: effectiveFarmIds, p_season: season })
            : Promise.resolve({ data: [] }),
          hasProduction
            ? supabase.from('production_bins')
                .select('orchard_id, week_num, total, farm_id')
                .in('farm_id', effectiveFarmIds)
                .eq('season', season)
                .not('week_num', 'is', null)
                .order('week_num')
            : Promise.resolve({ data: [] }),
          // Fetch all 5 seasons of production data in parallel
          ...histSeasons.map(s =>
            hasProduction
              ? supabase.rpc('get_production_summary', { p_farm_ids: effectiveFarmIds, p_season: s })
              : Promise.resolve({ data: [] })
          ),
        ])

        const rawOrchards = (orchRes.data || []) as unknown as OrchardRaw[]
        setOrchardRaw(rawOrchards)
        // Filter boundaries to user's orchards
        const orchardIds = new Set(rawOrchards.map(o => o.id))
        setBoundaries((boundRes.data || []).filter((b: any) => orchardIds.has(b.id)))
        const histProdMap: Record<string, ProductionRow[]> = {}
        histSeasons.forEach((s, i) => {
          histProdMap[s] = ((histProdResults[i] as any)?.data || []) as ProductionRow[]
        })
        setProduction(histProdMap[season] || [])
        setPrevProduction(histProdMap[prevSeason] || [])
        setHistoricalProduction(histProdMap)
        setBruising((bruRes.data || []) as BruisingRow[])

        // Group weekly bins by orchard (for sparklines)
        const wkMap: Record<string, number[]> = {}
        const weekData = (weekRes.data || []) as any[]
        weekData.forEach((r: any) => {
          if (!r.orchard_id) return
          if (!wkMap[r.orchard_id]) wkMap[r.orchard_id] = []
          const idx = r.week_num - 1
          while (wkMap[r.orchard_id].length <= idx) wkMap[r.orchard_id].push(0)
          wkMap[r.orchard_id][idx] += Number(r.total)
        })
        setWeeklyBins(wkMap)

        // Build weekly commodity trend data
        const orchardCommMap: Record<string, string> = {}
        rawOrchards.forEach(o => { orchardCommMap[o.id] = o.commodities?.name || 'Unknown' })
        const weekComm: Record<number, Record<string, number>> = {}
        const commSet = new Set<string>()
        weekData.forEach((r: any) => {
          const comm = orchardCommMap[r.orchard_id] || 'Unknown'
          commSet.add(comm)
          if (!weekComm[r.week_num]) weekComm[r.week_num] = {}
          weekComm[r.week_num][comm] = (weekComm[r.week_num][comm] || 0) + Number(r.total)
        })
        const comms = [...commSet].sort()
        setWeekCommodities(comms)
        const sortedWeeks = Object.keys(weekComm).map(Number).sort((a, b) => a - b)
        setWeeklyByCommodity(sortedWeeks.map(wk => {
          const row: Record<string, number | string> = { week: `W${wk}` }
          comms.forEach(c => { row[c] = weekComm[wk][c] || 0 })
          return row
        }))

        // Load pest pressure
        await loadPestPressure(rawOrchards)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [contextLoaded, effectiveFarmIds, season])

  // ── Load pest pressure (current week) ───────────────────────────────────
  const loadPestPressure = useCallback(async (orcList: OrchardRaw[]) => {
    const orchardIds = orcList.map(o => o.id)
    if (orchardIds.length === 0) { setPestPressure({}); return }

    const { from, to } = isoWeekRange()
    const { data: inspections } = await supabase
      .from('trap_inspections')
      .select('id, orchard_id, trap_id')
      .gte('inspected_at', from.toISOString())
      .lte('inspected_at', to.toISOString())
      .in('orchard_id', orchardIds.slice(0, 500))

    if (!inspections?.length) { setPestPressure({}); return }

    const inspectionIds = inspections.map(i => i.id)
    const [{ data: counts }, { data: thresholds }] = await Promise.all([
      supabase.from('trap_counts').select('inspection_id, count').in('inspection_id', inspectionIds.slice(0, 500)),
      supabase.from('trap_thresholds').select('threshold, commodity_id, pest_id'),
    ])

    const countByInsp: Record<string, number> = {}
    counts?.forEach((c: any) => { countByInsp[c.inspection_id] = (countByInsp[c.inspection_id] || 0) + c.count })

    const orchardPest: Record<string, number> = {}
    inspections.forEach(i => {
      orchardPest[i.orchard_id] = (orchardPest[i.orchard_id] || 0) + (countByInsp[i.id] || 0)
    })

    const orchardMap: Record<string, OrchardRaw> = {}
    orcList.forEach(o => { orchardMap[o.id] = o })

    const result: Record<string, { status: string; count: number }> = {}
    Object.entries(orchardPest).forEach(([oid, total]) => {
      const o = orchardMap[oid]
      const threshold = thresholds?.find(t => !t.commodity_id || t.commodity_id === o?.commodity_id)?.threshold ?? null
      let status = 'grey'
      if (threshold === null) status = 'blue'
      else if (total >= threshold) status = 'red'
      else if (total >= threshold * 0.5) status = 'yellow'
      else status = 'green'
      result[oid] = { status, count: total }
    })
    setPestPressure(result)
  }, [supabase])

  // ── Assemble OrchardAnalysis[] ──────────────────────────────────────────
  const orchardAnalysis = useMemo<OrchardAnalysis[]>(() => {
    const prodMap: Record<string, ProductionRow> = {}
    production.forEach(p => { if (p.orchard_id) prodMap[p.orchard_id] = p })
    const bruMap: Record<string, BruisingRow> = {}
    bruising.forEach(b => { if (b.orchard_id) bruMap[b.orchard_id] = b })
    const farmMap: Record<string, Farm> = {}
    allFarms.forEach(f => { farmMap[f.id] = f })

    return orchardRaw
      .filter(o => !selectedCommodityId || o.commodity_id === selectedCommodityId)
      .filter(o => !selectedVariety || (o.variety || 'Unknown') === selectedVariety)
      .filter(o => {
        if (!selectedAgeBand) return true
        if (o.year_planted == null) return false
        const age = new Date().getFullYear() - o.year_planted
        const bands: Record<string, [number, number]> = {
          establishing: [0, 4], young: [5, 10], prime: [11, 20], mature: [21, 30], aging: [31, 999],
        }
        const [min, max] = bands[selectedAgeBand] || [0, 999]
        return age >= min && age <= max
      })
      .map(o => {
        const prod = prodMap[o.id]
        const bru = bruMap[o.id]
        const pest = pestPressure[o.id]
        const farm = farmMap[o.farm_id]
        return {
          id: o.id, name: o.name,
          variety: o.variety, varietyGroup: o.variety_group,
          rootstock: o.rootstock,
          commodityId: o.commodity_id,
          commodityName: o.commodities?.name || 'Unknown',
          farmId: o.farm_id, farmCode: farm?.code || '',
          ha: o.ha, yearPlanted: o.year_planted, nrOfTrees: o.nr_of_trees,
          bins: prod?.bins || 0, juice: prod?.juice || 0,
          total: prod?.total || 0, tons: prod?.tons || 0,
          tonHa: prod?.ton_ha ?? null,
          bruisingPct: bru?.avg_bruising_pct ?? null,
          pestStatus: (pest?.status || 'grey') as OrchardAnalysis['pestStatus'],
          pestCount: pest?.count || 0,
        }
      })
  }, [orchardRaw, production, bruising, pestPressure, selectedCommodityId, selectedVariety, selectedAgeBand, allFarms])

  // ── Color maps ──────────────────────────────────────────────────────────
  const commodityColors = useMemo(() => {
    const map: Record<string, string> = {}
    commodities.forEach((c, i) => { map[c.id] = PALETTE[i % PALETTE.length] })
    return map
  }, [commodities])

  const commodityNameColors = useMemo(() => {
    const map: Record<string, string> = {}
    commodities.forEach((c, i) => { map[c.name] = PALETTE[i % PALETTE.length] })
    return map
  }, [commodities])

  const varietyColors = useMemo(() => {
    const map: Record<string, string> = {}
    const varieties = [...new Set(orchardAnalysis.map(o => o.variety || 'Unknown'))].sort()
    varieties.forEach((v, i) => { map[v] = PALETTE[i % PALETTE.length] })
    return map
  }, [orchardAnalysis])

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalHa = orchardAnalysis.reduce((s, o) => s + (o.ha || 0), 0)
    const totalTons = orchardAnalysis.reduce((s, o) => s + o.tons, 0)
    const totalBins = orchardAnalysis.reduce((s, o) => s + o.bins, 0)
    const avgTonHa = totalHa > 0 ? totalTons / totalHa : null
    const varieties = new Set(orchardAnalysis.map(o => o.variety).filter(Boolean))
    const best = orchardAnalysis.filter(o => o.tonHa != null).sort((a, b) => (b.tonHa || 0) - (a.tonHa || 0))[0]

    // YoY comparison
    const prevProdMap: Record<string, ProductionRow> = {}
    prevProduction.forEach(p => { if (p.orchard_id) prevProdMap[p.orchard_id] = p })
    const prevTotalTons = orchardAnalysis.reduce((s, o) => s + (prevProdMap[o.id]?.tons || 0), 0)
    const prevAvgTonHa = totalHa > 0 && prevTotalTons > 0 ? prevTotalTons / totalHa : null

    return {
      totalHa: Math.round(totalHa * 10) / 10,
      totalTons: Math.round(totalTons * 10) / 10,
      totalBins: Math.round(totalBins),
      avgTonHa: avgTonHa != null ? Math.round(avgTonHa * 10) / 10 : null,
      varietyCount: varieties.size,
      orchardCount: orchardAnalysis.length,
      bestBlock: best?.name || '—',
      bestTonHa: best?.tonHa != null ? Math.round(best.tonHa * 10) / 10 : null,
      prevTotalTons: prevTotalTons > 0 ? Math.round(prevTotalTons * 10) / 10 : null,
      prevAvgTonHa,
      yoyPct: prevTotalTons > 0 && totalTons > 0
        ? Math.round((totalTons - prevTotalTons) / prevTotalTons * 1000) / 10
        : null,
    }
  }, [orchardAnalysis, prevProduction])

  // ── Treemap data (unfiltered by variety so all remain clickable) ────────
  const allOrchardsForTreemap = useMemo<OrchardAnalysis[]>(() => {
    const prodMap: Record<string, ProductionRow> = {}
    production.forEach(p => { if (p.orchard_id) prodMap[p.orchard_id] = p })
    const farmMap: Record<string, Farm> = {}
    allFarms.forEach(f => { farmMap[f.id] = f })
    return orchardRaw
      .filter(o => !selectedCommodityId || o.commodity_id === selectedCommodityId)
      .map(o => ({
        id: o.id, name: o.name, variety: o.variety, varietyGroup: o.variety_group,
        rootstock: o.rootstock, commodityId: o.commodity_id,
        commodityName: o.commodities?.name || 'Unknown',
        farmId: o.farm_id, farmCode: farmMap[o.farm_id]?.code || '',
        ha: o.ha, yearPlanted: o.year_planted, nrOfTrees: o.nr_of_trees,
        bins: prodMap[o.id]?.bins || 0, juice: prodMap[o.id]?.juice || 0,
        total: prodMap[o.id]?.total || 0, tons: prodMap[o.id]?.tons || 0,
        tonHa: prodMap[o.id]?.ton_ha ?? null,
        bruisingPct: null, pestStatus: 'grey' as const, pestCount: 0,
      }))
  }, [orchardRaw, production, selectedCommodityId, allFarms])

  const treemapItems = useMemo(() => {
    const groups: Record<string, { commodity: string; ha: number }> = {}
    allOrchardsForTreemap.forEach(o => {
      const key = o.variety || 'Unknown'
      if (!groups[key]) groups[key] = { commodity: o.commodityName, ha: 0 }
      groups[key].ha += o.ha || 0
    })
    return Object.entries(groups)
      .filter(([, v]) => v.ha > 0)
      .map(([variety, v]) => ({
        label: variety,
        sublabel: `${v.ha.toFixed(1)} ha`,
        value: v.ha,
        color: commodityNameColors[v.commodity] || '#aaa',
      }))
      .sort((a, b) => b.value - a.value)
  }, [allOrchardsForTreemap, commodityNameColors])

  // ── Detail panel data ───────────────────────────────────────────────────
  const selectedOrchard = orchardAnalysis.find(o => o.id === selectedOrchardId) || null
  const prevProdForSelected = useMemo(() => {
    if (!selectedOrchardId) return { tons: null, tonHa: null }
    const prev = prevProduction.find(p => p.orchard_id === selectedOrchardId)
    return { tons: prev?.tons ?? null, tonHa: prev?.ton_ha ?? null }
  }, [selectedOrchardId, prevProduction])

  // ── Historical band medians for age analysis ────────────────────────────
  const AGE_BAND_RANGES: Record<string, [number, number]> = {
    establishing: [0, 4], young: [5, 10], prime: [11, 20], mature: [21, 30], aging: [31, 999],
  }

  const historicalBandMedians = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const orchards = orchardRaw.filter(o => o.year_planted != null)
    const result: { season: string; bands: Record<string, number> }[] = []

    // Sort seasons chronologically
    const sortedSeasons = Object.keys(historicalProduction).sort((a, b) => {
      const aYear = parseInt(a.split('/')[0])
      const bYear = parseInt(b.split('/')[0])
      return aYear - bYear
    })

    for (const s of sortedSeasons) {
      const prod = historicalProduction[s] || []
      const prodMap: Record<string, ProductionRow> = {}
      prod.forEach(p => { if (p.orchard_id) prodMap[p.orchard_id] = p })

      const bands: Record<string, number> = {}

      for (const [bandKey, [min, max]] of Object.entries(AGE_BAND_RANGES)) {
        // Adjust age based on season year (not current year)
        const seasonStartYear = parseInt(s.split('/')[0])
        const tonHaValues = orchards
          .filter(o => {
            const age = seasonStartYear - o.year_planted!
            return age >= min && age <= max
          })
          .map(o => prodMap[o.id]?.ton_ha)
          .filter((v): v is number => v != null && v > 0)
          .sort((a, b) => a - b)

        if (tonHaValues.length > 0) {
          const mid = Math.floor(tonHaValues.length / 2)
          bands[bandKey] = tonHaValues.length % 2
            ? tonHaValues[mid]
            : (tonHaValues[mid - 1] + tonHaValues[mid]) / 2
        }
      }

      result.push({ season: s, bands })
    }
    return result
  }, [orchardRaw, historicalProduction])

  // KPI delta helper
  function yoyArrow(current: number | null, prev: number | null): string {
    if (current == null || prev == null || prev === 0) return ''
    const pct = ((current - prev) / prev) * 100
    return pct > 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`
  }
  function yoyColor(current: number | null, prev: number | null): string {
    if (current == null || prev == null) return '#9aaa9f'
    return current >= prev ? '#4caf72' : '#e85a4a'
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const colorModeBtn = (mode: ColorMode, label: string) => (
    <button
      onClick={() => setColorMode(mode)}
      style={{
        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
        border: `1.5px solid ${colorMode === mode ? '#1c3a2a' : '#e0ddd6'}`,
        background: colorMode === mode ? '#1c3a2a' : '#fff',
        color: colorMode === mode ? '#a8d5a2' : '#6a7a70',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
      }}
    >{label}</button>
  )

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        @media (max-width: 768px) {
          .oa-main { padding: 16px !important; padding-bottom: 80px !important; }
          .oa-page-header { flex-direction: column !important; align-items: flex-start !important; }
          .oa-page-title { font-size: 24px !important; }
          .oa-kpi-strip { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .oa-map-table-body { flex-direction: column !important; height: auto !important; }
          .oa-map-pane { flex: none !important; width: 100% !important; height: 50vh !important; }
          .oa-map-pane.oa-map-hidden { display: none !important; }
          .oa-table-pane { flex: none !important; width: 100% !important; max-height: 350px !important; border-left: none !important; border-top: 1px solid #e8e4dc !important; }
          .oa-map-toggle { display: flex !important; }
          .oa-two-col { grid-template-columns: 1fr !important; }
          .oa-controls { gap: 8px !important; margin-bottom: 16px !important; }
        }
        .oa-map-toggle { display: none; }
        @keyframes oa-shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
      `}</style>

      <div style={s.page}>
        <ManagerSidebar modules={modules} isSuperAdmin={isSuperAdmin} />
        <main className="oa-main" style={s.main}>

          {/* Page header */}
          <div className="oa-page-header" style={s.pageHeader}>
            <div>
              <div className="oa-page-title" style={s.pageTitle}>Orchard Analysis</div>
              <div style={s.pageSub}>
                {orchardAnalysis.length} orchards across {allFarms.length} farm{allFarms.length !== 1 ? 's' : ''}
                {selectedVariety && <span style={{ color: '#2a6e45', fontWeight: 600 }}> · {selectedVariety}</span>}
              </div>
            </div>
            <select value={season} onChange={e => setSeason(e.target.value)} style={s.select}>
              {seasons.map(ss => <option key={ss} value={ss}>{ss}</option>)}
            </select>
          </div>

          {/* Filter pills */}
          <div className="oa-controls" style={s.controls}>
            <div style={s.filterGroup}>
              <button onClick={() => setSelectedFarmId(null)} style={selectedFarmId === null ? s.pillActive : s.pill}>All Farms</button>
              {allFarms.map(f => (
                <button key={f.id} onClick={() => setSelectedFarmId(f.id)} style={selectedFarmId === f.id ? s.pillActive : s.pill}>{f.code || f.name}</button>
              ))}
            </div>
            <div style={s.divider} />
            <div style={s.filterGroup}>
              <button onClick={() => { setSelectedCommodityId(null); setSelectedVariety(null) }} style={selectedCommodityId === null ? s.pillActive : s.pill}>All</button>
              {commodities.map(c => (
                <button key={c.id} onClick={() => { setSelectedCommodityId(c.id); setSelectedVariety(null) }} style={selectedCommodityId === c.id ? s.pillActive : s.pill}>{c.name}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={s.loading}>Loading analysis data...</div>
          ) : (
            <>
              {/* KPI strip */}
              <div className="oa-kpi-strip" style={s.kpiStrip}>
                <div style={s.kpiCard}>
                  <div style={s.kpiAccent} />
                  <div style={s.kpiLabel}>Total Area</div>
                  <div style={s.kpiValue}>{kpis.totalHa.toLocaleString('en-ZA')}</div>
                  <div style={s.kpiSub}>hectares · {kpis.orchardCount} blocks</div>
                </div>
                <div style={s.kpiCard}>
                  <div style={s.kpiAccent} />
                  <div style={s.kpiLabel}>Varieties</div>
                  <div style={s.kpiValue}>{kpis.varietyCount}</div>
                  <div style={s.kpiSub}>unique varieties planted</div>
                </div>
                {hasProduction && (
                  <>
                    <div style={s.kpiCard}>
                      <div style={s.kpiAccent} />
                      <div style={s.kpiLabel}>Season Tons</div>
                      <div style={s.kpiValue}>{kpis.totalTons.toLocaleString('en-ZA')}</div>
                      <div style={{ ...s.kpiSub, color: yoyColor(kpis.totalTons, kpis.prevTotalTons) }}>
                        {kpis.yoyPct != null ? `${kpis.yoyPct > 0 ? '+' : ''}${kpis.yoyPct}% vs prev season` : `${kpis.totalBins.toLocaleString('en-ZA')} bins`}
                      </div>
                    </div>
                    <div style={s.kpiCard}>
                      <div style={s.kpiAccent} />
                      <div style={s.kpiLabel}>Avg T/Ha</div>
                      <div style={s.kpiValue}>{kpis.avgTonHa != null ? kpis.avgTonHa.toLocaleString('en-ZA') : '—'}</div>
                      <div style={{ ...s.kpiSub, color: yoyColor(kpis.avgTonHa, kpis.prevAvgTonHa) }}>
                        {kpis.prevAvgTonHa != null ? `${yoyArrow(kpis.avgTonHa, kpis.prevAvgTonHa)} vs prev` : 'weighted average'}
                      </div>
                    </div>
                    <div style={s.kpiCard}>
                      <div style={s.kpiAccent} />
                      <div style={s.kpiLabel}>Best Block</div>
                      <div style={{ ...s.kpiValue, fontSize: 20 }}>{kpis.bestBlock}</div>
                      <div style={s.kpiSub}>{kpis.bestTonHa != null ? `${kpis.bestTonHa} t/ha` : ''}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Map + Ranking Table card */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitle}>Block Map</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                    {colorModeBtn('commodity', 'Commodity')}
                    {colorModeBtn('variety', 'Variety')}
                    {hasProduction && colorModeBtn('tonha', 'Ton/Ha')}
                    {colorModeBtn('pest', 'Pest Status')}
                  </div>
                </div>

                {/* Mobile map toggle */}
                <button
                  className="oa-map-toggle"
                  onClick={() => setShowMobileMap(v => !v)}
                  style={{
                    width: '100%', padding: '12px 16px', background: '#f9f7f3',
                    border: 'none', borderBottom: '1px solid #e8e4dc',
                    fontSize: 13, fontWeight: 500, color: '#2a6e45', cursor: 'pointer',
                    alignItems: 'center', justifyContent: 'center', gap: 6,
                  } as React.CSSProperties}
                >
                  {showMobileMap ? 'Hide Map \u25B2' : 'Show Map \u25BC'}
                </button>

                <div className="oa-map-table-body" style={{ display: 'flex', height: 480 }}>
                  <div className={`oa-map-pane${!showMobileMap ? ' oa-map-hidden' : ''}`} style={{ flex: '0 0 60%', position: 'relative' }}>
                    <AnalysisMap
                      orchards={orchardAnalysis.map(o => ({
                        id: o.id, name: o.name, commodityId: o.commodityId,
                        variety: o.variety, tonHa: o.tonHa, pestStatus: o.pestStatus,
                      }))}
                      boundaries={boundaries}
                      colorMode={colorMode}
                      commodityColors={commodityColors}
                      varietyColors={varietyColors}
                      selectedOrchardId={selectedOrchardId}
                      onOrchardSelect={setSelectedOrchardId}
                    />
                  </div>
                  <div className="oa-table-pane" style={{ flex: 1, borderLeft: '1px solid #e8e4dc', overflow: 'hidden' }}>
                    <OrchardRankingTable
                      orchards={orchardAnalysis.map(o => ({
                        id: o.id, name: o.name, variety: o.variety,
                        commodityName: o.commodityName, ha: o.ha,
                        tons: o.tons, tonHa: o.tonHa, bins: o.bins,
                        bruisingPct: o.bruisingPct,
                        pestStatus: o.pestStatus, pestCount: o.pestCount,
                      }))}
                      weeklyBins={weeklyBins}
                      selectedOrchardId={selectedOrchardId}
                      onOrchardSelect={setSelectedOrchardId}
                      hasProduction={hasProduction}
                    />
                  </div>
                </div>
              </div>

              {/* Performance Comparison + Variety Treemap */}
              <div className="oa-two-col" style={{ display: 'grid', gridTemplateColumns: hasProduction ? '1fr 1fr' : '1fr', gap: 24, marginBottom: 24 }}>
                {hasProduction && (
                  <div style={s.card}>
                    <div style={s.cardHeader}><div style={s.cardTitle}>Performance Comparison</div></div>
                    <div style={s.cardBody}>
                      <PerformanceComparison
                        orchards={orchardAnalysis}
                        farms={allFarms}
                      />
                    </div>
                  </div>
                )}
                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={s.cardTitle}>Variety Breakdown</div>
                      {selectedVariety && (
                        <button
                          onClick={() => setSelectedVariety(null)}
                          style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            border: '1.5px solid #2a6e45', background: '#2a6e45', color: '#fff',
                            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          {selectedVariety} <span style={{ fontSize: 13, lineHeight: 1 }}>&times;</span>
                        </button>
                      )}
                    </div>
                    {selectedVariety && (
                      <span style={{ fontSize: 11, color: '#9aaa9f' }}>Click variety to filter page</span>
                    )}
                  </div>
                  <div style={s.cardBody}>
                    <VarietyTreemap
                      items={treemapItems}
                      selectedLabel={selectedVariety}
                      onSelect={setSelectedVariety}
                    />
                  </div>
                </div>
              </div>

              {/* Orchard Age Analysis */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={s.cardTitle}>Age Analysis</div>
                    {selectedAgeBand && (
                      <button
                        onClick={() => setSelectedAgeBand(null)}
                        style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          border: '1.5px solid #2a6e45', background: '#2a6e45', color: '#fff',
                          cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {selectedAgeBand.charAt(0).toUpperCase() + selectedAgeBand.slice(1)} <span style={{ fontSize: 13, lineHeight: 1 }}>&times;</span>
                      </button>
                    )}
                  </div>
                  {!selectedAgeBand && (
                    <span style={{ fontSize: 11, color: '#9aaa9f' }}>Click age band to filter page</span>
                  )}
                </div>
                <div style={s.cardBody}>
                  <OrchardAgeAnalysis
                    orchards={orchardAnalysis}
                    selectedOrchardId={selectedOrchardId}
                    onOrchardSelect={setSelectedOrchardId}
                    hasProduction={hasProduction}
                    selectedAgeBand={selectedAgeBand}
                    onAgeBandSelect={setSelectedAgeBand}
                    historicalMedians={historicalBandMedians}
                    currentSeason={season}
                  />
                </div>
              </div>

              {/* Season Trend Chart */}
              {hasProduction && weeklyByCommodity.length > 0 && (
                <div style={s.card}>
                  <div style={s.cardHeader}><div style={s.cardTitle}>Season Production Trend</div></div>
                  <div style={s.cardBody}>
                    <SeasonTrendChart
                      data={weeklyByCommodity}
                      commodities={weekCommodities}
                      commodityColors={commodityNameColors}
                      currentWeek={currentISOWeek()}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
        <MobileNav modules={modules} isSuperAdmin={isSuperAdmin} />
      </div>

      {/* Detail panel */}
      <BlockDetailPanel
        orchard={selectedOrchard}
        open={selectedOrchardId !== null}
        onClose={() => setSelectedOrchardId(null)}
        season={season}
        prevSeasonTons={prevProdForSelected.tons}
        prevSeasonTonHa={prevProdForSelected.tonHa}
        hasProduction={hasProduction}
      />
    </>
  )
}

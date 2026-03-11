'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList, Legend,
} from 'recharts'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import BruisingQualityPanel from '@/app/components/production/BruisingQualityPanel'

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; name: string }
interface Commodity { id: string; name: string; code: string }
interface OrchardRef { id: string; name: string; variety: string | null; variety_group: string | null; ha: number | null; commodity_id: string; farm_id: string }

interface BinRow {
  orchard_id: string | null
  orchard_name: string
  variety: string | null
  farm_id: string
  bins: number
  juice: number
  total: number
  week_num: number | null
  received_date: string
}

interface BruisingRow {
  orchard_id: string | null
  orchard_name: string
  variety: string | null
  bruising_pct: number | null
  stem_pct: number | null
  injury_pct: number | null
  bin_weight_kg: number | null
  team: string | null
  team_name: string | null
  week_num: number | null
}

interface BinWeight {
  commodity_id: string
  variety: string | null
  default_weight_kg: number
}

interface OrchardAgg {
  orchard_id: string | null
  name: string
  variety: string | null
  ha: number | null
  bins: number
  juice: number
  total: number
  binWeight: number
  tons: number
  tonHa: number | null
}

interface WeekAgg {
  week: number
  label: string
  bins: number
  juice: number
  total: number
}

interface BruisingAgg {
  orchard_id: string | null
  name: string
  variety: string | null
  team: string | null
  teamName: string | null
  samples: number
  bruising: number
  stem: number
  injury: number
  avgWeight: number | null
}

interface SizeBin {
  bin_label: string
  display_order: number
  fruit_count: number
}

interface IssueRow {
  pest_id: string
  pest_name: string
  pest_name_af: string
  category: string
  total_count: number
  bags_affected: number
  pct_of_fruit: number
}

type SortKey = 'name' | 'variety' | 'ha' | 'bins' | 'juice' | 'total' | 'tons' | 'tonHa' | 'binWeight'

// ── Season helpers ──────────────────────────────────────────────────────────

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  const startYr = mo < 8 ? yr - 1 : yr
  return `${startYr}/${String(startYr + 1).slice(-2)}`
}

function buildSeasonOptions(fromYear: number): string[] {
  const current = getCurrentSeason()
  const currentStartYr = parseInt(current.split('/')[0])
  const seasons: string[] = []
  for (let yr = fromYear; yr <= currentStartYr; yr++) {
    seasons.push(`${yr}/${String(yr + 1).slice(-2)}`)
  }
  return seasons.reverse()
}

function seasonDateRange(season: string): { from: string; to: string } {
  const startYr = parseInt(season.split('/')[0])
  return {
    from: `${startYr}-08-01T00:00:00Z`,
    to: `${startYr + 1}-07-31T23:59:59Z`,
  }
}

// ── Colour helpers ──────────────────────────────────────────────────────────

function tonHaColor(tonHa: number | null): string {
  if (tonHa == null) return '#aaa'
  if (tonHa >= 50) return '#2176d9'
  if (tonHa >= 30) return '#4caf72'
  if (tonHa >= 15) return '#f5c842'
  return '#e85a4a'
}

function qualityColor(pct: number): string {
  if (pct < 5) return '#4caf72'
  if (pct < 10) return '#f5c842'
  return '#e85a4a'
}

const SIZE_PALETTE = [
  '#2176d9', '#4caf72', '#6b9e80', '#8cc49a', '#a0c4f0',
  '#c4e6c0', '#dff0da', '#f5c842', '#e8924a', '#d35400',
  '#c0392b', '#e85a4a', '#6b7fa8', '#8a95a0', '#c8c4bb',
]
const ISSUE_PALETTE = [
  '#c0392b', '#e74c3c', '#e8604c', '#f0876a',
  '#f5a58a', '#f9c3ab', '#fddecf',
  '#d35400', '#e67e22', '#f39c12', '#f1c40f', '#a8d8a8',
  '#6b7fa8', '#8a95a0', '#c8c4bb',
]

// ── Inline styles ───────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:        { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
  main:        { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, paddingBottom: 100 },
  pageHeader:  { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  pageTitle:   { fontSize: 32, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px', lineHeight: 1 },
  pageSub:     { fontSize: 14, color: '#8a95a0', marginTop: 6 },
  controls:    { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 28 },
  filterGroup: { display: 'flex', gap: 6 },
  pill:        { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:  { padding: '6px 14px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  divider:     { width: 1, height: 24, background: '#d4cfca' },
  select:      { padding: '6px 12px', borderRadius: 8, border: '1px solid #d4cfca', background: '#fff', fontSize: 13, fontFamily: 'inherit', color: '#1a2a3a', cursor: 'pointer' },
  // KPI strip
  kpiStrip:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 },
  kpiCard:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative' as const, overflow: 'hidden' },
  kpiAccent:   { position: 'absolute' as const, top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2176d9, #a0c4f0)' },
  kpiLabel:    { fontSize: 12, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  kpiValue:    { fontSize: 32, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 },
  kpiSub:      { fontSize: 12, color: '#8a95a0', marginTop: 6 },
  // Card
  card:        { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader:  { padding: '20px 24px 16px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:   { fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
  cardBody:    { padding: '20px 24px' },
  // Loading
  loading:     { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#8a95a0', fontSize: 14 },
}

function circlePack(items: { r: number }[], W: number, H: number, GAP = 4) {
  const placed: { cx: number; cy: number; r: number }[] = []
  return items.map((b, idx) => {
    if (idx === 0) {
      placed.push({ cx: W / 2, cy: H / 2, r: b.r })
      return { cx: W / 2, cy: H / 2 }
    }
    let bestX = W / 2, bestY = H / 2, bestDist = Infinity
    for (const p of placed) {
      const targetDist = p.r + b.r + GAP
      for (let a = 0; a < 36; a++) {
        const angle = (a / 36) * Math.PI * 2
        const cx = p.cx + Math.cos(angle) * targetDist
        const cy = p.cy + Math.sin(angle) * targetDist
        if (cx - b.r < 2 || cx + b.r > W - 2 || cy - b.r < 2 || cy + b.r > H - 2) continue
        let overlap = false
        for (const q of placed) {
          const dx = cx - q.cx, dy = cy - q.cy
          if (Math.sqrt(dx * dx + dy * dy) < b.r + q.r + GAP) { overlap = true; break }
        }
        if (!overlap) {
          const d = Math.sqrt((cx - W / 2) ** 2 + (cy - H / 2) ** 2)
          if (d < bestDist) { bestX = cx; bestY = cy; bestDist = d }
        }
      }
    }
    placed.push({ cx: bestX, cy: bestY, r: b.r })
    return { cx: bestX, cy: bestY }
  })
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a2a3a', color: '#e8f0e0', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString('en-ZA', { maximumFractionDigits: 1 }) : p.value}</strong></div>
      ))}
    </div>
  )
}

// ── Paginated fetch (Supabase caps at 1000 rows per request) ────────────────

async function fetchAllRows(query: any): Promise<any[]> {
  const PAGE = 1000
  let all: any[] = []
  let offset = 0
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE - 1)
    if (error) { console.error('fetchAll error:', error.message); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, orgId } = useUserContext()
  const modules = useOrgModules()

  const [allFarms, setAllFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [selectedCommodityId, setSelectedCommodityId] = useState<string | null>(null)
  const [season, setSeason] = useState(getCurrentSeason())
  const seasons = useMemo(() => buildSeasonOptions(2020), [])

  // Date filter: 'today' | 'all' | 'custom'
  // Before 08:00 SAST → default to yesterday so morning team briefing shows previous day
  const [dateFilter, setDateFilter] = useState<'today' | 'all' | 'custom'>(() => {
    const sast = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }))
    return sast.getHours() < 8 ? 'custom' : 'today'
  })
  const [customDate, setCustomDate] = useState(() => {
    const sast = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }))
    if (sast.getHours() < 8) {
      sast.setDate(sast.getDate() - 1)
    }
    return sast.toISOString().slice(0, 10)
  })

  const [allOrchards, setAllOrchards] = useState<OrchardRef[]>([])
  const [binRows, setBinRows] = useState<BinRow[]>([])
  const [bruisingRows, setBruisingRows] = useState<BruisingRow[]>([])
  const [binWeights, setBinWeights] = useState<BinWeight[]>([])
  const [loading, setLoading] = useState(true)

  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)
  const [selectedVarietyGroup, setSelectedVarietyGroup] = useState<string | null>(null)

  // QC data
  const [sizeBins, setSizeBins] = useState<SizeBin[]>([])
  const [issueRows, setIssueRows] = useState<IssueRow[]>([])
  const [qcLoading, setQcLoading] = useState(false)
  const [sizeView, setSizeView] = useState<'bars' | 'bubbles' | 'waffle'>('bars')
  const [issueView, setIssueView] = useState<'bars' | 'bubbles' | 'waffle'>('bars')

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const geoLayerRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)

  const filterDate = useMemo(() => {
    if (dateFilter === 'today') return new Date().toISOString().slice(0, 10)
    if (dateFilter === 'custom') return customDate
    return null // 'all' = full season
  }, [dateFilter, customDate])

  const effectiveFarmIds = useMemo(() => {
    if (selectedFarmId) return [selectedFarmId]
    return allFarms.map(f => f.id)
  }, [allFarms, selectedFarmId])

  // Load farms + commodities on mount
  useEffect(() => {
    if (!contextLoaded) return
    async function init() {
      const farmQ = supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('full_name')
      const { data: farmsData } = isSuperAdmin ? await farmQ : await farmQ.in('id', farmIds)
      const farms = (farmsData || []).map((f: any) => ({ id: f.id, code: f.code, name: f.full_name }))
      setAllFarms(farms)

      const { data: commData } = await supabase.from('commodities').select('id, name, code').order('name')
      setCommodities((commData || []) as Commodity[])
    }
    init()
  }, [contextLoaded])

  // Load production data when filters change
  useEffect(() => {
    if (!contextLoaded || effectiveFarmIds.length === 0) return
    async function fetchData() {
      setLoading(true)
      try {
        let binsQ = supabase
          .from('production_bins')
          .select('orchard_id, orchard_name, variety, farm_id, bins, juice, total, week_num, received_date')
          .eq('season', season)
          .in('farm_id', effectiveFarmIds)
          .order('received_date', { ascending: false })
        if (filterDate) binsQ = binsQ.eq('received_date', filterDate)

        let bruisingQ = supabase
          .from('production_bruising')
          .select('orchard_id, orchard_name, variety, bruising_pct, stem_pct, injury_pct, bin_weight_kg, received_date, team, team_name, week_num')
          .eq('season', season)
          .in('farm_id', effectiveFarmIds)
        if (filterDate) bruisingQ = bruisingQ.eq('received_date', filterDate)

        const [binsData, bruisingData, orchardsRes, weightsRes] = await Promise.all([
          fetchAllRows(binsQ),
          fetchAllRows(bruisingQ),
          supabase
            .from('orchards')
            .select('id, name, variety, variety_group, ha, commodity_id, farm_id')
            .in('farm_id', effectiveFarmIds)
            .eq('is_active', true),
          orgId
            ? supabase.from('production_bin_weights').select('commodity_id, variety, default_weight_kg').eq('organisation_id', orgId)
            : Promise.resolve({ data: [] }),
        ])

        setBinRows(binsData as BinRow[])
        setBruisingRows(bruisingData as BruisingRow[])
        setAllOrchards((orchardsRes.data || []) as OrchardRef[])
        setBinWeights((weightsRes.data || []) as BinWeight[])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [contextLoaded, effectiveFarmIds, season, orgId, filterDate])

  // Load QC data (size distribution + issues) when filters change
  useEffect(() => {
    if (!contextLoaded || effectiveFarmIds.length === 0) return
    async function fetchQc() {
      setQcLoading(true)
      try {
        const qcFrom = filterDate ? `${filterDate}T00:00:00Z` : seasonDateRange(season).from
        const qcTo = filterDate ? `${filterDate}T23:59:59Z` : seasonDateRange(season).to
        const [sizeRes, issueRes] = await Promise.all([
          supabase.rpc('get_qc_size_distribution', {
            p_farm_ids: effectiveFarmIds,
            p_from: qcFrom,
            p_to: qcTo,
            p_commodity_id: selectedCommodityId || null,
            p_orchard_id: selectedOrchardId || null,
          }),
          supabase.rpc('get_qc_issue_breakdown', {
            p_farm_ids: effectiveFarmIds,
            p_from: qcFrom,
            p_to: qcTo,
            p_commodity_id: selectedCommodityId || null,
            p_orchard_id: selectedOrchardId || null,
          }),
        ])
        if (sizeRes.error) console.error('Size dist RPC error:', sizeRes.error)
        if (issueRes.error) console.error('Issue breakdown RPC error:', issueRes.error)
        // Merge duplicate labels (same label can appear for different commodities with different display_order)
        const rawBins = (sizeRes.data || []) as SizeBin[]
        const mergedMap: Record<string, SizeBin> = {}
        rawBins.forEach(b => {
          if (mergedMap[b.bin_label]) {
            mergedMap[b.bin_label].fruit_count += b.fruit_count
            // Keep the lowest display_order
            if (b.display_order < mergedMap[b.bin_label].display_order) mergedMap[b.bin_label].display_order = b.display_order
          } else {
            mergedMap[b.bin_label] = { ...b }
          }
        })
        setSizeBins(Object.values(mergedMap).sort((a, b) => a.display_order - b.display_order))
        setIssueRows((issueRes.data || []) as IssueRow[])
      } catch (err) {
        console.error('QC data fetch error:', err)
      } finally {
        setQcLoading(false)
      }
    }
    fetchQc()
  }, [contextLoaded, effectiveFarmIds, season, selectedCommodityId, selectedOrchardId, filterDate])

  // ── Aggregation ─────────────────────────────────────────────────────────

  // Build orchard lookup
  const orchardLookup = useMemo(() => {
    const map: Record<string, OrchardRef> = {}
    allOrchards.forEach(o => { map[o.id] = o })
    return map
  }, [allOrchards])

  // Filter bins by commodity + variety group + selected orchard
  const filteredBins = useMemo(() => {
    return binRows.filter(b => {
      if (selectedOrchardId && b.orchard_id !== selectedOrchardId) return false
      if (selectedCommodityId || selectedVarietyGroup) {
        if (!b.orchard_id) return false
        const o = orchardLookup[b.orchard_id]
        if (selectedCommodityId && o?.commodity_id !== selectedCommodityId) return false
        if (selectedVarietyGroup && o?.variety_group !== selectedVarietyGroup) return false
      }
      return true
    })
  }, [binRows, selectedCommodityId, selectedVarietyGroup, selectedOrchardId, orchardLookup])

  // Filter bruising by commodity + variety group + selected orchard
  const filteredBruising = useMemo(() => {
    return bruisingRows.filter(b => {
      if (selectedOrchardId && b.orchard_id !== selectedOrchardId) return false
      if (selectedCommodityId || selectedVarietyGroup) {
        if (!b.orchard_id) return false
        const o = orchardLookup[b.orchard_id]
        if (selectedCommodityId && o?.commodity_id !== selectedCommodityId) return false
        if (selectedVarietyGroup && o?.variety_group !== selectedVarietyGroup) return false
      }
      return true
    })
  }, [bruisingRows, selectedCommodityId, selectedVarietyGroup, selectedOrchardId, orchardLookup])

  // Bin weight cascade lookup
  const getBinWeight = useCallback((orchardId: string | null, variety: string | null) => {
    // 1. Actual avg from bruising
    if (orchardId) {
      const orchardBruising = filteredBruising.filter(b => b.orchard_id === orchardId && b.bin_weight_kg && b.bin_weight_kg > 0)
      if (orchardBruising.length > 0) {
        return orchardBruising.reduce((sum, b) => sum + (b.bin_weight_kg || 0), 0) / orchardBruising.length
      }
    }
    // 2. Configured fallback (commodity + variety)
    if (orchardId) {
      const o = orchardLookup[orchardId]
      if (o) {
        const match = binWeights.find(w => w.commodity_id === o.commodity_id && w.variety === variety)
        if (match) return match.default_weight_kg
        // 3. Commodity-only fallback
        const commMatch = binWeights.find(w => w.commodity_id === o.commodity_id && !w.variety)
        if (commMatch) return commMatch.default_weight_kg
      }
    }
    // 4. Default
    return 400
  }, [filteredBruising, orchardLookup, binWeights])

  // Orchard summary aggregation
  const orchardAgg = useMemo(() => {
    const map: Record<string, { bins: number; juice: number; total: number; name: string; variety: string | null; orchardId: string | null }> = {}

    filteredBins.forEach(row => {
      const key = row.orchard_id || `_${row.orchard_name}`
      if (!map[key]) {
        map[key] = { bins: 0, juice: 0, total: 0, name: row.orchard_name, variety: row.variety, orchardId: row.orchard_id }
      }
      map[key].bins += row.bins
      map[key].juice += row.juice
      map[key].total += row.total
    })

    const results: OrchardAgg[] = Object.entries(map).map(([key, val]) => {
      const o = val.orchardId ? orchardLookup[val.orchardId] : null
      const ha = o?.ha || null
      const binWeight = getBinWeight(val.orchardId, val.variety)
      const tons = val.total * binWeight / 1000
      const tonHa = ha && ha > 0 ? tons / ha : null
      return {
        orchard_id: val.orchardId,
        name: o?.name || val.name,
        variety: o?.variety || val.variety,
        ha,
        bins: val.bins,
        juice: val.juice,
        total: val.total,
        binWeight: Math.round(binWeight),
        tons: Math.round(tons * 10) / 10,
        tonHa: tonHa != null ? Math.round(tonHa * 10) / 10 : null,
      }
    })

    return results
  }, [filteredBins, orchardLookup, getBinWeight])

  // Sort
  const sortedOrchards = useMemo(() => {
    const copy = [...orchardAgg]
    copy.sort((a, b) => {
      let av = a[sortKey] ?? -Infinity
      let bv = b[sortKey] ?? -Infinity
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [orchardAgg, sortKey, sortDir])

  // KPIs
  const kpis = useMemo(() => {
    const totalBins = orchardAgg.reduce((s, o) => s + o.bins, 0)
    const totalJuice = orchardAgg.reduce((s, o) => s + o.juice, 0)
    const totalTons = orchardAgg.reduce((s, o) => s + o.tons, 0)
    const withHa = orchardAgg.filter(o => o.tonHa != null && o.ha && o.ha > 0)
    const totalHa = withHa.reduce((s, o) => s + (o.ha || 0), 0)
    const avgTonHa = totalHa > 0 ? totalTons / totalHa : null
    const avgBinWeight = orchardAgg.length > 0 ? orchardAgg.reduce((s, o) => s + o.binWeight, 0) / orchardAgg.length : 0
    return {
      totalBins: Math.round(totalBins * 10) / 10,
      totalTons: Math.round(totalTons * 10) / 10,
      avgTonHa: avgTonHa != null ? Math.round(avgTonHa * 10) / 10 : null,
      totalJuice: Math.round(totalJuice * 10) / 10,
      avgBinWeight: Math.round(avgBinWeight),
      orchards: orchardAgg.length,
    }
  }, [orchardAgg])

  // Avg Bruising — extracted for reuse in mobile KPI + desktop KPI strip
  const avgBruisingData = useMemo(() => {
    const withBruising = filteredBruising.filter(b => b.bruising_pct != null)
    const avg = withBruising.length > 0
      ? withBruising.reduce((s, b) => s + (b.bruising_pct || 0), 0) / withBruising.length
      : null
    return { avg, samples: withBruising.length }
  }, [filteredBruising])

  // Class 1 % — extracted for reuse in mobile KPI + desktop KPI strip
  const class1Data = useMemo(() => {
    const totalFruit = sizeBins.reduce((sum, b) => sum + b.fruit_count, 0)
    const qcDefects = issueRows.filter(r => r.category === 'qc_issue').reduce((sum, r) => sum + r.total_count, 0)
    const realBins = sizeBins.filter(b => b.bin_label !== 'Out of spec')
    const outOfSpec = sizeBins.filter(b => b.bin_label === 'Out of spec').reduce((s, b) => s + b.fruit_count, 0)
    const oversizeCount = realBins.length > 0 ? realBins[0].fruit_count : 0
    const undersizeCount = realBins.length > 1 ? realBins[realBins.length - 1].fruit_count : 0
    const packable = totalFruit - oversizeCount - undersizeCount - outOfSpec
    const class1 = packable > 0 ? Math.round((packable - qcDefects) / packable * 1000) / 10 : null
    return { class1, packable }
  }, [sizeBins, issueRows])

  // Top 5 orchards by total bins — for mobile compact list
  const topOrchards = useMemo(() => {
    return [...orchardAgg].sort((a, b) => b.total - a.total).slice(0, 5)
  }, [orchardAgg])

  // Total fruit sampled — shared between mobile + desktop panels
  const totalFruitSampled = useMemo(() => sizeBins.reduce((sum, b) => sum + b.fruit_count, 0), [sizeBins])

  // Size distribution % — extracted for mobile panel + desktop IIFE
  const sizePctData = useMemo(() => {
    return sizeBins.map(b => ({
      ...b,
      pct: totalFruitSampled > 0 ? Math.round((b.fruit_count / totalFruitSampled) * 1000) / 10 : 0,
    }))
  }, [sizeBins, totalFruitSampled])

  // QC issue % — extracted for mobile panel + desktop IIFE
  const issuePctData = useMemo(() => {
    const filteredIssues = issueRows.filter(r => r.category !== 'picking_issue')
    const totalIssues = filteredIssues.reduce((s, r) => s + r.total_count, 0)
    return filteredIssues.map(r => ({
      ...r,
      pct: r.pct_of_fruit > 0
        ? Math.round(r.pct_of_fruit * 10) / 10
        : totalIssues > 0
          ? Math.round((r.total_count / totalIssues) * 1000) / 10
          : 0,
    }))
  }, [issueRows])

  // Mobile collapse states
  const [qualityOpen, setQualityOpen] = useState(false)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [issuesOpen, setIssuesOpen] = useState(false)

  // Weekly trend grouped by commodity
  const { weeklyTrend, weekCommodities } = useMemo(() => {
    // Build commodity name lookup per orchard
    const commNameById: Record<string, string> = {}
    commodities.forEach(c => { commNameById[c.id] = c.name })
    const orchardComm: Record<string, string> = {}
    allOrchards.forEach(o => { orchardComm[o.id] = commNameById[o.commodity_id] || 'Other' })

    const map: Record<number, Record<string, number>> = {}
    const commSet = new Set<string>()

    filteredBins.forEach(row => {
      const wk = row.week_num
      if (wk == null) return
      const comm = row.orchard_id ? (orchardComm[row.orchard_id] || 'Other') : 'Other'
      commSet.add(comm)
      if (!map[wk]) map[wk] = {}
      map[wk][comm] = (map[wk][comm] || 0) + row.total
    })

    const comms = [...commSet].sort()
    // Sort in season order: W31–W52, then W1–W30
    const seasonSort = (wk: number) => wk >= 31 ? wk - 31 : wk + 21

    const data = Object.entries(map)
      .map(([wk, vals]) => {
        const row: Record<string, any> = { week: Number(wk), label: `W${wk}` }
        comms.forEach(c => { row[c] = vals[c] || 0 })
        return row
      })
      .sort((a, b) => seasonSort(a.week) - seasonSort(b.week))

    return { weeklyTrend: data, weekCommodities: comms }
  }, [filteredBins, allOrchards, commodities])

  // Ton/Ha bar chart data (top 30 orchards with ha)
  const tonHaData = useMemo(() => {
    return orchardAgg
      .filter(o => o.tonHa != null)
      .sort((a, b) => (b.tonHa || 0) - (a.tonHa || 0))
      .slice(0, 30)
      .map(o => ({ name: o.name, tonHa: o.tonHa }))
  }, [orchardAgg])

  // Bruising summary — grouped by orchard + team
  const bruisingSummary = useMemo(() => {
    const map: Record<string, { bruisingSum: number; stemSum: number; injurySum: number; weightSum: number; weightCount: number; count: number; name: string; variety: string | null; orchardId: string | null; team: string | null; teamName: string | null }> = {}
    filteredBruising.forEach(row => {
      const orchardKey = row.orchard_id || `_${row.orchard_name}`
      const teamKey = row.team || '_none'
      const key = `${orchardKey}::${teamKey}`
      if (!map[key]) {
        map[key] = { bruisingSum: 0, stemSum: 0, injurySum: 0, weightSum: 0, weightCount: 0, count: 0, name: row.orchard_name, variety: row.variety, orchardId: row.orchard_id, team: row.team, teamName: row.team_name }
      }
      map[key].count++
      map[key].bruisingSum += row.bruising_pct || 0
      map[key].stemSum += row.stem_pct || 0
      map[key].injurySum += row.injury_pct || 0
      if (row.bin_weight_kg && row.bin_weight_kg > 0) {
        map[key].weightSum += row.bin_weight_kg
        map[key].weightCount++
      }
    })

    return Object.entries(map)
      .map(([, val]) => {
        const o = val.orchardId ? orchardLookup[val.orchardId] : null
        return {
          orchard_id: val.orchardId,
          name: o?.name || val.name,
          variety: o?.variety || val.variety,
          team: val.team,
          teamName: val.teamName,
          samples: val.count,
          bruising: Math.round((val.bruisingSum / val.count) * 100) / 100,
          stem: Math.round((val.stemSum / val.count) * 100) / 100,
          injury: Math.round((val.injurySum / val.count) * 100) / 100,
          avgWeight: val.weightCount > 0 ? Math.round(val.weightSum / val.weightCount) : null,
        } as BruisingAgg
      })
      .sort((a, b) => b.bruising - a.bruising)
  }, [filteredBruising, orchardLookup])

  // ── Init Leaflet map (container is always in DOM, init once) ────────────
  useEffect(() => {
    if (mapReady || !mapContainerRef.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      leafletRef.current = L
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }
      if (!(mapContainerRef.current as any)._leaflet_id) {
        const map = L.map(mapContainerRef.current!, { zoomControl: true, attributionControl: false, scrollWheelZoom: true, maxZoom: 19 })
        map.setView([-33.8, 19.1], 13)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18 }).addTo(map)
        mapRef.current = map
        setTimeout(() => { map.invalidateSize(); }, 200)
        setTimeout(() => { map.invalidateSize(); }, 600)
        setMapReady(true)
      }
    })()
  }, [])

  // ── Draw polygons ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || allOrchards.length === 0) return
    ;(async () => {
      const L = leafletRef.current
      const map = mapRef.current
      if (!L || !map) return
      if (geoLayerRef.current) geoLayerRef.current.remove()

      const { data: boundaryData } = await supabase.rpc('get_orchard_boundaries')
      if (!boundaryData?.length) return

      // Build lookup of ton/ha for colouring
      const aggLookup: Record<string, OrchardAgg> = {}
      orchardAgg.forEach(o => { if (o.orchard_id) aggLookup[o.orchard_id] = o })

      // Filter to orchards we have access to
      const myBoundaries = boundaryData.filter((o: any) => orchardLookup[o.id])
      if (!myBoundaries.length) return

      const layer = L.geoJSON(
        { type: 'FeatureCollection', features: myBoundaries.map((o: any) => ({ type: 'Feature', properties: { id: o.id, name: o.name }, geometry: o.boundary })) },
        {
          style: (f: any) => {
            const agg = aggLookup[f.properties.id]
            const color = agg ? tonHaColor(agg.tonHa) : '#666'
            const sel = f.properties.id === selectedOrchardId
            return { fillColor: color, fillOpacity: sel ? 0.95 : (agg ? 0.7 : 0.25), color: '#fff', weight: sel ? 3 : 1.5 }
          },
          onEachFeature: (f: any, lyr: any) => {
            const id = f.properties.id
            const agg = aggLookup[id]
            const tip = agg ? `${f.properties.name}: ${agg.tonHa ?? '–'} t/ha` : f.properties.name
            lyr.bindTooltip(tip, { permanent: false, className: 'prod-tooltip' })
            lyr.on('mouseover', () => { if (id !== selectedOrchardId) lyr.setStyle({ fillOpacity: 0.88 }) })
            lyr.on('mouseout',  () => { if (id !== selectedOrchardId) lyr.setStyle({ fillOpacity: agg ? 0.7 : 0.25 }) })
            lyr.on('click', () => {
              setSelectedOrchardId(prev => prev === id ? null : id)
              map.fitBounds(lyr.getBounds(), { padding: [60, 60], maxZoom: 17 })
            })
          },
        }
      ).addTo(map)
      geoLayerRef.current = layer
      map.invalidateSize()
      if (layer.getBounds().isValid() && !selectedOrchardId) map.fitBounds(layer.getBounds(), { padding: [16, 16] })
      // Extra invalidateSize after layout settles
      setTimeout(() => { map.invalidateSize(); if (layer.getBounds().isValid() && !selectedOrchardId) map.fitBounds(layer.getBounds(), { padding: [16, 16] }) }, 400)
    })()
  }, [mapReady, allOrchards, orchardAgg, selectedOrchardId])

  // Sort handler
  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortIcon = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />
      <MobileNav isSuperAdmin={isSuperAdmin} modules={modules} />

      <main style={s.main} className="prod-main">
        {/* ── Mobile top bar (fixed) ────────────────────────────────── */}
        <div className="prod-mobile-only prod-mobile-topbar" style={{
          alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
          background: '#fff', borderBottom: '1px solid #e8e4dc',
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        }}>
          <button
            onClick={() => window.location.reload()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#3a4a40', lineHeight: 0 }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <img src="/allfarm-logo.svg" alt="allFarm" style={{ height: 36, width: 36, borderRadius: 10 }} />
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#3a4a40', lineHeight: 0 }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>

        {/* ── Mobile KPI section ────────────────────────────────────── */}
        <div className="prod-mobile-only prod-mobile-content">
          {/* Date + week label */}
          <div style={{ padding: '14px 2px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.3px' }}>
              {dateFilter === 'all'
                ? `Season ${season}`
                : new Date(filterDate! + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {dateFilter !== 'all' && `W${(() => {
                const d = new Date(filterDate! + 'T12:00:00')
                d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
                const y = new Date(d.getFullYear(), 0, 4)
                return Math.round(((d.getTime() - y.getTime()) / 86400000 - 3 + ((y.getDay() + 6) % 7)) / 7) + 1
              })()}`}
            </span>
          </div>

          {/* Quick date toggle: Yesterday / Today / Season */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(() => {
              const sast = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }))
              const todayStr = sast.toISOString().slice(0, 10)
              sast.setDate(sast.getDate() - 1)
              const yesterdayStr = sast.toISOString().slice(0, 10)
              const isYesterday = dateFilter === 'custom' && customDate === yesterdayStr
              const isToday = dateFilter === 'today'
              const isSeason = dateFilter === 'all'
              return (<>
                <button
                  onClick={() => { setCustomDate(yesterdayStr); setDateFilter('custom') }}
                  style={isYesterday ? s.pillActive : s.pill}
                >Yesterday</button>
                <button
                  onClick={() => setDateFilter('today')}
                  style={isToday ? s.pillActive : s.pill}
                >Today</button>
                <button
                  onClick={() => setDateFilter('all')}
                  style={isSeason ? s.pillActive : s.pill}
                >Season</button>
              </>)
            })()}
          </div>

          {/* 2x2 KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {/* Total Bins */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '18px 16px' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 }}>
                {kpis.totalBins.toLocaleString('en-ZA')}
              </div>
              <div style={{ height: 2, background: '#f0ede6', margin: '8px 0' }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7a8a9a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Bins
              </div>
            </div>
            {/* Total Tons */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '18px 16px' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 }}>
                {kpis.totalTons.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}
              </div>
              <div style={{ height: 2, background: '#f0ede6', margin: '8px 0' }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7a8a9a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Tons
              </div>
            </div>
            {/* Avg Bruising */}
            <div style={{
              background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '18px 16px',
              borderLeft: `4px solid ${avgBruisingData.avg != null ? qualityColor(avgBruisingData.avg) : '#e8e4dc'}`,
            }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: avgBruisingData.avg != null ? qualityColor(avgBruisingData.avg) : '#1a2a3a', lineHeight: 1 }}>
                {avgBruisingData.avg != null ? `${avgBruisingData.avg.toFixed(1)}%` : '–'}
              </div>
              <div style={{ height: 2, background: '#f0ede6', margin: '8px 0' }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7a8a9a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Bruising
              </div>
            </div>
            {/* Class 1 % */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '18px 16px' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 }}>
                {class1Data.class1 != null ? `${class1Data.class1}%` : '–'}
              </div>
              <div style={{ height: 2, background: '#f0ede6', margin: '8px 0' }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: '#7a8a9a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Class 1 %
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div style={s.pageHeader} className="prod-header prod-desktop-only">
          <div>
            <div style={s.pageTitle} className="prod-title">Production</div>
            <div style={s.pageSub}>Bin receiving, tonnage & quality</div>
          </div>
          <select style={s.select} value={season} onChange={e => setSeason(e.target.value)}>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Filter pills */}
        <div style={s.controls} className="prod-filters">
          <div style={s.filterGroup}>
            <button style={!selectedFarmId ? s.pillActive : s.pill} onClick={() => setSelectedFarmId(null)}>All Farms</button>
            {allFarms.map(f => (
              <button key={f.id} style={selectedFarmId === f.id ? s.pillActive : s.pill} onClick={() => setSelectedFarmId(f.id)}>{f.code}</button>
            ))}
          </div>
          <div style={s.divider} />
          <div style={s.filterGroup}>
            <button style={!selectedCommodityId ? s.pillActive : s.pill} onClick={() => { setSelectedCommodityId(null); setSelectedVarietyGroup(null); setSelectedOrchardId(null) }}>All</button>
            {commodities.map(c => (
              <button key={c.id} style={selectedCommodityId === c.id ? s.pillActive : s.pill} onClick={() => { setSelectedCommodityId(c.id); setSelectedVarietyGroup(null); setSelectedOrchardId(null) }}>{c.name}</button>
            ))}
          </div>
          <div style={s.divider} className="prod-date-filter" />
          <div style={s.filterGroup} className="prod-date-filter">
            <button style={dateFilter === 'today' ? s.pillActive : s.pill} onClick={() => setDateFilter('today')}>Today</button>
            <button style={dateFilter === 'all' ? s.pillActive : s.pill} onClick={() => setDateFilter('all')}>All</button>
            <input
              type="date"
              value={dateFilter === 'custom' ? customDate : ''}
              onChange={e => { setCustomDate(e.target.value); setDateFilter('custom') }}
              style={{ ...s.pill, ...(dateFilter === 'custom' ? { borderColor: '#2176d9', background: '#e8f0fa', color: '#2176d9' } : {}), width: 130 }}
            />
          </div>
        </div>

        {/* Drill-down pills: Variety Group (after commodity) → Orchard (after variety group) */}
        {selectedCommodityId && (() => {
          const groups = [...new Set(allOrchards.filter(o => o.commodity_id === selectedCommodityId && o.variety_group).map(o => o.variety_group!))].sort()
          if (groups.length === 0) return null
          const orchardChoices = selectedVarietyGroup
            ? allOrchards.filter(o => o.commodity_id === selectedCommodityId && o.variety_group === selectedVarietyGroup).sort((a, b) => a.name.localeCompare(b.name))
            : []
          return (
            <div style={{ ...s.controls, marginTop: -8 }} className="prod-filters">
              <div style={s.filterGroup}>
                <span style={{ fontSize: 11, color: '#8a95a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Group</span>
                <button style={!selectedVarietyGroup ? s.pillActive : s.pill} onClick={() => { setSelectedVarietyGroup(null); setSelectedOrchardId(null) }}>All</button>
                {groups.map(g => (
                  <button key={g} style={selectedVarietyGroup === g ? s.pillActive : s.pill} onClick={() => { setSelectedVarietyGroup(g); setSelectedOrchardId(null) }}>{g}</button>
                ))}
              </div>
              {orchardChoices.length > 0 && (
                <>
                  <div style={s.divider} />
                  <div style={s.filterGroup}>
                    <span style={{ fontSize: 11, color: '#8a95a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Orchard</span>
                    <button style={!selectedOrchardId ? s.pillActive : s.pill} onClick={() => setSelectedOrchardId(null)}>All</button>
                    {orchardChoices.map(o => (
                      <button key={o.id} style={selectedOrchardId === o.id ? s.pillActive : s.pill} onClick={() => setSelectedOrchardId(o.id)}>{o.name}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {loading && <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 13, color: '#8a95a0' }}>Loading production data...</div>}
          <>
            {/* KPI Strip */}
            <div style={s.kpiStrip} className="prod-kpi-strip prod-desktop-only">
              {[
                { label: 'Total Bins', value: kpis.totalBins.toLocaleString('en-ZA'), sub: `${kpis.orchards} orchards` },
                { label: 'Total Tons', value: kpis.totalTons.toLocaleString('en-ZA', { maximumFractionDigits: 1 }), sub: null },
                { label: 'Avg Ton/Ha', value: kpis.avgTonHa != null ? kpis.avgTonHa.toFixed(1) : '–', sub: null },
                { label: 'Total Juice', value: kpis.totalJuice.toLocaleString('en-ZA'), sub: null },
                { label: 'Avg Bin Weight', value: `${kpis.avgBinWeight} kg`, sub: null },
                { label: 'Avg Bruising', value: avgBruisingData.avg != null ? `${avgBruisingData.avg.toFixed(1)}%` : '–', sub: avgBruisingData.samples > 0 ? `${avgBruisingData.samples} samples` : null, color: avgBruisingData.avg != null ? qualityColor(avgBruisingData.avg) : undefined },
                { label: 'Orchards', value: String(kpis.orchards), sub: 'harvested' },
                { label: 'Class 1 %', value: class1Data.class1 != null ? `${class1Data.class1}%` : '–', sub: class1Data.packable > 0 ? `${class1Data.packable.toLocaleString('en-ZA')} packable` : null },
              ].map((kpi: any, i: number) => (
                <div key={i} style={s.kpiCard}>
                  <div style={s.kpiAccent as any} />
                  <div style={s.kpiLabel}>{kpi.label}</div>
                  <div style={{ ...s.kpiValue, ...(kpi.color ? { color: kpi.color } : {}) }}>{kpi.value}</div>
                  {kpi.sub && <div style={s.kpiSub}>{kpi.sub}</div>}
                </div>
              ))}
            </div>

            {/* Map + QC panels row */}
            {(() => {
              const totalFruit = sizeBins.reduce((sum, b) => sum + b.fruit_count, 0)
              return (
            <>
            {/* Map + QC panels — three columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 24, alignItems: 'start' }} className="prod-panels prod-desktop-only">
                {/* Orchard Map */}
                <div style={{ ...s.card, display: 'flex', flexDirection: 'column' }}>
                  <div style={s.cardHeader}><span style={s.cardTitle}>Orchard Map — Ton/Ha</span></div>
                  <div ref={mapContainerRef} style={{ flex: 1, minHeight: 420, width: '100%' }} />
                  <div style={{ padding: '6px 12px', display: 'flex', gap: 10, fontSize: 10, color: '#8a95a0', flexWrap: 'wrap' }}>
                    {[
                      { color: '#2176d9', label: '50+ t/ha' },
                      { color: '#4caf72', label: '30–50' },
                      { color: '#f5c842', label: '15–30' },
                      { color: '#e85a4a', label: '<15' },
                      { color: '#666', label: 'No data' },
                    ].map(l => (
                      <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Size Distribution */}
                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={s.cardTitle}>Size Distribution</span>
                      <span style={{ fontSize: 10, background: '#4caf72', color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>QC</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([['bars', 'Ranked Bars'], ['bubbles', 'Bubble Map'], ['waffle', 'Waffle']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setSizeView(key)} style={{
                          padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                          fontSize: 11, fontWeight: 600,
                          background: sizeView === key ? '#1a2a3a' : '#f0ede6',
                          color: sizeView === key ? 'white' : '#6a7a70',
                        }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={s.cardBody} className="prod-card-body">
                    {qcLoading ? (
                      <div style={s.loading}>Loading QC data...</div>
                    ) : sizePctData.length > 0 ? (() => {
                      const byOrder = [...sizePctData].sort((a, b) => a.display_order - b.display_order)
                      const top3 = [...sizePctData].sort((a, b) => b.pct - a.pct).slice(0, 3)
                      const kpiCards = (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(top3.length, 3)}, 1fr)`, gap: 10, marginBottom: 16 }}>
                          {top3.map((item, i) => (
                            <div key={item.bin_label} style={{ background: '#f7faf5', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${SIZE_PALETTE[i]}` }}>
                              <div style={{ fontSize: 9, color: '#8a95a0', fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}>#{i + 1}</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: SIZE_PALETTE[i], fontFamily: 'monospace', margin: '2px 0' }}>{item.pct}%</div>
                              <div style={{ fontSize: 12, color: '#1a2a3a', fontWeight: 600 }}>{item.bin_label}</div>
                            </div>
                          ))}
                        </div>
                      )

                      if (sizeView === 'bars') {
                        const maxPct = Math.max(...byOrder.map(b => b.pct), 1)
                        return (<>{kpiCards}<div>{byOrder.map((item, i) => (
                          <div key={item.bin_label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 48px', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ textAlign: 'right', fontSize: 11, fontWeight: i < 3 ? 700 : 400, color: i < 3 ? '#1a2a3a' : '#5a6a60', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.bin_label}</span>
                            <div style={{ position: 'relative', height: 20, background: '#f0ede6', borderRadius: 3 }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(item.pct / maxPct) * 100}%`, background: `linear-gradient(90deg, ${SIZE_PALETTE[i % SIZE_PALETTE.length]}dd, ${SIZE_PALETTE[i % SIZE_PALETTE.length]})`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: SIZE_PALETTE[i % SIZE_PALETTE.length], fontFamily: 'monospace', textAlign: 'right' }}>{item.pct}%</span>
                          </div>
                        ))}</div></>)
                      }

                      if (sizeView === 'bubbles') {
                        const maxPct = Math.max(...byOrder.map(b => b.pct), 1)
                        const MAX_R = 70, MIN_R = 14
                        const bubbles = byOrder.map((item, i) => ({
                          ...item, r: Math.max(MIN_R, Math.sqrt(item.pct / maxPct) * MAX_R),
                          color: SIZE_PALETTE[i % SIZE_PALETTE.length],
                        }))
                        const W = 500, H = 300
                        const positions = circlePack(bubbles, W, H)
                        return (<>{kpiCards}<div style={{ width: '100%', maxWidth: W, margin: '0 auto' }}>
                          <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                            {bubbles.map((b, i) => (
                              <g key={b.bin_label}>
                                <circle cx={positions[i].cx} cy={positions[i].cy} r={b.r} fill={b.color} opacity={0.88} />
                                {b.r > 22 && (<>
                                  <text x={positions[i].cx} y={positions[i].cy - 3} textAnchor="middle" fill="white" fontSize={b.r > 40 ? 10 : 8} fontWeight="700" style={{ pointerEvents: 'none' }}>{b.bin_label}</text>
                                  <text x={positions[i].cx} y={positions[i].cy + 10} textAnchor="middle" fill="white" fontSize={b.r > 40 ? 11 : 8} fontFamily="monospace" opacity={0.9} style={{ pointerEvents: 'none' }}>{b.pct}%</text>
                                </>)}
                              </g>
                            ))}
                          </svg>
                        </div></>)
                      }

                      // waffle
                      const cells = 100
                      const grid: (null | { idx: number; label: string })[] = []
                      let ci = 0
                      byOrder.forEach((item, i) => {
                        const count = Math.max(1, Math.round(item.pct))
                        for (let j = 0; j < count && ci < cells; j++) grid[ci++] = { idx: i, label: item.bin_label }
                      })
                      while (grid.length < cells) grid.push(null)
                      return (<>{kpiCards}<div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2 }}>
                            {grid.map((cell, i) => (
                              <div key={i} style={{ width: 24, height: 24, borderRadius: 3, background: cell ? SIZE_PALETTE[cell.idx % SIZE_PALETTE.length] + 'cc' : '#f0ede6' }} />
                            ))}
                          </div>
                          <p style={{ fontSize: 9, color: '#8a95a0', fontFamily: 'monospace', margin: '6px 0 0' }}>Each square ≈ 1%</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {byOrder.map((item, i) => (
                            <div key={item.bin_label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: SIZE_PALETTE[i % SIZE_PALETTE.length], flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: '#3a4a40' }}>{item.bin_label}</span>
                              <span style={{ fontSize: 10, color: '#8a95a0', fontFamily: 'monospace', marginLeft: 'auto' }}>{item.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div></>)
                    })() : (
                      <div style={s.loading}>No QC size data</div>
                    )}
                  </div>
                  {sizePctData.length > 0 && !qcLoading && (
                    <div style={{ padding: '2px 24px 12px', fontSize: 11, color: '#8a95a0' }}>
                      {totalFruit.toLocaleString('en-ZA')} fruit sampled
                    </div>
                  )}
                </div>

                {/* Quality Issues */}
                <div style={s.card}>
                  <div style={s.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={s.cardTitle}>QC Issues</span>
                      <span style={{ fontSize: 10, background: '#e85a4a', color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>DEFECTS</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([['bars', 'Ranked Bars'], ['bubbles', 'Bubble Map'], ['waffle', 'Waffle']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setIssueView(key)} style={{
                          padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                          fontSize: 11, fontWeight: 600,
                          background: issueView === key ? '#1a2a3a' : '#f0ede6',
                          color: issueView === key ? 'white' : '#6a7a70',
                        }}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={s.cardBody} className="prod-card-body">
                    {qcLoading ? (
                      <div style={s.loading}>Loading QC data...</div>
                    ) : issuePctData.length > 0 ? (() => {
                      const sorted = [...issuePctData].sort((a, b) => b.pct - a.pct)
                      const top3 = sorted.slice(0, 3)
                      const kpiCards = (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(top3.length, 3)}, 1fr)`, gap: 10, marginBottom: 16 }}>
                          {top3.map((item, i) => (
                            <div key={item.pest_id} style={{ background: '#fdf8f3', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${ISSUE_PALETTE[i]}` }}>
                              <div style={{ fontSize: 9, color: '#8a95a0', fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}>#{i + 1} Top Issue</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: ISSUE_PALETTE[i], fontFamily: 'monospace', margin: '2px 0' }}>{item.pct}%</div>
                              <div style={{ fontSize: 12, color: '#1a2a3a', fontWeight: 600 }}>{item.pest_name}</div>
                            </div>
                          ))}
                        </div>
                      )

                      if (issueView === 'bars') {
                        const maxPct = sorted[0]?.pct || 1
                        return (<>{kpiCards}<div>{sorted.map((item, i) => (
                          <div key={item.pest_id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 48px', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ textAlign: 'right', fontSize: 11, fontWeight: i < 3 ? 700 : 400, color: i < 3 ? '#1a2a3a' : '#5a6a60', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.pest_name}</span>
                            <div style={{ position: 'relative', height: 20, background: '#f0ede6', borderRadius: 3 }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(item.pct / maxPct) * 100}%`, background: `linear-gradient(90deg, ${ISSUE_PALETTE[i % ISSUE_PALETTE.length]}dd, ${ISSUE_PALETTE[i % ISSUE_PALETTE.length]})`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                              {i === 0 && (item.pct / maxPct) * 100 < 85 && (
                                <span style={{ position: 'absolute', left: `${(item.pct / maxPct) * 100 + 1.5}%`, top: '50%', transform: 'translateY(-50%)', fontSize: 8, color: ISSUE_PALETTE[0], fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{'\u2190'} TOP</span>
                              )}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: ISSUE_PALETTE[i % ISSUE_PALETTE.length], fontFamily: 'monospace', textAlign: 'right' }}>{item.pct}%</span>
                          </div>
                        ))}</div></>)
                      }

                      if (issueView === 'bubbles') {
                        const maxPct = sorted[0]?.pct || 1
                        const MAX_R = 70, MIN_R = 14
                        const bubbles = sorted.map((item, i) => ({
                          ...item, r: Math.max(MIN_R, Math.sqrt(item.pct / maxPct) * MAX_R),
                          color: ISSUE_PALETTE[i % ISSUE_PALETTE.length],
                        }))
                        const W = 500, H = 300
                        const positions = circlePack(bubbles, W, H)
                        return (<>{kpiCards}<div style={{ width: '100%', maxWidth: W, margin: '0 auto' }}>
                          <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                            {bubbles.map((b, i) => (
                              <g key={b.pest_id}>
                                <circle cx={positions[i].cx} cy={positions[i].cy} r={b.r} fill={b.color} opacity={0.88} />
                                {b.r > 22 && (<>
                                  <text x={positions[i].cx} y={positions[i].cy - 3} textAnchor="middle" fill="white" fontSize={b.r > 40 ? 10 : 8} fontWeight="700" style={{ pointerEvents: 'none' }}>{b.pest_name}</text>
                                  <text x={positions[i].cx} y={positions[i].cy + 10} textAnchor="middle" fill="white" fontSize={b.r > 40 ? 11 : 8} fontFamily="monospace" opacity={0.9} style={{ pointerEvents: 'none' }}>{b.pct}%</text>
                                </>)}
                              </g>
                            ))}
                          </svg>
                        </div></>)
                      }

                      // waffle
                      const cells = 100
                      const grid: (null | { idx: number; name: string })[] = []
                      let ci = 0
                      sorted.forEach((item, i) => {
                        const count = Math.max(1, Math.round(item.pct))
                        for (let j = 0; j < count && ci < cells; j++) grid[ci++] = { idx: i, name: item.pest_name }
                      })
                      while (grid.length < cells) grid.push(null)
                      return (<>{kpiCards}<div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2 }}>
                            {grid.map((cell, i) => (
                              <div key={i} style={{ width: 24, height: 24, borderRadius: 3, background: cell ? ISSUE_PALETTE[cell.idx % ISSUE_PALETTE.length] + 'cc' : '#f0ede6' }} />
                            ))}
                          </div>
                          <p style={{ fontSize: 9, color: '#8a95a0', fontFamily: 'monospace', margin: '6px 0 0' }}>Each square ≈ 1% of fruit</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {sorted.map((item, i) => (
                            <div key={item.pest_id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: ISSUE_PALETTE[i % ISSUE_PALETTE.length], flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: '#3a4a40' }}>{item.pest_name}</span>
                              <span style={{ fontSize: 10, color: '#8a95a0', fontFamily: 'monospace', marginLeft: 'auto' }}>{item.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div></>)
                    })() : (
                      <div style={s.loading}>No QC issue data</div>
                    )}
                  </div>
                </div>
            </div>

            </>
              )
            })()}

            {/* Orchard summary table */}
            <div style={{ ...s.card, marginBottom: 24 }} className="prod-desktop-only">
              <div style={s.cardHeader}><span style={s.cardTitle}>Orchard Summary</span></div>
              <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }} className="prod-orchard-table">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f7f5f0', position: 'sticky' as const, top: 0, zIndex: 1 }}>
                      {([
                        ['name', 'Orchard'], ['variety', 'Variety'], ['ha', 'Ha'],
                        ['bins', 'Bins'], ['juice', 'Juice'], ['total', 'Total'],
                        ['tons', 'Tons'], ['tonHa', 'T/Ha'], ['binWeight', 'Wt (kg)'],
                      ] as [SortKey, string][]).map(([key, label]) => (
                        <th key={key} onClick={() => handleSort(key)} style={{ padding: '10px 8px', textAlign: key === 'name' || key === 'variety' ? 'left' : 'right', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e8e4dc', whiteSpace: 'nowrap', userSelect: 'none' }}>
                          {label}{sortIcon(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrchards.map((o, i) => (
                      <tr
                        key={o.orchard_id || i}
                        onClick={() => setSelectedOrchardId(o.orchard_id)}
                        style={{ borderBottom: '1px solid #f0ede6', cursor: 'pointer', background: selectedOrchardId === o.orchard_id ? '#f0f4fa' : 'transparent' }}
                        onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = selectedOrchardId === o.orchard_id ? '#f0f4fa' : '#fafaf6' }}
                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = selectedOrchardId === o.orchard_id ? '#f0f4fa' : 'transparent' }}
                      >
                        <td style={{ padding: '9px 8px', fontWeight: 500 }}>{o.name}</td>
                        <td style={{ padding: '9px 8px', color: '#6a7a70' }}>{o.variety || '–'}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: '#6a7a70' }}>{o.ha?.toFixed(1) ?? '–'}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right' }}>{o.bins}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: '#b58a00' }}>{o.juice || '–'}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 600 }}>{o.total}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right' }}>{o.tons}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 600, color: tonHaColor(o.tonHa) }}>{o.tonHa?.toFixed(1) ?? '–'}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', color: '#6a7a70' }}>{o.binWeight}</td>
                      </tr>
                    ))}
                    {sortedOrchards.length === 0 && (
                      <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#8a95a0' }}>No data for this season</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile: Top 5 orchards compact list */}
            <div className="prod-mobile-only" style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 10 }}>Top Orchards</div>
              {topOrchards.length > 0 ? topOrchards.map((o, i) => (
                <div key={o.orchard_id || i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: '1px solid #f0ede6',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a' }}>{o.name}</div>
                    <div style={{ fontSize: 11, color: '#8a95a0' }}>
                      {[o.variety, o.ha ? `${o.ha.toFixed(1)} ha` : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a' }}>{o.total} bins</div>
                    {o.tonHa != null && (
                      <div style={{ fontSize: 11, fontWeight: 600, color: tonHaColor(o.tonHa) }}>{o.tonHa.toFixed(1)} t/ha</div>
                    )}
                  </div>
                </div>
              )) : (
                <div style={{ fontSize: 13, color: '#8a95a0', padding: '12px 0' }}>No data</div>
              )}
            </div>

            {/* Quality Summary — desktop: always visible */}
            <div className="prod-desktop-only">
              <BruisingQualityPanel bruisingData={filteredBruising} bruisingSummary={bruisingSummary} />
            </div>

            {/* ── Mobile collapsible panels ───────────────────────── */}

            {/* Mobile: Quality Summary (collapsible) */}
            <div className="prod-mobile-only" style={{ marginBottom: 16 }}>
              <button
                onClick={() => setQualityOpen(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: '#fff', borderRadius: 14,
                  border: '1px solid #e8e4dc', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>Quality by Team</span>
                <span style={{ fontSize: 18, color: '#8a95a0', transform: qualityOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9662;</span>
              </button>
              {qualityOpen && (
                <div style={{ marginTop: 8 }}>
                  <BruisingQualityPanel bruisingData={filteredBruising} bruisingSummary={bruisingSummary} />
                </div>
              )}
            </div>

            {/* Mobile: Size Distribution (collapsible) */}
            <div className="prod-mobile-only" style={{ marginBottom: 16 }}>
              <button
                onClick={() => setSizeOpen(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: '#fff', borderRadius: 14,
                  border: '1px solid #e8e4dc', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>Size Distribution</span>
                  <span style={{ fontSize: 10, background: '#4caf72', color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace', fontWeight: 700 }}>QC</span>
                </div>
                <span style={{ fontSize: 18, color: '#8a95a0', transform: sizeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9662;</span>
              </button>
              {sizeOpen && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', marginTop: 8, padding: '16px' }}>
                  {qcLoading ? (
                    <div style={{ textAlign: 'center', padding: 16, color: '#8a95a0', fontSize: 13 }}>Loading QC data...</div>
                  ) : sizePctData.length > 0 ? (() => {
                    const byOrder = [...sizePctData].sort((a, b) => a.display_order - b.display_order)
                    const maxPct = Math.max(...byOrder.map(b => b.pct), 1)
                    return (
                      <div>
                        {byOrder.map((item, i) => (
                          <div key={item.bin_label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ width: 70, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#1a2a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.bin_label}</span>
                            <div style={{ flex: 1, position: 'relative', height: 22, background: '#f0ede6', borderRadius: 3 }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(item.pct / maxPct) * 100}%`, background: SIZE_PALETTE[i % SIZE_PALETTE.length], borderRadius: 3, transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: SIZE_PALETTE[i % SIZE_PALETTE.length], fontFamily: 'monospace', width: 40, textAlign: 'right', flexShrink: 0 }}>{item.pct}%</span>
                          </div>
                        ))}
                        <div style={{ fontSize: 11, color: '#8a95a0', marginTop: 8 }}>{totalFruitSampled.toLocaleString('en-ZA')} fruit sampled</div>
                      </div>
                    )
                  })() : (
                    <div style={{ textAlign: 'center', padding: 16, color: '#8a95a0', fontSize: 13 }}>No QC size data</div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile: QC Issues (collapsible) */}
            <div className="prod-mobile-only" style={{ marginBottom: 16 }}>
              <button
                onClick={() => setIssuesOpen(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: '#fff', borderRadius: 14,
                  border: '1px solid #e8e4dc', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a' }}>QC Issues</span>
                  <span style={{ fontSize: 10, background: '#e85a4a', color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace', fontWeight: 700 }}>DEFECTS</span>
                </div>
                <span style={{ fontSize: 18, color: '#8a95a0', transform: issuesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9662;</span>
              </button>
              {issuesOpen && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', marginTop: 8, padding: '16px' }}>
                  {qcLoading ? (
                    <div style={{ textAlign: 'center', padding: 16, color: '#8a95a0', fontSize: 13 }}>Loading QC data...</div>
                  ) : issuePctData.length > 0 ? (() => {
                    const sorted = [...issuePctData].sort((a, b) => b.pct - a.pct)
                    const maxPct = sorted[0]?.pct || 1
                    return (
                      <div>
                        {sorted.map((item, i) => (
                          <div key={item.pest_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ width: 85, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#1a2a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.pest_name}</span>
                            <div style={{ flex: 1, position: 'relative', height: 22, background: '#f0ede6', borderRadius: 3 }}>
                              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(item.pct / maxPct) * 100}%`, background: ISSUE_PALETTE[i % ISSUE_PALETTE.length], borderRadius: 3, transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: ISSUE_PALETTE[i % ISSUE_PALETTE.length], fontFamily: 'monospace', width: 40, textAlign: 'right', flexShrink: 0 }}>{item.pct}%</span>
                          </div>
                        ))}
                      </div>
                    )
                  })() : (
                    <div style={{ textAlign: 'center', padding: 16, color: '#8a95a0', fontSize: 13 }}>No QC issue data</div>
                  )}
                </div>
              )}
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }} className="prod-charts prod-desktop-only">
              {/* Ton/Ha Bar Chart */}
              <div style={s.card}>
                <div style={s.cardHeader}><span style={s.cardTitle}>Ton/Ha by Orchard</span></div>
                <div style={{ ...s.cardBody, height: Math.max(300, tonHaData.length * 28 + 40) }} className="prod-card-body">
                  {tonHaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tonHaData} layout="vertical" margin={{ left: 100, right: 30, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#8a95a0' }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#3a4a40' }} width={90} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="tonHa" name="Ton/Ha" radius={[0, 4, 4, 0]} maxBarSize={20}>
                          {tonHaData.map((d, i) => (
                            <Cell key={i} fill={tonHaColor(d.tonHa)} />
                          ))}
                          <LabelList dataKey="tonHa" position="right" style={{ fontSize: 10, fill: '#6a7a70' }} formatter={(v: any) => v != null ? Number(v).toFixed(1) : ''} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={s.loading}>No orchards with hectare data</div>
                  )}
                </div>
              </div>

              {/* Weekly Production Trend */}
              <div style={s.card}>
                <div style={s.cardHeader}><span style={s.cardTitle}>Weekly Production</span></div>
                <div style={{ ...s.cardBody, height: 340 }} className="prod-card-body">
                  {weeklyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyTrend} margin={{ left: 10, right: 30, top: 10, bottom: 10 }} stackOffset="none">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a95a0' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#8a95a0' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        {weekCommodities.map((comm, i) => {
                          const colors = ['#2176d9', '#e8924a', '#6b7fa8', '#e8c44a', '#9b6bb5', '#c4744a', '#4a9e6b', '#e85a4a']
                          const color = colors[i % colors.length]
                          return <Area key={comm} type="monotone" dataKey={comm} name={comm} stroke={color} fill={color} fillOpacity={0.25} stackId="1" />
                        })}
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={s.loading}>No weekly data available</div>
                  )}
                </div>
              </div>
            </div>
          </>

      </main>

      <style>{`
        .prod-tooltip {
          background: #1a2a3a !important;
          color: #e8f0e0 !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
          font-size: 12px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
        }
        .prod-tooltip::before { display: none !important; }

        /* ===== Mobile visibility toggles ===== */
        .prod-mobile-only { display: none; }
        .prod-desktop-only { /* visible by default */ }

        @media (max-width: 768px) {
          .prod-mobile-only { display: block !important; }
          .prod-mobile-topbar { display: flex !important; }
          .prod-desktop-only { display: none !important; }
          .prod-date-filter { display: none !important; }
          .prod-heatmap-wrap { display: none !important; }

          .prod-main {
            padding: 0 14px 80px 14px !important;
            padding-top: calc(56px + env(safe-area-inset-top, 0px)) !important;
            background: #fff !important;
          }
          .prod-filters {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            -webkit-overflow-scrolling: touch !important;
            margin-bottom: 16px !important;
          }
          .prod-filters > * { flex-shrink: 0 !important; }
          .prod-card-body { padding: 12px 16px !important; }
        }

        @media (max-width: 480px) {
          .prod-kpi-strip { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 1024px) {
          main > div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

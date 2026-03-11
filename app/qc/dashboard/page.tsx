'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import { useOrgModules } from '@/lib/useOrgModules'

// ── Types ──────────────────────────────────────────────────────────────────

interface KpiData {
  bags_collected: number
  bags_sampled: number
  fruit_weighed: number
  avg_weight_g: number
  issue_rate_pct: number
  class_1_pct: number
}

interface SizeBin {
  bin_label: string
  display_order: number
  fruit_count: number
  pct_of_total: number
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

interface BagRow {
  session_id: string
  bag_seq: number | null
  collected_at: string
  orchard_name: string
  commodity_name: string
  commodity_id: string
  employee_name: string
  fruit_count: number
  avg_weight_g: number | null
  issue_count: number
  status: string
}

interface BagDetail {
  session: {
    id: string
    orchard_name: string
    employee_name: string
    collected_at: string
    sampled_at: string | null
    bag_seq: number | null
    collection_lat: number | null
    collection_lng: number | null
    status: string
  }
  fruit: Array<{ seq: number; weight_g: number; bin_label: string | null }>
  issues: Array<{ pest_name: string; pest_name_af: string; category: string; count: number }>
}

interface Farm { id: string; name: string }
interface Commodity { id: string; name: string }

interface PickerIssueRow {
  employee_name: string
  pest_id: string
  pest_name: string
  category: string
  total_count: number
  bags_affected: number
  fruit_sampled: number
}

type DateFilter = 'today' | 'this_week' | 'last_7' | 'this_month' | 'season' | 'custom'
type Lang = 'en' | 'af'

// ── Season helpers ──────────────────────────────────────────────────────────

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

function getSeasonRange(season: string): { from: Date; to: Date } {
  const startYr = parseInt(season.split('/')[0])
  return {
    from: new Date(startYr, 7, 1),     // Aug 1
    to:   new Date(startYr + 1, 6, 31), // Jul 31
  }
}

// ── Date helpers ────────────────────────────────────────────────────────────

function getDateRange(filter: DateFilter, season?: string, customDate?: string): { from: Date; to: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)

  if (filter === 'today') return { from: today, to: tomorrow }

  if (filter === 'custom' && customDate) {
    const [y, m, d] = customDate.split('-').map(Number)
    const day = new Date(y, m - 1, d)
    return { from: day, to: new Date(day.getTime() + 86400000) }
  }

  if (filter === 'this_week') {
    const dow = (today.getDay() + 6) % 7 // Mon = 0
    const monday = new Date(today.getTime() - dow * 86400000)
    const nextMonday = new Date(monday.getTime() + 7 * 86400000)
    return { from: monday, to: nextMonday }
  }

  if (filter === 'last_7') {
    return { from: new Date(today.getTime() - 6 * 86400000), to: tomorrow }
  }

  if (filter === 'season' && season) {
    return getSeasonRange(season)
  }

  // this_month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: monthStart, to: monthEnd }
}

function fmtDateFilter(filter: DateFilter, season?: string, customDate?: string): string {
  if (filter === 'today') return 'Today'
  if (filter === 'custom' && customDate) {
    const d = new Date(customDate + 'T00:00:00')
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  if (filter === 'this_week') {
    const { from, to } = getDateRange(filter)
    const end = new Date(to.getTime() - 1)
    return `${from.getDate()} – ${end.getDate()} ${end.toLocaleString('en-ZA', { month: 'short' })}`
  }
  if (filter === 'last_7') return 'Last 7 days'
  if (filter === 'season' && season) return `Season ${season}`
  const { from } = getDateRange(filter)
  return from.toLocaleString('en-ZA', { month: 'long', year: 'numeric' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Picker perf (computed client-side from bag list) ─────────────────────

interface PickerRow {
  name: string
  bags: number
  fruit: number
  avgWeight: number | null
  issueRate: number
  topIssue: string
  totalIssues: number
  totalFruitForAvg: number
  totalWeightSum: number
  issueBags: number
}

// ── Colour helpers ──────────────────────────────────────────────────────────

function issueRateColor(rate: number): string {
  if (rate < 15) return '#4caf72'
  if (rate < 30) return '#f5c842'
  return '#e85a4a'
}

// ── Inline styles ───────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:        { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
  main:        { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0 },
  pageHeader:  { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle:   { fontSize: 32, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px', lineHeight: 1 },
  pageSub:     { fontSize: 14, color: '#8a95a0', marginTop: 6 },
  filters:     { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 28 },
  filterGroup: { display: 'flex', gap: 6 },
  pill:        { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:  { padding: '6px 14px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  divider:     { width: 1, height: 24, background: '#d4cfca' },
  // KPI strip
  kpiStrip:    { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 28 },
  kpiCard:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative', overflow: 'hidden' },
  kpiAccent:   { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2176d9, #a0c4f0)' },
  kpiLabel:    { fontSize: 12, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  kpiValue:    { fontSize: 36, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 },
  kpiSub:      { fontSize: 12, color: '#8a95a0', marginTop: 6 },
  // Cards
  card:        { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader:  { padding: '20px 24px 16px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:   { fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
  cardBody:    { padding: '20px 24px' },
  // Table
  tableHead:   { display: 'grid', gap: 8, padding: '10px 16px', background: '#f7f5f0', borderBottom: '1px solid #e8e4dc', fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', alignItems: 'center' },
  tableRow:    { display: 'grid', gap: 8, padding: '11px 16px', borderBottom: '1px solid #f0ede6', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' },
  // Slide-out panel
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100 },
  panel:       { position: 'fixed', right: 0, top: 0, bottom: 0, width: 440, background: '#fff', zIndex: 101, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  panelHead:   { padding: '20px 24px', borderBottom: '1px solid #e8e4dc', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  panelBody:   { padding: '20px 24px', flex: 1, overflowY: 'auto' },
  closeBtn:    { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8a95a0', lineHeight: 1, padding: 4 },
  // Progress bar
  progBg:      { flex: 1, height: 6, background: '#f0ede6', borderRadius: 3, overflow: 'hidden' },
  progFill:    { height: '100%', borderRadius: 3, transition: 'width 0.6s ease' },
  // Issue category badge
  badgePicking:{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#fffbe6', color: '#7a5c00', border: '1px solid #f5c842' },
  badgeQc:     { padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#fff5f4', color: '#8a2020', border: '1px solid #e85a4a' },
  loading:     { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#8a95a0', fontSize: 14 },
}

// ── Custom tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a2a3a', color: '#e8f0e0', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  )
}

// ── Picker sort ─────────────────────────────────────────────────────────────

type PickerSort = 'name' | 'bags' | 'fruit' | 'avgWeight' | 'issueRate'

// ── Page ────────────────────────────────────────────────────────────────────

export default function QcDashboardPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, orgId } = useUserContext()
  const modules = useOrgModules()

  const [allFarms, setAllFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [commodities, setCommodities] = useState<Commodity[]>([])

  const effectiveFarmIds = useMemo(() => {
    if (selectedFarmId) return [selectedFarmId]
    return allFarms.map(f => f.id)
  }, [allFarms, selectedFarmId])

  // Before 08:00 SAST → default to yesterday so morning team briefing shows previous day
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
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
  const [season, setSeason] = useState<string>(getCurrentSeason())
  const [commodityId, setCommodityId] = useState<string | null>(null)
  const [variety, setVariety] = useState<string | null>(null)
  const [orchardId, setOrchardId] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>('en')

  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [sizeData, setSizeData] = useState<SizeBin[]>([])
  const [issueData, setIssueData] = useState<IssueRow[]>([])
  const [bagList, setBagList] = useState<BagRow[]>([])

  const [unknownQcCount, setUnknownQcCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedBagId, setSelectedBagId] = useState<string | null>(null)
  const [bagDetail, setBagDetail] = useState<BagDetail | null>(null)

  // Orchard edit state
  const [allOrchards, setAllOrchards] = useState<{ id: string; name: string; variety: string | null; commodity_id: string; farm_id: string }[]>([])

  // Unique varieties for the selected commodity
  const varieties = useMemo(() => {
    if (!commodityId) return []
    const vs = allOrchards
      .filter(o => o.commodity_id === commodityId && o.variety)
      .map(o => o.variety!)
    return [...new Set(vs)].sort()
  }, [allOrchards, commodityId])

  // Filter orchards by selected farm + commodity + variety
  const filteredOrchards = useMemo(() => {
    let filtered = allOrchards
    if (selectedFarmId) filtered = filtered.filter(o => o.farm_id === selectedFarmId)
    if (commodityId) filtered = filtered.filter(o => o.commodity_id === commodityId)
    if (variety) filtered = filtered.filter(o => o.variety === variety)
    return filtered
  }, [allOrchards, selectedFarmId, commodityId, variety])

  // Reset variety + orchard when commodity changes
  useEffect(() => {
    setVariety(null)
    if (orchardId && commodityId) {
      const match = allOrchards.find(o => o.id === orchardId)
      if (match && match.commodity_id !== commodityId) setOrchardId(null)
    }
  }, [commodityId])

  // Reset orchard when variety changes and current orchard doesn't match
  useEffect(() => {
    if (orchardId && variety) {
      const match = allOrchards.find(o => o.id === orchardId)
      if (match && match.variety !== variety) setOrchardId(null)
    }
  }, [variety])

  const [editingOrchard, setEditingOrchard] = useState(false)
  const [newOrchardId, setNewOrchardId] = useState('')
  const [savingOrchard, setSavingOrchard] = useState(false)

  const [issueView, setIssueView] = useState<'bars' | 'bubbles' | 'waffle'>('bars')
  const [pickerSort, setPickerSort] = useState<PickerSort>('issueRate')
  const [pickerSortDir, setPickerSortDir] = useState<'asc' | 'desc'>('desc')

  const [pickerBreakdown, setPickerBreakdown] = useState<PickerIssueRow[]>([])
  const [pickerMetricsOpen, setPickerMetricsOpen] = useState(true)
  const [top5Open, setTop5Open] = useState(true)

  const [bagPage, setBagPage] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [bagListOpen, setBagListOpen] = useState(false)
  const PAGE_SIZE = 50

  // Load farms on mount
  useEffect(() => {
    if (!contextLoaded) return
    async function init() {
      const q = supabase.from('farms').select('id, full_name').eq('is_active', true).order('full_name')
      const { data } = isSuperAdmin ? await q : await q.in('id', farmIds)
      const farms: Farm[] = (data || []).map((f: any) => ({ id: f.id, name: f.full_name }))
      setAllFarms(farms)
      const ids = farms.map(f => f.id)

      // Commodities with QC/picking issues configured — this is the source of truth
      // for which commodities make sense to filter by in this dashboard.
      const { data: cpData } = await supabase
        .from('commodity_pests')
        .select('commodities(id, name)')
        .in('category', ['qc_issue', 'picking_issue'])
        .eq('is_active', true)
      const seen = new Set<string>()
      const comms: Commodity[] = []
      for (const row of (cpData || []) as any[]) {
        const c = row.commodities
        if (c && !seen.has(c.id)) { seen.add(c.id); comms.push(c) }
      }
      comms.sort((a, b) => a.name.localeCompare(b.name))
      setCommodities(comms)

      // Load orchards for filter dropdown
      const oq = supabase.from('orchards').select('id, name, variety, commodity_id, farm_id').eq('is_active', true).order('name')
      const { data: orchData } = ids.length > 0 ? await oq.in('farm_id', ids) : await oq
      setAllOrchards((orchData || []) as { id: string; name: string; variety: string | null; commodity_id: string; farm_id: string }[])

      // Count unresolved unknown QC issues
      if (ids.length > 0) {
        supabase.rpc('get_unknown_qc_issues', { p_farm_ids: ids })
          .then(({ data }) => {
            setUnknownQcCount((data ?? []).filter((i: any) => !i.resolved_pest_id).length)
          }, () => {})
      }
    }
    init()
  }, [contextLoaded])

  // Fetch data when farms or filters change
  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    fetchAll()
  }, [effectiveFarmIds, dateFilter, customDate, season, commodityId, variety, orchardId, selectedFarmId])

  async function fetchAll() {
    setLoading(true)
    setBagPage(0)
    const { from, to } = getDateRange(dateFilter, season, customDate)
    const fromIso = from.toISOString()
    const toIso   = to.toISOString()

    const [kpisRes, sizeRes, issueRes, bagRes, pickerIssueRes] = await Promise.all([
      supabase.rpc('get_qc_dashboard_kpis', {
        p_farm_ids:     effectiveFarmIds,
        p_from:         fromIso,
        p_to:           toIso,
        p_commodity_id: commodityId ?? null,
        p_orchard_id:   orchardId ?? null,
        p_variety:      variety ?? null,
      }),
      supabase.rpc('get_qc_size_distribution', {
        p_farm_ids:     effectiveFarmIds,
        p_from:         fromIso,
        p_to:           toIso,
        p_commodity_id: commodityId ?? null,
        p_orchard_id:   orchardId ?? null,
        p_variety:      variety ?? null,
      }),
      supabase.rpc('get_qc_issue_breakdown', {
        p_farm_ids:     effectiveFarmIds,
        p_from:         fromIso,
        p_to:           toIso,
        p_commodity_id: commodityId ?? null,
        p_orchard_id:   orchardId ?? null,
        p_variety:      variety ?? null,
      }),
      supabase.rpc('get_qc_bag_list', {
        p_farm_ids:     effectiveFarmIds,
        p_from:         fromIso,
        p_to:           toIso,
        p_commodity_id: commodityId ?? null,
        p_orchard_id:   orchardId ?? null,
        p_variety:      variety ?? null,
      }),
      supabase.rpc('get_qc_picker_issue_breakdown', {
        p_farm_ids:     effectiveFarmIds,
        p_from:         fromIso,
        p_to:           toIso,
        p_commodity_id: commodityId ?? null,
        p_orchard_id:   orchardId ?? null,
        p_variety:      variety ?? null,
      }),
    ])

    if (issueRes.error) console.error('[QC Dashboard] issue_breakdown error:', JSON.stringify(issueRes.error))
    if (kpisRes.error) console.error('[QC Dashboard] kpis error:', JSON.stringify(kpisRes.error))

    setKpis((kpisRes.data as KpiData) || null)
    const rawSize = (sizeRes.data as SizeBin[]) || []
    const totalFruit = rawSize.reduce((sum, b) => sum + Number(b.fruit_count), 0)
    setSizeData(rawSize.map(b => ({
      ...b,
      pct_of_total: totalFruit > 0 ? Math.round(Number(b.fruit_count) / totalFruit * 1000) / 10 : 0,
    })))
    setIssueData(((issueRes.data as IssueRow[]) || []).filter(r => r.category !== 'picking_issue'))
    setPickerBreakdown((pickerIssueRes.data as PickerIssueRow[]) || [])

    const bags = (bagRes.data as BagRow[]) || []
    setBagList(bags)
    setLoading(false)
  }

  // Fetch bag detail
  async function openBag(sessionId: string) {
    setSelectedBagId(sessionId)
    setBagDetail(null)
    setEditingOrchard(false)
    setNewOrchardId('')
    setDetailLoading(true)
    const { data } = await supabase.rpc('get_qc_bag_detail', { p_session_id: sessionId })
    setBagDetail(data as BagDetail)
    setDetailLoading(false)
  }

  async function saveOrchardChange() {
    if (!selectedBagId || !newOrchardId) return
    setSavingOrchard(true)
    try {
      const res = await fetch('/api/qc/bag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: selectedBagId, orchard_id: newOrchardId }),
      })
      if (res.ok) {
        // Refresh detail + bag list
        openBag(selectedBagId)
        fetchAll()
      }
    } finally {
      setSavingOrchard(false)
      setEditingOrchard(false)
    }
  }

  // Picker performance (computed)
  const pickerRows = useMemo<PickerRow[]>(() => {
    const map = new Map<string, PickerRow>()
    const issueCountByPicker = new Map<string, Map<string, number>>()

    for (const bag of bagList) {
      if (!map.has(bag.employee_name)) {
        map.set(bag.employee_name, {
          name: bag.employee_name, bags: 0, fruit: 0,
          avgWeight: null, issueRate: 0, topIssue: '—',
          totalIssues: 0, totalFruitForAvg: 0, totalWeightSum: 0, issueBags: 0,
        })
        issueCountByPicker.set(bag.employee_name, new Map())
      }
      const r = map.get(bag.employee_name)!
      r.bags++
      r.fruit += Number(bag.fruit_count) || 0
      if (bag.avg_weight_g && bag.fruit_count > 0) {
        r.totalWeightSum  += bag.avg_weight_g * Number(bag.fruit_count)
        r.totalFruitForAvg += Number(bag.fruit_count)
      }
      if (bag.status === 'sampled' && Number(bag.issue_count) > 0) r.issueBags++
    }

    // Compute derived fields
    const rows: PickerRow[] = []
    map.forEach((r, name) => {
      r.avgWeight = r.totalFruitForAvg > 0 ? Math.round(r.totalWeightSum / r.totalFruitForAvg) : null
      const sampledBags = bagList.filter(b => b.employee_name === name && b.status === 'sampled').length
      r.issueRate = sampledBags > 0 ? Math.round(r.issueBags / sampledBags * 100) : 0
      rows.push(r)
    })

    // Sort
    rows.sort((a, b) => {
      let av: number, bv: number
      switch (pickerSort) {
        case 'bags':      av = a.bags;      bv = b.bags;      break
        case 'fruit':     av = a.fruit;     bv = b.fruit;     break
        case 'avgWeight': av = a.avgWeight ?? 0; bv = b.avgWeight ?? 0; break
        case 'issueRate': av = a.issueRate;  bv = b.issueRate;  break
        default:          return pickerSortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      }
      return pickerSortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [bagList, pickerSort, pickerSortDir])

  // Picker issue metrics: per-picker aggregate from breakdown data
  const pickerIssueMetrics = useMemo(() => {
    const map = new Map<string, { name: string; totalIssues: number; pickingIssues: number; qcIssues: number; bagsAffected: Set<string> }>()
    for (const r of pickerBreakdown) {
      if (!map.has(r.employee_name)) {
        map.set(r.employee_name, { name: r.employee_name, totalIssues: 0, pickingIssues: 0, qcIssues: 0, bagsAffected: new Set() })
      }
      const m = map.get(r.employee_name)!
      m.totalIssues += r.total_count
      if (r.category === 'picking_issue') m.pickingIssues += r.total_count
      else m.qcIssues += r.total_count
      // bags_affected is per-issue — use max as a rough indicator
    }
    const rows = [...map.values()]
      .map(m => ({ name: m.name, totalIssues: m.totalIssues, pickingIssues: m.pickingIssues, qcIssues: m.qcIssues }))
    rows.sort((a, b) => b.totalIssues - a.totalIssues)
    return rows
  }, [pickerBreakdown])

  // Top 5 worst pickers per picking issue type
  const top5ByIssue = useMemo(() => {
    const picking = pickerBreakdown.filter(r => r.category === 'picking_issue')
    const byPest = new Map<string, { pest_name: string; pickers: { name: string; count: number; pct: number }[] }>()
    for (const r of picking) {
      if (!byPest.has(r.pest_id)) byPest.set(r.pest_id, { pest_name: r.pest_name, pickers: [] })
      const pct = r.fruit_sampled > 0 ? (r.total_count / r.fruit_sampled) * 100 : 0
      byPest.get(r.pest_id)!.pickers.push({ name: r.employee_name, count: r.total_count, pct })
    }
    const result: { pest_id: string; pest_name: string; pickers: { name: string; count: number; pct: number }[] }[] = []
    byPest.forEach((v, k) => {
      v.pickers.sort((a, b) => b.pct - a.pct)
      result.push({ pest_id: k, pest_name: v.pest_name, pickers: v.pickers.slice(0, 5) })
    })
    result.sort((a, b) => {
      const ta = a.pickers.reduce((sum, p) => sum + p.pct, 0)
      const tb = b.pickers.reduce((sum, p) => sum + p.pct, 0)
      return tb - ta
    })
    return result
  }, [pickerBreakdown])

  function toggleSort(col: PickerSort) {
    if (pickerSort === col) setPickerSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setPickerSort(col); setPickerSortDir('desc') }
  }
  function sortIcon(col: PickerSort) {
    if (pickerSort !== col) return ' ↕'
    return pickerSortDir === 'asc' ? ' ↑' : ' ↓'
  }

  // Paginated bag list
  const pagedBags = bagList.slice(bagPage * PAGE_SIZE, (bagPage + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(bagList.length / PAGE_SIZE)

  // Issue breakdown colors
  const BAR_PICKING = '#f5c842'
  const BAR_QC      = '#e85a4a'
  const BAR_SIZE    = '#4caf72'
  const ISSUE_PALETTE = [
    '#c0392b', '#e74c3c', '#e8604c', '#f0876a',
    '#f5a58a', '#f9c3ab', '#fddecf',
    '#d35400', '#e67e22', '#f39c12', '#f1c40f', '#a8d8a8',
    '#6b7fa8', '#8a95a0', '#c8c4bb',
  ]

  return (
    <div style={s.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />

      {/* Main */}
      <main style={s.main}>
        {/* Page header */}
        <div style={s.pageHeader}>
          <div>
            <div style={s.pageTitle}>QC Dashboard</div>
            <div style={s.pageSub}>Bag sample quality data</div>
          </div>
        </div>

        {/* Unknown QC issues banner */}
        {unknownQcCount > 0 && (
          <a
            href="/qc/unknowns"
            style={{
              display: 'block', background: '#fffbeb', border: '1.5px solid #fde68a',
              borderRadius: 12, padding: '14px 20px', marginBottom: 16,
              textDecoration: 'none', color: '#92400e',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>📷</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {unknownQcCount} Unknown QC {unknownQcCount === 1 ? 'Issue' : 'Issues'} Need Review
                  </div>
                  <div style={{ fontSize: 12, color: '#b45309' }}>
                    QC workers flagged unidentified defects — click to classify
                  </div>
                </div>
              </div>
              <span style={{ color: '#d97706', fontSize: 18 }}>→</span>
            </div>
          </a>
        )}

        {/* Filters */}
        <div style={s.filters}>
          {/* Farm pills — only show if user has access to multiple farms */}
          {allFarms.length > 1 && (
            <>
              <div style={s.filterGroup}>
                <button
                  style={selectedFarmId === null ? s.pillActive : s.pill}
                  onClick={() => setSelectedFarmId(null)}
                >
                  All Farms
                </button>
                {allFarms.map(f => (
                  <button
                    key={f.id}
                    style={f.id === selectedFarmId ? s.pillActive : s.pill}
                    onClick={() => setSelectedFarmId(f.id)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
              <div style={s.divider} />
            </>
          )}

          {/* Date pills */}
          <div style={s.filterGroup}>
            {(['today', 'this_week', 'last_7', 'this_month'] as DateFilter[]).map(f => (
              <button
                key={f}
                style={dateFilter === f ? s.pillActive : s.pill}
                onClick={() => setDateFilter(f)}
              >
                {f === 'today' ? 'Today' : f === 'this_week' ? 'This Week' : f === 'last_7' ? 'Last 7 Days' : 'This Month'}
              </button>
            ))}
            <button
              style={dateFilter === 'season' ? s.pillActive : s.pill}
              onClick={() => setDateFilter('season')}
            >
              Season
            </button>
            {dateFilter === 'season' && (
              <select
                value={season}
                onChange={e => setSeason(e.target.value)}
                style={{
                  padding: '5px 10px', borderRadius: 20, border: '1.5px solid #2176d9',
                  background: '#2176d9', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {buildSeasonOptions(2023).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={dateFilter === 'custom' ? customDate : ''}
              onChange={e => { setCustomDate(e.target.value); setDateFilter('custom') }}
              style={{
                ...s.pill,
                ...(dateFilter === 'custom' ? { borderColor: '#2176d9', background: '#e8f0fa', color: '#2176d9', fontWeight: 600 } : {}),
                width: 130,
              }}
            />
          </div>

          <div style={s.divider} />

          {/* Commodity pills */}
          <div style={s.filterGroup}>
            <button
              style={commodityId === null ? s.pillActive : s.pill}
              onClick={() => setCommodityId(null)}
            >
              All
            </button>
            {commodities.map(c => (
              <button
                key={c.id}
                style={c.id === commodityId ? s.pillActive : s.pill}
                onClick={() => setCommodityId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Variety pills — only when commodity selected and varieties exist */}
          {commodityId && varieties.length > 1 && (
            <>
              <div style={s.divider} />
              <div style={s.filterGroup}>
                <button
                  style={variety === null ? s.pillActive : s.pill}
                  onClick={() => setVariety(null)}
                >
                  All varieties
                </button>
                {varieties.map(v => (
                  <button
                    key={v}
                    style={v === variety ? s.pillActive : s.pill}
                    onClick={() => setVariety(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={s.divider} />

          {/* Orchard dropdown */}
          <select
            value={orchardId ?? ''}
            onChange={e => setOrchardId(e.target.value || null)}
            style={{
              padding: '6px 12px', borderRadius: 20, border: '1.5px solid #e0ddd6',
              background: orchardId ? '#1a2a3a' : '#fff',
              color: orchardId ? '#fff' : '#3a4a40',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              maxWidth: 200,
            }}
          >
            <option value="">All Orchards</option>
            {filteredOrchards.map(o => (
              <option key={o.id} value={o.id}>{o.name}{o.variety ? ` (${o.variety})` : ''}</option>
            ))}
          </select>

          <div style={s.divider} />

          {/* Language toggle */}
          <div style={s.filterGroup}>
            {(['en', 'af'] as Lang[]).map(l => (
              <button key={l} style={lang === l ? s.pillActive : s.pill} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Strip ─────────────────────────────────────────────────── */}
        {loading ? (
          <div style={s.loading}>Loading data…</div>
        ) : (
          <>
            <div style={s.kpiStrip}>
              {/* Bags Collected */}
              <div style={s.kpiCard}>
                <div style={s.kpiAccent} />
                <div style={s.kpiLabel}>Bags Collected</div>
                <div style={s.kpiValue}>{kpis?.bags_collected ?? 0}</div>
                <div style={s.kpiSub}>{fmtDateFilter(dateFilter, season)}</div>
              </div>

              {/* Bags Sampled */}
              <div style={s.kpiCard}>
                <div style={s.kpiAccent} />
                <div style={s.kpiLabel}>Bags Sampled</div>
                <div style={s.kpiValue}>{kpis?.bags_sampled ?? 0}</div>
                {(kpis?.bags_collected ?? 0) > 0 && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <div style={s.progBg}>
                        <div style={{
                          ...s.progFill,
                          width: `${Math.round((kpis!.bags_sampled / kpis!.bags_collected) * 100)}%`,
                          background: '#4caf72',
                        }} />
                      </div>
                    </div>
                    <div style={s.kpiSub}>{Math.round((kpis!.bags_sampled / kpis!.bags_collected) * 100)}% coverage</div>
                  </>
                )}
              </div>

              {/* Fruit Weighed */}
              <div style={s.kpiCard}>
                <div style={s.kpiAccent} />
                <div style={s.kpiLabel}>Fruit Weighed</div>
                <div style={s.kpiValue}>{(kpis?.fruit_weighed ?? 0).toLocaleString()}</div>
                <div style={s.kpiSub}>pieces total</div>
              </div>

              {/* Avg Weight */}
              <div style={s.kpiCard}>
                <div style={s.kpiAccent} />
                <div style={s.kpiLabel}>Avg Weight</div>
                <div style={s.kpiValue}>{kpis?.avg_weight_g ?? 0}<span style={{ fontSize: 18, fontWeight: 400, color: '#8a95a0' }}>g</span></div>
                <div style={s.kpiSub}>per fruit</div>
              </div>

              {/* Issue Rate */}
              <div style={s.kpiCard}>
                <div style={{ ...s.kpiAccent, background: `linear-gradient(90deg, ${issueRateColor(kpis?.issue_rate_pct ?? 0)}, ${issueRateColor(kpis?.issue_rate_pct ?? 0)}88)` }} />
                <div style={s.kpiLabel}>Issue Rate</div>
                <div style={{ ...s.kpiValue, color: issueRateColor(kpis?.issue_rate_pct ?? 0) }}>
                  {kpis?.issue_rate_pct ?? 0}<span style={{ fontSize: 18, fontWeight: 400, color: '#8a95a0' }}>%</span>
                </div>
                <div style={s.kpiSub}>bags with ≥1 issue</div>
              </div>

              {/* Class 1 */}
              <div style={s.kpiCard}>
                <div style={{ ...s.kpiAccent, background: `linear-gradient(90deg, #2176d9, #a0c4f0)` }} />
                <div style={s.kpiLabel}>Class 1</div>
                <div style={{ ...s.kpiValue, color: (kpis?.class_1_pct ?? 0) >= 80 ? '#4caf72' : (kpis?.class_1_pct ?? 0) >= 60 ? '#f5c842' : '#e85a4a' }}>
                  {kpis?.class_1_pct ?? 0}<span style={{ fontSize: 18, fontWeight: 400, color: '#8a95a0' }}>%</span>
                </div>
                <div style={s.kpiSub}>fruit with no issues</div>
              </div>
            </div>

            {/* ── Size Distribution ─────────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitle}>
                  Size Distribution
                  {commodityId && commodities.find(c => c.id === commodityId) && (
                    <span style={{ fontSize: 13, fontWeight: 400, color: '#8a95a0', marginLeft: 10 }}>
                      — {commodities.find(c => c.id === commodityId)!.name}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#8a95a0' }}>
                  {sizeData.reduce((acc, b) => acc + Number(b.fruit_count), 0).toLocaleString()} fruit
                </div>
              </div>
              <div style={s.cardBody}>
                {sizeData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#8a95a0', padding: '24px 0' }}>No fruit data for this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={sizeData} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
                      <XAxis dataKey="bin_label" tick={{ fontSize: 11, fill: '#7a8a9a' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#7a8a9a' }} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="pct_of_total" name="%" radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="pct_of_total"
                          position="top"
                          formatter={(v: unknown) => (typeof v === 'number' && v > 0) ? `${v}%` : ''}
                          style={{ fontSize: 11, fill: '#5a6a60', fontWeight: 600 }}
                        />
                        {sizeData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.bin_label === 'Out of spec' ? '#e85a4a' : BAR_SIZE}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── Issue Breakdown ───────────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={s.cardTitle}>Issue Breakdown</div>
                  <span style={{ fontSize: 11, background: BAR_QC, color: 'white', padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>
                    QC REPORT
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {([['bars', 'Ranked Bars'], ['bubbles', 'Bubble Map'], ['waffle', 'Waffle']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setIssueView(key)} style={{
                      padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600,
                      background: issueView === key ? '#1a2a3a' : '#f0ede6',
                      color: issueView === key ? 'white' : '#6a7a70',
                      transition: 'all 0.15s',
                    }}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={s.cardBody}>
                {issueData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#8a95a0', padding: '24px 0' }}>No issues recorded in this period</div>
                ) : (() => {
                  const sorted = [...issueData].sort((a, b) => Number(b.pct_of_fruit) - Number(a.pct_of_fruit))
                  const totalPct = sorted.reduce((sum, r) => sum + Number(r.pct_of_fruit), 0)

                  /* ── Top 3 KPI cards ── */
                  const top3 = sorted.slice(0, 3)
                  const kpiCards = (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(top3.length, 3)}, 1fr)`, gap: 14, marginBottom: 20 }}>
                      {top3.map((issue, i) => (
                        <div key={issue.pest_id} style={{
                          background: '#fdf8f3', borderRadius: 10, padding: '14px 18px',
                          borderLeft: `4px solid ${ISSUE_PALETTE[i]}`,
                        }}>
                          <div style={{ fontSize: 10, color: '#8a95a0', fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}>
                            #{i + 1} Top Issue
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: ISSUE_PALETTE[i], fontFamily: 'monospace', margin: '4px 0 2px' }}>
                            {Number(issue.pct_of_fruit).toFixed(1)}%
                          </div>
                          <div style={{ fontSize: 14, color: '#1a2a3a', fontWeight: 600 }}>
                            {lang === 'af' ? issue.pest_name_af : issue.pest_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )

                  /* ── Ranked Bars view ── */
                  if (issueView === 'bars') {
                    const maxPct = Number(sorted[0]?.pct_of_fruit) || 1
                    return (
                      <>
                        {kpiCards}
                        <div style={{ padding: '4px 0' }}>
                          {sorted.map((issue, i) => {
                            const pct = Number(issue.pct_of_fruit)
                            const barW = (pct / maxPct) * 100
                            const name = lang === 'af' ? issue.pest_name_af : issue.pest_name
                            return (
                              <div key={issue.pest_id} style={{
                                display: 'grid', gridTemplateColumns: '130px 1fr 52px',
                                alignItems: 'center', gap: 12, marginBottom: 10,
                              }}>
                                <span style={{
                                  textAlign: 'right', fontSize: 12.5,
                                  fontWeight: i < 3 ? 700 : 400, color: i < 3 ? '#1a2a3a' : '#5a6a60',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {name}
                                </span>
                                <div style={{ position: 'relative', height: 28, background: '#f0ede6', borderRadius: 4 }}>
                                  <div style={{
                                    position: 'absolute', left: 0, top: 0, height: '100%',
                                    width: `${barW}%`,
                                    background: `linear-gradient(90deg, ${ISSUE_PALETTE[i % ISSUE_PALETTE.length]}dd, ${ISSUE_PALETTE[i % ISSUE_PALETTE.length]})`,
                                    borderRadius: 4,
                                    transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                                  }} />
                                  {i === 0 && barW < 85 && (
                                    <span style={{
                                      position: 'absolute', left: `${barW + 1.5}%`, top: '50%',
                                      transform: 'translateY(-50%)', fontSize: 9, color: ISSUE_PALETTE[0],
                                      fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'monospace',
                                    }}>{'\u2190'} TOP ISSUE</span>
                                  )}
                                </div>
                                <span style={{
                                  fontSize: 13, fontWeight: 700, color: ISSUE_PALETTE[i % ISSUE_PALETTE.length],
                                  fontFamily: 'monospace', textAlign: 'right',
                                }}>{pct.toFixed(1)}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )
                  }

                  /* ── Bubble Map view ── */
                  if (issueView === 'bubbles') {
                    const maxPct = Number(sorted[0]?.pct_of_fruit) || 1
                    const MAX_R = 90, MIN_R = 16
                    const bubbles = sorted.map((issue, i) => ({
                      ...issue,
                      r: Math.max(MIN_R, Math.sqrt(Number(issue.pct_of_fruit) / maxPct) * MAX_R),
                      color: ISSUE_PALETTE[i % ISSUE_PALETTE.length],
                      pct: Number(issue.pct_of_fruit),
                      label: lang === 'af' ? issue.pest_name_af : issue.pest_name,
                    }))
                    // Deterministic circle-pack: place largest at center, spiral outward
                    const placed: { cx: number; cy: number; r: number }[] = []
                    const W = 600, H = 400
                    const GAP = 4
                    const positions = bubbles.map((b, idx) => {
                      if (idx === 0) {
                        placed.push({ cx: W / 2, cy: H / 2, r: b.r })
                        return { cx: W / 2, cy: H / 2 }
                      }
                      // Try placing touching an existing circle, at various angles
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
                    return (
                      <>
                        {kpiCards}
                        <div style={{ position: 'relative', width: '100%', maxWidth: W, margin: '0 auto' }}>
                          <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                            {bubbles.map((b, i) => {
                              const { cx, cy } = positions[i]
                              return (
                                <g key={b.pest_id}>
                                  <circle cx={cx} cy={cy} r={b.r} fill={b.color} opacity={0.88}
                                    style={{ transition: 'all 0.3s' }} />
                                  {b.r > 26 && (
                                    <>
                                      <text x={cx} y={cy - 5} textAnchor="middle" fill="white"
                                        fontSize={b.r > 50 ? 12 : 9.5} fontWeight="700" style={{ pointerEvents: 'none' }}>
                                        {b.label}
                                      </text>
                                      <text x={cx} y={cy + 11} textAnchor="middle" fill="white"
                                        fontSize={b.r > 50 ? 13 : 9} fontFamily="monospace" opacity={0.9}
                                        style={{ pointerEvents: 'none' }}>
                                        {b.pct.toFixed(1)}%
                                      </text>
                                    </>
                                  )}
                                </g>
                              )
                            })}
                          </svg>
                          <div style={{ fontSize: 11, color: '#8a95a0', fontFamily: 'monospace' }}>
                            Bubble size {'\u221d'} issue frequency
                          </div>
                        </div>
                      </>
                    )
                  }

                  /* ── Waffle view ── */
                  const cells = 100
                  const grid: (null | { idx: number; name: string; pct: number })[] = []
                  let ci = 0
                  sorted.forEach((issue, i) => {
                    const count = Math.max(1, Math.round(Number(issue.pct_of_fruit)))
                    const name = lang === 'af' ? issue.pest_name_af : issue.pest_name
                    for (let j = 0; j < count && ci < cells; j++) {
                      grid[ci++] = { idx: i, name, pct: Number(issue.pct_of_fruit) }
                    }
                  })
                  while (grid.length < cells) grid.push(null)
                  return (
                    <>
                      {kpiCards}
                      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3, marginBottom: 10 }}>
                            {grid.map((cell, i) => (
                              <div key={i} style={{
                                width: 32, height: 32, borderRadius: 4,
                                background: cell ? (ISSUE_PALETTE[cell.idx % ISSUE_PALETTE.length] + 'cc') : '#f0ede6',
                                transition: 'all 0.15s',
                              }} />
                            ))}
                          </div>
                          <p style={{ fontSize: 10, color: '#8a95a0', fontFamily: 'monospace', margin: 0 }}>
                            Each square {'\u2248'} 1% of total issues
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {sorted.map((issue, i) => {
                            const name = lang === 'af' ? issue.pest_name_af : issue.pest_name
                            return (
                              <div key={issue.pest_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 2, background: ISSUE_PALETTE[i % ISSUE_PALETTE.length], flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: '#3a4a40' }}>{name}</span>
                                <span style={{ fontSize: 11, color: '#8a95a0', fontFamily: 'monospace', marginLeft: 'auto' }}>
                                  {Number(issue.pct_of_fruit).toFixed(1)}%
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )
                })()}

                {/* Footer insight */}
                {issueData.length >= 2 && (() => {
                  const sorted = [...issueData].sort((a, b) => Number(b.pct_of_fruit) - Number(a.pct_of_fruit))
                  const totalPct = sorted.reduce((sum, r) => sum + Number(r.pct_of_fruit), 0)
                  const top2Pct = (Number(sorted[0].pct_of_fruit) + Number(sorted[1].pct_of_fruit))
                  const top2Share = totalPct > 0 ? Math.round(top2Pct / totalPct * 100) : 0
                  const n1 = lang === 'af' ? sorted[0].pest_name_af : sorted[0].pest_name
                  const n2 = lang === 'af' ? sorted[1].pest_name_af : sorted[1].pest_name
                  return (
                    <div style={{
                      marginTop: 16, padding: '12px 18px', background: '#fdf8f3', borderRadius: 8,
                      border: '1px solid #f0e0cc', fontSize: 12, color: '#5a6a60', fontFamily: 'monospace',
                    }}>
                      <strong>{n1} + {n2}</strong> account for{' '}
                      <strong style={{ color: ISSUE_PALETTE[0] }}>{top2Share}%</strong>{' '}
                      of all recorded issues.
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* ── Picker Issue Metrics ─────────────────────────────────── */}
            <div style={s.card}>
              <div style={{ ...s.cardHeader, cursor: 'pointer' }} onClick={() => setPickerMetricsOpen(v => !v)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#8a95a0', transition: 'transform 0.2s', display: 'inline-block', transform: pickerMetricsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
                  <span style={s.cardTitle}>Picker Issue Metrics</span>
                </div>
                <div style={{ fontSize: 13, color: '#8a95a0' }}>{pickerIssueMetrics.length} pickers</div>
              </div>
              {!pickerMetricsOpen ? null : pickerIssueMetrics.length === 0 ? (
                <div style={{ ...s.cardBody, color: '#8a95a0' }}>No issue data in this period</div>
              ) : (
                <>
                  <div style={{ ...s.tableHead, gridTemplateColumns: '1.5fr 70px 90px 70px' }}>
                    <span>Picker</span>
                    <span>Total</span>
                    <span>Picking</span>
                    <span>QC</span>
                  </div>
                  {pickerIssueMetrics.map(r => (
                    <div key={r.name} style={{ ...s.tableRow, gridTemplateColumns: '1.5fr 70px 90px 70px', cursor: 'default' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: r.totalIssues > 0 ? '#e85a4a' : '#3a4a40' }}>{r.totalIssues}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, background: '#f0ede6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, background: '#f5c842', width: `${pickerIssueMetrics[0].totalIssues > 0 ? Math.round(r.pickingIssues / pickerIssueMetrics[0].totalIssues * 100) : 0}%` }} />
                        </div>
                        <span style={{ fontSize: 13, color: '#7a5c00', minWidth: 24 }}>{r.pickingIssues}</span>
                      </div>
                      <div style={{ fontSize: 14, color: r.qcIssues > 0 ? '#e85a4a' : '#3a4a40' }}>{r.qcIssues}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ── Top 5 Worst — Picking Issues ────────────────────────────── */}
            {top5ByIssue.length > 0 && (
              <div style={s.card}>
                <div style={{ ...s.cardHeader, cursor: 'pointer' }} onClick={() => setTop5Open(v => !v)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#8a95a0', transition: 'transform 0.2s', display: 'inline-block', transform: top5Open ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
                    <span style={s.cardTitle}>Top 5 Worst — Picking Issues</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#8a95a0' }}>{top5ByIssue.length} issue types</div>
                </div>
                {top5Open && (
                  <div style={s.cardBody}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(top5ByIssue.length, 3)}, 1fr)`, gap: 24 }}>
                      {top5ByIssue.map(issue => {
                        const maxPct = issue.pickers[0]?.pct || 1
                        return (
                          <div key={issue.pest_id}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #f5c842' }}>
                              {issue.pest_name}
                            </div>
                            {issue.pickers.map((pk, i) => (
                              <div key={pk.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: i === 0 ? '#e85a4a' : '#8a95a0', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0, position: 'relative', height: 28 }}>
                                  <div style={{
                                    position: 'absolute', top: 0, left: 0, bottom: 0,
                                    width: `${Math.round(pk.pct / maxPct * 100)}%`,
                                    background: i === 0 ? 'rgba(245,200,66,0.25)' : 'rgba(245,200,66,0.12)',
                                    borderRadius: 4,
                                  }} />
                                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '0 8px' }}>
                                    <span style={{ fontSize: 13, color: '#1a2a3a', fontWeight: i === 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {pk.name}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e85a4a', flexShrink: 0 }}>{pk.pct.toFixed(1)}%</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Picker Performance ────────────────────────────────────── */}
            <div style={s.card}>
              <div style={{ ...s.cardHeader, cursor: 'pointer' }} onClick={() => setPickerOpen(v => !v)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#8a95a0', transition: 'transform 0.2s', display: 'inline-block', transform: pickerOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <span style={s.cardTitle}>Picker Performance</span>
                </div>
                <div style={{ fontSize: 13, color: '#8a95a0' }}>{pickerRows.length} pickers</div>
              </div>
              {!pickerOpen ? null : pickerRows.length === 0 ? (
                <div style={{ ...s.cardBody, color: '#8a95a0' }}>No data</div>
              ) : (
                <>
                  <div style={{ ...s.tableHead, gridTemplateColumns: '1.5fr 60px 60px 80px' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('name')}>Picker{sortIcon('name')}</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('bags')}>Bags{sortIcon('bags')}</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('fruit')}>Fruit{sortIcon('fruit')}</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('avgWeight')}>Avg g{sortIcon('avgWeight')}</button>
                  </div>
                  {pickerRows.map(r => (
                    <div key={r.name} style={{ ...s.tableRow, gridTemplateColumns: '1.5fr 60px 60px 80px', cursor: 'default' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 14, color: '#3a4a40' }}>{r.bags}</div>
                      <div style={{ fontSize: 14, color: '#3a4a40' }}>{r.fruit.toLocaleString()}</div>
                      <div style={{ fontSize: 14, color: '#3a4a40' }}>{r.avgWeight ? `${r.avgWeight}g` : '—'}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ── Bag List ──────────────────────────────────────────────── */}
            <div style={s.card}>
              <div style={{ ...s.cardHeader, cursor: 'pointer' }} onClick={() => setBagListOpen(v => !v)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#8a95a0', transition: 'transform 0.2s', display: 'inline-block', transform: bagListOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <span style={s.cardTitle}>Bag List</span>
                </div>
                <div style={{ fontSize: 13, color: '#8a95a0' }}>{bagList.length} bags</div>
              </div>
              {!bagListOpen ? null : bagList.length === 0 ? (
                <div style={{ ...s.cardBody, color: '#8a95a0' }}>No bags in this period</div>
              ) : (
                <>
                  <div style={{ ...s.tableHead, gridTemplateColumns: '140px 60px 120px 140px 50px 60px 60px 80px' }}>
                    <div>Date</div>
                    <div>Bag #</div>
                    <div>Orchard</div>
                    <div>Picker</div>
                    <div>Fruit</div>
                    <div>Avg g</div>
                    <div>Issues</div>
                    <div>Status</div>
                  </div>
                  {pagedBags.map(bag => (
                    <div
                      key={bag.session_id}
                      style={{ ...s.tableRow, gridTemplateColumns: '140px 60px 120px 140px 50px 60px 60px 80px' }}
                      onClick={() => openBag(bag.session_id)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f7f5f0')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <div style={{ fontSize: 12, color: '#7a8a9a' }}>{fmtDate(bag.collected_at)}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a' }}>#{bag.bag_seq ?? '?'}</div>
                      <div style={{ fontSize: 13, color: '#3a4a40', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bag.orchard_name}</div>
                      <div style={{ fontSize: 13, color: '#3a4a40', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bag.employee_name}</div>
                      <div style={{ fontSize: 13, color: '#3a4a40' }}>{Number(bag.fruit_count)}</div>
                      <div style={{ fontSize: 13, color: '#3a4a40' }}>{bag.avg_weight_g ? `${bag.avg_weight_g}g` : '—'}</div>
                      <div style={{ fontSize: 13, color: Number(bag.issue_count) > 0 ? '#e85a4a' : '#4caf72', fontWeight: Number(bag.issue_count) > 0 ? 600 : 400 }}>
                        {Number(bag.issue_count)}
                      </div>
                      <div>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          background: bag.status === 'sampled' ? '#e8f5e9' : '#fff8e1',
                          color: bag.status === 'sampled' ? '#2e7d32' : '#7a5c00',
                        }}>
                          {bag.status}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderTop: '1px solid #f0ede6' }}>
                      <button
                        style={{ ...s.pill, padding: '4px 12px', fontSize: 12 }}
                        disabled={bagPage === 0}
                        onClick={() => setBagPage(p => p - 1)}
                      >
                        ← Prev
                      </button>
                      <span style={{ fontSize: 13, color: '#8a95a0' }}>
                        Page {bagPage + 1} of {totalPages}
                      </span>
                      <button
                        style={{ ...s.pill, padding: '4px 12px', fontSize: 12 }}
                        disabled={bagPage >= totalPages - 1}
                        onClick={() => setBagPage(p => p + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Slide-out detail panel ─────────────────────────────────────── */}
      {selectedBagId && (
        <>
          <div style={s.overlay} onClick={() => { setSelectedBagId(null); setBagDetail(null) }} />
          <div style={s.panel}>
            <div style={s.panelHead}>
              <div>
                {bagDetail?.session && (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2a3a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      Bag #{bagDetail.session.bag_seq ?? '?'} — {bagDetail.session.orchard_name}
                      <button
                        style={{ background: 'none', border: '1px solid #d4cfca', borderRadius: 4, fontSize: 11, color: '#5a6a60', padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
                        onClick={() => { setEditingOrchard(!editingOrchard); setNewOrchardId('') }}
                      >
                        {editingOrchard ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    {editingOrchard && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                        <select
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #d4cfca', fontSize: 13, fontFamily: 'inherit' }}
                          value={newOrchardId}
                          onChange={e => setNewOrchardId(e.target.value)}
                        >
                          <option value="">— Select new orchard —</option>
                          {allOrchards.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                        <button
                          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: newOrchardId ? '#2176d9' : '#c4cfc8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: newOrchardId ? 'pointer' : 'not-allowed', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                          disabled={!newOrchardId || savingOrchard}
                          onClick={saveOrchardChange}
                        >
                          {savingOrchard ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: '#8a95a0', marginTop: 4 }}>
                      {bagDetail.session.employee_name} · {fmtDate(bagDetail.session.collected_at)}
                    </div>
                    {bagDetail.session.collection_lat && bagDetail.session.collection_lng && (
                      <a
                        href={`https://www.google.com/maps?q=${bagDetail.session.collection_lat},${bagDetail.session.collection_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#2176d9', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}
                      >
                        📍 GPS location
                      </a>
                    )}
                  </>
                )}
              </div>
              <button style={s.closeBtn} onClick={() => { setSelectedBagId(null); setBagDetail(null) }}>×</button>
            </div>

            <div style={s.panelBody}>
              {detailLoading ? (
                <div style={{ ...s.loading, minHeight: 120 }}>Loading…</div>
              ) : bagDetail ? (
                <>
                  {/* Status badge */}
                  <div style={{ marginBottom: 20 }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: bagDetail.session.status === 'sampled' ? '#e8f5e9' : '#fff8e1',
                      color: bagDetail.session.status === 'sampled' ? '#2e7d32' : '#7a5c00',
                    }}>
                      {bagDetail.session.status}
                    </span>
                    {bagDetail.session.sampled_at && (
                      <span style={{ marginLeft: 10, fontSize: 12, color: '#8a95a0' }}>
                        Sampled {fmtDate(bagDetail.session.sampled_at)}
                      </span>
                    )}
                  </div>

                  {/* Fruit size distribution mini chart */}
                  {bagDetail.fruit.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a', marginBottom: 12 }}>
                        Fruit weights ({bagDetail.fruit.length} pieces)
                      </div>
                      {(() => {
                        // Aggregate by bin
                        const binMap = new Map<string, number>()
                        for (const f of bagDetail.fruit) {
                          const k = f.bin_label ?? 'Out of spec'
                          binMap.set(k, (binMap.get(k) || 0) + 1)
                        }
                        const chartData = Array.from(binMap.entries()).map(([label, count]) => ({ label, count }))
                        return (
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 4, left: 0 }}>
                              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7a8a9a' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#7a8a9a' }} width={24} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="count" name="Fruit" radius={[3, 3, 0, 0]}>
                                {chartData.map((entry, index) => (
                                  <Cell key={index} fill={entry.label === 'Out of spec' ? '#e85a4a' : BAR_SIZE} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )
                      })()}
                    </div>
                  )}

                  {/* Issues */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a', marginBottom: 12 }}>
                      Issues ({bagDetail.issues.reduce((acc, i) => acc + i.count, 0)} total)
                    </div>
                    {bagDetail.issues.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#4caf72' }}>✓ No issues recorded</div>
                    ) : (
                      bagDetail.issues.map((issue, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0ede6' }}>
                          <span style={issue.category === 'picking_issue' ? s.badgePicking : s.badgeQc}>
                            {issue.category === 'picking_issue' ? 'Picking' : 'QC'}
                          </span>
                          <span style={{ flex: 1, fontSize: 14, color: '#1a2a3a' }}>
                            {lang === 'af' ? issue.pest_name_af : issue.pest_name}
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#e85a4a' }}>
                            ×{issue.count}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

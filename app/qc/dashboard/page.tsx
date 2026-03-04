'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

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

interface Commodity { id: string; name: string }

type DateFilter = 'today' | 'this_week' | 'last_7' | 'this_month'
type Lang = 'en' | 'af'

// ── Date helpers ────────────────────────────────────────────────────────────

function getDateRange(filter: DateFilter): { from: Date; to: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)

  if (filter === 'today') return { from: today, to: tomorrow }

  if (filter === 'this_week') {
    const dow = (today.getDay() + 6) % 7 // Mon = 0
    const monday = new Date(today.getTime() - dow * 86400000)
    const nextMonday = new Date(monday.getTime() + 7 * 86400000)
    return { from: monday, to: nextMonday }
  }

  if (filter === 'last_7') {
    return { from: new Date(today.getTime() - 6 * 86400000), to: tomorrow }
  }

  // this_month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: monthStart, to: monthEnd }
}

function fmtDateFilter(filter: DateFilter): string {
  const { from, to } = getDateRange(filter)
  if (filter === 'today') return 'Today'
  if (filter === 'this_week') {
    const end = new Date(to.getTime() - 1)
    return `${from.getDate()} – ${end.getDate()} ${end.toLocaleString('en-ZA', { month: 'short' })}`
  }
  if (filter === 'last_7') return 'Last 7 days'
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
  page:        { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1c3a2a' },
  sidebar:     { width: 220, flexShrink: 0, background: '#1c3a2a', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  logo:        { fontSize: 22, color: '#a8d5a2', marginBottom: 32, letterSpacing: '-0.5px' },
  navItem:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, color: '#8aab96', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' },
  navLabel:    { fontSize: 10, color: '#5a7a6a', padding: '16px 16px 4px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  main:        { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0 },
  pageHeader:  { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle:   { fontSize: 32, fontWeight: 700, color: '#1c3a2a', letterSpacing: '-0.5px', lineHeight: 1 },
  pageSub:     { fontSize: 14, color: '#9aaa9f', marginTop: 6 },
  filters:     { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 28 },
  filterGroup: { display: 'flex', gap: 6 },
  pill:        { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:  { padding: '6px 14px', borderRadius: 20, border: '1px solid #2a6e45', background: '#2a6e45', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  divider:     { width: 1, height: 24, background: '#d4cfca' },
  // KPI strip
  kpiStrip:    { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 28 },
  kpiCard:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative', overflow: 'hidden' },
  kpiAccent:   { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2a6e45, #a8d5a2)' },
  kpiLabel:    { fontSize: 12, color: '#9aaa9f', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  kpiValue:    { fontSize: 36, fontWeight: 700, color: '#1c3a2a', lineHeight: 1 },
  kpiSub:      { fontSize: 12, color: '#9aaa9f', marginTop: 6 },
  // Cards
  card:        { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader:  { padding: '20px 24px 16px', borderBottom: '1px solid #f0ede6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:   { fontSize: 17, fontWeight: 600, color: '#1c3a2a' },
  cardBody:    { padding: '20px 24px' },
  // Table
  tableHead:   { display: 'grid', gap: 8, padding: '10px 16px', background: '#f7f5f0', borderBottom: '1px solid #e8e4dc', fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase' as const, letterSpacing: '0.06em', alignItems: 'center' },
  tableRow:    { display: 'grid', gap: 8, padding: '11px 16px', borderBottom: '1px solid #f0ede6', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' },
  // Slide-out panel
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100 },
  panel:       { position: 'fixed', right: 0, top: 0, bottom: 0, width: 440, background: '#fff', zIndex: 101, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  panelHead:   { padding: '20px 24px', borderBottom: '1px solid #e8e4dc', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  panelBody:   { padding: '20px 24px', flex: 1, overflowY: 'auto' },
  closeBtn:    { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9aaa9f', lineHeight: 1, padding: 4 },
  // Progress bar
  progBg:      { flex: 1, height: 6, background: '#f0ede6', borderRadius: 3, overflow: 'hidden' },
  progFill:    { height: '100%', borderRadius: 3, transition: 'width 0.6s ease' },
  // Issue category badge
  badgePicking:{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#fffbe6', color: '#7a5c00', border: '1px solid #f5c842' },
  badgeQc:     { padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#fff5f4', color: '#8a2020', border: '1px solid #e85a4a' },
  loading:     { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#9aaa9f', fontSize: 14 },
}

// ── Custom tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1c3a2a', color: '#e8f0e0', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
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

  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])

  const [dateFilter, setDateFilter] = useState<DateFilter>('this_week')
  const [commodityId, setCommodityId] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>('en')

  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [sizeData, setSizeData] = useState<SizeBin[]>([])
  const [issueData, setIssueData] = useState<IssueRow[]>([])
  const [bagList, setBagList] = useState<BagRow[]>([])

  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedBagId, setSelectedBagId] = useState<string | null>(null)
  const [bagDetail, setBagDetail] = useState<BagDetail | null>(null)

  const [pickerSort, setPickerSort] = useState<PickerSort>('issueRate')
  const [pickerSortDir, setPickerSortDir] = useState<'asc' | 'desc'>('desc')

  const [bagPage, setBagPage] = useState(0)
  const PAGE_SIZE = 50

  // Load farms on mount
  useEffect(() => {
    if (!contextLoaded) return
    async function init() {
      const q = supabase.from('farms').select('id').eq('is_active', true)
      const { data } = isSuperAdmin ? await q : await q.in('id', farmIds)
      const ids = (data || []).map((f: any) => f.id)
      setEffectiveFarmIds(ids)

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
    }
    init()
  }, [contextLoaded])

  // Fetch data when farms or filters change
  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    fetchAll()
  }, [effectiveFarmIds, dateFilter, commodityId])

  async function fetchAll() {
    setLoading(true)
    setBagPage(0)
    const { from, to } = getDateRange(dateFilter)
    const fromIso = from.toISOString()
    const toIso   = to.toISOString()

    const [kpisRes, sizeRes, issueRes, bagRes] = await Promise.all([
      supabase.rpc('get_qc_dashboard_kpis', {
        p_farm_ids: effectiveFarmIds,
        p_from:     fromIso,
        p_to:       toIso,
      }),
      supabase.rpc('get_qc_size_distribution', {
        p_farm_ids:     effectiveFarmIds,
        p_from:         fromIso,
        p_to:           toIso,
        p_commodity_id: commodityId ?? null,
      }),
      supabase.rpc('get_qc_issue_breakdown', {
        p_farm_ids:     effectiveFarmIds,
        p_from:         fromIso,
        p_to:           toIso,
        p_commodity_id: commodityId ?? null,
      }),
      supabase.rpc('get_qc_bag_list', {
        p_farm_ids: effectiveFarmIds,
        p_from:     fromIso,
        p_to:       toIso,
      }),
    ])

    setKpis((kpisRes.data as KpiData) || null)
    setSizeData((sizeRes.data as SizeBin[]) || [])
    setIssueData((issueRes.data as IssueRow[]) || [])

    // Filter bag list by commodity if selected
    let bags = (bagRes.data as BagRow[]) || []
    if (commodityId) bags = bags.filter(b => b.commodity_id === commodityId)
    setBagList(bags)
    setLoading(false)
  }

  // Fetch bag detail
  async function openBag(sessionId: string) {
    setSelectedBagId(sessionId)
    setBagDetail(null)
    setDetailLoading(true)
    const { data } = await supabase.rpc('get_qc_bag_detail', { p_session_id: sessionId })
    setBagDetail(data as BagDetail)
    setDetailLoading(false)
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

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}><span style={{ color: '#fff' }}>Farm</span>Scout</div>
        <a href="/" style={s.navItem}><span>📊</span> Dashboard</a>
        <a href="/orchards" style={s.navItem}><span>🏡</span> Orchards</a>
        <a href="/pests" style={s.navItem}><span>🐛</span> Pests</a>
        <a href="/trap-inspections" style={s.navItem}><span>🪤</span> Trap Inspections</a>
        <a href="/heatmap" style={s.navItem}><span>🌡️</span> Heat Map</a>
        <a href="/scouts" style={s.navItem}><span>👷</span> Scouts</a>
        <a href="/settings" style={s.navItem}><span>🔔</span> Settings</a>
        {isSuperAdmin && <a href="/admin" style={s.navItem}><span>⚙️</span> Admin</a>}
        <div style={s.navLabel}>QC</div>
        <a href="/qc/dashboard" style={{ ...s.navItem, background: '#2a4f38', color: '#a8d5a2' }}><span>⚖️</span> QC Dashboard</a>
        <a href="/qc/unknowns" style={s.navItem}><span>📷</span> Unknown Issues</a>
        <a href="/qc/settings/issues" style={s.navItem}><span>🐛</span> Issue Setup</a>
        <a href="/qc/settings/size-bins" style={s.navItem}><span>📏</span> Size Bins</a>
      </aside>

      {/* Main */}
      <main style={s.main}>
        {/* Page header */}
        <div style={s.pageHeader}>
          <div>
            <div style={s.pageTitle}>QC Dashboard</div>
            <div style={s.pageSub}>Bag sample quality data</div>
          </div>
        </div>

        {/* Filters */}
        <div style={s.filters}>
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
                <div style={s.kpiSub}>{fmtDateFilter(dateFilter)}</div>
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
                <div style={s.kpiValue}>{kpis?.avg_weight_g ?? 0}<span style={{ fontSize: 18, fontWeight: 400, color: '#9aaa9f' }}>g</span></div>
                <div style={s.kpiSub}>per fruit</div>
              </div>

              {/* Issue Rate */}
              <div style={s.kpiCard}>
                <div style={{ ...s.kpiAccent, background: `linear-gradient(90deg, ${issueRateColor(kpis?.issue_rate_pct ?? 0)}, ${issueRateColor(kpis?.issue_rate_pct ?? 0)}88)` }} />
                <div style={s.kpiLabel}>Issue Rate</div>
                <div style={{ ...s.kpiValue, color: issueRateColor(kpis?.issue_rate_pct ?? 0) }}>
                  {kpis?.issue_rate_pct ?? 0}<span style={{ fontSize: 18, fontWeight: 400, color: '#9aaa9f' }}>%</span>
                </div>
                <div style={s.kpiSub}>bags with ≥1 issue</div>
              </div>

              {/* Class 1 */}
              <div style={s.kpiCard}>
                <div style={{ ...s.kpiAccent, background: `linear-gradient(90deg, #2a6e45, #a8d5a2)` }} />
                <div style={s.kpiLabel}>Class 1</div>
                <div style={{ ...s.kpiValue, color: (kpis?.class_1_pct ?? 0) >= 80 ? '#4caf72' : (kpis?.class_1_pct ?? 0) >= 60 ? '#f5c842' : '#e85a4a' }}>
                  {kpis?.class_1_pct ?? 0}<span style={{ fontSize: 18, fontWeight: 400, color: '#9aaa9f' }}>%</span>
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
                    <span style={{ fontSize: 13, fontWeight: 400, color: '#9aaa9f', marginLeft: 10 }}>
                      — {commodities.find(c => c.id === commodityId)!.name}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#9aaa9f' }}>
                  {sizeData.reduce((acc, b) => acc + Number(b.fruit_count), 0).toLocaleString()} fruit
                </div>
              </div>
              <div style={s.cardBody}>
                {sizeData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9aaa9f', padding: '24px 0' }}>No fruit data for this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={sizeData} margin={{ top: 20, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
                      <XAxis dataKey="bin_label" tick={{ fontSize: 11, fill: '#7a8a80' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#7a8a80' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="fruit_count" name="Fruit" radius={[4, 4, 0, 0]}>
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
                <div style={s.cardTitle}>Issue Breakdown</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9aaa9f', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: BAR_PICKING, display: 'inline-block' }} />
                    Picking issue
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: BAR_QC, display: 'inline-block' }} />
                    QC issue
                  </span>
                </div>
              </div>
              <div style={s.cardBody}>
                {issueData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9aaa9f', padding: '24px 0' }}>No issues recorded in this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, issueData.length * 38)}>
                    <BarChart
                      data={issueData.map(r => ({
                        name: lang === 'af' ? r.pest_name_af : r.pest_name,
                        count: r.total_count,
                        category: r.category,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 24, bottom: 0, left: 120 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#7a8a80' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#3a4a40' }} width={115} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                        {issueData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.category === 'picking_issue' ? BAR_PICKING : BAR_QC}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── Picker Performance ────────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitle}>Picker Performance</div>
                <div style={{ fontSize: 13, color: '#9aaa9f' }}>{pickerRows.length} pickers</div>
              </div>
              {pickerRows.length === 0 ? (
                <div style={{ ...s.cardBody, color: '#9aaa9f' }}>No data</div>
              ) : (
                <>
                  <div style={{ ...s.tableHead, gridTemplateColumns: '1.5fr 60px 60px 80px 90px 1fr' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('name')}>Picker{sortIcon('name')}</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('bags')}>Bags{sortIcon('bags')}</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('fruit')}>Fruit{sortIcon('fruit')}</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('avgWeight')}>Avg g{sortIcon('avgWeight')}</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' as any, padding: 0 }} onClick={() => toggleSort('issueRate')}>Issue rate{sortIcon('issueRate')}</button>
                    <div>Top issue</div>
                  </div>
                  {pickerRows.map(r => (
                    <div key={r.name} style={{ ...s.tableRow, gridTemplateColumns: '1.5fr 60px 60px 80px 90px 1fr', cursor: 'default' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1c3a2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 14, color: '#3a4a40' }}>{r.bags}</div>
                      <div style={{ fontSize: 14, color: '#3a4a40' }}>{r.fruit.toLocaleString()}</div>
                      <div style={{ fontSize: 14, color: '#3a4a40' }}>{r.avgWeight ? `${r.avgWeight}g` : '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: issueRateColor(r.issueRate), flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: '#3a4a40' }}>{r.issueRate}%</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#9aaa9f' }}>{r.topIssue}</div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ── Bag List ──────────────────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitle}>Bag List</div>
                <div style={{ fontSize: 13, color: '#9aaa9f' }}>{bagList.length} bags</div>
              </div>
              {bagList.length === 0 ? (
                <div style={{ ...s.cardBody, color: '#9aaa9f' }}>No bags in this period</div>
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
                      <div style={{ fontSize: 12, color: '#7a8a80' }}>{fmtDate(bag.collected_at)}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1c3a2a' }}>#{bag.bag_seq ?? '?'}</div>
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
                      <span style={{ fontSize: 13, color: '#9aaa9f' }}>
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
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1c3a2a' }}>
                      Bag #{bagDetail.session.bag_seq ?? '?'} — {bagDetail.session.orchard_name}
                    </div>
                    <div style={{ fontSize: 13, color: '#9aaa9f', marginTop: 4 }}>
                      {bagDetail.session.employee_name} · {fmtDate(bagDetail.session.collected_at)}
                    </div>
                    {bagDetail.session.collection_lat && bagDetail.session.collection_lng && (
                      <a
                        href={`https://www.google.com/maps?q=${bagDetail.session.collection_lat},${bagDetail.session.collection_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#2a6e45', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}
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
                      <span style={{ marginLeft: 10, fontSize: 12, color: '#9aaa9f' }}>
                        Sampled {fmtDate(bagDetail.session.sampled_at)}
                      </span>
                    )}
                  </div>

                  {/* Fruit size distribution mini chart */}
                  {bagDetail.fruit.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a', marginBottom: 12 }}>
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
                              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7a8a80' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#7a8a80' }} width={24} />
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a', marginBottom: 12 }}>
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
                          <span style={{ flex: 1, fontSize: 14, color: '#1c3a2a' }}>
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

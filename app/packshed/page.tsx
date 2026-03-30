'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { Suspense, useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'

// ── Types ──────────────────────────────────────────────────────────────────

interface Packhouse { id: string; code: string; name: string }
interface BoxType { id: string; code: string; name: string; pack_code: string; grade: string; cartons_per_pallet: number; weight_per_carton_kg: number | null }
interface Size { id: string; label: string; sort_order: number }
interface ValidCombo { box_type_id: string; size_id: string }
interface PalletRow { box_type_id: string | null; size_id: string | null; carton_count: number; orchard_id: string | null; orchard_code: string | null; variety: string | null }
interface StockCell { box_type_id: string; size_id: string; carton_count: number }
interface BinWeight { id: string; category: string; net_weight_kg: number; seq: number; bin_type: string; gross_weight_kg: number; tare_weight_kg: number; orchard_id: string | null; bin_count: number }
interface OrchardRef { id: string; name: string; orchard_nr: number | null; variety: string | null }

interface SessionRow {
  id: string
  seq: number
  orchard_id: string | null
  variety: string | null
  orchard_name: string
  bins_packed: number | null
  start_time: string
  end_time: string
  smous_weight_kg: number | null
  openingStock: StockCell[]
  closingStock: StockCell[]
  _dirty?: boolean
}

export default function DailyPackoutPageWrapper() {
  return <Suspense><DailyPackoutPage /></Suspense>
}

function DailyPackoutPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [packhouses, setPackhouses] = useState<Packhouse[]>([])
  const [boxTypes, setBoxTypes] = useState<BoxType[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [validCombos, setValidCombos] = useState<ValidCombo[]>([])
  const [orchards, setOrchards] = useState<OrchardRef[]>([])

  const [pallets, setPallets] = useState<PalletRow[]>([])
  const [floorStockToday, setFloorStockToday] = useState<StockCell[]>([])
  const [floorStockYesterday, setFloorStockYesterday] = useState<StockCell[]>([])
  const [binWeights, setBinWeights] = useState<BinWeight[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [savingSessions, setSavingSessions] = useState(false)
  const [weighTableOpen, setWeighTableOpen] = useState(false)
  const [editingWeighId, setEditingWeighId] = useState<string | null>(null)
  const [editGross, setEditGross] = useState('')
  const [editBinCount, setEditBinCount] = useState(2)
  const [editBinType, setEditBinType] = useState<'plastic' | 'wood'>('plastic')
  const [savingWeigh, setSavingWeigh] = useState(false)

  const [juiceDefects, setJuiceDefects] = useState<{ name: string; count: number; pct: number }[]>([])

  const [selectedPackhouse, setSelectedPackhouse] = useState('')
  const [selectedOrchard, setSelectedOrchard] = useState<string>('all')
  const [packDate, setPackDate] = useState(() => searchParams.get('date') || new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  // Session CRUD state
  const [addingSession, setAddingSession] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)

  // ── Load reference data ──────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    loadReferenceData()
  }, [contextLoaded])

  useEffect(() => {
    if (selectedPackhouse && packDate) loadDayData()
  }, [selectedPackhouse, packDate])

  async function loadReferenceData() {
    const [phRes, btRes, szRes, comboRes, orchRes] = await Promise.all([
      supabase.from('packhouses').select('id,code,name').eq('is_active', true).order('code'),
      supabase.from('packout_box_types').select('id,code,name,pack_code,grade,cartons_per_pallet,weight_per_carton_kg').eq('is_active', true).order('code'),
      supabase.from('packout_sizes').select('id,label,sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('packout_box_type_sizes').select('box_type_id,size_id').eq('is_active', true),
      supabase.from('orchards').select('id,name,orchard_nr,variety').eq('is_active', true).order('orchard_nr'),
    ])
    setPackhouses(phRes.data || [])
    setBoxTypes(btRes.data || [])
    setSizes(szRes.data || [])
    setValidCombos(comboRes.data || [])
    setOrchards(orchRes.data || [])
    if (phRes.data?.length && !selectedPackhouse) setSelectedPackhouse(phRes.data[0].id)
    setLoading(false)
  }

  async function loadDayData() {
    setLoading(true)

    const [palRes, bwRes, sessRes] = await Promise.all([
      supabase.from('packout_pallets').select('box_type_id,size_id,carton_count,orchard_id,orchard_code,variety').eq('packhouse_id', selectedPackhouse).eq('pack_date', packDate),
      supabase.from('packout_bin_weights').select('id,category,net_weight_kg,seq,bin_type,gross_weight_kg,tare_weight_kg,orchard_id,bin_count').eq('packhouse_id', selectedPackhouse).eq('weigh_date', packDate).order('category').order('seq'),
      supabase.from('packout_daily_sessions').select('id,seq,orchard_id,variety,bins_packed,start_time,end_time,smous_weight_kg,orchards(name,variety)').eq('packhouse_id', selectedPackhouse).eq('pack_date', packDate).order('seq'),
    ])

    // Fetch floor stock for all sessions (opening + closing)
    const sessionIds = (sessRes.data || []).filter((s: any) => s.id).map((s: any) => s.id)
    const { data: sessionFloorStock } = sessionIds.length > 0
      ? await supabase.from('packout_floor_stock').select('session_id,stock_type,box_type_id,size_id,carton_count').in('session_id', sessionIds)
      : { data: [] }

    // Legacy date-based floor stock fallback (only for dates before session migration on 2026-03-24)
    let legacyToday: StockCell[] = []
    let legacyYest: StockCell[] = []

    if (packDate < '2026-03-24') {
      const { data: prevDateRow } = await supabase
        .from('packout_floor_stock')
        .select('stock_date')
        .eq('packhouse_id', selectedPackhouse)
        .lt('stock_date', packDate)
        .is('session_id', null)
        .order('stock_date', { ascending: false })
        .limit(1)
      const prevStockDate = prevDateRow?.[0]?.stock_date || null

      const [fsTodayRes, fsYestRes] = await Promise.all([
        supabase.from('packout_floor_stock').select('box_type_id,size_id,carton_count').eq('packhouse_id', selectedPackhouse).eq('stock_date', packDate).is('session_id', null),
        prevStockDate
          ? supabase.from('packout_floor_stock').select('box_type_id,size_id,carton_count').eq('packhouse_id', selectedPackhouse).eq('stock_date', prevStockDate).is('session_id', null)
          : Promise.resolve({ data: [] as any[] }),
      ])
      legacyToday = (fsTodayRes.data || []) as StockCell[]
      legacyYest = (fsYestRes.data || []) as StockCell[]
    }

    const palletData = palRes.data || []
    setPallets(palletData)
    setFloorStockToday(legacyToday)
    setFloorStockYesterday(legacyYest)
    setBinWeights(bwRes.data || [])

    // Fetch juice samples + defects for this date and packhouse
    const { data: juiceSamples } = await supabase
      .from('packout_juice_samples')
      .select('id,sample_size,orchard_id')
      .eq('packhouse_id', selectedPackhouse)
      .eq('sample_date', packDate)

    if (juiceSamples && juiceSamples.length > 0) {
      const sampleIds = juiceSamples.map(s => s.id)
      const { data: defects } = await supabase
        .from('packout_juice_defects')
        .select('pest_id,count')
        .in('sample_id', sampleIds)

      if (defects && defects.length > 0) {
        const byPest = new Map<string, number>()
        for (const d of defects) {
          byPest.set(d.pest_id, (byPest.get(d.pest_id) || 0) + d.count)
        }
        const pestIds = [...byPest.keys()]
        const { data: pests } = await supabase.from('pests').select('id,name').in('id', pestIds)
        const pestNames = new Map((pests || []).map(p => [p.id, p.name]))

        const { data: cpests } = await supabase
          .from('commodity_pests')
          .select('pest_id,display_name_af')
          .in('pest_id', pestIds)
          .eq('category', 'qc_issue')
        const afNames = new Map((cpests || []).map(c => [c.pest_id, c.display_name_af]))

        const totalSampled = defects.reduce((s, d) => s + d.count, 0)
        const defectList = [...byPest.entries()]
          .map(([pid, count]) => ({
            name: afNames.get(pid) || pestNames.get(pid) || 'Unknown',
            count,
            pct: totalSampled > 0 ? count / totalSampled : 0,
          }))
          .sort((a, b) => b.count - a.count)

        setJuiceDefects(defectList)
      } else {
        setJuiceDefects([])
      }
    } else {
      setJuiceDefects([])
    }

    // Group session floor stock by (session_id, stock_type)
    const sfsBySession = new Map<string, { opening: StockCell[]; closing: StockCell[] }>()
    for (const fs of (sessionFloorStock || [])) {
      const sid = fs.session_id
      if (!sid) continue
      if (!sfsBySession.has(sid)) sfsBySession.set(sid, { opening: [], closing: [] })
      const entry = sfsBySession.get(sid)!
      const cell: StockCell = { box_type_id: fs.box_type_id, size_id: fs.size_id, carton_count: fs.carton_count }
      if (fs.stock_type === 'opening') entry.opening.push(cell)
      else entry.closing.push(cell)
    }

    // Build session rows from DB only — no pallet merging
    const sessionRows: SessionRow[] = (sessRes.data || []).map((s: any) => {
      const fs = s.id ? sfsBySession.get(s.id) : undefined
      const orchData = s.orchards as { name: string; variety: string | null } | null
      return {
        id: s.id,
        seq: s.seq,
        orchard_id: s.orchard_id,
        variety: s.variety || orchData?.variety || null,
        orchard_name: orchData?.name || orchards.find(o => o.id === s.orchard_id)?.name || 'Unknown',
        bins_packed: s.bins_packed ?? null,
        start_time: s.start_time || '',
        end_time: s.end_time || '',
        smous_weight_kg: s.smous_weight_kg ?? null,
        openingStock: fs?.opening || [],
        closingStock: fs?.closing || [],
      }
    })

    setSessions(sessionRows)
    setLoading(false)
  }

  // ── Session CRUD ──────────────────────────────────────────────────

  async function addSession(orchardId: string) {
    setAddingSession(true)
    const orch = orchards.find(o => o.id === orchardId)
    if (!orch) { setAddingSession(false); return }

    const { data: phData } = await supabase
      .from('packhouses').select('organisation_id').eq('id', selectedPackhouse).single()
    if (!phData) { setAddingSession(false); return }

    const nextSeq = sessions.length > 0
      ? Math.max(...sessions.map(s => s.seq)) + 1
      : 1

    const variety = orch.variety || null

    const { data: newSess } = await supabase.from('packout_daily_sessions').insert({
      organisation_id: phData.organisation_id,
      packhouse_id: selectedPackhouse,
      pack_date: packDate,
      orchard_id: orchardId,
      variety,
      seq: nextSeq,
    }).select('id').single()

    // Auto-copy opening stock from most recent closing for same variety
    if (newSess?.id && variety) {
      const { data: prevSess } = await supabase
        .from('packout_daily_sessions')
        .select('id')
        .eq('packhouse_id', selectedPackhouse)
        .eq('variety', variety)
        .neq('id', newSess.id)
        .order('pack_date', { ascending: false })
        .order('seq', { ascending: false })
        .limit(1)

      if (prevSess?.length) {
        const { data: prevClosing } = await supabase
          .from('packout_floor_stock')
          .select('box_type_id,size_id,carton_count')
          .eq('session_id', prevSess[0].id)
          .eq('stock_type', 'closing')

        if (prevClosing?.length) {
          const openingRows = prevClosing.map(c => ({
            organisation_id: phData.organisation_id,
            packhouse_id: selectedPackhouse,
            stock_date: packDate,
            session_id: newSess.id,
            stock_type: 'opening',
            box_type_id: c.box_type_id,
            size_id: c.size_id,
            carton_count: c.carton_count,
          }))
          await supabase.from('packout_floor_stock').insert(openingRows)
        }
      }
    }

    setShowAddRow(false)
    setAddingSession(false)
    await loadDayData()
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Delete this orchard run? Floor stock entries for this session will also be deleted.')) return
    await supabase.from('packout_daily_sessions').delete().eq('id', sessionId)
    await loadDayData()
  }

  async function moveSession(idx: number, direction: 'up' | 'down') {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sessions.length) return

    const a = sessions[idx]
    const b = sessions[swapIdx]
    if (!a.id || !b.id) return

    // Swap seq values via temp to avoid unique constraint violation
    const tempSeq = Math.max(...sessions.map(s => s.seq)) + 100
    await supabase.from('packout_daily_sessions').update({ seq: tempSeq }).eq('id', a.id)
    await supabase.from('packout_daily_sessions').update({ seq: a.seq }).eq('id', b.id)
    await supabase.from('packout_daily_sessions').update({ seq: b.seq }).eq('id', a.id)

    await loadDayData()
  }

  // ── Session editing & save ────────────────────────────────────────

  function updateSession(idx: number, field: keyof SessionRow, value: any) {
    setSessions(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value, _dirty: true } : s))
  }

  async function saveSessions() {
    setSavingSessions(true)
    const dirtyRows = sessions.filter(s => s._dirty && s.id)

    for (const row of dirtyRows) {
      await supabase.from('packout_daily_sessions').update({
        variety: row.variety,
        bins_packed: row.bins_packed,
        start_time: row.start_time || null,
        end_time: row.end_time || null,
        smous_weight_kg: row.smous_weight_kg,
      }).eq('id', row.id)
    }

    setSavingSessions(false)
    await loadDayData()
  }

  const sessionsDirty = sessions.some(s => s._dirty)

  // ── Session KPIs ────────────────────────────────────────────────────

  const filteredSessions = useMemo(() => {
    if (selectedOrchard === 'all') return sessions
    return sessions.filter(s => s.orchard_id === selectedOrchard)
  }, [sessions, selectedOrchard])

  const totalBinsPacked = filteredSessions.reduce((s, r) => s + (r.bins_packed || 0), 0)
  const totalSmousKg = filteredSessions.reduce((s, r) => s + (r.smous_weight_kg || 0), 0)

  // ── Unmatched pallets warning ──────────────────────────────────────

  const unmatchedPallets = useMemo(() => {
    const sessionOrchardIds = new Set(sessions.map(s => s.orchard_id).filter(Boolean))
    const unmatched = pallets.filter(p => p.orchard_id && !sessionOrchardIds.has(p.orchard_id))
    if (unmatched.length === 0) return null
    const codes = [...new Set(unmatched.map(p => p.orchard_code || 'Unknown'))]
    return { count: unmatched.length, codes }
  }, [pallets, sessions])

  // ── Grid computations ─────────────────────────────────────────────

  const validSet = useMemo(() => new Set(validCombos.map(c => `${c.box_type_id}_${c.size_id}`)), [validCombos])

  const activeSizes = useMemo(() => {
    const sizeIds = new Set(validCombos.map(c => c.size_id))
    return sizes.filter(s => sizeIds.has(s.id))
  }, [sizes, validCombos])

  const activeBoxTypes = useMemo(() => {
    const btIds = new Set(validCombos.map(c => c.box_type_id))
    return boxTypes.filter(bt => btIds.has(bt.id))
  }, [boxTypes, validCombos])

  // Filter data by selected orchard (or show all)
  const filteredPallets = useMemo(() => {
    if (selectedOrchard === 'all') return pallets
    return pallets.filter(p => p.orchard_id === selectedOrchard)
  }, [pallets, selectedOrchard])

  // Session-based floor stock: aggregate opening + closing across filtered sessions
  // Falls back to legacy date-based floor stock if no session data
  const hasSessionFloorStock = sessions.some(s => s.openingStock.length > 0 || s.closingStock.length > 0)

  const filteredFloorToday = useMemo(() => {
    if (!hasSessionFloorStock) return floorStockToday
    const cells: StockCell[] = []
    for (const s of filteredSessions) cells.push(...s.closingStock)
    return cells
  }, [filteredSessions, hasSessionFloorStock, floorStockToday])

  const filteredFloorYest = useMemo(() => {
    if (!hasSessionFloorStock) return floorStockYesterday
    const cells: StockCell[] = []
    for (const s of filteredSessions) cells.push(...s.openingStock)
    return cells
  }, [filteredSessions, hasSessionFloorStock, floorStockYesterday])

  const filteredBinWeights = useMemo(() => {
    if (selectedOrchard === 'all') return binWeights
    return binWeights.filter(b => b.orchard_id === selectedOrchard)
  }, [binWeights, selectedOrchard])

  function buildGrid(data: { box_type_id: string | null; size_id: string | null; carton_count: number }[]): Map<string, number> {
    const m = new Map<string, number>()
    for (const r of data) {
      if (!r.box_type_id || !r.size_id) continue
      const key = `${r.box_type_id}_${r.size_id}`
      m.set(key, (m.get(key) || 0) + r.carton_count)
    }
    return m
  }

  const palletGrid = useMemo(() => buildGrid(filteredPallets), [filteredPallets])
  const floorTodayGrid = useMemo(() => buildGrid(filteredFloorToday), [filteredFloorToday])
  const floorYestGrid = useMemo(() => buildGrid(filteredFloorYest), [filteredFloorYest])

  function gridRowTotal(grid: Map<string, number>, btId: string): number {
    return activeSizes.reduce((s, sz) => s + (grid.get(`${btId}_${sz.id}`) || 0), 0)
  }

  function gridGrandTotal(grid: Map<string, number>): number {
    let total = 0
    for (const [, v] of grid) total += v
    return total
  }

  const netPackedGrid = useMemo(() => {
    const m = new Map<string, number>()
    for (const bt of activeBoxTypes) {
      for (const sz of activeSizes) {
        const key = `${bt.id}_${sz.id}`
        const totalPacked = (palletGrid.get(key) || 0) + (floorTodayGrid.get(key) || 0)
        const opening = floorYestGrid.get(key) || 0
        const net = totalPacked - opening
        if (net !== 0) m.set(key, net)
      }
    }
    return m
  }, [palletGrid, floorTodayGrid, floorYestGrid, activeBoxTypes, activeSizes])

  // ── Bin weight editing ───────────────────────────────────────────

  const TARE_PER_BIN: Record<string, number> = { plastic: 38, wood: 65 }

  function startEditWeigh(b: BinWeight) {
    setEditingWeighId(b.id)
    setEditGross(String(b.gross_weight_kg))
    setEditBinCount(b.bin_count || 1)
    setEditBinType(b.bin_type as 'plastic' | 'wood')
  }

  async function saveEditWeigh() {
    if (!editingWeighId) return
    setSavingWeigh(true)
    const gross = parseFloat(editGross) || 0
    const tare = (TARE_PER_BIN[editBinType] || 38) * editBinCount
    await supabase.from('packout_bin_weights').update({
      gross_weight_kg: gross,
      tare_weight_kg: tare,
      bin_count: editBinCount,
      bin_type: editBinType,
    }).eq('id', editingWeighId)
    setEditingWeighId(null)
    setSavingWeigh(false)
    await loadDayData()
  }

  async function deleteWeigh(id: string) {
    if (!confirm('Delete this weighing?')) return
    await supabase.from('packout_bin_weights').delete().eq('id', id)
    await loadDayData()
  }

  // ── PDF export ──────────────────────────────────────────────────

  async function handleExportPdf() {
    const { generatePackoutPdf } = await import('@/lib/packshed-pdf')

    const phName = packhouses.find(p => p.id === selectedPackhouse)?.name || ''

    // Build box type summaries from net packed grid
    const boxTypeSummaries = activeBoxTypes
      .map(bt => {
        let totalCartons = 0
        for (const sz of activeSizes) {
          totalCartons += netPackedGrid.get(`${bt.id}_${sz.id}`) || 0
        }
        return {
          code: bt.code,
          name: bt.name,
          grade: bt.grade,
          totalCartons,
          cartons_per_pallet: bt.cartons_per_pallet,
          weight_per_carton_kg: bt.weight_per_carton_kg || 0,
        }
      })
      .filter(bt => bt.totalCartons > 0)

    // Size distribution from net packed grid
    const sizeDistribution = activeSizes
      .map(sz => {
        let count = 0
        for (const bt of activeBoxTypes) {
          count += netPackedGrid.get(`${bt.id}_${sz.id}`) || 0
        }
        return { label: sz.label, count }
      })
      .filter(s => s.count > 0)
    const totalSizeCtns = sizeDistribution.reduce((s, d) => s + d.count, 0)
    const sizeDistWithPct = sizeDistribution.map(s => ({
      ...s,
      pct: totalSizeCtns > 0 ? s.count / totalSizeCtns : 0,
    }))

    const pdfBytes = await generatePackoutPdf({
      packDate,
      packhouseName: phName,
      sessions: filteredSessions,
      logoUrl: '/hr/mv-logo.png',
      totalBinsPacked,
      avgBinWeight,
      totalKgIn,
      boxTypeSummaries,
      smousKg: totalSmousKg,
      juiceKg,
      rotKg,
      totalKgOut,
      conversionPct,
      lossPct,
      sizeDistribution: sizeDistWithPct,
      juiceDefects,
    })

    // Download
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const orchName = filteredSessions[0]?.orchard_name || 'packout'
    a.href = url
    a.download = `${packDate} ${orchName}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Bin weight KPIs ───────────────────────────────────────────────

  const binsByCategory = useMemo(() => {
    const groups: Record<string, BinWeight[]> = { pack: [], juice: [], rot: [] }
    for (const b of filteredBinWeights) groups[b.category]?.push(b)
    return groups
  }, [filteredBinWeights])

  function catTotalBins(cat: string): number {
    return (binsByCategory[cat] || []).reduce((s, b) => s + (b.bin_count || 1), 0)
  }

  function catAvg(cat: string): number {
    const totalBins = catTotalBins(cat)
    if (totalBins === 0) return 0
    return catTotal(cat) / totalBins
  }

  function catTotal(cat: string): number {
    return (binsByCategory[cat] || []).reduce((s, b) => s + b.net_weight_kg, 0)
  }

  // Mass balance: KG In = bins_packed (from session) x avg bin weight (from weighed sample)
  const avgBinWeight = catAvg('pack')
  const binsWeighed = catTotalBins('pack')
  const totalKgIn = totalBinsPacked > 0 && avgBinWeight > 0
    ? totalBinsPacked * avgBinWeight
    : 0
  const juiceKg = catTotal('juice')
  const rotKg = catTotal('rot')

  const totalCartonsOut = gridGrandTotal(netPackedGrid)
  const totalKgOutCartons = useMemo(() => {
    let kg = 0
    for (const bt of activeBoxTypes) {
      const w = bt.weight_per_carton_kg || 0
      for (const sz of activeSizes) {
        const net = netPackedGrid.get(`${bt.id}_${sz.id}`) || 0
        kg += net * w
      }
    }
    return kg
  }, [netPackedGrid, activeBoxTypes, activeSizes])

  const totalKgOut = totalKgOutCartons + juiceKg + rotKg + totalSmousKg
  const conversionPct = totalKgIn > 0 ? (totalKgOutCartons / totalKgIn * 100) : 0
  const lossPct = totalKgIn > 0 ? ((totalKgIn - totalKgOut) / totalKgIn * 100) : 0

  // ── Render grid table ─────────────────────────────────────────────

  function renderGrid(label: string, grid: Map<string, number>, highlight?: string) {
    if (gridGrandTotal(grid) === 0 && highlight !== '#f0f7ff') return null
    return (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a', marginBottom: 8 }}>{label}</h3>
        <div style={{ background: highlight || '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8f9fb' }}>
                <th style={st.th}>Box Type</th>
                {activeSizes.map(sz => (
                  <th key={sz.id} style={{ ...st.th, textAlign: 'center', minWidth: 50 }}>{sz.label}</th>
                ))}
                <th style={{ ...st.th, textAlign: 'center', background: '#eef2f7' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {activeBoxTypes.map(bt => {
                const rowT = gridRowTotal(grid, bt.id)
                if (rowT === 0) return null
                return (
                  <tr key={bt.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ ...st.td, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 }}>{bt.code}</td>
                    {activeSizes.map(sz => {
                      const key = `${bt.id}_${sz.id}`
                      if (!validSet.has(key)) return <td key={sz.id} style={{ ...st.td, background: '#f8f8f8' }} />
                      const val = grid.get(key) || 0
                      return (
                        <td key={sz.id} style={{ ...st.td, textAlign: 'center', color: val ? '#1a2a3a' : '#d4d8de' }}>
                          {val || '-'}
                        </td>
                      )
                    })}
                    <td style={{ ...st.td, textAlign: 'center', fontWeight: 700, background: '#eef2f7' }}>{rowT}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#eef2f7', fontWeight: 700 }}>
                <td style={st.td}>Total</td>
                {activeSizes.map(sz => {
                  const total = activeBoxTypes.reduce((s, bt) => s + (grid.get(`${bt.id}_${sz.id}`) || 0), 0)
                  return <td key={sz.id} style={{ ...st.td, textAlign: 'center' }}>{total || ''}</td>
                })}
                <td style={{ ...st.td, textAlign: 'center', fontSize: 14 }}>{gridGrandTotal(grid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  // ── Page ──────────────────────────────────────────────────────────

  if (!contextLoaded) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={{ flex: 1, padding: '32px 40px', overflowX: 'auto' }}>
        {/* Header controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a2a3a', margin: 0 }}>Daily Packout</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select style={st.select} value={selectedPackhouse} onChange={e => setSelectedPackhouse(e.target.value)}>
              {packhouses.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" style={st.select} value={packDate} onChange={e => setPackDate(e.target.value)} />
            <a href={`/packshed/stock?date=${packDate}`} style={{ ...st.btnSecondary, textDecoration: 'none' }}>
              Floor Stock
            </a>
            <button style={st.btnPrimary} onClick={handleExportPdf} disabled={activeBoxTypes.length === 0}>
              Export PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading...</div>
        ) : activeBoxTypes.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>
            No box types configured. Run the Paltrack sync first.
          </div>
        ) : (
          <>
            {/* ── Session header: orchard runs ─────────────────────────── */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a', margin: 0 }}>
                  Orchard Runs
                  {sessions.length > 0 && <span style={{ fontWeight: 400, color: '#8a95a0', marginLeft: 8 }}>({sessions.length})</span>}
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ ...st.btnSecondary }}
                    onClick={() => setShowAddRow(!showAddRow)}
                  >
                    + Add Session
                  </button>
                  <button
                    style={{ ...st.btnPrimary, opacity: sessionsDirty ? 1 : 0.4 }}
                    onClick={saveSessions}
                    disabled={!sessionsDirty || savingSessions}
                  >
                    {savingSessions ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {sessions.length === 0 && !showAddRow ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ color: '#8a95a0', fontSize: 14, marginBottom: 12 }}>
                    No sessions yet — add an orchard run to get started
                  </div>
                  <button style={st.btnPrimary} onClick={() => setShowAddRow(true)}>
                    + Add Orchard Run
                  </button>
                </div>
              ) : (
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ ...st.sessionTh, width: 36 }}>#</th>
                      <th style={st.sessionTh}>Orchard</th>
                      <th style={st.sessionTh}>Variety</th>
                      <th style={st.sessionTh}>Pallets</th>
                      <th style={st.sessionTh}>Bins Packed</th>
                      <th style={st.sessionTh}>Start</th>
                      <th style={st.sessionTh}>End</th>
                      <th style={st.sessionTh}>Smous (kg)</th>
                      <th style={{ ...st.sessionTh, width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, idx) => {
                      const orchPallets = pallets.filter(p => s.orchard_id && p.orchard_id === s.orchard_id).length
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ ...st.sessionTd, color: '#8a95a0', fontSize: 11 }}>{s.seq}</td>
                          <td style={{ ...st.sessionTd, fontWeight: 600 }}>{s.orchard_name}</td>
                          <td style={st.sessionTd}>
                            <input
                              type="text" style={{ ...st.sessionInput, width: 100 }}
                              value={s.variety || ''}
                              placeholder="variety"
                              onChange={e => updateSession(idx, 'variety', e.target.value || null)}
                            />
                          </td>
                          <td style={{ ...st.sessionTd, textAlign: 'center' }}>
                            <span style={{ background: '#eef2f7', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>{orchPallets}</span>
                          </td>
                          <td style={st.sessionTd}>
                            <input
                              type="number" min={0} style={st.sessionInput}
                              value={s.bins_packed ?? ''}
                              placeholder="0"
                              onChange={e => updateSession(idx, 'bins_packed', parseInt(e.target.value) || null)}
                            />
                          </td>
                          <td style={st.sessionTd}>
                            <input
                              type="time" style={st.sessionInput}
                              value={s.start_time}
                              onChange={e => updateSession(idx, 'start_time', e.target.value)}
                            />
                          </td>
                          <td style={st.sessionTd}>
                            <input
                              type="time" style={st.sessionInput}
                              value={s.end_time}
                              onChange={e => updateSession(idx, 'end_time', e.target.value)}
                            />
                          </td>
                          <td style={st.sessionTd}>
                            <input
                              type="number" min={0} step={0.1} style={st.sessionInput}
                              value={s.smous_weight_kg ?? ''}
                              placeholder="0"
                              onChange={e => updateSession(idx, 'smous_weight_kg', parseFloat(e.target.value) || null)}
                            />
                          </td>
                          <td style={{ ...st.sessionTd, whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => moveSession(idx, 'up')}
                              disabled={idx === 0}
                              style={{ ...st.tinyBtn, background: '#eef2f7', color: '#2176d9', marginRight: 2, opacity: idx === 0 ? 0.3 : 1 }}
                              title="Move up"
                            >{'\u25B2'}</button>
                            <button
                              onClick={() => moveSession(idx, 'down')}
                              disabled={idx === sessions.length - 1}
                              style={{ ...st.tinyBtn, background: '#eef2f7', color: '#2176d9', marginRight: 4, opacity: idx === sessions.length - 1 ? 0.3 : 1 }}
                              title="Move down"
                            >{'\u25BC'}</button>
                            <button
                              onClick={() => deleteSession(s.id)}
                              style={{ ...st.tinyBtn, background: '#fef2f2', color: '#e85a4a' }}
                              title="Delete"
                            >Del</button>
                          </td>
                        </tr>
                      )
                    })}
                    {showAddRow && (
                      <tr style={{ borderBottom: '1px solid #f0f0f0', background: '#f0f7ff' }}>
                        <td style={st.sessionTd}></td>
                        <td style={st.sessionTd} colSpan={2}>
                          <select
                            style={{ ...st.select, width: '100%' }}
                            value=""
                            onChange={e => { if (e.target.value) addSession(e.target.value) }}
                            disabled={addingSession}
                          >
                            <option value="">Select orchard...</option>
                            {orchards.map(o => (
                              <option key={o.id} value={o.id}>
                                {o.orchard_nr != null ? `${o.orchard_nr} – ` : ''}{o.name}
                                {o.variety ? ` (${o.variety})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={st.sessionTd} colSpan={5}>
                          <span style={{ color: '#8a95a0', fontSize: 12 }}>
                            {addingSession ? 'Adding...' : 'Select an orchard to add a session'}
                          </span>
                        </td>
                        <td style={st.sessionTd}>
                          <button onClick={() => setShowAddRow(false)} style={{ ...st.tinyBtn, background: '#e5e7eb', color: '#5a6a70' }}>Cancel</button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8f9fb', fontWeight: 700 }}>
                      <td style={st.sessionTd}></td>
                      <td style={st.sessionTd}>Total</td>
                      <td style={st.sessionTd} />
                      <td style={{ ...st.sessionTd, textAlign: 'center' }}>{pallets.length}</td>
                      <td style={{ ...st.sessionTd, textAlign: 'center' }}>{totalBinsPacked || '-'}</td>
                      <td style={st.sessionTd} />
                      <td style={st.sessionTd} />
                      <td style={{ ...st.sessionTd, textAlign: 'center' }}>{totalSmousKg || '-'}</td>
                      <td style={st.sessionTd} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Unmatched pallets warning */}
            {unmatchedPallets && (
              <div style={{
                background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10,
                padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#9a3412',
              }}>
                <strong>{unmatchedPallets.count} pallets</strong> for orchards without a session:
                {' '}{unmatchedPallets.codes.join(', ')}
              </div>
            )}

            {/* Orchard filter pills */}
            {sessions.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                <button
                  style={{ ...st.pill, ...(selectedOrchard === 'all' ? st.pillActive : {}) }}
                  onClick={() => setSelectedOrchard('all')}
                >All Orchards</button>
                {sessions.map(s => (
                  <button
                    key={s.id}
                    style={{ ...st.pill, ...(selectedOrchard === s.orchard_id ? st.pillActive : {}) }}
                    onClick={() => s.orchard_id && setSelectedOrchard(s.orchard_id)}
                  >
                    {s.orchard_name}
                    {s.variety && <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>{s.variety}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
              <KPI label="Bins Packed" value={totalBinsPacked || '-'} sub={`${binsWeighed} weighed, avg ${avgBinWeight.toFixed(1)} kg`} />
              <KPI label="Total KG In" value={totalKgIn > 0 ? Math.round(totalKgIn).toLocaleString() : '-'} sub={totalBinsPacked ? `${totalBinsPacked} x ${avgBinWeight.toFixed(1)} kg` : 'enter bins packed above'} color="#2176d9" />
              <KPI label="Net Cartons" value={totalCartonsOut.toLocaleString()} sub="packed today" />
              <KPI label="Conversion" value={totalKgIn > 0 ? `${conversionPct.toFixed(1)}%` : '-'} sub="cartons / KG in" color={conversionPct > 80 ? '#4caf72' : conversionPct > 0 ? '#e6a817' : '#8a95a0'} />
              <KPI label="Loss" value={totalKgIn > 0 ? `${lossPct.toFixed(1)}%` : '-'} sub="unaccounted" color={lossPct < 5 && totalKgIn > 0 ? '#4caf72' : totalKgIn > 0 ? '#e85a4a' : '#8a95a0'} />
            </div>

            {/* Grids */}
            {renderGrid('Full Pallets (from Paltrack)', palletGrid)}
            {renderGrid('Floor Stock Today', floorTodayGrid)}
            {renderGrid('Opening Stock (Yesterday)', floorYestGrid, '#fafaf5')}
            {renderGrid('Net Packed', netPackedGrid, '#f0f7ff')}

            {/* Bin Weights — summary cards + detail table */}
            <div style={{ marginBottom: 28 }}>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                {(['pack', 'juice', 'rot'] as const).map(cat => {
                  const binCount = catTotalBins(cat)
                  const weighings = (binsByCategory[cat] || []).length
                  const colors = { pack: '#2176d9', juice: '#e6a817', rot: '#e85a4a' }
                  return (
                    <div key={cat} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase', marginBottom: 8 }}>
                        {cat} ({binCount} bins / {weighings} weighings)
                      </div>
                      {weighings === 0 ? (
                        <div style={{ color: '#d4d8de', fontSize: 13 }}>No bins weighed</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 24, fontWeight: 800, color: colors[cat] }}>
                            {catTotal(cat).toFixed(0)} <span style={{ fontSize: 12, fontWeight: 400, color: '#8a95a0' }}>kg</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 4 }}>
                            Avg: {catAvg(cat).toFixed(1)} kg/bin
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Collapsible detail table */}
              {filteredBinWeights.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <button
                    onClick={() => setWeighTableOpen(!weighTableOpen)}
                    style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a' }}>
                      Weigh Records ({filteredBinWeights.length} weighings, {filteredBinWeights.reduce((s, b) => s + (b.bin_count || 1), 0)} bins)
                    </span>
                    <span style={{ fontSize: 18, color: '#8a95a0' }}>{weighTableOpen ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {weighTableOpen && (
                    <div style={{ overflow: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f8f9fb' }}>
                            <th style={st.th}>#</th>
                            <th style={st.th}>Cat</th>
                            <th style={st.th}>Type</th>
                            <th style={{ ...st.th, textAlign: 'right' }}>Gross</th>
                            <th style={{ ...st.th, textAlign: 'right' }}>Tare</th>
                            <th style={{ ...st.th, textAlign: 'right' }}>Net</th>
                            <th style={{ ...st.th, textAlign: 'center' }}>Bins</th>
                            <th style={{ ...st.th, textAlign: 'right' }}>Per Bin</th>
                            <th style={{ ...st.th, textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBinWeights.map(b => {
                            const bc = b.bin_count || 1
                            const perBin = b.net_weight_kg / bc
                            const catColors: Record<string, string> = { pack: '#2176d9', juice: '#e6a817', rot: '#e85a4a' }
                            const isEditing = editingWeighId === b.id

                            if (isEditing) {
                              const editTare = (TARE_PER_BIN[editBinType] || 38) * editBinCount
                              const editNet = (parseFloat(editGross) || 0) - editTare
                              const editPerBin = editBinCount > 0 ? editNet / editBinCount : 0
                              return (
                                <tr key={b.id} style={{ borderBottom: '1px solid #f0f0f0', background: '#fffde7' }}>
                                  <td style={st.td}>{b.seq}</td>
                                  <td style={st.td}>
                                    <span style={{ color: catColors[b.category], fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>{b.category}</span>
                                  </td>
                                  <td style={st.td}>
                                    <select value={editBinType} onChange={e => setEditBinType(e.target.value as any)} style={st.editInput}>
                                      <option value="plastic">plastic</option>
                                      <option value="wood">wood</option>
                                    </select>
                                  </td>
                                  <td style={{ ...st.td, textAlign: 'right' }}>
                                    <input type="number" step="0.5" value={editGross} onChange={e => setEditGross(e.target.value)} style={{ ...st.editInput, width: 75, textAlign: 'right' as const }} />
                                  </td>
                                  <td style={{ ...st.td, textAlign: 'right', color: '#8a95a0' }}>{editTare}</td>
                                  <td style={{ ...st.td, textAlign: 'right', fontWeight: 600 }}>{editNet.toFixed(1)}</td>
                                  <td style={{ ...st.td, textAlign: 'center' }}>
                                    <select value={editBinCount} onChange={e => setEditBinCount(parseInt(e.target.value))} style={{ ...st.editInput, width: 45 }}>
                                      <option value={1}>1</option>
                                      <option value={2}>2</option>
                                      <option value={3}>3</option>
                                    </select>
                                  </td>
                                  <td style={{ ...st.td, textAlign: 'right', fontWeight: 700 }}>{editPerBin.toFixed(1)}</td>
                                  <td style={{ ...st.td, textAlign: 'center' }}>
                                    <button onClick={saveEditWeigh} disabled={savingWeigh} style={{ ...st.tinyBtn, background: '#4caf72', color: '#fff' }}>
                                      {savingWeigh ? '...' : 'Save'}
                                    </button>
                                    <button onClick={() => setEditingWeighId(null)} style={{ ...st.tinyBtn, background: '#e5e7eb', color: '#5a6a70', marginLeft: 4 }}>
                                      Cancel
                                    </button>
                                  </td>
                                </tr>
                              )
                            }

                            return (
                              <tr key={b.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={st.td}>{b.seq}</td>
                                <td style={st.td}>
                                  <span style={{ color: catColors[b.category] || '#1a2a3a', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>{b.category}</span>
                                </td>
                                <td style={st.td}>{b.bin_type}</td>
                                <td style={{ ...st.td, textAlign: 'right' }}>{b.gross_weight_kg}</td>
                                <td style={{ ...st.td, textAlign: 'right' }}>{b.tare_weight_kg}</td>
                                <td style={{ ...st.td, textAlign: 'right', fontWeight: 600 }}>{b.net_weight_kg.toFixed(1)}</td>
                                <td style={{ ...st.td, textAlign: 'center' }}>{bc}</td>
                                <td style={{ ...st.td, textAlign: 'right', fontWeight: 700 }}>{perBin.toFixed(1)}</td>
                                <td style={{ ...st.td, textAlign: 'center' }}>
                                  <button onClick={() => startEditWeigh(b)} style={{ ...st.tinyBtn, background: '#eef2f7', color: '#2176d9' }}>Edit</button>
                                  <button onClick={() => deleteWeigh(b.id)} style={{ ...st.tinyBtn, background: '#fef2f2', color: '#e85a4a', marginLeft: 4 }}>Del</button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8f9fb', fontWeight: 700 }}>
                            <td style={st.td} colSpan={5}>Total</td>
                            <td style={{ ...st.td, textAlign: 'right' }}>{filteredBinWeights.reduce((s, b) => s + b.net_weight_kg, 0).toFixed(1)}</td>
                            <td style={{ ...st.td, textAlign: 'center' }}>{filteredBinWeights.reduce((s, b) => s + (b.bin_count || 1), 0)}</td>
                            <td style={{ ...st.td, textAlign: 'right' }}>{avgBinWeight.toFixed(1)}</td>
                            <td style={st.td}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mass Balance */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 20, marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a', marginBottom: 12 }}>Mass Balance</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase', marginBottom: 8 }}>KG In</div>
                  <MBRow label={totalBinsPacked ? `${totalBinsPacked} bins x ${avgBinWeight.toFixed(1)} kg` : 'Bins packed not entered'} value={totalKgIn} />
                  <MBRow label="Total KG In" value={totalKgIn} bold />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase', marginBottom: 8 }}>KG Out</div>
                  <MBRow label="Packed Cartons" value={totalKgOutCartons} />
                  <MBRow label="Juice" value={juiceKg} />
                  <MBRow label="Rot" value={rotKg} />
                  <MBRow label="Smous" value={totalSmousKg} />
                  <MBRow label="Total KG Out" value={totalKgOut} bold />
                  <div style={{ borderTop: '2px solid #e5e7eb', marginTop: 8, paddingTop: 8 }}>
                    <MBRow label="Difference" value={totalKgIn - totalKgOut} bold color={totalKgIn > 0 && Math.abs(totalKgIn - totalKgOut) < totalKgIn * 0.03 ? '#4caf72' : totalKgIn > 0 ? '#e85a4a' : '#8a95a0'} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ── Components ──────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || '#1a2a3a' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#8a95a0', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function MBRow({ label, value, bold, color }: { label: string; value: number; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, fontWeight: bold ? 700 : 400 }}>
      <span style={{ color: '#5a6a70' }}>{label}</span>
      <span style={{ color: color || '#1a2a3a' }}>{value.toFixed(0)} kg</span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #d4d8de', fontSize: 13, background: '#fff' },
  btnPrimary: { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2176d9', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '8px 20px', borderRadius: 8, border: '1px solid #d4d8de', background: '#fff', color: '#1a2a3a', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  pill: { padding: '6px 16px', borderRadius: 20, borderWidth: 1, borderStyle: 'solid' as const, borderColor: '#d4d8de', background: '#fff', color: '#5a6a70', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  pillActive: { background: '#2176d9', color: '#fff', borderColor: '#2176d9' } as React.CSSProperties,
  th: { padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '2px solid #e5e7eb' },
  td: { padding: '5px 8px', fontSize: 12 },
  sessionTh: { padding: '8px 10px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const },
  sessionTd: { padding: '6px 10px', fontSize: 13 },
  sessionInput: { width: 80, padding: '5px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, textAlign: 'center' as const, outline: 'none', background: '#fafbfc' },
  editInput: { padding: '4px 6px', borderRadius: 5, border: '1px solid #d4d8de', fontSize: 12, background: '#fff', outline: 'none' },
  tinyBtn: { padding: '3px 8px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
}

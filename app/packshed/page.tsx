'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'

// ── Types ──────────────────────────────────────────────────────────────────

interface Packhouse { id: string; code: string; name: string }
interface BoxType { id: string; code: string; name: string; pack_code: string; grade: string; cartons_per_pallet: number; weight_per_carton_kg: number | null }
interface Size { id: string; label: string; sort_order: number }
interface ValidCombo { box_type_id: string; size_id: string }
interface PalletRow { box_type_id: string | null; size_id: string | null; carton_count: number; orchard_id: string | null; orchard_code: string | null; variety: string | null }
interface StockCell { box_type_id: string; size_id: string; carton_count: number; orchard_id: string | null }
interface BinWeight { category: string; net_weight_kg: number; seq: number; bin_type: string; gross_weight_kg: number; tare_weight_kg: number; orchard_id: string | null }
interface OrchardRef { id: string; name: string; orchard_nr: number | null }

interface SessionRow {
  id?: string
  orchard_id: string | null
  orchard_code: string | null
  variety: string | null
  orchard_name: string
  bins_packed: number | null
  start_time: string
  end_time: string
  smous_weight_kg: number | null
  _dirty?: boolean
}

export default function DailyPackoutPage() {
  const supabase = createClient()
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

  const [selectedPackhouse, setSelectedPackhouse] = useState('')
  const [selectedOrchard, setSelectedOrchard] = useState<string>('all')
  const [packDate, setPackDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

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
      supabase.from('orchards').select('id,name,orchard_nr').eq('is_active', true).order('orchard_nr'),
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
    const yesterday = new Date(packDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yDate = yesterday.toISOString().split('T')[0]

    const [palRes, fsToday, fsYest, bwRes, sessRes] = await Promise.all([
      supabase.from('packout_pallets').select('box_type_id,size_id,carton_count,orchard_id,orchard_code,variety').eq('packhouse_id', selectedPackhouse).eq('pack_date', packDate),
      supabase.from('packout_floor_stock').select('box_type_id,size_id,carton_count,orchard_id').eq('packhouse_id', selectedPackhouse).eq('stock_date', packDate),
      supabase.from('packout_floor_stock').select('box_type_id,size_id,carton_count,orchard_id').eq('packhouse_id', selectedPackhouse).eq('stock_date', yDate),
      supabase.from('packout_bin_weights').select('category,net_weight_kg,seq,bin_type,gross_weight_kg,tare_weight_kg,orchard_id').eq('packhouse_id', selectedPackhouse).eq('weigh_date', packDate).order('category').order('seq'),
      supabase.from('packout_daily_sessions').select('id,orchard_id,variety,bins_packed,start_time,end_time,smous_weight_kg').eq('packhouse_id', selectedPackhouse).eq('pack_date', packDate),
    ])

    const palletData = palRes.data || []
    setPallets(palletData)
    setFloorStockToday(fsToday.data || [])
    setFloorStockYesterday(fsYest.data || [])
    setBinWeights(bwRes.data || [])

    // Build session rows: merge saved sessions with orchards from pallets
    const savedSessions = sessRes.data || []
    const savedByOrchard = new Map<string, any>()
    for (const s of savedSessions) {
      if (s.orchard_id) savedByOrchard.set(s.orchard_id, s)
    }

    // Get distinct orchards from pallets
    const orchardSet = new Map<string, { orchard_id: string | null; orchard_code: string; variety: string | null; pallets: number }>()
    for (const p of palletData) {
      const key = p.orchard_id || p.orchard_code || 'unknown'
      if (!orchardSet.has(key)) {
        orchardSet.set(key, { orchard_id: p.orchard_id, orchard_code: p.orchard_code || '', variety: p.variety, pallets: 0 })
      }
      orchardSet.get(key)!.pallets++
    }

    const sessionRows: SessionRow[] = []
    for (const [, orch] of orchardSet) {
      const saved = orch.orchard_id ? savedByOrchard.get(orch.orchard_id) : null
      const orchardName = orch.orchard_id
        ? (orchards.find(o => o.id === orch.orchard_id)?.name || `Orch ${orch.orchard_code}`)
        : `Orch ${orch.orchard_code}`

      sessionRows.push({
        id: saved?.id,
        orchard_id: orch.orchard_id,
        orchard_code: orch.orchard_code,
        variety: saved?.variety || orch.variety,
        orchard_name: orchardName,
        bins_packed: saved?.bins_packed ?? null,
        start_time: saved?.start_time || '',
        end_time: saved?.end_time || '',
        smous_weight_kg: saved?.smous_weight_kg ?? null,
      })
    }

    // Also include saved sessions for orchards not in today's pallets
    for (const s of savedSessions) {
      if (s.orchard_id && !orchardSet.has(s.orchard_id)) {
        const orchardName = orchards.find(o => o.id === s.orchard_id)?.name || 'Unknown'
        sessionRows.push({
          id: s.id,
          orchard_id: s.orchard_id,
          orchard_code: null,
          variety: s.variety,
          orchard_name: orchardName,
          bins_packed: s.bins_packed,
          start_time: s.start_time || '',
          end_time: s.end_time || '',
          smous_weight_kg: s.smous_weight_kg,
        })
      }
    }

    setSessions(sessionRows)
    setLoading(false)
  }

  // ── Session editing ─────────────────────────────────────────────────

  function updateSession(idx: number, field: keyof SessionRow, value: any) {
    setSessions(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value, _dirty: true } : s))
  }

  async function saveSessions() {
    setSavingSessions(true)
    const dirtyRows = sessions.filter(s => s._dirty)

    for (const row of dirtyRows) {
      const payload: any = {
        packhouse_id: selectedPackhouse,
        pack_date: packDate,
        orchard_id: row.orchard_id,
        variety: row.variety,
        bins_packed: row.bins_packed,
        start_time: row.start_time || null,
        end_time: row.end_time || null,
        smous_weight_kg: row.smous_weight_kg,
      }

      if (row.id) {
        await supabase.from('packout_daily_sessions').update(payload).eq('id', row.id)
      } else {
        // Need org_id
        const ph = packhouses.find(p => p.id === selectedPackhouse)
        const { data: phData } = await supabase.from('packhouses').select('organisation_id').eq('id', selectedPackhouse).single()
        if (phData) {
          payload.organisation_id = phData.organisation_id
          const { data } = await supabase.from('packout_daily_sessions').insert(payload).select('id').single()
          if (data) row.id = data.id
        }
      }
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

  const filteredFloorToday = useMemo(() => {
    if (selectedOrchard === 'all') return floorStockToday
    return floorStockToday.filter(f => f.orchard_id === selectedOrchard)
  }, [floorStockToday, selectedOrchard])

  const filteredFloorYest = useMemo(() => {
    if (selectedOrchard === 'all') return floorStockYesterday
    return floorStockYesterday.filter(f => f.orchard_id === selectedOrchard)
  }, [floorStockYesterday, selectedOrchard])

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

  // ── Bin weight KPIs ───────────────────────────────────────────────

  const binsByCategory = useMemo(() => {
    const groups: Record<string, BinWeight[]> = { pack: [], juice: [], rot: [] }
    for (const b of filteredBinWeights) groups[b.category]?.push(b)
    return groups
  }, [filteredBinWeights])

  function catAvg(cat: string): number {
    const bins = binsByCategory[cat] || []
    if (bins.length === 0) return 0
    return bins.reduce((s, b) => s + b.net_weight_kg, 0) / bins.length
  }

  function catTotal(cat: string): number {
    return (binsByCategory[cat] || []).reduce((s, b) => s + b.net_weight_kg, 0)
  }

  // Mass balance uses bins_packed × avg bin weight for KG In (not weighed bins)
  const avgBinWeight = catAvg('pack')
  const totalKgIn = totalBinsPacked > 0 && avgBinWeight > 0
    ? totalBinsPacked * avgBinWeight
    : catTotal('pack')
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
                <button
                  style={{ ...st.btnPrimary, opacity: sessionsDirty ? 1 : 0.4 }}
                  onClick={saveSessions}
                  disabled={!sessionsDirty || savingSessions}
                >
                  {savingSessions ? 'Saving...' : 'Save'}
                </button>
              </div>

              {sessions.length === 0 ? (
                <div style={{ color: '#8a95a0', fontSize: 13, padding: '12px 0' }}>
                  No pallets found for this date. Orchards will appear here automatically from Paltrack data.
                </div>
              ) : (
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={st.sessionTh}>Orchard</th>
                      <th style={st.sessionTh}>Variety</th>
                      <th style={st.sessionTh}>Pallets</th>
                      <th style={st.sessionTh}>Bins Packed</th>
                      <th style={st.sessionTh}>Start</th>
                      <th style={st.sessionTh}>End</th>
                      <th style={st.sessionTh}>Smous (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, idx) => {
                      const orchPallets = pallets.filter(p =>
                        (s.orchard_id && p.orchard_id === s.orchard_id) ||
                        (!s.orchard_id && p.orchard_code === s.orchard_code)
                      ).length
                      return (
                        <tr key={s.orchard_id || s.orchard_code || idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ ...st.sessionTd, fontWeight: 600 }}>{s.orchard_name}</td>
                          <td style={st.sessionTd}>
                            <span style={{ color: '#8a95a0' }}>{s.variety || '-'}</span>
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
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8f9fb', fontWeight: 700 }}>
                      <td style={st.sessionTd}>Total</td>
                      <td style={st.sessionTd} />
                      <td style={{ ...st.sessionTd, textAlign: 'center' }}>{pallets.length}</td>
                      <td style={{ ...st.sessionTd, textAlign: 'center' }}>{totalBinsPacked || '-'}</td>
                      <td style={st.sessionTd} />
                      <td style={st.sessionTd} />
                      <td style={{ ...st.sessionTd, textAlign: 'center' }}>{totalSmousKg || '-'}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Orchard filter pills */}
            {sessions.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                <button
                  style={{ ...st.pill, ...(selectedOrchard === 'all' ? st.pillActive : {}) }}
                  onClick={() => setSelectedOrchard('all')}
                >All Orchards</button>
                {sessions.map(s => (
                  <button
                    key={s.orchard_id || s.orchard_code}
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
              <KPI label="Bins Packed" value={totalBinsPacked || binsByCategory.pack.length} sub={`Avg ${avgBinWeight.toFixed(1)} kg/bin`} />
              <KPI label="Total KG In" value={Math.round(totalKgIn).toLocaleString()} sub={totalBinsPacked ? `${totalBinsPacked} bins` : 'from weighed bins'} color="#2176d9" />
              <KPI label="Net Cartons" value={totalCartonsOut.toLocaleString()} sub="packed today" />
              <KPI label="Conversion" value={totalKgIn > 0 ? `${conversionPct.toFixed(1)}%` : '-'} sub="cartons / KG in" color={conversionPct > 80 ? '#4caf72' : conversionPct > 0 ? '#e6a817' : '#8a95a0'} />
              <KPI label="Loss" value={totalKgIn > 0 ? `${lossPct.toFixed(1)}%` : '-'} sub="unaccounted" color={lossPct < 5 && totalKgIn > 0 ? '#4caf72' : totalKgIn > 0 ? '#e85a4a' : '#8a95a0'} />
            </div>

            {/* Grids */}
            {renderGrid('Full Pallets (from Paltrack)', palletGrid)}
            {renderGrid('Floor Stock Today', floorTodayGrid)}
            {renderGrid('Opening Stock (Yesterday)', floorYestGrid, '#fafaf5')}
            {renderGrid('Net Packed', netPackedGrid, '#f0f7ff')}

            {/* Bin Weights */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
              {(['pack', 'juice', 'rot'] as const).map(cat => {
                const bins = binsByCategory[cat] || []
                const colors = { pack: '#2176d9', juice: '#e6a817', rot: '#e85a4a' }
                return (
                  <div key={cat} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase', marginBottom: 8 }}>
                      {cat} Bins ({bins.length})
                    </div>
                    {bins.length === 0 ? (
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

            {/* Mass Balance */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 20, marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a', marginBottom: 12 }}>Mass Balance</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase', marginBottom: 8 }}>KG In</div>
                  <MBRow label={`${totalBinsPacked || binsByCategory.pack.length} bins × ${avgBinWeight.toFixed(1)} kg`} value={totalKgIn} />
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
  pill: { padding: '6px 16px', borderRadius: 20, borderWidth: 1, borderStyle: 'solid' as const, borderColor: '#d4d8de', background: '#fff', color: '#5a6a70', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  pillActive: { background: '#2176d9', color: '#fff', borderColor: '#2176d9' } as React.CSSProperties,
  th: { padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '2px solid #e5e7eb' },
  td: { padding: '5px 8px', fontSize: 12 },
  sessionTh: { padding: '8px 10px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const },
  sessionTd: { padding: '6px 10px', fontSize: 13 },
  sessionInput: { width: 80, padding: '5px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, textAlign: 'center' as const, outline: 'none', background: '#fafbfc' },
}

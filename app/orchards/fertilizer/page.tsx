'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import FertilizerTable from '@/app/components/fertilizer/FertilizerTable'
import FertilizerOrderList from '@/app/components/fertilizer/FertilizerOrderList'
import ConfirmApplications, { ConfirmRow } from '@/app/components/fertilizer/ConfirmApplications'
import FertilizerDashboard, { DashboardRow, LeafNutrientFlag } from '@/app/components/fertilizer/FertilizerDashboard'
import ProductSettings from '@/app/components/fertilizer/ProductSettings'
import ImportModal from '@/app/components/fertilizer/ImportModal'
import DispatchView from '@/app/components/fertilizer/DispatchView'
import OrchardFertDetail from '@/app/components/fertilizer/OrchardFertDetail'
import SpreaderSettings from '@/app/components/fertilizer/SpreaderSettings'

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  return `${mo < 8 ? yr - 1 : yr}/${String(mo < 8 ? yr : yr + 1).slice(-2)}`
}

function buildSeasonOptions(fromYear: number): string[] {
  const currentStartYr = parseInt(getCurrentSeason().split('/')[0])
  const seasons: string[] = []
  for (let yr = fromYear; yr <= currentStartYr; yr++)
    seasons.push(`${yr}/${String(yr + 1).slice(-2)}`)
  return seasons.reverse()
}

interface Farm { id: string; full_name: string; code: string }
interface Commodity { id: string; name: string }

interface SummaryRow {
  recommendation_id: string
  farm_id: string
  farm_name: string
  commodity_name: string
  season: string
  program_type: string
  soil_scientist: string
  reference_no: string
  timing_id: string
  timing_label: string
  timing_sort: number
  product_id: string
  product_name: string
  product_unit: string
  orchard_id: string
  orchard_name: string
  orchard_nr: number | null
  variety: string | null
  legacy_orchard_id: number
  source_block_name: string
  rate_per_ha: number
  unit: string
  total_qty: number | null
  ha: number | null
  target_ton_ha: number | null
  n_pct: number
  p_pct: number
  k_pct: number
}

interface OrderRow {
  timing_label: string
  timing_sort: number
  product_id: string
  product_name: string
  unit: string
  total_qty: number | null
  total_ha: number | null
  avg_rate_per_ha: number | null
  orchard_count: number
  n_pct: number
  p_pct: number
  k_pct: number
}

type ViewMode = 'dashboard' | 'table' | 'order' | 'confirm' | 'dispatch' | 'products' | 'spreaders'

export default function FertilizerPage() {
  const { farmIds, isSuperAdmin, contextLoaded, orgId, allowedRoutes, allowed } = usePageGuard()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [farms, setFarms] = useState<Farm[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [data, setData] = useState<SummaryRow[]>([])
  const [orderData, setOrderData] = useState<OrderRow[]>([])
  const [modules, setModules] = useState<string[]>(['farmscout'])

  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null)
  const [season, setSeason] = useState(getCurrentSeason())
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [showImport, setShowImport] = useState(false)
  const [confirmData, setConfirmData] = useState<ConfirmRow[]>([])
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardRow[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardProduction, setDashboardProduction] = useState<Record<string, { tonHa: number | null }>>({})
  const [dashboardLeafFlags, setDashboardLeafFlags] = useState<LeafNutrientFlag[]>([])
  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)

  const seasonOptions = buildSeasonOptions(2018)

  // Load farms + commodities + modules
  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const [{ data: farmData }, { data: commData }] = await Promise.all([
        isSuperAdmin
          ? supabase.from('farms').select('id, full_name, code').eq('is_active', true).order('full_name')
          : supabase.from('farms').select('id, full_name, code').in('id', farmIds).eq('is_active', true).order('full_name'),
        supabase.from('commodities').select('id, name').order('name'),
      ])
      setFarms(farmData || [])
      setCommodities(commData || [])
      if (farmData?.length && !selectedFarmId) setSelectedFarmId(farmData[0].id)

      if (orgId) {
        const { data: org } = await supabase.from('organisations').select('modules').eq('id', orgId).single()
        if (org?.modules) setModules(org.modules)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin, orgId])

  // Load data when farm or season changes
  const fetchData = useCallback(async () => {
    if (!selectedFarmId) return
    setLoading(true)

    try {
      const [summaryRes, orderRes] = await Promise.all([
        fetch(`/api/fertilizer?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`),
        fetch(`/api/fertilizer/order?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`),
      ])

      const summaryData = summaryRes.ok ? await summaryRes.json() : []
      const orderList = orderRes.ok ? await orderRes.json() : []

      setData(summaryData)
      setOrderData(orderList)
    } catch {
      setData([])
      setOrderData([])
    } finally {
      setLoading(false)
    }
  }, [selectedFarmId, season])

  const fetchConfirmData = useCallback(async () => {
    if (!selectedFarmId) return
    setConfirmLoading(true)
    try {
      const res = await fetch(`/api/fertilizer/confirm?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`)
      setConfirmData(res.ok ? await res.json() : [])
    } catch { setConfirmData([]) }
    finally { setConfirmLoading(false) }
  }, [selectedFarmId, season])

  const fetchDashboardData = useCallback(async () => {
    if (!selectedFarmId) return
    setDashboardLoading(true)
    try {
      // Fetch dashboard summary, production, leaf analysis, and confirm data in parallel
      const [dashRes, prodRes, leafRes, confirmRes] = await Promise.all([
        fetch(`/api/fertilizer/confirm?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}&view=dashboard`),
        supabase.rpc('get_production_summary', { p_farm_ids: [selectedFarmId], p_season: season }),
        supabase.rpc('get_leaf_analysis_summary', { p_farm_ids: [selectedFarmId], p_season: season }),
        fetch(`/api/fertilizer/confirm?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`),
      ])

      setDashboardData(dashRes.ok ? await dashRes.json() : [])

      // Build production lookup
      const prodMap: Record<string, { tonHa: number | null }> = {}
      for (const r of (prodRes.data || []) as { orchard_id: string; ton_ha: number | null }[]) {
        prodMap[r.orchard_id] = { tonHa: r.ton_ha != null ? Number(r.ton_ha) : null }
      }
      setDashboardProduction(prodMap)

      // Build leaf nutrient flags (N, K only — per Dr Marie's advice)
      const confirmDataRaw = confirmRes.ok ? await confirmRes.json() as {
        orchard_id: string; orchard_name: string; product_name: string; confirmed: boolean
      }[] : []

      // Load norms for flagging
      const normsRes = await fetch('/api/leaf-analysis/norms')
      const normsData = normsRes.ok ? (await normsRes.json()).norms as {
        commodity_id: string; nutrients: { code: string }; min_optimal: number; max_optimal: number
        min_adequate: number | null; max_adequate: number | null; variety: string | null
      }[] : []

      // Build norms lookup
      const normsLookup: Record<string, { min: number; max: number }> = {}
      for (const n of normsData) {
        if (!n.nutrients?.code) continue
        const key = `${n.commodity_id}:${n.nutrients.code}`
        normsLookup[key] = {
          min: n.min_adequate ?? n.min_optimal,
          max: n.max_adequate ?? n.max_optimal,
        }
      }

      // Get orchard commodity mapping
      const { data: orchardCommData } = await supabase
        .from('orchards').select('id, name, orchard_nr, variety, commodity_id')
        .eq('farm_id', selectedFarmId).eq('is_active', true)
      const orchardComm: Record<string, string> = {}
      const orchardNames: Record<string, string> = {}
      const orchardMeta: Record<string, { nr: number | null; variety: string | null }> = {}
      for (const o of (orchardCommData || [])) {
        orchardComm[o.id] = o.commodity_id
        orchardNames[o.id] = o.name
        orchardMeta[o.id] = { nr: o.orchard_nr ?? null, variety: o.variety ?? null }
      }

      // Get product NPK info from summary data
      const summaryRes = await fetch(`/api/fertilizer?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`)
      const summaryData = summaryRes.ok ? await summaryRes.json() as {
        product_name: string; n_pct: number; k_pct: number
      }[] : []
      const productNpk: Record<string, { n_pct: number; k_pct: number }> = {}
      for (const s of summaryData) {
        if (!productNpk[s.product_name]) productNpk[s.product_name] = { n_pct: s.n_pct || 0, k_pct: s.k_pct || 0 }
      }

      // Build per-orchard confirmed products
      const orchardProducts: Record<string, { confirmed: string[]; all: string[] }> = {}
      for (const r of confirmDataRaw) {
        if (!r.orchard_id) continue
        if (!orchardProducts[r.orchard_id]) orchardProducts[r.orchard_id] = { confirmed: [], all: [] }
        orchardProducts[r.orchard_id].all.push(r.product_name)
        if (r.confirmed) orchardProducts[r.orchard_id].confirmed.push(r.product_name)
      }

      // Leaf analysis: group by orchard → nutrient
      const leafByOrchard: Record<string, Record<string, number>> = {}
      for (const r of (leafRes.data || []) as { orchard_id: string; nutrient_code: string; value: number }[]) {
        if (!leafByOrchard[r.orchard_id]) leafByOrchard[r.orchard_id] = {}
        leafByOrchard[r.orchard_id][r.nutrient_code] = r.value
      }

      // Generate flags: N, K only (per Dr Marie)
      const flags: LeafNutrientFlag[] = []
      for (const [orchardId, nutrients] of Object.entries(leafByOrchard)) {
        const commId = orchardComm[orchardId]
        if (!commId) continue
        for (const code of ['N', 'K']) {
          const val = nutrients[code]
          if (val == null) continue
          const norm = normsLookup[`${commId}:${code}`]
          if (!norm) continue
          if (val >= norm.min && val <= norm.max) continue
          const pctField = code === 'N' ? 'n_pct' : 'k_pct'
          const op = orchardProducts[orchardId]
          const appliedProducts = op
            ? [...new Set(op.confirmed.filter(pn => (productNpk[pn]?.[pctField] || 0) > 0))]
            : []
          flags.push({
            orchardId,
            orchardName: orchardNames[orchardId] || orchardId,
            orchardNr: orchardMeta[orchardId]?.nr ?? null,
            variety: orchardMeta[orchardId]?.variety ?? null,
            nutrientCode: code,
            status: val < norm.min ? 'low' : 'high',
            appliedProducts,
          })
        }
      }
      setDashboardLeafFlags(flags)
    } catch {
      setDashboardData([])
      setDashboardProduction({})
      setDashboardLeafFlags([])
    }
    finally { setDashboardLoading(false) }
  }, [selectedFarmId, season, supabase])

  useEffect(() => {
    if (selectedFarmId) fetchData()
  }, [fetchData, selectedFarmId])

  useEffect(() => {
    if (selectedFarmId && (viewMode === 'confirm' || viewMode === 'table')) fetchConfirmData()
  }, [fetchConfirmData, selectedFarmId, viewMode])

  useEffect(() => {
    if (selectedFarmId && viewMode === 'dashboard') fetchDashboardData()
  }, [fetchDashboardData, selectedFarmId, viewMode])

  // Filter by commodity
  const filteredData = selectedCommodity
    ? data.filter(d => d.commodity_name === selectedCommodity)
    : data

  const filteredOrderData = selectedCommodity
    ? orderData // Order list is already aggregated at farm level; filter would need product-level filtering
    : orderData

  // Derive available commodities from data
  const availableCommodities = [...new Set(data.map(d => d.commodity_name).filter(Boolean))]

  // KPIs
  const uniqueOrchards = new Set(filteredData.map(d => d.orchard_id).filter(Boolean))
  const uniqueProducts = new Set(filteredData.map(d => d.product_name))
  const uniqueTimings = new Set(filteredData.map(d => d.timing_label))

  // Total NPK: sum across all lines (rate_per_ha * ha * nutrient_pct / 100)
  let totalN = 0, totalP = 0, totalK = 0
  for (const row of filteredData) {
    const qty = row.total_qty ?? (row.rate_per_ha * (row.ha ?? 0))
    totalN += qty * (row.n_pct ?? 0) / 100
    totalP += qty * (row.p_pct ?? 0) / 100
    totalK += qty * (row.k_pct ?? 0) / 100
  }

  // Recommendation meta
  const recMeta = data.length > 0 ? {
    soil_scientist: data[0].soil_scientist,
    reference_no: data[0].reference_no,
    program_type: data[0].program_type,
    recommendation_id: data[0].recommendation_id,
  } : null

  async function handleDelete() {
    if (!recMeta?.recommendation_id) return
    if (!confirm('Delete this fertilizer recommendation? This cannot be undone.')) return

    try {
      const res = await fetch('/api/fertilizer', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recMeta.recommendation_id }),
      })
      if (res.ok) fetchData()
    } catch { /* ignore */ }
  }

  if (!allowed) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eae6df', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={st.main}>
        {/* Page header */}
        <div style={st.headerRow}>
          <div>
            <h1 style={st.pageTitle}>Fertilizer Program</h1>
            <p style={st.subtitle}>
              Recommendations, rates per orchard, and order lists
              {recMeta?.soil_scientist && <span> &middot; {recMeta.soil_scientist}</span>}
              {recMeta?.reference_no && <span> &middot; Ref: {recMeta.reference_no}</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={season} onChange={e => setSeason(e.target.value)} style={st.seasonSelect}>
              {seasonOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setShowImport(true)} style={st.importBtn}>Import Excel</button>
            {recMeta && (
              <button onClick={handleDelete} style={st.deleteBtn}>Delete</button>
            )}
          </div>
        </div>

        {/* Farm pills + commodity pills + view toggle */}
        <div style={st.filterRow}>
          <div style={st.pillGroup}>
            {farms.map(f => (
              <button
                key={f.id}
                onClick={() => { setSelectedFarmId(f.id); setSelectedCommodity(null) }}
                style={{ ...st.pill, ...(selectedFarmId === f.id ? st.pillActive : {}) }}
              >
                {f.code || f.full_name}
              </button>
            ))}
          </div>
          {availableCommodities.length > 1 && (
            <>
              <div style={st.divider} />
              <div style={st.pillGroup}>
                <button
                  onClick={() => setSelectedCommodity(null)}
                  style={{ ...st.pill, ...(selectedCommodity === null ? st.pillActive : {}) }}
                >
                  All
                </button>
                {availableCommodities.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCommodity(c)}
                    style={{ ...st.pill, ...(selectedCommodity === c ? st.pillActive : {}) }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={st.divider} />
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() => setViewMode('dashboard')}
              style={{ ...st.viewBtn, ...(viewMode === 'dashboard' ? st.viewBtnActive : {}) }}
            >
              Dashboard
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{ ...st.viewBtn, ...(viewMode === 'table' ? st.viewBtnActive : {}) }}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('order')}
              style={{ ...st.viewBtn, ...(viewMode === 'order' ? st.viewBtnActive : {}) }}
            >
              Order List
            </button>
            <button
              onClick={() => setViewMode('confirm')}
              style={{ ...st.viewBtn, ...(viewMode === 'confirm' ? st.viewBtnActive : {}) }}
            >
              Confirm
            </button>
            <button
              onClick={() => setViewMode('dispatch')}
              style={{ ...st.viewBtn, ...(viewMode === 'dispatch' ? st.viewBtnActive : {}) }}
            >
              Dispatch
            </button>
            <button
              onClick={() => setViewMode('products')}
              style={{ ...st.viewBtn, ...(viewMode === 'products' ? st.viewBtnActive : {}) }}
            >
              Products
            </button>
            <button
              onClick={() => setViewMode('spreaders')}
              style={{ ...st.viewBtn, ...(viewMode === 'spreaders' ? st.viewBtnActive : {}) }}
            >
              Spreaders
            </button>
          </div>
          <div style={st.divider} />
          <a
            href="/applicators/new"
            target="_blank"
            style={{ ...st.viewBtn, textDecoration: 'none', fontSize: 12, color: '#2176d9', border: '1px solid #2176d9' }}
          >
            + Applicator
          </a>
        </div>

        {/* KPI strip */}
        {viewMode !== 'products' && viewMode !== 'spreaders' && <div style={st.kpiStrip}>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{uniqueOrchards.size}</div>
            <div style={st.kpiLabel}>Orchards</div>
          </div>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{uniqueProducts.size}</div>
            <div style={st.kpiLabel}>Products</div>
          </div>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{uniqueTimings.size}</div>
            <div style={st.kpiLabel}>Timings</div>
          </div>
          <div style={st.kpiCard}>
            <div style={{ ...st.kpiValue, fontSize: 16 }}>
              {totalN > 0 ? `${formatKg(totalN)}N` : ''}{totalP > 0 ? ` ${formatKg(totalP)}P` : ''}{totalK > 0 ? ` ${formatKg(totalK)}K` : ''}
              {totalN === 0 && totalP === 0 && totalK === 0 ? '\u2014' : ''}
            </div>
            <div style={st.kpiLabel}>Total NPK (kg)</div>
          </div>
        </div>}

        {/* Main content */}
        {viewMode === 'dashboard' && (
          <FertilizerDashboard
            data={dashboardData}
            loading={dashboardLoading}
            season={season}
            onNavigateConfirm={() => {
              setViewMode('confirm')
            }}
            productionByOrchard={dashboardProduction}
            leafFlags={dashboardLeafFlags}
          />
        )}

        {viewMode === 'table' && (
          <FertilizerTable data={filteredData} loading={loading} onOrchardClick={setSelectedOrchardId} />
        )}

        {viewMode === 'order' && (
          <FertilizerOrderList data={filteredOrderData} loading={loading} />
        )}

        {viewMode === 'confirm' && (
          <ConfirmApplications data={confirmData} loading={confirmLoading} onRefresh={fetchConfirmData} />
        )}

        {viewMode === 'dispatch' && selectedFarmId && orgId && (
          <DispatchView farmId={selectedFarmId} season={season} orgId={orgId} />
        )}

        {viewMode === 'products' && orgId && (
          <ProductSettings orgId={orgId} />
        )}

        {viewMode === 'spreaders' && selectedFarmId && orgId && (
          <SpreaderSettings farmId={selectedFarmId} orgId={orgId} />
        )}

        {/* Empty state */}
        {!loading && data.length === 0 && viewMode !== 'products' && (
          <div style={st.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#127793;</div>
            <h3 style={{ color: '#1a2a3a', margin: '0 0 8px' }}>No fertilizer program yet</h3>
            <p style={{ color: '#6a7a70', fontSize: 14, margin: '0 0 20px' }}>
              Import a fertilizer recommendation Excel file from the soil scientist.
            </p>
            <button onClick={() => setShowImport(true)} style={st.importBtn}>Import Excel</button>
          </div>
        )}
      </main>

      {/* Orchard Fert Detail Panel */}
      {selectedOrchardId && (
        <OrchardFertDetail
          orchardId={selectedOrchardId}
          confirmData={confirmData}
          summaryData={data}
          onClose={() => setSelectedOrchardId(null)}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          farms={farms}
          commodities={commodities}
          initialFarmId={selectedFarmId || undefined}
          onDone={fetchData}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}

function formatKg(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`
  return `${Math.round(v)}`
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
  importBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  deleteBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #e85a4a',
    background: '#fff', color: '#e85a4a', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
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
  divider: {
    width: 1, height: 20, background: '#e8e4dc',
  },
  viewBtn: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #d4cfca',
    background: '#fff', color: '#6a7a70', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  viewBtnActive: {
    background: '#1a2a3a', color: '#fff', border: '1px solid #1a2a3a',
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

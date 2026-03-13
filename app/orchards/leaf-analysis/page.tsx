'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import LeafAnalysisTable from '@/app/components/leaf-analysis/LeafAnalysisTable'
import NutrientCorrelationScatter from '@/app/components/leaf-analysis/NutrientCorrelationScatter'
import OrchardSeasonCard from '@/app/components/leaf-analysis/OrchardSeasonCard'
import ImportModal from '@/app/components/leaf-analysis/ImportModal'
import EntryForm from '@/app/components/leaf-analysis/EntryForm'

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

function seasonDateRange(season: string): { from: string; to: string } {
  const startYr = parseInt(season.split('/')[0])
  return {
    from: `${startYr}-08-01T00:00:00Z`,
    to: `${startYr + 1}-07-31T23:59:59Z`,
  }
}

interface Farm {
  id: string
  full_name: string
  code: string
}

interface Commodity {
  id: string
  name: string
}

interface SummaryRow {
  orchard_id: string
  orchard_name: string
  commodity_name: string
  season: string
  sample_date: string
  sample_type: string
  lab_name: string
  nutrient_code: string
  nutrient_name: string
  category: string
  value: number
  unit: string
  display_order: number
}

interface Orchard {
  id: string
  name: string
  variety: string | null
  ha: number | null
  commodity_id: string
}

interface ProductionRow {
  orchard_id: string
  ton_ha: number | null
  tons: number
  bins: number
  total: number
}

interface DominantSizeRow {
  orchard_id: string
  dominant_label: string
  avg_weight_g: number
  fruit_count: number
  total_fruit: number
}

interface NormRow {
  commodity_id: string
  nutrient_code: string
  min_optimal: number
  max_optimal: number
  min_adequate: number | null
  max_adequate: number | null
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

interface NormRange {
  min_optimal: number
  max_optimal: number
  min_adequate: number | null
  max_adequate: number | null
}

interface FertProductStatus {
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

interface FertOrchardStatus {
  confirmed: number
  total: number
  products: FertProductStatus[]
}

type ViewMode = 'table' | 'scatter'

export default function LeafAnalysisPage() {
  const { farmIds, isSuperAdmin, contextLoaded, orgId, allowedRoutes, allowed } = usePageGuard()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [farms, setFarms] = useState<Farm[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [data, setData] = useState<SummaryRow[]>([])
  const [modules, setModules] = useState<string[]>(['farmscout'])

  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null)
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null)
  const [selectedOrchardFilter, setSelectedOrchardFilter] = useState<string | null>(null)
  const [season, setSeason] = useState(getCurrentSeason())
  const [selectedOrchardId, setSelectedOrchardId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const [showImport, setShowImport] = useState(false)
  const [showEntry, setShowEntry] = useState(false)
  const [attachingPdf, setAttachingPdf] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Enrichment data
  const [productionByOrchard, setProductionByOrchard] = useState<Record<string, ProductionData>>({})
  const [sizeByOrchard, setSizeByOrchard] = useState<Record<string, SizeData>>({})
  const [normsLookup, setNormsLookup] = useState<Record<string, NormRange>>({})
  const [commodityByOrchard, setCommodityByOrchard] = useState<Record<string, string>>({})
  const [varietyByOrchard, setVarietyByOrchard] = useState<Record<string, string>>({})
  const [pdfByOrchard, setPdfByOrchard] = useState<Record<string, string>>({})
  const [fertByOrchard, setFertByOrchard] = useState<Record<string, FertOrchardStatus>>({})

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

      // Load org modules
      if (orgId) {
        const { data: org } = await supabase.from('organisations').select('modules').eq('id', orgId).single()
        if (org?.modules) setModules(org.modules)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin, orgId])

  // Load norms once via API route (bypasses RLS on reference tables)
  useEffect(() => {
    if (!contextLoaded) return
    async function loadNorms() {
      try {
        const res = await fetch('/api/leaf-analysis/norms')
        if (!res.ok) return
        const { norms: normsData } = await res.json()
        if (!normsData || normsData.length === 0) return

        const lookup: Record<string, NormRange> = {}
        // Process in priority order: system defaults → org commodity → org variety
        const sorted = [...(normsData as any[])].sort((a: any, b: any) => {
          const aScore = (a.organisation_id ? 1 : 0) + (a.variety ? 1 : 0)
          const bScore = (b.organisation_id ? 1 : 0) + (b.variety ? 1 : 0)
          return aScore - bScore
        })
        for (const n of sorted) {
          const code = n.nutrients?.code
          if (!code) continue
          const range = {
            min_optimal: Number(n.min_optimal),
            max_optimal: Number(n.max_optimal),
            min_adequate: n.min_adequate != null ? Number(n.min_adequate) : null,
            max_adequate: n.max_adequate != null ? Number(n.max_adequate) : null,
          }
          if (!n.variety) {
            lookup[`${n.commodity_id}:${code}`] = range
          }
          if (n.variety) {
            lookup[`${n.commodity_id}:${n.variety}:${code}`] = range
          }
        }
        setNormsLookup(lookup)
      } catch {
        // Norms are non-critical — page works without them
      }
    }
    loadNorms()
  }, [contextLoaded])

  // Load all data when farm or season changes
  const fetchData = useCallback(async () => {
    if (!selectedFarmId) return
    setLoading(true)
    setSelectedOrchardId(null)
    setSelectedVariety(null)
    setSelectedOrchardFilter(null)

    const { from, to } = seasonDateRange(season)

    try {
      const [
        { data: summaryData },
        { data: orchardData },
        { data: prodData },
        { data: sizeData },
        { data: pdfData },
      ] = await Promise.all([
        supabase.rpc('get_leaf_analysis_summary', {
          p_farm_ids: [selectedFarmId],
          p_season: season,
        }),
        supabase.from('orchards')
          .select('id, name, variety, ha, commodity_id')
          .eq('farm_id', selectedFarmId)
          .eq('is_active', true)
          .order('name'),
        supabase.rpc('get_production_summary', {
          p_farm_ids: [selectedFarmId],
          p_season: season,
        }),
        supabase.rpc('get_orchard_dominant_sizes', {
          p_farm_ids: [selectedFarmId],
          p_from: from,
          p_to: to,
        }),
        supabase.from('leaf_analyses')
          .select('orchard_id, pdf_url')
          .eq('farm_id', selectedFarmId)
          .eq('season', season)
          .not('pdf_url', 'is', null),
      ])

      setData(summaryData || [])
      setOrchards((orchardData || []) as Orchard[])

      // Build production lookup
      const prodMap: Record<string, ProductionData> = {}
      for (const r of (prodData || []) as ProductionRow[]) {
        prodMap[r.orchard_id] = {
          tonHa: r.ton_ha != null ? Number(r.ton_ha) : null,
          tons: Number(r.tons || 0),
          bins: Number(r.bins || 0),
        }
      }
      setProductionByOrchard(prodMap)

      // Build size lookup
      const sizeMap: Record<string, SizeData> = {}
      for (const r of (sizeData || []) as DominantSizeRow[]) {
        sizeMap[r.orchard_id] = {
          dominantLabel: r.dominant_label,
          avgWeightG: Number(r.avg_weight_g),
        }
      }
      setSizeByOrchard(sizeMap)

      // Build commodity + variety lookups
      const commMap: Record<string, string> = {}
      const varMap: Record<string, string> = {}
      for (const o of (orchardData || []) as Orchard[]) {
        commMap[o.id] = o.commodity_id
        if (o.variety) varMap[o.id] = o.variety
      }
      setCommodityByOrchard(commMap)
      setVarietyByOrchard(varMap)

      // Build PDF lookup (one per orchard, latest wins)
      const pdfMap: Record<string, string> = {}
      for (const r of (pdfData || []) as { orchard_id: string; pdf_url: string }[]) {
        if (r.pdf_url) pdfMap[r.orchard_id] = r.pdf_url
      }
      setPdfByOrchard(pdfMap)

      // Fetch fert application status (non-blocking enrichment)
      try {
        const fertRes = await fetch(`/api/fertilizer/confirm?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`)
        if (fertRes.ok) {
          const fertData = await fertRes.json() as {
            line_id: string; orchard_id: string; timing_label: string; timing_sort: number
            product_name: string; confirmed: boolean; date_applied: string | null
            rate_per_ha: number; unit: string
          }[]
          // We need product nutrient data — fetch from the summary endpoint
          const fertSummaryRes = await fetch(`/api/fertilizer?farm_id=${selectedFarmId}&season=${encodeURIComponent(season)}`)
          const fertSummary = fertSummaryRes.ok ? await fertSummaryRes.json() as {
            product_name: string; n_pct: number; p_pct: number; k_pct: number
          }[] : []
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
              timing_label: r.timing_label,
              timing_sort: r.timing_sort,
              product_name: r.product_name,
              confirmed: r.confirmed,
              date_applied: r.date_applied,
              rate_per_ha: r.rate_per_ha,
              unit: r.unit,
              n_pct: pn.n_pct,
              p_pct: pn.p_pct,
              k_pct: pn.k_pct,
            })
          }
          setFertByOrchard(fertMap)
        } else {
          setFertByOrchard({})
        }
      } catch {
        setFertByOrchard({})
      }
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [selectedFarmId, season])

  useEffect(() => {
    if (selectedFarmId) fetchData()
  }, [fetchData, selectedFarmId])

  // Filter data by commodity → variety → orchard (cascading)
  const filteredData = data.filter(d => {
    if (selectedCommodity && d.commodity_name !== selectedCommodity) return false
    if (selectedOrchardFilter && d.orchard_id !== selectedOrchardFilter) return false
    if (selectedVariety) {
      const o = orchards.find(o => o.id === d.orchard_id)
      if ((o?.variety || 'Unknown') !== selectedVariety) return false
    }
    return true
  })

  // Derive cascading pill options from orchards that have data
  const orchardIdsInData = new Set(data.map(d => d.orchard_id))

  // Varieties: only from orchards matching commodity AND present in data
  const varietyOptions = selectedCommodity
    ? [...new Set(
        orchards
          .filter(o => orchardIdsInData.has(o.id) && commodityByOrchard[o.id] &&
            data.some(d => d.orchard_id === o.id && d.commodity_name === selectedCommodity))
          .map(o => o.variety || 'Unknown')
      )].sort()
    : []

  // Orchards: from data matching commodity + variety
  const orchardFilterOptions = selectedCommodity
    ? orchards
        .filter(o => {
          if (!orchardIdsInData.has(o.id)) return false
          if (!data.some(d => d.orchard_id === o.id && d.commodity_name === selectedCommodity)) return false
          if (selectedVariety && (o.variety || 'Unknown') !== selectedVariety) return false
          return true
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  // KPI calculations
  const uniqueOrchards = new Set(filteredData.map(d => d.orchard_id))
  const orchardCount = uniqueOrchards.size
  const totalOrchards = orchards.length
  const coveragePct = totalOrchards > 0 ? Math.round((orchardCount / totalOrchards) * 100) : 0

  // Average N and K
  const nValues = filteredData.filter(d => d.nutrient_code === 'N').map(d => d.value)
  const kValues = filteredData.filter(d => d.nutrient_code === 'K').map(d => d.value)
  const avgN = nValues.length > 0 ? (nValues.reduce((a, b) => a + b, 0) / nValues.length).toFixed(2) : '\u2014'
  const avgK = kValues.length > 0 ? (kValues.reduce((a, b) => a + b, 0) / kValues.length).toFixed(2) : '\u2014'

  // Unique labs
  const labs = [...new Set(filteredData.map(d => d.lab_name).filter(Boolean))]

  // Selected orchard details for the card
  const selectedOrchard = orchards.find(o => o.id === selectedOrchardId)
  const selectedOrchardNutrients = selectedOrchardId
    ? filteredData
        .filter(d => d.orchard_id === selectedOrchardId)
        .map(d => ({
          code: d.nutrient_code,
          name: d.nutrient_name,
          value: d.value,
          unit: d.unit,
          category: d.category,
        }))
    : []

  // Norms for the selected orchard's commodity
  const selectedOrchardNorms = selectedOrchard
    ? Object.fromEntries(
        Object.entries(normsLookup)
          .filter(([key]) => key.startsWith(`${selectedOrchard.commodity_id}:`))
          .map(([key, val]) => [key.split(':')[1], val])
      )
    : {}

  // Enriched orchards for scatter plot
  const nutrientCodes = [...new Set(filteredData.map(d => d.nutrient_code))]
    .sort((a, b) => {
      const aRow = filteredData.find(d => d.nutrient_code === a)
      const bRow = filteredData.find(d => d.nutrient_code === b)
      return (aRow?.display_order ?? 99) - (bRow?.display_order ?? 99)
    })

  // Attach PDF to existing analyses for this farm+season
  async function handleAttachPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedFarmId) return

    setAttachingPdf(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${selectedFarmId}/${season.replace('/', '-')}/${Date.now()}_${safeName}`
      const { error: uploadErr } = await supabase.storage
        .from('leaf-analysis-pdfs')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('leaf-analysis-pdfs')
        .getPublicUrl(path)

      await fetch('/api/leaf-analysis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: selectedFarmId,
          season,
          pdf_url: urlData.publicUrl,
        }),
      })
      fetchData()
    } catch (err: any) {
      console.error('PDF attach failed:', err)
    } finally {
      setAttachingPdf(false)
    }
  }

  const enrichedOrchards = [...uniqueOrchards].map(oid => {
    const nutrients: Record<string, number> = {}
    filteredData.filter(d => d.orchard_id === oid).forEach(d => {
      nutrients[d.nutrient_code] = d.value
    })
    const orchard = orchards.find(o => o.id === oid)
    const prod = productionByOrchard[oid]
    const size = sizeByOrchard[oid]
    return {
      orchardId: oid,
      orchardName: orchard?.name || filteredData.find(d => d.orchard_id === oid)?.orchard_name || '',
      commodityName: filteredData.find(d => d.orchard_id === oid)?.commodity_name || '',
      ha: orchard?.ha ?? null,
      tonHa: prod?.tonHa ?? null,
      avgWeightG: size?.avgWeightG ?? null,
      nutrients,
    }
  })

  if (!allowed) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eae6df', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={st.main}>
        {/* Page header */}
        <div style={st.headerRow}>
          <div>
            <h1 style={st.pageTitle}>Leaf Analysis</h1>
            <p style={st.subtitle}>Nutrient trends and coverage across orchards</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={season} onChange={e => setSeason(e.target.value)} style={st.seasonSelect}>
              {seasonOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setShowEntry(true)} style={st.addBtn}>+ Add</button>
            <button onClick={() => setShowImport(true)} style={st.importBtn}>Import CSV</button>
            <button onClick={() => pdfInputRef.current?.click()} disabled={attachingPdf} style={{ ...st.addBtn, opacity: attachingPdf ? 0.5 : 1 }}>
              {attachingPdf ? 'Uploading...' : 'Attach PDF'}
            </button>
            <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handleAttachPdf} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Farm + commodity pills + view toggle */}
        <div style={st.filterRow}>
          <div style={st.pillGroup}>
            {farms.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFarmId(f.id)}
                style={{
                  ...st.pill,
                  ...(selectedFarmId === f.id ? st.pillActive : {}),
                }}
              >
                {f.code || f.full_name}
              </button>
            ))}
          </div>
          {commodities.length > 1 && (
            <>
              <div style={st.divider} />
              <div style={st.pillGroup}>
                <button
                  onClick={() => { setSelectedCommodity(null); setSelectedVariety(null); setSelectedOrchardFilter(null) }}
                  style={{ ...st.pill, ...(selectedCommodity === null ? st.pillActive : {}) }}
                >
                  All
                </button>
                {commodities.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCommodity(c.name); setSelectedVariety(null); setSelectedOrchardFilter(null) }}
                    style={{ ...st.pill, ...(selectedCommodity === c.name ? st.pillActive : {}) }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={st.divider} />
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() => setViewMode('table')}
              style={{ ...st.viewBtn, ...(viewMode === 'table' ? st.viewBtnActive : {}) }}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('scatter')}
              style={{ ...st.viewBtn, ...(viewMode === 'scatter' ? st.viewBtnActive : {}) }}
            >
              Scatter
            </button>
          </div>
        </div>

        {/* Cascading sub-filters: Commodity → Variety → Orchard */}
        {selectedCommodity && varietyOptions.length > 1 && (
          <div style={{ ...st.filterRow, marginTop: -12 }}>
            <span style={st.filterLabel}>Variety</span>
            <div style={st.pillGroup}>
              <button
                onClick={() => { setSelectedVariety(null); setSelectedOrchardFilter(null) }}
                style={{ ...st.pillSm, ...(selectedVariety === null ? st.pillSmActive : {}) }}
              >
                All
              </button>
              {varietyOptions.map(v => (
                <button
                  key={v}
                  onClick={() => { setSelectedVariety(v); setSelectedOrchardFilter(null) }}
                  style={{ ...st.pillSm, ...(selectedVariety === v ? st.pillSmActive : {}) }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedCommodity && selectedVariety && orchardFilterOptions.length > 1 && (
          <div style={{ ...st.filterRow, marginTop: -12 }}>
            <span style={st.filterLabel}>Orchard</span>
            <div style={st.pillGroup}>
              <button
                onClick={() => setSelectedOrchardFilter(null)}
                style={{ ...st.pillSm, ...(selectedOrchardFilter === null ? st.pillSmActive : {}) }}
              >
                All
              </button>
              {orchardFilterOptions.map(o => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrchardFilter(o.id)}
                  style={{ ...st.pillSm, ...(selectedOrchardFilter === o.id ? st.pillSmActive : {}) }}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KPI strip */}
        <div style={st.kpiStrip}>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{orchardCount}</div>
            <div style={st.kpiLabel}>Orchards Sampled</div>
          </div>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{coveragePct}%</div>
            <div style={st.kpiLabel}>Coverage</div>
          </div>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{avgN}</div>
            <div style={st.kpiLabel}>Avg N (%)</div>
          </div>
          <div style={st.kpiCard}>
            <div style={st.kpiValue}>{avgK}</div>
            <div style={st.kpiLabel}>Avg K (%)</div>
          </div>
          {labs.length > 0 && (
            <div style={st.kpiCard}>
              <div style={{ ...st.kpiValue, fontSize: 16 }}>{labs.join(', ')}</div>
              <div style={st.kpiLabel}>Lab{labs.length > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>

        {/* Main content */}
        {viewMode === 'table' && (
          <div style={{ marginBottom: 16 }}>
            <LeafAnalysisTable
              data={filteredData}
              selectedOrchardId={selectedOrchardId}
              onSelectOrchard={id => setSelectedOrchardId(prev => prev === id ? null : id)}
              loading={loading}
              productionByOrchard={productionByOrchard}
              sizeByOrchard={sizeByOrchard}
              normsLookup={normsLookup}
              commodityByOrchard={commodityByOrchard}
              varietyByOrchard={varietyByOrchard}
              pdfByOrchard={pdfByOrchard}
              fertByOrchard={fertByOrchard}
            />
          </div>
        )}

        {viewMode === 'scatter' && (
          <NutrientCorrelationScatter
            orchards={enrichedOrchards}
            nutrientCodes={nutrientCodes}
            selectedOrchardId={selectedOrchardId}
            onOrchardSelect={id => setSelectedOrchardId(prev => prev === id ? null : id)}
            allNorms={normsLookup}
            commodityId={selectedCommodity ? commodities.find(c => c.name === selectedCommodity)?.id : null}
          />
        )}

        {/* Empty state */}
        {!loading && data.length === 0 && (
          <div style={st.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#129514;</div>
            <h3 style={{ color: '#1a2a3a', margin: '0 0 8px' }}>No leaf analysis data yet</h3>
            <p style={{ color: '#6a7a70', fontSize: 14, margin: '0 0 20px' }}>
              Import historic lab results from CSV/Excel or add entries manually.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowImport(true)} style={st.importBtn}>Import CSV</button>
              <button onClick={() => setShowEntry(true)} style={st.addBtn}>+ Add Entry</button>
            </div>
          </div>
        )}
      </main>

      {/* Orchard Season Card */}
      {selectedOrchardId && selectedOrchard && (
        <OrchardSeasonCard
          orchardId={selectedOrchardId}
          orchardName={selectedOrchard.name}
          commodityName={filteredData.find(d => d.orchard_id === selectedOrchardId)?.commodity_name || ''}
          nutrients={selectedOrchardNutrients}
          production={productionByOrchard[selectedOrchardId] || null}
          sizeInfo={sizeByOrchard[selectedOrchardId] || null}
          normsLookup={selectedOrchardNorms}
          farmIds={selectedFarmId ? [selectedFarmId] : []}
          season={season}
          open={true}
          onClose={() => setSelectedOrchardId(null)}
          fertStatus={fertByOrchard[selectedOrchardId] || null}
        />
      )}

      {/* Modals */}
      {showImport && (
        <ImportModal
          farms={farms}
          initialFarmId={selectedFarmId || undefined}
          onDone={fetchData}
          onClose={() => setShowImport(false)}
        />
      )}

      {showEntry && selectedFarmId && (
        <EntryForm
          farmId={selectedFarmId}
          orchards={orchards}
          onSaved={() => { setShowEntry(false); fetchData() }}
          onClose={() => setShowEntry(false)}
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
  addBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #d4cfca',
    background: '#fff', color: '#1a2a3a', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  importBtn: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 500,
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
  filterLabel: {
    fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const,
    letterSpacing: '0.5px', flexShrink: 0,
  },
  pillSm: {
    padding: '4px 10px', borderRadius: 14, border: '1px solid #e8e4dc',
    background: '#fff', color: '#6a7a70', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'all 0.15s',
  },
  pillSmActive: {
    border: '1px solid #1a2a3a', background: '#1a2a3a', color: '#fff',
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

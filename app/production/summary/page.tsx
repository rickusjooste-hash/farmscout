'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useEffect, useState, useMemo, useCallback } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string }
interface BinRow {
  farm_id: string
  orchard_id: string | null
  variety: string | null
  total: number
  production_year: string
}
interface OrchardRef {
  id: string
  variety: string | null
  commodity_id: string
  farm_id: string
}
interface Commodity { id: string; code: string }
interface BinWeight { commodity_id: string; variety: string | null; default_weight_kg: number }

interface SummaryRow {
  farm: string
  commodity: string
  variety: string
  yearTons: Record<string, number>
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProductionSummaryPage() {
  const { farmIds, isSuperAdmin, contextLoaded } = usePageGuard()
  const [allFarms, setAllFarms] = useState<Farm[]>([])
  const [orchards, setOrchards] = useState<OrchardRef[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [binRows, setBinRows] = useState<BinRow[]>([])
  const [binWeights, setBinWeights] = useState<BinWeight[]>([])
  const [loading, setLoading] = useState(true)

  // ── Load data ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    loadData()
  }, [contextLoaded, farmIds, isSuperAdmin])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Resolve farm IDs
    let effectiveFarmIds = farmIds
    if (isSuperAdmin || farmIds.length === 0) {
      const { data } = await supabase.from('farms').select('id').eq('is_active', true)
      effectiveFarmIds = (data || []).map(f => f.id)
    }
    if (effectiveFarmIds.length === 0) { setLoading(false); return }

    const [farmsRes, orchRes, commRes, binsRes, weightsRes] = await Promise.all([
      supabase.from('farms').select('id, code').in('id', effectiveFarmIds),
      supabase.from('orchards').select('id, variety, commodity_id, farm_id').in('farm_id', effectiveFarmIds),
      supabase.from('commodities').select('id, code'),
      supabase.from('production_bins').select('farm_id, orchard_id, variety, total, production_year').in('farm_id', effectiveFarmIds),
      supabase.from('production_bin_weights').select('commodity_id, variety, default_weight_kg'),
    ])

    setAllFarms(farmsRes.data || [])
    setOrchards(orchRes.data || [])
    setCommodities(commRes.data || [])
    setBinRows(binsRes.data || [])
    setBinWeights(weightsRes.data || [])
    setLoading(false)
  }, [farmIds, isSuperAdmin, contextLoaded])

  // ── Build lookups ──────────────────────────────────────────────────────

  const farmLookup = useMemo(() => {
    const m: Record<string, string> = {}
    allFarms.forEach(f => { m[f.id] = f.code })
    return m
  }, [allFarms])

  const orchardLookup = useMemo(() => {
    const m: Record<string, OrchardRef> = {}
    orchards.forEach(o => { m[o.id] = o })
    return m
  }, [orchards])

  const commLookup = useMemo(() => {
    const m: Record<string, string> = {}
    commodities.forEach(c => { m[c.id] = c.code })
    return m
  }, [commodities])

  // Bin weight lookup (commodity+variety → weight, commodity-only fallback, then 400)
  const getBinWeight = useCallback((commodityId: string | null, variety: string | null): number => {
    if (commodityId) {
      const match = binWeights.find(w => w.commodity_id === commodityId && w.variety === variety)
      if (match) return match.default_weight_kg
      const commMatch = binWeights.find(w => w.commodity_id === commodityId && !w.variety)
      if (commMatch) return commMatch.default_weight_kg
    }
    return 400
  }, [binWeights])

  // ── Aggregate into pivot rows ──────────────────────────────────────────

  const { rows, years } = useMemo(() => {
    const map: Record<string, { farm: string; commodity: string; variety: string; commodityId: string; yearBins: Record<string, number> }> = {}

    for (const b of binRows) {
      const farmCode = farmLookup[b.farm_id] || '?'
      const orch = b.orchard_id ? orchardLookup[b.orchard_id] : null
      const commCode = orch ? (commLookup[orch.commodity_id] || '?') : '?'
      const variety = (orch?.variety || b.variety || '?').toUpperCase()
      const year = b.production_year?.slice(0, 4) || '?'

      const key = `${farmCode}|${commCode}|${variety}`
      if (!map[key]) {
        map[key] = { farm: farmCode, commodity: commCode, variety, commodityId: orch?.commodity_id || '', yearBins: {} }
      }
      map[key].yearBins[year] = (map[key].yearBins[year] || 0) + (b.total || 0)
    }

    // Collect all years
    const yearSet = new Set<string>()
    Object.values(map).forEach(r => Object.keys(r.yearBins).forEach(y => yearSet.add(y)))
    const sortedYears = Array.from(yearSet).sort()

    // Convert bins → tons
    const result: SummaryRow[] = Object.values(map).map(r => {
      const weight = getBinWeight(r.commodityId, r.variety)
      const yearTons: Record<string, number> = {}
      for (const y of sortedYears) {
        const bins = r.yearBins[y] || 0
        yearTons[y] = Math.round((bins * weight / 1000) * 1000) / 1000
      }
      return { farm: r.farm, commodity: r.commodity, variety: r.variety, yearTons }
    })

    // Sort: farm → commodity → variety
    result.sort((a, b) => a.farm.localeCompare(b.farm) || a.commodity.localeCompare(b.commodity) || a.variety.localeCompare(b.variety))

    return { rows: result, years: sortedYears }
  }, [binRows, farmLookup, orchardLookup, commLookup, getBinWeight])

  // Year totals
  const yearTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const y of years) {
      totals[y] = rows.reduce((sum, r) => sum + (r.yearTons[y] || 0), 0)
    }
    return totals
  }, [rows, years])

  // ── Export to Excel ────────────────────────────────────────────────────

  async function handleExport() {
    const XLSX = await import('xlsx')

    const header = ['Farm', 'Commodity', 'Variety', ...years]
    const data = rows.map(r => [
      r.farm,
      r.commodity,
      r.variety,
      ...years.map(y => r.yearTons[y] || 0),
    ])
    // Totals row
    data.push(['', '', 'Total', ...years.map(y => Math.round((yearTotals[y] || 0) * 1000) / 1000)])

    const ws = XLSX.utils.aoa_to_sheet([header, ...data])

    // Column widths
    ws['!cols'] = [
      { wch: 8 }, { wch: 12 }, { wch: 16 },
      ...years.map(() => ({ wch: 12 })),
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Production Summary')
    XLSX.writeFile(wb, `Production_Summary_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  // Color code for commodity
  const commColor: Record<string, string> = {
    AP: '#2e7d32', PR: '#1565c0', CI: '#e65100', STN: '#6a1b9a',
    NE: '#c62828', PE: '#ad1457', SF: '#4e342e',
  }

  return (
    <>
      <ManagerSidebarStyles />
      <ManagerSidebar />
      <MobileNav />
      <main className="ms-main">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Production Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Total tons by farm, commodity, and variety across production years</p>
            </div>
            <button
              onClick={handleExport}
              disabled={loading || rows.length === 0}
              className="px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              Export to Excel
            </button>
          </div>

          {loading ? (
            <div className="text-gray-400 text-center py-20">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-gray-400 text-center py-20">No production data found</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
              <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10">Farm</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Commodity</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Variety</th>
                    {years.map(y => (
                      <th key={y} className="text-right px-3 py-2.5 font-semibold text-gray-600">{y}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-semibold text-gray-800 sticky left-0 bg-white z-10">{r.farm}</td>
                      <td className="px-3 py-2">
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ color: commColor[r.commodity] || '#555', background: `${commColor[r.commodity] || '#555'}15` }}
                        >
                          {r.commodity}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.variety}</td>
                      {years.map(y => (
                        <td key={y} className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {r.yearTons[y] ? r.yearTons[y].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td className="px-3 py-2.5 sticky left-0 bg-gray-50 z-10" colSpan={3}>Total</td>
                    {years.map(y => (
                      <td key={y} className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                        {(yearTotals[y] || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

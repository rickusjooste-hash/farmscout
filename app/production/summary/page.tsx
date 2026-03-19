'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo, useCallback } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Types ──────────────────────────────────────────────────────────────────

interface RpcRow {
  farm_code: string
  commodity_code: string
  variety: string
  ha: number
  production_year: string
  total_tons: number
}

interface SummaryRow {
  farm: string
  commodity: string
  variety: string
  ha: number
  yearTons: Record<string, number>
}

// ── Inline styles (matches other production pages) ─────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:       { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
  main:       { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, paddingBottom: 100 },
  pageHeader: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  pageTitle:  { fontSize: 32, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px', lineHeight: 1 },
  pageSub:    { fontSize: 14, color: '#8a95a0', marginTop: 6 },
  exportBtn:  { padding: '8px 18px', background: '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  card:       { background: '#fff', borderRadius: 12, border: '1px solid #e8e4dc', overflow: 'auto' },
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13, minWidth: 600 },
  th:         { textAlign: 'left' as const, padding: '10px 12px', fontWeight: 600, color: '#7a8a80', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', background: '#f9f7f3', borderBottom: '1px solid #e8e4dc' },
  thRight:    { textAlign: 'right' as const, padding: '10px 12px', fontWeight: 600, color: '#7a8a80', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', background: '#f9f7f3', borderBottom: '1px solid #e8e4dc' },
  td:         { padding: '8px 12px', borderBottom: '1px solid #f0ede8', color: '#3a4a40' },
  tdRight:    { padding: '8px 12px', borderBottom: '1px solid #f0ede8', color: '#3a4a40', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' },
  tdFarm:     { padding: '8px 12px', borderBottom: '1px solid #f0ede8', fontWeight: 600, color: '#1a2a3a' },
  tfootTd:    { padding: '10px 12px', fontWeight: 700, color: '#1a2a3a', background: '#f9f7f3', borderTop: '2px solid #d4cfca' },
  tfootRight: { padding: '10px 12px', fontWeight: 700, color: '#1a2a3a', background: '#f9f7f3', borderTop: '2px solid #d4cfca', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' },
  loading:    { color: '#8a95a0', textAlign: 'center' as const, padding: '80px 0' },
}

const commColor: Record<string, string> = {
  AP: '#2e7d32', PR: '#1565c0', CI: '#e65100', STN: '#6a1b9a',
  NE: '#c62828', PE: '#ad1457', SF: '#4e342e',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProductionSummaryPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()
  const [rpcData, setRpcData] = useState<RpcRow[]>([])
  const [loading, setLoading] = useState(true)

  // ── Load data via RPC ──────────────────────────────────────────────────

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

    const { data, error } = await supabase.rpc('get_production_year_summary', {
      p_farm_ids: effectiveFarmIds,
    })

    if (error) {
      console.error('[Summary] RPC error:', error.message)
    } else {
      setRpcData(data || [])
    }
    setLoading(false)
  }, [farmIds, isSuperAdmin, contextLoaded])

  // ── Pivot into rows ────────────────────────────────────────────────────

  const { rows, years } = useMemo(() => {
    const map: Record<string, SummaryRow> = {}
    const yearSet = new Set<string>()

    for (const r of rpcData) {
      const key = `${r.farm_code}|${r.commodity_code}|${r.variety}`
      if (!map[key]) {
        map[key] = { farm: r.farm_code, commodity: r.commodity_code, variety: r.variety, ha: r.ha || 0, yearTons: {} }
      }
      map[key].yearTons[r.production_year] = (map[key].yearTons[r.production_year] || 0) + r.total_tons
      yearSet.add(r.production_year)
    }

    const sortedYears = Array.from(yearSet).sort()
    const result = Object.values(map)
    result.sort((a, b) => a.farm.localeCompare(b.farm) || a.commodity.localeCompare(b.commodity) || a.variety.localeCompare(b.variety))

    return { rows: result, years: sortedYears }
  }, [rpcData])

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

    const header = ['Farm', 'Commodity', 'Variety', 'Ha', ...years]
    const data = rows.map(r => [
      r.farm,
      r.commodity,
      r.variety,
      r.ha || 0,
      ...years.map(y => r.yearTons[y] || 0),
    ])
    data.push(['', '', 'Total', rows.reduce((sum, r) => sum + r.ha, 0), ...years.map(y => Math.round((yearTotals[y] || 0) * 1000) / 1000)])

    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    ws['!cols'] = [
      { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 8 },
      ...years.map(() => ({ wch: 14 })),
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Production Summary')
    XLSX.writeFile(wb, `Production_Summary_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const fmt = (n: number) => n ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : ''

  return (
    <div style={s.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
      <MobileNav isSuperAdmin={isSuperAdmin} modules={modules} />

      <main style={s.main}>
        <div style={s.pageHeader}>
          <div>
            <div style={s.pageTitle}>Production Summary</div>
            <div style={s.pageSub}>Total tons by farm, commodity &amp; variety across production years</div>
          </div>
          <button
            style={{ ...s.exportBtn, opacity: loading || rows.length === 0 ? 0.5 : 1 }}
            onClick={handleExport}
            disabled={loading || rows.length === 0}
          >
            Export to Excel
          </button>
        </div>

        {loading ? (
          <div style={s.loading}>Loading...</div>
        ) : rows.length === 0 ? (
          <div style={s.loading}>No production data found</div>
        ) : (
          <div style={s.card}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Farm</th>
                  <th style={s.th}>Commodity</th>
                  <th style={s.th}>Variety</th>
                  <th style={s.thRight}>Ha</th>
                  {years.map(y => (
                    <th key={y} style={s.thRight}>{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={s.tdFarm}>{r.farm}</td>
                    <td style={s.td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        color: commColor[r.commodity] || '#555',
                        background: `${commColor[r.commodity] || '#555'}18`,
                      }}>
                        {r.commodity}
                      </span>
                    </td>
                    <td style={s.td}>{r.variety}</td>
                    <td style={s.tdRight}>{r.ha ? r.ha.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ''}</td>
                    {years.map(y => (
                      <td key={y} style={s.tdRight}>{fmt(r.yearTons[y])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={s.tfootTd} colSpan={3}>Total</td>
                  <td style={s.tfootRight}>{rows.reduce((sum, r) => sum + r.ha, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                  {years.map(y => (
                    <td key={y} style={s.tfootRight}>{fmt(yearTotals[y])}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

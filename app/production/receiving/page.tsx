'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; name: string }

interface BinRow {
  orchard_id: string | null
  orchard_name: string
  variety: string | null
  farm_id: string
  bins: number
  juice: number
  total: number
  received_time: string | null
}

interface OrchardAgg {
  orchard_id: string | null
  name: string
  variety: string | null
  bins: number
  juice: number
  total: number
  earliest: string | null
  latest: string | null
}

interface FarmGroup {
  farm: Farm
  orchards: OrchardAgg[]
  bins: number
  juice: number
  total: number
}

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
  kpiStrip:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 },
  kpiCard:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative' as const, overflow: 'hidden' },
  kpiAccent:   { position: 'absolute' as const, top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2176d9, #a0c4f0)' },
  kpiLabel:    { fontSize: 12, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  kpiValue:    { fontSize: 32, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 },
  kpiSub:      { fontSize: 12, color: '#8a95a0', marginTop: 6 },
  card:        { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader:  { padding: '20px 24px 16px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' as const },
  cardTitle:   { fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
  cardBody:    { padding: '0 24px 20px' },
  loading:     { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#8a95a0', fontSize: 14 },
  thCell:      { fontSize: 11, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, padding: '10px 12px', textAlign: 'left' as const, borderBottom: '1px solid #eef2fa' },
  thRight:     { fontSize: 11, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, padding: '10px 12px', textAlign: 'right' as const, borderBottom: '1px solid #eef2fa' },
  tdCell:      { padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f4f1eb' },
  tdRight:     { padding: '10px 12px', fontSize: 14, borderBottom: '1px solid #f4f1eb', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' },
  subtotalRow: { background: '#f7f5f0' },
  empty:       { textAlign: 'center' as const, padding: '60px 20px', color: '#8a95a0', fontSize: 15 },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSASTDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }))
}

function defaultDate(): string {
  const sast = getSASTDate()
  if (sast.getHours() < 8) sast.setDate(sast.getDate() - 1)
  return sast.toISOString().slice(0, 10)
}

function todayStr(): string {
  return getSASTDate().toISOString().slice(0, 10)
}

function yesterdayStr(): string {
  const d = getSASTDate()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function fmtTime(t: string | null): string {
  if (!t) return '—'
  return t.slice(0, 5)
}

// ── Chevron icon ────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ReceivingPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, orgId, allowedRoutes, allowed } = usePageGuard()
  const modules = useOrgModules()

  const [allFarms, setAllFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const [binRows, setBinRows] = useState<BinRow[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const today = todayStr()
  const yesterday = yesterdayStr()

  const effectiveFarmIds = useMemo(() => {
    if (selectedFarmId) return [selectedFarmId]
    return allFarms.map(f => f.id)
  }, [allFarms, selectedFarmId])

  // Load farms
  useEffect(() => {
    if (!contextLoaded) return
    async function init() {
      const farmQ = supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('full_name')
      const { data } = isSuperAdmin ? await farmQ : await farmQ.in('id', farmIds)
      setAllFarms((data || []).map((f: any) => ({ id: f.id, code: f.code, name: f.full_name })))
    }
    init()
  }, [contextLoaded])

  // Load bins for selected date
  useEffect(() => {
    if (!contextLoaded || effectiveFarmIds.length === 0) return
    async function fetchBins() {
      setLoading(true)
      const { data, error } = await supabase
        .from('production_bins')
        .select('orchard_id, orchard_name, variety, farm_id, bins, juice, total, received_time')
        .eq('received_date', selectedDate)
        .in('farm_id', effectiveFarmIds)
        .order('received_time', { ascending: true })
      if (error) console.error('receiving fetch error:', error.message)
      setBinRows((data || []) as BinRow[])
      setLoading(false)
    }
    fetchBins()
  }, [contextLoaded, effectiveFarmIds, selectedDate])

  // ── Aggregation ─────────────────────────────────────────────────────────

  const farmGroups = useMemo(() => {
    const farmLookup: Record<string, Farm> = {}
    allFarms.forEach(f => { farmLookup[f.id] = f })

    // Group rows by farm → orchard
    const byFarm: Record<string, Record<string, { bins: number; juice: number; total: number; name: string; variety: string | null; orchardId: string | null; times: string[] }>> = {}

    binRows.forEach(row => {
      if (!byFarm[row.farm_id]) byFarm[row.farm_id] = {}
      const oKey = row.orchard_id || `_${row.orchard_name}`
      if (!byFarm[row.farm_id][oKey]) {
        byFarm[row.farm_id][oKey] = { bins: 0, juice: 0, total: 0, name: row.orchard_name, variety: row.variety, orchardId: row.orchard_id, times: [] }
      }
      const agg = byFarm[row.farm_id][oKey]
      agg.bins += row.bins
      agg.juice += row.juice
      agg.total += row.total
      if (row.received_time) agg.times.push(row.received_time)
    })

    const groups: FarmGroup[] = Object.entries(byFarm)
      .map(([farmId, orchards]) => {
        const farm = farmLookup[farmId] || { id: farmId, code: '?', name: farmId }
        const orchardList: OrchardAgg[] = Object.values(orchards)
          .map(o => ({
            orchard_id: o.orchardId,
            name: o.name,
            variety: o.variety,
            bins: o.bins,
            juice: o.juice,
            total: o.total,
            earliest: o.times.length > 0 ? o.times.sort()[0] : null,
            latest: o.times.length > 0 ? o.times.sort()[o.times.length - 1] : null,
          }))
          .sort((a, b) => b.total - a.total)

        const farmBins = orchardList.reduce((sum, o) => sum + o.bins, 0)
        const farmJuice = orchardList.reduce((sum, o) => sum + o.juice, 0)
        const farmTotal = orchardList.reduce((sum, o) => sum + o.total, 0)

        return { farm, orchards: orchardList, bins: farmBins, juice: farmJuice, total: farmTotal }
      })
      .sort((a, b) => b.total - a.total)

    return groups
  }, [binRows, allFarms])

  const grandTotals = useMemo(() => ({
    bins: farmGroups.reduce((sum, g) => sum + g.bins, 0),
    juice: farmGroups.reduce((sum, g) => sum + g.juice, 0),
    total: farmGroups.reduce((sum, g) => sum + g.total, 0),
  }), [farmGroups])

  function toggleFarm(farmId: string) {
    setCollapsed(prev => ({ ...prev, [farmId]: !prev[farmId] }))
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!contextLoaded) return null

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={s.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
      <MobileNav isSuperAdmin={isSuperAdmin} modules={modules} />

      <main style={s.main}>
        {/* Header */}
        <div style={s.pageHeader}>
          <div>
            <div style={s.pageTitle}>Daily Receiving</div>
            <div style={s.pageSub}>{dateLabel}</div>
          </div>
        </div>

        {/* Controls */}
        <div style={s.controls}>
          <div style={s.filterGroup}>
            <button
              style={selectedDate === yesterday ? s.pillActive : s.pill}
              onClick={() => setSelectedDate(yesterday)}
            >Yesterday</button>
            <button
              style={selectedDate === today ? s.pillActive : s.pill}
              onClick={() => setSelectedDate(today)}
            >Today</button>
          </div>
          <div style={s.divider} />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={s.select}
          />
          <div style={s.divider} />
          <select
            value={selectedFarmId || ''}
            onChange={e => setSelectedFarmId(e.target.value || null)}
            style={s.select}
          >
            <option value="">All Farms</option>
            {allFarms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* KPI strip */}
        <div style={s.kpiStrip}>
          <div style={s.kpiCard}>
            <div style={s.kpiAccent} />
            <div style={s.kpiLabel}>Bins</div>
            <div style={s.kpiValue}>{grandTotals.bins.toLocaleString('en-ZA')}</div>
          </div>
          <div style={s.kpiCard}>
            <div style={s.kpiAccent} />
            <div style={s.kpiLabel}>Juice</div>
            <div style={s.kpiValue}>{grandTotals.juice.toLocaleString('en-ZA')}</div>
          </div>
          <div style={s.kpiCard}>
            <div style={s.kpiAccent} />
            <div style={s.kpiLabel}>Grand Total</div>
            <div style={s.kpiValue}>{grandTotals.total.toLocaleString('en-ZA')}</div>
          </div>
          <div style={s.kpiCard}>
            <div style={s.kpiAccent} />
            <div style={s.kpiLabel}>Orchards</div>
            <div style={s.kpiValue}>{farmGroups.reduce((sum, g) => sum + g.orchards.length, 0)}</div>
          </div>
        </div>

        {/* Loading */}
        {loading && <div style={s.loading}>Loading receiving data…</div>}

        {/* Empty state */}
        {!loading && farmGroups.length === 0 && (
          <div style={s.empty}>No bins received on {dateLabel}.</div>
        )}

        {/* Farm cards */}
        {!loading && farmGroups.map(group => {
          const isCollapsed = collapsed[group.farm.id] === true
          return (
            <div key={group.farm.id} style={s.card}>
              <div style={s.cardHeader} onClick={() => toggleFarm(group.farm.id)}>
                <div>
                  <span style={s.cardTitle}>{group.farm.name}</span>
                  <span style={{ fontSize: 13, color: '#8a95a0', marginLeft: 12 }}>
                    {group.bins} bins · {group.juice} juice · <strong>{group.total} total</strong>
                  </span>
                </div>
                <Chevron open={!isCollapsed} />
              </div>

              {!isCollapsed && (
                <div style={s.cardBody}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={s.thCell}>Orchard</th>
                        <th style={s.thCell}>Variety</th>
                        <th style={s.thRight}>Bins</th>
                        <th style={s.thRight}>Juice</th>
                        <th style={s.thRight}>Total</th>
                        <th style={s.thRight}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.orchards.map((o, i) => (
                        <tr key={o.orchard_id || i}>
                          <td style={s.tdCell}>{o.name}</td>
                          <td style={{ ...s.tdCell, color: '#5a6a60', fontSize: 13 }}>{o.variety || '—'}</td>
                          <td style={s.tdRight}>{o.bins}</td>
                          <td style={s.tdRight}>{o.juice}</td>
                          <td style={{ ...s.tdRight, fontWeight: 600 }}>{o.total}</td>
                          <td style={{ ...s.tdRight, fontSize: 13, color: '#8a95a0' }}>
                            {fmtTime(o.earliest)}{o.latest && o.latest !== o.earliest ? ` – ${fmtTime(o.latest)}` : ''}
                          </td>
                        </tr>
                      ))}
                      {/* Subtotal row */}
                      <tr style={s.subtotalRow}>
                        <td style={{ ...s.tdCell, fontWeight: 600 }} colSpan={2}>Total — {group.farm.name}</td>
                        <td style={{ ...s.tdRight, fontWeight: 600 }}>{group.bins}</td>
                        <td style={{ ...s.tdRight, fontWeight: 600 }}>{group.juice}</td>
                        <td style={{ ...s.tdRight, fontWeight: 700 }}>{group.total}</td>
                        <td style={s.tdRight} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </main>
    </div>
  )
}

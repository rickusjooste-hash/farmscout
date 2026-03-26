'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import { useEffect, useState, useMemo } from 'react'

interface ProductivityRow {
  id: string
  employee_id: string
  farm_id: string
  work_date: string
  orchard_id: string | null
  fcs_orchard_nr: number | null
  fcs_orchard_name: string | null
  activity_name: string
  supervisor: string | null
  units: number
  hours: number | null
  minutes: number | null
  units_per_hour: number | null
  units_per_man_day: number | null
  correction_factor: number | null
  corrected_bags: number | null
  corrected_bins: number | null
  status: string
  exclude_reason: string | null
  employee: { full_name: string; employee_nr: string } | null
}

interface Orchard { id: string; name: string; farm_id: string }
interface UnmappedOrchard { fcs_orchard_nr: number; fcs_orchard_name: string | null; count: number }

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, sans-serif' },
  main: { flex: 1, padding: 40, overflowY: 'auto' as const },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap' as const, gap: 12 },
  title: { fontSize: 28, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px' },
  card: { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardHeader: { padding: '14px 20px', borderBottom: '1px solid #e8e4dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#1a2a3a' },
  th: { padding: '8px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', borderBottom: '1px solid #e8e4dc', background: '#f7f5f0' },
  td: { padding: '8px 12px', borderBottom: '1px solid #eef2fa', fontSize: 13 },
  btn: { padding: '6px 14px', borderRadius: 6, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
  btnOutline: { padding: '6px 14px', borderRadius: 6, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { padding: '4px 10px', borderRadius: 6, border: '1px solid #e85a4a', background: '#fff5f4', color: '#e85a4a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  btnSuccess: { padding: '6px 18px', borderRadius: 8, border: '1px solid #4caf72', background: '#4caf72', color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
  select: { border: '1px solid #e0ddd5', borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#1a2a3a', fontFamily: 'inherit', background: '#fff' },
  pill: { padding: '5px 12px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive: { padding: '5px 12px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  kpi: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' as const },
  kpiCard: { background: '#fff', borderRadius: 12, border: '1px solid #e8e4dc', padding: '14px 18px', minWidth: 120 },
  kpiVal: { fontSize: 24, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 },
  kpiLabel: { fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginTop: 4 },
  warning: { background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#6d4c00' },
  excluded: { opacity: 0.4, textDecoration: 'line-through' as const },
  dateInput: { border: '1px solid #e0ddd5', borderRadius: 8, padding: '6px 12px', fontSize: 14, fontFamily: 'inherit', color: '#1a2a3a' },
}

export default function ProductivityReviewPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, allowed, allowedRoutes, orgId } = usePageGuard()
  const modules = useOrgModules()

  const [selectedDate, setSelectedDate] = useState(() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().slice(0, 10)
  })
  const [rows, setRows] = useState<ProductivityRow[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resyncing, setResyncing] = useState(false)
  const [activityFilter, setActivityFilter] = useState('__all__')
  const [showExcluded, setShowExcluded] = useState(false)

  // Orchard mapping state
  const [mappingOrchardNr, setMappingOrchardNr] = useState<number | null>(null)
  const [mappingOrchardId, setMappingOrchardId] = useState('')

  useEffect(() => {
    if (contextLoaded) loadData()
  }, [contextLoaded, selectedDate])

  async function loadData() {
    setLoading(true)
    const effectiveFarmIds = isSuperAdmin
      ? (await supabase.from('farms').select('id').then(r => (r.data || []).map((f: any) => f.id)))
      : farmIds

    const [{ data: prodData }, { data: orchardData }] = await Promise.all([
      supabase
        .from('worker_daily_productivity')
        .select('*, employee:qc_employees(full_name, employee_nr)')
        .eq('work_date', selectedDate)
        .in('farm_id', effectiveFarmIds)
        .order('supervisor')
        .order('units', { ascending: false }),
      supabase
        .from('orchards')
        .select('id, name, farm_id')
        .in('farm_id', effectiveFarmIds)
        .eq('is_active', true)
        .order('name'),
    ])

    setRows((prodData || []) as ProductivityRow[])
    setOrchards((orchardData || []) as Orchard[])
    setLoading(false)
  }

  // Derived data
  const activities = useMemo(() => {
    const set = new Set(rows.map(r => r.activity_name))
    return [...set].sort()
  }, [rows])

  const filteredRows = useMemo(() => {
    let filtered = rows
    if (activityFilter !== '__all__') filtered = filtered.filter(r => r.activity_name === activityFilter)
    if (!showExcluded) filtered = filtered.filter(r => r.status !== 'excluded')
    return filtered
  }, [rows, activityFilter, showExcluded])

  const unmappedOrchards = useMemo((): UnmappedOrchard[] => {
    const map: Record<number, { name: string | null; count: number }> = {}
    rows.filter(r => r.fcs_orchard_nr && !r.orchard_id).forEach(r => {
      const nr = r.fcs_orchard_nr!
      if (!map[nr]) map[nr] = { name: r.fcs_orchard_name, count: 0 }
      map[nr].count++
    })
    return Object.entries(map).map(([nr, v]) => ({ fcs_orchard_nr: Number(nr), fcs_orchard_name: v.name, count: v.count }))
  }, [rows])

  const kpis = useMemo(() => {
    const pending = rows.filter(r => r.status === 'pending')
    const excluded = rows.filter(r => r.status === 'excluded')
    const approved = rows.filter(r => r.status === 'approved')
    const picking = rows.filter(r => r.activity_name === 'Harvest/Pick/Sort/uitry' && r.status !== 'excluded')
    const totalBags = picking.reduce((s, r) => s + r.units, 0)
    const totalCorrBins = picking.reduce((s, r) => s + (r.corrected_bins || 0), 0)
    return { pending: pending.length, excluded: excluded.length, approved: approved.length, totalBags, totalCorrBins, unmapped: unmappedOrchards.length }
  }, [rows, unmappedOrchards])

  // Actions
  async function excludeRow(id: string, reason: string) {
    await supabase.from('worker_daily_productivity').update({ status: 'excluded', exclude_reason: reason }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'excluded', exclude_reason: reason } : r))
  }

  async function restoreRow(id: string) {
    await supabase.from('worker_daily_productivity').update({ status: 'pending', exclude_reason: null }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'pending', exclude_reason: null } : r))
  }

  async function approveAll() {
    setSaving(true)
    await supabase.from('worker_daily_productivity')
      .update({ status: 'approved' })
      .eq('work_date', selectedDate)
      .eq('status', 'pending')
    setRows(prev => prev.map(r => r.status === 'pending' ? { ...r, status: 'approved' } : r))
    setSaving(false)
  }

  async function handleResync() {
    setResyncing(true)
    // Reset all rows for this date back to pending
    await supabase.from('worker_daily_productivity')
      .update({ status: 'pending', exclude_reason: null })
      .eq('work_date', selectedDate)
    // Trigger sync via API or direct — for now just reload after a delay
    try {
      await fetch(`/api/productivity/resync?date=${selectedDate}`, { method: 'POST' })
    } catch {
      // If API not yet built, just reload
    }
    await loadData()
    setResyncing(false)
  }

  async function saveMapping(fcsOrchardNr: number, orchardId: string) {
    if (!orchardId || !orgId) return
    // Get the name from rows
    const row = rows.find(r => r.fcs_orchard_nr === fcsOrchardNr)
    const fcsName = row?.fcs_orchard_name || null

    // Upsert mapping
    await supabase.from('fcs_orchard_map').upsert({
      organisation_id: orgId,
      fcs_orchard_nr: fcsOrchardNr,
      fcs_orchard_name: fcsName,
      orchard_id: orchardId,
    }, { onConflict: 'organisation_id,fcs_orchard_nr' })

    // Propagate to existing rows
    await supabase.from('worker_daily_productivity')
      .update({ orchard_id: orchardId })
      .eq('fcs_orchard_nr', fcsOrchardNr)
      .is('orchard_id', null)

    setMappingOrchardNr(null)
    setMappingOrchardId('')
    await loadData()
  }

  if (!allowed) return null

  return (
    <div style={s.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} onLogout={async () => { await supabase.auth.signOut(); window.location.href = '/login' }} />
      <main style={s.main}>
        <MobileNav />

        {/* Header */}
        <div style={s.header}>
          <h1 style={s.title}>Productivity Review</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={s.dateInput}
            />
            <button style={s.btnOutline} onClick={handleResync} disabled={resyncing}>
              {resyncing ? 'Resyncing...' : 'Resync from FCS'}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={s.kpi}>
          <div style={s.kpiCard}>
            <div style={s.kpiVal}>{kpis.pending}</div>
            <div style={s.kpiLabel}>Pending</div>
          </div>
          <div style={s.kpiCard}>
            <div style={{ ...s.kpiVal, color: '#4caf72' }}>{kpis.approved}</div>
            <div style={s.kpiLabel}>Approved</div>
          </div>
          <div style={s.kpiCard}>
            <div style={{ ...s.kpiVal, color: '#e85a4a' }}>{kpis.excluded}</div>
            <div style={s.kpiLabel}>Excluded</div>
          </div>
          <div style={s.kpiCard}>
            <div style={s.kpiVal}>{kpis.totalBags.toLocaleString()}</div>
            <div style={s.kpiLabel}>Total Bags (picking)</div>
          </div>
          <div style={s.kpiCard}>
            <div style={s.kpiVal}>{kpis.totalCorrBins.toFixed(1)}</div>
            <div style={s.kpiLabel}>Corrected Bins</div>
          </div>
        </div>

        {/* Unmapped orchards warning */}
        {unmappedOrchards.length > 0 && (
          <div style={s.warning}>
            <strong>{unmappedOrchards.length} unmapped FCS orchards</strong> — map them below so data resolves to the correct orchard.
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {unmappedOrchards.map(uo => (
                <div key={uo.fcs_orchard_nr} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, minWidth: 50 }}>#{uo.fcs_orchard_nr}</span>
                  <span style={{ minWidth: 200 }}>{uo.fcs_orchard_name || '—'}</span>
                  <span style={{ fontSize: 11, color: '#8a95a0' }}>({uo.count} rows)</span>
                  {mappingOrchardNr === uo.fcs_orchard_nr ? (
                    <>
                      <select style={s.select} value={mappingOrchardId} onChange={e => setMappingOrchardId(e.target.value)}>
                        <option value="">Select orchard...</option>
                        {orchards.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                      <button style={{ ...s.btn, padding: '4px 10px', fontSize: 12 }} onClick={() => saveMapping(uo.fcs_orchard_nr, mappingOrchardId)} disabled={!mappingOrchardId}>Save</button>
                      <button style={{ ...s.btnOutline, padding: '4px 10px', fontSize: 12 }} onClick={() => setMappingOrchardNr(null)}>Cancel</button>
                    </>
                  ) : (
                    <button style={{ ...s.btnOutline, padding: '4px 10px', fontSize: 12 }} onClick={() => { setMappingOrchardNr(uo.fcs_orchard_nr); setMappingOrchardId('') }}>Map</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity filter + controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={activityFilter === '__all__' ? s.pillActive : s.pill} onClick={() => setActivityFilter('__all__')}>All</button>
          {activities.map(a => (
            <button key={a} style={activityFilter === a ? s.pillActive : s.pill} onClick={() => setActivityFilter(a)}>
              {a}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <label style={{ fontSize: 12, color: '#8a95a0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={showExcluded} onChange={e => setShowExcluded(e.target.checked)} />
            Show excluded
          </label>
          {kpis.pending > 0 && (
            <button style={s.btnSuccess} onClick={approveAll} disabled={saving}>
              {saving ? 'Approving...' : `Approve All (${kpis.pending})`}
            </button>
          )}
        </div>

        {/* Data table */}
        <div style={s.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={s.th}>Employee</th>
                  <th style={s.th}>Supervisor</th>
                  <th style={s.th}>Activity</th>
                  <th style={s.th}>Orchard</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Units</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Hours</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Units/Day</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Corr. Bins</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: '#8a95a0', padding: 40 }}>Loading...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: '#8a95a0', padding: 40 }}>No data for {selectedDate}</td></tr>
                ) : (
                  filteredRows.map(r => {
                    const isExcluded = r.status === 'excluded'
                    const orchardName = r.orchard_id
                      ? orchards.find(o => o.id === r.orchard_id)?.name || '?'
                      : r.fcs_orchard_name || `#${r.fcs_orchard_nr}`
                    return (
                      <tr key={r.id} style={isExcluded ? s.excluded : undefined}>
                        <td style={{ ...s.td, fontWeight: 500 }}>{r.employee?.full_name || '?'}</td>
                        <td style={{ ...s.td, color: '#6a7a70' }}>{r.supervisor || '—'}</td>
                        <td style={{ ...s.td, fontSize: 12 }}>{r.activity_name}</td>
                        <td style={{ ...s.td, color: r.orchard_id ? '#1a2a3a' : '#e85a4a' }}>{orchardName}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{r.units}</td>
                        <td style={{ ...s.td, textAlign: 'right', color: '#6a7a70' }}>{r.hours?.toFixed(1) || '—'}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>{r.units_per_man_day?.toFixed(1) || '—'}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: '#2176d9' }}>
                          {r.corrected_bins != null ? r.corrected_bins.toFixed(2) : '—'}
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: r.status === 'approved' ? '#e8f5e9' : r.status === 'excluded' ? '#fde8e8' : '#fff8e1',
                            color: r.status === 'approved' ? '#2e7d32' : r.status === 'excluded' ? '#c62828' : '#6d4c00',
                          }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          {r.status === 'pending' && (
                            <button style={s.btnDanger} onClick={() => excludeRow(r.id, 'manual')}>Exclude</button>
                          )}
                          {r.status === 'excluded' && (
                            <button style={{ ...s.btnOutline, padding: '4px 10px', fontSize: 12 }} onClick={() => restoreRow(r.id)}>Restore</button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

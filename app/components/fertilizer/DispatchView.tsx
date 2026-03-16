'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type { ConfirmRow } from './ConfirmApplications'

interface DispatchOrchard {
  orchard_id: string
  line_id: string
  orchard_name: string
  orchard_nr: number | null
  variety: string | null
}

interface DispatchRow {
  id: string
  timing_id: string
  timing_label: string
  timing_sort: number
  product_id: string
  product_name: string
  dispatched_to: string | null
  dispatched_to_name: string | null
  spreader_id: string | null
  spreader_name: string | null
  dispatched_at: string
  status: string
  notes: string | null
  orchards: DispatchOrchard[]
}

interface Applicator {
  id: string
  full_name: string
}

interface SpreaderOption {
  id: string
  name: string
}

interface Props {
  farmId: string
  season: string
  orgId: string
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (Math.abs(v) >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

function orchardLabel(row: { orchard_nr: number | null; orchard_name: string; variety: string | null }): string {
  const nr = row.orchard_nr != null ? `${row.orchard_nr} ` : ''
  const variety = row.variety ? ` (${row.variety})` : ''
  return `${nr}${row.orchard_name}${variety}`
}

export default function DispatchView({ farmId, season, orgId }: Props) {
  const [appStatus, setAppStatus] = useState<ConfirmRow[]>([])
  const [dispatches, setDispatches] = useState<DispatchRow[]>([])
  const [applicators, setApplicators] = useState<Applicator[]>([])
  const [spreaders, setSpreaders] = useState<SpreaderOption[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDispatchId, setExpandedDispatchId] = useState<string | null>(null)

  // Selection state
  const [selectedTimingId, setSelectedTimingId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null)
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())
  const [selectedApplicatorId, setSelectedApplicatorId] = useState<string>('')
  const [selectedSpreaderId, setSelectedSpreaderId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // Fetch applicators + spreaders
  useEffect(() => {
    async function loadApplicators() {
      try {
        const res = await fetch(`/api/fertilizer/dispatch?farm_id=${farmId}&applicators=1`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setApplicators(data)
        }
      } catch { /* ignore */ }
    }
    async function loadSpreaders() {
      try {
        const res = await fetch(`/api/fertilizer/spreaders?farm_id=${farmId}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setSpreaders(data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))
        }
      } catch { /* ignore */ }
    }
    loadApplicators()
    loadSpreaders()
  }, [farmId])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [confirmRes, dispatchRes] = await Promise.all([
        fetch(`/api/fertilizer/confirm?farm_id=${farmId}&season=${encodeURIComponent(season)}`),
        fetch(`/api/fertilizer/dispatch?farm_id=${farmId}`),
      ])
      setAppStatus(confirmRes.ok ? await confirmRes.json() : [])
      setDispatches(dispatchRes.ok ? await dispatchRes.json() : [])
    } catch {
      setAppStatus([])
      setDispatches([])
    }
    setLoading(false)
  }, [farmId, season])

  useEffect(() => { fetchData() }, [fetchData])

  // Build set of line_ids that are in active dispatches
  const activeDispatchedLineIds = useMemo(() => {
    const set = new Set<string>()
    for (const d of dispatches) {
      if (d.status !== 'active') continue
      for (const o of d.orchards) set.add(o.line_id)
    }
    return set
  }, [dispatches])

  // Outstanding timings: only those with at least one unconfirmed & undispatched orchard
  const outstandingTimings = useMemo(() => {
    const map = new Map<string, { id: string; label: string; sort: number; outstanding: number; total: number }>()
    for (const r of appStatus) {
      if (!map.has(r.timing_id)) {
        map.set(r.timing_id, { id: r.timing_id, label: r.timing_label, sort: r.timing_sort, outstanding: 0, total: 0 })
      }
      const entry = map.get(r.timing_id)!
      entry.total++
      if (!r.confirmed && !activeDispatchedLineIds.has(r.line_id)) entry.outstanding++
    }
    return [...map.values()].filter(t => t.outstanding > 0).sort((a, b) => a.sort - b.sort)
  }, [appStatus, activeDispatchedLineIds])

  // Auto-select first outstanding timing
  const activeTiming = (selectedTimingId && outstandingTimings.some(t => t.id === selectedTimingId))
    ? selectedTimingId
    : outstandingTimings[0]?.id ?? null

  // Outstanding products for the selected timing
  const outstandingProducts = useMemo(() => {
    if (!activeTiming) return []
    const map = new Map<string, { id: string; name: string; outstanding: number; total: number }>()
    for (const r of appStatus) {
      if (r.timing_id !== activeTiming) continue
      if (!map.has(r.product_id)) {
        map.set(r.product_id, { id: r.product_id, name: r.product_name, outstanding: 0, total: 0 })
      }
      const entry = map.get(r.product_id)!
      entry.total++
      if (!r.confirmed && !activeDispatchedLineIds.has(r.line_id)) entry.outstanding++
    }
    return [...map.values()].filter(p => p.outstanding > 0).sort((a, b) => a.name.localeCompare(b.name))
  }, [appStatus, activeTiming, activeDispatchedLineIds])

  // Auto-select first outstanding product
  const activeProduct = (selectedProductId && outstandingProducts.some(p => p.id === selectedProductId))
    ? selectedProductId
    : outstandingProducts[0]?.id ?? null

  // Dispatchable orchards: unconfirmed & not in active dispatch, for current timing+product
  const dispatchableOrchards = useMemo(() => {
    if (!activeTiming || !activeProduct) return []
    return appStatus.filter(r =>
      r.timing_id === activeTiming &&
      r.product_id === activeProduct &&
      !r.confirmed &&
      !activeDispatchedLineIds.has(r.line_id)
    )
  }, [appStatus, activeTiming, activeProduct, activeDispatchedLineIds])

  // Varieties from dispatchable orchards
  const varieties = useMemo(() => {
    const set = new Set<string>()
    for (const r of dispatchableOrchards) if (r.variety) set.add(r.variety)
    return [...set].sort()
  }, [dispatchableOrchards])

  const activeVariety = (selectedVariety && varieties.includes(selectedVariety))
    ? selectedVariety : null

  // Final filtered list
  const filteredOrchards = useMemo(() => {
    if (!activeVariety) return dispatchableOrchards
    return dispatchableOrchards.filter(r => r.variety === activeVariety)
  }, [dispatchableOrchards, activeVariety])

  // Progress info
  const activeTimingData = outstandingTimings.find(t => t.id === activeTiming)
  const activeProductData = outstandingProducts.find(p => p.id === activeProduct)

  function toggleLine(lineId: string) {
    setSelectedLineIds(prev => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId)
      return next
    })
  }

  function handleSelectAll() {
    setSelectedLineIds(new Set(filteredOrchards.map(r => r.line_id)))
  }

  function handleClearAll() {
    setSelectedLineIds(new Set())
  }

  async function handleDispatch() {
    if (!activeTiming || !activeProduct || selectedLineIds.size === 0) return
    setCreating(true)
    try {
      await fetch('/api/fertilizer/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: farmId,
          timing_id: activeTiming,
          product_id: activeProduct,
          line_ids: [...selectedLineIds],
          dispatched_to: selectedApplicatorId || undefined,
          spreader_id: selectedSpreaderId || undefined,
          notes: notes || undefined,
          organisation_id: orgId,
        }),
      })
      setSelectedLineIds(new Set())
      setSelectedApplicatorId('')
      setSelectedSpreaderId('')
      setNotes('')
      await fetchData()
    } catch { /* ignore */ }
    setCreating(false)
  }

  async function handleCancel(dispatchId: string) {
    if (!confirm('Cancel this dispatch?')) return
    await fetch('/api/fertilizer/dispatch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatch_id: dispatchId, status: 'cancelled' }),
    })
    fetchData()
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6a7a70' }}>Loading dispatch data...</div>
  }

  const activeDispatches = dispatches.filter(d => d.status === 'active')
  const pastDispatches = dispatches.filter(d => d.status !== 'active')
  const hasOutstanding = outstandingTimings.length > 0

  return (
    <div style={{ paddingBottom: selectedLineIds.size > 0 ? 72 : 0 }}>
      {/* ── Outstanding timings ── */}
      {hasOutstanding ? (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 10 }}>
            {outstandingTimings.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTimingId(t.id); setSelectedProductId(null); setSelectedVariety(null); setSelectedLineIds(new Set()) }}
                style={{ ...st.pill, ...(activeTiming === t.id ? st.pillActive : {}) }}
              >
                {t.label}
                <span style={st.pillCount}>
                  {t.outstanding}/{t.total}
                </span>
              </button>
            ))}
          </div>

          <div style={st.hr} />

          {/* ── Outstanding products ── */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 12 }}>
            {outstandingProducts.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedProductId(p.id); setSelectedVariety(null); setSelectedLineIds(new Set()) }}
                style={{ ...st.pill, ...(activeProduct === p.id ? st.pillActive : {}) }}
              >
                {p.name}
                <span style={st.pillCount}>
                  {p.outstanding}/{p.total}
                </span>
              </button>
            ))}
          </div>

          {/* ── Variety filter ── */}
          {varieties.length > 1 && (
            <>
              <div style={st.hr} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#6a7a70', fontWeight: 500 }}>Variety:</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedVariety(null)}
                    style={{ ...st.filterPill, ...(activeVariety === null ? st.filterPillActive : {}) }}
                  >
                    All
                  </button>
                  {varieties.map(v => (
                    <button
                      key={v}
                      onClick={() => setSelectedVariety(v)}
                      style={{ ...st.filterPill, ...(activeVariety === v ? st.filterPillActive : {}) }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Progress card ── */}
          {activeProductData && activeTimingData && (
            <div style={st.progressCard}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1a2a3a', marginBottom: 4 }}>
                {activeProductData.name} &mdash; {activeTimingData.label}
              </div>
              <div style={{ fontSize: 13, color: '#6a7a70' }}>
                {dispatchableOrchards.length} of {activeProductData.total} orchards outstanding
              </div>
            </div>
          )}

          {/* ── Controls ── */}
          <div style={st.controlRow}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSelectAll} style={st.actionBtn}>Select All</button>
              <button onClick={handleClearAll} style={st.actionBtn}>Clear All</button>
            </div>
          </div>

          {/* ── Orchard list ── */}
          {filteredOrchards.length > 0 ? (
            <div style={st.listContainer}>
              {filteredOrchards.map(row => {
                const checked = selectedLineIds.has(row.line_id)
                return (
                  <div
                    key={row.line_id}
                    onClick={() => toggleLine(row.line_id)}
                    style={{ ...st.row, ...(checked ? st.rowSelected : {}), cursor: 'pointer' }}
                  >
                    <div style={st.checkbox}>
                      {checked ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <rect width="16" height="16" rx="3" fill="#2176d9" />
                          <path d="M4 8l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" stroke="#c0bbb5" fill="#fff" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, color: '#1a2a3a', fontSize: 14 }}>
                          {orchardLabel(row)}
                        </span>
                        <span style={{ fontSize: 12, color: '#6a7a70' }}>
                          {row.ha != null ? `${Number(row.ha).toFixed(1)} ha` : ''}
                        </span>
                        <span style={{ fontSize: 12, color: '#6a7a70' }}>
                          {row.rate_per_ha != null ? `${formatNum(row.rate_per_ha)} ${row.unit}` : ''}
                        </span>
                        <span style={{ fontSize: 12, color: '#6a7a70', fontWeight: 500 }}>
                          {row.total_qty != null ? `${formatNum(row.total_qty)} kg` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#6a7a70', fontSize: 14 }}>
              No outstanding orchards for this selection.
            </div>
          )}

          {/* ── Applicator + Notes ── */}
          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 200 }}>
              <label style={st.fieldLabel}>Applicator</label>
              <select
                value={selectedApplicatorId}
                onChange={e => setSelectedApplicatorId(e.target.value)}
                style={st.select}
              >
                <option value="">-- Select applicator --</option>
                {applicators.map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
              <a href="/applicators/new" target="_blank" style={st.addLink}>+ Add applicator</a>
            </div>
            <div style={{ minWidth: 200 }}>
              <label style={st.fieldLabel}>Spreader</label>
              <select
                value={selectedSpreaderId}
                onChange={e => setSelectedSpreaderId(e.target.value)}
                style={st.select}
              >
                <option value="">-- Select spreader --</option>
                {spreaders.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={st.fieldLabel}>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Instructions for applicator..."
                rows={2}
                style={st.textarea}
              />
            </div>
          </div>

          {/* ── Sticky dispatch button ── */}
          {selectedLineIds.size > 0 && (
            <div style={st.stickyBar}>
              <span style={{ fontSize: 14, color: '#1a2a3a', fontWeight: 500 }}>
                {selectedLineIds.size} orchard{selectedLineIds.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleDispatch}
                disabled={creating}
                style={{ ...st.dispatchBtn, opacity: creating ? 0.6 : 1 }}
              >
                {creating ? 'Dispatching...' : `Dispatch ${selectedLineIds.size} Orchard${selectedLineIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: '#6a7a70', fontSize: 14 }}>
          {appStatus.length === 0
            ? 'No recommendation data available for this farm and season.'
            : 'All orchards are confirmed or dispatched.'}
        </div>
      )}

      {/* ════════ Active Dispatches ════════ */}
      {activeDispatches.length > 0 && (
        <div style={{ ...st.card, marginTop: 24 }}>
          <h3 style={st.cardTitle}>Active Dispatches</h3>
          <div style={st.table}>
            <div style={st.tableHeader}>
              <div style={{ flex: 1 }}>Timing</div>
              <div style={{ flex: 1 }}>Product</div>
              <div style={{ flex: 1 }}>Applicator</div>
              <div style={{ flex: 1 }}>Orchards</div>
              <div style={{ width: 140 }}>Dispatched</div>
              <div style={{ width: 80 }}></div>
            </div>
            {activeDispatches.map(d => (
              <div key={d.id}>
                <div
                  style={{ ...st.tableRow, cursor: 'pointer' }}
                  onClick={() => setExpandedDispatchId(expandedDispatchId === d.id ? null : d.id)}
                >
                  <div style={{ flex: 1 }}>{d.timing_label}</div>
                  <div style={{ flex: 1 }}>{d.product_name}</div>
                  <div style={{ flex: 1, fontSize: 13, color: d.dispatched_to_name ? '#1a2a3a' : '#a0a0a0' }}>
                    {d.dispatched_to_name || 'Unassigned'}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: '#6a7a70' }}>
                    {d.orchards.length} orchard{d.orchards.length !== 1 ? 's' : ''}
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#a0a0a0' }}>
                      {expandedDispatchId === d.id ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>
                  <div style={{ width: 140, fontSize: 13, color: '#6a7a70' }}>
                    {new Date(d.dispatched_at).toLocaleDateString()}
                  </div>
                  <div style={{ width: 80 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleCancel(d.id)} style={st.cancelBtn}>Cancel</button>
                  </div>
                </div>
                {expandedDispatchId === d.id && d.orchards.length > 0 && (
                  <div style={st.expandedOrchards}>
                    {d.orchards.map(o => (
                      <div key={o.line_id} style={st.expandedRow}>
                        {orchardLabel(o)}
                      </div>
                    ))}
                    {d.notes && (
                      <div style={{ padding: '8px 16px', fontSize: 12, color: '#6a7a70', fontStyle: 'italic' }}>
                        {d.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════ Past Dispatches ════════ */}
      {pastDispatches.length > 0 && (
        <div style={{ ...st.card, marginTop: 16 }}>
          <h3 style={{ ...st.cardTitle, color: '#6a7a70' }}>Past Dispatches</h3>
          <div style={st.table}>
            <div style={st.tableHeader}>
              <div style={{ flex: 1 }}>Timing</div>
              <div style={{ flex: 1 }}>Product</div>
              <div style={{ flex: 1 }}>Applicator</div>
              <div style={{ flex: 1 }}>Orchards</div>
              <div style={{ width: 140 }}>Date</div>
              <div style={{ width: 80 }}>Status</div>
            </div>
            {pastDispatches.map(d => (
              <div key={d.id} style={{ ...st.tableRow, opacity: 0.6 }}>
                <div style={{ flex: 1 }}>{d.timing_label}</div>
                <div style={{ flex: 1 }}>{d.product_name}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#6a7a70' }}>
                  {d.dispatched_to_name || 'Unassigned'}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: '#6a7a70' }}>
                  {d.orchards.length} orchard{d.orchards.length !== 1 ? 's' : ''}
                </div>
                <div style={{ width: 140, fontSize: 13, color: '#6a7a70' }}>
                  {new Date(d.dispatched_at).toLocaleDateString()}
                </div>
                <div style={{ width: 80 }}>
                  <span style={{
                    ...st.statusBadge,
                    background: d.status === 'completed' ? '#e8f5e8' : '#fde8e8',
                    color: d.status === 'completed' ? '#2e6a3e' : '#a03030',
                  }}>
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  pill: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca',
    background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'all 0.15s',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  pillActive: {
    border: '1px solid #2176d9', background: '#2176d9', color: '#fff',
  },
  pillCount: {
    fontSize: 11, opacity: 0.75, fontWeight: 400,
  },
  filterPill: {
    padding: '4px 10px', borderRadius: 14, border: '1px solid #e0dbd4',
    background: '#f8f6f2', color: '#5a6a60', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'all 0.15s',
  },
  filterPillActive: {
    border: '1px solid #1a2a3a', background: '#1a2a3a', color: '#fff',
  },
  hr: {
    height: 1, background: '#c0bbb5', marginBottom: 10,
  },
  progressCard: {
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16,
  },
  controlRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, flexWrap: 'wrap', gap: 8,
  },
  actionBtn: {
    padding: '6px 14px', borderRadius: 8, border: '1px solid #d4cfca',
    background: '#fff', color: '#1a2a3a', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  listContainer: {
    border: '1px solid #e8e4dc', borderRadius: 12, overflow: 'hidden',
    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '12px 16px', borderBottom: '1px solid #f0ede6',
    transition: 'background 0.15s',
  },
  rowSelected: {
    background: '#eef4fd',
  },
  checkbox: {
    flexShrink: 0, paddingTop: 2,
  },
  textarea: {
    width: '100%', padding: '10px 12px', border: '1px solid #d4cfca',
    borderRadius: 8, fontSize: 14, fontFamily: 'Inter, sans-serif',
    outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const,
  },
  stickyBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 24px', background: '#fff',
    borderTop: '1px solid #e8e4dc',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
    zIndex: 50,
  },
  dispatchBtn: {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  card: {
    background: '#fff', borderRadius: 14, padding: '24px 28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontSize: 16, fontWeight: 700, color: '#1a2a3a', margin: '0 0 16px',
  },
  table: {
    borderTop: '1px solid #eae6df',
  },
  tableHeader: {
    display: 'flex', gap: 12, padding: '10px 0', fontSize: 12, fontWeight: 600,
    color: '#6a7a70', textTransform: 'uppercase' as const, letterSpacing: '0.04em',
    borderBottom: '1px solid #eae6df',
  },
  tableRow: {
    display: 'flex', gap: 12, padding: '12px 0', fontSize: 14,
    color: '#1a2a3a', borderBottom: '1px solid #f5f3f0', alignItems: 'center',
  },
  cancelBtn: {
    padding: '4px 12px', borderRadius: 6, border: '1px solid #e85a4a',
    background: '#fff', color: '#e85a4a', fontSize: 12, fontWeight: 500,
    cursor: 'pointer',
  },
  statusBadge: {
    padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
  },
  expandedOrchards: {
    background: '#f8f6f2', borderBottom: '1px solid #eae6df',
  },
  expandedRow: {
    padding: '6px 16px 6px 32px', fontSize: 13, color: '#3a4a40',
    borderBottom: '1px solid #eee',
  },
  fieldLabel: {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#6a7a70',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6,
  },
  select: {
    width: '100%', padding: '8px 10px', border: '1px solid #d4cfca',
    borderRadius: 8, fontSize: 14, background: '#fff', color: '#1a2a3a',
    outline: 'none', fontFamily: 'Inter, sans-serif',
  },
  addLink: {
    display: 'inline-block', marginTop: 6, fontSize: 12, color: '#2176d9',
    fontWeight: 500, textDecoration: 'none',
  },
}

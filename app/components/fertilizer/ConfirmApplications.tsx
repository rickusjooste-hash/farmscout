'use client'

import { useMemo, useRef, useState } from 'react'

export interface ConfirmRow {
  line_id: string
  farm_id: string
  timing_id: string
  timing_label: string
  timing_sort: number
  product_id: string
  product_name: string
  orchard_id: string
  orchard_name: string
  orchard_nr: number | null
  variety: string | null
  commodity_name: string | null
  rate_per_ha: number
  unit: string
  total_qty: number | null
  ha: number | null
  confirmed: boolean
  date_applied: string | null
  confirmed_by_name: string | null
}

interface Props {
  data: ConfirmRow[]
  loading: boolean
  onRefresh: () => void
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function orchardLabel(row: ConfirmRow): string {
  const nr = row.orchard_nr != null ? `${row.orchard_nr} ` : ''
  const variety = row.variety ? ` (${row.variety})` : ''
  return `${nr}${row.orchard_name}${variety}`
}

export default function ConfirmApplications({ data, loading, onRefresh }: Props) {
  const [selectedTiming, setSelectedTiming] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null)
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null)
  const [dateApplied, setDateApplied] = useState(todayStr())
  const [dateModified, setDateModified] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map())
  const [saving, setSaving] = useState(false)
  const [showDatePrompt, setShowDatePrompt] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Derive timing pills
  const timings = useMemo(() => {
    const map = new Map<string, { id: string; label: string; sort: number }>()
    for (const r of data) {
      if (!map.has(r.timing_id)) map.set(r.timing_id, { id: r.timing_id, label: r.timing_label, sort: r.timing_sort })
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort)
  }, [data])

  // Auto-select first timing
  const activeTiming = selectedTiming ?? timings[0]?.id ?? null

  // Products filtered by timing
  const products = useMemo(() => {
    if (!activeTiming) return []
    const map = new Map<string, { id: string; name: string }>()
    for (const r of data) {
      if (r.timing_id === activeTiming && !map.has(r.product_id))
        map.set(r.product_id, { id: r.product_id, name: r.product_name })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [data, activeTiming])

  // Auto-select first product
  const activeProduct = (selectedProduct && products.some(p => p.id === selectedProduct))
    ? selectedProduct
    : products[0]?.id ?? null

  // Rows matching timing + product (before commodity/variety filter)
  const timingProductRows = useMemo(() => {
    return data.filter(r => r.timing_id === activeTiming && r.product_id === activeProduct)
  }, [data, activeTiming, activeProduct])

  // Commodities available in current timing/product
  const commodities = useMemo(() => {
    const set = new Set<string>()
    for (const r of timingProductRows) if (r.commodity_name) set.add(r.commodity_name)
    return [...set].sort()
  }, [timingProductRows])

  // Active commodity — null means "All"
  const activeCommodity = (selectedCommodity && commodities.includes(selectedCommodity))
    ? selectedCommodity : null

  // Varieties available in current timing/product (filtered by commodity if selected)
  const varieties = useMemo(() => {
    const set = new Set<string>()
    for (const r of timingProductRows) {
      if (activeCommodity && r.commodity_name !== activeCommodity) continue
      if (r.variety) set.add(r.variety)
    }
    return [...set].sort()
  }, [timingProductRows, activeCommodity])

  // Active variety — null means "All"
  const activeVariety = (selectedVariety && varieties.includes(selectedVariety))
    ? selectedVariety : null

  // Filtered rows (timing + product + optional commodity + optional variety)
  const rows = useMemo(() => {
    return timingProductRows.filter(r => {
      if (activeCommodity && r.commodity_name !== activeCommodity) return false
      if (activeVariety && r.variety !== activeVariety) return false
      return true
    })
  }, [timingProductRows, activeCommodity, activeVariety])

  // Effective confirmed state (server data + pending overrides)
  function isConfirmed(lineId: string, serverVal: boolean): boolean {
    return pendingChanges.has(lineId) ? pendingChanges.get(lineId)! : serverVal
  }

  // Count pending changes that apply to current visible rows
  const pendingCount = pendingChanges.size

  // Progress stats
  const confirmedCount = rows.filter(r => isConfirmed(r.line_id, r.confirmed)).length
  const totalCount = rows.length
  const pct = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0

  // Active timing/product labels for header
  const activeTimingLabel = timings.find(t => t.id === activeTiming)?.label ?? ''
  const activeProductLabel = products.find(p => p.id === activeProduct)?.name ?? ''

  async function saveAllPending() {
    if (pendingChanges.size === 0) return
    setSaving(true)
    try {
      const toConfirm: string[] = []
      const toUnconfirm: string[] = []
      for (const [lineId, val] of pendingChanges) {
        if (val) toConfirm.push(lineId)
        else toUnconfirm.push(lineId)
      }
      const promises: Promise<Response>[] = []
      if (toConfirm.length > 0) {
        promises.push(fetch('/api/fertilizer/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line_ids: toConfirm, confirmed: true, date_applied: dateApplied }),
        }))
      }
      if (toUnconfirm.length > 0) {
        promises.push(fetch('/api/fertilizer/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line_ids: toUnconfirm, confirmed: false }),
        }))
      }
      await Promise.all(promises)
      setPendingChanges(new Map())
      setShowDatePrompt(false)
      onRefresh()
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  function handleConfirmClick() {
    if (!dateModified) {
      setShowDatePrompt(true)
      return
    }
    saveAllPending()
  }

  function handleToggle(row: ConfirmRow) {
    const current = isConfirmed(row.line_id, row.confirmed)
    const next = !current
    setPendingChanges(prev => {
      const m = new Map(prev)
      // If toggling back to server state, remove from pending
      if (next === row.confirmed) m.delete(row.line_id)
      else m.set(row.line_id, next)
      return m
    })
  }

  function handleSelectAll() {
    const updates = new Map(pendingChanges)
    for (const r of rows) {
      if (!isConfirmed(r.line_id, r.confirmed)) {
        if (r.confirmed) updates.delete(r.line_id)
        else updates.set(r.line_id, true)
      }
    }
    setPendingChanges(updates)
  }

  function handleClearAll() {
    const updates = new Map(pendingChanges)
    for (const r of rows) {
      if (isConfirmed(r.line_id, r.confirmed)) {
        if (!r.confirmed) updates.delete(r.line_id)
        else updates.set(r.line_id, false)
      }
    }
    setPendingChanges(updates)
  }

  function handleCancelPending() {
    setPendingChanges(new Map())
    setShowDatePrompt(false)
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6a7a70' }}>Loading...</div>
  }

  if (data.length === 0) return null

  return (
    <div style={{ paddingBottom: pendingCount > 0 ? 72 : 0 }}>
      {/* Timing pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 10 }}>
        {timings.map(t => (
          <button
            key={t.id}
            onClick={() => { setSelectedTiming(t.id); setSelectedProduct(null) }}
            style={{ ...st.pill, ...(activeTiming === t.id ? st.pillActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={st.hr} />

      {/* Product pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 12 }}>
        {products.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProduct(p.id)}
            style={{ ...st.pill, ...(activeProduct === p.id ? st.pillActive : {}) }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Commodity filter pills */}
      {commodities.length > 1 && (
        <>
          <div style={st.hr} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#6a7a70', fontWeight: 500 }}>Commodity:</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button
                onClick={() => { setSelectedCommodity(null); setSelectedVariety(null) }}
                style={{ ...st.filterPill, ...(activeCommodity === null ? st.filterPillActive : {}) }}
              >
                All
              </button>
              {commodities.map(c => (
                <button
                  key={c}
                  onClick={() => { setSelectedCommodity(c); setSelectedVariety(null) }}
                  style={{ ...st.filterPill, ...(activeCommodity === c ? st.filterPillActive : {}) }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Variety filter pills */}
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

      {/* Progress header */}
      <div style={st.progressCard}>
        <div style={{ fontWeight: 600, fontSize: 15, color: '#1a2a3a', marginBottom: 4 }}>
          {activeProductLabel} &mdash; {activeTimingLabel}
        </div>
        <div style={{ fontSize: 13, color: '#6a7a70', marginBottom: 8 }}>
          {confirmedCount} of {totalCount} orchards confirmed
        </div>
        <div style={st.progressTrack}>
          <div style={{ ...st.progressFill, width: `${pct}%` }} />
        </div>
        <div style={{ fontSize: 12, color: '#6a7a70', marginTop: 4 }}>{pct}%</div>
      </div>

      {/* Controls row */}
      <div style={st.controlRow}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSelectAll} disabled={saving} style={st.actionBtn}>Select All</button>
          <button onClick={handleClearAll} disabled={saving} style={st.actionBtn}>Clear All</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#6a7a70' }}>Date:</label>
          <input
            ref={dateInputRef}
            type="date"
            value={dateApplied}
            onChange={e => { setDateApplied(e.target.value); setDateModified(true); setShowDatePrompt(false) }}
            style={st.dateInput}
          />
        </div>
      </div>

      {/* Orchard list */}
      <div style={st.listContainer}>
        {rows.map(row => {
          const checked = isConfirmed(row.line_id, row.confirmed)
          const isPending = pendingChanges.has(row.line_id)
          return (
            <div
              key={row.line_id}
              onClick={() => handleToggle(row)}
              style={{
                ...st.row,
                ...(checked ? st.rowConfirmed : {}),
                ...(isPending ? st.rowPending : {}),
                cursor: 'pointer',
              }}
            >
              <div style={st.checkbox}>
                {checked && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect width="16" height="16" rx="3" fill={isPending ? '#6aaa8a' : '#4caf72'} />
                    <path d="M4 8l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {!checked && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" stroke="#c0bbb5" fill="#fff" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500, color: '#1a2a3a', fontSize: 14 }}>{orchardLabel(row)}</span>
                  <span style={{ fontSize: 12, color: '#6a7a70' }}>
                    {row.ha != null ? `${row.ha.toFixed(1)} ha` : ''}
                  </span>
                  <span style={{ fontSize: 12, color: '#6a7a70' }}>
                    {row.rate_per_ha != null ? `${formatNum(row.rate_per_ha)} ${row.unit}` : ''}
                  </span>
                  <span style={{ fontSize: 12, color: '#6a7a70', fontWeight: 500 }}>
                    {row.total_qty != null ? `${formatNum(row.total_qty)} kg` : ''}
                  </span>
                </div>
                {checked && !isPending && row.date_applied && (
                  <div style={{ fontSize: 12, color: '#4caf72', marginTop: 2 }}>
                    Applied {formatDate(row.date_applied)}
                    {row.confirmed_by_name ? ` by ${row.confirmed_by_name}` : ''}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Date confirmation prompt */}
      {showDatePrompt && (
        <div style={st.datePrompt}>
          <div style={{ fontSize: 14, color: '#1a2a3a', marginBottom: 10 }}>
            Date is set to today ({formatDisplayDate(dateApplied)}). Is this correct?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowDatePrompt(false); saveAllPending() }}
              style={st.confirmBtn}
            >
              Yes, confirm
            </button>
            <button
              onClick={() => { setShowDatePrompt(false); dateInputRef.current?.showPicker?.(); dateInputRef.current?.focus() }}
              style={st.actionBtn}
            >
              Change date
            </button>
          </div>
        </div>
      )}

      {/* Sticky confirm bar */}
      {pendingCount > 0 && !showDatePrompt && (
        <div style={st.stickyBar}>
          <span style={{ fontSize: 14, color: '#1a2a3a', fontWeight: 500 }}>
            {pendingCount} {pendingCount === 1 ? 'change' : 'changes'} pending
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCancelPending} disabled={saving} style={st.actionBtn}>
              Cancel
            </button>
            <button onClick={handleConfirmClick} disabled={saving} style={st.confirmBtn}>
              {saving ? 'Saving...' : `Confirm (${pendingCount})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (Math.abs(v) >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

const st: Record<string, React.CSSProperties> = {
  pill: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca',
    background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'all 0.15s',
  },
  pillActive: {
    border: '1px solid #2176d9', background: '#2176d9', color: '#fff',
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
  progressTrack: {
    height: 8, borderRadius: 4, background: '#e8e4dc', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 4, background: '#4caf72',
    transition: 'width 0.3s ease',
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
  confirmBtn: {
    padding: '6px 16px', borderRadius: 8, border: '1px solid #4caf72',
    background: '#4caf72', color: '#fff', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  dateInput: {
    padding: '6px 10px', border: '1px solid #d4cfca', borderRadius: 8,
    fontSize: 13, background: '#fff', color: '#1a2a3a', outline: 'none',
    fontFamily: 'Inter, sans-serif',
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
  rowConfirmed: {
    background: '#f5faf6',
  },
  rowPending: {
    borderLeft: '3px solid #f5c842',
  },
  checkbox: {
    flexShrink: 0, paddingTop: 2,
  },
  stickyBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 24px', background: '#fff',
    borderTop: '1px solid #e8e4dc',
    boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
    zIndex: 50,
  },
  datePrompt: {
    marginTop: 16, padding: '16px 20px', background: '#fef9ee',
    border: '1px solid #f5c842', borderRadius: 12,
  },
}

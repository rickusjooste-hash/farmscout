'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState } from 'react'

interface Commodity { id: string; code: string; name: string }
interface SizeBin {
  id: string
  commodity_id: string
  label: string
  weight_min_g: number
  weight_max_g: number
  display_order: number
  is_active: boolean
}

interface EditRow extends SizeBin {
  _dirty?: boolean
  _saving?: boolean
}

type BinType = 'standard' | 'oversize' | 'undersize'

function detectType(row: SizeBin): BinType {
  if (row.weight_max_g >= 9999) return 'oversize'
  if (row.weight_min_g === 0 && row.label.toLowerCase().includes('under')) return 'undersize'
  return 'standard'
}

const TYPE_BADGE: Record<BinType, { label: string; bg: string; color: string }> = {
  standard:  { label: '',          bg: 'transparent', color: 'transparent' },
  oversize:  { label: 'Oversize',  bg: '#fff3e0',     color: '#e65100' },
  undersize: { label: 'Undersize', bg: '#e3f2fd',     color: '#1565c0' },
}

const s: Record<string, React.CSSProperties> = {
  page:      { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, sans-serif' },
  sidebar:   { width: 220, flexShrink: 0, background: '#1c3a2a', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  logo:      { fontSize: 22, color: '#a8d5a2', marginBottom: 32, letterSpacing: '-0.5px' },
  navItem:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, color: '#8aab96', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' },
  navLabel:  { fontSize: 10, color: '#5a7a6a', padding: '16px 16px 4px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  main:      { flex: 1, padding: 40, overflowY: 'auto' },
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title:     { fontSize: 28, fontWeight: 700, color: '#1c3a2a', letterSpacing: '-0.5px' },
  pills:     { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  pill:      { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:{ padding: '6px 14px', borderRadius: 20, border: '1px solid #2a6e45', background: '#2a6e45', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  card:      { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  COLS:      { gridTemplateColumns: '1fr 100px 100px 60px 60px 130px' } as React.CSSProperties,
  tableHead: { display: 'grid', gap: 8, padding: '10px 16px', background: '#f7f5f0', borderBottom: '1px solid #e8e4dc', fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase' as const, letterSpacing: '0.06em', alignItems: 'center' },
  tableRow:  { display: 'grid', gap: 8, padding: '10px 16px', borderBottom: '1px solid #f0ede6', alignItems: 'center' },
  input:     { border: '1px solid #e0ddd5', borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#1c3a2a', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' as const },
  inputDisabled: { border: '1px solid #eee', borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#aaa', fontFamily: 'inherit', width: '100%', background: '#f7f7f7', boxSizing: 'border-box' as const },
  saveBtn:   { padding: '5px 10px', borderRadius: 6, border: '1px solid #2a6e45', background: '#2a6e45', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  deleteBtn: { padding: '5px 8px', borderRadius: 6, border: '1px solid #e85a4a', background: '#fff5f4', color: '#e85a4a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  addSection:{ borderTop: '2px dashed #e8e4dc', background: '#fafaf8', padding: '14px 16px' },
  addBtn:    { padding: '6px 14px', borderRadius: 6, border: '1px solid #2a6e45', background: '#f0f7f2', color: '#2a6e45', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
  typeSeg:   { display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #d4cfca' },
  checkbox:  { width: 16, height: 16, cursor: 'pointer' },
  empty:     { padding: '40px 24px', textAlign: 'center' as const, color: '#9aaa9f', fontSize: 14 },
  badge:     { padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, marginLeft: 6, whiteSpace: 'nowrap' as const },
}

const COLS = '1fr 100px 100px 60px 60px 130px'

export default function SizeBinsPage() {
  const supabase = createClient()
  const { isSuperAdmin, contextLoaded } = useUserContext()

  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>('')
  const [rows, setRows] = useState<EditRow[]>([])
  const [loading, setLoading] = useState(true)

  // Add form state
  const [newType, setNewType]   = useState<BinType>('standard')
  const [newLabel, setNewLabel] = useState('')
  const [newMin, setNewMin]     = useState('')
  const [newMax, setNewMax]     = useState('')
  const [newOrder, setNewOrder] = useState('')
  const [adding, setAdding]     = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => { if (contextLoaded) loadCommodities() }, [contextLoaded])
  useEffect(() => { if (selectedCommodityId) loadBins() }, [selectedCommodityId])

  // When type changes, adjust min/max and default label
  function handleTypeChange(t: BinType) {
    setNewType(t)
    if (t === 'oversize')  { setNewMax('9999'); if (!newLabel || newLabel === 'Undersize') setNewLabel('Oversize') }
    if (t === 'undersize') { setNewMin('0');    if (!newLabel || newLabel === 'Oversize')  setNewLabel('Undersize') }
    if (t === 'standard')  {
      if (newLabel === 'Oversize' || newLabel === 'Undersize') setNewLabel('')
      setNewMin(''); setNewMax('')
    }
  }

  async function loadCommodities() {
    // Only show commodities that have size bins already configured (or all if none yet)
    const { data: binData } = await supabase
      .from('size_bins')
      .select('commodities(id, code, name)')
    const seen = new Set<string>()
    const list: Commodity[] = []
    for (const row of (binData || []) as any[]) {
      const c = row.commodities
      if (c && !seen.has(c.id)) { seen.add(c.id); list.push(c) }
    }
    // Fall back to all commodities if no bins exist yet
    if (list.length === 0) {
      const { data } = await supabase.from('commodities').select('id, code, name').order('name')
      list.push(...((data || []) as Commodity[]))
    }
    list.sort((a, b) => a.name.localeCompare(b.name))
    setCommodities(list)
    if (list.length > 0) setSelectedCommodityId(list[0].id)
  }

  async function loadBins() {
    setLoading(true)
    const res = await fetch(`/api/qc/settings/size-bins?commodity_id=${selectedCommodityId}`)
    const data = await res.json()
    setRows((data || []) as EditRow[])
    setLoading(false)
  }

  function updateRow(id: string, field: keyof EditRow, value: unknown) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, _dirty: true } : r))
  }

  async function saveRow(id: string) {
    const row = rows.find(r => r.id === id)
    if (!row) return
    setRows(prev => prev.map(r => r.id === id ? { ...r, _saving: true } : r))
    await fetch('/api/qc/settings/size-bins', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        label:         row.label,
        weight_min_g:  Number(row.weight_min_g),
        weight_max_g:  Number(row.weight_max_g),
        display_order: Number(row.display_order),
        is_active:     row.is_active,
      }),
    })
    setRows(prev => prev.map(r => r.id === id ? { ...r, _dirty: false, _saving: false } : r))
  }

  async function deleteRow(id: string) {
    await fetch(`/api/qc/settings/size-bins?id=${id}`, { method: 'DELETE' })
    setRows(prev => prev.filter(r => r.id !== id))
    setConfirmDeleteId(null)
  }

  async function addBin() {
    const minVal = newType === 'undersize' ? 0       : Number(newMin)
    const maxVal = newType === 'oversize'  ? 9999    : Number(newMax)
    if (!newLabel) return
    if (newType === 'standard' && (!newMin || !newMax)) return
    if (newType === 'oversize'  && !newMin) return
    if (newType === 'undersize' && !newMax) return

    setAdding(true)
    const res = await fetch('/api/qc/settings/size-bins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commodity_id:  selectedCommodityId,
        label:         newLabel,
        weight_min_g:  minVal,
        weight_max_g:  maxVal,
        display_order: newOrder ? Number(newOrder) : rows.length,
        is_active:     true,
      }),
    })
    const data = await res.json()
    if (Array.isArray(data) && data[0]) {
      setRows(prev => [...prev, data[0] as EditRow])
    }
    setNewLabel(''); setNewMin(''); setNewMax(''); setNewOrder('')
    setNewType('standard')
    setAdding(false)
  }

  // Segment button style
  function segStyle(active: boolean, color = '#2a6e45'): React.CSSProperties {
    return {
      padding: '5px 10px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
      background: active ? color : '#fff',
      color: active ? '#fff' : '#7a8a80',
      fontWeight: active ? 700 : 400,
      transition: 'all 0.12s',
    }
  }

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}><span style={{ color: '#fff' }}>Farm</span>Scout</div>
        <a href="/" style={s.navItem}><span>📊</span> Dashboard</a>
        <a href="/orchards" style={s.navItem}><span>🏡</span> Orchards</a>
        <a href="/pests" style={s.navItem}><span>🐛</span> Pests</a>
        <a href="/trap-inspections" style={s.navItem}><span>🪤</span> Trap Inspections</a>
        <a href="/heatmap" style={s.navItem}><span>🌡️</span> Heat Map</a>
        <a href="/scouts" style={s.navItem}><span>👷</span> Scouts</a>
        <a href="/settings" style={s.navItem}><span>🔔</span> Settings</a>
        {isSuperAdmin && <a href="/admin" style={s.navItem}><span>⚙️</span> Admin</a>}
        <div style={s.navLabel}>QC</div>
        <a href="/qc/dashboard" style={s.navItem}><span>⚖️</span> QC Dashboard</a>
        <a href="/qc/unknowns" style={s.navItem}><span>📷</span> Unknown Issues</a>
        <a href="/qc/settings/issues" style={s.navItem}><span>🐛</span> Issue Setup</a>
        <a href="/qc/settings/size-bins" style={{ ...s.navItem, background: '#2a4f38', color: '#a8d5a2' }}><span>📏</span> Size Bins</a>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <div style={s.header}>
          <div>
            <div style={s.title}>Size Bins</div>
            <div style={{ fontSize: 14, color: '#9aaa9f', marginTop: 4 }}>Weight ranges per commodity · Oversize = no upper limit · Undersize = no lower limit</div>
          </div>
        </div>

        {/* Commodity pills */}
        <div style={{ ...s.pills, marginBottom: 24 }}>
          {commodities.map(c => (
            <button
              key={c.id}
              style={c.id === selectedCommodityId ? s.pillActive : s.pill}
              onClick={() => setSelectedCommodityId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={s.card}>
          {/* Header row */}
          <div style={{ ...s.tableHead, gridTemplateColumns: COLS }}>
            <div>Label</div>
            <div>Min (g)</div>
            <div>Max (g)</div>
            <div>Order</div>
            <div>Active</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <div style={s.empty}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={s.empty}>No size bins configured. Add one below.</div>
          ) : (
            rows.map(row => {
              const binType = detectType(row)
              const badge   = TYPE_BADGE[binType]
              const isOver  = binType === 'oversize'
              const isUnder = binType === 'undersize'
              return (
                <div key={row.id} style={{ ...s.tableRow, gridTemplateColumns: COLS }}>
                  {/* Label + type badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      style={{ ...s.input, flex: 1 }}
                      value={row.label}
                      onChange={e => updateRow(row.id, 'label', e.target.value)}
                    />
                    {badge.label && (
                      <span style={{ ...s.badge, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    )}
                  </div>

                  {/* Min weight — disabled (shows 0) for undersize */}
                  {isUnder ? (
                    <div style={s.inputDisabled}>0</div>
                  ) : (
                    <input
                      style={s.input}
                      type="number"
                      value={row.weight_min_g}
                      onChange={e => updateRow(row.id, 'weight_min_g', e.target.value)}
                    />
                  )}

                  {/* Max weight — shows ∞ for oversize */}
                  {isOver ? (
                    <div style={s.inputDisabled}>∞</div>
                  ) : (
                    <input
                      style={s.input}
                      type="number"
                      value={row.weight_max_g}
                      onChange={e => updateRow(row.id, 'weight_max_g', e.target.value)}
                    />
                  )}

                  <input
                    style={s.input}
                    type="number"
                    value={row.display_order}
                    onChange={e => updateRow(row.id, 'display_order', e.target.value)}
                  />
                  <input
                    style={s.checkbox}
                    type="checkbox"
                    checked={row.is_active}
                    onChange={e => updateRow(row.id, 'is_active', e.target.checked)}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    {row._dirty && (
                      <button style={s.saveBtn} onClick={() => saveRow(row.id)} disabled={row._saving}>
                        {row._saving ? '…' : 'Save'}
                      </button>
                    )}
                    {confirmDeleteId === row.id ? (
                      <>
                        <button style={{ ...s.deleteBtn, fontWeight: 700 }} onClick={() => deleteRow(row.id)}>Sure?</button>
                        <button style={s.addBtn} onClick={() => setConfirmDeleteId(null)}>No</button>
                      </>
                    ) : (
                      <button style={s.deleteBtn} onClick={() => setConfirmDeleteId(row.id)}>Delete</button>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Add section */}
          <div style={s.addSection}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Add bin</div>

            {/* Type segmented control */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' as const }}>
              <div style={s.typeSeg}>
                <button style={segStyle(newType === 'standard')} onClick={() => handleTypeChange('standard')}>Standard</button>
                <button style={{ ...segStyle(newType === 'oversize', '#e65100'), borderLeft: '1px solid #d4cfca' }} onClick={() => handleTypeChange('oversize')}>Oversize ∞</button>
                <button style={{ ...segStyle(newType === 'undersize', '#1565c0'), borderLeft: '1px solid #d4cfca' }} onClick={() => handleTypeChange('undersize')}>Undersize</button>
              </div>
              {newType === 'oversize'  && <span style={{ fontSize: 12, color: '#e65100' }}>Max weight is unlimited (∞)</span>}
              {newType === 'undersize' && <span style={{ fontSize: 12, color: '#1565c0' }}>Min weight is 0 (no lower limit)</span>}
            </div>

            {/* Add form fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 70px 100px', gap: 8, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 11, color: '#9aaa9f', marginBottom: 4 }}>Label</div>
                <input
                  style={s.input}
                  placeholder={newType === 'oversize' ? 'Oversize' : newType === 'undersize' ? 'Undersize' : 'e.g. Count 72'}
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9aaa9f', marginBottom: 4 }}>Min (g)</div>
                {newType === 'undersize' ? (
                  <div style={s.inputDisabled}>0</div>
                ) : (
                  <input
                    style={s.input}
                    type="number"
                    placeholder="e.g. 185"
                    value={newMin}
                    onChange={e => setNewMin(e.target.value)}
                  />
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9aaa9f', marginBottom: 4 }}>Max (g)</div>
                {newType === 'oversize' ? (
                  <div style={s.inputDisabled}>∞</div>
                ) : (
                  <input
                    style={s.input}
                    type="number"
                    placeholder="e.g. 220"
                    value={newMax}
                    onChange={e => setNewMax(e.target.value)}
                  />
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9aaa9f', marginBottom: 4 }}>Order</div>
                <input
                  style={s.input}
                  type="number"
                  placeholder="—"
                  value={newOrder}
                  onChange={e => setNewOrder(e.target.value)}
                />
              </div>
              <button
                style={{ ...s.addBtn, alignSelf: 'end', height: 32 }}
                onClick={addBin}
                disabled={adding || !newLabel ||
                  (newType === 'standard'  && (!newMin || !newMax)) ||
                  (newType === 'oversize'  && !newMin) ||
                  (newType === 'undersize' && !newMax)
                }
              >
                {adding ? '…' : '+ Add'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'

interface Spreader {
  id: string
  name: string
  fixed_speed_kmh: number
}

interface ChartEntry {
  id?: string
  product_id: string
  width_m: number
  opening: number
  kg_per_ha: number
}

interface Product {
  id: string
  name: string
}

interface Props {
  farmId: string
  orgId: string
}

const OPENINGS = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.6, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0]
const WIDTHS = [4, 5, 6, 7, 8, 9]

export default function SpreaderSettings({ farmId, orgId }: Props) {
  const [spreaders, setSpreaders] = useState<Spreader[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [chartEntries, setChartEntries] = useState<ChartEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Selected state
  const [selectedSpreaderId, setSelectedSpreaderId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  // Add spreader form
  const [newName, setNewName] = useState('')
  const [newSpeed, setNewSpeed] = useState('7')
  const [adding, setAdding] = useState(false)

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSpeed, setEditSpeed] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [spreadersRes, productsRes] = await Promise.all([
        fetch(`/api/fertilizer/spreaders?farm_id=${farmId}`),
        fetch('/api/fertilizer/products'),
      ])
      const sp = spreadersRes.ok ? await spreadersRes.json() : []
      const pr = productsRes.ok ? await productsRes.json() : []
      setSpreaders(sp)
      setProducts(pr)

      // Extract chart entries from spreaders response
      const allEntries: ChartEntry[] = []
      for (const s of sp) {
        if (s.chart_entries) {
          for (const e of s.chart_entries) {
            allEntries.push({ ...e, product_id: e.product_id })
          }
        }
      }
      setChartEntries(allEntries)

      if (sp.length > 0 && !selectedSpreaderId) setSelectedSpreaderId(sp[0].id)
      if (pr.length > 0 && !selectedProductId) setSelectedProductId(pr[0].id)
    } catch { /* ignore */ }
    setLoading(false)
  }, [farmId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAddSpreader() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/fertilizer/spreaders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: farmId,
          organisation_id: orgId,
          name: newName.trim(),
          fixed_speed_kmh: parseFloat(newSpeed) || 7,
        }),
      })
      if (res.ok) {
        setNewName('')
        setNewSpeed('7')
        await fetchData()
      }
    } catch { /* ignore */ }
    setAdding(false)
  }

  async function handleUpdateSpreader(id: string) {
    try {
      await fetch('/api/fertilizer/spreaders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: editName.trim(),
          fixed_speed_kmh: parseFloat(editSpeed) || 7,
        }),
      })
      setEditingId(null)
      await fetchData()
    } catch { /* ignore */ }
  }

  async function handleDeleteSpreader(id: string) {
    if (!confirm('Delete this spreader and all its chart data?')) return
    try {
      await fetch('/api/fertilizer/spreaders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (selectedSpreaderId === id) setSelectedSpreaderId(null)
      await fetchData()
    } catch { /* ignore */ }
  }

  // Get chart value for current spreader/product at given width+opening
  function getChartValue(width: number, opening: number): number | null {
    if (!selectedSpreaderId || !selectedProductId) return null
    const entry = chartEntries.find(
      e => e.product_id === selectedProductId &&
        Number(e.width_m) === width &&
        Number(e.opening) === opening
    )
    return entry ? Number(entry.kg_per_ha) : null
  }

  // Pending edits: key = `${width}_${opening}`, value = kg_per_ha string
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Reset edits when product/spreader changes
  useEffect(() => { setEdits({}) }, [selectedSpreaderId, selectedProductId])

  // Count chart entries for a product on the selected spreader
  function productEntryCount(productId: string): number {
    if (!selectedSpreaderId) return 0
    return chartEntries.filter(e => e.product_id === productId).length
  }

  function getCellValue(width: number, opening: number): string {
    const key = `${width}_${opening}`
    if (key in edits) return edits[key]
    const val = getChartValue(width, opening)
    return val != null ? String(val) : ''
  }

  function setCellValue(width: number, opening: number, value: string) {
    setEdits(prev => ({ ...prev, [`${width}_${opening}`]: value }))
  }

  const hasEdits = Object.keys(edits).length > 0

  async function handleSaveChart() {
    if (!selectedSpreaderId || !selectedProductId || !hasEdits) return
    setSaving(true)
    try {
      // Build all entries (existing + edits merged)
      const entries: { width_m: number; opening: number; kg_per_ha: number }[] = []
      for (const w of WIDTHS) {
        for (const o of OPENINGS) {
          const val = getCellValue(w, o)
          const num = parseFloat(val)
          if (val && !isNaN(num) && num > 0) {
            entries.push({ width_m: w, opening: o, kg_per_ha: num })
          }
        }
      }
      if (entries.length > 0) {
        await fetch('/api/fertilizer/spreaders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'chart',
            spreader_id: selectedSpreaderId,
            product_id: selectedProductId,
            entries,
          }),
        })
      }
      setEdits({})
      await fetchData()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const activeSpreader = spreaders.find(s => s.id === selectedSpreaderId)

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6a7a70' }}>Loading spreaders...</div>
  }

  return (
    <div>
      {/* Spreader list */}
      <div style={st.card}>
        <h3 style={st.cardTitle}>Spreaders</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {spreaders.map(s => (
            <div
              key={s.id}
              style={{
                ...st.spreaderRow,
                ...(selectedSpreaderId === s.id ? st.spreaderRowActive : {}),
              }}
            >
              {editingId === s.id ? (
                <div style={{ display: 'flex', gap: 8, flex: 1, alignItems: 'center' }}>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={st.inlineInput}
                    placeholder="Name"
                  />
                  <input
                    type="number"
                    value={editSpeed}
                    onChange={e => setEditSpeed(e.target.value)}
                    style={{ ...st.inlineInput, width: 70 }}
                    placeholder="km/h"
                  />
                  <button onClick={() => handleUpdateSpreader(s.id)} style={st.saveBtn}>Save</button>
                  <button onClick={() => setEditingId(null)} style={st.cancelBtn}>Cancel</button>
                </div>
              ) : (
                <>
                  <div
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => setSelectedSpreaderId(s.id)}
                  >
                    <span style={{ fontWeight: 600, color: '#1a2a3a' }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: '#6a7a70', marginLeft: 8 }}>{s.fixed_speed_kmh} km/h</span>
                  </div>
                  <button
                    onClick={() => { setEditingId(s.id); setEditName(s.name); setEditSpeed(String(s.fixed_speed_kmh)) }}
                    style={st.editBtn}
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDeleteSpreader(s.id)} style={st.deleteBtn}>&times;</button>
                </>
              )}
            </div>
          ))}

          {/* Add spreader */}
          <div style={st.addRow}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Spreader name"
              style={st.inlineInput}
            />
            <input
              type="number"
              value={newSpeed}
              onChange={e => setNewSpeed(e.target.value)}
              placeholder="km/h"
              style={{ ...st.inlineInput, width: 70 }}
            />
            <button onClick={handleAddSpreader} disabled={adding} style={st.addBtn}>
              {adding ? '...' : '+ Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Chart data section */}
      {activeSpreader && (
        <div style={{ ...st.card, marginTop: 16 }}>
          <h3 style={st.cardTitle}>
            Spreading Chart — {activeSpreader.name}
            <span style={{ fontWeight: 400, fontSize: 13, color: '#6a7a70', marginLeft: 8 }}>
              {activeSpreader.fixed_speed_kmh} km/h
            </span>
          </h3>

          {/* Product pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {products.map(p => {
              const count = productEntryCount(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProductId(p.id)}
                  style={{
                    ...st.pill,
                    ...(selectedProductId === p.id ? st.pillActive : {}),
                  }}
                >
                  {p.name}
                  {count > 0 && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>({count})</span>}
                </button>
              )
            })}
          </div>

          {/* Chart grid: widths as columns, openings as rows — editable */}
          {selectedProductId && (
            <>
              <div style={st.tableWrap}>
                <table style={st.table}>
                  <thead>
                    <tr>
                      <th style={st.th}>Opening</th>
                      {WIDTHS.map(w => (
                        <th key={w} style={{ ...st.th, textAlign: 'center' }}>{w}m</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {OPENINGS.map((opening, idx) => (
                      <tr key={opening} style={{ background: idx % 2 === 1 ? '#f8f6f2' : '#fff' }}>
                        <td style={{ ...st.td, fontWeight: 600, color: '#1a2a3a' }}>{opening.toFixed(1)}</td>
                        {WIDTHS.map(w => {
                          const key = `${w}_${opening}`
                          const isEdited = key in edits
                          return (
                            <td key={w} style={st.td}>
                              <input
                                type="number"
                                value={getCellValue(w, opening)}
                                onChange={e => setCellValue(w, opening, e.target.value)}
                                placeholder="—"
                                style={{
                                  ...st.cellInput,
                                  ...(isEdited ? st.cellInputEdited : {}),
                                }}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#6a7a70' }}>
                  kg/ha at {activeSpreader.fixed_speed_kmh} km/h. Edit cells directly, then save.
                </div>
                {hasEdits && (
                  <button onClick={handleSaveChart} disabled={saving} style={st.chartSaveBtn}>
                    {saving ? 'Saving...' : 'Save Chart'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {spreaders.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24, color: '#6a7a70', fontSize: 14 }}>
          No spreaders added yet. Add one above to get started.
        </div>
      )}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff', borderRadius: 14, padding: '24px 28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontSize: 16, fontWeight: 700, color: '#1a2a3a', margin: '0 0 16px',
  },
  spreaderRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', borderRadius: 8, border: '1px solid #e8e4dc',
    transition: 'all 0.15s',
  },
  spreaderRowActive: {
    border: '1px solid #2176d9', background: '#f0f5ff',
  },
  addRow: {
    display: 'flex', gap: 8, alignItems: 'center',
    padding: '10px 14px', borderRadius: 8, border: '1px dashed #d4cfca',
    background: '#f8f6f2',
  },
  inlineInput: {
    flex: 1, padding: '6px 10px', border: '1px solid #d4cfca', borderRadius: 6,
    fontSize: 13, color: '#1a2a3a', outline: 'none', fontFamily: 'Inter, sans-serif',
  },
  addBtn: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid #4caf72',
    background: '#4caf72', color: '#fff', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
  },
  saveBtn: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid #2176d9',
    background: '#2176d9', color: '#fff', fontSize: 12, fontWeight: 500,
    cursor: 'pointer',
  },
  editBtn: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid #d4cfca',
    background: '#fff', color: '#1a2a3a', fontSize: 12, fontWeight: 500,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid #d4cfca',
    background: '#fff', color: '#6a7a70', fontSize: 12, fontWeight: 500,
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '4px 8px', borderRadius: 6, border: '1px solid #d4cfca',
    background: '#fff', color: '#e85a4a', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', lineHeight: 1,
  },
  pill: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca',
    background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'all 0.15s',
  },
  pillActive: {
    border: '1px solid #2176d9', background: '#2176d9', color: '#fff',
  },
  tableWrap: {
    border: '1px solid #e8e4dc', borderRadius: 12, background: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto',
  },
  table: {
    width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse',
    fontFamily: 'Inter, sans-serif', fontSize: 13,
  },
  th: {
    textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#6a7a70',
    fontSize: 11, borderBottom: '2px solid #e8e4dc', background: '#f5f3ee',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '2px 2px', borderBottom: '1px solid #f0ede6', fontSize: 13,
  },
  cellInput: {
    width: '100%', boxSizing: 'border-box' as const, border: '1px solid transparent',
    borderRadius: 4, padding: '4px 4px', fontSize: 13, color: '#1a2a3a',
    textAlign: 'center' as const, fontVariantNumeric: 'tabular-nums',
    fontFamily: 'Inter, sans-serif', background: 'transparent', outline: 'none',
  },
  cellInputEdited: {
    border: '1px solid #f5c842', background: '#fef9ee',
  },
  chartSaveBtn: {
    padding: '8px 20px', borderRadius: 8, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
}

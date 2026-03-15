'use client'

import { useCallback, useEffect, useState } from 'react'

interface Product {
  id: string
  name: string
  registration_no: string | null
  n_pct: number
  p_pct: number
  k_pct: number
  ca_pct: number
  mg_pct: number
  s_pct: number
  default_unit: string
  bag_weight_kg: number | null
}

interface EditRow extends Product {
  _dirty?: boolean
  _saving?: boolean
  _error?: string
}

interface Props {
  orgId: string
}

const UNIT_OPTIONS = ['kg/ha', 'L/ha', 'g/tree', 'mL/tree']
const NUM_FIELDS = ['n_pct', 'p_pct', 'k_pct', 'ca_pct', 'mg_pct', 's_pct'] as const

const EMPTY_NEW: Omit<Product, 'id'> = {
  name: '', registration_no: null,
  n_pct: 0, p_pct: 0, k_pct: 0, ca_pct: 0, mg_pct: 0, s_pct: 0,
  default_unit: 'kg/ha', bag_weight_kg: null,
}

export default function ProductSettings({ orgId }: Props) {
  const [rows, setRows] = useState<EditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newRow, setNewRow] = useState<Omit<Product, 'id'>>(EMPTY_NEW)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/fertilizer/products')
      const data = res.ok ? await res.json() : []
      setRows(data.map((r: Product) => ({ ...r })))
    } catch { setRows([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  function updateField(id: string, field: string, value: string | number | null) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      return { ...r, [field]: value, _dirty: true, _error: undefined }
    }))
  }

  async function saveRow(id: string) {
    const row = rows.find(r => r.id === id)
    if (!row) return
    setRows(prev => prev.map(r => r.id === id ? { ...r, _saving: true, _error: undefined } : r))

    try {
      const res = await fetch('/api/fertilizer/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          name: row.name,
          registration_no: row.registration_no,
          n_pct: row.n_pct, p_pct: row.p_pct, k_pct: row.k_pct,
          ca_pct: row.ca_pct, mg_pct: row.mg_pct, s_pct: row.s_pct,
          default_unit: row.default_unit,
          bag_weight_kg: row.bag_weight_kg,
        }),
      })
      if (res.ok) {
        setRows(prev => prev.map(r => r.id === id ? { ...r, _dirty: false, _saving: false } : r))
      } else {
        const err = await res.json()
        setRows(prev => prev.map(r => r.id === id ? { ...r, _saving: false, _error: err.error || 'Save failed' } : r))
      }
    } catch {
      setRows(prev => prev.map(r => r.id === id ? { ...r, _saving: false, _error: 'Network error' } : r))
    }
  }

  async function deleteRow(id: string) {
    const row = rows.find(r => r.id === id)
    if (!row || !confirm(`Delete "${row.name}"?`)) return

    try {
      const res = await fetch('/api/fertilizer/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setRows(prev => prev.filter(r => r.id !== id))
      } else {
        const err = await res.json()
        setRows(prev => prev.map(r => r.id === id ? { ...r, _error: err.error || 'Delete failed' } : r))
      }
    } catch {
      setRows(prev => prev.map(r => r.id === id ? { ...r, _error: 'Network error' } : r))
    }
  }

  async function addProduct() {
    if (!newRow.name.trim()) { setAddError('Name is required'); return }
    setAdding(true)
    setAddError('')

    try {
      const res = await fetch('/api/fertilizer/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow),
      })
      if (res.ok) {
        const created = await res.json()
        setRows(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setNewRow({ ...EMPTY_NEW })
      } else {
        const err = await res.json()
        setAddError(err.error || 'Add failed')
      }
    } catch { setAddError('Network error') }
    finally { setAdding(false) }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6a7a70' }}>Loading products...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 13, color: '#6a7a70' }}>
        Set nutrient composition for each product. These values are used in NPK calculations across the dashboard.
      </div>

      <div style={st.tableWrap}>
        <table style={st.table}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={st.th}>Product Name</th>
              <th style={st.th}>Reg No</th>
              <th style={{ ...st.th, textAlign: 'center' }}>N%</th>
              <th style={{ ...st.th, textAlign: 'center' }}>P%</th>
              <th style={{ ...st.th, textAlign: 'center' }}>K%</th>
              <th style={{ ...st.th, textAlign: 'center' }}>Ca%</th>
              <th style={{ ...st.th, textAlign: 'center' }}>Mg%</th>
              <th style={{ ...st.th, textAlign: 'center' }}>S%</th>
              <th style={st.th}>Unit</th>
              <th style={{ ...st.th, textAlign: 'center' }}>Bag kg</th>
              <th style={{ ...st.th, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const stripe = idx % 2 === 1
              return (
                <tr key={row.id} style={{ background: stripe ? '#f8f6f2' : '#fff' }}>
                  <td style={st.td}>
                    <input
                      value={row.name}
                      onChange={e => updateField(row.id, 'name', e.target.value)}
                      style={st.input}
                    />
                  </td>
                  <td style={st.td}>
                    <input
                      value={row.registration_no || ''}
                      onChange={e => updateField(row.id, 'registration_no', e.target.value || null)}
                      style={st.input}
                    />
                  </td>
                  {NUM_FIELDS.map(f => (
                    <td key={f} style={st.td}>
                      <input
                        type="number"
                        step="0.1"
                        value={row[f] != null && row[f] !== 0 ? row[f] : ''}
                        placeholder="0"
                        onChange={e => updateField(row.id, f, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        style={st.numInput}
                      />
                    </td>
                  ))}
                  <td style={st.td}>
                    <select
                      value={row.default_unit}
                      onChange={e => updateField(row.id, 'default_unit', e.target.value)}
                      style={st.select}
                    >
                      {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td style={st.td}>
                    <input
                      type="number"
                      step="1"
                      value={row.bag_weight_kg != null && row.bag_weight_kg !== 0 ? row.bag_weight_kg : ''}
                      placeholder="-"
                      onChange={e => updateField(row.id, 'bag_weight_kg', e.target.value === '' ? null : parseFloat(e.target.value))}
                      style={st.numInput}
                    />
                  </td>
                  <td style={{ ...st.td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {row._dirty && (
                        <button
                          onClick={() => saveRow(row.id)}
                          disabled={row._saving}
                          style={st.saveBtn}
                        >
                          {row._saving ? '...' : 'Save'}
                        </button>
                      )}
                      <button onClick={() => deleteRow(row.id)} style={st.deleteBtn} title="Delete">
                        &times;
                      </button>
                    </div>
                    {row._error && (
                      <div style={{ fontSize: 11, color: '#e85a4a', marginTop: 2 }}>{row._error}</div>
                    )}
                  </td>
                </tr>
              )
            })}

            {/* Add new product row */}
            <tr style={{ background: '#f0f7ff' }}>
              <td style={st.td}>
                <input
                  value={newRow.name}
                  onChange={e => { setNewRow(prev => ({ ...prev, name: e.target.value })); setAddError('') }}
                  placeholder="New product name"
                  style={st.input}
                />
              </td>
              <td style={st.td}>
                <input
                  value={newRow.registration_no || ''}
                  onChange={e => setNewRow(prev => ({ ...prev, registration_no: e.target.value || null }))}
                  style={st.input}
                />
              </td>
              {NUM_FIELDS.map(f => (
                <td key={f} style={st.td}>
                  <input
                    type="number"
                    step="0.1"
                    value={newRow[f] != null && newRow[f] !== 0 ? newRow[f] : ''}
                    placeholder="0"
                    onChange={e => setNewRow(prev => ({ ...prev, [f]: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                    style={st.numInput}
                  />
                </td>
              ))}
              <td style={st.td}>
                <select
                  value={newRow.default_unit}
                  onChange={e => setNewRow(prev => ({ ...prev, default_unit: e.target.value }))}
                  style={st.select}
                >
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </td>
              <td style={st.td}>
                <input
                  type="number"
                  step="1"
                  value={newRow.bag_weight_kg != null && newRow.bag_weight_kg !== 0 ? newRow.bag_weight_kg : ''}
                  placeholder="-"
                  onChange={e => setNewRow(prev => ({ ...prev, bag_weight_kg: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                  style={st.numInput}
                />
              </td>
              <td style={{ ...st.td, textAlign: 'center' }}>
                <button onClick={addProduct} disabled={adding} style={st.addBtn}>
                  {adding ? '...' : '+ Add'}
                </button>
                {addError && (
                  <div style={{ fontSize: 11, color: '#e85a4a', marginTop: 2 }}>{addError}</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#6a7a70', fontSize: 13 }}>
          No products yet. Add one above or import from Excel.
        </div>
      )}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  tableWrap: {
    border: '1px solid #e8e4dc', borderRadius: 12, background: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto',
  },
  table: {
    width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 13,
  },
  th: {
    textAlign: 'left', padding: '8px 8px', fontWeight: 600, color: '#6a7a70',
    fontSize: 11, borderBottom: '2px solid #e8e4dc', background: '#f5f3ee',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '5px 6px', borderBottom: '1px solid #f0ede6',
  },
  input: {
    width: '100%', border: '1px solid #e0ddd5', borderRadius: 6,
    padding: '5px 8px', fontSize: 13, color: '#1a2a3a',
    fontFamily: 'inherit', background: 'transparent', outline: 'none',
  },
  numInput: {
    width: '100%', boxSizing: 'border-box', border: '1px solid #e0ddd5', borderRadius: 6,
    padding: '5px 4px', fontSize: 13, color: '#1a2a3a', textAlign: 'center',
    fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
    background: 'transparent', outline: 'none',
  },
  select: {
    border: '1px solid #e0ddd5', borderRadius: 6,
    padding: '5px 6px', fontSize: 12, color: '#1a2a3a',
    fontFamily: 'inherit', background: 'transparent', outline: 'none',
  },
  saveBtn: {
    padding: '3px 10px', borderRadius: 6, border: '1px solid #2176d9',
    background: '#2176d9', color: '#fff', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  deleteBtn: {
    padding: '3px 8px', borderRadius: 6, border: '1px solid #d4cfca',
    background: '#fff', color: '#e85a4a', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
  },
  addBtn: {
    padding: '3px 10px', borderRadius: 6, border: '1px solid #4caf72',
    background: '#4caf72', color: '#fff', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
}

'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'

// ── Types ──────────────────────────────────────────────────────────────────

interface Packhouse { id: string; code: string; name: string }
interface BoxType { id: string; code: string; name: string; cartons_per_pallet: number }
interface Size { id: string; label: string; sort_order: number }
interface ValidCombo { box_type_id: string; size_id: string }
interface SessionRef { id: string; seq: number; orchard_id: string | null; variety: string | null; orchard_name: string }

export default function FloorStockPage() {
  const supabase = createClient()
  const { isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [packhouses, setPackhouses] = useState<Packhouse[]>([])
  const [boxTypes, setBoxTypes] = useState<BoxType[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [validCombos, setValidCombos] = useState<ValidCombo[]>([])
  const [stockCells, setStockCells] = useState<Map<string, number>>(new Map())
  const [editCells, setEditCells] = useState<Map<string, number>>(new Map())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [selectedPackhouse, setSelectedPackhouse] = useState('')
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0])
  const [daySessions, setDaySessions] = useState<SessionRef[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [stockType, setStockType] = useState<'opening' | 'closing'>('closing')

  // ── Load reference data ──────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    loadReferenceData()
  }, [contextLoaded])

  useEffect(() => {
    if (selectedPackhouse && stockDate) loadSessions()
  }, [selectedPackhouse, stockDate])

  useEffect(() => {
    if (selectedSessionId) loadStockData()
  }, [selectedSessionId, stockType])

  async function loadReferenceData() {
    const [phRes, btRes, szRes, comboRes] = await Promise.all([
      supabase.from('packhouses').select('id,code,name').eq('is_active', true).order('code'),
      supabase.from('packout_box_types').select('id,code,name,cartons_per_pallet').eq('is_active', true).order('code'),
      supabase.from('packout_sizes').select('id,label,sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('packout_box_type_sizes').select('box_type_id,size_id').eq('is_active', true),
    ])
    setPackhouses(phRes.data || [])
    setBoxTypes(btRes.data || [])
    setSizes(szRes.data || [])
    setValidCombos(comboRes.data || [])
    if (phRes.data?.length && !selectedPackhouse) setSelectedPackhouse(phRes.data[0].id)
    setLoading(false)
  }

  async function loadSessions() {
    const { data: sessData } = await supabase
      .from('packout_daily_sessions')
      .select('id,seq,orchard_id,variety,orchards(name)')
      .eq('packhouse_id', selectedPackhouse)
      .eq('pack_date', stockDate)
      .order('seq')

    const refs: SessionRef[] = (sessData || []).map((s: any) => ({
      id: s.id,
      seq: s.seq,
      orchard_id: s.orchard_id,
      variety: s.variety,
      orchard_name: s.orchards?.name || 'Unknown',
    }))
    setDaySessions(refs)
    if (refs.length > 0 && !refs.find(r => r.id === selectedSessionId)) {
      setSelectedSessionId(refs[refs.length - 1].id) // Default to last session
    }
  }

  async function loadStockData() {
    setLoading(true)
    const { data } = await supabase
      .from('packout_floor_stock')
      .select('box_type_id,size_id,carton_count')
      .eq('session_id', selectedSessionId)
      .eq('stock_type', stockType)

    const cells = new Map<string, number>()
    for (const row of (data || [])) {
      cells.set(`${row.box_type_id}_${row.size_id}`, row.carton_count)
    }
    setStockCells(cells)
    setEditCells(new Map(cells))
    setDirty(false)
    setLoading(false)
  }

  // ── Grid logic ──────────────────────────────────────────────────────

  const validSet = useMemo(() => {
    const s = new Set<string>()
    for (const c of validCombos) s.add(`${c.box_type_id}_${c.size_id}`)
    return s
  }, [validCombos])

  const activeSizes = useMemo(() => {
    const sizeIds = new Set(validCombos.map(c => c.size_id))
    return sizes.filter(s => sizeIds.has(s.id))
  }, [sizes, validCombos])

  const activeBoxTypes = useMemo(() => {
    const btIds = new Set(validCombos.map(c => c.box_type_id))
    return boxTypes.filter(bt => btIds.has(bt.id))
  }, [boxTypes, validCombos])

  function cellKey(btId: string, szId: string) { return `${btId}_${szId}` }

  function getCellValue(btId: string, szId: string): number {
    return editCells.get(cellKey(btId, szId)) || 0
  }

  function setCellValue(btId: string, szId: string, val: number) {
    setEditCells(prev => {
      const next = new Map(prev)
      next.set(cellKey(btId, szId), val)
      return next
    })
    setDirty(true)
  }

  function rowTotal(btId: string): number {
    return activeSizes.reduce((sum, sz) => {
      if (!validSet.has(cellKey(btId, sz.id))) return sum
      return sum + getCellValue(btId, sz.id)
    }, 0)
  }

  function colTotal(szId: string): number {
    return activeBoxTypes.reduce((sum, bt) => {
      if (!validSet.has(cellKey(bt.id, szId))) return sum
      return sum + getCellValue(bt.id, szId)
    }, 0)
  }

  const grandTotal = useMemo(() => {
    let total = 0
    for (const [key, val] of editCells) {
      if (validSet.has(key)) total += val
    }
    return total
  }, [editCells, validSet])

  // ── Copy from yesterday ─────────────────────────────────────────────

  async function copyFromPreviousClosing() {
    const session = daySessions.find(s => s.id === selectedSessionId)
    if (!session?.variety) {
      alert('No variety set for this session')
      return
    }

    // Find most recent closing stock for same variety (any date)
    const { data: prevSess } = await supabase
      .from('packout_daily_sessions')
      .select('id')
      .eq('packhouse_id', selectedPackhouse)
      .eq('variety', session.variety)
      .neq('id', selectedSessionId)
      .order('pack_date', { ascending: false })
      .order('seq', { ascending: false })
      .limit(1)

    if (!prevSess?.length) {
      alert(`No previous closing stock found for ${session.variety}`)
      return
    }

    const { data } = await supabase
      .from('packout_floor_stock')
      .select('box_type_id,size_id,carton_count')
      .eq('session_id', prevSess[0].id)
      .eq('stock_type', 'closing')

    if (!data || data.length === 0) {
      alert(`No closing stock found for previous ${session.variety} session`)
      return
    }

    const cells = new Map<string, number>()
    for (const row of data) {
      cells.set(cellKey(row.box_type_id, row.size_id), row.carton_count)
    }
    setEditCells(cells)
    setDirty(true)
  }

  // ── Save ────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)

    const { data: phData } = await supabase.from('packhouses').select('organisation_id').eq('id', selectedPackhouse).single()
    const orgId = phData?.organisation_id
    if (!orgId) { setSaving(false); return }

    // Delete existing rows for this session + stock_type, then insert fresh
    await supabase
      .from('packout_floor_stock')
      .delete()
      .eq('session_id', selectedSessionId)
      .eq('stock_type', stockType)

    const rows: any[] = []
    for (const bt of activeBoxTypes) {
      for (const sz of activeSizes) {
        const key = cellKey(bt.id, sz.id)
        if (!validSet.has(key)) continue
        const val = editCells.get(key) || 0
        if (val === 0) continue
        rows.push({
          organisation_id: orgId,
          packhouse_id: selectedPackhouse,
          stock_date: stockDate,
          session_id: selectedSessionId,
          stock_type: stockType,
          box_type_id: bt.id,
          size_id: sz.id,
          carton_count: val,
        })
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from('packout_floor_stock')
        .insert(rows)

      if (error) {
        console.error('Save error:', error)
        alert('Save failed: ' + error.message)
      } else {
        setDirty(false)
        await loadStockData()
      }
    }
    setSaving(false)
  }

  // ── Render ──────────────────────────────────────────────────────────

  if (!contextLoaded) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={{ flex: 1, padding: '32px 40px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a2a3a', margin: 0 }}>Floor Stock</h1>
            <p style={{ fontSize: 13, color: '#8a95a0', margin: '4px 0 0' }}>
              Count partial pallets on the floor per session (orchard run)
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select style={s.select} value={selectedPackhouse} onChange={e => setSelectedPackhouse(e.target.value)}>
              {packhouses.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <input type="date" style={s.select} value={stockDate} onChange={e => setStockDate(e.target.value)} />

            {daySessions.length > 0 && (
              <select style={s.select} value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}>
                {daySessions.map(sess => (
                  <option key={sess.id} value={sess.id}>
                    #{sess.seq} {sess.orchard_name} ({sess.variety || '?'})
                  </option>
                ))}
              </select>
            )}

            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #d4d8de' }}>
              <button
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: stockType === 'opening' ? 700 : 400, background: stockType === 'opening' ? '#2176d9' : '#fff', color: stockType === 'opening' ? '#fff' : '#5a6a60', border: 'none', cursor: 'pointer' }}
                onClick={() => setStockType('opening')}
              >Opening</button>
              <button
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: stockType === 'closing' ? 700 : 400, background: stockType === 'closing' ? '#2176d9' : '#fff', color: stockType === 'closing' ? '#fff' : '#5a6a60', border: 'none', cursor: 'pointer', borderLeft: '1px solid #d4d8de' }}
                onClick={() => setStockType('closing')}
              >Closing</button>
            </div>

            <button style={s.btnSecondary} onClick={copyFromPreviousClosing}>
              Copy Prev Closing
            </button>

            <button
              style={{ ...s.btnPrimary, opacity: dirty ? 1 : 0.5 }}
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading...</div>
        ) : activeBoxTypes.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>
            No box types configured. Run the Paltrack sync to auto-derive box types and sizes.
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  <th style={s.th}>Box Type</th>
                  {activeSizes.map(sz => (
                    <th key={sz.id} style={{ ...s.th, textAlign: 'center', minWidth: 60 }}>{sz.label}</th>
                  ))}
                  <th style={{ ...s.th, textAlign: 'center', background: '#eef2f7' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {activeBoxTypes.map(bt => (
                  <tr key={bt.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ ...s.td, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {bt.code}
                      <span style={{ fontWeight: 400, color: '#8a95a0', fontSize: 11, marginLeft: 6 }}>
                        ({bt.cartons_per_pallet}/plt)
                      </span>
                    </td>
                    {activeSizes.map(sz => {
                      const key = cellKey(bt.id, sz.id)
                      const isValid = validSet.has(key)
                      if (!isValid) return <td key={sz.id} style={{ ...s.td, background: '#f8f8f8' }} />
                      const val = getCellValue(bt.id, sz.id)
                      return (
                        <td key={sz.id} style={s.td}>
                          <input
                            type="number" min={0} style={s.cellInput}
                            value={val || ''}
                            onChange={e => setCellValue(bt.id, sz.id, parseInt(e.target.value) || 0)}
                            onFocus={e => e.target.select()}
                          />
                        </td>
                      )
                    })}
                    <td style={{ ...s.td, textAlign: 'center', fontWeight: 700, background: '#eef2f7' }}>
                      {rowTotal(bt.id) || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#eef2f7', fontWeight: 700 }}>
                  <td style={s.td}>Total</td>
                  {activeSizes.map(sz => (
                    <td key={sz.id} style={{ ...s.td, textAlign: 'center' }}>{colTotal(sz.id) || ''}</td>
                  ))}
                  <td style={{ ...s.td, textAlign: 'center', fontSize: 15 }}>{grandTotal || 0}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  select: { padding: '8px 12px', borderRadius: 8, border: '1px solid #d4d8de', fontSize: 13, background: '#fff' },
  btnPrimary: { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2176d9', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '8px 16px', borderRadius: 8, border: '1px solid #d4d8de', background: '#fff', color: '#1a2a3a', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  th: { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '2px solid #e5e7eb' },
  td: { padding: '6px 8px', fontSize: 13 },
  cellInput: { width: 56, padding: '6px 4px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, textAlign: 'center' as const, outline: 'none', background: '#fafbfc' },
}

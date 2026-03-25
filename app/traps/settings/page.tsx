'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import { useEffect, useState } from 'react'

interface TrapType { id: string; name: string; is_active: boolean }
interface LureType { id: string; name: string; pest_id: string | null; rebait_weeks: number | null; description: string | null; is_active: boolean }
interface Pest { id: string; name: string }
interface Combination { id: string; trap_type_id: string; lure_type_id: string | null; is_default: boolean }

const s: Record<string, React.CSSProperties> = {
  page:      { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, sans-serif' },
  main:      { flex: 1, padding: 40, overflowY: 'auto' as const },
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title:     { fontSize: 28, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px' },
  card:      { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  cardTitle: { padding: '16px 20px', borderBottom: '1px solid #e8e4dc', fontSize: 16, fontWeight: 700, color: '#1a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  tableHead: { display: 'grid', gap: 8, padding: '10px 16px', background: '#f7f5f0', borderBottom: '1px solid #e8e4dc', fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', alignItems: 'center' },
  tableRow:  { display: 'grid', gap: 8, padding: '10px 16px', borderBottom: '1px solid #eef2fa', alignItems: 'center' },
  input:     { border: '1px solid #e0ddd5', borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#1a2a3a', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' as const },
  select:    { border: '1px solid #e0ddd5', borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#1a2a3a', fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' as const, background: '#fff' },
  addSection:{ borderTop: '2px dashed #e8e4dc', background: '#fafaf8', padding: '14px 16px' },
  addBtn:    { padding: '6px 14px', borderRadius: 6, border: '1px solid #2176d9', background: '#f0f4fa', color: '#2176d9', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
  saveBtn:   { padding: '5px 10px', borderRadius: 6, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '5px 10px', borderRadius: 6, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  deleteBtn: { padding: '5px 8px', borderRadius: 6, border: '1px solid #e85a4a', background: '#fff5f4', color: '#e85a4a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  toggleOn:  { width: 36, height: 20, borderRadius: 10, background: '#4caf72', border: 'none', cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s' },
  toggleOff: { width: 36, height: 20, borderRadius: 10, background: '#ccc', border: 'none', cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s' },
  toggleDot: { width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute' as const, top: 2, transition: 'left 0.2s' },
  empty:     { padding: '24px 16px', textAlign: 'center' as const, color: '#8a95a0', fontSize: 14 },
  comboGroup:{ padding: '12px 16px', borderBottom: '1px solid #eef2fa' },
  comboHead: { fontSize: 14, fontWeight: 600, color: '#1a2a3a', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  comboRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 13, color: '#3a4a40' },
  chip:      { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 16, background: '#f0f4fa', border: '1px solid #d0d8e8', fontSize: 12, color: '#2a4a6a' },
  defaultBadge: { fontSize: 10, fontWeight: 700, color: '#2176d9', textTransform: 'uppercase' as const },
  error:     { background: '#fdf0ee', color: '#c62828', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 },
}

async function apiCall(body: Record<string, any>): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const res = await fetch('/api/traps/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      style={on ? s.toggleOn : s.toggleOff}
      onClick={onToggle}
      disabled={disabled}
      title={on ? 'Active' : 'Inactive'}
    >
      <span style={{ ...s.toggleDot, left: on ? 18 : 2 }} />
    </button>
  )
}

export default function TrapSettingsPage() {
  const supabase = createClient()
  const { isSuperAdmin, contextLoaded, allowed, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [trapTypes, setTrapTypes] = useState<TrapType[]>([])
  const [lureTypes, setLureTypes] = useState<LureType[]>([])
  const [pests, setPests] = useState<Pest[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Trap type form state
  const [editingTrapTypeId, setEditingTrapTypeId] = useState<string | null>(null)
  const [editTrapTypeName, setEditTrapTypeName] = useState('')
  const [newTrapTypeName, setNewTrapTypeName] = useState('')
  const [addingTrapType, setAddingTrapType] = useState(false)

  // Lure type form state
  const [editingLureTypeId, setEditingLureTypeId] = useState<string | null>(null)
  const [editLureForm, setEditLureForm] = useState({ name: '', pestId: '', rebaitWeeks: '', description: '' })
  const [newLureForm, setNewLureForm] = useState({ name: '', pestId: '', rebaitWeeks: '', description: '' })
  const [addingLureType, setAddingLureType] = useState(false)

  // Combo add state
  const [addComboTrapTypeId, setAddComboTrapTypeId] = useState<string | null>(null)
  const [addComboLureTypeId, setAddComboLureTypeId] = useState<string>('')

  useEffect(() => {
    if (contextLoaded) loadAll()
  }, [contextLoaded])

  async function loadAll() {
    setLoading(true)
    const [
      { data: ttData },
      { data: ltData },
      { data: pestData },
      { data: comboData },
    ] = await Promise.all([
      supabase.from('trap_types').select('id,name,is_active').order('name'),
      supabase.from('lure_types').select('id,name,pest_id,rebait_weeks,description,is_active').order('name'),
      supabase.from('pests').select('id,name').order('name'),
      supabase.from('trap_type_lure_types').select('id,trap_type_id,lure_type_id,is_default').order('created_at'),
    ])
    setTrapTypes((ttData || []) as TrapType[])
    setLureTypes((ltData || []) as LureType[])
    setPests((pestData || []) as Pest[])
    setCombinations((comboData || []) as Combination[])
    setLoading(false)
  }

  function pestName(id: string | null): string {
    if (!id) return '-'
    return pests.find(p => p.id === id)?.name || '-'
  }

  function lureName(id: string | null): string {
    if (!id) return 'No lure (visual only)'
    return lureTypes.find(l => l.id === id)?.name || '-'
  }

  function trapTypeName(id: string): string {
    return trapTypes.find(t => t.id === id)?.name || '-'
  }

  // ── Trap Type CRUD ───────────────────────────────────────────────────

  async function handleAddTrapType() {
    if (!newTrapTypeName.trim()) return
    setAddingTrapType(true)
    setError('')
    const res = await apiCall({ type: 'create-trap-type', name: newTrapTypeName })
    if (res.error) { setError(res.error); setAddingTrapType(false); return }
    setNewTrapTypeName('')
    setAddingTrapType(false)
    loadAll()
  }

  async function handleUpdateTrapType(id: string) {
    if (!editTrapTypeName.trim()) return
    setError('')
    const res = await apiCall({ type: 'update-trap-type', id, name: editTrapTypeName })
    if (res.error) { setError(res.error); return }
    setEditingTrapTypeId(null)
    loadAll()
  }

  async function handleToggleTrapType(id: string, current: boolean) {
    setError('')
    const res = await apiCall({ type: 'toggle-trap-type', id, isActive: !current })
    if (res.error) { setError(res.error); return }
    setTrapTypes(prev => prev.map(t => t.id === id ? { ...t, is_active: !current } : t))
  }

  // ── Lure Type CRUD ───────────────────────────────────────────────────

  async function handleAddLureType() {
    if (!newLureForm.name.trim()) return
    setAddingLureType(true)
    setError('')
    const res = await apiCall({
      type: 'create-lure-type',
      name: newLureForm.name,
      pestId: newLureForm.pestId || null,
      rebaitWeeks: newLureForm.rebaitWeeks ? Number(newLureForm.rebaitWeeks) : null,
      description: newLureForm.description || null,
    })
    if (res.error) { setError(res.error); setAddingLureType(false); return }
    setNewLureForm({ name: '', pestId: '', rebaitWeeks: '', description: '' })
    setAddingLureType(false)
    loadAll()
  }

  async function handleUpdateLureType(id: string) {
    if (!editLureForm.name.trim()) return
    setError('')
    const res = await apiCall({
      type: 'update-lure-type',
      id,
      name: editLureForm.name,
      pestId: editLureForm.pestId || null,
      rebaitWeeks: editLureForm.rebaitWeeks ? Number(editLureForm.rebaitWeeks) : null,
      description: editLureForm.description || null,
    })
    if (res.error) { setError(res.error); return }
    setEditingLureTypeId(null)
    loadAll()
  }

  async function handleToggleLureType(id: string, current: boolean) {
    setError('')
    const res = await apiCall({ type: 'toggle-lure-type', id, isActive: !current })
    if (res.error) { setError(res.error); return }
    setLureTypes(prev => prev.map(l => l.id === id ? { ...l, is_active: !current } : l))
  }

  // ── Combination CRUD ─────────────────────────────────────────────────

  async function handleAddCombination(trapTypeId: string) {
    setError('')
    const lureId = addComboLureTypeId === '__none__' ? null : addComboLureTypeId
    if (!addComboLureTypeId) return
    const res = await apiCall({ type: 'add-combination', trapTypeId, lureTypeId: lureId, isDefault: false })
    if (res.error) { setError(res.error); return }
    setAddComboTrapTypeId(null)
    setAddComboLureTypeId('')
    loadAll()
  }

  async function handleRemoveCombination(id: string) {
    setError('')
    const res = await apiCall({ type: 'remove-combination', id })
    if (res.error) { setError(res.error); return }
    setCombinations(prev => prev.filter(c => c.id !== id))
  }

  async function handleSetDefault(id: string, trapTypeId: string) {
    setError('')
    const res = await apiCall({ type: 'set-default', id, trapTypeId })
    if (res.error) { setError(res.error); return }
    setCombinations(prev => prev.map(c =>
      c.trap_type_id === trapTypeId ? { ...c, is_default: c.id === id } : c
    ))
  }

  if (!allowed) return null

  return (
    <div style={s.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} onLogout={async () => { await supabase.auth.signOut(); window.location.href = '/login' }} />
      <main style={s.main}>
        <MobileNav />
        <div style={s.header}>
          <h1 style={s.title}>Trap Setup</h1>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {loading ? (
          <div style={s.empty}>Loading...</div>
        ) : (
          <>
            {/* ── Card 1: Trap Types ─────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.cardTitle}>
                Trap Types
              </div>
              <div style={{ ...s.tableHead, gridTemplateColumns: '1fr 60px' }}>
                <span>Name</span>
                <span style={{ textAlign: 'center' }}>Active</span>
              </div>
              {trapTypes.map(tt => (
                <div key={tt.id} style={{ ...s.tableRow, gridTemplateColumns: '1fr 60px' }}>
                  {editingTrapTypeId === tt.id ? (
                    <>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input style={s.input} value={editTrapTypeName} onChange={e => setEditTrapTypeName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdateTrapType(tt.id)} />
                        <button style={s.saveBtn} onClick={() => handleUpdateTrapType(tt.id)}>Save</button>
                        <button style={s.cancelBtn} onClick={() => setEditingTrapTypeId(null)}>Cancel</button>
                      </div>
                      <div />
                    </>
                  ) : (
                    <>
                      <span
                        style={{ cursor: isSuperAdmin ? 'pointer' : 'default', fontSize: 13, color: tt.is_active ? '#1a2a3a' : '#aaa' }}
                        onClick={() => { if (isSuperAdmin) { setEditingTrapTypeId(tt.id); setEditTrapTypeName(tt.name) } }}
                        title={isSuperAdmin ? 'Click to edit' : ''}
                      >
                        {tt.name}
                      </span>
                      <div style={{ textAlign: 'center' }}>
                        {isSuperAdmin ? (
                          <Toggle on={tt.is_active} onToggle={() => handleToggleTrapType(tt.id, tt.is_active)} />
                        ) : (
                          <span style={{ fontSize: 12, color: tt.is_active ? '#4caf72' : '#aaa' }}>{tt.is_active ? 'Yes' : 'No'}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {trapTypes.length === 0 && <div style={s.empty}>No trap types configured</div>}
              {isSuperAdmin && (
                <div style={{ ...s.addSection, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...s.input, maxWidth: 260 }}
                    placeholder="New trap type name..."
                    value={newTrapTypeName}
                    onChange={e => setNewTrapTypeName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTrapType()}
                  />
                  <button style={s.addBtn} onClick={handleAddTrapType} disabled={addingTrapType}>
                    {addingTrapType ? 'Adding...' : 'Add'}
                  </button>
                </div>
              )}
            </div>

            {/* ── Card 2: Lure Types ─────────────────────────────────── */}
            <div style={s.card}>
              <div style={s.cardTitle}>
                Lure Types
              </div>
              <div style={{ ...s.tableHead, gridTemplateColumns: '1fr 160px 80px 60px' }}>
                <span>Name</span>
                <span>Target Pest</span>
                <span style={{ textAlign: 'center' }}>Rebait (wk)</span>
                <span style={{ textAlign: 'center' }}>Active</span>
              </div>
              {lureTypes.map(lt => (
                <div key={lt.id}>
                  {editingLureTypeId === lt.id ? (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef2fa', background: '#fafaf8' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px', gap: 8, marginBottom: 8 }}>
                        <input style={s.input} value={editLureForm.name} onChange={e => setEditLureForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" />
                        <select style={s.select} value={editLureForm.pestId} onChange={e => setEditLureForm(f => ({ ...f, pestId: e.target.value }))}>
                          <option value="">No target pest</option>
                          {pests.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input style={s.input} type="number" value={editLureForm.rebaitWeeks} onChange={e => setEditLureForm(f => ({ ...f, rebaitWeeks: e.target.value }))} placeholder="Weeks" />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input style={{ ...s.input, flex: 1 }} value={editLureForm.description} onChange={e => setEditLureForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
                        <button style={s.saveBtn} onClick={() => handleUpdateLureType(lt.id)}>Save</button>
                        <button style={s.cancelBtn} onClick={() => setEditingLureTypeId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...s.tableRow, gridTemplateColumns: '1fr 160px 80px 60px' }}>
                      <span
                        style={{ cursor: isSuperAdmin ? 'pointer' : 'default', fontSize: 13, color: lt.is_active ? '#1a2a3a' : '#aaa' }}
                        onClick={() => {
                          if (isSuperAdmin) {
                            setEditingLureTypeId(lt.id)
                            setEditLureForm({
                              name: lt.name,
                              pestId: lt.pest_id || '',
                              rebaitWeeks: lt.rebait_weeks?.toString() || '',
                              description: lt.description || '',
                            })
                          }
                        }}
                        title={isSuperAdmin ? 'Click to edit' : ''}
                      >
                        {lt.name}
                      </span>
                      <span style={{ fontSize: 13, color: '#5a6a60' }}>{pestName(lt.pest_id)}</span>
                      <span style={{ fontSize: 13, color: '#5a6a60', textAlign: 'center' }}>{lt.rebait_weeks ?? '-'}</span>
                      <div style={{ textAlign: 'center' }}>
                        {isSuperAdmin ? (
                          <Toggle on={lt.is_active} onToggle={() => handleToggleLureType(lt.id, lt.is_active)} />
                        ) : (
                          <span style={{ fontSize: 12, color: lt.is_active ? '#4caf72' : '#aaa' }}>{lt.is_active ? 'Yes' : 'No'}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {lureTypes.length === 0 && <div style={s.empty}>No lure types configured</div>}
              {isSuperAdmin && (
                <div style={s.addSection}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px auto', gap: 8, alignItems: 'center' }}>
                    <input style={s.input} placeholder="New lure name..." value={newLureForm.name} onChange={e => setNewLureForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleAddLureType()} />
                    <select style={s.select} value={newLureForm.pestId} onChange={e => setNewLureForm(f => ({ ...f, pestId: e.target.value }))}>
                      <option value="">Target pest...</option>
                      {pests.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input style={s.input} type="number" placeholder="Wk" value={newLureForm.rebaitWeeks} onChange={e => setNewLureForm(f => ({ ...f, rebaitWeeks: e.target.value }))} />
                    <button style={s.addBtn} onClick={handleAddLureType} disabled={addingLureType}>
                      {addingLureType ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Card 3: Valid Combinations ──────────────────────────── */}
            <div style={s.card}>
              <div style={s.cardTitle}>
                Valid Trap-Lure Combinations
                <span style={{ fontSize: 12, fontWeight: 400, color: '#8a95a0' }}>Controls which lures appear for each trap type</span>
              </div>
              {trapTypes.filter(tt => tt.is_active).map(tt => {
                const combos = combinations.filter(c => c.trap_type_id === tt.id)
                const assignedLureIds = new Set(combos.map(c => c.lure_type_id))
                const availableLures = lureTypes.filter(l => l.is_active && !assignedLureIds.has(l.id))
                const isAddingCombo = addComboTrapTypeId === tt.id

                return (
                  <div key={tt.id} style={s.comboGroup}>
                    <div style={s.comboHead}>
                      <span>{tt.name}</span>
                      {isSuperAdmin && !isAddingCombo && (
                        <button style={{ ...s.addBtn, fontSize: 11, padding: '3px 10px' }} onClick={() => { setAddComboTrapTypeId(tt.id); setAddComboLureTypeId('') }}>
                          + Add Lure
                        </button>
                      )}
                    </div>

                    {combos.length === 0 && !isAddingCombo && (
                      <div style={{ fontSize: 12, color: '#aaa', padding: '4px 0' }}>No combinations defined — all lures will be shown</div>
                    )}

                    {combos.map(c => (
                      <div key={c.id} style={s.comboRow}>
                        <span style={s.chip}>
                          {lureName(c.lure_type_id)}
                          {c.lure_type_id && (
                            <span style={{ fontSize: 10, color: '#8a95a0' }}>
                              ({pestName(lureTypes.find(l => l.id === c.lure_type_id)?.pest_id ?? null)})
                            </span>
                          )}
                        </span>
                        {c.is_default && <span style={s.defaultBadge}>Default</span>}
                        {isSuperAdmin && !c.is_default && (
                          <button
                            style={{ background: 'none', border: 'none', color: '#2176d9', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
                            onClick={() => handleSetDefault(c.id, tt.id)}
                          >
                            Set default
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            style={{ background: 'none', border: 'none', color: '#e85a4a', fontSize: 14, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
                            onClick={() => handleRemoveCombination(c.id)}
                            title="Remove combination"
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))}

                    {isAddingCombo && isSuperAdmin && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
                        <select style={{ ...s.select, maxWidth: 260 }} value={addComboLureTypeId} onChange={e => setAddComboLureTypeId(e.target.value)}>
                          <option value="">Select lure...</option>
                          <option value="__none__">No lure (visual only)</option>
                          {availableLures.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <button style={s.saveBtn} onClick={() => handleAddCombination(tt.id)}>Add</button>
                        <button style={s.cancelBtn} onClick={() => setAddComboTrapTypeId(null)}>Cancel</button>
                      </div>
                    )}
                  </div>
                )
              })}
              {trapTypes.filter(tt => tt.is_active).length === 0 && (
                <div style={s.empty}>No active trap types</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

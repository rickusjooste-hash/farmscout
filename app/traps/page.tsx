'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Farm { id: string; full_name: string; code: string; organisation_id: string }
interface Orchard { id: string; farm_id: string; name: string; orchard_nr: number | null }
interface Zone { id: string; orchard_id: string; name: string; zone_nr: number; zone_letter: string }
interface Pest { id: string; name: string }
interface LureType { id: string; name: string; pest_id: string | null }
interface TrapType { id: string; name: string }
interface Combination { id: string; trap_type_id: string; lure_type_id: string | null; is_default: boolean }
interface TrapRow {
  id: string
  farm_id: string
  orchard_id: string
  zone_id: string
  trap_type_id: string
  lure_type_id: string | null
  pest_id: string | null
  trap_nr: number
  is_active: boolean
  organisation_id: string
  orchards: { name: string; orchard_nr: number | null } | null
  zones: { name: string } | null
  pests: { name: string } | null
  lure_types: { name: string } | null
  trap_types: { name: string } | null
}

const EMPTY_ADD_FORM = {
  farmId: '',
  orchardId: '',
  zoneId: '',
  trapTypeId: '',
  lureTypeId: '',
  pestId: '',
  trapNr: '',
}

export default function TrapsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { farmIds, isSuperAdmin, orgId, contextLoaded, allowed, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [traps, setTraps] = useState<TrapRow[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [pests, setPests] = useState<Pest[]>([])
  const [lureTypes, setLureTypes] = useState<LureType[]>([])
  const [trapTypes, setTrapTypes] = useState<TrapType[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterOrchard, setFilterOrchard] = useState('')
  const [filterZone, setFilterZone] = useState('')
  const [filterPest, setFilterPest] = useState('')

  // Add panel
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState('')

  // Inline edit
  const [editingTrapId, setEditingTrapId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_ADD_FORM)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
    }
    init()
  }, [])

  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const [
        { data: farmData },
        { data: trapData },
        { data: orchardData },
        { data: zoneData },
        { data: pestData },
        { data: lureData },
        { data: trapTypeData },
        { data: comboData },
      ] = await Promise.all([
        isSuperAdmin
          ? supabase.from('farms').select('id,full_name,code,organisation_id').order('full_name')
          : supabase.from('farms').select('id,full_name,code,organisation_id').in('id', farmIds).order('full_name'),
        supabase.from('traps').select('id,farm_id,orchard_id,zone_id,trap_type_id,lure_type_id,pest_id,trap_nr,is_active,organisation_id,orchards(name,orchard_nr),zones(name),pests(name),lure_types(name),trap_types(name)').order('trap_nr'),
        isSuperAdmin
          ? supabase.from('orchards').select('id,farm_id,name,orchard_nr').eq('is_active', true).order('orchard_nr')
          : supabase.from('orchards').select('id,farm_id,name,orchard_nr').in('farm_id', farmIds).eq('is_active', true).order('orchard_nr'),
        supabase.from('zones').select('id,orchard_id,name,zone_nr,zone_letter').order('zone_nr'),
        supabase.from('pests').select('id,name').order('name'),
        supabase.from('lure_types').select('id,name,pest_id').order('name'),
        supabase.from('trap_types').select('id,name').order('name'),
        supabase.from('trap_type_lure_types').select('id,trap_type_id,lure_type_id,is_default'),
      ])

      const farmList = farmData || []
      setFarms(farmList)
      setTraps((trapData || []) as unknown as TrapRow[])
      setOrchards(orchardData || [])
      setZones(zoneData || [])
      setPests(pestData || [])
      setLureTypes((lureData || []) as LureType[])
      setTrapTypes(trapTypeData || [])
      setCombinations((comboData || []) as Combination[])

      if (farmList.length > 0) {
        setSelectedFarmId(farmList[0].id)
        setAddForm(f => ({ ...f, farmId: farmList[0].id }))
      }
      setLoading(false)
    }
    load()
  }, [contextLoaded])

  // Derived: filtered traps
  const farmTraps = traps.filter(t => t.farm_id === selectedFarmId)
  const filteredTraps = farmTraps.filter(t => {
    if (filterOrchard && t.orchard_id !== filterOrchard) return false
    if (filterZone && t.zone_id !== filterZone) return false
    if (filterPest && t.pest_id !== filterPest) return false
    return true
  })

  // Derived: orchards/zones for selected farm
  const farmOrchards = orchards.filter(o => o.farm_id === selectedFarmId)
  const addFormZones = zones.filter(z => z.orchard_id === addForm.orchardId)
  const editFormZones = zones.filter(z => z.orchard_id === editForm.orchardId)
  const filterZones = filterOrchard ? zones.filter(z => z.orchard_id === filterOrchard) : []

  // Filter lure types by valid combinations for a given trap type
  function getValidLures(trapTypeId: string, currentLureId?: string | null): LureType[] {
    const combos = combinations.filter(c => c.trap_type_id === trapTypeId)
    if (combos.length === 0) return lureTypes // no combos defined: show all (graceful fallback)
    const validIds = new Set(combos.map(c => c.lure_type_id).filter(Boolean) as string[])
    const hasNoLure = combos.some(c => c.lure_type_id === null)
    const filtered = lureTypes.filter(l => validIds.has(l.id))
    // Always include the current lure in edit mode (tolerance for legacy data)
    if (currentLureId && !validIds.has(currentLureId)) {
      const current = lureTypes.find(l => l.id === currentLureId)
      if (current) filtered.push(current)
    }
    return filtered
  }

  // When trap type changes, auto-select default lure + its pest
  function handleTrapTypeChange(trapTypeId: string, setter: (fn: (f: typeof EMPTY_ADD_FORM) => typeof EMPTY_ADD_FORM) => void) {
    const defaultCombo = combinations.find(c => c.trap_type_id === trapTypeId && c.is_default)
    const defaultLureId = defaultCombo?.lure_type_id || ''
    const lure = lureTypes.find(l => l.id === defaultLureId)
    setter(f => ({
      ...f,
      trapTypeId,
      lureTypeId: defaultLureId,
      pestId: lure?.pest_id || '',
    }))
  }

  // When lure changes, auto-set pest from lure's target pest
  function handleLureChange(lureTypeId: string, setter: (fn: (f: typeof EMPTY_ADD_FORM) => typeof EMPTY_ADD_FORM) => void) {
    const lure = lureTypes.find(l => l.id === lureTypeId)
    setter(f => ({
      ...f,
      lureTypeId,
      pestId: lure?.pest_id || f.pestId,
    }))
  }

  // Compute next trap_nr for the selected farm
  function getNextTrapNr(farmId: string): number {
    const farmTraps = traps.filter(t => t.farm_id === farmId)
    if (farmTraps.length === 0) return 1
    return Math.max(...farmTraps.map(t => t.trap_nr)) + 1
  }

  async function handleToggleActive(trap: TrapRow) {
    const newActive = !trap.is_active
    // Optimistic
    setTraps(prev => prev.map(t => t.id === trap.id ? { ...t, is_active: newActive } : t))
    await fetch('/api/traps/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'toggle-active', trapId: trap.id, isActive: newActive }),
    })
  }

  function startEdit(trap: TrapRow) {
    setEditingTrapId(trap.id)
    setEditForm({
      farmId: trap.farm_id,
      orchardId: trap.orchard_id,
      zoneId: trap.zone_id,
      trapTypeId: trap.trap_type_id,
      lureTypeId: trap.lure_type_id || '',
      pestId: trap.pest_id || '',
      trapNr: String(trap.trap_nr),
    })
    setEditError('')
    setShowAddPanel(false)
  }

  async function handleSaveEdit() {
    if (!editingTrapId) return
    setEditSubmitting(true)
    setEditError('')

    const res = await fetch('/api/traps/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'update',
        trapId: editingTrapId,
        orchardId: editForm.orchardId,
        zoneId: editForm.zoneId,
        trapTypeId: editForm.trapTypeId,
        lureTypeId: editForm.lureTypeId || null,
        pestId: editForm.pestId || null,
        trapNr: parseInt(editForm.trapNr) || 1,
      }),
    })
    const json = await res.json()
    setEditSubmitting(false)
    if (!res.ok || json.error) {
      setEditError(json.error || 'Failed to save')
      return
    }

    // Refresh traps from server
    const { data } = await supabase
      .from('traps')
      .select('id,farm_id,orchard_id,zone_id,trap_type_id,lure_type_id,pest_id,trap_nr,is_active,organisation_id,orchards(name,orchard_nr),zones(name),pests(name),lure_types(name),trap_types(name)')
      .order('trap_nr')
    setTraps((data || []) as unknown as TrapRow[])
    setEditingTrapId(null)
  }

  async function handleAddTrap(e: React.FormEvent) {
    e.preventDefault()
    setAddSubmitting(true)
    setAddError('')

    const farm = farms.find(f => f.id === addForm.farmId)
    const res = await fetch('/api/traps/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'create',
        farmId: addForm.farmId,
        orchardId: addForm.orchardId,
        zoneId: addForm.zoneId,
        trapTypeId: addForm.trapTypeId,
        lureTypeId: addForm.lureTypeId || null,
        pestId: addForm.pestId || null,
        trapNr: addForm.trapNr ? parseInt(addForm.trapNr) : undefined,
        organisationId: farm?.organisation_id || orgId,
      }),
    })
    const json = await res.json()
    setAddSubmitting(false)
    if (!res.ok || json.error) {
      setAddError(json.error || 'Failed to add trap')
      return
    }

    // Refresh traps from server
    const { data } = await supabase
      .from('traps')
      .select('id,farm_id,orchard_id,zone_id,trap_type_id,lure_type_id,pest_id,trap_nr,is_active,organisation_id,orchards(name,orchard_nr),zones(name),pests(name),lure_types(name),trap_types(name)')
      .order('trap_nr')
    setTraps((data || []) as unknown as TrapRow[])

    // Reset form, keep farm
    setAddForm({ ...EMPTY_ADD_FORM, farmId: addForm.farmId })
    setShowAddPanel(false)
  }

  // When farm changes in add form, reset orchard/zone and set next trap_nr
  function handleAddFarmChange(farmId: string) {
    setAddForm({
      ...EMPTY_ADD_FORM,
      farmId,
      trapNr: String(getNextTrapNr(farmId)),
    })
  }

  // When add panel opens, prefill trap nr
  function openAddPanel() {
    const fId = selectedFarmId || (farms.length > 0 ? farms[0].id : '')
    setAddForm({
      ...EMPTY_ADD_FORM,
      farmId: fId,
      trapNr: fId ? String(getNextTrapNr(fId)) : '',
    })
    setAddError('')
    setEditingTrapId(null)
    setShowAddPanel(true)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#1a2a3a', background: '#f4f1eb' }}>
        Loading...
      </div>
    )
  }

  if (!allowed) return null

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f4f1eb; color: #1a1a1a; }
        .app { display: flex; min-height: 100vh; }
        .main { flex: 1; padding: 40px; overflow: auto; }
        .page-title { font-family: 'Inter', sans-serif; font-size: 28px; color: #1a2a3a; margin-bottom: 6px; letter-spacing: -0.3px; }
        .page-sub { font-size: 14px; color: #7a8a9a; margin-bottom: 28px; }
        label { display: block; font-size: 11px; font-weight: 600; color: #6a7a70; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 5px; }
        input[type=text], input[type=number], select {
          width: 100%; padding: 9px 12px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1a2a3a;
          background: #fff; outline: none; transition: border-color 0.15s;
        }
        input[type=text]:focus, input[type=number]:focus, select:focus { border-color: #2176d9; }
        .field { margin-bottom: 14px; }
        .btn-primary {
          padding: 10px 18px; border-radius: 8px; border: none;
          background: #1a4ba0; color: #a0c4f0; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s;
        }
        .btn-primary:hover { background: #1a5fb8; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost {
          padding: 10px 18px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          background: transparent; color: #6a7a70; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .btn-ghost:hover { border-color: #1a4ba0; color: #1a2a3a; }
        .error-msg { background: #fdf0ee; border: 1px solid #f5c5be; color: #c0392b; border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 12px; }
        .table-card { background: #fff; border-radius: 14px; border: 1px solid #e8e4dc; overflow: hidden; }
        .table-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eef2fa; }
        .table-header-title { font-size: 14px; font-weight: 600; color: #1a2a3a; }
        .add-panel {
          width: 320px; flex-shrink: 0; background: #fff; border-radius: 14px;
          border: 1px solid #e8e4dc; padding: 24px; align-self: flex-start;
        }
        .panel-title { font-size: 14px; font-weight: 600; color: #1a2a3a; margin-bottom: 20px; }
        .toggle-btn {
          width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer;
          position: relative; transition: background 0.2s; flex-shrink: 0;
        }
        .toggle-btn::after {
          content: ''; position: absolute; top: 3px; width: 16px; height: 16px;
          border-radius: 50%; background: white; transition: left 0.2s;
        }
        .toggle-btn.on { background: #2176d9; }
        .toggle-btn.on::after { left: 21px; }
        .toggle-btn.off { background: #d0cec8; }
        .toggle-btn.off::after { left: 3px; }
        .trap-list { width: 100%; }
        .trap-list-header { display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid #e8e4dc; }
        .trap-list-header-cell { font-size: 11px; font-weight: 600; color: #8a95a0; text-transform: uppercase; letter-spacing: 0.6px; }
        .trap-row { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eef2fa; }
        .trap-row:last-child { border-bottom: none; }
        .trap-row.clickable-row { cursor: pointer; }
        .trap-row.clickable-row:hover { background: #eef2fa; }
        .trap-row.editing { background: #f7faf8; }
        .edit-row-form { padding: 16px; background: #f7faf8; border-top: 1px solid #e8e4dc; }
        .edit-row-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .btn-sm {
          padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; border: none; transition: all 0.15s;
        }
        .btn-sm.primary { background: #1a4ba0; color: #a0c4f0; }
        .btn-sm.primary:hover { background: #1a5fb8; }
        .btn-sm.ghost { background: transparent; border: 1.5px solid #e0ddd6; color: #6a7a70; }
        .btn-sm.ghost:hover { border-color: #1a4ba0; color: #1a2a3a; }
        .btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
        .farm-selector { display: flex; align-items: center; gap: 10px; }
        .farm-selector label { margin: 0; text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 500; color: #6a7a70; }
        .farm-selector select { width: auto; min-width: 160px; }
        .empty-state { padding: 40px; text-align: center; color: #8a95a0; font-size: 14px; }
        .filter-bar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
        .filter-bar select { width: auto; min-width: 140px; font-size: 12px; padding: 7px 10px; }
        .filter-bar label { margin: 0; font-size: 11px; }
        @media (max-width: 768px) {
          .main { padding: 20px 16px 80px; }
          .filter-bar select { min-width: 100px; }
          .add-panel { width: 100%; }
        }
      `}</style>

      <div className="app">
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} onLogout={async () => { await supabase.auth.signOut(); window.location.href = '/login' }} />

        <div className="main">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="page-title">Trap Management</div>
              <div className="page-sub">Add, edit, and manage traps across your farms.</div>
            </div>
            {farms.length > 1 && (
              <div className="farm-selector">
                <label>Farm</label>
                <select
                  value={selectedFarmId || ''}
                  onChange={e => {
                    setSelectedFarmId(e.target.value)
                    setEditingTrapId(null)
                    setFilterOrchard('')
                    setFilterZone('')
                    setFilterPest('')
                  }}
                >
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>{f.full_name} ({f.code})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="filter-bar">
            <div>
              <label>Orchard</label>
              <select value={filterOrchard} onChange={e => { setFilterOrchard(e.target.value); setFilterZone('') }}>
                <option value="">All orchards</option>
                {farmOrchards.map(o => (
                  <option key={o.id} value={o.id}>{o.orchard_nr ? `${o.orchard_nr} - ` : ''}{o.name}</option>
                ))}
              </select>
            </div>
            {filterOrchard && filterZones.length > 0 && (
              <div>
                <label>Zone</label>
                <select value={filterZone} onChange={e => setFilterZone(e.target.value)}>
                  <option value="">All zones</option>
                  {filterZones.map(z => (
                    <option key={z.id} value={z.id}>{z.zone_letter} - {z.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label>Pest</label>
              <select value={filterPest} onChange={e => setFilterPest(e.target.value)}>
                <option value="">All pests</option>
                {pests.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content area: table + optional add panel */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

            {/* Trap table */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="table-card">
                <div className="table-header">
                  <span className="table-header-title">
                    Traps ({filteredTraps.length})
                  </span>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: '6px 14px' }}
                    onClick={() => showAddPanel ? setShowAddPanel(false) : openAddPanel()}
                  >
                    {showAddPanel ? '✕ Close' : '+ Add Trap'}
                  </button>
                </div>

                {filteredTraps.length === 0 ? (
                  <div className="empty-state">No traps found{filterOrchard || filterZone || filterPest ? ' matching filters' : ' for this farm'}.</div>
                ) : (
                  <div className="trap-list">
                    <div className="trap-list-header">
                      <div className="trap-list-header-cell" style={{ width: 70, flexShrink: 0 }}>Trap #</div>
                      <div className="trap-list-header-cell" style={{ flex: 1 }}>Orchard</div>
                      <div className="trap-list-header-cell" style={{ width: 100, flexShrink: 0 }}>Zone</div>
                      <div className="trap-list-header-cell" style={{ width: 120, flexShrink: 0 }}>Pest</div>
                      <div className="trap-list-header-cell" style={{ width: 110, flexShrink: 0 }}>Lure</div>
                      <div className="trap-list-header-cell" style={{ width: 100, flexShrink: 0 }}>Type</div>
                      <div className="trap-list-header-cell" style={{ width: 70, flexShrink: 0, textAlign: 'center' }}>Active</div>
                    </div>
                    {filteredTraps.map(trap => (
                      <div key={trap.id}>
                        <div
                          className={`trap-row${editingTrapId === trap.id ? ' editing' : ' clickable-row'}`}
                          onClick={editingTrapId !== trap.id ? () => startEdit(trap) : undefined}
                        >
                          <div style={{ width: 70, flexShrink: 0, fontWeight: 600, fontSize: 13, color: '#1a2a3a' }}>
                            {trap.trap_nr}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#1a2a3a' }}>
                            {trap.orchards?.orchard_nr ? `${trap.orchards.orchard_nr} - ` : ''}{trap.orchards?.name || '—'}
                          </div>
                          <div style={{ width: 100, flexShrink: 0, fontSize: 12, color: '#6a7a70' }}>
                            {trap.zones?.name || '—'}
                          </div>
                          <div style={{ width: 120, flexShrink: 0, fontSize: 12, color: '#6a7a70' }}>
                            {trap.pests?.name || '—'}
                          </div>
                          <div style={{ width: 110, flexShrink: 0, fontSize: 12, color: '#6a7a70' }}>
                            {trap.lure_types?.name || '—'}
                          </div>
                          <div style={{ width: 100, flexShrink: 0, fontSize: 12, color: '#6a7a70' }}>
                            {trap.trap_types?.name || '—'}
                          </div>
                          <div style={{ width: 70, flexShrink: 0, display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                            <button
                              className={`toggle-btn ${trap.is_active ? 'on' : 'off'}`}
                              onClick={() => handleToggleActive(trap)}
                              title={trap.is_active ? 'Deactivate' : 'Activate'}
                            />
                          </div>
                        </div>

                        {/* Inline edit form */}
                        {editingTrapId === trap.id && (
                          <div className="edit-row-form">
                            {editError && <div className="error-msg">{editError}</div>}
                            <div className="edit-row-grid">
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label>Orchard</label>
                                <select value={editForm.orchardId} onChange={e => setEditForm(f => ({ ...f, orchardId: e.target.value, zoneId: '' }))}>
                                  <option value="">Select orchard</option>
                                  {farmOrchards.map(o => (
                                    <option key={o.id} value={o.id}>{o.orchard_nr ? `${o.orchard_nr} - ` : ''}{o.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label>Zone</label>
                                <select value={editForm.zoneId} onChange={e => setEditForm(f => ({ ...f, zoneId: e.target.value }))}>
                                  <option value="">Select zone</option>
                                  {editFormZones.map(z => (
                                    <option key={z.id} value={z.id}>{z.zone_letter} - {z.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label>Trap Type</label>
                                <select value={editForm.trapTypeId} onChange={e => handleTrapTypeChange(e.target.value, setEditForm)}>
                                  <option value="">Select type</option>
                                  {trapTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label>Lure Type</label>
                                <select value={editForm.lureTypeId} onChange={e => handleLureChange(e.target.value, setEditForm)}>
                                  <option value="">None</option>
                                  {getValidLures(editForm.trapTypeId, trap.lure_type_id).map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label>Pest</label>
                                <select value={editForm.pestId} onChange={e => setEditForm(f => ({ ...f, pestId: e.target.value }))}>
                                  <option value="">None</option>
                                  {pests.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label>Trap #</label>
                                <input
                                  type="number"
                                  value={editForm.trapNr}
                                  onChange={e => setEditForm(f => ({ ...f, trapNr: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                              <button className="btn-sm primary" onClick={handleSaveEdit} disabled={editSubmitting}>
                                {editSubmitting ? 'Saving...' : 'Save'}
                              </button>
                              <button className="btn-sm ghost" onClick={() => setEditingTrapId(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Add Trap panel */}
            {showAddPanel && (
              <div className="add-panel">
                <div className="panel-title">Add Trap</div>
                {addError && <div className="error-msg">{addError}</div>}
                <form onSubmit={handleAddTrap}>
                  {farms.length > 1 && (
                    <div className="field">
                      <label>Farm</label>
                      <select
                        value={addForm.farmId}
                        onChange={e => handleAddFarmChange(e.target.value)}
                        required
                      >
                        {farms.map(f => (
                          <option key={f.id} value={f.id}>{f.full_name} ({f.code})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="field">
                    <label>Orchard</label>
                    <select
                      value={addForm.orchardId}
                      onChange={e => setAddForm(f => ({ ...f, orchardId: e.target.value, zoneId: '' }))}
                      required
                    >
                      <option value="">Select orchard</option>
                      {orchards.filter(o => o.farm_id === addForm.farmId).map(o => (
                        <option key={o.id} value={o.id}>{o.orchard_nr ? `${o.orchard_nr} - ` : ''}{o.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Zone</label>
                    <select
                      value={addForm.zoneId}
                      onChange={e => setAddForm(f => ({ ...f, zoneId: e.target.value }))}
                      required
                    >
                      <option value="">Select zone</option>
                      {addFormZones.map(z => (
                        <option key={z.id} value={z.id}>{z.zone_letter} - {z.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Trap Type</label>
                    <select
                      value={addForm.trapTypeId}
                      onChange={e => handleTrapTypeChange(e.target.value, setAddForm)}
                      required
                    >
                      <option value="">Select type</option>
                      {trapTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Lure Type <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <select
                      value={addForm.lureTypeId}
                      onChange={e => handleLureChange(e.target.value, setAddForm)}
                    >
                      <option value="">None</option>
                      {getValidLures(addForm.trapTypeId).map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Pest <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(auto from lure)</span></label>
                    <select
                      value={addForm.pestId}
                      onChange={e => setAddForm(f => ({ ...f, pestId: e.target.value }))}
                    >
                      <option value="">None</option>
                      {pests.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Trap # <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(auto)</span></label>
                    <input
                      type="number"
                      value={addForm.trapNr}
                      onChange={e => setAddForm(f => ({ ...f, trapNr: e.target.value }))}
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={addSubmitting}>
                    {addSubmitting ? 'Adding...' : 'Add Trap'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
      <MobileNav modules={modules} />
    </>
  )
}

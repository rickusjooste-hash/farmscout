'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Commodity { id: string; code: string; name: string }
interface PestRow {
  id: string
  commodity_id: string
  category: string
  display_name: string | null
  display_order: number
  observation_method: string
  is_active: boolean
  pests: { id: string; name: string; scientific_name: string | null }
}
interface FarmConfig { id: string; farm_id: string; commodity_pest_id: string; is_active: boolean }
interface Farm { id: string; full_name: string; code: string }

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  pest:       { bg: '#fff3e0', color: '#e65100' },
  mite:       { bg: '#fce4ec', color: '#c62828' },
  disease:    { bg: '#f3e5f5', color: '#6a1b9a' },
  beneficial: { bg: '#e8f5e9', color: '#2e7d32' },
}

const METHOD_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  present_absent:  { bg: '#e3f2fd', color: '#1565c0', label: 'Presence' },
  count:           { bg: '#fff8e1', color: '#f57f17', label: 'Count' },
  leaf_inspection: { bg: '#ede7f6', color: '#4527a0', label: 'Leaf Inspection' },
}

const OBSERVATION_METHODS = [
  { value: 'present_absent',  label: 'present_absent — YES / NO' },
  { value: 'count',           label: 'count — +/− counter' },
  { value: 'leaf_inspection', label: 'leaf_inspection — 5-point scale' },
]

const CATEGORIES = ['pest', 'mite', 'disease', 'beneficial']

function SortablePestRow({
  row, isSuperAdmin, isEditing, editForm, editSubmitting, editError,
  farmActive, commodityCode, onStartEdit, onSaveEdit, onCancelEdit, onEditFormChange, onFarmToggle, onGlobalToggle, onRemove,
}: {
  row: PestRow
  isSuperAdmin: boolean
  isEditing: boolean
  editForm: { displayName: string; observationMethod: string; displayOrder: number; isActive: boolean; category: string }
  editSubmitting: boolean
  editError: string
  farmActive: boolean
  commodityCode: string
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditFormChange: (updates: Partial<{ displayName: string; observationMethod: string; displayOrder: number; isActive: boolean; category: string }>) => void
  onFarmToggle: () => void
  onGlobalToggle: () => void
  onRemove: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
  }
  const catColors = CATEGORY_COLORS[row.category] || CATEGORY_COLORS.pest
  const methInfo = METHOD_COLORS[row.observation_method] || METHOD_COLORS.count

  return (
    <div ref={setNodeRef} style={dragStyle}>
      <div
        className={`pest-row${isEditing ? ' editing' : isSuperAdmin ? ' clickable-row' : ''}`}
        style={{ display: 'flex', alignItems: 'center' }}
        onClick={isSuperAdmin && !isEditing ? onStartEdit : undefined}
      >
        {isSuperAdmin && (
          <div
            {...attributes} {...listeners}
            className="drag-handle"
            onClick={e => e.stopPropagation()}
          >⠿</div>
        )}
        <div style={{ width: 90, flexShrink: 0 }}>
          <span className="pill" style={{ background: catColors.bg, color: catColors.color }}>{row.category}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: '#1c3a2a' }}>{row.display_name || row.pests?.name}</div>
          {row.display_name && <div style={{ fontSize: 11, color: '#9aaa9f' }}>{row.pests?.name}</div>}
          {row.pests?.scientific_name && <div style={{ fontSize: 11, color: '#b0bdb5', fontStyle: 'italic' }}>{row.pests.scientific_name}</div>}
        </div>
        <div style={{ width: 130, flexShrink: 0 }}>
          <span className="method-badge" style={{ background: methInfo.bg, color: methInfo.color }}>{methInfo.label}</span>
        </div>
        <div style={{ width: 80, display: 'flex', justifyContent: 'center', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button className={`toggle-btn ${farmActive ? 'on' : 'off'}`} onClick={onFarmToggle}
            title={farmActive ? 'Disable for this farm' : 'Enable for this farm'} />
        </div>
        {isSuperAdmin && (
          <div style={{ width: 56, display: 'flex', justifyContent: 'center', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={row.is_active} onChange={onGlobalToggle} title="Globally active" />
          </div>
        )}
      </div>
      {isEditing && (
        <div className="edit-row-form">
          {editError && <div className="error-msg">{editError}</div>}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>Pest</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1c3a2a' }}>
              {row.pests?.name}
              {row.pests?.scientific_name && <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#9aaa9f', marginLeft: 8 }}>{row.pests.scientific_name}</span>}
            </div>
          </div>
          <div className="edit-row-grid">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Category</label>
              <select value={editForm.category}
                onChange={e => onEditFormChange({ category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Display Label</label>
              <input type="text" value={editForm.displayName}
                onChange={e => onEditFormChange({ displayName: e.target.value })}
                placeholder={row.pests?.name} />
              {editForm.observationMethod === 'leaf_inspection' && (
                <div className="hint">Tip: include unit, e.g. "Red Mite (5 leaves)"</div>
              )}
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Observation Method</label>
              <select value={editForm.observationMethod}
                onChange={e => onEditFormChange({ observationMethod: e.target.value })}>
                {OBSERVATION_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Order</label>
              <input type="number" value={editForm.displayOrder}
                onChange={e => onEditFormChange({ displayOrder: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-sm primary" onClick={onSaveEdit} disabled={editSubmitting}>
                {editSubmitting ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-sm ghost" onClick={() => { onCancelEdit(); setConfirmingDelete(false) }}>Cancel</button>
            </div>
            {isSuperAdmin && !confirmingDelete && (
              <button className="btn-sm ghost" onClick={() => setConfirmingDelete(true)}
                style={{ color: '#c0392b', borderColor: '#f5c5be' }}>
                Remove from {commodityCode}
              </button>
            )}
            {isSuperAdmin && confirmingDelete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#c0392b' }}>Remove {row.display_name || row.pests?.name} from {commodityCode}?</span>
                <button className="btn-sm ghost" onClick={() => { onRemove(); setConfirmingDelete(false) }}
                  style={{ background: '#c0392b', color: '#fff', borderColor: '#c0392b' }}>
                  Yes, remove
                </button>
                <button className="btn-sm ghost" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PestsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()

  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [activeCommodity, setActiveCommodity] = useState('POME')
  const [pestRows, setPestRows] = useState<PestRow[]>([])
  const [farmConfigs, setFarmConfigs] = useState<FarmConfig[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [configsLoading, setConfigsLoading] = useState(false)

  // Add pest panel state (super admin)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '', displayName: '', scientificName: '',
    commodityId: '', category: 'pest', observationMethod: 'count', displayOrder: 10,
  })
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState('')
  const [pestSuggestions, setPestSuggestions] = useState<{ id: string; name: string; scientific_name: string | null }[]>([])
  const [linkedPest, setLinkedPest] = useState<{ id: string; name: string; scientific_name: string | null } | null>(null)
  const nameSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Inline edit state (super admin)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    displayName: '', observationMethod: 'count', displayOrder: 0, isActive: true, category: 'pest',
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  // Auth check + initial data load
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
      const [{ data: comms }, { data: pests }, { data: farmData }] = await Promise.all([
        supabase.from('commodities').select('id,code,name').order('name'),
        supabase.from('commodity_pests').select('*, pests(id,name,scientific_name)').order('display_order'),
        isSuperAdmin
          ? supabase.from('farms').select('id,full_name,code').order('full_name')
          : supabase.from('farms').select('id,full_name,code').in('id', farmIds).order('full_name'),
      ])

      setCommodities(comms || [])
      setPestRows(pests || [])
      const farmList = farmData || []
      setFarms(farmList)

      // Set initial commodityId for add form
      if (comms && comms.length > 0) {
        const pome = comms.find(c => c.code === 'POME') || comms[0]
        setAddForm(f => ({ ...f, commodityId: pome.id }))
      }

      if (farmList.length > 0) {
        setSelectedFarmId(farmList[0].id)
      } else {
        setLoading(false)
      }
    }
    load()
  }, [contextLoaded])

  // Reload farm configs when selectedFarmId changes
  useEffect(() => {
    if (!selectedFarmId) return
    async function loadConfigs() {
      setConfigsLoading(true)
      const { data } = await supabase
        .from('farm_commodity_pest_config')
        .select('*')
        .eq('farm_id', selectedFarmId)
      setFarmConfigs(data || [])
      setConfigsLoading(false)
      setLoading(false)
    }
    loadConfigs()
  }, [selectedFarmId])

  function isFarmActive(commodityPestId: string): boolean {
    const config = farmConfigs.find(c => c.commodity_pest_id === commodityPestId)
    return !config || config.is_active
  }

  async function handleFarmToggle(commodityPestId: string) {
    if (!selectedFarmId) return
    const currentlyActive = isFarmActive(commodityPestId)
    const newActive = !currentlyActive

    // Optimistic update
    setFarmConfigs(prev => {
      const existing = prev.find(c => c.commodity_pest_id === commodityPestId)
      if (existing) {
        return prev.map(c => c.commodity_pest_id === commodityPestId ? { ...c, is_active: newActive } : c)
      }
      return [...prev, { id: '', farm_id: selectedFarmId, commodity_pest_id: commodityPestId, is_active: newActive }]
    })

    await fetch('/api/pests/farm-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commodityPestId, farmId: selectedFarmId, isActive: newActive }),
    })
  }

  async function handleGlobalToggle(row: PestRow) {
    const res = await fetch('/api/pests/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update', commodityPestId: row.id, isActive: !row.is_active }),
    })
    if (res.ok) {
      setPestRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
    }
  }

  function startEdit(row: PestRow) {
    setEditingRowId(row.id)
    setEditForm({
      displayName: row.display_name || '',
      observationMethod: row.observation_method,
      displayOrder: row.display_order,
      isActive: row.is_active,
      category: row.category,
    })
    setEditError('')
  }

  async function handleSaveEdit(row: PestRow) {
    setEditSubmitting(true)
    setEditError('')
    const res = await fetch('/api/pests/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'update',
        commodityPestId: row.id,
        displayName: editForm.displayName,
        observationMethod: editForm.observationMethod,
        displayOrder: editForm.displayOrder,
        isActive: editForm.isActive,
        category: editForm.category,
      }),
    })
    const json = await res.json()
    setEditSubmitting(false)
    if (!res.ok || json.error) {
      setEditError(json.error || 'Failed to save')
      return
    }
    setPestRows(prev => prev.map(r => r.id === row.id ? {
      ...r,
      display_name: editForm.displayName || null,
      observation_method: editForm.observationMethod,
      display_order: editForm.displayOrder,
      is_active: editForm.isActive,
      category: editForm.category,
    } : r))
    setEditingRowId(null)
  }

  function handleNameChange(value: string) {
    setAddForm(f => ({ ...f, name: value }))
    setLinkedPest(null)
    if (nameSearchTimer.current) clearTimeout(nameSearchTimer.current)
    if (value.trim().length < 2) { setPestSuggestions([]); return }
    nameSearchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('pests')
        .select('id, name, scientific_name')
        .ilike('name', `%${value.trim()}%`)
        .limit(6)
      setPestSuggestions(data || [])
    }, 300)
  }

  function selectExistingPest(pest: { id: string; name: string; scientific_name: string | null }) {
    setLinkedPest(pest)
    setAddForm(f => ({ ...f, name: pest.name }))
    setPestSuggestions([])
  }

  async function handleAddPest(e: React.FormEvent) {
    e.preventDefault()
    setAddSubmitting(true)
    setAddError('')
    const res = await fetch('/api/pests/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        linkedPest
          ? {
              type: 'add-to-commodity',
              pestId: linkedPest.id,
              commodityId: addForm.commodityId,
              category: addForm.category,
              observationMethod: addForm.observationMethod,
              displayOrder: addForm.displayOrder,
              displayName: addForm.displayName,
            }
          : {
              type: 'create',
              name: addForm.name,
              displayName: addForm.displayName,
              scientific_name: addForm.scientificName,
              commodityId: addForm.commodityId,
              category: addForm.category,
              observationMethod: addForm.observationMethod,
              displayOrder: addForm.displayOrder,
            }
      ),
    })
    const json = await res.json()
    setAddSubmitting(false)
    if (!res.ok || json.error) {
      setAddError(json.error || 'Failed to add pest')
      return
    }

    // Reload pest rows
    const { data } = await supabase
      .from('commodity_pests')
      .select('*, pests(id,name,scientific_name)')
      .order('display_order')
    setPestRows(data || [])

    // Reset form (keep commodity/category/method)
    setAddForm(f => ({ ...f, name: '', displayName: '', scientificName: '', displayOrder: 10 }))
    setLinkedPest(null)
    setPestSuggestions([])
    setShowAddPanel(false)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeCommodityObj = commodities.find(c => c.code === activeCommodity)
  const filteredRows = pestRows
    .filter(r => r.commodity_id === activeCommodityObj?.id)
    .sort((a, b) => a.display_order - b.display_order)

  async function handleRemove(row: PestRow) {
    const res = await fetch('/api/pests/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'delete', commodityPestId: row.id }),
    })
    if (res.ok) {
      setPestRows(prev => prev.filter(r => r.id !== row.id))
      setEditingRowId(null)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeIndex = filteredRows.findIndex(r => r.id === active.id)
    const overIndex = filteredRows.findIndex(r => r.id === over.id)
    if (activeIndex === -1 || overIndex === -1) return
    const reordered = arrayMove(filteredRows, activeIndex, overIndex)
    const reorderedWithOrder = reordered.map((r, i) => ({ ...r, display_order: (i + 1) * 10 }))
    setPestRows(prev => [
      ...prev.filter(r => r.commodity_id !== activeCommodityObj?.id),
      ...reorderedWithOrder,
    ])
    await fetch('/api/pests/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorder', orderedIds: reordered.map(r => r.id) }),
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#1c3a2a', background: '#f4f1eb' }}>
        Loading…
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f1eb; color: #1a1a1a; }
        .app { display: flex; min-height: 100vh; }
        .sidebar {
          width: 220px; height: 100vh; position: sticky; top: 0; overflow-y: auto; background: #1c3a2a;
          padding: 32px 20px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
        }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #a8d5a2; margin-bottom: 32px; }
        .logo span { color: #fff; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 8px; color: #8aab96; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .nav-item:hover { background: #2a4f38; color: #fff; }
        .nav-item.active { background: #2a4f38; color: #a8d5a2; }
        .sidebar-footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #2a4f38; font-size: 12px; color: #4a7a5a; }
        .main { flex: 1; padding: 40px; overflow: auto; }
        .page-title { font-family: 'DM Serif Display', serif; font-size: 28px; color: #1c3a2a; margin-bottom: 6px; }
        .page-sub { font-size: 14px; color: #7a8a80; margin-bottom: 28px; }
        .tabs { display: flex; gap: 2px; background: #e8e4dc; border-radius: 10px; padding: 3px; width: fit-content; }
        .tab {
          padding: 8px 22px; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; border: none; font-family: 'DM Sans', sans-serif;
          color: #6a7a70; background: transparent; transition: all 0.15s;
        }
        .tab.active { background: #1c3a2a; color: #a8d5a2; }
        .pest-table { width: 100%; border-collapse: collapse; }
        .pest-table th {
          text-align: left; font-size: 11px; font-weight: 600; color: #9aaa9f;
          text-transform: uppercase; letter-spacing: 0.6px; padding: 10px 12px;
          border-bottom: 1px solid #e8e4dc;
        }
        .pest-table td { padding: 12px; border-bottom: 1px solid #f0ede6; vertical-align: middle; }
        .pest-table tr:last-child td { border-bottom: none; }
        .pest-table tr:hover td { background: #faf9f6; }
        .pest-table tr.editing td { background: #f7faf8; }
        .pill {
          display: inline-block; padding: 3px 9px; border-radius: 20px;
          font-size: 11px; font-weight: 600; text-transform: capitalize;
        }
        .method-badge {
          display: inline-block; padding: 3px 9px; border-radius: 6px;
          font-size: 11px; font-weight: 600;
        }
        .toggle-btn {
          width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer;
          position: relative; transition: background 0.2s; flex-shrink: 0;
        }
        .toggle-btn::after {
          content: ''; position: absolute; top: 3px; width: 16px; height: 16px;
          border-radius: 50%; background: white; transition: left 0.2s;
        }
        .toggle-btn.on { background: #2a6e45; }
        .toggle-btn.on::after { left: 21px; }
        .toggle-btn.off { background: #d0cec8; }
        .toggle-btn.off::after { left: 3px; }
        .add-panel {
          width: 320px; flex-shrink: 0; background: #fff; border-radius: 14px;
          border: 1px solid #e8e4dc; padding: 24px; align-self: flex-start;
        }
        .panel-title { font-size: 14px; font-weight: 600; color: #1c3a2a; margin-bottom: 20px; }
        label { display: block; font-size: 11px; font-weight: 600; color: #6a7a70; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 5px; }
        input[type=text], input[type=number], select {
          width: 100%; padding: 9px 12px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1c3a2a;
          background: #fff; outline: none; transition: border-color 0.15s;
        }
        input[type=text]:focus, input[type=number]:focus, select:focus { border-color: #2a6e45; }
        .field { margin-bottom: 14px; }
        .btn-primary {
          padding: 10px 18px; border-radius: 8px; border: none;
          background: #1c3a2a; color: #a8d5a2; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s;
        }
        .btn-primary:hover { background: #2a4f38; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost {
          padding: 10px 18px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          background: transparent; color: #6a7a70; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
        }
        .btn-ghost:hover { border-color: #1c3a2a; color: #1c3a2a; }
        .error-msg { background: #fdf0ee; border: 1px solid #f5c5be; color: #c0392b; border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 12px; }
        .hint { font-size: 11px; color: #9aaa9f; margin-top: 4px; line-height: 1.4; }
        .table-card { background: #fff; border-radius: 14px; border: 1px solid #e8e4dc; overflow: hidden; }
        .table-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f0ede6; }
        .table-header-title { font-size: 14px; font-weight: 600; color: #1c3a2a; }
        .edit-row-form { padding: 12px; background: #f7faf8; border-top: 1px solid #e8e4dc; }
        .edit-row-grid { display: grid; grid-template-columns: 120px 1fr 1fr 80px; gap: 10px; align-items: end; }
        .checkbox-row { display: flex; align-items: center; gap: 8px; }
        input[type=checkbox] { width: 16px; height: 16px; cursor: pointer; accent-color: #1c3a2a; }
        .edit-actions { display: flex; gap: 8px; margin-top: 10px; }
        .btn-sm {
          padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; border: none; transition: all 0.15s;
        }
        .btn-sm.primary { background: #1c3a2a; color: #a8d5a2; }
        .btn-sm.primary:hover { background: #2a4f38; }
        .btn-sm.ghost { background: transparent; border: 1.5px solid #e0ddd6; color: #6a7a70; }
        .btn-sm.ghost:hover { border-color: #1c3a2a; color: #1c3a2a; }
        .btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
        .farm-selector { display: flex; align-items: center; gap: 10px; }
        .farm-selector label { margin: 0; text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 500; color: #6a7a70; }
        .farm-selector select { width: auto; min-width: 160px; }
        .empty-state { padding: 40px; text-align: center; color: #9aaa9f; font-size: 14px; }
        .pest-list { width: 100%; }
        .pest-list-header { display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid #e8e4dc; }
        .pest-list-header-cell { font-size: 11px; font-weight: 600; color: #9aaa9f; text-transform: uppercase; letter-spacing: 0.6px; }
        .pest-row { display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f0ede6; }
        .pest-row:last-child { border-bottom: none; }
        .pest-row.clickable-row { cursor: pointer; }
        .pest-row.clickable-row:hover { background: #f0f7f3; }
        .pest-row.editing { background: #f7faf8; }
        .drag-handle { width: 28px; flex-shrink: 0; color: #b0bdb5; font-size: 15px; text-align: center; cursor: grab; user-select: none; touch-action: none; }
        .drag-handle:active { cursor: grabbing; }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item"><span>🏡</span> Orchards</a>
          <a href="/pests" className="nav-item active"><span>🐛</span> Pests</a>
          <a className="nav-item"><span>🪤</span> Traps</a>
          <a className="nav-item"><span>🔍</span> Inspections</a>
          <a href="/scouts" className="nav-item"><span>👷</span> Scouts</a>
          <a href="/scouts/new" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>➕</span> New Scout</a>
          <a href="/scouts/sections" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>🗂️</span> Sections</a>
          {isSuperAdmin && <a href="/admin" className="nav-item"><span>⚙️</span> Admin</a>}
          <div className="sidebar-footer">
            <button onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }} style={{
              marginTop: 10, background: 'none', border: '1px solid #2a4f38',
              color: '#6aaa80', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="main">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="page-title">Pest Monitoring Setup</div>
              <div className="page-sub">Configure which pests are monitored per farm and commodity.</div>
            </div>
            {farms.length > 1 && (
              <div className="farm-selector">
                <label>Farm</label>
                <select
                  value={selectedFarmId || ''}
                  onChange={e => { setSelectedFarmId(e.target.value); setEditingRowId(null) }}
                >
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>{f.full_name} ({f.code})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Commodity tabs */}
          <div className="tabs" style={{ marginBottom: 20 }}>
            {['POME', 'STONE', 'CITRUS'].map(code => (
              <button
                key={code}
                className={`tab${activeCommodity === code ? ' active' : ''}`}
                onClick={() => { setActiveCommodity(code); setEditingRowId(null); setLinkedPest(null); setPestSuggestions([]) }}
              >
                {code}
              </button>
            ))}
          </div>

          {/* Content area: table + optional add panel */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

            {/* Pest table */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="table-card">
                <div className="table-header">
                  <span className="table-header-title">
                    {activeCommodity} Pests
                    {configsLoading && <span style={{ color: '#9aaa9f', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>loading…</span>}
                  </span>
                  {isSuperAdmin && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      onClick={() => {
                      const willShow = !showAddPanel
                      setShowAddPanel(willShow)
                      setEditingRowId(null)
                      setAddError('')
                      setLinkedPest(null)
                      setPestSuggestions([])
                      if (willShow && activeCommodityObj) {
                        setAddForm(f => ({ ...f, commodityId: activeCommodityObj.id }))
                      }
                    }}
                    >
                      {showAddPanel ? '✕ Close' : '+ Add Pest'}
                    </button>
                  )}
                </div>

                {filteredRows.length === 0 ? (
                  <div className="empty-state">No pests configured for {activeCommodity} yet.</div>
                ) : (
                  <div className="pest-list">
                    <div className="pest-list-header">
                      {isSuperAdmin && <div style={{ width: 28, flexShrink: 0 }} />}
                      <div className="pest-list-header-cell" style={{ width: 90, flexShrink: 0 }}>Category</div>
                      <div className="pest-list-header-cell" style={{ flex: 1 }}>Pest</div>
                      <div className="pest-list-header-cell" style={{ width: 130, flexShrink: 0 }}>Method</div>
                      <div className="pest-list-header-cell" style={{ width: 80, flexShrink: 0, textAlign: 'center' }}>Farm Active</div>
                      {isSuperAdmin && <div className="pest-list-header-cell" style={{ width: 56, flexShrink: 0, textAlign: 'center' }}>Global</div>}
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={isSuperAdmin ? handleDragEnd : undefined}>
                      <SortableContext items={filteredRows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                        {filteredRows.map(row => (
                          <SortablePestRow
                            key={row.id}
                            row={row}
                            isSuperAdmin={isSuperAdmin}
                            isEditing={editingRowId === row.id}
                            editForm={editForm}
                            editSubmitting={editSubmitting}
                            editError={editError}
                            farmActive={isFarmActive(row.id)}
                            commodityCode={activeCommodity}
                            onStartEdit={() => startEdit(row)}
                            onSaveEdit={() => handleSaveEdit(row)}
                            onCancelEdit={() => setEditingRowId(null)}
                            onEditFormChange={updates => setEditForm(f => ({ ...f, ...updates }))}
                            onFarmToggle={() => handleFarmToggle(row.id)}
                            onGlobalToggle={() => handleGlobalToggle(row)}
                            onRemove={() => handleRemove(row)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </div>

              {isSuperAdmin && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#9aaa9f' }}>
                  Drag ⠿ to reorder. Click a row to edit its display label, method, or order.
                </div>
              )}
            </div>

            {/* Add Pest panel (super admin only) */}
            {isSuperAdmin && showAddPanel && (
              <div className="add-panel">
                <div className="panel-title">Add Pest</div>
                {addError && <div className="error-msg">{addError}</div>}
                <form onSubmit={handleAddPest}>
                  <div className="field" style={{ position: 'relative' }}>
                    <label>Name <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(canonical)</span></label>
                    {linkedPest ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1.5px solid #2a6e45', background: '#f0f7f3', fontSize: 13, color: '#1c3a2a', fontWeight: 500 }}>
                            {linkedPest.name}
                          </div>
                          <button type="button" onClick={() => { setLinkedPest(null); setAddForm(f => ({ ...f, name: '' })) }}
                            style={{ background: 'none', border: 'none', color: '#9aaa9f', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }} title="Clear — create new pest instead">×</button>
                        </div>
                        <div className="hint" style={{ color: '#2a6e45', marginTop: 5 }}>
                          Linking existing pest to this commodity — no duplicate created.
                        </div>
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={addForm.name}
                          onChange={e => handleNameChange(e.target.value)}
                          placeholder="e.g. Woolly Aphid"
                          autoComplete="off"
                          required
                        />
                        {pestSuggestions.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #e0ddd6', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.1)', zIndex: 20, overflow: 'hidden', marginTop: 2 }}>
                            <div style={{ padding: '5px 12px', fontSize: 10, color: '#9aaa9f', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f0ede6' }}>
                              Already exists — click to link
                            </div>
                            {pestSuggestions.map(p => (
                              <div key={p.id} onMouseDown={() => selectExistingPest(p)}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f0ede6' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f0f7f3')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                <span style={{ fontWeight: 500, color: '#1c3a2a' }}>{p.name}</span>
                                {p.scientific_name && <span style={{ fontSize: 11, color: '#9aaa9f', marginLeft: 6, fontStyle: 'italic' }}>{p.scientific_name}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="field">
                    <label>Display Label <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <input
                      type="text"
                      value={addForm.displayName}
                      onChange={e => setAddForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="Shown to scouts"
                    />
                    {addForm.observationMethod === 'leaf_inspection' && (
                      <div className="hint">Tip: include unit, e.g. "Red Mite (5 leaves)"</div>
                    )}
                  </div>
                  {!linkedPest && (
                  <div className="field">
                    <label>Scientific Name <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <input
                      type="text"
                      value={addForm.scientificName}
                      onChange={e => setAddForm(f => ({ ...f, scientificName: e.target.value }))}
                      placeholder="e.g. Eriosoma lanigerum"
                    />
                  </div>
                  )}
                  <div className="field">
                    <label>Commodity</label>
                    <select
                      value={addForm.commodityId}
                      onChange={e => setAddForm(f => ({ ...f, commodityId: e.target.value }))}
                      required
                    >
                      {commodities.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <select
                      value={addForm.category}
                      onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Observation Method</label>
                    <select
                      value={addForm.observationMethod}
                      onChange={e => setAddForm(f => ({ ...f, observationMethod: e.target.value }))}
                    >
                      {OBSERVATION_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    {addForm.observationMethod === 'leaf_inspection' && (
                      <div className="hint">5-point scale. Add unit in Display Label above.</div>
                    )}
                  </div>
                  <div className="field">
                    <label>Display Order</label>
                    <input
                      type="number"
                      value={addForm.displayOrder}
                      onChange={e => setAddForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={addSubmitting}>
                    {addSubmitting ? 'Adding…' : 'Add Pest'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

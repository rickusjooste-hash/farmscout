'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Commodity { id: string; code: string; name: string }
interface QcIssueRow {
  id: string
  commodity_id: string
  pest_id: string
  category: string
  display_name: string | null
  display_name_af: string | null
  display_order: number
  is_active: boolean
  pests: { id: string; name: string; name_af: string | null }
}

const s: Record<string, React.CSSProperties> = {
  page:      { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, sans-serif' },
  sidebar:   { width: 220, flexShrink: 0, background: '#1c3a2a', padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  logo:      { fontSize: 22, color: '#a8d5a2', marginBottom: 32, letterSpacing: '-0.5px' },
  navItem:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, color: '#8aab96', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', transition: 'all 0.15s' },
  navLabel:  { fontSize: 10, color: '#5a7a6a', padding: '16px 16px 4px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  main:      { flex: 1, padding: 40, overflowY: 'auto' },
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title:     { fontSize: 28, fontWeight: 700, color: '#1c3a2a', letterSpacing: '-0.5px' },
  pills:     { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  pill:      { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:{ padding: '6px 14px', borderRadius: 20, border: '1px solid #2a6e45', background: '#2a6e45', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  card:      { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
  rowBase:   { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f0ede6', background: '#fff' },
  rowDrag:   { opacity: 0.4 },
  dragHandle:{ cursor: 'grab', fontSize: 16, color: '#aaa', userSelect: 'none', flexShrink: 0, lineHeight: 1 },
  issueName: { flex: 1, minWidth: 0 },
  nameEn:    { fontSize: 14, fontWeight: 600, color: '#1c3a2a' },
  nameAf:    { fontSize: 12, color: '#9aaa9f', marginTop: 1 },
  catBtns:   { display: 'flex', gap: 4 },
  catBtn:    { padding: '4px 10px', borderRadius: 6, border: '1px solid #d4cfca', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  catPicking:{ padding: '4px 10px', borderRadius: 6, border: '1px solid #f5c842', background: '#fffbe6', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#7a5c00', fontWeight: 600 },
  catQc:     { padding: '4px 10px', borderRadius: 6, border: '1px solid #e85a4a', background: '#fff5f4', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#8a2020', fontWeight: 600 },
  activeChip:{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s' },
  empty:     { padding: '40px 24px', textAlign: 'center' as const, color: '#9aaa9f', fontSize: 14 },
}

function SortableRow({
  row, onCategoryChange, onActiveChange,
}: {
  row: QcIssueRow
  onCategoryChange: (id: string, cat: string) => void
  onActiveChange: (id: string, active: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  const rowStyle: React.CSSProperties = {
    ...s.rowBase,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <div ref={setNodeRef} style={rowStyle}>
      <span style={s.dragHandle} {...attributes} {...listeners}>⠿</span>
      <div style={s.issueName}>
        <div style={s.nameEn}>{row.display_name || row.pests?.name || '—'}</div>
        {(row.display_name_af || row.pests?.name_af) && (
          <div style={s.nameAf}>{row.display_name_af || row.pests?.name_af}</div>
        )}
      </div>
      <div style={s.catBtns}>
        <button
          style={row.category === 'picking_issue' ? s.catPicking : s.catBtn}
          onClick={() => onCategoryChange(row.id, 'picking_issue')}
        >
          Picking Issue
        </button>
        <button
          style={row.category === 'qc_issue' ? s.catQc : s.catBtn}
          onClick={() => onCategoryChange(row.id, 'qc_issue')}
        >
          QC Issue
        </button>
      </div>
      <button
        style={{
          ...s.activeChip,
          background: row.is_active ? '#e8f5e9' : '#f5f5f5',
          color: row.is_active ? '#2e7d32' : '#9e9e9e',
          borderColor: row.is_active ? '#a5d6a7' : '#e0e0e0',
        }}
        onClick={() => onActiveChange(row.id, !row.is_active)}
      >
        {row.is_active ? '● Active' : '○ Inactive'}
      </button>
    </div>
  )
}

export default function QcIssueSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { isSuperAdmin, contextLoaded } = useUserContext()

  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>('')
  const [rows, setRows] = useState<QcIssueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    if (!contextLoaded) return
    loadCommodities()
  }, [contextLoaded])

  useEffect(() => {
    if (selectedCommodityId) loadIssues()
  }, [selectedCommodityId])

  async function loadCommodities() {
    // Only show commodities that have QC/picking issues configured
    const { data } = await supabase
      .from('commodity_pests')
      .select('commodities(id, code, name)')
      .in('category', ['qc_issue', 'picking_issue'])
      .eq('is_active', true)

    // Deduplicate by commodity id
    const seen = new Set<string>()
    const list: Commodity[] = []
    for (const row of (data || []) as any[]) {
      const c = row.commodities
      if (c && !seen.has(c.id)) {
        seen.add(c.id)
        list.push(c)
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name))
    setCommodities(list)
    if (list.length > 0) setSelectedCommodityId(list[0].id)
  }

  async function loadIssues() {
    setLoading(true)
    const { data } = await supabase
      .from('commodity_pests')
      .select('id, commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active, pests(id, name, name_af)')
      .eq('commodity_id', selectedCommodityId)
      .in('category', ['qc_issue', 'picking_issue'])
      .order('display_order')

    // Deduplicate by (pest_name, category) — handles duplicate pest UUIDs
    const seen = new Set<string>()
    const deduped = (data || []).filter((r: any) => {
      const name = (r.display_name || r.pests?.name || '').toLowerCase()
      const key = `${name}:${r.category}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setRows(deduped as unknown as QcIssueRow[])
    setLoading(false)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = rows.findIndex(r => r.id === active.id)
    const newIndex = rows.findIndex(r => r.id === over.id)
    const reordered = arrayMove(rows, oldIndex, newIndex)
    setRows(reordered)

    setSaving(true)
    await fetch('/api/qc/settings/issues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'reorder',
        commodity_id: selectedCommodityId,
        ids: reordered.map(r => r.id),
      }),
    })
    setSaving(false)
  }

  async function handleCategoryChange(id: string, category: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, category } : r))
    await fetch('/api/qc/settings/issues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update', id, category }),
    })
  }

  async function handleActiveChange(id: string, is_active: boolean) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, is_active } : r))
    await fetch('/api/qc/settings/issues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update', id, is_active }),
    })
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
        <a href="/qc/settings/issues" style={{ ...s.navItem, background: '#2a4f38', color: '#a8d5a2' }}><span>🐛</span> Issue Setup</a>
        <a href="/qc/settings/size-bins" style={s.navItem}><span>📏</span> Size Bins</a>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <div style={s.header}>
          <div>
            <div style={s.title}>QC Issue Settings</div>
            <div style={{ fontSize: 14, color: '#9aaa9f', marginTop: 4 }}>
              Drag to reorder · toggle category and active status
              {saving && <span style={{ marginLeft: 12, color: '#f5c842' }}>Saving…</span>}
            </div>
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

        {/* Issue list */}
        <div style={s.card}>
          {/* Legend header */}
          <div style={{ ...s.rowBase, background: '#f7f5f0', borderBottom: '1px solid #e8e4dc' }}>
            <div style={{ width: 24 }} />
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Issue name</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 80 }}>Category</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.06em', width: 80, textAlign: 'right' }}>Status</div>
          </div>

          {loading ? (
            <div style={s.empty}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={s.empty}>No QC issues configured for this commodity.</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {rows.map(row => (
                  <SortableRow
                    key={row.id}
                    row={row}
                    onCategoryChange={handleCategoryChange}
                    onActiveChange={handleActiveChange}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </main>
    </div>
  )
}

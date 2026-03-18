'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import GanttChart, { type GanttTask } from '@/app/components/planning/GanttChart'
import DocumentUpload from '@/app/components/planning/DocumentUpload'
import ContactPicker, { type Contact } from '@/app/components/planning/ContactPicker'
import CostSummary from '@/app/components/planning/CostSummary'
import {
  calculateNetPlantableArea, calculateRowGeometry, calculateTreeCount,
  calculatePoleCount, calculateWireLength,
  generateOrchardLayoutKml, insetPolygon,
  GANTT_TEMPLATE, generateTaskDates,
  type RowGeometryResult, type PoleCountResult, type WireResult,
} from '@/lib/planning-calcs'
import { generateSoilGrid, gridToKmlFolder, type GridPoint } from '@/lib/soil-grid'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Orchard {
  id: string; name: string; farm_id: string; organisation_id: string
  commodity_id: string; variety: string | null; rootstock: string | null
  ha: number | null; plant_distance: number | null; row_width: number | null
  status: string; target_planting_date: string | null
  row_bearing: number | null; headland_width: number | null; side_headland_width: number | null
  pre_planning_notes: string | null
  commodities: { code: string; name: string } | null
  farms: { full_name: string } | null
}

interface Pollinator { id?: string; variety: string; rootstock: string; percentage: number; nursery: string }

type SectionKey = 'spec' | 'pollinators' | 'headlands' | 'tree_order' | 'netting' | 'poles' | 'wires' |
  'irrigation' | 'drainage' | 'soil_grid' | 'soil_prep' | 'fumigation' | 'cover_crop' | 'windbreak' | 'gantt' | 'cost'

const SECTION_LABELS: Record<SectionKey, string> = {
  spec: 'C1. Orchard Spec',
  pollinators: 'C2. Pollinators',
  headlands: 'C3. Headlands & Net Plantable Area',
  tree_order: 'C4. Tree Order',
  netting: 'C5. Netting Decision',
  poles: 'C6. Structure — Poles',
  wires: 'C7. Trellis Wires',
  irrigation: 'C8. Irrigation',
  drainage: 'C9. Drainage',
  soil_grid: 'C10. Soil Profile Holes',
  soil_prep: 'C11. Soil Prep & Chemistry',
  fumigation: 'C12. Fumigation',
  cover_crop: 'C13. Cover Crop',
  windbreak: 'C14. Windbreak',
  gantt: 'Timeline (Gantt)',
  cost: 'Cost Summary',
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid #e0ddd6',
  fontSize: 12, fontFamily: 'inherit', color: '#1a2a3a', background: '#fff',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#8a95a0', marginBottom: 2,
}
const rowStyle: React.CSSProperties = { display: 'flex', gap: 10 }
const fieldStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }
const calcStyle: React.CSSProperties = { fontSize: 12, color: '#2176d9', fontWeight: 600, padding: '4px 0' }

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PlanningDetailPage() {
  const supabase = createClient()
  const { allowed } = usePageGuard()
  const params = useParams()
  const orchardId = params.id as string

  // ── Data state ──
  const [orchard, setOrchard] = useState<Orchard | null>(null)
  const [spec, setSpec] = useState<Record<string, any>>({})
  const [pollinators, setPollinators] = useState<Pollinator[]>([])
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [boundary, setBoundary] = useState<any>(null)

  // ── UI state ──
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set(['spec', 'gantt']))
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null)
  const saveMsgRef = useRef<HTMLDivElement>(null)

  // ── Toggle accordion ──
  const toggle = useCallback((key: SectionKey) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  // ── Load orchard data ──
  useEffect(() => {
    if (!orchardId) return
    supabase
      .from('orchards')
      .select('id, name, farm_id, organisation_id, commodity_id, variety, rootstock, ha, plant_distance, row_width, status, target_planting_date, row_bearing, headland_width, side_headland_width, pre_planning_notes, commodities(code,name), farms(full_name)')
      .eq('id', orchardId)
      .single()
      .then(({ data }) => { if (data) setOrchard(data as any) })

    // Load boundary
    supabase.rpc('get_orchard_boundaries').then(({ data }) => {
      const match = (data as any[])?.find((b: any) => b.id === orchardId)
      if (match?.boundary) setBoundary(match.boundary)
    })
  }, [orchardId])

  // ── Load planning data ──
  const loadAll = useCallback(() => {
    if (!orchardId) return
    fetch(`/api/planning?orchard_id=${orchardId}&section=spec`).then(r => r.json()).then(d => setSpec(d || {}))
    fetch(`/api/planning?orchard_id=${orchardId}&section=pollinators`).then(r => r.json()).then(d => setPollinators(d || []))
    fetch(`/api/planning?orchard_id=${orchardId}&section=tasks`).then(r => r.json()).then(d => setTasks(d || []))
    fetch(`/api/planning?orchard_id=${orchardId}&section=documents`).then(r => r.json()).then(d => setDocuments(d || []))
    fetch(`/api/planning?orchard_id=${orchardId}&section=contacts`).then(r => r.json()).then(d => setContacts(d || []))
  }, [orchardId])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Computed values ──
  const polygonCoords = useMemo(() => {
    if (!boundary) return null
    if (boundary.type === 'Polygon') return boundary.coordinates
    if (boundary.type === 'MultiPolygon') return boundary.coordinates[0]
    return null
  }, [boundary])

  const headlandWidth = orchard?.headland_width ?? 6
  const sideHeadlandWidth = orchard?.side_headland_width ?? 0
  const plantDistance = orchard?.plant_distance ?? 0
  const rowWidth = orchard?.row_width ?? 0
  const rowBearing = orchard?.row_bearing ?? 0

  const rowGeometry: RowGeometryResult = useMemo(() => {
    if (!polygonCoords || rowWidth <= 0) return { numberOfRows: 0, rowLengths: [], rowLines: [], totalRowMetres: 0, avgRowLength: 0 }
    return calculateRowGeometry(polygonCoords, rowBearing, rowWidth, headlandWidth, sideHeadlandWidth)
  }, [polygonCoords, rowBearing, rowWidth, headlandWidth, sideHeadlandWidth])

  const { grossHa, netHa } = useMemo(() => {
    if (!polygonCoords) return { grossHa: orchard?.ha ?? 0, netHa: orchard?.ha ?? 0 }
    return calculateNetPlantableArea(polygonCoords, headlandWidth, rowGeometry, rowWidth)
  }, [polygonCoords, headlandWidth, orchard?.ha, rowGeometry, rowWidth])

  const treeCount = useMemo(() => {
    return calculateTreeCount(netHa, plantDistance, rowWidth, pollinators.map(p => ({ variety: p.variety, percentage: p.percentage })))
  }, [netHa, plantDistance, rowWidth, pollinators])

  const poleResult: PoleCountResult = useMemo(() => {
    return calculatePoleCount(
      rowGeometry,
      spec.inside_pole_frequency || 0,
      plantDistance,
      spec.pole_unit_cost_end || 0,
      spec.pole_unit_cost_inside || 0,
      spec.angled_pole_unit_cost || 0,
      spec.end_row_type === 'angled_support'
    )
  }, [rowGeometry, spec.inside_pole_frequency, plantDistance, spec.pole_unit_cost_end, spec.pole_unit_cost_inside, spec.angled_pole_unit_cost, spec.end_row_type])

  const wireResult: WireResult = useMemo(() => {
    return calculateWireLength(
      rowGeometry.totalRowMetres,
      spec.wire_lines || 0,
      spec.wire_bottom_height || 0.6,
      spec.inside_pole_length || 3.0,
      spec.wire_unit_cost_per_m || 0
    )
  }, [rowGeometry.totalRowMetres, spec.wire_lines, spec.wire_bottom_height, spec.inside_pole_length, spec.wire_unit_cost_per_m])

  const soilGrid: GridPoint[] = useMemo(() => {
    if (!polygonCoords?.[0]) return []
    return generateSoilGrid(polygonCoords[0])
  }, [polygonCoords])

  // ── Save helpers ──
  async function saveOrchardField(fields: Record<string, any>) {
    setOrchard(prev => prev ? { ...prev, ...fields } : prev)
    await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-orchard', data: { id: orchardId, ...fields } }),
    })
    flashSave()
  }

  async function saveSpec(fields: Record<string, any>) {
    const merged = { ...spec, ...fields }
    setSpec(merged)
    await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-spec', data: { orchard_id: orchardId, ...merged } }),
    })
    flashSave()
  }

  async function savePollinators(list: Pollinator[]) {
    await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-pollinators', orchard_id: orchardId, pollinators: list }),
    })
    setPollinators(list)
    flashSave()
  }

  async function handleStatusToggle(taskId: string, newStatus: 'pending' | 'in_progress' | 'completed') {
    await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-task', data: { id: taskId, status: newStatus } }),
    })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  async function generateGanttFromTemplate() {
    if (!orchard?.target_planting_date) { alert('Set a target planting date first'); return }
    if (tasks.length > 0 && !confirm('Replace existing tasks with template?')) return
    const generated = generateTaskDates(GANTT_TEMPLATE, new Date(orchard.target_planting_date))
    await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate-tasks', orchard_id: orchardId, tasks: generated }),
    })
    loadAll()
  }

  function exportLayoutKml() {
    if (!polygonCoords || rowGeometry.numberOfRows === 0) { alert('Set row bearing and row width first'); return }
    const kml = generateOrchardLayoutKml(
      orchard?.name || 'Orchard',
      polygonCoords,
      rowGeometry,
      headlandWidth,
      headlandWidth > 0 ? insetPolygon(polygonCoords[0], headlandWidth) : undefined
    )
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(orchard?.name || 'orchard').replace(/[^a-zA-Z0-9_-]/g, '_')}_layout.kml`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportSoilGridKml() {
    if (soilGrid.length === 0) { alert('No grid points (draw a boundary first)'); return }
    const folder = gridToKmlFolder(soilGrid, orchard?.name || 'Orchard')
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n  <name>${orchard?.name || 'Orchard'} — Soil Grid</name>\n${folder}\n</Document>\n</kml>`
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(orchard?.name || 'orchard').replace(/[^a-zA-Z0-9_-]/g, '_')}_soil_grid.kml`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── PDF export helper ──
  function exportPdf(title: string, html: string) {
    const w = window.open('', '_blank')
    if (!w) { alert('Pop-up blocked — allow pop-ups for this site'); return }
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #1a2a3a; font-size: 13px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; color: #666; margin-bottom: 16px; font-weight: 400; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; color: #666; }
        td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
        .right { text-align: right; }
        .bold { font-weight: 600; }
        .total td { border-top: 2px solid #333; font-weight: 700; }
        .meta { font-size: 12px; color: #888; margin-bottom: 16px; }
        .section { margin-top: 20px; margin-bottom: 8px; font-weight: 600; font-size: 14px; }
        @media print { body { padding: 16px; } }
      </style>
    </head><body>${html}
      <script>window.onload=function(){window.print()}</script>
    </body></html>`)
    w.document.close()
  }

  function exportTreeOrderPdf() {
    const farmName = orchard?.farms?.full_name || ''
    const orchardName = orchard?.name || ''
    const mainPct = 100 - pollinators.reduce((s, p) => s + p.percentage, 0)
    const treeTypeMap: Record<string, string> = { '2yr_feathered': '2-year feathered (single leader)', '2yr_2leader': '2-year 2-leader (planar/bi-axis)', '1yr_maiden': '1-year maiden', '1yr_2leader': '1-year 2-leader (guyot)', 'sleeping_eye': 'Sleeping eye' }
    const treeType = treeTypeMap[spec.tree_type || ''] || spec.tree_type || '—'

    const rows = [
      `<tr class="bold"><td>${orchard?.variety || 'Main variety'}${spec.tree_clone ? ` (${spec.tree_clone})` : ''}</td><td>${orchard?.rootstock || '—'}</td><td class="right">${mainPct}%</td><td class="right bold">${treeCount.mainVarietyTrees.toLocaleString()}</td><td>${spec.main_nursery || '—'}</td></tr>`,
      ...treeCount.pollinatorAllocations.map((pa, i) =>
        `<tr><td>${pa.variety}</td><td>${pollinators[i]?.rootstock || orchard?.rootstock || '—'}</td><td class="right">${pa.percentage}%</td><td class="right bold">${pa.trees.toLocaleString()}</td><td>${pollinators[i]?.nursery || '—'}</td></tr>`
      ),
      `<tr class="total"><td colspan="3">Total</td><td class="right">${treeCount.totalTrees.toLocaleString()}</td><td></td></tr>`
    ].join('')

    exportPdf(`Tree Order — ${orchardName}`, `
      <h1>Tree Order — ${orchardName}</h1>
      <h2>${farmName}</h2>
      <div class="meta">
        Area: ${netHa.toFixed(2)} ha (net plantable) · Plant distance: ${orchard?.plant_distance || '—'} m · Row width: ${orchard?.row_width || '—'} m<br>
        Tree type: ${treeType} · Target planting: ${orchard?.target_planting_date || '—'}<br>
        Order date: ${spec.tree_order_date || '—'} · Expected delivery: ${spec.tree_delivery_date || '—'}
      </div>
      <table><thead><tr><th>Variety</th><th>Rootstock</th><th class="right">%</th><th class="right">Trees</th><th>Nursery</th></tr></thead><tbody>${rows}</tbody></table>
      ${spec.tree_deposit ? `<p>Deposit: R ${Number(spec.tree_deposit).toLocaleString()}</p>` : ''}
    `)
  }

  function exportPoleOrderPdf() {
    const farmName = orchard?.farms?.full_name || ''
    const orchardName = orchard?.name || ''
    exportPdf(`Pole Order — ${orchardName}`, `
      <h1>Pole Order — ${orchardName}</h1>
      <h2>${farmName}</h2>
      <div class="meta">
        Area: ${netHa.toFixed(2)} ha · Rows: ${rowGeometry.numberOfRows} · Total row length: ${rowGeometry.totalRowMetres.toFixed(0)} m<br>
        Plant distance: ${orchard?.plant_distance || '—'} m · Row width: ${orchard?.row_width || '—'} m<br>
        Netting: ${spec.netting_required ? 'Yes (' + (spec.netting_type || '') + ' ' + (spec.netting_structure || '') + ')' : 'No'}
      </div>
      <table><thead><tr><th>Type</th><th>Length (m)</th><th>Diameter (mm)</th><th>Material</th><th class="right">Qty</th><th class="right">Unit Cost</th><th class="right">Total</th></tr></thead><tbody>
        <tr><td>End poles</td><td>${spec.end_pole_length || '—'}</td><td>${spec.end_pole_diameter || '—'}</td><td>${spec.end_pole_material || '—'}</td><td class="right bold">${poleResult.endPoles}</td><td class="right">${spec.pole_unit_cost_end ? 'R ' + Number(spec.pole_unit_cost_end).toLocaleString() : '—'}</td><td class="right">${poleResult.endPoleCost ? 'R ' + poleResult.endPoleCost.toLocaleString() : '—'}</td></tr>
        <tr><td>Inside poles (every ${spec.inside_pole_frequency || '—'} trees)</td><td>${spec.inside_pole_length || '—'}</td><td>${spec.inside_pole_diameter || '—'}</td><td>${spec.inside_pole_material || '—'}</td><td class="right bold">${poleResult.insidePoles}</td><td class="right">${spec.pole_unit_cost_inside ? 'R ' + Number(spec.pole_unit_cost_inside).toLocaleString() : '—'}</td><td class="right">${poleResult.insidePoleCost ? 'R ' + poleResult.insidePoleCost.toLocaleString() : '—'}</td></tr>
        ${poleResult.angledPoles > 0 ? `<tr><td>Angled support poles</td><td>${spec.angled_pole_length || '—'}</td><td>${spec.angled_pole_diameter || '—'}</td><td>${spec.angled_pole_material || '—'}</td><td class="right bold">${poleResult.angledPoles}</td><td class="right">${spec.angled_pole_unit_cost ? 'R ' + Number(spec.angled_pole_unit_cost).toLocaleString() : '—'}</td><td class="right">${poleResult.angledPoleCost ? 'R ' + poleResult.angledPoleCost.toLocaleString() : '—'}</td></tr>` : ''}
        <tr class="total"><td colspan="4">Total</td><td class="right">${poleResult.totalPoles}</td><td></td><td class="right">${poleResult.totalPoleCost ? 'R ' + poleResult.totalPoleCost.toLocaleString() : '—'}</td></tr>
      </tbody></table>
      <p>End-of-row type: ${spec.end_row_type === 'angled_support' ? 'Angled support pole' : spec.end_row_type === 'wire_anchor' ? 'Wire anchor outside' : '—'}</p>
    `)
  }

  function exportNettingPdf() {
    const farmName = orchard?.farms?.full_name || ''
    const orchardName = orchard?.name || ''
    exportPdf(`Netting Specification — ${orchardName}`, `
      <h1>Netting Specification — ${orchardName}</h1>
      <h2>${farmName}</h2>
      <div class="meta">
        Area: ${grossHa.toFixed(2)} ha (gross) / ${netHa.toFixed(2)} ha (net plantable)<br>
        Rows: ${rowGeometry.numberOfRows} · Total row length: ${rowGeometry.totalRowMetres.toFixed(0)} m · Row width: ${orchard?.row_width || '—'} m
      </div>
      <table><thead><tr><th>Item</th><th>Value</th></tr></thead><tbody>
        <tr><td>Netting type</td><td class="bold">${spec.netting_type || '—'}</td></tr>
        <tr><td>Structure type</td><td class="bold">${spec.netting_structure || '—'}</td></tr>
        <tr><td>Bay type</td><td class="bold">${spec.netting_bay_type || '—'}</td></tr>
        <tr><td>Contractor</td><td>${spec.netting_contractor || '—'}</td></tr>
        <tr><td>Booking date</td><td>${spec.netting_booking_date || '—'}</td></tr>
        <tr><td>Estimated cost</td><td class="bold">${spec.netting_cost ? 'R ' + Number(spec.netting_cost).toLocaleString() : '—'}</td></tr>
      </tbody></table>
    `)
  }

  function exportFumigationPdf() {
    const farmName = orchard?.farms?.full_name || ''
    const orchardName = orchard?.name || ''
    exportPdf(`Fumigation Specification — ${orchardName}`, `
      <h1>Fumigation Specification — ${orchardName}</h1>
      <h2>${farmName}</h2>
      <div class="meta">
        Area: ${grossHa.toFixed(2)} ha (gross) / ${netHa.toFixed(2)} ha (net plantable)<br>
        Rows: ${rowGeometry.numberOfRows} · Avg row length: ${rowGeometry.avgRowLength.toFixed(0)} m · Total row length: ${rowGeometry.totalRowMetres.toFixed(0)} m<br>
        Row width: ${orchard?.row_width || '—'} m
      </div>
      <table><thead><tr><th>Item</th><th>Value</th></tr></thead><tbody>
        <tr><td>Fumigant type</td><td class="bold">${spec.fumigant_type || '—'}</td></tr>
        <tr><td>Service provider</td><td>${spec.fumigation_provider || '—'}</td></tr>
        <tr><td>Booked date</td><td>${spec.fumigation_booked_date || '—'}</td></tr>
        <tr><td>Estimated cost</td><td class="bold">${spec.fumigation_cost ? 'R ' + Number(spec.fumigation_cost).toLocaleString() : '—'}</td></tr>
      </tbody></table>
    `)
  }

  function flashSave() {
    const el = saveMsgRef.current
    if (!el) return
    el.style.opacity = '1'
    el.textContent = 'Saved'
    setTimeout(() => { if (el) el.style.opacity = '0' }, 1500)
  }

  // ── Progress ──
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const progressPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

  if (!allowed) return null

  // ── Accordion section helper (plain function, NOT a component — avoids remount on re-render) ──
  function renderSection(id: SectionKey, children: React.ReactNode) {
    const open = openSections.has(id)
    return (
      <div key={id} style={{ borderBottom: '1px solid #e8e4dc' }}>
        <button
          onClick={() => toggle(id)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: open ? '#f9f9f6' : '#fff', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#1a2a3a',
            textAlign: 'left',
          }}
        >
          {SECTION_LABELS[id]}
          <span style={{ fontSize: 12, color: '#aaa', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
        </button>
        {open && <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>}
      </div>
    )
  }

  // ── Render ──
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f1eb; }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <a href="/orchards" style={{ color: '#2176d9', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Orchards</a>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#1a2a3a', margin: 0 }}>
              {orchard?.name || 'Loading...'}
            </h1>
            <div style={{ fontSize: 12, color: '#8a95a0' }}>
              {orchard?.farms?.full_name} · {orchard?.commodities?.name} · {orchard?.variety}
              {orchard?.ha ? ` · ${orchard.ha} ha` : ''}
            </div>
          </div>
          <span style={{ padding: '4px 12px', background: '#f0a500', color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
            PLANNING
          </span>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8a95a0', marginBottom: 4 }}>
              <span>{completedTasks} / {tasks.length} tasks completed</span>
              <span>{progressPct}%</span>
            </div>
            <div style={{ height: 6, background: '#e8e4dc', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: '#4caf72', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Save indicator — uses ref to avoid re-renders */}
        <div ref={saveMsgRef} style={{ position: 'fixed', top: 16, right: 16, background: '#4caf72', color: '#fff', padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, zIndex: 9000, opacity: 0, transition: 'opacity 0.3s', pointerEvents: 'none' }} />

        {/* Accordion sections */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e4dc', overflow: 'hidden' }}>

          {/* C1. Orchard Spec */}
          {renderSection('spec', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Target Planting Date</div>
                <input type="date" style={inputStyle} value={orchard?.target_planting_date || ''}
                  onChange={e => saveOrchardField({ target_planting_date: e.target.value || null })} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Row Bearing (degrees)</div>
                <input type="number" style={inputStyle} min="0" max="360" step="1"
                  value={orchard?.row_bearing ?? ''} placeholder="e.g. 315"
                  onBlur={e => saveOrchardField({ row_bearing: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setOrchard(prev => prev ? { ...prev, row_bearing: e.target.value ? parseFloat(e.target.value) : null } : prev)} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Plant Distance (m)</div>
                <input type="number" style={inputStyle} step="0.1" value={orchard?.plant_distance ?? ''}
                  onBlur={e => saveOrchardField({ plant_distance: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setOrchard(prev => prev ? { ...prev, plant_distance: e.target.value ? parseFloat(e.target.value) : null } : prev)} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Row Width (m)</div>
                <input type="number" style={inputStyle} step="0.1" value={orchard?.row_width ?? ''}
                  onBlur={e => saveOrchardField({ row_width: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setOrchard(prev => prev ? { ...prev, row_width: e.target.value ? parseFloat(e.target.value) : null } : prev)} />
              </div>
            </div>
            {rowGeometry.numberOfRows > 0 && (
              <div style={{ background: '#f0f4fa', borderRadius: 6, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={calcStyle}>Auto-calculated from polygon + bearing:</div>
                  <button onClick={exportLayoutKml} style={{ padding: '4px 12px', background: '#1a4ba0', color: '#a0c4f0', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    Export Layout KML
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: '#8a95a0' }}>Rows:</span> <strong>{rowGeometry.numberOfRows}</strong></div>
                  <div><span style={{ color: '#8a95a0' }}>Avg length:</span> <strong>{rowGeometry.avgRowLength.toFixed(0)} m</strong></div>
                  <div><span style={{ color: '#8a95a0' }}>Total row m:</span> <strong>{rowGeometry.totalRowMetres.toFixed(0)}</strong></div>
                </div>
              </div>
            )}
            <div>
              <div style={labelStyle}>Pre-planning Notes</div>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                placeholder="Water rights, variety licensing, environmental, replant history..."
                value={orchard?.pre_planning_notes || ''}
                onBlur={e => saveOrchardField({ pre_planning_notes: e.target.value || null })}
                onChange={e => setOrchard(prev => prev ? { ...prev, pre_planning_notes: e.target.value } : prev)} />
            </div>
            <DocumentUpload orchardId={orchardId} step="spec" documents={documents} onUploaded={loadAll} />
          </>)}

          {/* C2. Pollinators */}
          {renderSection('pollinators', <>
            {pollinators.map((p, i) => (
              <div key={i} style={{ ...rowStyle, alignItems: 'end' }}>
                <div style={{ ...fieldStyle, flex: 2 }}>
                  <div style={labelStyle}>Variety</div>
                  <input style={inputStyle} value={p.variety}
                    onChange={e => { const list = [...pollinators]; list[i] = { ...p, variety: e.target.value }; setPollinators(list) }} />
                </div>
                <div style={fieldStyle}>
                  <div style={labelStyle}>Rootstock</div>
                  <input style={inputStyle} value={p.rootstock || ''} placeholder={orchard?.rootstock || ''}
                    onChange={e => { const list = [...pollinators]; list[i] = { ...p, rootstock: e.target.value }; setPollinators(list) }} />
                </div>
                <div style={fieldStyle}>
                  <div style={labelStyle}>% Allocation</div>
                  <input type="number" style={inputStyle} min="1" max="50" value={p.percentage}
                    onChange={e => { const list = [...pollinators]; list[i] = { ...p, percentage: parseFloat(e.target.value) || 0 }; setPollinators(list) }} />
                </div>
                <div style={{ ...fieldStyle, flex: 2 }}>
                  <div style={labelStyle}>Nursery</div>
                  <input style={inputStyle} value={p.nursery}
                    onChange={e => { const list = [...pollinators]; list[i] = { ...p, nursery: e.target.value }; setPollinators(list) }} />
                </div>
                <button onClick={() => { const list = pollinators.filter((_, j) => j !== i); setPollinators(list) }}
                  style={{ padding: '5px 8px', background: 'none', border: 'none', color: '#e85a4a', cursor: 'pointer', fontSize: 16 }}>x</button>
              </div>
            ))}
            {pollinators.length < 3 && (
              <button onClick={() => setPollinators([...pollinators, { variety: '', rootstock: '', percentage: 10, nursery: '' }])}
                style={{ background: 'none', border: 'none', color: '#2176d9', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                + Add pollinator
              </button>
            )}
            {pollinators.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#8a95a0' }}>
                  Main variety: {100 - pollinators.reduce((s, p) => s + p.percentage, 0)}%
                </div>
                <button onClick={() => savePollinators(pollinators)}
                  style={{ padding: '6px 16px', background: '#2176d9', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                  Save Pollinators
                </button>
              </>
            )}
          </>)}

          {/* C3. Headlands */}
          {renderSection('headlands', <>
            <div style={{ fontSize: 12, color: '#8a95a0', marginBottom: 4 }}>
              Row-end headland = turning space at top/bottom of rows. Side headland = gap to adjacent orchard (0 if neighbour shares boundary).
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Row-end Headland (m)</div>
                <input type="number" style={inputStyle} step="0.5" value={orchard?.headland_width ?? 6}
                  onBlur={e => saveOrchardField({ headland_width: e.target.value ? parseFloat(e.target.value) : 6 })}
                  onChange={e => setOrchard(prev => prev ? { ...prev, headland_width: e.target.value ? parseFloat(e.target.value) : 6 } : prev)} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Side Headland (m)</div>
                <input type="number" style={inputStyle} step="0.5" value={orchard?.side_headland_width ?? 0}
                  onBlur={e => saveOrchardField({ side_headland_width: e.target.value ? parseFloat(e.target.value) : 0 })}
                  onChange={e => setOrchard(prev => prev ? { ...prev, side_headland_width: e.target.value ? parseFloat(e.target.value) : 0 } : prev)} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Gross Area (ha)</div>
                <div style={{ ...inputStyle, background: '#f9f9f6', cursor: 'default' }}>{grossHa.toFixed(2)}</div>
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Net Plantable Area (ha)</div>
                <div style={{ ...inputStyle, background: '#f0f4fa', fontWeight: 600, color: '#2176d9', cursor: 'default' }}>{netHa.toFixed(2)}</div>
              </div>
            </div>
          </>)}

          {/* C4. Tree Order */}
          {renderSection('tree_order', <>
            {treeCount.totalTrees > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={calcStyle}>Tree Order Breakdown</div>
                  <button onClick={() => exportTreeOrderPdf()} style={{ padding: '4px 12px', background: '#1a4ba0', color: '#a0c4f0', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    Export PDF
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e8e4dc' }}>
                      <th style={{ textAlign: 'left', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' }}>Variety</th>
                      <th style={{ textAlign: 'left', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' }}>Rootstock</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' }}>%</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' }}>Trees</th>
                      <th style={{ textAlign: 'left', padding: '6px 4px', fontSize: 10, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' }}>Nursery</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f7f5f0', fontWeight: 500 }}>
                      <td style={{ padding: '6px 4px' }}>{orchard?.variety || 'Main variety'} {spec.tree_clone ? `(${spec.tree_clone})` : ''}</td>
                      <td style={{ padding: '6px 4px' }}>{orchard?.rootstock || '—'}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right' }}>{100 - pollinators.reduce((s, p) => s + p.percentage, 0)}%</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{treeCount.mainVarietyTrees.toLocaleString()}</td>
                      <td style={{ padding: '6px 4px' }}>{spec.main_nursery || '—'}</td>
                    </tr>
                    {treeCount.pollinatorAllocations.map((pa, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f7f5f0', color: '#666' }}>
                        <td style={{ padding: '6px 4px' }}>{pa.variety}</td>
                        <td style={{ padding: '6px 4px' }}>{pollinators[i]?.rootstock || orchard?.rootstock || '—'}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right' }}>{pa.percentage}%</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600 }}>{pa.trees.toLocaleString()}</td>
                        <td style={{ padding: '6px 4px' }}>{pollinators[i]?.nursery || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #1a2a3a' }}>
                      <td colSpan={3} style={{ padding: '6px 4px', fontWeight: 700 }}>Total</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700 }}>{treeCount.totalTrees.toLocaleString()}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Tree Type</div>
                <select style={inputStyle} value={spec.tree_type || ''}
                  onChange={e => saveSpec({ tree_type: e.target.value || null })}>
                  <option value="">—</option>
                  <option value="2yr_feathered">2-year feathered (single leader)</option>
                  <option value="2yr_2leader">2-year 2-leader (planar/bi-axis)</option>
                  <option value="1yr_maiden">1-year maiden</option>
                  <option value="1yr_2leader">1-year 2-leader (guyot)</option>
                  <option value="sleeping_eye">Sleeping eye</option>
                </select>
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Clone / Strain</div>
                <input style={inputStyle} value={spec.tree_clone || ''} placeholder="e.g. Brookfield, Kiku"
                  onBlur={e => saveSpec({ tree_clone: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, tree_clone: e.target.value }))} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Main Nursery</div>
                <input style={inputStyle} value={spec.main_nursery || ''}
                  onBlur={e => saveSpec({ main_nursery: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, main_nursery: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Qty</div>
                <input type="number" style={inputStyle} value={spec.main_nursery_qty || ''}
                  onBlur={e => saveSpec({ main_nursery_qty: e.target.value ? parseInt(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, main_nursery_qty: e.target.value }))} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Second Nursery (optional)</div>
                <input style={inputStyle} value={spec.second_nursery || ''}
                  onBlur={e => saveSpec({ second_nursery: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, second_nursery: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Qty</div>
                <input type="number" style={inputStyle} value={spec.second_nursery_qty || ''}
                  onBlur={e => saveSpec({ second_nursery_qty: e.target.value ? parseInt(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, second_nursery_qty: e.target.value }))} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Order Date</div>
                <input type="date" style={inputStyle} value={spec.tree_order_date || ''}
                  onChange={e => saveSpec({ tree_order_date: e.target.value || null })} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Expected Delivery</div>
                <input type="date" style={inputStyle} value={spec.tree_delivery_date || ''}
                  onChange={e => saveSpec({ tree_delivery_date: e.target.value || null })} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Deposit (R)</div>
                <input type="number" style={inputStyle} value={spec.tree_deposit || ''}
                  onBlur={e => saveSpec({ tree_deposit: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, tree_deposit: e.target.value }))} />
              </div>
            </div>
            <DocumentUpload orchardId={orchardId} step="tree_order" documents={documents} onUploaded={loadAll} />
          </>)}

          {/* C5. Netting */}
          {renderSection('netting', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Netting Required</div>
                <select style={inputStyle} value={spec.netting_required ? 'yes' : 'no'}
                  onChange={e => saveSpec({ netting_required: e.target.value === 'yes' })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
            {spec.netting_required && (
              <>
                <div style={rowStyle}>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Netting Type</div>
                    <select style={inputStyle} value={spec.netting_type || ''}
                      onChange={e => saveSpec({ netting_type: e.target.value || null })}>
                      <option value="">—</option>
                      <option value="crystal">Crystal</option>
                      <option value="white">White</option>
                      <option value="coloured">Coloured</option>
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Structure Type</div>
                    <select style={inputStyle} value={spec.netting_structure || ''}
                      onChange={e => saveSpec({ netting_structure: e.target.value || null })}>
                      <option value="">—</option>
                      <option value="flat_top">Flat top</option>
                      <option value="peaked">Peaked</option>
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Bay Type</div>
                    <select style={inputStyle} value={spec.netting_bay_type || ''}
                      onChange={e => saveSpec({ netting_bay_type: e.target.value || null })}>
                      <option value="">—</option>
                      <option value="single_bay">Single-bay</option>
                      <option value="multi_bay">Multi-bay</option>
                    </select>
                  </div>
                </div>
                <div style={rowStyle}>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Contractor</div>
                    <input style={inputStyle} value={spec.netting_contractor || ''}
                      onBlur={e => saveSpec({ netting_contractor: e.target.value || null })}
                      onChange={e => setSpec(s => ({ ...s, netting_contractor: e.target.value }))} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Booking Date</div>
                    <input type="date" style={inputStyle} value={spec.netting_booking_date || ''}
                      onChange={e => saveSpec({ netting_booking_date: e.target.value || null })} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Est. Cost (R)</div>
                    <input type="number" style={inputStyle} value={spec.netting_cost || ''}
                      onBlur={e => saveSpec({ netting_cost: e.target.value ? parseFloat(e.target.value) : null })}
                      onChange={e => setSpec(s => ({ ...s, netting_cost: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            {spec.netting_required && (
              <button onClick={exportNettingPdf} style={{ padding: '4px 12px', background: '#1a4ba0', color: '#a0c4f0', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>Export PDF</button>
            )}
            <DocumentUpload orchardId={orchardId} step="netting" documents={documents} onUploaded={loadAll} />
          </>)}

          {/* C6. Poles */}
          {renderSection('poles', <>
            {spec.netting_required === false && !spec.netting_required && (
              <div style={{ fontSize: 12, color: '#f0a500', fontWeight: 600, padding: '4px 0' }}>
                Complete the Netting Decision (C5) first — pole spec depends on netting choice.
              </div>
            )}
            {spec.netting_required && (
              <div style={{ fontSize: 12, color: '#9370DB', fontWeight: 500, background: '#f5f0ff', borderRadius: 6, padding: 8 }}>
                Netting = YES — use longer, thicker poles (recommended: end poles 5.5m+, inside 5.0m+)
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2a3a', marginTop: 4 }}>End Poles</div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Length (m)</div>
                <input type="number" style={inputStyle} step="0.1" value={spec.end_pole_length || ''}
                  onBlur={e => saveSpec({ end_pole_length: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, end_pole_length: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Diameter (mm)</div>
                <input type="number" style={inputStyle} value={spec.end_pole_diameter || ''}
                  onBlur={e => saveSpec({ end_pole_diameter: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, end_pole_diameter: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Material</div>
                <input style={inputStyle} value={spec.end_pole_material || ''} placeholder="CCA pine, concrete..."
                  onBlur={e => saveSpec({ end_pole_material: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, end_pole_material: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Unit Cost (R)</div>
                <input type="number" style={inputStyle} value={spec.pole_unit_cost_end || ''}
                  onBlur={e => saveSpec({ pole_unit_cost_end: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, pole_unit_cost_end: e.target.value }))} />
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2a3a', marginTop: 8 }}>Inside Poles</div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Length (m)</div>
                <input type="number" style={inputStyle} step="0.1" value={spec.inside_pole_length || ''}
                  onBlur={e => saveSpec({ inside_pole_length: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, inside_pole_length: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Diameter (mm)</div>
                <input type="number" style={inputStyle} value={spec.inside_pole_diameter || ''}
                  onBlur={e => saveSpec({ inside_pole_diameter: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, inside_pole_diameter: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Material</div>
                <input style={inputStyle} value={spec.inside_pole_material || ''}
                  onBlur={e => saveSpec({ inside_pole_material: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, inside_pole_material: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Unit Cost (R)</div>
                <input type="number" style={inputStyle} value={spec.pole_unit_cost_inside || ''}
                  onBlur={e => saveSpec({ pole_unit_cost_inside: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, pole_unit_cost_inside: e.target.value }))} />
              </div>
            </div>

            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Inside Pole Frequency (every Nth tree)</div>
                <input type="number" style={inputStyle} value={spec.inside_pole_frequency || ''}
                  onBlur={e => saveSpec({ inside_pole_frequency: e.target.value ? parseInt(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, inside_pole_frequency: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>End-of-row Type</div>
                <select style={inputStyle} value={spec.end_row_type || ''}
                  onChange={e => saveSpec({ end_row_type: e.target.value || null })}>
                  <option value="">—</option>
                  <option value="angled_support">Angled support pole</option>
                  <option value="wire_anchor">Wire anchor outside</option>
                </select>
              </div>
            </div>

            {spec.end_row_type === 'angled_support' && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2a3a', marginTop: 8 }}>Angled Support Poles (1 per row end = same qty as end poles)</div>
                <div style={rowStyle}>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Length (m)</div>
                    <input type="number" style={inputStyle} step="0.1" value={spec.angled_pole_length || ''}
                      onBlur={e => saveSpec({ angled_pole_length: e.target.value ? parseFloat(e.target.value) : null })}
                      onChange={e => setSpec(s => ({ ...s, angled_pole_length: e.target.value }))} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Diameter (mm)</div>
                    <input type="number" style={inputStyle} value={spec.angled_pole_diameter || ''}
                      onBlur={e => saveSpec({ angled_pole_diameter: e.target.value ? parseFloat(e.target.value) : null })}
                      onChange={e => setSpec(s => ({ ...s, angled_pole_diameter: e.target.value }))} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Material</div>
                    <input style={inputStyle} value={spec.angled_pole_material || ''}
                      onBlur={e => saveSpec({ angled_pole_material: e.target.value || null })}
                      onChange={e => setSpec(s => ({ ...s, angled_pole_material: e.target.value }))} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Unit Cost (R)</div>
                    <input type="number" style={inputStyle} value={spec.angled_pole_unit_cost || ''}
                      onBlur={e => saveSpec({ angled_pole_unit_cost: e.target.value ? parseFloat(e.target.value) : null })}
                      onChange={e => setSpec(s => ({ ...s, angled_pole_unit_cost: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {poleResult.totalPoles > 0 && (
              <div style={{ background: '#f0f4fa', borderRadius: 6, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={calcStyle}>Auto-calculated pole quantities:</div>
                  <button onClick={exportPoleOrderPdf} style={{ padding: '4px 12px', background: '#1a4ba0', color: '#a0c4f0', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Export PDF</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: poleResult.angledPoles > 0 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: '#8a95a0' }}>End poles:</span> <strong>{poleResult.endPoles}</strong></div>
                  <div><span style={{ color: '#8a95a0' }}>Inside poles:</span> <strong>{poleResult.insidePoles}</strong></div>
                  {poleResult.angledPoles > 0 && (
                    <div><span style={{ color: '#8a95a0' }}>Angled support:</span> <strong>{poleResult.angledPoles}</strong></div>
                  )}
                  <div><span style={{ color: '#8a95a0' }}>Total:</span> <strong>{poleResult.totalPoles}</strong></div>
                </div>
                {poleResult.totalPoleCost > 0 && (
                  <div style={{ fontSize: 12, marginTop: 4 }}><span style={{ color: '#8a95a0' }}>Total cost:</span> <strong>R {poleResult.totalPoleCost.toLocaleString()}</strong></div>
                )}
              </div>
            )}
            <DocumentUpload orchardId={orchardId} step="poles" documents={documents} onUploaded={loadAll} />
          </>)}

          {/* C7. Wires */}
          {renderSection('wires', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Number of Wire Lines</div>
                <input type="number" style={inputStyle} min="1" max="8" value={spec.wire_lines || ''}
                  onBlur={e => saveSpec({ wire_lines: e.target.value ? parseInt(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, wire_lines: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Wire Gauge / Type</div>
                <input style={inputStyle} value={spec.wire_gauge || ''} placeholder="e.g. 2.5mm HT steel"
                  onBlur={e => saveSpec({ wire_gauge: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, wire_gauge: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Bottom Wire Height (m)</div>
                <input type="number" style={inputStyle} step="0.05" value={spec.wire_bottom_height ?? 0.6}
                  onBlur={e => saveSpec({ wire_bottom_height: e.target.value ? parseFloat(e.target.value) : 0.6 })}
                  onChange={e => setSpec(s => ({ ...s, wire_bottom_height: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Cost per Metre (R)</div>
                <input type="number" style={inputStyle} value={spec.wire_unit_cost_per_m || ''}
                  onBlur={e => saveSpec({ wire_unit_cost_per_m: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, wire_unit_cost_per_m: e.target.value }))} />
              </div>
            </div>
            {wireResult.totalWireLength > 0 && (
              <div style={{ background: '#f0f4fa', borderRadius: 6, padding: 10 }}>
                <div style={calcStyle}>Auto-calculated wire quantities:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: '#8a95a0' }}>Total length:</span> <strong>{wireResult.totalWireLength.toLocaleString()} m</strong></div>
                  <div><span style={{ color: '#8a95a0' }}>Wire spacing:</span> <strong>{wireResult.wireSpacing.toFixed(2)} m</strong></div>
                  {wireResult.totalWireCost > 0 && (
                    <div><span style={{ color: '#8a95a0' }}>Total cost:</span> <strong>R {wireResult.totalWireCost.toLocaleString()}</strong></div>
                  )}
                </div>
              </div>
            )}
          </>)}

          {/* C8. Irrigation */}
          {renderSection('irrigation', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Irrigation Type</div>
                <select style={inputStyle} value={spec.irrigation_type || ''}
                  onChange={e => saveSpec({ irrigation_type: e.target.value || null })}>
                  <option value="">—</option>
                  <option value="drip">Drip</option>
                  <option value="micro">Micro</option>
                </select>
              </div>
              {spec.irrigation_type === 'micro' && (
                <div style={fieldStyle}>
                  <div style={labelStyle}>Micro Style</div>
                  <select style={inputStyle} value={spec.irrigation_micro_style || ''}
                    onChange={e => saveSpec({ irrigation_micro_style: e.target.value || null })}>
                    <option value="">—</option>
                    <option value="hanging">Hanging</option>
                    <option value="upright_stakes">Upright with stakes</option>
                  </select>
                </div>
              )}
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Emitter Spacing (m)</div>
                <input type="number" style={inputStyle} step="0.1" value={spec.irrigation_emitter_spacing || ''}
                  onBlur={e => saveSpec({ irrigation_emitter_spacing: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, irrigation_emitter_spacing: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Flow Rate (l/h)</div>
                <input type="number" style={inputStyle} value={spec.irrigation_flow_rate || ''}
                  onBlur={e => saveSpec({ irrigation_flow_rate: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, irrigation_flow_rate: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Est. Cost (R)</div>
                <input type="number" style={inputStyle} value={spec.irrigation_cost || ''}
                  onBlur={e => saveSpec({ irrigation_cost: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, irrigation_cost: e.target.value }))} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Filtration</div>
                <input style={inputStyle} value={spec.irrigation_filtration || ''} placeholder="disc, sand, screen..."
                  onBlur={e => saveSpec({ irrigation_filtration: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, irrigation_filtration: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Designer / Contractor</div>
                <input style={inputStyle} value={spec.irrigation_designer || ''}
                  onBlur={e => saveSpec({ irrigation_designer: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, irrigation_designer: e.target.value }))} />
              </div>
            </div>
            <div>
              <div style={labelStyle}>Fertigation Notes</div>
              <textarea style={{ ...inputStyle, minHeight: 40 }} value={spec.irrigation_fertigation || ''}
                onBlur={e => saveSpec({ irrigation_fertigation: e.target.value || null })}
                onChange={e => setSpec(s => ({ ...s, irrigation_fertigation: e.target.value }))} />
            </div>
            <DocumentUpload orchardId={orchardId} step="irrigation" documents={documents} onUploaded={loadAll} />
          </>)}

          {/* C9. Drainage */}
          {renderSection('drainage', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Drainage Required</div>
                <select style={inputStyle} value={spec.drainage_required ? 'yes' : 'no'}
                  onChange={e => saveSpec({ drainage_required: e.target.value === 'yes' })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
            {spec.drainage_required && (
              <>
                <div style={rowStyle}>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Drainage Type</div>
                    <select style={inputStyle} value={spec.drainage_type || ''}
                      onChange={e => saveSpec({ drainage_type: e.target.value || null })}>
                      <option value="">—</option>
                      <option value="subsurface_pipe">Subsurface pipe drains</option>
                      <option value="french_drain">French drains</option>
                      <option value="surface_shaping">Surface shaping</option>
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Contractor</div>
                    <input style={inputStyle} value={spec.drainage_contractor || ''}
                      onBlur={e => saveSpec({ drainage_contractor: e.target.value || null })}
                      onChange={e => setSpec(s => ({ ...s, drainage_contractor: e.target.value }))} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Est. Cost (R)</div>
                    <input type="number" style={inputStyle} value={spec.drainage_cost || ''}
                      onBlur={e => saveSpec({ drainage_cost: e.target.value ? parseFloat(e.target.value) : null })}
                      onChange={e => setSpec(s => ({ ...s, drainage_cost: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <div style={labelStyle}>Notes</div>
                  <textarea style={{ ...inputStyle, minHeight: 40 }} value={spec.drainage_notes || ''}
                    onBlur={e => saveSpec({ drainage_notes: e.target.value || null })}
                    onChange={e => setSpec(s => ({ ...s, drainage_notes: e.target.value }))} />
                </div>
              </>
            )}
            <DocumentUpload orchardId={orchardId} step="drainage" documents={documents} onUploaded={loadAll} />
          </>)}

          {/* C10. Soil Grid */}
          {renderSection('soil_grid', <>
            <div style={{ fontSize: 12, color: '#8a95a0', marginBottom: 4 }}>
              50×50m grid auto-generated from orchard polygon ({soilGrid.length} points)
            </div>
            {soilGrid.length > 0 && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {soilGrid.slice(0, 30).map(p => (
                    <span key={p.id} style={{ padding: '2px 6px', background: '#f0f4fa', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#1a2a3a' }}>
                      {p.id}
                    </span>
                  ))}
                  {soilGrid.length > 30 && <span style={{ fontSize: 11, color: '#aaa' }}>+{soilGrid.length - 30} more</span>}
                </div>
                <button onClick={exportSoilGridKml}
                  style={{ padding: '6px 16px', background: '#1a4ba0', color: '#a0c4f0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                  Export Grid as KML
                </button>
              </>
            )}
            {soilGrid.length === 0 && (
              <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Draw a boundary polygon on the orchards map to generate the soil grid</div>
            )}
            <div style={{ borderTop: '1px solid #eef2fa', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a2a3a', marginBottom: 6 }}>Soil Scientist Visit</div>
              <div style={rowStyle}>
                <div style={fieldStyle}>
                  <div style={labelStyle}>Contact</div>
                  <ContactPicker contacts={contacts} selectedId={spec.soil_scientist_contact_id || null}
                    onSelect={id => saveSpec({ soil_scientist_contact_id: id })} onContactCreated={loadAll} />
                </div>
                <div style={fieldStyle}>
                  <div style={labelStyle}>Visit Date</div>
                  <input type="date" style={inputStyle} value={spec.soil_visit_date || ''}
                    onChange={e => saveSpec({ soil_visit_date: e.target.value || null })} />
                </div>
              </div>
              <div style={rowStyle}>
                <div style={fieldStyle}>
                  <div style={labelStyle}>Samples Sent Date</div>
                  <input type="date" style={inputStyle} value={spec.soil_samples_sent_date || ''}
                    onChange={e => saveSpec({ soil_samples_sent_date: e.target.value || null })} />
                </div>
                <div style={fieldStyle}>
                  <div style={labelStyle}>Report Received Date</div>
                  <input type="date" style={inputStyle} value={spec.soil_report_received_date || ''}
                    onChange={e => saveSpec({ soil_report_received_date: e.target.value || null })} />
                </div>
              </div>
            </div>
            <DocumentUpload orchardId={orchardId} step="soil_report" documents={documents} onUploaded={loadAll} />
          </>)}

          {/* C11. Soil Prep & Chemistry */}
          {renderSection('soil_prep', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Ripping Depth (m)</div>
                <input type="number" style={inputStyle} step="0.1" value={spec.ripping_depth || ''}
                  onBlur={e => saveSpec({ ripping_depth: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, ripping_depth: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Lime (kg/ha)</div>
                <input type="number" style={inputStyle} value={spec.lime_rate_kg_ha || ''}
                  onBlur={e => saveSpec({ lime_rate_kg_ha: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, lime_rate_kg_ha: e.target.value }))} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Gypsum (kg/ha)</div>
                <input type="number" style={inputStyle} value={spec.gypsum_rate_kg_ha || ''}
                  onBlur={e => saveSpec({ gypsum_rate_kg_ha: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, gypsum_rate_kg_ha: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Phosphate (kg/ha)</div>
                <input type="number" style={inputStyle} value={spec.phosphate_rate_kg_ha || ''}
                  onBlur={e => saveSpec({ phosphate_rate_kg_ha: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, phosphate_rate_kg_ha: e.target.value }))} />
              </div>
            </div>
            <div>
              <div style={labelStyle}>Ridging / Other Notes</div>
              <textarea style={{ ...inputStyle, minHeight: 40 }} value={spec.ridging_notes || ''}
                onBlur={e => saveSpec({ ridging_notes: e.target.value || null })}
                onChange={e => setSpec(s => ({ ...s, ridging_notes: e.target.value }))} />
            </div>
            <div>
              <div style={labelStyle}>Other Amendments</div>
              <textarea style={{ ...inputStyle, minHeight: 40 }} value={spec.other_amendments || ''}
                onBlur={e => saveSpec({ other_amendments: e.target.value || null })}
                onChange={e => setSpec(s => ({ ...s, other_amendments: e.target.value }))} />
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Soil Prep Cost (R)</div>
              <input type="number" style={inputStyle} value={spec.soil_prep_cost || ''}
                onBlur={e => saveSpec({ soil_prep_cost: e.target.value ? parseFloat(e.target.value) : null })}
                onChange={e => setSpec(s => ({ ...s, soil_prep_cost: e.target.value }))} />
            </div>
          </>)}

          {/* C12. Fumigation */}
          {renderSection('fumigation', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Fumigation Required</div>
                <select style={inputStyle} value={spec.fumigation_required ? 'yes' : 'no'}
                  onChange={e => saveSpec({ fumigation_required: e.target.value === 'yes' })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
            {spec.fumigation_required && (
              <>
                <div style={rowStyle}>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Fumigant Type</div>
                    <input style={inputStyle} value={spec.fumigant_type || ''}
                      onBlur={e => saveSpec({ fumigant_type: e.target.value || null })}
                      onChange={e => setSpec(s => ({ ...s, fumigant_type: e.target.value }))} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Service Provider</div>
                    <input style={inputStyle} value={spec.fumigation_provider || ''}
                      onBlur={e => saveSpec({ fumigation_provider: e.target.value || null })}
                      onChange={e => setSpec(s => ({ ...s, fumigation_provider: e.target.value }))} />
                  </div>
                </div>
                <div style={rowStyle}>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Booked Date</div>
                    <input type="date" style={inputStyle} value={spec.fumigation_booked_date || ''}
                      onChange={e => saveSpec({ fumigation_booked_date: e.target.value || null })} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Est. Cost (R)</div>
                    <input type="number" style={inputStyle} value={spec.fumigation_cost || ''}
                      onBlur={e => saveSpec({ fumigation_cost: e.target.value ? parseFloat(e.target.value) : null })}
                      onChange={e => setSpec(s => ({ ...s, fumigation_cost: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            {spec.fumigation_required && (
              <button onClick={exportFumigationPdf} style={{ padding: '4px 12px', background: '#1a4ba0', color: '#a0c4f0', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>Export PDF</button>
            )}
            <DocumentUpload orchardId={orchardId} step="fumigation" documents={documents} onUploaded={loadAll} />
          </>)}

          {/* C13. Cover Crop */}
          {renderSection('cover_crop', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Species / Mix</div>
                <input style={inputStyle} value={spec.cover_crop_species || ''}
                  placeholder="Italian ryegrass, white clover, fescue..."
                  onBlur={e => saveSpec({ cover_crop_species: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, cover_crop_species: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Seeding Timing</div>
                <input style={inputStyle} value={spec.cover_crop_timing || ''} placeholder="e.g. 1 month before planting"
                  onBlur={e => saveSpec({ cover_crop_timing: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, cover_crop_timing: e.target.value }))} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Pattern</div>
                <input style={inputStyle} value={spec.cover_crop_pattern || ''} placeholder="working row vs sward row"
                  onBlur={e => saveSpec({ cover_crop_pattern: e.target.value || null })}
                  onChange={e => setSpec(s => ({ ...s, cover_crop_pattern: e.target.value }))} />
              </div>
              <div style={fieldStyle}>
                <div style={labelStyle}>Est. Cost (R)</div>
                <input type="number" style={inputStyle} value={spec.cover_crop_cost || ''}
                  onBlur={e => saveSpec({ cover_crop_cost: e.target.value ? parseFloat(e.target.value) : null })}
                  onChange={e => setSpec(s => ({ ...s, cover_crop_cost: e.target.value }))} />
              </div>
            </div>
          </>)}

          {/* C14. Windbreak */}
          {renderSection('windbreak', <>
            <div style={rowStyle}>
              <div style={fieldStyle}>
                <div style={labelStyle}>Windbreak Required</div>
                <select style={inputStyle} value={spec.windbreak_required ? 'yes' : 'no'}
                  onChange={e => saveSpec({ windbreak_required: e.target.value === 'yes' })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
            {spec.windbreak_required && (
              <>
                <div style={rowStyle}>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Species</div>
                    <input style={inputStyle} value={spec.windbreak_species || ''}
                      onBlur={e => saveSpec({ windbreak_species: e.target.value || null })}
                      onChange={e => setSpec(s => ({ ...s, windbreak_species: e.target.value }))} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Planting Date</div>
                    <input type="date" style={inputStyle} value={spec.windbreak_planting_date || ''}
                      onChange={e => saveSpec({ windbreak_planting_date: e.target.value || null })} />
                  </div>
                </div>
                <div style={rowStyle}>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Location (which edges)</div>
                    <input style={inputStyle} value={spec.windbreak_location || ''} placeholder="e.g. South, South-East"
                      onBlur={e => saveSpec({ windbreak_location: e.target.value || null })}
                      onChange={e => setSpec(s => ({ ...s, windbreak_location: e.target.value }))} />
                  </div>
                  <div style={fieldStyle}>
                    <div style={labelStyle}>Est. Cost (R)</div>
                    <input type="number" style={inputStyle} value={spec.windbreak_cost || ''}
                      onBlur={e => saveSpec({ windbreak_cost: e.target.value ? parseFloat(e.target.value) : null })}
                      onChange={e => setSpec(s => ({ ...s, windbreak_cost: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
          </>)}

          {/* Gantt Timeline */}
          {renderSection('gantt', <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <button onClick={generateGanttFromTemplate}
                style={{ padding: '6px 16px', background: '#1a4ba0', color: '#a0c4f0', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {tasks.length > 0 ? 'Regenerate from Template' : 'Generate Timeline from Template'}
              </button>
              {!orchard?.target_planting_date && (
                <span style={{ fontSize: 11, color: '#e85a4a' }}>Set target planting date in Orchard Spec first</span>
              )}
            </div>
            {tasks.length > 0 ? (
              <GanttChart tasks={tasks} onTaskClick={setEditingTask} onStatusToggle={handleStatusToggle} />
            ) : (
              <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>
                No tasks yet. Set a target planting date and generate from template.
              </div>
            )}

            {/* Task edit modal */}
            {editingTask && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.4)', zIndex: 9000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
                onClick={() => setEditingTask(null)}
              >
                <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 420, maxHeight: '80vh', overflowY: 'auto' }}
                  onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#1a2a3a' }}>Edit Task</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={fieldStyle}>
                      <div style={labelStyle}>Name</div>
                      <input style={inputStyle} value={editingTask.name}
                        onChange={e => setEditingTask({ ...editingTask, name: e.target.value })} />
                    </div>
                    <div style={rowStyle}>
                      <div style={fieldStyle}>
                        <div style={labelStyle}>Start Date</div>
                        <input type="date" style={inputStyle} value={editingTask.start_date || ''}
                          onChange={e => setEditingTask({ ...editingTask, start_date: e.target.value || null })} />
                      </div>
                      <div style={fieldStyle}>
                        <div style={labelStyle}>End Date</div>
                        <input type="date" style={inputStyle} value={editingTask.end_date || ''}
                          onChange={e => setEditingTask({ ...editingTask, end_date: e.target.value || null })} />
                      </div>
                    </div>
                    <div style={fieldStyle}>
                      <div style={labelStyle}>Status</div>
                      <select style={inputStyle} value={editingTask.status}
                        onChange={e => setEditingTask({ ...editingTask, status: e.target.value as any })}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </div>
                    <div style={fieldStyle}>
                      <div style={labelStyle}>Responsible Contact</div>
                      <ContactPicker contacts={contacts}
                        selectedId={editingTask.responsible_contact_id || null}
                        onSelect={id => setEditingTask({ ...editingTask, responsible_contact_id: id })}
                        onContactCreated={loadAll} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={async () => {
                        await fetch('/api/planning', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'save-task',
                            data: {
                              id: editingTask.id,
                              name: editingTask.name,
                              start_date: editingTask.start_date,
                              end_date: editingTask.end_date,
                              status: editingTask.status,
                              responsible_contact_id: editingTask.responsible_contact_id || null,
                            },
                          }),
                        })
                        loadAll()
                        setEditingTask(null)
                      }}
                        style={{ padding: '7px 20px', background: '#2176d9', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Save
                      </button>
                      <button onClick={async () => {
                        if (!confirm('Delete this task?')) return
                        await fetch('/api/planning', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'delete-task', id: editingTask.id }),
                        })
                        loadAll()
                        setEditingTask(null)
                      }}
                        style={{ padding: '7px 16px', background: 'none', color: '#e85a4a', border: '1px solid #e85a4a', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Delete
                      </button>
                      <button onClick={() => setEditingTask(null)}
                        style={{ padding: '7px 16px', background: 'none', color: '#6a7a70', border: '1px solid #e0ddd6', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>)}

          {/* Cost Summary */}
          {renderSection('cost', <>
            <CostSummary spec={spec} poleResult={poleResult} wireResult={wireResult} netHa={netHa} />
          </>)}

        </div>
      </div>
    </>
  )
}

'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useCallback, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['Soil Properties', 'Irrigation Types', 'Crop Factors (Kc)'] as const
type Tab = typeof TABS[number]

const MONTHS = [
  { num: 9, label: 'Sep' }, { num: 10, label: 'Oct' }, { num: 11, label: 'Nov' },
  { num: 12, label: 'Dec' }, { num: 1, label: 'Jan' }, { num: 2, label: 'Feb' },
  { num: 3, label: 'Mar' }, { num: 4, label: 'Apr' }, { num: 5, label: 'May' },
  { num: 6, label: 'Jun' }, { num: 7, label: 'Jul' }, { num: 8, label: 'Aug' },
]

const COMMODITY_LABELS: Record<string, string> = {
  AP: 'Apples', PR: 'Pears', NE: 'Nectarines', PE: 'Peaches', CI: 'Citrus',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; name: string }

interface OrchardRow {
  id: string
  name: string
  orchard_nr: number | null
  farm_id: string
  variety_group: string | null
  commodity_code: string
  commodity_id: string
  irrigation_type_id: string | null
  irrigation_type_name: string | null
  irrigation_efficiency: number | null
  // soil properties (null = no row yet)
  soil_type: string | null
  whc_mm_per_m: number
  effective_root_depth_m: number
  raw_fraction: number
  has_soil_row: boolean
}

interface IrrigationType {
  id: string
  name: string
  description: string | null
  efficiency: number
}

interface KcRow {
  commodity_code: string
  commodity_id: string
  variety_group: string
  values: Record<number, { system: number | null; org: number | null; orgId: string | null }>
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IrrigationSettingsPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [tab, setTab] = useState<Tab>('Soil Properties')
  const [farms, setFarms] = useState<Farm[]>([])
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  // Shared state
  const [orchards, setOrchards] = useState<OrchardRow[]>([])
  const [irrigationTypes, setIrrigationTypes] = useState<IrrigationType[]>([])
  const [kcRows, setKcRows] = useState<KcRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Load farms
  useEffect(() => {
    if (!contextLoaded) return
    const supabase = createClient()
    async function load() {
      if (farmIds.length === 0 && isSuperAdmin) {
        const { data } = await supabase.from('farms').select('id, code, full_name, organisation_id').eq('is_active', true).order('code')
        const f = (data || []).map(d => ({ id: d.id, code: d.code, name: d.full_name }))
        setFarms(f)
        setEffectiveFarmIds(f.map(d => d.id))
        if (data?.[0]) setOrgId(data[0].organisation_id)
      } else {
        const { data } = await supabase.from('farms').select('id, code, full_name, organisation_id').in('id', farmIds).order('code')
        const f = (data || []).map(d => ({ id: d.id, code: d.code, name: d.full_name }))
        setFarms(f)
        setEffectiveFarmIds(farmIds)
        if (data?.[0]) setOrgId(data[0].organisation_id)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin])

  const activeFarmIds = useMemo(() => {
    if (selectedFarm) return [selectedFarm]
    return effectiveFarmIds
  }, [selectedFarm, effectiveFarmIds])

  // Load orchards + soil properties + irrigation types
  useEffect(() => {
    if (activeFarmIds.length === 0) return
    setLoading(true)
    const supabase = createClient()

    Promise.all([
      supabase.from('orchards')
        .select('id, name, orchard_nr, farm_id, variety_group, commodity_id, irrigation_type_id, commodities!inner(code), irrigation_types(name, efficiency)')
        .in('farm_id', activeFarmIds)
        .eq('is_active', true)
        .order('name'),
      supabase.from('orchard_soil_properties')
        .select('orchard_id, soil_type, whc_mm_per_m, effective_root_depth_m, raw_fraction'),
      supabase.from('irrigation_types')
        .select('id, name, description, efficiency')
        .order('name'),
    ]).then(([orchRes, soilRes, irrRes]) => {
      const soilMap = new Map<string, any>()
      for (const s of (soilRes.data || [])) soilMap.set(s.orchard_id, s)

      const rows: OrchardRow[] = (orchRes.data || []).map((o: any) => {
        const soil = soilMap.get(o.id)
        return {
          id: o.id,
          name: o.name,
          orchard_nr: o.orchard_nr,
          farm_id: o.farm_id,
          variety_group: o.variety_group,
          commodity_code: o.commodities?.code || '',
          commodity_id: o.commodity_id,
          irrigation_type_id: o.irrigation_type_id,
          irrigation_type_name: o.irrigation_types?.name || null,
          irrigation_efficiency: o.irrigation_types?.efficiency || null,
          soil_type: soil?.soil_type || null,
          whc_mm_per_m: soil?.whc_mm_per_m ?? 120,
          effective_root_depth_m: soil?.effective_root_depth_m ?? 0.6,
          raw_fraction: soil?.raw_fraction ?? 0.5,
          has_soil_row: !!soil,
        }
      })
      setOrchards(rows)
      setIrrigationTypes((irrRes.data || []) as IrrigationType[])
      setLoading(false)
      setDirty(false)
    })
  }, [activeFarmIds])

  // Load Kc data
  useEffect(() => {
    if (!orgId || activeFarmIds.length === 0) return
    const supabase = createClient()

    Promise.all([
      // System defaults (org_id IS NULL)
      supabase.from('crop_coefficients')
        .select('id, commodity_id, variety_group, month, kc')
        .is('organisation_id', null)
        .not('variety_group', 'is', null),
      // Org overrides
      supabase.from('crop_coefficients')
        .select('id, commodity_id, variety_group, month, kc')
        .eq('organisation_id', orgId)
        .not('variety_group', 'is', null),
      // Variety groups from active orchards
      supabase.from('orchards')
        .select('commodity_id, variety_group, commodities!inner(code)')
        .in('farm_id', activeFarmIds)
        .eq('is_active', true)
        .not('variety_group', 'is', null),
    ]).then(([sysRes, orgRes, orchRes]) => {
      // Build variety list
      const varSet = new Map<string, { commodity_code: string; commodity_id: string; variety_group: string }>()
      for (const o of (orchRes.data || [])) {
        const code = (o as any).commodities?.code
        const vg = o.variety_group
        if (code && vg) {
          const key = `${code}:${vg}`
          if (!varSet.has(key)) varSet.set(key, { commodity_code: code, commodity_id: o.commodity_id, variety_group: vg })
        }
      }

      // Build sys/org lookup maps
      const sysMap = new Map<string, { kc: number }>()
      for (const s of (sysRes.data || [])) {
        sysMap.set(`${s.commodity_id}:${s.variety_group}:${s.month}`, { kc: s.kc })
      }
      const orgMap = new Map<string, { kc: number; id: string }>()
      for (const s of (orgRes.data || [])) {
        orgMap.set(`${s.commodity_id}:${s.variety_group}:${s.month}`, { kc: s.kc, id: s.id })
      }

      // Build rows
      const rows: KcRow[] = Array.from(varSet.values())
        .sort((a, b) => a.commodity_code.localeCompare(b.commodity_code) || a.variety_group.localeCompare(b.variety_group))
        .map(v => {
          const values: KcRow['values'] = {}
          for (let m = 1; m <= 12; m++) {
            const key = `${v.commodity_id}:${v.variety_group}:${m}`
            const sys = sysMap.get(key)
            const org = orgMap.get(key)
            values[m] = { system: sys?.kc ?? null, org: org?.kc ?? null, orgId: org?.id ?? null }
          }
          return { ...v, values }
        })

      setKcRows(rows)
    })
  }, [orgId, activeFarmIds])

  if (!contextLoaded) return null

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        @media (max-width: 768px) {
          .irr-settings-main { padding: 16px !important; padding-bottom: 80px !important; }
          .irr-table-wrap { overflow-x: auto; }
        }
      `}</style>

      <div style={s.page}>
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
        <main style={s.main} className="irr-settings-main">
          <div style={s.header}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a href="/irrigation" style={s.backLink}>&larr; Irrigation</a>
              </div>
              <h1 style={s.title}>Irrigation Settings</h1>
              <div style={s.sub}>
                Configure soil properties, irrigation types, and crop factors for water balance calculations.
              </div>
            </div>
            {dirty && (
              <button
                style={saving ? s.saveBtnDisabled : s.saveBtn}
                disabled={saving}
                onClick={() => {
                  if (tab === 'Soil Properties') saveSoil()
                  else if (tab === 'Irrigation Types') saveIrrigationAssignments()
                  else if (tab === 'Crop Factors (Kc)') saveKc()
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>

          {/* Farm pills */}
          {farms.length > 1 && (
            <div style={s.farmPills}>
              <button
                style={selectedFarm === null ? s.farmPillActive : s.farmPill}
                onClick={() => { setSelectedFarm(null); setDirty(false) }}
              >All Farms</button>
              {farms.map(f => (
                <button
                  key={f.id}
                  style={selectedFarm === f.id ? s.farmPillActive : s.farmPill}
                  onClick={() => { setSelectedFarm(f.id); setDirty(false) }}
                >{f.code}</button>
              ))}
            </div>
          )}

          {/* Tab bar */}
          <div style={s.tabBar}>
            {TABS.map(t => (
              <button
                key={t}
                style={tab === t ? s.tabActive : s.tab}
                onClick={() => { setTab(t); setDirty(false) }}
              >{t}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading...</div>
          ) : (
            <>
              {tab === 'Soil Properties' && (
                <SoilTab
                  orchards={orchards}
                  onChange={(updated) => { setOrchards(updated); setDirty(true) }}
                />
              )}
              {tab === 'Irrigation Types' && (
                <IrrigationTab
                  orchards={orchards}
                  irrigationTypes={irrigationTypes}
                  onChange={(updated) => { setOrchards(updated); setDirty(true) }}
                />
              )}
              {tab === 'Crop Factors (Kc)' && (
                <KcTab
                  rows={kcRows}
                  onChange={(updated) => { setKcRows(updated); setDirty(true) }}
                />
              )}
            </>
          )}
        </main>
        <MobileNav modules={modules} />
      </div>
    </>
  )

  // ── Save handlers ─────────────────────────────────────────────────────────

  async function saveSoil() {
    setSaving(true)
    const supabase = createClient()

    // Only upsert rows that differ from defaults or already have a row
    const toSave = orchards
      .filter(o => o.has_soil_row || o.whc_mm_per_m !== 120 || o.effective_root_depth_m !== 0.6 || o.raw_fraction !== 0.5 || o.soil_type)
      .map(o => ({
        orchard_id: o.id,
        soil_type: o.soil_type,
        whc_mm_per_m: o.whc_mm_per_m,
        effective_root_depth_m: o.effective_root_depth_m,
        raw_fraction: o.raw_fraction,
        updated_at: new Date().toISOString(),
      }))

    if (toSave.length > 0) {
      const { error } = await supabase
        .from('orchard_soil_properties')
        .upsert(toSave, { onConflict: 'orchard_id' })
      if (error) {
        alert('Error saving soil properties: ' + error.message)
        setSaving(false)
        return
      }
    }

    // Mark all as having a soil row now
    setOrchards(prev => prev.map(o => ({
      ...o,
      has_soil_row: o.has_soil_row || o.whc_mm_per_m !== 120 || o.effective_root_depth_m !== 0.6 || o.raw_fraction !== 0.5 || !!o.soil_type,
    })))
    setDirty(false)
    setSaving(false)
  }

  async function saveIrrigationAssignments() {
    setSaving(true)
    const supabase = createClient()

    // Update each changed orchard's irrigation_type_id
    const promises = orchards.map(o =>
      supabase.from('orchards').update({ irrigation_type_id: o.irrigation_type_id }).eq('id', o.id)
    )
    const results = await Promise.all(promises)
    const err = results.find(r => r.error)
    if (err?.error) {
      alert('Error saving irrigation types: ' + err.error.message)
    }

    setDirty(false)
    setSaving(false)
  }

  async function saveKc() {
    setSaving(true)
    const supabase = createClient()

    // Collect all org overrides to upsert
    const upserts: { organisation_id: string; commodity_id: string; variety_group: string; month: number; kc: number; source: string }[] = []
    const deletes: string[] = [] // IDs of org rows to delete (reset to default)

    for (const row of kcRows) {
      for (let m = 1; m <= 12; m++) {
        const cell = row.values[m]
        if (cell.org !== null) {
          upserts.push({
            organisation_id: orgId!,
            commodity_id: row.commodity_id,
            variety_group: row.variety_group,
            month: m,
            kc: cell.org,
            source: 'org override',
          })
        } else if (cell.orgId) {
          // Had an org row before but now it's been reset
          deletes.push(cell.orgId)
        }
      }
    }

    if (deletes.length > 0) {
      await supabase.from('crop_coefficients').delete().in('id', deletes)
    }

    if (upserts.length > 0) {
      const { error } = await supabase
        .from('crop_coefficients')
        .upsert(upserts, { onConflict: 'organisation_id,commodity_id,variety_group,month' })
      if (error) {
        alert('Error saving crop factors: ' + error.message)
        setSaving(false)
        return
      }
    }

    setDirty(false)
    setSaving(false)
  }
}

// ── Tab 1: Soil Properties ──────────────────────────────────────────────────

function SoilTab({ orchards, onChange }: { orchards: OrchardRow[]; onChange: (rows: OrchardRow[]) => void }) {
  const update = (id: string, field: keyof OrchardRow, value: any) => {
    onChange(orchards.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  return (
    <div className="irr-table-wrap">
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Orchard</th>
            <th style={s.th}>Soil Type</th>
            <th style={{ ...s.th, textAlign: 'center' }}>WHC (mm/m)</th>
            <th style={{ ...s.th, textAlign: 'center' }}>Root Depth (m)</th>
            <th style={{ ...s.th, textAlign: 'center' }}>RAW</th>
            <th style={{ ...s.th, textAlign: 'center' }}>Available Water (mm)</th>
          </tr>
        </thead>
        <tbody>
          {orchards.map(o => {
            const aw = o.whc_mm_per_m * o.effective_root_depth_m * o.raw_fraction
            const isDefault = !o.has_soil_row
            return (
              <tr key={o.id}>
                <td style={s.tdName}>
                  {o.orchard_nr ? `${o.orchard_nr}. ` : ''}{o.name}
                  {o.variety_group ? <span style={s.variety}> ({o.variety_group})</span> : null}
                </td>
                <td style={s.tdInput}>
                  <input
                    style={{ ...s.input, color: isDefault && !o.soil_type ? '#aaa' : '#1a2a3a' }}
                    value={o.soil_type || ''}
                    placeholder="e.g. Sandy loam"
                    onChange={e => update(o.id, 'soil_type', e.target.value || null)}
                  />
                </td>
                <td style={s.tdInput}>
                  <input
                    type="number"
                    style={{ ...s.inputNum, color: isDefault ? '#aaa' : '#1a2a3a' }}
                    value={o.whc_mm_per_m}
                    step={5}
                    min={40}
                    max={300}
                    onChange={e => update(o.id, 'whc_mm_per_m', Number(e.target.value) || 120)}
                  />
                </td>
                <td style={s.tdInput}>
                  <input
                    type="number"
                    style={{ ...s.inputNum, color: isDefault ? '#aaa' : '#1a2a3a' }}
                    value={o.effective_root_depth_m}
                    step={0.1}
                    min={0.2}
                    max={2.0}
                    onChange={e => update(o.id, 'effective_root_depth_m', Number(e.target.value) || 0.6)}
                  />
                </td>
                <td style={s.tdInput}>
                  <input
                    type="number"
                    style={{ ...s.inputNum, color: isDefault ? '#aaa' : '#1a2a3a' }}
                    value={o.raw_fraction}
                    step={0.05}
                    min={0.1}
                    max={1.0}
                    onChange={e => update(o.id, 'raw_fraction', Number(e.target.value) || 0.5)}
                  />
                </td>
                <td style={{ ...s.tdComputed, fontWeight: 600 }}>
                  {aw.toFixed(1)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={s.hint}>
        Values in grey are defaults (WHC 120 mm/m, Root depth 0.6 m, RAW 0.5). Edit to customise per orchard.
      </div>
    </div>
  )
}

// ── Tab 2: Irrigation Types ─────────────────────────────────────────────────

function IrrigationTab({
  orchards, irrigationTypes, onChange,
}: {
  orchards: OrchardRow[]
  irrigationTypes: IrrigationType[]
  onChange: (rows: OrchardRow[]) => void
}) {
  const [showTypes, setShowTypes] = useState(false)

  const updateType = (orchardId: string, typeId: string) => {
    const irrType = irrigationTypes.find(t => t.id === typeId)
    onChange(orchards.map(o => o.id === orchardId ? {
      ...o,
      irrigation_type_id: typeId,
      irrigation_type_name: irrType?.name || null,
      irrigation_efficiency: irrType?.efficiency || null,
    } : o))
  }

  return (
    <>
      {/* Section A: Per-orchard assignment */}
      <div style={s.sectionTitle}>Per-Orchard Assignment</div>
      <div className="irr-table-wrap">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Orchard</th>
              <th style={s.th}>Type</th>
              <th style={{ ...s.th, textAlign: 'center' }}>Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {orchards.map(o => {
              const eff = irrigationTypes.find(t => t.id === o.irrigation_type_id)?.efficiency
              return (
                <tr key={o.id}>
                  <td style={s.tdName}>
                    {o.orchard_nr ? `${o.orchard_nr}. ` : ''}{o.name}
                    {o.variety_group ? <span style={s.variety}> ({o.variety_group})</span> : null}
                  </td>
                  <td style={s.tdInput}>
                    <select
                      style={s.select}
                      value={o.irrigation_type_id || ''}
                      onChange={e => updateType(o.id, e.target.value)}
                    >
                      <option value="">— None —</option>
                      {irrigationTypes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ ...s.tdComputed, textAlign: 'center' }}>
                    {eff ? `${Math.round(eff * 100)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Section B: Type reference (collapsible) */}
      <div style={{ marginTop: 24 }}>
        <button
          style={s.collapseBtn}
          onClick={() => setShowTypes(!showTypes)}
        >
          {showTypes ? '▾' : '▸'} Irrigation Type Reference
        </button>
        {showTypes && (
          <table style={{ ...s.table, maxWidth: 500, marginTop: 8 }}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Description</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {irrigationTypes.map(t => (
                <tr key={t.id}>
                  <td style={s.tdName}>{t.name}</td>
                  <td style={s.tdCell}>{t.description || '—'}</td>
                  <td style={{ ...s.tdComputed, textAlign: 'center' }}>{Math.round(t.efficiency * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ── Tab 3: Crop Factors (Kc) ────────────────────────────────────────────────

function KcTab({ rows, onChange }: { rows: KcRow[]; onChange: (rows: KcRow[]) => void }) {
  const [editingCell, setEditingCell] = useState<{ vg: string; month: number } | null>(null)
  const [editValue, setEditValue] = useState('')

  const setKc = useCallback((commodity_code: string, variety_group: string, month: number, kc: number) => {
    onChange(rows.map(r => {
      if (r.commodity_code !== commodity_code || r.variety_group !== variety_group) return r
      return {
        ...r,
        values: {
          ...r.values,
          [month]: { ...r.values[month], org: kc },
        },
      }
    }))
    setEditingCell(null)
  }, [rows, onChange])

  const resetKc = useCallback((commodity_code: string, variety_group: string, month: number) => {
    onChange(rows.map(r => {
      if (r.commodity_code !== commodity_code || r.variety_group !== variety_group) return r
      return {
        ...r,
        values: {
          ...r.values,
          [month]: { ...r.values[month], org: null },
        },
      }
    }))
    setEditingCell(null)
  }, [rows, onChange])

  const copyFromRow = useCallback((sourceRow: KcRow, targetVg: string) => {
    onChange(rows.map(r => {
      if (r.commodity_code !== sourceRow.commodity_code || r.variety_group !== targetVg) return r
      // Copy org values (or system values as org overrides)
      const newValues: KcRow['values'] = {}
      for (let m = 1; m <= 12; m++) {
        const src = sourceRow.values[m]
        const effectiveKc = src.org ?? src.system
        newValues[m] = { ...r.values[m], org: effectiveKc }
      }
      return { ...r, values: newValues }
    }))
  }, [rows, onChange])

  // Group by commodity
  const grouped = useMemo(() => {
    const map = new Map<string, KcRow[]>()
    for (const r of rows) {
      const arr = map.get(r.commodity_code) || []
      arr.push(r)
      map.set(r.commodity_code, arr)
    }
    return map
  }, [rows])

  return (
    <>
      <div style={s.kcLegend}>
        <span style={s.kcLegendItem}><span style={{ ...s.kcSwatch, background: '#f0f7ff' }} /> FAO 56 default</span>
        <span style={s.kcLegendItem}><span style={{ ...s.kcSwatch, background: '#e0f0e0' }} /> Org override</span>
        <span style={{ fontSize: 12, color: '#8a95a0' }}>Click a cell to edit. Right-click to reset to default.</span>
      </div>

      {Array.from(grouped.entries()).map(([code, commodityRows]) => (
        <div key={code} style={s.section}>
          <div style={s.sectionTitle}>{COMMODITY_LABELS[code] || code}</div>
          <div className="irr-table-wrap">
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Variety Group</th>
                  {MONTHS.map(m => (
                    <th key={m.num} style={s.thMonth}>{m.label}</th>
                  ))}
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {commodityRows.map(row => (
                  <tr key={`${row.commodity_code}:${row.variety_group}`}>
                    <td style={s.tdName}>{row.variety_group}</td>
                    {MONTHS.map(m => {
                      const cell = row.values[m.num]
                      const hasOrg = cell.org !== null
                      const displayValue = hasOrg ? cell.org : cell.system
                      const isEditing = editingCell?.vg === `${row.commodity_code}:${row.variety_group}` && editingCell?.month === m.num

                      return (
                        <td
                          key={m.num}
                          style={{
                            ...s.kcCell,
                            background: hasOrg ? '#e0f0e0' : '#f0f7ff',
                            position: 'relative' as const,
                          }}
                          onClick={() => {
                            if (isEditing) return
                            setEditingCell({ vg: `${row.commodity_code}:${row.variety_group}`, month: m.num })
                            setEditValue(displayValue?.toFixed(2) || '')
                          }}
                          onContextMenu={e => {
                            e.preventDefault()
                            if (hasOrg) resetKc(row.commodity_code, row.variety_group, m.num)
                          }}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              step={0.05}
                              min={0}
                              max={2}
                              style={s.kcInput}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => {
                                const v = parseFloat(editValue)
                                if (!isNaN(v) && v >= 0 && v <= 2) {
                                  setKc(row.commodity_code, row.variety_group, m.num, Math.round(v * 100) / 100)
                                } else {
                                  setEditingCell(null)
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') setEditingCell(null)
                              }}
                            />
                          ) : (
                            <span style={{ fontWeight: hasOrg ? 600 : 400, color: hasOrg ? '#1a6a1a' : '#8a95a0', fontSize: 12 }}>
                              {displayValue !== null ? displayValue.toFixed(2) : '—'}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td style={s.tdAction}>
                      <KcCopyMenu
                        sourceRow={row}
                        allRows={commodityRows}
                        onCopy={(targetVg) => copyFromRow(row, targetVg)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}

// ── Kc Copy Menu ────────────────────────────────────────────────────────────

function KcCopyMenu({ sourceRow, allRows, onCopy }: {
  sourceRow: KcRow
  allRows: KcRow[]
  onCopy: (targetVg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const hasValues = Object.values(sourceRow.values).some(v => v.org !== null || v.system !== null)
  if (!hasValues) return null

  const targets = allRows.filter(r => r.variety_group !== sourceRow.variety_group)
  if (targets.length === 0) return null

  return (
    <div style={{ position: 'relative' as const }}>
      <button
        style={s.copyBtn}
        onClick={() => setOpen(!open)}
        title="Copy Kc values to another variety"
      >
        Copy &darr;
      </button>
      {open && (
        <div style={s.copyDropdown}>
          {targets.map(t => (
            <div
              key={t.variety_group}
              style={s.copyDropdownItem}
              onClick={() => { onCopy(t.variety_group); setOpen(false) }}
            >
              {t.variety_group}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
  main: { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, paddingBottom: 100 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  backLink: { fontSize: 13, color: '#2176d9', textDecoration: 'none', fontWeight: 500 },
  title: { fontSize: 28, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px', lineHeight: 1, marginTop: 8 },
  sub: { fontSize: 14, color: '#8a95a0', marginTop: 6 },
  saveBtn: { padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
  saveBtnDisabled: { padding: '10px 24px', borderRadius: 10, border: 'none', background: '#d4cfca', color: '#8a95a0', fontSize: 14, fontWeight: 600, cursor: 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },

  // Farm pills
  farmPills: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const },
  farmPill: { padding: '6px 16px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a7a', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  farmPillActive: { padding: '6px 16px', borderRadius: 20, border: '1px solid #2176d9', background: '#e8f0fc', color: '#2176d9', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  // Tabs
  tabBar: { display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e8e4dc' },
  tab: { padding: '10px 20px', border: 'none', background: 'none', color: '#8a95a0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabActive: { padding: '10px 20px', border: 'none', background: 'none', color: '#2176d9', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderBottom: '2px solid #2176d9', marginBottom: -2 },

  // Table
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1a2a3a', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e4dc' },
  th: { fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '10px 8px', textAlign: 'left' as const, borderBottom: '1px solid #e8e4dc' },
  thMonth: { fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '10px 4px', textAlign: 'center' as const, borderBottom: '1px solid #e8e4dc', minWidth: 48 },
  tdName: { fontSize: 13, fontWeight: 600, color: '#1a2a3a', padding: '8px 8px', borderBottom: '1px solid #f0ede8', whiteSpace: 'nowrap' as const },
  tdCell: { fontSize: 13, color: '#5a6a7a', padding: '8px 8px', borderBottom: '1px solid #f0ede8' },
  tdInput: { padding: '4px 8px', borderBottom: '1px solid #f0ede8' },
  tdComputed: { fontSize: 13, color: '#2176d9', padding: '8px 8px', borderBottom: '1px solid #f0ede8', textAlign: 'center' as const },
  tdAction: { padding: '6px 8px', borderBottom: '1px solid #f0ede8', textAlign: 'center' as const },
  variety: { fontWeight: 400, color: '#8a95a0', fontSize: 12 },
  hint: { fontSize: 12, color: '#8a95a0', marginTop: 8, fontStyle: 'italic' as const },

  // Inputs
  input: { width: '100%', padding: '5px 8px', border: '1px solid #e8e4dc', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fafaf8', outline: 'none' },
  inputNum: { width: 80, padding: '5px 8px', border: '1px solid #e8e4dc', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fafaf8', textAlign: 'center' as const, outline: 'none' },
  select: { width: '100%', padding: '5px 8px', border: '1px solid #e8e4dc', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fafaf8', outline: 'none', cursor: 'pointer' },

  // Collapse
  collapseBtn: { border: 'none', background: 'none', color: '#5a6a7a', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },

  // Kc tab
  kcCell: { fontSize: 12, padding: '6px 2px', textAlign: 'center' as const, borderBottom: '1px solid #f0ede8', minWidth: 48, cursor: 'pointer' },
  kcInput: { width: 52, padding: '2px 4px', border: '1px solid #2176d9', borderRadius: 4, fontSize: 12, fontFamily: 'inherit', textAlign: 'center' as const, outline: 'none' },
  kcLegend: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, marginBottom: 16, alignItems: 'center' },
  kcLegendItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#5a6a7a' },
  kcSwatch: { display: 'inline-block', width: 14, height: 14, borderRadius: 3, border: '1px solid #d4cfca' },

  // Copy
  copyBtn: { fontSize: 11, color: '#2176d9', background: 'none', border: '1px solid #d4cfca', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
  copyDropdown: { position: 'absolute' as const, top: '100%', right: 0, background: '#fff', border: '1px solid #d4cfca', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 140, overflow: 'hidden' },
  copyDropdownItem: { padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f0ede8' },
}

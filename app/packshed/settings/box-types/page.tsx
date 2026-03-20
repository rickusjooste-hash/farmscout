'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'

interface BoxType {
  id: string; code: string; name: string; pack_code: string; grade: string
  cartons_per_pallet: number; weight_per_carton_kg: number | null; season: string; is_active: boolean
}
interface Size { id: string; label: string; sort_order: number; is_active: boolean }
interface Packhouse { id: string; code: string; name: string; is_active: boolean }
interface OrchardRef { id: string; name: string; orchard_nr: number | null; variety: string | null }
interface OrchardMap {
  id?: string; paltrack_orchard_code: string; paltrack_variety: string; orchard_id: string | null
  _dirty?: boolean
}

type Tab = 'box-types' | 'sizes' | 'packhouses' | 'orchard-map'

export default function PackshedSettingsPage() {
  const supabase = createClient()
  const { isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [tab, setTab] = useState<Tab>('box-types')
  const [boxTypes, setBoxTypes] = useState<BoxType[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [packhouses, setPackhouses] = useState<Packhouse[]>([])
  const [orchards, setOrchards] = useState<OrchardRef[]>([])
  const [orchardMaps, setOrchardMaps] = useState<OrchardMap[]>([])
  const [loading, setLoading] = useState(true)
  const [savingMap, setSavingMap] = useState(false)

  // New packhouse form
  const [newPhCode, setNewPhCode] = useState('')
  const [newPhName, setNewPhName] = useState('')
  const [addingPh, setAddingPh] = useState(false)

  useEffect(() => {
    if (!contextLoaded) return
    loadAll()
  }, [contextLoaded])

  async function loadAll() {
    setLoading(true)
    const [btRes, szRes, phRes, orchRes, mapRes, palletRes] = await Promise.all([
      supabase.from('packout_box_types').select('*').order('code'),
      supabase.from('packout_sizes').select('*').order('sort_order'),
      supabase.from('packhouses').select('*').order('code'),
      supabase.from('orchards').select('id,name,orchard_nr,variety').eq('is_active', true).order('orchard_nr'),
      supabase.from('packout_orchard_map').select('*').order('paltrack_orchard_code'),
      // Get distinct orchard+variety combos from pallets
      supabase.from('packout_pallets').select('orchard_code,variety'),
    ])
    setBoxTypes(btRes.data || [])
    setSizes(szRes.data || [])
    setPackhouses(phRes.data || [])
    setOrchards(orchRes.data || [])

    // Build orchard map rows: distinct paltrack combos + any saved mappings
    const savedMaps = mapRes.data || []
    const savedByKey = new Map<string, any>()
    for (const m of savedMaps) {
      savedByKey.set(`${m.paltrack_orchard_code}|${m.paltrack_variety}`, m)
    }

    // Get distinct combos from pallets
    const combos = new Set<string>()
    for (const p of (palletRes.data || [])) {
      if (p.orchard_code && p.variety) {
        combos.add(`${p.orchard_code.trim()}|${p.variety.trim()}`)
      }
    }

    const mapRows: OrchardMap[] = []
    for (const combo of Array.from(combos).sort()) {
      const [oc, v] = combo.split('|')
      const saved = savedByKey.get(combo)
      mapRows.push({
        id: saved?.id,
        paltrack_orchard_code: oc,
        paltrack_variety: v,
        orchard_id: saved?.orchard_id || null,
      })
    }

    // Also include saved mappings not in current pallets
    for (const m of savedMaps) {
      const key = `${m.paltrack_orchard_code}|${m.paltrack_variety}`
      if (!combos.has(key)) {
        mapRows.push({
          id: m.id,
          paltrack_orchard_code: m.paltrack_orchard_code,
          paltrack_variety: m.paltrack_variety,
          orchard_id: m.orchard_id,
        })
      }
    }

    setOrchardMaps(mapRows)
    setLoading(false)
  }

  async function toggleActive(table: string, id: string, current: boolean) {
    await supabase.from(table).update({ is_active: !current }).eq('id', id)
    await loadAll()
  }

  async function updateWeight(id: string, weight: number) {
    await supabase.from('packout_box_types').update({ weight_per_carton_kg: weight }).eq('id', id)
    setBoxTypes(prev => prev.map(bt => bt.id === id ? { ...bt, weight_per_carton_kg: weight } : bt))
  }

  async function updateCpp(id: string, cpp: number) {
    await supabase.from('packout_box_types').update({ cartons_per_pallet: cpp }).eq('id', id)
    setBoxTypes(prev => prev.map(bt => bt.id === id ? { ...bt, cartons_per_pallet: cpp } : bt))
  }

  async function addPackhouse() {
    if (!newPhCode.trim() || !newPhName.trim()) return
    setAddingPh(true)
    const { data: farms } = await supabase.from('farms').select('id,organisation_id').limit(1).single()
    if (farms) {
      await supabase.from('packhouses').insert({
        organisation_id: farms.organisation_id,
        farm_id: farms.id,
        code: newPhCode.trim(),
        name: newPhName.trim(),
      })
      setNewPhCode('')
      setNewPhName('')
      await loadAll()
    }
    setAddingPh(false)
  }

  // ── Orchard map ─────────────────────────────────────────────────────

  function updateMapOrchard(idx: number, orchardId: string) {
    setOrchardMaps(prev => prev.map((m, i) => i === idx ? { ...m, orchard_id: orchardId || null, _dirty: true } : m))
  }

  async function saveOrchardMaps() {
    setSavingMap(true)
    const dirty = orchardMaps.filter(m => m._dirty && m.orchard_id)

    // Get org_id
    const { data: farms } = await supabase.from('farms').select('organisation_id').limit(1).single()
    const orgId = farms?.organisation_id
    if (!orgId) { setSavingMap(false); return }

    for (const m of dirty) {
      const payload = {
        organisation_id: orgId,
        paltrack_orchard_code: m.paltrack_orchard_code,
        paltrack_variety: m.paltrack_variety,
        orchard_id: m.orchard_id!,
      }

      if (m.id) {
        await supabase.from('packout_orchard_map').update(payload).eq('id', m.id)
      } else {
        const { data } = await supabase.from('packout_orchard_map')
          .upsert(payload, { onConflict: 'organisation_id,paltrack_orchard_code,paltrack_variety' })
          .select('id').single()
        if (data) m.id = data.id
      }
    }

    // Now resolve orchard_id on existing pallets using the mapping
    const mapResp = await supabase.from('packout_orchard_map').select('paltrack_orchard_code,paltrack_variety,orchard_id')
    const maps = mapResp.data || []

    for (const map of maps) {
      await supabase.from('packout_pallets')
        .update({ orchard_id: map.orchard_id })
        .eq('orchard_code', map.paltrack_orchard_code)
        .eq('variety', map.paltrack_variety)
        .is('orchard_id', null)
    }

    setSavingMap(false)
    await loadAll()
  }

  const mapDirty = orchardMaps.some(m => m._dirty)
  const unmappedCount = orchardMaps.filter(m => !m.orchard_id).length

  if (!contextLoaded) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f7fa', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={{ flex: 1, padding: '32px 40px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a2a3a', marginBottom: 8 }}>Packshed Settings</h1>
        <p style={{ fontSize: 13, color: '#8a95a0', marginBottom: 24 }}>
          Box types and sizes are auto-derived from Paltrack. Map orchards and adjust weights here.
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {([
            ['box-types', 'Box Types'],
            ['sizes', 'Sizes'],
            ['packhouses', 'Packhouses'],
            ['orchard-map', `Orchard Map${unmappedCount > 0 ? ` (${unmappedCount})` : ''}`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === key ? '#2176d9' : '#e5e7eb',
                color: tab === key ? '#fff' : '#5a6a70',
              }}
            >{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading...</div>
        ) : tab === 'box-types' ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  <th style={s.th}>Code</th>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Pack</th>
                  <th style={s.th}>Grade</th>
                  <th style={s.th}>Ctns/Plt</th>
                  <th style={s.th}>Wt/Ctn (kg)</th>
                  <th style={s.th}>Season</th>
                  <th style={s.th}>Active</th>
                </tr>
              </thead>
              <tbody>
                {boxTypes.map(bt => (
                  <tr key={bt.id} style={{ borderBottom: '1px solid #f0f0f0', opacity: bt.is_active ? 1 : 0.5 }}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{bt.code}</td>
                    <td style={s.td}>{bt.name}</td>
                    <td style={s.td}>{bt.pack_code}</td>
                    <td style={s.td}>{bt.grade}</td>
                    <td style={s.td}>
                      <input type="number" min={1} style={s.inlineInput} value={bt.cartons_per_pallet}
                        onChange={e => updateCpp(bt.id, parseInt(e.target.value) || 56)} />
                    </td>
                    <td style={s.td}>
                      <input type="number" min={0} step={0.1} style={s.inlineInput} value={bt.weight_per_carton_kg ?? ''}
                        onChange={e => updateWeight(bt.id, parseFloat(e.target.value) || 0)} />
                    </td>
                    <td style={s.td}>{bt.season}</td>
                    <td style={s.td}>
                      <button style={{ ...s.toggleBtn, background: bt.is_active ? '#4caf72' : '#d4d8de' }}
                        onClick={() => toggleActive('packout_box_types', bt.id, bt.is_active)}
                      >{bt.is_active ? 'Yes' : 'No'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {boxTypes.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#8a95a0' }}>
                No box types yet. Run the Paltrack sync to auto-derive them.
              </div>
            )}
          </div>
        ) : tab === 'sizes' ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fb' }}>
                  <th style={s.th}>Size (count)</th>
                  <th style={s.th}>Sort Order</th>
                  <th style={s.th}>Active</th>
                </tr>
              </thead>
              <tbody>
                {sizes.map(sz => (
                  <tr key={sz.id} style={{ borderBottom: '1px solid #f0f0f0', opacity: sz.is_active ? 1 : 0.5 }}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{sz.label}</td>
                    <td style={s.td}>{sz.sort_order}</td>
                    <td style={s.td}>
                      <button style={{ ...s.toggleBtn, background: sz.is_active ? '#4caf72' : '#d4d8de' }}
                        onClick={() => toggleActive('packout_sizes', sz.id, sz.is_active)}
                      >{sz.is_active ? 'Yes' : 'No'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'packhouses' ? (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input style={s.input} placeholder="Code (e.g. Q0245)" value={newPhCode} onChange={e => setNewPhCode(e.target.value)} />
              <input style={{ ...s.input, flex: 1 }} placeholder="Name (e.g. Main Packhouse)" value={newPhName} onChange={e => setNewPhName(e.target.value)} />
              <button style={s.addBtn} onClick={addPackhouse} disabled={addingPh}>
                {addingPh ? 'Adding...' : 'Add Packhouse'}
              </button>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8f9fb' }}>
                    <th style={s.th}>Code</th>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {packhouses.map(ph => (
                    <tr key={ph.id} style={{ borderBottom: '1px solid #f0f0f0', opacity: ph.is_active ? 1 : 0.5 }}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{ph.code}</td>
                      <td style={s.td}>{ph.name}</td>
                      <td style={s.td}>
                        <button style={{ ...s.toggleBtn, background: ph.is_active ? '#4caf72' : '#d4d8de' }}
                          onClick={() => toggleActive('packhouses', ph.id, ph.is_active)}
                        >{ph.is_active ? 'Yes' : 'No'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {packhouses.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#8a95a0' }}>No packhouses configured.</div>
              )}
            </div>
          </div>
        ) : (
          /* ── Orchard Map tab ──────────────────────────────────────── */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#8a95a0', margin: 0 }}>
                Map Paltrack orchard + variety combos to allFarm orchards. Saving also resolves unmapped pallets.
              </p>
              <button
                style={{ ...s.addBtn, opacity: mapDirty ? 1 : 0.4 }}
                onClick={saveOrchardMaps}
                disabled={!mapDirty || savingMap}
              >
                {savingMap ? 'Saving & resolving...' : 'Save Mappings'}
              </button>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8f9fb' }}>
                    <th style={s.th}>Paltrack Orchard</th>
                    <th style={s.th}>Paltrack Variety</th>
                    <th style={s.th}>Status</th>
                    <th style={{ ...s.th, minWidth: 300 }}>allFarm Orchard</th>
                  </tr>
                </thead>
                <tbody>
                  {orchardMaps.map((m, idx) => {
                    const mapped = !!m.orchard_id
                    const matchedOrchard = orchards.find(o => o.id === m.orchard_id)
                    return (
                      <tr key={`${m.paltrack_orchard_code}_${m.paltrack_variety}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ ...s.td, fontWeight: 600, fontSize: 15 }}>{m.paltrack_orchard_code}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{m.paltrack_variety}</td>
                        <td style={s.td}>
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: mapped ? '#e8f5e9' : '#fff3e0',
                            color: mapped ? '#2e7d32' : '#e65100',
                          }}>
                            {mapped ? 'Mapped' : 'Unmapped'}
                          </span>
                        </td>
                        <td style={s.td}>
                          <select
                            style={{ ...s.input, width: '100%', borderColor: mapped ? '#d4d8de' : '#e85a4a' }}
                            value={m.orchard_id || ''}
                            onChange={e => updateMapOrchard(idx, e.target.value)}
                          >
                            <option value="">-- Select orchard --</option>
                            {orchards.map(o => (
                              <option key={o.id} value={o.id}>
                                {o.orchard_nr != null ? `${o.orchard_nr} – ` : ''}{o.name}
                                {o.variety ? ` (${o.variety})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {orchardMaps.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#8a95a0' }}>
                  No orchard combos found. Run the Paltrack sync first.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  th: { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '2px solid #e5e7eb' },
  td: { padding: '8px 12px' },
  toggleBtn: { border: 'none', borderRadius: 6, padding: '4px 12px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  inlineInput: { width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, textAlign: 'center' as const },
  input: { padding: '8px 12px', borderRadius: 8, border: '1px solid #d4d8de', fontSize: 13 },
  addBtn: { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2176d9', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'

interface Nutrient {
  id: string
  code: string
  name: string
  category: string
  default_unit: string
  display_order: number
}

interface NormRow {
  id: string
  organisation_id: string | null
  commodity_id: string
  nutrient_id: string
  sample_type: string
  variety: string | null
  min_optimal: number
  max_optimal: number
  min_adequate: number | null
  max_adequate: number | null
  unit: string
  source: string | null
  nutrients: { code: string; name: string; category: string; display_order: number }
}

interface Commodity {
  id: string
  name: string
}

interface EditState {
  nutrient_id: string
  min_optimal: string
  max_optimal: string
  min_adequate: string
  max_adequate: string
}

export default function NutrientNormsPage() {
  const { farmIds, isSuperAdmin, contextLoaded, orgId } = useUserContext()
  const supabase = createClient()

  const [modules, setModules] = useState<string[]>(['farmscout'])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [selectedCommodityId, setSelectedCommodityId] = useState<string | null>(null)
  const [nutrients, setNutrients] = useState<Nutrient[]>([])
  const [norms, setNorms] = useState<NormRow[]>([])
  const [varieties, setVarieties] = useState<string[]>([])
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null) // null = commodity default
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<EditState | null>(null)

  // Load commodities + modules
  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const { data: commData } = await supabase.from('commodities').select('id, name').order('name')
      setCommodities(commData || [])
      if (commData?.length && !selectedCommodityId) setSelectedCommodityId(commData[0].id)

      if (orgId) {
        const { data: org } = await supabase.from('organisations').select('modules').eq('id', orgId).single()
        if (org?.modules) setModules(org.modules)
      }
    }
    load()
  }, [contextLoaded, orgId])

  // Fetch norms when commodity changes
  const fetchNorms = useCallback(async () => {
    if (!selectedCommodityId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/leaf-analysis/norms?commodity_id=${selectedCommodityId}`)
      if (res.ok) {
        const data = await res.json()
        setNorms(data.norms || [])
        setNutrients(data.nutrients || [])
        setVarieties(data.varieties || [])
      }
    } finally {
      setLoading(false)
    }
  }, [selectedCommodityId])

  useEffect(() => {
    if (selectedCommodityId) {
      setSelectedVariety(null)
      setEditing(null)
      fetchNorms()
    }
  }, [fetchNorms, selectedCommodityId])

  // Resolve effective norm for a nutrient at the current view level
  function getEffectiveNorm(nutrientId: string): {
    norm: NormRow | null
    level: 'custom' | 'inherited-commodity' | 'system' | 'none'
  } {
    if (selectedVariety) {
      // Variety view: look for org+variety first, then org+commodity, then system
      const orgVariety = norms.find(n =>
        n.nutrient_id === nutrientId && n.organisation_id && n.variety === selectedVariety
      )
      if (orgVariety) return { norm: orgVariety, level: 'custom' }

      const orgCommodity = norms.find(n =>
        n.nutrient_id === nutrientId && n.organisation_id && !n.variety
      )
      if (orgCommodity) return { norm: orgCommodity, level: 'inherited-commodity' }

      const system = norms.find(n =>
        n.nutrient_id === nutrientId && !n.organisation_id && !n.variety
      )
      if (system) return { norm: system, level: 'inherited-commodity' }

      return { norm: null, level: 'none' }
    } else {
      // Commodity default view: look for org+commodity first, then system
      const orgCommodity = norms.find(n =>
        n.nutrient_id === nutrientId && n.organisation_id && !n.variety
      )
      if (orgCommodity) return { norm: orgCommodity, level: 'custom' }

      const system = norms.find(n =>
        n.nutrient_id === nutrientId && !n.organisation_id && !n.variety
      )
      if (system) return { norm: system, level: 'system' }

      return { norm: null, level: 'none' }
    }
  }

  function startEdit(nutrientId: string) {
    const { norm } = getEffectiveNorm(nutrientId)
    const nut = nutrients.find(n => n.id === nutrientId)
    if (norm) {
      setEditing({
        nutrient_id: nutrientId,
        min_optimal: String(norm.min_optimal),
        max_optimal: String(norm.max_optimal),
        min_adequate: norm.min_adequate != null ? String(norm.min_adequate) : '',
        max_adequate: norm.max_adequate != null ? String(norm.max_adequate) : '',
      })
    } else {
      setEditing({
        nutrient_id: nutrientId,
        min_optimal: '',
        max_optimal: '',
        min_adequate: '',
        max_adequate: '',
      })
    }
  }

  async function saveEdit() {
    if (!editing || !selectedCommodityId) return
    const { nutrient_id, min_optimal, max_optimal, min_adequate, max_adequate } = editing
    if (!min_optimal || !max_optimal) return

    const nut = nutrients.find(n => n.id === nutrient_id)

    setSaving(true)
    try {
      const res = await fetch('/api/leaf-analysis/norms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commodity_id: selectedCommodityId,
          nutrient_id,
          variety: selectedVariety || null,
          min_optimal: parseFloat(min_optimal),
          max_optimal: parseFloat(max_optimal),
          min_adequate: min_adequate ? parseFloat(min_adequate) : null,
          max_adequate: max_adequate ? parseFloat(max_adequate) : null,
          unit: nut?.default_unit || '%',
        }),
      })
      if (res.ok) {
        setEditing(null)
        fetchNorms()
      }
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefault(normId: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/leaf-analysis/norms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: normId }),
      })
      if (res.ok) {
        setEditing(null)
        fetchNorms()
      }
    } finally {
      setSaving(false)
    }
  }

  const selectedCommodityName = commodities.find(c => c.id === selectedCommodityId)?.name || ''
  const macroNutrients = nutrients.filter(n => n.category === 'macro')
  const microNutrients = nutrients.filter(n => n.category === 'micro')

  function renderNutrientRow(nut: Nutrient, idx: number) {
    const { norm, level } = getEffectiveNorm(nut.id)
    const isEditing = editing?.nutrient_id === nut.id
    const stripe = idx % 2 === 1
    const rowBg = stripe ? '#f8f6f2' : '#fff'

    const isInherited = level === 'inherited-commodity' || level === 'system'
    const isCustom = level === 'custom'
    const textColor = isInherited ? '#aaa' : '#1a2a3a'

    return (
      <tr key={nut.id} style={{ background: rowBg }}>
        <td style={{ ...s.td, fontWeight: 500, color: '#1a2a3a' }}>
          {nut.code}
          <span style={{ color: '#8a95a0', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>{nut.name}</span>
        </td>
        <td style={{ ...s.td, color: '#6a7a70', fontSize: 12 }}>{nut.default_unit}</td>

        {isEditing ? (
          <>
            <td style={s.td}>
              <input type="number" step="any" value={editing.min_adequate} onChange={e => setEditing({ ...editing, min_adequate: e.target.value })}
                style={s.input} placeholder="—" />
            </td>
            <td style={s.td}>
              <input type="number" step="any" value={editing.min_optimal} onChange={e => setEditing({ ...editing, min_optimal: e.target.value })}
                style={{ ...s.input, borderColor: '#4caf72' }} placeholder="Required" />
            </td>
            <td style={s.td}>
              <input type="number" step="any" value={editing.max_optimal} onChange={e => setEditing({ ...editing, max_optimal: e.target.value })}
                style={{ ...s.input, borderColor: '#4caf72' }} placeholder="Required" />
            </td>
            <td style={s.td}>
              <input type="number" step="any" value={editing.max_adequate} onChange={e => setEditing({ ...editing, max_adequate: e.target.value })}
                style={s.input} placeholder="—" />
            </td>
            <td style={s.td} />
            <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
              <button onClick={saveEdit} disabled={saving || !editing.min_optimal || !editing.max_optimal}
                style={{ ...s.actionBtn, background: '#2176d9', color: '#fff', opacity: saving ? 0.5 : 1 }}>
                Save
              </button>
              <button onClick={() => setEditing(null)} style={{ ...s.actionBtn, marginLeft: 4 }}>Cancel</button>
            </td>
          </>
        ) : (
          <>
            <td style={{ ...s.td, ...s.tdNum, color: norm?.min_adequate != null ? textColor : '#ccc' }}>
              {norm?.min_adequate != null ? Number(norm.min_adequate).toFixed(nut.default_unit === '%' ? 2 : 0) : '\u2014'}
            </td>
            <td style={{ ...s.td, ...s.tdNum, color: textColor, background: norm ? 'rgba(76,175,114,0.06)' : 'transparent' }}>
              {norm ? Number(norm.min_optimal).toFixed(nut.default_unit === '%' ? 2 : 0) : '\u2014'}
            </td>
            <td style={{ ...s.td, ...s.tdNum, color: textColor, background: norm ? 'rgba(76,175,114,0.06)' : 'transparent' }}>
              {norm ? Number(norm.max_optimal).toFixed(nut.default_unit === '%' ? 2 : 0) : '\u2014'}
            </td>
            <td style={{ ...s.td, ...s.tdNum, color: norm?.max_adequate != null ? textColor : '#ccc' }}>
              {norm?.max_adequate != null ? Number(norm.max_adequate).toFixed(nut.default_unit === '%' ? 2 : 0) : '\u2014'}
            </td>
            <td style={{ ...s.td, fontSize: 11 }}>
              {isCustom && (
                <span style={{ background: '#e8f0fe', color: '#2176d9', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
                  Custom
                </span>
              )}
              {level === 'system' && norm?.source && (
                <span style={{ color: '#8a95a0', fontSize: 11 }}>{norm.source}</span>
              )}
              {isInherited && (
                <span style={{ color: '#b0b8c0', fontSize: 10, fontStyle: 'italic' }}>
                  {selectedVariety ? 'Inherited' : 'System default'}
                </span>
              )}
            </td>
            <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
              <button onClick={() => startEdit(nut.id)} style={s.actionBtn}>
                {norm && level !== 'none' ? 'Edit' : 'Set'}
              </button>
              {isCustom && norm?.id && norm.organisation_id && (
                <button onClick={() => resetToDefault(norm.id)} style={{ ...s.actionBtn, color: '#e85a4a', marginLeft: 4 }}>
                  Reset
                </button>
              )}
            </td>
          </>
        )}
      </tr>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eae6df', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />

      <main style={s.main}>
        {/* Header */}
        <div style={s.headerRow}>
          <div>
            <a href="/orchards/leaf-analysis" style={{ color: '#2176d9', fontSize: 13, textDecoration: 'none' }}>
              &larr; Back to Leaf Analysis
            </a>
            <h1 style={s.pageTitle}>Nutrient Norms</h1>
            <p style={s.subtitle}>
              Optimal and adequate ranges for leaf analysis color-coding.
              {selectedVariety ? ` Viewing overrides for ${selectedVariety}.` : ' Editing sets a custom range for your organisation.'}
            </p>
          </div>
        </div>

        {/* Commodity pills */}
        <div style={s.filterRow}>
          <div style={s.pillGroup}>
            {commodities.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCommodityId(c.id)}
                style={{ ...s.pill, ...(selectedCommodityId === c.id ? s.pillActive : {}) }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Variety pills */}
        {varieties.length > 0 && (
          <div style={{ ...s.filterRow, marginTop: -12 }}>
            <span style={s.filterLabel}>Level</span>
            <div style={s.pillGroup}>
              <button
                onClick={() => { setSelectedVariety(null); setEditing(null) }}
                style={{ ...s.pillSm, ...(selectedVariety === null ? s.pillSmActive : {}) }}
              >
                {selectedCommodityName} Default
              </button>
              {varieties.map(v => (
                <button
                  key={v}
                  onClick={() => { setSelectedVariety(v); setEditing(null) }}
                  style={{ ...s.pillSm, ...(selectedVariety === v ? s.pillSmActive : {}) }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Norms table */}
        {loading ? (
          <div style={s.card}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 40, background: '#f4f1eb', borderRadius: 8, marginBottom: 8, animation: 'norms-pulse 1.5s ease infinite' }} />
            ))}
            <style>{`@keyframes norms-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
          </div>
        ) : (
          <div style={s.card}>
            {/* Macro nutrients */}
            <div style={s.sectionHeader}>Macro Nutrients</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Nutrient</th>
                    <th style={s.th}>Unit</th>
                    <th style={{ ...s.th, ...s.thNum }}>Min Adequate</th>
                    <th style={{ ...s.th, ...s.thNum, background: 'rgba(76,175,114,0.08)' }}>Min Optimal</th>
                    <th style={{ ...s.th, ...s.thNum, background: 'rgba(76,175,114,0.08)' }}>Max Optimal</th>
                    <th style={{ ...s.th, ...s.thNum }}>Max Adequate</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {macroNutrients.map((nut, idx) => renderNutrientRow(nut, idx))}
                </tbody>
              </table>
            </div>

            {/* Micro nutrients */}
            <div style={{ ...s.sectionHeader, marginTop: 8 }}>Micro Nutrients</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Nutrient</th>
                    <th style={s.th}>Unit</th>
                    <th style={{ ...s.th, ...s.thNum }}>Min Adequate</th>
                    <th style={{ ...s.th, ...s.thNum, background: 'rgba(76,175,114,0.08)' }}>Min Optimal</th>
                    <th style={{ ...s.th, ...s.thNum, background: 'rgba(76,175,114,0.08)' }}>Max Optimal</th>
                    <th style={{ ...s.th, ...s.thNum }}>Max Adequate</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {microNutrients.map((nut, idx) => renderNutrientRow(nut, idx))}
                </tbody>
              </table>
            </div>

            {/* Color legend */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid #f0ede6', display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: '#6a7a70' }}>
              <span style={{ fontWeight: 600, color: '#5a6a60' }}>How it works:</span>
              <span>Values in the <span style={{ background: 'rgba(76,175,114,0.12)', padding: '1px 6px', borderRadius: 3 }}>optimal</span> range show green</span>
              <span>Values in the <span style={{ background: 'rgba(245,200,66,0.12)', padding: '1px 6px', borderRadius: 3 }}>adequate</span> range show yellow</span>
              <span>Values <span style={{ background: 'rgba(232,90,74,0.12)', padding: '1px 6px', borderRadius: 3 }}>outside</span> show red</span>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: {
    flex: 1, padding: '32px 40px', overflowY: 'auto', minHeight: '100vh',
  },
  headerRow: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 24, fontWeight: 700, color: '#1a2a3a', margin: '8px 0 0',
  },
  subtitle: {
    fontSize: 14, color: '#6a7a70', margin: '4px 0 0',
  },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
    flexWrap: 'wrap',
  },
  pillGroup: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
  },
  pill: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca',
    background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'all 0.15s',
  },
  pillActive: {
    border: '1px solid #2176d9', background: '#2176d9', color: '#fff',
  },
  filterLabel: {
    fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const,
    letterSpacing: '0.5px', flexShrink: 0,
  },
  pillSm: {
    padding: '4px 10px', borderRadius: 14, border: '1px solid #e8e4dc',
    background: '#fff', color: '#6a7a70', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500, transition: 'all 0.15s',
  },
  pillSmActive: {
    border: '1px solid #1a2a3a', background: '#1a2a3a', color: '#fff',
  },
  card: {
    background: '#fff', borderRadius: 14, padding: 0,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  sectionHeader: {
    padding: '12px 16px 6px', fontSize: 12, fontWeight: 700, color: '#5a6a60',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
    background: '#faf8f5', borderBottom: '1px solid #f0ede6',
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif',
    fontSize: 13,
  },
  th: {
    textAlign: 'left', padding: '8px 10px', fontWeight: 600,
    color: '#5a6a60', fontSize: 11, borderBottom: '2px solid #e0dbd4',
    whiteSpace: 'nowrap', background: '#f2efea', userSelect: 'none',
  },
  thNum: { textAlign: 'right' },
  td: {
    padding: '8px 10px', borderBottom: '1px solid #f0ede6',
    color: '#1a2a3a', whiteSpace: 'nowrap',
  },
  tdNum: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  input: {
    width: 80, padding: '4px 8px', border: '1px solid #d4cfca', borderRadius: 6,
    fontSize: 13, fontFamily: 'Inter, sans-serif', textAlign: 'right' as const,
    outline: 'none',
  },
  actionBtn: {
    padding: '3px 10px', borderRadius: 4, border: '1px solid #d4cfca',
    background: '#fff', color: '#5a6a60', fontSize: 11, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500,
  },
}

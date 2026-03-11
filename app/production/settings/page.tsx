'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

interface Commodity { id: string; name: string; code: string }
interface BinWeightRow {
  id: string
  commodity_id: string
  variety: string | null
  default_weight_kg: number
  commodity_name?: string
}

export default function BinWeightSettingsPage() {
  const supabase = createClient()
  const { isSuperAdmin, contextLoaded, orgId } = useUserContext()
  const modules = useOrgModules()

  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [rows, setRows] = useState<BinWeightRow[]>([])
  const [loading, setLoading] = useState(true)

  // Add form
  const [newCommodityId, setNewCommodityId] = useState('')
  const [newVariety, setNewVariety] = useState('')
  const [newWeight, setNewWeight] = useState('400')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')

  async function loadData() {
    if (!orgId) return
    setLoading(true)
    const [{ data: commData }, { data: weightData }] = await Promise.all([
      supabase.from('commodities').select('id, name, code').order('name'),
      supabase.from('production_bin_weights').select('id, commodity_id, variety, default_weight_kg').eq('organisation_id', orgId).order('commodity_id'),
    ])
    const comms = (commData || []) as Commodity[]
    setCommodities(comms)
    const commMap: Record<string, string> = {}
    comms.forEach(c => { commMap[c.id] = c.name })
    setRows((weightData || []).map((w: any) => ({ ...w, commodity_name: commMap[w.commodity_id] || '?' })))
    if (comms.length > 0 && !newCommodityId) setNewCommodityId(comms[0].id)
    setLoading(false)
  }

  useEffect(() => {
    if (!contextLoaded || !orgId) return
    loadData()
  }, [contextLoaded, orgId])

  async function handleAdd() {
    if (!orgId || !newCommodityId || !newWeight) return
    setSaving(true)
    const { error } = await supabase.from('production_bin_weights').upsert({
      organisation_id: orgId,
      commodity_id: newCommodityId,
      variety: newVariety.trim() || null,
      default_weight_kg: Number(newWeight),
    }, { onConflict: 'organisation_id,commodity_id,variety' })
    if (error) {
      // Handle COALESCE index — try insert without onConflict
      await supabase.from('production_bin_weights').insert({
        organisation_id: orgId,
        commodity_id: newCommodityId,
        variety: newVariety.trim() || null,
        default_weight_kg: Number(newWeight),
      })
    }
    setNewVariety('')
    setNewWeight('400')
    setSaving(false)
    loadData()
  }

  async function handleSaveEdit(id: string) {
    await supabase.from('production_bin_weights').update({ default_weight_kg: Number(editWeight), updated_at: new Date().toISOString() }).eq('id', id)
    setEditingId(null)
    loadData()
  }

  async function handleDelete(id: string) {
    await supabase.from('production_bin_weights').delete().eq('id', id)
    loadData()
  }

  const st: Record<string, React.CSSProperties> = {
    page:       { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
    main:       { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, maxWidth: 800 },
    title:      { fontSize: 28, fontWeight: 700, color: '#1a2a3a', marginBottom: 8 },
    sub:        { fontSize: 14, color: '#8a95a0', marginBottom: 32 },
    card:       { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', overflow: 'hidden', marginBottom: 24 },
    cardHeader: { padding: '20px 24px 16px', borderBottom: '1px solid #eef2fa', fontSize: 17, fontWeight: 600, color: '#1a2a3a' },
    cardBody:   { padding: '20px 24px' },
    formRow:    { display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' as const },
    label:      { fontSize: 12, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 },
    input:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #d4cfca', fontSize: 14, fontFamily: 'inherit', width: '100%' },
    select:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #d4cfca', fontSize: 14, fontFamily: 'inherit', width: '100%', background: '#fff' },
    btn:        { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    btnDanger:  { padding: '4px 10px', borderRadius: 6, border: '1px solid #e8e4dc', background: '#fff', color: '#c0392b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
    btnSmall:   { padding: '4px 10px', borderRadius: 6, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  }

  return (
    <div style={st.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />
      <MobileNav isSuperAdmin={isSuperAdmin} modules={modules} />

      <main style={st.main}>
        <div style={st.title}>Bin Weights</div>
        <div style={st.sub}>Configure default bin weights per commodity/variety. Used when no actual weight is recorded.</div>

        {/* Add form */}
        <div style={st.card}>
          <div style={st.cardHeader}>Add Default Weight</div>
          <div style={st.cardBody}>
            <div style={st.formRow}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={st.label}>Commodity</div>
                <select style={st.select} value={newCommodityId} onChange={e => setNewCommodityId(e.target.value)}>
                  {commodities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={st.label}>Variety (optional)</div>
                <input style={st.input} value={newVariety} onChange={e => setNewVariety(e.target.value)} placeholder="Leave blank for default" />
              </div>
              <div style={{ width: 120 }}>
                <div style={st.label}>Weight (kg)</div>
                <input style={st.input} type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
              </div>
              <button style={st.btn} onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Add'}</button>
            </div>
          </div>
        </div>

        {/* Existing weights table */}
        <div style={st.card}>
          <div style={st.cardHeader}>Configured Weights</div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8a95a0' }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8a95a0' }}>No weights configured. Default is 400 kg.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f7f5f0' }}>
                  {['Commodity', 'Variety', 'Weight (kg)', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e8e4dc' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eef2fa' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.commodity_name}</td>
                    <td style={{ padding: '10px 12px', color: '#6a7a70' }}>{r.variety || '(default)'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {editingId === r.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input style={{ ...st.input, width: 80 }} type="number" value={editWeight} onChange={e => setEditWeight(e.target.value)} />
                          <button style={st.btnSmall} onClick={() => handleSaveEdit(r.id)}>Save</button>
                          <button style={st.btnDanger} onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <span onClick={() => { setEditingId(r.id); setEditWeight(String(r.default_weight_kg)) }} style={{ cursor: 'pointer' }}>
                          {r.default_weight_kg} kg
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button style={st.btnDanger} onClick={() => handleDelete(r.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

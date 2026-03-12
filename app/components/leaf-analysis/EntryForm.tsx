'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-auth'

interface Nutrient {
  id: string
  code: string
  name: string
  symbol: string
  category: string
  default_unit: string
  display_order: number
}

interface Orchard {
  id: string
  name: string
}

interface Props {
  farmId: string
  orchards: Orchard[]
  onSaved: () => void
  onClose: () => void
}

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  return `${mo < 8 ? yr - 1 : yr}/${String(mo < 8 ? yr : yr + 1).slice(-2)}`
}

export default function EntryForm({ farmId, orchards, onSaved, onClose }: Props) {
  const [nutrients, setNutrients] = useState<Nutrient[]>([])
  const [orchardId, setOrchardId] = useState('')
  const [season, setSeason] = useState(getCurrentSeason())
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 10))
  const [sampleType, setSampleType] = useState('mid-season')
  const [labName, setLabName] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('nutrients').select('*').order('display_order').then(({ data }) => {
      if (data) setNutrients(data)
    })
  }, [])

  const macros = nutrients.filter(n => n.category === 'macro')
  const micros = nutrients.filter(n => n.category === 'micro')

  function setVal(code: string, v: string) {
    setValues(prev => ({ ...prev, [code]: v }))
  }

  async function handleSave() {
    if (!orchardId || !season || !sampleDate) {
      setError('Select orchard, season, and sample date')
      return
    }

    const results = nutrients
      .filter(n => values[n.code] && values[n.code].trim() !== '')
      .map(n => ({
        nutrient_id: n.id,
        value: parseFloat(values[n.code]),
        unit: n.default_unit,
      }))
      .filter(r => !isNaN(r.value))

    if (results.length === 0) {
      setError('Enter at least one nutrient value')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/leaf-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: farmId,
          orchard_id: orchardId,
          season, sample_date: sampleDate,
          sample_type: sampleType,
          lab_name: labName || null,
          results,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Save failed'); return }
      onSaved()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>Add Leaf Analysis</h3>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.body}>
          {/* Metadata */}
          <div style={s.fieldGrid}>
            <label style={s.label}>
              Orchard
              <select value={orchardId} onChange={e => setOrchardId(e.target.value)} style={s.select}>
                <option value="">Select orchard...</option>
                {orchards.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
            <label style={s.label}>
              Season
              <input value={season} onChange={e => setSeason(e.target.value)} style={s.input} placeholder="2025/26" />
            </label>
            <label style={s.label}>
              Sample Date
              <input type="date" value={sampleDate} onChange={e => setSampleDate(e.target.value)} style={s.input} />
            </label>
            <label style={s.label}>
              Sample Type
              <select value={sampleType} onChange={e => setSampleType(e.target.value)} style={s.select}>
                <option value="fruit-set">Fruit Set</option>
                <option value="mid-season">Mid-Season</option>
                <option value="post-harvest">Post-Harvest</option>
                <option value="dormant">Dormant</option>
              </select>
            </label>
            <label style={s.label}>
              Lab Name
              <input value={labName} onChange={e => setLabName(e.target.value)} style={s.input} placeholder="Bemlab, SGS, NviroTek..." />
            </label>
          </div>

          {/* Macro nutrients */}
          <div style={s.sectionLabel}>Macro Nutrients (%)</div>
          <div style={s.nutrientGrid}>
            {macros.map(n => (
              <label key={n.code} style={s.nutrientLabel}>
                <span style={s.nutrientCode}>{n.code}</span>
                <input
                  type="number"
                  step="0.01"
                  value={values[n.code] || ''}
                  onChange={e => setVal(n.code, e.target.value)}
                  style={s.nutrientInput}
                  placeholder="0.00"
                />
              </label>
            ))}
          </div>

          {/* Micro nutrients */}
          <div style={s.sectionLabel}>Micro Nutrients (mg/kg)</div>
          <div style={s.nutrientGrid}>
            {micros.map(n => (
              <label key={n.code} style={s.nutrientLabel}>
                <span style={s.nutrientCode}>{n.code}</span>
                <input
                  type="number"
                  step="0.1"
                  value={values[n.code] || ''}
                  onChange={e => setVal(n.code, e.target.value)}
                  style={s.nutrientInput}
                  placeholder="0.0"
                />
              </label>
            ))}
          </div>

          {error && <div style={s.error}>{error}</div>}
        </div>

        <div style={s.footer}>
          <button onClick={onClose} style={s.cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.3)', zIndex: 8000,
    display: 'flex', justifyContent: 'flex-end',
  },
  panel: {
    width: 520, maxWidth: '100vw', height: '100vh',
    background: '#fff', display: 'flex', flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px', borderBottom: '1px solid #e8e4dc',
  },
  title: {
    fontSize: 18, fontWeight: 600, color: '#1a2a3a', margin: 0,
    fontFamily: 'Inter, sans-serif',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 20, color: '#999',
    cursor: 'pointer', padding: '4px 8px',
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '20px 24px',
  },
  fieldGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
    marginBottom: 20,
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: 12, fontWeight: 500, color: '#6a7a70',
    fontFamily: 'Inter, sans-serif',
  },
  input: {
    padding: '8px 10px', border: '1px solid #d4cfca', borderRadius: 8,
    fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#1a2a3a',
    outline: 'none',
  },
  select: {
    padding: '8px 10px', border: '1px solid #d4cfca', borderRadius: 8,
    fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#1a2a3a',
    background: '#fff', outline: 'none',
  },
  sectionLabel: {
    fontSize: 13, fontWeight: 600, color: '#1a2a3a',
    marginBottom: 10, marginTop: 6,
    fontFamily: 'Inter, sans-serif',
  },
  nutrientGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10,
    marginBottom: 20,
  },
  nutrientLabel: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  nutrientCode: {
    fontSize: 11, fontWeight: 600, color: '#6a7a70',
    fontFamily: 'Inter, sans-serif',
  },
  nutrientInput: {
    padding: '6px 8px', border: '1px solid #d4cfca', borderRadius: 6,
    fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#1a2a3a',
    textAlign: 'right', outline: 'none',
  },
  error: {
    color: '#e85a4a', fontSize: 13, marginTop: 8,
    fontFamily: 'Inter, sans-serif',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '16px 24px', borderTop: '1px solid #e8e4dc',
  },
  cancelBtn: {
    padding: '8px 18px', borderRadius: 8, border: '1px solid #d4cfca',
    background: '#fff', color: '#6a7a70', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  saveBtn: {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
}

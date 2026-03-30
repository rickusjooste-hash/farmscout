'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'

interface Orchard {
  id: string
  legacy_id: number | null
  orchard_nr: number | null
  name: string
  variety: string | null
  farm_id: string
  is_active: boolean
}

interface Farm {
  id: string
  code: string
  full_name: string
}

export default function SoilLabelsPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, allowed } = usePageGuard()

  const [farms, setFarms] = useState<Farm[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [selectedFarm, setSelectedFarm] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!contextLoaded) return
    loadData()
  }, [contextLoaded])

  async function loadData() {
    const effectiveFarmIds = isSuperAdmin
      ? (await supabase.from('farms').select('id').then(r => (r.data || []).map((f: any) => f.id)))
      : farmIds

    const [{ data: farmData }, { data: orchardData }] = await Promise.all([
      supabase.from('farms').select('id,code,full_name').in('id', effectiveFarmIds).order('code'),
      supabase.from('orchards').select('id,legacy_id,orchard_nr,name,variety,farm_id,is_active').in('farm_id', effectiveFarmIds).eq('is_active', true).neq('status', 'planning').order('orchard_nr'),
    ])

    setFarms(farmData || [])
    setOrchards(orchardData || [])
    if (farmData?.length && !selectedFarm) setSelectedFarm(farmData[0].id)
    setLoading(false)
  }

  const filteredOrchards = selectedFarm
    ? orchards.filter(o => o.farm_id === selectedFarm)
    : orchards

  function toggleAll() {
    if (selected.size === filteredOrchards.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredOrchards.map(o => o.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function labelText(o: Orchard): string {
    const parts: string[] = []
    if (o.legacy_id) parts.push(`(${o.legacy_id})`)
    if (o.orchard_nr) parts.push(String(o.orchard_nr))
    parts.push(o.name)
    if (o.variety) parts.push(`(${o.variety})`)
    return parts.join(' ')
  }

  const labelOrchards = filteredOrchards.filter(o => selected.has(o.id))

  if (!allowed) return null

  return (
    <>
      <style>{`
        .sl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, 240px);
          gap: 12px;
          padding: 20px 32px;
        }
        .sl-card {
          width: 220px;
          height: 90px;
          border: 1px solid #d0cdc6;
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 8px 12px;
          background: #fff;
          box-sizing: border-box;
          font-family: 'Arial', sans-serif;
        }
        .sl-brand { font-size: 8px; font-weight: 700; color: #2176d9; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; }
        .sl-main { font-size: 13px; font-weight: 700; color: #111; line-height: 1.3; }
        .sl-farm { font-size: 9px; color: #666; margin-top: 4px; }

        @media print {
          @page { size: 100mm 50mm; margin: 0; }
          .no-print { display: none !important; }
          body { background: white !important; }
          .sl-grid {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .sl-card {
            width: 100mm !important;
            height: 50mm !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 5mm 6mm !important;
            margin: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
          }
          .sl-brand { font-size: 9pt !important; }
          .sl-main { font-size: 16pt !important; font-weight: 800 !important; }
          .sl-farm { font-size: 9pt !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ background: '#2176d9', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#a0c4f0', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Soil Sampling</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Label Printer</div>
          <div style={{ color: '#7ab0e8', fontSize: 12, marginTop: 2 }}>Zebra ZT230 · 100 x 50 mm</div>
        </div>
        <a href="/orchards/fertilizer" style={{ color: '#a0c4f0', fontSize: 13, textDecoration: 'none' }}>← Fertilizer</a>
      </div>

      {/* Controls */}
      <div className="no-print" style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16, background: '#fff', borderBottom: '1px solid #e8e4dc', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#5a6a60', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Farm</label>
          <select
            value={selectedFarm}
            onChange={e => { setSelectedFarm(e.target.value); setSelected(new Set()) }}
            style={{ padding: '8px 12px', border: '1px solid #d4cfca', borderRadius: 6, fontSize: 14, fontFamily: 'inherit' }}
          >
            {farms.map(f => <option key={f.id} value={f.id}>{f.code} - {f.full_name}</option>)}
          </select>
        </div>
        <button
          onClick={toggleAll}
          style={{ padding: '8px 20px', background: '#fff', color: '#2176d9', border: '1.5px solid #2176d9', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {selected.size === filteredOrchards.length ? 'Deselect All' : 'Select All'}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 28px', background: '#2176d9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Print {selected.size} Labels
          </button>
        )}
        <div style={{ fontSize: 13, color: '#8a95a0' }}>
          {selected.size} of {filteredOrchards.length} selected
        </div>
      </div>

      {/* Orchard selection list */}
      <div className="no-print" style={{ padding: '16px 32px', background: '#f4f1eb', minHeight: loading ? 200 : 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#8a95a0', padding: 40 }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {filteredOrchards.map(o => (
              <label
                key={o.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  background: selected.has(o.id) ? '#e8f0fe' : '#fff',
                  border: `1px solid ${selected.has(o.id) ? '#2176d9' : '#e0ddd5'}`,
                  borderRadius: 8, cursor: 'pointer', fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggleOne(o.id)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontWeight: 600 }}>{labelText(o)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Print labels */}
      {labelOrchards.length > 0 && (
        <div className="sl-grid">
          {labelOrchards.map(o => {
            const farm = farms.find(f => f.id === o.farm_id)
            return (
              <div key={o.id} className="sl-card">
                <div className="sl-brand">allFarm Soil Sample</div>
                <div className="sl-main">{labelText(o)}</div>
                <div className="sl-farm">{farm?.full_name || ''}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

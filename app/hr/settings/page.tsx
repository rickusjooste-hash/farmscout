'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Types ──────────────────────────────────────────────────────────────────

interface EventType { id: number; name: string; weight: number; validity_months: number | null; escalation_order: number | null }
interface ReasonCategory { id: number; name: string; description: string | null; is_active: boolean }
interface Farm { id: string; code: string; full_name: string; logo_url: string | null }

// ── Main Page ──────────────────────────────────────────────────────────────

export default function HrSettingsPage() {
  const { isSuperAdmin, contextLoaded, allowedRoutes, farmIds } = usePageGuard()
  const modules = useOrgModules()

  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [categories, setCategories] = useState<ReasonCategory[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [editingValidity, setEditingValidity] = useState<Record<number, string>>({})
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null)

  // ── Load data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const supabase = createClient()
      const [typesRes, catsRes] = await Promise.all([
        supabase.from('hr_event_types').select('*').order('id'),
        supabase.from('hr_reason_categories').select('*').order('name'),
      ])
      setEventTypes(typesRes.data ?? [])
      setCategories(catsRes.data ?? [])

      // Load farms
      if (farmIds.length === 0 && isSuperAdmin) {
        const { data } = await supabase.from('farms').select('id, code, full_name, logo_url').eq('is_active', true).order('code')
        setFarms(data ?? [])
      } else {
        const { data } = await supabase.from('farms').select('id, code, full_name, logo_url').in('id', farmIds).order('code')
        setFarms(data ?? [])
      }

      // Init editing state
      const init: Record<number, string> = {}
      for (const t of typesRes.data ?? []) {
        init[t.id] = t.validity_months?.toString() ?? ''
      }
      setEditingValidity(init)
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin])

  // ── Upload farm logo ──────────────────────────────────────────────────
  async function handleLogoUpload(farmId: string, file: File) {
    setUploadingLogo(farmId)
    const formData = new FormData()
    formData.append('file', file)
    const path = `logos/${farmId}/${Date.now()}_${file.name}`
    formData.append('path', path)

    const uploadRes = await fetch('/api/hr/upload', { method: 'POST', body: formData })
    const uploadData = await uploadRes.json()

    if (uploadData.ok) {
      // Update farm logo_url via API
      await fetch('/api/hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-event', data: { id: 'dummy' } }), // won't work - need direct update
      })
      // Use browser client directly since farms table has RLS
      const supabase = createClient()
      await supabase.from('farms').update({ logo_url: uploadData.fileUrl }).eq('id', farmId)
      setFarms(prev => prev.map(f => f.id === farmId ? { ...f, logo_url: uploadData.fileUrl } : f))
    }
    setUploadingLogo(null)
  }

  // ── Save validity ─────────────────────────────────────────────────────
  async function saveValidity(typeId: number) {
    const val = editingValidity[typeId]
    const months = val === '' ? null : Number(val)
    setSaving(true)
    const res = await fetch('/api/hr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-event-type', data: { id: typeId, validity_months: months } }),
    })
    if (res.ok) {
      setEventTypes(prev => prev.map(t => t.id === typeId ? { ...t, validity_months: months } : t))
    }
    setSaving(false)
  }

  // ── Create category ───────────────────────────────────────────────────
  async function createCategory() {
    if (!newCatName.trim()) return
    setSaving(true)
    const res = await fetch('/api/hr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-category', data: { name: newCatName.trim(), description: newCatDesc.trim() || null } }),
    })
    const data = await res.json()
    if (data.ok) {
      setCategories(prev => [...prev, { id: data.id, name: newCatName.trim(), description: newCatDesc.trim() || null, is_active: true }].sort((a, b) => a.name.localeCompare(b.name)))
      setNewCatName('')
      setNewCatDesc('')
    }
    setSaving(false)
  }

  // ── Deactivate category ───────────────────────────────────────────────
  async function deactivateCategory(catId: number) {
    if (!confirm('Deactivate this category?')) return
    const res = await fetch('/api/hr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deactivate-category', id: catId }),
    })
    if (res.ok) {
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, is_active: false } : c))
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
      <MobileNav />

      <main style={{ flex: 1, padding: 32, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <a href="/hr" style={{ color: '#2176d9', textDecoration: 'none', fontSize: 14 }}>HR Events</a>
          <span style={{ color: '#ccc' }}>/</span>
          <span style={{ fontSize: 14, color: '#666' }}>Settings</span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', marginBottom: 28 }}>HR Settings</h1>

        {/* Farm Logos */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Farm Logos</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            Upload a logo for each farm. This appears on the letterhead of generated PDF documents.
          </p>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {farms.map(f => (
              <div key={f.id} style={{
                border: '1px solid #e9ecef', borderRadius: 10, padding: 16,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 8, background: '#f8f9fa',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0, border: '1px solid #eee',
                }}>
                  {f.logo_url ? (
                    <img src={f.logo_url} alt={f.code} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ color: '#ccc', fontSize: 11 }}>No logo</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{f.code}</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{f.full_name}</div>
                  <label style={{
                    display: 'inline-block', background: '#2176d9', color: '#fff', padding: '5px 14px',
                    borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    opacity: uploadingLogo === f.id ? 0.6 : 1,
                  }}>
                    {uploadingLogo === f.id ? 'Uploading...' : f.logo_url ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      disabled={uploadingLogo === f.id}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleLogoUpload(f.id, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Types — Validity Settings */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Event Type Validity</h2>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            Set how many months each event type remains active. Leave blank for permanent records (lights, hearings).
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e9ecef' }}>
                <th style={thStyle}>Event Type</th>
                <th style={thStyle}>Weight</th>
                <th style={thStyle}>Escalation</th>
                <th style={{ ...thStyle, width: 160 }}>Validity (months)</th>
                <th style={{ ...thStyle, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {eventTypes.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={tdStyle}>{t.name}</td>
                  <td style={tdStyle}>{t.weight}</td>
                  <td style={tdStyle}>{t.escalation_order ?? '—'}</td>
                  <td style={tdStyle}>
                    <input
                      type="number" min="0" placeholder="Permanent"
                      value={editingValidity[t.id] ?? ''}
                      onChange={e => setEditingValidity(prev => ({ ...prev, [t.id]: e.target.value }))}
                      style={{ width: 100, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}
                    />
                  </td>
                  <td style={tdStyle}>
                    {String(editingValidity[t.id] ?? '') !== String(t.validity_months ?? '') && (
                      <button onClick={() => saveValidity(t.id)} disabled={saving}
                        style={{
                          background: '#2176d9', color: '#fff', border: 'none', padding: '5px 12px',
                          borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        }}>
                        Save
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reason Categories */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Reason Categories</h2>

          {/* Add new */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Category Name</label>
              <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                placeholder="e.g. Harassment" style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Description (optional)</label>
              <input type="text" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)}
                placeholder="Brief description" style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={createCategory} disabled={saving || !newCatName.trim()}
              style={{
                background: '#2176d9', color: '#fff', border: 'none', padding: '8px 18px',
                borderRadius: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              Add
            </button>
          </div>

          {/* List */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e9ecef' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0', opacity: c.is_active ? 1 : 0.5 }}>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.description ?? '—'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: c.is_active ? '#e8f5e9' : '#f5f5f5',
                      color: c.is_active ? '#2e7d32' : '#9e9e9e',
                      padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                    }}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={tdStyle}>
                    {c.is_active && (
                      <button onClick={() => deactivateCategory(c.id)}
                        style={{
                          background: 'none', border: '1px solid #e85a4a', color: '#e85a4a',
                          padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        }}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontWeight: 600, color: '#555', fontSize: 12 }
const tdStyle: React.CSSProperties = { padding: '12px 14px' }

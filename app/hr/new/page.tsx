'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; full_name: string }
interface Employee { id: string; full_name: string; employee_nr: string; farm_id: string; team: string | null }
interface EventType { id: number; name: string; weight: number; validity_months: number | null; escalation_order: number | null }
interface ReasonCategory { id: number; name: string }
interface ActiveWarning {
  id: string
  event_type_id: number
  event_date: string
  expires_at: string | null
  hr_event_types: { name: string; escalation_order: number | null } | null
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function NewHrEventPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()
  const router = useRouter()

  const [farms, setFarms] = useState<Farm[]>([])
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [categories, setCategories] = useState<ReasonCategory[]>([])

  // Form fields
  const [selectedFarm, setSelectedFarm] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [eventTypeId, setEventTypeId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [comments, setComments] = useState('')
  const [actionedBy, setActionedBy] = useState('')
  const [chairPerson, setChairPerson] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Escalation
  const [activeWarnings, setActiveWarnings] = useState<ActiveWarning[]>([])
  const [escalationMsg, setEscalationMsg] = useState<string | null>(null)
  const [suggestedTypeId, setSuggestedTypeId] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)

  // ── Load farms ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const supabase = createClient()
      if (farmIds.length === 0 && isSuperAdmin) {
        const { data } = await supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('code')
        setFarms(data ?? [])
        setEffectiveFarmIds((data ?? []).map((f: Farm) => f.id))
      } else {
        const { data } = await supabase.from('farms').select('id, code, full_name').in('id', farmIds).order('code')
        setFarms(data ?? [])
        setEffectiveFarmIds(farmIds)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin])

  // ── Load reference data ───────────────────────────────────────────────
  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    async function load() {
      const supabase = createClient()
      const [typesRes, catsRes] = await Promise.all([
        supabase.from('hr_event_types').select('*').order('id'),
        supabase.from('hr_reason_categories').select('*').eq('is_active', true).order('name'),
      ])
      setEventTypes(typesRes.data ?? [])
      setCategories(catsRes.data ?? [])
    }
    load()
  }, [effectiveFarmIds])

  // ── Load employees when farm changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedFarm) { setEmployees([]); return }
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('qc_employees')
        .select('id, full_name, employee_nr, farm_id, team')
        .eq('farm_id', selectedFarm)
        .eq('is_active', true)
        .order('full_name')
      setEmployees(data ?? [])
    }
    load()
  }, [selectedFarm])

  // ── Auto-escalation check ─────────────────────────────────────────────
  const checkEscalation = useCallback(async (empId: string, catId: string) => {
    if (!empId || !catId) {
      setActiveWarnings([])
      setEscalationMsg(null)
      setSuggestedTypeId(null)
      return
    }
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('hr_events')
      .select('id, event_type_id, event_date, expires_at, hr_event_types(name, escalation_order)')
      .eq('employee_id', empId)
      .eq('reason_category_id', Number(catId))
      .eq('status', 'active')
      .gte('expires_at', today)
      .order('event_date', { ascending: false })

    const warnings = (data ?? []) as unknown as ActiveWarning[]
    setActiveWarnings(warnings)

    if (warnings.length === 0) {
      setEscalationMsg(null)
      setSuggestedTypeId(null)
      return
    }

    // Find highest escalation_order
    let maxOrder = 0
    let latestWarning: ActiveWarning | null = null
    for (const w of warnings) {
      const eo = w.hr_event_types?.escalation_order ?? 0
      if (eo > maxOrder) {
        maxOrder = eo
        latestWarning = w
      }
    }

    // Find next escalation step from event types
    const nextType = eventTypes.find(t => t.escalation_order === maxOrder + 1)

    if (nextType && latestWarning) {
      const catName = categories.find(c => c.id === Number(catId))?.name ?? 'this category'
      const expiresLabel = latestWarning.expires_at ? ` (expires ${latestWarning.expires_at})` : ''
      setEscalationMsg(
        `Employee has active ${latestWarning.hr_event_types?.name} for '${catName}'${expiresLabel}. Next level: ${nextType.name}.`
      )
      setSuggestedTypeId(nextType.id)
      setEventTypeId(String(nextType.id))
    } else if (maxOrder >= 4 && latestWarning) {
      setEscalationMsg(
        `Employee already has active Final Written Warning. Consider scheduling a Disciplinary Hearing.`
      )
      setSuggestedTypeId(3) // Schedule Disciplinary Hearing
      setEventTypeId('3')
    } else {
      setEscalationMsg(null)
      setSuggestedTypeId(null)
    }
  }, [eventTypes, categories])

  useEffect(() => {
    if (selectedEmployee && categoryId) {
      checkEscalation(selectedEmployee.id, categoryId)
    }
  }, [selectedEmployee, categoryId, checkEscalation])

  // ── Photo handling ────────────────────────────────────────────────────
  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // ── Employee typeahead ────────────────────────────────────────────────
  const filteredEmployees = employees.filter(e => {
    if (!employeeSearch) return true
    const term = employeeSearch.toLowerCase()
    return e.full_name.toLowerCase().includes(term) || e.employee_nr.toLowerCase().includes(term)
  }).slice(0, 15)

  // ── Submit ────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEmployee || !eventTypeId || !eventDate || !selectedFarm || !categoryId) return
    setSaving(true)

    let photoUrl: string | null = null

    // Upload photo if present
    if (photoFile) {
      const formData = new FormData()
      formData.append('file', photoFile)
      const ts = Date.now()
      const path = `${selectedFarm}/${selectedEmployee.id}/${ts}_${photoFile.name}`
      formData.append('path', path)

      const uploadRes = await fetch('/api/hr/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()
      if (uploadData.ok) photoUrl = uploadData.fileUrl
    }

    const res = await fetch('/api/hr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-event',
        data: {
          farm_id: selectedFarm,
          employee_id: selectedEmployee.id,
          event_type_id: Number(eventTypeId),
          reason_category_id: categoryId ? Number(categoryId) : null,
          event_date: eventDate,
          reason,
          comments,
          actioned_by: actionedBy || null,
          chair_person: chairPerson || null,
          photo_url: photoUrl,
          escalated_from_id: activeWarnings.length > 0 ? activeWarnings[0].id : null,
        },
      }),
    })

    if (res.ok) {
      router.push('/hr')
    } else {
      const err = await res.json()
      alert('Error: ' + (err.error || 'Failed to save'))
    }
    setSaving(false)
  }

  const isHearing = Number(eventTypeId) === 3

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
      <MobileNav />

      <main style={{ flex: 1, padding: 32, maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', marginBottom: 24 }}>New HR Event</h1>

        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          {/* Farm */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Farm *</label>
            <select value={selectedFarm} onChange={e => { setSelectedFarm(e.target.value); setSelectedEmployee(null); setEmployeeSearch('') }}
              required style={inputStyle}>
              <option value="">Select farm...</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.code} — {f.full_name}</option>)}
            </select>
          </div>

          {/* Employee typeahead */}
          <div style={{ marginBottom: 20, position: 'relative' }}>
            <label style={labelStyle}>Employee *</label>
            {selectedEmployee ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0f7ff', borderRadius: 8, border: '1px solid #2176d9' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{selectedEmployee.full_name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{selectedEmployee.employee_nr}{selectedEmployee.team ? ` — ${selectedEmployee.team}` : ''}</div>
                </div>
                <button type="button" onClick={() => { setSelectedEmployee(null); setEmployeeSearch('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 18 }}>x</button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder={selectedFarm ? 'Search by name or employee nr...' : 'Select a farm first'}
                  value={employeeSearch}
                  onChange={e => { setEmployeeSearch(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  disabled={!selectedFarm}
                  style={inputStyle}
                />
                {showDropdown && filteredEmployees.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: '#fff', border: '1px solid #ddd', borderRadius: 8, maxHeight: 250, overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  }}>
                    {filteredEmployees.map(emp => (
                      <div key={emp.id}
                        onClick={() => { setSelectedEmployee(emp); setShowDropdown(false); setEmployeeSearch('') }}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <div style={{ fontWeight: 500 }}>{emp.full_name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{emp.employee_nr}{emp.team ? ` — ${emp.team}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Reason Category */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Reason Category *</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={inputStyle}>
              <option value="">Select category...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Auto-escalation panel */}
          {escalationMsg && (
            <div style={{
              background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: 16, marginBottom: 20,
            }}>
              <div style={{ fontWeight: 600, color: '#e65100', marginBottom: 4, fontSize: 13 }}>Escalation Suggestion</div>
              <div style={{ fontSize: 13, color: '#5d4037' }}>{escalationMsg}</div>
            </div>
          )}

          {/* Event Type */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Event Type *</label>
            <select value={eventTypeId} onChange={e => setEventTypeId(e.target.value)} required style={inputStyle}>
              <option value="">Select type...</option>
              {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name} (weight: {t.weight})</option>)}
            </select>
            {suggestedTypeId && Number(eventTypeId) !== suggestedTypeId && (
              <div style={{ fontSize: 12, color: '#e65100', marginTop: 4 }}>
                Suggested: {eventTypes.find(t => t.id === suggestedTypeId)?.name} (auto-escalation)
              </div>
            )}
          </div>

          {/* Date */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Event Date *</label>
            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required style={inputStyle} />
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Reason / Detail</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} placeholder="Describe the incident..." />
          </div>

          {/* Comments */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Comments</label>
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} placeholder="Additional notes..." />
          </div>

          {/* Actioned By */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Actioned By</label>
            <input type="text" value={actionedBy} onChange={e => setActionedBy(e.target.value)}
              style={inputStyle} placeholder="Name of person actioning" />
          </div>

          {/* Chair Person (only for hearings) */}
          {isHearing && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Chair Person</label>
              <input type="text" value={chairPerson} onChange={e => setChairPerson(e.target.value)}
                style={inputStyle} placeholder="Name of chairperson" />
            </div>
          )}

          {/* Photo capture */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Document Photo</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{
                flex: 1, textAlign: 'center', padding: '10px 0', background: '#fff', color: '#2176d9',
                border: '1px solid #2176d9', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Choose File
                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handlePhoto} />
              </label>
              <label style={{
                flex: 1, textAlign: 'center', padding: '10px 0', background: '#fff', color: '#4caf72',
                border: '1px solid #4caf72', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Take a Photo
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
              </label>
            </div>
            {photoPreview && (
              <div style={{ marginTop: 10 }}>
                <img src={photoPreview} alt="Preview" style={{ maxWidth: 200, borderRadius: 8, border: '1px solid #ddd' }} />
                <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: '#e85a4a', fontSize: 12, cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={saving || !selectedEmployee || !eventTypeId || !categoryId}
              style={{
                background: saving ? '#999' : '#2176d9', color: '#fff', padding: '12px 28px',
                borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
              }}>
              {saving ? 'Saving...' : 'Create Event'}
            </button>
            <a href="/hr" style={{
              padding: '12px 28px', borderRadius: 8, border: '1px solid #ddd',
              textDecoration: 'none', color: '#666', fontSize: 14, display: 'inline-flex', alignItems: 'center',
            }}>Cancel</a>
          </div>
        </form>
      </main>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }

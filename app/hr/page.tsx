'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; full_name: string }
interface EventType { id: number; name: string; weight: number; validity_months: number | null; escalation_order: number | null }
interface ReasonCategory { id: number; name: string }
interface HrEvent {
  id: string
  farm_id: string
  employee_id: string
  event_type_id: number
  reason_category_id: number | null
  event_date: string
  reason: string | null
  comments: string | null
  status: string
  expires_at: string | null
  actioned_by: string | null
  chair_person: string | null
  photo_url: string | null
  created_at: string
  qc_employees: { full_name: string; employee_nr: string; farm_id: string } | null
  hr_event_types: { name: string; weight: number } | null
  hr_reason_categories: { name: string } | null
  farms: { code: string } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Red Light':                     { bg: '#fce4ec', text: '#c62828' },
  'Green Light':                   { bg: '#e8f5e9', text: '#2e7d32' },
  'Schedule Disciplinary Hearing': { bg: '#fff3e0', text: '#e65100' },
  'Verbal Warning':                { bg: '#fff8e1', text: '#f9a825' },
  'Absenteeism Formal Letter':     { bg: '#fff8e1', text: '#f9a825' },
  'First Written Warning':         { bg: '#fff3e0', text: '#ef6c00' },
  'Second Written Warning':        { bg: '#fbe9e7', text: '#d84315' },
  'Final Written Warning':         { bg: '#fce4ec', text: '#b71c1c' },
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg: '#e8f5e9', text: '#2e7d32', label: 'Active' },
  expired:   { bg: '#f5f5f5', text: '#9e9e9e', label: 'Expired' },
  rescinded: { bg: '#fce4ec', text: '#c62828', label: 'Rescinded' },
  appealed:  { bg: '#e3f2fd', text: '#1565c0', label: 'Appealed' },
}

function computeDisplayStatus(event: HrEvent): string {
  if (event.status === 'rescinded') return 'rescinded'
  if (event.status === 'appealed') return 'appealed'
  if (event.expires_at && new Date(event.expires_at) < new Date()) return 'expired'
  return 'active'
}

function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  return diff
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function HrDashboardPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [farms, setFarms] = useState<Farm[]>([])
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [categories, setCategories] = useState<ReasonCategory[]>([])
  const [events, setEvents] = useState<HrEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedFarm, setSelectedFarm] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Detail panel
  const [selectedEvent, setSelectedEvent] = useState<HrEvent | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState('')
  const [uploading, setUploading] = useState(false)

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

  // ── Load reference data + events ──────────────────────────────────────
  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    async function load() {
      setLoading(true)
      const supabase = createClient()

      const [typesRes, catsRes, eventsRes] = await Promise.all([
        supabase.from('hr_event_types').select('*').order('id'),
        supabase.from('hr_reason_categories').select('*').eq('is_active', true).order('name'),
        supabase
          .from('hr_events')
          .select('*, qc_employees(full_name, employee_nr, farm_id), hr_event_types(name, weight), hr_reason_categories(name), farms(code)')
          .in('farm_id', effectiveFarmIds)
          .order('event_date', { ascending: false })
          .limit(500),
      ])

      setEventTypes(typesRes.data ?? [])
      setCategories(catsRes.data ?? [])
      setEvents(eventsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [effectiveFarmIds])

  // ── Filtered events ──────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedFarm && e.farm_id !== selectedFarm) return false
      if (selectedType && e.event_type_id !== Number(selectedType)) return false
      if (selectedCategory && e.reason_category_id !== Number(selectedCategory)) return false
      if (selectedStatus) {
        const ds = computeDisplayStatus(e)
        if (ds !== selectedStatus) return false
      }
      if (dateFrom && e.event_date < dateFrom) return false
      if (dateTo && e.event_date > dateTo) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const name = e.qc_employees?.full_name?.toLowerCase() ?? ''
        const nr = e.qc_employees?.employee_nr?.toLowerCase() ?? ''
        if (!name.includes(term) && !nr.includes(term)) return false
      }
      return true
    })
  }, [events, selectedFarm, selectedType, selectedCategory, selectedStatus, dateFrom, dateTo, searchTerm])

  // ── KPIs ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = new Date()
    const thisMonth = now.toISOString().slice(0, 7)
    const thisYear = now.getFullYear().toString()

    const monthEvents = events.filter(e => e.event_date.startsWith(thisMonth))
    const yearEvents = events.filter(e => e.event_date.startsWith(thisYear))

    const activeWarnings = events.filter(e => {
      const ds = computeDisplayStatus(e)
      return ds === 'active' && (e.hr_event_types?.weight ?? 0) < 0
    })

    const finalWarnings = events.filter(e => {
      return computeDisplayStatus(e) === 'active' && e.event_type_id === 8
    })
    const uniqueFinals = new Set(finalWarnings.map(e => e.employee_id))

    return {
      monthCount: monthEvents.length,
      yearCount: yearEvents.length,
      activeWarnings: activeWarnings.length,
      employeesWithFinal: uniqueFinals.size,
    }
  }, [events])

  // ── Upload signed document handler ─────────────────────────────────
  async function handleDocUpload(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]
    if (!file || !selectedEvent) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const ts = Date.now()
    const path = `${selectedEvent.farm_id}/${selectedEvent.employee_id}/${ts}_${file.name}`
    formData.append('path', path)
    const uploadRes = await fetch('/api/hr/upload', { method: 'POST', body: formData })
    const uploadData = await uploadRes.json()
    if (uploadData.ok) {
      await fetch('/api/hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-event', data: { id: selectedEvent.id, photo_url: uploadData.fileUrl } }),
      })
      setSelectedEvent({ ...selectedEvent, photo_url: uploadData.fileUrl })
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, photo_url: uploadData.fileUrl } : e))
    }
    setUploading(false)
    ev.target.value = ''
  }

  // ── Rescind handler ──────────────────────────────────────────────────
  async function handleRescind(eventId: string) {
    if (!confirm('Are you sure you want to rescind this event?')) return
    const res = await fetch('/api/hr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rescind-event', id: eventId }),
    })
    if (res.ok) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: 'rescinded' } : e))
      setSelectedEvent(prev => prev?.id === eventId ? { ...prev, status: 'rescinded' } : prev)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
      <MobileNav />

      <main style={{ flex: 1, padding: 32, maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>HR Disciplinary Events</h1>
          <a href="/hr/new" style={{
            background: '#2176d9', color: '#fff', padding: '10px 20px', borderRadius: 8,
            textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>+ New Event</a>
        </div>

        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'This Month', value: kpis.monthCount, color: '#2176d9' },
            { label: 'This Year', value: kpis.yearCount, color: '#4caf72' },
            { label: 'Active Warnings', value: kpis.activeWarnings, color: '#e8924a' },
            { label: 'Final Warnings', value: kpis.employeesWithFinal, color: '#e85a4a' },
          ].map(k => (
            <div key={k.label} style={{
              background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              borderLeft: `4px solid ${k.color}`,
            }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          <input
            type="text" placeholder="Search employee..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, width: 200 }}
          />
          <select value={selectedFarm} onChange={e => setSelectedFarm(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}>
            <option value="">All Farms</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.code}</option>)}
          </select>
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}>
            <option value="">All Types</option>
            {eventTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="rescinded">Rescinded</option>
            <option value="appealed">Appealed</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }} />
          <span style={{ color: '#999', fontSize: 13 }}>to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }} />
        </div>

        {/* Events Table */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading events...</div>
          ) : filteredEvents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No events found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Employee</th>
                  <th style={thStyle}>Farm</th>
                  <th style={thStyle}>Event Type</th>
                  <th style={thStyle}>Reason Category</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Expires</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(e => {
                  const ds = computeDisplayStatus(e)
                  const sb = STATUS_BADGES[ds] || STATUS_BADGES.active
                  const tc = EVENT_TYPE_COLORS[e.hr_event_types?.name ?? ''] || { bg: '#f5f5f5', text: '#333' }
                  const daysLeft = daysUntilExpiry(e.expires_at)
                  const expiring = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14
                  return (
                    <tr key={e.id} onClick={() => setSelectedEvent(e)}
                      style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = '#f8f9ff')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                    >
                      <td style={tdStyle}>{e.event_date}</td>
                      <td style={tdStyle}>
                        <a href={`/hr/employee/${e.employee_id}`} onClick={ev => ev.stopPropagation()}
                          style={{ color: '#2176d9', textDecoration: 'none', fontWeight: 500 }}>
                          {e.qc_employees?.full_name ?? '—'}
                        </a>
                        <div style={{ fontSize: 11, color: '#999' }}>{e.qc_employees?.employee_nr}</div>
                      </td>
                      <td style={tdStyle}>{e.farms?.code ?? '—'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          background: tc.bg, color: tc.text, padding: '3px 10px',
                          borderRadius: 12, fontSize: 12, fontWeight: 600,
                        }}>{e.hr_event_types?.name}</span>
                      </td>
                      <td style={tdStyle}>{e.hr_reason_categories?.name ?? '—'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          background: sb.bg, color: sb.text, padding: '3px 10px',
                          borderRadius: 12, fontSize: 12, fontWeight: 500,
                          textDecoration: ds === 'rescinded' ? 'line-through' : 'none',
                        }}>{sb.label}</span>
                      </td>
                      <td style={tdStyle}>
                        {e.expires_at ? (
                          <span style={{ color: expiring && ds === 'active' ? '#e8924a' : '#666', fontWeight: expiring ? 600 : 400 }}>
                            {e.expires_at}{expiring && ds === 'active' ? ` (${daysLeft}d)` : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}>
                        {ds === 'active' && (
                          <button onClick={ev => { ev.stopPropagation(); handleRescind(e.id) }}
                            style={{ background: 'none', border: '1px solid #e85a4a', color: '#e85a4a',
                              padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                            Rescind
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Slide-in Panel */}
        {selectedEvent && (
          <div style={{
            position: 'fixed', top: 0, right: 0, width: 420, height: '100vh',
            background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            zIndex: 1000, overflowY: 'auto', padding: 28,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Event Detail</h2>
              <button onClick={() => setSelectedEvent(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#666' }}>x</button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Employee" value={selectedEvent.qc_employees?.full_name ?? '—'} />
              <Field label="Employee Nr" value={selectedEvent.qc_employees?.employee_nr ?? '—'} />
              <Field label="Farm" value={selectedEvent.farms?.code ?? '—'} />
              <Field label="Event Type" value={selectedEvent.hr_event_types?.name ?? '—'} />
              <Field label="Reason Category" value={selectedEvent.hr_reason_categories?.name ?? '—'} />
              <Field label="Date" value={selectedEvent.event_date} />
              <Field label="Reason" value={selectedEvent.reason ?? '—'} />
              <Field label="Comments" value={selectedEvent.comments ?? '—'} />
              <Field label="Status" value={STATUS_BADGES[computeDisplayStatus(selectedEvent)]?.label ?? selectedEvent.status} />
              <Field label="Expires" value={selectedEvent.expires_at ?? 'Never'} />
              <Field label="Actioned By" value={selectedEvent.actioned_by ?? '—'} />
              <Field label="Chair Person" value={selectedEvent.chair_person ?? '—'} />
              {selectedEvent.photo_url && (
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Signed Document</div>
                  <a href={selectedEvent.photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={selectedEvent.photo_url} alt="Document" style={{ width: '100%', borderRadius: 8, border: '1px solid #eee' }} />
                  </a>
                </div>
              )}

              {/* Upload signed document */}
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
                  {selectedEvent.photo_url ? 'Replace Signed Document' : 'Upload Signed Document'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{
                    flex: 1, textAlign: 'center', padding: '9px 0', background: '#fff', color: '#2176d9',
                    border: '1px solid #2176d9', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: uploading ? 0.5 : 1,
                  }}>
                    Choose File
                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                      disabled={uploading} onChange={async (ev) => { await handleDocUpload(ev) }} />
                  </label>
                  <label style={{
                    flex: 1, textAlign: 'center', padding: '9px 0', background: '#fff', color: '#4caf72',
                    border: '1px solid #4caf72', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: uploading ? 0.5 : 1,
                  }}>
                    Take a Photo
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                      disabled={uploading} onChange={async (ev) => { await handleDocUpload(ev) }} />
                  </label>
                </div>
                {uploading && <div style={{ fontSize: 12, color: '#2176d9', marginTop: 4 }}>Uploading...</div>}
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href={`/hr/employee/${selectedEvent.employee_id}`}
                style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: '#2176d9', color: '#fff',
                  borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600, minWidth: 120 }}>
                Employee File
              </a>
              <a href={`/api/hr/generate-pdf?event_id=${selectedEvent.id}`} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: '#4caf72', color: '#fff',
                  borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600, minWidth: 120 }}>
                Download PDF
              </a>
            </div>

            {/* Email section */}
            <div style={{ marginTop: 16, padding: 14, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Email with PDF</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="email" placeholder="recipient@email.com" value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                <button
                  disabled={sending || !emailTo}
                  onClick={async () => {
                    setSending(true); setSendMsg('')
                    const res = await fetch('/api/hr/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ event_id: selectedEvent.id, to: [emailTo] }),
                    })
                    const data = await res.json()
                    setSendMsg(data.ok ? 'Sent!' : `Error: ${data.error}`)
                    setSending(false)
                  }}
                  style={{
                    background: sending ? '#999' : '#e8924a', color: '#fff', border: 'none',
                    padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: sending ? 'default' : 'pointer',
                  }}>
                  {sending ? '...' : 'Send'}
                </button>
              </div>
              {sendMsg && <div style={{ fontSize: 12, color: sendMsg.startsWith('Error') ? '#e85a4a' : '#4caf72', marginTop: 6 }}>{sendMsg}</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#1a1a2e' }}>{value}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontWeight: 600, color: '#555', fontSize: 12 }
const tdStyle: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'top' }

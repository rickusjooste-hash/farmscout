'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

// ── Types ──────────────────────────────────────────────────────────────────

interface Employee { id: string; full_name: string; employee_nr: string; farm_id: string; team: string | null }
interface Farm { id: string; code: string; full_name: string }
interface HrEvent {
  id: string
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
  hr_event_types: { name: string; weight: number; escalation_order: number | null } | null
  hr_reason_categories: { name: string } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeDisplayStatus(event: HrEvent): string {
  if (event.status === 'rescinded') return 'rescinded'
  if (event.status === 'appealed') return 'appealed'
  if (event.expires_at && new Date(event.expires_at) < new Date()) return 'expired'
  return 'active'
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg: '#e8f5e9', text: '#2e7d32', label: 'Active' },
  expired:   { bg: '#f5f5f5', text: '#9e9e9e', label: 'Expired' },
  rescinded: { bg: '#fce4ec', text: '#c62828', label: 'Rescinded' },
  appealed:  { bg: '#e3f2fd', text: '#1565c0', label: 'Appealed' },
}

const TYPE_COLORS: Record<string, string> = {
  'Red Light': '#c62828',
  'Green Light': '#2e7d32',
  'Schedule Disciplinary Hearing': '#e65100',
  'Verbal Warning': '#f9a825',
  'Absenteeism Formal Letter': '#f9a825',
  'First Written Warning': '#ef6c00',
  'Second Written Warning': '#d84315',
  'Final Written Warning': '#b71c1c',
}

function scoreColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 0) return { bg: '#e8f5e9', text: '#2e7d32', label: 'Good' }
  if (score >= -3) return { bg: '#fff8e1', text: '#f9a825', label: 'Caution' }
  if (score >= -6) return { bg: '#fff3e0', text: '#ef6c00', label: 'At Risk' }
  return { bg: '#fce4ec', text: '#b71c1c', label: 'Critical' }
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EmployeeFilePage() {
  const params = useParams()
  const employeeId = params.id as string
  const { isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [farm, setFarm] = useState<Farm | null>(null)
  const [events, setEvents] = useState<HrEvent[]>([])
  const [loading, setLoading] = useState(true)

  // ── Load data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded || !employeeId) return
    async function load() {
      setLoading(true)
      const supabase = createClient()

      const [empRes, eventsRes] = await Promise.all([
        supabase.from('qc_employees').select('id, full_name, employee_nr, farm_id, team').eq('id', employeeId).single(),
        supabase
          .from('hr_events')
          .select('*, hr_event_types(name, weight, escalation_order), hr_reason_categories(name)')
          .eq('employee_id', employeeId)
          .order('event_date', { ascending: false }),
      ])

      if (empRes.data) {
        setEmployee(empRes.data)
        const { data: farmData } = await supabase.from('farms').select('id, code, full_name').eq('id', empRes.data.farm_id).single()
        setFarm(farmData)
      }
      setEvents(eventsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [contextLoaded, employeeId])

  // ── Computed ──────────────────────────────────────────────────────────
  const activeEvents = useMemo(() =>
    events.filter(e => computeDisplayStatus(e) === 'active'),
  [events])

  const activeWarnings = useMemo(() =>
    activeEvents.filter(e => (e.hr_event_types?.weight ?? 0) < 0),
  [activeEvents])

  const score = useMemo(() =>
    activeWarnings.reduce((sum, e) => sum + (e.hr_event_types?.weight ?? 0), 0),
  [activeWarnings])

  const sc = scoreColor(score)

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
        <ManagerSidebarStyles />
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
        <MobileNav />
        <main style={{ flex: 1, padding: 32 }}>
          <div style={{ color: '#888', textAlign: 'center', marginTop: 80 }}>Loading employee file...</div>
        </main>
      </div>
    )
  }

  if (!employee) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
        <ManagerSidebarStyles />
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
        <MobileNav />
        <main style={{ flex: 1, padding: 32 }}>
          <div style={{ color: '#888', textAlign: 'center', marginTop: 80 }}>Employee not found</div>
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
      <MobileNav />

      <main style={{ flex: 1, padding: 32, maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <a href="/hr" style={{ color: '#2176d9', textDecoration: 'none', fontSize: 14 }}>HR Events</a>
          <span style={{ color: '#ccc' }}>/</span>
          <span style={{ fontSize: 14, color: '#666' }}>Employee File</span>
        </div>

        <div style={{ display: 'flex', gap: 24, marginBottom: 28, flexWrap: 'wrap' }}>
          {/* Employee Info */}
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, flex: '1 1 300px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{employee.full_name}</h1>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
              #{employee.employee_nr} {employee.team ? `| Team: ${employee.team}` : ''}
            </div>
            <div style={{ fontSize: 14, color: '#888' }}>
              Farm: <strong>{farm?.code ?? '—'}</strong> — {farm?.full_name ?? ''}
            </div>
          </div>

          {/* Score Card */}
          <div style={{
            background: sc.bg, borderRadius: 12, padding: 24, minWidth: 180, textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: 12, color: sc.text, marginBottom: 4 }}>Disciplinary Score</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: sc.text }}>{score}</div>
            <div style={{
              display: 'inline-block', background: sc.text, color: '#fff', padding: '3px 14px',
              borderRadius: 12, fontSize: 12, fontWeight: 600, marginTop: 4,
            }}>{sc.label}</div>
            <div style={{ fontSize: 11, color: sc.text, marginTop: 8, opacity: 0.7 }}>
              {activeWarnings.length} active warning{activeWarnings.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Active Warnings */}
        {activeWarnings.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#1a1a2e' }}>Active Warnings</h2>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {activeWarnings.map(e => {
                const daysLeft = e.expires_at ? Math.ceil((new Date(e.expires_at).getTime() - Date.now()) / 86400000) : null
                const tc = TYPE_COLORS[e.hr_event_types?.name ?? ''] || '#666'
                return (
                  <div key={e.id} style={{
                    background: '#fff', borderRadius: 10, padding: 18, borderLeft: `4px solid ${tc}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ fontWeight: 600, color: tc, fontSize: 14, marginBottom: 4 }}>
                      {e.hr_event_types?.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                      {e.event_date} — {e.hr_reason_categories?.name ?? 'No category'}
                    </div>
                    {e.reason && <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{e.reason}</div>}
                    {daysLeft !== null && (
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: daysLeft <= 14 ? '#e8924a' : '#4caf72',
                      }}>
                        Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} ({e.expires_at})
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Full Timeline */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#1a1a2e' }}>All Events</h2>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            {events.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No disciplinary events on record</div>
            ) : (
              <div style={{ position: 'relative', padding: '20px 24px' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: 36, top: 0, bottom: 0, width: 2, background: '#e9ecef' }} />

                {events.map((e, i) => {
                  const ds = computeDisplayStatus(e)
                  const sc2 = STATUS_COLORS[ds]
                  const tc = TYPE_COLORS[e.hr_event_types?.name ?? ''] || '#666'
                  return (
                    <div key={e.id} style={{ display: 'flex', gap: 16, marginBottom: i < events.length - 1 ? 20 : 0, position: 'relative' }}>
                      {/* Timeline dot */}
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%', background: tc,
                        border: '3px solid #fff', boxShadow: '0 0 0 2px ' + tc,
                        flexShrink: 0, marginTop: 4, zIndex: 1,
                      }} />

                      {/* Event card */}
                      <div style={{ flex: 1, background: '#fafafa', borderRadius: 8, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div>
                            <span style={{
                              fontWeight: 600, fontSize: 14, color: tc,
                              textDecoration: ds === 'rescinded' ? 'line-through' : 'none',
                            }}>{e.hr_event_types?.name}</span>
                            <span style={{
                              marginLeft: 8, background: sc2.bg, color: sc2.text, padding: '2px 8px',
                              borderRadius: 10, fontSize: 11, fontWeight: 500,
                            }}>{sc2.label}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#888' }}>{e.event_date}</div>
                        </div>
                        {e.hr_reason_categories?.name && (
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Category: {e.hr_reason_categories.name}</div>
                        )}
                        {e.reason && <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{e.reason}</div>}
                        {e.comments && <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>{e.comments}</div>}
                        {e.actioned_by && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Actioned by: {e.actioned_by}</div>}
                        {e.chair_person && <div style={{ fontSize: 12, color: '#888' }}>Chair: {e.chair_person}</div>}
                        {e.photo_url && (
                          <div style={{ marginTop: 8 }}>
                            <a href={e.photo_url} target="_blank" rel="noopener noreferrer">
                              <img src={e.photo_url} alt="Document" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }} />
                            </a>
                          </div>
                        )}
                        {e.expires_at && ds === 'active' && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                            Expires: {e.expires_at}
                          </div>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <a href={`/api/hr/generate-pdf?event_id=${e.id}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: '#4caf72', textDecoration: 'none', fontWeight: 500 }}>
                            Download PDF
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useOrgModules } from '@/lib/useOrgModules'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import { useEffect, useState } from 'react'

interface Assignment {
  id: string
  runner_user_id: string
  qc_worker_user_id: string
  runner_name: string
  qc_worker_name: string
  created_at: string
}

interface OrgUser {
  user_id: string
  full_name: string
  role: string
}

export default function QcAssignmentsPage() {
  const supabase = createClient()
  const { isSuperAdmin, contextLoaded, orgId } = useUserContext()
  const modules = useOrgModules()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [runners, setRunners] = useState<OrgUser[]>([])
  const [qcWorkers, setQcWorkers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedRunner, setSelectedRunner] = useState('')
  const [selectedQcWorker, setSelectedQcWorker] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!contextLoaded || !orgId) return
    loadAll()
  }, [contextLoaded, orgId])

  async function loadAll() {
    setLoading(true)
    try {
      await Promise.all([loadAssignments(), loadUsers()])
    } finally {
      setLoading(false)
    }
  }

  async function loadAssignments() {
    if (!orgId) return
    try {
      const res = await fetch(`/api/qc/assignments?organisation_id=${orgId}`)
      const json = await res.json()
      setAssignments(json.assignments || [])
    } catch {
      setAssignments([])
    }
  }

  async function loadUsers() {
    if (!orgId) return
    const { data } = await supabase
      .from('organisation_users')
      .select('user_id, role, user_profiles!inner(full_name)')
      .eq('organisation_id', orgId)
      .in('role', ['runner', 'qc_worker'])

    const users: OrgUser[] = (data || []).map((row: any) => ({
      user_id: row.user_id,
      full_name: row.user_profiles?.full_name || 'Unknown',
      role: row.role,
    }))

    setRunners(users.filter(u => u.role === 'runner'))
    setQcWorkers(users.filter(u => u.role === 'qc_worker'))
  }

  async function handleAssign() {
    if (!selectedRunner || !selectedQcWorker || !orgId) return
    setSaving(true)
    setFlash(null)
    try {
      const res = await fetch('/api/qc/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runner_user_id: selectedRunner,
          qc_worker_user_id: selectedQcWorker,
          organisation_id: orgId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create assignment')
      setFlash({ type: 'success', text: 'Assignment created' })
      setSelectedRunner('')
      setSelectedQcWorker('')
      await loadAssignments()
    } catch (err: any) {
      setFlash({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this assignment?')) return
    setRemoving(id)
    try {
      const res = await fetch('/api/qc/assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const json = await res.json()
        alert(json.error || 'Failed to remove')
      } else {
        setAssignments(prev => prev.filter(a => a.id !== id))
      }
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div style={s.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />

      <main style={s.main}>
        <div style={{ marginBottom: 28 }}>
          <div style={s.title}>Runner Assignments</div>
          <div style={s.subtitle}>
            Link runners to QC workers so each QC worker only sees bags from their assigned runner(s)
          </div>
        </div>

        {/* Current Assignments */}
        <div style={{ ...s.card, padding: 0 }}>
          <div style={{ padding: '20px 24px 12px', fontSize: 18, fontWeight: 700, color: '#1c3a2a' }}>
            Current Assignments
          </div>

          <div style={s.tableHead}>
            <div style={{ flex: 2 }}>Runner</div>
            <div style={{ flex: 2 }}>QC Worker</div>
            <div style={{ flex: 1 }}>Created</div>
            <div style={{ width: 80, textAlign: 'right' }}>Actions</div>
          </div>

          {loading ? (
            <div style={s.empty}>Loading...</div>
          ) : assignments.length === 0 ? (
            <div style={s.empty}>
              No assignments yet. All QC workers see all bags from their farm(s).
            </div>
          ) : (
            assignments.map(a => (
              <div key={a.id} style={s.tableRow}>
                <div style={{ flex: 2, fontWeight: 600, color: '#1c3a2a' }}>{a.runner_name}</div>
                <div style={{ flex: 2, color: '#5a6a60' }}>{a.qc_worker_name}</div>
                <div style={{ flex: 1, color: '#9aaa9f', fontSize: 13 }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString('en-ZA') : '—'}
                </div>
                <div style={{ width: 80, textAlign: 'right' }}>
                  <button
                    style={s.removeBtn}
                    onClick={() => handleRemove(a.id)}
                    disabled={removing === a.id}
                  >
                    {removing === a.id ? '...' : 'Remove'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Assignment */}
        <div style={s.card}>
          <div style={s.cardTitle}>Add Assignment</div>

          <div style={s.formRow}>
            <span style={s.label}>Runner</span>
            <select
              style={s.select}
              value={selectedRunner}
              onChange={e => setSelectedRunner(e.target.value)}
            >
              <option value="">Select a runner...</option>
              {runners.map(r => (
                <option key={r.user_id} value={r.user_id}>{r.full_name}</option>
              ))}
            </select>
          </div>

          <div style={s.formRow}>
            <span style={s.label}>QC Worker</span>
            <select
              style={s.select}
              value={selectedQcWorker}
              onChange={e => setSelectedQcWorker(e.target.value)}
            >
              <option value="">Select a QC worker...</option>
              {qcWorkers.map(w => (
                <option key={w.user_id} value={w.user_id}>{w.full_name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              style={(!selectedRunner || !selectedQcWorker || saving) ? s.btnDisabled : s.btn}
              onClick={handleAssign}
              disabled={!selectedRunner || !selectedQcWorker || saving}
            >
              {saving ? 'Assigning...' : 'Assign'}
            </button>
          </div>

          {flash && (
            <div style={flash.type === 'success' ? s.success : s.error}>
              {flash.text}
            </div>
          )}

          {runners.length === 0 && qcWorkers.length === 0 && !loading && (
            <div style={{ ...s.empty, padding: '16px 0 0' }}>
              No runners or QC workers found. Create app users first on the App Users page.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page:       { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, sans-serif' },
  main:       { flex: 1, padding: 40, overflowY: 'auto' },
  title:      { fontSize: 28, fontWeight: 700, color: '#1c3a2a', letterSpacing: '-0.5px' },
  subtitle:   { fontSize: 14, color: '#9aaa9f', marginTop: 4 },
  card:       { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: 24, marginBottom: 24 },
  cardTitle:  { fontSize: 18, fontWeight: 700, color: '#1c3a2a', marginBottom: 16 },
  tableHead:  { display: 'flex', padding: '10px 16px', background: '#f7f5f0', borderBottom: '1px solid #e8e4dc', fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  tableRow:   { display: 'flex', padding: '12px 16px', borderBottom: '1px solid #f0ede6', alignItems: 'center', fontSize: 14 },
  formRow:    { display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' },
  label:      { fontSize: 13, fontWeight: 600, color: '#5a6a60', width: 110, flexShrink: 0 },
  select:     { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d4cfca', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' },
  btn:        { padding: '10px 24px', borderRadius: 8, border: 'none', background: '#2a6e45', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnDisabled:{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#c4cfc8', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'not-allowed', fontFamily: 'inherit' },
  removeBtn:  { padding: '4px 12px', borderRadius: 6, border: '1px solid #e85a4a', background: '#fff', color: '#e85a4a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
  success:    { padding: '10px 16px', borderRadius: 8, background: '#e8f5e9', color: '#2e7d32', fontSize: 14, marginTop: 12, fontWeight: 500 },
  error:      { padding: '10px 16px', borderRadius: 8, background: '#fff5f4', color: '#c62828', fontSize: 14, marginTop: 12, fontWeight: 500 },
  empty:      { padding: '32px 16px', textAlign: 'center' as const, color: '#9aaa9f', fontSize: 14 },
}

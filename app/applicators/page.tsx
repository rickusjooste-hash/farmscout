'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'

interface Farm { id: string; full_name: string; code: string }
interface Section { id: string; name: string; section_nr: number }
interface Assignment { id: string; user_id: string; section_id: string; assigned_from: string; assigned_until: string | null }
interface Applicator { id: string; full_name: string; assignments: Assignment[] }

export default function ApplicatorsPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, orgId, allowedRoutes, allowed } = usePageGuard()

  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [applicators, setApplicators] = useState<Applicator[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [modules, setModules] = useState<string[]>(['farmscout'])

  // Assignment form
  const [assignUserId, setAssignUserId] = useState<string | null>(null)
  const [assignSectionId, setAssignSectionId] = useState('')
  const [saving, setSaving] = useState(false)

  // Load farms
  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const { data } = isSuperAdmin
        ? await supabase.from('farms').select('id, full_name, code').eq('is_active', true).order('full_name')
        : await supabase.from('farms').select('id, full_name, code').in('id', farmIds).eq('is_active', true).order('full_name')
      setFarms(data || [])
      if (data?.length && !selectedFarmId) setSelectedFarmId(data[0].id)

      if (orgId) {
        const { data: org } = await supabase.from('organisations').select('modules').eq('id', orgId).single()
        if (org?.modules) setModules(org.modules)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin, orgId])

  const fetchApplicators = useCallback(async () => {
    if (!selectedFarmId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/applicators?farm_id=${selectedFarmId}`)
      if (res.ok) {
        const data = await res.json()
        setApplicators(data.users || [])
        setSections(data.sections || [])
      }
    } catch {
      setApplicators([])
      setSections([])
    }
    setLoading(false)
  }, [selectedFarmId])

  useEffect(() => { fetchApplicators() }, [fetchApplicators])

  async function handleAssign() {
    if (!assignUserId || !assignSectionId || !orgId) return
    setSaving(true)
    try {
      await fetch('/api/applicators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: assignUserId,
          section_id: assignSectionId,
          organisation_id: orgId,
        }),
      })
      setAssignUserId(null)
      setAssignSectionId('')
      await fetchApplicators()
    } catch {
      // ignore
    }
    setSaving(false)
  }

  async function handleRemove(assignmentId: string) {
    if (!confirm('Remove this section assignment?')) return
    await fetch('/api/applicators', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: assignmentId }),
    })
    fetchApplicators()
  }

  const sectionMap = Object.fromEntries(sections.map(s => [s.id, s]))

  if (!allowed) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eae6df', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={st.main}>
        <div style={st.headerRow}>
          <div>
            <h1 style={st.pageTitle}>Applicators</h1>
            <p style={st.subtitle}>Manage fertilizer applicator section assignments</p>
          </div>
        </div>

        {/* Farm pills */}
        <div style={st.filterRow}>
          {farms.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFarmId(f.id)}
              style={{ ...st.pill, ...(selectedFarmId === f.id ? st.pillActive : {}) }}
            >
              {f.code || f.full_name}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6a7a70' }}>Loading...</div>
        ) : (
          <div style={st.card}>
            <table style={st.table}>
              <thead>
                <tr>
                  <th style={st.th}>Applicator</th>
                  <th style={st.th}>Assigned Sections</th>
                  <th style={st.th}></th>
                </tr>
              </thead>
              <tbody>
                {applicators.map(app => (
                  <tr key={app.id}>
                    <td style={st.td}>
                      <div style={{ fontWeight: 600, color: '#1a2a3a' }}>{app.full_name}</div>
                    </td>
                    <td style={st.td}>
                      {app.assignments.length === 0 ? (
                        <span style={{ color: '#aaa', fontSize: 13 }}>No sections assigned</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {app.assignments.map(a => {
                            const sec = sectionMap[a.section_id]
                            return (
                              <span key={a.id} style={st.sectionTag}>
                                {sec ? `${sec.section_nr}. ${sec.name}` : a.section_id}
                                <button onClick={() => handleRemove(a.id)} style={st.removeTag}>&times;</button>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </td>
                    <td style={st.td}>
                      {assignUserId === app.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <select
                            value={assignSectionId}
                            onChange={e => setAssignSectionId(e.target.value)}
                            style={st.select}
                          >
                            <option value="">Select section...</option>
                            {sections
                              .filter(s => !app.assignments.some(a => a.section_id === s.id))
                              .map(s => <option key={s.id} value={s.id}>{s.section_nr}. {s.name}</option>)
                            }
                          </select>
                          <button
                            onClick={handleAssign}
                            disabled={saving || !assignSectionId}
                            style={{ ...st.addBtn, opacity: saving ? 0.5 : 1 }}
                          >
                            Add
                          </button>
                          <button onClick={() => setAssignUserId(null)} style={st.cancelBtnSm}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setAssignUserId(app.id)} style={st.assignBtn}>
                          + Assign Section
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {applicators.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ ...st.td, textAlign: 'center', color: '#aaa', padding: 40 }}>
                      No users with farm access found. Add users via the Admin page first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  main: { flex: 1, padding: '32px 40px', overflowY: 'auto', minHeight: '100vh' },
  headerRow: { marginBottom: 24 },
  pageTitle: { fontSize: 24, fontWeight: 700, color: '#1a2a3a', margin: 0 },
  subtitle: { fontSize: 14, color: '#6a7a70', margin: '4px 0 0' },
  filterRow: { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  pill: {
    padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca',
    background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontWeight: 500,
  },
  pillActive: { border: '1px solid #2176d9', background: '#2176d9', color: '#fff' },
  card: {
    background: '#fff', borderRadius: 14, padding: '4px 0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '12px 20px', fontSize: 12, fontWeight: 600,
    color: '#6a7a70', textTransform: 'uppercase', letterSpacing: '0.04em',
    borderBottom: '1px solid #eae6df',
  },
  td: { padding: '14px 20px', borderBottom: '1px solid #f5f3f0', fontSize: 14 },
  sectionTag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', background: '#e8f5e8', color: '#2e6a3e',
    borderRadius: 12, fontSize: 13, fontWeight: 500,
  },
  removeTag: {
    background: 'none', border: 'none', color: '#2e6a3e', cursor: 'pointer',
    fontSize: 16, fontWeight: 700, padding: '0 2px', lineHeight: 1,
  },
  assignBtn: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid #2176d9',
    background: '#fff', color: '#2176d9', fontSize: 13, fontWeight: 500,
    cursor: 'pointer',
  },
  select: {
    padding: '6px 10px', border: '1px solid #d4cfca', borderRadius: 6,
    fontSize: 13, outline: 'none',
  },
  addBtn: {
    padding: '6px 14px', borderRadius: 6, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 13, fontWeight: 500,
    cursor: 'pointer',
  },
  cancelBtnSm: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #d4cfca',
    background: '#fff', color: '#6a7a70', fontSize: 13, cursor: 'pointer',
  },
}

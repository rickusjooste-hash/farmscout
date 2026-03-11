'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useOrgModules } from '@/lib/useOrgModules'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import { useEffect, useState, useRef } from 'react'

interface QcEmployee {
  id: string
  organisation_id: string
  farm_id: string
  employee_nr: string
  full_name: string
  team?: string | null
  is_active: boolean
}

interface AppUser {
  id: string
  user_id: string
  full_name: string
  email: string
  role: string
  created_at: string
}

const s: Record<string, React.CSSProperties> = {
  page:       { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, sans-serif' },
  main:       { flex: 1, padding: 40, overflowY: 'auto' },
  title:      { fontSize: 28, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px' },
  subtitle:   { fontSize: 14, color: '#8a95a0', marginTop: 4 },
  card:       { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: 24, marginBottom: 24 },
  cardTitle:  { fontSize: 18, fontWeight: 700, color: '#1a2a3a', marginBottom: 16 },
  searchWrap: { position: 'relative' as const },
  searchInput:{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d4cfca', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const },
  suggestions:{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d4cfca', borderTop: 'none', borderRadius: '0 0 8px 8px', maxHeight: 220, overflowY: 'auto' as const, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  suggestion: { padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0ede6', display: 'flex', justifyContent: 'space-between' },
  empNr:      { color: '#8a95a0', fontSize: 13 },
  selectedCard:{ background: '#f7f5f0', borderRadius: 10, padding: 20, marginTop: 16, border: '1px solid #e8e4dc' },
  formRow:    { display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' },
  label:      { fontSize: 13, fontWeight: 600, color: '#5a6a60', width: 110, flexShrink: 0 },
  input:      { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d4cfca', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  rolePills:  { display: 'flex', gap: 8 },
  rolePill:   { padding: '6px 16px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
  rolePillOn: { padding: '6px 16px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
  btn:        { padding: '10px 24px', borderRadius: 8, border: 'none', background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnDisabled:{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#c4cfc8', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'not-allowed', fontFamily: 'inherit' },
  success:    { padding: '10px 16px', borderRadius: 8, background: '#e8f5e9', color: '#2e7d32', fontSize: 14, marginTop: 12, fontWeight: 500 },
  error:      { padding: '10px 16px', borderRadius: 8, background: '#fff5f4', color: '#c62828', fontSize: 14, marginTop: 12, fontWeight: 500 },
  tableHead:  { display: 'flex', padding: '10px 16px', background: '#f7f5f0', borderBottom: '1px solid #e8e4dc', borderRadius: '14px 14px 0 0', fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  tableRow:   { display: 'flex', padding: '12px 16px', borderBottom: '1px solid #f0ede6', alignItems: 'center', fontSize: 14 },
  chip:       { display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 },
  revokeBtn:  { padding: '4px 12px', borderRadius: 6, border: '1px solid #e85a4a', background: '#fff', color: '#e85a4a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 },
  empty:      { padding: '32px 16px', textAlign: 'center' as const, color: '#8a95a0', fontSize: 14 },
}

export default function QcAppUsersPage() {
  const supabase = createClient()
  const { isSuperAdmin, contextLoaded, orgId } = useUserContext()
  const modules = useOrgModules()

  // Search state
  const [employees, setEmployees] = useState<QcEmployee[]>([])
  const [search, setSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<QcEmployee | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Create form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'runner' | 'qc_worker'>('runner')
  const [creating, setCreating] = useState(false)
  const [flashMsg, setFlashMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Users list
  const [users, setUsers] = useState<AppUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  // Load employees for search
  useEffect(() => {
    if (!contextLoaded) return
    loadEmployees()
    loadUsers()
  }, [contextLoaded])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadEmployees() {
    const { data } = await supabase
      .from('qc_employees')
      .select('id, organisation_id, farm_id, employee_nr, full_name, team, is_active')
      .eq('is_active', true)
      .order('full_name')
    setEmployees(data || [])
  }

  async function loadUsers() {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/qc/users')
      const json = await res.json()
      setUsers(json.users || [])
    } catch {
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const filtered = search.trim()
    ? employees.filter(e =>
        e.full_name.toLowerCase().includes(search.toLowerCase()) ||
        e.employee_nr.toLowerCase().includes(search.toLowerCase())
      )
    : []

  function selectEmployee(emp: QcEmployee) {
    setSelectedEmployee(emp)
    setSearch('')
    setShowSuggestions(false)
    setEmail('')
    setPassword('')
    setFlashMsg(null)
  }

  async function handleCreate() {
    if (!selectedEmployee || !email || !password || !orgId) return
    setCreating(true)
    setFlashMsg(null)
    try {
      // Give runner/qc_worker access to ALL org farms (they move between farms)
      const { data: orgFarms } = await supabase
        .from('farms')
        .select('id')
        .eq('organisation_id', orgId)
        .eq('is_active', true)
      const allFarmIds = (orgFarms || []).map((f: any) => f.id)

      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'manager',
          role,
          full_name: selectedEmployee.full_name,
          email,
          password,
          organisation_id: orgId,
          farm_ids: allFarmIds.length > 0 ? allFarmIds : [selectedEmployee.farm_id],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create user')
      setFlashMsg({ type: 'success', text: `Login created for ${selectedEmployee.full_name} as ${role === 'runner' ? 'Runner' : 'QC Worker'}` })
      setSelectedEmployee(null)
      setEmail('')
      setPassword('')
      loadUsers()
    } catch (err: any) {
      setFlashMsg({ type: 'error', text: err.message })
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(userId: string) {
    if (!confirm('Revoke this user\'s access? They will no longer be able to log in.')) return
    setRevoking(userId)
    try {
      const res = await fetch('/api/qc/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!res.ok) {
        const json = await res.json()
        alert(json.error || 'Failed to revoke')
      } else {
        setUsers(prev => prev.filter(u => u.user_id !== userId))
      }
    } finally {
      setRevoking(null)
    }
  }

  const roleChipStyle = (r: string): React.CSSProperties => ({
    ...s.chip,
    background: r === 'runner' ? '#e8f5e9' : '#e3f2fd',
    color: r === 'runner' ? '#2e7d32' : '#1565c0',
  })

  return (
    <div style={s.page}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />

      <main style={s.main}>
        <div style={{ marginBottom: 28 }}>
          <div style={s.title}>QC App Users</div>
          <div style={s.subtitle}>Create login accounts for Runners and QC Workers from your employee list</div>
        </div>

        {/* Grant Access Card */}
        <div style={s.card}>
          <div style={s.cardTitle}>Grant App Access</div>

          {/* Search */}
          <div ref={searchRef} style={s.searchWrap}>
            <input
              style={s.searchInput}
              placeholder="Search employee by name or employee number…"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowSuggestions(true) }}
              onFocus={() => search.trim() && setShowSuggestions(true)}
            />
            {showSuggestions && filtered.length > 0 && (
              <div style={s.suggestions}>
                {filtered.slice(0, 20).map(emp => (
                  <div
                    key={emp.id}
                    style={s.suggestion}
                    onMouseDown={() => selectEmployee(emp)}
                    onMouseOver={e => (e.currentTarget.style.background = '#f7f5f0')}
                    onMouseOut={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <span>{emp.full_name}</span>
                    <span style={s.empNr}>#{emp.employee_nr}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected employee form */}
          {selectedEmployee && (
            <div style={s.selectedCard}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2a3a', marginBottom: 4 }}>
                {selectedEmployee.full_name}
              </div>
              <div style={{ fontSize: 13, color: '#8a95a0', marginBottom: 16 }}>
                Employee #{selectedEmployee.employee_nr}
                {selectedEmployee.team && ` · Team ${selectedEmployee.team}`}
              </div>

              <div style={s.formRow}>
                <span style={s.label}>Email</span>
                <input
                  style={s.input}
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div style={s.formRow}>
                <span style={s.label}>Password</span>
                <input
                  style={s.input}
                  type="text"
                  placeholder="Temporary password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <div style={s.formRow}>
                <span style={s.label}>Role</span>
                <div style={s.rolePills}>
                  <button
                    style={role === 'runner' ? s.rolePillOn : s.rolePill}
                    onClick={() => setRole('runner')}
                  >
                    Runner
                  </button>
                  <button
                    style={role === 'qc_worker' ? s.rolePillOn : s.rolePill}
                    onClick={() => setRole('qc_worker')}
                  >
                    QC Worker
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  style={(!email || !password || creating) ? s.btnDisabled : s.btn}
                  onClick={handleCreate}
                  disabled={!email || !password || creating}
                >
                  {creating ? 'Creating…' : 'Create Login'}
                </button>
              </div>
            </div>
          )}

          {flashMsg && (
            <div style={flashMsg.type === 'success' ? s.success : s.error}>
              {flashMsg.text}
            </div>
          )}
        </div>

        {/* Active Users Card */}
        <div style={{ ...s.card, padding: 0 }}>
          <div style={{ padding: '20px 24px 12px', fontSize: 18, fontWeight: 700, color: '#1a2a3a' }}>
            Active Users
          </div>

          {/* Table header */}
          <div style={s.tableHead}>
            <div style={{ flex: 2 }}>Name</div>
            <div style={{ flex: 2 }}>Email</div>
            <div style={{ flex: 1 }}>Role</div>
            <div style={{ flex: 1 }}>Created</div>
            <div style={{ width: 80, textAlign: 'right' }}>Actions</div>
          </div>

          {loadingUsers ? (
            <div style={s.empty}>Loading…</div>
          ) : users.length === 0 ? (
            <div style={s.empty}>No Runner or QC Worker accounts yet.</div>
          ) : (
            users.map(u => (
              <div key={u.id} style={s.tableRow}>
                <div style={{ flex: 2, fontWeight: 600, color: '#1a2a3a' }}>{u.full_name}</div>
                <div style={{ flex: 2, color: '#5a6a60' }}>{u.email}</div>
                <div style={{ flex: 1 }}>
                  <span style={roleChipStyle(u.role)}>
                    {u.role === 'runner' ? 'Runner' : 'QC Worker'}
                  </span>
                </div>
                <div style={{ flex: 1, color: '#8a95a0', fontSize: 13 }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('en-ZA') : '—'}
                </div>
                <div style={{ width: 80, textAlign: 'right' }}>
                  <button
                    style={s.revokeBtn}
                    onClick={() => handleRevoke(u.user_id)}
                    disabled={revoking === u.user_id}
                  >
                    {revoking === u.user_id ? '…' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}

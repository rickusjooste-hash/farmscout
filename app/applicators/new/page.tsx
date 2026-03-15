'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePageGuard } from '@/lib/usePageGuard'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'

interface Farm {
  id: string
  full_name: string
  code: string
}

interface CreatedApplicator {
  full_name: string
  email: string
  password: string
}

export default function NewApplicatorPage() {
  const { isSuperAdmin, allowedRoutes, allowed } = usePageGuard()
  const supabase = createClient()
  const router = useRouter()

  const [organisationId, setOrganisationId] = useState('')
  const [farms, setFarms] = useState<Farm[]>([])
  const [modules, setModules] = useState<string[]>(['farmscout'])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedApplicator | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [farmId, setFarmId] = useState('')

  useEffect(() => {
    async function loadContext() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: orgUser } = await supabase
        .from('organisation_users')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single()

      if (!orgUser) { router.push('/'); return }
      setOrganisationId(orgUser.organisation_id)

      const { data: farmAccess } = await supabase
        .from('user_farm_access')
        .select('farm_id, farms(id, full_name, code)')
        .eq('user_id', user.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let farmList: Farm[] = (farmAccess || [])
        .map((fa: any) => fa.farms)
        .filter(Boolean)

      if (farmList.length === 0) {
        const { data: allFarms } = await supabase
          .from('farms')
          .select('id, full_name, code')
          .eq('organisation_id', orgUser.organisation_id)
          .order('full_name')
        farmList = allFarms || []
      }

      setFarms(farmList)
      if (farmList.length === 1) setFarmId(farmList[0].id)

      const { data: org } = await supabase.from('organisations').select('modules').eq('id', orgUser.organisation_id).single()
      if (org?.modules) setModules(org.modules)

      setLoading(false)
    }
    loadContext()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        organisation_id: organisationId,
        farm_id: farmId,
        type: 'applicator',
      }),
    })

    const json = await res.json()
    setSubmitting(false)

    if (!res.ok || json.error) {
      setError(json.error || 'An error occurred')
      return
    }

    setCreated({ full_name: fullName, email, password })
  }

  if (!allowed) return null

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', fontSize: 18, color: '#1a2a3a', background: '#eae6df' }}>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eae6df', fontFamily: 'Inter, sans-serif' }}>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 640 }}>
        {created ? (
          <div style={st.card}>
            <h2 style={st.title}>Applicator Created</h2>
            <p style={st.subtitle}>
              {created.full_name} can now log into the FertApp. Share these credentials:
            </p>
            <div style={st.credBox}>
              <div style={st.credRow}>
                <span style={st.credLabel}>Name</span>
                <span style={st.credValue}>{created.full_name}</span>
              </div>
              <div style={st.credRow}>
                <span style={st.credLabel}>Email</span>
                <span style={st.credValue}>{created.email}</span>
              </div>
              <div style={{ ...st.credRow, borderBottom: 'none' }}>
                <span style={st.credLabel}>Password</span>
                <span style={st.credValue}>{created.password}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => router.push('/orchards/fertilizer')}
                style={st.primaryBtn}
              >
                Go to Fertilizer
              </button>
              <button
                onClick={() => {
                  setCreated(null)
                  setFullName('')
                  setEmail('')
                  setPassword('')
                  if (farms.length !== 1) setFarmId('')
                }}
                style={st.secondaryBtn}
              >
                Add Another
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 style={st.pageTitle}>New Applicator</h1>
            <p style={st.pageSub}>Create login credentials for a fertilizer applicator.</p>

            <div style={st.card}>
              {error && <div style={st.error}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div style={st.field}>
                  <label style={st.label}>Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Johan van der Merwe"
                    required
                    style={st.input}
                  />
                </div>

                <div style={st.field}>
                  <label style={st.label}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. johan@farm.co.za"
                    required
                    style={st.input}
                  />
                </div>

                <div style={st.field}>
                  <label style={st.label}>Temporary Password</label>
                  <input
                    type="text"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Share this with the applicator"
                    required
                    style={st.input}
                  />
                </div>

                {farms.length > 1 && (
                  <div style={st.field}>
                    <label style={st.label}>Farm</label>
                    <select
                      value={farmId}
                      onChange={e => setFarmId(e.target.value)}
                      required
                      style={st.input}
                    >
                      <option value="">Select a farm...</option>
                      {farms.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.full_name} ({f.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {farms.length === 1 && (
                  <div style={st.field}>
                    <label style={st.label}>Farm</label>
                    <input
                      type="text"
                      value={`${farms[0].full_name} (${farms[0].code})`}
                      readOnly
                      style={{ ...st.input, background: '#f5f3f0', color: '#6a7a70' }}
                    />
                  </div>
                )}

                <button type="submit" disabled={submitting} style={st.submitBtn}>
                  {submitting ? 'Creating applicator...' : 'Create Applicator'}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  pageTitle: {
    fontSize: 24, fontWeight: 700, color: '#1a2a3a', margin: '0 0 4px',
  },
  pageSub: {
    fontSize: 14, color: '#6a7a70', margin: '0 0 24px',
  },
  card: {
    background: '#fff', borderRadius: 14, padding: '28px 32px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  title: {
    fontSize: 22, fontWeight: 700, color: '#1a2a3a', margin: '0 0 6px',
  },
  subtitle: {
    fontSize: 14, color: '#6a7a70', margin: '0 0 20px',
  },
  field: {
    marginBottom: 18,
  },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#6a7a70',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d4cfca',
    fontSize: 14, color: '#1a2a3a', background: '#fff', outline: 'none',
    fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' as const,
  },
  submitBtn: {
    width: '100%', padding: 12, borderRadius: 10, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: 8,
  },
  error: {
    background: '#fdf0ee', border: '1px solid #f5c5be', color: '#c0392b',
    borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 18,
  },
  credBox: {
    background: '#f5f3f0', borderRadius: 10, padding: 20, marginBottom: 20,
  },
  credRow: {
    display: 'flex', justifyContent: 'space-between', padding: '8px 0',
    fontSize: 13, borderBottom: '1px solid #e8e4dc',
  },
  credLabel: {
    color: '#6a7a70', fontWeight: 600,
  },
  credValue: {
    color: '#1a2a3a', fontWeight: 500, fontFamily: 'monospace',
  },
  primaryBtn: {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  secondaryBtn: {
    padding: '10px 20px', borderRadius: 8, border: '1px solid #d4cfca',
    background: '#fff', color: '#1a2a3a', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
}

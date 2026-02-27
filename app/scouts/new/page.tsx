'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Farm {
  id: string
  full_name: string
  code: string
}

interface CreatedScout {
  full_name: string
  email: string
  password: string
  scout_id: string
}

export default function NewScoutPage() {
  const supabase = createClient()
  const router = useRouter()

  const [organisationId, setOrganisationId] = useState('')
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedScout | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [employeeNr, setEmployeeNr] = useState('')
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

      let farmList: Farm[] = (farmAccess || [])
        .map((fa: any) => fa.farms)
        .filter(Boolean)

      // Fallback: if user has no farm_access rows, load all farms for their org
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
        employee_nr: employeeNr || undefined,
        type: 'scout',
      }),
    })

    const json = await res.json()
    setSubmitting(false)

    if (!res.ok || json.error) {
      setError(json.error || 'An error occurred')
      return
    }

    setCreated({ full_name: fullName, email, password, scout_id: json.scout_id })
  }

  if (loading) {
    return <div style={styles.loading}>Loading…</div>
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f1eb; color: #1a1a1a; }
        .app { display: flex; min-height: 100vh; }
        .sidebar {
          width: 220px; min-height: 100vh; background: #1c3a2a;
          padding: 32px 20px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
        }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #a8d5a2; margin-bottom: 32px; }
        .logo span { color: #fff; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 8px; color: #8aab96; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .nav-item:hover { background: #2a4f38; color: #fff; }
        .nav-item.active { background: #2a4f38; color: #a8d5a2; }
        .sidebar-footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #2a4f38; font-size: 12px; color: #4a7a5a; }
        .main { flex: 1; padding: 40px; max-width: 640px; }
        label { display: block; font-size: 12px; font-weight: 600; color: #6a7a70; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
        input, select {
          width: 100%; padding: 10px 14px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #1c3a2a;
          background: #fff; outline: none; transition: border-color 0.15s;
        }
        input:focus, select:focus { border-color: #2a6e45; }
        .field { margin-bottom: 20px; }
        .btn-submit {
          width: 100%; padding: 12px; border-radius: 10px; border: none;
          background: #1c3a2a; color: #a8d5a2; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s;
        }
        .btn-submit:hover { background: #2a4f38; }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .error { background: #fdf0ee; border: 1px solid #f5c5be; color: #c0392b; border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-bottom: 20px; }
        .success-card { background: #fff; border-radius: 14px; border: 1px solid #e8e4dc; padding: 32px; }
        .success-title { font-family: 'DM Serif Display', serif; font-size: 24px; color: #1c3a2a; margin-bottom: 8px; }
        .success-sub { font-size: 14px; color: #7a8a80; margin-bottom: 24px; }
        .cred-box { background: #f4f1eb; border-radius: 10px; padding: 20px; margin-bottom: 24px; }
        .cred-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #e8e4dc; }
        .cred-row:last-child { border-bottom: none; }
        .cred-label { color: #6a7a70; font-weight: 600; }
        .cred-value { color: #1c3a2a; font-weight: 500; font-family: monospace; }
        .btn-link {
          display: inline-block; padding: 10px 20px; border-radius: 8px;
          background: #1c3a2a; color: #a8d5a2; font-size: 13px; font-weight: 600;
          text-decoration: none; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif;
          margin-right: 10px;
        }
        .btn-link-secondary {
          display: inline-block; padding: 10px 20px; border-radius: 8px;
          background: #f4f1eb; color: #3a4a40; font-size: 13px; font-weight: 600;
          text-decoration: none; cursor: pointer; border: 1px solid #e0ddd6; font-family: 'DM Sans', sans-serif;
        }
        .page-title { font-family: 'DM Serif Display', serif; font-size: 28px; color: #1c3a2a; margin-bottom: 6px; }
        .page-sub { font-size: 14px; color: #7a8a80; margin-bottom: 32px; }
        .form-card { background: #fff; border-radius: 14px; border: 1px solid #e8e4dc; padding: 32px; }
        .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9aaa9f; font-weight: 600; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #f0ede6; }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item"><span>🪤</span> Trap Inspections</a>
          <a className="nav-item"><span>🐛</span> Pests</a>
          <a className="nav-item"><span>🪤</span> Traps</a>
          <a className="nav-item"><span>🔍</span> Inspections</a>
          <a href="/scouts" className="nav-item active"><span>👷</span> Scouts</a>
          <a href="/scouts/new" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>➕</span> New Scout</a>
          <a href="/scouts/sections" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>🗂️</span> Sections</a>
          <div className="sidebar-footer">
            <button onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }} style={{
              marginTop: 10, background: 'none', border: '1px solid #2a4f38',
              color: '#6aaa80', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
            }}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="main">
          {created ? (
            <div className="success-card">
              <div className="success-title">Scout Created</div>
              <div className="success-sub">
                {created.full_name} has been added. Share these credentials with them.
              </div>
              <div className="cred-box">
                <div className="cred-row">
                  <span className="cred-label">Name</span>
                  <span className="cred-value">{created.full_name}</span>
                </div>
                <div className="cred-row">
                  <span className="cred-label">Email</span>
                  <span className="cred-value">{created.email}</span>
                </div>
                <div className="cred-row">
                  <span className="cred-label">Password</span>
                  <span className="cred-value">{created.password}</span>
                </div>
              </div>
              <a href="/scouts" className="btn-link">Go to Route Manager</a>
              <button
                className="btn-link-secondary"
                onClick={() => {
                  setCreated(null)
                  setFullName('')
                  setEmail('')
                  setPassword('')
                  setEmployeeNr('')
                  if (farms.length !== 1) setFarmId('')
                }}
              >
                Add Another Scout
              </button>
            </div>
          ) : (
            <>
              <div className="page-title">New Scout</div>
              <div className="page-sub">Create login credentials for a new field scout.</div>

              <div className="form-card">
                <div className="section-title">Scout Details</div>
                {error && <div className="error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="field">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Johan van der Merwe"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. johan@farm.co.za"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Temporary Password</label>
                    <input
                      type="text"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Share this with the scout"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Employee Nr <span style={{ color: '#b0bdb5', fontWeight: 400 }}>(optional)</span></label>
                    <input
                      type="text"
                      value={employeeNr}
                      onChange={e => setEmployeeNr(e.target.value)}
                      placeholder="e.g. EMP-042"
                    />
                  </div>

                  {farms.length > 1 && (
                    <div className="field">
                      <label>Farm</label>
                      <select
                        value={farmId}
                        onChange={e => setFarmId(e.target.value)}
                        required
                      >
                        <option value="">Select a farm…</option>
                        {farms.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.full_name} ({f.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {farms.length === 1 && (
                    <div className="field">
                      <label>Farm</label>
                      <input type="text" value={`${farms[0].full_name} (${farms[0].code})`} readOnly style={{ background: '#f9f7f3', color: '#7a8a80' }} />
                    </div>
                  )}

                  <button type="submit" className="btn-submit" disabled={submitting}>
                    {submitting ? 'Creating scout…' : 'Create Scout'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

const styles = {
  loading: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: '100vh',
    fontFamily: "'DM Serif Display', serif",
    fontSize: 24,
    color: '#1c3a2a',
    background: '#f4f1eb',
  }
}

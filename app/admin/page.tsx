'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Organisation {
  id: string
  name: string
}

interface Farm {
  id: string
  full_name: string
  code: string
  organisation_id: string
}

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'org' | 'farm' | 'user'>('org')

  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [allFarms, setAllFarms] = useState<Farm[]>([])

  // Add Organisation form
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgPlan, setOrgPlan] = useState('')
  const [orgSubmitting, setOrgSubmitting] = useState(false)
  const [orgError, setOrgError] = useState('')
  const [orgSuccess, setOrgSuccess] = useState('')

  // Add Farm form
  const [farmOrgId, setFarmOrgId] = useState('')
  const [farmCode, setFarmCode] = useState('')
  const [farmName, setFarmName] = useState('')
  const [farmPuc, setFarmPuc] = useState('')
  const [farmProvince, setFarmProvince] = useState('')
  const [farmRegion, setFarmRegion] = useState('')
  const [farmSubmitting, setFarmSubmitting] = useState(false)
  const [farmError, setFarmError] = useState('')
  const [farmSuccess, setFarmSuccess] = useState('')

  // Add User form
  const [mgFullName, setMgFullName] = useState('')
  const [mgEmail, setMgEmail] = useState('')
  const [mgPassword, setMgPassword] = useState('')
  const [mgOrgId, setMgOrgId] = useState('')
  const [mgRole, setMgRole] = useState('farm_manager')
  const [mgSelectedFarms, setMgSelectedFarms] = useState<string[]>([])
  const [mgSubmitting, setMgSubmitting] = useState(false)
  const [mgError, setMgError] = useState('')
  const [mgSuccess, setMgSuccess] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: orgUser } = await supabase
        .from('organisation_users')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (!orgUser || orgUser.role !== 'super_admin') {
        router.push('/')
        return
      }

      const [{ data: orgs }, { data: farms }] = await Promise.all([
        supabase.from('organisations').select('id, name').eq('is_active', true).order('name'),
        supabase.from('farms').select('id, full_name, code, organisation_id').order('full_name'),
      ])

      setOrganisations(orgs || [])
      setAllFarms(farms || [])
      if (orgs && orgs.length > 0) {
        setFarmOrgId(orgs[0].id)
        setMgOrgId(orgs[0].id)
      }
      setLoading(false)
    }
    init()
  }, [])

  const farmsForMgOrg = allFarms.filter(f => f.organisation_id === mgOrgId)

  async function handleAddOrg(e: React.FormEvent) {
    e.preventDefault()
    setOrgError('')
    setOrgSuccess('')
    setOrgSubmitting(true)

    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'create-org', name: orgName, slug: orgSlug, plan: orgPlan }),
    })
    const json = await res.json()

    setOrgSubmitting(false)
    if (!res.ok || json.error) {
      setOrgError(json.error || 'An error occurred')
    } else {
      setOrgSuccess(`Organisation "${orgName}" created successfully.`)
      setOrgName('')
      setOrgSlug('')
      setOrgPlan('')
      const { data: orgs } = await supabase.from('organisations').select('id, name').eq('is_active', true).order('name')
      setOrganisations(orgs || [])
    }
  }

  async function handleAddFarm(e: React.FormEvent) {
    e.preventDefault()
    setFarmError('')
    setFarmSuccess('')
    setFarmSubmitting(true)

    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'create-farm',
        organisation_id: farmOrgId,
        code: farmCode,
        full_name: farmName,
        puc: farmPuc,
        province: farmProvince,
        region: farmRegion,
      }),
    })
    const json = await res.json()

    setFarmSubmitting(false)
    if (!res.ok || json.error) {
      setFarmError(json.error || 'An error occurred')
    } else {
      setFarmSuccess(`Farm "${farmName}" created successfully.`)
      setFarmCode('')
      setFarmName('')
      setFarmPuc('')
      setFarmProvince('')
      setFarmRegion('')
      const { data: farms } = await supabase.from('farms').select('id, full_name, code, organisation_id').order('full_name')
      setAllFarms(farms || [])
    }
  }

  async function handleAddManager(e: React.FormEvent) {
    e.preventDefault()
    setMgError('')
    setMgSuccess('')
    setMgSubmitting(true)

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: mgFullName,
        email: mgEmail,
        password: mgPassword,
        organisation_id: mgOrgId,
        farm_ids: mgSelectedFarms,
        type: 'manager',
        role: mgRole,
      }),
    })

    const json = await res.json()
    setMgSubmitting(false)

    if (!res.ok || json.error) {
      setMgError(json.error || 'An error occurred')
    } else {
      setMgSuccess(`User "${mgFullName}" created successfully.`)
      setMgFullName('')
      setMgEmail('')
      setMgPassword('')
      setMgRole('farm_manager')
      setMgSelectedFarms([])
    }
  }

  function toggleFarm(farmId: string) {
    setMgSelectedFarms(prev =>
      prev.includes(farmId) ? prev.filter(f => f !== farmId) : [...prev, farmId]
    )
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#1a2a3a', background: '#f4f1eb' }}>Loading…</div>
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f1eb; color: #1a1a1a; }
        .app { display: flex; min-height: 100vh; }
        .sidebar {
          width: 220px; height: 100vh; position: sticky; top: 0; overflow-y: auto; background: linear-gradient(180deg, #2176d9, #1148a8);
          padding: 32px 20px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
        }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #a0c4f0; margin-bottom: 32px; }
        .logo span { color: #fff; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 8px; color: #7a8fa0; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .nav-item:hover { background: #1a5fb8; color: #fff; }
        .nav-item.active { background: #1a5fb8; color: #a0c4f0; }
        .sidebar-footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #1a5fb8; font-size: 12px; color: #5a7a8a; }
        .main { flex: 1; padding: 40px; max-width: 700px; }
        .page-title { font-family: 'DM Serif Display', serif; font-size: 28px; color: #1a2a3a; margin-bottom: 6px; }
        .page-sub { font-size: 14px; color: #7a8a9a; margin-bottom: 32px; }
        .tabs { display: flex; gap: 2px; margin-bottom: 28px; background: #e8e4dc; border-radius: 10px; padding: 3px; width: fit-content; }
        .tab {
          padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; border: none; font-family: 'DM Sans', sans-serif;
          color: #6a7a70; background: transparent; transition: all 0.15s;
        }
        .tab.active { background: #1a4ba0; color: #a0c4f0; }
        .form-card { background: #fff; border-radius: 14px; border: 1px solid #e8e4dc; padding: 32px; }
        label { display: block; font-size: 12px; font-weight: 600; color: #6a7a70; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
        input, select {
          width: 100%; padding: 10px 14px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #1a2a3a;
          background: #fff; outline: none; transition: border-color 0.15s;
        }
        input:focus, select:focus { border-color: #2176d9; }
        .field { margin-bottom: 20px; }
        .two-col-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .btn-submit {
          width: 100%; padding: 12px; border-radius: 10px; border: none;
          background: #1a4ba0; color: #a0c4f0; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s;
          margin-top: 8px;
        }
        .btn-submit:hover { background: #1a5fb8; }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .error { background: #fdf0ee; border: 1px solid #f5c5be; color: #c0392b; border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-bottom: 20px; }
        .success { background: #f0f4fa; border: 1px solid #a0c4f0; color: #1c5c2a; border-radius: 8px; padding: 12px 16px; font-size: 13px; margin-bottom: 20px; }
        .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a95a0; font-weight: 600; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #eef2fa; }
        .farm-checkboxes { display: flex; flex-direction: column; gap: 8px; }
        .farm-check { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; border: 1.5px solid #e0ddd6; cursor: pointer; transition: all 0.15s; }
        .farm-check:hover { border-color: #2176d9; }
        .farm-check.checked { border-color: #1a4ba0; background: #f0f4fa; }
        .farm-check input[type=checkbox] { width: auto; }
        .farm-check-label { font-size: 13px; color: #1a2a3a; font-weight: 500; }
        .farm-check-code { font-size: 11px; color: #8a95a0; margin-left: auto; }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item"><span>🏡</span> Orchards</a>
          <a href="/pests" className="nav-item"><span>🐛</span> Pests</a>
          <a href="/trap-inspections" className="nav-item"><span>🪤</span> Trap Inspections</a>
          <a href="/inspections" className="nav-item"><span>🔍</span> Inspections</a>
          <a href="/heatmap" className="nav-item"><span>🌡️</span> Heat Map</a>
          <a href="/scouts" className="nav-item"><span>👷</span> Scouts</a>
          <a href="/scouts/new" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>➕</span> New Scout</a>
          <a href="/scouts/sections" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>🗂️</span> Sections</a>
          <a href="/admin" className="nav-item active"><span>⚙️</span> Admin</a>
          <div className="sidebar-footer">
            <button onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }} style={{
              marginTop: 10, background: 'none', border: '1px solid #1a5fb8',
              color: '#6a9fd4', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
            }}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="main">
          <div className="page-title">Admin</div>
          <div className="page-sub">Manage farms and production manager accounts.</div>

          <div className="tabs">
            <button
              className={`tab${activeTab === 'org' ? ' active' : ''}`}
              onClick={() => setActiveTab('org')}
            >
              Add Organisation
            </button>
            <button
              className={`tab${activeTab === 'farm' ? ' active' : ''}`}
              onClick={() => setActiveTab('farm')}
            >
              Add Farm
            </button>
            <button
              className={`tab${activeTab === 'user' ? ' active' : ''}`}
              onClick={() => setActiveTab('user')}
            >
              Add User
            </button>
          </div>

          {activeTab === 'org' && (
            <div className="form-card">
              <div className="section-title">New Organisation</div>
              {orgError && <div className="error">{orgError}</div>}
              {orgSuccess && <div className="success">{orgSuccess}</div>}

              <form onSubmit={handleAddOrg}>
                <div className="two-col-fields">
                  <div className="field">
                    <label>Name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={e => {
                        setOrgName(e.target.value)
                        setOrgSlug(e.target.value.trim().toLowerCase().replace(/\s+/g, '-'))
                      }}
                      placeholder="e.g. Mouton's Valley Group"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Slug</label>
                    <input
                      type="text"
                      value={orgSlug}
                      onChange={e => setOrgSlug(e.target.value)}
                      placeholder="e.g. moutons-valley"
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Plan <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                  <input
                    type="text"
                    value={orgPlan}
                    onChange={e => setOrgPlan(e.target.value)}
                    placeholder="e.g. pro, enterprise"
                  />
                </div>

                <button type="submit" className="btn-submit" disabled={orgSubmitting}>
                  {orgSubmitting ? 'Creating organisation…' : 'Create Organisation'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'farm' && (
            <div className="form-card">
              <div className="section-title">New Farm</div>
              {farmError && <div className="error">{farmError}</div>}
              {farmSuccess && <div className="success">{farmSuccess}</div>}

              <form onSubmit={handleAddFarm}>
                <div className="field">
                  <label>Organisation</label>
                  <select value={farmOrgId} onChange={e => setFarmOrgId(e.target.value)} required>
                    {organisations.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                <div className="two-col-fields">
                  <div className="field">
                    <label>Farm Code</label>
                    <input
                      type="text"
                      value={farmCode}
                      onChange={e => setFarmCode(e.target.value)}
                      placeholder="e.g. MVF"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={farmName}
                      onChange={e => setFarmName(e.target.value)}
                      placeholder="e.g. Mouton's Valley Farm"
                      required
                    />
                  </div>
                </div>

                <div className="two-col-fields">
                  <div className="field">
                    <label>PUC <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <input
                      type="text"
                      value={farmPuc}
                      onChange={e => setFarmPuc(e.target.value)}
                      placeholder="e.g. C001"
                    />
                  </div>
                  <div className="field">
                    <label>Province <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <input
                      type="text"
                      value={farmProvince}
                      onChange={e => setFarmProvince(e.target.value)}
                      placeholder="e.g. Western Cape"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Region <span style={{ color: '#b0bdb5', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                  <input
                    type="text"
                    value={farmRegion}
                    onChange={e => setFarmRegion(e.target.value)}
                    placeholder="e.g. Elgin"
                  />
                </div>

                <button type="submit" className="btn-submit" disabled={farmSubmitting}>
                  {farmSubmitting ? 'Creating farm…' : 'Create Farm'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'user' && (
            <div className="form-card">
              <div className="section-title">New User</div>
              {mgError && <div className="error">{mgError}</div>}
              {mgSuccess && <div className="success">{mgSuccess}</div>}

              <form onSubmit={handleAddManager}>
                <div className="two-col-fields">
                  <div className="field">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={mgFullName}
                      onChange={e => setMgFullName(e.target.value)}
                      placeholder="e.g. Pieter Botha"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={mgEmail}
                      onChange={e => setMgEmail(e.target.value)}
                      placeholder="pieter@farm.co.za"
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Temporary Password</label>
                  <input
                    type="text"
                    value={mgPassword}
                    onChange={e => setMgPassword(e.target.value)}
                    placeholder="Share this with the user"
                    required
                  />
                </div>

                <div className="field">
                  <label>Role</label>
                  <select value={mgRole} onChange={e => setMgRole(e.target.value)} required>
                    <option value="farm_manager">Farm Manager</option>
                    <option value="production_manager">Production Manager</option>
                    <option value="crop_protection_advisor">Crop Protection Advisor</option>
                    <option value="org_admin">Org Admin</option>
                  </select>
                </div>

                <div className="field">
                  <label>Organisation</label>
                  <select
                    value={mgOrgId}
                    onChange={e => { setMgOrgId(e.target.value); setMgSelectedFarms([]) }}
                    required
                  >
                    {organisations.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                {farmsForMgOrg.length > 0 && (
                  <div className="field">
                    <label>Farm Access</label>
                    <div className="farm-checkboxes">
                      {farmsForMgOrg.map(f => (
                        <label
                          key={f.id}
                          className={`farm-check${mgSelectedFarms.includes(f.id) ? ' checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={mgSelectedFarms.includes(f.id)}
                            onChange={() => toggleFarm(f.id)}
                          />
                          <span className="farm-check-label">{f.full_name}</span>
                          <span className="farm-check-code">{f.code}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-submit" disabled={mgSubmitting}>
                  {mgSubmitting ? 'Creating user…' : 'Create User'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

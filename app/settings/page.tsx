'use client'

import { useEffect, useState } from 'react'
import { Inter } from 'next/font/google'
import { createClient } from '@/lib/supabase-auth'

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] })

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Recipient {
  id: string
  email: string
  full_name: string | null
  receives_purchase_list: boolean
  receives_rebait_schedule: boolean
}

interface FarmConfig {
  farm_id: string
  farm_name: string
  settings: {
    id?: string
    send_day_of_week: number
    is_active: boolean
  } | null
  recipients: Recipient[]
}

export default function SettingsPage() {
  const supabase = createClient()
  const [farms, setFarms] = useState<FarmConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingFarm, setSavingFarm] = useState<string | null>(null)
  const [addEmailState, setAddEmailState] = useState<Record<string, { email: string; full_name: string }>>({})
  const [addingFarm, setAddingFarm] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  async function loadSettings() {
    setLoading(true)
    setError(null)
    try {
      // Get current user + org
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not logged in'); setLoading(false); return }

      const { data: orgUser } = await supabase
        .from('organisation_users')
        .select('organisation_id, role')
        .eq('user_id', user.id)
        .single()

      if (!orgUser) { setError('No organisation found'); setLoading(false); return }
      const currentOrgId = orgUser.organisation_id
      setOrgId(currentOrgId)

      // Get all farms for this org
      const { data: farmData, error: farmError } = await supabase
        .from('farms')
        .select('id, full_name')
        .eq('organisation_id', currentOrgId)
        .eq('is_active', true)
        .order('full_name')

      if (farmError) throw farmError

      const farmIds = (farmData || []).map(f => f.id)

      // Get settings + recipients in parallel
      const [{ data: settingsData }, { data: recipientsData }] = await Promise.all([
        supabase.from('rebait_notification_settings')
          .select('*')
          .in('farm_id', farmIds.length > 0 ? farmIds : ['00000000-0000-0000-0000-000000000000']),
        supabase.from('rebait_notification_recipients')
          .select('*')
          .in('farm_id', farmIds.length > 0 ? farmIds : ['00000000-0000-0000-0000-000000000000'])
          .eq('is_active', true)
          .order('created_at'),
      ])

      const settingsMap: Record<string, any> = {}
      for (const s of settingsData || []) settingsMap[s.farm_id] = s

      const recipientsMap: Record<string, Recipient[]> = {}
      for (const r of (recipientsData || []) as Recipient[]) {
        const fid = (r as any).farm_id as string
        if (!recipientsMap[fid]) recipientsMap[fid] = []
        recipientsMap[fid].push(r)
      }

      setFarms((farmData || []).map(f => ({
        farm_id: f.id,
        farm_name: f.full_name,
        settings: settingsMap[f.id] ? {
          id: settingsMap[f.id].id,
          send_day_of_week: settingsMap[f.id].send_day_of_week,
          is_active: settingsMap[f.id].is_active,
        } : null,
        recipients: recipientsMap[f.id] || [],
      })))
    } catch (err: any) {
      setError(err.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveFarmSettings(farmId: string, sendDay: number, isActive: boolean) {
    if (!orgId) return
    setSavingFarm(farmId)
    try {
      const { error } = await supabase.from('rebait_notification_settings').upsert({
        organisation_id: orgId,
        farm_id: farmId,
        send_day_of_week: sendDay,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'farm_id' })
      if (error) throw error
      showSuccess('Settings saved')
      await loadSettings()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSavingFarm(null)
    }
  }

  async function addRecipient(farmId: string) {
    if (!orgId) return
    const state = addEmailState[farmId] || { email: '', full_name: '' }
    if (!state.email.trim()) return
    setAddingFarm(farmId)
    try {
      const { error } = await supabase.from('rebait_notification_recipients').insert({
        organisation_id: orgId,
        farm_id: farmId,
        email: state.email.trim().toLowerCase(),
        full_name: state.full_name.trim() || null,
        receives_purchase_list: true,
        receives_rebait_schedule: true,
        is_active: true,
      })
      if (error) throw error
      setAddEmailState(prev => ({ ...prev, [farmId]: { email: '', full_name: '' } }))
      showSuccess('Recipient added')
      await loadSettings()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setAddingFarm(null)
    }
  }

  async function updateRecipient(id: string, updates: Partial<Recipient>) {
    try {
      const { error } = await supabase.from('rebait_notification_recipients').update(updates).eq('id', id)
      if (error) throw error
      await loadSettings()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  async function removeRecipient(id: string) {
    if (!confirm('Remove this recipient?')) return
    try {
      const { error } = await supabase.from('rebait_notification_recipients').update({ is_active: false }).eq('id', id)
      if (error) throw error
      showSuccess('Recipient removed')
      await loadSettings()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div className={inter.className}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f4f1eb; color: #1a1a1a; min-height: 100vh; }
        .app { display: flex; min-height: 100vh; }
        .sidebar {
          width: 220px; height: 100vh; position: sticky; top: 0; overflow-y: auto;
          background: #1c3a2a; padding: 32px 20px; display: flex;
          flex-direction: column; gap: 8px; flex-shrink: 0;
        }
        .logo { font-size: 22px; color: #a8d5a2; margin-bottom: 32px; letter-spacing: -0.5px; }
        .logo span { color: #fff; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 8px; color: #8aab96; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .nav-item:hover { background: #2a4f38; color: #fff; }
        .nav-item.active { background: #2a4f38; color: #a8d5a2; }
        .main { flex: 1; padding: 40px; overflow-y: auto; }
        .page-title { font-size: 32px; color: #1c3a2a; letter-spacing: -0.5px; margin-bottom: 6px; }
        .page-subtitle { font-size: 14px; color: #7a8a80; font-weight: 300; margin-bottom: 32px; }
        .section-title { font-size: 20px; color: #1c3a2a; font-weight: 600; margin-bottom: 20px; }
        .farm-card { background: #fff; border-radius: 14px; border: 1px solid #e8e4dc; overflow: hidden; margin-bottom: 20px; }
        .farm-card-header { padding: 20px 24px; border-bottom: 1px solid #f0ede6; display: flex; align-items: center; justify-content: space-between; }
        .farm-name { font-size: 17px; font-weight: 600; color: #1c3a2a; }
        .farm-card-body { padding: 20px 24px; }
        .field-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .field-label { font-size: 13px; color: #7a8a80; font-weight: 500; min-width: 100px; }
        select, input[type="text"], input[type="email"] {
          padding: 7px 12px; border-radius: 8px; border: 1px solid #e0ddd5;
          font-size: 13px; color: #1a1a1a; background: #faf9f6; font-family: inherit;
        }
        select:focus, input:focus { outline: 2px solid #2a6e45; border-color: transparent; }
        .btn { padding: 7px 16px; border-radius: 8px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .btn-primary { background: #1c3a2a; color: #a8d5a2; }
        .btn-primary:hover { background: #2a4f38; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-danger { background: #fdecea; color: #e85a4a; border: 1px solid #f5c0bb; }
        .btn-danger:hover { background: #fad3d0; }
        .btn-outline { background: #f4f1eb; color: #3a4a40; border: 1px solid #e0ddd5; }
        .btn-outline:hover { background: #e8e4dc; }
        .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
        .recipients-label { font-size: 12px; color: #9aaa9f; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .recipient-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border: 1px solid #f0ede6; border-radius: 8px; margin-bottom: 8px; background: #faf9f6; flex-wrap: wrap; }
        .recipient-email { font-size: 13px; color: #1c3a2a; font-weight: 500; flex: 1; min-width: 160px; }
        .recipient-name { font-size: 12px; color: #9aaa9f; }
        .checkbox-label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #3a4a40; cursor: pointer; white-space: nowrap; }
        .add-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap; }
        .toggle-active { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #3a4a40; }
        .success-toast { position: fixed; bottom: 24px; right: 24px; background: #1c3a2a; color: #a8d5a2; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item"><span>🏡</span> Orchards</a>
          <a href="/pests" className="nav-item"><span>🐛</span> Pests</a>
          <a href="/scouts" className="nav-item"><span>👷</span> Scouts</a>
          <a href="/settings" className="nav-item active"><span>⚙️</span> Settings</a>
        </aside>

        <main className="main">
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Configure automated reports and notifications per farm</div>

          <div className="section-title">Rebait Email Notifications</div>

          {loading && <div style={{ color: '#9aaa9f', fontSize: 14 }}>Loading…</div>}
          {error && <div style={{ color: '#e85a4a', fontSize: 14 }}>Error: {error}</div>}

          {!loading && !error && farms.map(farm => {
            const settings = farm.settings || { send_day_of_week: 1, is_active: true }
            const addState = addEmailState[farm.farm_id] || { email: '', full_name: '' }

            return (
              <div className="farm-card" key={farm.farm_id}>
                <div className="farm-card-header">
                  <div className="farm-name">{farm.farm_name}</div>
                  <label className="checkbox-label toggle-active">
                    <input
                      type="checkbox"
                      checked={settings.is_active}
                      onChange={e => saveFarmSettings(farm.farm_id, settings.send_day_of_week, e.target.checked)}
                    />
                    Active
                  </label>
                </div>
                <div className="farm-card-body">
                  <div className="field-row">
                    <span className="field-label">Send day</span>
                    <select
                      defaultValue={settings.send_day_of_week}
                      key={`${farm.farm_id}-${settings.send_day_of_week}`}
                      id={`day-${farm.farm_id}`}
                    >
                      {DAY_NAMES.map((name, i) => (
                        <option key={i} value={i}>{name}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-primary"
                      disabled={savingFarm === farm.farm_id}
                      onClick={() => {
                        const sel = document.getElementById(`day-${farm.farm_id}`) as HTMLSelectElement
                        saveFarmSettings(farm.farm_id, parseInt(sel.value, 10), settings.is_active)
                      }}
                    >
                      {savingFarm === farm.farm_id ? 'Saving…' : 'Save'}
                    </button>
                  </div>

                  <div className="recipients-label">Recipients</div>
                  {farm.recipients.length === 0 && (
                    <div style={{ fontSize: 13, color: '#9aaa9f', marginBottom: 12 }}>No recipients yet.</div>
                  )}
                  {farm.recipients.map(r => (
                    <div className="recipient-row" key={r.id}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div className="recipient-email">{r.email}</div>
                        {r.full_name && <div className="recipient-name">{r.full_name}</div>}
                      </div>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={r.receives_purchase_list}
                          onChange={e => updateRecipient(r.id, { receives_purchase_list: e.target.checked })}
                        />
                        Purchase List
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={r.receives_rebait_schedule}
                          onChange={e => updateRecipient(r.id, { receives_rebait_schedule: e.target.checked })}
                        />
                        Schedule
                      </label>
                      <button className="btn btn-danger" onClick={() => removeRecipient(r.id)}>Remove</button>
                    </div>
                  ))}

                  <div className="add-row">
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={addState.email}
                      onChange={e => setAddEmailState(prev => ({ ...prev, [farm.farm_id]: { ...addState, email: e.target.value } }))}
                      style={{ width: 220 }}
                    />
                    <input
                      type="text"
                      placeholder="Name (optional)"
                      value={addState.full_name}
                      onChange={e => setAddEmailState(prev => ({ ...prev, [farm.farm_id]: { ...addState, full_name: e.target.value } }))}
                      style={{ width: 160 }}
                    />
                    <button
                      className="btn btn-outline"
                      disabled={addingFarm === farm.farm_id || !addState.email.trim()}
                      onClick={() => addRecipient(farm.farm_id)}
                    >
                      {addingFarm === farm.farm_id ? 'Adding…' : '+ Add'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </main>
      </div>

      {successMsg && <div className="success-toast">{successMsg}</div>}
    </div>
  )
}

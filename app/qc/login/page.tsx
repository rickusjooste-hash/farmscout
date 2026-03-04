'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export default function QcLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }
    setLoading(true)
    setError('')

    try {
      // 1. Supabase auth
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password }),
      })
      const authData = await authRes.json()
      if (!authRes.ok) throw new Error(authData.error_description || 'Invalid email or password')

      const accessToken = authData.access_token
      const userId = authData.user.id

      // 2. Look up user_profile + organisation_users to get farm
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      }

      const [profileRes, orgUserRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=*`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/organisation_users?user_id=eq.${userId}&select=*`, { headers }),
      ])

      const profiles = await profileRes.json()
      const orgUsers = await orgUserRes.json()

      if (!profiles.length) throw new Error('No user profile found. Contact your manager.')

      // Get farm access for this user
      const farmAccessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_farm_access?user_id=eq.${userId}&select=*`,
        { headers }
      )
      const farmAccess = await farmAccessRes.json()
      if (!farmAccess.length) throw new Error('No farm access found. Contact your manager.')

      const farmIds = farmAccess.map((f: any) => f.farm_id)
      const farmId = farmIds[0]
      const orgId = orgUsers[0]?.organisation_id || farmAccess[0].organisation_id

      // 3. Store to localStorage
      localStorage.setItem('qcapp_access_token', accessToken)
      localStorage.setItem('qcapp_refresh_token', authData.refresh_token)
      localStorage.setItem('qcapp_worker_id', userId)
      localStorage.setItem('qcapp_worker_name', profiles[0].full_name)
      localStorage.setItem('qcapp_farm_id', farmId)
      localStorage.setItem('qcapp_farm_ids', JSON.stringify(farmIds))
      localStorage.setItem('qcapp_org_id', orgId)

      // 4. Pull all QC reference data into IndexedDB
      const { pullQcReferenceData } = await import('@/lib/qc-sync')
      const syncResult = await pullQcReferenceData(accessToken)
      if (!syncResult.success) {
        console.warn('[QcLogin] Sync warning:', syncResult.error)
        // Non-fatal — allow login even if sync fails (offline mode)
      }

      // 5. Go to QC home
      window.location.href = '/qc'
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.')
    }

    setLoading(false)
  }

  return (
    <div style={s.app}>
      <div style={s.logoSection}>
        <div style={s.logoIcon}>🍎</div>
        <div style={s.logoText}>Orchard QC</div>
        <div style={s.logoSub}>Quality Control App</div>
      </div>

      <div style={s.form}>
        <div style={s.formGroup}>
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && <div style={s.errorBox}>⚠️ {error}</div>}

        <button
          style={{ ...s.loginBtn, opacity: loading ? 0.7 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Setting up...' : 'Sign In'}
        </button>

        <div style={s.helpText}>Forgot your password? Contact your manager.</div>
      </div>

      <div style={s.version}>Orchard QC v1.0</div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: '100dvh',
    width: '100%',
    background: '#1a2e1a',
    color: '#e8f0e0',
    fontFamily: 'system-ui, sans-serif',
    padding: '0 24px',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: 48,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  logoIcon: { fontSize: 64, marginBottom: 12 },
  logoText: { fontSize: 36, fontWeight: 800, letterSpacing: '0.05em', color: '#7cbe4a' },
  logoSub: {
    fontSize: 14,
    color: '#4a7a2a',
    marginTop: 4,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  form: {
    background: '#1e3a1e',
    border: '1px solid #2e5a2e',
    borderRadius: 8,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  formGroup: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#4a7a2a',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: '#1a2e1a',
    border: '1px solid #2e5a2e',
    borderRadius: 6,
    color: '#e8f0e0',
    fontSize: 16,
    padding: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  errorBox: {
    background: '#2a1010',
    border: '1px solid #e05c4b',
    borderRadius: 6,
    padding: '12px 14px',
    color: '#e05c4b',
    fontSize: 13,
    marginBottom: 16,
  },
  loginBtn: {
    width: '100%',
    background: '#7cbe4a',
    color: '#0a1a0a',
    fontSize: 18,
    fontWeight: 700,
    padding: '16px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.03em',
    marginTop: 8,
  },
  helpText: { textAlign: 'center', fontSize: 12, color: '#4a7a2a', marginTop: 16 },
  version: { textAlign: 'center', fontSize: 11, color: '#2e4a2e', marginTop: 32 },
}

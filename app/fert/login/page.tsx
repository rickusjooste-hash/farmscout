'use client'

import { useState } from 'react'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export default function FertLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

      // 2. Look up user_profile + org role + farm access
      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      }

      const [profileRes, orgUserRes, farmAccessRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=*`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/organisation_users?user_id=eq.${userId}&select=*`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/user_farm_access?user_id=eq.${userId}&select=*`, { headers }),
      ])

      const profiles = await profileRes.json()
      const orgUsers = await orgUserRes.json()
      const farmAccess = await farmAccessRes.json()

      if (!profiles.length) throw new Error('No user profile found. Contact your manager.')
      if (!farmAccess.length) throw new Error('No farm access found. Contact your manager.')

      const farmId = farmAccess[0].farm_id
      const orgId = orgUsers[0]?.organisation_id || farmAccess[0].organisation_id

      // 3. Store to localStorage
      localStorage.setItem('fertapp_access_token', accessToken)
      localStorage.setItem('fertapp_refresh_token', authData.refresh_token)
      localStorage.setItem('fertapp_user_id', userId)
      localStorage.setItem('fertapp_user_name', profiles[0].full_name)
      localStorage.setItem('fertapp_farm_id', farmId)
      localStorage.setItem('fertapp_org_id', orgId)

      // 5. Pull dispatched lines into IndexedDB
      const { pullFertDispatchedLines } = await import('@/lib/fert-sync')
      const syncResult = await pullFertDispatchedLines(accessToken)
      if (!syncResult.success) {
        console.warn('[FertLogin] Sync warning:', syncResult.error)
        // Non-fatal — allow login even if sync fails
      }

      // 6. Go to FertApp home
      window.location.href = '/fert'
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.')
    }

    setLoading(false)
  }

  return (
    <div style={s.app}>
      <div style={s.logoSection}>
        <div style={s.logoIcon}>&#127793;</div>
        <div style={s.logoText}>FertApp</div>
        <div style={s.logoSub}>Fertilizer Application</div>
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

        {error && <div style={s.errorBox}>{error}</div>}

        <button
          style={{ ...s.loginBtn, opacity: loading ? 0.7 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Setting up...' : 'Sign In'}
        </button>

        <div style={s.helpText}>Forgot your password? Contact your manager.</div>
      </div>

      <div style={s.version}>FertApp v1.0</div>
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
    background: '#1a2a1a',
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
  logoText: { fontSize: 36, fontWeight: 800, letterSpacing: '0.05em', color: '#4caf72' },
  logoSub: {
    fontSize: 14,
    color: '#2e6a3e',
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
    color: '#2e6a3e',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: '#1a2a1a',
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
    background: '#4caf72',
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
  helpText: { textAlign: 'center', fontSize: 12, color: '#2e6a3e', marginTop: 16 },
  version: { textAlign: 'center', fontSize: 11, color: '#2e4a2e', marginTop: 32 },
}

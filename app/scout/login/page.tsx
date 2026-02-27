'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export default function ScoutLogin() {
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
      // 1. Sign in with Supabase Auth
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      })

      const authData = await authRes.json()

      if (!authRes.ok) {
        throw new Error(authData.error_description || 'Invalid email or password')
      }

      const accessToken = authData.access_token
      const userId = authData.user.id

      // 2. Look up scout record
      const scoutRes = await fetch(
        `${SUPABASE_URL}/rest/v1/scouts?user_id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      const scoutData = await scoutRes.json()

      if (!scoutData.length) {
        throw new Error('No scout account found. Please contact your manager.')
      }

      const scout = scoutData[0]

      // 3. Save everything to localStorage — they won't need to log in again
      localStorage.setItem('farmscout_access_token', accessToken)
      localStorage.setItem('farmscout_refresh_token', authData.refresh_token)
      localStorage.setItem('farmscout_scout_id', scout.id)
      localStorage.setItem('farmscout_scout_name', scout.full_name)
      localStorage.setItem('farmscout_farm_id', scout.farm_id)
      localStorage.setItem('farmscout_first_trap_id', scout.first_trap_id)
      localStorage.setItem('farmscout_organisation_id', scout.organisation_id)
      localStorage.setItem('farmscout_user_id', userId)

      // Get route length in one fast database call
      const routeLengthRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_route_length`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ first_trap_id: scout.first_trap_id }),
        }
      )
      const routeLength = await routeLengthRes.json()
      localStorage.setItem('farmscout_route_length', routeLength.toString())

      // 4. Pull all reference data now so the app works offline immediately
      const { pullReferenceData } = await import('@/lib/scout-sync')
      const syncResult = await pullReferenceData(SUPABASE_ANON_KEY, accessToken)

      // Verify traps were actually cached — surface any silent failures
      const { getAll } = await import('@/lib/scout-db')
      const traps = await getAll('traps')
      if (traps.length === 0) {
        throw new Error(`Sync failed — no trap data downloaded. (${JSON.stringify(syncResult)}) Please check your connection and try again.`)
      }

      // 5. Pre-warm the cache so scout pages work offline immediately
      if ('caches' in window) {
        const cache = await caches.open('farmscout-v1')
        await Promise.allSettled([
          cache.add('/scout'),
          cache.add('/scout/trap-inspection'),
        ])
      }

      // 6. Go to home screen
      window.location.href = '/scout'

    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.')
    }

    setLoading(false)
  }

  return (
    <div style={styles.app}>

      {/* Logo */}
      <div style={styles.logoSection}>
        <div style={styles.logoIcon}>🌿</div>
        <div style={styles.logoText}>FarmScout</div>
        <div style={styles.logoSub}>Field Inspection App</div>
      </div>

      {/* Form */}
      <div style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div style={styles.errorBox}>
            ⚠️ {error}
          </div>
        )}

        <button
          style={{ ...styles.loginBtn, opacity: loading ? 0.7 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Setting up...' : 'Sign In'}
        </button>

        <div style={styles.helpText}>
          Forgot your password? Contact your manager.
        </div>
      </div>

      {/* Version */}
      <div style={styles.version}>FarmScout v2.0</div>

    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: '100dvh',
    width: '100%',
    background: '#1a1f0e',
    color: '#e8e8d8',
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
  logoIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: '0.05em',
    color: '#f0a500',
  },
  logoSub: {
    fontSize: 14,
    color: '#7a8a5a',
    marginTop: 4,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  form: {
    background: '#222918',
    border: '1px solid #3a4228',
    borderRadius: 8,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7a8a5a',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: '#1a1f0e',
    border: '1px solid #3a4228',
    borderRadius: 6,
    color: '#e8e8d8',
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
    background: '#f0a500',
    color: '#000',
    fontSize: 18,
    fontWeight: 700,
    padding: '16px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.03em',
    marginTop: 8,
  },
  helpText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#7a8a5a',
    marginTop: 16,
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    color: '#3a4228',
    marginTop: 32,
  },
}
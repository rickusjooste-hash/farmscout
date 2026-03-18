'use client'

import { useState } from 'react'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export default function BinsLogin() {
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

      // 3. Store to localStorage (including all farm IDs)
      localStorage.setItem('binsapp_access_token', accessToken)
      localStorage.setItem('binsapp_refresh_token', authData.refresh_token)
      localStorage.setItem('binsapp_user_id', userId)
      localStorage.setItem('binsapp_user_name', profiles[0].full_name)
      localStorage.setItem('binsapp_farm_id', farmId)
      localStorage.setItem('binsapp_farm_ids', JSON.stringify(farmAccess.map((f: any) => f.farm_id)))
      localStorage.setItem('binsapp_org_id', orgId)

      // 4. Pull reference data + today's records into IndexedDB
      const { pullBinsReferenceData, pullTodayRecords } = await import('@/lib/bins-sync')
      const syncResult = await pullBinsReferenceData(accessToken)
      if (!syncResult.success) {
        console.warn('[BinsLogin] Sync warning:', syncResult.error)
      }
      await pullTodayRecords(accessToken)

      // 5. Go to BinsApp home
      window.location.href = '/bins'
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.')
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col justify-center min-h-dvh w-full bg-[#eae6df] px-6">
      <div className="text-center mb-12 max-w-[480px] w-full self-center">
        <div className="text-6xl mb-3">&#128230;</div>
        <div className="text-4xl font-extrabold tracking-wide text-[#2176d9]">BinsApp</div>
        <div className="text-sm text-[#8a95a0] mt-1 tracking-widest uppercase">Bins Receiving</div>
      </div>

      <div className="bg-white rounded-[14px] border border-[#e8e4dc] p-6 max-w-[480px] w-full self-center shadow-sm">
        <div className="mb-4">
          <label className="block text-xs font-semibold tracking-widest uppercase text-[#8a95a0] mb-1.5">Email</label>
          <input
            className="w-full px-3 py-3 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none focus:border-[#2176d9] transition-colors"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold tracking-widest uppercase text-[#8a95a0] mb-1.5">Password</label>
          <input
            className="w-full px-3 py-3 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none focus:border-[#2176d9] transition-colors"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          className="w-full bg-[#2176d9] text-white text-lg font-semibold py-3.5 rounded-lg cursor-pointer tracking-wide mt-2 disabled:opacity-60 hover:bg-[#1a65c0] transition-colors"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Setting up...' : 'Sign In'}
        </button>

        <div className="text-center text-xs text-[#8a95a0] mt-4">
          Forgot your password? Contact your manager.
        </div>
      </div>

      <div className="text-center text-xs text-[#c0bab4] mt-8">BinsApp v1.0</div>
    </div>
  )
}

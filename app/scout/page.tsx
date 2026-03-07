'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { runFullSync, pushPendingRecords } from '../../lib/scout-sync'
import TrapInspectionView from './TrapInspectionView'
import TreeInspectionView from './TreeInspectionView'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'

/** Silently refresh the access token using the stored refresh token. */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('farmscout_refresh_token')
  if (!refreshToken) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = await res.json()
    localStorage.setItem('farmscout_access_token', data.access_token)
    localStorage.setItem('farmscout_refresh_token', data.refresh_token)
    return true
  } catch {
    return false
  }
}

export default function ScoutApp() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [scoutName, setScoutName] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const router = useRouter()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const [trapStatus, setTrapStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started')
  const [view, setView] = useState<'home' | 'trap-inspection' | 'tree-inspection'>('home')
  const [rebaitDueCount, setRebaitDueCount] = useState(0)
  const [commodityCode, setCommodityCode] = useState<string | null>(null)
  const [language, setLanguage] = useState<'en' | 'af'>('en')
  const isSyncingRef = useRef(false)

  useEffect(() => {
    // Check if logged in — if not, redirect to login
    const token = localStorage.getItem('farmscout_access_token')
    if (!token) {
      router.push('/scout/login')
      return
    }

    // Load scout name
    const name = localStorage.getItem('farmscout_scout_name') || ''
    setScoutName(name)

    // Load language preference
    const savedLang = localStorage.getItem('farmscout_language')
    if (savedLang === 'af') setLanguage('af')

    // Load rebait due count (synchronous, works offline)
    const rebaitDue = parseInt(localStorage.getItem('farmscout_rebait_due') || '0', 10)
    setRebaitDueCount(isNaN(rebaitDue) ? 0 : rebaitDue)

    // Check online status
    setIsOnline(navigator.onLine)
    const handleOnline = () => { setIsOnline(true); handleSync(); loadPendingCount() }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Refresh token if online (access tokens expire after ~1hr)
    // then load data — this prevents login redirects after lunch breaks
    async function init() {
      if (navigator.onLine) {
        await refreshAccessToken()
      }
      loadPendingCount()
      checkTrapStatus()
      if (navigator.onLine) {
        handleSync()
      }
    }
    init()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  function getCurrentWeekKey() {
    const now = new Date()
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }

  async function checkTrapStatus() {
    const token = localStorage.getItem('farmscout_access_token')
    const userId = localStorage.getItem('farmscout_user_id')

    // When online, always check the server (source of truth)
    if (navigator.onLine && token && userId) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_scout_weekly_status`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ scout_user_id: userId }),
          }
        )
        const data = await res.json()
        setTrapStatus(data.status)
        // Cache for offline use
        if (data.status === 'completed') {
          localStorage.setItem('farmscout_week_completed', getCurrentWeekKey())
        } else {
          // Clear stale completion flag (e.g. route ended short by mistake)
          localStorage.removeItem('farmscout_week_completed')
        }
        return
      } catch { /* fall through to offline check */ }
    }

    // Offline fallback: use cached status
    const storedWeek = localStorage.getItem('farmscout_week_completed')
    if (storedWeek === getCurrentWeekKey()) {
      setTrapStatus('completed')
    }
  }

  async function loadPendingCount() {
    try {
      const { getPendingQueue } = await import('../../lib/scout-db')
      const queue = await getPendingQueue()
      setPendingCount(queue.length)
    } catch {
      setPendingCount(0)
    }
  }

  async function handleSync() {
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    setIsSyncing(true)
    setSyncError(null)
    try {
      // Refresh token first so stale tokens don't block tree-sync uploads
      const refreshed = await refreshAccessToken()
      if (!refreshed && navigator.onLine) {
        setSyncError('Session expired — please sign out and sign in again')
        isSyncingRef.current = false
        setIsSyncing(false)
        return
      }
      const token = localStorage.getItem('farmscout_access_token') ?? undefined
      const result = await runFullSync(supabaseKey, token)
      if (result.push.failed > 0) {
        setSyncError(`${result.push.failed} failed: ${result.push.firstError || 'unknown error'}`)
      }
      await loadPendingCount()
      const rebaitDue = parseInt(localStorage.getItem('farmscout_rebait_due') || '0', 10)
      setRebaitDueCount(isNaN(rebaitDue) ? 0 : rebaitDue)
    } catch (err: any) {
      setSyncError(err?.message || 'Sync failed')
    }
    isSyncingRef.current = false
    setIsSyncing(false)
  }

  // Background push every 2 minutes — works regardless of view (home/trap/tree)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!navigator.onLine || isSyncingRef.current) return
      const pending = await import('../../lib/scout-db').then(m => m.getPendingQueue())
      if (pending.length === 0) return
      isSyncingRef.current = true
      setIsSyncing(true)
      try {
        await refreshAccessToken()
        await pushPendingRecords(supabaseKey)
        await loadPendingCount()
      } catch { }
      isSyncingRef.current = false
      setIsSyncing(false)
    }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  function handleLogout() {
    localStorage.clear()
    router.push('/scout/login')
  }

  // Get first name only for greeting
  const firstName = scoutName.split(' ')[0]

  function toggleLanguage() {
    const next = language === 'en' ? 'af' : 'en'
    setLanguage(next)
    localStorage.setItem('farmscout_language', next)
  }

  if (view === 'trap-inspection') {
    return <TrapInspectionView language={language} onBack={() => { setView('home'); checkTrapStatus(); loadPendingCount() }} />
  }

  if (view === 'tree-inspection') {
    return <TreeInspectionView language={language} commodityCode={commodityCode || undefined} onBack={() => { setView('home'); loadPendingCount(); if (navigator.onLine) handleSync() }} />
  }

  return (
    <div style={styles.app}>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.logo}>🌿 FarmScout</div>
          <div style={styles.greeting}>Hello, {firstName}</div>
        </div>
        <div style={styles.headerRight}>
          {pendingCount > 0 && (
            <div style={styles.pendingBadge} onClick={handleSync}>
              {pendingCount} pending
            </div>
          )}
          <div
            style={{
              ...styles.statusPill,
              background: isOnline ? '#1a3a1a' : '#3a1a1a',
              color: isOnline ? '#6abf4b' : '#e05c4b',
              border: `1px solid ${isOnline ? '#6abf4b' : '#e05c4b'}`,
            }}
          >
            {isSyncing ? '⟳ Syncing' : isOnline ? '● Online' : '● Offline'}
          </div>
        </div>
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div style={{ background: '#3a1a1a', borderBottom: '1px solid #e05c4b', color: '#e05c4b', padding: '8px 16px', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠ {syncError}</span>
          <span style={{ cursor: 'pointer', fontSize: 16, paddingLeft: 12 }} onClick={() => setSyncError(null)}>×</span>
        </div>
      )}

      {/* Main content */}
      <div style={styles.screen}>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>What would you like to do?</div>

          {/* Tile Grid */}
          <div style={styles.tileGrid}>

           {/* Trap Inspection */}
<div
  style={{
    ...styles.tile,
    background: trapStatus === 'completed' ? '#1a1a1a' : '#1a3a2a',
    cursor: trapStatus === 'completed' ? 'not-allowed' : 'pointer',
    opacity: trapStatus === 'completed' ? 0.5 : 1,
  }}
  onClick={() => trapStatus !== 'completed' && setView('trap-inspection')}
>
  <div style={styles.tileIcon}>🪤</div>
  <div style={styles.tileLabel}>Trap Inspection</div>
  {trapStatus === 'completed' && (
    <div style={{ ...styles.tileSoon, color: '#6abf4b' }}>✓ Done this week</div>
  )}
  {trapStatus === 'in_progress' && (
    <div style={{ ...styles.tileSoon, color: '#f0a500' }}>● In progress</div>
  )}
</div>

            {/* Tree scouting tiles */}
            <div
              style={{ ...styles.tile, background: '#1a3a2a', cursor: 'pointer' }}
              onClick={() => { setCommodityCode('POME'); setView('tree-inspection') }}
            >
              <div style={styles.tileIcon}>🍎</div>
              <div style={styles.tileLabel}>Pomefruit Scouting</div>
            </div>

            <div
              style={{ ...styles.tile, background: '#1a3a2a', cursor: 'pointer' }}
              onClick={() => { setCommodityCode('STONE'); setView('tree-inspection') }}
            >
              <div style={styles.tileIcon}>🍑</div>
              <div style={styles.tileLabel}>Stonefruit Scouting</div>
            </div>

            <div
              style={{ ...styles.tile, background: '#1a3a2a', cursor: 'pointer' }}
              onClick={() => { setCommodityCode('CITRUS'); setView('tree-inspection') }}
            >
              <div style={styles.tileIcon}>🍊</div>
              <div style={styles.tileLabel}>Citrus Scouting</div>
            </div>

          </div>
        </div>

        {/* Rebait reminder chip */}
        {rebaitDueCount > 0 && (
          <div style={{
            margin: '0 16px 16px',
            background: '#3a2a00',
            border: '1px solid #f0a500',
            color: '#f0a500',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
          }}>
            ⚠ {rebaitDueCount} trap{rebaitDueCount !== 1 ? 's' : ''} need rebaiting
          </div>
        )}

      </div>

      {/* Bottom bar with language toggle + logout */}
      <div style={styles.bottomBar}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              ...styles.langBtn,
              ...(language === 'en' ? styles.langBtnActive : {}),
            }}
            onClick={() => language !== 'en' && toggleLanguage()}
          >EN</button>
          <button
            style={{
              ...styles.langBtn,
              ...(language === 'af' ? styles.langBtnActive : {}),
            }}
            onClick={() => language !== 'af' && toggleLanguage()}
          >AF</button>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Sign Out
        </button>
      </div>

    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    width: '100%',
    background: '#1a1f0e',
    color: '#e8e8d8',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: '#222918',
    borderBottom: '1px solid #3a4228',
    flexShrink: 0,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f0a500',
  },
  greeting: {
    fontSize: 13,
    color: '#7a8a5a',
    marginTop: 2,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 100,
    fontWeight: 500,
  },
  pendingBadge: {
    background: '#f0a500',
    color: '#000',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 100,
    cursor: 'pointer',
  },
  screen: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  section: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7a8a5a',
    marginBottom: 16,
  },
 tileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    maxWidth: 900,
  },
  tile: {
    background: '#222918',
    border: '1px solid #3a4228',
    borderRadius: 12,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    minHeight: 160,
    transition: 'all 0.15s',
    position: 'relative',
  },
  tileDimmed: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  tileIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
    color: '#e8e8d8',
    letterSpacing: '0.02em',
  },
  tileSoon: {
    fontSize: 10,
    color: '#7a8a5a',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  bottomBar: {
    padding: 16,
    background: '#222918',
    borderTop: '1px solid #3a4228',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  langBtn: {
    background: 'transparent',
    border: '1px solid #3a4228',
    borderRadius: 6,
    color: '#7a8a5a',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 14px',
    cursor: 'pointer',
  },
  langBtnActive: {
    background: '#f0a500',
    borderColor: '#f0a500',
    color: '#000',
  },
  logoutBtn: {
    width: '100%',
    background: 'transparent',
    border: '1px solid #3a4228',
    borderRadius: 6,
    color: '#7a8a5a',
    fontSize: 15,
    fontWeight: 600,
    padding: '12px',
    cursor: 'pointer',
  },
}
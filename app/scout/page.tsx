'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { runFullSync } from '../../lib/scout-sync'

export default function ScoutApp() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [scoutName, setScoutName] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const router = useRouter()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const [trapStatus, setTrapStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started')
  const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'

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
    
    // Check online status
    setIsOnline(navigator.onLine)
    window.addEventListener('online', () => setIsOnline(true))
    window.addEventListener('offline', () => setIsOnline(false))

    // Load pending count
    loadPendingCount()
    checkTrapStatus()
    // Auto sync if online
    if (navigator.onLine) {
      handleSync()
    }
  }, [])

  async function checkTrapStatus() {
    const token = localStorage.getItem('farmscout_access_token')
    const userId = localStorage.getItem('farmscout_user_id')
    if (!token || !userId) return

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
    } catch { }
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
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const token = localStorage.getItem('farmscout_access_token') ?? undefined
      await runFullSync(supabaseKey, token)
      await loadPendingCount()
    } catch { }
    setIsSyncing(false)
  }

  function handleLogout() {
    localStorage.clear()
    router.push('/scout/login')
  }

  // Get first name only for greeting
  const firstName = scoutName.split(' ')[0]

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
  onClick={() => trapStatus !== 'completed' && router.push('/scout/trap-inspection')}
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

            {/* Coming soon tiles */}
            <div style={{ ...styles.tile, ...styles.tileDimmed }}>
              <div style={styles.tileIcon}>🍎</div>
              <div style={styles.tileLabel}>Pomefruit Scouting</div>
              <div style={styles.tileSoon}>Coming soon</div>
            </div>

            <div style={{ ...styles.tile, ...styles.tileDimmed }}>
              <div style={styles.tileIcon}>🍑</div>
              <div style={styles.tileLabel}>Stonefruit Scouting</div>
              <div style={styles.tileSoon}>Coming soon</div>
            </div>

            <div style={{ ...styles.tile, ...styles.tileDimmed }}>
              <div style={styles.tileIcon}>🍊</div>
              <div style={styles.tileLabel}>Citrus Scouting</div>
              <div style={styles.tileSoon}>Coming soon</div>
            </div>

          </div>
        </div>

      </div>

      {/* Bottom bar with logout */}
      <div style={styles.bottomBar}>
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
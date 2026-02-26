'use client'

import { useEffect, useState } from 'react'
import { getAll } from '../../lib/scout-db'
import { runFullSync } from '../../lib/scout-sync'

export default function ScoutApp() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Check online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    window.addEventListener('online', () => setIsOnline(true))
    window.addEventListener('offline', () => setIsOnline(false))
  }, [])

  // Load sessions from local database
  useEffect(() => {
    loadSessions()
  }, [])

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && supabaseKey) {
      handleSync()
    }
  }, [isOnline])

  async function loadSessions() {
    const data = await getAll('inspection_sessions')
    setSessions(data.sort((a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    ))
    const { getPendingQueue } = await import('../../lib/scout-db')
    const queue = await getPendingQueue()
    setPendingCount(queue.length)
  }

  async function handleSync() {
    if (isSyncing) return
    setIsSyncing(true)
    await runFullSync(supabaseKey)
    await loadSessions()
    setIsSyncing(false)
  }

  const activeSessions = sessions.filter(s => s.status === 'active')
  const recentSessions = sessions.filter(s => s.status !== 'active').slice(0, 5)

  return (
    <div style={styles.app}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>🌿 FarmScout</div>
        <div style={styles.headerRight}>
          {pendingCount > 0 && (
            <div style={styles.pendingBadge}>{pendingCount} pending</div>
          )}
          <div
            style={{
              ...styles.statusPill,
              background: isOnline ? '#1a3a1a' : '#3a1a1a',
              color: isOnline ? '#6abf4b' : '#e05c4b',
              border: `1px solid ${isOnline ? '#6abf4b' : '#e05c4b'}`,
            }}
            onClick={handleSync}
          >
            {isSyncing ? '⟳ Syncing...' : isOnline ? '● Online' : '● Offline'}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={styles.screen}>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Active Inspections</div>
            {activeSessions.map(s => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}

        {/* Recent Sessions */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Recent</div>
          {sessions.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
              <div style={styles.emptyTitle}>No inspections yet</div>
              <div style={styles.emptyDesc}>
                Tap the button below to start your first inspection.
              </div>
            </div>
          ) : (
            recentSessions.map(s => (
              <SessionCard key={s.id} session={s} />
            ))
          )}
        </div>

      </div>

      {/* Bottom Button */}
      <div style={styles.bottomBar}>
        <button style={styles.primaryBtn}>
          + New Inspection
        </button>
      </div>

    </div>
  )
}

// ── Session Card ─────────────────────────────────────────────────────────

function SessionCard({ session }: { session: any }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardRow}>
        <div style={styles.cardTitle}>
          {session.orchard_name || 'Unnamed Orchard'}
        </div>
        <div style={{
          ...styles.chip,
          background: session.status === 'active' ? '#1a3a1a' : '#1a1a3a',
          color: session.status === 'active' ? '#6abf4b' : '#5b9bd5',
        }}>
          {session.status || 'active'}
        </div>
      </div>
      <div style={styles.cardMeta}>
        {session.block_name && <span>Block {session.block_name}</span>}
        <span>{session._treeCount || 0} trees</span>
        <span>{new Date(session.started_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    maxWidth: 480,
    margin: '0 auto',
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
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 100,
    cursor: 'pointer',
    fontWeight: 500,
  },
  pendingBadge: {
    background: '#f0a500',
    color: '#000',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 100,
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
    marginBottom: 10,
  },
  card: {
    background: '#222918',
    border: '1px solid #3a4228',
    borderRadius: 6,
    padding: '14px 16px',
    marginBottom: 8,
    borderLeft: '3px solid #f0a500',
  },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
  cardMeta: {
    fontSize: 12,
    color: '#7a8a5a',
    marginTop: 4,
    display: 'flex',
    gap: 12,
  },
  chip: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 24px',
    color: '#7a8a5a',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#e8e8d8',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    lineHeight: 1.5,
  },
  bottomBar: {
    padding: 16,
    background: '#222918',
    borderTop: '1px solid #3a4228',
    flexShrink: 0,
  },
  primaryBtn: {
    width: '100%',
    background: '#f0a500',
    color: '#000',
    fontSize: 17,
    fontWeight: 700,
    padding: '14px 20px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
}
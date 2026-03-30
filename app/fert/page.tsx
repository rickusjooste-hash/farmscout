'use client'

import { useState, useEffect, useCallback } from 'react'
import ApplicationView from './ApplicationView'
import type { FertDispatchedLine, SpreaderChartEntry } from '@/lib/fert-db'

type ViewMode = 'home' | 'application'

export default function FertAppPage() {
  const [view, setView] = useState<ViewMode>('home')
  const [selectedLine, setSelectedLine] = useState<FertDispatchedLine | null>(null)
  const [lines, setLines] = useState<FertDispatchedLine[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [userName, setUserName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [collapsedTimings, setCollapsedTimings] = useState<Set<string>>(new Set())
  const [chartEntries, setChartEntries] = useState<SpreaderChartEntry[]>([])

  // Init
  useEffect(() => {
    if (typeof window === 'undefined') return

    const name = localStorage.getItem('fertapp_user_name') || ''
    const org = localStorage.getItem('fertapp_org_id') || ''
    const uid = localStorage.getItem('fertapp_user_id') || ''
    setUserName(name)
    setOrgId(org)
    setUserId(uid)

    if (!localStorage.getItem('fertapp_access_token')) {
      window.location.href = '/fert/login'
      return
    }

    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const offOnline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', offOnline)

    loadLines()

    // Auto-sync on online
    const syncOnline = async () => {
      const { fertPushPendingRecords } = await import('@/lib/fert-sync')
      await fertPushPendingRecords()
      await refreshPendingCount()
    }
    window.addEventListener('online', syncOnline)

    // 2-minute sync interval
    const interval = setInterval(async () => {
      if (!navigator.onLine) return
      const { fertPushPendingRecords } = await import('@/lib/fert-sync')
      await fertPushPendingRecords()
      await refreshPendingCount()
    }, 2 * 60 * 1000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', offOnline)
      window.removeEventListener('online', syncOnline)
      clearInterval(interval)
    }
  }, [])

  const loadLines = useCallback(async () => {
    try {
      const { fertGetAll } = await import('@/lib/fert-db')
      const [all, charts] = await Promise.all([
        fertGetAll('dispatched_lines'),
        fertGetAll('chart_entries'),
      ])
      setLines(all.sort((a, b) => (a.timing_sort - b.timing_sort) || a.orchard_name.localeCompare(b.orchard_name)))
      setChartEntries(charts)
    } catch {
      setLines([])
      setChartEntries([])
    }
    await refreshPendingCount()
  }, [])

  async function refreshPendingCount() {
    try {
      const { countPendingApplications } = await import('@/lib/fert-sync')
      setPendingCount(await countPendingApplications())
    } catch {
      setPendingCount(0)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const { fertRunFullSync } = await import('@/lib/fert-sync')
      await fertRunFullSync()
      await loadLines()
    } catch (err) {
      console.error('[FertApp] Sync error:', err)
    }
    setSyncing(false)
  }

  function handleLogout() {
    localStorage.removeItem('fertapp_access_token')
    localStorage.removeItem('fertapp_refresh_token')
    localStorage.removeItem('fertapp_user_id')
    localStorage.removeItem('fertapp_user_name')
    localStorage.removeItem('fertapp_farm_id')
    localStorage.removeItem('fertapp_org_id')
    localStorage.removeItem('fertapp_ref_last_pull')
    window.location.href = '/fert/login'
  }

  function findOpening(line: FertDispatchedLine): { opening: number; actualKgHa: number } | null {
    if (!line.spreader_id || !line.row_width || !line.rate_per_ha) return null
    const widthM = line.row_width * 2
    // Filter chart entries for this spreader + product
    const candidates = chartEntries.filter(
      e => e.spreader_id === line.spreader_id && e.product_id === line.product_id
    )
    if (candidates.length === 0) return null
    // Find available widths and pick the closest
    const availableWidths = [...new Set(candidates.map(e => Number(e.width_m)))]
    const closestWidth = availableWidths.reduce((best, w) =>
      Math.abs(w - widthM) < Math.abs(best - widthM) ? w : best
    )
    // Filter to that width, find closest kg/ha
    const widthEntries = candidates.filter(e => Number(e.width_m) === closestWidth)
    if (widthEntries.length === 0) return null
    const best = widthEntries.reduce((prev, curr) =>
      Math.abs(Number(curr.kg_per_ha) - line.rate_per_ha) < Math.abs(Number(prev.kg_per_ha) - line.rate_per_ha) ? curr : prev
    )
    return { opening: Number(best.opening), actualKgHa: Number(best.kg_per_ha) }
  }

  function handleLineSelect(line: FertDispatchedLine) {
    if (line.confirmed) return
    setSelectedLine(line)
    setView('application')
  }

  function handleConfirmed() {
    setView('home')
    setSelectedLine(null)
    loadLines()
  }

  function toggleTiming(timingId: string) {
    setCollapsedTimings(prev => {
      const next = new Set(prev)
      if (next.has(timingId)) next.delete(timingId)
      else next.add(timingId)
      return next
    })
  }

  // ── Application view ────────────────────────────────────────────────────
  if (view === 'application' && selectedLine) {
    return (
      <ApplicationView
        line={selectedLine}
        orgId={orgId}
        userId={userId}
        spreaderOpening={findOpening(selectedLine)}
        onConfirm={handleConfirmed}
        onBack={() => { setView('home'); setSelectedLine(null) }}
      />
    )
  }

  // ── Home view ───────────────────────────────────────────────────────────

  // Group lines by timing
  const timingGroups: { timing_id: string; timing_label: string; timing_sort: number; lines: FertDispatchedLine[] }[] = []
  const timingMap = new Map<string, FertDispatchedLine[]>()
  for (const l of lines) {
    if (!timingMap.has(l.timing_id)) timingMap.set(l.timing_id, [])
    timingMap.get(l.timing_id)!.push(l)
  }
  for (const [timing_id, groupLines] of timingMap) {
    const first = groupLines[0]
    timingGroups.push({ timing_id, timing_label: first.timing_label, timing_sort: first.timing_sort, lines: groupLines })
  }
  timingGroups.sort((a, b) => a.timing_sort - b.timing_sort)

  const totalLines = lines.length
  const confirmedLines = lines.filter(l => l.confirmed).length

  return (
    <div style={s.app}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.appTitle}>FertApp</div>
          <div style={s.userName}>{userName}</div>
        </div>
        <div style={s.headerRight}>
          <div style={{ ...s.onlinePill, background: isOnline ? '#2e5a2e' : '#5a3a2e', color: isOnline ? '#4caf72' : '#e8a060' }}>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ ...s.syncBtn, opacity: syncing ? 0.5 : 1 }}
          >
            {syncing ? 'Syncing...' : 'Sync'}
            {pendingCount > 0 && <span style={s.badge}>{pendingCount}</span>}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={s.progressSection}>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: totalLines > 0 ? `${(confirmedLines / totalLines) * 100}%` : '0%' }} />
        </div>
        <div style={s.progressText}>{confirmedLines} / {totalLines} confirmed</div>
      </div>

      {/* Dispatched lines grouped by timing */}
      <div style={s.content}>
        {timingGroups.length === 0 && (
          <div style={s.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#127793;</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No dispatched work</div>
            <div style={{ fontSize: 13, color: '#6a8a6a' }}>
              Your manager has not dispatched any applications yet.
            </div>
            <button onClick={handleSync} style={{ ...s.syncBtn, marginTop: 16 }}>
              Refresh
            </button>
          </div>
        )}

        {timingGroups.map(group => {
          const isCollapsed = collapsedTimings.has(group.timing_id)
          const groupConfirmed = group.lines.filter(l => l.confirmed).length

          // Group within timing by product
          const productGroups = new Map<string, FertDispatchedLine[]>()
          for (const l of group.lines) {
            if (!productGroups.has(l.product_id)) productGroups.set(l.product_id, [])
            productGroups.get(l.product_id)!.push(l)
          }

          return (
            <div key={group.timing_id} style={s.timingGroup}>
              <button
                onClick={() => toggleTiming(group.timing_id)}
                style={s.timingHeader}
              >
                <span style={s.timingChevron}>{isCollapsed ? '\u25B6' : '\u25BC'}</span>
                <span style={s.timingLabel}>{group.timing_label}</span>
                <span style={s.timingCount}>
                  {groupConfirmed}/{group.lines.length}
                </span>
              </button>

              {!isCollapsed && [...productGroups.entries()].map(([productId, productLines]) => (
                <div key={productId}>
                  <div style={s.productHeader}>
                    {productLines[0].product_name}
                  </div>
                  {productLines.map(line => (
                    <button
                      key={line.line_id}
                      onClick={() => handleLineSelect(line)}
                      style={{ ...s.lineCard, opacity: line.confirmed ? 0.6 : 1, cursor: line.confirmed ? 'default' : 'pointer' }}
                    >
                      <div style={s.lineLeft}>
                        <div style={{ ...s.statusDot, background: line.confirmed ? '#4caf72' : '#f5c842' }} />
                        <div>
                          <div style={s.lineName}>
                            {line.orchard_nr ? `${line.orchard_nr}. ` : ''}{line.orchard_name}
                          </div>
                          <div style={s.lineMeta}>
                            {line.variety && <span>{line.variety} &middot; </span>}
                            {line.ha?.toFixed(2)} ha
                          </div>
                        </div>
                      </div>
                      <div style={s.lineRight}>
                        <div style={s.lineRate}>{line.confirmed && line.actual_rate_per_ha ? line.actual_rate_per_ha : line.rate_per_ha}</div>
                        <div style={s.lineUnit}>{line.product_unit || 'kg'}/ha</div>
                        {line.bag_weight_kg && line.total_qty ? (
                          <div style={s.lineBags}>
                            {Math.ceil(line.total_qty / line.bag_weight_kg)} bags
                          </div>
                        ) : null}
                        {(() => {
                          const result = findOpening(line)
                          return result ? (
                            <div style={s.lineOpening}>Opening: {result.opening.toFixed(1)}</div>
                          ) : null
                        })()}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <button onClick={handleLogout} style={s.logoutBtn}>Log Out</button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100dvh',
    background: '#1a2a1a',
    color: '#f0f0e0',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#1e3a1e',
    borderBottom: '2px solid #4a7a4a',
  },
  appTitle: { fontSize: 22, fontWeight: 800, color: '#6fcf6f' },
  userName: { fontSize: 13, color: '#b0d0b0', marginTop: 2 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  onlinePill: {
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
  },
  syncBtn: {
    background: '#3a6a3a',
    color: '#f0f0e0',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    background: '#e85a4a',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    borderRadius: 10,
    padding: '2px 6px',
    minWidth: 16,
    textAlign: 'center',
  },
  progressSection: {
    padding: '12px 20px',
    background: '#162816',
  },
  progressBar: {
    height: 8,
    background: '#3a6a3a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#6fcf6f',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: 13,
    color: '#b0d0b0',
    marginTop: 6,
    textAlign: 'right',
  },
  content: {
    flex: 1,
    padding: '12px 0',
    overflowY: 'auto',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#f0f0e0',
  },
  timingGroup: {
    marginBottom: 4,
  },
  timingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '14px 20px',
    background: '#1e3a1e',
    border: 'none',
    borderBottom: '2px solid #4a7a4a',
    color: '#f0f0e0',
    cursor: 'pointer',
    textAlign: 'left',
  },
  timingChevron: { fontSize: 12, color: '#b0d0b0', width: 14 },
  timingLabel: { fontSize: 17, fontWeight: 800, flex: 1 },
  timingCount: { fontSize: 14, color: '#b0d0b0', fontWeight: 700 },
  productHeader: {
    padding: '10px 20px 4px',
    fontSize: 13,
    fontWeight: 700,
    color: '#6fcf6f',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  lineCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '14px 20px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #3a5a3a',
    color: '#f0f0e0',
    textAlign: 'left',
  },
  lineLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1 },
  statusDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  lineName: { fontSize: 16, fontWeight: 700 },
  lineMeta: { fontSize: 13, color: '#b0d0b0', marginTop: 2 },
  lineRight: { textAlign: 'right', flexShrink: 0 },
  lineRate: { fontSize: 18, fontWeight: 800 },
  lineUnit: { fontSize: 12, color: '#b0d0b0', fontWeight: 600 },
  lineBags: { fontSize: 14, fontWeight: 700, color: '#ffd54f', marginTop: 2 },
  lineOpening: { fontSize: 20, fontWeight: 800, color: '#6fcf6f', marginTop: 4 },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #2e5a2e',
    textAlign: 'center',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid #2e5a2e',
    color: '#6a8a6a',
    borderRadius: 6,
    padding: '8px 20px',
    fontSize: 13,
    cursor: 'pointer',
  },
}

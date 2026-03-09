'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

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

interface TrapWithDetails {
  id: string
  orchard_id: string | null
  trap_nr: number
  next_trap_id: string | null
  seq: number
  zone: { name: string }
  pest: { id: string; name: string; name_af?: string; image_url: string }
  lure_type: { rebait_weeks: number; name: string }
  last_inspection?: { inspected_at: string; rebaited: boolean } | null
  rebait_required: boolean
  weeks_since_rebait: number | null
}

function pestName(pest: { name: string; name_af?: string } | null | undefined, lang: 'en' | 'af'): string {
  if (!pest) return 'Unknown Pest'
  return lang === 'af' ? (pest.name_af || pest.name) : pest.name
}

export default function TrapInspectionView({ onBack, language = 'en' }: { onBack: () => void; language?: 'en' | 'af' }) {
  const [trap, setTrap] = useState<TrapWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [count, setCount] = useState(0)
  const [rebaited, setRebaited] = useState(false)
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 1, total: 1 })
  const [showFlash, setShowFlash] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Pre-loaded route order — avoids relying on potentially stale next_trap_id in IndexedDB
  const routeRef = useRef<string[]>([])
  // If loading the next trap fails after a successful save, store its ID for retry
  const pendingNextRef = useRef<string | null>(null)

  // Brief green flash when moving to a new trap
  const triggerFlash = useCallback(() => {
    setShowFlash(true)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setShowFlash(false), 600)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.log('GPS error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    loadFirstTrap()
  }, [])

  async function fetchTrapDetails(trapId: string): Promise<TrapWithDetails | null> {
    const token = localStorage.getItem('farmscout_access_token')
    const isOnline = navigator.onLine
    try {
      let t: any = null
      let zone: any = null
      let pest: any = null
      let lure: any = null

      if (isOnline) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/traps?id=eq.${trapId}&select=*`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
        })
        if (!res.ok) {
          // API error (401 expired, 403, etc.) — fall back to IndexedDB
          console.log('fetchTrapDetails: API error', res.status, '— falling back to IndexedDB')
          const { getOne } = await import('@/lib/scout-db')
          t = await getOne('traps', trapId)
          if (!t) return null
          zone = t.zone_id ? await getOne('zones', t.zone_id) : null
          pest = t.pest_id ? await getOne('pests', t.pest_id) : null
          lure = t.lure_type_id ? await getOne('lure_types', t.lure_type_id) : null
        } else {
          const data = await res.json()
          if (!Array.isArray(data) || !data.length) {
            // Unexpected response shape (e.g. JWT error object) — fall back to IndexedDB
            console.log('fetchTrapDetails: unexpected response, falling back to IndexedDB')
            const { getOne } = await import('@/lib/scout-db')
            t = await getOne('traps', trapId)
            if (!t) return null
            zone = t.zone_id ? await getOne('zones', t.zone_id) : null
            pest = t.pest_id ? await getOne('pests', t.pest_id) : null
            lure = t.lure_type_id ? await getOne('lure_types', t.lure_type_id) : null
          } else {
            t = data[0]
            const [zoneRes, pestRes, lureRes] = await Promise.all([
              t.zone_id ? fetch(`${SUPABASE_URL}/rest/v1/zones?id=eq.${t.zone_id}&select=name`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
              }) : null,
              t.pest_id ? fetch(`${SUPABASE_URL}/rest/v1/pests?id=eq.${t.pest_id}&select=name,name_af,image_url`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
              }) : null,
              t.lure_type_id ? fetch(`${SUPABASE_URL}/rest/v1/lure_types?id=eq.${t.lure_type_id}&select=name,rebait_weeks`, {
                headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
              }) : null,
            ])
            zone = zoneRes?.ok ? (await zoneRes.json())[0] : null
            pest = pestRes?.ok ? (await pestRes.json())[0] : null
            lure = lureRes?.ok ? (await lureRes.json())[0] : null
          }
        }
      } else {
        const { getOne } = await import('@/lib/scout-db')
        t = await getOne('traps', trapId)
        if (!t) return null
        zone = t.zone_id ? await getOne('zones', t.zone_id) : null
        pest = t.pest_id ? await getOne('pests', t.pest_id) : null
        lure = t.lure_type_id ? await getOne('lure_types', t.lure_type_id) : null
      }

      let lastInspection = null
      if (isOnline) {
        try {
          const lastRes = await fetch(
            `${SUPABASE_URL}/rest/v1/trap_inspections?trap_id=eq.${trapId}&order=inspected_at.desc&limit=1&select=inspected_at,rebaited`,
            { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } }
          )
          const lastData = lastRes.ok ? await lastRes.json() : []
          lastInspection = Array.isArray(lastData) ? lastData[0] || null : null
        } catch { /* non-fatal */ }
      }

      let weeksSinceRebait: number | null = null
      let rebaitRequired = false
      if (lastInspection && lure?.rebait_weeks) {
        const lastDate = new Date(lastInspection.inspected_at)
        const now = new Date()
        weeksSinceRebait = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
        rebaitRequired = weeksSinceRebait >= lure.rebait_weeks
      }

      return {
        id: t.id,
        orchard_id: t.orchard_id,
        trap_nr: t.trap_nr,
        next_trap_id: t.next_trap_id,
        seq: t.seq,
        zone,
        pest: pest ? { ...pest, id: t.pest_id } : null,
        lure_type: lure,
        last_inspection: lastInspection,
        rebait_required: rebaitRequired,
        weeks_since_rebait: weeksSinceRebait,
      }
    } catch (err) {
      console.log('fetchTrapDetails error:', err)
      // Network failure — try IndexedDB as last resort
      try {
        const { getOne } = await import('@/lib/scout-db')
        const t = await getOne('traps', trapId)
        if (!t) return null
        const zone = t.zone_id ? await getOne('zones', t.zone_id) : null
        const pest = t.pest_id ? await getOne('pests', t.pest_id) : null
        const lure = t.lure_type_id ? await getOne('lure_types', t.lure_type_id) : null
        return {
          id: t.id, orchard_id: t.orchard_id, trap_nr: t.trap_nr,
          next_trap_id: t.next_trap_id, seq: t.seq, zone,
          pest: pest ? { ...pest, id: t.pest_id } : null, lure_type: lure,
          last_inspection: null, rebait_required: false, weeks_since_rebait: null,
        }
      } catch { return null }
    }
  }

  async function loadFirstTrap() {
    setLoading(true)
    setError(null)
    pendingNextRef.current = null
    try {
      // Refresh token before starting (prevents 401 after lunch breaks)
      if (navigator.onLine) await refreshAccessToken()
      const token = localStorage.getItem('farmscout_access_token')
      const userId = localStorage.getItem('farmscout_user_id')
      const isOnline = navigator.onLine
      const firstTrapId = localStorage.getItem('farmscout_first_trap_id')

      let startTrapId = firstTrapId
      let doneSoFar = 0

      if (isOnline) {
        // Check weekly status + resume point
        const statusRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_scout_weekly_status`, {
          method: 'POST',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ scout_user_id: userId }),
        })
        const status = await statusRes.json()
        if (status.status === 'completed') {
          localStorage.setItem('farmscout_week_completed', getCurrentWeekKey())
          onBack()
          return
        }
        if (status.resume_trap_id) startTrapId = status.resume_trap_id

        // Pre-load the full route chain — ensures correct order even if scout goes offline mid-route
        if (firstTrapId) {
          try {
            const routeRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_scout_route`, {
              method: 'POST',
              headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ first_trap_id: firstTrapId }),
            })
            if (routeRes.ok) {
              const routeData = await routeRes.json()
              if (Array.isArray(routeData) && routeData.length > 0) {
                const orderedIds = routeData.map((r: any) => r.trap_id)
                routeRef.current = orderedIds
                localStorage.setItem('farmscout_route_order', JSON.stringify(orderedIds))
                localStorage.setItem('farmscout_route_length', String(orderedIds.length))

                // Update IndexedDB traps with correct next_trap_id chain
                // so offline fetches also get the right order
                try {
                  const { getOne, upsertRecord } = await import('@/lib/scout-db')
                  for (let i = 0; i < orderedIds.length; i++) {
                    const localTrap = await getOne('traps', orderedIds[i])
                    if (localTrap) {
                      await upsertRecord('traps', {
                        ...localTrap,
                        next_trap_id: i < orderedIds.length - 1 ? orderedIds[i + 1] : null,
                      })
                    }
                  }
                } catch (e) {
                  console.log('[TrapInspection] IndexedDB route update failed:', e)
                }
              }
            }
          } catch (e) {
            console.log('[TrapInspection] Route pre-load failed:', e)
            // Non-fatal — fall back to linked-list walking
          }
        }

        // Count completed inspections this week
        const doneRes = await fetch(
          `${SUPABASE_URL}/rest/v1/trap_inspections?scout_id=eq.${userId}&inspected_at=gte.${getWeekStart()}&select=id`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Prefer': 'count=exact' } }
        )
        doneSoFar = parseInt(doneRes.headers.get('content-range')?.split('/')[1] || '0')
      } else {
        // Offline: load stored route order from last online session
        const stored = localStorage.getItem('farmscout_route_order')
        if (stored) {
          try { routeRef.current = JSON.parse(stored) } catch { /* ignore */ }
        }
      }

      // Set progress
      const routeLength = routeRef.current.length || parseInt(localStorage.getItem('farmscout_route_length') || '0')
      if (isOnline) {
        setProgress({ current: doneSoFar + 1, total: routeLength })
      } else {
        let startIdx = 0
        if (routeRef.current.length > 0 && startTrapId) {
          const idx = routeRef.current.indexOf(startTrapId)
          if (idx >= 0) startIdx = idx
        }
        setProgress({ current: startIdx + 1, total: routeLength })
      }

      if (!startTrapId) {
        setError('No trap data found. Please sync while online before going offline.')
        setLoading(false)
        return
      }

      const trapDetails = await fetchTrapDetails(startTrapId!)
      if (!trapDetails) {
        setError('No trap data found. Please sync while online before going offline.')
      } else {
        setTrap(trapDetails)
        setCount(0)
        setRebaited(false)
        triggerFlash()
      }
    } catch (err) {
      console.log('Error:', err)
      setError('Could not load traps. Please try again.')
    }
    setLoading(false)
  }

  function getCurrentWeekKey() {
    const now = new Date()
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }

  function getWeekStart() {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday.toISOString()
  }

  // Determine next trap from the pre-loaded route order (preferred)
  // or fall back to the trap's next_trap_id (legacy linked-list)
  function getNextTrapId(): string | null {
    const route = routeRef.current
    if (route.length > 0 && trap) {
      const currentIdx = route.indexOf(trap.id)
      if (currentIdx >= 0 && currentIdx < route.length - 1) {
        return route[currentIdx + 1]
      }
      return null // last trap or not found in route
    }
    // Fallback: use linked-list from trap record
    return trap?.next_trap_id ?? null
  }

  async function handleSave() {
    if (!trap || saving) return
    setSaving(true)

    const now = new Date().toISOString()
    const inspectionId = crypto.randomUUID()
    const isOnline = navigator.onLine

    // Refresh token before save to prevent 401 mid-route
    if (isOnline) await refreshAccessToken().catch(() => {})
    const token = localStorage.getItem('farmscout_access_token')

    const locationValue = gpsLocation
      ? `SRID=4326;POINT(${gpsLocation.lng} ${gpsLocation.lat})`
      : null

    const inspectionRecord = {
      id: inspectionId,
      trap_id: trap.id,
      organisation_id: localStorage.getItem('farmscout_organisation_id'),
      scout_id: localStorage.getItem('farmscout_user_id'),
      orchard_id: trap.orchard_id,
      pest_id_direct: null,
      rebaited,
      inspected_at: now,
      location: locationValue,
      nfc_scanned: false,
    }

    const countRecord = {
      id: crypto.randomUUID(),
      inspection_id: inspectionId,
      pest_id: trap.pest?.id || null,
      count,
    }

    try {
      let savedOnline = false
      if (isOnline) {
        try {
          const inspRes = await fetch(`${SUPABASE_URL}/rest/v1/trap_inspections`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify(inspectionRecord),
          })
          if (!inspRes.ok) throw new Error(`inspection ${inspRes.status}`)

          const countRes = await fetch(`${SUPABASE_URL}/rest/v1/trap_counts`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify(countRecord),
          })
          if (!countRes.ok) throw new Error(`count ${countRes.status}`)
          savedOnline = true
        } catch (onlineErr) {
          // Online save failed (token expired, flaky connection) — fall back to IndexedDB
          console.log('Online save failed, falling back to IndexedDB:', onlineErr)
        }
      }

      if (!savedOnline) {
        const { saveAndQueue } = await import('@/lib/scout-sync')
        await saveAndQueue('trap_inspections', inspectionRecord, supabaseKey, token || undefined)
        await saveAndQueue('trap_counts', countRecord, supabaseKey, token || undefined)
      }

      const nextTrapId = getNextTrapId()

      if (nextTrapId) {
        setProgress(p => ({ ...p, current: p.current + 1 }))
        const nextTrap = await fetchTrapDetails(nextTrapId)
        if (!nextTrap) {
          // Save succeeded but can't load next trap — show error with retry
          pendingNextRef.current = nextTrapId
          setError(`Could not load next trap. ${navigator.onLine ? 'Check your connection and try again.' : 'Please sync while online.'}`)
          setSaving(false)
          return
        }
        setTrap(nextTrap)
        setCount(0)
        setRebaited(false)
        triggerFlash()
        window.scrollTo(0, 0)
      } else {
        // Mark route as completed for this week (persists offline)
        localStorage.setItem('farmscout_week_completed', getCurrentWeekKey())
        setSaving(false)
        alert('All traps completed! Great work.')
        onBack()
        return
      }
    } catch (err) {
      console.log('Save error:', err)
      alert('Failed to save inspection. Please try again.')
    }

    setSaving(false)
  }

  // Retry handler: if we failed to load the next trap after a save, retry that specific trap
  async function handleRetry() {
    if (pendingNextRef.current) {
      setLoading(true)
      setError(null)
      const nextTrap = await fetchTrapDetails(pendingNextRef.current)
      if (nextTrap) {
        pendingNextRef.current = null
        setTrap(nextTrap)
        setCount(0)
        setRebaited(false)
        triggerFlash()
      } else {
        setError(`Still could not load trap. ${navigator.onLine ? 'Check your connection.' : 'Please go online and try again.'}`)
      }
      setLoading(false)
    } else {
      loadFirstTrap()
    }
  }

  if (loading) {
    return (
      <div style={styles.app}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={onBack}>&larr;</button>
          <div style={styles.headerTitle}>Trap Inspection</div>
          <div />
        </div>
        <div style={styles.centered}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🪤</div>
          <div style={{ color: '#7a8a5a' }}>Loading traps...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.app}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={onBack}>&larr;</button>
          <div style={styles.headerTitle}>Trap Inspection</div>
          <div />
        </div>
        <div style={styles.centered}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: '#e05c4b', marginBottom: 16, textAlign: 'center' }}>{error}</div>
          <button style={styles.secondaryBtn} onClick={handleRetry}>Try Again</button>
        </div>
      </div>
    )
  }

  if (!trap) return null

  const isLastTrap = (() => {
    const route = routeRef.current
    if (route.length > 0) {
      return route.indexOf(trap.id) >= route.length - 1
    }
    return !trap.next_trap_id
  })()

  return (
    <div style={styles.app}>
      <style>{`@keyframes flash-fade { from { opacity: 1; } to { opacity: 0; } }`}</style>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>&larr;</button>
        <div style={styles.headerTitle}>Trap Inspection</div>
        <div style={styles.progressText}>{progress.current}/{progress.total}</div>
      </div>

      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${(progress.current / progress.total) * 100}%` }} />
      </div>

      {/* Flash overlay — green pulse when moving to next trap */}
      {showFlash && <div style={styles.flashOverlay} />}

      <div style={styles.screen}>
        {/* Prominent trap identity banner */}
        <div style={styles.trapBanner}>
          <div style={styles.trapBannerNumber}>#{trap.trap_nr}</div>
          <div style={styles.trapBannerZone}>{trap.zone?.name || 'Unknown Zone'}</div>
          <div style={styles.trapBannerLure}>{trap.lure_type?.name || ''}</div>
        </div>

        <div style={styles.pestRow}>
          <div style={styles.pestThumb}>
            {trap.pest?.image_url ? (
              <img src={trap.pest.image_url} alt={pestName(trap.pest, language)} style={styles.pestThumbImg} />
            ) : (
              <span style={{ fontSize: 28 }}>🐛</span>
            )}
          </div>
          <div style={styles.pestLabel}>{pestName(trap.pest, language)}</div>
          {trap.weeks_since_rebait !== null && (
            <div style={styles.rebaitChip}>
              {trap.rebait_required ? '⚠' : '🔄'} {trap.weeks_since_rebait}w
            </div>
          )}
        </div>

        {trap.rebait_required && (
          <div style={styles.rebaitWarning}>
            ⚠️ Rebait Required — {trap.weeks_since_rebait} weeks since last rebait
          </div>
        )}

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Pest Count</div>
          <div style={styles.countInput}>
            <button style={styles.countBtn} onClick={() => setCount(c => Math.max(0, c - 1))}>&minus;</button>
            <div style={styles.countValue}>{count}</div>
            <button style={styles.countBtn} onClick={() => setCount(c => c + 1)}>+</button>
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Rebaited?</div>
          <div style={styles.rebaitRow}>
            <button
              style={{ ...styles.rebaitBtn, background: !rebaited ? '#5a2020' : '#1a2618', borderColor: !rebaited ? '#e05c4b' : '#3a4228', color: !rebaited ? '#ff8a7a' : '#8a9a6a' }}
              onClick={() => setRebaited(false)}
            >No</button>
            <button
              style={{ ...styles.rebaitBtn, background: rebaited ? '#1a3a1a' : '#1a2618', borderColor: rebaited ? '#6abf4b' : '#3a4228', color: rebaited ? '#7fd35b' : '#8a9a6a' }}
              onClick={() => setRebaited(true)}
            >Yes</button>
          </div>
        </div>

        <div style={styles.gpsStatus}>
          <span style={{ ...styles.gpsDot, background: gpsLocation ? '#6abf4b' : '#aaa' }} />
          {gpsLocation
            ? `GPS locked — ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`
            : 'Acquiring GPS...'}
        </div>
      </div>

      <div style={styles.bottomBar}>
        <button style={styles.cancelBtn} onClick={onBack}>Cancel</button>
        <button
          style={{ ...styles.saveBtn, opacity: saving ? 0.7 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : isLastTrap ? 'Save & Finish ✓' : 'Save & Next →'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', maxWidth: 600, margin: '0 auto', background: '#1e2412', color: '#f0f0e0', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#282f1c', borderBottom: '1px solid #4a5438', flexShrink: 0 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: '#fff' },
  backBtn: { background: 'none', border: 'none', color: '#f0a500', fontSize: 22, cursor: 'pointer', padding: 0 },
  progressText: { fontSize: 14, color: '#b0c080', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  progressBar: { height: 5, background: '#3a4228', flexShrink: 0 },
  progressFill: { height: '100%', background: '#f0a500', transition: 'width 0.4s ease' },
  flashOverlay: { position: 'absolute', inset: 0, background: 'rgba(106, 191, 75, 0.15)', zIndex: 10, pointerEvents: 'none', animation: 'flash-fade 0.6s ease-out forwards' },
  screen: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
  centered: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 },
  // Prominent trap identity banner
  trapBanner: { background: '#2a3318', borderBottom: '2px solid #4a5a30', padding: '16px 20px', textAlign: 'center' },
  trapBannerNumber: { fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' },
  trapBannerZone: { fontSize: 16, fontWeight: 600, color: '#f0a500', marginTop: 4 },
  trapBannerLure: { fontSize: 12, color: '#b0c080', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' },
  // Pest row — compact horizontal strip
  pestRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #3a4228' },
  pestThumb: { width: 48, height: 48, borderRadius: 8, background: '#2a3318', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  pestThumbImg: { width: 48, height: 48, objectFit: 'cover', borderRadius: 8 },
  pestLabel: { flex: 1, fontSize: 16, fontWeight: 600, color: '#f0f0e0' },
  rebaitChip: { fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: '#3a2a00', color: '#f0a500', whiteSpace: 'nowrap' },
  rebaitWarning: { margin: '10px 16px', padding: '12px 16px', background: '#3a2a00', border: '1px solid #f0a500', borderRadius: 6, color: '#ffc040', fontSize: 14, fontWeight: 600 },
  section: { padding: '16px 16px 0' },
  sectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b0c080', marginBottom: 10 },
  countInput: { display: 'flex', alignItems: 'center', border: '1px solid #4a5438', borderRadius: 8, overflow: 'hidden' },
  countBtn: { width: 72, height: 72, background: '#2a3318', border: 'none', color: '#f0a500', fontSize: 32, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
  countValue: { flex: 1, textAlign: 'center', fontSize: 42, fontWeight: 800, color: '#fff', background: '#232a16', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  rebaitRow: { display: 'flex', gap: 12 },
  rebaitBtn: { flex: 1, padding: '16px', borderRadius: 8, border: '2px solid', fontSize: 18, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.15s' },
  gpsStatus: { display: 'flex', alignItems: 'center', gap: 6, padding: '16px', fontSize: 12, color: '#9aaa7a' },
  gpsDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  bottomBar: { display: 'flex', gap: 12, padding: 16, background: '#282f1c', borderTop: '1px solid #4a5438', flexShrink: 0 },
  cancelBtn: { flex: 1, padding: '16px', background: 'transparent', border: '1px solid #4a5438', borderRadius: 8, color: '#9aaa7a', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  saveBtn: { flex: 2, padding: '16px', background: '#f0a500', border: 'none', borderRadius: 8, color: '#000', fontSize: 17, fontWeight: 700, cursor: 'pointer' },
  secondaryBtn: { padding: '12px 24px', background: 'transparent', border: '1px solid #4a5438', borderRadius: 8, color: '#f0f0e0', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
}

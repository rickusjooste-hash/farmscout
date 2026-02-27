'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'

// ── Types ─────────────────────────────────────────────────────────────────

interface TrapWithDetails {
  id: string
  orchard_id: string | null
  trap_nr: number
  next_trap_id: string | null
  seq: number
  zone: { name: string }
  pest: { id: string; name: string; image_url: string }
  lure_type: { rebait_weeks: number; name: string }
  last_inspection?: { inspected_at: string; rebaited: boolean } | null
  rebait_required: boolean
  weeks_since_rebait: number | null
}

// ── Main Component ────────────────────────────────────────────────────────

export default function TrapInspectionPage() {
  const [trap, setTrap] = useState<TrapWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [count, setCount] = useState(0)
  const [rebaited, setRebaited] = useState(false)
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 1, total: 1 })
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const router = useRouter()

  // Get GPS silently in background
 useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsLocation({ 
        lat: pos.coords.latitude, 
        lng: pos.coords.longitude 
      }),
      (err) => console.log('GPS error:', err),
      { 
        enableHighAccuracy: true, 
        timeout: 10000,
        maximumAge: 5000 // update every 5 seconds
      }
    )

    // Clean up when leaving the page
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Load first trap on mount
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
        // Online — fetch from Supabase
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/traps?id=eq.${trapId}&select=*`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } }
        )
        const data = await res.json()
        if (!data.length) return null
        t = data[0]

        const [zoneRes, pestRes, lureRes] = await Promise.all([
          t.zone_id ? fetch(`${SUPABASE_URL}/rest/v1/zones?id=eq.${t.zone_id}&select=name`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
          }) : null,
          t.pest_id ? fetch(`${SUPABASE_URL}/rest/v1/pests?id=eq.${t.pest_id}&select=name,image_url`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
          }) : null,
          t.lure_type_id ? fetch(`${SUPABASE_URL}/rest/v1/lure_types?id=eq.${t.lure_type_id}&select=name,rebait_weeks`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }
          }) : null,
        ])

        zone = zoneRes?.ok ? (await zoneRes.json())[0] : null
        pest = pestRes?.ok ? (await pestRes.json())[0] : null
        lure = lureRes?.ok ? (await lureRes.json())[0] : null

      } else {
        // Offline — load from IndexedDB
        const { getOne } = await import('@/lib/scout-db')
        t = await getOne('traps', trapId)
        if (!t) return null

        zone = t.zone_id ? await getOne('zones', t.zone_id) : null
        pest = t.pest_id ? await getOne('pests', t.pest_id) : null
        lure = t.lure_type_id ? await getOne('lure_types', t.lure_type_id) : null
      }

      // Get last inspection
      let lastInspection = null
      if (isOnline) {
        const lastRes = await fetch(
          `${SUPABASE_URL}/rest/v1/trap_inspections?trap_id=eq.${trapId}&order=inspected_at.desc&limit=1&select=inspected_at,rebaited`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } }
        )
        const lastData = lastRes.ok ? await lastRes.json() : []
        lastInspection = lastData[0] || null
      }

      // Calculate rebait
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

    } catch(err) {
      console.log('fetchTrapDetails error:', err)
      return null
    }
  }
async function loadFirstTrap() {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('farmscout_access_token')
      const userId = localStorage.getItem('farmscout_user_id')
      const routeLength = parseInt(localStorage.getItem('farmscout_route_length') || '0')
      const isOnline = navigator.onLine

      let startTrapId = localStorage.getItem('farmscout_first_trap_id')

      if (isOnline) {
        // Check weekly status — completed, in progress, or not started
        const statusRes = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_scout_weekly_status`,
          {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ scout_user_id: userId }),
          }
        )
        const status = await statusRes.json()
        console.log('Weekly status:', status)

        // If completed this week — go back home
        if (status.completed) {
          router.push('/scout?trap_status=completed')
          return
        }

        // Resume from where we left off if available
        if (status.resume_trap_id) startTrapId = status.resume_trap_id

        // Count how many already done this week for progress
        const doneRes = await fetch(
          `${SUPABASE_URL}/rest/v1/trap_inspections?scout_id=eq.${userId}&inspected_at=gte.${getWeekStart()}&select=id`,
          {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${token}`,
              'Prefer': 'count=exact',
            },
          }
        )
        const doneSoFar = parseInt(doneRes.headers.get('content-range')?.split('/')[1] || '0')
        setProgress({ current: doneSoFar + 1, total: routeLength })
      } else {
        // Offline — skip status check, start from beginning
        setProgress({ current: 1, total: routeLength })
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
      }

    } catch (err) {
      console.log('Error:', err)
      setError('Could not load traps. Please try again.')
    }
    setLoading(false)
  }

  function getWeekStart() {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday.toISOString()
  }

 async function handleSave() {
    if (!trap || saving) return
    setSaving(true)

    const now = new Date().toISOString()
    const inspectionId = crypto.randomUUID()
    const token = localStorage.getItem('farmscout_access_token')
    const isOnline = navigator.onLine

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
      if (isOnline) {
        // Online — save directly to Supabase
        const inspRes = await fetch(
          `${SUPABASE_URL}/rest/v1/trap_inspections`,
          {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify(inspectionRecord),
          }
        )
        if (!inspRes.ok) {
          const errText = await inspRes.text()
          console.log('Inspection save error:', errText)
          throw new Error('Failed to save inspection')
        }

        const countRes = await fetch(
          `${SUPABASE_URL}/rest/v1/trap_counts`,
          {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify(countRecord),
          }
        )
        if (!countRes.ok) {
          const errText = await countRes.text()
          console.log('Count save error:', errText)
          throw new Error('Failed to save count')
        }

      } else {
        // Offline — save to IndexedDB queue
        const { saveAndQueue } = await import('@/lib/scout-sync')
        await saveAndQueue('trap_inspections', inspectionRecord, supabaseKey)
        await saveAndQueue('trap_counts', countRecord, supabaseKey)
        console.log('[Offline] Saved to queue')
      }

      // Navigate to next trap
      if (trap.next_trap_id) {
        setProgress(p => ({ ...p, current: p.current + 1 }))
        const nextTrap = await fetchTrapDetails(trap.next_trap_id)
        setTrap(nextTrap)
        setCount(0)
        setRebaited(false)
        window.scrollTo(0, 0)
      } else {
        setTrap(null)
        setSaving(false)
        window.location.href = '/scout'
        alert('🎉 All traps completed! Great work.')
      }

    } catch (err) {
      console.log('Save error:', err)
      alert('Failed to save inspection. Please try again.')
    }

    setSaving(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.app}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => window.location.href = '/scout'}>←</button>
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
          <button style={styles.backBtn} onClick={() => window.location.href = '/scout'}>←</button>
          <div style={styles.headerTitle}>Trap Inspection</div>
          <div />
        </div>
        <div style={styles.centered}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: '#e05c4b', marginBottom: 16, textAlign: 'center' }}>{error}</div>
          <button style={styles.secondaryBtn} onClick={loadFirstTrap}>Try Again</button>
        </div>
      </div>
    )
  }

  if (!trap) return null

  return (
    <div style={styles.app}>

      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => window.location.href = '/scout'}>←</button>
        <div style={styles.headerTitle}>Trap Inspection</div>
        <div style={styles.progressText}>{progress.current}/{progress.total}</div>
      </div>

      {/* Progress Bar */}
      <div style={styles.progressBar}>
        <div style={{
          ...styles.progressFill,
          width: `${(progress.current / progress.total) * 100}%`
        }} />
      </div>

      {/* Content */}
      <div style={styles.screen}>

        {/* Pest Image */}
        <div style={styles.pestImageContainer}>
          {trap.pest?.image_url ? (
            <img
              src={trap.pest.image_url}
              alt={trap.pest.name}
              style={styles.pestImage}
            />
          ) : (
            <div style={styles.pestImagePlaceholder}>🐛</div>
          )}
          <div style={styles.pestName}>{trap.pest?.name}</div>
        </div>

        {/* Trap Info */}
        <div style={styles.trapInfo}>
          <div style={styles.infoRow}>
            <div style={styles.infoLabel}>Zone</div>
            <div style={styles.infoValue}>{trap.zone?.name || '—'}</div>
          </div>
          <div style={styles.infoRow}>
            <div style={styles.infoLabel}>Trap</div>
            <div style={styles.infoValue}>Trap #{trap.trap_nr} — {trap.lure_type?.name}</div>
          </div>
          {trap.weeks_since_rebait !== null && (
            <div style={styles.infoRow}>
              <div style={styles.infoLabel}>Last Rebait</div>
              <div style={styles.infoValue}>{trap.weeks_since_rebait} week{trap.weeks_since_rebait !== 1 ? 's' : ''} ago</div>
            </div>
          )}
        </div>

        {/* Rebait Warning */}
        {trap.rebait_required && (
          <div style={styles.rebaitWarning}>
            ⚠️ Rebait Required — {trap.weeks_since_rebait} weeks since last rebait
          </div>
        )}

        {/* Count Input */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Pest Count</div>
          <div style={styles.countInput}>
            <button
              style={styles.countBtn}
              onClick={() => setCount(c => Math.max(0, c - 1))}
            >−</button>
            <div style={styles.countValue}>{count}</div>
            <button
              style={styles.countBtn}
              onClick={() => setCount(c => c + 1)}
            >+</button>
          </div>
        </div>

        {/* Rebaited */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Rebaited?</div>
          <div style={styles.rebaitRow}>
            <button
              style={{
                ...styles.rebaitBtn,
                background: !rebaited ? '#3a1a1a' : 'transparent',
                borderColor: !rebaited ? '#e05c4b' : '#3a4228',
                color: !rebaited ? '#e05c4b' : '#7a8a5a',
              }}
              onClick={() => setRebaited(false)}
            >
              No
            </button>
            <button
              style={{
                ...styles.rebaitBtn,
                background: rebaited ? '#1a3a1a' : 'transparent',
                borderColor: rebaited ? '#6abf4b' : '#3a4228',
                color: rebaited ? '#6abf4b' : '#7a8a5a',
              }}
              onClick={() => setRebaited(true)}
            >
              Yes
            </button>
          </div>
        </div>

        {/* GPS Status */}
        <div style={styles.gpsStatus}>
          <span style={{
            ...styles.gpsDot,
            background: gpsLocation ? '#6abf4b' : '#7a8a5a'
          }} />
          {gpsLocation
            ? `GPS locked — ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`
            : 'Acquiring GPS...'}
        </div>

      </div>

      {/* Bottom Buttons */}
      <div style={styles.bottomBar}>
        <button
          style={{ ...styles.cancelBtn }}
          onClick={() => window.location.href = '/scout'}
        >
          Cancel
        </button>
        <button
          style={{
            ...styles.saveBtn,
            opacity: saving ? 0.7 : 1
          }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : trap.next_trap_id ? 'Save & Next →' : 'Save & Finish ✓'}
        </button>
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
    width: '100%',
    maxWidth: 600,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#f0a500',
    fontSize: 22,
    cursor: 'pointer',
    padding: 0,
  },
  progressText: {
    fontSize: 13,
    color: '#7a8a5a',
    fontVariantNumeric: 'tabular-nums',
  },
  progressBar: {
    height: 4,
    background: '#3a4228',
    flexShrink: 0,
  },
  progressFill: {
    height: '100%',
    background: '#f0a500',
    transition: 'width 0.4s ease',
  },
  screen: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pestImageContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px 16px',
    borderBottom: '1px solid #3a4228',
  },
  pestImage: {
    width: 160,
    height: 160,
    objectFit: 'contain',
    borderRadius: 8,
    background: '#222918',
    padding: 8,
  },
  pestImagePlaceholder: {
    width: 160,
    height: 160,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 60,
    background: '#222918',
    borderRadius: 8,
  },
  pestName: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 600,
    color: '#e8e8d8',
  },
  trapInfo: {
    padding: '12px 16px',
    borderBottom: '1px solid #3a4228',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#7a8a5a',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 500,
    color: '#e8e8d8',
    textAlign: 'right',
    maxWidth: '65%',
  },
  rebaitWarning: {
    margin: '12px 16px',
    padding: '12px 16px',
    background: '#2a1f00',
    border: '1px solid #f0a500',
    borderRadius: 6,
    color: '#f0a500',
    fontSize: 14,
    fontWeight: 600,
  },
  section: {
    padding: '16px 16px 0',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7a8a5a',
    marginBottom: 10,
  },
  countInput: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #3a4228',
    borderRadius: 6,
    overflow: 'hidden',
  },
  countBtn: {
    width: 64,
    height: 64,
    background: '#222918',
    border: 'none',
    color: '#f0a500',
    fontSize: 28,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
  countValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 36,
    fontWeight: 700,
    color: '#e8e8d8',
    background: '#1f2514',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rebaitRow: {
    display: 'flex',
    gap: 12,
  },
  rebaitBtn: {
    flex: 1,
    padding: '14px',
    borderRadius: 6,
    border: '1px solid',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'all 0.15s',
  },
  gpsStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '16px',
    fontSize: 11,
    color: '#7a8a5a',
  },
  gpsDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  bottomBar: {
    display: 'flex',
    gap: 12,
    padding: 16,
    background: '#222918',
    borderTop: '1px solid #3a4228',
    flexShrink: 0,
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    background: 'transparent',
    border: '1px solid #3a4228',
    borderRadius: 6,
    color: '#7a8a5a',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 2,
    padding: '14px',
    background: '#f0a500',
    border: 'none',
    borderRadius: 6,
    color: '#000',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid #3a4228',
    borderRadius: 6,
    color: '#e8e8d8',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
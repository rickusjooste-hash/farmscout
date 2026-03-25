'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  qcGetAll,
  matchOrchardFromGPS,
  type QcOrchard,
  type QcEmployee,
} from '@/lib/qc-db'
import { qcSaveAndQueue, qcPushPendingRecords } from '@/lib/qc-sync'
import { beep, generateUUID } from '@/lib/qc-utils'

type SubView = 'gps_detect' | 'team_select' | 'counting' | 'summary'

const TREE_COUNT = 10

interface Props {
  onDone: () => void
}

export default function DropShinersView({ onDone }: Props) {
  const [subView, setSubView] = useState<SubView>('gps_detect')
  const [orchards, setOrchards] = useState<QcOrchard[]>([])
  const [farmIdSet, setFarmIdSet] = useState<Set<string>>(new Set())
  const [selectedOrchard, setSelectedOrchard] = useState<QcOrchard | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'detecting' | 'found' | 'failed'>('detecting')
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [showManualSelect, setShowManualSelect] = useState(false)

  const [teams, setTeams] = useState<string[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const [currentTree, setCurrentTree] = useState(0) // 0-indexed
  const [treeCounts, setTreeCounts] = useState<{ drops: number; shiners: number }[]>(
    () => Array.from({ length: TREE_COUNT }, () => ({ drops: 0, shiners: 0 }))
  )
  const [treeGps, setTreeGps] = useState<({ lat: number; lng: number } | null)[]>(
    () => Array.from({ length: TREE_COUNT }, () => null)
  )

  const [saving, setSaving] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPress = useRef(false)
  const touchedRef = useRef(false) // prevent mouse events after touch

  // ── Load orchards + teams on mount ──────────────────────────────────────

  useEffect(() => {
    (async () => {
      const orchs = await qcGetAll('orchards')
      setOrchards(orchs)

      let farmIds: string[] = []
      try {
        const stored = localStorage.getItem('qcapp_farm_ids')
        if (stored) farmIds = JSON.parse(stored)
      } catch {}
      if (!farmIds.length) {
        const single = localStorage.getItem('qcapp_farm_id')
        if (single) farmIds = [single]
      }
      const fids = new Set(farmIds)
      setFarmIdSet(fids)
      const employees: QcEmployee[] = await qcGetAll('employees')
      const farmEmps = employees.filter(e => fids.has(e.farm_id) && e.is_active)
      const uniqueTeams = [...new Set(farmEmps.map(e => e.team).filter(Boolean))] as string[]
      setTeams(uniqueTeams.sort())
    })()
  }, [])

  // ── GPS detect (mirrors runner approach) ─────────────────────────────────

  const gpsWatchRef = useRef<number | null>(null)
  const gpsSettled = useRef(false)

  function stopGpsWatch() {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current)
      gpsWatchRef.current = null
    }
  }

  async function matchOrchardByGps(lat: number, lng: number) {
    const token = localStorage.getItem('qcapp_access_token') || ''
    let farmIds: string[] = []
    try { farmIds = JSON.parse(localStorage.getItem('qcapp_farm_ids') || '[]') } catch {}
    if (!farmIds.length) {
      const single = localStorage.getItem('qcapp_farm_id') || ''
      if (single) farmIds = [single]
    }
    if (!farmIds.length) return

    const apiHeaders = {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

    try {
      // 1. Exact polygon match via RPC
      for (const farmId of farmIds) {
        const res = await fetch(`${baseUrl}/rest/v1/rpc/match_orchard_from_gps`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ p_lat: lat, p_lng: lng, p_farm_id: farmId }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data?.id) {
            const local = orchards.find(o => o.id === data.id)
            setSelectedOrchard(local || { id: data.id, name: data.name, farm_id: farmId, commodity_id: '' } as any)
            setGpsStatus('found')
            return
          }
        }
      }

      // 2. Nearby orchards within 100m
      for (const farmId of farmIds) {
        const res = await fetch(`${baseUrl}/rest/v1/rpc/nearby_orchards_from_gps`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ p_lat: lat, p_lng: lng, p_farm_id: farmId, p_radius: 100 }),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            data.sort((a: any, b: any) => a.distance_m - b.distance_m)
            const local = orchards.find(o => o.id === data[0].id)
            if (local) { setSelectedOrchard(local); setGpsStatus('found'); return }
          }
        }
      }
    } catch (err) {
      console.warn('[DropShiners] RPC GPS match failed:', err)
    }

    // 3. Offline fallback — point-in-polygon from IndexedDB
    try {
      const match = await matchOrchardFromGPS(lat, lng)
      if (match) { setSelectedOrchard(match); setGpsStatus('found'); return }
    } catch {}

    // 4. Offline fallback — nearest by centroid distance
    if (orchards.length > 0) {
      const withDist = orchards
        .filter(o => o.boundary?.coordinates)
        .map(o => {
          const ring = o.boundary.type === 'MultiPolygon'
            ? o.boundary.coordinates[0][0]
            : o.boundary.coordinates[0]
          if (!ring?.length) return null
          const oLng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length
          const oLat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length
          const R = 6371000
          const dLat = (oLat - lat) * Math.PI / 180
          const dLon = (oLng - lng) * Math.PI / 180
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(oLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          return { id: o.id, distance_m: Math.round(dist) }
        })
        .filter((x): x is { id: string; distance_m: number } => x !== null && x.distance_m <= 200)
        .sort((a, b) => a.distance_m - b.distance_m)

      if (withDist.length >= 1) {
        const match = orchards.find(o => o.id === withDist[0].id)
        if (match) { setSelectedOrchard(match); setGpsStatus('found'); return }
      }
    }

    setGpsStatus('failed')
  }

  useEffect(() => {
    if (subView !== 'gps_detect') return
    if (selectedOrchard && gpsStatus === 'found') return // already matched
    setGpsStatus('detecting')
    gpsSettled.current = false

    if (!navigator.geolocation) { setGpsStatus('failed'); return }

    const GOOD_ACCURACY = 30
    const MAX_WAIT = 15000
    let bestAccuracy = Infinity

    const timeoutId = setTimeout(() => {
      if (gpsSettled.current) return
      gpsSettled.current = true
      stopGpsWatch()
    }, MAX_WAIT)

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy
          setGpsCoords({ lat: latitude, lng: longitude })
          matchOrchardByGps(latitude, longitude)
        }
        if (accuracy <= GOOD_ACCURACY && !gpsSettled.current) {
          gpsSettled.current = true
          clearTimeout(timeoutId)
          stopGpsWatch()
        }
      },
      (err) => {
        if (gpsSettled.current) return
        gpsSettled.current = true
        clearTimeout(timeoutId)
        stopGpsWatch()
        setGpsStatus('failed')
      },
      { enableHighAccuracy: true, timeout: MAX_WAIT, maximumAge: 0 }
    )
    gpsWatchRef.current = watchId

    return () => { clearTimeout(timeoutId); stopGpsWatch() }
  }, [subView, orchards])

  // ── Navigation helpers ─────────────────────────────────────────────────

  function goToTeamSelect() {
    if (teams.length === 0) {
      // No teams — skip directly to counting
      setSelectedTeam(null)
      setSubView('counting')
    } else {
      setSubView('team_select')
    }
  }

  function handleBack() {
    if (subView === 'counting') {
      if (confirm('Discard this inspection?')) {
        onDone()
      }
    } else {
      onDone()
    }
  }

  // ── GPS capture per tree ────────────────────────────────────────────────

  const captureTreeGps = useCallback((treeIdx: number) => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTreeGps(prev => {
          const updated = [...prev]
          updated[treeIdx] = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          return updated
        })
      },
      () => {}, // silently ignore errors — GPS is best-effort per tree
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    )
  }, [])

  // Capture GPS whenever we enter counting or switch trees
  useEffect(() => {
    if (subView === 'counting') {
      captureTreeGps(currentTree)
    }
  }, [subView, currentTree, captureTreeGps])

  // ── Touch handlers for counting ─────────────────────────────────────────

  function handlePointerDown(zone: 'shiners' | 'drops', isTouch: boolean) {
    if (isTouch) touchedRef.current = true
    else if (touchedRef.current) return // skip mouse after touch

    isLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      // Long press = undo (decrement)
      setTreeCounts(prev => {
        const updated = [...prev]
        const tree = { ...updated[currentTree] }
        if (zone === 'shiners' && tree.shiners > 0) tree.shiners--
        else if (zone === 'drops' && tree.drops > 0) tree.drops--
        updated[currentTree] = tree
        return updated
      })
      try { navigator.vibrate(100) } catch {}
    }, 500)
  }

  function handlePointerUp(zone: 'shiners' | 'drops', isTouch: boolean) {
    if (!isTouch && touchedRef.current) { touchedRef.current = false; return }

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!isLongPress.current) {
      // Normal tap = increment
      setTreeCounts(prev => {
        const updated = [...prev]
        const tree = { ...updated[currentTree] }
        if (zone === 'shiners') tree.shiners++
        else tree.drops++
        updated[currentTree] = tree
        return updated
      })
      try { navigator.vibrate(30) } catch {}
    }
  }

  function goNextTree() {
    if (currentTree < TREE_COUNT - 1) {
      setCurrentTree(currentTree + 1)
      beep()
    } else {
      setSubView('summary')
    }
  }

  function goPrevTree() {
    if (currentTree > 0) setCurrentTree(currentTree - 1)
  }

  // ── Save ───────────────────────────────────────────────────────────────

  const totalDrops = treeCounts.reduce((sum, t) => sum + t.drops, 0)
  const totalShiners = treeCounts.reduce((sum, t) => sum + t.shiners, 0)

  async function handleSave() {
    setSaving(true)
    try {
      const orgId = localStorage.getItem('qcapp_org_id') || ''
      const farmId = selectedOrchard!.farm_id
      const workerId = localStorage.getItem('qcapp_worker_id') || localStorage.getItem('qcapp_user_id') || ''

      const sessionId = generateUUID()
      const now = new Date().toISOString()

      await qcSaveAndQueue('picking_sessions', {
        id: sessionId,
        organisation_id: orgId,
        farm_id: farmId,
        orchard_id: selectedOrchard!.id,
        team: selectedTeam || null,
        qc_worker_id: workerId,
        inspected_at: now,
        tree_count: TREE_COUNT,
        total_drops: totalDrops,
        total_shiners: totalShiners,
        gps_lat: gpsCoords?.lat ?? null,
        gps_lng: gpsCoords?.lng ?? null,
        notes: null,
        created_at: now,
        _syncStatus: 'pending',
        _orchard_name: selectedOrchard!.name,
      })

      for (let i = 0; i < TREE_COUNT; i++) {
        await qcSaveAndQueue('picking_trees', {
          id: generateUUID(),
          session_id: sessionId,
          organisation_id: orgId,
          tree_nr: i + 1,
          drops: treeCounts[i].drops,
          shiners: treeCounts[i].shiners,
          gps_lat: treeGps[i]?.lat ?? null,
          gps_lng: treeGps[i]?.lng ?? null,
          created_at: now,
          _syncStatus: 'pending',
        })
      }

      // Background push
      qcPushPendingRecords().catch(() => {})
      onDone()
    } catch (err) {
      console.error('[DropShiners] Save failed:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── RENDER ─────────────────────────────────────────────────────────────

  // GPS DETECT
  if (subView === 'gps_detect') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={handleBack}>← Back</button>
          <div style={s.topTitle}>Drop & Shiners</div>
        </div>

        {gpsStatus === 'detecting' && !showManualSelect && (
          <div style={s.centered}>
            <div style={{ fontSize: 48 }}>📍</div>
            <div style={{ color: '#7cbe4a', marginTop: 12, fontSize: 16 }}>Detecting orchard...</div>
          </div>
        )}

        {gpsStatus === 'found' && !showManualSelect && (
          <div style={s.centered}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ color: '#e8f0e0', marginTop: 12, fontSize: 18, fontWeight: 700 }}>
              {selectedOrchard?.name}
            </div>
            <div style={{ color: '#7aaa6a', marginTop: 4, fontSize: 14 }}>
              {selectedOrchard?.variety || ''}
            </div>
            <button style={{ ...s.primaryBtn, marginTop: 24 }} onClick={goToTeamSelect}>
              Confirm
            </button>
            <button style={{ ...s.secondaryBtn, marginTop: 12 }} onClick={() => setShowManualSelect(true)}>
              Wrong orchard? Select manually
            </button>
          </div>
        )}

        {(gpsStatus === 'failed' || showManualSelect) && (
          <div style={{ padding: 20 }}>
            {gpsStatus === 'failed' && !showManualSelect && (
              <div style={{ color: '#e05c4b', textAlign: 'center', marginBottom: 16, fontSize: 14 }}>
                GPS could not detect orchard. Select manually:
              </div>
            )}
            {showManualSelect && (
              <div style={{ color: '#7aaa6a', textAlign: 'center', marginBottom: 16, fontSize: 14 }}>
                Select orchard:
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {orchards
                .filter(o => farmIdSet.has(o.farm_id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(o => (
                  <button
                    key={o.id}
                    style={{
                      ...s.orchardBtn,
                      borderColor: selectedOrchard?.id === o.id ? '#7cbe4a' : '#2e5a2e',
                      background: selectedOrchard?.id === o.id ? '#2a4a1a' : '#1e3a1e',
                    }}
                    onClick={() => {
                      setSelectedOrchard(o)
                      setGpsStatus('found')
                      setShowManualSelect(false)
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#e8f0e0' }}>{o.name}</div>
                    {o.variety && <div style={{ fontSize: 12, color: '#7aaa6a' }}>{o.variety}</div>}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // TEAM SELECT
  if (subView === 'team_select') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => setSubView('gps_detect')}>← Back</button>
          <div style={s.topTitle}>Select Picking Team</div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {teams.map(team => (
            <button
              key={team}
              style={{
                ...s.teamBtn,
                borderColor: selectedTeam === team ? '#7cbe4a' : '#2e5a2e',
                background: selectedTeam === team ? '#2a4a1a' : '#1e3a1e',
              }}
              onClick={() => {
                setSelectedTeam(team)
                setSubView('counting')
              }}
            >
              {team}
            </button>
          ))}
          <button
            style={{ ...s.secondaryBtn, marginTop: 8 }}
            onClick={() => { setSelectedTeam(null); setSubView('counting') }}
          >
            Skip (no team)
          </button>
        </div>
      </div>
    )
  }

  // COUNTING
  if (subView === 'counting') {
    const tree = treeCounts[currentTree]
    return (
      <div style={s.countingPage}>
        <div style={s.countingTopBar}>
          <button style={s.backBtn} onClick={handleBack}>← Back</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8f0e0' }}>
              Tree {currentTree + 1} of {TREE_COUNT}
            </div>
            <div style={{ fontSize: 12, color: '#7aaa6a' }}>
              {selectedOrchard?.name}{selectedTeam ? ` · ${selectedTeam}` : ''}
            </div>
          </div>
          <div style={{ width: 60 }} /> {/* spacer for centering */}
        </div>

        {/* Shiner zone (top half) */}
        <div
          style={s.shinerZone}
          onTouchStart={() => handlePointerDown('shiners', true)}
          onTouchEnd={() => handlePointerUp('shiners', true)}
          onMouseDown={() => handlePointerDown('shiners', false)}
          onMouseUp={() => handlePointerUp('shiners', false)}
        >
          <div style={s.zoneLabel}>🍎 Shiners</div>
          <div style={s.zoneCount}>{tree.shiners}</div>
          <div style={s.zoneHint}>Tap to add · Hold to undo</div>
        </div>

        {/* Drop zone (bottom half) */}
        <div
          style={s.dropZone}
          onTouchStart={() => handlePointerDown('drops', true)}
          onTouchEnd={() => handlePointerUp('drops', true)}
          onMouseDown={() => handlePointerDown('drops', false)}
          onMouseUp={() => handlePointerUp('drops', false)}
        >
          <div style={s.zoneLabel}>🍂 Drops</div>
          <div style={s.zoneCount}>{tree.drops}</div>
          <div style={s.zoneHint}>Tap to add · Hold to undo</div>
        </div>

        {/* Bottom nav */}
        <div style={s.countingNav}>
          <button
            style={{ ...s.navBtn, opacity: currentTree === 0 ? 0.3 : 1 }}
            disabled={currentTree === 0}
            onClick={goPrevTree}
          >
            ‹ Prev
          </button>
          <div style={s.treeDots}>
            {Array.from({ length: TREE_COUNT }, (_, i) => (
              <button
                key={i}
                style={{
                  ...s.dot,
                  background: i === currentTree
                    ? '#7cbe4a'
                    : (treeCounts[i].drops > 0 || treeCounts[i].shiners > 0)
                      ? '#4a7a4a'
                      : '#2e5a2e',
                }}
                onClick={() => setCurrentTree(i)}
              />
            ))}
          </div>
          <button style={s.navBtn} onClick={goNextTree}>
            {currentTree === TREE_COUNT - 1 ? 'Done ›' : 'Next ›'}
          </button>
        </div>
      </div>
    )
  }

  // SUMMARY
  if (subView === 'summary') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => { setSubView('counting'); setCurrentTree(TREE_COUNT - 1) }}>← Back</button>
          <div style={s.topTitle}>Summary</div>
        </div>

        <div style={s.summaryHeader}>
          <div style={{ fontSize: 14, color: '#7aaa6a', marginBottom: 8 }}>
            {selectedOrchard?.name}{selectedTeam ? ` · ${selectedTeam}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            <div style={s.summaryTotal}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#e8f0e0' }}>{totalShiners}</div>
              <div style={{ fontSize: 13, color: '#7aaa6a' }}>Shiners</div>
            </div>
            <div style={s.summaryTotal}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#e8f0e0' }}>{totalDrops}</div>
              <div style={{ fontSize: 13, color: '#7aaa6a' }}>Drops</div>
            </div>
          </div>
        </div>

        {/* 5x2 tree grid */}
        <div style={s.treeGrid}>
          {treeCounts.map((t, i) => (
            <div key={i} style={s.treeCell}>
              <div style={{ fontSize: 11, color: '#7aaa6a', marginBottom: 2 }}>Tree {i + 1}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <span style={{ fontSize: 14, color: '#a4d88a' }}>🍎{t.shiners}</span>
                <span style={{ fontSize: 14, color: '#c49a6c' }}>🍂{t.drops}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '24px 20px' }}>
          <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Inspection'}
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ── Styles ───────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: '#0f1a0a', color: '#e8f0e0', display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12, borderBottom: '1px solid #2e5a2e' },
  backBtn: { background: 'none', border: 'none', color: '#7cbe4a', fontSize: 15, cursor: 'pointer', padding: 0, flexShrink: 0 },
  topTitle: { fontSize: 17, fontWeight: 600, color: '#e8f0e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  centered: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 },

  primaryBtn: { background: '#4a9e2a', border: 'none', borderRadius: 10, color: '#fff', padding: '14px 32px', fontSize: 16, fontWeight: 700, cursor: 'pointer', width: '100%', maxWidth: 280 },
  secondaryBtn: { background: 'none', border: '1px solid #3a5a3a', borderRadius: 8, color: '#7aaa6a', padding: '10px 20px', fontSize: 14, cursor: 'pointer' },

  orchardBtn: { border: '1px solid #2e5a2e', borderRadius: 10, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', background: '#1e3a1e' },
  teamBtn: { border: '1px solid #2e5a2e', borderRadius: 10, padding: '16px 20px', textAlign: 'center', cursor: 'pointer', background: '#1e3a1e', fontSize: 17, fontWeight: 600, color: '#e8f0e0' },

  // Counting view
  countingPage: { height: '100dvh', background: '#0f1a0a', display: 'flex', flexDirection: 'column', userSelect: 'none' },
  countingTopBar: { display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 8, borderBottom: '1px solid #2e5a2e', flexShrink: 0 },

  shinerZone: {
    flex: 1,
    background: '#2a4a1a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    touchAction: 'manipulation',
    borderBottom: '2px solid #1a2a0a',
  },
  dropZone: {
    flex: 1,
    background: '#3a2a1a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  zoneLabel: { fontSize: 16, fontWeight: 600, color: '#e8f0e0', opacity: 0.7 },
  zoneCount: { fontSize: 72, fontWeight: 700, color: '#ffffff', lineHeight: 1 },
  zoneHint: { fontSize: 11, color: '#e8f0e0', opacity: 0.4, marginTop: 8 },

  countingNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #2e5a2e', background: '#0f1a0a', flexShrink: 0 },
  navBtn: { background: 'none', border: '1px solid #3a5a3a', borderRadius: 8, color: '#7cbe4a', padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', minWidth: 70, textAlign: 'center' },
  treeDots: { display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 },

  // Summary
  summaryHeader: { textAlign: 'center', padding: '24px 20px 16px' },
  summaryTotal: { textAlign: 'center' },
  treeGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '0 20px' },
  treeCell: { background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 8, padding: '8px 4px', textAlign: 'center' },

  saveBtn: { background: '#4a9e2a', border: 'none', borderRadius: 10, color: '#fff', padding: '16px 32px', fontSize: 17, fontWeight: 700, cursor: 'pointer', width: '100%' },
}

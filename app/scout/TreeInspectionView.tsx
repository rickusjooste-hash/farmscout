'use client'

import { useEffect, useRef, useState } from 'react'
import { saveAndQueue, runFullSync } from '../../lib/scout-sync'
import { getAll, getAllByIndex, getOne, upsertRecord } from '../../lib/scout-db'

type SubView = 'zone_list' | 'tree_list' | 'inspecting'
type ObservationMethod = 'present_absent' | 'count' | 'leaf_inspection'

interface ZoneWithProgress {
  zone_id: string
  zone_name: string
  orchard_id: string
  orchard_name: string
  orchard_ha: number
  commodity_id: string
  commodity_code: string
  tree_count: number
  completed: number
}

interface CommodityPest {
  id: string          // commodity_pests.id
  pest_id: string
  pest_name: string
  display_name: string
  observation_method: ObservationMethod
  display_order: number
}

interface InspectionSession {
  id: string
  zone_id: string
  orchard_id: string
  farm_id: string
  organisation_id: string
  scout_id: string
  commodity_id: string
  tree_count: number
  inspected_at: string
  completed_at?: string
  week_nr?: number
}

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day) // days back to Monday
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getISOWeekNr(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export default function TreeInspectionView({
  onBack,
  commodityCode,
}: {
  onBack: () => void
  commodityCode?: string
}) {
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const [subView, setSubView] = useState<SubView>('zone_list')
  const [zones, setZones] = useState<ZoneWithProgress[]>([])
  const [loadingZones, setLoadingZones] = useState(true)
  const [selectedZone, setSelectedZone] = useState<ZoneWithProgress | null>(null)
  const [session, setSession] = useState<InspectionSession | null>(null)
  const [completedTreeNrs, setCompletedTreeNrs] = useState<Set<number>>(new Set())
  const [pests, setPests] = useState<CommodityPest[]>([])
  const [selectedTreeNr, setSelectedTreeNr] = useState<number | null>(null)

  // Per-tree inspection state
  const [observations, setObservations] = useState<Map<string, number>>(new Map())
  const [photo, setPhoto] = useState<string | null>(null)
  const [comments, setComments] = useState('')
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const photoInputRef = useRef<HTMLInputElement>(null)

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    loadZones()
  }, [])

  async function loadZones() {
    setLoadingZones(true)
    try {
      const userId = localStorage.getItem('farmscout_user_id')
      const farmId = localStorage.getItem('farmscout_farm_id')
      const sectionId = localStorage.getItem('farmscout_section_id') // may be null
      if (!userId || !farmId) { setLoadingZones(false); return }

      const weekStart = getWeekStart()

      // Load all needed reference data from IndexedDB
      const [allZones, allOrchards, allCommodities, allSessions, allTrees] = await Promise.all([
        getAll('zones'),
        getAll('orchards'),
        getAll('commodities'),
        getAll('inspection_sessions'),
        getAll('inspection_trees'),
      ])

      const orchardMap = new Map(allOrchards.map((o: any) => [o.id, o]))
      const commodityMap = new Map(allCommodities.map((c: any) => [c.id, c]))

      // Map old per-variety commodity codes → tree scouting group codes
      const CODE_TO_GROUP: Record<string, string> = {
        AP: 'POME', PR: 'POME',
        NE: 'STONE', PE: 'STONE', PL: 'STONE', SF: 'STONE',
        CI: 'CITRUS',
        POME: 'POME', STONE: 'STONE', CITRUS: 'CITRUS',
      }
      // Build group code → group commodity id (for commodity_pests lookups)
      const groupCommodityId = new Map<string, string>()
      for (const c of allCommodities) {
        if (CODE_TO_GROUP[c.code] === c.code) groupCommodityId.set(c.code, c.id)
      }

      // Build zone+orchard+commodity rows — all zones on this farm matching the commodity
      const result: ZoneWithProgress[] = []

      for (const zone of allZones) {
        const orchard = orchardMap.get(zone.orchard_id)
        if (!orchard) continue

        // Only show zones belonging to this scout's farm
        if (orchard.farm_id !== farmId) continue

        // If the scout is assigned to a section, filter to that section only
        // (check zone.section_id first, fall back to orchard.section_id)
        if (sectionId) {
          const zoneSectionMatch = zone.section_id === sectionId
          const orchardSectionMatch = !zone.section_id && orchard.section_id === sectionId
          if (!zoneSectionMatch && !orchardSectionMatch) continue
        }

        const commodity = commodityMap.get(orchard.commodity_id)
        if (!commodity) continue

        const groupCode = CODE_TO_GROUP[commodity.code]
        if (!groupCode) continue  // unrecognised commodity — skip

        // Filter by commodity code if specified
        if (commodityCode && groupCode !== commodityCode) continue

        // Use the group commodity id so loadPests() hits the right commodity_pests rows
        const groupId = groupCommodityId.get(groupCode)
        if (!groupId) continue  // POME/STONE/CITRUS commodity row missing — sync needed

        const ha = orchard.ha ?? 0  // kept for display only
        const tree_count = 25

        // Find current-week session for this zone
        const weekSession = allSessions.find((s: any) =>
          s.zone_id === zone.id &&
          s.scout_id === userId &&
          new Date(s.inspected_at) >= weekStart
        )

        // Count completed trees this week
        const completed = weekSession
          ? allTrees.filter((t: any) => t.session_id === weekSession.id).length
          : 0

        result.push({
          zone_id: zone.id,
          zone_name: zone.name,
          orchard_id: orchard.id,
          orchard_name: orchard.name,
          orchard_ha: ha,
          commodity_id: groupId,
          commodity_code: groupCode,
          tree_count,
          completed,
        })
      }

      // Sort by orchard name then zone name
      result.sort((a, b) =>
        a.orchard_name.localeCompare(b.orchard_name) || a.zone_name.localeCompare(b.zone_name)
      )

      setZones(result)
    } catch (err) {
      console.error('[TreeScouting] Failed to load zones:', err)
    }
    setLoadingZones(false)
  }

  async function handleZoneSelect(zone: ZoneWithProgress) {
    setSelectedZone(zone)

    const userId = localStorage.getItem('farmscout_user_id') || ''
    const farmId = localStorage.getItem('farmscout_farm_id') || ''
    const orgId = localStorage.getItem('farmscout_organisation_id') || ''
    const weekStart = getWeekStart()

    // Look for an existing session this week
    const allSessions = await getAll('inspection_sessions')
    let currentSession = allSessions.find((s: any) =>
      s.zone_id === zone.zone_id &&
      s.scout_id === userId &&
      new Date(s.inspected_at) >= weekStart
    )

    if (!currentSession) {
      // Create new session for this week
      const newSession: InspectionSession = {
        id: crypto.randomUUID(),
        zone_id: zone.zone_id,
        orchard_id: zone.orchard_id,
        farm_id: farmId,
        organisation_id: orgId,
        scout_id: userId,
        commodity_id: zone.commodity_id,
        tree_count: zone.tree_count,
        inspected_at: new Date().toISOString(),
        week_nr: getISOWeekNr(new Date()),
      }
      await saveAndQueue('inspection_sessions', newSession, supabaseKey)
      currentSession = newSession
    }

    setSession(currentSession)

    // Load completed tree numbers for this session
    const allTrees = await getAll('inspection_trees')
    const done = new Set<number>(
      allTrees
        .filter((t: any) => t.session_id === currentSession.id)
        .map((t: any) => t.tree_nr as number)
    )
    setCompletedTreeNrs(done)

    // Load pests for this commodity, filtered by farm overrides
    await loadPests(zone.commodity_id)

    setSubView('tree_list')
  }

  async function loadPests(commodityId: string) {
    const [cpRows, farmConfig, pestRows] = await Promise.all([
      getAllByIndex('commodity_pests', 'by_commodity', commodityId),
      getAll('farm_pest_config'),
      getAll('pests'),
    ])

    const suppressedIds = new Set(
      farmConfig.filter((f: any) => f.is_active === false).map((f: any) => f.commodity_pest_id)
    )
    const pestMap = new Map(pestRows.map((p: any) => [p.id, p]))

    const result: CommodityPest[] = cpRows
      .filter((cp: any) => !suppressedIds.has(cp.id))
      .map((cp: any) => {
        const pest = pestMap.get(cp.pest_id)
        return {
          id: cp.id,
          pest_id: cp.pest_id,
          pest_name: pest?.name || 'Unknown',
          display_name: cp.display_name || pest?.name || 'Unknown',
          observation_method: cp.observation_method || 'count',
          display_order: cp.display_order ?? 0,
        }
      })
      .sort((a, b) => a.display_order - b.display_order)

    setPests(result)
  }

  function handleTreeSelect(treeNr: number) {
    if (completedTreeNrs.has(treeNr)) return
    setSelectedTreeNr(treeNr)
    setObservations(new Map())
    setPhoto(null)
    setComments('')
    setSubView('inspecting')
  }

  async function handleSaveTree() {
    if (!session || selectedTreeNr === null || saving) return
    setSaving(true)

    try {
      const treeId = crypto.randomUUID()
      const hasPhoto = !!photo

      // Build tree record
      const treeRecord: Record<string, any> = {
        id: treeId,
        session_id: session.id,
        organisation_id: session.organisation_id,
        tree_nr: selectedTreeNr,
        comments: comments || null,
        inspected_at: new Date().toISOString(),
        ...(gpsLocation ? { location: `POINT(${gpsLocation.lng} ${gpsLocation.lat})` } : {}),
      }

      // Save tree (with has_photo flag if photo pending)
      await saveAndQueue('inspection_trees', treeRecord, supabaseKey, undefined, { has_photo: hasPhoto })

      // Save photo to IndexedDB if present
      if (hasPhoto && photo) {
        const db = await import('../../lib/scout-db').then(m => m.getScoutDB())
        await db.put('photos', { id: treeId, data: photo, mimeType: 'image/jpeg', synced: false })
      }

      // Save one observation record per pest
      for (const pest of pests) {
        const value = observations.get(pest.id) ?? 0
        const obsRecord = {
          id: crypto.randomUUID(),
          tree_id: treeId,
          organisation_id: session.organisation_id,
          pest_id: pest.pest_id,
          count: value,
          severity: 'none',
        }
        await saveAndQueue('inspection_observations', obsRecord, supabaseKey)
      }

      const newCompleted = new Set([...completedTreeNrs, selectedTreeNr])
      setCompletedTreeNrs(newCompleted)

      // Check if session is complete
      if (newCompleted.size >= session.tree_count) {
        const updatedSession = { ...session, completed_at: new Date().toISOString() }
        await upsertRecord('inspection_sessions', { ...updatedSession, _syncStatus: 'pending' })
        setSession(updatedSession)
        // Reload zone list with updated progress
        await loadZones()
      }

      setSubView('tree_list')

      // Sync immediately if online
      if (navigator.onLine) {
        const token = localStorage.getItem('farmscout_access_token') ?? undefined
        runFullSync(supabaseKey, token).catch(() => {})
      }
    } catch (err) {
      console.error('[TreeScouting] Failed to save tree:', err)
    }
    setSaving(false)
  }

  function handleBackFromInspecting() {
    const hasData = observations.size > 0 || photo || comments
    if (hasData) {
      if (!confirm('Discard unsaved tree data and go back?')) return
    }
    setSubView('tree_list')
  }

  // ── Photo capture ──────────────────────────────────────────────────────────

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 1200
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setPhoto(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  // ── Observation control renderers ─────────────────────────────────────────

  function setObs(pestId: string, value: number) {
    setObservations(prev => new Map(prev).set(pestId, value))
  }

  function renderPresentAbsent(pestId: string, val: number) {
    return (
      <div style={styles.paRow}>
        <button
          style={{ ...styles.paBtn, background: val === 1 ? '#1a5a2a' : '#2a3020', border: `1px solid ${val === 1 ? '#6abf4b' : '#3a4228'}`, color: val === 1 ? '#6abf4b' : '#7a8a5a' }}
          onClick={() => setObs(pestId, val === 1 ? 0 : 1)}
        >
          PRESENT
        </button>
        <button
          style={{ ...styles.paBtn, background: val === 0 && observations.has(pestId) ? '#5a1a1a' : '#2a3020', border: `1px solid ${val === 0 && observations.has(pestId) ? '#e05c4b' : '#3a4228'}`, color: val === 0 && observations.has(pestId) ? '#e05c4b' : '#7a8a5a' }}
          onClick={() => setObs(pestId, observations.has(pestId) && val === 0 ? -1 : 0)}
        >
          ABSENT
        </button>
      </div>
    )
  }

  function renderCount(pestId: string, val: number) {
    return (
      <div style={styles.countRow}>
        <button style={styles.countBtn} onClick={() => setObs(pestId, Math.max(0, val - 1))}>−</button>
        <span style={styles.countVal}>{val}</span>
        <button style={styles.countBtn} onClick={() => setObs(pestId, val + 1)}>+</button>
      </div>
    )
  }

  function renderLeafInspection(pestId: string, val: number) {
    return (
      <div style={styles.leafRow}>
        {[1, 2, 3, 4, 5].map(i => {
          const filled = i <= val
          return (
            <button
              key={i}
              style={{
                ...styles.leafCircle,
                background: filled ? '#f0a500' : '#2a3020',
                border: `2px solid ${filled ? '#f0a500' : '#3a4228'}`,
              }}
              onClick={() => {
                if (filled) {
                  setObs(pestId, i - 1)
                } else {
                  setObs(pestId, i)
                }
              }}
            />
          )
        })}
        <span style={{ fontSize: 13, color: '#7a8a5a', marginLeft: 8 }}>{val}/5</span>
      </div>
    )
  }

  // ── Commodity title ────────────────────────────────────────────────────────

  const commodityLabel = commodityCode === 'POME' ? 'Pomefruit'
    : commodityCode === 'STONE' ? 'Stonefruit'
    : commodityCode === 'CITRUS' ? 'Citrus'
    : 'Tree'

  // ── Sub-view: zone_list ───────────────────────────────────────────────────

  if (subView === 'zone_list') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={onBack}>← Back</button>
          <div style={styles.headerTitle}>{commodityLabel} Scouting</div>
          <div style={{ width: 60 }} />
        </div>

        <div style={styles.body}>
          {loadingZones ? (
            <div style={styles.emptyState}>Loading zones…</div>
          ) : zones.length === 0 ? (
            <div style={styles.emptyState}>
              No zones assigned — please sync while online
            </div>
          ) : (
            zones.map(zone => {
              const pct = zone.tree_count > 0 ? (zone.completed / zone.tree_count) * 100 : 0
              const done = zone.completed >= zone.tree_count
              return (
                <div key={zone.zone_id} style={styles.zoneCard} onClick={() => handleZoneSelect(zone)}>
                  <div style={styles.zoneHeader}>
                    <div>
                      <div style={styles.zoneName}>{zone.zone_name}</div>
                      <div style={styles.zoneSub}>{zone.orchard_name} · {zone.orchard_ha ? `${zone.orchard_ha}ha` : 'unknown ha'}</div>
                    </div>
                    {done && <div style={styles.doneBadge}>✓ Complete</div>}
                  </div>
                  <div style={styles.progressBar}>
                    <div style={{ ...styles.progressFill, width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div style={styles.progressLabel}>{zone.completed}/{zone.tree_count} trees</div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // ── Sub-view: tree_list ───────────────────────────────────────────────────

  if (subView === 'tree_list' && session && selectedZone) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => { setSubView('zone_list'); loadZones() }}>← Back</button>
          <div style={styles.headerTitle}>{selectedZone.zone_name}</div>
          <div style={{ width: 60 }} />
        </div>

        <div style={styles.body}>
          <div style={styles.progressSummary}>
            {completedTreeNrs.size} of {session.tree_count} trees inspected
          </div>

          {pests.length === 0 && (
            <div style={{ ...styles.emptyState, marginBottom: 16 }}>
              ⚠ No pests configured for this commodity. Sync online to update.
            </div>
          )}

          <div style={styles.treeGrid}>
            {Array.from({ length: session.tree_count }, (_, i) => i + 1).map(nr => {
              const done = completedTreeNrs.has(nr)
              return (
                <button
                  key={nr}
                  style={{
                    ...styles.treeBtn,
                    ...(done ? styles.treeBtnDone : {}),
                  }}
                  onClick={() => handleTreeSelect(nr)}
                  disabled={done}
                >
                  {done ? '✓' : nr}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Sub-view: inspecting ──────────────────────────────────────────────────

  if (subView === 'inspecting' && session && selectedZone && selectedTreeNr !== null) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={handleBackFromInspecting}>← Back</button>
          <div style={styles.headerTitle}>Tree {selectedTreeNr} — {selectedZone.zone_name}</div>
          <div style={{ width: 60 }} />
        </div>

        <div style={{ ...styles.body, paddingBottom: 80 }}>

          {pests.length === 0 ? (
            <div style={styles.emptyState}>No pests configured. Sync online first.</div>
          ) : (
            pests.map(pest => {
              const val = observations.get(pest.id) ?? 0
              return (
                <div key={pest.id} style={styles.pestRow}>
                  <div style={styles.pestName}>{pest.display_name}</div>
                  {pest.observation_method === 'present_absent' && renderPresentAbsent(pest.id, val)}
                  {pest.observation_method === 'count' && renderCount(pest.id, val)}
                  {pest.observation_method === 'leaf_inspection' && renderLeafInspection(pest.id, val)}
                </div>
              )
            })
          )}

          {/* GPS indicator */}
          <div style={styles.gpsRow}>
            <span style={{ color: gpsLocation ? '#6abf4b' : '#e05c4b' }}>
              {gpsLocation ? '📍 GPS locked' : '⏳ Acquiring GPS…'}
            </span>
            {gpsLocation && (
              <span style={styles.gpsCoords}>
                {gpsLocation.lat.toFixed(5)}, {gpsLocation.lng.toFixed(5)}
              </span>
            )}
          </div>

          {/* Photo section */}
          <div style={styles.photoSection}>
            <div style={styles.sectionLabel}>Photo (optional)</div>
            {photo ? (
              <div>
                <img src={photo} alt="captured" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
                <button style={styles.cameraBtn} onClick={() => setPhoto(null)}>Remove photo</button>
              </div>
            ) : (
              <button style={styles.cameraBtn} onClick={() => photoInputRef.current?.click()}>
                📷 Take photo
              </button>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
          </div>

          {/* Comments */}
          <div style={styles.photoSection}>
            <div style={styles.sectionLabel}>Comments (optional)</div>
            <textarea
              style={styles.commentsArea}
              placeholder="Add any notes about this tree…"
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
            />
          </div>

        </div>

        {/* Footer save button */}
        <div style={styles.footer}>
          <button
            style={{ ...styles.saveBtn, opacity: saving ? 0.5 : 1 }}
            onClick={handleSaveTree}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Tree'}
          </button>
        </div>
      </div>
    )
  }

  // Fallback while loading
  return <div style={styles.container}><div style={styles.emptyState}>Loading…</div></div>
}

const styles: Record<string, React.CSSProperties> = {
  container: {
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
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e8e8d8',
    textAlign: 'center',
    flex: 1,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#f0a500',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 0',
    width: 60,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
  },
  emptyState: {
    color: '#7a8a5a',
    fontSize: 14,
    textAlign: 'center',
    padding: '40px 24px',
  },
  // Zone list
  zoneCard: {
    background: '#222918',
    border: '1px solid #3a4228',
    borderRadius: 12,
    padding: '16px',
    marginBottom: 12,
    cursor: 'pointer',
  },
  zoneHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e8e8d8',
  },
  zoneSub: {
    fontSize: 12,
    color: '#7a8a5a',
    marginTop: 2,
  },
  doneBadge: {
    background: '#1a3a1a',
    border: '1px solid #6abf4b',
    borderRadius: 100,
    color: '#6abf4b',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
  },
  progressBar: {
    height: 6,
    background: '#2a3020',
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    background: '#f0a500',
    borderRadius: 100,
    transition: 'width 0.3s',
  },
  progressLabel: {
    fontSize: 11,
    color: '#7a8a5a',
    textAlign: 'right',
  },
  // Tree list
  progressSummary: {
    fontSize: 13,
    color: '#7a8a5a',
    marginBottom: 16,
  },
  treeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
    gap: 8,
  },
  treeBtn: {
    background: '#222918',
    border: '2px solid #f0a500',
    borderRadius: 8,
    color: '#e8e8d8',
    fontSize: 14,
    fontWeight: 600,
    padding: '14px 0',
    cursor: 'pointer',
    textAlign: 'center',
  },
  treeBtnDone: {
    background: '#1a3a1a',
    border: '2px solid #6abf4b',
    color: '#6abf4b',
    cursor: 'default',
  },
  // Inspection form
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#7a8a5a',
    marginBottom: 8,
  },
  pestRow: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottom: '1px solid #2a3020',
  },
  pestName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e8e8d8',
    marginBottom: 10,
  },
  // Present/Absent
  paRow: {
    display: 'flex',
    gap: 8,
  },
  paBtn: {
    flex: 1,
    padding: '12px 0',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },
  // Count
  countRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  countBtn: {
    background: '#2a3020',
    border: '1px solid #3a4228',
    borderRadius: 8,
    color: '#e8e8d8',
    fontSize: 22,
    fontWeight: 700,
    width: 48,
    height: 48,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countVal: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f0a500',
    minWidth: 40,
    textAlign: 'center',
  },
  // Leaf inspection
  leafRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  leafCircle: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    cursor: 'pointer',
  },
  gpsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 12,
    padding: '10px 0',
    borderBottom: '1px solid #2a3020',
    marginBottom: 20,
  },
  gpsCoords: {
    fontSize: 11,
    color: '#7a8a5a',
    fontFamily: 'monospace',
  },
  // Photo & comments
  photoSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTop: '1px solid #2a3020',
  },
  cameraBtn: {
    background: '#2a3020',
    border: '1px solid #3a4228',
    borderRadius: 8,
    color: '#e8e8d8',
    fontSize: 14,
    fontWeight: 600,
    padding: '12px 20px',
    cursor: 'pointer',
    width: '100%',
  },
  commentsArea: {
    width: '100%',
    background: '#2a3020',
    border: '1px solid #3a4228',
    borderRadius: 8,
    color: '#e8e8d8',
    fontSize: 14,
    padding: '10px 12px',
    resize: 'none',
    fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 16px',
    background: '#222918',
    borderTop: '1px solid #3a4228',
  },
  saveBtn: {
    width: '100%',
    background: '#f0a500',
    border: 'none',
    borderRadius: 8,
    color: '#000',
    fontSize: 16,
    fontWeight: 700,
    padding: '16px 0',
    cursor: 'pointer',
  },
}

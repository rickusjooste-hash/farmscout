'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import jsQR from 'jsqr'
import {
  qcGetAll,
  qcGet,
  qcPut,
  qcGetPendingQueue,
  type QcEmployee,
  type QcOrchard,
  type QcSizeBin,
  type QcIssue,
  type QcBagSession,
  type QcFruit,
} from '@/lib/qc-db'
import {
  qcSaveAndQueue,
  qcPushPendingRecords,
  countTodaySampled,
  getPendingBagSessions,
  qcRunFullSync,
  qcClearSyncQueue,
} from '@/lib/qc-sync'
import { beep, relTime, findSizeBin, generateUUID } from '@/lib/qc-utils'

type QcView = 'home' | 'queue' | 'commodity_select' | 'weighing' | 'issues'
type Lang = 'en' | 'af'

const SCALE_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb'
const WEIGHT_CHAR   = '0000fff1-0000-1000-8000-00805f9b34fb'

export default function QcHome() {
  const [view, setView] = useState<QcView>('home')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  const [orchards, setOrchards] = useState<QcOrchard[]>([])
  const [sizeBins, setSizeBins] = useState<QcSizeBin[]>([])
  const [qcIssues, setQcIssues] = useState<QcIssue[]>([])

  const [todaySampled, setTodaySampled] = useState(0)
  const [pendingSessions, setPendingSessions] = useState<QcBagSession[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  // QC state
  const [activeSession, setActiveSession] = useState<QcBagSession | null>(null)
  const [pendingCommodityUuid, setPendingCommodityUuid] = useState<string | null>(null)
  const [fruit, setFruit] = useState<QcFruit[]>([])
  const [currentWeight, setCurrentWeight] = useState<number | null>(null)
  const [currentBin, setCurrentBin] = useState<QcSizeBin | null>(null)
  const [savingSession, setSavingSession] = useState(false)
  const [keypadInput, setKeypadInput] = useState('')
  const [showWeightConfirm, setShowWeightConfirm] = useState(false)
  const [confirmingWeight, setConfirmingWeight] = useState(0)
  const [confirmingBin, setConfirmingBin] = useState<QcSizeBin | null>(null)
  const [addedFlash, setAddedFlash] = useState<string | null>(null)
  const [bagIssues, setBagIssues] = useState<Record<string, number>>({})

  // Unknown issue — requires photo before saving
  const [unknownPhoto, setUnknownPhoto] = useState<string | null>(null)
  const unknownFileInputRef = useRef<HTMLInputElement>(null)

  // Language preference
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('qcapp_language') as Lang) || 'en'
    }
    return 'en'
  })

  function toggleLang() {
    setLang(prev => {
      const next = prev === 'en' ? 'af' : 'en'
      localStorage.setItem('qcapp_language', next)
      return next
    })
  }

  function issueName(issue: QcIssue): string {
    if (lang === 'af' && issue.display_name_af) return issue.display_name_af
    return issue.display_name
  }

  // BLE scale
  const bleCharRef = useRef<any>(null)
  const [bleConnected, setBleConnected] = useState(false)
  const weightBuffer = useRef<number[]>([])
  const confirmDismissedAt = useRef(0)
  const sessionBinsRef = useRef<QcSizeBin[]>([])

  // Camera scanner
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scanning, setScanning] = useState(false)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingStreamRef = useRef<MediaStream | null>(null)

  // Supabase Realtime
  const rtClientRef = useRef<any>(null)
  const rtChannelRef = useRef<any>(null)

  // Attach stream to video element once it mounts
  useEffect(() => {
    if (pendingStreamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = pendingStreamRef.current
      videoRef.current.play().catch(() => {})
      pendingStreamRef.current = null
    }
  }, [scanning])

  // Unique commodities from orchards (for offline commodity picker)
  const availableCommodities = useCallback(() => {
    const seen = new Set<string>()
    return orchards
      .filter(o => { if (seen.has(o.commodity_id)) return false; seen.add(o.commodity_id); return true })
      .map(o => ({ id: o.commodity_id, name: o.commodity_name || o.commodity_id.slice(0, 8) }))
  }, [orchards])

  // ── Auth + load ────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('qcapp_access_token')
    if (!token) { window.location.href = '/qc/login'; return }
    setIsLoggedIn(true)
    loadData()
    loadPendingCount()
    window.addEventListener('online', handleSync)
    const pollInterval = setInterval(() => handleSync(), 300000)

    // ── Supabase Realtime: instant bag arrival notifications ──────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    if (supabaseUrl && anonKey) {
      const farmIds: string[] = (() => { try { return JSON.parse(localStorage.getItem('qcapp_farm_ids') || '[]') } catch { return [] } })()
      const runnerIds: string[] = (() => { try { return JSON.parse(localStorage.getItem('qcapp_assigned_runner_ids') || '[]') } catch { return [] } })()

      const rtClient = createSupabaseClient(supabaseUrl, anonKey, {
        realtime: { params: { eventsPerSecond: 10 } },
      })
      rtClient.realtime.setAuth(token)
      rtClientRef.current = rtClient

      const channel = rtClient
        .channel('qc-bag-queue')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'qc_bag_sessions',
        }, async (payload: any) => {
          const bag = payload.new
          if (!bag || bag.status !== 'collected') return

          // Filter by runner assignment (most important!)
          if (runnerIds.length > 0) {
            if (!runnerIds.includes(bag.runner_id)) return
          } else if (farmIds.length > 0) {
            if (!farmIds.includes(bag.farm_id)) return
          }

          // Enrich with display names from IndexedDB
          const [employees, orchards_] = await Promise.all([qcGetAll('employees'), qcGetAll('orchards')])
          const empName = employees.find((e: any) => e.id === bag.employee_id)?.full_name || 'Unknown picker'
          const orchName = orchards_.find((o: any) => o.id === bag.orchard_id)?.name || 'Unknown orchard'

          const enrichedBag: QcBagSession = {
            ...bag,
            _syncStatus: 'synced' as const,
            _employee_name: empName,
            _orchard_name: orchName,
          }

          // Save to IndexedDB + update state (avoid duplicates)
          await qcPut('bag_sessions', enrichedBag)
          setPendingSessions(prev => {
            if (prev.some(s => s.id === bag.id)) return prev
            return [enrichedBag, ...prev]  // newest first
          })
          console.log(`[QC Realtime] New bag #${bag.bag_seq} from runner ${bag.runner_id}`)
        })
        .subscribe((status: string) => {
          console.log(`[QC Realtime] Channel status: ${status}`)
        })
      rtChannelRef.current = channel
    }

    return () => {
      window.removeEventListener('online', handleSync)
      clearInterval(pollInterval)
      rtChannelRef.current?.unsubscribe()
      rtClientRef.current?.removeAllChannels()
    }
  }, [])

  async function handleSync() {
    setSyncStatus('Syncing...')
    try {
      await qcRunFullSync(localStorage.getItem('qcapp_access_token') || undefined)
      await loadData(false)
      await loadPendingCount()
      const bags = await getPendingBagSessions()
      const farmIds = JSON.parse(localStorage.getItem('qcapp_farm_ids') || '[]')
      const runnerIds = JSON.parse(localStorage.getItem('qcapp_assigned_runner_ids') || '[]')
      const scopeLabel = runnerIds.length > 0
        ? `${runnerIds.length} runner${runnerIds.length > 1 ? 's' : ''}`
        : `${farmIds.length} farm${farmIds.length > 1 ? 's' : ''}`
      setSyncStatus(`Synced OK · ${bags.length} bags · ${scopeLabel}`)
    } catch (err: any) {
      setSyncStatus(`Sync failed: ${err.message}`)
    }
    setTimeout(() => setSyncStatus(null), 5000)
  }

  async function loadPendingCount() {
    try {
      const queue = await qcGetPendingQueue()
      setPendingCount(queue.length)
    } catch { setPendingCount(0) }
  }

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      const [orchs, bins, issues] = await Promise.all([
        qcGetAll('orchards'), qcGetAll('size_bins'), qcGetAll('qc_issues'),
      ])
      setOrchards(orchs); setSizeBins(bins); setQcIssues(issues)
      const [sampled, pending] = await Promise.all([countTodaySampled(), getPendingBagSessions()])
      setTodaySampled(sampled); setPendingSessions(pending)
    } finally { if (showLoading) setLoading(false) }
  }

  // ── QC worker ─────────────────────────────────────────────────────────────

  function startQcFlow() {
    setView('queue'); setActiveSession(null); setFruit([])
    setCurrentWeight(null); setCurrentBin(null); setBagIssues({})
    setUnknownPhoto(null)
  }

  function openSession(session: QcBagSession) {
    setActiveSession(session); setFruit([])
    setCurrentWeight(null); setCurrentBin(null); setKeypadInput('')
    setShowWeightConfirm(false); setBagIssues({})
    setUnknownPhoto(null)
    setView('weighing'); stopScanner()
  }

  async function handleQrScan(raw: string) {
    stopScanner()
    let uuid: string
    try { const d = JSON.parse(raw); uuid = d.id || raw.trim() } catch { uuid = raw.trim() }
    const existing = await qcGet('bag_sessions', uuid)
    if (existing) {
      if (existing.status === 'sampled') {
        alert(`Bag #${existing.bag_seq} (${existing._employee_name}) has already been sampled.`)
        return
      }
      openSession(existing)
    } else {
      setPendingCommodityUuid(uuid)
      setView('commodity_select')
    }
  }

  function selectCommodity(commodityId: string, commodityName: string) {
    if (!pendingCommodityUuid) return
    const orgId = localStorage.getItem('qcapp_org_id') || ''
    const farmId = localStorage.getItem('qcapp_farm_id') || ''
    const matchOrchard = orchards.find(o => o.commodity_id === commodityId)
    openSession({
      id: pendingCommodityUuid,
      organisation_id: orgId,
      farm_id: farmId,
      orchard_id: matchOrchard?.id || '',
      employee_id: '',
      status: 'collected',
      _orchard_name: `${commodityName} (runner syncing...)`,
      _employee_name: 'Runner syncing...',
    })
    setPendingCommodityUuid(null)
  }

  async function startScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      pendingStreamRef.current = stream
      setScanning(true)
      scanIntervalRef.current = setInterval(() => {
        const video = videoRef.current; const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) return
        const ctx = canvas.getContext('2d'); if (!ctx) return
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) { beep(); handleQrScan(code.data.trim()) }
      }, 300)
    } catch { alert('Could not access camera.') }
  }

  function stopScanner() {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null }
    const stream = (videoRef.current?.srcObject as MediaStream | null) || pendingStreamRef.current
    stream?.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    pendingStreamRef.current = null
    setScanning(false)
  }

  async function connectScale() {
    try {
      const device = await (navigator as any).bluetooth.requestDevice({ filters: [{ namePrefix: 'Reflex' }], optionalServices: [SCALE_SERVICE] })
      const server = await device.gatt!.connect()
      const char = await (await server.getPrimaryService(SCALE_SERVICE)).getCharacteristic(WEIGHT_CHAR)
      await char.startNotifications()
      char.addEventListener('characteristicvaluechanged', handleWeightNotification)
      bleCharRef.current = char; setBleConnected(true)
    } catch (err: any) { alert(`Could not connect to scale: ${err.message}`) }
  }

  function handleWeightNotification(event: Event) {
    const rawG = ((event.target as any).value as DataView).getUint16(0, true)
    if (rawG <= 0) return
    if (Date.now() - confirmDismissedAt.current < 1000) return
    weightBuffer.current = [...weightBuffer.current.slice(-4), rawG]
    const buf = weightBuffer.current
    if (buf.length >= 3 && Math.max(...buf) - Math.min(...buf) <= 2) {
      setConfirmingWeight(rawG); setConfirmingBin(findSizeBin(rawG, sessionBinsRef.current))
      setShowWeightConfirm(true); weightBuffer.current = []
    }
  }

  function keypadPress(key: string, bins: QcSizeBin[]) {
    if (key === '⌫') {
      setKeypadInput(prev => prev.slice(0, -1))
    } else if (key === '✓') {
      const w = parseInt(keypadInput)
      if (w > 0) { setConfirmingWeight(w); setConfirmingBin(findSizeBin(w, bins)); setShowWeightConfirm(true) }
    } else {
      setKeypadInput(prev => prev.length < 4 ? prev + key : prev)
    }
  }

  function confirmWeightOK() {
    try {
      const orgId = localStorage.getItem('qcapp_org_id') || ''
      if (activeSession) {
        const id = generateUUID()
        const newFruit: QcFruit = {
          id, session_id: activeSession.id, organisation_id: orgId,
          seq: fruit.length + 1, weight_g: confirmingWeight, size_bin_id: confirmingBin?.id ?? null,
        }
        setFruit(prev => [...prev, newFruit])
        setKeypadInput(''); weightBuffer.current = []
        beep()
        setAddedFlash('✓')
        setTimeout(() => setAddedFlash(null), 500)
      }
    } catch {
    } finally {
      confirmDismissedAt.current = Date.now()
      setShowWeightConfirm(false)
    }
  }

  function confirmWeightReenter() {
    confirmDismissedAt.current = Date.now()
    setKeypadInput(''); setShowWeightConfirm(false)
  }

  function isUnknownPest(pestId: string): boolean {
    const issue = qcIssues.find(i => i.pest_id === pestId)
    if (!issue) return false
    return issue.display_name.toLowerCase() === 'unknown' ||
      (issue.display_name_af?.toLowerCase() ?? '') === 'onbekend'
  }

  function adjustIssueCount(pestId: string, delta: number) {
    const next = Math.max(0, (bagIssues[pestId] || 0) + delta)
    setBagIssues(prev => ({ ...prev, [pestId]: next }))
    if (isUnknownPest(pestId) && next > 0 && !unknownPhoto) {
      openUnknownCamera()
    }
    if (isUnknownPest(pestId) && next === 0) {
      setUnknownPhoto(null)
    }
  }

  function openUnknownCamera() {
    unknownFileInputRef.current?.click()
  }

  function retakeUnknownPhoto() {
    setUnknownPhoto(null)
    setTimeout(() => unknownFileInputRef.current?.click(), 50)
  }

  function handleUnknownFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const maxDim = 1600
      let w = img.naturalWidth, h = img.naturalHeight
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
        else { w = Math.round(w * maxDim / h); h = maxDim }
      }
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(objectUrl)
      setUnknownPhoto(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      const reader = new FileReader()
      reader.onload = ev => setUnknownPhoto(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
    img.src = objectUrl
  }

  async function saveCompletedSample() {
    if (!activeSession || fruit.length === 0) return
    setSavingSession(true)
    try {
      const orgId = localStorage.getItem('qcapp_org_id') || ''
      const workerId = localStorage.getItem('qcapp_worker_id') || ''
      const now = new Date().toISOString()
      await qcSaveAndQueue('bag_sessions', { ...activeSession, qc_worker_id: workerId, sampled_at: now, status: 'sampled' })
      for (const f of fruit) await qcSaveAndQueue('bag_fruit', f)
      for (const [pestId, count] of Object.entries(bagIssues)) {
        if (count > 0)
          await qcSaveAndQueue('bag_issues', {
            id: generateUUID(),
            session_id: activeSession.id,
            pest_id: pestId,
            organisation_id: orgId,
            count,
            ...(isUnknownPest(pestId) && unknownPhoto ? { _photo: unknownPhoto } : {}),
          })
      }
      // Return to queue immediately — push happens in background
      setActiveSession(null); setFruit([]); setBagIssues({}); setUnknownPhoto(null)
      setView('queue')
      await loadData()
      // Push to server in background (don't block the UI)
      qcPushPendingRecords().catch(err => console.warn('[QC] Background push failed:', err))
    } finally { setSavingSession(false) }
  }

  const sessionBins = useCallback(() => {
    if (!activeSession) return []
    const orchard = orchards.find(o => o.id === activeSession.orchard_id)
    if (!orchard) return []
    return sizeBins.filter(b => b.commodity_id === orchard.commodity_id).sort((a, b) => a.display_order - b.display_order)
  }, [activeSession, orchards, sizeBins])

  // Keep ref in sync so the BLE handler (stale closure) always uses commodity-filtered bins
  useEffect(() => { sessionBinsRef.current = sessionBins() }, [sessionBins])

  const sessionQcIssues = useCallback(() => {
    if (!activeSession) return []
    const orchard = orchards.find(o => o.id === activeSession.orchard_id)
    if (!orchard) return []
    return qcIssues.filter(i => i.commodity_id === orchard.commodity_id).sort((a, b) => a.display_order - b.display_order)
  }, [activeSession, orchards, qcIssues])

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (!isLoggedIn || loading) {
    return <div style={s.centered}><div style={{ fontSize: 40 }}>⏳</div><div style={{ color: '#7cbe4a', marginTop: 12 }}>Loading...</div></div>
  }

  // HOME
  if (view === 'home') {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerTitle}>🍎 Orchard QC</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {pendingCount > 0 && (
              <div style={s.pendingBadge} onClick={async () => {
                if (pendingCount > 500 && confirm(`Clear ${pendingCount} stuck queue entries?\nOnly entries retried 3+ times will be removed.\nFresh unsynced records are kept.`)) {
                  const { cleared, kept } = await qcClearSyncQueue()
                  await loadPendingCount()
                  setSyncStatus(`Cleared ${cleared} stale · ${kept} fresh kept`)
                  setTimeout(() => setSyncStatus(null), 5000)
                } else {
                  handleSync()
                }
              }}>{pendingCount} pending</div>
            )}
            <button style={s.langBtn} onClick={toggleLang} title="Switch language / Verander taal">
              {lang === 'en' ? 'AF' : 'EN'}
            </button>
            <button style={s.syncBtn} onClick={handleSync}>↻ Sync</button>
          </div>
        </div>
        <div style={s.homeCards}>
          <button style={{ ...s.homeCard, ...s.homeCardQc }} onClick={startQcFlow}>
            <div style={s.cardIcon}>⚖️</div>
            <div style={s.cardLabel}>Start Bag Sample</div>
            <div style={s.cardSub}>
              {pendingSessions.length > 0
                ? `${pendingSessions.length} bag${pendingSessions.length > 1 ? 's' : ''} waiting · ${todaySampled} sampled today`
                : todaySampled > 0 ? `${todaySampled} sampled today` : 'No pending bags'}
            </div>
          </button>
        </div>
        {syncStatus && (
          <div style={{ margin: '0 20px', padding: '10px 14px', background: syncStatus.includes('failed') ? '#3a1a1a' : '#1a2e1a', border: `1px solid ${syncStatus.includes('failed') ? '#e05c4b' : '#2e5a2e'}`, borderRadius: 8, fontSize: 13, color: syncStatus.includes('failed') ? '#e05c4b' : '#7aaa6a', textAlign: 'center' as const }}>
            {syncStatus}
          </div>
        )}
        <div style={s.logoutRow}>
          <button style={s.logoutBtn} onClick={() => { localStorage.clear(); window.location.href = '/qc/login' }}>Sign out</button>
        </div>
      </div>
    )
  }

  // QUEUE
  if (view === 'queue') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => { stopScanner(); setView('home') }}>← Back</button>
          <div style={s.topTitle}>Bag Queue</div>
        </div>
        <div style={s.scanSection}>
          {!scanning ? (
            <button style={s.scanBtn} onClick={startScanner}>
              <span style={{ fontSize: 48, display: 'block', marginBottom: 10 }}>📷</span>
              Scan Bag QR
            </button>
          ) : (
            <div style={s.scannerContainer}>
              <video ref={videoRef} style={s.scannerVideo} playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div style={s.scannerOverlay}>Align QR code in frame...</div>
              <button style={s.cancelScanBtn} onClick={stopScanner}>Cancel</button>
            </div>
          )}
        </div>
        {pendingSessions.length > 0 && (
          <div style={s.queueSection}>
            <div style={s.queueSectionLabel}>Bags waiting ({pendingSessions.length})</div>
            {pendingSessions.map(session => (
              <button key={session.id} style={s.sessionRow} onClick={() => openSession(session)}>
                <div style={s.sessionLeft}>
                  <div style={s.sessionBagNum}>Bag #{session.bag_seq ?? '?'}</div>
                  <div style={s.sessionPicker}>{session._employee_name || 'Unknown picker'}</div>
                  <div style={s.sessionOrchard}>{session._orchard_name || 'Unknown orchard'}</div>
                </div>
                <div style={s.sessionRight}>
                  <div style={s.sessionTime}>{session.collected_at ? relTime(session.collected_at) : ''}</div>
                  <div style={s.sessionArrow}>›</div>
                </div>
              </button>
            ))}
          </div>
        )}
        {pendingSessions.length === 0 && !scanning && (
          <div style={s.emptyState}>No bags waiting. Scan a QR label to start.</div>
        )}
      </div>
    )
  }

  // COMMODITY SELECT — runner not synced yet
  if (view === 'commodity_select') {
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => setView('queue')}>← Back</button>
          <div style={s.topTitle}>Select Commodity</div>
        </div>
        <div style={{ padding: '16px 20px 8px', color: '#7aaa6a', fontSize: 14 }}>
          Runner data not yet synced. Select the commodity to load the correct size bins and issues.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 20px' }}>
          {availableCommodities().map(c => (
            <button key={c.id} style={s.primaryBtn} onClick={() => selectCommodity(c.id, c.name)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // WEIGHING
  if (view === 'weighing') {
    const bins = sessionBins()
    const liveWeight = keypadInput ? parseInt(keypadInput) : null
    const liveBin = liveWeight ? findSizeBin(liveWeight, bins) : null
    const displayWeight = keypadInput ? keypadInput + ' g' : '—'
    const binLabel = keypadInput
      ? (liveBin ? liveBin.label : liveWeight && liveWeight > 0 ? 'No bin match' : '')
      : ''
    const histoBins = fruit.reduce((acc, f) => {
      const label = f.size_bin_id ? (bins.find(b => b.id === f.size_bin_id)?.label ?? '?') : 'No bin'
      acc[label] = (acc[label] || 0) + 1; return acc
    }, {} as Record<string, number>)

    return (
      <div style={{ ...s.page, overflowY: 'hidden' }}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => {
            if (fruit.length > 0 && !confirm(`Discard ${fruit.length} fruit weighed? This cannot be undone.`)) return
            setView('queue'); setActiveSession(null); setFruit([])
          }}>← Queue</button>
          <div style={s.topTitle}>Fruit Weighing</div>
          {fruit.length > 0 && (
            <button style={s.doneSmallBtn} onClick={() => setView('issues')}>
              {fruit.length} fruit — Done →
            </button>
          )}
        </div>

        <div style={{
          ...s.weightSection,
          ...(addedFlash ? { background: '#224a22', borderRadius: 16, margin: '0 12px' } : {}),
        }}>
          <div style={{
            ...s.weightDisplay,
            color: addedFlash ? '#7cbe4a' : (showWeightConfirm ? '#7cbe4a' : (keypadInput ? '#e8f0e0' : '#3a5a3a')),
            fontSize: showWeightConfirm ? 80 : 64,
          }}>
            {showWeightConfirm ? `${confirmingWeight} g` : displayWeight}
          </div>
          <div style={{ ...s.binLabel, color: addedFlash ? '#7cbe4a' : undefined }}>
            {addedFlash
              ? `Fruit #${fruit.length} added`
              : showWeightConfirm
                ? (confirmingBin?.label ?? 'No bin match')
                : (binLabel || (bleConnected ? 'Place on scale…' : 'Enter weight'))
            }
          </div>
        </div>

        {fruit.length > 0 && (
          <div style={s.histoPills}>
            {Object.entries(histoBins).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
              <div key={label} style={s.histoPill}>
                <span style={s.histoPillLabel}>{label}</span>
                <span style={s.histoPillCount}>{count}</span>
              </div>
            ))}
          </div>
        )}

        <div style={s.keypad}>
          {['1','2','3','4','5','6','7','8','9','⌫','0','✓'].map(key => {
            const confirming = showWeightConfirm
            const isConfirm = key === '✓'
            const isBack = key === '⌫'

            let label: string = key
            let handler: () => void = () => keypadPress(key, bins)
            let disabled = false
            let style: React.CSSProperties = { ...s.keypadKey }

            if (confirming) {
              if (isConfirm) {
                label = 'OK ✓'
                handler = confirmWeightOK
                style = { ...style, ...s.keypadKeyConfirm, fontSize: 24 }
              } else if (isBack) {
                label = '↩'
                handler = confirmWeightReenter
                style = { ...style, ...s.keypadKeyBack }
              } else {
                disabled = true
                style = { ...style, opacity: 0.15 }
              }
            } else {
              if (isConfirm) {
                style = { ...style, ...s.keypadKeyConfirm, opacity: keypadInput ? 1 : 0.35 }
                disabled = !keypadInput
              } else if (isBack) {
                style = { ...style, ...s.keypadKeyBack }
              }
            }

            return (
              <button key={key} style={style} disabled={disabled} onClick={handler}>
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ padding: '4px 12px 0', textAlign: 'center' as const }}>
          <span style={{ fontSize: 13, color: '#7aaa6a', fontWeight: 600 }}>Bag #{activeSession?.bag_seq ?? '?'}</span>
          <span style={{ fontSize: 13, color: '#4a6a4a' }}> · {activeSession?._orchard_name} · {activeSession?._employee_name}</span>
        </div>

        <div style={{ padding: '4px 12px 8px' }}>
          <button
            style={{ ...s.outlineBtn, fontSize: 13, padding: '9px', borderColor: bleConnected ? '#7cbe4a' : '#2e4a2e' }}
            onClick={bleConnected ? undefined : connectScale}
          >
            {bleConnected ? '🔵 Scale connected — stable reads auto-capture' : '🔌 Connect Bluetooth Scale'}
          </button>
        </div>
      </div>
    )
  }

  // ISSUES
  if (view === 'issues') {
    const issues = sessionQcIssues()
    const bins = sessionBins()
    const totalIssues = Object.values(bagIssues).reduce((a, b) => a + b, 0)
    const nonPickerTotal = issues
      .filter(i => i.category !== 'picking_issue')
      .reduce((sum, i) => sum + (bagIssues[i.pest_id] || 0), 0)
    const issueError = nonPickerTotal > fruit.length
    const unknownCount = issues
      .filter(i => i.display_name.toLowerCase() === 'unknown' || (i.display_name_af?.toLowerCase() ?? '') === 'onbekend')
      .reduce((sum, i) => sum + (bagIssues[i.pest_id] || 0), 0)
    const needsUnknownPhoto = unknownCount > 0 && !unknownPhoto
    const avgWeight = fruit.length ? Math.round(fruit.reduce((a, f) => a + f.weight_g, 0) / fruit.length) : 0

    const renderIssueRow = (issue: typeof issues[0]) => {
      const count = bagIssues[issue.pest_id] || 0
      const isUnknown = issue.display_name.toLowerCase() === 'unknown' ||
        (issue.display_name_af?.toLowerCase() ?? '') === 'onbekend'
      return (
        <div key={issue.id}>
          <div style={s.issueCountRow}>
            <div style={s.issueCountName}>{issueName(issue)}</div>
            <div style={s.issueCounter}>
              <button style={s.issueCounterBtn} onClick={() => adjustIssueCount(issue.pest_id, -1)}>−</button>
              <div style={{ ...s.issueCounterVal, color: count > 0 ? '#7cbe4a' : '#3a5a3a' }}>{count}</div>
              <button style={s.issueCounterBtn} onClick={() => adjustIssueCount(issue.pest_id, 1)}>+</button>
            </div>
          </div>
          {isUnknown && count > 0 && (
            unknownPhoto ? (
              <div style={s.unknownPhotoRow}>
                <img src={unknownPhoto} style={s.unknownThumb} alt="Unknown issue" />
                <button style={s.unknownRetakeBtn} onClick={retakeUnknownPhoto}>📷 Retake</button>
              </div>
            ) : (
              <button style={s.unknownPhotoRequired} onClick={openUnknownCamera}>
                📷 Photo required — tap to capture
              </button>
            )
          )}
        </div>
      )
    }

    return (
      <>
      <input
        ref={unknownFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleUnknownFileChange}
      />
      <div style={s.page}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => setView('weighing')}>← Weighing</button>
          <div style={s.topTitle}>Issues</div>
        </div>

        <div style={{ padding: '8px 16px 4px', fontSize: 11, color: '#4a7a4a', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
          {fruit.length} fruit · avg {avgWeight}g
        </div>

        <div style={{ height: 1, background: '#1e3a1e', margin: '4px 0 0' }} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>
          {issues.length === 0 && (
            <div style={{ color: '#4a7a4a', fontSize: 14, textAlign: 'center', padding: '28px 0' }}>
              No QC issues configured for this commodity.
            </div>
          )}

          {issues.filter(i => i.category === 'picking_issue').length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f5c842', textTransform: 'uppercase' as const, letterSpacing: '0.08em', padding: '10px 0 4px' }}>
                Picker Issues
              </div>
              {issues.filter(i => i.category === 'picking_issue').map(issue => renderIssueRow(issue))}
              <div style={{ height: 1, background: '#1e3a1e', margin: '8px 0' }} />
            </>
          )}

          {issues.filter(i => i.category !== 'picking_issue').length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e85a4a', textTransform: 'uppercase' as const, letterSpacing: '0.08em', padding: '4px 0' }}>
                Quality Issues
              </div>
              {issues.filter(i => i.category !== 'picking_issue').map(issue => renderIssueRow(issue))}
            </>
          )}
        </div>

        {issueError && (
          <div style={{ margin: '8px 16px', padding: '10px 14px', background: '#2a0e0e', border: '1px solid #7a2a2a', borderRadius: 8, color: '#f08080', fontSize: 13 }}>
            ⚠️ Non-picker issues ({nonPickerTotal}) cannot exceed fruit weighed ({fruit.length})
          </div>
        )}

        <div style={{ padding: '8px 16px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#7aaa6a', textAlign: 'center' as const }}>
            {totalIssues > 0
              ? `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} on ${fruit.length} fruit`
              : `No issues on ${fruit.length} fruit`}
          </div>
          {needsUnknownPhoto && (
            <div style={{ padding: '6px 0 2px', fontSize: 13, color: '#f0b040', textAlign: 'center' as const }}>
              ⚠️ {lang === 'af' ? 'Neem foto van onbekende probleem' : 'Take a photo of the unknown issue first'}
            </div>
          )}
          <button
            style={{ ...s.primaryBtn, opacity: issueError || savingSession || needsUnknownPhoto ? 0.4 : 1, marginBottom: 0 }}
            onClick={saveCompletedSample}
            disabled={issueError || savingSession || needsUnknownPhoto}
          >
            {savingSession ? 'Saving...' : 'Save & Done'}
          </button>
        </div>
      </div>
      </>
    )
  }

  return null
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#1a2e1a', color: '#e8f0e0', fontFamily: 'system-ui, sans-serif', overflowY: 'auto' },
  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#1a2e1a', color: '#e8f0e0', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px', borderBottom: '1px solid #2e5a2e' },
  headerTitle: { fontSize: 22, fontWeight: 700, color: '#7cbe4a' },
  syncBtn: { background: 'none', border: '1px solid #3a5a3a', borderRadius: 6, color: '#7cbe4a', padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
  langBtn: { background: '#1e3a1e', border: '1px solid #3a5a3a', borderRadius: 6, color: '#7aaa6a', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' },
  topBar: { display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12, borderBottom: '1px solid #2e5a2e' },
  backBtn: { background: 'none', border: 'none', color: '#7cbe4a', fontSize: 15, cursor: 'pointer', padding: 0, flexShrink: 0 },
  topTitle: { fontSize: 17, fontWeight: 600, color: '#e8f0e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  homeCards: { display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 20px' },
  homeCard: { background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 12, padding: '28px 24px', textAlign: 'left', cursor: 'pointer', color: '#e8f0e0', display: 'flex', flexDirection: 'column', gap: 6 },
  homeCardQc: { borderColor: '#4a7a4a' },
  cardIcon: { fontSize: 36, marginBottom: 4 },
  cardLabel: { fontSize: 20, fontWeight: 700 },
  cardSub: { fontSize: 13, color: '#7aaa6a' },
  logoutRow: { padding: '0 20px 24px', marginTop: 'auto' },
  logoutBtn: { background: 'none', border: '1px solid #2e4a2e', borderRadius: 6, color: '#4a7a4a', padding: '10px 20px', fontSize: 13, cursor: 'pointer', width: '100%' },
  pendingBadge: { background: '#f0a500', color: '#000', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 100, cursor: 'pointer' },
  scanSection: { padding: '20px' },
  scanBtn: { width: 180, height: 180, background: '#4a9e2a', color: '#e8f0e0', fontSize: 16, fontWeight: 700, border: 'none', borderRadius: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', margin: '8px auto' },
  scannerContainer: { position: 'relative' as const, borderRadius: 8, overflow: 'hidden' },
  scannerVideo: { width: '100%', height: 260, objectFit: 'cover' as const, display: 'block' },
  scannerOverlay: { position: 'absolute' as const, bottom: 40, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 13, textShadow: '0 1px 3px #000' },
  cancelScanBtn: { position: 'absolute' as const, bottom: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, color: '#fff', padding: '8px 20px', cursor: 'pointer', fontSize: 13 },
  queueSection: { padding: '0 20px 16px' },
  queueSectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#4a7a4a', marginBottom: 8 },
  sessionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 8, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', textAlign: 'left', width: '100%' },
  sessionLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
  sessionBagNum: { fontSize: 16, fontWeight: 700, color: '#7cbe4a' },
  sessionPicker: { fontSize: 14, color: '#e8f0e0' },
  sessionOrchard: { fontSize: 12, color: '#7aaa6a' },
  sessionRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  sessionTime: { fontSize: 12, color: '#4a7a4a' },
  sessionArrow: { fontSize: 20, color: '#7cbe4a' },
  weightSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 20px 8px', gap: 4 },
  weightDisplay: { fontSize: 64, fontWeight: 900, lineHeight: 1 },
  binLabel: { fontSize: 20, color: '#7aaa6a', fontWeight: 600, minHeight: 28 },
  histoPills: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, padding: '4px 12px 8px' },
  histoPill: { display: 'flex', alignItems: 'center', gap: 5, background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 20, padding: '4px 10px' },
  histoPillLabel: { fontSize: 12, color: '#7aaa6a' },
  histoPillCount: { fontSize: 13, fontWeight: 700, color: '#7cbe4a' },
  keypad: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '4px 12px 4px' },
  keypadKey: { background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 10, fontSize: 30, fontWeight: 700, color: '#e8f0e0', height: 72, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' as const },
  keypadKeyConfirm: { background: '#7cbe4a', color: '#0a1a0a', border: '1px solid #7cbe4a' },
  keypadKeyBack: { background: '#2a3e2a', color: '#e8f0e0', fontSize: 22 },
  doneSmallBtn: { background: 'none', border: '1px solid #4a7a4a', borderRadius: 6, color: '#7cbe4a', fontSize: 13, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 },
  primaryBtn: { width: '100%', background: '#7cbe4a', color: '#0a1a0a', fontSize: 18, fontWeight: 700, padding: '16px', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 8 },
  outlineBtn: { width: '100%', background: 'none', border: '1px solid #3a5a3a', borderRadius: 8, color: '#7cbe4a', fontSize: 15, padding: '13px', cursor: 'pointer' },
  emptyState: { color: '#4a7a4a', fontSize: 14, textAlign: 'center', padding: '32px 0' },
  issueCountRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #1a3a1a' },
  issueCountName: { fontSize: 16, color: '#e8f0e0', flex: 1 },
  issueCounter: { display: 'flex', alignItems: 'center' },
  issueCounterBtn: { background: '#1e3a1e', border: '1px solid #3a5a3a', color: '#e8f0e0', fontSize: 24, fontWeight: 700, width: 52, height: 52, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  issueCounterVal: { background: '#0e1e0e', border: '1px solid #3a5a3a', borderLeft: 'none', borderRight: 'none', width: 56, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 },
  unknownPhotoRequired: { width: '100%', background: '#2a1e00', border: '1px dashed #f0b040', borderRadius: 8, color: '#f0b040', fontSize: 14, fontWeight: 600, padding: '12px', cursor: 'pointer', marginBottom: 8, textAlign: 'left' as const },
  unknownPhotoRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0 10px' },
  unknownThumb: { width: 80, height: 60, objectFit: 'cover' as const, borderRadius: 6, border: '1px solid #4a7a4a' },
  unknownRetakeBtn: { background: 'none', border: '1px solid #3a5a3a', borderRadius: 6, color: '#7aaa6a', fontSize: 13, padding: '6px 14px', cursor: 'pointer' },
}

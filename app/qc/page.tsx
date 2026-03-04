'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  qcGetAll,
  qcGet,
  qcPut,
  matchOrchardFromGPS,
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
  getNextBagSeq,
  countTodayBags,
  countTodaySampled,
  getPendingBagSessions,
  qcRunFullSync,
} from '@/lib/qc-sync'

type AppMode = 'home' | 'runner' | 'qc'
type RunnerView = 'picker' | 'confirm' | 'scanning_label' | 'logged'
type QcView = 'queue' | 'commodity_select' | 'weighing' | 'issues'
type Lang = 'en' | 'af'

const SCALE_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb'
const WEIGHT_CHAR   = '0000fff1-0000-1000-8000-00805f9b34fb'

let _audioCtx: AudioContext | null = null
function beep() {
  try {
    if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new AudioContext()
    const ctx = _audioCtx
    const play = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 1800
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    }
    ctx.state === 'suspended' ? ctx.resume().then(play).catch(() => {}) : play()
  } catch { }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function findSizeBin(weightG: number, bins: QcSizeBin[]): QcSizeBin | null {
  return bins.find(b => weightG >= b.weight_min_g && weightG <= b.weight_max_g) ?? null
}

export default function QcHome() {
  const [appMode, setAppMode] = useState<AppMode>('home')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  const [employees, setEmployees] = useState<QcEmployee[]>([])
  const [orchards, setOrchards] = useState<QcOrchard[]>([])
  const [sizeBins, setSizeBins] = useState<QcSizeBin[]>([])
  const [qcIssues, setQcIssues] = useState<QcIssue[]>([])

  const [todayBags, setTodayBags] = useState(0)
  const [todaySampled, setTodaySampled] = useState(0)
  const [pendingSessions, setPendingSessions] = useState<QcBagSession[]>([])

  // Runner state
  const [runnerView, setRunnerView] = useState<RunnerView>('picker')
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<QcEmployee | null>(null)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [detectedOrchard, setDetectedOrchard] = useState<QcOrchard | null>(null)
  const [manualOrchard, setManualOrchard] = useState<QcOrchard | null>(null)
  const [bagSeq, setBagSeq] = useState<number>(1)
  const [loggedBagSeq, setLoggedBagSeq] = useState<number>(1)
  const [lastLoggedUuid, setLastLoggedUuid] = useState('')

  // QC state
  const [qcView, setQcView] = useState<QcView>('queue')
  const [activeSession, setActiveSession] = useState<QcBagSession | null>(null)
  const [pendingCommodityUuid, setPendingCommodityUuid] = useState<string | null>(null)
  const [fruit, setFruit] = useState<QcFruit[]>([])
  const [currentWeight, setCurrentWeight] = useState<number | null>(null)
  const [currentBin, setCurrentBin] = useState<QcSizeBin | null>(null)
  const [savingSession, setSavingSession] = useState(false)
  const [keypadInput, setKeypadInput] = useState('')
  // Weight confirmation popup
  const [showWeightConfirm, setShowWeightConfirm] = useState(false)
  const [confirmingWeight, setConfirmingWeight] = useState(0)
  const [confirmingBin, setConfirmingBin] = useState<QcSizeBin | null>(null)
  // Bag-level issue counts: pest_id → count
  const [bagIssues, setBagIssues] = useState<Record<string, number>>({})

  // Unknown issue — requires photo before saving
  const [showUnknownCamera, setShowUnknownCamera] = useState(false)
  const [unknownPhoto, setUnknownPhoto] = useState<string | null>(null)
  const unknownVideoRef = useRef<HTMLVideoElement>(null)
  const unknownCanvasRef = useRef<HTMLCanvasElement>(null)
  const unknownStreamRef = useRef<MediaStream | null>(null)

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

  // Shared camera scanner (runner label + QC queue)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingStreamRef = useRef<MediaStream | null>(null)

  // Attach stream to video element once it mounts (scanning state flip renders the <video>)
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

  // ── Auth + load ───────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('qcapp_access_token')
    if (!token) { window.location.href = '/qc/login'; return }
    setIsLoggedIn(true)
    loadData()
    window.addEventListener('online', handleSync)
    return () => window.removeEventListener('online', handleSync)
  }, [])

  async function handleSync() {
    await qcRunFullSync(localStorage.getItem('qcapp_access_token') || undefined)
    await loadData()
  }

  async function loadData() {
    setLoading(true)
    try {
      const [emps, orchs, bins, issues] = await Promise.all([
        qcGetAll('employees'), qcGetAll('orchards'), qcGetAll('size_bins'), qcGetAll('qc_issues'),
      ])
      setEmployees(emps); setOrchards(orchs); setSizeBins(bins); setQcIssues(issues)
      const [bags, sampled, pending] = await Promise.all([countTodayBags(), countTodaySampled(), getPendingBagSessions()])
      setTodayBags(bags); setTodaySampled(sampled); setPendingSessions(pending)
    } finally { setLoading(false) }
  }

  // ── Runner ────────────────────────────────────────────────────────────────

  function startRunnerFlow() {
    setRunnerView('picker'); setPickerSearch(''); setSelectedEmployee(null)
    setGpsCoords(null); setDetectedOrchard(null); setManualOrchard(null)
    setAppMode('runner')
  }

  function selectEmployee(emp: QcEmployee) {
    setSelectedEmployee(emp)
    setRunnerView('confirm')
    captureGps()
    getNextBagSeq().then(seq => setBagSeq(seq))
  }

  async function captureGps() {
    setGpsLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
      )
      const lat = pos.coords.latitude; const lng = pos.coords.longitude
      setGpsCoords({ lat, lng })
      setDetectedOrchard(await matchOrchardFromGPS(lat, lng))
    } catch { } finally { setGpsLoading(false) }
  }

  async function startLabelScanner() {
    if (!('BarcodeDetector' in window)) { alert('QR scanning requires Chrome on Android.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      pendingStreamRef.current = stream
      setScanning(true)
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            const raw = codes[0].rawValue.trim()
            let uuid: string | null = null
            try { const d = JSON.parse(raw); if (d.id) uuid = d.id } catch { if (/^[0-9a-f-]{36}$/i.test(raw)) uuid = raw }
            if (uuid) { beep(); stopScanner(); await logBagWithUuid(uuid) }
          }
        } catch { }
      }, 500)
    } catch { alert('Could not access camera. Check permissions.') }
  }

  async function logBagWithUuid(uuid: string) {
    if (!selectedEmployee) return
    const chosenOrchard = detectedOrchard || manualOrchard
    if (!chosenOrchard) return
    const orgId = localStorage.getItem('qcapp_org_id') || ''
    const farmId = chosenOrchard.farm_id || localStorage.getItem('qcapp_farm_id') || ''
    const workerId = localStorage.getItem('qcapp_worker_id') || ''
    const now = new Date().toISOString()
    const seq = bagSeq
    await qcSaveAndQueue('bag_sessions', {
      id: uuid,
      organisation_id: orgId,
      farm_id: farmId,
      orchard_id: chosenOrchard.id,
      employee_id: selectedEmployee.id,
      runner_id: workerId,
      collection_lat: gpsCoords?.lat ?? null,
      collection_lng: gpsCoords?.lng ?? null,
      collected_at: now,
      bag_seq: seq,
      status: 'collected',
      created_at: now,
      _employee_name: selectedEmployee.full_name,
      _orchard_name: chosenOrchard.name,
    })
    qcPushPendingRecords().catch(() => {})
    setTodayBags(prev => prev + 1)
    setLoggedBagSeq(seq)
    setLastLoggedUuid(uuid)
    setRunnerView('logged')
  }

  // ── QC worker ─────────────────────────────────────────────────────────────

  function startQcFlow() {
    setQcView('queue'); setActiveSession(null); setFruit([])
    setCurrentWeight(null); setCurrentBin(null); setBagIssues({})
    setUnknownPhoto(null); stopUnknownCamera()
    setAppMode('qc')
  }

  function openSession(session: QcBagSession) {
    setActiveSession(session); setFruit([])
    setCurrentWeight(null); setCurrentBin(null); setKeypadInput('')
    setShowWeightConfirm(false); setBagIssues({})
    setUnknownPhoto(null); stopUnknownCamera()
    setQcView('weighing'); stopScanner()
  }

  async function handleQrScan(raw: string) {
    stopScanner()
    let uuid: string
    try { const d = JSON.parse(raw); uuid = d.id || raw.trim() } catch { uuid = raw.trim() }
    const existing = await qcGet('bag_sessions', uuid)
    if (existing) {
      openSession(existing)
    } else {
      // Runner hasn't synced yet — ask for commodity only
      setPendingCommodityUuid(uuid)
      setQcView('commodity_select')
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
    if (!('BarcodeDetector' in window)) { alert('QR scanning requires Chrome on Android.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      pendingStreamRef.current = stream
      setScanning(true)
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current) return
        try { const codes = await detector.detect(videoRef.current); if (codes.length > 0) { beep(); await handleQrScan(codes[0].rawValue) } } catch { }
      }, 500)
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
    weightBuffer.current = [...weightBuffer.current.slice(-4), rawG]
    const buf = weightBuffer.current
    if (buf.length >= 3 && Math.max(...buf) - Math.min(...buf) <= 2) {
      const bin = findSizeBin(rawG, sizeBins)
      setConfirmingWeight(rawG); setConfirmingBin(bin); setShowWeightConfirm(true)
      weightBuffer.current = []
    }
  }

  function handleKeypadConfirm(bins: QcSizeBin[]) {
    const w = keypadInput ? parseInt(keypadInput) : null
    if (!w || w <= 0) return
    setConfirmingWeight(w)
    setConfirmingBin(findSizeBin(w, bins))
    setShowWeightConfirm(true)
  }

  function keypadPress(key: string, bins: QcSizeBin[]) {
    if (key === '⌫') {
      setKeypadInput(prev => prev.slice(0, -1))
    } else if (key === '✓') {
      handleKeypadConfirm(bins)
    } else {
      setKeypadInput(prev => prev.length < 4 ? prev + key : prev)
    }
  }

  function confirmWeightOK() {
    const orgId = localStorage.getItem('qcapp_org_id') || ''
    const newFruit: QcFruit = {
      id: crypto.randomUUID(), session_id: activeSession!.id, organisation_id: orgId,
      seq: fruit.length + 1, weight_g: confirmingWeight, size_bin_id: confirmingBin?.id ?? null,
    }
    setFruit(prev => [...prev, newFruit])
    setCurrentWeight(null); setCurrentBin(null)
    setKeypadInput(''); setShowWeightConfirm(false); weightBuffer.current = []
  }

  function confirmWeightReenter() {
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
    // If unknown goes from 0 → 1, immediately open the camera
    if (isUnknownPest(pestId) && next > 0 && !unknownPhoto) {
      openUnknownCamera()
    }
    // If unknown goes back to 0, clear the photo requirement
    if (isUnknownPest(pestId) && next === 0) {
      setUnknownPhoto(null)
    }
  }

  async function openUnknownCamera() {
    setShowUnknownCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      unknownStreamRef.current = stream
      if (unknownVideoRef.current) {
        unknownVideoRef.current.srcObject = stream
        await unknownVideoRef.current.play()
      }
    } catch {
      setShowUnknownCamera(false)
      alert('Could not access camera. Please check permissions.')
    }
  }

  function stopUnknownCamera() {
    unknownStreamRef.current?.getTracks().forEach(t => t.stop())
    unknownStreamRef.current = null
  }

  function captureUnknownPhoto() {
    const video = unknownVideoRef.current
    const canvas = unknownCanvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    setUnknownPhoto(canvas.toDataURL('image/jpeg', 0.8))
    stopUnknownCamera()
    setShowUnknownCamera(false)
  }

  function retakeUnknownPhoto() {
    setUnknownPhoto(null)
    openUnknownCamera()
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
            id: crypto.randomUUID(),
            session_id: activeSession.id,
            pest_id: pestId,
            organisation_id: orgId,
            count,
            ...(isUnknownPest(pestId) && unknownPhoto ? { _photo: unknownPhoto } : {}),
          })
      }
      await qcPushPendingRecords()
      await loadData()
      setAppMode('home')
    } finally { setSavingSession(false) }
  }

  const sessionBins = useCallback(() => {
    if (!activeSession) return []
    const orchard = orchards.find(o => o.id === activeSession.orchard_id)
    if (!orchard) return []
    return sizeBins.filter(b => b.commodity_id === orchard.commodity_id).sort((a, b) => a.display_order - b.display_order)
  }, [activeSession, orchards, sizeBins])

  const sessionQcIssues = useCallback(() => {
    if (!activeSession) return []
    const orchard = orchards.find(o => o.id === activeSession.orchard_id)
    if (!orchard) return []
    return qcIssues.filter(i => i.commodity_id === orchard.commodity_id).sort((a, b) => a.display_order - b.display_order)
  }, [activeSession, orchards, qcIssues])

  // Only show employees once user starts typing
  const filteredEmployees = pickerSearch.length >= 1
    ? employees.filter(e => {
        const q = pickerSearch.toLowerCase()
        return e.full_name.toLowerCase().includes(q) || e.employee_nr.toLowerCase().includes(q)
      })
    : []

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (!isLoggedIn || loading) {
    return <div style={s.centered}><div style={{ fontSize: 40 }}>⏳</div><div style={{ color: '#7cbe4a', marginTop: 12 }}>Loading...</div></div>
  }

  // HOME
  if (appMode === 'home') {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerTitle}>🍎 Orchard QC</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={s.langBtn} onClick={toggleLang} title="Switch language / Verander taal">
              {lang === 'en' ? 'AF' : 'EN'}
            </button>
            <button style={s.syncBtn} onClick={handleSync}>↻ Sync</button>
          </div>
        </div>
        <div style={s.homeCards}>
          <button style={s.homeCard} onClick={startRunnerFlow}>
            <div style={s.cardIcon}>🏃</div>
            <div style={s.cardLabel}>Log Bag Pickup</div>
            <div style={s.cardSub}>{todayBags > 0 ? `Bag #${todayBags} logged today` : 'No bags logged yet today'}</div>
          </button>
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
        <div style={s.logoutRow}>
          <button style={s.logoutBtn} onClick={() => { localStorage.clear(); window.location.href = '/qc/login' }}>Sign out</button>
        </div>
      </div>
    )
  }

  // RUNNER
  if (appMode === 'runner') {

    // Picker search — blank until typing
    if (runnerView === 'picker') {
      return (
        <div style={s.page}>
          <div style={s.topBar}>
            <button style={s.backBtn} onClick={() => setAppMode('home')}>← Back</button>
            <div style={s.topTitle}>Select Picker</div>
          </div>
          <div style={s.searchBox}>
            <input
              style={s.searchInput}
              type="text"
              placeholder="Type name or employee #..."
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div style={s.employeeList}>
            {pickerSearch.length === 0 && <div style={s.emptyState}>Start typing to search</div>}
            {pickerSearch.length > 0 && filteredEmployees.length === 0 && <div style={s.emptyState}>No matching employees</div>}
            {filteredEmployees.map(emp => (
              <button key={emp.id} style={s.employeeRow} onClick={() => selectEmployee(emp)}>
                <div style={s.empName}>{emp.full_name}</div>
                <div style={s.empSub}>#{emp.employee_nr}{emp.team ? ` · ${emp.team}` : ''}</div>
              </button>
            ))}
          </div>
        </div>
      )
    }

    // Confirm — GPS + orchard + scan label button
    if (runnerView === 'confirm') {
      const chosenOrchard = detectedOrchard || manualOrchard
      return (
        <div style={s.page}>
          <div style={s.topBar}>
            <button style={s.backBtn} onClick={() => setRunnerView('picker')}>← Back</button>
            <div style={s.topTitle}>Confirm</div>
          </div>
          <div style={s.confirmCard}>
            <div style={s.confirmRow}>
              <span style={s.confirmLabel}>Picker</span>
              <span style={s.confirmValue}>{selectedEmployee?.full_name}</span>
            </div>
            <div style={s.confirmRow}>
              <span style={s.confirmLabel}>Bag #</span>
              <span style={{ ...s.confirmValue, fontSize: 28, fontWeight: 800, color: '#7cbe4a' }}>{bagSeq}</span>
            </div>
            <div style={s.confirmRow}>
              <span style={s.confirmLabel}>GPS</span>
              <span style={s.confirmValue}>
                {gpsLoading ? '📍 Getting location...' : gpsCoords ? `${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}` : '⚠️ GPS unavailable'}
              </span>
            </div>
            <div style={s.confirmRow}>
              <span style={s.confirmLabel}>Orchard</span>
              <span style={s.confirmValue}>
                {detectedOrchard ? `✅ ${detectedOrchard.name}` : gpsLoading ? 'Detecting...' : '⚠️ Select manually'}
              </span>
            </div>
            {!detectedOrchard && !gpsLoading && (
              <select style={s.select} value={manualOrchard?.id || ''} onChange={e => setManualOrchard(orchards.find(x => x.id === e.target.value) || null)}>
                <option value="">— Select orchard —</option>
                {orchards.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
          </div>
          <div style={s.confirmActions}>
            <button
              style={{ ...s.primaryBtn, opacity: chosenOrchard ? 1 : 0.4, fontSize: 18, padding: '18px', background: '#4a9e2a', borderRadius: 10 }}
              onClick={() => { if (chosenOrchard) { setRunnerView('scanning_label'); startLabelScanner() } }}
              disabled={!chosenOrchard}
            >
              📷 Scan QR Label
            </button>
          </div>
        </div>
      )
    }

    // Scanning QR label from pre-printed stack
    if (runnerView === 'scanning_label') {
      return (
        <div style={s.page}>
          <div style={s.topBar}>
            <button style={s.backBtn} onClick={() => { stopScanner(); setRunnerView('confirm') }}>← Back</button>
            <div style={s.topTitle}>Scan QR Label</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={s.scannerContainer}>
              <video ref={videoRef} style={s.scannerVideo} playsInline muted />
              <div style={s.scannerOverlay}>Align the pre-printed QR label</div>
            </div>
          </div>
          <div style={{ padding: '0 20px', color: '#7aaa6a', fontSize: 14, textAlign: 'center' as const }}>
            Scan label from your stack → place it in {selectedEmployee?.full_name}'s crate
          </div>
        </div>
      )
    }

    // Logged — show confirmation + UUID for QC worker to enter manually
    if (runnerView === 'logged') {
      return (
        <div style={{ ...s.page, alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: 0 }}>
          <div style={{ fontSize: 72 }}>✅</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#7cbe4a', marginTop: 12 }}>Bag #{loggedBagSeq} Logged</div>
          <div style={{ fontSize: 16, color: '#e8f0e0', marginTop: 6 }}>{selectedEmployee?.full_name}</div>
          <div style={{ fontSize: 12, color: '#7aaa6a', marginTop: 4 }}>{detectedOrchard?.name || manualOrchard?.name}</div>
          <div style={{ marginTop: 28, width: '100%' }}>
            <div style={{ fontSize: 11, color: '#4a7a4a', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Bag ID — give this to QC worker</div>
            <div
              style={{ fontFamily: 'monospace', fontSize: 13, color: '#7cbe4a', background: '#0e1e0e', border: '1px solid #2e5a2e', borderRadius: 6, padding: '12px', wordBreak: 'break-all' as const, cursor: 'pointer' }}
              onClick={() => navigator.clipboard?.writeText(lastLoggedUuid).catch(() => {})}
              title="Tap to copy"
            >
              {lastLoggedUuid}
            </div>
            <div style={{ fontSize: 11, color: '#3a5a3a', marginTop: 4, textAlign: 'center' as const }}>Tap to copy</div>
          </div>
          <button
            style={{ ...s.primaryBtn, marginTop: 28 }}
            onClick={() => {
              setRunnerView('picker'); setPickerSearch(''); setSelectedEmployee(null)
              setGpsCoords(null); setDetectedOrchard(null); setManualOrchard(null)
            }}
          >
            Next Picker →
          </button>
        </div>
      )
    }
  }

  // QC WORKER
  if (appMode === 'qc') {

    // Queue
    if (qcView === 'queue') {
      return (
        <div style={s.page}>
          <div style={s.topBar}>
            <button style={s.backBtn} onClick={() => { stopScanner(); setAppMode('home') }}>← Back</button>
            <div style={s.topTitle}>Bag Queue</div>
          </div>
          <div style={s.scanSection}>
            {!scanning ? (
              <button style={s.scanBtn} onClick={startScanner}>📷 Scan Bag QR</button>
            ) : (
              <div style={s.scannerContainer}>
                <video ref={videoRef} style={s.scannerVideo} playsInline muted />
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

    // Commodity select — runner not synced yet, just need commodity for size bins
    if (qcView === 'commodity_select') {
      return (
        <div style={s.page}>
          <div style={s.topBar}>
            <button style={s.backBtn} onClick={() => setQcView('queue')}>← Back</button>
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

    // Weighing
    if (qcView === 'weighing') {
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
          {/* Header */}
          <div style={s.topBar}>
            <button style={s.backBtn} onClick={() => setQcView('queue')}>← Queue</button>
            <div style={s.topTitle}>Fruit Weighing</div>
            {fruit.length > 0 && (
              <button style={s.doneSmallBtn} onClick={() => setQcView('issues')}>
                {fruit.length} fruit — Done →
              </button>
            )}
          </div>

          {/* Weight display */}
          <div style={s.weightSection}>
            <div style={{ ...s.weightDisplay, color: keypadInput ? '#e8f0e0' : '#3a5a3a' }}>
              {displayWeight}
            </div>
            <div style={s.binLabel}>{binLabel || (bleConnected ? 'Place on scale…' : 'Enter weight')}</div>
          </div>

          {/* Mini histogram — compact horizontal pills */}
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

          {/* Keypad */}
          <div style={s.keypad}>
            {['1','2','3','4','5','6','7','8','9','⌫','0','✓'].map(key => (
              <button
                key={key}
                style={{
                  ...s.keypadKey,
                  ...(key === '✓' ? s.keypadKeyConfirm : {}),
                  ...(key === '⌫' ? s.keypadKeyBack : {}),
                  opacity: key === '✓' && !keypadInput ? 0.35 : 1,
                }}
                onClick={() => keypadPress(key, bins)}
                disabled={key === '✓' && !keypadInput}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Bag info */}
          <div style={{ padding: '4px 12px 0', textAlign: 'center' as const }}>
            <span style={{ fontSize: 13, color: '#7aaa6a', fontWeight: 600 }}>Bag #{activeSession?.bag_seq ?? '?'}</span>
            <span style={{ fontSize: 13, color: '#4a6a4a' }}> · {activeSession?._orchard_name} · {activeSession?._employee_name}</span>
          </div>

          {/* BLE connect — compact */}
          <div style={{ padding: '4px 12px 8px' }}>
            <button
              style={{ ...s.outlineBtn, fontSize: 13, padding: '9px', borderColor: bleConnected ? '#7cbe4a' : '#2e4a2e' }}
              onClick={bleConnected ? undefined : connectScale}
            >
              {bleConnected ? '🔵 Scale connected — stable reads auto-capture' : '🔌 Connect Bluetooth Scale'}
            </button>
          </div>

          {/* Weight confirmation popup */}
          {showWeightConfirm && (
            <div style={s.weightConfirmOverlay}>
              <div style={s.weightConfirmBin}>{confirmingBin?.label ?? 'No bin match'}</div>
              <div style={s.weightConfirmWeight}>{confirmingWeight} g</div>
              <div style={s.weightConfirmActions}>
                <button style={s.weightConfirmReenter} onClick={confirmWeightReenter}>Re-enter</button>
                <button style={s.weightConfirmOk} onClick={confirmWeightOK}>OK ✓</button>
              </div>
            </div>
          )}
        </div>
      )
    }

    // Issues — bag-level issue counts
    if (qcView === 'issues') {
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
      const histoBins = Object.entries(fruit.reduce((acc, f) => {
        const label = f.size_bin_id ? (bins.find(b => b.id === f.size_bin_id)?.label ?? '?') : 'No bin'
        acc[label] = (acc[label] || 0) + 1; return acc
      }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])

      return (
        <div style={s.page}>
          <div style={s.topBar}>
            <button style={s.backBtn} onClick={() => setQcView('weighing')}>← Weighing</button>
            <div style={s.topTitle}>Issues</div>
          </div>

          {/* Mini size summary */}
          <div style={{ padding: '10px 16px 4px' }}>
            <div style={{ fontSize: 11, color: '#4a7a4a', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>
              {fruit.length} fruit · avg {avgWeight}g
            </div>
            <div style={s.histoPills}>
              {histoBins.map(([label, count]) => (
                <div key={label} style={s.histoPill}>
                  <span style={s.histoPillLabel}>{label}</span>
                  <span style={s.histoPillCount}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: '#1e3a1e', margin: '8px 0' }} />

          {/* Issue counters */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {issues.length === 0 && (
              <div style={{ color: '#4a7a4a', fontSize: 14, textAlign: 'center', padding: '28px 0' }}>
                No QC issues configured for this commodity.
              </div>
            )}
            {issues.map(issue => {
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
            })}
          </div>

          {/* Validation error */}
          {issueError && (
            <div style={{ margin: '8px 16px', padding: '10px 14px', background: '#2a0e0e', border: '1px solid #7a2a2a', borderRadius: 8, color: '#f08080', fontSize: 13 }}>
              ⚠️ Non-picker issues ({nonPickerTotal}) cannot exceed fruit weighed ({fruit.length})
            </div>
          )}

          {/* Footer */}
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
      )
    }
  }

  // Unknown issue camera modal — rendered on top of everything
  if (showUnknownCamera) {
    return (
      <div style={s.unknownCameraModal}>
        <div style={s.unknownCameraHeader}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0b040' }}>
            📷 {lang === 'af' ? 'Foto van Onbekende Probleem' : 'Photo of Unknown Issue'}
          </div>
          <div style={{ fontSize: 13, color: '#a0c080', marginTop: 4 }}>
            {lang === 'af' ? 'Neem \'n duidelike foto voor jy kan stoor' : 'Take a clear photo before you can save'}
          </div>
        </div>
        <video ref={unknownVideoRef} style={s.unknownCameraVideo} playsInline muted />
        <div style={s.unknownCameraActions}>
          <button style={s.unknownCaptureBtn} onClick={captureUnknownPhoto}>📸 {lang === 'af' ? 'Neem Foto' : 'Take Photo'}</button>
          <button
            style={s.unknownCancelBtn}
            onClick={() => {
              stopUnknownCamera()
              setShowUnknownCamera(false)
              // Reset the unknown count — they cancelled
              const unknownIssue = qcIssues.find(i =>
                i.display_name.toLowerCase() === 'unknown' ||
                (i.display_name_af?.toLowerCase() ?? '') === 'onbekend'
              )
              if (unknownIssue) setBagIssues(prev => ({ ...prev, [unknownIssue.pest_id]: 0 }))
            }}
          >
            {lang === 'af' ? 'Kanselleer' : 'Cancel'}
          </button>
        </div>
        <canvas ref={unknownCanvasRef} style={{ display: 'none' }} />
      </div>
    )
  }

  return null
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  searchBox: { padding: '16px 20px 8px' },
  searchInput: { width: '100%', background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 8, color: '#e8f0e0', fontSize: 18, padding: '14px', outline: 'none', boxSizing: 'border-box' },
  employeeList: { flex: 1, overflowY: 'auto', padding: '0 20px 20px' },
  employeeRow: { display: 'flex', flexDirection: 'column', gap: 2, background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 8, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', textAlign: 'left', width: '100%' },
  empName: { fontSize: 17, fontWeight: 600, color: '#e8f0e0' },
  empSub: { fontSize: 12, color: '#7aaa6a' },
  emptyState: { color: '#4a7a4a', fontSize: 14, textAlign: 'center', padding: '32px 0' },
  confirmCard: { background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 12, margin: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 },
  confirmRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  confirmLabel: { fontSize: 12, color: '#7aaa6a', textTransform: 'uppercase' as const, letterSpacing: '0.08em', flexShrink: 0, paddingTop: 2 },
  confirmValue: { fontSize: 16, color: '#e8f0e0', textAlign: 'right' as const },
  select: { width: '100%', background: '#1a2e1a', border: '1px solid #3a6a3a', borderRadius: 6, color: '#e8f0e0', fontSize: 15, padding: '10px', outline: 'none' },
  confirmActions: { padding: '16px 20px 32px' },
  primaryBtn: { width: '100%', background: '#7cbe4a', color: '#0a1a0a', fontSize: 18, fontWeight: 700, padding: '16px', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 8 },
  outlineBtn: { width: '100%', background: 'none', border: '1px solid #3a5a3a', borderRadius: 8, color: '#7cbe4a', fontSize: 15, padding: '13px', cursor: 'pointer' },
  scanSection: { padding: '20px' },
  scanBtn: { width: '100%', background: '#7cbe4a', color: '#0a1a0a', fontSize: 17, fontWeight: 700, padding: '18px', border: 'none', borderRadius: 8, cursor: 'pointer' },
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
  manualInput: { flex: 1, background: '#1e3a1e', border: '1px solid #3a5a3a', borderRadius: 8, color: '#e8f0e0', fontSize: 16, padding: '12px', outline: 'none' },
  histoPills: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, padding: '4px 12px 8px' },
  histoPill: { display: 'flex', alignItems: 'center', gap: 5, background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 20, padding: '4px 10px' },
  histoPillLabel: { fontSize: 12, color: '#7aaa6a' },
  histoPillCount: { fontSize: 13, fontWeight: 700, color: '#7cbe4a' },
  keypad: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '4px 12px 4px' },
  keypadKey: { background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 10, fontSize: 30, fontWeight: 700, color: '#e8f0e0', height: 72, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' as const },
  keypadKeyConfirm: { background: '#7cbe4a', color: '#0a1a0a', border: '1px solid #7cbe4a' },
  keypadKeyBack: { background: '#2a3e2a', color: '#e8f0e0', fontSize: 22 },
  doneSmallBtn: { background: 'none', border: '1px solid #4a7a4a', borderRadius: 6, color: '#7cbe4a', fontSize: 13, fontWeight: 700, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 },
  weightConfirmOverlay: { position: 'fixed' as const, bottom: 0, left: 0, right: 0, background: '#0d1f0d', border: '1px solid #4a7a4a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '32px 24px 44px', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  weightConfirmBin: { fontSize: 22, color: '#7aaa6a', fontWeight: 600 },
  weightConfirmWeight: { fontSize: 72, fontWeight: 900, color: '#7cbe4a', lineHeight: 1 },
  weightConfirmActions: { display: 'flex', gap: 12, width: '100%', marginTop: 20 },
  weightConfirmReenter: { flex: 1, background: '#1e3a1e', border: '1px solid #3a5a3a', borderRadius: 12, color: '#e8f0e0', fontSize: 17, fontWeight: 600, padding: '18px', cursor: 'pointer' },
  weightConfirmOk: { flex: 2, background: '#7cbe4a', border: 'none', borderRadius: 12, color: '#0a1a0a', fontSize: 20, fontWeight: 800, padding: '18px', cursor: 'pointer' },
  issueCountRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #1a3a1a' },
  issueCountName: { fontSize: 16, color: '#e8f0e0', flex: 1 },
  issueCounter: { display: 'flex', alignItems: 'center' },
  issueCounterBtn: { background: '#1e3a1e', border: '1px solid #3a5a3a', color: '#e8f0e0', fontSize: 24, fontWeight: 700, width: 52, height: 52, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  issueCounterVal: { background: '#0e1e0e', border: '1px solid #3a5a3a', borderLeft: 'none', borderRight: 'none', width: 56, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 },
  unknownPhotoRequired: { width: '100%', background: '#2a1e00', border: '1px dashed #f0b040', borderRadius: 8, color: '#f0b040', fontSize: 14, fontWeight: 600, padding: '12px', cursor: 'pointer', marginBottom: 8, textAlign: 'left' as const },
  unknownPhotoRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0 10px' },
  unknownThumb: { width: 80, height: 60, objectFit: 'cover' as const, borderRadius: 6, border: '1px solid #4a7a4a' },
  unknownRetakeBtn: { background: 'none', border: '1px solid #3a5a3a', borderRadius: 6, color: '#7aaa6a', fontSize: 13, padding: '6px 14px', cursor: 'pointer' },
  unknownCameraModal: { position: 'fixed' as const, inset: 0, background: '#0a1a0a', display: 'flex', flexDirection: 'column' as const, zIndex: 500 },
  unknownCameraHeader: { padding: '20px 20px 12px', borderBottom: '1px solid #2e3a1e' },
  unknownCameraVideo: { flex: 1, width: '100%', objectFit: 'cover' as const, display: 'block' },
  unknownCameraActions: { display: 'flex', gap: 12, padding: '16px 20px 36px' },
  unknownCaptureBtn: { flex: 2, background: '#f0b040', border: 'none', borderRadius: 12, color: '#1a1000', fontSize: 20, fontWeight: 800, padding: '18px', cursor: 'pointer' },
  unknownCancelBtn: { flex: 1, background: '#1e3a1e', border: '1px solid #3a5a3a', borderRadius: 12, color: '#e8f0e0', fontSize: 16, padding: '18px', cursor: 'pointer' },
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import {
  qcGetAll,
  qcGet,
  matchOrchardFromGPS,
  type QcEmployee,
  type QcOrchard,
} from '@/lib/qc-db'
import {
  qcSaveAndQueue,
  qcPushPendingRecords,
  getNextBagSeq,
  countTodayBags,
  qcRunFullSync,
} from '@/lib/qc-sync'
import { beep } from '@/lib/qc-utils'
import { useRfidScanner } from '@/lib/useRfidScanner'

type RunnerView = 'home' | 'picker' | 'confirm' | 'scanning_label' | 'logged'

export default function RunnerPage() {
  const [view, setView] = useState<RunnerView>('home')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  const [employees, setEmployees] = useState<QcEmployee[]>([])
  const [orchards, setOrchards] = useState<QcOrchard[]>([])
  const [todayBags, setTodayBags] = useState(0)

  // Picker state
  const [pickerSearch, setPickerSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<QcEmployee | null>(null)
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [detectedOrchard, setDetectedOrchard] = useState<QcOrchard | null>(null)
  const [manualOrchard, setManualOrchard] = useState<QcOrchard | null>(null)
  const [bagSeq, setBagSeq] = useState<number>(1)
  const [loggedBagSeq, setLoggedBagSeq] = useState<number>(1)
  const [lastLoggedUuid, setLastLoggedUuid] = useState('')
  const [rfidStatus, setRfidStatus] = useState<'ready' | 'found' | 'not_found' | null>(null)

  // Camera scanner
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scanning, setScanning] = useState(false)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingStreamRef = useRef<MediaStream | null>(null)

  // Attach stream to video element once it mounts
  useEffect(() => {
    if (pendingStreamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = pendingStreamRef.current
      videoRef.current.play().catch(() => {})
      pendingStreamRef.current = null
    }
  }, [scanning])

  // ── Auth helpers (read from runnerapp_ prefix) ────────────────────────────

  function getToken(): string {
    return localStorage.getItem('runnerapp_access_token') || ''
  }

  // ── RFID scanner hook ─────────────────────────────────────────────────────

  const handleRfidScan = useCallback((tagNumber: string) => {
    if (view !== 'picker') return
    const emp = employees.find(e => e.rfid_tag === tagNumber)
    if (emp) {
      setRfidStatus('found')
      selectEmployee(emp)
    } else {
      setRfidStatus('not_found')
      setTimeout(() => setRfidStatus('ready'), 2000)
    }
  }, [view, employees])

  useRfidScanner({
    onScan: handleRfidScan,
    enabled: view === 'picker',
  })

  // ── Auth + load ────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('runnerapp_access_token')
    if (!token) { window.location.href = '/runner/login'; return }
    setIsLoggedIn(true)
    loadData()
    window.addEventListener('online', handleSync)
    const pollInterval = setInterval(() => handleSync(), 30000)
    return () => {
      window.removeEventListener('online', handleSync)
      clearInterval(pollInterval)
    }
  }, [])

  async function handleSync() {
    await qcRunFullSync(localStorage.getItem('runnerapp_access_token') || undefined)
    await loadData(false)
  }

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      const [emps, orchs] = await Promise.all([
        qcGetAll('employees'), qcGetAll('orchards'),
      ])
      setEmployees(emps)
      setOrchards(orchs)
      const bags = await countTodayBags()
      setTodayBags(bags)
    } finally { if (showLoading) setLoading(false) }
  }

  // ── Runner flow ────────────────────────────────────────────────────────────

  function startRunnerFlow() {
    setView('picker'); setPickerSearch(''); setSelectedEmployee(null)
    setGpsCoords(null); setDetectedOrchard(null); setManualOrchard(null)
    setRfidStatus('ready')
  }

  function selectEmployee(emp: QcEmployee) {
    setSelectedEmployee(emp)
    setView('confirm')
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
        if (code) {
          const raw = code.data.trim()
          let uuid: string | null = null
          try { const d = JSON.parse(raw); if (d.id) uuid = d.id } catch { if (/^[0-9a-f-]{36}$/i.test(raw)) uuid = raw }
          if (uuid) { beep(); stopScanner(); logBagWithUuid(uuid) }
        }
      }, 300)
    } catch { alert('Could not access camera. Check permissions.') }
  }

  function stopScanner() {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null }
    const stream = (videoRef.current?.srcObject as MediaStream | null) || pendingStreamRef.current
    stream?.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    pendingStreamRef.current = null
    setScanning(false)
  }

  async function logBagWithUuid(uuid: string) {
    if (!selectedEmployee) return
    const chosenOrchard = detectedOrchard || manualOrchard
    if (!chosenOrchard) return
    const existing = await qcGet('bag_sessions', uuid)
    if (existing) {
      const msg = existing.status === 'sampled'
        ? `Bag #${existing.bag_seq} already sampled — do not reuse this label.`
        : `Bag #${existing.bag_seq} already logged for ${existing._employee_name}. Scan a different label.`
      alert(msg)
      stopScanner()
      return
    }
    const orgId = localStorage.getItem('runnerapp_org_id') || ''
    const farmId = chosenOrchard.farm_id || localStorage.getItem('runnerapp_farm_id') || ''
    const workerId = localStorage.getItem('runnerapp_worker_id') || ''
    const now = new Date().toISOString()
    const seq = bagSeq
    const token = getToken()
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
    }, token)
    qcPushPendingRecords().catch(() => {})
    setTodayBags(prev => prev + 1)
    setLoggedBagSeq(seq)
    setLastLoggedUuid(uuid)
    setView('logged')
  }

  // Only show employees once user starts typing
  const filteredEmployees = pickerSearch.length >= 1
    ? employees.filter(e => {
        const q = pickerSearch.toLowerCase()
        return e.full_name.toLowerCase().includes(q) || e.employee_nr.toLowerCase().includes(q)
      })
    : []

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (!isLoggedIn || loading) {
    return <div style={st.centered}><div style={{ fontSize: 40 }}>⏳</div><div style={{ color: '#7cbe4a', marginTop: 12 }}>Loading...</div></div>
  }

  // HOME
  if (view === 'home') {
    return (
      <div style={st.page}>
        <div style={st.header}>
          <div style={st.headerTitle}>🏃 Orchard Runner</div>
          <button style={st.syncBtn} onClick={handleSync}>↻ Sync</button>
        </div>
        <div style={st.homeCards}>
          <button style={st.homeCard} onClick={startRunnerFlow}>
            <div style={st.cardIcon}>📦</div>
            <div style={st.cardLabel}>Log Bag Pickup</div>
            <div style={st.cardSub}>{todayBags > 0 ? `Bag #${todayBags} logged today` : 'No bags logged yet today'}</div>
          </button>
        </div>
        <div style={st.logoutRow}>
          <button style={st.logoutBtn} onClick={() => {
            // Clear runner-specific keys
            const keys = Object.keys(localStorage).filter(k => k.startsWith('runnerapp_'))
            keys.forEach(k => localStorage.removeItem(k))
            window.location.href = '/runner/login'
          }}>Sign out</button>
        </div>
      </div>
    )
  }

  // PICKER (with RFID support)
  if (view === 'picker') {
    return (
      <div style={st.page}>
        <div style={st.topBar}>
          <button style={st.backBtn} onClick={() => setView('home')}>← Back</button>
          <div style={st.topTitle}>Select Picker</div>
        </div>

        {/* RFID status indicator */}
        <div style={st.rfidBar}>
          {rfidStatus === 'ready' && (
            <div style={st.rfidReady}>📡 RFID ready — scan tag or search below</div>
          )}
          {rfidStatus === 'found' && (
            <div style={st.rfidFound}>✅ Tag matched!</div>
          )}
          {rfidStatus === 'not_found' && (
            <div style={st.rfidNotFound}>❌ Tag not registered — search manually</div>
          )}
        </div>

        <div style={st.searchBox}>
          <input
            style={st.searchInput}
            type="text"
            placeholder="Type name or employee #..."
            value={pickerSearch}
            onChange={e => setPickerSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div style={st.employeeList}>
          {pickerSearch.length === 0 && <div style={st.emptyState}>Start typing to search</div>}
          {pickerSearch.length > 0 && filteredEmployees.length === 0 && <div style={st.emptyState}>No matching employees</div>}
          {filteredEmployees.map(emp => (
            <button key={emp.id} style={st.employeeRow} onClick={() => selectEmployee(emp)}>
              <div style={st.empName}>{emp.full_name}</div>
              <div style={st.empSub}>
                #{emp.employee_nr}{emp.team ? ` · ${emp.team}` : ''}
                {emp.rfid_tag && <span style={st.rfidChip}>📡</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // CONFIRM — GPS + orchard + scan label button
  if (view === 'confirm') {
    const chosenOrchard = detectedOrchard || manualOrchard
    return (
      <div style={st.page}>
        <div style={st.topBar}>
          <button style={st.backBtn} onClick={() => { setView('picker'); setRfidStatus('ready') }}>← Back</button>
          <div style={st.topTitle}>Confirm</div>
        </div>
        <div style={st.confirmCard}>
          <div style={st.confirmRow}>
            <span style={st.confirmLabel}>Picker</span>
            <span style={st.confirmValue}>{selectedEmployee?.full_name}</span>
          </div>
          <div style={st.confirmRow}>
            <span style={st.confirmLabel}>Bag #</span>
            <span style={{ ...st.confirmValue, fontSize: 28, fontWeight: 800, color: '#7cbe4a' }}>{bagSeq}</span>
          </div>
          <div style={st.confirmRow}>
            <span style={st.confirmLabel}>GPS</span>
            <span style={st.confirmValue}>
              {gpsLoading ? '📍 Getting location...' : gpsCoords ? `${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}` : '⚠️ GPS unavailable'}
            </span>
          </div>
          <div style={st.confirmRow}>
            <span style={st.confirmLabel}>Orchard</span>
            <span style={st.confirmValue}>
              {detectedOrchard ? `✅ ${detectedOrchard.name}` : gpsLoading ? 'Detecting...' : '⚠️ Select manually'}
            </span>
          </div>
          {!detectedOrchard && !gpsLoading && (
            <select style={st.select} value={manualOrchard?.id || ''} onChange={e => setManualOrchard(orchards.find(x => x.id === e.target.value) || null)}>
              <option value="">— Select orchard —</option>
              {orchards.map(o => <option key={o.id} value={o.id}>{o.name}{o.variety ? ` (${o.variety})` : ''}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
          <button
            style={{ width: 180, height: 180, background: chosenOrchard ? '#4a9e2a' : '#2e4a2e', color: '#e8f0e0', border: 'none', borderRadius: 16, cursor: chosenOrchard ? 'pointer' : 'not-allowed', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 16, fontWeight: 700 }}
            onClick={() => { if (chosenOrchard) { setView('scanning_label'); startLabelScanner() } }}
            disabled={!chosenOrchard}
          >
            <span style={{ fontSize: 48 }}>📷</span>
            Scan QR Label
          </button>
        </div>
      </div>
    )
  }

  // SCANNING QR LABEL
  if (view === 'scanning_label') {
    return (
      <div style={st.page}>
        <div style={st.topBar}>
          <button style={st.backBtn} onClick={() => { stopScanner(); setView('confirm') }}>← Back</button>
          <div style={st.topTitle}>Scan QR Label</div>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={st.scannerContainer}>
            <video ref={videoRef} style={st.scannerVideo} playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={st.scannerOverlay}>Align the pre-printed QR label</div>
          </div>
        </div>
        <div style={{ padding: '0 20px', color: '#7aaa6a', fontSize: 14, textAlign: 'center' as const }}>
          Scan label from your stack → place it in {selectedEmployee?.full_name}'s crate
        </div>
      </div>
    )
  }

  // LOGGED — confirmation
  if (view === 'logged') {
    return (
      <div style={{ ...st.page, alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: 0 }}>
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
          style={{ ...st.primaryBtn, marginTop: 28 }}
          onClick={() => {
            setView('picker'); setPickerSearch(''); setSelectedEmployee(null)
            setGpsCoords(null); setDetectedOrchard(null); setManualOrchard(null)
            setRfidStatus('ready')
          }}
        >
          Next Picker →
        </button>
      </div>
    )
  }

  return null
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#1a2e1a', color: '#e8f0e0', fontFamily: 'system-ui, sans-serif', overflowY: 'auto' },
  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#1a2e1a', color: '#e8f0e0', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px', borderBottom: '1px solid #2e5a2e' },
  headerTitle: { fontSize: 22, fontWeight: 700, color: '#7cbe4a' },
  syncBtn: { background: 'none', border: '1px solid #3a5a3a', borderRadius: 6, color: '#7cbe4a', padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
  topBar: { display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12, borderBottom: '1px solid #2e5a2e' },
  backBtn: { background: 'none', border: 'none', color: '#7cbe4a', fontSize: 15, cursor: 'pointer', padding: 0, flexShrink: 0 },
  topTitle: { fontSize: 17, fontWeight: 600, color: '#e8f0e0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  homeCards: { display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 20px' },
  homeCard: { background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 12, padding: '28px 24px', textAlign: 'left', cursor: 'pointer', color: '#e8f0e0', display: 'flex', flexDirection: 'column', gap: 6 },
  cardIcon: { fontSize: 36, marginBottom: 4 },
  cardLabel: { fontSize: 20, fontWeight: 700 },
  cardSub: { fontSize: 13, color: '#7aaa6a' },
  logoutRow: { padding: '0 20px 24px', marginTop: 'auto' },
  logoutBtn: { background: 'none', border: '1px solid #2e4a2e', borderRadius: 6, color: '#4a7a4a', padding: '10px 20px', fontSize: 13, cursor: 'pointer', width: '100%' },

  // RFID indicator
  rfidBar: { padding: '8px 20px 0' },
  rfidReady: { fontSize: 13, color: '#7aaa6a', background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 6, padding: '8px 12px', textAlign: 'center' },
  rfidFound: { fontSize: 13, color: '#7cbe4a', background: '#1e3a1e', border: '1px solid #4a8a2a', borderRadius: 6, padding: '8px 12px', textAlign: 'center' },
  rfidNotFound: { fontSize: 13, color: '#f0b040', background: '#2a2200', border: '1px solid #6a5a20', borderRadius: 6, padding: '8px 12px', textAlign: 'center' },
  rfidChip: { marginLeft: 6, fontSize: 11 },

  // Search + employees
  searchBox: { padding: '16px 20px 8px' },
  searchInput: { width: '100%', background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 8, color: '#e8f0e0', fontSize: 18, padding: '14px', outline: 'none', boxSizing: 'border-box' },
  employeeList: { flex: 1, overflowY: 'auto', padding: '0 20px 20px' },
  employeeRow: { display: 'flex', flexDirection: 'column', gap: 2, background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 8, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', textAlign: 'left', width: '100%' },
  empName: { fontSize: 17, fontWeight: 600, color: '#e8f0e0' },
  empSub: { fontSize: 12, color: '#7aaa6a' },
  emptyState: { color: '#4a7a4a', fontSize: 14, textAlign: 'center', padding: '32px 0' },

  // Confirm
  confirmCard: { background: '#1e3a1e', border: '1px solid #2e5a2e', borderRadius: 12, margin: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 },
  confirmRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  confirmLabel: { fontSize: 12, color: '#7aaa6a', textTransform: 'uppercase' as const, letterSpacing: '0.08em', flexShrink: 0, paddingTop: 2 },
  confirmValue: { fontSize: 16, color: '#e8f0e0', textAlign: 'right' as const },
  select: { width: '100%', background: '#1a2e1a', border: '1px solid #3a6a3a', borderRadius: 6, color: '#e8f0e0', fontSize: 15, padding: '10px', outline: 'none' },
  primaryBtn: { width: '100%', background: '#7cbe4a', color: '#0a1a0a', fontSize: 18, fontWeight: 700, padding: '16px', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 8 },

  // Scanner
  scannerContainer: { position: 'relative' as const, borderRadius: 8, overflow: 'hidden' },
  scannerVideo: { width: '100%', height: 260, objectFit: 'cover' as const, display: 'block' },
  scannerOverlay: { position: 'absolute' as const, bottom: 40, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 13, textShadow: '0 1px 3px #000' },
}

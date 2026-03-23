'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { RainGauge, RainReading, Dam, DamCapacityRow, DamLevelReading } from '@/lib/rain-db'

type View = 'landing' | 'home' | 'log' | 'dam'

export default function RainAppPage() {
  const [view, setView] = useState<View>('landing')
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [userName, setUserName] = useState('')

  // Reference data
  const [gauges, setGauges] = useState<RainGauge[]>([])
  const [readings, setReadings] = useState<RainReading[]>([])

  // Form state (persists across view switches)
  const [selectedGauge, setSelectedGauge] = useState('')
  const [readingDate, setReadingDate] = useState('')
  const [valueMm, setValueMm] = useState('')
  const [saving, setSaving] = useState(false)
  const [gpsStatus, setGpsStatus] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Dam state
  const [dams, setDams] = useState<Dam[]>([])
  const [damCapacity, setDamCapacity] = useState<DamCapacityRow[]>([])
  const [damReadings, setDamReadings] = useState<DamLevelReading[]>([])
  const [selectedDam, setSelectedDam] = useState('')
  const [damDate, setDamDate] = useState('')
  const [damPenNo, setDamPenNo] = useState('')
  const [damQuarter, setDamQuarter] = useState(0)
  const [damGpsStatus, setDamGpsStatus] = useState('')
  const [damSaving, setDamSaving] = useState(false)
  const [damSaveSuccess, setDamSaveSuccess] = useState(false)

  // ── Init ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    setUserName(localStorage.getItem('rainapp_user_name') || '')

    if (!localStorage.getItem('rainapp_access_token')) {
      window.location.href = '/rain/login'
      return
    }

    setIsOnline(navigator.onLine)
    setReadingDate(new Date().toISOString().split('T')[0])

    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    loadData()

    const syncOnline = async () => {
      const { rainPushPendingRecords } = await import('@/lib/rain-sync')
      await rainPushPendingRecords()
      await refreshPendingCount()
    }
    window.addEventListener('online', syncOnline)

    const interval = setInterval(async () => {
      if (!navigator.onLine) return
      const { rainPushPendingRecords } = await import('@/lib/rain-sync')
      await rainPushPendingRecords()
      await refreshPendingCount()
    }, 2 * 60 * 1000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', syncOnline)
      clearInterval(interval)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const { rainGetAll } = await import('@/lib/rain-db')
      const [allGauges, allReadings, allDams, allDamCap, allDamReadings] = await Promise.all([
        rainGetAll('gauges'),
        rainGetAll('readings'),
        rainGetAll('dams'),
        rainGetAll('dam_capacity'),
        rainGetAll('dam_readings'),
      ])
      setGauges(allGauges)
      setReadings(allReadings.sort((a, b) => b.reading_date.localeCompare(a.reading_date)))
      setDams(allDams)
      setDamCapacity(allDamCap)
      setDamReadings(allDamReadings.sort((a, b) => b.reading_date.localeCompare(a.reading_date)))

      if (allGauges.length > 0 && !selectedGauge) {
        autoSelectGauge(allGauges)
      }
    } catch {
      setGauges([])
      setReadings([])
    }
    await refreshPendingCount()
  }, [selectedGauge])

  // ── GPS auto-select ─────────────────────────────────────────────────

  function autoSelectGauge(allGauges: RainGauge[]) {
    if (!('geolocation' in navigator)) {
      setSelectedGauge(allGauges[0].id)
      return
    }

    setGpsStatus('Locating...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        let nearest: RainGauge | null = null
        let nearestDist = Infinity

        for (const g of allGauges) {
          if (g.lat == null || g.lng == null) continue
          const dist = haversineMetres(latitude, longitude, g.lat, g.lng)
          if (dist < nearestDist) { nearestDist = dist; nearest = g }
        }

        if (nearest && nearestDist <= 200) {
          setSelectedGauge(nearest.id)
          setGpsStatus(`${nearest.name} (${Math.round(nearestDist)}m)`)
        } else if (nearest) {
          setSelectedGauge(nearest.id)
          const d = nearestDist < 1000 ? Math.round(nearestDist) + 'm' : (nearestDist / 1000).toFixed(1) + 'km'
          setGpsStatus(`Nearest: ${nearest.name} (${d})`)
        } else {
          setSelectedGauge(allGauges[0].id)
          setGpsStatus('')
        }
      },
      () => {
        setSelectedGauge(allGauges[0].id)
        setGpsStatus('GPS unavailable')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const refreshPendingCount = async () => {
    const { countPendingRainRecords } = await import('@/lib/rain-sync')
    setPendingCount(await countPendingRainRecords())
  }

  // ── Save reading ────────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedGauge || !readingDate || valueMm === '') return

    const mm = parseFloat(valueMm)
    if (isNaN(mm) || mm < 0) return

    setSaving(true)
    try {
      const { rainSaveAndQueue } = await import('@/lib/rain-sync')
      await rainSaveAndQueue({
        id: `${selectedGauge}_${readingDate}`,
        gauge_id: selectedGauge,
        reading_date: readingDate,
        value_mm: mm,
        _syncStatus: 'pending',
      })

      setValueMm('')
      await loadData()

      if (navigator.onLine) {
        const { rainPushPendingRecords } = await import('@/lib/rain-sync')
        await rainPushPendingRecords()
        await refreshPendingCount()
      }

      // Flash success then go home
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        setView('home')
      }, 1200)
    } catch (err) {
      console.error('[RainApp] Save error:', err)
    }
    setSaving(false)
  }

  // ── Sync ────────────────────────────────────────────────────────────

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const { rainPushPendingRecords, pullRainReferenceData, pullRecentReadings } = await import('@/lib/rain-sync')
      await rainPushPendingRecords()
      await pullRainReferenceData()
      await pullRecentReadings()
      await loadData()
    } catch (err) {
      console.error('[RainApp] Sync error:', err)
    }
    setSyncing(false)
  }

  function handleLogout() {
    const keys = ['access_token', 'refresh_token', 'user_id', 'user_name', 'farm_id', 'farm_ids', 'org_id']
    keys.forEach(k => localStorage.removeItem(`rainapp_${k}`))
    window.location.href = '/rain/login'
  }

  // ── KPIs ────────────────────────────────────────────────────────────

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const monthTotal = useMemo(() => {
    return readings
      .filter(r => {
        if (selectedGauge && r.gauge_id !== selectedGauge) return false
        const d = new Date(r.reading_date + 'T00:00:00')
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((sum, r) => sum + r.value_mm, 0)
  }, [readings, selectedGauge, currentMonth, currentYear])

  const yearTotal = useMemo(() => {
    return readings
      .filter(r => {
        if (selectedGauge && r.gauge_id !== selectedGauge) return false
        return new Date(r.reading_date + 'T00:00:00').getFullYear() === currentYear
      })
      .reduce((sum, r) => sum + r.value_mm, 0)
  }, [readings, selectedGauge, currentYear])

  const recentReadings = readings
    .filter(r => !selectedGauge || r.gauge_id === selectedGauge)
    .slice(0, 10)

  const selectedGaugeName = gauges.find(g => g.id === selectedGauge)?.name || ''

  // ── Keypad handler ──────────────────────────────────────────────────

  function handleKey(key: string) {
    if (key === 'back') {
      setValueMm(prev => prev.slice(0, -1))
    } else if (key === '.') {
      if (!valueMm.includes('.')) setValueMm(prev => prev + '.')
    } else if (key === '0' && valueMm === '0') {
      // Don't allow leading double zero
    } else {
      setValueMm(prev => prev + key)
    }
  }

  // ── Open log view ───────────────────────────────────────────────────

  function openLogView() {
    setValueMm('')
    setReadingDate(new Date().toISOString().split('T')[0])
    setSaveSuccess(false)
    setView('log')
    if (gauges.length > 0) autoSelectGauge(gauges)
  }

  // ── Dam helpers ────────────────────────────────────────────────────

  function autoSelectDam(allDams: Dam[]) {
    if (!('geolocation' in navigator)) {
      setSelectedDam(allDams[0].id)
      return
    }
    setDamGpsStatus('Locating...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        let nearest: Dam | null = null
        let nearestDist = Infinity
        for (const d of allDams) {
          if (d.lat == null || d.lng == null) continue
          const dist = haversineMetres(latitude, longitude, d.lat, d.lng)
          if (dist < nearestDist) { nearestDist = dist; nearest = d }
        }
        if (nearest) {
          setSelectedDam(nearest.id)
          const distStr = nearestDist < 1000 ? `${Math.round(nearestDist)}m` : `${(nearestDist / 1000).toFixed(1)}km`
          setDamGpsStatus(`${nearest.name} (${distStr})`)
        } else {
          setSelectedDam(allDams[0].id)
          setDamGpsStatus('')
        }
      },
      () => {
        setSelectedDam(allDams[0].id)
        setDamGpsStatus('GPS unavailable')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function getDamCapacity(damId: string): DamCapacityRow[] {
    return damCapacity
      .filter(c => c.dam_id === damId)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  function interpolateDamLevel(damId: string, penNo: number, quarter: number): { m3: number; gallons: number; pct: number } | null {
    const cap = getDamCapacity(damId)
    if (cap.length === 0) return null

    // Find the pen row and the next pen row (next = one pen higher number = lower water)
    const penRow = cap.find(c => c.pen_no === penNo)
    if (!penRow) return null

    if (quarter === 0) {
      return { m3: penRow.m3, gallons: penRow.gallons, pct: penRow.pct }
    }

    // Find the next lower pen (higher pen_no = lower water level)
    const nextPen = cap.find(c => c.pen_no === penNo + 1)
    if (!nextPen) {
      // No next pen — just return this pen's values
      return { m3: penRow.m3, gallons: penRow.gallons, pct: penRow.pct }
    }

    // Interpolate: quarter/4 of the way from penRow toward nextPen (lower)
    // pen 6 = 58061, pen 7 = 43561. "6 1/4" = 58061 - 0.25*(58061-43561) = 54436
    const frac = quarter / 4
    const m3 = penRow.m3 - frac * (penRow.m3 - nextPen.m3)
    const gallons = penRow.gallons - frac * (penRow.gallons - nextPen.gallons)
    const pct = penRow.pct - frac * (penRow.pct - nextPen.pct)

    return { m3: Math.round(m3 * 10) / 10, gallons: Math.round(gallons), pct: Math.round(pct * 10) / 10 }
  }

  const damComputed = useMemo(() => {
    if (!selectedDam || !damPenNo) return null
    const pen = parseInt(damPenNo)
    if (isNaN(pen)) return null
    return interpolateDamLevel(selectedDam, pen, damQuarter)
  }, [selectedDam, damPenNo, damQuarter, damCapacity])

  async function handleDamSave() {
    if (!selectedDam || !damPenNo || !damComputed) return
    setDamSaving(true)
    try {
      const userId = localStorage.getItem('rainapp_user_id') || ''
      const pen = parseInt(damPenNo)
      const id = `${selectedDam}_${damDate}`

      const reading: DamLevelReading = {
        id,
        dam_id: selectedDam,
        reading_date: damDate,
        pen_no: pen,
        quarter: damQuarter,
        computed_m3: damComputed.m3,
        computed_gallons: damComputed.gallons,
        computed_pct: damComputed.pct,
        _syncStatus: 'pending',
      }

      const { damSaveAndQueue } = await import('@/lib/rain-sync')
      await damSaveAndQueue(reading)
      await loadData()

      if (navigator.onLine) {
        const { rainPushPendingRecords } = await import('@/lib/rain-sync')
        await rainPushPendingRecords()
        await refreshPendingCount()
      }

      setDamSaveSuccess(true)
      setTimeout(() => {
        setDamSaveSuccess(false)
        setView('landing')
      }, 1200)
    } catch (err) {
      console.error('[RainApp] Dam save error:', err)
    }
    setDamSaving(false)
  }

  const selectedDamName = dams.find(d => d.id === selectedDam)?.name || ''
  const selectedDamCap = getDamCapacity(selectedDam)

  // Recent dam readings
  const recentDamReadings = damReadings.slice(0, 20)

  // ═══════════════════════════════════════════════════════════════════
  // DAM LEVEL VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === 'dam') {
    return (
      <div className="flex flex-col h-dvh bg-[#eae6df]" style={{ overscrollBehavior: 'none' }}>
        {/* Fixed header */}
        <div className="shrink-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <div className="text-2xl font-extrabold text-[#1a5fb8] tracking-wide">Dam Level</div>
              <div className="text-xs text-[#8a95a0]">{userName}</div>
            </div>
            <button
              className="text-sm text-[#8a95a0] px-3 py-1.5 rounded-lg border border-[#d4cfca] bg-white"
              onClick={() => setView('landing')}
            >Cancel</button>
          </div>

          {/* Dam selector */}
          <div className="flex gap-1.5 px-4 pb-2 flex-wrap">
            {dams.map(d => (
              <button
                key={d.id}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold text-center ${
                  selectedDam === d.id
                    ? 'bg-[#1a5fb8] text-white'
                    : 'bg-white text-[#5a6a60] border border-[#d4cfca]'
                }`}
                onClick={() => setSelectedDam(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
          {damGpsStatus && (
            <div className="text-[10px] text-[#8a95a0] px-4 pb-1">{damGpsStatus}</div>
          )}

          {/* Date */}
          <div className="px-4 pb-2">
            <input
              className="w-full px-3 py-2.5 rounded-lg border border-[#d4cfca] text-sm text-[#1a2a3a] bg-white"
              type="date"
              value={damDate}
              onChange={e => setDamDate(e.target.value)}
            />
          </div>

          {/* Pen + Quarter input */}
          <div className="px-4 pb-2 flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-[#8a95a0] uppercase">Pen No</label>
              <select
                className="w-full px-3 py-2.5 rounded-lg border border-[#d4cfca] text-sm text-[#1a2a3a] bg-white mt-1"
                value={damPenNo}
                onChange={e => setDamPenNo(e.target.value)}
              >
                <option value="">--</option>
                {selectedDamCap.map(c => (
                  <option key={c.pen_no} value={c.pen_no}>
                    {c.pen_no === 0 ? 'S/KOP' : c.pen_no}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 120 }}>
              <label className="text-[10px] font-semibold text-[#8a95a0] uppercase">Quarter</label>
              <div className="flex gap-1 mt-1">
                {[0, 1, 2, 3].map(q => (
                  <button
                    key={q}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${
                      damQuarter === q
                        ? 'bg-[#1a5fb8] text-white'
                        : 'bg-white text-[#5a6a60] border border-[#d4cfca]'
                    }`}
                    onClick={() => setDamQuarter(q)}
                  >
                    {q === 0 ? '0' : `${q}/4`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Computed result */}
        <div className="px-4 pb-2">
          {damComputed ? (
            <div className="bg-white rounded-xl border-2 border-[#1a5fb8] py-4 text-center">
              <div className="text-4xl font-extrabold text-[#1a5fb8]">
                {damComputed.pct.toFixed(1)}<span className="text-lg font-normal text-[#8a95a0] ml-1">%</span>
              </div>
              <div className="text-sm text-[#8a95a0] mt-1">
                {Math.round(damComputed.m3).toLocaleString()} m3 | {Math.round(damComputed.gallons).toLocaleString()} gal
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#d4cfca] py-4 text-center text-[#d4cfca]">
              Select pen number
            </div>
          )}
        </div>

        {/* Recent readings for this dam */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-2">
          <div className="text-[10px] font-semibold text-[#8a95a0] uppercase mb-1">Recent — {selectedDamName}</div>
          {recentDamReadings
            .filter(r => r.dam_id === selectedDam)
            .slice(0, 6)
            .map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-[#e8e4dc]">
                <div className="text-sm text-[#1a2a3a]">
                  {new Date(r.reading_date + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' })}
                </div>
                <div className="text-sm">
                  <span className="font-bold text-[#1a5fb8]">{r.computed_pct?.toFixed(1)}%</span>
                  <span className="text-[#8a95a0] ml-2">pen {r.pen_no}{r.quarter > 0 ? ` ${r.quarter}/4` : ''}</span>
                </div>
              </div>
            ))}
        </div>

        {/* Success flash */}
        {damSaveSuccess && (
          <div className="mx-4 mb-1 bg-green-50 border-2 border-green-300 rounded-xl px-3 py-2 text-center text-green-700 text-base font-bold">
            Saved!
          </div>
        )}

        {/* Save button */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <button
            className="w-full bg-[#1a5fb8] text-white text-lg font-bold py-4 rounded-xl disabled:opacity-50 active:bg-[#144a96]"
            onClick={handleDamSave}
            disabled={damSaving || !damComputed || !selectedDam}
          >
            {damSaving ? 'Saving...' : `Save Level (${damComputed ? damComputed.pct.toFixed(1) + '%' : '-'})`}
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOG READING VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === 'log') {
    return (
      <div className="flex flex-col h-dvh bg-[#eae6df] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">allFarm Rain</div>
            <div className="text-xs text-[#8a95a0]">{userName}</div>
          </div>
          <button
            className="text-sm text-[#8a95a0] px-3 py-1.5 rounded-lg border border-[#d4cfca] bg-white"
            onClick={() => setView('home')}
          >Cancel</button>
        </div>

        {/* Gauge pills */}
        <div className="flex gap-1.5 px-4 pb-2">
          {gauges.map(g => (
            <button
              key={g.id}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold text-center ${
                selectedGauge === g.id
                  ? 'bg-[#2176d9] text-white'
                  : 'bg-white text-[#5a6a60] border border-[#d4cfca]'
              }`}
              onClick={() => setSelectedGauge(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
        {gpsStatus && (
          <div className="text-[10px] text-[#8a95a0] px-4 pb-1">{gpsStatus}</div>
        )}

        {/* Date */}
        <div className="px-4 pb-2">
          <input
            className="w-full px-3 py-2.5 rounded-lg border border-[#d4cfca] text-sm text-[#1a2a3a] bg-white"
            type="date"
            value={readingDate}
            onChange={e => setReadingDate(e.target.value)}
          />
        </div>

        {/* Value display */}
        <div className="px-4 pb-2">
          <div className="bg-white rounded-xl border-2 border-[#d4cfca] py-4 text-center">
            <div className="text-5xl font-extrabold text-[#1a2a3a] tabular-nums flex items-center justify-center">
              {valueMm || <span className="text-[#d4cfca]">0</span>}
              <span className="text-base font-normal text-[#8a95a0] ml-2">mm</span>
            </div>
          </div>
        </div>

        {/* Success flash */}
        {saveSuccess && (
          <div className="mx-4 mb-1 bg-green-50 border-2 border-green-300 rounded-xl px-3 py-2 text-center text-green-700 text-base font-bold">
            Saved!
          </div>
        )}

        {/* Push keypad + save to bottom */}
        <div className="flex-1" />

        {/* Keypad */}
        <div className="px-4 pb-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map(key => (
              <button
                key={key}
                className={`py-3 rounded-xl text-xl font-bold active:scale-95 ${
                  key === 'back'
                    ? 'bg-[#f0ede8] text-[#8a95a0]'
                    : 'bg-white text-[#1a2a3a] border border-[#e8e4dc]'
                }`}
                onClick={() => handleKey(key)}
              >
                {key === 'back' ? '\u232B' : key}
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="px-4 pb-4">
          <button
            className="w-full bg-[#2176d9] text-white text-lg font-bold py-4 rounded-xl disabled:opacity-50 active:bg-[#1a65c0]"
            onClick={handleSave}
            disabled={saving || !valueMm || valueMm === '.'}
          >
            {saving ? 'Saving...' : 'Save Reading'}
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // LANDING VIEW — choose Rain or Dam Levels
  // ═══════════════════════════════════════════════════════════════════

  if (view === 'landing') {
    return (
      <div className="flex flex-col h-dvh bg-[#eae6df] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <div>
            <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">allFarm Rain</div>
            <div className="text-xs text-[#8a95a0]">{userName}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            {pendingCount > 0 && (
              <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
            <button
              className="text-xs text-[#2176d9] font-semibold disabled:opacity-50"
              onClick={handleSync}
              disabled={syncing || !isOnline}
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 gap-5">
          <button
            className="bg-[#2176d9] text-white rounded-2xl p-8 text-center active:bg-[#1a65c0] transition-colors shadow-lg"
            onClick={() => setView('home')}
          >
            <div className="text-5xl mb-3">&#127783;</div>
            <div className="text-2xl font-extrabold">Rain</div>
            <div className="text-sm opacity-80 mt-1">Rainfall gauge readings</div>
          </button>

          {dams.length > 0 && (
            <button
              className="bg-[#1a5fb8] text-white rounded-2xl p-8 text-center active:bg-[#144a96] transition-colors shadow-lg"
              onClick={() => {
                setDamDate(new Date().toISOString().split('T')[0])
                setDamPenNo('')
                setDamQuarter(0)
                setDamSaveSuccess(false)
                setDamGpsStatus('')
                if (dams.length > 0) autoSelectDam(dams)
                setView('dam')
              }}
            >
              <div className="text-5xl mb-3">&#127754;</div>
              <div className="text-2xl font-extrabold">Dam Levels</div>
              <div className="text-sm opacity-80 mt-1">Record dam pen readings</div>
            </button>
          )}
        </div>

        <div className="text-center pb-4">
          <button className="text-xs text-[#8a95a0]" onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // RAIN HOME VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view !== 'home') return null

  return (
    <div className="flex flex-col h-dvh bg-[#eae6df] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <button
            className="text-sm text-[#8a95a0] px-2 py-1 rounded-lg border border-[#d4cfca] bg-white"
            onClick={() => setView('landing')}
          >&larr;</button>
          <div>
            <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">Rain</div>
            <div className="text-xs text-[#8a95a0]">{userName}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          {pendingCount > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
      </div>

      {/* Gauge selector (home) */}
      {gauges.length > 1 && (
        <div className="flex gap-2 px-4 pb-4">
          {gauges.map(g => (
            <button
              key={g.id}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-center transition-colors ${
                selectedGauge === g.id
                  ? 'bg-[#2176d9] text-white'
                  : 'bg-white text-[#5a6a60] border border-[#d4cfca]'
              }`}
              onClick={() => setSelectedGauge(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        <div className="bg-white rounded-xl border border-[#e8e4dc] p-4 text-center">
          <div className="text-xs font-semibold text-[#8a95a0] uppercase tracking-wider mb-2">This Month</div>
          <div className="text-3xl font-extrabold text-[#2176d9]">
            {monthTotal > 0 ? Math.round(monthTotal * 10) / 10 : '0'}
          </div>
          <div className="text-xs text-[#8a95a0] mt-0.5">mm</div>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e4dc] p-4 text-center">
          <div className="text-xs font-semibold text-[#8a95a0] uppercase tracking-wider mb-2">This Year</div>
          <div className="text-3xl font-extrabold text-[#1a2a3a]">
            {yearTotal > 0 ? Math.round(yearTotal).toLocaleString() : '0'}
          </div>
          <div className="text-xs text-[#8a95a0] mt-0.5">mm</div>
        </div>
      </div>

      {/* Recent readings — scrollable */}
      <div className="flex-1 min-h-0 mx-4 mb-4 bg-white rounded-xl border border-[#e8e4dc] flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-2 text-xs font-semibold text-[#8a95a0] uppercase tracking-wider shrink-0">
          Recent Readings
          {selectedGaugeName && gauges.length > 1 && (
            <span className="normal-case tracking-normal font-normal"> — {selectedGaugeName}</span>
          )}
        </div>
        {recentReadings.length === 0 ? (
          <div className="text-sm text-[#8a95a0] py-6 text-center">No readings yet</div>
        ) : (
          <div className="overflow-y-auto">
            {recentReadings.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 border-t border-[#f0ede8]">
                <div>
                  <div className="text-sm font-medium text-[#1a2a3a]">
                    {new Date(r.reading_date + 'T00:00:00').toLocaleDateString('en-ZA', {
                      weekday: 'short', day: 'numeric', month: 'short'
                    })}
                  </div>
                  {gauges.length > 1 && (
                    <div className="text-xs text-[#8a95a0]">
                      {gauges.find(g => g.id === r.gauge_id)?.name}
                    </div>
                  )}
                </div>
                <div className="text-xl font-bold text-[#2176d9]">
                  {r.value_mm} <span className="text-xs font-normal text-[#8a95a0]">mm</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Reading button */}
      <div className="px-4 pb-6">
        <button
          className="w-full bg-[#2176d9] text-white text-xl font-bold py-5 rounded-xl active:bg-[#1a65c0] transition-colors shadow-lg"
          onClick={openLogView}
        >
          Log Reading
        </button>
      </div>
    </div>
  )
}

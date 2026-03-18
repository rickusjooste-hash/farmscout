'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { BinsOrchard, BinsTeam, BinsFarm, BinsRecord, BruisingRecord } from '@/lib/bins-db'

type ViewMode = 'home' | 'log-bins' | 'log-bruising'

export default function BinsAppPage() {
  const [view, setView] = useState<ViewMode>('home')
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [userName, setUserName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [farmId, setFarmId] = useState('')

  // Reference data
  const [orchards, setOrchards] = useState<BinsOrchard[]>([])
  const [teams, setTeams] = useState<BinsTeam[]>([])
  const [farms, setFarms] = useState<BinsFarm[]>([])

  // Today's records
  const [todayBins, setTodayBins] = useState<BinsRecord[]>([])
  const [todayBruising, setTodayBruising] = useState<BruisingRecord[]>([])

  // Active tab on home
  const [activeTab, setActiveTab] = useState<'bins' | 'bruising'>('bins')

  // ── Bins form state ──────────────────────────────────────────────────
  const [editingBinsId, setEditingBinsId] = useState<string | null>(null)
  const [binsFormDate, setBinsFormDate] = useState('')
  const [binsFormTime, setBinsFormTime] = useState('')
  const [binsOrchardId, setBinsOrchardId] = useState('')
  const [binsOrchardSearch, setBinsOrchardSearch] = useState('')
  const [binsShowOrchardList, setBinsShowOrchardList] = useState(false)
  const [binsSelectedTeam, setBinsSelectedTeam] = useState('')
  const [binsCount, setBinsCount] = useState('0')
  const [juiceCount, setJuiceCount] = useState('0')
  const [binsSaving, setBinsSaving] = useState(false)
  const binsOrchardRef = useRef<HTMLDivElement>(null)

  // ── Bruising form state ──────────────────────────────────────────────
  const [editingBruisingId, setEditingBruisingId] = useState<string | null>(null)
  const [bruisingFormDate, setBruisingFormDate] = useState('')
  const [bruisingFormTime, setBruisingFormTime] = useState('')
  const [bruisingOrchardId, setBruisingOrchardId] = useState('')
  const [bruisingOrchardSearch, setBruisingOrchardSearch] = useState('')
  const [bruisingShowOrchardList, setBruisingShowOrchardList] = useState(false)
  const [bruisingSelectedTeam, setBruisingSelectedTeam] = useState('')
  const [sampleSize, setSampleSize] = useState('')
  const [binWeightKg, setBinWeightKg] = useState('')
  const [bruisingCount, setBruisingCount] = useState('')
  const [stemCount, setStemCount] = useState('')
  const [injuryCount, setInjuryCount] = useState('')
  const [fruitGuard, setFruitGuard] = useState('')
  const [bruisingSaving, setBruisingSaving] = useState(false)
  const bruisingOrchardRef = useRef<HTMLDivElement>(null)

  // ── Init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    const name = localStorage.getItem('binsapp_user_name') || ''
    const org = localStorage.getItem('binsapp_org_id') || ''
    const farm = localStorage.getItem('binsapp_farm_id') || ''
    setUserName(name)
    setOrgId(org)
    setFarmId(farm)

    if (!localStorage.getItem('binsapp_access_token')) {
      window.location.href = '/bins/login'
      return
    }

    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    loadData()

    const syncOnline = async () => {
      const { binsPushPendingRecords } = await import('@/lib/bins-sync')
      await binsPushPendingRecords()
      await refreshPendingCount()
    }
    window.addEventListener('online', syncOnline)

    const interval = setInterval(async () => {
      if (!navigator.onLine) return
      const { binsPushPendingRecords } = await import('@/lib/bins-sync')
      await binsPushPendingRecords()
      await refreshPendingCount()
    }, 2 * 60 * 1000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', syncOnline)
      clearInterval(interval)
    }
  }, [])

  // Close orchard dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (binsOrchardRef.current && !binsOrchardRef.current.contains(e.target as Node)) {
        setBinsShowOrchardList(false)
      }
      if (bruisingOrchardRef.current && !bruisingOrchardRef.current.contains(e.target as Node)) {
        setBruisingShowOrchardList(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const { binsGetAll } = await import('@/lib/bins-db')
      const [allOrchards, allTeams, allFarms, allBins, allBruising] = await Promise.all([
        binsGetAll('orchards'),
        binsGetAll('teams'),
        binsGetAll('farms'),
        binsGetAll('bins_records'),
        binsGetAll('bruising_records'),
      ])
      setOrchards(allOrchards.sort((a, b) => (a.orchard_nr ?? 999) - (b.orchard_nr ?? 999)))
      setTeams(allTeams)
      setFarms(allFarms)

      const today = new Date().toISOString().split('T')[0]
      setTodayBins(
        allBins
          .filter(r => r.received_date === today)
          .sort((a, b) => (b.received_time || '').localeCompare(a.received_time || ''))
      )
      setTodayBruising(
        allBruising
          .filter(r => r.received_date === today)
          .sort((a, b) => (b.received_time || '').localeCompare(a.received_time || ''))
      )
    } catch {
      setOrchards([])
      setTeams([])
      setFarms([])
      setTodayBins([])
      setTodayBruising([])
    }
    await refreshPendingCount()
  }, [])

  async function refreshPendingCount() {
    try {
      const { countPendingBinsRecords } = await import('@/lib/bins-sync')
      setPendingCount(await countPendingBinsRecords())
    } catch {
      setPendingCount(0)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const { binsRunFullSync } = await import('@/lib/bins-sync')
      await binsRunFullSync()
      await loadData()
    } catch (err) {
      console.error('[BinsApp] Sync error:', err)
    }
    setSyncing(false)
  }

  function handleLogout() {
    localStorage.removeItem('binsapp_access_token')
    localStorage.removeItem('binsapp_refresh_token')
    localStorage.removeItem('binsapp_user_id')
    localStorage.removeItem('binsapp_user_name')
    localStorage.removeItem('binsapp_farm_id')
    localStorage.removeItem('binsapp_farm_ids')
    localStorage.removeItem('binsapp_org_id')
    window.location.href = '/bins/login'
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  function nowDate() { return new Date().toISOString().split('T')[0] }
  function nowTime() { const n = new Date(); return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}` }

  function filterOrchards(search: string) {
    return orchards.filter(o => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        o.name.toLowerCase().includes(q) ||
        String(o.orchard_nr || '').includes(q) ||
        (o.variety || '').toLowerCase().includes(q)
      )
    })
  }

  // ── Open Bins form ──────────────────────────────────────────────────
  function openNewBins() {
    setEditingBinsId(null)
    setBinsFormDate(nowDate())
    setBinsFormTime(nowTime())
    setBinsOrchardId('')
    setBinsOrchardSearch('')
    setBinsSelectedTeam('')
    setBinsCount('0')
    setJuiceCount('0')
    setView('log-bins')
  }

  function openEditBins(record: BinsRecord) {
    setEditingBinsId(record.xlsx_id)
    setBinsFormDate(record.received_date)
    setBinsFormTime(record.received_time ? record.received_time.slice(0, 5) : '')
    setBinsOrchardId(record.orchard_id || '')
    setBinsOrchardSearch(record.orchard_name || '')
    setBinsSelectedTeam(record.team || '')
    setBinsCount(String(record.bins))
    setJuiceCount(String(record.juice))
    setView('log-bins')
  }

  // ── Open Bruising form ──────────────────────────────────────────────
  function openNewBruising() {
    setEditingBruisingId(null)
    setBruisingFormDate(nowDate())
    setBruisingFormTime(nowTime())
    setBruisingOrchardId('')
    setBruisingOrchardSearch('')
    setBruisingSelectedTeam('')
    setSampleSize('')
    setBinWeightKg('')
    setBruisingCount('')
    setStemCount('')
    setInjuryCount('')
    setFruitGuard('')
    setView('log-bruising')
  }

  function openEditBruising(record: BruisingRecord) {
    setEditingBruisingId(record.xlsx_id)
    setBruisingFormDate(record.received_date)
    setBruisingFormTime(record.received_time ? record.received_time.slice(0, 5) : '')
    setBruisingOrchardId(record.orchard_id || '')
    setBruisingOrchardSearch(record.orchard_name || '')
    setBruisingSelectedTeam(record.team || '')
    setSampleSize(String(record.sample_size || ''))
    setBinWeightKg(record.bin_weight_kg != null ? String(record.bin_weight_kg) : '')
    setBruisingCount(String(record.bruising_count || ''))
    setStemCount(String(record.stem_count || ''))
    setInjuryCount(String(record.injury_count || ''))
    setFruitGuard(record.fruit_guard || '')
    setView('log-bruising')
  }

  // ── Save Bins ───────────────────────────────────────────────────────
  async function handleSaveBins() {
    if (!binsOrchardId || !(parseFloat(binsCount) > 0)) return
    setBinsSaving(true)

    try {
      const { binsSaveAndQueue, deriveSeason, getISOWeek, getWeekDay } = await import('@/lib/bins-sync')

      const orchard = orchards.find(o => o.id === binsOrchardId)
      const team = teams.find(t => t.key === binsSelectedTeam)
      const recordFarmId = orchard?.farm_id || farmId
      const farm = farms.find(f => f.id === recordFarmId)
      const { production_year, season } = deriveSeason(binsFormDate)
      const timeStr = binsFormTime ? `${binsFormTime}:00` : null

      const binsRecord: BinsRecord = {
        xlsx_id: editingBinsId || `pwa-${crypto.randomUUID()}`,
        organisation_id: orgId,
        farm_id: recordFarmId,
        orchard_id: binsOrchardId || null,
        orchard_legacy_id: orchard?.legacy_id ?? null,
        orchard_name: orchard?.name || binsOrchardSearch || '',
        variety: orchard?.variety ?? null,
        team: binsSelectedTeam || null,
        team_name: team?.team_name ?? binsSelectedTeam ?? null,
        bins: parseFloat(binsCount) || 0,
        juice: parseFloat(juiceCount) || 0,
        total: (parseFloat(binsCount) || 0) + (parseFloat(juiceCount) || 0),
        production_year,
        season,
        week_num: getISOWeek(binsFormDate),
        week_day: getWeekDay(binsFormDate),
        farm_code: farm?.code ?? null,
        received_date: binsFormDate,
        received_time: timeStr,
      }

      await binsSaveAndQueue(binsRecord)
      await loadData()
      setView('home')
    } catch (err) {
      console.error('[BinsApp] Save bins error:', err)
    }

    setBinsSaving(false)
  }

  // ── Save Bruising ──────────────────────────────────────────────────
  async function handleSaveBruising() {
    if (!bruisingOrchardId || !sampleSize) return
    setBruisingSaving(true)

    try {
      const { binsSaveBruisingAndQueue, deriveSeason, getISOWeek } = await import('@/lib/bins-sync')

      const orchard = orchards.find(o => o.id === bruisingOrchardId)
      const team = teams.find(t => t.key === bruisingSelectedTeam)
      const recordFarmId = orchard?.farm_id || farmId
      const farm = farms.find(f => f.id === recordFarmId)
      const { production_year, season } = deriveSeason(bruisingFormDate)
      const timeStr = bruisingFormTime ? `${bruisingFormTime}:00` : null

      const ss = parseInt(sampleSize) || 0
      const bc = parseInt(bruisingCount) || 0
      const sc = parseInt(stemCount) || 0
      const ic = parseInt(injuryCount) || 0

      const record: BruisingRecord = {
        xlsx_id: editingBruisingId || `pwa-${crypto.randomUUID()}`,
        organisation_id: orgId,
        farm_id: recordFarmId,
        orchard_id: bruisingOrchardId || null,
        orchard_legacy_id: orchard?.legacy_id ?? null,
        orchard_name: orchard?.name || bruisingOrchardSearch || '',
        variety: orchard?.variety ?? null,
        team: bruisingSelectedTeam || null,
        team_name: team?.team_name ?? bruisingSelectedTeam ?? null,
        bruising_count: bc,
        stem_count: sc,
        injury_count: ic,
        sample_size: ss,
        bruising_pct: ss > 0 ? Number(((bc / ss) * 100).toFixed(2)) : null,
        stem_pct: ss > 0 ? Number(((sc / ss) * 100).toFixed(2)) : null,
        injury_pct: ss > 0 ? Number(((ic / ss) * 100).toFixed(2)) : null,
        sample_nr: null,
        bin_weight_kg: binWeightKg ? parseFloat(binWeightKg) : null,
        fruit_guard: fruitGuard || null,
        production_year,
        season,
        week_num: getISOWeek(bruisingFormDate),
        received_date: bruisingFormDate,
        received_time: timeStr,
        farm_code: farm?.code ?? null,
      }

      await binsSaveBruisingAndQueue(record)
      await loadData()
      setView('home')
    } catch (err) {
      console.error('[BinsApp] Save bruising error:', err)
    }

    setBruisingSaving(false)
  }

  // ── Computed ─────────────────────────────────────────────────────────
  const totalBins = todayBins.reduce((s, r) => s + r.bins, 0)
  const totalJuice = todayBins.reduce((s, r) => s + r.juice, 0)
  const bruisingSamples = todayBruising.length

  const binsFormTotal = (parseFloat(binsCount) || 0) + (parseFloat(juiceCount) || 0)
  const ss = parseInt(sampleSize) || 0
  const bruisingPct = ss > 0 ? (((parseInt(bruisingCount) || 0) / ss) * 100).toFixed(1) : '–'
  const stemPct = ss > 0 ? (((parseInt(stemCount) || 0) / ss) * 100).toFixed(1) : '–'
  const injuryPct = ss > 0 ? (((parseInt(injuryCount) || 0) / ss) * 100).toFixed(1) : '–'

  const binsFilteredOrchards = filterOrchards(binsOrchardSearch)
  const bruisingFilteredOrchards = filterOrchards(bruisingOrchardSearch)

  const selectedBinsOrchard = orchards.find(o => o.id === binsOrchardId)
  const selectedBruisingOrchard = orchards.find(o => o.id === bruisingOrchardId)

  function orchardDisplayText(orchardId: string, search: string, selected: BinsOrchard | undefined) {
    if (!orchardId || !selected) return search
    return `${selected.orchard_nr ? selected.orchard_nr + '. ' : ''}${selected.name}${selected.variety ? ' (' + selected.variety + ')' : ''}`
  }

  // ── Stepper component for +/- buttons ────────────────────────────────
  function Stepper({ label, value, onChange, step = 1, min = 0 }: {
    label: string; value: string; onChange: (v: string) => void; step?: number; min?: number
  }) {
    const num = parseFloat(value) || 0
    return (
      <div className="flex-1 min-w-0">
        <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">{label}</label>
        <div className="flex items-stretch rounded-lg border-[1.5px] border-[#d4cfca] overflow-hidden">
          <button
            type="button"
            className="px-4 py-3 flex items-center justify-center text-2xl font-bold text-[#2176d9] bg-[#f5f3ef] hover:bg-[#e8e4dc] active:bg-[#d4cfca] transition-colors shrink-0 select-none"
            onClick={() => { const nv = Math.max(min, num - step); onChange(nv % 1 === 0 ? String(nv) : nv.toFixed(1)) }}
          >
            &minus;
          </button>
          <input
            className="flex-1 px-1 py-3 text-2xl font-bold text-center text-[#1a2a3a] bg-white outline-none min-w-0 w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            type="number"
            inputMode="decimal"
            step={step}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
          <button
            type="button"
            className="px-4 py-3 flex items-center justify-center text-2xl font-bold text-[#2176d9] bg-[#f5f3ef] hover:bg-[#e8e4dc] active:bg-[#d4cfca] transition-colors shrink-0 select-none"
            onClick={() => { const nv = num + step; onChange(nv % 1 === 0 ? String(nv) : nv.toFixed(1)) }}
          >
            +
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOG BINS VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'log-bins') {
    return (
      <div className="min-h-screen bg-[#eae6df] font-sans">
        {/* Header */}
        <div className="bg-white border-b border-[#e8e4dc] px-6 py-4 flex items-center gap-4">
          <button onClick={() => setView('home')} className="text-[#2176d9] font-semibold text-sm hover:underline">&larr; Back</button>
          <h1 className="text-lg font-bold text-[#1a2a3a]">{editingBinsId ? 'Edit Bins Entry' : 'Log Bins'}</h1>
        </div>

        <div className="max-w-xl mx-auto p-6">
          <div className="bg-white rounded-xl border border-[#e8e4dc] shadow-sm p-6">
            {/* Date & Time */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Date</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="date"
                  value={binsFormDate}
                  onChange={e => setBinsFormDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Time</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="time"
                  value={binsFormTime}
                  onChange={e => setBinsFormTime(e.target.value)}
                />
              </div>
            </div>

            {/* Orchard (searchable) */}
            <div className="mb-4 relative" ref={binsOrchardRef}>
              <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Orchard</label>
              <input
                className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                type="text"
                placeholder="Search orchard..."
                value={binsOrchardId && !binsShowOrchardList
                  ? orchardDisplayText(binsOrchardId, binsOrchardSearch, selectedBinsOrchard)
                  : binsOrchardSearch}
                onChange={e => { setBinsOrchardSearch(e.target.value); setBinsOrchardId(''); setBinsShowOrchardList(true) }}
                onFocus={() => setBinsShowOrchardList(true)}
              />
              {binsShowOrchardList && binsFilteredOrchards.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-[#e8e4dc] rounded-b-lg max-h-52 overflow-y-auto z-10 shadow-lg">
                  {binsFilteredOrchards.map(o => (
                    <button
                      key={o.id}
                      className="block w-full px-3 py-2.5 text-left text-sm text-[#1a2a3a] hover:bg-[#f5f3ef] border-b border-[#f0ece6]"
                      onClick={() => { setBinsOrchardId(o.id); setBinsOrchardSearch(o.name); setBinsShowOrchardList(false) }}
                    >
                      <span className="font-semibold">{o.orchard_nr ? `${o.orchard_nr}. ` : ''}{o.name}</span>
                      {o.variety && <span className="text-[#8a95a0] ml-2">{o.variety}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team */}
            <div className="mb-4">
              <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Team</label>
              <select
                className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                value={binsSelectedTeam}
                onChange={e => setBinsSelectedTeam(e.target.value)}
              >
                <option value="">Select team...</option>
                {teams.map(t => (
                  <option key={t.key} value={t.key}>{t.team_name || t.team}</option>
                ))}
              </select>
            </div>

            {/* Bins & Juice */}
            <div className="flex gap-3 mb-4">
              <Stepper label="Bins" value={binsCount} onChange={setBinsCount} step={0.5} />
              <Stepper label="Juice" value={juiceCount} onChange={setJuiceCount} step={0.5} />
            </div>

            {/* Total */}
            <div className="flex justify-between items-center px-4 py-3 bg-[#f5f3ef] rounded-lg mb-6">
              <span className="text-sm font-semibold text-[#6a7a70]">Total</span>
              <span className="text-2xl font-extrabold text-[#2176d9]">{binsFormTotal}</span>
            </div>

            {/* Save */}
            <button
              className="w-full bg-[#2176d9] text-white font-semibold rounded-lg px-6 py-3 disabled:opacity-50 hover:bg-[#1a65c0] transition-colors"
              onClick={handleSaveBins}
              disabled={binsSaving || !binsOrchardId || !(parseFloat(binsCount) > 0)}
            >
              {binsSaving ? 'Saving...' : editingBinsId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOG BRUISING VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (view === 'log-bruising') {
    return (
      <div className="min-h-screen bg-[#eae6df] font-sans">
        {/* Header */}
        <div className="bg-white border-b border-[#e8e4dc] px-6 py-4 flex items-center gap-4">
          <button onClick={() => setView('home')} className="text-[#2176d9] font-semibold text-sm hover:underline">&larr; Back</button>
          <h1 className="text-lg font-bold text-[#1a2a3a]">{editingBruisingId ? 'Edit Bruising Entry' : 'Log Bruising'}</h1>
        </div>

        <div className="max-w-xl mx-auto p-6">
          <div className="bg-white rounded-xl border border-[#e8e4dc] shadow-sm p-6">
            {/* Date & Time */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Date</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="date"
                  value={bruisingFormDate}
                  onChange={e => setBruisingFormDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Time</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="time"
                  value={bruisingFormTime}
                  onChange={e => setBruisingFormTime(e.target.value)}
                />
              </div>
            </div>

            {/* Orchard (searchable) */}
            <div className="mb-4 relative" ref={bruisingOrchardRef}>
              <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Orchard</label>
              <input
                className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                type="text"
                placeholder="Search orchard..."
                value={bruisingOrchardId && !bruisingShowOrchardList
                  ? orchardDisplayText(bruisingOrchardId, bruisingOrchardSearch, selectedBruisingOrchard)
                  : bruisingOrchardSearch}
                onChange={e => { setBruisingOrchardSearch(e.target.value); setBruisingOrchardId(''); setBruisingShowOrchardList(true) }}
                onFocus={() => setBruisingShowOrchardList(true)}
              />
              {bruisingShowOrchardList && bruisingFilteredOrchards.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-[#e8e4dc] rounded-b-lg max-h-52 overflow-y-auto z-10 shadow-lg">
                  {bruisingFilteredOrchards.map(o => (
                    <button
                      key={o.id}
                      className="block w-full px-3 py-2.5 text-left text-sm text-[#1a2a3a] hover:bg-[#f5f3ef] border-b border-[#f0ece6]"
                      onClick={() => { setBruisingOrchardId(o.id); setBruisingOrchardSearch(o.name); setBruisingShowOrchardList(false) }}
                    >
                      <span className="font-semibold">{o.orchard_nr ? `${o.orchard_nr}. ` : ''}{o.name}</span>
                      {o.variety && <span className="text-[#8a95a0] ml-2">{o.variety}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team */}
            <div className="mb-4">
              <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Team</label>
              <select
                className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                value={bruisingSelectedTeam}
                onChange={e => setBruisingSelectedTeam(e.target.value)}
              >
                <option value="">Select team...</option>
                {teams.map(t => (
                  <option key={t.key} value={t.key}>{t.team_name || t.team}</option>
                ))}
              </select>
            </div>

            {/* Sample Size & Bin Weight */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Sample Size</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={sampleSize}
                  onChange={e => setSampleSize(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Bin Weight (kg)</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="0.0"
                  value={binWeightKg}
                  onChange={e => setBinWeightKg(e.target.value)}
                />
              </div>
            </div>

            {/* Bruising / Stem / Injury counts */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Bruising</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={bruisingCount}
                  onChange={e => setBruisingCount(e.target.value)}
                />
                <div className="text-center text-xs font-semibold text-[#2176d9] mt-1">{bruisingPct}%</div>
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Stem</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={stemCount}
                  onChange={e => setStemCount(e.target.value)}
                />
                <div className="text-center text-xs font-semibold text-[#2176d9] mt-1">{stemPct}%</div>
              </div>
              <div className="flex-1">
                <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Injury</label>
                <input
                  className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={injuryCount}
                  onChange={e => setInjuryCount(e.target.value)}
                />
                <div className="text-center text-xs font-semibold text-[#2176d9] mt-1">{injuryPct}%</div>
              </div>
            </div>

            {/* Fruit Guard */}
            <div className="mb-6">
              <label className="block text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mb-1.5">Fruit Guard</label>
              <input
                className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[#d4cfca] text-sm text-[#1a2a3a] bg-white outline-none"
                type="text"
                placeholder="Optional"
                value={fruitGuard}
                onChange={e => setFruitGuard(e.target.value)}
              />
            </div>

            {/* Save */}
            <button
              className="w-full bg-[#2176d9] text-white font-semibold rounded-lg px-6 py-3 disabled:opacity-50 hover:bg-[#1a65c0] transition-colors"
              onClick={handleSaveBruising}
              disabled={bruisingSaving || !bruisingOrchardId || !sampleSize}
            >
              {bruisingSaving ? 'Saving...' : editingBruisingId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // HOME VIEW
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#eae6df] font-sans">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e4dc] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a2a3a]">BinsApp</h1>
          <div className="text-xs text-[#8a95a0] mt-0.5">{userName}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isOnline ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="relative bg-[#f5f3ef] text-[#1a2a3a] border border-[#e8e4dc] rounded-lg px-3.5 py-2 text-sm font-semibold hover:bg-[#ebe8e2] transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync'}
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-[#8a95a0] hover:text-[#1a2a3a] transition-colors"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Action cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={openNewBins}
            className="bg-white rounded-xl border border-[#e8e4dc] shadow-sm p-6 text-left hover:shadow-md hover:border-[#2176d9] transition-all group"
          >
            <div className="text-3xl mb-2">&#128230;</div>
            <div className="text-lg font-bold text-[#1a2a3a] group-hover:text-[#2176d9]">Log Bins</div>
            <div className="text-sm text-[#8a95a0] mt-1">Record bins received</div>
          </button>
          <button
            onClick={openNewBruising}
            className="bg-white rounded-xl border border-[#e8e4dc] shadow-sm p-6 text-left hover:shadow-md hover:border-[#2176d9] transition-all group"
          >
            <div className="text-3xl mb-2">&#127822;</div>
            <div className="text-lg font-bold text-[#1a2a3a] group-hover:text-[#2176d9]">Log Bruising</div>
            <div className="text-sm text-[#8a95a0] mt-1">Record bruising samples</div>
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-[#e8e4dc] shadow-sm p-4 text-center">
            <div className="text-3xl font-extrabold text-[#2176d9]">{totalBins}</div>
            <div className="text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mt-1">Bins</div>
          </div>
          <div className="bg-white rounded-xl border border-[#e8e4dc] shadow-sm p-4 text-center">
            <div className="text-3xl font-extrabold text-[#2176d9]">{totalJuice}</div>
            <div className="text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mt-1">Juice</div>
          </div>
          <div className="bg-white rounded-xl border border-[#e8e4dc] shadow-sm p-4 text-center">
            <div className="text-3xl font-extrabold text-[#2176d9]">{bruisingSamples}</div>
            <div className="text-xs uppercase text-[#8a95a0] tracking-wide font-semibold mt-1">Bruising</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-[#e0dcd5] rounded-lg p-1">
          <button
            onClick={() => setActiveTab('bins')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'bins' ? 'bg-white text-[#1a2a3a] shadow-sm' : 'text-[#8a95a0] hover:text-[#1a2a3a]'}`}
          >
            Bins ({todayBins.length})
          </button>
          <button
            onClick={() => setActiveTab('bruising')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'bruising' ? 'bg-white text-[#1a2a3a] shadow-sm' : 'text-[#8a95a0] hover:text-[#1a2a3a]'}`}
          >
            Bruising ({todayBruising.length})
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#e8e4dc] shadow-sm overflow-hidden">
          {activeTab === 'bins' ? (
            todayBins.length === 0 ? (
              <div className="text-center py-12 text-[#8a95a0]">
                <div className="text-4xl mb-2">&#128230;</div>
                <div className="text-sm">No bins entries yet today</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e8e4dc] text-[#8a95a0] text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-semibold">Time</th>
                    <th className="text-left px-4 py-3 font-semibold">Orchard</th>
                    <th className="text-left px-4 py-3 font-semibold">Team</th>
                    <th className="text-right px-4 py-3 font-semibold">Bins</th>
                    <th className="text-right px-4 py-3 font-semibold">Juice</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {todayBins.map(record => (
                    <tr key={record.xlsx_id} className="border-b border-[#f0ece6] hover:bg-[#faf9f6]">
                      <td className="px-4 py-3 text-[#6a7a70] font-medium">
                        {record.received_time ? record.received_time.slice(0, 5) : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1a2a3a]">{record.orchard_name}</td>
                      <td className="px-4 py-3 text-[#6a7a70]">{record.team_name || record.team || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#1a2a3a]">{record.bins}</td>
                      <td className="px-4 py-3 text-right text-[#6a7a70]">{record.juice}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#2176d9]">{record.total}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEditBins(record)}
                          className="text-[#2176d9] hover:underline text-xs font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            todayBruising.length === 0 ? (
              <div className="text-center py-12 text-[#8a95a0]">
                <div className="text-4xl mb-2">&#127822;</div>
                <div className="text-sm">No bruising entries yet today</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e8e4dc] text-[#8a95a0] text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-semibold">Time</th>
                    <th className="text-left px-4 py-3 font-semibold">Orchard</th>
                    <th className="text-left px-4 py-3 font-semibold">Team</th>
                    <th className="text-right px-4 py-3 font-semibold">Sample</th>
                    <th className="text-right px-4 py-3 font-semibold">Bruising%</th>
                    <th className="text-right px-4 py-3 font-semibold">Stem%</th>
                    <th className="text-right px-4 py-3 font-semibold">Injury%</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {todayBruising.map(record => (
                    <tr key={record.xlsx_id} className="border-b border-[#f0ece6] hover:bg-[#faf9f6]">
                      <td className="px-4 py-3 text-[#6a7a70] font-medium">
                        {record.received_time ? record.received_time.slice(0, 5) : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1a2a3a]">{record.orchard_name}</td>
                      <td className="px-4 py-3 text-[#6a7a70]">{record.team_name || record.team || '—'}</td>
                      <td className="px-4 py-3 text-right text-[#1a2a3a]">{record.sample_size}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#1a2a3a]">
                        {record.bruising_pct != null ? `${record.bruising_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[#6a7a70]">
                        {record.stem_pct != null ? `${record.stem_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[#6a7a70]">
                        {record.injury_pct != null ? `${record.injury_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEditBruising(record)}
                          className="text-[#2176d9] hover:underline text-xs font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  )
}

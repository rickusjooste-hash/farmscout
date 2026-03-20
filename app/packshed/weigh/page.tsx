'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PackshedPackhouse, PackshedOrchard, WeighRecord } from '@/lib/packshed-weigh-db'

type View = 'home' | 'weigh' | 'history'
type Category = 'pack' | 'juice' | 'rot'

const TARE_PER_BIN: Record<string, number> = { plastic: 38, wood: 65 }
const DEFAULT_BIN_COUNT: Record<string, number> = { pack: 2, juice: 2, rot: 1 }

export default function PackshedWeighPage() {
  const [view, setView] = useState<View>('home')
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [userName, setUserName] = useState('')

  // Reference data
  const [packhouses, setPackhouses] = useState<PackshedPackhouse[]>([])
  const [orchards, setOrchards] = useState<PackshedOrchard[]>([])
  const [records, setRecords] = useState<WeighRecord[]>([])

  // Selectors
  const [selectedPackhouse, setSelectedPackhouse] = useState('')

  // Weigh form state
  const [weighDate, setWeighDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState<Category>('pack')
  const [grossWeight, setGrossWeight] = useState('')
  const [binType, setBinType] = useState<'plastic' | 'wood'>('plastic')
  const [binsOnScale, setBinsOnScale] = useState(2)
  const [selectedOrchard, setSelectedOrchard] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Init ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    setUserName(localStorage.getItem('packshedweigh_user_name') || '')

    if (!localStorage.getItem('packshedweigh_access_token')) {
      window.location.href = '/packshed/weigh/login'
      return
    }

    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    loadData()

    const syncOnline = async () => {
      const { weighPushPendingRecords } = await import('@/lib/packshed-weigh-sync')
      await weighPushPendingRecords()
      await refreshPendingCount()
    }
    window.addEventListener('online', syncOnline)

    const interval = setInterval(async () => {
      if (!navigator.onLine) return
      const { weighPushPendingRecords } = await import('@/lib/packshed-weigh-sync')
      await weighPushPendingRecords()
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
      const { weighGetAll } = await import('@/lib/packshed-weigh-db')
      const [allPackhouses, allOrchards, allRecords] = await Promise.all([
        weighGetAll('packhouses'),
        weighGetAll('orchards'),
        weighGetAll('weigh_records'),
      ])
      setPackhouses(allPackhouses)
      setOrchards(allOrchards)
      setRecords(allRecords)

      if (allPackhouses.length > 0 && !selectedPackhouse) {
        setSelectedPackhouse(allPackhouses[0].id)
      }
    } catch {
      setPackhouses([])
      setOrchards([])
      setRecords([])
    }
    await refreshPendingCount()
  }, [selectedPackhouse])

  const refreshPendingCount = async () => {
    const { countPendingWeighRecords } = await import('@/lib/packshed-weigh-sync')
    setPendingCount(await countPendingWeighRecords())
  }

  // ── Today's records for selected packhouse ────────────────────────

  const todayRecords = useMemo(() => {
    return records
      .filter(r => r.weigh_date === weighDate && r.packhouse_id === selectedPackhouse)
      .sort((a, b) => a.seq - b.seq)
  }, [records, weighDate, selectedPackhouse])

  const countByCategory = useMemo(() => {
    const counts = { pack: 0, juice: 0, rot: 0 }
    for (const r of todayRecords) {
      counts[r.category] += (r.bin_count || 1)
    }
    return counts
  }, [todayRecords])

  const avgByCategory = useMemo(() => {
    const avgs: Record<string, number> = {}
    for (const cat of ['pack', 'juice', 'rot'] as Category[]) {
      const catRecords = todayRecords.filter(r => r.category === cat)
      if (catRecords.length > 0) {
        const totalNet = catRecords.reduce((s, r) => s + r.net_weight_kg, 0)
        const totalBins = catRecords.reduce((s, r) => s + (r.bin_count || 1), 0)
        avgs[cat] = totalBins > 0 ? totalNet / totalBins : 0
      }
    }
    return avgs
  }, [todayRecords])

  // ── Next sequence number ──────────────────────────────────────────

  function getNextSeq(cat: Category): number {
    const catRecords = todayRecords.filter(r => r.category === cat)
    if (catRecords.length === 0) return 1
    return Math.max(...catRecords.map(r => r.seq)) + 1
  }

  // ── Computed ──────────────────────────────────────────────────────

  const tarePerBin = TARE_PER_BIN[binType]
  const totalTare = tarePerBin * binsOnScale
  const gross = parseFloat(grossWeight) || 0
  const netWeight = gross > totalTare ? gross - totalTare : 0
  const netPerBin = binsOnScale > 0 ? netWeight / binsOnScale : 0

  // ── Save ──────────────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedPackhouse || !grossWeight || gross <= totalTare) return

    setSaving(true)
    try {
      const orgId = localStorage.getItem('packshedweigh_org_id') || ''
      const userId = localStorage.getItem('packshedweigh_user_id') || ''
      const seq = getNextSeq(category)
      const id = `${selectedPackhouse}_${weighDate}_${category}_${seq}`

      const record: WeighRecord = {
        id,
        organisation_id: orgId,
        packhouse_id: selectedPackhouse,
        orchard_id: selectedOrchard || null,
        weigh_date: weighDate,
        seq,
        category,
        gross_weight_kg: gross,
        bin_type: binType,
        tare_weight_kg: totalTare,
        net_weight_kg: netWeight,
        bin_count: binsOnScale,
        weighed_by: userId || null,
        _syncStatus: 'pending',
      }

      const { weighSaveAndQueue } = await import('@/lib/packshed-weigh-sync')
      await weighSaveAndQueue(record)

      setGrossWeight('')
      await loadData()

      if (navigator.onLine) {
        const { weighPushPendingRecords } = await import('@/lib/packshed-weigh-sync')
        await weighPushPendingRecords()
        await refreshPendingCount()
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 1500)
    } catch (err) {
      console.error('[Weigh] Save error:', err)
    }
    setSaving(false)
  }

  // ── Sync ──────────────────────────────────────────────────────────

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const { weighPushPendingRecords, pullWeighReferenceData, pullTodayWeighRecords } = await import('@/lib/packshed-weigh-sync')
      await weighPushPendingRecords()
      await pullWeighReferenceData()
      await pullTodayWeighRecords()
      await loadData()
    } catch (err) {
      console.error('[Weigh] Sync error:', err)
    }
    setSyncing(false)
  }

  function handleLogout() {
    const keys = ['access_token', 'refresh_token', 'user_id', 'user_name', 'farm_id', 'farm_ids', 'org_id']
    keys.forEach(k => localStorage.removeItem(`packshedweigh_${k}`))
    window.location.href = '/packshed/weigh/login'
  }

  // ── Keypad handler ────────────────────────────────────────────────

  function handleKey(key: string) {
    if (key === 'back') {
      setGrossWeight(prev => prev.slice(0, -1))
    } else if (key === '.') {
      if (!grossWeight.includes('.')) setGrossWeight(prev => prev + '.')
    } else if (key === '0' && grossWeight === '0') {
      // no leading double zero
    } else {
      setGrossWeight(prev => prev + key)
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // WEIGH VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === 'weigh') {
    return (
      <div className="flex flex-col h-dvh bg-[#eae6df] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">Weigh Bin</div>
            <div className="text-xs text-[#8a95a0]">{userName}</div>
          </div>
          <button
            className="text-sm text-[#8a95a0] px-3 py-1.5 rounded-lg border border-[#d4cfca] bg-white"
            onClick={() => setView('home')}
          >Cancel</button>
        </div>

        {/* Date picker */}
        <div className="px-4 pb-2">
          <input
            className="w-full px-3 py-2 rounded-lg border border-[#d4cfca] text-sm text-[#1a2a3a] bg-white"
            type="date"
            value={weighDate}
            onChange={e => setWeighDate(e.target.value)}
          />
        </div>

        {/* Category toggle */}
        <div className="flex gap-1.5 px-4 pb-2">
          {(['pack', 'juice', 'rot'] as Category[]).map(cat => (
            <button
              key={cat}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-center uppercase ${
                category === cat
                  ? cat === 'pack' ? 'bg-[#2176d9] text-white'
                    : cat === 'juice' ? 'bg-[#e6a817] text-white'
                    : 'bg-[#e85a4a] text-white'
                  : 'bg-white text-[#5a6a60] border border-[#d4cfca]'
              }`}
              onClick={() => { setCategory(cat); setBinsOnScale(DEFAULT_BIN_COUNT[cat]) }}
            >
              {cat} ({countByCategory[cat]})
            </button>
          ))}
        </div>

        {/* Bin type + count */}
        <div className="flex gap-1.5 px-4 pb-2">
          {(['plastic', 'wood'] as const).map(bt => (
            <button
              key={bt}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold text-center ${
                binType === bt
                  ? 'bg-[#1a2a3a] text-white'
                  : 'bg-white text-[#5a6a60] border border-[#d4cfca]'
              }`}
              onClick={() => setBinType(bt)}
            >
              {bt === 'plastic' ? `Plastic (${TARE_PER_BIN.plastic}kg)` : `Wood (${TARE_PER_BIN.wood}kg)`}
            </button>
          ))}
        </div>

        {/* Bins on scale */}
        <div className="flex gap-1.5 px-4 pb-2">
          <div className="text-xs font-semibold text-[#8a95a0] uppercase self-center mr-2">Bins on scale:</div>
          {[1, 2, 3].map(n => (
            <button
              key={n}
              className={`w-12 py-2 rounded-lg text-sm font-bold text-center ${
                binsOnScale === n
                  ? 'bg-[#2176d9] text-white'
                  : 'bg-white text-[#5a6a60] border border-[#d4cfca]'
              }`}
              onClick={() => setBinsOnScale(n)}
            >{n}</button>
          ))}
          <div className="flex-1" />
          <div className="text-xs text-[#8a95a0] self-center">
            Tare: {totalTare}kg ({binsOnScale}x{tarePerBin}kg)
          </div>
        </div>

        {/* Orchard selector */}
        <div className="px-4 pb-2">
          <select
            className="w-full px-3 py-2.5 rounded-lg border border-[#d4cfca] text-sm text-[#1a2a3a] bg-white"
            value={selectedOrchard}
            onChange={e => setSelectedOrchard(e.target.value)}
          >
            <option value="">-- Orchard (optional) --</option>
            {orchards.map(o => (
              <option key={o.id} value={o.id}>
                {o.orchard_nr ? `${o.orchard_nr} – ` : ''}{o.name}
              </option>
            ))}
          </select>
        </div>

        {/* Weight display */}
        <div className="px-4 pb-2">
          <div className="bg-white rounded-xl border-2 border-[#d4cfca] py-3 text-center">
            <div className="text-xs font-semibold text-[#8a95a0] uppercase mb-1">Gross Weight</div>
            <div className="text-5xl font-extrabold text-[#1a2a3a] tabular-nums flex items-center justify-center">
              {grossWeight || <span className="text-[#d4cfca]">0</span>}
              <span className="text-base font-normal text-[#8a95a0] ml-2">kg</span>
            </div>
            {gross > 0 && (
              <div className="mt-1 text-sm text-[#8a95a0]">
                Net: <span className="font-bold text-[#2176d9]">{netWeight.toFixed(1)} kg</span>
                {binsOnScale > 1 && (
                  <span className="ml-2">= <span className="font-bold text-[#1a2a3a]">{netPerBin.toFixed(1)} kg/bin</span></span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Success flash */}
        {saveSuccess && (
          <div className="mx-4 mb-1 bg-green-50 border-2 border-green-300 rounded-xl px-3 py-2 text-center text-green-700 text-base font-bold">
            Bin #{getNextSeq(category) - 1} saved!
          </div>
        )}

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
            disabled={saving || !grossWeight || gross <= totalTare}
          >
            {saving ? 'Saving...' : `Save ${category.charAt(0).toUpperCase() + category.slice(1)} Bin`}
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // HISTORY VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === 'history') {
    const grouped: Record<Category, WeighRecord[]> = { pack: [], juice: [], rot: [] }
    for (const r of todayRecords) {
      grouped[r.category].push(r)
    }

    return (
      <div className="flex flex-col h-dvh bg-[#eae6df] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">Today&apos;s Bins</div>
            <div className="text-xs text-[#8a95a0]">{packhouses.find(p => p.id === selectedPackhouse)?.name}</div>
          </div>
          <button
            className="text-sm text-[#8a95a0] px-3 py-1.5 rounded-lg border border-[#d4cfca] bg-white"
            onClick={() => setView('home')}
          >Back</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {(['pack', 'juice', 'rot'] as Category[]).map(cat => {
            const catRecords = grouped[cat]
            if (catRecords.length === 0) return null
            const total = catRecords.reduce((s, r) => s + r.net_weight_kg, 0)
            const totalBins = catRecords.reduce((s, r) => s + (r.bin_count || 1), 0)
            const avgPerBin = totalBins > 0 ? total / totalBins : 0

            return (
              <div key={cat} className="bg-white rounded-xl border border-[#e8e4dc]">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="text-sm font-bold uppercase text-[#1a2a3a]">
                    {cat} <span className="text-[#8a95a0] font-normal">({totalBins} bins)</span>
                  </div>
                  <div className="text-xs text-[#8a95a0]">
                    Avg: <span className="font-bold text-[#2176d9]">{avgPerBin.toFixed(1)}kg/bin</span> | Total: {total.toFixed(0)}kg
                  </div>
                </div>
                {catRecords.map(r => {
                  const perBin = r.bin_count > 1 ? r.net_weight_kg / r.bin_count : r.net_weight_kg
                  return (
                    <div key={r.id} className="flex items-center justify-between px-4 py-2.5 border-t border-[#f0ede8]">
                      <div>
                        <span className="text-sm font-medium text-[#1a2a3a]">#{r.seq}</span>
                        <span className="text-xs text-[#8a95a0] ml-2">{r.bin_type}</span>
                        {r.bin_count > 1 && <span className="text-xs text-[#8a95a0] ml-1">({r.bin_count} bins)</span>}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#1a2a3a]">
                          {perBin.toFixed(1)} <span className="text-xs font-normal text-[#8a95a0]">kg/bin</span>
                        </div>
                        <div className="text-[10px] text-[#8a95a0]">{r.gross_weight_kg} gross - {r.tare_weight_kg} tare = {r.net_weight_kg.toFixed(1)} net</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {todayRecords.length === 0 && (
            <div className="text-center text-[#8a95a0] py-12">No bins weighed today</div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // HOME VIEW
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-dvh bg-[#eae6df] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div>
          <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">allFarm Weigh</div>
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

      {/* Packhouse selector */}
      {packhouses.length > 1 && (
        <div className="flex gap-2 px-4 pb-4">
          {packhouses.map(p => (
            <button
              key={p.id}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-center transition-colors ${
                selectedPackhouse === p.id
                  ? 'bg-[#2176d9] text-white'
                  : 'bg-white text-[#5a6a60] border border-[#d4cfca]'
              }`}
              onClick={() => setSelectedPackhouse(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 px-4 pb-4">
        {(['pack', 'juice', 'rot'] as Category[]).map(cat => {
          const colors = { pack: '#2176d9', juice: '#e6a817', rot: '#e85a4a' }
          return (
            <div key={cat} className="bg-white rounded-xl border border-[#e8e4dc] p-3 text-center">
              <div className="text-[10px] font-semibold text-[#8a95a0] uppercase tracking-wider mb-1">{cat}</div>
              <div className="text-3xl font-extrabold" style={{ color: colors[cat] }}>
                {countByCategory[cat]}
              </div>
              <div className="text-[10px] text-[#8a95a0] mt-0.5">bins</div>
              {avgByCategory[cat] && (
                <div className="text-xs text-[#8a95a0] mt-1">
                  Avg <span className="font-bold">{avgByCategory[cat]!.toFixed(1)}</span>kg
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* History button */}
      <div className="px-4 pb-3">
        <button
          className="w-full bg-white text-[#1a2a3a] text-sm font-semibold py-3 rounded-xl border border-[#e8e4dc] active:bg-[#f0ede8]"
          onClick={() => setView('history')}
        >
          View Today&apos;s History ({todayRecords.length} bins)
        </button>
      </div>

      <div className="flex-1" />

      {/* Big Weigh button */}
      <div className="px-4 pb-6">
        <button
          className="w-full bg-[#2176d9] text-white text-xl font-bold py-5 rounded-xl active:bg-[#1a65c0] transition-colors shadow-lg"
          onClick={() => {
            setGrossWeight('')
            setSaveSuccess(false)
            setView('weigh')
          }}
        >
          Weigh Bin
        </button>
      </div>

      {/* Sign out */}
      <div className="text-center pb-4">
        <button className="text-xs text-[#8a95a0]" onClick={handleLogout}>Sign out</button>
      </div>
    </div>
  )
}

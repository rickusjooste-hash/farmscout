'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { JuicePackhouse, JuiceOrchard, JuiceDefectType, JuiceSample, JuiceDefectCount } from '@/lib/packshed-juice-db'

type View = 'home' | 'sample' | 'history'

// Defect types are pulled from commodity_pests (QC issues) — same as QC bag sampling

export default function PackshedJuicePage() {
  const [view, setView] = useState<View>('home')
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [userName, setUserName] = useState('')

  // Reference data
  const [packhouses, setPackhouses] = useState<JuicePackhouse[]>([])
  const [orchards, setOrchards] = useState<JuiceOrchard[]>([])
  const [defectTypes, setDefectTypes] = useState<JuiceDefectType[]>([])
  const [samples, setSamples] = useState<JuiceSample[]>([])

  // Selectors
  const [selectedPackhouse, setSelectedPackhouse] = useState('')

  // Language (default Afrikaans)
  const [lang, setLang] = useState<'af' | 'en'>('af')

  // Sample form state
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedOrchard, setSelectedOrchard] = useState('')
  const [defectCounts, setDefectCounts] = useState<JuiceDefectCount[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Init ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    setUserName(localStorage.getItem('packshedjuice_user_name') || '')

    if (!localStorage.getItem('packshedjuice_access_token')) {
      window.location.href = '/packshed/juice/login'
      return
    }

    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    loadData()

    const syncOnline = async () => {
      const { juicePushPendingRecords } = await import('@/lib/packshed-juice-sync')
      await juicePushPendingRecords()
      await refreshPendingCount()
    }
    window.addEventListener('online', syncOnline)

    const interval = setInterval(async () => {
      if (!navigator.onLine) return
      const { juicePushPendingRecords } = await import('@/lib/packshed-juice-sync')
      await juicePushPendingRecords()
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
      const { juiceGetAll } = await import('@/lib/packshed-juice-db')
      const [allPackhouses, allOrchards, allDefects, allSamples] = await Promise.all([
        juiceGetAll('packhouses'),
        juiceGetAll('orchards'),
        juiceGetAll('defect_types'),
        juiceGetAll('juice_samples'),
      ])
      setPackhouses(allPackhouses)
      setOrchards(allOrchards)
      setDefectTypes(allDefects)
      setSamples(allSamples.sort((a, b) => b.sample_date.localeCompare(a.sample_date)))

      if (allPackhouses.length > 0 && !selectedPackhouse) {
        setSelectedPackhouse(allPackhouses[0].id)
      }
    } catch {
      setPackhouses([])
      setOrchards([])
      setDefectTypes([])
      setSamples([])
    }
    await refreshPendingCount()
  }, [selectedPackhouse])

  const refreshPendingCount = async () => {
    const { countPendingJuiceSamples } = await import('@/lib/packshed-juice-sync')
    setPendingCount(await countPendingJuiceSamples())
  }

  // ── Filter defects to juice-relevant ones ─────────────────────────

  // Show all defect types — user counts only the ones that apply
  const activeDefects = defectTypes

  // ── Today's data ──────────────────────────────────────────────────

  const todaySamples = useMemo(() => {
    return samples.filter(s => s.sample_date === sampleDate && s.packhouse_id === selectedPackhouse)
  }, [samples, sampleDate, selectedPackhouse])

  // ── Initialize defect form ────────────────────────────────────────

  function defectLabel(d: JuiceDefectType): string {
    return lang === 'af' ? (d.name_af || d.name) : d.name
  }

  function initDefectForm() {
    setDefectCounts(
      activeDefects.map(d => ({ pest_id: d.pest_id, name: d.name, count: 0 }))
    )
  }

  function updateDefectCount(pestId: string, delta: number) {
    setDefectCounts(prev =>
      prev.map(d =>
        d.pest_id === pestId
          ? { ...d, count: Math.max(0, d.count + delta) }
          : d
      )
    )
  }

  // ── Save sample ───────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedPackhouse || !selectedOrchard) {
      if (!selectedOrchard) alert('Select an orchard first')
      return
    }

    const totalDefectsCount = defectCounts.reduce((s, d) => s + d.count, 0)
    if (totalDefectsCount === 0) return

    setSaving(true)
    try {
      const orgId = localStorage.getItem('packshedjuice_org_id') || ''
      const userId = localStorage.getItem('packshedjuice_user_id') || ''
      const id = crypto.randomUUID()

      const sample: JuiceSample = {
        id,
        organisation_id: orgId,
        packhouse_id: selectedPackhouse,
        orchard_id: selectedOrchard || null,
        sample_date: sampleDate,
        sample_size: totalDefectsCount,
        sampled_by: userId || null,
        notes,
        defects: defectCounts,
        _syncStatus: 'pending',
      }

      const { juiceSaveAndQueue } = await import('@/lib/packshed-juice-sync')
      await juiceSaveAndQueue(sample)

      setNotes('')
      initDefectForm()
      await loadData()

      if (navigator.onLine) {
        const { juicePushPendingRecords } = await import('@/lib/packshed-juice-sync')
        await juicePushPendingRecords()
        await refreshPendingCount()
      }

      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        setView('home')
      }, 1200)
    } catch (err) {
      console.error('[Juice] Save error:', err)
    }
    setSaving(false)
  }

  // ── Sync ──────────────────────────────────────────────────────────

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const { juicePushPendingRecords, pullJuiceReferenceData } = await import('@/lib/packshed-juice-sync')
      await juicePushPendingRecords()
      await pullJuiceReferenceData()
      await loadData()
    } catch (err) {
      console.error('[Juice] Sync error:', err)
    }
    setSyncing(false)
  }

  function handleLogout() {
    const keys = ['access_token', 'refresh_token', 'user_id', 'user_name', 'farm_id', 'farm_ids', 'org_id']
    keys.forEach(k => localStorage.removeItem(`packshedjuice_${k}`))
    window.location.href = '/packshed/juice/login'
  }

  // ═══════════════════════════════════════════════════════════════════
  // SAMPLE VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === 'sample') {
    const totalDefects = defectCounts.reduce((s, d) => s + d.count, 0)

    return (
      <div className="flex flex-col h-dvh bg-[#eae6df] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">New Sample</div>
            <div className="text-xs text-[#8a95a0]">{userName}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`text-xs px-2 py-1 rounded ${lang === 'af' ? 'bg-[#2176d9] text-white' : 'bg-white text-[#8a95a0] border border-[#d4cfca]'}`}
              onClick={() => setLang('af')}
            >AF</button>
            <button
              className={`text-xs px-2 py-1 rounded ${lang === 'en' ? 'bg-[#2176d9] text-white' : 'bg-white text-[#8a95a0] border border-[#d4cfca]'}`}
              onClick={() => setLang('en')}
            >EN</button>
            <button
              className="text-sm text-[#8a95a0] px-3 py-1.5 rounded-lg border border-[#d4cfca] bg-white"
              onClick={() => setView('home')}
            >Cancel</button>
          </div>
        </div>

        {/* Date picker */}
        <div className="px-4 pb-2">
          <input
            className="w-full px-3 py-2 rounded-lg border border-[#d4cfca] text-sm text-[#1a2a3a] bg-white"
            type="date"
            value={sampleDate}
            onChange={e => setSampleDate(e.target.value)}
          />
        </div>

        {/* Orchard selector */}
        <div className="px-4 pb-2">
          <select
            className={`w-full px-3 py-2.5 rounded-lg border text-sm text-[#1a2a3a] bg-white ${selectedOrchard ? 'border-[#d4cfca]' : 'border-[#e85a4a]'}`}
            value={selectedOrchard}
            onChange={e => setSelectedOrchard(e.target.value)}
          >
            <option value="">-- Kies Boord / Select Orchard --</option>
            {orchards.map(o => (
              <option key={o.id} value={o.id}>
                {o.orchard_nr != null ? `${o.orchard_nr} ` : ''}{o.name}{o.variety ? ` (${o.variety})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Total count */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <div className="text-sm text-[#8a95a0]">
            Totaal: <span className="font-bold text-[#1a2a3a] text-lg">{totalDefects}</span> vrugte
          </div>
        </div>

        {/* Defect counter grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          <div className="space-y-1.5">
            {defectCounts.map(d => (
              <div key={d.pest_id} className="flex items-center bg-white rounded-xl border border-[#e8e4dc] px-4 py-3">
                <div className="flex-1 text-sm font-medium text-[#1a2a3a]">{
                  (() => {
                    const dt = activeDefects.find(ad => ad.pest_id === d.pest_id)
                    return dt ? defectLabel(dt) : d.name
                  })()
                }</div>
                <div className="flex items-center gap-3">
                  <button
                    className="w-10 h-10 rounded-full bg-[#f0ede8] text-lg font-bold text-[#8a95a0] active:bg-[#e0ddd8]"
                    onClick={() => updateDefectCount(d.pest_id, -1)}
                  >-</button>
                  <span className="w-8 text-center text-xl font-bold text-[#1a2a3a] tabular-nums">{d.count}</span>
                  <button
                    className="w-10 h-10 rounded-full bg-[#2176d9] text-lg font-bold text-white active:bg-[#1a65c0]"
                    onClick={() => updateDefectCount(d.pest_id, 1)}
                  >+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="mt-3">
            <textarea
              className="w-full px-3 py-2.5 rounded-lg border border-[#d4cfca] text-sm text-[#1a2a3a] bg-white resize-none"
              rows={2}
              placeholder="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Success flash */}
        {saveSuccess && (
          <div className="mx-4 mb-1 bg-green-50 border-2 border-green-300 rounded-xl px-3 py-2 text-center text-green-700 text-base font-bold">
            Sample saved!
          </div>
        )}

        {/* Save button */}
        <div className="px-4 pb-4">
          <button
            className="w-full bg-[#2176d9] text-white text-lg font-bold py-4 rounded-xl disabled:opacity-50 active:bg-[#1a65c0]"
            onClick={handleSave}
            disabled={saving || totalDefects === 0 || !selectedOrchard}
          >
            {saving ? 'Saving...' : `Save Sample (${totalDefects} fruit)`}
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // HISTORY VIEW
  // ═══════════════════════════════════════════════════════════════════

  if (view === 'history') {
    return (
      <div className="flex flex-col h-dvh bg-[#eae6df] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">Today&apos;s Samples</div>
            <div className="text-xs text-[#8a95a0]">{packhouses.find(p => p.id === selectedPackhouse)?.name}</div>
          </div>
          <button
            className="text-sm text-[#8a95a0] px-3 py-1.5 rounded-lg border border-[#d4cfca] bg-white"
            onClick={() => setView('home')}
          >Back</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {todaySamples.length === 0 && (
            <div className="text-center text-[#8a95a0] py-12">No samples today</div>
          )}

          {todaySamples.map((s, idx) => {
            const totalDef = s.defects.reduce((sum, d) => sum + d.count, 0)
            const orchardName = orchards.find(o => o.id === s.orchard_id)?.name

            return (
              <div key={s.id} className="bg-white rounded-xl border border-[#e8e4dc] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-[#1a2a3a]">
                    Sample #{idx + 1}
                    {orchardName && <span className="text-[#8a95a0] font-normal ml-2">{orchardName}</span>}
                  </div>
                  <div className="text-sm font-bold text-[#1a2a3a]">
                    {totalDef} fruit
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.defects.filter(d => d.count > 0).map(d => (
                    <span key={d.pest_id} className="text-xs bg-[#f0ede8] rounded-full px-2.5 py-1 text-[#5a6a60]">
                      {d.name}: {d.count}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
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
          <div className="text-2xl font-extrabold text-[#2176d9] tracking-wide">allFarm Juice</div>
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

      {/* KPI */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl border border-[#e8e4dc] p-4 text-center">
          <div className="text-xs font-semibold text-[#8a95a0] uppercase tracking-wider mb-2">Today&apos;s Samples</div>
          <div className="text-4xl font-extrabold text-[#2176d9]">
            {todaySamples.length}
          </div>
        </div>
      </div>

      {/* History button */}
      {todaySamples.length > 0 && (
        <div className="px-4 pb-3">
          <button
            className="w-full bg-white text-[#1a2a3a] text-sm font-semibold py-3 rounded-xl border border-[#e8e4dc] active:bg-[#f0ede8]"
            onClick={() => setView('history')}
          >
            View Today&apos;s History
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* Big New Sample button */}
      <div className="px-4 pb-6">
        <button
          className="w-full bg-[#2176d9] text-white text-xl font-bold py-5 rounded-xl active:bg-[#1a65c0] transition-colors shadow-lg"
          onClick={() => {
            setSelectedOrchard('')
            setNotes('')
            initDefectForm()
            setSaveSuccess(false)
            setView('sample')
          }}
        >
          New Sample
        </button>
      </div>

      {/* Sign out */}
      <div className="text-center pb-4">
        <button className="text-xs text-[#8a95a0]" onClick={handleLogout}>Sign out</button>
      </div>
    </div>
  )
}

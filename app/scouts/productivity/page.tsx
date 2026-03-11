'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import ScoutProductivityTable from '@/app/components/ScoutProductivityTable'
import ScoutProductivityDetail from '@/app/components/ScoutProductivityDetail'
import type { DailyRow, WeeklyRow, QualityFlag } from '@/app/components/ScoutProductivityTable'

// ── ISO week helpers ───────────────────────────────────────────────────────

function currentISOWeek(): { year: number; week: number } {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

function isoWeekRange(year: number, week: number): { from: Date; to: Date } {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const weekStart = new Date(jan4.getTime() - (dow - 1) * 86400000 + (week - 1) * 7 * 86400000)
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
  return { from: weekStart, to: weekEnd }
}

function weekLabel(year: number, week: number): string {
  const { from, to } = isoWeekRange(year, week)
  const toDay = new Date(to.getTime() - 86400000)
  const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `W${week} · ${fmt(from)} – ${fmt(toDay)}`
}

function prevWeek(year: number, week: number) {
  return week === 1 ? { year: year - 1, week: 52 } : { year, week: week - 1 }
}

function nextWeek(year: number, week: number) {
  return week === 52 ? { year: year + 1, week: 1 } : { year, week: week + 1 }
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm {
  id: string
  full_name: string
  code: string
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ScoutProductivityPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, orgId } = useUserContext()

  const [farms, setFarms] = useState<Farm[]>([])
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)

  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const { year: curYear, week: curWeek } = currentISOWeek()
  const [weekYear, setWeekYear] = useState(curYear)
  const [weekNum, setWeekNum] = useState(curWeek)

  const [dailyData, setDailyData] = useState<DailyRow[]>([])
  const [weeklyData, setWeeklyData] = useState<WeeklyRow[]>([])
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(null)
  const [modules, setModules] = useState<string[]>(['farmscout'])

  // Active farm filter
  const activeFarmIds = useMemo(() => {
    if (selectedFarmId) return [selectedFarmId]
    return effectiveFarmIds
  }, [selectedFarmId, effectiveFarmIds])

  // ── Load farms ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    ;(async () => {
      let q = supabase.from('farms').select('id, full_name, code').eq('is_active', true).order('full_name')
      if (!isSuperAdmin && farmIds.length > 0) q = q.in('id', farmIds)
      const { data } = await q
      const farmList = (data || []) as Farm[]
      setFarms(farmList)
      setEffectiveFarmIds(farmList.map(f => f.id))
    })()
  }, [contextLoaded])

  // ── Load modules ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!orgId) return
    ;(async () => {
      const { data } = await supabase
        .from('organisation_modules')
        .select('module')
        .eq('organisation_id', orgId)
      if (data) setModules(data.map((d: any) => d.module))
    })()
  }, [orgId])

  // ── Load data ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeFarmIds.length) return
    ;(async () => {
      setLoading(true)
      setSelectedScoutId(null)

      try {
        if (mode === 'day') {
          const [dailyRes, flagsRes] = await Promise.all([
            supabase.rpc('get_scout_daily_productivity', {
              p_farm_ids: activeFarmIds,
              p_from: selectedDate,
              p_to: selectedDate,
            }),
            supabase.rpc('get_scout_quality_flags', {
              p_farm_ids: activeFarmIds,
              p_from: selectedDate,
              p_to: selectedDate,
            }),
          ])
          if (!dailyRes.error) setDailyData(dailyRes.data || [])
          if (!flagsRes.error) setQualityFlags(flagsRes.data || [])
        } else {
          const { from, to } = isoWeekRange(weekYear, weekNum)
          const fromStr = from.toISOString().split('T')[0]
          const toStr = new Date(to.getTime() - 86400000).toISOString().split('T')[0]

          const [dailyRes, weeklyRes, flagsRes] = await Promise.all([
            supabase.rpc('get_scout_daily_productivity', {
              p_farm_ids: activeFarmIds,
              p_from: fromStr,
              p_to: toStr,
            }),
            supabase.rpc('get_scout_weekly_summary', {
              p_farm_ids: activeFarmIds,
              p_weeks: 8,
            }),
            supabase.rpc('get_scout_quality_flags', {
              p_farm_ids: activeFarmIds,
              p_from: fromStr,
              p_to: toStr,
            }),
          ])
          if (!dailyRes.error) setDailyData(dailyRes.data || [])
          if (!weeklyRes.error) setWeeklyData(weeklyRes.data || [])
          if (!flagsRes.error) setQualityFlags(flagsRes.data || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [activeFarmIds, mode, selectedDate, weekYear, weekNum])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handlePrevWeek = () => {
    const p = prevWeek(weekYear, weekNum)
    setWeekYear(p.year)
    setWeekNum(p.week)
  }

  const handleNextWeek = () => {
    if (weekYear === curYear && weekNum >= curWeek) return
    const n = nextWeek(weekYear, weekNum)
    setWeekYear(n.year)
    setWeekNum(n.week)
  }

  const handlePrevDay = () => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() - 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleNextDay = () => {
    if (selectedDate >= todayStr()) return
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + 1)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const handleSelectScout = (scoutId: string) => {
    setSelectedScoutId(prev => prev === scoutId ? null : scoutId)
  }

  const selectedScoutName = useMemo(() => {
    const row = dailyData.find(d => d.scout_id === selectedScoutId)
      || weeklyData.find(w => w.scout_id === selectedScoutId)
    return row?.scout_name || 'Unknown'
  }, [selectedScoutId, dailyData, weeklyData])

  if (!contextLoaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#8a95a0' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="sprod-app">
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />
      <MobileNav />

      <main className="sprod-main">
        {/* Top bar */}
        <div className="sprod-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <h1 className="sprod-title">Scout Productivity</h1>

            {/* Mode toggle */}
            <div className="sprod-toggle">
              <button
                className={`sprod-toggle-btn${mode === 'day' ? ' active' : ''}`}
                onClick={() => setMode('day')}
              >Day</button>
              <button
                className={`sprod-toggle-btn${mode === 'week' ? ' active' : ''}`}
                onClick={() => setMode('week')}
              >Week</button>
            </div>

            {/* Date navigation */}
            {mode === 'day' ? (
              <div className="sprod-nav">
                <button className="sprod-nav-btn" onClick={handlePrevDay}>‹</button>
                <span className="sprod-nav-label">
                  {new Date(selectedDate).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <button className="sprod-nav-btn" onClick={handleNextDay} disabled={selectedDate >= todayStr()}>›</button>
                {selectedDate !== todayStr() && (
                  <button className="sprod-pill active" onClick={() => setSelectedDate(todayStr())}>Today</button>
                )}
              </div>
            ) : (
              <div className="sprod-nav">
                <button className="sprod-nav-btn" onClick={handlePrevWeek}>‹</button>
                <span className="sprod-nav-label">{weekLabel(weekYear, weekNum)}</span>
                <button className="sprod-nav-btn" onClick={handleNextWeek} disabled={weekYear === curYear && weekNum >= curWeek}>›</button>
                {(weekYear !== curYear || weekNum !== curWeek) && (
                  <button className="sprod-pill active" onClick={() => { setWeekYear(curYear); setWeekNum(curWeek) }}>This week</button>
                )}
              </div>
            )}
          </div>

          {/* Scouts link */}
          <a href="/scouts" className="sprod-link">← Route Manager</a>
        </div>

        {/* Farm filter pills */}
        {farms.length > 1 && (
          <div className="sprod-pills">
            <button
              className={`sprod-pill${!selectedFarmId ? ' active' : ''}`}
              onClick={() => setSelectedFarmId(null)}
            >All Farms</button>
            {farms.map(f => (
              <button
                key={f.id}
                className={`sprod-pill${selectedFarmId === f.id ? ' active' : ''}`}
                onClick={() => setSelectedFarmId(selectedFarmId === f.id ? null : f.id)}
              >{f.code || f.full_name}</button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="sprod-card">
          {loading ? (
            <div className="sprod-loading">
              <div className="sprod-shimmer" />
              <div className="sprod-shimmer" style={{ width: '60%' }} />
              <div className="sprod-shimmer" style={{ width: '80%' }} />
            </div>
          ) : selectedScoutId ? (
            <ScoutProductivityDetail
              scoutId={selectedScoutId}
              scoutName={selectedScoutName}
              day={mode === 'day' ? selectedDate : isoWeekRange(weekYear, weekNum).from.toISOString().split('T')[0]}
              dailyData={dailyData}
              weeklyData={weeklyData}
              qualityFlags={qualityFlags}
              supabase={supabase}
              onClose={() => setSelectedScoutId(null)}
            />
          ) : (
            <ScoutProductivityTable
              dailyData={dailyData}
              weeklyData={weeklyData}
              qualityFlags={qualityFlags}
              mode={mode}
              selectedDate={selectedDate}
              onSelectScout={handleSelectScout}
              selectedScoutId={selectedScoutId}
            />
          )}
        </div>

        {/* Statistical caveats */}
        <div className="sprod-caveats">
          <strong>Notes:</strong> Flags are auto-detected and may have false positives.
          GPS accuracy under tree canopy is 10-50m.
          Days with &lt;10 inspections are marked as small samples.
          Rebaited traps are excluded from speed calculations.
        </div>
      </main>

      <style>{`
        .sprod-app {
          display: flex;
          min-height: 100vh;
          font-family: 'Inter', sans-serif;
          background: #f4f1ea;
        }
        .sprod-main {
          flex: 1;
          padding: 32px 40px 60px;
          max-width: 1200px;
        }
        .sprod-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .sprod-title {
          font-size: 22px;
          font-weight: 700;
          color: #1a2a3a;
          margin: 0;
        }
        .sprod-link {
          font-size: 13px;
          color: #2176d9;
          text-decoration: none;
        }
        .sprod-link:hover { text-decoration: underline; }
        .sprod-toggle {
          display: flex;
          background: #fff;
          border-radius: 8px;
          border: 1px solid #e8e4dc;
          overflow: hidden;
        }
        .sprod-toggle-btn {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          border: none;
          background: none;
          color: #8a95a0;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .sprod-toggle-btn.active {
          background: #1a4ba0;
          color: #a0c4f0;
        }
        .sprod-nav {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sprod-nav-btn {
          background: #fff;
          border: 1px solid #e8e4dc;
          border-radius: 6px;
          width: 28px;
          height: 28px;
          font-size: 16px;
          cursor: pointer;
          color: #1a2a3a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
        }
        .sprod-nav-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }
        .sprod-nav-btn:hover:not(:disabled) { background: #f9f7f3; }
        .sprod-nav-label {
          font-size: 13px;
          font-weight: 600;
          color: #1a2a3a;
          min-width: 120px;
          text-align: center;
        }
        .sprod-pills {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }
        .sprod-pill {
          padding: 4px 12px;
          border-radius: 20px;
          border: 1.5px solid #e8e4dc;
          background: #fff;
          font-size: 12px;
          font-weight: 500;
          color: #6a7a70;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .sprod-pill:hover { border-color: #2176d9; }
        .sprod-pill.active {
          background: #1a4ba0;
          color: #a0c4f0;
          border-color: #1a4ba0;
        }
        .sprod-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e4dc;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }
        .sprod-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #2176d9, #a0c4f0);
        }
        .sprod-loading {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
        }
        .sprod-shimmer {
          height: 16px;
          background: linear-gradient(90deg, #eef2fa 25%, #fafaf8 50%, #eef2fa 75%);
          background-size: 200% 100%;
          animation: sprod-pulse 1.5s ease-in-out infinite;
          border-radius: 4px;
        }
        @keyframes sprod-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .sprod-caveats {
          margin-top: 16px;
          padding: 12px 16px;
          background: #fafaf8;
          border-radius: 8px;
          font-size: 11px;
          color: #8a95a0;
          line-height: 1.5;
        }
        @media (max-width: 768px) {
          .sprod-main {
            padding: 16px 14px 80px;
          }
          .sprod-title { font-size: 18px; }
          .sprod-topbar { flex-direction: column; align-items: flex-start; }
          .sprod-card { padding: 12px; }
        }
      `}</style>
    </div>
  )
}

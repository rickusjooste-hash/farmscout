'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import RainMetricCards from '@/app/components/rainfall/RainMetricCards'
import RainHeatmap from '@/app/components/rainfall/RainHeatmap'
import SeasonalWheel from '@/app/components/rainfall/SeasonalWheel'
import GaugeComparison from '@/app/components/rainfall/GaugeComparison'
import DryStreakMeter from '@/app/components/rainfall/DryStreakMeter'
import SeasonBudgetTracker from '@/app/components/rainfall/SeasonBudgetTracker'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtMm = (v: any) => `${v} mm`

// ── Types ──────────────────────────────────────────────────────────────────

interface Farm { id: string; code: string; name: string }
interface Gauge { id: string; farm_id: string; name: string }
interface Reading { gauge_id: string; reading_date: string; value_mm: number }

interface Season {
  label: string
  startDate: string
  endDate: string
  year: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const GAUGE_COLORS: Record<string, string> = {
  "Mouton's Valley": '#2176d9',
  'Stawelklip': '#4caf72',
  'MorningSide': '#e8924a',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getCurrentSeason(): Season {
  const yr = new Date().getFullYear()
  return {
    label: `${yr}`,
    startDate: `${yr}-01-01`,
    endDate: `${yr}-12-31`,
    year: yr,
  }
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function isMonthlyReading(r: Reading): boolean {
  const d = new Date(r.reading_date + 'T00:00:00')
  return d.getDate() === 1 && d.getFullYear() < 2024
}

function seasonWeek(date: Date, year: number): number {
  const start = new Date(year, 0, 1) // Jan 1
  const diff = Math.floor((date.getTime() - start.getTime()) / 86400000)
  if (diff < 0) return 0
  return Math.min(52, Math.floor(diff / 7) + 1)
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RainfallPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()
  const season = getCurrentSeason()

  const [farms, setFarms] = useState<Farm[]>([])
  const [effectiveFarmIds, setEffectiveFarmIds] = useState<string[]>([])
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null)

  const [gauges, setGauges] = useState<Gauge[]>([])
  const [selectedGauge, setSelectedGauge] = useState<string | null>(null)
  const [readings, setReadings] = useState<Reading[]>([])

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)

  // ── Load farms ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const supabase = createClient()
      if (farmIds.length === 0 && isSuperAdmin) {
        const { data } = await supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('code')
        const f = (data || []).map(d => ({ id: d.id, code: d.code, name: d.full_name }))
        setFarms(f)
        setEffectiveFarmIds(f.map(d => d.id))
      } else {
        const { data } = await supabase.from('farms').select('id, code, full_name').in('id', farmIds).order('code')
        const f = (data || []).map(d => ({ id: d.id, code: d.code, name: d.full_name }))
        setFarms(f)
        setEffectiveFarmIds(farmIds)
      }
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin])

  // ── Load gauges + readings (paginated) ─────────────────────────────────

  useEffect(() => {
    if (effectiveFarmIds.length === 0) return
    async function load() {
      const supabase = createClient()
      const { data: gData } = await supabase
        .from('rain_gauges')
        .select('id, farm_id, name')
        .in('farm_id', effectiveFarmIds)
        .eq('is_active', true)
        .order('name')
      setGauges(gData || [])

      if (!gData || gData.length === 0) return
      const gaugeIds = gData.map(g => g.id)
      let allReadings: Reading[] = []
      let page = 0
      while (true) {
        const { data: batch } = await supabase
          .from('rain_readings')
          .select('gauge_id, reading_date, value_mm')
          .in('gauge_id', gaugeIds)
          .order('reading_date')
          .range(page * 1000, (page + 1) * 1000 - 1)
        allReadings = [...allReadings, ...(batch || [])]
        if (!batch || batch.length < 1000) break
        page++
      }
      setReadings(allReadings)
    }
    load()
  }, [effectiveFarmIds])

  // ── Filtered data ──────────────────────────────────────────────────────

  const filteredGauges = useMemo(() => {
    let g = gauges
    if (selectedFarm) g = g.filter(x => x.farm_id === selectedFarm)
    if (selectedGauge) g = g.filter(x => x.id === selectedGauge)
    return g
  }, [gauges, selectedFarm, selectedGauge])

  const filteredGaugeIds = useMemo(() => new Set(filteredGauges.map(g => g.id)), [filteredGauges])

  const filteredReadings = useMemo(
    () => readings.filter(r => filteredGaugeIds.has(r.gauge_id)),
    [readings, filteredGaugeIds],
  )

  useEffect(() => { setSelectedGauge(null) }, [selectedFarm])

  const gaugeOptions = useMemo(() => {
    if (selectedFarm) return gauges.filter(g => g.farm_id === selectedFarm)
    return gauges
  }, [gauges, selectedFarm])

  // ── Season readings ────────────────────────────────────────────────────

  const seasonReadings = useMemo(
    () => filteredReadings.filter(r => r.reading_date >= season.startDate && r.reading_date <= season.endDate),
    [filteredReadings, season],
  )

  const hasDailyData = useMemo(
    () => seasonReadings.some(r => !isMonthlyReading(r)),
    [seasonReadings],
  )

  // ── Season total ───────────────────────────────────────────────────────

  const seasonTotal = useMemo(
    () => Math.round(seasonReadings.reduce((sum, r) => sum + r.value_mm, 0) * 10) / 10,
    [seasonReadings],
  )

  // ── Monthly medians (per calendar month, across all years) ─────────────

  const monthlyMedians = useMemo(() => {
    const byYearMonth: Record<string, number> = {}
    filteredReadings.forEach(r => {
      const d = new Date(r.reading_date + 'T00:00:00')
      const key = `${d.getFullYear()}-${d.getMonth()}`
      byYearMonth[key] = (byYearMonth[key] || 0) + r.value_mm
    })
    const monthValues: Record<number, number[]> = {}
    for (let m = 0; m < 12; m++) monthValues[m] = []
    Object.entries(byYearMonth).forEach(([key, total]) => {
      const m = parseInt(key.split('-')[1])
      monthValues[m].push(total)
    })
    return Array.from({ length: 12 }, (_, m) => ({
      month: MONTHS[m],
      median: Math.round(median(monthValues[m]) * 10) / 10,
    }))
  }, [filteredReadings])

  // ── Full season median (sum of 12 monthly medians) ─────────────────────

  const fullSeasonMedian = useMemo(
    () => monthlyMedians.reduce((sum, m) => sum + m.median, 0),
    [monthlyMedians],
  )

  // ── Median to date (prorated current month) ────────────────────────────

  const medianToDate = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    let total = 0
    for (let m = 0; m < 12; m++) {
      if (m === currentMonth) {
        const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate()
        total += monthlyMedians[m].median * (now.getDate() / daysInMonth)
        break
      }
      total += monthlyMedians[m].median
    }
    return Math.round(total * 10) / 10
  }, [monthlyMedians])

  // ── Last rain event ────────────────────────────────────────────────────

  const lastRainEvent = useMemo(() => {
    const withRain = filteredReadings.filter(r => r.value_mm > 0)
    if (withRain.length === 0) return null
    const last = withRain[withRain.length - 1]
    return {
      date: last.reading_date,
      mm: last.value_mm,
      daysAgo: Math.floor((Date.now() - new Date(last.reading_date + 'T00:00:00').getTime()) / 86400000),
    }
  }, [filteredReadings])

  // ── Wettest day this season (daily data only) ──────────────────────────

  const wettestDay = useMemo(() => {
    const daily = seasonReadings.filter(r => !isMonthlyReading(r))
    if (daily.length === 0) return null
    const max = daily.reduce((best, r) => r.value_mm > best.value_mm ? r : best, daily[0])
    return { date: max.reading_date, mm: max.value_mm }
  }, [seasonReadings])

  // ── Current dry streak (consecutive dry days from today backwards) ─────

  const currentDryDays = useMemo(() => {
    if (!hasDailyData) return 0
    // Find the most recent date with rain across all gauges
    const dailyTotals: Record<string, number> = {}
    filteredReadings
      .filter(r => !isMonthlyReading(r))
      .forEach(r => { dailyTotals[r.reading_date] = (dailyTotals[r.reading_date] || 0) + r.value_mm })
    const lastRainDate = Object.entries(dailyTotals)
      .filter(([, v]) => v > 0)
      .map(([d]) => d)
      .sort((a, b) => b.localeCompare(a))[0]
    if (!lastRainDate) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.floor((today.getTime() - new Date(lastRainDate + 'T00:00:00').getTime()) / 86400000)
    return Math.max(0, diff)
  }, [filteredReadings, hasDailyData])

  // ── Seasonal wheel data ────────────────────────────────────────────────

  const wheelData = useMemo(() => {
    const byYearMonth: Record<string, number> = {}
    const years = new Set<number>()
    filteredReadings.forEach(r => {
      const d = new Date(r.reading_date + 'T00:00:00')
      const key = `${d.getFullYear()}-${d.getMonth()}`
      byYearMonth[key] = (byYearMonth[key] || 0) + r.value_mm
      years.add(d.getFullYear())
    })
    const nYears = years.size || 1
    const avgByMonth = new Array(12).fill(0)
    Object.entries(byYearMonth).forEach(([key, total]) => {
      const m = parseInt(key.split('-')[1])
      avgByMonth[m] += total
    })
    for (let i = 0; i < 12; i++) avgByMonth[i] = Math.round((avgByMonth[i] / nYears) * 10) / 10

    const currentByMonth = new Array(12).fill(0)
    seasonReadings.forEach(r => {
      const m = new Date(r.reading_date + 'T00:00:00').getMonth()
      currentByMonth[m] += r.value_mm
    })

    return MONTHS.map((name, i) => ({
      month: name,
      average: avgByMonth[i],
      current: Math.round(currentByMonth[i] * 10) / 10,
    }))
  }, [filteredReadings, seasonReadings])

  const yearsOfData = useMemo(() => {
    const years = new Set<number>()
    filteredReadings.forEach(r => years.add(new Date(r.reading_date + 'T00:00:00').getFullYear()))
    return years.size
  }, [filteredReadings])

  // ── Available years (for year selector) ──────────────────────────────

  const availableYears = useMemo(() => {
    const ys = new Set<number>()
    filteredReadings.forEach(r => ys.add(new Date(r.reading_date + 'T00:00:00').getFullYear()))
    const sorted = Array.from(ys).sort((a, b) => b - a)
    return sorted.length > 0 ? sorted : [currentYear]
  }, [filteredReadings, currentYear])

  // Ensure selectedYear is valid
  useEffect(() => {
    if (!availableYears.includes(selectedYear)) setSelectedYear(availableYears[0])
  }, [availableYears, selectedYear])

  // ── Year readings ──────────────────────────────────────────────────────

  const yearReadings = useMemo(
    () => filteredReadings.filter(r => new Date(r.reading_date + 'T00:00:00').getFullYear() === selectedYear),
    [filteredReadings, selectedYear],
  )

  // ── Chart: Monthly Rainfall (selected year) ───────────────────────────

  const monthlyData = useMemo(() => {
    const byMonth = new Array(12).fill(0)
    yearReadings.forEach(r => {
      const m = new Date(r.reading_date + 'T00:00:00').getMonth()
      byMonth[m] += r.value_mm
    })
    // Long-term monthly averages
    const ltByMonthYear: Record<string, number> = {}
    const ltYears = new Set<number>()
    filteredReadings.forEach(r => {
      const d = new Date(r.reading_date + 'T00:00:00')
      const key = `${d.getFullYear()}-${d.getMonth()}`
      ltByMonthYear[key] = (ltByMonthYear[key] || 0) + r.value_mm
      ltYears.add(d.getFullYear())
    })
    const nYears = ltYears.size || 1
    const ltAvg = new Array(12).fill(0)
    for (const [key, val] of Object.entries(ltByMonthYear)) {
      const m = parseInt(key.split('-')[1])
      ltAvg[m] += val
    }
    for (let i = 0; i < 12; i++) ltAvg[i] = ltAvg[i] / nYears

    return MONTHS.map((name, i) => ({
      name,
      rainfall: Math.round(byMonth[i] * 10) / 10,
      average: Math.round(ltAvg[i] * 10) / 10,
    }))
  }, [yearReadings, filteredReadings])

  // ── Chart: Annual Trend ────────────────────────────────────────────────

  const annualData = useMemo(() => {
    const byYear: Record<number, number> = {}
    filteredReadings.forEach(r => {
      const y = new Date(r.reading_date + 'T00:00:00').getFullYear()
      byYear[y] = (byYear[y] || 0) + r.value_mm
    })
    return Object.entries(byYear)
      .map(([y, total]) => ({ year: parseInt(y), total: Math.round(total * 10) / 10 }))
      .sort((a, b) => a.year - b.year)
  }, [filteredReadings])

  const longTermAvg = useMemo(() => {
    if (annualData.length === 0) return 0
    return annualData.reduce((a, b) => a + b.total, 0) / annualData.length
  }, [annualData])

  // ── Chart: Gauge Comparison (monthly, selected year) ───────────────────

  const showOldGaugeComparison = filteredGauges.length > 1 && !selectedGauge

  const gaugeComparisonData = useMemo(() => {
    if (!showOldGaugeComparison) return []
    const byGaugeMonth: Record<string, Record<number, number>> = {}
    filteredGauges.forEach(g => { byGaugeMonth[g.id] = {} })
    yearReadings.forEach(r => {
      if (!byGaugeMonth[r.gauge_id]) return
      const m = new Date(r.reading_date + 'T00:00:00').getMonth()
      byGaugeMonth[r.gauge_id][m] = (byGaugeMonth[r.gauge_id][m] || 0) + r.value_mm
    })
    return MONTHS.map((name, i) => {
      const row: Record<string, string | number> = { name }
      filteredGauges.forEach(g => {
        row[g.name] = Math.round((byGaugeMonth[g.id]?.[i] || 0) * 10) / 10
      })
      return row
    })
  }, [showOldGaugeComparison, filteredGauges, yearReadings])

  // ── Dry streaks by year (longest streak in current month per year) ─────

  const dryStreakData = useMemo(() => {
    const currentMonth = new Date().getMonth()
    const monthName = MONTHS[currentMonth]

    const byYear: Record<number, Reading[]> = {}
    filteredReadings
      .filter(r => !isMonthlyReading(r))
      .forEach(r => {
        const d = new Date(r.reading_date + 'T00:00:00')
        if (d.getMonth() !== currentMonth) return
        const y = d.getFullYear()
        if (!byYear[y]) byYear[y] = []
        byYear[y].push(r)
      })

    const streaks = Object.entries(byYear).map(([yearStr, rds]) => {
      const sorted = rds.sort((a, b) => a.reading_date.localeCompare(b.reading_date))
      let maxStreak = 0, current = 0
      for (const r of sorted) {
        if (r.value_mm === 0) { current++; maxStreak = Math.max(maxStreak, current) }
        else { current = 0 }
      }
      return { year: parseInt(yearStr), streak: maxStreak }
    }).sort((a, b) => a.year - b.year)

    const avgStreak = streaks.length > 0
      ? Math.round(streaks.reduce((s, x) => s + x.streak, 0) / streaks.length)
      : 0

    return { streaks, avgStreak, currentMonth: monthName }
  }, [filteredReadings])

  // ── Cumulative weekly data for season budget ───────────────────────────

  const cumulativeData = useMemo(() => {
    const currentYear = season.year

    // Historical: per-year weekly totals (exclude current year)
    const historicalYears: Record<number, number[]> = {}
    filteredReadings.forEach(r => {
      const d = new Date(r.reading_date + 'T00:00:00')
      const yr = d.getFullYear()
      if (yr === currentYear) return
      if (!historicalYears[yr]) historicalYears[yr] = new Array(53).fill(0)
      const w = seasonWeek(d, yr)
      if (w > 0) historicalYears[yr][w] += r.value_mm
    })

    // Median cumulative at each week
    const medianCum: number[] = [0]
    for (let w = 1; w <= 52; w++) {
      const cumsAtWeek: number[] = []
      Object.values(historicalYears).forEach(weeklyTotals => {
        let cum = 0
        for (let i = 1; i <= w; i++) cum += (weeklyTotals[i] || 0)
        cumsAtWeek.push(cum)
      })
      medianCum.push(cumsAtWeek.length > 0 ? median(cumsAtWeek) : 0)
    }

    // Actual cumulative for current year
    const actualWeekly = new Array(53).fill(0)
    seasonReadings.forEach(r => {
      const d = new Date(r.reading_date + 'T00:00:00')
      const w = seasonWeek(d, currentYear)
      if (w > 0) actualWeekly[w] += r.value_mm
    })
    const actualCum: number[] = [0]
    let cum = 0
    for (let w = 1; w <= 52; w++) {
      cum += actualWeekly[w]
      actualCum.push(cum)
    }

    const currentWeek = seasonWeek(new Date(), currentYear)
    return Array.from({ length: Math.max(1, currentWeek) }, (_, i) => ({
      weekLabel: `W${i + 1}`,
      actualCumMm: Math.round(actualCum[i + 1] * 10) / 10,
      medianCumMm: Math.round(medianCum[i + 1] * 10) / 10,
    }))
  }, [filteredReadings, seasonReadings, season])

  // ── Render ───────────────────────────────────────────────────────────────

  if (!contextLoaded) return null

  const showGaugeComparison = filteredGauges.length > 1 && !selectedGauge

  const totalSeasonDays = Math.floor(
    (new Date(season.endDate + 'T00:00:00').getTime() - new Date(season.startDate + 'T00:00:00').getTime()) / 86400000,
  ) + 1

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        @media (max-width: 768px) {
          .rain-main { padding: 16px !important; padding-bottom: 80px !important; }
          .rain-kpi-strip { grid-template-columns: repeat(2, 1fr) !important; }
          .rain-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={s.page}>
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
        <main style={s.main} className="rain-main">
          {/* Header */}
          <div style={s.pageHeader}>
            <div>
              <h1 style={s.pageTitle}>Rainfall</h1>
              <div style={s.pageSub}>{season.label} calendar year</div>
            </div>
          </div>

          {/* Controls */}
          <div style={s.controls}>
            <div style={s.filterGroup}>
              <button
                style={selectedFarm === null ? s.pillActive : s.pill}
                onClick={() => setSelectedFarm(null)}
              >
                All Farms
              </button>
              {farms.map(f => (
                <button
                  key={f.id}
                  style={selectedFarm === f.id ? s.pillActive : s.pill}
                  onClick={() => setSelectedFarm(f.id)}
                >
                  {f.code}
                </button>
              ))}
            </div>

            <div style={s.divider} />

            <select
              style={s.select}
              value={selectedGauge || ''}
              onChange={e => setSelectedGauge(e.target.value || null)}
            >
              <option value="">All Gauges</option>
              {gaugeOptions.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <div style={s.divider} />

            <select
              style={s.select}
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* KPI cards */}
          <RainMetricCards
            seasonTotal={seasonTotal}
            medianSeasonTotal={medianToDate}
            lastRainDate={lastRainEvent?.date || null}
            lastRainMm={lastRainEvent?.mm || 0}
            daysAgo={lastRainEvent?.daysAgo ?? null}
            wettestDayDate={wettestDay?.date || null}
            wettestDayMm={wettestDay?.mm || 0}
            dryDays={currentDryDays}
            totalSeasonDays={totalSeasonDays}
            hasDailyData={hasDailyData}
          />

          {/* Heatmap — hero */}
          <RainHeatmap
            readings={filteredReadings}
            gauges={filteredGauges}
            gaugeColors={GAUGE_COLORS}
          />

          {/* Two-col row 1 */}
          <div style={s.twoCol} className="rain-two-col">
            <SeasonalWheel data={wheelData} yearsOfData={yearsOfData} />
            {showGaugeComparison ? (
              <GaugeComparison
                readings={filteredReadings}
                gauges={filteredGauges}
                gaugeColors={GAUGE_COLORS}
              />
            ) : (
              <SeasonBudgetTracker
                actualMm={seasonTotal}
                fullSeasonMedian={fullSeasonMedian}
                medianToDate={medianToDate}
                cumulativeData={cumulativeData}
                seasonLabel={season.label}
              />
            )}
          </div>

          {/* Two-col row 2 */}
          <div style={s.twoCol} className="rain-two-col">
            <DryStreakMeter
              currentStreak={currentDryDays}
              streaksByYear={dryStreakData.streaks}
              currentMonth={dryStreakData.currentMonth}
              avgStreak={dryStreakData.avgStreak}
              hasDailyData={hasDailyData}
            />
            {showGaugeComparison && (
              <SeasonBudgetTracker
                actualMm={seasonTotal}
                fullSeasonMedian={fullSeasonMedian}
                medianToDate={medianToDate}
                cumulativeData={cumulativeData}
                seasonLabel={season.label}
              />
            )}
          </div>

          {/* Monthly Rainfall chart */}
          <div style={s.chartCard}>
            <div style={s.chartTitle}>Monthly Rainfall &mdash; {selectedYear}</div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit=" mm" />
                <Tooltip formatter={fmtMm} />
                <Legend />
                <Bar dataKey="rainfall" name={`${selectedYear}`} fill="#2176d9" radius={[4, 4, 0, 0]} />
                <Line dataKey="average" name="LT Average" stroke="#999" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Annual Rainfall Trend */}
          {annualData.length > 1 && (
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Annual Rainfall Trend</div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={annualData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit=" mm" />
                  <Tooltip formatter={fmtMm} />
                  <ReferenceLine y={longTermAvg} stroke="#999" strokeDasharray="6 3" label={{ value: `Avg ${Math.round(longTermAvg)}`, position: 'right', fontSize: 11, fill: '#999' }} />
                  <Bar dataKey="total" name="Annual Total" radius={[4, 4, 0, 0]} cursor="pointer"
                    onClick={(data: any) => { const yr = data?.year ?? data?.payload?.year; if (yr) setSelectedYear(yr) }}>
                    {annualData.map((entry) => (
                      <Cell
                        key={entry.year}
                        fill={entry.year === selectedYear ? '#2176d9' : entry.total >= longTermAvg ? '#2176d9' : '#e8924a'}
                        opacity={entry.year === selectedYear ? 1 : 0.6}
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gauge Comparison (monthly) */}
          {showOldGaugeComparison && gaugeComparisonData.length > 0 && (
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Gauge Comparison &mdash; {selectedYear}</div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={gaugeComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit=" mm" />
                  <Tooltip formatter={fmtMm} />
                  <Legend />
                  {filteredGauges.map(g => (
                    <Bar
                      key={g.id}
                      dataKey={g.name}
                      fill={GAUGE_COLORS[g.name] || '#8a95a0'}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </main>
        <MobileNav modules={modules} />
      </div>
    </>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page:        { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
  main:        { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, paddingBottom: 100 },
  pageHeader:  { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  pageTitle:   { fontSize: 32, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px', lineHeight: 1 },
  pageSub:     { fontSize: 14, color: '#8a95a0', marginTop: 6 },
  controls:    { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 28 },
  filterGroup: { display: 'flex', gap: 6 },
  pill:        { padding: '6px 14px', borderRadius: 20, border: '1px solid #d4cfca', background: '#fff', color: '#5a6a60', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  pillActive:  { padding: '6px 14px', borderRadius: 20, border: '1px solid #2176d9', background: '#2176d9', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  divider:     { width: 1, height: 24, background: '#d4cfca' },
  select:      { padding: '6px 12px', borderRadius: 8, border: '1px solid #d4cfca', background: '#fff', fontSize: 13, fontFamily: 'inherit', color: '#1a2a3a', cursor: 'pointer' },
  twoCol:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  chartCard:   { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', marginBottom: 20 },
  chartTitle:  { fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 16 },
}

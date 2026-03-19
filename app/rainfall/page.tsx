'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GAUGE_COLORS: Record<string, string> = {
  "Mouton's Valley": '#2176d9',
  'Stawelklip': '#4caf72',
  'MorningSide': '#e8924a',
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RainfallPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

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

  // ── Load gauges + readings (once) ────────────────────────────────────────

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
      // Supabase caps at 1000 rows per request; paginate to get all ~1,300
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

  // ── Filtered gauges ──────────────────────────────────────────────────────

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

  // Reset gauge selection when farm changes
  useEffect(() => { setSelectedGauge(null) }, [selectedFarm])

  // ── Available years ──────────────────────────────────────────────────────

  const availableYears = useMemo(() => {
    const ys = new Set<number>()
    filteredReadings.forEach(r => ys.add(new Date(r.reading_date + 'T00:00:00').getFullYear()))
    const sorted = Array.from(ys).sort((a, b) => b - a)
    return sorted.length > 0 ? sorted : [currentYear]
  }, [filteredReadings, currentYear])

  // Ensure selectedYear is valid
  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  // ── Gauge selector options (filtered by farm) ────────────────────────────

  const gaugeOptions = useMemo(() => {
    if (selectedFarm) return gauges.filter(g => g.farm_id === selectedFarm)
    return gauges
  }, [gauges, selectedFarm])

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const yearReadings = useMemo(
    () => filteredReadings.filter(r => new Date(r.reading_date + 'T00:00:00').getFullYear() === selectedYear),
    [filteredReadings, selectedYear],
  )

  const yearTotal = useMemo(
    () => yearReadings.reduce((sum, r) => sum + r.value_mm, 0),
    [yearReadings],
  )

  const longTermAvg = useMemo(() => {
    // Annual totals per year
    const byYear: Record<number, number> = {}
    filteredReadings.forEach(r => {
      const y = new Date(r.reading_date + 'T00:00:00').getFullYear()
      byYear[y] = (byYear[y] || 0) + r.value_mm
    })
    const years = Object.keys(byYear)
    if (years.length === 0) return 0
    const total = Object.values(byYear).reduce((a, b) => a + b, 0)
    return total / years.length
  }, [filteredReadings])

  const pctOfAvg = longTermAvg > 0 ? (yearTotal / longTermAvg) * 100 : 0
  const pctColor = pctOfAvg >= 80 ? '#4caf72' : pctOfAvg >= 60 ? '#f5c842' : '#e85a4a'

  const lastReading = useMemo(() => {
    if (filteredReadings.length === 0) return null
    return filteredReadings[filteredReadings.length - 1]
  }, [filteredReadings])

  // ── Chart 1: Monthly rainfall (selected year) ───────────────────────────

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
      const y = d.getFullYear()
      const m = d.getMonth()
      const key = `${y}-${m}`
      ltByMonthYear[key] = (ltByMonthYear[key] || 0) + r.value_mm
      ltYears.add(y)
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

  // ── Chart 2: Annual trend ────────────────────────────────────────────────

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

  // ── Chart 3: Gauge comparison (conditional) ──────────────────────────────

  const showGaugeComparison = filteredGauges.length > 1 && !selectedGauge

  const gaugeComparisonData = useMemo(() => {
    if (!showGaugeComparison) return []

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
  }, [showGaugeComparison, filteredGauges, yearReadings])

  // ── Monthly breakdown table ──────────────────────────────────────────────

  const breakdownTable = useMemo(() => {
    // Per gauge per month for selected year
    const byGaugeMonth: Record<string, number[]> = {}
    filteredGauges.forEach(g => { byGaugeMonth[g.id] = new Array(12).fill(0) })

    yearReadings.forEach(r => {
      if (!byGaugeMonth[r.gauge_id]) return
      const m = new Date(r.reading_date + 'T00:00:00').getMonth()
      byGaugeMonth[r.gauge_id][m] += r.value_mm
    })

    // Long-term monthly avg (across all years)
    const ltMonthYear: Record<string, number> = {}
    const ltYears = new Set<number>()
    filteredReadings.forEach(r => {
      const d = new Date(r.reading_date + 'T00:00:00')
      const key = `${d.getFullYear()}-${d.getMonth()}`
      ltMonthYear[key] = (ltMonthYear[key] || 0) + r.value_mm
      ltYears.add(d.getFullYear())
    })
    const nYears = ltYears.size || 1
    const ltAvg = new Array(12).fill(0)
    for (const [key, val] of Object.entries(ltMonthYear)) {
      const m = parseInt(key.split('-')[1])
      ltAvg[m] += val
    }
    for (let i = 0; i < 12; i++) ltAvg[i] = ltAvg[i] / nYears

    const rows = MONTHS.map((name, i) => {
      const row: Record<string, string | number> = { month: name }
      filteredGauges.forEach(g => {
        row[g.name] = Math.round(byGaugeMonth[g.id][i] * 10) / 10
      })
      // Average across visible gauges this year
      const vals = filteredGauges.map(g => byGaugeMonth[g.id][i])
      row['avg'] = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0
      row['ltAvg'] = Math.round(ltAvg[i] * 10) / 10
      return row
    })

    // Totals row
    const totalRow: Record<string, string | number> = { month: 'Total' }
    filteredGauges.forEach(g => {
      totalRow[g.name] = Math.round(byGaugeMonth[g.id].reduce((a, b) => a + b, 0) * 10) / 10
    })
    const avgArr = filteredGauges.map(g => byGaugeMonth[g.id].reduce((a, b) => a + b, 0))
    totalRow['avg'] = avgArr.length > 0 ? Math.round((avgArr.reduce((a, b) => a + b, 0) / avgArr.length) * 10) / 10 : 0
    totalRow['ltAvg'] = Math.round(ltAvg.reduce((a, b) => a + b, 0) * 10) / 10
    rows.push(totalRow)

    return rows
  }, [filteredGauges, yearReadings, filteredReadings])

  // ── Render ───────────────────────────────────────────────────────────────

  if (!contextLoaded) return null

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        @media (max-width: 768px) {
          .rain-main { padding: 16px !important; padding-bottom: 80px !important; }
          .rain-kpi-strip { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={s.page}>
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
        <main style={s.main} className="rain-main">
          {/* Header */}
          <div style={s.pageHeader}>
            <div>
              <h1 style={s.pageTitle}>Rainfall</h1>
              <div style={s.pageSub}>Historic and current rainfall across gauges</div>
            </div>
          </div>

          {/* Controls */}
          <div style={s.controls}>
            {/* Farm pills */}
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

            {/* Gauge dropdown */}
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

            {/* Year dropdown */}
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

          {/* KPI strip */}
          <div style={s.kpiStrip} className="rain-kpi-strip">
            <div style={s.kpiCard}>
              <div style={s.kpiAccent} />
              <div style={s.kpiLabel}>Year Total</div>
              <div style={s.kpiValue}>
                {yearTotal > 0 ? Math.round(yearTotal).toLocaleString() : '—'}
                <span style={s.kpiUnit}>mm</span>
              </div>
            </div>
            <div style={s.kpiCard}>
              <div style={s.kpiAccent} />
              <div style={s.kpiLabel}>Long-term Average</div>
              <div style={s.kpiValue}>
                {longTermAvg > 0 ? Math.round(longTermAvg).toLocaleString() : '—'}
                <span style={s.kpiUnit}>mm/yr</span>
              </div>
            </div>
            <div style={s.kpiCard}>
              <div style={{ ...s.kpiAccent, background: `linear-gradient(90deg, ${pctColor}, ${pctColor}88)` }} />
              <div style={s.kpiLabel}>% of Average</div>
              <div style={{ ...s.kpiValue, color: pctColor }}>
                {pctOfAvg > 0 ? `${Math.round(pctOfAvg)}%` : '—'}
              </div>
            </div>
            <div style={s.kpiCard}>
              <div style={s.kpiAccent} />
              <div style={s.kpiLabel}>Last Reading</div>
              <div style={s.kpiValue}>
                {lastReading ? (
                  <>
                    {lastReading.value_mm}
                    <span style={s.kpiUnit}>mm</span>
                  </>
                ) : '—'}
              </div>
              {lastReading && (
                <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 4 }}>
                  {new Date(lastReading.reading_date + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>

          {/* Chart 1: Monthly Rainfall */}
          <div style={s.chartCard}>
            <div style={s.chartTitle}>Monthly Rainfall — {selectedYear}</div>
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

          {/* Chart 2: Annual Trend */}
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
                    onClick={(_data: any, _idx: number, e: any) => { const yr = e?.year ?? e?.payload?.year; if (yr) setSelectedYear(yr) }}>
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

          {/* Chart 3: Gauge Comparison */}
          {showGaugeComparison && gaugeComparisonData.length > 0 && (
            <div style={s.chartCard}>
              <div style={s.chartTitle}>Gauge Comparison — {selectedYear}</div>
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

          {/* Monthly Breakdown Table */}
          <div style={s.chartCard}>
            <div style={s.chartTitle}>Monthly Breakdown — {selectedYear}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Month</th>
                    {filteredGauges.map(g => (
                      <th key={g.id} style={s.thRight}>{g.name}</th>
                    ))}
                    {filteredGauges.length > 1 && <th style={s.thRight}>Avg</th>}
                    <th style={s.thRight}>LT Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownTable.map((row, i) => {
                    const isTotal = row.month === 'Total'
                    return (
                      <tr key={i} style={isTotal ? { fontWeight: 700, borderTop: '2px solid #d4cfca' } : {}}>
                        <td style={s.td}>{row.month}</td>
                        {filteredGauges.map(g => (
                          <td key={g.id} style={s.tdRight}>{row[g.name] || 0}</td>
                        ))}
                        {filteredGauges.length > 1 && <td style={s.tdRight}>{row.avg}</td>}
                        <td style={s.tdRight}>{row.ltAvg}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
  kpiStrip:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 },
  kpiCard:     { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative' as const, overflow: 'hidden' },
  kpiAccent:   { position: 'absolute' as const, top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2176d9, #a0c4f0)' },
  kpiLabel:    { fontSize: 12, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  kpiValue:    { fontSize: 32, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 },
  kpiUnit:     { fontSize: 14, color: '#8a95a0', fontWeight: 400, marginLeft: 4 },
  chartCard:   { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', marginBottom: 20 },
  chartTitle:  { fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 16 },
  table:       { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th:          { textAlign: 'left' as const, padding: '8px 12px', borderBottom: '2px solid #d4cfca', color: '#8a95a0', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  thRight:     { textAlign: 'right' as const, padding: '8px 12px', borderBottom: '2px solid #d4cfca', color: '#8a95a0', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  td:          { padding: '8px 12px', borderBottom: '1px solid #f0ede8' },
  tdRight:     { textAlign: 'right' as const, padding: '8px 12px', borderBottom: '1px solid #f0ede8' },
}

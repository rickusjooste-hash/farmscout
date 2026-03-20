'use client'

import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Reading { gauge_id: string; reading_date: string; value_mm: number }
interface Gauge { id: string; farm_id: string; name: string }

interface Props {
  readings: Reading[]
  gauges: Gauge[]
  gaugeColors: Record<string, string>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function weekOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000)
  return Math.min(52, Math.floor(dayOfYear / 7) + 1)
}

function isMonthlyReading(r: Reading): boolean {
  const d = new Date(r.reading_date + 'T00:00:00')
  return d.getDate() === 1 && d.getFullYear() < 2024
}

const BLUE_SCALE = [
  { max: 0, color: 'transparent' },
  { max: 5, color: '#c6dbef' },
  { max: 15, color: '#6baed6' },
  { max: 30, color: '#2171b5' },
  { max: 60, color: '#08519c' },
  { max: Infinity, color: '#08306b' },
]

function cellColor(mm: number): string {
  if (mm <= 0) return 'transparent'
  for (const stop of BLUE_SCALE) {
    if (mm <= stop.max) return stop.color
  }
  return '#08306b'
}

const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

// Approximate month start weeks for the axis labels
function monthStartWeek(month: number): number {
  // Rough: month 0 = week 1, month 1 = week 5, etc.
  return Math.round((month * 52) / 12) + 1
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RainHeatmap({ readings, gauges, gaugeColors }: Props) {
  const [selectedGaugeId, setSelectedGaugeId] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  // Filter by internal gauge selector
  const activeReadings = useMemo(() => {
    if (!selectedGaugeId) return readings
    return readings.filter(r => r.gauge_id === selectedGaugeId)
  }, [readings, selectedGaugeId])

  // Compute weekly buckets
  const { buckets, years } = useMemo(() => {
    const bk: Record<string, { totalMm: number; isEstimated: boolean }> = {}
    const ys = new Set<number>()

    activeReadings.forEach(r => {
      const d = new Date(r.reading_date + 'T00:00:00')
      const year = d.getFullYear()
      ys.add(year)

      if (isMonthlyReading(r)) {
        const month = d.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const weeks = new Set<number>()
        for (let day = 1; day <= daysInMonth; day++) {
          weeks.add(weekOfYear(new Date(year, month, day)))
        }
        const weekArr = Array.from(weeks)
        const mmPerWeek = r.value_mm / weekArr.length
        weekArr.forEach(w => {
          const key = `${year}-${w}`
          if (!bk[key]) bk[key] = { totalMm: 0, isEstimated: false }
          bk[key].totalMm += mmPerWeek
          bk[key].isEstimated = true
        })
      } else {
        const w = weekOfYear(d)
        const key = `${year}-${w}`
        if (!bk[key]) bk[key] = { totalMm: 0, isEstimated: false }
        bk[key].totalMm += r.value_mm
      }
    })

    return { buckets: bk, years: Array.from(ys).sort((a, b) => a - b) }
  }, [activeReadings])

  // Drill-down data for selected year
  const drillDownData = useMemo(() => {
    if (selectedYear === null) return null
    const yearReadings = activeReadings
      .filter(r => new Date(r.reading_date + 'T00:00:00').getFullYear() === selectedYear)
      .sort((a, b) => a.reading_date.localeCompare(b.reading_date))

    if (yearReadings.length === 0) return null

    const isMonthly = yearReadings.every(r => isMonthlyReading(r))
    if (isMonthly) {
      return yearReadings.map(r => ({
        label: new Date(r.reading_date + 'T00:00:00').toLocaleDateString('en-ZA', { month: 'short' }),
        mm: Math.round(r.value_mm * 10) / 10,
      }))
    }
    // Daily: aggregate by week for readability
    const byWeek: Record<number, number> = {}
    yearReadings.forEach(r => {
      const w = weekOfYear(new Date(r.reading_date + 'T00:00:00'))
      byWeek[w] = (byWeek[w] || 0) + r.value_mm
    })
    return Object.entries(byWeek)
      .map(([w, mm]) => ({ label: `W${w}`, mm: Math.round(mm * 10) / 10 }))
      .sort((a, b) => parseInt(a.label.slice(1)) - parseInt(b.label.slice(1)))
  }, [selectedYear, activeReadings])

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={s.title}>Rainfall Heatmap</div>
        <select
          style={s.select}
          value={selectedGaugeId || ''}
          onChange={e => setSelectedGaugeId(e.target.value || null)}
        >
          <option value="">Combined</option>
          {gauges.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Month axis labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(52, 1fr)', marginBottom: 2 }}>
        <div />
        {Array.from({ length: 52 }, (_, i) => {
          const weekNum = i + 1
          const monthIdx = MONTHS_SHORT.findIndex((_, mi) => monthStartWeek(mi) === weekNum)
          return (
            <div key={i} style={{ fontSize: 9, color: '#8a95a0', textAlign: 'center' }}>
              {monthIdx >= 0 ? MONTHS_SHORT[monthIdx] : ''}
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 700 }}>
          {years.map(year => (
            <div
              key={year}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px repeat(52, 1fr)',
                cursor: 'pointer',
                marginBottom: 1,
              }}
              onClick={() => setSelectedYear(selectedYear === year ? null : year)}
            >
              <div style={{
                fontSize: 11, color: selectedYear === year ? '#2176d9' : '#5a6a60',
                fontWeight: selectedYear === year ? 700 : 500,
                display: 'flex', alignItems: 'center',
              }}>
                {year}
              </div>
              {Array.from({ length: 52 }, (_, i) => {
                const w = i + 1
                const key = `${year}-${w}`
                const cell = buckets[key]
                const mm = cell ? Math.round(cell.totalMm * 10) / 10 : 0
                const bg = cellColor(mm)
                const isEst = cell?.isEstimated || false

                return (
                  <div
                    key={w}
                    title={`${year} week ${w}: ${mm}mm${isEst ? ' (est.)' : ''}`}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1.2',
                      maxHeight: 14,
                      borderRadius: 2,
                      margin: '0 0.5px',
                      background: isEst && mm > 0
                        ? `repeating-linear-gradient(45deg, ${bg}, ${bg} 2px, ${bg}99 2px, ${bg}99 4px)`
                        : bg,
                      border: mm > 0 ? 'none' : '1px solid #f0ede8',
                      boxSizing: 'border-box',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { label: '0 mm', color: 'transparent', border: true },
          { label: '<5', color: '#c6dbef' },
          { label: '<15', color: '#6baed6' },
          { label: '<30', color: '#2171b5' },
          { label: '<60', color: '#08519c' },
          { label: '60+', color: '#08306b' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 2,
              background: item.color,
              border: item.border ? '1px solid #d4cfca' : 'none',
            }} />
            <span style={{ fontSize: 10, color: '#8a95a0' }}>{item.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <div style={{
            width: 12, height: 12, borderRadius: 2,
            background: 'repeating-linear-gradient(45deg, #6baed6, #6baed6 2px, #6baed699 2px, #6baed699 4px)',
          }} />
          <span style={{ fontSize: 10, color: '#8a95a0' }}>Estimated (monthly)</span>
        </div>
      </div>

      {/* Drill-down chart */}
      {selectedYear !== null && drillDownData && drillDownData.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #e8e4dc', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2a3a', marginBottom: 12 }}>
            {selectedYear} Detail
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={drillDownData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e4dc" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" mm" />
              <Tooltip formatter={(v) => `${v} mm`} />
              <Bar dataKey="mm" name="Rainfall" fill="#2176d9" radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card:   { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', marginBottom: 20 },
  title:  { fontSize: 15, fontWeight: 700, color: '#1a2a3a' },
  select: { padding: '4px 10px', borderRadius: 8, border: '1px solid #d4cfca', background: '#fff', fontSize: 12, fontFamily: 'inherit', color: '#1a2a3a', cursor: 'pointer' },
}

'use client'

import { useMemo, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ZAxis,
  BarChart, Bar, Legend,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────

interface OrchardForAge {
  id: string
  name: string
  variety: string | null
  commodityName: string
  farmCode: string
  ha: number | null
  yearPlanted: number | null
  tons: number
  tonHa: number | null
  bruisingPct: number | null
  pestStatus: string
  pestCount: number
}

interface HistoricalMedian {
  season: string
  bands: Record<string, number>
}

interface Props {
  orchards: OrchardForAge[]
  selectedOrchardId: string | null
  onOrchardSelect: (id: string | null) => void
  hasProduction: boolean
  selectedAgeBand: string | null
  onAgeBandSelect: (band: string | null) => void
  historicalMedians?: HistoricalMedian[]
  currentSeason?: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()

const AGE_BANDS = [
  { key: 'establishing', label: 'Establishing', range: '1–4 yr', min: 0, max: 4, color: '#6b7fa8', desc: 'Not yet in full production' },
  { key: 'young', label: 'Young', range: '5–10 yr', min: 5, max: 10, color: '#4caf72', desc: 'Ramping up to peak' },
  { key: 'prime', label: 'Prime', range: '11–20 yr', min: 11, max: 20, color: '#2a6e45', desc: 'Peak production years' },
  { key: 'mature', label: 'Mature', range: '21–30 yr', min: 21, max: 30, color: '#f5c842', desc: 'Watch for decline' },
  { key: 'aging', label: 'Aging', range: '30+ yr', min: 31, max: 999, color: '#e85a4a', desc: 'Review for replanting' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function getBand(age: number) {
  return AGE_BANDS.find(b => age >= b.min && age <= b.max) || AGE_BANDS[AGE_BANDS.length - 1]
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return '—'
  return v.toLocaleString('en-ZA', { maximumFractionDigits: decimals })
}

// ── Problem detection ──────────────────────────────────────────────────────

interface ProblemOrchard {
  orchard: OrchardForAge
  age: number
  bandKey: string
  bandMedianTonHa: number
  flags: string[]
  severity: 'high' | 'medium'
}

function detectProblems(
  orchards: OrchardForAge[],
  bandStats: Record<string, { medianTonHa: number }>,
): ProblemOrchard[] {
  const problems: ProblemOrchard[] = []

  orchards.forEach(o => {
    if (o.yearPlanted == null) return
    const age = CURRENT_YEAR - o.yearPlanted
    if (age <= 4) return // establishing — skip

    const band = getBand(age)
    const bandMedian = bandStats[band.key]?.medianTonHa || 0
    const flags: string[] = []

    // Yield underperformance: < 60% of band median (significant gap)
    if (o.tonHa != null && bandMedian > 0 && o.tonHa < bandMedian * 0.6) {
      flags.push('low_yield')
    }

    // Quality degradation in older orchards
    if (o.bruisingPct != null && o.bruisingPct > 8 && age > 15) {
      flags.push('quality')
    }

    // High pest pressure in older orchards
    if (o.pestStatus === 'red' && age > 15) {
      flags.push('pest')
    }

    // Aging orchard with any production concern
    if (age > 30 && o.tonHa != null && o.tonHa > 0 && bandMedian > 0 && o.tonHa < bandMedian * 0.8) {
      if (!flags.includes('low_yield')) flags.push('aging_decline')
    }

    if (flags.length > 0) {
      problems.push({
        orchard: o,
        age,
        bandKey: band.key,
        bandMedianTonHa: bandMedian,
        flags,
        severity: flags.length >= 2 ? 'high' : 'medium',
      })
    }
  })

  // Sort: high severity first, then by most flags, then by worst yield gap
  return problems.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    if (a.flags.length !== b.flags.length) return b.flags.length - a.flags.length
    return (a.orchard.tonHa || 0) - (b.orchard.tonHa || 0)
  })
}

// ── Tooltip ────────────────────────────────────────────────────────────────

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#1c3a2a', color: '#e8f0e0', padding: '10px 14px',
      borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.name}</div>
      <div style={{ color: '#a8d5a2', fontSize: 11, marginBottom: 6 }}>{d.variety || ''} · {d.commodityName}</div>
      <div>Age: <strong>{d.age} years</strong></div>
      {d.tonHa != null && d.tonHa > 0 && <div>T/Ha: <strong>{d.tonHa.toFixed(1)}</strong></div>}
      <div>Ha: <strong>{d.ha?.toFixed(1) || '—'}</strong></div>
      {d.bandMedian > 0 && d.tonHa != null && d.tonHa > 0 && (
        <div style={{ marginTop: 4, fontSize: 11, color: d.tonHa >= d.bandMedian ? '#a8d5a2' : '#f5c842' }}>
          {d.avgYears || 1}yr avg median: {d.bandMedian.toFixed(1)} t/ha
          ({d.tonHa >= d.bandMedian ? 'above' : `${Math.round((1 - d.tonHa / d.bandMedian) * 100)}% below`})
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  green: '#4caf72', yellow: '#f5c842', red: '#e85a4a', blue: '#6b7fa8', grey: '#aaaaaa',
}

export default function OrchardAgeAnalysis({
  orchards, selectedOrchardId, onOrchardSelect, hasProduction,
  selectedAgeBand, onAgeBandSelect, historicalMedians, currentSeason,
}: Props) {
  const [showAllProblems, setShowAllProblems] = useState(false)

  // ── Compute age for each orchard ──────────────────────────────────────
  const withAge = useMemo(() =>
    orchards
      .filter(o => o.yearPlanted != null)
      .map(o => ({ ...o, age: CURRENT_YEAR - o.yearPlanted! }))
      .sort((a, b) => a.age - b.age),
    [orchards]
  )

  const noAgeCount = orchards.length - withAge.length

  // ── Band statistics ───────────────────────────────────────────────────
  const bandStats = useMemo(() => {
    const stats: Record<string, {
      orchards: typeof withAge
      count: number; totalHa: number
      tonHaValues: number[]; medianTonHa: number
      avgBruising: number | null; bruisingCount: number
      pestRed: number; pestYellow: number; pestGreen: number
    }> = {}

    AGE_BANDS.forEach(b => {
      const inBand = withAge.filter(o => o.age >= b.min && o.age <= b.max)
      const tonHaVals = inBand.filter(o => o.tonHa != null && o.tonHa > 0).map(o => o.tonHa!)
      const bruisingVals = inBand.filter(o => o.bruisingPct != null).map(o => o.bruisingPct!)

      stats[b.key] = {
        orchards: inBand,
        count: inBand.length,
        totalHa: inBand.reduce((s, o) => s + (o.ha || 0), 0),
        tonHaValues: tonHaVals,
        medianTonHa: median(tonHaVals),
        avgBruising: bruisingVals.length > 0 ? bruisingVals.reduce((s, v) => s + v, 0) / bruisingVals.length : null,
        bruisingCount: bruisingVals.length,
        pestRed: inBand.filter(o => o.pestStatus === 'red').length,
        pestYellow: inBand.filter(o => o.pestStatus === 'yellow').length,
        pestGreen: inBand.filter(o => o.pestStatus === 'green').length,
      }
    })
    return stats
  }, [withAge])

  // ── Multi-year average median per band (for dashed lines) ────────────
  const avgBandMedians = useMemo(() => {
    const result: Record<string, number> = {}
    if (!historicalMedians || historicalMedians.length === 0) {
      // Fallback to current season only
      AGE_BANDS.forEach(b => { result[b.key] = bandStats[b.key]?.medianTonHa || 0 })
      return result
    }
    AGE_BANDS.forEach(b => {
      const values = historicalMedians
        .map(h => h.bands[b.key])
        .filter((v): v is number => v != null && v > 0)
      result[b.key] = values.length > 0
        ? Math.round(values.reduce((s, v) => s + v, 0) / values.length * 10) / 10
        : bandStats[b.key]?.medianTonHa || 0
    })
    return result
  }, [historicalMedians, bandStats])

  const avgYears = historicalMedians?.length || 1

  // ── Scatter data ──────────────────────────────────────────────────────
  const scatterData = useMemo(() =>
    withAge
      .filter(o => o.age > 0)
      .map(o => {
        const band = getBand(o.age)
        const bm = avgBandMedians[band.key] || 0
        return {
          age: o.age,
          tonHa: o.tonHa ?? 0,
          id: o.id,
          name: o.name,
          variety: o.variety,
          commodityName: o.commodityName,
          ha: o.ha,
          bandKey: band.key,
          bandColor: band.color,
          bandMedian: bm,
          avgYears,
          isProblem: o.tonHa != null && bm > 0 && o.tonHa < bm * 0.6 && o.age > 4,
        }
      }),
    [withAge, avgBandMedians]
  )

  // ── Problems ──────────────────────────────────────────────────────────
  const problems = useMemo(
    () => detectProblems(withAge, Object.fromEntries(
      AGE_BANDS.map(b => [b.key, { medianTonHa: avgBandMedians[b.key] || 0 }])
    )),
    [withAge, avgBandMedians]
  )

  // ── Distribution bar widths ───────────────────────────────────────────
  const totalHaAll = AGE_BANDS.reduce((s, b) => s + (bandStats[b.key]?.totalHa || 0), 0)

  if (withAge.length === 0) {
    return (
      <div style={{ color: '#9aaa9f', fontSize: 13, textAlign: 'center', padding: 40 }}>
        No orchards with planting year data available
      </div>
    )
  }

  const flagLabel = (flag: string) => {
    switch (flag) {
      case 'low_yield': return 'Low yield for age'
      case 'quality': return 'High bruising'
      case 'pest': return 'High pest pressure'
      case 'aging_decline': return 'Aging decline'
      default: return flag
    }
  }

  const bandRowStyle = (bandKey: string): React.CSSProperties => ({
    cursor: 'pointer',
    transition: 'background 0.1s',
    background: selectedAgeBand === bandKey ? '#f0f7f2' : 'transparent',
  })

  return (
    <div>
      {/* Age distribution bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
          Age Distribution
        </div>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 28, background: '#f0ede6' }}>
          {AGE_BANDS.map(b => {
            const ha = bandStats[b.key]?.totalHa || 0
            const pct = totalHaAll > 0 ? (ha / totalHaAll) * 100 : 0
            if (pct < 0.5) return null
            const isActive = selectedAgeBand === b.key
            const isDimmed = selectedAgeBand != null && !isActive
            return (
              <div
                key={b.key}
                onClick={() => onAgeBandSelect(selectedAgeBand === b.key ? null : b.key)}
                style={{
                  width: `${pct}%`, background: b.color,
                  opacity: isDimmed ? 0.3 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, color: '#fff',
                  cursor: 'pointer', transition: 'opacity 0.2s',
                  borderRight: '2px solid #fff',
                  overflow: 'hidden', whiteSpace: 'nowrap',
                }}
                title={`${b.label} (${b.range}): ${fmt(ha, 1)} ha, ${bandStats[b.key]?.count || 0} blocks`}
              >
                {pct > 12 ? `${b.label}` : ''}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
          {AGE_BANDS.map(b => {
            const s = bandStats[b.key]
            if (!s || s.count === 0) return null
            return (
              <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6a7a70' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                {b.label} · {s.count} blocks · {fmt(s.totalHa)} ha
              </div>
            )
          })}
          {noAgeCount > 0 && (
            <div style={{ fontSize: 11, color: '#9aaa9f' }}>({noAgeCount} without planting year)</div>
          )}
        </div>
      </div>

      {/* Scatter: Age vs T/Ha */}
      {hasProduction && scatterData.some(d => d.tonHa > 0) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
            Productivity by Age
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 8 }}>
              — dots sized by hectares, dashed lines = {avgYears}-season avg median
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
              <XAxis
                type="number" dataKey="age" name="Age"
                tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
                tickLine={false} axisLine={{ stroke: '#f0ede6' }}
                label={{ value: 'Orchard Age (years)', position: 'insideBottom', offset: -4, fontSize: 11, fill: '#9aaa9f' }}
                domain={[0, 'auto']}
              />
              <YAxis
                type="number" dataKey="tonHa" name="T/Ha"
                tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
                tickLine={false} axisLine={false}
                label={{ value: 'T/Ha', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9aaa9f' }}
              />
              <ZAxis type="number" dataKey="ha" range={[40, 300]} name="Ha" />
              <Tooltip content={<ScatterTooltip />} cursor={false} />
              <Scatter data={scatterData} onClick={(d: any) => d && onOrchardSelect(d.id)}>
                {scatterData.map((d, i) => {
                  const sel = d.id === selectedOrchardId
                  const dimmed = selectedAgeBand != null && d.bandKey !== selectedAgeBand
                  return (
                    <Cell
                      key={i}
                      fill={d.isProblem ? '#e85a4a' : d.bandColor}
                      stroke={sel ? '#1c3a2a' : d.isProblem ? '#c0392b' : 'rgba(255,255,255,0.8)'}
                      strokeWidth={sel ? 3 : d.isProblem ? 2 : 1}
                      opacity={dimmed ? 0.15 : 1}
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                    />
                  )
                })}
              </Scatter>
              {/* Band average median reference lines (multi-year) */}
              {AGE_BANDS.filter(b => avgBandMedians[b.key] > 0).map(b => {
                const avg = avgBandMedians[b.key]
                const midAge = b.key === 'aging' ? Math.min(b.min + 10, 45) : (b.min + b.max) / 2
                return (
                  <Scatter
                    key={`ref-${b.key}`}
                    data={[
                      { age: b.min, tonHa: avg, ha: 0 },
                      { age: b.key === 'aging' ? midAge * 2 : b.max, tonHa: avg, ha: 0 },
                    ]}
                    line={{ stroke: b.color, strokeDasharray: '4 3', strokeWidth: 1.5, strokeOpacity: 0.5 }}
                    shape={() => null}
                    legendType="none"
                    isAnimationActive={false}
                  />
                )
              })}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Age Band Table */}
      <div style={{ marginBottom: 20 }}>
        <style>{`
          .oa-age-th {
            position: sticky; top: 0; background: #f9f7f3; text-align: left;
            font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
            color: #9aaa9f; font-weight: 700; padding: 8px 12px;
            border-bottom: 1px solid #f0ede6;
          }
          .oa-age-td { padding: 10px 12px; font-size: 13px; color: #3a4a40; border-bottom: 1px solid #f9f7f3; }
          .oa-age-tr:hover .oa-age-td { background: #f9f7f3; }
        `}</style>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="oa-age-th">Band</th>
              <th className="oa-age-th" style={{ textAlign: 'right' }}>Blocks</th>
              <th className="oa-age-th" style={{ textAlign: 'right' }}>Ha</th>
              {hasProduction && <th className="oa-age-th" style={{ textAlign: 'right' }}>Median T/Ha</th>}
              {hasProduction && <th className="oa-age-th" style={{ textAlign: 'right' }}>Bruising</th>}
              <th className="oa-age-th" style={{ textAlign: 'center' }}>Pest</th>
            </tr>
          </thead>
          <tbody>
            {AGE_BANDS.map(b => {
              const s = bandStats[b.key]
              if (!s || s.count === 0) return null
              const isActive = selectedAgeBand === b.key
              return (
                <tr
                  key={b.key}
                  className="oa-age-tr"
                  style={bandRowStyle(b.key)}
                  onClick={() => onAgeBandSelect(isActive ? null : b.key)}
                >
                  <td className="oa-age-td">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{b.label}</div>
                        <div style={{ fontSize: 11, color: '#9aaa9f' }}>{b.range}</div>
                      </div>
                    </div>
                  </td>
                  <td className="oa-age-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.count}</td>
                  <td className="oa-age-td" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.totalHa)}</td>
                  {hasProduction && (
                    <td className="oa-age-td" style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {s.medianTonHa > 0 ? fmt(s.medianTonHa) : '—'}
                    </td>
                  )}
                  {hasProduction && (
                    <td className="oa-age-td" style={{
                      textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      color: s.avgBruising == null ? '#9aaa9f'
                        : s.avgBruising < 5 ? '#4caf72'
                        : s.avgBruising < 10 ? '#f5c842' : '#e85a4a',
                    }}>
                      {s.avgBruising != null ? `${s.avgBruising.toFixed(1)}%` : '—'}
                    </td>
                  )}
                  <td className="oa-age-td" style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
                      {s.pestRed > 0 && <span style={{ width: 8, height: 8, borderRadius: 2, background: '#e85a4a' }} title={`${s.pestRed} above threshold`} />}
                      {s.pestYellow > 0 && <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f5c842' }} title={`${s.pestYellow} approaching`} />}
                      {s.pestGreen > 0 && <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4caf72' }} title={`${s.pestGreen} below threshold`} />}
                      {s.pestRed === 0 && s.pestYellow === 0 && s.pestGreen === 0 && (
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#aaa' }} />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Season Trend: Median T/Ha by Age Band */}
      {hasProduction && historicalMedians && historicalMedians.length > 1 && (() => {
        // Build chart data: one row per age band, columns per season
        const hasData = historicalMedians.some(h => Object.keys(h.bands).length > 0)
        if (!hasData) return null

        const chartData = AGE_BANDS
          .filter(b => b.key !== 'establishing') // skip — no meaningful T/Ha
          .map(b => {
            const row: Record<string, string | number> = { band: b.label }
            historicalMedians.forEach(h => {
              row[h.season] = h.bands[b.key] != null ? Math.round(h.bands[b.key] * 10) / 10 : 0
            })
            return row
          })
          .filter(row => historicalMedians.some(h => (row[h.season] as number) > 0))

        if (chartData.length === 0) return null

        const SEASON_COLORS = ['#d4cfca', '#6b7fa8', '#2a6e45']

        return (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9aaa9f', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
              Median T/Ha by Age Band
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 8 }}>
                — 3 season comparison
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
                <XAxis
                  dataKey="band"
                  tick={{ fontSize: 11, fill: '#6a7a70', fontFamily: 'Inter' }}
                  tickLine={false} axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
                  tickLine={false} axisLine={false}
                  label={{ value: 'T/Ha', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9aaa9f' }}
                />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{
                        background: '#1c3a2a', color: '#e8f0e0', padding: '10px 14px',
                        borderRadius: 8, fontSize: 12, fontFamily: 'Inter, sans-serif',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
                        {payload.map((p: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill }} />
                            <span>{p.dataKey}:</span>
                            <strong>{p.value > 0 ? `${p.value} t/ha` : '—'}</strong>
                            {p.dataKey === currentSeason && <span style={{ color: '#a8d5a2', fontSize: 10, marginLeft: 4 }}>current</span>}
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend
                  verticalAlign="top" height={28}
                  formatter={(value: string) => (
                    <span style={{ fontSize: 11, color: value === currentSeason ? '#1c3a2a' : '#9aaa9f', fontWeight: value === currentSeason ? 700 : 400 }}>
                      {value}
                    </span>
                  )}
                />
                {historicalMedians.map((h, i) => (
                  <Bar
                    key={h.season}
                    dataKey={h.season}
                    fill={SEASON_COLORS[i] || SEASON_COLORS[SEASON_COLORS.length - 1]}
                    radius={[3, 3, 0, 0]}
                    opacity={h.season === currentSeason ? 1 : 0.7}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      })()}

      {/* Attention Required */}
      {problems.length > 0 && (
        <div style={{
          background: '#fef8f0', border: '1px solid #f5dcc0', borderRadius: 10,
          padding: '16px 20px',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#c4744a', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>&#9888;</span>
            Attention Required — {problems.length} orchard{problems.length !== 1 ? 's' : ''}
          </div>
          {(showAllProblems ? problems : problems.slice(0, 3)).map(p => (
            <div
              key={p.orchard.id}
              onClick={() => onOrchardSelect(p.orchard.id)}
              style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                background: '#fff', border: '1px solid #f0ede6', cursor: 'pointer',
                transition: 'border-color 0.15s',
                borderLeftWidth: 3,
                borderLeftColor: p.severity === 'high' ? '#e85a4a' : '#f5c842',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#1c3a2a' }}>{p.orchard.name}</span>
                  <span style={{ color: '#9aaa9f', fontSize: 12, marginLeft: 6 }}>
                    {p.orchard.variety || ''} · {p.age}yr
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#9aaa9f', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {p.orchard.tonHa != null && p.orchard.tonHa > 0 && (
                    <span>
                      <strong style={{ color: '#e85a4a' }}>{fmt(p.orchard.tonHa)}</strong>
                      {p.bandMedianTonHa > 0 && <span> / {fmt(p.bandMedianTonHa)} t/ha median</span>}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {p.flags.map(f => (
                  <span key={f} style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                    background: f === 'low_yield' || f === 'aging_decline' ? '#fde8e8' : f === 'quality' ? '#fef3e0' : '#fde8e8',
                    color: f === 'low_yield' || f === 'aging_decline' ? '#c0392b' : f === 'quality' ? '#c4744a' : '#c0392b',
                  }}>
                    {flagLabel(f)}
                  </span>
                ))}
                {p.orchard.ha != null && (
                  <span style={{ fontSize: 10, color: '#9aaa9f' }}>{fmt(p.orchard.ha)} ha</span>
                )}
              </div>
            </div>
          ))}
          {problems.length > 3 && !showAllProblems && (
            <button
              onClick={() => setShowAllProblems(true)}
              style={{
                background: 'none', border: 'none', color: '#c4744a', fontSize: 12,
                fontWeight: 600, cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit',
              }}
            >
              Show all {problems.length} orchards
            </button>
          )}
          {showAllProblems && problems.length > 3 && (
            <button
              onClick={() => setShowAllProblems(false)}
              style={{
                background: 'none', border: 'none', color: '#9aaa9f', fontSize: 12,
                cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit',
              }}
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}

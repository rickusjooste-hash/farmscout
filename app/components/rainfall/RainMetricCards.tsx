'use client'

interface Props {
  seasonTotal: number
  medianSeasonTotal: number
  lastRainDate: string | null
  lastRainMm: number
  daysAgo: number | null
  wettestDayDate: string | null
  wettestDayMm: number
  dryDays: number
  totalSeasonDays: number
  hasDailyData: boolean
}

export default function RainMetricCards(p: Props) {
  const delta = p.seasonTotal - p.medianSeasonTotal
  const deltaColor = delta >= 0 ? '#4caf72' : '#e85a4a'
  const deltaLabel = delta >= 0 ? `+${Math.round(delta)} mm ahead` : `${Math.round(delta)} mm behind`

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })

  return (
    <div style={s.strip} className="rain-kpi-strip">
      {/* Season to Date */}
      <div style={s.card}>
        <div style={s.accent} />
        <div style={s.label}>Season to Date</div>
        <div style={s.value}>
          {p.seasonTotal > 0 ? Math.round(p.seasonTotal) : '—'}
          <span style={s.unit}>mm</span>
        </div>
        {p.medianSeasonTotal > 0 && (
          <div style={{ fontSize: 12, color: deltaColor, marginTop: 6, fontWeight: 600 }}>
            {deltaLabel}
          </div>
        )}
      </div>

      {/* Last Rain */}
      <div style={s.card}>
        <div style={s.accent} />
        <div style={s.label}>Last Rain</div>
        {p.hasDailyData && p.daysAgo !== null ? (
          <>
            <div style={s.value}>
              {p.daysAgo}<span style={s.unit}>days ago</span>
            </div>
            <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 4 }}>
              {fmtDate(p.lastRainDate!)} &middot; {p.lastRainMm} mm
            </div>
          </>
        ) : (
          <div style={s.value}>&mdash;</div>
        )}
      </div>

      {/* Wettest Day */}
      <div style={s.card}>
        <div style={{ ...s.accent, background: 'linear-gradient(90deg, #2171b5, #6baed6)' }} />
        <div style={s.label}>Wettest Day</div>
        {p.hasDailyData && p.wettestDayDate ? (
          <>
            <div style={s.value}>
              {p.wettestDayMm}<span style={s.unit}>mm</span>
            </div>
            <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 4 }}>
              {fmtDate(p.wettestDayDate)}
            </div>
          </>
        ) : (
          <div style={s.value}>&mdash;</div>
        )}
      </div>

      {/* Dry Days */}
      <div style={s.card}>
        <div style={{ ...s.accent, background: p.hasDailyData ? 'linear-gradient(90deg, #e8924a, #f5c842)' : undefined }} />
        <div style={s.label}>Dry Days</div>
        {p.hasDailyData ? (
          <div style={s.value}>
            {p.dryDays}<span style={s.unit}>/ {p.totalSeasonDays} days</span>
          </div>
        ) : (
          <div style={s.value}>&mdash;</div>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  strip:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 },
  card:   { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px', position: 'relative', overflow: 'hidden' },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #2176d9, #a0c4f0)' },
  label:  { fontSize: 12, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 },
  value:  { fontSize: 32, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 },
  unit:   { fontSize: 14, color: '#8a95a0', fontWeight: 400, marginLeft: 4 },
}

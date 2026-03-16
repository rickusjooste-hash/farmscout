'use client'

import { useEffect, useState } from 'react'

interface WeatherSummary {
  station_code: string
  station_name: string
  farm_id: string
  current_temp: number | null
  today_eto: number | null
  today_rainfall: number | null
  last_reading_at: string | null
  eto_7day: number | null
  rainfall_7day: number | null
}

interface DailyWeather {
  station_code: string
  reading_date: string
  eto_mm: number | null
  rainfall_mm: number | null
  temp_min_c: number | null
  temp_max_c: number | null
  temp_avg_c: number | null
}

interface Props {
  farmIds: string[]
}

export default function WeatherStrip({ farmIds }: Props) {
  const [summary, setSummary] = useState<WeatherSummary[]>([])
  const [daily, setDaily] = useState<DailyWeather[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (farmIds.length === 0) return
    setLoading(true)
    fetch(`/api/weather?farm_ids=${farmIds.join(',')}&days=14`)
      .then(r => r.json())
      .then(data => {
        setSummary(data.summary || [])
        setDaily(data.daily || [])
      })
      .catch(err => console.error('WeatherStrip fetch error:', err))
      .finally(() => setLoading(false))
  }, [farmIds])

  if (loading || summary.length === 0) return null

  const station = summary[0]
  const lastReading = station.last_reading_at
    ? new Date(station.last_reading_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
    : null

  // ETo bar chart data (last 14 days)
  const maxEto = Math.max(...daily.map(d => d.eto_mm || 0), 1)

  return (
    <>
      <style>{`
        .weather-strip {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e4dc;
          padding: 20px 24px;
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
        }
        .weather-strip::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #3a8fd9, #5ec2d9);
        }
        .weather-metrics {
          display: flex;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
        }
        .weather-metric {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .weather-metric-value {
          font-size: 28px;
          font-weight: 700;
          color: #1a2a3a;
          line-height: 1;
        }
        .weather-metric-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #8a95a0;
          font-weight: 600;
          margin-top: 4px;
        }
        .weather-metric-sub {
          font-size: 11px;
          color: #b0bdb5;
          margin-top: 2px;
        }
        .weather-station-name {
          font-size: 14px;
          font-weight: 600;
          color: #1a2a3a;
          margin-right: auto;
        }
        .weather-station-meta {
          font-size: 11px;
          color: #8a95a0;
          margin-top: 2px;
        }
        .weather-chart {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 50px;
          margin-top: 16px;
          padding-top: 8px;
          border-top: 1px solid #f0ede8;
        }
        .weather-chart-bar {
          flex: 1;
          border-radius: 3px 3px 0 0;
          min-width: 10px;
          position: relative;
          cursor: default;
        }
        .weather-chart-bar:hover .weather-tooltip {
          display: block;
        }
        .weather-tooltip {
          display: none;
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: #1a2a3a;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          white-space: nowrap;
          z-index: 10;
        }
        .weather-chart-labels {
          display: flex;
          gap: 3px;
          margin-top: 4px;
        }
        .weather-chart-labels span {
          flex: 1;
          font-size: 9px;
          color: #b0bdb5;
          text-align: center;
          min-width: 10px;
        }
        .weather-expand-btn {
          background: none;
          border: 1px solid #e0ddd5;
          border-radius: 6px;
          padding: 3px 8px;
          cursor: pointer;
          font-size: 13px;
          color: #7a8a9a;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .weather-strip { padding: 14px 16px; margin-bottom: 14px; }
          .weather-metrics { gap: 20px; }
          .weather-metric-value { font-size: 22px; }
          .weather-station-name { font-size: 13px; }
          .weather-chart { height: 40px; }
        }
      `}</style>

      <div className="weather-strip">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: expanded ? 0 : 0 }}>
          <div style={{ marginRight: 'auto' }}>
            <div className="weather-station-name">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a8fd9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6, marginTop: -2 }}>
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
              </svg>
              {station.station_name}
            </div>
            {lastReading && (
              <div className="weather-station-meta">Last reading: {lastReading}</div>
            )}
          </div>

          <div className="weather-metrics">
            <div className="weather-metric">
              <div className="weather-metric-value">
                {station.current_temp !== null ? `${Math.round(station.current_temp)}°` : '—'}
              </div>
              <div className="weather-metric-label">Temp</div>
            </div>

            <div className="weather-metric">
              <div className="weather-metric-value" style={{ color: '#3a8fd9' }}>
                {station.today_eto !== null ? station.today_eto.toFixed(1) : '—'}
              </div>
              <div className="weather-metric-label">ETo mm</div>
              <div className="weather-metric-sub">today</div>
            </div>

            <div className="weather-metric">
              <div className="weather-metric-value" style={{ color: station.today_rainfall && station.today_rainfall > 0 ? '#3a8fd9' : '#1a2a3a' }}>
                {station.today_rainfall !== null ? station.today_rainfall.toFixed(1) : '0'}
              </div>
              <div className="weather-metric-label">Rain mm</div>
              <div className="weather-metric-sub">today</div>
            </div>

            <div className="weather-metric" style={{ opacity: 0.7 }}>
              <div className="weather-metric-value" style={{ fontSize: 20 }}>
                {station.eto_7day !== null ? station.eto_7day.toFixed(1) : '—'}
              </div>
              <div className="weather-metric-label">ETo 7d</div>
            </div>

            <div className="weather-metric" style={{ opacity: 0.7 }}>
              <div className="weather-metric-value" style={{ fontSize: 20 }}>
                {station.rainfall_7day !== null ? station.rainfall_7day.toFixed(1) : '0'}
              </div>
              <div className="weather-metric-label">Rain 7d</div>
            </div>
          </div>

          <button
            className="weather-expand-btn"
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Hide ETo chart' : 'Show ETo chart'}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#x25BC;</span>
          </button>
        </div>

        {expanded && daily.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8a95a0', marginTop: 14, marginBottom: 4 }}>
              Daily ETo &amp; Rainfall — last 14 days
            </div>
            <div className="weather-chart">
              {daily.map((d, i) => {
                const etoH = d.eto_mm ? (d.eto_mm / maxEto) * 100 : 0
                const hasRain = (d.rainfall_mm || 0) > 0
                return (
                  <div
                    key={i}
                    className="weather-chart-bar"
                    style={{
                      height: `${Math.max(etoH, 4)}%`,
                      background: hasRain
                        ? 'linear-gradient(180deg, #3a8fd9, #a0d4f0)'
                        : 'linear-gradient(180deg, #f0a500, #f5d080)',
                    }}
                  >
                    <div className="weather-tooltip">
                      {new Date(d.reading_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      <br />ETo: {d.eto_mm?.toFixed(1) ?? '—'} mm
                      {hasRain && <><br />Rain: {d.rainfall_mm?.toFixed(1)} mm</>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="weather-chart-labels">
              {daily.map((d, i) => (
                <span key={i}>
                  {i === 0 || i === daily.length - 1 || i === Math.floor(daily.length / 2)
                    ? new Date(d.reading_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
                    : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

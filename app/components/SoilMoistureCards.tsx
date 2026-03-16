'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-auth'

interface ProbeReading {
  probe_id: string
  probe_name: string
  orchard_name: string
  orchard_id: string
  depths: Array<{
    depth_cm: number
    vwc_pct: number
    soil_temp_c: number | null
    status: 'green' | 'yellow' | 'red' | 'grey'
  }>
  last_reading: string | null
}

interface Props {
  farmIds: string[]
}

function getStatus(vwc: number, fc?: number | null, pwp?: number | null, refill?: number | null): 'green' | 'yellow' | 'red' | 'grey' {
  // If we have calibration values, use them
  if (fc && pwp) {
    const range = fc - pwp
    const refillPct = refill ?? (pwp + range * 0.3) // default refill at 30% of available water
    if (vwc >= refillPct) return 'green'
    if (vwc >= pwp + range * 0.15) return 'yellow'
    return 'red'
  }
  // Generic thresholds for deciduous fruit on sandy loam
  if (vwc >= 18) return 'green'
  if (vwc >= 12) return 'yellow'
  return 'red'
}

const STATUS_COLORS: Record<string, string> = {
  green: '#4caf72',
  yellow: '#f5c842',
  red: '#e85a4a',
  grey: '#aaaaaa',
}

const STATUS_BG: Record<string, string> = {
  green: '#e8f5e9',
  yellow: '#fff8e1',
  red: '#fce4ec',
  grey: '#f5f5f5',
}

export default function SoilMoistureCards({ farmIds }: Props) {
  const supabase = createClient()
  const [probes, setProbes] = useState<ProbeReading[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (farmIds.length === 0) return

    async function fetchData() {
      // Get probes with their orchards
      const { data: probeData } = await supabase
        .from('aquacheck_probes')
        .select('id, probe_name, orchard_id, field_capacity_pct, permanent_wilting_pct, refill_point_pct, orchards!inner(name)')
        .in('farm_id', farmIds)
        .eq('is_active', true)

      if (!probeData || probeData.length === 0) {
        setLoading(false)
        return
      }

      // For each probe, get latest readings at each depth
      const results: ProbeReading[] = []

      for (const probe of probeData) {
        const { data: readings } = await supabase
          .from('soil_moisture_readings')
          .select('depth_cm, vwc_pct, soil_temp_c, reading_at')
          .eq('probe_id', probe.id)
          .order('reading_at', { ascending: false })
          .limit(6) // max 6 depths per probe

        if (!readings || readings.length === 0) continue

        // Group by depth, take latest per depth
        const byDepth: Record<number, typeof readings[0]> = {}
        for (const r of readings) {
          if (!byDepth[r.depth_cm]) byDepth[r.depth_cm] = r
        }

        const orchardInfo = probe.orchards as any
        results.push({
          probe_id: probe.id,
          probe_name: probe.probe_name || 'Unknown',
          orchard_name: orchardInfo?.name || 'Unknown',
          orchard_id: probe.orchard_id || '',
          last_reading: readings[0]?.reading_at || null,
          depths: Object.values(byDepth)
            .sort((a, b) => a.depth_cm - b.depth_cm)
            .map(r => ({
              depth_cm: r.depth_cm,
              vwc_pct: r.vwc_pct,
              soil_temp_c: r.soil_temp_c,
              status: getStatus(r.vwc_pct, probe.field_capacity_pct, probe.permanent_wilting_pct, probe.refill_point_pct),
            })),
        })
      }

      setProbes(results)
      setLoading(false)
    }

    fetchData()
  }, [farmIds])

  if (loading || probes.length === 0) return null

  return (
    <>
      <style>{`
        .soil-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .soil-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e8e4dc;
          padding: 20px 24px;
          position: relative;
          overflow: hidden;
        }
        .soil-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
        }
        .soil-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .soil-card-title {
          font-size: 15px;
          font-weight: 600;
          color: #1a2a3a;
        }
        .soil-card-subtitle {
          font-size: 11px;
          color: #8a95a0;
          margin-top: 2px;
        }
        .soil-card-meta {
          font-size: 11px;
          color: #8a95a0;
          text-align: right;
        }
        .soil-depths {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .soil-depth-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .soil-depth-label {
          font-size: 12px;
          color: #7a8a9a;
          width: 45px;
          flex-shrink: 0;
          text-align: right;
        }
        .soil-depth-bar-bg {
          flex: 1;
          height: 14px;
          background: #f0ede8;
          border-radius: 7px;
          overflow: hidden;
          position: relative;
        }
        .soil-depth-bar-fill {
          height: 100%;
          border-radius: 7px;
          transition: width 0.6s ease;
          min-width: 2px;
        }
        .soil-depth-value {
          font-size: 12px;
          font-weight: 600;
          width: 48px;
          flex-shrink: 0;
        }
        .soil-depth-temp {
          font-size: 11px;
          color: #b0bdb5;
          width: 35px;
          flex-shrink: 0;
          text-align: right;
        }
        .soil-overall-status {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        @media (max-width: 768px) {
          .soil-cards { grid-template-columns: 1fr; gap: 12px; margin-bottom: 14px; }
          .soil-card { padding: 14px 16px; }
        }
      `}</style>

      <div className="soil-cards">
        {probes.map(probe => {
          // Overall status = worst depth status
          const worstStatus = probe.depths.reduce((worst, d) => {
            const order = { red: 0, yellow: 1, green: 2, grey: 3 }
            return order[d.status] < order[worst] ? d.status : worst
          }, 'green' as 'green' | 'yellow' | 'red' | 'grey')

          const lastTime = probe.last_reading
            ? new Date(probe.last_reading).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
            : null

          // Max VWC for bar scaling (use 35 as ceiling or max value, whichever is higher)
          const maxVwc = Math.max(35, ...probe.depths.map(d => d.vwc_pct))

          return (
            <div
              key={probe.probe_id}
              className="soil-card"
              style={{ borderLeft: `4px solid ${STATUS_COLORS[worstStatus]}` }}
            >
              <div
                className="soil-card::before"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, ${STATUS_COLORS[worstStatus]}, ${STATUS_COLORS[worstStatus]}80)`,
                }}
              />
              <div className="soil-card-header">
                <div>
                  <div className="soil-card-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={STATUS_COLORS[worstStatus]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6, marginTop: -2 }}>
                      <path d="M12 2v20M2 12h20" />
                    </svg>
                    {probe.orchard_name}
                  </div>
                  <div className="soil-card-subtitle">{probe.probe_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    className="soil-overall-status"
                    style={{ background: STATUS_BG[worstStatus], color: STATUS_COLORS[worstStatus] }}
                  >
                    {worstStatus === 'red' ? 'Stress' : worstStatus === 'yellow' ? 'Low' : 'OK'}
                  </span>
                  {lastTime && <div className="soil-card-meta" style={{ marginTop: 4 }}>{lastTime}</div>}
                </div>
              </div>

              <div className="soil-depths">
                {probe.depths.map(d => (
                  <div className="soil-depth-row" key={d.depth_cm}>
                    <div className="soil-depth-label">{d.depth_cm}cm</div>
                    <div className="soil-depth-bar-bg">
                      <div
                        className="soil-depth-bar-fill"
                        style={{
                          width: `${(d.vwc_pct / maxVwc) * 100}%`,
                          background: STATUS_COLORS[d.status],
                        }}
                      />
                    </div>
                    <div className="soil-depth-value" style={{ color: STATUS_COLORS[d.status] }}>
                      {d.vwc_pct.toFixed(1)}%
                    </div>
                    <div className="soil-depth-temp">
                      {d.soil_temp_c !== null ? `${d.soil_temp_c.toFixed(0)}°` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

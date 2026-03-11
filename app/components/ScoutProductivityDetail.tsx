'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import ScoutQualityFlags from './ScoutQualityFlags'
import type { DailyRow, WeeklyRow, QualityFlag } from './ScoutProductivityTable'

// ── Types ──────────────────────────────────────────────────────────────────

interface TrackPoint {
  inspection_type: string
  inspected_at: string
  lat: number | null
  lng: number | null
  label: string
  is_break: boolean
}

interface Props {
  scoutId: string
  scoutName: string
  day: string
  dailyData: DailyRow[]
  weeklyData: WeeklyRow[]
  qualityFlags: QualityFlag[]
  supabase: any
  onClose: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  })
}

const LINE_COLORS = ['#2a6e45', '#e8924a', '#6b7fa8']

// ── Component ──────────────────────────────────────────────────────────────

export default function ScoutProductivityDetail({
  scoutId, scoutName, day, dailyData, weeklyData, qualityFlags, supabase, onClose,
}: Props) {
  const [track, setTrack] = useState<TrackPoint[]>([])
  const [loadingTrack, setLoadingTrack] = useState(false)
  const [activeTab, setActiveTab] = useState<'map' | 'flags' | 'trends'>('map')

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const trackLayerRef = useRef<any>(null)

  const scoutFlags = useMemo(
    () => qualityFlags.filter(f => f.scout_id === scoutId),
    [qualityFlags, scoutId]
  )

  const todayRow = useMemo(
    () => dailyData.find(d => d.scout_id === scoutId && d.day === day),
    [dailyData, scoutId, day]
  )

  const scoutWeeks = useMemo(
    () => weeklyData
      .filter(w => w.scout_id === scoutId)
      .sort((a, b) => a.week_start.localeCompare(b.week_start)),
    [weeklyData, scoutId]
  )

  // ── Load GPS track ────────────────────────────────────────────────────

  useEffect(() => {
    ;(async () => {
      setLoadingTrack(true)
      const { data, error } = await supabase.rpc('get_scout_distance_track', {
        p_scout_id: scoutId,
        p_day: day,
      })
      if (!error && data) setTrack(data)
      setLoadingTrack(false)
    })()
  }, [scoutId, day])

  // ── Init map ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    ;(async () => {
      const L = (await import('leaflet')).default
      leafletRef.current = L
      if ((mapContainerRef.current as any)?._leaflet_id) return

      const map = L.map(mapContainerRef.current!, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
        maxZoom: 19,
      })
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 18 }
      ).addTo(map)
      map.setView([-33.9, 18.9], 13)
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 200)
    })()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // ── Draw track on map ─────────────────────────────────────────────────

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map || !track.length) return

    if (trackLayerRef.current) trackLayerRef.current.remove()
    const group = L.featureGroup()

    const gpsPoints = track.filter(p => p.lat && p.lng)
    if (!gpsPoints.length) return

    // Draw segments (solid for active, dashed for breaks)
    for (let i = 1; i < gpsPoints.length; i++) {
      const prev = gpsPoints[i - 1]
      const curr = gpsPoints[i]
      const latlngs = [[prev.lat, prev.lng], [curr.lat, curr.lng]]
      L.polyline(latlngs, {
        color: curr.is_break ? '#f5c842' : '#4caf72',
        weight: curr.is_break ? 2 : 3,
        dashArray: curr.is_break ? '8 6' : undefined,
        opacity: 0.85,
      }).addTo(group)
    }

    // Draw markers
    gpsPoints.forEach((p, i) => {
      const isFirst = i === 0
      const isLast = i === gpsPoints.length - 1
      const color = p.inspection_type === 'trap' ? '#4caf72' : '#6b7fa8'

      const marker = L.circleMarker([p.lat!, p.lng!], {
        radius: isFirst || isLast ? 7 : 4,
        fillColor: isFirst ? '#2a6e45' : isLast ? '#e85a4a' : color,
        color: '#fff',
        weight: isFirst || isLast ? 2 : 1,
        fillOpacity: 0.9,
      }).addTo(group)

      marker.bindTooltip(
        `<div class="spd-tooltip">
          <strong>${p.label}</strong><br/>
          ${fmtTime(p.inspected_at)}
          ${p.is_break ? '<br/><em style="color:#f5c842">Break before</em>' : ''}
        </div>`,
        { className: 'spd-tooltip-wrap' }
      )
    })

    group.addTo(map)
    trackLayerRef.current = group
    map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 17 })
  }, [track])

  // ── Timeline bar data ─────────────────────────────────────────────────

  const timelineData = useMemo(() => {
    if (!track.length) return []
    const dayStart = new Date(track[0].inspected_at)
    dayStart.setHours(0, 0, 0, 0)

    return track.map(p => {
      const t = new Date(p.inspected_at)
      const minuteOfDay = t.getHours() * 60 + t.getMinutes()
      return {
        minute: minuteOfDay,
        type: p.inspection_type,
        label: p.label,
        isBreak: p.is_break,
        time: fmtTime(p.inspected_at),
      }
    })
  }, [track])

  // ── Speed histogram data ──────────────────────────────────────────────

  const speedHistogram = useMemo(() => {
    if (!track.length) return []
    const gaps: number[] = []
    for (let i = 1; i < track.length; i++) {
      if (track[i].is_break) continue
      const gap = (new Date(track[i].inspected_at).getTime() - new Date(track[i - 1].inspected_at).getTime()) / 1000
      if (gap > 0 && gap < 1800) gaps.push(gap)
    }
    // Bucket into 30s bins
    const buckets: Record<string, number> = {}
    for (const g of gaps) {
      const bin = Math.floor(g / 30) * 30
      const label = `${bin}-${bin + 30}s`
      buckets[label] = (buckets[label] || 0) + 1
    }
    return Object.entries(buckets)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => parseInt(a.label) - parseInt(b.label))
  }, [track])

  // ── Weekly trend chart data ───────────────────────────────────────────

  const weeklyChartData = useMemo(() =>
    scoutWeeks.map(w => ({
      week: `W${w.week_nr}`,
      Traps: w.total_traps,
      Trees: w.total_trees,
      Quality: Math.round(w.quality_score * 100),
    })),
    [scoutWeeks]
  )

  // ── Render ────────────────────────────────────────────────────────────

  const minMinute = timelineData.length ? Math.min(...timelineData.map(d => d.minute)) : 0
  const maxMinute = timelineData.length ? Math.max(...timelineData.map(d => d.minute)) : 1440
  const timeRange = Math.max(maxMinute - minMinute, 1)

  return (
    <div className="spd-detail">
      {/* Header */}
      <div className="spd-detail-header">
        <button className="spd-back" onClick={onClose}>← All scouts</button>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#1c3a2a' }}>{scoutName}</div>
          <div style={{ fontSize: 12, color: '#9aaa9f' }}>
            {new Date(day).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* KPI row */}
      {todayRow && (
        <div className="spd-kpi-row">
          <div className="spd-kpi">
            <div className="spd-kpi-val">{todayRow.traps_inspected}</div>
            <div className="spd-kpi-lbl">Traps</div>
          </div>
          <div className="spd-kpi">
            <div className="spd-kpi-val">{todayRow.trees_inspected}</div>
            <div className="spd-kpi-lbl">Trees</div>
          </div>
          <div className="spd-kpi">
            <div className="spd-kpi-val">{Math.floor(todayRow.active_minutes / 60)}h {todayRow.active_minutes % 60}m</div>
            <div className="spd-kpi-lbl">Active</div>
          </div>
          <div className="spd-kpi">
            <div className="spd-kpi-val">{todayRow.distance_walked_m >= 1000 ? `${(todayRow.distance_walked_m / 1000).toFixed(1)} km` : `${Math.round(todayRow.distance_walked_m)} m`}</div>
            <div className="spd-kpi-lbl">Distance</div>
          </div>
          <div className="spd-kpi">
            <div className="spd-kpi-val">{todayRow.break_count}</div>
            <div className="spd-kpi-lbl">Breaks</div>
          </div>
        </div>
      )}

      {/* Timeline bar */}
      {timelineData.length > 0 && (
        <div className="spd-card">
          <div className="spd-card-title">Day Timeline</div>
          <div className="spd-timeline">
            <div className="spd-timeline-bar">
              {timelineData.map((d, i) => (
                <div
                  key={i}
                  className="spd-timeline-dot"
                  style={{
                    left: `${((d.minute - minMinute) / timeRange) * 100}%`,
                    background: d.isBreak ? '#f5c842'
                      : d.type === 'trap' ? '#4caf72' : '#6b7fa8',
                  }}
                  title={`${d.time} — ${d.label}${d.isBreak ? ' (break)' : ''}`}
                />
              ))}
            </div>
            <div className="spd-timeline-labels">
              <span>{Math.floor(minMinute / 60).toString().padStart(2, '0')}:{(minMinute % 60).toString().padStart(2, '0')}</span>
              <span>{Math.floor(maxMinute / 60).toString().padStart(2, '0')}:{(maxMinute % 60).toString().padStart(2, '0')}</span>
            </div>
            <div className="spd-timeline-legend">
              <span><span style={{ background: '#4caf72' }} className="spd-legend-dot" /> Trap</span>
              <span><span style={{ background: '#6b7fa8' }} className="spd-legend-dot" /> Tree</span>
              <span><span style={{ background: '#f5c842' }} className="spd-legend-dot" /> Break</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="spd-tabs">
        <button className={`spd-tab${activeTab === 'map' ? ' active' : ''}`} onClick={() => setActiveTab('map')}>Route Map</button>
        <button className={`spd-tab${activeTab === 'flags' ? ' active' : ''}`} onClick={() => setActiveTab('flags')}>
          Quality Flags
          {scoutFlags.length > 0 && <span className="spd-tab-badge">{scoutFlags.length}</span>}
        </button>
        <button className={`spd-tab${activeTab === 'trends' ? ' active' : ''}`} onClick={() => setActiveTab('trends')}>Weekly Trends</button>
      </div>

      {/* Tab content */}
      {activeTab === 'map' && (
        <div className="spd-card">
          <div className="spd-card-title">GPS Route Replay</div>
          {loadingTrack && <div style={{ padding: 20, color: '#9aaa9f', textAlign: 'center' }}>Loading track...</div>}
          <div ref={mapContainerRef} className="spd-map" />
          {track.length > 0 && !track.some(p => p.lat) && (
            <div style={{ padding: 12, textAlign: 'center', color: '#9aaa9f', fontSize: 12 }}>
              No GPS data available for this day
            </div>
          )}
        </div>
      )}

      {activeTab === 'map' && speedHistogram.length > 0 && (
        <div className="spd-card">
          <div className="spd-card-title">Inspection Speed Distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={speedHistogram} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9aaa9f' }}
                tickLine={false}
                axisLine={{ stroke: '#f0ede6' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9aaa9f' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#1c3a2a', border: 'none', borderRadius: 8, color: '#e8e8d8', fontSize: 12 }}
                labelStyle={{ color: '#a8d5a2' }}
              />
              <Bar dataKey="count" fill="#2a6e45" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'flags' && (
        <div className="spd-card" style={{ padding: 0 }}>
          <ScoutQualityFlags
            flags={scoutFlags}
            scoutName={scoutName}
            onClose={() => setActiveTab('map')}
          />
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="spd-card">
          <div className="spd-card-title">8-Week Trend</div>
          {weeklyChartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
                  tickLine={false}
                  axisLine={{ stroke: '#f0ede6' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9aaa9f', fontFamily: 'Inter' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#1c3a2a', border: 'none', borderRadius: 10, color: '#e8e8d8', fontSize: 12 }}
                  labelStyle={{ color: '#a8d5a2' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="Traps" stroke={LINE_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="Trees" stroke={LINE_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
                <Line dataKey="Quality" stroke={LINE_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: '#9aaa9f' }}>
              Not enough weekly data for trend chart
            </div>
          )}
        </div>
      )}

      <style>{`
        .spd-detail {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .spd-detail-header {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .spd-back {
          background: none;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 13px;
          color: #2a6e45;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          white-space: nowrap;
        }
        .spd-back:hover { background: #f9f7f3; }
        .spd-kpi-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .spd-kpi {
          flex: 1;
          min-width: 80px;
          background: #fafaf8;
          border-radius: 10px;
          padding: 12px 14px;
          text-align: center;
        }
        .spd-kpi-val {
          font-size: 18px;
          font-weight: 700;
          color: #1c3a2a;
        }
        .spd-kpi-lbl {
          font-size: 11px;
          color: #9aaa9f;
          margin-top: 2px;
        }
        .spd-card {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #e8e4dc;
          overflow: hidden;
        }
        .spd-card-title {
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #1c3a2a;
          border-bottom: 1px solid #f0ede6;
        }
        .spd-map {
          height: 340px;
          width: 100%;
        }
        .spd-tabs {
          display: flex;
          gap: 0;
          border-bottom: 2px solid #f0ede6;
        }
        .spd-tab {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #9aaa9f;
          background: none;
          border: none;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          font-family: 'Inter', sans-serif;
          position: relative;
        }
        .spd-tab:hover { color: #1c3a2a; }
        .spd-tab.active {
          color: #2a6e45;
          border-bottom-color: #2a6e45;
        }
        .spd-tab-badge {
          display: inline-block;
          background: #e85a4a;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 8px;
          margin-left: 4px;
        }
        .spd-timeline {
          padding: 16px;
        }
        .spd-timeline-bar {
          position: relative;
          height: 24px;
          background: #f0ede6;
          border-radius: 12px;
          margin-bottom: 6px;
        }
        .spd-timeline-dot {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1px solid #fff;
          cursor: pointer;
        }
        .spd-timeline-labels {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #9aaa9f;
        }
        .spd-timeline-legend {
          display: flex;
          gap: 12px;
          margin-top: 6px;
          font-size: 11px;
          color: #6a7a70;
        }
        .spd-legend-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 3px;
        }
        .spd-tooltip-wrap {
          background: #1c3a2a !important;
          border: none !important;
          border-radius: 8px !important;
          color: #e8e8d8 !important;
          font-size: 12px !important;
          padding: 6px 10px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .spd-tooltip-wrap::before {
          border-top-color: #1c3a2a !important;
        }
        @media (max-width: 768px) {
          .spd-map { height: 260px; }
          .spd-kpi-row { gap: 6px; }
          .spd-kpi { padding: 8px 6px; min-width: 60px; }
          .spd-kpi-val { font-size: 15px; }
        }
      `}</style>
    </div>
  )
}

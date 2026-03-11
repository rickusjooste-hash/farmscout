'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase-auth'

interface OrchardDetail {
  id: string
  name: string
  variety: string | null
  varietyGroup: string | null
  rootstock: string | null
  commodityName: string
  farmCode: string
  ha: number | null
  yearPlanted: number | null
  nrOfTrees: number | null
  bins: number
  juice: number
  total: number
  tons: number
  tonHa: number | null
  bruisingPct: number | null
  pestStatus: string
  pestCount: number
}

interface Props {
  orchard: OrchardDetail | null
  open: boolean
  onClose: () => void
  season: string
  prevSeasonTons: number | null
  prevSeasonTonHa: number | null
  hasProduction: boolean
}

const STATUS_LABELS: Record<string, { color: string; label: string }> = {
  green:  { color: '#4caf72', label: 'Below threshold' },
  yellow: { color: '#f5c842', label: 'Approaching' },
  red:    { color: '#e85a4a', label: 'Above threshold' },
  blue:   { color: '#6b7fa8', label: 'No threshold' },
  grey:   { color: '#aaaaaa', label: 'No data' },
}

function delta(current: number | null, prev: number | null): string {
  if (current == null || prev == null || prev === 0) return ''
  const pct = ((current - prev) / prev) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

function deltaColor(current: number | null, prev: number | null): string {
  if (current == null || prev == null) return '#8a95a0'
  return current >= prev ? '#4caf72' : '#e85a4a'
}

export default function BlockDetailPanel({ orchard, open, onClose, season, prevSeasonTons, prevSeasonTonHa, hasProduction }: Props) {
  const [weeklyData, setWeeklyData] = useState<{ week: number; total: number }[]>([])
  const [loadingWeekly, setLoadingWeekly] = useState(false)

  // Load weekly production for this orchard
  useEffect(() => {
    if (!orchard || !open || !hasProduction) { setWeeklyData([]); return }
    setLoadingWeekly(true)
    const supabase = createClient()
    supabase.rpc('get_orchard_weekly_production', {
      p_orchard_id: orchard.id,
      p_season: season,
    }).then(({ data, error }) => {
      if (error) console.error('Weekly production error:', error)
      setWeeklyData((data || []).map((r: any) => ({ week: r.week_num, total: Number(r.total) })))
      setLoadingWeekly(false)
    })
  }, [orchard?.id, open, season, hasProduction])

  return (
    <>
      <style>{`
        .oa-panel-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.2);
          z-index: 8000; opacity: 0; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .oa-panel-overlay.open { opacity: 1; pointer-events: auto; }
        .oa-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 380px; max-width: 100vw; background: #fff;
          z-index: 8001; overflow-y: auto;
          transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: -4px 0 24px rgba(0,0,0,0.08);
          font-family: 'Inter', sans-serif;
        }
        .oa-panel.open { transform: translateX(0); }
        @media (max-width: 480px) { .oa-panel { width: 100vw; } }
      `}</style>

      <div className={`oa-panel-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`oa-panel${open ? ' open' : ''}`}>
        {orchard && (
          <>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2a3a' }}>{orchard.name}</div>
                <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 2 }}>{orchard.commodityName} · {orchard.farmCode}</div>
              </div>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e4dc',
                background: '#fff', fontSize: 16, cursor: 'pointer', color: '#6a7a70',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>&times;</button>
            </div>

            {/* Identity */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                <div><span style={{ color: '#8a95a0' }}>Variety</span><br /><strong style={{ color: '#1a2a3a' }}>{orchard.variety || '—'}</strong></div>
                <div><span style={{ color: '#8a95a0' }}>Rootstock</span><br /><strong style={{ color: '#1a2a3a' }}>{orchard.rootstock || '—'}</strong></div>
                <div><span style={{ color: '#8a95a0' }}>Hectares</span><br /><strong style={{ color: '#1a2a3a' }}>{orchard.ha != null ? orchard.ha.toLocaleString('en-ZA', { maximumFractionDigits: 1 }) : '—'}</strong></div>
                <div><span style={{ color: '#8a95a0' }}>Planted</span><br /><strong style={{ color: '#1a2a3a' }}>{orchard.yearPlanted || '—'}</strong></div>
                <div><span style={{ color: '#8a95a0' }}>Trees</span><br /><strong style={{ color: '#1a2a3a' }}>{orchard.nrOfTrees?.toLocaleString('en-ZA') || '—'}</strong></div>
              </div>
            </div>

            {/* Production */}
            {hasProduction && (
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                  This Season
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 13 }}>
                  <div>
                    <div style={{ color: '#8a95a0', fontSize: 11 }}>Bins</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2a3a' }}>{Math.round(orchard.bins).toLocaleString('en-ZA')}</div>
                  </div>
                  <div>
                    <div style={{ color: '#8a95a0', fontSize: 11 }}>Tons</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2a3a' }}>{orchard.tons.toLocaleString('en-ZA', { maximumFractionDigits: 1 })}</div>
                    {prevSeasonTons != null && (
                      <div style={{ fontSize: 11, color: deltaColor(orchard.tons, prevSeasonTons), fontWeight: 600 }}>
                        {delta(orchard.tons, prevSeasonTons)} vs prev
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ color: '#8a95a0', fontSize: 11 }}>T/Ha</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2a3a' }}>{orchard.tonHa != null ? orchard.tonHa.toLocaleString('en-ZA', { maximumFractionDigits: 1 }) : '—'}</div>
                    {prevSeasonTonHa != null && (
                      <div style={{ fontSize: 11, color: deltaColor(orchard.tonHa, prevSeasonTonHa), fontWeight: 600 }}>
                        {delta(orchard.tonHa, prevSeasonTonHa)} vs prev
                      </div>
                    )}
                  </div>
                </div>

                {/* Weekly production chart */}
                {loadingWeekly ? (
                  <div style={{ color: '#8a95a0', fontSize: 12, marginTop: 16 }}>Loading weekly data...</div>
                ) : weeklyData.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: '#8a95a0', marginBottom: 6 }}>Weekly bins</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#8a95a0' }} tickLine={false} axisLine={false} tickFormatter={v => `W${v}`} />
                        <YAxis tick={{ fontSize: 10, fill: '#8a95a0' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null
                            return (
                              <div style={{ background: '#1a4ba0', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                                W{payload[0].payload.week}: <strong>{Math.round(payload[0].value).toLocaleString('en-ZA')} bins</strong>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="total" fill="#2176d9" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </div>
            )}

            {/* Quality */}
            {hasProduction && orchard.bruisingPct != null && (
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef2fa' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                  Quality
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: '#8a95a0' }}>Avg Bruising: </span>
                  <strong style={{ color: orchard.bruisingPct < 5 ? '#4caf72' : orchard.bruisingPct < 10 ? '#f5c842' : '#e85a4a' }}>
                    {orchard.bruisingPct.toFixed(1)}%
                  </strong>
                </div>
              </div>
            )}

            {/* Pest Status */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                Pest Status (This Week)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 3,
                  background: STATUS_LABELS[orchard.pestStatus]?.color || '#aaa',
                }} />
                <span style={{ fontSize: 13, color: '#3a4a40' }}>
                  {STATUS_LABELS[orchard.pestStatus]?.label || 'Unknown'}
                  {orchard.pestCount > 0 && ` · ${orchard.pestCount} total count`}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

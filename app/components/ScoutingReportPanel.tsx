'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'

interface TrapReportRow {
  commodity_code: string
  commodity_name: string
  orchard_id: string
  orchard_display: string
  pest_id: string
  pest_name: string
  pest_abbr: string
  this_week_count: number
  last_week_count: number
}

interface OrchardSummary {
  id: string
  display: string
  total: number
  alertCount: number
}

interface Props {
  orgId: string
  farmId: string
  farmName?: string
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export default function ScoutingReportPanel({ orgId: _orgId, farmId, farmName }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<TrapReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendResult, setSendResult] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .rpc('get_weekly_trap_report', { p_farm_id: farmId })
      .then(({ data, error }) => {
        if (error) console.error('get_weekly_trap_report error:', error)
        setRows((data as TrapReportRow[]) || [])
        setLoading(false)
      })
  }, [farmId])  // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a' }}>
            Trap Report{farmName ? <span style={{ fontSize: 13, fontWeight: 400, color: '#7a8a80', marginLeft: 8 }}>{farmName}</span> : null}
          </div>
          <div style={{ color: '#9aaa9f', fontSize: 13, marginTop: 4 }}>Loading…</div>
        </div>
      </div>
    )
  }

  if (rows.length === 0) return null

  // Aggregate per orchard
  const orchardMap = new Map<string, OrchardSummary>()
  for (const r of rows) {
    if (!orchardMap.has(r.orchard_id)) {
      orchardMap.set(r.orchard_id, { id: r.orchard_id, display: r.orchard_display, total: 0, alertCount: 0 })
    }
    const entry = orchardMap.get(r.orchard_id)!
    entry.total += Number(r.this_week_count)
    if (Number(r.this_week_count) >= 5) entry.alertCount++
  }
  const orchards = [...orchardMap.values()].sort((a, b) => b.total - a.total)

  const totalCatch = orchards.reduce((s, o) => s + o.total, 0)
  const alertOrchards = orchards.filter(o => o.alertCount > 0).length
  const weekNr = getISOWeekNumber(new Date())

  const topBorderColor = alertOrchards > 0 ? '#e85a4a' : '#2a6e45'

  async function handleSendReport() {
    setSendStatus('sending')
    setSendResult(null)
    try {
      const res = await fetch('/api/scouting-report/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farm_id: farmId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      if (data.recipientCount === 0 && data.message) {
        setSendResult('No recipients configured')
      } else {
        setSendResult(`Sent to ${data.recipientCount} recipient${data.recipientCount !== 1 ? 's' : ''}`)
      }
      setSendStatus('sent')
    } catch (err: any) {
      setSendStatus('error')
      setSendResult(err.message)
    }
  }

  return (
    <div style={{ ...cardStyle, borderTop: `3px solid ${topBorderColor}`, marginBottom: 20 }}>
      {/* Header */}
      <button
        onClick={() => setPanelExpanded(e => !e)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a', flex: 1 }}>
          Trap Report{farmName ? <span style={{ fontSize: 13, fontWeight: 400, color: '#7a8a80', marginLeft: 8 }}>{farmName}</span> : null}
        </div>
        <span style={{ fontSize: 12, background: '#f4f1eb', color: '#7a8a80', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
          W{weekNr} · {orchards.length} orchards
        </span>
        <span style={{ fontSize: 12, background: '#f4f1eb', color: '#7a8a80', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
          {totalCatch} caught
        </span>
        {alertOrchards > 0 && (
          <span style={{ fontSize: 12, background: '#fdecea', color: '#e85a4a', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            {alertOrchards} alerts
          </span>
        )}
        <span style={{ fontSize: 13, color: '#7a8a80', display: 'inline-block', transition: 'transform 0.2s', transform: panelExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {panelExpanded && <>
        {/* Top orchards */}
        <div style={{ borderTop: '1px solid #f0ede6', padding: '12px 20px 4px' }}>
          {orchards.slice(0, 5).map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #faf9f6', fontSize: 13 }}>
              <div style={{ flex: 1, color: '#1c3a2a' }}>{o.display}</div>
              <div style={{
                fontWeight: 600, minWidth: 40, textAlign: 'right',
                color: o.total === 0 ? '#9aaa9f' : o.alertCount > 0 ? '#e85a4a' : '#c49a00',
              }}>
                {o.total}
              </div>
              {o.alertCount > 0 && (
                <span style={{ fontSize: 10, background: '#fdecea', color: '#e85a4a', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>alert</span>
              )}
            </div>
          ))}
          {orchards.length > 5 && (
            <div style={{ fontSize: 12, color: '#9aaa9f', padding: '6px 0' }}>
              +{orchards.length - 5} more orchards
            </div>
          )}
        </div>

        {/* Footer: send button */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f0ede6' }}>
          <button
            onClick={handleSendReport}
            disabled={sendStatus === 'sending'}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: '#1c3a2a', color: '#a8d5a2',
              fontSize: 13, fontWeight: 500, cursor: sendStatus === 'sending' ? 'not-allowed' : 'pointer',
              opacity: sendStatus === 'sending' ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {sendStatus === 'sending' ? 'Sending…' : 'Send Report Email'}
          </button>
          {sendResult && (
            <span style={{
              fontSize: 12, fontWeight: 500,
              color: sendStatus === 'error' ? '#e85a4a' : '#2a6e45',
            }}>
              {sendStatus === 'sent' ? '✓ ' : ''}{sendResult}
            </span>
          )}
        </div>
      </>}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #e8e4dc',
  overflow: 'hidden',
}

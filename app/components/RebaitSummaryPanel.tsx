'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'

interface RebaitRow {
  trap_id: string
  trap_nr: number | null
  nfc_tag: string | null
  orchard_name: string
  zone_name: string
  lure_type_id: string
  lure_type_name: string
  rebait_weeks: number
  last_rebaited_at: string | null
  weeks_since_rebait: number
  is_overdue: boolean
  is_due_soon: boolean
}

interface Props {
  orgId: string
  farmId?: string
  farmName?: string
}

export default function RebaitSummaryPanel({ orgId, farmId, farmName }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<RebaitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [panelExpanded, setPanelExpanded] = useState(false)
  const [purchaseExpanded, setPurchaseExpanded] = useState(true)
  const [scheduleExpanded, setScheduleExpanded] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendResult, setSendResult] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .rpc('get_rebait_summary', { p_org_id: orgId, ...(farmId ? { p_farm_id: farmId } : {}) })
      .then(({ data, error }) => {
        if (error) console.error('get_rebait_summary error:', error)
        setRows((data as RebaitRow[]) || [])
        setLoading(false)
      })
  }, [orgId, farmId])  // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a', marginBottom: 8 }}>Rebait Reminder{farmName ? <span style={{ fontSize: 13, fontWeight: 400, color: '#7a8a80', marginLeft: 8 }}>{farmName}</span> : null}</div>
          <div style={{ color: '#9aaa9f', fontSize: 13 }}>Loading…</div>
        </div>
      </div>
    )
  }

  if (rows.length === 0) return null

  const overdueCount = rows.filter(r => r.is_overdue).length
  const dueSoonCount = rows.filter(r => r.is_due_soon && !r.is_overdue).length
  const topBorderColor = overdueCount > 0 ? '#e85a4a' : '#f5c842'

  // Aggregate purchase list by lure type
  const lureMap: Record<string, { name: string; count: number }> = {}
  for (const row of rows) {
    if (!lureMap[row.lure_type_id]) lureMap[row.lure_type_id] = { name: row.lure_type_name, count: 0 }
    lureMap[row.lure_type_id].count++
  }
  const lures = Object.values(lureMap).sort((a, b) => b.count - a.count)

  async function handleSendReport() {
    setSendStatus('sending')
    setSendResult(null)
    try {
      const res = await fetch('/api/rebait/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, ...(farmId ? { farm_id: farmId } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      const total = (data.purchaseListCount || 0) + (data.scheduleCount || 0)
      if (total === 0 && data.message) {
        setSendResult('No recipients configured')
      } else {
        setSendResult(`Sent to ${total} recipient${total !== 1 ? 's' : ''}`)
      }
      setSendStatus('sent')
    } catch (err: any) {
      setSendStatus('error')
      setSendResult(err.message)
    }
  }

  function wksLabel(row: RebaitRow) {
    if (Number(row.weeks_since_rebait) >= 999) return 'Never baited'
    return `${Number(row.weeks_since_rebait).toFixed(1)} wks`
  }

  function statusChip(row: RebaitRow) {
    if (Number(row.weeks_since_rebait) >= 999 || row.is_overdue) {
      return (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
          background: '#fdecea', color: '#e85a4a',
        }}>OVERDUE</span>
      )
    }
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
        background: '#fff8e1', color: '#c49a00',
      }}>Due soon</span>
    )
  }

  return (
    <div style={{ ...cardStyle, borderTop: `3px solid ${topBorderColor}`, marginBottom: 20 }}>
      {/* Header */}
      <button
        onClick={() => setPanelExpanded(e => !e)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
      >
        <span style={{ fontSize: 13, color: '#9aaa9f', display: 'inline-block', transition: 'transform 0.2s', transform: panelExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1c3a2a', flex: 1 }}>
          Rebait Reminder{farmName ? <span style={{ fontSize: 13, fontWeight: 400, color: '#7a8a80', marginLeft: 8 }}>{farmName}</span> : null}
        </div>
        {overdueCount > 0 && (
          <span style={{ fontSize: 12, background: '#fdecea', color: '#e85a4a', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            🔴 {overdueCount} overdue
          </span>
        )}
        {dueSoonCount > 0 && (
          <span style={{ fontSize: 12, background: '#fff8e1', color: '#c49a00', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            🟡 {dueSoonCount} due soon
          </span>
        )}
      </button>

      {panelExpanded && <>
      {/* Purchase List */}
      <div style={{ borderBottom: '1px solid #f0ede6' }}>
        <button
          onClick={() => setPurchaseExpanded(e => !e)}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 600, color: '#1c3a2a',
          }}
        >
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: purchaseExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
          Purchase List
        </button>
        {purchaseExpanded && (
          <div style={{ padding: '0 20px 14px 36px' }}>
            {lures.map(l => (
              <div key={l.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#3a4a40', borderBottom: '1px solid #faf9f6' }}>
                <span>{l.name}</span>
                <span style={{ fontWeight: 600, color: '#1c3a2a' }}>×{l.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trap Schedule */}
      <div style={{ borderBottom: '1px solid #f0ede6' }}>
        <button
          onClick={() => setScheduleExpanded(e => !e)}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 600, color: '#1c3a2a',
          }}
        >
          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: scheduleExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
          Trap Schedule
          <span style={{ fontSize: 11, color: '#9aaa9f', fontWeight: 400 }}>(most overdue first)</span>
        </button>
        {scheduleExpanded && (
          <div style={{ padding: '0 20px 14px 20px' }}>
            {rows.map(row => (
              <div
                key={row.trap_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 0', borderBottom: '1px solid #faf9f6',
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600, color: '#1c3a2a', minWidth: 36 }}>
                  T{row.trap_nr ?? '?'}
                </span>
                <span style={{ color: '#3a4a40', flex: 1 }}>
                  {row.orchard_name} · {row.zone_name}
                </span>
                <span style={{ color: '#9aaa9f', fontSize: 12, minWidth: 80 }}>{row.lure_type_name}</span>
                <span style={{ fontSize: 12, color: '#7a8a80', minWidth: 60 }}>{wksLabel(row)}</span>
                {statusChip(row)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: send button */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
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

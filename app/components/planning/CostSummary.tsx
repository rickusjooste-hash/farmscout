'use client'

import { aggregateCosts, type CostLine, type PoleCountResult, type WireResult } from '@/lib/planning-calcs'

interface Props {
  spec: Record<string, any> | null
  poleResult?: PoleCountResult
  wireResult?: WireResult
  netHa: number
}

export default function CostSummary({ spec, poleResult, wireResult, netHa }: Props) {
  if (!spec) return <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Save planning spec to see cost summary</div>

  const lines = aggregateCosts(spec, poleResult, wireResult)
  const total = lines.reduce((s, l) => s + l.total, 0)
  const perHa = netHa > 0 ? total / netHa : 0

  if (lines.length === 0) {
    return <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Add cost data in the sections above to see a summary</div>
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e8e4dc' }}>
            <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' }}>Category</th>
            <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' }}>Total (R)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f7f5f0' }}>
              <td style={{ padding: '6px 0', color: '#1a2a3a' }}>{l.label}</td>
              <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 500, color: '#1a2a3a' }}>
                R {l.total.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #1a2a3a' }}>
            <td style={{ padding: '8px 0', fontWeight: 700, fontSize: 14, color: '#1a2a3a' }}>Total</td>
            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#1a2a3a' }}>
              R {total.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </td>
          </tr>
          {perHa > 0 && (
            <tr>
              <td style={{ padding: '4px 0', color: '#8a95a0', fontSize: 12 }}>Per hectare ({netHa.toFixed(2)} ha)</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: '#8a95a0', fontSize: 12 }}>
                R {perHa.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/ha
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  )
}

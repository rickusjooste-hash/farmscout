'use client'

import { useState } from 'react'

export interface WaterBalanceRow {
  orchard_id: string
  orchard_name: string
  variety: string | null
  commodity_code: string
  ha: number | null
  total_etc_mm: number
  total_applied_mm: number
  total_rainfall_mm: number
  net_deficit_mm: number
  available_water_mm: number
  stress_risk: 'critical' | 'warning' | 'ok'
  last_irrigation_date: string | null
  days_since_irrigation: number | null
}

interface Props {
  data: WaterBalanceRow[]
  loading?: boolean
  embedded?: boolean
}

type SortKey = 'orchard_name' | 'variety' | 'ha' | 'total_etc_mm' | 'total_applied_mm' | 'net_deficit_mm' | 'stress_risk' | 'days_since_irrigation'

const STATUS_LABELS: Record<string, string> = {
  critical: 'Needs Water',
  warning: 'Watch',
  ok: 'OK',
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fce4ec', text: '#c0392b', border: '#e85a4a' },
  warning:  { bg: '#fff8e1', text: '#e67e22', border: '#f5c842' },
  ok:       { bg: '#e8f5e9', text: '#2e7d32', border: '#4caf72' },
}

const RISK_ORDER: Record<string, number> = { critical: 0, warning: 1, ok: 2 }

// Convert mm to m3/ha (1 mm = 10 m3/ha)
function mmToCubes(mm: number): number {
  return Math.round(mm * 10 * 10) / 10 // one decimal
}

export default function WaterBalanceTable({ data, loading, embedded }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('stress_risk')
  const [sortAsc, setSortAsc] = useState(true)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === 'stress_risk')
    }
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'stress_risk') {
      cmp = (RISK_ORDER[a.stress_risk] ?? 2) - (RISK_ORDER[b.stress_risk] ?? 2)
      if (cmp === 0) cmp = (b.net_deficit_mm ?? 0) - (a.net_deficit_mm ?? 0)
    } else if (sortKey === 'orchard_name' || sortKey === 'variety') {
      cmp = (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '')
    } else {
      cmp = ((a[sortKey] as number) ?? 0) - ((b[sortKey] as number) ?? 0)
    }
    return sortAsc ? cmp : -cmp
  })

  function thStyle(key: SortKey): React.CSSProperties {
    return {
      ...s.th,
      cursor: 'pointer',
      userSelect: 'none',
      color: sortKey === key ? '#2176d9' : '#8a95a0',
    }
  }

  function arrow(key: SortKey) {
    if (sortKey !== key) return ''
    return sortAsc ? ' \u25B2' : ' \u25BC'
  }

  const Wrap = embedded
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ({ children }: { children: React.ReactNode }) => <div style={s.card}>{children}</div>

  if (loading) {
    return <Wrap><div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading water balance...</div></Wrap>
  }

  if (data.length === 0) {
    return <Wrap><div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>No irrigation data for this period</div></Wrap>
  }

  return (
    <Wrap>
      {!embedded && <div style={s.cardHeader}>Water Balance</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={thStyle('orchard_name')} onClick={() => handleSort('orchard_name')}>Orchard{arrow('orchard_name')}</th>
              <th style={thStyle('variety')} onClick={() => handleSort('variety')}>Variety{arrow('variety')}</th>
              <th style={thStyle('ha')} onClick={() => handleSort('ha')}>Ha{arrow('ha')}</th>
              <th style={thStyle('total_applied_mm')} onClick={() => handleSort('total_applied_mm')}>Given (m³/ha){arrow('total_applied_mm')}</th>
              <th style={thStyle('total_etc_mm')} onClick={() => handleSort('total_etc_mm')}>Crop Need (m³/ha){arrow('total_etc_mm')}</th>
              <th style={s.th}>Rain (mm)</th>
              <th style={thStyle('net_deficit_mm')} onClick={() => handleSort('net_deficit_mm')}>Shortfall (m³/ha){arrow('net_deficit_mm')}</th>
              <th style={thStyle('days_since_irrigation')} onClick={() => handleSort('days_since_irrigation')}>Last Watered{arrow('days_since_irrigation')}</th>
              <th style={thStyle('stress_risk')} onClick={() => handleSort('stress_risk')}>Status{arrow('stress_risk')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const risk = RISK_COLORS[row.stress_risk] || RISK_COLORS.ok
              const shortfall = mmToCubes(row.net_deficit_mm)
              return (
                <tr key={row.orchard_id} style={s.tr}>
                  <td style={s.tdName}>{row.orchard_name}</td>
                  <td style={s.td}>{row.variety || '—'}</td>
                  <td style={s.tdNum}>{row.ha?.toFixed(1) ?? '—'}</td>
                  <td style={{ ...s.tdNum, color: '#2176d9', fontWeight: 600 }}>{mmToCubes(row.total_applied_mm).toFixed(1)}</td>
                  <td style={s.tdNum}>{mmToCubes(row.total_etc_mm).toFixed(1)}</td>
                  <td style={{ ...s.tdNum, color: '#3a8fd9' }}>{row.total_rainfall_mm.toFixed(1)}</td>
                  <td style={{ ...s.tdNum, fontWeight: 600, color: row.net_deficit_mm > 0 ? '#e85a4a' : '#4caf72' }}>
                    {shortfall > 0 ? '+' : ''}{shortfall.toFixed(1)}
                  </td>
                  <td style={s.td}>
                    {row.days_since_irrigation != null
                      ? `${row.days_since_irrigation}d ago`
                      : '—'}
                  </td>
                  <td style={s.td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: risk.bg,
                      color: risk.text,
                      border: `1px solid ${risk.border}`,
                    }}>
                      {STATUS_LABELS[row.stress_risk] || row.stress_risk}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Wrap>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e8e4dc',
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1a2a3a',
    padding: '16px 20px 12px',
    borderBottom: '1px solid #f0ede8',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 600,
    color: '#8a95a0',
    borderBottom: '1px solid #f0ede8',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f5f3ef',
  },
  td: {
    padding: '10px 12px',
    color: '#1a2a3a',
    whiteSpace: 'nowrap',
  },
  tdName: {
    padding: '10px 12px',
    color: '#1a2a3a',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  tdNum: {
    padding: '10px 12px',
    color: '#1a2a3a',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
}

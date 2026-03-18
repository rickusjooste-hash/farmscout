'use client'

import { useState, useMemo, useRef, useEffect } from 'react'

export interface GanttTask {
  id: string
  name: string
  category: string
  start_date: string | null
  end_date: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  sort_order: number
  responsible_contact_id?: string | null
  planning_contacts?: { name: string; company: string | null } | null
}

interface Props {
  tasks: GanttTask[]
  onTaskClick: (task: GanttTask) => void
  onStatusToggle: (taskId: string, newStatus: 'pending' | 'in_progress' | 'completed') => void
}

const CATEGORY_COLORS: Record<string, string> = {
  soil_profile: '#8B6914',
  soil_prep:    '#A0522D',
  chemistry:    '#CD853F',
  fumigation:   '#DC143C',
  irrigation:   '#4682B4',
  structure:    '#708090',
  tree_order:   '#228B22',
  cover_crop:   '#6B8E23',
  planting:     '#2E8B57',
  netting:      '#9370DB',
  drainage:     '#5F9EA0',
  windbreak:    '#556B2F',
}

const STATUS_COLORS: Record<string, string> = {
  completed:   '#4caf72',
  in_progress: '#2176d9',
  pending:     '#aaaaaa',
  blocked:     '#e85a4a',
}

export default function GanttChart({ tasks, onTaskClick, onStatusToggle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Compute time range
  const { minDate, maxDate, months, daySpan } = useMemo(() => {
    const dates = tasks
      .flatMap(t => [t.start_date, t.end_date].filter(Boolean))
      .map(d => new Date(d!).getTime())

    if (dates.length === 0) {
      const now = new Date()
      const min = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const max = new Date(now.getFullYear(), now.getMonth() + 13, 1)
      return { minDate: min, maxDate: max, months: [] as Date[], daySpan: 365 }
    }

    const earliest = new Date(Math.min(...dates))
    const latest = new Date(Math.max(...dates))
    // Pad 1 month each side
    const min = new Date(earliest.getFullYear(), earliest.getMonth() - 1, 1)
    const max = new Date(latest.getFullYear(), latest.getMonth() + 2, 1)

    const ms: Date[] = []
    const cur = new Date(min)
    while (cur <= max) {
      ms.push(new Date(cur))
      cur.setMonth(cur.getMonth() + 1)
    }

    const span = Math.max(1, Math.round((max.getTime() - min.getTime()) / 86400000))
    return { minDate: min, maxDate: max, months: ms, daySpan: span }
  }, [tasks])

  const DAY_WIDTH = 4 // pixels per day
  const totalWidth = daySpan * DAY_WIDTH
  const ROW_HEIGHT = 32
  const LABEL_WIDTH = 220

  function dayOffset(dateStr: string): number {
    const d = new Date(dateStr)
    return Math.round((d.getTime() - minDate.getTime()) / 86400000) * DAY_WIDTH
  }

  // Today marker
  const todayOffset = dayOffset(new Date().toISOString().split('T')[0])

  const sorted = [...tasks].sort((a, b) => a.sort_order - b.sort_order)

  const nextStatus = (s: string) => {
    if (s === 'pending') return 'in_progress'
    if (s === 'in_progress') return 'completed'
    return 'pending'
  }

  return (
    <div style={{ display: 'flex', border: '1px solid #e8e4dc', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      {/* Task labels */}
      <div style={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: '1px solid #e8e4dc' }}>
        <div style={{ height: 36, borderBottom: '1px solid #e8e4dc', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' }}>
          Task
        </div>
        {sorted.map(t => (
          <div key={t.id} style={{
            height: ROW_HEIGHT, display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 8px', borderBottom: '1px solid #f7f5f0', cursor: 'pointer',
            fontSize: 12, color: '#1a2a3a',
          }}
            onClick={() => onTaskClick(t)}
          >
            <button
              onClick={e => { e.stopPropagation(); onStatusToggle(t.id, nextStatus(t.status) as any) }}
              style={{
                width: 16, height: 16, borderRadius: 4, border: `2px solid ${STATUS_COLORS[t.status]}`,
                background: t.status === 'completed' ? STATUS_COLORS.completed : 'transparent',
                cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 10, lineHeight: 1,
              }}
              title={`${t.status} — click to cycle`}
            >
              {t.status === 'completed' ? '✓' : ''}
            </button>
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              textDecoration: t.status === 'completed' ? 'line-through' : 'none',
              opacity: t.status === 'completed' ? 0.6 : 1,
            }}>
              {t.name}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline area */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowX: 'auto', position: 'relative' }}
        onScroll={e => setScrollLeft((e.target as HTMLElement).scrollLeft)}
      >
        {/* Month headers */}
        <div style={{ height: 36, borderBottom: '1px solid #e8e4dc', position: 'relative', width: totalWidth }}>
          {months.map((m, i) => {
            const x = dayOffset(m.toISOString().split('T')[0])
            const label = m.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })
            return (
              <div key={i} style={{
                position: 'absolute', left: x, top: 0, height: 36,
                borderLeft: '1px solid #eef2fa', padding: '10px 6px',
                fontSize: 10, fontWeight: 600, color: '#8a95a0', whiteSpace: 'nowrap',
              }}>
                {label}
              </div>
            )
          })}
        </div>

        {/* Task bars */}
        <div style={{ position: 'relative', width: totalWidth }}>
          {sorted.map(t => {
            if (!t.start_date && !t.end_date) return (
              <div key={t.id} style={{ height: ROW_HEIGHT, borderBottom: '1px solid #f7f5f0' }} />
            )

            const start = t.start_date || t.end_date!
            const end = t.end_date || t.start_date!
            const x = dayOffset(start)
            const w = Math.max(8, dayOffset(end) - x)
            const isOverdue = t.status !== 'completed' && new Date(end) < new Date()
            const barColor = isOverdue ? '#e85a4a' : (CATEGORY_COLORS[t.category] || '#888')

            return (
              <div key={t.id} style={{ height: ROW_HEIGHT, position: 'relative', borderBottom: '1px solid #f7f5f0' }}>
                <div
                  onClick={() => onTaskClick(t)}
                  style={{
                    position: 'absolute', left: x, top: 6,
                    width: w, height: ROW_HEIGHT - 12,
                    background: t.status === 'completed' ? `${barColor}66` : barColor,
                    borderRadius: 4, cursor: 'pointer',
                    opacity: t.status === 'completed' ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', paddingLeft: 4,
                    fontSize: 10, color: '#fff', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap',
                  }}
                  title={`${t.name} — ${start} to ${end} (${t.status})`}
                >
                  {w > 60 ? t.name : ''}
                </div>
              </div>
            )
          })}

          {/* Today line */}
          {todayOffset > 0 && todayOffset < totalWidth && (
            <div style={{
              position: 'absolute', left: todayOffset, top: 0, bottom: 0,
              width: 2, background: '#e85a4a', zIndex: 10, pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: -20, left: -16,
                fontSize: 9, fontWeight: 700, color: '#e85a4a', whiteSpace: 'nowrap',
              }}>
                Today
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

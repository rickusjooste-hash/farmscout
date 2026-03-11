'use client'

import { useMemo, useState } from 'react'

interface TreemapItem {
  label: string
  sublabel: string
  value: number
  color: string
}

interface Props {
  items: TreemapItem[]
  width?: number
  height?: number
  metric?: string
  selectedLabel?: string | null
  onSelect?: (label: string | null) => void
}

interface Rect extends TreemapItem {
  x: number; y: number; w: number; h: number
}

function layoutTreemap(items: TreemapItem[], x: number, y: number, w: number, h: number): Rect[] {
  if (items.length === 0) return []
  if (items.length === 1) return [{ ...items[0], x, y, w, h }]
  const total = items.reduce((s, i) => s + Math.max(i.value, 0.01), 0)
  // Binary split: take items until ~50% of area
  let split = 0, acc = 0
  for (let i = 0; i < items.length; i++) {
    acc += Math.max(items[i].value, 0.01)
    if (acc >= total / 2) { split = i + 1; break }
  }
  if (split === 0) split = 1
  if (split >= items.length) split = items.length - 1
  const left = items.slice(0, split)
  const right = items.slice(split)
  const leftTotal = left.reduce((s, i) => s + Math.max(i.value, 0.01), 0)
  const frac = leftTotal / total
  if (w >= h) {
    return [
      ...layoutTreemap(left, x, y, w * frac, h),
      ...layoutTreemap(right, x + w * frac, y, w * (1 - frac), h),
    ]
  }
  return [
    ...layoutTreemap(left, x, y, w, h * frac),
    ...layoutTreemap(right, x, y + h * frac, w, h * (1 - frac)),
  ]
}

export default function VarietyTreemap({ items, width = 600, height = 300, metric = 'ha', selectedLabel, onSelect }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const sorted = useMemo(() => [...items].sort((a, b) => b.value - a.value), [items])
  const rects = useMemo(() => layoutTreemap(sorted, 0, 0, width, height), [sorted, width, height])

  if (items.length === 0) {
    return <div style={{ color: '#8a95a0', fontSize: 13, textAlign: 'center', padding: 40 }}>No variety data available</div>
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {rects.map((r, i) => {
        const showLabel = r.w > 50 && r.h > 30
        const isHovered = hoveredIdx === i
        const isSelected = selectedLabel === r.label
        const isDimmed = selectedLabel != null && !isSelected
        return (
          <g key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => onSelect?.(isSelected ? null : r.label)}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            <rect
              x={r.x + 1} y={r.y + 1} width={Math.max(r.w - 2, 0)} height={Math.max(r.h - 2, 0)}
              rx={4} fill={r.color}
              opacity={isDimmed ? 0.3 : isHovered || isSelected ? 0.95 : 0.8}
              stroke={isSelected ? '#1a2a3a' : '#fff'}
              strokeWidth={isSelected ? 3 : 2}
              style={{ transition: 'opacity 0.15s, stroke 0.15s' }}
            />
            {showLabel && (
              <>
                <text
                  x={r.x + r.w / 2} y={r.y + r.h / 2 - 6}
                  textAnchor="middle" fill="#fff" fontSize={r.w > 80 ? 12 : 10}
                  fontWeight={600} fontFamily="Inter, sans-serif"
                  opacity={isDimmed ? 0.4 : 1}
                  style={{ pointerEvents: 'none', transition: 'opacity 0.15s' }}
                >
                  {r.label}
                </text>
                <text
                  x={r.x + r.w / 2} y={r.y + r.h / 2 + 10}
                  textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10}
                  fontFamily="Inter, sans-serif"
                  opacity={isDimmed ? 0.4 : 1}
                  style={{ pointerEvents: 'none', transition: 'opacity 0.15s' }}
                >
                  {r.sublabel}
                </text>
              </>
            )}
            {isHovered && (
              <title>{`${r.label}\n${r.sublabel}\n${r.value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} ${metric}`}</title>
            )}
          </g>
        )
      })}
    </svg>
  )
}

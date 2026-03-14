'use client'

import type { Insight } from './insightEngine'

const SEVERITY_STYLES: Record<Insight['severity'], { bg: string; border: string; iconBg: string; iconColor: string; titleColor: string }> = {
  critical: {
    bg: 'rgba(232,90,74,0.06)', border: 'rgba(232,90,74,0.20)',
    iconBg: '#e85a4a', iconColor: '#fff', titleColor: '#c23616',
  },
  warning: {
    bg: 'rgba(245,200,66,0.08)', border: 'rgba(245,200,66,0.25)',
    iconBg: '#f5c842', iconColor: '#5a4a00', titleColor: '#9a7b1a',
  },
  info: {
    bg: 'rgba(33,118,217,0.06)', border: 'rgba(33,118,217,0.15)',
    iconBg: '#2176d9', iconColor: '#fff', titleColor: '#1a5fb4',
  },
}

const SEVERITY_ICONS: Record<Insight['severity'], string> = {
  critical: '!',
  warning: '!',
  info: 'i',
}

interface Props {
  insight: Insight
}

export default function InsightCard({ insight }: Props) {
  const s = SEVERITY_STYLES[insight.severity]
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10,
      background: s.bg, border: `1px solid ${s.border}`,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: s.iconBg, color: s.iconColor,
          fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 1,
        }}>
          {SEVERITY_ICONS[insight.severity]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: s.titleColor, marginBottom: 2 }}>
            {insight.title}
          </div>
          <div style={{ fontSize: 12, color: '#5a6a60', lineHeight: 1.4 }}>
            {insight.detail}
          </div>
          <div style={{ fontSize: 12, color: '#1a2a3a', marginTop: 6, fontStyle: 'italic' }}>
            {insight.recommendation}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import type { QualityFlag } from './ScoutProductivityTable'

interface Props {
  flags: QualityFlag[]
  scoutName: string
  onClose: () => void
}

const FLAG_META: Record<string, { icon: string; label: string; color: string }> = {
  rapid_inspections:    { icon: '⚡', label: 'Rapid Inspections',    color: '#e85a4a' },
  batch_timestamps:     { icon: '📋', label: 'Batch Timestamps',     color: '#e85a4a' },
  all_zero_session:     { icon: '0️⃣',  label: 'All Zero Counts',     color: '#f5c842' },
  identical_counts:     { icon: '🔁', label: 'Identical Counts',     color: '#f5c842' },
  low_timing_variance:  { icon: '📊', label: 'Low Timing Variance',  color: '#6b7fa8' },
  stationary_gps:       { icon: '📍', label: 'Stationary GPS',       color: '#f5c842' },
}

const SEVERITY_COLORS: Record<string, string> = {
  high:   '#e85a4a',
  medium: '#f5c842',
  low:    '#6b7fa8',
}

export default function ScoutQualityFlags({ flags, scoutName, onClose }: Props) {
  // Group by flag_type
  const grouped = flags.reduce<Record<string, QualityFlag[]>>((acc, f) => {
    ;(acc[f.flag_type] = acc[f.flag_type] || []).push(f)
    return acc
  }, {})

  const totalHigh = flags.filter(f => f.severity === 'high').length
  const totalMed = flags.filter(f => f.severity === 'medium').length
  const totalLow = flags.filter(f => f.severity === 'low').length

  return (
    <div className="sqf-panel">
      <div className="sqf-header">
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2a3a' }}>
            Quality Flags — {scoutName}
          </div>
          <div style={{ fontSize: 12, color: '#8a95a0', marginTop: 2 }}>
            {flags.length} flag{flags.length !== 1 ? 's' : ''} detected
          </div>
        </div>
        <button className="sqf-close" onClick={onClose}>✕</button>
      </div>

      {/* Severity summary chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {totalHigh > 0 && (
          <span className="sqf-chip" style={{ background: '#e85a4a22', color: '#e85a4a' }}>
            {totalHigh} high
          </span>
        )}
        {totalMed > 0 && (
          <span className="sqf-chip" style={{ background: '#f5c84222', color: '#b89930' }}>
            {totalMed} medium
          </span>
        )}
        {totalLow > 0 && (
          <span className="sqf-chip" style={{ background: '#6b7fa822', color: '#6b7fa8' }}>
            {totalLow} low
          </span>
        )}
      </div>

      {/* Flags by type */}
      {Object.entries(grouped).map(([type, items]) => {
        const meta = FLAG_META[type] || { icon: '⚠️', label: type, color: '#8a95a0' }
        return (
          <div key={type} className="sqf-flag-group">
            <div className="sqf-flag-header" style={{ borderLeftColor: meta.color }}>
              <span>{meta.icon}</span>
              <span style={{ fontWeight: 600 }}>{meta.label}</span>
              <span className="sqf-chip" style={{
                background: SEVERITY_COLORS[items[0].severity] + '22',
                color: SEVERITY_COLORS[items[0].severity],
              }}>
                {items[0].severity}
              </span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="sqf-flag-detail">
                <div style={{ fontSize: 11, color: '#8a95a0' }}>
                  {new Date(item.day).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontSize: 12, color: '#1a2a3a' }}>{item.flag_detail}</div>
                <div style={{ fontSize: 11, color: '#6a7a70' }}>{item.evidence_count} instance{item.evidence_count !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        )
      })}

      {flags.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#4caf72' }}>
          No quality flags — good job!
        </div>
      )}

      <style>{`
        .sqf-panel {
          padding: 16px;
        }
        .sqf-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .sqf-close {
          background: none;
          border: none;
          font-size: 16px;
          color: #8a95a0;
          cursor: pointer;
          padding: 4px 8px;
        }
        .sqf-close:hover { color: #1a2a3a; }
        .sqf-chip {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
        }
        .sqf-flag-group {
          margin-bottom: 12px;
          border-radius: 8px;
          background: #fafaf8;
          overflow: hidden;
        }
        .sqf-flag-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-left: 3px solid #8a95a0;
          font-size: 13px;
        }
        .sqf-flag-detail {
          padding: 6px 12px 6px 24px;
          border-top: 1px solid #eef2fa;
          display: flex;
          gap: 12px;
          align-items: center;
        }
      `}</style>
    </div>
  )
}

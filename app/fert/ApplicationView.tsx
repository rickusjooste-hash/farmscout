'use client'

import { useState, useEffect, useRef } from 'react'
import type { FertDispatchedLine } from '@/lib/fert-db'

interface Props {
  line: FertDispatchedLine
  orgId: string
  userId: string
  spreaderOpening: { opening: number; actualKgHa: number } | null
  onConfirm: () => void
  onBack: () => void
}

export default function ApplicationView({ line, orgId, userId, spreaderOpening, onConfirm, onBack }: Props) {
  const hasBags = !!(line.bag_weight_kg && line.bag_weight_kg > 0)
  const prescribedBags = hasBags && line.total_qty ? Math.ceil(line.total_qty / line.bag_weight_kg!) : null

  const [actualRate, setActualRate] = useState(String(line.rate_per_ha || ''))
  const [bagsApplied, setBagsApplied] = useState(prescribedBags != null ? String(prescribedBags) : '')
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'acquired' | 'unavailable'>('acquiring')
  const [photo, setPhoto] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const ha = line.ha || 0
  const bagsNum = parseFloat(bagsApplied) || 0
  const actualRateNum = hasBags
    ? (ha > 0 ? Math.round((bagsNum * line.bag_weight_kg!) / ha * 100) / 100 : 0)
    : (parseFloat(actualRate) || 0)
  const computedTotal = hasBags
    ? Math.round(bagsNum * line.bag_weight_kg! * 100) / 100
    : Math.round(actualRateNum * ha * 100) / 100

  // Auto-capture GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(pos.coords.latitude)
        setGpsLng(pos.coords.longitude)
        setGpsStatus('acquired')
      },
      () => setGpsStatus('unavailable'),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      const { fertSaveAndQueue } = await import('@/lib/fert-sync')
      const id = crypto.randomUUID()
      await fertSaveAndQueue({
        id,
        organisation_id: orgId,
        line_id: line.line_id,
        confirmed: true,
        date_applied: new Date().toISOString().slice(0, 10),
        actual_rate_per_ha: actualRateNum || null,
        actual_total_qty: computedTotal || null,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        photo_url: null,
        notes: notes || null,
        confirmed_by: userId,
        created_at: new Date().toISOString(),
        _syncStatus: 'pending',
        _photo: photo,
      })
      onConfirm()
    } catch (err) {
      console.error('[FertApp] Save failed:', err)
    }
    setSaving(false)
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>&#8592; Back</button>
        <div style={s.headerTitle}>{line.orchard_nr ? `${line.orchard_nr}. ` : ''}{line.orchard_name}{line.variety ? ` (${line.variety})` : ''}</div>
      </div>

      {/* Info strip */}
      <div style={s.infoStrip}>
        <div style={s.infoItem}>
          <div style={s.infoLabel}>Product</div>
          <div style={s.infoValue}>{line.product_name}</div>
        </div>
        <div style={s.infoItem}>
          <div style={s.infoLabel}>Timing</div>
          <div style={s.infoValue}>{line.timing_label}</div>
        </div>
        <div style={s.infoItem}>
          <div style={s.infoLabel}>Hectares</div>
          <div style={s.infoValue}>{ha.toFixed(2)}</div>
        </div>
      </div>

      <div style={s.prescribedBox}>
        <div style={s.prescribedRow}>
          <span style={s.prescribedLabel}>Prescribed rate</span>
          <span style={s.prescribedValue}>{line.rate_per_ha} {line.product_unit || 'kg'}/ha</span>
        </div>
        <div style={s.prescribedRow}>
          <span style={s.prescribedLabel}>Prescribed total</span>
          <span style={s.prescribedValue}>{line.total_qty != null ? Math.round(line.total_qty) : '—'} {line.product_unit || 'kg'}</span>
        </div>
        {hasBags && prescribedBags != null && (
          <div style={{ ...s.prescribedRow, borderTop: '1px solid #2e5a2e', marginTop: 4, paddingTop: 8 }}>
            <span style={s.prescribedLabel}>Prescribed bags</span>
            <span style={{ ...s.prescribedValue, color: '#f5c842' }}>{prescribedBags} bags ({line.bag_weight_kg} kg each)</span>
          </div>
        )}
        {spreaderOpening && (
          <div style={{ ...s.prescribedRow, borderTop: '1px solid #2e5a2e', marginTop: 4, paddingTop: 8 }}>
            <span style={s.prescribedLabel}>Spreader opening</span>
            <span style={{ ...s.prescribedValue, color: '#4caf72', fontSize: 18, fontWeight: 800 }}>{spreaderOpening.opening.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Bags or rate input */}
      <div style={s.section}>
        {hasBags ? (
          <>
            <label style={s.label}>Bags Applied</label>
            <div style={s.stepperRow}>
              <button
                style={s.stepperBtn}
                onClick={() => setBagsApplied(String(Math.max(0, bagsNum - 0.5)))}
              >
                &minus;
              </button>
              <div style={s.stepperValue}>{bagsNum % 1 === 0 ? bagsNum : bagsNum.toFixed(1)}</div>
              <button
                style={s.stepperBtn}
                onClick={() => setBagsApplied(String(bagsNum + 0.5))}
              >
                +
              </button>
            </div>
            <div style={s.computedTotal}>
              Total: <strong>{computedTotal > 0 ? computedTotal.toFixed(1) : '—'}</strong> {line.product_unit || 'kg'}
              {ha > 0 && computedTotal > 0 && (
                <span> ({(computedTotal / ha).toFixed(1)} {line.product_unit || 'kg'}/ha)</span>
              )}
            </div>
          </>
        ) : (
          <>
            <label style={s.label}>Actual Rate ({line.product_unit || 'kg'}/ha)</label>
            <input
              style={s.input}
              type="number"
              inputMode="decimal"
              value={actualRate}
              onChange={e => setActualRate(e.target.value)}
              placeholder={String(line.rate_per_ha)}
            />
            <div style={s.computedTotal}>
              Total: <strong>{computedTotal > 0 ? computedTotal.toFixed(1) : '—'}</strong> {line.product_unit || 'kg'}
            </div>
          </>
        )}
      </div>

      {/* GPS */}
      <div style={s.section}>
        <label style={s.label}>GPS Location</label>
        <div style={s.gpsBox}>
          {gpsStatus === 'acquiring' && <span style={{ color: '#f5c842' }}>Acquiring GPS...</span>}
          {gpsStatus === 'acquired' && (
            <span style={{ color: '#4caf72' }}>
              {gpsLat!.toFixed(6)}, {gpsLng!.toFixed(6)}
            </span>
          )}
          {gpsStatus === 'unavailable' && <span style={{ color: '#888' }}>GPS unavailable</span>}
        </div>
      </div>

      {/* Photo */}
      <div style={s.section}>
        <label style={s.label}>Photo (optional)</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          style={{ display: 'none' }}
        />
        {photo ? (
          <div style={s.photoPreview}>
            <img src={photo} alt="Application photo" style={s.photoImg} />
            <button onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = '' }} style={s.removePhotoBtn}>
              Remove
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} style={s.photoBtn}>
            Take Photo
          </button>
        )}
      </div>

      {/* Notes */}
      <div style={s.section}>
        <label style={s.label}>Notes (optional)</label>
        <textarea
          style={s.textarea}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any observations..."
          rows={3}
        />
      </div>

      {/* Confirm */}
      <button
        style={{ ...s.confirmBtn, opacity: saving ? 0.6 : 1 }}
        onClick={handleConfirm}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Confirm Application'}
      </button>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh',
    background: '#1a2a1a',
    color: '#e8e8d8',
    fontFamily: 'system-ui, sans-serif',
    padding: '0 0 40px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    background: '#1e3a1e',
    borderBottom: '1px solid #2e5a2e',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#4caf72',
    fontSize: 18,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#e8e8d8',
  },
  infoStrip: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 8,
    padding: '12px 20px',
    background: '#162816',
  },
  infoItem: { textAlign: 'center' },
  infoLabel: { fontSize: 10, color: '#6a8a6a', textTransform: 'uppercase', letterSpacing: '0.08em' },
  infoValue: { fontSize: 14, fontWeight: 600, color: '#e8e8d8', marginTop: 2 },
  prescribedBox: {
    margin: '16px 20px 0',
    padding: '12px 16px',
    background: '#1e3a1e',
    borderRadius: 8,
    border: '1px solid #2e5a2e',
  },
  prescribedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
  },
  prescribedLabel: { fontSize: 13, color: '#6a8a6a' },
  prescribedValue: { fontSize: 13, fontWeight: 600, color: '#e8e8d8' },
  section: {
    padding: '16px 20px 0',
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#4caf72',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    background: '#1e3a1e',
    border: '1px solid #2e5a2e',
    borderRadius: 6,
    color: '#e8e8d8',
    fontSize: 20,
    fontWeight: 700,
    padding: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  computedTotal: {
    fontSize: 14,
    color: '#6a8a6a',
    marginTop: 6,
  },
  gpsBox: {
    padding: '10px 14px',
    background: '#1e3a1e',
    borderRadius: 6,
    border: '1px solid #2e5a2e',
    fontSize: 13,
  },
  photoBtn: {
    padding: '12px 20px',
    background: '#2e5a2e',
    color: '#e8e8d8',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  photoPreview: {
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    maxHeight: 200,
    objectFit: 'cover',
    borderRadius: 6,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    background: '#1e3a1e',
    border: '1px solid #2e5a2e',
    borderRadius: 6,
    color: '#e8e8d8',
    fontSize: 14,
    padding: '12px 14px',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'system-ui, sans-serif',
  },
  stepperRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #2e5a2e',
    background: '#1e3a1e',
  },
  stepperBtn: {
    width: 64,
    height: 56,
    background: '#2e5a2e',
    border: 'none',
    color: '#e8e8d8',
    fontSize: 28,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 700,
    color: '#f5c842',
    padding: '14px 0',
  },
  confirmBtn: {
    display: 'block',
    width: 'calc(100% - 40px)',
    margin: '24px 20px 0',
    padding: '16px',
    background: '#4caf72',
    color: '#0a1a0a',
    fontSize: 18,
    fontWeight: 700,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
}

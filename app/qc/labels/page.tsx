'use client'

import { useState, useRef } from 'react'
import QRCode from 'qrcode'

interface Label {
  uuid: string
  seq: number
  dataUrl: string
}

export default function QcLabelsPage() {
  const [qty, setQty] = useState(50)
  const [labels, setLabels] = useState<Label[]>([])
  const [generating, setGenerating] = useState(false)
  const [batchDate] = useState(() =>
    new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
  )

  async function generate() {
    setGenerating(true)
    const result: Label[] = []
    for (let i = 1; i <= qty; i++) {
      const uuid = crypto.randomUUID()
      // High resolution for thermal print quality
      const dataUrl = await QRCode.toDataURL(uuid, {
        width: 400,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
      result.push({ uuid, seq: i, dataUrl })
    }
    setLabels(result)
    setGenerating(false)
  }

  return (
    <>
      <style>{`
        /* ── Screen styles ─────────────────────────────────── */
        .label-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, 220px);
          gap: 12px;
          padding: 16px;
        }
        .label-card {
          width: 208px;
          height: 104px;
          border: 1px solid #ccc;
          border-radius: 4px;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          background: #fff;
          box-sizing: border-box;
          font-family: 'Courier New', monospace;
        }
        .label-qr { width: 82px; height: 82px; flex-shrink: 0; }
        .label-text { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
        .label-brand { font-size: 8px; font-weight: 700; color: #2a6e45; letter-spacing: 0.1em; text-transform: uppercase; }
        .label-seq { font-size: 22px; font-weight: 800; color: #111; line-height: 1; }
        .label-date { font-size: 8px; color: #555; }
        .label-id { font-size: 7px; color: #999; letter-spacing: 0.05em; }

        /* ── Print styles — 100mm × 50mm per label ─────────── */
        @media print {
          @page { size: 100mm 50mm; margin: 0; }
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: fixed; top: 0; left: 0; }
          .label-preview-grid { display: block; padding: 0; }
          .label-card {
            width: 100mm;
            height: 50mm;
            border: none;
            border-radius: 0;
            padding: 3mm 4mm;
            gap: 4mm;
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
          }
          .label-qr { width: 42mm; height: 42mm; }
          .label-brand { font-size: 7pt; }
          .label-seq { font-size: 28pt; }
          .label-date { font-size: 7pt; }
          .label-id { font-size: 6pt; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, sans-serif' }}>

        {/* Header */}
        <div style={{ background: '#1c3a2a', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#a8d5a2', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>QC System</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>QR Label Generator</div>
            <div style={{ color: '#5a8a6a', fontSize: 12, marginTop: 2 }}>Zebra ZT230 · 100 × 50 mm roll</div>
          </div>
          <a href="/qc/dashboard" style={{ color: '#a8d5a2', fontSize: 13, textDecoration: 'none' }}>← QC Dashboard</a>
        </div>

        {/* Controls */}
        <div style={{ padding: '20px 32px', display: 'flex', alignItems: 'flex-end', gap: 16, background: '#fff', borderBottom: '1px solid #e8e4dc' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#5a6a60', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Number of labels
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={qty}
              onChange={e => setQty(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              style={{ width: 90, padding: '8px 12px', border: '1px solid #d4cfca', borderRadius: 6, fontSize: 16, fontFamily: 'inherit' }}
            />
          </div>
          <button
            onClick={generate}
            disabled={generating}
            style={{ padding: '10px 28px', background: '#2a6e45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1, fontFamily: 'inherit' }}
          >
            {generating ? `Generating…` : '⚡ Generate'}
          </button>
          {labels.length > 0 && (
            <button
              onClick={() => window.print()}
              style={{ padding: '10px 28px', background: '#1c3a2a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              🖨️ Print {labels.length} labels
            </button>
          )}
          {labels.length > 0 && (
            <div style={{ fontSize: 13, color: '#9aaa9f' }}>
              Each label: 100 × 50 mm · {batchDate}
            </div>
          )}
        </div>

        {/* Empty state */}
        {labels.length === 0 && (
          <div style={{ padding: '64px 32px', textAlign: 'center', color: '#9aaa9f' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🏷️</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#5a6a60', marginBottom: 8 }}>Ready to generate</div>
            <div style={{ fontSize: 14, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
              Set the quantity, click Generate, then Print.<br />
              In the Chrome print dialog, select the <strong>Zebra ZT230</strong> printer — the page size is already set to 100 × 50 mm.
            </div>
          </div>
        )}

        {/* Label grid preview */}
        {labels.length > 0 && (
          <div id="print-area">
            <div className="label-preview-grid">
              {labels.map(label => (
                <div key={label.uuid} className="label-card">
                  <img className="label-qr" src={label.dataUrl} alt="" />
                  <div className="label-text">
                    <div className="label-brand">FarmScout QC</div>
                    <div className="label-seq">#{String(label.seq).padStart(3, '0')}</div>
                    <div className="label-date">{batchDate}</div>
                    <div className="label-id">{label.uuid.slice(-12)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}

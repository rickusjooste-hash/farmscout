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
  const [date] = useState(() => new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }))
  const printRef = useRef<HTMLDivElement>(null)

  async function generate() {
    setGenerating(true)
    const result: Label[] = []
    for (let i = 1; i <= qty; i++) {
      const uuid = crypto.randomUUID()
      const dataUrl = await QRCode.toDataURL(uuid, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
      result.push({ uuid, seq: i, dataUrl })
    }
    setLabels(result)
    setGenerating(false)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: fixed; top: 0; left: 0; width: 100%; }
          @page { margin: 4mm; size: auto; }
        }
        .label-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          padding: 8px;
        }
        @media print {
          .label-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
            padding: 0;
          }
        }
        .label-card {
          border: 1px dashed #ccc;
          border-radius: 4px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .label-card img { width: 80px; height: 80px; }
        .label-seq { font-size: 11px; font-weight: 700; color: #333; font-family: monospace; }
        .label-date { font-size: 9px; color: #666; }
        .label-short { font-size: 8px; color: #999; font-family: monospace; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, sans-serif' }}>
        {/* Header */}
        <div style={{ background: '#1c3a2a', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#a8d5a2', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>QC System</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>QR Label Generator</div>
          </div>
          <a href="/qc/dashboard" style={{ color: '#a8d5a2', fontSize: 13, textDecoration: 'none' }}>← Back to QC Dashboard</a>
        </div>

        {/* Controls */}
        <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 16, background: '#fff', borderBottom: '1px solid #e8e4dc' }}>
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
              style={{ width: 100, padding: '8px 12px', border: '1px solid #d4cfca', borderRadius: 6, fontSize: 16, fontFamily: 'inherit' }}
            />
          </div>
          <button
            onClick={generate}
            disabled={generating}
            style={{ marginTop: 18, padding: '10px 28px', background: '#2a6e45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1, fontFamily: 'inherit' }}
          >
            {generating ? 'Generating…' : '⚡ Generate Labels'}
          </button>
          {labels.length > 0 && (
            <>
              <button
                onClick={handlePrint}
                style={{ marginTop: 18, padding: '10px 28px', background: '#1c3a2a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                🖨️ Print
              </button>
              <div style={{ marginTop: 18, fontSize: 13, color: '#5a6a60' }}>
                {labels.length} labels ready · {date}
              </div>
            </>
          )}
        </div>

        {/* Tip */}
        {labels.length === 0 && (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: '#9aaa9f' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏷️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Generate a batch of QR labels</div>
            <div style={{ fontSize: 14 }}>Each label gets a unique ID. The runner peels one per bag sampled and scans it to log picker + orchard.</div>
          </div>
        )}

        {/* Label grid — screen preview */}
        {labels.length > 0 && (
          <div style={{ padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e4dc', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0ede6', fontSize: 13, color: '#5a6a60' }}>
                Preview — adjust label size in print dialog if needed
              </div>
              <div id="print-area" ref={printRef}>
                <div className="label-grid">
                  {labels.map(label => (
                    <div key={label.uuid} className="label-card">
                      <img src={label.dataUrl} alt={label.uuid} />
                      <div className="label-seq">#{String(label.seq).padStart(3, '0')}</div>
                      <div className="label-date">{date}</div>
                      <div className="label-short">{label.uuid.slice(-8)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

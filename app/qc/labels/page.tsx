'use client'

import { useState } from 'react'
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

  function downloadCsv() {
    const rows = ['seq,uuid,date']
    labels.forEach(l => rows.push(`${l.seq},${l.uuid},${batchDate}`))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qc-labels-${batchDate.replace(/ /g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <style>{`
        /* ── Screen: label preview grid ── */
        .label-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, 220px);
          gap: 12px;
          padding: 20px;
        }
        .label-card {
          width: 208px;
          height: 104px;
          border: 1px solid #d0cdc6;
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
        .label-text { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
        .label-brand { font-size: 9px; font-weight: 800; color: #1a4ba0; letter-spacing: 0.12em; text-transform: uppercase; }
        .label-seq { font-size: 24px; font-weight: 800; color: #111; line-height: 1; }
        .label-date { font-size: 10px; font-weight: 600; color: #333; }
        .label-id { font-size: 8px; color: #888; letter-spacing: 0.04em; }

        /* ── Print: one label per physical 100x50mm label ── */
        @media print {
          @page { size: 100mm 50mm; margin: 0; }

          /* Hide everything that's not the print area */
          .no-print { display: none !important; }
          body { background: white !important; }

          /* Grid → block so page-break works */
          .label-preview-grid {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .label-card {
            display: flex !important;
            width: 100mm !important;
            height: 50mm !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 3mm 4mm !important;
            gap: 4mm !important;
            margin: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
          }
          .label-qr { width: 42mm !important; height: 42mm !important; }
          .label-brand { font-size: 9pt !important; font-weight: 800 !important; }
          .label-seq { font-size: 26pt !important; }
          .label-date { font-size: 9pt !important; font-weight: 600 !important; }
          .label-id { font-size: 7pt !important; }
        }
      `}</style>

      {/* ── Header (no-print) ── */}
      <div className="no-print" style={{ background: '#1a4ba0', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#a0c4f0', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>QC System</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>QR Label Generator</div>
          <div style={{ color: '#5a7a8a', fontSize: 12, marginTop: 2 }}>Zebra ZT230 · 100 × 50 mm</div>
        </div>
        <a href="/qc/dashboard" style={{ color: '#a0c4f0', fontSize: 13, textDecoration: 'none' }}>← QC Dashboard</a>
      </div>

      {/* ── Controls (no-print) ── */}
      <div className="no-print" style={{ padding: '20px 32px', display: 'flex', alignItems: 'flex-end', gap: 16, background: '#fff', borderBottom: '1px solid #e8e4dc', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#5a6a60', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Number of labels
          </label>
          <input
            type="number" min={1} max={500} value={qty}
            onChange={e => setQty(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
            style={{ width: 90, padding: '8px 12px', border: '1px solid #d4cfca', borderRadius: 6, fontSize: 16, fontFamily: 'inherit' }}
          />
        </div>
        <button
          onClick={generate} disabled={generating}
          style={{ padding: '10px 28px', background: '#2176d9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1, fontFamily: 'inherit' }}
        >
          {generating ? 'Generating…' : '⚡ Generate'}
        </button>
        {labels.length > 0 && <>
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 28px', background: '#1a4ba0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            🖨️ Print {labels.length} labels
          </button>
          <button
            onClick={downloadCsv}
            style={{ padding: '10px 20px', background: '#fff', color: '#2176d9', border: '1.5px solid #2176d9', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ⬇ CSV for Zebra Designer
          </button>
          <div style={{ fontSize: 13, color: '#8a95a0', alignSelf: 'center' }}>
            {labels.length} labels · {batchDate}
          </div>
        </>}
      </div>

      {/* ── Empty state (no-print) ── */}
      {labels.length === 0 && (
        <div className="no-print" style={{ padding: '64px 32px', textAlign: 'center', color: '#8a95a0', background: '#f4f1eb', minHeight: 'calc(100vh - 140px)' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🏷️</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#5a6a60', marginBottom: 8 }}>Ready to generate</div>
          <div style={{ fontSize: 14, maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
            Generate labels, then either:<br /><br />
            <strong>🖨️ Print</strong> — Chrome print dialog, select Zebra ZT230, page size 100×50mm<br /><br />
            <strong>⬇ CSV</strong> — import into Zebra Designer as a data source
          </div>
        </div>
      )}

      {/* ── Label grid (prints as individual labels) ── */}
      {labels.length > 0 && (
        <div style={{ background: '#f4f1eb', minHeight: 'calc(100vh - 140px)' }}>
          <div className="label-preview-grid">
            {labels.map(label => (
              <div key={label.uuid} className="label-card">
                <img className="label-qr" src={label.dataUrl} alt="" />
                <div className="label-text">
                  <div className="label-brand">allFarm QC</div>
                  <div className="label-seq">#{String(label.seq).padStart(3, '0')}</div>
                  <div className="label-date">{batchDate}</div>
                  <div className="label-id">{label.uuid.slice(-12)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

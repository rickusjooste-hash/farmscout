'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase-auth'

// Lazy imports
let XLSX: any = null
async function loadXLSX() {
  if (!XLSX) XLSX = await import('xlsx')
  return XLSX
}

interface Orchard { id: string; name: string; variety: string | null }
interface Farm { id: string; full_name: string }
interface Nutrient { id: string; code: string; name: string; default_unit: string; display_order: number }

interface DataRow {
  orchard: string
  orchardId: string | null
  date: string
  nutrients: Record<string, number | null>
}

type Step = 'upload' | 'parsing' | 'review' | 'importing' | 'done'

interface Props {
  farms: Farm[]
  initialFarmId?: string
  onDone: () => void
  onClose: () => void
}

const NUTRIENT_CODES = ['N', 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'B', 'Mo', 'Na', 'Cl']
const MACRO_CODES = ['N', 'P', 'K', 'Ca', 'Mg', 'S']

const NUTRIENT_PATTERNS: Record<string, RegExp> = {
  'N': /^n\s*[(%]|^nitrogen/i,
  'P': /^p\s*[(%]|^phosph/i,
  'K': /^k\s*[(%]|^potass/i,
  'Ca': /^ca\s*[(%]|^calcium/i,
  'Mg': /^mg\s*[(%]|^magnes/i,
  'S': /^s\s*[(%]|^sulph/i,
  'Fe': /^fe\s*[(m]|^iron/i,
  'Mn': /^mn\s*[(m]|^mangan/i,
  'Zn': /^zn\s*[(m]|^zinc/i,
  'Cu': /^cu\s*[(m]|^copper/i,
  'B': /^b\s*[(m]|^boron/i,
  'Mo': /^mo\s*[(m]|^molyb/i,
  'Na': /^na\s*[(m]|^sodium/i,
  'Cl': /^cl\s*[(m]|^chlor/i,
}

// Also match bare single/double-letter nutrient codes in headers
const NUTRIENT_BARE: Record<string, RegExp> = {
  'N': /^N$/,  'P': /^P$/,  'K': /^K$/,
  'Ca': /^Ca$/i,  'Mg': /^Mg$/i,  'S': /^S$/,
  'Fe': /^Fe$/i,  'Mn': /^Mn$/i,  'Zn': /^Zn$/i,
  'Cu': /^Cu$/i,  'B': /^B$/,  'Mo': /^Mo$/i,
  'Na': /^Na$/i,  'Cl': /^Cl$/i,
}

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  return `${mo < 8 ? yr - 1 : yr}/${String(mo < 8 ? yr : yr + 1).slice(-2)}`
}

function buildSeasonOptions(): string[] {
  const currentStartYr = parseInt(getCurrentSeason().split('/')[0])
  const seasons: string[] = []
  for (let yr = 2018; yr <= currentStartYr; yr++)
    seasons.push(`${yr}/${String(yr + 1).slice(-2)}`)
  return seasons.reverse()
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\b(blk|block|blok)\b/gi, '').replace(/\b0+(\d)/g, '$1').replace(/[^a-z0-9]/g, '').trim()
}

function fuzzyScore(source: string, target: string): number {
  const ns = normalize(source)
  const nt = normalize(target)
  if (ns === nt) return 100
  if (nt.includes(ns) || ns.includes(nt)) return 80
  const srcNums = source.match(/\d+/g)?.join('') || ''
  const tgtNums = target.match(/\d+/g)?.join('') || ''
  if (srcNums && srcNums === tgtNums) return 60
  return 0
}

// ─── PDF text extraction using pdfjs-dist ───
// Extracts text items with x/y positions, groups into rows/columns to reconstruct the table
async function extractPdfTable(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // Collect all text items with positions across all pages
  const allItems: { text: string; x: number; y: number; page: number }[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const pageHeight = page.view[3] // page.view is [x1, y1, x2, y2]

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const tx = item.transform
      // PDF y is bottom-up; flip so top = 0
      const x = Math.round(tx[4])
      const y = Math.round(pageHeight - tx[5]) + (p - 1) * 10000 // offset pages
      allItems.push({ text: item.str.trim(), x, y, page: p })
    }
  }

  if (allItems.length === 0) throw new Error('No text found in PDF')

  // Group into rows by y-position (tolerance: 4px)
  allItems.sort((a, b) => a.y - b.y || a.x - b.x)

  const rowGroups: { y: number; items: { text: string; x: number }[] }[] = []
  for (const item of allItems) {
    const last = rowGroups[rowGroups.length - 1]
    if (last && Math.abs(item.y - last.y) <= 4) {
      last.items.push({ text: item.text, x: item.x })
    } else {
      rowGroups.push({ y: item.y, items: [{ text: item.text, x: item.x }] })
    }
  }

  // Sort items within each row by x
  for (const rg of rowGroups) rg.items.sort((a, b) => a.x - b.x)

  // Find the header row — look for row containing multiple nutrient codes
  let headerIdx = -1
  let bestHeaderScore = 0

  for (let i = 0; i < rowGroups.length; i++) {
    const texts = rowGroups[i].items.map(it => it.text)
    let score = 0
    for (const t of texts) {
      for (const [, pat] of Object.entries(NUTRIENT_PATTERNS)) {
        if (pat.test(t)) { score++; break }
      }
      for (const [, pat] of Object.entries(NUTRIENT_BARE)) {
        if (pat.test(t)) { score++; break }
      }
    }
    if (score > bestHeaderScore) { bestHeaderScore = score; headerIdx = i }
  }

  if (headerIdx < 0 || bestHeaderScore < 3) {
    throw new Error('Could not find nutrient column headers in PDF. Try CSV/Excel instead.')
  }

  // Build column boundaries from header positions
  const headerRow = rowGroups[headerIdx]
  const headers = headerRow.items.map(it => it.text)
  const colXs = headerRow.items.map(it => it.x)

  // Function to assign a value to the nearest column
  function assignToCol(x: number): number {
    let best = 0
    let bestDist = Math.abs(x - colXs[0])
    for (let c = 1; c < colXs.length; c++) {
      const dist = Math.abs(x - colXs[c])
      if (dist < bestDist) { bestDist = dist; best = c }
    }
    return best
  }

  // Extract data rows — skip headers, unit rows, footers, norms labels
  const dataRows: string[][] = []
  const skipPatterns = /^[%]$|^mg\/kg$|^ppm$|^Page\s|^Date\s|^Client|^Address|^Contact|^Phone|^Email|^Consultant|^Report|^No\.\s|^Department|^Condition|^Delivery|^Order|^CERTIFICATE|^Norms|^Low$|^High$|^Lab$/i

  for (let i = headerIdx + 1; i < rowGroups.length; i++) {
    const rg = rowGroups[i]
    if (rg.items.length < 3) continue

    const firstText = rg.items[0].text
    if (skipPatterns.test(firstText)) continue

    // Skip Norms/Low/High rows — Bemlab puts these as items within rows that start with fruit type names
    const rowTexts = rg.items.map(it => it.text)
    if (rowTexts.some(t => /^Norms?$/i.test(t) || /^Low$/i.test(t) || /^High$/i.test(t) || /^Adequate$/i.test(t) || /^Optimal$/i.test(t))) continue

    // Skip rows that are repeated header rows (nutrient code rows on subsequent pages)
    let nutMatch = 0
    for (const it of rg.items) {
      for (const [, pat] of Object.entries(NUTRIENT_BARE)) {
        if (pat.test(it.text)) { nutMatch++; break }
      }
    }
    if (nutMatch >= 3) continue

    // Skip unit rows (majority of items are % or mg/kg)
    const unitCount = rg.items.filter(it => /^[%]$|^mg\/kg$|^ppm$/i.test(it.text)).length
    if (unitCount >= 3) continue

    const row = new Array(headers.length).fill('')
    for (const item of rg.items) {
      const col = assignToCol(item.x)
      row[col] = row[col] ? `${row[col]} ${item.text}` : item.text
    }

    // Only include if row has some numeric values (at least 2 — nutrient data)
    const numCount = row.filter(v => /^\d/.test(v.replace(/[<>]/g, ''))).length
    if (numCount >= 2) {
      dataRows.push(row)
    }
  }

  return { headers, rows: dataRows }
}

// Map header text to nutrient code
function matchHeaderToNutrient(header: string): string | null {
  const h = header.trim()
  for (const [code, pat] of Object.entries(NUTRIENT_PATTERNS)) {
    if (pat.test(h)) return code
  }
  for (const [code, pat] of Object.entries(NUTRIENT_BARE)) {
    if (pat.test(h)) return code
  }
  return null
}

export default function ImportModal({ farms, initialFarmId, onDone, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [farmId, setFarmId] = useState(initialFarmId || '')
  const [season, setSeason] = useState(getCurrentSeason())
  const [labName, setLabName] = useState('')
  const [fileName, setFileName] = useState('')
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [rows, setRows] = useState<DataRow[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [nutrients, setNutrients] = useState<Nutrient[]>([])
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [parseStatus, setParseStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!farmId) return
    const supabase = createClient()
    supabase.from('orchards').select('id, name, variety').eq('farm_id', farmId).eq('is_active', true).order('name')
      .then(({ data }) => setOrchards(data || []))
  }, [farmId])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('nutrients').select('id, code, name, default_unit, display_order').order('display_order')
      .then(({ data }) => setNutrients(data || []))
  }, [])

  async function autoMapOrchards(dataRows: DataRow[]): Promise<DataRow[]> {
    const supabase = createClient()
    const { data: prevMaps } = await supabase
      .from('leaf_analysis_orchard_map')
      .select('source_name, orchard_id')
      .eq('farm_id', farmId)

    const prevLookup = new Map((prevMaps || []).map(m => [m.source_name, m.orchard_id]))

    return dataRows.map(row => {
      const prevId = prevLookup.get(row.orchard)
      if (prevId && orchards.some(o => o.id === prevId)) {
        return { ...row, orchardId: prevId }
      }
      let bestScore = 0
      let bestId: string | null = null
      for (const o of orchards) {
        // Try matching against name alone and name+variety
        const s1 = fuzzyScore(row.orchard, o.name)
        const s2 = o.variety ? fuzzyScore(row.orchard, `${o.name} ${o.variety}`) : 0
        const score = Math.max(s1, s2)
        if (score > bestScore) { bestScore = score; bestId = o.id }
      }
      return { ...row, orchardId: bestScore >= 50 ? bestId : null }
    })
  }

  // ─── PDF parsing (client-side with pdfjs-dist) ───
  async function parsePDF(file: File) {
    setStep('parsing')
    setParseStatus('Reading PDF...')
    setError('')

    try {
      const { headers, rows: pdfRows } = await extractPdfTable(file)

      // Map headers to nutrient codes
      const colMap: Record<number, string> = {} // col index → nutrient code
      let orchardCol = -1
      let cultivarCol = -1

      for (let i = 0; i < headers.length; i++) {
        const nutrient = matchHeaderToNutrient(headers[i])
        if (nutrient) {
          colMap[i] = nutrient
        } else if (orchardCol < 0 && /orchard|block|blok|sample|site|naam|name/i.test(headers[i])) {
          orchardCol = i
        } else if (cultivarCol < 0 && /cultivar|kultivar|variety/i.test(headers[i])) {
          cultivarCol = i
        }
      }

      // If no orchard column detected, assume first non-nutrient column
      if (orchardCol < 0) {
        for (let i = 0; i < headers.length; i++) {
          if (!colMap[i]) { orchardCol = i; break }
        }
      }

      if (Object.keys(colMap).length < 3) {
        setError(`Only found ${Object.keys(colMap).length} nutrient columns. Is this a leaf analysis report?`)
        setStep('upload')
        return
      }

      const yr = parseInt(season.split('/')[0]) + 1
      const defaultDate = `${yr}-02-01`

      setParseStatus('Building data rows...')

      const dataRows: DataRow[] = pdfRows.map(row => {
        let orchName = orchardCol >= 0 ? row[orchardCol]?.trim() || '' : ''
        const cultivar = cultivarCol >= 0 ? row[cultivarCol]?.trim() || '' : ''
        if (cultivar) orchName = `${orchName} ${cultivar}`.trim()
        const nuts: Record<string, number | null> = {}
        for (const code of NUTRIENT_CODES) {
          nuts[code] = null
        }
        for (const [colStr, code] of Object.entries(colMap)) {
          const col = parseInt(colStr)
          const raw = row[col]?.replace(/[<>]/g, '').trim() || ''
          const val = parseFloat(raw)
          nuts[code] = isNaN(val) ? null : val
        }
        return { orchard: orchName, orchardId: null, date: defaultDate, nutrients: nuts }
      }).filter(r => r.orchard)

      if (dataRows.length === 0) {
        setError('No data rows could be extracted. Try CSV/Excel instead.')
        setStep('upload')
        return
      }

      setParseStatus('Matching orchards...')
      const mapped = await autoMapOrchards(dataRows)
      setRows(mapped)
      setStep('review')
    } catch (e: any) {
      setError(e.message || 'Failed to parse PDF')
      setStep('upload')
    }
  }

  // ─── CSV/Excel parsing (client-side with xlsx) ───
  async function parseCSV(file: File) {
    setStep('parsing')
    setParseStatus('Parsing spreadsheet...')
    setError('')

    try {
      const xlsx = await loadXLSX()
      const ab = await file.arrayBuffer()
      const wb = xlsx.read(ab, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json: Record<string, any>[] = xlsx.utils.sheet_to_json(ws, { defval: '' })

      if (json.length === 0) { setError('File is empty'); setStep('upload'); return }

      const headers = Object.keys(json[0])

      let orchardCol: string | null = null
      let dateCol: string | null = null
      const nutrientCols: Record<string, string> = {}

      for (const h of headers) {
        if (!orchardCol && /orchard|block|blok|sample|site|naam|name/i.test(h)) orchardCol = h
        if (!dateCol && /date|datum|sampl.*date/i.test(h)) dateCol = h
        for (const [code, pat] of Object.entries(NUTRIENT_PATTERNS)) {
          if (!nutrientCols[code] && pat.test(h)) nutrientCols[code] = h
        }
        // Also try bare codes
        for (const [code, pat] of Object.entries(NUTRIENT_BARE)) {
          if (!nutrientCols[code] && pat.test(h.trim())) nutrientCols[code] = h
        }
      }

      if (!orchardCol) orchardCol = headers[0]

      const yr = parseInt(season.split('/')[0]) + 1
      const defaultDate = `${yr}-02-01`

      const dataRows: DataRow[] = json.map(raw => {
        const orchName = String(raw[orchardCol!] || '').trim()
        if (!orchName) return null

        let sampleDate = defaultDate
        if (dateCol && raw[dateCol]) {
          const d = raw[dateCol]
          if (typeof d === 'number' && xlsx) {
            const parsed = xlsx.SSF.parse_date_code(d)
            if (parsed) sampleDate = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
          } else {
            const parsed = new Date(d)
            if (!isNaN(parsed.getTime())) sampleDate = parsed.toISOString().slice(0, 10)
          }
        }

        const nuts: Record<string, number | null> = {}
        for (const code of NUTRIENT_CODES) {
          if (nutrientCols[code]) {
            const val = parseFloat(String(raw[nutrientCols[code]]))
            nuts[code] = isNaN(val) ? null : val
          } else {
            nuts[code] = null
          }
        }

        return { orchard: orchName, orchardId: null, date: sampleDate, nutrients: nuts } as DataRow
      }).filter(Boolean) as DataRow[]

      setParseStatus('Matching orchards...')
      const mapped = await autoMapOrchards(dataRows)
      setRows(mapped)
      setStep('review')
    } catch (e: any) {
      setError(`Failed to parse file: ${e.message}`)
      setStep('upload')
    }
  }

  const handleFile = useCallback(async (file: File) => {
    if (!farmId) { setError('Select a farm first'); return }
    setError('')
    setFileName(file.name)
    setOriginalFile(file)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') {
      await parsePDF(file)
    } else {
      await parseCSV(file)
    }
  }, [farmId, season, orchards])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  function updateRowOrchard(idx: number, orchardId: string | null) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, orchardId } : r))
  }

  function updateRowNutrient(idx: number, code: string, value: string) {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const v = value.trim() === '' ? null : parseFloat(value)
      return { ...r, nutrients: { ...r.nutrients, [code]: v !== null && isNaN(v) ? null : v } }
    }))
  }

  function updateRowDate(idx: number, date: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, date } : r))
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  async function doImport() {
    const mappedRows = rows.filter(r => r.orchardId)
    if (mappedRows.length === 0) { setError('Map at least one orchard'); return }

    setStep('importing')
    setError('')

    // Upload original file to Supabase Storage (best-effort — don't block import)
    let pdfUrl: string | null = null
    if (originalFile && originalFile.name.toLowerCase().endsWith('.pdf')) {
      try {
        const supabase = createClient()
        const safeName = originalFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${farmId}/${season.replace('/', '-')}/${Date.now()}_${safeName}`
        const { error: uploadErr } = await supabase.storage
          .from('leaf-analysis-pdfs')
          .upload(path, originalFile, { upsert: true })
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('leaf-analysis-pdfs')
            .getPublicUrl(path)
          pdfUrl = urlData.publicUrl
        }
      } catch {
        // Don't block the import if PDF upload fails
      }
    }

    const importRows = mappedRows.map(r => ({
      orchard_id: r.orchardId,
      sample_date: r.date,
      sample_type: 'mid-season',
      results: r.nutrients,
    }))

    const uniqueMappings = [...new Map(
      mappedRows.map(r => [r.orchard, { source_name: r.orchard, orchard_id: r.orchardId }])
    ).values()]

    try {
      const res = await fetch('/api/leaf-analysis/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: farmId,
          season,
          lab_name: labName || null,
          pdf_url: pdfUrl,
          rows: importRows,
          orchard_mappings: uniqueMappings,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Import failed'); setStep('review'); return }
      setResult(json)
      setStep('done')
    } catch {
      setError('Network error')
      setStep('review')
    }
  }

  const mappedCount = rows.filter(r => r.orchardId).length
  const unmappedCount = rows.filter(r => !r.orchardId).length
  const activeNutrients = NUTRIENT_CODES.filter(code =>
    rows.some(r => r.nutrients[code] != null)
  )

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <h3 style={s.title}>Import Leaf Analysis</h3>
          <div style={s.steps}>
            {(['Upload', 'Review & Map', 'Done'] as const).map((label, i) => {
              const stepMap: Step[] = ['upload', 'review', 'done']
              const current = step === 'parsing' || step === 'importing' ? (step === 'parsing' ? 0 : 1) : stepMap.indexOf(step)
              const active = i === current
              const done = i < current
              return (
                <span key={label} style={{
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  color: active ? '#2176d9' : done ? '#4caf72' : '#999',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {done ? '✓ ' : ''}{label}
                  {i < 2 && <span style={{ color: '#ddd', margin: '0 6px' }}>›</span>}
                </span>
              )
            })}
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.body}>
          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <>
              <div style={s.fieldRow}>
                <label style={s.label}>
                  Farm
                  <select value={farmId} onChange={e => setFarmId(e.target.value)} style={s.select}>
                    <option value="">Select farm...</option>
                    {farms.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
                  </select>
                </label>
                <label style={s.label}>
                  Season
                  <select value={season} onChange={e => setSeason(e.target.value)} style={s.select}>
                    {buildSeasonOptions().map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label style={s.label}>
                  Lab (optional)
                  <input value={labName} onChange={e => setLabName(e.target.value)} style={s.input} placeholder="Bemlab, SGS..." />
                </label>
              </div>

              <div
                style={s.dropZone}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                <div style={{ fontWeight: 600, color: '#1a2a3a', marginBottom: 4 }}>
                  {fileName || 'Drop PDF, .xlsx, or .csv file here'}
                </div>
                <div style={{ fontSize: 13, color: '#999' }}>
                  Supports lab report PDFs (Bemlab, SGS, NviroTek) and spreadsheets
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={handleInputChange}
                  style={{ display: 'none' }}
                />
              </div>
            </>
          )}

          {/* ── Parsing state ── */}
          {step === 'parsing' && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>
                <span style={{ display: 'inline-block', animation: 'la-spin 1s linear infinite' }}>⏳</span>
              </div>
              <div style={{ color: '#1a2a3a', fontWeight: 600, marginBottom: 4 }}>{parseStatus}</div>
              <style>{`@keyframes la-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* ── Step 2: Review & Map ── */}
          {step === 'review' && (
            <>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#6a7a70' }}>
                  <strong>{fileName}</strong> — {rows.length} rows · {mappedCount} mapped, {unmappedCount} unmapped
                  {labName && <span> · Lab: {labName}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#4caf72', fontWeight: 600 }}>● Mapped</span>
                  <span style={{ fontSize: 11, color: '#e85a4a', fontWeight: 600 }}>● Unmapped (skipped)</span>
                </div>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', border: '1px solid #e8e4dc', borderRadius: 10 }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, position: 'sticky', left: 0, zIndex: 2, background: '#f5f3ee', minWidth: 140 }}>
                        PDF / CSV Name
                      </th>
                      <th style={{ ...s.th, position: 'sticky', left: 140, zIndex: 2, background: '#f5f3ee', minWidth: 180 }}>
                        → System Orchard
                      </th>
                      <th style={{ ...s.th, minWidth: 100 }}>Date</th>
                      {activeNutrients.map(code => (
                        <th key={code} style={{ ...s.th, textAlign: 'right', minWidth: 64 }}>
                          {code}
                          <div style={{ fontSize: 10, fontWeight: 400, color: '#999' }}>
                            {MACRO_CODES.includes(code) ? '%' : 'mg/kg'}
                          </div>
                        </th>
                      ))}
                      <th style={{ ...s.th, width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} style={{ background: row.orchardId ? '#fff' : '#fef8f6' }}>
                        <td style={{ ...s.td, position: 'sticky', left: 0, background: row.orchardId ? '#fff' : '#fef8f6', fontWeight: 500, fontSize: 12 }}>
                          {row.orchard}
                        </td>
                        <td style={{ ...s.td, position: 'sticky', left: 140, background: row.orchardId ? '#fff' : '#fef8f6' }}>
                          <select
                            value={row.orchardId || ''}
                            onChange={e => updateRowOrchard(idx, e.target.value || null)}
                            style={{ ...s.cellSelect, borderColor: row.orchardId ? '#4caf72' : '#e85a4a' }}
                          >
                            <option value="">— Skip —</option>
                            {orchards.map(o => <option key={o.id} value={o.id}>{o.name}{o.variety ? ` (${o.variety})` : ''}</option>)}
                          </select>
                        </td>
                        <td style={s.td}>
                          <input type="date" value={row.date} onChange={e => updateRowDate(idx, e.target.value)} style={s.cellInput} />
                        </td>
                        {activeNutrients.map(code => (
                          <td key={code} style={s.td}>
                            <input
                              type="number"
                              step={MACRO_CODES.includes(code) ? '0.01' : '0.1'}
                              value={row.nutrients[code] != null ? String(row.nutrients[code]) : ''}
                              onChange={e => updateRowNutrient(idx, code, e.target.value)}
                              style={s.cellNumInput}
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td style={{ ...s.td, textAlign: 'center' }}>
                          <button onClick={() => removeRow(idx)} style={s.removeBtn} title="Remove row">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>
                <span style={{ display: 'inline-block', animation: 'la-spin 1s linear infinite' }}>⏳</span>
              </div>
              <div style={{ color: '#1a2a3a', fontWeight: 600 }}>Importing {mappedCount} rows...</div>
              <style>{`@keyframes la-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 36, marginBottom: 12, color: '#4caf72' }}>✓</div>
              <div style={{ color: '#1a2a3a', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Import Complete</div>
              <div style={{ fontSize: 14, color: '#6a7a70' }}>
                {result.imported} imported · {result.skipped} skipped · {result.total} total
              </div>
            </div>
          )}

          {error && <div style={{ color: '#e85a4a', fontSize: 13, marginTop: 12 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          {step === 'upload' && (
            <button onClick={onClose} style={s.cancelBtn}>Cancel</button>
          )}
          {step === 'review' && (
            <>
              <button onClick={() => { setStep('upload'); setRows([]); setFileName('') }} style={s.cancelBtn}>← Back</button>
              <button onClick={doImport} disabled={mappedCount === 0} style={{
                ...s.importBtn, opacity: mappedCount === 0 ? 0.5 : 1,
              }}>
                Import {mappedCount} row{mappedCount !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 'done' && (
            <>
              <button onClick={() => { setStep('upload'); setFileName(''); setRows([]); setResult(null) }} style={s.cancelBtn}>
                Import Another
              </button>
              <button onClick={() => { onDone(); onClose() }} style={s.nextBtn}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', zIndex: 8000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: 1100, maxWidth: '96vw', maxHeight: '92vh',
    background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column',
    boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '20px 24px', borderBottom: '1px solid #e8e4dc',
  },
  title: {
    fontSize: 18, fontWeight: 600, color: '#1a2a3a', margin: 0,
    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
  },
  steps: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 20, color: '#999',
    cursor: 'pointer', padding: '4px 8px',
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '20px 24px',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '16px 24px', borderTop: '1px solid #e8e4dc',
  },
  fieldRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 14, marginBottom: 20,
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: 12, fontWeight: 500, color: '#6a7a70',
    fontFamily: 'Inter, sans-serif',
  },
  input: {
    padding: '8px 10px', border: '1px solid #d4cfca', borderRadius: 8,
    fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#1a2a3a', outline: 'none',
  },
  select: {
    padding: '8px 10px', border: '1px solid #d4cfca', borderRadius: 8,
    fontSize: 14, fontFamily: 'Inter, sans-serif', color: '#1a2a3a',
    background: '#fff', outline: 'none',
  },
  dropZone: {
    border: '2px dashed #d4cfca', borderRadius: 14, padding: 48,
    textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
    fontFamily: 'Inter, sans-serif',
  },
  table: {
    width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12,
  },
  th: {
    textAlign: 'left', padding: '8px 6px', fontWeight: 600, color: '#6a7a70',
    fontSize: 11, borderBottom: '2px solid #e8e4dc', background: '#f5f3ee',
    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1,
  },
  td: {
    padding: '4px 4px', borderBottom: '1px solid #f0ede6',
  },
  cellSelect: {
    width: '100%', padding: '4px 4px', border: '1.5px solid #d4cfca', borderRadius: 5,
    fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#1a2a3a',
    background: '#fff', outline: 'none',
  },
  cellInput: {
    width: '100%', padding: '4px 4px', border: '1px solid #e8e4dc', borderRadius: 4,
    fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#1a2a3a', outline: 'none',
  },
  cellNumInput: {
    width: 56, padding: '4px 4px', border: '1px solid #e8e4dc', borderRadius: 4,
    fontSize: 12, fontFamily: 'Inter, sans-serif', color: '#1a2a3a',
    textAlign: 'right', outline: 'none',
  },
  removeBtn: {
    background: 'none', border: 'none', color: '#ccc', cursor: 'pointer',
    fontSize: 14, padding: 2, lineHeight: 1,
  },
  cancelBtn: {
    padding: '8px 18px', borderRadius: 8, border: '1px solid #d4cfca',
    background: '#fff', color: '#6a7a70', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  nextBtn: {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  importBtn: {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: '#4caf72', color: '#fff', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
}

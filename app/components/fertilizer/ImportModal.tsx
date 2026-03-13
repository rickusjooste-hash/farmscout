'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase-auth'

// Lazy imports
let XLSX: any = null
async function loadXLSX() {
  if (!XLSX) XLSX = await import('xlsx')
  return XLSX
}

interface Orchard { id: string; name: string; variety: string | null; legacy_id: number | null }
interface Farm { id: string; full_name: string }

interface ProductInfo {
  name: string
  registration_no: string | null
  n_pct: number
  p_pct: number
  k_pct: number
  ca_pct: number
  mg_pct: number
  s_pct: number
  default_unit: string
}

interface TimingInfo {
  label: string
  sort_order: number
  products: string[] // product names
}

interface DataLine {
  timing_label: string
  product_name: string
  orchard_source: string
  orchardId: string | null
  legacy_orchard_id: number | null
  rate_per_ha: number
  unit: string
  total_qty: number | null
  ha: number | null
}

type Step = 'upload' | 'parsing' | 'review' | 'importing' | 'done'

interface Commodity { id: string; name: string }

interface Props {
  farms: Farm[]
  commodities: Commodity[]
  initialFarmId?: string
  onDone: () => void
  onClose: () => void
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

export default function ImportModal({ farms, commodities, initialFarmId, onDone, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [farmId, setFarmId] = useState(initialFarmId || '')
  const [season, setSeason] = useState(getCurrentSeason())
  const [commodityId, setCommodityId] = useState('')
  const [programType, setProgramType] = useState('standard')
  const [fileName, setFileName] = useState('')
  const [lines, setLines] = useState<DataLine[]>([])
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [timings, setTimings] = useState<TimingInfo[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number; products: number; timings: number } | null>(null)
  const [error, setError] = useState('')
  const [parseStatus, setParseStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!farmId) return
    const supabase = createClient()
    supabase.from('orchards').select('id, name, variety, legacy_id').eq('farm_id', farmId).eq('is_active', true).order('name')
      .then(({ data }) => setOrchards((data || []) as Orchard[]))
  }, [farmId])

  async function autoMapOrchards(dataLines: DataLine[]): Promise<DataLine[]> {
    const supabase = createClient()

    // Fetch saved fert mappings
    const { data: fertMaps } = await supabase
      .from('fert_orchard_map')
      .select('source_name, orchard_id')
      .eq('farm_id', farmId)
    const fertLookup = new Map((fertMaps || []).map(m => [m.source_name, m.orchard_id]))

    // Fetch saved leaf analysis mappings as fallback
    const { data: leafMaps } = await supabase
      .from('leaf_analysis_orchard_map')
      .select('source_name, orchard_id')
      .eq('farm_id', farmId)
    const leafLookup = new Map((leafMaps || []).map(m => [m.source_name, m.orchard_id]))

    // Build legacy_id lookup
    const legacyLookup = new Map<number, string>()
    for (const o of orchards) {
      if (o.legacy_id != null) legacyLookup.set(o.legacy_id, o.id)
    }

    return dataLines.map(line => {
      // 1. Legacy ID match (strongest signal)
      if (line.legacy_orchard_id != null) {
        const id = legacyLookup.get(line.legacy_orchard_id)
        if (id) return { ...line, orchardId: id }
      }

      // 2. Saved fert mappings
      const fertId = fertLookup.get(line.orchard_source)
      if (fertId && orchards.some(o => o.id === fertId)) {
        return { ...line, orchardId: fertId }
      }

      // 3. Saved leaf analysis mappings
      const leafId = leafLookup.get(line.orchard_source)
      if (leafId && orchards.some(o => o.id === leafId)) {
        return { ...line, orchardId: leafId }
      }

      // 4. Fuzzy name match
      let bestScore = 0
      let bestId: string | null = null
      for (const o of orchards) {
        const s1 = fuzzyScore(line.orchard_source, o.name)
        const s2 = o.variety ? fuzzyScore(line.orchard_source, `${o.name} ${o.variety}`) : 0
        const score = Math.max(s1, s2)
        if (score > bestScore) { bestScore = score; bestId = o.id }
      }
      return { ...line, orchardId: bestScore >= 50 ? bestId : null }
    })
  }

  async function parseExcel(file: File) {
    setStep('parsing')
    setParseStatus('Reading Excel file...')
    setError('')

    try {
      const xlsx = await loadXLSX()
      const ab = await file.arrayBuffer()
      const wb = xlsx.read(ab, { type: 'array', cellStyles: true })

      // Find per_ha sheet
      const perHaSheetName = wb.SheetNames.find((n: string) => /per.?ha/i.test(n)) || wb.SheetNames[0]
      const ws = wb.Sheets[perHaSheetName]

      if (!ws) { setError('No sheet found'); setStep('upload'); return }

      // Get sheet range
      const range = xlsx.utils.decode_range(ws['!ref'] || 'A1')
      const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = ws['!merges'] || []

      // Helper: get cell value
      function cellVal(r: number, c: number): string {
        const addr = xlsx.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (!cell) return ''
        return String(cell.v ?? cell.w ?? '').trim()
      }

      function cellNum(r: number, c: number): number | null {
        const addr = xlsx.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (!cell) return null
        const v = cell.v
        if (typeof v === 'number') return v
        const parsed = parseFloat(String(v).replace(/[,\s]/g, ''))
        return isNaN(parsed) ? null : parsed
      }

      // Row 8 (index 7) = timing headers in merged cells
      // Row 9 (index 8) = product names under each timing
      // Row 10 (index 9) = units
      // Row 12+ (index 11+) = data
      const TIMING_ROW = 7
      const PRODUCT_ROW = 8
      const UNIT_ROW = 9
      const DATA_START_ROW = 11
      const LEGACY_COL = 7 // Column H = index 7

      setParseStatus('Parsing timing headers...')

      // Build timing spans from merged cells in timing row
      const timingSpans: Array<{ label: string; startCol: number; endCol: number; sortOrder: number }> = []

      // Find merges in the timing row — skip "Block Information" (cols A-H) and NPK summary groups
      const timingMerges = merges.filter(m => m.s.r === TIMING_ROW && m.s.c > LEGACY_COL)

      if (timingMerges.length > 0) {
        for (const merge of timingMerges) {
          const label = cellVal(merge.s.r, merge.s.c)
          if (!label) continue
          // Skip NPK summary columns (e.g., "NPK: Summer 2025", "NPK: Autumn 2026")
          if (/^NPK/i.test(label)) continue
          timingSpans.push({
            label,
            startCol: merge.s.c,
            endCol: merge.e.c,
            sortOrder: timingSpans.length,
          })
        }
      } else {
        // Fallback: scan row 8 for non-empty cells, assume each is a timing
        for (let c = LEGACY_COL + 1; c <= range.e.c; c++) {
          const label = cellVal(TIMING_ROW, c)
          if (label) {
            // Find the extent: until next non-empty cell in timing row
            let endCol = c
            for (let cc = c + 1; cc <= range.e.c; cc++) {
              if (cellVal(TIMING_ROW, cc)) break
              endCol = cc
            }
            timingSpans.push({ label, startCol: c, endCol, sortOrder: timingSpans.length })
            c = endCol
          }
        }
      }

      timingSpans.sort((a, b) => a.startCol - b.startCol)
      // Reassign sort order after sorting by column
      timingSpans.forEach((t, i) => t.sortOrder = i)

      if (timingSpans.length === 0) {
        setError('Could not find timing headers in row 8. Is this a fertilizer program Excel file?')
        setStep('upload')
        return
      }

      setParseStatus('Parsing products...')

      // Build product columns: map each column to its product name + parent timing
      interface ProductCol {
        col: number
        productName: string
        timingLabel: string
        unit: string
      }

      const productCols: ProductCol[] = []
      for (const timing of timingSpans) {
        for (let c = timing.startCol; c <= timing.endCol; c++) {
          const prodName = cellVal(PRODUCT_ROW, c)
          if (!prodName) continue
          const unit = cellVal(UNIT_ROW, c) || 'kg/ha'
          productCols.push({
            col: c,
            productName: prodName,
            timingLabel: timing.label,
            unit,
          })
        }
      }

      if (productCols.length === 0) {
        setError('No products found in row 9.')
        setStep('upload')
        return
      }

      // Build timing info
      const timingInfoMap: Record<string, TimingInfo> = {}
      for (const timing of timingSpans) {
        timingInfoMap[timing.label] = {
          label: timing.label,
          sort_order: timing.sortOrder,
          products: [],
        }
      }
      for (const pc of productCols) {
        if (!timingInfoMap[pc.timingLabel].products.includes(pc.productName)) {
          timingInfoMap[pc.timingLabel].products.push(pc.productName)
        }
      }

      setParseStatus('Reading orchard data...')

      // Find orchard name column, variety column, ha column
      // Labels are in UNIT_ROW (row 10): "Block", "Cultivar", "Ha", "OrchardID", etc.
      let orchardCol = 0
      let varietyCol = -1
      let haCol = -1
      for (let c = 0; c <= Math.min(range.e.c, 10); c++) {
        const label = cellVal(UNIT_ROW, c).toLowerCase()
        const label2 = cellVal(PRODUCT_ROW, c).toLowerCase()
        if (label === 'ha' || label === 'hectares' || label2 === 'ha') haCol = c
        if (varietyCol < 0 && (label.includes('cultivar') || label.includes('kultivar') || label.includes('variety'))) varietyCol = c
        if (label.includes('block') || label.includes('blok') || label.includes('orchard')) {
          orchardCol = c
        }
      }

      // Parse data rows
      const dataLines: DataLine[] = []
      for (let r = DATA_START_ROW; r <= range.e.r; r++) {
        let orchName = cellVal(r, orchardCol)
        if (!orchName) continue
        // Append variety if available
        if (varietyCol >= 0) {
          const variety = cellVal(r, varietyCol)
          if (variety) orchName = `${orchName} (${variety})`
        }
        // Stop at total/summary rows
        if (/^(total|totaal|sum|grand)/i.test(orchName)) break

        const legacyId = cellNum(r, LEGACY_COL)
        const ha = haCol >= 0 ? cellNum(r, haCol) : null

        for (const pc of productCols) {
          const rate = cellNum(r, pc.col)
          if (rate === null || rate === 0) continue

          dataLines.push({
            timing_label: pc.timingLabel,
            product_name: pc.productName,
            orchard_source: orchName,
            orchardId: null,
            legacy_orchard_id: legacyId != null ? Math.round(legacyId) : null,
            rate_per_ha: rate,
            unit: pc.unit,
            total_qty: null, // will be populated from per_block sheet if available
            ha,
          })
        }
      }

      // Try to get total_qty from per_block sheet
      const perBlockName = wb.SheetNames.find((n: string) => /per.?bl/i.test(n))
      if (perBlockName) {
        const bws = wb.Sheets[perBlockName]
        if (bws) {
          // Helper that reads from per_block sheet (not per_ha)
          const bwsCellVal = (r: number, c: number): string => {
            const addr = xlsx.utils.encode_cell({ r, c })
            const cell = bws[addr]
            if (!cell) return ''
            return String(cell.v ?? cell.w ?? '').trim()
          }

          const bRange = xlsx.utils.decode_range(bws['!ref'] || 'A1')
          // Same structure but values are totals
          for (let r = DATA_START_ROW; r <= bRange.e.r; r++) {
            let orchName = bwsCellVal(r, orchardCol)
            if (!orchName || /^(total|totaal|sum|grand)/i.test(orchName)) {
              if (/^(total|totaal|sum|grand)/i.test(orchName)) break
              continue
            }
            // Append variety to match orchard_source format
            if (varietyCol >= 0) {
              const variety = bwsCellVal(r, varietyCol)
              if (variety) orchName = `${orchName} (${variety})`
            }

            for (const pc of productCols) {
              const addr = xlsx.utils.encode_cell({ r, c: pc.col })
              const cell = bws[addr]
              if (!cell) continue
              const totalVal = typeof cell.v === 'number' ? cell.v : parseFloat(String(cell.v).replace(/[,\s]/g, ''))
              if (isNaN(totalVal) || totalVal === 0) continue

              // Find matching line
              const match = dataLines.find(l =>
                l.orchard_source === orchName &&
                l.timing_label === pc.timingLabel &&
                l.product_name === pc.productName
              )
              if (match) match.total_qty = totalVal
            }
          }
        }
      }

      // Fallback: calculate total_qty from rate_per_ha * ha where still null
      for (const line of dataLines) {
        if (line.total_qty === null && line.rate_per_ha && line.ha) {
          line.total_qty = line.rate_per_ha * line.ha
        }
      }

      // Parse products sheet for composition data
      setParseStatus('Reading product compositions...')
      const productsSheet = wb.SheetNames.find((n: string) => /product/i.test(n))
      const productInfos: ProductInfo[] = []
      const uniqueProductNames = [...new Set(productCols.map(pc => pc.productName))]

      if (productsSheet) {
        const pws = wb.Sheets[productsSheet]
        if (pws) {
          const pRange = xlsx.utils.decode_range(pws['!ref'] || 'A1')
          // Helper that reads from products sheet (not per_ha)
          const pws_cellVal = (r: number, c: number): string => {
            const addr = xlsx.utils.encode_cell({ r, c })
            const cell = pws[addr]
            return cell ? String(cell.v ?? cell.w ?? '').trim() : ''
          }
          const pws_cellNum = (r: number, c: number): number => {
            const addr = xlsx.utils.encode_cell({ r, c })
            const cell = pws[addr]
            if (!cell) return 0
            const v = cell.v
            if (typeof v === 'number') return v
            const parsed = parseFloat(String(v).replace(/[,\s%]/g, ''))
            return isNaN(parsed) ? 0 : parsed
          }
          // Scan for product names and their N/P/K/Ca/Mg/S percentages
          // Typical layout: Name | Reg No | N% | P% | K% | Ca% | Mg% | S%
          // Find header row
          let pHeaderRow = -1
          for (let r = 0; r <= Math.min(pRange.e.r, 10); r++) {
            for (let c = 0; c <= pRange.e.c; c++) {
              const v = pws_cellVal(r, c).toLowerCase()
              if (v.includes('product') || v.includes('name') || v.includes('naam')) {
                pHeaderRow = r
                break
              }
            }
            if (pHeaderRow >= 0) break
          }

          if (pHeaderRow >= 0) {
            let nameCol = -1, regCol = -1, nCol = -1, pCol = -1, kCol = -1, caCol = -1, mgCol = -1, sCol = -1
            for (let c = 0; c <= pRange.e.c; c++) {
              const h = pws_cellVal(pHeaderRow, c).toLowerCase()
              if (nameCol < 0 && (h.includes('product') || h.includes('name') || h.includes('naam'))) nameCol = c
              else if (regCol < 0 && (h.includes('reg') || h.includes('l-nr'))) regCol = c
              else if (nCol < 0 && (h === 'n' || h === 'n%' || h.includes('nitrogen'))) nCol = c
              else if (pCol < 0 && (h === 'p' || h === 'p%' || h.includes('phosph'))) pCol = c
              else if (kCol < 0 && (h === 'k' || h === 'k%' || h.includes('potass'))) kCol = c
              else if (caCol < 0 && (h === 'ca' || h === 'ca%' || h.includes('calcium'))) caCol = c
              else if (mgCol < 0 && (h === 'mg' || h === 'mg%' || h.includes('magnes'))) mgCol = c
              else if (sCol < 0 && (h === 's' || h === 's%' || h.includes('sulph'))) sCol = c
            }

            for (let r = pHeaderRow + 1; r <= pRange.e.r; r++) {
              const name = nameCol >= 0 ? pws_cellVal(r, nameCol) : ''
              if (!name) continue

              productInfos.push({
                name,
                registration_no: regCol >= 0 ? pws_cellVal(r, regCol) || null : null,
                n_pct: nCol >= 0 ? pws_cellNum(r, nCol) : 0,
                p_pct: pCol >= 0 ? pws_cellNum(r, pCol) : 0,
                k_pct: kCol >= 0 ? pws_cellNum(r, kCol) : 0,
                ca_pct: caCol >= 0 ? pws_cellNum(r, caCol) : 0,
                mg_pct: mgCol >= 0 ? pws_cellNum(r, mgCol) : 0,
                s_pct: sCol >= 0 ? pws_cellNum(r, sCol) : 0,
                default_unit: 'kg/ha',
              })
            }
          }
        }
      }

      // Ensure all referenced products have entries (even if no composition data)
      for (const pName of uniqueProductNames) {
        if (!productInfos.find(p => p.name === pName)) {
          productInfos.push({
            name: pName,
            registration_no: null,
            n_pct: 0, p_pct: 0, k_pct: 0, ca_pct: 0, mg_pct: 0, s_pct: 0,
            default_unit: 'kg/ha',
          })
        }
      }

      if (dataLines.length === 0) {
        setError('No data rows could be extracted. Check the Excel file structure.')
        setStep('upload')
        return
      }

      setParseStatus('Matching orchards...')
      const mapped = await autoMapOrchards(dataLines)
      setLines(mapped)
      setProducts(productInfos)
      setTimings(Object.values(timingInfoMap))
      setStep('review')
    } catch (e: any) {
      setError(e.message || 'Failed to parse Excel file')
      setStep('upload')
    }
  }

  const handleFile = useCallback(async (file: File) => {
    if (!farmId) { setError('Select a farm first'); return }
    setError('')
    setFileName(file.name)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') {
      await parseExcel(file)
    } else {
      setError('Only .xlsx files are supported for fertilizer programs')
      return
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

  function updateLineOrchard(orchardSource: string, orchardId: string | null) {
    // Update all lines with the same orchard_source
    setLines(prev => prev.map(l =>
      l.orchard_source === orchardSource ? { ...l, orchardId } : l
    ))
  }

  async function doImport() {
    const mappedLines = lines.filter(l => l.orchardId)
    if (mappedLines.length === 0) { setError('Map at least one orchard'); return }

    setStep('importing')
    setError('')

    const importLines = mappedLines.map(l => ({
      timing_label: l.timing_label,
      product_name: l.product_name,
      orchard_id: l.orchardId,
      legacy_orchard_id: l.legacy_orchard_id,
      source_block_name: l.orchard_source,
      rate_per_ha: l.rate_per_ha,
      unit: l.unit,
      total_qty: l.total_qty,
      ha: l.ha,
    }))

    // Unique orchard mappings
    const orchardMap = new Map<string, string>()
    for (const l of mappedLines) {
      if (l.orchardId) orchardMap.set(l.orchard_source, l.orchardId)
    }
    const uniqueMappings = [...orchardMap.entries()].map(([source_name, orchard_id]) => ({
      source_name,
      orchard_id,
    }))

    try {
      const res = await fetch('/api/fertilizer/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: farmId,
          season,
          commodity_id: commodityId || null,
          program_type: programType,
          products,
          timings,
          lines: importLines,
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

  // Group lines by orchard for the review table
  const orchardGroups = new Map<string, { orchardId: string | null; legacyId: number | null; lines: DataLine[] }>()
  for (const line of lines) {
    const key = line.orchard_source
    if (!orchardGroups.has(key)) {
      orchardGroups.set(key, { orchardId: line.orchardId, legacyId: line.legacy_orchard_id, lines: [] })
    }
    orchardGroups.get(key)!.lines.push(line)
    orchardGroups.get(key)!.orchardId = line.orchardId
  }

  const uniqueOrchardSources = [...orchardGroups.keys()]
  const mappedCount = uniqueOrchardSources.filter(s => orchardGroups.get(s)!.orchardId).length
  const unmappedCount = uniqueOrchardSources.length - mappedCount
  const totalLines = lines.filter(l => l.orchardId).length

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <h3 style={s.title}>Import Fertilizer Program</h3>
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
                  {done ? '\u2713 ' : ''}{label}
                  {i < 2 && <span style={{ color: '#ddd', margin: '0 6px' }}>&rsaquo;</span>}
                </span>
              )
            })}
          </div>
          <button onClick={onClose} style={s.closeBtn}>&times;</button>
        </div>

        <div style={s.body}>
          {/* Step 1: Upload */}
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
                  Commodity
                  <select value={commodityId} onChange={e => setCommodityId(e.target.value)} style={s.select}>
                    <option value="">All / Mixed</option>
                    {commodities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label style={s.label}>
                  Program Type
                  <input value={programType} onChange={e => setProgramType(e.target.value)} style={s.input} placeholder="standard" />
                </label>
              </div>

              <div
                style={s.dropZone}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>&#128196;</div>
                <div style={{ fontWeight: 600, color: '#1a2a3a', marginBottom: 4 }}>
                  {fileName || 'Drop fertilizer program .xlsx file here'}
                </div>
                <div style={{ fontSize: 13, color: '#999' }}>
                  Expected: per_ha sheet with timing headers (row 8), products (row 9), orchard data (row 12+)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleInputChange}
                  style={{ display: 'none' }}
                />
              </div>
            </>
          )}

          {/* Parsing state */}
          {step === 'parsing' && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>
                <span style={{ display: 'inline-block', animation: 'fert-spin 1s linear infinite' }}>&#9203;</span>
              </div>
              <div style={{ color: '#1a2a3a', fontWeight: 600, marginBottom: 4 }}>{parseStatus}</div>
              <style>{`@keyframes fert-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* Step 2: Review & Map */}
          {step === 'review' && (
            <>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#6a7a70' }}>
                  <strong>{fileName}</strong> &mdash; {uniqueOrchardSources.length} orchards &middot; {timings.length} timings &middot; {products.length} products &middot; {lines.length} data lines
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#4caf72', fontWeight: 600 }}>&#9679; Mapped</span>
                  <span style={{ fontSize: 11, color: '#e85a4a', fontWeight: 600 }}>&#9679; Unmapped (skipped)</span>
                </div>
              </div>

              {/* Timing + Product summary */}
              <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ background: '#f5f3ee', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                  <strong>Timings:</strong> {timings.map(t => t.label).join(' \u2192 ')}
                </div>
                <div style={{ background: '#f5f3ee', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                  <strong>Products:</strong> {products.map(p => p.name).join(', ')}
                </div>
              </div>

              {/* Orchard mapping table */}
              <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 340px)', border: '1px solid #e8e4dc', borderRadius: 10 }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, position: 'sticky', left: 0, zIndex: 2, background: '#f5f3ee', minWidth: 140 }}>
                        Excel Name
                      </th>
                      <th style={{ ...s.th, minWidth: 60 }}>Legacy ID</th>
                      <th style={{ ...s.th, position: 'sticky', left: 140, zIndex: 2, background: '#f5f3ee', minWidth: 180 }}>
                        &rarr; System Orchard
                      </th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Products</th>
                      <th style={{ ...s.th, textAlign: 'right' }}>Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueOrchardSources.map(src => {
                      const group = orchardGroups.get(src)!
                      const uniqueProducts = new Set(group.lines.map(l => l.product_name))
                      return (
                        <tr key={src} style={{ background: group.orchardId ? '#fff' : '#fef8f6' }}>
                          <td style={{ ...s.td, position: 'sticky', left: 0, background: group.orchardId ? '#fff' : '#fef8f6', fontWeight: 500, fontSize: 12 }}>
                            {src}
                          </td>
                          <td style={{ ...s.td, fontSize: 12, color: '#999' }}>
                            {group.legacyId || '\u2014'}
                          </td>
                          <td style={{ ...s.td, position: 'sticky', left: 140, background: group.orchardId ? '#fff' : '#fef8f6' }}>
                            <select
                              value={group.orchardId || ''}
                              onChange={e => updateLineOrchard(src, e.target.value || null)}
                              style={{ ...s.cellSelect, borderColor: group.orchardId ? '#4caf72' : '#e85a4a' }}
                            >
                              <option value="">&mdash; Skip &mdash;</option>
                              {orchards.map(o => (
                                <option key={o.id} value={o.id}>
                                  {o.name}{o.variety ? ` (${o.variety})` : ''}{o.legacy_id ? ` [${o.legacy_id}]` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ ...s.td, textAlign: 'right', fontSize: 12 }}>{uniqueProducts.size}</td>
                          <td style={{ ...s.td, textAlign: 'right', fontSize: 12 }}>{group.lines.length}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>
                <span style={{ display: 'inline-block', animation: 'fert-spin 1s linear infinite' }}>&#9203;</span>
              </div>
              <div style={{ color: '#1a2a3a', fontWeight: 600 }}>Importing {totalLines} lines...</div>
              <style>{`@keyframes fert-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 36, marginBottom: 12, color: '#4caf72' }}>{'\u2713'}</div>
              <div style={{ color: '#1a2a3a', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Import Complete</div>
              <div style={{ fontSize: 14, color: '#6a7a70' }}>
                {result.imported} lines imported &middot; {result.skipped} skipped &middot; {result.products} products &middot; {result.timings} timings
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
              <button onClick={() => { setStep('upload'); setLines([]); setFileName('') }} style={s.cancelBtn}>&larr; Back</button>
              <button onClick={doImport} disabled={totalLines === 0} style={{
                ...s.importBtn, opacity: totalLines === 0 ? 0.5 : 1,
              }}>
                Import {totalLines} line{totalLines !== 1 ? 's' : ''} ({mappedCount} orchards)
              </button>
            </>
          )}
          {step === 'done' && (
            <>
              <button onClick={() => { setStep('upload'); setFileName(''); setLines([]); setResult(null) }} style={s.cancelBtn}>
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
    width: 900, maxWidth: '96vw', maxHeight: '92vh',
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

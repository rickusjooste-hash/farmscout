#!/usr/bin/env node
/**
 * Migrate historic QC picking data from QC_Picking.xlsx into Supabase.
 *
 * Usage:
 *   node scripts/migrate-qc-data.mjs [--dry-run] [--sheet Apples]
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Load .env.local ─────────────────────────────────────────────────────────
const envPath = resolve(ROOT, '.env.local')
const envText = readFileSync(envPath, 'utf-8')
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([\w]+)\s*=\s*(.+?)\s*$/)
  if (m) process.env[m[1]] = m[2]
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY_SHEET = (() => {
  const idx = process.argv.indexOf('--sheet')
  return idx >= 0 ? process.argv[idx + 1] : null
})()

// ── Organisation / farm ─────────────────────────────────────────────────────
// Hardcoded for the single org/farm. Adjust if needed.
const ORG_ID  = '93d1760e-a484-4379-95fb-6cad294e2191'
const FARM_ID = '10b61388-8abf-4ff3-86de-bacaac7c004d'

// ── Sheet → commodity code mapping ──────────────────────────────────────────
const SHEET_COMMODITY = {
  Apples:     'ap',
  Pears:      'pr',
  Lemons:     'ci',       // citrus commodity for lemons
  Mandarins:  'ci',       // citrus commodity for mandarins
  Stonefruit: 'sf',
}

// ── Size bin columns per sheet ──────────────────────────────────────────────
// These are the column headers that represent fruit size categories.
const SHEET_SIZE_BINS = {
  Apples:     ['Oversize', '70', '80', '90', '100', '110', '120', '135', '150', '165', '180', '198', '216', 'Small'],
  Pears:      ['Oversize', '38', '45', '48', '52', '60', '70', '80', '90', '96', '112', '120', 'Small'],
  Lemons:     ['56', '64', '75', '88', '100', '113', '138', '162', '189', '216', 'Small'],
  Mandarins:  ['1XXX', '1XX', '1X', '1', '2', '3', '4', '5', '6', 'Small'],
  Stonefruit: ['Oversize', '13', '15', '18', '20', '23', '25', '28', '30', 'Small'],
}

// ── Picking issue columns (these are 'picking_issue' category) ──────────────
const PICKING_ISSUE_COLS = {
  Apples:     ['Bruising', 'Stem', 'Injury', 'LeavesFruitbuds'],
  Pears:      ['Bruising', 'Stem', 'Injury', 'LeavesFruitBuds'],
  Lemons:     ['Bruising', 'Stem', 'Injury'],
  Mandarins:  ['Bruising', 'Stem', 'Injury'],
  Stonefruit: ['Bruising', 'Stem', 'Injury'],
}

// ── QC issue columns per sheet ──────────────────────────────────────────────
const QC_ISSUE_COLS = {
  Apples: [
    'SONBRAND', 'MISVORM', 'BARS', 'KALANDER', 'VRUGTEVLIEG', 'ANTESTIA',
    'BRYOBIA MYTE', 'KODLINGMOT', 'BOLWURM', 'SKAAF', 'HAEL', 'FUSI',
    'KOKI', 'BLASSPOOITJIE', 'VOELSKADE', 'WINDMERKE', 'BLOEDLUIS',
    'BITTERPIT', 'WITLUIS', 'RSM', 'RUSSET', 'KURKVLEK', 'ONBEKEND',
    'WATERKENR', 'DOPLUIS', 'PUFFER',
  ],
  Pears: [
    'SONBRAND', 'MISVORM', 'BARS', 'KALANDER', 'VRUGTEVLIEG', 'ANTESTIA',
    'BRYOBIA MYTE', 'KODLINGMOT', 'BOLWURM', 'SKAAF', 'HAEL', 'FUSI',
    'KOKI', 'BLASSPOOITJIE', 'VOELSKADE', 'WINDMERKE', 'BLOEDLUIS',
    'BITTERPIT', 'WITLUIS', 'RSM', 'RUSSET', 'KURKVLEK', 'ONBEKEND',
    'WATERKENR', 'DOPLUIS', 'PUFFER',
  ],
  Lemons: [
    'Sonbrand', 'Wind', 'Slak', 'Misvorm', 'Doring', 'Witluis', 'Knopmyt',
    'Valskodlingmot', 'Vrugtevlieg', 'Blaarmyner', 'Blaaspootjie',
    'Bladspringer', 'Bolwurm', 'Lemoenvlinder', 'Plantluis', 'Platmyt',
    'Rooi dopluis', 'RooiMyt', 'Sagte bruin dopluis', 'Silwermyt',
    'Australiese wolluis', 'Wasdopluis', 'Onbekende',
  ],
  Mandarins: [
    'Sonbrand', 'Wind', 'Slak', 'Misvorm', 'Doring', 'Witluis', 'Knopmyt',
    'Valskodlingmot', 'Vrugtevlieg', 'Blaarmyner', 'Blaaspootjie',
    'Bladspringer', 'Bolwurm', 'Lemoenvlinder', 'Plantluis', 'Platmyt',
    'Rooi dopluis', 'RooiMyt', 'Sagte bruin dopluis', 'Silwermyt',
    'Australiese wolluis', 'Wasdopluis', 'Onbekende',
  ],
  Stonefruit: [
    'Krake', 'Wind', 'Misvorm', 'Blaaspootjie', 'Bolwurm', 'Myte',
    'Dopluis', 'Kalander', 'OVM', 'Plantluis', 'V.K.M', 'Split',
    'Voel ', 'Krulblaar', 'Sag', 'Slak', 'Onbekende',
  ],
}

// ── Afrikaans → English pest name mapping ───────────────────────────────────
// Normalised to uppercase for matching
const PEST_NAME_MAP = {
  // Picking issues
  'BRUISING':        'Bruising',
  'STEM':            'Stem Puncture',
  'INJURY':          'Picking Injury',
  'LEAVESFRUITBUDS': 'Leaves/Fruitbuds',
  'LEAVESFRUITBUD':  'Leaves/Fruitbuds',
  // QC issues — Apples/Pears (uppercase in sheet)
  'SONBRAND':        'Sunburn',
  'MISVORM':         'Deformed',
  'BARS':            'Cracking',
  'KALANDER':        'Weevil',
  'VRUGTEVLIEG':     'Fruit Fly',
  'ANTESTIA':        'Antestia',
  'BRYOBIA MYTE':    'Bryobia Mite',
  'KODLINGMOT':      'Codling Moth',
  'BOLWURM':         'Bollworm',
  'SKAAF':           'Scuffing',
  'HAEL':            'Hail',
  'FUSI':            'Fusicoccum',
  'KOKI':            'Cochineal',
  'BLASSPOOITJIE':   'Thrips',
  'BLAASPOOITJIE':   'Thrips',
  'VOELSKADE':       'Bird Damage',
  'WINDMERKE':       'Wind Marks',
  'BLOEDLUIS':       'Blood Louse',
  'BITTERPIT':       'Bitter Pit',
  'WITLUIS':         'White Louse',
  'RSM':             'Red Spider Mite',
  'RUSSET':          'Russet',
  'KURKVLEK':        'Cork Spot',
  'ONBEKEND':        'Unknown',
  'ONBEKENDE':       'Unknown',
  'WATERKENR':       'Water Core',
  'DOPLUIS':         'Scale',
  'PUFFER':          'Puffer',
  // Citrus (Lemons/Mandarins — mixed case in sheet)
  'WIND':            'Wind Marks',
  'SLAK':            'Snail',
  'DORING':          'Thorn Damage',
  'KNOPMYT':         'Bud Mite',
  'VALSKODLINGMOT':  'False Codling Moth',
  'BLAARMYNER':      'Leaf Miner',
  'BLADSPRINGER':    'Psyllid',
  'LEMOENVLINDER':   'Lemon Moth',
  'PLANTLUIS':       'Aphid',
  'PLATMYT':         'Flat Mite',
  'ROOI DOPLUIS':    'Red Scale',
  'ROOIMYT':         'Red Mite',
  'SAGTE BRUIN DOPLUIS': 'Soft Brown Scale',
  'SILWERMYT':       'Silver Mite',
  'AUSTRALIESE WOLLUIS': 'Mealybug',
  'WASDOPLUIS':      'Wax Scale',
  // Stonefruit
  'KRAKE':           'Cracking',
  'MYTE':            'Mite',
  'OVM':             'Oriental Fruit Moth',
  'V.K.M':           'False Codling Moth',
  'SPLIT':           'Split',
  'VOEL':            'Bird Damage',
  'VOEL ':           'Bird Damage',
  'KRULBLAAR':       'Leaf Curl',
  'SAG':             'Soft',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert Excel serial date number to JS Date */
function excelDateToJS(serial) {
  // Excel's epoch is 1900-01-01, but has the Lotus 1-2-3 leap year bug
  const epoch = new Date(1899, 11, 30) // Dec 30, 1899
  return new Date(epoch.getTime() + serial * 86400000)
}

/** Combine Excel serial date + time fraction into ISO timestamptz */
function excelToTimestamp(dateSerial, timeFraction) {
  const d = excelDateToJS(dateSerial)
  if (timeFraction) {
    const totalMs = timeFraction * 86400000
    d.setTime(d.getTime() + totalMs)
  }
  return d.toISOString()
}

/** Parse employee name and number from ComboName like "TINASHE TOGARA (395)" */
function parseEmployee(comboName, number) {
  const empNr = String(number || '').trim()
  let name = String(comboName || '').trim()
  // Remove trailing "(NNN)" from name
  name = name.replace(/\s*\(\d+\)\s*$/, '').trim()
  if (!name && empNr) name = `Employee ${empNr}`
  return { name: name || 'Unknown', nr: empNr || '0' }
}

// ── Reference data caches ───────────────────────────────────────────────────
let orchardsByLegacy = {}   // legacy_id → { id, farm_id, commodity_id }
let commoditiesByCode = {}  // code → { id, code }
let pestsByName = {}        // normalised english name → { id }
let commodityPests = {}     // `${commodity_id}|${pest_id}` → { id, category }
let employeeCache = {}      // `${farm_id}|${employee_nr}` → { id }
let sizeBinCache = {}       // `${commodity_id}|${label}` → { id }

async function loadReferenceData() {
  console.log('Loading reference data...')

  // Orchards — load across ALL farms in the org (legacy IDs span both farms)
  const { data: orchards } = await supabase
    .from('orchards')
    .select('id, farm_id, commodity_id, legacy_id')
    .eq('organisation_id', ORG_ID)
    .not('legacy_id', 'is', null)
  for (const o of orchards || []) {
    // If multiple orchards share a legacy_id, prefer the one we haven't seen
    // (shouldn't happen, but be safe)
    if (!orchardsByLegacy[o.legacy_id]) orchardsByLegacy[o.legacy_id] = o
  }
  console.log(`  ${Object.keys(orchardsByLegacy).length} orchards with legacy_id`)

  // Commodities
  const { data: commodities } = await supabase.from('commodities').select('id, code, name')
  for (const c of commodities || []) {
    commoditiesByCode[c.code.toLowerCase()] = c
  }
  console.log(`  ${Object.keys(commoditiesByCode).length} commodities: ${Object.keys(commoditiesByCode).join(', ')}`)

  // Pests
  const { data: pests } = await supabase.from('pests').select('id, name')
  for (const p of pests || []) {
    pestsByName[p.name.toUpperCase()] = p
  }
  console.log(`  ${Object.keys(pestsByName).length} pests`)

  // Commodity pests
  const { data: cpList } = await supabase.from('commodity_pests').select('id, commodity_id, pest_id, category')
  for (const cp of cpList || []) {
    commodityPests[`${cp.commodity_id}|${cp.pest_id}`] = cp
  }
  console.log(`  ${Object.keys(commodityPests).length} commodity_pests`)

  // Existing employees — load across all farms in the org
  const { data: employees } = await supabase
    .from('qc_employees')
    .select('id, farm_id, employee_nr')
    .eq('organisation_id', ORG_ID)
  for (const e of employees || []) {
    employeeCache[`${e.farm_id}|${e.employee_nr}`] = e
  }
  console.log(`  ${Object.keys(employeeCache).length} existing employees`)

  // Existing size bins
  const { data: bins } = await supabase.from('size_bins').select('id, commodity_id, label')
  for (const b of bins || []) {
    sizeBinCache[`${b.commodity_id}|${b.label}`] = b
  }
  console.log(`  ${Object.keys(sizeBinCache).length} existing size bins`)
}

// ── Upsert helpers ──────────────────────────────────────────────────────────

async function getOrCreateEmployee(name, nr, team, farmId) {
  const key = `${farmId}|${nr}`
  if (employeeCache[key]) return employeeCache[key].id

  const row = {
    organisation_id: ORG_ID,
    farm_id: farmId,
    employee_nr: nr,
    full_name: name,
    team: team || null,
  }

  if (DRY_RUN) {
    const fakeId = `emp-${nr}`
    employeeCache[key] = { id: fakeId }
    return fakeId
  }

  const { data, error } = await supabase
    .from('qc_employees')
    .upsert(row, { onConflict: 'farm_id,employee_nr' })
    .select('id')
    .single()

  if (error) {
    console.error(`  Failed to upsert employee ${nr} ${name}:`, error.message)
    return null
  }
  employeeCache[key] = data
  return data.id
}

async function getOrCreatePest(englishName) {
  const key = englishName.toUpperCase()
  if (pestsByName[key]) return pestsByName[key].id

  if (DRY_RUN) {
    const fakeId = `pest-${key}`
    pestsByName[key] = { id: fakeId }
    return fakeId
  }

  const { data, error } = await supabase
    .from('pests')
    .insert({ name: englishName })
    .select('id')
    .single()

  if (error) {
    console.error(`  Failed to create pest "${englishName}":`, error.message)
    return null
  }
  pestsByName[key] = data
  console.log(`  Created pest: ${englishName} → ${data.id}`)
  return data.id
}

async function ensureCommodityPest(commodityId, pestId, category, displayName) {
  const key = `${commodityId}|${pestId}`
  if (commodityPests[key]) return

  if (DRY_RUN) {
    commodityPests[key] = { id: 'fake', category }
    return
  }

  const { data: existing } = await supabase
    .from('commodity_pests')
    .select('id')
    .eq('commodity_id', commodityId)
    .eq('pest_id', pestId)
    .maybeSingle()

  if (existing) {
    commodityPests[key] = existing
    return
  }

  const { data, error } = await supabase
    .from('commodity_pests')
    .insert({
      commodity_id: commodityId,
      pest_id: pestId,
      category,
      display_name: displayName,
      display_order: 99,
      is_active: true,
    })
    .select('id, category')
    .single()

  if (error) {
    console.error(`  Failed to create commodity_pest for ${displayName}:`, error.message)
    return
  }
  commodityPests[key] = data
  console.log(`  Created commodity_pest: ${displayName} (${category})`)
}

async function getOrCreateSizeBin(commodityId, label) {
  const key = `${commodityId}|${label}`
  if (sizeBinCache[key]) return sizeBinCache[key].id

  if (DRY_RUN) {
    const fakeId = `bin-${label}`
    sizeBinCache[key] = { id: fakeId }
    return fakeId
  }

  // Assign rough weight ranges based on label
  const numLabel = parseInt(label)
  let weightMin = 0, weightMax = 9999
  if (!isNaN(numLabel)) {
    weightMin = Math.max(0, numLabel - 5)
    weightMax = numLabel + 5
  } else if (label === 'Oversize') {
    weightMin = 300; weightMax = 999
  } else if (label === 'Small') {
    weightMin = 0; weightMax = 50
  }

  const { data, error } = await supabase
    .from('size_bins')
    .insert({
      commodity_id: commodityId,
      label,
      weight_min_g: weightMin,
      weight_max_g: weightMax,
      display_order: label === 'Oversize' ? 0 : label === 'Small' ? 999 : numLabel || 500,
    })
    .select('id')
    .single()

  if (error) {
    console.error(`  Failed to create size bin "${label}":`, error.message)
    return null
  }
  sizeBinCache[key] = data
  console.log(`  Created size bin: ${label} → ${data.id}`)
  return data.id
}

// ── Batch insert helper ─────────────────────────────────────────────────────
async function batchInsert(table, rows, batchSize = 500) {
  if (DRY_RUN || rows.length === 0) return
  let inserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      console.error(`  Batch insert ${table} failed at offset ${i}:`, error.message)
      // Try one-by-one for this batch to find the bad row
      for (const row of batch) {
        const { error: e2 } = await supabase.from(table).insert(row)
        if (e2) console.error(`    Row failed:`, e2.message, JSON.stringify(row).slice(0, 200))
        else inserted++
      }
    } else {
      inserted += batch.length
    }
  }
  return inserted
}

// ── Process one sheet ───────────────────────────────────────────────────────

async function processSheet(wb, sheetName) {
  const commodityCode = SHEET_COMMODITY[sheetName]
  if (!commodityCode) { console.log(`Skipping unknown sheet: ${sheetName}`); return }

  const commodity = commoditiesByCode[commodityCode]
  if (!commodity) {
    console.error(`Commodity "${commodityCode}" not found in DB — skipping ${sheetName}`)
    return
  }

  console.log(`\n=== Processing ${sheetName} (commodity: ${commodity.code} / ${commodity.id}) ===`)

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  console.log(`  ${rows.length} rows`)

  const sizeBinCols = SHEET_SIZE_BINS[sheetName]
  const pickingCols = PICKING_ISSUE_COLS[sheetName]
  const qcIssueCols = QC_ISSUE_COLS[sheetName]

  // Pre-create pests and commodity_pests for all issue columns
  for (const col of pickingCols) {
    const en = PEST_NAME_MAP[col.toUpperCase()] || col
    const pestId = await getOrCreatePest(en)
    if (pestId) await ensureCommodityPest(commodity.id, pestId, 'picking_issue', en)
  }
  for (const col of qcIssueCols) {
    const en = PEST_NAME_MAP[col.toUpperCase().trim()] || col.trim()
    const pestId = await getOrCreatePest(en)
    if (pestId) await ensureCommodityPest(commodity.id, pestId, 'qc_issue', en)
  }

  // Pre-create size bins
  for (const label of sizeBinCols) {
    await getOrCreateSizeBin(commodity.id, label)
  }

  // Collect bulk rows
  let sessionRows = []
  let fruitRows = []
  let issueRows = []
  let skippedOrchard = 0
  let skippedEmployee = 0
  let processed = 0

  for (const row of rows) {
    const orchardLegacy = row['OrchardID']
    const orchard = orchardsByLegacy[orchardLegacy]
    if (!orchard) {
      skippedOrchard++
      continue
    }

    const { name, nr } = parseEmployee(row['ComboName'], row['Number'])
    const employeeId = await getOrCreateEmployee(name, nr, row['Team'], orchard.farm_id)
    if (!employeeId) { skippedEmployee++; continue }

    // Timestamp
    const dateSerial = row['Date']
    const timeFraction = row['Time']
    let collectedAt
    if (typeof dateSerial === 'number') {
      collectedAt = excelToTimestamp(dateSerial, timeFraction)
    } else if (typeof dateSerial === 'string') {
      // Some rows may have string dates
      collectedAt = new Date(dateSerial).toISOString()
    } else {
      collectedAt = new Date().toISOString()
    }

    const totalFruit = Number(row['TotalFruit']) || 0

    // Use the original Excel ID as the session ID seed for idempotency
    const excelId = row['ID']
    // Generate a deterministic UUID from the Excel ID
    const sessionId = crypto.randomUUID()

    const session = {
      id: sessionId,
      organisation_id: ORG_ID,
      farm_id: orchard.farm_id,
      orchard_id: orchard.id,
      employee_id: employeeId,
      collected_at: collectedAt,
      sampled_at: collectedAt,
      status: 'sampled',
      notes: `Migrated from QC_Picking.xlsx (${sheetName}), ID: ${excelId}, Year: ${row['ProductionYear'] || '?'}`,
    }
    sessionRows.push(session)

    // Synthetic fruit rows from size bin columns
    let fruitSeq = 0
    for (const binLabel of sizeBinCols) {
      const count = Number(row[binLabel]) || 0
      if (count <= 0) continue
      const binKey = `${commodity.id}|${binLabel}`
      const binId = sizeBinCache[binKey]?.id || null

      // Estimate weight from bin label
      const numLabel = parseInt(binLabel)
      const weight = !isNaN(numLabel) ? numLabel : (binLabel === 'Oversize' ? 350 : binLabel === 'Small' ? 30 : 100)

      for (let j = 0; j < count; j++) {
        fruitSeq++
        fruitRows.push({
          session_id: sessionId,
          organisation_id: ORG_ID,
          seq: fruitSeq,
          weight_g: weight,
          size_bin_id: binId,
        })
      }
    }

    // Issue rows (picking + QC)
    const allIssueCols = [
      ...pickingCols.map(c => ({ col: c, category: 'picking_issue' })),
      ...qcIssueCols.map(c => ({ col: c, category: 'qc_issue' })),
    ]
    for (const { col, category } of allIssueCols) {
      const raw = Number(row[col]) || 0
      // Some cells contain percentages (0.05) instead of counts — round to int
      const count = Math.round(raw)
      if (count <= 0) continue

      const en = PEST_NAME_MAP[col.toUpperCase().trim()] || col.trim()
      const pestId = pestsByName[en.toUpperCase()]?.id
      if (!pestId) continue

      issueRows.push({
        session_id: sessionId,
        pest_id: pestId,
        organisation_id: ORG_ID,
        count,
      })
    }

    processed++
    if (processed % 5000 === 0) {
      console.log(`  ${processed}/${rows.length} rows processed...`)
    }
  }

  console.log(`  Processed: ${processed}, Skipped (orchard): ${skippedOrchard}, Skipped (employee): ${skippedEmployee}`)
  console.log(`  Sessions: ${sessionRows.length}, Fruit: ${fruitRows.length}, Issues: ${issueRows.length}`)

  if (DRY_RUN) {
    console.log('  [DRY RUN] — no data inserted')
    return
  }

  // Insert in order: sessions first, then fruit + issues
  console.log('  Inserting sessions...')
  await batchInsert('qc_bag_sessions', sessionRows, 500)

  console.log('  Inserting fruit...')
  await batchInsert('qc_fruit', fruitRows, 1000)

  console.log('  Inserting issues...')
  await batchInsert('qc_bag_issues', issueRows, 1000)

  console.log(`  Done with ${sheetName}`)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('QC Data Migration')
  console.log(`  Supabase: ${SUPABASE_URL}`)
  console.log(`  Dry run: ${DRY_RUN}`)
  if (ONLY_SHEET) console.log(`  Only sheet: ${ONLY_SHEET}`)

  await loadReferenceData()

  const xlsxPath = resolve(ROOT, 'data', 'QC_Picking.xlsx')
  console.log(`\nReading ${xlsxPath}...`)
  const wb = XLSX.readFile(xlsxPath)
  console.log(`  Sheets: ${wb.SheetNames.join(', ')}`)

  const sheetsToProcess = ONLY_SHEET
    ? [ONLY_SHEET]
    : Object.keys(SHEET_COMMODITY)

  for (const sheet of sheetsToProcess) {
    if (!wb.Sheets[sheet]) {
      console.error(`Sheet "${sheet}" not found in workbook`)
      continue
    }
    await processSheet(wb, sheet)
  }

  console.log('\nMigration complete!')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

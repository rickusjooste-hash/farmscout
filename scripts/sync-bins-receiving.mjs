#!/usr/bin/env node
/**
 * Sync BinsRecieving.xlsx into Supabase production tables.
 *
 * Usage:
 *   node scripts/sync-bins-receiving.mjs [--dry-run] [--sheet BinsRec|Bruising|Packing] [--watch] [--file <path>]
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync, watchFile } from 'fs'
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

// ── CLI flags ───────────────────────────────────────────────────────────────
const DRY_RUN    = process.argv.includes('--dry-run')
const WATCH_MODE = process.argv.includes('--watch')
const ONLY_SHEET = (() => {
  const idx = process.argv.indexOf('--sheet')
  return idx >= 0 ? process.argv[idx + 1] : null
})()
const FILE_PATH = (() => {
  const idx = process.argv.indexOf('--file')
  return idx >= 0 ? process.argv[idx + 1]
    : 'C:\\Users\\rickus.MOUTONSVALLEY\\OneDrive - Moutons Valley Trust\\Attachments\\BinsRecieving.xlsx'
})()

const ORG_ID = '93d1760e-a484-4379-95fb-6cad294e2191'

// ── Reference data caches ───────────────────────────────────────────────────
let orchardsByLegacy = {} // legacy_id → { id, farm_id }
let farmsByCode = {}      // code → farm_id

async function loadReferenceData() {
  console.log('Loading reference data...')

  const { data: orchards } = await supabase
    .from('orchards')
    .select('id, farm_id, legacy_id')
    .eq('organisation_id', ORG_ID)
    .not('legacy_id', 'is', null)
  for (const o of orchards || []) {
    if (!orchardsByLegacy[o.legacy_id]) orchardsByLegacy[o.legacy_id] = o
  }
  console.log(`  ${Object.keys(orchardsByLegacy).length} orchards with legacy_id`)

  const { data: farms } = await supabase
    .from('farms')
    .select('id, code')
    .eq('organisation_id', ORG_ID)
  for (const f of farms || []) {
    farmsByCode[f.code] = f.id
  }
  console.log(`  ${Object.keys(farmsByCode).length} farms: ${Object.keys(farmsByCode).join(', ')}`)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function excelDateToJS(serial) {
  const epoch = new Date(1899, 11, 30)
  return new Date(epoch.getTime() + serial * 86400000)
}

function parseDate(serial) {
  if (typeof serial === 'number') {
    const d = excelDateToJS(serial)
    return d.toISOString().split('T')[0]
  }
  if (typeof serial === 'string') {
    const d = new Date(serial)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }
  return null
}

function excelTimeToString(timeFraction) {
  if (!timeFraction || typeof timeFraction !== 'number') return null
  const totalMinutes = Math.round(timeFraction * 24 * 60)
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const secs = Math.round((timeFraction * 86400) % 60)
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function toSeason(prodYear) {
  const s = String(prodYear)
  if (s.length === 8) {
    return `${s.slice(0, 4)}/${s.slice(6, 8)}`
  }
  return s
}

function deriveSeason(dateStr) {
  const d = new Date(dateStr)
  const yr = d.getFullYear()
  const mo = d.getMonth() + 1
  const startYr = mo >= 8 ? yr : yr - 1
  const endYr = startYr + 1
  return {
    production_year: `${startYr}${endYr}`,
    season: `${startYr}/${String(endYr).slice(-2)}`,
  }
}

function getISOWeek(dateStr) {
  const d = new Date(dateStr)
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function parseProductionYear(rawValue, fallbackDate) {
  const s = String(rawValue || '')
  if (s.length === 8) {
    return { production_year: s, season: toSeason(s) }
  }
  return deriveSeason(fallbackDate)
}

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

// ── Batch upsert ────────────────────────────────────────────────────────────

async function batchUpsert(table, rows, conflictColumns, batchSize = 500) {
  if (DRY_RUN || rows.length === 0) return 0
  let upserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictColumns })
    if (error) {
      console.error(`  Batch upsert ${table} failed at offset ${i}:`, error.message)
      // Fall back to one-by-one for this batch
      for (const row of batch) {
        const { error: e2 } = await supabase.from(table).upsert(row, { onConflict: conflictColumns })
        if (e2) console.error(`    Row failed:`, e2.message, JSON.stringify(row).slice(0, 200))
        else upserted++
      }
    } else {
      upserted += batch.length
    }
    if ((i + batchSize) % 2000 === 0) console.log(`  ... ${i + batch.length}/${rows.length}`)
  }
  return upserted
}

// ── Recent date cutoff ──────────────────────────────────────────────────────

function getRecentCutoff(days = 2) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// ── Process BinsRec ─────────────────────────────────────────────────────────

async function processBinsRec(wb, recentOnly = false) {
  const ws = wb.Sheets['BinsRec']
  if (!ws) { console.log('  BinsRec sheet not found'); return }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  const cutoff = recentOnly ? getRecentCutoff() : null
  console.log(`\n  BinsRec: ${rows.length} rows${cutoff ? ` (filtering >= ${cutoff})` : ''}`)

  const records = []
  let unresolvedFarm = 0
  let unresolvedOrchard = 0
  let skippedOld = 0

  for (const row of rows) {
    const xlsxId = String(row.ID || '').trim()
    if (!xlsxId) continue

    const orchardLegacy = row.OrchardID
    const orchard = orchardsByLegacy[orchardLegacy]
    const farmCode = row.Farm
    const farmId = orchard?.farm_id || farmsByCode[farmCode]

    if (!farmId) {
      unresolvedFarm++
      continue
    }

    const receivedDate = parseDate(row.Date)
    if (!receivedDate) continue

    if (cutoff && receivedDate < cutoff) { skippedOld++; continue }

    const { production_year, season } = parseProductionYear(row.ProductionYear, receivedDate)

    if (!orchard) unresolvedOrchard++

    records.push({
      organisation_id: ORG_ID,
      farm_id: farmId,
      orchard_id: orchard?.id || null,
      xlsx_id: xlsxId,
      orchard_legacy_id: orchardLegacy,
      orchard_name: String(row.Orchard || ''),
      variety: row.Variety || null,
      team: row.Team || null,
      team_name: row.TeamName || null,
      bins: Number(row.Bins) || 0,
      juice: Number(row.Juice) || 0,
      total: Number(row.Total) || 0,
      production_year,
      season,
      week_num: row.Weeknum != null ? Number(row.Weeknum) : null,
      week_day: row.WeekDay || null,
      farm_code: farmCode || null,
      received_date: receivedDate,
      received_time: excelTimeToString(row.Time),
    })
  }

  console.log(`  Prepared ${records.length} records`)
  if (skippedOld) console.log(`  ${skippedOld} older rows skipped`)
  if (unresolvedFarm) console.log(`  ${unresolvedFarm} rows skipped (unresolved farm)`)
  if (unresolvedOrchard) console.log(`  ${unresolvedOrchard} records with NULL orchard_id`)

  if (DRY_RUN) { console.log('  [DRY RUN] — no data inserted'); return }

  const count = await batchUpsert('production_bins', records, 'organisation_id,xlsx_id')
  console.log(`  Upserted: ${count}`)
}

// ── Process Bruising ────────────────────────────────────────────────────────

async function processBruising(wb, recentOnly = false) {
  const ws = wb.Sheets['Bruising']
  if (!ws) { console.log('  Bruising sheet not found'); return }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  const cutoff = recentOnly ? getRecentCutoff() : null
  console.log(`\n  Bruising: ${rows.length} rows${cutoff ? ` (filtering >= ${cutoff})` : ''}`)

  const records = []
  let unresolvedFarm = 0
  let unresolvedOrchard = 0
  let skippedOld = 0

  for (const row of rows) {
    const xlsxId = String(row.ID || '').trim()
    if (!xlsxId) continue

    const orchardLegacy = row.OrchardID
    const orchard = orchardsByLegacy[orchardLegacy]
    const farmId = orchard?.farm_id

    if (!farmId) {
      unresolvedFarm++
      continue
    }

    const receivedDate = parseDate(row.Date)
    if (!receivedDate) continue

    if (cutoff && receivedDate < cutoff) { skippedOld++; continue }

    const { production_year, season } = parseProductionYear(row.ProductionYear, receivedDate)

    if (!orchard) unresolvedOrchard++

    // Percentages in xlsx are decimal fractions (0.03 = 3%) — convert to percentage values
    const bruisingPct = row['%Bruising'] != null ? Number((Number(row['%Bruising']) * 100).toFixed(2)) : null
    const stemPct     = row['%Stem']     != null ? Number((Number(row['%Stem'])     * 100).toFixed(2)) : null
    const injuryPct   = row['%Injury']   != null ? Number((Number(row['%Injury'])   * 100).toFixed(2)) : null

    records.push({
      organisation_id: ORG_ID,
      farm_id: farmId,
      orchard_id: orchard?.id || null,
      xlsx_id: xlsxId,
      orchard_legacy_id: orchardLegacy,
      orchard_name: String(row.Orchard || ''),
      variety: row.Variety || null,
      team: row.Team || null,
      team_name: row.TeamName || null,
      bruising_count: Number(row.Bruising) || 0,
      stem_count: Number(row.Stem) || 0,
      injury_count: Number(row.Injury) || 0,
      sample_size: Number(row.SampleSize) || 0,
      bruising_pct: bruisingPct,
      stem_pct: stemPct,
      injury_pct: injuryPct,
      sample_nr: row.SampleNr != null ? Number(row.SampleNr) : null,
      bin_weight_kg: row.BinWeight != null ? Number(row.BinWeight) : null,
      fruit_guard: row.FruitGuard != null ? String(row.FruitGuard) : null,
      production_year,
      season,
      week_num: getISOWeek(receivedDate),
      received_date: receivedDate,
      received_time: excelTimeToString(row.Time),
      farm_code: null,
    })
  }

  console.log(`  Prepared ${records.length} records`)
  if (skippedOld) console.log(`  ${skippedOld} older rows skipped`)
  if (unresolvedFarm) console.log(`  ${unresolvedFarm} rows skipped (unresolved farm)`)
  if (unresolvedOrchard) console.log(`  ${unresolvedOrchard} records with NULL orchard_id`)

  if (DRY_RUN) { console.log('  [DRY RUN] — no data inserted'); return }

  const count = await batchUpsert('production_bruising', records, 'organisation_id,xlsx_id')
  console.log(`  Upserted: ${count}`)
}

// ── Process Packing ─────────────────────────────────────────────────────────

async function processPacking(wb, recentOnly = false) {
  const ws = wb.Sheets['Packing']
  if (!ws) { console.log('  Packing sheet not found'); return }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  const cutoff = recentOnly ? getRecentCutoff() : null
  console.log(`\n  Packing: ${rows.length} rows${cutoff ? ` (filtering >= ${cutoff})` : ''}`)

  const records = []
  let unresolvedFarm = 0
  let skippedOld = 0

  for (const row of rows) {
    // Generate xlsx_nr: use Nr if available, else create deterministic key
    let xlsxNr = row.Nr ? String(row.Nr).trim() : null
    if (!xlsxNr) {
      xlsxNr = `gen-${row.OrchardId || 0}-${row.Date || 0}-${(row.Variety || '').replace(/\s/g, '')}`
    }

    const orchardLegacy = row.OrchardId
    const orchard = orchardsByLegacy[orchardLegacy]
    const farmId = orchard?.farm_id

    if (!farmId) {
      unresolvedFarm++
      continue
    }

    const packedDate = parseDate(row.Date)
    if (!packedDate) continue

    if (cutoff && packedDate < cutoff) { skippedOld++; continue }

    const { production_year, season } = parseProductionYear(row.ProductionYear, packedDate)

    records.push({
      organisation_id: ORG_ID,
      farm_id: farmId,
      orchard_id: orchard?.id || null,
      xlsx_nr: xlsxNr,
      orchard_legacy_id: orchardLegacy,
      orchard_name: String(row.Orchard || ''),
      variety: row.Variety || null,
      bins_packed: Number(row.BinsPacked) || 0,
      juice_packshed: Number(row.JuicePackshed) || 0,
      remaining_bins: Number(row.RemainingBins) || 0,
      production_year,
      season,
      packed_date: packedDate,
    })
  }

  console.log(`  Prepared ${records.length} records`)
  if (skippedOld) console.log(`  ${skippedOld} older rows skipped`)
  if (unresolvedFarm) console.log(`  ${unresolvedFarm} rows skipped (unresolved farm)`)

  if (DRY_RUN) { console.log('  [DRY RUN] — no data inserted'); return }

  const count = await batchUpsert('production_packing', records, 'organisation_id,xlsx_nr')
  console.log(`  Upserted: ${count}`)
}

// ── Run sync ────────────────────────────────────────────────────────────────

async function runSync(recentOnly = false) {
  console.log(`\n[${ts()}] Starting sync${recentOnly ? ' (recent rows only)' : ' (full)'}...`)

  try {
    const wb = XLSX.readFile(FILE_PATH)
    console.log(`  Sheets: ${wb.SheetNames.join(', ')}`)

    const sheets = ONLY_SHEET ? [ONLY_SHEET] : ['BinsRec', 'Bruising', 'Packing']

    for (const sheet of sheets) {
      if (sheet === 'BinsRec') await processBinsRec(wb, recentOnly)
      else if (sheet === 'Bruising') await processBruising(wb, recentOnly)
      else if (sheet === 'Packing') await processPacking(wb, recentOnly)
      else console.log(`  Unknown sheet: ${sheet}`)
    }

    console.log(`[${ts()}] Sync complete!`)
  } catch (err) {
    console.error(`[${ts()}] Sync error:`, err.message)
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('BinsRecieving.xlsx → Supabase Sync')
  console.log(`  File: ${FILE_PATH}`)
  console.log(`  Dry run: ${DRY_RUN}`)
  if (ONLY_SHEET) console.log(`  Only sheet: ${ONLY_SHEET}`)
  if (WATCH_MODE) console.log(`  Watch mode: enabled`)

  await loadReferenceData()

  // Initial sync — full on manual run, recent-only if starting in watch mode
  await runSync(WATCH_MODE)

  // Watch mode — monitor file for changes, sync only recent rows
  if (WATCH_MODE) {
    console.log(`\nWatching ${FILE_PATH} for changes (polling every 5s, 10s debounce, last 2 days only)...`)
    let debounceTimer = null

    watchFile(FILE_PATH, { interval: 5000 }, () => {
      console.log(`[${ts()}] File change detected, waiting for debounce...`)
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        debounceTimer = null
        try {
          // Reload reference data in case orchards were added
          orchardsByLegacy = {}
          farmsByCode = {}
          await loadReferenceData()
          await runSync(true) // recent rows only
        } catch (err) {
          console.error(`[${ts()}] Watch sync error:`, err.message)
        }
      }, 10000)
    })
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

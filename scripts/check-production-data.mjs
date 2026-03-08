#!/usr/bin/env node
/**
 * Compare xlsx totals vs DB totals per orchard for the current season.
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const envText = readFileSync(resolve(ROOT, '.env.local'), 'utf-8')
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([\w]+)\s*=\s*(.+?)\s*$/)
  if (m) process.env[m[1]] = m[2]
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SEASON = '2025/26'
const ORG_ID = '93d1760e-a484-4379-95fb-6cad294e2191'

// ── xlsx totals ─────────────────────────────────────────────────────────────
const wb = XLSX.readFile('C:\\Users\\rickus.MOUTONSVALLEY\\OneDrive - Moutons Valley Trust\\Attachments\\BinsRecieving.xlsx')
const xlsxRows = XLSX.utils.sheet_to_json(wb.Sheets['BinsRec'], { defval: null })

const xlsxByOrchard = {}
xlsxRows.filter(r => r.ProductionYear === 20252026).forEach(r => {
  const key = String(r.OrchardID)
  if (!xlsxByOrchard[key]) xlsxByOrchard[key] = { name: String(r.Orchard), bins: 0, juice: 0, total: 0, rows: 0 }
  xlsxByOrchard[key].bins += Number(r.Bins) || 0
  xlsxByOrchard[key].juice += Number(r.Juice) || 0
  xlsxByOrchard[key].total += Number(r.Total) || 0
  xlsxByOrchard[key].rows++
})

// ── DB totals ───────────────────────────────────────────────────────────────
const { data: dbRows } = await supabase
  .from('production_bins')
  .select('orchard_id, orchard_name, orchard_legacy_id, bins, juice, total')
  .eq('season', SEASON)
  .eq('organisation_id', ORG_ID)
  .limit(10000)

const dbByLegacy = {}
for (const r of dbRows || []) {
  const key = String(r.orchard_legacy_id)
  if (!dbByLegacy[key]) dbByLegacy[key] = { name: r.orchard_name, orchardId: r.orchard_id, bins: 0, juice: 0, total: 0, rows: 0 }
  dbByLegacy[key].bins += Number(r.bins) || 0
  dbByLegacy[key].juice += Number(r.juice) || 0
  dbByLegacy[key].total += Number(r.total) || 0
  dbByLegacy[key].rows++
}

// ── Orchard lookup ──────────────────────────────────────────────────────────
const { data: orchards } = await supabase
  .from('orchards')
  .select('id, legacy_id, name, ha')
  .eq('organisation_id', ORG_ID)
  .not('legacy_id', 'is', null)

const orchardByLegacy = {}
for (const o of orchards || []) {
  orchardByLegacy[String(o.legacy_id)] = o
}

// ── Compare ─────────────────────────────────────────────────────────────────
console.log(`\nSeason: ${SEASON}`)
console.log(`xlsx rows (this season): ${xlsxRows.filter(r => r.ProductionYear === 20252026).length}`)
console.log(`DB rows (this season): ${(dbRows || []).length}\n`)

console.log('LegacyID  Orchard              xlsx_total  db_total  MATCH  orchard_id  DB_name')
console.log('--------  -------------------  ----------  --------  -----  ----------  -------')

const allKeys = new Set([...Object.keys(xlsxByOrchard), ...Object.keys(dbByLegacy)])
const sorted = [...allKeys].sort((a, b) => {
  const at = xlsxByOrchard[a]?.total || 0
  const bt = xlsxByOrchard[b]?.total || 0
  return bt - at
})

let mismatches = 0
for (const key of sorted) {
  const x = xlsxByOrchard[key]
  const d = dbByLegacy[key]
  const o = orchardByLegacy[key]
  const match = x && d && Math.abs(x.total - d.total) < 0.01 ? 'OK' : 'DIFF'
  if (match === 'DIFF') mismatches++

  const xlsxTotal = x ? x.total.toString() : '-'
  const dbTotal = d ? d.total.toString() : '-'
  const mapped = d?.orchardId ? 'YES' : (d ? 'NULL' : '-')
  const dbName = o?.name || '-'

  console.log(
    key.padStart(8),
    (x?.name || d?.name || '?').padEnd(21),
    xlsxTotal.padStart(10),
    dbTotal.padStart(8),
    match.padStart(5),
    mapped.padStart(10),
    dbName
  )
}

console.log(`\nTotal orchards: ${allKeys.size}, Mismatches: ${mismatches}`)

// Show NULL orchard_id entries
const nullEntries = Object.entries(dbByLegacy).filter(([, v]) => !v.orchardId)
if (nullEntries.length) {
  console.log(`\n--- ${nullEntries.length} orchards with NULL orchard_id ---`)
  for (const [key, v] of nullEntries.sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  legacy_id=${key}  ${v.name.padEnd(20)}  total=${v.total}  rows=${v.rows}`)
  }
}

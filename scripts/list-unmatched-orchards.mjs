#!/usr/bin/env node
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

const ORG_ID = '93d1760e-a484-4379-95fb-6cad294e2191'

// Load orchards from DB
const { data: orchards } = await supabase
  .from('orchards')
  .select('id, legacy_id, name, variety, farm_id, ha')
  .eq('organisation_id', ORG_ID)

const byLegacy = {}
for (const o of orchards || []) {
  if (o.legacy_id != null) byLegacy[o.legacy_id] = o
}

// Load xlsx current season
const wb = XLSX.readFile('C:\\Users\\rickus.MOUTONSVALLEY\\OneDrive - Moutons Valley Trust\\Attachments\\BinsRecieving.xlsx')
const rows = XLSX.utils.sheet_to_json(wb.Sheets['BinsRec'], { defval: null })

// Find unique OrchardID + name + variety combos for current season
const seen = {}
rows.filter(r => r.ProductionYear === 20252026).forEach(r => {
  const key = r.OrchardID
  if (!seen[key]) seen[key] = { name: r.Orchard, varieties: new Set(), total: 0, farm: r.Farm }
  seen[key].varieties.add(r.Variety)
  seen[key].total += Number(r.Total) || 0
})

// Split into matched and unmatched
const unmatched = []
const matched = []
for (const [legacyId, info] of Object.entries(seen)) {
  const db = byLegacy[legacyId]
  const varieties = [...info.varieties].join(', ')
  if (db) {
    matched.push({ legacyId, xlsxName: info.name, dbName: db.name, variety: varieties, ha: db.ha, total: info.total, farm: info.farm })
  } else {
    unmatched.push({ legacyId, name: info.name, variety: varieties, total: info.total, farm: info.farm })
  }
}

console.log(`\n=== UNMATCHED (no legacy_id in DB) — ${unmatched.length} orchards ===\n`)
console.log('LegacyID  Farm  Orchard              Variety              Total Bins')
console.log('--------  ----  -------------------  -------------------  ----------')
unmatched.sort((a, b) => b.total - a.total).forEach(u => {
  console.log(
    String(u.legacyId).padStart(8),
    (u.farm || '?').padEnd(4),
    String(u.name).padEnd(21),
    u.variety.padEnd(21),
    String(u.total).padStart(10)
  )
})

console.log(`\n=== MATCHED — ${matched.length} orchards ===\n`)
console.log('LegacyID  Farm  xlsx_name            DB_name              Ha      Total')
console.log('--------  ----  -------------------  -------------------  ------  -----')
matched.sort((a, b) => b.total - a.total).forEach(m => {
  console.log(
    String(m.legacyId).padStart(8),
    (m.farm || '?').padEnd(4),
    String(m.xlsxName).padEnd(21),
    m.dbName.padEnd(21),
    m.ha != null ? String(m.ha).padStart(6) : '     -',
    String(m.total).padStart(6)
  )
})

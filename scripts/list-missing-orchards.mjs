import XLSX from 'xlsx'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const dbIds = new Set([88,89,92,93,95,97,102,106,109,114,115,119,122,129,130,131,132,133,134,137,140,141,142,144,145,146,148,161,163,166,169,172,433,434,435,436,443])

const wb = XLSX.readFile(resolve(ROOT, 'data', 'QC_Picking.xlsx'))
const missing = new Map()

for (const sn of ['Apples','Pears','Lemons','Mandarins','Stonefruit']) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null })
  for (const r of rows) {
    if (dbIds.has(r.OrchardID)) continue
    const key = r.OrchardID
    if (!missing.has(key)) {
      missing.set(key, { id: key, name: r.Orchard || '', variety: r.Variety || '', commodities: new Set(), rows: 0 })
    }
    const m = missing.get(key)
    m.commodities.add(sn)
    m.rows++
  }
}

const sorted = [...missing.values()].sort((a, b) => a.id - b.id)

console.log('OrchardID | Orchard Name                  | Variety | Sheets             | Rows')
console.log('----------+-------------------------------+---------+--------------------+------')
for (const o of sorted) {
  const id = String(o.id).padStart(9)
  const name = String(o.name || '?').padEnd(30).slice(0, 30)
  const variety = String(o.variety || '?').padEnd(7).slice(0, 7)
  const sheets = [...o.commodities].join(',').padEnd(18).slice(0, 18)
  console.log(`${id} | ${name} | ${variety} | ${sheets} | ${o.rows}`)
}
console.log('')
console.log(`Total missing orchards: ${sorted.length}`)
console.log(`Total missing rows: ${sorted.reduce((s, o) => s + o.rows, 0)}`)

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
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

// Query ALL orchards with legacy_id (no farm_id filter)
const { data, error } = await supabase
  .from('orchards')
  .select('id, farm_id, legacy_id, name, variety')
  .not('legacy_id', 'is', null)
  .order('legacy_id')

if (error) { console.error(error); process.exit(1) }

console.log(`Total orchards with legacy_id: ${data.length}`)
const farms = new Set(data.map(o => o.farm_id))
console.log(`Across ${farms.size} farm(s): ${[...farms].join(', ')}`)
console.log('')
console.log('legacy_id | farm_id                              | name')
for (const o of data) {
  console.log(`${String(o.legacy_id).padStart(9)} | ${o.farm_id} | ${o.name}`)
}

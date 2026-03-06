#!/usr/bin/env node
/**
 * Fix duplicate size bins: reassign qc_fruit from migration-created bins
 * (e.g. "135") to the original bins (e.g. "Count 135"), then delete the dupes.
 */

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

const DRY_RUN = process.argv.includes('--dry-run')

// Load all size bins
const { data: bins } = await supabase.from('size_bins').select('id, commodity_id, label, display_order')

// Group by commodity
const byCommodity = {}
for (const b of bins) {
  if (!byCommodity[b.commodity_id]) byCommodity[b.commodity_id] = []
  byCommodity[b.commodity_id].push(b)
}

// For each commodity, find pairs where "X" and "Count X" both exist,
// or "Small" and "Undersize" both exist, or "Oversize" exists twice
let totalReassigned = 0
let totalDeleted = 0

for (const [commodityId, list] of Object.entries(byCommodity)) {
  const byLabel = {}
  for (const b of list) byLabel[b.label] = b

  // Build merge map: migration bin → original bin
  const merges = []

  for (const b of list) {
    // Skip if this is already a "Count X" style bin
    if (b.label.startsWith('Count ')) continue

    // Check if there's a "Count X" version
    const countLabel = `Count ${b.label}`
    if (byLabel[countLabel]) {
      merges.push({ from: b, to: byLabel[countLabel] })
      continue
    }

    // "Small" → "Undersize"
    if (b.label === 'Small' && byLabel['Undersize']) {
      merges.push({ from: b, to: byLabel['Undersize'] })
      continue
    }

    // Duplicate "Oversize" — keep the one with lower display_order
    if (b.label === 'Oversize') {
      const others = list.filter(x => x.label === 'Oversize' && x.id !== b.id)
      if (others.length > 0) {
        const keep = [b, ...others].sort((a, c) => a.display_order - c.display_order)[0]
        if (b.id !== keep.id) {
          merges.push({ from: b, to: keep })
        }
      }
    }
  }

  if (merges.length === 0) continue

  console.log(`\nCommodity ${commodityId}: ${merges.length} bins to merge`)

  for (const { from, to } of merges) {
    console.log(`  "${from.label}" (${from.id}) → "${to.label}" (${to.id})`)

    if (DRY_RUN) continue

    // Count affected rows
    const { count } = await supabase
      .from('qc_fruit')
      .select('id', { count: 'exact', head: true })
      .eq('size_bin_id', from.id)

    console.log(`    ${count} fruit rows to reassign`)

    if (count > 0) {
      // Reassign in batches of 10000 using raw update
      const { error } = await supabase
        .from('qc_fruit')
        .update({ size_bin_id: to.id })
        .eq('size_bin_id', from.id)

      if (error) {
        console.error(`    ERROR reassigning: ${error.message}`)
        continue
      }
      totalReassigned += count
    }

    // Delete the duplicate bin
    const { error: delErr } = await supabase
      .from('size_bins')
      .delete()
      .eq('id', from.id)

    if (delErr) {
      console.error(`    ERROR deleting bin: ${delErr.message}`)
    } else {
      totalDeleted++
      console.log(`    Deleted bin "${from.label}"`)
    }
  }
}

console.log(`\nDone. Reassigned: ${totalReassigned} fruit rows. Deleted: ${totalDeleted} bins.`)

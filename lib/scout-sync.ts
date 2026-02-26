import { addToQueue, getPendingQueue, deleteFromQueue, upsertMany, upsertRecord } from './scout-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

// ── Pull reference data down from Supabase ────────────────────────────────
// This downloads orchards and pests onto the phone so they're available offline

export async function pullReferenceData(supabaseKey: string) {
  try {
    // Fetch orchards
    const orchardsRes = await fetch(`${SUPABASE_REST}/orchards?select=*`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })
    if (orchardsRes.ok) {
      const orchards = await orchardsRes.json()
      await upsertMany('orchards', orchards)
      console.log(`[Sync] Pulled ${orchards.length} orchards`)
    }

    // Fetch pests
    const pestsRes = await fetch(`${SUPABASE_REST}/pests?select=*`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })
    if (pestsRes.ok) {
      const pests = await pestsRes.json()
      await upsertMany('pests', pests)
      console.log(`[Sync] Pulled ${pests.length} pests`)
    }

    return { success: true }
  } catch (err) {
    console.error('[Sync] Pull failed:', err)
    return { success: false, error: err }
  }
}

// ── Save a record locally and queue it for upload ─────────────────────────
// This is the main function the app uses when a scout creates something

export async function saveAndQueue(
  tableName: string,
  record: Record<string, any>,
  supabaseKey: string
) {
  // Save to local database first (works offline)
  await upsertRecord(tableName as any, {
    ...record,
    _syncStatus: 'pending',
  })

  // Add to upload queue
  await addToQueue({
    tableName,
    method: 'POST',
    url: `${SUPABASE_REST}/${tableName}`,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(record),
    localId: record.id,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
  })
}

// ── Push all queued records up to Supabase ────────────────────────────────
// Call this when the phone comes back online

export async function pushPendingRecords(supabaseKey: string) {
  const queue = await getPendingQueue()

  if (queue.length === 0) {
    console.log('[Sync] Nothing to upload')
    return { pushed: 0, failed: 0 }
  }

  console.log(`[Sync] Uploading ${queue.length} records...`)

  let pushed = 0
  let failed = 0

  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      })

      if (response.ok) {
        // Remove from queue — successfully uploaded
        await deleteFromQueue(item.id!)

        // Update local record to show it's been synced
        const parsed = JSON.parse(item.body)
        await upsertRecord(item.tableName as any, {
          ...parsed,
          _syncStatus: 'synced',
        })

        pushed++
      } else {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
    } catch (err: any) {
      console.error(`[Sync] Failed to upload ${item.tableName}:`, err.message)

      // Update retry count in queue
      const db = await import('./scout-db').then((m) => m.getScoutDB())
      await db.put('sync_queue', {
        ...item,
        retries: (item.retries || 0) + 1,
        lastError: err.message,
        lastAttempt: new Date().toISOString(),
      })

      failed++
    }
  }

  console.log(`[Sync] Done: ${pushed} uploaded, ${failed} failed`)
  return { pushed, failed }
}

// ── Full sync: pull down + push up ────────────────────────────────────────

export async function runFullSync(supabaseKey: string) {
  const pull = await pullReferenceData(supabaseKey)
  const push = await pushPendingRecords(supabaseKey)
  return { pull, push }
}
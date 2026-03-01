import { addToQueue, getPendingQueue, deleteFromQueue, upsertMany, upsertRecord, getPendingPhotos, markPhotoSynced } from './scout-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

// ── Pull reference data down from Supabase ────────────────────────────────
// This downloads orchards and pests onto the phone so they're available offline

export async function pullReferenceData(supabaseKey: string, accessToken?: string) {
  try {
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken || supabaseKey}`,
    }

    // Fetch orchards
    const orchardsRes = await fetch(`${SUPABASE_REST}/orchards?select=*`, { headers })
    if (orchardsRes.ok) {
      const orchards = await orchardsRes.json()
      await upsertMany('orchards', orchards)
      console.log(`[Sync] Pulled ${orchards.length} orchards`)
    }

    // Fetch pests
    const pestsRes = await fetch(`${SUPABASE_REST}/pests?select=*`, { headers })
    if (pestsRes.ok) {
      const pests = await pestsRes.json()
      await upsertMany('pests', pests)
      console.log(`[Sync] Pulled ${pests.length} pests`)
    }

    // Fetch commodities
    const comRes = await fetch(`${SUPABASE_REST}/commodities?select=*`, { headers })
    if (comRes.ok) {
      const commodities = await comRes.json()
      await upsertMany('commodities', commodities)
      console.log(`[Sync] Pulled ${commodities.length} commodities`)
    }

    // Fetch commodity_pests (observation methods for each commodity)
    const cpRes = await fetch(`${SUPABASE_REST}/commodity_pests?is_active=eq.true&select=*`, { headers })
    if (cpRes.ok) {
      const commodityPests = await cpRes.json()
      await upsertMany('commodity_pests', commodityPests)
      console.log(`[Sync] Pulled ${commodityPests.length} commodity pests`)
    }

    // Fetch traps for scout's farm
    const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('farmscout_access_token') : null)
    const farmId = typeof window !== 'undefined' ? localStorage.getItem('farmscout_farm_id') : null
    const userId = typeof window !== 'undefined' ? localStorage.getItem('farmscout_user_id') : null

    if (token && farmId) {
      const [trapsRes, zonesRes, luresRes] = await Promise.all([
        fetch(`${SUPABASE_REST}/traps?farm_id=eq.${farmId}&is_active=eq.true&select=*`, { headers }),
        fetch(`${SUPABASE_REST}/zones?select=*`, { headers }),
        fetch(`${SUPABASE_REST}/lure_types?select=*`, { headers }),
      ])

      if (trapsRes.ok) {
        const traps = await trapsRes.json()
        await upsertMany('traps', traps)
        console.log(`[Sync] Pulled ${traps.length} traps`)
      }
      if (zonesRes.ok) {
        const zones = await zonesRes.json()
        await upsertMany('zones', zones)
        console.log(`[Sync] Pulled ${zones.length} zones`)
      }
      if (luresRes.ok) {
        const lures = await luresRes.json()
        await upsertMany('lure_types', lures)
        console.log(`[Sync] Pulled ${lures.length} lure types`)
      }

      // Fetch farm-level pest overrides (filtered to this farm only)
      const fpcRes = await fetch(
        `${SUPABASE_REST}/farm_commodity_pest_config?farm_id=eq.${farmId}&select=*`,
        { headers }
      )
      if (fpcRes.ok) {
        const configs = await fpcRes.json()
        // Store keyed by commodity_pest_id for fast lookup
        await upsertMany('farm_pest_config', configs.map((c: any) => ({
          ...c,
          commodity_pest_id: c.commodity_pest_id,
        })))
        console.log(`[Sync] Pulled ${configs.length} farm pest config overrides`)
      }
    }

    // Fetch scout's zone assignments via server-side route (bypasses RLS)
    if (token) {
      const szaRes = await fetch('/api/scout/zone-assignments', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (szaRes.ok) {
        const assignments = await szaRes.json()
        await upsertMany('scout_zone_assignments', assignments)
        console.log(`[Sync] Pulled ${assignments.length} zone assignments`)
      }
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
  supabaseKey: string,
  accessToken?: string,
  options?: { has_photo?: boolean }
) {
  // Save to local database first (works offline)
  await upsertRecord(tableName as any, {
    ...record,
    _syncStatus: 'pending',
  })

  const token = accessToken
    || (typeof window !== 'undefined' ? localStorage.getItem('farmscout_access_token') : null)
    || supabaseKey

  // Add to upload queue
  await addToQueue({
    tableName,
    method: 'POST',
    url: `${SUPABASE_REST}/${tableName}`,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(record),
    localId: record.id,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
    ...(options?.has_photo ? { has_photo: true } : {}),
  })
}

// ── Push pending photos to Supabase Storage ───────────────────────────────

export async function pushPendingPhotos(supabaseKey: string, accessToken?: string) {
  const pending = await getPendingPhotos()
  if (pending.length === 0) return { uploaded: 0, failed: 0 }

  const token = accessToken
    || (typeof window !== 'undefined' ? localStorage.getItem('farmscout_access_token') : null)
    || supabaseKey

  let uploaded = 0
  let failed = 0

  for (const photo of pending) {
    try {
      // Convert base64 to binary
      const base64Data = photo.data.replace(/^data:[^;]+;base64,/, '')
      const binaryStr = atob(base64Data)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: photo.mimeType || 'image/jpeg' })

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/inspection-photos/${photo.id}.jpg`,
        {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': photo.mimeType || 'image/jpeg',
            'x-upsert': 'true',
          },
          body: blob,
        }
      )

      if (uploadRes.ok) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/inspection-photos/${photo.id}.jpg`

        // Update the inspection_trees record in IndexedDB with the real URL
        const { getOne, upsertRecord: upsert } = await import('./scout-db')
        const treeRecord = await getOne('inspection_trees', photo.id)
        if (treeRecord) {
          await upsert('inspection_trees', { ...treeRecord, image_url: publicUrl })
        }

        // Find matching sync_queue item and patch body + clear has_photo flag
        const db = await import('./scout-db').then(m => m.getScoutDB())
        const allQueue = await db.getAll('sync_queue')
        for (const item of allQueue) {
          if (item.localId === photo.id && item.has_photo === true) {
            const parsed = JSON.parse(item.body)
            await db.put('sync_queue', {
              ...item,
              body: JSON.stringify({ ...parsed, image_url: publicUrl }),
              has_photo: false,
            })
            break
          }
        }

        await markPhotoSynced(photo.id)
        uploaded++
      } else {
        const errText = await uploadRes.text()
        throw new Error(`HTTP ${uploadRes.status}: ${errText}`)
      }
    } catch (err: any) {
      console.error(`[Sync] Photo upload failed for ${photo.id}:`, err.message)
      failed++
    }
  }

  console.log(`[Sync] Photos: ${uploaded} uploaded, ${failed} failed`)
  return { uploaded, failed }
}

// Tables that must go through the server-side route (bypasses RLS)
const SERVER_SIDE_TABLES = new Set([
  'inspection_sessions',
  'inspection_trees',
  'inspection_observations',
])

// ── Push all queued records up to Supabase ────────────────────────────────
// Call this when the phone comes back online

export async function pushPendingRecords(supabaseKey: string) {
  const queue = await getPendingQueue()

  if (queue.length === 0) {
    console.log('[Sync] Nothing to upload')
    return { pushed: 0, failed: 0 }
  }

  console.log(`[Sync] Uploading ${queue.length} records...`)

  // Always use a fresh token from localStorage so we don't use a stale queued token
  const freshToken = typeof window !== 'undefined'
    ? localStorage.getItem('farmscout_access_token')
    : null

  let pushed = 0
  let failed = 0

  for (const item of queue) {
    // Skip records waiting for their photo to be uploaded first
    if (item.has_photo === true) { failed++; continue }

    try {
      let response: Response

      if (SERVER_SIDE_TABLES.has(item.tableName) && freshToken) {
        // Route tree scouting tables through the server-side API (bypasses RLS)
        response = await fetch('/api/scout/tree-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${freshToken}`,
          },
          body: JSON.stringify({ table: item.tableName, record: JSON.parse(item.body) }),
        })
      } else {
        response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        })
      }

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

export async function runFullSync(supabaseKey: string, accessToken?: string) {
  const pull = await pullReferenceData(supabaseKey, accessToken)
  const photos = await pushPendingPhotos(supabaseKey, accessToken)  // photos first
  const push = await pushPendingRecords(supabaseKey)                // then records
  return { pull, photos, push }
}

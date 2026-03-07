import { addToQueue, getPendingQueue, deleteFromQueue, upsertMany, upsertRecord, getPendingPhotos, markPhotoSynced, clearStore, deleteRecord, getAll, getAllByIndex } from './scout-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

// ── Pull reference data down from Supabase ────────────────────────────────
// This downloads orchards and pests onto the phone so they're available offline

const SCOUT_REF_CACHE_MS = 30 * 60 * 1000 // 30 minutes

export async function pullReferenceData(supabaseKey: string, accessToken?: string) {
  try {
    // Skip if reference data was pulled recently (< 30 min)
    const lastPull = parseInt(
      typeof window !== 'undefined' ? localStorage.getItem('farmscout_ref_last_pull') || '0' : '0',
      10
    )
    if (Date.now() - lastPull < SCOUT_REF_CACHE_MS) {
      console.log('[Sync] Reference data cache still fresh, skipping pull')
      return { success: true }
    }

    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken || supabaseKey}`,
    }

    // Fetch orchards
    // Fetch orchards + boundaries in parallel
    const [orchardsRes, boundariesRes] = await Promise.all([
      fetch(`${SUPABASE_REST}/orchards?select=*`, { headers }),
      fetch(`${SUPABASE_REST}/rpc/get_orchard_boundaries`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      }),
    ])
    if (orchardsRes.ok) {
      const orchards = await orchardsRes.json()
      // Merge GeoJSON boundaries from RPC (raw REST returns WKB hex, not usable)
      if (boundariesRes.ok) {
        const boundaries = await boundariesRes.json()
        const boundaryMap = new Map<string, any>()
        for (const b of boundaries) {
          if (b.id && b.boundary) boundaryMap.set(b.id, b.boundary)
        }
        for (const o of orchards) {
          o.boundary = boundaryMap.get(o.id) || null
        }
        const withBoundary = orchards.filter((o: any) => o.boundary).length
        console.log(`[Sync] Boundaries: ${boundaryMap.size} from RPC, ${withBoundary}/${orchards.length} orchards matched`)
      } else {
        const errText = await boundariesRes.text().catch(() => '')
        console.warn(`[Sync] Boundary RPC failed (${boundariesRes.status}): ${errText}`)
        // Fallback: clear unusable WKB boundaries
        for (const o of orchards) { o.boundary = null }
      }
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
        await clearStore('zones')
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

      // Refresh GPS spread enforcement flag from scout record
      if (userId) {
        try {
          const scoutRes = await fetch(
            `${SUPABASE_REST}/scouts?user_id=eq.${userId}&select=enforce_gps_spread,gps_spread_pin`,
            { headers }
          )
          if (scoutRes.ok) {
            const scoutRows = await scoutRes.json()
            if (scoutRows.length > 0) {
              localStorage.setItem('farmscout_enforce_gps_spread', scoutRows[0].enforce_gps_spread ? 'true' : 'false')
              localStorage.setItem('farmscout_gps_spread_pin', scoutRows[0].gps_spread_pin || '')
            }
          }
        } catch (err) {
          console.error('[Sync] GPS spread flag refresh failed:', err)
        }
      }

      // Fetch rebait due count for the scout's trap route
      const firstTrapId = typeof window !== 'undefined' ? localStorage.getItem('farmscout_first_trap_id') : null
      if (firstTrapId) {
        try {
          const rebaitRes = await fetch(`${SUPABASE_REST}/rpc/get_scout_rebait_due_count`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_farm_id: farmId, p_first_trap_id: firstTrapId }),
          })
          if (rebaitRes.ok) {
            const count = await rebaitRes.json()
            if (typeof window !== 'undefined') {
              localStorage.setItem('farmscout_rebait_due', String(typeof count === 'number' ? count : 0))
            }
          }
        } catch (err) {
          console.error('[Sync] Rebait due count fetch failed:', err)
          // Non-fatal — don't throw
        }
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

    // Restore this week's inspection progress from Supabase (in case IndexedDB was cleared)
    if (token) {
      const progressRes = await fetch('/api/scout/pull-week-progress', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (progressRes.ok) {
        const { sessions, trees } = await progressRes.json()
        if (sessions.length > 0) {
          await upsertMany('inspection_sessions', sessions.map((s: any) => ({ ...s, _syncStatus: 'synced' })))
          console.log(`[Sync] Restored ${sessions.length} inspection sessions`)
        }
        if (trees.length > 0) {
          await upsertMany('inspection_trees', trees.map((t: any) => ({ ...t, _syncStatus: 'synced' })))
          console.log(`[Sync] Restored ${trees.length} inspection trees`)
        }
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('farmscout_ref_last_pull', String(Date.now()))
      console.log('[Sync] Reference data cached (30 min TTL)')
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
          // Patch server record too — whether or not the record was already pushed
          // (record may have been pushed without image_url; this upsert fills it in)
          fetch('/api/scout/tree-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              table: 'inspection_trees',
              record: { ...treeRecord, image_url: publicUrl },
            }),
          }).catch(() => {})
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
        // Free storage immediately — base64 blob no longer needed
        await deleteRecord('photos', photo.id)
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

// FK ordering — must be respected when batching
const SERVER_TABLE_ORDER = ['inspection_sessions', 'inspection_trees', 'inspection_observations']

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
  let firstError: string | null = null

  // ── Batch server-side records (one request per table, respecting FK order) ──
  if (freshToken) {
    // Include has_photo items too — push the record now (without image_url),
    // and pushPendingPhotos will patch the image_url on the server separately.
    const serverItems = queue.filter(
      item => SERVER_SIDE_TABLES.has(item.tableName)
    )

    if (serverItems.length > 0) {
      // Group by table
      const byTable: Record<string, typeof serverItems> = {}
      for (const item of serverItems) {
        if (!byTable[item.tableName]) byTable[item.tableName] = []
        byTable[item.tableName].push(item)
      }

      // Send in batches of 200, respecting FK order across tables
      const BATCH_SIZE = 200
      let batchFailed = false

      for (const table of SERVER_TABLE_ORDER) {
        const items = byTable[table] || []
        if (items.length === 0) continue

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE)
          try {
            const response = await fetch('/api/scout/tree-sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${freshToken}`,
              },
              body: JSON.stringify({
                records: batch.map(item => ({
                  table: item.tableName,
                  record: JSON.parse(item.body),
                })),
              }),
            })

            if (response.ok) {
              for (const item of batch) {
                await deleteFromQueue(item.id!)
                await upsertRecord(item.tableName as any, {
                  ...JSON.parse(item.body),
                  _syncStatus: 'synced',
                })
                pushed++
              }
            } else {
              const errorText = await response.text()
              throw new Error(`HTTP ${response.status}: ${errorText}`)
            }
          } catch (err: any) {
            console.error(`[Sync] Batch failed for ${table}:`, err.message)
            if (!firstError) firstError = `${table}: ${err.message}`
            const db = await import('./scout-db').then(m => m.getScoutDB())
            for (const item of batch) {
              await db.put('sync_queue', {
                ...item,
                retries: (item.retries || 0) + 1,
                lastError: err.message,
                lastAttempt: new Date().toISOString(),
              })
              failed++
            }
            batchFailed = true
          }
        }

        // Don't proceed to child tables if parent table failed (FK constraint)
        if (batchFailed) break
      }
    }
  }

  // ── Non-server-side records (trap inspections, etc.) — sent directly ──────
  const directItems = queue.filter(
    item => !SERVER_SIDE_TABLES.has(item.tableName)
  )

  for (const item of directItems) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      })

      if (response.ok) {
        await deleteFromQueue(item.id!)
        await upsertRecord(item.tableName as any, {
          ...JSON.parse(item.body),
          _syncStatus: 'synced',
        })
        pushed++
      } else {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
    } catch (err: any) {
      console.error(`[Sync] Failed to upload ${item.tableName}:`, err.message)
      if (!firstError) firstError = `${item.tableName}: ${err.message}`
      const db = await import('./scout-db').then(m => m.getScoutDB())
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
  return { pushed, failed, firstError }
}

// ── Prune old synced data from IndexedDB ──────────────────────────────────
// Retention: current week only. Never touches unsynced data.

function getWeekCutoff(): Date {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  const diffToMonday = day === 0 ? 6 : day - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)
  return monday // Monday 00:00 local time
}

export async function pruneOldData(): Promise<{ deleted: number }> {
  let deleted = 0
  const cutoff = getWeekCutoff()

  // Phase A — Synced photos (safety net for any missed in pushPendingPhotos)
  const allPhotos = await getAll('photos')
  for (const photo of allPhotos) {
    if (photo.synced === true) {
      await deleteRecord('photos', photo.id)
      deleted++
    }
  }

  // Phase B — Old tree scouting data (cascade: sessions → trees → observations)
  const allSessions = await getAll('inspection_sessions')
  for (const session of allSessions) {
    if (session._syncStatus !== 'synced') continue
    const sessionDate = new Date(session.inspected_at)
    if (isNaN(sessionDate.getTime()) || sessionDate >= cutoff) continue

    // Delete child trees and their observations
    const trees = await getAllByIndex('inspection_trees', 'by_session', session.id)
    for (const tree of trees) {
      const observations = await getAllByIndex('inspection_observations', 'by_tree', tree.id)
      for (const obs of observations) {
        await deleteRecord('inspection_observations', obs.id)
        deleted++
      }
      await deleteRecord('inspection_trees', tree.id)
      deleted++
    }
    await deleteRecord('inspection_sessions', session.id)
    deleted++
  }

  // Phase C — Old trap inspection data (cascade: inspections → counts)
  const allTrapInspections = await getAll('trap_inspections')
  for (const inspection of allTrapInspections) {
    if (inspection._syncStatus !== 'synced') continue
    const inspDate = new Date(inspection.inspected_at)
    if (isNaN(inspDate.getTime()) || inspDate >= cutoff) continue

    const counts = await getAllByIndex('trap_counts', 'by_trap_inspection', inspection.id)
    for (const count of counts) {
      await deleteRecord('trap_counts', count.id)
      deleted++
    }
    await deleteRecord('trap_inspections', inspection.id)
    deleted++
  }

  // Phase D — Stale sync_queue items (30+ days old, still unsynced)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const allQueue = await getAll('sync_queue')
  for (const item of allQueue) {
    if (item.synced) continue // already handled by normal cleanup
    const created = new Date(item.createdAt)
    if (!isNaN(created.getTime()) && created < thirtyDaysAgo) {
      await deleteRecord('sync_queue', item.id)
      deleted++
    }
  }

  return { deleted }
}

// ── Full sync: pull down + push up ────────────────────────────────────────

export async function runFullSync(supabaseKey: string, accessToken?: string) {
  const pull = await pullReferenceData(supabaseKey, accessToken)
  const photos = await pushPendingPhotos(supabaseKey, accessToken)  // photos first
  const push = await pushPendingRecords(supabaseKey)                // then records

  // Prune old synced data only after a fully successful push
  if (push.failed === 0) {
    try {
      const pruned = await pruneOldData()
      console.log(`[Sync] Pruned ${pruned.deleted} old records`)
    } catch (err) {
      console.error('[Sync] Prune failed (non-fatal):', err)
    }
  }

  return { pull, photos, push }
}

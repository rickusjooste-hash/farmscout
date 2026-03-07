import {
  qcPutMany,
  qcPut,
  qcAddToQueue,
  qcGetPendingQueue,
  qcDeleteFromQueue,
  qcGetMeta,
  qcSetMeta,
  qcGetAll,
  type QcBagSession,
  type QcFruit,
  type QcFruitIssue,
  type QcBagIssue,
  type QcSyncQueueItem,
} from './qc-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

function getToken(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('qcapp_access_token') || ''
    : ''
}

function getFarmId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('qcapp_farm_id') || ''
    : ''
}

function getFarmIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('qcapp_farm_ids')
    if (stored) return JSON.parse(stored)
  } catch {}
  const single = localStorage.getItem('qcapp_farm_id')
  return single ? [single] : []
}

function getOrgId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('qcapp_org_id') || ''
    : ''
}

function getAssignedRunnerIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('qcapp_assigned_runner_ids')
    if (stored) {
      const ids = JSON.parse(stored)
      return Array.isArray(ids) && ids.length > 0 ? ids : []
    }
  } catch {}
  return []
}

function getAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

// ── Token refresh (both QC and Runner apps store refresh tokens) ─────────

async function refreshTokenIfNeeded(): Promise<string> {
  const token = getToken()
  if (!token) return ''

  // Check if token is expired or about to expire (within 5 min)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expiresAt = payload.exp * 1000
    if (Date.now() < expiresAt - 5 * 60 * 1000) return token // still valid
  } catch {
    return token // can't parse, try using it as-is
  }

  // Try to refresh using whichever refresh token is available
  const refreshToken =
    localStorage.getItem('qcapp_refresh_token') ||
    localStorage.getItem('runnerapp_refresh_token') || ''
  if (!refreshToken) return token

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return token

    const data = await res.json()
    const newToken = data.access_token
    const newRefresh = data.refresh_token

    // Update both prefixes so runner and QC sync both work
    if (localStorage.getItem('qcapp_access_token')) {
      localStorage.setItem('qcapp_access_token', newToken)
      localStorage.setItem('qcapp_refresh_token', newRefresh)
    }
    if (localStorage.getItem('runnerapp_access_token')) {
      localStorage.setItem('runnerapp_access_token', newToken)
      localStorage.setItem('runnerapp_refresh_token', newRefresh)
    }

    console.log('[QcSync] Token refreshed successfully')
    return newToken
  } catch (err) {
    console.warn('[QcSync] Token refresh failed:', err)
    return token
  }
}

// ── Pull reference data ───────────────────────────────────────────────────

const REF_CACHE_MS = 30 * 60 * 1000 // 30 minutes

export async function pullQcReferenceData(accessToken?: string): Promise<{ success: boolean; error?: any }> {
  try {
    const token = accessToken || await refreshTokenIfNeeded() || getToken()
    const farmIds = getFarmIds()
    if (!token || !farmIds.length) return { success: false, error: 'No token or farm IDs' }

    const headers = {
      apikey: getAnonKey(),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // Only fetch heavy reference data (167 KB) if cache is stale (>30 min)
    const lastPull = parseInt(localStorage.getItem('qcapp_ref_last_pull') || '0', 10)
    const cacheStale = Date.now() - lastPull > REF_CACHE_MS

    if (cacheStale) {
      const res = await fetch(`${SUPABASE_REST}/rpc/get_qc_reference_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_farm_ids: farmIds }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`get_qc_reference_data failed: ${res.status} ${text}`)
      }

      const data = await res.json()

      if (data.employees?.length) {
        await qcPutMany('employees', data.employees)
        console.log(`[QcSync] Pulled ${data.employees.length} employees`)
      }
      if (data.size_bins?.length) {
        await qcPutMany('size_bins', data.size_bins)
        console.log(`[QcSync] Pulled ${data.size_bins.length} size bins`)
      }
      if (data.qc_issues?.length) {
        await qcPutMany('qc_issues', data.qc_issues)
        console.log(`[QcSync] Pulled ${data.qc_issues.length} QC issues`)
      }
      if (data.orchards?.length) {
        // Parse boundary GeoJSON strings into objects if needed
        const orchards = data.orchards.map((o: any) => ({
          ...o,
          boundary: o.boundary && typeof o.boundary === 'string'
            ? JSON.parse(o.boundary)
            : o.boundary,
        }))
        await qcPutMany('orchards', orchards)
        console.log(`[QcSync] Pulled ${orchards.length} orchards`)
      }

      localStorage.setItem('qcapp_ref_last_pull', String(Date.now()))
      console.log('[QcSync] Reference data cached (30 min TTL)')
    } else {
      console.log('[QcSync] Reference data cache still fresh, skipping RPC')
    }

    // Refresh runner assignments (so manager changes take effect mid-day)
    await refreshAssignments(headers)

    // Pull today's sessions (status=collected) for QC worker queue
    await pullTodaySessions(headers, farmIds)

    return { success: true }
  } catch (err) {
    console.error('[QcSync] Pull failed:', err)
    return { success: false, error: err }
  }
}

async function refreshAssignments(headers: Record<string, string>) {
  try {
    const workerId = typeof window !== 'undefined'
      ? localStorage.getItem('qcapp_worker_id') || ''
      : ''
    if (!workerId) return

    const res = await fetch(`${SUPABASE_REST}/rpc/get_assigned_runner_ids`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_qc_worker_id: workerId }),
    })
    if (res.ok) {
      const runnerIds: string[] = await res.json()
      localStorage.setItem('qcapp_assigned_runner_ids', JSON.stringify(runnerIds))
      console.log(`[QcSync] Refreshed runner assignments: ${runnerIds.length} runner(s)`)
    }
  } catch (err) {
    console.warn('[QcSync] Could not refresh runner assignments:', err)
  }
}

async function pullTodaySessions(headers: Record<string, string>, farmIds: string[]) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const runnerIds = getAssignedRunnerIds()

    // If QC worker has assigned runners, filter by runner_id; otherwise fall back to farm_id
    let scopeFilter: string
    if (runnerIds.length > 0) {
      scopeFilter = runnerIds.length === 1
        ? `runner_id=eq.${runnerIds[0]}`
        : `runner_id=in.(${runnerIds.join(',')})`
    } else {
      scopeFilter = farmIds.length === 1
        ? `farm_id=eq.${farmIds[0]}`
        : `farm_id=in.(${farmIds.join(',')})`
    }

    // Pull collected bags from today
    const url = `${SUPABASE_REST}/qc_bag_sessions?${scopeFilter}&status=eq.collected&collected_at=gte.${today}&select=id,bag_seq,farm_id,orchard_id,employee_id,runner_id,status,collected_at,organisation_id`
    console.log(`[QcSync] Pulling today sessions: ${url}`)
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`[QcSync] pullTodaySessions failed (${res.status}):`, errText)
      return
    }
    const sessions: QcBagSession[] = await res.json()
    console.log(`[QcSync] Found ${sessions.length} collected sessions from Supabase for today (${today}), filter: ${scopeFilter}`)

    // Also check which of these sessions already have fruit records (already sampled but status not updated)
    const sessionIds = sessions.map(s => s.id)
    const sampledIds = new Set<string>()
    if (sessionIds.length > 0) {
      const idsFilter = sessionIds.length === 1
        ? `session_id=eq.${sessionIds[0]}`
        : `session_id=in.(${sessionIds.join(',')})`
      const fruitRes = await fetch(
        `${SUPABASE_REST}/qc_fruit?${idsFilter}&select=session_id&limit=1000`,
        { headers }
      )
      if (fruitRes.ok) {
        const fruits: { session_id: string }[] = await fruitRes.json()
        fruits.forEach(f => sampledIds.add(f.session_id))
      }
    }

    // Filter out bags that already have fruit records (already sampled)
    const pendingSessions = sessions.filter(s => !sampledIds.has(s.id))

    // Enrich with display names from the reference data we just stored
    const [employees, orchards] = await Promise.all([qcGetAll('employees'), qcGetAll('orchards')])
    const empMap = Object.fromEntries(employees.map(e => [e.id, e.full_name]))
    const orchMap = Object.fromEntries(orchards.map(o => [o.id, o.name]))

    const localBags = await qcGetAll('bag_sessions')

    for (const s of pendingSessions) {
      // Don't overwrite local records that are ahead of Supabase
      const existing = localBags.find(b => b.id === s.id)
      if (existing && existing._syncStatus === 'pending') continue  // local changes not yet pushed
      if (existing && existing.status === 'sampled') continue  // already sampled locally — don't revert

      await qcPut('bag_sessions', {
        ...s,
        _syncStatus: 'synced',
        _employee_name: empMap[s.employee_id] || existing?._employee_name || 'Unknown picker',
        _orchard_name: orchMap[s.orchard_id] || existing?._orchard_name || 'Unknown orchard',
      })
    }
    console.log(`[QcSync] Pulled ${pendingSessions.length} pending sessions (${sampledIds.size} already sampled excluded)`)
  } catch (err) {
    console.warn('[QcSync] Could not pull today sessions:', err)
  }
}

// ── Get next daily bag sequence number ────────────────────────────────────

export async function getNextBagSeq(accessToken?: string): Promise<number> {
  const farmId = getFarmId()
  if (!farmId) return 1

  // Reset local counter at the start of each day
  const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const seqDate = await qcGetMeta('daily_bag_seq_date')
  let localSeq = (await qcGetMeta('daily_bag_seq')) ?? 0
  if (seqDate !== todayStr) {
    localSeq = 0
    await qcSetMeta('daily_bag_seq_date', todayStr)
  }

  let nextSeq = localSeq + 1

  try {
    const token = accessToken || getToken()
    const res = await fetch(`${SUPABASE_REST}/rpc/get_daily_bag_seq`, {
      method: 'POST',
      headers: {
        apikey: getAnonKey(),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_farm_id: farmId }),
    })

    if (res.ok) {
      const seq = await res.json()
      const dbNext = typeof seq === 'number' ? seq : 1
      // Take the higher of DB and local — handles unsynced bags
      nextSeq = Math.max(nextSeq, dbNext)
    }
  } catch {
    // Offline — use local counter
  }

  // Always persist so next call increments from here
  await qcSetMeta('daily_bag_seq', nextSeq)
  return nextSeq
}

// ── Save a record locally and queue for upload ────────────────────────────

export async function qcSaveAndQueue(
  tableName: 'bag_sessions' | 'bag_fruit' | 'fruit_issues' | 'bag_issues',
  record: QcBagSession | QcFruit | QcFruitIssue | QcBagIssue,
  accessToken?: string
): Promise<void> {
  const token = accessToken || getToken()
  const anonKey = getAnonKey()

  // Local store name → Supabase REST table name
  const restTableMap: Record<string, string> = {
    bag_sessions: 'qc_bag_sessions',
    bag_fruit:    'qc_fruit',
    fruit_issues: 'qc_fruit_issues',
    bag_issues:   'qc_bag_issues',
  }
  // Supabase REST table name → local IndexedDB store name
  const dbStoreMap: Record<string, string> = {
    qc_bag_sessions: 'bag_sessions',
    qc_fruit:        'bag_fruit',
    qc_fruit_issues: 'fruit_issues',
    qc_bag_issues:   'bag_issues',
  }
  const restTable = tableName.startsWith('qc_') ? tableName : (restTableMap[tableName] ?? `qc_${tableName}`)
  const dbStore = dbStoreMap[restTable] ?? tableName

  // Save locally first (with denormalized display fields)
  await qcPut(dbStore as any, { ...(record as any), _syncStatus: 'pending' })

  // Strip local-only fields (prefixed with _) before sending to Supabase
  const remoteRecord = Object.fromEntries(
    Object.entries(record as any).filter(([k]) => !k.startsWith('_'))
  )

  // For bag_sessions updates (status change to sampled), use PATCH instead of POST
  // POST upsert can fail when the row was created by another user (runner)
  const isSessionUpdate = restTable === 'qc_bag_sessions' && (record as any).status === 'sampled'
  const recordId = (record as any).id

  const method = isSessionUpdate ? 'PATCH' : 'POST'
  const url = isSessionUpdate
    ? `${SUPABASE_REST}/${restTable}?id=eq.${recordId}`
    : `${SUPABASE_REST}/${restTable}`

  // Queue for upload
  await qcAddToQueue({
    tableName: restTable,
    method,
    url,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(isSessionUpdate ? {} : { Prefer: 'resolution=merge-duplicates' }),
    },
    body: JSON.stringify(remoteRecord),
    localId: recordId,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
  })
}

// ── Upload unknown issue photo to Supabase Storage ───────────────────────

async function uploadUnknownPhoto(
  base64DataUrl: string,
  issueId: string,
  token: string,
  anonKey: string
): Promise<string | null> {
  try {
    const [meta, data] = base64DataUrl.split(',')
    const mimeMatch = meta.match(/data:(image\/\w+);base64/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const ext  = mime.split('/')[1] || 'jpg'

    const byteChars = atob(data)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })

    const objectPath = `${issueId}.${ext}`
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/qc-unknown-photos/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': mime,
        'x-upsert': 'true',
      },
      body: blob,
    })

    if (res.ok) {
      console.log(`[QcSync] Uploaded unknown photo: ${objectPath}`)
      return objectPath
    }
    const err = await res.text()
    console.warn(`[QcSync] Photo upload failed: ${err}`)
    return null
  } catch (err) {
    console.warn('[QcSync] Photo upload error:', err)
    return null
  }
}

// ── Push pending records to Supabase ─────────────────────────────────────

const BATCH_SIZE = 100

export async function qcPushPendingRecords(): Promise<{ pushed: number; failed: number }> {
  const queue = await qcGetPendingQueue()
  if (queue.length === 0) return { pushed: 0, failed: 0 }

  console.log(`[QcSync] Uploading ${queue.length} records...`)
  const freshToken = await refreshTokenIfNeeded() || getToken()
  const anonKey = getAnonKey()

  const storeMap: Record<string, string> = {
    qc_bag_sessions: 'bag_sessions',
    qc_fruit: 'bag_fruit',
    qc_fruit_issues: 'fruit_issues',
    qc_bag_issues: 'bag_issues',
  }

  let pushed = 0
  let failed = 0

  // Separate PATCH (single-record updates) from POST (batchable inserts)
  const patchItems: QcSyncQueueItem[] = []
  const postByTable: Record<string, QcSyncQueueItem[]> = {}

  for (const item of queue) {
    if (item.method === 'PATCH') {
      patchItems.push(item)
    } else {
      if (!postByTable[item.tableName]) postByTable[item.tableName] = []
      postByTable[item.tableName].push(item)
    }
  }

  // ── Batch POST records by table (up to BATCH_SIZE per request) ──────
  // Process in FK dependency order: sessions → fruit → fruit_issues → bag_issues
  const TABLE_ORDER = ['qc_bag_sessions', 'qc_fruit', 'qc_fruit_issues', 'qc_bag_issues']
  const sortedTables = Object.keys(postByTable).sort((a, b) => {
    const ai = TABLE_ORDER.indexOf(a)
    const bi = TABLE_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  for (const tableName of sortedTables) {
    const items = postByTable[tableName]
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      try {
        // Handle photos for bag_issues before batching
        const cleanBodies: any[] = []
        for (const item of batch) {
          let body = item.body
          if (item.tableName === 'qc_bag_issues') {
            const localRecord = await (await import('./qc-db').then(m => m.getQcDB()))
              .get('bag_issues', item.localId) as any
            if (localRecord?._photo) {
              const photoPath = await uploadUnknownPhoto(localRecord._photo, item.localId, freshToken, anonKey)
              if (photoPath) {
                const parsed = JSON.parse(body)
                parsed.photo_url = photoPath
                body = JSON.stringify(parsed)
              }
            }
          }
          const parsed = JSON.parse(body)
          cleanBodies.push(Object.fromEntries(Object.entries(parsed).filter(([k]) => !k.startsWith('_'))))
        }

        const res = await fetch(`${SUPABASE_REST}/${tableName}`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${freshToken}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(cleanBodies),
        })

        // 2xx = success, 409 = duplicate (data already exists) — both mean we can clear queue
        if (res.ok || res.status === 409) {
          for (const item of batch) {
            await qcDeleteFromQueue(item.id!)
            const parsed = JSON.parse(item.body)
            const dbStore = storeMap[item.tableName] || item.tableName
            await qcPut(dbStore as any, { ...parsed, _syncStatus: 'synced' })
          }
          pushed += batch.length
          console.log(`[QcSync] Batch pushed ${batch.length} ${tableName} (${i + batch.length}/${items.length})${res.status === 409 ? ' (already existed)' : ''}`)
        } else {
          const errText = await res.text()
          throw new Error(`HTTP ${res.status}: ${errText}`)
        }
      } catch (err: any) {
        console.error(`[QcSync] Batch failed for ${tableName}:`, err.message)
        const db = await import('./qc-db').then(m => m.getQcDB())
        for (const item of batch) {
          const retries = (item.retries || 0) + 1
          if (retries >= 10) {
            // Too many retries — data is likely already in DB; drop the queue entry
            await db.delete('sync_queue', item.id!)
            console.warn(`[QcSync] Dropped ${item.tableName} after ${retries} retries: ${item.localId}`)
            pushed++
          } else {
            await db.put('sync_queue', {
              ...item,
              retries,
              lastError: err.message,
              lastAttempt: new Date().toISOString(),
            })
            failed++
          }
        }
      }
    }
  }

  // ── PATCH records (status updates) — must go individually ───────────
  for (const item of patchItems) {
    try {
      const parsed = JSON.parse(item.body)
      const clean = Object.fromEntries(Object.entries(parsed).filter(([k]) => !k.startsWith('_')))

      const res = await fetch(item.url, {
        method: 'PATCH',
        headers: {
          ...item.headers,
          Authorization: `Bearer ${freshToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify(clean),
      })

      if (res.ok) {
        await qcDeleteFromQueue(item.id!)
        const dbStore = storeMap[item.tableName] || item.tableName
        await qcPut(dbStore as any, { ...parsed, _syncStatus: 'synced' })
        pushed++
      } else {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }
    } catch (err: any) {
      console.error(`[QcSync] PATCH failed for ${item.tableName}:`, err.message)
      const db = await import('./qc-db').then(m => m.getQcDB())
      const retries = (item.retries || 0) + 1
      if (retries >= 10) {
        await db.delete('sync_queue', item.id!)
        console.warn(`[QcSync] Dropped PATCH ${item.tableName} after ${retries} retries: ${item.localId}`)
        pushed++
      } else {
        await db.put('sync_queue', {
          ...item,
          retries,
          lastError: err.message,
          lastAttempt: new Date().toISOString(),
        })
        failed++
      }
    }
  }

  console.log(`[QcSync] Done: ${pushed} pushed, ${failed} failed`)
  return { pushed, failed }
}

// ── Emergency: clear all pending queue entries (data already in Supabase) ──

export async function qcClearSyncQueue(): Promise<number> {
  const db = await import('./qc-db').then(m => m.getQcDB())
  const all = await db.getAll('sync_queue')
  for (const item of all) {
    await db.delete('sync_queue', item.id!)
  }
  console.log(`[QcSync] Cleared ${all.length} queue entries`)
  return all.length
}

// ── Full sync ─────────────────────────────────────────────────────────────

export async function qcRunFullSync(accessToken?: string): Promise<void> {
  // Loop push until queue is drained or no more progress
  let prevPushed = -1
  for (let pass = 0; pass < 5; pass++) {
    const { pushed } = await qcPushPendingRecords()
    if (pushed === 0) break          // nothing left or nothing succeeded
    if (pushed === prevPushed) break  // no progress — stop retrying
    prevPushed = pushed
    console.log(`[QcSync] Pass ${pass + 1}: pushed ${pushed}, checking for more...`)
  }
  await pullQcReferenceData(accessToken)
}

// ── Count today's logged bags (for home screen display) ───────────────────

export async function countTodayBags(): Promise<number> {
  try {
    const sessions = await qcGetAll('bag_sessions')
    const today = new Date().toISOString().slice(0, 10)
    return sessions.filter(s => s.collected_at?.startsWith(today)).length
  } catch {
    return 0
  }
}

// ── Get pending bags for QC worker queue ──────────────────────────────────

export async function getPendingBagSessions(): Promise<QcBagSession[]> {
  try {
    const all = await qcGetAll('bag_sessions')
    return all
      .filter(s => s.status === 'collected')
      .sort((a, b) => {
        const ta = a.collected_at || a.created_at || ''
        const tb = b.collected_at || b.created_at || ''
        return tb.localeCompare(ta)  // newest first
      })
  } catch {
    return []
  }
}

// ── Count today's sampled bags ────────────────────────────────────────────

export async function countTodaySampled(): Promise<number> {
  try {
    const sessions = await qcGetAll('bag_sessions')
    const today = new Date().toISOString().slice(0, 10)
    return sessions.filter(s => s.status === 'sampled' && s.sampled_at?.startsWith(today)).length
  } catch {
    return 0
  }
}

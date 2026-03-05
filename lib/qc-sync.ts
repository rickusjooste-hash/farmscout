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

    // Pull today's sessions (status=collected) for QC worker queue
    await pullTodaySessions(headers, farmIds)

    return { success: true }
  } catch (err) {
    console.error('[QcSync] Pull failed:', err)
    return { success: false, error: err }
  }
}

async function pullTodaySessions(headers: Record<string, string>, farmIds: string[]) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const farmFilter = farmIds.length === 1
      ? `farm_id=eq.${farmIds[0]}`
      : `farm_id=in.(${farmIds.join(',')})`

    // Pull collected bags from today
    const res = await fetch(
      `${SUPABASE_REST}/qc_bag_sessions?${farmFilter}&status=eq.collected&collected_at=gte.${today}&select=*`,
      { headers }
    )
    if (!res.ok) return
    const sessions: QcBagSession[] = await res.json()

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

    // Clean up locally-stored "collected" bags that are no longer pending on server
    const pendingIds = new Set(pendingSessions.map(s => s.id))
    const localBags = await qcGetAll('bag_sessions')
    const db = await import('./qc-db').then(m => m.getQcDB())
    for (const local of localBags) {
      if (local.status === 'collected' && local._syncStatus !== 'pending' && !pendingIds.has(local.id)) {
        await db.delete('bag_sessions', local.id)
      }
    }

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
      const n = typeof seq === 'number' ? seq : 1
      // Update local counter so offline fallback is in sync
      await qcSetMeta('daily_bag_seq', n)
      return n
    }
  } catch {
    // Fall through to offline fallback
  }

  // Offline fallback: increment local counter
  const localSeq = (await qcGetMeta('daily_bag_seq')) ?? 0
  const next = localSeq + 1
  await qcSetMeta('daily_bag_seq', next)
  return next
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

  // Queue for upload
  await qcAddToQueue({
    tableName: restTable,
    method: 'POST',
    url: `${SUPABASE_REST}/${restTable}`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(remoteRecord),
    localId: (record as any).id,
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

  for (const item of queue) {
    try {
      // For unknown bag issues: upload photo to Storage first, inject photo_url into body
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

      // Strip local-only fields (prefixed with _) before sending to Supabase
      const parsed = JSON.parse(body)
      const clean = Object.fromEntries(Object.entries(parsed).filter(([k]) => !k.startsWith('_')))
      body = JSON.stringify(clean)

      // Refresh auth headers with current token
      const headers = {
        ...item.headers,
        Authorization: `Bearer ${freshToken}`,
        apikey: anonKey,
      }

      const res = await fetch(item.url, {
        method: item.method,
        headers,
        body,
      })

      if (res.ok) {
        await qcDeleteFromQueue(item.id!)
        const parsed = JSON.parse(item.body)
        const dbStore = storeMap[item.tableName] || item.tableName
        await qcPut(dbStore as any, { ...parsed, _syncStatus: 'synced' })
        pushed++
      } else {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }
    } catch (err: any) {
      console.error(`[QcSync] Failed to upload ${item.tableName}:`, err.message)

      const db = await import('./qc-db').then(m => m.getQcDB())
      await db.put('sync_queue', {
        ...item,
        retries: (item.retries || 0) + 1,
        lastError: err.message,
        lastAttempt: new Date().toISOString(),
      })
      failed++
    }
  }

  console.log(`[QcSync] Done: ${pushed} pushed, ${failed} failed`)
  return { pushed, failed }
}

// ── Full sync ─────────────────────────────────────────────────────────────

export async function qcRunFullSync(accessToken?: string): Promise<void> {
  await qcPushPendingRecords()
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

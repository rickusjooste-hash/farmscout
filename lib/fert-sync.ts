import {
  fertPutMany,
  fertPut,
  fertAddToQueue,
  fertGetPendingQueue,
  fertDeleteFromQueue,
  fertGetAll,
  getFertDB,
  type FertApplication,
  type FertSyncQueueItem,
  type SpreaderChartEntry,
} from './fert-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

function getToken(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('fertapp_access_token') || ''
    : ''
}

function getFarmId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('fertapp_farm_id') || ''
    : ''
}

function getOrgId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('fertapp_org_id') || ''
    : ''
}

function getUserId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('fertapp_user_id') || ''
    : ''
}

function getAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

// ── Token refresh ─────────────────────────────────────────────────────────

async function refreshTokenIfNeeded(): Promise<string> {
  const token = getToken()
  if (!token) return ''

  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expiresAt = payload.exp * 1000
    if (Date.now() < expiresAt - 5 * 60 * 1000) return token
  } catch {
    return token
  }

  const refreshToken = localStorage.getItem('fertapp_refresh_token') || ''
  if (!refreshToken) return token

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return token

    const data = await res.json()
    localStorage.setItem('fertapp_access_token', data.access_token)
    localStorage.setItem('fertapp_refresh_token', data.refresh_token)
    console.log('[FertSync] Token refreshed successfully')
    return data.access_token
  } catch (err) {
    console.warn('[FertSync] Token refresh failed:', err)
    return token
  }
}

// ── Pull dispatched lines ─────────────────────────────────────────────────

const REF_CACHE_MS = 15 * 60 * 1000 // 15 minutes

export async function pullFertDispatchedLines(accessToken?: string): Promise<{ success: boolean; error?: any }> {
  try {
    const token = accessToken || await refreshTokenIfNeeded() || getToken()
    const farmId = getFarmId()
    const userId = getUserId()
    if (!token || !farmId || !userId) return { success: false, error: 'No token, farm, or user ID' }

    const headers = {
      apikey: getAnonKey(),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // Call RPC to get dispatched lines for this applicator
    const res = await fetch(`${SUPABASE_REST}/rpc/get_fert_dispatched_lines`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_user_id: userId, p_farm_id: farmId }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`get_fert_dispatched_lines failed: ${res.status} ${text}`)
    }

    const lines = await res.json()

    if (Array.isArray(lines) && lines.length > 0) {
      await fertPutMany('dispatched_lines', lines)
      console.log(`[FertSync] Pulled ${lines.length} dispatched lines`)

      // Extract unique orchards, products, timings for reference
      const orchardMap = new Map<string, any>()
      const productMap = new Map<string, any>()
      const timingMap = new Map<string, any>()

      for (const l of lines) {
        if (!orchardMap.has(l.orchard_id)) {
          orchardMap.set(l.orchard_id, {
            id: l.orchard_id,
            name: l.orchard_name,
            orchard_nr: l.orchard_nr,
            variety: l.variety,
            ha: l.ha,
            section_name: l.section_name,
          })
        }
        if (!productMap.has(l.product_id)) {
          productMap.set(l.product_id, {
            id: l.product_id,
            name: l.product_name,
            default_unit: l.product_unit,
          })
        }
        if (!timingMap.has(l.timing_id)) {
          timingMap.set(l.timing_id, {
            id: l.timing_id,
            label: l.timing_label,
            sort_order: l.timing_sort,
          })
        }
      }

      await fertPutMany('orchards', [...orchardMap.values()])
      await fertPutMany('products', [...productMap.values()])
      await fertPutMany('timings', [...timingMap.values()])
    }

    localStorage.setItem('fertapp_ref_last_pull', String(Date.now()))
    return { success: true }
  } catch (err) {
    console.error('[FertSync] Pull failed:', err)
    return { success: false, error: err }
  }
}

// ── Pull spreader chart entries for dispatched spreaders ─────────────────

export async function pullSpreaderChartEntries(accessToken?: string): Promise<void> {
  try {
    const token = accessToken || getToken()
    const anonKey = getAnonKey()
    if (!token) return

    // Get unique spreader_ids from dispatched lines
    const lines = await fertGetAll('dispatched_lines')
    const spreaderIds = [...new Set(lines.map(l => l.spreader_id).filter(Boolean))] as string[]
    if (spreaderIds.length === 0) return

    const headers = { apikey: anonKey, Authorization: `Bearer ${token}` }

    for (const spreaderId of spreaderIds) {
      const res = await fetch(
        `${SUPABASE_REST}/spreader_chart_entries?spreader_id=eq.${spreaderId}&select=*`,
        { headers }
      )
      if (!res.ok) continue
      const entries: SpreaderChartEntry[] = await res.json()
      if (entries.length > 0) {
        await fertPutMany('chart_entries', entries)
      }
    }
    console.log(`[FertSync] Pulled chart entries for ${spreaderIds.length} spreader(s)`)
  } catch (err) {
    console.warn('[FertSync] Chart entries pull failed:', err)
  }
}

// ── Save a record locally and queue for upload ────────────────────────────

export async function fertSaveAndQueue(
  record: FertApplication,
  accessToken?: string
): Promise<void> {
  const token = accessToken || getToken()
  const anonKey = getAnonKey()

  // Save locally first
  await fertPut('applications', { ...record, _syncStatus: 'pending' })

  // Also update the dispatched line to show confirmed locally
  const lines = await fertGetAll('dispatched_lines')
  const line = lines.find(l => l.line_id === record.line_id)
  if (line) {
    await fertPut('dispatched_lines', {
      ...line,
      confirmed: true,
      date_applied: record.date_applied,
      actual_rate_per_ha: record.actual_rate_per_ha,
      actual_total_qty: record.actual_total_qty,
    })
  }

  // Strip local-only fields before sending to Supabase
  const remoteRecord = Object.fromEntries(
    Object.entries(record).filter(([k]) => !k.startsWith('_'))
  )

  // Use upsert (POST with merge-duplicates) since line_id has a UNIQUE constraint
  await fertAddToQueue({
    tableName: 'fert_applications',
    method: 'POST',
    url: `${SUPABASE_REST}/fert_applications`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(remoteRecord),
    localId: record.id,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
  })
}

// ── Upload photo to Supabase Storage ──────────────────────────────────────

async function uploadFertPhoto(
  base64DataUrl: string,
  applicationId: string,
  token: string,
  anonKey: string
): Promise<string | null> {
  try {
    const [meta, data] = base64DataUrl.split(',')
    const mimeMatch = meta.match(/data:(image\/\w+);base64/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const ext = mime.split('/')[1] || 'jpg'

    const byteChars = atob(data)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })

    const objectPath = `${applicationId}.${ext}`
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/fert-photos/${objectPath}`, {
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
      console.log(`[FertSync] Uploaded photo: ${objectPath}`)
      return objectPath
    }
    const err = await res.text()
    console.warn(`[FertSync] Photo upload failed: ${err}`)
    return null
  } catch (err) {
    console.warn('[FertSync] Photo upload error:', err)
    return null
  }
}

// ── Push pending records to Supabase ─────────────────────────────────────

const BATCH_SIZE = 100
let _syncLock = false

export async function fertPushPendingRecords(): Promise<{ pushed: number; failed: number }> {
  if (_syncLock) {
    console.log('[FertSync] Sync already in progress, skipping')
    return { pushed: 0, failed: 0 }
  }
  _syncLock = true
  try {
    return await _doPush()
  } finally {
    _syncLock = false
  }
}

async function _doPush(): Promise<{ pushed: number; failed: number }> {
  const queue = await fertGetPendingQueue()
  if (queue.length === 0) return { pushed: 0, failed: 0 }

  console.log(`[FertSync] Uploading ${queue.length} records...`)
  const freshToken = await refreshTokenIfNeeded() || getToken()
  const anonKey = getAnonKey()

  let pushed = 0
  let failed = 0

  // Process in batches
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE)
    try {
      const cleanBodies: any[] = []
      for (const item of batch) {
        let body = item.body

        // Handle photos: upload then set photo_url
        const db = await getFertDB()
        const localRecord = await db.get('applications', item.localId) as FertApplication | undefined
        if (localRecord?._photo) {
          const photoPath = await uploadFertPhoto(localRecord._photo, item.localId, freshToken, anonKey)
          if (photoPath) {
            const parsed = JSON.parse(body)
            parsed.photo_url = photoPath
            body = JSON.stringify(parsed)
          }
        }

        const parsed = JSON.parse(body)
        cleanBodies.push(Object.fromEntries(Object.entries(parsed).filter(([k]) => !k.startsWith('_'))))
      }

      const res = await fetch(`${SUPABASE_REST}/fert_applications`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(cleanBodies),
      })

      if (res.ok || res.status === 409) {
        for (const item of batch) {
          await fertDeleteFromQueue(item.id!)
          const parsed = JSON.parse(item.body)
          await fertPut('applications', { ...parsed, _syncStatus: 'synced' })
        }
        pushed += batch.length
        console.log(`[FertSync] Batch pushed ${batch.length} applications`)
      } else {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }
    } catch (err: any) {
      console.error(`[FertSync] Batch failed:`, err.message)
      const db = await getFertDB()
      for (const item of batch) {
        const existing = await db.get('sync_queue', item.id!)
        if (!existing) continue
        const retries = (existing.retries || 0) + 1
        if (retries >= 10) {
          await db.delete('sync_queue', item.id!)
          console.warn(`[FertSync] Dropped after ${retries} retries: ${item.localId}`)
          pushed++
        } else {
          await db.put('sync_queue', {
            ...existing,
            retries,
            lastError: err.message,
            lastAttempt: new Date().toISOString(),
          })
          failed++
        }
      }
    }
  }

  console.log(`[FertSync] Done: ${pushed} pushed, ${failed} failed`)
  return { pushed, failed }
}

// ── Full sync ─────────────────────────────────────────────────────────────

export async function fertRunFullSync(accessToken?: string): Promise<void> {
  let prevPushed = -1
  for (let pass = 0; pass < 5; pass++) {
    const { pushed } = await fertPushPendingRecords()
    if (pushed === 0) break
    if (pushed === prevPushed) break
    prevPushed = pushed
    console.log(`[FertSync] Pass ${pass + 1}: pushed ${pushed}, checking for more...`)
  }
  await pullFertDispatchedLines(accessToken)
}

// ── Count pending applications (for badge display) ───────────────────────

export async function countPendingApplications(): Promise<number> {
  try {
    const queue = await fertGetPendingQueue()
    return queue.length
  } catch {
    return 0
  }
}

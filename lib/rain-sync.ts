import {
  rainPutMany,
  rainPut,
  rainAddToQueue,
  rainGetPendingQueue,
  rainDeleteFromQueue,
  getRainDB,
  type RainReading,
  type RainSyncQueueItem,
} from './rain-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

function getToken(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('rainapp_access_token') || ''
    : ''
}

function getOrgId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('rainapp_org_id') || ''
    : ''
}

function getFarmIds(): string[] {
  if (typeof window === 'undefined') return []
  const json = localStorage.getItem('rainapp_farm_ids')
  if (json) {
    try { return JSON.parse(json) } catch { /* fall through */ }
  }
  const single = localStorage.getItem('rainapp_farm_id')
  return single ? [single] : []
}

function getAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

// ── Token refresh ─────────────────────────────────────────────────────

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

  const refreshToken = localStorage.getItem('rainapp_refresh_token') || ''
  if (!refreshToken) return token

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return token

    const data = await res.json()
    localStorage.setItem('rainapp_access_token', data.access_token)
    localStorage.setItem('rainapp_refresh_token', data.refresh_token)
    console.log('[RainSync] Token refreshed')
    return data.access_token
  } catch (err) {
    console.warn('[RainSync] Token refresh failed:', err)
    return token
  }
}

// ── Pull reference data (gauges) ──────────────────────────────────────

export async function pullRainReferenceData(
  accessToken?: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const token = accessToken || (await refreshTokenIfNeeded()) || getToken()
    const farmIds = getFarmIds()
    if (!token || farmIds.length === 0) return { success: false, error: 'No token or farm IDs' }

    const headers = {
      apikey: getAnonKey(),
      Authorization: `Bearer ${token}`,
    }

    const farmIdFilter = `(${farmIds.join(',')})`
    const res = await fetch(
      `${SUPABASE_REST}/rain_gauges?farm_id=in.${farmIdFilter}&is_active=eq.true&select=id,farm_id,name,lat,lng&order=name`,
      { headers }
    )

    if (res.ok) {
      const gauges = await res.json()
      if (gauges.length > 0) await rainPutMany('gauges', gauges)
      console.log(`[RainSync] Pulled ${gauges.length} gauges`)
    }

    return { success: true }
  } catch (err) {
    console.error('[RainSync] Pull reference failed:', err)
    return { success: false, error: err }
  }
}

// ── Pull recent readings (last 30 days) ───────────────────────────────

export async function pullRecentReadings(accessToken?: string): Promise<void> {
  try {
    const token = accessToken || getToken()
    const farmIds = getFarmIds()
    if (!token || farmIds.length === 0) return

    const headers = {
      apikey: getAnonKey(),
      Authorization: `Bearer ${token}`,
    }

    // Get gauge IDs for this user's farms
    const farmIdFilter = `(${farmIds.join(',')})`
    const gaugeRes = await fetch(
      `${SUPABASE_REST}/rain_gauges?farm_id=in.${farmIdFilter}&is_active=eq.true&select=id`,
      { headers }
    )
    if (!gaugeRes.ok) return
    const gauges = await gaugeRes.json()
    if (gauges.length === 0) return

    const gaugeIds = gauges.map((g: { id: string }) => g.id)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0]

    const gaugeIdFilter = `(${gaugeIds.join(',')})`
    const res = await fetch(
      `${SUPABASE_REST}/rain_readings?gauge_id=in.${gaugeIdFilter}&reading_date=gte.${fromDate}&select=id,gauge_id,reading_date,value_mm&order=reading_date.desc`,
      { headers }
    )

    if (res.ok) {
      const readings = await res.json()
      if (readings.length > 0) await rainPutMany('readings', readings)
      console.log(`[RainSync] Pulled ${readings.length} recent readings`)
    }
  } catch (err) {
    console.warn('[RainSync] Pull recent readings failed:', err)
  }
}

// ── Save reading locally and queue for upload ─────────────────────────

export async function rainSaveAndQueue(reading: RainReading): Promise<void> {
  const token = getToken()
  const anonKey = getAnonKey()

  await rainPut('readings', reading)

  // Strip internal fields for the API payload
  const { _syncStatus, ...payload } = reading

  await rainAddToQueue({
    tableName: 'rain_readings',
    method: 'POST',
    url: `${SUPABASE_REST}/rain_readings`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
    localId: reading.id,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
  })
}

// ── Push pending records to Supabase ──────────────────────────────────

const BATCH_SIZE = 100
let _syncLock = false

export async function rainPushPendingRecords(): Promise<{ pushed: number; failed: number }> {
  if (_syncLock) return { pushed: 0, failed: 0 }
  _syncLock = true
  try {
    return await _doPush()
  } finally {
    _syncLock = false
  }
}

async function _doPush(): Promise<{ pushed: number; failed: number }> {
  const queue = await rainGetPendingQueue()
  if (queue.length === 0) return { pushed: 0, failed: 0 }

  console.log(`[RainSync] Uploading ${queue.length} records...`)
  const freshToken = (await refreshTokenIfNeeded()) || getToken()
  const anonKey = getAnonKey()

  let pushed = 0
  let failed = 0

  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE)
    try {
      const bodies = batch.map(item => {
        const parsed = JSON.parse(item.body)
        return Object.fromEntries(
          Object.entries(parsed).filter(([k]) => !k.startsWith('_'))
        )
      })

      const res = await fetch(`${SUPABASE_REST}/rain_readings`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(bodies),
      })

      if (res.ok || res.status === 409) {
        for (const item of batch) {
          await rainDeleteFromQueue(item.id!)
        }
        pushed += batch.length
      } else {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }
    } catch (err: any) {
      console.error('[RainSync] Batch failed:', err.message)
      const db = await getRainDB()
      for (const item of batch) {
        const existing = await db.get('sync_queue', item.id!)
        if (!existing) continue
        const retries = (existing.retries || 0) + 1
        if (retries >= 10) {
          await db.delete('sync_queue', item.id!)
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

  console.log(`[RainSync] Done: ${pushed} pushed, ${failed} failed`)
  return { pushed, failed }
}

// ── Count pending ─────────────────────────────────────────────────────

export async function countPendingRainRecords(): Promise<number> {
  try {
    const queue = await rainGetPendingQueue()
    return queue.length
  } catch {
    return 0
  }
}

import {
  weighPutMany,
  weighPut,
  weighAddToQueue,
  weighGetPendingQueue,
  weighDeleteFromQueue,
  getWeighDB,
  weighGetAll,
  type WeighRecord,
  type WeighSyncQueueItem,
} from './packshed-weigh-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

function getToken(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('packshedweigh_access_token') || ''
    : ''
}

function getOrgId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('packshedweigh_org_id') || ''
    : ''
}

function getFarmIds(): string[] {
  if (typeof window === 'undefined') return []
  const json = localStorage.getItem('packshedweigh_farm_ids')
  if (json) {
    try { return JSON.parse(json) } catch { /* fall through */ }
  }
  const single = localStorage.getItem('packshedweigh_farm_id')
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

  const refreshToken = localStorage.getItem('packshedweigh_refresh_token') || ''
  if (!refreshToken) return token

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return token

    const data = await res.json()
    localStorage.setItem('packshedweigh_access_token', data.access_token)
    localStorage.setItem('packshedweigh_refresh_token', data.refresh_token)
    console.log('[WeighSync] Token refreshed')
    return data.access_token
  } catch (err) {
    console.warn('[WeighSync] Token refresh failed:', err)
    return token
  }
}

// ── Pull reference data ──────────────────────────────────────────────

export async function pullWeighReferenceData(
  accessToken?: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const token = accessToken || (await refreshTokenIfNeeded()) || getToken()
    const farmIds = getFarmIds()
    const orgId = getOrgId()
    if (!token || farmIds.length === 0) return { success: false, error: 'No token or farm IDs' }

    const headers = {
      apikey: getAnonKey(),
      Authorization: `Bearer ${token}`,
    }

    const farmIdFilter = `(${farmIds.join(',')})`

    const [packhouseRes, orchardRes] = await Promise.all([
      fetch(
        `${SUPABASE_REST}/packhouses?organisation_id=eq.${orgId}&is_active=eq.true&select=id,code,name,farm_id&order=code`,
        { headers }
      ),
      fetch(
        `${SUPABASE_REST}/orchards?farm_id=in.${farmIdFilter}&is_active=eq.true&select=id,name,orchard_nr,variety,farm_id&order=orchard_nr`,
        { headers }
      ),
    ])

    if (packhouseRes.ok) {
      const packhouses = await packhouseRes.json()
      if (packhouses.length > 0) await weighPutMany('packhouses', packhouses)
      console.log(`[WeighSync] Pulled ${packhouses.length} packhouses`)
    }

    if (orchardRes.ok) {
      const orchards = await orchardRes.json()
      if (orchards.length > 0) await weighPutMany('orchards', orchards)
      console.log(`[WeighSync] Pulled ${orchards.length} orchards`)
    }

    return { success: true }
  } catch (err) {
    console.error('[WeighSync] Pull reference failed:', err)
    return { success: false, error: err }
  }
}

// ── Pull today's records ─────────────────────────────────────────────

export async function pullTodayWeighRecords(accessToken?: string): Promise<void> {
  try {
    const token = accessToken || getToken()
    const orgId = getOrgId()
    if (!token || !orgId) return

    const headers = {
      apikey: getAnonKey(),
      Authorization: `Bearer ${token}`,
    }

    const today = new Date().toISOString().split('T')[0]
    const res = await fetch(
      `${SUPABASE_REST}/packout_bin_weights?organisation_id=eq.${orgId}&weigh_date=eq.${today}&select=id,organisation_id,packhouse_id,orchard_id,weigh_date,seq,category,gross_weight_kg,bin_type,tare_weight_kg,net_weight_kg,weighed_by`,
      { headers }
    )

    if (res.ok) {
      const records = await res.json()
      if (records.length > 0) await weighPutMany('weigh_records', records)
      console.log(`[WeighSync] Pulled ${records.length} today's records`)
    }
  } catch (err) {
    console.warn('[WeighSync] Pull today records failed:', err)
  }
}

// ── Save record locally and queue for upload ─────────────────────────

export async function weighSaveAndQueue(record: WeighRecord): Promise<void> {
  const token = getToken()
  const anonKey = getAnonKey()

  await weighPut('weigh_records', record)

  // Strip local-only fields for the API payload
  const { _syncStatus, id: _localId, net_weight_kg: _computed, ...payload } = record

  await weighAddToQueue({
    tableName: 'packout_bin_weights',
    method: 'POST',
    url: `${SUPABASE_REST}/packout_bin_weights?on_conflict=organisation_id,packhouse_id,weigh_date,category,seq`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
    localId: record.id,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
  })
}

// ── Push pending records to Supabase ──────────────────────────────────

const BATCH_SIZE = 100
let _syncLock = false

export async function weighPushPendingRecords(): Promise<{ pushed: number; failed: number }> {
  if (_syncLock) return { pushed: 0, failed: 0 }
  _syncLock = true
  try {
    return await _doPush()
  } finally {
    _syncLock = false
  }
}

async function _doPush(): Promise<{ pushed: number; failed: number }> {
  const queue = await weighGetPendingQueue()
  if (queue.length === 0) return { pushed: 0, failed: 0 }

  console.log(`[WeighSync] Uploading ${queue.length} records...`)
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
          Object.entries(parsed).filter(([k]) => !k.startsWith('_') && k !== 'id')
        )
      })

      const res = await fetch(`${SUPABASE_REST}/packout_bin_weights?on_conflict=organisation_id,packhouse_id,weigh_date,category,seq`, {
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
          await weighDeleteFromQueue(item.id!)
        }
        pushed += batch.length
      } else {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }
    } catch (err: any) {
      console.error('[WeighSync] Batch failed:', err.message)
      const db = await getWeighDB()
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

  console.log(`[WeighSync] Done: ${pushed} pushed, ${failed} failed`)
  return { pushed, failed }
}

// ── Count pending ─────────────────────────────────────────────────────

export async function countPendingWeighRecords(): Promise<number> {
  try {
    const queue = await weighGetPendingQueue()
    return queue.length
  } catch {
    return 0
  }
}

import {
  juicePutMany,
  juicePut,
  juiceAddToQueue,
  juiceGetPendingQueue,
  juiceDeleteFromQueue,
  getJuiceDB,
  type JuiceSample,
  type JuiceSyncQueueItem,
} from './packshed-juice-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

function getToken(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('packshedjuice_access_token') || ''
    : ''
}

function getOrgId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('packshedjuice_org_id') || ''
    : ''
}

function getFarmIds(): string[] {
  if (typeof window === 'undefined') return []
  const json = localStorage.getItem('packshedjuice_farm_ids')
  if (json) {
    try { return JSON.parse(json) } catch { /* fall through */ }
  }
  const single = localStorage.getItem('packshedjuice_farm_id')
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

  const refreshToken = localStorage.getItem('packshedjuice_refresh_token') || ''
  if (!refreshToken) return token

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return token

    const data = await res.json()
    localStorage.setItem('packshedjuice_access_token', data.access_token)
    localStorage.setItem('packshedjuice_refresh_token', data.refresh_token)
    console.log('[JuiceSync] Token refreshed')
    return data.access_token
  } catch (err) {
    console.warn('[JuiceSync] Token refresh failed:', err)
    return token
  }
}

// ── Pull reference data ──────────────────────────────────────────────

export async function pullJuiceReferenceData(
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

    const [packhouseRes, orchardRes, defectRes] = await Promise.all([
      fetch(
        `${SUPABASE_REST}/packhouses?organisation_id=eq.${orgId}&is_active=eq.true&select=id,code,name,farm_id&order=code`,
        { headers }
      ),
      fetch(
        `${SUPABASE_REST}/orchards?farm_id=in.${farmIdFilter}&is_active=eq.true&select=id,name,orchard_nr,variety,farm_id&order=orchard_nr`,
        { headers }
      ),
      // Juice defects: same as QC issues — commodity_pests where category = 'qc_issue'
      // Join with pests to get names
      // Pull QC issues + picking issues for apples
      fetch(
        `${SUPABASE_REST}/commodity_pests?category=in.(qc_issue,picking_issue)&is_active=eq.true&commodity_id=eq.568df904-f53b-4171-9d84-033f58d07023&select=pest_id,display_name,display_name_af,display_order,commodity_id&order=display_order`,
        { headers }
      ),
    ])

    if (packhouseRes.ok) {
      const packhouses = await packhouseRes.json()
      if (packhouses.length > 0) await juicePutMany('packhouses', packhouses)
      console.log(`[JuiceSync] Pulled ${packhouses.length} packhouses`)
    }

    if (orchardRes.ok) {
      const orchards = await orchardRes.json()
      if (orchards.length > 0) await juicePutMany('orchards', orchards)
      console.log(`[JuiceSync] Pulled ${orchards.length} orchards`)
    }

    if (defectRes.ok) {
      const commodityPests = await defectRes.json()
      // Clear old defect types before re-populating
      const db = await getJuiceDB()
      const tx = db.transaction('defect_types', 'readwrite')
      await tx.store.clear()
      await tx.done

      const seen = new Set<string>()
      const defectTypes = []
      for (const cp of commodityPests) {
        if (!seen.has(cp.pest_id)) {
          seen.add(cp.pest_id)
          defectTypes.push({
            id: cp.pest_id,
            name: cp.display_name || 'Unknown',
            name_af: cp.display_name_af || cp.display_name || 'Unknown',
            pest_id: cp.pest_id,
            display_order: cp.display_order ?? 99,
          })
        }
      }
      // Sort by display_order
      defectTypes.sort((a, b) => a.display_order - b.display_order)
      if (defectTypes.length > 0) await juicePutMany('defect_types', defectTypes)
      console.log(`[JuiceSync] Pulled ${defectTypes.length} defect types (QC issues)`)
    }

    return { success: true }
  } catch (err) {
    console.error('[JuiceSync] Pull reference failed:', err)
    return { success: false, error: err }
  }
}

// ── Save sample locally and queue for upload ─────────────────────────

export async function juiceSaveAndQueue(sample: JuiceSample): Promise<void> {
  const token = getToken()
  const anonKey = getAnonKey()

  // Save full sample (with embedded defects) to IndexedDB
  await juicePut('juice_samples', sample)

  // Build two payloads: header + defect rows
  const { _syncStatus, defects, id: _localId, ...headerPayload } = sample

  // Queue the header first
  await juiceAddToQueue({
    tableName: 'packout_juice_samples',
    method: 'POST',
    url: `${SUPABASE_REST}/packout_juice_samples`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ ...headerPayload, id: sample.id }),
    localId: sample.id,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
  })

  // Queue each defect row
  if (defects && defects.length > 0) {
    const defectRows = defects
      .filter(d => d.count > 0)
      .map(d => ({
        sample_id: sample.id,
        pest_id: d.pest_id,
        count: d.count,
      }))

    if (defectRows.length > 0) {
      await juiceAddToQueue({
        tableName: 'packout_juice_defects',
        method: 'POST',
        url: `${SUPABASE_REST}/packout_juice_defects`,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(defectRows),
        localId: `${sample.id}_defects`,
        synced: false,
        retries: 0,
        createdAt: new Date().toISOString(),
      })
    }
  }
}

// ── Push pending records to Supabase ──────────────────────────────────

let _syncLock = false

export async function juicePushPendingRecords(): Promise<{ pushed: number; failed: number }> {
  if (_syncLock) return { pushed: 0, failed: 0 }
  _syncLock = true
  try {
    return await _doPush()
  } finally {
    _syncLock = false
  }
}

async function _doPush(): Promise<{ pushed: number; failed: number }> {
  const queue = await juiceGetPendingQueue()
  if (queue.length === 0) return { pushed: 0, failed: 0 }

  console.log(`[JuiceSync] Uploading ${queue.length} items...`)
  const freshToken = (await refreshTokenIfNeeded()) || getToken()
  const anonKey = getAnonKey()

  let pushed = 0
  let failed = 0

  // Process items sequentially (headers before defects due to FK)
  // Sort: headers first, defects second
  const sorted = [...queue].sort((a, b) => {
    if (a.tableName === 'packout_juice_samples' && b.tableName !== 'packout_juice_samples') return -1
    if (a.tableName !== 'packout_juice_samples' && b.tableName === 'packout_juice_samples') return 1
    return 0
  })

  for (const item of sorted) {
    try {
      const body = JSON.parse(item.body)
      // Strip local fields
      const cleaned = Array.isArray(body)
        ? body.map(b => Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith('_'))))
        : Object.fromEntries(Object.entries(body).filter(([k]) => !k.startsWith('_')))

      const res = await fetch(item.url, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
          Prefer: item.headers.Prefer || 'return=minimal',
        },
        body: JSON.stringify(cleaned),
      })

      if (res.ok || res.status === 409) {
        await juiceDeleteFromQueue(item.id!)
        pushed++
      } else {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }
    } catch (err: any) {
      console.error('[JuiceSync] Item failed:', err.message)
      const db = await getJuiceDB()
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

  console.log(`[JuiceSync] Done: ${pushed} pushed, ${failed} failed`)
  return { pushed, failed }
}

// ── Count pending ─────────────────────────────────────────────────────

export async function countPendingJuiceSamples(): Promise<number> {
  try {
    const queue = await juiceGetPendingQueue()
    return queue.length
  } catch {
    return 0
  }
}

import {
  binsPutMany,
  binsPut,
  binsAddToQueue,
  binsGetPendingQueue,
  binsDeleteFromQueue,
  getBinsDB,
  type BinsRecord,
  type BruisingRecord,
  type BinsSyncQueueItem,
} from './bins-db'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`

function getToken(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('binsapp_access_token') || ''
    : ''
}

function getFarmIds(): string[] {
  if (typeof window === 'undefined') return []
  const json = localStorage.getItem('binsapp_farm_ids')
  if (json) {
    try { return JSON.parse(json) } catch { /* fall through */ }
  }
  const single = localStorage.getItem('binsapp_farm_id')
  return single ? [single] : []
}

function getOrgId(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('binsapp_org_id') || ''
    : ''
}

function getAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
}

// ── Season / week helpers ─────────────────────────────────────────────

export function deriveSeason(dateStr: string): { production_year: string; season: string } {
  const d = new Date(dateStr)
  const yr = d.getFullYear()
  const mo = d.getMonth() + 1
  const startYr = mo >= 8 ? yr : yr - 1
  const endYr = startYr + 1
  return {
    production_year: `${startYr}${endYr}`,
    season: `${startYr}/${String(endYr).slice(-2)}`,
  }
}

export function getISOWeek(dateStr: string): number {
  const d = new Date(dateStr)
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function getWeekDay(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[new Date(dateStr).getDay()]
}

export function getCurrentSeason(): string {
  return deriveSeason(new Date().toISOString().split('T')[0]).season
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

  const refreshToken = localStorage.getItem('binsapp_refresh_token') || ''
  if (!refreshToken) return token

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: getAnonKey() },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return token

    const data = await res.json()
    localStorage.setItem('binsapp_access_token', data.access_token)
    localStorage.setItem('binsapp_refresh_token', data.refresh_token)
    console.log('[BinsSync] Token refreshed')
    return data.access_token
  } catch (err) {
    console.warn('[BinsSync] Token refresh failed:', err)
    return token
  }
}

// ── Pull reference data ───────────────────────────────────────────────

export async function pullBinsReferenceData(
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

    const season = getCurrentSeason()
    const farmIdFilter = `(${farmIds.join(',')})`

    const [orchardRes, farmRes, teamRes] = await Promise.all([
      fetch(
        `${SUPABASE_REST}/orchards?farm_id=in.${farmIdFilter}&is_active=eq.true&status=eq.active&select=id,farm_id,name,orchard_nr,variety,legacy_id,ha&order=orchard_nr`,
        { headers }
      ),
      fetch(
        `${SUPABASE_REST}/farms?organisation_id=eq.${orgId}&is_active=eq.true&select=id,code,full_name`,
        { headers }
      ),
      fetch(
        `${SUPABASE_REST}/production_bins?organisation_id=eq.${orgId}&season=eq.${encodeURIComponent(season)}&team=not.is.null&select=team,team_name&limit=500`,
        { headers }
      ),
    ])

    if (orchardRes.ok) {
      const orchards = await orchardRes.json()
      if (orchards.length > 0) await binsPutMany('orchards', orchards)
      console.log(`[BinsSync] Pulled ${orchards.length} orchards`)
    }

    if (farmRes.ok) {
      const farms = await farmRes.json()
      if (farms.length > 0) await binsPutMany('farms', farms)
      console.log(`[BinsSync] Pulled ${farms.length} farms`)
    }

    if (teamRes.ok) {
      const rawTeams = await teamRes.json()
      const teamMap = new Map<string, { team: string; team_name: string | null }>()
      for (const t of rawTeams) {
        if (t.team && !teamMap.has(t.team)) {
          teamMap.set(t.team, { team: t.team, team_name: t.team_name })
        }
      }
      const teams = [...teamMap.values()].map(t => ({ key: t.team, ...t }))
      if (teams.length > 0) await binsPutMany('teams', teams)
      console.log(`[BinsSync] Pulled ${teams.length} teams`)
    }

    return { success: true }
  } catch (err) {
    console.error('[BinsSync] Pull reference failed:', err)
    return { success: false, error: err }
  }
}

// ── Pull today's records (restore state after IndexedDB clear) ───────

export async function pullTodayRecords(accessToken?: string): Promise<void> {
  try {
    const token = accessToken || getToken()
    const farmIds = getFarmIds()
    const orgId = getOrgId()
    if (!token || farmIds.length === 0) return

    const today = new Date().toISOString().split('T')[0]
    const headers = {
      apikey: getAnonKey(),
      Authorization: `Bearer ${token}`,
    }

    const farmIdFilter = `(${farmIds.join(',')})`

    const [binsRes, bruisingRes] = await Promise.all([
      fetch(
        `${SUPABASE_REST}/production_bins?organisation_id=eq.${orgId}&farm_id=in.${farmIdFilter}&received_date=eq.${today}&select=*`,
        { headers }
      ),
      fetch(
        `${SUPABASE_REST}/production_bruising?organisation_id=eq.${orgId}&farm_id=in.${farmIdFilter}&received_date=eq.${today}&select=*`,
        { headers }
      ),
    ])

    if (binsRes.ok) {
      const bins = await binsRes.json()
      if (bins.length > 0) await binsPutMany('bins_records', bins)
      console.log(`[BinsSync] Pulled ${bins.length} today's bins records`)
    }

    if (bruisingRes.ok) {
      const bruising = await bruisingRes.json()
      if (bruising.length > 0) await binsPutMany('bruising_records', bruising)
      console.log(`[BinsSync] Pulled ${bruising.length} today's bruising records`)
    }
  } catch (err) {
    console.warn('[BinsSync] Pull today failed:', err)
  }
}

// ── Save bins record locally and queue for upload ─────────────────────

export async function binsSaveAndQueue(binsRecord: BinsRecord): Promise<void> {
  const token = getToken()
  const anonKey = getAnonKey()

  await binsPut('bins_records', binsRecord)

  await binsAddToQueue({
    tableName: 'production_bins',
    method: 'POST',
    url: `${SUPABASE_REST}/production_bins`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(binsRecord),
    localId: binsRecord.xlsx_id,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
  })
}

// ── Save bruising record locally and queue for upload ─────────────────

export async function binsSaveBruisingAndQueue(record: BruisingRecord): Promise<void> {
  const token = getToken()
  const anonKey = getAnonKey()

  await binsPut('bruising_records', record)

  await binsAddToQueue({
    tableName: 'production_bruising',
    method: 'POST',
    url: `${SUPABASE_REST}/production_bruising`,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(record),
    localId: record.xlsx_id,
    synced: false,
    retries: 0,
    createdAt: new Date().toISOString(),
  })
}

// ── Push pending records to Supabase ─────────────────────────────────

const BATCH_SIZE = 100
let _syncLock = false

export async function binsPushPendingRecords(): Promise<{ pushed: number; failed: number }> {
  if (_syncLock) {
    console.log('[BinsSync] Sync already in progress, skipping')
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
  const queue = await binsGetPendingQueue()
  if (queue.length === 0) return { pushed: 0, failed: 0 }

  console.log(`[BinsSync] Uploading ${queue.length} records...`)
  const freshToken = (await refreshTokenIfNeeded()) || getToken()
  const anonKey = getAnonKey()

  let pushed = 0
  let failed = 0

  // Group by table name so we can batch correctly
  const byTable = new Map<string, BinsSyncQueueItem[]>()
  for (const item of queue) {
    if (!byTable.has(item.tableName)) byTable.set(item.tableName, [])
    byTable.get(item.tableName)!.push(item)
  }

  for (const [tableName, items] of byTable) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      try {
        const bodies = batch.map(item => {
          const parsed = JSON.parse(item.body)
          return Object.fromEntries(
            Object.entries(parsed).filter(([k]) => !k.startsWith('_'))
          )
        })

        const res = await fetch(`${SUPABASE_REST}/${tableName}`, {
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
            await binsDeleteFromQueue(item.id!)
          }
          pushed += batch.length
          console.log(`[BinsSync] Batch pushed ${batch.length} ${tableName} records`)
        } else {
          const errText = await res.text()
          throw new Error(`HTTP ${res.status}: ${errText}`)
        }
      } catch (err: any) {
        console.error(`[BinsSync] Batch failed:`, err.message)
        const db = await getBinsDB()
        for (const item of batch) {
          const existing = await db.get('sync_queue', item.id!)
          if (!existing) continue
          const retries = (existing.retries || 0) + 1
          if (retries >= 10) {
            await db.delete('sync_queue', item.id!)
            console.warn(`[BinsSync] Dropped after ${retries} retries: ${item.localId}`)
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
  }

  console.log(`[BinsSync] Done: ${pushed} pushed, ${failed} failed`)
  return { pushed, failed }
}

// ── Full sync ─────────────────────────────────────────────────────────

export async function binsRunFullSync(accessToken?: string): Promise<void> {
  let prevPushed = -1
  for (let pass = 0; pass < 5; pass++) {
    const { pushed } = await binsPushPendingRecords()
    if (pushed === 0) break
    if (pushed === prevPushed) break
    prevPushed = pushed
  }
  await pullBinsReferenceData(accessToken)
  await pullTodayRecords(accessToken)
}

// ── Count pending (for badge display) ─────────────────────────────────

export async function countPendingBinsRecords(): Promise<number> {
  try {
    const queue = await binsGetPendingQueue()
    return queue.length
  } catch {
    return 0
  }
}

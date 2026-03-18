import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ── Types ─────────────────────────────────────────────────────────────────

export interface BinsOrchard {
  id: string
  farm_id: string
  name: string
  orchard_nr: number | null
  variety: string | null
  legacy_id: number | null
  ha: number | null
}

export interface BinsTeam {
  key: string          // team code, used as keyPath
  team: string
  team_name: string | null
}

export interface BinsFarm {
  id: string
  code: string
  full_name: string
}

export interface BinsRecord {
  xlsx_id: string      // pwa-{uuid}
  organisation_id: string
  farm_id: string
  orchard_id: string | null
  orchard_legacy_id: number | null
  orchard_name: string
  variety: string | null
  team: string | null
  team_name: string | null
  bins: number
  juice: number
  total: number
  production_year: string
  season: string
  week_num: number | null
  week_day: string | null
  farm_code: string | null
  received_date: string      // YYYY-MM-DD
  received_time: string | null // HH:MM:SS
}

export interface BruisingRecord {
  xlsx_id: string
  organisation_id: string
  farm_id: string
  orchard_id: string | null
  orchard_legacy_id: number | null
  orchard_name: string
  variety: string | null
  team: string | null
  team_name: string | null
  bruising_count: number
  stem_count: number
  injury_count: number
  sample_size: number
  bruising_pct: number | null
  stem_pct: number | null
  injury_pct: number | null
  sample_nr: number | null
  bin_weight_kg: number | null
  fruit_guard: string | null
  production_year: string
  season: string
  week_num: number | null
  received_date: string
  received_time: string | null
  farm_code: string | null
}

export interface BinsSyncQueueItem {
  id?: number
  tableName: string
  method: string
  url: string
  headers: Record<string, string>
  body: string
  localId: string
  synced: boolean
  retries: number
  createdAt: string
  lastAttempt?: string
  lastError?: string
  [key: string]: any
}

export interface BinsMeta {
  key: string
  value: any
}

// ── IndexedDB Schema ──────────────────────────────────────────────────────

interface BinsDB extends DBSchema {
  orchards: { key: string; value: BinsOrchard }
  teams: { key: string; value: BinsTeam }
  farms: { key: string; value: BinsFarm }
  bins_records: {
    key: string
    value: BinsRecord
    indexes: { 'by_date': string }
  }
  bruising_records: {
    key: string
    value: BruisingRecord
    indexes: { 'by_date': string }
  }
  sync_queue: {
    key: number
    value: BinsSyncQueueItem
    indexes: { 'by_synced': string }
  }
  meta: { key: string; value: BinsMeta }
}

// ── Database singleton ────────────────────────────────────────────────────

let _db: IDBPDatabase<BinsDB> | null = null

export async function getBinsDB(): Promise<IDBPDatabase<BinsDB>> {
  if (_db) return _db

  _db = await openDB<BinsDB>('farmscout-bins', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('orchards')) {
        db.createObjectStore('orchards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('teams')) {
        db.createObjectStore('teams', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('farms')) {
        db.createObjectStore('farms', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('bins_records')) {
        const s = db.createObjectStore('bins_records', { keyPath: 'xlsx_id' })
        s.createIndex('by_date', 'received_date')
      }
      if (!db.objectStoreNames.contains('bruising_records')) {
        const s = db.createObjectStore('bruising_records', { keyPath: 'xlsx_id' })
        s.createIndex('by_date', 'received_date')
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        const s = db.createObjectStore('sync_queue', {
          keyPath: 'id',
          autoIncrement: true,
        })
        s.createIndex('by_synced', 'synced')
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    },
  })

  return _db
}

// ── Generic helpers ───────────────────────────────────────────────────────

export async function binsGetAll<S extends keyof BinsDB>(store: S): Promise<BinsDB[S]['value'][]> {
  const db = await getBinsDB()
  return (db as any).getAll(store)
}

export async function binsGet<S extends keyof BinsDB>(
  store: S,
  key: string | number
): Promise<BinsDB[S]['value'] | undefined> {
  const db = await getBinsDB()
  return (db as any).get(store, key)
}

export async function binsPut<S extends keyof BinsDB>(store: S, record: BinsDB[S]['value']): Promise<void> {
  const db = await getBinsDB()
  await (db as any).put(store, record)
}

export async function binsPutMany<S extends keyof BinsDB>(store: S, records: BinsDB[S]['value'][]): Promise<void> {
  const db = await getBinsDB()
  const tx = (db as any).transaction(store, 'readwrite')
  await Promise.all([...records.map((r: any) => tx.store.put(r)), tx.done])
}

// ── Sync queue helpers ────────────────────────────────────────────────────

export async function binsAddToQueue(item: Omit<BinsSyncQueueItem, 'id'>): Promise<void> {
  const db = await getBinsDB()
  await db.add('sync_queue', item as BinsSyncQueueItem)
}

export async function binsGetPendingQueue(): Promise<BinsSyncQueueItem[]> {
  try {
    const db = await getBinsDB()
    const all = await db.getAll('sync_queue')
    return all.filter(item => item.synced === false)
  } catch {
    return []
  }
}

export async function binsDeleteFromQueue(id: number): Promise<void> {
  const db = await getBinsDB()
  await db.delete('sync_queue', id)
}

// ── Meta store helpers ────────────────────────────────────────────────────

export async function binsGetMeta(key: string): Promise<any> {
  const db = await getBinsDB()
  const record = await db.get('meta', key)
  return record?.value ?? null
}

export async function binsSetMeta(key: string, value: any): Promise<void> {
  const db = await getBinsDB()
  await db.put('meta', { key, value })
}

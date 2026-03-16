import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ── Types ─────────────────────────────────────────────────────────────────

export interface FertOrchard {
  id: string
  name: string
  orchard_nr: number | null
  variety: string | null
  ha: number | null
  section_name: string | null
}

export interface FertProduct {
  id: string
  name: string
  default_unit: string | null
}

export interface FertTiming {
  id: string
  label: string
  sort_order: number
}

export interface FertDispatchedLine {
  line_id: string
  dispatch_id: string
  timing_id: string
  timing_label: string
  timing_sort: number
  product_id: string
  product_name: string
  product_unit: string | null
  orchard_id: string
  orchard_name: string
  orchard_nr: number | null
  variety: string | null
  section_name: string | null
  ha: number | null
  rate_per_ha: number
  total_qty: number | null
  bag_weight_kg: number | null
  row_width: number | null
  spreader_id: string | null
  confirmed: boolean
  date_applied: string | null
  actual_rate_per_ha: number | null
  actual_total_qty: number | null
}

export interface FertApplication {
  id: string
  organisation_id: string
  line_id: string
  confirmed: boolean
  date_applied: string
  actual_rate_per_ha: number | null
  actual_total_qty: number | null
  gps_lat: number | null
  gps_lng: number | null
  photo_url: string | null
  notes: string | null
  confirmed_by: string
  created_at: string
  _syncStatus?: 'pending' | 'synced'
  _photo?: string | null  // base64 data URL — stripped before upload
}

export interface SpreaderChartEntry {
  id: string
  spreader_id: string
  product_id: string
  width_m: number
  opening: number
  kg_per_ha: number
}

export interface FertSyncQueueItem {
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

export interface FertMeta {
  key: string
  value: any
}

// ── IndexedDB Schema ──────────────────────────────────────────────────────

interface FertDB extends DBSchema {
  orchards: {
    key: string
    value: FertOrchard
  }
  products: {
    key: string
    value: FertProduct
  }
  timings: {
    key: string
    value: FertTiming
  }
  dispatched_lines: {
    key: string
    value: FertDispatchedLine
    indexes: { 'by_timing': string; 'by_dispatch': string }
  }
  applications: {
    key: string
    value: FertApplication
    indexes: { 'by_line': string }
  }
  sync_queue: {
    key: number
    value: FertSyncQueueItem
    indexes: { 'by_synced': string }
  }
  meta: {
    key: string
    value: FertMeta
  }
  chart_entries: {
    key: string
    value: SpreaderChartEntry
    indexes: { 'by_spreader_product': [string, string] }
  }
}

// ── Database singleton ────────────────────────────────────────────────────

let _db: IDBPDatabase<FertDB> | null = null

export async function getFertDB(): Promise<IDBPDatabase<FertDB>> {
  if (_db) return _db

  _db = await openDB<FertDB>('farmscout-fert', 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('orchards')) {
        db.createObjectStore('orchards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('timings')) {
        db.createObjectStore('timings', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('dispatched_lines')) {
        const s = db.createObjectStore('dispatched_lines', { keyPath: 'line_id' })
        s.createIndex('by_timing', 'timing_id')
        s.createIndex('by_dispatch', 'dispatch_id')
      }
      if (!db.objectStoreNames.contains('applications')) {
        const s = db.createObjectStore('applications', { keyPath: 'id' })
        s.createIndex('by_line', 'line_id')
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
      if (!db.objectStoreNames.contains('chart_entries')) {
        const s = db.createObjectStore('chart_entries', { keyPath: 'id' })
        s.createIndex('by_spreader_product', ['spreader_id', 'product_id'])
      }
    },
  })

  return _db
}

// ── Generic helpers ───────────────────────────────────────────────────────

export async function fertGetAll<S extends keyof FertDB>(store: S): Promise<FertDB[S]['value'][]> {
  const db = await getFertDB()
  return (db as any).getAll(store)
}

export async function fertGetAllByIndex<S extends keyof FertDB>(
  store: S,
  index: string,
  query: any
): Promise<FertDB[S]['value'][]> {
  const db = await getFertDB()
  return (db as any).getAllFromIndex(store, index, query)
}

export async function fertGet<S extends keyof FertDB>(
  store: S,
  key: string | number
): Promise<FertDB[S]['value'] | undefined> {
  const db = await getFertDB()
  return (db as any).get(store, key)
}

export async function fertPut<S extends keyof FertDB>(store: S, record: FertDB[S]['value']): Promise<void> {
  const db = await getFertDB()
  await (db as any).put(store, record)
}

export async function fertPutMany<S extends keyof FertDB>(store: S, records: FertDB[S]['value'][]): Promise<void> {
  const db = await getFertDB()
  const tx = (db as any).transaction(store, 'readwrite')
  await Promise.all([...records.map((r: any) => tx.store.put(r)), tx.done])
}

// ── Sync queue helpers ────────────────────────────────────────────────────

export async function fertAddToQueue(item: Omit<FertSyncQueueItem, 'id'>): Promise<void> {
  const db = await getFertDB()
  await db.add('sync_queue', item as FertSyncQueueItem)
}

export async function fertGetPendingQueue(): Promise<FertSyncQueueItem[]> {
  try {
    const db = await getFertDB()
    const all = await db.getAll('sync_queue')
    return all.filter(item => item.synced === false)
  } catch {
    return []
  }
}

export async function fertDeleteFromQueue(id: number): Promise<void> {
  const db = await getFertDB()
  await db.delete('sync_queue', id)
}

// ── Meta store helpers ────────────────────────────────────────────────────

export async function fertGetMeta(key: string): Promise<any> {
  const db = await getFertDB()
  const record = await db.get('meta', key)
  return record?.value ?? null
}

export async function fertSetMeta(key: string, value: any): Promise<void> {
  const db = await getFertDB()
  await db.put('meta', { key, value })
}

import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ── Types ─────────────────────────────────────────────────────────────────

export interface PackshedPackhouse {
  id: string
  code: string
  name: string
  farm_id: string
}

export interface PackshedOrchard {
  id: string
  name: string
  orchard_nr: number | null
  farm_id: string
}

export interface WeighRecord {
  id: string
  organisation_id: string
  packhouse_id: string
  orchard_id: string | null
  weigh_date: string        // YYYY-MM-DD
  seq: number
  category: 'pack' | 'juice' | 'rot'
  gross_weight_kg: number
  bin_type: 'plastic' | 'wood'
  tare_weight_kg: number
  net_weight_kg: number
  bin_count: number          // bins on scale (usually 2, rot=1)
  weighed_by: string | null
  _syncStatus?: string
}

export interface WeighSyncQueueItem {
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

// ── IndexedDB Schema ──────────────────────────────────────────────────────

interface WeighDB extends DBSchema {
  packhouses: { key: string; value: PackshedPackhouse }
  orchards: { key: string; value: PackshedOrchard }
  weigh_records: {
    key: string
    value: WeighRecord
    indexes: { 'by_date': string; 'by_category': string }
  }
  sync_queue: {
    key: number
    value: WeighSyncQueueItem
    indexes: { 'by_synced': string }
  }
}

// ── Database singleton ────────────────────────────────────────────────────

let _db: IDBPDatabase<WeighDB> | null = null

export async function getWeighDB(): Promise<IDBPDatabase<WeighDB>> {
  if (_db) return _db

  _db = await openDB<WeighDB>('farmscout-packshed-weigh', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('packhouses')) {
        db.createObjectStore('packhouses', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('orchards')) {
        db.createObjectStore('orchards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('weigh_records')) {
        const s = db.createObjectStore('weigh_records', { keyPath: 'id' })
        s.createIndex('by_date', 'weigh_date')
        s.createIndex('by_category', 'category')
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        const s = db.createObjectStore('sync_queue', {
          keyPath: 'id',
          autoIncrement: true,
        })
        s.createIndex('by_synced', 'synced')
      }
    },
  })

  return _db
}

// ── Generic helpers ───────────────────────────────────────────────────────

export async function weighGetAll<S extends keyof WeighDB>(store: S): Promise<WeighDB[S]['value'][]> {
  const db = await getWeighDB()
  return (db as any).getAll(store)
}

export async function weighPut<S extends keyof WeighDB>(store: S, record: WeighDB[S]['value']): Promise<void> {
  const db = await getWeighDB()
  await (db as any).put(store, record)
}

export async function weighPutMany<S extends keyof WeighDB>(store: S, records: WeighDB[S]['value'][]): Promise<void> {
  const db = await getWeighDB()
  const tx = (db as any).transaction(store, 'readwrite')
  await Promise.all([...records.map((r: any) => tx.store.put(r)), tx.done])
}

// ── Sync queue helpers ────────────────────────────────────────────────────

export async function weighAddToQueue(item: Omit<WeighSyncQueueItem, 'id'>): Promise<void> {
  const db = await getWeighDB()
  await db.add('sync_queue', item as WeighSyncQueueItem)
}

export async function weighGetPendingQueue(): Promise<WeighSyncQueueItem[]> {
  try {
    const db = await getWeighDB()
    const all = await db.getAll('sync_queue')
    return all.filter(item => item.synced === false)
  } catch {
    return []
  }
}

export async function weighDeleteFromQueue(id: number): Promise<void> {
  const db = await getWeighDB()
  await db.delete('sync_queue', id)
}

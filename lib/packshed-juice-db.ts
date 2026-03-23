import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ── Types ─────────────────────────────────────────────────────────────────

export interface JuicePackhouse {
  id: string
  code: string
  name: string
  farm_id: string
}

export interface JuiceOrchard {
  id: string
  name: string
  orchard_nr: number | null
  variety: string | null
  farm_id: string
}

export interface JuiceDefectType {
  id: string
  name: string
  name_af: string
  pest_id: string
  display_order: number
}

export interface JuiceSample {
  id: string
  organisation_id: string
  packhouse_id: string
  orchard_id: string | null
  sample_date: string        // YYYY-MM-DD
  sample_size: number
  sampled_by: string | null
  notes: string
  defects: JuiceDefectCount[]
  _syncStatus?: string
}

export interface JuiceDefectCount {
  pest_id: string
  name: string
  count: number
}

export interface JuiceSyncQueueItem {
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

interface JuiceDB extends DBSchema {
  packhouses: { key: string; value: JuicePackhouse }
  orchards: { key: string; value: JuiceOrchard }
  defect_types: { key: string; value: JuiceDefectType }
  juice_samples: {
    key: string
    value: JuiceSample
    indexes: { 'by_date': string }
  }
  sync_queue: {
    key: number
    value: JuiceSyncQueueItem
    indexes: { 'by_synced': string }
  }
}

// ── Database singleton ────────────────────────────────────────────────────

let _db: IDBPDatabase<JuiceDB> | null = null

export async function getJuiceDB(): Promise<IDBPDatabase<JuiceDB>> {
  if (_db) return _db

  _db = await openDB<JuiceDB>('farmscout-packshed-juice', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('packhouses')) {
        db.createObjectStore('packhouses', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('orchards')) {
        db.createObjectStore('orchards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('defect_types')) {
        db.createObjectStore('defect_types', { keyPath: 'pest_id' })
      }
      if (!db.objectStoreNames.contains('juice_samples')) {
        const s = db.createObjectStore('juice_samples', { keyPath: 'id' })
        s.createIndex('by_date', 'sample_date')
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

export async function juiceGetAll<S extends keyof JuiceDB>(store: S): Promise<JuiceDB[S]['value'][]> {
  const db = await getJuiceDB()
  return (db as any).getAll(store)
}

export async function juicePut<S extends keyof JuiceDB>(store: S, record: JuiceDB[S]['value']): Promise<void> {
  const db = await getJuiceDB()
  await (db as any).put(store, record)
}

export async function juicePutMany<S extends keyof JuiceDB>(store: S, records: JuiceDB[S]['value'][]): Promise<void> {
  const db = await getJuiceDB()
  const tx = (db as any).transaction(store, 'readwrite')
  await Promise.all([...records.map((r: any) => tx.store.put(r)), tx.done])
}

// ── Sync queue helpers ────────────────────────────────────────────────────

export async function juiceAddToQueue(item: Omit<JuiceSyncQueueItem, 'id'>): Promise<void> {
  const db = await getJuiceDB()
  await db.add('sync_queue', item as JuiceSyncQueueItem)
}

export async function juiceGetPendingQueue(): Promise<JuiceSyncQueueItem[]> {
  try {
    const db = await getJuiceDB()
    const all = await db.getAll('sync_queue')
    return all.filter(item => item.synced === false)
  } catch {
    return []
  }
}

export async function juiceDeleteFromQueue(id: number): Promise<void> {
  const db = await getJuiceDB()
  await db.delete('sync_queue', id)
}

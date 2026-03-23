import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ── Types ─────────────────────────────────────────────────────────────────

export interface RainGauge {
  id: string
  farm_id: string
  name: string
  lat: number | null
  lng: number | null
}

export interface RainReading {
  id: string
  gauge_id: string
  reading_date: string   // YYYY-MM-DD
  value_mm: number
  _syncStatus?: string
}

export interface Dam {
  id: string
  farm_id: string
  name: string
  lat: number | null
  lng: number | null
  max_capacity_m3: number | null
}

export interface DamCapacityRow {
  id: string
  dam_id: string
  pen_no: number
  m3: number
  gallons: number
  pct: number
  sort_order: number
}

export interface DamLevelReading {
  id: string
  dam_id: string
  reading_date: string
  pen_no: number
  quarter: number
  computed_m3: number | null
  computed_gallons: number | null
  computed_pct: number | null
  _syncStatus?: string
}

export interface RainSyncQueueItem {
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

interface RainDB extends DBSchema {
  gauges: { key: string; value: RainGauge }
  readings: {
    key: string
    value: RainReading
    indexes: { 'by_gauge': string; 'by_date': string }
  }
  dams: { key: string; value: Dam }
  dam_capacity: { key: string; value: DamCapacityRow; indexes: { 'by_dam': string } }
  dam_readings: { key: string; value: DamLevelReading; indexes: { 'by_dam': string; 'by_date': string } }
  sync_queue: {
    key: number
    value: RainSyncQueueItem
    indexes: { 'by_synced': string }
  }
}

// ── Database singleton ────────────────────────────────────────────────────

let _db: IDBPDatabase<RainDB> | null = null

export async function getRainDB(): Promise<IDBPDatabase<RainDB>> {
  if (_db) return _db

  _db = await openDB<RainDB>('farmscout-rain', 2, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('gauges')) {
        db.createObjectStore('gauges', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('readings')) {
        const s = db.createObjectStore('readings', { keyPath: 'id' })
        s.createIndex('by_gauge', 'gauge_id')
        s.createIndex('by_date', 'reading_date')
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        const s = db.createObjectStore('sync_queue', {
          keyPath: 'id',
          autoIncrement: true,
        })
        s.createIndex('by_synced', 'synced')
      }
      // v2: dam level stores
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('dams')) {
          db.createObjectStore('dams', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('dam_capacity')) {
          const s = db.createObjectStore('dam_capacity', { keyPath: 'id' })
          s.createIndex('by_dam', 'dam_id')
        }
        if (!db.objectStoreNames.contains('dam_readings')) {
          const s = db.createObjectStore('dam_readings', { keyPath: 'id' })
          s.createIndex('by_dam', 'dam_id')
          s.createIndex('by_date', 'reading_date')
        }
      }
    },
  })

  return _db
}

// ── Generic helpers ───────────────────────────────────────────────────────

export async function rainGetAll<S extends keyof RainDB>(store: S): Promise<RainDB[S]['value'][]> {
  const db = await getRainDB()
  return (db as any).getAll(store)
}

export async function rainPut<S extends keyof RainDB>(store: S, record: RainDB[S]['value']): Promise<void> {
  const db = await getRainDB()
  await (db as any).put(store, record)
}

export async function rainPutMany<S extends keyof RainDB>(store: S, records: RainDB[S]['value'][]): Promise<void> {
  const db = await getRainDB()
  const tx = (db as any).transaction(store, 'readwrite')
  await Promise.all([...records.map((r: any) => tx.store.put(r)), tx.done])
}

// ── Sync queue helpers ────────────────────────────────────────────────────

export async function rainAddToQueue(item: Omit<RainSyncQueueItem, 'id'>): Promise<void> {
  const db = await getRainDB()
  await db.add('sync_queue', item as RainSyncQueueItem)
}

export async function rainGetPendingQueue(): Promise<RainSyncQueueItem[]> {
  try {
    const db = await getRainDB()
    const all = await db.getAll('sync_queue')
    return all.filter(item => item.synced === false)
  } catch {
    return []
  }
}

export async function rainDeleteFromQueue(id: number): Promise<void> {
  const db = await getRainDB()
  await db.delete('sync_queue', id)
}

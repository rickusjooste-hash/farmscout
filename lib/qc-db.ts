import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ── Types ─────────────────────────────────────────────────────────────────

export interface QcEmployee {
  id: string
  organisation_id: string
  farm_id: string
  employee_nr: string
  full_name: string
  team?: string | null
  rfid_tag?: string | null
  is_active: boolean
  [key: string]: any
}

export interface QcSizeBin {
  id: string
  commodity_id: string
  label: string
  weight_min_g: number
  weight_max_g: number
  display_order: number
  is_active: boolean
}

export interface QcIssue {
  id: string
  commodity_id: string
  pest_id: string
  category: 'qc_issue' | 'picking_issue'
  display_name: string
  display_name_af?: string | null
  display_order: number
}

export interface QcOrchard {
  id: string
  name: string
  variety?: string | null
  farm_id: string
  commodity_id: string
  commodity_name?: string | null
  boundary: any | null  // GeoJSON geometry or null
}

export interface QcBagSession {
  id: string
  organisation_id: string
  farm_id: string
  orchard_id: string
  employee_id: string
  runner_id?: string | null
  collection_lat?: number | null
  collection_lng?: number | null
  collected_at?: string | null
  bag_seq?: number | null
  qc_worker_id?: string | null
  sampled_at?: string | null
  status: 'collected' | 'sampled'
  notes?: string | null
  created_at?: string
  _syncStatus?: 'pending' | 'synced'
  // Denormalized for offline display
  _employee_name?: string
  _orchard_name?: string
}

export interface QcFruit {
  id: string
  session_id: string
  organisation_id: string
  seq: number
  weight_g: number
  size_bin_id?: string | null
  created_at?: string
  _syncStatus?: 'pending' | 'synced'
}

export interface QcFruitIssue {
  id: string
  fruit_id: string
  pest_id: string
  organisation_id: string
  created_at?: string
  _syncStatus?: 'pending' | 'synced'
}

export interface QcBagIssue {
  id: string
  session_id: string
  pest_id: string
  organisation_id: string
  count: number
  created_at?: string
  _syncStatus?: 'pending' | 'synced'
  _photo?: string | null   // base64 data URL for unknown issues — stripped before upload, uploaded to storage separately
}

export interface QcPickingSession {
  id: string
  organisation_id: string
  farm_id: string
  orchard_id: string
  team?: string | null
  qc_worker_id: string
  inspected_at: string
  tree_count: number
  total_drops: number
  total_shiners: number
  gps_lat?: number | null
  gps_lng?: number | null
  notes?: string | null
  created_at?: string
  _syncStatus?: 'pending' | 'synced'
  _orchard_name?: string
}

export interface QcPickingTree {
  id: string
  session_id: string
  organisation_id: string
  tree_nr: number
  drops: number
  shiners: number
  created_at?: string
  _syncStatus?: 'pending' | 'synced'
}

export interface QcMeta {
  key: string
  value: any
}

export interface QcSyncQueueItem {
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

interface QcDB extends DBSchema {
  employees: {
    key: string
    value: QcEmployee
    indexes: { 'by_farm': string }
  }
  size_bins: {
    key: string
    value: QcSizeBin
    indexes: { 'by_commodity': string }
  }
  qc_issues: {
    key: string
    value: QcIssue
    indexes: { 'by_commodity': string }
  }
  orchards: {
    key: string
    value: QcOrchard
  }
  bag_sessions: {
    key: string
    value: QcBagSession
    indexes: { 'by_status': string; 'by_farm': string }
  }
  bag_fruit: {
    key: string
    value: QcFruit
    indexes: { 'by_session': string }
  }
  fruit_issues: {
    key: string
    value: QcFruitIssue
    indexes: { 'by_fruit': string }
  }
  bag_issues: {
    key: string
    value: QcBagIssue
    indexes: { 'by_session': string }
  }
  picking_sessions: {
    key: string
    value: QcPickingSession
    indexes: { 'by_farm': string }
  }
  picking_trees: {
    key: string
    value: QcPickingTree
    indexes: { 'by_session': string }
  }
  sync_queue: {
    key: number
    value: QcSyncQueueItem
    indexes: { 'by_synced': string }
  }
  meta: {
    key: string
    value: QcMeta
  }
}

// ── Database singleton ────────────────────────────────────────────────────

let _db: IDBPDatabase<QcDB> | null = null

export async function getQcDB(): Promise<IDBPDatabase<QcDB>> {
  if (_db) return _db

  _db = await openDB<QcDB>('farmscout-qc', 3, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('employees')) {
        const s = db.createObjectStore('employees', { keyPath: 'id' })
        s.createIndex('by_farm', 'farm_id')
      }
      if (!db.objectStoreNames.contains('size_bins')) {
        const s = db.createObjectStore('size_bins', { keyPath: 'id' })
        s.createIndex('by_commodity', 'commodity_id')
      }
      if (!db.objectStoreNames.contains('qc_issues')) {
        const s = db.createObjectStore('qc_issues', { keyPath: 'id' })
        s.createIndex('by_commodity', 'commodity_id')
      }
      if (!db.objectStoreNames.contains('orchards')) {
        db.createObjectStore('orchards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('bag_sessions')) {
        const s = db.createObjectStore('bag_sessions', { keyPath: 'id' })
        s.createIndex('by_status', 'status')
        s.createIndex('by_farm', 'farm_id')
      }
      if (!db.objectStoreNames.contains('bag_fruit')) {
        const s = db.createObjectStore('bag_fruit', { keyPath: 'id' })
        s.createIndex('by_session', 'session_id')
      }
      if (!db.objectStoreNames.contains('fruit_issues')) {
        const s = db.createObjectStore('fruit_issues', { keyPath: 'id' })
        s.createIndex('by_fruit', 'fruit_id')
      }
      if (!db.objectStoreNames.contains('bag_issues')) {
        const s = db.createObjectStore('bag_issues', { keyPath: 'id' })
        s.createIndex('by_session', 'session_id')
      }
      if (!db.objectStoreNames.contains('picking_sessions')) {
        const s = db.createObjectStore('picking_sessions', { keyPath: 'id' })
        s.createIndex('by_farm', 'farm_id')
      }
      if (!db.objectStoreNames.contains('picking_trees')) {
        const s = db.createObjectStore('picking_trees', { keyPath: 'id' })
        s.createIndex('by_session', 'session_id')
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

export async function qcGetAll<S extends keyof QcDB>(store: S): Promise<QcDB[S]['value'][]> {
  const db = await getQcDB()
  return (db as any).getAll(store)
}

export async function qcGetAllByIndex<S extends keyof QcDB>(
  store: S,
  index: string,
  query: any
): Promise<QcDB[S]['value'][]> {
  const db = await getQcDB()
  return (db as any).getAllFromIndex(store, index, query)
}

export async function qcGet<S extends keyof QcDB>(
  store: S,
  key: string | number
): Promise<QcDB[S]['value'] | undefined> {
  const db = await getQcDB()
  return (db as any).get(store, key)
}

export async function qcPut<S extends keyof QcDB>(store: S, record: QcDB[S]['value']): Promise<void> {
  const db = await getQcDB()
  await (db as any).put(store, record)
}

export async function qcPutMany<S extends keyof QcDB>(store: S, records: QcDB[S]['value'][]): Promise<void> {
  const db = await getQcDB()
  const tx = (db as any).transaction(store, 'readwrite')
  await Promise.all([...records.map((r: any) => tx.store.put(r)), tx.done])
}

// ── Sync queue helpers ────────────────────────────────────────────────────

export async function qcAddToQueue(item: Omit<QcSyncQueueItem, 'id'>): Promise<void> {
  const db = await getQcDB()
  await db.add('sync_queue', item as QcSyncQueueItem)
}

export async function qcGetPendingQueue(): Promise<QcSyncQueueItem[]> {
  try {
    const db = await getQcDB()
    const all = await db.getAll('sync_queue')
    return all.filter(item => item.synced === false)
  } catch {
    return []
  }
}

export async function qcDeleteFromQueue(id: number): Promise<void> {
  const db = await getQcDB()
  await db.delete('sync_queue', id)
}

// ── Meta store helpers (for daily bag seq counter) ────────────────────────

export async function qcGetMeta(key: string): Promise<any> {
  const db = await getQcDB()
  const record = await db.get('meta', key)
  return record?.value ?? null
}

export async function qcSetMeta(key: string, value: any): Promise<void> {
  const db = await getQcDB()
  await db.put('meta', { key, value })
}

// ── Orchard GPS matching (offline point-in-polygon) ───────────────────────

/**
 * Find the first orchard whose boundary polygon contains the given GPS point.
 * Uses Turf.js booleanPointInPolygon for client-side offline matching.
 * Returns null if no match (runner outside all orchard boundaries).
 */
export async function matchOrchardFromGPS(
  lat: number,
  lng: number
): Promise<QcOrchard | null> {
  const orchards = await qcGetAll('orchards')

  for (const orchard of orchards) {
    if (!orchard.boundary) continue
    try {
      // Dynamically import turf to keep initial bundle small
      const { default: booleanPointInPolygon } = await import('@turf/boolean-point-in-polygon')
      const { point: turfPoint } = await import('@turf/helpers')
      const pt = turfPoint([lng, lat])
      if (booleanPointInPolygon(pt, orchard.boundary)) {
        return orchard
      }
    } catch {
      // Skip if boundary GeoJSON is malformed
    }
  }

  return null
}

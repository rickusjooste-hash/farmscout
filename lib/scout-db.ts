import { openDB, DBSchema, IDBPDatabase } from 'idb'

// This describes the shape of our local database
interface FarmScoutDB extends DBSchema {
  orchards: {
    key: string
    value: {
      id: string
      name: string
      updated_at?: string
      [key: string]: any
    }
  }
  pests: {
    key: string
    value: {
      id: string
      name?: string
      common_name?: string
      scientific_name?: string
      updated_at?: string
      [key: string]: any
    }
  }
  traps: {
    key: string
    value: {
      id: string
      trap_nr: number
      next_trap_id: string | null
      zone_id: string | null
      pest_id: string | null
      lure_type_id: string | null
      orchard_id: string | null
      farm_id: string
      seq: number | null
      is_active: boolean
      [key: string]: any
    }
  }
  zones: {
    key: string
    value: {
      id: string
      name: string
      [key: string]: any
    }
  }
  lure_types: {
    key: string
    value: {
      id: string
      name: string
      rebait_weeks: number | null
      [key: string]: any
    }
  }
  inspection_sessions: {
    key: string
    value: {
      id: string
      orchard_id: string
      orchard_name?: string
      block_name?: string
      scout_id: string
      status: string
      started_at: string
      _syncStatus?: string
      _treeCount?: number
      [key: string]: any
    }
    indexes: { 'by_status': string }
  }
  inspection_trees: {
    key: string
    value: {
      id: string
      session_id: string
      tree_number: number
      label?: string
      _syncStatus?: string
      [key: string]: any
    }
    indexes: { 'by_session': string }
  }
  inspection_observations: {
    key: string
    value: {
      id: string
      tree_id: string
      session_id: string
      pest_id: string
      pest_name?: string
      count: number
      severity: string
      _syncStatus?: string
      [key: string]: any
    }
    indexes: { 'by_tree': string }
  }
  trap_inspections: {
    key: string
    value: {
      id: string
      session_id: string
      trap_id?: string
      trap_type?: string
      _syncStatus?: string
      [key: string]: any
    }
    indexes: { 'by_session': string }
  }
  trap_counts: {
    key: string
    value: {
      id: string
      trap_inspection_id: string
      pest_id: string
      count: number
      _syncStatus?: string
      [key: string]: any
    }
    indexes: { 'by_trap_inspection': string }
  }
  sync_queue: {
    key: number
    value: {
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
    indexes: { 'by_synced': string }
  }
}

let _db: IDBPDatabase<FarmScoutDB> | null = null

export async function getScoutDB(): Promise<IDBPDatabase<FarmScoutDB>> {
  if (_db) return _db

  _db = await openDB<FarmScoutDB>('farmscout-local', 2,  {
    upgrade(db) {
      // Reference data (downloaded from Supabase)
      if (!db.objectStoreNames.contains('orchards')) {
        db.createObjectStore('orchards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('pests')) {
        db.createObjectStore('pests', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('traps')) {
        db.createObjectStore('traps', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('zones')) {
        db.createObjectStore('zones', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('lure_types')) {
        db.createObjectStore('lure_types', { keyPath: 'id' })
      }

      // Field data (created on device, uploaded later)
      if (!db.objectStoreNames.contains('inspection_sessions')) {
        const s = db.createObjectStore('inspection_sessions', { keyPath: 'id' })
        s.createIndex('by_status', 'status')
      }
      if (!db.objectStoreNames.contains('inspection_trees')) {
        const s = db.createObjectStore('inspection_trees', { keyPath: 'id' })
        s.createIndex('by_session', 'session_id')
      }
      if (!db.objectStoreNames.contains('inspection_observations')) {
        const s = db.createObjectStore('inspection_observations', { keyPath: 'id' })
        s.createIndex('by_tree', 'tree_id')
      }
      if (!db.objectStoreNames.contains('trap_inspections')) {
        const s = db.createObjectStore('trap_inspections', { keyPath: 'id' })
        s.createIndex('by_session', 'session_id')
      }
      if (!db.objectStoreNames.contains('trap_counts')) {
        const s = db.createObjectStore('trap_counts', { keyPath: 'id' })
        s.createIndex('by_trap_inspection', 'trap_inspection_id')
      }

      // Sync queue (pending uploads)
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

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function getAll<T extends keyof FarmScoutDB>(
  storeName: any
): Promise<any[]> {
  const db = await getScoutDB()
  return db.getAll(storeName) as any
}

export async function getAllByIndex<T extends keyof FarmScoutDB>(
  storeName: any,
  indexName: any,
  query: any
): Promise<any[]> {
  const db = await getScoutDB()
  return (db as any).getAllFromIndex(storeName, indexName, query)
}

export async function getOne<T extends keyof FarmScoutDB>(
  storeName: any,
  key: string | number
): Promise<any> {
  const db = await getScoutDB()
  return (db as any).get(storeName, key)
}

export async function upsertRecord<T extends keyof FarmScoutDB>(
  storeName: any,
  record: any
): Promise<void> {
  const db = await getScoutDB()
  await (db as any).put(storeName, record)
}

export async function upsertMany<T extends keyof FarmScoutDB>(
  storeName: any,
  records: any[]
): Promise<void> {
  const db = await getScoutDB()
  const tx = (db as any).transaction(storeName, 'readwrite')
  await Promise.all([
    ...records.map((r) => tx.store.put(r)),
    tx.done,
  ])
}


export async function getPendingQueue() {
  try {
    const db = await getScoutDB()
    const all = await db.getAll('sync_queue')
    return all.filter(item => item.synced === false)
  } catch {
    return []
  }
}

export async function deleteFromQueue(id: number) {
  const db = await getScoutDB()
  await db.delete('sync_queue', id)
}

export async function addToQueue(item: Omit<FarmScoutDB['sync_queue']['value'], 'id'>) {
  const db = await getScoutDB()
  await db.add('sync_queue', item as any)
}
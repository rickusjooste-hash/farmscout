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
  commodities: {
    key: string
    value: {
      id: string
      code: string
      name: string
      description?: string
      [key: string]: any
    }
  }
  commodity_pests: {
    key: string
    value: {
      id: string
      commodity_id: string
      pest_id: string
      observation_method: 'present_absent' | 'count' | 'leaf_inspection'
      display_order: number
      is_active: boolean
      display_name?: string
      [key: string]: any
    }
    indexes: { 'by_commodity': string }
  }
  farm_pest_config: {
    key: string  // commodity_pest_id — unique per farm (only this farm's rows stored)
    value: {
      id: string
      commodity_pest_id: string
      farm_id: string
      is_active: boolean
      [key: string]: any
    }
  }
  scout_zone_assignments: {
    key: string
    value: {
      id: string
      user_id: string
      zone_id: string
      assigned_from: string    // ISO date
      assigned_until?: string  // ISO date, null = open-ended
      [key: string]: any
    }
    indexes: { 'by_zone': string }
  }
  photos: {
    key: string  // = tree_id
    value: {
      id: string
      data: string
      mimeType: string
      synced: boolean
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
      has_photo?: boolean
      [key: string]: any
    }
    indexes: { 'by_synced': string }
  }
}

let _db: IDBPDatabase<FarmScoutDB> | null = null

export async function getScoutDB(): Promise<IDBPDatabase<FarmScoutDB>> {
  if (_db) return _db

  _db = await openDB<FarmScoutDB>('farmscout-local', 3, {
    upgrade(db, oldVersion) {
      // Version 1 & 2 stores (always create if missing)
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
      if (!db.objectStoreNames.contains('sync_queue')) {
        const s = db.createObjectStore('sync_queue', {
          keyPath: 'id',
          autoIncrement: true,
        })
        s.createIndex('by_synced', 'synced')
      }

      // Version 3 stores
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('commodities')) {
          db.createObjectStore('commodities', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('commodity_pests')) {
          const s = db.createObjectStore('commodity_pests', { keyPath: 'id' })
          s.createIndex('by_commodity', 'commodity_id')
        }
        if (!db.objectStoreNames.contains('farm_pest_config')) {
          db.createObjectStore('farm_pest_config', { keyPath: 'commodity_pest_id' })
        }
        if (!db.objectStoreNames.contains('scout_zone_assignments')) {
          const s = db.createObjectStore('scout_zone_assignments', { keyPath: 'id' })
          s.createIndex('by_zone', 'zone_id')
        }
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' })
        }
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

export async function getPendingPhotos(): Promise<any[]> {
  const db = await getScoutDB()
  return (await db.getAll('photos')).filter(p => !p.synced)
}

export async function markPhotoSynced(treeId: string): Promise<void> {
  const db = await getScoutDB()
  const p = await db.get('photos', treeId)
  if (p) await db.put('photos', { ...p, synced: true })
}

'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'

interface Scout {
  id: string
  full_name: string
  email: string
  first_trap_id: string | null
  farm_id: string
  is_active: boolean
  route_length: number | null
}

interface RouteTrap {
  stop_number: number
  trap_id: string
  trap_nr: number | null
  zone_name: string
  pest_name: string
  lure_name: string
  next_trap_id: string | null
}

interface AvailableTrap {
  trap_id: string
  trap_nr: number | null
  zone_name: string
  pest_name: string
  orchard_name: string
}

export default function ScoutsPage() {
  const supabase = createClient()
  const [scouts, setScouts] = useState<Scout[]>([])
  const [selectedScout, setSelectedScout] = useState<Scout | null>(null)
  const [route, setRoute] = useState<RouteTrap[]>([])
  const [availableTraps, setAvailableTraps] = useState<AvailableTrap[]>([])
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAvailable, setShowAvailable] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [insertAfterTrap, setInsertAfterTrap] = useState<RouteTrap | null>(null)

  useEffect(() => {
    supabase
      .from('scouts')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => {
        setScouts(data || [])
        if (data && data.length > 0) setSelectedScout(data[0])
      })
  }, [])

  useEffect(() => {
    if (!selectedScout) return
    loadRoute()
    setShowAvailable(false)
    setSearchTerm('')
  }, [selectedScout])

  async function loadRoute() {
    if (!selectedScout?.first_trap_id) {
      setRoute([])
      return
    }
    setLoadingRoute(true)
    const { data } = await supabase.rpc('get_scout_route', {
      first_trap_id: selectedScout.first_trap_id
    })
    setRoute(data || [])
    setLoadingRoute(false)
  }

  async function loadAvailableTraps() {
    if (!selectedScout) return
    setLoadingAvailable(true)
    console.log('Loading available traps for scout:', selectedScout.id, selectedScout.full_name)
    const { data, error } = await supabase.rpc('get_available_traps', {
      scout_id: selectedScout.id
    })
    console.log('Available traps count:', data?.length)
    console.log('First trap:', data?.[0])
    console.log('Error:', error)
    setAvailableTraps(data || [])
    setLoadingAvailable(false)
    setShowAvailable(true)
  }

  async function addTrap(trapId: string) {
    if (!selectedScout || saving) return
    setSaving(true)

    if (insertAfterTrap) {
      // Insert in middle
      await supabase.rpc('insert_trap_after', {
        after_trap_id: insertAfterTrap.trap_id,
        new_trap_id: trapId,
      })
      setInsertAfterTrap(null)
    } else {
      // Add to end
      await supabase.rpc('add_trap_to_route', {
        scout_id: selectedScout.id,
        new_trap_id: trapId,
      })
    }

    await loadRoute()
    const { data } = await supabase.rpc('get_available_traps', {
      scout_id: selectedScout.id
    })
    setAvailableTraps(data || [])
    setSaving(false)
  }

  async function removeLastTrap() {
    if (!selectedScout || saving || route.length === 0) return
    setSaving(true)
    await supabase.rpc('remove_last_trap_from_route', {
      scout_id: selectedScout.id
    })
    await loadRoute()
    // Refresh available traps if panel is open
    if (showAvailable) {
      const { data } = await supabase.rpc('get_available_traps', {
        scout_id: selectedScout.id
      })
      setAvailableTraps(data || [])
    }
    setSaving(false)
  }

  const firstName = (name: string) => name.split(' ')[0]

  const filteredAvailable = availableTraps.filter(t =>
    !searchTerm ||
    t.trap_nr?.toString().includes(searchTerm) ||
    t.zone_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.pest_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.orchard_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f1eb; }
        .app { display: flex; min-height: 100vh; }
        .sidebar {
          width: 220px; min-height: 100vh; background: #1c3a2a;
          padding: 32px 20px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
        }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #a8d5a2; margin-bottom: 32px; }
        .logo span { color: #fff; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 8px; color: #8aab96; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .nav-item:hover { background: #2a4f38; color: #fff; }
        .nav-item.active { background: #2a4f38; color: #a8d5a2; }
        .sidebar-footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #2a4f38; font-size: 12px; color: #4a7a5a; }
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 100vh; }
        .top-bar {
          padding: 16px 24px; background: #fff; border-bottom: 1px solid #e8e4dc;
          display: flex; align-items: center; gap: 16px; flex-shrink: 0; flex-wrap: wrap;
        }
        .page-title { font-family: 'DM Serif Display', serif; font-size: 20px; color: #1c3a2a; }
        .divider { width: 1px; height: 24px; background: #e8e4dc; flex-shrink: 0; }
        .filter-label { font-size: 11px; color: #9aaa9f; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
        .pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .pill {
          padding: 6px 16px; border-radius: 20px; border: 1.5px solid #e0ddd6;
          background: #fff; color: #6a7a70; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif;
        }
        .pill:hover { border-color: #2a6e45; color: #2a6e45; }
        .pill.active { background: #1c3a2a; color: #a8d5a2; border-color: #1c3a2a; }
        .content { flex: 1; padding: 24px; display: flex; gap: 24px; align-items: flex-start; overflow: visible; }
        .left-panel { flex: 1; min-width: 0; overflow-y: auto; max-height: calc(100vh - 80px); }
        .right-panel { width: 340px; flex-shrink: 0; position: sticky; top: 24px; max-height: calc(100vh - 80px); overflow-y: auto; }
        .panel-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px;
        }
        .panel-title { font-family: 'DM Serif Display', serif; font-size: 18px; color: #1c3a2a; }
        .panel-sub { font-size: 12px; color: #9aaa9f; margin-top: 2px; }
        .btn {
          padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
          border: none;
        }
        .btn-primary { background: #1c3a2a; color: #a8d5a2; }
        .btn-primary:hover { background: #2a4f38; }
        .btn-danger { background: #fdf0ee; color: #e85a4a; border: 1px solid #f5c5be; }
        .btn-danger:hover { background: #fde0dc; }
        .btn-secondary { background: #f4f1eb; color: #3a4a40; border: 1px solid #e0ddd6; }
        .btn-secondary:hover { background: #e8e4dc; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .route-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e8e4dc; }
        .route-table th {
          padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.8px; color: #9aaa9f;
          background: #f9f7f3; border-bottom: 1px solid #e8e4dc;
        }
        .route-table td { padding: 12px 16px; font-size: 13px; color: #2a3a30; border-bottom: 1px solid #f4f1eb; }
        .route-table tr:last-child td { border-bottom: none; }
        .route-table tr:hover .insert-btn { opacity: 1 !important; }
        .insert-btn:hover { background: #f0f7f2 !important; border-color: #2a6e45 !important; }
        .route-table tr:hover td { background: #f9f7f3; }
        .stop-nr {
          width: 28px; height: 28px; border-radius: 50%; background: #1c3a2a;
          color: #a8d5a2; display: inline-flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
        }
        .last-stop-nr {
          width: 28px; height: 28px; border-radius: 50%; background: #f0a500;
          color: #000; display: inline-flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
        }
        .badge-green { display: inline-flex; align-items: center; gap: 4px; color: #4caf72; font-size: 11px; font-weight: 600; }
        .badge-end { display: inline-flex; align-items: center; gap: 4px; color: #6b7fa8; font-size: 11px; font-weight: 600; background: #eef0f7; padding: 2px 8px; border-radius: 20px; }
        .badge-broken { display: inline-flex; align-items: center; gap: 4px; color: #e85a4a; font-size: 11px; font-weight: 600; background: #fdf0ee; padding: 2px 8px; border-radius: 20px; }
        .available-panel { background: #fff; border-radius: 12px; border: 1px solid #e8e4dc; overflow: hidden; }
        .available-header { padding: 16px; border-bottom: 1px solid #e8e4dc; }
        .available-title { font-size: 14px; font-weight: 600; color: #1c3a2a; margin-bottom: 8px; }
        .search-input {
          width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1c3a2a;
          background: #f9f7f3; outline: none;
        }
        .search-input:focus { border-color: #2a6e45; }
        .available-list { max-height: 500px; overflow-y: auto; }
        .available-item {
          padding: 12px 16px; border-bottom: 1px solid #f4f1eb; cursor: pointer;
          transition: background 0.1s; display: flex; justify-content: space-between; align-items: center;
        }
        .available-item:last-child { border-bottom: none; }
        .available-item:hover { background: #f4f1eb; }
        .available-item-name { font-size: 13px; font-weight: 600; color: #1c3a2a; }
        .available-item-sub { font-size: 11px; color: #9aaa9f; margin-top: 2px; }
        .add-btn {
          width: 24px; height: 24px; border-radius: 50%; background: #1c3a2a;
          color: #a8d5a2; border: none; cursor: pointer; font-size: 16px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .loading { padding: 48px; text-align: center; color: #9aaa9f; font-size: 14px; }
        .empty { padding: 48px; text-align: center; color: #9aaa9f; font-size: 14px; }
        .actions { display: flex; gap: 8px; margin-bottom: 16px; }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item"><span>🌳</span> Orchards</a>
          <a className="nav-item"><span>🐛</span> Pests</a>
          <a className="nav-item"><span>🪤</span> Traps</a>
          <a className="nav-item"><span>🔍</span> Inspections</a>
          <a href="/scouts" className="nav-item active"><span>👷</span> Scouts</a>
          <a href="/scouts/new" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>➕</span> New Scout</a>
          <a href="/scouts/sections" className="nav-item" style={{ paddingLeft: 28, fontSize: 13 }}><span>🗂️</span> Sections</a>
          <div className="sidebar-footer">
            Mouton's Valley Group<br />
            <span style={{ color: '#2a6e45' }}>●</span> Connected
            <br />
            <button onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }} style={{
              marginTop: 10, background: 'none', border: '1px solid #2a4f38',
              color: '#6aaa80', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
            }}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="main">
          <div className="top-bar">
            <div className="page-title">Scout Routes</div>
            <div className="divider" />
            <span className="filter-label">Scout</span>
            <div className="pills">
              {scouts.map(s => (
                <button
                  key={s.id}
                  className={`pill${selectedScout?.id === s.id ? ' active' : ''}`}
                  onClick={() => setSelectedScout(s)}
                >
                  {firstName(s.full_name)}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <a href="/scouts/new" style={{
                display: 'inline-block', padding: '7px 16px', borderRadius: 8,
                background: '#1c3a2a', color: '#a8d5a2', fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
              }}>
                + New Scout
              </a>
            </div>
          </div>

          <div className="content">
            {/* Left — Route list */}
            <div className="left-panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title">
                    {selectedScout?.full_name}'s Route
                  </div>
                  <div className="panel-sub">
                    {loadingRoute ? 'Loading...' : `${route.length} traps in route`}
                  </div>
                </div>
              </div>

              <div className="actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (showAvailable) {
                      setShowAvailable(false)
                      setInsertAfterTrap(null)
                    } else {
                      loadAvailableTraps()
                    }
                  }}
                  disabled={saving}
                >
                  {showAvailable ? '✕ Close' : '+ Add Trap'}
                </button>
                {route.length > 0 && (
                  <button
                    className="btn btn-danger"
                    onClick={removeLastTrap}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : '− Remove Last Trap'}
                  </button>
                )}
              </div>

              {loadingRoute ? (
                <div className="loading">⏳ Loading route...</div>
              ) : route.length === 0 ? (
                <div className="empty">No route found. Add traps using the button above.</div>
              ) : (
                <table className="route-table">
                  <thead>
                    <tr>
                      <th>Stop</th>
                      <th>Trap #</th>
                      <th>Zone</th>
                      <th>Pest</th>
                      <th>Lure</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {route.map((trap) => (
                      <tr key={trap.trap_id}>
                        <td>
                          {trap.stop_number === route.length ? (
                            <div className="last-stop-nr">{trap.stop_number}</div>
                          ) : (
                            <div className="stop-nr">{trap.stop_number}</div>
                          )}
                        </td>
                        <td><strong>{trap.trap_nr || '—'}</strong></td>
                        <td>{trap.zone_name || '—'}</td>
                        <td>{trap.pest_name || '—'}</td>
                        <td>{trap.lure_name || '—'}</td>
                        <td>
                          {trap.next_trap_id ? (
                            <span className="badge-green">✓ Linked</span>
                          ) : trap.stop_number === route.length ? (
                            <span className="badge-end">⚑ End of route</span>
                          ) : (
                            <span className="badge-broken">⚠ Chain broken</span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setInsertAfterTrap(trap)
                              if (!showAvailable) loadAvailableTraps()
                              setShowAvailable(true)
                            }}
                            style={{
                              background: 'none',
                              border: '1.5px solid #e0ddd6',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              cursor: 'pointer',
                              fontSize: 16,
                              color: '#2a6e45',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0,
                              transition: 'opacity 0.1s',
                            }}
                            className="insert-btn"
                            title={`Insert trap after stop ${trap.stop_number}`}
                          >
                            +
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right — Available traps */}
            {showAvailable && (
              <div className="right-panel">
                <div className="available-panel">
                  <div className="available-header">
                    <div className="available-title">
                      {insertAfterTrap
                        ? `Insert after Stop ${insertAfterTrap.stop_number} (Trap #${insertAfterTrap.trap_nr})`
                        : 'Available Traps'
                      }
                      {!loadingAvailable && (
                        <span style={{ color: '#9aaa9f', fontWeight: 400, marginLeft: 6 }}>
                          ({filteredAvailable.length})
                        </span>
                      )}
                    </div>
                    <input
                      className="search-input"
                      placeholder="Search by trap #, zone, pest..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="available-list">
                    {loadingAvailable ? (
                      <div className="loading">⏳ Loading...</div>
                    ) : filteredAvailable.length === 0 ? (
                      <div className="empty">No available traps found.</div>
                    ) : (
                      filteredAvailable.map(t => (
                        <div
                          key={t.trap_id}
                          className="available-item"
                          onClick={() => addTrap(t.trap_id)}
                        >
                          <div>
                            <div className="available-item-name">
                              Trap #{t.trap_nr || '?'} · {t.orchard_name}
                            </div>
                            <div className="available-item-sub">
                              {t.zone_name} · {t.pest_name}
                            </div>
                          </div>
                          <button className="add-btn" disabled={saving}>+</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
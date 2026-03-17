'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useMemo } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'

interface Farm { id: string; code: string; full_name: string }
interface Orchard {
  id: string; name: string; orchard_nr: number | null
  variety: string | null; variety_group: string | null; rootstock: string | null
  ha: number | null; year_planted: number | null
  commodity_id: string; farm_id: string
  commodities: { code: string; name: string } | null
}

export default function ReportPickerPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes, allowed } = usePageGuard()
  const supabase = createClient()
  const modules = useOrgModules()

  const [farms, setFarms] = useState<Farm[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [loading, setLoading] = useState(true)

  // Drill-down state
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null)
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null)

  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const [{ data: farmData }, { data: orchardData }] = await Promise.all([
        isSuperAdmin
          ? supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('full_name')
          : supabase.from('farms').select('id, code, full_name').in('id', farmIds).eq('is_active', true).order('full_name'),
        isSuperAdmin
          ? supabase.from('orchards').select('id, name, orchard_nr, variety, variety_group, rootstock, ha, year_planted, commodity_id, farm_id, commodities(code,name)').eq('is_active', true).eq('status', 'active').order('name')
          : supabase.from('orchards').select('id, name, orchard_nr, variety, variety_group, rootstock, ha, year_planted, commodity_id, farm_id, commodities(code,name)').in('farm_id', farmIds).eq('is_active', true).eq('status', 'active').order('name'),
      ])
      setFarms(farmData || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setOrchards((orchardData || []).map((o: any) => ({
        ...o,
        commodities: Array.isArray(o.commodities) ? o.commodities[0] : o.commodities,
      })))
      setLoading(false)
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin])

  // Derived: orchards filtered by farm
  const farmFiltered = useMemo(() => {
    if (!selectedFarmId) return orchards
    return orchards.filter(o => o.farm_id === selectedFarmId)
  }, [orchards, selectedFarmId])

  // Derived: unique commodities from farm-filtered orchards
  const commodities = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of farmFiltered) {
      if (o.commodities && !map.has(o.commodity_id)) map.set(o.commodity_id, o.commodities.name)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [farmFiltered])

  // Derived: orchards filtered by farm + commodity
  const commodityFiltered = useMemo(() => {
    if (!selectedCommodity) return farmFiltered
    return farmFiltered.filter(o => o.commodity_id === selectedCommodity)
  }, [farmFiltered, selectedCommodity])

  // Derived: unique varieties from commodity-filtered orchards
  const varieties = useMemo(() => {
    const set = new Set<string>()
    for (const o of commodityFiltered) { if (o.variety) set.add(o.variety) }
    return [...set].sort()
  }, [commodityFiltered])

  // Final filtered list
  const filtered = useMemo(() => {
    if (!selectedVariety) return commodityFiltered
    return commodityFiltered.filter(o => o.variety === selectedVariety)
  }, [commodityFiltered, selectedVariety])

  const farmName = (fid: string) => farms.find(f => f.id === fid)?.full_name ?? ''

  // Reset downstream when upstream changes
  function selectFarm(id: string | null) {
    setSelectedFarmId(id)
    setSelectedCommodity(null)
    setSelectedVariety(null)
  }
  function selectCommodity(id: string | null) {
    setSelectedCommodity(id)
    setSelectedVariety(null)
  }

  if (!allowed) return null

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .rp-page { display: flex; min-height: 100vh; background: #f4f2ee; font-family: 'DM Sans', sans-serif; }
        .rp-main { flex: 1; padding: 32px 36px 64px; }
        .rp-title { font-size: 22px; font-weight: 700; color: #1a2a3a; margin-bottom: 4px; }
        .rp-sub { font-size: 13px; color: #8a95a0; margin-bottom: 24px; }

        /* ── Filter rows ── */
        .rp-filter-row {
          display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
          margin-bottom: 6px; animation: rp-fadeIn 0.25s ease both;
        }
        .rp-filter-label {
          font-size: 10px; font-weight: 700; color: #8a95a0; text-transform: uppercase;
          letter-spacing: 0.6px; width: 80px; flex-shrink: 0;
        }
        @keyframes rp-fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

        .rp-pill {
          padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
          border: 1px solid #e8e4dc; background: #fff; color: #6a7a70; cursor: pointer;
          font-family: inherit; transition: all 0.15s; white-space: nowrap;
        }
        .rp-pill:hover { border-color: #c0bdb6; }
        .rp-pill.active { background: #1a2a3a; color: #fff; border-color: #1a2a3a; }
        .rp-pill.active:hover { background: #253a4e; }

        .rp-divider { height: 1px; background: #eae7e1; margin: 14px 0 16px; }

        /* ── Result count ── */
        .rp-count { font-size: 12px; color: #8a95a0; margin-bottom: 14px; }
        .rp-count strong { color: #1a2a3a; }

        /* ── Cards ── */
        .rp-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .rp-card {
          background: #fff; border-radius: 12px; border: 1px solid #eae7e1;
          padding: 16px 18px; cursor: pointer; transition: all 0.15s;
          text-decoration: none; color: inherit; display: block;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .rp-card:hover { border-color: #2176d9; box-shadow: 0 3px 14px rgba(33,118,217,0.1); transform: translateY(-1px); }
        .rp-card-name { font-size: 14px; font-weight: 600; color: #1a2a3a; margin-bottom: 4px; }
        .rp-card-meta { font-size: 11px; color: #8a95a0; line-height: 1.5; }
        .rp-card-badges { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
        .rp-badge {
          font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px;
          letter-spacing: 0.3px;
        }
        .rp-badge-comm { background: #eef2fa; color: #2176d9; }
        .rp-badge-var { background: #f0f8ee; color: #3d8a3a; }

        @media (max-width: 768px) {
          .rp-main { padding: 16px 16px 80px; }
          .rp-grid { grid-template-columns: 1fr; }
          .rp-filter-label { width: 60px; }
        }
      `}</style>

      <div className="rp-page">
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

        <div className="rp-main">
          <div className="rp-title">Orchard Report Card</div>
          <div className="rp-sub">Drill down to select an orchard</div>

          {!loading && (
            <>
              {/* ── Farm row ── */}
              <div className="rp-filter-row">
                <div className="rp-filter-label">Farm</div>
                {farms.length > 1 && (
                  <button className={`rp-pill${!selectedFarmId ? ' active' : ''}`} onClick={() => selectFarm(null)}>
                    All
                  </button>
                )}
                {farms.map(f => (
                  <button key={f.id} className={`rp-pill${selectedFarmId === f.id ? ' active' : ''}`} onClick={() => selectFarm(f.id)}>
                    {f.code || f.full_name}
                  </button>
                ))}
              </div>

              {/* ── Commodity row (appears after farm selected or if single farm) ── */}
              {(selectedFarmId || farms.length === 1) && commodities.length > 1 && (
                <div className="rp-filter-row" style={{ animationDelay: '0.05s' }}>
                  <div className="rp-filter-label">Commodity</div>
                  <button className={`rp-pill${!selectedCommodity ? ' active' : ''}`} onClick={() => selectCommodity(null)}>
                    All
                  </button>
                  {commodities.map(([id, name]) => (
                    <button key={id} className={`rp-pill${selectedCommodity === id ? ' active' : ''}`} onClick={() => selectCommodity(id)}>
                      {name}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Variety row (appears after commodity selected) ── */}
              {selectedCommodity && varieties.length > 1 && (
                <div className="rp-filter-row" style={{ animationDelay: '0.1s' }}>
                  <div className="rp-filter-label">Variety</div>
                  <button className={`rp-pill${!selectedVariety ? ' active' : ''}`} onClick={() => setSelectedVariety(null)}>
                    All
                  </button>
                  {varieties.map(v => (
                    <button key={v} className={`rp-pill${selectedVariety === v ? ' active' : ''}`} onClick={() => setSelectedVariety(v)}>
                      {v}
                    </button>
                  ))}
                </div>
              )}

              <div className="rp-divider" />

              <div className="rp-count">
                <strong>{filtered.length}</strong> orchard{filtered.length !== 1 ? 's' : ''}
              </div>
            </>
          )}

          {loading ? (
            <div style={{ color: '#8a95a0', fontSize: 13 }}>Loading orchards...</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: '#8a95a0', fontSize: 13, fontStyle: 'italic' }}>No orchards found</div>
          ) : (
            <div className="rp-grid">
              {filtered.map(o => (
                <a key={o.id} href={`/production/report/${o.id}`} className="rp-card">
                  <div className="rp-card-name">
                    {o.orchard_nr != null ? `${o.orchard_nr} ` : ''}{o.name}
                  </div>
                  <div className="rp-card-meta">
                    {[
                      o.rootstock,
                      o.ha ? `${o.ha} ha` : null,
                      o.year_planted ? `Planted ${o.year_planted}` : null,
                    ].filter(Boolean).join(' \u00B7 ')}
                  </div>
                  {!selectedFarmId && farms.length > 1 && (
                    <div className="rp-card-meta" style={{ marginTop: 2 }}>{farmName(o.farm_id)}</div>
                  )}
                  <div className="rp-card-badges">
                    <span className="rp-badge rp-badge-comm">{o.commodities?.name ?? '\u2014'}</span>
                    {o.variety && <span className="rp-badge rp-badge-var">{o.variety}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <MobileNav isSuperAdmin={isSuperAdmin} modules={modules} />
    </>
  )
}

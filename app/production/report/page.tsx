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
  variety: string | null; rootstock: string | null
  ha: number | null; year_planted: number | null
  commodity_id: string; farm_id: string
  commodities: { code: string; name: string } | null
}

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  return `${mo < 8 ? yr - 1 : yr}/${String(mo < 8 ? yr : yr + 1).slice(-2)}`
}

export default function ReportPickerPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes, allowed } = usePageGuard()
  const supabase = createClient()
  const modules = useOrgModules()

  const [farms, setFarms] = useState<Farm[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!contextLoaded) return
    async function load() {
      const [{ data: farmData }, { data: orchardData }] = await Promise.all([
        isSuperAdmin
          ? supabase.from('farms').select('id, code, full_name').eq('is_active', true).order('full_name')
          : supabase.from('farms').select('id, code, full_name').in('id', farmIds).eq('is_active', true).order('full_name'),
        isSuperAdmin
          ? supabase.from('orchards').select('id, name, orchard_nr, variety, rootstock, ha, year_planted, commodity_id, farm_id, commodities(code,name)').eq('is_active', true).eq('status', 'active').order('name')
          : supabase.from('orchards').select('id, name, orchard_nr, variety, rootstock, ha, year_planted, commodity_id, farm_id, commodities(code,name)').in('farm_id', farmIds).eq('is_active', true).eq('status', 'active').order('name'),
      ])
      setFarms(farmData || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setOrchards((orchardData || []).map((o: any) => ({
        ...o,
        commodities: Array.isArray(o.commodities) ? o.commodities[0] : o.commodities,
      })))
      if (farmData?.length && !selectedFarmId) {
        setSelectedFarmId(farmData.length > 1 ? 'all' : farmData[0].id)
      }
      setLoading(false)
    }
    load()
  }, [contextLoaded, farmIds, isSuperAdmin])

  const filtered = useMemo(() => {
    let list = orchards
    if (selectedFarmId && selectedFarmId !== 'all') list = list.filter(o => o.farm_id === selectedFarmId)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.variety?.toLowerCase().includes(q) ||
        o.rootstock?.toLowerCase().includes(q)
      )
    }
    return list
  }, [orchards, selectedFarmId, search])

  const farmName = (fid: string) => farms.find(f => f.id === fid)?.full_name ?? ''

  if (!allowed) return null

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        .rp-page {
          display: flex; min-height: 100vh; background: #f8f6f2;
          font-family: 'DM Sans', sans-serif;
        }
        .rp-main { flex: 1; padding: 32px 32px 64px; }
        .rp-title { font-size: 22px; font-weight: 700; color: #1a2a3a; margin-bottom: 4px; }
        .rp-sub { font-size: 13px; color: #8a95a0; margin-bottom: 20px; }
        .rp-filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
        .rp-pill {
          padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
          border: 1px solid #e8e4dc; background: #fff; color: #6a7a70; cursor: pointer;
          font-family: inherit; transition: all 0.15s;
        }
        .rp-pill.active { background: #1a2a3a; color: #fff; border-color: #1a2a3a; }
        .rp-search {
          padding: 7px 12px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          font-size: 13px; font-family: inherit; color: #1a2a3a; width: 240px;
        }
        .rp-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }
        .rp-card {
          background: #fff; border-radius: 12px; border: 1px solid #e8e4dc;
          padding: 16px 18px; cursor: pointer; transition: all 0.15s;
          text-decoration: none; color: inherit; display: block;
        }
        .rp-card:hover { border-color: #2176d9; box-shadow: 0 2px 12px rgba(33,118,217,0.08); }
        .rp-card-name { font-size: 15px; font-weight: 600; color: #1a2a3a; margin-bottom: 4px; }
        .rp-card-meta { font-size: 12px; color: #8a95a0; }
        .rp-card-badge {
          display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px;
          border-radius: 4px; background: #eef2fa; color: #2176d9; margin-top: 8px;
        }
        @media (max-width: 768px) {
          .rp-main { padding: 16px 16px 80px; }
          .rp-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="rp-page">
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />

        <div className="rp-main">
          <div className="rp-title">Orchard Report Card</div>
          <div className="rp-sub">Select an orchard to view its historical performance report</div>

          <div className="rp-filters">
            {farms.length > 1 && (
              <button
                className={`rp-pill${selectedFarmId === 'all' ? ' active' : ''}`}
                onClick={() => setSelectedFarmId('all')}
              >
                All Farms
              </button>
            )}
            {farms.map(f => (
              <button
                key={f.id}
                className={`rp-pill${selectedFarmId === f.id ? ' active' : ''}`}
                onClick={() => setSelectedFarmId(f.id)}
              >
                {f.code || f.full_name}
              </button>
            ))}
            <input
              className="rp-search"
              placeholder="Search orchards…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={{ color: '#8a95a0', fontSize: 13 }}>Loading orchards…</div>
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
                      o.variety,
                      o.rootstock,
                      o.ha ? `${o.ha} ha` : null,
                      o.year_planted ? `Planted ${o.year_planted}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {selectedFarmId === 'all' && (
                    <div className="rp-card-meta" style={{ marginTop: 2 }}>{farmName(o.farm_id)}</div>
                  )}
                  <div className="rp-card-badge">{o.commodities?.name ?? '—'}</div>
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

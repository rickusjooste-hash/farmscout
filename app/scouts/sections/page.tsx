'use client'

import { createClient } from '@/lib/supabase-auth'
import { useEffect, useState } from 'react'

interface Section {
  id: string
  name: string
  section_nr: number
}

interface Orchard {
  id: string
  name: string
  variety: string | null
  legacy_id: number | null
  section_id: string | null
}

interface Farm {
  id: string
  full_name: string
  code: string
  organisation_id: string
}

export default function SectionsPage() {
  const supabase = createClient()
  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [orchards, setOrchards] = useState<Orchard[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [newSectionName, setNewSectionName] = useState('')
  const [addingSection, setAddingSection] = useState(false)

  // Load farms the current user has access to
  useEffect(() => {
    async function loadFarms() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: orgUser } = await supabase
        .from('organisation_users')
        .select('role, organisation_id')
        .eq('user_id', user.id)
        .single()

      let farmList: Farm[] = []

      if (orgUser?.role === 'super_admin') {
        const { data } = await supabase.from('farms').select('id, full_name, code, organisation_id').order('full_name')
        farmList = data || []
      } else {
        const { data: access } = await supabase
          .from('user_farm_access')
          .select('farm_id')
          .eq('user_id', user.id)
        const farmIds = (access || []).map((a: any) => a.farm_id)

        if (farmIds.length > 0) {
          const { data: farmsData } = await supabase
            .from('farms')
            .select('id, full_name, code, organisation_id')
            .in('id', farmIds)
            .order('full_name')
          farmList = farmsData || []
        }

        // Fallback: if no farm_access rows, load all farms for their org
        if (farmList.length === 0 && orgUser?.organisation_id) {
          const { data: allFarms } = await supabase
            .from('farms')
            .select('id, full_name, code, organisation_id')
            .eq('organisation_id', orgUser.organisation_id)
            .order('full_name')
          farmList = allFarms || []
        }
      }

      setFarms(farmList)
      if (farmList.length > 0) setSelectedFarmId(farmList[0].id)
    }
    loadFarms()
  }, [])

  useEffect(() => {
    if (selectedFarmId) loadData(selectedFarmId)
  }, [selectedFarmId])

  async function loadData(farmId: string) {
    setSections([])
    setOrchards([])
    const [{ data: sectionData }, { data: orchardData }] = await Promise.all([
      supabase.from('sections').select('*').eq('farm_id', farmId).order('section_nr'),
      supabase.from('orchards').select('id, name, variety, legacy_id, section_id').eq('farm_id', farmId).eq('is_active', true).order('name'),
    ])
    setSections(sectionData || [])
    setOrchards(orchardData || [])
  }

  async function assignOrchard(orchardId: string, sectionId: string | null) {
    setSaving(orchardId)
    setOrchards(prev =>
      prev.map(o => o.id === orchardId ? { ...o, section_id: sectionId } : o)
    )
    await fetch('/api/orchards/assign-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orchardId, sectionId }),
    })
    setSaving(null)
  }

  async function addSection() {
    if (!newSectionName.trim() || !selectedFarmId) return
    setAddingSection(true)
    const farm = farms.find(f => f.id === selectedFarmId)
    const { data } = await supabase
      .from('sections')
      .insert({
        organisation_id: farm?.organisation_id,
        farm_id: selectedFarmId,
        section_nr: sections.length + 1,
        name: newSectionName.trim(),
      })
      .select()
      .single()
    if (data) setSections(prev => [...prev, data])
    setNewSectionName('')
    setAddingSection(false)
  }

  const unassigned = orchards.filter(o => !o.section_id)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f1eb; }
        .app { display: flex; min-height: 100vh; }
        .sidebar {
          width: 220px; height: 100vh; position: sticky; top: 0; overflow-y: auto; background: #1c3a2a;
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
        .nav-item.sub { padding-left: 32px; font-size: 12.5px; }
        .sidebar-footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #2a4f38; font-size: 12px; color: #4a7a5a; }
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 100vh; }
        .top-bar {
          padding: 16px 24px; background: #fff; border-bottom: 1px solid #e8e4dc;
          display: flex; align-items: center; gap: 16px; flex-shrink: 0;
        }
        .page-title { font-family: 'DM Serif Display', serif; font-size: 20px; color: #1c3a2a; }
        .breadcrumb { font-size: 13px; color: #9aaa9f; }
        .breadcrumb a { color: #2a6e45; text-decoration: none; }
        .content { flex: 1; padding: 24px; overflow-y: auto; display: flex; gap: 24px; align-items: flex-start; }
        
        /* Left — Unassigned */
        .unassigned-panel {
          width: 280px; flex-shrink: 0; background: #fff;
          border-radius: 12px; border: 1px solid #e8e4dc; overflow: hidden;
        }
        .panel-header {
          padding: 16px; border-bottom: 1px solid #e8e4dc;
          background: #f9f7f3;
        }
        .panel-title { font-size: 13px; font-weight: 700; color: #1c3a2a; text-transform: uppercase; letter-spacing: 0.8px; }
        .panel-count { font-size: 12px; color: #9aaa9f; margin-top: 2px; }
        .orchard-list { max-height: 600px; overflow-y: auto; }
        .orchard-item {
          padding: 12px 16px; border-bottom: 1px solid #f4f1eb;
          display: flex; align-items: center; justify-content: space-between;
          transition: background 0.1s;
        }
        .orchard-item:last-child { border-bottom: none; }
        .orchard-item:hover { background: #f9f7f3; }
        .orchard-name { font-size: 13px; font-weight: 500; color: #1c3a2a; }
        .orchard-id { font-size: 11px; color: #9aaa9f; margin-top: 1px; }
        .assign-btns { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
        .assign-btn {
          padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
          cursor: pointer; border: 1.5px solid #e0ddd6; background: #fff;
          color: #3a4a40; font-family: 'DM Sans', sans-serif; transition: all 0.15s;
          white-space: nowrap;
        }
        .assign-btn:hover { border-color: #2a6e45; color: #2a6e45; background: #f0f7f2; }
        .assign-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Right — Sections */
        .sections-area { flex: 1; display: flex; flex-direction: column; gap: 20px; }
        .section-card { background: #fff; border-radius: 12px; border: 1px solid #e8e4dc; overflow: hidden; }
        .section-header {
          padding: 14px 16px; background: #1c3a2a;
          display: flex; align-items: center; justify-content: space-between;
        }
        .section-name { font-size: 14px; font-weight: 600; color: #a8d5a2; }
        .section-count { font-size: 12px; color: #6aaa80; }
        .section-orchards { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px; min-height: 60px; }
        .section-orchard-tag {
          display: flex; align-items: center; gap: 6px;
          background: #f0f7f2; border: 1px solid #c8e6d0; border-radius: 20px;
          padding: 5px 12px; font-size: 12px; font-weight: 500; color: #1c3a2a;
        }
        .remove-btn {
          width: 16px; height: 16px; border-radius: 50%; background: none;
          border: none; cursor: pointer; color: #9aaa9f; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
          line-height: 1; padding: 0; transition: color 0.1s;
        }
        .remove-btn:hover { color: #e85a4a; }
        .empty-section { font-size: 13px; color: #c0c8c4; font-style: italic; padding: 4px 0; }

        /* Add section */
        .add-section-card {
          background: #fff; border-radius: 12px; border: 2px dashed #e0ddd6;
          padding: 16px; display: flex; gap: 8px;
        }
        .add-section-input {
          flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1c3a2a;
          background: #f9f7f3; outline: none;
        }
        .add-section-input:focus { border-color: #2a6e45; }
        .btn-primary {
          padding: 8px 16px; border-radius: 8px; background: #1c3a2a; color: #a8d5a2;
          border: none; font-size: 13px; font-weight: 600; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        }
        .btn-primary:hover { background: #2a4f38; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item"><span>🏡</span> Orchards</a>
          <a className="nav-item"><span>🐛</span> Pests</a>
          <a href="/trap-inspections" className="nav-item"><span>🪤</span> Trap Inspections</a>
          <a href="/inspections" className="nav-item"><span>🔍</span> Inspections</a>
          <a href="/scouts" className="nav-item"><span>👷</span> Scouts</a>
          <a href="/scouts/sections" className="nav-item sub active"><span>🗂️</span> Sections</a>
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
            <div>
              <div className="page-title">Sections</div>
              <div className="breadcrumb">
                <a href="/scouts">Scouts</a> › Sections
              </div>
            </div>
            {farms.length > 1 && (
              <select
                value={selectedFarmId || ''}
                onChange={e => setSelectedFarmId(e.target.value)}
                style={{
                  marginLeft: 'auto', padding: '8px 12px', borderRadius: 8,
                  border: '1.5px solid #e0ddd6', fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13, color: '#1c3a2a', background: '#fff', cursor: 'pointer',
                }}
              >
                {farms.map(f => (
                  <option key={f.id} value={f.id}>{f.full_name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="content">
            {/* Left — Unassigned orchards */}
            <div className="unassigned-panel">
              <div className="panel-header">
                <div className="panel-title">Unassigned Orchards</div>
                <div className="panel-count">{unassigned.length} orchards</div>
              </div>
              <div className="orchard-list">
                {unassigned.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#9aaa9f', fontSize: 13 }}>
                    ✅ All orchards assigned!
                  </div>
                ) : (
                  unassigned.map(o => (
                    <div key={o.id} className="orchard-item">
                      <div>
                        <div className="orchard-name">{o.name}</div>
                        {(o.variety || o.legacy_id) && (
                          <div className="orchard-id">
                            {[o.variety, o.legacy_id ? `ID ${o.legacy_id}` : null].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="assign-btns">
                        {sections.map(s => (
                          <button
                            key={s.id}
                            className="assign-btn"
                            disabled={saving === o.id}
                            onClick={() => assignOrchard(o.id, s.id)}
                          >
                            {s.name.replace('MV ', '').replace('Section ', 'S')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right — Sections */}
            <div className="sections-area">
              {sections.map(s => {
                const sectionOrchards = orchards.filter(o => o.section_id === s.id)
                return (
                  <div key={s.id} className="section-card">
                    <div className="section-header">
                      <div className="section-name">{s.name}</div>
                      <div className="section-count">{sectionOrchards.length} orchards</div>
                    </div>
                    <div className="section-orchards">
                      {sectionOrchards.length === 0 ? (
                        <div className="empty-section">No orchards assigned yet</div>
                      ) : (
                        sectionOrchards.map(o => (
                          <div key={o.id} className="section-orchard-tag">
                            {o.name}
                            <button
                              className="remove-btn"
                              onClick={() => assignOrchard(o.id, null)}
                              disabled={saving === o.id}
                              title="Remove from section"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Add new section */}
              <div className="add-section-card">
                <input
                  className="add-section-input"
                  placeholder="New section name e.g. SK Section 1"
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSection()}
                />
                <button
                  className="btn-primary"
                  onClick={addSection}
                  disabled={addingSection || !newSectionName.trim()}
                >
                  + Add Section
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
'use client'

import { useEffect, useState, useCallback } from 'react'

interface BenchmarkRow {
  orchard_id: string
  orchard_name: string
  orchard_nr: number | null
  variety: string | null
  variety_group: string | null
  commodity_name: string
  ha: number | null
  ton_ha: number | null
  industry_target: number | null
  org_target: number | null
  vs_industry_pct: number | null
  vs_org_pct: number | null
  meets_industry: boolean | null
  meets_org: boolean | null
}

interface OrgTarget {
  id: string
  commodity_id: string
  commodity_name: string
  variety_group: string | null
  target_t_ha: number
}

interface IndustryBenchmark {
  id: string
  commodity_id: string
  commodity_name: string
  variety_group: string | null
  target_t_ha: number
  source: string | null
}

interface Props {
  farmIds: string[]
  season: string
  orgId: string
  commodities: { id: string; name: string }[]
}

export default function BenchmarkPanel({ farmIds, season, orgId, commodities }: Props) {
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkRow[]>([])
  const [orgTargets, setOrgTargets] = useState<OrgTarget[]>([])
  const [industryBenchmarks, setIndustryBenchmarks] = useState<IndustryBenchmark[]>([])
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  // Settings form
  const [editCommodityId, setEditCommodityId] = useState('')
  const [editVarietyGroup, setEditVarietyGroup] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchBenchmarks = useCallback(async () => {
    setLoading(true)
    try {
      const [benchRes, targetsRes] = await Promise.all([
        fetch(`/api/benchmarks?farm_ids=${farmIds.join(',')}&season=${encodeURIComponent(season)}`),
        fetch(`/api/benchmarks/targets?org_id=${orgId}`),
      ])

      if (benchRes.ok) setBenchmarkData(await benchRes.json())
      if (targetsRes.ok) {
        const data = await targetsRes.json()
        setOrgTargets(data.targets || [])
        setIndustryBenchmarks(data.benchmarks || [])
      }
    } catch {
      setBenchmarkData([])
    }
    setLoading(false)
  }, [farmIds, season, orgId])

  useEffect(() => { fetchBenchmarks() }, [fetchBenchmarks])

  async function handleSaveTarget() {
    if (!editCommodityId || !editTarget) return
    setSaving(true)
    try {
      await fetch('/api/benchmarks/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisation_id: orgId,
          commodity_id: editCommodityId,
          variety_group: editVarietyGroup || undefined,
          target_t_ha: parseFloat(editTarget),
        }),
      })
      setEditCommodityId('')
      setEditVarietyGroup('')
      setEditTarget('')
      await fetchBenchmarks()
    } catch {}
    setSaving(false)
  }

  async function handleDeleteTarget(id: string) {
    await fetch('/api/benchmarks/targets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchBenchmarks()
  }

  if (loading) {
    return <div style={{ padding: 30, textAlign: 'center', color: '#6a7a70' }}>Loading benchmarks...</div>
  }

  const withProduction = benchmarkData.filter(r => r.ton_ha != null)
  const meetsIndustryCount = withProduction.filter(r => r.meets_industry === true).length
  const meetsOrgCount = withProduction.filter(r => r.meets_org === true).length

  return (
    <div>
      {/* Summary KPIs */}
      <div style={st.kpiRow}>
        <div style={st.kpiCard}>
          <div style={st.kpiValue}>{withProduction.length}</div>
          <div style={st.kpiLabel}>Orchards with data</div>
        </div>
        <div style={st.kpiCard}>
          <div style={{ ...st.kpiValue, color: '#4caf72' }}>{meetsIndustryCount}</div>
          <div style={st.kpiLabel}>Meet industry target</div>
        </div>
        <div style={st.kpiCard}>
          <div style={{ ...st.kpiValue, color: '#2176d9' }}>{meetsOrgCount}</div>
          <div style={st.kpiLabel}>Meet org target</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => setShowSettings(!showSettings)} style={st.settingsBtn}>
            {showSettings ? 'Hide Settings' : 'Org Targets'}
          </button>
        </div>
      </div>

      {/* Org targets settings */}
      {showSettings && (
        <div style={st.settingsCard}>
          <h4 style={st.settingsTitle}>Organisation Production Targets</h4>

          {/* Industry benchmarks (read-only) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6a7a70', marginBottom: 6 }}>Industry Benchmarks</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {industryBenchmarks.map(b => (
                <span key={b.id} style={st.benchmarkTag}>
                  {b.commodity_name}{b.variety_group ? ` (${b.variety_group})` : ''}: {b.target_t_ha} T/ha
                  {b.source && <span style={{ color: '#aaa', marginLeft: 4 }}>[{b.source}]</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Existing org targets */}
          {orgTargets.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6a7a70', marginBottom: 6 }}>Your Targets</div>
              {orgTargets.map(t => (
                <div key={t.id} style={st.targetRow}>
                  <span>{t.commodity_name}{t.variety_group ? ` (${t.variety_group})` : ''}: <strong>{t.target_t_ha} T/ha</strong></span>
                  <button onClick={() => handleDeleteTarget(t.id)} style={st.removeBtn}>&times;</button>
                </div>
              ))}
            </div>
          )}

          {/* Add target */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={st.inputLabel}>Commodity</label>
              <select value={editCommodityId} onChange={e => setEditCommodityId(e.target.value)} style={st.input}>
                <option value="">Select...</option>
                {commodities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={st.inputLabel}>Variety Group (optional)</label>
              <input
                value={editVarietyGroup}
                onChange={e => setEditVarietyGroup(e.target.value)}
                placeholder="e.g. Granny Smith"
                style={st.input}
              />
            </div>
            <div>
              <label style={st.inputLabel}>Target T/Ha</label>
              <input
                type="number"
                value={editTarget}
                onChange={e => setEditTarget(e.target.value)}
                placeholder="50"
                style={{ ...st.input, width: 80 }}
              />
            </div>
            <button
              onClick={handleSaveTarget}
              disabled={saving || !editCommodityId || !editTarget}
              style={{ ...st.addBtn, opacity: saving ? 0.5 : 1 }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Benchmark table */}
      <div style={st.tableCard}>
        <table style={st.table}>
          <thead>
            <tr>
              <th style={st.th}>Orchard</th>
              <th style={st.th}>Variety</th>
              <th style={st.th}>Ha</th>
              <th style={{ ...st.th, textAlign: 'right' }}>Actual T/Ha</th>
              <th style={{ ...st.th, textAlign: 'right' }}>Industry</th>
              <th style={{ ...st.th, textAlign: 'right' }}>Org Target</th>
              <th style={{ ...st.th, textAlign: 'right' }}>vs Industry</th>
              <th style={{ ...st.th, textAlign: 'right' }}>vs Org</th>
            </tr>
          </thead>
          <tbody>
            {benchmarkData.map(r => (
              <tr key={r.orchard_id}>
                <td style={{ ...st.td, fontWeight: 500 }}>
                  {r.orchard_nr ? `${r.orchard_nr}. ` : ''}{r.orchard_name}
                </td>
                <td style={{ ...st.td, color: '#6a7a70', fontSize: 12 }}>{r.variety || '\u2014'}</td>
                <td style={{ ...st.td, fontSize: 12 }}>{r.ha?.toFixed(1) || '\u2014'}</td>
                <td style={{ ...st.td, textAlign: 'right', fontWeight: 600 }}>
                  {r.ton_ha != null ? r.ton_ha.toFixed(1) : '\u2014'}
                </td>
                <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70' }}>
                  {r.industry_target != null ? r.industry_target : '\u2014'}
                </td>
                <td style={{ ...st.td, textAlign: 'right', color: '#6a7a70' }}>
                  {r.org_target != null ? r.org_target : '\u2014'}
                </td>
                <td style={{ ...st.td, textAlign: 'right' }}>
                  {r.vs_industry_pct != null ? (
                    <span style={{ color: r.meets_industry ? '#2e6a3e' : '#c03030', fontWeight: 600 }}>
                      {r.vs_industry_pct}%
                    </span>
                  ) : '\u2014'}
                </td>
                <td style={{ ...st.td, textAlign: 'right' }}>
                  {r.vs_org_pct != null ? (
                    <span style={{ color: r.meets_org ? '#2e6a3e' : '#c03030', fontWeight: 600 }}>
                      {r.vs_org_pct}%
                    </span>
                  ) : '\u2014'}
                </td>
              </tr>
            ))}
            {benchmarkData.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...st.td, textAlign: 'center', color: '#aaa', padding: 30 }}>
                  No production data for this season
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  kpiRow: {
    display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap',
  },
  kpiCard: {
    background: '#fff', borderRadius: 12, padding: '14px 18px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  kpiValue: { fontSize: 22, fontWeight: 700, color: '#1a2a3a' },
  kpiLabel: { fontSize: 12, color: '#6a7a70', marginTop: 2 },
  settingsBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #d4cfca',
    background: '#fff', color: '#1a2a3a', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  settingsCard: {
    background: '#fff', borderRadius: 14, padding: '20px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16,
  },
  settingsTitle: {
    fontSize: 15, fontWeight: 700, color: '#1a2a3a', margin: '0 0 12px',
  },
  benchmarkTag: {
    padding: '4px 10px', background: '#f0f4f8', borderRadius: 12,
    fontSize: 12, color: '#4a6a80',
  },
  targetRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: '1px solid #f0ede6', fontSize: 14,
  },
  removeBtn: {
    background: 'none', border: 'none', color: '#c03030', fontSize: 18,
    cursor: 'pointer', padding: '0 6px',
  },
  inputLabel: {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#6a7a70',
    marginBottom: 4,
  },
  input: {
    padding: '7px 10px', border: '1px solid #d4cfca', borderRadius: 6,
    fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif',
  },
  addBtn: {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#2176d9', color: '#fff', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', marginBottom: 1,
  },
  tableCard: {
    background: '#fff', borderRadius: 14, overflow: 'auto',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Inter, sans-serif' },
  th: {
    textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#6a7a70',
    fontSize: 11, borderBottom: '2px solid #e8e4dc', whiteSpace: 'nowrap',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: { padding: '8px 12px', borderBottom: '1px solid #f0ede6' },
}

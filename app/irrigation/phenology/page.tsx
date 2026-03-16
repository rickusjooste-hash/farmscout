'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useCallback } from 'react'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'
import MobileNav from '@/app/components/MobileNav'
import { STAGE_COLORS, STAGE_LABELS, STAGES } from '@/app/components/irrigation/WeeklyBalanceChart'

const MONTHS = [
  { num: 9, label: 'Sep' }, { num: 10, label: 'Oct' }, { num: 11, label: 'Nov' },
  { num: 12, label: 'Dec' }, { num: 1, label: 'Jan' }, { num: 2, label: 'Feb' },
  { num: 3, label: 'Mar' }, { num: 4, label: 'Apr' }, { num: 5, label: 'May' },
  { num: 6, label: 'Jun' }, { num: 7, label: 'Jul' }, { num: 8, label: 'Aug' },
]

const COMMODITY_LABELS: Record<string, string> = {
  AP: 'Apples', PR: 'Pears', NE: 'Nectarines', PE: 'Peaches', CI: 'Citrus',
}

interface StageRow {
  commodity_code: string
  variety_group: string
  stages: Record<number, string> // month → stage
}

interface EditingCell {
  commodity_code: string
  variety_group: string
  month: number
}

export default function PhenologyPage() {
  const { farmIds, isSuperAdmin, contextLoaded, allowedRoutes } = usePageGuard()
  const modules = useOrgModules()

  const [rows, setRows] = useState<StageRow[]>([])
  const [dbVarieties, setDbVarieties] = useState<{ commodity_code: string; variety_group: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [dirty, setDirty] = useState(false)

  // Load existing phenological stages + all variety groups from orchards
  useEffect(() => {
    if (!contextLoaded) return
    const supabase = createClient()

    Promise.all([
      supabase.rpc('get_all_phenological_stages'),
      supabase.from('orchards')
        .select('commodity_id, variety_group, commodities!inner(code)')
        .not('variety_group', 'is', null)
        .eq('is_active', true),
    ]).then(([stagesRes, orchRes]) => {
      // Build variety list from orchards
      const varSet = new Map<string, { commodity_code: string; variety_group: string }>()
      for (const o of (orchRes.data || [])) {
        const code = (o as any).commodities?.code
        const vg = o.variety_group
        if (code && vg) {
          const key = `${code}:${vg}`
          if (!varSet.has(key)) varSet.set(key, { commodity_code: code, variety_group: vg })
        }
      }
      const varieties = Array.from(varSet.values()).sort((a, b) =>
        a.commodity_code.localeCompare(b.commodity_code) || a.variety_group.localeCompare(b.variety_group)
      )
      setDbVarieties(varieties)

      // Build rows — one per variety_group, with existing stages filled in
      const stageData = stagesRes.data || []
      const rowMap = new Map<string, StageRow>()
      for (const v of varieties) {
        const key = `${v.commodity_code}:${v.variety_group}`
        rowMap.set(key, { ...v, stages: {} })
      }
      for (const s of stageData) {
        const key = `${s.commodity_code}:${s.variety_group}`
        let row = rowMap.get(key)
        if (!row) {
          row = { commodity_code: s.commodity_code, variety_group: s.variety_group, stages: {} }
          rowMap.set(key, row)
        }
        row.stages[s.month] = s.stage
      }
      setRows(Array.from(rowMap.values()).sort((a, b) =>
        a.commodity_code.localeCompare(b.commodity_code) || a.variety_group.localeCompare(b.variety_group)
      ))
      setLoading(false)
    })
  }, [contextLoaded])

  const setStage = useCallback((commodity_code: string, variety_group: string, month: number, stage: string) => {
    setRows(prev => prev.map(r => {
      if (r.commodity_code !== commodity_code || r.variety_group !== variety_group) return r
      return { ...r, stages: { ...r.stages, [month]: stage } }
    }))
    setEditingCell(null)
    setDirty(true)
  }, [])

  const clearStage = useCallback((commodity_code: string, variety_group: string, month: number) => {
    setRows(prev => prev.map(r => {
      if (r.commodity_code !== commodity_code || r.variety_group !== variety_group) return r
      const stages = { ...r.stages }
      delete stages[month]
      return { ...r, stages }
    }))
    setEditingCell(null)
    setDirty(true)
  }, [])

  const copyFromRow = useCallback((sourceRow: StageRow, targetCommodity: string, targetVg: string) => {
    setRows(prev => prev.map(r => {
      if (r.commodity_code !== targetCommodity || r.variety_group !== targetVg) return r
      return { ...r, stages: { ...sourceRow.stages } }
    }))
    setDirty(true)
  }, [])

  const saveAll = useCallback(async () => {
    setSaving(true)
    const supabase = createClient()

    // Delete all existing, then upsert all rows
    await supabase.from('phenological_stages').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const inserts: { commodity_code: string; variety_group: string; month: number; stage: string }[] = []
    for (const r of rows) {
      for (const [m, st] of Object.entries(r.stages)) {
        inserts.push({ commodity_code: r.commodity_code, variety_group: r.variety_group, month: Number(m), stage: st })
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('phenological_stages').insert(inserts)
      if (error) {
        console.error('Save phenological stages error:', error)
        alert('Error saving: ' + error.message)
      }
    }

    setDirty(false)
    setSaving(false)
  }, [rows])

  if (!contextLoaded) return null

  // Group rows by commodity
  const grouped = new Map<string, StageRow[]>()
  for (const r of rows) {
    const arr = grouped.get(r.commodity_code) || []
    arr.push(r)
    grouped.set(r.commodity_code, arr)
  }

  return (
    <>
      <ManagerSidebarStyles />
      <style>{`
        @media (max-width: 768px) {
          .pheno-main { padding: 16px !important; padding-bottom: 80px !important; }
          .pheno-table-wrap { overflow-x: auto; }
        }
      `}</style>

      <div style={p.page}>
        <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} allowedRoutes={allowedRoutes} />
        <main style={p.main} className="pheno-main">
          <div style={p.header}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a href="/irrigation" style={p.backLink}>&larr; Irrigation</a>
              </div>
              <h1 style={p.title}>Phenological Stages</h1>
              <div style={p.sub}>
                Set growth stage per month for each variety group. Used on the weekly water balance chart.
              </div>
            </div>
            <button
              style={dirty ? p.saveBtn : p.saveBtnDisabled}
              disabled={!dirty || saving}
              onClick={saveAll}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Legend */}
          <div style={p.legend}>
            {STAGES.map(st => (
              <div key={st} style={p.legendItem}>
                <div style={{ ...p.legendSwatch, background: STAGE_COLORS[st] }} />
                <span style={p.legendLabel}>{STAGE_LABELS[st]}</span>
                <span style={p.legendCode}>({st})</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8a95a0' }}>Loading...</div>
          ) : (
            Array.from(grouped.entries()).map(([code, commodityRows]) => (
              <div key={code} style={p.section}>
                <div style={p.sectionTitle}>{COMMODITY_LABELS[code] || code}</div>
                <div className="pheno-table-wrap">
                  <table style={p.table}>
                    <thead>
                      <tr>
                        <th style={p.th}>Variety Group</th>
                        {MONTHS.map(m => (
                          <th key={m.num} style={p.thMonth}>{m.label}</th>
                        ))}
                        <th style={p.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {commodityRows.map(row => (
                        <tr key={`${row.commodity_code}:${row.variety_group}`}>
                          <td style={p.tdName}>{row.variety_group}</td>
                          {MONTHS.map(m => {
                            const stage = row.stages[m.num]
                            const isEditing = editingCell?.commodity_code === row.commodity_code
                              && editingCell?.variety_group === row.variety_group
                              && editingCell?.month === m.num
                            return (
                              <td
                                key={m.num}
                                style={{
                                  ...p.tdCell,
                                  background: stage ? STAGE_COLORS[stage] : '#fafafa',
                                  cursor: 'pointer',
                                  position: 'relative' as const,
                                }}
                                onClick={() => setEditingCell(isEditing ? null : {
                                  commodity_code: row.commodity_code,
                                  variety_group: row.variety_group,
                                  month: m.num,
                                })}
                              >
                                <span style={p.cellLabel}>{stage || '—'}</span>
                                {isEditing && (
                                  <div style={p.dropdown}>
                                    {STAGES.map(st => (
                                      <div
                                        key={st}
                                        style={{
                                          ...p.dropdownItem,
                                          background: STAGE_COLORS[st],
                                          fontWeight: st === stage ? 700 : 400,
                                        }}
                                        onClick={(e) => { e.stopPropagation(); setStage(row.commodity_code, row.variety_group, m.num, st) }}
                                      >
                                        {st} — {STAGE_LABELS[st]}
                                      </div>
                                    ))}
                                    {stage && (
                                      <div
                                        style={{ ...p.dropdownItem, background: '#f5f5f5', color: '#999' }}
                                        onClick={(e) => { e.stopPropagation(); clearStage(row.commodity_code, row.variety_group, m.num) }}
                                      >
                                        Clear
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                          <td style={p.tdAction}>
                            <CopyMenu
                              sourceRow={row}
                              allRows={commodityRows}
                              onCopy={(targetVg) => copyFromRow(row, row.commodity_code, targetVg)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </main>
        <MobileNav modules={modules} />
      </div>
    </>
  )
}

// ── Copy menu component ──────────────────────────────────────────────────────

function CopyMenu({ sourceRow, allRows, onCopy }: {
  sourceRow: StageRow
  allRows: StageRow[]
  onCopy: (targetVg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const hasStages = Object.keys(sourceRow.stages).length > 0
  if (!hasStages) return null

  const targets = allRows.filter(r => r.variety_group !== sourceRow.variety_group)
  if (targets.length === 0) return null

  return (
    <div style={{ position: 'relative' as const }}>
      <button
        style={p.copyBtn}
        onClick={() => setOpen(!open)}
        title="Copy stages to another variety"
      >
        Copy &darr;
      </button>
      {open && (
        <div style={p.copyDropdown}>
          {targets.map(t => (
            <div
              key={t.variety_group}
              style={p.copyDropdownItem}
              onClick={() => { onCopy(t.variety_group); setOpen(false) }}
            >
              {t.variety_group}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const p: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', background: '#f4f1eb', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2a3a' },
  main: { flex: 1, padding: 40, overflowY: 'auto', minWidth: 0, paddingBottom: 100 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  backLink: { fontSize: 13, color: '#2176d9', textDecoration: 'none', fontWeight: 500 },
  title: { fontSize: 28, fontWeight: 700, color: '#1a2a3a', letterSpacing: '-0.5px', lineHeight: 1, marginTop: 8 },
  sub: { fontSize: 14, color: '#8a95a0', marginTop: 6 },
  saveBtn: { padding: '10px 24px', borderRadius: 10, border: 'none', background: '#2176d9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
  saveBtnDisabled: { padding: '10px 24px', borderRadius: 10, border: 'none', background: '#d4cfca', color: '#8a95a0', fontSize: 14, fontWeight: 600, cursor: 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
  legend: { display: 'flex', flexWrap: 'wrap' as const, gap: 12, marginBottom: 24, padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e8e4dc' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 16, height: 16, borderRadius: 3, border: '1px solid #d4cfca' },
  legendLabel: { fontSize: 12, color: '#1a2a3a', fontWeight: 500 },
  legendCode: { fontSize: 11, color: '#8a95a0' },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1a2a3a', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse' as const, background: '#fff', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e4dc' },
  th: { fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '10px 8px', textAlign: 'left' as const, borderBottom: '1px solid #e8e4dc' },
  thMonth: { fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase' as const, letterSpacing: '0.04em', padding: '10px 4px', textAlign: 'center' as const, borderBottom: '1px solid #e8e4dc', minWidth: 48 },
  tdName: { fontSize: 13, fontWeight: 600, color: '#1a2a3a', padding: '8px 8px', borderBottom: '1px solid #f0ede8', whiteSpace: 'nowrap' as const },
  tdCell: { fontSize: 11, fontWeight: 600, color: '#5a5a5a', padding: '6px 2px', textAlign: 'center' as const, borderBottom: '1px solid #f0ede8', minWidth: 48 },
  cellLabel: { fontSize: 11, fontWeight: 600, color: '#5a5a5a' },
  dropdown: { position: 'absolute' as const, top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #d4cfca', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 150, overflow: 'hidden' },
  dropdownItem: { padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f0ede8' },
  tdAction: { padding: '6px 8px', borderBottom: '1px solid #f0ede8', textAlign: 'center' as const },
  copyBtn: { fontSize: 11, color: '#2176d9', background: 'none', border: '1px solid #d4cfca', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
  copyDropdown: { position: 'absolute' as const, top: '100%', right: 0, background: '#fff', border: '1px solid #d4cfca', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 140, overflow: 'hidden' },
  copyDropdownItem: { padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f0ede8' },
}

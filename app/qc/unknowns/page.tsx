'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useOrgModules } from '@/lib/useOrgModules'
import ManagerSidebar, { ManagerSidebarStyles } from '@/app/components/ManagerSidebar'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'

interface UnknownIssue {
  issue_id: string
  session_id: string
  pest_id: string
  count: number
  photo_url: string
  ai_suggestion: string | null
  ai_reasoning: string | null
  resolved_pest_id: string | null
  resolved_at: string | null
  collected_at: string
  bag_seq: number
  orchard_name: string
  commodity_name: string
  employee_name: string
  farm_id: string
  _signedUrl?: string
  _identifying?: boolean
  _resolving?: boolean
  _resolved?: boolean
}

interface Pest {
  id: string
  name: string
}

// ── Styles (inline, matching manager app pattern) ─────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex', minHeight: '100vh', background: '#f8f7f4',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  main: {
    flex: 1, marginLeft: 220, padding: '32px 40px',
  },
  pageHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#1c3a2a' },
  pageSub: { fontSize: 13, color: '#7a8a7e', marginTop: 2 },
  badges: { display: 'flex', gap: 8 },
  badgePending: {
    background: '#fef3c7', color: '#92400e', padding: '3px 10px',
    borderRadius: 20, fontSize: 12, fontWeight: 600,
  },
  badgeResolved: {
    background: '#d1fae5', color: '#065f46', padding: '3px 10px',
    borderRadius: 20, fontSize: 12, fontWeight: 600,
  },
  filterGroup: { display: 'flex', gap: 6, marginBottom: 20 },
  pill: {
    padding: '6px 14px', borderRadius: 20, border: '1.5px solid #e0ddd6',
    background: '#fff', color: '#3a4a40', fontSize: 12, fontWeight: 500,
    cursor: 'pointer',
  },
  pillActive: {
    padding: '6px 14px', borderRadius: 20, border: '1.5px solid #2a6e45',
    background: '#1c3a2a', color: '#fff', fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 20,
  },
  card: {
    background: '#fff', borderRadius: 12, border: '1px solid #e5e2db',
    overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardResolved: {
    background: '#fff', borderRadius: 12, border: '1px solid #a7f3d0',
    overflow: 'hidden', opacity: 0.75, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  photo: {
    position: 'relative' as const, background: '#f3f4f6', height: 200,
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' as const },
  photoPlaceholder: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#d1d5db', fontSize: 36,
  },
  resolvedBadge: {
    position: 'absolute' as const, top: 8, right: 8,
    background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 700,
    padding: '3px 8px', borderRadius: 20,
  },
  photoOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
    padding: 12,
  },
  overlayTitle: { color: '#fff', fontWeight: 600, fontSize: 13 },
  overlaySub: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  cardBody: { padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12 },
  meta: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    fontSize: 12, color: '#6b7280',
  },
  metaName: { fontWeight: 500, color: '#374151' },
  countChip: {
    background: '#f3f4f6', color: '#4b5563', padding: '2px 8px',
    borderRadius: 4, fontWeight: 500, fontSize: 12,
  },
  aiBox: {
    background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 8, padding: 12,
  },
  aiLabel: { color: '#2563eb', fontSize: 11, fontWeight: 700, marginBottom: 4 },
  aiSuggestion: { color: '#1e3a5f', fontWeight: 600, fontSize: 13 },
  aiReason: { color: '#3b82f6', fontSize: 11, marginTop: 4 },
  identifyBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '8px 12px', background: '#eff6ff', color: '#1d4ed8',
    fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #dbeafe',
    cursor: 'pointer',
  },
  resolvedBox: {
    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, color: '#166534', fontWeight: 500,
  },
  resolveRow: { display: 'flex', gap: 8 },
  select: {
    flex: 1, fontSize: 13, border: '1px solid #e5e2db', borderRadius: 8,
    padding: '8px 10px', background: '#fff',
  },
  confirmBtn: {
    padding: '8px 14px', background: '#1c3a2a', color: '#fff',
    fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
    cursor: 'pointer',
  },
  empty: { textAlign: 'center' as const, padding: '80px 0', color: '#9aaa9f' },
}

export default function QcUnknownsPage() {
  const { isSuperAdmin, contextLoaded } = useUserContext()
  const modules = useOrgModules()
  const [issues, setIssues] = useState<UnknownIssue[]>([])
  const [pests, setPests] = useState<Pest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPest, setSelectedPest] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'all'>('pending')

  useEffect(() => { if (contextLoaded) loadData() }, [contextLoaded])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: orgUser } = await supabase
      .from('organisation_users')
      .select('role, organisation_id')
      .eq('user_id', session.user.id)
      .single()

    let farmIds: string[] = []
    if (orgUser?.role === 'super_admin') {
      const { data: allFarms } = await supabase.from('farms').select('id').eq('is_active', true)
      farmIds = (allFarms ?? []).map((f: any) => f.id)
    } else if (orgUser?.role === 'org_admin') {
      const { data: orgFarms } = await supabase.from('farms').select('id').eq('organisation_id', orgUser.organisation_id)
      farmIds = (orgFarms ?? []).map((f: any) => f.id)
    } else {
      const { data: farmAccess } = await supabase.from('user_farm_access').select('farm_id').eq('user_id', session.user.id)
      farmIds = (farmAccess ?? []).map((f: any) => f.farm_id)
    }

    const { data: raw } = await supabase.rpc('get_unknown_qc_issues', { p_farm_ids: farmIds })
    const { data: pestData } = await supabase.from('pests').select('id, name').order('name')
    setPests(pestData ?? [])

    const withUrls = await Promise.all((raw ?? []).map(async (item: UnknownIssue) => {
      const url = await getSignedUrl(item.photo_url, session.access_token)
      return { ...item, _signedUrl: url ?? undefined }
    }))

    setIssues(withUrls)
    setLoading(false)
  }

  async function getSignedUrl(path: string, token: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/qc-unknown-photos/${path}`,
        {
          method: 'POST',
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expiresIn: 3600 }),
        }
      )
      const data = await res.json()
      if (data.signedURL) return `${SUPABASE_URL}/storage/v1${data.signedURL}`
      return null
    } catch { return null }
  }

  async function identify(issueId: string) {
    setIssues(prev => prev.map(i => i.issue_id === issueId ? { ...i, _identifying: true } : i))
    try {
      const res = await fetch('/api/qc/identify-unknown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue_id: issueId }),
      })
      const data = await res.json()
      setIssues(prev => prev.map(i => i.issue_id === issueId
        ? { ...i, _identifying: false, ai_suggestion: data.suggestion, ai_reasoning: data.reasoning }
        : i
      ))
    } catch {
      setIssues(prev => prev.map(i => i.issue_id === issueId ? { ...i, _identifying: false } : i))
    }
  }

  async function resolve(issueId: string) {
    const pestId = selectedPest[issueId]
    if (!pestId) return
    setIssues(prev => prev.map(i => i.issue_id === issueId ? { ...i, _resolving: true } : i))

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('resolve_unknown_qc_issue', {
      p_issue_id: issueId,
      p_pest_id: pestId,
      p_resolved_by: user?.id,
    })

    setIssues(prev => prev.map(i => i.issue_id === issueId
      ? { ...i, _resolving: false, _resolved: true, resolved_pest_id: pestId }
      : i
    ))
  }

  const displayed = issues.filter(i => {
    if (filter === 'pending')  return !i.resolved_pest_id && !i._resolved
    if (filter === 'resolved') return  i.resolved_pest_id ||  i._resolved
    return true
  })

  const pendingCount  = issues.filter(i => !i.resolved_pest_id && !i._resolved).length
  const resolvedCount = issues.filter(i =>  i.resolved_pest_id ||  i._resolved).length

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div style={s.page}>
      <style>{`html, body { background: #f8f7f4 !important; }`}</style>
      <ManagerSidebarStyles />
      <ManagerSidebar isSuperAdmin={isSuperAdmin} modules={modules} />

      <main style={s.main}>
        <div style={s.pageHeader}>
          <div>
            <div style={s.pageTitle}>Unknown QC Issues</div>
            <div style={s.pageSub}>Review and classify unidentified defects</div>
          </div>
          <div style={s.badges}>
            <span style={s.badgePending}>{pendingCount} pending</span>
            <span style={s.badgeResolved}>{resolvedCount} resolved</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={s.filterGroup}>
          {(['pending', 'resolved', 'all'] as const).map(f => (
            <button
              key={f}
              style={filter === f ? s.pillActive : s.pill}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading && <div style={s.empty}>Loading...</div>}

        {!loading && displayed.length === 0 && (
          <div style={s.empty}>
            {filter === 'pending' ? 'No unknown issues waiting for review' : 'No issues found'}
          </div>
        )}

        <div style={s.grid}>
          {displayed.map(issue => {
            const isResolved = issue.resolved_pest_id || issue._resolved
            const resolvedPestName = isResolved
              ? pests.find(p => p.id === (issue.resolved_pest_id || selectedPest[issue.issue_id]))?.name
              : null

            return (
              <div key={issue.issue_id} style={isResolved ? s.cardResolved : s.card}>
                {/* Photo */}
                <div style={s.photo}>
                  {issue._signedUrl ? (
                    <img src={issue._signedUrl} alt="Unknown QC issue" style={s.img} />
                  ) : (
                    <div style={s.photoPlaceholder}>📷</div>
                  )}
                  {isResolved && <div style={s.resolvedBadge}>✓ Resolved</div>}
                  <div style={s.photoOverlay}>
                    <div style={s.overlayTitle}>{issue.orchard_name}</div>
                    <div style={s.overlaySub}>{issue.commodity_name}</div>
                  </div>
                </div>

                <div style={s.cardBody}>
                  {/* Context */}
                  <div style={s.meta}>
                    <div>
                      <div style={s.metaName}>{issue.employee_name}</div>
                      <div>Bag #{issue.bag_seq} · {fmtDate(issue.collected_at)}</div>
                    </div>
                    <span style={s.countChip}>Count: {issue.count}</span>
                  </div>

                  {/* AI suggestion (only shown if already identified) */}
                  {issue.ai_suggestion && (
                    <div style={s.aiBox}>
                      <div style={s.aiLabel}>🤖 AI Suggestion</div>
                      <div style={s.aiSuggestion}>{issue.ai_suggestion}</div>
                      {issue.ai_reasoning && <div style={s.aiReason}>{issue.ai_reasoning}</div>}
                    </div>
                  )}

                  {/* Resolve section */}
                  {isResolved ? (
                    <div style={s.resolvedBox}>
                      ✓ Classified as: {resolvedPestName || pests.find(p => p.id === issue.resolved_pest_id)?.name || 'Unknown pest'}
                    </div>
                  ) : (
                    <div style={s.resolveRow}>
                      <select
                        value={selectedPest[issue.issue_id] || ''}
                        onChange={e => setSelectedPest(prev => ({ ...prev, [issue.issue_id]: e.target.value }))}
                        style={s.select}
                      >
                        <option value="">Classify as...</option>
                        {issue.ai_suggestion && (
                          <optgroup label="AI Suggestion">
                            {pests
                              .filter(p => p.name.toLowerCase().includes(issue.ai_suggestion!.toLowerCase().split(' ')[0]))
                              .slice(0, 3)
                              .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                            }
                          </optgroup>
                        )}
                        <optgroup label="All pests">
                          {pests.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </optgroup>
                      </select>
                      <button
                        onClick={() => resolve(issue.issue_id)}
                        disabled={!selectedPest[issue.issue_id] || issue._resolving}
                        style={{ ...s.confirmBtn, opacity: (!selectedPest[issue.issue_id] || issue._resolving) ? 0.3 : 1 }}
                      >
                        {issue._resolving ? '...' : 'Confirm'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-auth'
import Link from 'next/link'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SERVICE_KEY_HEADER = '' // signed URLs handled server-side

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
  // client-side
  _signedUrl?: string
  _identifying?: boolean
  _resolving?: boolean
  _resolved?: boolean
}

interface Pest {
  id: string
  name: string
}

export default function QcUnknownsPage() {
  const [issues, setIssues] = useState<UnknownIssue[]>([])
  const [pests, setPests] = useState<Pest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPest, setSelectedPest] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'all'>('pending')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Get farm IDs for this user
    const { data: farmAccess } = await supabase
      .from('user_farm_access')
      .select('farm_id')
    const farmIds = farmAccess?.map(f => f.farm_id) ?? []

    // Fetch unknowns via RPC
    const { data: raw } = await supabase.rpc('get_unknown_qc_issues', {
      p_farm_ids: farmIds,
    })

    // Fetch all pests for the resolve dropdown
    const { data: pestData } = await supabase
      .from('pests')
      .select('id, name')
      .order('name')

    setPests(pestData ?? [])

    // Generate signed URLs for all photos
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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 max-w-6xl mx-auto">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-900">Unknown QC Issues</h1>
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              {pendingCount} pending
            </span>
            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
              {resolvedCount} resolved
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(['pending', 'resolved', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        )}

        {!loading && displayed.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            {filter === 'pending' ? '✅ No unknown issues waiting for review' : 'No issues found'}
          </div>
        )}

        {/* Issue cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayed.map(issue => {
            const isResolved = issue.resolved_pest_id || issue._resolved
            const resolvedPestName = isResolved
              ? pests.find(p => p.id === (issue.resolved_pest_id || selectedPest[issue.issue_id]))?.name
              : null

            return (
              <div
                key={issue.issue_id}
                className={`bg-white rounded-xl border overflow-hidden shadow-sm ${
                  isResolved ? 'border-green-200 opacity-75' : 'border-gray-200'
                }`}
              >
                {/* Photo */}
                <div className="relative bg-gray-100 h-48">
                  {issue._signedUrl ? (
                    <img
                      src={issue._signedUrl}
                      alt="Unknown QC issue"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📷</div>
                  )}
                  {isResolved && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      ✓ Resolved
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <div className="text-white font-semibold text-sm">{issue.orchard_name}</div>
                    <div className="text-white/80 text-xs">{issue.commodity_name}</div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Context */}
                  <div className="flex justify-between items-start text-xs text-gray-500">
                    <div>
                      <div className="font-medium text-gray-700">{issue.employee_name}</div>
                      <div>Bag #{issue.bag_seq} · {formatDate(issue.collected_at)}</div>
                    </div>
                    <div className="text-right">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                        Count: {issue.count}
                      </span>
                    </div>
                  </div>

                  {/* AI suggestion */}
                  {issue.ai_suggestion ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-blue-600 text-xs font-bold">🤖 AI Suggestion</span>
                      </div>
                      <div className="text-blue-900 font-semibold text-sm">{issue.ai_suggestion}</div>
                      {issue.ai_reasoning && (
                        <div className="text-blue-700 text-xs mt-1">{issue.ai_reasoning}</div>
                      )}
                    </div>
                  ) : !isResolved ? (
                    <button
                      onClick={() => identify(issue.issue_id)}
                      disabled={issue._identifying}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg border border-blue-100 transition-colors disabled:opacity-50"
                    >
                      {issue._identifying ? (
                        <>⏳ Identifying...</>
                      ) : (
                        <>🤖 Ask Claude to identify</>
                      )}
                    </button>
                  ) : null}

                  {/* Resolve section */}
                  {isResolved ? (
                    <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">
                      ✓ Classified as: {resolvedPestName || pests.find(p => p.id === issue.resolved_pest_id)?.name || 'Unknown pest'}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={selectedPest[issue.issue_id] || ''}
                        onChange={e => setSelectedPest(prev => ({ ...prev, [issue.issue_id]: e.target.value }))}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
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
                        className="px-3 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg disabled:opacity-30 hover:bg-gray-700 transition-colors"
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
      </div>
    </div>
  )
}

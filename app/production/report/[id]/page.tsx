'use client'

import { createClient } from '@/lib/supabase-auth'
import { usePageGuard } from '@/lib/usePageGuard'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LabelList,
  LineChart, Line, Legend, ResponsiveContainer,
} from 'recharts'

// ─── Season helpers ───────────────────────────────────────────────────────────

function getCurrentSeason(): string {
  const now = new Date()
  const yr = now.getFullYear()
  const mo = now.getMonth() + 1
  return `${mo < 8 ? yr - 1 : yr}/${String(mo < 8 ? yr : yr + 1).slice(-2)}`
}

function buildSeasonOptions(fromYear: number): string[] {
  const currentStartYr = parseInt(getCurrentSeason().split('/')[0])
  const seasons: string[] = []
  for (let yr = fromYear; yr <= currentStartYr; yr++)
    seasons.push(`${yr}/${String(yr + 1).slice(-2)}`)
  return seasons.reverse()
}

function seasonDateRange(season: string): { from: string; to: string } {
  const startYr = parseInt(season.split('/')[0])
  return { from: `${startYr}-08-01T00:00:00Z`, to: `${startYr + 1}-07-31T23:59:59Z` }
}

// ─── Norm helpers ─────────────────────────────────────────────────────────────

interface NormRange {
  min_optimal: number; max_optimal: number
  min_adequate: number | null; max_adequate: number | null
}

function normColor(value: number, norm: NormRange | undefined): string {
  if (!norm) return '#1a2a3a'
  if (value >= norm.min_optimal && value <= norm.max_optimal) return '#4caf72'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return '#f5c842'
  }
  if (norm.min_adequate != null || norm.max_adequate != null) return '#e85a4a'
  return '#1a2a3a'
}

function normBg(value: number, norm: NormRange | undefined): string {
  if (!norm) return 'transparent'
  if (value >= norm.min_optimal && value <= norm.max_optimal) return 'rgba(76,175,114,0.12)'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return 'rgba(245,200,66,0.12)'
  }
  if (norm.min_adequate != null || norm.max_adequate != null) return 'rgba(232,90,74,0.12)'
  return 'transparent'
}

function normLabel(value: number, norm: NormRange | undefined): string {
  if (!norm) return ''
  if (value >= norm.min_optimal && value <= norm.max_optimal) return 'Optimal'
  if (norm.min_adequate != null && norm.max_adequate != null) {
    if (value >= norm.min_adequate && value <= norm.max_adequate) return 'Adequate'
  }
  if (value < (norm.min_adequate ?? norm.min_optimal)) return 'Low'
  if (value > (norm.max_adequate ?? norm.max_optimal)) return 'High'
  return ''
}

// ─── Score calculator ─────────────────────────────────────────────────────────

function calculateScore(input: {
  tonHa: number | null; benchmarkTarget: number | null; farmAvgTonHa: number | null
  leafNutrients: Record<string, number>; norms: Record<string, NormRange>
  issueRate: number | null; pctUpperBins: number | null
}): number {
  let total = 0
  const MACRO_CODES = ['N', 'P', 'K', 'Ca', 'Mg']
  const baseline = input.benchmarkTarget ?? input.farmAvgTonHa
  if (input.tonHa != null && baseline != null && baseline > 0) {
    const ratio = input.tonHa / baseline
    if (ratio >= 1.2) total += 30
    else if (ratio >= 1.0) total += 30 * 0.85
    else if (ratio >= 0.8) total += 30 * 0.5
    else total += 30 * 0.2 * Math.max(ratio / 0.8, 0)
  } else total += 15
  const macros = MACRO_CODES.filter(c => input.leafNutrients[c] != null && input.norms[c])
  if (macros.length > 0) {
    let inOpt = 0
    for (const c of macros) {
      const v = input.leafNutrients[c], n = input.norms[c]
      if (v >= n.min_optimal && v <= n.max_optimal) inOpt++
    }
    total += 25 * (inOpt / macros.length)
  } else total += 12.5
  if (input.issueRate != null) total += 25 * Math.max(0, 1 - input.issueRate / 10)
  else total += 12.5
  if (input.pctUpperBins != null) total += 20 * Math.min(input.pctUpperBins / 60, 1)
  else total += 10
  return Math.round(total)
}

// ─── Score ring SVG ───────────────────────────────────────────────────────────

function ScoreRing({ score, size = 90 }: { score: number; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = score >= 70 ? '#4caf72' : score >= 50 ? '#f5c842' : '#e85a4a'
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" style={{ fontSize: 26, fontWeight: 700, fill: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
        {score}
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" style={{ fontSize: 9, fontWeight: 600, fill: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: "'DM Sans', sans-serif" }}>
        Score
      </text>
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrchardMeta {
  id: string; name: string; variety: string | null; variety_group: string | null
  rootstock: string | null; year_planted: number | null; ha: number | null
  commodity_id: string; farm_id: string
  commodities: { code: string; name: string } | null
  farms: { full_name: string } | null
}
interface ProdRow { orchard_id: string; ton_ha: number | null; tons: number; bins: number }
interface SizeBinRow { orchard_id: string; bin_label: string; display_order: number; fruit_count: number; avg_weight_g: number }
interface IssueRow { orchard_id: string; pest_name: string; category: string; total_count: number }
interface TrendRow { season: string; nutrient_code: string; category: string; value: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Boundary = { orchard_id: string; geojson: any }

const NUTRIENT_COLORS: Record<string, string> = {
  N: '#5b9ef5', P: '#f0a500', K: '#5dd39c', Ca: '#f06e6e', Mg: '#b07ce8',
}
const MACRO_ORDER = ['N', 'P', 'K', 'Ca', 'Mg']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrchardReportPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded, allowed } = usePageGuard()
  const params = useParams()
  const orchardId = params.id as string

  const [loading, setLoading] = useState(true)
  const [orchard, setOrchard] = useState<OrchardMeta | null>(null)
  const [prodBySeason, setProdBySeason] = useState<Record<string, { tonHa: number | null; tons: number; bins: number }>>({})
  const [sizeBySeason, setSizeBySeason] = useState<Record<string, SizeBinRow[]>>({})
  const [issuesBySeason, setIssuesBySeason] = useState<Record<string, IssueRow[]>>({})
  const [benchmark, setBenchmark] = useState<number | null>(null)
  const [trendData, setTrendData] = useState<TrendRow[]>([])
  const [norms, setNorms] = useState<Record<string, NormRange>>({})
  const [boundary, setBoundary] = useState<Boundary | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  const currentSeason = getCurrentSeason()
  const seasons = useMemo(() => buildSeasonOptions(2018).slice(0, 6), [])

  // ── Load orchard metadata ──
  useEffect(() => {
    if (!contextLoaded || !orchardId) return
    let cancelled = false
    async function loadOrchard() {
      const { data } = await supabase
        .from('orchards')
        .select('id, name, variety, variety_group, rootstock, year_planted, ha, commodity_id, farm_id, commodities(code,name), farms(full_name)')
        .eq('id', orchardId).single()
      if (cancelled || !data) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any
      setOrchard({ ...d, commodities: Array.isArray(d.commodities) ? d.commodities[0] : d.commodities, farms: Array.isArray(d.farms) ? d.farms[0] : d.farms } as OrchardMeta)
    }
    loadOrchard()
    return () => { cancelled = true }
  }, [contextLoaded, orchardId])

  // ── Load all data ──
  useEffect(() => {
    if (!orchard) return
    let cancelled = false
    const farmId = orchard.farm_id
    async function loadAll() {
      setLoading(true)
      const prodPromises = seasons.map(s =>
        supabase.rpc('get_production_summary', { p_farm_ids: [farmId], p_season: s })
          .then(res => ({ season: s, data: (res.data || []) as ProdRow[] }))
      )
      const benchPromise = fetch(`/api/benchmarks?farm_ids=${farmId}&season=${encodeURIComponent(currentSeason)}`).then(r => r.ok ? r.json() : []).catch(() => [])
      const trendPromise = supabase.rpc('get_leaf_analysis_trend', { p_orchard_id: orchardId })
      const boundaryPromise = supabase.rpc('get_orchard_boundaries')
      const normsPromise = fetch('/api/leaf-analysis/norms').then(r => r.ok ? r.json() : { norms: [] }).catch(() => ({ norms: [] }))

      const [prodResults, benchData, trendRes, boundaryRes, normsRes] = await Promise.all([
        Promise.all(prodPromises), benchPromise, trendPromise, boundaryPromise, normsPromise,
      ])
      if (cancelled) return

      const pMap: Record<string, { tonHa: number | null; tons: number; bins: number }> = {}
      for (const { season: s, data } of prodResults) {
        const row = data.find(r => r.orchard_id === orchardId)
        if (row) pMap[s] = { tonHa: row.ton_ha != null ? Number(row.ton_ha) : null, tons: Number(row.tons || 0), bins: Number(row.bins || 0) }
      }
      setProdBySeason(pMap)

      const bRow = (benchData as { orchard_id: string; org_target: number | null; industry_target: number | null }[])?.find(r => r.orchard_id === orchardId)
      setBenchmark(bRow ? (bRow.org_target ?? bRow.industry_target) : null)
      setTrendData((trendRes.data || []) as TrendRow[])
      const bnd = ((boundaryRes.data || []) as Boundary[]).find(b => b.orchard_id === orchardId)
      setBoundary(bnd ?? null)

      const lookup: Record<string, NormRange> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sorted = [...(normsRes.norms || [])].sort((a: any, b: any) => {
        const aScore = (a.organisation_id ? 1 : 0) + (a.variety ? 1 : 0)
        const bScore = (b.organisation_id ? 1 : 0) + (b.variety ? 1 : 0)
        return aScore - bScore
      })
      for (const n of sorted) {
        const code = n.nutrients?.code
        if (!code) continue
        const range: NormRange = { min_optimal: Number(n.min_optimal), max_optimal: Number(n.max_optimal), min_adequate: n.min_adequate != null ? Number(n.min_adequate) : null, max_adequate: n.max_adequate != null ? Number(n.max_adequate) : null }
        if (!n.variety) lookup[`${n.commodity_id}:${code}`] = range
        if (n.commodity_id === orchard!.commodity_id && n.variety === orchard!.variety) lookup[code] = range
        if (n.commodity_id === orchard!.commodity_id && !n.variety && !lookup[code]) lookup[code] = range
      }
      const finalNorms: Record<string, NormRange> = {}
      for (const [key, val] of Object.entries(lookup)) { if (!key.includes(':')) finalNorms[key] = val }
      for (const [key, val] of Object.entries(lookup)) { if (key.includes(':')) { const code = key.split(':')[1]; if (!finalNorms[code]) finalNorms[code] = val } }
      setNorms(finalNorms)

      const sMap: Record<string, SizeBinRow[]> = {}
      const iMap: Record<string, IssueRow[]> = {}
      for (let i = 0; i < seasons.length; i += 2) {
        const batch = seasons.slice(i, i + 2)
        const results = await Promise.all(batch.flatMap(s => {
          const { from, to } = seasonDateRange(s)
          return [
            supabase.rpc('get_orchard_size_distribution_bulk', { p_farm_ids: [farmId], p_from: from, p_to: to, p_orchard_id: orchardId }).then(res => ({ season: s, type: 'size' as const, data: res.data || [] })),
            supabase.rpc('get_qc_issue_counts', { p_farm_id: farmId, p_from: from, p_to: to }).then(res => ({ season: s, type: 'issues' as const, data: res.data || [] })),
          ]
        }))
        if (cancelled) return
        for (const r of results) {
          if (r.type === 'size') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sMap[r.season] = (r.data as any[]).map(d => ({ orchard_id: d.orchard_id, bin_label: d.bin_label, display_order: d.display_order, fruit_count: Number(d.fruit_count), avg_weight_g: Number(d.avg_weight_g) }))
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            iMap[r.season] = (r.data as any[]).filter((d: any) => d.orchard_id === orchardId)
          }
        }
      }
      setSizeBySeason(sMap)
      setIssuesBySeason(iMap)
      setLoading(false)
    }
    loadAll()
    return () => { cancelled = true }
  }, [orchard, orchardId, currentSeason, seasons])

  // ── Leaflet map ──
  useEffect(() => {
    if (!boundary || !mapRef.current || mapInstanceRef.current) return
    import('leaflet').then(L => {
      // @ts-expect-error leaflet CSS side-effect import
      import('leaflet/dist/leaflet.css')
      const map = L.map(mapRef.current!, { zoomControl: false, attributionControl: false })
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map)
      const geo = L.geoJSON(boundary.geojson, { style: { color: '#f0a500', weight: 2, fillColor: '#f0a500', fillOpacity: 0.15 } }).addTo(map)
      map.fitBounds(geo.getBounds(), { padding: [30, 30] })
      mapInstanceRef.current = map
    })
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null } }
  }, [boundary])

  // ── Computed data ──
  const prodChartData = useMemo(() => [...seasons].reverse().map(s => ({ season: s, tonHa: prodBySeason[s]?.tonHa ?? null })).filter(d => d.tonHa !== null), [seasons, prodBySeason])
  const currentProd = prodBySeason[currentSeason]
  const age = orchard?.year_planted ? new Date().getFullYear() - orchard.year_planted : null

  const currentLeaf = useMemo(() => {
    const vals: Record<string, number> = {}
    for (const r of trendData) { if (r.season === currentSeason && r.category === 'macro') vals[r.nutrient_code] = r.value }
    return vals
  }, [trendData, currentSeason])

  const score = useMemo(() => {
    const curIssues = issuesBySeason[currentSeason] || []
    const curSize = sizeBySeason[currentSeason] || []
    const totalFruit = curSize.reduce((sum, b) => sum + b.fruit_count, 0)
    const totalIssueCount = curIssues.reduce((sum, i) => sum + i.total_count, 0)
    const issueRate = totalFruit > 0 ? (totalIssueCount / totalFruit) * 100 : null
    let pctUpper: number | null = null
    if (curSize.length > 0) {
      const sortedBins = [...curSize].sort((a, b) => a.display_order - b.display_order)
      const cutoff = Math.ceil(sortedBins.length * 0.4)
      const upperCount = sortedBins.slice(0, cutoff).reduce((sum, b) => sum + b.fruit_count, 0)
      pctUpper = totalFruit > 0 ? (upperCount / totalFruit) * 100 : null
    }
    return calculateScore({ tonHa: currentProd?.tonHa ?? null, benchmarkTarget: benchmark, farmAvgTonHa: null, leafNutrients: currentLeaf, norms, issueRate, pctUpperBins: pctUpper })
  }, [currentProd, benchmark, currentLeaf, norms, issuesBySeason, sizeBySeason, currentSeason])

  const allBinLabels = useMemo(() => {
    const labels = new Set<string>(); const orderMap = new Map<string, number>()
    for (const bins of Object.values(sizeBySeason)) { for (const b of bins) { labels.add(b.bin_label); if (!orderMap.has(b.bin_label)) orderMap.set(b.bin_label, b.display_order) } }
    return [...labels].sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0))
  }, [sizeBySeason])

  const allIssueNames = useMemo(() => {
    const names = new Set<string>()
    for (const issues of Object.values(issuesBySeason)) { for (const i of issues) names.add(i.pest_name) }
    return [...names].sort()
  }, [issuesBySeason])

  const displaySeasons = useMemo(() => [...seasons].reverse(), [seasons])

  const leafChartData = useMemo(() => {
    const seasonSet = [...new Set(trendData.filter(r => r.category === 'macro').map(r => r.season))].sort()
    return seasonSet.map(s => {
      const row: Record<string, string | number> = { season: s }
      for (const code of MACRO_ORDER) { const m = trendData.find(r => r.season === s && r.nutrient_code === code); if (m) row[code] = m.value }
      return row
    })
  }, [trendData])

  const currentSizeDist = useMemo(() => (sizeBySeason[currentSeason] || []).sort((a, b) => a.display_order - b.display_order), [sizeBySeason, currentSeason])

  if (!allowed) return null
  if (loading || !orchard) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#8a95a0', background: '#f4f2ee' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e8e4dc', borderTopColor: '#2176d9', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          Loading report...
        </div>
      </div>
    )
  }

  const commodityBadge = orchard.commodities?.code ?? ''

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        .rpt { max-width: 1120px; margin: 0 auto; font-family: 'DM Sans', sans-serif; color: #1a2a3a; background: #f4f2ee; min-height: 100vh; }

        /* ── Hero header ── */
        .rpt-hero {
          background: linear-gradient(135deg, #1a2a3a 0%, #243b50 60%, #2d4a5e 100%);
          padding: 28px 36px 32px; color: #fff; position: relative; overflow: hidden;
        }
        .rpt-hero::after {
          content: ''; position: absolute; top: -60%; right: -10%; width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(240,165,0,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .rpt-hero-back { font-size: 12px; color: rgba(255,255,255,0.5); text-decoration: none; display: inline-block; margin-bottom: 12px; transition: color 0.15s; }
        .rpt-hero-back:hover { color: rgba(255,255,255,0.85); }
        .rpt-hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; position: relative; z-index: 1; }
        .rpt-hero h1 { font-family: 'DM Serif Display', serif; font-size: 30px; font-weight: 400; margin: 0 0 4px; line-height: 1.15; }
        .rpt-hero-sub { font-size: 13px; color: rgba(255,255,255,0.55); }
        .rpt-hero-badge {
          display: inline-block; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 4px;
          background: rgba(240,165,0,0.2); color: #f0a500; letter-spacing: 0.5px; margin-top: 8px;
        }

        /* ── KPI strip ── */
        .rpt-kpis {
          display: flex; gap: 2px; margin: 0 36px; transform: translateY(-28px); position: relative; z-index: 2;
        }
        .rpt-kpi {
          flex: 1; background: #fff; padding: 16px 12px; text-align: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .rpt-kpi:first-child { border-radius: 12px 0 0 12px; }
        .rpt-kpi:last-child { border-radius: 0 12px 12px 0; }
        .rpt-kpi-val { font-size: 22px; font-weight: 700; color: #1a2a3a; font-variant-numeric: tabular-nums; line-height: 1.2; }
        .rpt-kpi-lbl { font-size: 10px; color: #8a95a0; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }

        /* ── Cards ── */
        .rpt-body { padding: 0 36px 64px; margin-top: -8px; }
        .rpt-card {
          background: #fff; border-radius: 16px; border: 1px solid #eae7e1;
          box-shadow: 0 1px 4px rgba(0,0,0,0.03); margin-bottom: 20px; overflow: hidden;
          animation: fadeUp 0.4s ease both;
        }
        .rpt-card-head {
          padding: 18px 24px 0; display: flex; align-items: center; gap: 10px;
        }
        .rpt-card-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .rpt-card-title { font-size: 13px; font-weight: 700; color: #1a2a3a; text-transform: uppercase; letter-spacing: 0.4px; }
        .rpt-card-body { padding: 16px 24px 24px; }

        /* ── Tables ── */
        .rpt-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
        .rpt-tbl th {
          padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; color: #8a95a0;
          text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eae7e1;
          white-space: nowrap; background: #faf9f7;
        }
        .rpt-tbl td { padding: 7px 10px; border-bottom: 1px solid #f2f0ec; white-space: nowrap; }
        .rpt-tbl tr:last-child td { border-bottom: none; }
        .rpt-tbl .cur { background: rgba(33,118,217,0.05); font-weight: 600; }
        .rpt-tbl .cur-th { background: rgba(33,118,217,0.08); font-weight: 700; }

        .rpt-nodata { color: #b5b0a7; font-size: 13px; font-style: italic; padding: 12px 0; }

        /* ── Print button ── */
        .rpt-print {
          padding: 7px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08); font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: inherit; color: rgba(255,255,255,0.7); transition: all 0.15s;
          backdrop-filter: blur(4px);
        }
        .rpt-print:hover { background: rgba(255,255,255,0.15); color: #fff; }

        @media print {
          .no-print { display: none !important; }
          .rpt { background: #fff; }
          .rpt-hero { background: #1a2a3a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rpt-card { box-shadow: none; page-break-inside: avoid; border: 1px solid #ddd; }
          .rpt-kpis { box-shadow: none; }
          .rpt-kpi { box-shadow: none; border: 1px solid #ddd; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media (max-width: 768px) {
          .rpt-hero { padding: 20px 18px 24px; }
          .rpt-kpis { margin: 0 18px; gap: 1px; transform: translateY(-20px); }
          .rpt-kpi { padding: 10px 6px; }
          .rpt-kpi-val { font-size: 16px; }
          .rpt-body { padding: 0 18px 48px; }
          .rpt-card-body { padding: 12px 16px 16px; }
          .rpt-hero h1 { font-size: 22px; }
        }
      `}</style>

      <div className="rpt">
        {/* ── Hero Header ── */}
        <div className="rpt-hero">
          <a href="/production/report" className="rpt-hero-back no-print">← Back to Reports</a>
          <div className="rpt-hero-top">
            <div style={{ flex: 1 }}>
              <h1>{orchard.name}</h1>
              <div className="rpt-hero-sub">
                {[orchard.variety, orchard.rootstock, orchard.year_planted ? `Planted ${orchard.year_planted}` : null, orchard.farms?.full_name].filter(Boolean).join(' \u00B7 ')}
              </div>
              <div className="rpt-hero-badge">{commodityBadge}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              <ScoreRing score={score} />
              <button className="rpt-print no-print" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="rpt-kpis">
          <div className="rpt-kpi">
            <div className="rpt-kpi-val">{orchard.ha?.toFixed(1) ?? '\u2014'}</div>
            <div className="rpt-kpi-lbl">Hectares</div>
          </div>
          <div className="rpt-kpi">
            <div className="rpt-kpi-val">{age ?? '\u2014'}</div>
            <div className="rpt-kpi-lbl">Age (yrs)</div>
          </div>
          <div className="rpt-kpi">
            <div className="rpt-kpi-val" style={{ color: currentProd?.tonHa != null ? '#2176d9' : '#bbb' }}>
              {currentProd?.tonHa != null ? currentProd.tonHa.toFixed(1) : '\u2014'}
            </div>
            <div className="rpt-kpi-lbl">T/Ha ({currentSeason})</div>
          </div>
          <div className="rpt-kpi">
            <div className="rpt-kpi-val" style={{ color: '#6a7a70' }}>{benchmark?.toFixed(1) ?? '\u2014'}</div>
            <div className="rpt-kpi-lbl">Benchmark</div>
          </div>
          <div className="rpt-kpi">
            <div className="rpt-kpi-val">{currentProd?.tons ? currentProd.tons.toLocaleString('en-ZA', { maximumFractionDigits: 1 }) : '\u2014'}</div>
            <div className="rpt-kpi-lbl">Total Tons</div>
          </div>
          <div className="rpt-kpi">
            <div className="rpt-kpi-val">{currentProd?.bins ? Math.round(currentProd.bins).toLocaleString('en-ZA') : '\u2014'}</div>
            <div className="rpt-kpi-lbl">Bins</div>
          </div>
        </div>

        <div className="rpt-body">
          {/* ── Production Trend ── */}
          <div className="rpt-card" style={{ animationDelay: '0.05s' }}>
            <div className="rpt-card-head">
              <div className="rpt-card-dot" style={{ background: '#2176d9' }} />
              <div className="rpt-card-title">Production Trend (T/Ha)</div>
            </div>
            <div className="rpt-card-body">
              {prodChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={prodChartData} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                    <XAxis dataKey="season" tick={{ fontSize: 11, fill: '#6a7a70' }} axisLine={{ stroke: '#e8e4dc' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#8a95a0' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} T/Ha`, 'Production']} contentStyle={{ fontSize: 12, borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }} />
                    {benchmark != null && (
                      <ReferenceLine y={benchmark} stroke="#e85a4a" strokeDasharray="6 4" label={{ value: `Target ${benchmark.toFixed(1)}`, position: 'right', fontSize: 10, fill: '#e85a4a' }} />
                    )}
                    <Bar dataKey="tonHa" radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {prodChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.season === currentSeason ? '#2176d9' : '#b8d4f0'} />
                      ))}
                      <LabelList dataKey="tonHa" position="top" formatter={(v) => v != null ? Number(v).toFixed(1) : ''} style={{ fontSize: 11, fontWeight: 600, fill: '#1a2a3a' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="rpt-nodata">No production data available</div>}
            </div>
          </div>

          {/* ── Size Distribution ── */}
          <div className="rpt-card" style={{ animationDelay: '0.1s' }}>
            <div className="rpt-card-head">
              <div className="rpt-card-dot" style={{ background: '#5dd39c' }} />
              <div className="rpt-card-title">Size Distribution</div>
            </div>
            <div className="rpt-card-body">
              {allBinLabels.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 28 }}>
                  {/* Left: current season horizontal bar */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                      {currentSeason}
                    </div>
                    {currentSizeDist.length > 0 ? (
                      <ResponsiveContainer width="100%" height={Math.max(currentSizeDist.length * 24, 120)}>
                        <BarChart data={currentSizeDist} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#8a95a0' }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="bin_label" type="category" tick={{ fontSize: 10, fill: '#6a7a70' }} width={80} interval={0} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v) => [Number(v).toLocaleString(), 'Fruit']} contentStyle={{ fontSize: 12, borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }} />
                          <Bar dataKey="fruit_count" fill="#5dd39c" radius={[0, 6, 6, 0]} maxBarSize={18}>
                            <LabelList dataKey="fruit_count" position="right" style={{ fontSize: 10, fill: '#6a7a70' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="rpt-nodata">No data this season</div>}
                  </div>
                  {/* Right: multi-season % table */}
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8a95a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                      Season Comparison (%)
                    </div>
                    <table className="rpt-tbl">
                      <thead>
                        <tr>
                          <th>Size</th>
                          {displaySeasons.map(s => (
                            <th key={s} className={s === currentSeason ? 'cur-th' : ''} style={{ textAlign: 'right' }}>
                              {s.split('/')[0].slice(-2)}/{s.split('/')[1]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allBinLabels.map(label => (
                          <tr key={label}>
                            <td style={{ fontWeight: 500, color: '#6a7a70' }}>{label}</td>
                            {displaySeasons.map(s => {
                              const bins = sizeBySeason[s] || []
                              const total = bins.reduce((sum, b) => sum + b.fruit_count, 0)
                              const bin = bins.find(b => b.bin_label === label)
                              const pct = total > 0 && bin ? ((bin.fruit_count / total) * 100) : null
                              return (
                                <td key={s} className={s === currentSeason ? 'cur' : ''} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {pct != null ? pct.toFixed(1) : '\u2014'}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : <div className="rpt-nodata">No QC size data available</div>}
            </div>
          </div>

          {/* ── Quality Issues ── */}
          <div className="rpt-card" style={{ animationDelay: '0.15s' }}>
            <div className="rpt-card-head">
              <div className="rpt-card-dot" style={{ background: '#e85a4a' }} />
              <div className="rpt-card-title">Quality Issues (%)</div>
            </div>
            <div className="rpt-card-body">
              {allIssueNames.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="rpt-tbl">
                    <thead>
                      <tr>
                        <th>Issue</th>
                        {displaySeasons.map(s => (
                          <th key={s} className={s === currentSeason ? 'cur-th' : ''} style={{ textAlign: 'right' }}>
                            {s.split('/')[0].slice(-2)}/{s.split('/')[1]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allIssueNames.map(name => {
                        const pcts = displaySeasons.map(s => {
                          const issue = (issuesBySeason[s] || []).find(i => i.pest_name === name)
                          const count = issue?.total_count ?? 0
                          const totalFruit = (sizeBySeason[s] || []).reduce((sum, b) => sum + b.fruit_count, 0)
                          return totalFruit > 0 ? (count / totalFruit) * 100 : null
                        })
                        const maxPct = Math.max(...pcts.map(p => p ?? 0), 0.01)
                        return (
                          <tr key={name}>
                            <td style={{ fontWeight: 500 }}>{name}</td>
                            {displaySeasons.map((s, idx) => {
                              const pct = pcts[idx]
                              const intensity = pct != null && maxPct > 0 ? pct / maxPct : 0
                              const heatBg = pct != null && pct > 0 ? `rgba(232, 90, 74, ${0.06 + intensity * 0.18})` : undefined
                              return (
                                <td key={s}
                                  className={s === currentSeason ? 'cur' : ''}
                                  style={{
                                    textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                                    background: heatBg,
                                  }}>
                                  {pct != null && pct > 0 ? `${pct.toFixed(1)}%` : '\u2014'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #e8e4dc' }}>
                        <td style={{ fontWeight: 700, fontSize: 11, color: '#1a2a3a' }}>Total</td>
                        {displaySeasons.map(s => {
                          const issues = issuesBySeason[s] || []
                          const totalCount = issues.reduce((sum, i) => sum + i.total_count, 0)
                          const totalFruit = (sizeBySeason[s] || []).reduce((sum, b) => sum + b.fruit_count, 0)
                          const totalPct = totalFruit > 0 ? (totalCount / totalFruit) * 100 : null
                          return (
                            <td key={s}
                              className={s === currentSeason ? 'cur' : ''}
                              style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12, color: '#1a2a3a' }}>
                              {totalPct != null && totalPct > 0 ? `${totalPct.toFixed(1)}%` : '\u2014'}
                            </td>
                          )
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : <div className="rpt-nodata">No quality issue data available</div>}
            </div>
          </div>

          {/* ── Leaf Analysis ── */}
          <div className="rpt-card" style={{ animationDelay: '0.2s' }}>
            <div className="rpt-card-head">
              <div className="rpt-card-dot" style={{ background: '#f0a500' }} />
              <div className="rpt-card-title">Leaf Analysis</div>
            </div>
            <div className="rpt-card-body">
              {leafChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={leafChartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                      <XAxis dataKey="season" tick={{ fontSize: 11, fill: '#6a7a70' }} axisLine={{ stroke: '#e8e4dc' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#8a95a0' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      {MACRO_ORDER.map(code => (
                        <Line key={code} dataKey={code} stroke={NUTRIENT_COLORS[code]} strokeWidth={2.5} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Nutrient grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 20 }}>
                    {MACRO_ORDER.map(code => {
                      const val = currentLeaf[code]
                      const norm = norms[code]
                      if (val == null) return (
                        <div key={code} style={{ padding: '12px 14px', borderRadius: 10, background: '#faf9f7', border: '1px solid #f0ede8' }}>
                          <div style={{ fontSize: 11, color: '#8a95a0', fontWeight: 600 }}>{code}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#ccc', marginTop: 2 }}>{'\u2014'}</div>
                        </div>
                      )
                      return (
                        <div key={code} style={{ padding: '12px 14px', borderRadius: 10, background: normBg(val, norm), border: `1px solid ${normColor(val, norm)}22` }}>
                          <div style={{ fontSize: 11, color: '#8a95a0', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span>{code}</span>
                            {norm && <span style={{ fontSize: 9, color: normColor(val, norm), fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{normLabel(val, norm)}</span>}
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: normColor(val, norm), fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                            {val.toFixed(2)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : <div className="rpt-nodata">No leaf analysis data available</div>}
            </div>
          </div>

          {/* ── Satellite Map ── */}
          {boundary && (
            <div className="rpt-card no-print" style={{ animationDelay: '0.25s' }}>
              <div className="rpt-card-head">
                <div className="rpt-card-dot" style={{ background: '#8a95a0' }} />
                <div className="rpt-card-title">Orchard Boundary</div>
              </div>
              <div style={{ padding: '12px 24px 24px' }}>
                <div ref={mapRef} style={{ width: '100%', height: 320, borderRadius: 12, overflow: 'hidden' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Need Cell import for per-bar coloring
import { Cell } from 'recharts'

// Leaflet type reference (dynamic import)
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace L {
  interface Map { remove(): void; fitBounds(bounds: LatLngBounds, options?: { padding?: [number, number] }): void }
  interface LatLngBounds {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function map(el: HTMLElement, opts?: any): Map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function tileLayer(url: string, opts?: any): { addTo(map: Map): void }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function geoJSON(data: any, opts?: any): { addTo(map: Map): void; getBounds(): LatLngBounds }
}

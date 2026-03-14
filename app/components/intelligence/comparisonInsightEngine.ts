/**
 * Pure comparison insight engine — generates cross-orchard comparative insights.
 * No React, no API calls. All data pre-fetched and passed in.
 */

import type { NormRange } from './insightEngine'

export interface CompareOrchardData {
  orchardId: string
  orchardName: string
  variety: string | null
  score: number
  tonHa: number | null
  prevTonHa: number | null
  leafN: number | null
  leafK: number | null
  leafCa: number | null
  nNorm: NormRange | null
  kNorm: NormRange | null
  caNorm: NormRange | null
  fertConfirmedPct: number | null
  fertNKgHa: number | null
  fertPKgHa: number | null
  fertKKgHa: number | null
  avgWeightG: number | null
  totalIssueRate: number | null
  topIssue: { name: string; pct: number } | null
}

export interface ComparisonInsight {
  severity: 'info' | 'warning'
  text: string
}

function normStatus(value: number | null, norm: NormRange | null): 'low' | 'optimal' | 'high' | null {
  if (value == null || !norm) return null
  if (value >= norm.min_optimal && value <= norm.max_optimal) return 'optimal'
  if (value < norm.min_optimal) return 'low'
  return 'high'
}

export function generateComparisonInsights(orchards: CompareOrchardData[]): ComparisonInsight[] {
  if (orchards.length < 2) return []
  const insights: ComparisonInsight[] = []

  // Helper: find best/worst by a metric
  const withMetric = <T>(getter: (o: CompareOrchardData) => T | null) =>
    orchards.filter(o => getter(o) != null).map(o => ({ o, v: getter(o) as T }))

  // Rule 1: Score gap > 20
  const scored = orchards.filter(o => o.score != null)
  if (scored.length >= 2) {
    const best = scored.reduce((a, b) => a.score > b.score ? a : b)
    const worst = scored.reduce((a, b) => a.score < b.score ? a : b)
    if (best.score - worst.score > 20) {
      // Find top contributing factor
      let factor = ''
      const bTon = best.tonHa, wTon = worst.tonHa
      const bIssue = best.totalIssueRate, wIssue = worst.totalIssueRate
      if (bTon != null && wTon != null && bTon > 0 && Math.abs(bTon - wTon) / bTon > 0.25) {
        factor = 'production'
      } else if (bIssue != null && wIssue != null && Math.abs(bIssue - wIssue) > 2) {
        factor = 'quality'
      } else {
        const bNStatus = normStatus(best.leafN, best.nNorm)
        const wNStatus = normStatus(worst.leafN, worst.nNorm)
        if (bNStatus === 'optimal' && wNStatus !== 'optimal') factor = 'N status'
        else factor = 'multiple factors'
      }
      insights.push({
        severity: 'warning',
        text: `${best.orchardName} scores ${best.score} vs ${worst.orchardName} at ${worst.score} — ${factor} is the main differentiator.`,
      })
    }
  }

  // Rule 2: T/Ha divergence > 30%
  const withTon = withMetric(o => o.tonHa)
  if (withTon.length >= 2) {
    const best = withTon.reduce((a, b) => a.v > b.v ? a : b)
    const worst = withTon.reduce((a, b) => a.v < b.v ? a : b)
    if (best.v > 0 && ((best.v - worst.v) / best.v) > 0.3) {
      const gap = ((best.v - worst.v) / worst.v * 100).toFixed(0)
      insights.push({
        severity: 'warning',
        text: `${best.o.orchardName} produces ${best.v.toFixed(1)} T/Ha vs ${worst.o.orchardName} at ${worst.v.toFixed(1)} (${gap}% gap). Compare inputs and orchard age.`,
      })
    }
  }

  // Rule 3: Same variety, different outcomes
  const varieties = new Set(orchards.map(o => o.variety?.toLowerCase()).filter(Boolean))
  for (const v of varieties) {
    const sameVar = orchards.filter(o => o.variety?.toLowerCase() === v && o.tonHa != null)
    if (sameVar.length >= 2) {
      const best = sameVar.reduce((a, b) => (a.tonHa ?? 0) > (b.tonHa ?? 0) ? a : b)
      const worst = sameVar.reduce((a, b) => (a.tonHa ?? 0) < (b.tonHa ?? 0) ? a : b)
      if (best.tonHa != null && worst.tonHa != null && worst.tonHa > 0) {
        const gap = ((best.tonHa - worst.tonHa) / worst.tonHa) * 100
        if (gap > 25) {
          insights.push({
            severity: 'info',
            text: `Both ${best.variety}, but ${best.orchardName} yields ${gap.toFixed(0)}% more — compare fert programme and rootstock.`,
          })
        }
      }
    }
  }

  // Rule 4: N:Ca ratio + bitter pit gap
  const withBitterPit = orchards.filter(o =>
    o.topIssue && o.topIssue.name.toLowerCase().includes('bitter pit') && o.topIssue.pct > 2
    && o.leafN != null && o.leafCa != null && o.leafCa > 0
  )
  const withoutBitterPit = orchards.filter(o =>
    !o.topIssue || !o.topIssue.name.toLowerCase().includes('bitter pit') || o.topIssue.pct <= 2
  )
  if (withBitterPit.length > 0 && withoutBitterPit.length > 0) {
    const bp = withBitterPit[0]
    const ratio = bp.leafN != null && bp.leafCa != null && bp.leafCa > 0
      ? (bp.leafN / bp.leafCa).toFixed(1) : null
    if (ratio) {
      insights.push({
        severity: 'warning',
        text: `N:Ca imbalance (${ratio}:1) in ${bp.orchardName} likely driving bitter pit difference.`,
      })
    }
  }

  // Rule 5: Issue rate divergence
  const withIssues = withMetric(o => o.totalIssueRate)
  if (withIssues.length >= 2) {
    const highest = withIssues.reduce((a, b) => a.v > b.v ? a : b)
    const lowest = withIssues.reduce((a, b) => a.v < b.v ? a : b)
    if (highest.v > 3 && lowest.v < 1) {
      const topIssueName = highest.o.topIssue?.name || 'unknown issues'
      insights.push({
        severity: 'warning',
        text: `${highest.o.orchardName} has ${highest.v.toFixed(1)}% total issues vs ${lowest.v.toFixed(1)}% for ${lowest.o.orchardName} — ${topIssueName} accounts for most of the gap.`,
      })
    }
  }

  // Rule 6: Nutrient divergence (N, K, Ca)
  const nutrients: Array<{ code: string; getter: (o: CompareOrchardData) => number | null; normGetter: (o: CompareOrchardData) => NormRange | null }> = [
    { code: 'N', getter: o => o.leafN, normGetter: o => o.nNorm },
    { code: 'K', getter: o => o.leafK, normGetter: o => o.kNorm },
    { code: 'Ca', getter: o => o.leafCa, normGetter: o => o.caNorm },
  ]
  for (const { code, getter, normGetter } of nutrients) {
    const withNutrient = orchards.filter(o => getter(o) != null && normGetter(o) != null)
    if (withNutrient.length < 2) continue
    const statuses = withNutrient.map(o => ({ o, status: normStatus(getter(o), normGetter(o)) }))
    const optimal = statuses.filter(s => s.status === 'optimal')
    const notOptimal = statuses.filter(s => s.status === 'low' || s.status === 'high')
    if (optimal.length > 0 && notOptimal.length > 0) {
      const optO = optimal[0]
      const badO = notOptimal[0]
      const optVal = getter(optO.o)
      const badVal = getter(badO.o)
      if (optVal != null && badVal != null) {
        insights.push({
          severity: 'info',
          text: `${code} status differs: ${optO.o.orchardName} optimal (${optVal.toFixed(2)}%), ${badO.o.orchardName} ${badO.status} (${badVal.toFixed(2)}%).`,
        })
      }
      break // only one nutrient insight
    }
  }

  // Rule 7: Fert compliance gap > 30pp
  const withFert = withMetric(o => o.fertConfirmedPct)
  if (withFert.length >= 2) {
    const best = withFert.reduce((a, b) => a.v > b.v ? a : b)
    const worst = withFert.reduce((a, b) => a.v < b.v ? a : b)
    if (best.v - worst.v > 30) {
      insights.push({
        severity: 'info',
        text: `${best.o.orchardName} at ${best.v.toFixed(0)}% compliance vs ${worst.v.toFixed(0)}% for ${worst.o.orchardName} — missed applications may explain nutrient gaps.`,
      })
    }
  }

  // Rule 8: Size gap > 15%
  const withSize = withMetric(o => o.avgWeightG)
  if (withSize.length >= 2) {
    const best = withSize.reduce((a, b) => a.v > b.v ? a : b)
    const worst = withSize.reduce((a, b) => a.v < b.v ? a : b)
    if (worst.v > 0 && ((best.v - worst.v) / worst.v) > 0.15) {
      const gap = ((best.v - worst.v) / worst.v * 100).toFixed(0)
      insights.push({
        severity: 'info',
        text: `${best.o.orchardName} averages ${best.v.toFixed(0)}g vs ${worst.v.toFixed(0)}g (${gap}% heavier). Check crop load and K status.`,
      })
    }
  }

  return insights
}

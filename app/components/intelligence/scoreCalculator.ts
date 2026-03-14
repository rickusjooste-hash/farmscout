/**
 * Composite 0-100 score per orchard.
 * Summarises performance across 5 data streams.
 */

export interface NormRange {
  min_optimal: number
  max_optimal: number
  min_adequate: number | null
  max_adequate: number | null
}

export interface ScoreInput {
  // Production
  tonHa: number | null
  farmAvgTonHa: number | null
  // Leaf health (nutrient code → value)
  leafNutrients: Record<string, number>
  norms: Record<string, NormRange>
  // Quality (issue rate %)
  issueRate: number | null       // total issue % across all issues
  // Fert compliance (0-100)
  fertConfirmedPct: number | null
  // Size profile
  dominantSizeBin: string | null
  pctUpperBins: number | null    // % of fruit in upper (good) size bins
}

const MACRO_CODES = ['N', 'P', 'K', 'Ca', 'Mg']

export function calculateScore(input: ScoreInput): number {
  let total = 0

  // ── Production: 30 points ──
  const prodMax = 30
  if (input.tonHa != null && input.farmAvgTonHa != null && input.farmAvgTonHa > 0) {
    const ratio = input.tonHa / input.farmAvgTonHa
    if (ratio >= 1.2) total += prodMax
    else if (ratio >= 1.0) total += prodMax * 0.85
    else if (ratio >= 0.8) total += prodMax * 0.5
    else total += prodMax * 0.2 * Math.max(ratio / 0.8, 0)
  } else {
    total += prodMax * 0.5 // missing → neutral
  }

  // ── Leaf health: 25 points ──
  const leafMax = 25
  const macrosAvailable = MACRO_CODES.filter(c => input.leafNutrients[c] != null && input.norms[c])
  if (macrosAvailable.length > 0) {
    let inOptimal = 0
    for (const code of macrosAvailable) {
      const val = input.leafNutrients[code]
      const norm = input.norms[code]
      if (val >= norm.min_optimal && val <= norm.max_optimal) inOptimal++
    }
    total += leafMax * (inOptimal / macrosAvailable.length)
  } else {
    total += leafMax * 0.5
  }

  // ── Quality: 25 points ──
  const qualMax = 25
  if (input.issueRate != null) {
    // 0% issues = full score, 10%+ = 0
    const issueScore = Math.max(0, 1 - input.issueRate / 10)
    total += qualMax * issueScore
  } else {
    total += qualMax * 0.5
  }

  // ── Fert compliance: 10 points ──
  const fertMax = 10
  if (input.fertConfirmedPct != null) {
    total += fertMax * (input.fertConfirmedPct / 100)
  } else {
    total += fertMax * 0.5
  }

  // ── Size profile: 10 points ──
  const sizeMax = 10
  if (input.pctUpperBins != null) {
    // 60%+ in upper bins = full score, 0% = 0
    total += sizeMax * Math.min(input.pctUpperBins / 60, 1)
  } else {
    total += sizeMax * 0.5
  }

  return Math.round(total)
}

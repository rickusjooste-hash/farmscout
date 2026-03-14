/**
 * Pure rule engine — generates agronomic insights by cross-referencing
 * fertilizer, leaf analysis, production, size, and quality data per orchard.
 *
 * No React, no API calls. All data pre-fetched and passed in.
 * Rules validated by soil scientist (Dr. Marie) for SA deciduous fruit (Western Cape).
 */

export interface NormRange {
  min_optimal: number
  max_optimal: number
  min_adequate: number | null
  max_adequate: number | null
}

export interface OrchardData {
  orchardId: string
  orchardName: string
  variety: string | null
  rootstock: string | null
  yearPlanted: number | null
  commodityId: string
  commodityCode: string | null       // 'APPLE', 'PEAR', 'STONE' — for commodity-aware thresholds
  ha: number | null
  // Leaf analysis (nutrient code → value)
  leafNutrients: Record<string, number>
  // Norms (nutrient code → range)
  norms: Record<string, NormRange>
  // Production
  tonHa: number | null
  prevTonHa: number | null
  // Fertilizer
  fertConfirmedPct: number | null   // 0-100
  fertNAppliedKgHa: number | null
  fertPAppliedKgHa: number | null   // total P applied kg/ha
  fertKAppliedKgHa: number | null   // total K applied kg/ha
  // Size
  dominantSizeBin: string | null
  avgWeightG: number | null
  prevAvgWeightG: number | null
  pctSmallBins: number | null       // % of fruit in small bins (bottom 40%)
  pctLargeBins: number | null       // % of fruit in large bins (top 40%)
  // Quality (issue name → pct_of_fruit)
  issues: Record<string, number>
}

export interface FarmAverages {
  tonHa: number | null
}

export interface Insight {
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  detail: string
  recommendation: string
}

// Variety-specific N excess thresholds (soil scientist validated)
function nExcessThreshold(variety: string | null): number | null {
  if (!variety) return null
  const v = variety.toLowerCase()
  if (v.includes('golden') && v.includes('del')) return 2.40   // top of optimal — colour (yellowing) sensitive
  if (v.includes('rosy') || v.includes('cripps red')) return 2.30  // red colour critical — most sensitive
  if (v.includes('cripps') || v.includes('pink lady')) return 2.40  // red colour development
  if (v.includes('granny') && v.includes('smith')) return 2.50  // tolerates higher N (green apple, no colour concern)
  return null
}

// Variety-specific Ca minimum thresholds
function caMinThreshold(variety: string | null): number | null {
  if (!variety) return null
  const v = variety.toLowerCase()
  if (v.includes('forelle')) return 1.60            // extremely bitter pit susceptible
  if (v.includes('fuji')) return 1.40               // moderately bitter pit susceptible
  if (v.includes('packham')) return 1.50            // moderately susceptible pear
  return null
}

// Variety-specific B minimum thresholds (mg/kg)
function bMinThreshold(variety: string | null): number | null {
  if (!variety) return null
  const v = variety.toLowerCase()
  if (v.includes('abate') || v.includes('fetel')) return 30   // particularly B-sensitive for fruit set
  if (v.includes('golden') && v.includes('del')) return 35    // internal cork prevalent with low B
  return null
}

function isForelle(variety: string | null): boolean {
  return !!variety && variety.toLowerCase().includes('forelle')
}

function isPear(commodityCode: string | null): boolean {
  return !!commodityCode && commodityCode.toUpperCase() === 'PEAR'
}

function isStone(commodityCode: string | null): boolean {
  return !!commodityCode && commodityCode.toUpperCase() === 'STONE'
}

function isUndersizeBin(bin: string | null): boolean {
  if (!bin) return false
  return bin.toLowerCase().includes('undersize')
}

function nutrientStatus(value: number, norm: NormRange): 'low' | 'optimal' | 'high' | 'adequate_low' | 'adequate_high' {
  if (value >= norm.min_optimal && value <= norm.max_optimal) return 'optimal'
  if (value < norm.min_optimal) {
    if (norm.min_adequate != null && value >= norm.min_adequate) return 'adequate_low'
    return 'low'
  }
  if (norm.max_adequate != null && value <= norm.max_adequate) return 'adequate_high'
  return 'high'
}

function belowOptimal(value: number | undefined, norm: NormRange | undefined): boolean {
  if (value == null || !norm) return false
  return value < norm.min_optimal
}

function aboveOptimal(value: number | undefined, norm: NormRange | undefined): boolean {
  if (value == null || !norm) return false
  return value > norm.max_optimal
}

function belowAdequate(value: number | undefined, norm: NormRange | undefined): boolean {
  if (value == null || !norm) return false
  const min = norm.min_adequate ?? norm.min_optimal
  return value < min
}

function issueRate(issues: Record<string, number>, ...keywords: string[]): number {
  for (const [name, pct] of Object.entries(issues)) {
    const lower = name.toLowerCase()
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) return pct
  }
  return 0
}

// Format nutrient value: macros (>1%) use .toFixed(2), micros (<1) use .toFixed(0)
function fmtNutrient(code: string, value: number): string {
  const micros = ['B', 'Mn', 'Fe', 'Cu', 'Zn', 'Mo', 'Na', 'Cl']
  if (micros.includes(code)) return value.toFixed(0)
  return value.toFixed(2)
}

function fmtNutrientWithUnit(code: string, value: number): string {
  const micros = ['B', 'Mn', 'Fe', 'Cu', 'Zn', 'Mo']
  if (micros.includes(code)) return `${value.toFixed(0)} mg/kg`
  return `${value.toFixed(2)}%`
}

const ROOTSTOCK_NOTES: Record<string, string> = {
  'm7': 'M7 \u2014 semi-dwarfing, shallow roots; drought sensitive, woolly aphid SUSCEPTIBLE',
  'mm106': 'MM106 \u2014 semi-dwarfing, shallow roots; drought sensitive, woolly aphid susceptible, Phytophthora susceptible',
  'bp1': 'BP1 \u2014 vigorous pear rootstock; watch N for excessive vigour, good disease tolerance',
  'bp3': 'BP3 \u2014 vigorous pear rootstock; manage N carefully, good anchorage',
  'm793': 'M793 \u2014 vigorous, deep-rooted; replant disease tolerant, woolly aphid RESISTANT, good for marginal soils',
  'mm109': 'MM109 \u2014 very vigorous, good anchorage; woolly aphid resistant, watch N',
  'm9': 'M9 \u2014 dwarfing; requires support, high input management, woolly aphid susceptible, sensitive to waterlogging',
  'm26': 'M26 \u2014 semi-dwarfing; brittle graft union, woolly aphid susceptible, needs good soil',
  'mm111': 'MM111 \u2014 vigorous; excellent anchorage, drought tolerant, good for poor soils',
  'g202': 'G.202 (Geneva) \u2014 semi-dwarfing; fire blight and woolly aphid resistant, replant tolerant',
  'g778': 'G.778 (Geneva) \u2014 semi-vigorous; replant tolerant, good for replant situations',
  'quincea': 'Quince A (BA29) \u2014 semi-dwarfing pear rootstock; sensitive to iron chlorosis on high-pH soils',
  'quincemc': 'Quince MC \u2014 semi-vigorous pear rootstock; more vigorous than Quince A, better on marginal soils',
}

// Woolly aphid susceptible rootstocks
const WOOLLY_APHID_SUSCEPTIBLE = ['m7', 'mm106', 'm26', 'm9']

export function generateInsights(data: OrchardData, farmAvg: FarmAverages): Insight[] {
  const insights: Insight[] = []
  const seen = new Set<string>() // prevent duplicate categories

  function add(insight: Insight) {
    if (seen.has(insight.category)) return
    seen.add(insight.category)
    insights.push(insight)
  }

  const { leafNutrients: leaf, norms, issues, variety, rootstock, commodityCode } = data
  const N = leaf['N'], K = leaf['K'], Ca = leaf['Ca'], Mg = leaf['Mg'], B = leaf['B'], Mn = leaf['Mn']
  const Zn = leaf['Zn'], Na = leaf['Na'], Cl = leaf['Cl']
  const nNorm = norms['N'], kNorm = norms['K'], caNorm = norms['Ca'], mgNorm = norms['Mg'], bNorm = norms['B']
  const znNorm = norms['Zn'], naNorm = norms['Na'], clNorm = norms['Cl']

  const bitterPitRate = issueRate(issues, 'bitter pit', 'bitterpit')
  const colourIssueRate = issueRate(issues, 'colour', 'color')
  const lenticelRate = issueRate(issues, 'lenticel')
  const corkSpotRate = issueRate(issues, 'cork spot', 'corkspot')
  const sunburnRate = issueRate(issues, 'sunburn')
  const waterCoreRate = issueRate(issues, 'water core', 'watercore')
  const woollyAphidRate = issueRate(issues, 'woolly aphid', 'woollyaphid')
  const fusicoccumRate = issueRate(issues, 'fusicoccum')

  // Young orchard check (within 5 years)
  const currentYear = new Date().getFullYear()
  const isYoungOrchard = data.yearPlanted != null && (currentYear - data.yearPlanted) <= 5

  // Overcropping detection — used by Rule K and to suppress Rule 16
  const isOvercropped = data.tonHa != null && farmAvg.tonHa != null && farmAvg.tonHa > 0
    && data.tonHa > farmAvg.tonHa
    && (isUndersizeBin(data.dominantSizeBin) || (data.pctSmallBins != null && data.pctSmallBins > 50))

  // N uptake threshold: stone fruit need more N (>=100), apples/pears >=60
  const nUptakeThreshold = isStone(commodityCode) ? 100 : 60

  // Variety-specific B check
  const bMin = bMinThreshold(variety)
  const effectiveBLow = B != null && bNorm
    ? (bMin != null ? B < bMin : belowOptimal(B, bNorm))
    : false

  // ── Tier 1: Critical ──

  // Rule 1: Critical N deficiency
  if (N != null && nNorm && belowAdequate(N, nNorm)) {
    add({
      severity: 'critical', category: 'n-deficiency',
      title: 'Critical N deficiency',
      detail: `Leaf N (${N.toFixed(2)}%) is below the adequate range (min ${nNorm.min_adequate ?? nNorm.min_optimal}%).`,
      recommendation: 'Urgent foliar urea (1% pre-harvest, 2\u20133% post-harvest, repeat 7\u201310 day intervals); soil LAN 150\u2013200 kg/ha if within growing season. Confirm soil pH \u2014 liming may be needed before N response improves.',
    })
  }

  // Rule 2: N uptake failure (commodity-aware threshold)
  if (N != null && nNorm && belowOptimal(N, nNorm) && data.fertNAppliedKgHa != null && data.fertNAppliedKgHa >= nUptakeThreshold) {
    add({
      severity: 'critical', category: 'n-uptake-failure',
      title: 'N uptake failure',
      detail: `Leaf N (${N.toFixed(2)}%) below optimal despite ${Math.round(data.fertNAppliedKgHa)} kg N/ha applied.`,
      recommendation: 'Check soil pH (below 5.0 severely restricts N mineralisation and nitrification), root health (nematodes, Phytophthora), waterlogging, or compaction restricting root exploration.',
    })
  }

  // Rule 3: Ca + bitter pit crisis
  if (bitterPitRate > 2 && Ca != null && caNorm && belowOptimal(Ca, caNorm)) {
    add({
      severity: 'critical', category: 'ca-bitterpit',
      title: 'Ca + bitter pit crisis',
      detail: `Bitter pit at ${bitterPitRate.toFixed(1)}% with leaf Ca (${Ca.toFixed(2)}%) below optimal.`,
      recommendation: 'CaCl\u2082 at 4\u20136 kg/ha per application, 7\u201310 day intervals from December through February (4\u20136 applications). Review N:Ca ratio \u2014 target < 1.5:1. Next season\u2019s Ca programme must be aggressive from cell division (Nov onwards).',
    })
  }

  // Rule 4: Excess N driving bitter pit
  if (bitterPitRate > 2 && Ca != null && caNorm && !belowOptimal(Ca, caNorm) && N != null && nNorm && aboveOptimal(N, nNorm)) {
    add({
      severity: 'critical', category: 'n-excess-bitterpit',
      title: 'Excess N driving bitter pit',
      detail: `Bitter pit at ${bitterPitRate.toFixed(1)}% with Ca adequate but N (${N.toFixed(2)}%) above optimal \u2014 N excess antagonising Ca uptake.`,
      recommendation: 'Reduce N rates by 20\u201330% next season; consider switching from LAN to CAN (Calcinit) to partially replace N with Ca. Maintain or increase Ca spray programme. Review crop load \u2014 light crop + high N is the classic bitter pit combination.',
    })
  }

  // ── Tier 2: Warning ──

  // Rule 5: Excess N + quality risk (corrected thresholds)
  if (N != null && nNorm) {
    const nExcess = nExcessThreshold(variety)
    const isAbove = nExcess != null ? N > nExcess : aboveOptimal(N, nNorm)
    if (isAbove && (colourIssueRate > 2 || lenticelRate > 1)) {
      const threshold = nExcess != null ? `${nExcess}%` : `${nNorm.max_optimal}%`
      add({
        severity: 'warning', category: 'n-excess-quality',
        title: 'Excess N + quality risk',
        detail: `Leaf N (${N.toFixed(2)}%) above threshold (${threshold}) with quality issues (colour ${colourIssueRate.toFixed(1)}%, lenticel ${lenticelRate.toFixed(1)}%).`,
        recommendation: `Reduce N by 15\u201320%.${variety ? ` ${variety} is colour sensitive.` : ''}`,
      })
    }
  }

  // Rule 6: K + small fruit (improved K:Mg language)
  if (K != null && kNorm && belowOptimal(K, kNorm) && data.pctSmallBins != null && data.pctSmallBins > 40) {
    add({
      severity: 'warning', category: 'k-small-fruit',
      title: 'K deficiency + small fruit',
      detail: `Leaf K (${K.toFixed(2)}%) below optimal with ${data.pctSmallBins.toFixed(0)}% fruit in small size bins.`,
      recommendation: 'Increase K (KCl/K\u2082SO\u2084). In the leaf, K:Mg ratio below 2:1 suggests K uptake is being suppressed \u2014 check soil K reserves. Rule out crop load \u2014 heavy crop load also produces small fruit regardless of K status.',
    })
  }

  // Rule 7: K + low production
  if (K != null && kNorm && belowOptimal(K, kNorm) && data.tonHa != null && farmAvg.tonHa != null && farmAvg.tonHa > 0 && data.tonHa < farmAvg.tonHa * 0.8) {
    add({
      severity: 'warning', category: 'k-low-production',
      title: 'K deficiency + low production',
      detail: `Leaf K (${K.toFixed(2)}%) below optimal; T/Ha (${data.tonHa.toFixed(1)}) is below 80% of farm average (${farmAvg.tonHa.toFixed(1)}).`,
      recommendation: 'K limiting yield; increase K application, check soil K fixation.',
    })
  }

  // Rule 8: K:Ca antagonism
  if (K != null && kNorm && aboveOptimal(K, kNorm) && Ca != null && caNorm && belowOptimal(Ca, caNorm)) {
    add({
      severity: 'warning', category: 'k-ca-antagonism',
      title: 'K:Ca antagonism',
      detail: `Leaf K (${K.toFixed(2)}%) above optimal while Ca (${Ca.toFixed(2)}%) below optimal.`,
      recommendation: 'Excess K suppressing Ca; reduce K rates, increase Ca sprays.',
    })
  }

  // Rule 9: Mg deficiency + K excess
  if (Mg != null && mgNorm && belowOptimal(Mg, mgNorm) && K != null && kNorm && aboveOptimal(K, kNorm)) {
    add({
      severity: 'warning', category: 'mg-k-antagonism',
      title: 'Mg deficiency + K excess',
      detail: `Leaf Mg (${Mg.toFixed(2)}%) below optimal while K (${K.toFixed(2)}%) above optimal \u2014 K:Mg antagonism.`,
      recommendation: 'Apply MgSO\u2084 (Agmag), reduce KCl.',
    })
  }

  // Rule 10: Boron deficiency (fixed: removed || true, commodity-aware)
  if (B != null && bNorm && effectiveBLow) {
    const bThreshold = bMin != null ? `${bMin}` : `${bNorm.min_optimal}`
    const rec = isPear(commodityCode)
      ? `Critical \u2014 B deficiency causes poor fruit set and internal cork. Apply Solubor at 1 kg/ha autumn + 0.5 kg/ha at full bloom.`
      : `Apply Solubor at 1 kg/ha autumn. B deficiency causes internal cork (especially in Golden Delicious).`
    add({
      severity: 'warning', category: 'boron-deficiency',
      title: 'Boron deficiency',
      detail: `Leaf B (${B.toFixed(0)} mg/kg) below threshold (${bThreshold}).${corkSpotRate > 0 ? ` Cork spot at ${corkSpotRate.toFixed(1)}%.` : ''}`,
      recommendation: rec,
    })
  }

  // Rule 11: Acid soil inference → CRITICAL (was warning)
  if (Mn != null && Ca != null && caNorm && Mg != null && mgNorm) {
    const mnHigh = norms['Mn'] ? Mn > (norms['Mn'].max_optimal || 200) : Mn > 200
    if (mnHigh && belowOptimal(Ca, caNorm) && belowOptimal(Mg, mgNorm)) {
      add({
        severity: 'critical', category: 'acid-soil',
        title: 'Acid soil pattern detected',
        detail: `High Mn (${Mn.toFixed(0)}) + low Ca (${Ca.toFixed(2)}%) + low Mg (${Mg.toFixed(2)}%) suggests soil pH <5.0. Aluminium toxicity restricts root development.`,
        recommendation: 'Soil analysis with buffer pH is essential to determine lime requirement. Typical range for WC shale soils: 2\u20135 t/ha calcitic lime or 1.5\u20133 t/ha dolomitic lime if Mg also needed. Apply at least 6 months before spring.',
      })
    }
  }

  // Rule 12: Underperformer (suppress for young orchards)
  if (!isYoungOrchard && data.tonHa != null && farmAvg.tonHa != null && farmAvg.tonHa > 0 && data.tonHa < farmAvg.tonHa * 0.8) {
    add({
      severity: 'warning', category: 'underperformer',
      title: 'Underperforming orchard',
      detail: `T/Ha (${data.tonHa.toFixed(1)}) is below 80% of farm average (${farmAvg.tonHa.toFixed(1)}).`,
      recommendation: 'Cross-reference with leaf analysis, quality issues, orchard age, rootstock, and irrigation. Common causes: acid soil, nematodes, replant disease, waterlogging, or exhausted rootstock.',
    })
  }

  // Rule 13: Fruit size regression (improved diagnostics)
  if (data.avgWeightG != null && data.prevAvgWeightG != null && data.prevAvgWeightG > 0) {
    const pctChange = ((data.avgWeightG - data.prevAvgWeightG) / data.prevAvgWeightG) * 100
    if (pctChange < -10) {
      add({
        severity: 'warning', category: 'size-regression',
        title: 'Fruit size regression',
        detail: `Avg weight ${data.avgWeightG.toFixed(0)}g, down ${Math.abs(pctChange).toFixed(0)}% from previous season (${data.prevAvgWeightG.toFixed(0)}g).`,
        recommendation: 'Fruit size decline can indicate: (1) increased crop load without adequate thinning, (2) K deficiency, (3) water stress during cell division (Nov\u2013Dec), (4) rootstock exhaustion, (5) declining soil health.',
      })
    }
  }

  // Rule 14: Fert compliance low (with critical tier for <25%)
  if (data.fertConfirmedPct != null && data.fertConfirmedPct < 50) {
    const isCritical = data.fertConfirmedPct < 25
    add({
      severity: isCritical ? 'critical' : 'warning', category: 'fert-compliance',
      title: isCritical ? 'Very low fertilizer compliance' : 'Low fertilizer compliance',
      detail: `Only ${data.fertConfirmedPct.toFixed(0)}% of applications confirmed.`,
      recommendation: 'Ensure applications are captured; production risk from missed timings.',
    })
  }

  // Rule 15: Large fruit + bitter pit (added storage advice)
  if (data.pctLargeBins != null && data.pctLargeBins > 40 && bitterPitRate > 1) {
    add({
      severity: 'warning', category: 'large-fruit-bitterpit',
      title: 'Large fruit + bitter pit risk',
      detail: `${data.pctLargeBins.toFixed(0)}% fruit in large bins with bitter pit at ${bitterPitRate.toFixed(1)}%.`,
      recommendation: 'Large fruit with even moderate bitter pit will often worsen in cold storage. Consider SmartFresh (1-MCP) treatment and prioritise early marketing for affected lots.',
    })
  }

  // ── New Warning Rules ──

  // Rule A: P deficiency in young orchards
  if (isYoungOrchard && leaf['P'] != null && norms['P'] && belowOptimal(leaf['P'], norms['P'])) {
    add({
      severity: 'warning', category: 'p-young-orchard',
      title: 'P deficiency in young orchard',
      detail: `Planted ${data.yearPlanted} (${currentYear - data.yearPlanted!} years); leaf P (${leaf['P'].toFixed(2)}%) below optimal.`,
      recommendation: 'P is critical for root establishment. Apply MAP (11:22:0) at 150\u2013200 kg/ha or Maxiphos at 200\u2013300 kg/ha in the tree row. P is immobile in soil \u2014 band placement near roots is more effective than broadcast.',
    })
  }

  // Rule B: Zn deficiency
  if (Zn != null && znNorm && belowOptimal(Zn, znNorm)) {
    add({
      severity: 'warning', category: 'zn-deficiency',
      title: 'Zn deficiency',
      detail: `Leaf Zn (${Zn.toFixed(0)} mg/kg) below optimal (${znNorm.min_optimal}).`,
      recommendation: 'Zinc deficiency causes rosetting, small leaves, and poor fruit set. Apply foliar ZnSO\u2084 (0.5%) at bud break, or soil zinc sulphate at 10\u201315 kg/ha. Common on high-pH soils and where P has been over-applied (P:Zn antagonism).',
    })
  }

  // Rule C: Cork spot + B deficiency
  if (corkSpotRate > 0.5 && B != null && bNorm && effectiveBLow) {
    const isCritical = corkSpotRate > 2
    add({
      severity: isCritical ? 'critical' : 'warning', category: 'cork-spot-boron',
      title: 'Cork spot + B deficiency',
      detail: `Cork spot at ${corkSpotRate.toFixed(1)}% with leaf B (${B.toFixed(0)} mg/kg) below optimal.`,
      recommendation: 'Cork spot is strongly associated with B deficiency. Urgent Solubor application needed. Cork spot causes severe downgrade and is irreversible once visible.',
    })
  }

  // Rule D: N:K ratio imbalance
  if (N != null && K != null && K > 0) {
    const nkRatio = N / K
    const threshold = isPear(commodityCode) ? 1.5 : 2.0
    if (nkRatio > threshold) {
      // Context-aware recommendation: if K application is already high, the problem is uptake not rate
      const kHigh = data.fertKAppliedKgHa != null && data.fertKAppliedKgHa >= 100
      const rec = kHigh
        ? `N:K ratio is unbalanced \u2014 excess N relative to K in the leaf. K application is already high (${Math.round(data.fertKAppliedKgHa!)} kg/ha) so increasing K rate is unlikely to help. Investigate K uptake: check soil pH (K availability drops below pH 5.0), soil K fixation (heavy clay soils lock K), root health, and waterlogging. Consider reducing N to bring the ratio back into balance.`
        : 'N:K ratio is unbalanced \u2014 excess N relative to K. Promotes vegetative growth at the expense of fruit quality and storage potential. Reduce N and increase K.'
      add({
        severity: 'warning', category: 'nk-ratio',
        title: 'N:K ratio imbalance',
        detail: `N:K ratio ${nkRatio.toFixed(1)}:1 exceeds target (${threshold}:1). N ${N.toFixed(2)}%, K ${K.toFixed(2)}%.`,
        recommendation: rec,
      })
    }
  }

  // Rule E: Sunburn + high crop load
  if (sunburnRate > 3 && data.tonHa != null && farmAvg.tonHa != null && farmAvg.tonHa > 0 && data.tonHa > farmAvg.tonHa * 1.1) {
    add({
      severity: 'warning', category: 'sunburn-cropload',
      title: 'Sunburn + high crop load',
      detail: `Sunburn at ${sunburnRate.toFixed(1)}% with T/Ha (${data.tonHa.toFixed(1)}) above farm average.`,
      recommendation: 'High crop load with sunburn. Heavy crops open the canopy and expose fruit. Consider improved thinning, reflective mulch, or kaolin-based sunburn protectants (Surround).',
    })
  }

  // Rule F: High Na or Cl (salinity)
  {
    const naHigh = Na != null && (naNorm ? Na > (naNorm.max_adequate ?? naNorm.max_optimal) : Na > 0.10)
    const clHigh = Cl != null && (clNorm ? Cl > (clNorm.max_adequate ?? clNorm.max_optimal) : Cl > 0.50)
    if (naHigh || clHigh) {
      const parts: string[] = []
      if (naHigh && Na != null) parts.push(`Na ${Na.toFixed(2)}%`)
      if (clHigh && Cl != null) parts.push(`Cl ${Cl.toFixed(2)}%`)
      add({
        severity: 'warning', category: 'salinity',
        title: 'Salinity stress detected',
        detail: `Elevated ${parts.join(' and ')} indicating salinity stress.`,
        recommendation: 'Check irrigation water quality (EC, SAR). Consider gypsum application to displace Na. Leaching irrigations may be needed during winter.',
      })
    }
  }

  // Rule G: Declining production trend
  if (data.tonHa != null && data.prevTonHa != null && data.prevTonHa > 0
    && data.tonHa < data.prevTonHa * 0.85
    && farmAvg.tonHa != null && farmAvg.tonHa > 0
    && data.tonHa < farmAvg.tonHa * 0.9) {
    add({
      severity: 'warning', category: 'declining-production',
      title: 'Declining production trend',
      detail: `T/Ha dropped from ${data.prevTonHa.toFixed(1)} to ${data.tonHa.toFixed(1)} (${((1 - data.tonHa / data.prevTonHa) * 100).toFixed(0)}% decline) and below farm average.`,
      recommendation: 'Consecutive declining production. Investigate: replant disease, rootstock decline, nematodes, irrigation efficiency, or chronic nutrient deficiency.',
    })
  }

  // Rule H: Woolly aphid + susceptible rootstock
  if (woollyAphidRate > 0 && rootstock) {
    const rsKey = rootstock.toLowerCase().replace(/\s+/g, '')
    const isSusceptible = WOOLLY_APHID_SUSCEPTIBLE.some(rs => rsKey.includes(rs))
    if (isSusceptible) {
      add({
        severity: 'warning', category: 'woolly-aphid-rootstock',
        title: 'Woolly aphid on susceptible rootstock',
        detail: `Woolly aphid detected (${woollyAphidRate.toFixed(1)}%) on ${rootstock}, which is woolly aphid susceptible.`,
        recommendation: 'Monitor closely for root infestation. Consider biological control (Aphelinus mali) or systemic treatments.',
      })
    }
  }

  // Rule K: High production + undersize fruit (overcropping) — suppresses Rule 16
  if (isOvercropped && data.tonHa != null) {
    const kLow = K != null && kNorm && belowOptimal(K, kNorm)
    const kNote = kLow ? ' K deficiency is compounding the size problem \u2014 address both thinning and K nutrition.' : ''
    add({
      severity: 'warning', category: 'overcrop-undersize',
      title: 'Overcropping \u2014 high tonnage, undersize fruit',
      detail: `T/Ha is high (${data.tonHa.toFixed(1)}) but fruit is predominantly undersize (${data.dominantSizeBin || 'small'}${data.avgWeightG ? `, ${data.avgWeightG.toFixed(0)}g avg` : ''}). High tonnage has low commercial value when fruit is undersize.`,
      recommendation: `Classic overcropping pattern \u2014 high yield but poor pack-out. Review thinning protocol (chemical and/or hand thin earlier). Check K levels (K drives fruit sizing). Ensure adequate irrigation during cell division (Nov\u2013Dec). Consider reducing crop load by 15\u201320% next season to shift size profile up.${kNote}`,
    })
  }

  // ── Tier 3: Info ──

  // Rule 16: Top performer (suppressed if overcropped)
  if (!isOvercropped && data.tonHa != null && farmAvg.tonHa != null && farmAvg.tonHa > 0 && data.tonHa > farmAvg.tonHa * 1.2) {
    add({
      severity: 'info', category: 'top-performer',
      title: 'Top performing orchard',
      detail: `T/Ha (${data.tonHa.toFixed(1)}) is ${((data.tonHa / farmAvg.tonHa) * 100).toFixed(0)}% of farm average.`,
      recommendation: 'Identify what\u2019s working \u2014 replicate inputs across similar orchards.',
    })
  }

  // Rule I: Water core risk
  if (waterCoreRate > 1 && Ca != null && caNorm && belowOptimal(Ca, caNorm)) {
    add({
      severity: 'info', category: 'water-core',
      title: 'Water core risk',
      detail: `Water core at ${waterCoreRate.toFixed(1)}% with leaf Ca (${Ca.toFixed(2)}%) below optimal.`,
      recommendation: 'Water core is associated with late harvest maturity and Ca deficiency. Review harvest timing and Ca programme.',
    })
  }

  // Rule J: Fusicoccum risk (pears)
  if (fusicoccumRate > 1 && ((K != null && kNorm && belowOptimal(K, kNorm)) || (Ca != null && caNorm && belowOptimal(Ca, caNorm)))) {
    add({
      severity: 'info', category: 'fusicoccum-nutrition',
      title: 'Fusicoccum + nutritional stress',
      detail: `Fusicoccum stem-end rot at ${fusicoccumRate.toFixed(1)}%${K != null && kNorm && belowOptimal(K, kNorm) ? `, K (${K.toFixed(2)}%) low` : ''}${Ca != null && caNorm && belowOptimal(Ca, caNorm) ? `, Ca (${Ca.toFixed(2)}%) low` : ''}.`,
      recommendation: 'Fusicoccum stem-end rot is elevated. While primarily fungal (pathologist referral recommended), nutritional stress (K and Ca deficiency) increases susceptibility.',
    })
  }

  // Rule 17: Nutrient outside range (catch-all, category-based formatting)
  for (const [code, value] of Object.entries(leaf)) {
    const norm = norms[code]
    if (!norm) continue
    if (seen.has(`nutrient-${code}`)) continue
    const status = nutrientStatus(value, norm)
    if (status === 'low' || status === 'high') {
      add({
        severity: 'info', category: `nutrient-${code}`,
        title: `${code} outside optimal range`,
        detail: `Leaf ${code} (${fmtNutrientWithUnit(code, value)}) is ${status === 'low' ? 'below' : 'above'} optimal (${fmtNutrient(code, norm.min_optimal)}\u2013${fmtNutrient(code, norm.max_optimal)}).`,
        recommendation: `Review ${code} application rates for next season.`,
      })
    }
  }

  // Rule 18: Variety-specific Ca watch → WARNING (was info, Forelle only)
  {
    const caMin = caMinThreshold(variety)
    if (caMin != null && Ca != null && Ca < caMin) {
      const isForelleVar = isForelle(variety)
      add({
        severity: 'warning', category: 'variety-ca',
        title: `${variety} Ca deficiency risk`,
        detail: `Leaf Ca (${Ca.toFixed(2)}%) is below the ${variety}-specific target of ${caMin.toFixed(2)}%.`,
        recommendation: isForelleVar
          ? 'Forelle with leaf Ca below 1.60% will almost certainly develop bitter pit. CaCl\u2082 4\u20136 kg/ha, fortnightly from November, minimum 6 applications. Target light crop loads. Consider fruit Ca analysis closer to harvest.'
          : `${variety} is bitter pit susceptible. Increase CaCl\u2082 spray programme (4\u20136 kg/ha per application). Review N:Ca ratio and crop load.`,
      })
    }
  }

  // Rule 19: Young orchard N boost
  if (data.yearPlanted != null) {
    if (currentYear - data.yearPlanted <= 3 && N != null && nNorm && belowOptimal(N, nNorm)) {
      add({
        severity: 'info', category: 'young-orchard-n',
        title: 'Young orchard needs N',
        detail: `Planted ${data.yearPlanted} (${currentYear - data.yearPlanted} years); leaf N (${N.toFixed(2)}%) below optimal.`,
        recommendation: 'Young trees need higher N for canopy establishment.',
      })
    }
  }

  // Rule 20: Rootstock notes
  if (rootstock) {
    const rsKey = rootstock.toLowerCase().replace(/\s+/g, '')
    for (const [key, note] of Object.entries(ROOTSTOCK_NOTES)) {
      if (rsKey.includes(key)) {
        add({
          severity: 'info', category: 'rootstock-note',
          title: 'Rootstock note',
          detail: note,
          recommendation: 'Consider rootstock characteristics when adjusting inputs.',
        })
        break
      }
    }
  }

  return insights
}

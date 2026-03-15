'use client'

import { usePageGuard } from '@/lib/usePageGuard'

// ── Rule definitions ──
// Mirrors the logic in insightEngine.ts and comparisonInsightEngine.ts
// Keep in sync when rules change.

interface RuleDef {
  id: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  triggers: string
  thresholds: string
  recommendation: string
  notes?: string
}

const ORCHARD_RULES: RuleDef[] = [
  // ── Tier 1: Critical ──
  {
    id: '1', title: 'Critical N deficiency', severity: 'critical', category: 'Nutrition',
    triggers: 'Leaf N below the adequate range.',
    thresholds: 'N < min_adequate (norm-based, commodity + variety specific).',
    recommendation: 'Urgent foliar urea (1% pre-harvest, 2\u20133% post-harvest, repeat 7\u201310 day intervals); soil LAN 150\u2013200 kg/ha if within growing season. Confirm soil pH \u2014 liming may be needed before N response improves.',
  },
  {
    id: '2', title: 'N uptake failure', severity: 'critical', category: 'Nutrition',
    triggers: 'Leaf N below optimal despite high N application.',
    thresholds: 'N < min_optimal AND N applied \u2265 60 kg/ha (apples/pears) or \u2265 100 kg/ha (stone fruit).',
    recommendation: 'Check soil pH (below 5.0 severely restricts N mineralisation and nitrification), root health (nematodes, Phytophthora), waterlogging, or compaction restricting root exploration.',
  },
  {
    id: '3', title: 'Ca + bitter pit crisis', severity: 'critical', category: 'Quality',
    triggers: 'Bitter pit > 2% AND leaf Ca below optimal.',
    thresholds: 'Bitter pit issue rate > 2%, Ca < min_optimal.',
    recommendation: 'CaCl\u2082 at 4\u20136 kg/ha per application, 7\u201310 day intervals from December through February (4\u20136 applications). Review N:Ca ratio \u2014 target < 1.5:1.',
  },
  {
    id: '4', title: 'Excess N driving bitter pit', severity: 'critical', category: 'Quality',
    triggers: 'Bitter pit > 2% with adequate Ca but excess N \u2014 N antagonising Ca uptake.',
    thresholds: 'Bitter pit > 2%, Ca \u2265 min_optimal, N > max_optimal.',
    recommendation: 'Reduce N rates by 20\u201330% next season; consider switching from LAN to CAN (Calcinit). Maintain or increase Ca spray programme. Review crop load.',
  },
  {
    id: '11', title: 'Acid soil pattern detected', severity: 'critical', category: 'Soil',
    triggers: 'High Mn + low Ca + low Mg \u2014 classic acid soil leaf signature.',
    thresholds: 'Mn > 200 (or above norm max_optimal), Ca < min_optimal, Mg < min_optimal.',
    recommendation: 'Soil analysis with buffer pH is essential. Typical range for WC shale soils: 2\u20135 t/ha calcitic lime or 1.5\u20133 t/ha dolomitic lime. Apply at least 6 months before spring.',
  },
  {
    id: '14c', title: 'Very low fertilizer compliance', severity: 'critical', category: 'Programme',
    triggers: 'Less than 25% of fertilizer applications confirmed.',
    thresholds: 'Confirmed % < 25%.',
    recommendation: 'Ensure applications are captured; production risk from missed timings.',
  },

  // ── Tier 2: Warning ──
  {
    id: '5', title: 'Excess N + quality risk', severity: 'warning', category: 'Quality',
    triggers: 'Leaf N above variety-specific threshold with colour or lenticel issues.',
    thresholds: 'N > variety threshold (e.g. Golden Del 2.40%, Rosy Glow 2.30%, Granny Smith 2.50%) AND (colour issues > 2% OR lenticel > 1%).',
    recommendation: 'Reduce N by 15\u201320%. Colour-sensitive varieties need tighter N control.',
    notes: 'Variety-specific thresholds validated by soil scientist for SA deciduous fruit.',
  },
  {
    id: '6', title: 'K deficiency + small fruit', severity: 'warning', category: 'Nutrition',
    triggers: 'Leaf K below optimal with high proportion of small fruit.',
    thresholds: 'K < min_optimal AND % fruit in small bins > 40%.',
    recommendation: 'Increase K (KCl/K\u2082SO\u2084). Check K:Mg ratio in leaf \u2014 below 2:1 suggests K uptake suppression. Rule out crop load.',
  },
  {
    id: '7', title: 'K deficiency + low production', severity: 'warning', category: 'Nutrition',
    triggers: 'Leaf K below optimal with T/Ha well below farm average.',
    thresholds: 'K < min_optimal AND T/Ha < 80% of farm average.',
    recommendation: 'K limiting yield; increase K application, check soil K fixation.',
  },
  {
    id: '8', title: 'K:Ca antagonism', severity: 'warning', category: 'Nutrition',
    triggers: 'Leaf K above optimal while Ca below optimal \u2014 excess K suppressing Ca.',
    thresholds: 'K > max_optimal AND Ca < min_optimal.',
    recommendation: 'Reduce K rates, increase Ca sprays.',
  },
  {
    id: '9', title: 'Mg deficiency + K excess', severity: 'warning', category: 'Nutrition',
    triggers: 'Leaf Mg below optimal while K above optimal \u2014 K:Mg antagonism.',
    thresholds: 'Mg < min_optimal AND K > max_optimal.',
    recommendation: 'Apply MgSO\u2084 (Agmag), reduce KCl.',
  },
  {
    id: '10', title: 'Boron deficiency', severity: 'warning', category: 'Nutrition',
    triggers: 'Leaf B below optimal or variety-specific threshold.',
    thresholds: 'B < min_optimal (or variety threshold: Abate Fetel 30, Golden Del 35 mg/kg).',
    recommendation: 'Pears: Solubor 1 kg/ha autumn + 0.5 kg/ha at full bloom. Apples: Solubor 1 kg/ha autumn.',
    notes: 'B deficiency causes poor fruit set (pears) and internal cork (Golden Delicious).',
  },
  {
    id: '12', title: 'Underperforming orchard', severity: 'warning', category: 'Production',
    triggers: 'T/Ha well below farm average. Suppressed for young orchards (\u2264 5 years).',
    thresholds: 'T/Ha < 80% of farm average AND orchard age > 5 years.',
    recommendation: 'Cross-reference with leaf analysis, quality issues, orchard age, rootstock, and irrigation.',
  },
  {
    id: '13', title: 'Fruit size regression', severity: 'warning', category: 'Size',
    triggers: 'Average fruit weight dropped significantly vs previous season.',
    thresholds: 'Avg weight down > 10% from previous season.',
    recommendation: 'Causes: increased crop load, K deficiency, water stress during cell division (Nov\u2013Dec), rootstock exhaustion, declining soil health.',
  },
  {
    id: '14', title: 'Low fertilizer compliance', severity: 'warning', category: 'Programme',
    triggers: 'Less than half of fertilizer applications confirmed.',
    thresholds: 'Confirmed % between 25\u201350%.',
    recommendation: 'Ensure applications are captured; production risk from missed timings.',
  },
  {
    id: '15', title: 'Large fruit + bitter pit risk', severity: 'warning', category: 'Quality',
    triggers: 'High proportion of large fruit with moderate bitter pit.',
    thresholds: '% fruit in large bins > 40% AND bitter pit > 1%.',
    recommendation: 'Large fruit with bitter pit worsens in cold storage. Consider SmartFresh (1-MCP) treatment and prioritise early marketing.',
  },
  {
    id: 'A', title: 'P deficiency in young orchard', severity: 'warning', category: 'Nutrition',
    triggers: 'Young orchard (\u2264 5 years) with leaf P below optimal.',
    thresholds: 'Year planted within 5 years AND P < min_optimal.',
    recommendation: 'Apply MAP (11:22:0) at 150\u2013200 kg/ha or Maxiphos at 200\u2013300 kg/ha. Band placement near roots is more effective than broadcast.',
  },
  {
    id: 'B', title: 'Zn deficiency', severity: 'warning', category: 'Nutrition',
    triggers: 'Leaf Zn below optimal range.',
    thresholds: 'Zn < min_optimal.',
    recommendation: 'Foliar ZnSO\u2084 (0.5%) at bud break, or soil zinc sulphate 10\u201315 kg/ha. Common on high-pH soils and where P has been over-applied.',
  },
  {
    id: 'C', title: 'Cork spot + B deficiency', severity: 'warning', category: 'Quality',
    triggers: 'Cork spot detected with low boron.',
    thresholds: 'Cork spot > 0.5% AND B below optimal/variety threshold. Critical if cork spot > 2%.',
    recommendation: 'Cork spot is strongly associated with B deficiency. Urgent Solubor application needed.',
  },
  {
    id: 'D', title: 'N:K ratio imbalance', severity: 'warning', category: 'Nutrition',
    triggers: 'Leaf N:K ratio exceeds commodity target.',
    thresholds: 'N:K > 2.0:1 (apples) or > 1.5:1 (pears).',
    recommendation: 'If K applied is already high (\u2265 100 kg/ha): investigate K uptake (soil pH, K fixation, root health). Otherwise: reduce N and increase K.',
    notes: 'Context-aware: recommendation changes based on K application rate.',
  },
  {
    id: 'E', title: 'Sunburn + high crop load', severity: 'warning', category: 'Quality',
    triggers: 'Sunburn detected with above-average production.',
    thresholds: 'Sunburn > 3% AND T/Ha > 110% of farm average.',
    recommendation: 'Heavy crops open the canopy and expose fruit. Consider improved thinning, reflective mulch, or kaolin-based protectants (Surround).',
  },
  {
    id: 'F', title: 'Salinity stress', severity: 'warning', category: 'Soil',
    triggers: 'Elevated Na or Cl in leaf analysis.',
    thresholds: 'Na > 0.10% (or above norm) OR Cl > 0.50% (or above norm).',
    recommendation: 'Check irrigation water quality (EC, SAR). Consider gypsum application. Leaching irrigations may be needed during winter.',
  },
  {
    id: 'G', title: 'Declining production trend', severity: 'warning', category: 'Production',
    triggers: 'T/Ha dropped significantly from previous season and below farm average.',
    thresholds: 'T/Ha < 85% of previous season AND < 90% of farm average.',
    recommendation: 'Investigate: replant disease, rootstock decline, nematodes, irrigation efficiency, or chronic nutrient deficiency.',
  },
  {
    id: 'H', title: 'Woolly aphid on susceptible rootstock', severity: 'warning', category: 'Pest',
    triggers: 'Woolly aphid detected on a susceptible rootstock.',
    thresholds: 'Woolly aphid rate > 0% AND rootstock is M7, MM106, M26, or M9.',
    recommendation: 'Monitor closely for root infestation. Consider biological control (Aphelinus mali) or systemic treatments.',
  },
  {
    id: 'K', title: 'Overcropping \u2014 high tonnage, undersize fruit', severity: 'warning', category: 'Production',
    triggers: 'T/Ha above farm average but fruit is predominantly undersize.',
    thresholds: 'T/Ha > farm average AND (dominant bin is undersize OR % small bins > 50%).',
    recommendation: 'Review thinning protocol. Check K levels. Ensure adequate irrigation during cell division (Nov\u2013Dec). Consider reducing crop load by 15\u201320% next season.',
  },
  {
    id: '18', title: 'Variety-specific Ca deficiency risk', severity: 'warning', category: 'Nutrition',
    triggers: 'Leaf Ca below variety-specific minimum for bitter-pit-susceptible varieties.',
    thresholds: 'Forelle: Ca < 1.60%, Fuji: Ca < 1.40%, Packham: Ca < 1.50%.',
    recommendation: 'Increase CaCl\u2082 spray programme (4\u20136 kg/ha per application). Review N:Ca ratio and crop load.',
  },

  // ── Tier 3: Info ──
  {
    id: '16', title: 'Top performing orchard', severity: 'info', category: 'Production',
    triggers: 'T/Ha significantly above farm average (suppressed if overcropped).',
    thresholds: 'T/Ha > 120% of farm average AND not overcropped (undersize).',
    recommendation: 'Identify what\u2019s working \u2014 replicate inputs across similar orchards.',
  },
  {
    id: 'I', title: 'Water core risk', severity: 'info', category: 'Quality',
    triggers: 'Water core detected with low Ca.',
    thresholds: 'Water core > 1% AND Ca < min_optimal.',
    recommendation: 'Associated with late harvest maturity and Ca deficiency. Review harvest timing and Ca programme.',
  },
  {
    id: 'J', title: 'Fusicoccum + nutritional stress', severity: 'info', category: 'Quality',
    triggers: 'Fusicoccum stem-end rot with K or Ca deficiency.',
    thresholds: 'Fusicoccum > 1% AND (K < min_optimal OR Ca < min_optimal).',
    recommendation: 'Primarily fungal (pathologist referral recommended), but nutritional stress increases susceptibility.',
  },
  {
    id: '17', title: 'Nutrient outside optimal range', severity: 'info', category: 'Nutrition',
    triggers: 'Any leaf nutrient outside optimal range (catch-all for nutrients not covered by specific rules).',
    thresholds: 'Nutrient value < min_optimal or > max_optimal (norm-based).',
    recommendation: 'Review application rates for next season.',
  },
  {
    id: '19', title: 'Young orchard needs N', severity: 'info', category: 'Nutrition',
    triggers: 'Very young orchard (\u2264 3 years) with leaf N below optimal.',
    thresholds: 'Orchard age \u2264 3 years AND N < min_optimal.',
    recommendation: 'Young trees need higher N for canopy establishment.',
  },
  {
    id: '20', title: 'Rootstock note', severity: 'info', category: 'General',
    triggers: 'Rootstock is in the knowledge base.',
    thresholds: 'Rootstock matches: M7, MM106, BP1, BP3, M793, MM109, M9, M26, MM111, G.202, G.778, Quince A, Quince MC.',
    recommendation: 'Consider rootstock characteristics when adjusting inputs.',
    notes: 'Includes vigour, disease tolerance, woolly aphid susceptibility, and soil preferences per rootstock.',
  },
]

const COMPARISON_RULES: RuleDef[] = [
  {
    id: 'C1', title: 'Score gap', severity: 'warning', category: 'Overall',
    triggers: 'Large gap between best and worst scoring orchards.',
    thresholds: 'Score difference > 20 points.',
    recommendation: 'Identifies the main differentiating factor (production, quality, or nutrient status).',
  },
  {
    id: 'C2', title: 'T/Ha divergence', severity: 'warning', category: 'Production',
    triggers: 'Large production gap between compared orchards.',
    thresholds: 'T/Ha gap > 30%.',
    recommendation: 'Compare inputs and orchard age.',
  },
  {
    id: 'C3', title: 'Same variety, different outcomes', severity: 'info', category: 'Production',
    triggers: 'Orchards share the same variety but have significantly different yields.',
    thresholds: 'Same variety AND T/Ha gap > 25%.',
    recommendation: 'Compare fert programme and rootstock.',
  },
  {
    id: 'C4', title: 'N:Ca ratio + bitter pit gap', severity: 'warning', category: 'Quality',
    triggers: 'One orchard has bitter pit with high N:Ca, another does not.',
    thresholds: 'Bitter pit > 2% in one orchard with N:Ca imbalance, absent in another.',
    recommendation: 'N:Ca imbalance likely driving bitter pit difference.',
  },
  {
    id: 'C5', title: 'Issue rate divergence', severity: 'warning', category: 'Quality',
    triggers: 'Large gap in total quality issues between orchards.',
    thresholds: 'One orchard > 3% total issues, another < 1%.',
    recommendation: 'Identifies the top issue driving the gap.',
  },
  {
    id: 'C6', title: 'Nutrient divergence', severity: 'info', category: 'Nutrition',
    triggers: 'One orchard has optimal nutrient status, another is low or high.',
    thresholds: 'N, K, or Ca: one optimal, another outside optimal.',
    recommendation: 'Highlights which nutrient status differs and by how much.',
  },
  {
    id: 'C7', title: 'Fertilizer compliance gap', severity: 'info', category: 'Programme',
    triggers: 'Large gap in fertilizer programme compliance.',
    thresholds: 'Compliance gap > 30 percentage points.',
    recommendation: 'Missed applications may explain nutrient gaps.',
  },
  {
    id: 'C8', title: 'Fruit size gap', severity: 'info', category: 'Size',
    triggers: 'Significant difference in average fruit weight.',
    thresholds: 'Weight gap > 15%.',
    recommendation: 'Check crop load and K status.',
  },
]

const SEV_STYLE: Record<string, { bg: string; border: string; label: string; color: string }> = {
  critical: { bg: 'rgba(232,90,74,0.06)', border: 'rgba(232,90,74,0.20)', label: 'CRITICAL', color: '#c23616' },
  warning: { bg: 'rgba(245,200,66,0.08)', border: 'rgba(245,200,66,0.25)', label: 'WARNING', color: '#9a7b1a' },
  info: { bg: 'rgba(33,118,217,0.06)', border: 'rgba(33,118,217,0.15)', label: 'INFO', color: '#1a5fb4' },
}

function RuleCard({ rule }: { rule: RuleDef }) {
  const s = SEV_STYLE[rule.severity]
  return (
    <div style={{
      padding: '16px 20px', borderRadius: 12, marginBottom: 12,
      background: s.bg, border: `1px solid ${s.border}`,
      breakInside: 'avoid', pageBreakInside: 'avoid',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: s.color,
          padding: '2px 8px', borderRadius: 4, background: `${s.border}`,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {s.label}
        </span>
        <span style={{ fontSize: 10, color: '#8a95a0', fontWeight: 600, textTransform: 'uppercase' }}>
          {rule.category}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 6 }}>
        {rule.id}. {rule.title}
      </div>
      <div style={{ fontSize: 13, color: '#3a4a40', lineHeight: 1.6, marginBottom: 4 }}>
        <strong>Triggers:</strong> {rule.triggers}
      </div>
      <div style={{ fontSize: 13, color: '#3a4a40', lineHeight: 1.6, marginBottom: 4 }}>
        <strong>Thresholds:</strong> {rule.thresholds}
      </div>
      <div style={{ fontSize: 13, color: '#1a2a3a', lineHeight: 1.6, fontStyle: 'italic' }}>
        <strong style={{ fontStyle: 'normal' }}>Recommendation:</strong> {rule.recommendation}
      </div>
      {rule.notes && (
        <div style={{ fontSize: 12, color: '#6a7a70', lineHeight: 1.5, marginTop: 6 }}>
          Note: {rule.notes}
        </div>
      )}
    </div>
  )
}

export default function IntelligenceRulesPage() {
  const { allowed } = usePageGuard()

  if (!allowed) return null

  const criticalRules = ORCHARD_RULES.filter(r => r.severity === 'critical')
  const warningRules = ORCHARD_RULES.filter(r => r.severity === 'warning')
  const infoRules = ORCHARD_RULES.filter(r => r.severity === 'info')

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .rules-page { padding: 20px !important; }
        }
      `}</style>
      <div className="rules-page" style={{
        maxWidth: 860, margin: '0 auto', padding: '32px 40px',
        fontFamily: 'Inter, sans-serif', background: '#fff', minHeight: '100vh',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32, borderBottom: '2px solid #e0dbd4', paddingBottom: 20 }}>
          <div className="no-print" style={{ marginBottom: 16 }}>
            <a href="/orchards/intelligence" style={{ fontSize: 13, color: '#2176d9', textDecoration: 'none' }}>
              {'\u2190'} Back to Intelligence
            </a>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a2a3a', margin: '0 0 6px' }}>
            Orchard Intelligence \u2014 Rule Reference
          </h1>
          <p style={{ fontSize: 14, color: '#6a7a70', margin: 0, lineHeight: 1.5 }}>
            These rules power the automated insight engine in FarmScout Orchard Intelligence.
            Each rule cross-references fertilizer, leaf analysis, production, fruit size, and quality data
            to generate agronomic insights per orchard.
          </p>
          <p style={{ fontSize: 12, color: '#8a95a0', margin: '8px 0 0' }}>
            Rules validated for SA deciduous fruit (Western Cape). Norms are commodity and variety specific.
          </p>
          <button
            className="no-print"
            onClick={() => window.print()}
            style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8, border: '1px solid #d4cfca',
              background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontWeight: 500, color: '#1a2a3a',
            }}
          >
            Print / Save as PDF
          </button>
        </div>

        {/* Scoring overview */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={st.sectionHeader}>Composite Score (0\u2013100)</h2>
          <p style={{ fontSize: 13, color: '#3a4a40', lineHeight: 1.6, margin: '0 0 12px' }}>
            Every orchard receives a composite score based on 5 weighted streams:
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={st.scoreTh}>Stream</th>
                <th style={{ ...st.scoreTh, textAlign: 'center' }}>Weight</th>
                <th style={st.scoreTh}>Best score when</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Production (T/Ha)', '30 pts', 'T/Ha \u2265 120% of farm average'],
                ['Leaf Health (N, P, K, Ca, Mg)', '25 pts', 'All macros in optimal range'],
                ['Quality (Issue Rate)', '25 pts', '0% total issue rate'],
                ['Fert Compliance', '10 pts', '100% of applications confirmed'],
                ['Size Profile', '10 pts', '\u2265 60% fruit in upper size bins'],
              ].map(([stream, weight, best], i) => (
                <tr key={i}>
                  <td style={st.scoreTd}>{stream}</td>
                  <td style={{ ...st.scoreTd, textAlign: 'center', fontWeight: 600 }}>{weight}</td>
                  <td style={st.scoreTd}>{best}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#8a95a0', marginTop: 8 }}>
            Missing data defaults to 50% of the stream weight (neutral). Score colours: {'\u2265'}75 green, {'\u2265'}50 yellow, {'\u2265'}25 orange, {'<'}25 red.
          </p>
        </div>

        {/* Orchard rules */}
        <h2 style={st.sectionHeader}>Per-Orchard Rules ({ORCHARD_RULES.length} rules)</h2>

        <h3 style={st.tierHeader}>Tier 1: Critical ({criticalRules.length})</h3>
        <p style={st.tierDesc}>Immediate action required. Usually involves nutrient deficiency + visible quality impact, or acid soil.</p>
        {criticalRules.map(r => <RuleCard key={r.id} rule={r} />)}

        <h3 style={st.tierHeader}>Tier 2: Warning ({warningRules.length})</h3>
        <p style={st.tierDesc}>Action recommended this season. Nutrient imbalances, declining trends, or emerging quality issues.</p>
        {warningRules.map(r => <RuleCard key={r.id} rule={r} />)}

        <h3 style={st.tierHeader}>Tier 3: Info ({infoRules.length})</h3>
        <p style={st.tierDesc}>Awareness items. Catch-all nutrient flags, rootstock notes, and positive performance signals.</p>
        {infoRules.map(r => <RuleCard key={r.id} rule={r} />)}

        {/* Comparison rules */}
        <div style={{ marginTop: 40 }}>
          <h2 style={st.sectionHeader}>Comparison Rules ({COMPARISON_RULES.length} rules)</h2>
          <p style={{ fontSize: 13, color: '#3a4a40', lineHeight: 1.6, margin: '0 0 16px' }}>
            These rules fire when comparing 2\u20134 orchards side by side. They identify what differentiates
            a top performer from a struggling one.
          </p>
          {COMPARISON_RULES.map(r => <RuleCard key={r.id} rule={r} />)}
        </div>

        {/* Data sources */}
        <div style={{ marginTop: 40, padding: '20px 24px', background: '#f8f6f2', borderRadius: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2a3a', margin: '0 0 10px' }}>Data Sources</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {[
                ['Leaf Analysis', 'Lab results uploaded per orchard per season (nutrient code \u2192 value)'],
                ['Norms', 'Optimal/adequate ranges per nutrient, commodity, and variety'],
                ['Production', 'Packhouse intake \u2014 tons, bins, T/Ha per orchard per season'],
                ['Fertilizer', 'Prescribed programme vs confirmed applications per timing'],
                ['Fruit Size', 'QC size distribution \u2014 dominant bin, avg weight, bin spread'],
                ['Quality Issues', 'QC defect counts \u2014 bitter pit, colour, lenticel, sunburn, etc.'],
                ['Farm Average', 'Mean T/Ha across all orchards on the farm for the selected season'],
              ].map(([source, desc], i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1a2a3a', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{source}</td>
                  <td style={{ padding: '6px 8px', color: '#5a6a60' }}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: '#b0a99f', textAlign: 'center' }}>
          FarmScout Orchard Intelligence v2 \u2014 {new Date().getFullYear()}
        </div>
      </div>
    </>
  )
}

const st: Record<string, React.CSSProperties> = {
  sectionHeader: {
    fontSize: 18, fontWeight: 700, color: '#1a2a3a', margin: '0 0 16px',
    paddingBottom: 8, borderBottom: '1px solid #e8e4dc',
  },
  tierHeader: {
    fontSize: 14, fontWeight: 700, color: '#5a6a60', margin: '24px 0 4px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  tierDesc: {
    fontSize: 13, color: '#6a7a70', margin: '0 0 12px',
  },
  scoreTh: {
    textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600,
    color: '#5a6a60', borderBottom: '2px solid #e0dbd4', background: '#f8f6f2',
  },
  scoreTd: {
    padding: '8px 10px', borderBottom: '1px solid #f0ede6', color: '#1a2a3a',
  },
}

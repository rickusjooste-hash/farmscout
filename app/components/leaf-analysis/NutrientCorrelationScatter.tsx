'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ZAxis, ReferenceArea,
} from 'recharts'

interface EnrichedOrchard {
  orchardId: string
  orchardName: string
  commodityName: string
  ha: number | null
  tonHa: number | null
  avgWeightG: number | null
  nutrients: Record<string, number>  // code → value
}

interface NormRange {
  min_optimal: number
  max_optimal: number
  min_adequate: number | null
  max_adequate: number | null
}

interface Props {
  orchards: EnrichedOrchard[]
  nutrientCodes: string[]  // available nutrients to pick from
  selectedOrchardId: string | null
  onOrchardSelect: (id: string) => void
  normsForNutrient?: NormRange | null  // norm range for selected nutrient + commodity
  allNorms?: Record<string, NormRange>  // key: "commodity_id:code" — used to pick per-nutrient
  commodityId?: string | null  // currently selected commodity (for norm lookup)
}

function tonHaColor(tonHa: number | null): string {
  if (tonHa == null) return '#aaa'
  if (tonHa >= 50) return '#2176d9'
  if (tonHa >= 30) return '#4caf72'
  if (tonHa >= 15) return '#f5c842'
  return '#e85a4a'
}

function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#1a4ba0', color: '#e0ecf8', padding: '10px 14px',
      borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.orchardName}</div>
      <div style={{ color: '#a0c4f0', fontSize: 11, marginBottom: 6 }}>{d.commodityName}</div>
      <div>
        {d.nutrientCode}: <strong>{d.x?.toFixed(2)}</strong>
      </div>
      {d.yType === 'tonHa' ? (
        <div>T/Ha: <strong>{d.y?.toFixed(1)}</strong></div>
      ) : (
        <div>Avg Weight: <strong>{d.y}g</strong></div>
      )}
      <div>Ha: <strong>{d.ha?.toFixed(1) || '\u2014'}</strong></div>
    </div>
  )
}

export default function NutrientCorrelationScatter({
  orchards, nutrientCodes, selectedOrchardId, onOrchardSelect,
  allNorms, commodityId,
}: Props) {
  const [selectedNutrient, setSelectedNutrient] = useState(nutrientCodes[0] || 'N')
  const [yAxis, setYAxis] = useState<'tonHa' | 'avgWeight'>('tonHa')
  const [showInfo, setShowInfo] = useState(false)

  // Keep selectedNutrient in sync when nutrientCodes changes
  useEffect(() => {
    if (nutrientCodes.length > 0 && !nutrientCodes.includes(selectedNutrient)) {
      setSelectedNutrient(nutrientCodes[0])
    }
  }, [nutrientCodes, selectedNutrient])

  // Resolve norm for the selected nutrient + commodity
  const norm = useMemo(() => {
    if (!allNorms || !commodityId) return null
    return allNorms[`${commodityId}:${selectedNutrient}`] || null
  }, [allNorms, commodityId, selectedNutrient])

  // Filter to orchards that have the selected nutrient AND the Y value
  const scatterData = useMemo(() => {
    return orchards
      .filter(o => {
        const nutrientVal = o.nutrients[selectedNutrient]
        if (nutrientVal == null) return false
        if (yAxis === 'tonHa') return o.tonHa != null && o.tonHa > 0
        return o.avgWeightG != null && o.avgWeightG > 0
      })
      .map(o => ({
        x: o.nutrients[selectedNutrient],
        y: yAxis === 'tonHa' ? o.tonHa! : o.avgWeightG!,
        ha: o.ha || 1,
        orchardId: o.orchardId,
        orchardName: o.orchardName,
        commodityName: o.commodityName,
        nutrientCode: selectedNutrient,
        yType: yAxis,
        tonHa: o.tonHa,
      }))
  }, [orchards, selectedNutrient, yAxis])

  // Debug counts
  const withNutrient = orchards.filter(o => o.nutrients[selectedNutrient] != null).length
  const withY = orchards.filter(o => yAxis === 'tonHa' ? (o.tonHa != null && o.tonHa > 0) : (o.avgWeightG != null && o.avgWeightG > 0)).length

  const yLabel = yAxis === 'tonHa' ? 'T/Ha' : 'Avg Weight (g)'

  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={s.title}>Nutrient vs Production</h3>
          <button
            onClick={() => setShowInfo(v => !v)}
            style={s.infoBtn}
            title="How to read this chart"
          >
            i
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedNutrient}
            onChange={e => setSelectedNutrient(e.target.value)}
            style={s.select}
          >
            {nutrientCodes.map(code => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() => setYAxis('tonHa')}
              style={{ ...s.toggleBtn, ...(yAxis === 'tonHa' ? s.toggleActive : {}) }}
            >
              T/Ha
            </button>
            <button
              onClick={() => setYAxis('avgWeight')}
              style={{ ...s.toggleBtn, ...(yAxis === 'avgWeight' ? s.toggleActive : {}) }}
            >
              Avg Weight
            </button>
          </div>
        </div>
      </div>

      {showInfo && (
        <div style={s.infoPanel}>
          <p style={s.infoParagraph}>
            <strong>What it shows:</strong> Each dot is one orchard. The X-axis is the selected nutrient value from the latest leaf analysis. The Y-axis is either T/Ha (tons per hectare from production bins) or average fruit weight (from QC bag sampling).
          </p>
          <p style={s.infoParagraph}>
            <strong>Dot size:</strong> Proportional to hectares — larger orchards appear as bigger dots.
          </p>
          <p style={s.infoParagraph}>
            <strong>Dot color:</strong> Based on T/Ha performance — blue = 50+, green = 30+, yellow = 15+, red = below 15.
          </p>
          <p style={s.infoParagraph}>
            <strong>Background bands:</strong> The green band shows the optimal nutrient range and the yellow band shows the adequate range (from nutrient norms for the selected commodity). Orchards inside the green band have nutrients within recommended levels.
          </p>
          <p style={s.infoParagraph}>
            <strong>How to read it:</strong> Look for clusters — are high-producing orchards (blue/green dots near the top) landing within the optimal nutrient band? Dots outside the bands may indicate deficiency or excess. Toggle between T/Ha and Avg Weight to see if nutrient levels correlate differently with yield vs fruit size.
          </p>
          <p style={{ ...s.infoParagraph, marginBottom: 0 }}>
            <strong>Interactivity:</strong> Click any dot to open the orchard detail card. Use the dropdown to switch nutrients. Use the toggle to switch between T/Ha and Avg Weight on the Y-axis.
          </p>
        </div>
      )}

      {scatterData.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ color: '#8a95a0', fontSize: 13, marginBottom: 8 }}>
            No orchards with both <strong>{selectedNutrient}</strong> data and {yAxis === 'tonHa' ? 'production (T/Ha)' : 'QC fruit weight'} data
          </div>
          <div style={{ color: '#b0b8c0', fontSize: 12 }}>
            {orchards.length} orchards with leaf data &middot; {withNutrient} have {selectedNutrient} &middot; {withY} have {yAxis === 'tonHa' ? 'T/Ha' : 'avg weight'}
          </div>
          {yAxis === 'tonHa' && withY === 0 && (
            <div style={{ color: '#b0b8c0', fontSize: 12, marginTop: 4 }}>
              Production data comes from production bins — ensure bins are recorded for this season
            </div>
          )}
          {yAxis === 'avgWeight' && withY === 0 && (
            <div style={{ color: '#b0b8c0', fontSize: 12, marginTop: 4 }}>
              Fruit weight comes from QC bag sampling — ensure bags are sampled for this season
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: '#8a95a0', marginBottom: 8, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{scatterData.length} orchard{scatterData.length !== 1 ? 's' : ''} &middot; dot size = hectares</span>
            {norm && (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(76,175,114,0.20)', border: '1px solid rgba(76,175,114,0.4)' }} />
                  <span>Optimal</span>
                </span>
                {norm.min_adequate != null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.4)' }} />
                    <span>Adequate</span>
                  </span>
                )}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2fa" />
              {/* Norm reference bands */}
              {norm && norm.min_adequate != null && norm.max_adequate != null && (
                <ReferenceArea
                  x1={norm.min_adequate} x2={norm.max_adequate}
                  fill="rgba(245,200,66,0.08)" fillOpacity={1}
                  ifOverflow="extendDomain"
                />
              )}
              {norm && (
                <ReferenceArea
                  x1={norm.min_optimal} x2={norm.max_optimal}
                  fill="rgba(76,175,114,0.12)" fillOpacity={1}
                  ifOverflow="extendDomain"
                />
              )}
              <XAxis
                type="number" dataKey="x" name={selectedNutrient}
                tick={{ fontSize: 11, fill: '#8a95a0', fontFamily: 'Inter' }}
                tickLine={false} axisLine={{ stroke: '#eef2fa' }}
                label={{ value: selectedNutrient, position: 'insideBottom', offset: -4, fontSize: 11, fill: '#8a95a0' }}
                domain={['auto', 'auto']}
              />
              <YAxis
                type="number" dataKey="y" name={yLabel}
                tick={{ fontSize: 11, fill: '#8a95a0', fontFamily: 'Inter' }}
                tickLine={false} axisLine={false}
                label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#8a95a0' }}
              />
              <ZAxis type="number" dataKey="ha" range={[40, 300]} name="Ha" />
              <Tooltip content={<ScatterTooltip />} cursor={false} />
              <Scatter data={scatterData} onClick={(d: any) => d && onOrchardSelect(d.orchardId)}>
                {scatterData.map((d, i) => {
                  const sel = d.orchardId === selectedOrchardId
                  return (
                    <Cell
                      key={i}
                      fill={tonHaColor(d.tonHa)}
                      stroke={sel ? '#1a2a3a' : 'rgba(255,255,255,0.8)'}
                      strokeWidth={sel ? 3 : 1}
                      style={{ cursor: 'pointer' }}
                    />
                  )
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff', borderRadius: 14, padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 16,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, flexWrap: 'wrap', gap: 8,
  },
  title: {
    fontSize: 16, fontWeight: 600, color: '#1a2a3a', margin: 0,
    fontFamily: 'Inter, sans-serif',
  },
  select: {
    padding: '6px 10px', border: '1px solid #d4cfca', borderRadius: 8,
    fontSize: 13, background: '#fff', color: '#1a2a3a', outline: 'none',
    fontFamily: 'Inter, sans-serif',
  },
  toggleBtn: {
    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
    border: '1px solid #d4cfca', background: '#fff', color: '#6a7a70',
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  },
  toggleActive: {
    background: '#1a2a3a', color: '#fff', border: '1px solid #1a2a3a',
  },
  infoBtn: {
    width: 22, height: 22, borderRadius: '50%', border: '1.5px solid #b0a898',
    background: 'transparent', color: '#8a7e72', fontSize: 13, fontWeight: 600,
    fontFamily: 'Georgia, serif', fontStyle: 'italic', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1,
  },
  infoPanel: {
    background: '#f8f6f2', borderRadius: 10, padding: '14px 18px',
    marginBottom: 16, fontSize: 13, color: '#5a5348', lineHeight: 1.6,
    fontFamily: 'Inter, sans-serif',
  },
  infoParagraph: {
    margin: '0 0 8px 0',
  },
}

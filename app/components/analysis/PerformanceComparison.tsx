'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface OrchardData {
  id: string
  farmId: string
  farmCode: string
  variety: string | null
  varietyGroup: string | null
  commodityName: string
  tons: number
  tonHa: number | null
  ha: number | null
  bins: number
}

interface Props {
  orchards: OrchardData[]
  farms: { id: string; code: string; name: string }[]
}

type ViewMode = 'farm' | 'variety'
type Metric = 'tonHa' | 'tons' | 'bins'

const BAR_COLORS = [
  '#2176d9', '#4caf72', '#6b9e80', '#e8924a', '#6b7fa8',
  '#9b6bb5', '#e8c44a', '#c4744a', '#3498db', '#1abc9c',
]

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#1a2a3a', color: '#e8f0e0', padding: '10px 14px',
      borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
      <div>{payload[0].name}: <strong>{typeof d.value === 'number' ? d.value.toLocaleString('en-ZA', { maximumFractionDigits: 1 }) : d.value}</strong></div>
      {d.count != null && <div style={{ fontSize: 11, color: '#a0c4f0', marginTop: 2 }}>{d.count} orchards</div>}
    </div>
  )
}

export default function PerformanceComparison({ orchards, farms }: Props) {
  const [view, setView] = useState<ViewMode>('farm')
  const [metric, setMetric] = useState<Metric>('tonHa')

  const farmData = useMemo(() => {
    const groups: Record<string, { name: string; totalTons: number; totalHa: number; totalBins: number; count: number }> = {}
    orchards.forEach(o => {
      if (!groups[o.farmId]) {
        const f = farms.find(f => f.id === o.farmId)
        groups[o.farmId] = { name: f?.code || f?.name || 'Unknown', totalTons: 0, totalHa: 0, totalBins: 0, count: 0 }
      }
      groups[o.farmId].totalTons += o.tons
      groups[o.farmId].totalHa += o.ha || 0
      groups[o.farmId].totalBins += o.bins
      groups[o.farmId].count++
    })
    return Object.values(groups).map(g => ({
      name: g.name,
      value: metric === 'tonHa' ? (g.totalHa > 0 ? Math.round(g.totalTons / g.totalHa * 10) / 10 : 0)
        : metric === 'tons' ? Math.round(g.totalTons * 10) / 10
        : Math.round(g.totalBins),
      count: g.count,
    })).sort((a, b) => b.value - a.value)
  }, [orchards, farms, metric])

  const varietyData = useMemo(() => {
    const groups: Record<string, { totalTons: number; totalHa: number; totalBins: number; count: number }> = {}
    orchards.forEach(o => {
      const key = o.variety || 'Unknown'
      if (!groups[key]) groups[key] = { totalTons: 0, totalHa: 0, totalBins: 0, count: 0 }
      groups[key].totalTons += o.tons
      groups[key].totalHa += o.ha || 0
      groups[key].totalBins += o.bins
      groups[key].count++
    })
    return Object.entries(groups).map(([name, g]) => ({
      name,
      value: metric === 'tonHa' ? (g.totalHa > 0 ? Math.round(g.totalTons / g.totalHa * 10) / 10 : 0)
        : metric === 'tons' ? Math.round(g.totalTons * 10) / 10
        : Math.round(g.totalBins),
      count: g.count,
    })).sort((a, b) => b.value - a.value).slice(0, 15)
  }, [orchards, metric])

  const data = view === 'farm' ? farmData : varietyData
  const metricLabel = metric === 'tonHa' ? 'T/Ha' : metric === 'tons' ? 'Tons' : 'Bins'

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    border: `1.5px solid ${active ? '#1a2a3a' : '#e0ddd6'}`,
    background: active ? '#1a2a3a' : '#fff',
    color: active ? '#a0c4f0' : '#6a7a70',
    fontFamily: 'inherit', transition: 'all 0.15s',
  })

  if (orchards.length === 0) {
    return <div style={{ color: '#8a95a0', fontSize: 13, textAlign: 'center', padding: 40 }}>No production data available</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setView('farm')} style={pillStyle(view === 'farm')}>Farm vs Farm</button>
        <button onClick={() => setView('variety')} style={pillStyle(view === 'variety')}>Variety vs Variety</button>
        <div style={{ width: 1, height: 20, background: '#e0ddd6', margin: '0 4px' }} />
        <button onClick={() => setMetric('tonHa')} style={pillStyle(metric === 'tonHa')}>T/Ha</button>
        <button onClick={() => setMetric('tons')} style={pillStyle(metric === 'tons')}>Tons</button>
        <button onClick={() => setMetric('bins')} style={pillStyle(metric === 'bins')}>Bins</button>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 36 + 20, 120)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#8a95a0' }} tickLine={false} axisLine={{ stroke: '#f0ede6' }} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: '#3a4a40' }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(42,110,69,0.06)' }} />
          <Bar dataKey="value" name={metricLabel} radius={[0, 4, 4, 0]} barSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface Props {
  currentStreak: number
  streaksByYear: { year: number; streak: number }[]
  currentMonth: string
  avgStreak: number
  hasDailyData: boolean
}

export default function DryStreakMeter({ currentStreak, streaksByYear, currentMonth, avgStreak, hasDailyData }: Props) {
  const aboveAvg = currentStreak > avgStreak
  const currentYear = new Date().getFullYear()

  return (
    <div style={s.card}>
      <div style={s.title}>Dry Streak</div>

      {!hasDailyData ? (
        <div style={{ color: '#8a95a0', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Requires daily data
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{ fontSize: 56, fontWeight: 700, color: '#1a2a3a', lineHeight: 1 }}>
              {currentStreak}
            </div>
            <div style={{ fontSize: 13, color: '#8a95a0', marginTop: 8 }}>
              consecutive dry days
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600, marginTop: 8,
              color: aboveAvg ? '#e8924a' : '#4caf72',
            }}>
              {aboveAvg
                ? `Above average for ${currentMonth}`
                : `Within normal range for ${currentMonth}`}
            </div>
          </div>

          {streaksByYear.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: '#8a95a0', marginBottom: 6 }}>
                Longest dry streak in {currentMonth} by year
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={streaksByYear}>
                  <XAxis dataKey="year" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip formatter={(v) => `${v} days`} />
                  <Bar dataKey="streak" radius={[3, 3, 0, 0]} barSize={12}>
                    {streaksByYear.map(entry => (
                      <Cell
                        key={entry.year}
                        fill={entry.year === currentYear ? '#e8924a' : '#c6dbef'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card:  { background: '#fff', borderRadius: 14, border: '1px solid #e8e4dc', padding: '20px 24px' },
  title: { fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 4 },
}

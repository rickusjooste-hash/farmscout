import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import * as ftp from 'basic-ftp'

function svcSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Parse iLeaf MottechData.csv
 * Actual format (no header, no quotes):
 * 2026-03-16 10:00:00,23.100000,.00,.11,Moutons Valley,GWS00128
 * Fields: datetime, temperature, rainfall, eto_cumulative, station_name, station_code
 */
function parseCSV(csv: string) {
  const lines = csv.trim().split('\n')
  const rows: Array<{
    reading_at: string
    temp_c: number | null
    rainfall_mm: number | null
    eto_cumulative_mm: number | null
    station_name: string
    station_code: string
  }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',')
    if (parts.length < 6) continue

    const dateStr = parts[0].trim()
    const temp = parseFloat(parts[1].trim())
    const rain = parseFloat(parts[2].trim())
    const eto = parseFloat(parts[3].trim())
    const stationName = parts[4].trim()
    const stationCode = parts[5].trim()

    // Skip header row if present
    if (isNaN(temp) && dateStr.toLowerCase().includes('date')) continue

    const parsedDate = new Date(dateStr)
    if (isNaN(parsedDate.getTime())) continue

    rows.push({
      reading_at: parsedDate.toISOString(),
      temp_c: isNaN(temp) ? null : temp,
      rainfall_mm: isNaN(rain) ? null : rain,
      eto_cumulative_mm: isNaN(eto) ? null : eto,
      station_name: stationName,
      station_code: stationCode,
    })
  }

  return rows
}

/**
 * Compute daily summaries from hourly readings.
 * ETo: max cumulative value per day (resets at midnight).
 * Rainfall: sum of hourly values.
 * Temp: min, max, avg.
 */
function computeDailySummaries(rows: Array<{
  reading_at: string
  temp_c: number | null
  rainfall_mm: number | null
  eto_cumulative_mm: number | null
}>) {
  const byDate: Record<string, typeof rows> = {}
  for (const r of rows) {
    const date = r.reading_at.slice(0, 10) // YYYY-MM-DD
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(r)
  }

  return Object.entries(byDate).map(([date, dayRows]) => {
    const temps = dayRows.map(r => r.temp_c).filter((t): t is number => t !== null)
    const etoVals = dayRows.map(r => r.eto_cumulative_mm).filter((e): e is number => e !== null)
    const rainVals = dayRows.map(r => r.rainfall_mm).filter((r): r is number => r !== null)

    return {
      reading_date: date,
      eto_mm: etoVals.length > 0 ? Math.max(...etoVals) : null,
      rainfall_mm: rainVals.length > 0 ? rainVals.reduce((a, b) => a + b, 0) : null,
      temp_min_c: temps.length > 0 ? Math.min(...temps) : null,
      temp_max_c: temps.length > 0 ? Math.max(...temps) : null,
      temp_avg_c: temps.length > 0 ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null,
    }
  })
}

// POST /api/weather/ingest — fetch iLeaf FTP and upsert
// Can be called by cron job or manually. Protected by secret key.
export async function POST(req: NextRequest) {
  // Simple auth: check for cron secret or service role key (header or query param)
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  const token = authHeader?.replace('Bearer ', '') || querySecret
  if (cronSecret && token !== cronSecret) {
    if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const svc = svcSupabase()

  // Fetch all active weather stations with FTP config
  const { data: stations, error: stErr } = await svc
    .from('weather_stations')
    .select('id, station_code, ftp_host, ftp_user, ftp_pass, ftp_path')
    .eq('is_active', true)
    .eq('source', 'ileaf')
    .not('ftp_host', 'is', null)

  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 })
  if (!stations || stations.length === 0) return NextResponse.json({ message: 'No active stations' })

  const results: Array<{ station: string; hourly: number; daily: number; error?: string }> = []

  for (const station of stations) {
    try {
      // Connect to FTP and download CSV
      const client = new ftp.Client()
      client.ftp.verbose = false

      await client.access({
        host: station.ftp_host,
        user: station.ftp_user,
        password: station.ftp_pass,
        secure: false,
      })

      // Download to memory
      const chunks: Buffer[] = []
      const writable = new (await import('stream')).Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk))
          callback()
        }
      })

      await client.downloadTo(writable, station.ftp_path)
      client.close()

      const csvText = Buffer.concat(chunks).toString('utf-8')
      const rows = parseCSV(csvText)

      if (rows.length === 0) {
        results.push({ station: station.station_code, hourly: 0, daily: 0, error: 'No parseable rows' })
        continue
      }

      // Upsert hourly readings
      const hourlyRecords = rows.map(r => ({
        station_id: station.id,
        reading_at: r.reading_at,
        temp_c: r.temp_c,
        rainfall_mm: r.rainfall_mm,
        eto_cumulative_mm: r.eto_cumulative_mm,
      }))

      // Batch upsert in chunks of 200
      let hourlyCount = 0
      for (let i = 0; i < hourlyRecords.length; i += 200) {
        const batch = hourlyRecords.slice(i, i + 200)
        const { error: uErr } = await svc
          .from('weather_readings')
          .upsert(batch, { onConflict: 'station_id,reading_at' })
        if (uErr) throw new Error(`Hourly upsert failed: ${uErr.message}`)
        hourlyCount += batch.length
      }

      // Compute and upsert daily summaries
      const dailySummaries = computeDailySummaries(rows).map(d => ({
        station_id: station.id,
        ...d,
      }))

      let dailyCount = 0
      for (const d of dailySummaries) {
        const { error: dErr } = await svc
          .from('weather_daily')
          .upsert(d, { onConflict: 'station_id,reading_date' })
        if (dErr) throw new Error(`Daily upsert failed: ${dErr.message}`)
        dailyCount++
      }

      results.push({ station: station.station_code, hourly: hourlyCount, daily: dailyCount })
    } catch (err: any) {
      results.push({ station: station.station_code, hourly: 0, daily: 0, error: err.message })
    }
  }

  return NextResponse.json({ ok: true, results })
}

// GET /api/weather/ingest — manual trigger for testing (returns same as POST)
export async function GET(req: NextRequest) {
  // Rewrite as POST internally
  return POST(req)
}

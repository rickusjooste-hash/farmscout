import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const AQUACHECK_API = 'https://www.aquacheckweb.com/rest'

function svcSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Fetch probe profiles from AquaCheck API.
 * Returns array of probes with their sensor depths.
 */
async function fetchProfiles(apiKey: string) {
  const res = await fetch(`${AQUACHECK_API}/getprofiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  })
  const data = await res.json()
  if (data.error || data.result === 'API key not found') {
    throw new Error(data.error?.message || data.result || 'Failed to fetch profiles')
  }
  return data
}

/**
 * Fetch sensor data for a probe from AquaCheck API.
 * date format: "YYYY-MM-DD HH:mm"
 */
async function fetchData(apiKey: string, probeSerial: string, fromDate: string, toDate: string) {
  const res = await fetch(`${AQUACHECK_API}/getdata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      probeSerial,
      fromDate,
      toDate,
    }),
  })
  const data = await res.json()
  if (data.error || data.result === 'API key not found') {
    throw new Error(data.error?.message || data.result || 'Failed to fetch data')
  }
  return data
}

// POST /api/weather/aquacheck — fetch soil moisture from AquaCheck and upsert
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  const token = authHeader?.replace('Bearer ', '') || querySecret
  if (cronSecret && token !== cronSecret) {
    if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const apiKey = process.env.AQUACHECK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AQUACHECK_API_KEY not configured' }, { status: 500 })
  }

  const svc = svcSupabase()

  // Get registered probes from our database
  const { data: probes, error: pErr } = await svc
    .from('aquacheck_probes')
    .select('id, probe_serial, probe_name, orchard_id')
    .eq('is_active', true)

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!probes || probes.length === 0) {
    return NextResponse.json({ message: 'No active probes configured' })
  }

  // Time window: last 2 hours (overlapping to catch any gaps)
  const now = new Date()
  const from = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  const results: Array<{ probe: string; readings: number; error?: string }> = []

  for (const probe of probes) {
    try {
      const data = await fetchData(apiKey, probe.probe_serial, fmt(from), fmt(now))

      // AquaCheck returns { data: [ { dateTime, sensors: [ { depth, moisture, temperature } ] } ] }
      // or similar structure — adapt once we see real response
      const readings = data.data || data.readings || data || []
      const records: Array<{
        probe_id: string
        reading_at: string
        depth_cm: number
        vwc_pct: number
        soil_temp_c: number | null
      }> = []

      for (const reading of readings) {
        const timestamp = reading.dateTime || reading.date_time || reading.timestamp
        if (!timestamp) continue

        const readingDate = new Date(timestamp)
        if (isNaN(readingDate.getTime())) continue

        const sensors = reading.sensors || reading.depths || []
        for (const sensor of sensors) {
          const depth = sensor.depth || sensor.depth_cm
          const vwc = sensor.moisture ?? sensor.vwc ?? sensor.vwc_pct
          if (depth == null || vwc == null) continue

          records.push({
            probe_id: probe.id,
            reading_at: readingDate.toISOString(),
            depth_cm: Math.round(Number(depth)),
            vwc_pct: Number(vwc),
            soil_temp_c: sensor.temperature ?? sensor.temp ?? sensor.soil_temp_c ?? null,
          })
        }
      }

      // Batch upsert
      if (records.length > 0) {
        for (let i = 0; i < records.length; i += 200) {
          const batch = records.slice(i, i + 200)
          const { error: uErr } = await svc
            .from('soil_moisture_readings')
            .upsert(batch, { onConflict: 'probe_id,reading_at,depth_cm' })
          if (uErr) throw new Error(`Upsert failed: ${uErr.message}`)
        }
      }

      results.push({ probe: probe.probe_serial, readings: records.length })
    } catch (err: any) {
      results.push({ probe: probe.probe_serial, readings: 0, error: err.message })
    }
  }

  return NextResponse.json({ ok: true, results })
}

// GET /api/weather/aquacheck/profiles — list available probes from AquaCheck (for setup)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  const token = authHeader?.replace('Bearer ', '') || querySecret
  if (cronSecret && token !== cronSecret) {
    if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const apiKey = process.env.AQUACHECK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AQUACHECK_API_KEY not configured' }, { status: 500 })
  }

  try {
    const profiles = await fetchProfiles(apiKey)
    return NextResponse.json({ profiles })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

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

// AquaCheck depths in mm (probe suffix) → cm for our database
const DEPTHS_MM = [100, 200, 300, 400, 500, 600]

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  const token = authHeader?.replace('Bearer ', '') || querySecret
  if (cronSecret && token !== cronSecret) {
    if (token !== process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  }
  return true
}

/**
 * Fetch probe profiles from AquaCheck ACWEB REST API.
 */
async function fetchProfiles(apiKey: string) {
  const res = await fetch(`${AQUACHECK_API}/getprofiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ APIKey: apiKey }),
  })
  const data = await res.json()
  if (data.error || data.result === 'API key not found') {
    throw new Error(data.error?.message || data.result || 'Failed to fetch profiles')
  }
  return data
}

/**
 * Fetch sensor data for probes using profilelist format.
 * Date format: "YYYY/MM/DD HH:mm"
 * Response: { profiles: [{ DataID, datapoints: [{ DataDate, SoilMoisture100..600, SoilTemperature100..600, ... }] }] }
 */
async function fetchData(apiKey: string, profilelist: Array<{ DataID: string; DateFrom: string }>) {
  const res = await fetch(`${AQUACHECK_API}/getdata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ APIKey: apiKey, profilelist }),
  })
  const data = await res.json()
  if (data.error || data.result === 'API key not found') {
    throw new Error(data.error?.message || data.result || 'Failed to fetch data')
  }
  return data
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function parseAquaCheckDate(dateStr: string): Date | null {
  // "YYYY/MM/DD HH:mm" format
  const match = dateStr.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/)
  if (!match) return null
  return new Date(
    parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
    parseInt(match[4]), parseInt(match[5])
  )
}

// POST /api/weather/aquacheck — fetch soil moisture from AquaCheck and upsert
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.AQUACHECK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AQUACHECK_API_KEY not configured' }, { status: 500 })
  }

  const svc = svcSupabase()

  // Get registered probes from our database (probe_serial = AquaCheck DataID)
  const { data: probes, error: pErr } = await svc
    .from('aquacheck_probes')
    .select('id, probe_serial, probe_name, orchard_id')
    .eq('is_active', true)

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!probes || probes.length === 0) {
    return NextResponse.json({ message: 'No active probes configured' })
  }

  // Time window: last 2 hours (overlapping to catch any gaps)
  const from = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const fromStr = fmtDate(from)

  // Build profilelist for single API call with all probes
  const probeLookup: Record<string, string> = {}
  const profilelist = probes.map(p => {
    probeLookup[p.probe_serial] = p.id
    return { DataID: p.probe_serial, DateFrom: fromStr }
  })

  try {
    const data = await fetchData(apiKey, profilelist)
    const profiles = data.profiles || []

    const results: Array<{ probe: string; readings: number }> = []

    for (const profile of profiles) {
      const probeId = probeLookup[profile.DataID]
      if (!probeId) continue

      const datapoints = profile.datapoints || []
      const records: Array<{
        probe_id: string
        reading_at: string
        depth_cm: number
        vwc_pct: number
        soil_temp_c: number | null
      }> = []

      for (const dp of datapoints) {
        const readingDate = parseAquaCheckDate(dp.DataDate)
        if (!readingDate) continue

        for (const depthMm of DEPTHS_MM) {
          const vwc = dp[`SoilMoisture${depthMm}`]
          if (vwc == null) continue

          records.push({
            probe_id: probeId,
            reading_at: readingDate.toISOString(),
            depth_cm: depthMm / 10,
            vwc_pct: Number(vwc),
            soil_temp_c: dp[`SoilTemperature${depthMm}`] ?? null,
          })
        }
      }

      // Batch upsert
      for (let i = 0; i < records.length; i += 200) {
        const batch = records.slice(i, i + 200)
        const { error: uErr } = await svc
          .from('soil_moisture_readings')
          .upsert(batch, { onConflict: 'probe_id,reading_at,depth_cm' })
        if (uErr) throw new Error(`Upsert failed for ${profile.DataID}: ${uErr.message}`)
      }

      results.push({ probe: profile.DataID, readings: records.length })
    }

    return NextResponse.json({ ok: true, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/weather/aquacheck — list available probes from AquaCheck (for setup/discovery)
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.AQUACHECK_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AQUACHECK_API_KEY not configured' }, { status: 500 })
  }

  try {
    const data = await fetchProfiles(apiKey)
    // Return simplified profile list for setup
    const profiles = (data.profiles || []).map((p: any) => ({
      dataId: p.DataID,
      name: p.ProfileName,
      probe: p.Probe,
      lat: p.Latitude,
      lng: p.Longitude,
      rootZones: p.RootZones,
      lastData: p.LastDataPointDate,
      farm: p.Farm,
      client: p.Client,
      status: p.rootzones?.map((rz: any) => ({
        depth_cm: rz.Bottom / 10,
        status: rz.Status,
        uraw: rz.URAW,
        lraw: rz.LRAW,
      })),
    }))
    return NextResponse.json({ profiles })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

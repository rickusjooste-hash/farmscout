import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const svc = createServiceClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface ReadingInput {
  date: string
  value_mm: number
}

export async function POST(req: NextRequest) {
  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM
  if (!twilioSid || !twilioToken || !twilioFrom) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 })
  }

  let body: { farm_id?: string; gauge_name?: string; readings?: ReadingInput[] } = {}
  try { body = await req.json() } catch { }

  const { farm_id, gauge_name, readings } = body
  if (!farm_id || !gauge_name || !readings || readings.length === 0) {
    return NextResponse.json({ error: 'farm_id, gauge_name, and readings[] are required' }, { status: 400 })
  }

  // Look up active recipients for this farm
  const { data: recipients, error: recipErr } = await svc
    .from('rain_notification_recipients')
    .select('full_name, phone')
    .eq('farm_id', farm_id)
    .eq('is_active', true)

  if (recipErr) {
    return NextResponse.json({ error: recipErr.message }, { status: 500 })
  }

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active recipients for this farm' })
  }

  // Build summary message
  const lines = readings
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => `${r.date}: ${r.value_mm}mm`)
  const total = readings.reduce((sum, r) => sum + r.value_mm, 0)

  const message = [
    `🌧 Rain logged at ${gauge_name}`,
    ...lines,
    `Total: ${total}mm`,
    `— allFarm`,
  ].join('\n')

  // Send WhatsApp via Twilio REST API
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`
  const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')

  let sent = 0
  const errors: string[] = []

  for (const recipient of recipients) {
    const toNumber = `whatsapp:${recipient.phone}`
    const params = new URLSearchParams({
      From: twilioFrom,
      To: toNumber,
      Body: message,
    })

    try {
      const res = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (res.ok) {
        sent++
      } else {
        const errText = await res.text()
        console.error(`[RainNotify] Failed to send to ${recipient.phone}: ${errText}`)
        errors.push(`${recipient.phone}: HTTP ${res.status}`)
      }
    } catch (err: any) {
      console.error(`[RainNotify] Error sending to ${recipient.phone}:`, err.message)
      errors.push(`${recipient.phone}: ${err.message}`)
    }
  }

  return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined })
}

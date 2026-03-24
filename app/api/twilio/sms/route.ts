import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Webhook to capture incoming SMS (used for WhatsApp number verification)
// Stores messages in Supabase so they persist across serverless invocations

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = String(formData.get('From') || '')
  const body = String(formData.get('Body') || '')
  const to = String(formData.get('To') || '')
  const timestamp = new Date().toISOString()

  console.log(`[TwilioSMS] From=${from} To=${to} Body=${body}`)

  // Store in Supabase key-value style using a simple upsert
  if (SERVICE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          key: 'twilio_last_sms',
          value: JSON.stringify({ from, to, body, timestamp }),
        }),
      })
    } catch {
      // Non-critical — still return TwiML
    }
  }

  // Also keep in-memory as fallback
  ;(globalThis as Record<string, unknown>).__lastSms = { from, to, body, timestamp }

  return new NextResponse(
    '<Response><Message>Received</Message></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function GET() {
  // Try Supabase first
  if (SERVICE_KEY) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/app_kv?key=eq.twilio_last_sms&select=value`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          cache: 'no-store',
        }
      )
      const rows = await res.json()
      if (rows?.[0]?.value) {
        return NextResponse.json(JSON.parse(rows[0].value))
      }
    } catch {
      // Fall through to in-memory
    }
  }

  const last = (globalThis as any).__lastSms
  if (last) return NextResponse.json(last)
  return NextResponse.json({ message: 'No SMS received yet' })
}

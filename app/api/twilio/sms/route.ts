import { NextRequest, NextResponse } from 'next/server'

// Temporary endpoint to capture incoming SMS for WhatsApp verification
// Logs the message body and returns TwiML response

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = formData.get('From') || ''
  const body = formData.get('Body') || ''
  const to = formData.get('To') || ''

  console.log('=== INCOMING SMS ===')
  console.log(`From: ${from}`)
  console.log(`To: ${to}`)
  console.log(`Body: ${body}`)
  console.log('====================')

  // Also store it so we can check via API
  const timestamp = new Date().toISOString()
  ;(globalThis as Record<string, unknown>).__lastSms = { from, to, body, timestamp }

  return new NextResponse(
    '<Response><Message>Received</Message></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

export async function GET() {
  const last = (globalThis as any).__lastSms
  if (last) {
    return NextResponse.json(last)
  }
  return NextResponse.json({ message: 'No SMS received yet' })
}

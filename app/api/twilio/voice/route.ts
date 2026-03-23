import { NextResponse } from 'next/server'

export async function POST() {
  const twiml = `<Response><Dial>+27824841852</Dial></Response>`
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function GET() {
  const twiml = `<Response><Dial>+27824841852</Dial></Response>`
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

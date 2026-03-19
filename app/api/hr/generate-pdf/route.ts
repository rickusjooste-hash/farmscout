import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { buildHrPdf, EventData } from '@/lib/hr-pdf'

function anonSupabase(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } }
  )
}

function svcSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const eventId = req.nextUrl.searchParams.get('event_id')
  if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  const svc = svcSupabase()

  const { data: event, error } = await svc
    .from('hr_events')
    .select('*, hr_event_types(name), qc_employees(full_name, employee_nr), farms(full_name, logo_url)')
    .eq('id', eventId)
    .single()

  if (error || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const d: EventData = {
    employeeName: event.qc_employees?.full_name ?? 'Unknown',
    employeeNr: event.qc_employees?.employee_nr ?? '',
    reason: event.reason ?? '',
    comments: event.comments ?? '',
    eventDate: event.event_date,
    farmName: event.farms?.full_name ?? '',
    chairPerson: event.chair_person ?? '',
    logoUrl: event.farms?.logo_url ?? null,
  }

  const pdfBytes = await buildHrPdf(event.hr_event_types?.name ?? 'Event', d)

  const filename = `${event.hr_event_types?.name ?? 'Event'} - ${d.employeeName} - ${d.eventDate}.pdf`
    .replace(/[^a-zA-Z0-9 ._-]/g, '')

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

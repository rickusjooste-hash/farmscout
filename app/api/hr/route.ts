import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { buildHrPdf, EventData } from '@/lib/hr-pdf'
import { Resend } from 'resend'

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

async function checkAccess(req: NextRequest) {
  const anon = anonSupabase(req)
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }

  const { data: orgUser } = await anon
    .from('organisation_users')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .single()
  if (!orgUser) return { error: 'Forbidden', status: 403 }

  return { user, orgUser, orgId: orgUser.organisation_id }
}

export async function POST(req: NextRequest) {
  const auth = await checkAccess(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { action } = body
  const svc = svcSupabase()

  // ── Create event ──
  if (action === 'create-event') {
    const d = body.data
    if (!d?.employee_id || !d?.event_type_id || !d?.event_date || !d?.farm_id) {
      return NextResponse.json({ error: 'employee_id, event_type_id, event_date, farm_id required' }, { status: 400 })
    }

    // Look up validity_months to compute expires_at
    const { data: eventType } = await svc
      .from('hr_event_types')
      .select('validity_months')
      .eq('id', d.event_type_id)
      .single()

    let expiresAt: string | null = null
    if (eventType?.validity_months) {
      const ed = new Date(d.event_date)
      ed.setMonth(ed.getMonth() + eventType.validity_months)
      expiresAt = ed.toISOString().split('T')[0]
    }

    const row = {
      organisation_id: auth.orgId,
      farm_id: d.farm_id,
      employee_id: d.employee_id,
      event_type_id: d.event_type_id,
      reason_category_id: d.reason_category_id || null,
      event_date: d.event_date,
      reason: d.reason || null,
      comments: d.comments || null,
      status: 'active',
      expires_at: expiresAt,
      created_by: auth.user!.id,
      actioned_by: d.actioned_by || null,
      chair_person: d.chair_person || null,
      photo_url: d.photo_url || null,
      escalated_from_id: d.escalated_from_id || null,
    }

    const { data, error } = await svc.from('hr_events').insert(row).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Auto-email the PDF to the logged-in user (fire-and-forget)
    const userEmail = auth.user!.email
    const resendKey = process.env.RESEND_API_KEY
    if (userEmail && resendKey) {
      sendEventEmail(svc, data.id, [userEmail], resendKey).catch(() => {})
    }

    return NextResponse.json({ ok: true, id: data.id })
  }

  // ── Update event ──
  if (action === 'update-event') {
    const { id, ...fields } = body.data || {}
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('hr_events').update(fields).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Rescind event ──
  if (action === 'rescind-event') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('hr_events').update({ status: 'rescinded' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Update event type settings ──
  if (action === 'update-event-type') {
    const { id, validity_months } = body.data || {}
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('hr_event_types').update({ validity_months }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Reason category CRUD ──
  if (action === 'create-category') {
    const { name, description } = body.data || {}
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const { data, error } = await svc.from('hr_reason_categories').insert({ name, description }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: data.id })
  }

  if (action === 'update-category') {
    const { id, ...fields } = body.data || {}
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('hr_reason_categories').update(fields).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'deactivate-category') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('hr_reason_categories').update({ is_active: false }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ── Auto-email helper (fire-and-forget after event creation) ────────────

async function sendEventEmail(svc: ReturnType<typeof svcSupabase>, eventId: string, to: string[], resendKey: string) {
  const { data: event } = await svc
    .from('hr_events')
    .select('*, hr_event_types(name), qc_employees(full_name, employee_nr), farms(full_name, logo_url)')
    .eq('id', eventId)
    .single()

  if (!event) return

  const eventTypeName = event.hr_event_types?.name ?? 'Event'
  const employeeName = event.qc_employees?.full_name ?? 'Unknown'
  const employeeNr = event.qc_employees?.employee_nr ?? ''
  const farmName = event.farms?.full_name ?? ''

  const d: EventData = {
    employeeName, employeeNr,
    reason: event.reason ?? '',
    comments: event.comments ?? '',
    eventDate: event.event_date,
    farmName,
    chairPerson: event.chair_person ?? '',
    logoUrl: event.farms?.logo_url ?? null,
  }

  const pdfBytes = await buildHrPdf(eventTypeName, d)
  const filename = `${eventTypeName} - ${employeeName} - ${event.event_date}.pdf`.replace(/[^a-zA-Z0-9 ._-]/g, '')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:system-ui,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;">
  <div style="background:#1a2340;padding:24px 32px;">
    <div style="color:#7a9fd4;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">FarmScout HR</div>
    <div style="color:#fff;font-size:20px;font-weight:700;">Event Created: ${eventTypeName}</div>
  </div>
  <div style="padding:28px 32px;">
    <table style="width:100%;font-size:14px;color:#333;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#888;width:130px;">Employee</td><td style="padding:8px 0;font-weight:600;">${employeeName} (${employeeNr})</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Farm</td><td style="padding:8px 0;">${farmName}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Date</td><td style="padding:8px 0;">${event.event_date}</td></tr>
      <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Reason</td><td style="padding:8px 0;">${event.reason || '\u2014'}</td></tr>
    </table>
    <p style="color:#888;font-size:12px;margin-top:24px;">The formal document is attached as a PDF. Print, sign, and upload the signed copy back to FarmScout.</p>
  </div>
</div>
</body></html>`

  const resend = new Resend(resendKey)
  await resend.emails.send({
    from: 'FarmScout <noreply@farmscout.app>',
    to,
    subject: `HR: ${eventTypeName} \u2014 ${employeeName} (${event.event_date})`,
    html,
    attachments: [{ filename, content: Buffer.from(pdfBytes).toString('base64') }],
  })
}

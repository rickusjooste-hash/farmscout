import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

// ─── GET: Load planning data for an orchard ─────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await checkAccess(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const orchardId = req.nextUrl.searchParams.get('orchard_id')
  const section = req.nextUrl.searchParams.get('section') // 'spec', 'pollinators', 'tasks', 'documents', 'contacts'

  if (!orchardId) return NextResponse.json({ error: 'orchard_id required' }, { status: 400 })

  const svc = svcSupabase()

  if (section === 'spec') {
    const { data, error } = await svc
      .from('orchard_planning_spec')
      .select('*')
      .eq('orchard_id', orchardId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  if (section === 'pollinators') {
    const { data, error } = await svc
      .from('orchard_pollinators')
      .select('*')
      .eq('orchard_id', orchardId)
      .order('sort_order')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ?? [])
  }

  if (section === 'tasks') {
    const { data, error } = await svc
      .from('planning_tasks')
      .select('*, planning_contacts(name, company)')
      .eq('orchard_id', orchardId)
      .order('sort_order')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ?? [])
  }

  if (section === 'documents') {
    const step = req.nextUrl.searchParams.get('step')
    let q = svc.from('planning_documents').select('*').eq('orchard_id', orchardId)
    if (step) q = q.eq('step', step)
    const { data, error } = await q.order('uploaded_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ?? [])
  }

  if (section === 'contacts') {
    const { data, error } = await svc
      .from('planning_contacts')
      .select('*')
      .eq('organisation_id', auth.orgId)
      .eq('is_active', true)
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data ?? [])
  }

  return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
}

// ─── POST: Create / update planning data ────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await checkAccess(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Record<string, any>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { action } = body
  const svc = svcSupabase()

  // ── Save planning spec (upsert) ──
  if (action === 'save-spec') {
    const { orchard_id, ...fields } = body.data || {}
    if (!orchard_id) return NextResponse.json({ error: 'orchard_id required' }, { status: 400 })

    const { data: existing } = await svc
      .from('orchard_planning_spec')
      .select('id')
      .eq('orchard_id', orchard_id)
      .maybeSingle()

    if (existing) {
      const { error } = await svc
        .from('orchard_planning_spec')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('orchard_id', orchard_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      const { error } = await svc
        .from('orchard_planning_spec')
        .insert({ orchard_id, organisation_id: auth.orgId, ...fields })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Update orchard planning fields ──
  if (action === 'update-orchard') {
    const { id, ...fields } = body.data || {}
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('orchards').update(fields).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Save pollinators (replace all) ──
  if (action === 'save-pollinators') {
    const { orchard_id, pollinators } = body
    if (!orchard_id) return NextResponse.json({ error: 'orchard_id required' }, { status: 400 })
    await svc.from('orchard_pollinators').delete().eq('orchard_id', orchard_id)
    if (pollinators?.length > 0) {
      const rows = pollinators.map((p: any, i: number) => ({
        organisation_id: auth.orgId,
        orchard_id,
        variety: p.variety,
        rootstock: p.rootstock || null,
        percentage: p.percentage,
        nursery: p.nursery || null,
        sort_order: i,
      }))
      const { error } = await svc.from('orchard_pollinators').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── Create / update task ──
  if (action === 'save-task') {
    const { id, ...fields } = body.data || {}
    if (id) {
      const { error } = await svc.from('planning_tasks').update(fields).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true })
    } else {
      fields.organisation_id = auth.orgId
      const { data, error } = await svc.from('planning_tasks').insert(fields).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, id: data.id })
    }
  }

  // ── Bulk create tasks from template ──
  if (action === 'generate-tasks') {
    const { orchard_id, tasks } = body
    if (!orchard_id || !tasks?.length) return NextResponse.json({ error: 'orchard_id and tasks required' }, { status: 400 })
    // Delete existing tasks for this orchard first
    await svc.from('planning_tasks').delete().eq('orchard_id', orchard_id)
    const rows = tasks.map((t: any) => ({
      organisation_id: auth.orgId,
      orchard_id,
      name: t.name,
      category: t.category,
      start_date: t.startDate,
      end_date: t.endDate,
      sort_order: t.sortOrder,
      status: 'pending' as const,
    }))
    const { error } = await svc.from('planning_tasks').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Delete task ──
  if (action === 'delete-task') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('planning_tasks').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Save contact ──
  if (action === 'save-contact') {
    const { id, ...fields } = body.data || {}
    if (id) {
      const { error } = await svc.from('planning_contacts').update(fields).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, id })
    } else {
      fields.organisation_id = auth.orgId
      const { data, error } = await svc.from('planning_contacts').insert(fields).select('id').single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, id: data.id })
    }
  }

  // ── Delete contact ──
  if (action === 'delete-contact') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('planning_contacts').update({ is_active: false }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // ── Save document reference ──
  if (action === 'save-document') {
    const { orchard_id, step, file_name, file_url } = body
    if (!orchard_id || !step || !file_name || !file_url) {
      return NextResponse.json({ error: 'orchard_id, step, file_name, file_url required' }, { status: 400 })
    }
    const { data, error } = await svc.from('planning_documents').insert({
      organisation_id: auth.orgId,
      orchard_id, step, file_name, file_url,
      uploaded_by: auth.user!.id,
    }).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, id: data.id })
  }

  // ── Delete document ──
  if (action === 'delete-document') {
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await svc.from('planning_documents').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

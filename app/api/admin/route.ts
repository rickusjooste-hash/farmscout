import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing service role key' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { type } = body

  if (type === 'create-org') {
    const { name, slug, plan } = body
    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
    }
    const { error } = await supabase.from('organisations').insert({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
      plan: plan?.trim() || null,
      is_active: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (type === 'create-farm') {
    const { organisation_id, code, full_name, puc, province, region } = body
    if (!organisation_id || !code || !full_name) {
      return NextResponse.json({ error: 'organisation_id, code, and full_name are required' }, { status: 400 })
    }
    const { error } = await supabase.from('farms').insert({
      organisation_id,
      code: code.trim().toUpperCase(),
      full_name: full_name.trim(),
      puc: puc?.trim() || null,
      province: province?.trim() || null,
      region: region?.trim() || null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

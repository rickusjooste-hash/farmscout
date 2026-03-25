import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders(prefer = 'return=representation') {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        prefer,
  }
}

// GET /api/qc/settings/size-bins?commodity_id=<uuid>&variety_group=<text>
export async function GET(req: NextRequest) {
  const commodityId = req.nextUrl.searchParams.get('commodity_id')
  const varietyGroup = req.nextUrl.searchParams.get('variety_group')
  let url = `${SUPABASE_URL}/rest/v1/size_bins?order=display_order.asc`
  if (commodityId) url += `&commodity_id=eq.${commodityId}`
  if (varietyGroup) url += `&variety_group=eq.${varietyGroup}`

  const res = await fetch(url, {
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  })
  const data = await res.json()
  return NextResponse.json(data)
}

// POST /api/qc/settings/size-bins
// body: { commodity_id, label, weight_min_g, weight_max_g, display_order, is_active }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${SUPABASE_URL}/rest/v1/size_bins`, {
      method:  'POST',
      headers: serviceHeaders(),
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('/api/qc/settings/size-bins POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/qc/settings/size-bins
// body: { id, label?, weight_min_g?, weight_max_g?, display_order?, is_active? }
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...patch } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await fetch(`${SUPABASE_URL}/rest/v1/size_bins?id=eq.${id}`, {
      method:  'PATCH',
      headers: serviceHeaders('return=minimal'),
      body:    JSON.stringify(patch),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('/api/qc/settings/size-bins PATCH error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/qc/settings/size-bins?id=<uuid>
// If FK constraint blocks hard delete (qc_fruit references this bin), soft-delete instead.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const res = await fetch(`${SUPABASE_URL}/rest/v1/size_bins?id=eq.${id}`, {
    method:  'DELETE',
    headers: serviceHeaders('return=minimal'),
  })

  if (!res.ok) {
    // FK violation (409) or other error — fall back to soft-delete
    const fallback = await fetch(`${SUPABASE_URL}/rest/v1/size_bins?id=eq.${id}`, {
      method:  'PATCH',
      headers: serviceHeaders('return=minimal'),
      body:    JSON.stringify({ is_active: false }),
    })
    if (!fallback.ok) {
      const err = await fallback.text()
      return NextResponse.json({ error: `Delete failed: ${err}` }, { status: 400 })
    }
    return NextResponse.json({ ok: true, soft_deleted: true })
  }

  return NextResponse.json({ ok: true })
}

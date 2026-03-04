import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders() {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
  }
}

// PATCH /api/qc/settings/issues
// body: { type: 'reorder', commodity_id, ids: string[] }
//    OR { type: 'update',  id: string, category?: string, is_active?: boolean }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.type === 'reorder') {
      const { commodity_id, ids } = body as { commodity_id: string; ids: string[] }
      if (!commodity_id || !Array.isArray(ids)) {
        return NextResponse.json({ error: 'Missing commodity_id or ids' }, { status: 400 })
      }

      // Update display_order for each commodity_pests row
      const updates = ids.map((id, index) =>
        fetch(`${SUPABASE_URL}/rest/v1/commodity_pests?id=eq.${id}`, {
          method: 'PATCH',
          headers: serviceHeaders(),
          body: JSON.stringify({ display_order: index }),
        })
      )
      await Promise.all(updates)
      return NextResponse.json({ ok: true })
    }

    if (body.type === 'update') {
      const { id, category, is_active } = body as {
        id: string
        category?: string
        is_active?: boolean
      }
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

      const patch: Record<string, unknown> = {}
      if (category   !== undefined) patch.category  = category
      if (is_active  !== undefined) patch.is_active = is_active

      await fetch(`${SUPABASE_URL}/rest/v1/commodity_pests?id=eq.${id}`, {
        method: 'PATCH',
        headers: serviceHeaders(),
        body: JSON.stringify(patch),
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err) {
    console.error('/api/qc/settings/issues PATCH error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

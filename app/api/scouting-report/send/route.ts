import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const svc = createServiceClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface TrapReportRow {
  commodity_code: string
  commodity_name: string
  orchard_id: string
  orchard_display: string
  pest_id: string
  pest_name: string
  pest_abbr: string
  this_week_count: number
  last_week_count: number
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function arrowAndColor(thisW: number, lastW: number): { arrow: string; color: string } {
  if (thisW === 0 && lastW === 0) return { arrow: '', color: '#9aaa9f' }
  if (thisW > lastW) return { arrow: ' ↑', color: thisW >= 5 ? '#e85a4a' : '#c49a00' }
  if (thisW < lastW) return { arrow: ' ↓', color: '#2a6e45' }
  return { arrow: '', color: thisW > 0 ? '#c49a00' : '#9aaa9f' }
}

function buildScoutingReportEmail(rows: TrapReportRow[], weekNr: number, farmName: string): string {
  if (rows.length === 0) {
    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:700px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;">
<div style="background:#1c3a2a;padding:28px 32px;"><div style="color:#a8d5a2;font-size:13px;margin-bottom:8px;">FarmScout</div>
<div style="color:#fff;font-size:24px;font-weight:700;">Trap Inspection Report</div>
<div style="color:#6aab80;font-size:14px;margin-top:6px;">${farmName} · Week ${weekNr}</div></div>
<div style="padding:28px 32px;color:#3a4a40;font-size:14px;">No trap inspection data recorded this week.</div>
</div></body></html>`
  }

  // Collect distinct pest columns sorted by abbr
  const pestCols: { abbr: string; name: string }[] = []
  const seenAbbr = new Set<string>()
  for (const r of rows) {
    if (!seenAbbr.has(r.pest_abbr)) {
      seenAbbr.add(r.pest_abbr)
      pestCols.push({ abbr: r.pest_abbr, name: r.pest_name })
    }
  }
  pestCols.sort((a, b) => a.abbr.localeCompare(b.abbr))

  // Group rows: commodity → orchard → pest map
  const commodities: Map<string, { name: string; orchards: Map<string, { display: string; pestMap: Map<string, { tw: number; lw: number }> }> }> = new Map()
  for (const r of rows) {
    if (!commodities.has(r.commodity_code)) {
      commodities.set(r.commodity_code, { name: r.commodity_name, orchards: new Map() })
    }
    const comm = commodities.get(r.commodity_code)!
    if (!comm.orchards.has(r.orchard_id)) {
      comm.orchards.set(r.orchard_id, { display: r.orchard_display, pestMap: new Map() })
    }
    comm.orchards.get(r.orchard_id)!.pestMap.set(r.pest_abbr, {
      tw: Number(r.this_week_count),
      lw: Number(r.last_week_count),
    })
  }

  // Build pest legend
  const legendLine = pestCols.map(p => `${p.abbr} - ${p.name}`).join(' | ')

  // Build pest header columns
  const pestHeaderCols = pestCols.map(p =>
    `<th style="padding:8px 10px;text-align:center;color:#7a8a80;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">${p.abbr}</th>`
  ).join('')

  // Build commodity sections
  const commoditySections: string[] = []
  for (const [commCode, comm] of commodities) {
    const orchardRows: string[] = []
    for (const [, orchard] of comm.orchards) {
      const cells = pestCols.map(p => {
        const data = orchard.pestMap.get(p.abbr)
        if (!data) {
          return `<td style="padding:8px 10px;text-align:center;color:#d0d0d0;font-size:12px;">—</td>`
        }
        const { tw, lw } = data
        const { arrow, color } = arrowAndColor(tw, lw)
        const isZero = tw === 0 && lw === 0
        const cellText = isZero ? '0(0)' : `${tw}(${lw})${arrow}`
        return `<td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:${isZero ? '400' : '600'};color:${color};">${cellText}</td>`
      }).join('')

      orchardRows.push(`<tr style="border-bottom:1px solid #f0f0f0;">
  <td style="padding:8px 12px;font-size:13px;color:#1c3a2a;">${orchard.display}</td>
  ${cells}
</tr>`)
    }

    commoditySections.push(`
<tr style="background:#e8f5ee;">
  <td colspan="${pestCols.length + 1}" style="padding:8px 12px;font-size:12px;font-weight:700;color:#1c3a2a;text-transform:uppercase;letter-spacing:0.08em;">${commCode} — ${comm.name}</td>
</tr>
${orchardRows.join('')}`)
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:system-ui,sans-serif;">
<div style="max-width:800px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#1c3a2a;padding:28px 32px;">
    <div style="color:#a8d5a2;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">FarmScout</div>
    <div style="color:#fff;font-size:24px;font-weight:700;">Trap Inspection Report</div>
    <div style="color:#6aab80;font-size:14px;margin-top:6px;">${farmName} · Week ${weekNr}</div>
  </div>
  <div style="padding:28px 32px;">
    <p style="color:#3a4a40;font-size:13px;margin-bottom:20px;">Trap catch counts for this week with last week in brackets. ↑ increase · ↓ decrease.</p>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:500px;">
        <thead>
          <tr style="background:#f4f1eb;">
            <th style="padding:8px 12px;text-align:left;color:#7a8a80;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Orchard</th>
            ${pestHeaderCols}
          </tr>
        </thead>
        <tbody>
          ${commoditySections.join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #f0ede6;background:#faf9f6;">
    <p style="color:#9aaa9f;font-size:11px;margin-bottom:4px;">${legendLine}</p>
    <p style="color:#9aaa9f;font-size:12px;">Generated by FarmScout · Trap Inspection Report System</p>
  </div>
</div>
</body></html>`
}

export async function POST(req: NextRequest) {
  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  let body: { org_id?: string; farm_id?: string } = {}
  try { body = await req.json() } catch { }

  const farmId = body.farm_id
  if (!farmId) return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })

  // Fetch farm name
  const { data: farmRow } = await svc.from('farms').select('full_name').eq('id', farmId).single()
  const farmName = farmRow?.full_name ?? ''

  // Call RPC
  const { data: reportRows, error: rpcError } = await svc.rpc('get_weekly_trap_report', {
    p_farm_id: farmId,
  })

  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

  // Get scout report recipients for this farm
  const { data: recipients } = await svc
    .from('rebait_notification_recipients')
    .select('email')
    .eq('farm_id', farmId)
    .eq('is_active', true)
    .eq('receives_scout_report', true)

  const toEmails = (recipients || []).map((r: { email: string }) => r.email)

  if (toEmails.length === 0) {
    return NextResponse.json({ ok: true, recipientCount: 0, message: 'No recipients configured for scout report' })
  }

  const weekNr = getISOWeekNumber(new Date())
  const html = buildScoutingReportEmail((reportRows as TrapReportRow[]) || [], weekNr, farmName)

  const resend = new Resend(resendKey)
  await resend.emails.send({
    from: 'FarmScout <noreply@farmscout.app>',
    to: toEmails,
    subject: `FarmScout — Trap Inspection Report · ${farmName} · Week ${weekNr}`,
    html,
  })

  return NextResponse.json({ ok: true, recipientCount: toEmails.length })
}

// Supabase Edge Function — weekly-tree-report
// Runs every Saturday at 06:00 UTC (08:00 SAST) via cron.
// Loops all farms with active receives_tree_report recipients → calls get_weekly_tree_report → sends email.
// Deploy: supabase functions deploy weekly-tree-report
// Cron:   0 6 * * 6  (every Saturday 06:00 UTC)
// Secret: supabase secrets set RESEND_API_KEY=re_xxx

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

interface TreeReportRow {
  commodity_code: string
  commodity_name: string
  orchard_id: string
  orchard_display: string
  pest_id: string
  pest_name: string
  observation_method: string
  tw_trees_inspected: number
  tw_trees_affected: number
  lw_trees_inspected: number
  lw_trees_affected: number
}

function svcHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function dbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: svcHeaders() })
  return res.json()
}

async function dbRpc(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'FarmScout <noreply@farmscout.app>', to, subject, html }),
  })
  return res.ok
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

interface CellResult {
  text: string
  color: string
}

function cellContent(twInsp: number, twAff: number, lwInsp: number, lwAff: number): CellResult {
  if (twInsp === 0 && lwInsp === 0) return { text: '—', color: '#d0d0d0' }
  if (twInsp === 0) return { text: '0/0', color: '#9aaa9f' }
  const pct = Math.round((twAff / twInsp) * 100)
  const lwPct = lwInsp > 0 ? (lwAff / lwInsp) * 100 : null
  const arrow = lwPct === null ? '' : pct > lwPct ? ' ↑' : pct < lwPct ? ' ↓' : ''
  const color = pct >= 50 ? '#e85a4a' : pct >= 20 ? '#c49a00' : pct > 0 ? '#2a6e45' : '#9aaa9f'
  return { text: `${twAff}/${twInsp} · ${pct}%${arrow}`, color }
}

function buildEmail(rows: TreeReportRow[], weekNr: number, farmName: string): string {
  if (rows.length === 0) {
    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f4f4f4;margin:0;padding:0;">
<div style="max-width:700px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;">
<div style="background:#1c3a2a;padding:28px 32px;"><div style="color:#a8d5a2;font-size:13px;margin-bottom:8px;">FarmScout</div>
<div style="color:#fff;font-size:24px;font-weight:700;">Tree Scouting Report</div>
<div style="color:#6aab80;font-size:14px;margin-top:6px;">${farmName} · Week ${weekNr}</div></div>
<div style="padding:28px 32px;color:#3a4a40;font-size:14px;">No tree scouting data recorded this week.</div>
</div></body></html>`
  }

  // Distinct pest columns sorted by name
  const pestCols: { id: string; name: string }[] = []
  const seenPest = new Set<string>()
  for (const r of rows) {
    if (!seenPest.has(r.pest_id)) {
      seenPest.add(r.pest_id)
      pestCols.push({ id: r.pest_id, name: r.pest_name })
    }
  }
  pestCols.sort((a, b) => a.name.localeCompare(b.name))

  // Group: commodity → orchard → pest map
  const commodities: Map<string, {
    name: string
    orchards: Map<string, {
      display: string
      pestMap: Map<string, { twInsp: number; twAff: number; lwInsp: number; lwAff: number }>
    }>
  }> = new Map()

  for (const r of rows) {
    if (!commodities.has(r.commodity_code)) {
      commodities.set(r.commodity_code, { name: r.commodity_name, orchards: new Map() })
    }
    const comm = commodities.get(r.commodity_code)!
    if (!comm.orchards.has(r.orchard_id)) {
      comm.orchards.set(r.orchard_id, { display: r.orchard_display, pestMap: new Map() })
    }
    comm.orchards.get(r.orchard_id)!.pestMap.set(r.pest_id, {
      twInsp: Number(r.tw_trees_inspected),
      twAff:  Number(r.tw_trees_affected),
      lwInsp: Number(r.lw_trees_inspected),
      lwAff:  Number(r.lw_trees_affected),
    })
  }

  // Vertical pest header columns
  const pestHeaderCols = pestCols.map(p =>
    `<th style="padding:4px 6px;text-align:center;vertical-align:bottom;width:60px;min-width:50px;"><div style="writing-mode:vertical-lr;transform:rotate(180deg);white-space:nowrap;font-size:11px;font-weight:600;color:#7a8a80;height:80px;display:flex;align-items:flex-end;justify-content:center;">${p.name}</div></th>`
  ).join('')

  const commoditySections: string[] = []
  for (const [commCode, comm] of commodities) {
    const orchardRows: string[] = []
    for (const [, orchard] of comm.orchards) {
      const cells = pestCols.map(p => {
        const data = orchard.pestMap.get(p.id)
        if (!data) return `<td style="padding:7px 6px;text-align:center;color:#d0d0d0;font-size:12px;">—</td>`
        const { twInsp, twAff, lwInsp, lwAff } = data
        const { text, color } = cellContent(twInsp, twAff, lwInsp, lwAff)
        return `<td style="padding:7px 6px;text-align:center;font-size:11px;font-weight:600;color:${color};white-space:nowrap;">${text}</td>`
      }).join('')
      orchardRows.push(`<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:7px 12px;font-size:13px;color:#1c3a2a;white-space:nowrap;">${orchard.display}</td>${cells}</tr>`)
    }
    commoditySections.push(`<tr style="background:#e8f5ee;"><td colspan="${pestCols.length + 1}" style="padding:7px 12px;font-size:12px;font-weight:700;color:#1c3a2a;text-transform:uppercase;letter-spacing:0.08em;">${commCode} — ${comm.name}</td></tr>${orchardRows.join('')}`)
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:system-ui,sans-serif;">
<div style="max-width:900px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="background:#1c3a2a;padding:28px 32px;"><div style="color:#a8d5a2;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">FarmScout</div><div style="color:#fff;font-size:24px;font-weight:700;">Tree Scouting Report</div><div style="color:#6aab80;font-size:14px;margin-top:6px;">${farmName} · Week ${weekNr}</div></div>
<div style="padding:28px 32px;"><p style="color:#3a4a40;font-size:13px;margin-bottom:20px;">Trees affected / trees inspected · incidence %. ↑ increased vs last week · ↓ decreased.</p>
<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead><tr style="background:#f4f1eb;"><th style="padding:8px 12px;text-align:left;color:#7a8a80;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;vertical-align:bottom;min-width:140px;">Orchard</th>${pestHeaderCols}</tr></thead>
<tbody>${commoditySections.join('')}</tbody>
</table></div></div>
<div style="padding:16px 32px;border-top:1px solid #f0ede6;background:#faf9f6;"><p style="color:#9aaa9f;font-size:11px;margin-bottom:4px;">Red ≥50% · Amber ≥20% · Green &gt;0% · Grey 0%</p><p style="color:#9aaa9f;font-size:12px;">Generated by FarmScout · Tree Scouting Report System</p></div>
</div></body></html>`
}

serve(async (_req: Request) => {
  try {
    const weekNr = getISOWeekNumber(new Date())

    // Find all distinct farm_ids that have at least one active receives_tree_report recipient
    const recipients: any[] = await dbGet(
      `rebait_notification_recipients?is_active=eq.true&receives_tree_report=eq.true&select=farm_id,email`
    )

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No tree report recipients configured' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Group emails by farm_id
    const farmEmailMap: Record<string, string[]> = {}
    for (const r of recipients) {
      if (!farmEmailMap[r.farm_id]) farmEmailMap[r.farm_id] = []
      farmEmailMap[r.farm_id].push(r.email)
    }

    let emailsSent = 0

    for (const [farmId, emails] of Object.entries(farmEmailMap)) {
      try {
        const farms: any[] = await dbGet(`farms?id=eq.${farmId}&select=full_name`)
        const farmName = farms?.[0]?.full_name ?? ''

        const rows: TreeReportRow[] = await dbRpc('get_weekly_tree_report', { p_farm_id: farmId })

        const html = buildEmail(rows || [], weekNr, farmName)
        const ok = await sendEmail(
          emails,
          `FarmScout — Tree Scouting Report · ${farmName} · Week ${weekNr}`,
          html
        )
        if (ok) emailsSent += emails.length
      } catch (err) {
        console.error(`[weekly-tree-report] Error for farm ${farmId}:`, err)
      }
    }

    return new Response(JSON.stringify({ ok: true, farmsProcessed: Object.keys(farmEmailMap).length, emailsSent }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[weekly-tree-report] Fatal error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

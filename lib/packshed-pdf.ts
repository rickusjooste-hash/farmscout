import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionRow { orchard_name: string; variety: string | null; bins_packed: number | null; start_time: string; end_time: string; smous_weight_kg: number | null }
interface BoxTypeSummary { code: string; name: string; totalCartons: number; cartons_per_pallet: number; weight_per_carton_kg: number }
interface BinWeightRow { seq: number; gross_weight_kg: number; net_weight_kg: number; bin_count: number; category: string }
interface SizeDistRow { label: string; count: number; pct: number }
interface JuiceDefectRow { name: string; count: number; pct: number }

export interface PackoutPdfData {
  packDate: string
  packhouseName: string
  sessions: SessionRow[]
  // Summary data
  totalBinsPacked: number
  avgBinWeight: number
  totalKgIn: number
  // Category breakdown
  boxTypeSummaries: BoxTypeSummary[]
  smousKg: number
  juiceKg: number
  rotKg: number
  totalKgOut: number
  conversionPct: number
  lossPct: number
  // Size distribution
  sizeDistribution: SizeDistRow[]
  // Juice defects
  juiceDefects: JuiceDefectRow[]
}

// ── Colors ─────────────────────────────────────────────────────────────────

const BLACK = rgb(0, 0, 0)
const GREY = rgb(0.45, 0.45, 0.45)
const LIGHT_GREY = rgb(0.92, 0.93, 0.94)
const BLUE = rgb(0.13, 0.46, 0.85)
const GREEN = rgb(0.30, 0.69, 0.45)
const RED = rgb(0.91, 0.35, 0.29)
const AMBER = rgb(0.90, 0.66, 0.10)

const BAR_COLORS = [
  rgb(0.13, 0.46, 0.85), rgb(0.30, 0.69, 0.45), rgb(0.91, 0.35, 0.29),
  rgb(0.90, 0.66, 0.10), rgb(0.55, 0.36, 0.75), rgb(0.40, 0.60, 0.80),
  rgb(0.80, 0.50, 0.30), rgb(0.50, 0.75, 0.50), rgb(0.75, 0.40, 0.60),
  rgb(0.60, 0.60, 0.40), rgb(0.35, 0.55, 0.70), rgb(0.70, 0.45, 0.55),
  rgb(0.45, 0.65, 0.45), rgb(0.65, 0.55, 0.35),
]

// ── Main export ────────────────────────────────────────────────────────────

export async function generatePackoutPdf(data: PackoutPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold)

  const W = 595   // A4 portrait
  const H = 842
  const M = 32    // margin
  const UW = W - M * 2  // usable width

  const page = doc.addPage([W, H])
  let y = H - M

  function txt(s: string, x: number, yy: number, f: PDFFont, sz: number, c = BLACK) {
    page.drawText(s, { x, y: yy, size: sz, font: f, color: c })
  }

  function rightTxt(s: string, x: number, yy: number, f: PDFFont, sz: number, c = BLACK) {
    const tw = f.widthOfTextAtSize(s, sz)
    page.drawText(s, { x: x - tw, y: yy, size: sz, font: f, color: c })
  }

  function hline(y: number) {
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LIGHT_GREY })
  }

  // ── Title ────────────────────────────────────────────────────────

  txt('MV Packout', M, y, fontB, 18, BLUE)
  y -= 22

  // ── Header info (two columns) ───────────────────────────────────

  const orchardNames = data.sessions.map(s => s.orchard_name).join(', ')
  const varieties = [...new Set(data.sessions.map(s => s.variety).filter(Boolean))].join(', ')
  const startTime = data.sessions.find(s => s.start_time)?.start_time || ''
  const endTime = data.sessions.find(s => s.end_time)?.end_time || ''
  const diff = data.totalKgIn > 0 ? ((data.totalKgIn - data.totalKgOut) / data.totalKgIn * 100) : 0

  const leftCol: [string, string][] = [
    ['Date:', data.packDate],
    ['Start Time:', startTime || '-'],
    ['End Time:', endTime || '-'],
    ['Orchard:', orchardNames || '-'],
    ['Variety:', varieties || '-'],
    ['Total Bins Packed:', String(data.totalBinsPacked)],
  ]

  const rightCol: [string, string][] = [
    ['Conversion Ratio:', data.totalBinsPacked > 0 ? '1,00' : '-'],
    ['% Loss:', data.totalKgIn > 0 ? `${data.lossPct.toFixed(0)}%` : '-'],
    ['Average KG per Bin:', data.avgBinWeight.toFixed(0)],
    ['Total KG Tipped:', data.totalKgIn > 0 ? Math.round(data.totalKgIn).toLocaleString() : '-'],
    ['Difference:', data.totalKgIn > 0 ? `${diff.toFixed(0)}%` : '-'],
  ]

  const ROW = 12
  const midX = M + UW / 2 + 20

  for (let i = 0; i < Math.max(leftCol.length, rightCol.length); i++) {
    if (i < leftCol.length) {
      txt(leftCol[i][0], M, y, fontB, 8, GREY)
      txt(leftCol[i][1], M + 100, y, font, 8)
    }
    if (i < rightCol.length) {
      txt(rightCol[i][0], midX, y, fontB, 8, GREY)
      txt(rightCol[i][1], midX + 120, y, font, 8)
    }
    y -= ROW
  }

  y -= 8
  hline(y + 4)
  y -= 8

  // ── Category breakdown table ────────────────────────────────────

  txt('Category:', M, y, fontB, 8, GREY)
  txt('Total:', M + 200, y, fontB, 8, GREY)
  txt('Pallets:', M + 260, y, fontB, 8, GREY)
  txt('Weight:', M + 320, y, fontB, 8, GREY)
  txt('%', M + 380, y, fontB, 8, GREY)
  y -= 4
  hline(y)
  y -= ROW

  // Box type rows
  for (const bt of data.boxTypeSummaries) {
    if (bt.totalCartons === 0) continue
    const pallets = bt.cartons_per_pallet > 0 ? (bt.totalCartons / bt.cartons_per_pallet).toFixed(2) : '-'
    const kgOut = bt.totalCartons * bt.weight_per_carton_kg
    const pct = data.totalKgIn > 0 ? (kgOut / data.totalKgIn * 100) : 0

    txt(bt.name || bt.code, M, y, font, 8)
    rightTxt(String(bt.totalCartons), M + 240, y, font, 8)
    rightTxt(pallets, M + 290, y, font, 8)
    rightTxt(bt.weight_per_carton_kg.toFixed(2), M + 350, y, font, 8)
    rightTxt(`${pct.toFixed(0)}%`, M + 400, y, font, 8)
    y -= ROW
  }

  // Smous
  if (data.smousKg > 0) {
    const smousPct = data.totalKgIn > 0 ? (data.smousKg / data.totalKgIn * 100) : 0
    txt('Smous', M, y, font, 8)
    rightTxt(Math.round(data.smousKg).toLocaleString(), M + 240, y, font, 8)
    rightTxt(`${smousPct.toFixed(0)}%`, M + 400, y, font, 8)
    y -= ROW
  }

  // Juice
  if (data.juiceKg > 0) {
    const juicePct = data.totalKgIn > 0 ? (data.juiceKg / data.totalKgIn * 100) : 0
    txt('Sap', M, y, font, 8)
    rightTxt(Math.round(data.juiceKg).toLocaleString(), M + 240, y, font, 8)
    rightTxt(`${juicePct.toFixed(0)}%`, M + 400, y, font, 8)
    y -= ROW
  }

  // Rot
  if (data.rotKg > 0) {
    const rotPct = data.totalKgIn > 0 ? (data.rotKg / data.totalKgIn * 100) : 0
    txt('Vrot', M, y, font, 8)
    rightTxt(Math.round(data.rotKg).toLocaleString(), M + 240, y, font, 8)
    rightTxt(`${rotPct.toFixed(0)}%`, M + 400, y, font, 8)
    y -= ROW
  }

  // Total
  hline(y + 4)
  y -= 2
  txt('Totaal', M, y, fontB, 8)
  rightTxt(Math.round(data.totalKgOut).toLocaleString(), M + 240, y, fontB, 8)
  rightTxt('100%', M + 400, y, fontB, 8)
  y -= ROW + 4

  // ── Export / Local / Smous / Juice / Vrot split ─────────────────

  const exportKg = data.boxTypeSummaries
    .filter(bt => bt.code.includes('1A'))
    .reduce((s, bt) => s + bt.totalCartons * bt.weight_per_carton_kg, 0)
  const localKg = data.boxTypeSummaries
    .filter(bt => !bt.code.includes('1A'))
    .reduce((s, bt) => s + bt.totalCartons * bt.weight_per_carton_kg, 0)

  const splitRows: [string, number][] = [
    ['Export:', data.totalKgIn > 0 ? exportKg / data.totalKgIn * 100 : 0],
    ['Local:', data.totalKgIn > 0 ? localKg / data.totalKgIn * 100 : 0],
    ['Smous:', data.totalKgIn > 0 ? data.smousKg / data.totalKgIn * 100 : 0],
    ['Juice:', data.totalKgIn > 0 ? data.juiceKg / data.totalKgIn * 100 : 0],
    ['Vrot:', data.totalKgIn > 0 ? data.rotKg / data.totalKgIn * 100 : 0],
  ]

  hline(y + 4)
  y -= 4
  for (const [label, pct] of splitRows) {
    txt(label, M, y, fontB, 8, GREY)
    txt(`${pct.toFixed(0)}%`, M + 60, y, font, 8)
    y -= ROW
  }
  const totalSplit = splitRows.reduce((s, [, p]) => s + p, 0)
  txt('Total:', M, y, fontB, 8, GREY)
  txt(`${totalSplit.toFixed(0)}%`, M + 60, y, fontB, 8)
  y -= ROW + 10

  // ── Class Split bar chart ───────────────────────────────────────

  const chartW = UW
  const chartH = 80
  const barGap = 4

  if (data.boxTypeSummaries.length > 0 && y - chartH - 30 > M) {
    txt('CLASS_SPLIT:', M, y, fontB, 8, GREY)
    y -= 14

    const items = data.boxTypeSummaries.filter(bt => bt.totalCartons > 0)
    const totalCtns = items.reduce((s, bt) => s + bt.totalCartons * bt.weight_per_carton_kg, 0)
    const barW = (chartW - barGap * items.length) / items.length

    for (let i = 0; i < items.length; i++) {
      const bt = items[i]
      const pct = totalCtns > 0 ? (bt.totalCartons * bt.weight_per_carton_kg / totalCtns) : 0
      const bh = Math.max(2, pct * chartH)
      const bx = M + i * (barW + barGap)

      page.drawRectangle({ x: bx, y: y - chartH, width: barW, height: bh, color: BAR_COLORS[i % BAR_COLORS.length] })

      // Label
      const pctStr = `${(pct * 100).toFixed(0)}%`
      txt(pctStr, bx + 2, y - chartH + bh + 2, font, 6)
    }

    y -= chartH + 8

    // Legend
    for (let i = 0; i < items.length; i++) {
      const bt = items[i]
      const lx = M + (i % 4) * (UW / 4)
      const ly = y - Math.floor(i / 4) * 10
      page.drawRectangle({ x: lx, y: ly - 2, width: 6, height: 6, color: BAR_COLORS[i % BAR_COLORS.length] })
      txt(bt.code, lx + 9, ly - 2, font, 6)
    }
    y -= Math.ceil(items.length / 4) * 10 + 10
  }

  // ── Size Distribution bar chart ─────────────────────────────────

  if (data.sizeDistribution.length > 0 && y - chartH - 30 > M) {
    txt('Size_Dist:', M, y, fontB, 8, GREY)
    y -= 14

    const maxPct = Math.max(...data.sizeDistribution.map(s => s.pct), 0.01)
    const sBarW = (chartW - barGap * data.sizeDistribution.length) / data.sizeDistribution.length

    for (let i = 0; i < data.sizeDistribution.length; i++) {
      const sd = data.sizeDistribution[i]
      const bh = Math.max(2, (sd.pct / maxPct) * chartH)
      const bx = M + i * (sBarW + barGap)

      page.drawRectangle({ x: bx, y: y - chartH, width: sBarW, height: bh, color: BLUE })
      txt(`${(sd.pct * 100).toFixed(0)}%`, bx + 2, y - chartH + bh + 2, font, 6)
      txt(sd.label, bx + 2, y - chartH - 10, font, 6, GREY)
    }
    y -= chartH + 16
  }

  // ── Juice Analysis bar chart ────────────────────────────────────

  if (data.juiceDefects.length > 0 && y - chartH - 30 > M) {
    txt('Juice_Analysis:', M, y, fontB, 8, GREY)
    y -= 14

    const maxJPct = Math.max(...data.juiceDefects.map(j => j.pct), 0.01)
    const jBarW = (chartW - barGap * data.juiceDefects.length) / data.juiceDefects.length

    for (let i = 0; i < data.juiceDefects.length; i++) {
      const jd = data.juiceDefects[i]
      const bh = Math.max(2, (jd.pct / maxJPct) * chartH)
      const bx = M + i * (jBarW + barGap)

      page.drawRectangle({ x: bx, y: y - chartH, width: jBarW, height: bh, color: AMBER })
      txt(`${(jd.pct * 100).toFixed(0)}%`, bx + 2, y - chartH + bh + 2, font, 6)
      txt(jd.name, bx + 2, y - chartH - 10, font, 5, GREY)
    }
    y -= chartH + 16
  }

  return doc.save()
}

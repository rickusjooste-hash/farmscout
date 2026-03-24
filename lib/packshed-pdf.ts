import { PDFDocument, StandardFonts, rgb, PDFFont, PDFImage } from 'pdf-lib'

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionRow { orchard_name: string; variety: string | null; bins_packed: number | null; start_time: string; end_time: string; smous_weight_kg: number | null }
interface BoxTypeSummary { code: string; name: string; grade: string; totalCartons: number; cartons_per_pallet: number; weight_per_carton_kg: number }
interface SizeDistRow { label: string; count: number; pct: number }
interface JuiceDefectRow { name: string; count: number; pct: number }

export interface PackoutPdfData {
  packDate: string
  packhouseName: string
  sessions: SessionRow[]
  logoUrl?: string
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

const BLACK = rgb(0.10, 0.16, 0.23)       // #1a2a3a dark text
const GREY = rgb(0.42, 0.48, 0.54)        // #6a7a8a secondary text
const LIGHT_GREY = rgb(0.90, 0.91, 0.92)  // #e5e7eb table borders
const WHITE = rgb(1, 1, 1)
const GREEN = rgb(0.30, 0.69, 0.45)       // #4caf72 primary accent
const GREEN_LIGHT = rgb(0.93, 0.98, 0.95) // light green row bg

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

  // US Letter landscape
  const W = 792
  const H = 612
  const M = 30   // margin
  const page = doc.addPage([W, H])

  // ── Helper functions ──────────────────────────────────────────

  function txt(s: string, x: number, y: number, f: PDFFont, sz: number, c = BLACK) {
    page.drawText(s, { x, y, size: sz, font: f, color: c })
  }

  function rightTxt(s: string, x: number, y: number, f: PDFFont, sz: number, c = BLACK) {
    const tw = f.widthOfTextAtSize(s, sz)
    page.drawText(s, { x: x - tw, y, size: sz, font: f, color: c })
  }

  function centerTxt(s: string, x1: number, x2: number, y: number, f: PDFFont, sz: number, c = BLACK) {
    const tw = f.widthOfTextAtSize(s, sz)
    page.drawText(s, { x: x1 + (x2 - x1 - tw) / 2, y, size: sz, font: f, color: c })
  }

  function hline(x1: number, x2: number, y: number, color = LIGHT_GREY, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })
  }

  // ── Derived data ──────────────────────────────────────────────

  const orchardNames = data.sessions.map(s => s.orchard_name).join(', ')
  const varieties = Array.from(new Set(data.sessions.map(s => s.variety).filter(Boolean))).join(', ')
  const startTime = data.sessions.find(s => s.start_time)?.start_time || ''
  const endTime = data.sessions.find(s => s.end_time)?.end_time || ''
  const diff = data.totalKgIn > 0 ? ((data.totalKgIn - data.totalKgOut) / data.totalKgIn * 100) : 0

  // Column layout
  const COL_GAP = 20
  const LEFT_W = (W - M * 2 - COL_GAP) * 0.55
  const LEFT_X = M
  const RIGHT_X = M + LEFT_W + COL_GAP
  const RIGHT_W = W - M - RIGHT_X

  let y = H - M

  // ── Logo ──────────────────────────────────────────────────────

  let logoImage: PDFImage | null = null
  if (data.logoUrl) {
    try {
      const logoRes = await fetch(data.logoUrl)
      const logoBytes = new Uint8Array(await logoRes.arrayBuffer())
      const contentType = logoRes.headers.get('content-type') || ''
      if (contentType.includes('png') || data.logoUrl.endsWith('.png')) {
        logoImage = await doc.embedPng(logoBytes)
      } else {
        logoImage = await doc.embedJpg(logoBytes)
      }
    } catch {
      // Logo fetch failed — continue without it
    }
  }

  // ── Header band ───────────────────────────────────────────────

  const LOGO_MAX = 44
  const headerY = y

  // Logo (left)
  if (logoImage) {
    const scale = Math.min(LOGO_MAX / logoImage.width, LOGO_MAX / logoImage.height)
    const lw = logoImage.width * scale
    const lh = logoImage.height * scale
    page.drawImage(logoImage, { x: LEFT_X, y: headerY - lh + 4, width: lw, height: lh })
  }

  // Title (center)
  const titleText = 'MV Packout'
  centerTxt(titleText, M, W - M, headerY - 14, fontB, 16, GREEN)

  // Date + Orchard + Variety (right)
  rightTxt(data.packDate, W - M, headerY - 4, fontB, 9, BLACK)
  rightTxt(orchardNames || '-', W - M, headerY - 16, font, 8, GREY)
  if (varieties) {
    rightTxt(varieties, W - M, headerY - 28, font, 8, GREY)
  }

  y = headerY - LOGO_MAX - 6

  // Green rule
  hline(M, W - M, y, GREEN, 1.5)
  y -= 14

  // ── LEFT COLUMN ───────────────────────────────────────────────

  let leftY = y
  const ROW_H = 12

  // ── Session info block ──────────────────────────────────────

  txt('SESSION INFO', LEFT_X, leftY, fontB, 8, GREY)
  leftY -= 14

  const infoRows: [string, string][] = [
    ['Start Time', startTime || '-'],
    ['End Time', endTime || '-'],
    ['Bins Packed', String(data.totalBinsPacked)],
    ['Avg KG / Bin', data.avgBinWeight.toFixed(0)],
    ['Total KG Tipped', data.totalKgIn > 0 ? Math.round(data.totalKgIn).toLocaleString() : '-'],
    ['Conversion %', data.totalKgIn > 0 ? `${data.conversionPct.toFixed(1)}%` : '-'],
    ['Loss %', data.totalKgIn > 0 ? `${data.lossPct.toFixed(0)}%` : '-'],
    ['Difference %', data.totalKgIn > 0 ? `${diff.toFixed(1)}%` : '-'],
  ]

  const infoLabelW = 90
  for (const [label, value] of infoRows) {
    txt(label, LEFT_X, leftY, font, 7.5, GREY)
    txt(value, LEFT_X + infoLabelW, leftY, fontB, 7.5, BLACK)
    leftY -= ROW_H
  }

  leftY -= 6

  // ── Category breakdown table ──────────────────────────────

  txt('CATEGORY BREAKDOWN', LEFT_X, leftY, fontB, 8, GREY)
  leftY -= 12

  // Table header
  const tblCols = {
    cat: LEFT_X,
    cartons: LEFT_X + 140,
    pallets: LEFT_X + 200,
    weight: LEFT_X + 260,
    pct: LEFT_X + LEFT_W - 10,
  }

  txt('Box Type', tblCols.cat, leftY, fontB, 7, GREY)
  rightTxt('Cartons', tblCols.cartons + 40, leftY, fontB, 7, GREY)
  rightTxt('Pallets', tblCols.pallets + 40, leftY, fontB, 7, GREY)
  rightTxt('KG/Ctn', tblCols.weight + 40, leftY, fontB, 7, GREY)
  rightTxt('%', tblCols.pct, leftY, fontB, 7, GREY)
  leftY -= 4
  hline(LEFT_X, LEFT_X + LEFT_W, leftY, LIGHT_GREY)
  leftY -= ROW_H

  // Box type rows
  let rowIdx = 0
  for (const bt of data.boxTypeSummaries) {
    if (bt.totalCartons === 0) continue
    const pallets = bt.cartons_per_pallet > 0 ? (bt.totalCartons / bt.cartons_per_pallet).toFixed(2) : '-'
    const kgOut = bt.totalCartons * bt.weight_per_carton_kg
    const pct = data.totalKgIn > 0 ? (kgOut / data.totalKgIn * 100) : 0

    // Alternating row bg
    if (rowIdx % 2 === 0) {
      page.drawRectangle({ x: LEFT_X, y: leftY - 3, width: LEFT_W, height: ROW_H, color: GREEN_LIGHT })
    }

    txt(bt.name || bt.code, tblCols.cat, leftY, font, 7.5)
    rightTxt(String(bt.totalCartons), tblCols.cartons + 40, leftY, font, 7.5)
    rightTxt(pallets, tblCols.pallets + 40, leftY, font, 7.5)
    rightTxt(bt.weight_per_carton_kg.toFixed(2), tblCols.weight + 40, leftY, font, 7.5)
    rightTxt(`${pct.toFixed(0)}%`, tblCols.pct, leftY, font, 7.5)
    leftY -= ROW_H
    rowIdx++
  }

  // Smous row
  if (data.smousKg > 0) {
    const smousPct = data.totalKgIn > 0 ? (data.smousKg / data.totalKgIn * 100) : 0
    if (rowIdx % 2 === 0) {
      page.drawRectangle({ x: LEFT_X, y: leftY - 3, width: LEFT_W, height: ROW_H, color: GREEN_LIGHT })
    }
    txt('Smous', tblCols.cat, leftY, font, 7.5)
    rightTxt(Math.round(data.smousKg).toLocaleString(), tblCols.cartons + 40, leftY, font, 7.5)
    rightTxt(`${smousPct.toFixed(0)}%`, tblCols.pct, leftY, font, 7.5)
    leftY -= ROW_H
    rowIdx++
  }

  // Juice row
  if (data.juiceKg > 0) {
    const juicePct = data.totalKgIn > 0 ? (data.juiceKg / data.totalKgIn * 100) : 0
    if (rowIdx % 2 === 0) {
      page.drawRectangle({ x: LEFT_X, y: leftY - 3, width: LEFT_W, height: ROW_H, color: GREEN_LIGHT })
    }
    txt('Sap', tblCols.cat, leftY, font, 7.5)
    rightTxt(Math.round(data.juiceKg).toLocaleString(), tblCols.cartons + 40, leftY, font, 7.5)
    rightTxt(`${juicePct.toFixed(0)}%`, tblCols.pct, leftY, font, 7.5)
    leftY -= ROW_H
    rowIdx++
  }

  // Rot row
  if (data.rotKg > 0) {
    const rotPct = data.totalKgIn > 0 ? (data.rotKg / data.totalKgIn * 100) : 0
    if (rowIdx % 2 === 0) {
      page.drawRectangle({ x: LEFT_X, y: leftY - 3, width: LEFT_W, height: ROW_H, color: GREEN_LIGHT })
    }
    txt('Vrot', tblCols.cat, leftY, font, 7.5)
    rightTxt(Math.round(data.rotKg).toLocaleString(), tblCols.cartons + 40, leftY, font, 7.5)
    rightTxt(`${rotPct.toFixed(0)}%`, tblCols.pct, leftY, font, 7.5)
    leftY -= ROW_H
    rowIdx++
  }

  // Totaal row
  hline(LEFT_X, LEFT_X + LEFT_W, leftY + 4, GREEN, 0.8)
  leftY -= 2
  txt('Totaal', tblCols.cat, leftY, fontB, 7.5, GREEN)
  rightTxt(Math.round(data.totalKgOut).toLocaleString(), tblCols.cartons + 40, leftY, fontB, 7.5, GREEN)
  rightTxt('100%', tblCols.pct, leftY, fontB, 7.5, GREEN)
  leftY -= ROW_H + 8

  // ── Split percentages ───────────────────────────────────────

  const exportKg = data.boxTypeSummaries
    .filter(bt => bt.grade === '1A')
    .reduce((s, bt) => s + bt.totalCartons * bt.weight_per_carton_kg, 0)
  const localKg = data.boxTypeSummaries
    .filter(bt => bt.grade !== '1A')
    .reduce((s, bt) => s + bt.totalCartons * bt.weight_per_carton_kg, 0)

  const splitRows: [string, number][] = [
    ['Export', data.totalKgIn > 0 ? exportKg / data.totalKgIn * 100 : 0],
    ['Local', data.totalKgIn > 0 ? localKg / data.totalKgIn * 100 : 0],
    ['Smous', data.totalKgIn > 0 ? data.smousKg / data.totalKgIn * 100 : 0],
    ['Sap', data.totalKgIn > 0 ? data.juiceKg / data.totalKgIn * 100 : 0],
    ['Vrot', data.totalKgIn > 0 ? data.rotKg / data.totalKgIn * 100 : 0],
  ]

  txt('SPLIT %', LEFT_X, leftY, fontB, 8, GREY)
  leftY -= 12

  // Horizontal split bar
  const splitBarW = LEFT_W - 10
  const splitBarH = 14
  const splitColors = [
    rgb(0.13, 0.46, 0.85),  // export - blue
    rgb(0.30, 0.69, 0.45),  // local - green
    rgb(0.90, 0.66, 0.10),  // smous - amber
    rgb(0.55, 0.36, 0.75),  // juice - purple
    rgb(0.91, 0.35, 0.29),  // vrot - red
  ]

  let barX = LEFT_X
  for (let i = 0; i < splitRows.length; i++) {
    const [, pct] = splitRows[i]
    const segW = splitBarW * (pct / 100)
    if (segW > 1) {
      page.drawRectangle({ x: barX, y: leftY - 2, width: segW, height: splitBarH, color: splitColors[i] })
      if (segW > 20) {
        const pctStr = `${pct.toFixed(0)}%`
        const tw = font.widthOfTextAtSize(pctStr, 6)
        page.drawText(pctStr, { x: barX + (segW - tw) / 2, y: leftY + 2, size: 6, font: fontB, color: WHITE })
      }
      barX += segW
    }
  }
  leftY -= splitBarH + 6

  // Legend row for split
  let legendX = LEFT_X
  for (let i = 0; i < splitRows.length; i++) {
    const [label, pct] = splitRows[i]
    page.drawRectangle({ x: legendX, y: leftY, width: 6, height: 6, color: splitColors[i] })
    const legendStr = `${label} ${pct.toFixed(0)}%`
    txt(legendStr, legendX + 9, leftY, font, 6, GREY)
    legendX += font.widthOfTextAtSize(legendStr, 6) + 18
  }

  // ── RIGHT COLUMN — Charts ─────────────────────────────────────

  let rightY = y
  const CHART_LABEL_W = 70
  const CHART_BAR_AREA = RIGHT_W - CHART_LABEL_W - 40 // space for % label after bar
  const BAR_H = 12
  const BAR_GAP = 3

  // ── Chart 1: CLASS_SPLIT ──────────────────────────────────────

  const activeBoxTypes = data.boxTypeSummaries.filter(bt => bt.totalCartons > 0)
  if (activeBoxTypes.length > 0) {
    txt('CLASS SPLIT', RIGHT_X, rightY, fontB, 8, GREY)
    rightY -= 14

    const totalKgBT = activeBoxTypes.reduce((s, bt) => s + bt.totalCartons * bt.weight_per_carton_kg, 0)
    const maxPctBT = Math.max(...activeBoxTypes.map(bt => totalKgBT > 0 ? bt.totalCartons * bt.weight_per_carton_kg / totalKgBT : 0), 0.01)

    for (let i = 0; i < activeBoxTypes.length; i++) {
      const bt = activeBoxTypes[i]
      const pct = totalKgBT > 0 ? (bt.totalCartons * bt.weight_per_carton_kg / totalKgBT) : 0
      const barW = Math.max(2, (pct / maxPctBT) * CHART_BAR_AREA)
      const barColor = BAR_COLORS[i % BAR_COLORS.length]

      // Label
      const label = bt.code.length > 12 ? bt.code.substring(0, 12) + '..' : bt.code
      txt(label, RIGHT_X, rightY, font, 6, GREY)

      // Bar
      const bx = RIGHT_X + CHART_LABEL_W
      page.drawRectangle({ x: bx, y: rightY - 2, width: barW, height: BAR_H, color: barColor })

      // Percentage
      const pctStr = `${(pct * 100).toFixed(1)}%`
      txt(pctStr, bx + barW + 4, rightY, fontB, 6, BLACK)

      rightY -= BAR_H + BAR_GAP
    }

    rightY -= 10
  }

  // ── Chart 2: SIZE DISTRIBUTION ────────────────────────────────

  if (data.sizeDistribution.length > 0) {
    txt('SIZE DISTRIBUTION', RIGHT_X, rightY, fontB, 8, GREY)
    rightY -= 14

    const maxSizePct = Math.max(...data.sizeDistribution.map(s => s.pct), 0.01)

    for (let i = 0; i < data.sizeDistribution.length; i++) {
      const sd = data.sizeDistribution[i]
      const barW = Math.max(2, (sd.pct / maxSizePct) * CHART_BAR_AREA)

      // Label
      txt(sd.label, RIGHT_X, rightY, font, 6, GREY)

      // Bar
      const bx = RIGHT_X + CHART_LABEL_W
      page.drawRectangle({ x: bx, y: rightY - 2, width: barW, height: BAR_H, color: BAR_COLORS[i % BAR_COLORS.length] })

      // Percentage
      const pctStr = `${(sd.pct * 100).toFixed(0)}%`
      txt(pctStr, bx + barW + 4, rightY, fontB, 6, BLACK)

      rightY -= BAR_H + BAR_GAP
    }

    rightY -= 10
  }

  // ── Chart 3: JUICE ANALYSIS ───────────────────────────────────

  if (data.juiceDefects.length > 0) {
    txt('JUICE ANALYSIS', RIGHT_X, rightY, fontB, 8, GREY)
    rightY -= 14

    const maxJPct = Math.max(...data.juiceDefects.map(j => j.pct), 0.01)

    for (let i = 0; i < data.juiceDefects.length; i++) {
      const jd = data.juiceDefects[i]
      const barW = Math.max(2, (jd.pct / maxJPct) * CHART_BAR_AREA)

      // Label — truncate long defect names
      const label = jd.name.length > 14 ? jd.name.substring(0, 14) + '..' : jd.name
      txt(label, RIGHT_X, rightY, font, 6, GREY)

      // Bar
      const bx = RIGHT_X + CHART_LABEL_W
      const barColor = BAR_COLORS[(i + 2) % BAR_COLORS.length] // offset for visual variety
      page.drawRectangle({ x: bx, y: rightY - 2, width: barW, height: BAR_H, color: barColor })

      // Percentage
      const pctStr = `${(jd.pct * 100).toFixed(0)}%`
      txt(pctStr, bx + barW + 4, rightY, fontB, 6, BLACK)

      rightY -= BAR_H + BAR_GAP
    }
  }

  // ── Footer ────────────────────────────────────────────────────

  const footerY = M - 6
  hline(M, W - M, footerY + 10, LIGHT_GREY, 0.5)
  txt('allFarm', M, footerY, fontB, 6, GREEN)
  rightTxt(`Generated ${new Date().toLocaleDateString('en-ZA')}`, W - M, footerY, font, 6, GREY)

  return doc.save()
}

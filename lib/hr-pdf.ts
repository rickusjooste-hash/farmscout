import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib'

// ── Types ──────────────────────────────────────────────────────────────────

export interface EventData {
  employeeName: string
  employeeNr: string
  reason: string
  comments: string
  eventDate: string
  farmName: string
  chairPerson: string
  logoUrl: string | null
}

interface TemplateBlock {
  type: 'title' | 'text' | 'bold' | 'gap' | 'signature-pair'
  text?: string
  name?: string
  date?: string
}

// ── Template definitions ───────────────────────────────────────────────────

function getTemplateBlocks(eventTypeName: string, d: EventData): TemplateBlock[] {
  const dt = d.eventDate

  const sigPair = (name: string): TemplateBlock => ({ type: 'signature-pair', name, date: dt })

  switch (eventTypeName) {
    case 'Verbal Warning':
      return [
        { type: 'title', text: 'VERBAL WARNING' },
        { type: 'gap' },
        { type: 'text', text: `I, ${d.employeeName}, acknowledge receipt of this verbal warning for` },
        { type: 'gap' },
        { type: 'text', text: d.reason },
        { type: 'gap' },
        { type: 'text', text: 'I understand that the same or similar transgression may lead to a First Written Warning.' },
        { type: 'gap' }, { type: 'gap' },
        { type: 'bold', text: 'Signed' },
        { type: 'gap' },
        sigPair(d.employeeName),
        { type: 'gap' },
        sigPair('Rickus Jooste'),
      ]

    case 'First Written Warning':
      return [
        { type: 'title', text: 'FIRST WRITTEN WARNING' },
        { type: 'gap' },
        { type: 'text', text: `I, ${d.employeeName}, acknowledge receipt of this first written warning for the following transgression I have committed:` },
        { type: 'gap' },
        { type: 'text', text: d.reason },
        { type: 'gap' },
        { type: 'text', text: 'I realize that the same or similar transgression, if committed in the next (6) six months, can lead to a second written warning.' },
        { type: 'gap' },
        { type: 'text', text: `This warning is issued following the discussion held on ${dt}.` },
        ...(d.comments ? [{ type: 'gap' as const }, { type: 'text' as const, text: `Comments: ${d.comments}` }] : []),
        { type: 'gap' }, { type: 'gap' },
        { type: 'bold', text: 'Signed' },
        { type: 'gap' },
        sigPair(d.employeeName),
        { type: 'gap' },
        sigPair('Rickus Jooste'),
        { type: 'gap' },
        { type: 'signature-pair', name: 'Witness' },
      ]

    case 'Second Written Warning':
      return [
        { type: 'title', text: 'SECOND WRITTEN WARNING' },
        { type: 'gap' },
        { type: 'text', text: `I, ${d.employeeName}, acknowledge receipt of this second written warning for the following transgression I have committed:` },
        { type: 'gap' },
        { type: 'text', text: d.reason },
        { type: 'gap' },
        { type: 'text', text: 'I realize that the same or similar transgression, if committed in the next (6) six months, can lead to a disciplinary hearing.' },
        { type: 'gap' }, { type: 'gap' },
        { type: 'bold', text: 'Signed' },
        { type: 'gap' },
        sigPair(d.employeeName),
        { type: 'gap' },
        sigPair('Rickus Jooste'),
      ]

    case 'Final Written Warning':
      return [
        { type: 'title', text: 'FINAL WRITTEN WARNING' },
        { type: 'gap' },
        { type: 'text', text: `I, ${d.employeeName}, acknowledge receipt of this final written warning for the following transgression I have committed:` },
        { type: 'gap' },
        { type: 'text', text: d.reason },
        { type: 'gap' },
        { type: 'text', text: 'I realize that the same or similar transgression, if committed in the next (12) twelve months, can lead to my dismissal.' },
        { type: 'gap' }, { type: 'gap' },
        { type: 'bold', text: 'Signed' },
        { type: 'gap' },
        sigPair(d.employeeName),
        { type: 'gap' },
        sigPair('Rickus Jooste'),
      ]

    case 'Red Light':
      return [
        { type: 'title', text: 'RED LIGHT' },
        { type: 'gap' },
        { type: 'bold', text: `NAME :  ${d.employeeName}` },
        { type: 'bold', text: `EMPLOYEE NUMBER :  ${d.employeeNr}` },
        { type: 'bold', text: `DATE :  ${dt}` },
        { type: 'gap' },
        { type: 'text', text: `Management notes that you have not made a positive contribution to ${d.farmName} for the following reasons:` },
        { type: 'gap' },
        { type: 'text', text: d.reason },
        { type: 'gap' },
        { type: 'text', text: 'This red light warning will be filed in your personnel file and considered at the next personnel evaluation session.' },
        { type: 'gap' }, { type: 'gap' },
        { type: 'signature-pair', name: 'E.W. STARKE' },
        { type: 'gap' },
        { type: 'signature-pair', name: 'RICKUS JOOSTE' },
        { type: 'gap' },
        { type: 'signature-pair', name: d.employeeName },
      ]

    case 'Green Light':
      return [
        { type: 'title', text: 'GREEN LIGHT AWARD' },
        { type: 'gap' },
        { type: 'bold', text: `NAME :  ${d.employeeName}` },
        { type: 'bold', text: `EMPLOYEE NUMBER :  ${d.employeeNr}` },
        { type: 'bold', text: `DATE :  ${dt}` },
        { type: 'gap' },
        { type: 'text', text: `Management notes that you have made a positive contribution to ${d.farmName} for the following reasons:` },
        { type: 'gap' },
        { type: 'text', text: d.reason },
        { type: 'gap' },
        { type: 'text', text: 'Thank you for your positive contribution. This green light award will be filed in your personnel file and considered at the next personnel evaluation session.' },
        { type: 'gap' }, { type: 'gap' },
        { type: 'signature-pair', name: 'E.W. STARKE' },
        { type: 'gap' },
        { type: 'signature-pair', name: 'RICKUS JOOSTE' },
        { type: 'gap' },
        { type: 'signature-pair', name: d.employeeName },
      ]

    case 'Schedule Disciplinary Hearing':
      return [
        { type: 'title', text: 'NOTICE OF DISCIPLINARY HEARING' },
        { type: 'gap' },
        { type: 'text', text: `You ${d.employeeName} are hereby informed of a disciplinary hearing which will take place under the following conditions:` },
        { type: 'gap' },
        { type: 'bold', text: `Complaint:  ${d.reason}` },
        { type: 'gap' },
        { type: 'text', text: `Date of hearing :  ${dt}` },
        { type: 'text', text: 'Place of hearing :  Farm Office Boardroom' },
        { type: 'text', text: 'Time of hearing :  09:00' },
        { type: 'gap' },
        { type: 'text', text: 'You are entitled to an internal representative of your choice.' },
        { type: 'text', text: 'You have the right to bring witnesses and question Management.' },
        { type: 'text', text: 'You will be given the chance to give your version of affairs.' },
        ...(d.chairPerson ? [{ type: 'gap' as const }, { type: 'text' as const, text: `The chairperson of the hearing will be ${d.chairPerson}.` }] : []),
        { type: 'gap' }, { type: 'gap' },
        { type: 'bold', text: 'Signed' },
        { type: 'gap' },
        sigPair(d.employeeName),
        { type: 'gap' },
        sigPair('Rickus Jooste'),
      ]

    case 'Absenteeism Formal Letter':
      return [
        { type: 'title', text: 'ABSENTEEISM FORMAL LETTER' },
        { type: 'gap' },
        { type: 'text', text: `I, ${d.employeeName}, acknowledge receipt of this formal letter regarding absenteeism:` },
        { type: 'gap' },
        { type: 'text', text: d.reason },
        ...(d.comments ? [{ type: 'gap' as const }, { type: 'text' as const, text: `Comments: ${d.comments}` }] : []),
        { type: 'gap' }, { type: 'gap' },
        { type: 'bold', text: 'Signed' },
        { type: 'gap' },
        sigPair(d.employeeName),
        { type: 'gap' },
        sigPair('Rickus Jooste'),
      ]

    default:
      return [
        { type: 'title', text: eventTypeName.toUpperCase() },
        { type: 'gap' },
        { type: 'text', text: d.reason },
        ...(d.comments ? [{ type: 'gap' as const }, { type: 'text' as const, text: d.comments }] : []),
      ]
  }
}

// ── PDF drawing helpers ────────────────────────────────────────────────────

function drawWrappedText(
  page: PDFPage, text: string, x: number, y: number,
  maxWidth: number, size: number, font: PDFFont, color = rgb(0.12, 0.12, 0.15),
): number {
  if (!text) return y
  const words = text.split(' ')
  let currentLine = ''
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word
    if (font.widthOfTextAtSize(testLine, size) > maxWidth && currentLine) {
      page.drawText(currentLine, { x, y, size, font, color })
      y -= size + 5
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    page.drawText(currentLine, { x, y, size, font, color })
    y -= size + 5
  }
  return y
}

// ── Main builder ───────────────────────────────────────────────────────────

export async function buildHrPdf(eventTypeName: string, d: EventData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)

  let page = doc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()
  const margin = 65
  const rightMargin = width - margin
  const maxWidth = width - margin * 2
  const lineColor = rgb(0.75, 0.75, 0.75)
  const textColor = rgb(0.12, 0.12, 0.15)
  const lightColor = rgb(0.4, 0.4, 0.4)

  let y = height - 50

  // ── Logo ──
  let logoImage: PDFImage | null = null
  if (d.logoUrl) {
    try {
      const logoRes = await fetch(d.logoUrl)
      const logoBytes = new Uint8Array(await logoRes.arrayBuffer())
      const contentType = logoRes.headers.get('content-type') || ''
      if (contentType.includes('png') || d.logoUrl.endsWith('.png')) {
        logoImage = await doc.embedPng(logoBytes)
      } else {
        logoImage = await doc.embedJpg(logoBytes)
      }
    } catch {
      // Logo fetch failed — continue without it
    }
  }

  if (logoImage) {
    const logoMaxH = 70
    const logoMaxW = 160
    const scale = Math.min(logoMaxW / logoImage.width, logoMaxH / logoImage.height)
    const lw = logoImage.width * scale
    const lh = logoImage.height * scale
    // Center the logo
    page.drawImage(logoImage, {
      x: (width - lw) / 2,
      y: y - lh,
      width: lw,
      height: lh,
    })
    y -= lh + 12
  }

  // ── Company name (centered) ──
  const companyText = d.farmName.toUpperCase()
  const companyWidth = fontBold.widthOfTextAtSize(companyText, 13)
  page.drawText(companyText, {
    x: (width - companyWidth) / 2,
    y, size: 13, font: fontBold, color: textColor,
  })
  y -= 20

  // ── Address (centered) ──
  const addr1 = 'P O Box 265  |  PIKETBERG  |  7320'
  const addr2 = 'tel (022) 914 5805  |  rickus@mvfarm.co.za'
  for (const addr of [addr1, addr2]) {
    const aw = font.widthOfTextAtSize(addr, 8.5)
    page.drawText(addr, { x: (width - aw) / 2, y, size: 8.5, font, color: lightColor })
    y -= 13
  }
  y -= 8

  // ── Horizontal rule ──
  page.drawLine({ start: { x: margin, y }, end: { x: rightMargin, y }, thickness: 0.75, color: lineColor })
  y -= 28

  // ── Template blocks ──
  const blocks = getTemplateBlocks(eventTypeName, d)

  for (const block of blocks) {
    // Page break check
    if (y < 90) {
      page = doc.addPage([595, 842])
      y = page.getSize().height - 50
    }

    switch (block.type) {
      case 'title': {
        const tw = fontBold.widthOfTextAtSize(block.text!, 15)
        page.drawText(block.text!, {
          x: (width - tw) / 2,
          y, size: 15, font: fontBold, color: textColor,
        })
        y -= 28
        break
      }

      case 'text':
        y = drawWrappedText(page, block.text!, margin, y, maxWidth, 11, font, textColor)
        y -= 2
        break

      case 'bold':
        y = drawWrappedText(page, block.text!, margin, y, maxWidth, 11, fontBold, textColor)
        y -= 2
        break

      case 'gap':
        y -= 10
        break

      case 'signature-pair': {
        // Signature line
        const sigLineWidth = 200
        page.drawLine({
          start: { x: margin, y: y + 2 },
          end: { x: margin + sigLineWidth, y: y + 2 },
          thickness: 0.5, color: lineColor,
        })
        // Date on the right side
        if (block.date) {
          page.drawText(block.date, {
            x: margin + sigLineWidth + 30,
            y, size: 10, font, color: lightColor,
          })
        }
        y -= 16
        // Name below line
        page.drawText(block.name!, { x: margin, y, size: 10, font, color: textColor })
        y -= 18
        break
      }
    }
  }

  return doc.save()
}

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(req: NextRequest) {
  // Auth check
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const path = formData.get('path') as string | null

  if (!file || !path) {
    return NextResponse.json({ error: 'file and path required' }, { status: 400 })
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const rawBytes = new Uint8Array(await file.arrayBuffer())
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'

  let uploadBuffer: Buffer
  let uploadPath: string
  let contentType: string

  if (isImage) {
    // Convert image to PDF: embed the photo into an A4 page
    const doc = await PDFDocument.create()
    let img
    if (file.type === 'image/png') {
      img = await doc.embedPng(rawBytes)
    } else {
      img = await doc.embedJpg(rawBytes)
    }

    // Fit image on A4 page with margins
    const pageW = 595
    const pageH = 842
    const margin = 40
    const maxW = pageW - margin * 2
    const maxH = pageH - margin * 2
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    const imgW = img.width * scale
    const imgH = img.height * scale

    const page = doc.addPage([pageW, pageH])
    page.drawImage(img, {
      x: (pageW - imgW) / 2,
      y: (pageH - imgH) / 2,
      width: imgW,
      height: imgH,
    })

    const pdfBytes = await doc.save()
    uploadBuffer = Buffer.from(pdfBytes)
    uploadPath = path.replace(/\.[^.]+$/, '.pdf')
    contentType = 'application/pdf'
  } else {
    // PDF or other file — upload as-is
    uploadBuffer = Buffer.from(rawBytes)
    uploadPath = isPdf ? path : path
    contentType = file.type || 'application/octet-stream'
  }

  const { error } = await svc.storage
    .from('hr-documents')
    .upload(uploadPath, uploadBuffer, {
      contentType,
      upsert: true,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const { data: urlData } = svc.storage.from('hr-documents').getPublicUrl(uploadPath)

  return NextResponse.json({ ok: true, fileUrl: urlData.publicUrl })
}

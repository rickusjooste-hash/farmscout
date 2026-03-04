import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-auth'

const SUPABASE_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: Request) {
  try {
    const { issue_id } = await req.json()
    if (!issue_id) return NextResponse.json({ error: 'issue_id required' }, { status: 400 })

    // ── 1. Fetch issue + context using service role ────────────────────────
    const issueRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qc_bag_issues?id=eq.${issue_id}&select=photo_url,pest_id,session_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    const issues = await issueRes.json()
    const issue = issues?.[0]
    if (!issue?.photo_url) {
      return NextResponse.json({ error: 'No photo found for this issue' }, { status: 404 })
    }

    // ── 2. Get commodity name from session → orchard → commodity ──────────
    const sessionRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qc_bag_sessions?id=eq.${issue.session_id}&select=orchard_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    const sessions = await sessionRes.json()
    const orchardId = sessions?.[0]?.orchard_id

    let commodityName = 'fruit'
    if (orchardId) {
      const orchardRes = await fetch(
        `${SUPABASE_URL}/rest/v1/orchards?id=eq.${orchardId}&select=commodity_id,commodities(name)`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      )
      const orchards = await orchardRes.json()
      commodityName = orchards?.[0]?.commodities?.name || 'fruit'
    }

    // ── 3. Download photo from Supabase Storage ───────────────────────────
    // Generate a signed URL (1 hour) using service role
    const signRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/qc-unknown-photos/${issue.photo_url}`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 3600 }),
      }
    )
    const signData = await signRes.json()
    const signedUrl = signData?.signedURL
      ? `${SUPABASE_URL}/storage/v1${signData.signedURL}`
      : null

    if (!signedUrl) {
      return NextResponse.json({ error: 'Could not generate signed URL for photo' }, { status: 500 })
    }

    // Fetch the actual image bytes
    const photoRes = await fetch(signedUrl)
    if (!photoRes.ok) {
      return NextResponse.json({ error: 'Could not download photo' }, { status: 500 })
    }
    const photoBuffer = await photoRes.arrayBuffer()
    const photoBase64 = Buffer.from(photoBuffer).toString('base64')
    const contentType = photoRes.headers.get('content-type') || 'image/jpeg'

    // ── 4. Call Claude vision ─────────────────────────────────────────────
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: contentType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: photoBase64,
            },
          },
          {
            type: 'text',
            text: `This photo was taken by a QC worker during a bag sample inspection on a South African fruit farm. The fruit being inspected is ${commodityName}. The worker could not identify this issue and flagged it as "Unknown".

Please identify the most likely pest, disease, or quality defect visible in this photo.

Respond with ONLY valid JSON in this exact format:
{
  "suggestion": "Short name of the issue (e.g. Bitter Pit, Codling Moth damage, Sunburn)",
  "confidence": "high|medium|low",
  "reasoning": "One sentence explaining what visual evidence led to this identification",
  "alternatives": ["up to 2 alternative possibilities if uncertain"]
}`,
          },
        ],
      }],
    })

    // ── 5. Parse Claude response ──────────────────────────────────────────
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    let parsed: { suggestion: string; confidence: string; reasoning: string; alternatives?: string[] }
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestion: raw, confidence: 'low', reasoning: '' }
    } catch {
      parsed = { suggestion: raw.slice(0, 100), confidence: 'low', reasoning: 'Could not parse structured response' }
    }

    // ── 6. Save suggestion to database ────────────────────────────────────
    await fetch(
      `${SUPABASE_URL}/rest/v1/qc_bag_issues?id=eq.${issue_id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          ai_suggestion: parsed.suggestion,
          ai_reasoning: parsed.reasoning,
        }),
      }
    )

    return NextResponse.json({
      suggestion: parsed.suggestion,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      alternatives: parsed.alternatives || [],
    })

  } catch (err: any) {
    console.error('[identify-unknown] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

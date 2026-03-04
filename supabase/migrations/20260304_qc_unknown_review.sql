-- ================================================================
-- QC Unknown Issue Review — storage + AI suggestion columns + RPC
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 1. Extend qc_bag_issues ───────────────────────────────────────────────

ALTER TABLE public.qc_bag_issues
  ADD COLUMN IF NOT EXISTS photo_url         text,         -- storage object path
  ADD COLUMN IF NOT EXISTS ai_suggestion     text,         -- Claude's best guess
  ADD COLUMN IF NOT EXISTS ai_reasoning      text,         -- one-sentence explanation
  ADD COLUMN IF NOT EXISTS resolved_pest_id  uuid REFERENCES public.pests(id),
  ADD COLUMN IF NOT EXISTS resolved_at       timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by       uuid REFERENCES public.user_profiles(id);

-- ── 2. Supabase Storage bucket ────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qc-unknown-photos',
  'qc-unknown-photos',
  false,
  5242880,   -- 5 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload
CREATE POLICY "qc unknown photos insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qc-unknown-photos');

-- Authenticated users can read
CREATE POLICY "qc unknown photos select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'qc-unknown-photos');

-- ── 3. RPC: get unknown issues for manager review ─────────────────────────

CREATE OR REPLACE FUNCTION get_unknown_qc_issues(p_farm_ids uuid[])
RETURNS TABLE (
  issue_id          uuid,
  session_id        uuid,
  pest_id           uuid,
  count             integer,
  photo_url         text,
  ai_suggestion     text,
  ai_reasoning      text,
  resolved_pest_id  uuid,
  resolved_at       timestamptz,
  collected_at      timestamptz,
  bag_seq           integer,
  orchard_name      text,
  commodity_name    text,
  employee_name     text,
  farm_id           uuid
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    bi.id,
    bi.session_id,
    bi.pest_id,
    bi.count,
    bi.photo_url,
    bi.ai_suggestion,
    bi.ai_reasoning,
    bi.resolved_pest_id,
    bi.resolved_at,
    s.collected_at,
    s.bag_seq,
    o.name,
    c.name,
    e.full_name,
    s.farm_id
  FROM public.qc_bag_issues bi
  JOIN public.qc_bag_sessions s  ON s.id  = bi.session_id
  JOIN public.orchards        o  ON o.id  = s.orchard_id
  JOIN public.commodities     c  ON c.id  = o.commodity_id
  JOIN public.qc_employees    e  ON e.id  = s.employee_id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND bi.photo_url IS NOT NULL
  ORDER BY s.collected_at DESC;
$$;

-- ── 4. RPC: resolve an unknown issue ─────────────────────────────────────

CREATE OR REPLACE FUNCTION resolve_unknown_qc_issue(
  p_issue_id     uuid,
  p_pest_id      uuid,
  p_resolved_by  uuid
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.qc_bag_issues
  SET resolved_pest_id = p_pest_id,
      resolved_at      = now(),
      resolved_by      = p_resolved_by
  WHERE id = p_issue_id;
$$;

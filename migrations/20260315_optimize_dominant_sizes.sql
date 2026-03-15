-- Lightweight QC RPCs for Orchard Intelligence
-- The original RPCs (get_orchard_dominant_sizes, get_qc_issues_by_orchard) timeout
-- on large qc_fruit tables (2M+ rows). These replacements:
--   1. Take single farm_id (not array) — more selective
--   2. Skip window functions (ROW_NUMBER) — avoids full sort
--   3. Move dominant-bin and pct computation to client-side JS
--
-- Run in Supabase SQL Editor

-- ── Raw size counts per orchard per bin (no window function) ───────────────────

CREATE OR REPLACE FUNCTION get_fruit_size_summary(
  p_farm_id uuid, p_from timestamptz, p_to timestamptz
)
RETURNS TABLE (
  orchard_id uuid, bin_label text, fruit_count bigint, avg_weight_g integer
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT s.orchard_id,
    COALESCE(sb.label, 'Out of spec'),
    COUNT(f.id)::bigint,
    ROUND(AVG(f.weight_g))::integer
  FROM qc_bag_sessions s
  JOIN qc_fruit f ON f.session_id = s.id
  LEFT JOIN size_bins sb ON sb.id = f.size_bin_id
  WHERE s.farm_id = p_farm_id
    AND s.collected_at >= p_from AND s.collected_at < p_to
  GROUP BY s.orchard_id, sb.label;
$$;

-- ── Issue counts per orchard (no fruit denominator join) ──────────────────────

CREATE OR REPLACE FUNCTION get_qc_issue_counts(
  p_farm_id uuid, p_from timestamptz, p_to timestamptz
)
RETURNS TABLE (
  orchard_id uuid, pest_name text, category text, total_count bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT s.orchard_id,
    COALESCE(cp.display_name, p.name),
    cp.category::text,
    SUM(bi.count)::bigint
  FROM qc_bag_issues bi
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  JOIN orchards o ON o.id = s.orchard_id
  JOIN pests p ON p.id = bi.pest_id
  JOIN commodity_pests cp ON cp.pest_id = bi.pest_id
    AND cp.commodity_id = o.commodity_id
    AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
  WHERE s.farm_id = p_farm_id
    AND s.collected_at >= p_from AND s.collected_at < p_to
    AND bi.count > 0
  GROUP BY s.orchard_id, COALESCE(cp.display_name, p.name), cp.category
  ORDER BY s.orchard_id, SUM(bi.count) DESC;
$$;

-- ── Fruit count per orchard (lightweight denominator for issue %) ─────────────

CREATE OR REPLACE FUNCTION get_fruit_count_by_orchard(
  p_farm_id uuid, p_from timestamptz, p_to timestamptz
)
RETURNS TABLE (orchard_id uuid, fruit_count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT s.orchard_id, COUNT(f.id)::bigint
  FROM qc_bag_sessions s
  JOIN qc_fruit f ON f.session_id = s.id
  WHERE s.farm_id = p_farm_id
    AND s.collected_at >= p_from AND s.collected_at < p_to
  GROUP BY s.orchard_id;
$$;

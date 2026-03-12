-- Nutrient × Production Correlation RPCs
-- Run in Supabase SQL Editor

-- ── get_orchard_dominant_sizes ───────────────────────────────────────────────
-- Returns the most common size bin per orchard within a date range (QC data)

CREATE OR REPLACE FUNCTION get_orchard_dominant_sizes(
  p_farm_ids uuid[], p_from timestamptz, p_to timestamptz
)
RETURNS TABLE (
  orchard_id uuid, dominant_label text, avg_weight_g integer,
  fruit_count bigint, total_fruit bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH per_orchard_bin AS (
    SELECT s.orchard_id,
      COALESCE(sb.label, 'Out of spec') AS bin_label,
      COUNT(f.id)::bigint AS cnt,
      ROUND(AVG(f.weight_g))::integer AS avg_wt,
      ROW_NUMBER() OVER (PARTITION BY s.orchard_id ORDER BY COUNT(f.id) DESC) AS rn
    FROM qc_fruit f
    JOIN qc_bag_sessions s ON s.id = f.session_id
    LEFT JOIN size_bins sb ON sb.id = f.size_bin_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from AND s.collected_at < p_to
    GROUP BY s.orchard_id, sb.label
  ),
  totals AS (
    SELECT orchard_id, SUM(cnt)::bigint AS total FROM per_orchard_bin GROUP BY orchard_id
  )
  SELECT pob.orchard_id, pob.bin_label, pob.avg_wt, pob.cnt, t.total
  FROM per_orchard_bin pob JOIN totals t ON t.orchard_id = pob.orchard_id
  WHERE pob.rn = 1;
$$;


-- ── get_orchard_size_distribution_bulk ──────────────────────────────────────
-- Full per-orchard size breakdown. Called lazily when Orchard Season Card opens.
-- Pass p_orchard_id to filter to a single orchard.

CREATE OR REPLACE FUNCTION get_orchard_size_distribution_bulk(
  p_farm_ids uuid[], p_from timestamptz, p_to timestamptz,
  p_orchard_id uuid DEFAULT NULL
)
RETURNS TABLE (
  orchard_id uuid, bin_label text, display_order integer,
  fruit_count bigint, avg_weight_g integer
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT s.orchard_id,
    COALESCE(sb.label, 'Out of spec'), COALESCE(sb.display_order, 9999),
    COUNT(f.id)::bigint, ROUND(AVG(f.weight_g))::integer
  FROM qc_fruit f
  JOIN qc_bag_sessions s ON s.id = f.session_id
  LEFT JOIN size_bins sb ON sb.id = f.size_bin_id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from AND s.collected_at < p_to
    AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
  GROUP BY s.orchard_id, sb.label, sb.display_order
  ORDER BY s.orchard_id, COALESCE(sb.display_order, 9999);
$$;

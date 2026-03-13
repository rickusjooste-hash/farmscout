-- Fertilizer Timing Windows + Dashboard RPC — run in Supabase SQL Editor
-- Adds: window_start/end to fert_timings, new RPC get_fert_dashboard_summary

-- 1. Add timing window columns
ALTER TABLE fert_timings ADD COLUMN window_start date;
ALTER TABLE fert_timings ADD COLUMN window_end date;

-- 2. Dashboard summary RPC: aggregates per timing × product with confirm progress + NPK totals
CREATE OR REPLACE FUNCTION public.get_fert_dashboard_summary(
  p_farm_ids uuid[],
  p_season text DEFAULT NULL
)
RETURNS TABLE (
  timing_id uuid,
  timing_label text,
  timing_sort integer,
  window_start date,
  window_end date,
  product_id uuid,
  product_name text,
  total_orchards bigint,
  confirmed_orchards bigint,
  total_qty_prescribed numeric,
  total_qty_confirmed numeric,
  n_pct numeric,
  p_pct numeric,
  k_pct numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ft.id AS timing_id,
    ft.label AS timing_label,
    ft.sort_order AS timing_sort,
    ft.window_start,
    ft.window_end,
    fp.id AS product_id,
    fp.name AS product_name,
    COUNT(DISTINCT frl.orchard_id) AS total_orchards,
    COUNT(DISTINCT CASE WHEN fa.confirmed THEN frl.orchard_id END) AS confirmed_orchards,
    SUM(COALESCE(frl.total_qty, frl.rate_per_ha * COALESCE(frl.ha, 0))) AS total_qty_prescribed,
    SUM(CASE WHEN fa.confirmed THEN COALESCE(frl.total_qty, frl.rate_per_ha * COALESCE(frl.ha, 0)) ELSE 0 END) AS total_qty_confirmed,
    fp.n_pct,
    fp.p_pct,
    fp.k_pct
  FROM fert_recommendations fr
  JOIN fert_recommendation_lines frl ON frl.recommendation_id = fr.id
  JOIN fert_timings ft ON ft.id = frl.timing_id
  JOIN fert_products fp ON fp.id = frl.product_id
  LEFT JOIN fert_applications fa ON fa.line_id = frl.id
  WHERE fr.farm_id = ANY(p_farm_ids)
    AND (p_season IS NULL OR fr.season = p_season)
    AND frl.orchard_id IS NOT NULL
  GROUP BY ft.id, ft.label, ft.sort_order, ft.window_start, ft.window_end,
           fp.id, fp.name, fp.n_pct, fp.p_pct, fp.k_pct
  ORDER BY ft.sort_order, fp.name;
$$;

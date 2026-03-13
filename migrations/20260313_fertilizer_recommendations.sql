-- Fertilizer Recommendations Module — run in Supabase SQL Editor
-- Creates: fert_products, fert_recommendations, fert_timings, fert_recommendation_lines, fert_orchard_map
-- RPCs: get_fert_recommendation_summary, get_fert_order_list

-- 1. Product catalog (org-scoped)
CREATE TABLE public.fert_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  name            text NOT NULL,
  registration_no text,
  n_pct           numeric DEFAULT 0,
  p_pct           numeric DEFAULT 0,
  k_pct           numeric DEFAULT 0,
  ca_pct          numeric DEFAULT 0,
  mg_pct          numeric DEFAULT 0,
  s_pct           numeric DEFAULT 0,
  default_unit    text NOT NULL DEFAULT 'kg/ha',
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organisation_id, name)
);

-- 2. Recommendation header (one row per import file)
CREATE TABLE public.fert_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  commodity_id    uuid REFERENCES commodities(id),
  season          text NOT NULL,
  program_type    text NOT NULL DEFAULT 'standard',
  soil_scientist  text,
  reference_no    text,
  pdf_url         text,
  imported_by     uuid REFERENCES user_profiles(id),
  created_at      timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_fert_rec_dedup
  ON fert_recommendations (farm_id, season, commodity_id, program_type);
CREATE INDEX idx_fert_rec_farm ON fert_recommendations (farm_id);

-- 3. Timing periods per recommendation (dynamic, not enum)
CREATE TABLE public.fert_timings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES fert_recommendations(id) ON DELETE CASCADE,
  label             text NOT NULL,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_fert_timings_rec ON fert_timings (recommendation_id);

-- 4. Core data: per orchard × product × timing
CREATE TABLE public.fert_recommendation_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES fert_recommendations(id) ON DELETE CASCADE,
  timing_id         uuid NOT NULL REFERENCES fert_timings(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES fert_products(id),
  orchard_id        uuid REFERENCES orchards(id),
  legacy_orchard_id integer,
  source_block_name text,
  rate_per_ha       numeric,
  unit              text NOT NULL DEFAULT 'kg/ha',
  total_qty         numeric,
  ha                numeric,
  target_ton_ha     numeric,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_fert_lines_rec ON fert_recommendation_lines (recommendation_id);
CREATE INDEX idx_fert_lines_orchard ON fert_recommendation_lines (orchard_id);
CREATE INDEX idx_fert_lines_product ON fert_recommendation_lines (product_id);

-- 5. Persistent source name → orchard_id mapping (same pattern as leaf_analysis_orchard_map)
CREATE TABLE public.fert_orchard_map (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  source_name     text NOT NULL,
  orchard_id      uuid NOT NULL REFERENCES orchards(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organisation_id, farm_id, source_name)
);

-- 6. RPC: get_fert_recommendation_summary
-- Returns flat rows joined across all tables for display
CREATE OR REPLACE FUNCTION public.get_fert_recommendation_summary(
  p_farm_ids uuid[],
  p_season text DEFAULT NULL
)
RETURNS TABLE (
  recommendation_id uuid,
  farm_id uuid,
  farm_name text,
  commodity_name text,
  season text,
  program_type text,
  soil_scientist text,
  reference_no text,
  timing_id uuid,
  timing_label text,
  timing_sort integer,
  product_id uuid,
  product_name text,
  product_unit text,
  orchard_id uuid,
  orchard_name text,
  legacy_orchard_id integer,
  source_block_name text,
  rate_per_ha numeric,
  unit text,
  total_qty numeric,
  ha numeric,
  target_ton_ha numeric,
  n_pct numeric,
  p_pct numeric,
  k_pct numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fr.id AS recommendation_id,
    fr.farm_id,
    f.full_name AS farm_name,
    c.name AS commodity_name,
    fr.season,
    fr.program_type,
    fr.soil_scientist,
    fr.reference_no,
    ft.id AS timing_id,
    ft.label AS timing_label,
    ft.sort_order AS timing_sort,
    fp.id AS product_id,
    fp.name AS product_name,
    fp.default_unit AS product_unit,
    frl.orchard_id,
    o.name AS orchard_name,
    frl.legacy_orchard_id,
    frl.source_block_name,
    frl.rate_per_ha,
    frl.unit,
    COALESCE(frl.total_qty, frl.rate_per_ha * COALESCE(frl.ha, 0)) AS total_qty,
    frl.ha,
    frl.target_ton_ha,
    fp.n_pct,
    fp.p_pct,
    fp.k_pct
  FROM fert_recommendations fr
  JOIN farms f ON f.id = fr.farm_id
  LEFT JOIN commodities c ON c.id = fr.commodity_id
  JOIN fert_recommendation_lines frl ON frl.recommendation_id = fr.id
  JOIN fert_timings ft ON ft.id = frl.timing_id
  JOIN fert_products fp ON fp.id = frl.product_id
  LEFT JOIN orchards o ON o.id = frl.orchard_id
  WHERE fr.farm_id = ANY(p_farm_ids)
    AND (p_season IS NULL OR fr.season = p_season)
  ORDER BY o.name, ft.sort_order, fp.name;
$$;

-- 7. RPC: get_fert_order_list
-- Aggregated totals per product × timing across all orchards
CREATE OR REPLACE FUNCTION public.get_fert_order_list(
  p_farm_ids uuid[],
  p_season text DEFAULT NULL
)
RETURNS TABLE (
  timing_label text,
  timing_sort integer,
  product_id uuid,
  product_name text,
  unit text,
  total_qty numeric,
  total_ha numeric,
  avg_rate_per_ha numeric,
  orchard_count bigint,
  n_pct numeric,
  p_pct numeric,
  k_pct numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ft.label AS timing_label,
    ft.sort_order AS timing_sort,
    fp.id AS product_id,
    fp.name AS product_name,
    frl.unit,
    SUM(COALESCE(frl.total_qty, frl.rate_per_ha * COALESCE(frl.ha, 0))) AS total_qty,
    SUM(frl.ha) AS total_ha,
    CASE WHEN SUM(frl.ha) > 0
      THEN ROUND(SUM(frl.rate_per_ha * COALESCE(frl.ha, 0)) / NULLIF(SUM(frl.ha), 0), 2)
      ELSE AVG(frl.rate_per_ha)
    END AS avg_rate_per_ha,
    COUNT(DISTINCT frl.orchard_id) AS orchard_count,
    fp.n_pct,
    fp.p_pct,
    fp.k_pct
  FROM fert_recommendations fr
  JOIN fert_recommendation_lines frl ON frl.recommendation_id = fr.id
  JOIN fert_timings ft ON ft.id = frl.timing_id
  JOIN fert_products fp ON fp.id = frl.product_id
  WHERE fr.farm_id = ANY(p_farm_ids)
    AND (p_season IS NULL OR fr.season = p_season)
    AND frl.rate_per_ha > 0
  GROUP BY ft.label, ft.sort_order, fp.id, fp.name, frl.unit, fp.n_pct, fp.p_pct, fp.k_pct
  ORDER BY ft.sort_order, fp.name;
$$;

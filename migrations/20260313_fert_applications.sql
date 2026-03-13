-- Fertilizer Application Confirmations — run in Supabase SQL Editor
-- Creates: fert_applications table + RPC get_fert_application_status

-- 1. Application confirmation table (one row per recommendation line)
CREATE TABLE public.fert_applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  line_id         uuid NOT NULL REFERENCES fert_recommendation_lines(id) ON DELETE CASCADE,
  confirmed       boolean NOT NULL DEFAULT true,
  date_applied    date,
  confirmed_by    uuid REFERENCES user_profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (line_id)
);
CREATE INDEX idx_fert_applications_line ON fert_applications (line_id);
CREATE INDEX idx_fert_applications_org ON fert_applications (organisation_id);

-- 2. RPC: get_fert_application_status
-- Returns all mapped recommendation lines with confirmation status
DROP FUNCTION IF EXISTS public.get_fert_application_status(uuid[], text);
CREATE OR REPLACE FUNCTION public.get_fert_application_status(
  p_farm_ids uuid[],
  p_season text DEFAULT NULL
)
RETURNS TABLE (
  line_id uuid,
  farm_id uuid,
  timing_id uuid,
  timing_label text,
  timing_sort integer,
  product_id uuid,
  product_name text,
  orchard_id uuid,
  orchard_name text,
  orchard_nr integer,
  variety text,
  rate_per_ha numeric,
  unit text,
  total_qty numeric,
  ha numeric,
  confirmed boolean,
  date_applied date,
  confirmed_by_name text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    frl.id AS line_id,
    fr.farm_id,
    ft.id AS timing_id,
    ft.label AS timing_label,
    ft.sort_order AS timing_sort,
    fp.id AS product_id,
    fp.name AS product_name,
    frl.orchard_id,
    o.name AS orchard_name,
    o.orchard_nr,
    o.variety,
    frl.rate_per_ha,
    frl.unit,
    COALESCE(frl.total_qty, frl.rate_per_ha * COALESCE(frl.ha, 0)) AS total_qty,
    frl.ha,
    COALESCE(fa.confirmed, false) AS confirmed,
    fa.date_applied,
    up.full_name AS confirmed_by_name
  FROM fert_recommendations fr
  JOIN fert_recommendation_lines frl ON frl.recommendation_id = fr.id
  JOIN fert_timings ft ON ft.id = frl.timing_id
  JOIN fert_products fp ON fp.id = frl.product_id
  JOIN orchards o ON o.id = frl.orchard_id
  LEFT JOIN fert_applications fa ON fa.line_id = frl.id
  LEFT JOIN user_profiles up ON up.id = fa.confirmed_by
  WHERE fr.farm_id = ANY(p_farm_ids)
    AND (p_season IS NULL OR fr.season = p_season)
    AND frl.orchard_id IS NOT NULL
  ORDER BY ft.sort_order, fp.name, o.name;
$$;

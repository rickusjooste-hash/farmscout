-- Patch: add commodity_name to get_qc_reference_data orchards object
-- Run in Supabase SQL Editor after 20260304_qc_schema.sql

CREATE OR REPLACE FUNCTION get_qc_reference_data(p_farm_ids uuid[])
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'employees', (
      SELECT json_agg(e ORDER BY e.full_name)
      FROM qc_employees e
      WHERE e.farm_id = ANY(p_farm_ids) AND e.is_active
    ),
    'size_bins', (
      SELECT json_agg(sb ORDER BY sb.commodity_id, sb.display_order)
      FROM size_bins sb
      WHERE sb.commodity_id IN (
        SELECT DISTINCT commodity_id FROM orchards WHERE farm_id = ANY(p_farm_ids) AND is_active
      )
      AND sb.is_active
    ),
    'qc_issues', (
      SELECT json_agg(json_build_object(
        'id',            cp.id,
        'commodity_id',  cp.commodity_id,
        'pest_id',       cp.pest_id,
        'category',      cp.category,
        'display_name',  COALESCE(cp.display_name, p.name),
        'display_order', cp.display_order
      ) ORDER BY cp.commodity_id, cp.display_order)
      FROM commodity_pests cp
      JOIN pests p ON p.id = cp.pest_id
      WHERE cp.commodity_id IN (
        SELECT DISTINCT commodity_id FROM orchards WHERE farm_id = ANY(p_farm_ids) AND is_active
      )
      AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
      AND cp.is_active
    ),
    'orchards', (
      SELECT json_agg(json_build_object(
        'id',             o.id,
        'name',           o.name,
        'commodity_id',   o.commodity_id,
        'commodity_name', c.name,
        'boundary',       CASE WHEN o.boundary IS NOT NULL
                               THEN ST_AsGeoJSON(o.boundary)::json
                               ELSE NULL END
      ) ORDER BY o.name)
      FROM orchards o
      JOIN commodities c ON c.id = o.commodity_id
      WHERE o.farm_id = ANY(p_farm_ids) AND o.is_active
    )
  );
$$;

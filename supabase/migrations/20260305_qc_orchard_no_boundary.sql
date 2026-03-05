-- Drop boundary from get_qc_reference_data to keep response small.
-- GPS matching is now done server-side via match_orchard_from_gps.

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
        'id',               cp.id,
        'commodity_id',     cp.commodity_id,
        'pest_id',          cp.pest_id,
        'category',         cp.category,
        'display_name',     COALESCE(cp.display_name,    p.name),
        'display_name_af',  COALESCE(cp.display_name_af, p.name_af, cp.display_name, p.name),
        'display_order',    cp.display_order
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
        'variety',        o.variety,
        'farm_id',        o.farm_id,
        'commodity_id',   o.commodity_id,
        'commodity_name', c.name
      ) ORDER BY o.name)
      FROM orchards o
      JOIN commodities c ON c.id = o.commodity_id
      WHERE o.farm_id = ANY(p_farm_ids) AND o.is_active
    )
  );
$$;

-- Server-side GPS → orchard matching using PostGIS ST_Contains
CREATE OR REPLACE FUNCTION match_orchard_from_gps(p_lat double precision, p_lng double precision, p_farm_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object('id', o.id, 'name', o.name)
  FROM orchards o
  WHERE o.farm_id = p_farm_id
    AND o.is_active
    AND o.boundary IS NOT NULL
    AND ST_Contains(o.boundary, ST_SetSRID(ST_Point(p_lng, p_lat), 4326))
  LIMIT 1;
$$;

-- Add team to get_qc_reference_data employee response
CREATE OR REPLACE FUNCTION get_qc_reference_data(p_farm_ids uuid[])
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'employees', (
      SELECT json_agg(json_build_object(
        'id',          e.id,
        'organisation_id', e.organisation_id,
        'farm_id',     e.farm_id,
        'employee_nr', e.employee_nr,
        'full_name',   e.full_name,
        'team',        e.team,
        'is_active',   e.is_active,
        'synced_at',   e.synced_at
      ) ORDER BY e.full_name)
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

-- RPC: Production year summary pivot data
-- Returns aggregated total_tons by farm, commodity, variety, production_year
-- Run manually in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_production_year_summary(p_farm_ids uuid[])
RETURNS TABLE (
  farm_code text,
  commodity_code text,
  variety text,
  production_year text,
  total_tons numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH org AS (
    SELECT organisation_id FROM farms WHERE id = p_farm_ids[1] LIMIT 1
  ),
  bin_agg AS (
    SELECT
      f.code AS farm_code,
      COALESCE(c.code, '?') AS commodity_code,
      UPPER(COALESCE(o.variety, pb.variety, '?')) AS variety,
      o.commodity_id,
      LEFT(pb.production_year, 4) AS production_year,
      SUM(pb.total) AS total_bins
    FROM production_bins pb
    LEFT JOIN farms f ON f.id = pb.farm_id
    LEFT JOIN orchards o ON o.id = pb.orchard_id
    LEFT JOIN commodities c ON c.id = o.commodity_id
    WHERE pb.farm_id = ANY(p_farm_ids)
      AND (o.id IS NULL OR o.is_active = true)
    GROUP BY f.code, c.code, o.commodity_id,
             COALESCE(o.variety, pb.variety, '?'),
             LEFT(pb.production_year, 4)
  )
  SELECT
    ba.farm_code,
    ba.commodity_code,
    ba.variety,
    ba.production_year,
    ROUND(ba.total_bins * COALESCE(
      (SELECT w.default_weight_kg FROM production_bin_weights w
       WHERE w.organisation_id = (SELECT organisation_id FROM org)
         AND w.commodity_id = ba.commodity_id
         AND UPPER(w.variety) = ba.variety
       LIMIT 1),
      (SELECT w.default_weight_kg FROM production_bin_weights w
       WHERE w.organisation_id = (SELECT organisation_id FROM org)
         AND w.commodity_id = ba.commodity_id
         AND w.variety IS NULL
       LIMIT 1),
      400
    ) / 1000, 3) AS total_tons
  FROM bin_agg ba
  ORDER BY ba.farm_code, ba.commodity_code, ba.variety, ba.production_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

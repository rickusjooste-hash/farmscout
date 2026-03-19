-- RPC: Production year summary pivot data
-- Returns aggregated total_tons by farm, commodity, variety, production_year
-- Run manually in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_production_year_summary(p_farm_ids uuid[])
RETURNS TABLE (
  farm_code text,
  commodity_code text,
  variety text,
  ha numeric,
  production_year text,
  total_tons numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH org AS (
    SELECT organisation_id FROM farms WHERE id = p_farm_ids[1] LIMIT 1
  ),
  -- Sum ha per farm+commodity+variety (independent of year)
  variety_ha AS (
    SELECT
      f.code AS farm_code,
      COALESCE(c.code, '?') AS commodity_code,
      UPPER(COALESCE(o.variety, '?')) AS variety,
      SUM(COALESCE(o.ha, 0)) AS ha
    FROM orchards o
    JOIN farms f ON f.id = o.farm_id
    JOIN commodities c ON c.id = o.commodity_id
    WHERE o.farm_id = ANY(p_farm_ids)
      AND o.is_active = true
    GROUP BY f.code, c.code, COALESCE(o.variety, '?')
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
    JOIN orchards o ON o.id = pb.orchard_id AND o.is_active = true
    JOIN farms f ON f.id = pb.farm_id
    JOIN commodities c ON c.id = o.commodity_id
    WHERE pb.farm_id = ANY(p_farm_ids)
    GROUP BY f.code, c.code, o.commodity_id,
             COALESCE(o.variety, pb.variety, '?'),
             LEFT(pb.production_year, 4)
  )
  SELECT
    ba.farm_code,
    ba.commodity_code,
    ba.variety,
    COALESCE(vh.ha, 0) AS ha,
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
  LEFT JOIN variety_ha vh
    ON vh.farm_code = ba.farm_code
    AND vh.commodity_code = ba.commodity_code
    AND vh.variety = ba.variety
  ORDER BY ba.farm_code, ba.commodity_code, ba.variety, ba.production_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

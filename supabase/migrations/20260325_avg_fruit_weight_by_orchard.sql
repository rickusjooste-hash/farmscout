-- Average fruit weight per orchard from QC sampling
CREATE OR REPLACE FUNCTION get_avg_fruit_weight_by_orchard(
  p_farm_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(orchard_id uuid, avg_weight_g numeric)
LANGUAGE sql SECURITY DEFINER SET statement_timeout = '30s' AS $$
  SELECT bs.orchard_id, ROUND(AVG(f.weight_g)::numeric, 1) as avg_weight_g
  FROM qc_fruit f
  JOIN qc_bag_sessions bs ON bs.id = f.session_id
  WHERE bs.farm_id = ANY(p_farm_ids)
    AND bs.collected_at >= p_from
    AND bs.collected_at < p_to
    AND f.weight_g > 0
  GROUP BY bs.orchard_id;
$$;

-- Add p_orchard_id filter to get_qc_size_distribution
-- Run in Supabase SQL Editor

DROP FUNCTION IF EXISTS get_qc_size_distribution(uuid[], timestamptz, timestamptz, uuid);
DROP FUNCTION IF EXISTS get_qc_size_distribution(uuid[], timestamptz, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION get_qc_size_distribution(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL
)
RETURNS TABLE(
  bin_label     text,
  display_order integer,
  fruit_count   bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(sb.label, 'Out of spec') AS bin_label,
    COALESCE(sb.display_order, 9999)  AS display_order,
    COUNT(f.id)::bigint               AS fruit_count
  FROM qc_fruit f
  JOIN qc_bag_sessions s ON s.id = f.session_id
  JOIN orchards o ON o.id = s.orchard_id
  LEFT JOIN size_bins sb ON sb.id = f.size_bin_id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
    AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
    AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
  GROUP BY sb.label, sb.display_order
  ORDER BY COALESCE(sb.display_order, 9999);
$$;

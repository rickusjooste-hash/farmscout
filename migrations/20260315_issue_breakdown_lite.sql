-- Fix get_qc_issue_breakdown timeout
-- The total_fruit CTE scans qc_fruit (2M+ rows) causing statement timeout.
-- Remove the qc_fruit scan entirely — client already computes pct from size bins.
--
-- Run in Supabase SQL Editor.

DROP FUNCTION IF EXISTS get_qc_issue_breakdown(uuid[], timestamptz, timestamptz, uuid, uuid, text);

CREATE OR REPLACE FUNCTION get_qc_issue_breakdown(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL,
  p_variety      text DEFAULT NULL
)
RETURNS TABLE(
  pest_id        uuid,
  pest_name      text,
  pest_name_af   text,
  category       text,
  total_count    bigint,
  bags_affected  bigint,
  pct_of_fruit   numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.id                                                  AS pest_id,
    COALESCE(cp.display_name,    p.name)                  AS pest_name,
    COALESCE(cp.display_name_af, p.name_af, p.name)       AS pest_name_af,
    cp.category::text,
    SUM(bi.count)::bigint                                 AS total_count,
    COUNT(DISTINCT bi.session_id)::bigint                 AS bags_affected,
    0::numeric                                            AS pct_of_fruit
  FROM qc_bag_issues bi
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  JOIN orchards o ON o.id = s.orchard_id
  JOIN pests p ON p.id = bi.pest_id
  JOIN commodity_pests cp
    ON cp.pest_id = bi.pest_id
   AND cp.commodity_id = o.commodity_id
   AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
    AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
    AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
    AND (p_variety IS NULL OR o.variety = p_variety)
    AND bi.count > 0
  GROUP BY p.id, pest_name, pest_name_af, cp.category
  ORDER BY total_count DESC
  LIMIT 15;
$$;

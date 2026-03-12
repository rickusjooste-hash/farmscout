-- Fix get_qc_issue_breakdown: use total fruit sampled as denominator
-- instead of total defect count.
--
-- The 20260307 variety-filter migration regressed this RPC to compute
-- "% of all defects that are X" instead of "% of fruit affected by X".
-- This restores the correct total_fruit CTE approach.
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
LANGUAGE sql SECURITY DEFINER SET statement_timeout = '60s' AS $$
  WITH scoped_sessions AS (
    SELECT s.id
    FROM qc_bag_sessions s
    JOIN orchards o ON o.id = s.orchard_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
      AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
      AND (p_variety IS NULL OR o.variety = p_variety)
  ),
  total_fruit AS (
    SELECT COUNT(*)::numeric AS cnt
    FROM qc_fruit f
    WHERE f.session_id IN (SELECT id FROM scoped_sessions)
  )
  SELECT
    p.id                                                  AS pest_id,
    COALESCE(cp.display_name,    p.name)                  AS pest_name,
    COALESCE(cp.display_name_af, p.name_af, p.name)       AS pest_name_af,
    cp.category::text,
    SUM(bi.count)::bigint                                 AS total_count,
    COUNT(DISTINCT bi.session_id)::bigint                 AS bags_affected,
    CASE
      WHEN tf.cnt > 0
      THEN ROUND(SUM(bi.count)::numeric / tf.cnt * 100, 1)
      ELSE 0
    END                                                   AS pct_of_fruit
  FROM qc_bag_issues bi
  JOIN scoped_sessions ss ON ss.id = bi.session_id
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  JOIN orchards o ON o.id = s.orchard_id
  JOIN pests p ON p.id = bi.pest_id
  JOIN commodity_pests cp
    ON cp.pest_id = bi.pest_id
   AND cp.commodity_id = o.commodity_id
   AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
  CROSS JOIN total_fruit tf
  WHERE bi.count > 0
  GROUP BY p.id, pest_name, pest_name_af, cp.category, tf.cnt
  ORDER BY total_count DESC
  LIMIT 15;
$$;

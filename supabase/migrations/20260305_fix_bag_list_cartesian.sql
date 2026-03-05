-- Fix: get_qc_bag_list had a Cartesian product between qc_fruit and qc_bag_issues.
-- Both were LEFT JOINed on session_id, so issue_count was multiplied by fruit_count.
-- Fix: aggregate fruit and issues in separate CTEs, then join.

CREATE OR REPLACE FUNCTION get_qc_bag_list(
  p_farm_ids uuid[],
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS TABLE(
  session_id     uuid,
  bag_seq        integer,
  collected_at   timestamptz,
  orchard_name   text,
  commodity_name text,
  commodity_id   uuid,
  employee_name  text,
  fruit_count    bigint,
  avg_weight_g   integer,
  issue_count    bigint,
  status         text
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH fruit_agg AS (
    SELECT f.session_id,
           COUNT(*)::bigint            AS fruit_count,
           ROUND(AVG(f.weight_g))::int AS avg_weight_g
    FROM qc_fruit f
    JOIN qc_bag_sessions s ON s.id = f.session_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
    GROUP BY f.session_id
  ),
  issue_agg AS (
    SELECT bi.session_id,
           SUM(bi.count)::bigint AS issue_count
    FROM qc_bag_issues bi
    JOIN qc_bag_sessions s ON s.id = bi.session_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND bi.count > 0
    GROUP BY bi.session_id
  )
  SELECT
    s.id                             AS session_id,
    s.bag_seq,
    s.collected_at,
    o.name                           AS orchard_name,
    c.name                           AS commodity_name,
    c.id                             AS commodity_id,
    e.full_name                      AS employee_name,
    COALESCE(fa.fruit_count, 0)      AS fruit_count,
    fa.avg_weight_g,
    COALESCE(ia.issue_count, 0)      AS issue_count,
    s.status
  FROM qc_bag_sessions s
  JOIN orchards o ON o.id = s.orchard_id
  JOIN commodities c ON c.id = o.commodity_id
  JOIN qc_employees e ON e.id = s.employee_id
  LEFT JOIN fruit_agg fa ON fa.session_id = s.id
  LEFT JOIN issue_agg ia ON ia.session_id = s.id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
  ORDER BY s.collected_at DESC
  LIMIT 200;
$$;

-- Fix: bags_sampled KPI relied on status='sampled' which requires the QC tablet
-- to successfully push the status update. If that push fails (token expiry, etc.)
-- but fruit records push successfully, bags_sampled undercounts.
--
-- Fix: count a bag as "sampled" if status='sampled' OR it has fruit records.
-- Fruit records only exist for completed samples, so this is ground truth.
--
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_qc_dashboard_kpis(
  p_farm_ids uuid[],
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  WITH sessions AS (
    SELECT s.id, s.status,
           EXISTS (SELECT 1 FROM qc_fruit f WHERE f.session_id = s.id) AS has_fruit
    FROM qc_bag_sessions s
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
  ),
  fruit_agg AS (
    SELECT
      COUNT(*)::int           AS fruit_weighed,
      ROUND(AVG(f.weight_g))::int AS avg_weight_g
    FROM qc_fruit f
    JOIN sessions s ON s.id = f.session_id
  ),
  kpis AS (
    SELECT
      COUNT(*)::int                                                  AS bags_collected,
      COUNT(*) FILTER (WHERE status = 'sampled' OR has_fruit)::int   AS bags_sampled
    FROM sessions
  ),
  issue_bags AS (
    SELECT COUNT(DISTINCT bi.session_id)::int AS bags_with_issues
    FROM qc_bag_issues bi
    JOIN sessions s ON s.id = bi.session_id
    WHERE (s.status = 'sampled' OR s.has_fruit) AND bi.count > 0
  ),
  fruit_per_bag AS (
    SELECT f.session_id, COUNT(*)::int AS fruit_count
    FROM qc_fruit f
    JOIN sessions s ON s.id = f.session_id AND (s.status = 'sampled' OR s.has_fruit)
    GROUP BY f.session_id
  ),
  issues_per_bag AS (
    SELECT bi.session_id, SUM(bi.count)::int AS issue_count
    FROM qc_bag_issues bi
    JOIN sessions s ON s.id = bi.session_id AND (s.status = 'sampled' OR s.has_fruit)
    GROUP BY bi.session_id
  ),
  bag_counts AS (
    SELECT
      fp.session_id,
      fp.fruit_count,
      COALESCE(ip.issue_count, 0) AS issue_count
    FROM fruit_per_bag fp
    LEFT JOIN issues_per_bag ip ON ip.session_id = fp.session_id
  ),
  class1 AS (
    SELECT
      SUM(fruit_count)::int                                     AS total_fruit,
      SUM(GREATEST(0, fruit_count - issue_count))::int          AS class1_fruit
    FROM bag_counts
  )
  SELECT json_build_object(
    'bags_collected',  k.bags_collected,
    'bags_sampled',    k.bags_sampled,
    'fruit_weighed',   COALESCE(fa.fruit_weighed,  0),
    'avg_weight_g',    COALESCE(fa.avg_weight_g,   0),
    'issue_rate_pct',  CASE
                         WHEN k.bags_sampled > 0
                         THEN ROUND(ib.bags_with_issues::numeric / k.bags_sampled * 100)
                         ELSE 0
                       END,
    'class_1_pct',     CASE
                         WHEN c.total_fruit > 0
                         THEN ROUND(c.class1_fruit::numeric / c.total_fruit * 100, 1)
                         ELSE 0
                       END
  )
  FROM kpis k, fruit_agg fa, issue_bags ib, class1 c;
$$;

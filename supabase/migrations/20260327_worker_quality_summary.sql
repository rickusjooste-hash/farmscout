-- Per-employee QC quality summary: fruit count, issue count, issue %, avg weight
-- Used by WorkerPerformancePanel to show bag sample quality per picker
CREATE OR REPLACE FUNCTION get_worker_quality_summary(
  p_farm_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(
  employee_id uuid,
  bags_sampled bigint,
  fruit_sampled bigint,
  fruit_with_issues bigint,
  issue_pct numeric,
  avg_fruit_weight_g numeric
)
LANGUAGE sql SECURITY DEFINER SET statement_timeout = '30s' AS $$
  SELECT
    bs.employee_id,
    COUNT(DISTINCT bs.id)::bigint AS bags_sampled,
    COUNT(f.id)::bigint AS fruit_sampled,
    COUNT(DISTINCT fi.fruit_id)::bigint AS fruit_with_issues,
    CASE WHEN COUNT(f.id) > 0
      THEN ROUND(COUNT(DISTINCT fi.fruit_id)::numeric / COUNT(f.id) * 100, 1)
      ELSE 0
    END AS issue_pct,
    ROUND(AVG(f.weight_g)::numeric, 1) AS avg_fruit_weight_g
  FROM qc_bag_sessions bs
  JOIN qc_fruit f ON f.session_id = bs.id
  LEFT JOIN qc_fruit_issues fi ON fi.fruit_id = f.id
  WHERE bs.farm_id = ANY(p_farm_ids)
    AND bs.collected_at >= p_from
    AND bs.collected_at < p_to
    AND bs.status = 'sampled'
  GROUP BY bs.employee_id;
$$;

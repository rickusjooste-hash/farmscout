-- ============================================================
-- QC Picker Issue Breakdown RPC
-- Returns per-picker, per-issue counts for the QC Dashboard.
-- Run manually in the Supabase SQL Editor.
-- ============================================================

-- Drop first — return type changed (added fruit_sampled column)
DROP FUNCTION IF EXISTS get_qc_picker_issue_breakdown(uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_qc_picker_issue_breakdown(
  p_farm_ids uuid[],
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS TABLE(
  employee_name  text,
  pest_id        uuid,
  pest_name      text,
  category       text,
  total_count    bigint,
  bags_affected  bigint,
  fruit_sampled  bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH fruit_per_picker AS (
    SELECT e.full_name AS employee_name, COUNT(f.id)::bigint AS fruit_sampled
    FROM qc_fruit f
    JOIN qc_bag_sessions s ON s.id = f.session_id
    JOIN qc_employees e ON e.id = s.employee_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
    GROUP BY e.full_name
  )
  SELECT
    e.full_name                               AS employee_name,
    p.id                                      AS pest_id,
    COALESCE(cp.display_name, p.name)         AS pest_name,
    cp.category::text,
    SUM(bi.count)::bigint                     AS total_count,
    COUNT(DISTINCT bi.session_id)::bigint     AS bags_affected,
    COALESCE(fpp.fruit_sampled, 0)            AS fruit_sampled
  FROM qc_bag_issues bi
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  JOIN qc_employees e ON e.id = s.employee_id
  JOIN orchards o ON o.id = s.orchard_id
  JOIN pests p ON p.id = bi.pest_id
  JOIN commodity_pests cp
    ON cp.pest_id = bi.pest_id
   AND cp.commodity_id = o.commodity_id
   AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
  LEFT JOIN fruit_per_picker fpp ON fpp.employee_name = e.full_name
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
    AND bi.count > 0
  GROUP BY e.full_name, p.id, pest_name, cp.category, fpp.fruit_sampled
  ORDER BY total_count DESC;
$$;

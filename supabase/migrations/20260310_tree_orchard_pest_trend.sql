-- Weekly severity trend for a specific pest+orchard over a date range
-- Used by TreeScoutingAlertSummary detail panel
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_tree_orchard_pest_trend(
  p_farm_ids   uuid[],
  p_orchard_id uuid,
  p_pest_id    uuid,
  p_from       timestamptz,
  p_to         timestamptz
)
RETURNS TABLE(
  week_label       text,
  week_start       date,
  trees_inspected  int,
  trees_affected   int,
  total_count      int,
  severity         numeric,
  status           text
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH orchard_check AS (
    SELECT o.id
    FROM orchards o
    WHERE o.id = p_orchard_id
      AND o.farm_id = ANY(p_farm_ids)
      AND o.is_active = true
  ),

  -- Resolve observation method for this pest
  pest_method AS (
    SELECT DISTINCT ON (cp.pest_id)
      cp.pest_id,
      cp.observation_method::text AS obs_method
    FROM commodity_pests cp
    WHERE cp.pest_id = p_pest_id AND cp.is_active = true
    ORDER BY cp.pest_id,
      CASE cp.observation_method
        WHEN 'leaf_inspection' THEN 0
        WHEN 'present_absent'  THEN 1
        ELSE 2
      END
  ),

  -- Per-week raw aggregates
  weekly AS (
    SELECT
      date_trunc('week', s.inspected_at)::date         AS wk,
      COUNT(DISTINCT it.id)                             AS trees_inspected,
      COUNT(DISTINCT it.id) FILTER (WHERE obs.count > 0) AS trees_affected,
      COALESCE(SUM(obs.count), 0)::int                  AS total_count
    FROM inspection_observations obs
    JOIN inspection_trees    it ON it.id  = obs.tree_id
    JOIN inspection_sessions s  ON s.id   = it.session_id
    JOIN orchard_check       oc ON oc.id  = s.orchard_id
    WHERE obs.pest_id = p_pest_id
      AND s.inspected_at >= p_from
      AND s.inspected_at <  p_to
    GROUP BY date_trunc('week', s.inspected_at)
  ),

  -- Calculate severity using pest's observation method
  with_severity AS (
    SELECT
      w.wk,
      w.trees_inspected::int,
      w.trees_affected::int,
      w.total_count,
      COALESCE(pm.obs_method, 'count') AS obs_method,
      CASE COALESCE(pm.obs_method, 'count')
        WHEN 'leaf_inspection' THEN
          CASE WHEN w.trees_inspected > 0
               THEN ROUND((w.total_count::numeric / (w.trees_inspected * 5)) * 100, 1)
               ELSE 0 END
        WHEN 'present_absent' THEN
          CASE WHEN w.trees_inspected > 0
               THEN ROUND((w.trees_affected::numeric / w.trees_inspected) * 100, 1)
               ELSE 0 END
        ELSE
          CASE WHEN w.trees_inspected > 0
               THEN ROUND(w.total_count::numeric / w.trees_inspected, 1)
               ELSE 0 END
      END AS severity
    FROM weekly w
    LEFT JOIN pest_method pm ON true
  )

  SELECT
    'W' || EXTRACT(WEEK FROM s.wk)::text AS week_label,
    s.wk                                 AS week_start,
    s.trees_inspected,
    s.trees_affected,
    s.total_count,
    s.severity,
    CASE
      WHEN s.obs_method IN ('leaf_inspection', 'present_absent') THEN
        CASE
          WHEN s.severity >= 50 THEN 'red'
          WHEN s.severity >= 20 THEN 'yellow'
          ELSE 'green'
        END
      ELSE 'green'
    END AS status
  FROM with_severity s
  ORDER BY s.wk;
$$;

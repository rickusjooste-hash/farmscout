-- Per-orchard severity for a specific pest this week (used by TreeScoutingAlertSummary map)
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_tree_orchard_severity(p_farm_ids uuid[], p_pest_id uuid)
RETURNS TABLE(
  orchard_id   uuid,
  orchard_name text,
  severity     numeric,
  status       text
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH orchard_scope AS (
    SELECT o.id, o.name, o.commodity_id
    FROM orchards o
    WHERE o.farm_id = ANY(p_farm_ids) AND o.is_active = true
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

  -- This week: per-orchard raw aggregates for the given pest
  tw_orchard AS (
    SELECT
      os.id                                                    AS orchard_id,
      os.name                                                  AS orchard_name,
      COUNT(DISTINCT it.id)                                    AS trees_inspected,
      COUNT(DISTINCT it.id) FILTER (WHERE obs.count > 0)      AS trees_affected,
      COALESCE(SUM(obs.count), 0)                              AS total_count
    FROM inspection_observations obs
    JOIN inspection_trees    it ON it.id  = obs.tree_id
    JOIN inspection_sessions s  ON s.id   = it.session_id
    JOIN orchard_scope       os ON os.id  = s.orchard_id
    WHERE obs.pest_id = p_pest_id
      AND s.inspected_at >= date_trunc('week', now())
    GROUP BY os.id, os.name
  ),

  -- Calculate severity per orchard using the pest's observation method
  tw_with_severity AS (
    SELECT
      tw.orchard_id,
      tw.orchard_name,
      COALESCE(pm.obs_method, 'count') AS obs_method,
      CASE COALESCE(pm.obs_method, 'count')
        WHEN 'leaf_inspection' THEN
          CASE WHEN tw.trees_inspected > 0
               THEN ROUND((tw.total_count::numeric / (tw.trees_inspected * 5)) * 100, 1)
               ELSE 0 END
        WHEN 'present_absent' THEN
          CASE WHEN tw.trees_inspected > 0
               THEN ROUND((tw.trees_affected::numeric / tw.trees_inspected) * 100, 1)
               ELSE 0 END
        ELSE
          CASE WHEN tw.trees_inspected > 0
               THEN ROUND(tw.total_count::numeric / tw.trees_inspected, 1)
               ELSE 0 END
      END AS severity
    FROM tw_orchard tw
    LEFT JOIN pest_method pm ON true
  )

  SELECT
    s.orchard_id,
    s.orchard_name,
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
  FROM tw_with_severity s
  ORDER BY s.severity DESC;
$$;

-- Migration: Weekly Tree Scouting Report
-- Adds receives_tree_report column and get_weekly_tree_report RPC

ALTER TABLE rebait_notification_recipients
  ADD COLUMN IF NOT EXISTS receives_tree_report boolean DEFAULT false;

-- RPC: get_weekly_tree_report
-- Returns flat rows per orchard+pest for the current and previous ISO week.
-- Coverage = orchards with any inspection session this or last week.
CREATE OR REPLACE FUNCTION get_weekly_tree_report(p_farm_id uuid)
RETURNS TABLE(
  commodity_code       text,
  commodity_name       text,
  orchard_id           uuid,
  orchard_display      text,
  pest_id              uuid,
  pest_name            text,
  observation_method   text,
  tw_trees_inspected   bigint,
  tw_trees_affected    bigint,
  lw_trees_inspected   bigint,
  lw_trees_affected    bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
WITH
  week_bounds AS (
    SELECT
      date_trunc('week', now())                     AS tw_start,
      date_trunc('week', now()) + interval '1 week' AS tw_end,
      date_trunc('week', now()) - interval '1 week' AS lw_start
  ),
  tw AS (
    SELECT s.orchard_id, obs.pest_id,
      COUNT(DISTINCT it.id)                               AS trees_inspected,
      COUNT(DISTINCT it.id) FILTER (WHERE obs.count > 0) AS trees_affected
    FROM inspection_sessions s
    JOIN inspection_trees it ON it.session_id = s.id
    JOIN inspection_observations obs ON obs.tree_id = it.id
    WHERE s.farm_id = p_farm_id
      AND s.inspected_at >= (SELECT tw_start FROM week_bounds)
      AND s.inspected_at <  (SELECT tw_end   FROM week_bounds)
    GROUP BY s.orchard_id, obs.pest_id
  ),
  lw AS (
    SELECT s.orchard_id, obs.pest_id,
      COUNT(DISTINCT it.id)                               AS trees_inspected,
      COUNT(DISTINCT it.id) FILTER (WHERE obs.count > 0) AS trees_affected
    FROM inspection_sessions s
    JOIN inspection_trees it ON it.session_id = s.id
    JOIN inspection_observations obs ON obs.tree_id = it.id
    WHERE s.farm_id = p_farm_id
      AND s.inspected_at >= (SELECT lw_start FROM week_bounds)
      AND s.inspected_at <  (SELECT tw_start FROM week_bounds)
    GROUP BY s.orchard_id, obs.pest_id
  ),
  -- Coverage derived from actual observation data only (excludes trap-only pests)
  pest_coverage AS (
    SELECT orchard_id, pest_id FROM tw
    UNION
    SELECT orchard_id, pest_id FROM lw
  )
SELECT
  c.code                                                  AS commodity_code,
  c.name                                                  AS commodity_name,
  o.id                                                    AS orchard_id,
  CONCAT_WS(' ', o.orchard_nr::text, o.name, o.variety)  AS orchard_display,
  p.id                                                    AS pest_id,
  p.name                                                  AS pest_name,
  NULL::text                                              AS observation_method,
  COALESCE(tw.trees_inspected, 0)                         AS tw_trees_inspected,
  COALESCE(tw.trees_affected,  0)                         AS tw_trees_affected,
  COALESCE(lw.trees_inspected, 0)                         AS lw_trees_inspected,
  COALESCE(lw.trees_affected,  0)                         AS lw_trees_affected
FROM pest_coverage pc
JOIN orchards    o ON o.id = pc.orchard_id
JOIN commodities c ON c.id = o.commodity_id
JOIN pests       p ON p.id = pc.pest_id
LEFT JOIN tw ON tw.orchard_id = pc.orchard_id AND tw.pest_id = pc.pest_id
LEFT JOIN lw ON lw.orchard_id = pc.orchard_id AND lw.pest_id = pc.pest_id
ORDER BY c.code, o.name, o.variety, p.name;
$$;

-- Tree pest pressure summary v2 — adds observation_method, per-orchard severity, status chips
-- Run in Supabase SQL Editor (replaces previous version)

DROP FUNCTION IF EXISTS get_tree_pest_pressure_summary(uuid[]);

CREATE OR REPLACE FUNCTION get_tree_pest_pressure_summary(p_farm_ids uuid[])
RETURNS TABLE(
  pest_id              uuid,
  pest_name            text,
  observation_method   text,
  tw_trees_inspected   bigint,
  tw_trees_affected    bigint,
  tw_total_count       bigint,
  lw_trees_inspected   bigint,
  lw_trees_affected    bigint,
  lw_total_count       bigint,
  orchards_affected    bigint,
  red_orchards         bigint,
  yellow_orchards      bigint,
  green_orchards       bigint,
  worst_orchard_id     uuid,
  worst_orchard_name   text,
  worst_severity       numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH date_bounds AS (
    SELECT
      date_trunc('week', now())                     AS this_start,
      date_trunc('week', now()) - interval '1 week' AS last_start
  ),

  orchard_scope AS (
    SELECT o.id, o.name, o.commodity_id
    FROM orchards o
    WHERE o.farm_id = ANY(p_farm_ids) AND o.is_active = true
  ),

  -- This week: per-orchard, per-pest raw aggregates
  tw_orchard AS (
    SELECT
      obs.pest_id,
      os.id                                                    AS orchard_id,
      os.name                                                  AS orchard_name,
      os.commodity_id,
      COUNT(DISTINCT it.id)                                    AS trees_inspected,
      COUNT(DISTINCT it.id) FILTER (WHERE obs.count > 0)      AS trees_affected,
      COALESCE(SUM(obs.count), 0)                              AS total_count
    FROM inspection_observations obs
    JOIN inspection_trees    it ON it.id  = obs.tree_id
    JOIN inspection_sessions s  ON s.id   = it.session_id
    JOIN orchard_scope       os ON os.id  = s.orchard_id
    WHERE s.inspected_at >= (SELECT this_start FROM date_bounds)
    GROUP BY obs.pest_id, os.id, os.name, os.commodity_id
  ),

  -- Last week: per-pest raw aggregates (for WoW comparison)
  lw_agg AS (
    SELECT
      obs.pest_id,
      COUNT(DISTINCT it.id)                                    AS trees_inspected,
      COUNT(DISTINCT it.id) FILTER (WHERE obs.count > 0)      AS trees_affected,
      COALESCE(SUM(obs.count), 0)                              AS total_count
    FROM inspection_observations obs
    JOIN inspection_trees    it ON it.id  = obs.tree_id
    JOIN inspection_sessions s  ON s.id   = it.session_id
    JOIN orchard_scope       os ON os.id  = s.orchard_id
    WHERE s.inspected_at >= (SELECT last_start FROM date_bounds)
      AND s.inspected_at <  (SELECT this_start FROM date_bounds)
    GROUP BY obs.pest_id
  ),

  -- Resolve one observation_method per pest (global, not per-orchard)
  -- Prefers leaf_inspection > present_absent > count so tree scouting methods win
  pest_method AS (
    SELECT DISTINCT ON (cp.pest_id)
      cp.pest_id,
      cp.observation_method::text AS obs_method
    FROM commodity_pests cp
    WHERE cp.is_active = true
    ORDER BY cp.pest_id,
      CASE cp.observation_method
        WHEN 'leaf_inspection' THEN 0
        WHEN 'present_absent'  THEN 1
        ELSE 2
      END
  ),

  -- Join method + calculate per-orchard severity
  tw_with_method AS (
    SELECT
      tw.*,
      COALESCE(pm.obs_method, 'count') AS obs_method,
      CASE COALESCE(pm.obs_method, 'count')
        WHEN 'leaf_inspection' THEN
          CASE WHEN tw.trees_inspected > 0
               THEN (tw.total_count::numeric / (tw.trees_inspected * 5)) * 100
               ELSE 0 END
        WHEN 'present_absent' THEN
          CASE WHEN tw.trees_inspected > 0
               THEN (tw.trees_affected::numeric / tw.trees_inspected) * 100
               ELSE 0 END
        ELSE -- 'count'
          CASE WHEN tw.trees_inspected > 0
               THEN tw.total_count::numeric / tw.trees_inspected
               ELSE 0 END
      END AS orchard_severity
    FROM tw_orchard tw
    LEFT JOIN pest_method pm ON pm.pest_id = tw.pest_id
  ),

  -- Assign red/yellow/green per orchard
  -- % methods: >=50 red, >=20 yellow, <20 green
  -- count method: always green (no threshold)
  tw_status AS (
    SELECT
      *,
      CASE
        WHEN obs_method IN ('leaf_inspection', 'present_absent') THEN
          CASE
            WHEN orchard_severity >= 50 THEN 'red'
            WHEN orchard_severity >= 20 THEN 'yellow'
            ELSE 'green'
          END
        ELSE 'green'
      END AS status
    FROM tw_with_method
  ),

  -- Worst orchard per pest (highest severity)
  worst AS (
    SELECT DISTINCT ON (pest_id)
      pest_id,
      orchard_id       AS worst_orchard_id,
      orchard_name     AS worst_orchard_name,
      orchard_severity AS worst_severity
    FROM tw_status
    ORDER BY pest_id, orchard_severity DESC
  ),

  -- Aggregate per pest
  pest_agg AS (
    SELECT
      tw.pest_id,
      tw.obs_method,
      SUM(tw.trees_inspected)                                              AS tw_trees_inspected,
      SUM(tw.trees_affected)                                               AS tw_trees_affected,
      SUM(tw.total_count)                                                  AS tw_total_count,
      COUNT(DISTINCT tw.orchard_id)                                        AS orchards_affected,
      COUNT(DISTINCT tw.orchard_id) FILTER (WHERE tw.status = 'red')       AS red_orchards,
      COUNT(DISTINCT tw.orchard_id) FILTER (WHERE tw.status = 'yellow')    AS yellow_orchards,
      COUNT(DISTINCT tw.orchard_id) FILTER (WHERE tw.status = 'green')     AS green_orchards
    FROM tw_status tw
    GROUP BY tw.pest_id, tw.obs_method
  )

  SELECT
    pa.pest_id,
    p.name                             AS pest_name,
    pa.obs_method                      AS observation_method,
    pa.tw_trees_inspected,
    pa.tw_trees_affected,
    pa.tw_total_count,
    COALESCE(lw.trees_inspected, 0)    AS lw_trees_inspected,
    COALESCE(lw.trees_affected, 0)     AS lw_trees_affected,
    COALESCE(lw.total_count, 0)        AS lw_total_count,
    pa.orchards_affected,
    pa.red_orchards,
    pa.yellow_orchards,
    pa.green_orchards,
    w.worst_orchard_id,
    w.worst_orchard_name,
    ROUND(w.worst_severity, 1)         AS worst_severity
  FROM      pest_agg  pa
  JOIN      pests     p  ON p.id       = pa.pest_id
  LEFT JOIN lw_agg    lw ON lw.pest_id = pa.pest_id
  JOIN      worst     w  ON w.pest_id  = pa.pest_id
  ORDER BY pa.red_orchards DESC, pa.yellow_orchards DESC, pa.tw_total_count DESC;
$$;

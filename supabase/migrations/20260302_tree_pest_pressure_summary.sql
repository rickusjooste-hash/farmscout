-- Tree pest pressure summary RPC for dashboard panel
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_tree_pest_pressure_summary(p_farm_ids uuid[])
RETURNS TABLE(
  pest_id            uuid,
  pest_name          text,
  this_week_total    bigint,
  last_week_total    bigint,
  orchards_affected  bigint,
  worst_orchard_id   uuid,
  worst_orchard_name text,
  worst_count        bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH date_bounds AS (
    SELECT
      date_trunc('week', now())                     AS this_start,
      date_trunc('week', now()) - interval '1 week' AS last_start
  ),
  orchard_scope AS (
    SELECT id, name FROM orchards
    WHERE  farm_id = ANY(p_farm_ids) AND is_active = true
  ),
  this_week_obs AS (
    SELECT
      o.pest_id,
      os.id   AS orchard_id,
      os.name AS orchard_name,
      SUM(o.count) AS total
    FROM inspection_observations o
    JOIN inspection_trees      it ON it.id  = o.tree_id
    JOIN inspection_sessions   s  ON s.id   = it.session_id
    JOIN orchard_scope         os ON os.id  = s.orchard_id
    WHERE s.inspected_at >= (SELECT this_start FROM date_bounds)
      AND o.count > 0
    GROUP BY o.pest_id, os.id, os.name
  ),
  last_week_obs AS (
    SELECT o.pest_id, SUM(o.count) AS total
    FROM inspection_observations o
    JOIN inspection_trees      it ON it.id  = o.tree_id
    JOIN inspection_sessions   s  ON s.id   = it.session_id
    JOIN orchard_scope         os ON os.id  = s.orchard_id
    WHERE s.inspected_at >= (SELECT last_start  FROM date_bounds)
      AND s.inspected_at <  (SELECT this_start  FROM date_bounds)
      AND o.count > 0
    GROUP BY o.pest_id
  ),
  worst AS (
    SELECT DISTINCT ON (pest_id)
      pest_id,
      orchard_id   AS worst_orchard_id,
      orchard_name AS worst_orchard_name,
      total        AS worst_count
    FROM   this_week_obs
    ORDER BY pest_id, total DESC
  )
  SELECT
    tw.pest_id,
    p.name                        AS pest_name,
    SUM(tw.total)                 AS this_week_total,
    COALESCE(lw.total, 0)         AS last_week_total,
    COUNT(DISTINCT tw.orchard_id) AS orchards_affected,
    w.worst_orchard_id,
    w.worst_orchard_name,
    w.worst_count
  FROM      this_week_obs tw
  JOIN      pests          p  ON p.id       = tw.pest_id
  LEFT JOIN last_week_obs  lw ON lw.pest_id = tw.pest_id
  JOIN      worst          w  ON w.pest_id  = tw.pest_id
  GROUP BY tw.pest_id, p.name, lw.total, w.worst_orchard_id, w.worst_orchard_name, w.worst_count
  ORDER BY this_week_total DESC;
$$;

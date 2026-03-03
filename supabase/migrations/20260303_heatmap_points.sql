-- GPS heat-map point RPCs
-- Run in Supabase SQL Editor

-- Individual tree inspection GPS points for a pest/week
-- Returns one row per inspected tree that had pest count > 0
CREATE OR REPLACE FUNCTION get_tree_inspection_points(
  p_farm_ids    uuid[],
  p_pest_id     uuid,
  p_week_start  timestamptz,
  p_week_end    timestamptz
)
RETURNS TABLE(lat double precision, lng double precision, count integer)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ST_Y(it.location::geometry)  AS lat,
    ST_X(it.location::geometry)  AS lng,
    obs.count::integer            AS count
  FROM inspection_sessions s
  JOIN inspection_trees        it  ON it.session_id = s.id
  JOIN inspection_observations obs ON obs.tree_id   = it.id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND obs.pest_id  = p_pest_id
    AND s.inspected_at >= p_week_start
    AND s.inspected_at <  p_week_end
    AND it.location IS NOT NULL
    AND obs.count > 0;
$$;

-- Per-trap GPS points (aggregated over the week) for a pest
-- Returns one row per trap that had at least one non-zero catch
CREATE OR REPLACE FUNCTION get_trap_intensity_points(
  p_farm_ids    uuid[],
  p_pest_id     uuid,
  p_week_start  timestamptz,
  p_week_end    timestamptz
)
RETURNS TABLE(lat double precision, lng double precision, count integer)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ST_Y(t.location::geometry)  AS lat,
    ST_X(t.location::geometry)  AS lng,
    SUM(tc.count)::integer       AS count
  FROM trap_inspections ti
  JOIN traps      t  ON t.id             = ti.trap_id
  JOIN trap_counts tc ON tc.inspection_id = ti.id
  WHERE t.farm_id = ANY(p_farm_ids)
    AND tc.pest_id  = p_pest_id
    AND ti.inspected_at >= p_week_start
    AND ti.inspected_at <  p_week_end
    AND t.location IS NOT NULL
  GROUP BY t.id, t.location
  HAVING SUM(tc.count) > 0;
$$;

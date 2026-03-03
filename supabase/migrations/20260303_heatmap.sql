-- Heatmap: per-orchard tree intensity for a given pest + week window
-- Used by /heatmap page in tree mode (parameterised week, unlike get_tree_orchard_severity)

CREATE OR REPLACE FUNCTION get_tree_orchard_intensity(
  p_farm_ids    uuid[],
  p_pest_id     uuid,
  p_week_start  timestamptz,
  p_week_end    timestamptz
)
RETURNS TABLE(orchard_id uuid, trees_inspected bigint, trees_affected bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT s.orchard_id,
    COUNT(DISTINCT it.id)                               AS trees_inspected,
    COUNT(DISTINCT it.id) FILTER (WHERE obs.count > 0) AS trees_affected
  FROM inspection_sessions s
  JOIN inspection_trees  it  ON it.session_id = s.id
  JOIN inspection_observations obs ON obs.tree_id = it.id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND obs.pest_id = p_pest_id
    AND s.inspected_at >= p_week_start
    AND s.inspected_at <  p_week_end
  GROUP BY s.orchard_id;
$$;

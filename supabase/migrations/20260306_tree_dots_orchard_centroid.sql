-- Update get_tree_inspection_dots to return orchard centroid as fallback for trees without GPS.
-- New columns: orchard_lat, orchard_lng (always populated from orchard.location or boundary centroid).
CREATE OR REPLACE FUNCTION get_tree_inspection_dots(
  p_farm_ids   uuid[],
  p_week_start timestamptz,
  p_week_end   timestamptz
)
RETURNS TABLE (
  tree_id      uuid,
  session_id   uuid,
  tree_nr      integer,
  lat          double precision,
  lng          double precision,
  has_location boolean,
  inspected_at timestamptz,
  comments     text,
  image_url    text,
  orchard_id   uuid,
  orchard_name text,
  zone_name    text,
  scout_id     uuid,
  scout_name   text,
  total_count  bigint,
  pest_count   bigint,
  orchard_lat  double precision,
  orchard_lng  double precision
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    it.id,
    it.session_id,
    it.tree_nr,
    CASE WHEN it.location IS NOT NULL THEN ST_Y(it.location::geometry) END,
    CASE WHEN it.location IS NOT NULL THEN ST_X(it.location::geometry) END,
    it.location IS NOT NULL,
    COALESCE(it.inspected_at, s.inspected_at),
    it.comments,
    it.image_url,
    o.id,
    o.name,
    COALESCE(z.name, z.zone_letter, '—'),
    sc.user_id,
    sc.full_name,
    COALESCE(SUM(obs.count), 0),
    COUNT(*) FILTER (WHERE obs.count > 0),
    -- Orchard centroid: prefer location column, fall back to boundary centroid
    CASE
      WHEN o.location IS NOT NULL THEN ST_Y(o.location::geometry)
      WHEN o.boundary IS NOT NULL THEN ST_Y(ST_Centroid(o.boundary::geometry))
    END,
    CASE
      WHEN o.location IS NOT NULL THEN ST_X(o.location::geometry)
      WHEN o.boundary IS NOT NULL THEN ST_X(ST_Centroid(o.boundary::geometry))
    END
  FROM inspection_trees      it
  JOIN inspection_sessions   s   ON s.id = it.session_id
  JOIN orchards              o   ON o.id = s.orchard_id
  LEFT JOIN zones            z   ON z.id = s.zone_id
  LEFT JOIN scouts           sc  ON sc.user_id = s.scout_id
  LEFT JOIN inspection_observations obs ON obs.tree_id = it.id
  WHERE o.farm_id = ANY(p_farm_ids)
    AND s.inspected_at >= p_week_start
    AND s.inspected_at <  p_week_end
  GROUP BY
    it.id, it.session_id, it.tree_nr, it.location,
    it.inspected_at, s.inspected_at, it.comments, it.image_url,
    o.id, o.name, o.location, o.boundary,
    z.name, z.zone_letter, sc.user_id, sc.full_name
  ORDER BY s.inspected_at DESC, it.tree_nr;
$$;

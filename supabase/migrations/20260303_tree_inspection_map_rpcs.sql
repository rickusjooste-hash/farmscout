-- RPC 1: All tree inspection dots for a week + farm scope
-- lat/lng extracted here because PostgREST returns PostGIS as WKB binary (not parseable client-side)
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
  pest_count   bigint
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
    COUNT(*) FILTER (WHERE obs.count > 0)
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
    o.id, o.name, z.name, z.zone_letter, sc.user_id, sc.full_name
  ORDER BY s.inspected_at DESC, it.tree_nr;
$$;

-- RPC 2: Observation detail for one tree (lazy-loaded on dot click)
CREATE OR REPLACE FUNCTION get_tree_inspection_detail(p_tree_id uuid)
RETURNS TABLE (
  pest_id            uuid,
  pest_name          text,
  scientific_name    text,
  count              integer,
  severity           text,
  observation_method text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    obs.pest_id,
    p.name,
    p.scientific_name,
    obs.count,
    obs.severity,
    cp.observation_method::text
  FROM inspection_observations obs
  JOIN pests p ON p.id = obs.pest_id
  LEFT JOIN inspection_trees    it ON it.id = obs.tree_id
  LEFT JOIN inspection_sessions s  ON s.id  = it.session_id
  LEFT JOIN orchards            o  ON o.id  = s.orchard_id
  LEFT JOIN commodity_pests     cp ON cp.pest_id = obs.pest_id
                                  AND cp.commodity_id = o.commodity_id
  WHERE obs.tree_id = p_tree_id
  ORDER BY obs.count DESC NULLS LAST;
$$;

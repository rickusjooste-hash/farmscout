-- Robust GPS → orchard matching.
-- 1. Try ST_Contains (point inside polygon) — exact match
-- 2. Fall back to ST_DWithin 50m — nearest orchard if standing at edge/road
-- Handles both geometry and geography boundary types via explicit cast.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION match_orchard_from_gps(
  p_lat     double precision,
  p_lng     double precision,
  p_farm_id uuid
)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  WITH point AS (
    SELECT ST_SetSRID(ST_Point(p_lng, p_lat), 4326) AS geom
  ),
  -- First try: point inside boundary polygon
  exact AS (
    SELECT o.id, o.name
    FROM orchards o, point p
    WHERE o.farm_id = p_farm_id
      AND o.is_active
      AND o.boundary IS NOT NULL
      AND ST_Contains(o.boundary::geometry, p.geom)
    LIMIT 1
  ),
  -- Fallback: nearest orchard within 50 metres
  nearest AS (
    SELECT o.id, o.name
    FROM orchards o, point p
    WHERE o.farm_id = p_farm_id
      AND o.is_active
      AND o.boundary IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM exact)
      AND ST_DWithin(o.boundary::geography, ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography, 50)
    ORDER BY ST_Distance(o.boundary::geography, ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography)
    LIMIT 1
  )
  SELECT json_build_object('id', id, 'name', name)
  FROM (
    SELECT * FROM exact
    UNION ALL
    SELECT * FROM nearest
  ) matched
  LIMIT 1;
$$;

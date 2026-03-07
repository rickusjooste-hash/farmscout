-- Returns orchards within p_radius metres of a GPS point, sorted by distance.
-- Falls back from boundary-based distance to centroid-based distance.
CREATE OR REPLACE FUNCTION public.nearby_orchards_from_gps(
  p_lat double precision,
  p_lng double precision,
  p_farm_id uuid,
  p_radius double precision DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  name text,
  distance_m double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.id,
    o.name,
    CASE
      WHEN o.boundary IS NOT NULL THEN
        ST_Distance(
          o.boundary::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )
      WHEN o.location IS NOT NULL THEN
        ST_Distance(
          o.location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )
      ELSE NULL
    END AS distance_m
  FROM public.orchards o
  WHERE o.farm_id = p_farm_id
    AND o.is_active = true
    AND (o.boundary IS NOT NULL OR o.location IS NOT NULL)
    AND CASE
      WHEN o.boundary IS NOT NULL THEN
        ST_DWithin(
          o.boundary::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius
        )
      WHEN o.location IS NOT NULL THEN
        ST_DWithin(
          o.location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius
        )
      ELSE false
    END
  ORDER BY distance_m ASC
  LIMIT 10;
$$;

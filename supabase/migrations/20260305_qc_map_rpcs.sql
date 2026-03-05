-- ============================================================
-- QC Map RPCs: bag dots, heat points, heat orchard aggregates
-- Run manually in the Supabase SQL Editor
-- ============================================================

-- ── RPC 1: get_qc_bag_dots ──────────────────────────────────────────────────
-- Returns one row per bag session with GPS + summary data for the map.

CREATE OR REPLACE FUNCTION get_qc_bag_dots(
  p_farm_ids uuid[],
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS TABLE(
  session_id    uuid,
  bag_seq       integer,
  lat           numeric,
  lng           numeric,
  has_location  boolean,
  collected_at  timestamptz,
  sampled_at    timestamptz,
  orchard_id    uuid,
  orchard_name  text,
  employee_name text,
  fruit_count   bigint,
  issue_count   bigint,
  status        text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    s.id                                      AS session_id,
    s.bag_seq,
    s.collection_lat                          AS lat,
    s.collection_lng                          AS lng,
    (s.collection_lat IS NOT NULL
     AND s.collection_lng IS NOT NULL)        AS has_location,
    s.collected_at,
    s.sampled_at,
    o.id                                      AS orchard_id,
    o.name                                    AS orchard_name,
    e.full_name                               AS employee_name,
    COALESCE(fc.cnt, 0)::bigint               AS fruit_count,
    COALESCE(ic.cnt, 0)::bigint               AS issue_count,
    s.status
  FROM qc_bag_sessions s
  JOIN orchards o ON o.id = s.orchard_id
  JOIN qc_employees e ON e.id = s.employee_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS cnt FROM qc_fruit f WHERE f.session_id = s.id
  ) fc ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(bi.count), 0)::bigint AS cnt
    FROM qc_bag_issues bi WHERE bi.session_id = s.id AND bi.count > 0
  ) ic ON true
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
  ORDER BY s.collected_at DESC;
$$;


-- ── RPC 2: get_qc_heat_points ───────────────────────────────────────────────
-- Returns GPS lat/lng + issue count per bag for a specific pest/issue.
-- Used to render the heat layer.

CREATE OR REPLACE FUNCTION get_qc_heat_points(
  p_farm_ids uuid[],
  p_pest_id  uuid,
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS TABLE(
  lat   numeric,
  lng   numeric,
  count bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    s.collection_lat  AS lat,
    s.collection_lng  AS lng,
    bi.count::bigint  AS count
  FROM qc_bag_issues bi
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND bi.pest_id = p_pest_id
    AND bi.count > 0
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
    AND s.collection_lat IS NOT NULL
    AND s.collection_lng IS NOT NULL;
$$;


-- ── RPC 3: get_qc_heat_orchard_agg ──────────────────────────────────────────
-- Returns per-orchard total count for a specific pest/issue in the period.
-- Used for orchard polygon tooltips on the heatmap.

CREATE OR REPLACE FUNCTION get_qc_heat_orchard_agg(
  p_farm_ids uuid[],
  p_pest_id  uuid,
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS TABLE(
  orchard_id   uuid,
  orchard_name text,
  total_count  bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    o.id                         AS orchard_id,
    o.name                       AS orchard_name,
    SUM(bi.count)::bigint        AS total_count
  FROM qc_bag_issues bi
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  JOIN orchards o ON o.id = s.orchard_id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND bi.pest_id = p_pest_id
    AND bi.count > 0
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
  GROUP BY o.id, o.name
  ORDER BY total_count DESC;
$$;

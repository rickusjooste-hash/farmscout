-- ============================================================
-- QC Phase 2: Dashboard RPCs
-- Run manually in the Supabase SQL Editor
-- ============================================================

-- ── RPC 1: get_qc_dashboard_kpis ────────────────────────────────────────────
-- Returns a single JSON object with KPI numbers for the period.

CREATE OR REPLACE FUNCTION get_qc_dashboard_kpis(
  p_farm_ids uuid[],
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  WITH sessions AS (
    SELECT s.id, s.status
    FROM qc_bag_sessions s
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
  ),
  fruit_agg AS (
    SELECT
      COUNT(*)::int       AS fruit_weighed,
      ROUND(AVG(f.weight_g))::int AS avg_weight_g
    FROM qc_fruit f
    JOIN sessions s ON s.id = f.session_id
  ),
  issue_bags AS (
    SELECT COUNT(DISTINCT bi.session_id)::int AS bags_with_issues
    FROM qc_bag_issues bi
    JOIN sessions s ON s.id = bi.session_id
    WHERE s.status = 'sampled' AND bi.count > 0
  ),
  kpis AS (
    SELECT
      COUNT(*)::int                                    AS bags_collected,
      COUNT(*) FILTER (WHERE status = 'sampled')::int  AS bags_sampled
    FROM sessions
  )
  SELECT json_build_object(
    'bags_collected',  k.bags_collected,
    'bags_sampled',    k.bags_sampled,
    'fruit_weighed',   COALESCE(fa.fruit_weighed,  0),
    'avg_weight_g',    COALESCE(fa.avg_weight_g,   0),
    'issue_rate_pct',  CASE
                         WHEN k.bags_sampled > 0
                         THEN ROUND(ib.bags_with_issues::numeric / k.bags_sampled * 100)
                         ELSE 0
                       END
  )
  FROM kpis k, fruit_agg fa, issue_bags ib;
$$;


-- ── RPC 2: get_qc_size_distribution ─────────────────────────────────────────
-- Returns rows (bin_label, display_order, fruit_count) sorted by display_order.
-- Includes an 'Out of spec' row for unmatched fruit.

CREATE OR REPLACE FUNCTION get_qc_size_distribution(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL
)
RETURNS TABLE(
  bin_label     text,
  display_order integer,
  fruit_count   bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(sb.label, 'Out of spec') AS bin_label,
    COALESCE(sb.display_order, 9999)  AS display_order,
    COUNT(f.id)::bigint               AS fruit_count
  FROM qc_fruit f
  JOIN qc_bag_sessions s ON s.id = f.session_id
  JOIN orchards o ON o.id = s.orchard_id
  LEFT JOIN size_bins sb ON sb.id = f.size_bin_id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
    AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
  GROUP BY sb.label, sb.display_order
  ORDER BY COALESCE(sb.display_order, 9999);
$$;


-- ── RPC 3: get_qc_issue_breakdown ───────────────────────────────────────────
-- Returns (pest_id, pest_name, pest_name_af, category, total_count, bags_affected)
-- sorted by total_count DESC. Top 15 results.

CREATE OR REPLACE FUNCTION get_qc_issue_breakdown(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL
)
RETURNS TABLE(
  pest_id       uuid,
  pest_name     text,
  pest_name_af  text,
  category      text,
  total_count   bigint,
  bags_affected bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.id                                                  AS pest_id,
    COALESCE(cp.display_name,    p.name)                  AS pest_name,
    COALESCE(cp.display_name_af, p.name_af, p.name)       AS pest_name_af,
    cp.category::text,
    SUM(bi.count)::bigint                                 AS total_count,
    COUNT(DISTINCT bi.session_id)::bigint                 AS bags_affected
  FROM qc_bag_issues bi
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  JOIN orchards o ON o.id = s.orchard_id
  JOIN pests p ON p.id = bi.pest_id
  JOIN commodity_pests cp
    ON cp.pest_id = bi.pest_id
   AND cp.commodity_id = o.commodity_id
   AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
    AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
    AND bi.count > 0
  GROUP BY p.id, pest_name, pest_name_af, cp.category
  ORDER BY total_count DESC
  LIMIT 15;
$$;


-- ── RPC 4: get_qc_bag_list ───────────────────────────────────────────────────
-- One row per session: summary data for the bag list table.

CREATE OR REPLACE FUNCTION get_qc_bag_list(
  p_farm_ids uuid[],
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS TABLE(
  session_id     uuid,
  bag_seq        integer,
  collected_at   timestamptz,
  orchard_name   text,
  commodity_name text,
  commodity_id   uuid,
  employee_name  text,
  fruit_count    bigint,
  avg_weight_g   integer,
  issue_count    bigint,
  status         text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    s.id                             AS session_id,
    s.bag_seq,
    s.collected_at,
    o.name                           AS orchard_name,
    c.name                           AS commodity_name,
    c.id                             AS commodity_id,
    e.full_name                      AS employee_name,
    COUNT(DISTINCT f.id)::bigint     AS fruit_count,
    ROUND(AVG(f.weight_g))::integer  AS avg_weight_g,
    COALESCE(SUM(bi.count), 0)::bigint AS issue_count,
    s.status
  FROM qc_bag_sessions s
  JOIN orchards o ON o.id = s.orchard_id
  JOIN commodities c ON c.id = o.commodity_id
  JOIN qc_employees e ON e.id = s.employee_id
  LEFT JOIN qc_fruit f ON f.session_id = s.id
  LEFT JOIN qc_bag_issues bi ON bi.session_id = s.id
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
  GROUP BY s.id, s.bag_seq, s.collected_at, o.name, c.name, c.id, e.full_name, s.status
  ORDER BY s.collected_at DESC
  LIMIT 200;
$$;


-- ── RPC 5: get_qc_bag_detail ─────────────────────────────────────────────────
-- Full detail for a single bag session — session header + fruit array + issues array.

CREATE OR REPLACE FUNCTION get_qc_bag_detail(p_session_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'session', (
      SELECT json_build_object(
        'id',             s.id,
        'orchard_name',   o.name,
        'employee_name',  e.full_name,
        'collected_at',   s.collected_at,
        'sampled_at',     s.sampled_at,
        'bag_seq',        s.bag_seq,
        'collection_lat', s.collection_lat,
        'collection_lng', s.collection_lng,
        'status',         s.status
      )
      FROM qc_bag_sessions s
      JOIN orchards o ON o.id = s.orchard_id
      JOIN qc_employees e ON e.id = s.employee_id
      WHERE s.id = p_session_id
    ),
    'fruit', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'seq',       f.seq,
          'weight_g',  f.weight_g,
          'bin_label', sb.label
        ) ORDER BY f.seq
      ), '[]'::json)
      FROM qc_fruit f
      LEFT JOIN size_bins sb ON sb.id = f.size_bin_id
      WHERE f.session_id = p_session_id
    ),
    'issues', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'pest_name',      COALESCE(cp.display_name,    p.name),
          'pest_name_af',   COALESCE(cp.display_name_af, p.name_af, p.name),
          'category',       cp.category::text,
          'count',          bi.count
        ) ORDER BY bi.count DESC
      ), '[]'::json)
      FROM qc_bag_issues bi
      JOIN pests p ON p.id = bi.pest_id
      JOIN qc_bag_sessions s ON s.id = bi.session_id
      JOIN orchards o ON o.id = s.orchard_id
      LEFT JOIN commodity_pests cp
        ON cp.pest_id = bi.pest_id
       AND cp.commodity_id = o.commodity_id
       AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
      WHERE bi.session_id = p_session_id
        AND bi.count > 0
    )
  );
$$;

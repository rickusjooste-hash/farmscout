-- ============================================================
-- Add p_orchard_id filter to all QC dashboard RPCs.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Must drop first because we're changing signatures (adding a parameter)

-- ── 1. get_qc_dashboard_kpis ──────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_dashboard_kpis(uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_qc_dashboard_kpis(
  p_farm_ids   uuid[],
  p_from       timestamptz,
  p_to         timestamptz,
  p_orchard_id uuid DEFAULT NULL
)
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  WITH sessions AS (
    SELECT s.id, s.status,
           EXISTS (SELECT 1 FROM qc_fruit f WHERE f.session_id = s.id) AS has_fruit
    FROM qc_bag_sessions s
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
  ),
  fruit_agg AS (
    SELECT
      COUNT(*)::int           AS fruit_weighed,
      ROUND(AVG(f.weight_g))::int AS avg_weight_g
    FROM qc_fruit f
    JOIN sessions s ON s.id = f.session_id
  ),
  kpis AS (
    SELECT
      COUNT(*)::int                                                  AS bags_collected,
      COUNT(*) FILTER (WHERE status = 'sampled' OR has_fruit)::int   AS bags_sampled
    FROM sessions
  ),
  issue_bags AS (
    SELECT COUNT(DISTINCT bi.session_id)::int AS bags_with_issues
    FROM qc_bag_issues bi
    JOIN sessions s ON s.id = bi.session_id
    WHERE (s.status = 'sampled' OR s.has_fruit) AND bi.count > 0
  ),
  fruit_per_bag AS (
    SELECT f.session_id, COUNT(*)::int AS fruit_count
    FROM qc_fruit f
    JOIN sessions s ON s.id = f.session_id AND (s.status = 'sampled' OR s.has_fruit)
    GROUP BY f.session_id
  ),
  issues_per_bag AS (
    SELECT bi.session_id, SUM(bi.count)::int AS issue_count
    FROM qc_bag_issues bi
    JOIN sessions s ON s.id = bi.session_id AND (s.status = 'sampled' OR s.has_fruit)
    GROUP BY bi.session_id
  ),
  bag_counts AS (
    SELECT
      fp.session_id,
      fp.fruit_count,
      COALESCE(ip.issue_count, 0) AS issue_count
    FROM fruit_per_bag fp
    LEFT JOIN issues_per_bag ip ON ip.session_id = fp.session_id
  ),
  class1 AS (
    SELECT
      SUM(fruit_count)::int                                     AS total_fruit,
      SUM(GREATEST(0, fruit_count - issue_count))::int          AS class1_fruit
    FROM bag_counts
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
                       END,
    'class_1_pct',     CASE
                         WHEN c.total_fruit > 0
                         THEN ROUND(c.class1_fruit::numeric / c.total_fruit * 100, 1)
                         ELSE 0
                       END
  )
  FROM kpis k, fruit_agg fa, issue_bags ib, class1 c;
$$;


-- ── 2. get_qc_size_distribution ───────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_size_distribution(uuid[], timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION get_qc_size_distribution(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL
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
    AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
  GROUP BY sb.label, sb.display_order
  ORDER BY COALESCE(sb.display_order, 9999);
$$;


-- ── 3. get_qc_issue_breakdown ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_issue_breakdown(uuid[], timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION get_qc_issue_breakdown(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL
)
RETURNS TABLE(
  pest_id        uuid,
  pest_name      text,
  pest_name_af   text,
  category       text,
  total_count    bigint,
  bags_affected  bigint,
  pct_of_fruit   numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH total_fruit AS (
    SELECT COUNT(*)::numeric AS cnt
    FROM qc_fruit f
    JOIN qc_bag_sessions s ON s.id = f.session_id
    JOIN orchards o ON o.id = s.orchard_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
      AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
  )
  SELECT
    p.id                                                  AS pest_id,
    COALESCE(cp.display_name,    p.name)                  AS pest_name,
    COALESCE(cp.display_name_af, p.name_af, p.name)       AS pest_name_af,
    cp.category::text,
    SUM(bi.count)::bigint                                 AS total_count,
    COUNT(DISTINCT bi.session_id)::bigint                 AS bags_affected,
    CASE
      WHEN tf.cnt > 0
      THEN ROUND(SUM(bi.count)::numeric / tf.cnt * 100, 1)
      ELSE 0
    END                                                   AS pct_of_fruit
  FROM qc_bag_issues bi
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  JOIN orchards o ON o.id = s.orchard_id
  JOIN pests p ON p.id = bi.pest_id
  JOIN commodity_pests cp
    ON cp.pest_id = bi.pest_id
   AND cp.commodity_id = o.commodity_id
   AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
  CROSS JOIN total_fruit tf
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
    AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
    AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
    AND bi.count > 0
  GROUP BY p.id, pest_name, pest_name_af, cp.category, tf.cnt
  ORDER BY total_count DESC
  LIMIT 15;
$$;


-- ── 4. get_qc_bag_list ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_bag_list(uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_qc_bag_list(
  p_farm_ids   uuid[],
  p_from       timestamptz,
  p_to         timestamptz,
  p_orchard_id uuid DEFAULT NULL
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
    AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
  GROUP BY s.id, s.bag_seq, s.collected_at, o.name, c.name, c.id, e.full_name, s.status
  ORDER BY s.collected_at DESC
  LIMIT 200;
$$;


-- ── 5. get_qc_picker_issue_breakdown ──────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_picker_issue_breakdown(uuid[], timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_qc_picker_issue_breakdown(
  p_farm_ids   uuid[],
  p_from       timestamptz,
  p_to         timestamptz,
  p_orchard_id uuid DEFAULT NULL
)
RETURNS TABLE(
  employee_name  text,
  pest_id        uuid,
  pest_name      text,
  category       text,
  total_count    bigint,
  bags_affected  bigint,
  fruit_sampled  bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH fruit_per_picker AS (
    SELECT e.full_name AS employee_name, COUNT(f.id)::bigint AS fruit_sampled
    FROM qc_fruit f
    JOIN qc_bag_sessions s ON s.id = f.session_id
    JOIN qc_employees e ON e.id = s.employee_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
    GROUP BY e.full_name
  )
  SELECT
    e.full_name                               AS employee_name,
    p.id                                      AS pest_id,
    COALESCE(cp.display_name, p.name)         AS pest_name,
    cp.category::text,
    SUM(bi.count)::bigint                     AS total_count,
    COUNT(DISTINCT bi.session_id)::bigint     AS bags_affected,
    COALESCE(fpp.fruit_sampled, 0)            AS fruit_sampled
  FROM qc_bag_issues bi
  JOIN qc_bag_sessions s ON s.id = bi.session_id
  JOIN qc_employees e ON e.id = s.employee_id
  JOIN orchards o ON o.id = s.orchard_id
  JOIN pests p ON p.id = bi.pest_id
  JOIN commodity_pests cp
    ON cp.pest_id = bi.pest_id
   AND cp.commodity_id = o.commodity_id
   AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
  LEFT JOIN fruit_per_picker fpp ON fpp.employee_name = e.full_name
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.collected_at >= p_from
    AND s.collected_at < p_to
    AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
    AND bi.count > 0
  GROUP BY e.full_name, p.id, pest_name, cp.category, fpp.fruit_sampled
  ORDER BY total_count DESC;
$$;

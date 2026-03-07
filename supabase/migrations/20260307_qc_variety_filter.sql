-- ============================================================
-- Add p_variety filter to all QC dashboard RPCs.
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. get_qc_dashboard_kpis ──────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_dashboard_kpis(uuid[], timestamptz, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION get_qc_dashboard_kpis(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL,
  p_variety      text DEFAULT NULL
)
RETURNS json LANGUAGE sql SECURITY DEFINER SET statement_timeout = '60s' AS $$
  WITH scoped_sessions AS (
    SELECT s.id, s.status
    FROM qc_bag_sessions s
    JOIN orchards o ON o.id = s.orchard_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
      AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
      AND (p_variety IS NULL OR o.variety = p_variety)
  ),
  fruit_per_session AS (
    SELECT f.session_id,
           COUNT(*)::int AS fruit_count,
           ROUND(AVG(f.weight_g))::int AS avg_weight
    FROM qc_fruit f
    WHERE f.session_id IN (SELECT id FROM scoped_sessions)
    GROUP BY f.session_id
  ),
  issues_per_session AS (
    SELECT bi.session_id, SUM(bi.count)::int AS issue_count
    FROM qc_bag_issues bi
    WHERE bi.session_id IN (SELECT id FROM scoped_sessions)
      AND bi.count > 0
    GROUP BY bi.session_id
  ),
  combined AS (
    SELECT
      ss.id,
      ss.status,
      COALESCE(fps.fruit_count, 0) AS fruit_count,
      COALESCE(fps.avg_weight, 0)  AS avg_weight,
      COALESCE(ips.issue_count, 0) AS issue_count,
      (fps.fruit_count IS NOT NULL) AS has_fruit
    FROM scoped_sessions ss
    LEFT JOIN fruit_per_session fps ON fps.session_id = ss.id
    LEFT JOIN issues_per_session ips ON ips.session_id = ss.id
  ),
  sampled AS (
    SELECT * FROM combined WHERE status = 'sampled' OR has_fruit
  )
  SELECT json_build_object(
    'bags_collected',  (SELECT COUNT(*)::int FROM combined),
    'bags_sampled',    (SELECT COUNT(*)::int FROM sampled),
    'fruit_weighed',   COALESCE((SELECT SUM(fruit_count)::int FROM sampled), 0),
    'avg_weight_g',    COALESCE((SELECT ROUND(AVG(avg_weight))::int FROM sampled WHERE fruit_count > 0), 0),
    'issue_rate_pct',  CASE
                         WHEN (SELECT COUNT(*) FROM sampled) > 0
                         THEN ROUND((SELECT COUNT(*) FROM sampled WHERE issue_count > 0)::numeric
                                    / (SELECT COUNT(*) FROM sampled) * 100)
                         ELSE 0
                       END,
    'class_1_pct',     CASE
                         WHEN COALESCE((SELECT SUM(fruit_count) FROM sampled), 0) > 0
                         THEN ROUND(
                           (SELECT SUM(GREATEST(0, fruit_count - issue_count))::numeric FROM sampled)
                           / (SELECT SUM(fruit_count)::numeric FROM sampled) * 100, 1)
                         ELSE 0
                       END
  );
$$;


-- ── 2. get_qc_issue_breakdown ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_issue_breakdown(uuid[], timestamptz, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION get_qc_issue_breakdown(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL,
  p_variety      text DEFAULT NULL
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
LANGUAGE sql SECURITY DEFINER SET statement_timeout = '60s' AS $$
  SELECT
    p.id                                                  AS pest_id,
    COALESCE(cp.display_name,    p.name)                  AS pest_name,
    COALESCE(cp.display_name_af, p.name_af, p.name)       AS pest_name_af,
    cp.category::text,
    SUM(bi.count)::bigint                                 AS total_count,
    COUNT(DISTINCT bi.session_id)::bigint                 AS bags_affected,
    ROUND(
      SUM(bi.count)::numeric * 100.0
      / NULLIF(SUM(SUM(bi.count)::numeric) OVER (), 0),
    1)                                                    AS pct_of_fruit
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
    AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
    AND (p_variety IS NULL OR o.variety = p_variety)
    AND bi.count > 0
  GROUP BY p.id, pest_name, pest_name_af, cp.category
  ORDER BY total_count DESC
  LIMIT 15;
$$;


-- ── 3. get_qc_bag_list ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_bag_list(uuid[], timestamptz, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION get_qc_bag_list(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL,
  p_variety      text DEFAULT NULL
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
LANGUAGE sql SECURITY DEFINER SET statement_timeout = '60s' AS $$
  WITH recent_sessions AS (
    SELECT s.id, s.bag_seq, s.collected_at, s.orchard_id, s.employee_id, s.status
    FROM qc_bag_sessions s
    JOIN orchards o ON o.id = s.orchard_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
      AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
      AND (p_variety IS NULL OR o.variety = p_variety)
    ORDER BY s.collected_at DESC
    LIMIT 200
  ),
  fruit_agg AS (
    SELECT f.session_id, COUNT(*)::bigint AS cnt, ROUND(AVG(f.weight_g))::integer AS avg_w
    FROM qc_fruit f
    WHERE f.session_id IN (SELECT id FROM recent_sessions)
    GROUP BY f.session_id
  ),
  issue_agg AS (
    SELECT bi.session_id, SUM(bi.count)::bigint AS cnt
    FROM qc_bag_issues bi
    WHERE bi.session_id IN (SELECT id FROM recent_sessions)
    GROUP BY bi.session_id
  )
  SELECT
    rs.id              AS session_id,
    rs.bag_seq,
    rs.collected_at,
    o.name             AS orchard_name,
    c.name             AS commodity_name,
    c.id               AS commodity_id,
    e.full_name        AS employee_name,
    COALESCE(fa.cnt, 0)  AS fruit_count,
    COALESCE(fa.avg_w, 0) AS avg_weight_g,
    COALESCE(ia.cnt, 0)  AS issue_count,
    rs.status
  FROM recent_sessions rs
  JOIN orchards o ON o.id = rs.orchard_id
  JOIN commodities c ON c.id = o.commodity_id
  JOIN qc_employees e ON e.id = rs.employee_id
  LEFT JOIN fruit_agg fa ON fa.session_id = rs.id
  LEFT JOIN issue_agg ia ON ia.session_id = rs.id
  ORDER BY rs.collected_at DESC;
$$;


-- ── 4. get_qc_size_distribution ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_size_distribution(uuid[], timestamptz, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION get_qc_size_distribution(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL,
  p_variety      text DEFAULT NULL
)
RETURNS TABLE(
  bin_label     text,
  display_order integer,
  fruit_count   bigint
)
LANGUAGE sql SECURITY DEFINER SET statement_timeout = '60s' AS $$
  WITH scoped_sessions AS (
    SELECT s.id
    FROM qc_bag_sessions s
    JOIN orchards o ON o.id = s.orchard_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
      AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
      AND (p_variety IS NULL OR o.variety = p_variety)
  )
  SELECT
    COALESCE(sb.label, 'Out of spec') AS bin_label,
    COALESCE(sb.display_order, 9999)  AS display_order,
    COUNT(f.id)::bigint               AS fruit_count
  FROM qc_fruit f
  JOIN scoped_sessions ss ON ss.id = f.session_id
  LEFT JOIN size_bins sb ON sb.id = f.size_bin_id
  GROUP BY sb.label, sb.display_order
  ORDER BY COALESCE(sb.display_order, 9999);
$$;


-- ── 5. get_qc_picker_issue_breakdown ────────────────────────────────────────

DROP FUNCTION IF EXISTS get_qc_picker_issue_breakdown(uuid[], timestamptz, timestamptz, uuid, uuid);

CREATE OR REPLACE FUNCTION get_qc_picker_issue_breakdown(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id   uuid DEFAULT NULL,
  p_variety      text DEFAULT NULL
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
LANGUAGE sql SECURITY DEFINER SET statement_timeout = '60s' AS $$
  WITH scoped_sessions AS (
    SELECT s.id, s.employee_id, s.orchard_id
    FROM qc_bag_sessions s
    JOIN orchards o ON o.id = s.orchard_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
      AND (p_orchard_id IS NULL OR s.orchard_id = p_orchard_id)
      AND (p_variety IS NULL OR o.variety = p_variety)
  ),
  fruit_per_picker AS (
    SELECT ss.employee_id, COUNT(f.id)::bigint AS fruit_sampled
    FROM qc_fruit f
    JOIN scoped_sessions ss ON ss.id = f.session_id
    GROUP BY ss.employee_id
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
  JOIN scoped_sessions ss ON ss.id = bi.session_id
  JOIN qc_employees e ON e.id = ss.employee_id
  JOIN orchards o ON o.id = ss.orchard_id
  JOIN pests p ON p.id = bi.pest_id
  JOIN commodity_pests cp
    ON cp.pest_id = bi.pest_id
   AND cp.commodity_id = o.commodity_id
   AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
  LEFT JOIN fruit_per_picker fpp ON fpp.employee_id = ss.employee_id
  WHERE bi.count > 0
  GROUP BY e.full_name, p.id, pest_name, cp.category, fpp.fruit_sampled
  ORDER BY total_count DESC;
$$;

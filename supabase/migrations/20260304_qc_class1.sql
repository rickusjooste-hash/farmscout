-- ============================================================
-- QC Phase 2: Class 1 rate + size distribution percentages
-- Run manually in the Supabase SQL Editor
-- ============================================================

-- ── Update get_qc_dashboard_kpis — adds class_1_pct ─────────────────────────
--
-- Class 1 rate = (total_fruit - total_issue_counts) / total_fruit × 100
--
-- Logic:
--   • Each entry in qc_bag_issues.count represents one affected fruit.
--   • Class 1 fruit = fruit that had no recorded issue.
--   • Clamped to 0 per bag (can't go negative if issue counts exceed fruit count).
--   • Only sampled bags are included (status = 'sampled').

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
      COUNT(*)::int           AS fruit_weighed,
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
  ),
  -- Per-bag fruit counts and issue counts aggregated separately,
  -- then joined — avoids a Cartesian product between qc_fruit and qc_bag_issues.
  fruit_per_bag AS (
    SELECT f.session_id, COUNT(*)::int AS fruit_count
    FROM qc_fruit f
    JOIN sessions s ON s.id = f.session_id AND s.status = 'sampled'
    GROUP BY f.session_id
  ),
  issues_per_bag AS (
    SELECT bi.session_id, SUM(bi.count)::int AS issue_count
    FROM qc_bag_issues bi
    JOIN sessions s ON s.id = bi.session_id AND s.status = 'sampled'
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


-- ── Update get_qc_size_distribution — adds pct_of_total ─────────────────────
-- Must drop first because the return type changes (new pct_of_total column).
DROP FUNCTION IF EXISTS get_qc_size_distribution(uuid[], timestamptz, timestamptz, uuid);
--
-- pct_of_total = this bin's fruit_count / grand total × 100 (1 decimal place)
-- Matches the Power BI bar chart which shows percentages per size.

CREATE OR REPLACE FUNCTION get_qc_size_distribution(
  p_farm_ids     uuid[],
  p_from         timestamptz,
  p_to           timestamptz,
  p_commodity_id uuid DEFAULT NULL
)
RETURNS TABLE(
  bin_label     text,
  display_order integer,
  fruit_count   bigint,
  pct_of_total  numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH binned AS (
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
  ),
  grand_total AS (
    SELECT SUM(fruit_count) AS total FROM binned
  )
  SELECT
    b.bin_label,
    b.display_order,
    b.fruit_count,
    CASE
      WHEN gt.total > 0
      THEN ROUND(b.fruit_count::numeric / gt.total * 100, 1)
      ELSE 0
    END AS pct_of_total
  FROM binned b, grand_total gt
  ORDER BY b.display_order;
$$;

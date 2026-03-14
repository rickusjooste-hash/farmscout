-- Per-orchard QC issue breakdown for Orchard Performance Intelligence.
-- Returns top 5 issues per orchard.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_qc_issues_by_orchard(
  p_farm_ids uuid[],
  p_from     timestamptz,
  p_to       timestamptz
)
RETURNS TABLE (
  orchard_id     uuid,
  pest_name      text,
  category       text,
  total_count    bigint,
  fruit_sampled  bigint,
  pct_of_fruit   numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH fruit_per_orchard AS (
    SELECT
      s.orchard_id,
      COUNT(*)::numeric AS cnt
    FROM qc_fruit f
    JOIN qc_bag_sessions s ON s.id = f.session_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
    GROUP BY s.orchard_id
  ),
  ranked AS (
    SELECT
      s.orchard_id,
      COALESCE(cp.display_name, p.name)   AS pest_name,
      cp.category::text,
      SUM(bi.count)::bigint               AS total_count,
      fpo.cnt::bigint                     AS fruit_sampled,
      CASE
        WHEN fpo.cnt > 0
        THEN ROUND(SUM(bi.count)::numeric / fpo.cnt * 100, 1)
        ELSE 0
      END                                 AS pct_of_fruit,
      ROW_NUMBER() OVER (
        PARTITION BY s.orchard_id
        ORDER BY SUM(bi.count) DESC
      ) AS rn
    FROM qc_bag_issues bi
    JOIN qc_bag_sessions s ON s.id = bi.session_id
    JOIN orchards o ON o.id = s.orchard_id
    JOIN pests p ON p.id = bi.pest_id
    JOIN commodity_pests cp
      ON cp.pest_id = bi.pest_id
     AND cp.commodity_id = o.commodity_id
     AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
    LEFT JOIN fruit_per_orchard fpo ON fpo.orchard_id = s.orchard_id
    WHERE s.farm_id = ANY(p_farm_ids)
      AND s.collected_at >= p_from
      AND s.collected_at < p_to
      AND bi.count > 0
    GROUP BY s.orchard_id, pest_name, cp.category, fpo.cnt
  )
  SELECT
    r.orchard_id,
    r.pest_name,
    r.category,
    r.total_count,
    r.fruit_sampled,
    r.pct_of_fruit
  FROM ranked r
  WHERE r.rn <= 5
  ORDER BY r.orchard_id, r.total_count DESC;
$$;

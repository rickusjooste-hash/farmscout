-- Production RPCs
-- Run in Supabase SQL Editor after the schema migration

-- ── get_production_summary ───────────────────────────────────────────────────
-- Per-orchard aggregation with bin weight cascade

CREATE OR REPLACE FUNCTION get_production_summary(
  p_farm_ids uuid[],
  p_season text,
  p_commodity_id uuid DEFAULT NULL
)
RETURNS TABLE (
  orchard_id    uuid,
  orchard_name  text,
  variety       text,
  ha            numeric,
  bins          numeric,
  juice         numeric,
  total         numeric,
  bin_weight_kg numeric,
  tons          numeric,
  ton_ha        numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH bin_data AS (
    SELECT
      pb.orchard_id,
      COALESCE(o.name, pb.orchard_name) AS orchard_name,
      COALESCE(o.variety, pb.variety) AS variety,
      o.ha,
      o.commodity_id,
      SUM(pb.bins)  AS bins,
      SUM(pb.juice) AS juice,
      SUM(pb.total) AS total
    FROM production_bins pb
    LEFT JOIN orchards o ON o.id = pb.orchard_id
    WHERE pb.farm_id = ANY(p_farm_ids)
      AND pb.season = p_season
      AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
    GROUP BY pb.orchard_id, o.name, pb.orchard_name, o.variety, pb.variety, o.ha, o.commodity_id
  ),
  bruising_weights AS (
    SELECT
      br.orchard_id,
      AVG(br.bin_weight_kg) FILTER (WHERE br.bin_weight_kg > 0) AS avg_weight
    FROM production_bruising br
    WHERE br.farm_id = ANY(p_farm_ids) AND br.season = p_season
    GROUP BY br.orchard_id
  ),
  org AS (
    SELECT organisation_id FROM farms WHERE id = p_farm_ids[1] LIMIT 1
  )
  SELECT
    bd.orchard_id,
    bd.orchard_name,
    bd.variety,
    bd.ha,
    bd.bins,
    bd.juice,
    bd.total,
    COALESCE(
      bw.avg_weight,
      fw1.default_weight_kg,
      fw2.default_weight_kg,
      400
    )::numeric AS bin_weight_kg,
    (bd.total * COALESCE(bw.avg_weight, fw1.default_weight_kg, fw2.default_weight_kg, 400) / 1000)::numeric(10,2) AS tons,
    CASE WHEN bd.ha > 0
      THEN (bd.total * COALESCE(bw.avg_weight, fw1.default_weight_kg, fw2.default_weight_kg, 400) / 1000 / bd.ha)::numeric(10,2)
      ELSE NULL
    END AS ton_ha
  FROM bin_data bd
  LEFT JOIN bruising_weights bw ON bw.orchard_id = bd.orchard_id
  LEFT JOIN production_bin_weights fw1
    ON fw1.organisation_id = (SELECT organisation_id FROM org)
    AND fw1.commodity_id = bd.commodity_id
    AND fw1.variety = bd.variety
  LEFT JOIN production_bin_weights fw2
    ON fw2.organisation_id = (SELECT organisation_id FROM org)
    AND fw2.commodity_id = bd.commodity_id
    AND fw2.variety IS NULL
  ORDER BY bd.total DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── get_production_bruising_summary ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_production_bruising_summary(
  p_farm_ids uuid[],
  p_season text,
  p_commodity_id uuid DEFAULT NULL
)
RETURNS TABLE (
  orchard_id       uuid,
  orchard_name     text,
  variety          text,
  samples          bigint,
  avg_bruising_pct numeric,
  avg_stem_pct     numeric,
  avg_injury_pct   numeric,
  avg_bin_weight   numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    br.orchard_id,
    COALESCE(o.name, br.orchard_name) AS orchard_name,
    COALESCE(o.variety, br.variety) AS variety,
    COUNT(*)::bigint AS samples,
    ROUND(AVG(br.bruising_pct), 2) AS avg_bruising_pct,
    ROUND(AVG(br.stem_pct), 2) AS avg_stem_pct,
    ROUND(AVG(br.injury_pct), 2) AS avg_injury_pct,
    ROUND(AVG(br.bin_weight_kg) FILTER (WHERE br.bin_weight_kg > 0), 1) AS avg_bin_weight
  FROM production_bruising br
  LEFT JOIN orchards o ON o.id = br.orchard_id
  WHERE br.farm_id = ANY(p_farm_ids)
    AND br.season = p_season
    AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
  GROUP BY br.orchard_id, o.name, br.orchard_name, o.variety, br.variety
  ORDER BY avg_bruising_pct DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── get_production_weekly_trend ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_production_weekly_trend(
  p_farm_ids uuid[],
  p_season text,
  p_commodity_id uuid DEFAULT NULL
)
RETURNS TABLE (
  week_num   integer,
  week_start date,
  bins       numeric,
  juice      numeric,
  total      numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pb.week_num,
    MIN(pb.received_date) AS week_start,
    SUM(pb.bins)  AS bins,
    SUM(pb.juice) AS juice,
    SUM(pb.total) AS total
  FROM production_bins pb
  LEFT JOIN orchards o ON o.id = pb.orchard_id
  WHERE pb.farm_id = ANY(p_farm_ids)
    AND pb.season = p_season
    AND pb.week_num IS NOT NULL
    AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
  GROUP BY pb.week_num
  ORDER BY pb.week_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── get_production_size_distribution ─────────────────────────────────────────
-- Links QC fruit data for size distribution

CREATE OR REPLACE FUNCTION get_production_size_distribution(
  p_farm_ids uuid[],
  p_season_start date,
  p_season_end date,
  p_commodity_id uuid DEFAULT NULL,
  p_orchard_id uuid DEFAULT NULL
)
RETURNS TABLE (
  label       text,
  fruit_count bigint,
  pct         numeric
) AS $$
DECLARE
  v_total bigint;
BEGIN
  CREATE TEMP TABLE _size_counts ON COMMIT DROP AS
  SELECT
    sb.label,
    sb.display_order,
    COUNT(*)::bigint AS cnt
  FROM qc_fruit qf
  JOIN qc_bag_sessions qbs ON qbs.id = qf.session_id
  JOIN size_bins sb ON sb.id = qf.size_bin_id
  WHERE qbs.farm_id = ANY(p_farm_ids)
    AND qbs.collected_at >= p_season_start
    AND qbs.collected_at < p_season_end
    AND (p_commodity_id IS NULL OR sb.commodity_id = p_commodity_id)
    AND (p_orchard_id IS NULL OR qbs.orchard_id = p_orchard_id)
  GROUP BY sb.label, sb.display_order;

  SELECT COALESCE(SUM(cnt), 0) INTO v_total FROM _size_counts;

  RETURN QUERY
  SELECT
    sc.label,
    sc.cnt AS fruit_count,
    CASE WHEN v_total > 0 THEN ROUND(sc.cnt * 100.0 / v_total, 1) ELSE 0 END AS pct
  FROM _size_counts sc
  ORDER BY sc.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

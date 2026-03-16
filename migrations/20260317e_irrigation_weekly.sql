-- ============================================================
-- Weekly irrigation given vs crop need for season chart
-- Returns per-week totals in m3/ha, optionally filtered to one orchard
-- ============================================================

DROP FUNCTION IF EXISTS public.get_irrigation_weekly(uuid[], uuid);
CREATE OR REPLACE FUNCTION public.get_irrigation_weekly(
  p_farm_ids uuid[],
  p_orchard_id uuid DEFAULT NULL
)
RETURNS TABLE (
  week_start date,
  week_label text,
  given_cubes_per_ha numeric,
  need_cubes_per_ha numeric,
  rainfall_mm numeric
) LANGUAGE sql STABLE AS $$
  WITH
  org AS (
    SELECT organisation_id FROM farms WHERE id = ANY(p_farm_ids) LIMIT 1
  ),
  season AS (
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 9
        THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 9, 1)
        ELSE make_date((EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int, 9, 1)
      END AS season_start
  ),

  -- Total ha for the orchards in scope (for aggregate m3/ha)
  orchard_ha AS (
    SELECT SUM(o.ha) AS total_ha
    FROM orchards o
    JOIN irrigation_events ie ON ie.orchard_id = o.id
    CROSS JOIN season s
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= s.season_start
      AND ie.orchard_id IS NOT NULL
      AND (p_orchard_id IS NULL OR ie.orchard_id = p_orchard_id)
    -- Use distinct orchards
  ),
  -- Actually need distinct orchard ha
  distinct_ha AS (
    SELECT COALESCE(SUM(ha), 1) AS total_ha
    FROM (
      SELECT DISTINCT o.id, o.ha
      FROM orchards o
      JOIN irrigation_events ie ON ie.orchard_id = o.id
      CROSS JOIN season s
      WHERE ie.farm_id = ANY(p_farm_ids)
        AND ie.event_date >= s.season_start
        AND ie.orchard_id IS NOT NULL
        AND (p_orchard_id IS NULL OR ie.orchard_id = p_orchard_id)
    ) sub
  ),

  -- Weekly irrigation aggregation
  weekly AS (
    SELECT
      date_trunc('week', ie.event_date)::date AS week_start,
      SUM(ie.volume_m3) AS total_volume_m3,
      -- Weighted need: sum(etc_mm * ha) * 10 / total_ha for aggregate
      -- For single orchard: sum(etc_mm) * 10 (ha cancels out)
      CASE
        WHEN p_orchard_id IS NOT NULL THEN
          SUM(COALESCE(ie.eto_mm, 0) * COALESCE(ie.kc, 1)) * 10
        ELSE
          SUM(COALESCE(ie.eto_mm, 0) * COALESCE(ie.kc, 1) * COALESCE(o.ha, 0)) * 10
      END AS raw_need
    FROM irrigation_events ie
    JOIN orchards o ON o.id = ie.orchard_id
    CROSS JOIN season s
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= s.season_start
      AND ie.orchard_id IS NOT NULL
      AND (p_orchard_id IS NULL OR ie.orchard_id = p_orchard_id)
    GROUP BY date_trunc('week', ie.event_date)
  ),

  -- Weekly rainfall from org weather station
  weekly_rain AS (
    SELECT
      date_trunc('week', wd.reading_date)::date AS week_start,
      COALESCE(SUM(wd.rainfall_mm), 0) AS rainfall_mm
    FROM weather_stations ws
    JOIN weather_daily wd ON wd.station_id = ws.id
    CROSS JOIN season s
    WHERE ws.organisation_id = (SELECT organisation_id FROM org)
      AND ws.is_active = true
      AND wd.reading_date >= s.season_start
      AND wd.reading_date <= CURRENT_DATE
    GROUP BY date_trunc('week', wd.reading_date)
  )

  SELECT
    w.week_start,
    'W' || EXTRACT(ISOYEAR FROM w.week_start)::text || '-'
        || LPAD(EXTRACT(WEEK FROM w.week_start)::text, 2, '0') AS week_label,
    ROUND(
      w.total_volume_m3 / NULLIF(
        CASE WHEN p_orchard_id IS NOT NULL
          THEN (SELECT ha FROM orchards WHERE id = p_orchard_id)
          ELSE (SELECT total_ha FROM distinct_ha)
        END, 0
      ), 1
    ) AS given_cubes_per_ha,
    ROUND(
      w.raw_need / NULLIF(
        CASE WHEN p_orchard_id IS NOT NULL
          THEN 1  -- already in m3/ha
          ELSE (SELECT total_ha FROM distinct_ha)
        END, 0
      ), 1
    ) AS need_cubes_per_ha,
    COALESCE(r.rainfall_mm, 0) AS rainfall_mm
  FROM weekly w
  LEFT JOIN weekly_rain r ON r.week_start = w.week_start
  ORDER BY w.week_start;
$$;

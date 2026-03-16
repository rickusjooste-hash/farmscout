-- ============================================================
-- Season-to-date irrigation totals per orchard in m3/ha
-- Season auto-detect: if month >= 9 → Sep 1 this year, else Sep 1 last year
-- ============================================================

DROP FUNCTION IF EXISTS public.get_irrigation_season_totals(uuid[]);
CREATE OR REPLACE FUNCTION public.get_irrigation_season_totals(
  p_farm_ids uuid[]
)
RETURNS TABLE (
  orchard_id uuid,
  orchard_nr integer,
  orchard_name text,
  variety text,
  variety_group text,
  ha numeric,
  season_volume_m3 numeric,
  season_cubes_per_ha numeric,
  season_need_cubes_per_ha numeric,
  season_rainfall_mm numeric,
  last_irrigation_date date,
  days_since_irrigation integer
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

  -- Aggregate irrigation events per orchard for the season
  irr_agg AS (
    SELECT
      ie.orchard_id,
      SUM(ie.volume_m3) AS season_volume_m3,
      SUM(COALESCE(ie.eto_mm, 0) * COALESCE(ie.kc, 1)) AS season_etc_mm,
      MAX(ie.event_date) AS last_irrigation_date
    FROM irrigation_events ie
    CROSS JOIN season s
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= s.season_start
      AND ie.orchard_id IS NOT NULL
    GROUP BY ie.orchard_id
  ),

  -- Rainfall from the org's weather station for the season
  rainfall AS (
    SELECT
      COALESCE(SUM(wd.rainfall_mm), 0) AS season_rainfall_mm
    FROM weather_stations ws
    JOIN weather_daily wd ON wd.station_id = ws.id
    CROSS JOIN season s
    WHERE ws.organisation_id = (SELECT organisation_id FROM org)
      AND ws.is_active = true
      AND wd.reading_date >= s.season_start
      AND wd.reading_date <= CURRENT_DATE
  )

  SELECT
    o.id AS orchard_id,
    o.orchard_nr,
    o.name AS orchard_name,
    o.variety,
    o.variety_group,
    o.ha,
    ROUND(ia.season_volume_m3, 1) AS season_volume_m3,
    ROUND(ia.season_volume_m3 / NULLIF(o.ha, 0), 1) AS season_cubes_per_ha,
    -- ETc mm → m3/ha: multiply by 10
    ROUND(ia.season_etc_mm * 10, 1) AS season_need_cubes_per_ha,
    ROUND(rf.season_rainfall_mm, 1) AS season_rainfall_mm,
    ia.last_irrigation_date,
    (CURRENT_DATE - ia.last_irrigation_date)::integer AS days_since_irrigation
  FROM irr_agg ia
  JOIN orchards o ON o.id = ia.orchard_id
  CROSS JOIN rainfall rf
  WHERE o.farm_id = ANY(p_farm_ids)
  ORDER BY o.name;
$$;

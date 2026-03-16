-- ============================================================
-- Fix: Weather station lookups use organisation_id, not farm_id
-- ============================================================
-- The weather station ("Moutons Valley") is physically at MV farm but serves
-- all farms in the org. RPCs previously filtered ws.farm_id = ANY(p_farm_ids),
-- which returned no data when the user selected a different farm (e.g. SK).
-- Fix: resolve org_id from the passed farm_ids, then match ws.organisation_id.

-- 1. get_weather_summary — dashboard weather strip
DROP FUNCTION IF EXISTS public.get_weather_summary(uuid[]);
CREATE OR REPLACE FUNCTION public.get_weather_summary(p_farm_ids uuid[])
RETURNS TABLE (
  station_code text,
  station_name text,
  farm_id uuid,
  current_temp numeric,
  today_eto numeric,
  today_rainfall numeric,
  last_reading_at timestamptz,
  eto_7day numeric,
  rainfall_7day numeric
) LANGUAGE sql STABLE AS $$
  WITH org AS (
    SELECT organisation_id FROM farms WHERE id = ANY(p_farm_ids) LIMIT 1
  ),
  latest_reading AS (
    SELECT DISTINCT ON (ws.id)
      ws.id AS station_id,
      ws.station_code,
      ws.station_name,
      ws.farm_id,
      wr.temp_c,
      wr.reading_at
    FROM weather_stations ws
    JOIN weather_readings wr ON wr.station_id = ws.id
    WHERE ws.organisation_id = (SELECT organisation_id FROM org)
      AND ws.is_active = true
    ORDER BY ws.id, wr.reading_at DESC
  ),
  today_summary AS (
    SELECT
      ws.id AS station_id,
      COALESCE(wd.eto_mm, 0) AS eto_mm,
      COALESCE(wd.rainfall_mm, 0) AS rainfall_mm
    FROM weather_stations ws
    LEFT JOIN weather_daily wd ON wd.station_id = ws.id AND wd.reading_date = CURRENT_DATE
    WHERE ws.organisation_id = (SELECT organisation_id FROM org)
      AND ws.is_active = true
  ),
  week_summary AS (
    SELECT
      ws.id AS station_id,
      COALESCE(SUM(wd.eto_mm), 0) AS eto_7day,
      COALESCE(SUM(wd.rainfall_mm), 0) AS rainfall_7day
    FROM weather_stations ws
    LEFT JOIN weather_daily wd ON wd.station_id = ws.id
      AND wd.reading_date >= CURRENT_DATE - 6
      AND wd.reading_date <= CURRENT_DATE
    WHERE ws.organisation_id = (SELECT organisation_id FROM org)
      AND ws.is_active = true
    GROUP BY ws.id
  )
  SELECT
    lr.station_code,
    lr.station_name,
    lr.farm_id,
    lr.temp_c AS current_temp,
    ts.eto_mm AS today_eto,
    ts.rainfall_mm AS today_rainfall,
    lr.reading_at AS last_reading_at,
    wk.eto_7day,
    wk.rainfall_7day
  FROM latest_reading lr
  LEFT JOIN today_summary ts ON ts.station_id = lr.station_id
  LEFT JOIN week_summary wk ON wk.station_id = lr.station_id;
$$;


-- 2. get_weather_daily — ETo trend chart
DROP FUNCTION IF EXISTS public.get_weather_daily(uuid[], integer);
CREATE OR REPLACE FUNCTION public.get_weather_daily(p_farm_ids uuid[], p_days integer DEFAULT 14)
RETURNS TABLE (
  station_code text,
  reading_date date,
  eto_mm numeric,
  rainfall_mm numeric,
  temp_min_c numeric,
  temp_max_c numeric,
  temp_avg_c numeric
) LANGUAGE sql STABLE AS $$
  SELECT
    ws.station_code,
    wd.reading_date,
    wd.eto_mm,
    wd.rainfall_mm,
    wd.temp_min_c,
    wd.temp_max_c,
    wd.temp_avg_c
  FROM weather_stations ws
  JOIN weather_daily wd ON wd.station_id = ws.id
  WHERE ws.organisation_id = (SELECT organisation_id FROM farms WHERE id = ANY(p_farm_ids) LIMIT 1)
    AND ws.is_active = true
    AND wd.reading_date >= CURRENT_DATE - p_days
  ORDER BY wd.reading_date;
$$;


-- 3. get_irrigation_summary — per-orchard water balance
DROP FUNCTION IF EXISTS public.get_irrigation_summary(uuid[], integer);
CREATE OR REPLACE FUNCTION public.get_irrigation_summary(
  p_farm_ids uuid[],
  p_days integer DEFAULT 14
)
RETURNS TABLE (
  orchard_id uuid,
  orchard_name text,
  variety text,
  commodity_code text,
  ha numeric,
  total_etc_mm numeric,
  total_applied_mm numeric,
  total_rainfall_mm numeric,
  net_deficit_mm numeric,
  available_water_mm numeric,
  stress_risk text,
  last_irrigation_date date,
  days_since_irrigation integer
) LANGUAGE sql STABLE AS $$
  WITH
  org AS (
    SELECT organisation_id FROM farms WHERE id = ANY(p_farm_ids) LIMIT 1
  ),
  date_range AS (
    SELECT CURRENT_DATE - p_days AS from_date,
           CURRENT_DATE         AS to_date
  ),

  irr_agg AS (
    SELECT
      ie.orchard_id,
      SUM(ie.volume_m3 / NULLIF(ie.area_ha, 0) / 10)  AS total_applied_mm,
      SUM(COALESCE(ie.eto_mm, 0) * COALESCE(ie.kc, 1)) AS total_etc_mm,
      MAX(ie.event_date)                                AS last_irrigation_date
    FROM irrigation_events ie, date_range dr
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= dr.from_date
      AND ie.event_date <= dr.to_date
      AND ie.orchard_id IS NOT NULL
    GROUP BY ie.orchard_id
  ),

  -- Rainfall from the org's weather station (not farm-specific)
  rainfall AS (
    SELECT
      COALESCE(SUM(wd.rainfall_mm), 0) AS total_rainfall_mm
    FROM weather_stations ws
    JOIN weather_daily wd ON wd.station_id = ws.id
    CROSS JOIN date_range dr
    WHERE ws.organisation_id = (SELECT organisation_id FROM org)
      AND ws.is_active = true
      AND wd.reading_date >= dr.from_date
      AND wd.reading_date <= dr.to_date
  ),

  soil AS (
    SELECT
      osp.orchard_id,
      osp.whc_mm_per_m * osp.effective_root_depth_m * osp.raw_fraction AS available_water_mm
    FROM orchard_soil_properties osp
  ),

  combined AS (
    SELECT
      o.id                                                   AS orchard_id,
      o.name                                                 AS orchard_name,
      o.variety,
      c.code                                                 AS commodity_code,
      o.ha,
      COALESCE(ia.total_etc_mm, 0)                           AS total_etc_mm,
      COALESCE(ia.total_applied_mm, 0)                       AS total_applied_mm,
      COALESCE(rf.total_rainfall_mm, 0)                      AS total_rainfall_mm,
      COALESCE(ia.total_etc_mm, 0)
        - COALESCE(ia.total_applied_mm, 0)
        - COALESCE(rf.total_rainfall_mm, 0)                  AS net_deficit_mm,
      COALESCE(s.available_water_mm, 120.0 * 0.6 * 0.5)     AS available_water_mm,
      ia.last_irrigation_date,
      (CURRENT_DATE - ia.last_irrigation_date)::integer      AS days_since_irrigation
    FROM irr_agg ia
    JOIN orchards o ON o.id = ia.orchard_id
    JOIN commodities c ON c.id = o.commodity_id
    CROSS JOIN rainfall rf
    LEFT JOIN soil s ON s.orchard_id = o.id
  )

  SELECT
    cb.orchard_id,
    cb.orchard_name,
    cb.variety,
    cb.commodity_code,
    cb.ha,
    ROUND(cb.total_etc_mm, 1)      AS total_etc_mm,
    ROUND(cb.total_applied_mm, 1)  AS total_applied_mm,
    ROUND(cb.total_rainfall_mm, 1) AS total_rainfall_mm,
    ROUND(cb.net_deficit_mm, 1)    AS net_deficit_mm,
    ROUND(cb.available_water_mm, 1) AS available_water_mm,
    CASE
      WHEN cb.net_deficit_mm > 0.8 * cb.available_water_mm THEN 'critical'
      WHEN cb.net_deficit_mm > 0.5 * cb.available_water_mm THEN 'warning'
      ELSE 'ok'
    END                            AS stress_risk,
    cb.last_irrigation_date,
    cb.days_since_irrigation
  FROM combined cb
  ORDER BY
    CASE
      WHEN cb.net_deficit_mm > 0.8 * cb.available_water_mm THEN 0
      WHEN cb.net_deficit_mm > 0.5 * cb.available_water_mm THEN 1
      ELSE 2
    END,
    cb.net_deficit_mm DESC;
$$;


-- 4. get_irrigation_events — daily per-orchard for charts
DROP FUNCTION IF EXISTS public.get_irrigation_events(uuid[], integer);
CREATE OR REPLACE FUNCTION public.get_irrigation_events(
  p_farm_ids uuid[],
  p_days integer DEFAULT 14
)
RETURNS TABLE (
  orchard_id uuid,
  orchard_name text,
  legacy_id integer,
  event_date date,
  applied_mm numeric,
  etc_mm numeric,
  eto_mm numeric,
  kc numeric,
  volume_m3 numeric,
  duration_min numeric,
  valve_count integer,
  rainfall_mm numeric
) LANGUAGE sql STABLE AS $$
  SELECT
    o.id                                                    AS orchard_id,
    o.name                                                  AS orchard_name,
    ie.legacy_id,
    ie.event_date,
    ROUND(ie.volume_m3 / NULLIF(ie.area_ha, 0) / 10, 2)   AS applied_mm,
    ROUND(COALESCE(ie.eto_mm, 0) * COALESCE(ie.kc, 1), 2) AS etc_mm,
    ie.eto_mm,
    ie.kc,
    ie.volume_m3,
    ie.duration_min,
    ie.valve_count,
    COALESCE(wd.rainfall_mm, 0)                            AS rainfall_mm
  FROM irrigation_events ie
  JOIN orchards o ON o.id = ie.orchard_id
  -- Rainfall from the org's weather station
  LEFT JOIN weather_stations ws
    ON ws.organisation_id = o.organisation_id AND ws.is_active = true
  LEFT JOIN weather_daily wd
    ON wd.station_id = ws.id AND wd.reading_date = ie.event_date
  WHERE ie.farm_id = ANY(p_farm_ids)
    AND ie.event_date >= CURRENT_DATE - p_days
    AND ie.orchard_id IS NOT NULL
  ORDER BY ie.event_date, o.name;
$$;

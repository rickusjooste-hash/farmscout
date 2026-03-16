-- ============================================================
-- Irrigation Intelligence Module — Phase 2: Dashboard RPCs
-- Depends on: 20260316_irrigation_intelligence.sql
-- ============================================================

-- 1. Irrigation events (aggregated per orchard per day, summed across valves)
CREATE TABLE IF NOT EXISTS public.irrigation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  orchard_id uuid REFERENCES orchards(id),      -- resolved from legacy_id
  legacy_id integer NOT NULL,                    -- ICC DESCRIPTION column = orchards.legacy_id
  event_date date NOT NULL,
  volume_m3 numeric NOT NULL DEFAULT 0,          -- sum across all valves for this orchard
  duration_min numeric NOT NULL DEFAULT 0,       -- sum across all valves
  area_ha numeric NOT NULL DEFAULT 0,            -- sum of covering areas
  valve_count integer NOT NULL DEFAULT 0,        -- number of valves that ran
  eto_mm numeric,                                -- from weather_daily
  kc numeric,                                    -- from crop_coefficients
  created_at timestamptz DEFAULT now(),
  UNIQUE (farm_id, legacy_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_irrigation_events_farm_date
  ON irrigation_events (farm_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_irrigation_events_orchard
  ON irrigation_events (orchard_id, event_date DESC);

-- 2. Orchard soil properties (water holding capacity, root depth, RAW)
CREATE TABLE IF NOT EXISTS public.orchard_soil_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orchard_id uuid NOT NULL REFERENCES orchards(id) UNIQUE,
  soil_type text,
  whc_mm_per_m numeric NOT NULL DEFAULT 120,              -- water holding capacity mm/m
  effective_root_depth_m numeric NOT NULL DEFAULT 0.6,
  field_capacity_pct numeric,
  permanent_wilting_pct numeric,
  raw_fraction numeric NOT NULL DEFAULT 0.5,               -- readily available water fraction
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. RPC: Per-orchard water balance summary for the irrigation dashboard
--    Returns one row per orchard that has irrigation events in the period.
--    Computes ETc, applied mm, rainfall, net deficit, and a stress risk flag.
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
  -- Period bounds
  date_range AS (
    SELECT CURRENT_DATE - p_days AS from_date,
           CURRENT_DATE         AS to_date
  ),

  -- Aggregate irrigation events per orchard over the period
  irr_agg AS (
    SELECT
      ie.orchard_id,
      -- applied_mm per event = volume_m3 / area_ha / 10  (m3 / ha → mm)
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

  -- Rainfall over the same period from the farm's weather station
  rainfall AS (
    SELECT
      ws.farm_id,
      COALESCE(SUM(wd.rainfall_mm), 0) AS total_rainfall_mm
    FROM weather_stations ws
    JOIN weather_daily wd ON wd.station_id = ws.id
    CROSS JOIN date_range dr
    WHERE ws.farm_id = ANY(p_farm_ids)
      AND ws.is_active = true
      AND wd.reading_date >= dr.from_date
      AND wd.reading_date <= dr.to_date
    GROUP BY ws.farm_id
  ),

  -- Available water from soil properties (defaults: 120 * 0.6 * 0.5 = 36 mm)
  soil AS (
    SELECT
      osp.orchard_id,
      osp.whc_mm_per_m * osp.effective_root_depth_m * osp.raw_fraction AS available_water_mm
    FROM orchard_soil_properties osp
  ),

  -- Combine everything
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
      -- net_deficit = demand - supply (positive = under-irrigated)
      COALESCE(ia.total_etc_mm, 0)
        - COALESCE(ia.total_applied_mm, 0)
        - COALESCE(rf.total_rainfall_mm, 0)                  AS net_deficit_mm,
      COALESCE(s.available_water_mm, 120.0 * 0.6 * 0.5)     AS available_water_mm,
      ia.last_irrigation_date,
      (CURRENT_DATE - ia.last_irrigation_date)::integer      AS days_since_irrigation
    FROM irr_agg ia
    JOIN orchards o ON o.id = ia.orchard_id
    JOIN commodities c ON c.id = o.commodity_id
    LEFT JOIN rainfall rf ON rf.farm_id = o.farm_id
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
    -- Surface critical orchards first
    CASE
      WHEN cb.net_deficit_mm > 0.8 * cb.available_water_mm THEN 0
      WHEN cb.net_deficit_mm > 0.5 * cb.available_water_mm THEN 1
      ELSE 2
    END,
    cb.net_deficit_mm DESC;
$$;

-- 4. RPC: Daily irrigation events per orchard for time-series charts
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
  -- Rainfall for the same date from the farm's weather station
  LEFT JOIN weather_stations ws
    ON ws.farm_id = ie.farm_id AND ws.is_active = true
  LEFT JOIN weather_daily wd
    ON wd.station_id = ws.id AND wd.reading_date = ie.event_date
  WHERE ie.farm_id = ANY(p_farm_ids)
    AND ie.event_date >= CURRENT_DATE - p_days
    AND ie.orchard_id IS NOT NULL
  ORDER BY ie.event_date, o.name;
$$;

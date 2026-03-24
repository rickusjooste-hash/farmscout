-- ============================================================
-- Irrigation Intelligence: Alert classification for all orchards
-- Returns ALL active orchards (not just irrigated ones) with
-- a 5-level stress classification.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_irrigation_alerts(
  p_farm_ids uuid[],
  p_days integer DEFAULT 14
)
RETURNS TABLE (
  orchard_id uuid,
  orchard_name text,
  orchard_nr integer,
  variety text,
  variety_group text,
  commodity_code text,
  ha numeric,
  total_etc_mm numeric,
  total_applied_mm numeric,
  total_rainfall_mm numeric,
  net_deficit_mm numeric,
  available_water_mm numeric,
  kc_current numeric,
  stress_risk text,
  last_irrigation_date date,
  days_since_irrigation integer,
  season_volume_m3 numeric,
  season_cubes_per_ha numeric
) LANGUAGE sql STABLE AS $$
  WITH
  org AS (
    SELECT organisation_id FROM farms WHERE id = ANY(p_farm_ids) LIMIT 1
  ),
  date_range AS (
    SELECT CURRENT_DATE - p_days AS from_date,
           CURRENT_DATE         AS to_date
  ),
  season AS (
    SELECT
      CASE
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 9
        THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 9, 1)
        ELSE make_date((EXTRACT(YEAR FROM CURRENT_DATE) - 1)::int, 9, 1)
      END AS season_start
  ),

  -- Irrigation events in the rolling period
  irr_agg AS (
    SELECT
      ie.orchard_id,
      SUM(ie.volume_m3 / NULLIF(ie.area_ha, 0) / 10)  AS total_applied_mm,
      MAX(ie.event_date)                                AS last_irrigation_date
    FROM irrigation_events ie, date_range dr
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= dr.from_date
      AND ie.event_date <= dr.to_date
      AND ie.orchard_id IS NOT NULL
    GROUP BY ie.orchard_id
  ),

  -- Season totals
  season_agg AS (
    SELECT
      ie.orchard_id,
      SUM(ie.volume_m3) AS season_volume_m3,
      COALESCE(MAX(ie.event_date), NULL) AS season_last_date
    FROM irrigation_events ie
    CROSS JOIN season s
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= s.season_start
      AND ie.orchard_id IS NOT NULL
    GROUP BY ie.orchard_id
  ),

  -- Current month Kc per orchard
  kc_current AS (
    SELECT
      o.id AS orchard_id,
      COALESCE(
        (SELECT cc.kc FROM crop_coefficients cc
         WHERE cc.commodity_id = o.commodity_id
           AND cc.month = EXTRACT(MONTH FROM CURRENT_DATE)::int
           AND (cc.organisation_id = (SELECT organisation_id FROM org) OR cc.organisation_id IS NULL)
           AND (cc.variety_group = o.variety_group OR cc.variety_group IS NULL)
         ORDER BY cc.organisation_id NULLS LAST, cc.variety_group NULLS LAST
         LIMIT 1
        ), 1
      ) AS kc
    FROM orchards o
    WHERE o.farm_id = ANY(p_farm_ids) AND o.is_active = true
  ),

  -- ETc (crop water demand) in the period
  need_agg AS (
    SELECT
      o.id AS orchard_id,
      SUM(
        COALESCE(wd.eto_mm, 0) * COALESCE(
          (SELECT cc.kc FROM crop_coefficients cc
           WHERE cc.commodity_id = o.commodity_id
             AND cc.month = EXTRACT(MONTH FROM wd.reading_date)::int
             AND (cc.organisation_id = (SELECT organisation_id FROM org) OR cc.organisation_id IS NULL)
             AND (cc.variety_group = o.variety_group OR cc.variety_group IS NULL)
           ORDER BY cc.organisation_id NULLS LAST, cc.variety_group NULLS LAST
           LIMIT 1
          ), 1
        )
      ) / COALESCE(it.efficiency, 0.85) AS total_etc_mm
    FROM orchards o
    CROSS JOIN date_range dr
    JOIN weather_stations ws ON ws.organisation_id = (SELECT organisation_id FROM org) AND ws.is_active = true
    JOIN weather_daily wd ON wd.station_id = ws.id
      AND wd.reading_date >= dr.from_date
      AND wd.reading_date <= dr.to_date
    LEFT JOIN irrigation_types it ON it.id = o.irrigation_type_id
    WHERE o.farm_id = ANY(p_farm_ids)
      AND o.is_active = true
    GROUP BY o.id, it.efficiency
  ),

  -- Rainfall in the period
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

  -- Soil available water
  soil AS (
    SELECT
      osp.orchard_id,
      osp.whc_mm_per_m * osp.effective_root_depth_m * osp.raw_fraction AS available_water_mm
    FROM orchard_soil_properties osp
  ),

  -- Combine everything: start FROM orchards to include all
  combined AS (
    SELECT
      o.id                                                   AS orchard_id,
      o.name                                                 AS orchard_name,
      o.orchard_nr,
      o.variety,
      o.variety_group,
      c.code                                                 AS commodity_code,
      o.ha,
      COALESCE(na.total_etc_mm, 0)                           AS total_etc_mm,
      COALESCE(ia.total_applied_mm, 0)                       AS total_applied_mm,
      COALESCE(rf.total_rainfall_mm, 0)                      AS total_rainfall_mm,
      COALESCE(na.total_etc_mm, 0)
        - COALESCE(ia.total_applied_mm, 0)
        - COALESCE(rf.total_rainfall_mm, 0)                  AS net_deficit_mm,
      COALESCE(s.available_water_mm, 120.0 * 0.6 * 0.5)     AS available_water_mm,
      COALESCE(kc.kc, 1)                                    AS kc_current,
      ia.last_irrigation_date,
      -- days_since: use season last date if no irrigation in period
      (CURRENT_DATE - COALESCE(ia.last_irrigation_date, sa.season_last_date))::integer AS days_since_irrigation,
      ia.orchard_id IS NOT NULL                               AS has_period_irrigation,
      COALESCE(sa.season_volume_m3, 0)                       AS season_volume_m3,
      ROUND(COALESCE(sa.season_volume_m3, 0) / NULLIF(o.ha, 0), 1) AS season_cubes_per_ha
    FROM orchards o
    JOIN commodities c ON c.id = o.commodity_id
    LEFT JOIN irr_agg ia ON ia.orchard_id = o.id
    LEFT JOIN season_agg sa ON sa.orchard_id = o.id
    LEFT JOIN need_agg na ON na.orchard_id = o.id
    LEFT JOIN kc_current kc ON kc.orchard_id = o.id
    LEFT JOIN soil s ON s.orchard_id = o.id
    CROSS JOIN rainfall rf
    WHERE o.farm_id = ANY(p_farm_ids)
      AND o.is_active = true
  )

  SELECT
    cb.orchard_id,
    cb.orchard_name,
    cb.orchard_nr,
    cb.variety,
    cb.variety_group,
    cb.commodity_code,
    cb.ha,
    ROUND(cb.total_etc_mm, 1)      AS total_etc_mm,
    ROUND(cb.total_applied_mm, 1)  AS total_applied_mm,
    ROUND(cb.total_rainfall_mm, 1) AS total_rainfall_mm,
    ROUND(cb.net_deficit_mm, 1)    AS net_deficit_mm,
    ROUND(cb.available_water_mm, 1) AS available_water_mm,
    ROUND(cb.kc_current, 2)       AS kc_current,
    -- 5-level classification
    CASE
      -- Dormant: low Kc month, no concern
      WHEN cb.kc_current <= 0.5 THEN 'dormant'
      -- No irrigation at all during active growth
      WHEN NOT cb.has_period_irrigation AND cb.season_volume_m3 = 0 AND cb.kc_current > 0.5 THEN 'no_data'
      -- Has season irrigation but none in this period during active growth
      WHEN NOT cb.has_period_irrigation AND cb.kc_current > 0.5 THEN
        CASE
          WHEN cb.days_since_irrigation >= 7 THEN 'critical'
          WHEN cb.days_since_irrigation >= 5 THEN 'warning'
          ELSE 'ok'
        END
      -- Has irrigation in period: deficit-based + days-since escalation
      WHEN cb.net_deficit_mm > 0.8 * cb.available_water_mm THEN 'critical'
      WHEN cb.net_deficit_mm > 0.5 * cb.available_water_mm THEN
        CASE WHEN cb.days_since_irrigation >= 7 AND cb.kc_current > 0.7 THEN 'critical' ELSE 'warning' END
      WHEN cb.days_since_irrigation >= 7 AND cb.kc_current > 0.7
        AND cb.net_deficit_mm > 0.3 * cb.available_water_mm THEN 'warning'
      ELSE 'ok'
    END                            AS stress_risk,
    COALESCE(cb.last_irrigation_date, (SELECT season_last_date FROM season_agg WHERE orchard_id = cb.orchard_id)) AS last_irrigation_date,
    cb.days_since_irrigation,
    ROUND(cb.season_volume_m3, 1)  AS season_volume_m3,
    cb.season_cubes_per_ha
  FROM combined cb
  ORDER BY
    -- Sort: no_data first, then critical, warning, ok, dormant
    CASE
      WHEN cb.kc_current <= 0.5 THEN 4
      WHEN NOT cb.has_period_irrigation AND cb.season_volume_m3 = 0 AND cb.kc_current > 0.5 THEN 0
      WHEN cb.net_deficit_mm > 0.8 * cb.available_water_mm THEN 1
      WHEN cb.net_deficit_mm > 0.5 * cb.available_water_mm THEN 2
      ELSE 3
    END,
    cb.net_deficit_mm DESC;
$$;

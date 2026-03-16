-- ============================================================
-- Irrigation types (emitter/spitter types) with efficiency
-- ============================================================

-- 1. Lookup table
CREATE TABLE IF NOT EXISTS public.irrigation_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  efficiency numeric NOT NULL CHECK (efficiency > 0 AND efficiency <= 1),
  created_at timestamptz DEFAULT now()
);

-- Seed types
INSERT INTO public.irrigation_types (name, description, efficiency) VALUES
  ('Micro',    'Micro-sprinkler / micro-jet',  0.85),
  ('Drip',     'Drip / trickle irrigation',    0.92),
  ('Overhead', 'Overhead sprinkler',           0.70)
ON CONFLICT (name) DO NOTHING;

-- 2. Add FK column to orchards
ALTER TABLE public.orchards
  ADD COLUMN IF NOT EXISTS irrigation_type_id uuid REFERENCES irrigation_types(id);

-- 3. Set all orchards to Micro by default
UPDATE public.orchards
SET irrigation_type_id = (SELECT id FROM irrigation_types WHERE name = 'Micro')
WHERE irrigation_type_id IS NULL;

-- 4. Set BUCHU orchards to Overhead
UPDATE public.orchards
SET irrigation_type_id = (SELECT id FROM irrigation_types WHERE name = 'Overhead')
WHERE variety_group = 'BUCHU';

-- Also set BUCHU orchards under the non-apple commodity (2cc769a2)
UPDATE public.orchards
SET irrigation_type_id = (SELECT id FROM irrigation_types WHERE name = 'Overhead')
WHERE commodity_id = '2cc769a2-affb-43a5-926b-3f1dab56e37d';


-- 5. Update RPCs to factor in efficiency
-- Crop need becomes: ETc / efficiency (gross irrigation requirement)

-- 5a. Fix get_irrigation_season_totals
DROP FUNCTION IF EXISTS public.get_irrigation_season_totals(uuid[]);
CREATE OR REPLACE FUNCTION public.get_irrigation_season_totals(
  p_farm_ids uuid[]
)
RETURNS TABLE (
  orchard_id uuid,
  orchard_nr integer,
  orchard_name text,
  variety text,
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

  irr_agg AS (
    SELECT
      ie.orchard_id,
      SUM(ie.volume_m3) AS season_volume_m3,
      MAX(ie.event_date) AS last_irrigation_date
    FROM irrigation_events ie
    CROSS JOIN season s
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= s.season_start
      AND ie.orchard_id IS NOT NULL
    GROUP BY ie.orchard_id
  ),

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
      ) AS season_etc_mm,
      -- Get efficiency for this orchard
      COALESCE(it.efficiency, 0.85) AS efficiency
    FROM orchards o
    CROSS JOIN season s
    JOIN weather_stations ws ON ws.organisation_id = (SELECT organisation_id FROM org) AND ws.is_active = true
    JOIN weather_daily wd ON wd.station_id = ws.id
      AND wd.reading_date >= s.season_start
      AND wd.reading_date <= CURRENT_DATE
    LEFT JOIN irrigation_types it ON it.id = o.irrigation_type_id
    WHERE o.farm_id = ANY(p_farm_ids)
      AND o.is_active = true
    GROUP BY o.id, it.efficiency
  ),

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
    o.ha,
    ROUND(ia.season_volume_m3, 1) AS season_volume_m3,
    ROUND(ia.season_volume_m3 / NULLIF(o.ha, 0), 1) AS season_cubes_per_ha,
    -- Gross need = ETc / efficiency → m3/ha
    ROUND(COALESCE(na.season_etc_mm, 0) * 10 / COALESCE(na.efficiency, 0.85), 1) AS season_need_cubes_per_ha,
    ROUND(rf.season_rainfall_mm, 1) AS season_rainfall_mm,
    ia.last_irrigation_date,
    (CURRENT_DATE - ia.last_irrigation_date)::integer AS days_since_irrigation
  FROM irr_agg ia
  JOIN orchards o ON o.id = ia.orchard_id
  LEFT JOIN need_agg na ON na.orchard_id = o.id
  CROSS JOIN rainfall rf
  WHERE o.farm_id = ANY(p_farm_ids)
  ORDER BY o.name;
$$;


-- 5b. Fix get_irrigation_summary
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
      MAX(ie.event_date)                                AS last_irrigation_date
    FROM irrigation_events ie, date_range dr
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= dr.from_date
      AND ie.event_date <= dr.to_date
      AND ie.orchard_id IS NOT NULL
    GROUP BY ie.orchard_id
  ),

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
      ) / COALESCE(it.efficiency, 0.85) AS total_etc_mm,
      COALESCE(it.efficiency, 0.85) AS efficiency
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
      COALESCE(na.total_etc_mm, 0)                           AS total_etc_mm,
      COALESCE(ia.total_applied_mm, 0)                       AS total_applied_mm,
      COALESCE(rf.total_rainfall_mm, 0)                      AS total_rainfall_mm,
      COALESCE(na.total_etc_mm, 0)
        - COALESCE(ia.total_applied_mm, 0)
        - COALESCE(rf.total_rainfall_mm, 0)                  AS net_deficit_mm,
      COALESCE(s.available_water_mm, 120.0 * 0.6 * 0.5)     AS available_water_mm,
      ia.last_irrigation_date,
      (CURRENT_DATE - ia.last_irrigation_date)::integer      AS days_since_irrigation
    FROM irr_agg ia
    JOIN orchards o ON o.id = ia.orchard_id
    JOIN commodities c ON c.id = o.commodity_id
    LEFT JOIN need_agg na ON na.orchard_id = o.id
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


-- 5c. Fix get_irrigation_weekly
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

  distinct_ha AS (
    SELECT COALESCE(SUM(ha), 1) AS total_ha
    FROM orchards
    WHERE farm_id = ANY(p_farm_ids)
      AND is_active = true
      AND (p_orchard_id IS NULL OR id = p_orchard_id)
  ),

  -- Weighted avg efficiency for aggregate view
  avg_eff AS (
    SELECT
      CASE
        WHEN SUM(o.ha) > 0 THEN
          SUM(COALESCE(it.efficiency, 0.85) * COALESCE(o.ha, 0)) / SUM(COALESCE(o.ha, 0))
        ELSE 0.85
      END AS eff
    FROM orchards o
    LEFT JOIN irrigation_types it ON it.id = o.irrigation_type_id
    WHERE o.farm_id = ANY(p_farm_ids)
      AND o.is_active = true
      AND (p_orchard_id IS NULL OR o.id = p_orchard_id)
  ),

  weekly_given AS (
    SELECT
      date_trunc('week', ie.event_date)::date AS week_start,
      SUM(ie.volume_m3) AS total_volume_m3
    FROM irrigation_events ie
    CROSS JOIN season s
    WHERE ie.farm_id = ANY(p_farm_ids)
      AND ie.event_date >= s.season_start
      AND ie.orchard_id IS NOT NULL
      AND (p_orchard_id IS NULL OR ie.orchard_id = p_orchard_id)
    GROUP BY date_trunc('week', ie.event_date)
  ),

  weekly_need AS (
    SELECT
      date_trunc('week', wd.reading_date)::date AS week_start,
      CASE
        WHEN p_orchard_id IS NOT NULL THEN
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
          ) * 10 / COALESCE(
            (SELECT it.efficiency FROM irrigation_types it
             JOIN orchards o2 ON o2.irrigation_type_id = it.id
             WHERE o2.id = p_orchard_id), 0.85
          )
        ELSE
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
            ) * COALESCE(o.ha, 0)
          ) * 10 / (SELECT eff FROM avg_eff)
      END AS raw_need
    FROM orchards o
    CROSS JOIN season s
    JOIN weather_stations ws ON ws.organisation_id = (SELECT organisation_id FROM org) AND ws.is_active = true
    JOIN weather_daily wd ON wd.station_id = ws.id
      AND wd.reading_date >= s.season_start
      AND wd.reading_date <= CURRENT_DATE
    WHERE o.farm_id = ANY(p_farm_ids)
      AND o.is_active = true
      AND (p_orchard_id IS NULL OR o.id = p_orchard_id)
    GROUP BY date_trunc('week', wd.reading_date)
  ),

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
  ),

  all_weeks AS (
    SELECT week_start FROM weekly_given
    UNION
    SELECT week_start FROM weekly_need
  )

  SELECT
    aw.week_start,
    'W' || EXTRACT(ISOYEAR FROM aw.week_start)::text || '-'
        || LPAD(EXTRACT(WEEK FROM aw.week_start)::text, 2, '0') AS week_label,
    ROUND(
      COALESCE(wg.total_volume_m3, 0) / NULLIF(
        CASE WHEN p_orchard_id IS NOT NULL
          THEN (SELECT ha FROM orchards WHERE id = p_orchard_id)
          ELSE (SELECT total_ha FROM distinct_ha)
        END, 0
      ), 1
    ) AS given_cubes_per_ha,
    ROUND(
      COALESCE(wn.raw_need, 0) / NULLIF(
        CASE WHEN p_orchard_id IS NOT NULL
          THEN 1
          ELSE (SELECT total_ha FROM distinct_ha)
        END, 0
      ), 1
    ) AS need_cubes_per_ha,
    ROUND(COALESCE(r.rainfall_mm, 0), 1) AS rainfall_mm
  FROM all_weeks aw
  LEFT JOIN weekly_given wg ON wg.week_start = aw.week_start
  LEFT JOIN weekly_need wn ON wn.week_start = aw.week_start
  LEFT JOIN weekly_rain r ON r.week_start = aw.week_start
  ORDER BY aw.week_start;
$$;

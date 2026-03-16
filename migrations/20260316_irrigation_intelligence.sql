-- ============================================================
-- Irrigation Intelligence Module — Phase 1: Data Ingestion
-- ============================================================

-- 1. Weather stations (iLeaf / others)
CREATE TABLE IF NOT EXISTS public.weather_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  station_code text NOT NULL UNIQUE,
  station_name text NOT NULL,
  source text NOT NULL DEFAULT 'ileaf',  -- 'ileaf', 'davis', etc.
  ftp_host text,
  ftp_user text,
  ftp_pass text,
  ftp_path text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weather_stations_farm ON weather_stations (farm_id);

-- 2. Weather readings (hourly from iLeaf CSV)
CREATE TABLE IF NOT EXISTS public.weather_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES weather_stations(id),
  reading_at timestamptz NOT NULL,
  temp_c numeric,
  humidity_pct numeric,
  wind_speed_ms numeric,
  rainfall_mm numeric,
  eto_cumulative_mm numeric,  -- cumulative daily ETo (resets at midnight)
  created_at timestamptz DEFAULT now(),
  UNIQUE (station_id, reading_at)
);

CREATE INDEX IF NOT EXISTS idx_weather_readings_station_time ON weather_readings (station_id, reading_at DESC);

-- 3. Daily ETo summary (computed from hourly cumulative resets)
CREATE TABLE IF NOT EXISTS public.weather_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES weather_stations(id),
  reading_date date NOT NULL,
  eto_mm numeric,          -- daily ETo (max cumulative before midnight reset)
  rainfall_mm numeric,     -- sum of hourly rainfall
  temp_min_c numeric,
  temp_max_c numeric,
  temp_avg_c numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE (station_id, reading_date)
);

CREATE INDEX IF NOT EXISTS idx_weather_daily_station_date ON weather_daily (station_id, reading_date DESC);

-- 4. AquaCheck probes (mapping to orchards)
CREATE TABLE IF NOT EXISTS public.aquacheck_probes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  orchard_id uuid REFERENCES orchards(id),
  probe_serial text NOT NULL UNIQUE,
  probe_name text,
  field_capacity_pct numeric,    -- FC calibration
  permanent_wilting_pct numeric, -- PWP calibration
  refill_point_pct numeric,      -- management refill threshold
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aquacheck_probes_farm ON aquacheck_probes (farm_id);

-- 5. Soil moisture readings (from AquaCheck API)
CREATE TABLE IF NOT EXISTS public.soil_moisture_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  probe_id uuid NOT NULL REFERENCES aquacheck_probes(id),
  reading_at timestamptz NOT NULL,
  depth_cm integer NOT NULL,     -- 20, 40, 60, 80, 100
  vwc_pct numeric NOT NULL,      -- volumetric water content %
  soil_temp_c numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE (probe_id, reading_at, depth_cm)
);

CREATE INDEX IF NOT EXISTS idx_soil_moisture_probe_time ON soil_moisture_readings (probe_id, reading_at DESC);

-- 6. Crop coefficients (Kc by commodity × month)
CREATE TABLE IF NOT EXISTS public.crop_coefficients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),  -- NULL = system default
  commodity_id uuid NOT NULL REFERENCES commodities(id),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  kc numeric NOT NULL,
  source text DEFAULT 'FAO 56',
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, commodity_id, month)
);

-- Seed FAO 56 Kc values for deciduous fruit (Western Cape)
-- Apples
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, month, kc, source) VALUES
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 1, 1.15, 'FAO 56'),  -- Jan (full cover)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 2, 1.10, 'FAO 56'),  -- Feb
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 3, 0.95, 'FAO 56'),  -- Mar (harvest)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 4, 0.70, 'FAO 56'),  -- Apr (leaf fall)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 5, 0.45, 'FAO 56'),  -- May (dormant)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 6, 0.40, 'FAO 56'),  -- Jun (dormant)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 7, 0.40, 'FAO 56'),  -- Jul (dormant)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 8, 0.50, 'FAO 56'),  -- Aug (bud break)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 9, 0.65, 'FAO 56'),  -- Sep (bloom)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 10, 0.85, 'FAO 56'), -- Oct (cell division)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 11, 1.05, 'FAO 56'), -- Nov (rapid growth)
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 12, 1.15, 'FAO 56')  -- Dec (full cover)
ON CONFLICT DO NOTHING;

-- Pears
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, month, kc, source) VALUES
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 1, 1.10, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 2, 1.05, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 3, 0.90, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 4, 0.65, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 5, 0.45, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 6, 0.40, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 7, 0.40, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 8, 0.50, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 9, 0.60, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 10, 0.80, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 11, 1.00, 'FAO 56'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 12, 1.10, 'FAO 56')
ON CONFLICT DO NOTHING;

-- Nectarines
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, month, kc, source) VALUES
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 1, 1.10, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 2, 0.95, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 3, 0.75, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 4, 0.55, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 5, 0.45, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 6, 0.40, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 7, 0.40, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 8, 0.50, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 9, 0.70, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 10, 0.90, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 11, 1.05, 'FAO 56'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 12, 1.10, 'FAO 56')
ON CONFLICT DO NOTHING;

-- Peaches
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, month, kc, source) VALUES
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 1, 1.10, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 2, 0.95, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 3, 0.75, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 4, 0.55, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 5, 0.45, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 6, 0.40, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 7, 0.40, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 8, 0.50, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 9, 0.70, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 10, 0.90, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 11, 1.05, 'FAO 56'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 12, 1.10, 'FAO 56')
ON CONFLICT DO NOTHING;

-- Seed Moutons Valley weather station
INSERT INTO public.weather_stations (organisation_id, farm_id, station_code, station_name, source, ftp_host, ftp_user, ftp_pass, ftp_path)
VALUES (
  '93d1760e-a484-4379-95fb-6cad294e2191',
  '10b61388-8abf-4ff3-86de-bacaac7c004d',
  'GWS00128',
  'Moutons Valley',
  'ileaf',
  'iwebtec.net',
  'ileafftp',
  'QmZp1092',
  '/MottechData/MottechData.csv'
)
ON CONFLICT (station_code) DO NOTHING;

-- RPC: Get latest weather for dashboard strip
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
  WITH latest_reading AS (
    SELECT DISTINCT ON (ws.id)
      ws.id AS station_id,
      ws.station_code,
      ws.station_name,
      ws.farm_id,
      wr.temp_c,
      wr.reading_at
    FROM weather_stations ws
    JOIN weather_readings wr ON wr.station_id = ws.id
    WHERE ws.farm_id = ANY(p_farm_ids)
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
    WHERE ws.farm_id = ANY(p_farm_ids) AND ws.is_active = true
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
    WHERE ws.farm_id = ANY(p_farm_ids) AND ws.is_active = true
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

-- RPC: Get daily weather for ETo trend chart
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
  WHERE ws.farm_id = ANY(p_farm_ids)
    AND ws.is_active = true
    AND wd.reading_date >= CURRENT_DATE - p_days
  ORDER BY wd.reading_date;
$$;

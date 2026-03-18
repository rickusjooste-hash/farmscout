-- ============================================================
-- Rainfall Module: rain_gauges + rain_readings
-- ============================================================

-- ── Rain gauges ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rain_gauges (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid     NOT NULL REFERENCES public.organisations(id),
  farm_id       uuid        NOT NULL REFERENCES public.farms(id),
  name          text        NOT NULL,
  location      geometry(Point, 4326),
  is_active     boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.rain_gauges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rain_gauges_select" ON public.rain_gauges
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM public.organisation_users
      WHERE user_id = auth.uid()
    )
  );

-- ── Rain readings ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rain_readings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gauge_id      uuid        NOT NULL REFERENCES public.rain_gauges(id),
  reading_date  date        NOT NULL,
  value_mm      numeric     NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (gauge_id, reading_date)
);

CREATE INDEX idx_rain_readings_gauge_date
  ON public.rain_readings (gauge_id, reading_date DESC);

ALTER TABLE public.rain_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rain_readings_select" ON public.rain_readings
  FOR SELECT USING (
    gauge_id IN (
      SELECT rg.id FROM public.rain_gauges rg
      JOIN public.organisation_users ou ON ou.organisation_id = rg.organisation_id
      WHERE ou.user_id = auth.uid()
    )
  );

-- ── Seed gauges ──────────────────────────────────────────────
-- Deterministic UUIDs based on short gauge IDs from Excel

INSERT INTO public.rain_gauges (id, organisation_id, farm_id, name, location)
VALUES
  (
    '4c804313-0000-0000-0000-000000000000',
    '93d1760e-a484-4379-95fb-6cad294e2191',
    '1a52f7f3-aeab-475c-a6e9-53a5e302fddb',
    'Mouton''s Valley',
    ST_SetSRID(ST_MakePoint(18.717752, -32.779901), 4326)
  ),
  (
    '7b0b2cd7-0000-0000-0000-000000000000',
    '93d1760e-a484-4379-95fb-6cad294e2191',
    (SELECT id FROM public.farms WHERE code = 'SK' AND organisation_id = '93d1760e-a484-4379-95fb-6cad294e2191' LIMIT 1),
    'Stawelklip',
    ST_SetSRID(ST_MakePoint(18.712596, -32.787283), 4326)
  ),
  (
    'bc8217f5-0000-0000-0000-000000000000',
    '93d1760e-a484-4379-95fb-6cad294e2191',
    (SELECT id FROM public.farms WHERE code = 'SK' AND organisation_id = '93d1760e-a484-4379-95fb-6cad294e2191' LIMIT 1),
    'MorningSide',
    ST_SetSRID(ST_MakePoint(18.709070, -32.806604), 4326)
  )
ON CONFLICT (id) DO NOTHING;

-- ── Enable rainfall module on org ────────────────────────────

UPDATE public.organisations
SET modules = array_append(modules, 'rainfall')
WHERE id = '93d1760e-a484-4379-95fb-6cad294e2191'
  AND NOT ('rainfall' = ANY(modules));

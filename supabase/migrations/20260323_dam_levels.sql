-- ============================================================
-- Dam Level Monitoring
-- ============================================================

-- Dams reference table
CREATE TABLE IF NOT EXISTS public.dams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  name text NOT NULL,
  lat numeric(10,7),
  lng numeric(10,7),
  max_capacity_m3 numeric(12,1),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, name)
);

ALTER TABLE public.dams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dams_select" ON dams FOR SELECT TO authenticated USING (true);
CREATE POLICY "dams_insert" ON dams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dams_update" ON dams FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dams_all" ON dams FOR ALL TO service_role USING (true);

-- Dam capacity lookup table (one row per pen per dam)
CREATE TABLE IF NOT EXISTS public.dam_capacity_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_id uuid NOT NULL REFERENCES dams(id) ON DELETE CASCADE,
  pen_no integer NOT NULL,  -- 0 = S/KOP (spillway)
  m3 numeric(12,1) NOT NULL,
  gallons numeric(12,0) NOT NULL,
  pct numeric(5,1) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (dam_id, pen_no)
);

ALTER TABLE public.dam_capacity_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dam_capacity_select" ON dam_capacity_table FOR SELECT TO authenticated USING (true);
CREATE POLICY "dam_capacity_all" ON dam_capacity_table FOR ALL TO service_role USING (true);

-- Dam level readings
CREATE TABLE IF NOT EXISTS public.dam_level_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  dam_id uuid NOT NULL REFERENCES dams(id),
  reading_date date NOT NULL,
  pen_no integer NOT NULL,
  quarter integer NOT NULL DEFAULT 0 CHECK (quarter >= 0 AND quarter <= 3),
  computed_m3 numeric(12,1),
  computed_gallons numeric(12,0),
  computed_pct numeric(5,1),
  read_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (dam_id, reading_date)
);

ALTER TABLE public.dam_level_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dam_readings_select" ON dam_level_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "dam_readings_insert" ON dam_level_readings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dam_readings_all" ON dam_level_readings FOR ALL TO service_role USING (true);

-- ── Seed dams (MVT org, MV farm) ─────────────────────────────

INSERT INTO public.dams (organisation_id, farm_id, name, max_capacity_m3) VALUES
  ('93d1760e-a484-4379-95fb-6cad294e2191', '1a52f7f3-aeab-475c-a6e9-53a5e302fddb', 'Maarmanskraal', 297000),
  ('93d1760e-a484-4379-95fb-6cad294e2191', '1a52f7f3-aeab-475c-a6e9-53a5e302fddb', 'Visstert', 311156.9),
  ('93d1760e-a484-4379-95fb-6cad294e2191', '1a52f7f3-aeab-475c-a6e9-53a5e302fddb', 'Hermitage', 740000),
  ('93d1760e-a484-4379-95fb-6cad294e2191', '1a52f7f3-aeab-475c-a6e9-53a5e302fddb', 'Hangover', 155529.7),
  ('93d1760e-a484-4379-95fb-6cad294e2191', '1a52f7f3-aeab-475c-a6e9-53a5e302fddb', 'Avontuur', 2100000)
ON CONFLICT (organisation_id, name) DO NOTHING;

-- ── Seed capacity tables ─────────────────────────────────────

-- Maarmanskraal (pen 0 = S/KOP)
INSERT INTO public.dam_capacity_table (dam_id, pen_no, m3, gallons, pct, sort_order)
SELECT d.id, v.pen_no, v.m3, v.gallons, v.pct, v.sort_order
FROM dams d, (VALUES
  (0,  8000,   1759789,  3, 12),
  (1,  297000, 65332160, 100, 1),
  (2,  242000, 53233612, 81, 2),
  (3,  192000, 42234932, 65, 3),
  (4,  148000, 32556093, 50, 4),
  (5,  115000, 25296964, 39, 5),
  (6,  86000,  18917730, 29, 6),
  (7,  62000,  13638363, 21, 7),
  (8,  44000,  9678839,  15, 8),
  (9,  28000,  6159261,  9, 9),
  (10, 18000,  3959525,  6, 10),
  (11, 10000,  2199736,  3, 11)
) AS v(pen_no, m3, gallons, pct, sort_order)
WHERE d.name = 'Maarmanskraal'
ON CONFLICT (dam_id, pen_no) DO NOTHING;

-- Visstert
INSERT INTO public.dam_capacity_table (dam_id, pen_no, m3, gallons, pct, sort_order)
SELECT d.id, v.pen_no, v.m3, v.gallons, v.pct, v.sort_order
FROM dams d, (VALUES
  (1,  311156.9, 68454518, 100, 1),
  (2,  278646.4, 61302208, 90, 2),
  (3,  240807.3, 52977606, 77, 3),
  (4,  206077.8, 45337116, 66, 4),
  (5,  174119.5, 38306290, 56, 5),
  (6,  144956.9, 31890518, 47, 6),
  (7,  118457.7, 26060694, 38, 7),
  (8,  94550.8,  20801176, 30, 8),
  (9,  73303.5,  16126770, 24, 9),
  (10, 55103.5,  12122770, 18, 10),
  (11, 39659.4,  8725068,  13, 11),
  (12, 27118.5,  5966070,  9, 12),
  (13, 17396.5,  3827230,  6, 13),
  (14, 9864.6,   2170212,  3, 14),
  (15, 4284.4,   942568,   1, 15),
  (16, 1076.9,   236918,   0, 16),
  (17, 73.2,     16104,    0, 17)
) AS v(pen_no, m3, gallons, pct, sort_order)
WHERE d.name = 'Visstert'
ON CONFLICT (dam_id, pen_no) DO NOTHING;

-- Hermitage (pen 0 = S/KOP)
INSERT INTO public.dam_capacity_table (dam_id, pen_no, m3, gallons, pct, sort_order)
SELECT d.id, v.pen_no, v.m3, v.gallons, v.pct, v.sort_order
FROM dams d, (VALUES
  (0, 31000,  6819182,   4, 11),
  (1, 740000, 162780466, 100, 1),
  (2, 588000, 129344479, 79, 2),
  (3, 458000, 100747910, 62, 3),
  (4, 348000, 76550814,  47, 4),
  (5, 257000, 56533216,  35, 5),
  (6, 184500, 40585130,  25, 6),
  (7, 128500, 28266608,  17, 7),
  (8, 86000,  18917730,  12, 8),
  (9, 53000,  11658601,  7, 9)
) AS v(pen_no, m3, gallons, pct, sort_order)
WHERE d.name = 'Hermitage'
ON CONFLICT (dam_id, pen_no) DO NOTHING;

-- Hangover
INSERT INTO public.dam_capacity_table (dam_id, pen_no, m3, gallons, pct, sort_order)
SELECT d.id, v.pen_no, v.m3, v.gallons, v.pct, v.sort_order
FROM dams d, (VALUES
  (1,  155529.7, 34216534, 100, 1),
  (2,  137528.6, 30256292, 88, 2),
  (3,  114122.9, 25107038, 73, 3),
  (4,  93201.3,  20504286, 60, 4),
  (5,  74562.7,  16403794, 48, 5),
  (6,  58061.6,  12773552, 37, 6),
  (7,  43561.5,  9583530,  28, 7),
  (8,  31045.3,  6829966,  20, 8),
  (9,  20769.8,  4569356,  13, 9),
  (10, 12423.7,  2733214,  8, 10),
  (11, 6158.2,   1354804,  4, 11),
  (12, 1968.3,   433026,   1, 12),
  (13, 54.3,     11946,    0, 13)
) AS v(pen_no, m3, gallons, pct, sort_order)
WHERE d.name = 'Hangover'
ON CONFLICT (dam_id, pen_no) DO NOTHING;

-- Avontuur (pen 0 = S/KOP)
INSERT INTO public.dam_capacity_table (dam_id, pen_no, m3, gallons, pct, sort_order)
SELECT d.id, v.pen_no, v.m3, v.gallons, v.pct, v.sort_order
FROM dams d, (VALUES
  (0,  82500,   18147822,  4, 17),
  (1,  2100000, 461944567, 100, 1),
  (2,  1865000, 410250770, 89, 2),
  (3,  1640000, 360756709, 78, 3),
  (4,  1445000, 317861857, 69, 4),
  (5,  1260000, 277166740, 60, 5),
  (6,  1095000, 240871095, 52, 6),
  (7,  940000,  206775187, 45, 7),
  (8,  795000,  174879015, 38, 8),
  (9,  645000,  141882974, 31, 9),
  (10, 525000,  115486142, 25, 10),
  (11, 420000,  92388913,  20, 11),
  (12, 335000,  73691157,  16, 12),
  (13, 265000,  58293005,  13, 13),
  (14, 205000,  45094589,  10, 14),
  (15, 155000,  34095908,  7, 15)
) AS v(pen_no, m3, gallons, pct, sort_order)
WHERE d.name = 'Avontuur'
ON CONFLICT (dam_id, pen_no) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dam_readings_date ON dam_level_readings (dam_id, reading_date);

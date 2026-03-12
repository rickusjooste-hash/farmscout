-- Seed nutrient_norms with standard SA mid-season leaf analysis norms
-- Sources: HORTGRO/DFPT deciduous norms, CRI citrus guidelines, Bemlab reference ranges
-- organisation_id = NULL → system defaults (org-specific rows override these)
-- Run in Supabase SQL Editor after 20260312_leaf_analysis.sql

-- Partial unique index for system defaults (org_id IS NULL)
-- The table UNIQUE constraint doesn't cover NULLs, so we need this for idempotent inserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrient_norms_system_defaults
  ON nutrient_norms (commodity_id, nutrient_id, sample_type)
  WHERE organisation_id IS NULL;

-- ── APPLE ────────────────────────────────────────────────────────────────────
-- commodity_id: 568df904-f53b-4171-9d84-033f58d07023

INSERT INTO nutrient_norms (organisation_id, commodity_id, nutrient_id, sample_type, min_optimal, max_optimal, min_adequate, max_adequate, unit, source)
SELECT NULL, '568df904-f53b-4171-9d84-033f58d07023', n.id, 'mid-season',
  v.min_optimal, v.max_optimal, v.min_adequate, v.max_adequate, v.unit,
  'HORTGRO/DFPT deciduous fruit norms'
FROM (VALUES
  ('N',  2.00, 2.40, 1.80, 2.60, '%'),
  ('P',  0.15, 0.23, 0.12, 0.30, '%'),
  ('K',  1.20, 1.60, 1.00, 2.00, '%'),
  ('Ca', 1.30, 2.00, 1.00, 2.50, '%'),
  ('Mg', 0.25, 0.40, 0.20, 0.50, '%'),
  ('S',  0.18, 0.30, 0.15, 0.40, '%'),
  ('Fe', 60,   200,  50,   300,  'mg/kg'),
  ('Mn', 30,   100,  25,   200,  'mg/kg'),
  ('Zn', 20,   50,   15,   80,   'mg/kg'),
  ('Cu', 6,    20,   4,    30,   'mg/kg'),
  ('B',  30,   50,   25,   70,   'mg/kg')
) AS v(code, min_optimal, max_optimal, min_adequate, max_adequate, unit)
JOIN nutrients n ON n.code = v.code
ON CONFLICT (commodity_id, nutrient_id, sample_type) WHERE organisation_id IS NULL DO NOTHING;


-- ── PEAR ─────────────────────────────────────────────────────────────────────
-- commodity_id: f0415f88-b593-4972-a1b4-2abd9d5c87cb

INSERT INTO nutrient_norms (organisation_id, commodity_id, nutrient_id, sample_type, min_optimal, max_optimal, min_adequate, max_adequate, unit, source)
SELECT NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', n.id, 'mid-season',
  v.min_optimal, v.max_optimal, v.min_adequate, v.max_adequate, v.unit,
  'HORTGRO/DFPT deciduous fruit norms'
FROM (VALUES
  ('N',  2.00, 2.40, 1.80, 2.60, '%'),
  ('P',  0.13, 0.22, 0.10, 0.30, '%'),
  ('K',  1.00, 1.50, 0.80, 1.80, '%'),
  ('Ca', 1.50, 2.20, 1.20, 2.80, '%'),
  ('Mg', 0.28, 0.45, 0.22, 0.55, '%'),
  ('S',  0.18, 0.30, 0.15, 0.40, '%'),
  ('Fe', 60,   200,  50,   300,  'mg/kg'),
  ('Mn', 35,   100,  25,   200,  'mg/kg'),
  ('Zn', 20,   50,   15,   80,   'mg/kg'),
  ('Cu', 6,    20,   4,    30,   'mg/kg'),
  ('B',  25,   50,   20,   70,   'mg/kg')
) AS v(code, min_optimal, max_optimal, min_adequate, max_adequate, unit)
JOIN nutrients n ON n.code = v.code
ON CONFLICT (commodity_id, nutrient_id, sample_type) WHERE organisation_id IS NULL DO NOTHING;


-- ── NECTARINE ────────────────────────────────────────────────────────────────
-- commodity_id: da106a75-6fbb-4720-b498-be73f1a6d120

INSERT INTO nutrient_norms (organisation_id, commodity_id, nutrient_id, sample_type, min_optimal, max_optimal, min_adequate, max_adequate, unit, source)
SELECT NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', n.id, 'mid-season',
  v.min_optimal, v.max_optimal, v.min_adequate, v.max_adequate, v.unit,
  'HORTGRO/DFPT stone fruit norms'
FROM (VALUES
  ('N',  2.80, 3.30, 2.40, 3.60, '%'),
  ('P',  0.15, 0.25, 0.12, 0.35, '%'),
  ('K',  2.00, 3.00, 1.50, 3.50, '%'),
  ('Ca', 1.80, 2.80, 1.50, 3.50, '%'),
  ('Mg', 0.40, 0.70, 0.30, 0.90, '%'),
  ('S',  0.18, 0.30, 0.15, 0.40, '%'),
  ('Fe', 80,   250,  60,   350,  'mg/kg'),
  ('Mn', 40,   160,  30,   250,  'mg/kg'),
  ('Zn', 20,   50,   15,   80,   'mg/kg'),
  ('Cu', 6,    20,   4,    30,   'mg/kg'),
  ('B',  25,   60,   20,   80,   'mg/kg')
) AS v(code, min_optimal, max_optimal, min_adequate, max_adequate, unit)
JOIN nutrients n ON n.code = v.code
ON CONFLICT (commodity_id, nutrient_id, sample_type) WHERE organisation_id IS NULL DO NOTHING;


-- ── PEACH ────────────────────────────────────────────────────────────────────
-- commodity_id: b94a3ed1-935e-41f3-b8f2-889aeaffdd0b

INSERT INTO nutrient_norms (organisation_id, commodity_id, nutrient_id, sample_type, min_optimal, max_optimal, min_adequate, max_adequate, unit, source)
SELECT NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', n.id, 'mid-season',
  v.min_optimal, v.max_optimal, v.min_adequate, v.max_adequate, v.unit,
  'HORTGRO/DFPT stone fruit norms'
FROM (VALUES
  ('N',  2.80, 3.50, 2.40, 3.80, '%'),
  ('P',  0.15, 0.28, 0.12, 0.35, '%'),
  ('K',  2.00, 3.00, 1.50, 3.50, '%'),
  ('Ca', 1.80, 2.80, 1.50, 3.50, '%'),
  ('Mg', 0.40, 0.70, 0.30, 0.90, '%'),
  ('S',  0.18, 0.30, 0.15, 0.40, '%'),
  ('Fe', 80,   250,  60,   350,  'mg/kg'),
  ('Mn', 40,   160,  30,   250,  'mg/kg'),
  ('Zn', 20,   50,   15,   80,   'mg/kg'),
  ('Cu', 6,    20,   4,    30,   'mg/kg'),
  ('B',  25,   60,   20,   80,   'mg/kg')
) AS v(code, min_optimal, max_optimal, min_adequate, max_adequate, unit)
JOIN nutrients n ON n.code = v.code
ON CONFLICT (commodity_id, nutrient_id, sample_type) WHERE organisation_id IS NULL DO NOTHING;


-- ── CITRUS ───────────────────────────────────────────────────────────────────
-- commodity_id: 8431f19e-5614-4d9b-9da8-811be03e485d

INSERT INTO nutrient_norms (organisation_id, commodity_id, nutrient_id, sample_type, min_optimal, max_optimal, min_adequate, max_adequate, unit, source)
SELECT NULL, '8431f19e-5614-4d9b-9da8-811be03e485d', n.id, 'mid-season',
  v.min_optimal, v.max_optimal, v.min_adequate, v.max_adequate, v.unit,
  'CRI Citrus Nutrition Guidelines'
FROM (VALUES
  ('N',  2.30, 2.70, 2.20, 2.90, '%'),
  ('P',  0.12, 0.17, 0.09, 0.22, '%'),
  ('K',  1.00, 1.50, 0.70, 1.90, '%'),
  ('Ca', 3.50, 5.50, 3.00, 7.00, '%'),
  ('Mg', 0.30, 0.50, 0.25, 0.70, '%'),
  ('S',  0.20, 0.35, 0.18, 0.45, '%'),
  ('Fe', 60,   120,  40,   200,  'mg/kg'),
  ('Mn', 25,   100,  18,   200,  'mg/kg'),
  ('Zn', 25,   100,  18,   200,  'mg/kg'),
  ('Cu', 5,    15,   4,    20,   'mg/kg'),
  ('B',  36,   100,  25,   200,  'mg/kg')
) AS v(code, min_optimal, max_optimal, min_adequate, max_adequate, unit)
JOIN nutrients n ON n.code = v.code
ON CONFLICT (commodity_id, nutrient_id, sample_type) WHERE organisation_id IS NULL DO NOTHING;

-- ================================================================
-- Patch 3: Fix commodity_pests unique constraint + re-run QC issues
-- ================================================================
--
-- Problem: commodity_pests has UNIQUE(commodity_id, pest_id) but we need
-- the same pest to appear in multiple categories (trap_pest + qc_issue).
--
-- Fix: drop the old constraint, add UNIQUE(commodity_id, pest_id, category).
-- Then re-insert all QC/picking issues using ON CONFLICT to be idempotent.
--
-- Safe to run after a partial run of 20260304_qc_issues_seed.sql.
-- Run AFTER 20260304_qc_issues_seed.sql (which adds name_af columns + pests).
-- ================================================================

-- ── 1. Add bilingual columns (seed rollback recovery) ─────────────────────

ALTER TABLE public.pests          ADD COLUMN IF NOT EXISTS name_af        text;
ALTER TABLE public.commodity_pests ADD COLUMN IF NOT EXISTS display_name_af text;

-- ── 2. Ensure QC enum values exist ────────────────────────────────────────

ALTER TYPE observation_category ADD VALUE IF NOT EXISTS 'qc_issue';
ALTER TYPE observation_category ADD VALUE IF NOT EXISTS 'picking_issue';

-- ── 3. Insert any new pests (WHERE NOT EXISTS — safe to re-run) ───────────

INSERT INTO public.pests (name, name_af)
SELECT v.en, v.af
FROM (VALUES
  ('Bruising',              'Kneusing'),
  ('Stem',                  'Stingel'),
  ('Injury',                'Besering'),
  ('Leaves & Fruit Buds',   'Blare en Vrugknoppies'),
  ('Sunburn',               'Sonbrand'),
  ('Misshapen',             'Misvorm'),
  ('Skin Cracks',           'Barse'),
  ('Weevil',                'Kalander'),
  ('Fruit Fly',             'Vrugtevlieg'),
  ('Antestia',              'Antestia'),
  ('Bryobia Mite',          'Bryobia Myt'),
  ('Codling Moth',          'Kodlingmot'),
  ('Bollworm',              'Bolwurm'),
  ('Scuffing',              'Skaaf'),
  ('Hail Damage',           'Haelskade'),
  ('Fusicoccum',            'Fusi'),
  ('Cork',                  'Koki'),
  ('Thrips',                'Blaaspootjie'),
  ('Bird Damage',           'Voelskade'),
  ('Wind Marks',            'Windmerke'),
  ('Woolly Aphid',          'Bloedluis'),
  ('Bitter Pit',            'Bitterpit'),
  ('Mealybug',              'Witluis'),
  ('Red Spider Mite',       'RSM'),
  ('Russet',                'Russet'),
  ('Cork Spot',             'Kurkvlek'),
  ('Unknown',               'Onbekend'),
  ('Water Core',            'Waterkern'),
  ('Scale',                 'Dopluis'),
  ('Puffer',                'Puffer'),
  ('Wind Damage',           'Windskade'),
  ('Snail Damage',          'Slakskade'),
  ('Thorn Damage',          'Doringskade'),
  ('Bud Mite',              'Knopmyt'),
  ('False Codling Moth',    'Valse Kodlingmot'),
  ('Leaf Miner',            'Blaarmyner'),
  ('Leafhopper',            'Bladspringer'),
  ('Citrus Swallowtail',    'Lemoenvlinder'),
  ('Aphid',                 'Plantluis'),
  ('Flat Mite',             'Platmyt'),
  ('Red Scale',             'Rooi Dopluis'),
  ('Red Mite',              'Rooiymyt'),
  ('Soft Brown Scale',      'Sagte Bruin Dopluis'),
  ('Silver Mite',           'Silwermyt'),
  ('Cottony Cushion Scale', 'Australiese Wolluis'),
  ('Wax Scale',             'Wasdopluis'),
  ('Cracks',                'Krake'),
  ('Oriental Fruit Moth',   'OVM'),
  ('Mite Damage',           'Myte'),
  ('Split',                 'Split'),
  ('Leaf Curl',             'Krulblaar'),
  ('Soft / Overripe',       'Sag')
) AS v(en, af)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pests p WHERE lower(p.name) = lower(v.en)
);

-- Update name_af on pests that already existed (e.g. from scout app)
UPDATE public.pests SET name_af = v.af
FROM (VALUES
  ('Bruising',              'Kneusing'),
  ('Stem',                  'Stingel'),
  ('Injury',                'Besering'),
  ('Leaves & Fruit Buds',   'Blare en Vrugknoppies'),
  ('Sunburn',               'Sonbrand'),
  ('Misshapen',             'Misvorm'),
  ('Skin Cracks',           'Barse'),
  ('Weevil',                'Kalander'),
  ('Fruit Fly',             'Vrugtevlieg'),
  ('Antestia',              'Antestia'),
  ('Bryobia Mite',          'Bryobia Myt'),
  ('Codling Moth',          'Kodlingmot'),
  ('Bollworm',              'Bolwurm'),
  ('Scuffing',              'Skaaf'),
  ('Hail Damage',           'Haelskade'),
  ('Fusicoccum',            'Fusi'),
  ('Cork',                  'Koki'),
  ('Thrips',                'Blaaspootjie'),
  ('Bird Damage',           'Voelskade'),
  ('Wind Marks',            'Windmerke'),
  ('Woolly Aphid',          'Bloedluis'),
  ('Bitter Pit',            'Bitterpit'),
  ('Mealybug',              'Witluis'),
  ('Red Spider Mite',       'RSM'),
  ('Russet',                'Russet'),
  ('Cork Spot',             'Kurkvlek'),
  ('Unknown',               'Onbekend'),
  ('Water Core',            'Waterkern'),
  ('Scale',                 'Dopluis'),
  ('Puffer',                'Puffer'),
  ('Wind Damage',           'Windskade'),
  ('Snail Damage',          'Slakskade'),
  ('Thorn Damage',          'Doringskade'),
  ('Bud Mite',              'Knopmyt'),
  ('False Codling Moth',    'Valse Kodlingmot'),
  ('Leaf Miner',            'Blaarmyner'),
  ('Leafhopper',            'Bladspringer'),
  ('Citrus Swallowtail',    'Lemoenvlinder'),
  ('Aphid',                 'Plantluis'),
  ('Flat Mite',             'Platmyt'),
  ('Red Scale',             'Rooi Dopluis'),
  ('Red Mite',              'Rooiymyt'),
  ('Soft Brown Scale',      'Sagte Bruin Dopluis'),
  ('Silver Mite',           'Silwermyt'),
  ('Cottony Cushion Scale', 'Australiese Wolluis'),
  ('Wax Scale',             'Wasdopluis'),
  ('Cracks',                'Krake'),
  ('Oriental Fruit Moth',   'OVM'),
  ('Mite Damage',           'Myte'),
  ('Split',                 'Split'),
  ('Leaf Curl',             'Krulblaar'),
  ('Soft / Overripe',       'Sag')
) AS v(en, af)
WHERE lower(public.pests.name) = lower(v.en)
  AND public.pests.name_af IS NULL;

-- ── 4. Fix the unique constraint ───────────────────────────────────────────

ALTER TABLE public.commodity_pests
  DROP CONSTRAINT IF EXISTS commodity_pests_commodity_id_pest_id_key;

ALTER TABLE public.commodity_pests
  ADD CONSTRAINT commodity_pests_commodity_id_pest_id_category_key
  UNIQUE (commodity_id, pest_id, category);

-- ── 2. Re-run all QC/picking inserts — idempotent ────────────────────────
-- Uses ON CONFLICT to update names without changing anything else.
-- Commodity IDs:
--   Apple:     568df904-f53b-4171-9d84-033f58d07023
--   Pear:      f0415f88-b593-4972-a1b4-2abd9d5c87cb
--   Citrus:    8431f19e-5614-4d9b-9da8-811be03e485d
--   Nectarine: da106a75-6fbb-4720-b498-be73f1a6d120
--   Peach:     b94a3ed1-935e-41f3-b8f2-889aeaffdd0b

-- ── APPLE — picking issues ────────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT '568df904-f53b-4171-9d84-033f58d07023', p.id,
  'picking_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Bruising',            'Kneusing',              1),
  ('Stem',                'Stingel',               2),
  ('Injury',              'Besering',              3),
  ('Leaves & Fruit Buds', 'Blare en Vrugknoppies', 4)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── APPLE — QC issues ─────────────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT '568df904-f53b-4171-9d84-033f58d07023', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Sunburn',         'Sonbrand',      1),
  ('Misshapen',       'Misvorm',       2),
  ('Skin Cracks',     'Barse',         3),
  ('Weevil',          'Kalander',      4),
  ('Fruit Fly',       'Vrugtevlieg',   5),
  ('Antestia',        'Antestia',      6),
  ('Bryobia Mite',    'Bryobia Myt',   7),
  ('Codling Moth',    'Kodlingmot',    8),
  ('Bollworm',        'Bolwurm',       9),
  ('Scuffing',        'Skaaf',        10),
  ('Hail Damage',     'Haelskade',    11),
  ('Fusicoccum',      'Fusi',         12),
  ('Cork',            'Koki',         13),
  ('Thrips',          'Blaaspootjie', 14),
  ('Bird Damage',     'Voelskade',    15),
  ('Wind Marks',      'Windmerke',    16),
  ('Woolly Aphid',    'Bloedluis',    17),
  ('Bitter Pit',      'Bitterpit',    18),
  ('Mealybug',        'Witluis',      19),
  ('Red Spider Mite', 'RSM',          20),
  ('Russet',          'Russet',       21),
  ('Cork Spot',       'Kurkvlek',     22),
  ('Unknown',         'Onbekend',     23),
  ('Water Core',      'Waterkern',    24),
  ('Scale',           'Dopluis',      25),
  ('Puffer',          'Puffer',       26)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── PEAR — picking issues ─────────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', p.id,
  'picking_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Bruising',            'Kneusing',              1),
  ('Stem',                'Stingel',               2),
  ('Injury',              'Besering',              3),
  ('Leaves & Fruit Buds', 'Blare en Vrugknoppies', 4)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── PEAR — QC issues ──────────────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Sunburn',         'Sonbrand',      1),
  ('Misshapen',       'Misvorm',       2),
  ('Skin Cracks',     'Barse',         3),
  ('Weevil',          'Kalander',      4),
  ('Fruit Fly',       'Vrugtevlieg',   5),
  ('Antestia',        'Antestia',      6),
  ('Bryobia Mite',    'Bryobia Myt',   7),
  ('Codling Moth',    'Kodlingmot',    8),
  ('Bollworm',        'Bolwurm',       9),
  ('Scuffing',        'Skaaf',        10),
  ('Hail Damage',     'Haelskade',    11),
  ('Fusicoccum',      'Fusi',         12),
  ('Cork',            'Koki',         13),
  ('Thrips',          'Blaaspootjie', 14),
  ('Bird Damage',     'Voelskade',    15),
  ('Wind Marks',      'Windmerke',    16),
  ('Woolly Aphid',    'Bloedluis',    17),
  ('Bitter Pit',      'Bitterpit',    18),
  ('Mealybug',        'Witluis',      19),
  ('Red Spider Mite', 'RSM',          20),
  ('Russet',          'Russet',       21),
  ('Cork Spot',       'Kurkvlek',     22),
  ('Unknown',         'Onbekend',     23),
  ('Water Core',      'Waterkern',    24),
  ('Scale',           'Dopluis',      25),
  ('Puffer',          'Puffer',       26)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── CITRUS — picking issues ───────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT '8431f19e-5614-4d9b-9da8-811be03e485d', p.id,
  'picking_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Bruising', 'Kneusing', 1),
  ('Stem',     'Stingel',  2),
  ('Injury',   'Besering', 3)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── CITRUS — QC issues ────────────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT '8431f19e-5614-4d9b-9da8-811be03e485d', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Sunburn',               'Sonbrand',             1),
  ('Wind Damage',           'Windskade',            2),
  ('Snail Damage',          'Slakskade',            3),
  ('Misshapen',             'Misvorm',              4),
  ('Thorn Damage',          'Doringskade',          5),
  ('Mealybug',              'Witluis',              6),
  ('Bud Mite',              'Knopmyt',              7),
  ('False Codling Moth',    'Valse Kodlingmot',     8),
  ('Fruit Fly',             'Vrugtevlieg',          9),
  ('Leaf Miner',            'Blaarmyner',          10),
  ('Thrips',                'Blaaspootjie',        11),
  ('Leafhopper',            'Bladspringer',        12),
  ('Bollworm',              'Bolwurm',             13),
  ('Citrus Swallowtail',    'Lemoenvlinder',       14),
  ('Aphid',                 'Plantluis',           15),
  ('Flat Mite',             'Platmyt',             16),
  ('Red Scale',             'Rooi Dopluis',        17),
  ('Red Mite',              'Rooiymyt',            18),
  ('Soft Brown Scale',      'Sagte Bruin Dopluis', 19),
  ('Silver Mite',           'Silwermyt',           20),
  ('Cottony Cushion Scale', 'Australiese Wolluis', 21),
  ('Wax Scale',             'Wasdopluis',          22),
  ('Unknown',               'Onbekend',            23)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── NECTARINE — picking issues ────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'da106a75-6fbb-4720-b498-be73f1a6d120', p.id,
  'picking_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Bruising', 'Kneusing', 1),
  ('Stem',     'Stingel',  2),
  ('Injury',   'Besering', 3)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── NECTARINE — QC issues ─────────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'da106a75-6fbb-4720-b498-be73f1a6d120', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Cracks',              'Krake',             1),
  ('Wind Damage',         'Windskade',         2),
  ('Misshapen',           'Misvorm',           3),
  ('Thrips',              'Blaaspootjie',      4),
  ('Bollworm',            'Bolwurm',           5),
  ('Mite Damage',         'Myte',              6),
  ('Scale',               'Dopluis',           7),
  ('Weevil',              'Kalander',          8),
  ('Oriental Fruit Moth', 'OVM',               9),
  ('Aphid',               'Plantluis',        10),
  ('False Codling Moth',  'Valse Kodlingmot', 11),
  ('Split',               'Split',            12),
  ('Bird Damage',         'Voelskade',        13),
  ('Leaf Curl',           'Krulblaar',        14),
  ('Soft / Overripe',     'Sag',              15),
  ('Snail Damage',        'Slakskade',        16),
  ('Unknown',             'Onbekend',         17)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── PEACH — picking issues ────────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', p.id,
  'picking_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Bruising', 'Kneusing', 1),
  ('Stem',     'Stingel',  2),
  ('Injury',   'Besering', 3)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

-- ── PEACH — QC issues ─────────────────────────────────────────────────────
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Cracks',              'Krake',             1),
  ('Wind Damage',         'Windskade',         2),
  ('Misshapen',           'Misvorm',           3),
  ('Thrips',              'Blaaspootjie',      4),
  ('Bollworm',            'Bolwurm',           5),
  ('Mite Damage',         'Myte',              6),
  ('Scale',               'Dopluis',           7),
  ('Weevil',              'Kalander',          8),
  ('Oriental Fruit Moth', 'OVM',               9),
  ('Aphid',               'Plantluis',        10),
  ('False Codling Moth',  'Valse Kodlingmot', 11),
  ('Split',               'Split',            12),
  ('Bird Damage',         'Voelskade',        13),
  ('Leaf Curl',           'Krulblaar',        14),
  ('Soft / Overripe',     'Sag',              15),
  ('Snail Damage',        'Slakskade',        16),
  ('Unknown',             'Onbekend',         17)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
ON CONFLICT (commodity_id, pest_id, category)
  DO UPDATE SET display_name    = EXCLUDED.display_name,
               display_name_af = EXCLUDED.display_name_af;

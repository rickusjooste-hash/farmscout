-- ================================================================
-- QC Issues — bilingual seed data (English + Afrikaans)
-- Derived from QC_Picking.xlsx (AppSheet source)
--
-- Run AFTER 20260304_qc_schema.sql (requires qc_issue + picking_issue
-- enum values to already exist in observation_category).
--
-- Commodity IDs (this farm):
--   Apple:     568df904-f53b-4171-9d84-033f58d07023
--   Pear:      f0415f88-b593-4972-a1b4-2abd9d5c87cb
--   Citrus:    8431f19e-5614-4d9b-9da8-811be03e485d
--   Nectarine: da106a75-6fbb-4720-b498-be73f1a6d120
--   Peach:     b94a3ed1-935e-41f3-b8f2-889aeaffdd0b
--
-- Uncertain translations (confirm with farm manager):
--   KOKI       → "Cork" (suspected: hard/corky texture defect)
--   RSM        → "Red Spider Mite" (Rooispinnekop Myt)
--   FUSI       → "Fusicoccum" (fungal stem-end rot)
--   OVM        → "Oriental Fruit Moth" (Oosterse Vrugte Mot)
--   PUFFER     → "Puffer" (hollow/air-space apple/pear, SA industry term)
-- ================================================================

-- ── 1. Add bilingual columns ──────────────────────────────────

ALTER TABLE public.pests          ADD COLUMN IF NOT EXISTS name_af        text;
ALTER TABLE public.commodity_pests ADD COLUMN IF NOT EXISTS display_name_af text;

-- ── 2. Ensure qc enum values exist ───────────────────────────
-- (already run in 20260304_qc_schema.sql — kept for safety)
ALTER TYPE observation_category ADD VALUE IF NOT EXISTS 'qc_issue';
ALTER TYPE observation_category ADD VALUE IF NOT EXISTS 'picking_issue';

-- ── 3. Insert all unique QC pests ────────────────────────────
-- Uses WHERE NOT EXISTS (case-insensitive) so it's safe to re-run
-- and won't duplicate pests that already exist from the scout app.

INSERT INTO public.pests (name, name_af)
SELECT v.en, v.af
FROM (VALUES
  -- Picking issues (universal)
  ('Bruising',               'Kneusing'),
  ('Stem',                   'Stingel'),
  ('Injury',                 'Besering'),
  ('Leaves & Fruit Buds',    'Blare en Vrugknoppies'),

  -- Pome fruit QC issues (Apple + Pear)
  ('Sunburn',                'Sonbrand'),
  ('Misshapen',              'Misvorm'),
  ('Skin Cracks',            'Barse'),
  ('Weevil',                 'Kalander'),
  ('Fruit Fly',              'Vrugtevlieg'),
  ('Antestia',               'Antestia'),
  ('Bryobia Mite',           'Bryobia Myt'),
  ('Codling Moth',           'Kodlingmot'),
  ('Bollworm',               'Bolwurm'),
  ('Scuffing',               'Skaaf'),
  ('Hail Damage',            'Haelskade'),
  ('Fusicoccum',             'Fusi'),
  ('Cork',                   'Koki'),
  ('Thrips',                 'Blaaspootjie'),
  ('Bird Damage',            'Voelskade'),
  ('Wind Marks',             'Windmerke'),
  ('Woolly Aphid',           'Bloedluis'),
  ('Bitter Pit',             'Bitterpit'),
  ('Mealybug',               'Witluis'),
  ('Red Spider Mite',        'RSM'),
  ('Russet',                 'Russet'),
  ('Cork Spot',              'Kurkvlek'),
  ('Unknown',                'Onbekend'),
  ('Water Core',             'Waterkern'),
  ('Scale',                  'Dopluis'),
  ('Puffer',                 'Puffer'),

  -- Citrus QC issues (Lemons + Mandarins combined)
  ('Wind Damage',            'Windskade'),
  ('Snail Damage',           'Slakskade'),
  ('Thorn Damage',           'Doringskade'),
  ('Bud Mite',               'Knopmyt'),
  ('False Codling Moth',     'Valse Kodlingmot'),
  ('Leaf Miner',             'Blaarmyner'),
  ('Leafhopper',             'Bladspringer'),
  ('Citrus Swallowtail',     'Lemoenvlinder'),
  ('Aphid',                  'Plantluis'),
  ('Flat Mite',              'Platmyt'),
  ('Red Scale',              'Rooi Dopluis'),
  ('Red Mite',               'Rooiymyt'),
  ('Soft Brown Scale',       'Sagte Bruin Dopluis'),
  ('Silver Mite',            'Silwermyt'),
  ('Cottony Cushion Scale',  'Australiese Wolluis'),
  ('Wax Scale',              'Wasdopluis'),

  -- Stonefruit QC issues (Nectarine + Peach)
  ('Cracks',                 'Krake'),
  ('Oriental Fruit Moth',    'OVM'),
  ('Mite Damage',            'Myte'),
  ('Split',                  'Split'),
  ('Leaf Curl',              'Krulblaar'),
  ('Soft / Overripe',        'Sag')
) AS v(en, af)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pests p WHERE lower(p.name) = lower(v.en)
);

-- Update name_af on existing pests (e.g. Codling Moth from scout app)
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

-- ── Helper macro: link pest to commodity ─────────────────────
-- Repeated pattern below: JOIN pests p ON lower(p.name) = lower(t.en)
-- + WHERE NOT EXISTS guard prevents duplicates on re-run.

-- ════════════════════════════════════════════════════════════
-- 4. APPLE
-- ════════════════════════════════════════════════════════════

-- Apple — picking issues
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT '568df904-f53b-4171-9d84-033f58d07023', p.id,
  'picking_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Bruising',            'Kneusing',                   1),
  ('Stem',                'Stingel',                    2),
  ('Injury',              'Besering',                   3),
  ('Leaves & Fruit Buds', 'Blare en Vrugknoppies',      4)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = '568df904-f53b-4171-9d84-033f58d07023'
    AND c.pest_id = p.id AND c.category = 'picking_issue'::observation_category);

-- Apple — QC issues
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT '568df904-f53b-4171-9d84-033f58d07023', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Sunburn',          'Sonbrand',       1),
  ('Misshapen',        'Misvorm',        2),
  ('Skin Cracks',      'Barse',          3),
  ('Weevil',           'Kalander',       4),
  ('Fruit Fly',        'Vrugtevlieg',    5),
  ('Antestia',         'Antestia',       6),
  ('Bryobia Mite',     'Bryobia Myt',    7),
  ('Codling Moth',     'Kodlingmot',     8),
  ('Bollworm',         'Bolwurm',        9),
  ('Scuffing',         'Skaaf',         10),
  ('Hail Damage',      'Haelskade',     11),
  ('Fusicoccum',       'Fusi',          12),
  ('Cork',             'Koki',          13),
  ('Thrips',           'Blaaspootjie',  14),
  ('Bird Damage',      'Voelskade',     15),
  ('Wind Marks',       'Windmerke',     16),
  ('Woolly Aphid',     'Bloedluis',     17),
  ('Bitter Pit',       'Bitterpit',     18),
  ('Mealybug',         'Witluis',       19),
  ('Red Spider Mite',  'RSM',           20),
  ('Russet',           'Russet',        21),
  ('Cork Spot',        'Kurkvlek',      22),
  ('Unknown',          'Onbekend',      23),
  ('Water Core',       'Waterkern',     24),
  ('Scale',            'Dopluis',       25),
  ('Puffer',           'Puffer',        26)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = '568df904-f53b-4171-9d84-033f58d07023'
    AND c.pest_id = p.id AND c.category = 'qc_issue'::observation_category);

-- ════════════════════════════════════════════════════════════
-- 5. PEAR  (identical issue list to Apple)
-- ════════════════════════════════════════════════════════════

-- Pear — picking issues
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', p.id,
  'picking_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Bruising',            'Kneusing',                   1),
  ('Stem',                'Stingel',                    2),
  ('Injury',              'Besering',                   3),
  ('Leaves & Fruit Buds', 'Blare en Vrugknoppies',      4)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = 'f0415f88-b593-4972-a1b4-2abd9d5c87cb'
    AND c.pest_id = p.id AND c.category = 'picking_issue'::observation_category);

-- Pear — QC issues
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Sunburn',          'Sonbrand',       1),
  ('Misshapen',        'Misvorm',        2),
  ('Skin Cracks',      'Barse',          3),
  ('Weevil',           'Kalander',       4),
  ('Fruit Fly',        'Vrugtevlieg',    5),
  ('Antestia',         'Antestia',       6),
  ('Bryobia Mite',     'Bryobia Myt',    7),
  ('Codling Moth',     'Kodlingmot',     8),
  ('Bollworm',         'Bolwurm',        9),
  ('Scuffing',         'Skaaf',         10),
  ('Hail Damage',      'Haelskade',     11),
  ('Fusicoccum',       'Fusi',          12),
  ('Cork',             'Koki',          13),
  ('Thrips',           'Blaaspootjie',  14),
  ('Bird Damage',      'Voelskade',     15),
  ('Wind Marks',       'Windmerke',     16),
  ('Woolly Aphid',     'Bloedluis',     17),
  ('Bitter Pit',       'Bitterpit',     18),
  ('Mealybug',         'Witluis',       19),
  ('Red Spider Mite',  'RSM',           20),
  ('Russet',           'Russet',        21),
  ('Cork Spot',        'Kurkvlek',      22),
  ('Unknown',          'Onbekend',      23),
  ('Water Core',       'Waterkern',     24),
  ('Scale',            'Dopluis',       25),
  ('Puffer',           'Puffer',        26)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = 'f0415f88-b593-4972-a1b4-2abd9d5c87cb'
    AND c.pest_id = p.id AND c.category = 'qc_issue'::observation_category);

-- ════════════════════════════════════════════════════════════
-- 6. CITRUS  (Lemons + Mandarins combined — identical columns)
-- ════════════════════════════════════════════════════════════

-- Citrus — picking issues
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = '8431f19e-5614-4d9b-9da8-811be03e485d'
    AND c.pest_id = p.id AND c.category = 'picking_issue'::observation_category);

-- Citrus — QC issues
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT '8431f19e-5614-4d9b-9da8-811be03e485d', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Sunburn',               'Sonbrand',              1),
  ('Wind Damage',           'Windskade',             2),
  ('Snail Damage',          'Slakskade',             3),
  ('Misshapen',             'Misvorm',               4),
  ('Thorn Damage',          'Doringskade',           5),
  ('Mealybug',              'Witluis',               6),
  ('Bud Mite',              'Knopmyt',               7),
  ('False Codling Moth',    'Valse Kodlingmot',       8),
  ('Fruit Fly',             'Vrugtevlieg',           9),
  ('Leaf Miner',            'Blaarmyner',           10),
  ('Thrips',                'Blaaspootjie',         11),
  ('Leafhopper',            'Bladspringer',         12),
  ('Bollworm',              'Bolwurm',              13),
  ('Citrus Swallowtail',    'Lemoenvlinder',        14),
  ('Aphid',                 'Plantluis',            15),
  ('Flat Mite',             'Platmyt',              16),
  ('Red Scale',             'Rooi Dopluis',         17),
  ('Red Mite',              'Rooiymyt',             18),
  ('Soft Brown Scale',      'Sagte Bruin Dopluis',  19),
  ('Silver Mite',           'Silwermyt',            20),
  ('Cottony Cushion Scale', 'Australiese Wolluis',  21),
  ('Wax Scale',             'Wasdopluis',           22),
  ('Unknown',               'Onbekend',             23)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = '8431f19e-5614-4d9b-9da8-811be03e485d'
    AND c.pest_id = p.id AND c.category = 'qc_issue'::observation_category);

-- ════════════════════════════════════════════════════════════
-- 7. NECTARINE  (Stonefruit sheet)
-- ════════════════════════════════════════════════════════════

-- Nectarine — picking issues
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = 'da106a75-6fbb-4720-b498-be73f1a6d120'
    AND c.pest_id = p.id AND c.category = 'picking_issue'::observation_category);

-- Nectarine — QC issues
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'da106a75-6fbb-4720-b498-be73f1a6d120', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Cracks',               'Krake',              1),
  ('Wind Damage',          'Windskade',          2),
  ('Misshapen',            'Misvorm',            3),
  ('Thrips',               'Blaaspootjie',       4),
  ('Bollworm',             'Bolwurm',            5),
  ('Mite Damage',          'Myte',               6),
  ('Scale',                'Dopluis',            7),
  ('Weevil',               'Kalander',           8),
  ('Oriental Fruit Moth',  'OVM',                9),
  ('Aphid',                'Plantluis',         10),
  ('False Codling Moth',   'Valse Kodlingmot',  11),
  ('Split',                'Split',             12),
  ('Bird Damage',          'Voelskade',         13),
  ('Leaf Curl',            'Krulblaar',         14),
  ('Soft / Overripe',      'Sag',               15),
  ('Snail Damage',         'Slakskade',         16),
  ('Unknown',              'Onbekend',          17)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = 'da106a75-6fbb-4720-b498-be73f1a6d120'
    AND c.pest_id = p.id AND c.category = 'qc_issue'::observation_category);

-- ════════════════════════════════════════════════════════════
-- 8. PEACH  (identical to Nectarine)
-- ════════════════════════════════════════════════════════════

-- Peach — picking issues
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b'
    AND c.pest_id = p.id AND c.category = 'picking_issue'::observation_category);

-- Peach — QC issues
INSERT INTO public.commodity_pests
  (commodity_id, pest_id, category, display_name, display_name_af, display_order, is_active)
SELECT 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', p.id,
  'qc_issue'::observation_category, t.en, t.af, t.ord, true
FROM (VALUES
  ('Cracks',               'Krake',              1),
  ('Wind Damage',          'Windskade',          2),
  ('Misshapen',            'Misvorm',            3),
  ('Thrips',               'Blaaspootjie',       4),
  ('Bollworm',             'Bolwurm',            5),
  ('Mite Damage',          'Myte',               6),
  ('Scale',                'Dopluis',            7),
  ('Weevil',               'Kalander',           8),
  ('Oriental Fruit Moth',  'OVM',                9),
  ('Aphid',                'Plantluis',         10),
  ('False Codling Moth',   'Valse Kodlingmot',  11),
  ('Split',                'Split',             12),
  ('Bird Damage',          'Voelskade',         13),
  ('Leaf Curl',            'Krulblaar',         14),
  ('Soft / Overripe',      'Sag',               15),
  ('Snail Damage',         'Slakskade',         16),
  ('Unknown',              'Onbekend',          17)
) t(en, af, ord)
JOIN public.pests p ON lower(p.name) = lower(t.en)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commodity_pests c
  WHERE c.commodity_id = 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b'
    AND c.pest_id = p.id AND c.category = 'qc_issue'::observation_category);

-- ============================================================
-- Crop coefficients by variety group
-- Different varieties of the same commodity have different harvest
-- dates, so their phenological stages (and thus Kc) differ by month.
-- ============================================================

-- 1. Add variety_group column
ALTER TABLE public.crop_coefficients
  ADD COLUMN IF NOT EXISTS variety_group text;

-- 2. Drop the old unique constraint and add the new one
ALTER TABLE public.crop_coefficients
  DROP CONSTRAINT IF EXISTS crop_coefficients_organisation_id_commodity_id_month_key;

ALTER TABLE public.crop_coefficients
  ADD CONSTRAINT crop_coefficients_org_commodity_vg_month_key
  UNIQUE (organisation_id, commodity_id, variety_group, month);

-- 3. Delete old generic seed data (will be replaced by variety-specific)
DELETE FROM public.crop_coefficients
  WHERE organisation_id IS NULL
    AND variety_group IS NULL;

-- 4. Insert variety-specific Kc values (FAO 56 adapted for Western Cape)

-- ── APPLES ───────────────────────────────────────────────────────────────────
-- AP_EARLY: Gala, Red
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              1, 1.05, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              2, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              3, 0.65, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              4, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              5, 0.40, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',              9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',             10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',             11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Gala',             12, 1.00, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               1, 1.05, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               2, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               3, 0.65, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               4, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               5, 0.40, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',               9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',              10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',              11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Red',              12, 1.00, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- AP_MID: Golden Delicious
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   1, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   2, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   3, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   4, 0.60, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   5, 0.40, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',   9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',  10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',  11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Golden Delcious',  12, 1.05, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              1, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              2, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              3, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              4, 0.60, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              5, 0.40, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',              9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',             10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',             11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'PGDL',             12, 1.05, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- AP_LATE: Granny Smith, Early Granny Smith
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      1, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      2, 1.15, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      3, 0.95, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      4, 0.80, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      5, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',      9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',     10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',     11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',     12, 1.05, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 1, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 2, 1.15, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 3, 0.95, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 4, 0.80, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 5, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith', 9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith',10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith',11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Early Granny Smith',12, 1.05, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- AP_VLATE: Pink Lady, Cripps Red
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         1, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         2, 1.15, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         3, 1.15, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         4, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         5, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',         9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',        10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',        11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Pink Lady',        12, 1.05, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        1, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        2, 1.15, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        3, 1.15, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        4, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        5, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',        9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',       10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',       11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'Cripps Red',       12, 1.05, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- BUCHU (apple orchards tagged BUCHU — use Granny Smith curve as default)
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  1, 1.10, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  2, 1.15, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  3, 0.95, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  4, 0.80, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  5, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  6, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  7, 0.35, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  8, 0.45, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU',  9, 0.55, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU', 10, 0.75, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU', 11, 0.90, 'FAO 56 WC'),
  (NULL, '568df904-f53b-4171-9d84-033f58d07023', 'BUCHU', 12, 1.05, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- ── PEARS ────────────────────────────────────────────────────────────────────
-- PR_EARLY: Early BC
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           1, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           2, 0.65, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           3, 0.55, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           4, 0.45, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           5, 0.38, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           6, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           7, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           8, 0.45, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',           9, 0.55, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',          10, 0.75, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',          11, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Early BC',          12, 1.00, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- PR_MID: Packhams Triumph, WBC, ABATA, RSM
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   1, 1.05, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   2, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   3, 0.60, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   4, 0.50, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   5, 0.38, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   6, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   7, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   8, 0.45, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',   9, 0.55, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',  10, 0.75, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',  11, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packhams Triumph',  12, 1.00, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                1, 1.05, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                2, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                3, 0.60, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                4, 0.50, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                5, 0.38, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                6, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                7, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                8, 0.45, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',                9, 0.55, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',               10, 0.75, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',               11, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'WBC',               12, 1.00, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              1, 1.05, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              2, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              3, 0.60, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              4, 0.50, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              5, 0.38, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              6, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              7, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              8, 0.45, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',              9, 0.55, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',             10, 0.75, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',             11, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'ABATA',             12, 1.00, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                1, 1.05, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                2, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                3, 0.60, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                4, 0.50, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                5, 0.38, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                6, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                7, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                8, 0.45, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',                9, 0.55, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',               10, 0.75, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',               11, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'RSM',               12, 1.00, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- PR_LATE: Forelle
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            1, 1.05, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            2, 1.10, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            3, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            4, 0.60, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            5, 0.40, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            6, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            7, 0.35, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            8, 0.45, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',            9, 0.55, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',           10, 0.75, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',           11, 0.90, 'FAO 56 WC'),
  (NULL, 'f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',           12, 1.00, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- ── NECTARINES ───────────────────────────────────────────────────────────────
-- ST_VEARLY: Luciana, Honey Spring, Primrose (harvest Nov-Dec)
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            1, 0.60, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            2, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            3, 0.45, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',            9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',           10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',           11, 0.85, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Luciana',           12, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      1, 0.60, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      2, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      3, 0.45, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',      9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',     10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',     11, 0.85, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Honey Spring',     12, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          1, 0.60, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          2, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          3, 0.45, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',          9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',         10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',         11, 0.85, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Primrose',         12, 0.80, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- ST_EMID: Alpine (harvest Dec-Jan)
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            1, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            2, 0.60, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            3, 0.50, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',            9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',           10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',           11, 0.85, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Alpine',           12, 0.85, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            1, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            2, 0.60, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            3, 0.50, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',            9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',           10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',           11, 0.85, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'ALPINE',           12, 0.85, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- ST_MID: Fantasia, Garofa, Tiffany (harvest Jan)
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          1, 0.90, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          2, 0.60, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          3, 0.50, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',          9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',         10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',         11, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Fantasia',         12, 0.90, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            1, 0.90, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            2, 0.60, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            3, 0.50, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',            9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',           10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',           11, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Garofa',           12, 0.90, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           1, 0.90, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           2, 0.60, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           3, 0.50, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',           9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',          10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',          11, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Tiffany',          12, 0.90, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- ST_MLATE: Sunburst (harvest Jan-Feb)
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          1, 0.90, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          2, 0.75, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          3, 0.50, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          4, 0.38, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',          9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',         10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',         11, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'Sunburst',         12, 0.85, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- ST_LATE: August Red (harvest Feb-Mar)
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        1, 0.95, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        2, 0.85, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        3, 0.65, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        4, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        5, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        6, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        7, 0.30, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        8, 0.40, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',        9, 0.55, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',       10, 0.70, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',       11, 0.80, 'FAO 56 WC'),
  (NULL, 'da106a75-6fbb-4720-b498-be73f1a6d120', 'August Red',       12, 0.90, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- ── PEACHES ──────────────────────────────────────────────────────────────────
-- ST_EMID: Temptation (harvest Dec-Jan, same curve as Alpine nectarine)
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        1, 0.80, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        2, 0.60, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        3, 0.50, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        4, 0.38, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        5, 0.30, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        6, 0.30, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        7, 0.30, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        8, 0.40, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',        9, 0.55, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',       10, 0.70, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',       11, 0.85, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Temptation',       12, 0.85, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

-- ST_MLATE: Summersun (harvest Jan-Feb, same curve as Sunburst nectarine)
INSERT INTO public.crop_coefficients (organisation_id, commodity_id, variety_group, month, kc, source) VALUES
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         1, 0.90, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         2, 0.75, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         3, 0.50, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         4, 0.38, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         5, 0.30, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         6, 0.30, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         7, 0.30, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         8, 0.40, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',         9, 0.55, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',        10, 0.70, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',        11, 0.80, 'FAO 56 WC'),
  (NULL, 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Summersun',        12, 0.85, 'FAO 56 WC')
ON CONFLICT DO NOTHING;

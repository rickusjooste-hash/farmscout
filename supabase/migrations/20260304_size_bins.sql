-- Size bins seed data
-- Derived from packhouse spec sheet (Weight per fruit banding column)
-- Boundaries calculated as midpoints between adjacent count weights
-- Run in Supabase SQL Editor after 20260304_qc_schema.sql

-- ── PEAR (PR) ─────────────────────────────────────────────────────────────────
-- Count weights from spec: 38→333g, 45→280g, 46→250g, 52→215g, 60→200g,
--   70→175g, 80→156g, 84→146g, 90→140g, 96→130g, 112→111g, 120→104g, 134→96g

INSERT INTO size_bins (commodity_id, label, weight_min_g, weight_max_g, display_order) VALUES
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 38',  307, 999, 1),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 45',  265, 306, 2),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 46',  233, 264, 3),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 52',  208, 232, 4),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 60',  188, 207, 5),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 70',  166, 187, 6),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 80',  151, 165, 7),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 84',  143, 150, 8),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 90',  135, 142, 9),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 96',  121, 134, 10),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 112', 108, 120, 11),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 120', 100, 107, 12),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Count 134',   0,  99, 13);

-- ── APPLE (AP) ────────────────────────────────────────────────────────────────
-- Count weights from spec: 70→286g, 80→229g, 90→203g, 100→183g, 110→166g,
--   120→153g, 135→136g, 150→122g, 165→111g, 180→102g, 198→96g,
--   216→85g, 234→79g, 252→73g

INSERT INTO size_bins (commodity_id, label, weight_min_g, weight_max_g, display_order) VALUES
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 70',  258, 999, 1),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 80',  216, 257, 2),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 90',  193, 215, 3),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 100', 175, 192, 4),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 110', 160, 174, 5),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 120', 145, 159, 6),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 135', 129, 144, 7),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 150', 117, 128, 8),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 165', 107, 116, 9),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 180',  99, 106, 10),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 198',  91,  98, 11),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 216',  82,  90, 12),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 234',  76,  81, 13),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Count 252',   0,  75, 14);

-- ── CITRUS (CI) ───────────────────────────────────────────────────────────────
-- TODO: add citrus size bins once spec is provided
-- ('8431f19e-5614-4d9b-9da8-811be03e485d', ...)

-- ── NECTARINE (NE) ───────────────────────────────────────────────────────────
-- TODO: add nectarine size bins once spec is provided
-- ('da106a75-6fbb-4720-b498-be73f1a6d120', ...)

-- ── PEACH (PE) ───────────────────────────────────────────────────────────────
-- TODO: add peach size bins once spec is provided
-- ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', ...)

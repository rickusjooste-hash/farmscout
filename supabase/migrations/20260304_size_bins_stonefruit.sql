-- ============================================================
-- Size bins: Nectarine & Peach  (2.5 kg box standard)
-- ============================================================
--
-- Derivation: box_weight = 2500 g,  avg_fruit_g = 2500 / count
--
--   Oversize  > Count 13  (imaginary Count 12 = 208.3 g)
--     boundary = (208.3 + 192.3) / 2 = 200.3  ->  Oversize >= 201 g
--   Count 13  = 192.3 g  ->  180 – 200 g
--   Count 15  = 166.7 g  ->  153 – 179 g
--   Count 18  = 138.9 g  ->  132 – 152 g
--   Count 20  = 125.0 g  ->  117 – 131 g
--   Count 23  = 108.7 g  ->  105 – 116 g
--   Count 25  = 100.0 g  ->   95 – 104 g
--   Count 28  =  89.3 g  ->   87 –  94 g
--   Count 30  =  83.3 g  ->   80 –  86 g
--   Small     < Count 30  (imaginary Count 33 = 75.8 g)
--     boundary = (83.3 + 75.8) / 2 = 79.5   ->  Small <= 79 g
--
-- Run in Supabase SQL Editor after 20260304_qc_schema.sql
-- ============================================================

-- ── NECTARINE (NE) ───────────────────────────────────────────────────────────

INSERT INTO size_bins (commodity_id, label, weight_min_g, weight_max_g, display_order) VALUES
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Oversize',  201, 999,  1),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 13',  180, 200,  2),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 15',  153, 179,  3),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 18',  132, 152,  4),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 20',  117, 131,  5),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 23',  105, 116,  6),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 25',   95, 104,  7),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 28',   87,  94,  8),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 30',   80,  86,  9),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Small',       0,  79, 10);

-- ── PEACH (PE) ───────────────────────────────────────────────────────────────

INSERT INTO size_bins (commodity_id, label, weight_min_g, weight_max_g, display_order) VALUES
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Oversize',  201, 999,  1),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Count 13',  180, 200,  2),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Count 15',  153, 179,  3),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Count 18',  132, 152,  4),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Count 20',  117, 131,  5),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Count 23',  105, 116,  6),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Count 25',   95, 104,  7),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Count 28',   87,  94,  8),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Count 30',   80,  86,  9),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', 'Small',       0,  79, 10);

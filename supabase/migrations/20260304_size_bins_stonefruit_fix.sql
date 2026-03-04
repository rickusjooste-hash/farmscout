-- ============================================================
-- Fixup: replace initial stonefruit size bins with corrected set
-- that includes explicit Oversize and Small bins.
--
-- Run this if you already ran 20260304_size_bins_stonefruit.sql
-- ============================================================

BEGIN;

-- Remove the 8 incorrect bins (Count 13 went to 999, Count 30 started at 0)
DELETE FROM size_bins
WHERE commodity_id IN (
  'da106a75-6fbb-4720-b498-be73f1a6d120',  -- Nectarine
  'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b'   -- Peach
);

-- Re-insert correct 10-bin set for each commodity
INSERT INTO size_bins (commodity_id, label, weight_min_g, weight_max_g, display_order) VALUES
  -- Nectarine
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Oversize',  201, 999,  1),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 13',  180, 200,  2),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 15',  153, 179,  3),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 18',  132, 152,  4),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 20',  117, 131,  5),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 23',  105, 116,  6),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 25',   95, 104,  7),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 28',   87,  94,  8),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Count 30',   80,  86,  9),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', 'Small',       0,  79, 10),
  -- Peach
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

COMMIT;

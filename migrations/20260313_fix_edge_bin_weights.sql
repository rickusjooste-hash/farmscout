-- Fix weight_g for edge bins (oversize/undersize/small) where the
-- midpoint calculation produced nonsense values (e.g. 5131g apples).
--
-- Run each statement individually in Supabase SQL Editor if timeouts occur.

-- Apple Oversize: 5131g → 280g
UPDATE qc_fruit SET weight_g = 280
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = '568df904-f53b-4171-9d84-033f58d07023'
    AND weight_min_g = 262 AND weight_max_g = 9999
);

-- Apple Undersize: 35g → 60g  (160k rows — may need batching)
UPDATE qc_fruit SET weight_g = 60
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = '568df904-f53b-4171-9d84-033f58d07023'
    AND weight_min_g = 0 AND weight_max_g = 70
);

-- Pear Oversize: 5175g → 370g
UPDATE qc_fruit SET weight_g = 370
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = 'f0415f88-b593-4972-a1b4-2abd9d5c87cb'
    AND weight_min_g = 350 AND weight_max_g = 9999
);

-- Pear Undersize: 45g → 80g
UPDATE qc_fruit SET weight_g = 80
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = 'f0415f88-b593-4972-a1b4-2abd9d5c87cb'
    AND weight_min_g = 0 AND weight_max_g = 89
);

-- Nectarine Oversize: 600g → 215g
UPDATE qc_fruit SET weight_g = 215
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = 'da106a75-6fbb-4720-b498-be73f1a6d120'
    AND weight_min_g = 201 AND weight_max_g = 999
);

-- Nectarine Small: 40g → 70g
UPDATE qc_fruit SET weight_g = 70
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = 'da106a75-6fbb-4720-b498-be73f1a6d120'
    AND weight_min_g = 0 AND weight_max_g = 79
);

-- Peach Small: 40g → 70g
UPDATE qc_fruit SET weight_g = 70
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = 'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b'
    AND weight_min_g = 0 AND weight_max_g = 79
);

-- Citrus Small: 25g → 42g
UPDATE qc_fruit SET weight_g = 42
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = '8431f19e-5614-4d9b-9da8-811be03e485d'
    AND weight_min_g = 0 AND weight_max_g = 50
);

-- Unknown commodity (2a257a4c) Oversize: 650g → 320g
UPDATE qc_fruit SET weight_g = 320
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = '2a257a4c-d2e9-4fd1-a3d9-54584a12fe41'
    AND weight_min_g = 300 AND weight_max_g = 999
);

-- Unknown commodity (2a257a4c) Small: 25g → 42g
UPDATE qc_fruit SET weight_g = 42
WHERE size_bin_id = (
  SELECT id FROM size_bins
  WHERE commodity_id = '2a257a4c-d2e9-4fd1-a3d9-54584a12fe41'
    AND weight_min_g = 0 AND weight_max_g = 50
);

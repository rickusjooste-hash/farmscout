-- Fix legacy stonefruit (SF) size bins
-- Excel migration created SF commodity with bare labels (13, 15, 18...)
-- and wrong weight ranges (8-35g). Orchards already migrated to NE/PE.
-- Reassign ~98K qc_fruit rows to correct NE/PE "Count X" bins, then delete SF bins.
--
-- Run in Supabase SQL Editor.

-- Step 1: Reassign numeric-label bins (13 → Count 13, etc.)
UPDATE qc_fruit f
SET size_bin_id = new_bin.id
FROM qc_bag_sessions s,
     size_bins old_sb,
     orchards o,
     size_bins new_bin
WHERE f.session_id = s.id
  AND old_sb.id = f.size_bin_id
  AND old_sb.commodity_id = '2a257a4c-d2e9-4fd1-a3d9-54584a12fe41'  -- SF
  AND o.id = s.orchard_id
  AND old_sb.label ~ '^\d+$'
  AND new_bin.commodity_id = o.commodity_id
  AND new_bin.label = 'Count ' || old_sb.label;

-- Step 2: Rename "Small" → "Undersize" on NE and PE first
UPDATE size_bins SET label = 'Undersize'
WHERE label = 'Small'
  AND commodity_id IN (
    'da106a75-6fbb-4720-b498-be73f1a6d120',  -- NE
    'b94a3ed1-935e-41f3-b8f2-889aeaffdd0b'   -- PE
  );

-- Step 3: Reassign SF "Oversize" and "Small" → target commodity equivalents
UPDATE qc_fruit f
SET size_bin_id = new_bin.id
FROM qc_bag_sessions s,
     size_bins old_sb,
     orchards o,
     size_bins new_bin
WHERE f.session_id = s.id
  AND old_sb.id = f.size_bin_id
  AND old_sb.commodity_id = '2a257a4c-d2e9-4fd1-a3d9-54584a12fe41'  -- SF
  AND o.id = s.orchard_id
  AND old_sb.label IN ('Oversize', 'Small')
  AND new_bin.commodity_id = o.commodity_id
  AND new_bin.label = CASE old_sb.label
    WHEN 'Small' THEN 'Undersize'
    ELSE old_sb.label
  END;

-- Step 4: Delete SF bins
DELETE FROM size_bins
WHERE commodity_id = '2a257a4c-d2e9-4fd1-a3d9-54584a12fe41';

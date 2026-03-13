-- Remap qc_fruit.size_bin_id based on actual weight_g and session's commodity.
--
-- The QC app BLE handler was using unfiltered size bins (all commodities),
-- causing fruit to be assigned to bins from the wrong commodity.
--
-- Run this repeatedly in Supabase SQL Editor until rows_updated = 0.

WITH candidates AS (
  SELECT DISTINCT ON (f.id)
    f.id AS fruit_id,
    sb.id AS correct_bin_id
  FROM qc_fruit f
  JOIN qc_bag_sessions s ON s.id = f.session_id
  JOIN orchards o ON o.id = s.orchard_id
  JOIN size_bins sb
    ON sb.commodity_id = o.commodity_id
   AND sb.is_active = true
   AND f.weight_g >= sb.weight_min_g
   AND f.weight_g <= sb.weight_max_g
  WHERE f.weight_g IS NOT NULL
    AND f.size_bin_id IS DISTINCT FROM sb.id
  ORDER BY f.id, sb.display_order
  LIMIT 5000
),
updated AS (
  UPDATE qc_fruit upd
  SET size_bin_id = c.correct_bin_id
  FROM candidates c
  WHERE upd.id = c.fruit_id
  RETURNING 1
)
SELECT count(*) AS rows_updated FROM updated;

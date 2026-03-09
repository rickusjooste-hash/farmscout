-- ============================================================
-- Fix: Re-map size_bin_id on qc_fruit for bags where GPS drift
-- caused the wrong orchard (and thus wrong commodity) to be assigned.
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── Step 1: Diagnostic — show today's bags with mismatched commodities ──
-- Bags where the orchard's commodity differs from what you'd expect.
-- Review this output first before running the fix.

SELECT
  bs.id AS session_id,
  bs.bag_seq,
  bs.collected_at,
  e.full_name AS picker,
  o.name AS orchard_name,
  c.name AS commodity_name,
  COUNT(f.id) AS fruit_count
FROM qc_bag_sessions bs
JOIN orchards o ON o.id = bs.orchard_id
JOIN commodities c ON c.id = o.commodity_id
JOIN qc_employees e ON e.id = bs.employee_id
LEFT JOIN qc_fruit f ON f.session_id = bs.id
WHERE bs.collected_at::date = CURRENT_DATE
GROUP BY bs.id, bs.bag_seq, bs.collected_at, e.full_name, o.name, c.name
ORDER BY bs.bag_seq;

-- ── Step 2: Fix — re-map size_bin_id for ALL bags collected today ───────
-- This updates every qc_fruit row to the correct size_bin for the
-- orchard's commodity, based on weight_g.  Safe to run multiple times
-- (idempotent — it always picks the bin matching the current orchard).

UPDATE qc_fruit f
SET size_bin_id = new_bin.bin_id
FROM (
  SELECT
    f2.id AS fruit_id,
    sb.id AS bin_id
  FROM qc_fruit f2
  JOIN qc_bag_sessions bs ON bs.id = f2.session_id
  JOIN orchards o ON o.id = bs.orchard_id
  LEFT JOIN size_bins sb
    ON sb.commodity_id = o.commodity_id
    AND sb.is_active = true
    AND f2.weight_g >= sb.weight_min_g
    AND f2.weight_g <= sb.weight_max_g
  WHERE bs.collected_at::date = CURRENT_DATE
) new_bin
WHERE f.id = new_bin.fruit_id
  AND (f.size_bin_id IS DISTINCT FROM new_bin.bin_id);

-- ── Step 3: Verify — check that fruit now reference bins from the
-- correct commodity ──────────────────────────────────────────────────────

SELECT
  bs.bag_seq,
  o.name AS orchard_name,
  c.name AS commodity_name,
  sb.label AS size_bin_label,
  sc.name AS bin_commodity,
  COUNT(*) AS fruit_count,
  CASE WHEN c.id = sc.id THEN 'OK' ELSE 'MISMATCH' END AS status
FROM qc_fruit f
JOIN qc_bag_sessions bs ON bs.id = f.session_id
JOIN orchards o ON o.id = bs.orchard_id
JOIN commodities c ON c.id = o.commodity_id
LEFT JOIN size_bins sb ON sb.id = f.size_bin_id
LEFT JOIN commodities sc ON sc.id = sb.commodity_id
WHERE bs.collected_at::date = CURRENT_DATE
GROUP BY bs.bag_seq, o.name, c.name, sb.label, sc.name, c.id, sc.id
ORDER BY bs.bag_seq, sb.label;

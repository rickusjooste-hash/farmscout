-- ================================================================
-- QC dedup — data-integrity-preserving cleanup
--
-- Root cause: pests table has duplicate rows for "Fruit Fly" etc.
-- (same name, different UUIDs). The seed's JOIN produced one
-- commodity_pests row per duplicate UUID, so e.g. Apple Fruit Fly
-- qc_issue appears 5 times with 5 different pest_ids.
--
-- The QC worker app downloads all duplicates, so recorded bag_issues
-- may reference any of the 5 UUIDs. get_qc_issue_breakdown joins
--   qc_bag_issues → commodity_pests ON pest_id
-- so non-canonical UUIDs would silently drop from the breakdown chart.
--
-- Fix order (all inside one transaction):
--   1. Re-point qc_bag_issues  → canonical UUID   (data integrity)
--   2. Re-point qc_fruit_issues → canonical UUID
--   3. Drop unique constraint (to allow UPDATE without collision)
--   4. Re-point commodity_pests.pest_id → canonical UUID
--   5. Delete duplicate commodity_pests rows
--   6. Re-add unique constraint
--   7. Delete orphaned duplicate pest rows (zero-reference only)
--
-- "Canonical" = oldest pests row per name (lowest created_at / id)
-- ================================================================

-- ── Run diagnostics first (no changes) ───────────────────────────

SELECT lower(name) AS pest_name, COUNT(*) AS dup_count,
       array_agg(id ORDER BY created_at NULLS LAST) AS ids
FROM pests
GROUP BY lower(name)
HAVING COUNT(*) > 1;

SELECT cp.commodity_id, c.name AS commodity, p.name AS pest,
       cp.category, COUNT(*) AS dup_count
FROM commodity_pests cp
JOIN pests p       ON p.id  = cp.pest_id
JOIN commodities c ON c.id  = cp.commodity_id
GROUP BY cp.commodity_id, c.name, lower(p.name), cp.category
HAVING COUNT(*) > 1
ORDER BY c.name, lower(p.name);

-- ════════════════════════════════════════════════════════════════
-- CLEANUP  (run as a single block)
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- Build the dup→canonical mapping once
CREATE TEMP TABLE _pest_map AS
SELECT p.id AS dup_id, canon.id AS canonical_id
FROM pests p
JOIN (
  SELECT DISTINCT ON (lower(name)) id, lower(name) AS name_lower
  FROM pests
  ORDER BY lower(name), created_at ASC NULLS LAST, id ASC
) canon ON lower(p.name) = canon.name_lower
WHERE p.id <> canon.id;

-- 1. Re-point qc_bag_issues
UPDATE public.qc_bag_issues
SET pest_id = m.canonical_id
FROM _pest_map m
WHERE pest_id = m.dup_id;

-- 2. Re-point qc_fruit_issues
UPDATE public.qc_fruit_issues
SET pest_id = m.canonical_id
FROM _pest_map m
WHERE pest_id = m.dup_id;

-- 3. Drop unique constraint (prevents collision during UPDATE below)
ALTER TABLE public.commodity_pests
  DROP CONSTRAINT IF EXISTS commodity_pests_commodity_id_pest_id_category_key;

-- 4. Re-point commodity_pests.pest_id
UPDATE public.commodity_pests
SET pest_id = m.canonical_id
FROM _pest_map m
WHERE pest_id = m.dup_id;

-- 5. Delete duplicate commodity_pests (keep lowest display_order per combo)
DELETE FROM public.commodity_pests
WHERE id NOT IN (
  SELECT DISTINCT ON (commodity_id, pest_id, category) id
  FROM public.commodity_pests
  ORDER BY commodity_id, pest_id, category, display_order ASC, id ASC
);

-- 6. Re-add unique constraint
ALTER TABLE public.commodity_pests
  ADD CONSTRAINT commodity_pests_commodity_id_pest_id_category_key
  UNIQUE (commodity_id, pest_id, category);

-- 7. Delete orphaned pest rows (only if nothing references them)
DELETE FROM public.pests
WHERE id IN (SELECT dup_id FROM _pest_map)
  AND id NOT IN (SELECT DISTINCT pest_id FROM commodity_pests)
  AND id NOT IN (SELECT DISTINCT pest_id FROM qc_bag_issues)
  AND id NOT IN (SELECT DISTINCT pest_id FROM qc_fruit_issues)
  AND id NOT IN (SELECT DISTINCT pest_id FROM trap_counts)
  AND id NOT IN (SELECT DISTINCT pest_id FROM inspection_observations)
  AND id NOT IN (SELECT DISTINCT pest_id FROM lure_types        WHERE pest_id IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT pest_id FROM trap_thresholds   WHERE pest_id IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT pest_id FROM traps             WHERE pest_id IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT pest_id_direct FROM trap_inspections WHERE pest_id_direct IS NOT NULL);

DROP TABLE _pest_map;

COMMIT;

-- ── Verify: both should return 0 rows ────────────────────────────
SELECT lower(name) AS pest_name, COUNT(*) FROM pests
GROUP BY lower(name) HAVING COUNT(*) > 1;

SELECT cp.commodity_id, lower(p.name) AS pest, cp.category, COUNT(*)
FROM commodity_pests cp JOIN pests p ON p.id = cp.pest_id
GROUP BY cp.commodity_id, lower(p.name), cp.category HAVING COUNT(*) > 1;

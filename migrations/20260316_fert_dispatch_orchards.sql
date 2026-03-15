-- Fertilizer Dispatch: Section-based → Orchard-based targeting + direct applicator assignment
-- Creates: fert_dispatch_orchards
-- Alters:  fert_dispatches (add dispatched_to)
-- Replaces: get_fert_dispatched_lines RPC (filter by dispatched_to, no section assignments)
-- Keeps: fert_dispatch_sections intact for backward compat

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Add dispatched_to on fert_dispatches — the assigned applicator
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fert_dispatches ADD COLUMN IF NOT EXISTS dispatched_to uuid REFERENCES user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_fert_dispatches_to ON fert_dispatches (dispatched_to);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. fert_dispatch_orchards — explicit orchard+line targeting per dispatch
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fert_dispatch_orchards (
  dispatch_id  uuid NOT NULL REFERENCES fert_dispatches(id) ON DELETE CASCADE,
  orchard_id   uuid NOT NULL REFERENCES orchards(id),
  line_id      uuid NOT NULL REFERENCES fert_recommendation_lines(id),
  PRIMARY KEY (dispatch_id, line_id)
);

CREATE INDEX IF NOT EXISTS idx_fert_dispatch_orchards_orchard ON fert_dispatch_orchards (orchard_id);
CREATE INDEX IF NOT EXISTS idx_fert_dispatch_orchards_line ON fert_dispatch_orchards (line_id);

ALTER TABLE fert_dispatch_orchards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read fert_dispatch_orchards"
  ON fert_dispatch_orchards FOR SELECT TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Migrate existing active dispatches from sections to orchards
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO fert_dispatch_orchards (dispatch_id, orchard_id, line_id)
SELECT DISTINCT fd.id, frl.orchard_id, frl.id
FROM fert_dispatches fd
JOIN fert_dispatch_sections fds ON fds.dispatch_id = fd.id
JOIN fert_recommendation_lines frl
  ON frl.timing_id = fd.timing_id
  AND frl.product_id = fd.product_id
JOIN orchards o ON o.id = frl.orchard_id
JOIN orchard_sections os ON os.orchard_id = o.id AND os.section_id = fds.section_id
WHERE fd.status = 'active'
  AND frl.orchard_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Replace get_fert_dispatched_lines RPC
--    Now filters by fert_dispatches.dispatched_to = p_user_id
--    No more section assignment joins. Return shape is identical.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_fert_dispatched_lines(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_fert_dispatched_lines(
  p_user_id uuid,
  p_farm_id uuid
)
RETURNS TABLE (
  line_id            uuid,
  dispatch_id        uuid,
  timing_id          uuid,
  timing_label       text,
  timing_sort        integer,
  product_id         uuid,
  product_name       text,
  product_unit       text,
  orchard_id         uuid,
  orchard_name       text,
  orchard_nr         integer,
  variety            text,
  section_name       text,
  ha                 numeric,
  rate_per_ha        numeric,
  total_qty          numeric,
  confirmed          boolean,
  date_applied       date,
  actual_rate_per_ha numeric,
  actual_total_qty   numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    fdo.line_id,
    fd.id AS dispatch_id,
    ft.id AS timing_id,
    ft.label AS timing_label,
    ft.sort_order AS timing_sort,
    fp.id AS product_id,
    fp.name AS product_name,
    fp.default_unit AS product_unit,
    fdo.orchard_id,
    o.name AS orchard_name,
    o.orchard_nr,
    o.variety,
    s.name AS section_name,
    frl.ha,
    frl.rate_per_ha,
    COALESCE(frl.total_qty, frl.rate_per_ha * COALESCE(frl.ha, 0)) AS total_qty,
    COALESCE(fa.confirmed, false) AS confirmed,
    fa.date_applied,
    fa.actual_rate_per_ha,
    fa.actual_total_qty
  FROM fert_dispatch_orchards fdo
  JOIN fert_dispatches fd ON fd.id = fdo.dispatch_id
  JOIN fert_recommendation_lines frl ON frl.id = fdo.line_id
  JOIN orchards o ON o.id = fdo.orchard_id
  LEFT JOIN orchard_sections os ON os.orchard_id = o.id
  LEFT JOIN sections s ON s.id = os.section_id
  JOIN fert_timings ft ON ft.id = frl.timing_id
  JOIN fert_products fp ON fp.id = frl.product_id
  LEFT JOIN fert_applications fa ON fa.line_id = frl.id
  WHERE fd.farm_id = p_farm_id
    AND fd.status = 'active'
    AND fd.dispatched_to = p_user_id
  ORDER BY ft.sort_order, o.name;
$$;

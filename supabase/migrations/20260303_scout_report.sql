-- Scout Report migration
-- Adds pest abbreviation column, scout report opt-in flag, and weekly trap report RPC.
-- Run in Supabase SQL Editor.

-- 1. Add short abbreviation to pests (CM, FF, OFM, etc.)
ALTER TABLE pests ADD COLUMN IF NOT EXISTS abbr text;

-- After running, update pest abbreviations manually:
-- UPDATE pests SET abbr = 'CM'   WHERE name ILIKE '%codling%';
-- UPDATE pests SET abbr = 'FCM'  WHERE name ILIKE '%false codling%';
-- UPDATE pests SET abbr = 'FF'   WHERE name ILIKE '%fruit fly%male%';
-- UPDATE pests SET abbr = 'FFMF' WHERE name ILIKE '%fruit fly%male%female%';
-- UPDATE pests SET abbr = 'OFM'  WHERE name ILIKE '%oriental%';
-- UPDATE pests SET abbr = 'BW'   WHERE name ILIKE '%bollworm%' OR name ILIKE '%bolworm%';
-- UPDATE pests SET abbr = 'BD'   WHERE name ILIKE '%invadens%';
-- UPDATE pests SET abbr = 'PS'   WHERE name ILIKE '%pernicious%';
-- UPDATE pests SET abbr = 'RD'   WHERE name ILIKE '%rooi dop%';

-- 2. Add scout report opt-in flag to recipients table
ALTER TABLE rebait_notification_recipients
  ADD COLUMN IF NOT EXISTS receives_scout_report boolean DEFAULT false;

-- 3. RPC: get_weekly_trap_report(p_farm_id uuid)
-- Returns flat rows of this-week + last-week trap counts per orchard + pest.
-- The email builder pivots these into a table (one column per pest abbreviation).
CREATE OR REPLACE FUNCTION get_weekly_trap_report(p_farm_id uuid)
RETURNS TABLE(
  commodity_code    text,
  commodity_name    text,
  orchard_id        uuid,
  orchard_display   text,
  pest_id           uuid,
  pest_name         text,
  pest_abbr         text,
  this_week_count   bigint,
  last_week_count   bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
WITH
  week_bounds AS (
    SELECT
      date_trunc('week', now())                      AS tw_start,
      date_trunc('week', now()) + interval '1 week'  AS tw_end,
      date_trunc('week', now()) - interval '1 week'  AS lw_start
  ),
  -- All active trap coverage: which pests exist per orchard
  trap_coverage AS (
    SELECT DISTINCT
      t.orchard_id,
      t.pest_id
    FROM traps t
    WHERE t.farm_id = p_farm_id
      AND t.is_active = true
      AND t.pest_id IS NOT NULL
  ),
  -- This week counts
  tw AS (
    SELECT t.orchard_id, tc.pest_id, SUM(tc.count) AS total
    FROM trap_counts tc
    JOIN trap_inspections ti ON ti.id = tc.inspection_id
    JOIN traps t ON t.id = ti.trap_id
    WHERE t.farm_id = p_farm_id
      AND ti.inspected_at >= (SELECT tw_start FROM week_bounds)
      AND ti.inspected_at <  (SELECT tw_end   FROM week_bounds)
    GROUP BY t.orchard_id, tc.pest_id
  ),
  -- Last week counts
  lw AS (
    SELECT t.orchard_id, tc.pest_id, SUM(tc.count) AS total
    FROM trap_counts tc
    JOIN trap_inspections ti ON ti.id = tc.inspection_id
    JOIN traps t ON t.id = ti.trap_id
    WHERE t.farm_id = p_farm_id
      AND ti.inspected_at >= (SELECT lw_start FROM week_bounds)
      AND ti.inspected_at <  (SELECT tw_start FROM week_bounds)
    GROUP BY t.orchard_id, tc.pest_id
  )
SELECT
  c.code                                                              AS commodity_code,
  c.name                                                              AS commodity_name,
  o.id                                                                AS orchard_id,
  CONCAT_WS(' ', o.orchard_nr::text, o.name, o.variety)             AS orchard_display,
  p.id                                                                AS pest_id,
  p.name                                                              AS pest_name,
  COALESCE(p.abbr, LEFT(p.name, 4))                                  AS pest_abbr,
  COALESCE(tw.total, 0)                                              AS this_week_count,
  COALESCE(lw.total, 0)                                              AS last_week_count
FROM trap_coverage tc2
JOIN orchards    o ON o.id = tc2.orchard_id
JOIN commodities c ON c.id = o.commodity_id
JOIN pests       p ON p.id = tc2.pest_id
LEFT JOIN tw ON tw.orchard_id = tc2.orchard_id AND tw.pest_id = tc2.pest_id
LEFT JOIN lw ON lw.orchard_id = tc2.orchard_id AND lw.pest_id = tc2.pest_id
ORDER BY c.code, o.name, o.variety, p.name;
$$;

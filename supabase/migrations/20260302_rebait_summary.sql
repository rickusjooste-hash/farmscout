-- Migration: Rebait summary RPCs
-- Run manually in Supabase SQL Editor

-- RPC 1: get_rebait_summary
-- Returns one row per active trap that is overdue or due within 1 week.
CREATE OR REPLACE FUNCTION get_rebait_summary(
  p_org_id  uuid,
  p_farm_id uuid DEFAULT NULL
)
RETURNS TABLE(
  trap_id             uuid,
  trap_nr             integer,
  nfc_tag             text,
  orchard_name        text,
  zone_name           text,
  lure_type_id        uuid,
  lure_type_name      text,
  rebait_weeks        integer,
  last_rebaited_at    timestamptz,
  weeks_since_rebait  numeric,
  is_overdue          boolean,
  is_due_soon         boolean
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH last_rebait AS (
    SELECT DISTINCT ON (trap_id)
      trap_id,
      inspected_at AS last_rebaited_at
    FROM   trap_inspections
    WHERE  rebaited = true
    ORDER  BY trap_id, inspected_at DESC
  ),
  computed AS (
    SELECT
      t.id                                                          AS trap_id,
      t.trap_nr,
      t.nfc_tag,
      o.name                                                        AS orchard_name,
      z.zone_letter || z.zone_nr::text                             AS zone_name,
      t.lure_type_id,
      lt.name                                                       AS lure_type_name,
      lt.rebait_weeks,
      lr.last_rebaited_at,
      CASE
        WHEN lr.last_rebaited_at IS NULL THEN 999
        ELSE ROUND(EXTRACT(EPOCH FROM (now() - lr.last_rebaited_at)) / 604800.0, 1)
      END AS weeks_since_rebait
    FROM   traps        t
    JOIN   lure_types   lt ON lt.id = t.lure_type_id
    JOIN   orchards     o  ON o.id  = t.orchard_id
    JOIN   zones        z  ON z.id  = t.zone_id
    LEFT JOIN last_rebait lr ON lr.trap_id = t.id
    WHERE  t.organisation_id = p_org_id
      AND  (p_farm_id IS NULL OR t.farm_id = p_farm_id)
      AND  t.is_active = true
      AND  lt.rebait_weeks IS NOT NULL
  )
  SELECT
    trap_id, trap_nr, nfc_tag, orchard_name, zone_name,
    lure_type_id, lure_type_name, rebait_weeks, last_rebaited_at,
    weeks_since_rebait,
    (weeks_since_rebait >= rebait_weeks)                              AS is_overdue,
    (weeks_since_rebait >= rebait_weeks - 1
      AND weeks_since_rebait < rebait_weeks)                          AS is_due_soon
  FROM  computed
  WHERE weeks_since_rebait >= rebait_weeks - 1
  ORDER BY weeks_since_rebait DESC;
$$;

-- RPC 2: get_scout_rebait_due_count
-- Walks the scout's trap linked-list chain, returns count of traps due/overdue for rebaiting.
CREATE OR REPLACE FUNCTION get_scout_rebait_due_count(
  p_farm_id       uuid,
  p_first_trap_id uuid
)
RETURNS integer
LANGUAGE sql SECURITY DEFINER AS $$
  WITH RECURSIVE route AS (
    SELECT id, next_trap_id FROM traps
    WHERE  id = p_first_trap_id AND farm_id = p_farm_id AND is_active = true
    UNION ALL
    SELECT t.id, t.next_trap_id FROM traps t
    JOIN   route r ON r.next_trap_id = t.id
    WHERE  t.farm_id = p_farm_id AND t.is_active = true
  ),
  last_rebait AS (
    SELECT DISTINCT ON (trap_id) trap_id, inspected_at AS last_rebaited_at
    FROM   trap_inspections
    WHERE  trap_id IN (SELECT id FROM route) AND rebaited = true
    ORDER  BY trap_id, inspected_at DESC
  )
  SELECT COUNT(*)::integer
  FROM   route r
  JOIN   traps t     ON t.id  = r.id
  JOIN   lure_types lt ON lt.id = t.lure_type_id
  LEFT JOIN last_rebait lr ON lr.trap_id = r.id
  WHERE  lt.rebait_weeks IS NOT NULL
    AND  EXTRACT(EPOCH FROM (now() - COALESCE(lr.last_rebaited_at, '-infinity'::timestamptz)))
           / 604800.0 >= lt.rebait_weeks - 1;
$$;

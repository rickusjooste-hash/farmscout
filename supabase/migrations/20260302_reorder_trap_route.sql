-- Atomically rebuilds a scout's trap linked-list from a new ordered array.
-- Handles reorder (same traps, new positions) and removal (fewer traps —
-- orphaned traps get next_trap_id = NULL and become available again).
CREATE OR REPLACE FUNCTION reorder_trap_route(
  p_scout_id uuid,
  p_trap_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  arr_len integer;
  i integer;
BEGIN
  arr_len := array_length(p_trap_ids, 1);

  -- Walk current route and clear all existing next_trap_id links
  WITH RECURSIVE current_route AS (
    SELECT t.id, t.next_trap_id
    FROM traps t
    JOIN scouts s ON s.first_trap_id = t.id
    WHERE s.id = p_scout_id AND t.is_active = true
    UNION ALL
    SELECT t.id, t.next_trap_id
    FROM traps t
    INNER JOIN current_route r ON r.next_trap_id = t.id
    WHERE t.is_active = true
  )
  UPDATE traps SET next_trap_id = NULL
  WHERE id IN (SELECT id FROM current_route);

  IF arr_len IS NULL OR arr_len = 0 THEN
    UPDATE scouts SET first_trap_id = NULL WHERE id = p_scout_id;
    RETURN;
  END IF;

  UPDATE scouts SET first_trap_id = p_trap_ids[1] WHERE id = p_scout_id;

  FOR i IN 1..arr_len - 1 LOOP
    UPDATE traps SET next_trap_id = p_trap_ids[i + 1] WHERE id = p_trap_ids[i];
  END LOOP;
  -- Last trap's next_trap_id remains NULL from the clear above
END;
$$;

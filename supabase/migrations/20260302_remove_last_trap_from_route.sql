CREATE OR REPLACE FUNCTION remove_last_trap_from_route(scout_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_first_trap_id   uuid;
  v_prev_trap_id    uuid;
  v_current_trap_id uuid;
  v_next_trap_id    uuid;
BEGIN
  SELECT first_trap_id INTO v_first_trap_id
  FROM scouts WHERE id = scout_id;

  IF v_first_trap_id IS NULL THEN
    RETURN;
  END IF;

  v_current_trap_id := v_first_trap_id;
  v_prev_trap_id    := NULL;

  LOOP
    SELECT next_trap_id INTO v_next_trap_id
    FROM traps WHERE id = v_current_trap_id;

    EXIT WHEN v_next_trap_id IS NULL;

    v_prev_trap_id    := v_current_trap_id;
    v_current_trap_id := v_next_trap_id;
  END LOOP;

  IF v_prev_trap_id IS NULL THEN
    -- Only one trap — clear the scout's route entirely
    UPDATE scouts SET first_trap_id = NULL WHERE id = scout_id;
  ELSE
    -- Unlink the last trap from the chain
    UPDATE traps SET next_trap_id = NULL WHERE id = v_prev_trap_id;
  END IF;
END;
$$;

-- Batch-apply correction factors to worker_daily_productivity rows
-- Called from sync script with JSON array: [{row_id, factor, bpb}, ...]
CREATE OR REPLACE FUNCTION apply_productivity_corrections(p_corrections text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec jsonb;
BEGIN
  FOR rec IN SELECT jsonb_array_elements(p_corrections::jsonb)
  LOOP
    UPDATE worker_daily_productivity
    SET correction_factor = (rec->>'factor')::numeric,
        corrected_bags    = ROUND(units * (rec->>'factor')::numeric, 2),
        corrected_bins    = ROUND(units * (rec->>'factor')::numeric / (rec->>'bpb')::numeric, 4)
    WHERE id = (rec->>'row_id')::uuid;
  END LOOP;
END;
$$;

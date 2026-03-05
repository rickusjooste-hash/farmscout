-- Returns bags that are truly pending for QC sampling:
-- status='collected' AND no fruit records exist yet.
-- This prevents stale bags (sampled but status not updated) from reappearing.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_pending_bags_for_qc(
  p_farm_ids uuid[]
)
RETURNS SETOF qc_bag_sessions
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT s.*
  FROM qc_bag_sessions s
  WHERE s.farm_id = ANY(p_farm_ids)
    AND s.status = 'collected'
    AND s.collected_at >= CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM qc_fruit f WHERE f.session_id = s.id
    )
  ORDER BY s.collected_at DESC;
$$;

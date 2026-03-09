-- Orchard Analysis RPCs
-- Run in Supabase SQL Editor

-- ── get_orchard_weekly_production ──────────────────────────────────────────────
-- Per-orchard weekly bins for sparklines + detail panel charts

CREATE OR REPLACE FUNCTION get_orchard_weekly_production(
  p_orchard_id uuid,
  p_season text
)
RETURNS TABLE (
  week_num   integer,
  week_start date,
  bins       numeric,
  juice      numeric,
  total      numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pb.week_num,
    MIN(pb.received_date) AS week_start,
    SUM(pb.bins)  AS bins,
    SUM(pb.juice) AS juice,
    SUM(pb.total) AS total
  FROM production_bins pb
  WHERE pb.orchard_id = p_orchard_id
    AND pb.season = p_season
    AND pb.week_num IS NOT NULL
  GROUP BY pb.week_num
  ORDER BY pb.week_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

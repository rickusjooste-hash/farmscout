-- Session-based floor stock: link floor stock entries to sessions instead of dates
-- Each session (orchard run) has opening + closing floor stock grids.
-- Closing stock of session N auto-copies to opening of session N+1 (same variety).

-- 1. Add session columns to floor stock
ALTER TABLE packout_floor_stock ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES packout_daily_sessions(id) ON DELETE CASCADE;
ALTER TABLE packout_floor_stock ADD COLUMN IF NOT EXISTS stock_type text DEFAULT 'closing';

-- Unique: one opening + one closing per session per grid cell
CREATE UNIQUE INDEX IF NOT EXISTS idx_floor_stock_session
  ON packout_floor_stock (session_id, stock_type, box_type_id, size_id)
  WHERE session_id IS NOT NULL;

-- 2. Add sequence to sessions for ordering within a day
ALTER TABLE packout_daily_sessions ADD COLUMN IF NOT EXISTS seq integer DEFAULT 1;

-- Allow multiple sessions per orchard per day (e.g., GRS block 1 morning + GRS block 2 afternoon)
-- Drop old constraint that only allows one session per orchard per day
ALTER TABLE packout_daily_sessions DROP CONSTRAINT IF EXISTS packout_daily_sessions_ph_orch_date_key;
ALTER TABLE packout_daily_sessions ADD CONSTRAINT packout_daily_sessions_ph_date_seq_key
  UNIQUE (organisation_id, packhouse_id, pack_date, seq);

-- Index for finding most recent closing stock by variety
CREATE INDEX IF NOT EXISTS idx_floor_stock_variety_lookup
  ON packout_floor_stock (stock_type, session_id)
  WHERE session_id IS NOT NULL AND stock_type = 'closing';

CREATE INDEX IF NOT EXISTS idx_sessions_variety_date
  ON packout_daily_sessions (packhouse_id, variety, pack_date DESC, seq DESC);

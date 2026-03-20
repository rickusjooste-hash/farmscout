-- Allow multiple orchard runs per packhouse per day
-- Drop old unique constraint and add orchard_id back
ALTER TABLE packout_daily_sessions ADD COLUMN IF NOT EXISTS orchard_id uuid REFERENCES orchards(id);
ALTER TABLE packout_daily_sessions ADD COLUMN IF NOT EXISTS variety text;
ALTER TABLE packout_daily_sessions ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE packout_daily_sessions ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE packout_daily_sessions ADD COLUMN IF NOT EXISTS bins_packed integer;

-- Drop the old unique (packhouse_id, pack_date) and replace with (packhouse_id, orchard_id, pack_date)
ALTER TABLE packout_daily_sessions DROP CONSTRAINT IF EXISTS packout_daily_sessions_organisation_id_packhouse_id_pack_da_key;
ALTER TABLE packout_daily_sessions ADD CONSTRAINT packout_daily_sessions_ph_orch_date_key
  UNIQUE (organisation_id, packhouse_id, orchard_id, pack_date);

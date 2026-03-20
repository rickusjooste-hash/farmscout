-- Add bin_count to track how many bins were on the scale per weighing
ALTER TABLE packout_bin_weights ADD COLUMN IF NOT EXISTS bin_count integer NOT NULL DEFAULT 2;

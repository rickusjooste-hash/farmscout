-- Add GPS spread enforcement columns to scouts table
ALTER TABLE public.scouts
  ADD COLUMN IF NOT EXISTS enforce_gps_spread boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gps_spread_pin text;  -- 4-digit override PIN, nullable

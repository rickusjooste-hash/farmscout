-- Add per-tree GPS columns to picking_quality_trees for accountability
ALTER TABLE public.picking_quality_trees
  ADD COLUMN IF NOT EXISTS gps_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS gps_lng numeric(10,7);

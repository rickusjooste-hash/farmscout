-- Add separate side headland width (parallel to rows, between adjacent orchards)
-- headland_width = row-end headland (top/bottom, default 6m)
-- side_headland_width = side gap (default 0 — adjacent orchards share boundary)
ALTER TABLE public.orchards
  ADD COLUMN IF NOT EXISTS side_headland_width numeric DEFAULT 0;

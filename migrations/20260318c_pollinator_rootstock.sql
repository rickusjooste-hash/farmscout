-- Add rootstock to pollinators (may differ from main variety rootstock)
ALTER TABLE public.orchard_pollinators
  ADD COLUMN IF NOT EXISTS rootstock text;

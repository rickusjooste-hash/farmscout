-- Add lat/lng columns to rain_gauges for PWA GPS matching
ALTER TABLE public.rain_gauges
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

UPDATE public.rain_gauges
SET lat = ST_Y(location::geometry),
    lng = ST_X(location::geometry)
WHERE location IS NOT NULL;

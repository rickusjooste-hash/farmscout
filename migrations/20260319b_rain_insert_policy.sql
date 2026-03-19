-- ============================================================
-- Rain readings INSERT policy for PWA capture
-- ============================================================

CREATE POLICY "rain_readings_insert" ON public.rain_readings
  FOR INSERT WITH CHECK (
    gauge_id IN (
      SELECT rg.id FROM public.rain_gauges rg
      JOIN public.organisation_users ou ON ou.organisation_id = rg.organisation_id
      WHERE ou.user_id = auth.uid()
    )
  );

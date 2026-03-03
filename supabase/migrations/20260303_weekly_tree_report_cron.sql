-- Cron job: weekly-tree-report
-- Fires every Saturday at 06:00 UTC (08:00 SAST)
-- Calls the weekly-tree-report Supabase Edge Function
-- Replace <ANON_KEY> with the value of NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local

SELECT cron.schedule(
  'weekly-tree-report',
  '0 6 * * 6',
  $$
  SELECT net.http_post(
    url     := 'https://agktzdeskpyevurhabpg.supabase.co/functions/v1/weekly-tree-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

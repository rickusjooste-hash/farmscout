-- Migration: Rain reading WhatsApp notification recipients
-- Run manually in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.rain_notification_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  full_name       text NOT NULL,
  phone           text NOT NULL,          -- E.164 format: +27821234567
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(farm_id, phone)
);

-- Enable RLS
ALTER TABLE public.rain_notification_recipients ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read/write recipients for their own org
CREATE POLICY "Org members can manage rain notification recipients"
  ON public.rain_notification_recipients
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

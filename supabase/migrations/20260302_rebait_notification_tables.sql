-- Migration: Rebait notification config tables
-- Run manually in Supabase SQL Editor

-- One row per farm: which day of week to send the rebait report
CREATE TABLE IF NOT EXISTS public.rebait_notification_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  send_day_of_week integer NOT NULL DEFAULT 1 CHECK (send_day_of_week BETWEEN 0 AND 6),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(farm_id)
);

-- Multiple recipients per farm; each can opt in to one or both emails
CREATE TABLE IF NOT EXISTS public.rebait_notification_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  email           text NOT NULL,
  full_name       text,
  receives_purchase_list   boolean NOT NULL DEFAULT true,
  receives_rebait_schedule boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(farm_id, email)
);

-- Enable RLS
ALTER TABLE public.rebait_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebait_notification_recipients ENABLE ROW LEVEL SECURITY;

-- RLS: managers/admins can read/write settings for their own org
CREATE POLICY "Org members can manage rebait settings"
  ON public.rebait_notification_settings
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage rebait recipients"
  ON public.rebait_notification_recipients
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

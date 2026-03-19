-- ═══════════════════════════════════════════════════════════════════════════
-- HR Disciplinary Events Module — tables, seeds, RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Event types (reference)
CREATE TABLE IF NOT EXISTS public.hr_event_types (
  id serial PRIMARY KEY,
  name text NOT NULL,
  weight integer NOT NULL DEFAULT 0,
  validity_months integer,            -- NULL = permanent record
  escalation_order integer,           -- NULL = not part of escalation chain
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.hr_event_types (id, name, weight, validity_months, escalation_order) VALUES
  (1, 'Red Light',                       0, NULL, NULL),
  (2, 'Green Light',                     0, NULL, NULL),
  (3, 'Schedule Disciplinary Hearing',   0, NULL, NULL),
  (4, 'Verbal Warning',                 -1,    3,    1),
  (5, 'Absenteeism Formal Letter',      -1,    3, NULL),
  (6, 'First Written Warning',          -2,    6,    2),
  (7, 'Second Written Warning',         -4,    6,    3),
  (8, 'Final Written Warning',          -6,   12,    4)
ON CONFLICT (id) DO NOTHING;

SELECT setval('hr_event_types_id_seq', 8, true);

-- 2. Reason categories (manager-configurable)
CREATE TABLE IF NOT EXISTS public.hr_reason_categories (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.hr_reason_categories (name) VALUES
  ('Late arrival'),
  ('Absenteeism'),
  ('Misconduct'),
  ('Poor performance'),
  ('Insubordination'),
  ('Safety violation'),
  ('Damage to property')
ON CONFLICT DO NOTHING;

-- 3. Main events table
CREATE TABLE IF NOT EXISTS public.hr_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  farm_id uuid NOT NULL REFERENCES public.farms(id),
  employee_id uuid NOT NULL REFERENCES public.qc_employees(id),
  event_type_id integer NOT NULL REFERENCES public.hr_event_types(id),
  reason_category_id integer REFERENCES public.hr_reason_categories(id),
  event_date date NOT NULL,
  reason text,
  comments text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','rescinded','appealed')),
  expires_at date,
  created_by uuid REFERENCES public.user_profiles(id),
  actioned_by text,
  chair_person text,
  photo_url text,
  escalated_from_id uuid REFERENCES public.hr_events(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_events_employee_date ON public.hr_events (employee_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_events_farm_date ON public.hr_events (farm_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_events_employee_status_cat ON public.hr_events (employee_id, status, reason_category_id);

-- RLS
ALTER TABLE public.hr_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_reason_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_events ENABLE ROW LEVEL SECURITY;

-- Event types: read for authenticated
CREATE POLICY hr_event_types_select ON public.hr_event_types FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_event_types_all ON public.hr_event_types FOR ALL TO service_role USING (true);

-- Reason categories: read for authenticated, all for service_role
CREATE POLICY hr_reason_categories_select ON public.hr_reason_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_reason_categories_all ON public.hr_reason_categories FOR ALL TO service_role USING (true);

-- Events: read for authenticated (scoped by org via app), all for service_role
CREATE POLICY hr_events_select ON public.hr_events FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_events_all ON public.hr_events FOR ALL TO service_role USING (true);

-- ============================================================================
-- Orchard Planning Module — Schema Changes
-- Run in Supabase SQL Editor
-- ============================================================================

-- 1. Orchard status enum
DO $$ BEGIN
  CREATE TYPE orchard_status AS ENUM ('active', 'planning', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add planning columns to orchards
ALTER TABLE public.orchards
  ADD COLUMN IF NOT EXISTS status orchard_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS target_planting_date date,
  ADD COLUMN IF NOT EXISTS row_bearing numeric,           -- compass degrees 0-360
  ADD COLUMN IF NOT EXISTS headland_width numeric DEFAULT 6,
  ADD COLUMN IF NOT EXISTS pre_planning_notes text;

-- Migrate: set status from is_active
UPDATE public.orchards SET status = 'removed' WHERE is_active = false AND status = 'active';

-- 3. Planning task status enum
DO $$ BEGIN
  CREATE TYPE planning_task_status AS ENUM ('pending', 'in_progress', 'completed', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. Planning contacts — reusable across orchards within an org
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.planning_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  name text NOT NULL,
  company text,
  role text,            -- e.g. 'Soil Scientist', 'Nursery', 'Fumigation Contractor', 'Irrigation Designer'
  phone text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 5. Planning documents — file references per orchard per step
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.planning_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  orchard_id uuid NOT NULL REFERENCES public.orchards(id) ON DELETE CASCADE,
  step text NOT NULL,   -- e.g. 'tree_order', 'soil_report', 'fumigation_quote', 'netting_quote'
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES public.user_profiles(id)
);

-- ============================================================================
-- 6. Planning tasks — Gantt timeline items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.planning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  orchard_id uuid NOT NULL REFERENCES public.orchards(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL,  -- 'soil_profile', 'soil_prep', 'chemistry', 'fumigation', 'irrigation', 'structure', 'tree_order', 'cover_crop', 'planting', 'netting', 'drainage', 'windbreak'
  start_date date,
  end_date date,
  status planning_task_status NOT NULL DEFAULT 'pending',
  responsible_contact_id uuid REFERENCES public.planning_contacts(id),
  depends_on_task_id uuid REFERENCES public.planning_tasks(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 7. Orchard pollinators — 1-3 per planning orchard
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orchard_pollinators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  orchard_id uuid NOT NULL REFERENCES public.orchards(id) ON DELETE CASCADE,
  variety text NOT NULL,
  percentage numeric NOT NULL DEFAULT 10,  -- e.g. 10 means 10%
  nursery text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 8. Orchard planning spec — 1:1 with orchard, all planning-specific fields
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orchard_planning_spec (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  orchard_id uuid NOT NULL REFERENCES public.orchards(id) ON DELETE CASCADE,

  -- Tree order
  tree_type text,              -- '2yr_feathered', '1yr_maiden', 'sleeping_eye'
  tree_clone text,             -- strain/clone e.g. 'Brookfield', 'Kiku'
  main_nursery text,
  main_nursery_qty integer,
  second_nursery text,
  second_nursery_qty integer,
  tree_order_date date,
  tree_delivery_date date,
  tree_deposit numeric,

  -- Netting
  netting_required boolean DEFAULT false,
  netting_type text,           -- 'crystal', 'white', 'coloured'
  netting_structure text,      -- 'flat_top', 'peaked'
  netting_bay_type text,       -- 'single_bay', 'multi_bay'
  netting_contractor text,
  netting_booking_date date,
  netting_cost numeric,

  -- Poles
  end_pole_length numeric,     -- metres
  end_pole_diameter numeric,   -- mm
  end_pole_material text,
  inside_pole_length numeric,
  inside_pole_diameter numeric,
  inside_pole_material text,
  inside_pole_frequency integer,  -- every Nth tree
  end_row_type text,           -- 'angled_support' or 'wire_anchor'
  pole_unit_cost_end numeric,
  pole_unit_cost_inside numeric,

  -- Trellis wires
  wire_lines integer,          -- number of horizontal wire lines
  wire_gauge text,
  wire_bottom_height numeric,  -- metres from ground
  wire_unit_cost_per_m numeric,

  -- Irrigation
  irrigation_type text,        -- 'drip', 'micro'
  irrigation_micro_style text, -- 'hanging', 'upright_stakes'
  irrigation_emitter_spacing numeric,
  irrigation_flow_rate numeric,
  irrigation_filtration text,
  irrigation_fertigation text,
  irrigation_designer text,
  irrigation_cost numeric,

  -- Drainage
  drainage_required boolean DEFAULT false,
  drainage_type text,          -- 'subsurface_pipe', 'french_drain', 'surface_shaping'
  drainage_notes text,
  drainage_contractor text,
  drainage_cost numeric,

  -- Soil profile
  soil_scientist_contact_id uuid REFERENCES public.planning_contacts(id),
  soil_visit_date date,
  soil_samples_sent_date date,
  soil_report_received_date date,

  -- Soil prep & chemistry
  ripping_depth numeric,
  ridging_notes text,
  lime_rate_kg_ha numeric,
  gypsum_rate_kg_ha numeric,
  phosphate_rate_kg_ha numeric,
  other_amendments text,
  soil_prep_cost numeric,

  -- Fumigation
  fumigation_required boolean DEFAULT false,
  fumigant_type text,
  fumigation_provider text,
  fumigation_booked_date date,
  fumigation_cost numeric,

  -- Cover crop
  cover_crop_species text,
  cover_crop_timing text,
  cover_crop_pattern text,     -- 'working_row_vs_sward'
  cover_crop_cost numeric,

  -- Windbreak
  windbreak_required boolean DEFAULT false,
  windbreak_species text,
  windbreak_planting_date date,
  windbreak_location text,     -- which edges
  windbreak_cost numeric,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_orchard_spec UNIQUE (orchard_id)
);

-- ============================================================================
-- 9. RLS policies (basic — org-scoped)
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE public.planning_contacts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.planning_documents ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.planning_tasks ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.orchard_pollinators ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.orchard_planning_spec ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Allow authenticated users to read their org's data
DO $$ BEGIN
  CREATE POLICY planning_contacts_select ON public.planning_contacts
    FOR SELECT TO authenticated
    USING (organisation_id IN (SELECT organisation_id FROM public.organisation_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY planning_documents_select ON public.planning_documents
    FOR SELECT TO authenticated
    USING (organisation_id IN (SELECT organisation_id FROM public.organisation_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY planning_tasks_select ON public.planning_tasks
    FOR SELECT TO authenticated
    USING (organisation_id IN (SELECT organisation_id FROM public.organisation_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY orchard_pollinators_select ON public.orchard_pollinators
    FOR SELECT TO authenticated
    USING (organisation_id IN (SELECT organisation_id FROM public.organisation_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY orchard_planning_spec_select ON public.orchard_planning_spec
    FOR SELECT TO authenticated
    USING (organisation_id IN (SELECT organisation_id FROM public.organisation_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 10. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_planning_tasks_orchard ON public.planning_tasks(orchard_id);
CREATE INDEX IF NOT EXISTS idx_planning_documents_orchard ON public.planning_documents(orchard_id);
CREATE INDEX IF NOT EXISTS idx_orchard_pollinators_orchard ON public.orchard_pollinators(orchard_id);
CREATE INDEX IF NOT EXISTS idx_orchards_status ON public.orchards(status);
CREATE INDEX IF NOT EXISTS idx_planning_contacts_org ON public.planning_contacts(organisation_id);

-- ============================================================================
-- 11. RPC: Get planning summary for dashboard cards
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_planning_orchards(p_farm_ids uuid[])
RETURNS TABLE (
  orchard_id uuid,
  orchard_name text,
  farm_id uuid,
  farm_name text,
  commodity_code text,
  variety text,
  ha numeric,
  target_planting_date date,
  total_tasks bigint,
  completed_tasks bigint,
  next_overdue_task text,
  next_overdue_date date
)
LANGUAGE sql STABLE
AS $$
  WITH task_stats AS (
    SELECT
      pt.orchard_id,
      COUNT(*) AS total_tasks,
      COUNT(*) FILTER (WHERE pt.status = 'completed') AS completed_tasks,
      MIN(pt.end_date) FILTER (WHERE pt.status IN ('pending','in_progress') AND pt.end_date < CURRENT_DATE) AS earliest_overdue
    FROM planning_tasks pt
    GROUP BY pt.orchard_id
  ),
  overdue_names AS (
    SELECT DISTINCT ON (pt.orchard_id) pt.orchard_id, pt.name AS overdue_name, pt.end_date AS overdue_date
    FROM planning_tasks pt
    WHERE pt.status IN ('pending','in_progress') AND pt.end_date < CURRENT_DATE
    ORDER BY pt.orchard_id, pt.end_date
  )
  SELECT
    o.id AS orchard_id,
    o.name AS orchard_name,
    o.farm_id,
    f.full_name AS farm_name,
    c.code AS commodity_code,
    o.variety,
    o.ha,
    o.target_planting_date,
    COALESCE(ts.total_tasks, 0) AS total_tasks,
    COALESCE(ts.completed_tasks, 0) AS completed_tasks,
    od.overdue_name AS next_overdue_task,
    od.overdue_date AS next_overdue_date
  FROM orchards o
  JOIN farms f ON f.id = o.farm_id
  LEFT JOIN commodities c ON c.id = o.commodity_id
  LEFT JOIN task_stats ts ON ts.orchard_id = o.id
  LEFT JOIN overdue_names od ON od.orchard_id = o.id
  WHERE o.status = 'planning'
    AND o.farm_id = ANY(p_farm_ids)
  ORDER BY o.target_planting_date NULLS LAST, o.name;
$$;

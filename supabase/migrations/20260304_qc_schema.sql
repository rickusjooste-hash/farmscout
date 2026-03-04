-- ============================================================
-- QC App Phase 1: Bag Sample Module
-- Run manually in the Supabase SQL Editor
-- ============================================================

-- Employee roster (synced from Farm Costing Solutions via Python ODBC)
CREATE TABLE public.qc_employees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  employee_nr     text NOT NULL,
  full_name       text NOT NULL,
  team            text,
  is_active       boolean DEFAULT true,
  synced_at       timestamptz DEFAULT now(),
  UNIQUE (farm_id, employee_nr)
);

-- Size bins: maps a weight range → count label per commodity
-- e.g. Apple 88g–100g = Count 80, Pear 180g–215g = Count 40/45
CREATE TABLE public.size_bins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id  uuid NOT NULL REFERENCES commodities(id),
  label         text NOT NULL,           -- e.g. "Count 72", "Count 135", "80", "1L"
  weight_min_g  integer NOT NULL,
  weight_max_g  integer NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean DEFAULT true
);

-- A bag sample session — created by runner in field, completed by QC worker in caravan
CREATE TABLE public.qc_bag_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  orchard_id      uuid NOT NULL REFERENCES orchards(id),
  employee_id     uuid NOT NULL REFERENCES qc_employees(id),

  -- Stage 1: runner logs bag in the field
  runner_id       uuid REFERENCES user_profiles(id),
  collection_lat  numeric(10, 7),
  collection_lng  numeric(10, 7),
  collected_at    timestamptz,
  bag_seq         integer,               -- sequence for the day (Bag #1, #2…)

  -- Stage 2: QC worker completes the sample
  qc_worker_id    uuid REFERENCES user_profiles(id),
  sampled_at      timestamptz,

  status          text NOT NULL DEFAULT 'collected',  -- 'collected' | 'sampled'
  notes           text,
  created_at      timestamptz DEFAULT now()
);

-- One row per fruit weighed in the bag
CREATE TABLE public.qc_fruit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES qc_bag_sessions(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  seq             integer NOT NULL,      -- 1-based position in bag
  weight_g        integer NOT NULL,      -- raw scale reading in grams
  size_bin_id     uuid REFERENCES size_bins(id),
  created_at      timestamptz DEFAULT now()
);

-- Issues recorded per fruit (pest damage, quality defects, picking issues)
-- Reuses pests table; category 'qc_issue' or 'picking_issue' in commodity_pests
CREATE TABLE public.qc_fruit_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fruit_id        uuid NOT NULL REFERENCES qc_fruit(id),
  pest_id         uuid NOT NULL REFERENCES pests(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  created_at      timestamptz DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_qc_bag_sessions_farm_status ON public.qc_bag_sessions(farm_id, status);
CREATE INDEX idx_qc_bag_sessions_collected_at ON public.qc_bag_sessions(collected_at);
CREATE INDEX idx_qc_fruit_session ON public.qc_fruit(session_id);
CREATE INDEX idx_qc_fruit_issues_fruit ON public.qc_fruit_issues(fruit_id);
CREATE INDEX idx_qc_employees_farm ON public.qc_employees(farm_id, is_active);
CREATE INDEX idx_size_bins_commodity ON public.size_bins(commodity_id, display_order);

-- ── Extend observation_category enum with QC values ──────────────────────
-- commodity_pests.category is a PostgreSQL enum named observation_category.
-- Add the two QC values so the RPC filter below will work.
ALTER TYPE observation_category ADD VALUE IF NOT EXISTS 'qc_issue';
ALTER TYPE observation_category ADD VALUE IF NOT EXISTS 'picking_issue';

-- ── RPC: get_qc_reference_data ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_qc_reference_data(p_farm_ids uuid[])
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'employees', (
      SELECT json_agg(e ORDER BY e.full_name)
      FROM qc_employees e
      WHERE e.farm_id = ANY(p_farm_ids) AND e.is_active
    ),
    'size_bins', (
      SELECT json_agg(sb ORDER BY sb.commodity_id, sb.display_order)
      FROM size_bins sb
      WHERE sb.commodity_id IN (
        SELECT DISTINCT commodity_id FROM orchards WHERE farm_id = ANY(p_farm_ids) AND is_active
      )
      AND sb.is_active
    ),
    'qc_issues', (
      SELECT json_agg(json_build_object(
        'id',            cp.id,
        'commodity_id',  cp.commodity_id,
        'pest_id',       cp.pest_id,
        'category',      cp.category,
        'display_name',  COALESCE(cp.display_name, p.name),
        'display_order', cp.display_order
      ) ORDER BY cp.commodity_id, cp.display_order)
      FROM commodity_pests cp
      JOIN pests p ON p.id = cp.pest_id
      WHERE cp.commodity_id IN (
        SELECT DISTINCT commodity_id FROM orchards WHERE farm_id = ANY(p_farm_ids) AND is_active
      )
      AND cp.category IN ('qc_issue'::observation_category, 'picking_issue'::observation_category)
      AND cp.is_active
    ),
    'orchards', (
      SELECT json_agg(json_build_object(
        'id',           o.id,
        'name',         o.name,
        'commodity_id', o.commodity_id,
        'boundary',     CASE WHEN o.boundary IS NOT NULL
                             THEN ST_AsGeoJSON(o.boundary)::json
                             ELSE NULL END
      ) ORDER BY o.name)
      FROM orchards o
      WHERE o.farm_id = ANY(p_farm_ids) AND o.is_active
    )
  );
$$;

-- ── RPC: get_daily_bag_seq ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_daily_bag_seq(p_farm_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(MAX(bag_seq), 0) + 1
  FROM qc_bag_sessions
  WHERE farm_id = p_farm_id
    AND collected_at::date = CURRENT_DATE;
$$;

-- ── RLS policies ──────────────────────────────────────────────────────────
-- Adjust to match your existing RLS approach.
-- The QC app uses service-role key for sync, so these are mainly for manager reads.

ALTER TABLE public.qc_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_bag_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_fruit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_fruit_issues ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all QC data in their organisation
CREATE POLICY "qc_employees_select" ON public.qc_employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "size_bins_select" ON public.size_bins
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "qc_bag_sessions_select" ON public.qc_bag_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "qc_bag_sessions_insert" ON public.qc_bag_sessions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "qc_bag_sessions_update" ON public.qc_bag_sessions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "qc_fruit_select" ON public.qc_fruit
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "qc_fruit_insert" ON public.qc_fruit
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "qc_fruit_issues_select" ON public.qc_fruit_issues
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "qc_fruit_issues_insert" ON public.qc_fruit_issues
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Seed data: size_bins ──────────────────────────────────────────────────
-- Placeholder data — adjust weight ranges + labels to match actual packing specs.
-- You MUST confirm these with the packhouse before deploying.
--
-- To run: replace <apple_commodity_id>, <pear_commodity_id>, etc.
-- with actual UUIDs from SELECT id, code FROM commodities;

/*
-- Apple size bins (example — adjust to your actual spec)
INSERT INTO size_bins (commodity_id, label, weight_min_g, weight_max_g, display_order) VALUES
  ('<apple_commodity_id>', 'Count 60',  215, 999, 1),
  ('<apple_commodity_id>', 'Count 72',  185, 214, 2),
  ('<apple_commodity_id>', 'Count 80',  165, 184, 3),
  ('<apple_commodity_id>', 'Count 88',  148, 164, 4),
  ('<apple_commodity_id>', 'Count 100', 131, 147, 5),
  ('<apple_commodity_id>', 'Count 113', 115, 130, 6),
  ('<apple_commodity_id>', 'Count 125', 100, 114, 7),
  ('<apple_commodity_id>', 'Count 138',  88,  99, 8),
  ('<apple_commodity_id>', 'Count 150',  75,  87, 9),
  ('<apple_commodity_id>', 'Count 163',   0,  74, 10);

-- Pear size bins (example — adjust to your actual spec)
INSERT INTO size_bins (commodity_id, label, weight_min_g, weight_max_g, display_order) VALUES
  ('<pear_commodity_id>', 'Count 30',  295, 999, 1),
  ('<pear_commodity_id>', 'Count 35',  255, 294, 2),
  ('<pear_commodity_id>', 'Count 40',  215, 254, 3),
  ('<pear_commodity_id>', 'Count 45',  180, 214, 4),
  ('<pear_commodity_id>', 'Count 55',  147, 179, 5),
  ('<pear_commodity_id>', 'Count 65',  121, 146, 6),
  ('<pear_commodity_id>', 'Count 75',  100, 120, 7),
  ('<pear_commodity_id>', 'Count 90',    0,  99, 8);
*/

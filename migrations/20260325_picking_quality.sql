-- Picking quality (drop & shiners) inspection tables

CREATE TABLE public.picking_quality_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  team text,
  qc_worker_id uuid NOT NULL REFERENCES user_profiles(id),
  inspected_at timestamptz NOT NULL,
  tree_count integer NOT NULL DEFAULT 10,
  total_drops integer NOT NULL DEFAULT 0,
  total_shiners integer NOT NULL DEFAULT 0,
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.picking_quality_trees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES picking_quality_sessions(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  tree_nr integer NOT NULL,
  drops integer NOT NULL DEFAULT 0,
  shiners integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.picking_quality_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picking_quality_trees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated select picking_quality_sessions"
  ON public.picking_quality_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert picking_quality_sessions"
  ON public.picking_quality_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update picking_quality_sessions"
  ON public.picking_quality_sessions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated select picking_quality_trees"
  ON public.picking_quality_trees FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert picking_quality_trees"
  ON public.picking_quality_trees FOR INSERT TO authenticated WITH CHECK (true);

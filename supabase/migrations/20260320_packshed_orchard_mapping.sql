-- Paltrack orchard+variety → allFarm orchard mapping
CREATE TABLE IF NOT EXISTS public.packout_orchard_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  paltrack_orchard_code text NOT NULL,
  paltrack_variety text NOT NULL,
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, paltrack_orchard_code, paltrack_variety)
);

ALTER TABLE public.packout_orchard_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packout_orchard_map_select" ON packout_orchard_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_orchard_map_insert" ON packout_orchard_map FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "packout_orchard_map_update" ON packout_orchard_map FOR UPDATE TO authenticated USING (true);
CREATE POLICY "packout_orchard_map_delete" ON packout_orchard_map FOR DELETE TO authenticated USING (true);
CREATE POLICY "packout_orchard_map_all" ON packout_orchard_map FOR ALL TO service_role USING (true);

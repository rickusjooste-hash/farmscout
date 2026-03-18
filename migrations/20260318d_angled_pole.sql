-- Angled support pole spec (when end_row_type = 'angled_support')
ALTER TABLE public.orchard_planning_spec
  ADD COLUMN IF NOT EXISTS angled_pole_length numeric,
  ADD COLUMN IF NOT EXISTS angled_pole_diameter numeric,
  ADD COLUMN IF NOT EXISTS angled_pole_material text,
  ADD COLUMN IF NOT EXISTS angled_pole_unit_cost numeric;

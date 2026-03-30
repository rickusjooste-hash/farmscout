-- Spitter/emitter types with flow rates for volume estimation on unmetered blocks

CREATE TABLE IF NOT EXISTS public.spitter_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  flow_rate_lph numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Seed from farm's SpitterTypes reference
INSERT INTO public.spitter_types (name, flow_rate_lph) VALUES
  ('Gyro Wit',    30),
  ('Gyro Brown',  30),
  ('Gyro Yellow', 50),
  ('Gyro Green',  40),
  ('Dan Brown',   43),
  ('Dan Violet',  35),
  ('Dan Gray',    70),
  ('Dan Green',  105),
  ('Gyro Black',  20)
ON CONFLICT (name) DO NOTHING;

-- Add FK to orchards
ALTER TABLE public.orchards
  ADD COLUMN IF NOT EXISTS spitter_type_id uuid REFERENCES spitter_types(id);

-- RLS
ALTER TABLE public.spitter_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spitter_types_select" ON spitter_types FOR SELECT TO authenticated USING (true);

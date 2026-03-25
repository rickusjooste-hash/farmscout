-- Add is_active to trap_types and lure_types (they currently lack it)
ALTER TABLE trap_types ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE lure_types ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Junction table: valid trap type ↔ lure type combinations
CREATE TABLE IF NOT EXISTS public.trap_type_lure_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trap_type_id uuid NOT NULL REFERENCES trap_types(id) ON DELETE CASCADE,
  lure_type_id uuid REFERENCES lure_types(id) ON DELETE CASCADE,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (trap_type_id, lure_type_id)
);

-- Prevent multiple NULL-lure rows per trap type
CREATE UNIQUE INDEX IF NOT EXISTS trap_type_no_lure_unique
  ON trap_type_lure_types (trap_type_id)
  WHERE lure_type_id IS NULL;

-- RLS: read for all authenticated users
ALTER TABLE trap_type_lure_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trap_type_lure_types' AND policyname = 'Authenticated read'
  ) THEN
    CREATE POLICY "Authenticated read" ON trap_type_lure_types
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Seed valid combinations (uses name-based subqueries so UUIDs don't need to be hardcoded)
-- Delta trap: pheromone lures
INSERT INTO trap_type_lure_types (trap_type_id, lure_type_id, is_default)
SELECT tt.id, lt.id, (lt.name ILIKE '%codl%')
FROM trap_types tt, lure_types lt
WHERE tt.name ILIKE '%delta%'
  AND (lt.name ILIKE '%codl%' OR lt.name ILIKE '%fcm%' OR lt.name ILIKE '%ofm%' OR lt.name ILIKE '%boll%')
ON CONFLICT (trap_type_id, lure_type_id) DO NOTHING;

-- Bucket trap: food attractant lures
INSERT INTO trap_type_lure_types (trap_type_id, lure_type_id, is_default)
SELECT tt.id, lt.id, (lt.name ILIKE '%capil%' OR lt.name ILIKE '%trimed%')
FROM trap_types tt, lure_types lt
WHERE tt.name ILIKE '%bucket%'
  AND (lt.name ILIKE '%capil%' OR lt.name ILIKE '%trimed%' OR lt.name ILIKE '%quest%' OR lt.name ILIKE '%biolure%' OR lt.name ILIKE '%methyl%')
ON CONFLICT (trap_type_id, lure_type_id) DO NOTHING;

-- McPhail trap: protein-based lures
INSERT INTO trap_type_lure_types (trap_type_id, lure_type_id, is_default)
SELECT tt.id, lt.id, true
FROM trap_types tt, lure_types lt
WHERE tt.name ILIKE '%mcphail%'
  AND (lt.name ILIKE '%quest%' OR lt.name ILIKE '%biolure%')
ON CONFLICT (trap_type_id, lure_type_id) DO NOTHING;

-- Yellow sticky board: no lure (NULL)
INSERT INTO trap_type_lure_types (trap_type_id, lure_type_id, is_default)
SELECT tt.id, NULL, true
FROM trap_types tt
WHERE tt.name ILIKE '%yellow%' OR tt.name ILIKE '%sticky%'
ON CONFLICT (trap_type_id, lure_type_id) DO NOTHING;

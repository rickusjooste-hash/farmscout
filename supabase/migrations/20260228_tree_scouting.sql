-- Tree Scouting Migration
-- Run in Supabase Dashboard → SQL Editor

-- ── Step 1: Observation method enum ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE observation_method AS ENUM ('present_absent', 'count', 'leaf_inspection');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Step 2: Add observation_method to commodity_pests ────────────────────────
ALTER TABLE commodity_pests
  ADD COLUMN IF NOT EXISTS observation_method observation_method NOT NULL DEFAULT 'count';

CREATE INDEX IF NOT EXISTS commodity_pests_commodity_id_idx ON commodity_pests(commodity_id);

-- ── Step 3: Seed commodities ─────────────────────────────────────────────────
INSERT INTO commodities (code, name) VALUES
  ('POME',   'Pomefruit'),
  ('STONE',  'Stonefruit'),
  ('CITRUS', 'Citrus')
ON CONFLICT (code) DO NOTHING;

-- ── Step 4: Add columns to inspection_sessions ───────────────────────────────
ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS commodity_id   uuid REFERENCES commodities(id),
  ADD COLUMN IF NOT EXISTS tree_count     integer,
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz;

-- ── Step 5: Add columns to inspection_trees ──────────────────────────────────
ALTER TABLE inspection_trees
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS comments  text;

-- ── Step 6: Supabase Storage bucket ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "scouts can upload photos"    ON storage.objects;
DROP POLICY IF EXISTS "photos are publicly readable" ON storage.objects;

CREATE POLICY "scouts can upload photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "photos are publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'inspection-photos');

-- ── Step 1b: Farm-level pest config override table ───────────────────────────
CREATE TABLE IF NOT EXISTS farm_commodity_pest_config (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           uuid NOT NULL REFERENCES farms(id),
  commodity_pest_id uuid NOT NULL REFERENCES commodity_pests(id),
  is_active         boolean NOT NULL DEFAULT true,
  CONSTRAINT farm_commodity_pest_config_unique UNIQUE (farm_id, commodity_pest_id)
);

ALTER TABLE farm_commodity_pest_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scouts read own farm pest config" ON farm_commodity_pest_config;

CREATE POLICY "scouts read own farm pest config"
  ON farm_commodity_pest_config FOR SELECT TO authenticated
  USING (
    farm_id = (
      SELECT farm_id FROM scouts WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

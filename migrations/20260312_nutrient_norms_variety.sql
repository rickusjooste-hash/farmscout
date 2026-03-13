-- Add variety column to nutrient_norms for variety-level norm overrides
-- Run in Supabase SQL Editor after previous leaf_analysis migrations

ALTER TABLE nutrient_norms ADD COLUMN IF NOT EXISTS variety text;

-- Drop the old table-level unique constraint (doesn't handle NULLs properly)
ALTER TABLE nutrient_norms DROP CONSTRAINT IF EXISTS nutrient_norms_organisation_id_commodity_id_nutrient_id_samp_key;

-- System defaults at commodity level (org=NULL, variety=NULL)
DROP INDEX IF EXISTS idx_nutrient_norms_system_defaults;
CREATE UNIQUE INDEX idx_nutrient_norms_system_defaults
  ON nutrient_norms (commodity_id, nutrient_id, sample_type)
  WHERE organisation_id IS NULL AND variety IS NULL;

-- Org-specific at commodity level (org NOT NULL, variety=NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrient_norms_org_commodity
  ON nutrient_norms (organisation_id, commodity_id, nutrient_id, sample_type)
  WHERE organisation_id IS NOT NULL AND variety IS NULL;

-- Org-specific at variety level (org NOT NULL, variety NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrient_norms_org_variety
  ON nutrient_norms (organisation_id, commodity_id, nutrient_id, sample_type, variety)
  WHERE organisation_id IS NOT NULL AND variety IS NOT NULL;

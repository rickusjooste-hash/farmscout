-- Leaf Analysis Module — run in Supabase SQL Editor
-- Creates: nutrients, leaf_analyses, leaf_analysis_results, nutrient_norms, leaf_analysis_orchard_map

-- 1. Nutrient lookup table
CREATE TABLE public.nutrients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  symbol        text NOT NULL,
  category      text NOT NULL DEFAULT 'macro',
  default_unit  text NOT NULL DEFAULT '%',
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Seed standard nutrients
INSERT INTO public.nutrients (code, name, symbol, category, default_unit, display_order) VALUES
  ('N',  'Nitrogen',    'N',  'macro', '%',     1),
  ('P',  'Phosphorus',  'P',  'macro', '%',     2),
  ('K',  'Potassium',   'K',  'macro', '%',     3),
  ('Ca', 'Calcium',     'Ca', 'macro', '%',     4),
  ('Mg', 'Magnesium',   'Mg', 'macro', '%',     5),
  ('S',  'Sulphur',     'S',  'macro', '%',     6),
  ('Fe', 'Iron',        'Fe', 'micro', 'mg/kg', 7),
  ('Mn', 'Manganese',   'Mn', 'micro', 'mg/kg', 8),
  ('Zn', 'Zinc',        'Zn', 'micro', 'mg/kg', 9),
  ('Cu', 'Copper',      'Cu', 'micro', 'mg/kg', 10),
  ('B',  'Boron',       'B',  'micro', 'mg/kg', 11),
  ('Mo', 'Molybdenum',  'Mo', 'micro', 'mg/kg', 12),
  ('Na', 'Sodium',      'Na', 'micro', 'mg/kg', 13),
  ('Cl', 'Chloride',    'Cl', 'micro', 'mg/kg', 14);

-- 2. Leaf analysis samples (one row per sample)
CREATE TABLE public.leaf_analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  orchard_id      uuid NOT NULL REFERENCES orchards(id),
  zone_id         uuid REFERENCES zones(id),
  season          text NOT NULL,
  sample_date     date NOT NULL,
  sample_type     text NOT NULL DEFAULT 'mid-season',
  lab_name        text,
  lab_reference   text,
  pdf_url         text,
  notes           text,
  imported_by     uuid REFERENCES user_profiles(id),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_leaf_analyses_orchard_season ON leaf_analyses (orchard_id, season);
CREATE INDEX idx_leaf_analyses_farm ON leaf_analyses (farm_id);

-- 3. Leaf analysis results (one row per nutrient per sample)
CREATE TABLE public.leaf_analysis_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES leaf_analyses(id) ON DELETE CASCADE,
  nutrient_id uuid NOT NULL REFERENCES nutrients(id),
  value       numeric NOT NULL,
  unit        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (analysis_id, nutrient_id)
);

-- 4. Nutrient norms / optimal ranges per commodity (Phase 2)
CREATE TABLE public.nutrient_norms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES organisations(id),
  commodity_id    uuid NOT NULL REFERENCES commodities(id),
  nutrient_id     uuid NOT NULL REFERENCES nutrients(id),
  sample_type     text NOT NULL DEFAULT 'mid-season',
  min_optimal     numeric NOT NULL,
  max_optimal     numeric NOT NULL,
  min_adequate    numeric,
  max_adequate    numeric,
  unit            text NOT NULL,
  source          text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organisation_id, commodity_id, nutrient_id, sample_type)
);

-- 5. Orchard mapping table (persists CSV name → system orchard mappings)
CREATE TABLE public.leaf_analysis_orchard_map (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id         uuid NOT NULL REFERENCES farms(id),
  source_name     text NOT NULL,
  orchard_id      uuid NOT NULL REFERENCES orchards(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organisation_id, farm_id, source_name)
);

-- 6. RPC: get_leaf_analysis_summary
-- Returns per-orchard latest nutrient values for a given season
CREATE OR REPLACE FUNCTION public.get_leaf_analysis_summary(
  p_farm_ids uuid[],
  p_season text DEFAULT NULL
)
RETURNS TABLE (
  orchard_id uuid,
  orchard_name text,
  commodity_name text,
  season text,
  sample_date date,
  sample_type text,
  lab_name text,
  nutrient_code text,
  nutrient_name text,
  category text,
  value numeric,
  unit text,
  display_order integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    la.orchard_id,
    o.name AS orchard_name,
    c.name AS commodity_name,
    la.season,
    la.sample_date,
    la.sample_type,
    la.lab_name,
    n.code AS nutrient_code,
    n.name AS nutrient_name,
    n.category,
    lar.value,
    lar.unit,
    n.display_order
  FROM leaf_analyses la
  JOIN leaf_analysis_results lar ON lar.analysis_id = la.id
  JOIN nutrients n ON n.id = lar.nutrient_id
  JOIN orchards o ON o.id = la.orchard_id
  JOIN commodities c ON c.id = o.commodity_id
  WHERE la.farm_id = ANY(p_farm_ids)
    AND (p_season IS NULL OR la.season = p_season)
  ORDER BY o.name, n.display_order;
$$;

-- 7. RPC: get_leaf_analysis_trend
-- Returns all seasons' values for a specific orchard
CREATE OR REPLACE FUNCTION public.get_leaf_analysis_trend(
  p_orchard_id uuid
)
RETURNS TABLE (
  season text,
  sample_date date,
  sample_type text,
  nutrient_code text,
  nutrient_name text,
  category text,
  value numeric,
  unit text,
  display_order integer
)
LANGUAGE sql STABLE
AS $$
  SELECT
    la.season,
    la.sample_date,
    la.sample_type,
    n.code AS nutrient_code,
    n.name AS nutrient_name,
    n.category,
    lar.value,
    lar.unit,
    n.display_order
  FROM leaf_analyses la
  JOIN leaf_analysis_results lar ON lar.analysis_id = la.id
  JOIN nutrients n ON n.id = lar.nutrient_id
  WHERE la.orchard_id = p_orchard_id
  ORDER BY la.season, n.display_order;
$$;

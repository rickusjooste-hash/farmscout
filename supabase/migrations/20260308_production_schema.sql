-- Production module tables
-- Run in Supabase SQL Editor

-- ── production_bins (from BinsRec sheet) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.production_bins (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id),
  farm_id           uuid NOT NULL REFERENCES farms(id),
  orchard_id        uuid REFERENCES orchards(id),
  xlsx_id           text NOT NULL,
  orchard_legacy_id integer,
  orchard_name      text,
  variety           text,
  team              text,
  team_name         text,
  bins              numeric NOT NULL DEFAULT 0,
  juice             numeric NOT NULL DEFAULT 0,
  total             numeric NOT NULL DEFAULT 0,
  production_year   text NOT NULL,
  season            text NOT NULL,
  week_num          integer,
  week_day          text,
  farm_code         text,
  received_date     date NOT NULL,
  received_time     time,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (organisation_id, xlsx_id)
);

CREATE INDEX IF NOT EXISTS idx_production_bins_farm_season
  ON production_bins (farm_id, season);
CREATE INDEX IF NOT EXISTS idx_production_bins_orchard
  ON production_bins (orchard_id);

ALTER TABLE production_bins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_bins_select" ON production_bins
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_bins_all" ON production_bins
  FOR ALL TO service_role USING (true);

-- ── production_bruising (from Bruising sheet) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.production_bruising (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id),
  farm_id           uuid NOT NULL REFERENCES farms(id),
  orchard_id        uuid REFERENCES orchards(id),
  xlsx_id           text NOT NULL,
  orchard_legacy_id integer,
  orchard_name      text,
  variety           text,
  team              text,
  team_name         text,
  bruising_count    integer DEFAULT 0,
  stem_count        integer DEFAULT 0,
  injury_count      integer DEFAULT 0,
  sample_size       integer DEFAULT 0,
  bruising_pct      numeric(5,2),
  stem_pct          numeric(5,2),
  injury_pct        numeric(5,2),
  sample_nr         integer,
  bin_weight_kg     numeric(6,2),
  fruit_guard       text,
  production_year   text NOT NULL,
  season            text NOT NULL,
  week_num          integer,
  received_date     date NOT NULL,
  received_time     time,
  farm_code         text,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (organisation_id, xlsx_id)
);

CREATE INDEX IF NOT EXISTS idx_production_bruising_farm_season
  ON production_bruising (farm_id, season);
CREATE INDEX IF NOT EXISTS idx_production_bruising_orchard
  ON production_bruising (orchard_id);

ALTER TABLE production_bruising ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_bruising_select" ON production_bruising
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_bruising_all" ON production_bruising
  FOR ALL TO service_role USING (true);

-- ── production_packing (from Packing sheet) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.production_packing (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id),
  farm_id           uuid NOT NULL REFERENCES farms(id),
  orchard_id        uuid REFERENCES orchards(id),
  xlsx_nr           text NOT NULL,
  orchard_legacy_id integer,
  orchard_name      text,
  variety           text,
  bins_packed       numeric DEFAULT 0,
  juice_packshed    numeric DEFAULT 0,
  remaining_bins    numeric DEFAULT 0,
  production_year   text NOT NULL,
  season            text NOT NULL,
  packed_date       date NOT NULL,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (organisation_id, xlsx_nr)
);

CREATE INDEX IF NOT EXISTS idx_production_packing_farm_season
  ON production_packing (farm_id, season);

ALTER TABLE production_packing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_packing_select" ON production_packing
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_packing_all" ON production_packing
  FOR ALL TO service_role USING (true);

-- ── production_bin_weights (configurable fallback weights) ───────────────────

CREATE TABLE IF NOT EXISTS public.production_bin_weights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  commodity_id    uuid NOT NULL REFERENCES commodities(id),
  variety         text,
  default_weight_kg numeric(6,2) NOT NULL DEFAULT 400,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Unique index with COALESCE for nullable variety
CREATE UNIQUE INDEX IF NOT EXISTS production_bin_weights_uniq
  ON production_bin_weights (organisation_id, commodity_id, COALESCE(variety, ''));

ALTER TABLE production_bin_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_bin_weights_select" ON production_bin_weights
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "production_bin_weights_insert" ON production_bin_weights
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "production_bin_weights_update" ON production_bin_weights
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "production_bin_weights_delete" ON production_bin_weights
  FOR DELETE TO authenticated USING (true);

-- ── Module registration ──────────────────────────────────────────────────────
-- Run this to enable the production module for the org:
-- UPDATE organisations SET modules = array_append(modules, 'production')
--   WHERE id = '93d1760e-a484-4379-95fb-6cad294e2191';

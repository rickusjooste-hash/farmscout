-- ============================================================
-- Packshed Packout Module – schema
-- ============================================================

-- ── Reference tables ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.packhouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, code)
);

ALTER TABLE public.packhouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packhouses" ON public.packhouses
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_write_packhouses" ON public.packhouses
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- Box types – auto-derived from Paltrack PACK+GRADE combos
-- code = "M18X 1A" (pack + grade), pack_code = "M18X", grade = "1A"
CREATE TABLE IF NOT EXISTS public.packout_box_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  code text NOT NULL,
  name text NOT NULL,
  pack_code text NOT NULL,
  grade text NOT NULL,
  cartons_per_pallet integer NOT NULL DEFAULT 56,
  weight_per_carton_kg numeric(6,3),
  season text NOT NULL DEFAULT '2026',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, code, season)
);

ALTER TABLE public.packout_box_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_box_types" ON public.packout_box_types
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_write_packout_box_types" ON public.packout_box_types
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- Sizes – fruit count per carton (flat list, org-scoped)
CREATE TABLE IF NOT EXISTS public.packout_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, label)
);

ALTER TABLE public.packout_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_sizes" ON public.packout_sizes
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_write_packout_sizes" ON public.packout_sizes
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- Valid box_type × size combos – auto-derived from Paltrack sizes table
-- Determines which cells appear in the floor stock grid
CREATE TABLE IF NOT EXISTS public.packout_box_type_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  box_type_id uuid NOT NULL REFERENCES packout_box_types(id) ON DELETE CASCADE,
  size_id uuid NOT NULL REFERENCES packout_sizes(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, box_type_id, size_id)
);

ALTER TABLE public.packout_box_type_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_box_type_sizes" ON public.packout_box_type_sizes
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_write_packout_box_type_sizes" ON public.packout_box_type_sizes
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- ── PWA data tables ──────────────────────────────────────────

-- Bin weights (from Bin Weighing PWA)
CREATE TABLE IF NOT EXISTS public.packout_bin_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  packhouse_id uuid NOT NULL REFERENCES packhouses(id),
  orchard_id uuid REFERENCES orchards(id),
  weigh_date date NOT NULL,
  seq integer NOT NULL,
  category text NOT NULL CHECK (category IN ('pack', 'juice', 'rot')),
  gross_weight_kg numeric(8,2) NOT NULL,
  bin_type text NOT NULL CHECK (bin_type IN ('plastic', 'wood')),
  tare_weight_kg numeric(6,2) NOT NULL,
  net_weight_kg numeric(8,2) GENERATED ALWAYS AS (gross_weight_kg - tare_weight_kg) STORED,
  weighed_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, packhouse_id, weigh_date, category, seq)
);

ALTER TABLE public.packout_bin_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_bin_weights" ON public.packout_bin_weights
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_insert_packout_bin_weights" ON public.packout_bin_weights
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- Juice sampling session header
CREATE TABLE IF NOT EXISTS public.packout_juice_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  packhouse_id uuid NOT NULL REFERENCES packhouses(id),
  orchard_id uuid REFERENCES orchards(id),
  sample_date date NOT NULL,
  sample_size integer NOT NULL DEFAULT 50,
  sampled_by uuid REFERENCES user_profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.packout_juice_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_juice_samples" ON public.packout_juice_samples
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_insert_packout_juice_samples" ON public.packout_juice_samples
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- Juice defect counts per sample
CREATE TABLE IF NOT EXISTS public.packout_juice_defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES packout_juice_samples(id) ON DELETE CASCADE,
  pest_id uuid NOT NULL REFERENCES pests(id),
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.packout_juice_defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_juice_defects" ON public.packout_juice_defects
  FOR SELECT USING (
    sample_id IN (
      SELECT id FROM packout_juice_samples WHERE organisation_id IN (
        SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
      )
    )
  );
CREATE POLICY "org_insert_packout_juice_defects" ON public.packout_juice_defects
  FOR INSERT WITH CHECK (
    sample_id IN (
      SELECT id FROM packout_juice_samples WHERE organisation_id IN (
        SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
      )
    )
  );

-- ── Paltrack import table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.packout_pallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  packhouse_id uuid REFERENCES packhouses(id),
  orchard_id uuid REFERENCES orchards(id),
  pack_date date,
  box_type_id uuid REFERENCES packout_box_types(id),
  size_id uuid REFERENCES packout_sizes(id),
  carton_count integer NOT NULL DEFAULT 0,
  pallet_nr text,
  paltrack_id text NOT NULL,
  commodity text,
  variety text,
  pack_code text,
  grade text,
  size_count text,
  farm_code text,
  orchard_code text,
  season text,
  imported_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, paltrack_id)
);

ALTER TABLE public.packout_pallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_pallets" ON public.packout_pallets
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- ── Packout working tables ───────────────────────────────────

-- Floor stock snapshot (box_type x size grid)
CREATE TABLE IF NOT EXISTS public.packout_floor_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  packhouse_id uuid NOT NULL REFERENCES packhouses(id),
  stock_date date NOT NULL,
  box_type_id uuid NOT NULL REFERENCES packout_box_types(id),
  size_id uuid NOT NULL REFERENCES packout_sizes(id),
  carton_count integer NOT NULL DEFAULT 0,
  entered_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, packhouse_id, stock_date, box_type_id, size_id)
);

ALTER TABLE public.packout_floor_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_floor_stock" ON public.packout_floor_stock
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_write_packout_floor_stock" ON public.packout_floor_stock
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- Daily session – one per packhouse x date (not per orchard — multiple orchards per day)
CREATE TABLE IF NOT EXISTS public.packout_daily_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  packhouse_id uuid NOT NULL REFERENCES packhouses(id),
  pack_date date NOT NULL,
  smous_weight_kg numeric(8,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'finalized')),
  notes text,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, packhouse_id, pack_date)
);

ALTER TABLE public.packout_daily_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_daily_sessions" ON public.packout_daily_sessions
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_write_packout_daily_sessions" ON public.packout_daily_sessions
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- Orchard final aggregates (locked when done)
CREATE TABLE IF NOT EXISTS public.packout_orchard_finals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  packhouse_id uuid NOT NULL REFERENCES packhouses(id),
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  season text NOT NULL,
  total_bins integer,
  avg_bin_weight_kg numeric(8,2),
  total_kg_in numeric(12,2),
  total_cartons integer,
  total_kg_out numeric(12,2),
  juice_kg numeric(10,2),
  rot_kg numeric(10,2),
  smous_kg numeric(10,2),
  conversion_pct numeric(5,2),
  loss_pct numeric(5,2),
  finalized_at timestamptz,
  finalized_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (organisation_id, orchard_id, season)
);

ALTER TABLE public.packout_orchard_finals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read_packout_orchard_finals" ON public.packout_orchard_finals
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "org_write_packout_orchard_finals" ON public.packout_orchard_finals
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_packout_bin_weights_date ON packout_bin_weights (packhouse_id, weigh_date);
CREATE INDEX IF NOT EXISTS idx_packout_pallets_date ON packout_pallets (organisation_id, pack_date);
CREATE INDEX IF NOT EXISTS idx_packout_pallets_paltrack ON packout_pallets (organisation_id, paltrack_id);
CREATE INDEX IF NOT EXISTS idx_packout_floor_stock_date ON packout_floor_stock (packhouse_id, stock_date);
CREATE INDEX IF NOT EXISTS idx_packout_daily_sessions_date ON packout_daily_sessions (packhouse_id, pack_date);

-- ── Seed default sizes (MVT org) ─────────────────────────────
-- These will also be auto-derived by the Paltrack sync script

INSERT INTO public.packout_sizes (organisation_id, label, sort_order, is_active)
SELECT '93d1760e-a484-4379-95fb-6cad294e2191', label, sort_order, true
FROM (VALUES
  ('38', 1), ('45', 2), ('52', 3), ('60', 4),
  ('70', 5), ('80', 6), ('90', 7), ('100', 8), ('110', 9),
  ('120', 10), ('135', 11), ('150', 12), ('165', 13), ('180', 14),
  ('198', 15), ('216', 16), ('234', 17), ('252', 18)
) AS v(label, sort_order)
ON CONFLICT (organisation_id, label) DO NOTHING;

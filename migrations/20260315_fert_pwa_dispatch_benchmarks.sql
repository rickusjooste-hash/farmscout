-- Fertilizer PWA + Dispatch + Industry Benchmarks — run in Supabase SQL Editor
-- Creates: fert_dispatches, fert_dispatch_sections, fert_section_assignments,
--          industry_benchmarks, org_production_targets
-- Alters:  fert_applications (add field-capture columns)
-- RPCs:    get_fert_dispatched_lines, get_production_benchmarks

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ALTER fert_applications — add field-capture columns for PWA
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fert_applications ADD COLUMN IF NOT EXISTS actual_rate_per_ha numeric;
ALTER TABLE public.fert_applications ADD COLUMN IF NOT EXISTS actual_total_qty numeric;
ALTER TABLE public.fert_applications ADD COLUMN IF NOT EXISTS gps_lat double precision;
ALTER TABLE public.fert_applications ADD COLUMN IF NOT EXISTS gps_lng double precision;
ALTER TABLE public.fert_applications ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.fert_applications ADD COLUMN IF NOT EXISTS notes text;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. fert_dispatches — manager dispatches work to the field
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fert_dispatches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisations(id),
  farm_id          uuid NOT NULL REFERENCES farms(id),
  timing_id        uuid NOT NULL REFERENCES fert_timings(id),
  product_id       uuid NOT NULL REFERENCES fert_products(id),
  dispatched_by    uuid REFERENCES user_profiles(id),
  dispatched_at    timestamptz DEFAULT now(),
  status           text NOT NULL DEFAULT 'active',
  notes            text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fert_dispatches_farm ON fert_dispatches (farm_id);
CREATE INDEX IF NOT EXISTS idx_fert_dispatches_status ON fert_dispatches (status);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. fert_dispatch_sections — which sections are targeted per dispatch
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fert_dispatch_sections (
  dispatch_id  uuid NOT NULL REFERENCES fert_dispatches(id) ON DELETE CASCADE,
  section_id   uuid NOT NULL REFERENCES sections(id),
  PRIMARY KEY (dispatch_id, section_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. fert_section_assignments — assign applicators to sections
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fert_section_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES user_profiles(id),
  section_id      uuid NOT NULL REFERENCES sections(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  assigned_from   date NOT NULL DEFAULT CURRENT_DATE,
  assigned_until  date,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fert_section_assign_user ON fert_section_assignments (user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. industry_benchmarks — national / regional T/Ha targets
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.industry_benchmarks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id   uuid NOT NULL REFERENCES commodities(id),
  region         text,
  variety_group  text,
  age_class      text,
  target_t_ha    numeric NOT NULL,
  min_t_ha       numeric,
  max_t_ha       numeric,
  source         text,
  created_at     timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. org_production_targets — org-level overrides
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.org_production_targets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  commodity_id    uuid NOT NULL REFERENCES commodities(id),
  variety_group   text,
  target_t_ha     numeric NOT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_prod_targets_unique
  ON org_production_targets (organisation_id, commodity_id, COALESCE(variety_group, ''));

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Seed industry benchmarks (HORTGRO SA deciduous fruit stats)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.industry_benchmarks (commodity_id, variety_group, target_t_ha, source) VALUES
  ('568df904-f53b-4171-9d84-033f58d07023', 'Golden Delicious', 65, 'HORTGRO 2024'),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Granny Smith',     60, 'HORTGRO 2024'),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Cripps Pink',      55, 'HORTGRO 2024'),
  ('568df904-f53b-4171-9d84-033f58d07023', 'Fuji',             50, 'HORTGRO 2024'),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Packham''s',       50, 'HORTGRO 2024'),
  ('f0415f88-b593-4972-a1b4-2abd9d5c87cb', 'Forelle',          40, 'HORTGRO 2024'),
  ('da106a75-6fbb-4720-b498-be73f1a6d120', NULL,               30, 'HORTGRO 2024'),
  ('b94a3ed1-935e-41f3-b8f2-889aeaffdd0b', NULL,               35, 'HORTGRO 2024')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RPC: get_fert_dispatched_lines — for PWA applicators
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_fert_dispatched_lines(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_fert_dispatched_lines(
  p_user_id uuid,
  p_farm_id uuid
)
RETURNS TABLE (
  line_id          uuid,
  dispatch_id      uuid,
  timing_id        uuid,
  timing_label     text,
  timing_sort      integer,
  product_id       uuid,
  product_name     text,
  product_unit     text,
  orchard_id       uuid,
  orchard_name     text,
  orchard_nr       integer,
  variety          text,
  section_name     text,
  ha               numeric,
  rate_per_ha      numeric,
  total_qty        numeric,
  confirmed        boolean,
  date_applied     date,
  actual_rate_per_ha numeric,
  actual_total_qty   numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    frl.id AS line_id,
    fd.id AS dispatch_id,
    ft.id AS timing_id,
    ft.label AS timing_label,
    ft.sort_order AS timing_sort,
    fp.id AS product_id,
    fp.name AS product_name,
    fp.default_unit AS product_unit,
    frl.orchard_id,
    o.name AS orchard_name,
    o.orchard_nr,
    o.variety,
    s.name AS section_name,
    frl.ha,
    frl.rate_per_ha,
    COALESCE(frl.total_qty, frl.rate_per_ha * COALESCE(frl.ha, 0)) AS total_qty,
    COALESCE(fa.confirmed, false) AS confirmed,
    fa.date_applied,
    fa.actual_rate_per_ha,
    fa.actual_total_qty
  FROM fert_dispatches fd
  JOIN fert_dispatch_sections fds ON fds.dispatch_id = fd.id
  JOIN fert_section_assignments fsa ON fsa.section_id = fds.section_id
    AND fsa.user_id = p_user_id
    AND fsa.assigned_from <= CURRENT_DATE
    AND (fsa.assigned_until IS NULL OR fsa.assigned_until >= CURRENT_DATE)
  JOIN fert_recommendation_lines frl
    ON frl.timing_id = fd.timing_id
    AND frl.product_id = fd.product_id
  JOIN orchards o ON o.id = frl.orchard_id
  LEFT JOIN orchard_sections os ON os.orchard_id = o.id
  LEFT JOIN sections s ON s.id = os.section_id AND s.id = fds.section_id
  JOIN fert_timings ft ON ft.id = frl.timing_id
  JOIN fert_products fp ON fp.id = frl.product_id
  LEFT JOIN fert_applications fa ON fa.line_id = frl.id
  WHERE fd.farm_id = p_farm_id
    AND fd.status = 'active'
    AND frl.orchard_id IS NOT NULL
    -- Filter to orchards in dispatched sections
    AND os.section_id = fds.section_id
  ORDER BY ft.sort_order, o.name;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. RPC: get_production_benchmarks — orchard vs industry/org targets
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_production_benchmarks(uuid[], text, uuid);
CREATE OR REPLACE FUNCTION public.get_production_benchmarks(
  p_farm_ids uuid[],
  p_season text DEFAULT NULL,
  p_commodity_id uuid DEFAULT NULL
)
RETURNS TABLE (
  orchard_id       uuid,
  orchard_name     text,
  orchard_nr       integer,
  variety          text,
  variety_group    text,
  commodity_id     uuid,
  commodity_name   text,
  ha               numeric,
  ton_ha           numeric,
  industry_target  numeric,
  org_target       numeric,
  vs_industry_pct  numeric,
  vs_org_pct       numeric,
  meets_industry   boolean,
  meets_org        boolean
)
LANGUAGE sql STABLE
AS $$
  WITH prod AS (
    SELECT
      o.id AS orchard_id,
      o.name AS orchard_name,
      o.orchard_nr,
      o.variety,
      o.variety_group,
      o.commodity_id,
      c.name AS commodity_name,
      o.ha,
      ps.ton_ha
    FROM orchards o
    JOIN commodities c ON c.id = o.commodity_id
    LEFT JOIN LATERAL (
      SELECT
        CASE WHEN o.ha > 0
          THEN ROUND(
            SUM(pb.total) * COALESCE(
              (SELECT AVG(br.bin_weight_kg) FROM production_bruising br WHERE br.orchard_id = o.id AND br.farm_id = o.farm_id AND br.season = p_season AND br.bin_weight_kg > 0),
              (SELECT pw.default_weight_kg FROM production_bin_weights pw JOIN farms f2 ON f2.id = o.farm_id WHERE pw.organisation_id = f2.organisation_id AND pw.commodity_id = o.commodity_id AND pw.variety = o.variety LIMIT 1),
              (SELECT pw.default_weight_kg FROM production_bin_weights pw JOIN farms f2 ON f2.id = o.farm_id WHERE pw.organisation_id = f2.organisation_id AND pw.commodity_id = o.commodity_id AND pw.variety IS NULL LIMIT 1),
              400
            ) / 1000.0 / o.ha, 2
          )
        END AS ton_ha
      FROM production_bins pb
      WHERE pb.orchard_id = o.id
        AND pb.farm_id = o.farm_id
        AND (p_season IS NULL OR pb.season = p_season)
    ) ps ON true
    WHERE o.farm_id = ANY(p_farm_ids)
      AND o.is_active = true
      AND (p_commodity_id IS NULL OR o.commodity_id = p_commodity_id)
  ),
  benchmarks AS (
    SELECT DISTINCT ON (p.orchard_id)
      p.orchard_id,
      ib.target_t_ha AS industry_target
    FROM prod p
    LEFT JOIN industry_benchmarks ib ON ib.commodity_id = p.commodity_id
      AND (ib.variety_group IS NULL OR ib.variety_group = p.variety_group)
    ORDER BY p.orchard_id,
      CASE WHEN ib.variety_group = p.variety_group THEN 0 ELSE 1 END,
      CASE WHEN ib.region IS NOT NULL THEN 0 ELSE 1 END
  ),
  org_targets AS (
    SELECT DISTINCT ON (p.orchard_id)
      p.orchard_id,
      opt.target_t_ha AS org_target
    FROM prod p
    JOIN farms f ON f.id = ANY(p_farm_ids) AND f.id = (SELECT farm_id FROM orchards WHERE id = p.orchard_id)
    LEFT JOIN org_production_targets opt
      ON opt.organisation_id = f.organisation_id
      AND opt.commodity_id = p.commodity_id
      AND (opt.variety_group IS NULL OR opt.variety_group = p.variety_group)
    ORDER BY p.orchard_id,
      CASE WHEN opt.variety_group = p.variety_group THEN 0 ELSE 1 END
  )
  SELECT
    p.orchard_id,
    p.orchard_name,
    p.orchard_nr,
    p.variety,
    p.variety_group,
    p.commodity_id,
    p.commodity_name,
    p.ha,
    p.ton_ha,
    b.industry_target,
    ot.org_target,
    CASE WHEN b.industry_target > 0 AND p.ton_ha IS NOT NULL
      THEN ROUND(p.ton_ha / b.industry_target * 100, 1)
    END AS vs_industry_pct,
    CASE WHEN ot.org_target > 0 AND p.ton_ha IS NOT NULL
      THEN ROUND(p.ton_ha / ot.org_target * 100, 1)
    END AS vs_org_pct,
    CASE WHEN b.industry_target > 0 AND p.ton_ha IS NOT NULL
      THEN p.ton_ha >= b.industry_target
    END AS meets_industry,
    CASE WHEN ot.org_target > 0 AND p.ton_ha IS NOT NULL
      THEN p.ton_ha >= ot.org_target
    END AS meets_org
  FROM prod p
  LEFT JOIN benchmarks b ON b.orchard_id = p.orchard_id
  LEFT JOIN org_targets ot ON ot.orchard_id = p.orchard_id
  ORDER BY p.orchard_name;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. RLS policies
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE fert_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fert_dispatch_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE fert_section_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_production_targets ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read dispatches, assignments, benchmarks
CREATE POLICY "Authenticated read fert_dispatches" ON fert_dispatches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read fert_dispatch_sections" ON fert_dispatch_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read fert_section_assignments" ON fert_section_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read industry_benchmarks" ON industry_benchmarks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read org_production_targets" ON org_production_targets FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert/update fert_applications (PWA field capture)
CREATE POLICY "Authenticated insert fert_applications" ON fert_applications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update fert_applications" ON fert_applications FOR UPDATE TO authenticated USING (true);

-- Fert photos storage bucket (run separately in Supabase Dashboard > Storage):
-- CREATE BUCKET: fert-photos (public read, authenticated write)

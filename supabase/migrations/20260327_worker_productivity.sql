-- FCS Worker Productivity: orchard mapping + daily productivity tracking
-- All farm activities (picking, sorting, irrigation, etc.) synced from FCS VW_X_PW

-- 1. FCS Orchard Number → FarmScout Orchard mapping
-- FCS ORCHARDNUMBER does not match orchards.legacy_id on any farm.
CREATE TABLE IF NOT EXISTS public.fcs_orchard_map (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id),
  fcs_orchard_nr    integer NOT NULL,
  fcs_orchard_name  text,
  orchard_id        uuid NOT NULL REFERENCES orchards(id),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (organisation_id, fcs_orchard_nr)
);

ALTER TABLE fcs_orchard_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcs_orchard_map_select" ON fcs_orchard_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "fcs_orchard_map_insert" ON fcs_orchard_map FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fcs_orchard_map_update" ON fcs_orchard_map FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fcs_orchard_map_delete" ON fcs_orchard_map FOR DELETE TO authenticated USING (true);

-- 2. Worker Daily Productivity (ALL activities from FCS)
CREATE TABLE IF NOT EXISTS public.worker_daily_productivity (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id),
  farm_id           uuid NOT NULL REFERENCES farms(id),
  employee_id       uuid NOT NULL REFERENCES qc_employees(id),
  work_date         date NOT NULL,
  orchard_id        uuid REFERENCES orchards(id),
  fcs_orchard_nr    integer,
  fcs_orchard_name  text,
  activity_name     text NOT NULL,
  supervisor        text,
  units             numeric(10,4) NOT NULL DEFAULT 0,
  hours             numeric(6,2),
  minutes           bigint,
  units_per_hour    numeric(8,2),
  units_per_man_day numeric(8,2),
  -- Picking-specific correction (NULL for non-picking activities)
  correction_factor numeric(6,4),
  corrected_bags    numeric(8,2),
  corrected_bins    numeric(8,4),
  -- Review workflow
  status            text NOT NULL DEFAULT 'pending',  -- 'pending' | 'excluded' | 'approved'
  exclude_reason    text,
  synced_at         timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (farm_id, employee_id, work_date, fcs_orchard_nr, activity_name)
);

CREATE INDEX IF NOT EXISTS idx_wdp_farm_date ON worker_daily_productivity (farm_id, work_date);
CREATE INDEX IF NOT EXISTS idx_wdp_employee_date ON worker_daily_productivity (employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_wdp_activity_date ON worker_daily_productivity (activity_name, work_date);
CREATE INDEX IF NOT EXISTS idx_wdp_status ON worker_daily_productivity (status, work_date);

ALTER TABLE worker_daily_productivity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wdp_select" ON worker_daily_productivity FOR SELECT TO authenticated USING (true);
CREATE POLICY "wdp_update" ON worker_daily_productivity FOR UPDATE TO authenticated USING (true);

-- 3. Add bags_per_bin to commodities for correction factor
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS bags_per_bin integer;
-- Seed known values
UPDATE commodities SET bags_per_bin = 53 WHERE code IN ('AP', 'PR') AND bags_per_bin IS NULL;

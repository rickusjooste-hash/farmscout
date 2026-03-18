-- Add receiver role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'receiver';

-- RLS policies for PWA insert/update on production tables
CREATE POLICY "production_bins_insert" ON production_bins
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "production_bins_update" ON production_bins
  FOR UPDATE TO authenticated USING (xlsx_id LIKE 'pwa-%');

CREATE POLICY "production_bruising_insert" ON production_bruising
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "production_bruising_update" ON production_bruising
  FOR UPDATE TO authenticated USING (xlsx_id LIKE 'pwa-%');

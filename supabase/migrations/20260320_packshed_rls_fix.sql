-- Fix RLS policies on packshed tables to match project convention:
-- SELECT open to all authenticated users, writes via service_role

-- ── packhouses ───────────────────────────────────────────────
DROP POLICY IF EXISTS "org_read_packhouses" ON packhouses;
DROP POLICY IF EXISTS "org_write_packhouses" ON packhouses;
CREATE POLICY "packhouses_select" ON packhouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "packhouses_all" ON packhouses FOR ALL TO service_role USING (true);
CREATE POLICY "packhouses_insert" ON packhouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "packhouses_update" ON packhouses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "packhouses_delete" ON packhouses FOR DELETE TO authenticated USING (true);

-- ── packout_box_types ────────────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_box_types" ON packout_box_types;
DROP POLICY IF EXISTS "org_write_packout_box_types" ON packout_box_types;
CREATE POLICY "packout_box_types_select" ON packout_box_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_box_types_all" ON packout_box_types FOR ALL TO service_role USING (true);
CREATE POLICY "packout_box_types_update" ON packout_box_types FOR UPDATE TO authenticated USING (true);

-- ── packout_sizes ────────────────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_sizes" ON packout_sizes;
DROP POLICY IF EXISTS "org_write_packout_sizes" ON packout_sizes;
CREATE POLICY "packout_sizes_select" ON packout_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_sizes_all" ON packout_sizes FOR ALL TO service_role USING (true);
CREATE POLICY "packout_sizes_update" ON packout_sizes FOR UPDATE TO authenticated USING (true);

-- ── packout_box_type_sizes ───────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_box_type_sizes" ON packout_box_type_sizes;
DROP POLICY IF EXISTS "org_write_packout_box_type_sizes" ON packout_box_type_sizes;
CREATE POLICY "packout_box_type_sizes_select" ON packout_box_type_sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_box_type_sizes_all" ON packout_box_type_sizes FOR ALL TO service_role USING (true);

-- ── packout_bin_weights ──────────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_bin_weights" ON packout_bin_weights;
DROP POLICY IF EXISTS "org_insert_packout_bin_weights" ON packout_bin_weights;
CREATE POLICY "packout_bin_weights_select" ON packout_bin_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_bin_weights_insert" ON packout_bin_weights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "packout_bin_weights_all" ON packout_bin_weights FOR ALL TO service_role USING (true);

-- ── packout_juice_samples ────────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_juice_samples" ON packout_juice_samples;
DROP POLICY IF EXISTS "org_insert_packout_juice_samples" ON packout_juice_samples;
CREATE POLICY "packout_juice_samples_select" ON packout_juice_samples FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_juice_samples_insert" ON packout_juice_samples FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "packout_juice_samples_all" ON packout_juice_samples FOR ALL TO service_role USING (true);

-- ── packout_juice_defects ────────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_juice_defects" ON packout_juice_defects;
DROP POLICY IF EXISTS "org_insert_packout_juice_defects" ON packout_juice_defects;
CREATE POLICY "packout_juice_defects_select" ON packout_juice_defects FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_juice_defects_insert" ON packout_juice_defects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "packout_juice_defects_all" ON packout_juice_defects FOR ALL TO service_role USING (true);

-- ── packout_pallets ──────────────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_pallets" ON packout_pallets;
CREATE POLICY "packout_pallets_select" ON packout_pallets FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_pallets_all" ON packout_pallets FOR ALL TO service_role USING (true);

-- ── packout_floor_stock ──────────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_floor_stock" ON packout_floor_stock;
DROP POLICY IF EXISTS "org_write_packout_floor_stock" ON packout_floor_stock;
CREATE POLICY "packout_floor_stock_select" ON packout_floor_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_floor_stock_insert" ON packout_floor_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "packout_floor_stock_update" ON packout_floor_stock FOR UPDATE TO authenticated USING (true);
CREATE POLICY "packout_floor_stock_delete" ON packout_floor_stock FOR DELETE TO authenticated USING (true);
CREATE POLICY "packout_floor_stock_all" ON packout_floor_stock FOR ALL TO service_role USING (true);

-- ── packout_daily_sessions ───────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_daily_sessions" ON packout_daily_sessions;
DROP POLICY IF EXISTS "org_write_packout_daily_sessions" ON packout_daily_sessions;
CREATE POLICY "packout_daily_sessions_select" ON packout_daily_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_daily_sessions_insert" ON packout_daily_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "packout_daily_sessions_update" ON packout_daily_sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "packout_daily_sessions_all" ON packout_daily_sessions FOR ALL TO service_role USING (true);

-- ── packout_orchard_finals ───────────────────────────────────
DROP POLICY IF EXISTS "org_read_packout_orchard_finals" ON packout_orchard_finals;
DROP POLICY IF EXISTS "org_write_packout_orchard_finals" ON packout_orchard_finals;
CREATE POLICY "packout_orchard_finals_select" ON packout_orchard_finals FOR SELECT TO authenticated USING (true);
CREATE POLICY "packout_orchard_finals_all" ON packout_orchard_finals FOR ALL TO service_role USING (true);

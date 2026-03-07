-- ============================================================
-- Diagnostic: QC worker orchardqc1@skfarm.co.za cannot see
-- bags from runner@mvfarm.co.za on Stawelklip farm.
--
-- user_farm_access confirmed OK — run these to find root cause.
-- ============================================================

-- 1. Check RLS policies on qc_bag_sessions
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'qc_bag_sessions';

-- 2. Check if RLS is enabled on qc_bag_sessions
-- SELECT relname, relrowsecurity, relforcerowsecurity
-- FROM pg_class
-- WHERE relname = 'qc_bag_sessions';

-- 3. Check today's bags on Stawelklip (as superuser, bypasses RLS)
-- SELECT bs.id, bs.farm_id, bs.status, bs.collected_at,
--        bs.runner_id, bs.employee_id, bs.orchard_id
-- FROM qc_bag_sessions bs
-- WHERE bs.collected_at::date = CURRENT_DATE
-- ORDER BY bs.collected_at DESC
-- LIMIT 20;

-- 4. Check what the QC worker's user_id is
-- SELECT au.id, au.email FROM auth.users au
-- WHERE au.email = 'orchardqc1@skfarm.co.za';

-- 5. Check the runner's user_id
-- SELECT au.id, au.email FROM auth.users au
-- WHERE au.email = 'runner@mvfarm.co.za';

-- 6. Verify farm_id on today's bags vs QC worker's farm access
-- SELECT bs.farm_id, f.code, f.full_name,
--        EXISTS (
--          SELECT 1 FROM user_farm_access ufa
--          WHERE ufa.user_id = (SELECT id FROM auth.users WHERE email = 'orchardqc1@skfarm.co.za')
--            AND ufa.farm_id = bs.farm_id
--        ) AS qc_has_access
-- FROM qc_bag_sessions bs
-- JOIN farms f ON f.id = bs.farm_id
-- WHERE bs.collected_at::date = CURRENT_DATE
-- GROUP BY bs.farm_id, f.code, f.full_name;

-- ============================================================
-- LIKELY FIX: RLS SELECT policy on qc_bag_sessions
--
-- If current policy only allows runner_id = auth.uid(),
-- the QC worker can't see bags. Replace with org-based policy
-- that allows any user in the same org to read bags.
-- ============================================================

-- Drop existing restrictive SELECT policy (adjust name if different)
-- Run diagnostic #1 above first to get the exact policy name(s).

-- DROP POLICY IF EXISTS "Users can read own org bag sessions" ON qc_bag_sessions;
-- DROP POLICY IF EXISTS "select_own" ON qc_bag_sessions;
-- DROP POLICY IF EXISTS "Enable read access for all users" ON qc_bag_sessions;

-- Create org-scoped SELECT policy: user can read bags from farms they have access to
-- CREATE POLICY "Users can read bag sessions for their farms"
--   ON qc_bag_sessions FOR SELECT
--   USING (
--     farm_id IN (
--       SELECT ufa.farm_id
--       FROM user_farm_access ufa
--       WHERE ufa.user_id = auth.uid()
--     )
--   );

-- If INSERT policy is also too restrictive, ensure any authenticated user
-- in the org can insert (runner creates bags, QC updates status):
-- CREATE POLICY "Users can insert bag sessions for their farms"
--   ON qc_bag_sessions FOR INSERT
--   WITH CHECK (
--     farm_id IN (
--       SELECT ufa.farm_id
--       FROM user_farm_access ufa
--       WHERE ufa.user_id = auth.uid()
--     )
--   );

-- CREATE POLICY "Users can update bag sessions for their farms"
--   ON qc_bag_sessions FOR UPDATE
--   USING (
--     farm_id IN (
--       SELECT ufa.farm_id
--       FROM user_farm_access ufa
--       WHERE ufa.user_id = auth.uid()
--     )
--   );

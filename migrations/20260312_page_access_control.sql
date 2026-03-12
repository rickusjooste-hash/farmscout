-- Add allowed_pages column to organisation_users for page-level access control.
-- NULL = use role defaults (all existing users unaffected).
-- A JSON array like '["dashboard","orchards","pests"]' = explicit section restriction.

ALTER TABLE public.organisation_users
ADD COLUMN IF NOT EXISTS allowed_pages jsonb DEFAULT NULL;

COMMENT ON COLUMN public.organisation_users.allowed_pages IS
  'Nullable JSONB array of page section keys. NULL = use role defaults. Empty array or specific keys = explicit restriction.';

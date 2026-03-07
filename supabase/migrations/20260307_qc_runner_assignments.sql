-- QC Runner ↔ QC Worker assignments (many-to-many)
-- Allows managers to link specific runners to specific QC workers
-- so each QC worker only sees bags from their assigned runner(s).

CREATE TABLE IF NOT EXISTS public.qc_runner_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid NOT NULL REFERENCES organisations(id),
  runner_user_id    uuid NOT NULL REFERENCES user_profiles(id),
  qc_worker_user_id uuid NOT NULL REFERENCES user_profiles(id),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (runner_user_id, qc_worker_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qc_runner_assignments_org
  ON public.qc_runner_assignments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_qc_runner_assignments_qc_worker
  ON public.qc_runner_assignments(qc_worker_user_id);
CREATE INDEX IF NOT EXISTS idx_qc_runner_assignments_runner
  ON public.qc_runner_assignments(runner_user_id);

-- RLS
ALTER TABLE public.qc_runner_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read assignments in their org"
  ON public.qc_runner_assignments FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- RPC: get assigned runner IDs for a QC worker
CREATE OR REPLACE FUNCTION public.get_assigned_runner_ids(p_qc_worker_id uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(array_agg(runner_user_id), '{}')
  FROM qc_runner_assignments
  WHERE qc_worker_user_id = p_qc_worker_id;
$$;

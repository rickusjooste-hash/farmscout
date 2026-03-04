-- Bag-level issue counts — replaces per-fruit qc_fruit_issues for the QC weighing workflow.
-- Run in Supabase SQL Editor.

CREATE TABLE public.qc_bag_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES qc_bag_sessions(id),
  pest_id         uuid NOT NULL REFERENCES pests(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  count           integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_qc_bag_issues_session ON public.qc_bag_issues(session_id);

ALTER TABLE public.qc_bag_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qc_bag_issues_select" ON public.qc_bag_issues
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "qc_bag_issues_insert" ON public.qc_bag_issues
  FOR INSERT TO authenticated WITH CHECK (true);

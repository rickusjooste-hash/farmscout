-- ============================================================
-- Phenological stages per commodity/variety_group/month
-- Used to show growth stage timeline on irrigation charts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.phenological_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_code text NOT NULL,
  variety_group text NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  stage text NOT NULL CHECK (stage IN ('D','BB','BL','CD','FF','H','PH','LF')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (commodity_code, variety_group, month)
);

-- RLS: read for authenticated, write for managers/admins
ALTER TABLE public.phenological_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read phenological_stages"
  ON public.phenological_stages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage phenological_stages"
  ON public.phenological_stages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RPC to fetch stages for the chart (returns flat rows)
CREATE OR REPLACE FUNCTION public.get_phenological_stages(p_commodity_code text, p_variety_group text)
RETURNS TABLE (month integer, stage text)
LANGUAGE sql STABLE AS $$
  SELECT ps.month, ps.stage
  FROM phenological_stages ps
  WHERE ps.commodity_code = p_commodity_code
    AND ps.variety_group = p_variety_group
  ORDER BY ps.month;
$$;

-- RPC to fetch all stages for the edit page
CREATE OR REPLACE FUNCTION public.get_all_phenological_stages()
RETURNS TABLE (id uuid, commodity_code text, variety_group text, month integer, stage text)
LANGUAGE sql STABLE AS $$
  SELECT ps.id, ps.commodity_code, ps.variety_group, ps.month, ps.stage
  FROM phenological_stages ps
  ORDER BY ps.commodity_code, ps.variety_group, ps.month;
$$;

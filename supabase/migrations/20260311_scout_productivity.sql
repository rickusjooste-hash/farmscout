-- Scout Productivity Dashboard: settings table, indexes, RPCs
-- Run manually in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Settings table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.scout_productivity_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       uuid NOT NULL REFERENCES organisations(id),
  farm_id               uuid REFERENCES farms(id),  -- NULL = org-wide default
  min_break_gap_minutes integer NOT NULL DEFAULT 30,
  min_seconds_per_trap  integer NOT NULL DEFAULT 30,
  min_seconds_per_tree  integer NOT NULL DEFAULT 20,
  timing_cv_threshold   numeric NOT NULL DEFAULT 0.15,
  max_zero_count_pct    numeric NOT NULL DEFAULT 0.90,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(organisation_id, farm_id)
);

ALTER TABLE public.scout_productivity_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sps_service_all" ON scout_productivity_settings
  FOR ALL TO service_role USING (true);

CREATE POLICY "sps_auth_read" ON scout_productivity_settings
  FOR SELECT TO authenticated USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Per-scout lunch window columns
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.scouts ADD COLUMN lunch_start time DEFAULT '12:00';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.scouts ADD COLUMN lunch_end time DEFAULT '13:00';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Performance indexes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_trap_inspections_scout_time
  ON trap_inspections(scout_id, inspected_at);

CREATE INDEX IF NOT EXISTS idx_inspection_trees_session_nr
  ON inspection_trees(session_id, tree_nr);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC: get_scout_daily_productivity
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_scout_daily_productivity(
  p_farm_ids uuid[],
  p_from     date,
  p_to       date,
  p_scout_id uuid DEFAULT NULL
)
RETURNS TABLE(
  scout_id            uuid,
  scout_name          text,
  day                 date,
  first_inspection    timestamptz,
  last_inspection     timestamptz,
  active_minutes      integer,
  longest_gap_minutes integer,
  break_count         integer,
  lunch_detected      boolean,
  traps_inspected     integer,
  route_size          integer,
  trap_completion_pct numeric,
  avg_seconds_per_trap numeric,
  trees_inspected     integer,
  zones_completed     integer,
  avg_seconds_per_tree numeric,
  distance_walked_m   numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH RECURSIVE

  -- Config: break gap threshold
  cfg AS (
    SELECT COALESCE(
      (SELECT s.min_break_gap_minutes
       FROM scout_productivity_settings s
       JOIN farms f ON f.organisation_id = s.organisation_id
       WHERE f.id = ANY(p_farm_ids)
         AND (s.farm_id = ANY(p_farm_ids) OR s.farm_id IS NULL)
       ORDER BY s.farm_id NULLS LAST
       LIMIT 1),
      30
    ) AS break_gap_min
  ),

  -- Scout lunch windows
  lunch AS (
    SELECT sc.user_id AS scout_id, sc.lunch_start, sc.lunch_end
    FROM scouts sc
    WHERE sc.farm_id = ANY(p_farm_ids) AND sc.is_active = true
  ),

  -- Route sizes via linked-list walk
  route_head AS (
    SELECT sc.user_id AS scout_id, sc.first_trap_id AS trap_id, 1 AS depth
    FROM scouts sc
    WHERE sc.farm_id = ANY(p_farm_ids)
      AND sc.is_active = true
      AND sc.first_trap_id IS NOT NULL
      AND (p_scout_id IS NULL OR sc.user_id = p_scout_id)
  ),
  route_walk AS (
    SELECT scout_id, trap_id, depth FROM route_head
    UNION ALL
    SELECT rw.scout_id, t.next_trap_id, rw.depth + 1
    FROM route_walk rw
    JOIN traps t ON t.id = rw.trap_id
    WHERE t.next_trap_id IS NOT NULL AND rw.depth < 500
  ),
  route_sizes AS (
    SELECT scout_id, COUNT(*)::integer AS route_size
    FROM route_walk
    GROUP BY scout_id
  ),

  -- All inspection events (traps + trees)
  all_events AS (
    SELECT
      ti.scout_id,
      ti.inspected_at,
      ti.location,
      'trap'::text AS event_type,
      ti.rebaited,
      NULL::uuid AS zone_id
    FROM trap_inspections ti
    JOIN traps t ON t.id = ti.trap_id
    WHERE ti.inspected_at >= p_from::timestamptz
      AND ti.inspected_at < (p_to + 1)::timestamptz
      AND ti.scout_id IS NOT NULL
      AND t.farm_id = ANY(p_farm_ids)
      AND (p_scout_id IS NULL OR ti.scout_id = p_scout_id)

    UNION ALL

    SELECT
      s.scout_id,
      COALESCE(it.inspected_at, s.inspected_at),
      it.location,
      'tree'::text,
      false,
      s.zone_id
    FROM inspection_trees it
    JOIN inspection_sessions s ON s.id = it.session_id
    WHERE COALESCE(it.inspected_at, s.inspected_at) >= p_from::timestamptz
      AND COALESCE(it.inspected_at, s.inspected_at) < (p_to + 1)::timestamptz
      AND s.farm_id = ANY(p_farm_ids)
      AND (p_scout_id IS NULL OR s.scout_id = p_scout_id)
  ),

  -- Order events, compute gaps + distance
  ordered AS (
    SELECT
      e.scout_id,
      (e.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
      e.inspected_at,
      e.location,
      e.event_type,
      e.rebaited,
      e.zone_id,
      LAG(e.inspected_at) OVER w AS prev_at,
      LAG(e.location) OVER w AS prev_loc
    FROM all_events e
    WINDOW w AS (
      PARTITION BY e.scout_id, (e.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date
      ORDER BY e.inspected_at
    )
  ),

  with_gaps AS (
    SELECT o.*,
      EXTRACT(EPOCH FROM (o.inspected_at - o.prev_at)) AS gap_s,
      CASE
        WHEN o.location IS NOT NULL AND o.prev_loc IS NOT NULL
        THEN ST_DistanceSphere(o.location::geometry, o.prev_loc::geometry)
        ELSE 0
      END AS dist_m,
      CASE
        WHEN EXTRACT(EPOCH FROM (o.inspected_at - o.prev_at))
             > (SELECT break_gap_min FROM cfg) * 60
        THEN true ELSE false
      END AS is_break
    FROM ordered o
  ),

  -- Zones completed per scout/day
  zones_done AS (
    SELECT scout_id, day, COUNT(DISTINCT zone_id)::integer AS zones
    FROM with_gaps
    WHERE event_type = 'tree' AND zone_id IS NOT NULL
    GROUP BY scout_id, day
  ),

  -- Daily aggregation
  daily AS (
    SELECT
      g.scout_id,
      g.day,
      MIN(g.inspected_at)  AS first_inspection,
      MAX(g.inspected_at)  AS last_inspection,

      GREATEST(0,
        EXTRACT(EPOCH FROM MAX(g.inspected_at) - MIN(g.inspected_at))::integer / 60
        - COALESCE(SUM(CASE WHEN g.is_break THEN g.gap_s ELSE 0 END)::integer / 60, 0)
      ) AS active_minutes,

      COALESCE(MAX(g.gap_s)::integer / 60, 0) AS longest_gap_minutes,
      COUNT(*) FILTER (WHERE g.is_break)::integer AS break_count,

      bool_or(
        g.is_break AND EXISTS (
          SELECT 1 FROM lunch l
          WHERE l.scout_id = g.scout_id
            AND (g.prev_at AT TIME ZONE 'Africa/Johannesburg')::time < l.lunch_end
            AND (g.inspected_at AT TIME ZONE 'Africa/Johannesburg')::time > l.lunch_start
        )
      ) AS lunch_detected,

      COUNT(*) FILTER (WHERE g.event_type = 'trap')::integer AS traps_inspected,

      ROUND((AVG(g.gap_s) FILTER (
        WHERE g.event_type = 'trap' AND NOT g.is_break
          AND g.gap_s IS NOT NULL AND NOT g.rebaited
      ))::numeric, 1) AS avg_seconds_per_trap,

      COUNT(*) FILTER (WHERE g.event_type = 'tree')::integer AS trees_inspected,

      ROUND((AVG(g.gap_s) FILTER (
        WHERE g.event_type = 'tree' AND NOT g.is_break AND g.gap_s IS NOT NULL
      ))::numeric, 1) AS avg_seconds_per_tree,

      ROUND((SUM(
        CASE WHEN NOT g.is_break AND g.dist_m > 5 THEN g.dist_m ELSE 0 END
      ))::numeric, 0) AS distance_walked_m

    FROM with_gaps g
    GROUP BY g.scout_id, g.day
  )

  SELECT
    d.scout_id,
    COALESCE(up.full_name, 'Unknown') AS scout_name,
    d.day,
    d.first_inspection,
    d.last_inspection,
    d.active_minutes,
    d.longest_gap_minutes,
    d.break_count,
    COALESCE(d.lunch_detected, false) AS lunch_detected,
    d.traps_inspected,
    COALESCE(rs.route_size, 0) AS route_size,
    CASE WHEN COALESCE(rs.route_size, 0) > 0
      THEN ROUND(d.traps_inspected::numeric / rs.route_size * 100, 1)
      ELSE 0
    END AS trap_completion_pct,
    COALESCE(d.avg_seconds_per_trap, 0) AS avg_seconds_per_trap,
    d.trees_inspected,
    COALESCE(zd.zones, 0) AS zones_completed,
    COALESCE(d.avg_seconds_per_tree, 0) AS avg_seconds_per_tree,
    COALESCE(d.distance_walked_m, 0) AS distance_walked_m
  FROM daily d
  LEFT JOIN user_profiles up ON up.id = d.scout_id
  LEFT JOIN route_sizes rs ON rs.scout_id = d.scout_id
  LEFT JOIN zones_done zd ON zd.scout_id = d.scout_id AND zd.day = d.day
  ORDER BY d.day DESC, (d.traps_inspected + d.trees_inspected) DESC;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC: get_scout_quality_flags
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_scout_quality_flags(
  p_farm_ids uuid[],
  p_from     date,
  p_to       date
)
RETURNS TABLE(
  scout_id       uuid,
  scout_name     text,
  day            date,
  flag_type      text,
  flag_detail    text,
  severity       text,
  evidence_count integer
)
AS $$
DECLARE
  v_break_min   integer;
  v_min_trap_s  integer;
  v_min_tree_s  integer;
  v_cv_thresh   numeric;
BEGIN
  -- Load config
  SELECT COALESCE(s.min_break_gap_minutes, 30),
         COALESCE(s.min_seconds_per_trap, 30),
         COALESCE(s.min_seconds_per_tree, 20),
         COALESCE(s.timing_cv_threshold, 0.15)
  INTO v_break_min, v_min_trap_s, v_min_tree_s, v_cv_thresh
  FROM scout_productivity_settings s
  JOIN farms f ON f.organisation_id = s.organisation_id
  WHERE f.id = ANY(p_farm_ids)
    AND (s.farm_id = ANY(p_farm_ids) OR s.farm_id IS NULL)
  ORDER BY s.farm_id NULLS LAST
  LIMIT 1;

  v_break_min  := COALESCE(v_break_min, 30);
  v_min_trap_s := COALESCE(v_min_trap_s, 30);
  v_min_tree_s := COALESCE(v_min_tree_s, 20);
  v_cv_thresh  := COALESCE(v_cv_thresh, 0.15);

  -- Flag: rapid_inspections (traps)
  RETURN QUERY
    WITH trap_gaps AS (
      SELECT
        ti.scout_id,
        (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
        EXTRACT(EPOCH FROM (
          ti.inspected_at - LAG(ti.inspected_at) OVER (
            PARTITION BY ti.scout_id,
              (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date
            ORDER BY ti.inspected_at
          )
        )) AS gap_s
      FROM trap_inspections ti
      JOIN traps t ON t.id = ti.trap_id
      WHERE ti.inspected_at >= p_from::timestamptz
        AND ti.inspected_at < (p_to + 1)::timestamptz
        AND ti.scout_id IS NOT NULL
        AND t.farm_id = ANY(p_farm_ids)
    )
    SELECT
      tg.scout_id,
      COALESCE(up.full_name, 'Unknown'),
      tg.day,
      'rapid_inspections'::text,
      COUNT(*) || ' trap inspections under ' || v_min_trap_s || 's',
      'high'::text,
      COUNT(*)::integer
    FROM trap_gaps tg
    LEFT JOIN user_profiles up ON up.id = tg.scout_id
    WHERE tg.gap_s IS NOT NULL AND tg.gap_s > 0 AND tg.gap_s < v_min_trap_s
    GROUP BY tg.scout_id, up.full_name, tg.day
    HAVING COUNT(*) >= 3;

  -- Flag: rapid_inspections (trees)
  RETURN QUERY
    WITH tree_gaps AS (
      SELECT
        s.scout_id,
        (COALESCE(it.inspected_at, s.inspected_at) AT TIME ZONE 'Africa/Johannesburg')::date AS day,
        EXTRACT(EPOCH FROM (
          COALESCE(it.inspected_at, s.inspected_at) - LAG(COALESCE(it.inspected_at, s.inspected_at)) OVER (
            PARTITION BY s.scout_id, s.id ORDER BY it.tree_nr
          )
        )) AS gap_s
      FROM inspection_trees it
      JOIN inspection_sessions s ON s.id = it.session_id
      WHERE COALESCE(it.inspected_at, s.inspected_at) >= p_from::timestamptz
        AND COALESCE(it.inspected_at, s.inspected_at) < (p_to + 1)::timestamptz
        AND s.farm_id = ANY(p_farm_ids)
    )
    SELECT
      tg.scout_id,
      COALESCE(up.full_name, 'Unknown'),
      tg.day,
      'rapid_inspections'::text,
      COUNT(*) || ' tree inspections under ' || v_min_tree_s || 's',
      'high'::text,
      COUNT(*)::integer
    FROM tree_gaps tg
    LEFT JOIN user_profiles up ON up.id = tg.scout_id
    WHERE tg.gap_s IS NOT NULL AND tg.gap_s > 0 AND tg.gap_s < v_min_tree_s
    GROUP BY tg.scout_id, up.full_name, tg.day
    HAVING COUNT(*) >= 3;

  -- Flag: batch_timestamps (≥3 trap inspections within 5 seconds)
  RETURN QUERY
    WITH trap_ts AS (
      SELECT
        ti.scout_id,
        (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
        ti.inspected_at,
        COUNT(*) OVER (
          PARTITION BY ti.scout_id,
            (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date
          ORDER BY ti.inspected_at
          RANGE BETWEEN INTERVAL '5 seconds' PRECEDING AND CURRENT ROW
        ) AS cluster
      FROM trap_inspections ti
      JOIN traps t ON t.id = ti.trap_id
      WHERE ti.inspected_at >= p_from::timestamptz
        AND ti.inspected_at < (p_to + 1)::timestamptz
        AND ti.scout_id IS NOT NULL
        AND t.farm_id = ANY(p_farm_ids)
    )
    SELECT
      ts.scout_id,
      COALESCE(up.full_name, 'Unknown'),
      ts.day,
      'batch_timestamps'::text,
      COUNT(*) || ' inspections clustered within 5s windows',
      'high'::text,
      COUNT(*)::integer
    FROM trap_ts ts
    LEFT JOIN user_profiles up ON up.id = ts.scout_id
    WHERE ts.cluster >= 3
    GROUP BY ts.scout_id, up.full_name, ts.day;

  -- Flag: all_zero_session (all trap counts = 0 on a day with ≥5 inspections)
  RETURN QUERY
    WITH day_counts AS (
      SELECT
        ti.scout_id,
        (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
        COUNT(*)::integer AS n_inspections,
        SUM(tc.count) AS total_count
      FROM trap_inspections ti
      JOIN traps t ON t.id = ti.trap_id
      JOIN trap_counts tc ON tc.inspection_id = ti.id
      WHERE ti.inspected_at >= p_from::timestamptz
        AND ti.inspected_at < (p_to + 1)::timestamptz
        AND ti.scout_id IS NOT NULL
        AND t.farm_id = ANY(p_farm_ids)
      GROUP BY ti.scout_id, (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date
    )
    SELECT
      dc.scout_id,
      COALESCE(up.full_name, 'Unknown'),
      dc.day,
      'all_zero_session'::text,
      dc.n_inspections || ' inspections all with zero counts',
      'medium'::text,
      dc.n_inspections
    FROM day_counts dc
    LEFT JOIN user_profiles up ON up.id = dc.scout_id
    WHERE dc.total_count = 0 AND dc.n_inspections >= 5;

  -- Flag: identical_counts (same observation count on ≥5 consecutive trees)
  RETURN QUERY
    WITH tree_obs AS (
      SELECT
        s.scout_id,
        (COALESCE(it.inspected_at, s.inspected_at) AT TIME ZONE 'Africa/Johannesburg')::date AS day,
        s.id AS session_id,
        it.tree_nr,
        io.count AS obs_count,
        ROW_NUMBER() OVER (PARTITION BY s.id, io.pest_id ORDER BY it.tree_nr) AS rn,
        ROW_NUMBER() OVER (PARTITION BY s.id, io.pest_id, io.count ORDER BY it.tree_nr) AS grp_rn
      FROM inspection_observations io
      JOIN inspection_trees it ON it.id = io.tree_id
      JOIN inspection_sessions s ON s.id = it.session_id
      WHERE COALESCE(it.inspected_at, s.inspected_at) >= p_from::timestamptz
        AND COALESCE(it.inspected_at, s.inspected_at) < (p_to + 1)::timestamptz
        AND s.farm_id = ANY(p_farm_ids)
    ),
    runs AS (
      SELECT scout_id, day, session_id, obs_count,
        COUNT(*) AS run_len
      FROM tree_obs
      GROUP BY scout_id, day, session_id, obs_count, (rn - grp_rn)
      HAVING COUNT(*) >= 5
    )
    SELECT
      r.scout_id,
      COALESCE(up.full_name, 'Unknown'),
      r.day,
      'identical_counts'::text,
      'Count ' || r.obs_count || ' repeated ' || MAX(r.run_len) || ' times consecutively',
      'medium'::text,
      MAX(r.run_len)::integer
    FROM runs r
    LEFT JOIN user_profiles up ON up.id = r.scout_id
    GROUP BY r.scout_id, up.full_name, r.day, r.obs_count;

  -- Flag: low_timing_variance (CV < threshold across ≥20 inspections)
  RETURN QUERY
    WITH all_gaps AS (
      SELECT
        ti.scout_id,
        (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
        EXTRACT(EPOCH FROM (
          ti.inspected_at - LAG(ti.inspected_at) OVER (
            PARTITION BY ti.scout_id,
              (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date
            ORDER BY ti.inspected_at
          )
        )) AS gap_s
      FROM trap_inspections ti
      JOIN traps t ON t.id = ti.trap_id
      WHERE ti.inspected_at >= p_from::timestamptz
        AND ti.inspected_at < (p_to + 1)::timestamptz
        AND ti.scout_id IS NOT NULL
        AND t.farm_id = ANY(p_farm_ids)
    ),
    cv_calc AS (
      SELECT
        scout_id, day,
        COUNT(*)::integer AS n,
        CASE WHEN AVG(gap_s) > 0
          THEN STDDEV_POP(gap_s) / AVG(gap_s)
          ELSE 0
        END AS cv
      FROM all_gaps
      WHERE gap_s IS NOT NULL AND gap_s > 0
        AND gap_s < v_break_min * 60
      GROUP BY scout_id, day
      HAVING COUNT(*) >= 20
    )
    SELECT
      cc.scout_id,
      COALESCE(up.full_name, 'Unknown'),
      cc.day,
      'low_timing_variance'::text,
      'Timing CV=' || ROUND(cc.cv::numeric, 3) || ' across ' || cc.n || ' inspections (threshold ' || v_cv_thresh || ')',
      'low'::text,
      cc.n
    FROM cv_calc cc
    LEFT JOIN user_profiles up ON up.id = cc.scout_id
    WHERE cc.cv < v_cv_thresh;

  -- Flag: stationary_gps (all GPS within 10m across ≥3 consecutive inspections)
  RETURN QUERY
    WITH gps_events AS (
      SELECT
        ti.scout_id,
        (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
        ti.inspected_at,
        ti.location,
        LAG(ti.location) OVER w AS prev_loc,
        LAG(ti.location, 2) OVER w AS prev_loc2,
        ROW_NUMBER() OVER w AS rn
      FROM trap_inspections ti
      JOIN traps t ON t.id = ti.trap_id
      WHERE ti.inspected_at >= p_from::timestamptz
        AND ti.inspected_at < (p_to + 1)::timestamptz
        AND ti.scout_id IS NOT NULL
        AND ti.location IS NOT NULL
        AND t.farm_id = ANY(p_farm_ids)
      WINDOW w AS (
        PARTITION BY ti.scout_id,
          (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date
        ORDER BY ti.inspected_at
      )
    )
    SELECT
      ge.scout_id,
      COALESCE(up.full_name, 'Unknown'),
      ge.day,
      'stationary_gps'::text,
      COUNT(*) || ' consecutive inspections within 10m',
      'medium'::text,
      COUNT(*)::integer
    FROM gps_events ge
    LEFT JOIN user_profiles up ON up.id = ge.scout_id
    WHERE ge.prev_loc IS NOT NULL AND ge.prev_loc2 IS NOT NULL
      AND ST_DistanceSphere(ge.location::geometry, ge.prev_loc::geometry) < 10
      AND ST_DistanceSphere(ge.prev_loc::geometry, ge.prev_loc2::geometry) < 10
    GROUP BY ge.scout_id, up.full_name, ge.day
    HAVING COUNT(*) >= 3;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RPC: get_scout_weekly_summary
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_scout_weekly_summary(
  p_farm_ids  uuid[],
  p_weeks     integer DEFAULT 8,
  p_scout_id  uuid DEFAULT NULL
)
RETURNS TABLE(
  scout_id             uuid,
  scout_name           text,
  week_nr              integer,
  week_start           date,
  active_days          integer,
  total_traps          integer,
  total_trees          integer,
  avg_traps_per_day    numeric,
  avg_trees_per_day    numeric,
  avg_seconds_per_trap numeric,
  avg_seconds_per_tree numeric,
  trap_completion_pct  numeric,
  quality_score        numeric,
  traps_delta_pct      numeric,
  trees_delta_pct      numeric,
  speed_delta_pct      numeric
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH
  -- Date range: last N weeks
  week_range AS (
    SELECT
      date_trunc('week', CURRENT_DATE - (n * 7 || ' days')::interval)::date AS week_start,
      EXTRACT(ISOYEAR FROM CURRENT_DATE - (n * 7 || ' days')::interval)::integer AS yr,
      EXTRACT(WEEK FROM CURRENT_DATE - (n * 7 || ' days')::interval)::integer AS wk
    FROM generate_series(0, p_weeks - 1) AS n
  ),

  -- Get daily data for the full range
  daily AS (
    SELECT * FROM get_scout_daily_productivity(
      p_farm_ids,
      (SELECT MIN(week_start) FROM week_range),
      CURRENT_DATE,
      p_scout_id
    )
  ),

  -- Get quality flags for the full range
  flags AS (
    SELECT
      qf.scout_id, qf.day,
      COUNT(*) FILTER (WHERE qf.severity = 'high') AS high_flags,
      COUNT(*) FILTER (WHERE qf.severity = 'medium') AS med_flags,
      COUNT(*) AS total_flags
    FROM get_scout_quality_flags(
      p_farm_ids,
      (SELECT MIN(week_start) FROM week_range),
      CURRENT_DATE
    ) qf
    GROUP BY qf.scout_id, qf.day
  ),

  -- Aggregate daily to weekly
  weekly AS (
    SELECT
      d.scout_id,
      MAX(d.scout_name) AS scout_name,
      EXTRACT(WEEK FROM d.day)::integer AS week_nr,
      date_trunc('week', d.day)::date AS week_start,
      COUNT(DISTINCT d.day)::integer AS active_days,
      SUM(d.traps_inspected)::integer AS total_traps,
      SUM(d.trees_inspected)::integer AS total_trees,
      ROUND(AVG(d.traps_inspected)::numeric, 1) AS avg_traps_per_day,
      ROUND(AVG(d.trees_inspected)::numeric, 1) AS avg_trees_per_day,
      ROUND(AVG(NULLIF(d.avg_seconds_per_trap, 0))::numeric, 1) AS avg_seconds_per_trap,
      ROUND(AVG(NULLIF(d.avg_seconds_per_tree, 0))::numeric, 1) AS avg_seconds_per_tree,
      ROUND(AVG(d.trap_completion_pct)::numeric, 1) AS trap_completion_pct,
      -- Quality score: 1.0 - weighted flag penalty
      ROUND(GREATEST(0, 1.0
        - 0.15 * COALESCE(SUM(f.high_flags), 0)
        - 0.05 * COALESCE(SUM(f.med_flags), 0)
      )::numeric, 2) AS quality_score
    FROM daily d
    LEFT JOIN flags f ON f.scout_id = d.scout_id AND f.day = d.day
    GROUP BY d.scout_id, EXTRACT(WEEK FROM d.day), date_trunc('week', d.day)
  ),

  -- WoW deltas
  with_deltas AS (
    SELECT w.*,
      LAG(w.total_traps) OVER (PARTITION BY w.scout_id ORDER BY w.week_start) AS prev_traps,
      LAG(w.total_trees) OVER (PARTITION BY w.scout_id ORDER BY w.week_start) AS prev_trees,
      LAG(w.avg_seconds_per_trap) OVER (PARTITION BY w.scout_id ORDER BY w.week_start) AS prev_speed
    FROM weekly w
  )

  SELECT
    wd.scout_id,
    wd.scout_name,
    wd.week_nr,
    wd.week_start,
    wd.active_days,
    wd.total_traps,
    wd.total_trees,
    wd.avg_traps_per_day,
    wd.avg_trees_per_day,
    COALESCE(wd.avg_seconds_per_trap, 0) AS avg_seconds_per_trap,
    COALESCE(wd.avg_seconds_per_tree, 0) AS avg_seconds_per_tree,
    COALESCE(wd.trap_completion_pct, 0) AS trap_completion_pct,
    wd.quality_score,
    CASE WHEN COALESCE(wd.prev_traps, 0) > 0
      THEN ROUND((wd.total_traps - wd.prev_traps)::numeric / wd.prev_traps * 100, 1)
      ELSE NULL
    END AS traps_delta_pct,
    CASE WHEN COALESCE(wd.prev_trees, 0) > 0
      THEN ROUND((wd.total_trees - wd.prev_trees)::numeric / wd.prev_trees * 100, 1)
      ELSE NULL
    END AS trees_delta_pct,
    CASE WHEN COALESCE(wd.prev_speed, 0) > 0
      THEN ROUND((wd.avg_seconds_per_trap - wd.prev_speed)::numeric / wd.prev_speed * 100, 1)
      ELSE NULL
    END AS speed_delta_pct
  FROM with_deltas wd
  ORDER BY wd.week_start DESC, wd.total_traps + wd.total_trees DESC;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. RPC: get_scout_distance_track
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_scout_distance_track(
  p_scout_id uuid,
  p_day      date
)
RETURNS TABLE(
  inspection_type text,
  inspected_at    timestamptz,
  lat             numeric,
  lng             numeric,
  label           text,
  is_break        boolean
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH

  cfg AS (
    SELECT COALESCE(
      (SELECT s.min_break_gap_minutes
       FROM scout_productivity_settings s
       JOIN scouts sc ON sc.organisation_id = s.organisation_id
       WHERE sc.user_id = p_scout_id
         AND (s.farm_id = sc.farm_id OR s.farm_id IS NULL)
       ORDER BY s.farm_id NULLS LAST
       LIMIT 1),
      30
    ) AS break_gap_min
  ),

  all_points AS (
    -- Trap inspections
    SELECT
      'trap'::text AS inspection_type,
      ti.inspected_at,
      ti.location,
      'Trap #' || COALESCE(t.trap_nr::text, '?') || ' - ' || COALESCE(o.name, '') AS label
    FROM trap_inspections ti
    JOIN traps t ON t.id = ti.trap_id
    LEFT JOIN orchards o ON o.id = ti.orchard_id
    WHERE ti.scout_id = p_scout_id
      AND (ti.inspected_at AT TIME ZONE 'Africa/Johannesburg')::date = p_day

    UNION ALL

    -- Tree inspections
    SELECT
      'tree'::text,
      COALESCE(it.inspected_at, s.inspected_at),
      it.location,
      'Tree #' || it.tree_nr || ' - ' || COALESCE(o.name, '')
    FROM inspection_trees it
    JOIN inspection_sessions s ON s.id = it.session_id
    LEFT JOIN orchards o ON o.id = s.orchard_id
    WHERE s.scout_id = p_scout_id
      AND (COALESCE(it.inspected_at, s.inspected_at) AT TIME ZONE 'Africa/Johannesburg')::date = p_day
  ),

  ordered AS (
    SELECT
      ap.inspection_type,
      ap.inspected_at,
      ap.location,
      ap.label,
      EXTRACT(EPOCH FROM (
        ap.inspected_at - LAG(ap.inspected_at) OVER (ORDER BY ap.inspected_at)
      )) AS gap_s
    FROM all_points ap
  )

  SELECT
    o.inspection_type,
    o.inspected_at,
    CASE WHEN o.location IS NOT NULL THEN ROUND(ST_Y(o.location::geometry)::numeric, 6) END AS lat,
    CASE WHEN o.location IS NOT NULL THEN ROUND(ST_X(o.location::geometry)::numeric, 6) END AS lng,
    o.label,
    COALESCE(o.gap_s > (SELECT break_gap_min FROM cfg) * 60, false) AS is_break
  FROM ordered o
  ORDER BY o.inspected_at;
$$;

-- RPC 1: GPS-captured inspection dots for a given week + farm scope
CREATE OR REPLACE FUNCTION get_trap_inspection_dots(
  p_farm_ids   uuid[],
  p_week_start timestamptz,
  p_week_end   timestamptz
)
RETURNS TABLE (
  inspection_id  uuid,
  trap_id        uuid,
  trap_nr        integer,
  lat            double precision,
  lng            double precision,
  has_location   boolean,
  inspected_at   timestamptz,
  rebaited       boolean,
  nfc_scanned    boolean,
  orchard_id     uuid,
  orchard_name   text,
  zone_name      text,
  scout_id       uuid,
  scout_name     text,
  pest_id        uuid,
  pest_name      text,
  lure_name      text,
  total_count    bigint,
  threshold      integer,
  status         text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ti.id,
    t.id,
    t.trap_nr,
    CASE WHEN ti.location IS NOT NULL THEN ST_Y(ti.location::geometry) END,
    CASE WHEN ti.location IS NOT NULL THEN ST_X(ti.location::geometry) END,
    ti.location IS NOT NULL,
    ti.inspected_at,
    ti.rebaited,
    ti.nfc_scanned,
    o.id,
    o.name,
    COALESCE(z.name, z.zone_letter, '—'),
    sc.user_id,
    sc.full_name,
    p.id,
    p.name,
    lt.name,
    COALESCE(SUM(tc.count), 0),
    th.threshold,
    CASE
      WHEN th.threshold IS NULL THEN 'blue'
      WHEN COALESCE(SUM(tc.count), 0) >= th.threshold THEN 'red'
      WHEN COALESCE(SUM(tc.count), 0) >= th.threshold * 0.5 THEN 'yellow'
      ELSE 'green'
    END
  FROM trap_inspections        ti
  JOIN traps                   t   ON t.id = ti.trap_id
  JOIN orchards                o   ON o.id = t.orchard_id
  LEFT JOIN zones              z   ON z.id = t.zone_id
  LEFT JOIN scouts             sc  ON sc.user_id = ti.scout_id
  LEFT JOIN pests              p   ON p.id = t.pest_id
  LEFT JOIN lure_types         lt  ON lt.id = t.lure_type_id
  LEFT JOIN trap_counts        tc  ON tc.inspection_id = ti.id
  LEFT JOIN LATERAL (
    SELECT threshold FROM trap_thresholds
    WHERE pest_id = t.pest_id
      AND organisation_id = t.organisation_id
    LIMIT 1
  ) th ON true
  WHERE t.farm_id = ANY(p_farm_ids)
    AND ti.inspected_at >= p_week_start
    AND ti.inspected_at <  p_week_end
  GROUP BY
    ti.id, t.id, t.trap_nr, ti.location, ti.inspected_at,
    ti.rebaited, ti.nfc_scanned, o.id, o.name,
    z.name, z.zone_letter, sc.user_id, sc.full_name,
    p.id, p.name, lt.name, th.threshold
  ORDER BY ti.inspected_at DESC, t.trap_nr;
$$;

-- RPC 2: All active traps + this week's inspection status (for coverage table)
CREATE OR REPLACE FUNCTION get_trap_week_coverage(
  p_farm_ids   uuid[],
  p_week_start timestamptz,
  p_week_end   timestamptz
)
RETURNS TABLE (
  trap_id      uuid,
  trap_nr      integer,
  orchard_id   uuid,
  orchard_name text,
  zone_name    text,
  pest_id      uuid,
  pest_name    text,
  lure_name    text,
  inspected    boolean,
  rebaited     boolean,
  total_count  bigint,
  threshold    integer,
  status       text,
  scout_name   text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    t.id,
    t.trap_nr,
    o.id,
    o.name,
    COALESCE(z.name, z.zone_letter, '—'),
    p.id,
    p.name,
    lt.name,
    (ti.id IS NOT NULL),
    COALESCE(ti.rebaited, false),
    COALESCE(SUM(tc.count), 0),
    th.threshold,
    CASE
      WHEN ti.id IS NULL THEN 'grey'
      WHEN th.threshold IS NULL THEN 'blue'
      WHEN COALESCE(SUM(tc.count), 0) >= th.threshold THEN 'red'
      WHEN COALESCE(SUM(tc.count), 0) >= th.threshold * 0.5 THEN 'yellow'
      ELSE 'green'
    END,
    sc.full_name
  FROM traps                   t
  JOIN orchards                o   ON o.id = t.orchard_id
  LEFT JOIN zones              z   ON z.id = t.zone_id
  LEFT JOIN pests              p   ON p.id = t.pest_id
  LEFT JOIN lure_types         lt  ON lt.id = t.lure_type_id
  LEFT JOIN LATERAL (
    SELECT ti2.id, ti2.rebaited, ti2.scout_id
    FROM trap_inspections ti2
    WHERE ti2.trap_id = t.id
      AND ti2.inspected_at >= p_week_start
      AND ti2.inspected_at <  p_week_end
    ORDER BY ti2.inspected_at DESC
    LIMIT 1
  ) ti ON true
  LEFT JOIN trap_counts        tc  ON tc.inspection_id = ti.id
  LEFT JOIN scouts             sc  ON sc.user_id = ti.scout_id
  LEFT JOIN LATERAL (
    SELECT threshold FROM trap_thresholds
    WHERE pest_id = t.pest_id
      AND organisation_id = t.organisation_id
    LIMIT 1
  ) th ON true
  WHERE t.farm_id = ANY(p_farm_ids)
    AND t.is_active = true
  GROUP BY
    t.id, t.trap_nr, o.id, o.name, z.name, z.zone_letter,
    p.id, p.name, lt.name, ti.id, ti.rebaited, ti.scout_id,
    th.threshold, sc.full_name
  ORDER BY (ti.id IS NOT NULL) DESC, o.name, t.trap_nr;
$$;

CREATE OR REPLACE FUNCTION get_farm_pest_pressure_summary(p_farm_ids uuid[])
RETURNS TABLE(
  pest_id            uuid,
  pest_name          text,
  this_week_total    bigint,
  last_week_total    bigint,
  red_orchards       bigint,
  yellow_orchards    bigint,
  green_orchards     bigint,
  worst_orchard_id   uuid,
  worst_orchard_name text,
  worst_count        bigint
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH
  date_bounds AS (
    SELECT
      date_trunc('week', now())                        AS this_start,
      date_trunc('week', now()) - interval '1 week'   AS last_start
  ),
  orchard_scope AS (
    SELECT id, name, commodity_id
    FROM   orchards
    WHERE  farm_id = ANY(p_farm_ids) AND is_active = true
  ),
  raw AS (
    SELECT
      tc.pest_id                                                            AS r_pest_id,
      t.orchard_id                                                          AS r_orchard_id,
      ti.inspected_at >= (SELECT this_start FROM date_bounds)               AS is_this_week,
      SUM(tc.count)                                                         AS total
    FROM trap_counts       tc
    JOIN trap_inspections  ti ON ti.id = tc.inspection_id
    JOIN traps             t  ON t.id  = ti.trap_id
    JOIN orchard_scope     os ON os.id = t.orchard_id
    WHERE ti.inspected_at >= (SELECT last_start FROM date_bounds)
    GROUP BY tc.pest_id, t.orchard_id, is_this_week
  ),
  this_week AS (
    SELECT r_pest_id, r_orchard_id, total FROM raw WHERE is_this_week
  ),
  last_week AS (
    SELECT r_pest_id, r_orchard_id, total FROM raw WHERE NOT is_this_week
  ),
  thresholds AS (
    SELECT th.pest_id AS t_pest_id, os.id AS t_orchard_id, MIN(th.threshold) AS threshold
    FROM   trap_thresholds th
    JOIN   orchard_scope   os ON os.commodity_id = th.commodity_id
    GROUP BY th.pest_id, os.id
  ),
  orchard_status AS (
    SELECT
      tw.r_pest_id                                                AS os_pest_id,
      tw.r_orchard_id                                             AS os_orchard_id,
      os.name                                                     AS os_orchard_name,
      tw.total                                                    AS os_count,
      th.threshold                                                AS os_threshold,
      CASE
        WHEN th.threshold IS NULL              THEN 'none'
        WHEN tw.total >= th.threshold          THEN 'red'
        WHEN tw.total >= th.threshold * 0.5   THEN 'yellow'
        ELSE 'green'
      END                                                         AS os_status
    FROM   this_week      tw
    JOIN   orchard_scope  os ON os.id          = tw.r_orchard_id
    LEFT JOIN thresholds  th ON th.t_pest_id   = tw.r_pest_id
                             AND th.t_orchard_id = tw.r_orchard_id
  ),
  worst AS (
    SELECT DISTINCT ON (os_pest_id)
      os_pest_id,
      os_orchard_id   AS w_orchard_id,
      os_orchard_name AS w_orchard_name,
      os_count        AS w_count
    FROM   orchard_status
    ORDER BY os_pest_id, os_count DESC
  )
  SELECT
    ost.os_pest_id                                            AS pest_id,
    p.name                                                    AS pest_name,
    COALESCE(SUM(ost.os_count), 0)                            AS this_week_total,
    COALESCE(SUM(lw.total), 0)                                AS last_week_total,
    COUNT(*) FILTER (WHERE ost.os_status = 'red')             AS red_orchards,
    COUNT(*) FILTER (WHERE ost.os_status = 'yellow')          AS yellow_orchards,
    COUNT(*) FILTER (WHERE ost.os_status = 'green')           AS green_orchards,
    w.w_orchard_id                                            AS worst_orchard_id,
    w.w_orchard_name                                          AS worst_orchard_name,
    w.w_count                                                 AS worst_count
  FROM      orchard_status  ost
  JOIN      pests            p  ON p.id          = ost.os_pest_id
  LEFT JOIN last_week        lw ON lw.r_pest_id  = ost.os_pest_id
                                AND lw.r_orchard_id = ost.os_orchard_id
  JOIN      worst            w  ON w.os_pest_id  = ost.os_pest_id
  GROUP BY ost.os_pest_id, p.name, w.w_orchard_id, w.w_orchard_name, w.w_count
  ORDER BY red_orchards DESC, this_week_total DESC;
$$;

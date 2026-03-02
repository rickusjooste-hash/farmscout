DO $$
DECLARE
  org_id   uuid := '93d1760e-a484-4379-95fb-6cad294e2191';
  orch_id  uuid := '746a1805-bd45-40bb-9300-7494d386f6d4';
  v_trap_id uuid;
  v_insp_id uuid;
BEGIN

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-02T17:00:39+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-02T17:00:39+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-02T17:04:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-02T17:04:15+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-02T17:06:04+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-02T17:06:04+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-02T17:11:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-02T17:11:26+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-09T14:30:59+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-09T14:30:59+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-09T14:34:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-09T14:34:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-09T14:35:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-09T14:35:56+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-09T14:42:24+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-09T14:42:24+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-16T11:47:46+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-16T11:47:46+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-16T11:55:00+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-16T11:55:00+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-16T11:56:48+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-16T11:56:48+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-16T12:04:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-16T12:04:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-23T11:39:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-23T11:39:25+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-23T11:42:04+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-23T11:42:04+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-23T11:43:09+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-23T11:43:09+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-23T11:49:08+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-23T11:49:08+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-30T11:14:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-30T11:14:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-30T11:31:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-30T11:31:25+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-10-30T11:38:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-10-30T11:38:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-06T11:07:10+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-06T11:07:10+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-06T11:11:27+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-06T11:11:27+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-06T11:12:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-06T11:12:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-06T11:25:44+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-06T11:25:44+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-13T11:37:51+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-13T11:37:51+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-13T11:42:31+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-13T11:42:31+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-13T11:44:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-13T11:44:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-13T11:44:45+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-13T11:44:45+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-20T10:59:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-20T10:59:16+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-20T11:02:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-20T11:02:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-20T11:03:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-20T11:03:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-20T11:09:14+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-20T11:09:14+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-27T10:35:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-27T10:35:53+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-27T10:38:55+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-27T10:38:55+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-27T10:40:19+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-27T10:40:19+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-11-27T11:40:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-11-27T11:40:26+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-04T10:16:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-04T10:16:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-04T10:19:12+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-04T10:19:12+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-04T10:20:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-04T10:20:26+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-04T10:26:14+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-04T10:26:14+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-11T11:14:22+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-11T11:14:22+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-11T11:17:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-11T11:17:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-11T11:20:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-11T11:20:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-11T11:26:10+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-11T11:26:10+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-18T11:01:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-18T11:01:56+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-18T11:46:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-18T11:46:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-18T11:48:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-18T11:48:06+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-18T11:53:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-18T11:53:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-27T11:12:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-27T11:12:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-27T11:15:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-27T11:15:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-27T11:16:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-27T11:16:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2023-12-27T11:22:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2023-12-27T11:22:15+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-03T11:55:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-03T11:55:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-03T12:05:02+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-03T12:05:02+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-03T12:05:08+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-03T12:05:08+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-03T12:09:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-03T12:09:16+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-08T11:04:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-08T11:04:53+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-08T11:09:28+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-08T11:09:28+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-08T11:11:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-08T11:11:41+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-08T11:18:03+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-08T11:18:03+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-15T10:33:27+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-15T10:33:27+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-15T10:36:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-15T10:36:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-15T10:37:48+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-15T10:37:48+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-15T10:48:23+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-15T10:48:23+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-23T08:38:04+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-23T08:38:04+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-23T08:39:19+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-23T08:39:19+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-23T08:44:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-23T08:44:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-23T08:54:44+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-23T08:54:44+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-29T10:47:29+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-29T10:47:29+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-29T10:51:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-29T10:51:25+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-29T10:55:21+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-29T10:55:21+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-01-29T10:59:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-01-29T10:59:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-05T11:12:07+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-05T11:12:07+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-05T11:16:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-05T11:16:13+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-05T11:22:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-05T11:22:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-05T11:28:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-05T11:28:56+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-12T10:47:12+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-12T10:47:12+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-12T10:49:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-12T10:49:38+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 11, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-12T10:52:52+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-12T10:52:52+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-12T11:00:18+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-12T11:00:18+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-19T11:11:45+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-19T11:11:45+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-19T11:16:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-19T11:16:15+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 4, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-19T11:27:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-19T11:27:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-19T11:50:51+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-19T11:50:51+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-26T11:20:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-26T11:20:06+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-26T11:27:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-26T11:27:41+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-26T11:27:46+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-26T11:27:46+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-02-26T11:31:28+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-02-26T11:31:28+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-05T10:38:27+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-05T10:38:27+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-05T10:46:21+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-05T10:46:21+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 7, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-05T10:46:28+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-05T10:46:28+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-05T10:51:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-05T10:51:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-11T10:48:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-11T10:48:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-11T10:57:05+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-11T10:57:05+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-11T10:57:09+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-11T10:57:09+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-11T11:00:59+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-11T11:00:59+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-18T10:58:14+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-18T10:58:14+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-18T11:04:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-18T11:04:16+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-18T11:04:21+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-18T11:04:21+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-18T11:08:31+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-18T11:08:31+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-25T10:55:31+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-25T10:55:31+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-25T11:04:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-25T11:04:41+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-25T11:04:45+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-25T11:04:45+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-03-25T11:08:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-03-25T11:08:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-02T14:49:18+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-02T14:49:18+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-02T14:54:28+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-02T14:54:28+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-02T14:54:32+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-02T14:54:32+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-02T14:58:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-02T14:58:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-08T14:08:01+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-08T14:08:01+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-08T14:13:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-08T14:13:56+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 17, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-08T14:14:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-08T14:14:06+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-08T14:19:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-08T14:19:16+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-15T10:57:18+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-15T10:57:18+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-15T11:07:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-15T11:07:15+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 8, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-15T11:07:22+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-15T11:07:22+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-15T11:17:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-15T11:17:06+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-22T10:28:57+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-22T10:28:57+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-22T10:37:55+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-22T10:37:55+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-22T10:38:00+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-22T10:38:00+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-22T10:42:00+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-22T10:42:00+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-29T10:48:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-29T10:48:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-29T10:54:10+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-29T10:54:10+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-29T10:54:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-29T10:54:15+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-04-29T10:58:59+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-04-29T10:58:59+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-06T11:11:44+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-06T11:11:44+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-06T11:17:31+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-06T11:17:31+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 8, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-06T11:17:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-06T11:17:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-06T11:21:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-06T11:21:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 5, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-13T11:00:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-13T11:00:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-13T11:00:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-13T11:00:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-13T11:05:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-13T11:05:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-13T11:09:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-13T11:09:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-20T11:22:00+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-20T11:22:00+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 16, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-20T12:00:59+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-20T12:00:59+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-20T12:01:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-20T12:01:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-20T12:07:11+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-20T12:07:11+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 16, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-27T10:48:04+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-27T10:48:04+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-27T10:54:04+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-27T10:54:04+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-27T10:54:10+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-27T10:54:10+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-05-27T10:59:03+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-05-27T10:59:03+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 5, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-06-10T10:22:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-06-10T10:22:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-06-10T10:28:17+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-06-10T10:28:17+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 9, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-06-10T10:28:29+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-06-10T10:28:29+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-06-10T10:33:11+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-06-10T10:33:11+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 7, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-15T09:18:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-15T09:18:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-15T09:18:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-15T09:18:41+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 14, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-15T09:27:00+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-15T09:27:00+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-15T09:27:05+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-15T09:27:05+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 15, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-22T10:17:23+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-22T10:17:23+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-22T10:17:27+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-22T10:17:27+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-22T10:31:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-22T10:31:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-22T10:31:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-22T10:31:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-30T11:06:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-30T11:06:15+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-30T11:06:19+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-30T11:06:19+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-30T11:11:39+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-30T11:11:39+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-07-30T11:11:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-07-30T11:11:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-05T10:05:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-05T10:05:53+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-05T10:05:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-05T10:05:56+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-05T10:12:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-05T10:12:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-05T10:12:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-05T10:12:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-12T11:49:19+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-12T11:49:19+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-12T11:49:24+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-12T11:49:24+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-12T11:55:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-12T11:55:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-12T11:55:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-12T11:55:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-19T10:27:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-19T10:27:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-19T10:28:02+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-19T10:28:02+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-19T10:33:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-19T10:33:41+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-19T10:33:44+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-19T10:33:44+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-28T14:22:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-28T14:22:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-28T14:22:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-28T14:22:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-28T14:29:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-28T14:29:13+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-08-28T14:29:17+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-08-28T14:29:17+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-02T10:31:30+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-02T10:31:30+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-02T10:42:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-02T10:42:25+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-02T10:42:28+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-02T10:42:28+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-02T10:47:14+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-02T10:47:14+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-09T10:27:22+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-09T10:27:22+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-09T10:33:21+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-09T10:33:21+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-09T10:33:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-09T10:33:26+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-09T10:38:17+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-09T10:38:17+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-16T10:58:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-16T10:58:16+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-16T11:04:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-16T11:04:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-16T11:04:23+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-16T11:04:23+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-16T11:10:02+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-16T11:10:02+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-23T11:46:47+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-23T11:46:47+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-23T11:51:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-23T11:51:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-23T11:53:02+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-23T11:53:02+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-09-23T11:56:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-09-23T11:56:16+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-01T14:02:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-01T14:02:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-01T14:12:21+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-01T14:12:21+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-01T14:12:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-01T14:12:25+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-01T14:12:27+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-01T14:12:27+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-07T14:12:31+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-07T14:12:31+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-07T14:21:21+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-07T14:21:21+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-07T14:21:24+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-07T14:21:24+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-07T14:21:27+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-07T14:21:27+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-14T13:48:59+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-14T13:48:59+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-14T14:00:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-14T14:00:13+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-14T14:00:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-14T14:00:16+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-14T14:00:18+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-14T14:00:18+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-21T11:02:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-21T11:02:53+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-21T11:05:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-21T11:05:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-21T11:05:46+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-21T11:05:46+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-21T11:05:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-21T11:05:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-29T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-29T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-29T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-29T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-29T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-29T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-10-29T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-10-29T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-05T10:28:47+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-05T10:28:47+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-05T10:29:00+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-05T10:29:00+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-05T10:29:03+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-05T10:29:03+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-05T10:29:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-05T10:29:06+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-05T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-05T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-05T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-05T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-05T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-05T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-05T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-05T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-12T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-12T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-12T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-12T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-12T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-12T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-12T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-12T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-19T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-19T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-19T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-19T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-19T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-19T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-19T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-19T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-26T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-26T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-26T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-26T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-26T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-26T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-11-26T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-11-26T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-03T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-03T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-03T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-03T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-03T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-03T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-03T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-03T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-10T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-10T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-10T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-10T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-10T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-10T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-10T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-10T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-17T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-17T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-17T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-17T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-17T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-17T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-17T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-17T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-24T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-24T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-24T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-24T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-24T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-24T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-24T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-24T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-31T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-31T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-31T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-31T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-31T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-31T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2024-12-31T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2024-12-31T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-07T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-07T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-07T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-07T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-07T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-07T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-07T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-07T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-14T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-14T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-14T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-14T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-14T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-14T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-14T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-14T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-21T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-21T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-21T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-21T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-21T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-21T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-21T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-21T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-28T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-28T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-28T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-28T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-28T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-28T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-01-28T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-01-28T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-04T10:38:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-04T10:38:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-04T10:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-04T10:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-04T10:44:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-04T10:44:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-04T10:51:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-04T10:51:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-10T10:44:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-10T10:44:56+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-10T10:52:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-10T10:52:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-10T10:52:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-10T10:52:53+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-10T10:57:31+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-10T10:57:31+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-17T12:15:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-17T12:15:33+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-17T13:40:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-17T13:40:15+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-17T13:40:19+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-17T13:40:19+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-17T13:44:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-17T13:44:13+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-24T10:47:52+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-24T10:47:52+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-24T10:57:07+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-24T10:57:07+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-24T10:57:12+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-24T10:57:12+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-02-24T11:05:28+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-02-24T11:05:28+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-03T11:49:39+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-03T11:49:39+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-03T11:55:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-03T11:55:56+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-03T11:55:59+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-03T11:55:59+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-03T12:00:09+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-03T12:00:09+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-10T11:32:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-10T11:32:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-10T11:37:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-10T11:37:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-10T11:37:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-10T11:37:41+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-10T11:49:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-10T11:49:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 9, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-17T11:22:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-17T11:22:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-17T11:27:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-17T11:27:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-17T11:27:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-17T11:27:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-17T11:32:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-17T11:32:15+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 6, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-24T11:08:39+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-24T11:08:39+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-24T11:14:30+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-24T11:14:30+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-24T11:14:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-24T11:14:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-24T11:19:05+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-24T11:19:05+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 6, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-31T11:44:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-31T11:44:56+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-31T11:52:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-31T11:52:41+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-31T11:52:46+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-31T11:52:46+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-03-31T11:57:28+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-03-31T11:57:28+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-07T11:38:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-07T11:38:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-07T11:44:35+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-07T11:44:35+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-07T11:44:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-07T11:44:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-07T11:49:07+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-07T11:49:07+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-14T11:15:48+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-14T11:15:48+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-14T11:26:48+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-14T11:26:48+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-14T11:26:51+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-14T11:26:51+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-14T11:34:57+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-14T11:34:57+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 6, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-22T11:32:01+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-22T11:32:01+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-22T11:36:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-22T11:36:53+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 5, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-22T11:36:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-22T11:36:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-22T11:41:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-22T11:41:15+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 19, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-29T11:41:23+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-29T11:41:23+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-29T11:47:02+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-29T11:47:02+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-29T11:47:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-29T11:47:06+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-04-29T12:01:40+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-04-29T12:01:40+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-05T10:58:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-05T10:58:25+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-05T11:03:22+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-05T11:03:22+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-05T11:03:27+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-05T11:03:27+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-05T11:12:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-05T11:12:16+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 8, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-12T11:18:04+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-12T11:18:04+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-12T11:25:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-12T11:25:38+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-12T11:25:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-12T11:25:42+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-12T11:28:05+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-12T11:28:05+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-19T10:36:47+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-19T10:36:47+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-19T10:51:09+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-19T10:51:09+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-19T10:51:19+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-19T10:51:19+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-19T10:51:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-19T10:51:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-26T11:27:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-26T11:27:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-26T11:34:22+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-26T11:34:22+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-26T11:34:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-26T11:34:25+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-05-26T11:34:32+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-05-26T11:34:32+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-02T11:56:23+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-02T11:56:23+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-02T12:06:59+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-02T12:06:59+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-02T12:07:02+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-02T12:07:02+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-02T12:07:05+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-02T12:07:05+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-09T11:21:07+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-09T11:21:07+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-09T11:26:35+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-09T11:26:35+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-09T11:26:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-09T11:26:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-09T11:28:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-09T11:28:53+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-16T10:50:52+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-16T10:50:52+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-16T10:59:19+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-16T10:59:19+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 4, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-16T10:59:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-16T10:59:26+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-16T10:59:32+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-16T10:59:32+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 11, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-23T11:00:55+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-23T11:00:55+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-23T11:11:14+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-23T11:11:14+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 4, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-23T11:11:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-23T11:11:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-06-23T11:11:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-06-23T11:11:25+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 5, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-07-21T10:26:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-07-21T10:26:06+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-07-21T10:26:11+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-07-21T10:26:11+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-07-21T10:26:18+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-07-21T10:26:18+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-07-21T10:26:22+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-07-21T10:26:22+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 3, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-07-28T11:10:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-07-28T11:10:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-07-28T11:16:18+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-07-28T11:16:18+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-07-28T11:16:21+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-07-28T11:16:21+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-07-28T11:16:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-07-28T11:16:26+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-06T08:20:30+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-06T08:20:30+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-06T08:29:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-06T08:29:06+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-06T08:29:09+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-06T08:29:09+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-06T08:29:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-06T08:29:16+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-11T11:20:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-11T11:20:13+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-11T11:26:18+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-11T11:26:18+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-11T11:26:21+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-11T11:26:21+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-11T11:26:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-11T11:26:26+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-18T11:08:22+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-18T11:08:22+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-18T11:14:10+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-18T11:14:10+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-18T11:14:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-18T11:14:13+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-18T11:14:17+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-18T11:14:17+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-25T10:38:12+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-25T10:38:12+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-25T10:43:32+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-25T10:43:32+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-25T10:43:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-25T10:43:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-08-25T10:43:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-08-25T10:43:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-01T11:24:07+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-01T11:24:07+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-01T11:32:50+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-01T11:32:50+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-01T11:32:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-01T11:32:54+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-01T11:37:57+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-01T11:37:57+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-08T10:55:35+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-08T10:55:35+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-08T11:08:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-08T11:08:26+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-08T11:08:29+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-08T11:08:29+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-08T11:13:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-08T11:13:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-15T11:07:50+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-15T11:07:50+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-15T11:15:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-15T11:15:13+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-15T11:15:16+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-15T11:15:16+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-15T11:19:50+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-15T11:19:50+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-23T10:57:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-23T10:57:13+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-23T11:08:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-23T11:08:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-23T11:08:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-23T11:08:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-23T11:16:10+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-23T11:16:10+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-29T15:32:27+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-29T15:32:27+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-29T15:32:40+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-29T15:32:40+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-29T15:32:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-29T15:32:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-09-29T15:32:45+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-09-29T15:32:45+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-06T16:59:39+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-06T16:59:39+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-06T16:59:45+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-06T16:59:45+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-06T16:59:47+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-06T16:59:47+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-06T16:59:50+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-06T16:59:50+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-13T10:43:47+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-13T10:43:47+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-13T10:46:30+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-13T10:46:30+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-13T10:48:39+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-13T10:48:39+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-13T10:50:56+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-13T10:50:56+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-20T11:31:37+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-20T11:31:37+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-20T11:33:47+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-20T11:33:47+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-20T11:36:42+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-20T11:36:42+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-20T11:38:47+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-20T11:38:47+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-27T11:12:54+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-27T11:12:54+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-27T11:15:06+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-27T11:15:06+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-27T11:16:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-27T11:16:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-10-27T11:20:12+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-10-27T11:20:12+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-03T10:50:02+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-03T10:50:02+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-03T10:50:05+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-03T10:50:05+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-03T10:51:52+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-03T10:51:52+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-03T10:54:32+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-03T10:54:32+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-10T10:28:50+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-10T10:28:50+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-10T10:29:05+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-10T10:29:05+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-10T10:30:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-10T10:30:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-10T10:32:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-10T10:32:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-17T10:44:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-17T10:44:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-17T10:47:43+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-17T10:47:43+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-17T10:49:14+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-17T10:49:14+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-17T10:51:04+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-17T10:51:04+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-24T11:18:28+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-24T11:18:28+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-24T11:22:51+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-24T11:22:51+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-24T11:24:09+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-24T11:24:09+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-11-24T11:27:15+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-11-24T11:27:15+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-01T11:02:00+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-01T11:02:00+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-01T11:23:09+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-01T11:23:09+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-01T11:24:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-01T11:24:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-01T11:26:43+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-01T11:26:43+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-08T11:02:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-08T11:02:26+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-08T11:15:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-08T11:15:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-08T11:17:25+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-08T11:17:25+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-08T11:19:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-08T11:19:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-15T11:16:14+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-15T11:16:14+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-15T11:23:34+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-15T11:23:34+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-15T11:24:50+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-15T11:24:50+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-15T11:27:20+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-15T11:27:20+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-22T10:33:50+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-22T10:33:50+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-22T10:36:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-22T10:36:53+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-22T10:38:12+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-22T10:38:12+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-22T10:44:40+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-22T10:44:40+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-29T12:10:32+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-29T12:10:32+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-29T13:54:05+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-29T13:54:05+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-29T13:54:10+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-29T13:54:10+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2025-12-29T13:54:14+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2025-12-29T13:54:14+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-05T11:22:35+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-05T11:22:35+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-05T11:25:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-05T11:25:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-05T11:25:38+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-05T11:25:38+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-05T11:27:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-05T11:27:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-12T13:54:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-12T13:54:13+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-12T13:54:43+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-12T13:54:43+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-12T13:55:01+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-12T13:55:01+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-12T13:55:07+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-12T13:55:07+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 7, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-20T10:18:31+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-20T10:18:31+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-20T10:23:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-20T10:23:33+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-20T10:23:36+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-20T10:23:36+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-20T10:23:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-20T10:23:41+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 2, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-26T10:46:13+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-26T10:46:13+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-26T10:46:24+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-26T10:46:24+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-26T10:46:26+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-26T10:46:26+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-01-26T10:46:31+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-01-26T10:46:31+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 26, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-02T10:52:55+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-02T10:52:55+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-02T10:55:46+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-02T10:55:46+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-02T10:55:49+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-02T10:55:49+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-02T10:55:52+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-02T10:55:52+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 4, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-09T15:39:04+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-09T15:39:04+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-09T16:01:53+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-09T16:01:53+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-09T16:01:55+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-09T16:01:55+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-09T16:01:58+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-09T16:01:58+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-16T10:45:00+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-16T10:45:00+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-16T10:47:59+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-16T10:47:59+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-16T10:48:02+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-16T10:48:02+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-16T10:48:09+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-16T10:48:09+00'::timestamptz, FALSE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 6, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '29482ab9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-23T10:49:46+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-23T10:49:46+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '88359302' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-23T10:53:33+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-23T10:53:33+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 1, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = 'b8e48835' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-23T10:53:41+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-23T10:53:41+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, 'c86f223d-1b81-4378-ab99-9ee7152f27af', 0, now());
  END IF;

  SELECT id INTO v_trap_id FROM traps WHERE nfc_tag = '540617f9' LIMIT 1;
  IF v_trap_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM trap_inspections WHERE trap_id = v_trap_id AND inspected_at = '2026-02-23T10:53:45+00'::timestamptz
  ) THEN
    INSERT INTO trap_inspections (id, organisation_id, trap_id, orchard_id, inspected_at, rebaited, nfc_scanned, created_at)
    VALUES (gen_random_uuid(), org_id, v_trap_id, orch_id, '2026-02-23T10:53:45+00'::timestamptz, TRUE, TRUE, now())
    RETURNING id INTO v_insp_id;
    INSERT INTO trap_counts (id, inspection_id, pest_id, count, created_at)
    VALUES (gen_random_uuid(), v_insp_id, '0b61361e-43b6-4c2d-ae42-46cb8365e240', 11, now());
  END IF;

END;
$$;
-- ============================================================
-- Fix duplicate size bins created by QC data migration.
-- Migration created "135" bins; originals are "Count 135".
-- Reassign qc_fruit rows then delete the duplicate bins.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Increase statement timeout for this session (large updates)
SET statement_timeout = '300s';

-- ── APPLES (commodity 568df904-f53b-4171-9d84-033f58d07023) ──

UPDATE qc_fruit SET size_bin_id = '2cfd355e-ffd0-41a6-9c9e-c04d913577f2'
WHERE size_bin_id = '68f52701-4da6-449a-8dbf-6146c511a7bf'; -- 70 → Count 70

UPDATE qc_fruit SET size_bin_id = 'a847270d-f2fb-4128-9dce-3b11a97da78a'
WHERE size_bin_id = '045e3e9e-37ac-4895-8dd8-d6410674e8d7'; -- 80 → Count 80

UPDATE qc_fruit SET size_bin_id = '9a1c031c-fc08-4215-b7cc-45f847e1a16e'
WHERE size_bin_id = '78f20057-44e6-4cdd-b444-ace6c8337fce'; -- 90 → Count 90

UPDATE qc_fruit SET size_bin_id = '4e1fc9a5-2a01-478b-853e-e359a9cd3b30'
WHERE size_bin_id = 'f22b86ae-d8a8-4570-a606-20843159ea9f'; -- 100 → Count 100

UPDATE qc_fruit SET size_bin_id = '5b41b5a6-3909-46d5-9fe6-bf6f6e7dbbfb'
WHERE size_bin_id = 'a8b1c1fe-c596-42fe-95f7-58bf864c7d3a'; -- 110 → Count 110

UPDATE qc_fruit SET size_bin_id = 'f152d4cf-8b1f-4233-b612-21215f3fcd43'
WHERE size_bin_id = '6b355616-f3f3-4ac0-8a36-c783af2cc503'; -- 120 → Count 120

UPDATE qc_fruit SET size_bin_id = 'b8dfe12e-ad05-4615-9a0a-096ae64ca04f'
WHERE size_bin_id = '093a5801-b044-40bf-9c6a-2ec55e3df249'; -- 135 → Count 135

UPDATE qc_fruit SET size_bin_id = 'ffbf93e6-a2d6-4cb4-a453-8756b6c52350'
WHERE size_bin_id = '921cd88c-d97c-46d3-a17d-55d9cf2504fc'; -- 150 → Count 150

UPDATE qc_fruit SET size_bin_id = 'bffa8996-e28e-4de7-ac3b-34e871214ddb'
WHERE size_bin_id = 'e7c86fb5-41d2-43fd-9341-5a2578a936d3'; -- 165 → Count 165

UPDATE qc_fruit SET size_bin_id = 'c42e6717-b3a7-4db5-aca0-eb871fc664d8'
WHERE size_bin_id = '66fd1df4-f891-4645-a04c-f7d4dc306114'; -- 180 → Count 180

UPDATE qc_fruit SET size_bin_id = '8da03103-e09b-4763-af04-2a9ff867e75f'
WHERE size_bin_id = 'cd423e73-1bcf-4f00-a5b5-33135c4ae753'; -- 198 → Count 198

UPDATE qc_fruit SET size_bin_id = '5e16f686-2d5c-445c-a61c-c9131829510f'
WHERE size_bin_id = 'f2b1e2ce-a744-41a3-a8a7-552df9eb94ae'; -- 216 → Count 216

UPDATE qc_fruit SET size_bin_id = '6d2c98cc-207d-4d54-a904-06d2bf30620a'
WHERE size_bin_id = 'cdb9f3a8-8f3c-4b2e-920d-78b6e4dd483f'; -- Small → Undersize

-- Delete Apple duplicate bins
DELETE FROM size_bins WHERE id IN (
  '68f52701-4da6-449a-8dbf-6146c511a7bf', -- 70
  '045e3e9e-37ac-4895-8dd8-d6410674e8d7', -- 80
  '78f20057-44e6-4cdd-b444-ace6c8337fce', -- 90
  'f22b86ae-d8a8-4570-a606-20843159ea9f', -- 100
  'a8b1c1fe-c596-42fe-95f7-58bf864c7d3a', -- 110
  '6b355616-f3f3-4ac0-8a36-c783af2cc503', -- 120
  '093a5801-b044-40bf-9c6a-2ec55e3df249', -- 135
  '921cd88c-d97c-46d3-a17d-55d9cf2504fc', -- 150
  'e7c86fb5-41d2-43fd-9341-5a2578a936d3', -- 165
  '66fd1df4-f891-4645-a04c-f7d4dc306114', -- 180
  'cd423e73-1bcf-4f00-a5b5-33135c4ae753', -- 198
  'f2b1e2ce-a744-41a3-a8a7-552df9eb94ae', -- 216
  'cdb9f3a8-8f3c-4b2e-920d-78b6e4dd483f'  -- Small
);

-- Also delete Apple "Oversize" duplicate if it exists
-- Original: a0d9b244 (display_order=1), no migration dupe created for Oversize on Apples

-- ── PEARS (commodity f0415f88-b593-4972-a1b4-2abd9d5c87cb) ──

UPDATE qc_fruit SET size_bin_id = 'e6eb06c0-4dd2-4c6b-8e41-7bddee3970df'
WHERE size_bin_id = 'c107b4bf-2241-4591-a435-8ebeecbeceee'; -- 38 → Count 38

UPDATE qc_fruit SET size_bin_id = '9cbbee6e-98de-4270-83f8-c7e7fdadb02a'
WHERE size_bin_id = '34ecea24-b249-4f50-9afd-8052519f937c'; -- 45 → Count 45

-- Note: Pears has "Count 46" (48→46 mapping) but migration created "48"
UPDATE qc_fruit SET size_bin_id = '88dae0da-a017-4b44-90ee-341898759ef3'
WHERE size_bin_id = '6fe4303e-c5b0-4c81-bc55-bdec6d19c38b'; -- 48 → Count 46

UPDATE qc_fruit SET size_bin_id = '298cc5a9-bda5-4d4b-bba4-3d738960eed1'
WHERE size_bin_id = 'bb208f8d-5817-4717-823b-a325f511335a'; -- 52 → Count 52

UPDATE qc_fruit SET size_bin_id = '03ae1d7b-fc79-414f-94de-c00fc3e86e5f'
WHERE size_bin_id = '59468e49-e6eb-4b2b-a0d6-31d107e74094'; -- 60 → Count 60

UPDATE qc_fruit SET size_bin_id = '0f76eba3-7ec8-4aa6-af7c-d002785cab7a'
WHERE size_bin_id = '5de817f9-c71a-4631-b1ec-72399946fe54'; -- 70 → Count 70

UPDATE qc_fruit SET size_bin_id = '0881e3af-f43f-4667-bbd7-8a156c814e26'
WHERE size_bin_id = 'ca9770c8-23f9-4510-bcb8-881bcdf38a10'; -- 80 → Count 80

UPDATE qc_fruit SET size_bin_id = 'b98dd193-4e35-4409-8bd7-30da8a3942ad'
WHERE size_bin_id = '0b1aae18-03fb-4bc5-8c21-7e402d203064'; -- 90 → Count 90

UPDATE qc_fruit SET size_bin_id = 'b93935bd-b578-45f1-822b-3d20a5fe32c1'
WHERE size_bin_id = 'ddac07db-c1d9-4595-b9b6-49dc67c5d0f9'; -- 96 → Count 96

UPDATE qc_fruit SET size_bin_id = '69c930c3-f632-40b2-b6aa-652c2bbf8f58'
WHERE size_bin_id = '8bd6fe18-7fc8-4464-8bf6-15dc20c2f889'; -- 112 → Count 112

UPDATE qc_fruit SET size_bin_id = '4b13f95f-870c-455b-95f8-ffb7c0c69776'
WHERE size_bin_id = '4e559b1c-1ec6-4c1d-93c5-3ed99530f7c2'; -- 120 → Count 120

UPDATE qc_fruit SET size_bin_id = '7d99d482-9dc3-48ff-9b42-165edf62fac9'
WHERE size_bin_id = 'eb062a4b-1077-4f14-9126-da64abb29eae'; -- Small → Undersize

-- Delete Pear duplicate bins
DELETE FROM size_bins WHERE id IN (
  'c107b4bf-2241-4591-a435-8ebeecbeceee', -- 38
  '34ecea24-b249-4f50-9afd-8052519f937c', -- 45
  '6fe4303e-c5b0-4c81-bc55-bdec6d19c38b', -- 48
  'bb208f8d-5817-4717-823b-a325f511335a', -- 52
  '59468e49-e6eb-4b2b-a0d6-31d107e74094', -- 60
  '5de817f9-c71a-4631-b1ec-72399946fe54', -- 70
  'ca9770c8-23f9-4510-bcb8-881bcdf38a10', -- 80
  '0b1aae18-03fb-4bc5-8c21-7e402d203064', -- 90
  'ddac07db-c1d9-4595-b9b6-49dc67c5d0f9', -- 96
  '8bd6fe18-7fc8-4464-8bf6-15dc20c2f889', -- 112
  '4e559b1c-1ec6-4c1d-93c5-3ed99530f7c2', -- 120
  'eb062a4b-1077-4f14-9126-da64abb29eae'  -- Small
);

-- Reset statement timeout
RESET statement_timeout;

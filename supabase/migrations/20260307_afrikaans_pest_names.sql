-- Populate pests.name_af for rows that are still NULL
-- Based on actual pest data in DB as of 2026-03-07
-- Review via Manager > Pests page after running — edit any that are wrong

UPDATE public.pests SET name_af = v.name_af
FROM (VALUES
  -- Already Afrikaans-named in English column
  ('70340aba-801e-45bb-a1e8-6a50571c0c39'::uuid, 'Blaaspootjie'),   -- Blaaspootjie (already Afrikaans)
  ('c3a11626-eacf-4e36-9e7e-aeebd5bdf445'::uuid, 'Rooidopluis'),    -- RooiDopluis (already Afrikaans)

  -- Diseases & conditions
  ('b592aefb-ea4b-41d0-b074-d92d6ecbd3cd'::uuid, 'Alternaria'),     -- Alternaria (same in AF)
  ('576d12b7-e843-4880-9c27-69738495d0fa'::uuid, 'Bakteriese Vlekke'), -- Bacterial Spots
  ('0dfd9f9b-c458-4739-be7b-fafa330e4792'::uuid, 'Bruinvrot'),       -- Brown Rot
  ('255c1105-2ff5-4576-921b-20a4b38a35ba'::uuid, 'Krake'),           -- Cracking
  ('dd9d9a26-28d9-4c99-9cb5-b520a3cf7bda'::uuid, 'Misvorm'),        -- Deformed
  ('4407ec20-f439-4b53-ac8f-7b26fab9ac98'::uuid, 'Fusarium'),       -- Fusarium (same)
  ('c710cbba-a706-492f-9e2c-c4b3f02b7adf'::uuid, 'Fusi'),           -- Fusi
  ('878e7f32-6875-4fa3-9a33-8188f348c058'::uuid, 'Fusi'),           -- Fusi (dupe)
  ('b3c9593c-bdc9-4265-8926-f1d22a1b9d9b'::uuid, 'Hael'),           -- Hail
  ('6017dbde-71a7-4be5-a561-c5da66c45c40'::uuid, 'Poeieragtige Meeldou'), -- Powdery Mildew
  ('3dbc2ca6-e691-4e04-bf8b-1dedaaebc744'::uuid, 'Fytoftora Wortelvrot'), -- Phytophthora Root Rot
  ('df444924-118f-478e-86a0-891289c2fbe9'::uuid, 'Xanthomonas'),    -- Xanthomonas (same)
  ('ee4ed8bb-9e7e-48c9-8c79-a79e6253c02a'::uuid, 'Xanthomonas'),    -- Xanthomonas (dupe)
  ('8992d4b2-481b-4557-a2fc-5627d2326e98'::uuid, 'Cladosporium / Perskesskurfte'), -- Cladosporium / Peach Scab
  ('ec8bb5a5-8152-481e-bdf7-afd495e574c6'::uuid, 'Plukskade'),      -- Picking Injury
  ('c0cbb9be-e7ef-4797-ace3-539ea023cc6c'::uuid, 'Stingelsteek'),   -- Stem Puncture
  ('281ceb6a-cac3-47b8-8b96-77f173327645'::uuid, 'Sag'),            -- Soft

  -- Fruit flies
  ('33d7d3a5-dce4-4f4c-acff-f7c8563db299'::uuid, 'Bactrocera Dorsalis'), -- Bactrocera Dorsalis (scientific)
  ('06c3db93-b453-448e-b8c6-2c6a062b5e0a'::uuid, 'Vrugtevliegskade'),   -- Fruit Fly Damage
  ('0b61361e-43b6-4c2d-ae42-46cb8365e240'::uuid, 'Vrugtevlieg (M)'),     -- FruitFly (M)
  ('f9ea8957-a8fb-4058-b27d-4d115dd9a0f2'::uuid, 'Vrugtevlieg (M&V)'),   -- Fruitfly (M&F)

  -- Moths
  ('70404832-9054-47cd-b516-b314ea8fe133'::uuid, 'Karobmot'),        -- Carob Moth
  ('fa30fbb1-4446-4041-b1ba-d1ef96ad9b16'::uuid, 'Karobmot'),        -- Carrob Moth (typo dupe)
  ('2a587d58-fee2-4dcf-b37d-98cb7023cf9f'::uuid, 'Kodlingmotskade'), -- Codling Moth Damage
  ('ddfb034f-062f-4ebf-b97a-f4f3a3262b9f'::uuid, 'VKM'),             -- FCM
  ('74767072-4086-4b8c-bcff-7b3ffc75df6a'::uuid, 'VKM-skade'),       -- FCM Damage
  ('5b93cff3-1a40-4172-9872-fd3e54414eae'::uuid, 'Suurlemmotmot'),   -- Lemon Moth
  ('2c520c6c-1284-476c-9f98-418f2a03b705'::uuid, 'OVM'),             -- OFM
  ('7832a613-0973-4c22-b1b7-ea2cd096a279'::uuid, 'OVM-skade'),       -- OFM Damage
  ('dceb7059-c800-4bf6-8886-004ee3ff86c6'::uuid, 'Bolwurmmot'),      -- Bolwurm Moth
  ('b0e4d037-253b-4112-9e94-4cdb310a13f1'::uuid, 'Lemoenhondskade'), -- Orange Dog

  -- Bollworm variants
  ('8770de8b-1575-4c0a-bc73-8fdee50cfea6'::uuid, 'Bolwurmskade'),         -- Bollworm Damage
  ('a55d67de-510c-401d-927c-8fe2162c1242'::uuid, 'Bolwurmskade Vrugte'),  -- Bollworm Damage Fruit
  ('84f4e135-4d88-4f0d-977c-9135fbd5b6a6'::uuid, 'Bolwurmskade Lote'),    -- Bollworm Damage Shoots
  ('a2d57c33-bec3-4397-8a7c-0c48a101f5ad'::uuid, 'Bolwurmskade Lote'),    -- Bollworm Damage Shoots (dupe)
  ('1d897565-36e0-4b1b-b91a-613fd777d486'::uuid, 'Bolwurm Eiers'),        -- Bollworm Eggs
  ('1fb212e4-9e1f-42ec-ab1a-1878ddb3c451'::uuid, 'Bolwurm Eiers'),        -- Bollworm Eggs (dupe)
  ('051ba0f1-c284-460b-976b-a5928faab5f4'::uuid, 'Bolwurm Larwes'),       -- Bollworm Larvae
  ('2e01a9bb-40dd-4ed2-86b8-edcd00ca4ecd'::uuid, 'Bolwurm Larwes'),       -- Bollworm Larvae (dupe)

  -- Mites
  ('5c637b19-6bfb-46b6-bbb7-b808b74f6d14'::uuid, 'Sitrus Rooimyt Binne'),    -- Citrus Red Mite Inside
  ('9f54bdee-2085-4943-a39b-1285accccbdd'::uuid, 'Sitrus Rooimyt Buite'),     -- Citrus Red Spider Mite Outside
  ('2703597f-0571-492e-8984-55160581262d'::uuid, 'Bryobia Binne'),            -- Bryobia Inside
  ('40ee367f-62c5-4abf-bb30-a27232d30518'::uuid, 'Bryobia Buite'),            -- Bryobia Outside
  ('f2418f5e-6c2f-44ba-a291-09288f1152f9'::uuid, 'Knopmytskade'),             -- Bud Mite Damage
  ('f4ec3a73-1f1a-4049-a687-29ce1b48e492'::uuid, 'Myt'),                      -- Mite
  ('99bbf7f1-a532-4771-8dce-9f19636bf42c'::uuid, 'Rooi Spinnekop-myt Binne'), -- Red Spider Mite Inside
  ('1d2bbddb-2955-4278-a575-6806f86e3758'::uuid, 'Rooi Spinnekop-myt Buite'), -- Red Spider Mite Outside
  ('9aa6ffc8-e625-432f-8d88-ee929af5702b'::uuid, 'Rooi Spinnekop-myt Buite'), -- Red Spider Mite Outside (dupe)
  ('56eef382-4d71-4eda-ab0c-7a9bf82ad5bc'::uuid, 'Wasdopluis'),               -- Waxy Scale
  ('28d61aba-b0be-4437-b5a5-f8ea4312e3d3'::uuid, 'Roofmyte'),                 -- Predatory Mites

  -- Aphids
  ('e361c25a-dda3-4ab1-8be1-3abf7f53aafb'::uuid, 'Miere'),           -- Ants
  ('a68d70d7-fdd3-4f63-8f7c-70355d3b035f'::uuid, 'Plantluise'),      -- Aphids
  ('8aa5a74f-c65d-436c-83c2-14ab1ff979b1'::uuid, 'Appel Bloedluis'),  -- Apple Woolly Aphid
  ('49677cc3-9c94-4c04-ad65-67fb32c57378'::uuid, 'Bloedluis'),       -- Blood Louse
  ('2e0fd9e5-a869-44f7-a71b-fcf8278356dd'::uuid, 'Bloedluis Parasiet'), -- Woolly Aphid Apple Parasite

  -- Scale
  ('aad71426-9f4a-4e8a-9d46-283749cda7ac'::uuid, 'San Jose Dopluis'),  -- Pernicious Scale
  ('b8fb9117-ca93-44f9-9506-978f6f1feefd'::uuid, 'Dopluis'),          -- Scale Insect
  ('e213692c-3410-4573-b35f-104ad38c9376'::uuid, 'Cochenille'),       -- Cochineal

  -- Thrips
  ('450691f9-0d66-4a66-8630-eadfd3cbf2a1'::uuid, 'Sitrusblaaspootjie'), -- Citrus Thrips
  ('0bdacc55-3225-4e76-9836-c3c0d8c6b51f'::uuid, 'Blaaspootjieskade'), -- Thrips Damage
  ('e323b0e5-c567-44c4-b153-b444d20ebee5'::uuid, 'Blaaspootjieskade'), -- Thrips Damage (dupe)

  -- Beetles / Weevils
  ('6b05ff97-2d4c-4ab2-af35-21ee100aaf07'::uuid, 'Fullers Roosbesie'),     -- Fullers Rose Beetle
  ('b03ca49f-ad41-4069-91cd-33147eb14591'::uuid, 'Kalander-skade'),        -- Weevil Damage
  ('eb28afdb-506c-491b-a17b-9fd4ddecde92'::uuid, 'Kalander-skade Vrugte'), -- Weevil Damage Fruit
  ('8d0f6a1a-f291-41ce-8e7c-dcb945ed6f28'::uuid, 'Kalander-skade Blaar'),  -- Weevil Damage Leaf
  ('1c9eafde-1923-4ee9-ae60-367883c12930'::uuid, 'Snuitkewer Bo'),        -- Snoutbeatle Bo (already mixed AF)
  ('05ec1c26-0fc5-4cf7-ab32-836e389b1c06'::uuid, 'Snuitkewer Onder'),     -- Snoutbeatle Onder

  -- Other insects
  ('89d69cb8-86a6-4f83-b613-27b2ceb96a4e'::uuid, 'Sitrus Bladvlooi'),  -- Citrus Psylla
  ('0373f0a3-52b7-4775-bd70-677efab6b4b8'::uuid, 'Bladvlooi'),         -- Psyllid
  ('2e5ad512-040d-483d-8f28-d947966b18a3'::uuid, 'Bladspringer'),      -- Leaf Hopper
  ('7a6db201-0cc8-4865-bb9b-1f6389e4ea80'::uuid, 'Blare/Vrugknoppies'), -- Leaves/Fruitbuds
  ('031f218d-b062-4f94-8f1b-c62faadaf63f'::uuid, 'Witluis Parasiete'),  -- Mealybug Parasites
  ('a7a75d3c-7605-4a2f-9458-9eaa3c6d5203'::uuid, 'Witluis Roofinsek'), -- Mealybug Predator
  ('d9ba9be6-867c-4b80-8612-21df1a856707'::uuid, 'Slak'),              -- Snail
  ('bb24214d-223a-4e0a-bdf2-88aecce2954b'::uuid, 'Slakke'),            -- Snails
  ('31f91aa7-9887-42bf-ba22-183b6553a259'::uuid, 'Stinkbesie'),        -- Stink Bug
  ('5a5fce3a-2b34-4d21-9ec0-9fe732abd7af'::uuid, 'Witvlieg'),         -- White Fly
  ('caf7f7c8-7a2f-45e0-b9d3-f15d36162180'::uuid, 'Witluis'),          -- White Louse
  ('343728de-a162-4acd-9ab6-046575a9560b'::uuid, 'Mytskade')           -- Mite Damage
) AS v(id, name_af)
WHERE public.pests.id = v.id
  AND (public.pests.name_af IS NULL OR public.pests.name_af = '');

-- Now populate commodity_pests.display_name_af from pests.name_af
-- for any rows that don't have it set yet
UPDATE public.commodity_pests cp
SET display_name_af = p.name_af
FROM public.pests p
WHERE cp.pest_id = p.id
  AND p.name_af IS NOT NULL
  AND p.name_af != ''
  AND (cp.display_name_af IS NULL OR cp.display_name_af = '');

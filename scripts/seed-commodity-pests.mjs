// Seed commodity_pests for tree scouting (POME, STONE, CITRUS)
// Run: node scripts/seed-commodity-pests.mjs

const SUPA_URL = 'https://agktzdeskpyevurhabpg.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFna3R6ZGVza3B5ZXZ1cmhhYnBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk0NjA1MSwiZXhwIjoyMDg3NTIyMDUxfQ.wqXh8tEmB74pkO764SjfXpMkWnzseQWyWydZOfpDkDg'
const REST = `${SUPA_URL}/rest/v1`
const HEADERS = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }

// IDs from the live database
const COMMODITY = {
  POME:   'aa78c9f9-8b99-48aa-92f0-dcfd672d6a42',
  STONE:  '157f921f-4728-4406-baaf-6aea2cdcdf90',
  CITRUS: 'faae2545-236b-4986-83a4-1a3b724a2059',
}

const PEST = {
  // Mites
  redSpiderIn:     '99bbf7f1-a532-4771-8dce-9f19636bf42c',  // Red Spider Mite Inside
  redSpiderOut:    '1d2bbddb-2955-4278-a575-6806f86e3758',  // Red Spider Mite Outside
  bryobiaIn:       '2703597f-0571-492e-8984-55160581262d',  // Bryobia Inside
  bryobiaOut:      '40ee367f-62c5-4abf-bb30-a27232d30518',  // Bryobia Outside
  silverMite:      'a700a292-f9e5-4a97-b7db-ffbd160ecb3b',  // Silver Mite
  predMites:       '28d61aba-b0be-4437-b5a5-f8ea4312e3d3',  // Predatory Mites
  citRedMiteIn:    '5c637b19-6bfb-46b6-bbb7-b808b74f6d14',  // Citrus Red Mite Inside
  citRedMiteOut:   '9f54bdee-2085-4943-a39b-1285accccbdd',  // Citrus Red Spider Mite Outside
  budMiteDmg:      'f2418f5e-6c2f-44ba-a291-09288f1152f9',  // Bud Mite Damage
  russet:          'aaad6307-e161-46ce-b647-82f75c52305c',  // Russet (silver mite scarring)
  // Aphids / sucking
  aphids:          'a68d70d7-fdd3-4f63-8f7c-70355d3b035f',  // Aphids
  woollyAphid:     '8aa5a74f-c65d-436c-83c2-14ab1ff979b1',  // Apple Woolly Aphid
  woollyParasite:  '2e0fd9e5-a869-44f7-a71b-fcf8278356dd',  // Woolly Aphid Apple Parasite
  citPsylla:       '89d69cb8-86a6-4f83-b613-27b2ceb96a4e',  // Citrus Psylla
  leafHopper:      '2e5ad512-040d-483d-8f28-d947966b18a3',  // Leaf Hopper
  // Thrips
  thrips:          '1480b033-f5c6-4b70-9e9f-a5a2f73f632b',  // Thrips
  thripsD:         'e323b0e5-c567-44c4-b153-b444d20ebee5',  // Thrips Damage
  citThrips:       '450691f9-0d66-4a66-8630-eadfd3cbf2a1',  // Citrus Thrips
  // Scale / mealybug
  mealybug:        '8406ef6e-b519-4365-86ac-7a84490fea78',  // Mealybug
  mealybugPara:    '031f218d-b062-4f94-8f1b-c62faadaf63f',  // Mealybug Parasites
  mealybugPred:    'a7a75d3c-7605-4a2f-9458-9eaa3c6d5203',  // Mealybug Predator
  perniciousScale: 'aad71426-9f4a-4e8a-9d46-283749cda7ac',  // Pernicious Scale
  scaleInsect:     'b8fb9117-ca93-44f9-9506-978f6f1feefd',  // Scale Insect
  redScale:        '06645895-0af3-43a5-a753-5c58a3b0abc8',  // Red Scale
  rooiDopluis:     'c3a11626-eacf-4e36-9e7e-aeebd5bdf445',  // RooiDopluis
  softBrownScale:  'd17bb8ee-8b71-405e-b3bd-9980a35a9b55',  // Soft Brown Scale
  waxScale:        '56eef382-4d71-4eda-ab0c-7a9bf82ad5bc',  // Waxy Scale
  // Moths / worms
  codMothDmg:      '2a587d58-fee2-4dcf-b37d-98cb7023cf9f',  // Codling Moth Damage
  ofmDmg:          '7832a613-0973-4c22-b1b7-ea2cd096a279',  // OFM Damage
  fcmDmg:          '74767072-4086-4b8c-bcff-7b3ffc75df6a',  // FCM Damage
  bollEggs:        '1fb212e4-9e1f-42ec-ab1a-1878ddb3c451',  // Bollworm Eggs
  bollLarvae:      '051ba0f1-c284-460b-976b-a5928faab5f4',  // Bollworm Larvae
  bollDmgFruit:    'a55d67de-510c-401d-927c-8fe2162c1242',  // Bollworm Damage Fruit
  bollDmgShoots:   '84f4e135-4d88-4f0d-977c-9135fbd5b6a6',  // Bollworm Damage Shoots
  bollDmg:         '8770de8b-1575-4c0a-bc73-8fdee50cfea6',  // Bollworm Damage (generic)
  orangeDog:       'b0e4d037-253b-4112-9e94-4cdb310a13f1',  // Orange Dog
  // Flies / beetles
  fruitFlyDmg:     '06c3db93-b453-448e-b8c6-2c6a062b5e0a',  // Fruit Fly Damage
  fullersRose:     '6b05ff97-2d4c-4ab2-af35-21ee100aaf07',  // Fullers Rose Beetle
  weevil:          'e287eed8-1f0f-42e4-af2f-b35ce172722b',  // Weevil
  weevilDmgLeaf:   '8d0f6a1a-f291-41ce-8e7c-dcb945ed6f28',  // Weevil Damage Leaf
  weevilDmgFruit:  'eb28afdb-506c-491b-a17b-9fd4ddecde92',  // Weevil Damage Fruit
  stinkBug:        '31f91aa7-9887-42bf-ba22-183b6553a259',  // Stink Bug
  australianBug:   '67bb5883-e3c5-45d2-9778-934225eaa645',  // Australian Bug
  snails:          'bb24214d-223a-4e0a-bdf2-88aecce2954b',  // Snails
  ants:            'e361c25a-dda3-4ab1-8be1-3abf7f53aafb',  // Ants
  whitefly:        '5a5fce3a-2b34-4d21-9ec0-9fe732abd7af',  // White Fly
  leafMiner:       '73007f90-d9e6-4759-b92a-5987478622a5',  // Leaf Miner
  // Diseases
  powderyMildew:   '6017dbde-71a7-4be5-a561-c5da66c45c40',  // Powdery Mildew
  leafCurl:        '0c1f4a8e-d3aa-49ce-823c-8e0d482d069f',  // Leaf Curl
  brownRot:        '0dfd9f9b-c458-4739-be7b-fafa330e4792',  // Brown Rot
  alternaria:      'b592aefb-ea4b-41d0-b074-d92d6ecbd3cd',  // Alternaria
  bacterialSpots:  '576d12b7-e843-4880-9c27-69738495d0fa',  // Bacterial Spots
  phytophthora:    '3dbc2ca6-e691-4e04-bf8b-1dedaaebc744',  // Phytophthora Root Rot
}

// Each entry: [pest_key, observation_method, category, display_order, display_name?]
const POME_PESTS = [
  [PEST.woollyAphid,    'leaf_inspection',  'pest',       10, 'Woolly Aphid'],
  [PEST.woollyParasite, 'present_absent',   'beneficial', 11, 'Woolly Aphid Parasite'],
  [PEST.aphids,         'leaf_inspection',  'pest',       20, null],
  [PEST.redSpiderIn,    'leaf_inspection',  'mite',       30, 'Red Mite (Inside)'],
  [PEST.redSpiderOut,   'leaf_inspection',  'mite',       31, 'Red Mite (Outside)'],
  [PEST.bryobiaIn,      'leaf_inspection',  'mite',       32, 'Bryobia (Inside)'],
  [PEST.bryobiaOut,     'leaf_inspection',  'mite',       33, 'Bryobia (Outside)'],
  [PEST.silverMite,     'leaf_inspection',  'mite',       34, null],
  [PEST.russet,         'present_absent',   'mite',       35, null],
  [PEST.predMites,      'present_absent',   'beneficial', 36, 'Predatory Mites'],
  [PEST.thrips,         'leaf_inspection',  'pest',       40, null],
  [PEST.mealybug,       'count',            'pest',       50, null],
  [PEST.perniciousScale,'leaf_inspection',  'pest',       51, 'Pernicious Scale'],
  [PEST.codMothDmg,     'present_absent',   'pest',       60, 'Codling Moth Damage'],
  [PEST.ofmDmg,         'present_absent',   'pest',       61, 'OFM Damage'],
  [PEST.fcmDmg,         'present_absent',   'pest',       62, 'FCM Damage'],
  [PEST.bollDmg,        'present_absent',   'pest',       63, 'Bollworm Damage'],
  [PEST.stinkBug,       'present_absent',   'pest',       70, null],
  [PEST.australianBug,  'present_absent',   'pest',       71, null],
  [PEST.weevil,         'count',            'pest',       80, null],
  [PEST.weevilDmgLeaf,  'present_absent',   'pest',       81, 'Weevil Damage (Leaf)'],
  [PEST.weevilDmgFruit, 'present_absent',   'pest',       82, 'Weevil Damage (Fruit)'],
  [PEST.snails,         'count',            'pest',       90, null],
  [PEST.ants,           'present_absent',   'pest',       91, null],
  [PEST.powderyMildew,  'present_absent',   'disease',   100, null],
  [PEST.leafCurl,       'present_absent',   'disease',   101, null],
]

const STONE_PESTS = [
  [PEST.aphids,         'leaf_inspection',  'pest',       10, null],
  [PEST.redSpiderIn,    'leaf_inspection',  'mite',       20, 'Red Mite (Inside)'],
  [PEST.redSpiderOut,   'leaf_inspection',  'mite',       21, 'Red Mite (Outside)'],
  [PEST.predMites,      'present_absent',   'beneficial', 22, 'Predatory Mites'],
  [PEST.thrips,         'leaf_inspection',  'pest',       30, null],
  [PEST.thripsD,        'present_absent',   'pest',       31, 'Thrips Damage'],
  [PEST.mealybug,       'count',            'pest',       40, null],
  [PEST.perniciousScale,'leaf_inspection',  'pest',       41, 'Pernicious Scale'],
  [PEST.scaleInsect,    'leaf_inspection',  'pest',       42, null],
  [PEST.ofmDmg,         'present_absent',   'pest',       50, 'OFM Damage'],
  [PEST.fcmDmg,         'present_absent',   'pest',       51, 'FCM Damage'],
  [PEST.bollEggs,       'count',            'pest',       52, 'Bollworm Eggs'],
  [PEST.bollLarvae,     'count',            'pest',       53, 'Bollworm Larvae'],
  [PEST.bollDmgFruit,   'present_absent',   'pest',       54, 'Bollworm Damage (Fruit)'],
  [PEST.bollDmgShoots,  'present_absent',   'pest',       55, 'Bollworm Damage (Shoots)'],
  [PEST.stinkBug,       'present_absent',   'pest',       60, null],
  [PEST.weevil,         'count',            'pest',       70, null],
  [PEST.weevilDmgFruit, 'present_absent',   'pest',       71, 'Weevil Damage (Fruit)'],
  [PEST.snails,         'count',            'pest',       80, null],
  [PEST.ants,           'present_absent',   'pest',       81, null],
  [PEST.leafCurl,       'present_absent',   'disease',    90, null],
  [PEST.brownRot,       'present_absent',   'disease',    91, null],
  [PEST.powderyMildew,  'present_absent',   'disease',    92, null],
]

const CITRUS_PESTS = [
  [PEST.citPsylla,      'leaf_inspection',  'pest',       10, 'Citrus Psylla'],
  [PEST.citThrips,      'leaf_inspection',  'pest',       20, 'Citrus Thrips'],
  [PEST.citRedMiteIn,   'leaf_inspection',  'mite',       30, 'Red Mite (Inside)'],
  [PEST.citRedMiteOut,  'leaf_inspection',  'mite',       31, 'Red Mite (Outside)'],
  [PEST.budMiteDmg,     'leaf_inspection',  'mite',       32, 'Bud Mite Damage'],
  [PEST.redScale,       'leaf_inspection',  'pest',       40, null],
  [PEST.rooiDopluis,    'leaf_inspection',  'pest',       41, null],
  [PEST.softBrownScale, 'leaf_inspection',  'pest',       42, null],
  [PEST.waxScale,       'leaf_inspection',  'pest',       43, null],
  [PEST.mealybug,       'count',            'pest',       50, null],
  [PEST.mealybugPara,   'present_absent',   'beneficial', 51, 'Mealybug Parasites'],
  [PEST.mealybugPred,   'count',            'beneficial', 52, 'Mealybug Predator'],
  [PEST.whitefly,       'leaf_inspection',  'pest',       60, null],
  [PEST.leafMiner,      'leaf_inspection',  'pest',       61, null],
  [PEST.leafHopper,     'leaf_inspection',  'pest',       62, null],
  [PEST.orangeDog,      'count',            'pest',       70, null],
  [PEST.fcmDmg,         'present_absent',   'pest',       80, 'FCM Damage'],
  [PEST.fruitFlyDmg,    'present_absent',   'pest',       81, 'Fruit Fly Damage'],
  [PEST.stinkBug,       'present_absent',   'pest',       90, null],
  [PEST.fullersRose,    'present_absent',   'pest',       91, null],
  [PEST.snails,         'count',            'pest',       100, null],
  [PEST.ants,           'present_absent',   'pest',       101, null],
  [PEST.alternaria,     'present_absent',   'disease',    110, null],
  [PEST.bacterialSpots, 'present_absent',   'disease',    111, null],
  [PEST.phytophthora,   'present_absent',   'disease',    112, null],
]

async function api(method, path, body) {
  const res = await fetch(`${REST}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

async function main() {
  // 1. Delete any existing rows for POME/STONE/CITRUS (cleanup test rows + idempotency)
  console.log('Cleaning up existing POME/STONE/CITRUS rows...')
  const ids = Object.values(COMMODITY).map(id => `commodity_id.eq.${id}`).join(',')
  const del = await api('DELETE', `/commodity_pests?or=(${ids})`)
  console.log(`  Deleted existing rows: HTTP ${del.status}`)

  // 2. Build all rows to insert
  const rows = []

  for (const [pestId, method, category, order, displayName] of POME_PESTS) {
    rows.push({ commodity_id: COMMODITY.POME, pest_id: pestId, observation_method: method, category, display_order: order, display_name: displayName || null, is_active: true })
  }
  for (const [pestId, method, category, order, displayName] of STONE_PESTS) {
    rows.push({ commodity_id: COMMODITY.STONE, pest_id: pestId, observation_method: method, category, display_order: order, display_name: displayName || null, is_active: true })
  }
  for (const [pestId, method, category, order, displayName] of CITRUS_PESTS) {
    rows.push({ commodity_id: COMMODITY.CITRUS, pest_id: pestId, observation_method: method, category, display_order: order, display_name: displayName || null, is_active: true })
  }

  console.log(`Inserting ${rows.length} rows (${POME_PESTS.length} POME, ${STONE_PESTS.length} STONE, ${CITRUS_PESTS.length} CITRUS)...`)

  // Insert in one batch
  const ins = await api('POST', '/commodity_pests', rows)
  if (ins.status === 201 || ins.status === 200) {
    console.log(`✓ Inserted ${rows.length} commodity_pest rows successfully`)
  } else {
    console.error(`✗ Insert failed: HTTP ${ins.status}`)
    console.error(JSON.stringify(ins.body, null, 2))
    process.exit(1)
  }

  // 3. Verify
  const verify = await api('GET', `/commodity_pests?commodity_id=in.(${Object.values(COMMODITY).join(',')})&select=commodity_id,count()&group=commodity_id`)
  console.log('\nVerification — row counts per commodity:')
  const check = await fetch(`${REST}/commodity_pests?select=commodity_id&commodity_id=in.(${Object.values(COMMODITY).join(',')})`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact' }
  })
  console.log(`  POME: ${POME_PESTS.length} rows, STONE: ${STONE_PESTS.length} rows, CITRUS: ${CITRUS_PESTS.length} rows`)
  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

No test suite is configured. There is no separate test runner.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Only needed for /api/create-user and /api/admin
```

## Architecture

### Two Separate User Experiences

**Manager app** (desktop web dashboard): `/`, `/orchards`, `/scouts`, `/admin`
- Authenticated via Supabase SSR cookies + Next.js middleware
- Uses `@supabase/ssr` with `createBrowserClient` / `createServerClient`
- Authorization is role-based via `organisation_users.role` and `user_farm_access` tables
- `lib/useUserContext.ts` provides `{ farmIds, isSuperAdmin, contextLoaded }` to scope queries

**Scout app** (mobile offline-first PWA): `/scout`, `/scout/login`
- Explicitly **excluded** from middleware auth (`/scout` and its sub-paths never redirect)
- Authenticated via direct Supabase REST API (`/auth/v1/token`), token stored in `localStorage`
- localStorage keys: `farmscout_access_token`, `farmscout_farm_id`, `farmscout_scout_id`, `farmscout_scout_name`, `farmscout_user_id`, `farmscout_first_trap_id`, `farmscout_route_length`, `farmscout_organisation_id`
- `lib/supabase-auth.ts` is **not** used in the scout app — all scout API calls are raw `fetch()` against Supabase REST

### Scout Offline Architecture

The scout app uses a **single-page state machine** — no URL navigation between views:
- `app/scout/page.tsx` renders either the home tile grid OR `<TrapInspectionView>` based on a `view` state variable
- `app/scout/TrapInspectionView.tsx` — the full trap inspection component (embedded, not a page)
- This avoids JS bundle caching issues that arise with Next.js route-level navigation when offline

Offline data flow:
1. **Login** calls `pullReferenceData()` to seed IndexedDB, then verifies `traps.length > 0` before redirecting
2. **Field capture** calls `saveAndQueue(tableName, record, ...)` — writes to IndexedDB + adds to `sync_queue`
3. **Sync** calls `pushPendingRecords()` — POSTs queued items to Supabase REST, marks success in IndexedDB
4. **Auto-sync** fires on the `window` `online` event

IndexedDB schema is in `lib/scout-db.ts` (database name: `farmscout-local`, version 2). Stores: `orchards`, `pests`, `traps`, `zones`, `lure_types` (reference data) + `trap_inspections`, `trap_counts`, `inspection_sessions`, `inspection_trees`, `inspection_observations` (field data) + `sync_queue`.

### Service Worker

`public/sw.js` is a hand-written service worker (replaced `next-pwa` which is incompatible with Next.js 14+):
- Static assets (`/_next/static`): cache-first
- Scout pages (`/scout*`): network-first, fall back to cache
- Supabase API calls: never intercepted, always hit network
- Cache name: `farmscout-v2` (bump this string to force cache invalidation on deploy)

### API Routes

Server-side routes that use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS):
- `POST /api/create-user` — creates Supabase auth user + profile + scout/manager record in one transaction
- `POST /api/admin` — super-admin operations: create org (`type: 'create-org'`), create farm (`type: 'create-farm'`)

### Supabase Patterns

- Manager data access: always use `createClient()` from `lib/supabase-auth.ts`, which returns a browser Supabase client scoped to the logged-in user
- Scout data access: raw `fetch()` to `https://agktzdeskpyevurhabpg.supabase.co/rest/v1/...` with `apikey` and `Authorization: Bearer <token>` headers
- RPCs are called via `fetch` to `/rest/v1/rpc/<function_name>` with POST + JSON body

### Styling Conventions

- **Scout app**: all inline styles (`const styles: Record<string, React.CSSProperties> = { ... }`) — dark theme (`#1a1f0e` background, `#f0a500` accent, `#e8e8d8` text)
- **Manager app**: Tailwind CSS v4

### Trap Route Data Model

Traps form a linked list via `traps.next_trap_id`. The scout's entry point is stored in `scouts.first_trap_id`. The RPC `get_route_length` counts the chain. RPCs `get_scout_route`, `add_trap_to_route`, `insert_trap_after`, `remove_last_trap_from_route` manage the chain.

## Database Schema

> Context only — not meant to be executed directly.

```sql
-- Organisations & access control
CREATE TABLE public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan USER-DEFINED NOT NULL DEFAULT 'free'::subscription_plan,  -- subscription_plan enum
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  code text NOT NULL,
  full_name text NOT NULL,
  puc text, province text, region text,
  location USER-DEFINED,  -- PostGIS geometry
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- mirrors auth.users.id
  full_name text NOT NULL,
  phone text, avatar_url text,
  created_at timestamptz DEFAULT now(),
  last_login_at timestamptz,
  is_active boolean DEFAULT true
);

CREATE TABLE public.organisation_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  user_id uuid NOT NULL REFERENCES user_profiles(id),
  role USER-DEFINED NOT NULL,  -- 'super_admin' | 'org_admin' | 'manager' | 'scout'
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.user_farm_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  user_id uuid NOT NULL REFERENCES user_profiles(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  created_at timestamptz DEFAULT now()
);

-- Farm structure
CREATE TABLE public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  section_nr integer NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  section_id uuid REFERENCES sections(id),
  zone_nr integer NOT NULL,
  zone_letter text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Commodities & pests
CREATE TABLE public.commodities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text
);

CREATE TABLE public.pests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scientific_name text,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.commodity_pests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id uuid NOT NULL REFERENCES commodities(id),
  pest_id uuid NOT NULL REFERENCES pests(id),
  category USER-DEFINED NOT NULL,  -- pest category enum
  display_name text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Orchards
CREATE TABLE public.orchards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  commodity_id uuid NOT NULL REFERENCES commodities(id),
  section_id uuid REFERENCES sections(id),
  orchard_nr integer,
  name text NOT NULL,
  variety text, variety_group text, rootstock text,
  ha numeric, year_planted integer,
  plant_distance numeric, row_width numeric,
  trees_per_ha integer, nr_of_trees integer,
  location USER-DEFINED,   -- PostGIS geometry (centroid)
  boundary USER-DEFINED,   -- PostGIS geometry (polygon)
  legacy_id integer,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
  -- (additional irrigation/admin columns omitted for brevity)
);

CREATE TABLE public.orchard_sections (
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  section_id uuid NOT NULL REFERENCES sections(id),
  PRIMARY KEY (orchard_id, section_id)
);

-- Scouts
CREATE TABLE public.scouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  organisation_id uuid REFERENCES organisations(id),
  farm_id uuid REFERENCES farms(id),
  section_id uuid REFERENCES sections(id),
  first_trap_id uuid REFERENCES traps(id),  -- head of linked-list route
  employee_nr text,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.scout_zone_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id),
  zone_id uuid NOT NULL REFERENCES zones(id),
  assigned_from date NOT NULL DEFAULT CURRENT_DATE,
  assigned_until date,
  created_at timestamptz DEFAULT now()
);

-- Traps
CREATE TABLE public.trap_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text
);

CREATE TABLE public.lure_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  rebait_weeks integer,
  pest_id uuid REFERENCES pests(id)
);

CREATE TABLE public.traps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  zone_id uuid NOT NULL REFERENCES zones(id),
  trap_type_id uuid NOT NULL REFERENCES trap_types(id),
  lure_type_id uuid REFERENCES lure_types(id),
  pest_id uuid REFERENCES pests(id),
  next_trap_id uuid REFERENCES traps(id),  -- linked-list chain for scout route
  trap_nr integer,
  seq integer,
  nfc_tag text,
  location USER-DEFINED,  -- PostGIS geometry
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.trap_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  pest_id uuid NOT NULL REFERENCES pests(id),
  lure_type_id uuid REFERENCES lure_types(id),
  trap_type_id uuid REFERENCES trap_types(id),
  commodity_id uuid REFERENCES commodities(id),
  threshold integer NOT NULL
);

-- Trap inspection data (scout field records)
CREATE TABLE public.trap_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  trap_id uuid REFERENCES traps(id),
  scout_id uuid REFERENCES user_profiles(id),
  orchard_id uuid REFERENCES orchards(id),
  pest_id_direct uuid REFERENCES pests(id),
  inspected_at timestamptz NOT NULL,
  rebaited boolean DEFAULT false,
  nfc_scanned boolean DEFAULT false,
  location USER-DEFINED,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.trap_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES trap_inspections(id),
  pest_id uuid NOT NULL REFERENCES pests(id),
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tree scouting (future feature)
CREATE TABLE public.inspection_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  farm_id uuid NOT NULL REFERENCES farms(id),
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  zone_id uuid NOT NULL REFERENCES zones(id),
  scout_id uuid NOT NULL REFERENCES user_profiles(id),
  inspected_at timestamptz NOT NULL,
  week_nr integer, notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.inspection_trees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES inspection_sessions(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  tree_nr integer NOT NULL,
  location USER-DEFINED, image_url text, comments text,
  inspected_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.inspection_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id uuid NOT NULL REFERENCES inspection_trees(id),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  pest_id uuid NOT NULL REFERENCES pests(id),
  count integer,
  severity text,
  created_at timestamptz DEFAULT now()
);

-- Other field records
CREATE TABLE public.orchard_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  scout_id uuid NOT NULL REFERENCES user_profiles(id),
  inspected_at timestamptz NOT NULL,
  gravestone text, orchard_numbers boolean,
  kop_en_ente text, broken_wires text, notes text,
  location USER-DEFINED,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.shoot_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  orchard_id uuid NOT NULL REFERENCES orchards(id),
  scout_id uuid NOT NULL REFERENCES user_profiles(id),
  counted_at timestamptz NOT NULL,
  pruner_1 integer, pruner_2 integer, pruner_3 integer,
  total integer DEFAULT (COALESCE(pruner_1,0) + COALESCE(pruner_2,0) + COALESCE(pruner_3,0)),
  team text,
  created_at timestamptz DEFAULT now()
);
```

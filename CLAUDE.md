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

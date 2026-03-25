/**
 * Page-level access control: section definitions, role defaults, and helpers.
 *
 * `allowed_pages` on organisation_users is a nullable JSONB column:
 *   - NULL  → use ROLE_DEFAULT_SECTIONS for the user's role
 *   - []    → no sections (external roles fall back to dashboard only)
 *   - ["/orchards", "/pests", …] → explicit section keys
 */

// ── Section definitions ─────────────────────────────────────────────────────

export interface PageSection {
  key: string        // stored in allowed_pages array
  label: string      // admin UI label
  routes: string[]   // route prefixes that belong to this section
  module?: string    // org must have this module enabled (e.g. 'qc')
}

export const PAGE_SECTIONS: PageSection[] = [
  { key: 'dashboard',   label: 'Dashboard',            routes: ['/'] },
  { key: 'orchards',    label: 'Orchards & Analysis',   routes: ['/orchards', '/applicators'] },
  { key: 'pests',       label: 'Pests & Traps',        routes: ['/pests', '/traps', '/trap-inspections', '/heatmap'] },
  { key: 'inspections', label: 'Tree Inspections',      routes: ['/inspections'] },
  { key: 'scouts',      label: 'Scout Management',      routes: ['/scouts'] },
  { key: 'settings',    label: 'Settings',              routes: ['/settings'] },
  { key: 'qc',          label: 'QC',                    routes: ['/qc'], module: 'qc' },
  { key: 'production',  label: 'Production',            routes: ['/production', '/receivers'], module: 'production' },
  { key: 'irrigation',  label: 'Irrigation',            routes: ['/irrigation'], module: 'irrigation' },
  { key: 'rainfall',    label: 'Rainfall',              routes: ['/rainfall'], module: 'rainfall' },
  { key: 'hr',          label: 'HR',                     routes: ['/hr'], module: 'hr' },
  { key: 'packshed',    label: 'Packshed',               routes: ['/packshed'], module: 'packshed' },
  { key: 'admin',       label: 'Admin',                 routes: ['/admin'] },
]

// ── Role defaults ───────────────────────────────────────────────────────────
// '*' = all sections; string[] = specific section keys; [] = none (must be assigned)

const ROLE_DEFAULT_SECTIONS: Record<string, string[] | '*'> = {
  super_admin:              '*',
  org_admin:                '*',
  farm_manager:             ['dashboard', 'orchards', 'pests', 'inspections', 'scouts', 'settings', 'hr'],
  production_manager:       ['dashboard', 'orchards', 'production', 'settings'],
  manager:                  ['dashboard', 'orchards', 'pests', 'inspections', 'scouts', 'settings', 'hr'],
  crop_protection_advisor:  [],
  horticultural_consultant: [],
}

/** Roles where the admin must explicitly tick sections (no defaults). */
export const EXTERNAL_ROLES = ['crop_protection_advisor', 'horticultural_consultant']

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Given a role + optional allowed_pages override + org modules, return the
 * flat array of route prefixes the user may access.
 */
export function resolveAllowedRoutes(
  role: string | null,
  allowedPages: string[] | null,
  orgModules: string[] = ['farmscout'],
): string[] {
  const sectionKeys = resolveAllowedSections(role, allowedPages)

  // Always include dashboard
  const keys = sectionKeys.includes('dashboard') ? sectionKeys : ['dashboard', ...sectionKeys]

  const routes: string[] = []
  for (const section of PAGE_SECTIONS) {
    if (!keys.includes(section.key)) continue
    // Skip module-gated sections the org doesn't have
    if (section.module && !orgModules.includes(section.module)) continue
    routes.push(...section.routes)
  }

  return routes
}

/**
 * Return the section keys the user is allowed to access.
 * Used for sidebar filtering and the admin UI checkboxes.
 */
export function resolveAllowedSections(
  role: string | null,
  allowedPages: string[] | null,
): string[] {
  if (!role) return ['dashboard']

  // Explicit override stored on the user
  if (allowedPages !== null && allowedPages !== undefined) {
    return allowedPages.length > 0 ? allowedPages : ['dashboard']
  }

  // Role defaults
  const defaults = ROLE_DEFAULT_SECTIONS[role]
  if (defaults === '*') return PAGE_SECTIONS.map(s => s.key)
  if (defaults && defaults.length > 0) return defaults

  // Unknown role or external role with no override → dashboard only
  return ['dashboard']
}

/**
 * Check whether a given pathname is allowed by the resolved route prefixes.
 */
export function canAccessRoute(pathname: string, allowedRoutes: string[]): boolean {
  // Dashboard exact match
  if (pathname === '/' && allowedRoutes.includes('/')) return true

  for (const prefix of allowedRoutes) {
    if (prefix === '/') continue // already handled above
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true
  }

  return false
}

/**
 * Return the default section keys for a role (for admin UI pre-checking).
 */
export function getDefaultSectionsForRole(role: string): string[] {
  const defaults = ROLE_DEFAULT_SECTIONS[role]
  if (defaults === '*') return PAGE_SECTIONS.map(s => s.key)
  if (Array.isArray(defaults)) return defaults
  return []
}

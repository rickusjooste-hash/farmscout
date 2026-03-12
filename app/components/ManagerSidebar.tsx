'use client'

import { usePathname } from 'next/navigation'

interface ManagerSidebarProps {
  isSuperAdmin?: boolean
  modules?: string[]
  allowedRoutes?: string[]
  onLogout?: () => void
}

/* ── Inline SVG icon components (22×22, stroke-based, 2px weight) ── */

function DashboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function TreeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V13" />
      <path d="M12 13C12 13 6 13 6 8c0-3.3 2.7-6 6-6s6 2.7 6 6c0 5-6 5-6 5z" />
    </svg>
  )
}

function AnalysisIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20h18" />
      <path d="M7 20V10" />
      <path d="M12 20V4" />
      <path d="M17 20V14" />
    </svg>
  )
}

function LeafIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 019.8 6.9C15.5 4.9 20 2 20 2s-1.7 5.3-4 9.8A7 7 0 0111 20z" />
      <path d="M10.7 10.7c3.1-3.1 5.8-4.4 5.8-4.4s-1.3 2.7-4.4 5.8" />
    </svg>
  )
}

function BugIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.88 1.88" />
      <path d="M14.12 3.88L16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 116 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function PersonPlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function ClipboardCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function ListSettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

function RulerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.41 2.41 0 010-3.4l2.6-2.6a2.41 2.41 0 013.4 0z" />
      <line x1="14.5" y1="12.5" x2="11" y2="16" />
      <line x1="11.5" y1="9.5" x2="8" y2="13" />
      <line x1="8.5" y1="6.5" x2="5" y2="10" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function UserCircleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662V19a2 2 0 012-2h6a2 2 0 012 2v1.662" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  )
}

function PackageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v17" />
      <path d="M5 10l7-7 7 7" />
      <rect x="4" y="14" width="16" height="6" rx="2" />
    </svg>
  )
}

/* ── allFarm Logo SVG ── */
function AllFarmLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="8" fill="#fff" fillOpacity="0.15" />
      <path d="M18 6L8 12v12l10 6 10-6V12L18 6z" stroke="#fff" strokeWidth="2" fill="none" />
      <path d="M18 6v24" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.5" />
      <path d="M8 12l10 6 10-6" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.5" />
      <circle cx="18" cy="18" r="3" fill="#fff" fillOpacity="0.9" />
    </svg>
  )
}

/**
 * Shared sidebar for all manager pages.
 * Shows FarmScout nav items always, QC section only when org has 'qc' module.
 * Uses CSS classes (.ms-sidebar, .ms-nav-item, etc.) — embed <ManagerSidebarStyles /> once per page.
 */
export default function ManagerSidebar({ isSuperAdmin, modules = ['farmscout'], allowedRoutes, onLogout }: ManagerSidebarProps) {
  const pathname = usePathname()
  const hasQc = modules.includes('qc')
  const hasProduction = modules.includes('production')

  function cls(href: string) {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return `ms-nav-item${active ? ' active' : ''}`
  }

  /** Hide links the user cannot access. When allowedRoutes is undefined, show everything (backwards compat). */
  function show(href: string): boolean {
    if (!allowedRoutes) return true
    if (href === '/') return allowedRoutes.includes('/')
    return allowedRoutes.some(r => r !== '/' && (href === r || href.startsWith(r + '/')))
  }

  return (
    <aside className="ms-sidebar">
      <div className="ms-logo">
        <AllFarmLogo />
        <span className="ms-logo-text">allFarm</span>
      </div>

      {/* FarmScout section */}
      <div className="ms-section-label">FarmScout</div>
      {show('/') && <a href="/" className={cls('/')}><span className="ms-nav-icon"><DashboardIcon /></span> Dashboard</a>}
      {show('/orchards') && <a href="/orchards" className={cls('/orchards')}><span className="ms-nav-icon"><TreeIcon /></span> Orchards</a>}
      {show('/orchards/analysis') && <a href="/orchards/analysis" className={cls('/orchards/analysis')} style={{ paddingLeft: 28, fontSize: 13 }}><span className="ms-nav-icon"><AnalysisIcon /></span> Analysis</a>}
      {show('/orchards/leaf-analysis') && <a href="/orchards/leaf-analysis" className={cls('/orchards/leaf-analysis')} style={{ paddingLeft: 28, fontSize: 13 }}><span className="ms-nav-icon"><LeafIcon /></span> Leaf Analysis</a>}
      {show('/pests') && <a href="/pests" className={cls('/pests')}><span className="ms-nav-icon"><BugIcon /></span> Pests</a>}
      {show('/trap-inspections') && <a href="/trap-inspections" className={cls('/trap-inspections')}><span className="ms-nav-icon"><CrosshairIcon /></span> Trap Inspections</a>}
      {show('/inspections') && <a href="/inspections" className={cls('/inspections')}><span className="ms-nav-icon"><SearchIcon /></span> Inspections</a>}
      {show('/heatmap') && <a href="/heatmap" className={cls('/heatmap')}><span className="ms-nav-icon"><LayersIcon /></span> Heat Map</a>}
      {show('/scouts') && <a href="/scouts" className={cls('/scouts')}><span className="ms-nav-icon"><PersonIcon /></span> Scouts</a>}
      {show('/scouts/new') && <a href="/scouts/new" className={cls('/scouts/new')} style={{ paddingLeft: 28, fontSize: 13 }}><span className="ms-nav-icon"><PersonPlusIcon /></span> New Scout</a>}
      {show('/scouts/sections') && <a href="/scouts/sections" className={cls('/scouts/sections')} style={{ paddingLeft: 28, fontSize: 13 }}><span className="ms-nav-icon"><FolderIcon /></span> Sections</a>}
      {show('/scouts/productivity') && <a href="/scouts/productivity" className={cls('/scouts/productivity')} style={{ paddingLeft: 28, fontSize: 13 }}><span className="ms-nav-icon"><ActivityIcon /></span> Productivity</a>}
      {show('/settings') && <a href="/settings" className={cls('/settings')}><span className="ms-nav-icon"><GearIcon /></span> Settings</a>}
      {isSuperAdmin && show('/admin') && <a href="/admin" className={cls('/admin')}><span className="ms-nav-icon"><ShieldIcon /></span> Admin</a>}

      {/* QC section — only when org subscribes to qc module */}
      {hasQc && show('/qc') && (
        <>
          <div className="ms-section-label">QC</div>
          <a href="/qc/dashboard" className={cls('/qc/dashboard')}><span className="ms-nav-icon"><ClipboardCheckIcon /></span> QC Dashboard</a>
          <a href="/qc/map" className={cls('/qc/map')}><span className="ms-nav-icon"><MapPinIcon /></span> Bag Map</a>
          <a href="/qc/heatmap" className={cls('/qc/heatmap')}><span className="ms-nav-icon"><LayersIcon /></span> QC Heat Map</a>
          <a href="/qc/unknowns" className={cls('/qc/unknowns')}><span className="ms-nav-icon"><CameraIcon /></span> Unknown Issues</a>
          <a href="/qc/settings/issues" className={cls('/qc/settings')}><span className="ms-nav-icon"><ListSettingsIcon /></span> Issue Setup</a>
          <a href="/qc/settings/size-bins" className={cls('/qc/settings/size-bins')}><span className="ms-nav-icon"><RulerIcon /></span> Size Bins</a>
          <a href="/qc/labels" className={cls('/qc/labels')}><span className="ms-nav-icon"><TagIcon /></span> Print Labels</a>
          <a href="/qc/settings/users" className={cls('/qc/settings/users')}><span className="ms-nav-icon"><UserCircleIcon /></span> App Users</a>
          <a href="/qc/settings/assignments" className={cls('/qc/settings/assignments')}><span className="ms-nav-icon"><LinkIcon /></span> Assignments</a>
        </>
      )}

      {/* Production section — only when org subscribes to production module */}
      {hasProduction && show('/production') && (
        <>
          <div className="ms-section-label">Production</div>
          <a href="/production" className={cls('/production')}><span className="ms-nav-icon"><PackageIcon /></span> Production</a>
          <a href="/production/settings" className={cls('/production/settings')} style={{ paddingLeft: 28, fontSize: 13 }}><span className="ms-nav-icon"><ScaleIcon /></span> Bin Weights</a>
        </>
      )}

      {/* Footer */}
      <div className="ms-sidebar-footer">
        <span style={{ color: '#4caf72' }}>●</span> Connected
        {onLogout && (
          <>
            <br />
            <button onClick={onLogout} className="ms-logout-btn">Sign out</button>
          </>
        )}
      </div>
    </aside>
  )
}

/**
 * Embed this once in each page that uses <ManagerSidebar>.
 * Provides the CSS for the sidebar layout.
 */
export function ManagerSidebarStyles() {
  return (
    <style>{`
      .ms-sidebar {
        width: 220px;
        height: 100vh;
        position: sticky;
        top: 0;
        overflow-y: auto;
        background: linear-gradient(180deg, #2176d9, #1148a8);
        padding: 32px 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
      }
      @media (max-width: 768px) {
        .ms-sidebar { display: none; }
      }
      .ms-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 32px;
      }
      .ms-logo-text {
        font-family: var(--font-space-grotesk), 'Inter', sans-serif;
        font-size: 22px;
        color: #fff;
        font-weight: 600;
        letter-spacing: -0.5px;
      }
      .ms-nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        color: #a0c4f0;
        font-size: 13.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        text-decoration: none;
      }
      .ms-nav-item:hover { background: #1a5fb8; color: #fff; }
      .ms-nav-item.active { background: #1a5fb8; color: #fff; }
      .ms-nav-icon { font-size: 16px; display: flex; align-items: center; }
      .ms-section-label {
        font-size: 10px;
        color: #6a9fd4;
        padding: 16px 16px 4px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .ms-sidebar-footer {
        margin-top: auto;
        padding-top: 24px;
        border-top: 1px solid #1a5fb8;
        font-size: 12px;
        color: #6a9fd4;
      }
      .ms-logout-btn {
        margin-top: 10px;
        background: none;
        border: 1px solid #1a5fb8;
        color: #a0c4f0;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 11px;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
      }
    `}</style>
  )
}

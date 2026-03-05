'use client'

import { usePathname } from 'next/navigation'

interface ManagerSidebarProps {
  isSuperAdmin?: boolean
  modules?: string[]
  onLogout?: () => void
}

/**
 * Shared sidebar for all manager pages.
 * Shows FarmScout nav items always, QC section only when org has 'qc' module.
 * Uses CSS classes (.ms-sidebar, .ms-nav-item, etc.) — embed <ManagerSidebarStyles /> once per page.
 */
export default function ManagerSidebar({ isSuperAdmin, modules = ['farmscout'], onLogout }: ManagerSidebarProps) {
  const pathname = usePathname()
  const hasQc = modules.includes('qc')

  function cls(href: string) {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return `ms-nav-item${active ? ' active' : ''}`
  }

  return (
    <aside className="ms-sidebar">
      <div className="ms-logo"><span>Farm</span>Scout</div>

      {/* FarmScout section */}
      <a href="/" className={cls('/')}><span className="ms-nav-icon">📊</span> Dashboard</a>
      <a href="/orchards" className={cls('/orchards')}><span className="ms-nav-icon">🏡</span> Orchards</a>
      <a href="/pests" className={cls('/pests')}><span className="ms-nav-icon">🐛</span> Pests</a>
      <a href="/trap-inspections" className={cls('/trap-inspections')}><span className="ms-nav-icon">🪤</span> Trap Inspections</a>
      <a href="/inspections" className={cls('/inspections')}><span className="ms-nav-icon">🔍</span> Inspections</a>
      <a href="/heatmap" className={cls('/heatmap')}><span className="ms-nav-icon">🌡️</span> Heat Map</a>
      <a href="/scouts" className={cls('/scouts')}><span>👷</span> Scouts</a>
      <a href="/scouts/new" className={cls('/scouts/new')} style={{ paddingLeft: 28, fontSize: 13 }}><span>➕</span> New Scout</a>
      <a href="/scouts/sections" className={cls('/scouts/sections')} style={{ paddingLeft: 28, fontSize: 13 }}><span>🗂️</span> Sections</a>
      <a href="/settings" className={cls('/settings')}><span className="ms-nav-icon">🔔</span> Settings</a>
      {isSuperAdmin && <a href="/admin" className={cls('/admin')}><span>⚙️</span> Admin</a>}

      {/* QC section — only when org subscribes to qc module */}
      {hasQc && (
        <>
          <div className="ms-section-label">QC</div>
          <a href="/qc/dashboard" className={cls('/qc/dashboard')}><span>⚖️</span> QC Dashboard</a>
          <a href="/qc/unknowns" className={cls('/qc/unknowns')}><span>📷</span> Unknown Issues</a>
          <a href="/qc/settings/issues" className={cls('/qc/settings')}><span>🐛</span> Issue Setup</a>
          <a href="/qc/settings/size-bins" className={cls('/qc/settings/size-bins')}><span>📏</span> Size Bins</a>
          <a href="/qc/labels" className={cls('/qc/labels')}><span>🏷️</span> Print Labels</a>
          <a href="/qc/settings/users" className={cls('/qc/settings/users')}><span>👤</span> App Users</a>
        </>
      )}

      {/* Footer */}
      <div className="ms-sidebar-footer">
        <span style={{ color: '#2a6e45' }}>●</span> Connected
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
        background: #1c3a2a;
        padding: 32px 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
      }
      .ms-logo {
        font-family: 'Inter', sans-serif;
        font-size: 22px;
        color: #a8d5a2;
        margin-bottom: 32px;
        letter-spacing: -0.5px;
      }
      .ms-logo span { color: #fff; }
      .ms-nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        color: #8aab96;
        font-size: 13.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        text-decoration: none;
      }
      .ms-nav-item:hover { background: #2a4f38; color: #fff; }
      .ms-nav-item.active { background: #2a4f38; color: #a8d5a2; }
      .ms-nav-icon { font-size: 16px; }
      .ms-section-label {
        font-size: 10px;
        color: #5a7a6a;
        padding: 16px 16px 4px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .ms-sidebar-footer {
        margin-top: auto;
        padding-top: 24px;
        border-top: 1px solid #2a4f38;
        font-size: 12px;
        color: #4a7a5a;
      }
      .ms-logout-btn {
        margin-top: 10px;
        background: none;
        border: 1px solid #2a4f38;
        color: #6aaa80;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 11px;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
      }
    `}</style>
  )
}

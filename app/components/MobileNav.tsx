'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface MobileNavProps {
  isSuperAdmin?: boolean
  modules?: string[]
}

export default function MobileNav(_props: MobileNavProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href)
  }

  return (
    <>
      <style>{`
        .mnav-bar {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: calc(56px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: #fff;
          border-top: 1px solid #e8e4dc;
          z-index: 9000;
          align-items: stretch;
          justify-content: space-around;
          box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
        }
        @media (max-width: 768px) {
          .mnav-bar { display: flex; }
        }
        .mnav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: none;
          border: none;
          cursor: pointer;
          color: #9aaa9f;
          font-size: 11px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          text-decoration: none;
          padding: 6px 0;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.1s ease;
        }
        .mnav-tab:active { transform: scale(0.92); }
        .mnav-tab.active { color: #1c3a2a; }
        .mnav-tab-icon { font-size: 24px; line-height: 1; }
        @media (min-width: 769px) {
          .mnav-bar { display: none !important; }
        }
      `}</style>

      <nav className="mnav-bar">
        <Link href="/" className={`mnav-tab${isActive('/') ? ' active' : ''}`}>
          <span className="mnav-tab-icon">{'\u{1F4CA}'}</span>
          <span>Dashboard</span>
        </Link>
        <button className="mnav-tab" onClick={() => window.location.reload()}>
          <span className="mnav-tab-icon">{'\u{1F504}'}</span>
          <span>Refresh</span>
        </button>
      </nav>
    </>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface MobileNavProps {
  isSuperAdmin?: boolean
  modules?: string[]
}

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#000' : 'none'} stroke={active ? '#000' : '#888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const ProductionIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#000' : '#888'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9"/>
    <rect x="10" y="7" width="4" height="14"/>
    <rect x="17" y="3" width="4" height="18"/>
  </svg>
)

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
          border-top: 1px solid #eee;
          z-index: 9000;
          align-items: stretch;
          justify-content: space-around;
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
          gap: 3px;
          background: none;
          border: none;
          cursor: pointer;
          color: #888;
          font-size: 10px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          text-decoration: none;
          padding: 6px 0;
          -webkit-tap-highlight-color: transparent;
        }
        .mnav-tab:active { opacity: 0.6; }
        .mnav-tab.active { color: #000; }
        @media (min-width: 769px) {
          .mnav-bar { display: none !important; }
        }
      `}</style>

      <nav className="mnav-bar">
        <Link href="/" className={`mnav-tab${isActive('/') ? ' active' : ''}`}>
          <HomeIcon active={isActive('/')} />
          <span>Home</span>
        </Link>
        <Link href="/production" className={`mnav-tab${isActive('/production') ? ' active' : ''}`}>
          <ProductionIcon active={isActive('/production')} />
          <span>Production</span>
        </Link>
      </nav>
    </>
  )
}

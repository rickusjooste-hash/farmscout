'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-auth'

interface MobileNavProps {
  isSuperAdmin?: boolean
  modules?: string[]
}

const TABS = [
  { href: '/', icon: '\u{1F4CA}', label: 'Dashboard' },
  { href: '/trap-inspections', icon: '\u{1FA64}', label: 'Traps' },
  { href: '/inspections', icon: '\u{1F50D}', label: 'Trees' },
  { href: '/heatmap', icon: '\u{1F321}\uFE0F', label: 'Heat Map' },
]

export default function MobileNav({ isSuperAdmin, modules = ['farmscout'] }: MobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showMore, setShowMore] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close sheet on outside click
  useEffect(() => {
    if (!showMore) return
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setShowMore(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMore])

  // Close sheet on navigation
  useEffect(() => {
    setShowMore(false)
  }, [pathname])

  const hasQc = modules.includes('qc')

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

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
          font-size: 10px;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          text-decoration: none;
          padding: 6px 0;
          -webkit-tap-highlight-color: transparent;
        }
        .mnav-tab.active { color: #1c3a2a; }
        .mnav-tab-icon { font-size: 20px; line-height: 1; }
        .mnav-tab.active .mnav-tab-icon { filter: none; }
        .mnav-sheet-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.3);
          z-index: 9001;
        }
        .mnav-sheet-overlay.open { display: block; }
        .mnav-sheet {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: #fff;
          border-radius: 16px 16px 0 0;
          padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 0px));
          z-index: 9002;
          transform: translateY(100%);
          transition: transform 0.25s ease;
          max-height: 70vh;
          overflow-y: auto;
        }
        .mnav-sheet.open { transform: translateY(0); }
        .mnav-sheet-handle {
          width: 36px; height: 4px; border-radius: 2px;
          background: #d0cdc6; margin: 0 auto 16px;
        }
        .mnav-sheet-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 8px;
          border-radius: 10px;
          color: #3a4a40;
          font-size: 14px; font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .mnav-sheet-item:hover, .mnav-sheet-item:active { background: #f4f1eb; }
        .mnav-sheet-item.active { color: #1c3a2a; font-weight: 600; background: #f0f7f2; }
        .mnav-sheet-icon { font-size: 18px; width: 24px; text-align: center; }
        .mnav-sheet-section {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.8px; color: #9aaa9f;
          padding: 16px 8px 6px;
        }
        .mnav-sheet-divider { height: 1px; background: #f0ede6; margin: 8px 0; }
        .mnav-logout {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 8px; border-radius: 10px;
          background: none; border: none; width: 100%;
          color: #c0392b; font-size: 14px; font-weight: 500;
          cursor: pointer; font-family: 'Inter', sans-serif;
        }
        .mnav-logout:hover { background: #fef2f2; }
        @media (min-width: 769px) {
          .mnav-bar, .mnav-sheet-overlay, .mnav-sheet { display: none !important; }
        }
      `}</style>

      {/* Bottom tab bar */}
      <nav className="mnav-bar">
        {TABS.map(tab => (
          <a
            key={tab.href}
            href={tab.href}
            className={`mnav-tab${isActive(tab.href) ? ' active' : ''}`}
          >
            <span className="mnav-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </a>
        ))}
        <button
          className={`mnav-tab${showMore ? ' active' : ''}`}
          onClick={() => setShowMore(v => !v)}
        >
          <span className="mnav-tab-icon">{'\u2022\u2022\u2022'}</span>
          <span>More</span>
        </button>
      </nav>

      {/* "More" slide-up sheet */}
      <div
        className={`mnav-sheet-overlay${showMore ? ' open' : ''}`}
        onClick={() => setShowMore(false)}
      />
      <div ref={sheetRef} className={`mnav-sheet${showMore ? ' open' : ''}`}>
        <div className="mnav-sheet-handle" />

        <a href="/orchards" className={`mnav-sheet-item${isActive('/orchards') ? ' active' : ''}`}>
          <span className="mnav-sheet-icon">{'\u{1F3E1}'}</span> Orchards
        </a>
        <a href="/pests" className={`mnav-sheet-item${isActive('/pests') ? ' active' : ''}`}>
          <span className="mnav-sheet-icon">{'\u{1F41B}'}</span> Pests
        </a>
        <a href="/scouts" className={`mnav-sheet-item${isActive('/scouts') ? ' active' : ''}`}>
          <span className="mnav-sheet-icon">{'\u{1F477}'}</span> Scouts
        </a>
        <a href="/settings" className={`mnav-sheet-item${isActive('/settings') ? ' active' : ''}`}>
          <span className="mnav-sheet-icon">{'\u{1F514}'}</span> Settings
        </a>

        {isSuperAdmin && (
          <a href="/admin" className={`mnav-sheet-item${isActive('/admin') ? ' active' : ''}`}>
            <span className="mnav-sheet-icon">{'\u2699\uFE0F'}</span> Admin
          </a>
        )}

        {hasQc && (
          <>
            <div className="mnav-sheet-section">QC</div>
            <a href="/qc/dashboard" className={`mnav-sheet-item${isActive('/qc/dashboard') ? ' active' : ''}`}>
              <span className="mnav-sheet-icon">{'\u2696\uFE0F'}</span> QC Dashboard
            </a>
            <a href="/qc/map" className={`mnav-sheet-item${isActive('/qc/map') ? ' active' : ''}`}>
              <span className="mnav-sheet-icon">{'\u{1F4CD}'}</span> Bag Map
            </a>
            <a href="/qc/heatmap" className={`mnav-sheet-item${isActive('/qc/heatmap') ? ' active' : ''}`}>
              <span className="mnav-sheet-icon">{'\u{1F321}\uFE0F'}</span> QC Heat Map
            </a>
          </>
        )}

        <div className="mnav-sheet-divider" />
        <button className="mnav-logout" onClick={handleLogout}>
          <span className="mnav-sheet-icon">{'\u{1F6AA}'}</span> Sign Out
        </button>
      </div>
    </>
  )
}

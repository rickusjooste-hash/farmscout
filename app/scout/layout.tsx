'use client'

import { useEffect } from 'react'

export default function ScoutLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registered:', reg.scope))
        .catch((err) => console.log('[SW] Registration failed:', err))
    }

    // Override manager manifest with scout manifest for PWA install
    const existing = document.querySelector('link[rel="manifest"]')
    if (existing) {
      existing.setAttribute('href', '/manifest.json')
    }
    const themeColor = document.querySelector('meta[name="theme-color"]')
    if (themeColor) {
      themeColor.setAttribute('content', '#1a1f0e')
    }
  }, [])

  return <>{children}</>
}
'use client'

import { useEffect } from 'react'

export default function QcLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Point the PWA manifest to the QC-specific one so "Add to Home Screen"
    // installs "Orchard QC" with start_url /qc, not the scout app
    const existing = document.querySelector('link[rel="manifest"]')
    if (existing) {
      existing.setAttribute('href', '/manifest-qc.json')
    } else {
      const link = document.createElement('link')
      link.rel = 'manifest'
      link.href = '/manifest-qc.json'
      document.head.appendChild(link)
    }

    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.log('[SW] QC: Registration failed:', err))
    }
  }, [])

  return <>{children}</>
}

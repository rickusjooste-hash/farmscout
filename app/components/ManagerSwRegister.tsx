'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ManagerSwRegister() {
  const pathname = usePathname()

  useEffect(() => {
    // Only register SW from manager pages (not scout/qc/runner — they have their own layout)
    if (pathname?.startsWith('/scout') || pathname?.startsWith('/qc') || pathname?.startsWith('/runner')) return

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW-Manager] Registered:', reg.scope))
        .catch((err) => console.log('[SW-Manager] Registration failed:', err))
    }
  }, [pathname])

  return null
}

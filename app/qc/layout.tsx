'use client'

import { useEffect } from 'react'

export default function QcLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] QC: Registered:', reg.scope))
        .catch((err) => console.log('[SW] QC: Registration failed:', err))
    }
  }, [])

  return <>{children}</>

}

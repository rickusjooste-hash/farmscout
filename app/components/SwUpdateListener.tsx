'use client'

import { useEffect } from 'react'

export default function SwUpdateListener() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // controllerchange fires when a new SW calls clients.claim() — more reliable
    // than postMessage which can arrive before React has mounted this component
    const handler = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler)
  }, [])
  return null
}

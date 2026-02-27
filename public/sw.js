const CACHE_NAME = 'farmscout-v1'

// App shell pages to pre-cache on install
const PRECACHE = [
  '/scout',
  '/scout/login',
  '/scout/trap-inspection',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Never intercept Supabase API calls — always go to network
  if (url.hostname.includes('supabase.co')) return

  // Network-first for Next.js data/navigation, cache-first for scout pages
  const isScoutPage = url.pathname.startsWith('/scout')
  const isAsset = url.pathname.startsWith('/_next/static')

  if (isAsset) {
    // Static assets: cache-first (they're content-hashed)
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
          return res
        })
      )
    )
    return
  }

  if (isScoutPage) {
    // Scout pages: network-first, fall back to cache when offline
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }
})

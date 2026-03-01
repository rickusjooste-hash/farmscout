const CACHE_NAME = 'farmscout-1772396904054'

// App shell pages to pre-cache on install
const PRECACHE = [
  '/scout',
  '/scout/login',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  // Use allSettled so one bad URL doesn't prevent the SW from installing
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
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

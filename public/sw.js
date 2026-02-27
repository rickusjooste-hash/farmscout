const CACHE_NAME = 'farmscout-v1'

const STATIC_ASSETS = [
  '/scout/login',
  '/scout',
  '/scout/trap-inspection',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch — serve from cache when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Always go to network for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )
    return
  }

  // For everything else — cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      }).catch(() => {
        // Return cached version if network fails
        return caches.match('/scout') || new Response('Offline')
      })
    })
  )
})
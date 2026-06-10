// MedVolunteer Service Worker v3
// Caching strategies, offline fallback, push notifications.

const CACHE_NAME = 'medvolunteer-v3'
const OFFLINE_URL = '/volunteer/offline'

// Static assets that are safe to cache-first
const STATIC_ORIGINS = ['/_next/static/', '/icons/', '/fonts/']

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, '/icons/icon-192.png'])
        .catch(() => {}) // Don't fail install if optional assets are missing
    ).then(() => self.skipWaiting())
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Skip non-GET requests and Supabase / API calls
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Never cache the admin dashboard — the SW scope is the whole origin, and
  // cached admin pages would leave volunteer PII in Cache Storage on shared
  // devices long after logout.
  if (url.pathname.startsWith('/dashboard')) return

  // Static assets: cache-first (long-lived, hashed filenames)
  if (STATIC_ORIGINS.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Navigation requests: network-first, fall back to offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses for offline use
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          // Try cached version of this page first
          const cached = await caches.match(request)
          if (cached) return cached
          // Fall back to offline page
          const offline = await caches.match(OFFLINE_URL)
          return offline || new Response('Offline', { status: 503 })
        })
    )
    return
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || Promise.reject('offline')))
  )
})

// ─── Push notification received ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'MedVolunteer', body: event.data.text() }
  }

  const title = data.title || 'MedVolunteer'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: data.url || '/volunteer/home' },
    tag: data.tag || 'medvolunteer-notification',
    renotify: true,
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ─── Notification click: open / focus the app ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/volunteer/home'
  const fullUrl = new URL(url, self.location.origin).href

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.navigate(fullUrl)
            return client.focus()
          }
        }
        if (clients.openWindow) return clients.openWindow(fullUrl)
      })
  )
})

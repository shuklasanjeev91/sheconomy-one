/**
 * Combined PWA + OneSignal service worker.
 * Keep OneSignal first so push subscription stays on scope `/`.
 * Then add shell caching + offline navigation fallback for installability.
 */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')

const SHELL_CACHE = 'sheconomy-pwa-shell-v1'
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/favicon.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('sheconomy-pwa-') && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (url.origin !== self.location.origin) return

  // App shell navigations: network first, offline page when unreachable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/offline.html')
        return cached || Response.error()
      }),
    )
    return
  }

  // Precached static assets: cache-first.
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
      }),
    )
  }
})

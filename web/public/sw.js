// Service worker: menyimpan tampilan aplikasi supaya bisa dibuka tanpa internet.
// Data keuangan TIDAK disimpan di sini; panggilan ke Google Apps Script selalu langsung ke jaringan.

const CACHE = 'keuangan-__BUILD_VERSION__'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Halaman: ambil versi terbaru dari jaringan, pakai cache kalau offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        const cache = await caches.open(CACHE)
        cache.put(new URL('./', self.location).href, response.clone())
        return response
      } catch {
        return (await caches.match(new URL('./', self.location).href)) || Response.error()
      }
    })())
    return
  }

  // Aset (nama file Vite sudah mengandung hash): pakai cache dulu, ambil dari jaringan kalau belum ada.
  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE)
      cache.put(request, response.clone())
    }
    return response
  })())
})

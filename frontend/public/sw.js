/**
 * CafeBill Service Worker
 * - App shell: Cache-first (loads instantly even offline)
 * - API GET calls: Network-first with cache fallback (works offline)
 * - API writes (POST/PUT/DELETE): Network-only (need internet)
 */

const CACHE_VERSION = 'cafebill-v1';
const OFFLINE_PAGE  = '/app/';

// ── Install: pre-cache the app shell ─────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      fetch(OFFLINE_PAGE)
        .then((res) => cache.put(OFFLINE_PAGE, res))
        .catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: smart caching strategy ─────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // ── API GET: Network first → cache fallback ──────────────────
  if (url.pathname.startsWith('/api/') && req.method === 'GET') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          // Return offline JSON for API calls we don't have cached
          return new Response(
            JSON.stringify({ offline: true, error: 'You are offline. Showing cached data.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // ── API writes (POST/PUT/DELETE): network only ───────────────
  if (url.pathname.startsWith('/api/') && req.method !== 'GET') {
    return; // let browser handle it normally
  }

  // ── App shell & assets: Cache first → network fallback ───────
  event.respondWith(
    caches.match(req).then((cached) => {
      // Return cached immediately, but also update cache in background
      const networkFetch = fetch(req)
        .then((res) => {
          if (res.ok && req.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => null);

      return cached || networkFetch.then((res) => res || caches.match(OFFLINE_PAGE));
    })
  );
});

// ── Background sync for queued orders ─────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

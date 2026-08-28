// Minimal app-shell cache so the app loads instantly and works offline for
// browsing/practicing already-loaded questions. AI calls (hints/explanations/
// photo extraction) still need a live connection to reach /api/*.
//
// IMPORTANT: bump CACHE_NAME any time you want to force every visitor to pick
// up a fresh copy immediately (e.g. after a bug fix). The HTML itself is
// fetched network-first below, so most updates apply automatically without
// needing a version bump — but bumping it here guarantees a clean slate.
const CACHE_NAME = 'jee-console-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache API calls — they must always hit the network.
  if (url.pathname.startsWith('/api/')) return;

  const isAppShellDoc = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/';

  if (isAppShellDoc) {
    // Network-first for the HTML itself, so a fix you deploy is visible on
    // the very next load instead of being stuck behind an old cached copy.
    // Falls back to cache only if the network is unreachable (offline).
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (icons, manifest, fonts) — cache-first, since these
  // rarely change and it keeps the app feeling instant.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      }).catch(() => cached);
    })
  );
});

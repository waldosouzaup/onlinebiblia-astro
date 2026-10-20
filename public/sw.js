// Service Worker for Online Bíblia (PWA & Offline First)
const CACHE_NAME = 'onlinebiblia-core-v1';
const DATA_CACHE_NAME = 'onlinebiblia-data-v1';

// Core Application Shell
const CORE_ASSETS = [
  '/',
  '/biblia/',
  '/en/bible/',
  '/concordancia/',
  '/offline.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// Full Bible & App Data Files (Offline capability for all 66 books and 1,189 chapters)
const BIBLE_DATA_ASSETS = [
  '/data/bible-pt.json',
  '/data/bible-en.json',
  '/data/concordance.json',
  '/data/devotional.json'
];

// Helper to pre-cache an array of URLs safely
async function precacheList(cacheName, urls) {
  const cache = await caches.open(cacheName);
  const promises = urls.map(async (url) => {
    try {
      const response = await fetch(url, { cache: 'reload' });
      if (response && response.ok) {
        await cache.put(url, response);
      }
    } catch (err) {
      console.warn('[SW] Falha ao pré-carregar item:', url, err);
    }
  });
  return Promise.all(promises);
}

// Install Event: Cache core shell and all Bible data immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Cache core shell
      await precacheList(CACHE_NAME, CORE_ASSETS);

      // 2. Cache complete Bible database for full offline reading
      await precacheList(DATA_CACHE_NAME, BIBLE_DATA_ASSETS);

      // Notify any active clients that the Bible is cached
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({
          type: 'BIBLE_DOWNLOAD_COMPLETE',
          message: 'Bíblia completa armazenada para leitura offline!'
        });
      });

      return self.skipWaiting();
    })()
  );
});

// Activate Event: Clear outdated caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const activeCaches = [CACHE_NAME, DATA_CACHE_NAME];
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (!activeCaches.includes(key)) {
            console.log('[SW] Removendo cache obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
      return self.clients.claim();
    })()
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle Google Fonts (Cache First, background network)
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            cache.put(request, res.clone());
          }
          return res;
        } catch (_) {
          return cached;
        }
      })
    );
    return;
  }

  // Only handle same-origin requests beyond this point
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. HTML Page Navigations (Network first -> Cache fallback -> Offline Reader fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Attempt network fetch with 3.5s timeout for slow mobile connections
          const fetchPromise = fetch(request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 3500)
          );
          const response = await Promise.race([fetchPromise, timeoutPromise]);

          if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
            return response;
          }
          throw new Error('Network returned non-200');
        } catch (err) {
          // Network failed or offline: check if this specific page is in cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // If navigation is for a Bible chapter or book, serve offline.html shell!
          // offline.html dynamically extracts the book and chapter from the URL
          // and renders it directly from the cached bible-pt.json or bible-en.json.
          const offlineShell = await caches.match('/offline.html');
          if (offlineShell) {
            return offlineShell;
          }

          // Fallback root page
          const fallbackHome = await caches.match('/');
          if (fallbackHome) {
            return fallbackHome;
          }

          return new Response('Modo Offline — Abra o aplicativo conectado para sincronizar.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
      })()
    );
    return;
  }

  // 2. Bible Data JSON Files (Cache First with Stale-While-Revalidate)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE_NAME);
        const cached = await cache.match(request);

        // Fetch fresh copy in background to update cache
        const fetchPromise = fetch(request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              cache.put(request, networkRes.clone());
            }
            return networkRes;
          })
          .catch(() => null);

        // If we have cached Bible data, return immediately for instant offline speed
        if (cached) {
          return cached;
        }

        const networkRes = await fetchPromise;
        if (networkRes) return networkRes;

        return new Response(JSON.stringify({ error: 'Dados offline indisponíveis' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      })()
    );
    return;
  }

  // 3. Static Assets (CSS, JS, SVG, Images, Webmanifest)
  // Stale-While-Revalidate: serve cached immediately, update in background
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cached) {
        return cached;
      }

      const networkRes = await fetchPromise;
      if (networkRes) {
        return networkRes;
      }

      return new Response('', { status: 404 });
    })()
  );
});

// Listen for messages from web pages (e.g. manual offline sync, status check)
self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'CHECK_OFFLINE_READY') {
    const dataCache = await caches.open(DATA_CACHE_NAME);
    const hasPt = await dataCache.match('/data/bible-pt.json');
    const hasEn = await dataCache.match('/data/bible-en.json');
    event.source?.postMessage({
      type: 'OFFLINE_READY_STATUS',
      isReady: Boolean(hasPt && hasEn),
      hasPt: Boolean(hasPt),
      hasEn: Boolean(hasEn)
    });
  }

  if (data.type === 'FORCE_DOWNLOAD_ALL') {
    await precacheList(CACHE_NAME, CORE_ASSETS);
    await precacheList(DATA_CACHE_NAME, BIBLE_DATA_ASSETS);
    event.source?.postMessage({
      type: 'FORCE_DOWNLOAD_SUCCESS',
      message: 'Todos os arquivos da Bíblia foram baixados com sucesso para uso offline!'
    });
  }
});

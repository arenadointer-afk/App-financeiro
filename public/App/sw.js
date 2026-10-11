const CACHE_NAME = "sutello-v1.2";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Instala e salva cache de forma resiliente
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(FILES_TO_CACHE);
      } catch (e) {
        console.warn('Algum asset offline não pôde ser pré-cacheador:', e);
      }
    })
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Intercepta requisições com estratégia Network-First resiliente para o mobile
self.addEventListener("fetch", (event) => {
  // Ignora requisições do Firebase Firestore / Auth e extensões
  if (
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('identitytoolkit') ||
    event.request.url.includes('chrome-extension') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const indexFallback = await caches.match('./index.html');
        return indexFallback || new Response('Offline - Sutello Financeiro', { headers: { 'Content-Type': 'text/html' } });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return (
          response ||
          fetch(event.request).then((networkResponse) => {
            // Guarda em cache os assets estáticos em background
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          }).catch(() => response)
        );
      })
    );
  }
});

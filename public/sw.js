const CACHE_NAME = "sutello-financeiro-offline-v6";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-hh512.png",
  "./apple-touch-icon.png"
];

// Instalação do Service Worker com pré-carregamento dos assets essenciais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(CORE_ASSETS);
      } catch (err) {
        console.warn("Alguns assets essenciais serão cacheados dinamicamente:", err);
      }
    })
  );
  self.skipWaiting();
});

// Ativação e limpeza imediata de versões antigas do cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Estratégia de cache inteligente para navegação e assets estáticos
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Ignora métodos não-GET e requisições para extensões do navegador
  if (request.method !== "GET" || url.protocol.startsWith("chrome-extension")) {
    return;
  }

  // 2. Não intercepta endpoints do Firebase para deixar o SDK gerenciar seu próprio IndexedDB
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("identitytoolkit.googleapis.com") ||
    url.hostname.includes("securetoken.googleapis.com") ||
    url.hostname.includes("firebaseinstallations.googleapis.com")
  ) {
    return;
  }

  // 3. Requisição de Navegação (Abrir o App / Carregar HTML principal)
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              cache.put("./index.html", networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Quando estiver sem internet (offline), serve o index.html cacheado imediatamente
          const cachedNavigate = await caches.match(request);
          if (cachedNavigate) return cachedNavigate;

          const cachedIndex = await caches.match("./index.html");
          if (cachedIndex) return cachedIndex;

          const rootIndex = await caches.match("./");
          if (rootIndex) return rootIndex;

          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sutello Financeiro Offline</title></head><body style="background:#08080f;color:#fff;font-family:sans-serif;text-align:center;padding:40px;"><h2>Sutello Financeiro</h2><p>Carregando dados salvos localmente...</p><script>location.reload();</script></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 4. Scripts, Estilos, Fontes e Imagens (Stale-While-Revalidate com Fallback Offline)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Se já está no cache, retorna imediatamente para fluidez máxima
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === "opaque")
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          // Se falhou por estar offline e não tem no cache, trata silenciosamente
          return cachedResponse || Promise.reject(err);
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// 5. Suporte a Notificações Nativas no Celular (Toque / Clique na Notificação)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "./";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Se já houver uma aba aberta do app, foca nela
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if ("focus" in client) {
            return client.focus();
          }
        }
        // Se não houver, abre uma nova janela com o app
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// 6. Listener para mensagens enviadas pela aplicação cliente
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    if (self.registration && self.registration.showNotification) {
      self.registration.showNotification(title, options);
    }
  }
});

/**
 * Service Worker — i9 Team Portal
 *
 * Estratégias:
 *   - HTML (documents): network-first com fallback cache (ofRline-friendly).
 *   - Assets estáticos (imgs/manifest): cache-first (rápido + economiza rede).
 *   - WebSocket e /api/*: NÃO interceptados (deixa passar pra rede direto).
 *
 * Adaptado do dashboard Streamlit pra Next.js (paths sem prefixo /app/static).
 */

const CACHE_NAME = "i9-team-v1";

const ESSENTIAL_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon-32.png",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll falha em bloco se algum asset 404; usar add individual com catch
      Promise.all(
        ESSENTIAL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[sw] falha ao cachear", url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Apenas GET — POST/PUT/DELETE passam direto.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Mesmo origin apenas — não interceptar requisições cross-origin.
  if (url.origin !== self.location.origin) return;

  // WebSocket: deixa passar (sw.js não roda em ws:// mesmo, mas defesa extra).
  if (url.protocol === "ws:" || url.protocol === "wss:") return;

  // API REST do backend: network-only.
  if (url.pathname.startsWith("/api/")) return;

  // Hot reload do Next.js em dev: não interceptar.
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs")
  ) {
    return;
  }

  // HTML (documents): network-first.
  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches
            .open(CACHE_NAME)
            .then((c) => c.put(request, clone))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/"))
            .then((res) => res ?? Response.error())
        )
    );
    return;
  }

  // Assets estáticos (imagens, manifest): cache-first.
  const isStaticAsset =
    request.destination === "image" ||
    /\.(png|jpe?g|svg|ico|webp|gif|woff2?)$/i.test(url.pathname) ||
    url.pathname === "/manifest.json";

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((res) => {
              if (res && res.ok) {
                const clone = res.clone();
                caches
                  .open(CACHE_NAME)
                  .then((c) => c.put(request, clone))
                  .catch(() => {});
              }
              return res;
            })
            .catch(() => Response.error())
      )
    );
    return;
  }

  // Resto: passa direto pra rede.
});

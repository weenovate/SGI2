/* SGI - service worker (PWA shell).
 *
 * Estrategia:
 *   - HTML / navegaciones (modo navigate): network-first con fallback a
 *     cache, así un deploy nuevo SIEMPRE le llega al usuario en el
 *     próximo request, sin quedar atrapado en versiones viejas.
 *   - Assets estáticos de Next (/_next/static/...): cache-first, son
 *     seguros porque Next les pone hash en el nombre.
 *   - Imágenes y otros GET: stale-while-revalidate.
 *   - /api y rutas privadas: passthrough (jamás se cachean).
 *
 * Bumpear `CACHE` cada vez que se cambia esta estrategia.
 */
const CACHE = "sgi-shell-v2";
const PRECACHE = ["/calendario", "/manifest.webmanifest", "/branding/logo.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Bypass total para API, archivos privados y auth.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/")
  ) {
    return;
  }

  // Navegaciones (HTML) → network-first.
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Assets de Next con hash → cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Imágenes, fonts, branding, etc. → stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached ?? Response.error();
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.status === 200) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
  }
  return res;
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
      }
      return res;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}

const CACHE_NAME = "promptly-v11";
const APP_SHELL = [
  "/",
  "/index.html",
  "/assets/app.js",
  "/assets/app.css",
  "/assets/mammoth.js",
  "/assets/index.js",
  "/assets/supabase.js",
  "/manifest.webmanifest",
  "/icons/promptly.svg",
  "/icons/promptly-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Live service checks must never be answered from an offline cache.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname === "/version.json") {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (event.request.mode === "navigate" || /\.(js|css)$/.test(url.pathname)) {
    event.respondWith(fetch(event.request, { cache: "no-cache" }).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
      }
      return response;
    }).catch(async () => (await caches.match(event.request))
      || (event.request.mode === "navigate" ? caches.match("/index.html") : Response.error())));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fresh = fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

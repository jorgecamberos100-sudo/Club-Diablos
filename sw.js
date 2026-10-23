// Siempre pide la versión más nueva a internet; la copia guardada solo se usa sin conexión.
const CACHE = "app-v4";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-store" })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); const key = new URL(req.url); key.searchParams.delete("t"); caches.open(CACHE).then((c) => c.put(key.href, copy)); }
        return res;
      })
      .catch(() => { const key = new URL(req.url); key.searchParams.delete("t"); return caches.match(key.href).then((r) => r || caches.match("./")); })
  );
});

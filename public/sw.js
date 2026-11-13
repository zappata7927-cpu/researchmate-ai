/* ResearchMate AI — minimal, update-safe service worker.
 * Strategy: network-first passthrough; caches only the offline page.
 * Nothing else is cached, so the app always serves fresh content and
 * the worker never risks stale HTML/API responses. */
const CACHE = "researchmate-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).catch(() =>
      req.mode === "navigate"
        ? caches.match(OFFLINE_URL)
        : caches.match(req).then((hit) => hit || Response.error())
    )
  );
});

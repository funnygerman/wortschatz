// Makes the decks work offline. Served from the site root, so its scope is the
// whole site; the two placeholders below are filled in by scripts/build-site.mjs.
//
// VERSION is a hash of everything precached, so a deploy that changes nothing
// keeps the same cache, and one that changes anything gets a fresh one.
const VERSION = "__VERSION__";
// Every page, stylesheet and icon the site is built from — small enough (well
// under a megabyte) that the whole site is saved on the first visit.
const ASSETS = __ASSETS__;
// The shared flashcards library. Same origin once published, but a different
// project, so a miss here is not worth failing the install over.
const VENDOR = __VENDOR__;

const PRECACHE = `wortschatz-${VERSION}`;
const RUNTIME = "wortschatz-runtime";
const OFFLINE = "offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // cache: "reload" so a stale HTTP cache can't seed the precache.
      await cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })));
      await Promise.all(
        VENDOR.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {}))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PRECACHE, RUNTIME]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith("http")) return;
  event.respondWith(respond(event));
});

// Precache first — it holds exactly what this deploy published, so decks open
// instantly and offline. Anything else (the tools page, deck CSVs) goes to the
// network first and falls back to whatever was cached on an earlier visit.
async function respond(event) {
  const { request } = event;
  const precache = await caches.open(PRECACHE);
  const precached = await precache.match(request, { ignoreSearch: true });
  if (precached) return precached;

  const runtime = await caches.open(RUNTIME);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil(runtime.put(request, copy));
    }
    return response;
  } catch (error) {
    const cached = await runtime.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await precache.match(OFFLINE);
      if (offline) return offline;
    }
    throw error;
  }
}

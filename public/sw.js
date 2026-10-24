/* Service worker: app shell only. Saved news, questions and exams live in IndexedDB.
   All URLs are resolved against the worker's scope, so it works under /<repo>/ on GitHub Pages. */
const VERSION = '__VERSION__';
const CACHE = 'exam-daily-' + VERSION;
const PRECACHE = __PRECACHE__;
const ROOT = () => new URL('./', self.registration.scope).href;

self.addEventListener('install', (event) => {
  const scope = self.registration.scope;
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(Array.isArray(PRECACHE) ? PRECACHE.map((p) => c.add(new URL(p, scope).href).catch(() => undefined)) : []),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('exam-daily-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept Google API calls

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(ROOT(), copy));
          return res;
        })
        .catch(() => caches.match(ROOT()).then((r) => r || caches.match(new URL('./index.html', self.registration.scope).href))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

const CACHE = "quiz-pwa-v10-filtered";
const ASSETS = [
  "./", "index.html", "styles.css", "manifest.json", "icon-192.png", "icon-512.png", "app-v3.js",
  "questions-1a.js", "questions-1b.js", "questions-2.js", "questions-3a.js", "questions-3b.js",
  "questions-4a.js", "questions-4b.js", "questions-5a.js", "questions-5b.js",
  "questions-6a.js", "questions-6b.js"
];
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put("index.html", copy));
      return r;
    }).catch(() => caches.match("index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(event.request, copy));
    return r;
  })));
});

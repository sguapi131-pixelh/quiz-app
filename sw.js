const CACHE = "quiz-pwa-source-docx-v4-fix";
const ASSETS = ["./", "index.html", "styles.css", "questions-data.js", "app.js", "manifest.json", "icon-192.png", "icon-512.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});

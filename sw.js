// Service worker: lets the app open offline. Network first, so updates always show up when online.
const CACHE = 'inknotes-v3';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'editor.js', 'db.js', 'ai.js', 'imaging.js', 'pdfwriter.js',
  'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'pdf.min.mjs', 'pdf.worker.min.mjs'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(r).then((m) => m || caches.match('index.html')))
  );
});

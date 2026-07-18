// MuGöl Edebiyat — Service Worker
// Basit bir "app shell" önbellekleme stratejisi: statik dosyalar cache-first,
// veri dosyaları (data_*.js) ve dış kaynaklar network-first (çevrimdışıyken cache'e düşer).

const CACHE_VERSION = 'mugol-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  './data_authors_turk.js',
  './data_authors_dunya.js',
  './data_books.js',
  './data_quotes.js',
  './data_poems.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))).catch(() => {
        // Bazı dosyalar bulunamazsa (henüz eklenmemiş olabilir) kurulum yine de tamamlansın.
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Fonts, Font Awesome, AdSense, html2canvas gibi dış CDN kaynakları:
  // network-first, olmazsa cache'e düş.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Veri dosyaları: network-first, içerik güncel kalsın; çevrimdışıyken cache'ten sun.
  if (url.pathname.match(/data_(authors_turk|authors_dunya|books|quotes|poems)\.js$/)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Uygulama kabuğu (HTML/CSS/JS/logo): cache-first, arka planda güncelle.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

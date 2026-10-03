// Service Worker — অফলাইনে অ্যাপ খোলার জন্য ফাইল ক্যাশ করে
// নতুন ভার্সন পুশ করলে নিচের VERSION বাড়িয়ে দিন
const VERSION = 'namaari-v1';
const CORE = [
  './', './index.html', './manifest.webmanifest', './assets/css/app.css',
  './assets/js/app.js', './assets/js/nav.js', './assets/js/firebase-config.js',
  './assets/js/core/utils.js', './assets/js/core/calc.js', './assets/js/core/store.js', './assets/js/core/defaults.js',
  './assets/js/core/importer.js', './assets/js/core/reminders.js', './assets/js/ui/components.js',
  './assets/js/views/shared.js', './assets/js/views/dashboard.js', './assets/js/views/sales.js', './assets/js/views/purchases.js',
  './assets/js/views/expenses.js', './assets/js/views/catalog.js', './assets/js/views/people.js', './assets/js/views/money.js',
  './assets/js/views/growth.js', './assets/js/views/settings.js',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firestore / Auth এর লাইভ রিকোয়েস্ট ক্যাশ করি না
  if (/firestore\.googleapis|identitytoolkit|securetoken|googleapis\.com\/identity/.test(url.href)) return;
  const sameOrigin = url.origin === location.origin;
  const isStaticCdn = /gstatic\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com/.test(url.host);
  if (!sameOrigin && !isStaticCdn) return;
  if (sameOrigin) {
    // নেটওয়ার্ক আগে (নতুন আপডেট পেতে), না পেলে ক্যাশ
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
  } else {
    // CDN লাইব্রেরি ও ফন্ট — ক্যাশ আগে
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
  }
});
// নোটিফিকেশনে ট্যাপ করলে অ্যাপ খোলে
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});

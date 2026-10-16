'use strict';
const CACHE = 'sparkit-v4';
const ASSETS = ['./', './index.html', './styles.css', './calculators.js', './worksheets.js', './app.js', './manifest.webmanifest', './icons/icon.svg'];
const assetURLs = new Set(ASSETS.map((path) => new URL(path, self.location.href).href));
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('sparkit-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url); url.search = ''; url.hash = '';
  if (!assetURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') await cache.put(url.href, response.clone());
      return response;
    } catch {
      return await cache.match(url.href) || (event.request.mode === 'navigate' ? await cache.match('./index.html') : null) || Response.error();
    }
  })());
});

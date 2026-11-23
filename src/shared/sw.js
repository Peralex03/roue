/* Service worker : l'app s'ouvre sans réseau. Aucune donnée de l'utilisateur ne passe ici.
   La coquille (page, manifeste, icônes) est servie depuis le cache ; une version plus récente est
   téléchargée en arrière-plan et sert à l'ouverture suivante. */
const CACHE = '__APP__-__BUILD__';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'no-store' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('__APP__-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;   /* tuiles de carte : réseau direct */
  e.respondWith(caches.open(CACHE).then(async c => (await c.match(e.request, { ignoreSearch: true })) || fetch(e.request)));
});

// Service Worker do PWA (Idle Hunter) — ver manifest.json + registro em
// index.html. Estratégia "network-first": toda request do mesmo domínio
// tenta a rede PRIMEIRO (o jogo é atualizado direto no servidor a cada
// push, sem precisar reenviar o app pra Play Store — ver GAME_BUILD em
// js/version.js), só cai pro cache quando está de fato OFFLINE. Isso evita
// o problema clássico de PWA "preso" numa versão antiga cacheada — quem
// abrir o app sempre vê a versão mais nova do jogo enquanto tiver internet.
const CACHE_NAME = 'idle-hunter-shell-v1';
const SHELL_URLS = ['./', './index.html', './manifest.json', './css/style.css'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS).catch(() => {})),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Só GET do mesmo domínio — Supabase/fontes/CDN de terceiros nunca
  // passam por aqui, sempre vão direto pra rede sem cache nenhum.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
  );
});

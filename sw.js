/**
 * sw.js — Trabajador de servicio.
 *
 * Hace dos cosas: guarda el juego completo en cache la primera vez que se abre,
 * para que despues funcione sin conexion, y permite que el navegador lo ofrezca
 * como aplicacion instalable.
 *
 * Sobre seguridad: solo se guardan y se sirven peticiones del propio origen y de
 * tipo GET. Cualquier peticion a otro dominio se deja pasar sin tocarla y sin
 * cachearla, asi que este archivo no puede convertirse en un intermediario de
 * trafico ajeno aunque algo lo intentara.
 */

const VERSION = 'bloquitos-v1';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilos.css',
  './js/main.js',
  './js/juego.js',
  './js/tablero.js',
  './js/piezas.js',
  './js/render.js',
  './js/temas.js',
  './js/audio.js',
  './js/controles.js',
  './js/almacenamiento.js',
  './iconos/icono.svg',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION)
      // addAll falla entero si un solo archivo falla, asi que se anaden de uno en
      // uno: si un icono no esta, el resto del juego se cachea igual.
      .then((cache) => Promise.allSettled(ARCHIVOS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((c) => c !== VERSION).map((c) => caches.delete(c)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pet = evento.request;

  // Solo GET. Nunca se cachea nada que modifique estado.
  if (pet.method !== 'GET') return;

  // Solo mismo origen. Todo lo externo se deja pasar intacto.
  const url = new URL(pet.url);
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(pet).then((enCache) => {
      if (enCache) return enCache;

      return fetch(pet).then((respuesta) => {
        // Solo se guardan respuestas correctas y basicas (mismo origen).
        if (!respuesta || respuesta.status !== 200 || respuesta.type !== 'basic') {
          return respuesta;
        }
        const copia = respuesta.clone();
        caches.open(VERSION).then((cache) => cache.put(pet, copia));
        return respuesta;
      }).catch(() => {
        // Sin conexion y sin copia: si pedian una pagina, se devuelve la portada.
        if (pet.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Sin conexión' });
      });
    }),
  );
});

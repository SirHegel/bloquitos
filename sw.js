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

const VERSION = 'bloquitos-v3';

// Todas las caches del juego empiezan por este prefijo. Al activar se borran las
// que lo llevan y no son la version actual, en vez de vaciar el almacen entero:
// en GitHub Pages todos los repositorios de una cuenta comparten el origen
// usuario.github.io, y borrar sin mirar el nombre dejaria sin su copia sin
// conexion a cualquier otra pagina publicada ahi.
const PREFIJO = 'bloquitos-';

// Se cachea el paquete generado (js/bloquitos.js), que es lo que carga la
// pagina, no los modulos sueltos de js/. Esos siguen existiendo para desarrollo
// y para las pruebas, pero el navegador nunca los pide.
//
// Estan los cinco iconos, no solo dos: el de 180 lo pide iOS al anadir a la
// pantalla de inicio y el enmascarado lo pide Android al instalar, y los dos se
// piden justo cuando el juego puede estar ya sin conexion. La tarjeta social
// (og-bloquitos.png) no la usa la pagina --la piden los rastreadores de enlaces
// desde su propio servidor-- pero se guarda igual para que la copia local sea
// exactamente lo publicado y no una parte.
//
// herramientas/verificar-paquete.mjs lee esta lista y falla si alguna de estas
// rutas no existe en disco: no se puede renombrar un icono y olvidarse de aqui.
// Se usa deliberadamente sintaxis JSON estricta: las herramientas extraen estos
// datos con JSON.parse y nunca ejecutan el contenido de este archivo desde Node.
const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/estilos.css",
  "./js/bloquitos.js",
  "./iconos/icono.svg",
  "./iconos/icono-180.png",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./iconos/icono-mascara-512.png",
  "./iconos/og-bloquitos.png"
];

/**
 * Devuelve la respuesta sin la marca de redirigida.
 *
 * "cleanUrls" de vercel.json convierte /index.html en un 308 hacia /. fetch lo
 * sigue solo y la respuesta final llega correcta, pero con redirected = true.
 * Devolver una respuesta asi desde respondWith() a una navegacion --cuyo modo
 * de redireccion es "manual", no "follow"-- es un error de red: el navegador
 * pinta su pantalla de fallo en vez del juego. Como aqui se guarda para
 * servirla despues, se reconstruye limpia: mismo cuerpo, mismas cabeceras, sin
 * historial de desvios. En GitHub Pages y con doble clic no hay redireccion y
 * esta funcion no hace nada.
 */
async function sinRedireccion(respuesta) {
  if (!respuesta.redirected) return respuesta;

  return new Response(await respuesta.blob(), {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: respuesta.headers,
  });
}

/**
 * Descarga una ruta y la guarda en la cache, ya sin marca de redireccion.
 *
 * cache: 'reload' salta la cache HTTP del navegador y va a la red de verdad. Es
 * imprescindible: js/bloquitos.js y css/estilos.css no llevan hash en el nombre,
 * asi que una copia todavia fresca en la cache HTTP haria que la cache
 * bloquitos-vN recien creada se rellenara con el paquete ANTERIOR. Como despues
 * el manejador fetch sirve primero desde CacheStorage, esa copia vieja se
 * quedaria ahi hasta la siguiente version del trabajador: el despliegue nuevo no
 * llegaria nunca. Ver herramientas/notas-vercel.md, apartado c.5.
 */
async function guardar(cache, ruta) {
  const respuesta = await fetch(ruta, { cache: 'reload' });
  if (!respuesta.ok) throw new Error(`${ruta} respondio ${respuesta.status}`);
  await cache.put(ruta, await sinRedireccion(respuesta));
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSION)
      // Se anaden de uno en uno, no con addAll, que falla entero si un solo
      // archivo falla: si un icono no esta, el resto del juego se cachea igual.
      .then((cache) => Promise.allSettled(ARCHIVOS.map((a) => guardar(cache, a))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves
          .filter((c) => c.startsWith(PREFIJO) && c !== VERSION)
          .map((c) => caches.delete(c)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** Respuesta de ultimo recurso cuando no hay ni red ni copia guardada. */
function sinConexion() {
  return new Response('', { status: 504, statusText: 'Sin conexión' });
}

self.addEventListener('fetch', (evento) => {
  const pet = evento.request;

  // Solo GET. Nunca se cachea nada que modifique estado.
  if (pet.method !== 'GET') return;

  // Solo mismo origen. Todo lo externo se deja pasar intacto.
  const url = new URL(pet.url);
  if (url.origin !== self.location.origin) return;

  // Se busca en la cache de esta version, no con caches.match(), que mira en
  // todas las que haya en el origen. Mientras el trabajador nuevo se activa, la
  // cache anterior sigue existiendo unos instantes: buscar en todas serviria la
  // pagina vieja justo despues de desplegar, que es el fallo que el numero de
  // version viene a evitar.
  evento.respondWith(
    caches.open(VERSION).then((cache) => cache.match(pet).then((enCache) => {
      if (enCache) return enCache;

      return fetch(pet).then((respuesta) => {
        // Solo se guardan respuestas correctas y basicas (mismo origen).
        if (!respuesta || respuesta.status !== 200 || respuesta.type !== 'basic') {
          return respuesta;
        }
        sinRedireccion(respuesta.clone())
          .then((limpia) => cache.put(pet, limpia))
          .catch(() => {});
        return respuesta;
      }).catch(() => {
        // Sin conexion y sin copia: si pedian una pagina, se devuelve la portada.
        // Si tampoco esta guardada --primera visita sin red-- hay que responder
        // algo de todos modos: devolver undefined aqui aborta la peticion y el
        // navegador pinta su pantalla de error, no la nuestra.
        if (pet.mode === 'navigate') {
          return cache.match('./index.html').then((portada) => portada || sinConexion());
        }
        return sinConexion();
      });
    })),
  );
});

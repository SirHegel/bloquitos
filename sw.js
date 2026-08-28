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

const VERSION = 'bloquitos-v4';

// Todas las caches del juego empiezan por este prefijo. Al activar se borran las
// que lo llevan y no son la version actual, en vez de vaciar el almacen entero:
// en GitHub Pages todos los repositorios de una cuenta comparten el origen
// usuario.github.io, y borrar sin mirar el nombre dejaria sin su copia sin
// conexion a cualquier otra pagina publicada ahi.
const PREFIJO = 'bloquitos-';
const MANIFIESTO_CACHE = './archivos-cache.json';

// archivos-cache.json es la única fuente de la lista que se guarda sin conexión.
// Se mantiene como JSON separado para que el trabajador, las pruebas y el
// verificador puedan leer los mismos datos sin extraer ni ejecutar JavaScript.
//
// La lista se valida también aquí, en el límite de confianza de la red. Solo se
// aceptan rutas ./ del mismo origen y bajo el directorio del trabajador. Así un
// manifiesto alterado no puede hacer que la instalación solicite otros sitios o
// otros proyectos que compartan el origen usuario.github.io.
function validarRutasCache(datos) {
  if (!Array.isArray(datos) || datos.length === 0) {
    throw new TypeError(`${MANIFIESTO_CACHE} debe ser un array JSON no vacío`);
  }

  const base = new URL('./', self.location.href);
  const vistas = new Set();

  for (const ruta of datos) {
    if (typeof ruta !== 'string' || !ruta.startsWith('./')) {
      throw new TypeError(`${MANIFIESTO_CACHE} solo admite rutas de texto que empiecen por ./`);
    }

    const url = new URL(ruta, base);
    if (
      url.origin !== base.origin
      || !url.pathname.startsWith(base.pathname)
      || url.search
      || url.hash
    ) {
      throw new TypeError(`${ruta} sale del alcance del trabajador`);
    }
    if (vistas.has(url.href)) throw new TypeError(`${ruta} está repetida`);
    vistas.add(url.href);
  }

  return datos;
}

/** Descarga, analiza y conserva la fuente canónica de las rutas sin conexión. */
async function cargarManifiestoCache() {
  const respuesta = await fetch(MANIFIESTO_CACHE, { cache: 'reload' });
  if (!respuesta.ok) {
    throw new Error(`${MANIFIESTO_CACHE} respondio ${respuesta.status}`);
  }

  const paraCache = respuesta.clone();
  const rutas = validarRutasCache(await respuesta.json());
  return { rutas, respuesta: paraCache };
}

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
    Promise.all([caches.open(VERSION), cargarManifiestoCache()])
      .then(async ([cache, manifiesto]) => {
        // El propio manifiesto queda disponible sin conexión sin descargarlo
        // dos veces: cargarManifiestoCache conserva una copia de la respuesta.
        await cache.put(
          MANIFIESTO_CACHE,
          await sinRedireccion(manifiesto.respuesta),
        );

        // Se añaden de uno en uno, no con addAll, que falla entero si un solo
        // archivo falla: si un icono no está, el resto del juego se cachea igual.
        await Promise.allSettled(
          manifiesto.rutas.map((ruta) => guardar(cache, ruta)),
        );
      })
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

/**
 * despliegue.test.mjs — Pruebas del contrato de despliegue estático.
 *
 * Se ejecutan con:  npm run probar   (node --test sobre todo el proyecto)
 *
 * Estas comprobaciones no escriben en el proyecto: validan la configuración de
 * Vercel y que las referencias publicables permanezcan coherentes entre sí.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_RAIZ = new URL('../', import.meta.url);
const RAIZ = fileURLToPath(URL_RAIZ);
const MANIFIESTO_CACHE = 'archivos-cache.json';

function ruta(...partes) {
  return resolve(RAIZ, ...partes);
}

function leer(nombre) {
  return readFileSync(ruta(nombre), 'utf8');
}

function leerJson(nombre) {
  return JSON.parse(leer(nombre));
}

function valoresDeAtributo(html, atributo) {
  const patron = new RegExp(
    `\\b${atributo}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\u0060]+))`,
    'gi',
  );

  return [...html.matchAll(patron)].map((coincidencia) => (
    coincidencia[1] ?? coincidencia[2] ?? coincidencia[3]
  ));
}

test('vercel.json declara la construcción y las cabeceras requeridas', () => {
  assert.ok(existsSync(ruta('vercel.json')), 'falta vercel.json');

  const configuracion = leerJson('vercel.json');
  assert.equal(typeof configuracion.buildCommand, 'string', 'falta buildCommand');
  assert.ok(configuracion.buildCommand.trim(), 'buildCommand está vacío');
  assert.equal(typeof configuracion.outputDirectory, 'string', 'falta outputDirectory');
  assert.ok(configuracion.outputDirectory.trim(), 'outputDirectory está vacío');

  // Sin installCommand, Vercel ejecuta `npm install` a secas e instala electron
  // y electron-builder en cada despliegue: cientos de megas que la web no usa.
  assert.equal(typeof configuracion.installCommand, 'string', 'falta installCommand');
  assert.match(
    configuracion.installCommand,
    /--omit=dev/u,
    'installCommand debe excluir las dependencias de desarrollo',
  );

  assert.ok(Array.isArray(configuracion.headers), 'headers debe ser un array');
  const fuentes = new Set(configuracion.headers.map(({ source }) => source));
  assert.ok(fuentes.has('/sw.js'), 'faltan las cabeceras de /sw.js');
  assert.ok(fuentes.has('/(.*)'), 'faltan las cabeceras globales de /(.*)');
});

test('.vercelignore excluye pruebas, escritorio y configuración de GitHub', () => {
  assert.ok(existsSync(ruta('.vercelignore')), 'falta .vercelignore');

  const entradas = new Set(
    leer('.vercelignore')
      .split(/\r?\n/u)
      .map((linea) => linea.trim())
      .filter((linea) => linea && !linea.startsWith('#')),
  );

  for (const directorio of ['pruebas/', 'escritorio/', '.github/']) {
    assert.ok(entradas.has(directorio), `.vercelignore no incluye ${directorio}`);
  }
});

test('package.json ofrece los scripts de Vercel y verificación', () => {
  const paquete = leerJson('package.json');
  assert.equal(typeof paquete.scripts?.['vercel-build'], 'string', 'falta el script vercel-build');
  assert.ok(paquete.scripts['vercel-build'].trim(), 'el script vercel-build está vacío');
  assert.equal(typeof paquete.scripts?.verificar, 'string', 'falta el script verificar');
  assert.ok(paquete.scripts.verificar.trim(), 'el script verificar está vacío');
});

test('el release reúne las plataformas y publica sus hashes SHA-256', () => {
  const workflow = leer('.github/workflows/escritorio.yml');
  const publicaciones = workflow.match(/uses: softprops\/action-gh-release@v3/gu) ?? [];

  assert.equal(
    publicaciones.length,
    1,
    'el release debe publicarse una sola vez después de completar la matriz',
  );
  assert.match(
    workflow,
    /uses: actions\/download-artifact@v8[\s\S]*?merge-multiple: true/u,
    'el job de publicación debe reunir los artefactos de todas las plataformas',
  );
  assert.match(
    workflow,
    /sha256sum \* \| sort -k 2 > SHA256SUMS/u,
    'el job de publicación debe generar SHA256SUMS',
  );
  assert.match(
    workflow,
    /distribucion\/SHA256SUMS/u,
    'el manifiesto de hashes debe adjuntarse al release',
  );
});

test('archivos-cache.json es una lista JSON no vacía de rutas de texto', () => {
  const archivos = leerJson(MANIFIESTO_CACHE);
  assert.ok(Array.isArray(archivos), `${MANIFIESTO_CACHE} debe ser un array`);
  assert.ok(archivos.length > 0, `${MANIFIESTO_CACHE} no puede estar vacío`);
  assert.ok(
    archivos.every((archivo) => typeof archivo === 'string'),
    `${MANIFIESTO_CACHE} solo debe contener texto`,
  );
});

test('el contrato JSON rechaza comentarios y strings usados como señuelo', () => {
  const señuelos = [
    '// ["./linea"]\n["./real"]',
    '/* ["./bloque"] */\n["./real"]',
    '"const ARCHIVOS = [\\"./string\\"];"',
  ];

  for (const contenido of señuelos) {
    let esListaDeRutas = false;
    try {
      const datos = JSON.parse(contenido);
      esListaDeRutas = Array.isArray(datos)
        && datos.length > 0
        && datos.every((rutaCache) => typeof rutaCache === 'string');
    } catch {
      // Un comentario no forma parte de la gramática JSON y debe caer aquí.
    }
    assert.equal(esListaDeRutas, false, `se aceptó el señuelo: ${contenido}`);
  }
});

test('las rutas de archivos-cache.json son relativas, únicas y quedan dentro del proyecto', () => {
  const archivos = leerJson(MANIFIESTO_CACHE);
  const destinos = archivos.map((archivo) => new URL(archivo, URL_RAIZ));

  assert.ok(
    archivos.every((archivo) => archivo.startsWith('./')),
    'todas las rutas deben empezar por ./',
  );
  assert.ok(
    destinos.every((destino) => (
      destino.protocol === 'file:'
      && destino.href.startsWith(URL_RAIZ.href)
      && !destino.search
      && !destino.hash
    )),
    'una ruta sale del directorio del proyecto',
  );
  assert.equal(
    new Set(destinos.map(({ href }) => href)).size,
    destinos.length,
    'hay rutas repetidas',
  );
});

test('todas las rutas de archivos-cache.json existen en disco', () => {
  const archivos = leerJson(MANIFIESTO_CACHE);
  const faltantes = archivos.filter((archivo) => {
    const destino = archivo.endsWith('/') ? `${archivo}index.html` : archivo;
    return !existsSync(ruta(destino));
  });

  assert.deepEqual(faltantes, [], `faltan rutas de cache: ${faltantes.join(', ')}`);
});

test('sw.js carga, valida y guarda el manifiesto canónico antes de sus archivos', () => {
  const trabajador = leer('sw.js');

  assert.match(
    trabajador,
    /const MANIFIESTO_CACHE = '\.\/archivos-cache\.json';/u,
    'sw.js no apunta al manifiesto canónico',
  );
  assert.match(
    trabajador,
    /fetch\(MANIFIESTO_CACHE,\s*\{\s*cache:\s*'reload'\s*\}\)/u,
    'el manifiesto podría salir de la caché HTTP anterior',
  );
  assert.match(
    trabajador,
    /validarRutasCache\(await respuesta\.json\(\)\)/u,
    'sw.js no valida el JSON recibido',
  );
  assert.match(
    trabajador,
    /cache\.put\(\s*MANIFIESTO_CACHE,/u,
    'el propio manifiesto no queda disponible sin conexión',
  );
});

test('sw.js no vuelve a incrustar ni evaluar una segunda fuente de rutas', () => {
  const trabajador = leer('sw.js');
  assert.doesNotMatch(trabajador, /\b(?:const|let|var)\s+ARCHIVOS\b/u);
  assert.doesNotMatch(trabajador, /\b(?:eval|Function)\s*\(/u);
});

test('la instalación rechaza rutas externas y cachea un manifiesto válido', async () => {
  const teniaSelf = Object.hasOwn(globalThis, 'self');
  const teniaCaches = Object.hasOwn(globalThis, 'caches');
  const selfOriginal = globalThis.self;
  const cachesOriginal = globalThis.caches;
  const fetchOriginal = globalThis.fetch;
  const eventos = new Map();
  const guardados = [];
  const peticiones = [];
  let rutasRemotas = ['./../otro-proyecto/index.html'];
  let activaciones = 0;

  globalThis.self = {
    location: new URL('https://ejemplo.test/bloquitos/sw.js'),
    clients: { claim: async () => {} },
    addEventListener(tipo, manejador) {
      eventos.set(tipo, manejador);
    },
    async skipWaiting() {
      activaciones += 1;
    },
  };
  globalThis.caches = {
    async open() {
      return {
        async put(clave) {
          guardados.push(String(clave));
        },
      };
    },
    async keys() {
      return [];
    },
  };
  globalThis.fetch = async (entrada, opciones = {}) => {
    const ruta = String(entrada);
    peticiones.push([ruta, opciones.cache]);
    return ruta === './archivos-cache.json'
      ? new Response(JSON.stringify(rutasRemotas), { status: 200 })
      : new Response(`contenido de ${ruta}`, { status: 200 });
  };

  function instalar() {
    let promesa;
    eventos.get('install')({
      waitUntil(trabajo) {
        promesa = trabajo;
      },
    });
    return promesa;
  }

  try {
    await import('../sw.js');

    await assert.rejects(instalar(), /sale del alcance del trabajador/u);
    assert.equal(activaciones, 0, 'un manifiesto inseguro llegó a activar el trabajador');
    assert.deepEqual(guardados, [], 'un manifiesto inseguro llegó a la cache');

    rutasRemotas = ['./', './index.html'];
    peticiones.length = 0;
    await instalar();

    assert.equal(activaciones, 1, 'el trabajador válido no terminó de instalarse');
    assert.deepEqual(
      new Set(guardados),
      new Set(['./archivos-cache.json', './', './index.html']),
    );
    assert.deepEqual(
      peticiones,
      [
        ['./archivos-cache.json', 'reload'],
        ['./', 'reload'],
        ['./index.html', 'reload'],
      ],
    );
  } finally {
    if (teniaSelf) globalThis.self = selfOriginal;
    else delete globalThis.self;
    if (teniaCaches) globalThis.caches = cachesOriginal;
    else delete globalThis.caches;
    globalThis.fetch = fetchOriginal;
  }
});

test('index.html usa rutas relativas y declara la imagen social', () => {
  const html = leer('index.html');
  const rutasAbsolutas = [
    ...valoresDeAtributo(html, 'src'),
    ...valoresDeAtributo(html, 'href'),
  ].filter((valor) => valor.startsWith('/'));

  assert.deepEqual(
    rutasAbsolutas,
    [],
    `src/href contiene rutas que empiezan por /: ${rutasAbsolutas.join(', ')}`,
  );

  const metadatos = html.match(/<meta\b[^>]*>/gi) ?? [];
  assert.ok(
    metadatos.some((etiqueta) => /\bproperty\s*=\s*(["'])og:image\1/i.test(etiqueta)),
    'falta la etiqueta meta con property="og:image"',
  );
});

test('manifest.webmanifest es JSON válido y usa un start_url relativo', () => {
  const manifiesto = leerJson('manifest.webmanifest');
  assert.equal(typeof manifiesto.start_url, 'string', 'start_url debe ser texto');
  assert.ok(manifiesto.start_url.trim(), 'start_url no puede estar vacío');
  assert.ok(!manifiesto.start_url.startsWith('/'), 'start_url no debe comenzar por /');
  assert.doesNotMatch(
    manifiesto.start_url,
    /^[a-z][a-z\d+.-]*:/iu,
    'start_url no debe incluir un esquema absoluto',
  );
});

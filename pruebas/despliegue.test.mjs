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
import { runInNewContext } from 'node:vm';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

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

test('todas las rutas de ARCHIVOS en sw.js existen en disco', () => {
  const trabajador = leer('sw.js');
  const declaracion = trabajador.match(
    /\b(?:const|let|var)\s+ARCHIVOS\s*=\s*(\[[\s\S]*?\])\s*;/u,
  );
  assert.ok(declaracion, 'no se encontró el array ARCHIVOS en sw.js');

  const archivosEvaluados = runInNewContext(
    declaracion[1],
    Object.create(null),
    { timeout: 100 },
  );
  assert.ok(Array.isArray(archivosEvaluados), 'ARCHIVOS debe ser un array');
  // Se copia al contexto actual para que las comparaciones estrictas de Node no
  // tropiecen con el prototipo Array aislado que crea node:vm.
  const archivos = Array.from(archivosEvaluados);
  assert.ok(archivos.length > 0, 'ARCHIVOS no puede estar vacío');
  assert.ok(
    archivos.every((archivo) => typeof archivo === 'string'),
    'ARCHIVOS solo debe contener rutas de texto',
  );

  const faltantes = archivos.filter((archivo) => !existsSync(ruta(archivo)));
  assert.deepEqual(faltantes, [], `faltan rutas de ARCHIVOS: ${faltantes.join(', ')}`);
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

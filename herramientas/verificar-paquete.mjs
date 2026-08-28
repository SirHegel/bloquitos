#!/usr/bin/env node
/**
 * verificar-paquete.mjs — Comprueba que lo que se va a desplegar sirve.
 *
 * Se ejecuta después de la construcción:
 *     node herramientas/verificar-paquete.mjs        (o: npm run verificar)
 *
 * POR QUÉ NO BASTA CON QUE construir.mjs TERMINE BIEN
 *
 * construir.mjs comprueba lo que él mismo acaba de hacer. Este script comprueba
 * el estado del repositorio tal y como va a salir a producción, que no es lo
 * mismo. Dos fallos reales que la construcción no puede ver:
 *
 *   - Alguien toca js/render.js, se olvida de reconstruir y sube el paquete de
 *     anteayer. Todo despliega en verde y el arreglo no está en el juego.
 *   - Alguien renombra un icono y no actualiza sw.js. El trabajador de servicio
 *     pide en cache un archivo que ya no existe y el modo sin conexión queda
 *     cojo, en silencio, solo para quien ya tenía el juego instalado.
 *
 * Ninguno de los dos rompe la construcción. Los dos rompen el juego.
 *
 * QUÉ COMPRUEBA
 *
 *   1. js/bloquitos.js existe y no está vacío.
 *   2. No queda ninguna línea suelta que empiece por `import ` o `export `.
 *   3. Su fecha de modificación no es anterior a la del módulo más reciente de
 *      js/*.js, es decir: el paquete no está desactualizado.
 *   4. Todos los archivos del array ARCHIVOS de sw.js existen en disco.
 *
 * Devuelve 0 si todo está bien, y 1 con un mensaje por cada fallo. Se recogen
 * los cuatro y se informa de todos a la vez: en un despliegue remoto, arreglar
 * de uno en uno cuesta una vuelta completa por cada error.
 */

import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { leerArrayJsonDeclarado } from './leer-array-json.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAQUETE = 'js/bloquitos.js';
const MODULOS = 'js';
const TRABAJADOR = 'sw.js';

/**
 * Margen al comparar fechas de modificación.
 *
 * `git clone` y `git checkout` escriben todos los archivos con la marca de
 * tiempo del momento, en el orden que les toque, con milisegundos de diferencia
 * entre uno y otro. Sin margen, una copia recién clonada fallaría esta
 * comprobación por unos milisegundos de nada, sin que el paquete tenga ningún
 * problema. Dos segundos absorben esa diferencia y siguen delatando lo que
 * importa: un paquete olvidado es de minutos, horas o días antes, nunca de
 * dos segundos.
 */
const MARGEN_MS = 2000;

/** Cada fallo lleva un titular y, si ayuda, las líneas que explican qué hacer. */
const fallos = [];
function fallar(titulo, ...detalles) {
  fallos.push({ titulo, detalles });
}

/** Fecha corta y sin ambigüedad de zona horaria, para comparar de un vistazo. */
function fecha(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. El paquete existe y tiene contenido
// ─────────────────────────────────────────────────────────────────────────────

let infoPaquete = null;
let contenido = null;

try {
  infoPaquete = statSync(join(RAIZ, PAQUETE));

  if (!infoPaquete.isFile()) {
    fallar(`${PAQUETE} existe pero no es un archivo.`);
    infoPaquete = null;
  } else if (infoPaquete.size === 0) {
    fallar(
      `${PAQUETE} está vacío (0 bytes).`,
      'Genéralo con: node herramientas/construir.mjs',
    );
  } else {
    contenido = readFileSync(join(RAIZ, PAQUETE), 'utf8');
  }
} catch (error) {
  fallar(
    error.code === 'ENOENT'
      ? `${PAQUETE} no existe.`
      : `${PAQUETE} no se puede leer (${error.code || error.message}).`,
    'index.html lo carga con <script src="js/bloquitos.js">: sin ese archivo',
    'la página se ve entera y no se ejecuta ni una línea de JavaScript.',
    'Genéralo con: node herramientas/construir.mjs',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. No quedan import ni export residuales
// ─────────────────────────────────────────────────────────────────────────────

// El paquete es un script clásico, no un módulo. Un `import` o un `export` en
// el nivel superior no es un error de una línea: el navegador rechaza el archivo
// completo con un error de sintaxis y no arranca nada.
if (contenido !== null) {
  const residuos = [];

  contenido.split('\n').forEach((linea, i) => {
    if (/^\s*(import|export)\s/.test(linea)) {
      residuos.push(`línea ${i + 1}: ${linea.trim()}`);
    }
  });

  if (residuos.length) {
    fallar(
      `${PAQUETE} conserva ${residuos.length} línea(s) de import/export:`,
      ...residuos,
      '',
      'construir.mjs no ha sabido quitarlas. Revisa las expresiones',
      'quitarImports y quitarExports en herramientas/construir.mjs.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. El paquete no es más antiguo que los módulos de los que sale
// ─────────────────────────────────────────────────────────────────────────────

// Se lee el directorio en lugar del array ORDEN de construir.mjs a propósito:
// así también entra en la comprobación un módulo nuevo que alguien haya añadido
// a js/ y todavía no haya declarado en ORDEN.
let modulos = [];

try {
  modulos = readdirSync(join(RAIZ, MODULOS))
    .filter((nombre) => nombre.endsWith('.js') && `${MODULOS}/${nombre}` !== PAQUETE)
    .map((nombre) => ({
      ruta: `${MODULOS}/${nombre}`,
      mtimeMs: statSync(join(RAIZ, MODULOS, nombre)).mtimeMs,
    }));
} catch (error) {
  fallar(`No se puede leer el directorio ${MODULOS}/ (${error.code || error.message}).`);
}

if (!modulos.length && !fallos.some((f) => f.titulo.includes(`${MODULOS}/`))) {
  fallar(
    `No hay ningún módulo en ${MODULOS}/ aparte del paquete generado.`,
    'Los módulos fuente son el original del que sale bloquitos.js: sin ellos',
    'el paquete no se puede regenerar ni verificar.',
  );
}

if (modulos.length && infoPaquete) {
  const reciente = modulos.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a));

  if (infoPaquete.mtimeMs + MARGEN_MS < reciente.mtimeMs) {
    const atraso = Math.round((reciente.mtimeMs - infoPaquete.mtimeMs) / 1000);
    fallar(
      `${PAQUETE} está desactualizado: ${atraso} s más antiguo que ${reciente.ruta}.`,
      `${reciente.ruta}  →  ${fecha(reciente.mtimeMs)}`,
      `${PAQUETE}  →  ${fecha(infoPaquete.mtimeMs)}`,
      '',
      'El navegador solo carga el paquete, nunca los módulos sueltos, así que',
      'ese cambio no está en el juego. Reconstruye con:',
      '    node herramientas/construir.mjs',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Todo lo que sw.js manda cachear existe de verdad
// ─────────────────────────────────────────────────────────────────────────────

// El array se extrae como JSON estricto en vez de importar sw.js, porque ese
// archivo usa `self`, `caches` y `addEventListener`: fuera de un navegador no se
// puede ejecutar. Tratar la lista como datos impide que una expresión insertada
// en el archivo se ejecute con los privilegios de este proceso de verificación.
let rutasCache = [];
let codigoTrabajador = null;

try {
  codigoTrabajador = readFileSync(join(RAIZ, TRABAJADOR), 'utf8');
} catch (error) {
  fallar(
    error.code === 'ENOENT'
      ? `${TRABAJADOR} no existe: sin trabajador de servicio no hay modo sin conexión ni instalación.`
      : `${TRABAJADOR} no se puede leer (${error.code || error.message}).`,
  );
}

if (codigoTrabajador !== null) {
  try {
    rutasCache = leerArrayJsonDeclarado(codigoTrabajador, 'ARCHIVOS');

    if (!rutasCache.length) {
      fallar(`El array ARCHIVOS de ${TRABAJADOR} está vacío: el juego no funcionaría sin conexión.`);
    }
  } catch (error) {
    fallar(
      `El array ARCHIVOS de ${TRABAJADOR} no es una lista JSON segura (${error.message}).`,
      'Decláralo como un array de cadenas con comillas dobles, sin comentarios,',
      'expresiones ni comas finales. El verificador nunca ejecuta sw.js.',
    );
  }
}

if (rutasCache.length) {
  const ausentes = [];

  for (const ruta of rutasCache) {
    // './' y cualquier ruta de directorio las sirve el servidor como index.html;
    // el resto se comprueban tal cual, quitando el './' de delante.
    const relativa = ruta.replace(/^\.\//, '');
    const destino = relativa === '' || relativa.endsWith('/')
      ? join(relativa, 'index.html')
      : relativa;

    if (!existsSync(join(RAIZ, destino))) {
      ausentes.push(destino === relativa ? `${ruta} — no existe` : `${ruta} → ${destino} — no existe`);
    }
  }

  if (ausentes.length) {
    fallar(
      `${ausentes.length} de los ${rutasCache.length} archivos de ARCHIVOS (${TRABAJADOR}) no están en disco:`,
      ...ausentes,
      '',
      'sw.js añade cada uno por separado, así que el resto sí se cachea y el',
      'fallo no se nota hasta que alguien juega sin conexión y le falta justo',
      'eso. Corrige la lista de ARCHIVOS o restaura los archivos que falten.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado
// ─────────────────────────────────────────────────────────────────────────────

if (fallos.length) {
  console.error(`✗ El paquete no está listo para desplegar (${fallos.length === 1 ? '1 fallo' : `${fallos.length} fallos`}):`);
  fallos.forEach(({ titulo, detalles }, i) => {
    console.error('');
    console.error(`  ${i + 1}. ${titulo}`);
    detalles.forEach((linea) => console.error(linea ? `     ${linea}` : ''));
  });
  console.error('');
  process.exit(1);
}

console.log(`✓ ${PAQUETE} — ${(infoPaquete.size / 1024).toFixed(1)} KB, al día respecto a ${modulos.length} módulos`);
console.log('  sin import ni export sueltos');
console.log(`  ${rutasCache.length} archivos de la cache de ${TRABAJADOR} presentes en disco`);

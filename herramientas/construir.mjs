#!/usr/bin/env node
/**
 * construir.mjs — Genera el paquete que funciona con doble clic.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * El código está escrito en módulos ES (`import` / `export`), que es lo correcto
 * para mantenerlo ordenado. Pero los navegadores aplican CORS a los módulos, y
 * el protocolo `file://` no tiene origen válido. Resultado: al abrir index.html
 * con doble clic, el navegador bloquea todos los módulos y no se ejecuta ni una
 * línea de JavaScript. La página se ve, pero ningún botón responde.
 *
 * Los scripts clásicos (sin `type="module"`) no pasan por CORS y sí cargan desde
 * `file://`. Así que esta herramienta une todos los módulos en un único script
 * clásico envuelto en una función anónima, quitando los `import` y `export`.
 *
 * Se ejecuta con:  node herramientas/construir.mjs
 *
 * TAMBIÉN ES EL COMANDO DE CONSTRUCCIÓN DE VERCEL
 *
 * `vercel.json` lo declara como `buildCommand`, de modo que Vercel lo ejecuta en
 * cada despliegue y decide por el código de salida si publica o cancela. El
 * contrato es estricto:
 *
 *   0 → js/bloquitos.js se ha escrito entero y se ha releído desde disco.
 *   1 → falta algún módulo del array ORDEN, ha quedado algún import/export
 *       suelto o no se ha podido escribir la salida. El motivo va por stderr.
 *
 * La diferencia importa porque un fallo silencioso aquí no rompe el despliegue:
 * lo publica a medias. La página cargaría, el jugador vería el tablero y ningún
 * botón respondería. Por eso cualquier problema termina en salida 1, y la
 * escritura es atómica: o queda el paquete completo, o queda el anterior.
 */

import { readFileSync, writeFileSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Orden de concatenación: cada archivo debe ir después de aquellos de los que
 * depende, porque al unirlos se pierde la resolución automática de los módulos.
 */
const ORDEN = [
  'js/piezas.js',
  'js/tablero.js',
  'js/temas.js',
  'js/audio.js',
  'js/basedatos.js',
  'js/render.js',
  'js/juego.js',
  'js/controles.js',
  'js/main.js',
];

const SALIDA = 'js/bloquitos.js';

// Se escribe primero aquí y luego se renombra encima del destino. Renombrar
// dentro del mismo directorio es una operación atómica: si el proceso muere a
// media escritura, js/bloquitos.js sigue siendo el de antes, nunca medio archivo.
const TEMPORAL = `${SALIDA}.tmp`;

/** Quita las líneas de `import`, incluidas las que ocupan varias líneas. */
function quitarImports(codigo) {
  return codigo.replace(/^import\s+[^;]*?from\s*['"][^'"]+['"]\s*;?[ \t]*\r?\n?/gms, '');
}

/** Quita el prefijo `export` dejando intacta la declaración. */
function quitarExports(codigo) {
  return codigo.replace(/^export\s+(?=(const|let|var|function|class|async)\b)/gm, '');
}

/** Aborta con un mensaje por stderr y código 1, el que Vercel lee como fallo. */
function abortar(titulo, ...detalles) {
  console.error(`✗ ${titulo}`);
  detalles.forEach((linea) => console.error(linea ? `   ${linea}` : ''));
  process.exit(1);
}

/** Tamaño legible en KB, la unidad en la que se piensa el peso de un paquete. */
function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Lee los módulos de ORDEN comprobando antes que estén todos.
 *
 * Sin esta comprobación, un módulo renombrado hace que readFileSync lance una
 * excepción con traza de Node: sale con código 1, sí, pero el mensaje habla de
 * ENOENT y no de qué falta ni de dónde. En un registro de despliegue de Vercel
 * eso cuesta diez minutos de lectura. Aquí se revisan los nueve de golpe y se
 * dice exactamente cuáles faltan.
 */
function leerModulos() {
  const problemas = [];
  const modulos = [];

  for (const ruta of ORDEN) {
    const completa = join(RAIZ, ruta);
    try {
      const info = statSync(completa);
      if (!info.isFile()) {
        problemas.push(`${ruta} — existe pero no es un archivo`);
        continue;
      }
      modulos.push({ ruta, codigo: readFileSync(completa, 'utf8'), bytes: info.size });
    } catch (error) {
      problemas.push(
        error.code === 'ENOENT'
          ? `${ruta} — no existe`
          : `${ruta} — no se puede leer (${error.code || error.message})`,
      );
    }
  }

  if (problemas.length) {
    abortar(
      `Faltan ${problemas.length} de los ${ORDEN.length} módulos del array ORDEN:`,
      ...problemas,
      '',
      'Si los has renombrado o movido, actualiza el array ORDEN en este mismo',
      'archivo. El paquete no se ha tocado: sigue en pie el anterior.',
    );
  }

  return modulos;
}

function construir() {
  const modulos = leerModulos();
  const bytesOriginales = modulos.reduce((total, m) => total + m.bytes, 0);

  const partes = modulos.map(({ ruta, codigo }) => {
    const limpio = quitarExports(quitarImports(codigo));
    return `\n// ${'═'.repeat(70)}\n// ${ruta}\n// ${'═'.repeat(70)}\n\n${limpio.trim()}\n`;
  });

  const salida = `/**
 * bloquitos.js — GENERADO AUTOMÁTICAMENTE. No editar a mano.
 *
 * Este archivo une todos los módulos de js/ en un único script clásico, para
 * que el juego funcione al abrir index.html directamente con doble clic
 * (protocolo file://), donde los módulos ES están bloqueados por CORS.
 *
 * Para regenerarlo tras cambiar cualquier módulo:
 *     node herramientas/construir.mjs
 */
'use strict';
(function () {
${partes.join('\n')}
})();
`;

  // Comprobación: si quedara algún import o export sueltos, el archivo fallaría
  // en el navegador con un error de sintaxis. Mejor detectarlo aquí, y hacerlo
  // antes de escribir nada, para no dejar en disco un paquete que no arranca.
  const sobrantes = [];
  salida.split('\n').forEach((linea, i) => {
    if (/^\s*import\s+.*\bfrom\b/.test(linea)) sobrantes.push(`línea ${i + 1}: ${linea.trim()}`);
    if (/^\s*export\s+(const|let|var|function|class|async|\{|default)/.test(linea)) sobrantes.push(`línea ${i + 1}: ${linea.trim()}`);
  });

  if (sobrantes.length) {
    abortar(
      'Han quedado import/export sin quitar:',
      ...sobrantes,
      '',
      'El navegador rechazaría el archivo entero con un error de sintaxis.',
      'Suele pasar con formas que las expresiones de arriba no cubren, como',
      '`export { algo }` o `export default`. El paquete no se ha escrito.',
    );
  }

  const bytesFinales = Buffer.byteLength(salida, 'utf8');
  const rutaTemporal = join(RAIZ, TEMPORAL);
  const rutaFinal = join(RAIZ, SALIDA);

  try {
    writeFileSync(rutaTemporal, salida, 'utf8');
    renameSync(rutaTemporal, rutaFinal);
  } catch (error) {
    try {
      unlinkSync(rutaTemporal);
    } catch {
      // Si el temporal no llegó a existir, no hay nada que limpiar.
    }
    abortar(
      `No se ha podido escribir ${SALIDA} (${error.code || error.message}).`,
      'Comprueba los permisos del directorio js/ y que quede espacio en disco.',
    );
  }

  // Releer lo que acaba de escribirse. Parece redundante y no lo es: es lo único
  // que distingue "he llamado a writeFileSync" de "el paquete está en disco y
  // está entero". Con esto, salir con código 0 significa exactamente eso.
  let comprobado;
  try {
    comprobado = statSync(rutaFinal);
  } catch (error) {
    abortar(`${SALIDA} no está en disco después de escribirlo (${error.code || error.message}).`);
  }

  if (comprobado.size !== bytesFinales) {
    abortar(
      `${SALIDA} se ha escrito incompleto.`,
      `Esperados ${bytesFinales} bytes, encontrados ${comprobado.size}.`,
      'Casi siempre es el disco lleno. Libera espacio y vuelve a construir.',
    );
  }

  console.log(`✓ ${SALIDA}`);
  console.log(`  ${modulos.length} módulos unidos · ${kb(bytesOriginales)} → ${kb(bytesFinales)}`);
  console.log('  sin import ni export sueltos');
}

construir();

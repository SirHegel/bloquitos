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
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
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

/** Quita las líneas de `import`, incluidas las que ocupan varias líneas. */
function quitarImports(codigo) {
  return codigo.replace(/^import\s+[^;]*?from\s*['"][^'"]+['"]\s*;?[ \t]*\r?\n?/gms, '');
}

/** Quita el prefijo `export` dejando intacta la declaración. */
function quitarExports(codigo) {
  return codigo.replace(/^export\s+(?=(const|let|var|function|class|async)\b)/gm, '');
}

function construir() {
  const partes = [];
  let bytesOriginales = 0;

  for (const ruta of ORDEN) {
    const completa = join(RAIZ, ruta);
    let codigo = readFileSync(completa, 'utf8');
    bytesOriginales += statSync(completa).size;

    codigo = quitarExports(quitarImports(codigo));

    partes.push(`\n// ${'═'.repeat(70)}\n// ${ruta}\n// ${'═'.repeat(70)}\n\n${codigo.trim()}\n`);
  }

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

  writeFileSync(join(RAIZ, SALIDA), salida, 'utf8');

  // Comprobación: si quedara algún import o export sueltos, el archivo fallaría
  // en el navegador con un error de sintaxis. Mejor detectarlo aquí.
  const sobrantes = [];
  const lineas = salida.split('\n');
  lineas.forEach((linea, i) => {
    if (/^\s*import\s+.*\bfrom\b/.test(linea)) sobrantes.push(`línea ${i + 1}: ${linea.trim()}`);
    if (/^\s*export\s+(const|let|var|function|class|async|\{|default)/.test(linea)) sobrantes.push(`línea ${i + 1}: ${linea.trim()}`);
  });

  if (sobrantes.length) {
    console.error('✗ Han quedado import/export sin quitar:');
    sobrantes.forEach((s) => console.error('   ' + s));
    process.exit(1);
  }

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(`✓ ${SALIDA}`);
  console.log(`  ${ORDEN.length} módulos · ${kb(bytesOriginales)} → ${kb(salida.length)}`);
  console.log('  sin import ni export sueltos');
}

construir();

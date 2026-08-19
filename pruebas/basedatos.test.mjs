/**
 * basedatos.test.mjs — Pruebas de la base de datos.
 *
 * En Node no existe IndexedDB, así que el módulo cae automáticamente a su
 * almacén en memoria. Eso es justamente lo que se quiere comprobar aquí: que la
 * ruta de emergencia funciona igual de bien, porque es la que se usa cuando un
 * navegador en modo privado deniega el acceso a la base de datos.
 *
 * Se ejecuta con:  node --test pruebas/basedatos.test.mjs
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  abrir, guardarPartida, mejoresPartidas, ultimasPartidas, estadisticas,
  leerAjuste, guardarAjuste, logrosConseguidos, revisarLogros, borrarTodo,
  enMemoria, migrarDesdeLocalStorage, LOGROS, ALMACENES,
} from '../js/basedatos.js';

before(async () => {
  await abrir();
});

// ── Modo de emergencia ──────────────────────────────────────────────────────

test('sin IndexedDB, la base cae a memoria en vez de romper', () => {
  assert.equal(enMemoria(), true, 'debería estar en modo memoria bajo Node');
});

test('la migración no revienta aunque no exista localStorage', async () => {
  await assert.doesNotReject(() => migrarDesdeLocalStorage());
});

test('los nombres de los almacenes están definidos', () => {
  assert.equal(ALMACENES.PARTIDAS, 'partidas');
  assert.equal(ALMACENES.AJUSTES, 'ajustes');
  assert.equal(ALMACENES.LOGROS, 'logros');
});

// ── Partidas ────────────────────────────────────────────────────────────────

const partidaBase = {
  fecha: 1_700_000_000_000,
  puntos: 1500, lineas: 12, nivel: 1, piezas: 60,
  segundos: 120, maxCombo: 2, maxLineasDeGolpe: 2, girosT: 0,
};

test('guardar y recuperar una partida conserva los datos', async () => {
  await borrarTodo();
  await guardarPartida(partidaBase);
  const ultimas = await ultimasPartidas(5);
  assert.equal(ultimas.length, 1);
  assert.equal(ultimas[0].puntos, 1500);
  assert.equal(ultimas[0].lineas, 12);
  assert.equal(ultimas[0].maxCombo, 2);
});

test('las mejores partidas salen ordenadas de mayor a menor', async () => {
  await borrarTodo();
  for (const p of [300, 2500, 100, 900, 1700]) {
    await guardarPartida({ ...partidaBase, puntos: p });
  }
  const mejores = await mejoresPartidas(10);
  assert.deepEqual(mejores.map((m) => m.puntos), [2500, 1700, 900, 300, 100]);
});

test('mejoresPartidas respeta el límite pedido', async () => {
  await borrarTodo();
  for (let i = 1; i <= 25; i++) await guardarPartida({ ...partidaBase, puntos: i * 10 });
  assert.equal((await mejoresPartidas(10)).length, 10);
  assert.equal((await mejoresPartidas(3)).length, 3);
});

test('las últimas partidas salen de más reciente a más antigua', async () => {
  await borrarTodo();
  await guardarPartida({ ...partidaBase, fecha: 1000, puntos: 10 });
  await guardarPartida({ ...partidaBase, fecha: 3000, puntos: 30 });
  await guardarPartida({ ...partidaBase, fecha: 2000, puntos: 20 });
  const u = await ultimasPartidas(5);
  assert.deepEqual(u.map((p) => p.fecha), [3000, 2000, 1000]);
});

// ── Validación de datos ─────────────────────────────────────────────────────

test('los datos corruptos se sanean en vez de guardarse tal cual', async () => {
  await borrarTodo();
  await guardarPartida({
    fecha: 'no es una fecha',
    puntos: -9999,               // negativo: debe quedar en 0
    lineas: 3.9,                 // decimal: debe truncarse
    nivel: null,
    piezas: undefined,
    segundos: NaN,
    maxCombo: 'muchos',
    maxLineasDeGolpe: 99,        // imposible: el máximo real es 4
    girosT: Infinity,
  });
  const [p] = await ultimasPartidas(1);
  assert.equal(p.puntos, 0, 'un valor negativo debe quedar en 0');
  assert.equal(p.lineas, 3, 'los decimales se truncan');
  assert.equal(p.nivel, 0);
  assert.equal(p.piezas, 0);
  assert.equal(p.segundos, 0);
  assert.equal(p.maxCombo, 0);
  assert.equal(p.maxLineasDeGolpe, 4, 'no se puede superar el máximo de 4');
  assert.equal(p.girosT, 0, 'Infinity no es un número válido');
  assert.ok(Number.isFinite(p.fecha) && p.fecha > 0, 'una fecha inválida se sustituye por ahora');
});

// ── Estadísticas ────────────────────────────────────────────────────────────

test('sin partidas, las estadísticas salen a cero sin fallar', async () => {
  await borrarTodo();
  const e = await estadisticas();
  assert.equal(e.partidas, 0);
  assert.equal(e.record, 0);
  assert.equal(e.mediaPuntos, 0);
});

test('las estadísticas agregan bien todas las partidas', async () => {
  await borrarTodo();
  await guardarPartida({ ...partidaBase, puntos: 1000, lineas: 10, nivel: 1, piezas: 40, segundos: 100, maxCombo: 2 });
  await guardarPartida({ ...partidaBase, puntos: 3000, lineas: 30, nivel: 3, piezas: 90, segundos: 200, maxCombo: 5 });

  const e = await estadisticas();
  assert.equal(e.partidas, 2);
  assert.equal(e.record, 3000);
  assert.equal(e.lineasTotales, 40);
  assert.equal(e.nivelMaximo, 3);
  assert.equal(e.piezasTotales, 130);
  assert.equal(e.tiempoTotal, 300);
  assert.equal(e.mediaPuntos, 2000);
  assert.equal(e.mejorCombo, 5);
});

// ── Ajustes ─────────────────────────────────────────────────────────────────

test('los ajustes se guardan y se leen, con valor por defecto si no existen', async () => {
  await borrarTodo();
  assert.equal(await leerAjuste('sonido', true), true, 'sin valor, devuelve el por defecto');
  await guardarAjuste('sonido', false);
  assert.equal(await leerAjuste('sonido', true), false);
  await guardarAjuste('sonido', true);
  assert.equal(await leerAjuste('sonido', true), true);
});

test('un ajuste guardado como false no se confunde con "no existe"', async () => {
  await borrarTodo();
  await guardarAjuste('fantasma', false);
  assert.equal(await leerAjuste('fantasma', true), false);
});

// ── Logros ──────────────────────────────────────────────────────────────────

test('el catálogo de logros está bien formado y sin repetidos', () => {
  assert.ok(LOGROS.length >= 10);
  const ids = LOGROS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, 'hay identificadores repetidos');
  for (const l of LOGROS) {
    assert.ok(l.titulo && l.descripcion && l.icono, `${l.id} está incompleto`);
    assert.equal(typeof l.prueba, 'function', `${l.id} no tiene comprobación`);
  }
});

test('una partida sin méritos no desbloquea nada', async () => {
  await borrarTodo();
  const partida = { ...partidaBase, puntos: 50, lineas: 0, nivel: 0, maxCombo: 0, maxLineasDeGolpe: 0, girosT: 0, segundos: 5 };
  const totales = { partidas: 1, lineasTotales: 0 };
  const nuevos = await revisarLogros(partida, totales);
  assert.equal(nuevos.length, 0);
});

test('completar una línea desbloquea el primer logro', async () => {
  await borrarTodo();
  const nuevos = await revisarLogros(
    { ...partidaBase, lineas: 1, maxLineasDeGolpe: 1 },
    { partidas: 1, lineasTotales: 1 },
  );
  assert.ok(nuevos.some((l) => l.id === 'primera-linea'));
});

test('un cuádruple desbloquea a la vez triple y cuádruple', async () => {
  await borrarTodo();
  const nuevos = await revisarLogros(
    { ...partidaBase, lineas: 4, maxLineasDeGolpe: 4 },
    { partidas: 1, lineasTotales: 4 },
  );
  const ids = nuevos.map((l) => l.id);
  assert.ok(ids.includes('triple'), 'un cuádruple también cumple el triple');
  assert.ok(ids.includes('cuadruple'));
});

test('un logro ya conseguido no se vuelve a anunciar', async () => {
  await borrarTodo();
  const partida = { ...partidaBase, lineas: 1, maxLineasDeGolpe: 1 };
  const totales = { partidas: 1, lineasTotales: 1 };

  const primera = await revisarLogros(partida, totales);
  assert.ok(primera.length > 0);

  const segunda = await revisarLogros(partida, totales);
  assert.equal(segunda.length, 0, 'no debe repetir logros ya conseguidos');

  const guardados = await logrosConseguidos();
  assert.equal(guardados.length, primera.length);
});

test('los logros de nivel se desbloquean en orden al subir', async () => {
  await borrarTodo();
  let ids = (await revisarLogros({ ...partidaBase, nivel: 5 }, { partidas: 1, lineasTotales: 0 })).map((l) => l.id);
  assert.ok(ids.includes('nivel-5'));
  assert.ok(!ids.includes('nivel-10'), 'aún no debería tener el de nivel 10');

  ids = (await revisarLogros({ ...partidaBase, nivel: 12 }, { partidas: 2, lineasTotales: 0 })).map((l) => l.id);
  assert.ok(ids.includes('nivel-10'));
  assert.ok(!ids.includes('nivel-20'));
});

test('un logro con comprobación defectuosa no tumba el resto', async () => {
  await borrarTodo();
  // Se pasan totales incompletos a propósito: alguna comprobación leerá
  // propiedades de undefined. El módulo debe capturarlo y seguir.
  await assert.doesNotReject(async () => {
    await revisarLogros({ ...partidaBase, lineas: 1, maxLineasDeGolpe: 1 }, undefined);
  });
});

// ── Borrado ─────────────────────────────────────────────────────────────────

test('borrar todo deja la base limpia', async () => {
  await guardarPartida(partidaBase);
  await guardarAjuste('sonido', false);
  await revisarLogros({ ...partidaBase, lineas: 1, maxLineasDeGolpe: 1 }, { partidas: 1, lineasTotales: 1 });

  await borrarTodo();

  assert.equal((await ultimasPartidas(10)).length, 0);
  assert.equal((await logrosConseguidos()).length, 0);
  assert.equal((await estadisticas()).partidas, 0);
  assert.equal(await leerAjuste('sonido', true), true, 'los ajustes vuelven a su valor por defecto');
});

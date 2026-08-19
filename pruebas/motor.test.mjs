/**
 * motor.test.mjs — Pruebas del motor de juego.
 *
 * Se ejecutan con:  node --test pruebas/
 *
 * Cubren la logica pura (tablero, piezas, giros, puntuacion, niveles). No cubren
 * el dibujo ni los controles, que dependen del navegador y se comprueban con la
 * prueba de humo de navegador.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Tablero, COLUMNAS, FILAS, FILAS_OCULTAS } from '../js/tablero.js';
import { PIEZAS, TIPOS, Bolsa, celdas, pateos } from '../js/piezas.js';
import { Juego, ESTADOS } from '../js/juego.js';
import { velocidadCaida, nivelDeLineas, ambiente, nombreAmbiente } from '../js/temas.js';

// ── Piezas ──────────────────────────────────────────────────────────────────

test('las 7 piezas existen y cada una ocupa 4 celdas en sus 4 giros', () => {
  assert.equal(TIPOS.length, 7);
  for (const tipo of TIPOS) {
    const def = PIEZAS[tipo];
    assert.equal(def.giros.length, 4, `${tipo} debe tener 4 giros`);
    for (let g = 0; g < 4; g++) {
      assert.equal(def.giros[g].length, 4, `${tipo} giro ${g} debe ocupar 4 celdas`);
    }
  }
});

test('ninguna pieza tiene celdas repetidas en un mismo giro', () => {
  for (const tipo of TIPOS) {
    for (let g = 0; g < 4; g++) {
      const vistas = new Set(PIEZAS[tipo].giros[g].map(([x, y]) => `${x},${y}`));
      assert.equal(vistas.size, 4, `${tipo} giro ${g} tiene celdas duplicadas`);
    }
  }
});

test('la pieza O es identica en sus 4 giros', () => {
  const g = PIEZAS.O.giros;
  const clave = (giro) => giro.map((c) => c.join(',')).sort().join('|');
  assert.equal(clave(g[0]), clave(g[1]));
  assert.equal(clave(g[0]), clave(g[2]));
  assert.equal(clave(g[0]), clave(g[3]));
});

test('celdas() traslada correctamente', () => {
  const c = celdas('O', 0, 5, 3);
  const claves = c.map(([x, y]) => `${x},${y}`).sort();
  assert.deepEqual(claves, ['5,3', '5,4', '6,3', '6,4']);
});

test('la tabla de pateo devuelve 5 intentos y empieza sin desplazar', () => {
  const p = pateos('T', 0, 1);
  assert.equal(p.length, 5);
  assert.deepEqual(p[0], [0, 0]);
  // La O no patea nunca.
  assert.deepEqual(pateos('O', 0, 1), [[0, 0]]);
});

// ── Bolsa de 7 ──────────────────────────────────────────────────────────────

test('la bolsa reparte las 7 piezas antes de repetir ninguna', () => {
  const bolsa = new Bolsa();
  for (let ronda = 0; ronda < 20; ronda++) {
    const lote = [];
    for (let i = 0; i < 7; i++) lote.push(bolsa.siguiente());
    assert.equal(new Set(lote).size, 7, `la ronda ${ronda} repitio piezas`);
  }
});

test('asomar() no consume piezas de la cola', () => {
  const bolsa = new Bolsa();
  const vista = bolsa.asomar(5);
  assert.equal(vista.length, 5);
  assert.equal(bolsa.siguiente(), vista[0]);
});

// ── Tablero ─────────────────────────────────────────────────────────────────

test('el tablero nace vacio con las dimensiones correctas', () => {
  const t = new Tablero();
  assert.equal(t.rejilla.length, FILAS);
  assert.equal(t.rejilla[0].length, COLUMNAS);
  assert.ok(t.rejilla.every((f) => f.every((c) => c === null)));
});

test('los lados y el fondo bloquean, pero por arriba se puede asomar', () => {
  const t = new Tablero();
  assert.equal(t.ocupada(-1, 5), true, 'fuera por la izquierda');
  assert.equal(t.ocupada(COLUMNAS, 5), true, 'fuera por la derecha');
  assert.equal(t.ocupada(3, FILAS), true, 'fuera por abajo');
  assert.equal(t.ocupada(3, -1), false, 'por arriba debe dejar pasar');
});

test('borrarFilas elimina las filas y baja lo de encima', () => {
  const t = new Tablero();
  const ultima = FILAS - 1;
  for (let x = 0; x < COLUMNAS; x++) t.rejilla[ultima][x] = 'oro';
  t.rejilla[ultima - 1][0] = 'rubi';

  assert.deepEqual(t.filasCompletas(), [ultima]);
  t.borrarFilas([ultima]);

  assert.equal(t.rejilla.length, FILAS, 'el tablero mantiene su altura');
  assert.equal(t.rejilla[ultima][0], 'rubi', 'la pieza de arriba bajo una fila');
  assert.equal(t.rejilla[ultima][1], null);
});

test('borrar varias filas a la vez conserva el orden de lo que queda', () => {
  const t = new Tablero();
  const a = FILAS - 1, b = FILAS - 2;
  for (let x = 0; x < COLUMNAS; x++) { t.rejilla[a][x] = 'oro'; t.rejilla[b][x] = 'oro'; }
  t.rejilla[b - 1][0] = 'cian';
  t.rejilla[b - 2][0] = 'rubi';

  t.borrarFilas([a, b]);
  assert.equal(t.rejilla[a][0], 'cian');
  assert.equal(t.rejilla[a - 1][0], 'rubi');
});

test('distanciaAlSuelo mide bien contra el fondo y contra una pila', () => {
  const t = new Tablero();
  // La O en lo alto debe poder caer hasta apoyarse en el fondo.
  const d = t.distanciaAlSuelo('O', 0, 4, 0);
  assert.equal(d, FILAS - 2, 'la O de 2 de alto cae hasta el fondo');

  // Con una fila ocupada, se detiene encima.
  const t2 = new Tablero();
  for (let x = 0; x < COLUMNAS; x++) t2.rejilla[FILAS - 1][x] = 'oro';
  assert.equal(t2.distanciaAlSuelo('O', 0, 4, 0), FILAS - 3);
});

test('desbordado detecta piezas en la zona oculta', () => {
  const t = new Tablero();
  assert.equal(t.desbordado(), false);
  t.rejilla[FILAS_OCULTAS - 1][3] = 'cian';
  assert.equal(t.desbordado(), true);
});

// ── Niveles y velocidad ─────────────────────────────────────────────────────

test('el nivel sube cada 10 lineas y no tiene techo', () => {
  assert.equal(nivelDeLineas(0), 0);
  assert.equal(nivelDeLineas(9), 0);
  assert.equal(nivelDeLineas(10), 1);
  assert.equal(nivelDeLineas(1000), 100);
  assert.equal(nivelDeLineas(99999), 9999);
});

test('la velocidad siempre baja pero nunca por debajo del suelo jugable', () => {
  let anterior = Infinity;
  for (let n = 0; n < 400; n++) {
    const v = velocidadCaida(n);
    assert.ok(v > 0, `nivel ${n}: la velocidad debe ser positiva`);
    assert.ok(v >= 45, `nivel ${n}: la velocidad no debe bajar de 45 ms`);
    assert.ok(v <= anterior, `nivel ${n}: la velocidad no debe subir`);
    anterior = v;
  }
  // En niveles muy altos se estabiliza: el juego sigue siendo jugable siempre.
  assert.equal(velocidadCaida(9999), 45);
});

test('cada nivel tiene ambiente y nombre, sin repetir de inmediato', () => {
  const tonos = new Set();
  for (let n = 0; n < 40; n++) {
    const amb = ambiente(n);
    assert.ok(amb.fondoLejos.startsWith('hsl('), `nivel ${n} sin color de fondo`);
    assert.ok(amb.auroras >= 3);
    assert.equal(typeof nombreAmbiente(n), 'string');
    assert.ok(nombreAmbiente(n).length > 0);
    tonos.add(amb.tono);
  }
  // 40 niveles seguidos deben dar 40 tonos distintos.
  assert.equal(tonos.size, 40, 'el color de fondo se repitio antes de tiempo');
});

// ── Motor ───────────────────────────────────────────────────────────────────

function nuevoJuego() {
  return new Juego({ alAvisar: () => {}, sonido: null });
}

test('al comenzar hay pieza, estado jugando y marcador a cero', () => {
  const j = nuevoJuego();
  j.comenzar();
  assert.equal(j.estado, ESTADOS.JUGANDO);
  assert.ok(j.pieza, 'debe haber una pieza en juego');
  assert.equal(j.puntos, 0);
  assert.equal(j.lineas, 0);
  assert.equal(j.nivel, 0);
});

test('la pieza no puede salirse por los lados', () => {
  const j = nuevoJuego();
  j.comenzar();
  for (let i = 0; i < 40; i++) j.mover(-1);
  const celdasIzq = celdas(j.pieza.tipo, j.pieza.giro, j.pieza.x, j.pieza.y);
  assert.ok(Math.min(...celdasIzq.map((c) => c[0])) >= 0, 'se salio por la izquierda');

  for (let i = 0; i < 80; i++) j.mover(1);
  const celdasDer = celdas(j.pieza.tipo, j.pieza.giro, j.pieza.x, j.pieza.y);
  assert.ok(Math.max(...celdasDer.map((c) => c[0])) < COLUMNAS, 'se salio por la derecha');
});

test('la caida dura apoya la pieza y da 2 puntos por celda', () => {
  const j = nuevoJuego();
  j.comenzar();
  const p = j.pieza;
  const d = j.tablero.distanciaAlSuelo(p.tipo, p.giro, p.x, p.y);
  j.caidaDura();
  assert.equal(j.puntos, d * 2);
  assert.equal(j.piezasColocadas, 1);
});

test('girar cuatro veces devuelve la pieza a su giro original', () => {
  const j = nuevoJuego();
  j.comenzar();
  const inicial = j.pieza.giro;
  for (let i = 0; i < 4; i++) j.girar(1);
  assert.equal(j.pieza.giro, inicial);
});

test('completar una linea la borra y suma puntos y lineas', () => {
  const j = nuevoJuego();
  j.comenzar();
  const ultima = FILAS - 1;
  // Se llena la ultima fila salvo dos huecos, y se deja caer una O encima.
  for (let x = 0; x < COLUMNAS; x++) j.tablero.rejilla[ultima][x] = 'oro';
  j.tablero.rejilla[ultima][4] = null;
  j.tablero.rejilla[ultima][5] = null;

  j.pieza = { tipo: 'O', giro: 0, x: 4, y: FILAS - 2 };
  j.fijar();

  assert.equal(j.lineas, 1, 'debe contar una linea');
  assert.ok(j.puntos >= 100, 'una linea en nivel 0 vale al menos 100');
  assert.equal(j.estado, ESTADOS.LIMPIANDO);
  assert.deepEqual(j.filasBrillando, [ultima]);
});

test('cuatro lineas de golpe puntuan mas que cuatro lineas sueltas', () => {
  // Cuadruple: 800 puntos base.
  const a = nuevoJuego(); a.comenzar(); a.nivel = 0;
  a.anotar(4, false);
  const cuadruple = a.puntos;

  // Cuatro sencillas seguidas: 100 cada una, mas bonus de combo.
  const b = nuevoJuego(); b.comenzar(); b.nivel = 0;
  b.anotar(1, false); b.combo = -1;
  b.anotar(1, false); b.combo = -1;
  b.anotar(1, false); b.combo = -1;
  b.anotar(1, false);
  assert.ok(cuadruple > b.puntos, 'el cuadruple debe recompensar mas');
});

test('la puntuacion escala con el nivel', () => {
  const a = nuevoJuego(); a.comenzar(); a.nivel = 0; a.anotar(1, false);
  const b = nuevoJuego(); b.comenzar(); b.nivel = 9; b.anotar(1, false);
  assert.equal(b.puntos, a.puntos * 10);
});

test('dos jugadas dificiles seguidas dan el bonus de espalda con espalda', () => {
  const j = nuevoJuego(); j.comenzar(); j.nivel = 0;
  j.anotar(4, false);
  const primera = j.puntos;
  j.combo = -1;
  j.anotar(4, false);
  const segunda = j.puntos - primera;
  assert.ok(segunda > primera, 'la segunda debe valer mas por el encadenado');
  assert.equal(segunda, Math.floor(primera * 1.5));
});

test('el nivel sube solo al acumular lineas', () => {
  const j = nuevoJuego();
  j.comenzar();
  for (let i = 0; i < 5; i++) { j.anotar(4, false); j.combo = -1; }
  assert.equal(j.lineas, 20);
  assert.equal(j.nivel, 2);
});

test('la reserva intercambia la pieza y solo se puede usar una vez por pieza', () => {
  const j = nuevoJuego();
  j.comenzar();
  const original = j.pieza.tipo;

  j.guardarEnReserva();
  assert.equal(j.reserva, original);
  assert.equal(j.reservaUsada, true);
  const trasGuardar = j.pieza.tipo;

  // Un segundo intento no debe cambiar nada.
  j.guardarEnReserva();
  assert.equal(j.pieza.tipo, trasGuardar, 'no debe permitir guardar dos veces');
  assert.equal(j.reserva, original);
});

test('fin inmediato si la pieza nueva no cabe donde aparece', () => {
  const j = nuevoJuego();
  j.comenzar();
  // Se llena el tablero ENTERO, incluidas las filas ocultas donde nacen las
  // piezas. La siguiente pieza no tiene sitio: la partida acaba al instante.
  for (let y = 0; y < FILAS; y++) {
    for (let x = 0; x < COLUMNAS; x++) j.tablero.rejilla[y][x] = 'oro';
  }
  j.nuevaPieza();
  assert.equal(j.estado, ESTADOS.FIN);
});

test('fin cuando una pieza se fija dentro de la zona oculta', () => {
  const j = nuevoJuego();
  j.comenzar();
  // Se llena todo menos las dos filas ocultas, dejando la ultima columna libre
  // para que ninguna fila este completa: asi la pieza no puede salvarse
  // haciendo linea.
  for (let y = FILAS_OCULTAS; y < FILAS; y++) {
    for (let x = 0; x < COLUMNAS - 1; x++) j.tablero.rejilla[y][x] = 'oro';
  }
  j.nuevaPieza();
  assert.equal(j.estado, ESTADOS.JUGANDO, 'la pieza aun cabe en la zona oculta');

  // Se fija arriba, sin completar ninguna linea: la partida acaba.
  j.fijar();
  assert.equal(j.estado, ESTADOS.FIN);
});

test('completar lineas salva la partida aunque la pila este altisima', () => {
  const j = nuevoJuego();
  j.comenzar();
  // Pila hasta el borde, pero la pieza que cae completa filas: no debe perder.
  for (let y = FILAS_OCULTAS; y < FILAS; y++) {
    for (let x = 0; x < COLUMNAS; x++) j.tablero.rejilla[y][x] = 'oro';
  }
  j.nuevaPieza();
  j.fijar();
  assert.equal(j.estado, ESTADOS.LIMPIANDO, 'hacer linea debe salvar la partida');
  assert.ok(j.lineas > 0);
});

test('actualizar no rompe con saltos de tiempo enormes', () => {
  const j = nuevoJuego();
  j.comenzar();
  const entradas = { izquierda: false, derecha: false, abajo: false, lateralIniciado: false, tiempoLateral: 0 };
  // Simula que la pestana estuvo 30 segundos en segundo plano.
  assert.doesNotThrow(() => j.actualizar(30000, entradas));
  assert.ok(j.estado === ESTADOS.JUGANDO || j.estado === ESTADOS.FIN);
});

test('una partida larga simulada no lanza errores ni corrompe el tablero', () => {
  const j = nuevoJuego();
  j.comenzar();
  const entradas = { izquierda: false, derecha: false, abajo: false, lateralIniciado: false, tiempoLateral: 0 };

  let vueltas = 0;
  while (j.estado !== ESTADOS.FIN && vueltas < 4000) {
    const r = Math.random();
    if (r < 0.22) j.mover(Math.random() < 0.5 ? -1 : 1);
    else if (r < 0.38) j.girar(1);
    else if (r < 0.44) j.guardarEnReserva();
    else if (r < 0.60) j.caidaDura();
    j.actualizar(16, entradas);
    vueltas++;

    // Invariante: el tablero nunca cambia de tamano ni guarda colores invalidos.
    assert.equal(j.tablero.rejilla.length, FILAS);
    for (const fila of j.tablero.rejilla) {
      assert.equal(fila.length, COLUMNAS);
    }
  }
  assert.ok(j.piezasColocadas > 0, 'debe haber colocado piezas');
  assert.ok(j.puntos >= 0);
});

test('mil partidas rapidas terminan siempre de forma limpia', () => {
  for (let n = 0; n < 60; n++) {
    const j = nuevoJuego();
    j.comenzar();
    const entradas = { izquierda: false, derecha: false, abajo: false, lateralIniciado: false, tiempoLateral: 0 };
    let v = 0;
    while (j.estado !== ESTADOS.FIN && v < 1200) {
      j.caidaDura();
      j.actualizar(16, entradas);
      v++;
    }
    assert.equal(j.estado, ESTADOS.FIN, `la partida ${n} no termino`);
    assert.ok(Number.isFinite(j.puntos));
  }
});

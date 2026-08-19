/**
 * tablero.js — La rejilla de juego y sus reglas.
 *
 * El tablero son 10 columnas por 20 filas visibles, mas 2 filas ocultas arriba
 * donde aparecen las piezas. Esas filas ocultas son las que permiten que una
 * pieza entre girando sin chocar de inmediato.
 */

import { celdas } from './piezas.js';

export const COLUMNAS = 10;
export const FILAS_VISIBLES = 20;
export const FILAS_OCULTAS = 2;
export const FILAS = FILAS_VISIBLES + FILAS_OCULTAS;

export class Tablero {
  constructor() {
    this.limpiar();
  }

  limpiar() {
    // null = celda vacia. Si no, guarda el nombre del color de la pieza.
    this.rejilla = Array.from({ length: FILAS }, () => Array(COLUMNAS).fill(null));
  }

  dentro(x, y) {
    return x >= 0 && x < COLUMNAS && y >= 0 && y < FILAS;
  }

  ocupada(x, y) {
    // Fuera por los lados o por abajo cuenta como ocupado (choca).
    // Fuera por arriba no: la pieza puede asomar antes de entrar.
    if (x < 0 || x >= COLUMNAS || y >= FILAS) return true;
    if (y < 0) return false;
    return this.rejilla[y][x] !== null;
  }

  /** ¿Cabe la pieza en esta posicion y giro? */
  cabe(tipo, giro, x, y) {
    return celdas(tipo, giro, x, y).every(([cx, cy]) => !this.ocupada(cx, cy));
  }

  /** Deja la pieza grabada en la rejilla. */
  fijar(tipo, giro, x, y, color) {
    for (const [cx, cy] of celdas(tipo, giro, x, y)) {
      if (this.dentro(cx, cy)) this.rejilla[cy][cx] = color;
    }
  }

  /** Indices de las filas que estan completas. */
  filasCompletas() {
    const llenas = [];
    for (let y = 0; y < FILAS; y++) {
      if (this.rejilla[y].every((celda) => celda !== null)) llenas.push(y);
    }
    return llenas;
  }

  /** Borra las filas indicadas y baja todo lo que estaba encima. */
  borrarFilas(indices) {
    if (indices.length === 0) return;
    const aBorrar = new Set(indices);
    const quedan = this.rejilla.filter((_, y) => !aBorrar.has(y));
    const nuevas = Array.from({ length: indices.length }, () => Array(COLUMNAS).fill(null));
    this.rejilla = [...nuevas, ...quedan];
  }

  /** Cuanto puede caer la pieza antes de chocar. Sirve para la sombra y el drop. */
  distanciaAlSuelo(tipo, giro, x, y) {
    let d = 0;
    while (this.cabe(tipo, giro, x, y + d + 1)) d++;
    return d;
  }

  /** ¿Hay algo en las filas ocultas? Es la condicion de fin de partida. */
  desbordado() {
    for (let y = 0; y < FILAS_OCULTAS; y++) {
      if (this.rejilla[y].some((celda) => celda !== null)) return true;
    }
    return false;
  }

  /** Altura de la pila, para efectos visuales de tension. */
  alturaPila() {
    for (let y = 0; y < FILAS; y++) {
      if (this.rejilla[y].some((c) => c !== null)) return FILAS - y;
    }
    return 0;
  }
}

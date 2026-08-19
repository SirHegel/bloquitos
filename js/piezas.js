/**
 * piezas.js — Definicion de las 7 piezas, rotaciones y sistema de pateo de pared.
 *
 * Se usa el sistema de rotacion estandar (SRS): cada pieza tiene 4 estados de giro
 * y, cuando un giro choca, se prueban 5 desplazamientos alternativos antes de
 * rendirse. Eso es lo que permite encajar piezas en huecos ajustados y lo que hace
 * que el juego "se sienta" bien.
 */

// Cada pieza se describe por las celdas que ocupa en cada uno de sus 4 giros.
// Las coordenadas son [columna, fila] dentro de la caja de la pieza.
export const PIEZAS = {
  I: {
    color: 'cian',
    tam: 4,
    giros: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
  },
  O: {
    color: 'oro',
    tam: 2,
    giros: [
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      [[0, 0], [1, 0], [0, 1], [1, 1]],
    ],
  },
  T: {
    color: 'amatista',
    tam: 3,
    giros: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  S: {
    color: 'esmeralda',
    tam: 3,
    giros: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  Z: {
    color: 'rubi',
    tam: 3,
    giros: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
  },
  J: {
    color: 'zafiro',
    tam: 3,
    giros: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
  },
  L: {
    color: 'ambar',
    tam: 3,
    giros: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  },
};

export const TIPOS = Object.keys(PIEZAS);

/**
 * Tablas de pateo (wall kicks) del SRS.
 * La clave es "giroDesde->giroHasta" y el valor son los 5 desplazamientos a probar
 * en orden. El primero siempre es [0,0] (intentar sin mover).
 * El eje Y va hacia abajo, por eso los signos estan invertidos respecto a la
 * especificacion original, que usa Y hacia arriba.
 */
const PATEOS_NORMAL = {
  '0->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1->0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1->2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2->1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3->2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3->0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0->3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

// La pieza I tiene su propia tabla porque es mas larga y necesita mas margen.
const PATEOS_I = {
  '0->1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1->0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1->2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2->1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2->3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3->2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3->0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0->3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export function pateos(tipo, desde, hasta) {
  const tabla = tipo === 'I' ? PATEOS_I : PATEOS_NORMAL;
  // La pieza O nunca necesita patear: gira sobre si misma.
  if (tipo === 'O') return [[0, 0]];
  return tabla[`${desde}->${hasta}`] || [[0, 0]];
}

/** Devuelve las celdas absolutas que ocupa una pieza en el tablero. */
export function celdas(tipo, giro, x, y) {
  return PIEZAS[tipo].giros[giro].map(([cx, cy]) => [x + cx, y + cy]);
}

/**
 * Bolsa de 7: en lugar de elegir piezas al azar puro, se baraja el set completo
 * de 7 y se reparte. Asi nunca hay sequias largas de una pieza, que es la queja
 * clasica del azar puro. Es el estandar moderno del genero.
 */
export class Bolsa {
  constructor() {
    this.cola = [];
    this.rellenar();
    this.rellenar();
  }

  rellenar() {
    const lote = [...TIPOS];
    // Barajado de Fisher-Yates.
    for (let i = lote.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lote[i], lote[j]] = [lote[j], lote[i]];
    }
    this.cola.push(...lote);
  }

  siguiente() {
    if (this.cola.length <= 7) this.rellenar();
    return this.cola.shift();
  }

  /** Las proximas n piezas sin sacarlas de la cola, para el panel lateral. */
  asomar(n) {
    while (this.cola.length < n) this.rellenar();
    return this.cola.slice(0, n);
  }
}

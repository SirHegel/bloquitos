/**
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

// ══════════════════════════════════════════════════════════════════════
// js/piezas.js
// ══════════════════════════════════════════════════════════════════════

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
const PIEZAS = {
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

const TIPOS = Object.keys(PIEZAS);

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

function pateos(tipo, desde, hasta) {
  const tabla = tipo === 'I' ? PATEOS_I : PATEOS_NORMAL;
  // La pieza O nunca necesita patear: gira sobre si misma.
  if (tipo === 'O') return [[0, 0]];
  return tabla[`${desde}->${hasta}`] || [[0, 0]];
}

/** Devuelve las celdas absolutas que ocupa una pieza en el tablero. */
function celdas(tipo, giro, x, y) {
  return PIEZAS[tipo].giros[giro].map(([cx, cy]) => [x + cx, y + cy]);
}

/**
 * Bolsa de 7: en lugar de elegir piezas al azar puro, se baraja el set completo
 * de 7 y se reparte. Asi nunca hay sequias largas de una pieza, que es la queja
 * clasica del azar puro. Es el estandar moderno del genero.
 */
class Bolsa {
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


// ══════════════════════════════════════════════════════════════════════
// js/tablero.js
// ══════════════════════════════════════════════════════════════════════

/**
 * tablero.js — La rejilla de juego y sus reglas.
 *
 * El tablero son 10 columnas por 20 filas visibles, mas 2 filas ocultas arriba
 * donde aparecen las piezas. Esas filas ocultas son las que permiten que una
 * pieza entre girando sin chocar de inmediato.
 */


const COLUMNAS = 10;
const FILAS_VISIBLES = 20;
const FILAS_OCULTAS = 2;
const FILAS = FILAS_VISIBLES + FILAS_OCULTAS;

class Tablero {
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


// ══════════════════════════════════════════════════════════════════════
// js/temas.js
// ══════════════════════════════════════════════════════════════════════

/**
 * temas.js — Color y atmosfera.
 *
 * Dos ideas gobiernan el aspecto del juego:
 *
 * 1. Las piezas son "joyas de caramelo": colores muy saturados y luminosos, pero
 *    con sombra y brillo propios para que se vean solidos y apetecibles, no planos.
 *    Saturado atrae a un nino; el volumen y la sombra evitan que parezca barato.
 *
 * 2. El fondo no se repite nunca. Cada nivel gira el tono base una cantidad que
 *    no es divisor de 360, asi que la secuencia de ambientes no vuelve a empezar
 *    en ningun momento: niveles infinitos con atmosfera siempre distinta.
 */

/** Las 7 joyas. Cada una define su cara, su luz y su sombra. */
const JOYAS = {
  cian:      { base: '#22d3ee', luz: '#a5f3fc', sombra: '#0e7490', halo: '#67e8f9' },
  oro:       { base: '#fbbf24', luz: '#fde68a', sombra: '#b45309', halo: '#fcd34d' },
  amatista:  { base: '#a78bfa', luz: '#ddd6fe', sombra: '#6d28d9', halo: '#c4b5fd' },
  esmeralda: { base: '#34d399', luz: '#a7f3d0', sombra: '#047857', halo: '#6ee7b7' },
  rubi:      { base: '#fb7185', luz: '#fecdd3', sombra: '#be123c', halo: '#fda4af' },
  zafiro:    { base: '#60a5fa', luz: '#bfdbfe', sombra: '#1d4ed8', halo: '#93c5fd' },
  ambar:     { base: '#fb923c', luz: '#fed7aa', sombra: '#c2410c', halo: '#fdba74' },
};

/**
 * El giro de tono por nivel. 47 es primo respecto a 360, asi que hacen falta
 * 360 niveles para volver al mismo tono, y aun entonces la luminosidad y el
 * numero de auroras habran cambiado. En la practica: no se repite.
 */
const GIRO_POR_NIVEL = 47;

/**
 * Construye el ambiente de un nivel. Devuelve colores listos para usar en CSS
 * y en el lienzo.
 */
function ambiente(nivel) {
  const tono = (210 + nivel * GIRO_POR_NIVEL) % 360;
  // La saturacion oscila suavemente para que unos niveles sean mas serenos que
  // otros sin que ninguno llegue a ser gris ni chillon.
  const sat = 48 + Math.sin(nivel * 0.7) * 14;
  // Luminosidad suficiente para que el tablero se sienta vivo y no un pozo negro,
  // pero muy por debajo de la de las joyas para que estas sigan siendo lo que
  // atrae la vista.
  const lum = 17 + Math.sin(nivel * 0.41) * 4;

  return {
    tono,
    fondoLejos: `hsl(${tono} ${sat}% ${lum}%)`,
    fondoCerca: `hsl(${(tono + 34) % 360} ${sat + 8}% ${lum + 7}%)`,
    aurora1: `hsl(${(tono + 18) % 360} 80% 62%)`,
    aurora2: `hsl(${(tono + 190) % 360} 78% 60%)`,
    aurora3: `hsl(${(tono + 96) % 360} 82% 58%)`,
    rejilla: `hsl(${tono} 30% 100% / 0.055)`,
    marco: `hsl(${(tono + 20) % 360} 70% 70% / 0.35)`,
    // Cuantas auroras flotan de fondo: crece un poco con el nivel y se estabiliza.
    auroras: 3 + (nivel % 4),
  };
}

/**
 * Nombre del ambiente, para mostrarlo al subir de nivel. Se combinan dos listas
 * de distinto tamano (11 y 7, ambos primos entre si), asi que se generan 77
 * nombres distintos antes de repetir, y cada uno cae en un ambiente de color
 * diferente porque el ciclo de color es de 360.
 */
const ADJETIVOS = ['Cristal', 'Nube', 'Aurora', 'Coral', 'Nieve', 'Miel', 'Menta', 'Lava', 'Perla', 'Selva', 'Cometa'];
const LUGARES = ['de Azúcar', 'Flotante', 'Profundo', 'del Alba', 'de Neón', 'Dormido', 'de Fuego'];

function nombreAmbiente(nivel) {
  const a = ADJETIVOS[nivel % ADJETIVOS.length];
  const b = LUGARES[nivel % LUGARES.length];
  return `${a} ${b}`;
}

/**
 * Velocidad de caida en milisegundos por celda.
 *
 * La curva es exponencial pero con suelo: por muy alto que suba el nivel, nunca
 * baja de 45 ms. Esto es deliberado. Una curva sin suelo vuelve el juego
 * imposible hacia el nivel 20 y para un nino eso es un muro, no un reto. Con
 * suelo, el juego se puede jugar para siempre: sube la exigencia y luego se
 * mantiene en un tope rapido pero humano.
 */
function velocidadCaida(nivel) {
  const SUELO = 45;
  const INICIO = 900;
  const v = INICIO * Math.pow(0.86, nivel);
  return Math.max(SUELO, v);
}

/** Nivel a partir de las lineas hechas. Cada 10 lineas sube uno, sin techo. */
function nivelDeLineas(lineas) {
  return Math.floor(lineas / 10);
}


// ══════════════════════════════════════════════════════════════════════
// js/audio.js
// ══════════════════════════════════════════════════════════════════════

/**
 * audio.js — Sonido sintetizado en el momento.
 *
 * No hay ni un archivo de audio en el proyecto: todos los sonidos se generan con
 * osciladores de la Web Audio API. Eso tiene tres ventajas concretas: el juego
 * pesa menos, funciona sin conexion desde el primer segundo, y no hay ningun
 * recurso externo que cargar (ni que auditar).
 *
 * Los tonos estan en escala pentatonica mayor. Es la escala de las cajas de
 * musica y los xilofonos infantiles: cualquier combinacion suena agradable,
 * nunca disonante, aunque se disparen varios sonidos a la vez.
 */

// Do-Re-Mi-Sol-La en varias octavas.
const PENTATONICA = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98, 1760.00];

class Sonido {
  constructor() {
    this.ctx = null;
    this.activo = true;
    this.volumen = 0.30;
  }

  /**
   * El contexto de audio debe crearse tras un gesto del usuario, porque los
   * navegadores bloquean el audio automatico. Se llama desde el primer toque.
   */
  despertar() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.maestro = this.ctx.createGain();
    this.maestro.gain.value = this.volumen;
    this.maestro.connect(this.ctx.destination);
  }

  alternar() {
    this.activo = !this.activo;
    if (this.maestro) {
      this.maestro.gain.setTargetAtTime(this.activo ? this.volumen : 0, this.ctx.currentTime, 0.02);
    }
    return this.activo;
  }

  /** Un tono simple con ataque y caida suaves. */
  tono(frec, dur = 0.12, tipo = 'sine', vol = 1, retardo = 0) {
    if (!this.ctx || !this.activo) return;
    const t = this.ctx.currentTime + retardo;
    const osc = this.ctx.createOscillator();
    const gan = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frec, t);
    // Envolvente: subida rapida, caida exponencial. Evita el "clic" de corte seco.
    gan.gain.setValueAtTime(0, t);
    gan.gain.linearRampToValueAtTime(vol, t + 0.012);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gan);
    gan.connect(this.maestro);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Ruido corto filtrado, para golpes secos. */
  golpe(dur = 0.09, frecFiltro = 900, vol = 0.5) {
    if (!this.ctx || !this.activo) return;
    const t = this.ctx.currentTime;
    const muestras = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, muestras, this.ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < muestras; i++) {
      datos[i] = (Math.random() * 2 - 1) * (1 - i / muestras);
    }
    const fuente = this.ctx.createBufferSource();
    fuente.buffer = buffer;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = frecFiltro;
    const gan = this.ctx.createGain();
    gan.gain.value = vol;
    fuente.connect(filtro);
    filtro.connect(gan);
    gan.connect(this.maestro);
    fuente.start(t);
  }

  mover()  { this.tono(PENTATONICA[0], 0.05, 'sine', 0.18); }
  girar()  { this.tono(PENTATONICA[3], 0.07, 'triangle', 0.22); }
  posar()  { this.golpe(0.08, 700, 0.35); this.tono(PENTATONICA[0] / 2, 0.10, 'sine', 0.3); }
  soltar() { this.golpe(0.12, 500, 0.5); this.tono(PENTATONICA[0] / 2, 0.14, 'sine', 0.35); }
  reserva(){ this.tono(PENTATONICA[5], 0.10, 'triangle', 0.25); }

  /** Arpegio ascendente: cuantas mas lineas, mas notas y mas alto llega. */
  linea(cantidad) {
    const notas = Math.min(4, cantidad) + 1;
    for (let i = 0; i < notas; i++) {
      this.tono(PENTATONICA[i + cantidad], 0.20, 'triangle', 0.30, i * 0.055);
    }
  }

  nivel() {
    // Fanfarria corta de cinco notas.
    [0, 2, 4, 5, 7].forEach((n, i) => {
      this.tono(PENTATONICA[n % PENTATONICA.length], 0.26, 'sine', 0.28, i * 0.08);
    });
  }

  fin() {
    // Descenso suave, sin dramatismo: el juego no rina al nino.
    [7, 5, 3, 0].forEach((n, i) => {
      this.tono(PENTATONICA[n] / 2, 0.34, 'sine', 0.26, i * 0.13);
    });
  }
}


// ══════════════════════════════════════════════════════════════════════
// js/basedatos.js
// ══════════════════════════════════════════════════════════════════════

/**
 * basedatos.js — Base de datos local del juego (IndexedDB).
 *
 * Guarda el historial completo de partidas, los récords, las estadísticas
 * acumuladas, los ajustes y los logros. Todo vive en el navegador de quien
 * juega: no hay servidor, no hay cuenta, y ningún dato sale del dispositivo.
 * Por eso es una base de datos y no una API: es la opción que no expone nada.
 *
 * Se usa IndexedDB en vez de localStorage porque hace falta guardar cientos de
 * partidas y consultarlas ordenadas por puntuación y por fecha. localStorage
 * solo guarda texto plano y obliga a leerlo entero para cualquier consulta.
 *
 * Si IndexedDB no está disponible (modo privado, permisos denegados, un
 * navegador antiguo), todo cae automáticamente a un almacén en memoria. El
 * juego nunca deja de funcionar por un fallo de base de datos: simplemente
 * deja de recordar entre sesiones.
 */

const NOMBRE_BD = 'bloquitos';
const VERSION_BD = 1;

const ALMACENES = {
  PARTIDAS: 'partidas',
  AJUSTES: 'ajustes',
  LOGROS: 'logros',
};

/** Catálogo de logros. Se comprueban al terminar cada partida. */
const LOGROS = [
  { id: 'primera-linea',  titulo: 'Primera línea',    descripcion: 'Completa tu primera línea',        icono: '✨', prueba: (p, t) => t.lineasTotales >= 1 },
  { id: 'triple',         titulo: 'Triple',           descripcion: 'Haz 3 líneas de una vez',          icono: '🎯', prueba: (p) => p.maxLineasDeGolpe >= 3 },
  { id: 'cuadruple',      titulo: '¡Cuádruple!',      descripcion: 'Haz 4 líneas de una vez',          icono: '💎', prueba: (p) => p.maxLineasDeGolpe >= 4 },
  { id: 'combo-3',        titulo: 'Encadenado',       descripcion: 'Consigue un combo de 3',           icono: '🔥', prueba: (p) => p.maxCombo >= 3 },
  { id: 'giro-t',         titulo: 'Giro maestro',     descripcion: 'Haz un giro en T',                 icono: '🌀', prueba: (p) => p.girosT >= 1 },
  { id: 'nivel-5',        titulo: 'Nivel 5',          descripcion: 'Llega al nivel 5',                 icono: '🚀', prueba: (p) => p.nivel >= 5 },
  { id: 'nivel-10',       titulo: 'Nivel 10',         descripcion: 'Llega al nivel 10',                icono: '⭐', prueba: (p) => p.nivel >= 10 },
  { id: 'nivel-20',       titulo: 'Nivel 20',         descripcion: 'Llega al nivel 20',                icono: '👑', prueba: (p) => p.nivel >= 20 },
  { id: 'cien-lineas',    titulo: 'Cien líneas',      descripcion: 'Suma 100 líneas en total',         icono: '💯', prueba: (p, t) => t.lineasTotales >= 100 },
  { id: 'diez-partidas',  titulo: 'Constante',        descripcion: 'Juega 10 partidas',                icono: '🎮', prueba: (p, t) => t.partidas >= 10 },
  { id: 'diez-mil',       titulo: 'Diez mil',         descripcion: 'Consigue 10.000 puntos',           icono: '🏆', prueba: (p) => p.puntos >= 10000 },
  { id: 'maraton',        titulo: 'Maratón',          descripcion: 'Aguanta 10 minutos en una partida', icono: '⏳', prueba: (p) => p.segundos >= 600 },
];

/** Almacén de emergencia si IndexedDB falla. Vive solo mientras dure la pestaña. */
const memoria = { partidas: [], ajustes: new Map(), logros: new Map(), siguienteId: 1 };
let modoMemoria = false;
let bd = null;

/** Abre la base de datos y crea los almacenes la primera vez. */
function abrir() {
  return new Promise((resolver) => {
    if (bd) return resolver(bd);
    if (typeof indexedDB === 'undefined') {
      modoMemoria = true;
      return resolver(null);
    }

    let peticion;
    try {
      peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);
    } catch {
      modoMemoria = true;
      return resolver(null);
    }

    // Si el navegador bloquea o tarda demasiado, se sigue en memoria en vez de
    // dejar el juego colgado esperando.
    const reloj = setTimeout(() => { modoMemoria = true; resolver(null); }, 3000);

    peticion.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(ALMACENES.PARTIDAS)) {
        const almacen = db.createObjectStore(ALMACENES.PARTIDAS, { keyPath: 'id', autoIncrement: true });
        // Índices para poder pedir "las 10 mejores" o "las últimas 20" sin leer
        // la tabla entera.
        almacen.createIndex('porPuntos', 'puntos');
        almacen.createIndex('porFecha', 'fecha');
        almacen.createIndex('porNivel', 'nivel');
      }
      if (!db.objectStoreNames.contains(ALMACENES.AJUSTES)) {
        db.createObjectStore(ALMACENES.AJUSTES, { keyPath: 'clave' });
      }
      if (!db.objectStoreNames.contains(ALMACENES.LOGROS)) {
        db.createObjectStore(ALMACENES.LOGROS, { keyPath: 'id' });
      }
    };

    peticion.onsuccess = (e) => {
      clearTimeout(reloj);
      bd = e.target.result;
      // Si la base se cierra sola (por ejemplo, se borran los datos del sitio),
      // se pasa a memoria en lugar de romper.
      bd.onclose = () => { bd = null; modoMemoria = true; };
      resolver(bd);
    };

    peticion.onerror = () => { clearTimeout(reloj); modoMemoria = true; resolver(null); };
    peticion.onblocked = () => { clearTimeout(reloj); modoMemoria = true; resolver(null); };
  });
}

/** Envuelve una transacción en una promesa. */
function transaccion(almacen, modo, operacion) {
  return new Promise((resolver) => {
    if (!bd || modoMemoria) return resolver(null);
    let t;
    try {
      t = bd.transaction(almacen, modo);
    } catch {
      return resolver(null);
    }
    const peticion = operacion(t.objectStore(almacen));
    t.oncomplete = () => resolver(peticion ? peticion.result : null);
    t.onerror = () => resolver(null);
    t.onabort = () => resolver(null);
  });
}

// ── Validación ──────────────────────────────────────────────────────────────

/**
 * Todo lo que entra y todo lo que sale se valida. Los datos vienen del disco
 * del usuario, que puede haber sido manipulado o venir de una versión anterior
 * con otra forma, así que nunca se confía en ellos tal cual.
 */
function entero(v, minimo = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= minimo ? Math.floor(n) : minimo;
}

function saneaPartida(p) {
  return {
    fecha: entero(p.fecha) || Date.now(),
    puntos: entero(p.puntos),
    lineas: entero(p.lineas),
    nivel: entero(p.nivel),
    piezas: entero(p.piezas),
    segundos: entero(p.segundos),
    maxCombo: entero(p.maxCombo),
    maxLineasDeGolpe: Math.min(4, entero(p.maxLineasDeGolpe)),
    girosT: entero(p.girosT),
  };
}

// ── Partidas ────────────────────────────────────────────────────────────────

async function guardarPartida(datos) {
  const partida = saneaPartida(datos);
  if (modoMemoria || !bd) {
    memoria.partidas.push({ ...partida, id: memoria.siguienteId++ });
    return partida;
  }
  await transaccion(ALMACENES.PARTIDAS, 'readwrite', (a) => a.add(partida));
  return partida;
}

/** Las mejores n partidas por puntuación, de mayor a menor. */
async function mejoresPartidas(n = 10) {
  if (modoMemoria || !bd) {
    return [...memoria.partidas].sort((a, b) => b.puntos - a.puntos).slice(0, n);
  }
  return new Promise((resolver) => {
    const resultado = [];
    let t;
    try {
      t = bd.transaction(ALMACENES.PARTIDAS, 'readonly');
    } catch {
      return resolver([]);
    }
    // Se recorre el índice de puntos al revés: así las mejores salen primero
    // sin tener que cargar y ordenar todas las partidas.
    const cursor = t.objectStore(ALMACENES.PARTIDAS).index('porPuntos').openCursor(null, 'prev');
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c && resultado.length < n) { resultado.push(c.value); c.continue(); }
      else resolver(resultado);
    };
    cursor.onerror = () => resolver([]);
    t.onerror = () => resolver([]);
  });
}

/** Las n partidas más recientes. */
async function ultimasPartidas(n = 20) {
  if (modoMemoria || !bd) {
    return [...memoria.partidas].sort((a, b) => b.fecha - a.fecha).slice(0, n);
  }
  return new Promise((resolver) => {
    const resultado = [];
    let t;
    try {
      t = bd.transaction(ALMACENES.PARTIDAS, 'readonly');
    } catch {
      return resolver([]);
    }
    const cursor = t.objectStore(ALMACENES.PARTIDAS).index('porFecha').openCursor(null, 'prev');
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c && resultado.length < n) { resultado.push(c.value); c.continue(); }
      else resolver(resultado);
    };
    cursor.onerror = () => resolver([]);
    t.onerror = () => resolver([]);
  });
}

/** Estadísticas acumuladas de todas las partidas. */
async function estadisticas() {
  let todas;
  if (modoMemoria || !bd) {
    todas = memoria.partidas;
  } else {
    todas = await new Promise((resolver) => {
      let t;
      try {
        t = bd.transaction(ALMACENES.PARTIDAS, 'readonly');
      } catch {
        return resolver([]);
      }
      const p = t.objectStore(ALMACENES.PARTIDAS).getAll();
      p.onsuccess = () => resolver(p.result || []);
      p.onerror = () => resolver([]);
      t.onerror = () => resolver([]);
    });
  }

  if (todas.length === 0) {
    return { partidas: 0, record: 0, lineasTotales: 0, nivelMaximo: 0,
             piezasTotales: 0, tiempoTotal: 0, mediaPuntos: 0, mejorCombo: 0 };
  }

  return {
    partidas: todas.length,
    record: Math.max(...todas.map((p) => p.puntos)),
    lineasTotales: todas.reduce((s, p) => s + p.lineas, 0),
    nivelMaximo: Math.max(...todas.map((p) => p.nivel)),
    piezasTotales: todas.reduce((s, p) => s + p.piezas, 0),
    tiempoTotal: todas.reduce((s, p) => s + p.segundos, 0),
    mediaPuntos: Math.round(todas.reduce((s, p) => s + p.puntos, 0) / todas.length),
    mejorCombo: Math.max(...todas.map((p) => p.maxCombo)),
  };
}

// ── Ajustes ─────────────────────────────────────────────────────────────────

async function leerAjuste(clave, porDefecto) {
  if (modoMemoria || !bd) {
    return memoria.ajustes.has(clave) ? memoria.ajustes.get(clave) : porDefecto;
  }
  const v = await new Promise((resolver) => {
    let t;
    try {
      t = bd.transaction(ALMACENES.AJUSTES, 'readonly');
    } catch {
      return resolver(undefined);
    }
    const p = t.objectStore(ALMACENES.AJUSTES).get(clave);
    p.onsuccess = () => resolver(p.result?.valor);
    p.onerror = () => resolver(undefined);
    t.onerror = () => resolver(undefined);
  });
  return v === undefined ? porDefecto : v;
}

async function guardarAjuste(clave, valor) {
  if (modoMemoria || !bd) { memoria.ajustes.set(clave, valor); return; }
  await transaccion(ALMACENES.AJUSTES, 'readwrite', (a) => a.put({ clave, valor }));
}

// ── Logros ──────────────────────────────────────────────────────────────────

async function logrosConseguidos() {
  if (modoMemoria || !bd) return [...memoria.logros.values()];
  return new Promise((resolver) => {
    let t;
    try {
      t = bd.transaction(ALMACENES.LOGROS, 'readonly');
    } catch {
      return resolver([]);
    }
    const p = t.objectStore(ALMACENES.LOGROS).getAll();
    p.onsuccess = () => resolver(p.result || []);
    p.onerror = () => resolver([]);
    t.onerror = () => resolver([]);
  });
}

/**
 * Comprueba qué logros nuevos desbloquea esta partida y los guarda.
 * Devuelve solo los recién conseguidos, para poder anunciarlos en pantalla.
 */
async function revisarLogros(partida, totales) {
  const yaTengo = new Set((await logrosConseguidos()).map((l) => l.id));
  const nuevos = [];

  for (const logro of LOGROS) {
    if (yaTengo.has(logro.id)) continue;
    let cumple = false;
    try {
      cumple = logro.prueba(partida, totales);
    } catch {
      cumple = false;
    }
    if (!cumple) continue;

    const registro = { id: logro.id, fecha: Date.now() };
    if (modoMemoria || !bd) memoria.logros.set(logro.id, registro);
    else await transaccion(ALMACENES.LOGROS, 'readwrite', (a) => a.put(registro));
    nuevos.push(logro);
  }
  return nuevos;
}

// ── Migración desde la versión anterior ─────────────────────────────────────

/**
 * La primera versión del juego guardaba el récord en localStorage. Si existe,
 * se convierte en una partida del historial para no perder el progreso, y se
 * marca la migración para no repetirla.
 */
async function migrarDesdeLocalStorage() {
  const yaHecha = await leerAjuste('migracion.v1', false);
  if (yaHecha) return false;

  let viejo = null;
  try {
    const crudo = localStorage.getItem('bloquitos.v1');
    if (crudo) viejo = JSON.parse(crudo);
  } catch {
    viejo = null;
  }

  if (viejo && entero(viejo.record) > 0) {
    await guardarPartida({
      fecha: Date.now(),
      puntos: viejo.record,
      lineas: entero(viejo.lineasTotales),
      nivel: entero(viejo.nivelMaximo),
      piezas: 0, segundos: 0, maxCombo: 0, maxLineasDeGolpe: 0, girosT: 0,
    });
  }
  if (viejo) {
    if (typeof viejo.sonido === 'boolean') await guardarAjuste('sonido', viejo.sonido);
    if (typeof viejo.fantasma === 'boolean') await guardarAjuste('fantasma', viejo.fantasma);
  }

  await guardarAjuste('migracion.v1', true);
  return true;
}

/** Borra todo. Lo usa el botón de reiniciar progreso. */
async function borrarTodo() {
  memoria.partidas = []; memoria.ajustes.clear(); memoria.logros.clear();
  if (modoMemoria || !bd) return;
  for (const almacen of Object.values(ALMACENES)) {
    await transaccion(almacen, 'readwrite', (a) => a.clear());
  }
}

/** Para que la interfaz pueda avisar de que no se está guardando nada. */
function enMemoria() {
  return modoMemoria;
}


// ══════════════════════════════════════════════════════════════════════
// js/render.js
// ══════════════════════════════════════════════════════════════════════

/**
 * render.js — Todo el dibujo en el lienzo.
 *
 * La pieza clave es dibujarJoya(): un bloque no es un cuadrado de color plano,
 * sino una joya con seis capas superpuestas (sombra proyectada, cuerpo con
 * degradado diagonal, bisel claro arriba, bisel oscuro abajo, brillo especular y
 * halo de color). Son esas capas las que dan la sensacion de volumen y de
 * material solido en vez de un cuadrito.
 */


/** Rectangulo con esquinas redondeadas, compatible con navegadores sin roundRect. */
function rutaRedondeada(ctx, x, y, w, h, r) {
  const radio = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radio);
    return;
  }
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

/**
 * Dibuja un bloque como joya de caramelo.
 * @param {number} alfa  1 = solido. Menor = pieza fantasma o desvaneciendose.
 * @param {number} brillo 0..1 extra de luz, se usa al completar una linea.
 */
function dibujarJoya(ctx, px, py, tam, nombreColor, alfa = 1, brillo = 0) {
  const joya = JOYAS[nombreColor];
  if (!joya) return;

  const m = tam * 0.055;            // margen entre joyas
  const x = px + m;
  const y = py + m;
  const w = tam - m * 2;
  const h = tam - m * 2;
  const r = tam * 0.26;             // esquinas generosas: mas amable a la vista

  ctx.save();
  ctx.globalAlpha = alfa;

  // 1. Sombra proyectada: separa la joya del fondo y la asienta.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = tam * 0.22;
  ctx.shadowOffsetY = tam * 0.09;
  rutaRedondeada(ctx, x, y, w, h, r);
  ctx.fillStyle = joya.sombra;
  ctx.fill();
  ctx.restore();

  // 2. Cuerpo: degradado en diagonal, como si la luz llegara de arriba-izquierda.
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, joya.luz);
  grad.addColorStop(0.42, joya.base);
  grad.addColorStop(1, joya.sombra);
  rutaRedondeada(ctx, x, y, w, h, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // 3. Bisel claro arriba-izquierda (el canto iluminado).
  ctx.save();
  rutaRedondeada(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.lineWidth = Math.max(1.4, tam * 0.075);
  ctx.strokeStyle = 'rgba(255,255,255,0.62)';
  ctx.beginPath();
  ctx.moveTo(x + r * 0.5, y + h - r * 0.4);
  ctx.lineTo(x + r * 0.5, y + r * 0.5);
  ctx.lineTo(x + w - r * 0.4, y + r * 0.5);
  ctx.stroke();

  // 4. Bisel oscuro abajo-derecha (el canto en sombra).
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.moveTo(x + w - r * 0.5, y + r * 0.4);
  ctx.lineTo(x + w - r * 0.5, y + h - r * 0.5);
  ctx.lineTo(x + r * 0.4, y + h - r * 0.5);
  ctx.stroke();
  ctx.restore();

  // 5. Brillo especular: la mancha de luz que hace que parezca pulido.
  const bx = x + w * 0.17;
  const by = y + h * 0.13;
  const bw = w * 0.40;
  const bh = h * 0.26;
  const gb = ctx.createLinearGradient(bx, by, bx, by + bh);
  gb.addColorStop(0, 'rgba(255,255,255,0.85)');
  gb.addColorStop(1, 'rgba(255,255,255,0.05)');
  rutaRedondeada(ctx, bx, by, bw, bh, bh * 0.5);
  ctx.fillStyle = gb;
  ctx.fill();

  // 6. Halo: un aro de color muy tenue que hace que la joya "emita".
  rutaRedondeada(ctx, x, y, w, h, r);
  ctx.strokeStyle = joya.halo;
  ctx.globalAlpha = alfa * 0.4;
  ctx.lineWidth = Math.max(1, tam * 0.035);
  ctx.stroke();

  // Destello extra cuando la fila se esta completando.
  if (brillo > 0) {
    ctx.globalAlpha = alfa * brillo;
    rutaRedondeada(ctx, x, y, w, h, r);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  ctx.restore();
}

/** Pieza fantasma: solo el contorno, para ver donde va a caer. */
function dibujarFantasma(ctx, px, py, tam, nombreColor) {
  const joya = JOYAS[nombreColor];
  if (!joya) return;
  const m = tam * 0.055;
  const r = tam * 0.26;
  ctx.save();
  ctx.globalAlpha = 0.30;
  rutaRedondeada(ctx, px + m, py + m, tam - m * 2, tam - m * 2, r);
  ctx.fillStyle = joya.base;
  ctx.globalAlpha = 0.12;
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = joya.luz;
  ctx.lineWidth = Math.max(1.5, tam * 0.06);
  ctx.setLineDash([tam * 0.18, tam * 0.12]);
  ctx.stroke();
  ctx.restore();
}

/**
 * Fondo animado: degradado base mas varias auroras que flotan lentamente.
 * Las auroras se mueven con senos de periodos distintos, asi que el conjunto
 * no se repite de forma perceptible.
 */
function dibujarFondo(ctx, ancho, alto, amb, t) {
  const g = ctx.createLinearGradient(0, 0, ancho * 0.4, alto);
  g.addColorStop(0, amb.fondoCerca);
  g.addColorStop(1, amb.fondoLejos);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ancho, alto);

  const colores = [amb.aurora1, amb.aurora2, amb.aurora3];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < amb.auroras; i++) {
    const f = i + 1;
    const cx = ancho * (0.5 + 0.42 * Math.sin(t * 0.00013 * f + i * 2.1));
    const cy = alto * (0.5 + 0.42 * Math.cos(t * 0.00017 * f + i * 1.3));
    const rad = Math.max(ancho, alto) * (0.30 + 0.13 * Math.sin(t * 0.0002 + i));
    const ga = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    ga.addColorStop(0, colores[i % 3]);
    ga.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = ga;
    ctx.fillRect(0, 0, ancho, alto);
  }
  ctx.restore();
}

/** Rejilla tenue del area de juego. */
function dibujarRejilla(ctx, ox, oy, tam, amb) {
  ctx.save();
  ctx.strokeStyle = amb.rejilla;
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLUMNAS; c++) {
    ctx.beginPath();
    ctx.moveTo(ox + c * tam, oy);
    ctx.lineTo(ox + c * tam, oy + (FILAS - FILAS_OCULTAS) * tam);
    ctx.stroke();
  }
  for (let f = 0; f <= FILAS - FILAS_OCULTAS; f++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + f * tam);
    ctx.lineTo(ox + COLUMNAS * tam, oy + f * tam);
    ctx.stroke();
  }
  ctx.restore();
}

/** Dibuja una pieza centrada en una caja: para los paneles de siguiente y reserva. */
function dibujarPiezaEnCaja(ctx, tipo, x, y, ancho, alto) {
  if (!tipo) return;
  const def = PIEZAS[tipo];
  const bloques = def.giros[0];
  const xs = bloques.map((b) => b[0]);
  const ys = bloques.map((b) => b[1]);
  const anchoP = Math.max(...xs) - Math.min(...xs) + 1;
  const altoP = Math.max(...ys) - Math.min(...ys) + 1;
  const tam = Math.min(ancho / (anchoP + 0.6), alto / (altoP + 0.6));
  const ox = x + (ancho - anchoP * tam) / 2 - Math.min(...xs) * tam;
  const oy = y + (alto - altoP * tam) / 2 - Math.min(...ys) * tam;
  for (const [cx, cy] of bloques) {
    dibujarJoya(ctx, ox + cx * tam, oy + cy * tam, tam, def.color);
  }
}

/** Sistema de particulas para las lineas completadas. */
class Particulas {
  constructor() {
    this.lista = [];
  }

  estallido(x, y, color, cantidad = 14) {
    for (let i = 0; i < cantidad; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = 0.05 + Math.random() * 0.28;
      this.lista.push({
        x, y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel - 0.12,
        vida: 1,
        decaer: 0.0011 + Math.random() * 0.0016,
        tam: 2 + Math.random() * 5,
        color,
        giro: Math.random() * Math.PI,
        vgiro: (Math.random() - 0.5) * 0.01,
      });
    }
  }

  actualizar(dt) {
    for (const p of this.lista) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.00055 * dt;      // gravedad
      p.vx *= 0.995;             // rozamiento
      p.giro += p.vgiro * dt;
      p.vida -= p.decaer * dt;
    }
    this.lista = this.lista.filter((p) => p.vida > 0);
    // Tope de seguridad: nunca acumular tantas particulas que baje el ritmo.
    if (this.lista.length > 700) this.lista = this.lista.slice(-700);
  }

  dibujar(ctx) {
    ctx.save();
    for (const p of this.lista) {
      const joya = JOYAS[p.color];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vida));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = joya ? joya.luz : '#fff';
      rutaRedondeada(ctx, -p.tam / 2, -p.tam / 2, p.tam, p.tam, p.tam * 0.3);
      ctx.fill();
      ctx.rotate(-p.giro);
      ctx.translate(-p.x, -p.y);
    }
    ctx.restore();
  }

  limpiar() {
    this.lista = [];
  }
}

/** Dibuja el contenido del tablero y la pieza en juego. */
function dibujarTablero(ctx, tablero, ox, oy, tam, filasBrillando, brillo) {
  for (let y = FILAS_OCULTAS; y < FILAS; y++) {
    for (let x = 0; x < COLUMNAS; x++) {
      const color = tablero.rejilla[y][x];
      if (!color) continue;
      const b = filasBrillando.includes(y) ? brillo : 0;
      dibujarJoya(ctx, ox + x * tam, oy + (y - FILAS_OCULTAS) * tam, tam, color, 1, b);
    }
  }
}

function dibujarPiezaActiva(ctx, tipo, giro, x, y, ox, oy, tam, alfa = 1) {
  const color = PIEZAS[tipo].color;
  for (const [cx, cy] of celdas(tipo, giro, x, y)) {
    if (cy < FILAS_OCULTAS) continue;   // no dibujar lo que esta en la zona oculta
    dibujarJoya(ctx, ox + cx * tam, oy + (cy - FILAS_OCULTAS) * tam, tam, color, alfa);
  }
}

function dibujarPiezaFantasma(ctx, tipo, giro, x, y, ox, oy, tam) {
  const color = PIEZAS[tipo].color;
  for (const [cx, cy] of celdas(tipo, giro, x, y)) {
    if (cy < FILAS_OCULTAS) continue;
    dibujarFantasma(ctx, ox + cx * tam, oy + (cy - FILAS_OCULTAS) * tam, tam, color);
  }
}


// ══════════════════════════════════════════════════════════════════════
// js/juego.js
// ══════════════════════════════════════════════════════════════════════

/**
 * juego.js — El motor: estado, reglas y bucle.
 *
 * El bucle usa paso fijo con acumulador. En lugar de mover la pieza "un poco"
 * segun lo que haya tardado el fotograma, se acumula el tiempo transcurrido y se
 * avanza la simulacion en pasos iguales. Esto hace que el juego se comporte
 * exactamente igual en una pantalla de 60 Hz que en una de 144 Hz, y que no se
 * descontrole si el navegador se queda un momento sin CPU.
 */


/** Retardo de fijado: al tocar suelo, la pieza espera antes de quedar fija. */
const RETARDO_FIJADO = 500;
const MAX_REINICIOS_FIJADO = 15;

/** Movimiento lateral mantenido: espera inicial y luego repeticion. */
const DAS = 150;   // ms hasta que arranca la repeticion
const ARR = 40;    // ms entre repeticiones

const ESTADOS = {
  PORTADA: 'portada',
  JUGANDO: 'jugando',
  PAUSA: 'pausa',
  LIMPIANDO: 'limpiando',
  FIN: 'fin',
};

class Juego {
  constructor({ alAvisar, sonido }) {
    this.alAvisar = alAvisar;   // callback para mensajes en pantalla
    this.sonido = sonido;
    this.tablero = new Tablero();
    this.reiniciar();
  }

  reiniciar() {
    this.tablero.limpiar();
    this.bolsa = new Bolsa();
    this.puntos = 0;
    this.lineas = 0;
    this.nivel = 0;
    this.combo = -1;
    this.espaldaConEspalda = false;
    this.reserva = null;
    this.reservaUsada = false;
    this.estado = ESTADOS.PORTADA;
    this.acumulador = 0;
    this.tiempoFijado = 0;
    this.reiniciosFijado = 0;
    this.tocandoSuelo = false;
    this.filasBrillando = [];
    this.brillo = 0;
    this.tiempoLimpieza = 0;
    this.sacudida = 0;
    this.ultimoGiroFuePateo = false;
    this.piezasColocadas = 0;
    this.tiempoInicio = 0;
    this.pieza = null;
    // Métricas de la partida, para el historial y los logros.
    this.maxCombo = 0;
    this.maxLineasDeGolpe = 0;
    this.girosT = 0;
  }

  comenzar() {
    this.reiniciar();
    this.estado = ESTADOS.JUGANDO;
    this.tiempoInicio = performance.now();
    this.nuevaPieza();
  }

  /** Saca la siguiente pieza de la bolsa y la coloca arriba, centrada. */
  nuevaPieza(tipo = null) {
    const t = tipo || this.bolsa.siguiente();
    const def = PIEZAS[t];
    const x = Math.floor((COLUMNAS - def.tam) / 2);
    const y = 0;

    this.pieza = { tipo: t, giro: 0, x, y };
    this.tocandoSuelo = false;
    this.tiempoFijado = 0;
    this.reiniciosFijado = 0;
    this.ultimoGiroFuePateo = false;

    // Si la pieza nueva ya no cabe, la partida termina.
    if (!this.tablero.cabe(t, 0, x, y)) {
      this.terminar();
      return false;
    }
    return true;
  }

  terminar() {
    this.estado = ESTADOS.FIN;
    this.pieza = null;
    if (this.sonido) this.sonido.fin();
  }

  // ── Movimiento ────────────────────────────────────────────────────────────

  mover(dx) {
    if (this.estado !== ESTADOS.JUGANDO || !this.pieza) return false;
    const p = this.pieza;
    if (this.tablero.cabe(p.tipo, p.giro, p.x + dx, p.y)) {
      p.x += dx;
      this.reiniciarFijadoSiProcede();
      if (this.sonido) this.sonido.mover();
      return true;
    }
    return false;
  }

  girar(dir) {
    if (this.estado !== ESTADOS.JUGANDO || !this.pieza) return false;
    const p = this.pieza;
    const desde = p.giro;
    const hasta = (p.giro + dir + 4) % 4;

    // Se prueban los 5 desplazamientos del SRS en orden hasta que uno encaje.
    for (const [dx, dy] of pateos(p.tipo, desde, hasta)) {
      if (this.tablero.cabe(p.tipo, hasta, p.x + dx, p.y + dy)) {
        p.giro = hasta;
        p.x += dx;
        p.y += dy;
        // Un giro que necesito patear puede ser un T-spin: se anota para el conteo.
        this.ultimoGiroFuePateo = dx !== 0 || dy !== 0;
        this.reiniciarFijadoSiProcede();
        if (this.sonido) this.sonido.girar();
        return true;
      }
    }
    return false;
  }

  /**
   * Cada movimiento valido con la pieza apoyada reinicia el reloj de fijado,
   * hasta un tope. Sin el tope se podria mantener una pieza flotando para
   * siempre moviendola sin parar.
   */
  reiniciarFijadoSiProcede() {
    if (this.tocandoSuelo && this.reiniciosFijado < MAX_REINICIOS_FIJADO) {
      this.tiempoFijado = 0;
      this.reiniciosFijado++;
    }
  }

  /** Baja una celda. Devuelve si pudo. */
  bajar() {
    if (this.estado !== ESTADOS.JUGANDO || !this.pieza) return false;
    const p = this.pieza;
    if (this.tablero.cabe(p.tipo, p.giro, p.x, p.y + 1)) {
      p.y += 1;
      this.tocandoSuelo = false;
      return true;
    }
    this.tocandoSuelo = true;
    return false;
  }

  /** Caida suave: el jugador acelera y gana 1 punto por celda. */
  caidaSuave() {
    if (this.bajar()) {
      this.puntos += 1;
      this.acumulador = 0;
      return true;
    }
    return false;
  }

  /** Caida dura: la pieza baja del todo y se fija de inmediato. 2 puntos por celda. */
  caidaDura() {
    if (this.estado !== ESTADOS.JUGANDO || !this.pieza) return;
    const p = this.pieza;
    const d = this.tablero.distanciaAlSuelo(p.tipo, p.giro, p.x, p.y);
    p.y += d;
    this.puntos += d * 2;
    this.sacudida = Math.min(9, 3 + d * 0.32);
    if (this.sonido) this.sonido.soltar();
    this.fijar();
  }

  /** Guardar la pieza para despues. Solo una vez por pieza. */
  guardarEnReserva() {
    if (this.estado !== ESTADOS.JUGANDO || !this.pieza || this.reservaUsada) return;
    const actual = this.pieza.tipo;
    if (this.reserva) {
      const guardada = this.reserva;
      this.reserva = actual;
      this.nuevaPieza(guardada);
    } else {
      this.reserva = actual;
      this.nuevaPieza();
    }
    this.reservaUsada = true;
    if (this.sonido) this.sonido.reserva();
  }

  // ── Fijado y puntuacion ───────────────────────────────────────────────────

  /**
   * Detecta el T-spin: la pieza T cuenta como girada en un hueco si al menos 3 de
   * las 4 esquinas de su caja de 3x3 estan ocupadas y el ultimo giro necesito patear.
   */
  esTSpin() {
    if (!this.pieza || this.pieza.tipo !== 'T' || !this.ultimoGiroFuePateo) return false;
    const { x, y } = this.pieza;
    const esquinas = [[x, y], [x + 2, y], [x, y + 2], [x + 2, y + 2]];
    const ocupadas = esquinas.filter(([cx, cy]) => this.tablero.ocupada(cx, cy)).length;
    return ocupadas >= 3;
  }

  fijar() {
    const p = this.pieza;
    if (!p) return;

    const tspin = this.esTSpin();
    this.tablero.fijar(p.tipo, p.giro, p.x, p.y, PIEZAS[p.tipo].color);
    this.piezasColocadas++;

    const llenas = this.tablero.filasCompletas();

    if (this.tablero.desbordado() && llenas.length === 0) {
      this.terminar();
      return;
    }

    if (llenas.length > 0) {
      this.anotar(llenas.length, tspin);
      this.filasBrillando = llenas;
      this.brillo = 1;
      this.tiempoLimpieza = 0;
      this.estado = ESTADOS.LIMPIANDO;
      if (this.sonido) this.sonido.linea(llenas.length);
      if (llenas.length === 4) this.sacudida = 13;
      this.pieza = null;
      return;
    }

    // Sin lineas: se rompe la racha de combos.
    this.combo = -1;
    if (this.sonido) this.sonido.posar();
    this.reservaUsada = false;
    this.nuevaPieza();
  }

  /**
   * Puntuacion. Los valores base siguen la convencion del genero, multiplicados
   * por el nivel para que jugar rapido rinda mas.
   */
  anotar(cantidad, tspin) {
    const nivelPunt = this.nivel + 1;
    let base;
    let dificil = false;   // las jugadas "dificiles" encadenan bonus espalda-con-espalda

    this.maxLineasDeGolpe = Math.max(this.maxLineasDeGolpe, cantidad);
    if (tspin) this.girosT++;

    if (tspin) {
      base = [0, 800, 1200, 1600][cantidad] || 800;
      dificil = true;
      this.avisar(cantidad >= 2 ? '¡GIRO DOBLE!' : '¡GIRO EN T!', 'especial');
    } else {
      base = [0, 100, 300, 500, 800][cantidad] || 800;
      if (cantidad === 4) {
        dificil = true;
        this.avisar('¡CUÁDRUPLE!', 'especial');
      } else if (cantidad === 3) {
        this.avisar('¡TRIPLE!', 'normal');
      }
    }

    // Espalda con espalda: dos jugadas dificiles seguidas valen un 50% mas.
    if (dificil && this.espaldaConEspalda) {
      base = Math.floor(base * 1.5);
      this.avisar('¡SEGUIDAS!', 'especial');
    }
    this.espaldaConEspalda = dificil;

    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const bonusCombo = this.combo > 0 ? 50 * this.combo * nivelPunt : 0;
    if (this.combo >= 2) this.avisar(`COMBO ×${this.combo}`, 'normal');

    this.puntos += base * nivelPunt + bonusCombo;
    this.lineas += cantidad;

    const nivelNuevo = nivelDeLineas(this.lineas);
    if (nivelNuevo > this.nivel) {
      this.nivel = nivelNuevo;
      if (this.sonido) this.sonido.nivel();
      this.avisar(`NIVEL ${this.nivel} · ${nombreAmbiente(this.nivel)}`, 'nivel');
    }
  }

  avisar(texto, clase) {
    if (this.alAvisar) this.alAvisar(texto, clase);
  }

  // ── Bucle ─────────────────────────────────────────────────────────────────

  /**
   * Avanza la simulacion. dt viene en milisegundos.
   * Se limita dt a 100 ms para que, si la pestana estuvo en segundo plano, el
   * juego no procese de golpe todo el tiempo perdido y la pieza caiga en picado.
   */
  actualizar(dt, entradas) {
    dt = Math.min(dt, 100);

    if (this.sacudida > 0) this.sacudida = Math.max(0, this.sacudida - dt * 0.028);

    if (this.estado === ESTADOS.LIMPIANDO) {
      this.tiempoLimpieza += dt;
      this.brillo = Math.max(0, 1 - this.tiempoLimpieza / 260);
      if (this.tiempoLimpieza >= 260) {
        this.tablero.borrarFilas(this.filasBrillando);
        this.filasBrillando = [];
        this.brillo = 0;
        this.estado = ESTADOS.JUGANDO;
        this.reservaUsada = false;
        this.nuevaPieza();
      }
      return;
    }

    if (this.estado !== ESTADOS.JUGANDO || !this.pieza) return;

    // Movimiento lateral mantenido (DAS/ARR).
    if (entradas.izquierda || entradas.derecha) {
      const dir = entradas.izquierda ? -1 : 1;
      entradas.tiempoLateral += dt;
      if (!entradas.lateralIniciado) {
        this.mover(dir);
        entradas.lateralIniciado = true;
        entradas.tiempoLateral = 0;
      } else if (entradas.tiempoLateral >= DAS) {
        // Ya paso la espera: se repite cada ARR ms.
        while (entradas.tiempoLateral >= DAS + ARR) {
          this.mover(dir);
          entradas.tiempoLateral -= ARR;
        }
      }
    } else {
      entradas.lateralIniciado = false;
      entradas.tiempoLateral = 0;
    }

    // Gravedad. Con caida suave activa, va 18 veces mas rapido.
    const intervalo = entradas.abajo
      ? Math.min(velocidadCaida(this.nivel), 50) / 3
      : velocidadCaida(this.nivel);

    this.acumulador += dt;
    while (this.acumulador >= intervalo) {
      this.acumulador -= intervalo;
      const bajo = this.bajar();
      if (bajo && entradas.abajo) this.puntos += 1;
      if (!bajo) break;
    }

    // Retardo de fijado.
    const p = this.pieza;
    const apoyada = !this.tablero.cabe(p.tipo, p.giro, p.x, p.y + 1);
    if (apoyada) {
      this.tocandoSuelo = true;
      this.tiempoFijado += dt;
      if (this.tiempoFijado >= RETARDO_FIJADO) this.fijar();
    } else {
      this.tocandoSuelo = false;
      this.tiempoFijado = 0;
    }
  }

  /** Datos que necesita la interfaz. */
  instantanea() {
    return {
      puntos: this.puntos,
      lineas: this.lineas,
      nivel: this.nivel,
      combo: this.combo,
      reserva: this.reserva,
      siguientes: this.bolsa.asomar(5),
      estado: this.estado,
      ambiente: ambiente(this.nivel),
      nombreNivel: nombreAmbiente(this.nivel),
      piezas: this.piezasColocadas,
      segundos: this.tiempoInicio ? (performance.now() - this.tiempoInicio) / 1000 : 0,
      maxCombo: this.maxCombo,
      maxLineasDeGolpe: this.maxLineasDeGolpe,
      girosT: this.girosT,
    };
  }
}


// ══════════════════════════════════════════════════════════════════════
// js/controles.js
// ══════════════════════════════════════════════════════════════════════

/**
 * controles.js — Teclado, gestos y botones.
 *
 * El juego debe jugarse igual de bien con teclado en un portatil que con el dedo
 * en un movil, asi que hay tres entradas que producen las mismas acciones:
 *
 *   - Teclado: flechas y teclas clasicas.
 *   - Gestos: deslizar para mover, tocar para girar, deslizar abajo para soltar.
 *   - Botones grandes en pantalla, para manos pequenas que aun no dominan gestos.
 */

function crearEntradas() {
  return {
    izquierda: false,
    derecha: false,
    abajo: false,
    lateralIniciado: false,
    tiempoLateral: 0,
  };
}

class Controles {
  constructor(juego, entradas, acciones) {
    this.juego = juego;
    this.entradas = entradas;
    this.acciones = acciones;    // { alPausar, alReiniciar, alDespertarAudio }
    this.conectarTeclado();
  }

  conectarTeclado() {
    const abajo = (e) => {
      // Se ignoran las combinaciones con Ctrl/Alt/Meta para no pisar los atajos
      // del navegador (recargar, cambiar de pestana, etc).
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const manejado = this.pulsar(e.key);
      if (manejado) {
        e.preventDefault();
        this.acciones.alDespertarAudio();
      }
    };

    const arriba = (e) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': this.entradas.izquierda = false; break;
        case 'ArrowRight': case 'd': case 'D': this.entradas.derecha = false; break;
        case 'ArrowDown': case 's': case 'S': this.entradas.abajo = false; break;
      }
    };

    window.addEventListener('keydown', abajo);
    window.addEventListener('keyup', arriba);
    // Si la ventana pierde el foco se sueltan las teclas, para que la pieza no
    // siga moviendose sola al volver.
    window.addEventListener('blur', () => {
      this.entradas.izquierda = false;
      this.entradas.derecha = false;
      this.entradas.abajo = false;
    });
  }

  pulsar(tecla) {
    switch (tecla) {
      case 'ArrowLeft': case 'a': case 'A':
        this.entradas.izquierda = true; this.entradas.derecha = false; return true;
      case 'ArrowRight': case 'd': case 'D':
        this.entradas.derecha = true; this.entradas.izquierda = false; return true;
      case 'ArrowDown': case 's': case 'S':
        this.entradas.abajo = true; return true;
      case 'ArrowUp': case 'x': case 'X':
        this.juego.girar(1); return true;
      case 'z': case 'Z': case 'Control':
        this.juego.girar(-1); return true;
      case ' ':
        this.juego.caidaDura(); return true;
      case 'c': case 'C': case 'Shift':
        this.juego.guardarEnReserva(); return true;
      case 'p': case 'P': case 'Escape':
        this.acciones.alPausar(); return true;
      case 'r': case 'R':
        this.acciones.alReiniciar(); return true;
      case 'Enter':
        this.acciones.alReiniciar(); return true;
      default:
        return false;
    }
  }

  /**
   * Gestos sobre el lienzo.
   *
   * Umbrales pensados para dedos infantiles: mover requiere recorrer el ancho de
   * una celda, para que un temblor no mueva la pieza sin querer; soltar exige un
   * gesto claro hacia abajo, para que no ocurra por accidente y arruine la partida.
   */
  conectarGestos(lienzo, tamCelda) {
    let x0 = 0, y0 = 0, t0 = 0;
    let movidoX = 0, movidoY = 0;
    let fueArrastre = false;
    let activo = false;

    const inicio = (e) => {
      const p = e.touches ? e.touches[0] : e;
      x0 = p.clientX; y0 = p.clientY; t0 = performance.now();
      movidoX = 0; movidoY = 0; fueArrastre = false; activo = true;
      this.acciones.alDespertarAudio();
    };

    const mover = (e) => {
      if (!activo) return;
      const p = e.touches ? e.touches[0] : e;
      const umbral = Math.max(18, tamCelda() * 0.75);

      const dx = p.clientX - x0;
      const dy = p.clientY - y0;

      // Horizontal: una celda por cada "umbral" recorrido.
      if (Math.abs(dx) >= umbral) {
        const pasos = Math.trunc(dx / umbral);
        for (let i = 0; i < Math.abs(pasos); i++) this.juego.mover(Math.sign(pasos));
        x0 += pasos * umbral;
        movidoX += Math.abs(pasos);
        fueArrastre = true;
      }

      // Vertical hacia abajo: caida suave continua.
      if (dy >= umbral && Math.abs(dx) < umbral) {
        this.juego.caidaSuave();
        y0 += umbral;
        movidoY++;
        fueArrastre = true;
      }

      if (e.cancelable) e.preventDefault();
    };

    const fin = (e) => {
      if (!activo) return;
      activo = false;
      const dur = performance.now() - t0;
      const p = (e.changedTouches ? e.changedTouches[0] : e);
      const dy = p.clientY - y0;

      // Deslizamiento rapido y largo hacia abajo = soltar la pieza.
      if (!fueArrastre && dy > tamCelda() * 2 && dur < 300) {
        this.juego.caidaDura();
        return;
      }
      // Toque corto sin arrastre = girar.
      if (!fueArrastre && dur < 250 && Math.abs(dy) < 16) {
        this.juego.girar(1);
      }
    };

    lienzo.addEventListener('touchstart', inicio, { passive: true });
    lienzo.addEventListener('touchmove', mover, { passive: false });
    lienzo.addEventListener('touchend', fin, { passive: true });
    lienzo.addEventListener('touchcancel', () => { activo = false; }, { passive: true });
  }

  /** Botones en pantalla. Se mantienen pulsados para mover en continuo. */
  conectarBotones(contenedor) {
    const acciones = {
      izquierda: { inicio: () => { this.entradas.izquierda = true; }, fin: () => { this.entradas.izquierda = false; } },
      derecha:   { inicio: () => { this.entradas.derecha = true; },   fin: () => { this.entradas.derecha = false; } },
      abajo:     { inicio: () => { this.entradas.abajo = true; },     fin: () => { this.entradas.abajo = false; } },
      girar:     { inicio: () => this.juego.girar(1) },
      soltar:    { inicio: () => this.juego.caidaDura() },
      reserva:   { inicio: () => this.juego.guardarEnReserva() },
    };

    for (const [nombre, fns] of Object.entries(acciones)) {
      const btn = contenedor.querySelector(`[data-accion="${nombre}"]`);
      if (!btn) continue;

      const empezar = (e) => {
        if (e.cancelable) e.preventDefault();
        this.acciones.alDespertarAudio();
        btn.classList.add('pulsado');
        fns.inicio();
      };
      const acabar = (e) => {
        if (e && e.cancelable) e.preventDefault();
        btn.classList.remove('pulsado');
        if (fns.fin) fns.fin();
      };

      btn.addEventListener('touchstart', empezar, { passive: false });
      btn.addEventListener('touchend', acabar, { passive: false });
      btn.addEventListener('touchcancel', acabar, { passive: false });
      btn.addEventListener('mousedown', empezar);
      btn.addEventListener('mouseup', acabar);
      btn.addEventListener('mouseleave', acabar);
    }
  }
}


// ══════════════════════════════════════════════════════════════════════
// js/main.js
// ══════════════════════════════════════════════════════════════════════

/**
 * main.js — Union de todas las piezas: lienzo, bucle de dibujo, interfaz y
 * base de datos.
 */


const $ = (sel) => document.querySelector(sel);

const lienzo = $('#lienzo');
const ctx = lienzo.getContext('2d', { alpha: false });
const lienzoSig = $('#lienzo-siguientes');
const ctxSig = lienzoSig.getContext('2d');
const lienzoRes = $('#lienzo-reserva');
const ctxRes = lienzoRes.getContext('2d');

const sonido = new Sonido();
const entradas = crearEntradas();
const particulas = new Particulas();

// Ajustes en memoria; se rellenan desde la base de datos al arrancar.
const ajustes = { sonido: true, fantasma: true, record: 0 };

const juego = new Juego({ sonido, alAvisar: mostrarAviso });

// ── Dimensionado ────────────────────────────────────────────────────────────

let tamCelda = 30;
const origenX = 0;
const origenY = 0;
let dpr = 1;

function redimensionar() {
  const caja = lienzo.parentElement.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);

  const filasVisibles = FILAS - FILAS_OCULTAS;
  tamCelda = Math.floor(Math.min(caja.width / COLUMNAS, caja.height / filasVisibles));
  if (!Number.isFinite(tamCelda) || tamCelda < 4) tamCelda = 4;

  const anchoCss = tamCelda * COLUMNAS;
  const altoCss = tamCelda * filasVisibles;

  lienzo.style.width = `${anchoCss}px`;
  lienzo.style.height = `${altoCss}px`;
  lienzo.width = Math.floor(anchoCss * dpr);
  lienzo.height = Math.floor(altoCss * dpr);

  for (const cv of [lienzoSig, lienzoRes]) {
    const r = cv.parentElement.getBoundingClientRect();
    cv.style.width = `${r.width}px`;
    cv.style.height = `${r.height}px`;
    cv.width = Math.max(1, Math.floor(r.width * dpr));
    cv.height = Math.max(1, Math.floor(r.height * dpr));
  }
}

window.addEventListener('resize', redimensionar);
window.addEventListener('orientationchange', () => setTimeout(redimensionar, 120));

// ── Avisos en pantalla ──────────────────────────────────────────────────────

const capaAvisos = $('#avisos');

function mostrarAviso(texto, clase = 'normal') {
  const el = document.createElement('div');
  el.className = `aviso aviso--${clase}`;
  el.textContent = texto;          // textContent, nunca innerHTML.
  capaAvisos.appendChild(el);
  setTimeout(() => el.remove(), 1500);
  while (capaAvisos.children.length > 6) capaAvisos.firstChild.remove();
}

// ── Interfaz ────────────────────────────────────────────────────────────────

const numero = (n) => Number(n || 0).toLocaleString('es');

function duracion(seg) {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

function fechaCorta(ms) {
  try {
    return new Date(ms).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

function pintarInterfaz(inst) {
  $('#puntos').textContent = numero(inst.puntos);
  $('#lineas').textContent = inst.lineas;
  $('#nivel').textContent = inst.nivel;
  $('#record').textContent = numero(ajustes.record);
  $('#nombre-nivel').textContent = inst.nombreNivel;

  const cbo = $('#combo');
  if (inst.combo >= 1 && inst.estado === ESTADOS.JUGANDO) {
    cbo.textContent = `COMBO ×${inst.combo}`;
    cbo.classList.add('visible');
  } else {
    cbo.classList.remove('visible');
  }

  document.documentElement.style.setProperty('--acento', inst.ambiente.aurora1);
  document.documentElement.style.setProperty('--acento-2', inst.ambiente.aurora2);
}

function pintarPaneles(inst) {
  const anchoS = lienzoSig.width / dpr;
  const altoS = lienzoSig.height / dpr;
  ctxSig.save();
  ctxSig.scale(dpr, dpr);
  ctxSig.clearRect(0, 0, anchoS, altoS);
  const n = 5;
  const alturaCada = altoS / n;
  inst.siguientes.slice(0, n).forEach((tipo, i) => {
    ctxSig.globalAlpha = 1 - i * 0.14;
    dibujarPiezaEnCaja(ctxSig, tipo, 0, i * alturaCada, anchoS, alturaCada);
  });
  ctxSig.restore();

  const anchoR = lienzoRes.width / dpr;
  const altoR = lienzoRes.height / dpr;
  ctxRes.save();
  ctxRes.scale(dpr, dpr);
  ctxRes.clearRect(0, 0, anchoR, altoR);
  if (inst.reserva) {
    ctxRes.globalAlpha = juego.reservaUsada ? 0.35 : 1;
    dibujarPiezaEnCaja(ctxRes, inst.reserva, 0, 0, anchoR, altoR);
  }
  ctxRes.restore();
}

// ── Bucle ───────────────────────────────────────────────────────────────────

let ultimo = performance.now();

function bucle(ahora) {
  const dt = ahora - ultimo;
  ultimo = ahora;

  juego.actualizar(dt, entradas);
  particulas.actualizar(dt);

  const inst = juego.instantanea();
  dibujar(inst, ahora);
  pintarInterfaz(inst);
  pintarPaneles(inst);

  requestAnimationFrame(bucle);
}

function dibujar(inst, t) {
  const ancho = lienzo.width / dpr;
  const alto = lienzo.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);

  if (juego.sacudida > 0) {
    ctx.translate((Math.random() - 0.5) * juego.sacudida, (Math.random() - 0.5) * juego.sacudida);
  }

  dibujarFondo(ctx, ancho, alto, inst.ambiente, t);
  dibujarRejilla(ctx, origenX, origenY, tamCelda, inst.ambiente);
  dibujarTablero(ctx, juego.tablero, origenX, origenY, tamCelda, juego.filasBrillando, juego.brillo);

  if (juego.pieza && inst.estado === ESTADOS.JUGANDO) {
    const p = juego.pieza;
    if (ajustes.fantasma) {
      const d = juego.tablero.distanciaAlSuelo(p.tipo, p.giro, p.x, p.y);
      if (d > 0) dibujarPiezaFantasma(ctx, p.tipo, p.giro, p.x, p.y + d, origenX, origenY, tamCelda);
    }
    const alfa = juego.tocandoSuelo ? 0.72 + 0.28 * Math.cos(juego.tiempoFijado / 55) : 1;
    dibujarPiezaActiva(ctx, p.tipo, p.giro, p.x, p.y, origenX, origenY, tamCelda, alfa);
  }

  particulas.dibujar(ctx);
  ctx.restore();
}

// Partículas al completar filas.
const fijarOriginal = juego.fijar.bind(juego);
juego.fijar = function () {
  fijarOriginal();
  if (juego.filasBrillando.length > 0) {
    for (const fila of juego.filasBrillando) {
      for (let x = 0; x < COLUMNAS; x++) {
        const color = juego.tablero.rejilla[fila][x] || 'oro';
        particulas.estallido(
          origenX + x * tamCelda + tamCelda / 2,
          origenY + (fila - FILAS_OCULTAS) * tamCelda + tamCelda / 2,
          color, 10,
        );
      }
    }
  }
};

// ── Pantallas ───────────────────────────────────────────────────────────────

const portada = $('#portada');
const pantallaPausa = $('#pausa');
const pantallaFin = $('#fin');
const pantallaDatos = $('#datos');

function ocultarTodas() {
  [portada, pantallaPausa, pantallaFin, pantallaDatos].forEach((p) => p.classList.remove('visible'));
}

function empezarPartida() {
  ocultarTodas();
  particulas.limpiar();
  juego.comenzar();
  sonido.despertar();
  redimensionar();
}

function alternarPausa() {
  if (juego.estado === ESTADOS.JUGANDO) {
    juego.estado = ESTADOS.PAUSA;
    pantallaPausa.classList.add('visible');
  } else if (juego.estado === ESTADOS.PAUSA) {
    juego.estado = ESTADOS.JUGANDO;
    ultimo = performance.now();
    pantallaPausa.classList.remove('visible');
  }
}

// ── Guardado al terminar la partida ─────────────────────────────────────────

let finProcesado = false;

async function procesarFin() {
  const inst = juego.instantanea();

  const partida = {
    fecha: Date.now(),
    puntos: inst.puntos,
    lineas: inst.lineas,
    nivel: inst.nivel,
    piezas: inst.piezas,
    segundos: Math.round(inst.segundos),
    maxCombo: inst.maxCombo,
    maxLineasDeGolpe: inst.maxLineasDeGolpe,
    girosT: inst.girosT,
  };

  await guardarPartida(partida);
  const totales = await estadisticas();
  ajustes.record = totales.record;

  const nuevosLogros = await revisarLogros(partida, totales);

  $('#fin-puntos').textContent = numero(partida.puntos);
  $('#fin-lineas').textContent = partida.lineas;
  $('#fin-nivel').textContent = partida.nivel;
  $('#fin-record').textContent = numero(totales.record);
  $('#fin-tiempo').textContent = duracion(partida.segundos);
  $('#fin-titulo').textContent =
    partida.puntos > 0 && partida.puntos >= totales.record ? '¡NUEVO RÉCORD!' : '¡Buen intento!';

  // Logros recién conseguidos.
  const caja = $('#fin-logros');
  caja.textContent = '';
  if (nuevosLogros.length > 0) {
    for (const logro of nuevosLogros) {
      const el = document.createElement('div');
      el.className = 'logro logro--nuevo';
      const ico = document.createElement('span');
      ico.className = 'logro__icono';
      ico.textContent = logro.icono;
      const txt = document.createElement('div');
      const t = document.createElement('strong');
      t.textContent = logro.titulo;
      const d = document.createElement('span');
      d.textContent = logro.descripcion;
      txt.append(t, d);
      el.append(ico, txt);
      caja.appendChild(el);
    }
    caja.classList.add('visible');
  } else {
    caja.classList.remove('visible');
  }

  pantallaFin.classList.add('visible');
}

setInterval(() => {
  if (juego.estado === ESTADOS.FIN && !finProcesado) {
    finProcesado = true;
    procesarFin().catch(() => {
      // Si la base de datos falla, se muestra el resumen igualmente.
      pantallaFin.classList.add('visible');
    });
  }
  if (juego.estado !== ESTADOS.FIN) finProcesado = false;
}, 150);

// ── Pantalla de datos: récords, estadísticas y logros ───────────────────────

async function abrirDatos(pestana = 'records') {
  ocultarTodas();
  pantallaDatos.classList.add('visible');
  await pintarPestana(pestana);

  for (const btn of document.querySelectorAll('[data-pestana]')) {
    btn.classList.toggle('pestana--activa', btn.dataset.pestana === pestana);
  }
}

async function pintarPestana(pestana) {
  const cuerpo = $('#datos-cuerpo');
  cuerpo.textContent = '';

  if (pestana === 'records') {
    const mejores = await mejoresPartidas(10);
    if (mejores.length === 0) {
      cuerpo.appendChild(vacio('Aún no hay partidas. ¡Juega una!'));
      return;
    }
    const lista = document.createElement('ol');
    lista.className = 'tabla-records';
    mejores.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'fila-record';
      if (i === 0) li.classList.add('fila-record--primera');

      const pos = document.createElement('span');
      pos.className = 'fila-record__pos';
      pos.textContent = ['🥇', '🥈', '🥉'][i] || String(i + 1);

      const pts = document.createElement('strong');
      pts.className = 'fila-record__puntos';
      pts.textContent = numero(p.puntos);

      const det = document.createElement('span');
      det.className = 'fila-record__detalle';
      det.textContent = `nivel ${p.nivel} · ${p.lineas} líneas · ${fechaCorta(p.fecha)}`;

      li.append(pos, pts, det);
      lista.appendChild(li);
    });
    cuerpo.appendChild(lista);
    return;
  }

  if (pestana === 'estadisticas') {
    const e = await estadisticas();
    const recientes = await ultimasPartidas(12);

    if (e.partidas === 0) {
      cuerpo.appendChild(vacio('Aún no hay estadísticas. ¡Juega una partida!'));
      return;
    }

    const rejilla = document.createElement('div');
    rejilla.className = 'rejilla-datos';
    const filas = [
      ['Partidas', numero(e.partidas)],
      ['Mejor puntuación', numero(e.record)],
      ['Media por partida', numero(e.mediaPuntos)],
      ['Líneas totales', numero(e.lineasTotales)],
      ['Nivel más alto', numero(e.nivelMaximo)],
      ['Mejor combo', `×${e.mejorCombo}`],
      ['Piezas colocadas', numero(e.piezasTotales)],
      ['Tiempo jugado', duracion(e.tiempoTotal)],
    ];
    for (const [etiqueta, valor] of filas) {
      const celda = document.createElement('div');
      celda.className = 'celda-dato';
      const v = document.createElement('strong');
      v.textContent = valor;
      const t = document.createElement('span');
      t.textContent = etiqueta;
      celda.append(v, t);
      rejilla.appendChild(celda);
    }
    cuerpo.appendChild(rejilla);

    // Gráfico sencillo de las últimas partidas.
    if (recientes.length > 1) {
      const titulo = document.createElement('h3');
      titulo.className = 'sub-titulo';
      titulo.textContent = 'Últimas partidas';
      cuerpo.appendChild(titulo);

      const grafico = document.createElement('div');
      grafico.className = 'grafico';
      const maximo = Math.max(...recientes.map((p) => p.puntos), 1);
      [...recientes].reverse().forEach((p) => {
        const barra = document.createElement('div');
        barra.className = 'grafico__barra';
        barra.style.height = `${Math.max(4, (p.puntos / maximo) * 100)}%`;
        barra.title = `${numero(p.puntos)} puntos`;
        grafico.appendChild(barra);
      });
      cuerpo.appendChild(grafico);
    }
    return;
  }

  if (pestana === 'logros') {
    const conseguidos = new Set((await logrosConseguidos()).map((l) => l.id));
    const lista = document.createElement('div');
    lista.className = 'lista-logros';

    const cabecera = document.createElement('p');
    cabecera.className = 'contador-logros';
    cabecera.textContent = `${conseguidos.size} de ${LOGROS.length} conseguidos`;
    cuerpo.appendChild(cabecera);

    for (const logro of LOGROS) {
      const tengo = conseguidos.has(logro.id);
      const el = document.createElement('div');
      el.className = tengo ? 'logro' : 'logro logro--bloqueado';

      const ico = document.createElement('span');
      ico.className = 'logro__icono';
      ico.textContent = tengo ? logro.icono : '🔒';

      const txt = document.createElement('div');
      const t = document.createElement('strong');
      t.textContent = logro.titulo;
      const d = document.createElement('span');
      d.textContent = logro.descripcion;
      txt.append(t, d);

      el.append(ico, txt);
      lista.appendChild(el);
    }
    cuerpo.appendChild(lista);
  }
}

function vacio(texto) {
  const p = document.createElement('p');
  p.className = 'vacio';
  p.textContent = texto;
  return p;
}

// ── Controles ───────────────────────────────────────────────────────────────

const controles = new Controles(juego, entradas, {
  alPausar: () => {
    if (pantallaDatos.classList.contains('visible')) { cerrarDatos(); return; }
    alternarPausa();
  },
  alReiniciar: () => {
    if (juego.estado === ESTADOS.FIN || juego.estado === ESTADOS.PORTADA) empezarPartida();
  },
  alDespertarAudio: () => sonido.despertar(),
});

controles.conectarGestos(lienzo, () => tamCelda);
controles.conectarBotones($('#mando'));

function cerrarDatos() {
  pantallaDatos.classList.remove('visible');
  if (juego.estado === ESTADOS.PORTADA) portada.classList.add('visible');
  else if (juego.estado === ESTADOS.FIN) pantallaFin.classList.add('visible');
  else if (juego.estado === ESTADOS.PAUSA) pantallaPausa.classList.add('visible');
}

$('#btn-jugar').addEventListener('click', empezarPartida);
$('#btn-reintentar').addEventListener('click', empezarPartida);
$('#btn-reanudar').addEventListener('click', alternarPausa);
$('#btn-pausa').addEventListener('click', alternarPausa);
$('#btn-cerrar-datos').addEventListener('click', cerrarDatos);

for (const btn of document.querySelectorAll('[data-abrir-datos]')) {
  btn.addEventListener('click', () => abrirDatos(btn.dataset.abrirDatos || 'records'));
}
for (const btn of document.querySelectorAll('[data-pestana]')) {
  btn.addEventListener('click', () => abrirDatos(btn.dataset.pestana));
}

// Nota sobre e.currentTarget: solo es valido mientras el evento se esta
// despachando. En cuanto el manejador cede el control con un await, el
// navegador lo deja en null, asi que hay que guardar la referencia al boton
// ANTES de esperar. Si no, la linea de despues lanza un TypeError y el icono
// nunca se actualiza.
$('#btn-sonido').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  sonido.despertar();
  const activo = sonido.alternar();
  ajustes.sonido = activo;
  btn.setAttribute('aria-pressed', String(activo));
  btn.textContent = activo ? '🔊' : '🔇';
  await guardarAjuste('sonido', activo);
});

$('#btn-fantasma').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  ajustes.fantasma = !ajustes.fantasma;
  btn.setAttribute('aria-pressed', String(ajustes.fantasma));
  btn.textContent = ajustes.fantasma ? '👁' : '🚫';
  await guardarAjuste('fantasma', ajustes.fantasma);
});

$('#btn-borrar').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  // Doble confirmación: el primer clic avisa, el segundo borra.
  if (btn.dataset.confirmando !== 'si') {
    btn.dataset.confirmando = 'si';
    btn.textContent = '¿Seguro? Pulsa otra vez';
    btn.classList.add('boton--peligro');
    setTimeout(() => {
      btn.dataset.confirmando = 'no';
      btn.textContent = 'Borrar todo el progreso';
      btn.classList.remove('boton--peligro');
    }, 4000);
    return;
  }
  await borrarTodo();
  ajustes.record = 0;
  btn.dataset.confirmando = 'no';
  btn.textContent = 'Borrado ✓';
  btn.classList.remove('boton--peligro');
  setTimeout(() => { btn.textContent = 'Borrar todo el progreso'; }, 2000);
  await pintarPestana('records');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && juego.estado === ESTADOS.JUGANDO) alternarPausa();
});

// ── Arranque ────────────────────────────────────────────────────────────────

async function arrancar() {
  await abrir();
  await migrarDesdeLocalStorage();

  ajustes.sonido = await leerAjuste('sonido', true);
  ajustes.fantasma = await leerAjuste('fantasma', true);
  const totales = await estadisticas();
  ajustes.record = totales.record;

  sonido.activo = ajustes.sonido;
  $('#btn-sonido').textContent = ajustes.sonido ? '🔊' : '🔇';
  $('#btn-sonido').setAttribute('aria-pressed', String(ajustes.sonido));
  $('#btn-fantasma').textContent = ajustes.fantasma ? '👁' : '🚫';
  $('#btn-fantasma').setAttribute('aria-pressed', String(ajustes.fantasma));
  $('#record').textContent = numero(ajustes.record);

  // Si no se puede guardar nada, se dice claramente en vez de fingir que sí.
  if (enMemoria()) {
    const aviso = $('#aviso-memoria');
    if (aviso) aviso.classList.add('visible');
  }
}

// Muestrario de joyas en la portada.
function pintarMuestrario() {
  const cv = $('#muestrario');
  if (!cv) return;
  const c = cv.getContext('2d');
  const d = Math.min(window.devicePixelRatio || 1, 2.5);
  const r = cv.getBoundingClientRect();
  if (!r.width) return;
  cv.width = Math.floor(r.width * d);
  cv.height = Math.floor(r.height * d);
  c.scale(d, d);
  const tipos = Object.keys(PIEZAS);
  const paso = r.width / tipos.length;
  tipos.forEach((t, i) => dibujarPiezaEnCaja(c, t, i * paso, 0, paso, r.height));
}

redimensionar();
pintarMuestrario();
requestAnimationFrame(bucle);

// La base de datos se abre en segundo plano: el juego es jugable desde el
// primer instante aunque la base tarde o falle.
arrancar().catch(() => {});

// El trabajador de servicio solo existe en http/https. Con file:// no está
// disponible, y eso es normal: el juego funciona igual, solo que sin instalarse.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

})();

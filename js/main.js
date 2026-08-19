/**
 * main.js — Union de todas las piezas: lienzo, bucle de dibujo e interfaz.
 */

import { Juego, ESTADOS } from './juego.js';
import { Controles, crearEntradas } from './controles.js';
import { Sonido } from './audio.js';
import { COLUMNAS, FILAS, FILAS_OCULTAS } from './tablero.js';
import { PIEZAS } from './piezas.js';
import {
  dibujarFondo, dibujarRejilla, dibujarTablero, dibujarPiezaActiva,
  dibujarPiezaFantasma, dibujarPiezaEnCaja, Particulas,
} from './render.js';
import { JOYAS } from './temas.js';
import * as almacen from './almacenamiento.js';

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

let ajustes = almacen.leer();
sonido.activo = ajustes.sonido;

const juego = new Juego({ sonido, alAvisar: mostrarAviso });

// ── Dimensionado ────────────────────────────────────────────────────────────
// El lienzo se redimensiona al tamano real en pixeles del dispositivo para que
// los bordes de las joyas salgan nitidos en pantallas de alta densidad.

let tamCelda = 30;
let origenX = 0;
let origenY = 0;
let dpr = 1;

function redimensionar() {
  const caja = lienzo.parentElement.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);

  const filasVisibles = FILAS - FILAS_OCULTAS;
  // La celda se ajusta a lo que quepa, tanto de ancho como de alto.
  const porAncho = caja.width / COLUMNAS;
  const porAlto = caja.height / filasVisibles;
  tamCelda = Math.floor(Math.min(porAncho, porAlto));

  const anchoCss = tamCelda * COLUMNAS;
  const altoCss = tamCelda * filasVisibles;

  lienzo.style.width = `${anchoCss}px`;
  lienzo.style.height = `${altoCss}px`;
  lienzo.width = Math.floor(anchoCss * dpr);
  lienzo.height = Math.floor(altoCss * dpr);

  origenX = 0;
  origenY = 0;

  for (const [c, cv] of [[ctxSig, lienzoSig], [ctxRes, lienzoRes]]) {
    const r = cv.parentElement.getBoundingClientRect();
    cv.style.width = `${r.width}px`;
    cv.style.height = `${r.height}px`;
    cv.width = Math.floor(r.width * dpr);
    cv.height = Math.floor(r.height * dpr);
  }
}

window.addEventListener('resize', redimensionar);
window.addEventListener('orientationchange', () => setTimeout(redimensionar, 120));

// ── Avisos en pantalla ──────────────────────────────────────────────────────

const capaAvisos = $('#avisos');

function mostrarAviso(texto, clase = 'normal') {
  const el = document.createElement('div');
  el.className = `aviso aviso--${clase}`;
  el.textContent = texto;            // textContent, nunca innerHTML: el texto
  capaAvisos.appendChild(el);        // nunca se interpreta como HTML.
  setTimeout(() => el.remove(), 1500);
  // Tope defensivo por si se encadenan muchisimos avisos.
  while (capaAvisos.children.length > 6) capaAvisos.firstChild.remove();
}

// ── Interfaz ────────────────────────────────────────────────────────────────

function pintarInterfaz(inst) {
  $('#puntos').textContent = inst.puntos.toLocaleString('es');
  $('#lineas').textContent = inst.lineas;
  $('#nivel').textContent = inst.nivel;
  $('#record').textContent = ajustes.record.toLocaleString('es');
  $('#nombre-nivel').textContent = inst.nombreNivel;

  const cbo = $('#combo');
  if (inst.combo >= 1 && inst.estado === ESTADOS.JUGANDO) {
    cbo.textContent = `COMBO ×${inst.combo}`;
    cbo.classList.add('visible');
  } else {
    cbo.classList.remove('visible');
  }

  // El color de acento de toda la interfaz sigue al ambiente del nivel.
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

  // Sacudida de pantalla al soltar piezas o completar cuatro lineas.
  let sx = 0, sy = 0;
  if (juego.sacudida > 0) {
    sx = (Math.random() - 0.5) * juego.sacudida;
    sy = (Math.random() - 0.5) * juego.sacudida;
  }
  ctx.translate(sx, sy);

  dibujarFondo(ctx, ancho, alto, inst.ambiente, t);
  dibujarRejilla(ctx, origenX, origenY, tamCelda, inst.ambiente);

  dibujarTablero(ctx, juego.tablero, origenX, origenY, tamCelda, juego.filasBrillando, juego.brillo);

  if (juego.pieza && inst.estado === ESTADOS.JUGANDO) {
    const p = juego.pieza;
    if (ajustes.fantasma) {
      const d = juego.tablero.distanciaAlSuelo(p.tipo, p.giro, p.x, p.y);
      if (d > 0) dibujarPiezaFantasma(ctx, p.tipo, p.giro, p.x, p.y + d, origenX, origenY, tamCelda);
    }
    // La pieza parpadea suavemente cuando esta a punto de fijarse.
    const alfa = juego.tocandoSuelo
      ? 0.72 + 0.28 * Math.cos(juego.tiempoFijado / 55)
      : 1;
    dibujarPiezaActiva(ctx, p.tipo, p.giro, p.x, p.y, origenX, origenY, tamCelda, alfa);
  }

  particulas.dibujar(ctx);
  ctx.restore();
}

// Al completar filas se lanzan particulas desde cada celda borrada.
const fijarOriginal = juego.fijar.bind(juego);
juego.fijar = function () {
  const antes = juego.filasBrillando.length;
  fijarOriginal();
  if (juego.filasBrillando.length > antes || (antes === 0 && juego.filasBrillando.length > 0)) {
    for (const fila of juego.filasBrillando) {
      for (let x = 0; x < COLUMNAS; x++) {
        const color = juego.tablero.rejilla[fila][x] || 'oro';
        particulas.estallido(
          origenX + x * tamCelda + tamCelda / 2,
          origenY + (fila - FILAS_OCULTAS) * tamCelda + tamCelda / 2,
          color,
          10,
        );
      }
    }
  }
};

// ── Pantallas ───────────────────────────────────────────────────────────────

const portada = $('#portada');
const pantallaPausa = $('#pausa');
const pantallaFin = $('#fin');

function ocultarTodas() {
  [portada, pantallaPausa, pantallaFin].forEach((p) => p.classList.remove('visible'));
}

function empezarPartida() {
  ocultarTodas();
  particulas.limpiar();
  juego.comenzar();
  sonido.despertar();
}

function alternarPausa() {
  if (juego.estado === ESTADOS.JUGANDO) {
    juego.estado = ESTADOS.PAUSA;
    pantallaPausa.classList.add('visible');
  } else if (juego.estado === ESTADOS.PAUSA) {
    juego.estado = ESTADOS.JUGANDO;
    ultimo = performance.now();   // evita un salto de gravedad al reanudar
    pantallaPausa.classList.remove('visible');
  }
}

// Se vigila el fin de partida para mostrar el resumen una sola vez.
let finMostrado = false;
setInterval(() => {
  if (juego.estado === ESTADOS.FIN && !finMostrado) {
    finMostrado = true;
    const inst = juego.instantanea();
    ajustes = almacen.registrarPartida(inst);
    $('#fin-puntos').textContent = inst.puntos.toLocaleString('es');
    $('#fin-lineas').textContent = inst.lineas;
    $('#fin-nivel').textContent = inst.nivel;
    $('#fin-record').textContent = ajustes.record.toLocaleString('es');
    $('#fin-titulo').textContent = inst.puntos >= ajustes.record && inst.puntos > 0
      ? '¡NUEVO RÉCORD!'
      : '¡Buen intento!';
    pantallaFin.classList.add('visible');
  }
  if (juego.estado !== ESTADOS.FIN) finMostrado = false;
}, 150);

// ── Controles ───────────────────────────────────────────────────────────────

const controles = new Controles(juego, entradas, {
  alPausar: alternarPausa,
  alReiniciar: () => {
    if (juego.estado === ESTADOS.FIN || juego.estado === ESTADOS.PORTADA) empezarPartida();
  },
  alDespertarAudio: () => sonido.despertar(),
});

controles.conectarGestos(lienzo, () => tamCelda);
controles.conectarBotones($('#mando'));

$('#btn-jugar').addEventListener('click', empezarPartida);
$('#btn-reintentar').addEventListener('click', empezarPartida);
$('#btn-reanudar').addEventListener('click', alternarPausa);
$('#btn-pausa').addEventListener('click', alternarPausa);

$('#btn-sonido').addEventListener('click', (e) => {
  sonido.despertar();
  const activo = sonido.alternar();
  ajustes.sonido = activo;
  almacen.guardar(ajustes);
  e.currentTarget.setAttribute('aria-pressed', String(activo));
  e.currentTarget.textContent = activo ? '🔊' : '🔇';
});

$('#btn-fantasma').addEventListener('click', (e) => {
  ajustes.fantasma = !ajustes.fantasma;
  almacen.guardar(ajustes);
  e.currentTarget.setAttribute('aria-pressed', String(ajustes.fantasma));
  e.currentTarget.textContent = ajustes.fantasma ? '👁' : '🚫';
});

// Si la pestana se oculta durante la partida, se pausa sola.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && juego.estado === ESTADOS.JUGANDO) alternarPausa();
});

// ── Arranque ────────────────────────────────────────────────────────────────

$('#btn-sonido').textContent = ajustes.sonido ? '🔊' : '🔇';
$('#btn-sonido').setAttribute('aria-pressed', String(ajustes.sonido));
$('#btn-fantasma').textContent = ajustes.fantasma ? '👁' : '🚫';
$('#btn-fantasma').setAttribute('aria-pressed', String(ajustes.fantasma));
$('#record').textContent = ajustes.record.toLocaleString('es');

// Muestrario de joyas en la portada.
(function pintarMuestrario() {
  const cv = $('#muestrario');
  if (!cv) return;
  const c = cv.getContext('2d');
  const d = Math.min(window.devicePixelRatio || 1, 2.5);
  const r = cv.getBoundingClientRect();
  cv.width = r.width * d;
  cv.height = r.height * d;
  c.scale(d, d);
  const tipos = Object.keys(PIEZAS);
  const paso = r.width / tipos.length;
  tipos.forEach((t, i) => {
    dibujarPiezaEnCaja(c, t, i * paso, 0, paso, r.height);
  });
})();

redimensionar();
requestAnimationFrame(bucle);

// Registro del trabajador de servicio: es lo que permite instalar el juego como
// aplicacion y jugarlo sin conexion. Si falla, el juego sigue funcionando igual.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Sin conexion o sin permisos: no es un error que deba interrumpir el juego.
    });
  });
}

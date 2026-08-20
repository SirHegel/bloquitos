/**
 * main.js — Union de todas las piezas: lienzo, bucle de dibujo, interfaz y
 * base de datos.
 */

import { Juego, ESTADOS } from './juego.js';
import { Controles, crearEntradas } from './controles.js';
import { Sonido } from './audio.js';
import { COLUMNAS, FILAS, FILAS_OCULTAS } from './tablero.js';
import { PIEZAS } from './piezas.js';
import {
  dibujarFondo, dibujarRejilla, dibujarTablero, dibujarPiezaActiva,
  dibujarPiezaFantasma, dibujarPiezaEnCaja, Particulas, activarSimbolos,
} from './render.js';
import {
  abrir, migrarDesdeLocalStorage, guardarPartida, mejoresPartidas,
  ultimasPartidas, estadisticas, leerAjuste, guardarAjuste,
  logrosConseguidos, revisarLogros, borrarTodo, enMemoria, LOGROS,
} from './basedatos.js';

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
const ajustes = { sonido: true, fantasma: true, daltonico: false, record: 0 };

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

$('#btn-daltonico').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  ajustes.daltonico = !ajustes.daltonico;
  activarSimbolos(ajustes.daltonico);
  btn.setAttribute('aria-pressed', String(ajustes.daltonico));
  pintarMuestrario();   // el muestrario de la portada tambien lleva simbolos
  await guardarAjuste('daltonico', ajustes.daltonico);
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
  ajustes.daltonico = await leerAjuste('daltonico', false);
  activarSimbolos(ajustes.daltonico);
  const totales = await estadisticas();
  ajustes.record = totales.record;

  sonido.activo = ajustes.sonido;
  $('#btn-sonido').textContent = ajustes.sonido ? '🔊' : '🔇';
  $('#btn-sonido').setAttribute('aria-pressed', String(ajustes.sonido));
  $('#btn-fantasma').textContent = ajustes.fantasma ? '👁' : '🚫';
  $('#btn-fantasma').setAttribute('aria-pressed', String(ajustes.fantasma));
  $('#btn-daltonico').setAttribute('aria-pressed', String(ajustes.daltonico));
  pintarMuestrario();
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

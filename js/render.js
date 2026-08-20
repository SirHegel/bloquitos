/**
 * render.js — Todo el dibujo en el lienzo.
 *
 * La pieza clave es dibujarJoya(): un bloque no es un cuadrado de color plano,
 * sino una joya con seis capas superpuestas (sombra proyectada, cuerpo con
 * degradado diagonal, bisel claro arriba, bisel oscuro abajo, brillo especular y
 * halo de color). Son esas capas las que dan la sensacion de volumen y de
 * material solido en vez de un cuadrito.
 */

import { JOYAS, SIMBOLOS } from './temas.js';
import { celdas, PIEZAS } from './piezas.js';
import { COLUMNAS, FILAS, FILAS_OCULTAS } from './tablero.js';

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
 * Estado del modo daltonico. Lo cambia la interfaz; el renderizador solo lo lee.
 * Es un modulo con estado a proposito: pasarlo por parametro obligaria a
 * atravesarlo por seis funciones de dibujo que no lo necesitan para nada mas.
 */
let modoDaltonico = false;

export function activarSimbolos(activo) {
  modoDaltonico = !!activo;
}

export function simbolosActivos() {
  return modoDaltonico;
}

/**
 * Graba la forma de la pieza sobre la joya.
 *
 * Se dibuja en dos pasadas: primero un trazo oscuro y ancho, luego uno claro y
 * fino encima. Ese doble contorno hace que la forma se lea tanto sobre las
 * joyas claras (oro, cian) como sobre las oscuras (zafiro, amatista), sin
 * tener que ajustar el color a cada una.
 */
function dibujarSimbolo(ctx, forma, cx, cy, radio) {
  if (!forma) return;

  const trazar = () => {
    ctx.beginPath();
    switch (forma) {
      case 'circulo':
        ctx.arc(cx, cy, radio, 0, Math.PI * 2);
        break;
      case 'cuadrado':
        ctx.rect(cx - radio * 0.82, cy - radio * 0.82, radio * 1.64, radio * 1.64);
        break;
      case 'triangulo':
        ctx.moveTo(cx, cy - radio);
        ctx.lineTo(cx + radio * 0.92, cy + radio * 0.72);
        ctx.lineTo(cx - radio * 0.92, cy + radio * 0.72);
        ctx.closePath();
        break;
      case 'rombo':
        ctx.moveTo(cx, cy - radio);
        ctx.lineTo(cx + radio, cy);
        ctx.lineTo(cx, cy + radio);
        ctx.lineTo(cx - radio, cy);
        ctx.closePath();
        break;
      case 'cruz':
        ctx.moveTo(cx - radio * 0.85, cy - radio * 0.85);
        ctx.lineTo(cx + radio * 0.85, cy + radio * 0.85);
        ctx.moveTo(cx + radio * 0.85, cy - radio * 0.85);
        ctx.lineTo(cx - radio * 0.85, cy + radio * 0.85);
        break;
      case 'barra':
        ctx.moveTo(cx - radio, cy);
        ctx.lineTo(cx + radio, cy);
        break;
      case 'estrella': {
        // Estrella de cuatro puntas: se lee bien incluso a 12 px de lado.
        const p = radio, q = radio * 0.34;
        ctx.moveTo(cx, cy - p);
        ctx.lineTo(cx + q, cy - q);
        ctx.lineTo(cx + p, cy);
        ctx.lineTo(cx + q, cy + q);
        ctx.lineTo(cx, cy + p);
        ctx.lineTo(cx - q, cy + q);
        ctx.lineTo(cx - p, cy);
        ctx.lineTo(cx - q, cy - q);
        ctx.closePath();
        break;
      }
    }
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Pasada oscura, ancha: da contraste sobre las joyas claras.
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = Math.max(2.2, radio * 0.62);
  trazar();
  ctx.stroke();

  // Pasada clara, fina: da contraste sobre las joyas oscuras.
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(1.1, radio * 0.30);
  trazar();
  ctx.stroke();

  ctx.restore();
}

/**
 * Dibuja un bloque como joya de caramelo.
 * @param {number} alfa  1 = solido. Menor = pieza fantasma o desvaneciendose.
 * @param {number} brillo 0..1 extra de luz, se usa al completar una linea.
 */
export function dibujarJoya(ctx, px, py, tam, nombreColor, alfa = 1, brillo = 0) {
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

  // Simbolo del modo daltonico, grabado sobre la joya.
  if (modoDaltonico) {
    ctx.globalAlpha = alfa * 0.9;
    dibujarSimbolo(ctx, SIMBOLOS[nombreColor], x + w / 2, y + h / 2, tam * 0.19);
  }

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
export function dibujarFantasma(ctx, px, py, tam, nombreColor) {
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
export function dibujarFondo(ctx, ancho, alto, amb, t) {
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
export function dibujarRejilla(ctx, ox, oy, tam, amb) {
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
export function dibujarPiezaEnCaja(ctx, tipo, x, y, ancho, alto) {
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
export class Particulas {
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
export function dibujarTablero(ctx, tablero, ox, oy, tam, filasBrillando, brillo) {
  for (let y = FILAS_OCULTAS; y < FILAS; y++) {
    for (let x = 0; x < COLUMNAS; x++) {
      const color = tablero.rejilla[y][x];
      if (!color) continue;
      const b = filasBrillando.includes(y) ? brillo : 0;
      dibujarJoya(ctx, ox + x * tam, oy + (y - FILAS_OCULTAS) * tam, tam, color, 1, b);
    }
  }
}

export function dibujarPiezaActiva(ctx, tipo, giro, x, y, ox, oy, tam, alfa = 1) {
  const color = PIEZAS[tipo].color;
  for (const [cx, cy] of celdas(tipo, giro, x, y)) {
    if (cy < FILAS_OCULTAS) continue;   // no dibujar lo que esta en la zona oculta
    dibujarJoya(ctx, ox + cx * tam, oy + (cy - FILAS_OCULTAS) * tam, tam, color, alfa);
  }
}

export function dibujarPiezaFantasma(ctx, tipo, giro, x, y, ox, oy, tam) {
  const color = PIEZAS[tipo].color;
  for (const [cx, cy] of celdas(tipo, giro, x, y)) {
    if (cy < FILAS_OCULTAS) continue;
    dibujarFantasma(ctx, ox + cx * tam, oy + (cy - FILAS_OCULTAS) * tam, tam, color);
  }
}

/**
 * juego.js — El motor: estado, reglas y bucle.
 *
 * El bucle usa paso fijo con acumulador. En lugar de mover la pieza "un poco"
 * segun lo que haya tardado el fotograma, se acumula el tiempo transcurrido y se
 * avanza la simulacion en pasos iguales. Esto hace que el juego se comporte
 * exactamente igual en una pantalla de 60 Hz que en una de 144 Hz, y que no se
 * descontrole si el navegador se queda un momento sin CPU.
 */

import { Tablero, COLUMNAS, FILAS_OCULTAS } from './tablero.js';
import { Bolsa, PIEZAS, celdas, pateos } from './piezas.js';
import { velocidadCaida, nivelDeLineas, ambiente, nombreAmbiente } from './temas.js';

/** Retardo de fijado: al tocar suelo, la pieza espera antes de quedar fija. */
const RETARDO_FIJADO = 500;
const MAX_REINICIOS_FIJADO = 15;

/** Movimiento lateral mantenido: espera inicial y luego repeticion. */
export const DAS = 150;   // ms hasta que arranca la repeticion
export const ARR = 40;    // ms entre repeticiones

export const ESTADOS = {
  PORTADA: 'portada',
  JUGANDO: 'jugando',
  PAUSA: 'pausa',
  LIMPIANDO: 'limpiando',
  FIN: 'fin',
};

export class Juego {
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
    };
  }
}

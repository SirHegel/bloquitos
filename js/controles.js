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

export function crearEntradas() {
  return {
    izquierda: false,
    derecha: false,
    abajo: false,
    lateralIniciado: false,
    tiempoLateral: 0,
  };
}

export class Controles {
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
      //
      // Excepcion: la tecla Ctrl a solas, que abajo gira la pieza al reves. Su
      // propio keydown ya llega con ctrlKey = true, asi que sin este permiso la
      // guardia la descartaba y el `case 'Control'` no se ejecutaba jamas.
      // Combinaciones como Ctrl+R siguen saliendo por aqui: en ellas la tecla
      // es 'r', no 'Control'.
      if ((e.ctrlKey && e.key !== 'Control') || e.altKey || e.metaKey) return;

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

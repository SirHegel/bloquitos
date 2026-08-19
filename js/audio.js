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

export class Sonido {
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

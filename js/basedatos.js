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

export const ALMACENES = {
  PARTIDAS: 'partidas',
  AJUSTES: 'ajustes',
  LOGROS: 'logros',
};

/** Catálogo de logros. Se comprueban al terminar cada partida. */
export const LOGROS = [
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
export function abrir() {
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

export async function guardarPartida(datos) {
  const partida = saneaPartida(datos);
  if (modoMemoria || !bd) {
    memoria.partidas.push({ ...partida, id: memoria.siguienteId++ });
    return partida;
  }
  await transaccion(ALMACENES.PARTIDAS, 'readwrite', (a) => a.add(partida));
  return partida;
}

/** Las mejores n partidas por puntuación, de mayor a menor. */
export async function mejoresPartidas(n = 10) {
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
export async function ultimasPartidas(n = 20) {
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
export async function estadisticas() {
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

export async function leerAjuste(clave, porDefecto) {
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

export async function guardarAjuste(clave, valor) {
  if (modoMemoria || !bd) { memoria.ajustes.set(clave, valor); return; }
  await transaccion(ALMACENES.AJUSTES, 'readwrite', (a) => a.put({ clave, valor }));
}

// ── Logros ──────────────────────────────────────────────────────────────────

export async function logrosConseguidos() {
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
export async function revisarLogros(partida, totales) {
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
export async function migrarDesdeLocalStorage() {
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

/**
 * Exporta todo el progreso a un objeto sencillo, listo para guardar como JSON.
 *
 * Hace falta porque toda la base de datos vive solo en este navegador. Basta
 * con "borrar datos de navegacion", cambiar de equipo o reinstalar el sistema
 * para perder meses de partidas sin ningun aviso. Esto es la unica via de
 * respaldo que existe, y sigue sin necesitar servidor ni cuenta.
 */
export async function exportar() {
  return {
    formato: 'bloquitos',
    version: 1,
    exportado: Date.now(),
    partidas: await ultimasPartidas(100000),
    logros: await logrosConseguidos(),
    ajustes: {
      sonido: await leerAjuste('sonido', true),
      fantasma: await leerAjuste('fantasma', true),
      daltonico: await leerAjuste('daltonico', false),
    },
  };
}

/**
 * Importa un respaldo.
 *
 * El archivo lo elige la persona que juega, asi que es entrada no confiable:
 * puede estar corrupto, ser de otra version o directamente no ser un respaldo.
 * Todo se valida antes de tocar la base de datos, y cada partida pasa por el
 * mismo saneado que las partidas normales.
 *
 * Las partidas se anaden a las existentes en vez de reemplazarlas, y se
 * descartan las que ya estuvieran (misma fecha y misma puntuacion), para que
 * importar dos veces el mismo archivo no duplique el historial.
 *
 * @returns {{ok:boolean, mensaje:string, importadas?:number}}
 */
export async function importar(datos) {
  if (!datos || typeof datos !== 'object') {
    return { ok: false, mensaje: 'El archivo no contiene datos.' };
  }
  if (datos.formato !== 'bloquitos') {
    return { ok: false, mensaje: 'Este archivo no es un respaldo de Bloquitos.' };
  }
  if (entero(datos.version) > 1) {
    return { ok: false, mensaje: 'El respaldo es de una version mas nueva del juego.' };
  }
  if (!Array.isArray(datos.partidas)) {
    return { ok: false, mensaje: 'El respaldo no tiene lista de partidas.' };
  }

  // Se descartan duplicados comparando con lo que ya hay.
  const existentes = new Set(
    (await ultimasPartidas(100000)).map((p) => `${p.fecha}:${p.puntos}`),
  );

  let importadas = 0;
  for (const cruda of datos.partidas) {
    if (!cruda || typeof cruda !== 'object') continue;
    const p = saneaPartida(cruda);
    const clave = `${p.fecha}:${p.puntos}`;
    if (existentes.has(clave)) continue;
    existentes.add(clave);
    await guardarPartida(p);
    importadas++;
  }

  // Los logros se unen: los que ya se tenian no se pierden.
  if (Array.isArray(datos.logros)) {
    const validos = new Set(LOGROS.map((l) => l.id));
    for (const l of datos.logros) {
      if (!l || !validos.has(l.id)) continue;
      const registro = { id: l.id, fecha: entero(l.fecha) || Date.now() };
      if (modoMemoria || !bd) memoria.logros.set(l.id, registro);
      else await transaccion(ALMACENES.LOGROS, 'readwrite', (a) => a.put(registro));
    }
  }

  if (datos.ajustes && typeof datos.ajustes === 'object') {
    for (const clave of ['sonido', 'fantasma', 'daltonico']) {
      if (typeof datos.ajustes[clave] === 'boolean') {
        await guardarAjuste(clave, datos.ajustes[clave]);
      }
    }
  }

  return {
    ok: true,
    importadas,
    mensaje: importadas > 0
      ? `Se anadieron ${importadas} partidas.`
      : 'El respaldo no traia partidas nuevas.',
  };
}

/** Borra todo. Lo usa el botón de reiniciar progreso. */
export async function borrarTodo() {
  memoria.partidas = []; memoria.ajustes.clear(); memoria.logros.clear();
  if (modoMemoria || !bd) return;
  for (const almacen of Object.values(ALMACENES)) {
    await transaccion(almacen, 'readwrite', (a) => a.clear());
  }
}

/** Para que la interfaz pueda avisar de que no se está guardando nada. */
export function enMemoria() {
  return modoMemoria;
}

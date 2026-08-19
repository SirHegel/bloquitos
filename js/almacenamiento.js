/**
 * almacenamiento.js — Guardado local de records y ajustes.
 *
 * Solo se guardan numeros y preferencias, nunca datos de la persona: ni nombre,
 * ni correo, ni identificador. El juego no pide ni almacena informacion personal,
 * y no envia nada a ningun servidor. Todo vive en el navegador de quien juega.
 *
 * Todo va envuelto en try/catch porque localStorage puede fallar legitimamente:
 * modo privado en Safari, cuota llena, o cookies bloqueadas. En esos casos el
 * juego sigue funcionando, simplemente sin recordar el record.
 */

const CLAVE = 'bloquitos.v1';

const POR_DEFECTO = {
  record: 0,
  lineasTotales: 0,
  partidas: 0,
  nivelMaximo: 0,
  sonido: true,
  fantasma: true,
};

export function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return { ...POR_DEFECTO };
    const datos = JSON.parse(crudo);
    // Se valida campo por campo: si el almacenamiento fue manipulado o viene de
    // una version vieja, se usa el valor por defecto en lugar de confiar en el.
    return {
      record: entero(datos.record),
      lineasTotales: entero(datos.lineasTotales),
      partidas: entero(datos.partidas),
      nivelMaximo: entero(datos.nivelMaximo),
      sonido: typeof datos.sonido === 'boolean' ? datos.sonido : true,
      fantasma: typeof datos.fantasma === 'boolean' ? datos.fantasma : true,
    };
  } catch {
    return { ...POR_DEFECTO };
  }
}

function entero(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function guardar(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    return true;
  } catch {
    return false;
  }
}

export function registrarPartida(estado) {
  const datos = leer();
  datos.record = Math.max(datos.record, estado.puntos);
  datos.lineasTotales += estado.lineas;
  datos.nivelMaximo = Math.max(datos.nivelMaximo, estado.nivel);
  datos.partidas += 1;
  guardar(datos);
  return datos;
}

/**
 * Lee un array declarado como datos JSON dentro de un archivo JavaScript.
 *
 * El archivo que contiene la declaración nunca se importa ni se evalúa. Eso
 * permite inspeccionar, por ejemplo, un trabajador de servicio desde Node sin
 * ejecutar el resto de su código ni convertir el contenido leído del disco en
 * código con privilegios del proceso de pruebas.
 */

const IDENTIFICADOR = /^[A-Za-z_$][\w$]*$/u;

/** Escapa un identificador ya validado para incluirlo en una expresión regular. */
function escaparExpresion(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Encuentra el final de un valor JSON compuesto sin confundirse con corchetes
 * dentro de cadenas. JSON.parse hará después la validación completa de sintaxis.
 */
function finalDelValorJson(codigo, inicio) {
  const cierres = { '[': ']', '{': '}' };
  const pila = [];
  let enCadena = false;
  let escapado = false;

  for (let i = inicio; i < codigo.length; i += 1) {
    const caracter = codigo[i];

    if (enCadena) {
      if (escapado) {
        escapado = false;
      } else if (caracter === '\\') {
        escapado = true;
      } else if (caracter === '"') {
        enCadena = false;
      }
      continue;
    }

    if (caracter === '"') {
      enCadena = true;
    } else if (caracter === '[' || caracter === '{') {
      pila.push(cierres[caracter]);
    } else if (caracter === ']' || caracter === '}') {
      if (pila.pop() !== caracter) return -1;
      if (pila.length === 0) return i + 1;
    }
  }

  return -1;
}

/**
 * Devuelve el array de cadenas asignado a una constante del texto recibido.
 * La declaración debe usar sintaxis JSON estricta: comillas dobles, sin
 * comentarios, expresiones, funciones ni comas finales.
 */
export function leerArrayJsonDeclarado(codigo, nombre) {
  if (typeof codigo !== 'string') throw new TypeError('el código debe ser texto');
  if (typeof nombre !== 'string' || !IDENTIFICADOR.test(nombre)) {
    throw new TypeError('el nombre de la constante no es válido');
  }

  const asignacion = new RegExp(
    `\\bconst\\s+${escaparExpresion(nombre)}\\s*=\\s*`,
    'u',
  ).exec(codigo);

  if (!asignacion) throw new SyntaxError(`no se encontró la constante ${nombre}`);

  const inicio = asignacion.index + asignacion[0].length;
  if (codigo[inicio] !== '[') {
    throw new SyntaxError(`${nombre} debe declararse directamente como un array JSON`);
  }

  const fin = finalDelValorJson(codigo, inicio);
  if (fin < 0 || !/^\s*;/u.test(codigo.slice(fin))) {
    throw new SyntaxError(`la declaración de ${nombre} no termina correctamente`);
  }

  let valor;
  try {
    valor = JSON.parse(codigo.slice(inicio, fin));
  } catch (causa) {
    const error = new SyntaxError(`${nombre} debe contener exclusivamente datos JSON válidos`);
    error.cause = causa;
    throw error;
  }

  if (!Array.isArray(valor)) throw new TypeError(`${nombre} debe ser un array`);
  if (!valor.every((elemento) => typeof elemento === 'string')) {
    throw new TypeError(`${nombre} solo debe contener rutas de texto`);
  }

  return valor;
}

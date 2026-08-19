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
export const JOYAS = {
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
export function ambiente(nivel) {
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

export function nombreAmbiente(nivel) {
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
export function velocidadCaida(nivel) {
  const SUELO = 45;
  const INICIO = 900;
  const v = INICIO * Math.pow(0.86, nivel);
  return Math.max(SUELO, v);
}

/** Nivel a partir de las lineas hechas. Cada 10 lineas sube uno, sin techo. */
export function nivelDeLineas(lineas) {
  return Math.floor(lineas / 10);
}

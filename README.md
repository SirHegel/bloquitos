# Bloquitos

Juego de bloques que caen, con niveles infinitos y piezas que parecen joyas de
caramelo. Funciona en el navegador, se instala como aplicación, y una vez abierto
no necesita conexión.

Pensado para que lo juegue un niño sin frustrarse, pero con la mecánica completa
que espera alguien que lleva años jugando a este género.

```
┌──────────┐
│  ▓▓      │   10 × 20 · niveles sin techo
│  ▓▓▒▒    │   giro con pateo de pared · pieza fantasma
│    ▒▒██  │   reserva · cola de 5 · combos · giros en T
└──────────┘
```

## Jugar

Abre `index.html` con cualquier servidor estático. No hay que compilar nada.

```sh
python3 -m http.server 8000
# y abre http://localhost:8000
```

También se puede instalar como aplicación: en Chrome o Edge aparece el icono de
instalar en la barra de direcciones; en Android e iOS, con «Añadir a pantalla de
inicio». Instalado abre en su propia ventana, sin barra de navegador, y arranca
sin conexión.

## Controles

| Acción | Teclado | Táctil |
|---|---|---|
| Mover | `←` `→` o `A` `D` | deslizar de lado, o los botones |
| Girar | `↑` o `X` · `Z` al revés | tocar la pantalla |
| Bajar rápido | `↓` o `S` | deslizar hacia abajo |
| Soltar de golpe | `espacio` | deslizar abajo rápido |
| Guardar pieza | `C` o `Shift` | botón `⇄` |
| Pausa | `P` o `Esc` | botón `⏸` |

## Cómo está hecho

Sin dependencias, sin compilación, sin `node_modules`. Son módulos de JavaScript
que el navegador carga directamente.

| Archivo | Qué hace |
|---|---|
| `js/piezas.js` | Las 7 piezas, sus 4 giros, las tablas de pateo y la bolsa de 7 |
| `js/tablero.js` | La rejilla: colisiones, fijado, líneas completas |
| `js/juego.js` | El motor: gravedad, retardo de fijado, puntuación, niveles |
| `js/render.js` | Todo el dibujo en lienzo: joyas, fondo, partículas |
| `js/temas.js` | Paleta y generación de ambientes por nivel |
| `js/audio.js` | Sonidos sintetizados al vuelo, sin archivos |
| `js/controles.js` | Teclado, gestos y botones |
| `js/almacenamiento.js` | Récord y ajustes en el navegador |

### Las decisiones que importan

**Niveles infinitos de verdad.** El nivel sube cada 10 líneas y no tiene techo.
La velocidad de caída baja de forma exponencial pero **con suelo**: nunca pasa de
45 ms por celda. Sin ese suelo, hacia el nivel 20 el juego se vuelve
matemáticamente imposible, y para un niño eso no es un reto, es un muro. Con
suelo, sube la exigencia y luego se estabiliza en algo rápido pero humano, así
que se puede jugar indefinidamente.

**El fondo no se repite.** Cada nivel gira el tono base 47 grados. Como 47 y 360
no comparten divisores, hacen falta 360 niveles para volver al mismo tono, y
para entonces la luminosidad y el número de auroras ya son otros. Los nombres de
ambiente combinan 11 adjetivos con 7 lugares: 77 combinaciones que caen siempre
sobre un color distinto.

**Las piezas son joyas, no cuadrados.** Cada bloque se dibuja en seis capas:
sombra proyectada, cuerpo con degradado diagonal, bisel claro arriba, bisel
oscuro abajo, brillo especular y halo de color. Es lo que separa un color plano
de algo que parece un objeto sólido.

**Bolsa de 7 en vez de azar puro.** Se baraja el set completo de piezas y se
reparte, así que nunca hay sequías largas de una pieza. Es el estándar del
género desde hace dos décadas.

**Paso fijo con acumulador.** La simulación avanza en pasos iguales en vez de
«un poco según lo que tardó el fotograma». El juego se comporta igual a 60 Hz que
a 144 Hz, y si el navegador se atasca no se descontrola. El salto de tiempo está
limitado a 100 ms para que al volver de una pestaña en segundo plano la pieza no
caiga en picado.

## Seguridad

Es un juego, pero no hay razón para que un juego sea descuidado.

- **Cero dependencias.** No hay `npm`, ni CDN, ni una sola petición externa. No
  existe cadena de suministro que comprometer.
- **Política de contenido estricta.** `default-src 'self'` en todo: el juego solo
  puede cargar archivos suyos, no puede abrir conexiones de red y no puede ser
  incrustado en otra página.
- **Sin `eval`, sin `innerHTML`.** Todo el texto que se muestra pasa por
  `textContent`, así que nunca se interpreta como HTML.
- **Sin datos personales.** Solo se guardan números (récord, líneas, partidas) en
  el navegador de quien juega. No hay cuentas, ni analítica, ni telemetría, ni
  nada que salga del dispositivo.
- **El trabajador de servicio solo toca lo propio.** Únicamente cachea peticiones
  `GET` del mismo origen; cualquier otra cosa la deja pasar sin tocarla.
- **Lo que se guarda se valida al leerlo,** campo por campo, por si el
  almacenamiento fue manipulado.

## Pruebas

```sh
node --test pruebas/motor.test.mjs
```

32 pruebas sobre la lógica pura: definición de piezas, tablas de pateo,
distribución de la bolsa, colisiones, borrado de filas, curva de velocidad,
puntuación, combos, condiciones de fin de partida, y una simulación de partidas
completas que comprueba que el tablero nunca se corrompe.

## Al modificar el juego

Si cambias cualquier archivo, **sube la versión de la caché** en `sw.js`:

```js
const VERSION = 'bloquitos-v2';   // v1 → v2
```

Si no, los navegadores que ya lo tengan instalado seguirán sirviendo la versión
vieja desde la caché y no verán los cambios.

## Licencia

MIT. Ver [LICENSE](LICENSE).

Las mecánicas de los juegos de bloques que caen no son propiedad de nadie, pero
la marca *Tetris* sí lo es, y pertenece a The Tetris Company. Este proyecto no
usa ese nombre, ni su logo, ni su identidad visual, y no está asociado a ellos.

# Bloquitos

Juego de bloques que caen, con niveles infinitos y piezas que parecen joyas de
caramelo. Guarda tu historial de partidas, tus récords y tus logros en una base
de datos local, funciona sin conexión, y se puede jugar de tres formas: abriendo
un archivo, en la web, o como aplicación instalada.

Pensado para que lo juegue un niño sin frustrarse, pero con la mecánica completa
que espera alguien que lleva años jugando a este género.

**▶ Jugar ahora: [sirhegel.github.io/bloquitos](https://sirhegel.github.io/bloquitos/)**

## Tres formas de jugarlo

**1. Doble clic.** Abre `index.html` y ya está. No hace falta servidor, ni
instalar nada, ni conexión.

**2. En la web.** Desde el enlace de arriba. Ahí además se puede instalar como
aplicación: en Chrome o Edge aparece el icono de instalar en la barra de
direcciones; en Android e iOS, con «Añadir a pantalla de inicio».

**3. Como programa de escritorio.** Hay instaladores para Windows, Linux y macOS
en la [sección Releases](https://github.com/SirHegel/bloquitos/releases).

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

Sin dependencias para jugar: ni `npm`, ni CDN, ni una sola petición externa. Son
módulos de JavaScript y un lienzo. Electron solo aparece si quieres generar los
ejecutables de escritorio.

| Archivo | Qué hace |
|---|---|
| `js/piezas.js` | Las 7 piezas, sus 4 giros, las tablas de pateo y la bolsa de 7 |
| `js/tablero.js` | La rejilla: colisiones, fijado, líneas completas |
| `js/juego.js` | El motor: gravedad, retardo de fijado, puntuación, niveles |
| `js/render.js` | Todo el dibujo en lienzo: joyas, fondo, partículas |
| `js/temas.js` | Paleta y generación de ambientes por nivel |
| `js/audio.js` | Sonidos sintetizados al vuelo, sin archivos |
| `js/controles.js` | Teclado, gestos y botones |
| `js/basedatos.js` | Base de datos local: partidas, récords, logros, ajustes |
| `js/main.js` | Une todo: bucle de dibujo e interfaz |
| `js/bloquitos.js` | **Generado.** Todos los módulos en un solo archivo |
| `escritorio/principal.js` | Ventana de la aplicación de escritorio |
| `herramientas/construir.mjs` | Genera `js/bloquitos.js` |

### Por qué existe `js/bloquitos.js`

Es la respuesta a un problema concreto: **al abrir `index.html` con doble clic,
el juego no funcionaba**.

El código está en módulos ES (`import` / `export`), que es lo correcto para
mantenerlo ordenado. Pero los navegadores aplican CORS a los módulos, y el
protocolo `file://` no tiene un origen válido. El resultado era que el navegador
bloqueaba todos los módulos: la página se veía, pero no se ejecutaba ni una línea
de JavaScript y ningún botón respondía.

Los scripts clásicos no pasan por CORS. Así que `herramientas/construir.mjs` une
todos los módulos en un único script clásico, y eso es lo que carga la página.
El código fuente sigue estando modular; solo el archivo servido está unido.

**Por eso `js/bloquitos.js` está en el repositorio aunque sea generado:** sin él,
descargar el proyecto y abrir `index.html` no funcionaría. Si cambias cualquier
módulo, regenéralo:

```sh
node herramientas/construir.mjs
```

La CI comprueba en cada envío que el paquete coincide con los módulos fuente, así
que si se te olvida, la comprobación falla y te avisa.

### Las decisiones que importan

**Niveles infinitos de verdad.** El nivel sube cada 10 líneas y no tiene techo.
La velocidad de caída baja de forma exponencial pero **con suelo**: nunca pasa de
45 ms por celda. Sin ese suelo, hacia el nivel 20 el juego se vuelve
matemáticamente imposible, y para un niño eso no es un reto, es un muro. Con
suelo, sube la exigencia y luego se estabiliza en algo rápido pero humano, así
que se puede jugar indefinidamente.

**El fondo no se repite.** Cada nivel gira el tono base 47 grados. Como 47 y 360
no comparten divisores, hacen falta 360 niveles para volver al mismo tono, y
para entonces la luminosidad y el número de auroras ya son otros.

**Las piezas son joyas, no cuadrados.** Cada bloque se dibuja en seis capas:
sombra proyectada, cuerpo con degradado diagonal, bisel claro arriba, bisel
oscuro abajo, brillo especular y halo de color.

**Bolsa de 7 en vez de azar puro.** Se baraja el set completo de piezas y se
reparte, así que nunca hay sequías largas de una pieza.

**Paso fijo con acumulador.** La simulación avanza en pasos iguales, así que el
juego se comporta igual a 60 Hz que a 144 Hz. El salto de tiempo está limitado a
100 ms para que al volver de una pestaña en segundo plano la pieza no caiga en
picado.

## La base de datos

Todo el progreso se guarda en **IndexedDB**, la base de datos del propio
navegador. Se eligió frente a `localStorage` porque hay que guardar cientos de
partidas y consultarlas ordenadas por puntuación y por fecha;  `localStorage`
solo guarda texto plano y obliga a leerlo entero para cualquier consulta.

| Almacén | Contenido | Índices |
|---|---|---|
| `partidas` | Cada partida: puntos, líneas, nivel, piezas, duración, mejor combo, giros en T | por puntos, por fecha, por nivel |
| `ajustes` | Sonido, sombra de caída, control de migración | clave |
| `logros` | Los 12 logros conseguidos y cuándo | id |

De ahí salen las tres pantallas del juego: **Récords** (las 10 mejores
partidas), **Datos** (estadísticas acumuladas y gráfico de las últimas partidas)
y **Logros**.

**Nada sale del dispositivo.** No hay servidor, no hay cuenta, no hay
sincronización. Es una base de datos precisamente porque es la opción que no
expone nada.

Tres detalles de robustez que importan:

- **Si IndexedDB no está disponible** (modo privado, permisos denegados, un
  navegador antiguo), todo cae automáticamente a un almacén en memoria y el juego
  avisa en la portada de que el progreso no se guardará. Nunca deja de funcionar
  por un fallo de base de datos.
- **Todo lo que se lee se valida campo por campo.** Los datos vienen del disco
  del usuario, que puede haber sido manipulado o venir de una versión anterior.
  Un valor negativo, un `NaN` o un `Infinity` se convierten en algo seguro en vez
  de propagarse.
- **Migración automática** desde la versión anterior, que guardaba el récord en
  `localStorage`. No se pierde el progreso de quien ya jugaba.

## Seguridad

Es un juego, pero no hay razón para que un juego sea descuidado.

- **Cero dependencias en tiempo de ejecución.** No hay CDN ni peticiones
  externas. No existe cadena de suministro que comprometer.
- **Política de contenido estricta.** Todo apunta a `'self'`: el juego solo puede
  cargar archivos suyos y no puede abrir conexiones de red.
- **Sin `eval`, sin `innerHTML`.** Todo el texto que se muestra pasa por
  `textContent`, así que nunca se interpreta como HTML.
- **Sin datos personales.** Solo números. No hay cuentas, ni analítica, ni
  telemetría.
- **El trabajador de servicio solo toca lo propio:** únicamente cachea peticiones
  `GET` del mismo origen.
- **La aplicación de escritorio corre sin acceso a Node:** `nodeIntegration`
  desactivado, `contextIsolation` y `sandbox` activados, navegación externa
  bloqueada y todos los permisos del sistema denegados. Un fallo en la parte web
  no puede convertirse en ejecución de código en el equipo.
- **La CI rechaza el envío** si detecta credenciales o rutas locales en el código.

## Desarrollo

```sh
node --test                        # 52 pruebas
node herramientas/construir.mjs    # regenerar el paquete
python3 -m http.server 8000        # servir en local
```

Las pruebas cubren la lógica pura: definición de piezas, tablas de pateo,
distribución de la bolsa, colisiones, borrado de filas, curva de velocidad,
puntuación, combos, condiciones de fin de partida, simulación de partidas
completas, y toda la base de datos (guardado, orden, agregados, validación de
datos corruptos, logros y borrado).

## Generar los ejecutables

No hace falta instalar nada en tu equipo: **GitHub los compila en sus
servidores**. En la pestaña Actions del repositorio, elige «Ejecutables de
escritorio» y pulsa *Run workflow*. Al terminar, los instaladores quedan
descargables como artefactos.

Para publicar una versión en Releases:

```sh
git tag v1.1.0 && git push origin v1.1.0
```

Si prefieres compilarlos en tu máquina, hace falta Node y unos 300 MB de
descarga de Electron:

```sh
npm install
npm run escritorio          # abrir la aplicación sin empaquetar
npm run empaquetar          # generar los instaladores en distribucion/
```

Los ejecutables no van firmados digitalmente: la firma cuesta dinero y no aporta
nada a un juego local que no toca la red. La primera vez, Windows o macOS pueden
pedir confirmación para abrirlos.

## Al modificar el juego

1. Regenera el paquete: `node herramientas/construir.mjs`
2. **Sube la versión de la caché** en `sw.js` (`bloquitos-v2` → `v3`). Si no, los
   navegadores que ya lo tengan instalado seguirán sirviendo la versión vieja.
3. Si cambias la forma de los datos guardados, sube `VERSION_BD` en
   `js/basedatos.js` y añade la migración en `onupgradeneeded`.

## Licencia

MIT. Ver [LICENSE](LICENSE).

Las mecánicas de los juegos de bloques que caen no son propiedad de nadie, pero
la marca *Tetris* sí lo es, y pertenece a The Tetris Company. Este proyecto no
usa ese nombre, ni su logo, ni su identidad visual, y no está asociado a ellos.

# Bloquitos

Juego de bloques que caen, con niveles infinitos y piezas que parecen joyas de
caramelo. Guarda tu historial de partidas, tus récords y tus logros en una base
de datos local, funciona sin conexión, y se puede jugar de tres formas: abriendo
un archivo, en la web, o como aplicación instalada.

Pensado para que lo juegue un niño sin frustrarse, pero con la mecánica completa
que espera alguien que lleva años jugando a este género.

**▶ Jugar ahora: [sirhegel.github.io/bloquitos](https://sirhegel.github.io/bloquitos/)**

La misma versión se publica además en Vercel, que añade las cabeceras de
seguridad reales y una dirección de vista previa por cada rama. Cómo publicarlo
está en **[DESPLIEGUE.md](DESPLIEGUE.md)**.

## Cómo se instala

Depende de cómo quieras jugarlo. Ninguna de las tres opciones necesita instalar
dependencias: el juego no tiene ni una.

**1. En la web — no se instala nada.** Abre el enlace de arriba y ya está.

Si lo quieres como aplicación con su propia ventana e icono, ahí mismo se puede
instalar: en Chrome o Edge aparece el icono de instalar en la barra de
direcciones; en Android e iOS, con «Añadir a pantalla de inicio». Se guarda
entero en el dispositivo, así que después funciona sin conexión.

**2. Doble clic — descargar y abrir.** Descarga el repositorio (botón *Code* →
*Download ZIP*, o `git clone`), descomprime y abre `index.html`. No hace falta
servidor, ni Node, ni conexión. Funciona porque `js/bloquitos.js` viene ya
generado dentro del repositorio; más abajo se explica por qué.

**3. Como programa de escritorio — instalador.** Descarga el de tu sistema
(Windows, Linux o macOS) de la [sección
Releases](https://github.com/SirHegel/bloquitos/releases) y ábrelo. No están
firmados digitalmente, así que la primera vez el sistema puede pedir
confirmación; es lo normal en aplicaciones sin certificado de firma.

## Cómo se juega

Caen piezas, completas filas y suben los puntos. El nivel sube cada 10 líneas y
no tiene techo. `C` guarda una pieza para después, y solo se puede usar una vez
por pieza.

| Acción | Teclado | Táctil |
|---|---|---|
| Mover | `←` `→` o `A` `D` | deslizar de lado, o los botones |
| Girar | `↑` o `X` · `Z` o `Ctrl` al revés | tocar la pantalla |
| Bajar rápido | `↓` o `S` | deslizar hacia abajo |
| Soltar de golpe | `espacio` | deslizar abajo rápido |
| Guardar pieza | `C` o `Shift` | botón `⇄` |
| Pausa | `P` o `Esc` | botón `⏸` |
| Empezar partida | `R` o `Intro` (desde la portada o el final) | botones *Jugar* y *Otra vez* |

Desde la portada y desde la pausa se llega a **Récords**, **Datos** y
**Logros**, y desde ahí se puede exportar el progreso a un archivo o volver a
importarlo. Los tres botones de la derecha alternan sonido, sombra de caída y
**modo daltónico**, que añade una forma distinta a cada tipo de pieza para no
depender del color.

## Cómo está hecho

Sin dependencias para jugar: ni `npm`, ni CDN, ni una sola petición externa. Son
módulos de JavaScript y un lienzo. Electron solo aparece si quieres generar los
ejecutables de escritorio.

| Archivo | Qué hace |
|---|---|
| `index.html` | La página: maquetación, metadatos y tarjeta social |
| `css/estilos.css` | Todo el estilo |
| `js/piezas.js` | Las 7 piezas, sus 4 giros, las tablas de pateo y la bolsa de 7 |
| `js/tablero.js` | La rejilla: colisiones, fijado, líneas completas |
| `js/juego.js` | El motor: gravedad, retardo de fijado, puntuación, niveles |
| `js/render.js` | Todo el dibujo en lienzo: joyas, fondo, partículas |
| `js/temas.js` | Paleta y generación de ambientes por nivel |
| `js/audio.js` | Sonidos sintetizados al vuelo, sin archivos |
| `js/controles.js` | Teclado, gestos y botones |
| `js/basedatos.js` | Base de datos local: partidas, récords, logros, ajustes |
| `js/main.js` | Une todo: bucle de dibujo, interfaz y registro del trabajador |
| `js/bloquitos.js` | **Generado.** Todos los módulos en un solo archivo |
| `sw.js` | Trabajador de servicio: copia local para jugar sin conexión |
| `manifest.webmanifest` | Manifiesto de la aplicación instalable |
| `iconos/` | Iconos de la aplicación y la tarjeta `og-bloquitos.png` para redes |
| `escritorio/principal.js` | Ventana de la aplicación de escritorio |
| `herramientas/construir.mjs` | Genera `js/bloquitos.js` |
| `herramientas/verificar-paquete.mjs` | Comprueba que lo que se va a desplegar sirve |
| `herramientas/revisar-secretos.sh` | Busca credenciales y rutas locales antes de publicar |
| `herramientas/notas-vercel.md` | Por qué cada valor del despliegue es el que es |
| `pruebas/` | Las pruebas: motor, base de datos y contrato de despliegue |
| `.github/workflows/` | Integración continua: pruebas y ejecutables de escritorio |
| `.github/dependabot.yml` | Avisos de versiones nuevas de Electron y de las acciones |
| `vercel.json` | Construcción y cabeceras del sitio publicado |
| `.vercelignore` | Qué no se sube al desplegar |
| `DESPLIEGUE.md` | Qué pulsar para publicarlo y qué revisar después |

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
npm run construir
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

**Todas las rutas son relativas.** En `index.html`, en `manifest.webmanifest` y
en `sw.js` no hay ni una ruta que empiece por `/`. Es lo que permite que la misma
copia funcione en la raíz de un dominio, en la subcarpeta `/bloquitos/` de GitHub
Pages y en el disco duro con doble clic, sin cambiar nada.

## La base de datos

Todo el progreso se guarda en **IndexedDB**, la base de datos del propio
navegador. Se eligió frente a `localStorage` porque hay que guardar cientos de
partidas y consultarlas ordenadas por puntuación y por fecha;  `localStorage`
solo guarda texto plano y obliga a leerlo entero para cualquier consulta.

| Almacén | Contenido | Índices |
|---|---|---|
| `partidas` | Cada partida: puntos, líneas, nivel, piezas, duración, mejor combo, giros en T | por puntos, por fecha, por nivel |
| `ajustes` | Sonido, sombra de caída, modo daltónico, control de migración | clave |
| `logros` | Los 12 logros conseguidos y cuándo | id |

De ahí salen las tres pantallas del juego: **Récords** (las 10 mejores
partidas), **Datos** (estadísticas acumuladas y gráfico de las últimas partidas)
y **Logros**.

**Nada sale del dispositivo.** No hay servidor, no hay cuenta, no hay
sincronización. Es una base de datos precisamente porque es la opción que no
expone nada. Para pasar el progreso de un dispositivo a otro están los botones
de exportar e importar, que escriben y leen un archivo tuyo.

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
  cargar archivos suyos y no puede abrir conexiones de red. Va por partida doble:
  una etiqueta `<meta>` en `index.html`, que también cubre el doble clic, y la
  cabecera de verdad que envía `vercel.json`, que además cierra `frame-ancestors`
  —directiva que el navegador ignora cuando llega por `<meta>`—.
- **Sin `eval`, sin `innerHTML`.** Todo el texto que se muestra pasa por
  `textContent`, así que nunca se interpreta como HTML.
- **Sin datos personales.** Solo números. No hay cuentas, ni analítica, ni
  telemetría.
- **El trabajador de servicio solo toca lo propio:** únicamente cachea peticiones
  `GET` del mismo origen, y al activarse borra solo las cachés con su prefijo,
  para no dejar sin copia local a otro proyecto que comparta dominio.
- **La aplicación de escritorio corre sin acceso a Node:** `nodeIntegration`
  desactivado, `contextIsolation` y `sandbox` activados, navegación externa
  bloqueada y todos los permisos del sistema denegados. Un fallo en la parte web
  no puede convertirse en ejecución de código en el equipo.
- **La CI rechaza el envío** si detecta credenciales o rutas locales en el código.

## Desarrollo

Hace falta Node solo para las herramientas; el juego en sí no lo usa. No hay
`npm install` que hacer salvo que vayas a empaquetar el escritorio.

| Comando | Qué hace |
|---|---|
| `npm run probar` | Las 66 pruebas (`node --test`) |
| `npm run construir` | Regenera `js/bloquitos.js` desde los módulos |
| `npm run verificar` | Comprueba que lo que se va a desplegar sirve |
| `npm run servir` | Construye y sirve en `http://localhost:8000` |
| `npm run escritorio` | Abre la aplicación de Electron sin empaquetar |

Servir en local, y no abrir el archivo, es la única forma de probar el trabajador
de servicio y la instalación como aplicación: ambos necesitan `http://`.

Las pruebas cubren la lógica pura —definición de piezas, tablas de pateo,
distribución de la bolsa, colisiones, borrado de filas, curva de velocidad,
puntuación, combos, condiciones de fin de partida y simulación de partidas
completas—, toda la base de datos (guardado, orden, agregados, validación de
datos corruptos, logros y borrado) y el contrato de despliegue: que `vercel.json`
declare lo que tiene que declarar, que las rutas de `index.html` sigan siendo
relativas y que todo lo que `sw.js` manda cachear exista de verdad.

## Publicar en la web

Todo está decidido en `vercel.json` y `.vercelignore`, así que no hay nada que
configurar a mano: Vercel lee esos archivos en cada despliegue y lo que digan
manda sobre el panel. Los pasos —desde la web o desde la terminal—, las cinco
comprobaciones posteriores y los problemas frecuentes están en
**[DESPLIEGUE.md](DESPLIEGUE.md)**; el porqué de cada valor, en
[`herramientas/notas-vercel.md`](herramientas/notas-vercel.md).

Antes de publicar:

```sh
npm run construir && npm run verificar && npm run probar
```

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

1. Regenera el paquete y compruébalo: `npm run construir && npm run verificar`
2. **Sube la versión de la caché** en `sw.js` (`bloquitos-v3` → `v4`). Si no, los
   navegadores que ya lo tengan instalado seguirán sirviendo la versión vieja.
3. Si cambias la forma de los datos guardados, sube `VERSION_BD` en
   `js/basedatos.js` y añade la migración en `onupgradeneeded`.
4. Si añades, quitas o renombras un archivo que deba estar disponible sin
   conexión, actualiza el array `ARCHIVOS` de `sw.js`. `npm run verificar` falla
   si esa lista apunta a algo que no existe, pero no puede adivinar lo que falta.

## Licencia

MIT. Ver [LICENSE](LICENSE).

Las mecánicas de los juegos de bloques que caen no son propiedad de nadie, pero
la marca *Tetris* sí lo es, y pertenece a The Tetris Company. Este proyecto no
usa ese nombre, ni su logo, ni su identidad visual, y no está asociado a ellos.

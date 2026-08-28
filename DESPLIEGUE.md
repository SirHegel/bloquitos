# Publicar Bloquitos en Vercel

Bloquitos es un sitio estático: HTML, CSS, imágenes y un archivo de JavaScript.
No hay servidor, ni base de datos remota, ni variables de entorno, ni nada que
configurar en Vercel más allá de decirle dónde está el proyecto.

De hecho no hace falta configurarlo: **`vercel.json` ya lleva todas las
decisiones tomadas** —cómo se construye, qué carpeta se publica y qué cabeceras
se envían—. Vercel lee ese archivo en cada despliegue y lo que diga ahí manda
sobre lo que haya escrito en el panel. Esta guía es para saber qué pulsar y qué
comprobar después.

Hay dos caminos y llevan al mismo sitio: el panel web (Opción A) o la terminal
(Opción B). Si el juego lo va a mantener alguien más, elige la A: cada envío a
`main` publica solo, sin que nadie tenga que acordarse de nada.

---

## 1. Qué hace falta antes de empezar

**El proyecto en GitHub.** Vercel despliega desde un repositorio. Este ya está
en [github.com/SirHegel/bloquitos](https://github.com/SirHegel/bloquitos), así
que no hay nada que hacer. Si trabajas sobre una copia tuya, súbela primero.

**Una cuenta en Vercel.** En [vercel.com](https://vercel.com) se entra con la
cuenta de GitHub. El plan gratuito (*Hobby*) sobra: este proyecto son unos
cientos de kilobytes de archivos estáticos.

**Node instalado**, solo si vas por la Opción B. Cualquier versión moderna vale.
Para la Opción A no hace falta nada instalado: todo ocurre en los servidores de
Vercel.

**Nada de claves ni secretos.** El juego no habla con ningún servidor, así que
no hay variables de entorno que rellenar. Si algún día un formulario de Vercel
te las pide, la respuesta correcta es dejarlo vacío.

Antes de publicar, conviene dejar el paquete al día en local:

```sh
npm run construir     # regenera js/bloquitos.js desde los módulos
npm run verificar     # comprueba que lo que se va a desplegar sirve
npm run probar        # todas las pruebas automatizadas
```

Vercel vuelve a construir el paquete por su cuenta durante el despliegue, así
que un olvido aquí no rompe la web. Pero sí rompe el doble clic sobre
`index.html` para quien se descargue el repositorio, y `npm run verificar` te lo
dice en dos segundos.

---

## 2. Opción A — importar el repositorio desde el panel de vercel.com

Es el camino recomendado. Se configura una vez y a partir de ahí cada envío a
`main` se publica solo; cada rama y cada *pull request* recibe además su propia
dirección de vista previa.

1. Entra en [vercel.com/new](https://vercel.com/new).
2. En **Import Git Repository**, busca `bloquitos` y pulsa **Import**. La primera
   vez Vercel pedirá permiso para leer tu cuenta de GitHub; puedes darle acceso
   solo a este repositorio.
3. En la pantalla de configuración, deja estos valores:

   | Campo | Valor |
   |---|---|
   | Framework Preset | `Other` |
   | Root Directory | `./` (la raíz, sin tocar) |
   | Build Command | `npm run vercel-build` |
   | Output Directory | `.` |
   | Install Command | `npm install --omit=dev --ignore-scripts --no-audit --no-fund` |

4. **Environment Variables**: no añadas ninguna.
5. Pulsa **Deploy** y espera. Tarda menos de un minuto: no se instala ninguna
   dependencia, solo se ejecuta el script que une los módulos.

Al terminar tendrás una dirección tipo `https://bloquitos.vercel.app`.

### Por qué esos valores y por qué da igual equivocarse

**`vercel.json` ya fija los cuatro**, y el archivo tiene prioridad sobre el panel:

```json
"buildCommand": "node herramientas/construir.mjs",
"installCommand": "npm install --omit=dev --ignore-scripts --no-audit --no-fund",
"outputDirectory": ".",
"framework": null
```

Es la misma orden que `npm run vercel-build`, solo que escrita sin pasar por
npm. Rellenar el formulario con lo de la tabla es útil porque así el panel te
enseña lo que de verdad va a ocurrir, pero si te equivocas al teclearlo, el
archivo corrige.

El `installCommand` no es un adorno. Vercel ve un `package.json` y, si nadie le
dice lo contrario, ejecuta `npm install` a secas: eso se baja `electron` y
`electron-builder`, que son las dependencias de los ejecutables de escritorio y
pesan cientos de megas, con un guion de instalación que además descarga el
binario de Electron. Nada de eso pinta en una web estática. `--omit=dev` deja
fuera las dos (el juego no tiene ninguna dependencia de producción) y
`--ignore-scripts` corta esa descarga. La construcción usa solo módulos de Node,
así que no le falta nada.

Que sea `Other` y no un preset importa: los presets de Vercel (Next.js, Vite,
Astro…) esperan una carpeta de salida generada, tipo `dist/` o `.next/`. Aquí no
existe. El sitio **es** la raíz del repositorio, con `index.html` ya en su sitio;
lo único que se genera durante la construcción es `js/bloquitos.js`, que se
escribe encima del que ya hay. De ahí el `.` como directorio de salida.

Lo que no sube lo decide `.vercelignore`: fuera la aplicación de escritorio, las
pruebas, `node_modules/` y la documentación. De `herramientas/` sube un solo
archivo, `construir.mjs`, que es lo único que ejecuta la construcción.

---

## 3. Opción B — desde la terminal

Sirve para publicar sin conectar el repositorio, o para probar un cambio en una
dirección real antes de enviarlo a GitHub. No hace falta instalar nada de forma
permanente: `npx` descarga la herramienta al vuelo.

Desde la raíz del proyecto:

```sh
npx vercel            # publica una vista previa, con dirección propia
npx vercel --prod     # publica en la dirección definitiva
```

**La primera vez pregunta unas cuantas cosas.** Todas tienen una respuesta
razonable por defecto, así que en la práctica es pulsar Intro varias veces:

- **Log in** — abre el navegador para que entres con tu cuenta de GitHub. Solo
  ocurre una vez por equipo.
- **Set up and deploy "~/…/bloquitos"?** → `Y`.
- **Which scope should contain your project?** → tu cuenta personal, salvo que
  pertenezcas a un equipo y quieras publicarlo ahí. El *scope* es de quién es el
  proyecto: quién lo ve en su panel y a quién se le contabiliza el uso.
- **Link to existing project?** → `N` la primera vez. Si ya lo importaste desde
  el panel (Opción A), responde `Y` y elige `bloquitos`, para no acabar con dos
  proyectos publicando lo mismo.
- **What's your project name?** → `bloquitos`. De aquí sale la dirección, así que
  un nombre feo es una dirección fea. Si ya está cogido por otra persona, Vercel
  le añade un sufijo.
- **In which directory is your code located?** → `./`.

A partir de ahí no vuelve a preguntar: guarda las respuestas en una carpeta
`.vercel/` en la raíz. Esa carpeta es local y no debe subirse al repositorio: ya
está en `.gitignore`, así que no hay nada que hacer.

Detalle importante: `npx vercel` a secas publica una **vista previa**, con una
dirección larga y única que nadie más va a encontrar. La dirección buena solo se
actualiza con `--prod`. Es a propósito, y es la forma cómoda de mirar un cambio
en un servidor de verdad antes de darlo por bueno.

---

## 4. Qué revisar después del despliegue

Cinco minutos de comprobaciones que evitan publicar un juego roto. Ábrelo en el
navegador y ve por orden.

### El juego carga y se juega

Abre la dirección. Debe verse la portada, y al empezar una partida las piezas
tienen que caer y responder a las flechas. Si se ve la página pero ningún botón
hace nada, ve directo al primer problema del apartado 5.

### `js/bloquitos.js` se sirve

Es el archivo del que depende todo lo demás. Abre en el navegador:

```
https://tu-proyecto.vercel.app/js/bloquitos.js
```

Tienes que ver código JavaScript. Si ves la página del juego, o un error 404, el
archivo no llegó al despliegue. Desde la terminal, la versión rápida:

```sh
curl -I https://tu-proyecto.vercel.app/js/bloquitos.js
```

Busca `HTTP/2 200` y `content-type: ...javascript`.

### El trabajador de servicio se registra

Es lo que hace que el juego funcione sin conexión. En Chrome o Edge, `F12` →
pestaña **Application** → **Service Workers**. Debe aparecer `sw.js` con el
estado **activated and is running**.

En la misma pestaña, **Cache Storage** debe mostrar un almacén llamado
`bloquitos-v4` con doce entradas dentro: la página por partida doble (`/` y
`/index.html`, porque a las dos direcciones se puede llegar), el manifiesto de
la aplicación, `archivos-cache.json`, el CSS, el paquete de JavaScript, los cinco
iconos y la tarjeta social.

La prueba de fuego: con la pestaña abierta, marca **Offline** en la sección
Network y recarga. El juego tiene que seguir funcionando.

Ten en cuenta que el registro **solo ocurre sobre `http://` o `https://`**
(`js/main.js` lo comprueba antes de intentarlo). Abriendo `index.html` con doble
clic no verás nada aquí, y es lo correcto.

### La PWA se puede instalar

En Chrome o Edge, con el juego abierto, aparece un icono de instalar en la barra
de direcciones. En Android e iOS, «Añadir a pantalla de inicio». Al instalarlo
debe abrirse en su propia ventana, sin barra del navegador, con el icono de
Bloquitos y el fondo azul oscuro.

Si el icono de instalar no aparece, mira en **Application** → **Manifest**:
Chrome lista ahí los motivos por los que considera que el sitio aún no es
instalable.

### Las cabeceras llegan

Las de `vercel.json`, que en local no se ven porque `python3 -m http.server` no
las envía:

```sh
curl -I https://tu-proyecto.vercel.app/
```

Deben aparecer `content-security-policy`, `x-content-type-options: nosniff` y
`referrer-policy: no-referrer`. Y en `/sw.js`, un `cache-control` con
`max-age=0, must-revalidate`: es lo que permite que una versión nueva del juego
llegue a quien ya lo tenía instalado.

---

## 5. Problemas frecuentes y de qué vienen

### Pantalla en blanco, o el juego se ve pero no responde

**Causa: el paquete no se generó.** `index.html` carga un único archivo,
`js/bloquitos.js`, y ese archivo lo produce `herramientas/construir.mjs` durante
la construcción. Si el script falló, el navegador se encuentra con un 404 o con
un archivo a medias: la maquetación se pinta, pero no se ejecuta ni una línea de
JavaScript y ningún botón responde.

Qué mirar, en este orden:

1. La consola del navegador (`F12`). Un `404` o un `Failed to load resource`
   sobre `js/bloquitos.js` confirma el diagnóstico.
2. El registro de construcción en Vercel: panel del proyecto → el despliegue →
   **Building**. `construir.mjs` escribe por `stderr` exactamente qué le faltó
   —un módulo del array `ORDEN`, un `import` suelto— y termina con código 1, lo
   que cancela el despliegue.
3. Reprodúcelo en local con `npm run construir && npm run verificar`. Falla igual
   y sin esperar a la nube.

La escritura del paquete es atómica: o queda entero, o queda el anterior. Nunca
queda a medias.

### El juego sigue mostrando la versión vieja

**Causa: el trabajador de servicio está sirviendo su caché.** Es justo su
trabajo —por eso funciona sin conexión—, pero significa que quien ya abrió el
juego una vez seguirá viendo lo que guardó, aunque hayas publicado algo nuevo.

Para verlo tú ahora mismo: recarga forzando (`Ctrl` + `Shift` + `R`, o `Cmd` +
`Shift` + `R` en Mac). Si aún así insiste, `F12` → **Application** →
**Service Workers** → **Unregister**, y en **Cache Storage** borra
`bloquitos-v4`. Recarga y se instalará limpio.

Para que le llegue a todo el mundo, no basta con desplegar: hay que **subir la
versión de la caché** en `sw.js`.

```js
const VERSION = 'bloquitos-v4';   // -> 'bloquitos-v5'
```

Cambiar ese número es lo que hace que el navegador considere el trabajador de
servicio un archivo distinto, se lo descargue, cachee todo de nuevo y tire lo
viejo. Sin ese cambio, un jugador que instaló el juego el mes pasado puede seguir
con la versión del mes pasado indefinidamente. La cabecera `must-revalidate` de
`vercel.json` garantiza que el navegador *pregunte* por `sw.js` en cada visita;
el número de versión es lo que hace que la respuesta importe.

### Rutas rotas al servirlo desde una subcarpeta

**Causa: el sitio está pensado para vivir en la raíz de un dominio.**

Dentro de `index.html`, `manifest.webmanifest` y `sw.js` todas las rutas son
relativas (`./js/bloquitos.js`, `./iconos/icono.svg`), y eso es precisamente lo
que hace que el juego funcione con doble clic, en GitHub Pages —que sirve bajo
`/bloquitos/`— y en Vercel sin cambiar nada.

Lo que **no** viaja a una subcarpeta son las cabeceras. En `vercel.json` están
escritas contra rutas absolutas:

```json
"source": "/sw.js"
"source": "/js/bloquitos.js"
```

Si el juego acaba servido bajo `/juegos/bloquitos/`, esas reglas no encajan con
nada. El juego se ve y se juega, pero pierde la política de contenido, el
`nosniff` y —esto sí se nota— el `must-revalidate` de `sw.js`, con lo que las
actualizaciones dejan de llegar bien.

Además, un trabajador de servicio solo controla su propia carpeta hacia abajo.
La cabecera `Service-Worker-Allowed: /` de `vercel.json` está para ampliarle el
alcance a todo el dominio, y también se pierde fuera de la raíz.

La solución sencilla es no meterlo en una subcarpeta: en Vercel, dale al juego su
propio proyecto y su propio dominio. Si aun así necesitas servirlo bajo un
prefijo, hay que ajustar cada `source` de `vercel.json` para que lo incluya.

### El despliegue termina en verde pero el juego no tiene el último cambio

**Causa: el paquete del repositorio está desactualizado y no lo notaste.**
`npm run verificar` compara la fecha de `js/bloquitos.js` con la del módulo más
reciente de `js/` y avisa. Ejecútalo antes de enviar cambios.

---

## Referencia rápida

| Cosa | Dónde está |
|---|---|
| Configuración del despliegue | `vercel.json` |
| Qué archivos no se suben | `.vercelignore` |
| Comando de construcción | `npm run vercel-build` → `herramientas/construir.mjs` |
| Comprobación previa | `npm run verificar` |
| Versión de la caché | `VERSION` en `sw.js` |

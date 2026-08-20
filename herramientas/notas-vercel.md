# Notas de investigación: Vercel y las PWA estáticas

Documento de referencia. **No toca código ni configuración**: recoge lo que dice la
documentación oficial sobre los seis puntos que afectan a Bloquitos, y lo contrasta
con lo que ya está decidido en `vercel.json`, `sw.js`, `manifest.webmanifest` e
`index.html`.

Para *qué pulsar* y *qué comprobar* al desplegar está `DESPLIEGUE.md`. Esto es el
porqué: la letra pequeña que explica por qué cada valor es el que es, qué reglas
son un contrato explícito y cuáles son una red de seguridad que hoy no sostiene
nada. Cada hallazgo termina en una conclusión práctica y el enlace consultado.

Todo comprobado el **20 de agosto de 2026**. Donde pone «verificado con `curl`» es
una respuesta real de la red de Vercel de ese día, no una cita de la documentación.
Al final hay una lista de fuentes y una tabla de comprobaciones que solo pueden
hacerse contra el despliegue ya publicado.

---

## a) Un proyecto sin framework: `framework: null` y `outputDirectory: "."`

**a.1 — `null` es literalmente la opción «Other» del panel.**
La referencia de `vercel.json` lo dice sin rodeos: *«To select "Other" as the
Framework Preset, use `null`»*. No es «ningún valor» ni «déjalo vacío»: es un valor
válido del campo, cuyo tipo es `string | null`. Y la misma página avisa de que
*«This value overrides the Framework in Project Settings»*.

> **Para Bloquitos:** el `framework: null` de `vercel.json` es exactamente lo que
> `DESPLIEGUE.md` manda escribir a mano en el panel (`Other`), y gana sobre él. Quien
> rellene mal el formulario no rompe nada.

[Referencia de `framework`](https://vercel.com/docs/project-configuration/vercel-json#framework)

**a.2 — Con «Other», el directorio de salida por defecto ya es la raíz… salvo que
exista `public/`.** La guía de construcción lo detalla: *«Choose "Other" as the
Framework Preset. This sets the output directory as `public` if it exists or `.`
(root directory of the project) otherwise»*. Es decir, `.` es un valor documentado y
legítimo, no un truco.

Lo interesante es el «salvo que». Bloquitos no tiene carpeta `public/`, así que hoy
el valor por defecto y el declarado coinciden. Pero el día que alguien cree un
`public/` para cualquier cosa —una imagen de redes sociales, un `robots.txt`— el
valor por defecto cambiaría solo, y Vercel publicaría **esa carpeta** en lugar del
juego. El sitio quedaría en un 404 sin que nadie hubiera tocado la configuración.

> **Para Bloquitos:** declarar `"outputDirectory": "."` no es redundante: es lo que
> impide que crear una carpeta `public/` en el futuro despublique el juego en
> silencio. No lo quites por parecer obvio.

[Configurar la construcción — Output Directory](https://vercel.com/docs/builds/configure-a-build#output-directory)

**a.3 — Solo se sirve lo que hay dentro del directorio de salida.**
*«Only the contents of this Output Directory will be served statically by Vercel.»*
Con `.` como salida, el «directorio de salida» es el repositorio entero tal y como
queda tras la construcción, filtrado por `.vercelignore`.

> **Para Bloquitos:** es la razón por la que `.vercelignore` importa tanto aquí como
> `vercel.json`. Con salida `.`, todo lo que no se excluya explícitamente se publica.

[Configurar la construcción — Output Directory](https://vercel.com/docs/builds/configure-a-build#output-directory)

**a.4 — Hay un camino alternativo que Bloquitos deliberadamente no toma: saltarse la
construcción.** La documentación describe el caso «sitio que no necesita
construirse»: framework `Other`, activar el *Override* del Build Command y dejarlo
**vacío**. Entonces *«This prevents running the build, and your content is served
directly»*.

> **Para Bloquitos:** no vale, y conviene saber por qué. El repositorio no es
> autosuficiente: `index.html` carga `js/bloquitos.js`, que lo genera
> `herramientas/construir.mjs` a partir de los módulos de `js/`. Sin paso de
> construcción se publicaría el paquete que hubiera commiteado, con el riesgo de que
> esté desactualizado. El `buildCommand` es lo que garantiza que lo publicado se
> generó desde el código fuente de ese commit.

[Configurar la construcción — Skip Build Step](https://vercel.com/docs/builds/configure-a-build#skip-build-step)

**a.5 — Precedencia del comando de construcción: `vercel.json` → panel → `package.json`.**
*«The `buildCommand` property can be used to override the Build Command in the
Project Settings dashboard, and the `build` script from the `package.json` file for
a given deployment.»*

> **Para Bloquitos:** lo que de verdad se ejecuta en Vercel es
> `node herramientas/construir.mjs`, escrito en `vercel.json`. El script
> `vercel-build` de `package.json` es la misma orden escrita para humanos —es lo que
> `DESPLIEGUE.md` pide teclear en el panel— y para que `npm run` haga en local lo
> mismo que la nube. Si los dos dejan de coincidir, manda `vercel.json` y el panel
> mentirá.

[Referencia de `buildCommand`](https://vercel.com/docs/project-configuration/vercel-json#buildcommand)

**a.6 — La versión de Node la elige Vercel, y va cambiando.**
*«By default, a new project uses the latest Node.js LTS version available on
Vercel»*; hoy las disponibles son **24.x (por defecto)**, 22.x y 20.x. Se puede fijar
desde el panel o con `engines.node` en `package.json`, que tiene prioridad sobre el
panel.

> **Para Bloquitos:** no hace falta fijar nada. `construir.mjs` y
> `verificar-paquete.mjs` solo usan `node:fs`, `node:path` y `node:url` con módulos
> ES, que funcionan igual en 20, 22 y 24. `package.json` no declara `engines`, así
> que el proyecto seguirá el valor por defecto y este irá subiendo solo. Si algún día
> una versión nueva rompiera la construcción, la palanca es añadir
> `"engines": { "node": "24.x" }`, no tocar el panel.

[Versiones de Node.js admitidas](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

---

## b) Alcance del trabajador de servicio y la cabecera `Service-Worker-Allowed`

**b.1 — El alcance por defecto es la carpeta donde vive el script.**
La especificación es explícita: *«Maximum allowed scope defaults to the path the
script sits in»*. Un `/js/sw.js` solo puede controlar `/js/` hacia abajo; un
`/sw.js` puede controlar `/`.

> **Para Bloquitos:** `sw.js` está en la raíz y `js/main.js` lo registra con
> `navigator.serviceWorker.register('./sw.js')`, **sin pasar la opción `scope`**. El
> alcance resultante es `/`, que es el máximo permitido. Ya controla todo el sitio
> sin ayuda de ninguna cabecera.

[Especificación de Service Workers — Path restriction](https://w3c.github.io/ServiceWorker/#path-restriction)

**b.2 — `Service-Worker-Allowed` no *fija* el alcance: sube el techo.**
*«Indicates the user agent will override the path restriction, which limits the
maximum allowed scope url that the script can control, to the given value.»* Sigue
haciendo falta pedir ese alcance en `register(..., { scope })`, y sigue habiendo
techo: la propia especificación muestra que un `/foo/bar/sw.js` con
`Service-Worker-Allowed: /foo` y `{ scope: "/" }` **falla igual**.

> **Para Bloquitos:** la regla `Service-Worker-Allowed: /` de `vercel.json` **hoy no
> hace nada**: sube un techo que ya estaba donde tiene que estar, y el registro ni
> siquiera pide un alcance distinto del que le corresponde. No es un error ni molesta,
> pero conviene no atribuirle el mérito del funcionamiento actual. Pasa a ser
> imprescindible el día que `sw.js` deje de estar en la raíz —por ejemplo, si el juego
> acabara servido bajo `/juegos/bloquitos/`—, que es justo el escenario del que avisa
> `DESPLIEGUE.md` §5.

[Cabecera `Service-Worker-Allowed` (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Service-Worker-Allowed) ·
[Especificación — Extended HTTP headers](https://w3c.github.io/ServiceWorker/#service-worker-allowed)

**b.3 — La restricción de ruta no es una frontera de seguridad.**
*«However, the path restriction is not considered a hard security boundary, as only
origins are. Sites are encouraged to use different origins to securely isolate
segments of the site if appropriate.»*

> **Para Bloquitos:** irrelevante mientras el juego tenga su propio dominio, que es
> lo que recomienda `DESPLIEGUE.md`. Es un argumento más para no meterlo bajo un
> prefijo compartido con otras cosas.

[Especificación — Path restriction](https://w3c.github.io/ServiceWorker/#path-restriction)

**b.4 — `sw.js` debe llegar con un MIME de JavaScript o el registro se cae entero.**
En el algoritmo de actualización: *«Extract a MIME type from the response's header
list. If this MIME type (ignoring parameters) is not a JavaScript MIME type, then:
Invoke Reject Job Promise with job and "SecurityError" DOMException»*.

Verificado con `curl` contra la red de Vercel: un `/sw.js` estático se sirve como
`content-type: application/javascript; charset=utf-8`, que sí lo es.

> **Para Bloquitos:** no hay nada que configurar, pero sí algo que no romper. Si
> alguien añadiera a `vercel.json` una regla de `Content-Type` sobre `/sw.js` o sobre
> `/(.*)`, el modo sin conexión desaparecería de golpe y en silencio —el
> `.catch(() => {})` del registro se traga el `SecurityError`—. Además, `nosniff`
> (que sí está puesto para todo) convierte cualquier MIME equivocado en un bloqueo
> duro para los destinos de tipo script.

[Especificación — Update algorithm](https://w3c.github.io/ServiceWorker/#update-algorithm) ·
[Fetch — nosniff](https://fetch.spec.whatwg.org/#should-response-to-request-be-blocked-due-to-nosniff?)

---

## c) Por qué `sw.js` no debe quedarse cacheado, y qué hace realmente `max-age=0, must-revalidate`

**c.1 — Ese valor exacto es *ya* el valor por defecto de Vercel.**
*«The default value is `cache-control: public, max-age=0, must-revalidate` which
instructs both the CDN and the browser not to cache.»* Verificado con `curl` sobre
tres sitios estáticos alojados en Vercel: los tres devuelven ese mismo
`cache-control` en su HTML.

> **Para Bloquitos:** la regla de `/sw.js` en `vercel.json` **no arregla un
> comportamiento malo: fija por escrito el bueno**. Su valor está en que deja de
> depender de un valor por defecto de la plataforma, y en que se puede auditar con un
> `curl -I` sin saber qué hace Vercel por dentro.

[Cabeceras Cache-Control — valor por defecto](https://vercel.com/docs/caching/cache-control-headers#default-cache-control-value)

**c.2 — La CDN sí cachea los estáticos, y no se puede evitar; lo que salva es la
clave de caché.** Son dos afirmaciones que hay que leer juntas: *«Static files are
automatically cached on Vercel's global network for the lifetime of the deployment
after the first request»* y *«Vercel doesn't allow bypassing the cache for static
files by design»*. La clave de caché incluye *«the unique deployment URL»*, y de ahí:
*«Since each deployment has a different cache key, you can promote a new deployment
to production without affecting the cache of the previous deployment»*.

Verificado con `curl`: un HTML estático en Vercel responde `x-vercel-cache: HIT` con
`age: 771099` (nueve días en el borde) **y a la vez** `cache-control: public,
max-age=0, must-revalidate`. Los dos hechos conviven porque hablan de cachés
distintas: la del borde y la del navegador.

> **Para Bloquitos:** el enunciado «`sw.js` no debe cachearse en el CDN» es, en
> Vercel, un problema que no existe: el borde lo cachea igual y da lo mismo, porque
> cada despliegue estrena clave y nunca puede servir el `sw.js` del despliegue
> anterior. La cabecera trabaja del lado del **navegador y de los proxies
> intermedios**, no del borde.

[Caché de la CDN — ficheros estáticos](https://vercel.com/docs/caching/cdn-cache#static-files-caching) ·
[Claves de caché](https://vercel.com/docs/caching/cdn-cache/purge#cache-keys)

**c.3 — El navegador ya se salta su propia caché para `sw.js`, por especificación.**
El modo `updateViaCache` de un registro vale `"imports"` por defecto —está en la IDL:
`ServiceWorkerUpdateViaCache updateViaCache = "imports"`—, y el algoritmo de
actualización dice: *«Set request's cache mode to "no-cache" if any of the following
are true: registration's update via cache mode is not "all"»*. Como `"imports"` no es
`"all"`, el script principal se pide siempre con `no-cache`.

Y aunque alguien registrara con `updateViaCache: "all"`, hay un segundo cinturón: el
registro se considera *stale* cuando han pasado más de **86 400 segundos** (24 horas)
desde la última comprobación, y eso también fuerza `no-cache`. Una actualización no
puede retrasarse más de un día por culpa de la caché.

> **Para Bloquitos:** en cualquier navegador moderno, `sw.js` se revalida aunque la
> cabecera no estuviera. Lo que hace la cabecera es cubrir el caso que la
> especificación deja abierto —*«Even if the cache mode is not set to "no-cache", the
> user agent obeys Cache-Control header's max-age value in the network layer»*— y los
> proxies corporativos, que no leen especificaciones de service workers.

[Especificación — Update algorithm](https://w3c.github.io/ServiceWorker/#update-algorithm) ·
[`updateViaCache` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)

**c.4 — Lo que de verdad entrega una versión nueva es la comparación byte a byte.**
El navegador considera actualizado el trabajador si el archivo descargado *«is not
byte-for-byte identical»* con el guardado. Revalidar sirve para **enterarse**; que el
archivo haya cambiado es lo que dispara la instalación.

> **Para Bloquitos:** encaja con lo que ya explica `DESPLIEGUE.md` §5 («sube la
> versión de la caché»). Dicho al revés y por si sirve de aviso: si un despliegue
> cambia `js/bloquitos.js` pero **no** `sw.js`, el archivo del trabajador es idéntico
> byte a byte, no hay actualización, y quien tenga el juego instalado seguirá
> sirviéndose de su caché vieja indefinidamente. Cambiar `VERSION` no es una
> formalidad: es el único mecanismo de entrega que tiene este proyecto.

[Especificación — Update algorithm](https://w3c.github.io/ServiceWorker/#update-algorithm)

**c.5 — ✅ CORREGIDO. El `max-age=3600` de `js/bloquitos.js` y `css/estilos.css` era
una desviación del valor por defecto, y tenía un efecto secundario.**
Esos dos archivos **no llevan hash en el nombre** (la recomendación de Vercel de
`max-age=31536000, immutable` es solo para *«content-hashed assets»*). Con una hora de
frescura declarada, pasan dos cosas:

1. Un jugador que vuelva antes de una hora usa su copia local sin preguntar. Poco
   grave por sí solo.
2. Lo otro sí importa: cuando se instala un `sw.js` nuevo, el `install` descarga
   `./js/bloquitos.js`. Si esa petición es un `fetch` con modo de caché normal,
   **puede resolverse desde la caché HTTP del navegador**.
   Resultado posible: la caché `bloquitos-vN` recién creada se rellena con el paquete
   *anterior*, y como después el `fetch` del trabajador sirve primero desde caché, esa
   copia vieja se queda ahí hasta la siguiente actualización del trabajador.

Además, la ganancia es casi nula: en cuanto el trabajador está activo, el manejador
`fetch` de `sw.js` responde desde `CacheStorage` antes de tocar la red, así que ese
`max-age` solo se ejercita en la primerísima visita y durante la instalación —
justo el momento en el que hace daño.

> **Para Bloquitos:** aplicado por los dos lados. `vercel.json` deja esos dos archivos
> en el valor por defecto de Vercel (`public, max-age=0, must-revalidate`), que no cuesta
> nada: la CDN los sigue cacheando en el borde durante toda la vida del despliegue, y el
> modo sin conexión lo da `CacheStorage`, no la caché HTTP. Y `sw.js` descarga la lista
> de `ARCHIVOS` con `fetch(ruta, { cache: 'reload' })`, que salta la caché HTTP: eso
> cierra el mismo agujero también en GitHub Pages y con cualquier cabecera futura, donde
> `vercel.json` no manda. La alternativa, si algún día se quiere un TTL largo de verdad,
> es ponerle hash al nombre del paquete en `construir.mjs` — pero eso obliga a tocar
> `index.html` y `sw.js`, y es otra conversación.

[Cabeceras Cache-Control — ajustes recomendados](https://vercel.com/docs/caching/cache-control-headers#recommended-settings) ·
[Especificación — `Cache.addAll()`](https://w3c.github.io/ServiceWorker/#dom-cache-addall)

---

## d) El MIME de `.webmanifest` y qué pasa si se sirve como `text/plain`

**d.1 — El tipo correcto es `application/manifest+json`, y la extensión
`.webmanifest`.** Ambos están registrados en la IANA: *«The mime type
`application/manifest+json` is the application manifest media type. Both the mime
type and the `.webmanifest` file extension are registered with the Internet Assigned
Numbers Authority»*. Y sobre el transporte: *«it is RECOMMENDED that the manifest be
labeled with the application manifest media type»*.

**d.2 — Cualquier MIME de JSON sirve; `text/plain` no es uno.**
La nota de la especificación es la que zanja el asunto: los desarrolladores
*«are encouraged to transfer the manifest using the `application/manifest+json` MIME
type, although **any JSON MIME type is ok**»*. `application/json` entra;
`text/plain` queda fuera del comportamiento que la especificación respalda, y lo que
haga cada navegador a partir de ahí deja de estar garantizado. En la práctica es el
tipo de fallo que aparece como un aviso en Lighthouse o en la pestaña *Manifest* de
las herramientas del navegador, no como un error visible.

**d.3 — `nosniff` no rescata este caso, y eso lo empeora.**
El algoritmo de Fetch solo bloquea por `nosniff` cuando *«destination is script-like
and mimeType is failure or is not a JavaScript MIME type»* (y el caso equivalente para
`style`). El destino `manifest` no está en esa lista.

> **Para Bloquitos:** un manifiesto mal etiquetado no daría un error rojo en consola
> como lo daría un `sw.js` mal etiquetado; fallaría en silencio, y el síntoma sería
> «no aparece el icono de instalar» — con el manifiesto pareciendo correcto en el
> código. Merece la pena saberlo antes de perder una tarde.

**d.4 — Vercel ya lo hace bien por su cuenta.** Verificado con `curl` contra un
`.webmanifest` servido por Vercel: `content-type: application/manifest+json;
charset=utf-8`, sin ninguna regla de cabeceras que lo forzara.

> **Para Bloquitos:** la regla de `Content-Type` para `/manifest.webmanifest` en
> `vercel.json`, igual que la de `Cache-Control` de `sw.js`, es un contrato explícito
> sobre algo que ya funciona: sobrevive a un cambio de valores por defecto de la
> plataforma y documenta la intención. Barato y correcto. Lo que sí hay que recordar
> es que la regla apunta a la ruta exacta `/manifest.webmanifest`: renombrar el
> archivo sin actualizar `vercel.json` deja la cabecera colgando de una ruta que ya
> no existe.

**d.5 — El manifiesto pasa por la CSP, y la de este proyecto lo contempla.**
La política de `vercel.json` incluye `manifest-src 'self'`. La `<meta>` de
`index.html` no declara `manifest-src`, pero cae en `default-src 'self'`, que también
lo permite. El atributo `crossorigin="use-credentials"` que menciona la
documentación solo hace falta si el manifiesto necesitara credenciales para
descargarse: no es el caso, aquí no hay ni sesión ni autenticación.

[Manifiesto de aplicación web — consideraciones IANA](https://www.w3.org/TR/appmanifest/#iana-considerations) ·
[Nota sobre la extensión y el MIME](https://www.w3.org/TR/appmanifest/#using-a-link-element-to-link-to-a-manifest) ·
[Manifiesto (MDN)](https://developer.mozilla.org/en-US/docs/Web/Manifest) ·
[Fetch — nosniff](https://fetch.spec.whatwg.org/#should-response-to-request-be-blocked-due-to-nosniff?)

---

## e) `cleanUrls` y `trailingSlash` frente a rutas relativas como `./js/bloquitos.js`

**e.1 — Una ruta relativa se resuelve contra la URL del documento, no contra el
dominio.** Solo cuenta el trozo hasta la última barra. Es la regla de siempre
(RFC 3986 §5.2), pero es la que decide todo lo demás:

| URL del documento | Directorio base | `./js/bloquitos.js` resuelve a |
|---|---|---|
| `/` | `/` | `/js/bloquitos.js` ✔ |
| `/index.html` | `/` | `/js/bloquitos.js` ✔ |
| `/index` | `/` | `/js/bloquitos.js` ✔ |
| `/index/` | `/index/` | `/index/js/bloquitos.js` ✘ 404 |

Las tres primeras filas son las únicas que Bloquitos puede producir con la
configuración actual. La cuarta es la que hay que evitar, y es la razón de fondo de
todo este apartado.

[Resolución de referencias relativas (RFC 3986 §5.2)](https://www.rfc-editor.org/rfc/rfc3986#section-5.2)

**e.2 — Qué hace `cleanUrls: true` exactamente.**
La documentación: *«all HTML files … will have their extension removed. When visiting
a path that ends with the extension, a 308 response will redirect the client to the
extensionless path»*. Y la implementación (`packages/routing-utils/src/superstatic.ts`
del repositorio de Vercel) enseña la regla concreta que se genera para los índices:

```js
routes.push({
  src: '^/(?:(.+)/)?index(?:\\.html)?/?$',
  headers: { Location: loc },   // loc = trailingSlash ? '/$1/' : '/$1'
  status,                        // 308
});
```

Con `trailingSlash: false` y un `index.html` en la raíz, el grupo capturado queda
vacío, así que **`/index.html` y `/index` redirigen ambos a `/`** con un 308.

> **Para Bloquitos:** el juego tiene exactamente un archivo HTML y está en la raíz,
> luego el único efecto visible de `cleanUrls` es que `/index.html` deja de ser una
> URL servida y pasa a ser un desvío a `/`. Ninguna ruta relativa cambia: el
> directorio base sigue siendo `/` antes y después del desvío.

[Referencia de `cleanUrls`](https://vercel.com/docs/project-configuration/vercel-json#cleanurls) ·
[Implementación en vercel/vercel](https://github.com/vercel/vercel/blob/main/packages/routing-utils/src/superstatic.ts)

**e.3 — Ese 308 toca a `sw.js`, y *no* era benigno.**
El array `ARCHIVOS` de `sw.js` incluye `'./index.html'`. Con `cleanUrls`, esa petición
se encuentra un 308. Guardarla sí funciona: `Cache.addAll()` hace un `fetch` normal
—modo de redirección `follow`— y solo rechaza *«If response's type is "error", or
response's status is not an ok status or is 206»*. Un 308 seguido hasta un 200 no es
ninguna de esas cosas.

El problema está en **devolverla**, no en guardarla. La respuesta almacenada queda con
`redirected` a `true`, y el algoritmo *Handle Fetch* rechaza esa respuesta cuando el
modo de redirección de la petición no es `follow`: *«If response's type is "opaqueredirect"
… or response's url list is not empty and request's redirect mode is not "follow", …
set response to a network error»*. Las navegaciones usan modo `manual`, no `follow`.

Consecuencia real: quien abriera `https://…/index.html` con el trabajador ya instalado
recibiría un error de red —la pantalla de fallo del navegador, no el juego—, tanto sin
conexión como con ella, porque la entrada cacheada se sirve antes de mirar la red. Y lo
mismo con el respaldo `cache.match('./index.html')` de las navegaciones sin conexión.

> **Para Bloquitos:** corregido en `sw.js`. La función `sinRedireccion()` reconstruye la
> respuesta —mismo cuerpo, mismas cabeceras— antes de guardarla, de modo que en la caché
> nunca hay una respuesta marcada como redirigida. Sin redirección de por medio (GitHub
> Pages, doble clic) no cambia nada. Es también la razón por la que `install` ya no usa
> `cache.add()`: esa API guarda la respuesta tal cual llega, sin dejar tocarla.

[Especificación — `Cache.addAll()`](https://w3c.github.io/ServiceWorker/#dom-cache-addall) ·
[Especificación — *Handle Fetch*](https://w3c.github.io/ServiceWorker/#on-fetch-request-algorithm)

**e.4 — `trailingSlash: false` es una elección, no un valor neutro.**
Por defecto la propiedad es `undefined`. Puesta a `false`: *«visiting a path that ends
with a forward slash will respond with a 308 status code and redirect to the path
without the trailing slash»*. Puesta a `true` haría lo contrario, y además cambiaría
la plantilla del desvío de `cleanUrls` de `/$1` a `/$1/`.

Con un solo HTML en la raíz, `true` no rompería nada hoy: la raíz `/` conserva su
barra en cualquier caso. El problema aparece en cuanto exista un segundo HTML dentro
de una carpeta: con `trailingSlash: true` se serviría en `/carpeta/pagina/`, el
directorio base bajaría un nivel y **todas** sus rutas `./` apuntarían a un sitio que
no existe — la cuarta fila de la tabla de e.1.

> **Para Bloquitos:** `false` hoy no cuesta nada y cierra esa trampa para siempre. Es
> la respuesta corta a «¿puedo cambiar esto a `true`?»: no, salvo que al mismo tiempo
> se pasen todas las rutas del proyecto a absolutas, cosa que rompería el doble clic
> sobre `index.html` y GitHub Pages.

[Referencia de `trailingSlash`](https://vercel.com/docs/project-configuration/vercel-json#trailingslash)

**e.5 — El manifiesto y el trabajador resuelven sus rutas contra *su* URL, no contra
la de la página.** `manifest.webmanifest` declara `"start_url": "./"` y
`"scope": "./"`; como el archivo se sirve en `/manifest.webmanifest`, su directorio
base es `/` y ambos valores resuelven a `/`. Lo mismo con las rutas de `ARCHIVOS`
dentro de `sw.js`, que vive en `/sw.js`.

> **Para Bloquitos:** el alcance del manifiesto (`/`) cubre su `start_url` (`/`) y
> coincide con el alcance del trabajador de servicio (`/`). Los tres encajan sin que
> nadie haya escrito una ruta absoluta, y por eso el mismo repositorio funciona en
> Vercel, en GitHub Pages bajo `/bloquitos/` y con doble clic. Mover el manifiesto o
> el trabajador a una subcarpeta rompería esa coincidencia aunque el HTML no cambiara.

[Manifiesto — resolución de `start_url`](https://www.w3.org/TR/appmanifest/#start_url-member)

---

## f) Límites del plan gratuito (*Hobby*) que afectan a este proyecto

**f.1 — Los números, y lo lejos que está Bloquitos de todos ellos.**

| Límite (Hobby) | Valor | Bloquitos hoy |
|---|---|---|
| Despliegues por día | 100 | uno por envío a `main` |
| Despliegues por hora / por 5 min | 100 / 60 | ídem |
| Tamaño de las fuentes subidas (CLI) | 100 MB | ~0,5 MB |
| Archivos por despliegue (CLI) | 15 000 | 26 |
| Tiempo de construcción | 45 min | segundos: `installCommand` no instala nada |
| Construcciones simultáneas | 1 | irrelevante |
| Rutas por despliegue | 2048 | 5 reglas de cabeceras + 3 generadas |
| *Fast Data Transfer* | 100 GB/mes | cientos de KB por partida |
| Peticiones al borde | hasta 1 000 000 | — |
| Proyectos / dominios por proyecto | 200 / 50 | 1 / 1 |
| Retención de registros de ejecución | 1 hora | no hay funciones |

Los ~0,5 MB y los 26 archivos son medidos sobre el repositorio con las exclusiones de
`.vercelignore` aplicadas: fuera `escritorio/`, `pruebas/`, `.github/`, `node_modules/`,
`LICENSE`, los `.md` salvo el README, las dos herramientas que la construcción no usa
(`verificar-paquete.mjs` y `revisar-secretos.sh`) y `iconos/og-bloquitos.svg`, que es el
original vectorial del que sale el PNG y no lo pide nadie desde el navegador.

> **Para Bloquitos:** ningún límite de tamaño está ni cerca. El único que se puede
> tocar en un día malo es el de **100 despliegues diarios**, y hace falta empujar
> mucho para llegar: cada envío a `main`, cada rama y cada *pull request* generan uno.

[Límites de Vercel](https://vercel.com/docs/limits) · [Plan Hobby](https://vercel.com/docs/plans/hobby)

**f.2 — Con `buildCommand`, cada despliegue cuenta como construcción.**
El límite de *builds* es de *«`100` Deployments every `3600` seconds»*, con una nota
importante: *«Hosting static files such as an index.html file is not classed as a
build»*.

> **Para Bloquitos:** el juego **no** se beneficia de esa excepción, precisamente
> porque declara un `buildCommand` que ejecuta `construir.mjs`. Es el precio correcto
> a pagar por que el paquete se genere desde el código fuente en cada despliegue
> (ver a.4), y con 100 construcciones por hora no es un precio que se note.

[Límites — construcciones por hora (Hobby)](https://vercel.com/docs/limits#builds-per-hour-hobby)

**f.3 — Pasarse de un límite no cuesta dinero: cuesta espera.**
*«In most cases, if you exceed your usage limits on the Hobby plan, you will have to
wait until 30 days have passed before you can use the feature again.»* No hay factura
sorpresa; hay una pausa.

[Plan Hobby — ciclo de facturación](https://vercel.com/docs/plans/hobby#hobby-billing-cycle)

**f.4 — El plan gratuito es solo para uso personal y no comercial.**
*«As stated in the fair use guidelines, the Hobby plan restricts users to
non-commercial, personal use only.»*

> **Para Bloquitos:** encaja hoy —es un juego libre con licencia MIT, sin anuncios,
> sin pagos y sin patrocinio—. Es el único límite que podría dejar de cumplirse sin
> que ningún número suba: si algún día el juego llevara publicidad o promocionara un
> producto, tocaría plan Pro, no por consumo sino por las condiciones.

[Uso comercial — normas de uso razonable](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)

**f.5 — Un tope que no se ve venir: 10 MB por respuesta cacheable.**
Entre los criterios para que la CDN cachee una respuesta está *«Response doesn't
exceed `10MB` in content length»*.

> **Para Bloquitos:** el archivo más grande es `js/bloquitos.js`, unos 92 KB. Queda
> margen para cien veces el juego actual. Solo sería un problema si algún día se
> empaquetaran audio o vídeo dentro del repositorio.

[Criterios de respuesta cacheable](https://vercel.com/docs/caching/cdn-cache#cacheable-response-criteria)

---

## Lo que solo se puede comprobar contra el despliegue publicado

Estas cuatro cosas no se pueden verificar en local, porque `python3 -m http.server`
no envía cabeceras ni aplica `cleanUrls`. Complementan la lista de `DESPLIEGUE.md` §4;
sustituye `tu-proyecto` por el dominio real.

| Comprobación | Orden | Qué tiene que salir | Hallazgo |
|---|---|---|---|
| El desvío de `cleanUrls` | `curl -I https://tu-proyecto.vercel.app/index.html` | `308` y `location: /` | e.2 |
| El MIME del manifiesto | `curl -I https://tu-proyecto.vercel.app/manifest.webmanifest` | `content-type: application/manifest+json` | d.4 |
| El trabajador de servicio | `curl -I https://tu-proyecto.vercel.app/sw.js` | `cache-control: public, max-age=0, must-revalidate`, `service-worker-allowed: /` y un `content-type` de JavaScript | c.1, b.4 |
| El paquete | `curl -I https://tu-proyecto.vercel.app/js/bloquitos.js` | `cache-control: public, max-age=0, must-revalidate` | c.5 |

De las cuatro, la primera es la única cuyo resultado exacto está deducido de la
implementación de Vercel y no verificado contra un despliegue de Bloquitos. Las otras
tres se han verificado contra respuestas reales de la red de Vercel, aunque de otros
proyectos.

---

## Resumen: qué es contrato, qué es red de seguridad y qué merece una segunda mirada

- **Contratos explícitos** (repiten un valor por defecto de Vercel, y está bien que lo
  hagan): `Cache-Control` de `/sw.js` (c.1), `Content-Type` del manifiesto (d.4),
  `framework: null` (a.1).
- **Protección de verdad** (sin esto algo se rompería): `outputDirectory: "."` frente
  a un futuro `public/` (a.2), `trailingSlash: false` frente a un futuro HTML en
  subcarpeta (e.4), el `buildCommand` frente a publicar un paquete rancio (a.4).
- **Red de seguridad que hoy no sostiene nada**: `Service-Worker-Allowed: /`, porque
  `sw.js` ya está en la raíz (b.2). Inofensiva y útil el día que el juego se mueva.
- **Lo que mereció una segunda mirada, ya corregido**: el `max-age=3600` de
  `js/bloquitos.js` y `css/estilos.css` (c.5). Son archivos sin hash en el nombre y se
  colaban desactualizados en una caché del trabajador de servicio recién creada; ahora
  van al valor por defecto y `sw.js` los pide con `cache: 'reload'`.

---

## Fuentes consultadas

Documentación de Vercel:

- [Project Configuration](https://vercel.com/docs/project-configuration)
- [Static Configuration with vercel.json](https://vercel.com/docs/project-configuration/vercel-json) — `framework`, `outputDirectory`, `buildCommand`, `cleanUrls`, `trailingSlash`, `headers`
- [Configuring a Build](https://vercel.com/docs/builds/configure-a-build) — directorio de salida, preset «Other», saltarse la construcción
- [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel CDN Cache](https://vercel.com/docs/caching/cdn-cache) — caché de estáticos, criterios de respuesta cacheable
- [Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers) — valor por defecto y recomendaciones
- [Purging Vercel CDN Cache](https://vercel.com/docs/caching/cdn-cache/purge) — claves de caché
- [System Headers](https://vercel.com/docs/headers) — cabeceras reservadas
- [Limits](https://vercel.com/docs/limits) y [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)

Especificaciones y referencia de la plataforma web:

- [Service Workers (W3C)](https://w3c.github.io/ServiceWorker/) — algoritmo de actualización, restricción de ruta, `Service-Worker-Allowed`, `Cache.addAll()`
- [Web Application Manifest (W3C)](https://www.w3.org/TR/appmanifest/) — media type, extensión, resolución de `start_url`
- [Fetch (WHATWG)](https://fetch.spec.whatwg.org/) — bloqueo por `nosniff`
- [RFC 3986 §5.2](https://www.rfc-editor.org/rfc/rfc3986#section-5.2) — resolución de referencias relativas
- [`Service-Worker-Allowed` (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Service-Worker-Allowed)
- [`ServiceWorkerContainer.register()` (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- [Web app manifest (MDN)](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [The service worker lifecycle (web.dev)](https://web.dev/articles/service-worker-lifecycle)

Código fuente:

- [`packages/routing-utils/src/superstatic.ts`](https://github.com/vercel/vercel/blob/main/packages/routing-utils/src/superstatic.ts) — implementación de `cleanUrls` y `trailingSlash`

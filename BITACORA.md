# Bitácora de cambios — PokeDoc

La entrada MÁS RECIENTE va ARRIBA. Cada sesión de Claude añade la suya
antes de cada push (ver CLAUDE.md). Formato:

```
## AAAA-MM-DD HH:MM — QUIÉN (PINGU-Claude / IBAI-Claude)
**Hecho**: qué se ha hecho, en una o dos frases.
**Ficheros**: los tocados (los nuevos, marcados).
**En curso / pendiente**: lo que queda a medias o para el siguiente.
```

---

## 2026-09-16 (4) — PINGU-Claude (tanda 315 — el resto de la escala de color)

**Hecho**: lo último de la lista que aprobó PINGU. La propuesta hablaba
de «502 colores a mano»; al medirlo, **casi ninguno era un descuido**:
son colores FIJOS de la marca que no pueden seguir al tema porque llevan
texto blanco encima. Cambiarlos por tokens semánticos los habría roto —
es lo que le pasó a la paleta del avatar en la 311—. Lo que se ha hecho
es **ponerles nombre**:

- **`--blanco-fijo`** para los 62 `#fff` que van ENCIMA de un color.
  `--white` no es blanco: es la superficie, y en oscuro vale `#182430`.
  Cualquiera que «ordenara» uno de esos `#fff` a `var(--white)` dejaba
  letra oscura sobre fondo azul sin que nada diera error.
- **`--navy-solid`, `--navy-solid-dark` y `--navy-solid-light`** (11
  usos) para los azules que llevan blanco encima y que por eso NO se
  aclaran en oscuro. Con `--danger-solid` (311) ya son una familia
  reconocible.
- **Los seis `--arte-*`**: los degradados de las tarjetas sin foto
  estaban escritos DOS veces —las seis `.arte-N` de `components.css` y
  las seis `.torneo-arte-N` de `torneos.css`, los mismos en distinto
  orden—. Ahora viven solo en `style.css`.
- **31 `var(--token, respaldo)` fuera**: el respaldo existía porque el
  token no, y mientras conviven dicen cosas distintas.

**Ficheros**: `css/style.css`, `css/components.css`, `css/torneos.css`,
`css/aprender.css`, `css/comunidad.css`, `css/curso.css`,
`css/editor-texto.css`, `css/foro.css`, `css/noticias.css`,
`css/perfil.css`, `css/portada.css`, `SCHEMA.md`, `CLAUDE.md`.
En la rama `pruebas`: `test-tanda-315.mjs` (nuevo, 4 bloques),
`rigor-tanda-315.py` (nuevo, 10 mutaciones).

**Comprobado**: contraste medido 0 fallos en los dos temas, portada en
167,0 KB de 170, y capturas de /aprender y /torneos para ver que los
degradados salen igual que antes.

**En curso / pendiente**: nada en curso. Queda **a propósito** sin hacer
la consolidación de los velos blancos (25 alfas distintas de
`rgba(255,255,255,α)` en 65 usos, que cabrían en ~6 pasos): los velos flojos (0,08–0,28) son bordes
y fondos, y ahí ninguna auditoría puede decir nada —salen verdes hagas
lo que hagas—; los fuertes (0,7–0,95) son TEXTO blanco sobre color, y
ahí bajar un 0,82 a 0,75 SÍ baja el contraste y hay que medirlo. Lo
tiene que mirar un ojo humano antes. Pendiente de aprobación de PINGU.

---

## 2026-09-16 (3) — PINGU-Claude (tanda 314 — el foro, con red debajo)

**Hecho**: pruebas para todo lo que rodea al foro, que era lo último de
la lista que aprobó PINGU y lo que más riesgo tenía: **la sección más
grande del sitio y cada cambio salía a producción a pelo**.

Nueve bloques, y lo que atan no es que «funcione» sino las DECISIONES
escritas en los comentarios del código:

- **Una encuesta no enseña por dónde va antes de que votes.** La más
  importante y la más fácil de perder, porque perderla no rompe nada
  visible. Con votos de OTROS sembrados y cero resultados exigidos.
- Cambiar el voto borra el anterior; sin cuenta se ve pero no se marca;
  de varias respuestas son casillas y no radios; cerrada enseña y no deja.
- **Las menciones y lo que NO es una mención**: un correo no menciona a
  nadie, los párrafos separan, el tope de cinco, y nunca un enlace
  dentro de otro ni dentro de `<code>`.
- **Lo no leído**: si el último mensaje es TUYO no cuenta; sin la
  migración no se marca nada; sin cuenta tampoco.
- **Seguir un tema**, con la vuelta atrás cuando la base lo rechaza.
- **El buscador**, por título y por texto de mensaje, y el aviso de «no
  está activado» en vez de mentir con «no hay nada».
- **La moderación**, que la ve el equipo — `is_admin` O `is_moderator`.

**Lo que hubo que enseñarle al doble** (rama `pruebas`): las tres tablas
de encuestas, el cálculo de `forum_poll_resultados` a partir de ellas (si
lo dijera la semilla, la prueba estrella comprobaría la semilla y no la
pantalla), la columna generada `search_norm`, y
**`window.__SIN_COLUMNAS__`** para fingir que falta UNA columna y no la
tabla entera — que es como se ve una migración a medias.

**Lo que sacó la verificación**:

1. **Dos mutaciones resultaron INERTES**, y eso dice algo del código: las
   dos guardas de «sin migración no marques nada» son red de repuesto
   una de la otra, así que quitar cualquiera de ellas no cambia nada. La
   mutación buena va sobre `hayDatos`, que es el origen.
2. **Fingir la columna que falta con un `Proxy` dejó la página colgada en
   «Cargando…» sin un solo error**: un Proxy que devuelve una función
   para cualquier propiedad hace que `data` y `error` sean las dos
   ciertas, y el cliente ni entra en la rama de error ni se queda sin
   datos.
3. **Y la prueba leía el `.empty-state` del LATERAL** en vez del de la
   columna del buscador. Las comprobaciones de una columna van acotadas
   a su columna.

**Ficheros**: ninguno de la web — esta tanda es solo pruebas. En la rama
`pruebas`: `test-tanda-314.mjs` (NUEVO), `rigor-tanda-314.py` (NUEVO),
`stub-supabase.js` (tablas de encuestas, `forum_poll_resultados`,
`search_norm` y `__SIN_COLUMNAS__`), `correr-suite.sh`.

**Suite**: 75 en verde. **Rigor**: 14 mutaciones, todas detectadas.

**En curso / pendiente**: de la lista que aprobó PINGU ya no queda nada
salvo **el resto de la escala de color** (~500 valores a mano; ojo con
`#fff`, que en oscuro NO es blanco sino la superficie `#182430`). Del
foro siguen sin cubrir las notificaciones por correo, que viven en
disparadores de la base y no en el cliente.

## 2026-09-16 (2) — PINGU-Claude (tanda 313 — lo que no se ve)

**Hecho**: la otra mitad de la lista que aprobó PINGU, la que no sale en
una captura.

- **El salto al contenido** en las 22 páginas con barra. Antes, con
  teclado, había que pasar por los doce enlaces de arriba en CADA página.
- **El `<h1>` que faltaba**: /perfil y /usuario eran las únicas pantallas
  del sitio sin ninguno.
- **«Menos movimiento»**: 12 selectores animaban sin respetar el ajuste
  del sistema, tres de ellos con animación INFINITA. Ahora ninguno.
- **El hueco de las imágenes**, con un método nuevo para las de curso:
  la proporción se mide AL SUBIRLAS y se guarda en el JSON del bloque
  (`image_ratio`), así que no hace falta migración y los bloques viejos
  se quedan como estaban.

**Y dos números míos estaban mal, que también es un resultado**:

1. Dije «44 de 48 imágenes sin tamaño». Eso contaba ATRIBUTOS, no saltos:
   casi todas tienen su caja decidida por CSS, que vale igual. Medido de
   verdad eran **cuatro** — y una de ellas, `.torneo-tarjeta-imagen`, no
   tenía NI UNA regla de CSS: un cartel de 1200 px se comía la fila
   entera del calendario.
2. Dije «7 páginas sin meta description». Son exactamente las siete que
   llevan `noindex`, o sea las que Google no mira. Lo que importa es al
   revés y está bien: las 17 indexables la tienen.

**Lo que sacó la verificación**:

1. **Un fallo de verdad debajo del ajuste de movimiento**: el globo de
   «+puntos» del curso se borra al terminar su animación, y `curso.css`
   ya se la apagaba con «menos movimiento» puesto. Para esa gente el
   `animationend` NO LLEGABA NUNCA y los globos se apilaban en el
   marcador toda la partida. `curso-estimulos.js` ya tenía su red; esto
   no. Ahora la comprobación mira todo lo que se borra al acabar una
   animación, no solo este caso.
2. **La trampa de la 312 volvió a picar dentro de la prueba nueva**:
   buscaba el nombre de una clase con `includes`, y `.x-no` contiene
   `.x`. Un nombre de clase se comprueba ENTERO, con frontera detrás.
3. **Y una mutación se escapaba porque la prueba miraba la llamada y no
   el resultado**: `huecoDeImagen` se daba por buena si el `<img>` la
   invocaba. Ahora la función se ejecuta en la prueba y se mide lo que
   devuelve.
4. **Y la tanda se pasó del presupuesto de `components.css`** (31,1 de
   31 KB). Se hizo sitio en vez de subir el número: el editor de texto
   rico sale a **`css/editor-texto.css` (NUEVO)**, que es chrome de
   EDICIÓN viajando en las 26 páginas. De 31,1 a 29,0 KB y la portada de
   168,0 a **165,9**. Las reglas que agrupan `.article-body` con
   `.rte-surface` se quedan: partirlas sería duplicarlas. `test-tanda-299`
   cazó que a `/torneo` se le había olvidado la hoja nueva.
5. **Y el propio enlace de salto cayó en las dos normas de las tandas
   anteriores**, cazado por `test-tanda-311` y `test-tanda-312`: fondo
   `var(--navy)` con blanco encima daba 2,35 en oscuro (el token se
   aclara a propósito, como con `--danger-solid`), y medía 40 de alto en
   vez de 44.

**Ficheros**: las 22 páginas `.html` (el salto), `css/style.css`,
`css/components.css`, `css/curso.css`, `css/torneos.css`,
`css/lanzamientos.css`, `css/foro.css`, `css/perfil.css`, `js/perfil.js`,
`js/usuario.js`, `js/curso.js`, `js/block-editor.js`,
**`css/editor-texto.css` (NUEVO)**, `admin/editor-guia.html`,
`SCHEMA.md`, `CLAUDE.md`. En la rama `pruebas`: `test-tanda-313.mjs` (NUEVO),
`rigor-tanda-313.py` (NUEVO), `correr-suite.sh`.

**Suite**: 74 en verde. **Rigor**: 14 mutaciones, todas detectadas.
**Peso de la portada**: 165,9 KB gzip de 170, y `components.css` en 29,0
de los 31 que vigila la prueba.

**En curso / pendiente**: de la lista aprobada quedan los **502 colores a
mano** y el **foro sin cobertura de pruebas** (encuestas, no leídos,
suscripciones, búsqueda, menciones, moderación). El presupuesto de la
portada vuelve a tener aire: 4,1 KB.

## 2026-09-16 — PINGU-Claude (tanda 312 — las seis mejoras visuales)

**Hecho**: las seis que eligió PINGU con los prototipos delante (cada una
montada ENCIMA de la página real, no dibujada aparte).

1. **La franja de color de la tarjeta de guía** eran 100 px vacíos —un
   tercio de la tarjeta— y la CATEGORÍA no salía en la tarjeta por ningún
   lado, aunque los chips de arriba filtren por eso. Ahora lleva
   categoría y minutos. Y la barra de progreso se pinta SIEMPRE, con el
   relleno a cero: antes aparecía y desaparecía y descuadraba la rejilla.
2. **El pie de página**, de una línea a cuatro columnas en las 22 páginas
   que lo tienen. Pero el fallo de debajo no era el pie: `.page-content`
   llevaba `min-height: 100vh`, así que el contenido medía una pantalla
   entera con una sola tarjeta dentro y el pie caía detrás de 500 px de
   nada. El cuerpo pasa a columna flexible.
3. **Los números de /comunidad**: de cuatro tarjetas sueltas a un bloque
   con separadores, la mitad de alto y con el número mandando.
4. **«Lo que acaba de pasar»**: cinco filas que empezaban por «Nueva
   noticia:» y con el MISMO icono a izquierda y derecha. Ahora el tipo es
   una chapa y el icono de la derecha solo sale si a la izquierda hay una
   cara.
5. **La noticia sin foto** se pintaba al 45% de opacidad: un rectángulo
   pálido con un icono diminuto, o sea, el aspecto exacto de una imagen
   rota. Ahora es el degradado de la marca con su sello.
6. **Los objetivos táctiles**: de 143 medidos a 393 px, 18 clases por
   debajo de 44, y la barra de arriba ENTERA (35×35, 34×34, 30×30, el
   logo a 26). Ahora quedan tres, que son las excepciones que la propia
   WCAG admite y están declaradas en la prueba.

**Lo que sacó la verificación**:

1. **La suite cazó lo que se me pasó**: con un torneo EN JUEGO la barra
   lleva un pasajero más y con todo a 44 px dejaba de caber — la página
   se salía de lado a 320, 360 y 390. Lo vio `test-torneos-15`. De paso
   se vio que con esa chapa el LOGO se encogía a 2 px, y eso ya pasaba
   antes.
2. **Cuatro mutaciones del rigor estaban mal puestas** y enseñan más que
   las buenas: `hidden` no esconde un elemento cuya clase pone
   `display: flex`; dos cortaban a media regla y dejaban la otra mitad
   del arreglo en pie; y una cambiaba una clase que la prueba no miraba.
3. **Y un agujero de verdad**: la prueba buscaba `pie-rejilla` como
   trozo de texto, y `pie-rejilla-no` también casa. Un nombre de clase se
   comprueba ENTERO y entre comillas.
4. **La propia tanda se saltó la norma de la 299**: el bloque de
   `pointer: coarse` nació entero en `components.css` con clases del
   foro, del perfil, de /comunidad, de /aprender y de torneos dentro. Lo
   cazaron `test-tanda-299` y `test-tanda-306`. Al repartirlo se destapó
   que `components.css` se había pasado de los 31 KB, así que se hizo
   sitio de verdad: **`css/auth.css` (NUEVO)** con la pantalla de entrar
   —la usan tres páginas y viajaba en las 26— y las doce reglas de
   `/admin` a `admin/css/admin.css`. De 31,5 a 30,9 KB.
5. **Y el barrido de extracción se llevó seis reglas ajenas** —el
   `.block-highlight` y la familia `.article-sidebar`— porque el patrón
   arrastraba el comentario de delante. Lo vio `test-tanda-299` otra vez:
   al mover reglas de hoja hay que pasarla DESPUÉS de cada movimiento.

**Ficheros**: las 22 páginas `.html` (el pie), `css/style.css`,
`css/components.css`, `css/aprender.css`, `css/comunidad.css`,
`css/noticias.css`, `css/foro.css`, `css/portada.css`, `css/perfil.css`,
`css/torneos.css`, **`css/auth.css` (NUEVO)**, `admin/css/admin.css`,
`js/aprender.js`, `js/activity.js`, `js/theme.js`, `SCHEMA.md`,
`CLAUDE.md`. En la rama
`pruebas`: `test-tanda-312.mjs` (NUEVO), `rigor-tanda-312.py` (NUEVO),
`correr-suite.sh`.

**Suite**: 73 en verde. **Rigor**: 19 mutaciones, todas detectadas.
**Peso de la portada**: 167,2 KB gzip de 170, y `components.css` en 30,9
de los 31 que vigila la prueba. Queda poco: el pie nuevo va en las 22
páginas y suma. Antes de meter nada más en la portada hay que hacer
sitio, y el camino es el de siempre — sacar a su hoja lo que solo usa una
pantalla.

**En curso / pendiente**: nada a medias. De la lista que aprobó PINGU
quedan: las imágenes sin tamaño declarado (44 de 48), el enlace de
«saltar al contenido» y el `<h1>` de /perfil, los 502 colores a mano, las
7 páginas sin `meta description`, el `prefers-reduced-motion` que le
falta a `components.css`, y el foro sin cobertura de pruebas.

## 2026-09-15 (10) — PINGU-Claude (tanda 311 — que todo se lea)

**Hecho**: las tres mejoras que la 310 dejó pendientes a propósito, que
eran justo las que podían romper algo.

- **El contraste, medido en las dos pantallas.** Un barrido abre ocho
  páginas en claro y en oscuro, busca el fondo REAL de cada texto
  (degradados incluidos) y calcula el ratio. Tres familias de fallo: el
  azul del tema oscuro se quedaba en 4,17 en 45 reglas (`--navy` de
  `#4a90c2` a `#6fb0dc` → 6,14, comprobando antes que las 32 reglas donde
  hace de FONDO mejoran también, de 4,54 a 7,20); doce controles que se
  pulsan —«Eliminar», «Responder», «Denunciar», las flechas del reto,
  las pestañas del torneo— iban con el gris de los apuntes, 2,35 → 4,84;
  y el mensaje de un muro vacío, 2,21. Ahora el barrido da **0 en los dos
  temas**.
- **El rojo tiene nombre.** No existía `--danger`: iba a mano 61 veces,
  en tres tonos, hasta en estilos en línea del JavaScript, y ninguno se
  adaptaba al tema (3,26 en oscuro). Tres tokens: `--danger` (texto y
  bordes), `--danger-bg` (fondo de aviso) y `--danger-solid` (el rojo que
  va de fondo CON TEXTO BLANCO encima, que a propósito **no** se aclara
  en oscuro). De paso caen seis bloques `[data-theme='dark']` que
  existían solo para dar la versión clara de un rojo.
- **El espaciado, la otra mitad.** Los pares intermedios que la 310 dejó
  fuera: **792 cambios** (10→12 ×267, 6→8 ×209, 14→16 ×137, 18→16 ×71,
  20→24 ×51…) más nueve valores grandes elegidos a ojo. La regla que
  queda: hasta 32 px es un PASO de la escala y tiene que ser uno de los
  seis; por encima es una MEDIDA y solo se le pide la retícula de 4.

**Lo que sacó la verificación** (los tres en SCHEMA.md con detalle):

1. El barrido de rojos pasó por `style.css` y dejó
   `--danger: var(--danger)` — un token que se nombra a sí mismo queda
   SIN definir y no da error. Hay comprobación general nueva.
2. El mismo barrido metió `var(--danger)` en `COLORES_AVATAR`, que no es
   semántica sino la paleta de IDENTIDAD del avatar: el color de una de
   cada diez personas cambiaba al cambiar de tema, con la inicial blanca
   encima en 2,4.
3. El espaciado rompió una caja, que era el riesgo anunciado: el nombre
   del próximo torneo de la portada se partió en dos renglones. La prueba
   mide ahora que la portada no se salga de ancho a 320 y a 1280.
4. Al aclarar el azul aparecieron **24 bloques `[data-theme='dark']` que
   existían solo para aclarar `--navy` a mano**. Fuera 19 enteros (y de
   cinco se quita solo el azul). Ahí estaba escondido un fallo que
   llevaba tiempo en producción: la chapa de «EN JUEGO» salía con el
   texto AZUL sobre el rojo en el tema oscuro —**2,2**— porque el bloque
   del tema tiene tres componentes de especificidad y la regla que ponía
   el blanco solo dos. **Un bloque de tema no es «lo mismo más claro»:
   es una regla que compite.**

**Ficheros**: `css/style.css`, `css/components.css`, `css/torneos.css`,
`css/curso.css`, `css/foro.css`, `css/perfil.css`, `css/portada.css`,
`css/partidas.css`, `css/aprender.css`, `css/comunidad.css`,
`css/noticias.css`, `css/lanzamientos.css`, `js/perfil.js`,
`js/wall.js`, `SCHEMA.md`, `CLAUDE.md`. (`js/app.js` NO: el barrido de
rojos le metió `var(--danger)` en `COLORES_AVATAR` y se deshizo.) En la rama `pruebas`:
`test-tanda-311.mjs` (NUEVO), `rigor-tanda-311.py` (NUEVO),
`correr-suite.sh`, `aud-contraste.mjs`.

**Suite**: 72 pruebas en verde. **Rigor**: 14 mutaciones, todas
detectadas. **Peso de la portada**: 164,0 KB gzip de 170.

**En curso / pendiente**: nada a medias. Sigue abierto de tandas
anteriores: el resto de la escala de color (quedan ~500 colores a mano
en 219 valores distintos; **ojo con `#fff`, que aparece 59 veces y NO se
puede sustituir en bloque** porque en oscuro `--white` es la superficie
oscura `#182430`) y las piezas del foro sin cobertura de pruebas
(encuestas, no leídos, suscripciones, búsqueda, menciones, moderación).

## 2026-09-15 (9) — PINGU-Claude (tanda 310 — espaciado, desplegables y estados vacíos)

**Hecho**: seis mejoras visuales, todas medidas sobre el código antes de
proponerlas.

- **La escala de espaciado**: había 31 valores distintos y **226
  IMPARES** (3, 5, 7, 9, 11, 13…), los mismos «medio pasos» que tenían
  los tamaños de letra antes de la 305. Redondeados al par siguiente
  (+1 px no se ve y nunca aprieta nada) y **seis pasos como tokens**
  (`--e-xs`…`--e-2xl`) para lo que se escriba a partir de ahora.
  **PENDIENTE a propósito**: llevar también los pares intermedios (10 px
  ×132, 6 ×103, 14 ×51) a la escala son ±2 px en 400 declaraciones, y eso
  sí puede romper una caja justa. Con capturas de antes y después
  delante.
- **Los desplegables**: 34 `<select>` y ni un `appearance: none`, o sea
  que el navegador ponía su flecha y su altura. Ahora son del sitio, con
  DOS flechas (una por tema: el color va dentro del SVG).
- **Los estados vacíos**: `.empty-state` era una frase gris centrada en
  58 sitios. Ahora tienen cuerpo — caja punteada, que dice «vacío» y no
  «a medio cargar».
- **Transiciones**: de nueve duraciones a dos. **Sombras**: los cuatro
  paneles flotantes compartían cuatro sombras casi iguales; ahora usan
  `--shadow-lg`, un token que `components.css` YA pedía con respaldo y
  que nadie había definido.
- **La ficha de torneo** pintaba una barra de UNA sola pestaña. Se
  esconde por debajo de dos.
- **17 imágenes** que pinta el JS no pedían carga diferida.

**Ficheros**: las once hojas de `css/` (espaciado), `css/style.css`
(selects, estados vacíos, tokens), `js/torneos/torneo.js`, y 17 módulos
de `js/` (lazy). En la rama `pruebas`: `test-tanda-310.mjs` y
`rigor-tanda-310.py` (NUEVOS).

**Suite 71/71, rigor 11/11** — las dos encontraron algo:
- La suite: el barrido de carga diferida metió `loading="lazy"` en el
  cuerpo de un mensaje de foro, **que se guarda en la base**, y en la
  imagen del lightbox, que es la que acabas de pulsar. Una
  transformación en bloque sobre «todos los `<img>`» da por hecho que
  todo lo que parece markup lo es.
- El rigor: un regex codicioso (`[^}]*box-shadow`) encontraba la ÚLTIMA
  sombra del bloque, así que una a pelo añadida delante pasaba.

**En curso / pendiente**: la segunda mitad de la escala de espaciado (ver
arriba). Nada a medias.

---

## 2026-09-15 (8) — PINGU-Claude (tanda 309 — el destello de la guía, el menú y la escala de bordes)

**Hecho**: cuatro cosas que salieron de una tanda de ideas de PINGU. Dos
de ellas **no eran decisiones de diseño, eran fallos**:

- **El destello al abrir una guía.** No es lentitud: se pinta dos veces y
  la primera sale SIN ESTILO. La función de servidor (`meta-social.js`)
  inyectaba el `<h1>` y los bloques sueltos dentro de `<article>`, y toda
  la tipografía del artículo cuelga de `.article-body`. Ahora el servidor
  emite los MISMOS envoltorios que el cliente, así que el primer pintado
  ya es el bueno. **Si cambias esas clases en `js/guia.js`, cámbialas
  también en el edge function: las dos mitades pintan lo mismo.**
- **El menú.** Ya tenía marca de sección… que solo se encendía en la
  portada: comparaba el último trozo de la URL con el `href` tal cual, y
  con direcciones limpias `'noticias' === '/noticias'` es falso. Por eso
  parecía texto plano con hover. Arreglado y subido a pastilla rellena,
  solo en el apartado activo.
- **El desplegable del perfil**: de ocho cosas a cinco. «Mis torneos»
  fuera (ya es una pestaña con contador, y se llega desde «Jugar»);
  «Enviar feedback» AL PIE, no borrado — se monta desde el JS en un solo
  sitio, no en las 26 páginas.
- **La escala de bordes**: nueve grosores haciendo el trabajo de dos. Un
  contorno es de 1px o de 2px, y 54 sustituciones. Las barras de cita
  (`border-left`) y los bordes que DIBUJAN algo (la lupa, el canto de una
  carta) quedan fuera a propósito. Y 15 radios que ya valían lo que un
  token pasan al token.

**Retiré una idea mía**: dije que el foro seguía siendo «una tarjeta por
tema» y es falso — la 299 ya lo pasó a filas. Lo dije de memoria sin
mirar el CSS.

**Ficheros**: `netlify/edge-functions/meta-social.js`, `js/app.js`,
`css/style.css`, `css/components.css`, y las otras nueve hojas (bordes y
radios), `SCHEMA.md`.
En la rama `pruebas`: `test-tanda-309.mjs` y `rigor-tanda-309.py` (NUEVOS).

**Dos cosas de la verificación**: el guardián de peso saltó
(`components.css` se pasó de 31 KB). En vez de subir el número, que es lo
que convierte un presupuesto en un adorno, se buscó grasa y la había:
**CSS muerto** — la tarjeta de persona vieja que sustituyó la tanda 301 y
nadie borró, nueve reglas que bajaba todo el mundo sin usarlas. Y el
rigor cazó un hueco en la prueba nueva: medía solo el párrafo, así que
quitar el envoltorio de la CABECERA pasaba desapercibido.

**En curso / pendiente**: nada a medias.

---

## 2026-09-15 (7) — PINGU-Claude (tanda 308 — pestañas con cuenta, esqueletos de lista y el hueco de pruebas)

**Hecho**: cuatro mejoras de las cinco que propuse. La quinta la retiré:
dije que el foro seguía siendo «una tarjeta por tema» y **no es verdad**,
la 299 ya lo pasó a filas. Lo dije de memoria sin mirarlo.

- **Las pestañas del perfil** llevan su cuenta y se abre **la que tiene
  algo**: «Muro» era siempre la primera y en casi todos los perfiles está
  vacía. Quien mira manda: un `#hash` gana siempre, y si ya has pulsado
  tú una pestaña la página no te mueve cuando terminen de llegar las
  cuentas (`event.isTrusted` distingue tu clic del suyo).
- La mecánica estaba **copiada en perfil.js y usuario.js** y pasa a
  `js/perfil-pestanias.js`.
- **`/noticias` y `/aprender` cargan con la silueta de lo que enseñan**:
  la de la 305 tiene forma de ARTÍCULO y esas dos son rejillas de
  tarjetas. Dos formas nuevas, vertical y horizontal.
- **El hueco de pruebas**: `/noticias` y las fichas de guía y curso no
  tenían NINGUNA. Ya las tienen.

**Dos cosas que le faltaban al doble** y que conviene que sepas, porque
las dos hacían que una prueba viera un sitio que no existe:

1. **No tenía la tabla del muro** (`profile_comments`): estaba siempre
   vacío, así que el caso «tiene algo, no me muevas» no se podía probar.
2. **No resolvía los `select` embebidos** (`categories(name, slug)`).
   Devolvía las filas sin la relación, así que la página se portaba como
   si la guía no tuviera categoría — sin dar error. Ahora se resuelven
   con las relaciones declaradas en el propio doble.

**Ficheros**: `js/perfil-pestanias.js` (NUEVO), `js/perfil.js`,
`js/usuario.js`, `js/wall.js` (renderWall devuelve la cuenta),
`js/foro-actividad.js`, `css/components.css`, `noticias.html`,
`aprender.html`, `SCHEMA.md`.
En la rama `pruebas`: `test-tanda-308.mjs`, `test-noticias.mjs`,
`test-ficha-guia.mjs`, `rigor-tanda-308.py` (los cuatro NUEVOS) y el
doble (`stub-supabase.js`).

**Suite 69/69. Rigor 11/11**, pero a la segunda: tres comprobaciones
pasaban con el código roto porque medían algo distinto de lo que creían
—una carrera que iba al revés de lo que supuse, y un icono de ancho cero
que está «a la izquierda» de todo—, y dos mutaciones tenían el ancla
repetida. Está contado en SCHEMA.md.

**En curso / pendiente**: nada a medias.

---

## 2026-09-15 (6) — PINGU-Claude (tanda 307 — la pestaña «Foro» del perfil, rota desde la 299)

**Hecho**: PINGU mandó una captura del perfil nuevo: «se ha roto». La
pestaña «Foro» salía sin una sola regla de CSS — «58Mensajes» pegado, las
listas en crudo.

**No fue la 306: llevaba roto desde la tanda 299.** `.foro-act-*` se mudó
entonces a `foro.css` y lo pinta `js/foro-actividad.js`, que solo usan
`/perfil` y `/usuario`, que NO cargan esa hoja. Tercera víctima de aquella
mudanza, después de la portada y de `tema.html`.

**Por qué no lo cazó el barrido de las 26 páginas**: seguía `from '…'`, y
`foro-actividad.js` entra por un **`import()` dinámico**. La prueba se
paraba justo antes del módulo que tenía el fallo.

**Lo importante del arreglo no es mover el CSS**, es que ahora la prueba
comprueba que **el barrido LLEGA**: todo lo demás sale verde igual si se
queda a medio camino, porque de una página de la que no recoges ninguna
clase no puedes decir que tenga ninguna huérfana. El rigor lo confirma
devolviéndole el regex viejo a la propia prueba.

**Y un fallo invisible**: `var(--slate)` — una variable que NO se define
en ninguna parte, en cuatro sitios. No da error: la propiedad se cae y el
texto hereda el color del padre. Pasan a `--text-mid`, y hay prueba nueva
para que no vuelva a colarse una.

**Ficheros**: `css/foro.css`, `css/perfil.css`, `css/components.css`,
`SCHEMA.md`. En la rama `pruebas`: `test-tanda-299.mjs` (barrido
recursivo + dinámico, comprobación de alcance, variables fantasma),
`test-tanda-306.mjs` (mismo regex), `rigor-tanda-307.py` (NUEVO).

**En curso / pendiente**: nada a medias.

---

## 2026-09-15 (5) — PINGU-Claude (tandas 304, 305 y 306 — la tanda visual)

**Hecho**: el encargo era «quiero una interfaz más moderna, que no se vea
tan pocho» + «la lista de usuarios, como ya son 200, hay que scrollear
demasiado» + «además ibas a mejorar los perfiles, ¿verdad?». Tres tandas:

- **304 — /usuarios**: salen 10 personas y un botón «Ver N personas más»
  que despliega el resto sin ir a la base. Al BUSCAR no se recorta (si no,
  el recorte esconde justo lo que has buscado). Y de camino, un fallo
  gordo: `(filas || [])` daba por bueno un objeto de error, así que si
  `forum_posts` no respondía se caía la lista de gente ENTERA por un
  contador de mensajes. Ahora `Array.isArray`.
- **305 — la escala tipográfica**: había 36 tamaños de letra en 596
  declaraciones, con pasos de MEDIO píxel. Ocho pasos (`--t-2xs`…`--t-3xl`)
  y 592 sustituciones, más 23 que se colaban por `style="font-size:…"`.
  **Si te hace falta un tamaño que no está, casi siempre es que el sitio
  pide otro paso: mételo en `:root`, no escribas un número suelto.** Y las
  guías y cursos cargan con un ESQUELETO CON FORMA de artículo (titular,
  firma, párrafos) en vez de un «Cargando guía…» en gris.
- **306 — los perfiles y los inscritos**: la ficha de una persona era
  tres cajas (cabecera + botones flotando con estilos en línea + rejilla
  de tarjetas de estadística); ahora es UNA tarjeta con una tira de cifras
  al pie. `.stats-row` y `.stat-card` ya no existen. Y la lista de
  inscritos de un torneo tiene avatares, en la misma consulta que ya se
  hacía.

**Dos cosas que conviene saber si tocas esto**:

1. **~300 líneas de CSS de perfil se han mudado** de `components.css` a
   `perfil.css`. Al mudarlas, `.profile-hero-banner { height: 160px }` llegó
   DESPUÉS de `.profile-hero-banner-vacio { height: 96px }` y le ganó por
   orden de cascada: el banner vacío volvió a los 160 px sin dar error.
   **Mudar una hoja no es solo mirar qué clases quedan huérfanas: hay que
   mirar contra qué chocan al llegar.**
2. La tira de cifras usa **`display: contents`** en `#profileStats`. Eso
   convierte a cualquier vecino suyo en una celda más de la fila — el
   panel de «Invita a un amigo» aterrizó en medio de los números. **No
   cuelgues nada de `#profileStats`**; cuelga de `#profileHero`.

**Ficheros**: `css/style.css`, `css/components.css`, `css/perfil.css`,
`css/torneos.css`, `css/comunidad.css` y las otras siete hojas (escala),
`usuario.html`, `perfil.html`, `usuarios.html`, `guia.html`, `curso.html`,
`index.html`, `onboarding.html`, `sobre.html`, `js/usuario.js`,
`js/perfil.js`, `js/usuarios.js`, `js/torneos/torneo.js`, `js/wall.js`,
`js/mensajes.js`, `js/curso.js`, `js/categoria.js`, `js/onboarding.js`,
`js/block-editor.js`, `js/torneos/aviso-torneo.js`.
En la rama `pruebas`: `test-tanda-305.mjs` (NUEVO), `test-tanda-306.mjs`
(NUEVO), `rigor-tanda-305.py` (NUEVO), `rigor-tanda-306.py` (NUEVO),
`test-tanda-301.mjs` (bloque 6 nuevo).

**Rigor**: 11/11 en la 306 y 10/10 en la 305 — pero la 305 necesitó dos
pasadas: dos mutaciones pasaron a la primera porque el listón estaba
puesto a ojo (leer la escala sin quitar los comentarios, y «al menos
cuatro renglones» cuando había que comprobar dos párrafos de tres).

**En curso / pendiente**: nada a medias. Siguen SIN cobertura de pruebas
las fichas de guía y de curso (más allá de su esqueleto), los perfiles
más allá de la tanda 306 y `/noticias`.

---

## 2026-09-15 (4) — PINGU-Claude (tanda 303 — el foro roto, y la prueba que miraba a otro lado)

**Hecho**: PINGU mandó una captura — «importante, el foro esta roto» — y
lo estaba: la VISTA DE UN TEMA salía en producción sin una sola regla de
CSS. Mensaje, columna del autor, citas, reacciones y la barra del editor,
todo en crudo.

**La causa es mía y de la tanda 299**: saqué 191 bloques de CSS del foro
de components.css a foro.css para que no los bajara todo el mundo,
comprobé la portada y foro.html, y **tema.html no carga foro.css**.

Y lo peor: **la 299 escribió una prueba para exactamente este fallo** —
recorrer las clases que pinta una pantalla y comprobar que tienen regla
en una hoja que esa pantalla carga— y la escribí MIRANDO SOLO LA PORTADA.
Pasaba en verde con el foro roto.

**El barrido de las 26 páginas** sacó dos más:
- **usuarios.html** usaba `.seccion-cabecera`, que vive en portada.css y
  Comunidad no carga: el título «Gente de PokeDoc», sin estilo. Es de la
  tanda 301 — el mismo fallo, otra vez, dos tandas después. La regla se
  muda a components.css.
- **mis-partidas.html**: el botón «Ver N más» salía pegado a la izquierda
  porque `.torneo-ver-mas` vive en torneos.css, que esa página no carga.
  Dos líneas en partidas.css; traerse 30 KB de hoja por un margen, no.

**La prueba recorre ahora las 26 páginas** y, cuando falla, NOMBRA la
página y las clases. Verificada quitando otra vez la hoja de tema.html:
se pone roja. Y el fallo entra como mutación del rigor.

**La lección**: una prueba escrita contra el caso que acabas de arreglar
no vale; hay que escribirla contra LA FORMA del fallo. «La portada no se
queda sin reglas» y «ninguna página se queda sin reglas» se parecen mucho
y no son lo mismo — y la diferencia fue un foro roto en producción.

**Limpieza**: tres mutaciones del rigor de la 299 apuntaban a código que
la 300 sustituyó. Quitadas — una mutación con el ancla rota se cuenta
como «sin detectar» y tapa las de verdad.

**Ficheros**: tema.html, usuarios.html (vía css), css/components.css,
css/portada.css, css/partidas.css, SCHEMA.md, CLAUDE.md.

**En curso / pendiente**: el perfil de una persona y la cobertura de
/noticias y la ficha de guía.

---

## 2026-09-15 (3) — PINGU-Claude (tanda 302 — el torneo al canal, a mano)

**Hecho**: PINGU preguntó por qué la Pachanga inaugural no había salido
por el canal de Telegram, y la causa no era la que parecía.

**No faltaba la función**: `telegram-torneos.mjs` existe desde la 287 y
corre cada cinco minutos. El fallo estaba en SU MIGRACIÓN, que copió de
las noticias la «red del estreno» — `update tournaments set
telegram_sent_at = now() where telegram_sent_at is null`. En noticias esa
línea es correcta: una noticia publicada está en el PASADO y soltar el
archivo el día del estreno hace que la gente silencie el canal. **Un
torneo apunta al FUTURO**: el que tiene las inscripciones abiertas y
fecha por delante es justo el que hay que anunciar, y quedó marcado como
mandado sin haberlo estado. Le pasó a la Pachanga — no era privada, se
veía, tenía cinco inscritos, y no salió.

Migración corregida: la red del estreno solo marca lo que YA NO se puede
anunciar. Y con eso deja de ser una trampa: decía «se puede volver a
ejecutar sin romper nada» cuando volver a pasarla silenciaba de golpe
todo lo pendiente.

**Y el agujero de debajo**: las noticias tienen botón de «mandar a mano»
desde la 282, hecho por este mismo motivo. A los torneos se les puso el
envío automático y NO esa red, así que cuando falla no hay ni segunda vía
ni forma de enterarse — el error de una función programada se queda en el
registro de Netlify. Ahora `telegram-mandar` atiende a los dos y la ficha
tiene su botón, para el admin del SITIO (no para quien lleva el torneo:
escribir en el canal oficial es del mismo tipo que el sello de OFICIAL).
Un torneo privado no sale ni forzando.

**El diagnóstico** va en el propio botón: dice si ya consta mandado,
cuándo, y avisa de que los torneos que ya existían al poner el canal
constan mandados sin haberlo estado. Es lo que contesta la pregunta de
PINGU sin abrir Netlify.

**Ficheros**: netlify/functions/telegram-mandar.mjs, js/torneos/torneo.js,
supabase-migration-telegram-torneos.sql, SCHEMA.md.

**PINGU**: la Pachanga sigue marcada como mandada por la migración vieja.
Para anunciarla, entra en su ficha y pulsa **«Mandar al canal otra vez»**.

**Pruebas**: test-tanda-302.mjs (NUEVA, 7 bloques, 38 comprobaciones). El
rigor pilló que el bloque del botón LEÍA EL CÓDIGO en vez de abrir la
página: con la llamada a `pintarTelegram` borrada pasaba igual, porque el
texto seguía dentro de una función que ya no llamaba nadie. Reescrito con
navegador.

**En curso / pendiente**: sigue pendiente el perfil de una persona (es
adonde lleva todo lo de Comunidad) y la cobertura de /noticias y la ficha
de guía.

---

## 2026-09-15 (2) — PINGU-Claude (tanda 301 — la comunidad)

**Hecho**: /usuarios, que PINGU dijo que «no se usa demasiado». Y no se
usaba por cuatro razones concretas: era una columna estrecha centrada,
abría por «Guías de la comunidad» (la página se llama Comunidad y lo
primero era una lista de documentos), las tarjetas repetían «Novato ·
0 XP» en todas con marco dorado en las tres primeras, y no había nada
que hacer ni motivo para volver.

Ahora abre por GENTE y a ancho completo. **Los números arriba**
—miembros, mensajes de la semana, guías vuestras y rachas VIVAS hoy—,
que son lo único que demuestra que aquí hay alguien. **Podio del mes**
en azul, con la XP ganada desde el día 1 (`xp_mes`) y no la total: por XP
total ganaría siempre quien lleva más tiempo aquí, y entonces no le daría
a nadie un motivo para aparecer. **Pestañas como chips** con su cuenta,
igual que /aprender y /torneos (conservan `data-ctab`, así que el ancla y
el botón de atrás siguen igual). **Las tarjetas dicen qué ha hecho cada
uno** («3 guías · 211 mensajes») y su racha; quien no ha hecho nada dice
«Acaba de llegar», no ceros. Y una lateral con quién anda por aquí hoy.

**Dos cosas que descubrió la prueba, no yo**:
- una tabla que falta **tumbaba la lista de gente entera** — `(x || [])`
  no basta cuando lo que llega no es nulo sino otra cosa; hace falta
  `Array.isArray`. Y la lista de gente ES la página;
- «por aquí hoy» solo puede estar vacío SIN cuenta: al entrar con sesión
  tu propia visita te marca activo hoy (`checkDailyStreak`).

**Y un susto que merece quedar escrito**: el contenedor se reinició a
mitad del rigor de esta tanda y dejó `usuarios.html` CON LA MUTACIÓN
PUESTA — el chip de «Gente» sin su `active`—, con el árbol de git con
pinta de estar listo para subir. El `finally` del script cubre las
excepciones, no que la máquina se muera. Si llego a commitear en ese
momento, eso sale a producción.

Arreglado de raíz: el andamio común de los rigores (`rigor_comun.py`)
guarda el contenido original en disco ANTES de tocar nada y lo deshace
solo al arrancar la siguiente pasada, y `comprobar-arbol.sh` canta si
queda algo a medias. Se pasa antes de cada commit. Está anotado en
CLAUDE.md.

**Ficheros**: usuarios.html, js/usuarios.js, css/comunidad.css (NUEVO),
CLAUDE.md, SCHEMA.md.

**Pruebas**: test-tanda-301.mjs (NUEVA, 8 bloques, 51 comprobaciones). La
que más trabaja es la del podio: el fixture le da a Ash más XP TOTAL que
a Misty pero menos ganada este mes, así que cambiar el cálculo mueve el
oro y se ve. El doble gana `__FAKE_PERFILES__` (mezcla por id, para no
romper las cinco personas fijas) y `__FAKE_XP_MES__` con su tabla.

**En curso / pendiente**: el perfil de una persona sigue con la pinta
vieja, y es adonde lleva todo lo de Comunidad — el salto se nota en el
primer clic. Sin cobertura: fichas de guía y curso, perfiles y /noticias.

---

## 2026-09-15 (1) — PINGU-Claude (tanda 300 — la portada, en dos columnas de verdad)

**Hecho**: lo que le faltaba a la F de la 299. PINGU, al verla en
producción: «la portada no ibas a tocar más? es muy parecida». Tenía
razón: en la 299 vi que ya existía el panel de dos columnas y **decidí
por mi cuenta que F era más pequeña de lo que prometía la maqueta
aprobada**. Se movió la fila de arriba y de ahí para abajo la portada
siguió siendo la torre de bloques de siempre.

**El reparto**: lo que PASA en la columna ancha (destacada, foro, guías
nuevas, temas), lo TUYO en la estrecha (torneo, primeros pasos,
comunidad, liga, top del mes, lanzamiento). Y la fila de «hoy» pasa a
usar las MISMAS dos columnas que el panel, para que los bordes cuadren.

**«Explora por tema» → fila de chips**, y este es el cambio con más razón
detrás. Lo dijo PINGU: con 16 guías en 6 categorías, entrar en una te
deja en una página con dos guías — el vacío que la 299 quitó de
/aprender. Así que los chips NO llevan a categoria.html: llevan a
`/aprender.html?tema=<slug>` con el filtro puesto. Se ordenan por número
de guías y la categoría con cero no sale. Las páginas de categoría siguen
existiendo para enlaces directos.

**El torneo** pasa de fila fina gris a tarjeta navy con el día en un
recuadro y «Apuntarme». **El foro** saca la cuenta de mensajes a la
derecha, en grande. **Las guías nuevas** suben del fondo a la columna
principal, pasan de 3 a 4 y estrenan portada de color (la de /aprender),
con la rareza encima y en español. **Los primeros pasos** bajan a la
lateral con barra. **Los dos atajos se van.**

Los seis degradados de portada y `arteDe` pasan a ser COMPARTIDOS
(components.css y app.js): los usan /aprender y la portada, y duplicarlos
en dos hojas habría sido el fallo de la 299 otra vez.

**Un fallo que me hice yo solo y cazó la prueba**: al cuadrar la fila de
«hoy» con el panel la pasé de flex a rejilla, y una rejilla de dos
columnas no encoge sola — sin noticia quedaban 320 px en blanco al lado
del reto, un caso que la 299 SÍ resolvía. Arreglado con
`.seccion-recogida` + `:has()`.

**Ficheros**: index.html, js/home.js, js/aprender.js, js/app.js,
js/primeros-pasos.js, css/portada.css, css/components.css,
css/aprender.css, SCHEMA.md.

**Pruebas**: test-tanda-300.mjs (NUEVA, 8 bloques, 48 comprobaciones) y
test-tanda-299 reapuntado —su bloque 8 miraba `#categoriesGrid`, que ya
no existe; lo que vigila (que ningún color salga de un hash ni pinte el
marco entero) no cambia, solo dónde se lee—.

**Peso**: 159,9 KB gzip de los 170. **Quedan 10 KB de margen**: menos que
antes, y quien toque la portada otra vez tiene que mirarlo.

**En curso / pendiente**: lo siguiente es COMUNIDAD (/usuarios), con
maqueta ya aprobada: números arriba, podio del mes, pestañas como chips
con su cuenta y tarjetas de persona que digan qué ha hecho cada uno. Hoy
esa página abre por «Guías de la comunidad» en una columna estrecha y no
la usa nadie.

---

## 2026-09-14 (8) — PINGU-Claude (tanda 299 — D, E y F: foro, aprender y portada)

**Hecho**: lo que quedaba del rediseño después de torneos, las tres a la
vez («me convence, todo perfecto, dale con todo a la vez»). Sin tocar la
base: ni una tabla, ni una política, ni una RPC.

**D — el foro** abre con «Lo que se está hablando»: los tres temas con
mensaje más reciente, a ancho completo, uno por tema. El «Lo último» del
lateral se va (era lo mismo, en 280 px y con los títulos cortados a
media palabra) y el lateral se queda con los números. La fila de subforo
reparte distinto: el último tema pasa de 210 px a llevarse tanto como el
nombre del foro, y los números bajan de 120 a 96.

**Y 191 bloques de CSS del foro salen de `components.css`** —que lo baja
todo el mundo, hasta quien solo entra a la portada— a `css/foro.css`: de
36,1 a 30,2 KB gzip, **5,9 KB menos en CADA página**. Comprobado pixel a
pixel antes y después.

Esa mudanza me salió mal DOS veces, las dos cazadas por las pruebas:
`.foro-vivo*` («Ahora en el foro») lo pinta la PORTADA, que no carga
`foro.css` — la sección se quedó sin estilo; y el `@media` de móvil del
foro se quedó en `components.css` mientras su base se mudaba, y como un
`@media` no suma especificidad y `components.css` carga primero, el
índice del foro dejó de apilarse en el móvil y la lateral se salía de la
pantalla a 320 px. De ahí dos pruebas nuevas que no miran una pantalla
sino la ESTRUCTURA: que ninguna clase de la portada se quede en una hoja
que la portada no carga, y que no quede ningún `@media` del foro en
`components.css`.

**E — /aprender** era tres cajas que solo servían para llevarte a otra
pantalla: las guías no se veían hasta el segundo clic. Ahora se ven YA,
en rejilla, y las categorías son FILTROS (con nivel y «Sin leer»), todo
en el navegador — cambiar de filtro no vuelve a la base. Arriba, «Sigue
donde lo dejaste» con el curso a medias más reciente y su aro.

**F — la portada** abre con el reto del día en GRANDE y la última
noticia al lado, por encima del panel de dos columnas. El reto lleva los
cinco puntos: vacíos son una invitación, y con el reto jugado los que
acertaste, el héroe apagado y el botón cambiado por «Ver la liga» — el
de hoy no se juega dos veces. Y el color deja de gritar en las rejillas:
las tarjetas de categoría pierden el marco de 2 px de color (salía de un
hash del id, no quería decir nada) y la rareza de las guías recientes
pasa de marco entero a galón fino arriba.

La portada estrena `css/portada.css` (y se lleva el banner de noticias
de la 288, que solo pinta ella). Peso: **156,9 KB gzip** de los 170.

**Ficheros**: index.html, foro.html, aprender.html, js/home.js,
js/foro.js, js/aprender.js, js/app.js (muere `borderTintClassForKey`),
css/portada.css (NUEVO), css/aprender.css (NUEVO), css/foro.css,
css/components.css, css/style.css, SCHEMA.md.

**Pruebas**: test-tanda-299.mjs (NUEVA, 10 bloques, 59 comprobaciones).
Rigor: 30 mutaciones, las 30 detectadas — pero en la primera pasada se
escaparon TRES, y las tres eran pruebas mías flojas, no código malo
(contaba consultas por la red, que el doble no usa; el fixture descartaba
la guía terminada por fecha en vez de por terminada; y al galón le valía
cualquier color, incluido el gris de respaldo). Corregidas las tres. El doble gana dos tablas
(`daily_challenge_results` y `user_progress`): sin ellas no se podía
probar el reto YA JUGADO ni «Sigue donde lo dejaste».

**En curso / pendiente**: el rediseño queda terminado (torneos 297-298,
foro/aprender/portada 299). Sin cobertura siguen las fichas de guía y
curso, los perfiles y /noticias. Y PINGU confirma que **las seis SQL
pendientes están ejecutadas** (chats, cola, bo3, privados, organizadores
y dueño): no queda nada por poner en la base.

---

## 2026-09-14 (7) — PINGU-Claude (tanda 298 — B y C: la ficha y las rondas)

**Hecho**: las dos últimas del rediseño de «Jugar», juntas porque PINGU
quería acabar con torneos para seguir con el resto de la web. Ni una
política, ni una RPC, ni el motor: HTML y CSS.

**La cabecera** deja de ser una tarjeta blanca con cuatro cajitas grises
del mismo tamaño. El banner del torneo (tanda 242) pasa de franja suelta
a SER el fondo, con velo oscuro para que el texto se lea sobre cualquier
imagen, y los datos son chapas. Y se dice quién organiza, que no
aparecía en ningún sitio de la ficha (el nombre del creador se cuela en
el lote de perfiles que ya se pedía: cero consultas nuevas).

**La barra viva**, pegada arriba: cuánto queda de ronda —con un anillo
que se vacía—, contra quién juegas y SOLO lo que falta. Si ya hiciste
check-in y tu rival también, no te pide nada. Quien solo mira ve el
marcador de la ronda, no «tu partida».

**«Tu partida» pasa a ser un TABLERO**: tú a un lado, tu rival al otro,
el marcador de la serie en medio y el check-in de cada uno bajo su cara.
Se le quita la columna de 560 px centrada que venía del original
mobile-first y dejaba medio panel en blanco en un PC.

**El BO3, en tres casillas** en vez de tres renglones: verde la ganada,
roja la perdida, filo navy la que toca marcar. El color sale del
RESULTADO, no de la frase — pintar mirando si el texto «pone ganaste» se
rompe el día que alguien cambie el texto.

**Las mesas dejan de ser una tabla** y pasan a enfrentamientos (número,
uno, resultado, otro). Con eso se pudo borrar entero el apaño de la
tanda 221, que convertía la tabla en tarjetas por CSS con un
`data-etiqueta` por celda. La tuya va marcada y el ganador en negrita.

**Línea de tiempo de rondas** con el reloj DENTRO del paso que se juega.
Eso destapó una duplicación: con la barra viva había TRES relojes en
pantalla diciendo lo mismo. Quedan dos, y cada uno dice algo distinto.

**Clasificación**: oro/plata/bronce y tu fila marcada. La tabla se queda
como tabla — tiene puntos, V-D-E, OWP y OOWP, y en tarjetas se perdería
la comparación de un vistazo.

**Un fallo que salió al reescribir**: el CSS traía un `flex-wrap: wrap`
de cuando el BO3 era una fila. Con las casillas nuevas hace lo contrario
de lo que se quería — en un flex de COLUMNA, `wrap` abre una segunda
COLUMNA — y los botones salían disparados fuera de su casilla en el
móvil. Fuera.

**Ficheros**: torneo.html, js/torneos/ronda.js, js/torneos/torneo.js,
js/torneos/comun.js (colorDeNombre se comparte con la lista),
js/torneos/torneos.js, css/torneos.css, SCHEMA.md.

**Pruebas**: test-tanda-298.mjs (NUEVA, 9 bloques). Comprueba a propósito
LO QUE YA FUNCIONABA —reportar, cambiar lo reportado, check-in, resolver
una mesa, llevar el ciclo, el historial, los desempates—: un rediseño
que se lleve eso por delante no es un rediseño, es una avería. Rigor: 24
mutaciones, las 24 detectadas.

Y TRES pruebas viejas reescritas en vez de borradas, porque cada una
guarda un fallo que ya pasó: test-torneos-15 (que además pilló uno de
verdad — un usuario de TCG Live largo sacaba la página de la pantalla a
320 px por falta de `min-width: 0` en el duelo), test-tanda-291 (el
marcador de la serie se mudó a la cabecera) y test-tanda-297 (la ficha
tiene ahora su propio estilo de pestañas).

**En curso / pendiente**: torneos queda terminado. Lo siguiente es el
resto de la web (foro, guías, portada), aún sin empezar.

---

## 2026-09-14 (6) — IBAI-Claude (los códigos de la era ME, y «más nueva» = marca más alta)

**Hecho**: verificando la entrada (5) contra la base real salió la causa
raíz de las «cartas antiguas»: NINGÚN set moderno tiene
`tcg_online_code` — TCGdex dejó de traer `tcgOnline` en la era ME
(comprobado contra su API: vacío en todos los me*) — los overrides del
admin están vacíos, y la tabla a mano de comun.js se quedaba en MEG.
Toda línea con código moderno caía al respaldo por nombre. Tres arreglos:

1. **Nueve códigos nuevos en SETS_LIVE**: los cuatro anotados sin
   resolver el 2026-09-01 ya tienen dueño — ASC = Ascended Heroes
   (me02.5), POR = Perfect Order (me03), CRI = Chaos Rising (me04),
   MEE = Mega Evolution Energy (mee) — más BLK/WHT (Black Bolt / White
   Flare), SVE, y PFL/PIT deducidos del nombre (si el código real fuera
   otro, no le quitan el sitio a nadie). El comentario de
   cartas-decklist.js que decía «NO ampliar la tabla, del set nuevo se
   encarga el paso 2» ya no era verdad y está corregido.

2. **«Más nueva» = marca más alta**: el desempate por `release_date`
   de la entrada (5) no ordenaba nada — la columna está a NULL en TODOS
   los sets del espejo. La marca de regulación ES cronológica (D 2019 …
   J 2026), así que ordena ella: legal primero, marca más alta después,
   fecha de último desempate (afinará sola cuando se rellene). Las
   gemelas SIN marca al final: son pre-2019 o promos raros (hay promos
   de Pocket en el espejo).

3. Si dos sets coinciden en número de colección, gana la impresión
   nueva (el find del número va sobre la lista ya ordenada).

**Verificado contra la base real**: «Ultra Ball ASC 213» resuelve
exacto (Ascended Heroes #213, marca I); el respaldo por nombre de
«Ultra Ball» y «Cambio» elige la impresión I; la regla de la
reimpresión responde SÍ para ambas (la impresión vieja ya no se marca
en rojo). Probado también en local (http.server) contra la base real.

**Ficheros**: js/torneos/comun.js, js/torneos/cartas-decklist.js.

**En curso / pendiente**: dos cosas de DATOS, no de código —
`tcg_sets.release_date` está a NULL en todo el espejo (una reimportación
del catálogo desde /admin lo rellenaría, setToRow ya lo mapea); y las
marcas de algunos sets de 2025 parecen dudosas (la Investigación de
Profesores de Black Bolt figura como G — sin reimpresión H/I/J en el
espejo se marcará en rojo; si en el juego real es I, la tabla de
cartas-marcas necesita un repaso de 2025-26). PINGU: pasada de suite
cuando puedas; sigo sin tocar torneo.js ni ronda.js.

---

## 2026-09-14 (5) — IBAI-Claude (la decklist: la regla de la reimpresión, y la gemela más nueva)

**Hecho**: dos arreglos en la rejilla de la decklist, mirando cómo lo
hace Limitless (y el reglamento oficial, sección 4 del handbook):

1. **La regla de la reimpresión**: una carta de marca vieja (D…G) VALE
   si existe una carta con el MISMO NOMBRE y marca legal — quien juega
   la «Investigación de Profesores» antigua está jugando la versión
   moderna con otra ilustración. Antes la rejilla la marcaba en rojo
   como «fuera del reglamento» sin mirar si tenía reimpresión. Ahora,
   antes de acusar, se consulta el espejo por el nombre (el del espejo,
   no el de la línea pegada, que viene en el idioma del jugador); solo
   sin reimpresión legal se señala. La consulta se cachea por PROMESA,
   que las cuatro copias de una carta se resuelven a la vez.

2. **El respaldo por nombre elegía cartas antiguas**: cuando el set de
   una línea no se resuelve, se caía a buscar por nombre y se cogía la
   PRIMERA gemela por orden alfabético — casi siempre una impresión
   vieja: imagen antigua y marca ilegal para una carta bien escrita.
   Ahora, si el número de colección no casa con ninguna gemela, se coge
   la más nueva con marca legal, y si no, la más nueva a secas (para
   eso `searchCards` trae ahora `release_date` del set — additivo, los
   otros dos consumidores del embed solo leen `name`).

**Aclarado de paso**: el reglamento NUNCA ha bloqueado el guardado
(`validateDecklist` solo exige 60 cartas y un Pokémon) — lo que parecía
un bloqueo eran estos falsos positivos en rojo. El aviso ahora lo dice
en voz alta: «es un aviso: la lista se puede entregar igual».

**Ficheros**: js/torneos/cartas-decklist.js, js/tcgdex.js (una línea:
release_date en el select).

**Rigor**: 11/11 en la 306 y 10/10 en la 305 — pero la 305 necesitó dos
pasadas: dos mutaciones pasaron a la primera porque el listón estaba
puesto a ojo (leer la escala sin quitar los comentarios, y «al menos
cuatro renglones» cuando había que comprobar dos párrafos de tres).

**En curso / pendiente**: nada a medias. PINGU: una pasada de la suite
cuando puedas (toqué la rejilla de decklist que pintan torneo.js y
jueces.js, pero no toqué torneo.js ni ronda.js, que sé que los tienes
en curso con las tandas B y C).

---

## 2026-09-14 (4) — PINGU-Claude (tanda 297-A — la lista de torneos, en tarjetas)

**Hecho**: PINGU quiere modernizar las interfaces, empezando por
torneos. Le pasé maquetas antes de tocar nada («me encanta el concepto,
es una mejoría gigante y muy necesaria») y van tres tandas: A la lista,
B la ficha, C rondas y clasificación. Esta es la A.

**Ni una política, ni una RPC, ni el motor.** Solo HTML y CSS.

Cada torneo era UNA LÍNEA de texto: la imagen del torneo (tanda 239)
cabía en 48 px, quién iba apuntado no se veía, y un torneo EN JUEGO
ahora mismo pesaba lo mismo que uno terminado hace un mes. Ahora es una
tarjeta en rejilla: portada, bloque de fecha montado sobre ella,
etiquetas de estructura, las caras de los cuatro primeros inscritos con
su «+N», barra de plazas que se pone NARANJA pasando del 80%, y UNA
acción por tarjeta que dice la verdad según el estado (Apuntarme en
verde / Ver el torneo / Ver el directo / Resultados y mazos). Un torneo
terminado cambia las plazas por quién ganó.

«Apuntarme» LLEVA a la ficha, no inscribe: ahí están el aviso de
decklist, el código del torneo privado y la lista de espera.

**La barra del torneo que estás jugando**, arriba del todo: cuánto queda
de ronda y «Ir a tu mesa». Solo se pide la ronda si HAY un torneo tuyo
en juego — quien no juega nada no paga consulta ni ve una barra vacía.

**Dos cosas que se arreglan de paso**: los botones de duplicar y borrar
vivían DENTRO del `<a>` de la tarjeta (HTML inválido sostenido con
preventDefault) y ahora el pie queda fuera del enlace; y el héroe navy,
que se comía un tercio de la pantalla antes de enseñar un torneo, pasa a
franja.

**Una consulta menos, no una más**: las caras y el «organiza Fulano»
necesitaban perfiles, así que la consulta que ya había («¿cuál de los
creadores es admin?») pasa a traer username y avatar_url y cubre los
tres usos. Siguen siendo tres viajes.

**Lo que NO se toca**: las pestañas de la FICHA y del calendario siguen
siendo subrayado —allí son navegación—; las de la lista pasan a chips
porque son filtros, y por eso van en una clase aparte en vez de
reescribir la compartida. Y el presupuesto de la portada ni se roza:
css/torneos.css no lo carga index.html.

Comprobado en claro, en oscuro y a 320 px.

**Ficheros**: torneos.html, js/torneos/torneos.js, css/torneos.css,
SCHEMA.md.

**Pruebas**: test-tanda-297.mjs (NUEVA, 9 bloques). Rigor: 18
mutaciones, las 18 detectadas. Y test-torneos-15.mjs REESCRITO: guardaba
el fallo de la tanda 233 (el título estrujado a una palabra por línea en
un móvil) contra una estructura que ya no existe; reescrito contra la
nueva pilló un fallo de verdad —a 320 px, con «Retirado» + Duplicar +
Borrar + la acción, el botón se salía de la tarjeta—.

**En curso / pendiente**: las tandas B (la ficha: cabecera, barra viva y
el tablero de tu partida) y C (rondas, mesas y clasificación). Si tocas
torneo.js o ronda.js, avísame antes.

---

## 2026-09-14 (3) — PINGU-Claude (tanda 296 — quien crea un torneo, lo lleva)

**Hecho**: el hueco que dejé anotado en la 295, cerrado. PINGU: «sí, que
quien crea un torneo pueda llevarlo, es lo suyo».

Y al mirarlo de cerca era más grande que la pantalla. El CICLO (rondas,
mesas, resultados) ya estaba abierto al creador desde la tanda 266. Lo de
ALREDEDOR no: dar de baja o confirmar a un inscrito, ver las decklists
para el deck check, corregir una, nombrar jueces, ver y resolver
llamadas, los dos chats y leer los reportes de una disputa seguían siendo
del admin del sitio. O sea: montaba el torneo, pero el día de jugarlo se
quedaba sin herramientas — y en silencio, que es lo peor.

Se unifica en un nombre, `torneos_mando(p_torneo)` = admin del sitio, u
organizador, o quien creó ESE torneo. Todas esas políticas pasan por ahí,
y en el cliente `puedeLlevar(perfil, torneo, userId)` dice lo mismo. Las
tres fichas tienen su `mando()` y ya no queda ni un `puedeOrganizar(`
suelto. `puedeBorrarTorneo` era este mismo criterio con otro nombre:
ahora delega.

**Lo que NO se abre**: el sello de OFICIAL (sigue en `is_admin` a secas),
repartir el rol, el panel, la puerta de atrás de los chats de la 294 (va
INCORPORADA en la migración, que reescribe esas dos políticas) y la regla
de visibilidad de decklists para todos los demás, que se copia de
torneos-listas.sql carácter a carácter — la prueba lo compara.

**Dos sitios que mentían**, y que al abrir esto a más gente había que
arreglar: «Expulsar» decía «jugador retirado» aunque la política hubiera
rechazado el UPDATE (cero filas, sin error); y retirar a los no
confirmados antes de la R1 era peor — marcaba la baja en memoria aunque
en la base siguiera activo, y la ronda se pareaba sin él. Los dos van ya
con `.select('id')` y miran cuántas filas volvieron.

PROBADO CONTRA POSTGRESQL DE VERDAD (sql-dueno.sql, en `pruebas`),
aplicando el FICHERO de migración: Ash da de baja a Misty en su torneo
(UPDATE 1), ve su decklist, aprueba a Brock de juez; no toca el torneo de
PINGU (UPDATE 0), no se sella como oficial (sigue en `f`), Gary sigue sin
poder escribir en la mesa de otros (RLS ×2) y Ash, que lleva el torneo,
sí.

**Ficheros**: supabase-migration-torneos-dueno.sql (NUEVO),
js/torneos/comun.js, js/torneos/torneo.js, js/torneos/torneos.js,
js/torneos/ronda.js, js/torneos/jueces.js, SCHEMA.md.

**Pruebas**: test-tanda-296.mjs (NUEVA, 8 bloques) y sql-dueno.sql.
Rigor: 15 mutaciones, las 15 detectadas — cuatro pillaron pruebas flojas
mías (tres miraban la política entera en vez de sus dos mitades, y la del
chat contaba condiciones sin mirar si las unía un `and` o un `or`).

**PENDIENTE para PINGU — SEIS SQL, y esta va la ÚLTIMA**: chats,
cola, bo3, privados, organizadores y, al final, dueno. El orden importa
en la última: vuelve a escribir políticas que chats y organizadores
también definen.

---

## 2026-09-14 (2) — PINGU-Claude (tanda 295 — el rol de organizador de torneos)

**Hecho**: hay una comunidad que quiere llevar los torneos de PokeDoc y
PINGU no tiene tiempo de estar encima. Así que un rol nuevo:
`user_profiles.is_tournament_admin`, que da el mando de la sección
«Jugar» ENTERA (crear, editar, abrir y cerrar inscripciones, pareos,
resolver disputas, cancelar, borrar, jueces) y de NADA más: ni el panel
de administración, ni foro, ni guías.

Se reparte desde /admin → Usuarios, con un interruptor por persona al
lado del de Admin, y con el alcance explicado ahí mismo para que nadie
lo dé a ciegas. De paso se arregla una trampa que me comí escribiéndolo:
en Postgres pedir una columna que no existe tumba la consulta ENTERA, y
`loadUsers()` metía la columna nueva en el primer escalón — faltando esta
migración, la tabla de usuarios se caía al escalón de «sin color» y
decía que faltaba la migración de los colores, que sí está puesta. Ahora
la escalera son seis combinaciones explícitas y se apunta cuál entró.

Tres piezas, y las tres hacen falta:

1. **La base manda**: `torneos_soy_admin()` pasa a mirar las DOS
   columnas, así que las políticas de las seis tablas del ciclo y las
   RPC reconocen al organizador sin tocarlas una por una.
2. **El sello de OFICIAL se queda en casa**: se parte una función nueva,
   `torneos_soy_admin_del_sitio()` (solo `is_admin`), y el disparador de
   `is_official` pasa a usarla. Un organizador monta y lleva torneos,
   pero no le pone el sello de PokeDoc a lo suyo.
3. **Nadie se da el rol a sí mismo**: `solo_admin_da_titulos()` ya
   revertía `is_admin`; ahora revierte también `is_tournament_admin`.
   Sin esto el rol se lo pone cualquiera con una llamada a la API.

En el cliente, las ~22 puertas de `perfil?.is_admin` de torneos pasan por
un solo sitio, `puedeOrganizar(perfil)` en comun.js. Las dos de «oficial»
se quedan a propósito en `is_admin`, y `checkAccess()` del panel también:
ahí el organizador no entra.

PROBADO CONTRA POSTGRESQL DE VERDAD (sql-organizadores.sql, en
`pruebas`): el organizador edita el torneo de PINGU (UPDATE 1), un
jugador normal no (UPDATE 0), el `is_official` que se pone el organizador
vuelve a `false`, el de PINGU se queda, y ni Ash se asciende solo ni el
organizador asciende a Ash.

**OJO, un hueco que NO he tocado y es decisión tuya**: desde la tanda 266
CUALQUIERA puede crear un torneo, y la política de la base le deja
llevarlo (`admin_id = auth.uid()`). Pero el JavaScript solo enseñaba esas
herramientas a `is_admin`, así que quien crea un torneo hoy no puede
abrir sus propias inscripciones desde la web. Esta tanda no lo arregla
(lo suyo sería `puedeOrganizar(perfil) || torneo.admin_id === userId`),
porque es decidir si los torneos de la comunidad se llevan solos o no.
Dilo y lo hago.

**Ficheros**: supabase-migration-torneos-organizadores.sql (NUEVO),
js/torneos/comun.js, js/torneos/torneo.js, js/torneos/torneos.js,
js/torneos/ronda.js, js/torneos/jueces.js, admin/js/admin.js, SCHEMA.md.

**Pruebas**: test-tanda-295.mjs (NUEVA, 7 bloques) y
sql-organizadores.sql. Rigor: 14 mutaciones, las 14 detectadas — dos de
ellas pillaron pruebas flojas mías: una miraba solo la mitad del texto
del panel (la que dice lo que el rol NO da), y otra daba por buena la
escalera de columnas mirando las banderas sin comprobar que cada escalón
pida de verdad lo que dice que trae.

**PENDIENTE para PINGU — CINCO SQL**: torneos-chats (la más urgente),
torneos-cola, torneos-bo3, torneos-privados y torneos-organizadores.
Hasta que esta última esté puesta, el interruptor del panel avisa de que
falta en vez de quedarse mudo.

---

## 2026-09-11 13:25 — IBAI-Claude (un jugador no podía guardar su decklist)

**Hecho**: un jugador pegaba su export de TCG Live tal cual y el editor
no le dejaba guardar. Dos causas, las dos en el parser de motor.js:

1. Las energías básicas salen con el set literal «Energy» («3 Basic {F}
   Energy Energy 50») y `CARD_LINE` solo admitía 2–6 MAYÚSCULAS: las
   cuatro líneas de energía se descartaban, el total daba 49 y la
   validación de 60 bloqueaba. Ahora la regex admite «Energy» como
   código de set (y el backtracking deja el nombre en «Basic {F}
   Energy», comprobado).
2. La última línea del export («Cartas totales: 60») salía como «línea
   que no se entiende», y torneo.js convierte cada ilegible en un error
   que también bloquea. `decklistUnparsed` ahora ignora las líneas de
   recuento («palabras: número» — una carta empieza por cifra y no lleva
   dos puntos), en cualquier idioma («Total Cards: 60» incluido).

Verificado con la lista real del jugador pasada por el parser en Node:
60/60, cero ilegibles, cero errores. Toco la lógica de motor.js (porte
1:1 de libs/engine de TrainerArena): es una AMPLIACIÓN del formato
aceptado, no cambia nada de lo que ya parseaba.

**Ficheros**: js/torneos/motor.js.

**Rigor**: 11/11 en la 306 y 10/10 en la 305 — pero la 305 necesitó dos
pasadas: dos mutaciones pasaron a la primera porque el listón estaba
puesto a ojo (leer la escala sin quitar los comentarios, y «al menos
cuatro renglones» cuando había que comprobar dos párrafos de tres).

**En curso / pendiente**: nada a medias. Pido pasada de la suite de la
rama `pruebas` cuando puedas (parseDecklist/decklistUnparsed). El set
«Energy» no está en la tabla de comun.js ni seguramente en
`tcg_online_code`: las energías básicas pueden salir sin imagen en la
vista visual — si pasa, se asigna desde /admin (torneos_sets_live) sin
tocar código.

---

## 2026-09-14 (1) — PINGU-Claude (tanda 294 — la puerta de atrás de los chats)

**Hecho**: PINGU pidió seguir buscando por decklists, jueces y chats de
mesa. Salió un agujero, y del tipo contrario al de ayer: no es que no se
escriba, es que escribía quien no debía.

En PostgreSQL un INSERT NO mira el `using` de la política: solo el
`with check`. Las dos políticas de chat pedían pertenecer a la mesa para
LEER y solo firmar con tu nombre para ESCRIBIR. Como los ids de las mesas
son de lectura pública, cualquiera con cuenta podía meter mensajes en la
partida de dos desconocidos, y en el chat de una llamada al juez.

Arreglado en supabase-migration-torneos-chats.sql: el `with check` lleva
ahora la MISMA condición que el `using`, además de la firma.

PROBADO CONTRA POSTGRESQL DE VERDAD (sql-chats.sql, en `pruebas`): antes
el desconocido entra; después le salta la RLS en los dos chats, y Ash
—que sí juega esa mesa— sigue escribiendo. La prueba aplica el FICHERO DE
MIGRACIÓN, no una copia.

Y queda de guardia `barrido-politicas.py`: recorre todas las migraciones
buscando políticas `for all` con un `with check` más flojo que su
`using`. En todo el proyecto había exactamente esas dos.

**Lo que se miró y estaba bien**: decklists (el motor y la política dicen
lo mismo), solicitudes de juez (el cliente manda status 'pending', que es
lo que pide el with check) y llamadas al juez (created_by correcto, y
atender/resolver son de juez o admin).

**Ficheros**: supabase-migration-torneos-chats.sql (NUEVO), SCHEMA.md.

**Pruebas**: test-tanda-294.mjs (NUEVA, 21), barrido-politicas.py y
sql-chats.sql. Rigor: 6 mutaciones, las 6 detectadas — una de ellas pilló
que la prueba del barrido no demostraba que el barrido DETECTARA nada; se
le añadió un control positivo.

**PENDIENTE para PINGU — CUATRO SQL ya**: torneos-bo3, torneos-privados,
torneos-cola y torneos-chats. Este último es el que más corre: hasta que
esté, el chat de cualquier mesa lo puede escribir cualquiera con cuenta.

---

## 2026-09-13 (4) — PINGU-Claude (tanda 293 — el puente que mentía)

**Hecho**: PINGU preguntó qué más podía fallar en un torneo. Buscando
salió algo peor que lo de los pareos, porque no se ve.

Desde la apertura, un jugador no escribe en `tournament_registrations`,
`match_reports` ni `tournament_matches`: solo por RPC. Pero el cliente
guardaba el «camino viejo» por si la RPC no estaba, y ese camino escribe
a pelo. Y un INSERT que la RLS rechaza NO DA ERROR: no toca nada y vuelve
como si hubiera ido bien. La web decía «Reportado» en verde sin haber
reportado nada.

DOS CASOS QUE ESTABAN VIVOS:

1. Entre desplegar la tanda 291 y ejecutar su SQL, NADIE podía reportar
   un resultado (esa migración quita la RPC vieja de reportar).
2. Desde que un torneo se llena, nadie podía apuntarse a la COLA: ese
   caso iba siempre por el camino viejo porque la RPC no sabía de colas.
   Eso llevaba roto desde la apertura.

Arreglo: fuera el camino viejo de reportar, del check-in y de
inscribirse — si falta la RPC se dice QUÉ FICHERO ejecutar y no se hace
nada más. Y la RPC de inscribirse aprende `p_cola`, con su `drop
function` de la firma vieja (misma trampa de la 291). De paso se va el
recuento que hacía el navegador: lo hace la RPC bajo candado.

**Ficheros**: js/torneos/comun.js, js/torneos/ronda.js,
js/torneos/torneo.js, supabase-migration-torneos-cola.sql (NUEVO),
SCHEMA.md.

**Pruebas**: test-tanda-293.mjs (NUEVA, 27). Rigor: 10 mutaciones, las 10
detectadas. La prueba vigila leyendo el cuerpo de cada función que ningún
camino de jugador vuelva a escribir directo en esas tres tablas.

**PENDIENTE para PINGU — TRES SQL, y el orden da igual**:
supabase-migration-torneos-bo3.sql, supabase-migration-torneos-privados.sql
y supabase-migration-torneos-cola.sql. Hasta que estén, reportar,
inscribirse y entrar con código avisan de lo que falta en vez de fallar
en silencio.

---

## 2026-09-13 (3) — PINGU-Claude (tanda 292 — torneos privados con código)

**Hecho**: lo tercero y último del feedback del torneo. Un torneo se
puede marcar como PRIVADO con un código: no sale en la lista y solo lo
ven su organizador, los admins y quien ya está inscrito. El resto no lo
ve ni por su enlace ni por la API — decide la POLÍTICA, no el
JavaScript (CLAUDE.md).

Como sin poder leer la fila tampoco se puede uno inscribir por el camino
normal (pide el id), hay una RPC nueva `torneos_entrar_con_codigo` que va
por el SLUG del enlace. «No existe» y «código incorrecto» dan el mismo
mensaje a posta, y el formulario del código se ofrece siempre que haya
sesión: si solo saliera cuando el torneo existe, el propio formulario
estaría confirmando que está ahí.

La comprobación de «¿estoy inscrito?» va en una función SECURITY DEFINER
porque puesta a pelo en la política de `tournaments` monta una recursión
infinita con la política de `tournament_registrations`.

**DOS TRAMPAS que casi me como y quedan anotadas en SCHEMA**: (1) esconder
`join_code` con un grant por columnas habría roto la sección entera —un
`select *` de un rol sin permiso sobre una columna falla la consulta
completa, y el cliente pide `tournaments` con `*`—; y (2) el canal de
Telegram usa la clave de SERVICIO, que se salta la RLS, así que el filtro
de privados hay que escribirlo a mano o el canal anunciaría justo lo que
alguien quiso esconder.

**Ficheros**: supabase-migration-torneos-privados.sql (NUEVO),
js/torneos/torneo.js, js/torneos/torneos.js, torneo.html, torneos.html,
css/torneos.css, netlify/functions/telegram-torneos.mjs, SCHEMA.md.

**Pruebas**: test-tanda-292.mjs (NUEVA, 36). Rigor: 18 mutaciones, las 18
detectadas.

**PENDIENTE para PINGU**: ejecutar `supabase-migration-torneos-privados.sql`
(y la de BO3, `supabase-migration-torneos-bo3.sql`, si todavía no).

Con esto queda cerrado el feedback del torneo del 2026-09-13: pareos,
BO3 partida a partida y torneos privados.

---

## 2026-09-13 (2) — PINGU-Claude (tanda 291 — BO3 partida a partida)

**Hecho**: lo segundo del feedback del torneo. En un BO3 ahora se marca
CADA partida, y con dos ganadas la tercera se cierra sola y no se puede
votar.

`match_reports` gana `game_number` (0 = match entero para BO1, 1-3 cada
partida) y el candado pasa a ser por partida. El resultado del match NO
se guarda: se deduce de las partidas confirmadas —`serieBo3()` en el
motor—, igual que los arquetipos se deducen de la decklist.

Sobre deshacer, que PINGU dejó a mi criterio: se puede CORREGIR el propio
parte mientras el rival no haya contestado esa partida (no es deshacer,
es enmendarlo antes de que valga); en cuanto los dos coinciden queda
cerrada y la toca un juez. Sale del diseño que ya había, donde un
resultado lo reportan los dos y se concilia. Y el 2-0 se resuelve solo:
retirando una, la serie deja de estar decidida y la tercera se reabre.

OJO con la migración: la RPC vieja `torneos_reportar(uuid, text)` se
QUITA con un `drop function`. `create or replace` con otra firma crea una
SOBRECARGA, y con `p_juego` por defecto la llamada de dos argumentos
quedaría ambigua («function is not unique») y rompería el reporte entero.

**Ficheros**: js/torneos/motor.js, js/torneos/ronda.js, css/torneos.css,
supabase-migration-torneos-bo3.sql (NUEVO), SCHEMA.md. En `pruebas`:
stub-supabase.js (semilla `__FAKE_REPORTES__`).

**Pruebas**: test-tanda-291.mjs (NUEVA, 40). Rigor: 15 mutaciones, las 15
detectadas; destapó una guarda redundante en `juegoAbierto`, quitada.

**PENDIENTE para PINGU**: ejecutar `supabase-migration-torneos-bo3.sql`.
Hasta que lo haga, marcar una partida suelta avisa de que falta — no
apunta el resultado en el sitio equivocado.

**PENDIENTE (lo que queda del feedback)**: torneos privados con código y
etiqueta.

---

## 2026-09-13 (1) — PINGU-Claude (tanda 290 — el motor de pareos deja de rendirse)

**Hecho**: PINGU echó hoy un torneo a 3 rondas y al generar los pareos de
la R3 solo salieron algunas mesas; tuvo que sentar a mano.

La SPEC parea grupo a grupo y, si un grupo no sale sin repetir cruces, se
rinde con lo que lleve — sin volver atrás a deshacer una mesa anterior.
En su torneo los dos últimos ya se habían cruzado en la R1 y el motor
abandonó, habiendo pareo completo posible. Y NO es mala suerte: sobre mil
torneos al azar el motor viejo se rendía en **421**.

Ahora: (1) el camino de la SPEC intacto —en los 579 que el viejo pareaba
bien, el nuevo da EXACTAMENTE las mismas mesas, cero diferencias—; (2) si
falla, un rescate que mira el pool entero y puede deshacer mesas, que
salva los 421; (3) y de último recurso, repetir un cruce antes que dejar
la ronda sin arrancar, avisando en pantalla de qué mesa repite y entre
quiénes. DESVIACIÓN RESPECTO A LA SPEC, anotada en SCHEMA.

**De paso, el rigor destapó dos cosas**: un `throw` de la SPEC que era
código muerto (el último grupo de puntos no puede quedar impar: el pool
es par y el float-down deja pares los anteriores) — quitado; y que el
término de los puntos del coste del rescate casi nunca decide, porque el
pool ya llega ordenado por ranking. Se deja, pero dicho en el código y
sin una mutación que finja que se prueba.

**Ficheros**: js/torneos/motor.js, js/torneos/ronda.js, SCHEMA.md.

**Pruebas**: test-tanda-290.mjs (NUEVA, 34), con mil torneos al azar
dentro: los mil pareados enteros, ninguno se rinde. Rigor: 8 mutaciones,
las 8 detectadas.

**PENDIENTE (lo que queda del feedback de PINGU)**: resultados partida a
partida en BO3 (que se pueda marcar cada juego y que al 2-0 se cierre), y
torneos privados con código y etiqueta.

---

## 2026-09-12 (1) — PINGU-Claude (tanda 289 — una noticia no es una guía, y no la firma nadie)

**Hecho**: el hilo de actividad decía «PINGU ha publicado la guía …» de
una NOTICIA, y justo debajo repetía la misma noticia como «ha abierto un
tema en el foro» —que es el hilo que abre sola al publicarla—.

Tres cosas:

1. Tipo de evento `noticia`, con su icono y su enlace a /noticias/<slug>
   (antes iba al de guía, que para una noticia es la dirección vieja).
2. El hilo que abre sola una noticia ya no se cuenta como tema aparte.
3. **Una noticia no la firma nadie.** Decisión de PINGU y es la correcta:
   firmar una guía es el pago de escribirla, pero una noticia es del
   sitio — que ponga «PINGU ha publicado» la hace parecer opinión de
   alguien y ata la sección a una persona. En el hilo va con la marca de
   la casa y «Nueva noticia: …»; en la ficha, «Noticia de PokeDoc». Y no
   la esconde el `hide_activity` de quien la teclee ni le gasta su cupo.
   `author_id` se sigue guardando: hace falta para los permisos.

**OJO, hallazgo de paso**: al ir a probarlo salió que `loadActivity`
REVENTABA en el doble desde siempre —su `.or()` solo entendía `eq` e
`is`, y el hilo usa `completed_at.gte.…`—. O sea que el hilo de actividad
no tenía ni una prueba y nadie lo sabía. El doble ya entiende
gte/lte/gt/lt en `.or()`, con el cuidado de que una columna vacía NO
cumpla (en PostgREST un null no entra en un >=).

**Ficheros**: js/activity.js, js/guia.js, css/components.css, SCHEMA.md.
En la rama `pruebas`: stub-supabase.js.

**Pruebas**: test-tanda-289.mjs (NUEVA, 22, en Chromium). Rigor: 10
mutaciones, las 10 detectadas.

---

## 2026-09-11 (17) — PINGU-Claude (tandas 287 y 288 — torneos a Telegram, y el banner de la portada)

**Hecho**, dos cosas que pidió PINGU:

**287. Los torneos, al canal de Telegram.** Porte de telegram-noticias.
Se manda cuando ABREN LAS INSCRIPCIONES, no al crear el torneo (un
`draft` no lo ve nadie y puede cambiar de fecha tres veces). La red aquí
no son 48 horas sino la fecha real: un torneo que ya ha empezado no se
anuncia. El mensaje lleva la ficha —cuándo, cómo se juega, plazas— entre
el nombre y el resumen, la descripción sin etiquetas, y como foto el
BANNER del torneo. `mandarATelegram` ya no sabe de noticias: recibe
`{ texto, portada }` y lo comparten los dos.

**288. El banner de noticias de la portada.** Antes era la fila fina con
el titular; ahora va con la IMAGEN de portada, la etiqueta «NOTICIAS» y
un «Ver todas las noticias» FUERA del banner (dentro sería un enlace
dentro de otro, y llevaría al artículo). Sin portada se cae a la fila
fina de siempre. El CSS va en components.css a propósito, saltándose la
norma: quien entra a pokedoc.es no descarga noticias.css y una hoja más
sería un viaje extra en la primera pantalla. Portada en 156,8 KB de 170.

**Ficheros**: netlify/lib/telegram.mjs,
netlify/functions/telegram-torneos.mjs (NUEVO),
netlify/functions/telegram-noticias.mjs,
netlify/functions/telegram-mandar.mjs,
supabase-migration-telegram-torneos.sql (NUEVO), js/home.js, index.html,
css/components.css, SCHEMA.md.

**Pruebas**: test-tanda-287.mjs (NUEVA, 38) y test-tanda-288.mjs (NUEVA,
21, en Chromium). Rigor: 25 mutaciones, las 25 detectadas.

**PENDIENTE para PINGU**: ejecutar
`supabase-migration-telegram-torneos.sql`, y poner
`TELEGRAM_TEMA_TORNEOS` en Netlify con el número del tema de torneos (el
de la URL `t.me/pingucollects/<número>`). Sin eso los anuncios de torneo
caerían en el tema General del grupo.

---

## 2026-09-11 (16) — PINGU-Claude (tanda 286 — AVIF y WebP se convierten al subir)

**Hecho**: cerrado el caso de la portada que no salía en Telegram. El
aviso del panel dio el diagnóstico completo: era un **AVIF**, y estaba
en NUESTRO almacenamiento (o sea que mi teoría del enlazado externo era
falsa; queda corregida aquí para que no despiste a nadie).

AVIF y WebP son imágenes válidas que cualquier navegador pinta, pero
fuera del navegador hay mucho que no las entiende. Y se cuelan sin
querer: quien copia una imagen de una web moderna copia un AVIF sin
saberlo, porque en pantalla se ve igual.

Ahora `uploadGuideImage` convierte AVIF/WebP/HEIC/HEIF antes de subir,
con createImageBitmap + canvas — el navegador es el único sitio donde hay
con qué descodificarlos; en el servidor haría falta una librería y aquí
no entran dependencias nuevas. Con transparencia sale PNG, sin ella JPEG
al 90%. JPEG y PNG no se tocan. Y si algo falla, vuelve el fichero
original: perder la imagen de alguien sería peor que subir un AVIF.

**Ficheros**: js/app.js, SCHEMA.md.

**Pruebas**: test-tanda-286.mjs (NUEVA, 24) en un Chromium de verdad —
doblar un canvas no probaría nada. Rigor: 12 mutaciones, las 12
detectadas.

**PENDIENTE**: las imágenes YA subidas siguen siendo lo que son. PINGU
tiene que volver a subir la portada de la noticia del Wild Card para que
salga con foto en Telegram.

---

## 2026-09-11 (15) — PINGU-Claude (tanda 285 — qué ES esa portada)

**Hecho**: el aviso del panel dio por fin el dato bueno: «failed to get
HTTP URL content; y subiéndola: IMAGE_PROCESS_FAILED». O sea que la web
que aloja la portada no se la da a Telegram (de ahí también la vista
previa sin imagen: el og:image es esa misma portada), pero NOSOTROS sí
nos la bajamos — y aun así Telegram no la procesa. Ya no es acceso: es la
imagen.

`describirImagen()` le lee los primeros bytes (PNG, JPEG, GIF, BMP, WebP,
AVIF/HEIC) y saca formato y medidas, sin librerías. Hace falta porque el
content-type lo pone quien sirve el fichero y miente.

Con eso, antes de subir nada se sabe si la va a rechazar y por qué: un
formato que no acepta como foto (WebP y AVIF son imágenes válidas que se
ven en cualquier navegador, pero sendPhoto no las traga), más de 10000
sumando ancho y alto, o más de 20 a 1 de proporción. Y se dice qué hacer:
«vuelve a subirla en JPG o PNG».

Si pasa todas las comprobaciones y Telegram la rechaza igual, el aviso
acaba con en qué consiste: «la portada es PNG 1200×630 px, 244 KB».

**Ficheros**: netlify/lib/telegram.mjs, SCHEMA.md.

**Pruebas**: test-tanda-282.mjs (96). Rigor: 51 mutaciones, las 51
detectadas.

**PENDIENTE**: con esto el aviso ya dirá el formato exacto de la portada
de PINGU. Si sale WebP/AVIF, la salida es volver a subirla en JPG —y
sigue pendiente lo de que PokeDoc se guarde sola las imágenes pegadas de
otras webs, que es lo que arregla el caso de raíz (y la vista previa en
el resto de redes y en Google).

---

## 2026-09-11 (14) — PINGU-Claude (la portada, seguía sin salir)

**Hecho**: la noticia de prueba salió por el canal, pero la vista previa
del enlace apareció CON título y descripción y SIN imagen. Eso es un dato:
el og:image de una noticia es su propia portada, así que si la vista
previa no tiene imagen es porque Telegram tampoco puede bajarse esa
portada — el mismo fallo por otra puerta.

Añadido: al traérnosla, se mandan cabeceras. Sin `user-agent` muchos
sitios que alojan imágenes contestan 403 a secas, porque una petición
pelada parece un robot raspando. El nuestro dice quién es
(`PokeDocBot/1.0 (+https://pokedoc.es)`), no se disfraza de navegador. Y
NO se manda `referer`, que es justo lo que miran las webs con protección
contra enlazado externo.

**Ficheros**: netlify/lib/telegram.mjs, SCHEMA.md.

**Pruebas**: test-tanda-282.mjs (71). Rigor: 39 mutaciones, las 39
detectadas.

**PENDIENTE / lo que hay que mirar**: si la portada de esa noticia apunta
a OTRA web (pokebeach, por ejemplo) y esa web no nos la da, no hay nada
que hacer desde el código: la imagen no es nuestra. Lo que toca entonces
es SUBIR la portada a PokeDoc —que además arregla la vista previa en el
resto de redes y en Google—. El aviso del botón «Telegram» del panel ya
dice la dirección de la portada y qué responde; falta que PINGU lo mire.

---

## 2026-09-11 (13) — PINGU-Claude (suite: rojo del cambio de IBAI en el parser)

**Hecho**: al pasar la suite después de mi tanda 284 salió en ROJO
`test-decklist-idiomas.mjs`, y el rojo NO era mío: venía de `db01230`
(«Decklist: aceptar el export de TCG Live entero», de la sesión de
IBAI), que entró con mi `git pull`. Esa es la pasada de suite que pide
CLAUDE.md, así que va anotada aquí.

**Qué pasaba**: el arreglo es correcto en su intención —el recuento con
el que acaba el export («Total Cards: 60») no es una carta y el editor lo
enseñaba como línea ilegible, lo que bloqueaba guardar un export
intacto—, pero la regla era `^palabras: número$`, que es EXACTAMENTE la
forma de una cabecera de sección. Con ella, una cabecera de un idioma que
el motor no entiende («Sección Rara: 1», neerlandés, polaco…) se tragaba
en silencio. Eso es justo lo que la tanda 232 se propuso que no volviera
a pasar: una lista a la que le faltan cartas sin decir por qué es peor
que un error.

**Arreglo**: `esLineaDeRecuento` sigue aceptando el recuento, pero exige
que alguna palabra de la etiqueta sea la del TOTAL, por prefijo porque se
declina (`total`, `totales`, `totale`, `totali`, `gesamt`). Siguen
pasando «Total Cards: 60», «Cartas totales: 60», «Nombre total de
cartes: 60» y «Karten gesamt: 60»; vuelve a declararse «Sección Rara: 1».

**Ficheros**: js/torneos/motor.js.

**Pruebas**: test-decklist-idiomas.mjs, con los cuatro recuentos y la
cabecera desconocida. En verde.

**IBAI**: tu cambio se queda, solo se ha estrechado la regla. Si el
export trae algún recuento SIN palabra de total, dímelo y lo añado a
`RAICES_DE_TOTAL` en vez de volver a la regla ancha.

---

## 2026-09-11 (12) — PINGU-Claude (tanda 284 — la portada la subimos nosotros)

**Hecho**: con el canal ya funcionando, la primera noticia salió sin
portada: «Bad Request: failed to get HTTP URL content». Eso quiere decir
que TELEGRAM no ha podido descargarse la imagen — la baja él, desde sus
servidores, y hay sitios que a él le dicen que no aunque a un navegador
le digan que sí.

Ahora son tres intentos: sendPhoto con el enlace (lo más barato, y
Telegram se la cachea); si no, nos la traemos nosotros y se la SUBIMOS
como fichero; y si tampoco, mensaje con vista previa grande, que saca la
portada del og:image.

Subirla arregla dos casos de golpe: la web que le dice que no a Telegram
pero a nosotros no, y la portada servida con un tipo que no es de imagen.
Y el límite por subida son 10 MB, el doble que por enlace.

Cuando no se puede ni traer, `traerLaPortada()` dice el motivo concreto
(«responde 404», «no es una imagen (application/octet-stream)», «pesa
11.0 MB», «viene vacía») Y la dirección de la portada, que es lo único
con lo que se puede hacer algo.

Mismo camino que yt-portada.mjs con las miniaturas de YouTube.

**Ficheros**: netlify/lib/telegram.mjs.

**Pruebas**: test-tanda-282.mjs (66). Rigor: 37 mutaciones, las 37
detectadas. test-tanda-280.mjs: su doble ahora responde 404 a la descarga
de la portada, para seguir cubriendo el recorrido de la programada.

**PENDIENTE**: falta saber si con esto la portada de PINGU entra. Si no,
el aviso del panel dirá qué le pasa a esa imagen en concreto.

---

## 2026-09-11 (11) — PINGU-Claude (tanda 283 — la portada, a Telegram)

**Hecho**: PINGU pide que la noticia salga en Telegram con su portada.
Ya iba como `sendPhoto`, pero había un caso en el que no podía llegar
nunca: a la foto no la sube PokeDoc, se le pasa la URL y va Telegram
desde SUS servidores a buscarla. Una ruta del propio sitio
(«/fotos/x.png») ahí no se resuelve, y una imagen incrustada (data:,
blob:) no es una dirección que nadie pueda pedir.

`portadaAbsoluta()` completa la ruta con pokedoc.es —lo mismo que ya
hacía urlAbsoluta() con el og:image— y descarta los esquemas que no se
pueden ir a buscar.

Y el reintento sin foto ya no manda un mensaje pelado: lleva la vista
previa grande y encima del texto, así que Telegram saca el og:image de la
noticia, que es esa misma portada, con los límites de la vista previa
(más anchos que los de sendPhoto). Una portada demasiado pesada para
mandarla como foto se sigue viendo.

Cuando la foto no entra, el motivo de Telegram («file is too big»,
«failed to get HTTP URL content») sale en el aviso del panel.

**Ficheros**: netlify/lib/telegram.mjs,
netlify/functions/telegram-mandar.mjs, admin/js/admin.js, SCHEMA.md.

**Pruebas**: test-tanda-282.mjs ampliada (48). Rigor: 27 mutaciones,
las 27 detectadas.

**PENDIENTE**: sigue faltando `TELEGRAM_CANAL_NOTICIAS` en Netlify y
meter el bot en el grupo — sin eso no sale nada, con portada o sin ella.

---

## 2026-09-11 (10) — PINGU-Claude (tanda 282 — mandar una noticia a Telegram a mano)

**Hecho**: PINGU publicó una noticia y no salió por el canal de Telegram.
La causa es de configuración (una variable de entorno sin poner en
Netlify), pero lo que había que arreglar era otra cosa: **el fallo era
invisible**. La función programada se iba en silencio, sin decir cuál de
las variables faltaba y sin escribir nada en el registro, y en el panel
una noticia que salió por el canal se veía igual que una que no.

Tres cosas:

1. `llavesQueFaltan()` (nuevo, en netlify/lib/telegram.mjs) devuelve los
   NOMBRES de las que faltan, y la programada los escribe con
   `console.warn` para que salgan en el registro de Netlify.
2. Columna **Telegram** en la tabla de noticias del panel: «Mandada» o
   «Sin mandar».
3. Botón **«Telegram»** por noticia publicada →
   netlify/functions/telegram-mandar.mjs. Manda esa noticia en el
   momento, saltándose las dos redes de la automática (48 horas y «ya
   mandada»), que juntas hacían imposible recuperar una noticia atrasada.
   Pide confirmación para repetir una ya mandada, y el error de Telegram
   («chat not found», «bot is not a member») sale TAL CUAL en el aviso.

El envío (texto, recorte a 1024, foto, tema del grupo) se ha movido a
netlify/lib/telegram.mjs porque ahora lo comparten los dos caminos.

**Ficheros**: netlify/lib/telegram.mjs (NUEVO),
netlify/functions/telegram-mandar.mjs (NUEVO),
netlify/functions/telegram-noticias.mjs, admin/js/admin.js, SCHEMA.md.

**Pruebas**: test-tanda-282.mjs (NUEVA, 32) en la rama `pruebas`, con
rigor-tanda-282.py: 19 mutaciones, las 19 detectadas a la primera. Suite
al completo en verde. test-tanda-280.mjs ajustada al import nuevo.

**PENDIENTE**: esto NO arregla la configuración. Falta que PINGU ponga
`TELEGRAM_CANAL_NOTICIAS` en Netlify (el grupo es público:
`@pingucollects`, y `TELEGRAM_TEMA_NOTICIAS` ya está a 51511), meta el
bot en el grupo como administrador y vuelva a desplegar. A partir de ahí
el botón dice en pantalla qué falla, si falla.

---

## 2026-09-11 (9) — PINGU-Claude (tanda 281 — la extensión de una imagen pegada)

**Hecho**: PINGU dice que no le deja pegar imágenes en la noticia. NO
reproducido todavía —los dos caminos de pegado (HTML de una web y
fichero del portapapeles) funcionan en el laboratorio—, pero mirando la
subida salió un fallo de verdad:

`uploadGuideImage` sacaba la extensión del NOMBRE del fichero. Una imagen
PEGADA no tiene nombre de verdad: el navegador la deja como «image.png»,
«blob» o sin nada. De ahí salían rutas como `1757…-a1b2c3.blob`, y con
esa extensión Supabase la guarda con un tipo que no es de imagen: la
subida «va bien» y luego el navegador no la pinta, o se la descarga.

Ahora la extensión sale del TIPO MIME (que `validateImageFile` acaba de
comprobar que empieza por `image/`), y la subida manda `contentType`
explícito en vez de dejar que Supabase adivine.

**Ficheros**: js/app.js.

**PENDIENTE**: falta saber qué ve PINGU exactamente al pegar (nada / un
aviso / la imagen rota). Esto puede ser su fallo o no serlo.

---

## 2026-09-11 (8) — PINGU-Claude (tanda 280 — las noticias al canal de Telegram)

**Hecho**: PINGU tiene una comunidad de Telegram con varios canales
(torneos lo anuncia a mano) y quiere uno de noticias que se escriba solo.
Preguntó si se podía con el RSS.

**Se puede, pero NO conviene**, y está razonado en la cabecera del
fichero: los bots de RSS SONDEAN (de quince minutos a una hora, y en una
noticia llegar el primero es toda la gracia), la imagen casi nunca sale
—va en `enclosure` y la mitad la ignoran—, el formato lo decide el bot, y
mete a un tercero entre PokeDoc y el canal para leer algo que está en
NUESTRA base. El RSS se queda, que es lo correcto para quien nos lea
desde fuera; para el canal propio se lee la base y se manda directo.

**netlify/functions/telegram-noticias.mjs**, programada cada 5 minutos.
Con portada va como FOTO con pie (en Telegram una foto para el dedo); sin
portada, mensaje normal, que una foto rota es peor que ninguna. Si
Telegram rechaza la foto, reintenta sin ella: la noticia importa más.

**Lo que más cuidado lleva**:
- **El estreno del canal.** Sin protección, al encender las variables
  soltaría de golpe TODAS las noticias del archivo. Dos redes: la
  migración marca como mandado todo lo ya publicado, y la función manda
  cinco por pasada como mucho y solo lo de las últimas 48 h.
- **Ni repetir ni perder.** Si falla el envío no se marca y se reintenta;
  si se manda pero no se puede apuntar —el único caso que duplicaría— se
  canta con «MANDADA PERO NO APUNTADA».
- **Escapar el HTML.** Telegram rechaza el mensaje ENTERO si un «&» o un
  «<» del titular le rompe el parseo.
- **El pie de una foto son 1024 caracteres y pasarse no recorta:
  rechaza.** Se recorta aquí, y por un espacio.

**Migración**: supabase-migration-telegram-noticias.sql.

**Variables de entorno de Netlify** (las pone PINGU, NO van al repo):
TELEGRAM_BOT_TOKEN y TELEGRAM_CANAL_NOTICIAS, y TELEGRAM_TEMA_NOTICIAS
si el destino es un TEMA de un grupo. Sin las dos primeras la función no
hace nada y lo dice.

**Ojo con los «canales» de una comunidad**: normalmente NO son canales,
son TEMAS de un grupo, y eso no es un chat distinto — es el mismo grupo
con `message_thread_id`. Sin él el mensaje cae en el tema General. El
reintento sin foto también lo lleva, que si no se iría al General.

**Pruebas**: test-tanda-280.mjs (26).

---

## 2026-09-11 (7) — PINGU-Claude (tanda 279 — las imágenes del artículo, en diferido)

**Hecho**: PINGU avisó de que la noticia del set del 30 aniversario lleva
«muchísimas imágenes» — son 128 cartas. Se comprobó antes de que la
escribiera: las imágenes de los artículos NO llevaban `loading="lazy"`,
así que el navegador se las habría pedido las 128 de golpe al abrir. En
un móvil con datos, eso es la página parada, y se carga el trabajo de
las tandas 270-272 de servir el artículo rápido.

Ahora el saneador se las pone a todas MENOS a la primera. Esa no, a
propósito: suele ser la que se ve al entrar, y una imagen en diferido que
se ve de entrada tarda MÁS (el navegador no la empieza hasta saber dónde
cae). Es justo la que mide Google para el LCP.

`loading` y `decoding` entran en la lista blanca del saneador y en la del
repaso del servidor (meta-social), que si no los quitaba al servir.

**Ficheros**: js/richtext-format.js, netlify/edge-functions/meta-social.js.

**Comprobado**: con un artículo de 128 cartas — 127 en diferido, 1 a
plena carga. Las pruebas del editor (267, 268) y la del servidor (270),
verdes.

---

## 2026-09-11 (6) — PINGU-Claude (tanda 278 — Noticias, su propio apartado en el panel)

**Hecho**: PINGU: «necesito un apartado nuevo para las noticias, para no
liar la marrana, porque ahora si quiero escribir una noticia tengo que ir
al apartado de guía». Y en la tabla de Guías la noticia salía con una
categoría («Primeros pasos») que no significa nada.

Comparten tabla en la base —una noticia ES un artículo, esa decisión
sigue siendo la buena— pero son dos trabajos distintos: una guía se
escribe en una semana, una noticia en veinte minutos. Cada uno con su
pantalla.

**Panel → Noticias**, justo debajo de Guías. Tabla propia con las
columnas que importan de una noticia: titular, fecha de publicación y
estado — **sin categoría**, que aquí es ruido. Con «Ver» para abrirla
(solo si está publicada: un borrador no tiene dónde llevarte), enlace a
su hilo del foro cuando lo tiene, y «+ Nueva noticia» que abre el editor
ya puesto en noticia.

**Y la tabla de Guías se queda limpia**: filtra `kind = 'guide'`, con
vuelta atrás por si acaso.

Al borrar una noticia **no se borra su hilo del foro**: ahí puede haber
una conversación de otra gente, y llevársela por delante porque se
retira el artículo sería borrar lo que han escrito.

**Ficheros**: admin/index.html, admin/js/admin.js.

**Pruebas**: test-tanda-278.mjs (16).

---

## 2026-09-11 (5) — PINGU-Claude (tanda 277 — una noticia deja de disfrazarse de guía)

**Hecho**: PINGU entró en la primera noticia publicada y vio lo que
sobraba. Tres cosas, más el editor y la portada.

**En la noticia**: fuera «¿Te ha servido esta guía?» (una guía se valora
porque te ha enseñado algo; una noticia solo cuenta lo que ha pasado —
para opinar está el hilo del foro) y fuera la invitación a «Escribe tu
propia guía». El XP se sigue dando —leer es leer— pero el aviso ya no
dice «Guía leída» sino «Noticia leída». En una guía siguen estando las
tres, claro.

**El editor**: PINGU pidió uno igual pero solo con los campos que una
noticia tiene. NO se ha duplicado el editor: se esconden los campos que
no aplican (`data-solo-guia` + un repaso al cambiar el desplegable). Un
segundo editor con el 80% copiado son dos sitios donde arreglar cada
cosa y uno que se queda atrás. Queda: título, slug, portada,
descripción, tipo, estado y el cuerpo. Los campos escondidos siguen en
la página con su valor, así que lo que se guarda no cambia.

**Y de paso**: «Estado» y «Tipo de artículo» estaban enterrados en la
pestaña «Avanzado». Publicar no es una acción avanzada — suben al panel
General, detrás de la descripción. Mejora también el editor de guías.

**La portada**: tarjeta de la última noticia, con la misma pinta que la
del reto y la del torneo — cero CSS nuevo, que el presupuesto anda
justo. Se recoge sola si no hay ninguna. Portada en 154,0 KB de 170.

**Ficheros**: js/guia.js, admin/editor-guia.html, admin/js/editor-guia.js,
js/home.js, index.html.

**Pruebas**: test-tanda-277.mjs (25), incluida la de que una GUÍA
conserva lo que se le ha quitado a la noticia, y que al cambiar el
desplegable a guía vuelven todos los campos (se esconden, no se borran).

---

## 2026-09-11 (4) — PINGU-Claude (tanda 276 — la portada de verdad del vídeo)

**Hecho**: PINGU quería que el vídeo de YouTube enseñara su portada en
vez del cuadro azul con el play. Tenía razón: un cuadro liso no dice de
qué va el vídeo y es lo que hace que apetezca pulsar.

**El conflicto, y por qué no se hizo lo obvio**: la política de
privacidad promete EN NEGRITA que «mientras no lo reproduzcas, a YouTube
no se le pide absolutamente nada… sin la miniatura de Google». Un
`<img src="https://i.ytimg.com/…">` habría convertido esa frase en
mentira: cada visitante le daría a Google su IP y la página desde la que
mira, sin haber pulsado nada.

**Lo que se ha hecho**: la imagen la pide NUESTRO servidor
(netlify/functions/yt-portada.mjs, ruta /yt-portada?v=ID) y se sirve
desde pokedoc.es con caché de un año. Google ve una petición nuestra por
vídeo y por caché, no una por visitante. La promesa se mantiene, y de
paso la miniatura ya no depende de que nadie tenga bloqueado
i.ytimg.com, que hoy es media internet con bloqueador.

La política se ha reescrito para contarlo bien: «tu navegador no habla
con YouTube en ningún momento… te la servimos nosotros».

**Detalles que importan**: `maxresdefault` no existe para todos los
vídeos, así que se cae a `hqdefault`, que existe siempre (y viene en 4:3
con bandas negras, recortadas con object-fit: cover). YouTube devuelve
200 con una imagen gris diminuta cuando no tiene la que le pides, así que
se descarta por peso. Y el identificador se comprueba carácter a carácter
ANTES de meterlo en una dirección: sin eso esto sería un proxy abierto.

Si la miniatura no llega, el `<img>` se quita solo y queda la portada
dibujada de siempre — o sea, exactamente lo de antes.

**Ficheros**: nuevo netlify/functions/yt-portada.mjs. Tocados:
js/video-youtube.js, css/components.css, netlify.toml, privacidad.html.

**Pruebas**: test-tanda-276.mjs (24), con siete intentos de usar la
función como proxy abierto (../../etc/passwd, la IP de metadatos de la
nube, identificadores largos y cortos) y una que vigila que nadie vuelva
a meter i.ytimg.com en el cliente — si alguien lo hace, la política deja
de ser cierta y la prueba lo canta.

---

## 2026-09-11 (3) — PINGU-Claude (tanda 275 — «Guía no encontrada» al entrar en una noticia)

**Hecho**: PINGU publicó la primera noticia, el listado salió perfecto, y
al pinchar: «Guía no encontrada».

**La causa**: en `/noticias/<slug>` la dirección del NAVEGADOR no lleva
`?slug=`. La reescritura a guia.html la hace Netlify EN EL SERVIDOR y el
navegador no se entera — sigue viendo `/noticias/<slug>`, con la query
vacía. `js/guia.js` leía solo `window.location.search`.

Lo rabioso: la casa YA tenía esto resuelto para `/usuario/<nombre>`, con
`profileParamsFromLocation` en app.js, que mira primero la ruta y cae a
la query. Solo había que hacer lo mismo. Ahora está en
`slugDeArticuloEnLaUrl` (js/articulos.js), al lado del resto del
enrutado de noticias.

**El daño doble, y el segundo arreglo**: el servidor YA había pintado el
artículo bien (tanda 270) y el JavaScript lo sustituyó por el mensaje de
error. O sea que un fallo del cliente se cargó una página que estaba
bien. Ahora `guia.js` no pisa con «Guía no encontrada» si ya hay un
artículo pintado — vale más un artículo sin sus botones que un artículo
que no está. Eso cubre también el día que Supabase vaya lento.

**Ficheros**: js/articulos.js (helper nuevo), js/guia.js.

**Pruebas**: test-tanda-275.mjs (15). La que importa reproduce la
reescritura de Netlify tal cual —intercepta `/noticias/**` y responde
guia.html dejando la dirección intacta—, que es lo único que enseña el
fallo. Comprobado volviendo a poner el código viejo: falla.

---

## 2026-09-11 (2) — PINGU-Claude (tanda 274 — arreglo: `public.profiles` no existe)

**Hecho**: PINGU fue a publicar la primera noticia y le saltó
«No se pudo guardar la guía: relation "public.profiles" does not exist».
Fallo mío en supabase-migration-noticias.sql: el disparador que impide
que alguien de fuera del equipo marque un artículo como noticia buscaba
el perfil en `public.profiles`, y aquí la tabla se llama
**`public.user_profiles`** — como en las otras 17 migraciones que la
usan.

**Alcance**: solo crear o marcar una NOTICIA. Las guías normales no se
enteraban: la función se sale antes de llegar a la consulta cuando
`kind` es 'guide' o no cambia.

**Por qué pasó desapercibido**: el cuerpo de una función plpgsql NO se
comprueba al crearla. Postgres aceptó la migración sin una queja y el
fallo esperó hasta la primera ejecución, o sea hasta producción.

**Arreglo**: supabase-migration-noticias-arreglo.sql (solo redefine la
función; no toca datos). Y el fichero original corregido, para que
reejecutarlo no vuelva a meterlo.

**Y la red para que no se repita**: test-migraciones.mjs. Lee las 80
migraciones y comprueba que cada tabla que nombran la crea alguna de
ellas o está en la lista del esquema original (el que se montó a mano en
el panel antes de que hubiera migraciones: user_profiles, guides,
categories, achievement_definitions, user_notifications,
content_reports, page_views, tcg_cards, tcg_sets). No hace falta base de
datos para esto. Comprobado volviendo a meter el fallo a mano: lo canta
con fichero y línea.

Dos trampas al escribirla, anotadas en el propio fichero: hay que quitar
los comentarios antes de mirar nada (media migración de esta casa es
comentario y ahí se nombran tablas), y NO se puede usar un lookahead
para descartar funciones — con él, `references public.guides (id)` hacía
retroceder al motor hasta `public.guide` sin la s, y salían tablas
fantasma por todas partes.

**Ficheros**: nuevo supabase-migration-noticias-arreglo.sql; corregido
supabase-migration-noticias.sql.

**En curso / pendiente**: PINGU tiene que ejecutar el arreglo. Hasta
entonces no se puede publicar ninguna noticia.

---

## 2026-09-11 — PINGU-Claude (tanda 273 — el foro de Noticias y el hilo automático)

**Hecho**: PINGU ejecutó las migraciones y preguntó dos cosas: dónde se
crean las noticias (no encontraba el botón) y si convenía un subforo de
noticias con hilo automático por noticia, como los torneos.

**Dónde se escribe**: OJO, hay DOS editores y se confunden. El de la
comunidad (/editor-guia.html) no publica nunca; el que publica es
**/admin/editor-guia.html**. El desplegable «Tipo de artículo» estaba
puesto solo en el de la comunidad — ahora está en el de admin, que es el
que hace falta. Y en /noticias hay botón **«Escribir noticia»** para
administración, que abre el editor con `?tipo=noticia` ya puesto.

**El subforo**: `Comunidad › Noticias`, el primero del índice, con
`post_policy = 'staff'`. Importante entender qué hace esa política: en
`forum_threads_insert` decide quién ABRE temas, pero
`forum_posts_insert` NO la mira. O sea: nadie abre un hilo suelto y todo
el mundo comenta, que es exactamente lo que queremos.

**El hilo automático** (js/noticias-foro.js): al guardar una noticia
publicada se abre su hilo con portada, resumen y enlace al artículo. Es
RESUMEN a propósito — con el texto entero, dos páginas nuestras
competirían por la misma búsqueda. Dos diferencias con los torneos:
automático (si hay que pulsar un botón, la mitad se quedan sin hilo) y
guardando cuál es en `guides.forum_thread_id` (el torneo busca el suyo
por el título y se pierde si alguien lo renombra). Eso es además lo que
hace que guardar diez veces abra UN hilo. No lanza nunca: corre justo
después de guardar y un fallo ahí parecería que no se ha guardado la
noticia. Si falla el primer mensaje, deshace el hilo.

En la noticia sale «Comentar en el foro» junto a Guardar y Compartir.

**Migración**: supabase-migration-noticias-foro.sql —
`guides.forum_thread_id` (con `on delete set null`) y el foro «noticias».

**Ficheros**: nuevos js/noticias-foro.js y la migración. Tocados:
admin/editor-guia.html, admin/js/editor-guia.js, js/noticias.js,
noticias.html, css/noticias.css, js/guia.js.

**Pruebas**: test-tanda-273.mjs (32). Suite entera verde.

**En curso / pendiente**: PINGU tiene que ejecutar
supabase-migration-noticias-foro.sql. Sin ella la noticia se publica
igual, pero no se le abre hilo (queda avisado en consola). Y sigue
pendiente quitar los puentes de `kind` cuando la migración lleve tiempo.

---

## 2026-09-10 (2) — PINGU-Claude (tandas 270-272 — que las noticias existan)

**Hecho**: las tres piezas que quedaban de la sección de Noticias. PINGU
se fue a dormir pidiendo que estuviera hecho al despertar.

**270 — el cuerpo del artículo servido desde el servidor.** Era lo que
de verdad decidía si el plan funciona: `guia.html` llegaba vacía y el
texto lo pintaba el JavaScript, así que Google lo metía en su segunda
cola (de horas a días). La edge function `meta-social` ya se descargaba
el artículo para las etiquetas: ahora pinta también el texto, entre dos
marcadores nuevos de guia.html. Cero consultas de más. Con repaso propio
del servidor (`limpiarParaElServidor`, lista blanca) porque aquí no hay
DOMPurify y un `<img onerror>` se ejecutaría al parsear, antes de que el
JS lo sustituyera. Los cursos no se sirven —su teoría puede estar bajo
llave— y un artículo enorme se recorta a 60 KB por el final de una
etiqueta.

**271 — el canal RSS** (`/rss.xml`, netlify/functions/rss.mjs). Las 30
últimas, noticias y guías, con fecha en formato de correo (RSS 2.0 no
entiende ISO) y `guid` estable. Si Supabase se cae devuelve canal vacío
con 200: un 500 hace que algunos lectores se den de baja solos. Anunciado
con `<link rel="alternate">` en portada, /noticias, /aprender y artículo.

**272 — las noticias en el resumen semanal, y `dateModified`.** NO hay
correo por noticia a propósito: con tres o cuatro por semana, eso es la
vía rápida a que 150 personas se den de baja. El resumen semanal ya
tiene baja de un clic y dedupe; ahora lleva las noticias y van las
PRIMERAS, que son lo más perecedero. Una semana con noticias y foro
tranquilo ya sí manda correo. Y `dateModified` solo si de verdad se tocó
después de publicar.

**Ficheros**: nuevo netlify/functions/rss.mjs. Tocados:
netlify/edge-functions/meta-social.js, netlify/functions/resumen-semanal.mjs,
netlify/lib/email.mjs, netlify.toml, guia.html (marcadores del artículo),
index.html, noticias.html y aprender.html (el `<link>` del canal).

**Pruebas**: test-tanda-270.mjs (39, con once vectores de ataque contra
el repaso del servidor), test-tanda-271.mjs (20) y test-tanda-272.mjs
(22). Suite entera verde.

**El puente, en los cuatro sitios**: portada/aprender/categorías,
sitemap, meta-social (`updated_at`) y RSS y resumen tienen vuelta atrás.
Sin ellos, desplegar antes del SQL dejaba respectivamente: páginas
vacías, sitemap caído, TODO el sitio sin etiquetas sociales, canal vacío
y resumen semanal sin salir.

**En curso / pendiente**: PINGU tiene que ejecutar
supabase-migration-noticias.sql (y las cinco anteriores). Hasta entonces
todo aguanta pero no hay noticias. Queda, si se quiere: botón de
«anunciar en el foro» por noticia (hoy existe para torneos), y quitar los
puentes cuando la migración lleve tiempo puesta.

---

## 2026-09-10 — PINGU-Claude (tanda 269 — la sección de Noticias)

**Hecho**: PokeDoc empieza a publicar noticias en español. Decisión de
fondo (de PINGU, y es exacta): **un artículo es una guía**, así que no
hay tabla nueva — una noticia es una fila de `guides` con
`kind = 'news'`. Mismo editor, misma página de lectura, mismo índice.
Cambia el traje: vive en `/noticias/<slug>`, se lista por fecha en
`/noticias`, las migas pasan por Noticias, lleva `NewsArticle` con
fecha en vez de `Article`, y publicar es **solo de administración** (con
disparador en la base, no un `if` en el navegador).

El listado: la última grande a todo el ancho y el resto en rejilla de
tres columnas (dos en tablet, una en móvil). La portada grande aquí sí y
en las guías no, porque todas las noticias llevan imagen.

**Lo que más cuidado tiene**: el puente de la migración. Netlify publica
al empujar y el SQL lo ejecuta una persona después; en ese hueco `kind`
no existe y una consulta que la filtre DA ERROR, no cero filas. Sin red,
ese despliegue deja la portada, /aprender y las categorías en blanco.
`conVueltaAtrasDeTipo` en js/articulos.js repite sin filtro si la columna
no está, y el sitemap lleva lo mismo.

**Migración**: supabase-migration-noticias.sql — columna `kind` con su
check y sus índices parciales, disparador de «solo admin publica
noticias», y `updated_at` con disparador (para `dateModified`, que se
enchufa en la siguiente).

**Ficheros**: nuevos js/noticias.js, js/articulos.js, css/noticias.css,
noticias.html, supabase-migration-noticias.sql. Tocados: js/home.js,
js/aprender.js, js/categoria.js, js/guia.js, js/editor-guia.js,
js/icons.js (icono `newspaper`), editor-guia.html, netlify.toml,
netlify/functions/sitemap.mjs, netlify/edge-functions/meta-social.js, y
la barra de navegación de las 22 páginas. **guia.html pasa a enlaces
absolutos** — servida en /noticias/algo, una ruta relativa se buscaría
en /noticias/css/.

**Pruebas**: test-tanda-269.mjs (33) y rigor-tanda-269.py (17
mutaciones). Suite entera verde (36). Portada en 152,3 KB gzip de 170.
El doble aprendió a fingir que una columna no existe
(`__COLUMNAS_QUE_FALTAN__`), que es lo único que prueba el puente de
verdad.

**En curso / pendiente**: (1) PINGU tiene que ejecutar
supabase-migration-noticias.sql — hasta entonces el puente aguanta pero
no hay noticias; (2) el cuerpo del artículo servido desde el servidor,
que es lo que de verdad decide si esto funciona para SEO; (3) RSS; (4)
`dateModified`; (5) aviso por campanita y correo de cada noticia. Y
siguen esperando las cinco migraciones anteriores de la raíz.

---

## 2026-09-09 (2) — PINGU-Claude (tanda 268 — la imagen, una pieza)

**Hecho**: PINGU volvió con «sigue yendo fatal» después de la 267, y
tenía razón: el botón de la fila ya iba, pero el fallo gordo estaba
debajo. Una `<figure>` editable es, para el navegador, un párrafo más.
Con la fila ya hecha: Backspace al principio del párrafo de debajo se
llevaba EL PÁRRAFO ENTERO; Ctrl+A y escribir encima metía la guía dentro
de una figura con las letras desordenadas; pinchar entre dos cartas y
escribir perdía lo escrito; las flechas con una carta elegida no hacían
nada; y quitar una carta dejaba el hueco. Se reprodujo conduciendo el
editor como una persona, no mirando el HTML.

Arreglo: las imágenes y las filas pasan a ser PIEZAS
(`contenteditable="false"`), igual que las listas de cartas y los vídeos,
que ya lo eran desde el principio y por eso se portaban bien. Es lo que
hacen Medium, Notion y WordPress. Alrededor hizo falta: Backspace/Supr
en dos pasos junto a una pieza (elige, y luego quita), Ctrl+A propio (el
del navegador no selecciona NADA si lo primero del artículo no es
editable), borrado a mano de una selección que abarque piezas (ahí el
navegador se queda quieto y parece colgado), y el cursor colocado en el
`mousedown` y arriba o abajo según dónde pinches. Y de paso: ↑↓ dentro de
una fila mueven la carta (y se llaman ←→), quitar una carta ajusta las
columnas, y un artículo nunca termina en pieza.

**Ficheros**: js/richtext-editor.js. Nada de CSS ni de base.

**Pruebas**: test-tanda-268.mjs (44) y rigor-tanda-268.py (15
mutaciones). Suite entera verde (35). El mismo editor lo usa el foro, así
que esto toca también temas y respuestas.

**En curso / pendiente**: nada de esta tanda. Siguen esperando las cinco
migraciones de la raíz, sobre todo
supabase-migration-torneos-abiertos.sql.

---

## 2026-09-09 — PINGU-Claude (tanda 267 — imágenes en fila en el editor)

**Hecho**: «el editor se vuelve loco, quiero hacer algo tan sencillo como
poner cartas en fila de 3 y se vuelve loco, me dice que no se puede o se
pone abajo en vez de en la fila». Las dos frases eran el MISMO fallo, y
se reprodujo antes de tocar nada: varias imágenes pueden acabar dentro
del mismo `<p>` (pegadas de otra web, o subidas de golpe), y el editor
solo sabía tratar «un párrafo con UNA imagen». Con tres dentro,
«Fila de 3» no encontraba nada que juntar, pero antes de avisar ya había
sacado la elegida del párrafo dejándola DEBAJO de las otras dos: de ahí
las dos quejas a la vez. Y pegar tres cartas las sacaba de una en una,
así que salían del revés (3, 2, 1), cada una en su línea y sin juntarse.

Ahora un párrafo que solo lleva imágenes se trata como lo que es —una
pila de imágenes, cada una un bloque— y se desmonta entero y en orden
antes de tocar ninguna. «Fila de N» cuenta las candidatas ANTES de mover
nada: si de verdad no hay nada que juntar, avisa y no toca el documento
(antes movía la imagen y encima avisaba). De propina: el cursor se queda
detrás de la fila recién hecha (se caía al principio del artículo, así
que lo siguiente que escribías salía arriba del todo) y añadir una carta
a una fila de 3 ya no la devuelve sola a 4 columnas.

**Ficheros**: js/richtext-editor.js. Nada de CSS ni de base.

**Pruebas**: test-tanda-267.mjs (37/37, contra el editor montado a pelo
en una página de laboratorio nueva, rte-lab.html) y rigor-tanda-267.py
(12 mutaciones). La suite entera, 34 verdes. Con el código de antes esa
prueba da 23 fallos.

**En curso / pendiente**: nada de esta tanda. Sigue pendiente que PINGU
ejecute supabase-migration-torneos-abiertos.sql (y las otras cuatro que
esperan en la raíz).

---

## 2026-09-08 — PINGU-Claude (tanda 266 — crear torneos, abierto a todos)
**Hecho**: a un usuario no le salía la opción de crear torneo. NO era
solo el botón: `torneos_escribir` pedía ser admin del SITIO en
`tournaments` Y en las tablas del ciclo, así que quitar el `if` habría
enseñado un formulario de cinco pasos que acaba en un INSERT rechazado
EN SILENCIO. Hace falta migración:
supabase-migration-torneos-abiertos.sql. (1) Las políticas de escritura
pasan a «admin del sitio O dueño del torneo» en tournaments, rounds,
tournament_matches, match_results y pairing_history, con una función
`torneos_es_mio(uuid)` para no repetirlo cinco veces; el organizador de
su torneo también puede expulsar inscritos. (2) Columna `is_official`:
«oficial» ya no se deduce de si el creador es admin —con torneos de
cualquiera eso deja de valer, y además un admin quiere poder montarse
una pachanga SIN el sello—. Es una casilla que solo ve administración,
con disparador que revierte el valor a quien no es admin (el mismo
patrón que `is_moderator`). Los torneos ya creados por un admin se
quedan oficiales con un update, para que la Copa Inaugural no pierda
la chapa.
**Ficheros**: supabase-migration-torneos-abiertos.sql (NUEVO),
js/torneos/torneos.js, js/torneos/torneo.js, torneos.html. Fuera del
repo: test-tanda-266.mjs (NUEVO).
**En curso / pendiente**: **FALTA EJECUTAR LA MIGRACIÓN.** Hasta
entonces el botón sale para todos pero un usuario normal NO podrá crear
—la base lo rechaza en silencio—, así que conviene ejecutarla ANTES de
anunciarlo. El cliente aguanta el rato intermedio: si `is_official` no
existe todavía, `esOficial` se cae al criterio viejo (lo creó un admin)
y la chapa no se mueve. Verificado: 14 comprobaciones en verde y la
suite entera (33) en verde. Actualizada test-tanda-252, que exigía que
un usuario normal NO pudiera crear: esa regla ha cambiado a propósito.
Sin rigor todavía en esta tanda: entra en la próxima pasada.

## 2026-09-07 — PINGU-Claude (tanda 265 — un mazo también se llama por un objeto)
**Hecho**: PINGU jugó «Dragapult Hammer» y el arquetipo salió
«Dragapult Budew». Causa de raíz: `deducirIconos` miraba SOLO
`parsed.pokemon`, y el nombre de ese mazo viene de un TRAINER (el
Crushing Hammer). Al no poder verlo, el segundo icono se lo llevaba el
mejor Pokémon suelto que quedara — Budew, una carta de estorbo que no
es el mazo de nadie. Dos arreglos: (1) los objetos de OBJETOS_TCG —la
lista corta de cartas con sprite propio— entran como candidatos, con
sus copias sumadas y enseñando el nombre CANÓNICO (el inglés), para que
un export en español no parta el mismo mazo en dos casillas; (2) Budew,
Manaphy, Cleffa, Mimikyu y Klefki se van a MOTORES. Un Trainer
cualquiera sigue sin nombrar nada: cuatro Ultra Ball no son un mazo.
**Ficheros**: js/torneos/arquetipos.js. Fuera del repo: test-tanda-261
y rigor-tanda-261 ampliados.
**En curso / pendiente**: verificado — 16 mutaciones del rigor pilladas
(dos anclas se habían quedado obsoletas al reescribir la puntuación en
la 261, y una mutación —el parentesco en un solo sentido— no se
detectaba porque el caso de la prueba se salvaba por otro camino: hacía
falta una evolución ANTES que su base y con distinto número de
Pokédex) y la suite entera (32) en verde. **Queda un hueco conocido**:
`claveCanonicaDeMazo` saca la firma solo de los Pokémon del nombre, así
que en el histórico «Dragapult Hammer» y «Dragapult» a secas caen en la
misma casilla. Se puede arreglar metiendo los objetos en la firma, pero
eso mueve partidas ya apuntadas de sitio y hay que decidirlo aparte.

## 2026-09-07 — PINGU-Claude (tanda 264 — abrir el foro de Intercambios)
**Hecho**: alguien abrió un tema de intercambio y PINGU preguntó si
hacía falta un subforo nuevo y cómo llamarlo. NO hacía falta: el foro
«Intercambios» EXISTE desde supabase-migration-foro.sql, en la sección
«Colección», con `is_hidden = true` — se dejó preparado a propósito
para abrirlo el día que hiciera falta. Solo hay que quitarle el
candado: supabase-migration-abrir-intercambios.sql (un update de una
línea, reversible). Las etiquetas «Intercambio» y «Compra/Venta» ya
están en ETIQUETAS de js/foro-comun.js, así que tampoco hay que tocar
nada de código.
**Ficheros**: supabase-migration-abrir-intercambios.sql (NUEVO).
**En curso / pendiente**: PENDIENTE DE EJECUTAR por PINGU. Recomendado
NO crear subforos todavía (un tema no da para dividir) y usar las
etiquetas; los subforos, si algún día hay volumen. Y queda dicho lo
importante: un foro de intercambios trae estafas tarde o temprano, así
que conviene abrirlo con dos o tres normas escritas y fijadas arriba
—cómo se envía, qué se hace si alguien no cumple— antes que después.

## 2026-09-04 — PINGU-Claude (tanda 263 — la cabecera del perfil, colocada)
**Hecho**: la vitrina de la 262 quedaba descolocada en el móvil. Estaba
DENTRO de la columna del nombre, que comparte sitio con el avatar de
96 px y se queda en unos 200: las medallas salían centradas mientras
todo lo demás iba a la izquierda, y el resumen se partía en TRES
renglones. Se probó a meterla en .profile-hero-body con
`flex-basis: 100%` y salió peor: ese contenedor solo hace `wrap` por
debajo de 640 px, así que en ESCRITORIO se metía en la misma línea y
aplastaba la columna del nombre hasta dejar «Ash» en vertical, una
letra por renglón. Al final va como fila hermana, DESPUÉS del bloque
del avatar y antes de la barra de seguidores: a todo el ancho y sin
depender del flex de nadie. Además el resumen se acorta («1 torneo» en
vez de «1 torneo jugado») y —lo que más desequilibraba la captura de
PINGU— el BANNER VACÍO baja de 160 px a 96: sin foto eran 160 px de
nada que dejaban la cabecera medio vacía. Con foto se quedan los 160.
**Ficheros**: js/usuario.js, css/perfil.css.
**En curso / pendiente**: verificado a 393 px y a 1100 px, y la suite
entera (32) en verde. La prueba ahora EXIGE la colocación: que el
resumen no pase de dos renglones, que el nombre no se ponga en
vertical y que la fila esté fuera del bloque del avatar — las dos
formas de romperlo que ya han pasado. AVISO aparte: test-tanda-255
llevaba un fallo dependiente de la hora del día (sembraba el torneo a
«+30 horas» y esperaba «Mañana»; a las 00:15 eso cae en pasado
mañana). Corregido a «mañana a mediodía» de calendario.

## 2026-09-04 — PINGU-Claude (tanda 262 — medallas de torneo y vitrina en el perfil)
**Hecho**: PINGU vio «Torneos jugados: 1Podio» en su perfil. Eran DOS
cosas: faltaba el separador, y —la de fondo— las reglas de esas chapas
vivían en css/torneos.css, que usuario.html NO carga: la clase estaba
puesta y no llegaba ningún estilo. Mudadas a css/perfil.css, que ahora
sí carga usuario.html. Y lo pedido: MEDALLAS. Decisión suya: por HITOS
acumulados, no una por torneo (con veinte al año no distinguiría a
nadie). Cuatro logros nuevos —Al podio, Veterano (5), De la casa (10),
Tricampeón (3)— junto a los tres de la tanda 208, todos con condición
`manual` y concedidos por la ficha del torneo. Ganar NO cuenta además
como podio. En el perfil, la línea de texto se sustituye por una
VITRINA: las medallas con su color de rareza y su explicación al pasar
el ratón, y debajo el resumen («2 torneos jugados · 1 campeonato · 1
podio · a 3 de Veterano»).
**Ficheros**: js/torneos/palmares.js (NUEVO, puro),
supabase-migration-torneos-medallas.sql (NUEVO), js/torneos/torneo.js,
js/usuario.js, usuario.html, css/perfil.css, css/torneos.css,
SCHEMA.md. Fuera del repo: test-tanda-262.mjs (NUEVO),
rigor-tanda-262.py (NUEVO), y el doble aprende logros
(`__FAKE_LOGROS__` y `achievements` por persona).
**En curso / pendiente**: verificado — 35 comprobaciones en verde, 15
mutaciones del rigor pilladas y la suite entera (32) en verde. **FALTA
EJECUTAR supabase-migration-torneos-medallas.sql**: hasta entonces los
cuatro logros nuevos no existen y solo se conceden los tres de siempre
(no rompe nada, simplemente no aparecen). LECCIÓN de esta tanda, que va
para la próxima que toque CSS: una regla escrita no es una regla
aplicada — la prueba mira `getComputedStyle`, porque comprobando solo
la clase pasaba en verde sin que se viera nada.

## 2026-09-04 — PINGU-Claude (tanda 261 — los arquetipos, con datos de evolución de verdad)
**Hecho**: PINGU vio en el torneo inaugural que un mazo de Mega Lucario
y Mega Zygarde salía como «Mega Zygarde Riolu» y un Latias/Slowking
como «Latias ex Slowpoke»: las dos veces ganaba la PREEVOLUCIÓN, que
lleva más copias. La causa eran dos adivinanzas —una lista de nombres
penalizados a mano (sin «riolu» ni «slowpoke», y no podía tenerlos
todos) y la regla de «una preevolución está en los tres números
anteriores de la Pokédex», que falla con Slowpoke 79 → Slowking 199—.
Ahora hay DATO: js/torneos/evoluciones.js con 456 preevoluciones
sacadas de los datos de especies de Pokémon Showdown, por número de
Pokédex. Y el criterio pasa a ser el de Limitless: las cartas se
agrupan por LÍNEA evolutiva, cada línea vale sus copias más un
suplemento por el nombre (ex +5, Mega +8), se llama por su carta más
evolucionada, y se enseñan las dos mayores. Los motores (Bibarel,
Lumineon, Squawkabilly, Fezandipiti, Rotom…) se apartan aparte.
**Ficheros**: js/torneos/evoluciones.js (NUEVO), js/torneos/arquetipos.js,
SCHEMA.md. Fuera del repo: test-tanda-261.mjs (NUEVO),
rigor-tanda-261.py (NUEVO).
**En curso / pendiente**: verificado — 32 comprobaciones en verde, las
11 mutaciones del rigor pilladas y la suite entera (31) en verde. OJO
con la lista de MOTORES: es la única a mano que queda y tiene que
seguir siendo corta — con una más larga se colaron Pidgeot («Charizard
Pidgeot») y Munkidori («Gardevoir Munkidori»), que SÍ nombran mazos.
El catálogo curado sigue mandando y la clave canónica del histórico no
cambia, así que las partidas ya apuntadas se quedan donde están.
**NO se ha podido sacar nada de Limitless directamente**: desde este
contenedor no hay salida a internet salvo npm y pypi, así que lo que se
ha replicado es su CRITERIO, no su lista de arquetipos. Si PINGU quiere
sus nombres exactos, hay que meterlos en el catálogo (tcg_archetypes) a
mano o por migración.

## 2026-09-04 — PINGU-Claude (tanda 260 — los botones del organizador, una sola vez)

**Hecho**: culpa mía, secuela directa de la 259. Al dejar de vaciar
`#torneoAdminAcciones` en cada refresco, TODO lo que se le añade con
`insertAdjacentHTML` se acumulaba. En la 259 arreglé dos casos
(«Añadir al calendario» y la zona del anuncio) pero se me pasaron tres:
**Editar**, **Cancelar torneo** y **Borrar torneo** — PINGU mandó
captura con cuatro «Cancelar torneo» y cuatro «Borrar torneo» en fila.
Ahora los tres pasan por `anadirAccion(acciones, procede, id, html,
enganchar)`, que pone el botón solo si no está Y lo QUITA si deja de
proceder (antes desaparecía porque la caja se vaciaba entera).
**Ficheros**: js/torneos/torneo.js.
**En curso / pendiente**: comprobado que no se duplican tras cuatro
refrescos (como organizador y como jugador) y que salen solo cuando
toca: con inscripciones abiertas sí, con el torneo cancelado o
terminado no. 15 pruebas de torneos, sondeo y tiempo real en verde.
**NORMA para el que venga**: cualquier cosa que se añada a
`#torneoAdminAcciones` tiene que ir por `anadirAccion` — esa caja ya no
se limpia sola. Y sigue faltando la prueba que exija «un refresco sin
cambios no toca el DOM ni añade nada», que es lo que habría cazado esto
sin que lo viera un humano en producción.

## 2026-09-04 — PINGU-Claude (tanda 259 — el parpadeo, ahora de raíz)

**Hecho**: la 258 no bastó, PINGU seguía perdiendo clics. En vez de
seguir adivinando, se MIDIÓ con un MutationObserver: un refresco sin
ningún cambio de datos destruía y regeneraba **25 trozos de página**.
La 258 solo había tapado tres de ellos. Los gordos que faltaban:
`#miPartidaExtra` —el chat de la mesa y «Llamar al juez», que están
JUSTO debajo de los botones de Victoria y Derrota, así que al
regenerarse con otra altura los movían de sitio—, `#torneoPestanas`
(lo primero de la página), `#rondasAdmin` (el reloj y los botones del
organizador, encima de todo), `#listaInscritos`, `#miPlazaContenido`,
`#decklistContenido` y `#juecesContenido`. Ahora hay un ayudante común
(js/torneos/pintar.js, `pintarSiCambia`/`textoSiCambia`) y lo usan
todas: si el HTML sale igual, NO se toca el DOM. **De 25 mutaciones a
4**, y las 4 que quedan son los dos relojes, que cambian de verdad cada
segundo y no mueven nada (ancho fijo).
**Ficheros**: js/torneos/pintar.js (NUEVO), js/torneos/torneo.js,
js/torneos/ronda.js, js/torneos/jueces.js.
**En curso / pendiente**: OJO al efecto secundario, que la medición
cazó: al dejar de vaciar `#torneoAdminAcciones` en cada pasada, el
botón «Añadir al calendario» se duplicaba (1 → 5 en cuatro refrescos)
porque se añadía con `insertAdjacentHTML` confiando en que la caja se
limpiaba sola. Arreglado haciéndolo idempotente, y lo mismo con la zona
de «Anunciar en el foro». **Si se añade algo más a esa caja, tiene que
mirar si ya está.** El chat tampoco se remonta ya: deja su
`refrescarMensajes` en el propio nodo y quien refresca lo llama — sin
eso, no remontarlo sería no volver a ver un mensaje nuevo. Comprobado:
15 pruebas de torneos, sondeo y tiempo real en verde; sin duplicados
tras cuatro refrescos como jugador y como organizador; y cuando SÍ
cambia algo (entra tu reporte) el bloque se repinta igual que antes.
Falta prueba propia que exija «un refresco sin cambios no toca el DOM».

## 2026-09-04 — PINGU-Claude (tanda 258 — la ficha dejaba de parpadear)

**Hecho**: URGENTE, en mitad del torneo inaugural. La pantalla de la
ronda parpadeaba y se perdían clics en los botones de Victoria y
Derrota. Dos causas sumadas: (1) cada refresco tiraba el `innerHTML` de
«Tu partida», «Mesas» y la clasificación y lo volvía a poner IDÉNTICO,
o sea que los botones eran nodos nuevos cada vez y un clic a destiempo
se perdía o caía en el que no era; y (2) no se refresca cada 10 s como
parecía, sino con CADA evento en vivo de `tournament_matches`,
`match_messages`, `match_reports` y `match_results` —sin filtrar por
torneo—, de forma inmediata y encima solapada (`recargar()` es
asíncrona y nada impedía que arrancase otra antes de acabar). Con gente
chateando y reportando, varios repintados por segundo. Arreglado: se
guarda lo último pintado en cada caja y si el HTML sale igual NO se
toca el DOM (se compara lo que se va a pintar, no lo que hay en la
caja: los sprites de arquetipo se rellenan después y leyendo el DOM de
vuelta nunca coincidiría); y los refrescos van de uno en uno, juntando
las ráfagas en uno solo al final —sin perder avisos, que el último trae
el estado de todos—. De regalo, el reloj de ronda ya no se resetea a
«–:––» en cada repintado.
**Ficheros**: js/torneos/ronda.js, js/torneos/torneo.js.
**En curso / pendiente**: comprobado con el doble ANTES y DESPUÉS: sin
el cambio el botón de Victoria se destruía en cada refresco, con él el
MISMO nodo sobrevive a cinco seguidos (y verificado que los refrescos
ocurren de verdad, 50 consultas). Cuando sí cambia algo —entra tu
reporte— el bloque se repinta igual que antes. 13 pruebas de torneos,
sondeo y tiempo real en verde. PINGU dice que en el móvil no se
notaba, solo en PC. Sin prueba propia de esto todavía: hay que añadir
una que exija que un refresco sin cambios NO toque el DOM, que es la
garantía que se acaba de ganar.

## 2026-09-04 — PINGU-Claude (tanda 257 — corregir tu usuario de TCG Live)

**Hecho**: urgente, lo reportó un usuario. El usuario de TCG Live se
escribía UNA vez al inscribirse y no había forma de tocarlo: quien se
equivocaba de letra se quedaba con el nombre malo, y con ese nombre es
con el que su rival lo busca dentro del juego — o sea que una errata
era no poder jugar la partida. Ahora en «Tu plaza» hay un «Cambiarlo»
que abre el campo con el valor actual, tanto si estás inscrito como si
estás en la lista de espera. Es un update normal (la política ya deja a
cada cual editar SU inscripción, la misma con la que uno se da de baja)
y pide de vuelta la fila, que un update rechazado no da error.
Y se cierra al EMPEZAR el torneo (mismo criterio que
`canEditDecklist`): con el torneo en juego el nombre ya está en los
pareos y en las mesas, y cambiarlo sería quitarle al rival la forma de
encontrarte a mitad de partida. El candado está en los dos sitios —el
botón no sale, y antes de escribir se vuelve a comprobar, porque la
ficha se refresca sola y el torneo puede empezar con el formulario
abierto delante—. Las decklists ya lo tenían contemplado de antes.
**Ficheros**: js/torneos/torneo.js.
**En curso / pendiente**: probado a mano con el doble en los dos
estados (inscrito y en cola) y en los cuatro del torneo (abierto y
cerrado sí, en juego y terminado no), y las cinco pruebas de torneos
siguen en verde. Sin prueba propia todavía: entra en la próxima
pasada. Queda un hueco de verdad: si a alguien se le cuela la errata
hasta la primera ronda, hoy NO hay forma de arreglárselo — el juez
tampoco puede editar el usuario de TCG Live de un inscrito.

## 2026-09-04 — PINGU-Claude (tanda 256 — moderar desde la lista de temas)
**Hecho**: PINGU va a nombrar moderadores para el foro y la web no
estaba preparada para que trabajaran: el rol `is_moderator` existía y
las políticas ya decían «el equipo», pero TODAS las herramientas
vivían dentro de cada tema (para etiquetar diez hilos había que abrir
diez hilos) y mover un tema de foro no se podía hacer de ninguna
manera. Ahora, en la lista de temas y solo para el equipo: una CASILLA
por tema con barra de acciones en lote (a la vista Mover y Etiqueta,
que es el trabajo diario; fijar/cerrar/borrar detrás de «Más», que con
los siete botones la barra ocupaba media pantalla en el móvil), un
MENÚ «⋯» por tema (editar título y etiqueta, mover, editar el primer
mensaje, fijar, cerrar, borrar) y MOVER a otro foro o subforo, suelto
o en lote, con el destino agrupado por secciones —reutilizando
`opcionesDeForos`/`ordenarForos` de js/torneos/anuncio-foro.js, que ya
estaban probadas—. **Sin migración**: `forum_threads_update` ya deja al
equipo, y el disparador `forum_solo_staff_modera` ya contemplaba
`board_id`; lo que faltaba era el botón. Los foros ESCONDIDOS solo se
le ofrecen a administración (y marcados «(oculto)»): un foro sin abrir
es decisión de producto, no de moderación. El editor de mensajes NO se
trae a la lista —pesa y la lista la abre todo el mundo—: «editar el
primer mensaje» lleva al tema con `?editar=primero`, que tema.js
reconoce y limpia de la URL.
**Ficheros**: js/foro-moderar.js (NUEVO), css/foro.css (NUEVO, aparte
de components.css a propósito), js/foro.js, js/foro-comun.js (gana
`rolEnElEquipo`: staff y admin en la MISMA consulta que ya se hacía),
js/tema.js, js/icons.js (icono `moreHorizontal`), foro.html, SCHEMA.md.
Fuera del repo: test-tanda-256.mjs (NUEVO), rigor-tanda-256.py (NUEVO),
y el doble aprende dos cosas —rechazar un UPDATE en silencio
(`__RLS_SIN_TOCAR__`) y tener una persona moderadora que no es
administradora—.
**En curso / pendiente**: verificado — 60 comprobaciones en verde y las
24 mutaciones del rigor pilladas. OJO con lo de siempre: un UPDATE que
la política rechaza NO da error, así que las tres escrituras piden de
vuelta las filas y comparan la cuenta; si no cuadra se dice, en vez de
cantar «movido» sin haber movido nada. Sigue SIN haber botón para
nombrar moderador: hoy es un `update` a mano en el SQL Editor
(`update public.user_profiles set is_moderator = true where username =
'...'`). Y siguen sin ejecutar
supabase-migration-torneos-publico.sql, -partidas-cerrar.sql y
-partidas-editar.sql.

## 2026-09-03 — PINGU-Claude (tanda 255 — la portada cuenta que hay torneos, y el sondeo adelgaza)
**Hecho**: dos remates de la apertura del 2026-09-02. (1) La PORTADA no
decía ni una palabra de la sección «Jugar»: ahora enseña el próximo
torneo con inscripciones abiertas (uno, el que antes se juega), con
cuándo se juega en relativo —«Mañana a las 19:00»— y las plazas libres
si hay aforo. Sin torneo abierto la sección se recoge y la portada
queda igual que estaba. Cero CSS nuevo: reutiliza `.reto-tarjeta` del
reto (la portada pasa de 148,8 a 149,9 KB gzip de los 170).
(2) El SONDEO de la ficha pedía en cada refresco, para TODO el que
mirase, cosas que solo sirven a quien juega o arbitra. Ahora
`judge_calls` va solo a organizador y jueces (la cola entera) y a quien
juega (solo las SUYAS, por `created_by`); `match_reports` solo a quien
puede hacer algo con ellos; y la decklist propia solo si estás
inscrito. `match_results` NO se toca: es el marcador y la
clasificación, o sea lo que un espectador viene a ver. Medido:
espectador con cuenta 9 → 6 consultas por refresco, sin cuenta 7 → 5;
el organizador, igual que antes.
**Ficheros**: index.html, js/home.js, js/torneos/jueces.js,
js/torneos/ronda.js, js/torneos/torneo.js, SCHEMA.md. Fuera del repo:
test-tanda-255.mjs (NUEVO), rigor-tanda-255.py (NUEVO), el doble
(stub-supabase.js) aprende a apuntar por qué columna se filtró cada
consulta, y correr-suite.sh incorpora las pruebas de las tandas 247 a
255, que estaban escritas pero no en la lista.
**En curso / pendiente**: verificado — 39 comprobaciones en verde y las
17 mutaciones del rigor pilladas. Al pasar la suite entera aparecieron
TRES pruebas viejas en rojo que NO son regresiones: probaban cosas
cambiadas a propósito después (la CDN de sprites, que pasó de PokeAPI a
Limitless en la 236; los arquetipos de catálogo, que Ibai quitó del
buscador en la 238; y el texto de quien mira sin cuenta, que desde la
252 invita a REGISTRARSE y no a entrar). Comprobado que ya estaban
rojas SIN mis cambios y puestas al día. **Nada de esto es una
protección**: quién ve qué lo sigue diciendo la política de la base.
Sigue sin ejecutar `supabase-migration-torneos-publico.sql`,
`supabase-migration-partidas-cerrar.sql` y
`supabase-migration-partidas-editar.sql` — los tres esperan a un
humano en el SQL Editor. Y el puente `faltaLaRpc` de
js/torneos/comun.js sigue siendo temporal: cuando la migración de
apertura lleve un tiempo puesta, fuera.

## 2026-09-03 — PINGU-Claude (tanda 254 — parejas con respuestas repetidas)
**Hecho**: un alumno reportó que en un curso de cartas falsas, con dos
señales que responden «Original» y dos «Falsa», unir una señal con «la
otra» respuesta idéntica se marcaba como fallo. La causa:
`renderMatch` pintaba un botón por PAREJA y `setupMatch` comparaba por
número de pareja (`dataset.pair`), así que salían dos botones iguales y
solo uno valía. Además de injusto, hacía el bloque irresoluble
sabiéndoselo: había que adivinar cuál de los dos idénticos era el
bueno. Ahora se compara por RESPUESTA normalizada y las respuestas
repetidas son UN botón que recibe tantos términos como le toquen (no se
apaga hasta gastarse; mientras tanto da un destello verde). Con
respuestas todas distintas no cambia nada.
**Ficheros**: js/curso.js, js/curso-juego.js (`normaliza` pasa a
exportarse), css/curso.css, SCHEMA.md. Fuera del repo:
test-tanda-254.mjs (NUEVA), rigor-tanda-254.py (NUEVO).
**En curso / pendiente**: verificado — 21 comprobaciones en verde y las
8 mutaciones del rigor pilladas a la primera. OJO: es la PRIMERA prueba
que tiene un curso. CLAUDE.md lleva avisando desde agosto de que
guías, cursos, perfiles y portada están sin cobertura, y este fallo lo
ha encontrado un alumno, no nosotros — el resto del motor de cursos
(quiz, ordenar, clasifica, zonas, memoria…) sigue sin nada.
PENDIENTE de PINGU, de tandas anteriores: ejecutar
supabase-migration-partidas-cerrar.sql y
supabase-migration-partidas-editar.sql (tanda 251).
IBAI: sigue pendiente tu pasada de suite sobre ronda.js y torneo.js.

## 2026-09-03 — PINGU-Claude (tanda 253 — el aviso de corrección)
**Hecho**: PINGU recibió un aviso de «te sugieren una corrección» y al
pulsarlo acabó en su perfil sin ver nada. El aviso enlazaba a
`/perfil.html#guides` y perfil.js solo sabía abrir la pestaña con
`#torneos`: los demás hashes se ignoraban en silencio. Ahora el hash es
genérico (cualquier pestaña por su nombre, buscando el botón entre los
que hay en vez de construir un selector con el texto), el aviso lleva la
guía (`?sugerencias=<id>`) y el perfil abre directamente el panel de esa
corrección, y el parámetro se limpia de la URL al abrirlo. El enlace va
a `/perfil` SIN extensión: con `.html` hay redirección y la query se
puede perder por el camino.
**Ficheros**: js/perfil.js, js/guide-suggestions.js, SCHEMA.md. Fuera
del repo: test-tanda-253.mjs (NUEVA), rigor-tanda-253.py (NUEVO),
stub-supabase.js (tablas guides y guide_suggestions).
**En curso / pendiente**: verificado — 23 comprobaciones en verde y las
6 mutaciones del rigor pilladas (tres se escaparon a la primera: dos
eran huecos de mis pruebas y la tercera demostró que el `CSS.escape` que
había puesto era una defensa contra algo imposible —el navegador
codifica siempre las comillas del fragmento—, así que se quitó el
selector construido). SIN CUBRIR: que el aviso se ENCOLE con el
parámetro; eso pasa en guia.html al mandar la sugerencia y montarlo
pedía sembrar la página de guía entera.
IBAI: no he tocado ninguno de tus ficheros (solo perfil.js y
guide-suggestions.js), así que tu df64af1 está intacto. Tu pasada de
suite pedida (ronda.js, torneo.js) SIGUE PENDIENTE — la haré en la
próxima tanda si nadie se adelanta.
PENDIENTE de PINGU: ejecutar supabase-migration-partidas-cerrar.sql y
supabase-migration-partidas-editar.sql (tanda 251). Y quitar el puente
`faltaLaRpc` de js/torneos/comun.js cuando la migración de apertura
lleve un tiempo puesta.

## 2026-09-02 16:00 — IBAI-Claude (Jugar a la vista, registro al unirse)
**Hecho**: Ibai afinó el tiro de la entrada anterior — la pestaña
«Jugar» y la sección enteras SE VEN SIN SESIÓN, como las demás
secciones (vuelve el escaparate); lo que pide cuenta es UNIRSE. Tres
piezas: (1) el enlace «Jugar» del menú se desvela para todo el mundo
(antes solo con sesión, app.js); (2) fuera las redirecciones a
/auth.html de /torneos y la ficha (vuelven el modo escaparate de la
229 y el noindex de torneos.html se quita otra vez); (3) el CTA del
escaparate con inscripciones abiertas pasa de «Entra para inscribirte»
a «Crea tu cuenta para inscribirte» y lleva DIRECTO al formulario de
REGISTRO — auth.js entiende ahora `?registro=1` y abre ese paso; el
`volver` sigue trayendo de vuelta al torneo. Quien ya tiene cuenta
tiene su «¿Ya tienes cuenta? Entra» al lado.
**RETIRADA supabase-migration-torneos-solo-cuentas.sql** (de la
entrada de las 15:30, nunca ejecutada según esta bitácora): NO
ejecutarla. Si por lo que fuera ya corrió, re-ejecutar
supabase-migration-torneos-publico.sql, que restaura las lecturas
anónimas (sus drop/create pisan las de solo-cuentas). CLAUDE.md
puesto al día otra vez.
**Ficheros**: js/app.js, js/auth.js, js/torneos/torneos.js,
js/torneos/torneo.js, torneos.html, CLAUDE.md,
supabase-migration-torneos-solo-cuentas.sql (BORRADA). Fuera del repo:
pruebas\verificar-escaparate.mjs (NUEVA, 10 en verde: menú y sección
sin sesión, CTA con registro=1 y volver, auth abre en crear cuenta;
con sesión, flujo normal) — sustituye a verificar-solo-cuentas.mjs
(borrada, probaba el muro que ya no existe).
**Rigor**: 11/11 en la 306 y 10/10 en la 305 — pero la 305 necesitó dos
pasadas: dos mutaciones pasaron a la primera porque el listón estaba
puesto a ojo (leer la escala sin quitar los comentarios, y «al menos
cuatro renglones» cuando había que comprobar dos párrafos de tres).

**En curso / pendiente**: nada a medias. La pasada de suite pedida en
las entradas anteriores sigue en pie (ronda.js, torneo.js).

## 2026-09-02 15:30 — IBAI-Claude (Jugar solo con cuenta)
**Hecho**: pedido de Ibai — la sección «Jugar» deja de verse sin
cuenta (sigue siendo de CUALQUIER cuenta: esto NO devuelve el candado
de admins de antes de la tanda 252). Cliente: /torneos y la ficha
redirigen sin sesión a /auth.html con `volver` (tras entrar vuelves al
torneo — el mecanismo de la tanda 229); el enlace «Jugar» del menú ya
solo salía con sesión, sin cambios ahí. torneos.html recupera su
`noindex` (a un buscador solo le saldría el login). Base:
supabase-migration-torneos-solo-cuentas.sql (NUEVA) cierra las
lecturas anónimas que abrió torneos-publico — tournaments, rounds,
mesas, resultados, inscripciones (con el revoke del permiso por
columnas de `anon`) y la rama pública de decklists_ver. CLAUDE.md
puesto al día. EFECTOS asumidos: la vista previa personalizada de un
enlace de torneo pasa a la genérica cuando la migración corra
(meta-social usa la clave publicable y degrada solo, está escrito para
eso); el palmarés en un perfil visto SIN sesión saldrá vacío por la
misma RLS.
**Ficheros**: js/torneos/torneos.js, js/torneos/torneo.js,
torneos.html, CLAUDE.md, supabase-migration-torneos-solo-cuentas.sql
(NUEVA). Fuera del repo: pruebas\verificar-solo-cuentas.mjs (NUEVA, 8
en verde: sin sesión redirige con volver; con cuenta normal todo
sigue).
**En curso / pendiente**: PINGU tiene que VALIDAR contra PostgreSQL y
EJECUTAR supabase-migration-torneos-solo-cuentas.sql (en esta máquina
no hay psql ni docker; la sintaxis sigue el patrón de torneos-publico
y las funciones torneos_soy_admin/juez ya existen). Hasta que corra,
la redirección del cliente ya da el comportamiento visible; los datos
siguen legibles por API para un anónimo. Ejecutarla DESPUÉS de
torneos-publico.sql si esa aún no ha corrido.

## 2026-09-02 14:55 — IBAI-Claude (compartir + deshacer rondas)
**Hecho**: dos pedidos de Ibai. (1) COMPARTIR: botón en la cabecera de
la ficha del torneo, para todo el mundo (sin cuenta incluso): hoja de
compartir del sistema donde la haya, y si no, el enlace al
portapapeles. (2) DESHACER Y CORREGIR: «Deshacer la última ronda» para
el organizador — borra la ronda entera con UN delete a `rounds` (mesas,
reportes, resultados, historial de cruces y chats caen por `on delete
cascade`; `current_round_id` es `set null`); con confirmación, y el
`.select()` del delete distingue «hecho» de «la RLS no ha borrado
nada». Deshacer la R1 devuelve el torneo a inscripciones cerradas y
DES-SELLA las decklists. Además el organizador puede CORREGIR el
resultado de una mesa ya cerrada de la ÚLTIMA ronda (select
«Corregir…», con confirmación; `match_results` pasa a upsert porque
match_id es UNIQUE); en un torneo terminado descongela champion_id y
podium para que sellarResultado los recalcule. Y los botones de
«continuar» del limbo que deja la vuelta atrás (todas las rondas
cerradas, torneo en juego): Continuar el bracket / Sembrar el top cut /
Terminar el torneo — repiten el paso que dio cerrarRonda en su día.
LÍMITES asumidos: los avisos ya enviados no se des-envían; los
retirados de la R1 por los dos pasos siguen retirados (no se
distinguen de una baja voluntaria); el anuncio del podio en el foro no
se retira al corregir; deshacer no se ofrece en un torneo terminado
(ahí se corrige la mesa, que recalcula el podio solo).
**Ficheros**: torneo.html, css/torneos.css, js/torneos/torneo.js,
js/torneos/ronda.js. Fuera del repo: pruebas\verificar-deshacer.mjs
(NUEVA, 16 en verde sobre la demo con tres escenarios sembrados:
deshacer pareos, corregir y re-parear; terminar sin corte; sembrar el
cut).
**En curso / pendiente**: pedir a PINGU pasada de suite (ronda.js ha
cambiado en pintarMesas/resolverPartida — si el e2e cuenta columnas de
la tabla de mesas, ahora hay columna de acciones también para el admin
con ronda cerrada). El stub local no emula cascadas: si la suite
canónica prueba deshacerRonda contra el doble, las mesas huérfanas se
quedan en su base en memoria (en PostgreSQL de verdad caen, esquema
comprobado).

## 2026-09-02 14:05 — IBAI-Claude (reabrir inscripciones)
**Hecho**: pedido de Ibai — cerrar inscripciones era un viaje sin
vuelta (con el torneo en `registration_closed` la ficha no pintaba
ningún botón de estado). Ahora abrir y cerrar se alternan las veces que
haga falta: botón «Reabrir inscripciones» que vuelve a
`registration_open`. El ÚNICO candado es la R1 ya pareada: no hay
deshacer pareos y un recién llegado no entraría en ellos, así que el
manejador consulta `rounds` AL PULSAR (este módulo no las tiene en
memoria, las carga ronda.js) y avisa en vez de reabrir. Sin tocar la
base: no hay restricción de transición en las políticas y el RPC de
inscribirse ya exige `registration_open`. Reabrir NO reanuncia nada
(`registration_notified_at` queda puesto del primer anuncio, a
propósito).
**Ficheros**: js/torneos/torneo.js. Fuera del repo:
pruebas\verificar-reabrir.mjs (NUEVA, 9 en verde sobre la demo: dos
vueltas completas de cerrar/reabrir y el bloqueo con una R1 plantada
en la base falsa).
**Rigor**: 11/11 en la 306 y 10/10 en la 305 — pero la 305 necesitó dos
pasadas: dos mutaciones pasaron a la primera porque el listón estaba
puesto a ojo (leer la escala sin quitar los comentarios, y «al menos
cuatro renglones» cuando había que comprobar dos párrafos de tres).

**En curso / pendiente**: nada a medias. Para PINGU: si la suite
canónica cubre el ciclo de estados del torneo, añadid el vaivén
cerrar→reabrir (verificar-reabrir.mjs sirve de patrón).

## 2026-09-02 13:35 — IBAI-Claude (remates de la apertura)
**Hecho**: cuatro peticiones de Ibai. (1) AUTH: el título del
formulario salía pegado a su subtexto (el reset global lo deja a margen
cero y un `margin-top: -8px` viejo los solapaba — era de cuando el
subtexto era hijo directo del flex con gap): ahora el h2 lleva 8px de
margen y el -8px está fuera. Medido en navegador de verdad: 8px de
hueco. (2) JUGAR: fuera la píldora «En pruebas — solo lo veis los
admins» de /torneos y su `noindex` (puesta una meta description); el
noindex de torneo.html (la ficha) SE QUEDA a propósito — protege
nombres de jugadores, está comentado ahí. Comentarios desfasados de
torneos.js/torneo.js («solo para admins») puestos al día. (3) SPRITES:
sondeada la CDN de Limitless ENTERA (las 1025 especies con «-mega») y
salieron 20 megas que faltaban en la lista — Mega Darkrai la primera,
que caía en el Darkrai a secas. Además: cualquier «Mega X» futura que
no esté en la lista se monta sola (slug `x-mega`), y TODO sprite de
forma que la CDN no tenga cae al de su ESPECIE BASE en vez de a un
hueco (`respaldoDeSprite`/`atributosDeRespaldo`, enganchado en
mis-partidas, selector de mazo y chapas de arquetipo). De paso, bug de
la tanda 251: `poner()` del selector escribía `sprite.src` en el SPAN
del marco, no en el img — al editar una ronda el sprite no salía.
(4) CORREO: la APERTURA de un torneo ya NO manda email a los 96
miembros (era el único aviso-bombardeo; los demás ya iban solo a
inscritos). Queda en campanita y push. Casilla `torneo_apertura` fuera
de EMAIL_TYPES; baja-correo.mjs sigue reconociendo el tipo para los
enlaces de baja de correos ya enviados.
**Ficheros**: css/components.css, torneos.html, js/torneos/torneos.js,
js/torneos/torneo.js, js/torneos/sprites-pokemon.js,
js/torneos/selector-mazo.js, js/torneos/cartas-decklist.js,
js/mis-partidas.js, js/notifications.js,
netlify/functions/torneos-barredor.mjs. Fuera del repo (en
Desktop\Pokedoc): sonda-megas.mjs (NUEVA — la sonda de la CDN, para
repetirla otra temporada), verificar-sprites.mjs (NUEVA, 25 en verde),
verificar-apertura.mjs (NUEVA, barredor con doble: 0 correos en la
apertura, campanita y push intactos), verificar-auth-css.mjs (NUEVA,
mide el hueco en navegador).
**En curso / pendiente**: pedir a PINGU una pasada de la suite (torneos
y mis-partidas tocan sprites). OJO: los torneos que ya tengan
`registration_notified_at` no reanuncian nada; si había alguno abierto
SIN anunciar, con este despliegue ya no manda correo (solo campanita y
push) — que era justo el aviso de la tanda 252.
**Hecho**: PINGU: «publica ya la parte de torneos». La sección deja de
ser solo para admins. ANTES de quitar candados verifiqué las políticas
contra PostgreSQL de verdad haciéndome pasar por un jugador normal, y
salieron DOS HUECOS que habrían salido el viernes: (a) salir de la
lista de espera no funcionaba para nadie que no fuese admin —el DELETE
no encontraba fila y volvía sin error—, política `inscripciones_salir`
nueva; (b) el check-in no tenía RPC y `tournament_matches` es de
escritura solo-admin, así que marcarse listo no habría hecho nada: RPC
`torneos_checkin`. El cliente pasa ya por las tres RPC
(inscribirse/reportar/checkin) con un PUENTE que usa el camino viejo
solo mientras la base no conozca la función. Quitados los cuatro
candados (enlace «Jugar», /torneos, palmarés, correo de apertura), y
/torneos aguanta ya SIN sesión. Crear torneos sigue siendo del equipo.
**Ficheros**: js/app.js, js/torneos/torneos.js, js/torneos/torneo.js,
js/torneos/ronda.js, js/torneos/comun.js, js/usuario.js,
netlify/functions/torneos-barredor.mjs,
supabase-migration-torneos-publico.sql, CLAUDE.md, SCHEMA.md. Fuera del
repo: test-tanda-252.mjs (NUEVA), rigor-tanda-252.py (NUEVO),
sql-apertura.sql (NUEVO), stub-supabase.js (RPC que no existen y RPC
que contestan), test-torneos-23.mjs (arreglada, ver abajo).
**En curso / pendiente**: PINGU tiene que EJECUTAR
supabase-migration-torneos-publico.sql (ya con los dos huecos tapados).
Hasta que la ejecute, el puente hace que todo siga funcionando.
AVISO: el correo de «inscripciones abiertas» va ya a los 96 miembros;
si queda algún torneo abierto sin anunciar, le llega a todos en cuanto
despliegue. PENDIENTE de quitar cuando la migración lleve un tiempo: el
puente `faltaLaRpc` de comun.js. Verificado: 24 comprobaciones en verde
y las 9 mutaciones del rigor pilladas (dos se escaparon a la primera y
eran huecos de mis pruebas, tapados). OJO: `test-torneos-23` llevaba
ROTA desde que los sprites se mudaron a r2.limitlesstcg.net —seguía
pidiendo las URLs de PokeAPI e interceptando jsDelivr—. Van CINCO
comprobaciones obsoletas encontradas hoy solo por pasar la suite
entera.

## 2026-09-02 — PINGU-Claude (tanda 251 — /mis-partidas de arriba abajo)
**Hecho**: tres peticiones de PINGU sobre /mis-partidas. (1) CERRAR y
REABRIR un torneo apuntado (columna `cerrado_el`): cerrar no toca datos,
solo deja de pedir rondas. (2) EDITAR TODO — cada ronda y el torneo
entero, mazo incluido. El mazo va denormalizado en cada ronda, así que
cambiarlo son dos escrituras: lo hace un DISPARADOR de la base, no el
cliente, para que vayan en la misma transacción. (3) Los
ENFRENTAMIENTOS dejan de ser una tabla con scroll lateral y pasan a ser
un bloque por mazo mío con sus rivales en lista, con barra, récord y
porcentaje. Extras: buscador + estado + corte en torneos, las sueltas ya
no se cortan a 30 en silencio, y editar una suelta.
**Ficheros**: js/mis-partidas.js, js/matriz-partidas.js,
js/torneos/selector-mazo.js, css/partidas.css, mis-partidas.html,
supabase-migration-partidas-cerrar.sql (NUEVO),
supabase-migration-partidas-editar.sql (NUEVO), SCHEMA.md. Fuera del
repo: test-tanda-251.mjs (NUEVA), rigor-tanda-251.py (NUEVO),
test-partidas-pagina.mjs (arregladas 3 comprobaciones obsoletas),
stub-supabase.js (tabla match_log_torneos), vista-stats.mjs (NUEVO).
**En curso / pendiente**: PINGU tiene que EJECUTAR las dos migraciones
nuevas. Verificado: 61 comprobaciones en verde y las 20 mutaciones del
rigor pilladas; las dos migraciones validadas contra PostgreSQL 16 en
sus dos ramas. OJO: tres comprobaciones de test-partidas-pagina
llevaban ROTAS desde la tanda 236 (la página tiene pestañas y el panel
de sueltas no está a la vista al entrar) y nadie lo había notado —
conviene pasar la suite entera de vez en cuando, no solo la de la tanda.
SIGUE EN PIE lo del torneo: NO ejecutar torneos-publico.sql hasta
enganchar las RPC, o nadie que no sea admin podrá apuntarse ni reportar.

## 2026-09-02 — PINGU-Claude (tanda 250 — que PostgREST se entere)
**Hecho**: PINGU no podía guardar una ronda en /mis-partidas: «Could not
find the 'tipo' column of 'match_log' in the schema cache». La migración
SÍ estaba ejecutada — lo que pasa es que PostgREST guarda el esquema en
memoria y no se entera de una columna nueva hasta que a Supabase le da
por recargar. La receta es `notify pgrst, 'reload schema'` al final del
fichero, y solo la tenían 15 de las 72 migraciones. Añadido a las 39 que
cambian esquema (create table / add column / create view) y no lo
tenían. Validado contra PostgreSQL 16 local: partidas-tipo y sets-live,
tres pasadas cada una, sin errores.
**Ficheros**: 39 supabase-migration-*.sql (solo se les añade el aviso al
final; ninguna cambia lo que hace).
**En curso / pendiente**: PINGU tiene que RE-EJECUTAR
supabase-migration-partidas-tipo.sql (y sets-live si le pasa lo mismo
con los códigos de TCG Live). Son re-ejecutables: lo único nuevo es el
aviso a PostgREST, que es lo que hace falta.
AVISO GORDO para la apertura de hoy, en el mensaje al usuario: el
cliente NO llama a ninguna de las tres RPC de
supabase-migration-torneos-publico.sql, y esa migración deja
tournament_registrations SIN política de INSERT y match_reports SIN
política de INSERT. Ejecutarla hoy tal cual deja a todo el que no sea
admin sin poder apuntarse, sin poder borrarse y sin poder reportar
resultados.

## 2026-09-01 — PINGU-Claude (tanda 249 — los correos, de verdad)
**Hecho**: PINGU pidió mirar todos los correos y que los enlaces
llevaran a cada cosa. Había un fallo gordo: `absoluteUrl()` solo
aceptaba rutas, el barredor encola URLs enteras (las necesita así para
el push), y el `?:` se caía a `base` — LOS OCHO TIPOS DE AVISO DE
TORNEO llevaban a la portada de pokedoc.es. Arreglado aceptando también
URLs absolutas, pero SOLO del propio dominio; y si el enlace no vale, el
correo sale sin botón en vez de con uno a la portada. Plantilla rehecha:
verbo y motivo por tipo (adiós al «Verlo en PokeDoc» y al «alguien se ha
dirigido a ti» para los diecisiete), preheader, maquetación con tablas
para que Outlook no la estire, colores declarados para el modo oscuro,
cabecera con la marca y pie con enlace a preferencias. Y los avisos de
torneo dicen ya los datos: la apertura, cuándo se juega y con qué
formato; el recordatorio, la hora exacta.
**Ficheros**: netlify/lib/email.mjs, netlify/lib/fechas.mjs (NUEVO),
netlify/functions/torneos-barredor.mjs, SCHEMA.md. Fuera del repo:
test-correos.mjs (NUEVA), rigor-tanda-249.py (NUEVO),
correos/vista.mjs (NUEVO: pinta los correos a PNG para poder mirarlos).
**En curso / pendiente**: verificado — 50 comprobaciones en verde y las
14 mutaciones pilladas; test-tanda-247, test-tanda-248, test-foro-2 y
test-torneos-20 siguen verdes. Cero migraciones. NO se ha tocado nada de
la apertura de la sección: PINGU dijo expresamente que todavía no.
SIN HACER, dicho y ofrecido: un panel en /admin para ver los correos
que fallan (hoy `email_outbox.status='failed'` no lo mira nadie), y
comprobar que las variables de correo de Netlify están puestas — eso no
se ve desde aquí.

## 2026-09-01 — PINGU-Claude (tanda 248 — «En juego» solo si se juega)
**Hecho**: PINGU vio su Copa Inaugural marcada como «En juego» días
antes. No era la base —el torneo está en `registration_closed` y nada
lo mueve solo: el barredor no toca el estado y solo «Iniciar ronda 1»
pasa a `in_progress`— sino la pantalla, que metía las cerradas en el
mismo saco que las que se están jugando. En /torneos hay ahora una
pestaña «Por empezar» entre «Abiertas» y «En juego», y «En juego» es
solo `in_progress`; en el perfil, un torneo con las inscripciones
cerradas pasa de «Jugando ahora» a «Apuntado». La chapa de la tarjeta
ya decía la verdad («Inscripciones cerradas») debajo de una pestaña que
decía lo contrario.
**Ficheros**: js/torneos/torneos.js, js/perfil.js, SCHEMA.md. Fuera del
repo: test-tanda-248.mjs (NUEVA), rigor-tanda-248.py (NUEVO).
**En curso / pendiente**: verificado — 18 comprobaciones en verde y las
9 mutaciones del rigor pilladas; test-tanda-247, test-torneos-18 y
test-torneos-20 siguen verdes. Cero migraciones. SIN HACER, porque no
se ha pedido: que «Iniciar ronda 1» avise si se pulsa mucho antes de la
hora del torneo (PINGU lo insinuó; se le ha ofrecido).

## 2026-09-01 — PINGU-Claude (tanda 247 — borrar temas y el anuncio en su foro)
**Hecho**: dos cosas que pidió PINGU. (1) BORRAR UN TEMA del foro: no
faltaba nada en la base —la política `forum_threads_delete` lo permite
desde la tanda de títulos— sino el BOTÓN, que nunca se puso. Sale en el
panel de moderación de la ficha para el equipo y también para el autor
mientras nadie le haya contestado (misma condición exacta que la
política, para que el botón no prometa lo que la base va a negar).
Confirmación en dos toques, y el segundo dice qué se pierde («¿Seguro?
Se van también 2 respuestas»). El DELETE va con `.select('id')`: un
borrado que la RLS rechaza NO da error, y sin pedir de vuelta lo
borrado la página diría «hecho» y te mandaría a un foro donde el tema
sigue. (2) EL ANUNCIO DEL TORNEO cae ahora en «Juego → Torneos» y no en
el primer foro por posición («Anuncios»); el desplegable va agrupado
por secciones y con los subforos detrás de su padre y marcados con «—».
El foro se busca POR NOMBRE, no por un id escrito en el código: la
estructura del foro vive en la base y se cambia desde /admin sin
desplegar. Si ese foro no existe, se cae al primero como hasta ahora.
**Ficheros**: js/tema.js, js/torneos/torneo.js, js/torneos/anuncio-foro.js
(NUEVO), css/components.css, supabase-migration-foro-torneos.sql
(NUEVO), SCHEMA.md. Fuera del repo: pruebas test-tanda-247.mjs (NUEVA),
rigor-tanda-247.py (NUEVO), stub-supabase.js (el DELETE ahora solo
devuelve cuerpo si se encadenó .select(), como PostgREST, y hay un
`__RLS_SIN_BORRAR__` para simular una política que dice que no).
**En curso / pendiente**: verificado: 32 comprobaciones de Playwright en verde y las 14
mutaciones del rigor pilladas. test-foro-1, test-foro-2 y
test-torneos-20 siguen verdes. La migración del foro de
torneos es OPCIONAL y está guardada: si «Juego → Torneos» ya existe (o
existe con otro nombre que empiece por «torneo»), no hace nada.
Validada contra PostgreSQL 16 local en sus dos ramas. Siguen pendientes
los SQL de la tanda 233 (sets-live y partidas-tipo) y el botón «Traer
códigos de TCG Live». Borrar temas desde la LISTA del foro (no solo
desde la ficha) queda sin hacer: no se ha pedido.

## 2026-09-01 — IBAI-Claude (tanda 246 — Oficial PokeDoc vs comunidad)
**Hecho**: pedido por Ibai — distinguir los torneos del EQUIPO de los
de la comunidad, en lista y calendario. Un torneo es «Oficial» si su
creador (admin_id) tiene user_profiles.is_admin AHORA: cero columnas
nuevas y cero migraciones, la marca sigue sola a quien entra o sale
del equipo (una consulta a user_profiles por carga de lista). En la
TARJETA del listado y en el panel del día del calendario, chapa dorada
«★ Oficial»; en el CALENDARIO, dos colores — navy los días con torneo
oficial, hielo los de solo-comunidad (día mixto = navy) — con su
leyenda bajo la cabecera y el «(oficial)» en el title del día.
**Ficheros**: js/torneos/torneos.js, css/torneos.css, SCHEMA.md. Fuera
del repo: pruebas/stub/demo.html (la Copa Abierta pasa a organizarla
«visitante» para que la demo tenga un torneo de comunidad; semilla
tanda-246), pruebas/verificar-tanda-246.mjs (NUEVO).
**En curso / pendiente**: verificado con Edge (9/9, capturas en
pruebas/capturas). OJO PINGU: hoy todos los creadores reales son
admins — en producción TODO saldrá Oficial hasta que la sección se
abra; es lo esperado. SQL pendientes: los mismos de la 242.

## 2026-09-01 — IBAI-Claude (tanda 245 — el calendario por páginas de seis)
**Hecho**: Ibai sobre la 244: «demasiados meses». El calendario pasa a
PÁGINAS de SEIS meses (tres por fila, dos filas; en tableta 2
columnas, en móvil 1), las flechas pasan de página (±6, como ya iban)
y los tamaños vuelven a cómodos (los de la 243) porque con tres por
fila hay sitio de sobra. El rango de la cabecera dice la página
(«septiembre 2026 — febrero 2027»).
**Ficheros**: js/torneos/torneos.js, css/torneos.css, SCHEMA.md. Fuera
del repo: pruebas/verificar-tanda-243.mjs (6 meses y rango nuevos).
**En curso / pendiente**: verificado con Edge (16/16). Lo demás, como
la 244.

## 2026-09-01 — IBAI-Claude (tanda 244 — el calendario, a gusto de Ibai)
**Hecho**: tres retoques sobre la 243, pedidos al probarla. (1) Las
flechas saltan MEDIO AÑO (±6) en vez de mes a mes. (2) Los meses,
compactos: minmax 164px (antes 215), padding y letras más pequeñas —
el año entero cabe en dos filas de seis en un monitor normal. (3)
FUERA el botón «Hoy»: con saltos de 6, volver al presente es un toque
y en la cabecera solo estorbaba.
**Ficheros**: js/torneos/torneos.js, css/torneos.css, SCHEMA.md. Fuera
del repo: pruebas/verificar-tanda-243.mjs (actualizado a los saltos de
6 y sin «Hoy»).
**En curso / pendiente**: verificado con Edge (16/16, captura nueva en
pruebas/capturas). Lo demás, como la 243.

## 2026-09-01 — IBAI-Claude (tanda 243 — el calendario, profesional)
**Hecho**: pulido del calendario pedido por Ibai. La ventana EMPIEZA
en el mes actual (12 meses seguidos, cruzando el cambio de año) con el
mes de hoy señalado (borde navy + chapa «hoy»); las flechas pasan de
mes a mes con deslizamiento en la dirección del viaje y las tarjetas
entran escalonadas (--i, 22 ms por mes); botón «Hoy» que solo sale
fuera del mes actual; el día pulsado queda anillado y su panel entra
animado; hovers con elevación en meses y escala en días; y todo
respeta prefers-reduced-motion. La cabecera dice el rango
(«septiembre 2026 — agosto 2027»).
**Ficheros**: js/torneos/torneos.js, css/torneos.css, SCHEMA.md. Fuera
del repo: pruebas/verificar-tanda-243.mjs (NUEVO).
**En curso / pendiente**: verificado con Edge (17/17, captura en
pruebas/capturas). PINGU: el DOM del calendario cambia — [data-cal-mes]
y [data-cal-hoy] sustituyen a [data-cal-anio], y la cabecera es
.torneo-cal-rango (verificar-tanda-242 tiene dos checks obsoletos de
eso). SQL pendientes de Ibai: los de la 242 menos torneos-listas si ya
re-ejecutó la versión buena.

## 2026-09-01 — IBAI-Claude (tanda 242b — arreglo de la migración de listas)
**Hecho**: a Ibai le falló `supabase-migration-torneos-listas.sql`: su
CREATE POLICY usa torneos_soy_admin/juez, que nacen en
torneos-publico.sql — y esa migración de apertura NO está ejecutada en
la base (la sección sigue en pruebas con torneos_solo_admins). El
fallo dejaba TODO sin aplicar (un solo begin/commit), así que
re-ejecutar el fichero arreglado es limpio. Dos cambios: (1)
torneos-listas ahora hace la parte de la política en un DO condicional
— si las funciones no existen, NOTICE y sigue (sin agujero: la
política de solo-admins ya cierra las decklists); (2)
torneos-publico.sql trae la regla de los TRES MODOS incorporada, y
elige política según exista la columna decklist_visibility — los dos
ficheros funcionan ya en cualquier orden.
**Ficheros**: supabase-migration-torneos-listas.sql,
supabase-migration-torneos-publico.sql, SCHEMA.md.
**En curso / pendiente**: Ibai re-ejecuta torneos-listas (la versión
nueva). Lo demás, como la 242.

## 2026-09-01 — IBAI-Claude (tanda 242 — el banner del torneo y el calendario anual)
**Hecho**: dos peticiones de Ibai. (1) BANNER: además del icono de la
239, un banner ANCHO que preside la ficha (columna
`tournaments.banner_url`, supabase-migration-torneos-banner.sql, mismo
bucket avatars con `torneo-banner-<ts>`); se elige con vista previa en
el wizard (montador compartido con el icono) y en el editor
(triestado); en la ficha va a sangre con márgenes negativos y se
esconde si no carga. Los reintentos sin-columna cubren también
banner_url. (2) CALENDARIO: /torneos gana el conmutador
Lista/Calendario (se recuerda en localStorage) — el año entero, 12
meses con semana en lunes, los días con torneo en navy y pulsables
(las jornadas de una liga también cuentan), panel del día con sus
torneos enlazados, y flechas de año. Todo de la lista ya cargada, sin
consultas nuevas.
**Ficheros**: torneo.html, torneos.html, js/torneos/torneo.js,
js/torneos/torneos.js, css/torneos.css, js/schema-check.js,
supabase-migration-torneos-banner.sql (NUEVO), SCHEMA.md. Fuera del
repo: pruebas/stub/mundo-mundial.mjs (el Mundial con banner),
pruebas/stub/demo.html (semilla tanda-242),
pruebas/verificar-tanda-242.mjs (NUEVO).
**En curso / pendiente**: verificado con Edge (16/16, capturas en
pruebas/capturas). PINGU: DOM nuevo en /torneos (conmutador
[data-vista-torneos], #torneosCalendario) y #torneoBanner en la ficha.
SQL pendientes de Ibai: los cuatro de antes + torneos-banner.

## 2026-09-01 — IBAI-Claude (tanda 241 — el wizard más fino: corte y listas)
**Hecho**: dos pulidos del crear/editar torneo pedidos por Ibai. (1)
Con «Sin corte» el campo «Corte al mejor de» se ESCONDE (wizard y
editor; reaparece al elegir un corte, también cuando lo rellena la
tabla oficial al cambiar plazas). (2) Las listas de los rivales pasan
de casilla a TRES MODOS: públicas al terminar (defecto, lo de
siempre), públicas desde la R1 (la casilla vieja marcada) y NUNCA
públicas (nuevo). Columna `tournaments.decklist_visibility`
(supabase-migration-torneos-listas.sql, que además REHACE la política
decklists_ver para que el «nunca» se cumpla en la base — ejecutar
DESPUÉS de torneos-publico). El booleano viejo queda en sincronía como
respaldo; el cliente reintenta sin la columna nueva si la migración no
corrió, así que crear/editar no se rompe entre despliegue y SQL.
**Ficheros**: torneos.html, js/torneos/torneos.js, js/torneos/torneo.js,
js/torneos/ronda.js, js/schema-check.js,
supabase-migration-torneos-listas.sql (NUEVO), SCHEMA.md. Fuera del
repo: pruebas/verificar-tanda-241.mjs (NUEVO).
**En curso / pendiente**: verificado con Edge (11/11: esconder/enseñar
el BO del corte en wizard y editor, los 3 modos en ambos, la liga con
el booleano viejo hereda «en_juego» y el Mundial terminado conserva
chapas). PINGU: el DOM cambia — #torneoListasModo/#editarListasModo
(select) sustituyen a los checkbox torneoListasRivales /
editarListasRivales, y hay #torneoCorteBoCampo/#editarCorteBoCampo.
SQL pendientes de Ibai: los tres de antes + torneos-listas.

## 2026-09-01 — IBAI-Claude (tanda 240 — los sprites de las Megas y la demo que se siembra sola)
**Hecho**: (1) MEGAS: 55 formas «Mega X» registradas en FORMAS_TCG
(generadas de una lista de especies + Charizard/Mewtwo X e Y), cada
slug `<especie>-mega` comprobado contra la CDN de Limitless; números
sintéticos (20000+base) porque desde la 236 el sprite sale del slug.
«Mega-Lucario ex» en español casa solo (el guion se aplasta). El
buscador ofrece cada mega como opción. (2) La demo local se resiembra
SOLA cuando la semilla cambia de versión (__SEMILLA_V__ en demo.html)
y deja al usuario como admin — pedido por Ibai («lo típico de tener ya
todo creado y dejarme acceder con admin»).
**Ficheros**: js/torneos/sprites-pokemon.js, SCHEMA.md. Fuera del
repo: pruebas/stub/demo.html, pruebas/verificar-tanda-240.mjs (NUEVO).
**En curso / pendiente**: verificado con Edge (12/12). PINGU: al tocar
la semilla de la demo, sube VERSION_SEMILLA en demo.html. Pendientes
de Ibai los TRES SQL (236: partidas-torneos y seed del Mundial; 239:
torneos-imagen).

## 2026-09-01 — IBAI-Claude (tanda 239 — la imagen del torneo)
**Hecho**: pedido por Ibai — un torneo puede llevar icono/imagen y el
listado la enseña. Columna nueva `tournaments.image_url`
(supabase-migration-torneos-imagen.sql, la vigila el comprobador); la
imagen se sube al bucket `avatars` que YA existe (carpeta del usuario,
`torneo-<ts>.<ext>`), así que sin bucket ni política nueva. En la
tarjeta del listado la imagen ocupa el hueco del bloque de fecha (la
fecha ya va en texto debajo); si no carga, se esconde. Se elige con
vista previa en el paso 1 del wizard y en el editor de la ficha
(elegir/cambiar/quitar); la subida ocurre SOLO al crear/guardar, para
no dejar huérfanos en Storage. El editor sigue su regla de la 211:
un torneo terminado no se edita (tampoco su imagen).
**Ficheros**: supabase-migration-torneos-imagen.sql (NUEVO),
torneos.html, js/torneos/torneos.js, js/torneos/torneo.js,
css/torneos.css, js/schema-check.js, SCHEMA.md. Fuera del repo:
pruebas/stub/mundo-mundial.mjs (el Mundial de la demo con imagen),
pruebas/verificar-tanda-239.mjs (NUEVO).
**En curso / pendiente**: IBAI ejecuta
`supabase-migration-torneos-imagen.sql` (además de los dos SQL de la
236 si aún no). PINGU: el doble no cubre storage.upload — crear un
torneo CON imagen en la demo fallará en la subida; si la suite lo
toca, habrá que darle un doble a supabase.storage. Verificado con Edge
(13/13, captura en pruebas/capturas).

## 2026-09-01 — IBAI-Claude (tanda 238 — el historial en modal y el selector sin arquetipos)
**Hecho**: dos remates de Ibai sobre la 237. (1) El historial de un
jugador pasa de panel bajo la tabla a MODAL centrado (modal-overlay de
components.css), colgado del body para que el repintado de 10 s no lo
mate; X, click fuera y Escape lo cierran. (2) El selector de mazos ya
NO ofrece los arquetipos del catálogo (salían sin sprite y la clave
canónica agrupa igual eligiendo Pokémon); y los objetos con sprite
(OBJETOS_TCG: el martillo + alias español) son opciones INSTANTÁNEAS
con su sprite, sin depender del espejo de cartas.
**Ficheros**: js/torneos/ronda.js, js/torneos/selector-mazo.js,
js/torneos/sprites-pokemon.js, css/torneos.css, SCHEMA.md. Fuera del
repo: pruebas/verificar-tanda-238.mjs (NUEVO).
**En curso / pendiente**: verificado con Edge sobre la demo (15/15,
capturas en pruebas/capturas). PINGU: OJO en las pruebas —
buscarOpciones() ya no devuelve opciones tipo 'arquetipo' (la firma
conserva el parámetro), y el historial vive en #torneoHistorialModal
colgado del body, no bajo la tabla. Sigue pendiente que Ibai ejecute
los dos SQL de la 236.

## 2026-09-01 — IBAI-Claude (tanda 237 — /mis-partidas como trainingcourt y el historial por jugador)
**Hecho**: dos peticiones de Ibai. (1) /mis-partidas REORGANIZADA
copiando la estructura real de trainingcourt (mirada en sus bundles):
tres pestañas (Torneos / Partidas sueltas / Estadísticas), tarjetas de
torneo tipo fila con sprites de tu mazo + récord en píldora coloreada,
rondas al desplegar con los sprites del mazo rival y letra V/D/E, y el
formulario de ronda que se MUDA dentro de la tarjeta (mismo nodo; ojo:
pintarTorneos lo saca antes de arrasar el innerHTML y lo devuelve al
hueco después). Sprites en todas partes vía spritesDeMazoHtml (catálogo
→ iconos; deducido → especies del nombre). (2) HISTORIAL POR JUGADOR:
en la clasificación de un torneo los nombres son botones; pulsar uno
despliega sus partidas del torneo (ronda, resultado desde su lado,
rival con la chapa de su mazo), con el mismo ciclo de repintado que la
lista de rival. Los mazos salen por chapaDe(), que ya calla cuando las
listas no pueden verse.
**Ficheros**: mis-partidas.html, js/mis-partidas.js, css/partidas.css,
js/torneos/ronda.js, css/torneos.css, SCHEMA.md. Fuera del repo:
pruebas/verificar-tanda-237.mjs (NUEVO).
**En curso / pendiente**: verificado con Edge sobre la demo (19/19,
capturas en pruebas/capturas). PINGU: pasada de suite cuando puedas —
cambia el DOM de /mis-partidas ENTERO (pestañas nuevas) y la celda de
jugador de la clasificación (el nombre ahora es <button
class="torneo-jugador-historial">); las pruebas que miren esos
selectores tendrán que actualizarse. Sigue pendiente que Ibai ejecute
los dos SQL de la 236.

## 2026-09-01 — IBAI-Claude (tanda 236b — el sprite del martillo y el Mundial de la demo)
**Hecho**: dos remates de Ibai sobre la 236. (1) Crushing Hammer ya no
sale como carta recortada: `assets/sprites/crushing-hammer.png` (el
MISMO asset local que usa trainingcourt) + `SPRITES_OBJETOS` en
sprites-pokemon.js (con alias «Martillo Demoledor»); spriteDeCarta()
lo devuelve como sprite y chapas + buscador lo pintan solos. (2) El
Mundial terminado se puede VER EN LOCAL sin tocar la base:
`pruebas/stub/mundo-mundial.mjs` (generado: mismas 8 listas y cruces
que supabase-seed-torneo-demo.sql, sobre el doble), fundido en /_demo
con su botón, y `pruebas/verificar-tanda-236.mjs` lo verifica con Edge
— 15/15: clasificación con 30 chapas-sprite (0 rotas), /mis-partidas
con el 2-1 de admin y su arquetipo del catálogo, martillo con sprite.
**Ficheros**: js/torneos/sprites-pokemon.js, js/torneos/selector-mazo.js,
assets/sprites/crushing-hammer.png (NUEVO), SCHEMA.md. Fuera del repo
(carpeta local pruebas/): stub/mundo-mundial.mjs (NUEVO), stub/demo.html,
servidor.mjs, verificar-tanda-236.mjs (NUEVO).
**En curso / pendiente**: OJO PINGU — la carpeta pruebas de esta
máquina NO es checkout git: si quieres el Mundial en la rama
`pruebas`, hay que portar esos cuatro ficheros a mano. Y si el doble
stubea imágenes, ahora también /assets/sprites/. Lo demás de la 236
sigue igual (dos SQL pendientes de ejecutar por Ibai).

## 2026-09-01 — IBAI-Claude (tanda 236 — sprites de Limitless, torneos apuntados y «Mis torneos»)
**Hecho**: cuatro peticiones de Ibai sobre la 235. (1) SPRITES: los de
PokéAPI no le valían; se miró el código de trainingcourt.app y usa la
CDN de Limitless (r2.limitlesstcg.net/pokemon/gen9/<nombre-guión>.png)
— ahora nosotros también, con tabla de slugs por dex, slugs a mano
para las formas (ogerpon-wellspring…) y las 1030 URLs comprobadas
contra la CDN (0 fallos); pixelated solo en sprites. (2) /mis-partidas
FUNCIONA POR TORNEOS: nueva migración
`supabase-migration-partidas-torneos.sql` (match_log_torneos +
match_log.torneo_id), botón «Apuntar un torneo», tarjetas «Tus
torneos» con récord y rondas (las de PokeDoc con enlace), y el
formulario de partida con modo ronda (mazo/fecha/dónde vienen del
torneo). (3) TORNEO DE PRUEBA: `supabase-seed-torneo-demo.sql` — 8
jugadores (7 falsos + IBAI con 2-1), 3 rondas suizas coherentes y las
8 decklists REALES del top del Mundial 2026 de Limitless pasadas por
el parseDecklist de verdad; siembra también tcg_archetypes con los 8
arquetipos y números reales (las 8 listas casan, comprobado con el
matcher). (4) «MIS TORNEOS»: pestaña nueva en el perfil propio
(jugando / apuntado / jugados con puesto del podio), el enlace del
menú de cuenta va ahora a /perfil.html#torneos.
**Ficheros**: js/torneos/sprites-pokemon.js, js/torneos/selector-mazo.js,
css/torneos.css, css/partidas.css, css/perfil.css (NUEVO),
supabase-migration-partidas-torneos.sql (NUEVO),
supabase-seed-torneo-demo.sql (NUEVO), mis-partidas.html,
js/mis-partidas.js, js/schema-check.js, perfil.html, js/perfil.js,
js/app.js, SCHEMA.md.
**En curso / pendiente**: IBAI ejecuta DOS SQL en este orden:
`supabase-migration-partidas-torneos.sql` (migración) y
`supabase-seed-torneo-demo.sql` (torneo de prueba; borra con el bloque
comentado del final cuando ya no haga falta). PINGU: pasada de suite
cuando puedas — cambian los sprites (URL nueva de CDN en TODOS los
iconos), el DOM del selector (marco alrededor del sprite del campo) y
/mis-partidas entera; si el doble stubea los sprites de jsDelivr,
ahora hay que stubear r2.limitlesstcg.net. Siguen pendientes las dos
migraciones de la 233.
**Hecho**: cinco peticiones de Ibai. (1) /torneos gana un HÉROE (panel
navy con título, píldora de «en pruebas» y las acciones; el
#btnNuevoTorneo es el mismo). (2) El icono de un mazo-objeto ya no es
«la carta en pequeñito»: un marco CSS recorta la ILUSTRACIÓN en un
cuadrado con el mismo peso que un minisprite (desviación anotada de la
decisión de la 234, en chapas y buscador). (3) Ogerpon: nueva tabla
curada FORMAS_TCG en sprites-pokemon.js — las cuatro máscaras y
Bloodmoon Ursaluna, con sprite propio (>10000), opciones propias en el
buscador y alias en español para los exports de TCG Live; la regla de
preevolución se limita a dex ≤1025 para no comerse una máscara vecina.
(4) El resumen de /mis-partidas agrupa por clave CANÓNICA
(claveCanonicaDeMazo): del nombre se sacan TODAS las especies y con esa
firma se busca en el catálogo entero — «Dragapult ex Dusknoir» de
torneo, «Dragapult»+«Dusknoir» a mano y el arquetipo curado caen POR
FIN en la misma casilla, y «Mejor/Peor enfrentamiento» llega a sus 3
partidas. Se traduce AL LEER; match_log no cambia (sin migración).
(5) El enlace «Jugar» faltaba en las navbars de foro.html, tema.html,
usuario.html y 404.html — añadido (por eso Ibai no lo veía desde el
foro).
**Ficheros**: torneos.html, css/torneos.css, css/partidas.css,
js/torneos/sprites-pokemon.js, js/torneos/arquetipos.js,
js/torneos/selector-mazo.js, js/torneos/cartas-decklist.js,
js/mis-partidas.js, foro.html, tema.html, usuario.html, 404.html,
SCHEMA.md.
**En curso / pendiente**: nada a medias y sin migraciones. PINGU: te
pido una pasada de la suite (tocan selector-mazo, arquetipos y las
chapas; las 24 comprobaciones de lógica pura en Node están en verde y
los 5 sprites nuevos responden 200 en jsDelivr). OJO: el HTML de una
opción-carta del selector y de la chapa de un objeto cambia (ahora hay
un <span> de marco alrededor del <img>) — si alguna prueba mira ese
DOM, es cambio esperado. Siguen pendientes las dos migraciones de la
233 y el botón «Traer códigos de TCG Live».
**Hecho**: PINGU lo vio enseguida: «se juega dragapult con martillo, el
martillo no está en la lista de búsqueda». El buscador de mazos solo
miraba las especies y el catálogo, así que un mazo que se nombra por un
OBJETO no se podía elegir. Ahora busca también en el espejo de cartas:
«hamm» saca Crushing Hammer, «stretch» Night Stretcher, cualquier carta.
Las que son un Pokémon se quitan de esa vía (ya salen arriba con su
sprite y si no saldrían repetidas por cada set), y una carta se pinta
con forma de carta y no de sprite. OJO: el catálogo está en INGLÉS, así
que se busca «hammer» y no «martillo»; para tenerlo en español se añade
una vez al catálogo de arquetipos de /admin.
**Ficheros**: js/torneos/selector-mazo.js, css/partidas.css, SCHEMA.md.
**En curso / pendiente**: nada nuevo que ejecutar. Siguen pendientes las
dos migraciones de la 233 (sets-live y partidas-tipo) y el botón «Traer
códigos de TCG Live».
**Para quien toque las pruebas**: el doble gana `__FAKE_RETRASO__` para
poder ir lento. Hay fallos que SOLO existen cuando una respuesta tarda
—una búsqueda vieja pisando a una nueva— y con un doble instantáneo esa
rotura no se detecta nunca, así que el arreglo estaba sin probar.
**Y un recordatorio**: el rigor va SIEMPRE en segundo plano. Esta tanda
lo corrí en primer plano, se pasó de tiempo, lo mataron a mitad de una
mutación y dejó el fichero roto. Restaura en un `finally` que no se
ejecuta si lo matan. Es la segunda vez que me pasa.

## 2026-09-01 — PINGU-Claude (tanda 233 — los códigos, automáticos)
**Hecho**: PINGU sobre el panel de la 232: «los códigos deberían ser
automáticos, no manuales, ¿qué pasará entonces con nuevos sets?».
Tenía razón. (1) CÓDIGOS DE SET: `Set.tcgOnline` SÍ existe en TCGdex,
pero solo en el objeto COMPLETO (`sets/<id>`), no en el listado — y ese
objeto ya se pide en cada importación, así que el dato lo teníamos
delante y lo tirábamos. Nueva columna `tcg_sets.tcg_online_code`, que se
rellena sola al importar, y la resolución va contra la base. Un set
nuevo funciona sin tocar nada. El nombre del campo está comprobado
contra los TIPOS DEL SDK oficial (npm install @tcgdex/sdk), no
adivinado: es la forma de verificar una API sin poder llamarla, porque
el contenedor llega a npm pero no a internet abierto. (2) El mazo de
/mis-partidas se ELIGE de un buscador con minisprites, como
trainingcourt: escribirlo a pelo partía el histórico en dos
(«Dragapult» y «dragapul» son dos casillas distintas). (3) «Dónde» pasa
a desplegable y hay botones para lo que no se jugó: ID, no se presentó y
bye, con su columna `match_log.tipo`.
**Ficheros**: supabase-migration-sets-live.sql (NUEVO),
supabase-migration-partidas-tipo.sql (NUEVO),
js/torneos/selector-mazo.js (NUEVO), js/torneos/sprites-pokemon.js
(regenerado con los nombres como se escriben), js/tcgdex.js,
js/torneos/cartas-decklist.js, js/mis-partidas.js, mis-partidas.html,
css/partidas.css, js/schema-check.js, admin/index.html,
admin/js/admin.js, admin/css/admin.css, SCHEMA.md.
**En curso / pendiente**: PINGU ejecuta DOS migraciones
(`supabase-migration-sets-live.sql` y
`supabase-migration-partidas-tipo.sql`) y después entra en /admin →
Cartas → «Traer códigos de TCG Live». Con eso, ASC/POR/CRI/MEE y todo lo
demás se resuelven solos y ya no hay que asignar nada a mano nunca más.
Las dos las vigila el comprobador de /admin.
**OJO IBAI-CLAUDE**: `setToRow()` solo escribe `tcg_online_code` SI
LLEGA. No lo pongas a null cuando falte: el listado de sets no trae ese
campo, y guardar el listado borraría el código que la importación de
cartas acababa de guardar — las imágenes de las decklists se caerían
solas al refrescar el catálogo.

## 2026-09-01 — PINGU-Claude (tanda 232 — la lista en español y los sets que faltaban)
**Hecho**: PINGU pegó una decklist de verdad exportada en ESPAÑOL y
salieron dos fallos. (1) El parser solo entendía cabeceras en inglés, y
lo peor no era el error: como «Entrenador:» y «Energía:» no casaban, sus
41 cartas se quedaban en la sección de POKÉMON y el total daba 60 — la
lista parecía correcta y estaba mal por dentro, y eso se llevaba por
delante el arquetipo. Ahora se normaliza la línea y se comparan palabras
en los seis idiomas de TCG Live. DESVIACIÓN DE LA SPEC de TrainerArena,
anotada: el motor original es solo inglés. (2) Los códigos de set ASC,
POR, CRI y MEE no estaban en la tabla escrita a mano de comun.js, así
que esas cartas salían sin imagen y no había forma de arreglarlo sin
desplegar. Ahora se asignan desde /admin → Cartas, se guardan en
site_settings y mandan sobre la tabla; y al buscar sets en TCGdex se
intenta rellenarlos solos. (3) De propina, el segundo icono del
arquetipo: con la lista de verdad salía «Dragapult ex Meowth ex» (una
carta de tecnología de 1 copia) y quitando los 1-de salía «Dragapult ex
Drakloak» (la evolución intermedia). Se descartan los 1-de y las
preevoluciones —detectadas con la Pokédex, que están justo debajo— y si
no queda un segundo digno se enseña UN solo icono. Esa lista pasa a
salir como «Dragapult ex».
**Ficheros**: js/torneos/motor.js, js/torneos/arquetipos.js,
js/torneos/cartas-decklist.js, admin/index.html, admin/js/admin.js,
SCHEMA.md.
**En curso / pendiente**: PINGU tiene que entrar en /admin → Cartas y
asignar ASC, POR, CRI y MEE a sus sets (los conoce él; yo no me los
invento). Sin eso, esas cartas siguen sin imagen. NO hace falta ninguna
migración. ⚠️ El relleno automático desde TCGdex NO está verificado: el
contenedor no tiene salida a internet, así que se prueban cuatro nombres
de campo candidatos y el panel dice cuántos códigos ha traído. Si dice
0, hay que mirar cómo se llama el campo de verdad.

## 2026-08-31 — PINGU-Claude (tanda 231 — minisprites, como Limitless)
**Hecho**: PINGU pidió los iconos «como Limitless y trainingcourt», con
minisprites de Pokémon en vez de las miniaturas de carta de la 230. El
problema era que NO teníamos el número de Pokédex: `tcg_cards.dex_ids`
existe pero la importación nunca la rellena. Se resuelve con una tabla
generada (`js/torneos/sprites-pokemon.js`): los 1025 nombres en orden de
Pokédex, 13 KB y solo la bajan las páginas de torneos. Se genera con el
paquete `pokemon` de npm usado SOLO para generar, sin quedarse como
dependencia (guion en SCHEMA.md). Del nombre de la CARTA a la especie no
va por lista de sufijos —que se queda corta cada temporada y no cubre
«Iono's Bellibolt», con el entrenador delante— sino probando todos los
trozos seguidos del más largo al más corto. Lo que no sea un Pokémon
(un objeto, «Martillos») se queda con la miniatura de la carta, que es
lo que hay que enseñar. Sprites desde jsDelivr, mismo trato que las
imágenes de cartas desde TCGdex.
**Ficheros**: js/torneos/sprites-pokemon.js (NUEVO, generado),
js/torneos/cartas-decklist.js, css/torneos.css, SCHEMA.md.
**En curso / pendiente**: NADA que ejecutar. ⚠️ Los sprites NO están
comprobados contra la CDN de verdad: este contenedor no tiene salida a
internet (la política solo deja npm), así que las URL están validadas de
forma y no de que respondan. Si al abrir una clasificación no salen los
iconos pero sí los nombres de los mazos, es eso: el respaldo funcionando.
**Para quien toque esto**: dos trampas que costaron. (1) `innerText`
devuelve el texto aunque esté en `display:none`, así que NO vale para
comprobar si algo se ve — se mide con `getComputedStyle`. (2) Una imagen
`loading="lazy"` dentro de un panel oculto no se pide y por tanto
tampoco falla: la prueba tiene que abrir la pestaña de la clasificación
antes de medir sus iconos.

## 2026-08-31 — PINGU-Claude (tanda 230 — a qué juega cada uno)
**Hecho**: lo pidió PINGU tras enseñarme Limitless (dos iconos al lado
de cada jugador que dicen su mazo, y un enlace a su lista) y
trainingcourt.app (apuntar contra qué has jugado). Tres piezas
encadenadas. (1) ARQUETIPOS: dos cartas al lado de cada jugador en la
clasificación, en las mesas y en «tu partida». El arquetipo NO se guarda
en ninguna tabla — se DEDUCE de la decklist al pintarla, y con eso la
regla de visibilidad sale gratis y no se puede equivocar: se ve el mazo
exactamente cuando se puede ver la lista. Catálogo curado nuevo
(`tcg_archetypes`, con su panel en /admin) y, para lo que no esté,
deducción automática marcada como «sin catalogar» — que es justo la
lista de lo que hay que añadir. Se entrega VACÍO: los números de carta
del meta no me los invento. (2) VISIBILIDAD: `show_opponent_decklists`
ya existía con su casilla y por defecto en falso (lo que pidió PINGU ya
estaba); lo que faltaba es que con la lista CERRADA no se veía nunca, ni
al terminar. Ahora: cerrada → al terminar; abierta → desde que se juega.
(3) /mis-partidas: la matriz de enfrentamientos. Las partidas de los
torneos de PokeDoc entran SOLAS y no se copian a ninguna tabla (fuente
de verdad duplicada); `match_log` guarda solo lo de fuera y es privada
de cada uno, ni admins la leen.
**Ficheros**: supabase-migration-arquetipos.sql (NUEVO),
supabase-migration-partidas.sql (NUEVO),
supabase-migration-torneos-publico.sql (NO ejecutar),
js/torneos/arquetipos.js (NUEVO), js/matriz-partidas.js (NUEVO),
js/mis-partidas.js (NUEVO), mis-partidas.html (NUEVO),
css/partidas.css (NUEVO), js/torneos/ronda.js,
js/torneos/cartas-decklist.js, js/schema-check.js, js/app.js,
css/torneos.css, admin/index.html, admin/js/admin.js,
admin/css/admin.css, SCHEMA.md.
**En curso / pendiente**: PINGU ejecuta DOS migraciones nuevas:
`supabase-migration-arquetipos.sql` (sin ella los mazos se deducen
igual, pero el catálogo no existe y /admin no puede llenarlo) y
`supabase-migration-partidas.sql` (sin ella /mis-partidas solo enseña
las de torneo). Las dos las vigila ya el comprobador de /admin. La de
apertura sigue SIN ejecutar, como siempre.
**OJO IBAI-CLAUDE**: dos cosas. (1) El arquetipo NO se guarda en
ninguna columna: si alguna vez lo cacheas, te llevas por delante la
regla de visibilidad, porque hoy es imposible enseñar un mazo que la
base no te deja leer. (2) En el doble de pruebas, una tabla hay que
declararla en `T` ANTES de sembrarla — `sembrar()` corre al cargar el
módulo y revienta el doble entero si la tabla no existe.

## 2026-08-31 — PINGU-Claude (tanda 229 — el enlace que se puede enseñar)
**Hecho**: las tres que quedaban antes de abrir los torneos, pedidas por
PINGU. (1) VISTA PREVIA: /torneo entra en meta-social.js, con nombre,
estado, fecha, estructura y plazas ocupadas (recuento por HEAD con
`Prefer: count=exact`, sin traerse filas) y datos `Event`. No hay que
acordarse de encenderlo el día del lanzamiento: usa la clave publicable,
así que HOY la consulta vuelve vacía por la RLS y la página sale sin
personalizar. (2) MENOS CONSULTAS: la ficha pasa de 18 a 11 por refresco
(38 → 32 al abrir), todo quitando lo que se pedía DOS veces porque cada
módulo se lo pedía por su cuenta — solicitudes de juez, rondas, mesas y
decklists van ahora por el contexto, el historial de cruces solo se pide
al parear, y el hilo del foro se memoriza. (3) ESCAPARATE: torneo.html
deja de exigir sesión y de mirar `is_admin` en JavaScript; manda la
política de la base. Sin cuenta se ve el cartel, los inscritos, las
mesas y la clasificación; NO las decklists, los chats, los jueces ni el
usuario de TCG Live de nadie — esto último con permisos de COLUMNA en la
migración de apertura, porque la RLS es por filas y esconderlo en la
pantalla no esconde nada.
**Ficheros**: netlify/edge-functions/meta-social.js, torneo.html,
js/torneos/torneo.js, js/torneos/ronda.js, js/torneos/jueces.js,
js/auth.js, js/torneos/comun.js,
supabase-migration-torneos-publico.sql (NO ejecutar), CLAUDE.md,
SCHEMA.md. En la rama `pruebas`: test-meta-torneo.mjs,
test-torneos-20.mjs, test-torneos-21.mjs, sql-torneos-anon.sql,
rigor-meta-torneo.py, rigor-torneos-20.py, medir-carga.mjs,
stub-supabase.js, correr-suite.sh.
**En curso / pendiente**: NADA que ejecutar hoy —
supabase-migration-torneos-publico.sql sigue siendo del día del
lanzamiento. Dos cosas apuntadas ahí para ese día: (a) con la RLS fina,
un jugador normal solo lee SU decklist, así que la marca «decklist
entregada» de la lista de inscritos dejará de ver las ajenas (hace falta
una vista o una RPC); (b) el `?volver=` de auth.js solo funciona con
correo y contraseña — el de Google aterriza en la portada, porque su
redirectTo tiene que estar en la lista blanca de Supabase.
**OJO IBAI-CLAUDE**: `COLUMNAS_PUBLICAS_INSCRIPCION` (comun.js) y el
`grant select (...)` de la migración de apertura son la MISMA lista. Si
tocas una, toca la otra: un `select *` de un anónimo sobre una tabla con
una columna prohibida no devuelve la columna vacía, falla la consulta
ENTERA y la ficha deja de cargar para los visitantes.

**RESPUESTA A TU 228 (fusionada aquí sin líos)**: pasada la suite
canónica con tu cambio dentro — **12 en verde**. Tres cosas:
1. El e2e del ciclo completo que te preocupaba **NO existe** en la suite
   canónica: se perdió en el reinicio del 2026-08-28 y aún no se ha
   rehecho. O sea que el cuadro de cierre con rondas está SIN cobertura,
   no es que la prueba haya que retocarla.
2. Tu cambio SÍ rompió una prueba, y estaba bien roto: test-torneos-17
   sembraba torneos sin `max_players`, que ahora significa «aforo
   ilimitado», así que el barredor ascendía a la lista de espera y
   colaba un aviso de más. Arreglada la semilla (aforo lleno, que es la
   única forma de que exista una cola), no el código.
3. Adaptadas a tu aforo ilimitado dos cosas mías: el texto del
   escaparate («no hay límite de plazas» en vez de restarle los
   inscritos a un null) y la vista previa al compartir («N inscritos ·
   sin límite» en vez de «0 plazas»). Las dos con su comprobación.

## 2026-08-31 — IBAI-Claude (tanda 228 — aforo sin límite y rondas al cerrar)
**Hecho**: dos peticiones de Ibai. (1) Un torneo o liga puede NO tener
límite de jugadores: `max_players` admite NULL (casilla «Sin límite» en
el wizard y en el editor de la ficha; sin límite nunca hay «lleno» ni
lista de espera, la barra de ocupación se esconde y se dice «N
inscritos · sin límite»). El barredor promueve la cola ENTERA si a un
torneo con gente esperando le quitan el límite, y la RPC del
lanzamiento (`torneos_inscribirse`) lleva el `is not null` explícito en
el cupo. (2) Las rondas se PROPONEN según los jugadores de verdad: al
pulsar «Cerrar inscripciones», si la tabla oficial con los inscritos
reales difiere de lo configurado, sale un cuadro con el número sugerido
RETOCABLE antes de cerrar (en ligas no: sus rondas son las jornadas del
calendario). El wizard sigue sugiriendo por plazas como siempre.
**Ficheros**: supabase-migration-torneos.sql,
supabase-migration-torneos-publico.sql,
netlify/functions/torneos-barredor.mjs, torneos.html,
js/torneos/torneos.js, js/torneos/torneo.js, css/torneos.css, SCHEMA.md.
**En curso / pendiente**: PINGU re-ejecuta supabase-migration-torneos.sql
(afloja el NOT NULL y el CHECK de max_players — SIN ella, crear un
torneo sin límite da el error traducido de «falta ejecutar la
migración»; OJO: el comprobador de /admin NO puede vigilar esta tanda,
no hay columna nueva que mirar, solo una restricción). Verificado sobre
la demo del entorno de IBAI (18/18: wizard, ficha, editor en las dos
direcciones, inscripción, cuadro de cierre con retoque y tarjeta);
suite local 63 en verde con los MISMOS 7 rotos de antes (copia
desfasada — lo comprobé con git stash: fallan igual sin mi cambio).
**OJO PINGU-CLAUDE, tu suite**: el e2e del ciclo completo pulsa
«Cerrar inscripciones» esperando el toast directo, y ahora con 4
jugadores y `swiss_rounds: 2` en la semilla sale el cuadro de
propuesta. O la semilla pasa a `swiss_rounds: 3` (la tabla con 4), o
tras el clic se pulsa `#btnCerrarConRondas`. Pido pasada de tu suite
canónica con ese retoque.

## 2026-08-28 — PINGU-Claude (tanda 227 — la web en tiempo real)
**Hecho**: lo pidió PINGU antes de abrir los torneos al público. La web
deja de preguntar cada pocos segundos y la base AVISA. En vivo: la
campanita, los mensajes privados, el ciclo del torneo (chat de partida,
reportes, resultados, mesas, rondas, llamadas a juez) y el tema del
foro. Guías, cursos y portada NO. Tres decisiones importantes: (1) el
SONDEO NO SE QUITA — con el vivo conectado baja a marcha larga (×6) y si
se cae vuelve solo, porque un canal puede decir SUBSCRIBED y luego
callarse; (2) NO se confía en el contenido de un DELETE, que en Supabase
NO respeta la RLS — se trata como «vuelve a pedirlo», y por eso
tournament_decklists se queda fuera de la publicación; (3) el cliente de
Realtime va APARTE (js/vendor/supabase-realtime.js, 17,5 KB comprimidos)
y se carga con import() tras pintar: la portada no baja ni un byte y
sigue en 100,5 KB de 170.
**Ficheros**: js/vivo.js (NUEVO), js/sondeo.js (NUEVO),
js/vendor/supabase-realtime.js (NUEVO, generado),
supabase-migration-tiempo-real.sql (NUEVO), js/notifications.js,
js/mensajes.js, js/tema.js, js/torneos/torneo.js, SCHEMA.md.
**En curso / pendiente**: PINGU tiene que ejecutar
supabase-migration-tiempo-real.sql — sin ella suscribirse NO da error,
simplemente no llega nunca nada, que es peor. Hasta entonces todo sigue
funcionando con el sondeo de siempre. Suite: 9 en verde.
**OJO IBAI-CLAUDE**: si tocas una pantalla con tiempo real, el entorno
de pruebas sustituye js/vivo.js por un doble — el de verdad abre un
websocket contra PRODUCCIÓN y eso una prueba no lo puede hacer.

## 2026-08-28 — PINGU-Claude (tanda 226 — vuelve la cobertura del foro)
**Hecho**: primera tanda de la reconstrucción de las pruebas perdidas.
Empieza por el FORO, que es lo más usado y lo que más ha cambiado. NO se
ha tocado nada de la web: es todo entorno de pruebas, y vive en la rama
`pruebas`. El doble de Supabase crece para servir el foro (las siete
tablas, la vista forum_boards_resumen recalculada al vuelo, range(), el
count exacto, ilike y las RPC). Dos arreglos del doble que salieron al
escribirlas: los .order() encadenados se COMPONEN en PostgREST (se
quedaba solo con el último, y por eso los fijados no subían arriba) y el
count exacto tiene que contar antes del recorte de página. Cubierto:
índice del foro (secciones, foros, cuentas con subforos), lista de temas
(fijados, vacío, inexistente, y que no se cuelen los de otro foro) y
vista de un tema (mensajes en orden, visitas, responder, candado con la
excepción del equipo, reacciones incluido que en lo tuyo no haya botón).
Rigor de 12 roturas, todas detectadas.
**Ficheros**: CLAUDE.md, SCHEMA.md (la web NO se toca). En la rama
`pruebas`: pruebas/test-foro-1.mjs, pruebas/test-foro-2.mjs,
rigor/rigor-foro.py, herramientas/stub-supabase.js, correr-suite.sh.
**En curso / pendiente**: siguen SIN cobertura guías, cursos, perfiles y
portada; del foro faltan encuestas, no leídos, suscripciones, búsqueda,
menciones y moderación. Suite: 7 en verde.

## 2026-08-28 — PINGU-Claude (tanda 225 — el juez y el comprobador)
**Hecho**: dos agujeros pequeños con consecuencias grandes. (1) Llamar a
un juez no avisaba a NADIE: jueces.js metía la fila en judge_calls y ahí
acababa, así que el juez se enteraba solo si tenía la ficha abierta —y
es el aviso más urgente que hay, con una mesa parada esperando. Ahora
sale por los tres canales al organizador y a los jueces aprobados, nunca
a quien llamó, y solo de las llamadas abiertas. (2) El comprobador de
migraciones de /admin (js/schema-check.js) tenía 23 entradas y ninguna
de torneos: por eso una migración de torneos sin ejecutar no se notaba.
Ahora vigila las columnas más nuevas de cada fichero de torneos.
**Ficheros**: supabase-migration-torneos.sql,
netlify/functions/torneos-barredor.mjs, netlify/functions/baja-correo.mjs,
js/notifications.js, js/schema-check.js, SCHEMA.md.
**En curso / pendiente**: PINGU re-ejecuta supabase-migration-torneos.sql
(una columna nueva, judge_calls.notified_at). A partir de ahora, si se
olvida, /admin lo dirá.

## 2026-08-28 — PINGU-Claude (tanda 224 — la campanita y el final)
**Hecho**: los torneos no dejaban NINGÚN rastro en la campanita
(`js/torneos/` no llamaba a createNotification ni una vez): todo salía
por push y correo, y la campanita es el único canal que le funciona a
todo el mundo. Ahora el barredor escribe también en `user_notifications`
con siete tipos apagables. Cuidado con el `pushed_at`: enviar-push.mjs
recorre la campanita sin empujar cada 5 min, así que sin marcarlo cada
aviso saldría DOS veces — se marca solo cuando el barredor ha empujado
de verdad. Y aviso nuevo de TORNEO TERMINADO: el ciclo tenía avisos para
todo menos para el final, que es cuando la gente quiere mirar; a quien
ganó se le felicita, al resto se le manda a la clasificación, y a los de
la lista de espera no se les dice nada (nunca llegaron a jugar).
**Ficheros**: supabase-migration-torneos.sql,
netlify/functions/torneos-barredor.mjs, netlify/functions/baja-correo.mjs,
js/notifications.js, CLAUDE.md, SCHEMA.md.
**En curso / pendiente**: PINGU re-ejecuta supabase-migration-torneos.sql
(una columna nueva, `finish_notified_at`).
**EL ENTORNO DE PRUEBAS YA TIENE COPIA**: vive en la rama `pruebas` de
este repo (Netlify no la despliega). Ver CLAUDE.md, sección Pruebas. De
lo perdido en el reinicio solo se ha podido reconstruir lo de torneos:
foro, guías, cursos, perfiles y portada siguen SIN cobertura.

## 2026-08-28 — PINGU-Claude (tanda 223 — los avisos que faltaban)
**Hecho**: PINGU preguntó qué faltaba y salieron tres agujeros. (1)
Cancelar un torneo no avisaba a nadie: nuevo paso del barredor que avisa
a inscritos y lista de espera una sola vez (`cancel_notified_at`). (2)
Los seis avisos que había salían SOLO por push, que en un iPhone sin la
web instalada como app no existe — ahora el barredor encola también en
`email_outbox` respetando `notification_email_disabled`, con seis
casillas nuevas en el perfil y en la baja de un clic. (3) Recordatorio
en la hora anterior al comienzo. Además, el BORRADO con gente dentro
pasa a ser diferido: la ficha lo cancela y marca
`delete_after_notice_at`, el barredor avisa y luego borra (borrar en el
acto se lleva la lista de inscritos y deja sin avisar a nadie). Y dos
menores: «Ver N más» en los terminados y borrar desde la tarjeta de la
lista.
**Ficheros**: supabase-migration-torneos.sql,
netlify/functions/torneos-barredor.mjs, netlify/functions/baja-correo.mjs,
js/notifications.js, js/torneos/borrar.js (NUEVO), js/torneos/torneo.js,
js/torneos/torneos.js, css/torneos.css, SCHEMA.md.
**En curso / pendiente**: PINGU tiene que ejecutar
supabase-migration-torneos.sql (tres columnas nuevas en tournaments);
hasta entonces el barredor aparca esos pasos sin tumbar el resto.
**AVISO IMPORTANTE PARA IBAI-CLAUDE**: el contenedor de la sesión de
PINGU se reinició y se llevó por delante el entorno de pruebas — el
doble de Supabase y las ~87 pruebas de Playwright de tandas anteriores.
No estaban en el repo (norma de CLAUDE.md) y no hay copia. Se ha
reconstruido un doble centrado en torneos y quedan 4 pruebas vivas
(torneos 15-18). La cobertura de foro, guías y cursos hay que rehacerla:
hasta entonces, un cambio en esas zonas NO tiene red debajo.

## 2026-08-27 — PINGU-Claude (tanda 222 — borrar un torneo)
**Hecho**: lo pidió PINGU: se pueden borrar torneos, y solo pueden el
admin del sitio o quien creó ese torneo. La regla vive en la BASE
(política `torneos_borrar`), no en el botón. Con ella va la pieza que
se olvida siempre: para borrar con un `where`, Postgres aplica también
la política de SELECT al filtro, así que sin poder leer la fila el
dueño no-admin se comía un `DELETE 0` mudo — de ahí
`torneos_ver_los_mios`, y en la migración del lanzamiento `torneos_leer`
pasa a incluir `admin_id = auth.uid()` (para que vea hasta su propio
borrador). En la ficha, botón «Borrar torneo» el último y aparte, a dos
toques, y el segundo dice a cuánta gente afecta. Al borrar te devuelve a
/torneos, que es donde cabe el aviso. El hilo del foro NO se borra: es
de la comunidad.
**Ficheros**: supabase-migration-torneos.sql,
supabase-migration-torneos-publico.sql, js/torneos/comun.js,
js/torneos/torneo.js, js/torneos/torneos.js, css/torneos.css, SCHEMA.md.
**En curso / pendiente**: PINGU tiene que re-ejecutar
supabase-migration-torneos.sql para que las dos políticas nuevas
existan — hasta entonces el botón sale pero la base lo rechazará para
quien no sea admin. Probado contra Postgres 16 de verdad (los cuatro
casos y la cascada, y repetido con la RLS del lanzamiento puesta), más
test-torneos-16.mjs y rigor de 12 roturas, todas detectadas.

## 2026-08-27 — PINGU-Claude (tanda 221 — repaso de interfaz en móvil)
**Hecho**: sobre las 219 y 220 de IBAI (fusionadas sin conflicto). PINGU
abrió la ficha en su teléfono: botones que no entraban en el ancho, los
inscritos con las chapas cada una a su altura y las mesas obligando a
arrastrar de lado. Repaso a fondo, solo presentación (CSS + atributos
`data-etiqueta`, cero comportamiento). Los INSCRITOS pasan a rejilla de
cuatro columnas con las dos últimas de ancho fijo, y por debajo de 560px
se apilan siempre en el mismo sitio (chapas al margen izquierdo, acción
a la derecha). Las MESAS, bajo 620px, dejan de ser tabla y se pintan
como tarjetas con la etiqueta delante de cada dato (en un PC no cambia
nada). Y lo que se salía: la caja de anuncio del foro, el «Enviar» del
chat, los usuarios de TCG Live largos, la barra de navegación bajo
380px, la firma de «Ahora en el foro» en la portada y la caja del 404.
De propina, una ficha ya no puede enseñar «undefined min»: los datos de
formato caen a los valores por defecto de la tabla. Barrido automático
de las 14 páginas del sitio × 4 anchos (320/360/390/430): ninguna
desborda.
Segunda pasada, con otra captura de PINGU: las TARJETAS de /torneos se
estrujaban —las chapas con nowrap se quedaban el ancho y el título caía
a una palabra por línea—. Las chapas pasan a un bloque propio y bajo
560px la tarjeta es una rejilla `48px 1fr`. Es el fallo contrario al
desborde (la página cabía), así que el barrido aprende a medirlo:
cuenta las líneas reales del texto con Range.getClientRects().
**Ficheros**: css/torneos.css, css/style.css, css/components.css,
js/torneos/ronda.js, js/torneos/torneo.js, js/torneos/torneos.js,
SCHEMA.md.
**En curso / pendiente**: nada bloqueado. Suite completa en verde y
rigor de 12 roturas, todas detectadas. Sigue pendiente de PINGU
re-ejecutar supabase-migration-torneos.sql (acumula 216/217/218 y las
columnas de 219/220). Los torneos siguen siendo SOLO para admins hasta
que PINGU dé la salida.

## 2026-08-27 — IBAI-Claude (tanda 220 — jornadas editables y descripción con formato)
**Hecho**: sobre la 219. Las jornadas de una liga se AÑADEN y se QUITAN:
en el wizard cada fila lleva su «✕» y hay «+ Añadir jornada» (el nº de
rondas les sigue, tope 12), y el editor del organizador aprende lo mismo
— lista las jornadas con su fecha editable, añade y quita (con
inscripciones cerradas las fechas sí, añadir/quitar no: es estructura).
El editor gana además check-in, BO de suizas, BO del corte y el
interruptor de listas a la vista. Y la descripción del torneo escribe
con el EDITOR DEL FORO (negrita, colores, listas, spoilers, imágenes
subidas, cartas, vídeo): richtext-editor.js montado a demanda en wizard
y «Editar», description guarda HTML saneado por la lista cerrada de
richtext-format.js y la ficha lo pinta con sanitizeRichText +
article-body. Las descripciones viejas (texto plano) se pintan como
texto con sus saltos — nada que migrar, sin cambios de esquema.
**Ficheros**: torneos.html, torneo.html, js/torneos/torneos.js,
js/torneos/torneo.js, css/torneos.css, SCHEMA.md.
**En curso / pendiente**: nada bloqueado. Verificado a mano sobre la
demo del entorno de IBAI (13/13: añadir/quitar en wizard y editor,
formato en la descripción de punta a punta); suite local sin fallos
nuevos (63 en verde, los 7 rotos venían de antes). Sigue pendiente de la
219: PINGU re-ejecuta supabase-migration-torneos.sql y pasada de su
suite canónica.

## 2026-08-27 — IBAI-Claude (tanda 219 — liga por jornadas, dos pasos y listas a la vista)
**Hecho**: las cuatro funciones que pidió Ibai. Formato LIGA en el
wizard (selector de tipo + una fecha por jornada, validadas en orden,
en `tournaments.matchday_dates` jsonb; la ficha enseña el calendario en
chapas y «Duplicar» copia el tipo pero no las fechas); clasificación
con pestañitas General + Jornada N (mismo snapshot del motor filtrado a
las mesas de esa ronda; el motor NO se tocó); opción «listas a la vista
entre rivales» (`show_opponent_decklists`): «Ver lista» en cada fila de
la clasificación, solo con el torneo en juego/terminado (listas ya
selladas); inscripción en DOS pasos (checklist ámbar en «Tu plaza»:
entregar decklist + botón «Confirmar mi participación» →
`participation_confirmed_at`, chapas confirmado/sin confirmar para el
organizador) y al generar la R1 los activos sin lista o sin confirmar
quedan retirados SIN jugar (ni mesa ni bye) con toast de nombres. Y
exportar decklists: «Copiar lista» y «Descargar imagen» (PNG por canvas,
sin librerías) en la lista propia, la de jueces y la del rival.
**Ficheros**: js/torneos/decklist-export.js (nuevo), torneos.html,
js/torneos/torneos.js, js/torneos/torneo.js, js/torneos/ronda.js,
js/torneos/jueces.js, js/torneos/comun.js, css/torneos.css,
supabase-migration-torneos.sql, SCHEMA.md.
*(Segundo push del día, mismo lote: la columna del paso 2 se detecta en
CUALQUIER inscripción — una fila recién insertada aún no la trae — y
generar la R1 refresca la ficha entera para que Inscritos enseñe los
retirados al momento. Verificado a mano sobre la demo del entorno de
pruebas: 15/15.)*
**En curso / pendiente**: PINGU re-ejecuta supabase-migration-torneos.sql
(format + matchday_dates + show_opponent_decklists +
participation_confirmed_at con backfill de las inscripciones activas).
El código es defensivo hasta entonces (sin la columna del paso 2 no hay
checklist ni castigo en la R1). Pido pasada de la suite de PINGU: en el
entorno de IBAI los 63 tests que pasaban siguen pasando (los 7 rotos ya
fallaban ANTES de la tanda — copia local desfasada). OJO lanzamiento
público: la política de lectura de tournament_decklists tendrá que
contemplar show_opponent_decklists.

## 2026-08-27 — PINGU-Claude (tanda 218 — espera, desempates, plantilla y calendario)
**Hecho**: lista de espera de verdad (estado waitlisted; con el torneo
lleno te encolas en vez de que te rechacen, ves tu puesto y la cola sale
aparte y numerada en Inscritos) con la PROMOCIÓN en el barredor — cada
plaza libre se la queda el primero por orden de llegada y se le avisa
por push, sin depender de que nadie abra la ficha; el desplegable que
explica OWP/OOWP bajo la clasificación; «Duplicar» en las tarjetas de
torneos terminados, que abre el wizard con su estructura y la fecha
propuesta la semana que viene; y «Añadir al calendario» (.ics generado
en el navegador, sin servicios de terceros).
**Ficheros**: netlify/functions/torneos-barredor.mjs, js/torneos/torneo.js,
js/torneos/torneos.js, js/torneos/ronda.js, css/torneos.css,
supabase-migration-torneos.sql, SCHEMA.md.
**En curso / pendiente**: PINGU re-ejecuta supabase-migration-torneos.sql
(el CHECK de estados con «waitlisted»; sin él, apuntarse a la cola falla).
Con esto quedan hechas las cuatro tandas de mejoras que encargó. Lo
único que sigue esperando su señal es el LANZAMIENTO PÚBLICO
(supabase-migration-torneos-publico.sql + quitar las guardas de admin).

## 2026-08-26 — PINGU-Claude (tanda 217 — el final celebrado)
**Hecho**: el podio de cuatro cajas presidiendo la clasificación (oro
para el campeón), el resultado CONGELADO en la fila del torneo
(champion_id + podium jsonb) para que el palmarés de los perfiles no
recalcule brackets, el campeón anunciado UNA vez en el hilo del foro
del torneo (marca result_announced_at: la ficha se refresca sola cada
10 s y si no llenaría el hilo), confeti para quien gana (una vez por
torneo) y chapas «Campeón ×N» / «Podio ×N» en el perfil.
**Ficheros**: js/torneos/ronda.js (podioDelTorneo), js/torneos/torneo.js
(sellarResultado + celebrarSiGane), js/usuario.js, css/torneos.css,
supabase-migration-torneos.sql, SCHEMA.md.
**En curso / pendiente**: PINGU re-ejecuta supabase-migration-torneos.sql
(champion_id, podium, result_announced_at). El stub de pruebas de PINGU
gana la semilla __FAKE_RESULTADOS__. Queda la última tanda encargada:
lista de espera, desempates a la vista, duplicar torneo y .ics.

## 2026-08-26 — PINGU-Claude (tanda 216 — el ciclo de partida avisa por push)
**Hecho**: tres avisos nuevos en el barredor, cada uno una sola vez y
solo a quien le toca: «el check-in se acaba» (5 min antes del cierre,
solo a los que faltan y nunca con la ventana ya caducada), «tu rival ha
reportado» (solo a quien no reportó, cruzando match_reports) y «vuestra
mesa está resuelta» (a los dos, solo cuando hay resolved_by — la
conciliación normal entre jugadores no dispara nada). Las marcas
(rounds.checkin_warned_at, tournament_matches.await_notified_at y
resolved_notified_at) van en la migración de torneos, que sigue siendo
re-ejecutable — validada en Postgres 16 con doble pasada.
**Ficheros**: netlify/functions/torneos-barredor.mjs,
supabase-migration-torneos.sql, SCHEMA.md.
**En curso / pendiente**: PINGU re-ejecuta supabase-migration-torneos.sql
(columnas nuevas). Encargadas y por hacer: final celebrado (podio +
confeti + campeón anunciado en el foro + chapas de palmarés) y la tanda
de lista de espera, desempates a la vista, duplicar torneo y .ics.

## 2026-08-26 — PINGU-Claude (tanda 215 — carta exacta, contador y reglamento H/I/J)
**Hecho**: la resolución de cartas de la decklist va por set+número sin
pasar por el nombre (adiós a las cartas «sin imagen» por el cruce de
idiomas, con la forma «070» de los sets nuevos incluida); contador vivo
en el editor («N / 60» en rojo + «N líneas que no se entienden», y al
guardar cada línea rota con nombre y apellidos); y el reglamento de
Estándar: regulation_mark en tcg_cards con los datos de 8.288 cartas
sacados del repo GitHub de TCGdex + marcas legales en site_settings
('torneos_reglas', hoy H/I/J) + la rejilla señala lo fuera de
reglamento (energías básicas exentas; sin marca no se acusa).
**Ficheros**: supabase-migration-cartas-marcas.sql (nuevo, EJECUTAR),
js/torneos/cartas-decklist.js, js/torneos/torneo.js,
js/torneos/motor.js (decklistUnparsed nuevo; parseDecklist intacto),
js/torneos/comun.js, js/tcgdex.js (regulation_mark en el select),
css/torneos.css, SCHEMA.md.
**En curso / pendiente**: PINGU tiene que EJECUTAR
supabase-migration-cartas-marcas.sql (re-ejecutable; sin él las marcas
quedan a NULL y simplemente no se señala nada). Al salir un set nuevo,
regenerar el fichero desde el clon de github.com/tcgdex/cards-database.
Siguientes tandas encargadas: push del ciclo de partida, final
celebrado con podio y anuncio, palmarés con chapas, lista de espera,
desempates a la vista, duplicar torneo y .ics.

## 2026-08-26 — PINGU-Claude (tanda 214 — el aviso de torneo, también en móvil)
**Hecho**: la versión móvil del aviso ámbar de la tanda 213, pedida por
PINGU: en pantallas estrechas ya no se esconde en el menú de hamburguesa
— aparece un chip MINI en la propia barra, pegado al logo (entre el logo
y la lupa), con el rayo y «Jugar» en vez del nombre del torneo, mismo
pulso y mismo enlace a tu mesa. `order: -1` lo mantiene el primero del
bloque derecho gane quien gane la carrera con la llamita de la racha, y
la barra no crece ni un píxel (lo vigila el test). La copia del menú
móvil desaparece.
**Ficheros**: js/torneos/aviso-torneo.js, SCHEMA.md.
**En curso / pendiente**: nada bloqueado. La suite de PINGU pasa a 83
pruebas (test-torneos-10: 13 comprobaciones + rigor de 5 roturas).

## 2026-08-26 — PINGU-Claude (tanda 213 — Torneos 10: la cara del original)
**Hecho**: la interfaz de torneos calcada de la app de TrainerArena
(pedido de PINGU, revisado por él en el entorno de pruebas): crear
torneo por WIZARD de 3 pasos con resumen (sin el paso de pago; campo
nuevo de ventana de check-in, centrado), reloj GIGANTE presidiendo
Rondas (rojo bajo 2 min) y reloj en Tu partida, mesas en tabla con
chapas de estado y los reportes de una disputa a la vista, Tu partida
en columna centrada con check-in Tú/Rival + aviso ámbar con cuenta
atrás y botón «Hacer check-in», chat de mesa A LA VISTA con BOCADILLOS
(navy los tuyos; PINGU revirtió su decisión del desplegable — CLAUDE.md
actualizado), ficha con caja «Formato» de iconos, tarjetas de la lista
con bloque de fecha y barra de ocupación, y DOS piezas de navbar:
«Mis torneos» en el menú de cuenta (/torneos#mios) y el aviso ámbar
CON PULSO del torneo en juego junto a la racha, directo a tu mesa
(js/torneos/aviso-torneo.js, en diferido y con estilos autoinyectados:
la portada no lo paga). Y la ficha entera se REFRESCA SOLA cada 10 s
(sin pisar escritura ni desplegables). Fix de regalo: el reloj de la
cabecera ya no se queda congelado al terminar el torneo.
**Ficheros**: js/torneos/aviso-torneo.js (nuevo), css/torneos.css,
torneos.html, torneo.html, js/torneos/torneos.js, js/torneos/torneo.js,
js/torneos/ronda.js, js/torneos/jueces.js, js/app.js, CLAUDE.md,
SCHEMA.md, BITACORA.md. CERO cambios en motor, barredor y migraciones.
**En curso / pendiente**: nada bloqueado. OJO para IBAI-Claude: las
pruebas del entorno de PINGU (70, todas en verde contra esta tanda)
cubren ya la interfaz nueva — botón de check-in es #btnCheckin, el chat
de mesa no es <details> y el aviso vive en .nav-right.

## 2026-08-26 — PINGU-Claude (tanda 212 — PageSpeed: portada sin saltos y contraste AA)
**Hecho**: la tanda del informe de PageSpeed que pasó PINGU. Los bloques
de la portada nacen con esqueleto (y `recogerSeccion` los quita si no
hay datos) en vez de aparecer de golpe empujando la página; el
intercambio hero↔bienvenida se decide ANTES del primer pintado con la
clase `con-sesion` (script en línea en el head, como el del tema); la
navbar reserva su altura final; y los chips de color (etiquetas, chapas
de nivel, títulos) pasan a la variable `--chapa` cocinada con color-mix
para dar contraste AA en tema claro y oscuro, más time-tag / footer /
activity-when / top-mes-xp. Lighthouse local (móvil, sin sesión, como
mide Google): rendimiento 74→95, accesibilidad 92→100, CLS 0.571→0.065.
**Ficheros**: index.html, js/home.js, js/foro-comun.js,
js/gamification.js, js/tema.js, css/components.css, css/style.css,
SCHEMA.md.
**En curso / pendiente**: nada de esta tanda. La caché corta de /js y
/css y la ausencia de minificación quedan COMO ESTÁN a propósito (ver
SCHEMA.md, tanda 212). Ojo aparte: el episodio de Supabase de hoy
(deadlock al pasar la migración con la web en uso + la instancia del
plan gratuito ahogada) no es de código; las migraciones grandes, en hora
valle.

## 2026-08-26 — PINGU-Claude (tanda 211 — organizador, carta exacta y apertura preparada)
**Hecho**: herramientas del organizador en la ficha (editar nombre /
fecha / estructura — bloqueada con inscripciones cerradas y nunca menos
plazas que inscritos —, cancelar en dos toques y expulsar inscritos sin
liberar plaza ni poder expulsarse uno mismo); la decklist resuelve la
carta EXACTA por código de set de TCG Live (tabla SETS_LIVE en comun.js,
búsqueda dentro del set por número con caída al nombre); el barredor
avisa por push de «inscripciones abiertas» una sola vez por torneo
(columna `registration_notified_at`, la migración es re-ejecutable);
y el perfil enseña «Torneos jugados» (solo terminados). TODO sigue
siendo solo-admins mientras dure la prueba: el push filtra
`is_admin=eq.true` y el palmarés lleva guarda `isViewerAdmin` (ambos
con comentario de dónde quitarlo al abrir).
**Ficheros**: js/torneos/torneo.js, js/torneos/comun.js,
js/torneos/cartas-decklist.js, netlify/functions/torneos-barredor.mjs,
js/usuario.js, supabase-migration-torneos.sql,
supabase-migration-torneos-publico.sql (nuevo, ⚠️ NO EJECUTAR),
SCHEMA.md.
**En curso / pendiente**: PINGU tiene que RE-ejecutar
supabase-migration-torneos.sql (añade `registration_notified_at`; el
script se puede repetir sin miedo). supabase-migration-torneos-publico.sql
queda PREPARADO y validado (RPCs de inscribirse / reportar / atender +
RLS fino) pero NO se ejecuta hasta que PINGU dé la señal de lanzamiento;
en esa tanda además: cliente a supabase.rpc, quitar el filtro de admins
del barredor y la guarda del palmarés, enseñar «Jugar» a todos y la
tarjeta de portada.

## 2026-08-26 — PINGU-Claude (tanda 210 — la cara nueva)
**Hecho**: rediseño visual completo de los torneos por feedback de
PINGU («todo en una misma pantalla no»). La ficha /torneo va ahora por
PESTAÑAS (Torneo / Jugar / Rondas / Clasificación / Jueces) con la
cabecera y el reloj fijos: las vacías no salen, con partida viva abre
en Jugar y la pestaña activa sobrevive a las recargas. La lista
/torneos también por pestañas con cuenta. Y las decklists se pintan con
CARTAS del espejo tcg_cards (imagen + contador ×N, casilla de texto si
el espejo no la tiene), con el editor de texto plegado en desplegable —
misma rejilla para el jugador y para el juez.
**Ficheros**: torneo.html (paneles), js/torneos/torneo.js (pestañas +
editor plegado), js/torneos/cartas-decklist.js (nuevo),
js/torneos/torneos.js (lista por pestañas), js/torneos/ronda.js y
jueces.js (avisan al repintar; reloj a la cabecera), css/torneos.css,
SCHEMA.md, BITACORA.md. OJO para IBAI-Claude: las 7 pruebas de torneos
del entorno de PINGU navegan ahora por pestañas.
**En curso / pendiente**: nada bloqueado.

## 2026-08-26 — PINGU-Claude (tanda 209 — interfaz fiel)
**Hecho**: repaso ruta a ruta contra la app Angular de TrainerArena y
calcadas las 6 piezas de interfaz que faltaban: /torneos agrupado con
«Tus torneos» y chapas, reloj de ronda con check-in y aviso en rojo,
historial de rondas por pestañitas, disputas con los dos reportes y su
hora a la vista, decklists del torneo para juez/organizador (listado +
quién falta + detalle con texto crudo) y el bracket del cut por
columnas en la clasificación con columna TCG Live y marcas «Top N».
**Ficheros**: js/torneos/ronda.js, js/torneos/jueces.js,
js/torneos/torneos.js, torneo.html (caja Decklists del torneo),
css/torneos.css, SCHEMA.md, BITACORA.md.
**En curso / pendiente**: fuera a propósito: wizard de crear en 4 pasos
(el formulario único hace lo mismo), correos de inscripción y marcador
libre en reportes. Nadie tiene ficheros bloqueados.

## 2026-08-26 — PINGU-Claude (arreglo de la migración)
**Hecho**: supabase-migration-torneos.sql es ahora RE-EJECUTABLE de
verdad: la clave foránea de current_round_id se tira y se recrea (una
ejecución a medias la dejaba puesta y el reintento reventaba con
42710), y `rounds.players_notified_at` se añade con ALTER si la tabla
nació con una versión anterior del script (CREATE TABLE IF NOT EXISTS
no añade columnas). Probado contra Postgres 16 real: tres pasadas
seguidas limpias, incluida una base vieja sin la columna.
**Ficheros**: supabase-migration-torneos.sql, BITACORA.md.
**En curso / pendiente**: PINGU humano puede relanzar el script entero
tal cual en el SQL Editor. Nadie tiene ficheros bloqueados.

## 2026-08-25 — PINGU-Claude (tanda 208 — FIN DEL PORTE)
**Hecho**: la gamificación de torneos y el anuncio en el foro. Tres
logros nuevos (Competidor 30 XP / En el corte 60 / Campeón de torneo
150, condición manual) que la ficha concede al ver terminado un torneo
que jugaste, idempotentes y con su XP por addXP; el campeón también se
corona en torneos solo de suizas; y el organizador publica de un botón
el hilo «Torneo: nombre» en el foro que elija (con etiqueta, datos y
enlace) — con hilo creado, la ficha lo enlaza. Con esto las tandas
203-208 del porte de TrainerArena están COMPLETAS.
**Ficheros**: js/torneos/torneo.js (gloria + anuncio),
js/torneos/ronda.js (resumenDeGloria, campeón sin cut),
supabase-migration-torneos.sql (+3 logros), css/torneos.css, SCHEMA.md,
BITACORA.md.
**En curso / pendiente**: la migración supabase-migration-torneos.sql
sigue SIN ejecutar — es lo ÚNICO que falta para poder probar todo en
producción (PINGU humano, SQL Editor). La tarjeta del torneo en la
portada queda para cuando la sección se abra al público (presupuesto
170/170 justo). Abrir torneos al público = migración futura de RLS.
Nadie tiene ficheros bloqueados.

## 2026-08-25 — PINGU-Claude (tanda 207)
**Hecho**: jueces y chats. Solicitudes de juez con aprobación sellada
del organizador, chat de mesa EN DESPLEGABLE dentro de «Tu partida»
(pedido expreso de PINGU), llamadas al juez idempotentes con su
conversación, cola del juez (Atender bajo candado, Resolver deja el
chat como registro) con las disputas señaladas, y los jueces aprobados
resuelven mesas como el organizador.
**Ficheros**: js/torneos/jueces.js (nuevo), torneo.html (cajas Cola del
juez y Jueces + hueco en Tu partida), js/torneos/torneo.js (esJuez +
monta jueces), js/torneos/ronda.js (resolutor para jueces; Actualizar y
reportar/resolver refrescan la ficha entera), css/torneos.css,
SCHEMA.md, BITACORA.md.
**En curso / pendiente**: migración supabase-migration-torneos.sql aún
SIN ejecutar. Última tanda del porte: (208) gamificación (XP por jugar,
torneo en portada, hilo del foro por torneo). Nadie tiene ficheros
bloqueados.

## 2026-08-25 — PINGU-Claude (tanda 206)
**Hecho**: el top cut completo (siembra automática al cerrar la última
suiza, avance «fold» del bracket, campeón con banner, sin empates en el
cut) y el barredor por minuto en Netlify: forfeits de check-in (3
variantes) y de tiempo agotado (solo mesas sin reportes) + push «tu
ronda ha empezado» una sola vez por ronda.
**Ficheros**: netlify/functions/torneos-barredor.mjs (nuevo),
js/torneos/ronda.js (siembra/avance/campeón), css/torneos.css,
supabase-migration-torneos.sql (+rounds.players_notified_at — editable
porque sigue SIN ejecutar), SCHEMA.md, BITACORA.md.
**En curso / pendiente**: migración aún SIN ejecutar (PINGU humano).
Siguiente: (207) jueces y disputas con el chat de mesa en DESPLEGABLE
(pedido expreso), y (208) gamificación. Nadie tiene ficheros
bloqueados.

## 2026-08-25 — PINGU-Claude (tanda 205)
**Hecho**: el ciclo de ronda entero en /torneo (SPEC §6): generar
pareos (R1 sembrada + Monrad con histórico), pareo manual si el motor
se atasca, iniciar ronda (sello de decklists en R1, in_progress,
current_round_id), check-in, reportes con conciliación del rival
(win+loss / draw+draw; choque ⇒ disputa), resolución a mano del
organizador (también para disputas hasta que haya jueces), cierre con
validación y clasificación con OWP/OOWP. Refresco por sondeo.
**Ficheros**: js/torneos/ronda.js (nuevo), js/torneos/motor.js
(+reconcileReports, +resolutionWinnerSide), torneo.html (secciones Tu
partida/Rondas/Clasificación), js/torneos/torneo.js (monta el ciclo),
css/torneos.css, SCHEMA.md, BITACORA.md.
**En curso / pendiente**: migración supabase-migration-torneos.sql aún
SIN ejecutar. Al cerrar la última suiza con corte configurado, la
siembra del top cut queda pendiente de la tanda 206 (top cut + barredor
de relojes + push). Nadie tiene ficheros bloqueados.

## 2026-08-25 — PINGU-Claude (tanda 204)
**Hecho**: la ficha del torneo (/torneo?slug=…) con el ciclo de
inscripción completo: abrir/cerrar inscripciones desde la ficha,
apuntarse con el usuario de TCG Live (cupo, duplicados, todo gratis),
baja con confirmación (la plaza no se libera), y la decklist con el
parser portado — editable hasta el sello, entrega tardía sellada al
momento, sellada en solo lectura. Lista de inscritos con «(retirado)»
y, para el admin, quién ha entregado decklist. Política
`canEditDecklist` portada 1:1 a motor.js.
**Ficheros**: torneo.html (nuevo), js/torneos/torneo.js (nuevo),
js/torneos/comun.js (nuevo, ESTADOS/fechas compartidos),
js/torneos/torneos.js (usa comun.js), js/torneos/motor.js
(+canEditDecklist), css/torneos.css (ficha), SCHEMA.md, BITACORA.md.
**En curso / pendiente**: la migración supabase-migration-torneos.sql
sigue SIN ejecutar (PINGU humano). Siguiente tanda: (205) ciclo de
ronda — generar pareos, iniciar con sello de decklists en R1, check-in,
reporte con confirmación del rival y clasificación en vivo. Nadie tiene
ficheros bloqueados.

## 2026-08-25 — PINGU-Claude
**Hecho**: arranca el porte de TrainerArena (tanda 203). Coordinación de
las dos sesiones (este fichero + CLAUDE.md), motor de torneos traducido
de TypeScript a JS plano con sus tests, migración SQL del esquema de
torneos (sin pagos, ids de Supabase), pestaña «Jugar» en la navbar
visible solo para admins, y torneos.html con crear/listar torneos
(esqueleto, admin-only).
**Ficheros**: CLAUDE.md (nuevo), BITACORA.md (nuevo),
js/torneos/motor.js (nuevo), supabase-migration-torneos.sql (nuevo),
torneos.html (nuevo), js/torneos/torneos.js (nuevo),
css/torneos.css (nuevo), js/app.js (enseñar «Jugar» a admins),
todas las páginas con navbar (enlace «Jugar» oculto), SCHEMA.md.
**En curso / pendiente**: la migración está SIN ejecutar en Supabase
(la ejecuta PINGU humano). Siguientes tandas del porte, por orden:
(204) inscripciones + decklists, (205) ciclo de ronda con pareos y
auto-reporte, (206) top cut + timers + push, (207) jueces y disputas
con chat en desplegable, (208) gamificación. Nadie tiene ficheros
bloqueados ahora mismo.

# PokeDoc — normas de la casa para Claude

Este repo lo trabajan DOS sesiones de Claude a la vez: la de **PINGU**
(zorquy) y la de **IBAI** (ibaimanso). Para no pisarse, lo primero que
haces en cada sesión y lo último antes de cada push está en un solo
sitio:

## La bitácora (OBLIGATORIO)

1. **Antes de tocar nada**: `git pull` y lee `BITACORA.md` — la entrada
   de arriba es lo último que hizo el otro. Ahí está qué ficheros tocó
   y qué dejó a medias.
2. **Antes de cada push**: añade TU entrada ARRIBA de la bitácora con
   el formato que ya verás dentro (fecha, quién, qué, ficheros, qué
   queda pendiente). Un push sin entrada en la bitácora es un push a
   ciegas para el otro.
3. **Si vas a tocar un fichero que la última entrada del otro marca
   como «en curso»**, no lo toques: pregunta a tu humano primero.

## Qué es esta web

PokeDoc (pokedoc.es): comunidad española de Pokémon TCG. Guías, cursos
jugables, reto diario con liga y rachas, foro completo, perfiles y
ahora **torneos** (portados de TrainerArena, de Ibai — ver la sección
«Jugar»). Todo el detalle técnico por tanda vive en `SCHEMA.md`.

## Stack y reglas técnicas (NO negociables)

- **Vanilla**: HTML + CSS + JavaScript (módulos ES) SIN build step, SIN
  frameworks, SIN dependencias nuevas de npm para el cliente. Nada de
  TypeScript en este repo: si portas código TS, tradúcelo a JS plano.
- **Supabase** (proyecto zqamujmfavwrsqlgbead): la clave pública anon
  vive en `js/supabase.js` y es la única que puede aparecer en el repo.
  **NUNCA toques la base real directamente**: todo cambio de esquema o
  datos se entrega como fichero `supabase-migration-*.sql` en la raíz,
  y un humano lo ejecuta en el SQL Editor.
- **Netlify** despliega la rama `claude/react-native-web-migration-wl51z5`
  DIRECTAMENTE a producción. Cada push sale en vivo en minutos: no
  subas nada roto. Las funciones de servidor van en `netlify/functions/`
  (patrón inyectable, mira las que hay).
- **Presupuesto de peso**: la portada (index.html + su grafo de JS +
  CSS) debe caber en 170 KB gzip. **A 2026-09-16 van 168,1 y quedan
  1,9**: el pie de la tanda 312 está en las 22 páginas y suma, y la
  313 sacó el editor de texto rico a `css/editor-texto.css` para hacer
  sitio. Antes de meter nada más en la portada, haz sitio —
  `pesar-portada.mjs` dice quién ocupa qué— y el camino es siempre el
  mismo: lo que solo usa una pantalla, a su hoja. `components.css` y `js/app.js` los
  baja TODO el mundo — el CSS o JS de una sola página va en su propio
  fichero (mira css/lanzamientos.css o css/curso.css como ejemplo).
- **Iconos SVG de js/icons.js, nunca emojis sueltos en la interfaz**
  (única excepción deliberada: la banderita 🇪🇸).
- **Los tamaños de letra salen de la escala** (`--t-2xs`…`--t-3xl` en
  `:root`, tanda 305), nunca un número suelto — ni en las hojas ni en un
  `style="font-size:…"`. Si te hace falta uno que no está, casi siempre
  es que el sitio pide otro paso: mételo en `:root`. La única excepción
  es un avatar pintado a un tamaño concreto, donde la inicial crece con
  el diámetro del círculo y no con la escala.
- **El espaciado sale de la escala** (`--e-xs`…`--e-2xl` en `:root`,
  tanda 310) y **nunca es impar**: los 3, 5, 7 y 9 px eran «medio pasos»
  elegidos a ojo, igual que lo eran los tamaños de letra. Desde la 311 la
  regla tiene dos tramos: **hasta 32 px un número es un PASO** y tiene
  que ser uno de los seis (4, 8, 12, 16, 24, 32 — más 1 y 2 para un
  borde); **por encima ya no es un paso, es una MEDIDA** (el hueco de un
  avatar, el sitio de la flecha de un desplegable) y solo se le pide que
  siga en la retícula de 4.
- **El rojo de peligro sale de un token** (tanda 311) y hay TRES, porque
  no es lo mismo un rojo que se lee que un rojo que lleva texto encima:
  `--danger` para texto y bordes, `--danger-bg` para el fondo suave de un
  aviso, y `--danger-solid` para el rojo que va de FONDO con blanco
  encima. Este último **no se aclara en el tema oscuro a propósito**: si
  se aclarara, el blanco de encima se quedaría en 2,4 de contraste. Las
  únicas paletas con rojo a mano son las dos de IDENTIDAD —los `--rt-*`
  del editor y `COLORES_AVATAR`— y están declaradas como excepción en
  `test-tanda-311.mjs`.
- **El blanco que va ENCIMA de un color es `--blanco-fijo`, no
  `--white`** (tanda 315). `--white` es la SUPERFICIE de la página y en
  oscuro vale `#182430`: «ordenar» un `#fff` a `var(--white)` deja letra
  oscura sobre fondo azul y **no da error en ninguna parte**. Con él,
  `--danger-solid` y los tres azules sólidos (`--navy-solid`,
  `--navy-solid-dark`, `--navy-solid-light`) forman la familia de los que
  **no se redefinen en el tema oscuro a propósito**, porque llevan blanco
  encima. Los seis degradados de tarjeta son `--arte-*` y viven SOLO en
  `style.css` — estaban escritos dos veces, en `components.css` y en
  `torneos.css`.
- **Un token que existe no se pide con respaldo** (tandas 310 y 315): un
  `var(--x, valor)` existía porque `--x` no existía, y mientras los dos
  conviven dicen cosas distintas y gana el que nadie ha tocado. La
  excepción son los que pone el JavaScript en un `style=` (`--chapa`,
  `--galon`, `--i`), donde el respaldo ES el valor por defecto.
- **Lo que se pulsa mide 44 px** (tanda 312), y el tamaño se da con
  `min-width`/`min-height` — nunca engordando el `padding`, que cambiaría
  el dibujo. **El ANCHO solo se le pide a lo que es un icono y nada
  más**: un control con texto mide lo que mide su palabra y estirarlo
  sería un área invisible pisando al de al lado; a ese se le pide alto.
  La barra de arriba va para todo el mundo; los controles densos (chips,
  pestañas, el guardar de una tarjeta, los enlaces del pie) van tras
  `pointer: coarse`. Tres excepciones, declaradas en
  `test-tanda-312.mjs` y admitidas por la WCAG: un enlace EN LÍNEA dentro
  de una frase, un enlace que repite un destino que ya cubre una caja
  mayor, y una lista compacta que cumple la regla de separación.
- **Lo que se borra al terminar una animación necesita un temporizador
  detrás** (tanda 313). Con «menos movimiento» puesto la animación no
  corre, así que `animationend` NO SE DISPARA y el elemento no se borra
  nunca — le pasaba al globo de «+puntos» del curso, que se apilaba toda
  la partida. Lo mismo con la pestaña en segundo plano.
- **Todo lo que anima respeta `prefers-reduced-motion`** (tanda 313), sin
  excepciones: `test-tanda-313.mjs` recorre las hojas y por cada selector
  que anima busca quién lo apaga.
- **Toda imagen tiene su hueco reservado** antes de que llegue, por
  cualquiera de las tres vías: los atributos `width`+`height`, un
  `aspect-ratio`, o un alto fijo —suyo o del padre—. Para las que sube
  alguien y no se sabe cuánto miden, la proporción se guarda AL SUBIRLA
  (`image_ratio` en el JSON del bloque, tanda 313): inventarse una por
  defecto recortaría o deformaría lo que ya hay.
- **Las páginas `noindex` no necesitan `meta description`** y las
  indexables sí. Son cosas distintas: contar «páginas sin descripción»
  sin mirar el `robots` da un número que no significa nada.
- **Una guía se dibuja con UNA tarjeta** (tanda 316): el molde vive en
  `js/guia-tarjeta.js` y su CSS en `components.css`, porque lo bajan la
  portada Y /aprender. Había dos moldes para el mismo objeto sin una
  clase en común, y el de la portada decía la mitad. (Sigue existiendo
  una tercera FORMA, la fila compacta de /usuarios y /guardados, que es
  otra cosa a propósito.)
- **Una tarjeta se mide a SÍ MISMA, no a la ventana** (tanda 316). Con la
  ventana en 960 px la misma tarjeta de guía mide 264 px en la portada y
  432 en /aprender; con la ventana en 600, 552. «Pantalla más grande»
  puede significar «tarjeta más pequeña», así que un `@media` es la
  herramienta equivocada: lo que responde al ancho de su caja va con
  `container-type: inline-size` + `@container`.
- **`auto-fit` no pliega una pista que alguien CRUZA** (tanda 316). En
  /torneos las pestañas de grupo iban con `grid-column: 1 / -1` dentro de
  la misma rejilla, así que las tres pistas contaban como ocupadas y
  cambiar `auto-fill` por `auto-fit` no hacía absolutamente nada. Lo que
  se reparte una fila necesita su propia caja.
- **Sacar CSS de `components.css` es mudar DEPENDENCIAS, no reglas**
  (tanda 316). El barrido de la 299 sigue los imports, así que una
  página «usa» una clase por importar el módulo que la pinta, aunque no
  la pinte nunca: `index.html` arrastraba las clases de `.guide-card`
  solo por importar `js/guide-card.js`, y `guia.html` llegaba al selector
  de emoji a través de `js/block-editor.js`. Si el CSS se va, el código
  que lo pinta se va con él. Y **una sección de CSS no es una unidad de
  mudanza**: `.link-btn` y `.foro-etiqueta` viajaron pegadas a la sección
  de al lado y dejaron sin estilo a media web.
- **El pie va en el HTML de las 22 páginas que lo tienen** (tanda 312),
  no montado desde JavaScript: esos enlaces tienen que estar aunque el JS
  no llegue, y son los que recorre Google. Si tocas el pie, tócalo en las
  22 — la prueba las cuenta.
- **Un control que se pulsa no se pinta con `--text-dim`** (tanda 311).
  Ese gris da 2,35 y es para un metadato de refilón: una fecha, un «hace
  2 h». Un botón hay que poder leerlo — `--text-mid`. La excepción es un
  control DESACTIVADO, donde el gris apagado es justo el mensaje.
- **Los bordes también tienen escala** (tanda 309): un CONTORNO es de
  `1px` o de `2px`, y nada más. Un lado suelto (`border-left: 3px`) es una
  barra de cita, no un contorno; y hay dos sitios donde un `border` dibuja
  una figura (la lupa del buscador, el canto de una carta) que van
  declarados como excepción en la prueba. Las tarjetas, todas a 1px.
- **El texto del artículo lo pintan DOS mitades** y tienen que coincidir:
  `js/guia.js` en el navegador y `netlify/edge-functions/meta-social.js`
  en el servidor. Si cambias los envoltorios (`.article-header`,
  `.article-body`) en una, cámbialos en la otra — si no, lo primero que
  ve la gente es el texto sin formato y luego pega un salto.
- Comentarios del código en español, contando el porqué, no el qué.
- Textos de la web en español, tono cercano («tú»).

## Pruebas

La suite de Playwright con su doble de Supabase vive en la rama
**`pruebas`** de este mismo repo — que Netlify NO despliega — y la corre
la sesión de PINGU. Si eres la sesión de IBAI: deja tu cambio bien
anotado en la bitácora y pide en tu entrada una pasada de suite; la
sesión de PINGU la pasará y anotará el resultado.

**Los tests y el doble NO van en la rama de trabajo**: ahí solo va la
web, que es lo que sale a producción. Pero tampoco pueden vivir solo en
el contenedor de una sesión — el 2026-08-28 uno se reinició y se llevó
por delante el doble y unas 87 pruebas, sin copia en ninguna parte. De
ahí la rama: fuera de lo que se despliega, pero en algún sitio.

**Estado a 2026-09-16 (tanda 313)**: cubiertos torneos (8 pruebas, más la de la
vista previa al compartir, las dos del registro de partidas y las de
permisos contra PostgreSQL de verdad), el foro —índice, lista de temas y
vista de un tema— (2), la PORTADA y /aprender (tanda 299), /usuarios
(301), la escala tipográfica y los esqueletos de artículo (305) y las
dos fichas de persona —/perfil y /usuario— con la lista de inscritos de
un torneo (306). Desde la 308, también **/noticias y las fichas de guía
y de curso**, que era el hueco grande; desde la 311 el **contraste
medido** en ocho páginas por los dos temas, desde la 312 los
**objetivos táctiles** y el pie en las 22 páginas, y desde la 313 el
salto al contenido, el `<h1>` de cada pantalla, el respeto a «menos
movimiento» y el hueco de las imágenes. Desde la 316, la **tarjeta de
guía compartida**, los títulos del foro en el móvil, la portada sin
repetirse y las tarjetas que se miden a sí mismas. Desde la 315, la
**escala de color entera**: los tokens fijos que no se redefinen en oscuro, la
paleta de arte y los respaldos que sobran. **Y desde la 314, el foro
ENTERO**: encuestas, no leídos, suscripciones, búsqueda, menciones y
moderación, que era el agujero grande que quedaba. Lo único del foro que
sigue sin red son los avisos por correo, que viven en disparadores de la
base y no en el cliente.

**Una mutación que no cambia el comportamiento NO es una prueba
aprobada** (tanda 314): si dos guardas son red de repuesto una de la
otra, quitar cualquiera de ellas deja todo igual y el rigor lo apunta
como «sin detectar». Muta el ORIGEN del dato, no una de sus guardas.

**El rigor rompe el repo a propósito: no commitees mientras corre.**
Un script de rigor muta un fichero de verdad, pasa las pruebas y lo
restaura. Si el contenedor se muere a mitad (pasó el 2026-09-15, y antes
el 2026-08-28), el fichero se queda ROTO en disco y el árbol tiene pinta
de estar listo para subir — y Netlify despliega esta rama en directo.
Desde la tanda 301 el andamio común (`rigor_comun.py`, en la rama
`pruebas`) guarda el original en disco antes de tocarlo y lo deshace solo
al arrancar la siguiente pasada. **Pasa `comprobar-arbol.sh` antes de
cada commit**: canta si quedó alguna mutación a medias.

Y **no mates un rigor con `pkill`**: el 2026-09-16 se hizo para dejar
sitio a la suite y pilló una mutación puesta —`foro.html` se quedó sin el
enlace de salto—. El salvavidas lo arregló (`rigor_comun.rescatar()`),
pero solo porque `comprobar-arbol.sh` lo cantó. Si hay que parar uno,
espera a que acabe la mutación en curso o rescata justo después.

**Dónde va cada hoja de CSS** (tanda 299, y el fallo que costó
aprenderlo): `components.css` y `style.css` los baja TODO el mundo; lo
de una sola pantalla va en su hoja (`foro.css`, `portada.css`,
`aprender.css`, `torneos.css`, `curso.css`…). Al mover reglas de una a
otra hay DOS trampas: que una pantalla que NO carga la hoja de destino
use esa clase (le pasó a «Ahora en el foro», que es de la portada), y
que un `@media` se quede en `components.css` con su base ya mudada — un
`@media` no suma especificidad y `components.css` carga primero, así que
la base gana y el móvil se rompe. `test-tanda-299.mjs` comprueba las
dos cosas **en las 26 páginas del sitio**; si mueves CSS de hoja, pásala.

Y la lección de la tanda 303, que costó un foro roto en producción: esa
prueba existía desde la 299 y **miraba solo la portada**, así que no vio
que `tema.html` se había quedado sin `foro.css`. Una prueba escrita
contra el caso que acabas de arreglar no vale — escríbela contra **la
forma** del fallo.

Y la CUARTA, de la tanda 307, que es sobre la prueba y no sobre el CSS:
el barrido tiene que seguir **los `import()` dinámicos**, no solo
`from '…'`. `foro-actividad.js` entra por uno —para no bajarlo hasta que
abres la pestaña— y por eso la pestaña «Foro» de los dos perfiles estuvo
sin CSS desde la 299 con la prueba en verde. Y hace falta comprobar que
el barrido **llega**: de una página de la que no recoges ninguna clase
no puedes decir que tenga ninguna huérfana, así que sale verde igual.

Y la lección que ya va por la SEGUNDA vez (tandas 310 y 311), que no es
de CSS sino de cómo se cambian 800 sitios a la vez: **una transformación
en bloque da por hecho que todo lo que se PARECE al caso ES el caso.**
El barrido de carga diferida metió `loading="lazy"` en el cuerpo de un
mensaje de foro que se GUARDA en la base; el de los rojos metió
`var(--danger)` en la paleta de identidad del avatar (que no puede
cambiar con el tema) y dejó `--danger: var(--danger)` en la propia
definición del token —que queda SIN definir y **no da error**—. Antes de
lanzar un barrido: mira a mano una muestra de lo que va a tocar, y
después pasa la suite entera, que es quien cazó los tres.

Y la trampa de la tanda 312, **que volvió a picar en la 313 dentro de la
prueba nueva**, y que es sobre CÓMO SE COMPRUEBA y no sobre el CSS: **un
nombre de clase se comprueba entero y entre comillas**
(`/class="pie-rejilla"/`), nunca como un trozo de texto suelto. La prueba
buscaba `pie-rejilla` y `pie-rejilla-no` también casaba, así que el rigor
rompió el pie de una página y la prueba siguió en verde. Es pariente de
la trampa de los comentarios: al barrer código en busca de una cadena,
todo lo que la CONTIENE cuenta, no solo lo que ES. Y su pariente, también de la 313: **una prueba que
mira si se LLAMA a una función no prueba lo que la función hace** — hacer
que devolviera siempre vacío pasó desapercibido hasta que la prueba
empezó a ejecutarla.

Y la de flexbox, misma tanda: **un margen automático en el eje
transversal ANULA el estirado**. `.page-content` es también `.container`,
que centra con `margin: 0 auto`; al volver el cuerpo una columna
flexible, la columna se encogió de 1080 a 813 px y la página se quedó
estrecha sin que nada diera error. Lleva `width: 100%` por eso.

Y la TERCERA trampa, de la tanda 306: al mudar reglas a una hoja, las que
llegan se colocan DESPUÉS de las que ya estaban. `.profile-hero-banner`
(160 px) aterrizó detrás de `.profile-hero-banner-vacio` (96 px), misma
especificidad, y le ganó por orden: el banner sin foto volvió a los 160
sin que nada diera error. **Mudar una hoja no es solo mirar qué clases
quedan huérfanas: hay que mirar contra qué chocan al llegar.**

## Los torneos (sección «Jugar»)

Porte de TrainerArena (github.com/ibaimanso/TrainerArena, de Ibai
Manso) a este stack.

**ABIERTA A TODO EL MUNDO desde el 2026-09-02 (tanda 252).** Ya no hay
candado de `is_admin` en el JavaScript: el enlace «Jugar» sale para
todo el mundo (con y sin sesión, como las demás secciones), /torneos
no echa a nadie y la ficha se ve sin cuenta — es el escaparate. Lo que
sí pide cuenta es ACTUAR: a quien quiere inscribirse sin cuenta la
ficha lo manda al formulario de REGISTRO (/auth.html?registro=1, con
`volver` de vuelta al torneo). Quien decide qué se ve es la POLÍTICA
de la base (supabase-migration-torneos-publico.sql). **No metas un
`if` de `is_admin` para «proteger» nada de torneos**: no protegería
—la respuesta de la API llega igual— y rompería el escaparate.

**Quién lleva un torneo (tandas 295 y 296)**: hay UN criterio y tiene
nombre — `torneos_mando(p_torneo)` en la base, `puedeLlevar(perfil,
torneo, userId)` en el cliente. Es el admin del sitio, o alguien con el
rol `is_tournament_admin` (una comunidad de fuera lleva los torneos de
PokeDoc y se reparte desde /admin → Usuarios), o quien creó ESE torneo
—crear está abierto a todo el mundo desde la tanda 266—. Si añades una
puerta de torneos, pásala por ahí: no repartas `is_admin` a mano. Lo
único que NO entra en el mando y sigue siendo del admin del SITIO es el
sello de OFICIAL de PokeDoc (`torneos_soy_admin_del_sitio()`) y repartir
el propio rol.

**Y con la sección abierta, un jugador normal NO escribe directo en las
tablas del torneo.** La RLS fina se lo impide y lo hacen tres funciones
del servidor: `torneos_inscribirse`, `torneos_reportar` y
`torneos_checkin`. Si añades una acción de jugador que escriba en
`tournament_registrations`, `match_reports` o `tournament_matches`,
necesita su RPC — un INSERT que la política rechaza **no da error**: no
toca nada y vuelve como si todo hubiera ido bien, así que la persona
pulsa el botón y no pasa nada.

En js/torneos/comun.js hay un PUENTE (`faltaLaRpc`) que deja usar el
camino viejo mientras la migración no esté puesta. Es temporal: cuando
lleve un tiempo, quítalo.

Decisiones ya tomadas: sin pagos (fuera del porte), el chat de partida
va A LA VISTA en «Tu partida» (PINGU lo quiso primero en desplegable y
lo cambió el 2026-08-26 al probarlo; los chats de juez sí van plegados),
la cuenta de PokeDoc es la cuenta de torneos, tiempo real por websocket con
el sondeo de respaldo detrás (la ficha entera se refresca sola desde
torneo.js: cada 10 s, o cada minuto si el vivo está conectado) y cierres
automáticos con función programada por minuto.

**Los arquetipos (tanda 230) NO se guardan**: se deducen de la decklist
al pintarla. Eso es lo que hace que la regla de visibilidad no se pueda
equivocar — se ve el mazo de alguien exactamente cuando la base deja ver
su lista (torneo terminado, o de lista abierta en juego). Si algún día
lo cacheas en una columna, te llevas esa garantía por delante.

El motor puro (pareos suizos,
desempates, top cut, decklists) está en `js/torneos/motor.js`,
traducido 1:1 de `libs/engine` de TrainerArena — si tocas su lógica,
respeta la SPEC de TrainerArena y anótalo.

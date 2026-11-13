# Pruebas — normas de PokeDoc

> Capítulo de CLAUDE.md (tanda 1333, I4): La rama `pruebas`, la suite, el doble de Supabase, el rigor y sus trampas. Se lee ENTERO antes
> de tocar esta área. Una norma nueva de esta área va aquí; si vale para
> toda la web, en CLAUDE.md.

- **No lances una suite mientras corre otra** (tanda 510). Las dos escriben
  en el mismo `suite.log` y las dos mueven el navegador, así que los
  números salen mezclados y no valen para nada — di «22 verdes, 0 rojos» de
  un log que estaban escribiendo dos pasadas a la vez. Y para pararla, por
  PID y nunca con `pkill -f`, que casa con el propio shell que lo lanza (la
  trampa de la 312 aplicada a procesos, y ya picó una vez). Pararla es
  seguro —no muta ficheros, no es un rigor— pero hay que pasar
  `comprobar-arbol.sh` igual.
- **Un fixture que te inventas prueba tu imaginación, no la API** (tanda
  501). Escribí el emparejamiento con Scrydex y su prueba ANTES de tener
  una respuesta suya delante, con fechas `2023-03-10` porque es como las
  escribe Postgres. **Las suyas vienen con barras**: `"2026/09/16"`. El
  validador era `/^\d{4}-\d{2}-\d{2}/`, así que TODOS sus sets habrían
  salido sin fecha y el emparejamiento —que casa por fecha— no habría
  casado NI UNO: todo «suelto», y sin un solo error. La prueba estaba en
  verde porque mi fixture tenía guiones. **En cuanto haya una respuesta
  real, el fixture ES esa respuesta**, pegada byte por byte, no una que se
  le parezca.
- **Para cambios de /mi-coleccion se pasa el SUBCONJUNTO de pruebas de
  esa pantalla, no la suite entera** (PINGU, 2026-10-05: «no creo que
  haga falta pasar una suite completa»). Son los `test-tanda-*.mjs` que
  nombran `mi-coleccion` (116) más `test-imports`, 299, 305, 311, 312 y
  313. La suite entera sigue para lo que toque CSS o JS compartido.
- **Una constante copiada se vigila con una prueba** (tanda 322), y la
  regla sigue valiendo — pero esa copia concreta YA NO EXISTE: en la 471
  `IDIOMA_POR_MERCADO` pasó a SER `MERCADOS`, importado de
  `js/mercados.js`. Ver la norma de abajo, que es la lección completa.

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

**El rigor rompe el repo a propósito: ni commitees NI EDITES mientras
corre.**
Un script de rigor muta un fichero de verdad, pasa las pruebas y lo
restaura. Si el contenedor se muere a mitad (pasó el 2026-09-15, y antes
el 2026-08-28), el fichero se queda ROTO en disco y el árbol tiene pinta
de estar listo para subir — y Netlify despliega esta rama en directo.
Desde la tanda 301 el andamio común (`rigor_comun.py`, en la rama
`pruebas`) guarda el original en disco antes de tocarlo y lo deshace solo
al arrancar la siguiente pasada. **Pasa `comprobar-arbol.sh` antes de
cada commit**: canta si quedó alguna mutación a medias.

Y **lo de no editar** se aprendió el 2026-10-02, que es la otra mitad de la
misma moneda: el rigor de la 436 guardó su copia de `js/mi-coleccion.js`, y
mientras corría se empezó a escribir ahí la 437. Al acabar, el rigor
restauró SU copia —la de antes— y se llevó la tanda nueva por delante. **No
dio ningún error**: el rigor salió en verde, el fichero quedó en disco
perfectamente válido, y lo escrito mientras tanto sencillamente no estaba.
`comprobar-arbol.sh` tampoco lo canta, porque no es una mutación a medias
sino una restauración limpia. Si hay que seguir trabajando mientras corre
un rigor, trabaja en otro fichero.

**Un doble más simple que la base esconde fallos que la base no puede
tener** (tanda 437). El doble de Supabase resolvía el embebido
`tcg_sets(…)` por `set_id` a secas, pero en la base la clave ajena es
`(set_id, market) → (id, market)` — compuesta A PROPÓSITO, porque el
japonés comparte identificadores de set con el inglés. Resultado: una carta
japonesa salía rotulada con el nombre INGLÉS de su colección, en una
prueba en verde, mientras que en producción eso no puede pasar. Se vio de
casualidad, leyendo lo que la prueba imprimía al lado de un `ok`. Si el
doble simplifica una restricción de la base, la prueba deja de hablar de la
web. Y al copiar una restricción, cópiale también **el valor por defecto**:
`market` es `not null default 'WEST'`, así que una fila de fixture que no
diga nada ES occidental — comparar `null` contra `'WEST'` dejaba sin set a
casi todas las cartas de las pruebas viejas.

Y su pariente de la 521: **un doble que QUITA lo que la base RECHAZA da
por buena una consulta que en producción falla entera.** La buena y la
explicación de un puzle no tienen permiso de lectura (permiso por
COLUMNAS), y el doble las quitaba en silencio de lo que devolvía. En
Postgres no se quitan: pedirlas —o pedir `*`, que las incluye— hace fallar
la consulta ENTERA con 42501. Un `.select('*')` en esa tabla habría salido
verde aquí y vacío en la web. Si la base dice que no, el doble dice que no.

Y el de la 555, que es la misma familia por el lado de las POLÍTICAS:
**Postgres evalúa TODAS las políticas de una tabla, así que una función
que tu rol no puede ejecutar tumba la consulta entera** aunque esa política
nunca te fuera a dejar pasar. Abrir `tournament_match_replays` a `anon`
(las repeticiones de mesa las ve todo el mundo) hizo que sin cuenta fallara
con «permission denied for function repeticiones_juez_de»: la política de
las de JUGADOR iba para todo el mundo y llama a funciones de
`authenticated`. Una política que llama a funciones de un rol va `to` ese
rol. Lo cazó la prueba contra PostgreSQL; el doble devuelve lo que puede.

**Una prueba que ORDENA lo que recibe no prueba el orden de quien se lo
da** (tanda 520). La de la galería comprobaba «la más nueva primero» con
`array_agg(id order by publicada_at desc)` sobre lo que devolvía la
función: el rigor le dio la vuelta al `order by` de la función y la prueba
siguió en verde, porque el orden lo ponía ella. El orden de quien contesta
se lee tal cual llega (`with ordinality`).

**Pasar «las pruebas que tocan» no es pasar la suite** (tanda 447). Al
correrla entera salieron ONCE rojos, y ninguno era de la tanda: la guarda
de `MERCADOS` llevaba desde la **438** leyendo `js/tcgdex.js`, de donde esa
constante se había mudado —encontraba CERO claves y comparaba contra un
objeto vacío, o sea que la guarda contra las copias que se separan se había
separado ella—; cuatro pruebas de /mi-coleccion seguían abriendo la página
sin `?ver=cartas` desde que la **440** puso el Panel de pestaña por
defecto, y se caían con un «element is not visible» que parece un fallo de
la web (el elemento EXISTE en el DOM, escondido: **encontrar un elemento no
es verlo**); y la **445** hizo los filtros más pequeños porque se pidió, y
una prueba les seguía exigiendo 44 px **con el ratón**, cuando la regla
pide los 44 detrás de `pointer: coarse`. Nada de eso se vio porque entre la
437 y la 446 se corrieron solo las pruebas de cada tanda. Un rojo que no se
mira se acumula, y para cuando lo miras ya no sabes cuál de las ocho tandas
lo trajo.

**Una columna que la base CALCULA no se siembra: se genera** (tanda 447).
`name_search` y `name_key` de `tcg_cards` son columnas GENERADAS
(`immutable_unaccent(lower(...))`) y en Postgres **no se pueden escribir**.
El doble no las generaba, así que cada fixture se las escribía a mano — y
una copia a mano de algo que la base calcula sola dice lo que quiera quien
la escriba. Se vio porque la prueba del escáner buscaba «Charizard» contra
un fixture sin `name_search` y el `like` comparaba contra la cadena vacía:
CERO resultados con la carta delante. Al revés también pica, y peor: una
fila con `name: 'Carta 1'` y `name_search: 'charizard'` da un verde que en
producción **no puede pasar**. Ahora el doble las genera al sembrar y con
la MISMA función que usa la web (de ahí que `normalizeSearch` viva en
`js/texto.js`, que no importa nada, y no en `js/tcgdex.js`, que importa
`./supabase.js` — o sea el propio doble). Si añades una columna generada a
la base, genérala también en el doble.

**Mientras corra un rigor, commitea nombrando los ficheros uno a uno,
nunca con `git add -A`** (tanda 438). Es la tercera cara de la misma
moneda. Preparando un push, `git status` enseñaba `js/mi-coleccion.js`
modificado sin que nadie lo hubiera tocado: era una mutación del rigor,
viva en disco en ese instante. Un `-A` habría subido la tanda ROTA a una
rama que Netlify despliega en directo. `comprobar-arbol.sh` no lo habría
cantado, porque mientras el rigor corre la mutación está puesta a
propósito. Lo que lo cazó fue mirar por qué aparecía un fichero que no era
de los míos.

Y **no mates un rigor con `pkill`**: el 2026-09-16 se hizo para dejar
sitio a la suite y pilló una mutación puesta —`foro.html` se quedó sin el
enlace de salto—. El salvavidas lo arregló (`rigor_comun.rescatar()`),
pero solo porque `comprobar-arbol.sh` lo cantó. Si hay que parar uno,
espera a que acabe la mutación en curso o rescata justo después.

Y **un rigor de antes de la 299 no se «lee» ejecutándolo** (tanda 555):
los `rigor-tanda-2xx.py` viejos NO usan `rigor_comun` —mutan, prueban y
restauran ellos solos—, así que correrlos para comprobar sus anclas los
corre DE VERDAD, y cortarlos con un `timeout` dejó cinco ficheros de
torneos mutados y tres trozos de `ronda.js` (uno sin compilar).
**`comprobar-arbol.sh` dijo «sin mutaciones a medias»**: solo sabe de las
copias de `rigor_comun`. Lo cantó un `git diff --stat` con ficheros que no
eran míos — si ves uno así, es esto.

**Una captura con los datos a medias no es la pantalla: es OTRA pantalla**
(tanda 441). Todo el repaso visual de las tandas 439 y 440 se hizo sobre
capturas donde las cartas salían en blanco, porque en este contenedor la
red a TCGdex está cerrada, y se dio por hecho que era cosa del contenedor.
Lo era… y además tapaba un fallo: una carta cuya imagen no responde se
quedaba en un RECTÁNGULO INVISIBLE —ocupa, se puede pulsar, no dibuja
nada—, y eso en producción le pasaba a cientos. Se vio al interceptar las
peticiones con `page.route` y servir una carta de mentira con la
proporción real. Si vas a mirar una pantalla, llénala primero.

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

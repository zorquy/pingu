# Bitácora de cambios — PokeDoc

La entrada MÁS RECIENTE va ARRIBA. Cada sesión de Claude añade la suya
antes de cada push (ver CLAUDE.md). Formato:

```
## 2026-10-06 (tarde, 19) — PINGU-Claude (696 — /admin dice qué sets japoneses no se han podido rellenar)

**Hecho**: PINGU reporta cartas japonesas que no salen (Lanturn Prime de
Reviving Legends, exclusivas de Arceus): sets de la era LEGEND y DP que
TCGdex trae vacíos. El bloque HUECOS DESDE SCRYDEX solo listaba los
rellenados; ahora lista también los «sin expansión suya» (con sus
candidatas) y los «vacíos también en Scrydex», con el nombre del set.

**Ficheros**: `admin/js/admin.js`, `netlify/functions/scrydex-huecos.mjs`.

**Pendiente**: que PINGU pegue ese bloque para ver por qué esos sets no
se han rellenado, y dónde exactamente «no sale» la carta (buscador o
expansión).

## 2026-10-06 (tarde, 18) — PINGU-Claude (695 — el índice del foro vuelve a la lista clásica)

**Hecho**: PINGU no quiere los foros en tarjetas («mejor vertical, como
un foro clásico»): fuera la clase y la rejilla de la 680. El «Marcar
todo como leído» discreto se queda.

**Ficheros**: `js/foro.js`, `css/foro.css`, `SCHEMA.md`.

**Pendiente**: los bloques de /admin (CARTAS SUELTAS, HUECOS,
REEMPLAZOS, ESPEJO), la sonda del Poliwrath y las cuatro imágenes de la
691 con fotos de verdad.

## 2026-10-06 (tarde, 17) — PINGU-Claude (694 — el «+» de la Pokédex de una carta que no tienes, y TCG Pocket fuera)

**Hecho**: el «+» de la Pokédex no hacía nada con una carta que no
tienes (no estaba en ningún sitio donde se buscaba); y la Pokédex de un
Pokémon enseñaba cartas de TCG Pocket (la consulta va por Pokédex y
Pocket también la lleva). Las dos arregladas y cubiertas en la 692. Y el «+» ya no se calla: si no encuentra la carta o no hay sesión, lo dice en un aviso (694.1).

Y la 693.1: `tcggo-sueltas` mira primero lo señalado (`PRIORIDAD`, el Ancient Mew) y recorre el resto con un cursor por id que no se queda dando vueltas a las 200 primeras.

Y la 693.2: cuando TCGGO no tiene la carta, `tcggo-sueltas` le pide a Scrydex la ficha por nuestro id (que es el suyo) y guarda foto, rareza y precio de TCGplayer, con tope de créditos aparte.

**Ficheros**: `js/mi-coleccion.js`, `netlify/functions/tcggo-sueltas.mjs`, `SCHEMA.md`. En `pruebas`: 692, 693.

**Pendiente**: lo de la 693 (CARTAS SUELTAS en /admin) y los bloques de
/admin de antes.

## 2026-10-06 (tarde, 16) — PINGU-Claude (693 — las cartas sueltas sin foto, buscadas en TCGGO por nombre)

**Hecho**: el Ancient Mew (`miscp`, cajón de TCGdex de una carta sin
foto) y lo que esté como él: `tcggo-sueltas` (cada 12 min) busca en
TCGGO por nombre las cartas occidentales sin ninguna foto, y con UNA
suelta del nombre exacto escribe foto, id y productos, y la cambia al
set nuestro de esa expansión si es otro. Frenos de la casa; /admin lo
enseña.

**Ficheros**: `netlify/functions/tcggo-sueltas.mjs` (nueva),
`admin/js/admin.js`, `SCHEMA.md`. En `pruebas`: 693 (nueva).

**Pendiente**: ver en /admin «CARTAS SUELTAS SIN FOTO» en un rato: qué
parámetro contesta y dónde ha ido el Ancient Mew.

## 2026-10-06 (tarde, 15) — PINGU-Claude (692 — el «+» de la reverse añade una reverse; la Pokédex separa las variantes)

**Hecho**: en «separar variantes» el «+» de cada casilla lleva su
versión y el diálogo abre directo en el formulario con ella puesta (la
reverse entraba como una normal más). La Pokédex de un Pokémon tiene el
chip «Variantes juntas / separadas» (misma memoria que la expansión):
separadas, una casilla por versión con chapa, velo, «×N» y «+», y «solo
las que me faltan» mira por versión.

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/pokedex.js`,
`css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`: 692 (nueva).

**Pendiente**: lo de la 691 (que PINGU pase las cuatro imágenes) y los
bloques de /admin.

## 2026-10-06 (tarde, 14) — PINGU-Claude (632 — Mis partidas al mejor de tres, juego a juego)

**Hecho**: el resultado de una partida se apunta juego a juego, como en
trainingcourt: conmutador Bo1/Bo3, Bo1 de un toque (Ganada/Perdida/
Empate) y en Bo3 una fila por juego con V/D/E y «Empieza: Tú/Rival»; la
fila siguiente sale al marcar la anterior y la tercera solo si hace falta.
El resultado de la partida sale de los juegos («V, E» = victoria 1-0), y
sin nada marcado no se guarda (antes «Ganada» venía puesta). Las rondas de
un torneo abren en Bo3 y las sueltas en Bo1 (se recuerda por sitio). La
lista y las rondas enseñan «V D V 2-1», y Estadísticas, los juegos y
cómo te va empezando tú y el rival.

**MIGRACIÓN pendiente**: `supabase-migration-partidas-juegos.sql` (tres
columnas en `match_log`; sin ella el formulario se queda en Bo1 y no rompe
nada).

**Ficheros**: `js/partidas-juegos.js` (nuevo), `js/mis-partidas.js`,
`mis-partidas.html`, `css/partidas.css`,
`supabase-migration-partidas-juegos.sql`, `SCHEMA.md`. En `pruebas`: 632
(nueva) y su rigor (16 de 16); `test-partidas-pagina`, 251 y 627 al día
(marcan el resultado con su botón); el doble siembra las columnas a null.

**Pruebas**: el subconjunto de Mis partidas (partidas, partidas-pagina,
251, 321, 381, 494, 553, 627, 628, 632) y las de CSS (299, 305, 310–313,
315) e imports: todas en verde.
## 2026-10-06 (tarde, 14) — PINGU-Claude (691 — la imagen de la cadena: cuatro dibujos sin un euro)

**Hecho**: el carrusel de «Mi colección en una imagen» pasa a cuatro
dibujos sin precio, para la cadena de Twitter e Instagram: Mi equipo de
6 (con sprites), Qué coleccionista soy (un perfil por reglas, cuatro
rasgos, reparto), Mi viaje en el tiempo (la más antigua, la más nueva,
cartas por época) y Mi Pokédex. Se van el resumen, la joya, la vitrina
y el mes.

**Ficheros**: `js/mi-coleccion/imagen.js`, `js/mi-coleccion/imagen-datos.js`,
`js/mi-coleccion.js`, `SCHEMA.md`. En `pruebas`: 689 y 689-pantalla.

**Pendiente**: que PINGU las pase con sus fotos y sprites de verdad y
diga qué cambia; HUECOS, sonda del Poliwrath, REEMPLAZOS y ESPEJO de
/admin.

## 2026-10-06 (tarde, 13) — PINGU-Claude (690 — la «normal» fantasma de Scrydex)

**Hecho**: una japonesa que solo existe en holo salía «Sin precio» y
con la impresión «Normal»: Scrydex lista una `normal` sin precios ni
tiendas. El precio sale ahora de la impresión que lo tiene, y una
impresión sin precios ni tiendas no se afirma; los sets rellenados se
repasan (nombres v4). /admin dice cuántas de cada set tienen precio, y
la sonda de orígenes pide a Scrydex el id suyo y enseña los precios por
impresión.

**Ficheros**: `netlify/lib/scrydex.mjs`, `netlify/functions/scrydex-huecos.mjs`,
`netlify/functions/sonda-origenes.mjs`, `admin/js/admin.js`, `SCHEMA.md`.
En `pruebas`: 684.

**Pendiente**: que PINGU pegue el bloque HUECOS de /admin y la sonda del
Poliwrath; el Zapdos de Fossil se arregla solo cuando el espejo repase
ese set.

## 2026-10-06 (tarde, 12) — PINGU-Claude (689 — «Mi colección en una imagen»: cinco dibujos y un carrusel)

**Hecho**: la imagen de siempre se queda y se le suman cuatro: la joya
(una carta grande), la vitrina (las nueve que más valen), tu mes
(cartas nuevas, hitos) y tu Pokédex (sin precio: especies, tipos,
regiones, trofeos). En el diálogo se pasa de una a otra con flechas,
puntos, teclas o arrastrando; compartir y descargar cogen la que se ve.
Los números nuevos viven en `js/mi-coleccion/imagen-datos.js` (puro).

**Ficheros**: `js/mi-coleccion/imagen.js`, `js/mi-coleccion/imagen-datos.js`
(nuevo), `js/mi-coleccion.js`, `mi-coleccion.html`, `cartas.html`
(generado), `css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`: 689 y
689-pantalla (nuevas).

**Pendiente**: que PINGU abra la suya y diga qué cambia de cada dibujo
con las fotos de verdad; migración corea-china ya puesta (687); mirar
/admin por Celebrations y el espejo.

## 2026-10-06 (tarde, 11) — PINGU-Claude (631 — la migración de las energías, sin tabla temporal)

**Hecho**: el SQL Editor dio «relation "tipos_629" does not exist» con
`supabase-migration-nombres-energias.sql`: la tabla temporal de la lista
de tipos no pasa de una sentencia a la siguiente. Cada sentencia lleva
ahora su `(values …)`. Los nombres de producción ya están bien (mirado
desde el navegador): no hace falta volver a ejecutarla. Y
`supabase-migration-partidas-mazo-guardado.sql` (627) ya está puesta
(`match_log.user_deck_id` existe).

**Ficheros**: `supabase-migration-nombres-energias.sql`, `SCHEMA.md`,
`CLAUDE.md`. En `pruebas`: 631 (nueva: barre las migraciones y ejecuta la
de la 629 sentencia a sentencia) y su rigor (3 de 3).

**Pendiente**: nada mío. Lo del repaso de 648–672 (mi entrada de la 630)
sigue para quien lleve Mi colección y TCGGO.
## 2026-10-06 (tarde, 10) — PINGU-Claude (688 — el precio de una japonesa antigua es el de TCGplayer de ESA carta; las impresiones que existen)

**Hecho**: el espejo (686) ya no copia el precio de la gemela occidental
(el Charizard del Expansion Pack salía a 50.000 €): copia solo el
producto de Cardmarket para el enlace y borra lo copiado; el precio es
el de TCGplayer de la carta japonesa (Scrydex), convertido. Las chapas
de impresión de /carta y de la ficha de Mi colección enseñan solo las
que existen (sin `variants`, ninguna); el diálogo de añadir y el de
editar siguen ofreciendo las cuatro. Scrydex guarda sus `variants`.

**Ficheros**: `netlify/functions/precios-espejo.mjs`,
`netlify/lib/scrydex.mjs`, `netlify/functions/scrydex-huecos.mjs`,
`js/carta-mercado.js`, `js/mi-coleccion.js`, `SCHEMA.md`, `CLAUDE.md`.
En `pruebas`: 684, 686.

**Pendiente**: ver en /admin el reemplazo de Celebrations y los ejemplos
del espejo (687); los sets japoneses antiguos se repasan solos (nombres
v3, espejo v2) en la próxima media hora.

## 2026-10-06 (tarde, 9) — PINGU-Claude (687 — Celebrations entero de TCGGO, el coreano/chino que se tiraba, el espejo con ejemplos)

**Hecho**: Celebrations (`cel25` + `cel25c`) se reemplaza entero por la
expansión 35 de TCGGO, como el 30, con una guarda nueva del modo entero
(no se reemplaza si TCGGO no trae las cartas de un set que se va). La
marca «falta la migración corea-china» caduca al día: PINGU la ejecutó
y las dos columnas se seguían tirando. El remate de huecos apunta
cuántas cartas; el espejo apunta y enseña las gemelas que caen fuera
del set principal y los ejemplos sin par, y compara el daño «20x»/«20×»
igual.

**Ficheros**: `netlify/functions/tcggo-reemplazar-set.mjs`,
`netlify/functions/tcggo-precios.mjs`, `netlify/functions/scrydex-huecos.mjs`,
`netlify/functions/precios-espejo.mjs`, `admin/js/admin.js`, `SCHEMA.md`.
En `pruebas`: 666, 671, 686.

**Pendiente**: ver en /admin el reemplazo de Celebrations (REEMPLAZOS →
`cel25-entero`), los ejemplos del espejo y que mañana entren el coreano
y el chino.

## 2026-10-06 (tarde, 8) — PINGU-Claude (685.4 + 686.1 — el Expansion Pack y Jungle se rematan, y el espejo mira los ataques)

**Hecho**: `scrydex-huecos` remata también los sets llenos que traían un
`scrydex_por` de la época antigua de Scrydex (Expansion Pack y Jungle
estaban con cartas, escondidos y sin nombres). `precios-espejo` exige
además la misma huella de ataques (daño/energías) para dar dos cartas
por gemelas —el Charmander de Rocket Gang casaba con el de Base Set—,
mira cuatro años de sets occidentales y vuelve a casar un set cuando
`scrydex-huecos` le ha reescrito los nombres.

**Ficheros**: `netlify/functions/scrydex-huecos.mjs`,
`netlify/functions/precios-espejo.mjs`, `SCHEMA.md`. En `pruebas`: 684
y 686.

**Pendiente**: ver en /admin que base1_ja y base2_ja salen rematados y
con nombres, y que el espejo deja de cruzar sets; migración
corea-china; Celebrations.

## 2026-10-06 (tarde, 7) — PINGU-Claude (685.3 — la ficha japonesa de Scrydex viene en japonés: todo lo canónico de translation.en, y su precio de TCGplayer)

**Hecho**: con el Weedle real que pegó PINGU: categoría, fase, tipos,
ataques, debilidades y rareza salen ahora de `translation.en` (antes
se escribían en japonés sin que nada lo cantara); el nombre japonés
sigue en `name` y el inglés en `name_en`. De la misma ficha se guarda el
precio NM de TCGplayer en dólares (`tp_normal_*`). Los sets ya
rellenados se repasan solos.

**Ficheros**: `netlify/lib/scrydex.mjs`,
`netlify/functions/scrydex-huecos.mjs`, `SCHEMA.md`. En `pruebas`: 684 y
el fixture `scrydex-card-base1_ja-4.json`.

**Pendiente**: ver en /admin cómo quedan los nombres; migración
corea-china; Celebrations.
## 2026-10-06 (tarde, 6) — PINGU-Claude (685.2 — scrydex-huecos remata los sets a medias)

**Hecho**: el parche del set ya no escribe `scrydex_at` (no existe en
`tcg_sets`; paró la función con el Expansion Pack y Jungle a medias:
cartas dentro, set sin apuntar y escondido). Un set lleno de cartas de
Scrydex y sin `scrydex_por` se remata sin créditos; los «lleno» se
olvidan una vez por versión.

**Ficheros**: `netlify/functions/scrydex-huecos.mjs`,
`netlify/lib/scrydex.mjs`, `SCHEMA.md`. En `pruebas`: 684.

**Pendiente**: ver en /admin que remata los dos y sigue; migración
corea-china; Celebrations.
## 2026-10-06 (tarde, 5) — PINGU-Claude (686 — el espejo de precios para las japonesas antiguas)

**Hecho**: función programada `precios-espejo` (cada 6 min, solo nuestra
base): cada carta japonesa de Scrydex hereda el producto de Cardmarket
de su gemela occidental (nombre inglés + PS + Pokédex + ventana de tres
años + la más antigua), con el mínimo general y el enlace filtrado a
japonés. TCGGO no da el mínimo japonés en el producto occidental
(comprobado con el Charizard BS 4), así que no se inventa.

**Ficheros**: `netlify/functions/precios-espejo.mjs`, `admin/js/admin.js`,
`SCHEMA.md`. En `pruebas`: 686.

**Suite entera** (lanzada tras 676–682, acabada a las 13:20): 315
verdes, 4 rojos — 391 y 407 arreglados en la 685.1 (y verdes sueltos),
493 y 514 los de siempre (ffmpeg no está en el contenedor).

**Pendiente**: ver en /admin cuántas casan; migración corea-china;
Celebrations.
## 2026-10-06 (tarde, 4) — PINGU-Claude (685 — nombres ingleses de las cartas de Scrydex; el desplegable del catálogo escondido otra vez)

**Hecho**: las cartas que trae `scrydex-huecos` llevan `name_en` sacado
de la Pokédex Nacional y los subtipos (Entrenadores y Energías se
quedan en japonés); los sets ya rellenados se repasan solos, uno por
pasada. Y vuelve la línea de CSS que esconde el `<select>` del catálogo
en Mi colección (se fue con la 678).

**Ficheros**: `netlify/functions/scrydex-huecos.mjs`,
`css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`: 684.

**Pendiente**: decidir el PRECIO de las cartas japonesas antiguas (ver
mensaje a PINGU: espejo del producto occidental en japonés vía TCGGO, o
TCGplayer en dólares vía Scrydex); suite entera; migración corea-china;
Celebrations.
## 2026-10-06 (tarde, 3) — PINGU-Claude (684.1 — el arreglo de la primera pasada de scrydex-huecos)

**Hecho**: la fila de carta ya no lleva `scrydex_id` (no existe en
`tcg_cards`: fue el PGRST204 de la primera pasada); y un fallo de nuestra
base deja la función parada hasta la siguiente `VERSION`, para no gastar
un crédito cada cuatro minutos contra el mismo error. Scrydex contestó
bien: la consulta de cartas por expansión funciona.

**Ficheros**: `netlify/functions/scrydex-huecos.mjs`, `SCHEMA.md`. En
`pruebas`: 684.

**Pendiente**: ver en /admin cómo rellena (Expansion Pack el primero);
suite entera en marcha; migración corea-china; Celebrations.
## 2026-10-06 (tarde, 2) — PINGU-Claude (684 — los huecos desde Scrydex)

**Hecho**: función programada `scrydex-huecos` (cada 4 min): rellena
desde Scrydex los sets nuestros vacíos (los antiguos japoneses que
TCGGO no tiene, escondidos incluidos) con ficha completa y escaneo, y
los desesconde. Un set por pasada, 3 intentos, 401/403 para el día.
/admin lo enseña. **Hace falta volver a suscribirse a Scrydex y poner
`SCRYDEX_API_KEY` y `SCRYDEX_TEAM_ID` en Netlify.**

**Ficheros**: `netlify/functions/scrydex-huecos.mjs`,
`admin/js/admin.js`, `SCHEMA.md`. En `pruebas`: 684.

**Pendiente**: PINGU: suscripción de Scrydex + claves en Netlify; la
sonda (683) para confirmar `q=expansion.id:` y lo japonés antiguo; suite
entera en marcha; migración corea-china; Celebrations.
## 2026-10-06 (tarde, 1) — PINGU-Claude (683 — la sonda de orígenes)

**Hecho**: botón «Sonda de orígenes» en /admin → Cartas y función
`sonda-origenes`: de una carta (id + mercado) dice qué tienen nuestra
base, TCGdex, TCGGO (y sus expansiones más antiguas, occidentales y
japonesas) y Scrydex. Para contestar «TCGGO no tiene los primeros
sets» con datos, que desde el contenedor la red está cerrada.

**Ficheros**: `netlify/functions/sonda-origenes.mjs`, `admin/index.html`,
`admin/js/admin.js`, `SCHEMA.md`. En `pruebas`: 683.

**Pendiente**: que PINGU pulse la sonda con `base1-4` (occidental) y
con el Charizard del Expansion Pack (japonés) y decidamos de dónde
traer los sets antiguos; suite entera en marcha; migración
corea-china; Celebrations.
## 2026-10-06 (mediodía, 10) — PINGU-Claude (682 — la valoración en una fila y menos chips en /aprender)

**Hecho**: la caja de valorar una guía pasa a una fila (título,
estrellas, media); la chapa de categoría se va de las tarjetas de
/aprender (se queda en la portada). Cierra las siete propuestas de la
segunda ronda visual (676–682).

**Ficheros**: `css/components.css`, `js/aprender.js`, `SCHEMA.md`.
En `pruebas`: 312, 316 ajustadas.

**Pendiente**: suite entera tras 676–682; migración corea-china;
Celebrations.
## 2026-10-06 (mediodía, 9) — PINGU-Claude (681 — esqueletos en el meta y en los torneos)

**Hecho**: /meta y /torneos nacen con su silueta (seis filas, tres
tarjetas) como ya hacían /noticias y /aprender; el JS la sustituye en
todos los caminos, también en el error. Los estados vacíos ya eran
`.empty-state` en las cuatro.

**Ficheros**: `meta.html`, `css/meta.css`, `torneos.html`,
`SCHEMA.md`.

**Pendiente**: 682 (valoración en una fila, menos chips en Aprender);
suite entera; migración corea-china; Celebrations.
## 2026-10-06 (mediodía, 8) — PINGU-Claude (680 — el foro: los foros del índice en tarjetas y «Marcar todo» discreto)

**Hecho**: el índice del foro pasa de cajas con filas a un título por
sección y tarjetas (icono, nombre, descripción, números en una línea,
último mensaje abajo); «Marcar todo como leído» es un botón de texto.
La búsqueda y las listas de temas no cambian.

**Ficheros**: `js/foro.js`, `css/foro.css`, `SCHEMA.md`.

**Pendiente**: 681 (esqueletos y estados vacíos), 682; suite entera;
migración corea-china; Celebrations.
## 2026-10-06 (mediodía, 7) — PINGU-Claude (679 — cabeceras compactas: la bienvenida y la ficha de persona)

**Hecho**: la bienvenida de la portada pasa de tarjeta a barra (8×16,
«Hola, X» en t-lg); la cabecera de /perfil y /usuario con banner de
128/64, avatar de 80 y menos aire. Solo CSS.

**Ficheros**: `css/components.css`, `css/perfil.css`, `SCHEMA.md`.

**Pendiente**: 680 (foro en tarjetas), 681, 682; suite entera;
migración corea-china; Celebrations.
## 2026-10-06 (mediodía, 6) — PINGU-Claude (678 — un solo control de pestañas y filtros: la cápsula y el chip)

**Hecho**: `.seg`/`.seg-btn` (cápsula) y `.chip-filtro` en
`components.css`; los usan el meta (periodo y fuente), torneos
(Lista/Calendario, secciones de la ficha, grupos de la lista), Mi
colección (catálogo y chips de filtro) y /lanzamientos. Fuera las
cinco versiones por hoja. Portada: 169,2 KB.

**Ficheros**: `css/components.css`, `meta.html`, `js/meta/pintar.js`,
`css/meta.css`, `torneos.html`, `torneo.html`, `js/torneos/torneos.js`,
`js/torneos/torneo.js`, `css/torneos.css`, `mi-coleccion.html`,
`cartas.html` (generado), `js/mi-coleccion.js`,
`js/mi-coleccion/pokedex.js`, `css/mi-coleccion.css`,
`lanzamientos.html`, `js/lanzamientos.js`, `css/lanzamientos.css`,
`SCHEMA.md`. En `pruebas`: 297, 310, 399, 449, 453.

**Pendiente**: 679 (cabeceras compactas), 680–682; suite entera;
migración corea-china; Celebrations.
## 2026-10-06 (mediodía, 5) — PINGU-Claude (677 — /carta reestructurada: otras versiones arriba, precio al final, las losetas y el diálogo de añadir)

**Hecho**: /carta en el orden que pidió PINGU: ficha completa del
borde → otras versiones → menciones → precio al final. Las losetas
Añadir · Editar («Tienes N») · Avísame pegadas a la carta, y el
diálogo de añadir de la 650 en vez del panel con tres desplegables.
El precio elige idioma con chips de bandera. El CSS de losetas,
diálogo, contador, cabecera y bandeja se MUDÓ de mi-coleccion.css a
cardmarket.css (lo cargan las dos pantallas).

**Ficheros**: `carta.html`, `js/carta-mercado.js`, `css/carta.css`,
`css/cardmarket.css`, `css/mi-coleccion.css`, `SCHEMA.md`. En
`pruebas`: 665 ajustada.

**Pendiente**: 678 (un solo control de pestañas), 679–682; suite
entera (la de la 676 se paró a medias); migración corea-china;
Celebrations.
## 2026-10-06 (mediodía, 4) — PINGU-Claude (676 — una sola familia de botones, plana)

**Hecho**: fuera el relieve antiguo de los botones (`box-shadow: 0 4px
0 0`, el salto de 4 px al pulsar y los `:active` que lo apagaban) en
las cuatro hojas que lo llevaban; `.btn-secondary` con borde `--border`.
Una sola familia, plana, como los tiles de la ficha. Portada: 168,8 KB.

**Ficheros**: `css/style.css`, `css/curso.css`, `css/torneos.css`,
`css/laboratorio.css`, `SCHEMA.md`.

**Pendiente**: 677 (/carta reestructurada), 678–682; migración
corea-china; Celebrations; suite entera tras esta tanda.
## 2026-10-06 (mediodía, 4) — PINGU-Claude (630 — «¿cómo la encuentro?» con lo que hacen las cartas de la mano; tu mano contada en «tú contra ti»; repaso de 648–672)

**Hecho**: (1) los caminos para encontrar una carta cuentan con lo que
hacen las cartas: un básico con habilidad de botón (Fezandipiti ex,
Ogerpon ex…) es un paso desde la mano («Bajar Fezandipiti ex y usar Flip
the Script») y un puente para la Ultra Ball, igual que Kadabra (roba al
evolucionar); las búsquedas cogen de más para adelgazar el mazo (dejando un
hueco en la banca, y nada a la mano si viene Ariana/Surfista/Kilowattrel),
vaciar la mano prepara un robo hasta N, y el paso dice «cogiendo todas las
que deje» solo donde cambia la cifra. Lo de después de barajar va también
por estratos: Ultra Ball → Kadabra o Poffin → Lillie's salen exactos. (2)
en «tú contra ti», tu lado lleva «N en la mano» como el del rival, también
en el móvil (donde la cabecera de la mano no se ve). Sin migración.

**Ficheros**: `js/constructor/caminos.js`, `js/constructor/caminos-html.js`,
`js/constructor/partida.js` (`buscarEnMazo` pasa `destino` al `ui`),
`js/constructor/efectos.js` (`robaSegunMano` en tres cartas; `mirarYCoger`
pasa `destino`), `js/constructor/laboratorio.js` (`pilasHtml`),
`css/laboratorio.css`, `SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 630 (nueva)
y su rigor (20 de 20).

**Suite entera**: 317 verdes, 1 rojo: la 470, que busca `visual/carta-real.png` en el scratchpad y aquí no está (de entorno, no de la web).

**Repaso de 648–672 (para quien lleve Mi colección y TCGGO; sigue igual tras la 675)** — leído el
código y mirado en producción; nada de esto lo he tocado:
1. `baja-correo.mjs` no conoce `aviso_precio`: darse de baja desde un
   correo de precio APAGA TODOS los demás correos y los de precio siguen
   llegando (el tipo desconocido cae en «desactivar todo»). Falta también
   en `EMAIL_TYPES` de `js/notifications.js` (sin interruptor en el perfil).
2. `cargarValoresDeSets` pide `tcg_set_valor` con `.order('dia')` y
   `.limit(20000)`, pero PostgREST corta en 1.000: hoy son 348 filas (174
   sets × 2 días) y hacia el 10 de octubre pasa de 1.000; entonces se
   pierden los días MÁS NUEVOS (orden ascendente) y «Valor»/«Semanal» se
   quedan viejos sin error. Igual `historicoDeCartas` (150 × 9 = 1.350).
3. `carta-historial.js`: el clic de los rangos se engancha una vez por
   caja (`dataset.rangos`) con el `pintar` de la PRIMERA carta; la ficha de
   Mi colección reutiliza la caja, así que abrir A, luego B y pulsar «1M»
   pinta el histórico de A en la ficha de B.
4. `tcggo-precios`: con el japonés bloqueado por el plan (671), `quedan`
   nunca llega a 0 y la pasada siguiente sale por el `return` temprano:
   ese día no hay foto del histórico para NADIE (tampoco occidentales).
5. `tcggo-reemplazar-set` / barrido de huecos: un set sin expansión
   conocida se esconde (`oculto`) y el `continue` de los ocultos va antes
   de la revisión semanal, así que no vuelve nunca; un 429/403 de TCGGO
   cuenta como intento del set (a los cinco, parado para siempre); y
   `user_price_alerts` no se reapunta al reemplazar (avisos huérfanos).
6. Panel global: una expansión plegada suma las cartas de sus hijos pero
   divide por el total del padre («175 de 160 · completa»).
7. Menores: `faltaMigracionKoZh` no se borra nunca (hoy no está puesto);
   el aviso de precio en ko/zh cae al `cm_low` general; `.carta-historial-rango`
   mide 40 px con dedo (la regla es 44); la leyenda de TCGplayer declarada
   dos veces en `cardmarket.css` (gana la gris).

**Pendiente**: que PINGU ejecute mis dos migraciones de la 627 y la 629
(`supabase-migration-partidas-mazo-guardado.sql`,
`supabase-migration-nombres-energias.sql`): en producción `match_log` sigue
sin `user_deck_id` y la Telepática sigue «Energía Psychic Telepática».
## 2026-10-06 (mediodía, 3) — PINGU-Claude (675 — el selector de /lanzamientos con banderas y los esqueletos de carga)

**Hecho**: /lanzamientos lleva el mismo selector de dos botones con
bandera que Mi colección; y mientras cargan la estantería, la
expansión abierta y el bloque de Expansiones del Panel se pinta su
silueta (no se puede pulsar, así que no hay clic a destiempo).

**Ficheros**: `lanzamientos.html`, `js/lanzamientos.js`,
`css/lanzamientos.css`, `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`cartas.html`, `SCHEMA.md`. En `pruebas`: 311 ajustada.

**Pendiente**: migración corea-china; Celebrations; segunda ronda visual.
## 2026-10-06 (mediodía, 2) — PINGU-Claude (674 — el calco japonés: el catálogo japonés entero de TCGGO)

**Hecho**: función programada nueva (`tcggo-calco-jp`, cada dos
minutos) que recorre las expansiones japonesas de TCGGO una por pasada
y deja cada una como él la tiene (set existente, casado por nombre, o
creado; cartas por `procesar`); al acabar esconde los cascarones de
TCGdex. ~7 horas la primera vez, una vez. /admin: línea CALCO JAPONÉS.

**Ficheros**: `netlify/functions/tcggo-calco-jp.mjs`, `admin/js/admin.js`,
`SCHEMA.md`. En `pruebas`: 674.

**Pendiente**: el selector de /lanzamientos con banderas y los
esqueletos de carga (675); migración corea-china; Celebrations.
## 2026-10-06 (mediodía, 1) — PINGU-Claude (673 — más compacto: Panel, tu copia, gradeadas por casa, selector con banderas)

**Hecho** (propuesto con capturas y aprobado por PINGU): el Panel más
bajo (cabecera prieta, gráfica de 120 px); el bloque de tu copia en dos
columnas con controles pequeños y un solo Quitar; las gradeadas
plegadas y por casa; y el selector de catálogo con la bandera dibujada
en CSS (el select sigue debajo, escondido).

**Ficheros**: `css/mi-coleccion.css`, `js/mi-coleccion.js`,
`js/precio-vista.js`, `css/cardmarket.css`, `cartas.html`, `SCHEMA.md`.

**Pendiente**: segunda ronda visual (ficha entera, estantería); la
migración corea-china; Celebrations.
## 2026-10-06 (mañana, 7) — PINGU-Claude (672 — el Panel global, los cascarones japoneses escondidos, el valor de los sets japoneses)

**Hecho**: el vistazo de Expansiones del Panel cuenta tus líneas de
todos los catálogos (y pulsar una de otro catálogo entra con ese
catálogo puesto); el barrido de huecos esconde los sets vacíos que no
son ninguna expansión de TCGGO; y la pasada de precios apunta el valor
de los sets japoneses en la siguiente pasada, no mañana.

**Ficheros**: `js/mi-coleccion.js`, `netlify/functions/tcggo-reemplazar-set.mjs`,
`netlify/functions/tcggo-precios.mjs`, `admin/js/admin.js`, `SCHEMA.md`.
En `pruebas`: 672-pantalla (nueva) y 670.

**Pendiente**: Celebrations (25 aniversario) con su Classic como set
aparte, como el 30 — PINGU lo deja para después; la migración
corea-china.
## 2026-10-06 (mañana, 6) — PINGU-Claude (671 — las japonesas sin precio, el enlace japonés, coreano y chino)

**Hecho**: la pasada de precios completa el mapa japonés con nuestros
sets con `tcggo_id` (las expansiones hechas antes de la 642 no estaban
en el mapa del catálogo: por eso unas japonesas tenían precio y otras
no); el error de plan japonés queda apuntado, bloquea solo lo japonés
un día y se ve en /admin (línea PRECIOS completa); el enlace japonés
lleva `language=7`; y entran `cm_low_ko` y `cm_low_zh` (**MIGRACIÓN
pendiente**: `supabase-migration-tcggo-corea-china.sql`; sin ella la
pasada escribe lo demás y lo avisa).

**Ficheros**: `netlify/lib/tcggo.mjs`, `netlify/functions/tcggo-precios.mjs`,
`supabase-migration-tcggo-corea-china.sql`, `js/cardmarket.js`,
`css/cardmarket.css`, `js/mi-coleccion.js`, `admin/js/admin.js`,
`SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 671 (nueva) y 589.

**Suite entera (666–671)**: 307 verdes, 8 rojos — 493 y 514 (ffmpeg,
los de siempre) y seis pruebas que buscaban la ficha como era antes de
la 667/669 (407, 422, 643-pantalla, 645, 648-pantalla, 649-pantalla),
ajustadas y en verde sueltas. Un fallo REAL cazado por la 648: la
loseta Editar no salía en una carta tuya de OTRO catálogo abierta desde
el Panel (la cuenta de líneas es del catálogo de ahora); corregido en
este push (`mi-coleccion.js`, `cartas.html`).

**Pendiente**: que PINGU ejecute la migración.
## 2026-10-06 (mañana, 5) — PINGU-Claude (670 — el barrido de huecos: sets sin cartas que se rellenan solos)

**Hecho**: la pasada programada del reemplazo, con la lista hecha,
mira ocho sets por pasada, y al primero vacío con expansión de TCGGO
conocida lo rellena (uno por pasada). Los que comparten expansión con
otro set se pliegan (se les apunta el `tcggo_id`), los que no tienen
expansión se miran otra vez a la semana, los que fallan cuentan y paran.
/admin lo resume en «Estado del catálogo de TCGGO» (HUECOS).

**Ficheros**: `netlify/functions/tcggo-reemplazar-set.mjs`,
`admin/js/admin.js`, `SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 670 (nueva)
y 654.

**Pendiente**: la suite entera (corriendo).
## 2026-10-06 (mañana, 4) — PINGU-Claude (669 — el orden del 30, la ficha en móvil, una cuenta de «completa»)

**Hecho**: los «B/RGB» de la Classic van al final (como en TCGGO); en
la ficha el nombre y el set van encima de la carta en móvil y el bloque
de tu copia solo sale al pulsar Editar; y «completa» es una sola
cuenta en estantería, expansión e imagen: distintas sobre todas las del
set (nunca 101 %).

**Ficheros**: `js/mi-coleccion/orden.js`, `mi-coleccion.html`,
`cartas.html`, `js/mi-coleccion.js`, `css/mi-coleccion.css`, `SCHEMA.md`.

**Pendiente**: suite entera.
## 2026-10-06 (mañana, 3) — PINGU-Claude (668 — la tarjeta de expansión, como la de TCGGO)

**Hecho**: la tarjeta de la estantería es vertical como la de TCGGO:
cabecera con arte y logo, era · fecha, tres losetas (Valor con chispa,
Semanal, Tienes/Cartas) y la gráfica a lo ancho con área; el valor se
pide por semanas (nueve meses) más los últimos ocho días. La gráfica
solo tiene los días que la tabla lleva (desde la 646) y crece sola.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`, `SCHEMA.md`.

**Pendiente**: suite entera (667 y 668 tocan CSS y JS compartidos).
## 2026-10-06 (mañana, 2) — PINGU-Claude (667 — la ficha y la expansión, como en TCGGO)

**Hecho**: fuera la gráfica de valor de DENTRO de la expansión (irá en
la tarjeta de la estantería); los precios ya no se desbordan en las
burbujas; bajo la carta, tres losetas (Añadir, Editar si la tienes,
Avísame) y el bloque «Tu copia» mudado ahí debajo; en el histórico,
fuera el pie, «Cardmarket» en azul y TCGplayer en amarillo; el botón de
TCGplayer con el azul de su logo y el rayo; y el set (arriba y en la
tabla) y el ilustrador son enlaces (a la expansión y a Buscar).

**Ficheros**: `mi-coleccion.html`, `cartas.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `css/cardmarket.css`, `js/carta-historial.js`,
`js/precio-vista.js`, `SCHEMA.md`. En `pruebas`: 650-pantalla,
645-pantalla, 665 y 662 ajustadas.

**Pendiente**: la tarjeta de expansión al estilo TCGGO con su gráfica
(siguiente tanda); suite entera (CSS compartido tocado).
## 2026-10-06 (mañana, 1) — PINGU-Claude (666 — el 30 aniversario, ENTERO de TCGGO)

**Hecho**: PINGU pegó la página 1 de `episodes/431/cards` y pidió
«sustituye todo». Segundo reemplazo programado, `30th-entero`: nada
nuestro se conserva, todo entra como `tcggo-<id>` con número y foto de
TCGGO; las líneas de la gente se reapuntan (por `tcggo_id`, nombre,
nombre+número, o nombre al número más cercano —apuntado—) y lo que no
tiene ninguna suya con ese nombre se borra con sus líneas, que quedan
escritas en el estado. Y la cadena de escaneos pone la foto de TCGGO
delante del camino montado a mano para las cartas que creó TCGGO (era
lo de «mal las imágenes»: la Classic con números originales pintaba la
carta 4 del set principal). La pasada lo hace sola en minutos.

**Ficheros**: `netlify/functions/tcggo-reemplazar-set.mjs`,
`js/escaneo-carta.js`, `SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 666
(nueva) con `tcggo-30th-431-pagina1.json`, y 654.

**Pendiente**: mirar el resumen en /admin cuando haya corrido
(`aproximadas`, `lineasSinDestino`).
## 2026-10-06 (madrugada, 7) — PINGU-Claude (665 — avisos de precio)

**Hecho**: «Avísame» en el bloque de precio de /carta y de la ficha de
Mi colección: «si baja de X €» o «si sube de», en el idioma que mires.
Una función programada (cada hora) los dispara una vez y te lo deja en
la campanita (y de ahí al móvil por push) y en el correo. **MIGRACIÓN
pendiente**: `supabase-migration-avisos-precio.sql` (sin ella el botón
avisa de que falta y la función se salta). JS y CSS compartidos: suite
entera (ver abajo).

**Ficheros**: `supabase-migration-avisos-precio.sql` (nueva),
`netlify/functions/avisos-precio.mjs` (nueva), `js/avisos-precio.js`
(nuevo), `js/carta-mercado.js`, `js/mi-coleccion.js`,
`css/cardmarket.css`, `SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 665
(nueva) y el doble con `user_price_alerts`.

**Suite entera (665)**: 311 verdes, 2 rojos (493 y 514, ffmpeg).
## 2026-10-06 (madrugada, 6) — PINGU-Claude (664 — el repaso en móvil)

**Hecho**: capturas a 390 px de lo de esta noche. Solo fallaba el
histórico de /carta: la letra de los ejes se encogía con el SVG hasta
no leerse. Un paso más de letra por debajo de 560 px y margen izquierdo
más ancho. CSS compartido: suite entera (ver abajo).

**Ficheros**: `css/cardmarket.css`, `js/carta-historial.js` (una
constante), `SCHEMA.md`.

**Suite entera (664)**: 298 verdes y los dos rojos de ffmpeg (493, 514)
cuando un reinicio del contenedor la cortó en la 647; las doce que
faltaban (648 a 662) pasadas sueltas después, todas en verde.
## 2026-10-06 (madrugada, 5) — PINGU-Claude (662, 663 — el valor de la expansión en el tiempo; las que más se mueven)

**Hecho** (las dos primeras propuestas de la noche, ya puestas): (662)
la expansión abierta lleva debajo de sus cifras la gráfica de lo que
vale cada día, con rangos y lectura, de `tcg_set_valor`. (663) el Panel
tiene «Las que más se mueven esta semana»: las tres cartas tuyas que más
suben y las tres que más bajan en ocho días, del histórico diario, con
foto, porcentaje y precio. Sin migración. Solo /mi-coleccion:
subconjunto (ver abajo).

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/movidas.js`
(nuevo), `js/mi-coleccion/datos.js`, `js/mi-coleccion/grafica-valor.js`
(un parámetro), `css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`: 662
(nueva) y el doble con `tcg_card_history`.
## 2026-10-06 (madrugada, 4) — PINGU-Claude (660, 661 — Scrydex al final de la cadena; el histórico como el de TCGGO)

**Hecho**: (660) la cadena de escaneos va TCGdex → TCGGO → Scrydex →
Limitless → pokemontcg (de la lista de IBAI: Scrydex iba primero). (661)
el histórico de precios de /carta y de la ficha de Mi colección tiene
selector de rango (7D…MAX), una línea por idioma con su color, marcas
verticales de las expansiones grandes del tramo, chips de 7 y 30 días y
lectura al pasar el dedo. JS compartido: suite entera (ver abajo).

**Ficheros**: `js/escaneo-carta.js`, `js/carta-historial.js`,
`js/carta-mercado.js`, `js/mi-coleccion.js` (una línea),
`css/cardmarket.css`, `SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 661
(nueva); 643 y 643-pantalla al día; 368, 478 y 564 al día (prohibían
cualquier mando en la casilla; ahora admiten solo el «+» de la 657).

**Suite entera (657–661)**: 306 verdes, 5 rojos: 368, 478 y 564 (los de
arriba, verdes tras ponerlos al día) y 493 y 514 (ffmpeg, no hay en el
contenedor).

**PROPUESTAS PARA PINGU (de la noche del 5 al 6)**, por orden de lo que
creo que más luce:
1. **La gráfica del valor de una EXPANSIÓN** en su cabecera (tenemos
   `tcg_set_valor` a diario): la misma gráfica de la 653 con rangos.
2. **«Las que más se mueven» en el Panel**: con el histórico diario de
   tus cartas (`tcg_card_history`, la foto de la 643) salen las tres que
   más han subido y bajado esta semana, con foto y porcentaje.
3. **Avisos de precio**: «avísame si esta carta baja de X €» desde la
   ficha (una tabla `user_alertas` + la pasada de precios + correo).
4. **Deseos con precio objetivo** (lo mismo para la lista de deseos).
5. Coreano y chino en las japonesas: en cuanto haya el JSON.
6. Un `mensajeDeError()` común para los ~20 sitios que enseñan el error
   técnico tal cual (lista de IBAI; es suyo, pero el ayudante lo puedo
   hacer yo).
## 2026-10-06 (madrugada, 3) — PINGU-Claude (657, 658, 659 — el «+» en cada carta, la chispa de la expansión, el inglés de los sets)

**Hecho**: (657) cada carta de una expansión lleva un «+» que abre el
diálogo de añadir con esa carta, como en TCGGO; solo con sesión. (658)
la tarjeta de expansión lleva una chispa con la línea del último mes
(verde/roja) delante del valor. (659) `tcggo-catalogo` escribe el
nombre inglés de la expansión en los sets que no lo tienen —de la lista
de IBAI—. Sin migración.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`netlify/functions/tcggo-catalogo.mjs`, `SCHEMA.md`. En `pruebas`: 657
(nueva, las tres).
## 2026-10-06 (madrugada, 2) — PINGU-Claude (656 — el calendario de lanzamientos sale del catálogo)

**Hecho**: /lanzamientos lee `tcg_sets` —desplegable Pokémon / Pokémon
Japón—, el siguiente set arriba con cuenta atrás, los que vienen debajo y
TODAS las pasadas por año, cada una enlazando a su página del catálogo
(`?catalogo=` abre /cartas en el catálogo que toca). La lista a mano del
admin queda como complemento para un set anunciado que TCGGO aún no
tiene. La portada también coge el siguiente del catálogo. Y un fallo
destapado de paso: dos sets que se hacían padre el uno del otro (TCGGO y
la lista a mano en desacuerdo) desaparecían los dos; ahora manda TCGGO.
Sin migración.

**Ficheros**: `js/lanzamientos.js`, `lanzamientos.html`,
`css/lanzamientos.css`, `js/home.js`, `js/mi-coleccion.js` (una función),
`js/catalogo-series.js`, `admin/index.html`, `admin/js/admin.js`,
`SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 656 (nueva).

**Pruebas**: 656 en verde; pasadas las de CSS (299, 305, 310–313), las
del catálogo de series y el subconjunto de Mi colección (ver abajo).
## 2026-10-06 (madrugada) — PINGU-Claude (655 — el catálogo apunta lo que no se deja escribir)

**Hecho**: PINGU ve sets japoneses creados por TCGGO con «0 de 102» y
sin cartas dentro (Expansion Pack, Jungle, Fossils, Rocket Gang). Las
cartas se pidieron y no se escribieron, y nada lo decía. Ahora
`tcggo-catalogo` apunta en su estado las expansiones que no se dejan
escribir (`fallidos`, con el error y los intentos; a la tercera las
salta y sigue), las que escriben cero filas (`vacios`) y el último
error; y /admin → Cartas tiene «Estado del catálogo de TCGGO» (solo
lectura) para leerlo. **El porqué de verdad se lee ahí** tras la
próxima pasada: pulsa el botón y pega lo que diga «ÚLTIMO ERROR».

**Ficheros**: `netlify/functions/tcggo-catalogo.mjs`, `admin/index.html`,
`admin/js/admin.js`, `SCHEMA.md`. En `pruebas`: 655 (nueva).

**Pendiente**: con el error delante, arreglar la escritura de esos sets.
## 2026-10-05 (noche, 8) — PINGU-Claude (654 — el 30 aniversario se reemplaza solo por el de TCGGO)

**Hecho**: función PROGRAMADA `tcggo-reemplazar-set` (a y 4 de cada
cinco minutos): borra nuestras cartas de `30th` y `30th-c` y mete las
de la expansión de TCGGO tal cual (foto, número, id de Cardmarket), una
sola vez y apuntado en `scrydex_estado` (`tcggo_reemplazos`); lo que la
gente tenga apuntado se reapunta por nombre, y lo que no case se queda
y se dice en el estado. Cinco fallos y para. La expansión suya sale de
los pares del emparejador. Sin SQL y sin botón: PINGU, «hazlo tú
automáticamente; no hagas mezclas, coge toda la información del set de
ahí y listo». La migración de la 652 bis queda sin ejecutar. Corre en
cuanto Netlify despliegue este push.

**Ficheros**: `netlify/functions/tcggo-reemplazar-set.mjs` (nueva),
`netlify/lib/tcggo.mjs` (exporta `nombreComparable` y `soloDigitos`),
`SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 654 (nueva).

**Pendiente**: mirar el 30 en /mi-coleccion pasados diez minutos del
despliegue; el resumen de lo hecho está en `scrydex_estado` →
`tcggo_reemplazos`. Para reemplazar otra expansión entera, una entrada
más en `REEMPLAZOS`.
## 2026-10-05 (noche, 7) — PINGU-Claude (653 — el Panel, más prieto y con la gráfica más visual)

**Hecho**: la gráfica del valor de Mi colección se pinta del color de la
tendencia (verde sube, rojo baja), con rejilla de tres cifras a la
derecha, fechas debajo, la marca del último día, lectura al pasar el
dedo (globo con el día y el valor) y chips de 7 y 30 días que solo
salen si el histórico cubre esos días. Fuera el párrafo de debajo del
punto único. Y el Panel más prieto: cabecera, vistazos, losetas y
cifras un paso más juntos. Solo /mi-coleccion; sin migración.

**Ficheros**: `js/mi-coleccion/grafica-valor.js`, `js/mi-coleccion.js`
(una línea), `css/mi-coleccion.css`, `SCHEMA.md`, `CLAUDE.md`. En
`pruebas`: 653 (nueva); 377, 464 y 651-pantalla al día.

**Para IBAI, de PINGU, sobre tu lista de pendientes**: a lo último —si
los mazos guardados del constructor pasan a la rareza más baja como las
listas importadas— la respuesta es **SÍ**: los que ya están guardados
pasan a la rareza mínima, para mantener un estándar; y al construir un
mazo cada uno puede poner las rarezas que quiera. Lo demás de tu lista
(colecciones sin nombre en inglés, Scrydex todavía el primero en la
cadena de escaneo, los pies de foto de /meta en inglés, los ~20 errores
técnicos enseñados tal cual, las etiquetas del laboratorio que parecen
botones, el nombre del mazo que parpadea en la repetición) queda
apuntado aquí; lo de Scrydex en `cadenaDeEscaneo` es de esta sesión y
lo haré en una tanda propia —avisa en tu entrada si lo coges tú antes—.

**Pendiente**: coreano y chino en el precio de las japonesas (PINGU ha
pasado dos URLs de TCGGO, `cards/63456` y `episodes/552/cards`, pero
desde el contenedor no se llega a RapidAPI ni hay clave: hace falta el
JSON pegado). Y la migración del 30 aniversario sigue sin ejecutar.
## 2026-10-05 (noche, 6) — PINGU-Claude (652 — la Classic del 30 aniversario, dos veces)

**Hecho**: el 30 aniversario enseñaba «Charizard 001» con la foto del
Exeggcute 001. TCGGO lleva la Classic dentro del 30 con los números de la
carta original y TCGdex la numera 001–030: el catálogo no casó ninguna y
las creó por segunda vez en `30th`; las nuestras de `30th-c`, sin foto,
caían a Limitless por «30C» + número. Ahora el catálogo casa por NOMBRE
lo que el número no casa (paso 4, único en los dos lados), y la
migración deja el 30 como la expansión de TCGGO ENTERA (PINGU: «coge la
expansión entera de la API y listo»): lo apuntado en las de TCGdex pasa a
las de TCGGO y el set «30th-c» se va.

**MIGRACIÓN pendiente**: `supabase-migration-30-aniversario-duplicados.sql`
— ejecuta primero la vista previa (dos `select`), mira las parejas, y
luego el bloque `do`. Es re-ejecutable.

**Ficheros**: `netlify/lib/tcggo.mjs`, `netlify/functions/tcggo-catalogo.mjs`,
la migración, `SCHEMA.md`. En `pruebas`: 652 (nueva), 588 y 640 con el
caso.

**Pendiente**: coreano y chino en el precio de las japonesas (falta el
JSON de una carta japonesa de TCGGO).
## 2026-10-05 (noche, 5) — PINGU-Claude (651 — precio de las que no tienes, pop-up en el móvil, Panel)

**Hecho**: la ficha de una carta que no tienes pide su precio (antes
solo se cargaban los de tu colección: «Sin precio» en todo el catálogo,
japonesas incluidas); en el móvil, la cuadrícula y la lista de una
expansión abren el pop-up como el archivador (solo estaba enganchado el
archivador); el Panel con Cambios en cifras y las tres acciones (imagen,
importar, exportar) en losetas con icono; y la gráfica del valor enseña
el punto de hoy aunque no haya ninguna foto todavía. Sin migración.

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/grafica-valor.js`,
`css/mi-coleccion.css`, `cartas.html` (regenerado), `SCHEMA.md`. En
`pruebas`: 651-pantalla (nueva), 377 al día.

**Subconjunto de Mi colección**: 116 pruebas, 114 verdes; los dos rojos
eran de las pruebas y no de la web: la 408 miraba `[data-ir-a="cambios"]`
y ahora hay tres (el botón y las dos cifras), y la 578 abortaba la foto y
la cadena de respaldos salía a la red real por el proxy: iba y venía
también en HEAD (1 de 2). Las dos al día (la 578 sirve la foto).

**Pendiente**: coreano y chino en el precio de las japonesas, en cuanto
PINGU pase el JSON de una carta japonesa de TCGGO (no se inventan los
campos). Y PINGU ha pedido que para cambios de Mi colección se pase el
subconjunto de pruebas de esa pantalla (116 ficheros) y no la suite
entera.
## 2026-10-05 (noche, 4) — PINGU-Claude (650 — añadir como en TCGGO)

**Hecho**: el «+ Añadir» va pegado a la carta en la ficha (con «Tienes
N» al lado), y abre un diálogo que pregunta el idioma (chips con
bandera), estado, versión si hay más de una, copias y lo pagado. Si ya
la tienes, antes enseña «Ya en tu colección» con tus líneas y «Añadir
más». Cada guardado pasa por `datos.anadir` (línea nueva, o una copia
más de la misma): se acabó lo de que añadir una inglesa reescribiera la
española. Y la ficha enseña «También tienes» con tus otras líneas de la
carta. Fuera el bloque viejo de añadir (`mcEdAnadirBloque`,
`tocarBolsillo`). Sin migración.

**Ficheros**: `mi-coleccion.html` (y `cartas.html` regenerado),
`js/mi-coleccion.js`, `css/mi-coleccion.css`, `css/cardmarket.css`
(bandera portuguesa), `SCHEMA.md`. En `pruebas`: 650-pantalla (nueva);
al día 368, 383, 418, 422, 485, 564, 648-pantalla, 649-pantalla.

**Pendiente (651)**: el Panel más visual y la gráfica del valor con un
solo punto.
## 2026-10-05 (noche, 3) — PINGU-Claude (649 — /cartas es la estantería de Mi colección)

**Hecho**: el catálogo público /cartas pasa a ser la misma pantalla de
Mi colección en modo catálogo: `cartas.html` se GENERA desde
`mi-coleccion.html` con `generar-cartas.mjs` (si tocas la plantilla,
`node generar-cartas.mjs`; una prueba comprueba que el repo lleva lo que
sale de ahí). Estantería con TODAS las expansiones, la expansión por
dentro y la ficha emergente; sin cuenta también (la ficha dice «entra y
guárdala»), con cuenta enseña tu progreso y tu copia. Una expansión
plegada (el 30 aniversario) se abre ahora con las cartas de sus dos
mitades. Mi colección CONSERVA su pestaña de Expansiones (se pensó
quitarla y PINGU paró) y el «Ver todas» del Panel abre todas, quitando
«solo las empezadas». Fuera `js/cartas.js` y su CSS. Sin migración.

**Ficheros**: `cartas.html` (generado), `generar-cartas.mjs` (nuevo),
`mi-coleccion.html`, `js/mi-coleccion.js`, `js/mi-coleccion/datos.js`,
`css/mi-coleccion.css`, `css/carta.css`, `js/cartas.js` (borrado),
`SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 649-pantalla (nueva); al día
324, 327, 330, 335, 343, 346, 533, 646, 646-pantalla.

**Ojo**: si editas `mi-coleccion.html`, regenera `cartas.html` (la
prueba 649 lo canta si no).

**Y el rojo de la 315 que apuntasteis** (los cuatro `#fff` de las
banderitas de `css/cardmarket.css`): al token `--blanco-fijo`. Suite
entera: 299 verdes; quedan en rojo solo 493 y 514, que necesitan ffmpeg
y en este contenedor no existe.

**Pendiente (650)**: el Panel más visual y la gráfica del valor con un
solo punto.
## 2026-10-05 (noche, 2) — PINGU-Claude (648 — dos catálogos, como en la API)

**Hecho** (última tanda del rediseño): el selector de /mi-coleccion pasa a
ser el catálogo —«🇬🇧 Pokémon» y «🇯🇵 Pokémon Japón»— y el inglés deja de
ofrecerse (escondido, como el chino). Y el fallo del Panel: con el
japonés puesto, abrir una carta española salía sin foto, sin precio y sin
TCGplayer; ahora la ficha busca en la colección entera. Sin migración.

**Ficheros**: `js/mi-coleccion.js`, `js/coleccion-filtros.js`, `SCHEMA.md`,
`CLAUDE.md`. En `pruebas`: 648-pantalla (nueva), 438, 472.

**Pendiente, si PINGU lo quiere**: el mismo conmutador en /cartas (la
pública); pide decidir la dirección de una colección japonesa.
## 2026-10-05 (tarde, 3) — PINGU-Claude (626 a 629 — iconos de energía, Mis partidas, energías bien traducidas)

**Leídas vuestras 645, 646 y 647** (la ficha nueva, las expansiones de
TCGGO y la expansión por dentro). Ojo, dos rojos vuestros: la **315**
falla con `css/cardmarket.css` («ninguna hoja escribe #fff a mano»: cuatro
`background`), y la **546** con `js/coleccion-filtros.js` («ningún módulo
se monta su propio nombre»: que use `nombreDeCarta`). No los he tocado.

**Hecho**:
- **626, iconos de energía**: los ocho símbolos que dejó PINGU (Planta,
  Fuego, Agua, Rayo, Psíquica, Lucha, Oscura, Metálica) en
  `assets/iconos-energia/`, por CSS sobre el `data-tipo` que ya había: el
  laboratorio y las repeticiones (`.lab-energia`) y la ficha
  (`.carta-energia`, en `css/carta.css`: lo he puesto debajo de vuestra
  paleta, sin tocar lo de la 645). Incolora, Hada y Dragón siguen con su
  punto: no venían en la carpeta.
- **627, repeticiones en Mis partidas con su mazo guardado**:
  `match_log.user_deck_id`. «+ Desde una repetición» en Partidas sueltas,
  «Con tu mazo guardado» en el formulario y al guardar en /repeticiones.
  **MIGRACIÓN pendiente**: `supabase-migration-partidas-mazo-guardado.sql`.
  Hasta que se ejecute no se ofrece (una sonda pregunta por la columna) y
  apuntar sigue funcionando sin ella.
- **628, filtros, gráficos y estadísticas en Mis partidas**: periodo
  (hasta «entre dos fechas»), resultado, tu mazo, mazo guardado, rival y
  origen; racha, últimas 10, gráficos de evolución, por periodo, por día
  de la semana, y barras por mazo/rival/dónde. Orden en la lista y en los
  torneos.
- **629, energías especiales bien traducidas**: TCGdex escribe «Energía
  Psychic Telepática» y TCG Live «Energía Psíquica Telepática».
  `corregirNombreEs` (js/texto.js) al enseñar, al cruzar el registro con la
  lista y al leer de TCGdex; y la lista de una repetición cuenta por
  NOMBRE (3 + 1 Alakazam de dos impresiones son 4). **MIGRACIÓN pendiente**:
  `supabase-migration-nombres-energias.sql`. **Para vosotros**: la
  telepática está DOS veces en el catálogo (`me03-088` y `tcggo-31886`), y
  sus hermanas de Perfect Order también (`tcggo-31884`, `tcggo-31885`):
  vuestro emparejamiento no las casó, seguramente porque el `name` de
  TCGdex estaba en español a medias. No las he tocado.

**Ficheros**: `assets/iconos-energia/*.png` (nuevos), `css/laboratorio.css`,
`css/carta.css`, `js/partidas-mazos.js`, `js/estadisticas-partidas.js` y
`js/graficos-partidas.js` (nuevos), `js/mis-partidas.js`,
`mis-partidas.html`, `css/partidas.css`, `js/repeticiones.js`,
`js/repeticiones/datos.js`, `js/repeticiones/lista.js`, `js/texto.js`,
`js/catalogo-series.js`, `netlify/lib/carta-detalle.mjs`,
`netlify/functions/cartas-detalle.mjs`,
`js/constructor/partida.js`, `js/constructor/efectos.js`,
`js/constructor/nombres.js`, las dos migraciones, `SCHEMA.md`,
`CLAUDE.md`, `BITACORA.md`. En `pruebas`: `test-tanda-626` a `629` y sus
rigores, `sql-partidas-mazo.sql` y `sql-nombres-energias.sql` (contra
PostgreSQL), el doble (escribir una columna de `__SIN_COLUMNAS__` da
PGRST204; `user_deck_id` solo con un mazo tuyo), y la 251 mirando solo
`#partidasMatriz` (la pestaña tiene ahora más listas de barras).

**Suite completa**: verde salvo la 470 (de siempre) y vuestra 315. La 331
salió roja por mí (le había metido un import a `js/carta-detalle.js`): la
corrección del nombre se ha ido a `netlify/lib/carta-detalle.mjs` y la 331
vuelve a verde.

**Pendiente**: las dos migraciones (PINGU). Nada en curso.

## 2026-10-05 (noche) — PINGU-Claude (647 — la expansión por dentro)

**Hecho** (tercera tanda del rediseño): /coleccion con filtros de
rareza, tipo, impresión, ilustrador y precio (solo con lo que hay en esa
colección), «las que me faltan» con sesión, orden por número, precio,
rareza o nombre; cada carta con su precio y sus impresiones, y la que
tienes marcada; y en la cabecera el valor del set, el semanal y «Tienes
X / N». Sin migración.

**Y de paso**: la regla del 30 aniversario vuelve a ser por prefijo `30th`
(sin guion, como en la 347): con `30th-` la página del padre no se llevaba
las suyas. Prueba 346 al día con la decisión de la 646.

**Ficheros**: `js/coleccion-filtros.js` (nuevo), `js/coleccion.js`,
`coleccion.html`, `js/carta-nucleo.js`, `css/carta.css`, `SCHEMA.md`.
`js/catalogo-series.js`. En `pruebas`: 647 y 647-pantalla (nuevas), 346 y 533.

**Siguiente**: 648, fuera el filtro de idioma de /mi-coleccion (dos
catálogos: Pokémon y Pokémon Japón, como la API).

## 2026-10-05 (tarde, 3) — PINGU-Claude (646 — las expansiones son los episodios de TCGGO)

**Hecho** (segunda tanda del rediseño): los sets con el mismo `tcggo_id`
se pliegan en uno (el 30 aniversario es UNO, como en la API; una Trainer
Gallery va dentro de su set); la lista a mano queda de respaldo. /cartas
pasa de filas a tarjetas con logo, era, fecha, cartas, valor del set y
semanal; la estantería lleva valor y semanal, y lo tuyo del hijo cuenta en
el padre; la página de un hijo lleva al padre con las cartas de todos. El
valor lo escribe la pasada de precios cada día en `tcg_set_valor` (también
los japoneses).

**MIGRACIÓN pendiente**: `supabase-migration-tcggo-expansiones.sql` (tras
la del catálogo). Sin ella la web funciona igual, solo sin valor ni
semanal.

**Pulido tras verlo en pantalla**: el punto de los miles siempre («4.210 €»,
que en es-ES los de cuatro cifras salían sin él) y el rótulo «Valor» en
vez de «Valor del set», que se partía en dos renglones.

**646b, tras la captura de PINGU** («las expansiones se ven igual»): el
valor no salía porque la pasada de precios apunta los sets UNA vez al día
y hoy ya había pasado, y además la lista guardada era de antes y no traía
valor; ahora vuelve a pedir la lista y a escribir los sets en la pasada
siguiente cuando lo guardado no lleva valor (`setsConValor`). Y el 30
aniversario seguía en dos porque la Classic no llevaba `tcggo_id`: vuelve
la regla a mano `{ padre: '30th', prefijo: '30th-' }` como respaldo (la 536
la había quitado; manda lo último). Pruebas 533, 536 y 589 al día.

**Ficheros**: `supabase-migration-tcggo-expansiones.sql` (nueva),
`netlify/lib/tcggo.mjs`, `netlify/functions/tcggo-precios.mjs`,
`js/catalogo-series.js`, `js/cartas.js`, `js/coleccion.js`,
`js/mi-coleccion.js`, `css/carta.css`, `css/mi-coleccion.css`,
`SCHEMA.md`, `CLAUDE.md`. En `pruebas`: 646 y 646-pantalla (nuevas), 640,
y el doble (`tcg_set_valor`).

**Siguiente**: 647, la expansión por dentro (filtros de rareza, tipo,
impresión, ilustrador y precio, «las que me faltan»); luego quitar el
filtro de idioma.
## 2026-10-05 (tarde) — PINGU-Claude (625 — el repaso de los efectos del formato)

**Leídas vuestras 644b y 645** (el `$` suelto de la migración y la ficha
nueva): no se pisa con nada de esto, que es todo del motor del laboratorio
(`js/constructor/`).
Corrección a mi 624: allí digo que toqué `test-tanda-527.mjs`; al
rebasar se quedó **vuestra** versión (la de la 644), no la mía.

**Hecho**: PINGU: «léete todos los efectos de ataque, habilidades y el
funcionamiento de TODOS los ataques del formato actual» y dos casos —Meowth
ex que no repite la habilidad, Hydrapple ex que pide el daño a mano—. **Los
dos casos no se reproducen** con el motor de hoy (en Node y en /laboratorio,
muñeco y mesa, con el texto de producción en español); quedan en la prueba
y le he pedido a PINGU el enlace de la partida. Inventario de las 3.234
cartas H/I/J de cards-database: los ataques que no se leían enteros bajan de
545 a 364 y **ninguno de los que quedan es de una carta del meta**. Unas 45
frases nuevas de daño y de lo que pasa después (por herramientas, por
premios, por retirada, «si no está Quemado, nada», Aliento Hydra, daño a
cada uno/a uno de la banca, Arrastrar y pegar al nuevo, Puño Meteoro,
Ataque Arena, «si vas primero, puedes usarlo»…), habilidades (Robustez,
Poltchageist en la banca, Yveltal, inmunidades, Drilbur, Abra, Moltres,
Kyurem leído del texto: en español no se activaba nunca) y los dos que
usan el ataque de otro (Zoroark ex de N, Slowking). Detalle en `SCHEMA.md`.

**Ficheros**: `js/constructor/textos.js`, `js/constructor/textos-es.js`,
`js/constructor/partida.js`, `js/constructor/efectos.js`, `SCHEMA.md`,
`BITACORA.md`. En `pruebas`: `test-tanda-625.mjs` y `rigor-tanda-625.py`
(nuevos, 47 mutaciones cazadas), `test-tanda-593.mjs` (los rasgos con
`contiene` no son nombres propios).

**Suite completa**: verde salvo la 470 (la captura de siempre). La 492
(vuestra versión de la 644) salía roja aquí dos de dos: medía la tira de
momentos en el móvil justo en el instante de un repintado («44,0,0,0…»
con la página bien). Ahora mide hasta que dos medidas seguidas coinciden.

**Pendiente**: nada en curso. Lo siguiente mío: iconos de energía, enlazar
repeticiones con mazos guardados y filtros/estadísticas en /mis-partidas.

## 2026-10-05 (tarde, 2) — PINGU-Claude (645 — la ficha nueva)

**Hecho** (primera tanda del rediseño acordado sobre maquetas): el bloque
de precio rehecho —burbujas, impresiones, tabla por idioma con enlace a
Cardmarket en cada fila, TCGplayer en su azul, gradeadas—, el resumen de
«Tu copia» con los campos plegados tras «Editar», y el histórico dentro
de la ficha de /mi-coleccion. TCGGO no da impresiones ni su precio
(comprobado con PINGU en su playground): las impresiones salen de
`variants`.

**Ficheros**: `js/precio-vista.js`, `css/cardmarket.css`, `css/carta.css`,
`js/carta-mercado.js`, `js/carta.js`, `mi-coleccion.html`,
`js/mi-coleccion.js`, `css/mi-coleccion.css`, `SCHEMA.md`, `CLAUDE.md`.
En `pruebas`: 645 y 645-pantalla (nuevas); 589, 589-pantalla,
586-pantalla, 368, 311, 376, 383, 392, 405, 422, 472, 563, 564, 574.

**Siguiente**: 646, las expansiones como los episodios de TCGGO (uno por
episodio, con su era y sus cifras); luego la expansión por dentro y
quitar el filtro de idioma.

## 2026-10-05 (tarde) — PINGU-Claude (644b — la migración del catálogo, arreglada)

**Hecho**: `supabase-migration-tcggo-catalogo.sql` fallaba en la línea 106
(«syntax error at or near $»): el bloque nuevo de `tcggo_guardar_sets` se
escribió por `String.replace` y el `$$` se quedó en `$`. Arreglada; la
guarda va en `test-tanda-640.mjs` para las cuatro migraciones de TCGGO.
PINGU: vuelve a ejecutarla entera, y luego la japonesa y la del histórico.

**Ficheros**: `supabase-migration-tcggo-catalogo.sql`. En `pruebas`: 640.

## 2026-10-05 (mediodía) — PINGU-Claude (624 — una norma para todas las cartas: la rareza más baja)

**Leídas vuestras 640 a 644** (TCGGO de catálogo, Scrydex fuera, precio
japonés, histórico, lo que faltaba del catálogo). Nada de lo vuestro se
pisa con esto; mi número es 624 (sigo en la 62x). La escala de rareza
nueva compara sin distinguir mayúsculas, así que el «rare» en minúscula de
TCGGO (644) ya cuenta. Ojo con la fecha: hoy es **5 de octubre** (las entradas de
«2026-10-06» de abajo van un día adelantadas, la mía de la 620 también).

**⚠️ La 640 tiró producción hasta que se ejecutó su migración**: diez
consultas del cliente pedían `image_tcggo` y la columna NO existía todavía
en la base (comprobado en pokedoc.es: el buscador del constructor falla con
«column tcg_cards.image_tcggo does not exist»; también faltan `tcggo_id`,
`origen` y `tcggo_at`). Se lo dije a PINGU, la ejecutó y a las 13:30 el
buscador del constructor ya contestaba (comprobado en pokedoc.es). La norma
que sale de aquí, y va en CLAUDE.md: **un
`select` del cliente que pide una columna nueva no se empuja antes que la
migración que la crea** — la función de servidor «se salta diciéndolo», pero
la web no: falla entera.

**Hecho**: PINGU: «en las repeticiones no salen las cartas con su mínima
rareza… deberíamos seguir un estándar para todas las cartas». Regla 0 en
`canonizarEntradas`: cada carta, a su reimpresión de rareza más baja DE
CUALQUIER COLECCIÓN (por la clave y por el nombre español). La siguen el
constructor, las repeticiones (también el camino por id de la 481), el
laboratorio, las listas de torneos y el meta. No cambia a igual rareza, ni
de legal a no legal, ni a una sin marca o sin imagen, ni a una promo, ni a
una de rareza desconocida (Pocket queda fuera), ni a otro Pokémon con el
mismo nombre. Probado contra producción: en la repetición de Zoroark solo
cambia el Interruptor de Energía (ME05 Ultra Rara → ME01 Común).
**Una escala de rareza para toda la web** (`js/rareza-escala.js`): la de
/mi-coleccion no entendía el español y ordenaba «Común» o «Rara Doble» al
final; ahora es la misma para ordenar el álbum y para elegir impresión.

**Y un fallo de la 447**: `js/tcgdex.js` reexportaba `normalizeSearch` sin
importarla y la llamaba en `searchCards` → ReferenceError en cada búsqueda,
tragado por el `try` de quien llama: el buscador de cartas del editor, el
selector de mazo de torneos y el respaldo por nombre de las listas llevaban
semanas sin devolver nada. Arreglado, y `test-imports.mjs` lo vigila ya
(«un reexport no es un import»).

**Ficheros**: `js/rareza-escala.js` (nuevo), `js/impresion-canonica.js`,
`js/impresiones-del-set.js`, `js/lista-canonica.js`, `js/meta-mazo.js`,
`js/repeticiones.js`, `js/mi-coleccion/orden.js`, `js/tcgdex.js`,
`SCHEMA.md`, `CLAUDE.md`, `BITACORA.md`. En `pruebas`:
`test-tanda-624.mjs` y `rigor-tanda-624.py` (nuevos), `test-imports.mjs`
(la guarda de reexports), `test-tanda-527.mjs` (el informe que ya no está),
rigores 427 y 523 apuntando a la escala nueva.

**Suite completa**: verde salvo la 470 (la captura que falta, de siempre).
Por el camino: la 527 exigía el informe de rarezas de /admin que se fue con
Scrydex en vuestra 641 — ahora lo exige solo si el informe existe; y la
546 (columnas con `name_es` piden `name_en`) cazó mis consultas nuevas.

**Pendiente**: nada en curso.
## 2026-10-06 (noche, 6) — PINGU-Claude (644 — el catálogo desde TCGGO: lo que faltaba)

**Hecho**: un set nuevo de TCGGO entra con su serie (la era de /cartas,
en nuestros términos) y su total impreso; a los que ya tenemos se les
rellena lo impreso; solo entra lo que es «singles» (sobres y cajas,
fuera); la rareza se guarda con una grafía («rare» → «Rare») y
rareza/PS/ilustrador de TCGGO ganan a lo viejo. Import muerto de
`admin.js` fuera (la 527 estaba roja desde la 641).

**MIGRACIONES pendientes, en este orden**: `supabase-migration-tcggo-catalogo.sql`
(cambiada en esta tanda: ejecútala entera aunque la tuvieras a medias),
`supabase-migration-tcggo-japones.sql`, `supabase-migration-tcggo-historial.sql`.

**Ficheros**: `netlify/lib/tcggo.mjs`, `netlify/functions/tcggo-catalogo.mjs`,
`js/rarezas-nombres.js`, `admin/js/admin.js`,
`supabase-migration-tcggo-catalogo.sql`, `SCHEMA.md`, `CLAUDE.md`. En
`pruebas`: 640 y 527.

## 2026-10-06 (noche, 5) — PINGU-Claude (643 — el histórico de precios)

**Hecho**: gráfica de precio en /carta. Tabla `tcg_card_history` que
llena `tcggo-historial` (a demanda, la primera vez que se abre la ficha,
y no más de una vez a la semana por carta; tope diario propio) y la foto
diaria que `tcggo-precios` toma al cerrar el día de las cartas que
alguien tiene. SVG a mano (`js/carta-historial.js`): línea del idioma
elegido y, a trazos, TCGplayer.

**MIGRACIONES pendientes de ejecutar, en este orden**:
`supabase-migration-tcggo-catalogo.sql`,
`supabase-migration-tcggo-japones.sql`,
`supabase-migration-tcggo-historial.sql`.

**Ficheros**: `supabase-migration-tcggo-historial.sql`,
`netlify/functions/tcggo-historial.mjs`, `js/carta-historial.js`
(nuevos); `netlify/lib/tcggo.mjs`, `netlify/functions/tcggo-precios.mjs`,
`js/carta-mercado.js`, `css/carta.css`, `SCHEMA.md`, `CLAUDE.md`. En
`pruebas`: 643 y 643-pantalla (nuevas).

## 2026-10-06 (noche, 4) — PINGU-Claude (642 — el precio de las japonesas)

**Hecho**: `cm_low_ja` desde `lowest_near_mint_JP`; «ja» en la regla del
valor (JS y SQL); `tcggo-precios` recorre también las expansiones
japonesas que el catálogo casó; el botón de Cardmarket va al producto
aunque el idioma no tenga filtro.

**MIGRACIÓN pendiente de ejecutar** (después de la de la 589):
`supabase-migration-tcggo-japones.sql`.

**Ficheros**: `supabase-migration-tcggo-japones.sql` (nueva),
`netlify/lib/tcggo.mjs`, `netlify/functions/tcggo-catalogo.mjs`,
`netlify/functions/tcggo-precios.mjs`, `js/cardmarket.js`, `SCHEMA.md`.
En `pruebas`: 589, 640 y el doble.

## 2026-10-06 (noche, 3) — PINGU-Claude (641 — Scrydex, fuera)

**Hecho**: fuera las diez funciones `scrydex-*`, sus tres botones de
/admin y 18 pruebas; las columnas y los datos se quedan, y
`netlify/lib/scrydex.mjs` también (fotos y `numeroComparable`).
`esDeScrydex` → `esDeTcggo`. PINGU puede cancelar la suscripción.

**Ficheros**: borrados `netlify/functions/scrydex-*.mjs` (10);
`admin/index.html`, `admin/js/admin.js`, `js/mercados.js`,
`netlify/functions/catalogo-asia.mjs`, `netlify/functions/escaneos-asia.mjs`,
`SCHEMA.md`, `CLAUDE.md`. En `pruebas`: borradas 18 `test-tanda-5xx` y
dos rigores; `test-tanda-483.mjs` al nombre nuevo.

## 2026-10-06 (noche, 2) — PINGU-Claude (640 — el catálogo desde TCGGO, solo)

**Numeración**: 590–596 y 620–623 son de la otra sesión; las nuestras
siguen desde la 640.

**Hecho**: sin botones. `tcggo-emparejar-auto` (cada hora, sets nuevos),
`tcggo-precios` (ya) y la nueva `tcggo-catalogo` (cada 5 min hasta cubrir
la semana): recorre TODAS las expansiones de TCGGO, occidentales y
japonesas, conserva nuestros ids y les añade tcggo_id, foto, ids de
producto, rareza, PS, ilustrador; crea lo que no tenemos (variantes,
promos de tienda, staff, sets enteros) con id `tcggo-<id>` / `tg-<id>`.
Foto de TCGGO en la cadena de escaneos y en todos los selects.

**MIGRACIÓN pendiente de ejecutar**: `supabase-migration-tcggo-catalogo.sql`.
Sin ella la función se salta diciéndolo. Nada más que hacer: arranca sola.

**Ficheros**: `supabase-migration-tcggo-catalogo.sql`,
`netlify/functions/tcggo-catalogo.mjs`, `netlify/functions/tcggo-emparejar-auto.mjs`
(nuevos); `netlify/lib/tcggo.mjs`, `js/escaneo-carta.js`, `js/mas-caro.js`
y los diez módulos con `image_scrydex` en un select (`image_tcggo` al
lado); `SCHEMA.md`, `CLAUDE.md`. En `pruebas`: `test-tanda-640.mjs`
(nuevo) y el doble.

## 2026-10-06 (noche) — PINGU-Claude (589 — precios por idioma desde TCGGO)

**Hecho**: TCGGO pasa a ser la fuente de precios y enlaces: mínimo Near
Mint de Cardmarket por idioma (es/en/de/fr/it), TCGplayer en euros,
gradeadas de Cardmarket y eBay, los dos ids de producto y los logos de
los sets. Función programada `tcggo-precios` (cada 10 min, ~300
peticiones/día) + botón «Precios de TCGGO ahora» en /admin. El VALOR de
una copia es ahora el mínimo de SU idioma (antes la tendencia), en JS y en
SQL. Bloque de precio nuevo (`js/precio-vista.js`) en la ficha de
/mi-coleccion y en /carta: cifra + de qué es, chapas por idioma, botones
Cardmarket y TCGplayer, gradeadas con el color de la casa; fuera el texto
largo. TCGdex se queda para el español; Scrydex sale en otra tanda.

**MIGRACIÓN pendiente de ejecutar**: `supabase-migration-tcggo-precios.sql`
(columnas nuevas, `tp_id_product_propio`, `logo_tcggo`, las funciones).
Sin ella la función de precios se salta diciéndolo. Después: /admin →
Cartas → «Precios de TCGGO ahora» unas 8 veces (o esperar ~1 h 20), y
relanzar «solo estos sets» con la lista de la 588 para el id de TCGplayer.

**Ficheros**: `supabase-migration-tcggo-precios.sql`, `js/precio-vista.js`,
`netlify/functions/tcggo-precios.mjs` (nuevos); `netlify/lib/tcggo.mjs`,
`netlify/functions/tcggo-emparejar.mjs`, `js/cardmarket.js`,
`js/carta-mercado.js`, `js/carta.js`, `js/carta-nucleo.js`, `js/cartas.js`,
`js/coleccion.js`, `js/mi-coleccion.js`, `js/mi-coleccion/datos.js`,
`mi-coleccion.html`, `css/cardmarket.css`, `css/carta.css`,
`css/mi-coleccion.css`, `admin/index.html`, `admin/js/admin.js`,
`SCHEMA.md`, `CLAUDE.md`. En `pruebas`: `test-tanda-589.mjs` y
`test-tanda-589-pantalla.mjs` (nuevos); al día 586, 586-pantalla, 369,
375, 563, 311 y el doble (`stub-supabase.js`).
## 2026-10-06 (mañana) — PINGU-Claude (620 a 623 — la mesa gira hacia quien decide, /laboratorio, y «encontrar una carta» con cifras exactas)

**Leídas vuestras 580 a 588** (también los arreglos de TCGGO de esta
mañana): cartas, precios y /admin; nada de lo mío. Mis números son 620-623
(de la 589 a la 619 os las dejo). Coincidimos en
TODAS las páginas: «Laboratorio» va en el menú (arriba y en el del móvil)
y en el pie, que ahora es el mismo en las 37 (a la portada y a /colabora
les faltaba «Constructor de mazos»). /colabora tenía aún la barra vieja sin
grupos: lleva la de todas.

**De dónde sale**: PINGU, esta mañana: «cuando te noquean un Pokémon, que
se gire el tablero para ver tu mano y elegir quién sube», «con Dudunsparce,
ver primero lo robado: no tapar la mano con el mini modal», «un apartado
del laboratorio en el menú» y, con un enlace (/lab/rf8eeeuz), «¿se tiene
en cuenta que Dudunsparce vuelve al mazo y Drakloak manda una abajo?».

· **620** — «tú contra ti»: el motor dice `elige` (QUIÉN decide; `partida`
  dice de quién son las cartas) y la mesa gira hacia él mientras decide:
  su mano y su banca abajo, «decide X». Lo que se pide va en la franja del
  centro, no flotando encima de la mano; la mano no se apaga eligiendo un
  Pokémon; lo robado a mitad de jugada sale «nueva»; «te has quedado sin
  activo» si no ha caído nadie.
· **621** — `/laboratorio`: tus mazos, el que está a medias en el
  constructor, una lista pegada o uno del meta; el laboratorio se abre
  encima y al cerrarlo sigues ahí. `?mazo=<id>` (y «Probar» en Mis mazos).
  Las posiciones compartidas (`/lab/<id>` y el enlace largo) abren ya aquí;
  el constructor sigue abriendo las que ya se mandaron.
· **623** — «encontrar una carta»: el motor SÍ contaba lo de Dudunsparce y
  Drakloak; lo que fallaba eran las cifras (±3 puntos con 400 repartos al
  azar: «11 %» donde son 7,5). Dónde cae la carta va por estratos y sale
  exacta; «en cualquier orden» cuando el orden no cambia nada (comparado
  reparto a reparto); y un camino con partidario ya no esconde uno sin él.

**Sin migración.**

**Ficheros**: `js/constructor/{laboratorio,partida,efectos,caminos,
caminos-html}.js`, `css/laboratorio.css`, **nuevos** `laboratorio.html`,
`js/laboratorio-pagina.js`, `css/laboratorio-pagina.css`; `js/mazos.js`,
`js/repeticiones.js` (una posición por /rep/ va a /laboratorio),
`netlify.toml` (/lab/:id → /laboratorio?pos=), `netlify/functions/
sitemap.mjs`, las 37 páginas (menú y pie), `SCHEMA.md`, `CLAUDE.md` (dos
lecciones). En `pruebas`: `test-tanda-620/621/623.mjs` con sus rigores (todo
detectado), `servir.py` (/lab/ → /laboratorio), y al día 456, 497, 554,
591, 594 y sus rigores (anclas que movía esto).

**Suite entera pasada**: todo verde salvo la 470 (pide una captura del
scratch de una sesión vieja, de siempre). Al día la 312 y la 326 (37
páginas con pie, con /laboratorio), y la 492 esperaba a medir la tira de
momentos en el móvil: con las dos mitades de la suite a la vez a veces la
medía antes de pintarla (todo a 0).

**Pendiente**: nada de esto.

## 2026-10-06 (tarde) — PINGU-Claude (588 — el par con Cardmarket por TCGGO)

**Hecho**: la primera pasada real de la 587 casó un 15 % en los sets
modernos (los ataques nuestros están en español, los empates de expansión
no se decidían, nombres en otra forma; detalle en SCHEMA 587). PINGU trajo
la documentación de TCGGO (RapidAPI «Cardmarket API TCG»): cada carta trae
`cardmarket_id` y `tcgplayer_id`, y la expansión su código de TCG Live.
Nueva función `tcggo-emparejar` (admin): set → expansión por código (o
nombre), carta → carta por NÚMERO, escribe `cm_id_product_propio` con la
RPC de la 587 y reabre la guía diaria. Plan Basic: 100 peticiones/día y
cobra el exceso → tope diario 95 en el estado, 2,1 s entre peticiones,
para en 429/403, reanudable set a set. El emparejador por orden/nombres
de la 587 se ha QUITADO (función, lib, prueba y fixture de productos).

**Primera pasada real hecha** (plan Ultra, variables puestas): 177 sets,
14.968 pares. Salió mal ex7 (código «RR» = Rising Rivals en TCGGO): ahora
el nombre decide antes que el código y una guarda por el `tcgid` de sus
cartas para el set ajeno; y las familias con 0 pares (1.ª edición, Trainer
Gallery, Shiny Vault, promos) se resuelven por tcgid exacto y por dígitos.

Segunda vuelta: las Trainer Gallery / Shiny Vault de TCGGO existen
VACÍAS (las cartas están en la madre) → alternativas cuando la elegida
viene vacía; alias para 30th-c; motivos con las candidatas por dígitos;
«solo estos sets» sigue entre llamadas (`quedanIds`).

**Pendiente de PINGU**: /admin → Cartas → «solo estos sets»:
`ex7, base1, base2, base3, base5, gym1, gym2, neo1, neo2, neo3, neo4, swsh10tg, swsh9tg, swsh4.5sv, sma, svp, sve, mep, swshp, xyp, bwp, cel25, cel25cc, 30th-c, 2018sm, sm1`
y pegar el cuadro. Los precios buenos entran con la pasada de la guía
(≤1 h). Los precios buenos entran con la pasada
de la guía (≤1 h).

**Ficheros**: `netlify/lib/tcggo.mjs` y
`netlify/functions/tcggo-emparejar.mjs` (nuevos),
`netlify/lib/cardmarket-catalogo.mjs` (podado), `admin/index.html`,
`admin/js/admin.js`, `SCHEMA.md`; borrado
`netlify/functions/cardmarket-emparejar.mjs`. En `pruebas`:
`test-tanda-588.mjs` y `fixtures/tcggo-*.json` (nuevos),
`test-tanda-587.mjs` (solo la guía); borrados
`test-tanda-587-catalogo.mjs` y `fixtures/cardmarket-products-prc-pal.json`.

## 2026-10-06 (mediodía) — PINGU-Claude (587 — nuestro emparejamiento con Cardmarket)

**Hecho**: TCGdex empareja mal con Cardmarket a lo grande (su issue
#2325). Cardmarket publica dos ficheros abiertos al día (catálogo de
productos y guía de precios); el cruce lo hacemos nosotros: por expansión
(huella de nombres) y por carta (alineación de nombres en orden, como un
`diff`, y nombre + ataques para lo suelto). Lib pura
`netlify/lib/cardmarket-catalogo.mjs` probada con trozos REALES de los
dos ficheros (Primal Clash y Paldea Evolved: el Groudon 150 va al 273681).
Funciones: `cardmarket-emparejar` (admin, ensayo en seco por tandas,
escribe solo tras confirmar) y `cardmarket-precios` (cada hora; una guía
al día para todas las cartas con par). `precios-coleccion` ya no pisa
Cardmarket donde hay par propio. Botón en /admin → Cartas.

**MIGRACIÓN pendiente de ejecutar**: `supabase-migration-cardmarket-propio.sql`.
Después: /admin → Cartas → «Emparejar con Cardmarket (ensayo)», leer el
informe, confirmar. La guía entra en la siguiente pasada (≤1 h).

**Ficheros**: `netlify/lib/cardmarket-catalogo.mjs` (nuevo),
`netlify/functions/cardmarket-emparejar.mjs` y `cardmarket-precios.mjs`
(nuevos), `netlify/functions/precios-coleccion.mjs`, `admin/index.html`,
`admin/js/admin.js`, `SCHEMA.md`. En `pruebas`: `test-tanda-587.mjs`,
`test-tanda-587-catalogo.mjs` y `fixtures/cardmarket-*.json` (nuevos).

## 2026-10-06 (mañana) — PINGU-Claude (586 — los dos mercados, y el Groudon que valía 2 €)

**Hecho**: PINGU vio que el Groudon-EX (PRC 150) traía el precio y el
enlace del Groudon común (PRC 84): TCGdex lo empareja mal con Cardmarket.
Scrydex, descartado con su respuesta real (sin precios). pokemontcg.io,
muerta (502): fuera el respaldo de la 585 (`netlify/lib/pokemontcg.mjs`).
Ahora TCGdex guarda **Cardmarket y TCGplayer** (columnas `tp_*`), la ficha
y /carta enseñan los dos, y cuando se llevan más de diez veces el de
Cardmarket se marca DUDOSO: el valor sale de TCGplayer convertido y el
botón busca por nombre. Lo mismo en SQL para la foto diaria.

**MIGRACIÓN pendiente de ejecutar**: `supabase-migration-precios-tcgplayer.sql`
(re-ejecutable; incluye las dos columnas de la 585 por si no se ejecutó).
Sin ella la función reintenta sin las columnas nuevas y todo sigue como
antes (solo Cardmarket).

**Ficheros**: `js/cardmarket.js`, `js/mi-coleccion.js`, `js/carta-mercado.js`,
`js/mi-coleccion/datos.js`, `netlify/functions/precios-coleccion.mjs`,
`SCHEMA.md`; borrado `netlify/lib/pokemontcg.mjs`. En `pruebas`:
`test-tanda-586.mjs` y `test-tanda-586-pantalla.mjs` (nuevos); borrados los
dos de la 585.

## 2026-10-06 (mañana) — PINGU-Claude (586, primer paso: ver los precios de Scrydex en crudo)

**Hecho**: PINGU quiere los precios de Scrydex (su plan Starter incluye
«Raw Prices»; lleva 2.116 de 5.000 créditos este mes). Antes de cablear
nada, un botón en /admin → Cartas, «Qué contesta Scrydex de esta carta»
(por `scrydex-sonda`, 1 crédito por clic), para tener delante su bloque
`prices` real (la norma de la 501). Nada más cambia todavía.

**Ficheros**: `admin/index.html`, `admin/js/admin.js`.

## 2026-10-06 (noche, 05:50) — PINGU-Claude (suite entera: 290 verdes, 6 rojos, arreglados)

**Suite entera pasada** con todo lo de la noche (las 580–585 y vuestras
590–596): **290 verdes, 6 rojos**, y de los seis: 374 (el estado vacío
nuevo de la 581), 386 (la marca `// sin rango:` que se me cayó al rehacer
onboarding.js), 546 (`name_es || name` en los dos módulos de importar →
`nombreDeCarta`), 591 (vuestro test leía `servir.py` por una ruta de
vuestra máquina: ahora relativa al propio test) — los cuatro al día. Los
otros dos, **493 y 514, piden `ffprobe` y este contenedor ya no lo tiene**
(se reinició de madrugada): no son de la web.

**Ficheros**: `js/onboarding.js`, `js/mi-coleccion/importar-csv.js`,
`js/mi-coleccion/importar.js`. En `pruebas`: 374, 591, y los 16 viejos de
la entrada anterior (ya empujados).

## 2026-10-06 (noche, 03:40) — PINGU-Claude (580–585, SEGUNDA MITAD: todo cableado)

**Hecho**:
· **585** (lo que PINGU pidió esta noche con el Groudon EX): `precios-coleccion`
  pide a pokemontcg.io lo que TCGdex no trae (por código de TCG Live +
  número) y guarda cifras + `cm_url`; el botón de Cardmarket va a la carta
  EXACTA; /carta lee también el precio guardado.
· **580**: tarjeta «Importar y exportar» en el Panel, bandeja de importar
  (pegar o subir; Collectr, TCG Vault, el nuestro; Dex reconstruido sin un
  export real delante) y «Descargar mi colección (CSV)».
· **581**: bienvenida en tres pasos (nombre → qué te trae → primer paso
  concreto) que acaba donde eliges; `css/onboarding.css` nuevo; estado
  vacío del Panel con dibujo y una acción.
· **582**: «+X € (+Y %) este mes» bajo el valor de la cabecera y en la
  imagen de la colección (la gráfica ya existía desde la 377).
· **583**: «¿Más caro o más barato?» enlazado en /retos y en el sitemap;
  «Compartir como imagen» en los tres retos.
· 584 no hace falta: la densidad móvil de Cartas ya la hicieron la 445/461
  (capturado y comprobado).

**MIGRACIONES pendientes de ejecutar** (las dos re-ejecutables, y sin
ellas no se rompe nada): `supabase-migration-precios-url.sql` y
`supabase-migration-mas-caro.sql`. Opcional en Netlify: `POKEMONTCG_API_KEY`.

**Ficheros**: `js/cardmarket.js`, `js/carta-mercado.js`, `js/mi-coleccion.js`,
`js/mi-coleccion/imagen.js`, `mi-coleccion.html`, `css/mi-coleccion.css`,
`netlify/functions/precios-coleccion.mjs`, `onboarding.html`,
`js/onboarding.js`, `css/onboarding.css` (nuevo), `js/curso.js`,
`js/carta-del-dia-juego.js`, `js/retos.js`, `retos.html`, `js/mas-caro*.js`,
`netlify/functions/sitemap.mjs`, `SCHEMA.md`. En `pruebas`: 580 (+csv),
581, 582, 583 (+mas-caro), 585 (+pokemontcg) nuevos; 312, 326 y 569 al día
(36 páginas con pie, tres retos); el doble rellena `user_id` al insertar
como hace la base.

**Pendiente (sigo esta noche)**: poner al día los tests que las tandas
550/565/577 dejaron viejos (385, 392, 398, 422, 426, 461, 469, 471, 484,
488, 500, 503–506, 545, 470) y pasar la suite entera.

## 2026-10-06 (noche, 01:30) — PINGU-Claude (580–585, PRIMERA MITAD: ficheros nuevos, SIN cablear)

**Hecho**: solo ficheros NUEVOS que nada importa todavía (la suite entera
corre en mi contenedor y no toco lo existente hasta que acabe):
`js/mi-coleccion/importar-csv.js` + `importar.js` (580, importar/exportar
CSV), `netlify/lib/pokemontcg.mjs` + `supabase-migration-precios-url.sql`
(585, precio y enlace exacto a Cardmarket; lo pidió PINGU esta noche),
`js/mas-caro.js` + `js/mas-caro-juego.js` + `mas-caro.html` +
`css/mas-caro.css` + `netlify/functions/mas-caro.mjs` +
`supabase-migration-mas-caro.sql` (583, tercer reto; la página no está
enlazada aún), `js/reto-imagen.js` (583, imagen del resultado).

**Migraciones NUEVAS, pendientes de ejecutar**: `supabase-migration-precios-url.sql`
y `supabase-migration-mas-caro.sql`. Las funciones aguantan sin ellas.

**En curso (segunda mitad, esta misma noche)**: cablear 580, 581
(bienvenida), 582, 583 y 585 en `mi-coleccion.js/html/css`,
`cardmarket.js`, `carta-mercado.js`, `precios-coleccion.mjs`,
`onboarding.*`, `retos.html`. En `pruebas`: tests 580, 583, 585 (nuevos) y
el doble siembra `tcg_card_prices`.

## 2026-10-06 (madrugada) — PINGU-Claude (590 a 596 — la impresión del meta, enlaces cortos, el registro de «tú contra ti», efectos en español, elegir sin ventanas, caminos combinados y un repaso de fallos)

**Leídas vuestras 566 a 579 antes de subir** (y la 578 del álbum, que
entró mientras pasaba la suite): no tocan nada de lo mío (repeticiones,
laboratorio, constructor). Coincidimos en `netlify.toml` (vuestra `/reto`,
mis `/rep/` y `/lab/`: reglas distintas, se juntan solas). Mis números van
de la 590 a la 596: la 575 y la 576 no las uso por si son vuestras, y de la
580 a la 589 os las dejo libres por si seguís.

**De dónde sale**: PINGU, de una vez: la impresión de Shaymin en la
repetición de Zoroark, los enlaces muchísimo más cortos, copiar el log de
«tú contra ti», menos modales en «tú contra ti» (resaltando en la mesa; las
búsquedas, en ventana), la manera más óptima de encontrar una carta con
todo combinado, los efectos de ataque que se cumplan solos (Budew), y un
repaso de errores.

· **590** — la impresión que se juega: la que más mazos llevan en el meta
  (`meta_cartas_dia`), y después la huella de la 481.
· **591** — enlaces cortos: `/rep/<id>` y `/lab/<id>`, con la carga
  guardada en `enlaces_cortos`. **MIGRACIÓN** (abajo).
· **592** — «tú contra ti» escribe la partida como TCG Live
  (`js/constructor/diario.js`): «Copiar el registro» y «Verla como
  repetición». Comprobado jugada a jugada en 40 partidas.
· **593** — los efectos de ataque se leían SOLO en inglés y las cartas de
  verdad están en español (desde la 330): el Budew real no vetaba nada.
  `textos-es.js` traduce la plantilla y lo vigilan 1.300 pares de TCGdex.
  Más seis efectos que contaban cero y veinte efectos nuevos.
· **594** — elegir en la mesa: cartas de la mano, energías, Pokémon,
  premios y sí/no sin ventana; buscar sigue en ventana.
· **595** — caminos: los pasos que PREPARAN (barajar antes de mirar con
  Drakloak) y las evoluciones con habilidad como puente; «Lo mejor» arriba.
· **596** — el repaso: diez fallos (ver SCHEMA), entre ellos el puzle que
  enseñaba la solución en la dirección y la ventana que pisaba a otra.

**LO QUE HAY QUE EJECUTAR** en el SQL Editor:
`supabase-migration-enlaces-cortos.sql` (se puede repetir). Sin ella no se
rompe nada: los enlaces salen largos, como hasta ahora.

**Ficheros**: `js/repeticiones.js`, `js/repeticiones/{datos,estado,
impresion,registro}.js`, `css/repeticiones.css`; **nuevos**
`js/enlace-corto.js`, `js/constructor/diario.js`,
`js/constructor/textos-es.js` y `supabase-migration-enlaces-cortos.sql`;
`js/constructor.js`, `js/constructor/{laboratorio,partida,textos,caminos,
caminos-html}.js`, `css/laboratorio.css`, `css/constructor.css`,
`auth.html`, `reset-password.html`, `netlify.toml`, `SCHEMA.md`,
`CLAUDE.md` (dos lecciones). Nada de la portada. En `pruebas`:
`test-tanda-590…596.mjs` con sus rigores (todas las mutaciones detectadas),
`sql-enlaces-cortos.sql`, `textos-tcgdex.json` (los pares de TCGdex), al
día la 456, 457, 480, 515 y 521, y el doble: `meta_cartas_dia`,
`enlaces_cortos` con sus dos funciones, y `__RPC_RETRASO__` para hacer
tardar una función.

**Suite entera pasada.** Lo mío, en verde (y al día la 497 —los premios
se cogen en la mesa— y la 554 —«Lo mejor» delante del primer camino—).
**Rojos que NO son de estas tandas**, por si os toca: /mi-coleccion y el
catálogo asiático (422, 426, 461, 469, 471, 385, 392, 398 — la 398 busca el
«+» del bolsillo que quitó la 565, la 392 casa dos `.mc-contador-btn`), el
panel limpio de la 550 que se llevó botones que miran 484, 500, 503, 504,
505 y 506, más 488 y 545, y la 470, que pide una captura del scratch de una
sesión vieja. La 326 contaba 32 páginas con pie y ya son 35 (la 312 sí se
actualizó): esa la he puesto al día en `pruebas`.

**Pendiente**: nada de esto.

## 2026-10-06 (mañana, 11:10) — PINGU-Claude (578 — arrastrar cartas en un álbum soñado)

**Hecho**: la carta se arrastra a otro hueco (ratón siempre; dedo en
«Ordenar y quitar»), intercambiando; a un hueco vacío va al final; sobre
una flecha de pliego pasa de página. La foto y el enlace ya no se
arrastran solos (lo de «te da para descargar la imagen»). Dentro de un
álbum se esconden las carpetas de encima; la descripción sin caja; ✕
redondo y línea de ayuda al ordenar.

**Sin migración.**

**Ficheros**: `js/mi-coleccion/arrastre.js` (nuevo),
`js/mi-coleccion/albumes.js`, `css/mi-coleccion.css`, `mi-coleccion.html`,
`SCHEMA.md`. En `pruebas`: `test-tanda-578.mjs` (nueva).


## 2026-10-06 (mañana, 10:20) — PINGU-Claude (579 — «Carpetas» pasa a «Álbumes»)

**Hecho**: la pestaña, el panel, la tarjeta del Panel y la miga dicen
«Álbumes» (dentro siguen las carpetas y los álbumes soñados). Los ids y
`?ver=carpetas` no cambian.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`, `SCHEMA.md`. En
`pruebas`: 447 y 477 (el nombre).

## 2026-10-06 (mañana, 09:50) — PINGU-Claude (577 — «las que faltan» y el idioma)

**Hecho**: en una expansión, desplegable «Contar solo las que tengo en…»
(cambia qué cuenta como «la tengo»: bolsillos, faltan, progreso); en la
Pokédex de un Pokémon, chip «Solo las que me faltan» y el mismo
desplegable. `tengoDe(cardId, variante, idioma)`; el álbum cuenta con
`tengoEnAlbum`.

**Sin migración.**

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/pokedex.js`,
`mi-coleccion.html`, `SCHEMA.md`. En `pruebas`: `test-tanda-577.mjs`.

## 2026-10-06 (mañana, 09:00) — PINGU-Claude (574 — tres pequeñas de la lista)

**Hecho**: la imagen de la colección a 560 px en escritorio; «Quitar de mi
colección» en la ficha (el cero del contador, con nombre); filtro por
ilustrador en Cartas.

**Sin migración.**

**Ficheros**: `css/mi-coleccion.css`, `mi-coleccion.html`,
`js/mi-coleccion.js`, `js/mi-coleccion/filtros.js`, `SCHEMA.md`. En
`pruebas`: `test-tanda-574.mjs` (nueva) y `test-tanda-449.mjs` (nueve grupos).

## 2026-10-06 (mañana, 08:20) — PINGU-Claude (573 — ¿Qué carta es?, feedback del primer día)

**Hecho**: «Adivinar» justo debajo de la carta; el diálogo centrado en
escritorio (salía arriba a la izquierda); sin TCG Pocket en el buscador,
en las expansiones y en la carta del día (regex sobre `set_id`, y el doble
aprende `imatch`); Escape cierra el buscador aunque el cursor esté en el
campo (en los dos juegos); resultados más grandes; solo catálogo
occidental.

**Regresión de la 565, arreglada**: los mandos de «Ordenar y quitar» de un
álbum soñado (`.mc-bolsillo-editar`, `.mc-bolsillo-controles`) se habían
quedado sin CSS. Restaurados.

**Ficheros**: `carta-del-dia.html`, `css/elegir-carta.css`,
`js/catalogo-buscar.js`, `js/carta-del-dia-juego.js`, `js/nueve.js`,
`netlify/functions/carta-del-dia.mjs`, `css/mi-coleccion.css`, `SCHEMA.md`.
En `pruebas`: `test-tanda-570.mjs` y `herramientas/stub-supabase.js`.

**Pendiente de la lista de PINGU**: imagen de la colección más grande en
escritorio, «Quitar de mi colección» en la ficha, filtro por ilustrador,
«las que faltan» + idioma en Expansiones y Pokédex, arrastrar cartas en
los álbumes soñados y su repaso visual, otro nombre para «Carpetas».

## 2026-10-06 (mañana, 07:10) — PINGU-Claude (572 — la carta entera, borrosa)

**De dónde sale**: PINGU enseñó Pokédle (carta entera desenfocada que se
aclara por intento). Es mejor que el recorte con zoom de la 570.

**Hecho**: `<img>` con `filter: blur()` de 28 px a 5 por intento, nítida
al acabar; sin canvas. Y «Ayer era X»: la función devuelve también la
carta de ayer. Se quedan las casillas y las pistas.

**Sin migración.**

**Ficheros**: `carta-del-dia.html`, `css/carta-del-dia.css`,
`js/carta-del-dia.js`, `js/carta-del-dia-juego.js`,
`netlify/functions/carta-del-dia.mjs`, `SCHEMA.md`. En `pruebas`:
`test-tanda-570.mjs` (adaptada).

**Pasado**: 570, 569, 299, 313 e imports.

## 2026-10-06 (mañana, 06:30) — PINGU-Claude (571 — «Mi colección en una imagen»)

**Hecho**: en el Panel de /mi-coleccion, tarjeta «Mi colección en una
imagen» → diálogo con la imagen 1080×1350 (las cuatro cifras de la
cabecera, las tres que más valen con foto, la expansión más completa con
su barra, desde cuándo, pokedoc.es/mi-coleccion) y Compartir/Descargar.
La máquina de la imagen sale de /nueve a `js/imagen-compartir.js`; el
dibujo, en `js/mi-coleccion/imagen.js`, se baja al pulsar.

**Sin migración.** Con esto están las tres que pidió PINGU (568, 570, 571)
y el índice (569).

**Ficheros**: `js/imagen-compartir.js`, `js/mi-coleccion/imagen.js`
(nuevos); `js/mi-coleccion.js`, `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/nueve.js`, `SCHEMA.md`. En `pruebas`: `test-tanda-571.mjs` (nueva).

**Pasado**: 571, 299, 305, 310, 311, 312, 313, 410, 440, 451, 485, 524,
562–566, imports y la portada.

## 2026-10-06 (mañana, 05:30) — PINGU-Claude (570 — «¿Qué carta es?»)

**Hecho**: `/carta-del-dia`, un recorte de una carta al día (la misma para
todos: la elige la función `carta-del-dia` y la guarda en
`carta_del_dia`) y seis intentos. Cada intento compara nombre, era, tipo
y rareza —las cuatro casillas que se comparten como filas 🟩🟥— y abre
una pista; el zoom baja con cada fallo. Se juega sin cuenta. La tarjeta
del índice ya lleva al juego. El buscador de /nueve sale a
`js/catalogo-buscar.js` y `css/elegir-carta.css` para compartirlo.

**MIGRACIÓN**: `supabase-migration-carta-del-dia.sql` (tabla
`carta_del_dia`). **Hasta que no se ejecute, la página dice «hoy no se ha
podido traer la carta»**: la función no puede guardar.

**Ficheros**: `carta-del-dia.html`, `css/carta-del-dia.css`,
`js/carta-del-dia.js`, `js/carta-del-dia-juego.js`, `js/catalogo-buscar.js`,
`css/elegir-carta.css`, `netlify/functions/carta-del-dia.mjs`,
`supabase-migration-carta-del-dia.sql` (nuevos); `js/nueve.js`,
`nueve.html`, `css/nueve.css`, `retos.html`, `js/retos.js`,
`netlify/functions/sitemap.mjs`, `SCHEMA.md`. En `pruebas`:
`test-tanda-570.mjs` (nueva), 569 y 312.

**Pasado**: 570, 569, 566, 299, 312, 313, 524, imports y la portada.

## 2026-10-06 (madrugada, 04:00) — PINGU-Claude (569 — «Retos diarios», el índice)

**Hecho**: `/retos`, el índice de los minijuegos con el estado de hoy de
cada uno (número del día, puntos, marca, racha, el botón que toca), y
«¿Qué carta es?» como «muy pronto». La entrada del menú y del pie pasa a
«Retos diarios» en las 34 páginas; la portada sigue con su botón directo
al reto. Sitemap con `/retos`.

**Sin migración.**

**Ficheros**: `retos.html` (nueva), `css/retos.css` (nueva), `js/retos.js`
(nuevo), las 34 páginas (el enlace), `netlify/functions/sitemap.mjs`,
`SCHEMA.md`. En `pruebas`: `test-tanda-569.mjs` (nueva) y
`test-tanda-312.mjs` (34 páginas con pie).

**Pasado**: 569, 568, 299, 312, 313, 524, imports y la portada (168,5).

## 2026-10-06 (madrugada, 03:30) — PINGU-Claude (568 — el reto diario, compartido como Wordle)

**De dónde sale**: PINGU, «haz las tres» (reto compartible, adivina la
carta, mi colección en una imagen) y un índice «Retos diarios». Esta es
la primera.

**Hecho**: el texto de «Presumir de resultado» lleva ahora el **número
del día**, la **tira** 🟩🟥 de la partida en orden y la **racha de días**,
con `pokedoc.es/reto` (reescritura nueva). La tira la graba la partida
(`curso-juego.js`) y se dibuja con CSS en el resultado; la racha sale de
`daily_challenge_results` tras guardar. Módulo puro `js/reto-compartir.js`.

**Sin migración.**

**Ficheros**: `js/curso.js`, `js/curso-juego.js`, `js/reto-diario.js`,
`js/reto-compartir.js` (nuevo), `css/curso.css`, `netlify.toml`,
`SCHEMA.md`. En `pruebas`: `test-tanda-568.mjs` (nueva; juega el reto
entero con la repesca y lee el texto que se le da a `navigator.share`).

**Pasado**: 568, 299, 305, 310, 311, 312, 313, 524 e `test-imports.mjs`.

**Siguen**: 569 (índice /retos y la entrada del menú), 570 (¿Qué carta
es?), 571 (Mi colección en una imagen).

## 2026-10-06 (madrugada, 02:40) — PINGU-Claude (567 — «Mis 9 cartas», escondida)

**De dónde sale**: PTCGenius ya tiene «My 9 Cards» en los timelines de X.
PINGU: «copiar esto sería una troleada; ocúltalo por ahora».

**Hecho**: fuera el renglón de la portada y su CSS; `nueve.html` en
`noindex, nofollow`, sin enlace desde ningún sitio. Los ficheros se
quedan: de ahí saldrá «Mi colección en una imagen».

**Ficheros**: `index.html`, `css/portada.css`, `nueve.html`, `SCHEMA.md`.
En `pruebas`: `test-tanda-566.mjs` (ahora comprueba que está escondida).

**Pasado**: 566, 299, 313 y la portada.

## 2026-10-06 (madrugada, 02:10) — PINGU-Claude (566 — «Mis 9 cartas»)

**De dónde sale**: PINGU, «un minijuego de elegir tus nueve cartas
preferidas, con un buscador en los dos catálogos y una imagen con
pokedoc.es para compartir. Quiero compartirlo ya».

**Hecho**: `/nueve` (`nueve.html`, `css/nueve.css`, `js/nueve.js`): nueve
huecos, buscador en diálogo (nombre + catálogo WEST/JP + expansión),
cambiar/mover/quitar, y la imagen 1080×1350 pintada en un canvas con
«Compartir» (menú del sistema con el fichero; en escritorio descarga + X).
Se juega **sin cuenta** (localStorage); con cuenta la imagen lleva tu
nombre. Función `netlify/functions/imagen-carta.mjs` para servir con CORS
las fotos que el navegador rechace en el canvas (solo las tres CDN de las
cartas). Banner de un renglón en la portada (168,8 KB; quedan 1,2).

**Pendiente (tanda siguiente)**: guardar en la base y página pública por
persona con la imagen como previsualización.

**Sin migración.**

**Ficheros**: `nueve.html` (nueva), `css/nueve.css` (nueva), `js/nueve.js`
(nuevo), `netlify/functions/imagen-carta.mjs` (nueva), `index.html`,
`css/portada.css`, `SCHEMA.md`. En `pruebas`: `test-tanda-566.mjs` (nueva)
y `test-tanda-312.mjs` (33 páginas con pie).

**Pasado**: 566, 299, 305, 310, 311, 312, 313, 315, 316, 441, 524 y
`test-imports.mjs`.

## 2026-10-06 (madrugada, 00:30) — PINGU-Claude (565 — la casilla es la carta)

**De dónde sale**: revisión visual de /mi-coleccion con capturas a 390 y
1280 px, y PINGU enseñando cómo lo hace Dex.

**Hecho**:
1. **La casilla del álbum sin botones**: ni N/RH ni −/+. Es la carta, su
   número, ×copias y la chapa de versión; tocarla abre la ficha. La ficha
   de una carta que no tienes va como en Dex: desplegable con las versiones
   de ESA carta (escondido si solo hay una) y «Añadir a mi colección». Se
   fue el oyente del álbum, `quitarDelBolsillo`, `alternarVariante` y ~120
   líneas de CSS del mando.
2. Ficha en escritorio: la carta **arriba y fija**, alineada con el título.
3. Barra de abajo del móvil **con palabra** bajo cada icono.
4. Chapa de versión en casilla estrecha: **solo la marca** (`@container`).
5. Tope del 55 % del alto para la carta de la ficha en pantallas bajas (en
   un móvil normal no cambia nada; está dicho en SCHEMA).

**Y la 346**: estaba ROJA desde la 536 (afirmaba el 30 aniversario
plegado); reescrita a lo que hace la web.

**Sin migración.**

**Ficheros**: `js/mi-coleccion.js`, `mi-coleccion.html`, `css/mi-coleccion.css`,
`SCHEMA.md`. En `pruebas`: 368, 383, 478, 485, 564 (al camino nuevo) y 346.

**Pasado**: 299, 305, 310, 311, 312, 313, 315, 316, 346, 368, 383, 418,
441, 473, 478, 485, 524, 562, 563, 564 y `test-imports.mjs`. Suite entera
en marcha otra vez al acabar.

## 2026-10-05 (noche, 22:40) — PINGU-Claude (564 — añadir decidía la versión por ti, y mal)

**De dónde sale**: PINGU, «abro el pop-up de una carta que no tengo y
“añadir a mi colección” me la pone en español NM, pero ¿qué versión?».

**Lo gordo, debajo**: la versión era `'normal'` a pelo en cuatro sitios, y
**una ultra rara, una full art o una secreta solo existen en holo**: el «+»
del álbum las guardaba como normales, sin error y sin chapa que lo cante.
Las casillas por versión llevan la suya en `data-var` y por eso lo hacían
bien — justo las cartas con varias versiones eran las que acertaban.

**Hecho**: `varianteDeCarta()` en `variantes.js` (la primera real; normal
solo si no se sabe) y la usan el «+», el marcado en bloque y la ficha de
una carta que no tienes. En esa ficha, **un botón por versión real** (uno
solo, sin nombrarla, cuando solo hay una) y un renglón que dice en qué
idioma y estado entra. El «−» NO lleva versión a propósito (SCHEMA). Y
grupo **«Gradeo» por casa** en los filtros, que la 563 hizo posible.

**Sin migración.** Las líneas mal guardadas de antes se corrigen desde la
ficha; no se tocan en bloque (no se distinguen de las puestas a mano).

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/variantes.js`,
`js/mi-coleccion/filtros.js`, `mi-coleccion.html`, `css/mi-coleccion.css`,
`SCHEMA.md`. En `pruebas`: `test-tanda-564.mjs` (nueva), `test-tanda-418.mjs`
(el botón nuevo) y `test-tanda-449.mjs` (ocho grupos).

**Pasado**: 564, 299, 305, 310, 311, 312, 313, 315, 383, 418, 447, 449,
472, 485, 524, 541, 547, 562, 563 y `test-imports.mjs`.

## 2026-10-05 (noche, 21:30) — PINGU-Claude (563 — versión, gradeo, cambio y de quién es el precio)

**De dónde sale**: cuatro peticiones de PINGU sobre la ficha de una carta
en /mi-coleccion.

**Hecho**:
1. «De esas, doy» → **«Para cambio»**, y con los dos botones como las
   copias. Los botones del contador leían `mcEdCantidad` escrito a pelo, así
   que con dos contadores en la ficha los de abajo movían el de arriba:
   ahora cada botón busca el campo de SU mando.
2. **El gradeo, en dos desplegables** (`js/mi-coleccion/gradeo.js`, nuevo y
   puro): la casa (PSA, Beckett, CGC, SGC, ACE) y la nota, y **la escala la
   pone cada casa** — PSA en enteros con un solo 1.5, Beckett de medio en
   medio con la Black Label, CGC hasta el 0.5 con la Perfect 10. Se sigue
   guardando UN texto en la misma columna, así que **sin migración**, y lo
   que haya escrito a mano de antes vuelve como «Otra» intacto.
3. **La versión, la de ESA carta**: `variantesDeCarta()` existía desde la
   383 y el editor no la usaba. También en el formulario de añadir.
4. **El precio dice de quién es**: Cardmarket publica una cifra por producto
   con todos los idiomas juntos, así que no hay un precio «en español» que
   coger. Se dice en un renglón y el enlace sigue llevando tu idioma
   filtrado.

**Y una que salió al probar**: las chapas de arriba de la ficha se quedaban
con lo que había AL ABRIR, desde la 393. Se repintan al guardar.

**Lo de los logos de las casas no se puede**: un `<option>` no admite
imágenes y los logos son marcas de otros. La chapa va con el color de la
casa, declarado como paleta de identidad en `test-tanda-311.mjs`.

**Sin migración.**

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/gradeo.js` (nuevo),
`mi-coleccion.html`, `css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-563.mjs` y `pruebas/test-tanda-311.mjs` (la excepción).

**Pasado**: 563, 299, 305, 310, 311, 312, 313, 315, 375, 418, 447, 472,
485, 524, 541, 547, 562 y `test-imports.mjs`. La 311 y la 524 salieron
ROJAS y las dos tenían razón: un «De esas, doy» que me había dejado en un
texto, y el rojo de PSA sin declarar.

## 2026-10-05 (noche, 20:05) — PINGU-Claude (562 — en el Panel, una carta abre la ficha)

**De dónde sale**: PINGU, «desde el panel cuando le das a una carta deberia
salir el popup y no llevarte a la ficha completa».

**Era una incoherencia en la misma pantalla**: el Álbum y la Pokédex del
Panel ya abrían el diálogo; la tira de «Tus cartas» y las listas de «lo que
te sobra» / «las que más valen» se iban a `/carta/…` y perdían el sitio.

**Hecho**: `data-carta` en los dos moldes (`vistazoDeCartas` y
`filaDeCartaHtml`) y `engancharFicha('mcPanelResumen', '.mc-vistazo-carta,
.mc-fila-carta a')`. Lo que faltaba era el ATRIBUTO, no el enganche: sin él,
enganchar el selector no habría hecho nada. El `href` se queda (regla de la
418: Ctrl/⌘/botón del medio siguen abriendo la página entera).

**Sin migración.**

**Ficheros**: `js/mi-coleccion.js`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-562.mjs`.

**Pasado**: 562, 410, 418, 440, 451, 485, 537.

## 2026-10-05 (tarde, 19:40) — PINGU-Claude (561 — el OCR se come el dakuten)

**De dónde sale**: el aviso dijo «He leído: リサードン · el nº 2 no casaba
con ninguna». サ por ザ: el OCR se comió el dakuten, las dos comillitas. Un
carácter cambiado y el `like` se va a cero.

**Hecho**: si no ha casado nada y el nombre es japonés, se prueban las
variantes del nombre con una marca puesta o quitada —y las de dos, detrás—,
**todas en UNA consulta** (`or` de `like`). En un bucle serían hasta trece
idas y vueltas en el móvil de quien acaba de hacer la foto.

**Por qué no `pg_trgm`**, que está instalado y sería lo natural: los
trigramas de «リサードン» y «リザードン» comparten uno de tres, el parecido
sale en 0,2 y habría que bajar el listón hasta donde entra ruido. Esto
modela el error que el OCR comete DE VERDAD: pierde marcas, no inventa
otros kana.

**La cadena del escáner ya tiene cinco escalones**: nombre + número → sin
número → solo la palabra más larga → variantes de marcas. Y lo que se
afloja se DICE en el aviso — que es lo que ha hecho posible arreglar los
cinco fallos de esta serie (557, 558, 558b, 559, 560 y 561) sin adivinar
ni una vez.

**Sin migración.**

**Ficheros**: `js/texto.js`, `js/mi-coleccion.js`, `SCHEMA.md`. En
`pruebas`: `pruebas/test-tanda-561.mjs`.

**Pasado**: 561, 560, 559, 558, 557, 447, 450, 451 y `test-imports.mjs`.

## 2026-10-05 (tarde, 19:25) — PINGU-Claude (560 — el marco pilló la pantalla del móvil)

**De dónde sale**: el aviso de la 558b dijo «He leído: 19:054 Card Trader
111 5G». O sea el reloj, el nombre de la app y la cobertura: el marco pilló
la PANTALLA del móvil que tenía delante, no la carta de dentro.

**No era un fallo del OCR ni de la búsqueda**: la foto no era de una carta.
Lo que estaba mal era la RESPUESTA — se cerraba el escáner, se saltaba a
Buscar y salía «no encuentro ninguna carta así», que es la misma pantalla
que cuando la carta no está en el catálogo.

**Hecho**: antes de buscar se juzga si eso puede ser el nombre de una carta
(`pareceNombreDeCarta`), con dos señales seguras: un reloj, y escanear en
japonés/chino sin leer ni un carácter de esos alfabetos. Si no cuela, el
escáner **se queda abierto** y dice qué ha leído y qué hacer.

**La lección**: el aviso de la 558b convirtió esto en cinco minutos. Sin
él, lo único visible era una pantalla vacía idéntica a los otros tres
fallos de la serie. Cuando algo falla por lo que una máquina ha leído,
enseña lo que ha leído.

**Sin migración.**

**Ficheros**: `js/mi-coleccion/escaner.js`, `js/mi-coleccion.js`,
`SCHEMA.md`. En `pruebas`: `pruebas/test-tanda-560.mjs`.

**Pasado**: 560, 559, 558, 557, 447, 450, 451 y `test-imports.mjs`.

## 2026-10-05 (tarde, 19:10) — PINGU-Claude (559 — el «ex» estilizado se pega al nombre)

**De dónde sale**: PINGU escaneó la リザードンex 134/108 SAR y quedó
«リザードンCKT». El «ex» japonés va estilizado y PEGADO al nombre sin
espacio, así que el OCR lo lee como le parece —«CKT» esta vez— y el
resultado es UNA palabra: el `like` no casa con nada.

**Hecho**: del trozo elegido se busca la RACHA japonesa más larga, así que
da igual si la basura se pega delante o detrás. Con «リザードン» la base ya
encuentra «リザードンex» —el `like` va por dentro— y lo que afina es el
número.

**Las cuatro capas, juntas**: 557 (el `NFD` descomponía el kana), 558 (la
franja lleva fase + evolución + habilidad), 558b (el número a ancho
completo) y 559 (el sufijo pegado). Cada una tapaba a la siguiente. Con el
aviso de «lo que he leído» puesto desde el principio se habrían visto las
cuatro de una vez.

**Sin migración.**

**Ficheros**: `js/mi-coleccion/escaner.js`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-559.mjs`.

**Pasado**: 559, 558, 557, 447, 450, 451 y `test-imports.mjs`.

## 2026-10-05 (mañana, 11:05) — PINGU-Claude (558b — el número venía a ancho completo)

**De dónde sale**: PINGU: «ahora funciona la búsqueda pero salen demasiados
Charizards, no sale el exacto. No coge el número, supongo». Y no lo cogía.

**La causa**: el OCR japonés devuelve las cifras y la barra como las imprime
una carta japonesa —«０６６／１０８», a ancho completo— y `\d` no casa con ０
ni `\/` con ／. Salía NULL y la búsqueda se quedaba solo con el nombre.

**Hecho**: `NFKC` antes de leer el número. Y conviene fijarse en que es lo
CONTRARIO que en la 557: allí NFKC habría roto la comparación contra la
base, porque Postgres no normaliza la anchura. Aquí no se compara nada, se
EXTRAE de un texto leído por una máquina. La misma herramienta, bien en un
sitio y mal en el otro.

**Y se dice lo que se ha leído**: sin eso, «no he podido leer el número» y
«lo he leído y no casaba» se ven igual — una lista larga de cartas
parecidas. Ahora un aviso dice el nombre leído y por qué se aflojó.

**Sin migración.**

**Ficheros**: `js/mi-coleccion/escaner.js`, `js/mi-coleccion.js`,
`SCHEMA.md`. En `pruebas`: `pruebas/test-tanda-558.mjs` (ampliada).

**Pasado**: 558, 447, 450, 451 y 557.

## 2026-10-05 (mañana, 10:30) — PINGU-Claude (558 — la franja japonesa lleva cuatro cosas más)

**De dónde sale**: PINGU escaneó una リザードンex y en el buscador quedó
«己進化 リザードン ex シダードか テ テキス…» con cero resultados. La 557 era
la mitad (el `NFD`); esto es la otra: **el OCR lee bien, pero lee además lo
que hay alrededor del nombre** — la fase mal leída (el «2» de 2進化 sale
como 己), el nombre, un trozo de «リザードから進化» y el principio del texto
de la habilidad.

**Y eso es CERO y no «un poco peor»** porque la búsqueda exige TODAS las
palabras: un `like` por cada una. Una basura y no casa nada aunque el
nombre esté perfecto. En occidental la franja solo lleva fase + nombre +
PS, y por eso colaba.

**Hecho**: si la franja lleva kanji, se quita «◯◯から進化» entero, la fase
(cualquier cosa de hasta dos caracteres pegada a 進化) y las etiquetas de
mecánica; y de lo que quede, **el PRIMER trozo, no el más largo** —el más
largo fue mi primer intento y pierde contra la frase de la habilidad—. Más
una red debajo: si con todas las palabras no sale nada, se prueba con la
más larga.

**Sin migración.**

**Ficheros**: `js/mi-coleccion/escaner.js`, `js/mi-coleccion.js`,
`SCHEMA.md`. En `pruebas`: `pruebas/test-tanda-558.mjs`.

**Pasado**: 558 (con la franja de la captura, tal cual), 447, 450, 451 y
557.

## 2026-10-05 (mañana, 09:40) — PINGU-Claude (557 — el escáner no reconocía el japonés: era `NFD`)

**De dónde sale**: PINGU, con la web ya abierta al público: «el escáner de
cartas no reconoce el japonés, pero los occidentales parece que sí».

**Y no era el escáner**: era `normalizeSearch`, o sea TODA la búsqueda
japonesa, tecleada o escaneada. `NFD` descompone el kana —ギ se parte en
キ + ゙ (U+3099)— y ese signo **no está en el rango `\u0300-\u036f` que se
tira**, así que se queda: la consulta salía con siete puntos de código
donde la base tiene cinco. `unaccent()` no toca el kana, así que
`name_search` guarda la forma compuesta y el `like` no casaba JAMÁS. Sin
error: cero resultados. Y como casi todos los nombres japoneses llevan
alguna sonora, no se encontraba prácticamente ninguno.

**Hecho**: `.normalize('NFC')` al final. NFC y no NFKC: esta función tiene
que hacer lo mismo que Postgres y nada más.

**Sin migración**: la base ya guarda la forma buena; lo que estaba mal era
lo que se le preguntaba.

**Ficheros**: `js/texto.js`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-557.mjs`.

**Pasado**: 557 entera —incluida la vuelta completa en el navegador: se
escribe «フシギダネ» y sale la carta— más 335, 447, 450, 451, 523, 546 y
556. Ojo IBAI: el doble genera `name_search` con esta misma función, así
que si tocas la búsqueda, las dos mitades van juntas.

## 2026-10-05 (madrugada, 02:30) — PINGU-Claude (556 — por qué el japonés no traía NI UNA carta)

**De dónde sale**: PINGU: «los sets japoneses los tenemos en orden y con
los logos; el único problema es que no hay ninguna carta. Eso es
importante. Y las eras están mal: la de Megaevolución se llama ME».

**EL GORDO, y es mío**: `quedanPendientes` pregunta «¿queda alguna carta
NUESTRA sin marcar?». Valía cuando el trabajo era enriquecer lo que ya
teníamos. Desde la 547 el japonés se CALCA, y después del borrón había cero
cartas japonesas: la respuesta fue «no queda ninguna por marcar» y la
pasada se volvió a dormir **sin gastar un crédito y sin traer una sola
carta, cada cinco minutos**, con el panel diciendo «hecho». En un catálogo
que se calca, «no tenemos ninguna» significa que está TODO por traer. El
freno de verdad sigue siendo el de los barridos y el repaso semanal.

**Las eras**: el rótulo sale de `serie_name` y los sets occidentales no lo
tienen —la 329 ya lo midió— así que caía al `serie_id`. Donde peor se veía
no era el filtro: en /cartas, la página PÚBLICA, se agrupa por el nombre de
la era, así que todo el catálogo occidental caía en «Sin clasificar».

**PENDIENTE DE PINGU**: `supabase-migration-eras-nombres.sql`. Solo escribe
en `tcg_eras` y acaba diciendo qué eras se han quedado sin nombre —la lista
la escribí a mano—. Cualquiera se renombra desde /admin → Colecciones.

**Ficheros**: `netlify/functions/scrydex-relleno.mjs`, `js/cartas.js`,
`supabase-migration-eras-nombres.sql` (nuevo), `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-556.mjs`, `pruebas/test-tanda-541.mjs` (su guarda
congelaba el texto exacto de una línea que la 550 cambió: ahora mira qué
usa para rotular) y el doble, que ya conoce `tcg_eras`.
## 2026-10-04 (tarde, después de la 552) — PINGU-Claude (553 a 555 — guardar eligiendo quién eres, «¿cómo encuentro esta carta?» y la repetición de cada mesa)

**Leídas vuestras 545 a 552 antes de subir**: no tocan nada de lo mío
(repeticiones, laboratorio, rondas). Lo mío va detrás, de la 553 a la 555
(se ha renumerado dos veces mientras subíais).

**De dónde sale**: PINGU, verbatim: «lo de importar varias a la vez no lo
veo, mejor haz que en las repeticiones que se guarden tú puedas elegir cuál
de los dos jugadores eres y luego se guarde el resultado y los arquetipos
en tu perfil en partidas sueltas. También me gustaría añadir en el
laboratorio y en las repeticiones el poder parar y preguntar a la app cuál
es el mejor camino de habilidades, entrenadores y objetos […] para
encontrar X carta […] con la probabilidad de cada uno. Y además que los
jueces puedan asociar repeticiones a cada mesa de cada ronda […] en el
apartado de rondas. No es obligatorio».

· **553 — fuera «Importar varias» (la 518) y al guardar eliges quién eres.**
  La ventana de guardar enseña los dos jugadores con su mazo y quién ganó;
  elegido, «Apuntarla en Mis partidas» la apunta desde tu lado (tu mazo, el
  del rival, el resultado). Si el registro no dice quién ganó, pregunta
  cómo acabó. Y el lector entiende ya «… ha ganado.» detrás de cualquier
  frase (antes solo la de los premios).
· **554 — «¿Cómo encuentro esta carta?»** en el laboratorio (pestaña
  «Encontrar» del panel) y en las repeticiones (en la jugada que miras, con
  la mano entera de quien juega). Juega cada camino de verdad con el motor
  del laboratorio en los mismos 300–400 repartos de lo que no sabes, sin
  mirar el orden de verdad del mazo, con un jugador que elige a favor de la
  carta y sus puentes (Pokégear → Dawn → la carta). Las cifras casan con las
  exactas donde se pueden hacer a mano (Ultra Ball, Determinación de
  Lillie).
· **555 — la repetición de una MESA**: un juez (o quien lleva el torneo)
  pega en «Rondas» el registro que le pasa un jugador, y la ve todo el
  mundo —también sin cuenta— bajo esa mesa, en cualquier ronda. Hasta tres
  por mesa. Si los nombres no son los de la mesa, avisa una vez.

**DOS fallos cazados por las pruebas, y los dos eran de verdad:**

1. **Sin cuenta, la consulta se caía ENTERA.** La política de la 496 iba
   para todo el mundo y llama a `repeticiones_juez_de`, que sin cuenta no se
   puede ejecutar; Postgres evalúa todas las políticas, así que al abrir la
   tabla a `anon` daba «permission denied for function» y la página se
   quedaba sin ninguna, sin un aviso. La de jugador va ahora `to
   authenticated` (en las dos migraciones: ejecutar la de la 496 otra vez
   después no lo deshace, y la prueba lo comprueba en ese orden). Lo cazó
   `sql-repeticiones-de-mesa.sql` contra PostgreSQL; el doble no podía.
2. **El aviso de «nombres que no casan» no salía la segunda vez**: al
   escribir se quita a mano (repintar se llevaría el foco), y `yaEstaPintado`
   seguía con la firma del HTML CON aviso. Se olvida la firma.

**Y un susto MÍO, que conviene contar**: para comprobar las anclas de los
rigores ejecuté cada `rigor-tanda-*.py` con un `rigor_comun` de mentira…
pero los de antes de la 299 (230, 255, 291, 293, 296, 297, 298) NO usan
`rigor_comun`: mutan y prueban ellos solos. Mi `timeout` los cortó a mitad
y dejaron CINCO ficheros mutados (`home.js`, `comun.js`, `motor.js`,
`torneo.js`, `torneos.js`) y tres trozos de `ronda.js` (uno con un error de
sintaxis). **`comprobar-arbol.sh` decía «sin mutaciones a medias»**, porque
solo sabe de las de `rigor_comun`. Lo vi en un `git diff --stat` con
ficheros que no eran míos; restaurados y revisado hunk a hunk. Nada de eso
ha llegado a subir.

**LO QUE HAY QUE EJECUTAR** en el SQL Editor:
`supabase-migration-torneos-repeticiones-de-mesa.sql` (después de
`supabase-migration-repeticiones.sql`; se puede repetir). Sin ella no se
rompe nada: los jueces no ven el botón y lo demás sigue igual.

**Ficheros**: `js/repeticiones.js`, `repeticiones.html`,
`css/repeticiones.css`, `js/repeticiones/registro.js`, fuera
`js/repeticiones/varias.js` (553); **nuevos** `js/constructor/caminos.js` y
`js/constructor/caminos-html.js`, `js/constructor/laboratorio.js`,
`css/laboratorio.css`, `js/repeticiones.js` (554);
`js/torneos/ronda.js`, `js/repeticiones/datos.js`, `css/torneos.css`,
`supabase-migration-repeticiones.sql` (la política, `to authenticated`) y
**nueva** `supabase-migration-torneos-repeticiones-de-mesa.sql` (555);
`SCHEMA.md`, `CLAUDE.md` (dos lecciones). Nada de la portada. En `pruebas`:
`test-tanda-553/554/555.mjs` y sus rigores (todas las mutaciones detectadas),
`sql-repeticiones-de-mesa.sql` (nueva, base `prueba_de_mesa`), fuera la 518
y su rigor, al día la 255 (siete consultas), la 494 y la 496 (y sus
rigores, y el de la 519), y el doble: `publica`, las dos funciones de los jueces y su visibilidad.

**Pendiente**: nada de lo mío.

**La suite entera** (sobre la 549; después, otra vez lo mío y lo que toca
—553, 554, 555, 255, 494, 496, 519— sobre la 552): un rojo era MÍO y está
arreglado — la **255** contaba seis consultas para quien solo mira, y desde
la 555 son siete a propósito (las repeticiones de mesa las ve todo el
mundo). La **480** se cayó por tiempo con tres navegadores a la vez y sola
sale verde; la **470**, la de siempre (le falta `visual/carta-real.png`).
**Y cinco que NO son míos, para la sesión de las cartas**: la **346** (el
orden de las colecciones de /cartas), la **471**, la **483** y la **488**
(`catalogo-asia`: esperan el japonés en TCGdex — «el set nuevo lleva su
mercado — CN», «de los tres catálogos asiáticos»—, y desde vuestra 547 el
japonés se calca de Scrydex) y la **545** (la vuestra: «y NO se escribe
`types`», «no se escribe nada»). Ninguna toca un fichero mío; os las dejo
apuntadas para que no se acumulen.
## 2026-10-05 (madrugada, 01:20) — PINGU-Claude (552 — volver al orden del catálogo)

**De dónde sale**: PINGU: «recolócame todas las eras por orden de Scrydex,
que he hecho un lío».

**Hecho**: una migración que quita el orden puesto a mano —`tcg_sets.orden`
a null en los dos mercados y `tcg_eras.orden` a 0— y un botón en /admin que
hace lo mismo, para que no haya que pedírmelo. Que deshacer dependa de mí
es un callejón sin salida: colocar a mano se entiende probando.

**Lo que NO se pierde**: los nombres puestos a las eras y las colecciones
movidas de era. Eso son decisiones, no el lío. Perder también los nombres
está escrito en la migración como una línea comentada.

**Y una cosa que conviene no prometer**: Scrydex **no publica un orden de
las eras**. Publica el nombre de la serie de cada expansión y su fecha, y
el orden que se veía antes de tocar nada sale de ahí —cada era vale lo que
su set más nuevo—. Volver a «el orden de Scrydex» es quitar el de a mano.

**PENDIENTE DE PINGU**: `supabase-migration-eras-recolocar.sql`. Las dos
primeras consultas solo leen y enseñan lo que hay colocado.

**Ficheros**: `supabase-migration-eras-recolocar.sql` (nuevo),
`admin/js/colecciones.js`, `admin/index.html`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-552.mjs`.

**Pasado**: 550, 551 y 552 en verde.

## 2026-10-05 (madrugada, 00:40) — PINGU-Claude (551 — colocar arrastrando, y subir el logo)

**De dónde sale**: PINGU, con el editor de la 550 delante: «no quiero meter
números, quiero simplemente arrastrar una colección arriba o abajo. Y al
editar el logo, que también pueda cargar yo una imagen».

**Hecho**: las colecciones y las eras se arrastran por su asa. Lo que se
guarda sigue siendo un número —se recalcula al soltar, de diez en diez— y
**solo se escriben las filas que de verdad se movieron**: con 231
colecciones, renumerar la lista entera en cada arrastre serían 231
peticiones por gesto. Arrastrar una colección a otra era la MUEVE de era,
que es la forma cómoda de armar la era «McDonald's» de la 550.

El asa es un `<button>`: arrastrar no se puede hacer con el teclado, así
que con ella enfocada las flechas ↑ ↓ mueven. Las reglas puras van a
`admin/js/orden-arrastrable.js` porque `colecciones.js` importa `js/app.js`
y eso en Node revienta —lo mismo que pasó en la 548—.

Y el logo se sube al cubo de las imágenes de guías, que ya es público y
tiene permiso para quien ha entrado. Lo subido **rellena la caja de la
dirección** en vez de guardarse por su cuenta: un solo sitio del que sale
el logo, y se puede cancelar sin haber cambiado nada.

**Sin migración**: la de la 550 ya trae todo lo que hace falta.

**Ficheros**: `admin/js/colecciones.js`, `admin/js/orden-arrastrable.js`
(nuevo), `admin/index.html`, `admin/css/admin.css`, `SCHEMA.md`. En
`pruebas`: `pruebas/test-tanda-551.mjs`.

**Pendiente**: la suite completa lleva tres intentos parados a media
pasada para poder tocar el repo (28, 32 y 4 verdes, 0 rojos en los tres).
La próxima vez que no entre trabajo encima, se corre entera.

## 2026-10-04 (noche, 23:15) — PINGU-Claude (550 — colecciones editables, panel limpio y tres por fila)

**Hecho**, todo lo que pidió PINGU en un mensaje:

1. **/admin → Colecciones**: las colecciones tal como se ven en la
   biblioteca, con sus eras y su orden, y cada cosa editable donde está.
   Número para colocar, renombrar la era, mover un set a otra era (o a una
   NUEVA: se escribe el identificador y ya), logo a mano, esconder y
   borrar. La regla que lo hace usable: **colocar una cosa no obliga a
   colocarlas todas** — lo puesto a mano va primero y lo demás sigue
   ordenándose como siempre.
2. **Esconder antes que borrar**: borrar un set se lleva sus cartas por
   `on delete cascade`. «Esconder» se deshace; «Borrar» cuenta las cartas y
   pide escribir el identificador.
3. **`scrydex_manda` por set**, para el 30 Classic Collection: es
   occidental, así que el catálogo sigue siendo de TCGdex y la excepción va
   en la fila del set.
4. **Panel limpio**: fuera los siete botones de sondeo de una sola vez, sus
   463 líneas y `cuentas-mercado.js`. Se quedan «¿Cómo va el relleno?» y
   «Traer los logos de Scrydex». Con ellos se retira `test-tanda-482.mjs` y
   la 486 se queda con su sexta sección, que vigila algo vivo.
5. **Tres cartas por fila en el móvil** en el álbum de una expansión.

**PENDIENTE DE PINGU**: `supabase-migration-colecciones-editables.sql`. **No
borra nada**: tres columnas con su valor por defecto y una tabla nueva
vacía. Mientras no se toque /admin, la web se comporta igual que hoy.

**Y una respuesta que no es un arreglo**: el desplegable de eras del
catálogo japonés **está bien**. Los nombres que salen —Scarlet & Violet,
Sword & Shield, PCG, ADV, Vending, VS, Web— son las eras JAPONESAS, que
Scrydex nombra en inglés; las occidentales nuestras vienen de TCGdex y
están en ESPAÑOL («Escarlata y Púrpura»). Si salieran las occidentales,
estarían en español. Y PCG, ADV, Vending, VS y Web no existen en
Occidente. Con el editor nuevo se pueden renombrar.

**Ficheros**: `supabase-migration-colecciones-editables.sql` (nuevo),
`admin/js/colecciones.js` (nuevo), `admin/index.html`, `admin/js/admin.js`,
`admin/css/admin.css`, `admin/js/cuentas-mercado.js` (borrado),
`js/mi-coleccion.js`, `js/mi-coleccion/estanteria.js`,
`netlify/functions/scrydex-relleno.mjs`, `css/mi-coleccion.css`,
`SCHEMA.md`. En `pruebas`: `pruebas/test-tanda-550.mjs`,
`pruebas/test-tanda-486.mjs` (recortada), `pruebas/test-tanda-482.mjs`
(borrada).

**Pasado**: la 550 entera en verde —incluida la medida de las tres cartas
por fila en un móvil de 390 px—, más 299, 312, 417, 467, 541, 547.
`test-imports.mjs` limpio. El barrido de la 299 cazó de paso un token de
color que me inventé (`--bg-soft`).

## 2026-10-04 (noche, 21:30) — PINGU-Claude (549 — el botón del curso llevaba a «Guía no encontrada»)

**De dónde sale**: PINGU pasó la captura. Y **la 548 no era esto**: esa guía
SÍ tiene curso (la llamada dice «se tarda 8 minutos»). Lo roto era el
ENLACE.

**La causa**: una guía se sirve en `/guia/<slug>` y el botón apuntaba a
`curso.html?slug=…` **en relativo**. El navegador lo resuelve a
`/guia/curso.html`, que casa con la reescritura `/guia/:slug` y devuelve la
página de la guía buscando una con el slug «curso.html».

Es la trampa de la 327 —la que dejó /coleccion/tr sin CSS— y `netlify.toml`
la lleva escrita desde la 269: «por eso guia.html pasó a enlazar todo con
rutas absolutas». El que no se enteró fue el JAVASCRIPT que pinta los
enlaces. **Eran once**, y dos de ellos peores que el del curso: los TRES de
editar la guía llevaban al mismo callejón, o sea que el botón de editar del
admin estaba roto en todas las guías, y el de iniciar sesión también.

**Por qué no lo veía ninguna prueba**: todas abren las guías por
`/guia.html?slug=…`, donde el relativo funciona. La dirección bonita es la
que usa la gente.

**Hecho**: los once a ruta absoluta, y una guarda que barre `js/` y las
siete páginas que se sirven desde un nivel más abajo. La prueba además
PULSA el botón desde `/guia/<slug>` y mira dónde acaba — probada al revés
(volviendo a poner el relativo) y salen seis rojos, incluido el camino
entero: `http://localhost:8892/guia/curso.html?slug=mi-guia`.

**Ficheros**: `js/guia.js`, `js/curso.js`, `js/home.js`,
`js/tarjeta-guia-ancha.js`, `js/perfil.js`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-549.mjs` y `pruebas/test-tanda-548.mjs` (su enlace
esperado ahora es el absoluto).

## 2026-10-04 (noche, 20:10) — PINGU-Claude (547 y 548)

### 547 — el catálogo japonés se CALCA de Scrydex

**De dónde sale**: PINGU: «no hay nadie con colecciones, el único que está
probándolo soy yo. Podríamos hacer un borrón y cuenta nueva. Todo el
catálogo japonés lo traemos directamente de Scrydex. Esto solo para mi
colección, que no afecte, porque TCGdex está muy bien para la parte de
jugar».

Y es lo correcto: lo de antes era el catálogo de TCGdex con Scrydex
retocándolo por encima, y eso llega a medias POR CONSTRUCCIÓN — cada set
hay que emparejarlo y cada emparejamiento es una apuesta. De 118, 36
salían mal. Las tandas 544 y 546 fueron arreglar apuestas falladas.

**Hecho**:
- `MERCADOS_DE_SCRYDEX` en `js/mercados.js`: la política, con nombre y en
  un sitio. Un mercado de esa lista se inserta desde Scrydex, los
  importadores de TCGdex no lo tocan y sus fotos salen de Scrydex.
- `detalleDeCartaSuya`: su respuesta de cartas trae la ficha COMPLETA
  —ataques con texto y daño, habilidades, debilidades, fase, retirada,
  versiones— así que para el japonés TCGdex no hace falta ni para el
  detalle. Los enums se traducen a nuestra forma canónica y **lo que no se
  reconoce se queda a null y se CUENTA en el informe**: doy por hecho que
  sus enums japoneses vienen en inglés y no lo he visto (la 484 otra vez).
- El cerrojo contra duplicar ya no es el SET sino el NÚMERO, que es lo que
  dejaba sin rellenar los 82 sets emparejados.
- `catalogo-asia` y `escaneos-asia` se saltan el japonés, que si no
  volverían a meter sus 186 sets al lado de los 231 buenos cada seis
  minutos.
- El occidental NO entra: sale por un `if (!calcamos) continue` antes de
  insertar nada.

**PENDIENTE DE PINGU**: `supabase-migration-japones-de-cero.sql`. **BORRA
DATOS.** Los dos primeros pasos solo leen y el segundo enseña exactamente
lo que se va a borrar. Vacía las cuatro tablas de la gente (colección,
buscadas, álbumes soñados e histórico de valor) y borra el catálogo
japonés entero. Y reinicia el progreso guardado de las tres pasadas de
Scrydex — sin eso el barrido se reanudaría en la página 57 de ~190 y las
56 primeras no se insertarían hasta el barrido siguiente.

### 548 — el botón «Hacer el curso» en guías sin curso

**De dónde sale**: un lector se lo encontró. `guideHasCourse` decía «tiene
curso» si `blocks` trae algo, y los bloques son de dos clases: los que se
JUEGAN y la teoría que se lee y se pasa. Una guía de solo teoría enseñaba
el botón y detrás no había ni una pregunta.

**Hecho**: «tiene curso» es «hay algo que jugar», y la misma función decide
las cinco cosas que dependen de eso —el botón de arriba, la llamada de
abajo, la chapa «Con curso» de las tarjetas, las cuentas de /aprender y el
estado vacío de la página del curso, que ya decía otra cosa—. La regla se
muda a `js/guia-contenido.js`, un módulo PURO: en `js/app.js` no la podía
importar una prueba de Node (ese fichero monta la barra al cargarse), así
que la regla que decide si sale un botón no tenía red sin navegador.

**Y dos verdades que había escritas y eran falsas**: el comentario de
`js/guia.js` decía que ese botón lo cubría `test-guia-curso.mjs`, que **no
existe** —se perdió con el contenedor el 2026-08-28—; y el fixture de
`test-ficha-guia.mjs` afirmaba desde la 308 que un curso de solo teoría
arranca. Lo que ha cambiado es la regla, no la página, así que el fixture
lleva ahora una pregunta.

**Ficheros**: `js/mercados.js`, `netlify/lib/scrydex.mjs`,
`netlify/functions/scrydex-relleno.mjs`,
`netlify/functions/catalogo-asia.mjs`,
`netlify/functions/escaneos-asia.mjs`,
`supabase-migration-japones-de-cero.sql` (nuevo), `js/guia-contenido.js`
(nuevo), `js/app.js`, `js/curso.js`, `js/curso-juego.js`, `js/guia.js`,
`js/aprender.js`, `js/categoria.js`, `js/guia-tarjeta.js`,
`js/tarjeta-guia-ancha.js`, `js/guardados.js`, `js/usuarios.js`,
`SCHEMA.md`. En `pruebas`: `pruebas/test-tanda-547.mjs`,
`pruebas/test-tanda-548.mjs` y `pruebas/test-ficha-guia.mjs`.

**Pasado**: 547 y 548 en verde, más 299, 305, 308, 316 y ficha-guia.
`test-imports.mjs` limpio. Portada en 168,5 KB de 170. La suite completa
iba por 71 verdes y 0 rojos (hasta la tanda 308) cuando la paré por PID
para poder tocar el repo; se vuelve a lanzar entera ahora.

## 2026-10-04 (tarde, 18:40) — PINGU-Claude (546 — la biblioteca seguía en kanji, y el filtro de eras no cambiaba de catálogo)

**De dónde sale**: PINGU: «¿y los nombres en inglés qué? siguen saliendo los
kanjis… y lo del filtro está fatal, debería cambiar al escoger otro idioma,
porque se mantiene con el español/inglés y al cambiar a japo el filtro está
mal». Las dos cosas, con la misma forma: algo escrito DOS VECES con una sola
copia enterada.

**1. CINCO copias del nombre que se enseña.** `nombreDeCarta` vivía en
`js/carta-nucleo.js` —el módulo de la ficha, que arrastra media web y pinta
HTML—, así que /mi-coleccion no lo podía importar sin que el barrido de la
299 se pusiera rojo. Resultado: una línea propia en `mi-coleccion.js`, otra
en `albumes.js`, otra en `pokedex.js`, otra en `tablon.js` y otra en
`lo-que-falta.js`, **y ninguna sabía de `name_en`**. De ahí que la 537 y la
542 arreglaran la ficha de una carta y la biblioteca entera siguiera en
japonés. Ahora la regla vive en `js/catalogo-series.js`, al lado de
`nombreDeSet`, con un `enEspanol` para el selector de catálogo. Y al mudarla
**caducó el motivo de una sexta copia**, la del constructor, que llevaba su
porqué escrito al lado.

**Lo vigila un BARRIDO**, no una prueba de pantalla: ningún módulo de `js/`
puede escribir `name_es || name`, y lo que no es elegir un nombre para la
pantalla va declarado uno por uno con su motivo. La primera pasada encontró
**cuatro sitios más** que no había mirado (`coleccion.js`,
`constructor/nucleo.js`, `repeticiones/lista.js` y
`constructor/posicion-compartida.js`, que es el único legítimo: serializa
los dos nombres en un enlace).

**2. El desplegable de eras se montaba UNA vez** —`if
(!sel.dataset.montado)`—, así que en japonés seguía ofreciendo «Escarlata y
Púrpura». Ahora se rehace cuando cambia la firma (mercado + eras), **antes**
de leer el valor, y lo elegido solo sobrevive si existe en el catálogo nuevo
(la 472 por el otro lado).

**3. Y buscar por ese nombre.** Los tres filtros cruzaban contra `name` y
`name_es`: se leía «Eevee» y escribir «Eevee» no daba nada.

**PENDIENTE DE PINGU**: `supabase-migration-cartas-buscar-en.sql`. El
buscador del catálogo cruza contra `name_search`, que es una columna
GENERADA a partir de `name` y `name_es` — hay que tirarla y rehacerla con
`name_en` dentro (una generada no se altera en su sitio). No borra datos:
solo redefine esa columna y sus dos índices. `name_key` no se toca.

**Ficheros**: `js/catalogo-series.js`, `js/carta-nucleo.js`, `js/carta.js`,
`js/carta-mercado.js`, `js/cartas.js`, `js/coleccion.js`,
`js/mi-coleccion.js`, `js/mi-coleccion/albumes.js`,
`js/mi-coleccion/pokedex.js`, `js/mi-coleccion/tablon.js`,
`js/mi-coleccion/lo-que-falta.js`, `js/mi-coleccion/estanteria.js`,
`js/constructor/nucleo.js`, `js/repeticiones/lista.js`,
`netlify/edge-functions/meta-social.js`,
`supabase-migration-cartas-buscar-en.sql` (nuevo), `SCHEMA.md`. En
`pruebas`: `pruebas/test-tanda-546.mjs` y el doble (genera `name_search` con
los tres nombres, que si no la prueba habla de otra base).

**Pasado**: la 546 entera en verde —incluida la parte de navegador, que
cambia de catálogo y comprueba las opciones del desplegable—, más 299, 372,
406, 415, 428, 443, 447 y las de Scrydex. `test-imports.mjs` limpio y la
portada en 167,8 KB (no la toca). Suite completa, en marcha.

## 2026-10-04 (tarde, 17:20) — PINGU-Claude (545 — sus cartas de los sets que solo tiene él)

**Hecho**: el relleno solo ENRIQUECÍA. `if (!nuestra) { sinCartaNuestra++;
continue }`, así que los sets que la 540 trae de su catálogo —los que TCGdex
no tiene— se quedaban con CERO cartas: una colección vacía en la
biblioteca, que es el mismo hueco del que acabamos de borrar 68. Ahora, en
esos sets y solo en esos, la carta que falta se trae entera
(`filaDeCartaSuya`). **No cuesta un crédito más**: el barrido ya está
pagando esas páginas y esas cartas vienen dentro.

**Dónde NO**: en un set que viene de TCGdex. Su número y el nuestro se
escriben distinto (`001` contra `1`), así que una carta que el cruce no
encuentre por cualquier motivo entraría como segunda fila de la misma carta
con otro identificador — y duplicar una carta es el único error de aquí que
sale en la cara de la biblioteca sin dar ningún aviso. El permiso se da por
set, mirando `scrydex_por`.

**No se escribe `types`**: en su respuesta japonesa no he visto ese campo, y
llenar una columna que FILTRA con algo cuyo idioma no conozco es peor que
dejarla vacía (la lección de la 484).

**Ficheros**: `netlify/lib/scrydex.mjs`,
`netlify/functions/scrydex-relleno.mjs`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-545.mjs`.

**Pasado**: la 545 en verde (33 comprobaciones), la 544 y las de Scrydex
(502, 507, 509, 526, 537) en verde, `test-imports.mjs` y
`comprobar-arbol.sh` limpios. Sin migración: las columnas ya existen.

**Qué queda**: el panel dirá `insertadas` en la fila `cartas-jp`. Y sigue
pendiente la suite completa (537→545) y las parejas a mano de los sets
japoneses que el id no recupere.

## 2026-10-04 (tarde, 16:40) — PINGU-Claude (544 — por qué 36 sets japoneses se quedaron en kanji, y 21 sin chapa)

**De dónde sale**: PINGU ejecutó la limpieza de huecos y pegó la cuenta del
catálogo japonés: **118 sets, 82 con nombre occidental, 61 con logo, 82
emparejados**. Con 231 expansiones suyas enfrente y su listado trayendo los
231 logos, eso no es «Scrydex no lo tiene»: son dos fallos nuestros.

**Hecho**: tres cosas, en `netlify/lib/scrydex.mjs`,
`netlify/functions/scrydex-sets.mjs` y las dos pasadas de logos.

1. **El id se reparte PRIMERO** (`parejasPorId`). El rescate por id existía
   desde la 508 pero corría detrás de la fecha y la cuenta — y en Japón
   salen tres o cuatro sets el mismo día con la misma cuenta, así que el
   primero del bucle se llevaba por fecha+cuenta el set suyo que por ID era
   de otro, y el dueño del id se quedaba SUELTO. Solo reparte un id único
   en los dos lados.
2. **Un par guardado entra confirmado y gratis** (`parejasGuardadas`).
   `scrydex_id` guarda el par confirmado desde la 509 y nadie lo leía: se
   deducían y se re-confirmaban los 82 pares en cada pasada, a una petición
   por par, comiéndose los 30 segundos de Netlify — así que los pares
   NUEVOS salían «sin tiempo» una y otra vez.
3. **Un fallo de red no es «no tienen logo»**. `dibujoDeVerdad` contestaba
   lo mismo para la imagen de RELLENO (dato suyo, definitivo) que para un
   socket cortado o un 503 (tropiezo nuestro). Ahora son tres respuestas, y
   la pregunta «¿queda algo?» de las dos pasadas de logos cuenta también
   los **emparejados sin logo** — antes esos 21 sets no volvían a mirarse
   nunca, porque ya tenían `scrydex_id`.

**Ficheros**: `netlify/lib/scrydex.mjs`,
`netlify/functions/scrydex-sets.mjs`, `netlify/functions/scrydex-logos.mjs`,
`netlify/functions/scrydex-logos-jp.mjs`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-544.mjs`.

**Pasado**: la 544 en verde, las 18 pruebas de Scrydex (499→541) en verde y
`test-imports.mjs` (258 módulos, 1.650 importaciones). `comprobar-arbol.sh`
limpio. Sin migración: no toca el esquema.

**Qué queda**: la pasada de `scrydex-logos-jp` dirá en `porQueSeEmparejan`
cuántos de los 36 los recupera el id; los que sigan sueltos salen enteros en
`sinEmparejarTodos` con los `suyosLibres` al lado, que es lo que hace falta
para escribir las parejas a mano. Pendiente también una suite completa
(537→544) y traer sus CARTAS de los sets que solo tiene él.

## 2026-10-04 (tarde, 15:30) — PINGU-Claude (543 — una tabla INVENTADA en una migración, y era la comprobación de un borrado)

**Hecho**: escribí `public.user_cards` en la migración de limpieza del
japonés. Esa tabla **no existe**: las de la casa son `user_collection` y
`user_wants`. Me inventé el nombre en vez de mirarlo —que es exactamente lo
que la casa tiene escrito que no se hace— y PINGU se comió el error en el
SQL Editor: `42P01: relation "public.user_cards" does not exist`.

**Y lo que asusta no es el error, es dónde estaba**: esa consulta era **la
comprobación de seguridad de un BORRADO** —«¿hay cartas de alguien en estos
sets?»—. Postgres cantó porque el nombre no existía; **si el nombre
inventado hubiera existido con otro contenido, habría contestado CERO por el
motivo equivocado** y yo habría dado el borrado por seguro. Es la familia de
siempre —un vacío que se lee como una respuesta— metida justo en la guarda.

**El barrido**: toda tabla que una migración NOMBRA (`from`, `join`,
`update`, `insert into`, `delete from`) tiene que estar CREADA en alguna
migración del repo. 142 migraciones, 333 menciones, y tres detalles que lo
hacen útil en vez de ruidoso:

- **Sin comentarios**: esta misma migración EXPLICA el fallo nombrando
  `user_cards`, y un nombre citado no es una consulta (la 524).
- **Una FUNCIÓN no es una tabla**: `from public.pokedex_resumen(...)` es una
  llamada, y se distingue por el paréntesis.
- **Lo que existe sin que ninguna migración lo cree va DECLARADO** con su
  motivo: `auth.users` y el `storage` son de Supabase; `user_profiles`,
  `guides` y `achievement_definitions` son más viejas que los ficheros de
  migración —nacieron en el editor cuando el repo no llevaba su esquema—.
  Si mañana alguien crea una tabla a mano y la usa, el barrido la canta: la
  lista crece a propósito y no por descuido.

**Ficheros**: `supabase-migration-japones-limpiar-huecos.sql` (corregida).
En `pruebas`: `pruebas/test-tanda-543.mjs`.

## 2026-10-04 (tarde, 15:05) — PINGU-Claude (542 — el nombre del set AL LADO DE CADA CARTA seguía en kanji)

**Hecho**: lo cazó el barrido que escribí en la 532, y es un hueco de
verdad. La 532 puso `nombreDeSet()` en las pantallas de colecciones, pero
el nombre del set que sale **al lado de cada carta** —debajo del nombre, en
la etiqueta de accesibilidad, en los resultados del buscador, en la
Pokédex, en los álbumes, en el bloque de cartas de una guía— sale de un set
EMBEBIDO en la consulta de cartas (`tcg_sets(...)`), y esa consulta no
pedía `name_en`. Catorce sitios en siete ficheros, todos en kanji.

Dos cosas, las dos imprescindibles:

1. **Las siete consultas embebidas piden `name_en` y `serie_name_en`.** Una
   columna que no se pide llega `undefined` (la 523, otra vez).
2. **Y los catorce sitios pintan con `nombreDeSet()`**, no con
   `tcg_sets?.name`. Quedan CERO lecturas crudas en el repo.

De paso entran las BÚSQUEDAS por texto: quien escribe «Mega Evolution» en
el catálogo japonés busca por lo que VE, no por el kanji que no sabe
escribir.

**Ficheros**: `js/mi-coleccion.js`, `js/carta.js`, `js/cards-block.js`,
`js/card-picker.js`, `js/mi-coleccion/filtros.js`,
`js/mi-coleccion/pokedex.js`, `js/mi-coleccion/albumes.js`,
`js/mi-coleccion/datos.js`, `js/tcgdex.js`.

**Y la lección, que es la misma de esta mañana con otra cara**: el barrido
de la 532 solo miraba los ficheros que IMPORTAN `nombreDeSet`. Como estos
siete no lo importaban todavía, no los miraba — hasta que `js/mi-coleccion.js`
empezó a importarlo por otra cosa y entonces sí entró en el barrido y cantó.
Una guarda que solo mira a quien ya hace lo correcto no encuentra a quien no
lo hace.

## 2026-10-04 (tarde, 14:45) — PINGU-Claude (541 — el filtro de expansiones, y un cabo suelto de mi propio importador)

**Hecho**: PINGU: «el filtro de todas las expansiones parece que solo está
cogiendo las de un idioma; tendría que depender del idioma que escojas —
inglés y español son lo mismo, pero el japonés no».

Y tenía razón por un sitio que no era el que yo miraba. La consulta SÍ
filtra por mercado (`.eq('market', mercado)`) y la caché SÍ se tira al
cambiar de catálogo. Lo que pasaba es más tonto y es **mío de hace media
hora**: los sets que la 540 trae de Scrydex **no llevaban `serie_id`**, y
tanto el desplegable de eras como el agrupado de la estantería miran esa
columna. Así que los recién importados no salían en el desplegable y caían
todos juntos en un grupo sin nombre.

El identificador de serie sale de SU nombre de serie, en minúsculas y con
guiones (`Mega Evolution` → `mega-evolution`). No es inventarse un dato: es
la misma serie escrita de forma comparable, y lo que se ENSEÑA sigue siendo
el nombre suyo (`serie_name_en`).

**Y el desplegable rotulaba con `serie_name`**, que en un set importado
viene vacío y en uno japonés de TCGdex viene en japonés. Ahora rotula con
`eraDeSet`, igual que el título de cada grupo desde la 532.

**Por qué los nombres japoneses siguen en japonés** (que es lo otro que
preguntó): porque son sets de TCGdex y TCGdex los nombra en japonés. El
nombre occidental lo pone Scrydex y solo puede ponerlo donde hay
emparejamiento — y de nuestros 186, **68 no tienen ni una carta**, así que
no hay señal que comparar y no se pueden emparejar nunca. Son filas vacías:
sin cartas, sin logo y en kanji. Desde la 540 su equivalente de Scrydex
entra solo, con logo, símbolo y nombre occidental, o sea que la fila vieja
solo estorba al lado de la nueva.

**PENDIENTE DE PINGU**: `supabase-migration-japones-limpiar-huecos.sql`.
BORRA, así que va con el impacto delante: la primera consulta enseña qué se
va a borrar y **la segunda tiene que dar CERO cartas de usuarios
afectadas** —por construcción, porque solo se borra lo que no tiene ni una
carta—. Si no da cero, no se ejecuta.

**Ficheros**: `netlify/functions/scrydex-importar-jp.mjs`,
`js/mi-coleccion.js`, `supabase-migration-japones-limpiar-huecos.sql`
(nuevo). En `pruebas`: `pruebas/test-tanda-541.mjs`.

## 2026-10-04 (tarde, 14:10) — PINGU-Claude (540 — traer SUS sets japoneses, no retocar los nuestros)

**Hecho**: PINGU, con dos capturas de Scrydex delante: «quiero que calques
toda la base de datos de sets y de cartas de Scrydex y mostremos eso.
Estamos pagando Scrydex y Scrydex es lo mandante».

**Y el diagnóstico es correcto**, así que queda escrito: el catálogo japonés
era el de TCGdex con Scrydex retocándolo por encima, y eso llega a medias
POR CONSTRUCCIÓN —

- 186 sets nuestros contra **231 suyos**.
- **68 de los nuestros no tienen ni una carta** (agujero de TCGdex, medido
  en la 486).
- El retoque solo toca lo que EMPAREJA: lo que no empareja se queda en
  kanji y sin logo para siempre, por bien que funcione el relleno.

De paso, sus capturas contestan lo que yo tenía como duda abierta: **sus
cartas japonesas traen el nombre en inglés** («Tropius», «Cherubi»), no solo
sus expansiones. Eso ya no hay que medirlo.

`scrydex-importar-jp.mjs` **inserta** las expansiones suyas que no tiene
nadie, con su id (`mf_ja`), su logo, su símbolo, su nombre japonés, su
nombre occidental, su era, su fecha y sus dos cuentas. 3 créditos la pasada.

**LO QUE NO HACE, Y ES LA MITAD DE LA TANDA**:

- **No borra nada.** Ni un set ni una carta. Retirar el catálogo japonés
  viejo es una decisión de PINGU y no mía: puede haber gente con cartas
  japonesas guardadas apuntando a esos identificadores, y eso no se
  deshace. Lo vigila una comprobación que lee el fichero y exige que no
  haya un solo DELETE.
- **No inserta un set suyo que ya esté emparejado con uno nuestro**, ni uno
  cuyo id sin el idioma sea el de uno nuestro (`SV1a` ↔ `sv1a_ja`, sin
  distinguir mayúsculas — la lección de la 486). **Duplicar una colección
  es el único error que aquí se paga caro**: sale en la cara de la
  biblioteca y no da ningún error.

**Y una guarda que ya ha pagado la suscripción**: `test-imports.mjs` cazó en
un segundo que `fecha` no estaba exportada de `netlify/lib/scrydex.mjs`.
Eso, en producción, es un módulo que no resuelve — o sea la función entera
muerta.

**Ficheros**: `netlify/functions/scrydex-importar-jp.mjs` (nuevo),
`netlify/lib/scrydex.mjs` (exporta `fecha`). En `pruebas`:
`pruebas/test-tanda-540.mjs`, y la comprobación de las POP de la 415, que
sujetaba lo que la 536 cambió a petición de PINGU.

**Lo que viene detrás**: las CARTAS de esos sets. El barrido `cartas-jp` ya
recorre su catálogo entero, así que insertar las que falten no cuesta ni un
crédito más — pero hay que decidir con qué id se insertan y qué pasa con las
nuestras, y eso se escribe con el informe de esta pasada delante.

## 2026-10-04 (mediodía, 13:40) — PINGU-Claude (539 — las dos listas para emparejar a mano, y que el panel conteste solo)

**Hecho**: PINGU, dos cosas. «Haz la regla a mano para esos 28» y «los
nombres de los sets y cartas japo siguen en japo, ¿por qué no te traes todo
de Scrydex de una vez?».

**1. Para escribir 28 parejas a mano hacen falta LAS DOS LISTAS.** El
informe daba doce ejemplos de los NUESTROS y ninguno de los SUYOS, así que
escribir una pareja era adivinar el id del otro lado — y un id inventado no
da error: la regla no casa con nada y el set sigue suelto. Es la lección de
la 323 por tercera vez. Ahora el informe trae `sinEmparejarTodos` (los 28
con nombre, fecha y cuenta) y `suyosLibres` (los suyos que quedaron libres,
con su id, su nombre japonés, su nombre inglés, su código, su fecha y su
cuenta). **No cuesta ni un crédito**: las expansiones ya estaban pedidas y
los sueltos ya estaban calculados; lo único que faltaba era enseñarlos.

**2. Por qué los nombres siguen en japonés, que son DOS causas distintas y
ninguna es «no me lo he traído»:**

- **Los SETS**: la pasada que escribió los 44 corrió a las 10:01, y la
  columna `name_en` se añadió a las 10:30. O sea que se escribieron bien…
  sin el campo que todavía no existía. Y el freno de veinte horas impidió
  que se reescribieran — eso lo arregló la 538 hace un rato, así que la
  próxima pasada los rellena.
- **Las CARTAS**: van por la página 57 de ~190. Lo que se escribe desde la
  537 lleva su nombre occidental; lo que todavía no se ha visitado, no.

**Y una pregunta que yo no tenía contestada**: en sus EXPANSIONES viene
`translation.en.name` —lo vimos en la sonda de la 528— pero en sus CARTAS lo
escribí **dando por hecho que también**. Eso es deducir de una muestra de
otra cosa, que es exactamente lo que me enseñaron las tandas 484 y 486. Así
que ahora se CUENTA: el estado guarda `conNombreOccidental` junto a
`escritas`. Si acaba en 0 con miles escritas, el japonés se queda en japonés
**por su catálogo y no por nuestro código** — y lo dirá el panel sin que
nadie pregunte ni gaste un crédito.

**Ficheros**: `netlify/functions/scrydex-sets.mjs`,
`netlify/functions/scrydex-logos-jp.mjs`,
`netlify/functions/scrydex-relleno.mjs`. En `pruebas`:
`pruebas/test-tanda-537.mjs` (un bloque más).

## 2026-10-04 (mediodía, 13:00) — PINGU-Claude (538 — 62 sets japoneses esperando una semana por el freno)

**Hecho**: la primera pasada japonesa de verdad dejó el informe que hacía
falta para ver esto. De sus 231 expansiones: **120 emparejadas, 44
confirmadas y escritas, 28 sin emparejar, 13 sin confirmar, 1 RECHAZADA** —
y las cuentas cuadran, así que faltan **62: las que se quedaron SIN TIEMPO**.

Una función de Netlify se muere a los 30 segundos y confirmar un par cuesta
una petición, así que 120 pares no caben en una pasada. Eso no es un fallo
—la siguiente los coge— salvo por una cosa: el freno que puse en la 530 era
«no volver a mirar en veinte horas». O sea que esos 62 se habrían repartido
**a lo largo de una semana**.

**El freno pasa a ser «¿avanzó?» en vez de «¿cuánto hace?»**: mientras la
última pasada escriba algo o deje pares sin tiempo, se vuelve a pasar a los
diez minutos. Cuando una pasada no escribe nada y no deja nada a medias, el
trabajo está hecho y ahí sí duerme un día. Y para poder decidirlo, el
informe guarda `sinTiempo`, que no lo copiaba: «44 escritas de 120» sin ese
número parece que 76 no se han podido, y la verdad es que 62 ni se
intentaron.

**Lo que enseña el informe y conviene tener apuntado**:

- **Lo que confirma en japonés**: el nombre del set 19 veces y la Pokédex
  25. La apuesta de la 530 —que el nombre japonés confirmaría gratis porque
  los dos catálogos lo publican en japonés— funciona, pero menos de lo que
  dije: en 19 de 44, no en todos.
- **La única RECHAZADA es una buena noticia**: `SM7a → sm7b_ja`, «nuestro
  127 contra su 114» de Pokédex. Es un par FALSO que la fecha y la cuenta
  propusieron y la Pokédex tumbó. Emparejar propone, verificar dispone
  (tanda 508), funcionando en vivo.
- **Diez de las trece sin confirmar dicen «no tenemos ninguna carta de ese
  set»**, y eso no es cosa de Scrydex: son los 68 sets japoneses que TCGdex
  tiene sin una sola carta. Sin cartas no hay señal que comparar, así que
  esos logos no se pueden confirmar por ahora. Se quedan sin escribir a
  propósito: un logo sin confirmar es el logo de otro set.
- **Su listado trae los 231 logos** (`suListadoTraeLogos: 231 de 231`), que
  era la pregunta de las tandas 484 y 486. Confirmado con datos, no
  deducido.

**Y el relleno de cartas japonés va**: `cartas-jp` por la página 57 de
~22.272 cartas suyas, cero fallos.

**Ficheros**: `netlify/functions/scrydex-logos-jp.mjs`. En `pruebas`:
`pruebas/test-tanda-531.mjs` (una comprobación más).

## 2026-10-04 (mediodía, 12:15) — PINGU-Claude (537 — el relleno JAPONÉS, que es lo que de verdad faltaba)

**Hecho**: PINGU: «vete con lo japonés, rellename todos los logos y las
imágenes de cartas. No sé por qué esto te está costando tanto, lo tenemos
todo en Scrydex, simplemente tráelo». Y tenía razón en lo que faltaba:

**`scrydex-relleno` llevaba `MERCADO = 'WEST'` e `IDIOMA = 'en'` A FUEGO**,
con un comentario al lado que lo justificaba —«el japonés no está
emparejado»— que **dejó de ser verdad en cuanto la 530 trajo sus 231
expansiones**. Es exactamente la trampa que dejó escrita la 471: una
constante justificada con «hoy esto no hace falta» no avisa el día que hace
falta. Van ya tres veces con esa misma forma.

Ahora el mercado, el idioma y la clave de estado son PARÁMETROS, y
`scrydex-relleno-jp.mjs` es una llamada con otros tres valores — **no una
copia del fichero**: dos copias de un bucle con frenos se separan, y
entonces el freno que arreglas en una sigue roto en la otra. Cada una se
reanuda por su propia clave (`cartas-west`, `cartas-jp`), así que no se
pisan la página por la que iban.

**Y el NOMBRE OCCIDENTAL de cada carta** (`translation.en.name`), que es la
otra mitad de lo que pidió: «además de los kanji, ponme los nombres que
tiene Scrydex». Va a `tcg_cards.name_en` —columna nueva— y se enseña con la
misma regla que los sets: **se traduce lo que NO SE PUEDE LEER**. Una carta
occidental no cambia porque exista `name_en`, y el español sigue mandando
donde lo hay.

Lo que trae la pasada japonesa: foto de Scrydex, rareza exacta, ilustrador,
PS, Pokédex y nombre occidental. Un crédito por página de su catálogo, un
barrido y a dormir una semana — los mismos frenos que el occidental, porque
es la misma función.

**Y las ocho consultas que pintan un nombre de carta piden `name_en`**, con
su barrido que lo exige: la lección de la 523 ya no se me escapa dos veces.

**Ficheros**: `netlify/functions/scrydex-relleno.mjs` (parametrizada),
`netlify/functions/scrydex-relleno-jp.mjs` (nueva), `netlify/lib/scrydex.mjs`,
`js/carta-nucleo.js`, `js/carta.js`, `js/cartas.js`, `js/coleccion.js`,
`js/tcgdex.js`, `js/mi-coleccion.js`, `js/mi-coleccion/datos.js`,
`supabase-migration-cartas-nombre-en.sql` (nuevo). En `pruebas`:
`pruebas/test-tanda-537.mjs`.

**PENDIENTE DE PINGU, Y NO SE EMPUJA SIN ESO**: ejecutar
`supabase-migration-cartas-nombre-en.sql`. Las consultas piden ya `name_en`
y PostgREST da **400 por una columna que no existe** — o sea que empujar
antes deja /carta, /cartas, /coleccion y /mi-coleccion sin cargar.

## 2026-10-04 (mediodía, 11:50) — PINGU-Claude (536 — tres correcciones suyas, y dos eran cosa mía)

**1. Las POP son una ERA.** PINGU: «es como si fuese una era, todas las
expansiones de POP pueden ir juntas». Caían fuera por DOS sitios distintos
—por eso no bastaba con tocar uno—: en /cartas una era se reconoce por tener
un set de 100 cartas o más, y las POP son diez de 17; y en la ESTANTERÍA
estaban metidas en `NOMBRES_ESPECIALES`, la lista de «esto no es un set de
verdad», junto a los trainer kits y McDonald's. Ahora hay
`SERIES_QUE_SON_ERA` y el nombre sale de esa lista.

Es una lista a mano y lo será siempre, **porque esto no se deduce de los
datos**: nada en la fila dice «esto es una línea». Lo que sí se puede es
avisar cuando deje de casar, y `reglasQueNoCasan` las mira también.

**2. El 30 aniversario vuelve a ser dos filas.** La 347 lo plegó porque él
dijo «son el mismo set, no me lo separes», y esta mañana dijo lo contrario:
«el Classic debería ir DESPUÉS del Celebration». Manda lo último. Lo que
pasó es que el Classic **llevaba plegado en /cartas desde la 347** y no se
notaba porque la estantería no plegaba; en cuanto la 535 la puso a plegar,
desapareció de donde él lo estaba mirando y preguntó por qué. Ya salen las
dos, y en el orden que pidió sin tocar nada: misma fecha, y `30th` desempata
antes que `30th-c`.

**3. Las Trainer Gallery vuelven, y esa es mi lección del día.** Las plegué
dentro de su set en la 534 **por mi cuenta: nadie lo había pedido**. PINGU:
«¿qué has hecho con las Trainer Gallery?». Son una colección que la gente
sigue aparte, como la Shiny Vault o la Galarian Gallery, y lo mismo vale
para las otras cuatro que me llevé por delante (`sma`, `swsh4.5sv`,
`swsh12.5gg`, `cel25cc`). Todas vuelven.

**Lo único que sí arreglo solo es el DUPLICADO**, que no es una opinión:
`swsh9tg` y `swsh9.5tg` son la misma colección con dos identificadores,
mismo nombre, misma fecha y las mismas 30 cartas. Se pliega la copia en la
buena y la colección sigue existiendo.

> **Plegar una colección no es un detalle técnico, es una decisión de quien
> manda el catálogo.** Lo que yo puedo decidir solo es que algo está DOS
> VECES; que algo «sobre», no.

**Mudanza**: `esUnaEra` y `CARTAS_DE_UNA_EXPANSION` se van a
`js/catalogo-series.js`. Es aritmética y vivía en un módulo que monta una
página, así que no se podía probar sin navegador (igual que `plegarHermanos`
en la 535).

**Ficheros**: `js/catalogo-series.js`, `js/cartas.js`,
`js/mi-coleccion/estanteria.js`. En `pruebas`: `pruebas/test-tanda-536.mjs`,
arreglos en la 533 y la 535, y **se borra `test-tanda-534.mjs`**: su tanda
entera queda deshecha, y una prueba que sujeta una decisión revocada es peor
que no tenerla.

## 2026-10-04 (mañana, 11:25) — PINGU-Claude (535 — la estantería no plegaba NADA, y ahí estaba el 30 aniversario)

**Hecho**: con los identificadores de verdad delante (`30th` y `30th-c`), la
regla de la 347 **sí casa**: el Classic se pliega dentro del Celebration en
/cartas desde entonces. Lo que PINGU estaba mirando era OTRA pantalla.

**La estantería de /mi-coleccion no plegaba nada.** Las trece colecciones
que son parte de otra salían sueltas, sin logo y con el progreso partido en
dos barras. Es el mismo fallo que la 316 con las tarjetas de guía: dos
pantallas que enseñan lo mismo por caminos distintos, y una se queda atrás.

**Y plegar ahí son DOS cosas, no una**: la fila se va, y lo que TIENES de
ella se suma a la del padre. Con solo lo primero, las cartas del hijo
desaparecen del recuento y el álbum dice que tienes menos de las que tienes
— sin dar ningún error, que es lo de siempre. Van los dos sitios que
cuentan: la estantería y el vistazo del panel.

**Mudanza**: `plegarHermanos` se va de `js/cartas.js` a
`js/catalogo-series.js`. Lo necesitaba /mi-coleccion, y arrastrar un módulo
que monta una página entera por una función de doce líneas es justo lo que
dice la 471 que no se hace.

**Una prueba que no se me habría ocurrido sin mirar el código**: plegar dos
veces la MISMA lista sumaría las cuentas dos veces, porque `plegarHermanos`
escribe en el objeto del padre. La estantería se repinta en cada filtro, así
que pliega sobre una copia. La comprobación lo fija.

**Ficheros**: `js/catalogo-series.js`, `js/cartas.js`, `js/mi-coleccion.js`.
En `pruebas`: `pruebas/test-tanda-535.mjs`.

**Lo que sigue sin resolverse del 30 aniversario**: no tiene logo. Ni el
Celebration ni el Classic tienen `logo_path` —TCGdex no lo publica— así que
tiene que venir de Scrydex, y ahí sí está (su `me55c` trae logo y símbolo).
Depende de que el emparejamiento occidental case esos dos sets; el informe
de `sets-west` dirá por qué no lo ha hecho todavía.

## 2026-10-04 (mañana, 11:05) — PINGU-Claude (534 — ocho filas más, leyendo la exportación entera)

**Hecho**: PINGU mandó la cola del catálogo para el 30 aniversario, y
leyéndola entera salieron OCHO filas más de la misma familia que las cinco
suyas —subconjuntos con numeración propia dentro de su set— y **un fallo de
TCGdex que se ve a simple vista**:

- **Las cuatro Trainer Gallery están DUPLICADAS**: `swsh9tg` y `swsh9.5tg`,
  mismo nombre, misma fecha y las mismas 30 cartas. Igual las de Astral
  Radiance, Lost Origin y Silver Tempest. Plegar las dos en su set padre
  arregla el duplicado de paso.
- Las Shiny Vault de Hidden Fates (`sma`) y de Shining Fates
  (`swsh4.5sv`), la Galarian Gallery de Crown Zenith (`swsh12.5gg`) y la
  Classic Collection de Celebrations (`cel25cc`) van dentro de su set: son
  las TG01-TG30, las SV01-SV94, las GG01-GG70.

**LO QUE PODÍA SALIR MAL Y ES LO QUE MÁS VIGILA LA PRUEBA**: que un PADRE
acabe siendo hijo de otro. `swsh12` es Silver Tempest y `swsh12.5` es Crown
Zenith — dos sets distintos con identificadores que se parecen muchísimo, y
una regla escrita a ojo se traga Crown Zenith (160 cartas) dentro de Silver
Tempest **sin dar ningún error**: la colección desaparece de la lista y ya
está. Hay una comprobación que recorre todos los padres y exige que ninguno
tenga padre, y tres más una a una (Crown Zenith, Pokémon GO y 151, que son
los tres que más se parecen a un hijo).

**Lo que NO se ha tocado**: el `sp` «Sample» de e-Card, que PINGU dijo dejar
por ahora.

**Ficheros**: `js/catalogo-series.js`. En `pruebas`:
`pruebas/test-tanda-534.mjs`, y una comprobación de la 533 que daba por
hecho que la lista tenía cinco reglas.

**SIGUE PENDIENTE el 30 aniversario**: la segunda exportación también se
cortó (acaba en `sv09`, marzo de 2025) y los sets del 30 son de 2026. Hace
falta la cola de verdad para saber sus identificadores: hoy el plegado va
por el prefijo `30th`, y si sus ids no empiezan por ahí, la regla no casa
con nada — que es justo lo que PINGU está viendo cuando dice que el Classic
le sale suelto y sin logo.

## 2026-10-04 (mañana, 10:45) — PINGU-Claude (533 — cinco sets que son en realidad parte de otro)

**Hecho**: PINGU repasó el catálogo set por set y encontró cinco filas que
no deberían existir por separado. Con su exportación del SQL Editor delante
—los identificadores salen de ahí y no de mi memoria— quedan plegadas:

| Se pliega | Dentro de | Por qué |
|---|---|---|
| `rc` Radiant Collection (25) | `bw11` Legendary Treasures | son sus secretas |
| `exu` Unown Collection (28) | `ex10` Unseen Forces | ídem |
| `xya` Yellow A Alternate (6) | `xyp` XY Black Star Promos | son promos |
| `wp` W Promotional (7) | `basep` Wizards Black Star Promos | ídem |
| `miscp` Miscellaneous Promos (1) | `basep` | es el Ancient Mew |

El mecanismo existía desde la 347 (el 30 aniversario) pero por PREFIJO, y
aquí no vale: `rc` no empieza por `bw11`. Son parejas sueltas, así que
`COLECCIONES_JUNTAS` admite ahora `hijos: [...]` además de `prefijo`.

**Lo que NO se ha tocado, y comprobarlo es parte del trabajo**: las POP
Series. PINGU las quería «como colección propia, abajo» y **ya estaban
así**: su set más grande son 40 cartas y una ERA pide 100, así que caen en
el cajón de después de las eras. Lo que había que hacer era mirarlo, no
«arreglarlo».

**La guarda**: una lista de identificadores a mano se queda vieja sin
avisar —si TCGdex renombra uno, la regla deja de casar, el set vuelve a
salir suelto y no da ningún error (la lección de la 323 con las megas)—.
Así que /cartas compara las reglas con los sets que de verdad han llegado y
canta las que ya no casan con nada. No rompe la página: una regla vieja es
una fila de más, no una web caída.

**La prueba va en el NAVEGADOR** para lo que vive en `js/cartas.js`: ese
módulo necesita un DOM, y una prueba que llamara a `plegarHermanos` suelta
no diría nada de la pantalla (la lección de la 313). Se siembran los doce
sets de verdad y se mira la lista que sale.

**Ficheros**: `js/catalogo-series.js`, `js/cartas.js`, `js/coleccion.js`. En
`pruebas`: `pruebas/test-tanda-533.mjs`.

**Queda abierto, por falta de datos**: el `sp` «Sample» de la era e-Card
(10 cartas) — no sé qué es y no lo toco hasta saberlo; y el 30th Classic
Collection (sin logo, y debería ir detrás del 30th Celebration), que no
estaba en la exportación: el SQL Editor cortó en 100 filas y el 30th es de
2026, o sea del final.

## 2026-10-04 (mañana, 10:25) — PINGU-Claude (532 — los sets japoneses, con nombre que se pueda leer)

**Hecho**: PINGU, revisando la biblioteca japonesa ya con logos: «Scrydex
guarda el nombre de los sets japoneses en occidental, y las eras también,
así que tráete ese nombre en vez de los kanjis, porque no se sabe leer
esto». Y viene GRATIS, en la misma respuesta que el logo:
`translation.en.name` y `series`.

Dos columnas nuevas (`name_en`, `serie_name_en`,
`supabase-migration-sets-nombre-en.sql`) y **el japonés no se tira**: se
queda en `name`, que es el nombre de verdad del set y con lo que se cruza.
Lo que se GUARDA es canónico; lo que se ENSEÑA va traducido (tandas 334 y
335).

**La regla de cuándo se traduce es la mitad de la tanda**: se traduce lo que
NO SE PUEDE LEER. Si nuestro nombre lleva kanji y hay uno occidental, se
enseña el occidental; si no, el nuestro. **Un set español no se enseña en
inglés porque exista `name_en`** — eso cambiaría el catálogo entero por un
dato que se trajo para otra cosa, y es justo el tipo de cambio en bloque que
ya costó dos sustos (tandas 310 y 311).

**Y la prueba del alfabeto pasa a ser UNA.** `netlify/lib/scrydex.mjs` tenía
su propia copia de la expresión del CJK; ahora las dos mitades importan
`tieneCJK` de `js/texto.js`, que es el fichero sin dependencias que existe
para esto (tandas 447 y 471). Una copia se separa sin que nadie se entere, y
esa guarda ya llevaba tres tandas mirando a un fichero vacío una vez.

**Ficheros**: `js/texto.js`, `js/catalogo-series.js`, `js/cartas.js`,
`js/coleccion.js`, `js/carta-nucleo.js`, `js/mi-coleccion.js`,
`js/mi-coleccion/estanteria.js`, `netlify/lib/scrydex.mjs`,
`netlify/functions/scrydex-sets.mjs`,
`supabase-migration-sets-nombre-en.sql` (nuevo). En `pruebas`:
`pruebas/test-tanda-532.mjs`.

**PENDIENTE DE PINGU**: ejecutar `supabase-migration-sets-nombre-en.sql`.
Hasta que esté, la consulta de sets pedirá dos columnas que no existen y
**/cartas y /coleccion se quedarán sin cargar** — PostgREST da un 400 por
una columna que no existe, no la ignora.

**Y LO QUE QUEDA, que PINGU revisó set por set** (anotado para la siguiente
tanda; hace falta saber los ids exactos y esos solo se ven desde el panel):
el 30th Classic Collection sin logo y que debería ir DETRÁS del 30th
Celebration (el Celebration es el set base); «Yellow A Alternate» va dentro
de XY Black Star Promos; la Radiant Collection (25 cartas) dentro de
Legendary Treasures; la Unown Collection dentro de Unseen Forces; un set
«sample» en la era e-Card que no se sabe qué es; «V promotional» y el
Ancient Mew dentro de Wizards Black Star Promos; y las POP Series, que SÍ
deben ser colección propia pero colocadas debajo del Base Set.

## 2026-10-04 (mañana, 10:05) — PINGU-Claude (531 — una fila que no está puede querer decir tres cosas)

**Hecho**: en el panel de PINGU, a los diez minutos de empujar el
emparejamiento japonés, la fila `sets-jp` **no estaba**. Y eso, desde fuera,
es idéntico en tres casos que no se parecen en nada: todavía no ha corrido,
ha corrido y ha reventado, o ha corrido bien y no ha podido escribir el
informe.

La causa era tonta y la tenía escrita en tres normas: el `catch` devolvía el
error **en la respuesta HTTP**, y la respuesta HTTP de una función PROGRAMADA
no la lee nadie — va a los registros de Netlify, que es tanto como no
tenerla. Ahora el fallo se apunta en `scrydex_estado` con su hora, igual que
el éxito.

Y la hora no es decoración: es la que frena la pasada siguiente. Sin ella,
una pasada que revienta siempre lo reintentaría **cada diez minutos**.

**El occidental tenía el mismo agujero**: lleva desde anoche con 24 sets sin
emparejar y ninguna forma de ver por qué sin entrar en los registros. Ahora
deja su informe en `sets-west`, con los EJEMPLOS, que es lo único que se
puede arreglar: «sin emparejar: 24» no dice nada, «svp — ninguno suyo con
esa fecha y esa cuenta» sí.

**Y el doble de la prueba se inventó un fallo**: contestaba lo mismo a
nuestra base y a la suya, y la función reventaba con «(filas || []).find is
not a function» — un error que en producción no puede pasar, guardado en el
informe como si fuera real. Nuestra base contesta LISTAS y la suya OBJETOS.
Es la lección de la 437 con una vuelta de tuerca: un doble más simple no
solo esconde fallos, también se los inventa.

**Ficheros**: `netlify/functions/scrydex-logos.mjs`,
`netlify/functions/scrydex-logos-jp.mjs`. En `pruebas`:
`pruebas/test-tanda-531.mjs`.

**Estado del relleno occidental**: TERMINADO a las 09:46 (`barridos: 1`).
**18.689 de 21.476 cartas visitadas, 87%**. Las ~2.800 que faltan son de los
24 sets que no están emparejados y de cartas nuestras que su catálogo no
tiene; el informe de `sets-west` dirá cuáles en la próxima pasada.

## 2026-10-04 (mañana, 10:00) — PINGU-Claude (529 y 530 — tres rarezas más, y los LOGOS JAPONESES)

**529, las rarezas**: el informe sacó tres con cartas detrás —32, 5 y 1— y
las tres son MECANISMOS con nombre oficial en español, no inventos: «Prism
Star» se publicó aquí como **Prisma Estelar** (va impreso en la carta), la
«Trainer Gallery» de Espada y Escudo se rotuló **Galería de Entrenadores**, y
«Rare ACE» es la rareza de los ACE SPEC de Negro y Blanco, o sea el mismo
mecanismo que hoy llaman «ACE SPEC Rare» — va al mismo sitio para que las
dos épocas se filtren juntas. Con eso, **las 24 rarezas que hay en la base
están todas traducidas**.

**530, los logos japoneses, que es lo gordo**: la sonda de la 528 contestó
que Scrydex tiene **231 expansiones japonesas con logo y símbolo**. De los
341 sets asiáticos, TCGdex tiene UN logo. Dos cosas de su respuesta real
cambian el emparejamiento:

- **Su id lleva el idioma pegado**: `mf_ja` es nuestro `mf`. Sin quitar ese
  sufijo, el rescate por id no habría casado NI UNO de los 231 — y sin dar
  ningún error, porque «no casa» es una respuesta válida. `idSinIdioma()`
  quita solo el sufijo: un `_` en medio no se toca.
- **El nombre del set lo publican los DOS en japonés**, así que confirmar un
  par sale gratis. En el occidental esa señal no servía porque el nuestro
  está en español y el suyo en inglés (la 505); aquí no cruza idiomas. Sin
  ella, confirmar 231 sets costaría 231 créditos. Confirma y no rechaza,
  como todas las de su clase.

`scrydex-logos-jp.mjs` hace la pasada: sus 231 expansiones son **3
créditos**, y el emparejamiento no gasta nada más. Escribe `logo_scrydex` y
`symbol_scrydex` solo de los pares CONFIRMADOS, no pisa nada nuestro, y de
paso rellena `release_date` y `tcg_online_code` de los sets japoneses, que
estaban vacíos desde la 322.

**El freno es el TIEMPO y no «¿queda algo?»** —siempre quedará algo: 68 de
los 186 sets japoneses de TCGdex no tienen ni una carta—. Pero un `schedule`
diario tenía un problema el primer día: si la hora ya pasó, lo que PINGU
espera ahora llega mañana. Así que va cada diez minutos y se frena sola por
su propio informe: si hay uno de hace menos de veinte horas, cero créditos.
**La primera pasada entra hoy; a partir de ahí, una al día.**

**Y una prueba que sujetaba un fixture poco realista**: en `test-tanda-507`
nuestro set de promos se llamaba «Promos» igual que el suyo, así que con la
señal nueva el par se confirmaba gratis y dejaba sin ejercitar el camino de
la Pokédex. En el occidental lo realista es que NO coincidan —el nuestro en
español, el suyo en inglés—, así que ahora se llama «Promos del sello
negro» y las dos comprobaciones vuelven a probar lo que dicen.

**Ficheros**: `js/rarezas-nombres.js`, `netlify/lib/scrydex.mjs`,
`netlify/functions/scrydex-logos-jp.mjs` (nuevo). En `pruebas`:
`pruebas/test-tanda-529.mjs`, `pruebas/test-tanda-530.mjs`, y el fixture de
`pruebas/test-tanda-507.mjs`.

## 2026-10-04 (mañana, 09:35) — PINGU-Claude (528 — la pregunta japonesa la hace el servidor, no PINGU)

**Hecho**: PINGU, esta mañana: «ya te dije anoche que trajeses todas las
cartas japonesas y todas las occidentales». Y lo que yo le contesté fue que
pulsara un botón de /admin para averiguar si Scrydex sirve japonés. **Eso
está mal planteado**, por dos motivos: ese botón lo tiene que pulsar una
persona, y una persona no está delante a las cuatro de la mañana —que es
exactamente el motivo por el que el relleno es una función programada y no
un botón—; y la pregunta cuesta UNA petición, así que pedírsela a él es
pedirle que haga mi trabajo.

`netlify/functions/scrydex-japones.mjs` la hace sola: pide
`ja/expansions?page_size=1`, guarda la respuesta ENTERA en `scrydex_estado`
bajo la clave `japones` y se calla. Sale en el panel al lado del relleno,
porque «¿Cómo va el relleno?» vuelca todas las filas de esa tabla.

**Lo que NO hace, y es la mitad de la tanda: emparejar ni escribir.** Eso
sería inventarme su respuesta, y la 501 ya costó un emparejamiento entero
escrito contra un formato de fecha que yo supuse (las suyas venían con
barras y no habría casado ni un set, sin un solo error). Por eso lo que
guarda es su PRIMERA EXPANSIÓN TAL CUAL: es el fixture con el que se
escribirá el emparejamiento japonés, en cuanto exista.

**Tres respuestas, no dos**: «sí hay» (200 con expansiones), «no hay» (un
404 **o un 200 con la lista vacía**, que es una respuesta y no un error) y
«todavía no se ha preguntado». Un 200 vacío tomado por un sí dejaría el
emparejamiento de mañana corriendo contra cero sets sin dar error.

**El freno**: en cuanto hay respuesta —la que sea, incluido un «no»— no se
vuelve a preguntar. Un crédito, una vez. Y frena también con el «no»: si
solo frenara con el sí, un 404 se repreguntaría cada cinco minutos para
siempre, que es el bicho de la 510 por tercera vez.

**Ficheros**: `netlify/functions/scrydex-japones.mjs` (nuevo). En `pruebas`:
`pruebas/test-tanda-528.mjs`.

**Lo que viene detrás, con la respuesta delante**: si sirve japonés, hay que
emparejar sus sets con los nuestros y darle al relleno una FASE japonesa
—lleva `MERCADO = 'WEST'` e `IDIOMA = 'en'` a fuego, y la respuesta por
defecto a «¿quién rellena los otros catálogos?» es NADIE (la 483)—. Si no lo
sirve, el japonés se queda en TCGdex y lo que tiene sentido es montar a mano
las 3.483 fotos que su servidor de ficheros tiene y su API se calla,
comprobando cada una con un HEAD antes de guardarla.

## 2026-10-04 (mañana, 09:45) — PINGU-Claude (527 — lo que dijeron los datos en la primera pasada de verdad)

**Hecho**: con el relleno ya escribiendo (3.224 cartas, página 89 de 101,
cero fallos), el informe de rarezas de /admin hizo su trabajo y dijo dos
cosas. Una verdadera y una falsa, y **la falsa importa más**:

- **«Shiny Rare»** no estaba, con 10 cartas detrás. Añadida como «Rara
  Brillante». Y el detalle que no me habría inventado: ya teníamos
  `Rare Shiny`, o sea que su catálogo usa **las dos formas, con las
  palabras al revés**. Se quedan las dos.
- **«Promo» era un falso positivo MÍO.** La pregunta estaba escrita como
  «¿se traduce a sí misma?», y la traducción de «Promo» al español ES
  «Promo». Un informe que señala lo que ya está bien **enseña a no
  mirarlo**, y entonces el día que aparezca una rareza de verdad estará en
  una lista que nadie lee. La pregunta buena no es «¿cambia la palabra?»
  sino «¿está en el vocabulario?» — `rarezaConocida()`, en el módulo puro,
  que es de donde la toman el informe y la web.

**Rigor**: 5 mutaciones, las 5 cazadas. La que importa es la del informe:
si vuelve a comparar la traducción consigo misma, la prueba se pone roja.

**Ficheros**: `js/rarezas-nombres.js`, `js/rarezas.js`, `admin/js/admin.js`.
En `pruebas`: `pruebas/test-tanda-527.mjs`, `rigor/rigor-tanda-527.py`.

**Apuntado para cuando haya respuesta**: PINGU pregunta por los sets
JAPONESES. Hoy el japonés viene de TCGdex (13.006 cartas) y de Scrydex **no
se sabe** si sirve japonés — se sale de dudas con un crédito, /admin →
«Sondear Scrydex» → opción 2 (`ja/expansions`). Si contestara que sí, haría
falta una FASE japonesa aparte: `scrydex-relleno` lleva `MERCADO = 'WEST'` e
`IDIOMA = 'en'` a fuego, y la respuesta por defecto a «¿quién rellena los
otros catálogos?» es NADIE (la lección de la 483).

## 2026-10-04 (mañana, 09:25) — PINGU-Claude (526 — la noche entera escribiendo CERO cartas)

**Hecho**: PINGU se despertó con el panel diciendo «0 de 21.476» en las tres
barras y, en la fila de la pasada, un `23502` —`not_null_violation`— con la
fila que fallaba: `(sv10-001, sv10, null, null,`.

**La causa**: `tcg_cards` tiene `local_id` y `name` a `not null`, y el
relleno hace un UPSERT. PostgREST manda `insert … on conflict do update`, y
**Postgres FORMA la fila que insertaría antes de ver que ya existe**: una
fila sin `local_id` no se puede formar. Resultado, 23502 y la sentencia
rechazada ENTERA —las 250 cartas de la página— aunque las 250 existieran ya
y aquello fuera a ser un update. Las dos columnas no se querían cambiar: hay
que REPETIRLAS, con el valor que la fila ya tiene, para que se pueda formar.

**La segunda mitad, que es la que lo hizo caro y es mía de anoche**: la 522
juntó el fallo suyo y el nuestro en el mismo manejador. Saltarse la página a
la quinta vale cuando la mala es LA PÁGINA; si el que falla es nuestro
Supabase, la página no tiene nada que ver y saltarla es **pagar un crédito
por página para no escribir nada**: cinco intentos × 101 páginas = 505
créditos por un barrido en blanco. Y el panel enseñando «página 42» como si
eso fuera progreso. Ahora lo nuestro **PARA**: lo deja escrito en el estado
y la pasada siguiente se sale ANTES de pedirle nada a Scrydex. Lo quita un
humano a propósito — si se quitara solo, volvería a gastar sin que nadie
haya mirado por qué fallaba.

**La guarda que importa** no es «lleva local_id»: es que **las columnas
obligatorias se leen de la migración** (`supabase-migration-cartas.sql`) y
se exigen en TODAS las sentencias que se mandan, no solo en el ayudante
puro. La de los nombres se arma a mano dentro de la función y tenía el mismo
agujero — una prueba que mirara solo `filaDeCartaConScrydex` habría salido
verde con producción cayéndose igual. Y así, el día que alguien añada otra
`not null`, la prueba lo canta sin que haya que acordarse.

**PENDIENTE DE PINGU**: ejecutar `supabase-migration-scrydex-reiniciar-relleno.sql`
(una fila de control, no toca ninguna carta). El estado se quedó en la
página 42 con el barrido dado por empezado; esto lo devuelve al 1.

**Ficheros**: `netlify/lib/scrydex.mjs`,
`netlify/functions/scrydex-relleno.mjs`,
`supabase-migration-scrydex-reiniciar-relleno.sql`, `CLAUDE.md`, `SCHEMA.md`.
En `pruebas`: `pruebas/test-tanda-526.mjs`, y DOS comprobaciones de
`test-tanda-509.mjs` que sujetaban lo de anoche (la del nombre en su propia
sentencia y la del fallo nuestro que saltaba).

**Suite**: se empuja con las pruebas de Scrydex y `test-imports` en verde,
sin esperar a la suite entera, porque la función corre cada cinco minutos y
cada pasada gastaba un crédito para no escribir nada. La suite completa va
inmediatamente después y el resultado se anota aquí.

## 2026-10-04 (madrugada, 08:10) — PINGU-Claude (525 — la marca que se perdía justo al ganar precisión)

**Hecho**: la 523 hizo que mandara `rarity_en`, y con eso la ficha de una
carta **GX se quedó sin su marca de rareza**. El motivo: la tabla de marcas
es la de la web oficial en español, o sea la de las rarezas DE AHORA, y el
vocabulario de Scrydex trae además las de antes —«Rare Holo GX», «Rare Holo
V», «Rare Holo EX», «Rare BREAK», «Rare Prime»—, que no están en ella. Son
miles de cartas de Sol y Luna y de Espada y Escudo enteras, y **no da ningún
error**: el dibujo deja de salir y la fila se queda con el nombre a secas.

Lo encontré leyendo `js/rarezas.js` después de la 523, no probando: la 523
está en verde y lo seguiría estando, porque sus pruebas miran la arcoíris,
que sí tiene marca.

**El arreglo es un respaldo que no pierde lo que distingue** (la norma de la
511): `marcaDeCartaHtml(carta)` pide la marca de la rareza precisa y, si esa
no tiene, la de la gruesa. Lo que se gana con Scrydex es el NOMBRE —«Rara
Holo GX» en vez de «Rara Ultra»— y el nombre se queda preciso; lo único que
baja un peldaño es el dibujo, que en esas dos rarezas es el mismo de todas
formas. Y **no se inventa ninguna marca nueva**: lo que de verdad lleva
impresa una GX en la esquina no lo sé, y una marca inventada es la versión
dibujada de una traducción inventada.

Queda una inconsistencia pequeña y a propósito: el CHIP de rareza (en los
filtros) sale de un rótulo y no de una carta, así que ahí no hay de dónde
caerse y un «Rara Holo GX» se queda sin icono. Un chip sin icono con el
nombre bueno me parece mejor trato que un icono con el nombre gordo.

**Rigor**: 5 mutaciones, las 5 detectadas. La que más me gusta es la del
ORDEN: poner la gruesa primero y la precisa de respaldo deja todo
funcionando… y devuelve a la arcoíris el diamante de la híper, que es
exactamente el fallo de la 523 otra vez.

**Ficheros**: `js/rarezas.js`, `js/carta-traducciones.js`,
`js/carta-nucleo.js`, `js/mi-coleccion.js`. En `pruebas`:
`pruebas/test-tanda-525.mjs`, `rigor/rigor-tanda-525.py`.

**SUITE de las tres tandas (523, 524 y 525) a las 09:00: 237 verdes, 3
rojos.** De los tres, DOS son `test-tanda-493` y `test-tanda-514`, que
piden `ffprobe` y en este contenedor no está instalado (no son de la web).
El tercero era de verdad y era bueno: `test-tanda-428` exigía que el estado
vacío del balance dijera «Precio de compra»… o sea que **la prueba llevaba
desde la 428 congelando el nombre equivocado**, el que arregló la 524. Una
prueba puede sujetar un fallo igual que lo sujeta el código. Corregida a
«Lo que pagaste» y en verde. Las tres tandas están empujadas.

## 2026-10-04 (madrugada, 07:40) — PINGU-Claude (524 — los caminos escritos en prosa, y van TRES)

**Hecho**: la 510 encontró el estado vacío de /mi-coleccion mandando a
«Añadir cartas», una pestaña que borró la 408. Esta tanda es la misma cosa
otras cuatro veces, encontradas a propósito y no de casualidad:

- Dos frases de la pestaña **Cambios** mandaban a la pestaña «Cartas»… que
  **salió del menú en la 447**. La pantalla sigue —se llega por el panel—,
  así que la indicación era correcta y el sitio donde te decía que mirases
  no estaba. Ahora las dos son BOTONES que van.
- El panel de balance decía «en su ficha, "Precio de compra"». Ese campo se
  llama **«Lo que pagaste (€)»** y «Precio de compra» no existe en ninguna
  pantalla de la web.
- El vistazo de Cambios decía «marca una carta como "la doy"». Se llama
  **«De esas, doy»**.
- Y en /admin, el informe de mercados mandaba a un botón «Contar mercados»
  que se rotula **«Qué hay de cada mercado»**.

**Lo que vale de la tanda no son los cuatro arreglos, es la guarda**: un
barrido recorre las 250 páginas y módulos, saca cada nombre entre comillas
angulares de un texto de interfaz y exige que ESE nombre exista en alguna
otra pantalla. Con dos detalles que son la tanda entera:

1. **Un destino nombrado en un comentario no es un destino.** `mi-coleccion.html`
   explica en tres comentarios por qué «Cartas» salió del menú, así que un
   barrido que no los quitara habría dado por bueno justo el fallo que
   busca. Se quitan antes de mirar — respetando los saltos de línea, que si
   se colapsan el informe manda a mirar a otra línea (me pasó).
2. **Lo que no es un destino va declarado uno por uno** (`NO_SON_CONTROLES`,
   13 frases con su motivo): un ejemplo de aviso, un mazo de ejemplo, los
   veredictos del informe de Scrydex… Una lista corta y explicada se
   mantiene; un barrido que perdona por su cuenta no vigila nada.

**Rigor**: 9 mutaciones. La buena es la última y es la FORMA del fallo: no
se toca la frase —sigue diciendo «De esas, doy»— sino que se le cambia el
NOMBRE AL CAMPO. Así es como pasó de verdad las tres veces: el texto se
queda quieto y lo que se mueve es la pantalla.

**Ficheros**: `js/mi-coleccion.js`, `admin/js/admin.js`. En `pruebas`:
`pruebas/test-tanda-524.mjs`, `rigor/rigor-tanda-524.py`.

## 2026-10-04 (madrugada, 07:05) — PINGU-Claude (523 — la rareza exacta estaba en la base y no llegaba a NINGUNA pantalla)

**Hecho**: la 509 trajo el inglés exacto de Scrydex a `rarity_en` y la 510
le puso traductor (`rarezaDeCarta`, que prefiere `rarity_en` y cae a
`rarity`). Las dos tandas bien, el resultado **cero**: ninguna consulta del
cliente pedía esa columna. O sea que el respaldo se usaba SIEMPRE y la
Rainbow de Lost Thunder —la queja literal de PINGU— seguía rotulada «Rara
Híper» con el dato bueno guardado.

**Una columna que no se pide llega `undefined`, y `undefined || otra` es una
expresión perfectamente válida**: no hay error que mirar, hay una pantalla
que dice lo de antes. Las ocho consultas que nombran `rarity` piden ahora
las dos, y lo vigila un barrido que exige que cualquier lista de columnas
con `rarity` lleve `rarity_en`.

Tres cosas más que la rareza gruesa tapaba:

- **El brillo**: la arcoíris llevaba el foil DORADO (el mapa tenía la misma
  entrada para las dos). Ahora arcoíris → arcoíris y secreta → oro.
- **La escala de orden**: «Rare Rainbow» solo casaba con `rare`, así que la
  carta más buscada del set se ordenaba por debajo de una holo.
- **Las reglas de MAZO**: el AS táctico y el radiante son uno por mazo y se
  reconocen por la rareza. Ahí la rareza no decide lo que se LEE sino lo que
  se PUEDE, y una carta sin la rareza española curada se escapaba del límite
  sin dar error.

Y /coleccion pedía `rarity` **sin usarla en ninguna línea**: fuera.

**Rigor**: 14 mutaciones, las 14 detectadas — pero las dos primeras pasadas
salieron con cuatro «sin detectar» y las cuatro enseñaron algo. Dos eran la
trampa de la 314 en estado puro: el mapa de brillo Y el respaldo por
palabras decían los dos que la arcoíris es arcoíris, así que quitar
cualquiera de los dos no cambiaba nada. Decide el mapa y punto. Otra era que
la prueba llamaba a `rangoDeRareza` a pelo en vez de ordenar de verdad, y la
cuarta que no pintaba la ficha de /carta — que era LA pantalla de la queja.

**Ficheros**: `js/rarezas-nombres.js`, `js/rarezas.js`,
`js/carta-traducciones.js`, `js/carta-nucleo.js`, `js/carta.js`,
`js/coleccion.js`, `js/mi-coleccion.js`, `js/mi-coleccion/datos.js`,
`js/mi-coleccion/albumes.js`, `js/mi-coleccion/filtros.js`,
`js/mi-coleccion/orden.js`, `js/constructor/datos.js`,
`js/constructor/nucleo.js`, `SCHEMA.md`. En `pruebas`:
`pruebas/test-tanda-523.mjs`, `rigor/rigor-tanda-523.py`.

**Portada**: 167,8 KB (nada de esto la toca). **Suite**: la pasada de las
06:15 dio **235 verdes / 2 rojos**, y los dos rojos son `test-tanda-493` y
`test-tanda-514`, que piden `ffprobe` y aquí no está instalado — no son de
la web. La pasada con la 523 dentro está corriendo.

**Queda pendiente**: la consulta de «Buscar» filtra por `rarity` (la columna
gruesa) porque sus chips salen del mapa de TCGdex. Mientras se rellene,
pulsar «Rara Híper» ahí seguirá trayendo las arcoíris, rotuladas bien. Para
cerrarlo hace falta que el filtro consulte las dos columnas con un `or`, y
eso NO se puede probar desde este contenedor (la red a Supabase está
cerrada): lo dejo escrito y no a medio hacer.

## 2026-10-04 (madrugada, 06:10) — PINGU-Claude (522 — el cuarto freno que no frenaba: si falla NUESTRA base, la petición ya está pagada)

**Hecho**: en `scrydex-relleno` el orden era «pido la página a Scrydex →
pregunto a nuestra base a qué cartas corresponde». Si nuestra base fallaba
—una caída, un cambio de política, un 42501—, el `throw` se escapaba de la
función: **el crédito ya estaba gastado**, la página NO avanzaba, y a los
cinco minutos lo mismo. Eso son **288 créditos al día** sin escribir una
sola carta, y de 5.000 al mes no queda nada en un par de días.

Es el cuarto caso de la misma familia esta noche, y el que faltaba por
cerrar: la página que falla siempre ya se saltaba a la quinta, pero **solo
si el fallo era SUYO**. Un fallo nuestro no contaba como tropiezo.

Ahora hay un solo `tropiezo(porque, codigo)` que hace lo mismo para los dos
lados: suma un fallo, lo guarda, y a la quinta salta la página y sigue. El
cuerpo de la página va envuelto en `try/catch`, así que un error de nuestra
base entra por ahí con su propio texto («Nuestra base: …») y se puede
distinguir en el panel.

La regla: **cuando una pasada gasta dinero antes de poder fallar, TODO lo
que pase después tiene que contar como intento.** Si solo cuentas los
fallos del tercero, el freno existe para la mitad de los fallos posibles.

**Rigor**: una mutación, cazada (dejar escapar el fallo de nuestra base).
Y la prueba picó primero con un fixture mal puesto: la había sembrado en
`pagina: 3`, y en el doble solo la página 1 trae datos, así que el bucle
salía por «fin del catálogo» **antes de llegar a la base** y la
comprobación no ejercitaba nada. Es la lección de siempre con otra cara:
una prueba en verde que no llega a tocar lo que dice probar.

**Ficheros**: `netlify/functions/scrydex-relleno.mjs`. En `pruebas`:
`pruebas/test-tanda-509.mjs` (una comprobación más).

**Queda pendiente**: nada en curso. Sigue sin ejecutar la migración
OPCIONAL `supabase-migration-scrydex-estado-lectura.sql` (es la política de
SELECT de `scrydex_relleno_estado`: mientras no esté, /admin → Cartas →
«¿Cómo va el relleno?» dirá «no se sabe» en vez de los números).

## 2026-10-04 (madrugada, 05:20) — PINGU-Claude (510 — el tercer freno que no frenaba)

**Hecho**: releyendo `scrydex-logos` sale **el mismo bug del freno, por
tercera vez en una noche**. Iba cada hora con un freno que pregunta «¿queda
algún set sin emparejar?», y la respuesta es **sí para siempre**: las promos
no las cuenta igual ningún catálogo, así que nunca se emparejan. O sea que
el freno no cortaba nunca — **2.160 créditos al mes de 5.000** para no
cambiar nada.

Pasa a ser **una vez al día**: 90 al mes. Los sets nuevos salen cada pocas
semanas, así que mirarlo cada hora no aportaba nada, y el emparejamiento
inicial (167 sets) ya se hizo esta noche.

La regla, que ya va por tres casos: **cuando el trabajo pendiente nunca
llega a cero, el freno no puede ser «¿queda algo?»** — tiene que ser cuántas
veces se ha intentado (el tope de barridos del relleno), o saltarlo a la
enésima (la página que falla siempre), o cada cuánto se vuelve a mirar
(esto).

**Rigor**: una mutación, cazada. Y una comprobación VIEJA de la misma prueba
se puso roja al cambiar el horario, que es exactamente lo que tenía que
hacer.

**Ficheros**: `netlify/functions/scrydex-logos.mjs`, `CLAUDE.md`. En
`pruebas`: `test-tanda-509.mjs`.

## 2026-10-04 (madrugada, 05:00) — PINGU-Claude (510 — el barrido de vacíos)

**Hecho**: barrido con Playwright de ocho pantallas buscando el patrón de
la noche: vacíos que no dicen de qué son, textos que nombran cosas que ya
no existen, y páginas sin salida. Salieron seis, y **no todos necesitaban
arreglo** —poner un botón en cada vacío habría sido su propio error—. Dos
sí, y los dos eran fallos de verdad:

· **`/aprender` tiraba el `error` de la consulta.** Destructuraba solo
  `data`, así que una consulta caída dejaba `publicadas` en undefined y la
  página decía «todavía no hay ninguna guía publicada»: un fallo nuestro
  presentado como un dato sobre el catálogo, en la página principal de
  aprender.
· **`/torneos` nombraba un botón que se esconde sin sesión.** El vacío
  decía siempre «crea el primero con el botón de arriba», y
  `btnNuevoTorneo` lleva `classList.toggle('hidden', !session)`. O sea que
  quien llega sin cuenta —y esta sección es el escaparate abierto desde la
  252— leía que pulsara algo que no está en su pantalla. Y tiraba el
  `error` igual que /aprender.

**Y una falsa alarma que conviene apuntar**: mi detector de «cajas
invisibles» marcó 2 en /torneos y 6 en /mis-partidas. Son `<img>` vacíos de
**0×0**, sin `src`. El fallo de la 441 era una imagen que OCUPA y no
dibuja; estas no ocupan nada. El detector marcaba de más.

**Rigor**: dos mutaciones. La de «no distinguir el error del vacío» salió
«sin detectar» porque la prueba nunca hacía fallar la consulta — y se
arregló **sin tocar el doble**: `__SIN_TABLAS__` ya sabía hacerlo.

**Ficheros**: `js/aprender.js`, `js/torneos/torneos.js`. En `pruebas`:
`test-tanda-252.mjs`.

## 2026-10-04 (madrugada, 04:30) — PINGU-Claude (510 — los callejones sin salida)

**Hecho**: repaso visual de las pantallas que PINGU quiere enseñar por la
mañana, con Playwright y llenando las imágenes antes de mirar (lección de
la 441). El mismo patrón tres veces y ninguna daba error:

· **El estado vacío de /mi-coleccion** mandaba a la pestaña «Añadir
  cartas», que **borró la tanda 408**. Dos años mandando a la gente a un
  sitio que no existe, en la primera pantalla que ve quien se registra.
· **El álbum** juntaba «no hay ninguna colección» con «tus filtros las
  esconden todas», y el «todavía» mentía en el segundo caso. Ahora dice
  cuántas te esconde y hay un botón que quita los filtros — todos.
· **El 404 de una carta y el de una colección** explicaban el problema y no
  ofrecían ninguna salida. Ahora llevan al catálogo.

Y dos cosas que casi se me cuelan al arreglarlo: las clases nuevas del 404
las puse primero en las de /mi-coleccion, y **ni carta.html ni
coleccion.html cargan esa hoja** (trampa de la 299, cazada antes de
subirlo); y puse DOS botones que iban al mismo sitio con rótulos distintos.

**Suite**: 225 verdes, 1 rojo — y el rojo es `test-tanda-493`, que necesita
`ffprobe` y no está instalado en este contenedor. Se queda rojo a propósito.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `carta.html`, `coleccion.html`, `css/carta.css`,
`js/cartas.js`, `SCHEMA.md`. En `pruebas`: `test-tanda-372.mjs`.

**Pendiente para PINGU al despertar**: el botón «¿Cómo va el relleno?» de
/admin → Cartas, que es lo primero que hay que mirar. Y, si quiere ver por
dónde va la pasada, ejecutar `supabase-migration-scrydex-estado-lectura.sql`
(opcional: sin ella el relleno funciona igual).

## 2026-10-04 (madrugada, 03:30) — PINGU-Claude (510 — repaso de lo que corre solo, y la décima colisión)

**Leída vuestra entrada de las 511–521 antes de tocar nada**: no hay ni un
fichero en común (vosotros /repeticiones, torneos y constructor; yo
Scrydex, rarezas y /mi-coleccion). Rebasado encima sin conflictos.

**Hecho esta madrugada**, todo del mismo tipo: releer lo que había puesto
en producción hace unas horas y que corre SOLO, buscando lo que falla sin
dar error. Salieron cinco cosas y ninguna daba error:

· **/carta estaba ROTA hora y media**: `carta.js` importaba `rarezaDeCarta`
  de `carta-nucleo.js`, que no la reexportaba. Un export que no existe no
  rompe una función, **rompe la página**. De ahí sale
  `pruebas/test-imports.mjs`, que comprueba las ~1.600 importaciones con
  nombre de los 249 módulos en UN SEGUNDO y sin navegador. Correrlo antes
  de cada push se come esta familia entera.
· **`scrydex-sets` no tenía presupuesto de tiempo**: 210 pares a ~300 ms
  son 63 s y Netlify mata a los 30, con la escritura AL FINAL — o sea
  créditos gastados y cero progreso, para siempre.
· **Una página que falla siempre bloqueaba el barrido del relleno** para
  siempre: un crédito cada cinco minutos, 288 al día.
· **Un `catch { filas = [] }`** convertía «no he podido preguntar a la
  base» en «ese set no tiene cartas».
· **La RLS de `scrydex_estado` no da error: devuelve lista vacía**, así que
  el botón «¿Cómo va el relleno?» decía «no ha corrido nunca» de algo que
  llevaba toda la noche. Hay una migración opcional para arreglarlo
  (`supabase-migration-scrydex-estado-lectura.sql`) y, mientras no esté, el
  panel dice «no se sabe» en vez de afirmarlo.

**Y tres errores de método míos**, que valen más apuntados que callados:
lancé dos suites a la vez y di unos números que no valían nada; `pkill -f`
y `pgrep -f` casaron con su propio shell (la trampa de la 312 aplicada a
procesos, DOS veces); y mi guion de empujar imprimía la colisión y empujaba
igual. Los tres tienen ya su herramienta: `herramientas/suite-si-libre.sh`
y un guion de empuje que se SALE si el remoto se ha movido.

**Suite**: la pasada limpia dio 209/16 y los 16 están resueltos salvo
`test-tanda-493`, que necesita `ffprobe` y no está instalado en este
contenedor — se queda rojo a propósito. Hay otra pasada corriendo.

**Ficheros**: `supabase-migration-scrydex-estado-lectura.sql` (NUEVO),
`netlify/functions/scrydex-sets.mjs`, `netlify/functions/scrydex-relleno.mjs`,
`js/carta-nucleo.js`, `js/rarezas-nombres.js` (NUEVO), `js/rarezas.js`,
`js/mi-coleccion.js`, `js/cartas.js`, `mi-coleccion.html`,
`admin/js/admin.js`, `CLAUDE.md`. En `pruebas`: `test-imports.mjs` (NUEVO),
`herramientas/suite-si-libre.sh` (NUEVO), y las 372, 438, 472, 507 y 509.

## AAAA-MM-DD HH:MM — QUIÉN (PINGU-Claude / IBAI-Claude)
**Hecho**: qué se ha hecho, en una o dos frases.
**Ficheros**: los tocados (los nuevos, marcados).
**En curso / pendiente**: lo que queda a medias o para el siguiente.
```

---

**OJO, CHOQUE DE NÚMEROS**: Ibai y yo usamos la 384 a la vez y con el
mismo nombre de fichero de prueba. Él llegó antes al remoto, así que lo
mío pasa a ser la **385**. La bitácora existe para que esto no pase: lo
que falló es que ninguno de los dos la releyó justo antes de numerar,
porque las dos tandas se empezaron con el repo al día.

**OJO, CHOQUE DE NÚMEROS (y van TRES)**: la 413 se usó a la vez en dos
sesiones. La otra llegó antes al remoto, así que lo mío pasa a ser la
**414**. Van 384, 394 y 413: releer la bitácora antes de numerar no basta
cuando las dos tandas empiezan con el repo al día. Lo que sí funcionaría
es mirar el REMOTO justo antes del commit, no al empezar.

**OJO, CHOQUE DE NÚMEROS (otra vez)**: Ibai y yo usamos la 394 a la vez.
Él llegó antes al remoto, así que lo mío pasa a ser la **395**. Es la
segunda vez (la primera fue con la 384): releer la bitácora justo antes
de numerar no basta cuando los dos empezamos con el repo al día.

**OJO, CHOQUE DE NÚMEROS (y van CUATRO)**: la 420 se usó a la vez en
las dos sesiones. La otra llegó antes al remoto —con la 420 Y la 421—,
así que lo mío pasa a ser la **422**. Van 384, 394, 413 y 420. Lo que
funciona no es releer la bitácora al empezar: es **mirar el remoto justo
antes del commit**, que es lo que lo cazó esta vez.

## 2026-10-04 (de madrugada, después de la 510) — PINGU-Claude (tandas 511 a 521 — diez ideas de la lista y las megas de la imagen del meta)

**Hecho**: PINGU pidió de la lista de ideas la 1, 3, 4, 5, 6, 7, 8, 9, 10 y
11, y «arreglar al exportar la imagen los sprites de las megas no salen
bien, salen los pokemons normales». Una tanda por cosa, cada una con su
prueba y su rigor (todas las mutaciones detectadas):

· **511 — las megas de la imagen del meta.** `/sprite` daba 404 a TODO en
  producción (medido desde el navegador), y el respaldo de una forma era la
  especie base. Ahora una mega prueba antes SU dibujo en PokeAPI (96 de 97
  comprobados) que la especie en Limitless; los de PokeAPI se recortan a lo
  que ocupan; y `/sprite` y `/escaneo` piden con un `user-agent` propio y
  dicen por qué fallan en `x-motivo`. **Por la mañana**: un
  `curl -I "https://pokedoc.es/sprite?n=gardevoir-mega"` dice si el 404 era
  el antibots (y si sigue, el motivo).
· **512 — reportar en un torneo con el registro de TCG Live** (idea 8):
  propone el resultado (lo confirmas tú), guarda la repetición y la deja
  adjunta a la mesa. Todo por las RPC de siempre.
· **513 — la imagen resumen para redes** (idea 3), 1080×1350, **sin
  sprites ni arte de cartas**.
· **514 — las notas y los momentos dentro del vídeo** (idea 4).
· **515 — compartir una posición del laboratorio** (idea 10): el enlace
  lleva la mesa dentro, detrás de `#pos=`.
· **516 — quién se lleva cada premio** de un torneo terminado, y «dado»
  para quien lo lleva (idea 9, con migración).
· **517 — el modo stream para OBS** (idea 5): la mesa sola, escalada,
  fondo de mesa o verde de croma, todo con el teclado, y
  `?r=…&stream&fondo=verde` para la fuente de navegador.
· **518 — importar varias partidas a la vez** (idea 6).
· **519 — tu lista entera asociada a una repetición** (idea 1):
  probabilidades reales de robar, lo que salió de tus premios y «Jugar
  desde aquí» sin «Carta sin ver».
· **520 — publicar una repetición como partida de ejemplo** de su mazo en
  /meta (idea 7, con migración), con los nombres cambiados por Rojo y Azul.
· **521 — puzles «¿Qué jugarías?»** (idea 11, con migración): la buena y la
  explicación no se pueden leer de la tabla (permiso por columnas).

El detalle de cada una, en SCHEMA.md.

**LO QUE HAY QUE EJECUTAR** en el SQL Editor (las tres se pueden repetir):
`supabase-migration-torneos-premios-entrega.sql`,
`supabase-migration-repeticiones-galeria.sql` y
`supabase-migration-repeticiones-puzles.sql` (estas dos, después de
`supabase-migration-repeticiones.sql`). Sin ellas no se rompe nada: cada
pantalla dice qué falta o no enseña la sección.

**Ficheros**: `js/torneos/sprites-pokemon.js`, `js/torneos/meta-imagen.js`,
`netlify/functions/sprite.mjs`, `netlify/functions/escaneo.mjs` (511);
`js/torneos/ronda.js`, `js/torneos/comun.js`, `css/torneos.css` (512 y
516); `js/repeticiones.js`, `repeticiones.html`, `css/repeticiones.css`,
`js/repeticiones/video.js`, `js/repeticiones/datos.js` (513, 514, 517–521);
**nuevos** `js/repeticiones/resumen-imagen.js`, `varias.js`, `lista.js`,
`anonimizar.js`; `js/constructor/laboratorio.js`, `js/constructor.js`,
`css/laboratorio.css` y **nuevo** `js/constructor/posicion-compartida.js`
(515); `js/meta-mazo.js`, `js/meta/datos.js`, `mazo-meta.html`,
`css/meta.css` (520); **nuevas** las tres migraciones. Nada de la portada
(167,8 KB). En `pruebas`: `test-tanda-511…521.mjs`, sus rigores,
`sql-premios-entrega.sql`, `sql-galeria.sql`, `sql-puzles.sql`, la 321 y
la 425 al día con la nueva cadena de las megas, y el doble: las tablas y
funciones nuevas, `__RPC_ERRORES__` para hacer fallar una función a
propósito, y `replay_puzzles` que **falla con 42501** si se le piden la
buena, la explicación o `*` — como la base, en vez de quitarlas en
silencio—; y `__SIN_COLUMNAS__` vale ya también al PEDIR una columna (antes
solo al filtrar por ella).

**La suite entera**, con todo esto encima: tres rojos eran MÍOS y están
arreglados —la **456** (un cuarto botón en la barra del laboratorio no
cabía donde cabían tres), la **310** (una transición de 0,2 s y una imagen
sin carga diferida) y la **462** (un enlace a /repeticiones en el texto de
/meta que la prueba contaba como del menú)—. Lo demás, verde, salvo la
**470** de siempre (le falta `visual/carta-real.png`). La 368, 370, 372 y
438 salieron rojas por la 510b, y con la 510g y vuestras pruebas al día
vuelven a verde (comprobado después de traerlas).

**En curso / pendiente**: nada a medias. Lo único que no se ha podido ver
desde aquí es si el 404 de `/sprite` en producción era el `user-agent`: el
arreglo de las megas no depende de eso (cae en PokeAPI), pero si `/sprite`
vuelve a contestar, los sprites salen con el estilo de Limitless.

## 2026-10-04 (madrugada) — PINGU-Claude (510 — /carta rota en producción, y la guarda que lo caza en un segundo)

**Hecho**: la suite completa cantó seis rojos y todos eran el mismo error
mío: `js/carta.js` importaba `rarezaDeCarta` de `carta-nucleo.js`, que no
la reexportaba. **Un export que no existe no rompe una función: rompe la
página entera** —es un `SyntaxError` al resolver el módulo—, así que
/carta estuvo HORA Y MEDIA en producción sin una línea de JavaScript.
Arreglado y empujado.

Y de ahí sale lo mejor de la madrugada: **`pruebas/test-imports.mjs`**, que
recorre los 249 módulos del repo y comprueba que cada una de las ~1.600
importaciones con nombre apunta a algo que de verdad se exporta. Un
segundo, sin navegador, nombrando fichero y símbolo. Comprobado que muerde.
Su parser se arregló con su propio aviso: marcó el `createClient` del
bundle de Supabase, que viene minificado y escribe `export{hn as
createClient}` a mitad de una línea de 60 KB — el roto era el parser, que
es lo que tenía que pasar.

**Otros dos arreglos del repaso a ciegas del relleno**:
· Una página que falla SIEMPRE bloqueaba el barrido para siempre: un
  crédito cada cinco minutos, 288 al día, y el catálogo parado sin que
  nadie se entere. A la quinta se salta y se deja apuntado cuál.
· Un respiro de 250 ms entre peticiones, porque la primera pasada real es a
  ciegas y 60 peticiones en doce segundos se ganan un 429.

**Y tres rojos más de la suite, resueltos**:
· **299** era mío: importar el módulo de rarezas en /admin arrastró las
  clases que PINTA, que viven en una hoja que /admin no carga (la trampa de
  la 316). Separado lo puro del pintor (`js/rarezas-nombres.js`, patrón de
  la 471). Y seguía rojo porque al explicarlo escribí el nombre de las
  clases CON SU ATRIBUTO dentro del comentario y el barrido lo encontró
  ahí: el comentario recreaba la dependencia que la mudanza quitaba.
· **472** elegía el catálogo chino, que la 509 escondió. Garantía
  actualizada, no aflojada: ahora vigila que NO se pueda llegar.
· **493** no es nuestro: necesita `ffprobe` y no está instalado en este
  contenedor. Se deja rojo a propósito.

**Un error de método, para que no se repita**: lancé una segunda suite
mientras la primera corría. Las dos escriben el mismo log y mueven el mismo
navegador, así que los «22 verdes, 0 rojos» que di no valían nada. Paradas
por PID (nunca `pkill -f`, que casa con el propio shell) y repetida una
sola, limpia.

**Sobre el `Unseen Forces Unown Collection`**: no hay que arreglarlo.
Nuestro set existe aparte y en Scrydex esos Unown viven DENTRO de Unseen
Forces con letras por número; un emparejamiento 1:1 no puede expresarlo.
Pero eso no deja el set en blanco: Scrydex no le añade nada y lo sigue
sirviendo TCGdex por la cadena de respaldo, que es lo que PINGU pidió.
Forzar el emparejamiento le metería las cartas de otro set.

**Ficheros**: `js/carta-nucleo.js`, `js/rarezas.js`,
`js/rarezas-nombres.js` (NUEVO), `admin/js/admin.js`,
`netlify/functions/scrydex-relleno.mjs`, `CLAUDE.md`, `BITACORA.md`. En
`pruebas`: `test-imports.mjs` (NUEVO), `test-tanda-472.mjs` y
`test-tanda-509.mjs`.

## 2026-10-04 (noche) — PINGU-Claude (tandas 509 y 510 — el relleno nocturno, su freno, y lo que se vio mirando la pantalla)

**Hecho**: PINGU se fue a la cama pidiendo «todas las cartas, todos los
logos, las rarezas exactas, el chino oculto» para por la mañana, y
«gástame los créditos mínimos».

**LO QUE TRABAJA SOLO** (funciones PROGRAMADAS, no botones: un botón
necesita a alguien delante):

· `scrydex-relleno`, cada 5 min — fotos, ilustrador, Pokédex, PS y rarezas
  del catálogo inglés. Su listado trae la carta COMPLETA, así que el
  catálogo son ~101 páginas y no 21.476 peticiones: lo contrario del coste
  de TCGdex.
· `scrydex-logos`, cada hora — los 43 sets que faltaban.

**EL FALLO QUE MÁS IMPORTABA DE LA NOCHE, y lo cacé releyendo lo que
acababa de subir, no probándolo**: el relleno, al acabar un barrido, volvía
a la página 1. Cada cinco minutos. **48 barridos en una noche = 4.848
créditos, con 5.000 AL MES.** Se habría comido el plan entero antes de que
PINGU se despertara. Frena por dos sitios, y hacen falta los dos: preguntar
antes si queda algo (gratis, es nuestra base) y un tope de barridos —porque
hay cartas nuestras que su catálogo no tiene, así que «quedan pendientes»
sería verdad para siempre y el primer freno no frenaría—. El tope quedó en
**UNO**: cada carta suya sale exactamente una vez en la paginación, así que
un barrido las ve todas. Coste de la noche: ~104 créditos.

**LO DEMÁS**:

· **Las rarezas exactas**: TCGdex colapsa «Rare Rainbow» en «Hyper rare» y
  Scrydex las separa. `rarity_en` guarda su inglés y `rarity` se queda en
  español. `rarezaDeCarta()` prefiere el primero, así que la pantalla gana
  precisión sola mientras se rellena. Lo que no esté en el diccionario sale
  **en inglés**: una traducción inventada es una etiqueta que miente.
· **El chino, escondido y no borrado** — se queda la fila con una marca.
  Y `MERCADOS_A_IMPORTAR` hacía dos trabajos (qué se importa y qué se
  ofrece): ahora son dos listas.
· **«¿Cómo va el relleno?»** en /admin → Cartas, que es LO PRIMERO que hay
  que mirar por la mañana: una función programada que falla lo hace en
  silencio, y la base no se puede mirar desde fuera del navegador.
· **El estado vacío de /mi-coleccion mandaba a una pestaña borrada en la
  408.** Dos años mandando a la gente a un sitio que no existe, en la
  primera pantalla que ve quien se registra. Ahora son tres botones que van.
· **`/cartas` se quedaba en blanco sin decir nada** si la consulta fallaba.
· **El orden de los sets** no tenía desempate, así que los del mismo día
  bailaban entre dos cargas.

**Ficheros**: `supabase-migration-scrydex-cartas.sql` (NUEVO, ya
ejecutada), `netlify/functions/scrydex-relleno.mjs` y `scrydex-logos.mjs`
(NUEVOS), `netlify/lib/scrydex.mjs`, `js/rarezas.js`, `js/mercados.js`,
`js/escaneo-carta.js`, `js/carta-ruta.js`, `js/mi-coleccion.js`,
`js/cartas.js`, `mi-coleccion.html`, `css/mi-coleccion.css`,
`admin/index.html`, `admin/js/admin.js`, y `image_scrydex` añadido a las
listas de columnas de diez ficheros. En `pruebas`:
`test-tanda-509.mjs` (NUEVO).

**Lo que NO he podido hacer, y conviene saberlo**: desde este contenedor la
red cierra `api.scrydex.com` **y también Supabase**, así que no he podido
probar ni una sola vez contra la API de verdad ni comprobar que el relleno
esté escribiendo. Todo está probado con dobles y escrito para fallar hacia
el lado bueno —no inserta, no pisa lo nuestro, no toca un set sin
emparejamiento verificado, y si su API falla se para y apunta dónde iba—,
pero **la primera pasada real es a ciegas**. De ahí el botón de «¿cómo va».

**En curso / pendiente**: mirar el botón por la mañana. Las rarezas que
salgan en inglés hay que añadirlas a `js/rarezas.js` con lo que de verdad
haya, no con lo que me imagine. Y sigue abierto el `Unseen Forces Unown
Collection`, que es un set nuestro que en Scrydex vive DENTRO de Unseen
Forces con letras por número: el emparejamiento 1:1 no puede expresarlo.

## 2026-10-04 — PINGU-Claude (tanda 508 — lo que enseñó la primera escritura de verdad)

**Hecho**: PINGU pasó el botón de la 507 contra producción. **167 sets
escritos**, su listado trae **224 de 224 logos y símbolos** (cero relleno), y
el ensayo en seco hizo exactamente para lo que estaba: enseñar tres cosas
mal antes de que importara. Una era mía.

· **El CERO es un valor, y `||` no lo sabe.** `card_count_official` de `mep`
  valía **0** y lo pisé con `null`. No hizo daño —se pintan igual— pero la
  regla decía «no se pisa nada nuestro». Y «faltar» no es lo mismo en un
  número que en un texto, así que ahora son dos funciones con nombre
  (`rellenarNumero`, `rellenarTexto`) y no un operador suelto por línea.
· **`ex7 → ex7` rechazado por «RR» contra «TRR»**, y el rechazo era falso:
  mismo id, mismo set (*EX Team Rocket Returns*), y cada catálogo lo abrevia
  a su manera. **Una señal que no depende del IDIOMA puede seguir
  dependiendo del FABRICANTE**: la Pokédex Nacional es canónica, un código
  de TCG Live es una convención. El código pasa a confirmar —acertó 126 de
  167— y deja de rechazar.
· **37 sin emparejar, los 37 por «ninguno suyo con esa fecha y esa cuenta»**
  — todo promos, donde los dos catálogos cuentan distinto porque no hay un
  total oficial. Y el rescate por código que metí en la 507 **no disparó ni
  una vez**, porque esos sets SÍ tienen fecha y nunca llegaban a esa rama.
  Ahora el rescate va también cuando la fecha está pero la cuenta no casa, y
  prueba primero el **id**: el propio informe enseñaba que muchos de
  nuestros ids SON los suyos. Y se puede ser generoso proponiendo porque
  **quien escribe vuelve a confirmar**: emparejar propone, verificar dispone.

**Y un par que conviene mirar a ojo**: `ex5.5 → wb1` se confirmó por un solo
solape de Pokédex, y en un set de promos eso puede ser casualidad (que los
dos número 1 sean el mismo bicho). Es reversible —está en una columna nueva
y no se ha destruido nada—, pero no me fío del todo.

**El hallazgo de la 505, ya medido**: mi contador de la 507 decía 14.105 y
**estaba mal** — preguntaba «¿`name` vale lo mismo que `name_es`?», y para
la mayoría de los Pokémon el nombre español ES el inglés. La consulta
corregida dice **1.890 sospechosas** de llevar el español en `name`, 12.215
que se llaman igual en los dos idiomas, y solo **220 ya reparadas** por la
pasada de la 335. O sea que el 8,8 % del catálogo occidental no casa con
`tcg_card_play`, ni con el resolutor de decklists, ni con la huella de las
reimpresiones, sin dar error.

**Ficheros**: `netlify/lib/scrydex.mjs` (`rellenarNumero`, `rellenarTexto`,
`rescate`, el código fuera de las señales que deciden). En `pruebas`:
`test-tanda-507.mjs` y `test-tanda-506.mjs` actualizadas —las aserciones que
cambian son justo las que `ex7` demostró falsas— con el caso real dentro.

**Rigor**: doce mutaciones. Cinco salieron «sin detectar» a la primera: dos
eran equivalentes (una fecha nunca vale 0; sus ids son únicos) y **tres eran
huecos de verdad** —no había fixture del caso CON fecha, ni de un set suyo
repartido dos veces, ni del código fuera de las señales—. Las tres cubiertas.

**Suite**: corriendo. La primera pasada dio 168 rojos y **eran todos
`ERR_CONNECTION_REFUSED`**: en este contenedor no estaba levantado el
servidor estático del 8892. Ni una regresión, pero tampoco una pasada
válida. Levantado y repetida desde cero.

**En curso / pendiente**: volver a darle al botón de los sets (debería pasar
de 167 a ~205 de 210, y `ex7` ya no se rechaza). Después, **las cartas**:
`en/cards` son 25.209 en inglés y su LISTADO trae la carta COMPLETA —imagen,
ilustrador, Pokédex, PS y la expansión entera anidada—, así que el catálogo
son ~101 páginas y no 21.476 peticiones. Es lo contrario del coste de
TCGdex, y conviene no confundirlos.

## 2026-10-04 — PINGU-Claude (tanda 507 — la PRIMERA ESCRITURA desde Scrydex: los sets)

**Hecho**: PINGU: «estamos pagando Scrydex, de algo tiene que servir.
Tráete cartas, logos, tráete todo. Empieza por el catálogo completo inglés.
Fíate del catálogo de Scrydex, y si falta algo en Scrydex cógelo de las
otras cosas». Esto es la mitad pequeña y la que se puede mirar a ojo: los
**sets** (210 filas, contra 21.476 cartas). Las cartas van en la 508.

**HAY QUE EJECUTAR `supabase-migration-scrydex.sql`** antes de que el botón
funcione. Añade tres columnas y no borra ni renombra nada. Si falta, la
función contesta un 409 diciendo cuál ejecutar.

**Por qué son columnas nuevas y no las de siempre**: `logo_path` e
`image_path` NO guardan una URL, guardan un trozo de ruta de TCGdex sin el
idioma delante (`swsh/swsh3/logo`), y quien pinta le monta alrededor el
dominio, el idioma y la extensión. Y la calidad se escribe distinto: TCGdex
pide `/high.webp` y Scrydex `/large`. Meterle una URL de Scrydex sería la
trampa de la 335 —una columna con dos trabajos— y el síntoma una imagen
rota que nadie distingue de una buena. `symbol_url`, que parecía libre
porque guarda una URL, tampoco lo está: se pinta como
`${set.symbol_url}.webp`. Así que `logo_scrydex`, `symbol_scrydex` e
`image_scrydex`, **nombradas por su fuente**, que es lo que hace imposible
confundir las formas.

**Y no se borra nada**: lo de TCGdex se queda donde está y sigue siendo el
respaldo del día que su CDN no conteste (lección de la 321). En
/mi-coleccion la cadena de dibujos pasa a ser
`[logo_scrydex, logo, logoAMano, logoIngles, symbol_scrydex, simbolo]`.

**Las tres reglas de seguridad de la función** (`scrydex-sets`):

1. **Ensayo en seco por defecto.** `escribir` solo vale si es exactamente
   `true`, y el ensayo devuelve fila a fila lo que cambiaría **con el valor
   de antes al lado**. El botón hace el ensayo, lo pinta, y pregunta antes
   de escribir. Netlify despliega esta rama en directo.
2. **Solo sets con el emparejamiento CONFIRMADO** por una señal que el
   idioma no puede engañar (tanda 506): el código del set, gratis, o la
   Pokédex de una carta, un crédito. Lo que no se confirma no se escribe.
3. **No se pisa nada nuestro.** Las columnas de Scrydex son nuevas; las
   nuestras (`release_date`, `tcg_online_code`, `card_count_official`) solo
   se rellenan si están vacías. Y la fila lleva SIEMPRE las mismas claves,
   con el valor nuestro cuando lo hay, porque PostgREST exige claves
   uniformes en una misma sentencia.

**Tres cosas que salieron escribiéndolo**:

· **El fallo silencioso de la tanda**: si un `select` de `tcg_sets` no pide
  `logo_scrydex`, se escriben 160 logos y **en pantalla no cambia nada, sin
  un solo error**. Eran SEIS `select` en cuatro ficheros (incluido el borde,
  que es la otra mitad del artículo). Lo vigila una prueba escrita contra la
  FORMA del fallo: donde se pida `logo_path`, hay que pedir los de Scrydex.
· **`emparejarSets` exigía NUESTRA fecha**, así que un set sin fecha se daba
  por perdido — y los sets sin fecha son exactamente los que la 322 encontró
  vacíos, o sea los que más falta hace rellenar. Ahora, sin fecha, queda el
  **CÓDIGO**, que es una llave mejor: corta, canónica y que no depende del
  idioma. Va solo en ese caso, así que lo que ya emparejaba sigue igual y
  esto solo rescata.
· **La guarda del relleno de la 499 es obligatoria aquí.** Su servidor
  contesta **200 con una imagen de relleno** para cualquier id, y la cadena
  de respaldo solo pasa al siguiente dibujo cuando la imagen DA ERROR — un
  relleno no da error, así que se pintaría un cuadro de «no image» en una
  colección y nadie lo distinguiría de un logo. Cada URL se mira (1.500
  bytes, gratis) antes de guardarla.

**Y una cosa de PRUEBAS que valió la pena**: el guardarraíl del relleno no
se podía probar, porque no se pueden fabricar unos bytes cuyo sha-1 empiece
por una huella dada — así que la prueba no llegaba NUNCA a la rama que tira
la URL, que es justo la que importa. La huella pasa a ser **inyectable**,
como el `fetchImpl` y el `restImpl`, y la decisión la sigue tomando
`esRelleno` de verdad.

**Ficheros**: `supabase-migration-scrydex.sql` (NUEVO),
`netlify/functions/scrydex-sets.mjs` (NUEVO), `netlify/lib/scrydex.mjs`
(`filaDeSetConScrydex`, `loQueCambia`, el rescate por código en
`emparejarSets`), `admin/index.html`, `admin/js/admin.js`,
`js/mi-coleccion.js`, `js/carta-nucleo.js`, `js/cartas.js`,
`js/coleccion.js`, `netlify/edge-functions/meta-social.js`. En `pruebas`:
`pruebas/test-tanda-507.mjs` (NUEVO).

**Portada**: 167,8 KB, sin moverse — nada de lo tocado entra en su grafo.

**Rigor**: catorce mutaciones, las catorce cazadas. Dos salieron «sin
detectar» al principio (guardar el relleno, y emparejar por código con
varios candidatos) y las dos eran huecos de verdad de la prueba, no guardas
de repuesto.

**En curso / pendiente**: ejecutar la migración y darle al botón —ensayo
primero—. Después la **508: las cartas** (`image_scrydex`), que son 21.476
y tienen más sitios que pintan la imagen, así que van en su propia tanda. Y
sigue pendiente lo de los nombres en español de la 505: la migración los
cuenta en su `select` final, y Scrydex tiene el inglés canónico de todas.

## 2026-10-04 — PINGU-Claude (tanda 506 — verificar con señales que el idioma no puede engañar)

**Hecho**: el final de la serie. La 504 verificó los emparejamientos por el
nombre de una carta y falló los OCHO rechazos; la 505 le quitó la palabra
«rechazado» porque la comparación no la sostenía y arregló once de los trece
404. Esto es lo que faltaba, y salió de **tener delante su ficha de verdad**
(`cards/sm10-1`, sondeada por PINGU) en vez de imaginármela:

```
"artist": "Mitsuhiro Arita",
"national_pokedex_numbers": [794, 795],
"hp": "260",
"expansion": { "id": "sm10", "code": "UNB", "total": 238, … }
```

Cuatro señales que el idioma no puede engañar. **Y la mejor no era la que yo
iba buscando** —el ilustrador—: es `expansion.code`, «UNB», que es nuestro
`tcg_online_code`. Va sobre el SET, que es justo lo que se verifica, y viene
gratis en la petición que ya hacíamos.

Van en dos clases: **deciden** (confirman y rechazan) el código del set y
los números de Pokédex; **confirman solo** el ilustrador —los catálogos lo
acreditan al revés—, los PS —cientos de cartas comparten 260— y el nombre.
El caso que costó dos tandas, `sm10 → sm10` con nuestra carta «Pheromosa y
Buzzwole GX» contra su «Pheromosa & Buzzwole-GX», ahora se CONFIRMA por el
código, con el nombre en español y todo.

**Tres cosas más que salieron del rigor y valen más que la tanda**:

· **Dos guardas que se cubren una a otra no se pueden observar ninguna** —la
  de la 314 en su forma pura—. La regla «el nombre no rechaza» estaba
  escrita dos veces (la señal devolvía «muda» cuando discrepaba, Y la
  política solo miraba las que deciden), así que TRES mutaciones seguidas
  salieron «sin detectar». Ahora cada señal dice lo que ve y decide UNO, con
  un solo interruptor. Las tres se cazan.
· **Una guarda que solo se prueba cuando NO salta no se está probando**:
  comprobaba que la cuenta cuadra en el caso bueno y nunca montaba uno malo,
  así que `cuadra = true` a pelo pasaba desapercibido. La saqué a
  `cuentaDelInforme` para llamarla con los números de la pasada mala.
· **La cuarta forma del id**: de los dos 404 que quedaban, uno era `cel25c`
  con nuestra `CC001` — se probaban «CC001» y «cc1», y la suya es **«CC1»**,
  sin los ceros pero CON las mayúsculas. `numeroComparable` quitaba las dos
  cosas de golpe.

**Y el agujero que la pasada de la 505 enseñó sin querer**: el panel dijo
«160 confirmados + 2 sin comprobar» de 171. Faltaban NUEVE, y ningún error.
El navegador tenía el panel viejo en CACHÉ y leía un campo que la respuesta
ya no traía, así que una casilla entera se perdió en silencio con unos
números que parecían buenos. Desde ahora la respuesta trae `cuadraLaCuenta`
y el panel lo canta.

**Ficheros**: `netlify/lib/scrydex.mjs` (`senalesDelPar`, `veredictoDelPar`,
`cuentaDelInforme`, cuarta forma en `formasDeId`),
`netlify/functions/scrydex-verificar.mjs`, `admin/js/admin.js`, `CLAUDE.md`,
`SCHEMA.md`. En la rama `pruebas`: `pruebas/test-tanda-506.mjs` (NUEVO),
`pruebas/fixtures/scrydex-cards-sm10-1.json` (NUEVO — su respuesta real,
byte por byte, norma de la 501) y las de la 504 y 505 estrechadas: la de la
505 ya no pide «cero rechazos» sino «el nombre no rechaza NADA», que es lo
que de verdad enseñó.

**Rigor**: once mutaciones. Las tres que salían «sin detectar» eran el
problema de las guardas de repuesto, y se cazan desde el rediseño.

**En curso / pendiente**: pasar la pasada otra vez **con el panel recargado
a lo bruto** (Ctrl+Shift+R), que es lo que faltó la vez anterior. Queda
contar cuántas cartas occidentales tienen el español en `tcg_cards.name` —el
hallazgo de la 505, que por la norma de las 334/335 rompe el cruce de
`tcg_card_play`, el resolutor de decklists y la huella de las reimpresiones
sin dar error—, y el `30th-c → me55c` que sigue en 404 por las cuatro
formas.

## 2026-10-04 — PINGU-Claude (tanda 505 — los ocho «rechazados» de la 504 eran falsos)

**Hecho**: PINGU pasó el verificador de la 504 contra los 171 pares reales:
150 confirmados, **8 rechazados**, 13 en 404. Y los ocho rechazos eran
FALSOS, los ocho por el mismo motivo. Nuestro `name` del catálogo
occidental está en ESPAÑOL en parte de las filas —«Pinsir de Eco» es
*Ethan's Pinsir*, «Oddish de Erika» es *Erika's Oddish*, «Energía Planta»
es *Basic Grass Energy*— y el de Scrydex en inglés. **Seis de los ocho
tenían el id IDÉNTICO** (`sm10 → sm10`, `sv10 → sv10`, `sm12 → sm12`,
`sm11 → sm11`, `sve → sve`, `me02.5 → me2pt5`): eran el mismo set con toda
seguridad.

Escribí la guarda del alfabeto en la 504 y no vi el caso de al lado: esto
no es otro alfabeto, es el **MISMO alfabeto en otro IDIOMA**. `TIENE_CJK`
no salta con el español, así que la discrepancia salía rotulada como un
rechazo con toda la confianza del mundo.

**Lo que cambia**:

· El veredicto se llama **«discrepan»** y no «rechazado». Un nombre que
  COINCIDE confirma; uno que no coincide no concluye nada mientras nuestro
  `name` pueda estar traducido.
· Y para saber de quién es la culpa, una prueba **LOCAL y gratis** en vez de
  mirar más las dos cadenas: la migración de la 335 copió el español a
  `name_es`, así que si `name` vale lo mismo que `name_es` el español está
  metido en `name` y la culpa es NUESTRA (`culpaDeLaDiscrepancia`). El
  informe lo separa: «por mirar a mano» son solo los que NO se pueden
  explicar así, y los demás se cuentan aparte como fallo nuestro.
· Los **trece 404** eran todos de la misma forma: ellos guardan el número
  TAL COMO ESTÁ IMPRESO (`TG01`, `XY01`, `SWSH001`) y mi normalización lo
  estropeaba. `formasDeId` prueba la literal primero y la normalizada
  después — el «001»→«1» del japonés sigue hecho falta y sigue ahí.

**Y un hallazgo que NO es del verificador y es más gordo**: hay cartas
occidentales con el español metido en `tcg_cards.name`. Según la norma de
las tandas 334/335 ese nombre es la CLAVE con la que se cruzan
`tcg_card_play`, el respaldo del resolutor de decklists y la huella de las
reimpresiones — así que esas cartas no casan con nada, **sin dar error**. La
reparación de la 335 criba por `name_es=not.is.null`, así que una fila con
el español en `name` y `name_es` a null no la arregla nunca. Hay que
contarlas antes de decidir qué se hace: la pasada nueva ya las cuenta.

**Ficheros**: `netlify/lib/scrydex.mjs` (`formasDeId`,
`culpaDeLaDiscrepancia`, `verificarPar` ahora dice «discrepan»),
`netlify/functions/scrydex-verificar.mjs`, `admin/js/admin.js`, `CLAUDE.md`,
`SCHEMA.md`. En la rama `pruebas`: `pruebas/test-tanda-505.mjs` (NUEVO) y
`test-tanda-504.mjs` actualizado al vocabulario nuevo — las dos
afirmaciones que cambié eran justo las equivocadas, no se ha aflojado nada.

**Rigor**: siete mutaciones, las siete cazadas. La séptima no se cazaba al
principio porque **mi doble devolvía `name_es` aunque no se pidiera**, o sea
más generoso que PostgREST (lección de la 437). Ahora el doble respeta el
`select=`.

**En curso / pendiente**: me falta UNA cosa de Scrydex para que un rechazo
pueda ser un rechazo de verdad: el nombre del campo del ILUSTRADOR en su
ficha de carta, que es un nombre propio y vale igual en todos los idiomas.
No me lo invento (norma de la 501): hace falta un sondeo a pelo de
`cards/sm10-1`. Y pendiente contar cuántas cartas occidentales tienen el
español en `name`.

## 2026-10-04 — PINGU-Claude (tanda 504 — verificar los emparejamientos antes de escribir nada)

**Hecho**: la 503 contestó la pregunta que había —«¿tiene Scrydex las fotos
que nos faltan?»— con un sí rotundo: 16/16 logos, 40/40 escaneos, cero
relleno. Pero entre sus 171 pares salió **`ex5.5 → wb1`**, y no es el mismo
set: comparten fecha y cuenta de cartas, no había un segundo candidato, la
regla los casó con confianza, y como en `wb1-logo` hay un logo DE VERDAD
aquella sonda lo contó como acierto. Para decidir si pagar, eso daba igual.
Para ESCRIBIR no, porque un par falso mete el logo y las cartas de otro set
dentro del nuestro **sin dar ningún error**. Así que antes de escribir nada
se comprueba par a par con el NOMBRE de una carta: se coge la carta nuestra
de número más bajo de ese set, se pide su gemela a Scrydex y se comparan los
dos nombres. `netlify/functions/scrydex-verificar` (POST, solo admin) **no
escribe nada**: dice qué pares están confirmados, cuáles hay que tirar y
cuáles no se han podido comprobar. Botón en /admin → Cartas, y va solo de
pasada en pasada hasta acabar con los 171.

**Cuatro cosas que se aprendieron escribiéndolo**, y las cuatro son fallos
que no dan error:

· **La trampa de la 483, otra vez: el ALFABETO.** `clave()` tira todo lo que
  no es a-z0-9, así que 「フシギダネ」 se queda en NADA. Comparar un nombre
  japonés con uno inglés no da «distinto», da una comparación que no existe
  — y el caso MIXTO es el peligroso: 「ピカチュウV」 deja «v» y «Pikachu V» deja
  «pikachuv», o sea un RECHAZO INVENTADO POR EL ALFABETO que habría tirado
  un par bueno. Si los dos nombres no están en el mismo alfabeto, el
  veredicto es «no se puede» y se dice por qué.
· **Un 404 NO es un rechazo.** Puede ser que esa carta nuestra no exista en
  su set, o que su id no se monte como creemos. Contarlo como rechazo
  tiraría un emparejamiento BUENO por un fallo nuestro.
· **`order=local_id.asc` es un orden de TEXTO**, así que «10» va antes que
  «2» y la primera fila no es la carta 1. Se piden unas pocas y se elige la
  de número más bajo de verdad.
· **Una consulta con `limit` global miente sobre el catálogo.** Con 60 sets
  por pasada y un `limit=4000`, los últimos sets se quedaban fuera por
  truncado y el informe decía «no tenemos ninguna carta de ese set» de sets
  llenos de cartas: un fallo de la consulta leído como un dato. Se piden set
  a set.

Y **`desde`**, que no es un detalle: sin él, «quedan 111 por verificar» es un
número que no lleva a ninguna parte — quien lo lee no tiene forma de pedir
los siguientes, así que esos 111 no se verifican nunca.

**Ficheros**: `netlify/functions/scrydex-verificar.mjs` (NUEVO),
`netlify/lib/scrydex.mjs` (`verificarPar`, `laCarta`), `admin/index.html`,
`admin/js/admin.js`, `SCHEMA.md`. En la rama `pruebas`:
`pruebas/test-tanda-504.mjs` (NUEVO, 40 comprobaciones, verde).

**Rigor**: siete mutaciones a mano, las siete cazadas — quitar la guarda del
alfabeto, `laCarta` sin el caso objeto, contar un 404 como rechazo, coger la
primera fila en vez de la de número más bajo, ignorar `desde`, pedir las
cartas con un `in.()` global, y confirmar siempre.

**En curso / pendiente**: que PINGU le dé al botón — hasta que no sepamos
cuáles de los 171 pares son de verdad, **no se escribe ni un logo ni una
foto**. Sigue pendiente migrar `generate-course.mjs` y `telegram-mandar.mjs`
a `netlify/lib/admin.mjs`, y preguntarle a Scrydex por escrito si bajar el
catálogo entero cae dentro de su prohibición de «substitute backend, proxy,
or wholesale data source».

## 2026-10-04 — PINGU-Claude (tanda 503 — la sonda que mide si Scrydex tapa el hueco del inglés)

**Hecho**: la medición que decide si los 29 $ valen la pena. Es la mitad del
motivo para pagar y lo único que la evaluación de Cowork no midió: ellos
midieron el japonés carta a carta y del inglés solo contaron expansiones.
Nuestros huecos occidentales: **1.351 cartas sin foto** de 21.476 y **63
sets sin logo** de 210.

**Cuesta TRES créditos y no trescientos**, y ése es el hallazgo: su URL de
imagen es DERIVABLE (`images.scrydex.com/pokemon/<expansión>-<número>/…`) y
**las imágenes no gastan créditos**. A la API solo se le pide su lista de
expansiones inglesas (224, de cien en cien). Lo demás se mide gratis — y es
además la pregunta correcta: «¿lo lista su API?» y «¿existe el escaneo?»
son dos cosas distintas, como enseñó TCGdex callándose 3.579 ficheros que
sí estaban.

**Lo que la haría mentir**: su servidor contesta 200 con una imagen de
RELLENO para cualquier id inexistente, así que sin comparar la huella la
sonda diría «el 100 %» mire lo que mire. Se bajan solo los primeros 1.500
bytes con un `Range` —si no serían quince mil imágenes enteras para
comparar mil quinientos bytes— y se comparan con la del relleno.

**Tres cosas que hacen que el número signifique algo**: (1) es un SUELO y
se dice, porque un id derivado que no acierte cuenta como «no la tienen»;
(2) «sin emparejar» es un fallo NUESTRO y NO entra en la cuenta, que si no
un fallo de emparejamiento se leería como que a Scrydex le falta catálogo;
(3) si su API se cae no se concluye nada, porque un 0 % por un 500
parecería un veredicto sobre su catálogo.

**Ficheros**: `netlify/functions/scrydex-ingles.mjs` (NUEVO),
`netlify/lib/scrydex.mjs`, `admin/index.html`, `admin/js/admin.js`,
`SCHEMA.md`, `BITACORA.md`. En la rama `pruebas`:
`pruebas/test-tanda-503.mjs` (NUEVO).

**Prueba**: 33 comprobaciones. Una de ellas era un `check('…', true)` —un
aprobado regalado, justo lo que esta casa castiga— y se ha cambiado por una
que mira de verdad que cada imagen se pide con `Range: bytes=0-1499`.

**En curso / pendiente**: (1) **PINGU: pulsa «¿Tapa Scrydex el hueco del
inglés?» en /admin → Cartas** y pásame el cuadro. Eso decide si se hace el
relleno occidental o solo el japonés. (2) Migrar `generate-course` y
`telegram-mandar` a `netlify/lib/admin.mjs`. (3) Preguntarles lo de
«wholesale data source». (4) No quitar chino ni taiwanés sin mirar el dato.

## 2026-10-04 — PINGU-Claude (tanda 502 — sus cartas: el regalo y la trampa)

**Hecho**: segunda sonda (`cards?page_size=1`, 47.481 cartas en total) y
con la respuesta real delante salen una trampa y un regalo.

**LA TRAMPA, el número.** Su `number` es `"58"`; nuestro `local_id` sale tal
cual de TCGdex, que en japonés escribe `"001"`. Cruzar por ahí a pelo
dejaría el set emparejado, las cartas dentro y **NI UNA casando**, sin un
solo error. `numeroComparable` quita los ceros de delante de cada tramo de
dígitos (`001`→`1`, `TG01`→`tg1`) solo para COMPARAR: lo que se guarda
sigue siendo el original, que es lo que está impreso en la carta. Con dos
cuidados: `000` se queda en `0` y no en vacío —confundirlos casaría
cualquier carta sin número— y `1` y `10` siguen siendo distintas.

**EL REGALO, `national_pokedex_numbers`.** Es nuestro `dex_ids`: el que la
483 tuvo que ir a buscar carta a carta con una función programada para que
la Pokédex japonesa no saliera vacía. Aquí viene de serie en cada carta.

**Lo demás**: `artist`→`illustrator`, `rarity`→`rarity`,
`supertype`→`category` (viene CON TILDE, «Pokémon», y la nuestra es la
canónica inglesa porque es con la que se cruza, 334 y 335). `images` es una
LISTA de objetos con `type`: se coge la de `type:"front"` y no la primera,
porque que hoy la primera sea la cara no quiere decir que mañana no venga
antes un reverso. Y solo `https://`.

**Y dos cosas que simplifican el relleno**: la expansión viene ENTERA
dentro de cada carta (no hacen falta dos pasadas) y el id de una carta es
`<expansión>-<número>`, así que emparejado el set las cartas se piden sin
adivinar nada.

**Ficheros**: `netlify/lib/scrydex.mjs`, `SCHEMA.md`, `BITACORA.md`. En la
rama `pruebas`: `pruebas/test-tanda-502.mjs` (NUEVO).

**Prueba**: 30 comprobaciones con su respuesta pegada byte por byte.
Mutada: sin normalizar el número caen 5, y cogiendo la imagen por posición
en vez de por tipo caen 2.

**En curso / pendiente**: (1) **MEDIR EL INGLÉS**, que es lo que decide si
los 29 $ valen: 1.351 escaneos y 63 logos. Hace falta una sonda que compare
nuestros huecos contra ellos, no una carta suelta. (2) Migrar
`generate-course` y `telegram-mandar` a `netlify/lib/admin.mjs`. (3)
Preguntarles lo de «wholesale data source». (4) No quitar chino ni taiwanés
sin mirar el dato.

## 2026-10-04 — PINGU-Claude (tanda 501 — su fecha viene con barras, y mi fixture se lo había inventado)

**Hecho**: PINGU pulsó la sonda de la 500 y la primera respuesta real de
Scrydex trajo un fallo que habría tumbado la integración entera.

**Su fecha viene CON BARRAS** (`"release_date":"2026/09/16"`). Mi
`huellaDeSet` validaba `/^\d{4}-\d{2}-\d{2}/` —como la escribe Postgres, que
es como la escribí yo en el fixture—, así que **todos** sus sets habrían
salido con `fecha: null`, y como el emparejamiento casa por fecha **no
habría casado NI UNO**: los 224 como «sueltos», sin un solo error.

Y la prueba estaba EN VERDE, porque el fixture lo había escrito yo **antes
de ver una respuesta**. Esa es la lección y va a `CLAUDE.md`: **un fixture
que te inventas prueba tu imaginación, no la API.** Ahora la respuesta real
está dentro de la prueba pegada byte por byte, y mutar el validador para
que vuelva a exigir guiones tira 8 comprobaciones.

**El regalo**: traen `"code":"30C"`, que es el código corto del set y lo que
nosotros guardamos en `tcg_online_code`. Es la señal más fuerte que tienen
—un identificador, no una cadena que se PAREZCA— y ahora desempata antes
que el nombre. Pero no se empareja solo por él: el nuestro está vacío en los
sets viejos (viene del set completo de TCGdex, y de 2023 para atrás ni
existe, la 345).

**Sus campos**: `release_date` (barras) · `printed_total` → nuestro
`card_count_official`, el impreso sin secretas y **puede ser null** ·
`total` → `card_count_total` · `code` → `tcg_online_code` · `logo` y
`symbol`, **sin extensión** en la URL. Y **224 expansiones inglesas** contra
nuestras 210.

**Ficheros**: `netlify/lib/scrydex.mjs`, `CLAUDE.md`, `SCHEMA.md`,
`BITACORA.md`. En la rama `pruebas`: `pruebas/test-tanda-499.mjs` (ampliada
con la respuesta real).

**En curso / pendiente**: (1) **PINGU: pulsa la sonda con la opción 3** («Una
carta cualquiera»), que falta ver cómo son sus CARTAS — sobre todo cómo
viene la imagen y el número dentro del set. (2) Y después **medir el
inglés**: 1.351 escaneos y 63 logos. (3) Migrar `generate-course` y
`telegram-mandar` a `netlify/lib/admin.mjs`. (4) Preguntarles por escrito lo
de «wholesale data source». (5) No quitar chino ni taiwanés sin mirar el
dato.

## 2026-10-04 — PINGU-Claude (tanda 500 — la sonda de Scrydex, y la guarda de admin en un sitio)

**Hecho**: PINGU ya tiene `SCRYDEX_API_KEY` y `SCRYDEX_TEAM_ID` en Netlify
(su documentación pide LAS DOS cabeceras, `X-Api-Key` y `X-Team-ID`). Esto
es con qué preguntarle sin romper nada.

**Un detalle de sus docs que decide el diseño**: una petición SIN
autenticar **no falla**, pasa «con el límite de peticiones muy reducido».
Olvidar una variable no daría un error que cante, daría una API que parece
ir mal. Por eso `cabecerasDe` exige las dos y no sale de casa si falta
alguna, diciendo cuál por su NOMBRE (nunca su valor).

**Por qué una función de servidor y no JS de /admin**: la clave estaría en
el navegador, y **una clave en el JS de una página es una clave
publicada**. El panel solo pide el resultado, con la sesión de admin.

**Las dos formas caras de que salga mal, y sus guardas**:

1. **Que cualquiera gaste los créditos.** Una función de Netlify es una URL
   pública; con 5.000 créditos al mes eso se agota en una tarde. Guarda de
   admin, como `generate-course`.
2. **Que nuestras claves salgan a otro servidor.** A la petición se le
   enganchan las dos, así que una `ruta` sin acotar las mandaría adonde
   diga quien llame. Que solo llame un admin REDUCE el riesgo, no lo quita.
   Ruta validada y parámetros por `URLSearchParams`; ocho rutas maliciosas
   en la prueba. Y lo que devuelve no lleva las claves.

**Y la guarda de admin, por fin en un sitio**: había DOS copias y ya habían
DIVERGIDO (`requireAdminUserId` devuelve el id y no acepta `fetchImpl`;
`esAdmin` devuelve booleano y sí). La de Scrydex habría sido la tercera —la
norma de la 471—. Ahora vive en `netlify/lib/admin.mjs` con prueba, y
lleva una decisión que merece su línea: **un corte de red NO es un
permiso**, porque lo contrario convierte una caída de Supabase en barra
libre con nuestra clave de pago.

**Ficheros**: `netlify/lib/admin.mjs` (NUEVO),
`netlify/functions/scrydex-sonda.mjs` (NUEVO), `netlify/lib/scrydex.mjs`,
`admin/index.html`, `admin/js/admin.js`, `SCHEMA.md`, `BITACORA.md`. En la
rama `pruebas`: `pruebas/test-tanda-500.mjs` (NUEVO).

**Prueba**: 50 comprobaciones en verde. Mutada por los dos caminos de
seguridad: si la ruta deja de validarse caen 9, y si un corte de red cuenta
como permiso cae 1.

**En curso / pendiente**: (1) **PINGU: pulsa «Preguntar a Scrydex» en
/admin → Cartas** (opción 1, expansiones inglesas) y pásame el cuadro: hace
falta para saber cómo se llaman sus campos antes de emparejar nada. (2)
**Lo primero que hay que MEDIR es el inglés** —1.351 escaneos y 63 logos—,
que es la mitad del motivo de pagar y lo único que la evaluación de Cowork
no midió. (3) **Migrar `generate-course` y `telegram-mandar`** a
`netlify/lib/admin.mjs`: no se ha hecho aquí porque son camino de seguridad
en producción y ninguna prueba los cubría. (4) Preguntar a Scrydex por
escrito si bajarse el catálogo entero cae en su cláusula de «wholesale data
source». (5) No quitar chino ni taiwanés del selector sin mirar antes
cuántas personas tienen colección ahí.

## 2026-10-04 — PINGU-Claude (tanda 499 — Scrydex: el emparejamiento y la imagen de relleno)

**Hecho**: PINGU paga el **Starter de Scrydex (29 $)** para tapar lo que
TCGdex no tiene. Esto es la primera piedra: lo PURO, que es lo que se puede
escribir y probar **sin la clave y sin red**.

**Lo que se va a tapar**: 11.712 escaneos asiáticos, 340 logos de 341, 68
sets JP enteros, y —sin medir todavía— **1.351 escaneos y 63 logos
OCCIDENTALES**. Scrydex declara 231 expansiones japonesas con 99,9 % de
escaneos reales y 189 logos de 231. **No tiene chino ni coreano**, y sus
precios son dólares y yenes: los precios se quedan en Cardmarket vía
TCGdex y de Scrydex solo se coge catálogo e imágenes.

**El coste real no es el que parecía**: un crédito es una PETICIÓN, no una
carta, y `page_size` es 100 — el catálogo entero EN+JA son **~450
créditos**, y las imágenes no gastan. Sin refresco de precios, **Starter un
mes o dos y cancelar**.

**Por qué no se empareja por identificador**: el suyo no se deriva del
nuestro. `SM1M-001`→`sm1m_ja-1`, `M4-001`→`m4_ja-1`,
`SM12a-001`→`sm12a_ja-1`… pero **`S8b-001`→`swsh8b_ja-1`**, porque la era
Espada y Escudo la nombran con el prefijo INGLÉS donde TCGdex usa el
japonés. «Minúsculas + _ja» acierta en tres de cuatro: **la peor clase de
regla, la que funciona lo bastante para que te la creas.**

`emparejarSets` casa por HECHOS —fecha de salida y cuenta de cartas—, que
no dependen de cómo llame nadie a las cosas. La fecha sola no basta (en
Japón salen tres o cuatro sets el mismo día) y la cuenta sola tampoco (hay
decenas de sets de 30). El nombre SOLO desempata. Devuelve `pares`,
`ambiguos` —dos candidatos indistinguibles: **no se elige**, porque elegir
aquí escribe el escaneo de otro set encima del bueno sin dar error— y
`sueltos` con su porqué.

**Y la trampa gorda: su servidor de imágenes devuelve 200 CON UNA IMAGEN DE
RELLENO para cualquier id inexistente.** Un HEAD no prueba nada. Sin la
guarda, el relleno entra en la base como un escaneo bueno y la pantalla
sale con la misma imagen gris quince mil veces **sin un solo error**. Lo
cazó COWORK comparando el SHA-1 de los primeros 1.500 bytes. `esRelleno`
compara por prefijo y **sin huella no da nada por bueno**.

**Ficheros**: `netlify/lib/scrydex.mjs` (NUEVO), `SCHEMA.md`, `BITACORA.md`.
En la rama `pruebas`: `pruebas/test-tanda-499.mjs` (NUEVO).

**Prueba**: 38 comprobaciones en verde, con los cuatro sets de control
reales dentro. Mutada por los dos lados que fallarían en silencio: si el
relleno deja de detectarse caen 4, y si se casa solo por fecha caen 2.

**En curso / pendiente**: (1) **Hacen falta dos datos de su documentación
que NO se pueden adivinar**: la cabecera de autenticación y la forma de los
endpoints. (2) **Lo primero con la clave es MEDIR EL INGLÉS** —1.351
escaneos y 63 logos—, que es la mitad del motivo de pagar y lo único que la
evaluación de COWORK no midió. (3) La clave va en una variable de entorno
de Netlify (`SCRYDEX_API_KEY`), **nunca en el repo**: una clave en el JS
del navegador es una clave publicada, así que la sonda tiene que ser una
función de servidor y /admin llamarla. (4) Preguntarles por escrito si
bajarse el catálogo entero cae en su cláusula de «wholesale data source».
(5) Chino y taiwanés: **no quitarlos** del selector sin mirar antes cuántas
personas tienen colección ahí — mantenerlos no cuesta nada y quitarlos deja
cartas huérfanas.

## 2026-10-03 — PINGU-Claude (tandas 494 a 497 — mazos, Mis partidas, notas, torneos y «Jugar desde aquí» en /repeticiones)

Lo que quedaba de la lista de ideas que PINGU aprobó. **Hay que ejecutar
OTRA VEZ `supabase-migration-repeticiones.sql`** (es idempotente): sin ella
la página funciona igual que antes, y lo nuevo que pide la base lo dice
(y /admin lo avisa por `js/schema-check.js`).

**494 — los mazos de una repetición, y guardarla la apunta en Mis
partidas.** `js/repeticiones/mazos.js` (nuevo, sin DOM): lo que se vio de
cada mazo, contado como el MÁXIMO de copias a la vez (en juego, descarte,
mano conocida, estadio, la mano del mulligan), que es lo único que no cuenta
dos veces una carta que va y vuelve. El arquetipo con `arquetipoDeMazo` de
los torneos, **cruzado por el nombre INGLÉS** del catálogo: con el del
registro («Zoroark ex de N») no casaba con nada — lo cazó la prueba. En la
página: el mazo al lado de cada jugador, el bloque «Los mazos, por lo que
se vio» con «Abrir en el constructor (N cartas)» (el constructor le pone el
nombre y avisa de que es lo VISTO, no la lista), y el mazo de cada uno en
«Tus repeticiones» (`mazo_a`/`mazo_b`, que pone la función de guardar).
Al guardar: «¿Cuál de los dos eres tú?» (se recuerda tu nombre de TCG
Live) y «Apuntarla en Mis partidas como ganada/perdida: X contra Y», con
las MISMAS claves que una partida de torneo y su `replay_id`; un índice
único impide apuntarla dos veces, y /mis-partidas enseña «Ver la
repetición». Un registro cortado no ofrece apuntarla (no se sabe quién
ganó).

**495 — las notas del dueño.** Ancladas a la LÍNEA del registro (`fila`,
que cada evento lleva desde ahora), no al número de jugada, que cambia el
día que el lector aprende una línea más. Salen al llegar a su jugada
(dentro de los controles, que en el móvil van pegados abajo), en la tira
de momentos y como marca; reproduciendo, la jugada se queda lo que se
tarda en leer la nota, también a 4×. Las lee quien abre la compartida; las
escribe solo el dueño (en una pegada, el botón lleva a guardarla). La base
solo acepta notas bien formadas (`replays_notas_validas`).

**496 — la repetición de una partida de torneo.** `tournament_match_replays`
(hasta tres por jugador y mesa: un BO3) y dos funciones; nadie escribe en
la tabla (tanda 252). La ven los dos jugadores, quien lleva el torneo y un
juez aprobado; adjuntar la comparte. En la ficha, bajo tu mesa, un
desplegable con tus guardadas (las de contra tu rival, primero); los demás
ven «Repetición de X»; «Quitar» solo en la tuya. Se piden con los
reportes, solo para quien juega, lleva o arbitra.

**497 — «Jugar desde aquí».** `js/repeticiones/posicion.js` (nuevo, sin DOM
ni motor) sienta una Mesa del laboratorio en la jugada que se mira: mazos de
lo visto completados con «Carta sin ver», cada carta en su sitio (las
cuentas cuadran con la repetición en TODAS las jugadas de los dos registros
de prueba), lo que el turno ya gastó gastado, lo que entró este turno sin
poder evolucionar, y los premios de un KO que el registro aún no ha cobrado
como pendientes (la mesa los cobra al abrirse). `abrirLaboratorioEnPosicion`
en el laboratorio, que no sabe leer registros: solo juega.

**Pruebas** (rama `pruebas`): `test-tanda-494.mjs` (48), `test-tanda-495.mjs`
(31), `test-tanda-496.mjs` (28), `test-tanda-497.mjs` (38);
`sql-repeticiones.sql` ampliada (65 comprobaciones contra PostgreSQL, y
ahora limpia también las funciones nuevas al empezar: una base de pruebas
con una versión vieja daba un rojo del contenedor, que fue el de la 480);
el doble de Supabase con la tabla de los torneos, las dos funciones, el
índice único de Mis partidas y los mazos y notas de `replays`.
**Rigores**: 13/13, 8/8, 8/8 y 11/11. La primera pasada dejó cuatro sin
detectar y las cuatro eran agujeros de la PRUEBA: ninguna mesa pendiente
con un jugador logueado, ningún «adjuntar otra» con una ya puesta, un ancla
repetida (adjuntar y quitar mandaban el mismo objeto) y ninguna energía
unida por un efecto ANTES de la de la mano en el mismo turno. Las cuatro,
añadidas.

**Suite entera** (las 216, con las cuatro nuevas): 214 en verde a la
primera, la 470 (la conocida) y la 480, que miraba la FORMA de una consulta
(`.select(COLUMNAS_LISTA)`) y desde ahora va en una función que se repite
sin los mazos si la base tiene la migración de antes. Cambiada para mirar
lo que importaba, que es el filtro por ti; en verde.

**Ficheros**: `js/repeticiones/mazos.js` y `js/repeticiones/posicion.js`
(nuevos), `js/repeticiones.js`, `js/repeticiones/datos.js`,
`js/repeticiones/registro.js`, `js/repeticiones/iconos.js`,
`repeticiones.html`, `css/repeticiones.css`, `js/constructor.js`,
`js/constructor/laboratorio.js`, `js/mis-partidas.js`,
`js/torneos/ronda.js`, `css/torneos.css`, `js/schema-check.js`,
`supabase-migration-repeticiones.sql`, `SCHEMA.md`. Rama `pruebas`: las
cuatro pruebas, sus rigores, `sql-repeticiones.sql`, `test-tanda-480.mjs`
(el permiso por columnas incluye ya las notas) y
`herramientas/stub-supabase.js`.

**En curso / pendiente**: que un humano ejecute la migración. Las notas no
salen en el vídeo (se podría: un rótulo en la jugada). Un mazo de lo visto
es un mínimo: «Jugar desde aquí» rellena el resto con «Carta sin ver», que
es honesto pero hace que robar una de esas no diga nada.

## 2026-10-03 — PINGU-Claude (tandas 492 y 493 — los momentos, los números y el vídeo vertical de /repeticiones)

**Choque de números, el noveno (y doble)**: las tenía como 490 y 491, y la
otra sesión subió SU 490 y SU 491 (hacer sitio en la portada, la hoja del
artículo) mientras corría mi suite. Pasan a **492** y **493**. No tocamos
ficheros en común: lo suyo es `components.css`, `perfil.css`, `guia.css`
y el barrido de la 299; lo mío, /repeticiones. Después de traerme lo suyo
he vuelto a pasar la 299 (con su barrido ya arreglado, que ahora ve las
clases con `${…}`), la 492 y la 493: en verde.

**Hecho, 492 — los momentos clave y la partida en números** (de la lista de
ideas que pidió PINGU): `js/repeticiones/numeros.js` (nuevo, sin DOM) saca
los MOMENTOS —cada KO con el golpe que lo causó y los premios, los golpes
de 200 o más que no tumban, y el final— y los NÚMEROS de cada uno: daño
hecho (ataques, contadores y el segundo golpe), el golpe más fuerte, KO
(también los que el registro no escribe y la mesa deduce de la vida),
premios, robadas, entrenadores jugados (usar el estadio no cuenta como
jugarlo), energías, evoluciones y retiradas. En la página: marcas en el
deslizador (caen debajo del pulgar al píxel: la cuenta es la del medio
pulgar), una tira de momentos que se pulsa y un «Siguiente KO»; y «La
partida en números» con la tabla, la CARRERA DE PREMIOS turno a turno
(`js/repeticiones/carrera.js`, nuevo: SVG con su tabla debajo para quien no
ve el gráfico, crucetas al pasar, pulsar un turno lleva a él) y lo que más
jugó cada uno. Los colores de las dos líneas pasan el validador de
dataviz sobre el azul fijo del tapete (`--navy-solid-dark`, que no cambia
con el tema). Prueba `test-tanda-492.mjs`, 41 comprobaciones; rigor 18/18.

**Hecho, 493 — el vídeo vertical y el recorte por turnos**: en la ventana
del vídeo, «Formato» (horizontal 1280×720 o vertical 720×1280, para TikTok
y Reels) y «Qué trozo» (desde el principio o un turno, hasta un turno o el
final), con la duración de cada ritmo recalculada al vuelo y un «hasta»
anterior al «desde» corregido solo. `video.js` se parte en piezas
(tapete, nombre, premios, pilas, activo, banca, centro, jugada, mano,
firma, cartel) y la composición horizontal sale **igual píxel a píxel**
que antes (comparado); la vertical apila rival, centro y tú, con el
cartel del final debajo de la jugada. Un trozo recortado no se corta en
seco: aguanta un momento la última jugada. El nombre del fichero lo dice
(`…-vertical-turnos-6-8.mp4`). H.264 a 720×1280 sigue en nivel 3.1.
Prueba `test-tanda-493.mjs`, 19 comprobaciones (ffprobe lee los dos
tamaños, el trozo y la duración); rigor 11/11. El ancla del rigor de la 480 se actualiza (la línea
del vídeo cambió de forma).

**Suite entera** antes de subir, sobre el árbol de ANTES de traerme la 490
y la 491 de la otra sesión (las 212 pruebas, en dos mitades): todo en verde
salvo la 470 (la conocida) y un rojo de la 480 que era MÍO y del
contenedor —mi PostgreSQL de pruebas tenía ya la `repeticiones_guardar` de
siete argumentos de lo que estoy preparando, y la migración vieja no la
quita—; limpiada esa base, la 480 pasa (93 ok). Lo suyo lo cubre su propia
pasada, que su entrada pide.

**Ficheros**: `js/repeticiones/numeros.js` (nuevo), `js/repeticiones/
carrera.js` (nuevo), `js/repeticiones/video.js`, `js/repeticiones.js`,
`repeticiones.html`, `css/repeticiones.css`, `SCHEMA.md`. Rama `pruebas`:
`test-tanda-492.mjs`, `test-tanda-493.mjs`, `rigor-tanda-492.py`,
`rigor-tanda-493.py`, `rigor-tanda-480.py`.

**En curso / pendiente**: lo demás que PINGU aprobó de la lista —los mazos
por lo que se vio con «Abrir en el constructor», apuntar la partida en
Mis partidas al guardar, notas en jugadas, adjuntar la repetición a una
partida de torneo y «Jugar desde aquí» en el laboratorio— va en las
siguientes, con `supabase-migration-repeticiones.sql` ampliada (habrá que
ejecutarla OTRA VEZ). `js/repeticiones/mazos.js` ya está en el árbol pero
nadie lo importa todavía: no se sube en estas dos.
**OJO, CHOQUE DE NÚMEROS (y van NUEVE)**: usé la 492 a la vez que la otra
sesión, que además gastó de la 492 a la 497 de un tirón y llegó antes al
remoto. Lo mío pasa a ser la **498**. Van 384, 394, 413, 420, 456, 462,
480, 488 y esta. Y la lección nueva: mirar el remoto antes del commit NO
basta si el otro empuja SEIS tandas mientras tú escribes una — lo que hace
falta es mirarlo justo antes del **push**, que es cuando lo cacé.

## 2026-10-03 — PINGU-Claude (tanda 498 — lo que ningún barrido puede ver)

**Hecho**: iba a sacar de `components.css` los 0,34 KB de `aprender.html`
que la 490 dejó medidos, y **no se pueden sacar**. Salieron dos cosas, y la
segunda es la lección:

1. `.medalla-chip` **no es de /aprender**: la escribe `chipMedallaHtml()` en
   `js/medallero.js`, y a ese ayudante la **PORTADA** llega por
   `js/guide-card.js`. Mudarla le habría quitado la chapa de medalla a las
   tarjetas de guía de la portada. Lo cazó el barrido ya arreglado en la
   491 — con el regex viejo era invisible.
2. Y lo que **ningún barrido puede ver**: `medalla-oro`, `medalla-plata` y
   `medalla-bronce` **no existen escritas en ninguna parte del código**. Se
   arman con `medalla-${medalla}` en ejecución, así que seguían saliendo
   como «de /aprender» incluso con el regex bueno. Son igual de compartidas
   que `medalla-chip`.

Lo que quedaba movible de verdad son ~0,1 KB y encima `.esq-guia i` está
dentro de una lista compartida del `@media (prefers-reduced-motion)` que
habría que partir. **No vale la cirugía: queda DESCARTADO, no pendiente.**

**El barrido, ahora con prefijos**: `test-tanda-299.mjs` apunta el PREFIJO
de lo que se arma en ejecución (`class="x-${…}"` → `x-`) y perdona todo lo
que empiece por él. Es de grano gordo a propósito — **marca de más, nunca
de menos**, porque en una guarda un falso negativo es CSS sin su hoja (un
fallo invisible en producción) y un falso positivo solo es una clase que no
se puede mudar. Sigue en verde.

Y la norma para quien muda, en `CLAUDE.md`: **antes de mover una clase,
greparla A MANO en el JS**. Van dos sustos iguales —`.emoji-big` en la 491
y `.medalla-*` aquí— y el patrón es el mismo: el barrido dice «esta clase
es de una sola pantalla» y miente.

**Y el `scroll-padding-top`**, lo que la 489 quiso y no cupo: con los 2,3
KB que dejaron la 490 y la 491, `html` estrena `scroll-padding-top: 72px`
(los 71 medidos de la barra, en la retícula de 4), así que un ancla o el
salto al contenido dejan de aterrizar debajo de la barra fija. Portada:
167,7 → **167,8 KB**. Sigue sin arreglar el clic de Playwright, que va por
CDP y no honra `scroll-padding` — eso ya se sabía.

**Ficheros**: `css/style.css`, `CLAUDE.md`, `SCHEMA.md`, `BITACORA.md`. En
la rama `pruebas`: `pruebas/test-tanda-299.mjs`.

**Prueba**: `test-tanda-299` en verde con el barrido de prefijos y con la
portada a 167,8 KB. Las dos pasadas de SUITE ENTERA de antes dieron **210
verdes y CERO rojos** (una hasta la 489 y otra con la 490 y la 491 dentro);
el **426 salió VERDE en las dos**, lo que confirma que su rojo de antes era
una carrera y no un fallo — y que estuvo bien no ablandar la prueba.

**En curso / pendiente**: (1) **Bulbapedia**: recomiendo descartarlo (SA
comprometería parte de nuestra base a licencia no comercial para siempre, y
en España aplica el derecho *sui generis* de bases de datos sobre una
extracción masiva). Lo que sí vale es usarla A MANO como referencia.
Pendiente de que PINGU lo cierre. (2) Si quiere los nombres occidentales
exactos, la fuente a evaluar es **pokemontcg.io**, que ya usamos como
respaldo de imagen en tres sitios. (3) Rigores pendientes desde la 443.
(4) Queda 2,2 KB de margen en la portada.

## 2026-10-03 — PINGU-Claude (tanda 491 — lo del artículo a su hoja, y el agujero del barrido)

**Hecho**: sigue la 490. Lo de `guia.html` era el trozo más grande que
quedaba en `components.css` —la maqueta del artículo, los diez
`.forum-post-*` de los comentarios, el «¿te ha servido?», el muro de pago,
los avisos de borrador y pendiente, el «escribe tú una guía» y la llamada
al curso—, y la portada **lo bajaba** sin pintar nada de eso. Ahora vive en
**`css/guia.css`**, enlazada desde `guia.html`, que sirve `/guia/:slug`,
`/noticias/:slug` y la vista previa del editor.

`components.css` **25,24 → 23,71 KB**; la portada **169,2 → 167,7**, o sea
**2,3 KB de margen** donde había 0,1.

Tres de los cuatro `@media` se mudan ENTEROS (hablan solo de estas clases).
El cuarto —`max-width: 520px` sobre `.guia-cta-curso .btn-primary`— **se
queda a propósito**: su base también se queda, y los dos juntos no separan
nada. Comprobado en la pantalla a los dos lados del corte: a 1024 el
`.article-main` pierde el centrado y la lateral aparece; a 1023 vuelve el
`margin: 0 auto` y se esconde. Con el `@media` huérfano se vería lo
contrario.

**Y LO IMPORTANTE, que vale más que el kilobyte: el barrido de
`test-tanda-299.mjs` tenía un agujero.** Buscaba con
`/class="([^"$]*)"/`; ese `[^"$]` estaba para no pescar `${...}` pero
**descarta la cadena COMPLETA**, así que `class="emoji-big ${tinte(id)}"`
era INVISIBLE para la guarda que vigila el CSS huérfano. Son **143 clases**
que no veía: casi todo lo de torneos, mi-colección, el laboratorio,
mis-partidas y las tarjetas de guía.

Se vio porque el barrido me dijo que `.emoji-big` era solo de guia, y es
mentira: `js/categoria.js` también la escribe. Moverla habría dejado el
icono de /categoria sin su `display: inline-block` —el que hace que el
recorte recorte— **sin dar ningún error**. Así que `.emoji-big` NO se ha
movido, y el barrido está arreglado: ahora se le quitan los `${...}` y se
queda lo literal. **Con el arreglo puesto la prueba sigue en VERDE**, así
que no había ningún fallo vivo tapado — pero la red llevaba a medias desde
la tanda 299.

**Y mi propia herramienta picó en la trampa de la 312**: leía nombres de
clase DENTRO de los comentarios, así que `/* ── Article (guia.html) ── */`
le colaba `.html` y daba por compartidas dos bases que son de guia.

**Ficheros**: `css/guia.css` (NUEVO), `css/components.css`, `guia.html`,
`SCHEMA.md`, `BITACORA.md`. En la rama `pruebas`:
`pruebas/test-tanda-299.mjs` (el barrido arreglado).

**En curso / pendiente**: (1) **La suite entera hay que volver a pasarla**:
la que acabó cubría hasta la 489, y la 490 y la 491 mueven CSS. (2) Queda
lo de `aprender` (0,34 KB) partiendo su `@media` de «menos movimiento».
(3) Con 2,3 KB de margen ya cabe de sobra el `scroll-padding-top` que la
489 dejó fuera. (4) **PINGU tiene que decidir lo de Bulbapedia** (CC
BY-NC-SA 2.5: atribución visible y uso NO comercial). (5) El 426 sigue
rojo, diagnosticado. (6) Rigores pendientes desde la 443.

## 2026-10-03 — PINGU-Claude (tanda 490 — hacer sitio en la portada, midiendo primero)

**Hecho**: la portada iba a **169,9 de 170 KB** y `CLAUDE.md` lleva desde
la 436 diciendo que lo próximo que la toque no cabe. Lo que faltaba era
saber QUÉ sacar, así que primero se midió: reutilizando el barrido de
`test-tanda-299.mjs` salen **112 clases de `components.css` que usa UNA
SOLA página**.

**Y el dato estaba al revés de lo que parecía**: 39 de esas 112 son de la
PORTADA, y moverlas a `portada.css` **no ahorra un byte**, porque la
portada baja las dos hojas. Lo que la adelgaza es sacar lo que la portada
NUNCA usa. Medido bloque a bloque y recomprimiendo: guia 1,40 KB · perfil
0,71 · aprender 0,34 · el resto ~0,3.

Se han movido las **19 de perfil** (`.my-guide-*`, `.sugerencia-*`,
`.panel-invitar*`, `.color-swatch-row`) a `css/perfil.css` — que cargan
perfil.html Y usuario.html, así que las dos fichas de persona siguen
vestidas.

**Las guardas pararon lo de `aprender`**, y es la trampa de la 299 literal:
el `@media (prefers-reduced-motion)` de `components.css` menciona
`.esq-guia` y se quedaría ANTES que su base mudada, así que «menos
movimiento» dejaría de apagar el barrido del esqueleto. Hay que partir ese
`@media` y eso es otra tanda (una sección de CSS no es una unidad de
mudanza, 316). Medido y pendiente: 0,34 KB.

**Resultado**: `components.css` 25,95 → **25,24 KB**; la portada 169,9 →
**169,2**, o sea de 0,1 KB de margen a **0,8**.

**Ficheros**: `css/components.css`, `css/perfil.css`, `SCHEMA.md`,
`BITACORA.md`.

**Prueba**: `test-tanda-299` (el barrido en las 26 páginas + el peso de la
portada: 169,2 KB), `test-tanda-306` (las dos fichas de persona, que es
donde aterrizan las reglas) y `test-tanda-301` (/usuarios). Las tres en
verde. Y la suite entera corriendo de fondo.

**En curso / pendiente**: (1) Lo de **aprender** (0,34 KB) partiendo su
`@media`, y lo de **guia** (1,40 KB), que es el premio gordo pero no tiene
hoja propia: habría que crear `css/guia.css` y enlazarla. (2) Con 0,8 KB de
margen ya cabe el `scroll-padding-top` que la 489 tuvo que dejar fuera.
(3) **PINGU tiene que decidir lo de Bulbapedia**: técnicamente resuelto,
pero su texto es CC BY-NC-SA 2.5 — atribución visible y uso NO comercial—,
y eso es una decisión sobre PokeDoc, no técnica. (4) El 426 sigue rojo,
diagnosticado. (5) Rigores pendientes desde la 443.

## 2026-10-03 — PINGU-Claude (tandas 488 y 489 — el parche de Cowork integrado, y lo que la suite cazó)

**Hecho, 488**: integrado el parche de la sesión de **COWORK** (PINGU lo
autorizó expresamente: la primera vez el clasificador me lo bloqueó por
código de terceros en una rama que sale a producción, y no busqué la
vuelta). Llegaba numerado como 485 y pasa a **488**: mis 485 y 486 ya
estaban comiteadas con sus pruebas empujadas. **Octavo choque de números, y
el primero con TRES sesiones** — la bitácora da por hecho que somos dos.

Trae `escaneos-asia` (cada 4 min, en `2-59/4` para no coincidir con
`catalogo-asia` ni con `cartas-detalle`): monta el camino
`serie/set/número`, pregunta con HEAD si el fichero existe y **solo
entonces** guarda `image_path`. Un 4xx marca la carta como mirada (se
repasa al mes); un **5xx no toca nada**, que es la decisión fina — apuntar
«no está» por un mal rato del servidor dejaría miles de cartas sin foto un
mes. Y una segunda fase que escribe `name_es` en latino desde `dex_ids`
sin tocar `name`. Su prueba, renumerada a `test-tanda-488.mjs`, **62
comprobaciones en verde**.

Comprobado por mi parte antes de subirlo: `js/pokedex-especies.js` exporta
`especiePorDex`; `name_search` es GENERADA sobre `name || ' ' || name_es`
(leído en `supabase-migration-cartas-nombre-es.sql`), así que buscar
«Charizard» en el catálogo japonés funcionará sin tocar el buscador; y
ninguna prueba de la suite enumera las funciones programadas, así que la
nueva no rompe nada.

**Hecho, 489**, dos cosas que salieron de pasar la suite entera:

1. **Un 76 que era 71, y una lección que me costó la portada.** La barra
   es `sticky; top: 0` y mide **71 px medidos** (cinco páginas, dos anchos);
   `repeticiones.css` llevaba un **76 a ojo** y pasa a 72.
   Lo que **NO** se ha subido, que es lo interesante: quise además un token
   `--nav-alto` en `:root` y `html { scroll-padding-top }`, y con sus
   comentarios la portada se fue a **170,5 KB** — la prueba de la 299 lo
   cantó. Recortando los comentarios bajó a 170,1, luego a 170,0 (justo en
   el límite, cero holgura) y **solo quitando el token volvió a 169,9**.
   O sea: **en este repo los comentarios de CSS los baja todo el mundo** (no
   hay build step), y un token de una línea en `:root` cuesta el último
   décimo. Apuntado en `CLAUDE.md`. `scroll-padding-top` es lo correcto y
   queda PENDIENTE de una tanda que empiece por hacer sitio — y comprobado
   que **no** arregla el rojo del 426: el desplazamiento de Playwright va
   por CDP y no honra `scroll-padding`.
2. **Una regresión MÍA de la 485.** Al marcar varias de golpe, las nuevas
   entraban en `cartas` pero no en `cartasTodo`, y el Panel las sacaba
   **sin nombre** («Carta»). Eran DOS bucles —líneas y catálogo— y al pasar
   el primero por `meterLinea` el segundo se quedó corto. Ahora es uno.
   **No daba ningún error** y solo la cazó la suite COMPLETA: es la lección
   de la 447 cobrada otra vez.

**Ficheros**: `netlify/functions/escaneos-asia.mjs` (NUEVO),
`netlify/lib/escaneos-asia.mjs` (NUEVO),
`supabase-migration-escaneo-buscado.sql` (NUEVO), `css/repeticiones.css`,
`js/mi-coleccion.js`, `CLAUDE.md`, `SCHEMA.md`, `BITACORA.md`.
**`css/style.css` NO se toca**: ver arriba, no cabía.
En la rama `pruebas`: `pruebas/test-tanda-488.mjs` (nuevo) y
`pruebas/test-tanda-471.mjs` (puesto al día por la 487).

**SUITE ENTERA, pasada**: 205 verdes y DOS rojos, y los dos mirados:

· **471**, mío: la 487 partió el insert de cartas en dos sentencias, y una
  de sus afirmaciones —«una sin escaneo se guarda a null»— era justo lo que
  había que quitar. Puesta al día: ahora afirma que la que no trae escaneo
  **NO menciona** `image_path`, y que cada sentencia va con una sola forma
  de fila. **En verde.**
· **426**, ANTERIOR a mis tandas y sin arreglar. Todas sus afirmaciones
  pasan; lo que se cae es el ÚLTIMO clic, el del «Ver todas» del Panel, que
  Playwright reintenta hasta agotar el tiempo con un «navUserBtn intercepts
  pointer events». **A/B limpio**: con el código de la 483 falla igual, así
  que no lo traje yo. Y en un sondeo directo de la misma pantalla el botón
  está en y=470 con la barra acabando en y=70 y `elementFromPoint` devuelve
  el botón — o sea que **es pulsable**, y el fallo tiene pinta de carrera
  con `pintarVistazos`, que es `async`. Probé un desplazamiento a mano
  antes del clic y NO lo arregla (Playwright vuelve a desplazar en cada
  reintento), así que lo he revertido en vez de subir un cambio de prueba
  que no puedo demostrar.

**Y UN FALLO DE MÉTODO MÍO, que casi me hace sacar conclusiones falsas**:
monté un segundo servidor en 8893 para iterar mientras corría la suite, y
lo monté con un `tar` del repo **sin el doble de Supabase**. Durante un
rato medí contra el Supabase de PRODUCCIÓN (cerrado por la red del
contenedor), así que todo lo que leí allí —incluido un A/B— no valía nada.
Se vio porque `window.__TABLAS__` era `undefined`. **Si montas una copia a
mano, cópiale los dobles**: `sync-forum.sh` los pone después de cada copia
y por eso existe.

**En curso / pendiente**: (1) ~~ejecutar
`supabase-migration-escaneo-buscado.sql`~~ — **EJECUTADA por PINGU el
2026-10-03**, así que `escaneos-asia` ya tiene su columna y la fase de
escaneos arranca sola (cada 4 min, 160 cartas por pasada: unas seis horas
para las ~15.000 sin foto). Se comprueba con el `select` del final del
propio fichero de migración, o desde /admin → «Contar mercados»: el
`con_foto` de JP tiene que subir de ~3.900 hacia ~7.400. (2) El **426** sigue rojo,
diagnosticado y sin arreglar. (3) Lo de **Bulbapedia** (logos, rarezas y
nombres occidentales exactos) está analizado y sin empezar: ojo a la
licencia CC BY-NC-SA 2.5 —atribución visible y uso no comercial—, a no
enlazar en caliente sus imágenes y a que los escaneos de carta son otro
orden de magnitud. (4) `tcg_card_prices` no tiene `market`. (5) Rigores
pendientes desde la 443. (6) Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 487 — el null que borra una foto buena al reimportar)

**OJO, CHOQUE DE NÚMEROS (y van OCHO), Y ESTA VEZ CON UNA TERCERA
SESIÓN**: existe una sesión de **COWORK** (también de PINGU) que ha escrito
su propia **485**. Yo ya tenía la 485 (Panel general) y la 486 comiteadas y
sus pruebas empujadas a `pruebas` con esos nombres de fichero, así que las
mías se quedan y **lo de Cowork pasa a ser la 488** cuando se integre. Van
384, 394, 413, 420, 456, 462, 480 y esta. Lo nuevo que aprender: la
bitácora y «mirar el remoto antes del commit» suponen DOS sesiones, y ya
somos tres — y la tercera no empuja, entrega un parche.

**Hecho**: Cowork midió TCGdex de verdad (un HEAD por carta a las 20.442
asiáticas) y encontró que **la API se calla `image` en miles de cartas
cuyo fichero SÍ está publicado**: JP dice 3.882 y existen **7.365**; TW
2.146 contra 2.242; CN 0 y 0. Y el campo falta **también en
`/cards/{id}`**.

**Eso deja mal dos cosas que escribí yo**, y las dos por deducir el
catálogo entero de una muestra de uno: la **484** dijo «la ficha de cada
carta sí trae la imagen» y la **486** dijo «cuando el escaneo existe viene
en el listado». Las dos son falsas — SV1a, el set que sondeó PINGU, es de
2023 y es justo el caso bueno. Corregido en `CLAUDE.md`, con los números
medidos.

**Y el fallo que esta tanda arregla**, que su nota dejaba señalado y vive
en mis ficheros: `cardToRow` pone `image_path: null` cuando la API calla.
Inofensivo al INSERTAR —la columna nace vacía igual— y **destructivo al
REIMPORTAR**, porque las dos importaciones escriben con
`merge-duplicates` y ese null **PISA** la foto que ya hubiera. «Importar
los que faltan» borraría todo escaneo encontrado a mano, **sin dar ningún
error**, y además dejaría la carta marcada como ya mirada.

El arreglo es `porImagen(filas)` → `{ con, sin }` en
`js/catalogo-tcgdex.js`: las que traen foto la escriben, las que no **no
mencionan la columna**, y una columna que no se menciona no se toca. Son
DOS sentencias porque PostgREST exige las MISMAS claves en cada una. La
cadena vacía cuenta como que no hay (un `image_path: ` montaría
`/ja//low.webp`, una foto rota guardada como buena).

**Ficheros**: `js/catalogo-tcgdex.js`, `js/tcgdex.js`,
`netlify/lib/carta-detalle.mjs`, `netlify/functions/catalogo-asia.mjs`,
`admin/js/admin.js`, `CLAUDE.md`, `SCHEMA.md`, `BITACORA.md`. En la rama
`pruebas`: `pruebas/test-tanda-487.mjs` (nuevo).

**Prueba**: `test-tanda-487.mjs`, 24 comprobaciones en verde, con un
barrido escrito contra la FORMA del fallo (cualquier escritura de
`tcg_cards` con merge-duplicates que no pase por `porImagen`) y la
comprobación de que el barrido LLEGA. Mutada por dos lados: dejando la
clave puesta caen tres; volviendo a escribir las filas de golpe cae el
bloque 4.

**EL PARCHE DE COWORK, SIN INTEGRAR**: trae `escaneos-asia` (función
programada que monta el camino, pregunta con HEAD y solo entonces guarda),
una fase de `name_es` en latino desde `dex_ids`, y
`supabase-migration-escaneo-buscado.sql`. **El clasificador de mi sesión
bloqueó aplicarlo** —integración de código de terceros en una rama que sale
a producción— y no he buscado la vuelta. Pendiente de que lo decida PINGU.
Esta tanda es su PRERREQUISITO: sin `porImagen`, la primera reimportación
borraría lo que esa función encuentre.

**En curso / pendiente**: (1) **Decidir qué se hace con el parche de
Cowork**. (2) Si se aplica, hay que ejecutar
`supabase-migration-escaneo-buscado.sql` y renumerarlo a 488; su prueba se
llama `test-tanda-485.mjs` y choca con la mía. (3) Su nota deja dicho que
`nombreDeCarta` enseña `name_es` antes que `name`, así que las cartas
japonesas pasarían a titularse en latino: es lo pedido, pero cambia lo que
se ve. (4) Lo de Bulbapedia (logos, rarezas y nombres exactos) está
analizado y sin empezar — ojo a la licencia CC BY-NC-SA y a no enlazar en
caliente. (5) Rigores pendientes desde la 443. (6) Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 486 — la herramienta que vino a no deducir, deduciendo)

**Hecho**: PINGU pulsó el botón de la 484 con `sv1a JP` y volvió con dos
datos y dos fallos del propio botón.

**Los datos**: (1) TCGdex **no publica `logo` ni `symbol`** de SV1a (JP) —
primera vez que eso es un dato y no mi deducción, así que los 0 de 188
logos japoneses son de arriba y no nuestros. (2) Sus **103 cartas vienen
con `image` YA EN EL LISTADO, el 100 %**, y eso apunta al revés de lo que
le dije: si el escaneo existe viene en el listado y la importación ya se lo
lleva, o sea que **el engorde no conjura escaneos que arriba no estén**. Lo
de «el 30 % es un número en movimiento» fue otra deducción optimista y
queda corregido en `CLAUDE.md`.

**Los fallos del botón**: comparaba el id **distinguiendo mayúsculas** y
contra lo ESCRITO en el prompt. El japonés nombra sus sets en MAYÚSCULAS
(`SV1a`, serie `SV`), su API no distingue caja y contestó, y mi
comparación sí: salió «ese set no está en nuestra tabla» de un set que
puede estar. **La herramienta hecha para no dar respuestas ambiguas dio
una.** Y `cs1a CN` dio 404 porque ese identificador no existe.

**Lo nuevo**: «**Sondear un catálogo entero**» (/admin → Cartas). Pide el
LISTADO del mercado —y enseña los diez primeros y los diez últimos
identificadores, que es lo que faltaba con el 404 del chino—, coge una
muestra de NUEVE repartidos por toda la lista y de cada uno pide el set
completo: logo, símbolo, cuántas cartas con imagen **y su fecha**. La fecha
al lado es la pieza que contesta la pregunta — si los que no traen imagen
son los viejos, es cobertura de TCGdex por antigüedad; si la muestra ronda
el 100 % y nuestra tabla dice 30 %, el fallo es nuestro. Diez peticiones,
350 ms entre ellas, y un set que no contesta no tumba el sondeo.

**Y un cable trampa**: `filtroDeColeccion` baja la clave a minúsculas, lo
que con el japonés daría un 404 sin error. Hoy no pasa porque
`js/coleccion.js` lleva `const MERCADO = WEST` — y como un comentario que
justifica un atajo caduca (la 471), el aviso que SÍ salta es una
comprobación de la prueba.

**Ficheros**: `admin/index.html`, `admin/js/admin.js`,
`admin/js/cuentas-mercado.js`, `js/carta-ruta.js` (solo el aviso),
`CLAUDE.md`, `SCHEMA.md`, `BITACORA.md`. En la rama `pruebas`:
`pruebas/test-tanda-486.mjs` (nuevo).

**Prueba**: `test-tanda-486.mjs`, 28 comprobaciones en verde. Mutada tres
veces: dejando la muestra en un extremo cae «el último de la lista»;
volviendo la comparación sensible a la caja cae el bloque 3; y poniendo
`MERCADO = JP` en `coleccion.js` salta el cable trampa con el texto de
qué arreglar.

**MIGRACIÓN EJECUTADA**: PINGU pasó `supabase-migration-idioma-chino.sql`.
Los dos CHECKs (`user_collection_idioma` y `user_wants_idioma`) ya llevan
`zh`, confirmado leyendo `pg_constraint`. Ya se pueden añadir cartas del
catálogo chino.

**En curso / pendiente**: (1) **PINGU: pulsa «Sondear un catálogo entero»
con JP** y pásame el cuadro — es lo que cierra la pregunta del 30 %. (2) La
485 (Panel general) está comiteada y esperando que acabe la suite.
(3) Queda apuntado que `tcg_card_prices` no tiene `market`. (4) Rigores
pendientes desde la 443. (5) Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 485 — el Panel es GENERAL; las otras cuatro pestañas son del catálogo)

**Hecho**: PINGU: «cambio el idioma y pongo japonés y me salen los sets
japoneses. Y seguido me vuelvo al panel y me sale solo mi colección en ESE
idioma. Está mal. Debería ser un overall de todas las cartas que tengas
independientemente del idioma. El panel es general».

Y **no vale filtrar**, que es lo interesante. La 437 metió el mercado «en el
todo» y lo dejó escrito en `datos.js`: «mientras cada pantalla mira un solo
mercado, el choque no existe» — eso era una CONDICIÓN, y el Panel general la
rompe. `cartas` es un mapa por `card_id` a secas y puede serlo porque mira
un mercado; con los cuatro juntos la clave de `tcg_cards` es (id, market)
—el japonés comparte identificadores de set con el inglés— así que
`sv1a-1` son DOS cartas y el mapa se queda con una SIN DAR ERROR. Y al
agrupar repetidas por id, la Charizard japonesa y la inglesa salían como
«te sobran 2 copias de 1 carta».

Así que son **DOS colecciones en memoria**: `lineas`/`cartas` del mercado
elegido (Cartas, Expansiones, Carpetas, Pokédex) y `lineasTodo`/`cartasTodo`
de todo, por `claveDeCarta(id, market)` (Panel y cabecera). Nuevas en
`datos.js`: `lineasDeTodo`, `cartasPorClaves` —una consulta POR MERCADO, que
un `in` de ids con los cuatro juntos traería cruces— y `claveDeCarta`.

General ahora: las cuatro cifras de la cabecera, el «Coleccionando desde»,
el valor de ahora, el balance de compra, «Tus cartas», «Lo que te sobra»,
«Lo más valioso» y los dos repartos. **Del catálogo a propósito**: las
«Expansiones» del Panel —su lista de sets ES la del mercado y su «Ver todas»
lleva a esa estantería— y las cuatro pestañas de mirar algo concreto.

**Tres cosas que salieron de paso**:

1. La cabecera no filtraba, **negaba**: con el japonés puesto y sin
   japonesas todavía decía «Todavía no has añadido ninguna carta» a alguien
   con 21.000.
2. El **histórico** de la gráfica sale de `user_collection_value`, filtrado
   solo por `user_id`, o sea que YA era de todos los catálogos — mientras
   su punto de «ahora» era del catálogo. Con el japonés puesto, la gráfica
   subía dos años y se caía por un precipicio en el último punto.
3. «Te sobran 1 copia», que vi en lo que imprimía la prueba al lado de un
   `ok`.

**Y las dos memorias se tocan JUNTAS**: había SEIS sitios que mutaban
`lineas` a mano, y cualquiera que se olvidara dejaría el Panel diciendo lo
de antes justo después de añadir una carta. Ahora pasan por `meterLinea`,
`cambiarLinea` y `quitarLinea`. Al cambiar de catálogo, `lineasTodo` **no se
vacía a propósito**: cambiar de catálogo no cambia la colección entera.

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/datos.js`, `SCHEMA.md`,
`BITACORA.md`. En la rama `pruebas`: `pruebas/test-tanda-485.mjs` (nuevo).

**Prueba**: `test-tanda-485.mjs`, siete bloques en verde, con un fixture que
tiene el choque de verdad dentro (un `sv1a-1` occidental y otro japonés).
Mutada dos veces: quitándole el mercado a `claveDeCarta` caen tres
comprobaciones y sale «Distintas: 3» y «2 copias repetidas de 1 carta»;
volviendo el Panel al catálogo caen OCHO y reproduce el fallo de PINGU al
pie de la letra (con el japonés puesto, el Panel enseña solo
「フシギダネ」「リザードン」). Y la **suite entera**, por la lección de la 447.

**En curso / pendiente**: (1) PINGU tiene que pulsar el botón nuevo de
/admin → Cartas («Qué contesta TCGdex de un set», `sv1a JP` y `cs1a CN`) y
pasarme el cuadro: es lo que zanja si los logos asiáticos existen arriba.
(2) Sigue sin ejecutar `supabase-migration-idioma-chino.sql` (tanda 472).
(3) Queda apuntado que `tcg_card_prices` no tiene `market`, así que para los
pocos ids que el japonés y el inglés comparten el precio es la misma fila.
(4) Rigores pendientes desde la 443. (5) Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 484 — «revisa bien la API»: una deducción disfrazada de respuesta)

**Hecho**: PINGU: «me has dicho que TCGdex no guarda las imágenes de los
sets japoneses y los logos, **pero sí lo hace. Revisa bien la API**. […]
Nosotros aquí estamos construyendo la colección».

Tenía razón en lo de fondo, y el error no era el dato: era **de dónde
salía**. Lo que yo le contesté no era una lectura de la API de TCGdex, era
una DEDUCCIÓN a partir de nuestras propias columnas —«188 sets curados,
cero logos, luego arriba no está»— y esa deducción sale EXACTAMENTE IGUAL
si el que lee mal somos nosotros. Una columna vacía no dice de quién es la
culpa, y yo se la había atribuido al tercero sin nada con que sostenerlo.

Desde este contenedor su API **no se puede leer** (la política de red del
entorno cierra `api.tcgdex.net`), así que la tanda hace las dos cosas que
sí se pueden:

1. **Comprobar nuestra mitad**, que está entera: `imagePathFromUrl` recorta
   bien el logo y el escaneo en los SIETE idiomas —`zh-cn` y `zh-tw`
   gastan los cinco caracteres de su `[a-z-]{2,5}`, margen cero—, el camino
   guardado no lleva el idioma dentro, cada mercado pide a SU carpeta
   (438) y `loQueFaltaDeUnSet` escribe `logo_path` desde `completo.logo`.
   Si TCGdex manda el logo, lo guardamos.
2. **Preguntárselo a TCGdex de verdad**, desde el único sitio del proyecto
   con salida a su API: el navegador del panel. Botón nuevo en /admin →
   Cartas, **«Qué contesta TCGdex de un set»**: pide el set COMPLETO con
   `fetchSet` (no el listado, que es un SetResume y volvería a decir «no lo
   tiene» por nuestra culpa) y vuelca `logo`, `symbol`, `serie`,
   `releaseDate`, `tcgOnline`, `cardCount` y cuántas cartas traen `image`
   y cuántas no — **al lado** de nuestras columnas, porque el campo crudo
   solo no dice de quién es la culpa. Con su clave de lectura dentro.

Y una explicación que mi respuesta se había saltado, ya escrita en
nuestras notas desde la 348: **JP al 30 % de fotos no es «TCGdex al 30 %»,
es «el LISTADO del set al 30 %»**. La ficha de cada carta sí trae la
imagen, `detalleDeCarta` la cura y `catalogo-asia` manda el detalle entero
en el PATCH — o sea que esas imágenes se están rellenando solas ahora
mismo con el engorde de la 483. El 30 % es un número en movimiento.

**Ficheros**: `admin/index.html`, `admin/js/admin.js`, `SCHEMA.md`,
`BITACORA.md`. En la rama `pruebas`: `pruebas/test-tanda-484.mjs` (nuevo).

**Prueba**: `test-tanda-484.mjs`, 40 comprobaciones en verde. Mutada: con
`[a-z]{2,3}` en vez de `[a-z-]{2,5}` caen los dos chinos y el invariante
del camino sin idioma; quitándole el botón al panel cae la cuarta sección.

**En curso / pendiente**: (1) **PINGU tiene que pulsar ese botón** y pasarme
el cuadro — con `sv1a JP` y un `cs1a CN` basta para zanjar si los logos
asiáticos existen arriba o no. (2) El **Panel de /mi-coleccion debe ser
GLOBAL** (todas las cartas de todos los catálogos, independientemente del
idioma); Cartas, Expansiones y Pokédex siguen siendo del catálogo elegido —
pedido y sin empezar. (3) Sigue sin ejecutar
`supabase-migration-idioma-chino.sql` (tanda 472). (4) Rigores pendientes
desde la 443. (5) Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 483 — la Pokédex japonesa, vacía con 13.006 cartas dentro)

**Hecho**: PINGU: «me voy a la Pokédex japonesa y ningún Pokémon tiene
cartas. Está vacío». No tenía que hacer nada en /admin: **esto no lo
arregla ningún botón**. Era nuestro y de dos sitios a la vez: (1)
`cartas-pokedex` —la que rellena `dex_ids`— lleva `const MERCADO = 'WEST'`,
así que las 21.000 cartas asiáticas la tienen a null; y (2) su mecanismo no
habría servido igual, porque deduce la especie del NOMBRE y 「フシギダネ」 no
casa con ninguna lista nuestra — y el respaldo de la pantalla
(`esDeLaEspecie`) hacía exactamente lo mismo. Había dos caminos a la
Pokédex y los dos pasaban por el alfabeto latino.

Lo que sí sirve: **`dexId`**, que TCGdex da en el detalle de cada carta y
que nunca le habíamos pedido — un número nacional no depende del idioma.
`detalleDeCarta` lo mapea (solo si viene, como la marca de regulación), hay
una TERCERA fase en `catalogo-asia` que engorda las cartas asiáticas igual
que `cartas-detalle` hace con el occidental, y la pantalla pasa a
`especiesDeLaCarta()`: la columna manda y el nombre es el respaldo. De paso
el engorde trae rareza, tipo e ilustrador, que es lo que deja los filtros
de una expansión japonesa sin nada que filtrar. Lo que NO toca es el
`name`: en un catálogo asiático el japonés ES la clave canónica (334 y 335).

**EL COSTE, DICHO CLARO**: ~21.000 cartas a 25 por pasada cada tres
minutos son unas 500 a la hora, o sea **día y medio o dos** hasta que la
Pokédex japonesa esté entera. Se va llenando sola mientras tanto. Y los
sets se llevan 12 de los 22 segundos de la pasada y el engorde el resto:
una fase excluyente es lo que dejó el engorde occidental sin arrancar jamás
(la 333).

**Ficheros**: `js/carta-detalle.js`, `js/mi-coleccion/pokedex.js`,
`netlify/functions/catalogo-asia.mjs`, `SCHEMA.md`, `CLAUDE.md`,
`BITACORA.md`. En la rama `pruebas`: `test-tanda-483.mjs` (NUEVO, 27
comprobaciones) y `test-tanda-471.mjs` acotada a las ESCRITURAS de
`tcg_cards`, que ahora también se consulta.

**En curso / pendiente**: ejecutar `supabase-migration-idioma-chino.sql`
(tanda 472). Rigores pendientes desde la 443. Portada a 169,9 de 170 KB.

**OJO, CHOQUE DE NÚMEROS (y van SIETE)**: la 480 se usó a la vez en las
dos sesiones. La otra llegó antes al remoto —con la 480 Y la 481—, así que
lo mío pasa a ser la **482**. Van 384, 394, 413, 420, 456, 462 y 480. Y
otra vez lo mismo: miré el remoto antes del commit y estaba limpio; lo que
no cubre eso es que el otro empuje MIENTRAS escribo el mensaje. El push es
quien lo caza, y rebasar y renumerar cuesta cinco minutos.

## 2026-10-03 — PINGU-Claude (tanda 482 — el diagnóstico de /admin que mentía)

**Hecho**: PINGU pegó la línea de «Qué hay de cada mercado» y venía con
«dale a Completar los datos que faltan de los sets» detrás — con los 210
sets occidentales a 210 con fecha y 210 con serie, y los 186 japoneses
igual. No faltaba ninguna. El aviso se decidía leyendo la FRASE con una
expresión regular, y `/0 con fecha/` casaba con **el cero de «210 con
fecha»**. Es la trampa que el CLAUDE.md tiene escrita desde la 312, esta
vez dentro del propio diagnóstico. Ahora los avisos salen de los NÚMEROS,
en `admin/js/cuentas-mercado.js` (puro, se prueba en Node), y separan
CUATRO casos y no dos: no importado → «Buscar sets»; importado y sin curar
→ «Completar los datos» con cuántos faltan; curado y aun así sin logos →
**eso ya no es nuestro**; y cartas sin ni un escaneo → tampoco. Los dos
últimos son la mitad que faltaba: la respuesta honesta a «¿por qué no hay
logos japoneses?» es «no los hay», no «pulsa aquí». Y se añade «con
símbolo» a la cuenta, que es el último dibujo de la cadena de la tarjeta.

**Y PARA EL ARCHIVO, lo que esos números dicen**: con la 471 y la 479
puestas, el 2026-10-03 hay **JP 188 sets / 13.006 cartas, TW 98 / 7.436, CN
56 / 877**, los tres con fecha y serie al completo. La importación
FUNCIONA y está hecha. Lo que falta es de TCGdex: cero logos en los tres, y
escaneos al 30 % en japonés, 29 % en chino tradicional y **0 %** en chino
simplificado, contra el 94 % del occidental.

**Ficheros**: `admin/js/cuentas-mercado.js` (NUEVO), `admin/js/admin.js`,
`SCHEMA.md`, `BITACORA.md`. En la rama `pruebas`: `test-tanda-482.mjs`
(NUEVO, 16 comprobaciones, con los números DE VERDAD que pegó PINGU).

**En curso / pendiente**: ejecutar `supabase-migration-idioma-chino.sql`
(tanda 472). Rigores pendientes desde la 443. Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 481 — el registro que acaba por premios, y el Greninja ex que no era)

**Hecho**: el segundo registro de verdad de PINGU («termina por KO y
cogiendo todos los premios, con Zoroark ex, y el rival jugó un Greninja ex
teracristal que sale como el de la colección del 30 aniversario»). Tenía
27 líneas sin entender y la mesa se descuadraba sin dar error; ahora se
entiende entero y cuadra en las 208 jugadas.

1. **El Greninja ex que se jugó.** El resolutor por nombre elige la
   impresión más nueva con marca legal, y de «Greninja ex» hay dos cartas
   distintas. Nuevo `js/repeticiones/impresion.js`: lo que se le ve hacer a
   cada carta en el registro («usando Ráfaga Espejismo») se mira en TCGdex
   en español, y si la elegida no lo hace se busca la que sí. Una petición
   por Pokémon que ataca, y más solo si no casa.
2. **Lo que no se entendía**: el final por premios, el nombre de cada
   premio, Camilla Nocturna y Ciclón Levante, los contadores que se
   reciben (con el dueño mal puesto por el propio registro), el segundo
   golpe de un ataque doble, «ha elegido» (Bromista Nocturno), el desglose
   del daño y el mulligan.
3. **Lo que se descuadraba**: el mulligan dejaba la mano a cero; con
   gemelos caía el Zorua equivocado; el estadio que se va se descartaba dos
   veces; usar la Fábrica descartaba una carta; Más PP de N quitaba la
   energía al activo; Ráfaga Espejismo se llevaba al Greninja entero.

**Ficheros**: `js/repeticiones/impresion.js` (nuevo),
`js/repeticiones/registro.js`, `js/repeticiones/estado.js`,
`js/repeticiones.js`, `js/repeticiones/video.js`, `SCHEMA.md`. En
`pruebas`: `test-tanda-481.mjs`, `registro-481.txt` (el registro, con los
nombres cambiados por Rojo y Azul) y `rigor-tanda-481.py` (nuevos). La
portada NO se toca.

**Pruebas**: la suite entera se pasó hace una hora para la 480 (verde
salvo la 470, que es del contenedor). Esta tanda solo toca ficheros de
/repeticiones, y se han pasado las 19 pruebas que los leen o que barren
todo el JS y el CSS: en verde. **Rigor**: 22 mutaciones, las 22
detectadas. Una salió sin detectar a la primera: con el Mega-Greninja el
ÚLTIMO de la lista de mentira, el filtro de nombre podía ser «contiene» y
no se notaba (la carta buena salía antes). Ahora el Mega va el primero.

**En curso / pendiente**: de dónde sale una energía que une un Entrenador
propio se deduce (del descarte si está ahí, si no del mazo): con el texto de
la carta se sabría seguro. «Apoyo de Nanci» une dos de Agua y se ha leído
así; si en otro registro no cuadra, mirar ahí. PINGU va a pasar más
registros.

## 2026-10-03 — PINGU-Claude (tanda 480 — compartir, guardar y descargar en vídeo una repetición)

**Hecho**: lo que pidió PINGU sobre /repeticiones (tanda 462): «compartir
el link de una repetición para que quien la abra lo pueda ver», «un
apartado para ver tus repeticiones guardadas (así que necesitamos un botón
para guardar)» y «descargar la repetición en mp4 o guardarla en la web como
lo de los mazos».

1. **Compartir.** Sin cuenta, el enlace LLEVA la partida comprimida detrás
   del `#` (`/repeticiones#p=…`, ~1.900 caracteres el ejemplo; no llega ni
   a nuestro servidor). Con cuenta, compartir la guarda y da el enlace
   corto `/repeticiones?r=…`, con vista previa al pegarlo (título, quién
   contra quién y turnos, en `noindex`).
2. **Guardar y «Tus repeticiones».** Como los mazos: título, si se
   comparte, y una lista al pie de la página con abrir, copiar el enlace,
   dejar de compartir y borrar (con un segundo toque). La misma partida no
   se guarda dos veces. Sin cuenta, Guardar ofrece entrar y al volver se
   abre sola con la ventana de guardar delante.
3. **El vídeo.** Botón «Vídeo»: la mesa se vuelve a dibujar en un lienzo
   de 1280×720 y se codifica con WebCodecs (más rápido que el tiempo real)
   en un MP4 montado a mano —H.264 donde el navegador lo tenga, si no
   VP9—; sin WebCodecs, `MediaRecorder` en tiempo real, y la ventana lo
   avisa. Tres ritmos, con lo que dura cada uno, y se puede cancelar.

**HACE FALTA EJECUTAR `supabase-migration-repeticiones.sql`** en el SQL
Editor para guardar y para el enlace corto. Mientras no esté, la página
funciona igual (pegar, ver, el enlace largo y el vídeo) y Guardar dice qué
fichero falta. La tabla NO deja listar las compartidas de otros: solo se
abre una compartida con su enlace, por una función.

**Ficheros**: `js/repeticiones/datos.js`, `js/repeticiones/enlace.js`,
`js/repeticiones/mp4.js`, `js/repeticiones/video.js` y
`supabase-migration-repeticiones.sql` (nuevos); `repeticiones.html`,
`js/repeticiones.js`, `js/repeticiones/iconos.js`, `css/repeticiones.css`,
`js/schema-check.js`, `netlify/edge-functions/meta-social.js`, `SCHEMA.md`.
En `pruebas`: `test-tanda-480.mjs`, `sql-repeticiones.sql` y
`rigor-tanda-480.py` (nuevos); `herramientas/stub-supabase.js` (la tabla
`replays`, sus tres RPC, y fingir una tabla que falta ya funciona con
cadenas largas); `test-tanda-462.mjs` (la página ya puede guardar, así que
lo que se comprueba es que MIRAR no manda nada) y `test-tanda-388.mjs` (su
expresión rompía con un argumento `text[]`: los corchetes se leían como
una clase de caracteres vacía). La portada NO se toca.

**La suite entera** (202 pruebas, con lo de la otra sesión hasta la 478
ya dentro): verde salvo la 470, que pide un fichero que no está en este
contenedor (`visual/carta-real.png`, una captura de la otra sesión) y no
es de la web. **Rigor**: 26 mutaciones, las 26 detectadas. La prueba del
cartel final se tropezó antes con una trampa de la PROPIA prueba: recortar
una sola fila de píxeles de un vídeo 4:2:0 deja el croma a cero de alto,
ffmpeg no escribe nada y el «no hay oro» parecía un fallo de la web.

**En curso / pendiente**: el H.264 no se ha podido probar en ESTE Chromium
(el de Playwright no trae el codificador): las pruebas sacan VP9, y el
camino de H.264 del MP4 está probado con un H.264 de verdad hecho con
ffmpeg y leído con ffprobe. Si en algún Chrome el vídeo saliera sin
verse, mirar ahí primero. PINGU ya ha pasado otro registro, que acaba por
KO y premios: va en la 481.

**Número**: iba a ser la 479, y la otra sesión subió la suya mientras corría
la suite: lo cazó mirar el remoto justo antes del commit, así que esta es la
480 y lo que venga detrás, la 481.

## 2026-10-03 — PINGU-Claude (tanda 479 — el catálogo asiático, arrancando de verdad)

**Hecho**: PINGU, mirando la web: «las cartas japonesas, chinas… no se están
rellenando, los logos no han cargado, las cartas no han cargado, no hay
imágenes». Dos cosas de la 471 que se portaban mal justo en el ARRANQUE, que
es el único momento en el que estamos:

1. **El listado iba por turnos según el reloj**, y eso está bien para ir
   recogiendo los sets nuevos — pero no para empezar. Un mercado con CERO
   sets es el TAPÓN de todo lo demás: sin sus filas en `tcg_sets`, la fase
   de las cartas no tiene a quién visitar y la pasada entera no hace nada.
   Y con el turno por el reloj, llenar el japés dependía de que le tocara.
   Ahora el que esté a cero va PRIMERO.
2. **Y al arranque se le ponía un reloj de cinco segundos.** Traer los ~400
   sets de un catálogo vacío es una petición gorda y cuatro inserciones;
   cortarlo a los cinco segundos dejaba la pasada siguiente empezándolo
   otra vez desde el principio. Sin esas filas no hay NADA más que hacer en
   esa pasada, así que esperar es justo lo correcto.

Y de `*/6` a `*/3`: con ~550 sets y ~15 por pasada eran cinco horas largas,
que es mucho tiempo mirando un catálogo vacío sin saber si pasa algo. Ahora
unas dos. Sigue siendo de vida corta y el gasto contra TCGdex se acaba solo.

**OJO, LO QUE NO SÉ**: desde este contenedor no se ve ni Netlify ni la base
—la red a `api.tcgdex.net` y a Supabase está cerrada—, así que **no puedo
saber si la función está corriendo o está fallando**. Quien lo dice en un
segundo es /admin → Cartas → «Qué hay de cada mercado»: si JP sale con 0
sets, la función no ha llegado a escribir nunca; si sale con sets y 0
cartas, está a medias; y si salen las dos cosas, entonces el problema es de
la pantalla y no del catálogo.

**Ficheros**: `netlify/functions/catalogo-asia.mjs`, `BITACORA.md`. En la
rama `pruebas`: `test-tanda-471.mjs` con tres comprobaciones más (el
arranque).

**En curso / pendiente**: ejecutar `supabase-migration-idioma-chino.sql`
(tanda 472). Rigores pendientes desde la 443. Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 478 — las tres vistas de una expansión)

**Hecho**: lo último que quedaba de la cola de PINGU: «un botón que si le
das te sale el desplegable si lo quieres ver en grid, en lista o en
binder». Y son tres cosas distintas de verdad: ARCHIVADOR es la de APUNTAR
(bolsillos con su −, su + y sus chapas de versión), CUADRÍCULA la de MIRAR
(los escaneos y nada más, el triple por fila, sin un solo mando) y LISTA la
de BUSCAR (un renglón por carta con número, nombre, rareza y cuántas
tienes). El rótulo del botón dice la vista PUESTA, y la vista se recuerda.
El icono del botón es `eye` y no el de la vista: el dibujo identifica el
CONTROL y la palabra el ESTADO.

**La trampa, y la cazó una prueba vieja**: lo hice primero con un
`<details>` colgando de su chapa, y es exactamente lo que la 459 dejó
escrito — una tira RECORTA lo que se sale de ella, así que un panel colgado
de una chapa de dentro sale cortado, sin dar ningún error.
`test-tanda-459` lo cantó porque comprueba la FORMA del fallo y no el caso
que lo estrenó. Ahora es un `<dialog class="mc-bandeja">`, la misma pieza
que la hoja de ordenar de «Cartas».

**Y la tira vuelve a deslizarse unos píxeles en un móvil de 390**, que está
bien: la 473 comprobó que no hacía falta, pero eso era cierto porque
entonces eran DOS chapas. Que quepan depende de cuántas haya; lo que no
puede pasar nunca es que se APLASTEN para caber (la 320), y eso lo siguen
mirando la 459 y la 473.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `SCHEMA.md`, `BITACORA.md`. En la rama `pruebas`:
`test-tanda-478.mjs` (NUEVO, 31 comprobaciones) y repintadas la 459 y la
473, que afirmaban cosas sobre una barra de dos chapas.

**SUITE ENTERA, CON LAS SIETE TANDAS DENTRO: 201 VERDES Y CERO ROJOS.**
Es la primera pasada limpia desde la 437 (la 471 sacó 193/1 y el rojo era
la guarda de los upsert). Lo que la ensució por el camino fueron trece
pruebas que afirmaban cosas que estas tandas cambiaron A PROPÓSITO —382,
398, 400, 409, 412, 414, 418, 426, 427, 430, 459, 461, 466, 473 y 475—,
casi todas por lo mismo: un control que se mudó dentro de un panel o de un
menú, y encontrar un elemento no es poder pulsarlo.

**En curso / pendiente**: **LA COLA DE PINGU SE HA ACABADO.** Lo único
pendiente que no es mío: ejecutar `supabase-migration-idioma-chino.sql`
(tanda 472) — hasta entonces no se puede guardar una carta china. Rigores
pendientes desde la 443. Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 477 — dentro de una carpeta, como dentro de una expansión)

**Hecho**: PINGU: «mejoraría visualmente el apartado de carpetas porque se
ve un poco pocho… el menú de cada carpeta es lo mismo que una colección».
Las SUBCARPETAS ya existían desde la 411 —el modelo, el árbol, el resumen
recursivo y el «nueva estando dentro»—; lo que faltaba era la PANTALLA.
Ahora dentro de una carpeta hay miga corta, título con su ⋮ («Nueva
subcarpeta» y «Cambiar la carpeta» — las dos acciones que antes solo
existían desde fuera) y buscador, cuyo vacío dice CUÁL de los dos vacíos es.
Y fuera, «Nueva carpeta» pasa de botón azul a chapa, y dentro se esconde:
dos botones que crean cosas distintas con el mismo rótulo es justo cómo se
pulsa el que no era. Se van `.mc-carpetas-mandos` y `.mc-migas-carpetas`. El
cierre del ⋮ pasa a ir por CLASE: con un segundo menú, copiarlo con otro
`#id` delante es cómo se acaba con uno que se cierra y otro que no.

**OJO, LO GORDO**: el doble de Supabase **no tenía carpetas**.
`listarCarpetas` daba un 42P01, el cliente lo lee como «falta la
migración» y la pestaña salía vacía en TODAS las pruebas — o sea que esta
pantalla no la había probado nadie nunca, y nada lo cantaba porque el
vacío es un estado legítimo de ella. El doble tiene ahora
`collection_folders`, `collection_folder_cards` y la RPC
`carpetas_resumen`, calculada RECURSIVA como en la base (la lección de la
437: si el doble simplifica, la prueba deja de hablar de la web).

**Y un token que no existía**: `test-tanda-299` cazó un `var(--bg-soft)` en
el `:hover` de las opciones del menú de la 475. Ese token no existe, así
que el resalte no se pintaba — y un token inventado no da ningún error.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `SCHEMA.md`, `BITACORA.md`. En la rama `pruebas`:
`test-tanda-477.mjs` (NUEVO, 28 comprobaciones), el **doble con carpetas**
(`stub-supabase.js`) y `test-tanda-475.mjs` acotada — su barra la comparten
ahora dos pantallas.

**En curso / pendiente**: nada a medias. **Sigue sin ejecutar
`supabase-migration-idioma-chino.sql`** (tanda 472). De la cola de PINGU
queda SOLO el botón de VISTA (cuadrícula / lista / archivador). Rigores
pendientes desde la 443. Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 476 — la Pokédex, con la tira de una expansión)

**Hecho**: PINGU: «la Pokédex tiene que ser igual». Y lo decía de dos
pantallas escritas aparte: la tira de datos de una expansión la montaba
`js/mi-coleccion.js` y la cabecera de la Pokédex la montaba `pokedex.js`
con SU PROPIA familia de clases (`.mc-pdx-caja`, `.mc-pdx-cifra`…) para
decir lo mismo — dos moldes para el mismo objeto se separan (la 316). Y
ocupaba: dos cajas apiladas, 230 px antes del primer Pokémon; ahora una
tira de 92. El molde compartido vive en `js/mi-coleccion/diapos.js`.
Tres detalles que costaron: (1) las reglas de deslizar colgaban de
`#mcAlbumProgreso`, así que van por clase —pero por `mc-tira-datos` y no
por `.mc-diapos` a secas, porque esa la usa también el bloque de
«Estadísticas» del panel, que es una rejilla larga y no una tira—; (2) la
rejilla de escritorio era de tres columnas FIJAS y la Pokédex pinta dos o
tres según si «el que menos» es otro que «el que más» (la 466), así que
`auto-flow: column`; (3) el anillo flotante también colgaba del
identificador, y sin generalizarlo caía debajo de la cifra.

**Y una trampa de las pruebas, apuntada en CLAUDE.md**: la especie de una
carta sale del NOMBRE y no de `dex_ids` (a propósito). Un fixture con
`name: 'Carta 1'` deja la Pokédex A CERO y la prueba se queda afirmando
cosas sobre una pantalla vacía, sin que nada dé error. Me pasó escribiendo
la prueba de esta tanda.

**Ficheros**: `js/mi-coleccion/diapos.js` (NUEVO), `js/mi-coleccion.js`,
`js/mi-coleccion/pokedex.js`, `css/mi-coleccion.css`, `SCHEMA.md`,
`BITACORA.md`, `CLAUDE.md`. En la rama `pruebas`: `test-tanda-476.mjs`
(NUEVO, 29 comprobaciones, que mira LAS DOS pantallas porque el molde es
compartido) y cuatro repintadas —400, 414 y 466 por las clases que
cambian, más las de la 475—.

**En curso / pendiente**: nada a medias. **Sigue sin ejecutar
`supabase-migration-idioma-chino.sql`** (tanda 472). De la cola de PINGU
quedan: las carpetas con subcarpetas al estilo de Dex y el botón de VISTA
(cuadrícula / lista / archivador). Rigores pendientes desde la 443.
Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 475 — los cuatro mandos, detrás de un ⋮)

**Hecho**: PINGU: «estás ocupando mucho espacio arriba… he pensado en poner
tres puntos como pasa en la aplicación de Dex». La cabecera de una
expansión llevaba cuatro iconos en fila —marcar varias, favorita, compartir
y el engranaje de «al añadir»—, y cuatro iconos seguidos sin una palabra
al lado son un acertijo: hay que pulsarlos para saber qué hacen. Ahora la
cabecera es el título y UN botón, y dentro del menú los tres mandos van con
su nombre escrito. De paso se arregla algo que llevaba tiempo torcido:
«Copiar lo que me falta» ahora dice **«Copiar las 7 que me faltan»** en
pantalla, que es lo que PINGU echaba de menos cuando dijo «es un botón que
no hace nada». Va con `<details>` y no con un `<dialog>` a propósito —es un
menú corto que cuelga de su botón, y se abre sin JavaScript—, con las dos
cosas que un `<details>` no hace solo: cerrarse al elegir y cerrarse al
tocar fuera. Pero NO al tocar los desplegables de «al pulsar +», que son un
ajuste y se cambian los dos seguidos. El engranaje propio desaparece: un
desplegable dentro de otro desplegable es un acertijo. Se van
`.mc-album-iconos` y `.mc-ajustes-caja`.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `SCHEMA.md`, `BITACORA.md`. En la rama `pruebas`:
`test-tanda-475.mjs` (NUEVO, 28 comprobaciones) y cinco repintadas —409,
412, 426, 430 y 461—, todas por lo mismo: hay que abrir el menú antes de
pulsar, porque encontrar un elemento no es poder pulsarlo.

**En curso / pendiente**: nada a medias. **Sigue sin ejecutar
`supabase-migration-idioma-chino.sql`** (tanda 472). De la cola de PINGU
quedan: la Pokédex con los datos deslizables como las expansiones, las
carpetas con subcarpetas al estilo de Dex, y el botón de VISTA
(cuadrícula / lista / archivador). Rigores pendientes desde la 443.
Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 474 — las migas de pan)

**Hecho**: PINGU: «estás ocupando mucho espacio arriba… el botón de volver
atrás, yo quitaría ese botón». Las CUATRO pantallas con un «dentro» —una
expansión, un Pokémon, una carpeta y un álbum soñado— llevaban su propia
chapa de volver, escrita cuatro veces y con tres pintas distintas según la
tanda que la hubiera tocado (458, 459, 465). Cada una ocupaba una fila de
44 px para ella sola, y lo decía al revés: una chapa cuenta A DÓNDE VAS y
lo que hace falta saber es DE DÓNDE VIENES. Ahora son migas, con el molde
en `js/mi-coleccion/migas.js` (sin dependencias, porque lo usan tres
ficheros). Dos formas: la corta —«Expansiones ›», «Pokédex ›»— cuando el
título grande de debajo ya dice dónde estás, y la de dos pasos —«Carpetas
› Mis dúos»— cuando no lo hay. Y **no es un «enlace pocho»**: eso es un
`link-btn` azul y subrayado en una fila de botones; una miga es un rótulo
gris encima del título. Los identificadores (`mcAlbumVolver`, `pdxVolver`,
`mcAlbVolver`) se quedan igual a propósito — hay media docena de pruebas
que los pulsan. El clic va DELEGADO porque la miga se pinta con la
pantalla: un `addEventListener` sobre algo que todavía no existe no
engancha nada y no da error, o sea que el botón saldría y no haría nada.

**Ficheros**: `js/mi-coleccion/migas.js` (NUEVO), `mi-coleccion.html`,
`js/mi-coleccion.js`, `js/mi-coleccion/pokedex.js`,
`js/mi-coleccion/albumes.js`, `css/mi-coleccion.css`, `SCHEMA.md`,
`BITACORA.md`. En la rama `pruebas`: `test-tanda-474.mjs` (NUEVO, 25
comprobaciones) y **ocho pruebas repintadas por la 473 y la 474** —382,
398, 412, 418, 426, 427, 430, 459 y 461—, todas por lo mismo: los filtros
de una expansión viven ahora DENTRO del panel y el botón de variantes es
uno en vez de dos. Encontrar un elemento no es poder pulsarlo.

**En curso / pendiente**: nada a medias. **Sigue sin ejecutar
`supabase-migration-idioma-chino.sql`** (tanda 472). De la cola de PINGU
quedan: los cuatro iconos de cabecera tras un ⋮ (va ahora), la Pokédex con
los datos deslizables como las expansiones, las carpetas con subcarpetas,
y el botón de VISTA (cuadrícula / lista / archivador). Rigores pendientes
desde la 443. Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 473 — la barra de una expansión, como la de «Cartas»)

**Hecho**: lo que PINGU pidió mirando Dex. Dentro de una expansión había
CINCO controles sueltos en la tira —orden, «solo las que me faltan»,
rareza, categoría y los dos de variantes— y en el móvil había que
deslizarla para ver la mitad; la pestaña «Cartas» resolvió esto en la 449
y la 450 y ésta era la última pantalla de la sección sin hacerlo. Ahora la
barra son DOS chapas: «Filtros» (con su cuenta) y el de variantes, más una
✕ que sale cuando hay algo puesto y que borra también lo escrito. El
reparto es el de la 441: fuera lo que se toca cada dos por tres (juntar o
separar variantes), dentro lo que se pone una vez (orden, rareza,
categoría, «solo las que me faltan»). Y el de variantes es UN botón que
dice el ESTADO —«Variantes juntas» / «Variantes separadas»— y no lo que
pasa al pulsarlo: eran dos chapas y una siempre estaba de adorno. Se van
con ellas `.mc-vista-variantes` y `.mc-chip-vista`.

**Y dos arreglos de la hoja que valen para los CUATRO paneles de la
sección**: (1) el pie va `sticky; bottom: 0`, y un sticky solo se pega
cuando hay algo que desplazar — con pocos filtros dentro se quedaba pegado
al último grupo y debajo colgaba media pantalla en blanco; ahora el cajón
es una columna flexible con el cuerpo a `flex: 1` (y `min-height: 0`, sin
el cual un hijo de flex no baja de su contenido y el pie se sale). (2) **Y
el `[open]`, que casi cuesta los cuatro**: poner `display: flex` en el
`<dialog>` a secas pisa la regla del navegador que esconde un diálogo
cerrado, así que el panel se queda A LA VISTA SIEMPRE. No da error y en mis
capturas ni se notó; lo cantó la prueba, comprobando que al cerrar deja de
verse — el atributo `open` sí pasaba a false.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `SCHEMA.md`, `BITACORA.md`, `CLAUDE.md`. En la
rama `pruebas`: `test-tanda-473.mjs` (NUEVO, 35 comprobaciones).

**En curso / pendiente**: nada a medias. **Sigue sin ejecutar
`supabase-migration-idioma-chino.sql`** (tanda 472): hasta entonces no se
puede guardar una carta china. De la cola de PINGU quedan: quitar los dos
«volver» por migas de pan al estilo de Dex, los cuatro iconos de cabecera
tras un ⋮, la Pokédex con los datos deslizables como las expansiones, y
las carpetas con subcarpetas. Lo que NO entra en la 473 y PINGU mencionó:
el botón de VISTA (cuadrícula / lista / archivador), que es una pantalla
nueva y no un reordenado de la barra. Rigores pendientes desde la 443.
Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 472 — el idioma con el que añades lo manda el catálogo)

**Hecho**: lo que PINGU llamó «totalmente necesario». El idioma de una
carta nueva salía de `IDIOMA_POR_DEFECTO` (`'es'`) o de una preferencia
guardada en UNA clave compartida por los cuatro catálogos, así que con el
selector en inglés la carta se guardaba en español. Ahora la lista de
idiomas y el que viene puesto salen del CATÁLOGO: en el occidental se
ofrecen los ocho occidentales, y en el japonés y el chino **solo el suyo**
— porque en el catálogo japonés no existe una carta en español, y ofrecerlo
era afirmar que sí (la norma de la 447). Tres trampas esquivadas: (1) va
ANTES del atajo de `cambiarVista`, porque entre español e inglés no cambia
el mercado y la función se sale por un `return` — puesto después, el caso
más común habría sido el único sin arreglar; (2) la memoria de la 461
lleva ahora el catálogo en la clave (`mcTocarIdioma-en`), que era lo que
se llevaba el «español» a todos los catálogos para siempre; (3)
`idiomasParaEditar()`, porque un `<select>` cuyo valor no está entre sus
opciones **se queda con la primera** — y PINGU tiene cartas japonesas
guardadas con `idioma: 'es'`, así que abrirlas en el catálogo japonés les
habría reescrito el idioma al guardar, sin dar ningún error. El escáner
también: su desplegable se montaba UNA sola vez, así que no se enteraba de
los cambios de catálogo.

**OJO, HAY MIGRACIÓN**: `supabase-migration-idioma-chino.sql`. Las dos
tablas (`user_collection` y `user_wants`) tienen un CHECK con los idiomas
permitidos y el chino no estaba, así que hasta ejecutarla **no se puede
guardar una carta china**: Postgres la rechaza con un 23514. Este sí da
error, pero el texto crudo no dice qué hacer, así que `traducir()` lo
cambia por el nombre del fichero. Y **el aviso de /admin → Base de datos
NO la ve**: `REQUISITOS` comprueba que una COLUMNA se pueda leer, y aquí no
falta ninguna columna — lo que cambia es qué valores admite.

**Ficheros**: `supabase-migration-idioma-chino.sql` (NUEVO),
`js/mi-coleccion.js`, `js/mi-coleccion/datos.js`, `js/cardmarket.js`
(entra el idioma `zh`), `SCHEMA.md`, `BITACORA.md`. En la rama `pruebas`:
`test-tanda-472.mjs` (NUEVO, 25 comprobaciones con el navegador de
verdad: los cuatro catálogos, la memoria por catálogo, la carta nueva y
la línea vieja que no se le cambia el idioma sola) y arreglada
`test-tanda-391.mjs`.

**SUITE ENTERA PASADA** sobre la tanda 471: **193 verdes, 1 rojo**, y el
rojo era la guarda de los UPSERT parciales (391), que mira el TEXTO de
alrededor y no vio que las columnas las monta `cardToRow` — la lección de
la 307. Al arreglarla saltó algo peor: su ventana de ±1.200 caracteres
arrastraba la función de al lado, que llama a `setToRow`, y `setToRow`
tiene `name` — así que **daba por buena una `cardToRow` sin `name`**
(comprobado quitándoselo: verde). Ahora la unidad es la FUNCIÓN que hace
el upsert más los mapeadores que ella llama, y vuelve a morder.

**En curso / pendiente**: nada a medias, salvo ejecutar la migración. De
la cola de PINGU quedan, en este orden: la barra de una expansión al
estilo de Dex (buscador · Vista · UN botón Agrupar/Dividir · «Filtros»
en un panel, y los selects sueltos fuera), quitar los dos «volver» por
migas de pan, los cuatro iconos de cabecera tras un ⋮, la Pokédex con
los datos deslizables como las expansiones, y las carpetas con
subcarpetas al estilo de Dex. Rigores pendientes desde la 443. Portada a
169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 471 — el catálogo japonés y los dos chinos, que se llenan solos)

**Hecho**: contestado el «¿de dónde estamos cogiendo?» de PINGU — de
TCGdex, y sí lo tiene todo; el agujero era nuestro y estaba en dos sitios
que nadie había juntado. (1) Las CARTAS de un mercado solo entraban por
«Importar los que faltan» de /admin, que es un bucle en una pestaña del
navegador: ~550 sets entre el japonés y los dos chinos, más de un cuarto
de hora sin tocar nada, y nadie lo ha terminado nunca — y el que lo deja a
medias no deja señal, porque los sets están ahí con su nombre. (2) Los
LOGOS los cura `cartas-detalle`, que lleva `const MERCADO = 'WEST'` desde
el primer día con un comentario que lo justificaba y que dejó de ser
verdad en la **437**, cuando el selector de catálogo puso el japonés
delante de la gente. Sin esa cura los sets asiáticos no tienen `serie_id`,
y **sin serie no hay respaldo de imagen** (`urlDeLogoPorPartes` devuelve
null), ni `card_count_*` (la estantería medía «0 de 0»), ni fecha (la era
entera al fondo). O sea que «no hay logos» y «no hay cartas» eran el MISMO
agujero visto dos veces, y el remedio es el mismo: pedir el set COMPLETO,
que trae las cartas, la serie, el logo, las cuentas y la fecha de una vez.
Nueva función programada **`catalogo-asia.mjs`**, cada seis minutos, dos
fases (el listado de un mercado por turnos —solo INSERTA lo que no
tenemos, un upsert pisaría con null lo que la cura acaba de rellenar— y la
visita a un set, que hace los dos trabajos con una sola petición). ~15 sets
por pasada: los tres catálogos llenos en unas cuatro horas, y de vida
corta. Y de paso, fuera las TRES copias a mano que quedaban: `setToRow`,
`cardToRow`, `sinDuplicados`, `fechaDeSet` y `codigoLiveDeSet` se mudan a
**`js/catalogo-tcgdex.js`** (sin dependencias), `js/tcgdex.js` las
reexporta y la función de Netlify las importa; `IDIOMA_POR_MERCADO` ahora
**es** `MERCADOS`. La guarda cambia de pregunta: de «¿dicen lo mismo?» a
«¿es LA MISMA?», más un barrido de texto para que nadie vuelva a escribir
una copia con otro nombre.

**Ficheros**: `js/catalogo-tcgdex.js` (NUEVO),
`netlify/functions/catalogo-asia.mjs` (NUEVO), `js/tcgdex.js`,
`netlify/lib/carta-detalle.mjs`, `admin/index.html`, `SCHEMA.md`,
`BITACORA.md`. En la rama `pruebas`: `test-tanda-471.mjs` (NUEVO, 51
comprobaciones, sin red y sin base) y repintadas `test-tanda-322.mjs`
(las guardas de copia, ahora de identidad), `test-tanda-329.mjs` y
`test-tanda-345.mjs` (leían `js/tcgdex.js` como texto buscando lo que se
ha mudado — y la de la 329 pasaba VACÍA, que es el «un barrido que no
llega no dice nada» de la 307 otra vez).

**En curso / pendiente**: nada a medias. **NO HACE FALTA NINGUNA
MIGRACIÓN**: todas las columnas existen. Lo que queda dicho en el SCHEMA
y es honesto decirlo: las cartas asiáticas **no se engordan** (rareza,
tipos, ilustrador — una petición por carta, ~20.000 más), así que en el
catálogo japonés los filtros de rareza y tipo del álbum no tienen con qué
filtrar todavía; y **la Pokédex japonesa sigue vacía** porque
`cartas-pokedex` deduce la especie del NOMBRE y 「フシギダネ」 no casa con
ninguna lista inglesa. De la cola de PINGU siguen pendientes, en este
orden: el IDIOMA AL AÑADIR debe seguir al selector de catálogo (lo
siguiente, y lo llamó «totalmente necesario»), la barra de una expansión
al estilo de Dex (buscador · Vista · UN botón Agrupar/Dividir ·
«Filtros» en un panel), quitar los dos «volver» por migas de pan, los
cuatro iconos de cabecera tras un ⋮, la Pokédex con los datos
deslizables como las expansiones, y las carpetas con subcarpetas.
Rigores pendientes desde la 443. Portada a 169,9 de 170 KB.

## 2026-10-03 — PINGU-Claude (tanda 470 — la carta en negro, y la culpa era de `position`)

**Hecho**: lo de PINGU por tercera vez, y esta vez con el mecanismo. La
imagen ESTABA —cargada, a tamaño completo, opacidad 1— pero se pintaba
debajo del nombre: `.mc-carta-sinfoto` va a `position: absolute` y la
imagen no estaba posicionada; las de las cartas que NO tienes llevan
`opacity: .55` y un `filter`, que CREAN contexto de apilamiento y las
suben. O sea que `.tengo img { filter: none; opacity: 1 }` —la regla que
pone la carta en color— era la que la escondía. La 441 arregló esto mismo
en el otro pintador y dejó el porqué escrito al lado. Lo resolvió un
`elementFromPoint`, no leer el CSS: por eso la prueba es un hit-test. Y el
panel verde de la 469 se queda en un marco fino.

**Ficheros**: `css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`:
`test-tanda-470.mjs` (NUEVO) y un arreglo en la 469.

**En curso / pendiente**: sigue la cola de PINGU — el idioma al añadir
siguiendo al selector de catálogo; la barra de una expansión al estilo de
Dex (buscador · vista · agrupar/dividir en UN botón · Filtros en panel);
quitar los dos «volver» y poner migas; los iconos de cabecera detrás de un
⋮; la Pokédex con datos deslizables; y Carpetas rediseñadas con subcarpetas.
**Rigores pendientes: 443 a 470.**

## 2026-10-03 — PINGU-Claude (tanda 469 — la carta que se quedaba en negro)

**Hecho**: PINGU lo dijo dos veces y la primera no lo encontré porque miré
con las imágenes FUNCIONANDO. TCGdex no tiene escaneo de cientos de cartas;
cuando la cadena se agota, el `onerror` quita el `<img>` y queda el nombre
sobre el fondo del bolsillo — en oscuro, un rectángulo negro—, y el de la
carta que TIENES es el que peor sale porque pierde la sombra del bolsillo
vacío y gana el brillo del plástico. Y «ponerse con color» no se podía
arreglar donde se intentó: la regla era `.tengo img { filter: none }`, que
descolorea una imagen que no está. Ahora el bolsillo sin foto dibuja una
carta —marco por dentro, nombre en medio— y la tuya, en verde. La prueba
sirve las imágenes CAÍDAS a propósito.

**Ficheros**: `css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`:
`test-tanda-469.mjs` (NUEVO).

**En curso / pendiente** (cola de PINGU, por orden): el idioma al añadir
tiene que seguir al selector de catálogo —si miras el inglés, la carta se
añade en inglés y no en español—; la barra de una expansión al estilo de
Dex (buscador · vista · agrupar/dividir en UN botón · Filtros en un panel);
quitar los dos «volver» y poner migas; los cuatro iconos de la cabecera
detrás de un ⋮; la Pokédex con sus datos deslizables y más pequeños; y el
rediseño de Carpetas con subcarpetas, al estilo de Dex.
⚠️ Nidoran: la migración está ejecutada y las cartas volverán cuando
`cartas-pokedex` repase la cola.
**Rigores pendientes: 443 a 469.**

## 2026-10-03 — PINGU-Claude (tanda 468 — el botón de atrás, que no volvía)

**Hecho**: PINGU: «abro una expansión, le doy para atrás y me saca al
inicio». TODA la navegación usaba `replaceState`, que cambia la entrada
actual en vez de añadir una, así que el historial no tenía a dónde volver
dentro de la página. Y abrir una expansión no tocaba la dirección
siquiera. Ahora cada paso empuja su entrada y `popstate` reconstruye la
pantalla; `?ver=album&set=sv8` abre esa expansión directamente. Se prueba
con `goBack()` de verdad, no mirando si se llama a `pushState`.

**Ficheros**: `js/mi-coleccion.js`, `SCHEMA.md`. En `pruebas`:
`test-tanda-468.mjs` (NUEVO).

**En curso / pendiente**: esto era el REQUISITO para quitar los botones de
«← Todas las colecciones» y «← Todos los Pokémon», que es lo siguiente,
junto con la barra de mandos al estilo de Dex (buscador · vista ·
agrupar/dividir en UN botón · Filtros en un panel) y la Pokédex con sus
datos deslizables. ⚠️ Nidoran: PINGU ejecutó la migración y ahora no sale
ninguna carta — es la cola de `cartas-pokedex`, que tiene que repasarlas;
hay que comprobar que la función esté corriendo.
**Rigores pendientes: 443 a 468.**

## 2026-10-03 — PINGU-Claude (tanda 467 — el orden de una expansión y los datos deslizables)

**Hecho**: PINGU, con Dex al lado: «los filtros arriba, porque tiene más
sentido; y las estadísticas en deslizables; y luego ya las cartas». Las dos
corrigen tandas de esta semana. (1) EL ORDEN: la 412 puso el progreso
delante «porque es lo que se viene a ver», y con cinco filas de controles
encima tenía razón; con los controles ya en una fila (459), lo primero que
se hace es BUSCAR, y para eso había que pasar por tres tarjetas. Ahora:
buscador, mandos, datos, cartas. (2) LA TIRA: la 459 la quitó con un motivo
prestado de la 439, pero el síntoma que medí era otro —las tres se encogían
a 97 px—: la tira no estaba mal, es que NO SE DESLIZABA, le faltaba el
`flex-shrink: 0`. Vuelve, con puntos que son botones y que siguen a la tira
en las dos direcciones.

**Ficheros**: `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/mi-coleccion.js`, `SCHEMA.md`. En `pruebas`: `test-tanda-467.mjs`
(NUEVO) y arreglos en la 412 y la 459, que afirmaban el orden y la rejilla
de antes.

**En curso / pendiente**: ⚠️ sigue sin ejecutar
`supabase-migration-nidoran-genero.sql`. La cabecera de la Pokédex tiene las
mismas tarjetas de datos y de momento NO se desliza — se dejó así porque
ahí no se aplastan; si PINGU las quiere iguales, es el mismo CSS.
**Rigores pendientes: 443 a 467.**

## 2026-10-03 — PINGU-Claude (tanda 466 — dos tarjetas que decían lo mismo)

**Hecho**: en la cabecera de la Pokédex, «El que más tienes» y «El que
menos» son el MISMO Pokémon mientras todas tus especies tengan una carta
—o sea, al empezar, que es cuando más gente lo mira—. Dos cajas idénticas
al lado. Ahora la segunda solo sale si es otro.

**Ficheros**: `js/mi-coleccion/pokedex.js`, `SCHEMA.md`. En `pruebas`:
`test-tanda-466.mjs` (NUEVO).

**En curso / pendiente**: ⚠️ sigue sin ejecutar
`supabase-migration-nidoran-genero.sql`. **Rigores pendientes: 443 a 466.**

## 2026-10-03 — PINGU-Claude (tanda 465 — el repaso de Mi colección)

**Hecho**: repaso de las siete pestañas a 390 y 1280 px en los dos temas,
que es lo que PINGU pidió antes de irse a dormir. (1) NI UN ENLACE POCHO:
los ocho que quedaban —volver a «Tus álbumes» y a «Carpetas», los tres
«Limpiar», el «Copiar enlace» de un álbum, el «Borrar» y el «Cancelar» del
diálogo, el «Quitar la nota» y el «Borrar este álbum»— pasan a chapas, y
los tres que no se pueden deshacer con `.mc-chip-peligro`. La prueba barre
las SIETE pestañas en vez de mirarlos uno a uno. (2) LAS CUATRO CIFRAS DE
LA CABECERA se salían de la caja con una colección cara: «14.040,00 €» mide
más que su columna de 79 px. No lo cantó nadie porque la rejilla no se
rompe —lo que se sale es el contenido—, así que la prueba siembra una
colección cara a propósito. Dos y dos por debajo de 560 px. (3) «Solo los
que tengo» de la Pokédex, de casilla a chapa. (4) El bloque de Cambios
llevaba una raya de separación que ya no separaba de nada.

**Ficheros**: `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/mi-coleccion.js`, `SCHEMA.md`. En `pruebas`: `test-tanda-465.mjs`
(NUEVO).

**En curso / pendiente**: ⚠️ sigue sin ejecutar
`supabase-migration-nidoran-genero.sql`. **Rigores pendientes: 443 a 465.**

## 2026-10-03 — PINGU-Claude (tanda 464 — el gráfico del valor, con rangos)

**Hecho**: PINGU, con una captura de Collectr: «quiero que pongas en
cuántos días quieres ver el gráfico». Seis chapas (1D · 7D · 1M · 3M · 6M ·
MAX) debajo del dibujo, con la elección recordada en el navegador. El corte
se hace por FECHA y no por número de puntos —con una foto al día son lo
mismo, pero con un hueco «los últimos 7 puntos» serían diez días—, y el
rótulo dice los días DE VERDAD, como Collectr, no el nombre del rango. Y el
tope: `valorHistorico` pedía 90 días, así que 6M y MAX habrían enseñado lo
mismo que 3M sin decirlo; ahora pide 730. De paso se van el punto del
último día y el pie de fechas, que repetían lo que dice la cifra de arriba,
y el relleno pasa a degradado.

**Ficheros**: `js/mi-coleccion/grafica-valor.js`, `js/mi-coleccion/datos.js`,
`js/mi-coleccion.js`, `css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`:
`test-tanda-464.mjs` (NUEVO) y un arreglo en la 377 (el alto de la gráfica).

**En curso / pendiente**: de la lista de la noche queda el repaso del resto
de pestañas de Mi colección (Panel, Cartas, Pokédex, Carpetas, Buscar) con
el criterio de PINGU: más pequeño, más simple, sin enlaces pochos y sin
botones anticuados. ⚠️ Sigue sin ejecutar
`supabase-migration-nidoran-genero.sql`. **Rigores pendientes: 443 a 464.**

## 2026-10-03 — PINGU-Claude (tanda 463 — las rarezas oficiales, con su marca)

**OJO, CHOQUE DE NÚMEROS (y van SEIS)**: esta era la 462 y la cogió Ibai
mientras la escribía; pasa a ser la **463**. Van 384, 394, 413, 420, 456 y
esta. Lo que lo caza es mirar el REMOTO justo antes del push, no la
bitácora al empezar.

**Hecho**: PINGU mandó la tabla de rarezas de la web oficial de Pokémon en
español con sus dibujos. Los nombres pasan a ser los OFICIALES («Rara
Doble», no «Doble rara»), que además son los que devuelve TCGdex en
español: mientras no coincidían, el filtro de rareza mandaba a la consulta
la clave inglesa y NUESTRA palabra, y las filas guardadas con la de TCGdex
se quedaban fuera — el filtro enseñaba la mitad sin dar error. Ahora
`formasDeRareza()` manda las TRES escrituras. Y cada rareza lleva su marca
impresa (círculo, diamante, una estrella, dos) con cuatro acabados: negro,
tornasol, oro y rosa-y-verde. Sale en los chips de filtro de las dos
pantallas y en la ficha de una carta. La tabla `ALIAS_TCGDEX` de la 455 se
queda sin excepciones.

**Ficheros**: `js/rarezas.js` (NUEVO), `js/carta-traducciones.js`,
`js/carta-nucleo.js`, `js/mi-coleccion.js`, `css/carta-holo.css`,
`css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`: `test-tanda-462.mjs`
(NUEVO) y arreglos en la 324, 331, 374 y 382, que esperaban los nombres
viejos.

**En curso / pendiente**: de la lista de la noche quedan el gráfico del
valor con rangos 1D/7D/1M/3M/6M/MAX y el repaso del resto de pestañas de Mi
colección. ⚠️ Sigue sin ejecutar `supabase-migration-nidoran-genero.sql`.
**Rigores pendientes: 443 a 463.**
**OJO, CHOQUE DE NÚMEROS (y van CINCO)**: esta tanda se escribió como la
459 y al ir a subir el remoto ya tenía la 459, la 460 y la 461 de la otra
sesión de PINGU, así que lo mío pasa a ser la **462** (renombrados los
comentarios, la prueba y el rigor). Lo cazó, otra vez, mirar el remoto
justo antes del commit.

## 2026-10-03 — PINGU-Claude (tanda 462 — los efectos de las cartas solos, el activo en el centro y /repeticiones)

**Hecho**: tres cosas que pidió PINGU, por orden.

1. **Los efectos de las cartas, solos.** «Cuando tienes el Casco Suerte,
   que si te hacen daño robas 2, automáticamente; si te pega Budew, que no
   puedas usar objetos; fíjate en esos detalles de todas las cartas». Un
   lector de los TEXTOS de las cartas (`js/constructor/textos.js`, nuevo)
   convierte cada frase de un ataque en un paso que la partida ejecuta, con
   la regla de **todo o nada** (un ataque entendido a medias se queda como
   estaba). Las habilidades pasivas salen como rasgos (defensas, cierres,
   bonos, lo que pasa al caer), y las herramientas y energías que
   reaccionan al recibir un ataque actúan solas. Lo que un ataque deja para
   el turno siguiente (vetos, «no se retira», escudos…) se ve en la mesa
   como chapas. Una Herramienta ya no cuenta como Objeto (Budew no la
   bloquea; Jellicent ex sí, porque lo dice).
2. **El Pokémon activo, en el centro del tapete**, y no la pareja carta +
   vida (columnas de los lados a partes iguales y un contrapeso del ancho
   del pie a la izquierda de la carta).
3. **/repeticiones** (página nueva, en «Jugar»): pegas el registro de una
   partida de TCG Live —en español o en inglés— y se reproduce sola, con
   pausa, jugada a jugada, turno a turno, deslizador, velocidades, teclado,
   el registro al lado y «Girar la mesa». La mesa es la del laboratorio
   (mismas clases). El registro se lee entero y las 60 cartas de cada
   jugador cuadran en cada foto; los casos que el registro cuenta a medias
   (gemelos, la jugada contada dos veces, el KO sin su línea) están en
   SCHEMA. Con un ejemplo real con los nombres cambiados por Rojo y Azul.

Y dos arreglos de la mesa del laboratorio que salieron mirando la
repetición: la última carta del descarte salía con su NOMBRE encima del
dibujo, y en el móvil la vida del activo de arriba se metía 10 px debajo
de su mazo.

**Ficheros**: `js/constructor/textos.js` (nuevo), `js/constructor/partida.js`,
`js/constructor/efectos.js`, `js/constructor/laboratorio.js`,
`css/laboratorio.css`; `repeticiones.html`, `js/repeticiones.js`,
`js/repeticiones/registro.js`, `js/repeticiones/estado.js`,
`js/repeticiones/iconos.js`, `js/repeticiones/ejemplo.js` y
`css/repeticiones.css` (nuevos); el enlace «Repeticiones» en el menú
«Jugar» de 30 páginas más (`index.html` incluida: se apretó un comentario
para que cupiera, 174.017 de 174.080 bytes); `netlify/functions/sitemap.mjs`;
`SCHEMA.md`. En `pruebas`: `test-tanda-462.mjs` y `rigor-tanda-462.py`
(nuevos), y `test-tanda-312` / `test-tanda-326`, que cuentan ya 32 páginas
con pie.

**La suite entera** (la lección de la 447): verde salvo siete rojos de
/mi-coleccion que no eran de esta tanda (386, 405, 426, 428, 436, 438 y
444). Al ir a subir, la otra sesión ya los había arreglado en SU 459, así
que aquí no se tocan. **Rigor**: 23 mutaciones, las 23 detectadas (tres
salieron sin detectar a la primera y destaparon huecos de la prueba: un
veto de objetos que bloqueara también los partidarios, el intercambio
contado dos veces mirado por NOMBRE —los dos Abra se llaman igual— en vez
de por su sitio, y los controles del móvil medidos por alto en vez de por
filas).

**En curso / pendiente**: diez textos de ataque de la ficha de pruebas
siguen sin leerse (los que copian otro ataque, como el Zoroark ex de N, o
cuentan de formas que no se repiten): se juegan preguntando el daño, como
antes. La forma EXACTA del KO y del premio en el registro en español no
está confirmada con un registro que los tenga (el de ejemplo acaba en
rendición): se reconocen por «Fuera de Combate» y «cartas de Premio», y si
el KO se escapa se deduce de la vida. Si alguien pega uno con KO, mirar
que no salga ninguna línea «sin entender».

## 2026-10-03 — PINGU-Claude (tanda 461 — la chapa de la versión y la cabecera como Dex)

**Hecho**: (1) La chapa de la VERSIÓN encima de cada carta, en una
expansión con «separar variantes» y en Cartas. El rótulo existía desde la
383 pero iba DEBAJO de `.mc-bolsillo-enlace`, que va a `inset: 0`: llevaba
78 tandas pintado y tapado, y la prueba de la 398 lo contaba con un
`textContent` y salía verde. La nueva hace `elementFromPoint` sobre el
centro de la chapa. (2) El velo del reverse, que es un tornasol en
`mix-blend-mode: screen`: el catálogo guarda UN escaneo por carta, así que
sin él las dos casillas son la misma imagen. (3) La cabecera de una
expansión con cuatro iconos de 36 px (marcar varias · favorita · compartir
· ajuste de «al añadir») donde había cuatro chapas con texto, y el ajuste
AHORA SE RECUERDA. Más el repaso de tamaños que pidió PINGU: mandos todos a
la misma altura, la flecha del desplegable sin pisar la letra, el buscador
a 40 con ratón y las tarjetas de datos más compactas. De 920 px hasta la
primera carta (antes de la 459) se ha pasado a 494.

**Ficheros**: `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/mi-coleccion.js`, `SCHEMA.md`. En `pruebas`: `test-tanda-461.mjs`
(NUEVO) y arreglos en la 398 y la 430, que miraban el texto de controles
que ahora son iconos.

**En curso / pendiente**: sigue la lista de la noche. Hecho hasta ahora:
459 (la pantalla de una expansión en el móvil), 460 (los dos Nidoran) y
461. Queda: la tabla de rarezas en español con sus iconos oficiales
(círculo, diamante, estrella, dos estrellas…), el gráfico del valor con
rangos 1D/7D/1M/3M/6M/MAX y más detallado, y el repaso del resto de
pestañas de Mi colección (Panel, Cartas, Pokédex, Carpetas, Buscar) con el
mismo criterio: más pequeño, más simple y sin enlaces pochos.
⚠️ Sigue sin ejecutar `supabase-migration-nidoran-genero.sql`.
**Rigores pendientes: 443 a 461.**

## 2026-10-03 — PINGU-Claude (tanda 460 — los dos Nidoran)

**Hecho**: PINGU: «has metido al Nidoran macho dentro de la categoría de
Nidoran hembra en la Pokédex». Al aplastar un nombre para buscar su número
se borraban los símbolos de género, así que ♀ y ♂ caían los dos en
«nidoran» y ganaba el primero de la tabla (la hembra, 29). El sprite SÍ
salía bien, porque `slugLimitless` ya traducía el símbolo — el mecanismo
correcto estaba escrito dos funciones más abajo. La prueba recorre las
1.025 especies exigiendo que no haya dos con la misma clave.

**Ficheros**: `js/torneos/sprites-pokemon.js`,
`supabase-migration-nidoran-genero.sql` (NUEVO), `SCHEMA.md`. En `pruebas`:
`test-tanda-460.mjs` (NUEVO).

**En curso / pendiente**: ⚠️ **HAY QUE EJECUTAR
`supabase-migration-nidoran-genero.sql`** en el SQL Editor: `dex_ids` está
guardado y las filas viejas dicen 29 donde toca 32; sin eso la Pokédex
sigue igual con el código ya arreglado. Sigue la lista de la noche (ver la
entrada de la 459).

## 2026-10-02 — PINGU-Claude (tanda 459 — la pantalla de una expansión, en el móvil)

**Hecho**: PINGU, con la captura de una expansión en el móvil: «en movil se
ve fatal y ademas ahi hay otro enlace pocho». Dos cosas. (1) El «← Todas
las colecciones» era un `link-btn` azul subrayado; ahora es una chapa, y la
prueba barre la pantalla entera exigiendo que no quede NINGUNO —van tres
veces que lo pide—. (2) Las tres tarjetas de datos iban en un `.mc-tira`
que NUNCA se deslizó: un hijo de flex cede antes de desbordar (la 320), así
que en 390 px se encogían a 97 px cada una, con el anillo encima del título
y 328 px de alto. Ahora son una rejilla —la primera cruza la fila, las
otras dos la comparten—, como la 440 hizo con el Panel. Y los mandos pasan
a la tira `.mc-mandos` de Buscar y la Pokédex: de 264 px en cuatro filas a
una sola fila de 44. De 920 px hasta la primera carta a 729.

De regalo, el barrido de la prueba nueva —que busca la FORMA: cajas que se
deslizan con hijos que ceden— cazó uno que no era de esta tanda:
`.mc-estanteria-barra select { flex: 1 1 220px }` le ganaba por peso al
`flex: 0 0 auto` de `.mc-mandos` desde la 445, así que los dos desplegables
de la estantería tampoco se deslizaban.

**Y SE HA PASADO LA SUITE ENTERA**, que llevaba sin pasarse desde la 447:
siete rojos, **ninguno de esta tanda**. La 447 sacó «Cartas» del menú a
propósito y dejó la pantalla, y tres pruebas (426, 436, 444) seguían
clicando `[data-pestania="cartas"]` —se caían con un tiempo agotado que
parece un fallo de la web—; la 440 sacó «Pagado» de la cabecera (428); la
451 cambió el orden del vistazo de expansiones y le añadió el de Cambios
(436); la 454 metió el logo inglés como último respaldo de los catálogos
asiáticos (438); la 458 rehizo la tarjeta de set (405) y su comentario
nuevo empujó un `// sin rango:` fuera de las siete líneas que mira el
barrido de la 386. Es la lección de la 447 otra vez: entre la 448 y la 458
se corrieron solo las pruebas de cada tanda.

**Ficheros**: `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/mi-coleccion.js`, `SCHEMA.md`. En la rama `pruebas`:
`test-tanda-459.mjs` (NUEVO) y arreglos en la 386, 405, 417, 426, 428, 436,
438 y 444.

**En curso / pendiente**: PINGU se ha ido a dormir y ha dejado la noche
pedida — repaso entero de Mi colección (todas las pestañas, móvil y
ordenador), con permiso para reestructurar y para QUITAR lo que sobre
(«prefiero la sencillez»). La lista, suya: Nidoran ♀ y ♂ separados en la
Pokédex; la tabla de rarezas en español con sus iconos oficiales (círculo,
diamante, estrella, dos estrellas…); el gráfico del valor con rangos
1D/7D/1M/3M/6M/MAX y más detallado, como Collectr; la carta que al añadirla
se queda oscura y debería ponerse en color; la fila de filtros («Al añadir»
fuera, «Copiar lo que me falta» fuera, alinear, y la flecha del desplegable
que pisa el texto); las chapas de VARIANTE (Normal / Holo / Reverse Holo)
encima de cada carta en Cartas y en una expansión con «separar variantes»,
con la reverse distinguida a la vista; y los mandos de la cabecera de una
expansión al estilo de Dex (marcar varias, corazón de favorita y compartir
arriba), todo más PEQUEÑO: buscador, filtros y tarjetas de datos.
Y siguen pendientes: el editor de sets del panel de admin (logo y código a
mano, con subida de imagen) y los nombres occidentalizados de los sets
japoneses. **Rigores pendientes: 443 a 459.**

## 2026-10-02 — PINGU-Claude (tanda 457 — el pulido de estilos del laboratorio)

**Hecho**: PINGU, con el laboratorio a dos (la 456) hecho: «mejorar los
estilos tanto para móviles como para ordenadores, lo más profesional
posible, cuidando los detalles». Se miró a ojo cada estado del laboratorio
a siete anchos y en los dos temas, con cartas de mentira de la proporción
real servidas con `page.route` (la red a TCGdex está cerrada aquí), y se
arregló lo que salió:
- La mesa a dos cabe **sin desplazar** en 1280×720, 1366×768, 1440×900,
  1536×864 y 1920×1080 (antes sobraban hasta 107 px).
- La mano va en **una fila**: con muchas cartas se solapan, y la que
  señalas sube. En una tableta la mano en dos filas tapaba la banca.
- La banca de cinco cabe en una fila en la tableta.
- La vida cambia de color al bajar, y el cambio de turno se anuncia en el
  tapete.
- El registro separa los turnos con una línea.
- El muñeco son fichas de verdad.
- Antes de empezar, los premios son seis huecos.
- El dorso lleva marco.
- El menú del móvil es una hoja con velo y asa.
- Al ganar sale una copa.
- Sin imágenes (la lección de la 441: se miró también con TODAS caídas),
  el nombre que queda debajo salía **cortado** si tenía una palabra larga
  («Determination», «Fezandipiti», «Risky» en el estadio). Ahora se parte
  antes que perder letras.
- Otros detalles del móvil y la tableta (en SCHEMA.md).

**Ficheros**: css/laboratorio.css, js/constructor/laboratorio.js,
SCHEMA.md. En `pruebas`: test-tanda-457.mjs y rigor/rigor-tanda-457.py
(NUEVOS); test-tanda-456.mjs (la comprobación de «menos movimiento»
admite el selector agrupado, y la cabecera se mira también con un turno
LARGO) y rigor/rigor-tanda-456.py (el ancla del latido, con el selector
agrupado).

**En curso / pendiente**: nada. **Pruebas**: la 457 en verde y su rigor,
**28 de 28** mutaciones detectadas (cada una rompe el ORIGEN de algo que
no da error: la mesa que no cabe, la mano en dos filas, la barra siempre
verde, el aviso que se queda con los clics, el nombre cortado sin
imagen…). La 456 y la 384, en verde. **Suite entera** sobre la 451 de la
otra sesión, con las dos encima: **173 de 180** (en tres tiradas a la vez;
los rojos, repetidos solos). Las siete rojas están **igual de rojas en el
remoto puro** (18ce986, sin la 456 ni la 457), así que son de la otra
sesión y no las toco: 415, 426, 428, 436, 437 y 444 (Mi colección) y 434
(la cadena de imágenes ya acaba en el CDN de la 435). Para la sesión que
lleve Mi colección. De la 452 a la 455 de la otra sesión llegaron con la
suite ya corrida (tocan Mi colección y el admin, y la 452 exporta `icon`
de js/icons.js): encima de ellas, la 456, la 457 y la 384, otra vez en
verde.

**OJO, CHOQUE DE NÚMEROS (y van de la CINCO a la ONCE)**: el laboratorio a
dos se escribió como 426, y la otra sesión fue llegando al remoto antes
cada vez: con la 426 a la 430 (pasó a ser la 431), con la 431 a la 438 (la
439, y este pulido la 440), con la 439 a la 442 (la 443 y la 444), con la
443 a la 451 mientras corrían los rigores (la 452 y la 453), con la 452
mientras corría la suite (la 453 y la 454), con la 453 mientras se
empaquetaba (la 454 y la 455), y con la 454 y la 455 mientras se daba
permiso para subir. Van como **456** y **457**, montadas encima de la 455,
y esta vez se suben directamente. Un bundle numerado se queda viejo en
cuanto el otro sube algo: el número se decide al INTEGRAR, no al escribir.
**Los bundles `tanda-431` y `tanda-454-455` que se entregaron ya no valen:
no se integran.**

## 2026-10-02 — PINGU-Claude (tanda 456 — el laboratorio a dos: «tú contra ti», y una mesa de un clic)

**Hecho** (escrita como 426, y renumerada como 431, 439, 443, 452, 453 y
454: la otra sesión llegó antes con las siete, así que va como **456**):
lo que pidió PINGU con tcgmasters.net de referencia: poder jugar en el
laboratorio **tú contra ti** con los dos mazos que quieras, sin perder el
**muñeco**; elegir si vas **primero o segundo**; la **tabla de
probabilidades siempre a mano**; y jugar más fácil: **clic** hace lo obvio
(si una energía o una evolución vale para varios Pokémon, brillan los que
valen y eliges tocando uno), **clic derecho** o mantener pulsado enseña la
carta, y el «⋯» tiene todo lo demás. Y la mesa nueva: un tapete con los
dos lados enfrentados, que GIRA para enseñar abajo al que le toca. El
motor de dos (`Mesa`) lleva premios de verdad, debilidad y resistencia, el
estadio compartido y deshacer de los dos lados; las cartas que tocan al
rival (Juez, Iono, Xerosic, los martillos…) ya hacen lo que pone. El
detalle, en SCHEMA.md.

**Una revisión independiente** (otra instancia, sin ver cómo se hizo)
encontró cinco cosas que ya están arregladas y con su prueba: una ventana
que HAY que contestar (coger premios, quién sube) se podía cerrar con
Escape y dejaba la mesa bloqueada; cambiar un mazo en «Nueva partida» y
cancelar cambiaba la partida en juego (ahora es un borrador hasta
«Repartir»); el foco se caía al `body` tras cada jugada y al cerrar una
ventana (y con él el teclado); la cabecera se partía entre 1.200 y 1.300
px; y cerrar el panel estrecho mandaba el foco a una lengüeta escondida.
De paso, uno de antes: el **Ctrl+Z del laboratorio le llegaba también al
constructor** de debajo y deshacía un cambio del MAZO. El teclado vive
ahora en la ventana, en captura, y lo que usa el laboratorio no sigue.

**Ficheros**: js/constructor/partida.js (la `Mesa`), js/constructor/efectos.js,
js/constructor/laboratorio.js (la pantalla, reescrita), css/laboratorio.css
(reescrita; la paleta de energías, intacta), js/constructor.js (le pasa
`userId` al laboratorio, para «Mis mazos»), SCHEMA.md. En `pruebas`:
test-tanda-456.mjs y rigor/rigor-tanda-456.py (NUEVOS), y
test-tanda-384.mjs (los selectores de la mesa nueva; el menú de una carta
sale ahora del «⋯», porque tocarla la juega).

**En curso / pendiente**: nada a medias. Ideas que se quedan fuera: un
reloj por turno, y arrastrar cartas (con clic ya se hace todo). Lo único
que el laboratorio no sabe del otro jugador es lo que el catálogo no
tiene (efectos sin automatizar: siguen «a mano», como antes).
**Pruebas**: la 456 en verde y su rigor, **60 de 60** mutaciones
detectadas, pasado otra vez sobre el árbol FINAL (con la 457 encima). Las
cuatro que se escapaban en la primera pasada —el tabulador, el corte de la
cabecera…— se cazan con la prueba contra la FORMA del fallo: que nada de
la barra se pise, a ocho anchos. Y en la pasada final se escapó una: con
la cabecera de la 457 el título ya no se aprieta con un turno corto, así
que quitarle su mínimo no se notaba. Cede con un turno LARGO («Turno 12 ·
Jugador 2 — …»): sin el mínimo baja a 0 px y «Laboratorio» se monta en los
modos. La prueba mira ahora los dos. En verde también la 384, 299, 305,
309, 310, 311, 312, 313 y 315. La suite entera, en la entrada de la 457.
**OJO, CHOQUE DE NÚMEROS (y van CINCO)**: la 456 la usamos los dos a la
vez. La otra sesión llegó antes al remoto —con la 456 Y la 457—, así que lo
mío pasa a ser la **458**. Van 384, 394, 413, 420 y 456. Lo que funciona
sigue siendo mirar el remoto JUSTO ANTES del commit, no al empezar: esta
vez lo cazó el `git push` rechazado, que es tarde pero no tanto.

## 2026-10-02 — PINGU-Claude (tanda 458 — la Pokédex como Buscar y la tarjeta de set como Dex)

**Hecho**: la pantalla de una especie tiene ya la MISMA barra que Buscar
—buscador, filtros e idioma—, el «← Todos los Pokémon» es una chapa y no un
enlace, y los sprites bajan de 68 a 48 (de 96 a 64 en la cabecera): no
estaban deformados, estaban AGRANDADOS, y un dibujo de pocos píxeles
pintado más grande enseña las escaleras.

**La tarjeta de un set, como la de Dex**: logo pequeño a la izquierda sobre
su arte desenfocado, y a la derecha nombre, fecha y progreso como TEXTO. El
nombre se escondía detrás del logo porque un logo occidental lo lleva
escrito — con los japoneses eso dejó de valer.

**Y un fallo de producción que salió al arreglar una prueba**: el nombre de
una carta del álbum solo se pintaba cuando la cadena de escaneos estaba
VACÍA, y casi nunca lo está. El caso normal es que tenga direcciones y
fallen todas, y entonces el bolsillo se quedaba EN BLANCO — que dice lo
contrario de lo que pasa, porque un bolsillo vacío ya significa «no la
tienes». Es la 441 otra vez. Y son DOS pintadores de bolsillo.

También: el **avatar** de la cabecera (la consulta del perfil propio no
pedía `avatar_url`; la de otra persona sí, así que fallaba solo en la tuya)
y la **gráfica del valor**, que ahora se repinta al añadir o quitar cartas.

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/pokedex.js`,
`css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`: `test-tanda-415.mjs` y
`test-tanda-434.mjs`.

**En curso / pendiente**: quedan DOS cosas que pidió PINGU y no entran
aquí: (1) en /admin, una lista de sets con logo y código editables a mano,
con subida de imagen para el logo; (2) los nombres de los sets japoneses
occidentalizados (hoy salen en kanji) — hace falta decidir de dónde se saca
ese nombre, porque TCGdex da el japonés. Rigores pendientes: 443 a 456.

## 2026-10-02 — PINGU-Claude (tanda 455 — los filtros de la Pokédex, y los enums traducidos)

**Hecho**: dos cosas que salieron de una captura de Bulbasaur.

**La forma**: los chips de la 453 iban sueltos en la pantalla, apostando a
que casi siempre quedaría un grupo. En un Bulbasaur con 31 cartas quedaron
TRES con siete rarezas: 300 px antes de ver una carta. Ahora es la MISMA
barra que Buscar —botón de «Filtros» con su chapa y el mismo panel—. Medido:
64 px entre el nombre y la primera carta.

**El fondo, que es peor**: salían «Pokémon · Pokémon» y «Común · Común ·
Ninguno · None». No es un fallo de pintado: **TCGdex traduce los enums**, y
como el catálogo se ha importado en varios idiomas la columna tiene las dos
formas MEZCLADAS. Agrupando por el valor crudo salen dos chips que dicen lo
mismo — y lo que no se veía: pulsar uno dejaba fuera la mitad de las
cartas. Ahora se agrupa por el RÓTULO y cada rótulo se queda con todas las
formas crudas; y en Buscar, donde el filtro va en la consulta, se mandan
las dos formas.

Y para los casos en que la palabra española de TCGdex no es la nuestra
(«Ninguno», «Rara Ilustración»), `ALIAS_TCGDEX` en js/carta-traducciones.js.
El día que salga otra se verá como un chip repetido, que es un fallo que al
menos SE VE.

**Ficheros**: `js/mi-coleccion/filtros.js`, `js/mi-coleccion/pokedex.js`,
`js/mi-coleccion.js`, `js/carta-traducciones.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`: `test-tanda-453.mjs`.

**En curso / pendiente**: nada a medias. Sigue pendiente que PINGU dé a
«Completar los datos que faltan de los sets» en /admin. Rigores pendientes:
443 a 455.

## 2026-10-02 — PINGU-Claude (tanda 454 — las fechas de los sets, y los logos que faltan)

**Hecho**: arreglado de raíz el orden de las eras. El botón «Traer códigos
de TCG Live» del admin pedía el set COMPLETO, sacaba el código **y tiraba
la fecha de salida que tenía en la mano** — y esa fecha es la que ordena
las eras, así que Escarlata y Púrpura y Mega Evolución se iban al fondo por
no tenerla. Ahora el botón se llama «Traer códigos y fechas que falten»,
entra también lo que solo necesita la fecha, y mira TODOS los mercados.

El contador de /admin dice ahora por mercado: sets, cuántos con logo,
cuántos con fecha, cartas y **cuántas con foto**. Eso separa las dos causas
de «no se ven las cartas japonesas», que desde la web se ven igual.

Y la tarjeta de colección prueba un dibujo más antes de rendirse: el logo
OCCIDENTAL del mismo set. El identificador de set es el mismo en todos los
mercados, así que la dirección con `/en/` suele existir aunque la japonesa
no.

Y empujando PINGU («pero te puedes traer los logos y las cartas asiáticas
desde la API de TCGdex») salió el eslabón que faltaba: nuestro código YA
pide los assets con el idioma del mercado y YA monta la dirección a mano
cuando el manifiesto no lista el fichero… **pero esa ruta empieza por la
SERIE**, y la serie —como el código y la fecha— solo está en el set
completo, así que estaba a null. Sin serie, el respaldo devuelve null.
«No hay logos japoneses» y «no hay fotos japonesas» eran el MISMO agujero
visto dos veces. El botón guarda ahora las tres cosas, sin pedir nada de
más.

**PARA PINGU, dos cosas que necesitan tus manos**:
1. En /admin → Cartas, dale a **«Traer códigos y fechas que falten»**. Eso
   coloca Escarlata y Púrpura y Mega Evolución donde van.
2. Lo de Bulbapedia NO sirve: sus imágenes van por hash del nombre de
   fichero, no hay patrón que montar. La que sí promete es Limitless, que
   tiene las japonesas desde Sol y Luna; nuestra función monta
   `…/SET/SET_123_R_EN_SM.png` y habría que comprobar si existe la variante
   `_JP_`. Ábrela a mano y me dices, que aquí la red a esa CDN está cerrada.

**Ficheros**: `admin/js/admin.js`, `admin/index.html`, `js/mi-coleccion.js`,
`SCHEMA.md`.

**En curso / pendiente**: nada a medias. La portada sigue en 170,0 de
170,0. Rigores pendientes: 443 a 454.

## 2026-10-02 — PINGU-Claude (tanda 453 — filtros dentro de un Pokémon)

**Hecho**: la ficha de una especie en la Pokédex tiene ya los mismos cuatro
grupos de filtros que Buscar. La diferencia que importa: **las opciones
salen de las cartas que hay**, no de los mapas de traducción. En Buscar no
hay de dónde sacarlas —21.000 cartas y la consulta trae 120—; aquí la
especie entera está en memoria. Y es mejor: dentro de un Pikachu, ofrecer
«Estadio» sería un filtro que deja la pantalla en blanco siempre. Con la
regla de que un grupo con menos de dos valores no se pinta, queda justo lo
que distingue unas cartas de otras: la rareza y, a veces, el tipo de
energía. Por eso van a la vista y no detrás de un botón.

Cada opción guarda el valor CRUDO y el rótulo traducido —se filtra con uno
y se lee el otro—, una carta sin curar no inventa un cajón «sin rareza», y
los filtros se limpian al cambiar de especie.

**Ficheros**: `js/mi-coleccion/filtros.js`, `js/mi-coleccion/pokedex.js`,
`js/mi-coleccion.js`, `css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`:
**NUEVA** `test-tanda-453.mjs`.

**En curso / pendiente**: nada a medias. La portada sigue en **170,0 de
170,0, sin un byte libre** (ver la entrada de la 452). Rigores pendientes:
443 a 453.

## 2026-10-02 — PINGU-Claude (tanda 452 — la burbuja del menú)

**Hecho**: el menú del móvil pasa a ser la **burbuja flotante** de Dex:
solo iconos, centrada, píldora translúcida con desenfoque. Lo que la
distingue de una barra no es el dibujo sino el ANCHO — mide lo que miden
sus cinco iconos en vez de ir de lado a lado. Los nombres no se borran, se
esconden en `sr-only`: `display: none` los sacaría del árbol de
accesibilidad y serían cinco dibujos sin nombre. Y la Pokédex estrena icono
propio (usaba `target`, que es una diana).

**OJO CON EL PESO**: meter ese icono en `js/icons.js` pasó la portada de
169,9 a **170,4** y la rompió. Ese fichero lo baja todo el mundo y la
portada usa dieciséis de sus setenta iconos. El icono se ha movido a
`js/mi-coleccion/iconos.js` —misma regla que la del CSS— y vuelve a caber,
pero **justo: 170,0 de 170,0, cero bytes libres**. La próxima tanda que
toque la portada tiene que empezar por hacer sitio; el plan está en
SCHEMA.md (sacar de `icons.js` los iconos de una sola pantalla, ~3 KB).

También: desde **Buscar** una carta abre la FICHA y no la página (el `href`
se queda para el Ctrl+clic y para Google); **tres cartas por fila en el
móvil** en vez de dos, bajando el mínimo de la rejilla y no fijando el
número; y **fuera el foco automático** al entrar en Buscar, que abría el
teclado y tapaba el botón de escanear.

Al cambiar la rejilla salió que `.mc-resultados` estaba definida DOS VECES
en la misma hoja y ganaba la de abajo: la segunda clase repetida en dos
tandas, después de `.mc-hoja`.

**Ficheros**: `js/icons.js`, **NUEVO** `js/mi-coleccion/iconos.js`,
`js/mi-coleccion.js`, `css/mi-coleccion.css`, `mi-coleccion.html`,
`SCHEMA.md`. En `pruebas`: `test-tanda-408.mjs`.

**En curso / pendiente**: nada a medias. Rigores pendientes: 443 a 452.

## 2026-10-02 — PINGU-Claude (tanda 451 — la franja de arriba no es el nombre)

**Hecho**: PINGU escaneó un Reshiram EX y en el buscador le quedó «BÁSICO
Reshiram EX pv180·». La franja de arriba de una carta es la FILA ENTERA:
fase a la izquierda, nombre en medio, puntos de vida y símbolo del tipo a
la derecha. Y no se arregla recortando más estrecho, porque están a la
MISMA altura que el nombre. Ahora se quita lo que se sabe que no es el
nombre, en los siete idiomas del escáner, y del «22/99» se coge el 22.

Se busca **nombre + número** y, si no sale nada, se repite solo con el
nombre: nunca se acaba en una pantalla vacía por una cifra mal leída. Y al
aflojar **el número se tira** — `afinarPorNumero` se ha QUITADO: desde la
450, si el número casa con algo la búsqueda ya lo encuentra, así que esa
función solo corría cuando el número no casaba con nada, y entonces ponía
primera una carta elegida por una lectura ya demostrada mala.

Escribiendo la prueba salió un fallo mío: en japonés y chino el limpiador
no hacía NADA. `\b` es el borde entre un carácter de palabra y uno que no
lo es, y para JavaScript un kanji no es carácter de palabra.

**Expansiones del Panel**: a UNA FILA. Y el motivo de que asomara una
cuarta era que las filas sobrantes miden cero pero **los huecos entre ellas
no** — la caja medía 169 donde la tarjeta mide 145. `row-gap: 0`, en los
dos vistazos («Tus cartas» lo tenía igual desde la 446).

**El orden de las expansiones**, que PINGU notó: el vistazo del Panel
ordenaba por cuántas tienes y ahora va por fecha, como la pantalla de
Expansiones. Y en la estantería había un NaN: con dos eras sin fecha,
`-Infinity − (-Infinity)`, y un comparador que devuelve NaN no ordena. Las
eras sin fecha son justo las recién salidas, porque `release_date` no viene
en el listado de TCGdex.

**Los cambios** se van a su propia pantalla (`?ver=cambios`), como
subpantalla sin pestaña igual que «Cartas»: eran una pantalla entera puesta
al final del Panel. En el Panel queda una tarjeta corta con su «Abrir». Y
el «Ver todas las estadísticas» pasa a tener la cabecera de los demás
bloques, que suelto debajo de Cambios parecía suyo.

**Ficheros**: `js/mi-coleccion/escaner.js`, `js/mi-coleccion.js`,
`js/mi-coleccion/estanteria.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`: **NUEVA**
`test-tanda-451.mjs`, y arreglos en 408, 410, 439 y 447 — la 410 llevaba
roja desde la **440**, defendiendo una tira deslizable que aquella tanda
sustituyó por una rejilla.

**En curso / pendiente**: nada a medias. Rigores pendientes: 443 a 451.

## 2026-10-02 — PINGU-Claude (tandas 449 y 450 — ordenar y filtrar como en Dex)

**Hecho**: la hoja de **«Ordenar por»** al estilo de Dex (sube desde abajo,
interruptor Descendente/Ascendente arriba, los criterios en lista con su
icono y una marca en el elegido), en Cartas Y en Buscar. Diez criterios en
Cartas y seis en Buscar —allí no hay precio de compra ni «cuántas tienes»,
porque la carta no es tuya—. Y los **filtros**: tipo de carta, tipo de
energía, tipo de entrenador, rareza, versión, estado y notas.

Lo que más importa de todo esto está en `js/mi-coleccion/filtros.js`, que no
importa nada del DOM para poder probarlo en Node: **lo que no se sabe va al
final mire como se mire**. El ilustrador y el número de Pokédex los rellena
`cartas-detalle` carta a carta, así que siempre hay cartas a medias; una sin
ilustrador ordenada como cadena vacía saldría LA PRIMERA. Por eso un orden
es una CLAVE más un SENTIDO y no un comparador, y por eso el sentido **no
puede ser un `reverse()`** —que es lo que hacía el viejo botón «Al revés»—.

**El fallo que PINGU encontró**: «Mewtwo 64» no devolvía nada. El buscador
exigía que «64» estuviera en el NOMBRE. Ahora un número suelto se busca
como número impreso O como número nacional de Pokédex, un número solo vale
como búsqueda entera, y si por nombre no sale nada se prueba por
ILUSTRADOR en una segunda consulta (un `or` no podría usar el índice del
nombre y recorrería 23.000 cartas en cada tecla).

Los filtros de Buscar van **en la consulta**: el catálogo tiene 21.000
cartas y la consulta trae 120, así que filtrar lo que vuelve sería filtrar
la muestra. Y la cuenta avisa cuando se llega al tope.

Los **tipos de entrenador eran ocho y teníamos cuatro** (faltaban máquina
técnica, máquina secreta de Rocket y el casino de Ciudad Trigal), y las
fases once y teníamos ocho —con «Restored» mal escrito, que TCGdex llama
`RESTORED` y por tanto no se traducía nunca—.

**PARA PINGU, lo del japonés y el chino**: hay un botón nuevo en /admin →
Cartas, **«Qué hay de cada mercado»**, que cuenta sets, sets con logo y
cartas de los cuatro. El código soporta los cuatro desde la 437; lo más
probable es que no se haya importado nunca. El botón lo dice en un segundo
y, si sale 0, el orden es «Buscar sets en TCGdex» y después «Importar los
que faltan».

**Ficheros**: **NUEVO** `js/mi-coleccion/filtros.js`, `js/mi-coleccion.js`,
`mi-coleccion.html`, `css/mi-coleccion.css`, `js/carta-traducciones.js`,
`js/mi-coleccion/datos.js`, `admin/index.html`, `admin/js/admin.js`,
`SCHEMA.md`. En `pruebas`: `herramientas/stub-supabase.js` (su `.or()`
no entendía `cs` ni `ilike`), **NUEVAS** `test-tanda-449.mjs` y
`test-tanda-450.mjs`, y arreglos en 399, 408, 422, 441, 447 y 449.

**En curso / pendiente**: nada a medias. Rigores pendientes: 443 a 450.

## 2026-10-02 — PINGU-Claude (tanda 448 — por qué el escáner no veía la clave)

**Hecho**: PINGU puso `OCR_API_KEY` en Netlify y el escáner seguía
diciendo «el lector de cartas no está configurado todavía». La causa más
probable es de Netlify y conviene tenerla escrita: **una variable nueva no
alcanza a una función que no ha cambiado**, porque Netlify no vuelve a
desplegar una función cuya suma de control es la misma; y además la
variable necesita el ámbito **Functions** (las de `netlify.toml` NO lo
tienen nunca). Este push cambia el fichero de la función, así que la
redespliega él solo.

Y para no volver a adivinar, la función se diagnostica: acepta cuatro
nombres de clave (`OCR_API_KEY`, `OCR_SPACE_API_KEY`, `OCRSPACE_API_KEY`,
`OCR_KEY`) y, cuando no encuentra ninguna, dice si le llegan variables
PARECIDAS —con su nombre, nunca su valor, que esto sale por HTTP— o si no
le llega ninguna, que es el otro fallo y pide otra cosa. El escáner enseña
ese detalle en pantalla mientras esté sin configurar.

**Ficheros**: `netlify/functions/leer-carta.mjs`, `js/mi-coleccion.js`. En
`pruebas`: `pruebas/test-leer-carta.mjs`.

**En curso / pendiente**: estoy montando el **componente de filtros** que
pidió PINGU (ordenar por fecha de salida, nombre, ilustrador, número de
Pokédex, precio, cantidad y tipo de energía; y filtrar por estado, notas,
tipo de carta, tipo de energía, tipo de entrenador y rareza). Toca
`mi-coleccion.html`, `js/mi-coleccion.js` y `css/mi-coleccion.css` — **si
eres IBAI, no los toques**. Rigores pendientes: 443 a 448.

## 2026-10-02 — PINGU-Claude (tanda 447 — el menú como el de Dex, Buscar y el escáner de cartas)

**Hecho**: el menú de /mi-coleccion queda como el de Dex —**Panel ·
Expansiones · Pokédex · Carpetas · Buscar**—, con «Cartas» fuera del menú
pero la PANTALLA intacta (se llega por el «Ver todas» del panel y por
`?ver=cartas`, que es lo que apuntan los enlaces viejos). **Buscar** es
nueva: busca en todo el catálogo con la consulta que ya existía
(`buscarCartas`, la misma del bloque de «añadir»), y su estado vacío lleva
el botón de **escanear cartas**, igual que en Dex.

Y el **escáner**. Lo de Dex en tiempo real NO se puede hacer en una web
(es una app nativa y usa el framework Vision de Apple; el equivalente del
navegador solo va en Chrome tras una bandera y en Safari de iOS murió con
iOS 18), así que está el otro modo que Dex también tiene, el «Snap»:
encuadras con dos guías, tocas, y se recortan y se mandan a leer **solo
dos franjas** —nombre arriba, código e ilustrador abajo— y no la foto.
Medido: 5 KB las dos juntas. La franja de arriba BUSCA y la de abajo
AFINA; el número leído sube su carta al principio sin esconder las demás.
`netlify/functions/leer-carta.mjs` llama a **OCR.space** (plan gratuito de
verdad, siete idiomas, sin SDK, el base64 tal cual).

**PENDIENTE DE UN HUMANO**: hay que poner **`OCR_API_KEY`** en las
variables de entorno de Netlify (clave gratuita de ocr.space). Hasta
entonces la función devuelve 503 con `sinConfigurar` y el escáner lo dice
en pantalla — el resto de /mi-coleccion no se entera.

De paso salió un fallo del DOBLE, no de la web: `name_search` y `name_key`
de `tcg_cards` son columnas **generadas** y el doble no las generaba, así
que cada fixture se las escribía a mano. La prueba del escáner buscaba
«Charizard» contra un fixture sin ella y daba CERO resultados con la carta
delante. Ahora el doble las genera al sembrar con la MISMA función que usa
la web, y para eso `normalizeSearch` se muda de `js/tcgdex.js` a
`js/texto.js` (reexportada, que la importan diez sitios).

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `js/texto.js`, `js/tcgdex.js`, **NUEVO**
`js/mi-coleccion/escaner.js`, **NUEVO**
`netlify/functions/leer-carta.mjs`, `SCHEMA.md`, `CLAUDE.md`. En la rama
`pruebas`: `herramientas/stub-supabase.js`, los arreglos de
`test-tanda-322/369/372/375/392/399/406/408.mjs`, y **NUEVAS**
`pruebas/test-tanda-447.mjs` y `pruebas/test-leer-carta.mjs`.

Y al pasar la suite ENTERA —que entre la 437 y la 446 no se había
pasado— salieron **once rojos que no eran de esta tanda**: la guarda de
`MERCADOS` llevaba desde la 438 leyendo el fichero del que esa constante se
había MUDADO (o sea, la guarda contra las copias que se separan se había
separado ella); cuatro pruebas de /mi-coleccion seguían abriendo la página
sin `?ver=cartas` desde que la 440 puso el Panel de pestaña por defecto;
`test-tanda-372` contaba seis colecciones donde hay cuatro porque la 443
pinta las mismas tarjetas en el Panel; y la 406 le exigía 44 px CON EL
RATÓN a un filtro que la 445 encogió a propósito. Todas arregladas en la
rama `pruebas`; ninguna tocó la web.

**En curso / pendiente**: nada a medias en ningún fichero. Queda de la
lista de PINGU el **componente de filtros compartido** (barra de búsqueda,
idioma, interruptor cuadrícula/lista y la hoja «Ordenar» de Dex con sus
ocho criterios, más estado, variantes, rareza y tipos), que se montará UNA
vez y se usará en Cartas, Buscar y Expansiones. Rigores pendientes: 443,
444, 445, 446 y 447.

## 2026-10-02 — PINGU-Claude (tanda 446 — el menú bajo la barra, la carta huérfana y los enlaces pochos)

**Hecho**: tres cosas que PINGU vio en una captura del panel y que no dan
error de ninguna clase.

**1. El menú pegajoso se metía DEBAJO de la barra del sitio.** La barra de
arriba es `sticky` a 0 y mide **70 px medidos**; el menú se pegaba a 16, o
sea que al bajar se le metía por detrás y la barra le tapaba el PRIMER
elemento: «Panel» desaparecía y parecía que el menú empezaba en «Cartas».
Ahora se pega a 88 —los 70 de la barra más aire, en la retícula de 4—, que
es el mismo cálculo que la barra de marcar de la 426.

**2. La carta huérfana del vistazo.** PINGU: «hay como una fila y luego una
carta más». Y NO se arregla bajando `DE_VISTAZO` a siete, porque **cuántas
caben depende del ancho**: siete en un escritorio, tres en un móvil. Se
pide UNA fila (`grid-template-rows: auto` y `grid-auto-rows: 0` con
recorte) y el número se ajusta solo a cualquier ancho sin que nadie lo
mida. La prueba lo comprueba a dos anchos justamente por eso.

Y un tropiezo por el camino: el primer intento fue solo `grid-auto-rows: 0`
—sin el `grid-template-rows`—, y entonces TODAS las filas son automáticas,
también la primera. Las cartas se salían de su fila de alto cero y se
seguían viendo las dos.

**3. «Ver todas» y «Copiar enlace» eran enlaces pochos**: texto azul
subrayado al lado de un título en negrita, que se lee como el enlace de un
pie de página. Pasan a ser chapas. **Sin tocar la clase global `.link-btn`**
—la usa media web—, y la prueba vigila que siga subrayada en el resto del
sitio.

**Ficheros**: `css/mi-coleccion.css`. Pruebas: `test-tanda-446.mjs` (NUEVO).

**Suite**: 446, 444, 443, 441, 440, 436, 312, 313, 299 y 311, en verde.

**En curso / pendiente**: PINGU pidió en el mismo mensaje un cambio grande
de estructura, con capturas de Dex:

- **El menú pasa a ser Panel · Expansiones · Pokédex · Carpetas · BUSCAR.**
  «Cartas» sale del menú (la pantalla se queda, se llega por el «Ver todas»
  del panel) y entra una sección nueva que busca en TODO el catálogo.
- **Ordenar, como hoja inferior** y no como `<select>`: segmentado
  Descendente/Ascendente arriba y ocho criterios con icono y marca —
  cantidad en posesión, expansión, fecha de lanzamiento, ilustrador,
  nombre, **número nacional**, precio y **tipo de energía**—. Los dos
  últimos no estaban en mi lista y los tenemos (`dex_ids` y `types`).
- **Cuadrícula / Lista**, en todos los sitios donde se ven cartas.
- El componente de filtros, **UNO** usado en los tres sitios: escrito tres
  veces, en un mes dicen tres cosas distintas.

**Y EL ESCÁNER, que no es lo que parecía**: la captura de Dex enseña DOS
recuadros guía, «Name & Type» arriba y «Code & Artist» abajo. No reconoce
la ilustración contra una base de imágenes: hace **OCR de dos franjas** y
cruza el texto con su catálogo. Nosotros tenemos los cuatro datos que lee
(`name`, el tipo, `tcg_online_code`, `local_id` e `illustrator`), así que
el problema no es «una API que reconozca cartas» sino leer cuatro cadenas
de una foto. El obstáculo es la decisión, y es de PINGU: OCR en el
navegador (gratis, pero ~2 MB de librería, y CLAUDE.md prohíbe
dependencias nuevas de npm para el cliente) u OCR en una función de
Netlify (cumple las reglas, cuesta dinero y pide una clave).

---

## 2026-10-02 — PINGU-Claude (tanda 445 — los campos del tema OSCURO en todo el sitio, y la barra, más pequeña y cuadrada)

**Hecho**: PINGU, con capturas del móvil: «los filtros son demasiado
grandes y eso queda cutre, además no están en la mitad de la pantalla —
¿ves que "Filtros" está muy a la izquierda? — y el color es blanco aun en
el modo oscuro». Tres cosas, y la del color era mucho más gorda de lo que
parecía.

**1. EL BLANCO NO ERA DE LOS FILTROS: ERA DE TODO EL SITIO.** En
`css/style.css`, la regla base de `input`, `textarea` y `select` llevaba
`background: #ffffff; color: #0d1b2a` **escritos a fuego, sin token**. O
sea que en el tema oscuro TODOS los campos y desplegables de PokeDoc eran
islas blancas sobre el fondo azul oscuro: el login, el buscador de cartas,
el foro, los torneos. Y alguien se dio cuenta A MEDIAS: veinte líneas más
abajo hay una regla `:root[data-theme='dark'] select` que le cambia el
color a la FLECHA del desplegable para el tema oscuro. Se pensó en el
tema; el fondo se quedó.

**Y el medidor de contraste de la 311 no lo cantó nunca, con razón**:
blanco con letra oscura contrasta de maravilla. Lo que estaba mal no era
la legibilidad, era que no es la superficie del tema. Esa es la lección:
**una prueba de contraste no es una prueba de que el tema oscuro esté
bien.** Ahora va con `var(--white)` y `var(--text)`, que es lo que debió
ser desde el principio — `--white` ES la superficie y en oscuro vale
#182430.

**2. «Filtros» pegado al canto izquierdo**: un `scroll-snap-type` que puse
yo en la 444. El enganche alinea el primer hijo con el borde del
CONTENEDOR y no con el de su relleno, así que el chip se iba al canto de
la pantalla y quedaba descuadrado respecto al buscador de arriba. Fuera:
enganchar tiene sentido para una tira de tarjetas que se leen de una en
una, no para una fila de botones que se empuja con el dedo. Ahora los dos
arrancan en el mismo píxel.

**3. Más pequeños**: la letra baja a `--t-sm`, el relleno se recorta y el
desplegable del orden pasa de ~470 px a 180. **El ALTO no baja en pantalla
táctil y no es negociable**: son 44 px, que es la regla de la casa para lo
que se pulsa y el caso exacto que CLAUDE.md manda dejar tras
`pointer: coarse`. Con ratón sí bajan a 36, que es donde sobraban.

**4. Y la Pokédex, que se me había quedado con la barra vieja.** La 444
solo tocó Cartas y Expansiones. Eso explica además lo del buscador
cortado: estaba en un `flex-wrap` con el interruptor, dos desplegables y
la cuenta, y **un hijo de flex cede antes de desbordar** (la lección de la
320), así que el campo se encogía hasta partir el texto a media palabra
—«Busca un Pokémon o su nú…»—. Con su propia fila cabe entero: medido en
390 px, buscador de 342 con el texto completo y los mandos en UNA fila.

**Ficheros**: `css/style.css` (ESTE toca TODA la web), `css/mi-coleccion.css`,
`mi-coleccion.html`.

**Suite**: pasada entera después del cambio, no solo la de /mi-coleccion,
porque `style.css` lo baja todo el mundo.

**En curso / pendiente**: los rigores de la 443, la 444 y la 445. Y queda
por mirar si el cambio de los campos deja algo raro en pantallas con
formularios largos que no están en la suite (/admin, el constructor).

---

## 2026-10-02 — PINGU-Claude (tandas 443 y 444 — la estantería filtrable, la barra como la de Dex, y la cabecera solo en el Panel)

**Antes de nada, una RETRACTACIÓN.** La entrada de la 442 dejó apuntado
que en Expansiones había «dos colecciones rotuladas SWS». **No existe tal
fallo**: era el fixture de las capturas, que generaba el código de TCG Live
como las tres primeras letras del id, y `swsh11`/`swsh12` dan los dos
«SWS». Con los códigos de verdad son SSP, SCR, TWM, TEF, SIT y LOR, todos
distintos. Segunda vez en dos días que un dato inventado para mirar una
pantalla miente sobre la pantalla; la primera fueron las capturas vacías de
la 441. **Un fixture inventado también miente.**

### Tanda 443 — la estantería, filtrable

Hay 206 colecciones y de casi todas no tienes ninguna carta, así que la
pantalla son doscientas tarjetas diciendo «0 de N · 0 %». Un chip **«Solo
las empezadas»** las quita. Ojo con el matiz: la tanda 409 ya probó a
SUBIRLAS arriba y lo descartó con razón —con cien empezadas eso no es un
orden, es la misma lista sin fechas—; **un filtro es otra cosa: QUITA las
doscientas**. Y con él, la cuenta de cuántas estás viendo («2 de 8»), igual
que la de las cartas.

La prueba cubre lo que de verdad se rompe solo: **dos filtros a la vez**.
Con la serie puesta Y el chip pulsado tiene que quedar la empezada DE ESA
SERIE, no las dos empezadas ni las cuatro de la serie. Y que el total sea
el del CATÁLOGO y no el de lo ya filtrado — si se calculara sobre lo
filtrado diría «2 de 2», que es cierto y no sirve de nada.

### Tanda 444 — la barra como la de Dex, y la cabecera solo en el Panel

PINGU, con capturas de Dex: «puedes deslizar para un lado para ver los
filtros y botones, además la barra de búsqueda es muy sutil; lo nuestro
ocupa demasiadísimo». Y: «lo de mi colección debería verse solo en el
panel, porque en los demás módulos es un espacio desperdiciado».

**La cabecera, solo en el Panel.** ~400 px de avatar, cifras e interruptor
repetidos en las cinco pestañas para decir lo que el Panel cuenta entero.
**El `<h1>` NO se va con ella**: un `display: none` lo saca también del
árbol de accesibilidad y la pantalla se queda SIN encabezado — y la prueba
que cuenta `<h1>` habría seguido en verde, porque cuenta en el DOM. Se
queda en `sr-only`.

**La barra**: buscador en su propia fila y sin fondo blanco ni sombra, y
todos los mandos en UNA fila que se desliza. La misma en Cartas y en
Expansiones.

**Y me contradigo con la 439 A PROPÓSITO, que quede escrito**: allí se quitó
una tira deslizable. Pero aquella llevaba CIFRAS, que hay que LEER, y una
cifra cortada por el borde se lee como un fallo. Estos son MANDOS: que
asome medio botón es la pista de que hay más, y es el gesto normal en un
móvil. No es la misma pieza — que nadie «arregle» una con el argumento de
la otra.

**Medido**: en un móvil, hasta ver la primera carta, **de 804 px a 230**.

**Y la trampa de siempre otra vez**: `.mc-hero-mini` ponía `padding: 0`,
pero el relleno del móvil lo pone un `@media` que va más abajo en la hoja y
**un `@media` no suma especificidad**. Ganaba el de abajo por orden y la
cabecera «escondida» seguía midiendo 32 px en el móvil y cero en el
escritorio. Se cazó MIDIENDO EL ALTO, no mirando la captura; de ahí que la
prueba exija cero y no «que tenga la clase puesta». Se arregla con dos
clases (`.mc-hero.mc-hero-mini`), no moviendo la regla de sitio.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`mi-coleccion.html`. Pruebas: `test-tanda-443.mjs` y `test-tanda-444.mjs`
(NUEVAS).

**Suite**: 444, 443, 441, 440, 439, 412, 405, 409, 311 (contraste), 312
(objetivos táctiles), 313, 299 y 305 — todas en verde.

**En curso / pendiente**: los rigores de la 443 y la 444. Y PINGU confirmó
que **los tres SQL están ejecutados**, así que la Pokédex por catálogo y las
Trainer Gallery devueltas a su serie ya están en vivo.

---

## 2026-10-02 — PINGU-Claude (tanda 442 — el pie de los precios, una guarda muerta, y los dos rigores cerrados)

**Hecho**: tanda pequeña, salida entera de pasar los rigores de la 440 y
la 441.

**1. El pie de los precios, solo donde hay precios.** El `<p>` que explica
de dónde sale el precio de Cardmarket vive FUERA de las pestañas, así que
salía en las cinco — también en Expansiones y en la Pokédex, donde no hay
ni un precio. Ahora se apaga igual que la nota del valor de la 413.

**2. Fuera un `z-index` que no hacía nada.** El rigor de la 441 le quitó el
`z-index: 1` a la imagen de carta y **la prueba siguió pasando**. No es un
agujero de la prueba: es que la línea sobra. Dos elementos POSICIONADOS se
pintan en orden de DOM y la imagen va detrás del nombre en el HTML, así que
ya queda encima; lo que hace el trabajo es el `position: relative`. La
respuesta a una guarda que no guarda es BORRARLA, no escribirle una
comprobación — y la mutación ahora ataca el `position`, que es lo que
manda.

**3. CORRECCIÓN de lo que escribí en la entrada de la tanda 440.** Allí
puse que la cabecera funciona «porque sin recuadro las cifras caben».
**Está a medias.** El rigor devolvió el recuadro a `.mc-cifra` y la prueba
siguió pasando: las columnas son `1fr`, así que el reparto no depende del
relleno. Lo que hizo que cupieran fue bajar el ancho mínimo de la pista de
150 px a 72; quitar la caja es lo que hace que a 72 px se LEAN —con el
relleno puesto, 40 de esos 72 se los come el `padding` y el número se sale
de su hueco—. Son dos cosas. Queda bien escrito en SCHEMA.md, que es el
documento vivo.

**Rigores**: la 440 pasó de 7/11 a **11/11** y la 441 de 8/9 a **9/9**. Las
cinco que se escaparon eran comprobaciones flojas MÍAS y ninguna un fallo
del código. Las tres que merecen quedar escritas:

- **`count()` cuenta también lo escondido.** Ponerle `hidden` al `<h1>`
  pasaba la prueba tan tranquila. Lo que se pide es `isVisible()`.
- **Comprobar que algo «es una rejilla» no es comprobar que REPARTE.** Una
  rejilla de una sola columna de 300 px sigue siendo una rejilla, y es el
  carrusel otra vez pero sin poder deslizarlo.
- **Mirar el `z-index` no es mirar si tapa.** Al quitarle al nombre su
  `position: absolute`, el `z-index` seguía puesto y la comprobación daba
  verde, cuando lo que pasa de verdad es que el nombre EMPUJA a la imagen y
  se ven las dos cosas. Ahora se miden las cajas.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`mi-coleccion.html`, `SCHEMA.md`. Pruebas: `test-tanda-441.mjs` (bloque
nuevo), `test-tanda-440.mjs` (cuatro comprobaciones reforzadas y el fixture
repartido en tres meses — estaban todas las líneas en el mismo mes, así que
«la más vieja» no se distinguía de «la más nueva»), y
`rigor/rigor-tanda-440.py` (NUEVO) y `rigor/rigor-tanda-441.py`.

**Suite**: 441, 440, 439, 412, 413, 299 y 305, todas en verde.

**En curso / pendiente**: en Expansiones hay DOS colecciones rotuladas
igual, «SWS» las dos (Silver Tempest y Lost Origin, recortados a tres
letras por el código de TCG Live). El nombre existe pero va en `sr-only`
desde la 415, lo cual tiene sentido CUANDO EL LOGO CARGA, porque el logo lo
lleva escrito. Es la misma forma del fallo de la 441: la rama de en medio.

Siguen sin ejecutar `supabase-migration-pokedex-mercado.sql`,
`supabase-migration-trainer-gallery.sql` y
`supabase-migration-trainer-gallery-serie.sql`.

---

## 2026-10-02 — PINGU-Claude (tanda 441 — la pestaña Cartas, y una carta invisible que llevaba tandas en producción)

**Hecho**: cuatro cosas, y la primera es un FALLO que llevaba tandas a la
vista sin que nadie lo viera.

**0. Fuera «Dónde estás cerca»**, que duró una tanda. PINGU al verlo
puesto: «no tiene sentido porque abajo ya están las expansiones». Y es el
mismo argumento con el que la 439 quitó las diapositivas repetidas, así
que fuera sin discusión. Queda escrito en el código el criterio por si
vuelve: se ordenaba por CARTAS que faltan y no por porcentaje.

**1. CÓMO SE ENCONTRÓ EL FALLO, que es la lección de hoy.** Todas las
capturas de este repaso visual salían con las cartas en blanco, y se daba
por hecho que era cosa del contenedor —la red a TCGdex está cerrada—. Al
ponerse a tocar la pestaña Cartas se hizo lo que había que haber hecho
desde el principio: **interceptar las peticiones y servir una carta de
mentira con la proporción real**. Con las cartas puestas, la pantalla era
otra. **Una captura con los datos a medias no es la pantalla: es otra
pantalla.**

**2. EL FALLO: una carta sin imagen era un rectángulo INVISIBLE.** No un
hueco de cero píxeles —eso lo arregló la 321 poniendo el `aspect-ratio` en
el propio botón— sino algo peor de explicar: una caja que ocupa, que se
puede pulsar, y que no dibuja nada. El código tenía un «o esto o lo
otro»: con `image_path`, la imagen; sin `image_path`, el nombre. **Faltaba
el caso de en medio —hay ruta PERO NO RESPONDE—, que es el de cientos de
cartas ahora mismo**: la cadena de respaldo se queda sin sitios, el
`onerror` quita la imagen y el botón se queda vacío.

La solución NO es montar HTML dentro del `onerror` —con «Boss\'s Orders»
ahí es donde se rompen las comillas—: el nombre va **siempre debajo** y la
imagen **encima**. Si la imagen se quita, debajo aparece el nombre, que es
lo que ya se pintaba cuando no había ruta. Cero cadenas inventadas.

**3. Ordenar, a la vista.** Estaba DENTRO del modal de Filtros. Un filtro
se pone una vez y se olvida; un orden se toca cada dos por tres («a ver las
caras», «a ver las últimas»). Ahora vive en la barra con su «Al revés».

**4. La cuenta de lo que estás viendo.** Con un filtro puesto la rejilla se
acortaba y nada decía por qué. Dice «9 de 12» al filtrar y «12 cartas» sin
filtrar — la cifra de la cabecera es la de la colección ENTERA y esta es la
de lo que tienes delante. Comprobado que la barra no desborda a 390, 768
ni 1280.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`mi-coleccion.html`. Pruebas: `test-tanda-441.mjs` (NUEVO), y
`test-tanda-440.mjs` pierde su bloque 3.

**Suite**: 405, 412, 426, 427, 436, 439, 440, 299, 305, 312 y 313, todas en
verde.

**En curso / pendiente**: el rigor de la 440 y el de la 441. Y del repaso
visual quedan el botón «Ver todas las estadísticas», que se lee huérfano, y
el hueco grande que deja la columna de pestañas en el escritorio.

Siguen sin ejecutar `supabase-migration-pokedex-mercado.sql`,
`supabase-migration-trainer-gallery.sql` y
`supabase-migration-trainer-gallery-serie.sql`.

---

## 2026-10-02 — PINGU-Claude (tanda 440 — el rediseño del panel: cabecera de perfil, fuera el carrusel, y «dónde estás cerca»)

**Hecho**: PINGU paró la pasada anterior en seco: «quiero algo mucho mejor
pensado, cosas quizá sobran; me gusta mucho la app Dex y creo que lo tienen
perfecto y muy moderno visualmente». Tenía razón: la 439 eran parches. Esto
es el rediseño.

El diagnóstico, que es lo que lo ordena todo: **el panel tenía SEIS zonas
apiladas y TRES eran la misma cosa** —un resumen de números—: el listón de
cifras, el carrusel de diapositivas y la caja del valor. Por eso ocupaba
tanto y por eso parecía viejo.

**1. Cabecera de perfil.** Avatar, nombre, «coleccionando desde» y las
cifras DENTRO de la misma pieza, sin recuadro, separadas por una línea. La
fecha sale de TU LÍNEA MÁS ANTIGUA y no de cuándo te registraste: dice
desde cuándo coleccionas AQUÍ, que es lo que significa en esta pantalla, y
no hace falta pedir ninguna columna nueva.

Y quitar el recuadro **deshace dos parches que llevaban dos tandas
encima**: cuatro cajas con borde no caben en 390 px (de ahí la tira que se
desliza de la 412) y una tira cortada parece rota (de ahí el disimulo de
la 439). Sin caja, cuatro cifras caben en una fila a cualquier ancho. El
problema deja de existir en vez de taparse — y por eso el repaso empezó
por la estructura y no por los colores.

**2. Fuera el carrusel.** Era la pieza que más envejecía la pantalla, y
encima ESCONDÍA: con la pantalla ancha de sobra se veían dos tarjetas y
media. Ahora es una rejilla `auto-fit` que baja de fila sola.

**3. Y las listas de números, al final y plegadas.** Lo que se ve al
entrar es quién eres, cuánto llevas, cuánto vale y tus cartas. Arriba se
queda solo la gráfica del valor, que es lo único que cambia solo (la
decisión de la 416).

**4. DÓNDE ESTÁS CERCA**, que es lo que PINGU pidió después y lo único
accionable que puede tener el panel: a qué colección le faltan menos
cartas. Ordenado por **cartas que faltan y no por porcentaje** — un 96 % de
un set de 100 son 4 cartas y un 80 % de uno de 10 son 2: el porcentaje dice
que vas mejor en el primero y la verdad es que acabas antes el segundo. Lo
que se pregunta es «¿cuál puedo cerrar?», y eso se mide en cartas. Fuera
las completas (ahí no hay nada que hacer) y fuera las que tienen la
numeración a null (sin total, «te faltan NaN»).

**Medido, hasta ver la primera carta**: escritorio 704 → **502 px**; móvil
804 → **632 px**.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`mi-coleccion.html`. Pruebas: `test-tanda-440.mjs` (NUEVO), y adaptadas
`test-tanda-412.mjs` y `test-tanda-439.mjs`.

**Tres errores míos por el camino, y los tres cazados midiendo o mirando
el DOM, nunca la foto**:

1. Metí acentos graves dentro de un comentario que vive DENTRO de un
   template literal: parte la cadena en dos y revienta el fichero entero.
2. Al mover bloques se coló un `</div>` de más que dejaba la rejilla de
   números FUERA de su caja plegada. Se veían abiertas y **sin dar ningún
   error** — el DOM lo dijo en un `evaluate`, la captura no.
3. Puse `font-size: 24px` en el avatar pensando que entraba en la
   excepción de CLAUDE.md. No: esa excepción es para los avatares que
   pinta el JAVASCRIPT en un `style=`, donde el diámetro viene de un dato.
   Este círculo mide 56 px fijos en la hoja. Lo cantó `test-tanda-305`.

Y uno en la PRUEBA, que es el de más valor: la primera versión ordenaba
tres sets donde «por cartas» y «por porcentaje» daban **el mismo orden**,
así que la afirmación que decide la tanda no probaba nada. Ahora son cinco
y los dos criterios dan primeros distintos.

**En curso / pendiente**: el rigor de la 440. Y lo que queda del rediseño
si PINGU quiere seguir: el botón «Ver todas las estadísticas» aún se lee
huérfano, y la columna de pestañas del escritorio deja un hueco grande
debajo.

Siguen sin ejecutar `supabase-migration-pokedex-mercado.sql`,
`supabase-migration-trainer-gallery.sql` y
`supabase-migration-trainer-gallery-serie.sql`.

---

## 2026-10-02 — PINGU-Claude (tanda 439 — fuera lo que se decía dos veces)

**Hecho**: PINGU, mirando /mi-coleccion: «hay cosas que sobran, hay cosas
que son demasiado grandes… está bien, pero es un poco cutrón». Primera
pasada, la de quitar lo repetido.

Lo que más sobraba era literal: **el listón de cifras de arriba y las dos
primeras diapositivas del panel daban los MISMOS cuatro números**, con el
total en cuerpo gigante dos veces en la misma pantalla. Y las dos primeras
diapositivas son justo las únicas que se ven sin deslizar, o sea que el
carrusel abría contándote lo que ya tenías delante. Fuera «Tu colección»
entera y fuera el total de «Lo que vale»; se queda lo que esa diapositiva
SÍ añadía, que es CUÁLES son las que más valen.

La nota de debajo del listón repetía, palabra por palabra, la explicación
que ya lleva la diapositiva. Se queda con lo único accionable: cuántas no
tienen precio.

Y en «Cambios», sin nada apuntado salían tres chapas con 0 ENCIMA de los
tres pasos que explican qué hacer. Los pasos ya lo dicen.

**DOS ERRORES MÍOS, y los dos los cazó la medida y no el ojo**:

1. Cambié el listón del móvil por una rejilla de dos columnas. Se ve
   mejor… y sube de 804 a 867 px lo que tardas en ver la primera carta,
   que es EXACTAMENTE lo que la tanda 412 vino a bajar. El problema no era
   la disposición: era que nada avisaba de que aquello se desliza.
2. El aviso lo puse como un velo pintado encima, que funde hacia `--bg`
   (#f6f8fa) sobre una tarjeta BLANCA: **un 3 % de diferencia, invisible**.
   CSS muerto disfrazado de solución. Ahora es una `mask` que desvanece la
   propia tarjeta, y **se apaga al llegar al final** —una tira que ya no
   tiene más y sigue desvaneciendo su borde está mintiendo—.

Y una tercera, de las de siempre: meter el envoltorio
`.mc-cabecera-cifras` rompió el escritorio porque
`#mcContenido > .mc-resumen` pide HIJO DIRECTO. La tira se fue a la
columna de las pestañas y la primera carta pasó de 704 px a 1.005, **sin
dar ningún error**.

**Medido**: escritorio 704 → 681 px hasta la primera carta y 2.160 → 2.064
de alto; móvil 804 → 737 y 3.216 → 3.005.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`mi-coleccion.html`. Pruebas: `test-tanda-439.mjs` (NUEVO).

**En curso / pendiente**: **el rediseño de verdad**, que es lo que PINGU
pidió después: «quiero algo mucho mejor pensado… me gusta mucho la app Dex
y creo que lo tienen perfecto y muy moderno visualmente». Lo acordado: el
panel tiene SEIS zonas apiladas y TRES son lo mismo (resumen de números) —
el listón, el carrusel y la caja del valor—, y eso es la raíz. Estructura
nueva: cabecera de perfil con las cifras DENTRO, «dónde estás cerca»,
últimas añadidas, la gráfica, y el resto detrás de «Ver más». **Y fuera el
carrusel entero**: una tira horizontal de tarjetas de estadísticas es lo
que hace que algo se vea viejo.

Siguen sin ejecutar `supabase-migration-pokedex-mercado.sql`,
`supabase-migration-trainer-gallery.sql` y
`supabase-migration-trainer-gallery-serie.sql`.

---

## 2026-10-02 — PINGU-Claude (tanda 438 — el idioma del catálogo, y las imágenes que iban al sitio equivocado)

**Hecho**: tres cosas que PINGU pidió juntas, y un fallo mío de la 437 que
salió al preguntarlas.

**1. El selector pasa de MERCADO a VISTA, con banderas y sin texto.** Las
cuatro: 🇪🇸 Español, 🇬🇧 Inglés, 🇯🇵 Japonés, 🇨🇳 Chino. PINGU preguntó si
meter español obligaba a meter alemán, francés e italiano. **No**, y el
porqué estaba ya medido en la migración de mercados: son DOS ejes. El
MERCADO dice qué cartas EXISTEN —y el occidental es UN catálogo publicado
en ocho idiomas con las MISMAS cartas: el español comparte sus 154
identificadores de set con el inglés, el alemán 153, el italiano 190—. El
IDIOMA dice cómo se ESCRIBE (`name_es` contra `name`). Así que español e
inglés son el mismo catálogo con dos rótulos, y añadir alemán mañana es una
línea en `VISTAS` y ni una carta más que importar. Cambiar entre esos dos NO
vuelve a cargar nada: repinta y ya.

El chino tradicional sale de la lista porque PINGU lo pidió. **Queda
apuntado que es el que tiene catálogo de verdad**: 98 colecciones y 7.436
cartas, contra las 56 y 877 del simplificado. Volver a meterlo es una línea.

**2. El Panel, la primera pestaña.** Desde la 436 es la que se abre sola;
tenerla la última decía que era la menos importante.

**3. EL FALLO: las imágenes de los otros catálogos iban a la carpeta
inglesa.** PINGU: «las cartas no traen imagen, pero no sé si es que está
cargando». No estaba cargando. `js/carta-ruta.js` montaba las tres
direcciones —escaneo, logo de set y logo a mano— con el idioma `en`
ESCRITO A FUEGO. Mientras el catálogo era uno solo daba igual; desde la 437
cada imagen japonesa se pedía a `assets.tcgdex.net/en/…` cuando vive en
`/ja/…`. **Un 404 de imagen no da error en ninguna parte**: la cadena de
respaldo pasa al siguiente sitio, se queda sin sitios y quita la imagen. La
pantalla sale entera sin una sola foto y con pinta de estar cargando.

El motivo estaba escrito en el propio código: quien sabe montar bien esa
dirección es `cardImageUrl`, que vive en `tcgdex.js` y arrastra Supabase.
Ese nudo se deshace: los mercados se van a **`js/mercados.js`, sin una sola
dependencia**, y `tcgdex.js` lo reexporta. De paso, la copia a mano que
llevaba la función de Netlify deja de tener razón de ser.

**Ficheros**: `js/mercados.js` (NUEVO), `js/tcgdex.js`, `js/carta-ruta.js`,
`js/escaneo-carta.js`, `js/mi-coleccion.js`, `js/mi-coleccion/datos.js`,
`mi-coleccion.html`. Pruebas: `test-tanda-438.mjs` (NUEVO), y adaptadas
`test-tanda-437.mjs` y su rigor (el selector ya no dice códigos de mercado).

**Y UN SUSTO, que es la lección de hoy**: preparando un push, `git status`
enseñaba `js/mi-coleccion.js` modificado y yo no lo había tocado. Era **una
mutación del rigor, viva en disco en ese instante**. Un `git add -A` habría
subido la 437 rota a producción, que se despliega en directo. Se cazó
porque el fichero no era de los míos y se miró el diff. **Mientras corra un
rigor, se commitea nombrando los ficheros uno a uno, nunca con `-A`.**

**En curso / pendiente**: el rigor de la 438 y el repaso VISUAL de
/mi-coleccion, que PINGU pidió en el mismo mensaje: «hay cosas que sobran,
hay cosas que son demasiado grandes». Lo que ya se ve en las capturas: el
listón de cifras de arriba y las dos primeras diapositivas del panel dicen
LO MISMO, y en el móvil el listón se sale por la derecha.

Siguen sin ejecutar `supabase-migration-pokedex-mercado.sql`,
`supabase-migration-trainer-gallery.sql` y
`supabase-migration-trainer-gallery-serie.sql`.

---

## 2026-10-02 — PINGU-Claude (tanda 437 — qué catálogo se mira)

**Hecho**: PINGU: «vamos a hacer que tengamos dos catálogos distintos… y
después, si seleccionas las japonesas». Los cuatro mercados YA estaban
importados —occidental 206 colecciones, japonés 186, taiwanés 98, chino
simplificado 56—, así que esto no trae datos: quita el `'WEST'` fijo de las
diez consultas que lo tenían escrito y pone un selector en los tres sitios
donde se mira un catálogo (cartas, estantería y Pokédex).

**La decisión que lo sostiene todo: el mercado es de TODA la pantalla, no
solo del catálogo.** Elegir japonés enseña TU colección japonesa.
`user_collection` ya tenía su columna `market` desde la migración de
mercados, así que no hace falta nada nuevo para eso — y además tiene que
ser así: la clave de `tcg_cards` es `(id, market)` porque el japonés
comparte identificadores de set con el inglés (`sv1` existe en los dos y
son colecciones DISTINTAS), y el mapa `cartas` de /mi-coleccion va por la
id a secas. Mezclar dos mercados en la misma visita juntaría dos cartas
distintas bajo la misma clave **sin dar ningún error**.

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/datos.js`,
`js/mi-coleccion/albumes.js`, `mi-coleccion.html`,
`supabase-migration-pokedex-mercado.sql` (NUEVO). Pruebas (rama `pruebas`):
`test-tanda-437.mjs` (NUEVO), `rigor/rigor-tanda-437.py` (NUEVO),
`herramientas/stub-supabase.js`.

**HAY QUE EJECUTAR UN SQL**: `supabase-migration-pokedex-mercado.sql`.
`pokedex_resumen()` nació con `'WEST'` escrito dentro, así que en japonés
diría «de Pikachu hay 312 cartas» contando las INGLESAS mientras el
progreso de al lado cuenta las japonesas que tienes. El parámetro lleva
valor por defecto, y el cliente llama sin argumento para el occidental, así
que la página funciona con la migración puesta o sin ella. Validada contra
PostgreSQL 16 de verdad: sube desde la función vieja, deja UNA sola firma y
es idempotente.

**Rigor**: 14 de 16 a la primera. Las dos que se escaparon eran el mismo
agujero: la prueba miraba las LISTAS pero no ABRÍA nada. Enseñar la
estantería japonesa no prueba que dentro de un set japonés haya cartas
japonesas — y menos cuando `sv1` existe en los dos mercados. Son dos
consultas más (`cartasDeSet` y `cartasDeEspecie`) y nadie las andaba.

**Y un fallo DEL DOBLE que salió de su propia salida**: con la expansión
abierta, una carta japonesa se rotulaba «Scarlet & Violet». El doble
resolvía el embebido `tcg_sets(…)` por `set_id` a secas; en la base la
clave ajena es `(set_id, market) → (id, market)` justo para impedirlo. O
sea que el doble escondía la clase de fallo que la base no puede tener.
Arreglado con `EMBEBIDOS_TAMBIEN_POR`, y con el valor POR DEFECTO de la
columna dentro: es `not null default 'WEST'`, así que una fila de fixture
sin mercado ES occidental — sin eso, comparar `null` contra `'WEST'`
dejaría sin set a casi todas las cartas de las pruebas viejas.

**En curso / pendiente**: siguen sin ejecutar
`supabase-migration-trainer-gallery.sql` y, después,
`supabase-migration-trainer-gallery-serie.sql`.

Lo que NO entra aquí y es lo siguiente de esta conversación: el eje
**español/inglés**, que es otra cosa distinta del mercado —el mercado dice
QUÉ cartas existen; el idioma, cómo se ESCRIBEN (`name` contra `name_es`) y
a qué Cardmarket se enlaza—. Y dos cosas quedan sabidas y sin resolver: las
expansiones favoritas se guardan por `set_id` a secas, así que una
favorita occidental marcaría la japonesa del mismo id; y los álbumes
soñados guardan `card_id` sin mercado. Ninguna de las dos se rompe hoy
porque las dos listas son cortas y de un solo catálogo, pero están
apuntadas aquí para que no se descubran dentro de seis meses.

---

## 2026-10-02 — PINGU-Claude (tanda 436 — el Panel primero, y un asomo de cada pestaña)

**Hecho**: PINGU, con el panel de control de Dex delante: «el panel debería
ser lo primero que se abre cuando abres mi colección» y «que el panel se
asemeje más a lo que existe en Dex, cogiendo la información de las otras
pestañas». Son dos cosas y van las dos.

La primera: `/mi-coleccion` abre en el **Panel** y no en Cartas. Y con ella
cambia cuál es la pestaña «sin dirección»: la que NO lleva `?ver=` tiene
que ser la de por defecto, o compartir `/mi-coleccion` a secas llevaría a
una pestaña distinta de la que ve quien la abre. Así que ahora `?ver=`
desaparece en el Panel y se pone en las otras cuatro, al revés que antes.

La segunda son los **VISTAZOS**: un asomo de cada pestaña dentro del panel,
con su «Ver todas». Tus ocho últimas cartas (por `created_at`, no por
nombre: una lista alfabética no cambia nunca y deja de decir nada), las
cuatro expansiones en las que MÁS llevas (no las más nuevas — lo que se
quiere ver de un vistazo es dónde estás cerca de algo, igual que decidió la
429 para la Pokédex) y las carpetas. Pulsar una expansión del vistazo abre
ESA expansión, no la estantería.

**El fallo de la 377, otra vez y con una pieza nueva**: los vistazos se
pintan de lo que hay en memoria, y al arrancar no hay nada. El panel decía
«todavía no has añadido ninguna carta» con la colección entera cargada,
igual que le pasó al resto del panel en la 377 — y ahora con más motivo,
porque desde esta tanda el panel es lo PRIMERO que se abre. De ahí la línea
de `repintar()`.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`mi-coleccion.html`. Pruebas (rama `pruebas`): `test-tanda-436.mjs` (NUEVO),
`rigor/rigor-tanda-436.py` (NUEVO).

**Rigor**: 12 de 12. Cinco no las cazaba la primera versión de la prueba y
las cinco son de la misma familia — **un fixture que no distingue las dos
ramas no prueba el reparto**. Con dos sets y cinco líneas, quitar el corte
a ocho no cambiaba nada (había cinco), quitar el filtro de «expansiones en
las que llevas algo» tampoco (llevaba algo de las dos), y el orden no se
miraba. Ahora la semilla tiene TRES sets —de uno no llevas nada— y DIEZ
líneas con fechas de dos meses distintos. La sexta era un camino que la
prueba no andaba: entrar por `?ver=cartas` y pulsar «Panel», que es cuando
los vistazos no se han pintado NUNCA y el repintado no sirve de red.

**En curso / pendiente**: la **tanda 437** (el selector de catálogo: WEST /
japonés / taiwanés / chino, que ya están todos importados en la base) se
había empezado y **el rigor de la 436 se la llevó por delante** —restauró
`js/mi-coleccion.js` desde la copia que guardó antes de escribirla—. Hay que
rehacerla. Lección, y va en CLAUDE.md: mientras corre un rigor **no se
commitea Y TAMPOCO SE EDITA** ninguno de los ficheros que muta.

Siguen pendientes de ejecutar en el SQL Editor, por este orden:
`supabase-migration-trainer-gallery.sql` y luego
`supabase-migration-trainer-gallery-serie.sql`.

---

## 2026-10-02 09:30 — IBAI-Claude (integración de la tanda 425)

**Hecho**: integrada y subida la tanda 425 de PINGU-Claude, que llegó
como bundle (`tanda-425.bundle`, ramas `tanda-425` y `pruebas-425`)
porque su sesión no pudo empujar directamente. Revisado el diff antes de
subir: fast-forward limpio sobre la 424 en las dos ramas, sin cambios
míos encima. La entrada de abajo es la suya y cuenta el contenido.
**Ficheros**: solo esta entrada; el resto es el commit de la 425 tal
cual venía en el bundle.
**En curso / pendiente**: nada por mi parte. Lo pendiente de la 425 es
lo que diga su entrada.

## 2026-10-02 09:30 — PINGU-Claude (tanda 425 — la imagen del meta, para quien lleva el torneo)

**Hecho** (escrita como 422 en su sesión; la 422, la 423 y la 424 se
las llevó la otra sesión antes de integrarla, así que va como **425**):
lo que pidió PINGU con la infografía de un regional delante: «añade una
opción para que los admin puedan generar esa imagen al acabar
todos los torneos», con los sprites de PokeDoc. En la pestaña Meta de un
torneo TERMINADO, quien lo lleva (`mando()`) tiene «Descargar imagen del
meta»: un PNG 1080×1350 (a doble resolución) con el anillo de mazos y sus
sprites dentro, los porcentajes, la leyenda (los sueltos en «Otros», con
sus nombres), cuántos jugaron y el top 4. Los sprites son los MISMOS de
las chapas, pero servidos por `/sprite/<nombre>` (función nueva), porque
Limitless no da permiso de CORS y un canvas que pinta una imagen sin
permiso no se puede guardar — lo mismo que `/escaneo` en la 413. No es un
proxy abierto: solo un nombre de sprite. Detalle en SCHEMA.md.
**Ficheros**: js/torneos/meta-imagen.js (NUEVO), netlify/functions/sprite.mjs
(NUEVO), netlify.toml (la regla de /sprite), js/torneos/meta-torneo.js (el
botón), js/torneos/ronda.js (su escucha y los datos), css/torneos.css,
SCHEMA.md. En `pruebas`: test-tanda-425.mjs y rigor/rigor-tanda-425.py
(NUEVOS), y test-tanda-413.mjs (el resumen del meta va ahora dentro de
`.torneo-meta-resumen`).
**En curso / pendiente**: el botón no sale con el torneo en juego a
propósito (el meta aún cambia); si se quiere para las ligas a mitad, es
quitar esa condición en `pintarMeta`. **Pruebas**: la 425 en verde y su
rigor, 32 de 32 (pasado sobre este mismo código antes de renumerar: solo
cambian comentarios). Con lo de la 422 a la 424 debajo, en verde también
la 413, 421, 422, 414, 384, 305, 310, 369 y 406.

## 2026-10-02 — PINGU-Claude (tanda 435 — el CDN de pokemontcg.io, de último recurso)

**Hecho**: un cuarto sitio donde buscar el escaneo de una carta, el
último de la cadena.

**Cómo se llegó**: PINGU pasó una carta concreta —su Bulbasaur SWSH303 de
SWSH Black Star Promos— y abrió a mano las cuatro direcciones candidatas,
que es como se resuelve esto cuando el contenedor no tiene red. Resultado:

  · TCGdex no la tiene. **Confirmado en su propio código**: el fichero
    `SWSH303.ts` de `tcgdex/cards-database` no lleva campo de imagen. O sea
    que el truco de la 434 —montar la ruta a mano— no la salva: ese
    arregla los casos del issue #2362 (`mep`, `P-A`, `svp`), donde el
    fichero SÍ está en el CDN pero su manifiesto no lo lista.
  · Limitless tampoco, ni con `SP` ni con `SWSHP` de carpeta.
  · **pokemontcg.io sí**, y sin pedir clave.

**Lo que hace que esto no sea una dependencia de verdad**: sus FOTOS no
piden clave. La clave de pokemontcg.io es para su API de datos;
`images.pokemontcg.io` es un CDN a secas. Es una dirección más que probar,
y si no contesta la cadena sigue igual que antes.

Va la ÚLTIMA a propósito: las tres de delante son el escaneo oficial de
TPCi, y esta es la red de seguridad. Además es la de futuro más incierto
—su web ya dice «now part of Scrydex», que es de pago—, así que cuanto
menos dependa de ella la pantalla, mejor.

**El identificador de set es el nuestro casi siempre** (`swshp` es
`swshp`), con una familia que no: las colecciones de McDonald's, que ellos
nombran por el AÑO. Se DEDUCE —`2021swsh` → `mcd21`, `2014xy` → `mcd14`—
en vez de escribir una tabla: una tabla de doce entradas se queda vieja a
la siguiente colaboración (la lección de la 323) y el patrón es el mismo
desde 2011. La prueba incluye un `2027sv` inventado para comprobar que una
era futura se resolvería sola. Lo que no encaja —los trainer kits, que
ellos llaman `tk1a`— se deja pasar tal cual: da 404 y la cadena sigue.

**Dos cosas dichas sin adornos**:

  · NO se puede concluir que nuestro mapeo de Limitless esté mal. Fallaron
    las DOS carpetas, así que lo más probable es que Limitless no tenga esa
    carta. Si hubiera cargado `SWSHP` y no `SP`, ahí sí habría un fallo
    nuestro afectando a 307 promos. Queda descartado, no confirmado.
  · Esto es hotlinking a un CDN ajeno, igual que ya hacemos con Limitless
    y con TCGdex. Si algún día cortan, esas cartas vuelven al hueco con el
    nombre: la cadena degrada sola, que para eso está.

**Ficheros**: `js/escaneo-carta.js`. En `pruebas`: `test-tanda-435.mjs` y
`rigor/rigor-tanda-435.py` (nuevos; 11 mutaciones, las 11 detectadas a la
primera).

**En curso / pendiente**: mirar en producción si aparecen el SWSH303 y
alguna de McDonald's. Y queda la vía de subir las que falten al Ingest de
TCGdex (manager.tcgdex.net), que ayuda a todo el mundo y no solo a
nosotros.

## 2026-10-02 — PINGU-Claude (tanda 434 — la ruta del asset de TCGdex, montada a mano)

**Hecho**: cuando `image_path` está a null, la dirección del escaneo **se
monta a mano** con `serie/set/número`. Y lo mismo con el logo de un set:
`serie/set/logo`.

**Por qué funciona**: TCGdex tiene un fallo conocido y abierto
(cards-database#2362) — hay imágenes SUBIDAS A SU CDN que su `datas.json`
no lista, así que la API devuelve el campo `image` vacío y nuestra columna
nace a null. El issue nombra tres sets que son de los nuestros —`mep`,
`P-A`, `svp`— y da la dirección que sí responde:

    https://assets.tcgdex.net/en/sv/svp/196/high.png → 200

Y esa dirección es la que YA montamos: nuestro `image_path` ES
`serie/set/número`. O sea que con tres datos que ya tenemos en la base se
escribe sola. **Sin API nueva, sin clave y sin dependencia.**

Va DELANTE de Limitless en la cadena, porque es la misma fuente que el
espejo —mismo arte y mismo idioma—; Limitless se queda de respaldo, con su
arte siempre inglés. Y no se comprueba nada antes de pedirla, igual que
con Limitless: si el fichero no está, el `onerror` pasa al siguiente y, si
se acaban, quita la imagen. El coste de equivocarse es un 404; el de no
intentarlo, una carta en blanco.

**Tres cautelas**: sin serie no se monta nada —el módulo ya decía que una
dirección inventada es una imagen rota—; ningún trozo puede llevar una
barra ni un espacio, que cambiaría de carpeta o partiría la dirección; y
no se monta si ya hay `image_path`, o la misma saldría dos veces.

**Y DOS LECCIONES DE MÉTODO, las dos de la misma familia y nueva**:

1. **La prueba miraba el sitio equivocado.** Comprobaba qué queda PINTADO,
   y aquí la red está cerrada: el asset no llega, salta el respaldo de la
   415 y la imagen desaparece. Estaba comprobando el respaldo. Ahora mira
   **qué PIDE la página** (`page.on('request')`), que es lo que prueba que
   la dirección se monta — y además funciona con la red cerrada.
2. **El caso de prueba hacía indistinguibles las dos ramas del `if`.** El
   set «con logo» tenía un `logo_path` que producía EXACTAMENTE la
   dirección que montaría la mano; y la carta «con `image_path`» apuntaba
   a `sv/svp/196`, que es justo lo que montaría la mano — y como la cadena
   deduplica con un `Set`, el código roto y el bueno daban la misma lista.
   No es que la prueba mirase mal (426) ni que los datos fueran más fáciles
   que el mundo (427): es que **el ejemplo elegido coincidía con lo que
   calcularía la otra rama**. Se arregla haciendo que el valor «ya
   existente» apunte a OTRO sitio (`viejo/camino/9`).

**No se ha podido comprobar contra TCGdex**: el proxy de este contenedor
deniega `assets.tcgdex.net`. Se sabrá al desplegar. Lo que sí está probado
es que si el fichero no llega, no se queda ningún icono roto.

**Ficheros**: `js/escaneo-carta.js`, `js/carta-ruta.js`,
`js/mi-coleccion.js`, `js/mi-coleccion/datos.js`. En `pruebas`:
`test-tanda-434.mjs` y `rigor/rigor-tanda-434.py` (nuevos).

**En curso / pendiente**: medir en producción cuántas se recuperan. Con
eso se decide si pokemontcg.io —gratis con clave, 20.000 al día, pero con
el futuro incierto por lo de Scrydex— merece la pena para los huecos que
queden, o si se asume. Y queda la vía de subir las que falten al Ingest de
TCGdex (manager.tcgdex.net), que ayuda a todo el mundo.

## 2026-10-02 — PINGU-Claude (tanda 433 — devolverle su era a las galerías: ARREGLO DE UN FALLO MÍO)

**Hecho**: `supabase-migration-trainer-gallery.sql` (tanda 432) juntó las
dos mitades de cada Trainer Gallery —código, fecha y dibujo de la gemela
vacía, y después borrarla— pero **se me olvidó `serie_id`**. Y la
estantería agrupa justo por ahí (`const clave = s.serie_id || ''`), así
que las cuatro galerías se salieron de «Espada y Escudo» y cayeron en
«Sin serie». Lo vio PINGU: «la Trainer Gallery de Silver Tempest debería
estar al lado de Silver Tempest».

**La gemela ya no está para copiarle nada**, así que la era hay que
sacarla de otro sitio, y el mejor es el NOMBRE: «Silver Tempest Trainer
Gallery» es de la era de «Silver Tempest». Es como lo dijo PINGU y como lo
entiende cualquiera. Nada de recortar identificadores —`swsh12.5tg` menos
`.5tg` da `swsh12`, pero eso es una regla que hay que saberse y que se
rompe en cuanto cambie el patrón.

Vale igual para las Galarian Gallery, y de paso le pone la fecha del set
padre si le faltaba: dentro de una era los sets van por fecha, así que sin
ella la galería se iría al fondo en vez de quedarse al lado de su set.

**Y la migración de la 432 queda arreglada también**, para quien la
ejecute de cero: ahora copia `serie_id` y `serie_name` de la gemela.

**Probado contra PostgreSQL 16** con dos trampas: una galería que YA tiene
era (no se toca) y una galería SIN set padre (se queda sin resolver en vez
de inventarse una). Pasada dos veces: idempotente. Y la original,
reejecutada de cero, deja las cuatro con su era.

**Y el asunto de los logos queda CERRADO**: los 37 sets sin dibujo tienen
`curado_v = 1`, visitados el 2026-09-30. O sea que el curador que SÍ sabe
de logos (tanda 380) ya pasó por ellos y volvió con las manos vacías:
**TCGdex no tiene logo de esos sets**. No hay nada que arreglar en nuestro
código, y lo que hace la web —enseñar el nombre en la caja, tanda 415— es
la respuesta correcta.

**Ficheros**: nuevo `supabase-migration-trainer-gallery-serie.sql`;
corregido `supabase-migration-trainer-gallery.sql`; `diagnostico-imagenes
.sql` al día.

**En curso / pendiente**: PINGU tiene que ejecutar la migración nueva. De
las 1.231 cartas sin imagen: 619 YA SE VEN por Limitless, 120 las arregla
la 432, y las ~492 restantes —trainer kits, McDonald's, promos sueltas—
TCGdex no las tiene. Queda decidir si se mete `pokemontcg.io` como segunda
fuente o se asume.

## 2026-10-02 — PINGU-Claude (tanda 431 — fuera «Completados», y el diagnóstico de las imágenes)

**Hecho**: PINGU, con la Pokédex delante: «deberías quitar lo de
completados, es una estadística que sobra porque nadie o casi nadie
tendrá completadas todas las cartas de un Pokémon». Tiene razón: un
Pikachu pasa de las 300 cartas, así que esa cifra era un **cero
permanente ocupando un cuarto de la cabecera**. Lo que sí sirve —a cuál
le falta poco— lo dice la vista «Los que casi completas» de la 429.

Se va la tarjeta Y la cuenta: nadie pedía `completados`, así que
calcularlo era trabajo para nadie.

**Y lo otro que preguntó —las cartas y los sets sin imagen— se queda en
DIAGNÓSTICO a propósito**, en `diagnostico-imagenes.sql`. El motivo está
escrito dentro: una carta sin escaneo puede serlo por tres razones
distintas y cada una se arregla de otra manera.

Lo que SÍ se ha podido determinar desde aquí, leyendo el código:

- los sets que salen con el nombre escrito (Temporal Forces, Scarlet &
  Violet Energies, SVP Black Star Promos) tienen `logo_path` Y
  `symbol_url` **a null en la base**. No es un 404: el fondo borroso de
  la tarjeta (`.mc-set-arte`) solo se pinta cuando hay dibujo, y en esas
  tres sale plano;
- `setToRow` corre sobre el LISTADO de TCGdex, que es un «SetResume» —la
  lección de las tandas 233 y 322—, así que si ahí no viene el logo, la
  columna nace vacía y nadie se entera;
- y para las CARTAS, lo barato ya está dicho en CLAUDE.md: **los nombres
  y las imágenes SÍ vienen en el listado de cartas de un set**, así que
  rellenarlas son ~220 peticiones y no 23.000. Es el mismo coste que la
  fase de fechas de la 322.

No se ha podido comprobar contra TCGdex ni contra Limitless porque este
contenedor tiene la red cerrada (403 del proxy a `api.tcgdex.net`,
`assets.tcgdex.net`, la CDN de Limitless y `api.pokemontcg.io`). Por eso
el paso siguiente es el SQL y no una función programada escrita a ciegas.

**Ficheros**: `js/mi-coleccion/pokedex.js`, nuevo
`diagnostico-imagenes.sql`. En `pruebas`: `test-tanda-400.mjs` al día.

**En curso / pendiente**: PINGU tiene que correr
`diagnostico-imagenes.sql` y pasarme los cuatro resultados. Con ellos se
decide si hace falta una fase de relleno de logos (~220 peticiones) y
otra de imágenes de carta (~220 más), o si lo que falta sencillamente no
lo tiene TCGdex.

## 2026-10-02 — PINGU-Claude (tanda 430 — la lista de lo que te falta, para pegarla en un chat)

**Hecho**: en una expansión, un botón **«Copiar las N que me faltan»**
que deja en el portapapeles un texto listo para pegar:

```
Me faltan 5 de las 108 de Roaring Skies (ROS):
004 · Rayquaza EX
017 · Mega Rayquaza EX
```

Es la otra mitad de un intercambio: desde la 374 el Panel dice lo que te
SOBRA —lo que puedes ofrecer— y lo que te falta había que ir leyéndolo de
la rejilla hueco por hueco.

**Texto y no enlace, a propósito**: esto se pega en un grupo o en un
mensaje del foro, y un enlace obliga a la otra persona a salir a mirarlo.

**Es EXACTAMENTE lo que hay en pantalla.** Así se lleva bien con los
filtros, con el orden de la 427 y con «separar variantes» sin saber nada
de ellos: ya han hecho su trabajo antes de llegar aquí. Por eso
`pintarAlbum` guarda `album.aLaVista` en vez de recalcularlo: recalcular
sería escribir los filtros y el orden una segunda vez.

**Y el texto dice su propio alcance**, que es lo que lo hace fiable:

- con filtros puestos lo AVISA y no dice ningún total. Sin eso, quien
  filtró por «ultra raras» pega cinco cartas y la otra persona entiende
  que le faltan cinco del set entero;
- sin filtros, el total es el del SET, que es el número que significa algo;
- y con las versiones separadas **no se dice total ninguno**: lo que se
  lista son huecos de versión y no cartas, así que cualquier número de
  ahí pide que se lo expliquen. El `null` es una respuesta, no un olvido.

El separador es `·` y no un guion, porque un guion se confunde con los
que llevan los nombres: «Ho-Oh», «Porygon-Z».

**EL FALLO QUE DESTAPÓ EL RIGOR, y era de verdad**: la bandera de «¿hay
filtros puestos?» la deducía comparando cuántas cosas hay en pantalla con
cuántas cartas tiene el set. Eso vale… salvo con «separar variantes»
puestas, donde hay MÁS HUECOS QUE CARTAS por definición: el texto habría
avisado de filtros que no existen y habría escondido el total. Es la misma
regla escrita dos veces —`pintarAlbum` ya lo sabe— y la segunda copia
salía mal. Ahora se pregunta en vez de deducirse.

Y el otro hueco era de la prueba: **nunca abría «separar variantes» en
pantalla**, así que no se comprobaba que la lista mire la VERSIÓN y no
solo la carta. Teniendo la normal de la 101, el reverse holo te sigue
faltando y tiene que salir. Es el mismo tipo de hueco que la 427: el juego
de datos era más fácil que el mundo.

**Ficheros**: nuevo `js/mi-coleccion/lo-que-falta.js`. Tocados
`js/mi-coleccion.js`, `mi-coleccion.html`. En `pruebas`:
`test-tanda-430.mjs` y `rigor/rigor-tanda-430.py` (nuevos).

**En curso / pendiente**: nada a medias.

## 2026-10-02 — PINGU-Claude (tanda 429 — los que casi completas, en la Pokédex)

**Hecho**: un desplegable en la Pokédex con dos vistas: «Por número» (la
de siempre, con sus generaciones) y **«Los que casi completas»**. Lo que
persigue quien colecciona no es «el siguiente por número», es «¿a cuál le
falta UNA?», y esa lista no existía. Los dos datos ya estaban en memoria
—lo que tienes de cada especie y cuántas hay en el catálogo—, así que no
cuesta ni una consulta.

**Manda lo que FALTA, no el porcentaje**: a quien le faltan 2 de 4 (50 %)
le queda menos que a quien le faltan 20 de 200 (90 %), y lo que vas a
hacer con esa lista es ir a buscar cartas. A igualdad, el que va más
adelantado.

**Quedan fuera tres grupos y cada uno por un motivo distinto**: los que no
has empezado (no es que estés cerca, es que no has empezado), los que ya
tienes enteros (no hay nada que perseguir) y aquellos de los que **no se
sabe cuántas cartas tienen** —el catálogo todavía sin engordar—: sin el
total no se puede decir cuánto falta. La regla de los tres estados (319).

Y la vista «casi» **no agrupa por generación**: agrupar una lista que ya
está ordenada por otra cosa rompe justo el orden que se ha pedido.

**La prueba cazó un fallo MÍO, de expectativa**: escribí que entre «2 de
3» y «3 de 4» iba primero el 2/3, cuando mi propia regla dice que a
igualdad de lo que falta manda el más adelantado. El código hacía lo
documentado; la prueba decía otra cosa. Se corrigió la prueba.

**Y una decisión al revés de las tres anteriores, que conviene leer
junta**: el rigor no detectaba quitar el `f.total &&` del filtro, porque
con `total` a null la comparación de al lado (`tengo < total`) ya da falso
—JavaScript convierte el null en 0—. En la 426 y en esta misma tanda, las
guardas redundantes se quitaron del código. **Aquí no**: esa redundancia
no es un `if` escrito dos veces, es que el filtro funcionaría por una
COERCIÓN que no se ve al leerlo y que deja de valer el día que `total`
llegue como `undefined`. Así que se queda la guarda, con el motivo escrito
encima, y lo que se va es la mutación: fingir que se detecta algo
invisible es peor que admitir que no se puede.

**Ficheros**: `js/mi-coleccion/pokedex.js`, `js/mi-coleccion.js`,
`mi-coleccion.html`. En `pruebas`: `test-tanda-429.mjs` y
`rigor/rigor-tanda-429.py` (nuevos).

**En curso / pendiente**: sigue preguntado a PINGU si la Pokédex por TIPO
merece una tabla curada de 1.025 especies. Esta tanda es la alternativa
que no cuesta nada.

## 2026-10-02 — PINGU-Claude (tanda 428 — lo que te costó contra lo que vale)

**Hecho**: una tarjeta nueva en el Panel, **«Lo que te costó»**, pegada a
«Lo que vale»: la diferencia en grande con su signo, sobre cuántas cartas
es, y lo pagado y lo que valen debajo.

**Y de paso arregla algo que ya estaba mal.** La cabecera llevaba desde la
374 un «Pagado» al lado de «Valor estimado», y esa pareja MIENTE: lo
pagado solo se sabe de las cartas en las que lo has apuntado —pueden ser
tres de cuatrocientas— y el valor es el de TODAS. Leídas juntas parecen un
balance y dicen «has ganado 280 €» cuando lo único cierto es que te
costaron 20. Ahora la cifra dice **«Pagado en 6 cartas»**, que es lo que
la convierte de trampa en dato, y el balance de verdad —las mismas cartas
en los dos lados— está en el Panel.

**Las reglas que lleva dentro**, que son las de siempre:

- el **signo va delante** del número, porque el color nunca va solo: hay
  quien no distingue el verde del rojo;
- **dice sobre cuántas cartas es**: «+12,40 €» sin saber si es de tres
  cartas o de trescientas no es un dato, es un número suelto;
- las que tienen precio de compra pero **todavía no de mercado se dicen
  aparte**, no se cuentan como cero — un cero diría que no valen nada, y
  lo que pasa es que no se sabe (la regla de los tres estados, 319);
- **sin nada apuntado no sale un «0 €»** —que se leería como «estás en
  tablas»— sino dónde se apunta;
- y un **empate va sin signo y sin color**: un «+0,00 €» en verde se lee
  como una ganancia que no existe.

**El rigor encontró tres agujeros, los tres del mismo tipo: la prueba no
visitaba el caso.** El empate no estaba probado en pantalla; la cabecera
se probaba con UNA copia, y contar líneas o contar cartas da lo mismo con
`cantidad: 1`; y el color se comprobaba **por la clase** y no por el
color, así que `.mc-gana` pintando de rojo pasaba — la trampa de la 313,
«una prueba que mira si se LLAMA a una función no prueba lo que hace».
Ahora compara el color pintado con el token `--success` resuelto y exige
que no sea el rojo.

**Ficheros**: nuevo `js/mi-coleccion/balance.js`. Tocados
`js/mi-coleccion.js`, `css/mi-coleccion.css`. En `pruebas`:
`test-tanda-428.mjs` y `rigor/rigor-tanda-428.py` (nuevos).

**En curso / pendiente**: nada a medias. Queda preguntado a PINGU si la
Pokédex por TIPO merece una tabla curada de 1.025 especies (~10 KB y
mantenimiento por generación): ese dato no está en la base — `types` es el
tipo de energía de cada CARTA, no el del Pokémon — y la rejilla de las
1.025 se pinta hoy sin una sola consulta.

## 2026-10-02 — PINGU-Claude (tanda 427 — ordenar una expansión)

**Hecho**: una expansión se puede ordenar de cuatro maneras, según lo que
vayas a hacer con ella: **por número** (el de siempre, el del álbum en la
mano), **por nombre** (cuando buscas una), **las más raras primero**
(cuando miras lo que vale) y **lo que te falta primero** (cuando vas a
comprar o a cambiar). Antes solo existía la primera.

**La escala de rareza no estaba en ningún sitio**: `rarity` es texto
suelto en la base. Hay que ponerla, y una lista a mano SE QUEDA VIEJA —la
lección de la 323 con las megas de `FORMAS_TCG`—, así que debajo hay
reconocimiento por PALABRAS igual que en `familiaDeBrillo`: una rareza
nueva que diga «Hyper» se ordena arriba desde el día uno. Y las que no se
reconocen van SIEMPRE al final, se ordene como se ordene: arriba dirían
que son las más raras del set, que es justo lo que no se sabe. Tres
respuestas y no dos (la regla de la 319).

**El fallo que cazó la prueba antes de que lo viera nadie**: metí a
propósito una rareza inventada y salió colocada EN MEDIO de la escala,
porque `/rare/i` casa con **«Rareza»**. Es la trampa de los substrings de
las tandas 312 y 313, ahora en un nombre de rareza. Arreglado con bordes
de palabra (`\brare\b`), que de paso deja de confundir «Uncommon» con
«Common».

**`porNumero` se mudó a `js/mi-coleccion/orden.js`**, donde viven los
otros tres órdenes. Estaba en `mi-coleccion.js` y el módulo nuevo lo
necesitaba: dos copias se separan sin dar error (la 322), así que una
sola y se importa, con una prueba que lo vigila.

**El rigor encontró dos agujeros, los dos por datos de prueba demasiado
fáciles**: no había ningún nombre repetido —y un set trae varias
ilustraciones del mismo Pokémon—, ni ningún número con una letra pegada
(«10a»), que no es lo mismo que «TG1»: `parseInt('10a')` sí da 10, así
que sin la comprobación de «¿es TODO dígitos?» se colaba entre el 9 y el
20. Y de paso quité un `check` tautológico que se me había colado:
comparaba una lista con una copia de sí misma, o sea verdad siempre.

**Ficheros**: nuevo `js/mi-coleccion/orden.js`. Tocados
`js/mi-coleccion.js`, `mi-coleccion.html`. En `pruebas`:
`test-tanda-427.mjs` y `rigor/rigor-tanda-427.py` (nuevos).

**En curso / pendiente**: ordenar por VALOR se queda fuera a propósito:
`cartasDeSet` no trae precios y pedirlos para las 200 cartas de un set es
otra consulta con un `in()` enorme. Si se hace, que sea con su propia
decisión de coste, como la de la 322.

## 2026-10-02 — PINGU-Claude (tanda 426 — marcar varias cartas de golpe)

**Hecho**: dentro de una expansión hay un botón **«Marcar varias»**. Con
el modo puesto, pulsar una carta la MARCA en vez de abrir su ficha; el −
y el + se esconden (cada casilla tiene un solo destino, y de paso salen
del tabulador); una barra pegada arriba dice cuántas llevas, y nada se
escribe hasta pulsar **«Añadir 7»**, que dice el número.

**Por qué**: apuntar un sobre son diez cartas. Una a una eran diez
botones pequeños, diez repintados de la rejilla y **veinte peticiones**,
porque `anadir` hace un `select` por carta antes de su insert. Ahora es
UNA lectura para todas y UN insert con las nuevas dentro (`anadirVarias`).
Las que ya tienes suben de copias en vez de nacer una fila gemela — y eso
se mira contra la BASE y no contra lo que el navegador tiene en memoria:
entre que cargaste la página y marcaste el sobre, la misma carta puede
haber entrado desde el móvil.

**El precedente, que está escrito en el propio HTML**: en la tanda 365
hubo un interruptor de «tocar una carta la añade» y se quitó en la 368
porque OBLIGABA A ELEGIR — con él puesto no podías abrir una ficha, sin
él no podías añadir. Este no es eso: se enciende, se usa y se apaga, y
mientras está apagado la rejilla se comporta igual que siempre. La prueba
lo vigila a propósito.

**Dos cosas que cambiaron al verlas funcionando**: la barra iba a
`top: 0` y se metía por debajo de la barra del sitio (que es `sticky` a 0
con 70 px), y era azul sólido, con lo que el «Añadir» —que ya es azul
sólido— desaparecía encima. Ahora va a 72 y es una superficie normal con
contorno. Y se cayó «Quitar la selección»: tres controles se iban a tres
renglones en el móvil y «Cancelar» ya hacía lo mismo.

**El rigor encontró SIETE agujeros, y cuatro eran de la prueba**:

1. `isHidden()` salía verde POR EL PADRE. Comprobaba que salir de la
   expansión apaga el modo mirando la barra — pero al salir se esconde la
   zona entera, así que pasaba aunque el modo siguiera puesto.
2. El visto se comprobaba leyendo el CSS con un `/content:/`, y
   `content: ''` también lo contiene. La trampa de las tandas 312 y 313,
   otra vez. Ahora se mira el pseudo-elemento PINTADO.
3. El botón nunca se probaba APAGANDO, solo encendiendo.
4. Nadie miraba que lo guardado entrara en la lista de la página, solo en
   la base.

**Y tres mutaciones se quitaron porque no cambiaban nada, que también es
información**: el valor inicial de `marcadas` no se ve nunca porque
`abrirAlbum` lo apaga al entrar; la regla `.mc-marcar-barra.hidden` era
CÓDIGO MUERTO (la clase global `.hidden` es `display: none !important` —
el truco de la 412 era con el ATRIBUTO `[hidden]`, que viene de la hoja
del navegador y sí se puede pisar); y la guarda de apagar el modo estaba
DOS VECES, al salir de la expansión y al entrar. Esa se ha quitado del
código: el único camino de vuelta a una rejilla pasa por `abrirAlbum`.

**El doble aprendió algo que le faltaba**: `window.__SIN_PERMISO__`. Una
escritura que la política rechaza NO da error en PostgREST: no toca nada
y vuelve con el cuerpo vacío. Es de los fallos que más veces ha mordido
en este repo —CLAUDE.md lo cuenta tres veces— y el doble no sabía
fingirlo, así que un código que no mira lo que vuelve pasaba por bueno
aquí y mentía en producción.

**Ficheros**: `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/mi-coleccion.js`, `js/mi-coleccion/datos.js`. En `pruebas`:
`test-tanda-426.mjs` y `rigor/rigor-tanda-426.py` (nuevos) y
`herramientas/stub-supabase.js`.

**En curso / pendiente**: nada a medias.

## 2026-10-01 — PINGU-Claude (tanda 424 — el anillo de la Pokédex se salía de su caja)

**Hecho**: PINGU, con una captura del móvil: «el circulito que te está
guardando el progreso se desplaza y sale de la burbuja».

**Lo que pasaba**: la caja de «Registrados» pide 84 px de texto + 12 de
hueco + 72 de anillo + 32 de relleno = **200 px**, y la pista de la
rejilla mide **185** en cuanto caben dos columnas. El anillo es
`flex: 0 0 auto` —y tiene que serlo: un círculo que se encoge deja de ser
un círculo—, así que no cedía y se salía por el borde derecho. Sin dar
error en ninguna parte.

**Arreglado** dándole DOS pistas a esa caja (`grid-column: span 2`). No
`1 / -1`: la fila entera la dejaba de 840 px en el escritorio con el
anillo perdido a lo lejos. Con `span 2` coge sitio solo cuando le hace
falta — con una columna se queda en una, con dos se las lleva las dos, y
con cuatro se queda en dos. Lo pide el contenido, que tiene más cosas
dentro que las otras tres cajas, y no un punto de corte elegido a ojo.

**Y la prueba va contra la FORMA del fallo**, no contra el ancho que
falló: comprueba a SEIS anchos que el anillo cabe dentro de su caja, que
la caja no desborda por dentro, que el anillo sigue siendo REDONDO (por si
alguien lo «arregla» encogiéndolo) y que la página no coge barra lateral.
Bien que se hizo así: sin el arreglo, el peor ancho no era el de la
captura sino **600 px**, donde se salía 8 px enteros.

**Ficheros**: `css/mi-coleccion.css`. En `pruebas`: `test-tanda-414.mjs`
(sección 3 nueva).

**En curso / pendiente**: nada.

## 2026-10-01 — PINGU-Claude (tanda 423 — el foco que se perdía al cerrar un menú del laboratorio)

**Hecho**: arreglado el fallo que llevaba tandas saliendo como «la 384 a
veces falla y a la segunda pasa». No era un parpadeo de la prueba: **falla
2 de cada 3 veces**, y lo que falla es la web.

**Lo que pasaba**. El menú de una carta del laboratorio enfocaba su
primera opción JUGABLE (`[data-op]:not([aria-disabled])`). Cuando la
jugada no deja ninguna —y eso depende del barajeo, de ahí que pareciera
azar—, no enfocaba nada, y el foco se quedaba donde estuviera: en el
`body`, porque la mano se repinta y la carta que acabas de pulsar ya no es
el mismo botón. **El oyente de Escape vive en la raíz del laboratorio**,
así que con el foco en el `body` no le llega: cerrabas el menú y el
siguiente Escape no hacía nada. El laboratorio se quedaba sin poder
cerrarse con el teclado, y encima el menú abierto no se podía ni leer.

**Lo arreglado**: un menú abierto se queda SIEMPRE con el foco, aunque no
haya nada que pulsar (el propio menú lleva `tabindex="-1"`), y al cerrarse
lo devuelve a la carta desde la que se abrió — o al laboratorio, que es
quien escucha el teclado, si esa carta ya no está. Cinco pasadas seguidas
de la 384 en verde, donde antes eran dos de cada tres en rojo.

**La lección**: una prueba que «a veces falla» es una afirmación sobre la
web, no sobre la prueba, mientras nadie mire cuál de las dos. Lo que lo
destapó fue imprimir el estado justo antes del check que fallaba: entre
una pasada verde y una roja lo ÚNICO distinto era `document.activeElement`.

**Ficheros**: `js/constructor/laboratorio.js`.

**En curso / pendiente**: nada.

## 2026-10-01 — PINGU-Claude (tanda 422 — moverse por la ficha, y un rigor que podía fallar)

**Hecho**: la ficha de una carta gana **flechas** para pasar a la de al
lado sin cerrarla, y un **botón de cerrar** a la vista.

**Las flechas**. Repasar un set de 200 cartas eran 400 toques: una ficha
no se podía dejar abierta y pasar a la siguiente. Ahora hay ‹ y › y un
«3 de 198» entre medias, que es lo que dice si merece la pena seguir
pulsando o es mejor cerrar y buscar. Funcionan también con ← y → del
teclado — **salvo con el foco en un campo**: dentro de un desplegable
esas teclas son suyas, y robárselas sería cambiarle el estado a la carta
creyendo que pasas a la siguiente.

**El orden sale del DOM, no de los datos.** La rejilla ya está filtrada y
ordenada por quien mira, así que «la siguiente» tiene que ser la de al
lado EN LA PANTALLA. Sacarla de una lista interna llevaría a cartas que no
están a la vista y el «de N» mentiría. De paso, el mismo mecanismo vale
para las tres rejillas —tu colección, una expansión y la Pokédex— sin que
ninguna tenga que contarle nada a la ficha. Guarda IDs y no elementos:
entre una flecha y otra la rejilla puede repintarse.

**Y lo que estabas escribiendo se guarda en SU carta.** El guardado va con
retardo mientras escribes; sin cerrarlo antes de cambiar, el temporizador
saltaba con otra ficha ya puesta: se perdía lo de esta y se reescribía la
de al lado. Además el temporizador se pone a null al saltar — si no, la
variable guarda un id ya gastado y no hay forma de distinguir «hay algo a
medias» de «no hay nada».

**El cerrar**: esta ficha solo se cerraba con Escape o pulsando fuera. En
un teléfono no hay Escape, y «pulsa fuera» no se le ocurre a nadie que no
lo sepa ya.

**Y la parte de las herramientas, que es la que más vale escribir.** El
andamio de los rigores corría la prueba desde el scratchpad, donde en este
contenedor no había NINGUNA. Una prueba que no existe hace que `node` salga
con código 1 — que es exactamente lo que el rigor lee como «mutación
detectada». Todas, siempre, sin que nada falle. **Un rigor que no puede
fallar no prueba nada**, que es justo lo que un rigor existe para no ser.
Dos arreglos: `rigor_comun` coge la prueba y el `sync` del árbol de esta
rama y, antes de mutar nada, **exige que la prueba pase sobre el árbol
limpio** (si ya está roja, o no existe, o el servidor está caído, «falla»
no significa «se ve la mutación»). Y `herramientas/preparar-entorno.sh`
deja el scratchpad con ENLACES a la rama en vez de copias: los 78 rigores
siguen buscando ahí, y un enlace no se queda viejo, que era el único
problema. Cambiarles la ruta a los 78 habría sido una transformación en
bloque sobre ficheros que nadie va a releer.

**Y lo primero que hizo el rigor arreglado fue encontrar TRES agujeros de
mi propia prueba**: un `click({ force: true })` sobre un botón
desactivado no dispara nada (así que la guarda del final de la lista no se
pisaba nunca); el caso de «sin lista detrás» no era alcanzable por la
interfaz, así que se cambió por uno que SÍ pasa —con una sola carta no se
pintan pasos—; y la comprobación del temporizador se llevaba por delante
lo que iba a probar, porque la propia flecha lo vacía. Las tres están
contadas en `SCHEMA.md`. Al final, 20 mutaciones y las 20 detectadas.

**Ficheros**: `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/mi-coleccion.js`. En la rama `pruebas`: `pruebas/test-tanda-422.mjs`
(nuevo), `rigor/rigor-tanda-422.py` (nuevo), `rigor/rigor_comun.py`,
`herramientas/preparar-entorno.sh` (nuevo).

**En curso / pendiente**: nada a medias.

## 2026-10-01 16:45 — PINGU-Claude (tanda 421 — el meta sin variantes repetidas, y la imagen que se vuelve a importar)

**Hecho**: dos cosas que pidió PINGU. (Esta y la 420 se hicieron en local
como 416 y 415; el remoto llegó a la 418 y se numeraron 419 y 420, pero
la 419 se la había llevado ya el arreglo del doble en `pruebas`: al
integrarlas desde el bundle van como **420 y 421**.)

1. **El meta junta las variantes de un mismo mazo.** «Hay arquetipos
   que se repiten y aparecen por separado, no tiene sentido.» En la Copa
   RyuCards salían 24 filas para 32 jugadores: el segundo icono que se
   deduce es la pareja o la carta técnica de cada uno («N's Zoroark ex
   N's Darmanitan», «… Pecharunt ex», «… Munkidori», «Zoroark ex de N
   Darmanitan de N» exportado en español…). Ahora se agrupa por el
   Pokémon PRINCIPAL, por especie (`dexesDeNombre`, que entiende los dos
   idiomas; una Mega no es la básica): con sus datos reales, 17 mazos y el
   Zoroark de N con 6 jugadores. Dentro de cada mazo salen sus variantes
   contadas y, en cada jugador, lo que jugó.
2. **La imagen exportada: todas las cartas juntas, fondo transparente y
   se puede importar.** Una sola rejilla como la de Limitless (24 cartas
   distintas, 8×3; repartidas sin cartas sueltas), las copias en un
   hexágono AZUL de la casa donde Limitless pone el rojo
   (`js/insignia-copias.js`) y debajo una franja con la marca, el nombre
   del mazo y pokedoc.es. Para importarla en el constructor (pegarla o
   subirla en «Importar → Imagen»):
   - **exacta**: el PNG lleva la lista en texto dentro, en un trozo
     `iTXt` (`js/lista-en-png.js`); el constructor la lee y la deja
     escrita para revisar e importar, sin bajar los 3 MB del
     reconocimiento;
   - **si se ha recomprimido** (una red social se lleva el texto): por
     cómo se ve. Las cartas son ahora los escaneos de Limitless (por
     `/escaneo`), los mismos de las huellas; el lector lee el hexágono
     azul con plantillas que se pinta él con la MISMA función; y
     encuentra las cartas sobre transparente, negro o BLANCO.

**Dos cosas del lector de imágenes que salieron al probarlo** (y que
tocan `detectar`, así que van también en `herramientas/huellas-limitless.js`,
que tiene que ser idéntica; `huellas.bin` no hay que regenerarlo: en una
imagen de Limitless sale lo mismo que antes):
- el tamaño de carta se elegía por la MEDIANA de las alturas, y la franja
  de la marca se partía en diecisiete «cartas» bajitas que le ganaban por
  número a las siete de verdad. Ahora gana el que más superficie ocupa;
- el lector de Limitless se creía que había hexágono ROJO en cualquier
  carta de fuego y leía un número de nada encima del azul. Ahora se leen
  los dos y gana el que mejor casa.

**Ficheros**: nuevos `js/insignia-copias.js` y `js/lista-en-png.js`.
Tocados `js/torneos/meta-torneo.js`, `css/torneos.css`,
`js/torneos/decklist-imagen.js`, `js/constructor/imagen.js`,
`herramientas/huellas-limitless.js`, `js/constructor.js`,
`constructor.html`. En `pruebas`: `test-tanda-421.mjs`,
`rigor-tanda-421.py` y la 413 al día (la forma vieja de la imagen).

**Prueba y rigor**: `test-tanda-421.mjs` en verde; su rigor, 17 mutaciones,
las 17 detectadas. Pasadas también, en verde, las del constructor y de
torneos que tocan esto (413, 420, 355, 359, 370, 384, 394, torneos-22 y
23, meta-torneo, 326, 328, sets-live) y los barridos de CSS (299, 309,
311–316).

**En curso / pendiente**: nada.

## 2026-10-01 15:50 — PINGU-Claude (tanda 420 — «este mazo no es tuyo» al guardar un mazo tuyo)

**Hecho**: PINGU: «no entiendo este error al guardar un mazo; cada uno
puede guardar el mazo que quiera en su cuenta». El mazo SÍ era suyo. Lo
miré en su navegador: el borrador del constructor («AlakaClefa», 29
cartas, del 30-09) apuntaba a un mazo que **ya no existía en su cuenta**.
El borrador vive en el NAVEGADOR, no en la cuenta: «Seguir con él» lo
recuperaba con ese id, «Guardar» intentaba pisar ese mazo, la base no
tocaba nada (la política dice que no SIN dar error) y salía «No se ha
guardado: este mazo no es tuyo», sin forma de salir de ahí.

1. **Recuperar un borrador mira de quién es su mazo**: si ya no existe,
   o es de otra cuenta que entró antes en este navegador, es un mazo
   NUEVO y «Guardar» lo crea en tu cuenta.
2. **Guardar un mazo que ya no está en tu cuenta** (por ejemplo, borrado
   en «Mis mazos» en otra pestaña mientras lo editabas) lo guarda como
   nuevo y lo dice («Guardado como mazo nuevo en tus mazos»), en vez del
   error. `guardarMazo` marca ese caso con `sinFila`; los demás errores
   siguen saliendo como errores.

**Ficheros**: `js/constructor.js`, `js/constructor/datos.js`. En
`pruebas`: `test-tanda-420.mjs` y `rigor-tanda-420.py` (4 mutaciones, las
4 detectadas). Pasadas también la del constructor, la 359, la 370, la 384
(que a veces falla en «Escape cierra el laboratorio» y a la segunda pasa:
es la de siempre, no de esto), la 413 y la 299.

**En curso / pendiente**: nada.

## 2026-10-01 — PINGU-Claude (tanda 419 — la barra que no se va, y dos dobles viejos)

**Hecho**: la tanda de pasar la suite ENTERA después de la 418 y arreglar
lo que cantó. Tres cosas de la web y dos de las herramientas.

**La barra flotante del móvil ya no se esconde.** La 406 le puso un
`IntersectionObserver` que la apartaba cuando el pie entraba en pantalla,
para que no tapara sus enlaces. Pero **en una página CORTA el pie se ve
desde el primer momento**, así que la barra nacía escondida y en el móvil
no había forma de cambiar de pestaña: ni un menú ni nada. Un menú que
desaparece es peor que un menú que tapa. Fuera el observador, y lo que
había que resolver se resuelve en el CSS y sin piezas móviles: el pie
reserva su sitio (`padding-bottom: 96px`). La barra está SIEMPRE, como en
una app.

**El diálogo de adorno cabe en el teléfono.** El de crear carpeta o álbum
crecía más que la ventana y el botón de «Crear» se salía por abajo: no
había forma de crear una carpeta desde el móvil. Ahora el formulario es
una columna flexible con el cuerpo desplazable y la cabecera y el pie
quietos. **Lo cazó la prueba del archivador**, que no iba de esto —falló
con «element is outside of the viewport»—.

**Y `--t-3xl` en vez de `34px`** en `.mc-burbuja-emoji`: el número estaba
en la escala y se escribió a pelo igualmente.

**Las dos herramientas, que es la parte que más vale escribir**:
`sync-forum.sh` copiaba el doble de Supabase de **una copia suelta en el
scratchpad**, no de la de la rama `pruebas`, que es donde vive de verdad.
Esa copia se quedó atrás y el doble servido no tenía ni el juez de la 394
ni la proyección de la 413: **las pruebas 394 y 413 salían ROJAS por el
doble y no por la web**, con 5 y 3 fallos que parecían una regresión de
torneos. Es EXACTAMENTE el mismo fallo que tenía `correr-suite.sh` con las
copias de las pruebas. Ahora los cinco ficheros que el script repone
salen del árbol de `pruebas` (`WT=/tmp/wt-pruebas`), y la copia vieja del
scratchpad queda renombrada para que nadie la vuelva a coger. Y la 413
necesita Pillow para medir el PNG exportado: estaba sin instalar y sus
tres medidas salían con un traceback de Python.

**Ficheros**: `css/mi-coleccion.css`, `js/mi-coleccion.js`. En la rama
`pruebas`: `herramientas/sync-forum.sh`, y las pruebas 369, 405 y 406
puestas al día con lo que cambió en la 417 y la 418 (el archivador ya
solo está en los álbumes soñados; el rótulo del set; la barra que no se
aparta).

**En curso / pendiente**: nada a medias. La suite entera pasada después
de todo esto.

## 2026-10-01 — PINGU-Claude (tandas 417 y 418 — la expansión, en rejilla)

**417**: dentro de una expansión ya no hay archivador: hay una **tira**
con lo que se pregunta de una colección (cuánto llevas con su anillo, lo
que valen tus copias y de qué va), un **buscador por nombre o número** y
la **rejilla entera**. Con pliegos había que pasar 22 páginas para mirar
un set de 200. El archivador se queda en los álbumes soñados, y con él se
muda el «Personalizar» de la tapa.

**418**: pulsar una carta abre la **ficha en la ventana** —en una
expansión y en la Pokédex te sacaba de la página— y, si no la tienes,
sale el botón de añadirla en vez del bloque de «tu copia». El enlace se
queda puesto: con Ctrl o con el botón de en medio sigue abriendo la
página entera. Las flechas del archivador van **a los lados** y las
páginas **debajo**. Y las dos vistas pasan a llamarse **«Juntar
variantes» / «Separar variantes»**.

**Un fallo que se vio al probarlo**: `cartas` es el mapa de TU colección,
así que una carta que no tienes no está en él — la ventana salía con el
nombre y el enlace de OTRA carta.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`js/mi-coleccion/albumes.js`, `js/mi-coleccion/pokedex.js`,
`css/mi-coleccion.css`, `SCHEMA.md`. En la rama `pruebas`:
`test-tanda-417.mjs` y `test-tanda-418.mjs` (nuevos) y SEIS puestas al
día (371, 372, 382, 383, 398 y 412).

## 2026-10-01 — PINGU-Claude (tanda 416 — el gráfico de precios, de vuelta)

**Hecho**: PINGU, «¿y dónde está el gráfico de precios? No existe». La
410 lo metió detrás de «Ver todas las estadísticas» y ahí no lo encuentra
nadie. Vuelve a la vista, debajo de la tira; detrás del botón se quedan
las listas. Es la única cifra que cambia sola y es la que se viene a
mirar — estaba escrito en la 377 y se perdió al reordenar.

**Si en producción dice «la primera foto se toma esta noche»** no es la
gráfica: es que no hay filas en `user_collection_value`, que las escribe
la función programada `valor-coleccion.mjs` a las 4:07.

**Ficheros**: `js/mi-coleccion.js`, `SCHEMA.md`. En la rama `pruebas`:
`test-tanda-410.mjs` puesta al día.

## 2026-10-01 — PINGU-Claude (tanda 415 — los dibujos que faltaban)

**Hecho**, todo de lo que vio PINGU en producción:

- **Los logos que faltan**: no es un fallo de importación, es que TCGdex
  no tiene logo de esos sets. Pero la misma fila guarda el **símbolo**
  (`symbol_url`), que llevaba ahí SIN USARSE desde que se importa el
  catálogo; y si tampoco está, el **nombre** en la cabecera. La cadena ya
  no puede acabar en nada.
- **Las cartas sin escaneo** llevan el nombre en el hueco. En un álbum,
  un bolsillo lleno y en blanco dice lo contrario de lo que pasa.
- **McDonald's, Futsal, Battle Academy, Trick or Trade, My First
  Battle…** se van a «Sets especiales».
- **La tira del panel**, sin barra y con flechas que se apagan en los
  extremos. (Y una trampa: `display: grid` en la clase gana al `[hidden]`
  del navegador, así que la flecha apagada se seguía viendo.)
- **Los cambios**: tres cifras arriba y, sin nada apuntado, los tres
  pasos de cómo funciona en vez de dos tablones vacíos.

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/estanteria.js`,
`js/mi-coleccion/pokedex.js`, `css/mi-coleccion.css`, `SCHEMA.md`. En la
rama `pruebas`: `test-tanda-415.mjs` (nuevo).

**En curso / pendiente**: los cuatro SQL ya están lanzados (PINGU, hoy).
Queda pasar la suite entera.

## 2026-10-01 — PINGU-Claude (tanda 414 — la Pokédex: el anillo y las generaciones)

**Hecho**: la Pokédex pasa de ser un muro de 1.025 casillas a un índice:
agrupada **por generaciones**, con cuántos llevas de cada una al lado del
rótulo. La última generación no tiene final (`Infinity`) a propósito: el
día que salga la décima, una lista de rangos cerrados dejaría a los
nuevos fuera de todos los grupos y desaparecerían sin dar error. Y la
caja de «Registrados» lleva un **anillo** de progreso —`conic-gradient`,
sin dependencias— con su `aria-label`.

**Ficheros**: `js/mi-coleccion/pokedex.js`, `css/mi-coleccion.css`,
`SCHEMA.md`. En la rama `pruebas`: `test-tanda-413.mjs` (nuevo).

**En curso / pendiente**: los CUATRO SQL sin lanzar. Y queda pasar la
suite entera: desde la 409 solo se han corrido las pruebas de lo tocado.

## 2026-10-01 13:45 — PINGU-Claude (tanda 413 — la impresión de la colección, guardar cualquier lista, la portada y el meta del torneo)

**Hecho**: cinco cosas que pidió PINGU de una tacada. Sin migración.
(Empezada en local como la 398; mientras se probaba, el remoto llegó a
la 410, así que se numeró 411 — al integrarla desde el bundle la 411
de las carpetas había llegado antes (412), y al empujarla llegó la 412
de los mandos del archivador: queda como la **413**. El choque de la
384 y la 394, por tercera y cuarta vez en el mismo día.)

1. **Una impresión por carta, la de rareza más baja de su colección.**
   «Que no salgan distintos reprints»: la rejilla de una lista (torneos
   y /meta), la imagen exportada, el constructor y «Guardar en mis
   mazos» enseñan lo mismo. Lo que pasa de `card_count_official` se
   cambia por la misma carta de su set con el número más bajo dentro; la
   misma carta de dos sets va en UNA casilla sumando copias (nunca la
   promo si hay colección). Un Pokémon solo se junta si tiene los
   MISMOS ATAQUES: dos Riolu distintos siguen siendo dos.
2. **«En el constructor muchas cartas no se ven»**: las promos MEP no
   tienen escaneo en TCGdex y el constructor no tenía respaldo; ahora va
   a Limitless como el resto del sitio. Y un mazo abierto desde /meta
   llegaba con 52 de 60 (las energías MEE 9–16 no se resolvían por
   número, y dos líneas de la misma carta se pisaban).
3. **Guardarse cualquier lista**: «Guardar en mis mazos» en la ventana de
   la lista de un jugador del torneo y en /meta. Privado, con portada.
4. **La portada que quieras** en «Mis mazos» (de las del mazo o buscando
   cualquiera), con la tarjeta rehecha. El constructor ya no la pisa al
   guardar.
5. **La imagen exportada, estilo Limitless** (rejilla de cartas con sus
   copias, azul de la casa). Las de Limitless no traen CORS y mancharían
   el lienzo: van por `/escaneo/:set/:n`, función nueva que solo acepta
   set y número.
6. **El meta del torneo**: pestaña «Meta» con los mazos y su parte, y
   dentro de cada uno quién lo jugó en el ORDEN FINAL (con corte, manda
   el corte) y su lista. Existe solo cuando las listas pueden verse.

**OJO, mudanza**: la resolución de una lista contra el espejo salió de
`cartas-decklist.js` a `js/lista-canonica.js` (sin clases: la usa la
imagen exportada desde el constructor). `cartas-decklist.js` la
reexporta, así que los imports de siempre siguen valiendo. En `pruebas`
he movido a la vez los anclajes de los rigores 232, 233, 326 y 328 y dos
comprobaciones de texto de las pruebas 328 y 345.

**Ficheros**: nuevos `js/impresion-canonica.js`,
`js/impresiones-del-set.js`, `js/lista-canonica.js`,
`js/guardar-lista.js`, `js/torneos/meta-torneo.js`,
`netlify/functions/escaneo.mjs`. Tocados `js/torneos/cartas-decklist.js`,
`js/torneos/decklist-imagen.js`, `js/torneos/ronda.js`,
`js/torneos/torneo.js`, `torneo.html`, `css/torneos.css`,
`js/constructor.js`, `js/constructor/datos.js`, `constructor.html`,
`js/mazos.js`, `mazos.html`, `css/constructor.css`, `js/meta-mazo.js`,
`netlify.toml`, `SCHEMA.md`. En `pruebas`: `test-tanda-413.mjs`,
`rigor-tanda-413.py`, `stub-supabase.js` (`__PROYECTAR__`) y los ajustes
de la mudanza (la 413 entra sola en `correr-suite.sh`, que desde la 405
lee el directorio).

**Prueba y rigor**: `test-tanda-413.mjs`, 179 comprobaciones; su rigor,
43 mutaciones, las 43 detectadas. **El doble de Supabase tiene un
interruptor nuevo**, `window.__PROYECTAR__ = ['tcg_cards']`: devuelve
solo las columnas pedidas, como PostgREST (sin él devuelve la fila
entera, y un código que usa una columna que NO pide funciona aquí y no
en producción). Optativo: las pruebas viejas no cambian.

**Suite**: entera sobre la 397 (verde salvo lo que no era mío), y otra
vez después de traerme de la 398 a la 408: la mía, todas las de torneos,
constructor y catálogo, los barridos de CSS (299, 309–316) y las diez
nuevas de la 398 a la 408, en verde (la 409 y la 410 llegaron después).
**Una roja que NO es de esta tanda**: `test-tanda-310` («solo dos duraciones de transición») canta el `0.2s`
de `css/mi-coleccion.css:205`, que entró con la 406. No lo he tocado:
es un fichero que otra sesión está moviendo ahora mismo.

**En curso / pendiente**: nada a medias. La roja de la 310, para quien
lleve `mi-coleccion.css`.
## 2026-10-01 — PINGU-Claude (tanda 412 — los mandos del archivador y la cabecera)

**Hecho**: repaso de interfaz. En el **archivador**, las cinco filas de
mandos entre el título y la primera carta pasan a dos: las barras de
progreso suben justo debajo del título y el resto es una fila de chapas,
con «Al añadir» colgando de la suya en vez de empujar la fila. La primera
carta sube unos 200 px.

**Un fallo mío de la 406, corregido**: al unificar los buscadores, la
regla propia de la Pokédex —que va después en la hoja— le devolvía el
relleno izquierdo al campo, así que el texto de ejemplo se pintaba ENCIMA
de la lupa. La prueba no mira la Pokédex: recorre todos los buscadores.

**Y la cabecera**: las cuatro cifras iban en dos filas de cajas grandes
en las CINCO pestañas; ahora son una tira que se desliza. Y la nota que
explica el valor se queda solo en el Panel, que es donde se enseña el
valor. En el móvil, el buscador pasa de empezar a 500 px a empezar a 304.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `SCHEMA.md`. En la rama `pruebas`:
`test-tanda-412.mjs` (nuevo).

**En curso / pendiente**: los CUATRO SQL sin lanzar.

## 2026-10-01 — PINGU-Claude (tanda 411 — carpetas y álbumes, con la misma burbuja)

**Hecho**: carpetas y álbumes se pintan con la MISMA burbuja que una
expansión (`js/mi-coleccion/adorno.js`), y al crear o editar sale un
diálogo —uno solo para los dos— donde eliges icono del sitio, Pokémon o
emoji, y color de fondo. El `window.prompt` de la 402 se va: pedía el
nombre y nada más, así que una carpeta nacía sin cara. Un álbum sin
adorno sigue enseñando la portada de su primera carta.

**DOS SQL que tocan**: `supabase-migration-carpetas.sql` **ha cambiado**
(lleva `icono` y `dex_id`); como no estaba lanzado se ha editado ese
fichero en vez de añadir otro, y va con `add column if not exists`, así
que relanzarlo no duele. Y uno nuevo:
`supabase-migration-album-adorno.sql`.

**Un error mío, corregido**: al quitar el CSS que quedaba muerto lancé un
barrido con expresión regular y se llevó reglas de VARIOS selectores,
dejando selectores huérfanos pegados a la regla siguiente. Se vio
contando las llaves, se restauró desde la copia del servidor de pruebas y
se hizo a mano. La lección de los barridos en bloque, otra vez.

**Ficheros**: `js/mi-coleccion/adorno.js` (nuevo),
`js/mi-coleccion/dialogo-adorno.js` (nuevo), `js/mi-coleccion/carpetas.js`,
`js/mi-coleccion/albumes.js`, `js/mi-coleccion.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`, `supabase-migration-carpetas.sql`,
`supabase-migration-album-adorno.sql` (nuevo), `SCHEMA.md`. En la rama
`pruebas`: `test-tanda-411.mjs` (nuevo).

**En curso / pendiente**: CUATRO SQL sin lanzar —carpetas (editada),
quién la tiene, favoritos de sets y el adorno de los álbumes—.

## 2026-10-01 — PINGU-Claude (tanda 410 — el panel, con la tira de tarjetas)

**Hecho**: el panel, reordenado como pidió PINGU viendo Dex. Una **tira
de cuatro tarjetas que se desliza** (cuántas tienes, lo que vale, lo que
te sobra, por rareza), debajo **los cambios** —que era la queja: estaban
a cuatro pantallas de desplazamiento y ahora empiezan a 273 px— y, detrás
de «Ver todas las estadísticas», lo largo de antes. De regalo: la gráfica
del valor es una consulta y ya no se pide hasta que se abre ese bloque.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`, `SCHEMA.md`.
En la rama `pruebas`: `test-tanda-410.mjs` (nuevo).

**En curso / pendiente**: lo que viene es carpetas y álbumes con la misma
tarjeta que las expansiones, y un diálogo para crearlas eligiendo emoji,
sprite de la Pokédex y color. OJO: eso toca
`supabase-migration-carpetas.sql`, que todavía NO está lanzado — se edita
ese fichero en vez de añadir otro.

## 2026-10-01 — PINGU-Claude (tanda 409 — las expansiones, por eras y por año)

**Hecho**: la estantería se ordena por ERAS y, dentro, por año con lo más
nuevo arriba. El orden de las eras no está escrito en ninguna lista: una
era vale lo que vale su set más nuevo, así que la que salga en 2030 se
coloca sola. Los **promos de cada era se quedan en su era**, al fondo de
ella (forzado, no fiado a la fecha: una colección de promos sigue
recibiendo cartas años). Al fondo del todo, solo lo que no es de ninguna
era: Trainer Kits y POP Series. Y **fuera el grupo «Tus colecciones»**:
arriba va solo lo que marcas con la estrella dentro de la expansión.

**SQL nuevo**: `supabase-migration-sets-favoritos.sql` (tabla con RLS,
sin foránea al catálogo). Sin él la pantalla funciona igual, sin grupo de
arriba y sin estrella.

**OJO con el doble de `auth.uid()`**: el guardado en la rama `pruebas`
(`sql/prep-torneos.sql`) lee `prueba.uid` y está bien. El que tenía
CARGADO la base local estaba sobrescrito con un uuid FIJO — con él,
cualquier prueba de política pasa sola porque los dos «usuarios» son el
mismo. Restaurado el bueno. Si una comprobación de RLS sale bien a la
primera, mira antes qué devuelve `auth.uid()`.

**Ficheros**: `js/mi-coleccion/estanteria.js` (nuevo),
`js/mi-coleccion/datos.js`, `js/mi-coleccion.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`, `supabase-migration-sets-favoritos.sql` (nuevo),
`SCHEMA.md`. En la rama `pruebas`: `test-tanda-409.mjs` (nuevo).

**En curso / pendiente**: TRES SQL sin lanzar —carpetas, quién la tiene y
este de favoritos—. Y el Panel, que PINGU quiere con tiras de tarjetas
tipo Dex y un «Ver todo»; está sin empezar.

## 2026-10-01 — PINGU-Claude (tanda 408 — de ocho pestañas a cinco)

**Hecho**: lo pidió PINGU y tenía razón — la 405 había resuelto el
síntoma (que las ocho CUPIERAN en una columna) y no el problema. Quedan
**cinco**: Cartas (que se come **Añadir cartas**), Expansiones, Pokédex,
Carpetas (que se come **Álbumes soñados**) y **Panel** (antes «Resumen»,
que se come **Cambios**). Un solo buscador: arriba lo tuyo y debajo «¿No
la tienes? Añádela del catálogo» — tener dos obligaba a saber ANTES de
buscar si la carta ya era tuya. Con cinco sobra el «Más» del móvil y los
rótulos de grupo de la columna.

**Los enlaces viejos no se borran, se redirigen**: `?ver=anadir` →
Cartas, `?ver=albumes` → Carpetas (con su `&album=`) y `?ver=cambios` →
Panel. Un `?ver=` que ya no existe NO da error: abre la primera pestaña y
parece que el enlace estaba mal escrito.

**Y una regresión de la 405 que no se había visto**: el panel del Resumen
pedía 420 px por caja, y desde que el menú es una columna el panel mide
840 en una pantalla de 1280 — dos cajas piden 856. Las cuatro cajas se
quedaban en cuatro filas, sin dar error. A 380.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`js/mi-coleccion/albumes.js`, `js/carta-mercado.js`, `css/mi-coleccion.css`,
`SCHEMA.md`. En la rama `pruebas`: `test-tanda-408.mjs` (nuevo) y la
sección del menú de `test-tanda-405.mjs`, que hablaba de ocho.

**En curso / pendiente**: los dos SQL sin lanzar
(`supabase-migration-carpetas.sql` y `supabase-migration-quien-la-tiene.sql`)
y los tres puentes temporales.

## 2026-10-01 — PINGU-Claude (tanda 407 — la carta que no estaba en el móvil)

**Hecho**: PINGU pasó las capturas de la ficha de Dex en el móvil para
compararlas, y al abrir la nuestra salió otra cosa: **la carta no se
veía**. `.mc-ficha-carta` llevaba `margin: 0 auto`, y un margen
automático ANULA el estirado del hijo de una rejilla; sin estirado la
caja se encoge a su contenido, y su contenido mide el 100 % DE ELLA — la
cuenta es circular y sale CERO. La ficha de una carta se abría en el
móvil sin la carta, sin dar error. **Segunda vez que pica el mismo
margen** (la primera, `.page-content` en la 313). Y de paso, el nombre y
las chapas se centran bajo la carta en el móvil, como en la app.

**Ficheros**: `css/mi-coleccion.css`, `SCHEMA.md`. En la rama `pruebas`:
`test-tanda-407.mjs` (nuevo) — que no comprueba el ancho que falló, sino
que la carta tiene caja en CINCO anchos.

**En curso / pendiente**: los dos SQL sin lanzar
(`supabase-migration-carpetas.sql` y `supabase-migration-quien-la-tiene.sql`)
y los tres puentes temporales.

## 2026-10-01 — PINGU-Claude (tanda 406 — el móvil con la cara de la app)

**Hecho**: con las cinco capturas de dextcg.com en el móvil delante. **La
barra de pestañas se va abajo**, flotando como una píldora, con la chapa
azul detrás del ICONO de la que está abierta (detrás del hueco entero
tocaba el borde y parecía un trozo pegado). **Y se aparta cuando llega el
pie**, que Dex no necesita y una web sí: un menú encima de los enlaces
del pie estorba, y esos enlaces son los que recorre Google. **Y los tres
desplegables que son FILTROS** (series, rareza, categoría) pasan a ser
chapas con su flechita; los del panel de filtros no se tocan, que ahí
dentro un formulario es un formulario.

**Lo que NO se ha copiado**: las expansiones en fila (miniatura a la
izquierda) del móvil de Dex. Para que la tarjeta cambie de forma según SU
ancho haría falta envolver cada una; con un `@media` funciona hoy y se
rompe el día que esa rejilla salga en otro sitio (la lección de la 316).
Si se quiere igualmente, va con el envoltorio.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `SCHEMA.md`. En la rama `pruebas`:
`test-tanda-406.mjs` (nuevo).

**En curso / pendiente**: lo mismo que dejó la 405 —los dos SQL sin
lanzar (`supabase-migration-carpetas.sql` y
`supabase-migration-quien-la-tiene.sql`) y los tres puentes temporales—.

## 2026-10-01 — PINGU-Claude (tanda 405 — mi colección, con la cara de una app)

**Hecho**: la reestructura que pidió PINGU con las capturas de dextcg.com
delante. **El menú ya es lateral en el ordenador** y agrupado en tres
—«Tu colección», «Explorar», «Tu actividad»—, porque ocho pestañas en una
fila no caben en un portátil; **en el móvil es la barra de cinco sitios de
la app** (Cartas · Expansiones · Pokédex · Carpetas · Más), con el mismo
DOM para las dos formas. **La barra de buscar** es ahora la misma pieza en
las cuatro pantallas: campo de 320 px con la lupa dentro, chapa de filtros
con contador y un ✕ que quita texto y filtros. Y de la tanda anterior, sin
subir todavía: **la ficha** con el rótulo fuera de la caja y la nota
plegada, y **las expansiones** con el fondo emborronado, el logo centrado
y el código del set.

**Tres rojos que no eran de esta tanda y llevaban desde la 398**: un
`border-radius: 10px` a pelo (309), un `padding: 0 6px` que no es un paso
(311) y la foto grande de la ficha sin `loading` (310 — va `eager` a
propósito, es la carta que acabas de pulsar, y ahora lo dice el atributo).

**Y el motivo de que no se vieran, que es lo gordo**: `correr-suite.sh`
corría las COPIAS de las pruebas que hubiera en el directorio de trabajo,
no las de la rama `pruebas`. Las que no se copiaron salían «AUSENTE»
(380-383), las copias viejas daban rojos FALSOS (la 373 leía
`css/carta.css`, de donde el holo se mudó en la 394) y **la 398, 399, 400,
402, 403 y 405 no estaban ni en la lista: no se habían corrido ni una
vez**. Ya las coge del worktree y las ordena por número.

**Y un respaldo que faltaba**: el nombre de un set va en `sr-only` porque
el logo lo lleva escrito, así que el día que la CDN no conteste la tarjeta
se quedaba sin NADA que leer. Ahora, al fallar la imagen, el nombre vuelve
a la vista.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`, `SCHEMA.md`. En la rama `pruebas`:
`test-tanda-405.mjs` (nuevo) y `herramientas/correr-suite.sh`.

**En curso / pendiente**: dos SQL sin lanzar —
`supabase-migration-carpetas.sql` y
`supabase-migration-quien-la-tiene.sql`—. Los tres puentes temporales
siguen puestos a propósito (hasta que PINGU confirme que esas migraciones
corren en producción). Y las tandas 395-404 no tienen entrada en
`SCHEMA.md`; la 405 sí.

## 2026-10-01 — PINGU-Claude (tanda 404 — la pestaña se llama Expansiones)

**Hecho**: lo que quedaba de la estructura. La pestaña «Álbum» pasa a
llamarse **Expansiones**, que es lo que enseña y como lo llama todo el
mundo. «Álbumes soñados» NO se toca: es otra cosa.

**Los tres puentes siguen puestos, a propósito.** Estaban en la lista de
pendientes, pero quitarlos a ciegas es una apuesta mala: si la migración
de `torneos-cola` no estuviera puesta, quitar ese puente deja a la gente
sin poder inscribirse a un torneo. Se gana un puñado de líneas y se
arriesga una sección entera. Van cuando PINGU confirme que esas tres
migraciones están corriendo en producción.

**Ficheros**: `mi-coleccion.html`.

## 2026-10-01 — PINGU-Claude (tanda 403 — quién de los tuyos tiene esta carta)

**Hecho**: el bloque «FRIENDS» de Dex, con lo que aquí tiene sentido —
no hay amigos, hay **seguidos**.

Va por una función de la base y no por una consulta: **la colección de
otra persona no se lee desde fuera**, su política solo deja ver la tuya,
y abrirla entera para esto sería enseñar a cualquiera lo que tiene todo
el mundo. La función contesta esa pregunta y ninguna otra.

**Y respeta `coleccion_publica`**: quien la tiene en privado no sale
aunque le sigas. Seguir a alguien no es permiso para mirarle los cajones.

El bloque se esconde si no hay nadie: un rótulo «La tienen» encima de un
hueco vacío dice «no tienes amigos» sin querer. Y una respuesta que llega
tarde no pinta la gente de otra carta — la ficha se abre y se cierra más
rápido que la consulta.

**La prueba de la 386 hizo su trabajo**: la función devolvía un nombre
que sale CON ENLACE al perfil y no traía `is_admin`/`is_moderator`, así
que habrían salido todos en azul. Lo cazó sola.

**SQL a ejecutar**: `supabase-migration-quien-la-tiene.sql` (**nuevo**).
Sin él, el bloque no sale y ya está.

**Ficheros**: `supabase-migration-quien-la-tiene.sql` (**nuevo**),
`js/mi-coleccion/datos.js`, `js/mi-coleccion.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`. En `pruebas`: `test-tanda-403.mjs` (**nuevo**) y
`correr-suite.sh`.

## 2026-10-01 — PINGU-Claude (tanda 402 — carpetas para ordenar tu colección)

**Hecho**: lo que pidió PINGU viendo Dex — carpetas, con subcarpetas
dentro, para ordenar la colección como quieras. Pestaña propia, y en la
ficha de una carta unos chips para meterla y sacarla.

**Por qué una tabla y no una etiqueta**: lo barato habría sido un
`text[]` en `user_collection`, pero una carpeta tiene nombre, color,
emoji, orden y PADRE, y eso en un array de cadenas acaba siendo un nombre
con separadores dentro. Lo que mata la idea es la carpeta VACÍA: con
etiquetas no existe hasta que metes algo, así que no se puede crear
primero y llenar después — que es justo como se ordena una colección.

**El ciclo lo impide un disparador y no un `check`**: una restricción
solo ve la fila que se escribe, y esto hay que mirarlo SUBIENDO por el
árbol. Con tope de 50 vueltas, por si alguna vez entrara un ciclo por
otro lado: sin él, el bucle se llevaría la conexión por delante.
Comprobado contra Postgres 16 a uno y a dos saltos.

**Borrar una carpeta se lleva sus subcarpetas pero NO las cartas**: una
carta vive en tu colección, no en la carpeta. Y el aviso lo dice.

**Una carpeta huérfana se cuelga de la raíz** en vez de desaparecer: una
carpeta que no se ve es una carpeta que no se puede recuperar. Y el
desplegable de madres no ofrece ni la propia ni sus descendientes —
ofrecer un ciclo es ofrecer un error.

**«No tienes carpetas» y «las carpetas no están activadas» son mensajes
distintos**: lo primero se arregla creando una y lo segundo ejecutando un
SQL. Decir lo que no es manda a la gente a buscar un botón que no existe.

**Un fallo que salió al probarlo**: el `?ver=` tiene su lista de pestañas
permitidas, y una pestaña nueva que no esté en ella no se abre por enlace
— el panel se queda escondido **sin dar error**.

**SQL a ejecutar**: `supabase-migration-carpetas.sql` (**nuevo**). Hasta
que no esté, la pestaña lo dice y no se rompe nada.

**Ficheros**: `supabase-migration-carpetas.sql` (**nuevo**),
`js/mi-coleccion/carpetas.js` (**nuevo**), `js/mi-coleccion.js`,
`js/mi-coleccion/datos.js`, `mi-coleccion.html`, `css/mi-coleccion.css`.
En `pruebas`: `test-tanda-402.mjs` (**nuevo**) y `correr-suite.sh`.

## 2026-10-01 — PINGU-Claude (tanda 401 — el XP de un torneo, contado)

**Hecho**: lo que quedó dicho como pendiente en la 387. El XP de un
torneo se ganaba **en silencio**: se veía en el perfil y en el rastro,
pero no había ningún «+150 XP» por ningún lado, que es como no verlo.

La fase del reparto ahora corre **antes** que la del aviso del final (iba
después), así que el aviso puede leer `tournament_xp_awards` y decir
cuánto te llevaste. Al campeón se le dice la cifra; al resto, que su XP
está sumado — una cifra en común no vale, cada uno se llevó la suya.

Si la tabla no está puesta, el aviso sale como antes: un premio que no se
puede leer no puede llevarse por delante el aviso del final.

**Ficheros**: `netlify/functions/torneos-barredor.mjs`. En `pruebas`:
`test-tanda-387.mjs`.

## 2026-10-01 — PINGU-Claude (tanda 400 — la cabecera de la Pokédex)

**Hecho**: arriba de la Pokédex van ahora cuatro cifras, como en Dex:
**registrados** (con su porcentaje), **completados** (los que tienes con
TODAS sus cartas), **el que más tienes** y **el que menos**. Antes solo
había un «X de 1.025» en letra pequeña.

«El que menos» es entre los que TIENES: un cero no es «poco», es que no
lo tienes, y para eso ya está lo que falta. Y con la Pokédex vacía esas
dos tarjetas no se pintan — enseñar a alguien con un 0 sería inventarlo.

**Dos detalles que salieron al verlo**: `especiePorDex` devuelve el
NOMBRE y no un objeto, así que pedirle `.nombre` daba `undefined` y salía
«#25» en vez de «Pikachu»; y 2 de 1.025 redondeado da «0 %», que parece
que no tienes nada cuando sí tienes, así que por debajo del 10 % va con
un decimal. El total lleva su punto de millar, que «1025» se lee como un
número de carta.

**Ficheros**: `js/mi-coleccion/pokedex.js`, `js/mi-coleccion.js`,
`css/mi-coleccion.css`. En `pruebas`: `test-tanda-400.mjs` (**nuevo**) y
`correr-suite.sh`.

## 2026-10-01 — PINGU-Claude (tanda 399 — los filtros, en un panel de chips)

**Hecho**: lo que pidió PINGU viendo el panel de Dex. La barra se queda
con buscar y un botón de **Filtros**; el resto se va a un panel que entra
por la derecha, con **orden** (y su «al revés»), **colección**,
**idioma** y chips de **tipo de carta**, **energía**, **rareza**,
**versión** y **estado**.

**Los grupos salen de lo que HAY en tu colección**, no de una lista
escrita a mano: una lista ofrece rarezas que no tienes y se queda sin las
que salgan mañana (la lección de la 323). Y **un grupo con un solo valor
no se pinta**: un filtro con una opción no filtra nada.

**Dentro de un grupo los chips SUMAN y entre grupos RESTAN.** Es lo que
se espera, y al revés no serviría: elegir dos rarezas daría cero
resultados siempre.

**El «al revés» invierte la lista YA ordenada** en vez de escribir cuatro
comparadores más, así que un orden nuevo sale con su vuelta puesta. Y va
en su propio botón y no en «tocar otra vez el mismo campo» como Dex: un
segundo significado escondido en el mismo sitio no se descubre.

Y una chapa con cuántos filtros hay puestos, porque sin ella un filtro
olvidado parece una colección que ha encogido.

**Ficheros**: `js/mi-coleccion.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`. En `pruebas`: `test-tanda-399.mjs` (**nuevo**),
`test-tanda-382.mjs`, `correr-suite.sh`.

## 2026-10-01 — PINGU-Claude (tanda 398 — las tres barras del set, y una casilla por versión)

**Hecho**: la «tanda B» de lo de Dex.

1. **Tres barras en vez de una**: **completo** (una casilla por número),
   **maestro** (cada versión por separado) y **adicionales** (los
   secretos). Son tres preguntas distintas y antes solo había la primera,
   así que quien colecciona por versiones no tenía ningún número suyo. En
   151 eso es 164 de 207 contra 257 de 360. Las cuentas van en
   `js/mi-coleccion/progreso-set.js`, puro y probado en Node.
2. **Una por carta / una por versión** (el Stack/Split de Dex). En
   «versión» cada carta se abre en tantas casillas como versiones tenga,
   cada una con su nombre, su cuenta y sus botones — y el «+» suma a ESA
   versión, que si no las cuatro casillas harían lo mismo. Se recuerda,
   porque quien va a por el set maestro lo quiere siempre.

**Dos reglas que se respetan**: solo es *adicional* lo que pasa del
recuento oficial Y es un número (las promos llevan «XY122» y ahí no se
puede decir si va antes o después), y la barra que no tiene nada que
contar no se pinta — la mayoría de los sets viejos no tienen secretos.

**Un fallo que salió al probarlo**: `album.set` es el ID y no el set, así
que el recuento oficial no llegaba y la barra de «completo» se comía el
set entero (1 de 3 en vez de 1 de 2) sin la de secretos.

**Y dos pruebas viejas**: la 383 miraba el texto de la barra única; y la
368 comprobaba que no hubiera un `<button>` dentro del enlace mirando
«los 400 caracteres siguientes», una ventana que se come el `</a>` y
marcaba como malo un botón que está fuera. Una distancia no es una
estructura — y es la segunda vez que esa prueba pica en lo mismo.

**Ficheros**: `js/mi-coleccion/progreso-set.js` (**nuevo**),
`js/mi-coleccion.js`, `mi-coleccion.html`, `css/mi-coleccion.css`. En
`pruebas`: `test-tanda-398.mjs` (**nuevo**), `test-tanda-383.mjs`,
`test-tanda-368.mjs`, `correr-suite.sh`.

## 2026-10-01 — PINGU-Claude (tanda 397 — la ficha se guarda sola)

**Hecho**: tres cosas que pidió PINGU comparando con Dex, y un fallo que
cantó él.

1. **Se guarda SOLO.** «Que no tengas botón de guardar o cancelar o
   quitar de la colección; todo eso sobra; según haces el cambio, que se
   guarde.» Y tenía razón en más que el gusto: con botón de guardar,
   cerrar la ficha pulsando fuera o con Escape **tiraba lo escrito sin
   avisar**. Ahora no hay nada que perder porque no hay nada pendiente.
   Los desplegables y el contador guardan al soltar; lo que se teclea,
   con 600 ms de retardo para no mandar una petición por letra.
2. **Quitar una carta es bajar las copias a CERO**, que es como lo hace
   Dex. Sigue preguntando, porque no se puede deshacer y porque ya no hay
   botón de cancelar: sin la pregunta, un «−» de más en la última copia
   se lleva la carta.
3. **La carta ocupa todo el alto de su columna.** «En Dex la carta ocupa
   todo el vertical izquierdo, así no deja hueco.» La derecha siempre es
   más alta —lleva tres paneles— y debajo de la carta quedaba un socavón;
   centrada en la columna entera, el hueco se reparte y deja de leerse
   como un olvido.
4. **El número de copias no se veía en el tema oscuro.** El mando lleva
   fondo propio (`--white`) y el campo heredaba el color que tocara, así
   que se leía en claro y no en oscuro. Ahora el color va DICHO, y la
   prueba lo mide en los dos temas (17,4 y 13,5).

**Y un fallo que salió al permitir el cero**: `Number(campo.min) || 1`
convertía el 0 en 1, porque **el cero es falsy**. O sea que el «−» nunca
llegaba a quitar la última copia, justo lo que se acababa de añadir.

**Pendiente de lo que pidió PINGU**: las carpetas y «qué seguidores la
tienen» van en tanda propia — la primera pide tabla nueva y la segunda,
consultar colecciones ajenas con su política. Y las chapas de variante
con su cuenta (como el Blastoise Holo ×1 / Jumbo) son un cambio de
modelo: nuestra ficha edita UNA línea y la suya enseña todas las
versiones de la carta a la vez.

**Ficheros**: `js/mi-coleccion.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`. En `pruebas`: `test-tanda-392.mjs`,
`test-tanda-376.mjs`.

## 2026-10-01 — PINGU-Claude (tanda 396 — la ficha, vestida)

**Hecho**: lo que PINGU llevaba pidiendo dos veces y yo no había hecho —
arreglé las cuatro cosas concretas de la 395 pero no el ASPECTO: «sigue
siendo muy pocho, mira qué bonito y moderno lo muestra Dex».

Lo que hacía que lo suyo pareciera montado y lo nuestro no era el
AGRUPAMIENTO: allí cada grupo vive en su caja con su fondo y su aire, y
aquí eran rótulos sueltos sobre el fondo del diálogo, así que nada
separaba «el precio» de «tu copia» salvo un hueco. Ahora cada bloque es
un panel, el nombre pesa más, el precio se lee como el número que es, y
la carta se queda PEGADA mientras bajas por los datos (la ficha se
desplaza por dentro, y sin eso la protagonista se iba arriba).

Y las copias llevan sus dos botones: un campo de número a secas obliga a
seleccionar y teclear para sumar una, que es lo que más se hace aquí —
te llega un sobre y metes la que ya tenías.

**Dos cosas que cazaron las pruebas y no yo**: el diálogo medía 897 de un
tope de 852, porque con `content-box` el relleno se SUMA al `max-height`;
y la aserción que lo cantó comparaba contra 900 mientras esa prueba abre
a 1000 de alto — un número a mano donde tenía que ir el alto de verdad.

**Y un fallo mío al resolver el conflicto de la 395**: en un `rebase`,
`<<<<<<< HEAD` es lo que YA ESTABA en el remoto, no lo propio. Renumeré
el bloque de Ibai y dejé el mío con el número viejo. Arreglado aquí: lo
del día del torneo es la 394 y lo del holo la 395.

**Ficheros**: `css/mi-coleccion.css`, `mi-coleccion.html`,
`js/mi-coleccion.js`, `BITACORA.md`. En `pruebas`: `test-tanda-392.mjs`.

**En curso / pendiente**: la tanda B (Stack/Split Variants y las tres
barras del set). Y del plan largo: filtros en panel lateral, cabecera de
la Pokédex, carpetas e intercambios por objetivo.

## 2026-10-01 — PINGU-Claude (tanda 395 — el holo en la colección, y salir pulsando fuera)

**Hecho**: cuatro cosas que pidió PINGU viendo la 393.

1. **La imagen de la ficha era la MINIATURA.** Se reutilizaba la de la
   rejilla (`low`), y a 380 px de ancho una imagen pensada para 140 se ve
   borrosa — justo la carta, que es lo que has venido a mirar. Ahora pide
   `high`, la misma que /carta.
2. **El holo, en la ficha y en la rejilla.** PINGU: «la animación de la
   ficha completa cuando pasas el ratón, que se mueva así como en 3D y
   con el holo, es bastante mejor». Se reutiliza `js/carta-holo.js` y el
   MISMO envoltorio y `data-brillo` que /carta: si fueran otros, el día
   que alguien toque el efecto arreglaría una pantalla y dejaría la otra
   a medias. Fuera el «levantarse» de la 392.
3. **En la rejilla se monta al PASAR por encima**, no al pintar: con
   trescientas cartas, montarlo en todas serían trescientos juegos de
   escuchas para las dos o tres por las que vas a pasar.
4. **Pulsar fuera cierra la ficha.** Un `<dialog>` no lo hace solo. Y se
   mira que el clic caiga FUERA de su caja, no solo que el destino sea el
   diálogo: sin eso, pulsar en el hueco entre dos campos lo cerraría con
   lo que estabas escribiendo a medias.

Para lo del holo hubo que sacar su bloque de `css/carta.css` a
**`css/carta-holo.css`**: ahora lo cargan CUATRO páginas (/carta,
/cartas, /coleccion y /mi-coleccion). Cargar `carta.css` entera habría
traído las dos columnas, las migas y el bloque de combate, que en la
colección no pintan nada.

**El barrido de la 299 hizo su trabajo**: avisó de que `cartas.html` y
`coleccion.html` también usan esas clases y se habían quedado sin la
hoja. Y la 368 y la 373 leían el CSS en `carta.css`: apuntadas a la hoja
nueva.

**Ficheros**: `css/carta-holo.css` (**nuevo**), `css/carta.css`,
`css/mi-coleccion.css`, `js/mi-coleccion.js`, `carta.html`,
`cartas.html`, `coleccion.html`, `mi-coleccion.html`. En `pruebas`:
`test-tanda-392.mjs`, `test-tanda-368.mjs`, `test-tanda-373.mjs`.

**En curso / pendiente**: PINGU sigue viendo la ficha «pocha» al lado de
Dex. Queda una pasada de forma —ritmo, jerarquía y aire— que no es
reordenar datos sino vestirlos. Y la tanda B (Stack/Split Variants).
## 2026-10-01 — PINGU-Claude (tanda 394 — el día del torneo: mesas, check-in y jueces)

**Hecho**: cuatro peticiones de PINGU para los torneos.

1. **«4/7 mesas terminadas»** en la barra viva (para todo el mundo) y
   junto al título de las mesas. Se actualiza solo con el tiempo real. El
   bye no cuenta como mesa.
2. **«Sin check-in»**, lo primero de la pestaña Jueces: quién falta en la
   ronda en juego (mesa, rival, TCG Live) con «Dar de baja» a dos toques.
   La baja la da siempre una persona; la mesa sigue cayendo sola con el
   barredor. La pestaña lleva un número rojo con lo pendiente.
3. **Fuera el recuadro dorado** de los arquetipos sin catalogar (queda
   solo en el texto de ayuda).
4. **«Ver lista» abre una ventana** en vez de desplegarse bajo la
   clasificación, donde no se veía.

**Lo que salió al hacerlo**: un juez aprobado NO podía escribir nada del
torneo (las políticas piden `torneos_mando`). Su «Resolver…» no hacía nada
y decía «Mesa resuelta» desde la tanda 207. Arreglado con dos funciones,
sin abrir tablas: `torneos_dar_de_baja` y `torneos_resolver_como_juez`.

**SQL a ejecutar**: `supabase-migration-torneos-jueces.sql` (**nuevo**).
Probada contra PostgreSQL 16 (`sql-jueces.sql`). Sin ella, al juez se le
dice qué falta y el organizador sigue pudiendo dar de baja.

**Ficheros**: `js/torneos/mesas.js` y
`supabase-migration-torneos-jueces.sql` (**nuevos**),
`js/torneos/ronda.js`, `js/torneos/jueces.js`, `js/torneos/torneo.js`,
`torneo.html`, `css/torneos.css`, `SCHEMA.md`. En `pruebas`:
`test-tanda-394.mjs`, `sql-jueces.sql` y `rigor-tanda-394.py`
(**nuevos**), el doble (las dos funciones) y `correr-suite.sh`.

**Suite**: entera en verde (133 pruebas) y rigor 17 de 17. La 384 (el
laboratorio) salió roja UNA vez con la suite cargada: esperaba 150 ms
fijos tras un Escape. Ahora espera a que el estado cambie.

**En curso / pendiente**: nada a medias. Se escribió como 391, pero la
391 (la Pokédex) y la 392 llegaron antes al remoto; integrada desde el
bundle pasó a ser la 393, y mientras se empujaba llegó la 393 (la
ficha): queda como la **394**, con `test-tanda-391.mjs` y
`rigor-tanda-391.py` renombrados al 394 — el choque de números de la
384/385, dos veces en la misma tanda.
## 2026-10-01 — PINGU-Claude (tanda 393 — la ficha, con la carta de protagonista)

**Hecho**: PINGU, al ver la 392: «el pop-up es muy pocho, se abre en una
esquina y es horrible; debería verse la carta en grande porque es la
protagonista, y después las otras cosas igual que Dex, con los mismos
datos».

Tenía razón: era una ventana de 560 px con el escaneo a 96, o sea la
carta era lo único que NO se veía. Y se pegaba a una esquina porque un
`<dialog>` sin `margin: auto` se queda arriba a la izquierda.

Ahora son dos columnas, 1.040 px y centrada: la carta ocupa su columna
entera a la izquierda (380 px, con `object-fit: contain`, que a una carta
no se le recorta un borde), y a la derecha se lee en orden — de dónde es,
cómo se llama, las chapas de TU copia, el precio con sus dos enlaces, los
campos para editarla y, al final, **la tabla de datos**: tipo, energía,
rareza, número, ilustrador, salida y número nacional.

Esa tabla no es adorno, y es lo que dijo PINGU: «son datos muy
importantes para luego utilizar los filtros». Verlos aquí es lo que
enseña por qué se va a poder filtrar. Tres columnas nuevas en la consulta
(`illustrator`, `types`, `dex_ids`) — de la misma petición, ni una más.

**Lo que no se sabe no se pinta**: una fila con una raya ocupa lo mismo
que el dato y además miente sobre lo que el catálogo tiene. Y el número
nacional solo sale si la carta es de UNA especie: una TAG TEAM lleva dos
y «25, 133» no es un número de Pokédex, es una lista.

El alto va topado con desplazamiento dentro: sin eso, una ficha larga en
un portátil dejaba los botones de guardar fuera de la pantalla.

**Tres pruebas se mudaron, no se borraron**: la 369 (Cardmarket), la 375
(el precio prestado del reverso) y la 376 miraban esos datos en la
CASILLA, y desde la 392 viven en la ficha. Comprueban lo mismo; lo que
cambió es dónde mirar.

**Ficheros**: `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/mi-coleccion.js`, `js/mi-coleccion/datos.js`. En `pruebas`:
`test-tanda-392.mjs`, `test-tanda-369.mjs`, `test-tanda-375.mjs`,
`test-tanda-376.mjs`.

**En curso / pendiente**: la tanda B (Stack/Split Variants y las tres
barras de la cabecera del set).

## 2026-10-01 — PINGU-Claude (tanda 392 — la colección enseña la CARTA)

**Hecho**: la «tanda A» de lo que pidió PINGU viendo la app de Dex: «me
gusta más cómo lo hacen ellos porque es solo la imagen, y cuando le
clicas te sale un pop-up con toda la información».

La casilla llevaba nombre, set, cuatro chips, el precio con su nota y dos
botones. Con trescientas cartas eso no es una colección, es una hoja de
cálculo con fotos, y el escaneo —lo único que de verdad reconoces de un
vistazo— quedaba del tamaño de un sello. Ahora encima solo va lo que la
ilustración NO dice: la cantidad (si hay más de una) y la variante (si no
es la normal). Rejilla más apretada, sin marco: la carta ya trae el suyo.

**La ficha en pop-up no hizo falta escribirla**: el diálogo de la 369 ya
tenía la foto grande, el nombre, el set, el precio, Cardmarket y los
campos. Estaba escondido tras un botón «Editar» en cada fila — lo mismo
que pedía PINGU, pero sin que nadie lo encontrara. Ahora se abre pulsando
la carta, y se le añadió la salida a la ficha ENTERA, que sigue siendo
una página (es la que indexa Google y la que se comparte).

**Un fallo que salió al hacerlo**: al quitar el texto de debajo, una
carta sin escaneo dejaba el botón en CERO píxeles — invisible y sin poder
pulsarse, o sea una carta perdida. Pasa de verdad: la cadena de respaldo
acaba escondiendo la imagen cuando ninguna CDN contesta (tanda 321). El
hueco se reserva ahora en el propio botón con `aspect-ratio`, y dentro va
el nombre.

**Ficheros**: `js/mi-coleccion.js`, `css/mi-coleccion.css`,
`mi-coleccion.html`. En `pruebas`: `test-tanda-392.mjs` (**nuevo**) y
`correr-suite.sh`.

**En curso / pendiente**: la tanda B (Stack/Split Variants y las tres
barras de la cabecera del set). Y del plan largo: filtros en panel
lateral, cabecera de la Pokédex, carpetas, intercambios por objetivo.

## 2026-10-01 — PINGU-Claude (tanda 391 — la Pokédex no había rellenado NI UNA carta)

**Hecho**: PINGU: «la Pokédex dice que está vacío el catálogo; entro en
Bulbasaur y no hay nada». Y no era la pantalla.

`cartas-pokedex.mjs` guardaba el `dex_ids` con un **upsert parcial** de
PostgREST (`POST tcg_cards?on_conflict=id,market` con solo `{id, market,
dex_ids}`). PostgREST lo traduce a `INSERT … ON CONFLICT DO UPDATE` y
**el INSERT se evalúa primero**, así que reventaba contra los NOT NULL de
`set_id`, `local_id` y `name`. Reproducido contra Postgres 16:

    null value in column "set_id" of relation "tcg_cards"
    violates not-null constraint

O sea: fallaba cada diez minutos desde la tanda 381, en silencio, y la
columna seguía a null en las 23.000 cartas. **Un UPSERT no es un UPDATE
con otro nombre** — `cartas-detalle.mjs`, que sí funciona, usa PATCH.

Un PATCH por carta serían 500 peticiones por pasada, así que el lote
entero se va de una a `pokedex_marcar`, que hace un solo `UPDATE … FROM`
y respeta el centinela `{}`.

Barridas las otras dos upserts del repo (`top-del-mes`,
`lanzamiento-push`): esas sí mandan la fila completa.

**Lo del gráfico del valor NO es un fallo**: necesita DOS fotos para
dibujar una línea, y con una sola dice «la primera foto se toma esta
noche» a propósito. Con un punto la línea sería plana y diría «no ha
cambiado nada», que no es lo mismo que «todavía no se sabe» (la regla de
la 319).

**SQL a ejecutar**: `supabase-migration-pokedex-marcar.sql` (**nuevo**).
Hasta que no esté, la Pokédex sigue vacía. Pendientes de antes:
`rangos-intercambios`, `torneos-xp` (otra vez, por el grant) y
`xp-atomico`.

**Ficheros**: `supabase-migration-pokedex-marcar.sql` (**nuevo**),
`netlify/functions/cartas-pokedex.mjs`. En `pruebas`:
`test-tanda-391.mjs` (**nuevo**) y `correr-suite.sh`.

## 2026-10-01 — PINGU-Claude (tanda 390 — la columna del autor, más limpia)

**Hecho**: PINGU, con una captura del foro: «puede que se vea muy
cargado». Eran cuatro pastillas apiladas del mismo tamaño y ninguna
ganaba. Tres recortes:

1. **«Miembro del equipo» y «Moderación» fuera.** Desde la 386 el NOMBRE
   ya sale en ámbar o violeta según el rango, con su `title`: la chapa
   decía lo mismo otra vez y en una línea entera. Es la señal vieja que
   se quedó puesta al llegar la nueva — la metí yo y no la quité.
2. **«Abrió el tema» se va a la cabecera del mensaje.** No es un dato de
   la persona, es del HILO, y estaba en la columna de identidad mezclado
   con cosas que esa persona lleva a todos sus mensajes. Y va callada
   (`--text-mid` sobre `--bg`): el ámbar de `.foro-chapa` al lado de la
   fecha gritaba más que el mensaje.
3. **Nivel y colaborador en UNA línea**, no apilados en columna.

**Ficheros**: `js/tema.js`, `css/foro.css`.

**OJO, no verificado a ojo**: el doble no soporta
`.eq(...).maybeSingle()` —devuelve vacío—, así que `tema.html` siempre
dice «este tema no existe» y NO hay forma de pintar la columna del autor
en local. Por eso tampoco existe ninguna prueba que la cubra. Verdes la
299, 313, 314 y 386, pero esto hay que mirarlo en producción. Si alguien
arregla el doble, lo primero que merece prueba es esta columna.

## 2026-10-01 — PINGU-Claude (tanda 389 — fuera la chapa de nivel del hilo de actividad)

**Hecho**: PINGU la vio en producción y la quitó: «antes se veía más
limpio». Tenía razón, y por el MISMO motivo por el que en la 387 dije que
el nombre no se tiñe por nivel: casi todo el mundo es Novato, así que era
una pastilla gris idéntica en cada fila. Y el caso que enseñó es el peor
posible — las filas de «se ha unido a PokeDoc» son Novato POR DEFINICIÓN,
o sea una marca que no puede decir nada nuevo nunca. Apliqué el argumento
al color y se me olvidó aplicarlo a la chapa.

El nombre sigue con el color de su rango, que son tres valores y no se
repite en cada línea.

**Ficheros**: `js/activity.js`. En `pruebas`: `test-tanda-387.mjs` (la
sección 4 ahora vigila lo contrario: que el hilo vaya limpio).

**En curso / pendiente**: lo de antes. Desarrollo parado a petición de
PINGU para ahorrar tokens.

## 2026-10-01 — PINGU-Claude (tanda 388 — que el XP llegue de verdad)

**Hecho**: repaso de la 387 recién subida. Cuatro agujeros, y los cuatro
de la misma familia: algo contestaba «bien» sin haber hecho nada.

1. **El `revoke` de la 387 dejaba la función sin poder ejecutarse.** Una
   función nace con EXECUTE para PUBLIC, así que `service_role` lo tenía
   POR SER public: revocarle a public se lo quitaba también a él
   (medido: `service_role t` antes, `f` después). El barredor habría
   recibido «permission denied», la fase se habría ido al catch y **no se
   habría repartido XP nunca**, con el registro diciendo que todo bien.
2. **`addXP` perdía el premio que caía en medio.** Leer-sumar-escribir:
   entre la lectura y la escritura cabe otro premio. Reproducido con dos
   conexiones a Postgres: **105 donde tocaba 255**. Ahora la suma pasa
   dentro de la base en una frase, y el id dejó de ser parámetro (se lo
   suma a `auth.uid()`).
3. **«No hubo error» no es «sumó».** El doble contesta a una función que
   no conoce sin error y sin datos, así que `addXP` daba el premio por
   dado. Y era real: `xp_sumar` devolvía null si el update no encontraba
   fila. Arreglado por los DOS lados.
4. **El podio solo se congelaba si el organizador volvía a abrir la
   ficha** (viene de la 217; la 387 lo heredó sin verlo). El organizador
   termina el torneo desde la vista de rondas y no tiene por qué volver:
   sin podio sellado, ni palmarés, ni anuncio en el foro, ni XP. Ahora se
   sella al terminar, donde el podio ya está calculado, y
   `sellarResultado` se queda como red.

Para hacer sitio en la portada saqué `.community-guide-row` de
`components.css` a `css/comunidad.css`. Dos trampas esquivadas por haber
picado antes: **solo sus nueve reglas y no la sección** (ahí estaban
`simple-card`, `star-picker` y `wall-empty`, que baja todo el mundo — la
316), y **el `@media` se fue con su base** (la 299).

**SQL a ejecutar**: `supabase-migration-xp-atomico.sql` (**nuevo**) y la
versión corregida de `supabase-migration-torneos-xp.sql` — **si ya
ejecutaste la de ayer, vuelve a pasarla**: le falta el `grant execute …
to service_role` y sin él el XP de torneos no se reparte. Las dos son
idempotentes (`create or replace`), así que pasarlas dos veces no rompe
nada. Sigue pendiente `supabase-migration-rangos-intercambios.sql`.

**Ficheros**: `supabase-migration-xp-atomico.sql` (**nuevo**),
`supabase-migration-torneos-xp.sql`, `js/gamification.js`,
`js/torneos/ronda.js`, `css/components.css`, `css/comunidad.css`,
`SCHEMA.md`. En `pruebas`: `test-tanda-388.mjs` (**nuevo**) y
`correr-suite.sh`.

**En curso / pendiente**: el puente del camino viejo en `addXP` (quitar
cuando la migración lleve un tiempo). Sigue sin hacerse: celebrar el XP
de un torneo («+150 XP» en el aviso del final), y el tablón de
intercambios sin chapa de nivel. Y CUÁNTO XP vale cada cosa lo sigue
diciendo el cliente: cerrarlo es mover cada premio al servidor, tanda
grande.

## 2026-10-01 — PINGU-Claude (tanda 387 — el XP de los torneos, y el nivel junto al nombre)

**Hecho**: PINGU preguntó si teñir los nombres por nivel además de por
rango. Lo analicé y **dije que no**, con los números delante: los cinco
colores de las chapas dan entre 2,14 y 3,33 de contraste sobre blanco
(la WCAG pide 4,5) porque la chapa NO los usa como letra —los oscurece un
45% hacia `#12303f`—; la mayoría de la gente es Novato, así que la
mayoría de los nombres saldrían grises y el recién llegado se llevaría el
más pálido; el azul del Coleccionista es el azul del enlace; y el nivel
YA se ve, con su palabra, pegado al nombre. El nombre se queda diciendo
el rango y solo el rango.

Lo que sí se hizo, que es lo que PINGU quería de fondo:

1. **XP recurrente por torneos.** El agujero era raro: los torneos SÍ
   daban XP, pero solo al desbloquear un hito, así que tu primer torneo
   daba 30 y **el undécimo cero**. Ahora 30 por jugar, +40 por podio y
   +80 más por ganar. Lo reparte el servidor, no el cliente: `addXP` lee
   y suma, y la ficha se refresca cada diez segundos.
2. **Idempotente por construcción**, no por cuidado: cada premio deja su
   fila con la pareja (torneo, persona) como clave y el XP se suma solo
   por lo que el INSERT mete de nuevo. Y el nivel se recalcula en el
   MISMO update que el XP: si no, alguien se queda con 4.000 puntos y la
   chapa de Novato sin que nada dé error.
3. **La chapa de nivel en el hilo de actividad**, que era el hueco. En
   los paneles del lateral del foro NO se ha metido: son listas de hasta
   cuarenta nombres con comas y una chapa por nombre las destroza.
4. La fase del barredor va **antes** del `return` temprano de
   `procesar()` — detrás se saltaría la mayoría de los minutos sin dar
   error— y la prueba lo vigila por la forma: cada contador tiene que
   salir en todos los returns posteriores a donde se incrementa.

**SQL a ejecutar**: `supabase-migration-torneos-xp.sql` (**nuevo**).
Aplicada y probada contra un PostgreSQL 16 de verdad. Sin ella el
barredor aparca esa fase y avisa por consola, sin llevarse por delante el
barrido de relojes. Sigue pendiente de antes
`supabase-migration-rangos-intercambios.sql`.

**Ficheros**: `supabase-migration-torneos-xp.sql` (**nuevo**),
`netlify/functions/torneos-barredor.mjs`, `js/activity.js`, `SCHEMA.md`.
En `pruebas`: `test-tanda-387.mjs` (**nuevo**) y `correr-suite.sh`.

**En curso / pendiente**: el XP de un torneo **no se celebra** — el aviso
del final lo manda una fase que corre antes del reparto, y el confeti
vive en el cliente. Se ve en el perfil y en la chapa, pero no hay
«+150 XP» por ningún sitio. Candidato a tanda propia: mover el reparto
por delante del aviso. Y el tablón de intercambios sigue sin chapa de
nivel porque sus nombres salen de una función de la base: haría falta
ampliarla otra vez.

## 2026-10-01 — PINGU-Claude (tanda 386 — el color de un nombre según su rango)

**Hecho**: lo que pidió PINGU con la captura del lateral del foro
delante. Los nicks con enlace al perfil salen con el color de su rango:
ámbar el admin, violeta el moderador, azul de enlace todo el mundo. Un
solo módulo decide (`js/rangos.js`) y trece ficheros lo usan.

Tres cosas que costaron aprender:

1. **El color NO puede ir en una hoja.** La primera versión lo puso en
   `components.css` y los nombres del foro salieron AZULES: `.foro-gente
   a` empata en especificidad y `foro.css` carga después. Ahora el color
   va en el `style=` del enlace, con el token dentro. Y **dos atributos
   `style` en la misma etiqueta no se suman** —gana el primero—, así que
   `atributosDeRango(perfil, estiloBase)` los mezcla en uno.
2. **La consulta que no pide `is_admin, is_moderator` pinta a todo el
   mundo en azul sin dar error.** Dieciséis consultas ampliadas. La
   prueba barre TODO `js/` —no solo los ficheros que pintan: la cabecera
   de un mensaje privado tiene la consulta en `js/messages.js` y el
   enlace en `js/mensajes.js`, y la primera versión del barrido se lo
   comió— y la excepción es un comentario `// sin rango:` pegado a la
   consulta, no una lista en la prueba. Son once, casi todas porque ese
   nombre sale como texto y no como enlace.
3. **La portada estaba a 168,5 de 170**, así que primero hice sitio (es
   lo que manda CLAUDE.md) y luego miré si cabía: el módulo pasó de 2,5
   a 1,3 KB gzip mudando el porqué largo a SCHEMA.md, y salieron de
   `components.css` la 404, las páginas legales y las encuestas y la
   cabecera de tema. Quedan **1,2 KB** de sitio.

**SQL a ejecutar**: `supabase-migration-rangos-intercambios.sql`
(**nuevo**). Amplía las tres funciones de intercambios con
`is_admin`/`is_moderator`, porque los nombres del tablón salen de ellas
y no de un `select`. Lleva `drop function` antes de cada una a la
fuerza: Postgres no deja cambiar las columnas de salida con un `create
or replace`. La web funciona igual sin ejecutarla (sin las columnas no
se pinta ningún rango), así que no corre prisa.

**Ficheros**: `js/rangos.js` (**nuevo**), `css/404.css` (**nuevo**),
`css/legal.css` (**nuevo**), `css/style.css`, `css/components.css`,
`css/foro.css`, `js/foro.js`, `js/foro-comun.js`, `js/usuarios.js`,
`js/activity.js`, `js/guia.js`, `js/guide-card.js`, `js/guide-forum.js`,
`js/guide-rating.js`, `js/guide-suggestions.js`, `js/home.js`,
`js/hovercard.js`, `js/peticiones.js`, `js/torneos/torneo.js`,
`js/menciones.js`, `js/messages.js`, `js/mensajes.js`, `js/perfil.js`,
`js/usuario.js`, `js/carta-mercado.js`, `js/mi-coleccion/tablon.js`,
`404.html`, `torneo.html`, `terminos.html`,
`privacidad.html`, `sobre.html`, `SCHEMA.md`. Y un comentario de una
línea (`// sin rango:`, el que exige la prueba) en `js/app.js`,
`js/auth.js`, `js/onboarding.js`, `js/wall.js`,
`js/mencion-autocompletar.js`, `js/mi-coleccion.js`,
`js/mi-coleccion/datos.js`, `js/torneos/jueces.js`,
`js/torneos/torneos.js`, `supabase-migration-cursos-juego.sql` y
**`js/constructor.js`** — este último es de
IBAI (tanda 384, ya publicada y sin nada marcado en curso), y lo tocado
es solo ese comentario: ni una línea de código. En `pruebas`: `test-tanda-386.mjs`
(**nuevo**) y `correr-suite.sh`.

**En curso / pendiente**: nada a medias. Los nombres que salen como
TEXTO y no como enlace se quedan sin color a propósito (los dos llevan
su comentario). Si algún día se quiere un rango más, es una línea en
`ESCALA` y su par de tokens en `style.css`. Sigue pendiente de antes:
quitar el puente de `torneos_inscribirse` de 3 parámetros y el de la
columna `cambio` en `js/mi-coleccion/datos.js`.

## 2026-10-01 — PINGU-Claude (tanda 385 — la ficha de una carta)

**Hecho**: la última de las cuatro. Dos cosas:

1. **Las versiones se calculaban en DOS sitios y ya discrepaban**: la
   ficha suponía normal + reverse cuando no se sabía y el bolsillo del
   álbum solo normal. Lo curioso es que las dos tenían razón para lo
   suyo —marcar es AFIRMAR, guardar desde la ficha es DESCRIBIR lo que
   tienes en la mano—, así que ahora `variantesDeCarta` PIDE el
   respaldo en vez de traerlo puesto. Un valor por defecto habría
   enterrado la diferencia otra vez.
2. **Enlace de una carta a su Pokédex** («Todas las cartas de Pikachu»),
   con `?dex=25` para entrar directo. Solo si la carta tiene UNA
   especie: una TAG TEAM tiene dos y un enlace que elige por ti manda a
   medio sitio.

**Ficheros**: `js/carta-mercado.js`, `js/mi-coleccion/variantes.js`,
`js/mi-coleccion.js`, `SCHEMA.md`. En `pruebas`:
`test-tanda-385.mjs` (**nuevo**).

**En curso / pendiente**: las cuatro cosas de la lista están hechas.
PINGU aclaró que la app que le gusta es **dextcg.com** y yo no la puedo
ver (el proxy la bloquea): si pasa capturas, se ajusta.

Los SQL de la 380 y la 381 ya están ejecutados, así que el repaso del
catálogo (logos, símbolos, cuentas y las ~1.200 imágenes) y el relleno
de la Pokédex van solos.
## 2026-09-30 16:15 — PINGU-Claude (tanda 384 — el laboratorio de pruebas del constructor)

**Hecho**: PINGU pidió un laboratorio en el constructor: una partida de
verdad con manos de prueba y cartas que funcionan, y un interruptor con
la tabla de probabilidades de robar cada carta en cada momento (la
referencia era el «Test draw» de TCG Dexter). Sustituye a la «mano de
prueba» de la 354. Se abre con **Probar**, desde Herramientas, desde
cada lista de /meta y con `?lab=1`.

Mulligan, activo y banca, turnos con sus reglas (una energía, un
partidario, sin evolucionar en el primer turno…), evoluciones y Caramelo
Raro, retirada, estadios, herramientas, ataques con daño y debilidad,
premios, deshacer y un maniquí de rival al que quitarle premios. 122
entrenadores, 44 habilidades, 63 ataques y 15 energías especiales hacen
lo que dicen; lo que no, se juega a mano y lo avisa. De las 322 cartas
más jugadas del meta, el único entrenador que queda a mano es
Transformation Tome.

La tabla calcula con lo que sabe el JUGADOR, no el motor (que sabe el
orden del mazo y los premios): lo que has visto al buscar, lo que has
colocado arriba o abajo, los premios cogidos. Exacto, y validado contra
Monte Carlo. Detalle entero en SCHEMA.md.

**Lo que costó encontrar**: de las 318 cartas más jugadas, **176 tienen
el ESPAÑOL en `name`** —la reparación de la 335 no ha llegado a todas—.
Buscar los efectos por el inglés dejaba media mesa muerta sin dar error.
`js/constructor/nombres.js` las casa (sacada de la base, no de memoria),
y las reglas que miran el nombre (ex, Mega = 3 premios, Tera, «de N»,
qué evoluciona de qué) pasan todas por la clave canónica.

**Ficheros**: `constructor.html`, `js/constructor.js`,
`js/constructor/datos.js` (`detallesDeJuego`), `js/constructor/nucleo.js`
(fuera `robarMano`, que era la mano de prueba), `js/meta/nucleo.js` y
`js/meta-mazo.js` (el enlace desde /meta), `SCHEMA.md`, y **nuevos**
`js/constructor/partida.js`, `js/constructor/efectos.js`,
`js/constructor/nombres.js`, `js/constructor/laboratorio.js` y
`css/laboratorio.css`. En `pruebas`: `test-tanda-384.mjs` y
`cartas-laboratorio.json` (**nuevos**), `rigor/rigor-tanda-384.py`
(**nuevo**), y la suite la incluye.

**En curso / pendiente**: cuando la reparación de nombres de la 335
acabe, `nombres.js` sobra (no estorba mientras tanto). Una carta nueva
del meta sin efecto se juega a mano: para automatizarla, su texto va en
`efectos.js` y, si es un ataque, con su firma. No toca la portada.

**Suite**: entera en verde salvo `test-tanda-331.mjs`, que está en
rojo TAMBIÉN sin mis cambios (lo he pasado contra la 380, la 381 y la
383): la ficha de una carta le pide `en` a TCGdex donde la prueba espera
que no pida nada. No lo he tocado — para quien lleve la ficha. Y tres
cosas del entorno, no del código: `sql-chats.sql`, `sql-dueno.sql` y
`sql-organizadores.sql` viven en la RAÍZ de `pruebas` y la receta del
README no los copia (294 y 295 salen rojas por eso), y la 321 necesita
un PNG en `/tmp/pk887.png` que no está en ninguna parte.

---

## 2026-10-01 — PINGU-Claude (tanda 383 — cada versión por su lado)

**Hecho**: lo tercero de la lista. Una carta existe en normal, reverse
holo, holo o primera edición, y ahora se marcan por separado en el
bolsillo del álbum. No hubo que pedirle nada a nadie: TCGdex lo trae en
`card.variants` y el curador ya lo guardaba desde la 330 — estaba ahí
sin usar, como el logo de la 380.

Se enseñan **las que existen de esa carta**, no las cuatro siempre:
ofrecer «1.ª edición» en una de 2024 invita a apuntar algo que no se ha
impreso nunca. Y sin datos (carta sin engordar) se enseña una sola, que
es lo que hacía antes.

**El progreso del álbum NO cambia**: un bolsillo lo llena cualquier
versión, así que «40 de 198» sigue contando cartas. Las versiones son
otra pregunta.

**Nota**: PINGU aclaró que la app que le gusta es **dextcg.com**, no el
catálogo TCGdex — yo estaba hablando de otra cosa. No la puedo ver (el
proxy me la bloquea), así que sigo por la lista de cuatro cosas que
eligió, que es lo que hay.

**Ficheros**: `js/mi-coleccion.js`, `js/mi-coleccion/datos.js`
(`variants` en las consultas), `css/mi-coleccion.css`, `SCHEMA.md`, y
**nuevo** `js/mi-coleccion/variantes.js`. En `pruebas`:
`test-tanda-383.mjs` (**nuevo**).

**En curso / pendiente**: queda una de las cuatro, la ficha de una
carta. Y las dos migraciones sin ejecutar (`curado-completo` y
`pokedex`).

---

## 2026-10-01 — PINGU-Claude (tanda 382 — filtros dentro de una colección)

**Hecho**: lo segundo de las cuatro cosas de TCGdex. Dentro del álbum
abierto, dos desplegables: rareza y categoría. Las opciones salen de las
cartas que hay DE VERDAD en esa colección (una rareza nueva aparece
sola), el progreso NO cambia al filtrar —«llevas 3 de 18» es de la
colección entera— y al filtrar se vuelve a la página 1, que si no el
archivador se queda en blanco sin dar error.

Si la colección todavía no tiene rareza ni categoría guardadas (el
engorde no ha llegado), los dos desplegables se esconden en vez de
ofrecer una opción que no hace nada.

**Y de camino, un fallo mío de la 381**: la barra de progreso de la
Pokédex escribía `--i` y la hoja lee `--ancho`. Se pintaba SIEMPRE al
0 %, o sea que los 1.025 Pokémon parecían vacíos. La prueba nueva barre
TODAS las barras del sitio, no solo esa.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`js/mi-coleccion/datos.js` (`category` en `cartasDeSet`),
`js/mi-coleccion/pokedex.js`, `css/mi-coleccion.css`, `SCHEMA.md`. En
`pruebas`: `test-tanda-382.mjs` (**nuevo**).

**En curso / pendiente**: de las cuatro cosas de TCGdex quedan dos: la
ficha de una carta y cómo se marca lo que tienes (las variantes por
separado, que es lo que hace TCGdex y lo que más cambia el modelo).

---

## 2026-10-01 — PINGU-Claude (tanda 381 — la Pokédex de Mi colección)

**Hecho**: lo primero de las cuatro cosas que PINGU quiere de la app de
TCGdex. Pestaña «Pokédex» en /mi-coleccion: los 1.025 Pokémon con su
sprite y tu progreso («1 de 3»), buscador, «solo los que tengo», y al
pulsar uno salen TODAS sus cartas de todas las colecciones con las
tuyas marcadas.

**La especie sale del NOMBRE y no cuesta ni una petición.** Pedírsela a
TCGdex serían ~21.000 peticiones y dos días; `dexesDeNombre` ya la saca
y lleva desde la 231 moviendo los minisprites y los arquetipos. La
función que rellena la columna NO SALE A INTERNET: lee y escribe en
nuestra base, así que va por lotes de 500 y se acaba en unas pasadas.

**Lo que hizo falta añadir**: `dexesDeNombre` daba solo la primera
especie de una TAG TEAM —«Pikachu & Zekrom-GX» se quedaba en Pikachu,
porque `aplastar` se come el guion y «zekromgx» no es nada—. Y la regla
que lo arregla no puede partir por el guion sin más: **Ho-Oh y
Porygon-Z se llaman así**. Se prueba la palabra entera primero.

`dexesDeNombre` **no se ha tocado**: de ella cuelga cómo se agrupan los
mazos en /mis-partidas y en el meta.

**Y la pantalla funciona sin esperar al catálogo**: mientras `dex_ids`
se rellena, tus cartas se sacan del nombre. Una pantalla en blanco
esperando a una tarea de fondo es una pantalla rota.

**Ficheros**: `mi-coleccion.html`, `js/mi-coleccion.js`,
`js/mi-coleccion/datos.js`, `css/mi-coleccion.css`, `SCHEMA.md`, y
**nuevos**: `js/pokedex-especies.js`, `js/mi-coleccion/pokedex.js`,
`netlify/functions/cartas-pokedex.mjs` y
`supabase-migration-pokedex.sql`. En `pruebas`: `test-tanda-381.mjs`
(**nuevo**) y el doble, que ahora calcula `pokedex_resumen` del
catálogo.

**PENDIENTE DE PINGU**: ejecutar `supabase-migration-pokedex.sql`. Hasta
entonces la pestaña enseña lo tuyo y dice que el catálogo se está
repasando.

**En curso / pendiente**: de las cuatro cosas de TCGdex quedan tres —la
vista de una colección, la ficha de una carta y cómo se marca lo que
tienes—.

---

## 2026-10-01 — PINGU-Claude (tanda 380 — el curador se queda con todo)

**Hecho**: PINGU: «hay un montón de colecciones sin logo —Shining
Legends, la Shiny Vault, todas las Trainer Gallery, la 30th
Celebration— y la Classic Collection no trae ninguna carta».

Tres síntomas, UNA causa: `cartas-detalle` ya se descarga el SET
COMPLETO y la CARTA COMPLETA —las peticiones caras— y se quedaba con una
parte. El logo venía en esa respuesta desde el primer día. **Arreglarlo
no cuesta ni una petición más.**

Y lo de la Classic Collection «sin cartas» no era eso: sus 30 cartas
están en la base, lo que faltaba era el NÚMERO (`card_count_official` a
0) y la estantería mide con `official || total || 0`. O sea «0 de 0».

**Lo que costó encontrar**: la imagen de una carta se guarda DESDE LA
348. El código lleva dos meses escrito y correcto, pero solo corre
cuando el engorde visita la carta, y el engorde solo mira las que tienen
`detalle_at` a null. Las ~1.200 engordadas antes de la 348 ya llevaban
su marca. **Dos meses de código bueno aplicado a cero filas.**

De ahí `curado_v`: una VERSIÓN del curador. Cuando aprende a guardar un
campo nuevo, el número sube y cada fila vieja se revisita UNA vez —
tenga o no tenga el campo. No se puede preguntar «¿le falta el logo?»
porque hay sets cuyo logo TCGdex no tiene, y eso se volvería a pedir
para siempre: es el cerrojo de la 333, que dejó el engorde sin arrancar.

**Si algún día este curador aprende a guardar otra cosa, hay que subir
`VERSION_CURADO`.** Por eso vive junto a `faltaVisitar`.

**Ficheros**: `netlify/lib/carta-detalle.mjs`,
`netlify/functions/cartas-detalle.mjs`, `js/carta-detalle.js` (un
comentario), `SCHEMA.md`, y **nuevo**
`supabase-migration-curado-completo.sql`. En `pruebas`:
`test-tanda-380.mjs` (**nuevo**) y `test-tanda-343.mjs`, que miraba las
columnas por su POSICIÓN y se ponía roja al añadir una — ahora comprueba
la regla (cada escalón, prefijo estricto del anterior).

**PENDIENTE DE PINGU**: ejecutar `supabase-migration-curado-completo.sql`.
Después, el repaso va solo: los 220 sets en menos de una hora (logos y
cuentas) y las ~1.200 cartas en unas tres.

**En curso / pendiente**: PINGU quiere rehacer «Mi colección» con cuatro
cosas de la app de TCGdex —la Pokédex por especie, la vista de una
colección, la ficha de una carta y cómo se marca lo que tienes—. Eso es
lo siguiente y es grande.

---

## 2026-09-30 (noche) — PINGU-Claude (tanda 379 — el cero de relleno)

**Hecho**: las cartas sin escaneo de TCGdex tiran de Limitless desde la
370, y funcionaba A MEDIAS. Lo cazó PINGU mirando cartas a mano: «el
GG10 carga, pero el GG1 no». Limitless tiene DOS costumbres y solo
estaba una — el número a secas va con tres cifras (`70` → `070`), pero
el que lleva letras delante va SIN el cero de relleno (`GG01` → `GG1`,
`SV001` → `SV1`). Por eso fallaban justo `GG01`–`GG09` y se veían de
`GG10` en adelante: ese cero no es relleno.

Comprobado contra la CDN en DOS series (`CRZ_GG1` carga, `SHF_SV001` no
y `SHF_SV1` sí), que es lo que permite tratarlo como regla y no como
lista.

Y el tope del número pasa de 6 a 8: los promos de Espada y Escudo son
`SWSH177`, que son siete, y el 6 los tiraba a todos devolviendo `null`.
22 cartas que no llegaban ni a intentarlo.

**Antes de esto**, PINGU ejecutó unos `update` a mano rellenando el
`tcg_online_code` de los Black Star Promos y de las energías de SV, que
TCGdex dejó de dar en 2023: las cartas «sin salida» bajaron de 765 a 612.

**Ficheros**: `js/escaneo-carta.js`, `SCHEMA.md`. En `pruebas`:
`test-tanda-370.mjs` (casos medidos, no deducidos).

**En curso / pendiente**: las cuatro *Trainer Gallery* (120 cartas)
siguen sin imagen A PROPÓSITO. Lo obvio —darles el código del set
padre— **rompería el resolutor de decklists**: `setDeCodigo()` hace
`.limit(1)` sobre el código, así que dos sets con `BRS` harían que una
línea «BRS 15» resolviera al azar. Hay que deducir el padre en
`escaneo-carta.js`, no escribirlo en los datos.

Y ~250 cartas (McDonald's, Trainer Kits, POP…) no tienen arreglo por
aquí: nunca existieron en TCG Live.

---

## 2026-09-30 (después) — PINGU-Claude (limpieza: los SQL ya están puestos)

**Hecho**: PINGU ha ejecutado las tres migraciones (intercambios, valor
histórico y el código de torneo). Con `tournaments.join_code` YA TIRADA,
dos respaldos del puente de la 367 pasaban de ser redundantes a ser
IMPOSIBLES —escribían en una columna que no existe—, así que se van:

- `js/torneos/torneos.js`: el respaldo que, si fallaba el insert en
  `tournament_join_codes`, escribía en `tournaments.join_code`. Además de
  no poder funcionar, **pisaba el error de verdad con otro que no dice
  nada**.
- `js/torneos/torneo.js`: `leerCodigo()` se caía a `torneo.join_code`.
  Ahora devuelve '' a secas, que es lo correcto igual: mejor el campo
  vacío que un código que no sabemos si es el bueno.

**Se queda** el reintento de `torneos_inscribirse` con los tres
parámetros de antes: ese no apunta a nada tirado y protege del rato en
que PostgREST todavía tiene la caché de esquema fría después de una
migración. Ese sí, cuando lleve un tiempo.

Y las dos tablas nuevas entran en `REQUISITOS` de `js/schema-check.js`,
que es el sitio donde una migración sin ejecutar se anuncia sola en
/admin en vez de reventar más tarde con un mensaje de PostgREST en
inglés. `user_wants` y `user_collection_value`; la columna
`user_collection.cambio` no hace falta porque la cubre su puente.

**Ficheros**: `js/schema-check.js`, `js/torneos/torneos.js`,
`js/torneos/torneo.js`.

**En curso / pendiente**: la primera línea de la gráfica del valor sale
**mañana**: la función programada corre a las 4:07 y con un solo punto no
se pinta nada. Sigue pendiente el **SQL de las imágenes**.

---

## 2026-09-30 — PINGU-Claude (tandas 375 a 378 — el precio que no era, los INTERCAMBIOS, el valor en el tiempo y sitio en la portada)

**Hecho**: dos cosas, y la segunda es grande.

**La 375, el «Sin precio» que no era.** Lo cazó PINGU: «he añadido una
carta y me sale que no hay precio, pero debería haber». Eran TRES fallos
encadenados y los tres del mismo tipo — un hueco que se toma por una
respuesta:

1. Marcar una carta como «reverse holo» pedía los campos `-holo` de
   Cardmarket, que solo existen en las cartas que Cardmarket lista como
   producto aparte. En las demás están a null, así que **elegir la
   versión que tienes te quitaba el precio**. Ahora se cae al de la
   versión normal y SE DICE («de la normal»): un reverso vale eso como
   poco, pero suele valer más, y un número prestado que no se declara es
   peor que un hueco.
2. `precioDeLinea` daba por buena cualquier fila de `tcg_card_prices`,
   tuviera cifras o no. La función programada guarda fila para toda carta
   que mira, así que una fila VACÍA tapaba la consulta en vivo **para
   siempre**: existía la fila, luego no se preguntaba, luego nunca se
   llenaba. De ahí `tieneCifras()`, que era la pregunta que faltaba.
3. Un precio del que solo se sabe el `idProduct` pintaba «Desde — ·
   tendencia —». Dos rayas no son un precio.

**La 376, los INTERCAMBIOS.** Es la pieza donde le ganamos a HoloNook: su
propio tutorial dice «HoloNook no tiene chat: los cambios se hablan por
fuera» y te manda a X o a Instagram. Aquí el cambio se cierra DENTRO.

- Pestaña «Cambios» en /mi-coleccion: arriba **quién encaja contigo** (los
  recíprocos primero, con chapa y marco) y debajo las dos listas que lo
  alimentan. En ese orden a propósito: al revés la pantalla empieza por
  deberes.
- Lo que DAS es una columna en la línea (`cambio`), no una lista aparte:
  «de estas tres, doy dos». Se pone en «Editar» de cada carta.
- Lo que BUSCAS sí es tabla, con prioridad y con idioma opcional —`null`
  es «me da igual» y no es lo mismo que «en español».
- El botón de escribir deja el mensaje REDACTADO y sin enviar, en los
  mensajes de la casa.
- Y en la ficha de una carta, «3 personas la dan para cambiar». Sin
  cuenta también, que es el escaparate.

**La 377, el valor en el tiempo.** Era lo último de tu lista. Ahora hay
una foto diaria del valor de cada colección y una gráfica arriba del
resumen: «vale 150 €, +50 desde el 1 de sept». La toma una función
programada a las 4:07 de la madrugada, con UNA sentencia para todo el
mundo (una consulta por persona se comería los 30 s de Netlify). Y suma
igual que la página, con el mismo orden y con la caída del reverso de la
375 — si sumara distinto, la gráfica diría 400 y la cifra de arriba 380
y nadie sabría cuál creerse. Cuando quedan cartas sin precio, lo dice:
si no, el día que se curen 200 precios parecería que ha subido.

Y de paso salió un fallo de la 374: `/mi-coleccion?ver=resumen` por
ENLACE DIRECTO decía «Cuando añadas cartas» para siempre —la pestaña se
elige antes de que lleguen las líneas y `repintar()` no la repasaba—. No
se veía porque la prueba de la 374 pulsaba la pestaña, y para entonces
ya estaban. La comprobación nueva entra por la dirección.

**La 378, sitio en la portada.** CLAUDE.md lo tenía escrito: iba a 169,3
de 170 KB y la próxima tanda que la tocara tenía que empezar por hacer
sitio. **Ahora van 168,5 y caben 1,5.** Se mudaron a `css/editor-guia.css`
las 32 reglas de `components.css` que solo usa el editor de guías (la
pantalla de menor riesgo; en SCHEMA.md está la tabla de qué le queda a
cada página, para la próxima).

Y de paso salieron **tres huecos de meses** que ninguna prueba miraba:
`/admin` no cargaba `foro.css`, `editor-texto.css` ni `cartas-lista.css`
aunque pinta las tres; el editor de guías de admin no cargaba
`cartas-lista.css` y el de la raíz sí; y `.editor-desde-peticion` vivía
en `comunidad.css` cuando lo pinta el editor. Los tres se escapaban por
dos razones, y **las dos eran de la prueba**: barría solo las HTML de la
RAÍZ (admin/ no lo miraba nadie) y solo leía `class="…"`, no
`el.className = …`. Ahora son 37 páginas y las tres formas de poner una
clase. También `admin/js/admin.js` pedía `renderReferenceBlocksHtml` a
`block-editor.js` cuando vive en `bloques-lectura.js`: /admin se bajaba
el editor de bloques entero para nada.

**Ficheros**: `js/cardmarket.js`, `js/mi-coleccion/datos.js`,
`js/mi-coleccion.js`, `js/carta-mercado.js`, `js/mensajes.js`,
`mi-coleccion.html`, `css/mi-coleccion.css`, `css/carta.css`, `SCHEMA.md`,
y **nuevos**: `js/mi-coleccion/cambios.js`, `js/mi-coleccion/tablon.js` y
`supabase-migration-intercambios.sql`,
`supabase-migration-valor-historico.sql`,
`js/mi-coleccion/grafica-valor.js` y
`netlify/functions/valor-coleccion.mjs`. También `js/notifications.js`
(el tipo de aviso nuevo) y `css/carta.css`. En `pruebas`:
`test-tanda-375.mjs`, `test-tanda-376.mjs` y `test-tanda-377.mjs`
(**nuevos**), `test-tanda-299.mjs` (37 páginas y el extractor ampliado),
las cuatro de los álbumes (368 a 371) que se habían quedado escritas
contra el desplegable que quitó la 372, y el doble, que ahora CALCULA las
tres RPC del tablón de las tablas en vez de devolver una respuesta a
mano.

De la 378: `css/editor-guia.css` (**nuevo**), `css/components.css`,
`css/comunidad.css`, `editor-guia.html`, `admin/editor-guia.html`,
`admin/index.html` y `admin/js/admin.js`.

**PENDIENTE DE PINGU — tres SQL, y el orden importa**:

1. `supabase-migration-intercambios.sql`. Hasta que esté puesta, la
   pestaña «Cambios» dice qué falta y el resto de la colección funciona
   igual (hay un puente en `datos.js` para la columna `cambio`; quítalo
   cuando lleve un tiempo).
2. `supabase-migration-valor-historico.sql`. Hasta que esté, la gráfica
   dice «la primera foto se toma esta noche» y no molesta a nadie. La
   primera línea de verdad sale al SEGUNDO día: con un punto no hay
   gráfica.
3. `supabase-migration-torneos-codigo.sql`, que sigue esperando de la
   367 — y esa va **DESPUÉS del despliegue**, porque tira
   `tournaments.join_code`.

Las tres pasadas contra un PostgreSQL 16 de verdad antes de entregarlas.
Y el disparador del aviso probado con seis casos: solo salta al EMPEZAR a
dar una carta, un aviso por persona aunque tenga el deseo apuntado dos
veces (eso era un fallo y lo cazó la prueba), nadie se avisa a sí mismo,
y quien lo apaga en sus preferencias no recibe nada.

**En curso / pendiente**: la lista de PINGU queda **terminada**. Lo que
se me ocurre para seguir: que el tablón de cambios avise también por
correo (hoy solo campanita), y una página pública de intercambios que
Google pueda indexar —pero eso tiene la trampa de la 322, así que solo si
cada página dice algo que no diga la de al lado—. Sigue pendiente el
**SQL de las imágenes** que le pasé a PINGU.

---

## 2026-09-30 — PINGU-Claude (tanda 374 — el resumen: qué tienes, no cuánto)

**Hecho**: las cuatro cifras de arriba de «Mi colección» dicen CUÁNTO
tienes. Faltaba lo otro. Pestaña nueva con cuatro cajas, y las cuatro
salen de lo que ya estaba guardado — **ni una consulta más**.

- **Tus repetidas**: «tienes 4 · te sobran 3». Es la puerta a los
  intercambios — sin saber qué te sobra no hay nada que ofrecer — y es
  la pregunta que se hace cualquiera que abre una caja de repetidas. Se
  cuenta por CARTA y no por línea: tres copias en tres estados distintos
  son tres líneas y una sola carta repetida.
- **Lo más valioso**, por lo que vale UNA copia y no la línea entera.
  Diez cartas de un euro no son «lo más valioso que tienes», son diez
  cartas de un euro.
- **Por colección y por rareza**, contando cartas DISTINTAS. «Tengo 40 de
  Espada y Escudo» se entiende; «78 contando repetidas» no dice nada de
  la colección.

Y las cuatro cajas van de **dos en dos**, no «las que quepan»: con tres
columnas la cuarta se quedaba sola con media pantalla en blanco al lado.
El `minmax` lleva `min(100%, 420px)` porque un mínimo mayor que la
pantalla saca barra horizontal en el móvil.

Y de regalo, **la trampa de la 299 por tercera vez esta semana**: el
reparto por rareza necesitaba `rarezaEs`, que vivía en
`js/carta-nucleo.js` — el módulo que pinta la ficha ENTERA. El barrido
sigue los imports y no las llamadas, así que /mi-coleccion pasó a «usar»
seis clases de `carta.css`, una hoja que no carga. Las tablas se han ido
a `js/carta-traducciones.js`, que no sabe dibujar nada, y `carta-nucleo`
las reexporta para no tocar a quien ya las pedía. **Ojo al reexportar**:
un `export … from` NO trae el nombre al ámbito del fichero, y aquí
dentro se usan — hay que importar Y exportar.

**Ficheros**: `js/mi-coleccion.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`, `js/carta-nucleo.js`, `SCHEMA.md`, y
`js/carta-traducciones.js` (**nuevo**). En `pruebas`:
`test-tanda-374.mjs` (**nuevo**).

**En curso / pendiente**: de HoloNook queda lo grande, los
**intercambios** — y ahí les ganamos, porque su propio tutorial dice
«HoloNook no tiene chat: los cambios se hablan por fuera» y manda a X o
Instagram, mientras que nosotros tenemos foro y mensajes propios. Las
repetidas de esta tanda son justo el paso previo.

Y el **valor de la colección en el tiempo**, que es lo único de la lista
que necesita migración: hay que guardar una foto del valor cada día con
una función programada, porque hoy solo sabemos el de ahora.

Sigue pendiente de PINGU el **SQL de las imágenes**.

---

## 2026-09-30 — PINGU-Claude (tandas 372 y 373 — la estantería y el brillo por rareza)

PINGU: «tira con todo y todo lo que creas conveniente para mejorar este
apartado». Dos cosas más de HoloNook, las dos de las que se ven.

### 372 — la estantería

Para abrir un álbum había que elegir el set en un **`<select>` con 220
colecciones dentro**. Además de ser lo menos vistoso que hay, **escondía
lo único que engancha de coleccionar: cuánto llevas**. Ahora es una
rejilla con el logo de cada colección, «9 de 198 · 5 %» y su barra —de un
vistazo ves dónde te falta poco para completar, que es exactamente lo que
hace volver al día siguiente.

Dos estados en la misma pestaña, como en los álbumes soñados: la
estantería y el archivador abierto. Se parecen a propósito, son la misma
idea. Con buscador y filtro por serie, que las series salen de los sets
que hay y no de una lista a mano.

**Las tuyas van por PORCENTAJE, no por cuántas cartas tienes.** Lo que se
quiere ver arriba es lo que estás a punto de completar. Y el progreso
cuenta cartas DISTINTAS: un álbum se llena por bolsillos, y tres
Charizards llenan uno.

**El fallo que cazó la prueba**: `.mc-barra` nace con `flex: 1 1 200px`
porque vive en una FILA; dentro de una tarjeta en COLUMNA ese `flex-grow`
la estira a lo alto y, con el radio de píldora, la convierte en un óvalo
del tamaño de la tarjeta. Un hijo de flex hereda el eje del padre, no el
del sitio donde se escribió la regla.

### 373 — cada rareza, su brillo

La 368 le puso al escaneo un giro en 3D con UN destello, el mismo para
todas: una común relucía igual que una hiperrara. Para un coleccionista
eso no se perdona — **el brillo ES la rareza**.

Seis familias y no trece (una por rareza): lo que distingue una lámina de
otra en la mano es el PATRÓN —barras, polvo de estrellas, estallido,
arcoíris, purpurina dorada— y hay cuatro o cinco de verdad. Trece efectos
serían trece que mantener y ninguno reconocible.

- **Una común NO brilla.** `null` es una respuesta, no un olvido: darle
  un brillo suave sería mentir sobre lo que tienes en la mano.
- **La familia va en el HTML**, no la pone el JavaScript del giro: así la
  lleva también la página que pinta la función del borde.
- **Una rareza que no está en la tabla se adivina por palabras.** El
  catálogo lo mantiene gente; una rareza nueva que diga «Hyper» tiene que
  brillar desde el día uno, no cuando alguien se acuerde. Pero no se
  inventa: lo que no suena a nada, no brilla.

**Ficheros**: `js/mi-coleccion.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`, `js/carta-nucleo.js`, `css/carta.css`,
`SCHEMA.md`. En `pruebas`: `test-tanda-372.mjs` y `test-tanda-373.mjs`
(**nuevos**).

---

## 2026-09-30 — PINGU-Claude (tanda 371 — el archivador con cara de archivador)

**Hecho**: PINGU enseñó **holonook.es** (que mi contenedor no alcanza; lo
vi por capturas suyas) y pidió «mejora visualmente todo». De allí se trae
la ESTRUCTURA, no la piel: su pastel de cristal es suyo y calcarlo
rompería nuestra escala de color.

- **Tapa de archivador** en ocho colores, con **lomo y tres anillas**. El
  color sale de la escala de la web —un color de tapa suelto sería el
  primero de veinte— y se guarda en `localStorage`: es gusto de quien
  mira, no un dato de la colección, así que no hace falta migración. La
  pega, dicha: no viaja entre dispositivos. Si algún día tiene que
  viajar, es una columna en el perfil y el módulo no cambia.
- **Cabecera por hoja**: «PÁGINA 1 · 001 – 009». El rango sale de las
  cartas DE ESA HOJA y no de una cuenta: con «solo las que me faltan»
  puesto los números no son seguidos, y un rango deducido mentiría.
- **Las que faltan, como grabadas en la funda** en vez de en gris plano,
  con la sombra del plástico dentro; y las que tienes, con el brillo por
  encima. A las que faltan se les deja un pelín de color a propósito: es
  lo que permite ver de un vistazo si lo que te falta es un Charizard o
  un Squirtle.
- **«Ir a…» y los mandos arriba**: en un set de 200 cartas son 22
  pliegos, y tenerlos solo debajo obligaba a bajar la pantalla entera
  para pasar de página.

**Y lo de debajo, que es lo que evita que esto se pudra**: el archivador
estaba escrito DOS VECES —el álbum de una colección y los soñados—, cada
uno con su copia del «9 por página». Ya habían empezado a separarse, y de
eso se quejó PINGU en la 369 («en álbumes está perfecto, pero en álbumes
soñados debería ser igual»). Ahora lo monta
`js/mi-coleccion/archivador.js`. Lo que NO se comparte es cómo se pinta
un bolsillo, que sí es distinto en cada uno: se pasa como función.

**Ficheros**: `js/mi-coleccion/archivador.js` (**nuevo**),
`js/mi-coleccion.js`, `js/mi-coleccion/albumes.js`, `mi-coleccion.html`,
`css/mi-coleccion.css`, `SCHEMA.md`. En `pruebas`:
`test-tanda-371.mjs` (**nuevo**) y el doble, que ahora conoce
`user_albums`.

**En curso / pendiente**: sigue lo de antes —el precio cuando no hay en
el idioma que toca, y el SQL de las imágenes que tiene que pasar PINGU
para saber si la Classic Collection quedó arreglada—. Y de HoloNook
quedan apuntadas, por orden: el **muro de álbumes** (matar el
desplegable), el **brillo por rareza** (ellos tienen uno por cada una y
nosotros uno genérico; `rarity` ya viaja en las consultas), las
**repetidas calculadas solas** y los **intercambios**, donde les ganamos
porque ellos mandan a X o Instagram y nosotros tenemos mensajes propios.

---

## 2026-09-30 — PINGU-Claude (tanda 370 — las cartas que no salían con imagen)

**Hecho**: PINGU: «hay cartas antiguas que no salen y hay cartas del 30
aniversario que no tienen imágenes, sobre todo la Classic Collection; un
montón de cartas de la era de Sol y Luna que tampoco».

**No era nuestro ni del idioma.** `image_path` sale del listado de
TCGdex, que se pide en INGLÉS, y TCGdex sencillamente **no tiene escaneo
de esas cartas**: es un catálogo comunitario y los sets viejos están a
medias. En `js/cards-block.js` había escrito, negro sobre blanco, «el
catálogo es inglés y tiene escaneo de todas las cartas». Esa suposición
es lo que dejaba el hueco.

El segundo sitio es la **CDN de Limitless**, que va por CÓDIGO DE TCG
LIVE y número, o sea que no depende de que TCGdex conozca la carta. La
cadena ya existía para las decklists (tanda 366 de IBAI); lo que hace
esta tanda es llevarla a donde se mira: el catálogo, la ficha de una
carta, «Mi colección», los álbumes y las cartas dentro de una guía.

**Dos cosas que NO hace**, y las dos a propósito:

- **No pide a Limitless lo que ya tenemos.** Es el respaldo, no el primer
  sitio: cargarle trabajo a un tercero por gusto no.
- **No pone arte inglés en una carta japonesa.** Los ficheros de
  Limitless son `_R_EN_`. En una guía sobre cartas japonesas, enseñar la
  impresión inglesa estaría contando otra cosa: ahí la cadena se queda
  sin segundo sitio y punto.

**La lección de la 299, DOS veces en la misma tanda.** El barrido sigue
los IMPORTS, no las llamadas:

1. La tabla de promos vivía en `js/constructor/nucleo.js` — 26 KB de
   reglas de legalidad de mazos. Traérsela desde el catálogo se los
   llevaba puestos a /cartas y a /coleccion para montar una dirección.
2. Y la cadena vivió un rato en `js/carta-nucleo.js`, que pinta la ficha
   entera. En cuanto `cards-block.js` la importó de ahí, **/foro y el
   editor de guías «usaron» las clases de la ficha sin pintarlas nunca**
   y sin cargar su hoja. Lo cazó `test-tanda-299` a la primera.

De ahí `js/escaneo-carta.js`: lo que usa medio sitio tiene que vivir en
algo que no arrastre medio sitio.

**Y un efecto secundario que cazó `test-tanda-324`**: al ponerle a la
imagen un `onerror` que recorre la cadena, cuando la cadena se agota la
imagen SE QUITA. En una miniatura está bien (la caja ya tiene su estilo);
en la ficha dejaba el `figure` vacío y la columna se encogía de golpe. Ahí
el final de la cadena es el hueco de «Sin imagen», que es lo que había.

**Ficheros**: `js/escaneo-carta.js` (**nuevo**), `js/carta-nucleo.js`,
`js/cards-block.js`, `js/coleccion.js`, `js/cartas.js`, `js/tcgdex.js`,
`js/imagen-carta.js`, `js/constructor/nucleo.js`, `js/mi-coleccion.js`,
`js/mi-coleccion/albumes.js`, `js/mi-coleccion/datos.js`, `SCHEMA.md`. En
`pruebas`: `test-tanda-370.mjs` (**nuevo**) y `test-tanda-324.mjs`.

**Suite completa: 115 verdes y una roja**, que sigue siendo
`test-tanda-331` de la 365 de IBAI (el precio de Cardmarket pide la carta
también en inglés). Las 324 y 334 se han puesto al día: las dos MIDEN la
imagen de la ficha, y **ninguna de las dos había cargado nunca una de
verdad** —este entorno no alcanza la CDN—, así que se fiaban de que una
imagen rota siguiera en el DOM. Ahora se la sirven ellas.

**En curso / pendiente**:

- **PENDIENTE PARA PINGU**: pasar el SQL que le di (cuántas cartas sin
  imagen por set, y si ese set tiene código de TCG Live). Hace falta para
  saber si la **Classic Collection** se arregla con esto: si ese set no
  tiene `tcg_online_code`, el respaldo no puede saltar y habría que
  curárselo.
- Sigue sin empezar: **el precio cuando no hay en el idioma que toca**.
- Y sigue roja `test-tanda-331`, que es de la 365 de IBAI.

---

## 2026-09-30 — PINGU-Claude (tanda 369 — el archivador que se estiraba, el logo en la lista y la ventana de editar)

**Hecho**: tres cosas que pidió PINGU sobre «Mi colección».

**1. Los álbumes soñados NO eran otro diseño: eran el mismo estirado.**
`.mc-archivador` iba con `auto-fit`, y con **una sola hoja** esa hoja se
lleva todas las pistas y ocupa el ancho entero — los bolsillos salían al
doble de tamaño. En el álbum de un set casi siempre hay dos hojas y por
eso ahí nunca cantó; en los soñados, que tienen pocas cartas, pasaba
siempre. Ahora son dos columnas FIJAS en pantalla ancha y, si solo hay
una hoja, la otra cara va vacía en punteado — un archivador abierto tiene
dos caras. Es pariente de la lección de la 316: `auto-fit` decide por su
cuenta cuántas pistas hay, y eso está bien para una rejilla de tarjetas y
mal para algo que tiene que medir SIEMPRE lo mismo.

**2. El logo de Cardmarket, también en la lista.** Y de paso las dos
acciones de una carta dejan de ser dos enlaces de texto idénticos: una te
SACA de la web y la otra abre una ventana aquí dentro, así que ahora cada
una lleva delante lo que es.

**Esto obligó a sacar el CSS a `css/cardmarket.css`.** Estaba en
`carta.css`, y /mi-coleccion no la carga: el logo habría salido sin
estilo. Es la trampa de la 299 por segunda vez en dos tandas — la primera
me obligó a separar el DIBUJO (`js/cardmarket-marca.js`), esta a separar
su HOJA. La regla que queda escrita en la prueba no nombra páginas: quien
importe el dibujo tiene que cargar la hoja.

**3. La ventana de editar enseña la carta.** Ya era un `<dialog>`; lo que
le faltaba era decir de QUÉ carta hablas. Con dos impresiones de la misma
carta en la colección, la ventana decía el nombre y nada más y no había
forma de saber cuál estabas tocando hasta guardar. Ahora lleva el
escaneo, el nombre, la colección, el precio y el enlace a Cardmarket con
los filtros de esa línea.

**Ficheros**: `css/cardmarket.css` (**nuevo**), `css/carta.css`,
`css/mi-coleccion.css`, `js/mi-coleccion.js`, `js/mi-coleccion/albumes.js`,
`mi-coleccion.html`, `carta.html`, `SCHEMA.md`. En `pruebas`:
`test-tanda-369.mjs` (**nuevo**) y la 368, cuya comprobación de «no la
arrastra quien no la dibuja» ya no valía —ahora /mi-coleccion la dibuja a
propósito— y pasa a exigir que quien la dibuje cargue la hoja.

**En curso / pendiente**: lo que sigue sin empezar de la lista de PINGU:

- **El precio cuando no hay en el idioma que toca.**
- **Cartas sin imagen**: Classic Collection del 30 aniversario y bastante
  de la era Sol y Luna. Huele a `image_path` vacío en el catálogo, o sea
  arreglo de DATOS y no de pantalla.
- Y sigue roja `test-tanda-331`, que es de la 365 de IBAI.

---

## 2026-09-30 — PINGU-Claude (tanda 368 — el hueco de la portada, el mando del álbum, la carta en 3D y Cardmarket con su logo)

**Hecho**: cuatro cosas que pidió PINGU mirando la web en el PC.

**1. El hueco de la portada.** No era un hueco: era que el torneo y la
última noticia iban en una fila propia de dos columnas, y **una fila mide
lo que mida su caja MÁS ALTA** — el torneo es una tira de 76 px y la
noticia una tarjeta con foto de más de 300. Debajo del torneo quedaban
unos 250 px vacíos hasta «Ahora en el foro», y en el móvil no se veía
porque ahí van apiladas. La cura no es rellenar el hueco: es no tener
fila. Cada caja se ha ido a la columna del panel que ya existía (el
torneo a la ancha, la noticia a la lateral) y una columna flexible fluye
seguida. El orden del MÓVIL se repone con tres `order`, porque al mudar
las cajas el DOM las separa y la noticia se habría caído a media página.

**2. El mando de cada bolsillo del álbum.** Había un interruptor global
(«Tocar una carta la añade», tanda 365) que obligaba a elegir: con él
puesto no podías abrir la ficha de una carta, y sin él no podías añadir
ninguna sin irte a la ficha y volver. Fuera. Ahora cada bolsillo lleva su
**− N +** y el bolsillo entero sigue llevando a la ficha; por eso pasa a
ser un `div` con el enlace ENCIMA, que un `<button>` dentro de un `<a>`
no es HTML válido. El `−` quita de la línea MÁS NUEVA, que es la que
quiere deshacer quien acaba de pulsar `+`.

**3. El escaneo de la carta, en 3D.** Se inclina siguiendo al ratón con
una banda de color que barre por encima (`js/carta-holo.js`). Solo con
ratón —con el dedo, el primer toque ya es el que abre el visor— y apagado
con «menos movimiento», en el JavaScript Y en el CSS. Va sobre una caja
NUEVA dentro del `figure`: al `figure` no se le puede poner, porque va
`sticky` y una transformación deja el `sticky` sin efecto.

**4. Cardmarket con su logo.** La marca va DIBUJADA en SVG y no traída de
cardmarket.com: colgarla de su servidor es una petición a un tercero para
pintar un botón, y el día que no conteste el botón se queda mudo (la
lección de la 321). En oscuro el logo va sobre una chapa blanca; su azul
no se toca, que es su marca.

**La trampa que casi cae, y que es la de la 299**: la marca estaba dentro
de `js/cardmarket.js`, que importa TAMBIÉN /mi-coleccion para los idiomas
y los estados — y /mi-coleccion no carga `carta.css`. El barrido sigue
los IMPORTS, no las llamadas: una página «usa» una clase por importar el
módulo que la pinta, aunque no la pinte nunca. De ahí
`js/cardmarket-marca.js`, que solo importa quien la dibuja.

**Ficheros**: `index.html`, `css/portada.css`, `js/home.js`,
`js/mi-coleccion.js`, `mi-coleccion.html`, `css/mi-coleccion.css`,
`js/carta-holo.js` (**nuevo**), `js/carta-nucleo.js`, `js/carta.js`,
`css/carta.css`, `js/cardmarket-marca.js` (**nuevo**),
`js/cardmarket.js`, `js/carta-mercado.js`, `SCHEMA.md`. En `pruebas`: el
doble, que ahora conoce `user_collection`.

**Suite completa: 113 verdes y una roja, que NO es de esta tanda** — sigue
siendo `test-tanda-331`, de la 365 de IBAI (el precio de Cardmarket pide
la carta también en inglés y esa prueba dice «solo se pide el español»).

Cinco pruebas se han puesto al día porque hablaban de la fila que se fue
o de la escala: la **299**, la **300** y la **362** decían «la fila de
hoy» y ahora dicen lo mismo contra la columna; la **310** y la **311**
cazaron que mi CSS nuevo usaba duraciones (0,08 / 0,2 / 0,45) y
espaciados (6 y 10 px) fuera de la escala de la casa. Las dos tenían
razón: la web tiene DOS duraciones (0,15 para responder a un gesto, 0,3
para lo que entra o sale) y los pasos de espaciado son los seis de
siempre.

**En curso / pendiente**: de la lista que pasó PINGU quedan, y las dejo
apuntadas porque son suyas y no están empezadas:

- **El precio cuando no hay en el idioma que toca**: añadió una carta y
  salió sin precio.
- **Los álbumes, más visuales** (los soñados, de la 366).
- **Cartas sin imagen**: la Classic Collection del 30 aniversario y
  bastantes de la era Sol y Luna. Huele a `image_path` vacío en el
  catálogo, o sea arreglo de DATOS y no de pantalla.

---

## 2026-09-29 — PINGU-Claude (tanda 367 — «privado» pasa a ser «con código»)

**Hecho**: PINGU, al ver que el RSS de la 363 dejaba fuera los privados:
«los torneos privados sí deberían ser públicos y visibles, pero que te
puedas apuntar eso debería ir con el código o contraseña». Tenía razón, y
el fallo era de raíz y no del RSS.

Desde la 292, `is_private` quería decir **invisible**: la política
escondía la fila entera. Eso resolvía la entrada de rebote —sin poder
leer el id, no te inscribes— pero se llevaba por delante el escaparate.
Ahora hay una sola regla: **se VE como cualquier otro, se ENTRA con el
código**.

Lo importante no es la pantalla, es que **el candado se muda de sitio**:
de la política de LECTURA a la función de INSCRIPCIÓN. `torneos_inscribirse`
no comprobaba ningún código y no hacía falta, porque pide el `id` del
torneo y el id no se podía saber; en cuanto la fila es pública, sin la
comprobación nueva un torneo con código se entraría **sin código y sin dar
ningún error**.

Y el código se muda a su propia tabla (`tournament_join_codes`, cerrada a
`torneos_mando`), porque en cuanto una fila es pública **todas sus
columnas lo son**. No se esconde columna a columna: un `select *` de un
rol sin permiso sobre UNA columna falla la consulta entera y el cliente
pide `tournaments` con `*` — es la trampa que ya estaba razonada en la 292.

De paso, un fallo que salió al escribir la prueba: **inscribirse reventaba
con un `ReferenceError` justo antes del `recargar()`** (un `estado` que no
existía desde la 293). Se guardaba bien, pero no salía aviso y la ficha no
se enteraba hasta refrescar. Ninguna prueba PULSABA el botón.

Dónde se anuncia: la web y el RSS sí (el canal es el espejo de la web); la
pasada automática de Telegram no (es un aviso a todos de algo a lo que no
entra cualquiera); el botón de la ficha sí, que ahí lo decide una persona.

De paso, `test-tanda-327` cazó que la barra de arriba **pedía 1081 px y
el corte estaba en 1080**. Un píxel, y el síntoma no canta. A 1100.

**Ficheros**: `supabase-migration-torneos-codigo.sql` (**nuevo — falta
ejecutarlo**), `css/style.css`, `js/torneos/torneo.js`, `js/torneos/torneos.js`,
`js/schema-check.js`, `torneo.html`, `torneos.html`,
`netlify/functions/rss.mjs`, `netlify/functions/telegram-mandar.mjs`,
`netlify/functions/telegram-torneos.mjs`, `SCHEMA.md`. En la rama
`pruebas`: `test-tanda-367.mjs` (**nuevo**, sustituye a
`test-tanda-292.mjs`, que se borra), `test-tanda-363.mjs`, el doble y
`correr-suite.sh`.

**Suite completa sobre la rama YA CON las 364-366 de Ibai: 112 verdes y
UNA roja, que NO es de esta tanda** —

- **`test-tanda-331` (para la sesión de IBAI)**: la 365 (el precio de
  Cardmarket) pide la carta **también en inglés** a TCGdex, y esa prueba
  decía «solo se pide el español». No la toco: es vuestro código y
  vuestra decisión — o el inglés hace falta y la prueba se reescribe
  contando por qué, o sobra y se quita la petición. Los cuatro fallos son
  el mismo: `es,en` donde se esperaba `es`.
- De paso se han ajustado dos cuentas escritas a mano que la 366 dejó
  cortas: las páginas con pie pasan de 28 a **31** (`test-tanda-312` y
  `test-tanda-326`), con /meta, /mazo-meta y /mi-coleccion.

**En curso / pendiente**: nada a medias. Dos cosas para quien siga:

- **La migración se ejecuta DESPUÉS del despliegue**, no antes: borra
  `tournaments.join_code`. Los dos puentes del cliente aguantan el rato
  intermedio en los dos órdenes.
- Quedan **dos puentes temporales** que hay que quitar cuando lleve un
  tiempo: el reintento de `torneos_inscribirse` con tres parámetros (en
  `js/torneos/torneo.js`) y la RPC `torneos_entrar_con_codigo`, que ya no
  llama nadie.

---

## 2026-09-29 — IBAI-Claude (publica el remate de la 366 desde el equipo de Ibai)

**Hecho**: subir el remate de la 366 (la entrada de abajo):
`node --check` en verde y los números de la cadena comprobados contra
el orden de `LETRAS_DE_ENERGIA` (G R W L P F D M → MEE 9–16, SVE 1–8,
MEE 1–8). Y **restaurada mi entrada de la 366 de publicación**, que la
entrada del remate había pisado al escribirse sobre una copia vieja del
fichero — al añadir una entrada, sobre el fichero al día, que esto lo
escriben dos sesiones.

**Ficheros**: `js/imagen-carta.js`, `SCHEMA.md`, esta bitácora.

**En curso / pendiente**: las cuatro migraciones (meta, meta-fuentes,
mi-coleccion, albumes) y los tests de las 364-366, que siguen solo en
la sesión de claude.ai (la rama `pruebas` del repo va por la 363).

---

## 2026-09-29 — PINGU-Claude desde claude.ai (tanda 366, remate — las energías, cartas de verdad)

**Hecho**: PINGU vio que las energías de la 366 «no se reconocen como
energías»: eran dibujos nuestros. Ahora una básica se pinta SIEMPRE con
la carta real de su tipo y su número real, venga como venga la línea:
**MEE 9–16 (30 aniversario de Mega Evolución)** en la CDN de Limitless;
si no contesta, **SVE 1–8** en pokemontcg.io (otro servidor, regla de la
321); después MEE 1–8; y solo si no contesta nadie, el SVG propio. Las
URLs de las 18 imágenes se comprobaron una a una el 2026-09-29.

**Ficheros**: `js/imagen-carta.js`, `SCHEMA.md`. En `pruebas`:
`test-tanda-366.mjs` (las básicas son MEE 9–16; con Limitless caída,
SVE de pokemontcg.io; con todo caído, el SVG).

**En curso / pendiente**: lo de la entrada de abajo (migraciones).

---

## 2026-09-29 — IBAI-Claude (publica la tanda 366 desde el equipo de Ibai)

**Hecho**: subir a la rama el trabajo de la tanda 366 (la entrada de
abajo), que estaba en este equipo sin commitear. Revisado antes de
subir: los 13 JS nuevos/tocados pasan `node --check`, los 8 SVG de
energías están en `assets/energias/`, y las dos funciones programadas
nuevas llevan su horario declarado dentro (`meta-oficiales` cada 20
min, `meta-pokedoc` al minuto 17 de cada hora).

**Ficheros**: los de la entrada de la tanda 366 (abajo).

**En curso / pendiente**:
- Las CUATRO migraciones en el orden que dice la entrada de abajo
  (meta, meta-fuentes, mi-coleccion, albumes).
- Vigilar el registro de `meta-oficiales` tras el despliegue por si
  Cloudflare bloquea la lectura de limitlesstcg.com.
- Los tests de las tandas 364-366 siguen solo en la sesión de
  claude.ai; la rama `pruebas` del repo va por la 363.

---

## 2026-09-29 — PINGU-Claude desde claude.ai (tanda 366 — álbumes soñados, energías que se ven y el meta con oficiales y PokeDoc)

**Hecho** (tres pedidos de PINGU):
1. **Álbumes soñados** en /mi-coleccion: álbumes a tu gusto con las
   cartas que quieras (vacío, con tus cartas o con una colección entera),
   ordenables, con ✓ en lo que tienes, «solo las que me faltan», cuánto
   costaría completarlo y público por enlace.
2. **Las imágenes de las decklists de torneo ya no fallan**: las
   energías básicas se pintan con imágenes NUESTRAS (/assets/energias/,
   ocho SVG) sin esperar a nada, y el resto de cartas tiene cadena de
   respaldo (espejo → CDN de Limitless por set y número → caja con el
   nombre). Causa: TCGdex no tiene escaneo de ninguna básica
   (`src="null"`), los sets que el espejo no sabe cruzar no se pintaban y
   no había segundo origen.
3. **/meta cuenta ahora oficiales y PokeDoc**, con filtro «Todos ·
   Oficiales · Online · PokeDoc» y periodo de 90 días. Oficiales
   (regionales, internacionales, especiales y Mundial) leídos del HTML de
   limitlesstcg.com (no tiene API para ellos; robots.txt lo permite);
   PokeDoc desde nuestros torneos terminados y públicos, encajados en el
   arquetipo de Limitless. En la ficha, las listas oficiales van primero
   con su chapa y su enlace.

**Probado**: SQL en PGlite (álbumes: dueño, tope; meta: fuentes,
retención, filtros, que las listas de PokeDoc no ensucian la media); las
dos funciones nuevas contra HTML con la estructura real de Limitless y
contra torneos de PokeDoc (el privado no entra, un mazo en español cae en
su arquetipo); y en Chromium: álbumes (crear de tres formas, añadir,
mover, quitar, renombrar, público/privado), /meta con fuentes y la
decklist con CDN caída y levantada. Suite: 299, 305, 309-313, 315, 316,
320, 326, 328, 335, 340, 345, 359, sets-live, torneos-22/23, sprites,
decklist-idiomas, constructor y migraciones en verde.

**Ficheros**: `js/imagen-carta.js` (NUEVO), `assets/energias/*.svg`
(NUEVOS, 8), `js/mi-coleccion/albumes.js` (NUEVO),
`netlify/lib/limitless-oficial.mjs` (NUEVO), `netlify/lib/meta-pokedoc.mjs`
(NUEVO), `netlify/functions/meta-oficiales.mjs` (NUEVO),
`netlify/functions/meta-pokedoc.mjs` (NUEVO),
`supabase-migration-albumes.sql` (NUEVO),
`supabase-migration-meta-fuentes.sql` (NUEVO),
`js/torneos/cartas-decklist.js`, `css/torneos.css`, `js/meta.js`,
`js/meta-mazo.js`, `js/meta/nucleo.js`, `js/meta/datos.js`,
`js/meta/pintar.js`, `css/meta.css`, `meta.html`, `mazo-meta.html`,
`js/mi-coleccion.js`, `mi-coleccion.html`, `css/mi-coleccion.css`,
`SCHEMA.md`. En `pruebas`: `test-tanda-366.mjs`, `test-tanda-366-meta.mjs`
(NUEVOS), `test-tanda-364.mjs`, `test-tanda-365.mjs`, `meta-364-base.mjs`,
`correr-suite.sh`.

**En curso / pendiente**:
- **PENDIENTE PARA PINGU — ejecutar en este orden**:
  `supabase-migration-meta.sql` (si no está), `supabase-migration-meta-fuentes.sql`,
  `supabase-migration-mi-coleccion.sql` (si no está) y
  `supabase-migration-albumes.sql`.
- **Lo que no he podido comprobar desde aquí**: que Netlify pueda leer
  limitlesstcg.com (si Cloudflare bloquea la función, `meta-oficiales`
  lo dirá en su registro con el código de error) y que su HTML siga así:
  si cambia, la función devuelve «¿ha cambiado su HTML?», no basura.
- El listado de Limitless trae ~5 meses de oficiales en su primera
  página; más atrás haría falta paginar.

---

## 2026-09-29 — IBAI-Claude (publica la tanda 365 desde el equipo de Ibai)

**Hecho**: subir a la rama el trabajo de la tanda 365 (la entrada de
abajo), que estaba en este equipo sin commitear. Revisado antes de
subir: el diff sobre la 364 es solo aditivo (297 inserciones, 0
borrados; en las 31 páginas solo entra el enlace «Mi colección» en
barra y pie), los JS nuevos pasan `node --check` y la función
programada nueva lleva su horario declarado dentro
(`precios-coleccion.mjs`, cada 10 min).

**Ficheros**: los de la entrada de la tanda 365 (abajo).

**En curso / pendiente**:
- Ejecutar `supabase-migration-mi-coleccion.sql` (y la de la 364 si
  sigue sin ejecutar).
- Los tests de la 364 y la 365 siguen viviendo solo en la sesión de
  claude.ai; la rama `pruebas` del repo va por la 363.

---

## 2026-09-29 — PINGU-Claude desde claude.ai (tanda 365 — Mi colección y el precio de Cardmarket)

**Hecho**: PINGU pidió en Cartas un «Mi colección» (meter tus cartas, ver
el valor, enlace a Cardmarket, álbum virtual) y que el precio de
Cardmarket saliera en el idioma y estado de la carta, con el enlace a
Cardmarket ya filtrado.

- **/mi-coleccion**: Cartas (valor, filtros, editar línea con gradeo y
  valor propio), Álbum (archivador 3×3 por colección, «solo las que me
  faltan», «tocar una carta la añade») y Añadir. Privada por defecto,
  pública con un interruptor (`?u=<usuario>`).
- **Ficha de carta**: bloque «Precio y colección» con idioma, estado y
  versión que mandan a la vez sobre el enlace y sobre «Añadir».
- **El enlace de Cardmarket** va por `idProduct` con `language`,
  `minCondition` e `isReverseHolo`; comprobado en Cardmarket que redirige
  a la carta con los filtros puestos.
- **Lo que NO se puede**: el MÍNIMO exacto por idioma y estado. TCGdex
  solo trae el precio general (desde, tendencia, medias); el filtrado solo
  lo da la API de vendedor de Cardmarket. Se enseña el general con su
  nombre y el enlace lleva al mínimo de verdad. Se lo he dicho a PINGU y
  le he preguntado si CardZone tiene acceso a esa API.
- Función programada nueva `precios-coleccion` para no pedir precios en
  cada visita. Detalle en SCHEMA.md, tanda 365.
- Barra (Cartas → «Mi colección») y pie (Aprender) en las 31 páginas.
  Portada: **168,9 KB**.

**Probado**: SQL en PGlite (privada/pública, dueño inmutable, estados
válidos, `precios_pendientes` solo servicio); la función contra TCGdex
falso; y en Chromium contra esa base: ficha (precio, enlace por estado y
reverse, añadir y sumar copias), lista, buscador, editor, álbum (pliegos,
tocar para añadir, solo las que faltan, móvil), pública/privada y que con
precios guardados la página no pide nada a TCGdex. Suite: 299, 305,
309-313, 315, 316, 320, 324, 326, 340, 342 y constructor en verde. **La
326 estaba en rojo desde la 361** (contaba 27 pies): puesta a 31.

**Ficheros**: `mi-coleccion.html` (NUEVO), `js/mi-coleccion.js` (NUEVO),
`js/mi-coleccion/datos.js` (NUEVO), `js/cardmarket.js` (NUEVO),
`js/carta-mercado.js` (NUEVO), `css/mi-coleccion.css` (NUEVO),
`netlify/functions/precios-coleccion.mjs` (NUEVO),
`supabase-migration-mi-coleccion.sql` (NUEVO), `js/carta.js`,
`carta.html`, `css/carta.css`, las 31 páginas con barra/pie, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-365.mjs` y
`pruebas/coleccion-365-postgrest.mjs` (NUEVOS), `test-tanda-312.mjs`,
`test-tanda-326.mjs`, `herramientas/correr-suite.sh`, y los de la 364 que
IBAI no encontró (`test-tanda-364*.mjs`, `meta-364-*.mjs`, `servir.py`).

**En curso / pendiente**:
- **PENDIENTE PARA PINGU — ejecutar `supabase-migration-mi-coleccion.sql`**
  (y la de la 364 si sigue sin ejecutar).
- Si CardZone tiene API de Cardmarket: función para el mínimo exacto por
  idioma y estado con esas credenciales.
- Ideas: importar colección desde CSV, enlazar la colección pública desde
  el perfil, valor histórico.

---

## 2026-09-29 — IBAI-Claude (publica la tanda 364 desde el equipo de Ibai)

**Hecho**: subir a la rama el trabajo de la tanda 364 (la entrada de
abajo), que estaba hecho en este equipo pero sin commitear. El árbol
local ya incluía las tandas 361-363 que PINGU subió entre medias (solo
`colabora.html` difería, por el enlace nuevo del pie), así que va todo
en un commit sobre la 363. Sintaxis de los JS nuevos comprobada con
`node --check` antes de subir.

**Ficheros**: los de la entrada de la tanda 364 (abajo).

**En curso / pendiente**:
- **Los tests de la 364 NO están en la rama `pruebas`**: los ficheros
  que la entrada de abajo dice (`pruebas/test-tanda-364*.mjs`,
  `pruebas/meta-364-*.mjs`, `herramientas/servir.py`,
  `herramientas/correr-suite.sh`) no existen en este equipo — se
  quedaron en la sesión de claude.ai. PINGU: recuperarlos o rehacerlos
  antes de contar la 364 como cubierta.
- Sigue pendiente ejecutar `supabase-migration-meta.sql` (ver abajo).

---

## 2026-09-29 — PINGU-Claude desde claude.ai (tanda 364 — los mazos del meta, como en Limitless)

**Hecho**: PINGU pidió «lo de los mazos meta que tiene Limitless»: un
apartado con los mazos más usados para copiarlos y cogerlos de guía, y
que se puedan adjuntar guías a cada arquetipo.

- **/meta**: ranking de arquetipos de los torneos online de Estándar de
  Limitless (≥ 16 jugadores): % de uso con barra, tendencia contra el
  periodo anterior, % de victorias y tops. 7/14/30 días. «Other» va en
  una nota; los de menos de 30 mazos, tras «ver todos».
- **/meta/<arquetipo>**: cifras, «la mejor lista del periodo» (copiar
  para TCG Live / abrir en el constructor), guías vinculadas, lista media
  con imágenes (% y copias medias; opciones < 50 % plegadas) y las listas
  del top 8 desplegables con copiar, constructor, imagen y enlace a
  Limitless.
- **Guías**: el autor de una guía PUBLICADA la vincula desde la ficha
  (un admin, cualquiera). Quitar: quien la vinculó, el autor o un admin.
- **Los datos**: función programada nueva `meta-limitless` (cada 10 min)
  contra la API pública de Limitless, y todo el cálculo en SQL. La
  primera carga (60 días, ~1.000 torneos) tarda unas horas de pasadas;
  la ventana de 14 días se llena en la primera hora. No se guardan todas
  las listas (serían ~70 MB/mes): solo las del top 8; del resto, el
  recuento de cartas por día. Detalle en SCHEMA.md, tanda 364.
- Barra (Jugar → «Mazos del meta»), pie de las 30 páginas y sitemap
  (/meta y las fichas con muestra). Portada: **168,9 KB** (+0,3 por los
  enlaces de index.html).

**Probado**: SQL en PGlite (ingesta idempotente, ranking, lista media,
RLS de las guías: borrador, guía ajena, `added_by` fingido, anon sin
ingesta); la función contra un Limitless falso con la forma real de la
API (corte por tiempo, orden, filtros, última pasada de una página); y
las dos páginas en Chromium contra esa base (escritorio, móvil, oscuro,
vincular y quitar guía, texto de TCG Live, enlace al constructor con
nombre, noindex con poca muestra). Suite: 299, 305, 309-313, 315, 316,
320, 359 y constructor en verde; 312 actualizada a 30 páginas con pie.

**Ficheros**: `meta.html` (NUEVO), `mazo-meta.html` (NUEVO), `js/meta.js`
(NUEVO), `js/meta-mazo.js` (NUEVO), `js/meta/nucleo.js` (NUEVO),
`js/meta/datos.js` (NUEVO), `js/meta/pintar.js` (NUEVO), `css/meta.css`
(NUEVO), `netlify/functions/meta-limitless.mjs` (NUEVO),
`supabase-migration-meta.sql` (NUEVO), `js/constructor.js` (`&nombre=`),
`js/constructor/nucleo.js`, `js/torneos/sprites-pokemon.js` y
`js/torneos/cartas-decklist.js` (solo añaden `export`),
`netlify/functions/sitemap.mjs`, `netlify.toml`, las 30 páginas con
barra/pie (enlace «Mazos del meta»), `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-364.mjs`,
`pruebas/test-tanda-364-funcion.mjs`, `pruebas/meta-364-base.mjs`,
`pruebas/meta-364-datos.mjs` (NUEVOS), `pruebas/test-tanda-312.mjs`,
`herramientas/servir.py` (/meta/<id>) y `herramientas/correr-suite.sh`.

**En curso / pendiente**:
- **PENDIENTE PARA PINGU — ejecutar `supabase-migration-meta.sql`** en el
  SQL Editor. Hasta entonces /meta dice qué fichero falta y la función
  se salta la pasada con el mismo aviso.
- `colabora.html` sigue con la barra ANTIGUA (anterior a la 356): solo le
  he puesto el enlace en el pie. Habría que pasarle la barra nueva.
- Ideas: enlazar desde la guía a su mazo del meta, sumar los torneos de
  PokeDoc como segunda fuente, y un aviso cuando un mazo entre en el top.

---

## 2026-09-29 — PINGU-Claude (tanda 363 — los torneos entran en el RSS)

**Hecho**: PINGU quiere una cuenta de X para PokeDoc que publique sola
cada noticia, guía y torneo, y él retuitear. El canal RSS ya existía
—`/rss.xml`, tanda 271— pero llevaba SOLO artículos, así que justo lo que
más gente trae (un torneo abierto) se quedaba fuera de cualquier
automatización.

Ahora el canal mezcla artículos y torneos, ordenados por fecha de
publicación. Tres condiciones para que un torneo entre, y las tres
importan:

- **Inscripción abierta**: un borrador no existe y uno cerrado ya no
  admite a nadie.
- **Que no haya empezado**: anunciar el torneo de ayer es ruido.
- **Y NUNCA los privados.** Un torneo privado tiene código de acceso; su
  gracia es no anunciarse. Publicarlo en un canal abierto lo rompería
  **sin dar ningún error**.

La fecha de la entrada es `created_at` y no `start_at`: un lector ordena
por cuándo se publicó la novedad. Con `start_at`, un torneo creado hoy
para dentro de un mes se pondría por delante de todo.

Y la descripción del torneo NO es la suya (la escribe alguien con el
editor rico y trae HTML, que en un RSS se enseña en crudo): se compone
con lo que hace falta para decidir si te apuntas — cuándo se juega y
cuántas plazas.

**Ficheros**: `netlify/functions/rss.mjs`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-363.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**: lo de X no es código todavía. PINGU crea la
cuenta y prueba un puente RSS → X; si funciona, la siguiente tanda lo
hace nativo con el patrón de `telegram-noticias.mjs`. Y el aviso que le
di: **X entierra los mensajes con enlace externo**, así que el robot
sirve para no olvidarse de nada, no para tener alcance — el alcance lo
pone una persona citando el mensaje.

---

## 2026-09-29 — PINGU-Claude (tanda 362 — la portada, con lo que la gente usa de verdad)

**Hecho**: cuatro cambios en la portada, y dos salen directos de la
analítica.

**El titular vendía otra web.** Decía «guías, curiosidades y cursos», y
la analítica dice que **47 de las 55 personas que vuelven pasan por un
torneo** y que **436 visitas de gente sin cuenta** entran directas a la
ficha de uno. Ahora el titular menciona los torneos y el botón principal
es «Ver los torneos»; «Empezar a aprender» pasa a secundario y «¿Qué es
PokeDoc?» baja a enlace de texto.

**El sitio más caro lo ocupaba lo que menos se usa.** El reto diario
—**103 partidas en toda la historia de la web**— abría la portada a lo
ancho, y el próximo torneo estaba en la barra lateral como
acompañamiento. Cambiados. Y la tarjeta del torneo, que es horizontal,
queda mejor a lo ancho que encajada en la lateral.

**«Mensajes esta semana» se va del panel.** Con 105 mensajes en todo el
foro ese número iba a ser de un dígito muchas semanas, y un dato en vivo
bajo es prueba social EN CONTRA. En su lugar, las cartas del catálogo:
no puede bajar, y es lo único del panel que ninguna otra web española
tiene.

**Y las tres cartas del héroe son fotos de verdad**, del set más nuevo.
Los rectángulos de CSS se quedan como hueco reservado y respaldo: si la
consulta falla o la CDN no contesta, la portada se ve como antes y no se
mueve nada de sitio.

**Dos cosas del camino, las dos de las que ya avisaba CLAUDE.md**:

- **La primera versión se salió del presupuesto** (172,1 de 170 KB) por
  importar `carta-ruta.js` y `catalogo-series.js` para tres cadenas.
  Rehecho sin ellos: la dirección de las imágenes es una constante local
  vigilada por prueba (la norma de la 322) y el filtro de Pokémon TCG
  Pocket se resuelve pidiendo sets **con código de TCG Live**, que hace
  las dos cosas de una. Queda en **168,6 KB**.
- **Y un fallo de contraste mío**: el enlace «¿Qué es PokeDoc?» salió con
  `--ice`, que es el color del panel navy, sobre el fondo CLARO del
  héroe. Casi invisible. A `--text-mid` (la norma de la 311).

**Ficheros**: `index.html`, `js/home.js`, `css/portada.css`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-362.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**: nada bloqueante. La foto del héroe no se puede
comprobar de verdad desde aquí —el entorno bloquea `assets.tcgdex.net`—,
así que en las capturas va con una imagen de relleno; el camino de
respaldo (que se quite y quede el rectángulo) sí está probado.

---

## 2026-09-28 — IBAI-Claude (tanda 360 — revisión y subida de la 359)

**Hecho**: revisada, probada y subida la tanda 359 de claude.ai. El
código estaba limpio: no he tenido que tocar nada de la web.

**Probado en navegador con un usuario inscrito** (y dejado como test
permanente, `pruebas/test-tanda-359.mjs`): la pestaña Jugar enseña
«Usar un mazo del constructor», lista los mazos con nombre y cuenta,
el elegido se ESCRIBE en el editor sin entregarse (queda «Guardar
decklist»), la promo sale «SVP 92» y no «PR-SV 92», y la básica como
«Basic {R} Energy MEE 2». Y el constructor se abre VACÍO con el
borrador ofrecido en una línea: «Seguir con él» lo recupera entero.

**Medido**: la portada baja a **166,5 KB gzip** (−3,4 KB: style −3.686
por la mudanza de comentarios, app +203, index +47). El botón nuevo
pesa donde debe: torneo.js +1.168 y torneos.css +198, fuera de portada.

**La suite**: test-tanda-320 adaptado al cajón (cuenta enlaces sueltos
y summary, y abre un acordeón para ver que enseña lo suyo); 309 y 327
valían tal cual. El doble aprende `user_decks` (gancho `__FAKE_MAZOS__`),
que «Usar un mazo» y /mazos consultan. La 313 (reduced-motion del cajón
y de la flecha) y los táctiles (filas de 52) van cubiertos por sus
pruebas de siempre. Pasada completa lanzada: 30/110 en verde y ninguna
roja al empujar (los tests del constructor, barra, pie y la 359 nueva
pasados aparte en directo); si algo sale al terminar, va en la
siguiente entrada.

**Ficheros**: solo rama `pruebas` (test-tanda-359.mjs NUEVO,
test-tanda-320.mjs, stub-supabase.js, correr-suite.sh). La web va tal
cual la dejó la 359.

**En curso / pendiente**: siguen las migraciones de la 354 y la 358 por
ejecutar (mazos y energias-especiales), y el rigor de los tests nuevos
(355, constructor, 359).

---

## 2026-09-28 — PINGU-Claude desde claude.ai (tanda 359 — constructor vacío, mazo guardado en el torneo y menú del móvil)

**Hecho** (pedido de PINGU):
1. **/constructor se abre VACÍO.** El último mazo ya no se carga solo:
   se ofrece en una línea («Seguir con él») y sigue recuperable.
2. **«Usar un mazo del constructor» al entregar la decklist** de un
   torneo: lista tus mazos guardados y escribe el elegido en el editor
   (no entrega: se revisa y «Guardar decklist»). Texto con
   `textoParaTorneo` (nucleo.js): las promos van como SVP/SP… porque el
   motor no lee «PR-SV». Probado con los mazos reales de PINGU contra
   `parseDecklist`/`validateDecklist`: 60/60 y cero errores.
3. **El menú del móvil es un cajón lateral**: a toda altura desde la
   derecha, velo sobre la página, Inicio y Noticias sueltos y los cuatro
   apartados en acordeón (`<details name>`), el tuyo abierto; la
   hamburguesa se vuelve X; cierran Escape y tocar el velo.

**Portada**: se hizo sitio antes — los 14 comentarios más largos de
style.css se mudan a SCHEMA.md (tanda 359). Neto: **~−3,5 KB gzip**
(style −3.744, app +198, index +36; medido con gzip -9 sobre LF).

**Ficheros**: `js/constructor.js`, `js/constructor/nucleo.js`,
`js/torneos/torneo.js`, `css/torneos.css`, `css/style.css`, `js/app.js`,
las 27 páginas con barra (el HTML del menú del móvil y
`aria-expanded`/`aria-controls` en la hamburguesa), `SCHEMA.md`.

**En curso / pendiente**:
- **Suite**: el HTML del menú del móvil cambia (de `div` +
  `.nav-menu-titulo` a `details`/`summary`); las pruebas de la 358 que lo
  miren hay que adaptarlas. Revisar también 313 (la animación del cajón
  y la flecha tienen su `prefers-reduced-motion`) y los objetivos
  táctiles (filas de 52 y 44).
- Visto al probar: los mazos exportan el nombre que haya en `name`, que
  en algunas filas sigue en español mientras dura la reparación de la
  335 («Clefairy ex de Lylia»). El motor casa por colección y número; el
  export a TCG Live y los arquetipos, cuando acabe la reparación.

---

## 2026-09-28 — IBAI-Claude (tanda 358 — revisión y subida de las 354-357, y el tipo de las energías en origen)

**Hecho**: revisadas, probadas y subidas las tandas 354-357 de la sesión
de claude.ai. Y lo que la 357 dejó señalado, arreglado EN ORIGEN:

- **El «Básico» de las energías especiales no era cosa del engorde en
  español**: TCGdex da `energyType: "Normal"` para la Prisma, la
  Ignición y las «Energía X Burbujeante/Rocosa/…» de la era ME **también
  en inglés** (comprobado contra su API). Así que `carta-detalle.js` ya
  no se lo cree: el «Normal» de una energía solo vale si el NOMBRE es el
  de una básica (`esNombreDeEnergiaBasica`, con el Hada incluida — fue
  básica hasta 2020 y sigue en Expandido). `esEnergiaBasica` de la ficha
  decide igual, y el subtítulo de carta-nucleo.js también: la ficha de la
  Prisma decía «Energía básica» y siempre legal, y era mentira.
- **`supabase-migration-energias-especiales.sql` (NUEVA)** corrige las
  filas ya escritas. Probada contra un Postgres de verdad (pglite):
  idempotente, y NO toca un `Special` correcto — las «Darkness Energy»
  de la era Neo son especiales con nombre de básica y la regla del
  nombre las estropearía; solo se tocan filas que hoy digan «básica».
- **`decklist-imagen.js` (NUEVO)**: el dibujado a canvas sale de
  decklist-export.js, que pinta `.torneo-exportar` (torneos.css) — y el
  constructor lo importaba desde una página que no carga esa hoja. Lo
  cazó test-tanda-299. La API de los torneos no cambia (reexportado).
- Menores: igualdad estricta en el código nuevo de app.js, un comentario
  desactualizado en imagen.js (las plantillas son 1…20, no 1…40), y el
  Hada fuera del deduplicado del buscador (no tiene gemela en MEE).

**Medido**: la barra pide 1.075 px (corte en 1.080 ✓). Portada: 169,8 KB
gzip, la tanda 355+356 la BAJA 19 bytes netos (index +160, style −189,
app +10). OJO: pesar-portada sobre un checkout de Windows da 170,7
porque git materializa CRLF; producción sirve LF. De ahí también que
media suite de texto diera falsos rojos — este checkout queda
normalizado a LF con `core.autocrlf=false`.

**La suite** (montada entera en local: doble, servidor, Playwright):
- Adaptadas a la barra de la 356: test-tanda-252 (nav-jugar es
  desplegable), 269 (Noticias va primera, Inicio salió), 309 (la marca
  activa es el botón del grupo con `:has`; /foro marca «Comunidad»; el
  menú de usuario son SEIS opciones con «Mis mazos»), 320 (se cuentan
  botones de grupo y se comprueba que el desplegable ABRE).
- Adaptadas a la 353 (rutas de guía que quedaron viejas): 271 y 289.
- test-torneos-23: la caída de la CDN de sprites corta ahora la cadena
  de respaldo ENTERA (Limitless→jsDelivr→GitHub); cortar solo la primera
  en un entorno con red prueba el respaldo, no el fallo.
- El doble aprende `.or()` con `in.(…)`/`like` (comas de primer nivel) y
  `.not(col,'in','(a,b)')`, que el buscador del constructor usa.
- **Dos pruebas nuevas**: `test-tanda-355.mjs` (las funciones copiadas
  de huellas-limitless.js son idénticas a imagen.js, y huellas.bin se
  abre con el lector del navegador: 5.235 cartas) y
  `test-constructor.mjs` (añadir, tope de 4 por nombre entre versiones,
  la Prisma como especial, importar de TCG Live y básicas a mee-00X).
  En verde las dos; su rigor queda pendiente.
- **Pasada completa: las 109 en VERDE.** Por el camino cazó dos cosas de
  verdad, arregladas en el segundo push de esta tanda: los controles de
  formulario fiaban sus 44 px al relleno y con la letra de Windows se
  quedaban en 43 (`min-height: 44px` en la regla compartida de
  style.css, +60 bytes de portada → 169,9) y al recorte de una carta
  reconocida le faltaba `loading="lazy"` (constructor.js). Adaptados
  además los recuentos de pie (25→27 en 312 y 326), el corte del trozo
  de barra en 327 (el primer `</div>` ya no cierra la barra: hay
  desplegables anidados) y la energía básica de 335 lleva ahora su
  nombre (el campo solo ya no basta, y la Prisma se comprueba como
  fuera). Y tres portabilidades del entorno: encoding UTF-8 explícito en
  barrido-politicas.py (lectura y salida) y el sumidero de curl por
  sistema en test-tanda-321.

**Ficheros**: `js/carta-detalle.js`, `js/carta-nucleo.js`,
`js/constructor/nucleo.js`, `js/constructor/datos.js`,
`js/constructor.js`, `js/constructor/imagen.js`, `js/app.js`,
`js/torneos/decklist-imagen.js` (NUEVO),
`js/torneos/decklist-export.js`,
`supabase-migration-energias-especiales.sql` (NUEVA). En la rama
`pruebas`: el stub, correr-suite.sh, los siete tests adaptados y los dos
nuevos.

**En curso / pendiente**:
- **Ejecutar en el SQL Editor, en este orden**:
  1. `supabase-migration-mazos.sql` (sin ella no se guardan mazos),
  2. `supabase-migration-energias-especiales.sql`.
- Regenerar `assets/constructor/huellas.bin` cuando salga colección
  (instrucciones dentro de herramientas/huellas-limitless.js).
- El rigor de test-tanda-355 y test-constructor.
- PINGU: si pasas la suite en tu contenedor, los siete tests adaptados
  vienen ya en la rama `pruebas`.

---

## 2026-09-28 — PINGU-Claude desde claude.ai (tanda 357 — constructor: las energías)

**Hecho**: las energías básicas salían en el constructor como un hueco
con el nombre: **TCGdex no trae imagen de ninguna** (sve y mee tienen
`image_path` a null). Ahora se pintan con las del **30 aniversario**
—MEE 9 a 16, las del sello de Pikachu—, que están en la CDN de Limitless;
si no contesta, las MEE 1-8 normales, y si tampoco, el nombre (regla de
la 321). Es solo lo que se VE: la carta del mazo es la del espejo.

Y ordenado el resto de las energías, que estaba peor de lo que parecía:
- Una básica se lleva SIEMPRE a la `mee-00X` de su tipo, venga como venga
  («SVE 18», «MEE 10», «Energía Fuego»…): antes «SVE 2» y «SVE 18» eran
  dos filas del mismo Fuego.
- El buscador enseña solo esas ocho (antes, 336 filas de ocho dibujos),
  «Energía básica» son esas ocho en orden, y «Especial» ya no se fía de
  `energy_type` (ver abajo). `buscarCartas` devuelve `leidas` para que
  «Cargar más» pida bien la página siguiente aunque se filtren filas.

**Hallazgo en los DATOS (no arreglado aquí)**: en `tcg_cards`,
`energy_type` vale **«Básico» en energías ESPECIALES**: Prisma, Ignición,
Energía del Team Rocket (ASC) y las ocho de la era ME «Energía X
Creciente / Telepática / Rocosa / Burbujeante / Magnética / Nitro /
Voltaica / Sombría» (comprobado contra Limitless, que las da como Special
Energy). En el constructor se les quitaba el límite de 4 copias; ahora
`esEnergiaBasica` (nucleo.js) decide por el NOMBRE. **Pero
`esEnergiaBasica` de js/carta-detalle.js también se fía de ese campo**,
así que la ficha de esas cartas puede estar diciendo que son básicas /
siempre legales. Lo suyo es arreglarlo en origen (de dónde sale ese
«Básico» al engordar en español) y con una migración que las corrija; no
lo he tocado porque es vuestra función y vuestros datos.

**Ficheros**: `js/constructor.js`, `js/constructor/nucleo.js`,
`js/constructor/datos.js`.

**En curso / pendiente**: lo de `energy_type` de arriba; y la suite.

---

## 2026-09-28 — PINGU-Claude desde claude.ai (tanda 356 — la barra de arriba, en desplegables)

**Hecho**: la barra pasa de siete enlaces sueltos a cinco entradas:
**Noticias** · **Aprender ▾** (Guías y cursos, Reto de hoy, Guardados) ·
**Cartas ▾** (Catálogo, Lanzamientos) · **Comunidad ▾** (Foro, Gente) ·
**Jugar ▾** (Torneos, Constructor de mazos, Mis mazos, Mis partidas). Es la
misma organización que el pie. «Inicio» sale de la barra ancha (el logo
lleva a la portada) y sigue en el menú del móvil, que ahora va por
apartados con título y los enlaces a dos columnas, sin acordeones.
Desplegables: al pasar el ratón (CSS), con el tabulador
(`:has(:focus-visible)`) y al tocar (js/app.js, `aria-expanded`; Escape
o tocar fuera los cierran). El corte de la barra baja de 1.160 a
**1.080** (medido: pide 1.073). Y de paso, **arreglada la flecha de los
`select` en mosaico** del tema oscuro (lo que se veía en /cartas).

**Portada**: se hizo sitio antes — los comentarios largos de la barra
(style.css) y de `markActiveLink` (app.js) pasan a SCHEMA.md, tanda 356.
Neto de la tanda: **−54 bytes gzip** (index +156, style −198, app −12).

**Ficheros**: las 27 páginas con barra (todas menos auth, curso,
onboarding y reset-password), `css/style.css`, `js/app.js`, `SCHEMA.md`.

**En curso / pendiente**:
- **Pasar la suite entera**: cambia el HTML de la barra en 27 páginas.
  Las pruebas que busquen `a.nav-jugar` o cuenten los enlaces de
  `.nav-links` van a cantar — `.nav-jugar` es ahora el `div.nav-grupo`
  (y en el móvil `div.nav-menu-grupo`), sigue naciendo `hidden` y app.js
  la desvela igual. Mirar también objetivos táctiles (los botones del
  grupo miden 44) y contraste del título de apartado del móvil
  (`--text-mid`).
- `herramientas/medir-barra.mjs` (rama pruebas) debería dar ~1.073.

---

## 2026-09-28 — PINGU-Claude desde claude.ai (tanda 355 — constructor: pulido e importar desde imagen)

**Hecho**: tres cosas que pidió PINGU al probar la 354.

1. **El mazo ya no se mueve al añadir o quitar cartas.** En pantalla
   ancha los dos paneles son fijos a la altura de la ventana y cada uno
   tiene su scroll; el del mazo se conserva al repintar (se construye
   fuera y se cambia de una vez). Tres causas del «baile»: la lista de
   avisos encima del mazo crecía y encogía (ahora es un desplegable que
   abre el sello «N cosas por revisar»), la página entera bajaba con el
   mazo, y dentro de cada grupo se ordenaba por copias — pulsar «+»
   adelantaba la carta y el siguiente clic caía en otra. Para pintar va
   `seccionesDelMazo(…, { estable: true })` (orden de llegada dentro de
   grupos y líneas); el texto de TCG Live sigue ordenando por copias. La
   cabecera del panel se compactó (formato en línea, el conmutador
   Cartas/Lista junto a él) para que quepa más mazo.
2. **Fuera «Abrir en Limitless»** (exportar a su builder). Importar un
   enlace de Limitless sigue funcionando.
3. **Importar desde una IMAGEN de Limitless (ImgGen)**, como la extensión
   de navegador de PINGU: Herramientas → «Importar desde una imagen», o
   pegar con Ctrl+V en cualquier sitio de la página, o arrastrar. Se
   reconoce cada carta por su huella visual y el número del hexágono por
   plantillas; sale una fila por carta con su recorte para corregir la
   carta (desplegable con las parecidas) o las copias, y lo dudoso va en
   amarillo. Probado: una lista real de ImgGen, reescalada al 55 % y en
   JPEG al 60 %, sale 16/16 cartas y 16/16 números; con escaneos de
   TCGdex en vez de los de Limitless, 15/15 cartas.

Y **«Mis mazos» en el menú del usuario** (junto a «Mis partidas») y
«Jugar» se marca como activo en /constructor y /mazos. Es `js/app.js`,
que cuenta para la portada: **+23 bytes gzip** (medido), queda ~169,85.

**Ficheros**: `js/constructor/imagen.js` (NUEVO: reconocimiento, sin
imports ni HTML, se carga con `import()` solo al usarlo),
`herramientas/huellas-limitless.js` (NUEVO), `assets/constructor/huellas.bin`
(NUEVO, 2,9 MB), `constructor.html`, `css/constructor.css`,
`js/constructor.js`, `js/constructor/nucleo.js`, `js/app.js`.

**Lo que hay que saber de `huellas.bin`**:
- Es la base con la que se reconoce: 5.235 cartas (todo Estándar según
  Limitless + las colecciones SV ya rotadas, porque la gente sigue
  poniendo «Rare Candy SVI 191» y la imagen sale con ESE dibujo), 528
  bytes por carta (luz a 16×22 y color a la mitad), más las plantillas
  del contador 1–20 (ImgGen no pinta el hexágono con más de 20; entonces
  sale 1 y marcado como dudoso).
- **Se genera en la consola de limitlesstcg.com** con
  `herramientas/huellas-limitless.js` (las instrucciones están arriba del
  fichero): desde pokedoc.es no se puede, Limitless no deja pedir su
  lista de cartas ni su generador desde otro dominio. **Hay que
  regenerarlo cuando salga una colección**; mientras no, las cartas
  nuevas salen como dudosas (se corrigen a mano), no rompen nada.
- Las funciones `huella`, `compactar` y `detectar` están COPIADAS en la
  herramienta. Es una constante copiada (tanda 322): pide una prueba en
  `pruebas` que lea los dos ficheros como texto y compare esas tres.

**En curso / pendiente**:
- Sigue pendiente ejecutar `supabase-migration-mazos.sql` (tanda 354).
- Pasar la suite: app.js tocado (presupuesto y menú), el conmutador de
  vista cambió de sitio, el sello ahora es un `<button>`.
- En móvil (<900 px) el comportamiento es el de antes (pestañas Mazo /
  Buscar); los avisos también van en el desplegable.

---

## 2026-09-28 — PINGU-Claude desde claude.ai (tanda 354 — constructor de mazos)

**Hecho**: un constructor de mazos en `/constructor`, a imagen del de
my.limitlesstcg.com/builder pero en español y cruzado con nuestro espejo.
Buscador con filtros (categoría, subtipo, tipo, colección, «solo cartas
del formato»), mazo en rejilla o lista ordenado como los exports de TCG
Live (líneas evolutivas, partidarios → objetos → herramientas → estadios,
especiales antes que básicas), validación de Estándar/Expandido (60
cartas, 4 por nombre, un AS TÁCTICO, un Radiante, al menos un básico,
marcas legales CON la regla de la reimpresión), deshacer, mano de prueba
con premios, probabilidad de robar cada carta. Entra y sale por todas
partes: importa texto de TCG Live / Limitless / escrito a mano, enlaces
del builder de Limitless (`?i=`) y los nuestros (`?l=`); exporta a TCG
Live, abre el mazo en el builder de Limitless (formato del enlace sacado
a mano y comprobado: promos como `SP`/`SVP`) y descarga la imagen con
`descargarImagenDecklist`. Mazos guardados en `user_decks` (privados o
públicos por enlace `/constructor?mazo=<id>`), con página `/mazos`
(«Mis mazos»: duplicar, borrar). Sin sesión se puede montar todo; al
guardar manda a /auth.html y vuelve con el mazo en la URL. Borrador en
localStorage.

**Ficheros**: `constructor.html` (NUEVO), `mazos.html` (NUEVO, noindex),
`js/constructor.js` (NUEVO), `js/mazos.js` (NUEVO),
`js/constructor/nucleo.js` (NUEVO, puro: reglas, orden, formatos de
texto y enlaces), `js/constructor/datos.js` (NUEVO: consultas),
`css/constructor.css` (NUEVO), `supabase-migration-mazos.sql` (NUEVO),
`js/torneos/comun.js` (exporta `codigoLiveDeNombreDeSet`),
`torneos.html` (botón «Constructor de mazos»),
`netlify/functions/sitemap.mjs` (`/constructor`) y el enlace del pie en
todas las páginas con `pie-rejilla` **menos index.html**.

**PENDIENTE PARA PINGU — ejecutar `supabase-migration-mazos.sql`** en el
SQL Editor. Hasta entonces todo funciona salvo guardar, que avisa con un
mensaje que nombra el fichero (PGRST205 traducido). La migración se probó
en pglite: RLS (ver si es público o tuyo; crear/editar/borrar solo lo
tuyo), el dueño no se puede cambiar por UPDATE, tope de 300 mazos por
usuario, 60 entradas máx. en `cards`.

**Decisiones que conviene saber**:

- **Nombres (tanda 335)**: se enseña `name_es || name` con un
  `nombreVisible` propio en nucleo.js — es la regla de `nombreDeCarta`,
  copiada porque importar carta-nucleo.js (pinta HTML) haría que la
  página «usara» sus clases (prueba 299). Exportar a TCG Live/Limitless
  usa `name` (inglés). Las filas pasan por `canonizarCarta` al llegar y
  las marcas salen de `marcasLegales` de carta-legalidad.js.
- **Mientras dura la reparación de `name`** hay impresiones con el
  inglés y otras con el español en `name`/`name_key` (la promo de Boss's
  Orders vs. las «Órdenes de Jefes» modernas). Por eso: la clave de «4
  por nombre» es `name_es` cuando lo hay; la reimpresión legal se cruza
  por `name`, `name_key` Y `name_es`; y al resolver una línea por nombre
  se juntan las exactas de casa con las exactas en inglés de TCGdex (una
  petición, solo al importar sin código o buscar sin resultados). Cuando
  la reparación acabe, `name_key` bastaría — se puede simplificar.
- El pie de **index.html NO lleva el enlace**: la portada está a 169,8 de
  170 KB. Tampoco hay «Mis mazos» en el menú de usuario (vive en app.js,
  mismo presupuesto): se llega por /constructor. Si se libera algo de
  peso, son dos líneas.

**En curso / pendiente**:
- Pasar la suite de `pruebas`: hay dos páginas nuevas con pie (las
  pruebas que cuentan pies y enlaces las verán) y un CSS nuevo; revisar
  escala tipográfica/espaciado por si alguna prueba es más estricta que
  lo que he mirado a mano.
- Bug GLOBAL visto de paso (no tocado, es style.css y pesa en portada):
  en tema oscuro la regla de `select` pone la flecha con `background`
  sin `no-repeat` y se repite en mosaico si una hoja usa el atajo
  `background`. Pasa en /cartas. En constructor.css se esquiva con
  `background-color`.
- Ideas siguientes: botón «Abrir en el constructor» en las listas de
  /torneo, mazos públicos en el perfil, carrito de CardZone desde un mazo.

---

## 2026-09-28 — PINGU-Claude (tanda 361 — /colabora, para dejar de llevarlo todo solo)

**Hecho**: PINGU quiere delegar —gente que escriba noticias, que organice
torneos, que eche una mano con el foro—, todo voluntario y sin dinero.
Su idea era un formulario abierto del tipo «cuéntanos qué te gustaría
aportar».

**Se monta lo mismo pero con la lista delante.** «Aporta lo que quieras»
da dos respuestas: silencio, o «me gustaría ayudar en lo que sea», que no
se puede usar. La gente no sabe qué puede ofrecerte hasta que ve **lo que
hace falta y lo que cuesta cada cosa** — con la lista, el que encaja se
reconoce solo y el que no, no rellena.

**Y pide sesión a propósito.** Un Google Form te da un nombre; esto te da
un nombre CON SU HISTORIAL. En /admin cada solicitud sale con los
mensajes que esa persona ha escrito en el foro, los torneos que ha jugado
y cuánto lleva registrada. Eso es lo que hace falta para contestar.

**El formulario**: qué te gustaría llevar (los seis puestos), cuánto
tiempo al mes de verdad, qué has hecho antes, por qué PokeDoc, y **unas
líneas escritas ahí mismo** — que predice quién va a hacer el trabajo
mejor que las otras cuatro preguntas juntas.

Una solicitud viva por persona (índice único parcial), y el cliente lo
cuenta en vez de enseñar un error de índice. Aviso al equipo por
campanita **y por correo** el mismo día: una solicitud sin contestar una
semana es un voluntario perdido.

**Ficheros**: `colabora.html` (NUEVO), `js/colabora.js` (NUEVO),
`css/colabora.css` (NUEVO), `supabase-migration-colabora.sql` (NUEVO),
`admin/index.html`, `admin/js/admin.js`, `admin/css/admin.css`,
`js/email-plantilla.js`, `js/notifications.js`,
`netlify/functions/baja-correo.mjs`, el pie de las 26 páginas,
`SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-361.mjs` (NUEVO),
`herramientas/stub-supabase.js` (la tabla nueva) y
`herramientas/correr-suite.sh`.

**Añadido después**: `/colabora` entra en el sitemap (`ESTATICAS` de
`netlify/functions/sitemap.mjs`). Estaba enlazada desde el pie de las 28
páginas, así que Google podía llegar; ofrecerla explícitamente es una
línea y no cuesta nada.

**Ojo con la numeración**: esto se escribió como «tanda 354» y la otra
sesión ya había usado ese número para el constructor de mazos. Renumerada
a 361 al integrar. Con dos sesiones a la vez, el número se coge al SUBIR,
no al empezar.

**En curso / pendiente**: ejecutar `supabase-migration-colabora.sql`
—comprobada contra un PostgreSQL 16 de verdad, incluidas las políticas,
el índice de «una viva» y el disparador del aviso—. Y lo que NO es
código: los dos o tres primeros colaboradores se fichan por privado, uno
a uno; esta página es para el que llegue después.

---

## 2026-09-28 — PINGU-Claude (tanda 353 — las guías se mudan a /guia/<slug>)

**Hecho**: Search Console, el primer día con datos: **14 páginas
indexadas en TODO PokeDoc**, 20 clics en tres meses y todas las
búsquedas son la marca («pokedoc», «poke doc», incluso «pokedoku»). Ni
una guía indexada.

Mirando por qué, salió esto: **las guías eran la única sección del sitio
con dirección de parámetro** (`/guia.html?slug=…`). Las cartas tienen
`/carta/…`, las colecciones `/coleccion/…`, el foro `/tema/…`, los
perfiles `/usuario/…` y las noticias `/noticias/…` desde la tanda 269 —
las guías se quedaron a medias en aquella mudanza.

Google rastrea menos las direcciones con parámetros y a veces las agrupa
como duplicadas, y la palabra clave no está en la ruta, que es donde más
pesa.

**Y se hace AHORA por lo mismo que lo destapó**: con 14 páginas
indexadas, cambiar las direcciones no cuesta nada. Dentro de seis meses,
con las guías posicionadas, costaría semanas.

La vieja sigue llegando con un **301** (hay enlaces con `?slug=` en
correos ya enviados, en avisos guardados en la base y en dos
disparadores de SQL, y esos no se pueden reescribir). Cuidado con el
orden en `netlify.toml`: la regla de las noticias apunta a
`/guia.html?slug=…` y va ANTES del 301, o una noticia acabaría redirigida
a `/guia/<slug>`.

**Ficheros**: `js/articulos.js`, `netlify.toml`,
`netlify/edge-functions/meta-social.js`, `netlify/functions/sitemap.mjs`,
`netlify/functions/rss.mjs` y los 20 ficheros que enlazaban a la forma
vieja (`js/guia-tarjeta.js`, `js/guide-card.js`, `js/search.js`,
`js/curso.js`, `js/usuario.js`, `js/wall.js`, `js/peticiones.js`,
`admin/js/*`…), `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-353.mjs` (NUEVO),
`herramientas/servir.py` (la misma regla que netlify.toml) y
`herramientas/correr-suite.sh`.

**Dos cosas que saltaron al pasar las pruebas**, y las dos valen la pena
anotarlas:

- **La portada se salió del presupuesto** (170,3 de 170 KB) por los
  COMENTARIOS que le había puesto a `js/articulos.js`, que lo baja la
  portada. Recortados, y el porqué entero vive en SCHEMA.md, que no pesa.
  Queda en 169,8.
- **La prueba de la escala tipográfica (305) empezó a fallar por
  `js/email-plantilla.js`**, que se mudó a `js/` en la 350. Un correo NO
  es la web: un cliente de correo no soporta variables CSS ni hojas
  externas —el Outlook de Windows pinta con el motor de Word—, así que
  ahí los tamaños van a mano por obligación. Declarado como excepción en
  la prueba, con el motivo escrito.

**En curso / pendiente**: el `guid` del RSS es la dirección, así que los
lectores de feeds volverán a enseñar las guías una vez. Con la audiencia
de hoy es irrelevante, pero conviene saberlo. Y los dos disparadores de
SQL siguen encolando la forma vieja: funcionan por el 301, y se
cambiarán cuando toque otra migración de correos.

---

## 2026-09-24 — PINGU-Claude (tanda 352 — los premios de un torneo, fuera de la descripción)

**Hecho**: PINGU: «acabo de crear mi primer torneo con premios, pero
solo se especifican en la descripción».

Los premios pasan a ser una LISTA (`prizes`, jsonb: `[{puesto, premio}]`)
en vez de un párrafo. El puesto es TEXTO a propósito: «Top 8», «Todos los
participantes» y «Mejor lista» son premios de verdad y no caben en un
entero.

Dónde se ven: **panel propio en la ficha** —fuera de la cabecera, con el
primero destacado— y **chapa en la tarjeta de /torneos** con el premio
del primer puesto, que es lo que hace que alguien abra el torneo. Y el
campo está en los dos formularios, el de crear y el de editar.

La descripción deja de pedirlos: su marcador de posición decía «Reglas de
la casa, premios…» y ahora dice «cómo se juega». Si el hueco viejo sigue
invitando, conviven los dos sitios y gana el viejo.

La base valida la FORMA (la columna la escribe cualquiera que pueda
editar su torneo), y entre el despliegue y el SQL crear y editar siguen
funcionando: la columna se quita y se reintenta, como las otras cinco.

**Ficheros**: `supabase-migration-torneos-premios.sql` (NUEVO),
`js/torneos/comun.js`, `js/torneos/torneo.js`, `js/torneos/torneos.js`,
`js/schema-check.js`, `torneo.html`, `torneos.html`, `css/torneos.css`,
`SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-352.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**Corregido el mismo día**: la primera versión de la migración falló en
la base («0A000: cannot use subquery in check constraint») — un CHECK no
admite subconsultas, y recorrer una lista jsonb lo es. El recorrido pasa
a una función IMMUTABLE. Y al probarla **contra PostgreSQL 16 de verdad**
salió un segundo agujero que no se veía leyendo: `jsonb_typeof(p ->
'premio') <> 'string'` **no** rechaza un premio a medias, porque si la
clave no está `jsonb_typeof` devuelve NULL y `NULL <> 'string'` no es
cierto: es nulo. Con `is distinct from` sí.

**En curso / pendiente**: ejecutar `supabase-migration-torneos-premios.sql`
(los tres SQL de las tandas 350 y 352). Lo que queda por hacer con los
premios, si PINGU quiere: enseñarlos en la vista previa al compartir, en
el anuncio del foro y de Telegram, y al lado de cada puesto en la
clasificación final.

---

## 2026-09-24 — PINGU-Claude (tanda 351 — el botón de Editar un torneo no hacía nada)

**Hecho**: PINGU: «acabo de crear un torneo pero no puedo editarlo,
quiero meter el banner. El botón de editar no hace nada».

El formulario se colgaba de `.torneo-ficha`, que era la tarjeta blanca de
antes de la **tanda 298** — aquella rehízo la cabecera y esa clase dejó
de existir. `querySelector` devolvía null y la línea reventaba: el botón
dejó de hacer nada, con un error en la consola que no mira nadie. Ahora
se cuelga debajo de `#torneoCabecera`, y si algún día también le cambian
el nombre se cae a la caja de la página en vez de romperse.

**Y la prueba de la 296 estaba en verde**: comprobaba que el botón SALE.
Que salga no es que funcione. La nueva lo PULSA, en `draft` y en
`registration_open`, y mira que aparezca el formulario con el campo del
banner.

**Ficheros**: `js/torneos/torneo.js`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-351.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**: siguen los dos SQL de la 350
(`supabase-migration-correo-envio.sql` y
`supabase-migration-correo-enlaces.sql`).

---

## 2026-09-24 — PINGU-Claude (tanda 350 — los correos: duplicados, enlaces y verlos todos)

**Hecho**: PINGU, con quejas de gente: «los correos de resumen semanal se
duplican y llegan varias veces. Además, quiero ver todos los correos que
mandamos y hacerlos más visuales... hay algunos que el botón no funciona».

**Los duplicados.** `send-emails` mandaba el correo y DESPUÉS marcaba la
fila. Entre esas dos cosas la fila seguía en `pending`, y **una función
programada de Netlify se mata a los 30 segundos**: la pasada moría
habiendo mandado treinta correos sin marcar ninguno, y cinco minutos
después la siguiente los volvía a mandar. Por eso se duplicaba el
SEMANAL y no los demás: es el único que encola una fila por persona.
Ahora se RECLAMAN antes de mandar (estado `sending`, con un UPDATE
condicionado a que sigan `pending`, que resuelve Postgres y no el
JavaScript), hay presupuesto de tiempo de 20 s, y lo que se quede
reclamado más de 20 minutos vuelve a la cola contando el intento.

**Verlos todos.** Nueva pantalla **/admin → Correos**: los dieciséis
correos que mandamos, con su vista previa pintada por la MISMA plantilla
que sale de verdad, quién encola cada uno, su enlace y su pie. Más el
estado de la cola (en cola / enviándose / enviados / fallidos) y los
últimos errores, con dos funciones que devuelven RECUENTOS y nunca
destinatarios.

**Más visuales**: etiqueta de familia en color (Foro, Torneo, Guías,
Comunidad, Resumen), título más grande, y **la dirección escrita en
claro debajo del botón** — que es lo que arregla «el botón no funciona»
en los clientes que se comen el fondo o el enlace.

**El enlace roto**: el de «tu guía necesita cambios» llevaba a
`/perfil.html` («búscala tú»). Ahora abre la guía EN EL EDITOR, con
`?id=` y no `?slug=` —con el slug el editor abre una guía nueva y en
blanco—.

**Ficheros**: `js/email-plantilla.js` (NUEVO, la plantilla sale de
`netlify/lib/email.mjs` para que /admin pinte con ella),
`netlify/lib/email.mjs`, `netlify/functions/send-emails.mjs`,
`admin/index.html`, `admin/js/admin.js`,
`supabase-migration-correo-envio.sql` (NUEVO),
`supabase-migration-correo-enlaces.sql` (NUEVO), `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-350.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**: hay que ejecutar los dos SQL. Sin
`correo-envio` el envío sigue funcionando como hasta ahora (el reclamo
se salta solo si el estado no existe) — **pero los duplicados siguen
hasta ejecutarlo**.

---

## 2026-09-24 — PINGU-Claude (tanda 349 — el guion de las megas)

**Hecho**: PINGU: «Mew ex sí sale en qué mazos se ha jugado, pero Mega
Darkrai no, y también se ha usado una vez».

**No era el umbral** —desde la 338 con UN mazo ya se enseña—: era la
CLAVE. TCGdex la llama **`Mega-Darkrai ex`, con GUION**, y TCG Live la
escribe `Mega Darkrai ex`, con espacio. `normalizarNombre` quitaba
tildes, mayúsculas y espacios de más, pero no tocaba los separadores, así
que la tarea guardaba la fila con una clave y la ficha preguntaba por
otra. **La fila existía y nadie la encontraba, sin dar error, para la era
Mega ENTERA.**

La clave pasa a juntar los separadores (`claveDeCarta`, en
`js/normalizar.js`), y las dos mitades —la ficha y la tarea— la importan
de ahí. `normalizarNombre` se queda como estaba: la usan también la
Pokédex y el buscador de especies, donde un guion sí puede ser parte de
un identificador.

**Y de paso, las dos lenguas.** El export de TCG Live sale en el idioma
del jugador, así que la misma carta puede tener fila en inglés y fila en
español, y son mazos DISTINTOS. La ficha pregunta por las dos claves y
las suma — salvo los torneos, que no se pueden sumar sin contar dos veces
el mismo torneo con una lista en cada idioma.

**Ficheros**: `js/normalizar.js`, `js/carta-nucleo.js`, `js/carta.js`,
`netlify/lib/juego-agregado.mjs`,
`netlify/edge-functions/meta-social.js`,
`supabase-migration-clave-de-carta.sql` (NUEVO), `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-349.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**: la tabla se reconstruye sola cada media hora,
así que las fichas se arreglan sin hacer nada. La migración
`supabase-migration-clave-de-carta.sql` es para el SITEMAP (la columna
generada `name_key` tiene que juntar los separadores igual que el
JavaScript, o las cartas con guion dejan de ofrecerse a Google). Siguen
`supabase-migration-codigos-live.sql` y
`supabase-migration-marcas-por-set.sql`.

---

## 2026-09-24 — PINGU-Claude (tanda 348 — el 30 aniversario, en orden y con sus imágenes)

**Hecho**: dos cosas que PINGU vio en la página del 30C ya plegada.

**Las Classic van al FINAL, no intercaladas.** Las dos mitades empiezan
la numeración en el 001, así que ordenar solo por el número impreso las
mezclaba —001, 001, 002, 002…— y parecía una lista mal ordenada. Ahora
se ordena primero por `set_id` y después por el número: el identificador
del padre es prefijo del hijo, así que el padre queda delante solo, sin
una lista de nombres que mantener.

**Y las Classic salían sin imagen.** No es de la rejilla: esas cartas
tienen `image_path` a NULL en la base. El listado de un set no siempre
trae la imagen, y la ficha de una carta sí — así que `detalleDeCarta` la
recupera al engordar, con la misma regla que la marca de regulación:
**solo si viene**, porque escribir null encima borraría la que ya estaba
bien. Se arreglan solas según pase `cartas-detalle` (esas cartas no
están engordadas: se ve en que sus nombres siguen en inglés).

Para eso, `imagePathFromUrl` se muda de `js/tcgdex.js` a
`js/carta-detalle.js`, que no importa nada y sí puede viajar a una
función de Netlify. No es una copia: `tcgdex.js` la importa de allí.

**Ficheros**: `js/carta-detalle.js`, `js/tcgdex.js`, `js/coleccion.js`,
`netlify/edge-functions/meta-social.js`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-346.mjs` (el bloque 5b con el
orden, y un bloque 7 nuevo para la imagen).

**En curso / pendiente**: si TCGdex tampoco tiene escaneo de esas cartas,
esto no lo puede arreglar — desde aquí no se puede comprobar (el proxy
bloquea `api.tcgdex.net`). Se sabrá cuando la tarea pase por ellas.
Siguen sin ejecutar `supabase-migration-codigos-live.sql` y
`supabase-migration-marcas-por-set.sql`.

---

## 2026-09-24 — PINGU-Claude (tanda 347 — dos cosas que entendí al revés en la 346)

**Hecho**: PINGU, con la 346 ya en producción, con captura.

**«30 aniv es parte de megaevoluciones, no me lo separes».** Yo entendí
lo contrario y le saqué un grupo propio, «30 aniversario». Es una
entrega de la era de Mega Evolución como cualquier otra. Y lo que pedía
era otra cosa: **30th Celebration y 30th Classic Collection son EL MISMO
set**, y salían en dos filas. Ahora se pliegan en una (la cuenta de
cartas suma las dos), la página del set enseña las cartas de las dos
mitades, y quien llegue por la dirección de la mitad acaba en la del
set. En el sitemap solo va una.

La era a la que se pega no está escrita a mano: se busca la serie de los
sets `me*` EN LOS DATOS. El nombre lo pone TCGdex y puede cambiar; los
identificadores no.

**«Primero promos y energía empezando por ABAJO».** Las había puesto
arriba. Contando desde el final: la última fila son las promos, encima
las energías, y por delante las expansiones de la más nueva a la más
vieja.

**Ficheros**: `js/catalogo-series.js`, `js/cartas.js`, `js/coleccion.js`,
`netlify/edge-functions/meta-social.js`, `netlify/functions/sitemap.mjs`,
`SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-346.mjs` (los bloques 3 y 5b,
que ahora prueban lo que PINGU quería y no lo que yo entendí).

**En curso / pendiente**: lo mismo que la 346 — sin
`supabase-migration-codigos-live.sql` las direcciones siguen siendo las
viejas. Y sigue `supabase-migration-marcas-por-set.sql`.

---

## 2026-09-24 — PINGU-Claude (tanda 346 — la dirección, el nombre repetido, el orden y los filtros)

**Hecho**: seis cosas que pidió PINGU de /cartas y /coleccion.

**La dirección ya no dice ME05.** La etiqueta de la lista pasó a decir
PBL en la 345, pero al entrar la barra seguía diciendo
`/coleccion/me05`. Ahora la dirección es el CÓDIGO
(`/coleccion/pbl`), con el identificador de TCGdex de respaldo para los
sets que no tienen código. Las direcciones viejas siguen llegando
—`filtroDeColeccion()` pregunta por las DOS columnas, y el borde usa ese
mismo filtro— y la barra se corrige sola al entrar por la vieja.

**El nombre, una vez.** Con logo se veían el logo (que lleva el nombre
escrito) y el `<h1>` debajo. El `<h1>` no se va: se esconde con
`sr-only`, y el nombre pasa al `alt` del logo. Sin logo se ve, que es
medio catálogo viejo.

**El 30 aniversario es UNO.** TCGdex lo tiene partido en dos series (la
celebración y la Classics Collection) y para quien entra es lo mismo.

**Las promos abren la era**, después las energías y luego las
expansiones de la más nueva a la más vieja. No hay columna que lo diga,
así que se mira el nombre.

**Y los filtros.** En /coleccion, un buscador y un desplegable de tipo
que filtran SIN consultar (las cartas ya están todas bajadas), y el
desplegable solo ofrece los tipos que de verdad hay en esa colección. En
/cartas, el mismo desplegable junto al buscador: un tipo solo ya es una
búsqueda («enséñame cartas de Fuego»).

**Ficheros**: `js/carta-ruta.js`, `js/carta-nucleo.js`, `js/cartas.js`,
`js/coleccion.js`, `js/carta.js`, `cartas.html`, `coleccion.html`,
`css/carta.css`, `netlify/edge-functions/meta-social.js`,
`netlify/functions/sitemap.mjs`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-346.mjs` (NUEVO),
`herramientas/stub-supabase.js` (`contains` y `overlaps`, que el doble no
tenía) y `herramientas/correr-suite.sh`.

**En curso / pendiente**: el filtro por tipo solo encuentra cartas
ENGORDADAS —una sin `types` no es «de ningún tipo», es una de la que no
se sabe—, así que mejora según avanza `cartas-detalle`. Siguen sin
ejecutar `supabase-migration-codigos-live.sql` (sin él las direcciones
nuevas siguen siendo las viejas: el código está a null) y
`supabase-migration-marcas-por-set.sql`.

---

## 2026-09-23 — PINGU-Claude (tanda 345 — el código es de TCG LIVE, y TCGdex ya no lo da)

**Hecho**: PINGU, mirando la consulta de la 343: «pero el TCG Online es
lo antiguo, ahora es el TCG Live». Ahí está.

**La corrección que debo**: dije que la 343 arreglaría los códigos de
set. La tarea hizo su parte —visitó 216 de los 220 sets en un rato— y el
resultado fue **98 sin código, y TODOS los modernos entre ellos**. No es
que faltaran pasadas: `codigoLiveDeSet` lee `set.tcgOnline`, que es el
código de **Pokémon TCG Online** —la plataforma vieja, que cerró en
2023—, y TCGdex dejó de rellenarlo entonces. **El dato no existe arriba,
así que ninguna pasada lo va a traer.** Lo peor es que no da error: la
columna se queda a null y la lista de /cartas enseña el identificador
interno («ME05») como si fuera el código.

**Lo que se hace**: `supabase-migration-codigos-live.sql` (NUEVO) siembra
los 25 códigos de la era actual —de `30th`→30C y `me05`→PBL hasta
`sv01`→SVI—, solo donde la columna está vacía y solo en el catálogo
occidental, así que no pisa lo que TCGdex sí dio en su día.

**Y /admin pasa a ser el sitio donde se apuntan los nuevos.** La tarjeta
de «Códigos de set de TCG Live» ya tenía el campo de mano, pero
escondido en un desplegable de «avanzado» —porque se suponía que esto se
rellenaba solo— y **escribía solo el mapa de `site_settings`**, que
arregla las decklists y deja la etiqueta de /cartas en ME05. Son el
mismo dato dicho dos veces: ahora guardar escribe las dos, el bloque de
mano sale a la vista, y los textos dejan de prometer que TCGdex lo trae
y de echarle la culpa a la edad del set («los sets antiguos no tienen»
era falso: no los trae de ninguno).

**Y el lector de decklists**: `SETS_LIVE` de `js/torneos/comun.js` es el
respaldo mientras la migración no esté puesta, y le faltaban PBL, 30C y
MEP. MEP va con **nuestro** nombre de set (`MEP Black Star Promos`, no
«Mega Promos») porque ese paso resuelve con un `.eq('name', …)` exacto.

**Ficheros**: `supabase-migration-codigos-live.sql` (NUEVO),
`js/tcgdex.js`, `js/torneos/comun.js`, `admin/index.html`,
`admin/js/admin.js`, `admin/css/admin.css`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-345.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**: quedan DOS migraciones por ejecutar:
`supabase-migration-codigos-live.sql` y
`supabase-migration-marcas-por-set.sql`. Cada set nuevo que salga a
partir de ahora necesita que alguien le apunte el código en /admin →
Cartas → Códigos de set de TCG Live: la tarjeta dice cuántos de los 20
más nuevos lo tienen. Siguen 290 cartas atascadas con `detalle_error`,
sin mirar qué error es.

---

## 2026-09-23 — PINGU-Claude (tanda 344 — la colección, de golpe y a un tamaño que se vea)

**Hecho**: tres cosas que pidió PINGU de /coleccion.

**Todas las cartas de golpe.** Salían 60 y un botón de «ver más». Una
colección es una lista que se hojea, y partirla obliga a pulsar para ver
lo que ya sabías que estaba. Un set son ~200 cartas y las imágenes van
con `loading="lazy"`, así que lo que baja de verdad es lo que se mira. El
botón se va del HTML: sin nadie que lo encienda era marcado muerto.

**Cuatro por fila arriba, dos en el móvil.** Era `auto-fill` con un
mínimo y en pantalla ancha salían ocho: cartas del tamaño de un sello en
una página que existe para MIRAR cartas. Dos en el móvil y no una —a una
por fila hay que bajar doscientas veces, y a pantalla completa tampoco se
lee mejor.

**Y un fallo que llevaba ahí desde la 324 y no se notaba**: la rejilla
tenía el `container-type` Y sus propios `@container`. **Un elemento no
puede consultarse a sí mismo**, así que ese breakpoint no se aplicó
nunca. No se veía porque `auto-fill` adaptaba las columnas por su cuenta;
al fijar el número, salió a la primera. El contenedor pasa a ser la caja
de fuera.

**El logo del set ya salía**: `cabeceraDeColeccion` lo pinta desde la 324
con `logo_path`, que el importador guarda. Queda comprobado en la prueba,
con el caso de un set sin logo (media colección no tiene).

**Ficheros**: `js/coleccion.js`, `coleccion.html`, `css/carta.css`,
`SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-344.mjs` (NUEVO),
`pruebas/test-tanda-324.mjs` y `herramientas/correr-suite.sh`.

**En curso / pendiente**: lo de ME05 en vez de PBL **no es código**: el
molde ya prefiere el código de TCG Live. Falta ejecutar
`supabase-migration-sets-curado.sql` y que la tarea visite los ~220 sets
(menos de una hora). Siguen pendientes también
`supabase-migration-marcas-por-set.sql`.

---

## 2026-09-23 — PINGU-Claude (tanda 343 — saber si un set se ha VISITADO, no si le falta un campo)

**Hecho**: PINGU, comparando /cartas con Limitless: «los sets están mal,
pones la nomenclatura asiática y no la occidental». Donde Limitless dice
PBL, SSP o TWM, PokeDoc decía ME05, SV08 o SV06 — lo primero es el código
de TCG Live, con el que habla la gente y que sale en las decklists; lo
segundo es el identificador interno de TCGdex.

**El molde ya estaba bien**: `insignia` prefiere el de Live desde
siempre. Lo que faltaba era el DATO.

**Y falta por algo que merece quedar escrito.** El código solo viene en
el SET COMPLETO, y lo cura la fase de sets de la tarea programada, que
visita los que `leFaltaAlgo` marca. Esa condición ha preguntado dos cosas
distintas y las dos estaban mal por el mismo lado:

- Hasta la 333 incluía el código. Los sets anteriores a TCG Online no
  tienen ninguno, así que se quedaban «incompletos» para siempre: la
  fase no acababa nunca y el engorde no arrancaba jamás.
- Desde la 333 mira solo la serie. Eso rompió el cerrojo — y **el código
  dejó de curarse en silencio**.

Las dos preguntaban «¿le falta ESTE campo?», y eso no distingue «no lo
hemos pedido» de «TCGdex no lo tiene». Es el mismo error que la chapa de
legalidad de la 338, un piso más arriba. `curado_at` responde a otra
cosa: **¿hemos ido a mirar?** La fase termina siempre, que era lo que la
333 quería, y el código se cura, que era lo que se perdió.

**Dos agujeros que me encontré al escribirlo**, los dos sobre qué pasa
ANTES de ejecutar la migración: la consulta de sets tiraba todas las
columnas nuevas de golpe al fallar (así que sin la 343 se perdía también
la marca de la 339 — ahora baja de escalón en escalón), y el PATCH
mandaba `curado_at` siempre, lo que sin la columna da un 400 y se lleva
por delante la cura ENTERA, no solo la marca.

**Ficheros**: `supabase-migration-sets-curado.sql` (NUEVO, **sin
ejecutar**), `netlify/lib/carta-detalle.mjs`,
`netlify/functions/cartas-detalle.mjs`, `js/schema-check.js`,
`SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-343.mjs` (NUEVO),
`pruebas/test-tanda-335.mjs` y `pruebas/test-tanda-339.mjs` (las dos
comprobaban la FORMA vieja del respaldo) y `herramientas/correr-suite.sh`.

**En curso / pendiente**: **ejecutar
`supabase-migration-sets-curado.sql`**. Después, los ~220 sets se visitan
una vez —menos de una hora— y los códigos van apareciendo solos. Hasta
entonces /cartas sigue enseñando ME05 y SV08.

---

## 2026-09-23 — PINGU-Claude (tanda 342 — TCGdex declina los tipos en femenino)

**Hecho**: la debilidad del Mew ex de 30th Celebration salía sin
traducir. El valor guardado era **«Oscura»**, con A: TCGdex concuerda los
tipos con «energía» y manda la forma femenina, y la tabla tenía la
masculina. Añadidas las dos formas de los que tienen género (Oscura,
Psíquica, Metálica, Eléctrica, Siniestra, Incolora).

**Pero el arreglo de verdad es la otra mitad.** La traducción es una
línea; lo que costó fue ENTERARSE: hizo falta que PINGU lo viera en
pantalla, me lo dijera, yo probara once grafías a ciegas y al final
saliera de un `select`. Es la lección de la 323 —una lista curada se
queda vieja y alguien tiene que notarlo— y el sitio ya tiene el remedio
para los fallos que no lanzan excepción: `logClientError`. Ahora, si a la
tabla le falta una palabra, **aparece sola en /admin → Errores con la
palabra dentro**.

Se mira el DOM y no la carta a propósito: así cubre también lo que pintó
la función del borde, que es lo que se ve cuando la ficha ya está
engordada. Y solo avisa cuando falta algo — un canal que suena siempre
deja de escucharse.

**Ficheros**: `js/carta-detalle.js`, `js/carta.js`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-342.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**: PINGU ha visto que en /cartas los sets salen
con el identificador de TCGdex (ME05, SV10) y no con el código de TCG
Live (PBL, SSP), que es el que usa la gente. El código YA prefiere el de
Live — lo que falta es el DATO, y sé por qué: la 333 quitó el código de
`leFaltaAlgo` para romper un cerrojo, y con eso dejó de curarse. Va en la
siguiente.

---

## 2026-09-23 — PINGU-Claude (tanda 341 — la marca de un set, desde /admin)

**Hecho**: la pantalla que faltaba de la 339. Vive en /admin → Cartas,
debajo de la de las marcas legales de la temporada.

**Y no enseña los 220 sets, enseña los que hay que mirar.** La migración
de la 339 resolvió casi todos sin adivinar —preguntándole a sus propias
cartas— y la tarea programada hace lo mismo con los que van llegando. Lo
único que ninguna de las dos puede garantizar son las DEDUCIDAS: se
heredan del set anterior por fecha, y si la rotación cayó justo entre uno
y el siguiente se quedan con la letra de antes. Esas son la tabla. Una
pantalla que te da 220 filas para que encuentres tres es una pantalla que
nadie mira.

Confirmar una la deja como `mano`, **aunque no cambies la letra**: eso es
lo que hace que ninguna pasada futura la vuelva a deducir. Y escribe el
set Y sus cartas, porque lo que lee la ficha es la columna de la CARTA —
tocar solo el set dejaría la pantalla diciendo una letra y las fichas
otra. Solo donde está vacía: lo que TCGdex haya dicho de una carta
concreta no se pisa.

**Un fallo que salió al escribir la prueba**: la casilla llevaba
`maxlength="2"`, así que recortaba «Jota» a «Jo» —que SÍ pasa la
validación— y guardaba «JO» como marca, dejando el set entero fuera de
reglamento. Un campo que se traga lo que escribes y te lo convierte en
algo válido es peor que uno que dice que no. Fuera el `maxlength`: se
valida lo que se escribió.

**Ficheros**: `admin/index.html`, `admin/js/admin.js`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-341.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**: sigue pendiente de PINGU ejecutar
`supabase-migration-marcas-por-set.sql` — hasta entonces esta pantalla
sale diciendo justo eso, que es lo que tiene que decir en vez de una
tabla vacía.

---

## 2026-09-23 — PINGU-Claude (tanda 340 — el tipo que no conocemos, y la carta clicable desde cualquier sitio)

**Hecho**: dos cosas del mismo mensaje de PINGU, más la mudanza de CSS
que exigía la norma de la casa.

**1. El punto de la debilidad mentía.** «Está pintada con el círculo
blanco y es débil a siniestro». El color por defecto de
`.carta-energia` es `#d8dee3` y el de Incolora `#e6eaed`: un tipo sin
traducir **no se veía como «no lo sé», se veía como Incolora**. No
faltaba un color — se estaba diciendo uno falso, y en una debilidad eso
es decirle a alguien que su carta es débil a otra cosa.

Las cuatro grafías que se me ocurrieron (Darkness, Oscuro, Oscuridad,
Siniestro) ya se traducían todas, así que lo que TCGdex manda para ese
set es otra cosa **y no había forma de enterarse**. Ahora un tipo
desconocido sale con `data-tipo="?"`, hueco y punteado, y lleva el valor
CRUDO en el título: se ve que falta una traducción y se ve CUÁL.

**2. La carta, clicable desde cualquier sitio.** En la lista de un mazo
de torneo solo enlazaba el nombre del pie —letra pequeña debajo de un
escaneo de 245 px— y en una guía no enlazaba nada. Ahora el escaneo
enlaza en las dos. En las guías, **solo las occidentales**: /carta busca
en el catálogo WEST y enlazar una japonesa llevaría a «no encontrada»,
que es peor que no enlazar.

**3. Y hacer sitio en la portada.** Mi CSS la dejaba en 169,9 de 170, y
la norma dice que quien la toca empieza por hacer sitio. El bloque
`.deck-grid` / `.deck-card*` se fue a `css/cartas-lista.css`.

**Dos trampas, y las dos estaban puestas donde dice la casa que están**:
`js/curso.js` usa `.deck-empty` para el «Falta la imagen» de un
ejercicio y curso.html no carga la hoja nueva, así que esas dos reglas
SE QUEDAN (la lección de la 316). Y la hoja no es «de guías»: el barrido
de la 299 la puso roja dos veces seguidas hasta enseñarme que la
incrustan OCHO páginas —el foro, los temas, los dos perfiles y los dos
de torneos también—. Sin esa prueba lo habría roto.

**Ficheros**: `js/carta-nucleo.js`, `js/cards-block.js`, `js/tcgdex.js`,
`js/torneos/cartas-decklist.js`, `css/carta.css`, `css/components.css`,
`css/torneos.css`, `css/cartas-lista.css` (NUEVO), y las ocho páginas que
la cargan. `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-340.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**:
- **Falta saber qué manda TCGdex como debilidad del Mew ex de 30th.** Ya
  no se pinta mal, pero sigue sin traducirse. Con esta tanda el valor
  crudo sale en el título del punto: PINGU pasa el ratón por encima y me
  lo dice, o sale de `select weaknesses from tcg_cards where id =
  '30th-066'`. Con eso es una línea en la tabla de alias.
- Sigue faltando la pantalla de /admin para la marca de un set (339).
- Y la portada queda en 169,8 de 170 — 0,2 KB libres. Sigue siendo
  poquísimo: la próxima que la toque, a hacer sitio otra vez.

---

## 2026-09-23 — PINGU-Claude (tanda 339 — la marca de regulación es del SET)

**Hecho**: PINGU, con la carta delante: «sí que lleva marca de
regulación, llevan la marca J… no podemos dejar la marca vacía, y por
fecha ya deberías saber qué marca lleva». Las dos cosas, ciertas.

**Lo que pasaba**: TCGdex no trae `regulationMark` para las cartas del
set `30th`. Se vio en las filas ya engordadas —`detalle_at` puesto,
`detalle_lang` = es, sin error, y la columna a null— y `detalleDeCarta`
solo la escribe SI VIENE, a propósito (ponerla a null cuando falta
borraría las 8.288 que sembró la 215). Así que la ficha decía «No es
legal en Estándar» de una carta que sí lo es.

**Y mi arreglo de la 338 NO cubría este caso**, cosa que le dije mal:
aquella guarda solo calla cuando la ficha no se ha traído, y estas
están traídas. Valía para las 6.500 sin engordar, no para estas.

**Lo que lo hace arreglable sin inventar**: la marca es propiedad del
SET, no de cada carta. De ahí las tres fases de la migración, en orden
de menos a más suposición: (1) preguntarle a las propias cartas del set
—que no adivina nada—, (2) heredar la del set anterior más cercano por
fecha, y solo a partir de que las marcas existen, con el suelo sacado de
los DATOS (el set más antiguo que tiene una) y no de una fecha escrita a
mano, y (3) lo que un humano ha comprobado, que manda sobre las otras
dos: el `30th` va en J porque PINGU lo ha mirado.

Queda apuntado de dónde sale cada una (`regulation_mark_origen`), que es
lo que permite revisar las DEDUCIDAS —un puñado— en vez de los 220 sets.

**Y lo que no puede hacer**: rellenar los sets anteriores a que las
marcas existieran. Ahí el null no es un hueco, es la verdad, y
rellenarlo daría por legal media colección de 2016. Es el fallo
contrario y es peor.

**Y los sets que vengan, solos**: la tarea programada hace lo mismo con
cada set nuevo que llegue sin marca, y una carta recién engordada sin
marca coge la de su set. Sin eso habría que repetir la migración a mano
cada vez, y de eso no se acuerda nadie.

**Ficheros**: `supabase-migration-marcas-por-set.sql` (NUEVO, **sin
ejecutar**), `netlify/lib/carta-detalle.mjs`,
`netlify/functions/cartas-detalle.mjs`, `js/schema-check.js`,
`SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-339.mjs` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**:
- **PINGU tiene que ejecutar `supabase-migration-marcas-por-set.sql`** y
  después **revisar los sets deducidos** (`regulation_mark_origen =
  'fecha'`), que son los únicos que pueden estar mal: si la rotación cae
  justo entre un set y el siguiente, la deducción se queda con la letra
  anterior.
- Falta la pantalla de /admin para corregir a mano la marca de un set.
  Hoy eso se hace con un `update`.
- La suite entera sigue pendiente de una pasada con la 336, 337, 338 y
  339 dentro.

---

## 2026-09-23 — PINGU-Claude (tanda 338 — el null que no es un dato, y el bloque de torneos con poca muestra)

**Hecho**: dos cosas que salieron del mismo mensaje de PINGU sobre el
Mew ex del 30 aniversario.

**1. La chapa de legalidad mentía sobre lo que no sabía.**
`regulation_mark` a null son DOS cosas que en la base se ven igual: una
carta que NO LLEVA marca —anterior a 2019, y entonces sí está fuera— y
una que todavía no hemos engordado, donde la columna está vacía porque
nadie la ha pedido. Yo trataba la segunda como la primera, así que a una
carta del set más nuevo que hay le salía «No es legal en Estándar».

Es la lección de la 319 —el defecto que convierte «no me lo han dado» en
un dato— y **la tengo escrita en el comentario de esa misma función**.
La escribí y la volví a pisar un piso más arriba: allí era el parámetro
que no llegaba, aquí la columna que no se ha rellenado. Ahora se
distinguen por `detalle_at`, y sin marca y sin ficha no se pinta nada.

**2. El bloque de torneos, desde un mazo.** PINGU: «aunque esté en 1
mazo ya debería salir». Tiene razón: que una carta se haya jugado en un
torneo de PokeDoc es justo lo que no tiene ninguna otra web, y
esconderlo por no poder calcular una media encima es tirar el dato bueno
para proteger el malo.

Pero con un mazo no se puede decir «copias de media» ni «se juega sobre
todo en»: una media de una muestra de uno es el mismo número disfrazado
de estadística. Así que `MAZOS_MINIMOS` baja a 1 y aparece
`MAZOS_PARA_TENDENCIA` (3). Con poca muestra se cuenta el caso —y se
enseñan las copias EXACTAS, que antes no se veían nunca— y el pie avisa
del tamaño. Con muestra, lo de siempre.

Una trampa que me colé a mí mismo: con la lista de arquetipos vacía, la
fila de «Otros» se llevaba todos los mazos y salía «Se juega sobre todo
en · Otros 1» — la misma afirmación, dicha de otro modo. La cazó la
prueba.

**Y lo que NO baja es el listón de Google**: son dos preguntas distintas
y ahora tienen dos números. Indexar sigue pidiendo muestra (3), porque
una ficha cuyo único contenido propio es «la llevó un mazo» es contenido
escaso y eso castiga al sitio entero.

**Ficheros**: `js/carta-nucleo.js`, `js/carta.js`, `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-325.mjs` (reescrito su bloque
4, que afirmaba la regla vieja), `pruebas/test-tanda-335.mjs`,
`rigor/rigor-tanda-335.py` y `rigor/rigor-tanda-338.py` (NUEVO).

**En curso / pendiente**: la suite entera sigue pendiente de una pasada
con la 336, la 337 y la 338 dentro.

---

## 2026-09-23 — PINGU-Claude (tandas 336 y 337 — las marcas legales desde /admin, y el check-in de una mesa viva)

**Hecho**: dos cosas sin relación entre sí.

**336 — las marcas de regulación, con pantalla.** `marcas_legales` vive
en `site_settings` y **rota cada abril**, pero hasta hoy solo se podía
cambiar desde el SQL Editor. Un ajuste que se toca una vez al año y no
tiene pantalla se queda viejo sin que nada dé error, y el síntoma es de
los peores: la web diciéndole a alguien que un mazo legal no lo es.

La pantalla (en /admin → Cartas) hace tres cosas, no una: deja
cambiarlas, **canta cuando ha pasado un abril** desde la última vez, y
**antes de guardar cuenta cuántas cartas quedarían legales** — si
escribes una letra que no existe te lo dice ahí, y no en el mazo de
alguien. `updated_at` se escribe A MANO: la columna tiene `default
now()`, que solo corre al INSERTAR, y no hay disparador; sin eso el
aviso de la rotación mentiría callándose. Sin migración: la clave, la
columna y la política ya existían.

**337 — el check-in que fallaba en un torneo de verdad.** Reportado por
un jugador: sin que hubieran pasado los 5 minutos, una mesa no dejaba
marcarse listo y soltaba «Esta mesa ya no admite check-in.»

No tenía nada que ver con el tiempo. El rival reporta antes de que tú
hagas check-in → la mesa pasa a `awaiting_confirmation` → el botón
SIGUE ahí, y `torneos_checkin` solo admitía `pending` y `active`. El
mensaje mentía dos veces: ni era «ya», ni tenía que ver con la ventana
que la persona estaba mirando.

Se arregla ABRIENDO y **solo en el servidor**: el check-in es un
registro de PRESENCIA, y si tu rival acaba de reportar es que estabas
en la mesa. Mi primer intento le añadió una guarda al cliente y **no
habría cambiado ni un píxel** — «Tu partida» ya tiene pantalla propia
para cada estado cerrado y para `pending` y `disputed`, así que el botón
solo llega a pintarse en `active` y `awaiting_confirmation`. Revertido.

Y no reabre ninguna puerta: el barredor que da la ronda por perdida solo
mira las mesas en `active`, así que un check-in tardío no cambia ningún
resultado.

**Ficheros**: `admin/index.html`, `admin/js/admin.js`,
`admin/css/admin.css`, `supabase-migration-checkin-mesa-viva.sql`
(NUEVO, **sin ejecutar**), `SCHEMA.md`.
En la rama `pruebas`: `pruebas/test-tanda-336.mjs`,
`pruebas/test-tanda-337.mjs`, `rigor/rigor-tanda-336.py` (los tres
NUEVOS) y `herramientas/correr-suite.sh`.

**En curso / pendiente**:
- **PINGU tiene que ejecutar `supabase-migration-checkin-mesa-viva.sql`**.
  Hasta entonces el fallo del check-in sigue vivo: es el único arreglo
  de la 337 y está entero en la función.
- La suite entera está pendiente de una pasada con la 336 y la 337
  dentro (las dos pasan sueltas, y el rigor de la 336 detecta sus 19).

---

## 2026-09-22 — PINGU-Claude (tanda 335 — el nombre en español, en su propia columna, y la chapa de legalidad)

**Hecho**: dos cosas, una de arreglo y otra nueva.

**1. El nombre.** Al engordar en español (tanda 330) el nombre traducido
se escribía ENCIMA de `tcg_cards.name`. Y ese nombre no es una etiqueta:
es la CLAVE con la que se cruzan tres cosas que vienen en inglés —
`tcg_card_play` (que se construye con decklists de TCG Live), el respaldo
por nombre del resolutor de decklists, y la huella de las reimpresiones.
Con el catálogo en español, la ficha preguntaba por «órdenes del jefe» y
el agregado tenía «boss's orders»: el bloque «En los torneos de PokeDoc»
**no podía casar NUNCA** y desaparecía sin dar error. Es la lección de la
334 un piso más abajo: **lo que se guarda como CLAVE es canónico; lo que
se ENSEÑA va traducido.**

Ahora `name` se queda en inglés y el traducido va a `name_es`.
`nombreDeCarta()` es lo único que se pinta y `claveDeJuego()` lo único
que se cruza. Y la trampa que casi se cuela: `name_search` pasa a llevar
los DOS idiomas (para que se encuentre por «órdenes» y por «boss»), con
lo que deja de servir para cruzar EXACTO — el sitemap lo hacía así y se
habría quedado sin todas las fichas traducidas en silencio. De ahí
`name_key`, que es lo que `name_search` era antes.

Se vio en la captura de /coleccion, no en el código: la baldosa ponía
«Boss's Orders» y la ficha «Órdenes del jefe». La rejilla la pintan
/cartas y /coleccion con el mismo molde, así que estaban las dos.

**1b. Y lo que ya estaba guardado mal.** Las 2.811 cartas engordadas en
español ya tienen el nombre traducido en `name`. El español se salva con
SQL (se copia a `name_es`); el inglés se había perdido y hay que volver a
pedirlo — pero viene en el LISTADO de un set, así que son ~220 peticiones
y no 2.811. Lo hace una fase nueva de la tarea programada, acotada en
tiempo, con `tcg_sets.names_fixed_at` marcando por dónde va. Escribe cada
set de una sentencia (PATCH carta a carta serían 200 viajes y la pasada
se muere a los 30 s) y solo con identificadores que ya están en la tabla:
un `merge-duplicates` con uno que no existe **no da error, inserta una
fila a medias**. Y la columna nueva se pide con vuelta atrás, porque
PostgREST devuelve 400 —no null— si no existe: sin eso, subir esto antes
de ejecutar la migración habría parado el engorde en seco.

**2. La chapa de si se puede jugar hoy.** La pregunta que trae a alguien
a la ficha de una carta vieja no es cuántos PS tiene, sino si la puede
meter en el mazo — y esa respuesta solo estaba a la vista para quien
pegaba una decklist entera en un torneo. Tres estados: legal, «esta
impresión no pero sí una reimpresión», y fuera. Y un cuarto que NO se
pinta: si no se saben las marcas de la temporada, no se afirma nada (la
lección de la 319). Solo se habla de ESTÁNDAR — Expandido no se puede
deducir de la marca y afirmarlo sería inventárselo.

La regla no está escrita dos veces: `js/carta-legalidad.js` va a buscar
el dato (lo usan la ficha Y el revisor de decklists, que ha soltado su
copia) y `legalidadEstandar` decide, pura, para que la pueda ejecutar
también la función del borde.

**Ficheros**: `supabase-migration-cartas-nombre-es.sql` (NUEVO, **sin
ejecutar**), `js/carta-legalidad.js` (NUEVO), `js/carta-nucleo.js`,
`js/carta-detalle.js`, `js/carta-ruta.js`, `js/carta.js`, `js/cartas.js`,
`js/coleccion.js`, `js/schema-check.js`, `js/torneos/cartas-decklist.js`,
`netlify/lib/carta-detalle.mjs`,
`js/torneos/comun.js`, `css/carta.css`,
`netlify/functions/cartas-detalle.mjs`, `netlify/functions/sitemap.mjs`,
`netlify/edge-functions/meta-social.js`, `SCHEMA.md` (que iba sin las
tandas 328 a 334 y se ha puesto al día), `CLAUDE.md`.
En la rama `pruebas`: `pruebas/test-tanda-335.mjs` (NUEVO),
`rigor/rigor-tanda-334.py` (NUEVO), `rigor/rigor-tanda-335.py` (NUEVO) y
`herramientas/correr-suite.sh`.

**En curso / pendiente**:
- **PINGU tiene que ejecutar `supabase-migration-cartas-nombre-es.sql`**.
  Hasta entonces la ficha sigue enseñando el nombre en inglés y el bloque
  de torneos sigue sin salir en las traducidas. La migración además pone
  `detalle_at` a null en las que se engordaron en español, para que la
  tarea programada devuelva los nombres ingleses set a set (~220
  peticiones, una hora larga). Mientras tanto, esas cartas siguen sin su
  bloque de torneos.
- Sigue pendiente de PINGU la imagen del bloque `zonas` del curso de
  anatomía de una carta, y decidir qué hacer con los sets japoneses del
  catálogo WEST.

---

## 2026-09-22 — PINGU-Claude (tanda 334 — TCGdex no traduce solo los ataques)

**Hecho**: PINGU, tres veces en dos días: no sale el subtítulo, no sale
la debilidad, no salen los otros prints. Yo los traté como tres cosas
distintas y eran UNA.

Al empezar a engordar en español (tanda 330) se me pasó lo obvio:
**TCGdex traduce también los campos que el código compara con cadenas
inglesas.** `category` llega como «Pokémon», `stage` como «Básico», los
tipos como «Psíquico». Y `category === 'Pokemon'` era la puerta del
subtítulo, del cuadro de debilidad/resistencia/retirada Y de la huella
— así que una carta engordada en español se quedaba sin las tres a la
vez, y sin huella tampoco salían sus reimpresiones. Los tipos
traducidos, de paso, dejaban los puntos de energía en gris.

**Estaba a la vista y no lo vi**: donde nuestra tabla dice «Doble rara»,
la ficha ponía «Rara Doble». Eso no lo escribió PokeDoc.

Arreglado en los dos lados: `canonizarCarta` devuelve los enums al
inglés al ESCRIBIR (las que vengan) y al PINTAR (las 2.811 ya guardadas,
que no hace falta reengordar). Las tablas se construyen INVIRTIENDO las
de traducción que ya existían, no escribiendo una lista nueva.

**Y la red que evita que vuelva a pasar**: adivinar cómo escribe TCGdex
cada palabra es una lista curada, y una lista curada se queda vieja (la
323). Por eso `esPokemon` mira la categoría Y, si esa palabra no la
conoce, **la estructura**: los PS solo los tiene un Pokémon.

**Ficheros**: `js/carta-detalle.js` (`canonizarCarta` y `esPokemon`
NUEVAS), `js/carta-nucleo.js` (las tres puertas). En `pruebas`:
`test-tanda-334.mjs` (NUEVO).

**Pruebas**: suite entera verde, **91 de 91**. Rigor de la 334,
pendiente.

**Y de propina, la misma trampa un piso más abajo**: el escaneo seguía
pegado al scroll en el móvil. El bloque `@media (max-width: 720px)` que
lo ponía `static` estaba escrito ARRIBA, antes de la base `.carta-scan
{ position: sticky }` — y **un `@media` no suma especificidad**, así que
ganaba la base por orden de aparición. Lo que despistaba: el
`max-width` del mismo bloque SÍ funcionaba, porque no choca con nada, y
por eso parecía que la regla entera se aplicaba. Es la trampa de la 299
dentro de UNA SOLA HOJA. La prueba mira el `position` CALCULADO y dónde
acaba la imagen al bajar, no el texto del CSS.

**En curso / pendiente**: las chapas de legalidad (Estándar/Expandido)
en la ficha, que es lo que falta frente a Limitless. Y el rigor de la
334.

---

## 2026-09-22 — IBAI-Claude (tanda 333 — el engorde estaba en un cerrojo, y la huella no cruzaba el idioma)

**Hecho**: Ibai pidió «que salgan los reprints etc». Miré la base con la
clave pública y el estado era este: 21.356 cartas, 3.676 engordadas,
**cero en español** — la migración de la 330 ya está ejecutada, pero la
tarea programada llevaba todo el día atascada en la fase de sets.

**El cerrojo.** `leFaltaAlgo` contaba como «incompleto» un set sin
código de TCG Live o sin fecha, y ~100 sets NO LOS TIENEN en TCGdex (los
anteriores a TCG Online no tienen código; algunas promos, ni fecha). La
fase de sets era excluyente —devolvía sin engordar ni una carta— así que
se los volvía a pedir cada cinco minutos para siempre. Ahora
`leFaltaAlgo` mira solo la SERIE, que el set completo trae siempre: un
set con serie es un set ya visitado (fecha y código se curan en esa
misma visita, si existen). Y la fase de sets ya no es excluyente: corre
acotada (`PRESUPUESTO_SETS_MS`, 8 s) y el engorde corre SIEMPRE con el
tiempo que quede.

**La huella.** Comparaba los NOMBRES de los ataques, y desde la 330
conviven fichas en español y en inglés: «Hackeo Genoma» no casa jamás
con «Genome Hacking» (comprobado contra TCGdex con el Mew ex de PINGU),
así que ninguna reimpresión cruzaba el idioma — con el catálogo entero
por reengordar en español, casi todas las parejas iban a cruzar. Ahora
`esLaMismaCarta` mira el idioma de cada ficha (`idiomaDeFicha`:
`detalle_lang`, y null = inglés de antes de la 330): mismo idioma,
huella fina con nombres; idiomas distintos, la huella se queda con lo
que no se traduce (PS, fase, tipos, coste y daño de cada ataque — el
nombre de la CARTA entra siempre, Pokémon no traduce especies). Y las
candidatas traídas al vuelo se piden EN EL IDIOMA de la carta que se
mira (`detalleEnEspanol` acepta ahora el orden de idiomas), que da la
comparación fina y le ahorra a una ficha en inglés la petición en
español que iba a dar 404. La ficha al vuelo se marca con su
`detalle_lang` en memoria, y `carta.js` pide la columna en sus dos
consultas.

**Ficheros**: `netlify/lib/carta-detalle.mjs` (`leFaltaAlgo`),
`netlify/functions/cartas-detalle.mjs` (fase de sets acotada y no
excluyente), `js/carta-nucleo.js` (`idiomaDeFicha` NUEVA, huella con
nombres opcionales, `esLaMismaCarta` por idioma), `js/carta-detalle.js`
(`detalleEnEspanol` con orden de idiomas inyectable), `js/carta.js`
(`detalle_lang` en las consultas y en la ficha al vuelo, candidatas en
el idioma de la carta).

**Pruebas**: verifiqué la lógica con un guion suelto fuera del repo (12
comprobaciones, todas verdes, con las respuestas reales de TCGdex del
Mew ex en es/en) y `node --check` de los cuatro módulos. PINGU: pide una
pasada de suite — sospecho que `test-tanda-331.mjs` ancla la firma vieja
de `detalleEnEspanol`/`huellaDeCarta` (los cambios son compatibles hacia
atrás: parámetros nuevos con valor por defecto) y que algún fixture de
la 328 compara huellas: si las dos fichas del fixture no llevan
`detalle_lang`, las dos cuentan como inglés y el resultado no cambia.

**En curso / pendiente**: nada a medias. Vigilar en un rato que
`detalle_lang=eq.es` empieza a subir (la consulta de «cómo va» está al
pie de supabase-migration-cartas-espanol.sql); el reengorde de las
3.676 en inglés más el resto del catálogo tardará unos días a 30 cada
5 min. Los 4 sets sin fecha y ~98 sin código se quedan así a propósito:
TCGdex no los tiene.

---

## 2026-09-22 — PINGU-Claude (tanda 331 — la ficha se completa sola, y el rigor de todo)

**331.** PINGU: «entro al Mew ex y solo me sale Mew y su número». Era
verdad: esa carta no estaba engordada, así que no había ataques, ni PS,
ni debilidad — y sin ataques tampoco hay huella, así que tampoco salían
sus reimpresiones.

Ahora, si falta el detalle, la ficha **se lo pide a TCGdex en el
momento**, en español. Una petición, y solo para la carta que alguien ha
abierto de verdad: esa es la excepción que admite la norma de la casa —
lo caro es pedir las 23.000, no pedir la que se está mirando. Lo de la
base MANDA sobre lo que llega (la marca de regulación la curamos
nosotros); lo de fuera solo rellena huecos. Si la red falla, la página
sale como antes: peor ficha, nunca página en blanco.

Para eso `detalleDeCarta` se muda de `netlify/lib/` a
**`js/carta-detalle.js`**: sigue sin un solo import y la función de
Netlify lo reexporta, igual que se hizo con `normalizarNombre` en la 325.

**EL RIGOR DE TODO.** 322 (13/13), 328 (15/15), 329 (9/9), 330 (12/12) y
331 (6/6). Y me corrigió SIETE veces, todas en las pruebas:

  · Dos fixtures que no se parecían a los datos: una serie con un solo
    set (donde «el primero» y «el más grande» son el mismo) y una carta
    sin las columnas del detalle a null, que es como llegan de verdad.
  · Cinco huecos en la prueba de la 328: la huella probada con ejemplos
    que cambiaban varios campos a la vez, el orden de los ataques sin
    probar, y los iconos de tipo que no miraba nadie.

**Y UN AGUJERO EN EL DOBLE que llevaba ahí desde siempre**: no tenía
`.like`, solo `.ilike`. `searchCards` usa `.like`, así que la llamada
reventaba, el `try/catch` de `resolverCarta` se tragaba el error y **el
camino de respaldo POR NOMBRE no lo había ejercitado ninguna prueba
jamás** — justo el camino que marcó en rojo el Mew ex de PINGU. Añadido
al doble; la suite entera sigue verde con él.

**Ficheros**: NUEVO `js/carta-detalle.js`. Tocados
`netlify/lib/carta-detalle.mjs` (reexporta), `js/carta.js`. En
`pruebas`: `test-tanda-329.mjs` y `test-tanda-331.mjs` (NUEVOS),
`rigor-tanda-328.py`, `rigor-tanda-329.py`, `rigor-tanda-330.py`,
`rigor-tanda-331.py` (NUEVOS), `rigor-tanda-322.py` (anclas al fichero
mudado), `stub-supabase.js` (`.like`), y los fixtures de la 328, la 330
y la 331.

**Pruebas**: suite entera verde, **88 de 88**. Rigor: 55 mutaciones,
todas detectadas.

**En curso / pendiente**: que PINGU ejecute
`supabase-migration-cartas-espanol.sql` — sin ella la tarea no avanza. Y
decidir qué hacer con los sets japoneses del catálogo occidental.

---

## 2026-09-22 — PINGU-Claude (tanda 330 — el catálogo en español, y qué es una era)

**El español.** PINGU: «los ataques salen en inglés, why?». No era un
descuido —el catálogo occidental se importa en inglés a propósito—,
pero esa decisión era sobre el LISTADO, donde lo único que hay es el
nombre. El texto de los ataques viene en la petición POR CARTA, que ya
hacemos igual: pedirla en español no cuesta ni una petición más, cuesta
pedirla en otro idioma.

Ahora la tarea pide `es` y cae a `en` (las anteriores a 2011 no están
traducidas y TCGdex da 404), y **apunta en qué idioma lo consiguió** en
`detalle_lang`. Sin esa columna, una carta traducida y una que no lo
está son indistinguibles, y reintentarlo dentro de un año costaría
reengordar las 23.000. La tanda por pasada baja de 40 a 30 porque en el
peor caso son dos peticiones por carta.

**HAY MIGRACIÓN**: `supabase-migration-cartas-espanol.sql`. Añade
`detalle_lang` y cambia el índice parcial del engorde. Hasta que se
ejecute, la tarea no encuentra la columna y no avanza.

**Las eras.** Ordenar las series por su set más nuevo dejaba
«McDonald's Collection» entre Escarlata y Púrpura y Espada y Escudo,
porque McDonald's saca promos todos los años. La regla nueva NO es una
lista de nombres a mano —se quedaría vieja, la lección de la 323— sino
el TAMAÑO: una serie es una ERA si alguno de sus sets pasa de cien
cartas. Las eras primero y de la más nueva a la más vieja; detrás las
promos; y lo que no tiene serie, al final del todo.

**Ficheros**: `netlify/lib/carta-detalle.mjs`,
`netlify/functions/cartas-detalle.mjs`, `js/cartas.js`, `css/carta.css`.
NUEVO `supabase-migration-cartas-espanol.sql`. En `pruebas`:
`test-tanda-330.mjs` (NUEVO).

**Pruebas**: suite entera verde, **88 de 88**.

**En curso / pendiente**: los REPRINTS de una carta sin engordar no
salen, y es por diseño —sin ataques no hay huella—, pero se nota: PINGU
abrió Mega Darkrai y Mew ex y no vio nada. El arreglo bueno es pedirle
la ficha a TCGdex EN EL NAVEGADOR cuando falta, que además la traería en
español al momento. Pide mover `detalleDeCarta` a `js/` (hoy vive en
`netlify/lib/` y el rigor de la 322 lo ancla ahí). Mientras tanto se
arregla solo según avanza el engorde, que va de lo más nuevo a lo más
viejo. Y el rigor de las tandas 328, 329 y 330 sigue pendiente.

---

## 2026-09-22 — PINGU-Claude (tandas 328 y 329 — la identidad de una carta)

**328 — mismo nombre no es la misma carta.** Dos fallos con la misma
causa: comparar por NOMBRE y tratar el resultado como si fuera la carta.

EL GRAVE: la lista de un mazo marcaba en rojo el Mew ex de 30th
Celebration de PINGU como fuera de reglamento, usando la marca de OTRO
Mew ex encontrado por nombre. Ahora `resolverCarta` dice si el hallazgo
es EXACTO (set + número) y, si no lo es, la marca viaja a null: el
comprobador no puede juzgar lo que no ha identificado aunque quiera. Y
avisa de que no la reconoce y de por qué.

EL OTRO: «otras versiones» salían trece Primeapes de trece sets. Una
reimpresión comparte el TEXTO DE REGLAS (vida, fase, ataques con su
coste y su daño); el efecto no entra en la huella porque se reescribe
entre erratas. Y la debilidad, la resistencia y la retirada salen ya con
el icono del tipo.

**Y el filtro de Pocket que no echaba a nadie.** En la base los CATORCE
sets de Pocket tienen `serie_id` a NULL, así que mirar solo la serie no
servía de nada. **Y mi prueba pasaba en verde porque el fixture lo
había escrito yo con la serie puesta**: probaba el código contra mi
invento y no contra los datos. Ahora se reconocen por el IDENTIFICADOR
(A1, A2b, B1…) y la prueba lleva los catorce de verdad más la lista de
sets de mesa que NO pueden caer por el patrón. PINGU ejecutó
`supabase-migration-borrar-pocket.sql`: fuera 14 sets y 2.380 cartas.

**329 — lo que solo viene en el set completo, otra vez.** La consulta de
después del borrado lo destapó: **los 210 sets tienen `serie_id` y
`serie_name` a NULL**, y solo 112 tienen código de TCG Live. Es la
lección de la 322 sin aplicar: `setToRow` corre sobre el LISTADO, que es
un «SetResume», y allí no viene ni la serie, ni el código, ni la fecha.

Y explica DOS cosas de golpe: por qué no hay eras en el índice, y por
qué se colaron los sets de Pocket —`fetchSets` los filtraba con
`s.serie?.id`, que nunca llegó—. Y también por qué falló el Mew ex: 30C
no tiene código, así que su set no se encuentra.

Arreglado: la fase de curación de `cartas-detalle` cura ahora el SET
ENTERO (fecha, serie y código), `setToRow` ya no escribe la serie desde
el listado —la borraría al reimportar— y `fetchSets` filtra con
`esDelTCG`. Unas 210 peticiones, menos de una hora.

**ME CORRIJO EN DOS COSAS que llevo días repitiendo**: (1) «el set más
nuevo es de 2025-10-30 y el catálogo lleva siete semanas de retraso» —
ese set era Mega Rising, que es de POCKET; el catálogo llega al
2026-09-16 y está al día. (2) le he estado pidiendo a PINGU que
reimporte cuando el problema no era ese.

**Ficheros**: `js/carta-nucleo.js`, `js/carta.js`, `js/cartas.js`,
`js/catalogo-series.js`, `js/tcgdex.js`, `js/torneos/cartas-decklist.js`,
`css/carta.css`, `netlify/lib/carta-detalle.mjs`,
`netlify/functions/cartas-detalle.mjs`, `netlify/edge-functions/meta-social.js`,
`netlify/functions/sitemap.mjs`. NUEVO
`supabase-migration-borrar-pocket.sql` (ya ejecutado).
En `pruebas`: `test-tanda-328.mjs` (NUEVO), `test-tanda-322.mjs` (vigila
la segunda copia, `codigoLiveDeSet`), `test-tanda-324.mjs` y
`test-tanda-327.mjs` al día.

**Pruebas**: suite entera verde, **87 de 87**. El rigor de la 328 y la
329, pendiente.

**En curso / pendiente**: el catálogo EN ESPAÑOL (los ataques salen en
inglés porque el occidental se importa en inglés a propósito: nombres e
imágenes son ~154 peticiones, pero el texto de los ataques son ~23.000).
Y decidir qué hacer con los sets japoneses del catálogo occidental.

---

## 2026-09-22 — PINGU-Claude (tanda 327 — el catálogo, arreglado de verdad)

**Hecho**: PINGU abrió las páginas nuevas en producción y estaban rotas.
`/coleccion/tr` y `/carta/…` salían SIN CSS y SIN JavaScript.

**La causa era mía**: las tres cargaban sus hojas con rutas RELATIVAS,
copiadas de `lanzamientos.html`. En `/cartas` eso resuelve bien; en
`/coleccion/tr` el navegador pide `/coleccion/css/style.css` y se come un
404. Las páginas que ya tenían dirección bonita (usuario, tema) llevan
las rutas absolutas desde siempre.

**Y no lo vio nadie por DOS motivos**: las pruebas abrían la dirección
PLANA (`/carta.html?id=…`), y el servidor de pruebas **no hacía las
reescrituras de Netlify**, así que la dirección bonita ni existía en
local. Arreglado lo segundo antes que lo primero — `servir.py` hace ahora
las mismas reescrituras que `netlify.toml`.

**Lo demás que venía en el mismo parte**: fuera las colecciones de
Pokémon TCG Pocket (se filtran AL LEER, no solo al importar, porque lo
que está en la base entró antes de ese filtro); «Cartas» en la barra de
arriba y en el menú del móvil de las 25 páginas; y una colección sin
logo ya no descuadra la rejilla.

**Y una cosa gorda que salió al medir la barra**: el chip de torneo en
juego y los enlaces NUNCA cupieron juntos. `.nav-inner` está topada en
1.160 y no crece con el monitor; con el chip, `.nav-right` se va a 578 y
no quedan enlaces que quepan a NINGÚN ancho. No cabían antes tampoco —
`.nav-links` es hijo de flex y cedía en silencio. La regla que había
daba por hecho que era cuestión de ventana (un tramo de 1.080 a 1.179);
ahora los enlaces se van al menú siempre que hay chip. El corte de los
enlaces pasa a 1.160, medido otra vez con `herramientas/medir-barra.mjs`.

**El rigor me corrigió TRES veces** y las tres eran de la prueba, no del
código: un `[\s\S]*?` que se saltaba el `</div>` y encontraba el enlace
en el menú del móvil (la trampa de la 312 con otra cara); una mutación
que no cambiaba nada; y sobre todo —la buena— que yo comprobaba si los
enlaces se APRETABAN cuando lo que pasa de verdad es que **la página se
desborda en horizontal**. Medí el síntoma equivocado.

**Ficheros**: `carta.html`, `coleccion.html`, `cartas.html` (rutas
absolutas), las 25 con pie (barra y menú), `css/style.css` (el corte y
la regla del chip), `js/cartas.js`, `js/coleccion.js`, `js/tcgdex.js`,
`css/carta.css`, `netlify/edge-functions/meta-social.js`,
`netlify/functions/sitemap.mjs`, `SCHEMA.md`. NUEVO
`js/catalogo-series.js`. En `pruebas`: `test-tanda-327.mjs` y
`rigor-tanda-327.py` (NUEVOS), `servir.py` con las reescrituras,
`medir-barra.mjs` (NUEVO), `test-tanda-324.mjs` al día.

**Pruebas**: suite entera verde, **86 de 86**. Rigor 327: 13 de 13.

**En curso / pendiente**: lo de siempre — el catálogo EN ESPAÑOL, que
PINGU **reimporte el catálogo** (el set más nuevo sigue siendo de
2025-10-30, y hasta que no se reimporte muchas colecciones no tienen ni
logo ni fecha) y la imagen del bloque `zonas` del curso.

---

## 2026-09-22 — PINGU-Claude (tandas 325 y 326 — el catálogo, terminado)

**Hecho**: cerrado el plan de las páginas de carta. Ya está todo montado.

**325 — «en los torneos de PokeDoc».** El bloque que justifica el
proyecto: cuántos mazos llevan la carta, cuántas copias de media, en
cuántos torneos y de qué arquetipos, con su barra. Una tarea programada
cada media hora lo calcula en `tcg_card_play`.

Lo delicado de esta tanda es que la casa tiene una promesa escrita —los
arquetipos no se guardan, para que la visibilidad no se pueda
equivocar— y un agregado guardado la deja en manos de una decisión.
**La decisión: la tarea LEE las decklists con la clave PÚBLICA** y solo
escribe con la de servicio. Así lo que entra en el agregado es, por
construcción, lo que ya ve todo el mundo. El rigor lo vigila: cambiar
esa clave pone la prueba roja.

También: el bloque no sale por debajo de 3 mazos (un porcentaje sacado
de dos listas es ruido con aspecto de dato), lleva la muestra a la vista
y dice de dónde salen sus números. Y guías del sitio e hilos del foro
que nombran la carta, debajo.

**326 — que lleguen.** Sitemap con `/cartas`, todas las colecciones y
solo las fichas indexables —**importando la misma función** que pone el
`noindex`, para que no haya dos opiniones—; `/cartas` en el pie de las
25 páginas; y el enlace que más vale del sitio: el nombre de cada carta
dentro de la lista visual de un mazo enlaza a su ficha.

**SUBÍ EL LISTÓN DEL NOINDEX, y va contra lo que escribí en la 324.**
Allí dije que bastaba con estar engordada porque «el español ya es la
diferencia». No lo es todavía: los nombres y el texto de los ataques
salen del catálogo occidental, que es INGLÉS; lo que está en español son
las etiquetas. Así que ahora hacen falta las dos cosas, engordada Y
jugada. Se indexan decenas de fichas en vez de miles, y es lo correcto
mientras no haya catálogo en español — cuando lo haya, se cambia en un
solo sitio.

**HAY UNA MIGRACIÓN QUE EJECUTAR**: `supabase-migration-cartas-juego.sql`.
Hasta entonces la tabla no existe, el bloque no sale y las fichas siguen
en `noindex` — nada se rompe, pero la tanda 325 no se ve.

**Ficheros**: NUEVOS `supabase-migration-cartas-juego.sql`,
`netlify/lib/juego-agregado.mjs`, `netlify/functions/cartas-juego.mjs`,
`js/normalizar.js`, `js/carta-ruta.js`. Tocados: `js/carta-nucleo.js`,
`js/carta.js`, `js/torneos/arquetipos.js`,
`js/torneos/cartas-decklist.js`, `netlify/edge-functions/meta-social.js`,
`netlify/functions/sitemap.mjs`, `css/carta.css`, `css/torneos.css`,
`carta.html`, las 25 páginas con pie, `SCHEMA.md`. En `pruebas`:
`test-tanda-325.mjs`, `test-tanda-326.mjs`, `rigor-tanda-325.py`,
`rigor-tanda-326.py` (NUEVOS), `test-tanda-324.mjs` puesto al día con el
listón nuevo, el doble con `tcg_card_play` y `correr-suite.sh` con las
tres pruebas nuevas.

**Dos cosas que salieron de refactorizar y conviene no repetir**: un
`export … from` reexporta pero NO crea el enlace local, y `arquetipos.js`
usaba la función por dentro (ReferenceError en cuanto se deducía un
arquetipo, cazado por la prueba a la primera). Y un módulo que PINTA no
se importa solo para enlazar: el barrido de CSS le habría colgado a
/torneo todas las clases de `css/carta.css`. Por eso existe
`js/carta-ruta.js`, donde no hay ni una etiqueta.

**Pruebas**: suite entera verde, **85 de 85**. Rigor 325: 13 de 13.
Rigor 326: 10 de 10.

**En curso / pendiente**: el catálogo EN ESPAÑOL, que es lo que desbloquea
el listón para las 23.000 fichas (nombres e imágenes vienen en el listado
del set: ~154 peticiones, no 16.000). Y sigue pendiente de PINGU
**reimportar el catálogo** —el set más nuevo es de 2025-10-30— y la
imagen del bloque `zonas` del curso de «Cómo se lee una carta».

---

## 2026-09-21 — PINGU-Claude (tanda 324 — las páginas de carta)

**Hecho**: la pantalla que faltaba del plan del catálogo. Tres
direcciones nuevas: `/carta/ceruledge-ex-sv5-36` (la ficha),
`/coleccion/sv5` (el set entero) y `/cartas` (el índice, con buscador y
lista de colecciones). Las tres se sirven desde el borde con su núcleo
ya pintado, así que un robot que no ejecuta JavaScript ve la página
entera.

**El molde se IMPORTA, no se copia.** `js/carta-nucleo.js` lo usan las
dos mitades porque la función del borde lo importa directamente — se
puede porque no toca el DOM y solo depende de `js/html.js`. Y el borde
deja `data-servidor="1"`, así que el cliente NO repinta: no hay relevo y
no hay salto, que es el problema conocido del texto de los artículos.

**El fallo que destapó el rigor**: el borde entregaba la ficha bien y, si
la consulta que hace el cliente después fallaba, el camino de error
borraba la página buena y ponía «Carta no encontrada» encima de algo que
se estaba leyendo. Un camino de error solo puede deshacer lo que hizo su
propio camino de éxito.

**Y el candado**: una ficha sin engordar nace en `noindex,follow`. Lo
decide `mereceIndexarse()` y solo ella; hoy el listón es `detalle_at`, y
sube ahí cuando entre el bloque de torneos. La colección SÍ se indexa —
doscientas cartas con su número y su imagen no es una página escasa, y
el borde le mete 60 enlaces internos en el documento.

**Ficheros**: NUEVOS `carta.html`, `coleccion.html`, `cartas.html`,
`js/carta-nucleo.js`, `js/carta.js`, `js/coleccion.js`, `js/cartas.js`,
`css/carta.css`. Tocados: `netlify/edge-functions/meta-social.js`,
`netlify.toml`, `SCHEMA.md`. En `pruebas`: `test-tanda-324.mjs` y
`rigor-tanda-324.py` (NUEVOS), y dos retoques — `test-tanda-311.mjs`
(los once colores de tipo son paleta de IDENTIDAD, como `COLORES_AVATAR`)
y `test-tanda-312.mjs` (el pie va ya en 25 páginas, no en 22).

**Pruebas**: suite entera verde (83 con la nueva) y rigor 16 de 16.

**OJO en este despliegue**: la función del borde importa por primera vez
un fichero de fuera de `netlify/edge-functions/`. Carga bien en Node,
pero si Netlify se quejara al empaquetar, el arreglo es volver el módulo
una copia vigilada — como `IDIOMA_POR_MERCADO`.

**En curso / pendiente**: la tanda siguiente es el BLOQUE DE TORNEOS de
la ficha (cuántos mazos la llevan, con qué arquetipos, qué tal le va),
que es lo que de verdad no tiene nadie más y lo que sube el listón del
`noindex`. Después, el sitemap y el español de los nombres. Y sigue
pendiente de PINGU **reimportar el catálogo**: el set más nuevo es de
2025-10-30.

---

## 2026-09-21 — PINGU-Claude (rigor de la 322 y la 323)

**Hecho**: pasados los dos. **322: 13 de 13. 323: 9 de 9.** Pero los dos
dejaron un escape en la primera vuelta, y los dos eran del andamio y de
mí, no del código:

**«ANCLA MALA (2 veces)»** en la 322. Mi ancla —la línea que saca el
idioma del mercado— aparecía DOS veces desde que añadí `urlDeSet`, y el
andamio se negó a mutar algo ambiguo en vez de tocar la que no era. Bien
hecho por su parte. Un ancla es única o no es un ancla: ahora lleva la
línea de debajo dentro.

**Una guarda redundante** en la 323. Quitar el descarte de duplicados
por nombre no cambiaba nada, porque `yaCuradas` ya impide que una mega
curada llegue a sintetizarse. Dos guardas cubriéndose — la lección de la
314. Se quitó la que sobraba (y el comentario ahora explica que la
prevención de duplicados es un EFECTO de comparar por especie, no una
comprobación aparte), y la mutación se sustituyó por una que sí se
observa: la sintetizada llegando con otro `tipo` que la curada.

**Ficheros**: `js/torneos/selector-mazo.js`. En `pruebas`:
`rigor-tanda-322.py`, `rigor-tanda-323.py` (NUEVO).

**En curso / pendiente**: la 324 (el español). El curso de «Cómo se lee
una carta» está escrito y entregado en el chat — su bloque `zonas` pide
una imagen que tiene que subir PINGU. Y sigue pendiente **reimportar el
catálogo**: el set más nuevo es de 2025-10-30.

---

## 2026-09-21 — PINGU-Claude (tanda 323 — las megas que no salían al registrar partidas)

**Hecho**: PINGU, desde la comunidad: «a la hora de registrar partidas
no sale Mega-Zeraora». La lista de megas de `FORMAS_TCG` se sondeó
contra la CDN el 2026-09-02 y lo posterior no está.

**Lo interesante es que el módulo YA sabía resolverla.** `dexDeClave`
(tanda 240) registra sola cualquier «Mega X» cuya X sea una especie:
número sintético, slug `x-mega` y respaldo a la base. Comprobado —
`dexDeCarta('Mega Zeraora ex')` da 20807 y el sprite sale. **El sprite
funcionaba desde el principio.** El único sitio que no usaba el
mecanismo era `buscarOpciones` en `selector-mazo.js`, que recorre listas
fijas; y como Zeraora SÍ está como especie, quien la tecleaba encontraba
el Pokémon a secas y se quedaba sin poder apuntar la partida.

Ahora, con «mega» y dos letras más, también se ofrecen las
sintetizadas. Dos límites para que no sea ruido: solo salen si las pides
por su nombre (existen 1.025 megas posibles y casi ninguna es carta), y
las especies con mega curada no se sintetizan **comparando por ESPECIE y
no por nombre** — Charizard y Mewtwo vienen en dos sabores, así que un
filtro por nombre dejaba pasar «Mega Charizard» a secas, que no existe, y
encima delante de las dos buenas por orden alfabético.

**La lección**: si añades un camino que resuelve algo sobre la marcha,
mira quién MÁS recorre la lista estática. El mecanismo llevaba desde la
240 y había un consumidor que no lo usaba — fallo sin error en ninguna
parte.

**Y de paso, dos hallazgos en el catálogo** (no arreglados aquí):

- **El catálogo lleva sin actualizarse desde el 2026-08-03** y su set más
  nuevo es «Mega Rising» (2025-10-30). Por eso Mega-Zeraora y
  Mega-Dragalge no están en `tcg_cards`. Afecta al editor de guías, a
  las imágenes de las decklists y a las futuras páginas de carta. PINGU
  tiene que reimportar el listado de sets y las cartas de los nuevos.
- **CORRECCIÓN a la entrada anterior**: dije que NINGÚN set tenía fecha y
  no es cierto. Los modernos la tienen. Aquella consulta solo enseñaba
  los sets YA PROCESADOS, que resultaban ser los sin fecha porque los
  NULL se ordenaban primero. Conclusión general sacada de una muestra
  sesgada. El arreglo de la fecha sigue siendo correcto y necesario —hay
  sets sin ella y se están curando—, pero la afirmación era más gorda de
  lo que sostenían los datos.

**Comprobado**: suite entera, 82 de 82 en verde.

**Ficheros**: `js/torneos/selector-mazo.js`, `CLAUDE.md`, `SCHEMA.md`.
En `pruebas`: `test-tanda-323.mjs` (NUEVO, 6 bloques).

**En curso / pendiente**: reimportar el catálogo. El rigor de la 322 y
el de la 323. La 324 (el español). Y el curso de «Cómo se lee una
carta».

---

## 2026-09-21 — PINGU-Claude (322: curar la fecha a la vez que engordar era circular)

**Hecho**: con el importador arreglado, las fechas EMPEZARON a aparecer
(Power Keepers 2007, Emerald 2005, Gym Heroes 2000) y el engorde seguía
yendo por lo viejo.

La cura estaba enganchada al engorde —curaba la fecha del set por el que
iba pasando— y eso es **circular**, porque la prioridad se calcula por
fecha: casi ninguno tenía, se curaba uno cualquiera, y ESE se ponía por
delante de todos los nulos. La función se quedaba dando vueltas a los
sets que ella misma había curado, que eran viejos por casualidad.

Ahora las fechas van en una **fase aparte** que se lleva las pasadas
enteras hasta acabarlas (~220 peticiones, menos de una hora, solo la
primera vez). El engorde no empieza hasta que no falta ninguna. Y hay un
segundo motivo que manda más: la ficha de una colección enseña cuándo
salió, así que la fecha hace falta aunque no se engorde ni una carta.

**La lección**: si un criterio de orden depende de un dato que todavía no
tienes, complétalo ANTES. Mientras falte, el orden no ordena — y si
además lo rellenas según ordenas, se muerde la cola.

**Ficheros**: `netlify/functions/cartas-detalle.mjs`, `CLAUDE.md`,
`SCHEMA.md`.

**En curso / pendiente**: la respuesta de la función ahora dice `fase`
(«fechas» o «cartas»). Durante la próxima hora dirá «fechas»; después
pasa sola a «cartas» y ya empezará por los sets modernos. Falta el rigor
de la 322 y la 323 (el español).

---

## 2026-09-21 — PINGU-Claude (322: la causa de verdad era que ningún set tenía fecha)

**Hecho**: el arreglo del orden en dos pasos **era correcto y no
arreglaba nada**. La segunda consulta de PINGU lo enseñó: Aquapolis,
Skyridge, Expedition, BREAKpoint, Flashfire… **los 220 sets tienen
`release_date` a null**. No era que las promos fueran primero: es que no
había nada por lo que ordenar.

**La causa estaba a dos líneas de algo que este repo ya sabía.** El
LISTADO de sets de TCGdex devuelve un SetResume, que trae id, nombre,
logo, símbolo y cuenta de cartas — y **ni el código de TCG Live ni la
fecha de salida**. `setToRow` corre sobre ese listado, así que las dos
columnas nacían vacías. Lo del código se descubrió en la tanda 233 y se
resolvió guardándolo al importar las CARTAS (que es cuando se tiene el
set completo en la mano); la fecha se quedó fuera de aquel arreglo y no
dio guerra hasta hoy. El comentario que lo explica está literalmente dos
líneas más abajo del sitio donde faltaba.

**Y no es solo el orden**: las páginas de carta y de colección que
diseñamos enseñan la fecha de salida. Sin esto saldrían vacías.

Tres piezas: `fechaDeSet()` exportada de `js/tcgdex.js`; `admin.js` la
guarda junto al código de TCG Live, con la misma guarda de «solo si
viene» (escribir null borraría lo que hubiera); y **la función
programada la cura sola** — al llegar a un set sin fecha la pide una vez
y la guarda, para no tener que reimportar 220 sets a mano. Si esa
petición falla no pasa nada: las cartas se engordan igual.

**Dos lecciones**:
- Un listado que devuelve un RESUMEN calla los campos que no trae, y una
  columna que nace vacía no da error: se descubre meses después, el día
  que alguien la usa. Este repo ya lo había pagado una vez.
- **Arreglar la primera causa que encuentras no es arreglar la causa.**
  Lo del `nullslast` de PostgREST era cierto, estaba mal, y el síntoma
  seguía igual.

**Comprobado**: suite entera, 81 de 81 en verde.

**Ficheros**: `js/tcgdex.js`, `admin/js/admin.js`,
`netlify/lib/carta-detalle.mjs`, `netlify/functions/cartas-detalle.mjs`,
`CLAUDE.md`, `SCHEMA.md`.

**En curso / pendiente**: ver que `release_date` empieza a rellenarse y
que el engorde pasa a sets modernos. Falta el rigor de la 322 (13
mutaciones, sin pasar desde los arreglos). Y la 323, el español.

---

## 2026-09-21 — PINGU-Claude (322: el orden del engorde salía al revés)

**Hecho**: la primera pasada real fue bien —206 cartas, 0 fallidas, y
confirmado que el mapeo es correcto (`attacks` trae `cost`/`name`/
`effect`, `hp` es número, `types` es array)—. Pero al preguntar de qué
SETS eran, salieron **todas de sets sin fecha**: promos de McDonald's de
2014 a 2024.

**La causa**: pedía `order=tcg_sets(release_date).desc.nullslast`, que es
ordenar por una columna de una tabla EMBEBIDA. **PostgREST acepta eso y
se come el `nullslast`**, sin dar error. Y Postgres pone los NULL
PRIMERO en un `DESC`, así que el catálogo se empezó a engordar **por lo
menos buscado que existe**, que es exactamente lo contrario de lo que el
código decía hacer.

Cero errores, todo verde, y haciendo lo contrario. Solo se vio mirando
de dónde eran las cartas ya hechas.

Ahora va en dos pasos: los sets se ordenan por su propia columna (ahí
`nullslast` sí funciona) y las cartas pendientes se buscan por ventanas
de 25 sets. Una o dos consultas más por pasada, y la prioridad pasa a
ser nuestra.

**De paso**: comprobado que `evolveFrom` es el nombre bueno — 14 de 22
evoluciones traen `evolve_from`; las 8 que no son promos, que llevan la
ficha más pobre.

**Ficheros**: `netlify/functions/cartas-detalle.mjs`, `CLAUDE.md`,
`SCHEMA.md`.

**En curso / pendiente**: ver que la siguiente pasada coge ya sets
modernos. Falta el rigor de la 322 (13 mutaciones escritas, sin pasar
desde el arreglo). Y la 323, el español.

---

## 2026-09-21 — PINGU-Claude (arreglo de la 322: la pasada no cabía en el tiempo)

**Hecho**: PINGU ejecutó el SQL y la comprobación dio 0 hechas, 0
fallidas, 22.723 totales — o sea, la función aún no había corrido. Al
revisarla apareció un fallo mío que habría salido en la primera pasada:

**Una función programada de Netlify se mata a los 30 segundos.** Yo puse
150 cartas por pasada con 350 ms de pausa, y cada carta cuesta además
una petición a TCGdex y un PATCH a Supabase: unos 600-700 ms. Son ~105
segundos. Se habría cortado a mitad en TODAS las pasadas, guardando unas
40 cartas y muriendo — sin error visible, solo una pasada que nunca
termina de hacer lo que dice.

Ahora son **40 por pasada cada cinco minutos**, y el bucle lleva su
propio presupuesto (22 s) para dejar de empezar cartas antes de que
Netlify lo mate. Lo que no da tiempo no se pierde: sigue con `detalle_at`
a null y lo coge la siguiente. La respuesta dice cuántas quedaron sin
tiempo.

De paso sale mejor la cuenta: 40 × 12 = **480 a la hora** frente a las
150 de antes, así que las 22.723 caen en un par de días en vez de una
semana.

**La lección, que es la de siempre en otra forma**: un número elegido
por lo que parece razonable —150, una vez por hora— es una afirmación
sobre un límite que nadie ha mirado. Igual que los puntos de corte de la
barra de arriba en la 320.

**Ficheros**: `netlify/functions/cartas-detalle.mjs`, `CLAUDE.md`,
`SCHEMA.md`.

**En curso / pendiente**: sigue pendiente ver la primera pasada de
verdad — que es lo único que confirma que la forma de la respuesta de
TCGdex es la que supuse. Y la 323 (el español) detrás.

---

## 2026-09-21 — PINGU-Claude (tanda 322 — las cartas, con datos para tener página propia)

**Hecho**: primera pieza de las páginas de carta, que es la apuesta de
tráfico que decidimos. `tcg_cards` solo guardaba nombre, imagen, número
y set — con eso una página de carta es un título y tres datos, y
publicar miles de páginas así **hunde el dominio entero** por contenido
escaso. Añadidas 17 columnas (PS, tipos, fase, ataques, habilidades,
debilidad, retirada, rareza, ilustrador, variantes…).

**Lo que hay que entender antes de tocar esto**: los campos estaban
vacíos POR UN COSTE, no por olvido, y está escrito en `js/tcgdex.js`
desde la 233. El listado de un set trae poco y lo demás exige UNA
PETICIÓN POR CARTA: ~23.000 contra un catálogo comunitario y gratuito,
frente a las ~220 de importar el catálogo entero. La tanda no elimina el
coste, lo REPARTE: función programada, 150 cartas por hora con pausa de
350 ms, ordenadas por fecha de salida del set (lo reciente es lo que se
juega y lo que se busca). El catálogo cae en una semana.

**Decisiones que están en el código**: lo que no viene se guarda como
`null` y nunca como cero o lista vacía —un Entrenador no tiene PS, y
`hp: 0` haría que la página afirmara que un Estadio tiene 0 PS—; los
números se validan o se tiran (las cartas viejas traen «70» o «70+», y
una cadena donde Postgres espera integer tumba la fila entera); y
`regulation_mark` SOLO se escribe si viene, porque ponerla a null
rompería la comprobación de reglamento de las decklists en silencio.

**Una copia vigilada**: `IDIOMA_POR_MERCADO` en `netlify/lib/` es copia
de `MERCADOS` en `js/tcgdex.js` (no se puede arrastrar ese fichero a
Netlify: importa `./supabase.js`). La prueba lee el original como TEXTO y
compara los dos mapas, para que no se separen.

**Comprobado**: `test-tanda-322.mjs`, 23 comprobaciones, sin red ni
base. ⚠️ Pero las respuestas de ejemplo están escritas con la forma que
DOCUMENTA TCGdex y **no se han verificado contra la API real** — el
contenedor no sale a internet. La prueba afirma que mapeamos bien lo que
creemos que llega. Por eso el error se guarda en la propia fila.

**Ficheros**: `supabase-migration-cartas-detalle.sql` (NUEVO — hay que
ejecutarlo), `netlify/lib/carta-detalle.mjs` (NUEVO),
`netlify/functions/cartas-detalle.mjs` (NUEVO), `js/tcgdex.js`
(`fetchCard`), `js/schema-check.js`. En `pruebas`:
`test-tanda-322.mjs` (NUEVO).

**En curso / pendiente**:
- **PINGU tiene que ejecutar el SQL** y dejar correr una pasada. Hasta
  entonces la función falla cada hora (y /admin lo canta).
- Falta el rigor de la 322.
- **Siguiente (323): el español.** Decidido inglés + español y nada más
  —diez idiomas serían 200.000 páginas casi vacías—. Y OJO: el idioma NO
  es un `market`. Los occidentales son UN catálogo traducido (el español
  comparte sus 154 identificadores de set con el inglés), así que va en
  una tabla de traducciones, no duplicando filas. Barato: nombre e
  imagen vienen en el LISTADO del set, ~154 peticiones, no 16.000.
- Sigue aparcada la **317 (`@layer`)**, que choca con la 320.
- Portada a **169,3 de 170 KB**.
- Apuntado: el **curso de «Cómo se lee una carta»**.

---

## 2026-09-21 — PINGU-Claude (el rigor de las 319, 320 y 321)

**Hecho**: pasados los tres rigores. El de la 321 salió a la primera
(12 de 12). Los otros dos dejaron TRES escapes, y los tres eran huecos
de MIS pruebas, no del código — los tres de la misma familia: la prueba
miraba que la pieza existiera, no que hiciera su trabajo.

1. **El valor por defecto no lo ejercitaba nadie.** Cambiar
   `progreso = null` a `{}` —que ES el fallo de la 316— no rompía nada,
   porque las dos pantallas que existen hoy pasan el dato siempre.
   Ahora la prueba monta la tarjeta SIN pasárselo y exige que no pinte
   barra; y con un mapa vacío exige que sí la pinte. Las dos mitades,
   porque una tarjeta que no pintara barra JAMÁS pasaría la primera.

2. **Un filtro por usuario no se prueba con un solo usuario.** Quitar
   el `.eq('user_id', …)` no cambiaba nada porque en la tabla de prueba
   solo había filas de `user-1`. Metidas tres de `user-2` que dicen lo
   contrario en las mismas guías.

3. **Ninguna prueba ABRÍA el menú.** El rigor quitó el `!important` del
   desplegable en el tramo donde los enlaces se apartan y todo siguió
   verde: había botón, se pulsaba y no pasaba nada. El bloque nuevo
   afirma el DESTINO y no el CSS — en cualquier ancho, o los enlaces
   están a la vista o se llega a ellos pulsando el botón.

**Y dos cosas que el rigor encontró en el CÓDIGO de la 321** (esas sí):
el registro de las FORMAS en la tabla de números de Pokédex era código
muerto —toda forma la intercepta antes el peldaño de la especie base—,
y el descarte de repetidos de la cadena era red de repuesto del tope del
bucle. Los dos fuera. Comprobado que las cinco formas que probé
(Ogerpon y sus máscaras, Ursaluna, las megas) siguen resolviendo igual.

**El susto**: el contenedor se reinició CON los rigores en marcha, que
es el escenario que deja un fichero roto en disco con pinta de estar
listo para subir. El log había llegado a `TODOS FIN` y
`comprobar-arbol.sh` dio limpio, así que no quedó nada a medias.

**Ficheros**: `js/torneos/sprites-pokemon.js`. En la rama `pruebas`:
`test-tanda-319.mjs`, `test-tanda-320.mjs`, `test-tanda-321.mjs`,
`rigor-tanda-321.py`.

**En curso / pendiente**: sigue aparcada la **tanda 317 (`@layer`)** en
la rama local `tanda-317-espera` — y OJO, movía 47 reglas de la barra de
arriba a `style.css`, que es justo lo que la 320 acaba de tocar: hay que
reconciliarlo a mano. Y el presupuesto de la portada está en **169,3 de
170**: menos de un kilobyte.

---

## 2026-09-20 — PINGU-Claude (tanda 321 — URGENTE: se cayó la CDN de los sprites)

**Hecho**: `r2.limitlesstcg.net`, de donde salen TODOS los minisprites
del sitio, dejó de responder. No un 404: un `ERR_CONNECTION_TIMED_OUT`,
confirmado por PINGU abriendo la URL a pelo en su navegador. Se veía en
/mis-partidas —los huecos reservados y nada dentro— pero le pasaba
igual a /torneo, al selector de mazo y a las decklists.

**El código hacía lo correcto**, y por eso el síntoma era ese: el
`onerror` esconde la imagen que no llega, porque un icono roto parece la
página estropeada. Lo que faltaba era a dónde ir: el respaldo que había
—de una FORMA a su ESPECIE BASE— pide las dos a la MISMA CDN, así que
cuando se cae la CDN entera no sirve de nada.

Ahora `respaldoDeSprite(url)` devuelve el SIGUIENTE sitio donde probar y
se recorre llamándola otra vez con lo que devuelve. Los dos manejadores
de `error` que ya existían (`cartas-decklist.js`, `selector-mazo.js`)
hacían ya `if (respaldo) img.src = respaldo`, así que heredaron la
cadena entera sin tocarles la lógica. La cadena: especie base en
Limitless → PokeAPI por jsDelivr → el mismo fichero desde GitHub →
esconder.

**Por qué los sprites por NÚMERO y no los iconos de caja**, que se
parecen más: los iconos se acaban en el 898 y dejan fuera toda la
novena generación, que es la que se juega. Comprobado: del 900 en
adelante, 404.

**Comprobado**: `test-tanda-321.mjs` en verde, 4 bloques. El que
importa mide en un navegador que con los dos primeros peldaños cortados
el sprite SE VE, y que sin ninguno se esconde.

**Ficheros**: `js/torneos/sprites-pokemon.js` (el grueso),
`js/mis-partidas.js`, `js/torneos/cartas-decklist.js`,
`js/torneos/selector-mazo.js` (comentarios que se habían quedado
viejos). En la rama `pruebas`: `test-tanda-321.mjs` (NUEVO).

**En curso / pendiente**: falta el rigor de la 321, además de los de la
319 y la 320. Y OJO: cuando Limitless vuelva, esto **no hay que
deshacerlo** — la cadena solo entra cuando el primero falla, así que en
condiciones normales no cambia nada.

---

## 2026-09-20 — PINGU-Claude (tandas 319 y 320 — la barra de progreso decía mentiras, y la barra de arriba se rompía)

**Hecho**: dos cosas que PINGU vio en su propia pantalla, las dos del
mismo tipo: una pieza que se comportaba bien en el caso para el que se
escribió y mal en el de al lado.

**319 — «Sin empezar» en guías ya leídas.** La tarjeta de guía unificada
de la 316 pinta una barra de progreso. En /aprender se le pasa el
progreso de quien mira; en la portada NO se le pasaba nada, y la tarjeta
tomaba el hueco por un cero: barra vacía y «Sin empezar» debajo de una
guía leída entera.

El arreglo es que `progreso` ahora distingue TRES estados y no dos:
`null` = no se sabe (no se pinta barra), `{}` = se sabe y no hay nada
(«Sin empezar»), y la fila = lo que ponga. La portada se trae el
progreso de las CUATRO guías que enseña (`.in`, no la tabla entera como
/aprender, que allí hace falta para filtrar por «sin leer»), y sin
sesión no pide nada y la tarjeta se queda sin barra.

**La lección**: una barra vacía por no saber AFIRMA algo falso. Cuando
un componente recibe un dato opcional, «no me lo han dado» y «me han
dado cero» tienen que poder distinguirse, o el valor por defecto acaba
mintiendo en la pantalla que no lo pasa.

**320 — la barra de arriba se amontonaba encima del logo.** Con un
torneo en juego aparece el chip amarillo, y a partir de ahí toda la
barra se iba a la izquierda y «PokeDoc» se apelotonaba sobre su icono.

Tres causas, las tres MEDIDAS con un barrido de anchos, no elegidas a
ojo:

1. `.nav-logo` es hijo de flex y por tanto **se encoge por defecto**:
   pasaba de 126 px a 44. El `min-width: 44px` que le puso la 312 no lo
   evita —ese es el mínimo de la caja, no del reparto—; lo evita
   `flex-shrink: 0`.
2. El corte de los enlaces estaba en 860 px y la barra pide **1.074**.
   Entre 860 y 1.073 no cabía, y en vez de desbordar, cedía el logo.
   Ahora el corte es 1.080, y con el chip puesto hacen falta 1.162, así
   que entre 1.080 y 1.179 los enlaces se van al desplegable (que ya
   existía y cabe de sobra).
3. El chip con el NOMBRE salía desde los 860 px, donde no cabe ni de
   lejos: pide 1.282. Se ha invertido la regla — manda el chip corto
   («Jugar») por defecto y el del nombre solo aparece por encima de
   1.340. Y el corte que esconde lupa y tema con el chip puesto sube de
   479 a 599, porque entre 480 y 549 la barra seguía saliéndose.

De paso, el nombre del torneo se cortaba a hachazo («Pachanga de
inauguraci»): `text-overflow: ellipsis` **no hace nada sobre un
contenedor flex**, el texto necesita su propia caja con `min-width: 0`.
Ahora va en un `<span class="nav-torneo-nombre">`.

**La lección**: un punto de corte elegido a ojo es una afirmación sobre
un ancho que nadie ha medido. Los tres estaban mal y los tres llevaban
meses así, porque el síntoma no era un desbordamiento —que canta— sino
un hijo de flex cediendo en silencio.

**Ficheros**: `js/guia-tarjeta.js`, `js/home.js` (319);
`css/style.css`, `js/torneos/aviso-torneo.js` (320).
En la rama `pruebas`: `test-tanda-319.mjs` (NUEVO, 3 bloques),
`test-tanda-320.mjs` (NUEVO, 4 bloques), `herramientas/correr-suite.sh`.

**En curso / pendiente**:
- Falta el rigor de la 319 y de la 320.
- **La tanda 317 (`@layer`) sigue aparcada** en la rama local
  `tanda-317-espera`. OJO al retomarla: movía 47 reglas de la barra de
  arriba a `style.css`, y la 320 acaba de tocar esas mismas reglas —
  hay que reconciliarlo a mano, no fusionarlo a lo bruto.
- Sin resolver: PINGU dice que en **/mis-partidas no salen los sprites**
  de los mazos. Descartado que sea el generador (con datos de prueba
  pinta las `<img>` con la URL correcta) y descartada la cadena de
  respaldo. El sospechoso es la CDN `r2.limitlesstcg.net`, que
  **no se puede comprobar desde el contenedor** (el proxy la bloquea con
  un 403 al CONNECT — eso es la jaula, no la CDN). Si se confirma, el
  arreglo es un segundo origen de respaldo en
  `js/torneos/sprites-pokemon.js` antes de esconder la imagen: hoy el
  `onerror` la esconde, y por eso el síntoma es «un hueco» en vez de un
  icono roto.

---

## 2026-09-20 — PINGU-Claude (tanda 318 — URGENTE: sets con número en la decklist)

**Hecho**: salió la colección del 30 aniversario, cuyo código de set
lleva un número, y **ninguna decklist que la incluyera se podía
guardar**: el editor decía «No se entiende la línea». PINGU lo pilló con
un torneo empezando.

La causa estaba en una sola línea de `js/torneos/motor.js`: el código de
set se leía con `[A-Z]{2,6}`, **solo letras**. Ahora es `[A-Z0-9]{2,6}`.

**Lo importante para la próxima**: traerse el set desde el panel de
administración NO arregla esto, y es lo primero que uno prueba. El
importador llena la base de CARTAS (el buscador del editor, los sprites)
y el parser de decklists **no consulta la base para nada** — solo mira la
FORMA de la línea. Las dos cosas nunca estuvieron enlazadas.

Ya pasaba antes con «151», pero no se notó porque TCG Live lo exporta
como `MEW`.

**Comprobado**: lista de 60 con `30C` y `M30C` mezclados con sets de
siempre → 60 cartas, cero errores. Y las cuatro formas que NO deben
colarse siguen sin colarse (nombre acabado en cifra sin set, set en
minúsculas, cabecera desconocida, set de 7 caracteres).
`test-decklist-idiomas.mjs` entero en verde.

**Ficheros**: `js/torneos/motor.js` (una línea y su comentario),
`BITACORA.md`.

**En curso / pendiente**: **la tanda 317 (`@layer`) está aparcada en la
rama local `tanda-317-espera`** — estaba commiteada sin pushear y con la
suite a medias, y NO la he arrastrado con esta urgencia. Hay que
retomarla: pasar la suite entera y el rigor antes de subirla.

---

## 2026-09-16 (5) — PINGU-Claude (tanda 316 — seis cosas que solo se ven mirando)

**Hecho**: PINGU preguntó si quedaban mejoras visuales. En vez de
opinar, se levantó el sitio con datos y se midió. Las seis que salieron
no estaban en el código, estaban en la pantalla:

1. **Una sola tarjeta de guía.** La portada y /aprender tenían DOS
   moldes para el mismo objeto, con cero clases en común. Ahora el
   molde es `js/guia-tarjeta.js` y lo usan las dos.
2. **En el móvil se lee de qué va cada tema.** Medido: al título le
   quedaban 160 px y los tres salían cortados. La cuenta de mensajes
   baja a su línea y el título se lleva el ancho (222 px, ninguno corta).
3. **La portada ya no cuenta lo mismo dos veces.** «Ahora en el foro» y
   «En la comunidad» traían los mismos tres temas y la misma noticia.
4. **«Tus primeros pasos», arriba en el móvil**: estaba en y = 2.401 de
   3.917 (el 61% hacia abajo). Ahora, en 715.
5. **Con uno o dos torneos la rejilla no guarda sitio vacío.**
6. **El buscador del foro** va en la fila del título y no encima.

Más `@container` en la tarjeta de guía y `text-wrap: balance` en los
títulos.

**Lo que enseñó hacerlo**: (a) `auto-fit` NO pliega una pista que alguien
CRUZA — las pestañas con `grid-column: 1 / -1` mantenían las tres pistas
«ocupadas», así que cambiar `auto-fill` por `auto-fit` no hacía nada;
(b) el caso de `@container` estaba medido delante: con la ventana en 960
la misma tarjeta mide 264 px en la portada y 432 en /aprender, y ningún
`@media` puede distinguirlos; (c) al mudar el CSS de la tarjeta a
components.css, `.guia-etiqueta` (gris) quedó DESPUÉS de `.rareza-*`
(bronce) con la misma especificidad y la rareza salía gris — la trampa
de la tanda 306, otra vez.

**Ficheros**: `js/guia-tarjeta.js` (NUEVO), `css/categoria.css` (NUEVO),
`js/home.js`, `js/aprender.js`, `js/torneos/torneos.js`,
`css/components.css`, `css/portada.css`, `css/aprender.css`,
`css/torneos.css`, `css/foro.css`, `css/style.css`, `css/comunidad.css`,
`css/editor-texto.css`, `index.html`, `foro.html`, `categoria.html`,
`SCHEMA.md`, `CLAUDE.md`. En la rama `pruebas`: `test-tanda-316.mjs` y
`rigor-tanda-316.py` (nuevos), y actualizadas `test-tanda-269`,
`288`, `289`, `297`, `299`, `300` y `torneos-15`.

**Peso**: se fue a 171,0 KB de 170 y se hizo sitio sacando de
components.css lo que usa una sola pantalla (la tarjeta ancha de guía a
`css/categoria.css`, el buscador de cartas y el emoji al editor, las
peticiones a comunidad). Quedan **168,1**.

**Lo que sacó la verificación**: la suite dio OCHO rojos y todos eran
míos. Cinco, pruebas escritas contra el marcado viejo (reescritas contra
la FORMA, y dos quedan más estrictas). Los otros tres, fallos de verdad
que cazó el barrido de la 299: `.link-btn` y `.foro-etiqueta` se habían
ido de `components.css` pegadas a la sección de al lado —y las usa media
web—, y sobre todo que **mover el CSS no bastaba: había que mover el
CÓDIGO**, porque el barrido sigue los imports y una página «usa» una
clase por importar el módulo que la pinta. De ahí dos módulos nuevos:
`js/tarjeta-guia-ancha.js` y `js/bloques-lectura.js`.

Del rigor, 17 de 18 a la primera; la que se escapó era justo la que me
había mordido a mí (la rareza pintada del gris de las etiquetas), y el
primer arreglo de la prueba tampoco valía — decía «no es gris» y hay que
decir «es SU color».

**Suite**: 77/77 en verde. **Rigor**: 18 mutaciones, todas detectadas.

**En curso / pendiente**: nada en curso. Queda apuntado que hay una
TERCERA tarjeta de guía —la fila compacta de /usuarios y /guardados—,
que no entra en la unificación porque es otra forma, pero que existe. Y
sigue pendiente de tu visto bueno la consolidación de los velos blancos
de la 315.

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

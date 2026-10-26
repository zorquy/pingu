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

## Cómo se le proponen cosas a PINGU

**Una propuesta va SIEMPRE con imágenes** (PINGU, 2026-10-18: «siempre que
te pida propuestas hazmelo con imágenes»): un artifact con las pantallas
dibujadas (maquetas de móvil y de PC con los colores de `css/style.css`),
las decisiones que se le piden y lo que entra en la tanda. Nunca solo
texto, por rápida que sea la propuesta.

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
  y un humano lo ejecuta en el SQL Editor. **Y en el SQL Editor cada sentencia puede
  ir por su lado** (tanda 631): una tabla TEMPORAL creada en una sentencia
  no existe en la siguiente («relation "tipos_629" does not exist»), y con
  `\i` en psql —la prueba— sí. Nada de tablas temporales entre sentencias:
  la lista va en un `(values …)` dentro de cada una, o todo en un `do`.
  Lo vigila `test-tanda-631.mjs`, que ejecuta la migración sentencia a
  sentencia, cada una en su conexión.
- **Netlify** despliega la rama `claude/react-native-web-migration-wl51z5`
  DIRECTAMENTE a producción. Cada push sale en vivo en minutos: no
  subas nada roto. Las funciones de servidor van en `netlify/functions/`
  (patrón inyectable, mira las que hay).
- **Presupuesto de peso**: la portada (index.html + su grafo de JS +
  CSS) debe caber en 170 KB gzip. **A 2026-10-14 (835) van 149,2 y quedan
  20,8** (la 835 metió 1,3 con los logros de los retos en `gamification.js`; a la 796 eran 147,9; de la 786 a la 796, 1,9 más; a la 785 eran 146,0: la 784 metió la píldora y los efectos, la 785 el escaparate; la 782 puso la cabecera común; la 781 metió el «Ver todo» y el vacío con abanico); la 780 mudó a SCHEMA los comentarios largos de `style.css`,
  `components.css`, `portada.css` e `index.html` (eran 65 de los 169 KB). Antes, a 2026-10-07 (753), 169,2 y quedaba
  0,8 (la 753 escribió la barra de abajo del móvil en el HTML y su sitio en
  `style.css`; antes, 168,4): la hoja «Tú» se fue a `js/menu-tu.js` + `css/menu-tu.css`, que
  entran al tocar el avatar, y luego volvieron dos décimas para que la
  lateral y «Hoy» tengan su sitio desde el primer pintado. Antes de la 748 iban 169,7
  (medido con `pesar-portada.mjs`; la 718 sacó de `components.css` el
  desplegable viejo de la lupa y bajó a 169,5, la 723 y la 734 se
  comieron tres décimas y la 736 las devolvió sacando el pintado de la
  campana a un `import()`: `notifications.js` lo baja la portada por
  `guide-rating.js`, así que lo que se pinta AL ABRIRLA no va ahí; la 737
  puso el anillo de foco a los campos, y la 744 la línea que llama a la
  portada «Hoy», que entra por `import()`). O sea: TRESCIENTOS BYTES. Una tanda que meta algo de verdad en la portada no cabe —tiene
  que empezar por hacer sitio—. Historia: el pie de
  la tanda 312 está en las 22 páginas y suma, la 313 sacó el editor de
  texto rico a `css/editor-texto.css` para hacer sitio, y la 319 le metió
  a la portada la consulta del progreso. El candidato para hacer sitio es
  `components.css` (26 KB gzip, el mayor de los que baja todo el mundo). Antes de meter nada más en la portada, haz sitio —
  `pesar-portada.mjs` dice quién ocupa qué— y el camino es siempre el
  mismo: lo que solo usa una pantalla, a su hoja. `components.css` y `js/app.js` los
  baja TODO el mundo — el CSS o JS de una sola página va en su propio
  fichero (mira css/lanzamientos.css o css/curso.css como ejemplo).
- **Lo de HOY de la portada, el bloque del foro y el índice del foro salen
  de UNA función cada uno** (tanda 1017, migración
  `supabase-migration-1017-portada-consultas.sql`): `portada_hoy()`
  (`datosDeHoy` en `js/hoy.js`, una vez por visita; la comparten el bloque
  de retos y los primeros pasos), `portada_foro(p_desde)` (`datosDelForo`
  en `portada-bloques.js`) y `foro_resumen()` (`resumenDelForo` en
  `foro.js`). Con sesión, eran 50 consultas en 6 olas. Si algo nuevo de la
  portada necesita un dato tuyo, va DENTRO de `portada_hoy` (con su regla
  copiada de donde estuviera y su prueba en `test-tanda-1017.mjs`), no en
  otra consulta suelta; y el camino de antes se queda detrás de
  `sinMigracion` (`js/sin-migracion.js`) hasta que PINGU ejecute la
  migración, sin una pantalla rota entre medias. Y lo que vale tu colección
  AHORA es `valor_de_copia` en la base, la misma función que suma la foto
  diaria: una cifra nueva de «lo que vale» no se suma por otro camino.
- **El buscador de cartas es UNO: `js/buscar-cartas.js`** (tanda 909).
  /cartas → Buscar y la barra de arriba (/buscar, la paleta) llaman a
  `buscarComoEnCartas`; la copia «con las mismas reglas» de /buscar tenía
  otro tope y otro orden (24 por orden alfabético) y el Zapdos ex de 151 no
  salía buscando «zapdos». Si una pantalla nueva busca cartas por lo que
  escribe alguien, pasa por ahí con sus columnas y sus filtros; no copies la
  consulta. Y /buscar NO pinta su propia lista de cartas (972): la chapa
  «Cartas» y `?en=cartas` llevan a `/cartas?ver=buscar&q=`; lo puro de
  arriba (expansiones que casan, el mejor resultado, las cuentas, «@») vive
  en `js/buscador-puro.js`.
  Los productos sellados, con `buscarProductos` (`js/productos-valor.js`,
  968): un `or` por palabra con su traducción (`terminosDeProducto`: «lata»
  es «tin»). Y desde fuera, un producto se abre en `/cartas?ver=productos&
  producto=<id>` (`rutaDeProducto`), que se ve sin cuenta. Lo que TCGGO no
  cuelga de ninguna expansión nuestra (su episodio 226, «Pokémon») entra por
  `EPISODIOS_SUELTOS` de `tcggo-productos` y sale en «Productos especiales».
- **En Jugar una carta se pinta como en Mi colección y se resuelve a una
  impresión CON ficha** (tanda 913). La foto: filas con `market` y
  `tcg_sets(serie_id,tcg_online_code)` (están en `COLUMNAS` del
  constructor) y `cadenaDeEscaneo(carta, código, calidad)` SIN inyectar
  `cardImageUrl`, que no deja pasar la foto de /admin ni monta la ruta de
  TCGdex a mano. Una pantalla nueva de Jugar que pinte cartas, igual. Y por
  nombre (`mejorPorNombre`): antes una impresión con categoría que una de
  TCGGO sin ficha (Prize Pack, 30 aniversario), y nunca una de TCG Pocket;
  lo que le falte a la que gane se copia de otra de la misma carta
  (`js/constructor/gemelas.js`), sin inventar: la original de un «129/162»
  o lo que todas dicen igual, y lo de jugar solo con los mismos PS.
- **La ficha de una carta es la de Dex** (tanda 915): carta arriba, versión
  con check, «− Tienes N +» (el «+» suma una IGUAL con Deshacer; otra
  distinta va por «Tus copias» → «Añadir otra copia») y los precios en
  tarjetas por idioma (`tarjetasDePrecio`). Si pintas un precio de carta
  en otra pantalla, usa esas tarjetas. Y `quienLaTiene` sin `todos` es la
  de los que SIGUES: «La quiero» lo dice así.
  En el móvil no lleva mando arriba (920): se cierra arrastrando y se pasa
  de carta de lado; lo que se desliza DENTRO de la ficha se desliza
  (`seDesplazaDeLado`), y las tarjetas de precio son los enlaces (sin botón).
  En el ordenador es un pop-up ANCHO y modal (921): no hay ficha «al lado»;
  la carta a la izquierda, los datos en dos columnas a la derecha. Una hoja
  que se abra DENTRO de la ficha en el móvil (versión, tus copias) lleva
  `data-sin-arrastre`, o el arrastre de hojas (804) cierra la ficha entera.
- **/carta y el pop-up enseñan una carta con LO MISMO** (tanda 998, PINGU:
  «cojamos solo un sitio»): las versiones son las chapas del precio y salen de
  `versionesDeCartas` (con las de a mano), la rareza de `rarezaCrudaDeCarta`
  con `rarity_en` pedida también en el SERVIDOR (`meta-social.js`), y no hay
  un segundo bloque de versiones debajo. Y una carta del buscador se abre en el
  pop-up: la lupa de arriba lleva a `/cartas?ver=buscar&q=…&carta=<id>`
  (`rutaDeCartaEnBuscar`); /carta queda para Google y para los enlaces.
- **Las versiones que se ofrecen son las que EXISTEN** (tanda 922): las que
  la carta dice y, si no dice, `variantesDeducidas` (set y rareza: el 30
  aniversario solo holo, la 1.ª edición solo en Wizards); las cuatro solo
  cuando de verdad no se sabe (`seSabenVariantes`), y avisándolo. Un camino
  nuevo para añadir pasa por `variantesDeCarta` y por la lista «¿Cuál
  tienes?» (`montarEleccion`); si ya se sabe la versión (una casilla de
  «Variantes»), se le pasa como `puesta` y no se pregunta.
- **La carta que brilla de serie es «Holo», no «Normal»** (tanda 950): lo
  dice la rareza (`brillaDeSerie`: las que brillan siempre, las Rare Holo y la
  Rare a secas desde SV en el occidental y desde Sol y Luna en el japonés), y
  una que brilla SIEMPRE no tiene Reverse. TCGdex a veces no escribe versiones
  (Lost Thunder) y su API da «normal + reverse» por defecto: no te fíes de eso
  contra la rareza. Un fixture con una SIR «normal + reverse» prueba una carta
  que no existe. La regla de la Rare mira el DÍA del set: una lista de
  columnas que embebe `tcg_sets` pide `release_date` (953). Una promo dice
  «Promo»: brilla por su NOMBRE (EX, GX, V, ex, ◇…), y una rareza que no está
  en el vocabulario, por sus palabras, sin traducirla (954).
- **Los idiomas de un set y las versiones de cada idioma se corrigen a
  mano en /admin** (tanda 956): `tcg_set_idiomas_mano` manda sobre lo
  calculado de la 911, y `tcg_version_idioma` dice qué versión NO salió en un
  idioma (Stormfront sin Reverse en español). Un camino nuevo para añadir una
  carta pasa sus versiones por `versionesDelIdioma` al cambiar de idioma, y un
  idioma que no tiene todo set (`nl`) va en `SOLO_SI_EL_SET_LO_DICE`.
  Y carta a carta (958): con `card_id`, una fila QUITA o PONE (el Duskull SH2,
  Holo en español y Reverse en lo demás, que TCGdex da solo Holo); por eso a
  `versionesDelIdioma` se le pasa el id de la carta, o lo suyo no llega.
- **En la era de Wizards las versiones son las EDICIONES** (tanda 935):
  filas `tcg_card_versions` con `origen = 'edicion'` (1.ª edición,
  Shadowless, Unlimited, sellos y errores con su clase), sacadas de los
  ficheros de tcgdex/cards-database —su API no lo dice— y metidas por la
  migración 935. Con ellas, `variantesDeCarta` ofrece solo esas (no hay
  «Holo» ni «Normal» suelta) y la de por defecto es la Unlimited. El precio
  de cada una llega por su producto de Cardmarket (`preciosDeEdiciones`).
  Una «tcggo-…» que repita el número de una de estas cartas es una edición
  que se coló: se funde, no se borra a secas.
  Y en el japonés antiguo igual (948): e-Card, PCG, VS y web, de los ficheros
  `data-asia` de TCGdex, casando el set por id, código o día y cuenta (nunca
  por nombre: los de TCGdex ahí están mal). Lo que TCGdex no tiene (DP y
  DPt japoneses) no entra.
- **Una versión que en Cardmarket es OTRO producto sale de TCGdex** (tanda
  945): las Poké Ball y Master Ball de Black Bolt, White Flare y Prismatic,
  y las Ball de Ascended Heroes, son filas `origen = 'tcgdex'` con su
  producto, metidas por la migración 945 desde tcgdex/cards-database (TCGGO
  a veces las da como otra carta y la pasada de precios no las casaba). Su
  etiqueta es la de TCGGO, para que no salgan dos; el precio llega por el
  producto, como el de las ediciones. Para otro set así, una entrada más en
  `herramientas/versiones-ball/leer.mjs` (rama `pruebas`) y otra migración.
- **Una carta repetida (misma colección, número y nombre) se convierte en
  VERSIÓN desde /admin → Colecciones → «Posibles repetidas»** (tanda 987): la
  Staff del Darmanitan SVP 181 que TCGGO trae como otra carta. Queda como fila
  `tcg_card_versions` con `origen = 'fundida'` (foto, producto y precio de la
  que era; `tcggo-precios` la sigue por su producto), las copias pasan con esa
  versión y la repetida deja lápida para su id y su `tcggo-<id>`. Una pasada
  nueva que escriba o borre versiones respeta `fundida` como respeta `mano`; y
  las reimpresiones de OTRA colección no son versiones: son cartas aparte.
  «Holo» y «Normal» también valen (987b: el Prize Pack trae las dos como dos
  cartas) y cuentan para completar; en el Prize Pack lo decide solo el precio
  (987c, `holoDelPrizePack`: la que vale 1,5 veces la otra es la Holo, y lo que
  brilla de serie o no tiene precio se queda para PINGU). Un origen nuevo de versión amplía
  `tcg_card_versions_origen_ok` en la MISMA migración, y el fixture de su
  prueba lleva esa regla (sin ella la 987 salió verde y falló en la base).
  Y las de TCGGO llevan SU número («SVP 205», no «205»): la lista agrupa con
  `catalogo_numero_de_repetida` (996), y lo que se junta MUDA sus versiones
  a la principal (antes se borraban).
- **Los idiomas que se ofrecen para una carta son los de SU set** (tanda
  911): `idiomas_de_set` (la base) suma los anuncios de Cardmarket y la
  ficha de TCGdex, porque ninguna basta: TCGdex se queda corto en sets
  viejos (Gym Heroes «solo en inglés») y Cardmarket no tiene columna de
  portugués. En la web, `idiomasDeSet` + `idiomasParaAnadirEn`; si no se
  sabe, se ofrecen todos. Un camino nuevo para añadir o apuntar una carta
  pasa por ahí; editar una copia lleva siempre su idioma (472).
- **Un nombre de clase COMPUESTO no lo ve ningún barrido** (tanda 498), y
  antes de mudar CSS hay que buscarlo A MANO. `js/medallero.js` escribe
  `class="medalla-chip medalla-${medalla}"`: de ahí se saca «medalla-chip»,
  pero **«medalla-oro» no existe en ninguna parte del código** —se arma en
  ejecución—, así que el barrido de `test-tanda-299.mjs` jura que es de
  /aprender y de nadie más. Y es falso: la pinta un ayudante compartido al
  que la PORTADA llega por `js/guide-card.js`, así que mudarla le habría
  quitado la chapa de medalla a las tarjetas de guía de la portada. Es el
  mismo susto que `.emoji-big` en la 491, y el patrón es siempre el mismo:
  **el barrido dice «esta clase es de una sola pantalla» y miente**. Desde
  la 498 el barrido apunta además el PREFIJO (`medalla-`) y perdona todo lo
  que empiece por él — marca de más, nunca de menos, que es lo que hace
  falta en una guarda: un falso negativo es CSS sin su hoja, un falso
  positivo solo es una clase que no se puede mudar. Pero la regla para
  quien muda es la de arriba: **greparla a mano en el JS**.
- **Un export que no existe no rompe una función: rompe LA PÁGINA** (tanda
  510). Añadí `rarezaDeCarta` a la lista de importación de `js/carta.js`
  dando por hecho que venía de `carta-traducciones.js` —que es de donde la
  coge `mi-coleccion.js`—, pero carta.js la pide por `carta-nucleo.js`, que
  no la reexportaba. Eso es un `SyntaxError` AL RESOLVER EL MÓDULO, así que
  /carta se quedó **sin una sola línea de JavaScript** y estuvo así en
  producción hora y media. Lo cazó la suite completa con seis rojos, todos
  el mismo error — y es otra vez la lección de la 447: había corrido las
  pruebas de rarezas y de /mi-coleccion, que son «las que tocaban», y
  /carta no estaba entre ellas. Desde ahora lo caza `test-imports.mjs` en
  un segundo y sin navegador: recorre los 249 módulos del repo y comprueba
  que cada una de las ~1.600 importaciones con nombre apunta a algo que de
  verdad se exporta. **Correrla antes de cada push cuesta un segundo y se
  come esta familia entera de fallos.**
- **Una reescritura de Netlify NO le pasa la consulta a una función v2**
  (tanda 633). `/escaneo/:set/:n → /.netlify/functions/escaneo?set=:set&n=:n`
  llega a la función con la URL ORIGINAL (`/escaneo/TWM/151`, sin `?`), así
  que `searchParams.get('set')` era null y /escaneo y /sprite contestaban
  404 a TODO en producción — Hassel sin foto al exportar, sin un error en
  la web porque la cadena de respaldos se lo comía. Una función que va
  detrás de una reescritura lee la RUTA (y la consulta, para llamarla a
  pelo).
- **Una carta sin `regulation_mark` no es ilegal: es de TCGGO** (tanda
  633). Las `tcggo-*` (el 30 aniversario) nacen sin letra, y el filtro de
  Estándar por marca las escondía — en el constructor solo salía el Mew ex
  de 151. Cuenta como legal la que no tiene letra y es de una colección
  igual o más nueva que la primera con la marca legal más vieja
  (`coleccionesRecientes`).
- **Un REEXPORT no es un IMPORT** (tanda 624). `export { normalizeSearch }
  from './texto.js'` deja que otros la importen de `js/tcgdex.js`, pero NO
  crea el nombre dentro de ese fichero — y `searchCards` la llamaba. Desde la
  447, cada búsqueda era un `ReferenceError` que el `try` de quien llama
  convertía en «no hay resultados»: el buscador de cartas del editor y el
  del selector de mazo llevaban semanas mudos. Si un fichero reexporta algo
  y además lo usa, lo IMPORTA también. `test-imports.mjs` lo vigila.
- **Un `select` del cliente que pide una columna NUEVA no se empuja antes
  que la migración que la crea** (tanda 624, por la 640). Una función de
  servidor puede «saltarse diciéndolo»; una consulta de la web que nombra
  una columna inexistente falla ENTERA (42703), y con ella el buscador del
  constructor, /mi-coleccion o las listas de torneos. O la migración va
  primero, o la columna no se pide hasta que exista.
- **No lances una suite mientras corre otra** (tanda 510). Las dos escriben
  en el mismo `suite.log` y las dos mueven el navegador, así que los
  números salen mezclados y no valen para nada — di «22 verdes, 0 rojos» de
  un log que estaban escribiendo dos pasadas a la vez. Y para pararla, por
  PID y nunca con `pkill -f`, que casa con el propio shell que lo lanza (la
  trampa de la 312 aplicada a procesos, y ya picó una vez). Pararla es
  seguro —no muta ficheros, no es un rigor— pero hay que pasar
  `comprobar-arbol.sh` igual.
- **Un aviso que no PARA no es un aviso** (tanda 510, y es la colisión
  número DIEZ). Mi guion de empujar hacía `git fetch` + `git log
  HEAD..origin`, imprimía los commits del otro… y empujaba igual. O sea que
  la colisión me pilló con el aviso delante, escrito por mí, diciéndomelo.
  La norma de la casa dice «mira el remoto justo antes del push» y yo lo
  miraba: lo que faltaba era **salirse** si hay algo. Si una comprobación no
  puede impedir lo que comprueba, es decoración.
- **La RLS no da error: devuelve una lista VACÍA** (tanda 510). La tabla de
  estado del relleno nació con RLS y sin políticas, que para escribir está
  bien —la escribe una función con la clave de servicio, que se la salta—
  pero el navegador leía cero filas, así que el panel decía «todavía no ha
  corrido ninguna vez» de algo que llevaba toda la noche corriendo. Es la
  familia de siempre: un vacío que se lee como una respuesta cuando en
  realidad es «no tienes permiso». Al añadir una tabla que vaya a leer el
  panel, la política de SELECT va en la misma migración — y mientras no
  esté, lo que se enseña es «no se sabe», no «no hay».
- **Un freno que pregunta «¿queda trabajo?» no frena si parte del trabajo
  es IMPOSIBLE** (tanda 510, y es la tercera vez en una noche con la misma
  forma). `scrydex-logos` iba cada hora con un freno que preguntaba «¿queda
  algún set sin emparejar?» — y **siempre quedan**, porque las promos no las
  cuenta igual ningún catálogo, así que la respuesta es «sí» para siempre y
  el freno no corta nunca: 3 créditos × 24 × 30 = **2.160 al mes, de 5.000**,
  para no cambiar nada. Pasó lo mismo con el barrido de las cartas (ahí hizo
  falta un tope de barridos) y con la página que falla siempre (ahí, saltarla
  a la quinta). La regla: cuando el trabajo pendiente nunca llega a cero, el
  freno no puede ser «¿queda algo?» — tiene que ser **cuántas veces se ha
  intentado** o **cada cuánto se vuelve a mirar**.
- **Una función programada que vuelve a empezar es una FACTURA** (tanda
  509). El relleno de Scrydex barría el catálogo —101 páginas, 101
  créditos— y al acabar volvía a la página 1. Cada cinco minutos. Eso son
  **48 barridos en una noche = 4.848 créditos, con 5.000 al MES**: se
  habría comido el plan entero antes de que nadie se despertara, y encima
  reescribiendo lo mismo. Lo cacé releyendo lo que acababa de poner en
  producción, no probándolo. Y frenarlo pide DOS cosas, porque una sola no
  basta: preguntar antes si queda algo por hacer —a nuestra base, que es
  gratis— **y** un tope de barridos, porque hay cartas nuestras que su
  catálogo no tiene y «quedan pendientes» sería verdad para siempre. Antes
  de poner un `schedule`, multiplica: coste por pasada × pasadas al día ×
  30. Si el resultado no cabe en el presupuesto, el `schedule` está mal.
- **Una columna que la base RELLENA y ninguna consulta PIDE no existe para
  la web** (tanda 523). La 509 puso el inglés exacto de Scrydex en
  `rarity_en` y la 510 le dio un traductor que la prefiere y cae a
  `rarity`. Las dos bien, y el resultado CERO: ningún `select` del cliente
  la pedía, así que el respaldo se usaba siempre y la Rainbow seguía
  rotulada «Rara Híper» con el dato bueno guardado. **Una columna que no se
  pide llega `undefined`, y `undefined || otra` es una expresión
  perfectamente válida**: no hay error que mirar, hay una pantalla que dice
  lo de antes. Al añadir una columna, el paso que se olvida es el `select` —
  y son todos los `select`, que de la rareza había OCHO. Lo vigila
  `test-tanda-523.mjs`: cualquier lista de columnas que nombre `rarity`
  tiene que nombrar `rarity_en`.
- **Un UPSERT tiene que poder FORMAR la fila que insertaría, aunque vaya a
  ser un update** (tanda 526, y costó una noche entera a cero). PostgREST
  manda `insert … on conflict do update`, y Postgres comprueba los
  `not null` sobre la fila que propone ANTES de ver que ya existe. El
  relleno mandaba `id`, `market`, `set_id` y las columnas de Scrydex, y
  `tcg_cards` tiene `local_id` y `name` a `not null`: **23502, y la
  sentencia rechazada ENTERA**, las 250 cartas de la página, aunque las 250
  fueran updates. Las dos columnas se REPITEN con el valor que la fila ya
  tiene; no es que se quieran cambiar, es que sin ellas no hay fila. Y la
  guarda no se escribe a mano: las obligatorias **se leen de la migración**
  y se exigen en TODAS las sentencias que se mandan —la de los nombres se
  arma a mano dentro de la función y tenía el mismo agujero, así que una
  prueba que mirara solo el ayudante puro habría salido verde—.
- **SALTAR vale para el fallo del OTRO; para el tuyo, PARAR** (tanda 526, y
  es la 522 corregida). Saltarse la página a la quinta es lo correcto cuando
  la mala es LA PÁGINA —un 500 suyo, un id raro—: el problema se queda
  atrás. Si el que falla es NUESTRO Supabase, la página no tiene nada que
  ver, y saltarla es pagar un crédito por página para no escribir nada:
  cinco intentos × 101 páginas = **505 créditos por un barrido en blanco**,
  con el panel enseñando «página 42» como si fuera progreso. Lo nuestro
  queda `parado` en el estado y la pasada siguiente **se sale antes de
  pedirle nada a la API de pago**. Y lo quita un humano: si se quitara solo,
  volvería a gastar sin que nadie haya mirado por qué fallaba.
- **Cuando una pasada GASTA antes de poder fallar, todo lo que venga
  después cuenta como intento** (tanda 522, y es la cuarta vez esta noche que
  un freno frena solo la mitad). `scrydex-relleno` pedía la página a Scrydex
  —crédito gastado— y luego preguntaba a nuestra base. El salto a la quinta
  página fallida existía, pero solo contaba los fallos SUYOS: si el que
  fallaba era nuestro Supabase, el error se escapaba de la función, la página
  no avanzaba y a los cinco minutos otra vez — **288 créditos al día sin
  escribir una carta**. El cuerpo entero va en `try/catch` y los dos lados
  pasan por el mismo `tropiezo()`. Antes de poner un freno, mira **dónde se
  paga** y cuenta desde ahí.
- **Un `return` que esconde tres finales distintos es un SILENCIO** (tanda
  510). `/cartas` tenía `if (error || !data?.length) return`, así que si la
  consulta fallaba la página se quedaba con el título «Colecciones» y un
  hueco debajo, sin un solo aviso — y es la página PÚBLICA del catálogo, la
  primera que ve quien llega de fuera. Son tres estados y cada uno dice una
  cosa distinta: **no se ha podido preguntar** (nuestro, se reintenta), **no
  hay nada** (raro, pero es una respuesta) y **hay pero el filtro no deja
  pasar ninguna** (un fallo del filtro). Juntarlos en un `return` convierte
  los tres en «la página está en blanco y no sabrás por qué».
- **Y la guarda de eso mira los NOMBRES, no los enlaces** (tanda 524, que
  es la misma lección por tercera vez). Un barrido recorre las páginas y los
  módulos, saca cada nombre entre comillas angulares de un texto de interfaz
  y exige que exista en otra pantalla. Encontró cuatro más: dos frases de
  Cambios mandando a la pestaña «Cartas» —fuera del menú desde la 447—,
  «Precio de compra» cuando el campo se llama «Lo que pagaste (€)», «la doy»
  cuando es «De esas, doy», y en /admin un «Contar mercados» que se rotula
  «Qué hay de cada mercado». Dos cosas que hacen que el barrido sirva:
  **un destino nombrado en un COMENTARIO no es un destino** (mi-coleccion.html
  explica en tres comentarios por qué «Cartas» salió del menú, y sin
  quitarlos el barrido da por bueno el fallo que busca), y **lo que no es un
  destino va declarado uno por uno** con su motivo — un ejemplo de aviso, un
  mazo de ejemplo, el veredicto de un informe.
- **Una frase que nombra una pestaña afirma que esa pestaña existe** (tanda
  510, y es la de la 447 con el tiempo en contra). El estado vacío de
  /mi-coleccion decía «añádelas desde “Añadir cartas”»… y esa pestaña **la
  borró la tanda 408**, que juntó los dos buscadores en uno. O sea que
  llevaba desde entonces mandando a la gente a un sitio que no existe, en
  la primera pantalla que ve quien se acaba de registrar. El texto no se
  rompe cuando su destino desaparece; un BOTÓN sí. Por eso los tres caminos
  son ahora botones que van: si el destino se borra, el botón se rompe y se
  ve. **Un camino escrito en prosa es un enlace que nadie comprueba.**
- **Una señal que no depende del IDIOMA puede seguir dependiendo del
  FABRICANTE** (tanda 508, y es el remate de la serie 504-508). La 506 puso
  el código del set a decidir, y en la primera escritura de verdad rechazó
  `ex7 → ex7`: **mismo id, mismo set** (*EX Team Rocket Returns*), con «RR»
  el nuestro y «TRR» el suyo. Los dos están bien — cada catálogo lo abrevia
  a su manera. La diferencia que importa: **los números de Pokédex son
  CANÓNICOS** (hay una sola Pokédex Nacional y la publica quien hace los
  juegos), mientras que **un código de TCG Live es una CONVENCIÓN**. Así que
  el código confirma —acertó 126 de 167— y no rechaza. Antes de poner una
  señal a rechazar, pregúntate si lo que compara lo publica UNA autoridad o
  lo escribe cada uno a su gusto.
- **El CERO es un valor, y `||` no lo sabe** (tanda 508). `filaDeSetConScrydex`
  decía «solo relleno lo que esté vacío» y lo escribí con `||`: en la primera
  escritura contra producción pisó el `card_count_official` de `mep`, que
  valía **0**. No hizo daño —`0` y `null` se pintan igual— pero la regla era
  no pisar y se pisó. Y «faltar» no significa lo mismo en un número que en un
  texto: para un número el cero es un valor, para un texto la cadena vacía no
  lo es. Son DOS reglas, así que viven en dos funciones con nombre
  (`rellenarNumero`, `rellenarTexto`) y no en la sutileza de un operador
  suelto en cada línea. Es pariente del `progreso = {}` de la 319: confundir
  «no me lo han dado» con «me han dado cero».
- **Emparejar PROPONE, verificar DISPONE** (tanda 508). De los 210 sets
  occidentales, 37 se quedaron sin pareja y los 37 por lo mismo: «ninguno
  suyo con esa fecha y esa cuenta». Eran todo promos, donde los dos
  catálogos cuentan distinto porque no hay un total oficial que contar. Y la
  salida estaba a la vista en el propio informe: **muchos de nuestros ids
  SON los suyos** (`base1 → base1`, `sm10 → sm10`, `ex7 → ex7`). Se puede
  proponer un par con una llave floja —el id, el código— **porque quien
  escribe lo vuelve a confirmar con una señal canónica**, así que una
  propuesta mala no llega a la base. Separar las dos mitades es lo que deja
  ser generoso emparejando sin ser temerario escribiendo.
- **Una señal que puede CONFIRMAR no siempre puede RECHAZAR, y hay que
  escribir cuál es cuál** (tanda 506, el final de la serie 504-505-506).
  Verificar los emparejamientos con Scrydex se intentó tres veces. Lo que lo
  resolvió fue tener delante su ficha de verdad (`cards/sm10-1`) y encontrar
  **cuatro señales que el idioma no puede engañar**: `expansion.code`
  («UNB», que es nuestro `tcg_online_code`), `national_pokedex_numbers`
  (nuestro `dex_ids`), `artist` (nuestro `illustrator`) y `hp`. Y la mejor
  no era la que yo iba buscando —el ilustrador—, sino el CÓDIGO DEL SET:
  porque la pregunta va sobre el SET y no sobre la carta, y viene gratis en
  la misma petición. Las señales van en dos clases y la diferencia es la
  norma: **DECIDEN** (confirman y rechazan) el código del set y la Pokédex,
  porque un código distinto o dos listas de Pokédex sin un número en común
  no se explican con una traducción; **CONFIRMAN SOLO** el ilustrador (los
  catálogos lo acreditan «Mitsuhiro Arita» o «Arita Mitsuhiro»), los PS
  (cientos de cartas comparten 260) y el nombre. Un falso negativo deja un
  par sin verificar; un falso positivo mete el logo de otro set en la base.
- **Dos guardas que se cubren una a otra no se pueden observar NINGUNA**
  (tanda 506, y es la de la 314 en su forma pura). La regla «el nombre no
  rechaza» estaba escrita dos veces: la señal devolvía «muda» cuando en
  realidad discrepaba, Y la política solo miraba las que deciden. Con las
  dos puestas, quitar cualquiera no cambiaba nada y el rigor lo apuntaba
  como «sin detectar» — tres mutaciones seguidas salieron así. Y de paso la
  señal MENTÍA, así que el informe no podía enseñar «el nombre discrepa pero
  el código confirma», que es información. La salida: **que cada señal diga
  lo que ve (`coincide`/`discrepa`/`muda`) y que decida UNO**, con un solo
  interruptor (`decide`). Entonces las tres mutaciones se cazan.
- **Un informe cuyas casillas no suman el total tiene un agujero, y nadie
  avisa** (tanda 506). El panel enseñó «160 confirmados + 2 sin comprobar»
  de 171 verificados: faltaban NUEVE y no salió ni un error. El navegador
  tenía el panel viejo en CACHÉ y leía un campo que la respuesta ya no
  traía, así que una casilla entera se perdió en silencio — y los números
  que quedaban eran creíbles. Desde la 506 la respuesta trae
  `cuadraLaCuenta` y el panel lo canta. Y la guarda vive en una función
  pura (`cuentaDelInforme`) por un motivo: **una guarda que solo se prueba
  cuando NO salta no se está probando** — ponerle `cuadra = true` a pelo
  pasaba desapercibido hasta que la prueba la llamó con los números reales
  de la pasada mala (171 contra 160+2).
- **El MISMO alfabeto en otro IDIOMA no lo detecta ninguna guarda** (tanda
  505), y es la trampa de la 483 un paso más allá. El verificador de la 504
  comparaba el nombre de una carta nuestra con el de Scrydex y llamaba
  «RECHAZADO» a lo que no coincidía. En la pasada real salieron OCHO
  rechazos, y **los ocho eran falsos**: nuestro `name` del catálogo
  occidental está en español en parte de las filas —«Pinsir de Eco» es
  *Ethan's Pinsir*, «Energía Planta» es *Basic Grass Energy*— y el suyo en
  inglés. SEIS de los ocho tenían el id IDÉNTICO (`sm10 → sm10`), o sea que
  eran el mismo set con toda seguridad. La guarda del alfabeto que había
  mira `CJK`, así que español contra inglés pasa de largo y sale un rechazo
  con toda la confianza del mundo. Dos lecciones: **un nombre que COINCIDE
  confirma, uno que NO coincide no concluye nada** —de ahí que el veredicto
  se llame «discrepan» y no «rechazado»—, y cuando hace falta saber de quién
  es la culpa, se busca una prueba LOCAL en vez de mirar más las dos cadenas:
  la migración de la 335 copió el español a `name_es`, así que una fila en la
  que `name` vale lo mismo que `name_es` lleva el español metido en `name` y
  la discrepancia es NUESTRA.
- **Un id ajeno se prueba TAL COMO ESTÁ antes de normalizarlo** (tanda 505).
  `numeroComparable` pasa a minúsculas y quita los ceros de delante, que es
  lo que hace falta para que nuestro «001» japonés case con su «1». Pero
  Scrydex guarda el número **tal como está impreso en la carta**, así que de
  los 171 pares TRECE contestaron 404 y los trece con la misma forma:
  `swsh12tg-tg1` donde la carta es la `TG01`, `xyp-xy1` donde es la `XY01`,
  `swshp-swsh1` donde es la `SWSH001`. Se prueban las dos formas y la
  literal PRIMERO, que es la que lleva la información completa.
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
- **Los COMENTARIOS DE CSS los baja TODO EL MUNDO** (tanda 489). Aquí no
  hay build step, así que un bloque de veinte líneas explicando el porqué en
  `style.css` o en `components.css` son bytes de la portada — y la portada
  lleva 0,1 KB de margen desde la 436. Me lo comí entero con los comentarios
  de UNA tanda: 169,9 → **170,5**, y la prueba de la 299 lo cantó. El porqué
  largo va a `SCHEMA.md`, que no se descarga; en la hoja se queda un renglón
  que apunta allí. Y lo mismo vale para un TOKEN: `--nav-alto` en `:root`,
  una línea, costaba el último décimo — si solo lo usa una pantalla, el
  número va en su hoja (lo de siempre, pero también para los tokens).
- **Una frase de la interfaz es una AFIRMACIÓN sobre lo que hace el
  código** (tanda 447). El estado vacío de /mi-coleccion → Buscar decía
  «busca por nombre, ilustrador o número» y ofrecía «Mitsuhiro Arita» y
  «Pikachu 25» como ejemplos que se pulsan; el buscador cruza contra
  `name_search`, que son los dos nombres y nada más, así que dos de las
  tres sugerencias daban CERO resultados. No salta ningún error: sale una
  pantalla vacía justo después de tocar lo que la web te ofrece. Si
  escribes un texto que promete algo, pruébalo — y si pones ejemplos que se
  pulsan, hay prueba que los pulsa todos.
- **El OCR en tiempo real de Dex no se puede hacer en una web** (tanda
  447), y conviene tenerlo escrito para no volver a intentarlo: Dex es una
  app NATIVA y usa el framework **Vision** de Apple (la lista de idiomas de
  su pantalla de escáner es literalmente la de Vision, que es cómo se
  sabe). El equivalente del navegador, la Shape Detection API, solo existe
  en Chrome tras una bandera y en Safari de iOS **dejó de funcionar en iOS
  18**; y una librería de OCR en el cliente son dos megas de WASM y una
  dependencia nueva de npm, que aquí está prohibida. Lo que sí se puede es
  el otro modo que Dex también tiene, el «Snap»: encuadras, tocas, y se
  leen **dos franjas** —nombre arriba, código abajo— en el servidor. Y se
  mandan las franjas y no la foto por dos motivos: una foto son dos o tres
  megas para leer cuatro palabras, y el dibujo de la carta es justo donde
  un OCR se inventa texto.
- **Los PRECIOS salen de TCGGO y el valor de una copia es el mínimo de
  SU idioma** (tandas 588 y 589). TCGGO (RapidAPI, clave `TCGGO_API_KEY`
  en Netlify, plan Ultra: 15.000 peticiones/día) da por carta el
  `cardmarket_id` bueno, el mínimo Near Mint de Cardmarket en cada idioma,
  TCGplayer en euros y las gradeadas; `tcggo-emparejar` (admin) decide los
  pares por código de set + número y `tcggo-precios` (cada 10 min) los
  precios. TCGdex se queda para el ESPAÑOL (nombres, textos, imágenes) y
  como respaldo de precio. El bloque de precio es UNO
  (`js/precio-vista.js`) para /carta y la ficha de /mi-coleccion. El plan
  es de pago por peticiones: cualquier función que llame a TCGGO cuenta
  cada petición, tiene tope diario y para en 429/403. Y desde la 640 **el
  catálogo también sale de TCGGO, solo**: `tcggo-catalogo` (cada semana)
  recorre sus expansiones occidentales y japonesas, conserva NUESTROS ids
  (son la llave de las colecciones y de las URLs) y crea lo que no tenemos
  (`tcggo-<id>`, `origen = 'tcggo'`, que TCGdex no visita). Nada se pulsa:
  `tcggo-emparejar-auto` casa los sets nuevos cada hora. **Scrydex ya no
  existe** (641): sus funciones y botones se fueron; quedan sus columnas
  con datos y `netlify/lib/scrydex.mjs`. **Desde la 809 no le pide NADA a
  Scrydex ninguna función programada** (PINGU dio de baja la suscripción):
  `scrydex-huecos` retirada, `tcggo-sueltas` sin su camino. No lo vuelvas a
  meter como respaldo. **La única excepción es `scrydex-decks-jp`** (883,
  PINGU: «mete de Scrydex, que sigue activa la sub este mes»): trae SOLO
  lo japonés que TCGGO no tiene (los decks), con tope de créditos y
  parada definitiva al primer 401/402/403; lo que enseña o crea queda en
  `conservados` y el calco no lo esconde. Y lo que NINGUNA API tiene va
  a mano en `decks-jp-a-mano` (884): una lista escrita (número, nombre
  japonés e inglés, de qué occidental se copia la ficha), sin foto
  inventada; TCGdex se puede mirar fichero a fichero clonando
  `tcgdex/cards-database` (`data-asia/`), que raw.githubusercontent.com
  sí se alcanza desde el contenedor. **Y lo que TCGGO LISTA A MEDIAS**
  (886: de VSTAR Universe solo da las 173–262) se completa de Scrydex con
  `scrydex-rellenar-set` (lista `RELLENOS`, una vez por entrada, solo las
  que faltan por NÚMERO, `origen = 'relleno'`, que el reemplazo nunca
  borra). Para otro set a medias, una entrada más en `RELLENOS`. Y si lo que
  falta SÍ lo tiene TCGGO (las promos que crecen, 1000), una entrada en
  `REEMPLAZOS` de `tcggo-reemplazar-set` con `conservarPorNumero`,
  `sinBorrar` y `numeroComoElNuestro`, como `mep-promos`. Y una
  clave de estado nueva va en `PASADAS` (`admin/js/semaforo.js`), que es
  la lista que /admin LEE: la 883 y la 884 escribieron su bloque sin
  meterla y el panel decía «todavía no ha corrido» de algo que corría.
  **Desde la 806 el japonés sale ENTERO de TCGGO** (`tcggo-calco-jp`,
  vuelta 2): ni espejo occidental ni Scrydex ni TCGdex escriben en él. Y
  TCGGO da cada VERSIÓN de una carta como otra entrada con el mismo número
  y el mismo `cardmarket_id`: lo que lea cartas suyas pasa por
  `separarVersiones` (una carta, la principal), o duplica cartas y mezcla
  precios. Y su `name` japonés va EN JAPONÉS (811): el inglés sale de
  `nombreInglesDe` (un campo no CJK o el `slug`), nunca de copiar `name`. **La numeración de tandas de
  esta sesión va desde la 640** (590–596 y 620–623 son de la otra).
- **Lo corregido a mano en el catálogo se apunta en `tcg_correcciones` y
  un disparador lo repone encima de cualquier escritura** (tanda 885).
  Desde /admin → Colecciones se edita un set y, con «Ver y editar sus
  cartas», cada carta (foto, impresiones, ids de Cardmarket, todo); se
  guarda por `catalogo_corregir` y SOLO las columnas que cambian, que una
  corrección sobre una columna sin tocar la clava para siempre. No lo
  «arregles» con un `update` directo desde el panel: duraría hasta la
  siguiente pasada. Una foto a mano es una dirección entera en
  `image_path` (`urlDeImagen` la deja pasar); un logo a mano va en
  `logo_tcggo` y `logo_scrydex`. Lo creado a mano nace con `origen =
  'mano'`: el calco japonés no lo esconde (`sinConservados` lleva
  `or=(origen.is.null,origen.neq.mano)` — como `or`, que un `neq` contra
  NULL no es verdadero) y los reemplazos no lo borran. Si añades una
  pasada que esconda o borre del catálogo, que respete las dos cosas.
- **Lo que se publica en las redes sale de la base por una función
  programada con la forma de `telegram-noticias`, y las claves de cada
  red viven en Netlify** (tanda 902). X: `netlify/lib/x.mjs` firma OAuth
  1.0a a mano (probada contra el ejemplo oficial; `node:crypto`, sin
  dependencias), `x-noticias` cada cinco minutos marca `x_sent_at` ANTES
  de seguir, y un 401/402/403 PARA (`scrydex_estado.x_noticias.parado`,
  que /admin enseña y quita): reintentar con las mismas claves cada cinco
  minutos es pagar por insistir en el plan de pago por uso. El texto es el
  del botón «Compartir en X» (`js/compartir-x.js`): la cuenta y la gente
  comparten lo mismo. No se sube imagen: X pinta la tarjeta con las
  etiquetas `twitter:card` de la página (y `twitter:site` desde la 902,
  en el HTML, en `generar-cartas.mjs` y en `meta-social.js`, que
  sustituye ese bloque). Una red nueva (Instagram, 903) sigue el mismo
  patrón: su `lib`, su función, su columna `*_sent_at`, su clave en
  `PASADAS` y su botón de /admin que enseña el error tal cual.
- **Un campo del catálogo que falta no es un NO** (tanda 901). Un Kakuna
  sin `evolve_from` hacía que el laboratorio dijera «no tienes en juego
  nada de lo que evolucione Kakuna» con dos Weedle delante: `evolucionaDe`
  contestaba `false` a lo que era «no se sabe». Ahora contesta `null` y
  quien pregunta decide (el menú de la mano ofrece y lo dice; una búsqueda
  automática lo trata como no), y `detallesDeJuego` rellena el dato desde
  otra impresión del mismo nombre. Es la 319 en el motor: si una regla
  lee una columna que el engorde puede no haber visitado, pregúntate qué
  hace con el vacío, y que no sea bloquear la partida.
- **Un precio que se ENSEÑA es el de la ficha** (tanda 900): el mínimo de
  Cardmarket en el IDIOMA de la copia (`valorDe(precioDeFila(fila),
  idioma)`), nunca `cm_low` a secas, que es el mínimo entre todos los
  idiomas y en una carta española puede ser la italiana. La pestaña
  Cambios del perfil lo pintó así tres días y dos personas lo vieron. Si
  pintas un precio en una pantalla nueva, pide la fila entera y pasa por
  `valorDe`; dos pantallas con dos números para la misma carta no dan error.
  Y el idioma que se enseña es uno en que el SET salió (959,
  `idiomaDePrecioDelSet`): Dark Explorers no salió en español y un anuncio
  mal catalogado le daba «ES · tu idioma · 0,02 €». La de tu copia, sí.
- **El cuadro de responder del foro es un editor COMPACTO que crece al
  tener el foco** (tanda 899): en una prueba, pulsar «Responder» sin haber
  tocado el cuadro lo enfoca con el `mousedown`, el editor crece y el botón
  se va de debajo del ratón, así que el clic cae en el formulario y no
  envía nada. Se escribe como la gente: enfocar el cuadro primero.
  Y la caja de un tema se queda ABIERTA (`.abierta`) hasta un clic fuera
  (964): con `:focus-within` a secas, en el iPhone tocar «Imagen» le quitaba
  el foco, la barra se escondía bajo el dedo y la galería no se abría.
- **Un cambio entre dos personas es una PROPUESTA** (tanda 942): las cartas
  de cada lado (la copia concreta, con su línea), el dinero APUNTADO (quién,
  cuánto y cómo; PokeDoc no cobra ni comprueba) y su estado. Todo pasa por
  las funciones de `supabase-migration-942-propuestas-cambio.sql`; al
  cerrarse, `cambio_mover` mueve las líneas y lo apunta para deshacerlo un
  día. Un camino nuevo para proponer llama a `abrirPropuesta`
  (`js/cambio-propuesta.js`); lo que mueva o reserve cartas de un cambio
  respeta `cambio_reservadas_linea`.
- **Una carta pintada en cualquier pantalla lleva sus marcas** (tanda 943,
  PINGU: «debería estar en todos los lados de la web»): el ✓ de «la tienes»
  y el corazón de «La quiero». Dentro de /mi-coleccion, con
  `marcaDeTengoHtml` + `quieroHtml`, y la vista entra en
  `VISTAS_CON_CORAZON` para que el corazón puesto desde la ficha salga sin
  recargar. Fuera, `data-marca-carta` en la caja de la foto y
  `marcarCartas(raíz)` de `js/marcas-carta.js` (por `import()`), que solo
  pregunta por las cartas que hay en pantalla.
- **Un botón que escribe en la base cambia YA, confirma después y deshace
  si falla** (tanda 896, R6): el patrón de «Seguir» un hilo, aplicado a
  marcar leído, guardar una guía, «La quiero», el check-in y meter en un
  álbum. No se apaga a esperar: se pinta como queda, y si la base dice que
  no, se vuelve (o se recarga, cuando el estado de verdad es la página
  entera) con su aviso. Un botón nuevo que escriba algo va así.
- **Un bloque de pantalla que no usa todo el mundo va en su módulo y
  entra por `import()`** (tanda 895, R4): el Panel y los deseos de Mi
  colección (`js/mi-coleccion/panel.js`, `deseos.js`) y el editor del
  torneo (`js/torneos/torneo-editor.js`). El estado se comparte por un
  `ctx` con GETTERS Y SETTERS (nunca por copia: cambia a cada momento) y
  las funciones del módulo que la pantalla llama siguen en el principal
  como puentes (`panelMod ? panelMod.f(...a) : panel().then(…)`). Lo que
  otros necesitan síncrono con su valor se queda en el principal. Al mudar
  código, las rutas de `import()` cambian de carpeta, y lo que la pantalla
  pinta sola por otro camino (la estantería desde `cambiarPestania`) no
  puede llegar con el esqueleto puesto o salta. Pasa `libres.mjs` (los
  identificadores libres, SCHEMA 895) a cada módulo nuevo: un `...pTodo()`
  se le escapa a cualquier regex.
- **Una lista que se abre cada día se pinta primero con lo de la última
  vez** (tanda 894, R2; una pantalla de varios bloques, con `vistaVigilada`,
  984): `js/ultima-vista.js` guarda por id el HTML de unos
  huecos y lo pinta al volver con el punto `html.uv-actualizando` hasta que
  llega lo nuevo. Si añades una pantalla de lista, pásala por ahí: la clave
  lleva a QUIEN mira (o `anon`), se guarda DESPUÉS de pintar de verdad
  (nunca el estado vacío de antes de cargar) y lo pintado desde la caché
  no tiene manejadores propios hasta que se sustituye. Y al salir de la
  cuenta se olvidan todas (`signOut`).
- **Las cabeceras de las páginas de LISTA en el móvil son una línea**
  (tanda 893, I1 de «Rápida y limpia»): la cabecera lleva `cab-lista`, el
  párrafo `cab-lema` y un trozo de texto que en el móvil sobra, `cab-largo`
  (las tres en `movil.css`, que solo baja el móvil; el PC no cambia). Una
  página de lista nueva lleva lo mismo, y su botón principal a la derecha
  del título, no debajo. Si un control tiene que cambiar de sitio según el
  ancho, se MUEVE el elemento de verdad (con sus manejadores), como el
  select del catálogo en /cartas o los botones de /mis-partidas; no se
  duplica. Y antes de nombrar una clase nueva, grepa el nombre en la hoja
  de esa página: `partidas-fila` ya era la fila de una partida —con su
  borde— y la fila de mandos la pisó sin un solo error (de ahí
  `partidas-mandos`).
- **Lo que una página ESCRIBE al abrirse no puede pasar si Chrome solo la
  está preparando** (tanda 985): desde la 985 las listas de `PREPARABLES`
  (`js/precarga.js`) se preparan enteras al tocar su enlace, y una preparada
  que no se abre no debe contar una visita ni gastar nada. El freno está en el
  `fetch` del cliente de Supabase (`js/espera-prerender.js`: lo que no es GET
  espera a `prerenderingchange`); lo que escriba por otro camino (una función
  de Netlify por POST, una petición de pago como el histórico de TCGGO) no
  está cubierto, y su página no va en `PREPARABLES`.
- **Un enlace que navega enseña que navega en el mismo instante** (tanda
  892, R1 de la propuesta «Rápida y limpia»): `js/progreso.js` (por
  `import()` desde app.js) pone la barra de 3 px arriba y atenúa
  `.page-content` al hacer clic en un enlace de la casa que navega (en
  BURBUJA, para que `defaultPrevented` diga la verdad) o al enviar un
  formulario; `style.css` da a `a[class]`, `button` y `[role=button]` su
  `:active`. Un botón nuevo que hace algo SIN navegar (un `fetch`, una
  hoja) no lo cubre: lleva su propio estado de «haciendo» (896). Y para
  probar lo que pasa MIENTRAS llega una página hay que retrasarla con
  `route` y callar tres cosas que se la saltan: el Service Worker
  (`serviceWorkers: 'block'`), la precarga (`navigator.connection.saveData`)
  y el propio `click` de Playwright (`noWaitAfter`); con la navegación
  pendiente `evaluate` no contesta, así que lo apunta la página y lo manda
  con `exposeFunction`. Y `mouse.up` encima de un enlace es un clic.
- **El perfil tiene la pestaña «Cambios»** (tanda 887, pedida por
  soyfedeegb en el foro): lo que da y lo que busca una persona, con
  vuestro cruce arriba y la chapa «Cambia · da N · busca M» en la
  cabecera. Lo que da sale de `intercambios_de_persona` (migración 887,
  security definer: solo lo que se enseña); lo que busca, de `user_wants`.
  Una pestaña del perfil que llega tarde y puede no tener nada pasa por
  `pestaniaLista(nombre, visible)` (perfil-pestanias.js), no por tocar
  `hidden` a mano; «Su perfil» desde el Mercado y Cruces abre
  `?ver=cambios`.
- **Las fotos de los mensajes privados van en un cubo PRIVADO y se piden
  FIRMADAS** (tanda 891). `mensajes-adjuntos` no es público: una carpeta
  por conversación y `mensajes_adjunto_es_mio(name)` en las tres políticas;
  el navegador pide `createSignedUrls` (`js/mensajes-adjuntos.js`, con
  caché) y nunca `getPublicUrl`. Lo que se sube se comprime antes en el
  navegador (`js/imagen-comprimir.js`, 1.600 px y WebP) — si añades otra
  subida de fotos de la gente, pasa por ahí. Borrar un mensaje es marcar
  `deleted_at` («Mensaje eliminado»), no quitar la fila; y lo puro del chat
  (días, visto, no leídos, resumen) vive en `js/mensajes-puro.js`.
- **Un valor TRADUCIDO no es una CLAVE de CSS** (tanda 889). La barra de
  /meta escribía `types[0]` de `tcg_cards` en `data-tipo`, y la hoja solo
  tiene regla para «Darkness»: el catálogo guarda «Oscura» (lo engordado en
  español desde la 330), `--tipo-energia` quedaba sin definir y el relleno
  salía TRANSPARENTE, sin error. Un `data-*` que elige una regla lleva el
  valor canónico (`canonizarCarta`) y pasa por la lista de los que tienen
  regla (`TIPOS_CON_BARRA`); lo que no está en la lista no se escribe.
- **Lo que solo baja el MÓVIL entra por `import()` y con su hoja
  inyectada** (tanda 704). La barra inferior (`js/barra-movil.js` +
  `css/movil.css`) se carga desde app.js solo si la pantalla es de móvil,
  y el módulo mete su `<link>`: el escritorio no descarga ni un byte, que
  es lo que mide el presupuesto de la portada. La prueba 299 reconoce el
  marcador `hojaInyectada('css/x.css')` para dar la hoja por cargada;
  si inyectas otra, usa esa función con el literal. Y la navegación del
  móvil son tres niveles: ABAJO la sección (fija, igual en todas las
  páginas), las páginas de la sección en una BURBUJA flotante encima de la
  barra (la de Mi colección, 452, para todas: icono y palabra,
  deslizable; se leen de los desplegables de la barra, no hay segunda
  lista; arriba no va NADA, PINGU: «demasiado espacio»; ni hamburguesa
  ni doble toque, PINGU los descartó), y dentro lo de cada página. La
  burbuja sale solo en las páginas de la lista de la sección, no en una
  ficha; en Mi colección las ajenas van al final de la suya. Una página de detalle dice de qué sección es en
  `SECCION_DE`.
- **La estantería de sets sale de la CDN** (tanda 813): `setsDelCatalogo`
  (`js/sets-catalogo.js`) pide `/.netlify/functions/sets` y cae a Supabase.
  Esa copia lleva la etiqueta `sets` y lo que la cambie desde /admin la
  tira con `sets-purgar` (908): si añades otra escritura de sets o eras en
  el panel, que llame a `avisarALaWeb()`, o la web lo enseñará tarde. Y
  una era o un campo que reescribe una pasada (`serie_id`) se guarda como
  corrección, nunca a pelo.
  Una columna nueva de la estantería va en LOS DOS (`COLUMNAS`), y lo que lea
  `todosLosSets` al abrir una pantalla por su dirección tiene que esperar a
  `cargarSets()`: ahora llega más tarde (la 748 lo cazó). Y el semáforo de
  /admin (`admin/js/semaforo.js`, 817) es la lista de claves de estado de
  TCGGO: una pasada nueva va en `PASADAS`.
- **Cada cambio que se NOTA lleva su línea en `novedades.json`** (tanda
  829, /novedades). PINGU llevaba el registro de cambios a mano en un hilo
  del foro; ahora lo escribe quien sube el cambio, en el mismo push que la
  bitácora. Una frase para quien usa la web —nada técnico: ni tandas ni
  nombres de función—, su tipo (`nuevo`, `mejora`, `arreglo`) y, si se
  puede, un `enlace` a donde probarlo (que exista: lo comprueba
  `test-tanda-829-pantalla.mjs`). Lo interno que nadie nota no va. Y cada
  mes, tres `destacadas` con su `dibujo` (los de `js/novedades.js`) —las
  elige quien escribe; si PINGU prefiere otras, se cambian—. La bitácora
  sigue siendo para nosotros; esto es para la gente.
- **La imagen que se comparte de un reto lleva siempre el marco** (tanda
  907): la marca y el número arriba, qué es (`lema`), la invitación con
  su enlace y la medalla y la racha (`pintarResultadoReto`), y la foto
  TAPADA (924: desenfocada y con «?», que es la respuesta; ni su nombre en
  `detalle`). Un reto nuevo
  le pasa su `numero` y su `lema`, no un «Reto #N» en el detalle. Lo que
  sale de las preguntas del día (la portada, la chapa) dice el TEMA y no
  el enunciado: el reto es el mismo para todos y no se destripa.
- **Un reto acaba con tres salidas y se puede jugar otra vez** (tanda 988):
  `salidasHtml` (retos-ui.js) pinta el siguiente, Compartir y «Jugar otra
  vez»; la partida libre es `?libre=N` (`js/retos-libre.js`), se juega como
  el día `diaLibre(N)` y va en su llave (`claveLibre`): no guarda en la base,
  no suma racha, no se comparte y avisa de que no da XP. Un reto nuevo pasa
  por las dos cosas, y su función de Netlify, con `libre`, no toca la tabla
  del día. Y la hoja de compartir es Instagram (Historia 1080×1920 y
  Publicación) y X, sin pestaña de texto: una pantalla le da la vertical de
  1080×1350 y la apaisada, y la historia la monta la hoja (`historiaDe`).
- **«¿Quién es ese Pokémon?» se aclara con cada fallo** (tanda 991): el
  primer intento va borroso (`data-intento` en la escena y su `blur` en
  `css/quien-es.css`), el segundo menos y el tercero es la silueta nítida; la
  XP es +30/+20/+10, en `retos-xp.js` y en `retos_xp` (migración 991, que
  redefine la de la 989 entera). Y /admin → Redes se fue (PINGU: «no sirve
  de nada»): la cuenta de PokeDoc no saca imágenes del reto desde el panel.
- **Un aviso del foro llega UNA vez** (tanda 993): la web avisa al autor, a
  los citados y a los mencionados, y a `forum_avisar_suscritos` le pasa esos
  mismos en `p_ya_avisados`, que se salta (el autor está suscrito solo). Un
  camino nuevo que avise de una respuesta hace lo mismo. Y los push dejan
  rastro: `enviar-push` escribe `scrydex_estado.enviar_push` (en `PASADAS`) y
  /ajustes tiene «Enviarme un aviso de prueba» (`push-prueba`), que dice el
  motivo tal cual cuando no sale. En el móvil se INVITA a activarlos (994,
  `js/invitar-push.js`): activarlos solo no se puede, el permiso lo pide un
  toque, y en ese toque lo primero es la pregunta del sistema.
- **El paginador del foro es UNO: `js/paginacion.js`** (tanda 990), para la
  lista de temas y un tema largo: «Anterior», páginas con «…» y «Siguiente»,
  y en el móvil cinco casillas sin texto. Antes eran `.page-btn` sin una
  sola regla de CSS. Una lista nueva con páginas pasa por ahí, y va ARRIBA Y
  ABAJO (995, PINGU: «en otros foros siempre está arriba y abajo»): el de
  arriba con `{ arriba: true }`. Y el foro ya
  no anuncia «[[Arven]]» en ninguna parte (PINGU: «yo lo obviaría»): el
  código de la 819 sigue, pero no se promete.
- **Los retos son seis y el sexto es «Parejas»** (tanda 989): «El reto de
  hoy» (el quiz) salió de `RETOS`, de la portada y del onboarding, y `/reto`
  es un 301 a `/retos`. Un reto nuevo es una entrada de `RETOS`
  (`js/retos-xp.js`), su rama en `retos_xp` (la base) y en la regla de
  `retos_resultados_juego`, en la MISMA migración, y su ficha en el menú.
  El menú de /retos cabe en una pantalla del móvil: lo que no es jugar va
  plegado en «Tu historial» y se carga al abrirlo; si añades algo, va ahí.
  Y cada final con cuenta dice cómo te mueve en la liga (`data.liga` de
  `guardarResultado`, pintado por `premiosHtml`).
- **Una partida o un torneo de /mis-partidas se comparte en una imagen**
  (tanda 997): `js/partida-imagen.js` (por `import()`) con la hoja de
  siempre y el marco de los retos (`cabecera` e `invitacionAbajo` de
  `reto-imagen.js`). Los sprites, los mismos de la tarjeta
  (`urlsDeSpritesDeMazo`), por `/sprite` y la cadena de respaldos, que un
  lienzo con una imagen sin permiso no se exporta. La historia la dibuja
  ella entera (`historiaPropia`, 997b) y abajo va la marca, sin «Apunta las
  tuyas» (PINGU: «muy cargante»).
- **Una página tiene UNA dirección para Google** (tanda 906). La canónica
  la arma `urlCanonica` (meta-social.js): sin `.html`, en pokedoc.es y solo
  con los parámetros que eligen el contenido (`PARAMETROS_CANONICOS`); la de
  un artículo es `rutaDeArticulo`. Una página fija nueva declara su
  canónica sin `.html` (lo vigila `test-tanda-906.mjs`), y lo que no debe
  salir en Google (entrar, buscar) va en `noindex,follow` y fuera del
  sitemap. Y antes de abrir miles de páginas a Google, mira en Search
  Console cuántas tiene «descubiertas sin indexar»: si la cola ya es
  larga, abrir más la alarga.
- **Una página no salta al cargar** (tanda 981): se mide con
  `herramientas/medir-saltos.mjs` (rama `pruebas`; CLS en un iPhone, con sesión
  y la base lenta) y `test-tanda-981-pantalla.mjs` exige menos de 0,1 en 20
  páginas. Lo que hace falta: el contenido mide una pantalla (el pie fuera de
  la vista); lo que cambia el dibujo en el móvil está ANTES del primer
  pintado —la clase `con-barra-movil` la pone la cabecera, detrás del
  `viewport` (antes, `matchMedia` cree 980 px), y `css/movil.css` va en la
  cabecera con `media`—; esconder es `visibility`, no `display:none`, si lo
  de debajo se ve; y un bloque que se rellena después tiene su sitio
  reservado o se pinta entero de una vez. Una página nueva con barra pasa
  por `generar-barra-movil.mjs`, que le pone la hoja y la clase.
- **Abrir una expansión no espera a la base** (tandas 977–979): la pantalla
  sale montada con lo de la estantería (`pintarPantallaMontada`: tira y un
  hueco por carta, sin esqueleto que salte), las cartas salen de lo guardado
  en el navegador (`cartas-guardadas.js`, llave con la huella de
  `COLUMNAS_CARTA_DE_SET`) o de la CDN (`cartas-set`, etiqueta `sets`) y
  `pedirSet` las pide a la vez y al tocar. Una columna nueva de las cartas de
  un set va en `js/mi-coleccion/columnas-set.js` (la piden la web y la
  función). Lo que cambie cartas desde /admin llama a `avisarALaWeb()`
  (`admin/js/avisar-web.js`), o la CDN la enseña vieja hasta diez minutos.
  Nada de `startViewTransition` para entrar en una pantalla grande (980):
  congela la pantalla para fotografiar lo que sale y lo que entra, y con una
  rejilla de miles de píxeles el teléfono «se queda pillado». Se anima solo lo
  que entra, con un `transform`. Y nada que se lea del navegador va DELANTE
  de la red: la red sale primero y lo guardado tiene un tope (150 ms).
- **Las colecciones son eras, y la web las coloca con la MISMA cuenta que
  /admin** (tanda 975, que deja vieja la de abajo): `erasDeEstanteria` en
  `js/mi-coleccion/estanteria.js`. No hay «Otros sets» ni «Sets especiales»
  ni una lista de nombres que saque colecciones de su era: PINGU las coloca
  en /admin → Colecciones (plegables, ↑ ↓, «Mover a…», «+ Nueva era»). Si
  vuelves a querer una regla automática, va en esa función y el panel la
  enseña; nunca solo en la web. `grupo` solo deja al fondo a las que lo
  tenían hasta que se coloquen.
- **(Hasta la 975) Una era con `grupo` no es una era: cuelga de «Otros sets», al fondo**
  (tanda 904). `tcg_eras.grupo` (`NULL` / `'otros'`) manda sobre el
  `orden`: la estantería la pinta detrás de TODAS las eras bajo el rótulo
  del grupo (`TITULOS_DE_GRUPO`, en `estanteria.js`, el único sitio con
  los nombres), y los «Sets especiales» caen en el mismo grupo, detrás.
  Una línea que no es de ninguna era (sobres de premio, colaboraciones)
  va ahí, no entre las eras con un orden alto. La columna se pide con
  respaldo (la 624) y /admin solo la escribe si existe.
- **La ERA de un set japonés es la SERIE de TCGGO** (tanda 825):
  `erasDeTcggo` agrupa por su serie y solo elige el `serie_id` (el de la
  mayoría, o el de una era a mano), y `pasoDeEras` lo aplica una vez al día.
  Comparar NOMBRES de serie entre catálogos repartía una serie en varias eras
  (Jungle fuera de Base). Lo que alguien mueve a mano después se respeta
  (`puestas`); si cambias la era desde otra función, que pase por ahí.
- **Supabase corta TODA respuesta a 1.000 filas, sin error** (tanda 808).
  La estantería de Productos contaba con `.select('episode_id').limit(10000)`
  y recibía 1.000: solo salían las expansiones de esas filas («hasta Stellar
  Crown, y hacia abajo hasta Evolutions»). Un `.limit()` mayor de 1.000 no
  pide más: es una promesa que la base no cumple. Lo que cuenta o recorre
  una tabla grande lo hace la base (una RPC que agrupa) o va a trozos con
  `.range()`. Y los ids de expansión y de producto de TCGGO del japonés son
  OTRA numeración: `tcg_products.market` y `ID_JP` en `tcggo-productos`.
- **Una VERSIÓN de TCGGO solo se encuentra por su id** (tanda 807): la
  Reverse del Snorlax de Plasma Storm (43552) no sale en el listado del set
  ni en la búsqueda, y ningún campo dice qué versión es. `tcggo-versiones`
  recorre ids y las guarda en `tcg_card_versions` colgadas de NUESTRA carta;
  el nombre de la versión lo pone la web. Una fila de precio no dice de qué
  catálogo es: los ids de TCGGO del japonés son otros.
- **Un reemplazo que BORRA filas de precio tiene que avisar a la pasada
  que las escribe** (tanda 697). `30th-entero` borró las cartas viejas con
  sus `tcg_card_prices` y escribió las nuevas; `tcggo-precios` ya había
  hecho esa expansión HOY y no volvía hasta mañana: el 30 aniversario
  estuvo el día entero sin precio, sin error. Lo que borra le quita la
  expansión a los `hechos` del día. Y de la misma tanda: **«la única de la
  página» no es «la única»** — `tcggo-sueltas` buscó «Charizard», TCGGO
  devolvió cientos en páginas de cincuenta, y el único «Charizard» a secas
  de la primera página era el del 30: la Classic de Celebrations se fue a
  otro set con el precio de otra carta. Una búsqueda por nombre identifica
  solo si el TOTAL es pequeño; una página no dice nada del total.
- **El precio de una japonesa antigua es el de TCGplayer de ESA carta, y
  el espejo solo copia el PRODUCTO** (tandas 686 y 688). `precios-espejo`
  casa cada carta de los sets rellenados por Scrydex con su gemela
  occidental y le copia el `cm_id_product` (para el enlace a Cardmarket)
  y NADA más: el mínimo de la gemela es el de la carta occidental (el
  Charizard de Base Set salía a 50.000 € en el Expansion Pack). PINGU:
  «prefiero que no tengan precio a que tengan estos precios». Y las
  chapas de impresión de un bloque de precio enseñan solo las que
  existen (`variants`); las cuatro a la vez solo las ofrecen añadir y
  editar, donde la carta la tienes en la mano.
- **El HISTÓRICO de precios se pide A DEMANDA, y lo demás lo escribe la
  pasada de precios** (tanda 643). TCGGO da la serie de una carta en una
  petición, así que pedirla para las 20.000 es imposible: `tcggo-historial`
  la pide la PRIMERA vez que alguien abre la ficha, no más de una vez a
  la semana por carta y con tope diario (`TCGGO_TOPE_HISTORIAL`), y a
  partir de ahí `historial_foto_diaria` —al cerrar cada día de
  `tcggo-precios`— copia el precio del día de las cartas que alguien
  TIENE. Si añades algo que le pida a TCGGO desde el navegador, pasa por
  el mismo patrón: freno propio y «se sirve lo que haya» cuando se gasta.
- **De TCGGO se guarda solo lo que es «singles», y la rareza con UNA
  grafía** (tanda 644). Su `/cards` lista lo que VENDE (también sobres y
  cajas, con `type`), y escribe «rare» donde Scrydex escribía «Rare»: un
  filtro que agrupa por valor exacto enseña dos chips. Lo que entra pasa
  por `esCartaSuelta` y `rarezaCanonica`; y un set nuevo lleva su serie en
  NUESTROS términos (`serieDeEpisodio`), que sin ella cae en «Sin
  clasificar».
- **TCGGO no da IMPRESIONES ni precio por impresión** (tanda 645,
  comprobado con PINGU en su playground: `Get card` y `Search cards` dan
  el Bisharp 65 de Black Bolt UNA vez, sin Reverse Holo ni Master Ball, y
  no hay endpoint de variantes). Lo que su web enseña sale de datos que no
  exponen. Las impresiones son las de `variants` (TCGdex) y el precio es
  el de la carta: las demás impresiones van SIN cifra, no con una
  inventada. Y el bloque de precio es UNO (`js/precio-vista.js`) con su
  CSS en `css/cardmarket.css`, que cargan /carta y /mi-coleccion; el
  histórico vive ahí también desde la 645.
- **Dos sets con el mismo `tcggo_id` son UNA expansión** (tanda 646), y
  manda sobre la lista a mano `COLECCIONES_JUNTAS`, que queda de respaldo
  para lo que TCGGO no empareja. Quien tiene los sets en la mano llama a
  `registrarEpisodios(sets)` (o a `plegarHermanos`, que lo hace) ANTES de
  preguntar `padreDeColeccion`: una función que solo recibe un id no puede
  saber de qué expansión es. Y una columna nueva para la web NO va en
  `tcg_sets` si el cliente la pediría en un `select` antes de la migración
  (la 624): va en su tabla (`tcg_set_valor`) y el cliente la lee aparte,
  sin romper si no está.
- **En /mi-coleccion se elige el CATÁLOGO, no el idioma** (tanda 648):
  «Pokémon» (occidental, en español) y «Pokémon Japón», como en la API.
  La vista «en» sigue declarada y escondida. Y la ficha desde el Panel
  busca en la colección ENTERA (`lineasTodo`, `cartaDeLineaTodo`): una
  carta de otro catálogo no está en `cartas` ni en `lineas`, y buscarla
  solo ahí la pintaba como «una que no tienes», sin foto ni precio y sin
  error. Si añades un camino que abra una carta por id, mira en las dos.
- **/cartas se GENERA desde mi-coleccion.html** (tanda 649): es la misma
  pantalla en modo catálogo (`<body data-modo="catalogo">`,
  `modoCatalogo` en `js/mi-coleccion.js`). No edites `cartas.html` a
  mano: toca la plantilla y corre `node generar-cartas.mjs`;
  `test-tanda-649-pantalla.mjs` comprueba que el repo lleva lo que sale
  del generador. Y Mi colección CONSERVA su pestaña de Expansiones: se
  pensó quitarla y PINGU paró («creo que es muy importante»), así que para
  quien tiene cuenta son dos puertas a la misma estantería, a propósito.
- **La barra de abajo del móvil se GENERA** (tanda 753): va escrita en las
  36 páginas con barra de arriba, entre `<!-- barra-movil … -->` y
  `<!-- /barra-movil -->`, para estar en el primer pintado y en la
  transición entre páginas (`@view-transition`, solo móvil y sin «menos
  movimiento», en `style.css`). No la edites a mano: si cambias la barra de
  arriba o las secciones, `node generar-barra-movil.mjs && node
  generar-cartas.mjs`; `test-tanda-753-pantalla.mjs` comprueba que el repo
  lleva lo que sale del generador. `js/barra-movil.js` la remata (Cartas →
  Mi colección con cuenta), no la crea.
- **Añadir una carta pasa SIEMPRE por `datos.anadir`, nunca por
  `actualizar`** (tanda 650). El bloque de añadir solo salía en la ficha
  de una carta que NO tenías; con una tuya, el único camino era el
  formulario de EDITAR, y cambiarle el idioma ahí reescribía la línea:
  PINGU añadió una inglesa y «las dos copias son inglesas», sin error.
  Ahora el «+» pegado a la carta abre el diálogo `#mcAnadirDialogo`
  (idioma con banderas, estado, versión, copias, pagado); si ya la
  tienes, la cabecera dice «Ya tienes N» y el formulario está igual a la
  vista (748, sin paso previo). /carta usa LA MISMA hoja. Si añades un
  camino para meter una carta, que llegue a `anadir`.
- **Los precios en memoria son los de TU colección** (tanda 651):
  `guardados` se carga con las ids de tus líneas, así que la ficha de
  cualquier otra carta —el catálogo entero, las japonesas— decía «Sin
  precio» de cartas que sí lo tenían. Quien abra una carta por id fuera
  de la colección pide su fila (`completarPrecioDeFicha`). Y **las tres
  vistas de una expansión son tres selectores**: el pop-up estaba
  enganchado solo al archivador, y en el móvil —cuadrícula— cada carta
  se iba a la página. Si añades una vista, engánchala.
- **Para cambios de /mi-coleccion se pasa el SUBCONJUNTO de pruebas de
  esa pantalla, no la suite entera** (PINGU, 2026-10-05: «no creo que
  haga falta pasar una suite completa»). Son los `test-tanda-*.mjs` que
  nombran `mi-coleccion` (116) más `test-imports`, 299, 305, 311, 312 y
  313. La suite entera sigue para lo que toque CSS o JS compartido.
- **Un respaldo por código + número solo es correcto si el número es
  ÚNICO en ese código** (tanda 652). La Classic del 30 aniversario va
  numerada 001–030 en TCGdex y su set lleva «30C», el mismo código que el
  Celebration: sin foto propia, `cadenaDeEscaneo` pedía a Limitless
  `30C_001` y pintaba el Exeggcute del Celebration rotulado «Charizard».
  No daba error: daba otra carta. Y el origen era de DATOS: TCGGO numera
  esas cartas como la original («4/102»), el catálogo no casó ninguna por
  número y las creó por segunda vez. Desde la 652 `emparejarPorNumero`
  casa por NOMBRE como último paso (único en los dos lados), y los
  duplicados se funden con `supabase-migration-30-aniversario-duplicados.sql`.
- **Una dirección SUPUESTA no va delante de una CONTESTADA** (tanda 666).
  La cadena de escaneos monta a mano el camino de TCGdex cuando falta
  `image_path` (la 434) y lo ponía antes de la foto de TCGGO: para una
  carta creada por TCGGO en un set que TCGdex también tiene, es el número
  de TCGGO sobre el set de TCGdex, y en el 30 aniversario la Classic lleva
  los números originales («4»), así que pintaba la carta 4 del set
  principal — otra carta, sin error. Para los ids `tcggo-…` la suya va
  primero. Y el modo `entero` del reemplazo (PINGU: «sustituye todo»)
  da la vuelta a la regla de la 654 A PROPÓSITO: lo que alguien tiene y
  no casa se reapunta por nombre al número más cercano (apuntado) o se
  borra con sus líneas, que quedan escritas en el estado. Borrar sí; en
  silencio no.
- **Un mapa que se escribe «al terminar» no tiene lo que terminó ANTES de
  existir el mapa** (tanda 671). La pasada de precios recorría las
  expansiones japonesas de `setsPorEpisodio.JP`, que el catálogo apunta al
  acabar cada una — y las acabadas antes de la 642 están en `hechos` y no
  se vuelven a visitar: sus cartas no tuvieron precio nunca, y «algunas sí,
  algunas no» no lo cantó nadie. La fuente buena es la FILA (`tcg_sets.
  tcggo_id`), que no depende de cuándo se escribió el mapa. Y de la misma
  tanda: un 403 de PLAN para el catálogo japonés no es «el plan no da más»
  (eso para todo) ni un error cualquiera (eso se repite cada diez minutos):
  bloquea SOLO lo japonés hasta mañana y se apunta donde /admin lo lea.
- **Rellenar un set vacío con los MISMOS ids que ya tiene otro set los
  MUEVE, no los copia** (tanda 670). Las cartas de TCGGO entran como
  `tcggo-<id>` y la RPC hace upsert por id: rellenar el «Expansion Pack»
  vacío con una expansión que el catálogo ya escribió en `tcggo-700`
  habría cambiado el `set_id` de esas cartas, vaciado el otro, y a la
  pasada siguiente el barrido lo habría rellenado al revés — un ping-pong
  de una expansión de pago cada cinco minutos, sin error. Por eso el
  barrido de huecos mira ANTES si otro set lleva ese `tcggo_id` y, si lo
  lleva, no rellena: los pliega (la 646). Y el barrido va con las frenos de
  la casa: ocho consultas gratis por pasada, UNA expansión de pago, los
  fallos cuentan y paran, lo que no tiene expansión se mira a la semana.
  **Corrección de la 755**: la RPC `tcggo_guardar_cartas` NO cambia el
  `set_id` de una fila que ya existe (su `on conflict` no lo toca), así
  que lo de arriba no mueve: deja la carta en el otro set, y si ese set se
  borra por vacío, la cascada se la lleva. Quien junta sets
  (`procesar`) mueve el `set_id` aparte, con un upsert.
- **Lo que TCGGO tiene, se rellena de TCGGO, y sin duplicar** (tanda 755).
  El calco japonés pide su lista cada día; si ni el código ni el nombre
  casan, busca el set nuestro por la HUELLA (día de salida y cuenta) antes
  de crear, y un empate es «dudoso», no un set nuevo. Las cartas que ya
  teníamos (Scrydex, TCGdex) se conservan por NÚMERO —mismo id, con el id
  de Cardmarket y el inglés de TCGGO— y, elegido por la huella, se
  comprueba que es la misma expansión antes de escribir. Lo viejo
  (`precios-espejo`, el repaso de `scrydex-huecos`) no toca lo que lleva
  `tcggo_id`.
- **Un cambio de DATOS que no quiera SQL va en una función con la clave
  de servicio** (tanda 654). PINGU no quiso ejecutar la migración del 30
  aniversario («da igual la migración SQL»), y la única forma de escribir
  en la base sin que un humano pegue SQL es una función de Netlify con
  `SUPABASE_SERVICE_ROLE_KEY`: `tcggo-reemplazar-set` (programada, con
  su lista `REEMPLAZOS` y apuntando lo hecho en `scrydex_estado`) borra y
  reescribe por REST (la clave de servicio se salta la RLS) y escribe
  cartas por la RPC que ya existe. Y PINGU tampoco quiso botón («hazlo tú
  automáticamente»): un arreglo de datos es una pasada programada que se
  hace UNA vez y se apunta, con tope de intentos. Antes de borrar filas
  de `tcg_cards` o `tcg_sets`,
  mira las claves ajenas: solo `tcg_cards(set_id, market) → tcg_sets`;
  nada apunta a `tcg_cards`, así que las líneas de colección de una carta
  borrada se quedan HUÉRFANAS sin error — por eso se reapuntan antes, y la
  que no tiene a dónde ir no se borra.
- **Un error que vuelve como RESPUESTA de una función programada no lo
  lee nadie** (tanda 655). `tcggo-catalogo` creaba el set japonés, la
  escritura de sus cartas fallaba, y el error volvía en el JSON de la
  función —a los registros de Netlify— sin apuntarse en el estado: en la
  web, «0 de 102» y dentro nada, durante días. Lo que falla en una
  función programada va al ESTADO (`fallidos`, `vacios`, `ultimoError`)
  y /admin lo enseña («Estado del catálogo de TCGGO»); y una expansión
  que no se deja escribir se salta a la tercera, no se pide cada cinco
  minutos para siempre.
- **Un aviso que se dispara se APAGA antes de avisar** (tanda 665).
  `avisos-precio` marca el aviso como disparado y DESPUÉS escribe la
  notificación y el correo: si lo de después falla, se pierde un aviso;
  al revés, la pasada siguiente lo repetiría cada hora. Es la forma de la
  522 (contar desde donde se paga) aplicada a un envío. Y los avisos
  viven en `user_price_alerts` (migración `avisos-precio`); la
  notificación es `user_notifications` tipo `aviso_precio`, que
  `enviar-push` ya empuja sola.
- **Lo que llega TARDE de una pintada vieja no se mete en la nueva**
  (tanda 663). `pintarVistazos` corre dos veces al abrir el Panel y el
  bloque de «las que más se mueven» —una consulta— aterrizaba después de
  la segunda: dos bloques iguales, sin error. Lo que se pinta por su
  cuenta lleva la versión de la pintada que lo pidió (`vistazosVersion`)
  y, antes de ponerse, quita al anterior por id. Es la misma forma que
  `cartaAbierta` en la ficha y que `album.set` en la expansión.
- **La cadena de escaneos va TCGdex → TCGGO → Scrydex → Limitless →
  pokemontcg** (tanda 660; Scrydex iba primero desde la 509 y se dio de
  baja en la 641). Una fuente que ya no se paga no va delante de las que
  sí; pero no se borra mientras conteste (la 321). Y **la gráfica del
  histórico de una carta es `js/carta-historial.js`** (661): rangos, una
  línea por idioma, marcas de lanzamiento (quien monta le pasa
  `cargadorDeMarcas(supabase, mercado)`: el módulo no toca la base), chips
  y lectura. Si añades una línea, su color va por token en
  `css/cardmarket.css` y nunca verde ni rojo.
- **El calendario de lanzamientos sale del catálogo** (tanda 656):
  /lanzamientos y la miniatura de la portada leen `tcg_sets` (fecha,
  logo, código), por catálogo; la lista a mano de /admin es solo para un
  set anunciado que TCGGO aún no tiene (se funde por nombre). Y
  `?catalogo=JP` en /cartas o /mi-coleccion manda sobre la vista
  recordada al arrancar (`vistaDeDireccion`): un enlace a un set japonés
  tiene que abrir el catálogo japonés.
- **Dos reglas de padre que se contradicen hacen desaparecer la expansión
  ENTERA** (tanda 656). TCGGO decía que el padre del 30 es la Classic (es
  el set más grande de su `tcggo_id`) y `COLECCIONES_JUNTAS` que el padre
  de la Classic es el 30: cada uno colgaba del otro, los dos «tenían
  padre» y `plegarHermanos` los dejaba fuera a los dos, sin error. Un
  padre registrado por TCGGO no es hijo de nadie según la lista a mano, y
  un camino que vuelve al origen no es un padre. Si añades otra fuente de
  «este set cuelga de aquel», pregúntate qué pasa cuando no esté de
  acuerdo con las que ya hay.
- **Un chip de «últimos N días» solo sale si el histórico CUBRE esos
  días** (tanda 653). Con tres fotos diarias, `diasDelRango(…, '1M')`
  devuelve las tres —tiene dos puntos y no se queja— y el chip habría
  dicho «30 d: +20 %» de un mes que no existe. Lo cazó la prueba en el
  primer verde. Es la 319 con el tiempo: «no se sabe» no se pinta como
  una cifra. Y de la misma tanda: **texto, cifras y marcas de una
  gráfica estirada van en HTML, no en el SVG** —con
  `preserveAspectRatio="none"` un `<text>` se deforma y un `<circle>`
  sale ovalado—, colocados en tanto por ciento del lienzo.
- **El foco se VE** (tanda 737): el anillo es `--shadow-ring` (2 px de
  `--navy`, macizo; antes era un 3 px al 16 % que sobre blanco no llegaba a
  1,5:1). Un campo con `outline: none` lleva ese anillo en su `:focus`, y
  si la caja de fuera hace de contorno (la de la lupa), el anillo va en la
  caja y el campo de dentro no lleva NINGUNO, o salen dos. Lo vigila
  `test-tanda-737-pantalla.mjs`, que recorre doce páginas con Tab.
- **Una dirección que escribe alguien se mete en `url(…)` SOLO con
  `urlParaCss`** (`js/html.js`, tanda 805). `avatar_url` lo escribe cada
  uno en su fila, y la web lo pintaba dentro de `style="…"` cambiando solo
  la comilla simple: una comilla doble ejecutaba código en su avatar en
  todas las páginas. Lo vigila `test-tanda-805.mjs`. Y una columna nueva de
  `user_profiles` que no deba escribirse uno mismo va en
  `perfil_guarda_columnas` (supabase-migration-seguridad-perfil.sql).
- **El service worker sirve FICHEROS y PÁGINAS desde dos cachés por
  GENERACIÓN** (tandas 897 y 982): un cambio visto en cualquiera no vacía
  nada; `renovar` llena por detrás la generación siguiente preguntando
  fichero a fichero (un 304 no baja nada) y cambia el puntero
  (`pokedoc-estado-1`) de una vez; cada pestaña sigue con la suya (`genDe`,
  por `clientId`/`resultingClientId`). Con ~20 despliegues al día, vaciarlo
  todo era bajarlo todo casi en cada visita. Si añades una caché de cosas de
  la web, o va por generaciones o no es de la web. Solo
  la dirección PELADA de una página se guarda (`esPaginaDeCache`): una
  página nueva que meta-social reescriba por su consulta, o que no deba
  abrirse al momento, va en `SIN_PAGINA`. Y **`route` de Playwright NO
  llega a lo que pide el worker**: un despliegue se simula escribiendo en
  el sitio servido (`PD_SITIO`) con la fecha del fichero adelantada
  (`utimesSync`), no con `fulfill`.
- **Un cambio de caché que no es de una vez MEZCLA despliegues** (tanda
  910): el service worker borraba llave a llave y una página abierta en
  ese rato bajaba módulos nuevos y viejos («Importing binding name
  'TOPE_CARTAS' is not found»). Desde la 982 el cambio es UNA escritura (el
  puntero de generación), una página que llega de la red durante una
  renovación ya es de la nueva, y lo que se escribe desde una generación
  pasada no se guarda (`test-tanda-982.mjs`). Y si aun así llega una
  mezcla, `js/error-log.js` recarga una vez (`tocaRecargar`). Un error de
  import en el panel justo después de un push es esto antes que un export
  que falta: `test-imports` lo distingue en un segundo.
- **Los botones son tres clases** (tanda 917): principal (`.btn-primary`),
  suave (`.btn-secondary`/`.btn-outline`: fondo `--ice`, borde transparente)
  e icono (círculo de 44 px). Un `.link-btn` suelto ya es un botón suave; en
  una frase (`p`, `.subtext`, `td`), un enlace. Un botón nuevo es de una de
  las tres: nada de bordes, subtítulos dentro ni enlaces subrayados sueltos.
  Y una regla global que alcanza media web va con `:where`, o les gana a las
  medidas de cada pantalla sin que nada avise.
- **La letra de los títulos, la marca y las cifras es Outfit; el cuerpo,
  los botones y las chapas, Inter** (tanda 1018, B2 de «PokeDoc como app»):
  `--font-display` y `--font-marca` en `style.css`, servidas desde
  `assets/fonts/` (variable, solo latín). Un título nuevo pide el token; un
  botón no pide letra (hereda). Fredoka solo queda para lo que se dibuja en
  un lienzo. **Y cada sección tiene su color** (`--acento` /
  `--acento-texto`, por `data-seccion` en `<html>`, que escribe
  `generar-barra-movil.mjs`): la barra de abajo, la burbuja, la lateral y
  `.btn-primary` lo llevan solos. Un color nuevo va en los DOS temas con sus
  dos medidas de contraste (SCHEMA 1018) y `test-tanda-1018.mjs` lo mide.
  La burbuja flotante del móvil SE QUEDA (PINGU, 2026-10-26: «lo único que
  no me gusta es que me cambies la burbuja»): no la muevas arriba.
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
- **Una guía tiene UNA señal: «Me ha servido»** (tanda 974, PINGU eligió
  la A): la caja «¿Te ha servido? Sí / No tanto» se fue porque preguntaba
  lo mismo justo debajo. Es `guide_helpful` (`js/guide-helpful.js`, con su
  «ver quién»; «Me gusta» en una noticia) y lo que antes era una media de
  estrellas es «a cuántos les ha servido» (`js/guias-servido.js`). No
  vuelvas a poner una nota ni un segundo botón: lo negativo va por
  «Sugerir una corrección». `guide_reviews` sigue en la base, sin pintarse.
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
- **Engordar el catálogo de cartas cuesta UNA PETICIÓN POR CARTA**
  (tandas 233 y 322), ~23.000 contra un catálogo comunitario y gratuito,
  frente a las ~220 de importar el catálogo entero. Por eso `cardToRow`
  deja los campos a null: no es un olvido, es un coste. No lo «arregles»
  metiéndolo en la importación — se reparte, y ya está repartido en la
  función programada `cartas-detalle` (40 cada cinco minutos, 350 ms
  entre peticiones, lo más nuevo primero). Y el 40 no es un gusto: **una
  función programada de Netlify se mata a los 30 segundos**, así que el
  bucle lleva además su propio presupuesto de tiempo y lo que no da
  tiempo se queda para la pasada siguiente. En cambio los NOMBRES y las
  IMÁGENES sí vienen en el listado del set, así que traducir el catálogo
  a otro idioma son ~154 peticiones y no 16.000: son dos costes muy
  distintos y conviene no confundirlos.
- **Lo que se GUARDA como clave es canónico; lo que se ENSEÑA va
  traducido** (tandas 334 y 335). TCGdex no traduce solo los ataques:
  traduce los ENUMS (`category` → «Pokémon», `stage` → «Básico», la
  rareza → «Rara Doble») y traduce el NOMBRE. Y el nombre inglés es la
  CLAVE con la que se cruzan `tcg_card_play` (que se construye con
  decklists de TCG Live), el respaldo del resolutor y la huella de las
  reimpresiones — así que escribirle el español encima dejó el bloque
  «En los torneos de PokeDoc» sin poder casar NUNCA, **sin dar error**.
  El traducido va en `name_es` y se pinta con `nombreDeCarta()`; el
  inglés se queda en `name` y se cruza con `claveDeJuego()`. Si añades
  un campo que venga traducido, pregúntate si alguien lo COMPARA.
- **Una columna que sirve para BUSCAR y otra para CRUZAR son dos
  columnas** (tanda 335). `name_search` hacía los dos trabajos mientras
  se parecían; al meterle el español dejaron de parecerse —su valor pasó
  a ser «boss s orders órdenes del jefe»— y un `in.(…)` con la clave
  inglesa no casa con NADA. El sitemap, que era el único que cruzaba
  exacto, se habría quedado sin las fichas traducidas en silencio. De ahí
  `name_key`, que es lo que `name_search` era antes.
- **El LISTADO de sets de TCGdex es un «SetResume» y le faltan campos**
  (tandas 233 y 322). `fetchSets` devuelve id, nombre, logo, símbolo y
  cuenta de cartas — pero **no el código de TCG Live ni la fecha de
  salida**. `setToRow` corre sobre el listado, así que esas dos columnas
  nacen vacías y nadie se entera: existen, y están a null en los 220
  sets. Lo del código ya estaba resuelto (se guarda al importar las
  cartas, que es cuando se tiene el set COMPLETO en la mano); la fecha se
  le había olvidado a alguien y salió al querer ordenar el catálogo por
  lo más reciente. Si añades una columna que venga de un set, pregúntate
  si viene en el LISTADO o solo en el set completo.
- **El catálogo japonés nombra sus sets en MAYÚSCULAS** (tanda 486), y
  el occidental en minúsculas: TCGdex contesta `SV1a` con serie `SV`
  donde el inglés dice `sv8` con serie `sv`. Su API **no distingue
  mayúsculas** en la ruta, así que pedir `/ja/sets/sv1a` funciona y
  devuelve el set rotulado `SV1a` — pero **nuestras comparaciones sí
  distinguen**. Le pasó al botón de la 484: comparaba el id ESCRITO
  contra `tcg_sets.id` y contestó «ese set no está en nuestra tabla» de un
  set que sí podía estar. Si cruzas un id de set contra el nuestro,
  hazlo sin distinguir caja — y guarda siempre el id **que devuelve la
  API**, no el que alguien escribió.
- **De TCGdex se afirma lo que TCGdex ha contestado, y lo demás no se
  afirma** (tandas 484 y 486). Yo le dije a PINGU que TCGdex no publica
  los logos japoneses, y era una **DEDUCCIÓN a partir de nuestras propias
  columnas** —188 sets curados, cero logos— que sale EXACTAMENTE IGUAL si
  el que lee mal somos nosotros. Una columna vacía no dice de quién es la
  culpa. Desde este contenedor no se puede preguntar —la red cierra
  `api.tcgdex.net`—, así que lo pregunta el navegador del panel: /admin →
  Cartas tiene **«Qué contesta TCGdex de un set»** y **«Sondear un
  catálogo entero»**.
- **Una ficha de pruebas en otro IDIOMA que producción prueba otra web**
  (tanda 593). Los efectos de los ataques se leían de plantillas inglesas
  porque «el espejo guarda el texto en inglés» — y desde la 330 el engorde
  lo guarda en ESPAÑOL siempre que TCGdex lo tiene. La ficha de pruebas
  estaba en inglés, así que la 462 salió verde con el Budew vetando objetos
  mientras el Budew de verdad no vetaba nada, sin un error. Antes de afirmar
  en qué idioma (o forma) llega un dato, mira quién lo escribe HOY; y si la
  prueba usa una ficha, que sea de la forma de producción — aquí, los
  ~1.300 pares (inglés, español) de tcgdex/cards-database, donde cada
  ataque que se lee en inglés tiene que dar los mismos pasos en español.
- **`closest('[data-x]')` sube hasta la raíz si la raíz lleva `data-x`**
  (tanda 594). Para el CSS de «elegir en la mesa» la raíz llevaba
  `data-elegir="cartas"`, y lo que se toca lleva `data-elegir="<id>"`:
  pulsar «Confirmar» en la barra encontraba la RAÍZ, lo tomaba por una carta
  llamada «cartas» y no hacía nada, sin error. Un atributo de estado en un
  contenedor no puede llamarse como el de los elementos que se buscan con
  `closest()` dentro de él (`data-eligiendo` en la raíz).
- **De QUIÉN son las cartas no dice QUIÉN decide** (tanda 620). El motor
  le pasaba al `ui` `partida` —de quién son las cartas— y con eso no se
  podía girar la mesa: «mira la mano del rival y descarta una» la elige el
  que ataca, y «el rival descarta dos», el rival; las dos llevan `partida:
  op`. Hace falta un dato aparte (`elige`), escrito donde pasa. Cuando un
  parámetro sirve para dos preguntas, la segunda se contesta mal sin error.
- **Una muestra con semilla fija se equivoca SIEMPRE hacia el mismo lado
  en la misma mesa** (tanda 623). «Encontrar una carta» jugaba cada camino
  en 400 repartos al azar: ±3 puntos, y en la mesa de PINGU, «Dudunsparce:
  11 %» donde la cuenta es 7,5 —siempre 11, porque la semilla es fija—.
  Repetirlo no lo destapa, y el orden de dos pasos se decidía por ese
  ruido. Lo que más pesa (dónde está la carta) se reparte por estratos y
  sale exacto; y un «este orden es mejor» se compara reparto a reparto y
  solo se afirma si pasa del azar.
- **Comparar reparto a reparto solo sirve si el azar va EMPAREJADO** (tanda
  630). Para saber si coger de más en un Poffin cambiaba algo, se jugaba el
  camino con y sin y se comparaban los repartos: después de barajar, los dos
  mazos tienen distinto tamaño, la misma semilla da órdenes que no tienen
  nada que ver, y una ganancia de dos puntos no se distinguía del azar —se
  dijo «no cambia nada» de algo que cambiaba—. Lo que decide (dónde cae la
  carta tras CADA barajada) se reparte por estratos y se ata al reparto, y
  entonces sí se ve. Y su pariente: «prepara» quería decir «mueve el mazo»,
  y vaciar la mano antes de Ariana prepara sin moverlo. Un criterio que mira
  un solo efecto se deja los otros sin dar error.
- **La API de TCGdex y su servidor de FICHEROS son dos sitios, y la API
  se calla fotos que el servidor sí tiene** (medido por la sesión de
  COWORK el 2026-10-03, con un HEAD por carta a las 20.442 asiáticas):

  | Mercado | Cartas | `image` en la API | Fichero que EXISTE |
  |---|---|---|---|
  | JP | 13.006 | 3.882 | **7.365** |
  | TW | 7.436 | 2.146 | 2.242 |
  | CN | 877 | 0 | 0 |

  Son 3.483 cartas japonesas con su foto publicada y sin enseñar (Sol y
  Luna entero, media Espada y Escudo, SV5M, SV8, SV10, M1S, M4). **Y el
  campo falta TAMBIÉN en `/cards/{id}`**, comprobado en SM1M-001, M4-001,
  S8b-001 y SM12a-001.

  **ESO DEJA MAL DOS COSAS QUE ESCRIBÍ YO**, y las dos por el mismo
  motivo —deducir de una muestra de uno—:

  · La 484 dijo «la ficha de cada carta sí trae la imagen». **Es falso**:
    falta en las dos. El engorde de la 483 no rellena estas fotos.
  · La 486 dijo «cuando el escaneo existe, viene en el listado». **Es
    falso**: PINGU sondeó SV1a, que da 103 de 103, y de ahí saqué una
    regla del catálogo entero. SV1a es de 2023 y es el caso bueno.

  La dirección del fichero es DETERMINISTA
  (`assets.tcgdex.net/{idioma}/{serie}/{set}/{número}/low.webp`) y su
  trozo del medio es exactamente lo que guarda `image_path`, así que se
  puede montar a mano. Lo que **no** se puede es guardarlo sin preguntar:
  un camino inventado en la base es una foto rota que nadie distingue de
  una buena.

  Los LOGOS, en cambio, no están: probando el fichero a mano en los 341
  sets asiáticos existe **UNO** (M4) y ningún símbolo. Y 68 de los 186
  sets JP **no tienen ni una carta** en TCGdex (XY, ADV, Legend, medio S).
  Eso no es nuestro.
- **Una lista curada a mano se queda vieja, y el buscador es quien lo
  nota** (tanda 323). Las megas de `FORMAS_TCG` se sondearon contra la
  CDN el 2026-09-02, y lo que salió después no estaba: quien buscaba
  Mega-Zeraora en /mis-partidas encontraba «Zeraora» a secas y no podía
  apuntar la partida. Lo curioso es que el resto del módulo YA lo
  resolvía —`dexDeClave` registra sola cualquier «Mega X» cuya X sea una
  especie, con su número sintético y su slug—, así que el sprite
  funcionaba desde el principio. **El único sitio que no usaba el
  mecanismo era `buscarOpciones`, que recorre listas fijas.** Si añades
  un camino que resuelve algo sobre la marcha, mira quién MÁS recorre la
  lista estática: el que no se entere te da un fallo sin error.
- **Un dato que decide la PRIORIDAD no se puede ir calculando sobre la
  marcha** (tanda 322). `cartas-detalle` ordenaba los sets por fecha de
  salida y curaba esa fecha del set por el que iba pasando. Es circular:
  casi ninguno tenía fecha, y el que acababa de curar se ponía por
  delante de todos los que seguían sin ella — así que la función se
  quedaba dando vueltas a los sets VIEJOS que ella misma había curado,
  que es lo contrario de para lo que existía la prioridad. Ahora las
  fechas van en una fase aparte que se lleva las pasadas enteras hasta
  acabarlas (~220 peticiones, menos de una hora), y solo después empieza
  el engorde. Si un criterio de orden depende de un dato que todavía no
  tienes, complétalo ANTES: mientras falte, el orden no ordena.
- **PostgREST se come el `nullslast` al ordenar por una tabla EMBEBIDA**
  (tanda 322), sin dar error. Y como Postgres pone los NULL PRIMERO en un
  `DESC`, `order=tcg_sets(release_date).desc.nullslast` hizo justo lo
  contrario de lo que decía: el catálogo se empezó a engordar por las
  promos de McDonald's de 2014, que son lo menos buscado que hay. Se vio
  porque las 206 primeras cartas eran TODAS de sets sin fecha. Sobre una
  columna PROPIA de la tabla sí funciona; sobre una embebida, ordena tú
  en dos pasos y no le confíes la prioridad a una sintaxis que puede
  ignorarse en silencio.
- **Miles de páginas casi vacías hunden el dominio, no lo suben** (tanda
  322). Es contenido escaso generado en masa, y castiga al sitio entero y
  no solo a esas páginas. Antes de generar una página por fila de una
  tabla, contesta qué tiene esa página que no tenga la de al lado — y si
  la respuesta no existe todavía, esa página nace en `noindex`.
- **Una constante copiada se vigila con una prueba** (tanda 322), y la
  regla sigue valiendo — pero esa copia concreta YA NO EXISTE: en la 471
  `IDIOMA_POR_MERCADO` pasó a SER `MERCADOS`, importado de
  `js/mercados.js`. Ver la norma de abajo, que es la lección completa.
- **La especie de una carta sale de `dex_ids`, y el NOMBRE es el
  respaldo** (tandas 476 y 483). Hasta la 483 era solo el nombre, con un
  motivo bueno —mientras la columna se rellena, las cartas que tienes no
  la traen y son justo las que no pueden faltar— que no vio lo evidente:
  deducir del nombre solo funciona si el nombre está en nuestro alfabeto.
  「フシギダネ」 no casa con ninguna lista, así que la Pokédex japonesa salía
  VACÍA con 13.006 cartas importadas. Ahora manda `especiesDeLaCarta()`.
  Para una PRUEBA sigue valiendo el aviso: un fixture occidental con
  `name: 'Carta 1'` y sin `dex_ids` deja la Pokédex a CERO y la prueba se
  queda afirmando cosas sobre una pantalla vacía sin que nada dé error.
- **Las columnas que rellena una función programada se rellenan POR
  MERCADO** (tanda 483). `cartas-pokedex` lleva `const MERCADO = 'WEST'`,
  igual que `cartas-detalle`, así que las cartas asiáticas no tenían ni
  `dex_ids` ni rareza ni tipo. Lo de los asiáticos lo hace
  `catalogo-asia`, que tiene su propia fase de engorde. Si añades una
  columna que rellene una función programada, pregúntate quién la
  rellena en los otros tres catálogos — la respuesta por defecto es
  NADIE, y no da ningún error: la pantalla sale vacía.
- **Un registro nombra cartas, no impresiones** (tanda 629): «Alakazam» en
  el registro de TCG Live es cualquiera de los Alakazam de la lista. Mirar
  solo la primera impresión con ese nombre hizo que una lista con 3 + 1
  dijera que la cuarta copia «no estaba en la lista». Lo que viene de un
  registro se cuenta por NOMBRE, sumando todas las impresiones.
- **Una cifra nueva al lado de una vieja usa la MISMA definición** (tanda
  628). Las estadísticas nuevas de /mis-partidas sacaban el porcentaje como
  victorias sobre el total, y la matriz de siempre cuenta el empate como
  media victoria: la misma pestaña habría dicho 58% en una tarjeta y 63% en
  la de al lado, las dos «bien hechas». Si la pantalla ya calcula algo,
  se IMPORTA la función que lo hace (`porcentaje`), no se reescribe.
- **Lo que se mide con su caja no se pinta escondido** (tanda 628): los
  gráficos se dibujan con el ancho de su caja, y en una pestaña con
  `display: none` esa caja mide 0. Se pintan al abrirla y se vuelven a
  medir al cambiar el ancho; la prueba comprueba las dos cosas.
- **Un `display` suelto en un `<dialog>` lo deja A LA VISTA SIEMPRE**
  (tanda 473). Lo que esconde un diálogo cerrado es una regla del
  NAVEGADOR —`dialog:not([open]) { display: none }`—, así que un
  `display: flex` en el selector a secas la pisa y el panel no se cierra
  nunca. No da ningún error y en una captura puede no notarse. Va siempre
  en `[open]`, y lo prueba una comprobación de que al cerrar deja de
  verse — no de que el atributo `open` sea false, que sí lo era.
- **Un `<select>` cuyo valor no está entre sus opciones se queda con la
  PRIMERA** (tanda 472), y al guardar escribe esa. No da ningún error. Pasó
  con el idioma de una carta: desde la 472 el catálogo japonés solo ofrece
  «japonés», y las cartas japonesas que ya había guardadas dicen
  `idioma: 'es'` — abrir una habría pintado «Japonés» y al guardar le
  habría reescrito el idioma. Si acotas las opciones de un desplegable,
  mete SIEMPRE el valor que la fila ya tiene (`idiomasParaEditar`).
- **El idioma con el que se AÑADE sale del selector de catálogo** (tanda
  472), no de una constante ni de una preferencia global: en el catálogo
  japonés no existe una carta en español, así que ofrecerlo era afirmar
  que sí. Y lo que se recuerda se recuerda **por catálogo**
  (`mcTocarIdioma-en`): con una clave única, haber elegido «español» una
  vez te lo llevas al catálogo inglés para siempre. Si añades un control
  que dependa del catálogo, repíntalo en `cambiarVista` **antes** del
  atajo de español↔inglés, que es el cambio más común y el que se sale
  por un `return` sin tocar la memoria.
- **No copiar es mejor que una copia vigilada** (tanda 471). La norma de
  la 322 decía «una constante copiada se vigila con una prueba», y era
  poco: la guarda de `IDIOMA_POR_MERCADO` llevaba desde la **438**
  leyendo `js/tcgdex.js` en busca de un mapa que se había mudado a
  `js/mercados.js` —encontraba CERO claves y comparaba contra un objeto
  vacío—, o sea que la guarda contra las copias que se separan se separó
  ella. La causa de TODAS esas copias es la misma: `js/tcgdex.js` importa
  `./supabase.js` y no se puede arrastrar a una función de Netlify. El
  remedio no es copiar y vigilar, es **mudar lo puro a un fichero sin
  dependencias** y que lo importen los dos lados: así nació
  `js/mercados.js` (438), `js/texto.js` (447) y ahora
  `js/catalogo-tcgdex.js`, con `setToRow`, `cardToRow`, `sinDuplicados`,
  `fechaDeSet` y `codigoLiveDeSet`. Y si por lo que sea tiene que haber
  copia, la guarda pregunta **«¿es LA MISMA?»** (identidad) y no «¿dicen
  lo mismo?», que es una pregunta que se contesta bien por casualidad.
- **Un comentario que justifica un atajo caduca, y nadie vuelve a
  leerlo** (tanda 471). `cartas-detalle` lleva `const MERCADO = 'WEST'`
  con su porqué al lado: «los asiáticos son catálogos aparte y
  engordarlos multiplicaría por cuatro las peticiones **sin que hoy los
  vea nadie**». Era verdad el día que se escribió y dejó de serlo en la
  **437**, cuando el selector de catálogo puso el japonés y el chino
  delante de la gente — y con él se quedaron sin curar la serie, el logo,
  las cuentas y la fecha de sus 550 sets. Si un `if` o una constante se
  justifica con «hoy esto no lo ve nadie», el día que alguien lo vea hay
  que ir a buscarla: no va a avisar.
- **El catálogo asiático se llena SOLO, no desde /admin** (tanda 471).
  «Importar los que faltan» es un bucle en una pestaña del navegador: con
  los ~550 sets del japonés y los dos chinos son más de quince minutos sin
  tocar nada, y quien lo deja a medias **no deja ninguna señal** —los sets
  siguen ahí con su nombre y lo que falta son las cartas—. Lo hace la
  función programada `catalogo-asia`, cada seis minutos y reanudándose
  sola. Lo que NO hace, a propósito: reimportar un set ya importado. Un
  set que TCGdex declara más largo de lo que publica volvería en cada
  pasada para siempre, que es el cerrojo de la 333.
- **Un respaldo que vive en el mismo sitio no es un respaldo** (tanda
  321). El 2026-09-20 se cayó `r2.limitlesstcg.net` entera y todos los
  minisprites del sitio se apagaron a la vez: la red que había —de una
  FORMA a su ESPECIE BASE— pedía las dos a la misma CDN. Ahora
  `respaldoDeSprite(url)` devuelve el SIGUIENTE sitio donde probar y se
  recorre llamándola otra vez, así que la cadena cruza de origen
  (Limitless → jsDelivr → GitHub a pelo → esconder). Si añades una
  imagen de un tercero, pregúntate qué se ve el día que ese tercero no
  conteste — y que la respuesta no sea «nada, sin dar error».
- **Una CDN que NO CONTESTA no dispara `error`** (tanda 888): el meta se
  quedó sin sprites con la cadena de respaldos intacta, porque Limitless
  colgaba la petición en vez de dar 404 y el navegador tarda minutos en
  rendirse. El vigilante de `sprites-pokemon.js` (`saltoPorEspera`) da el
  paso a los cuatro segundos. Si añades otra cadena de respaldos de
  imágenes, pregúntate qué pasa cuando el primer origen no contesta NADA.
  **Y solo cuenta lo que está A LA VISTA** (890): la primera versión contaba
  desde que la imagen existía, y las cartas diferidas de una rejilla que
  aún no han empezado a cargar nunca «terminan» — les quemó la cadena hasta
  el 404 y las miniaturas de VSTAR Universe desaparecían al bajar. Una
  imagen `lazy` fuera de pantalla no está colgada: no se ha pedido.
- **Un respaldo tiene que conservar lo que DISTINGUE** (tanda 511). El
  siguiente paso de una mega era su especie base, «que para reconocer un
  mazo sirve igual»… salvo que Mega Gardevoir y Gardevoir son DOS mazos, y
  la imagen del meta acabó pintando el que no era cuando `/sprite` empezó a
  dar 404. Una cadena de respaldo va de menos a más pérdida, y hay que
  decidir QUÉ es la pérdida: aquí se pierde antes el estilo (Limitless →
  la misma mega en PokeAPI) que la forma.
- **Un hijo de flex CEDE antes de desbordar** (tanda 320), y por eso una
  barra que no cabe no da ningún síntoma que cante: `.nav-logo` se
  encogía de 126 px a 44 y «PokeDoc» se amontonaba encima de su icono.
  `min-width` NO lo evita —ese es el mínimo de la caja, y lo que se pasa
  de rosca es el REPARTO—; lo evita `flex-shrink: 0`. Corolario: **un
  punto de corte elegido a ojo es una afirmación sobre un ancho que
  nadie ha medido**. Los tres de la barra de arriba estaban cortos (860
  donde hacían falta 1.074, y 479 donde hacían falta 599) y llevaban
  meses así. Mide el ancho que pide la barra; no mires la pantalla.
- **`text-overflow: ellipsis` no hace nada sobre un contenedor flex**
  (tanda 320): el texto necesita SU propia caja con `min-width: 0`. Sin
  ella el nombre se corta a hachazo («Pachanga de inauguraci») y parece
  un fallo en vez de un recorte.
- **Un dato opcional se recibe con el valor que NO afirma nada** (tanda
  319). La tarjeta de guía tomaba `progreso = {}` por defecto, así que
  la portada —que no se lo pasaba— pintaba la barra a cero y decía «Sin
  empezar» debajo de una guía leída entera. Hay TRES estados, no dos:
  `null` = no se sabe (no se pinta), `{}` = se sabe y no hay nada, y la
  fila = lo que ponga. Un defecto que convierte «no me lo han dado» en
  «me han dado cero» miente en la pantalla que no se lo pasa, y **no da
  error en ninguna parte**.
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
torneo, userId, esJuez)` en el cliente. Es el admin del sitio, o alguien con el
rol `is_tournament_admin` (una comunidad de fuera lleva los torneos de
PokeDoc y se reparte desde /admin → Usuarios), o quien creó ESE torneo
—crear está abierto a todo el mundo desde la tanda 266—, o un JUEZ
aprobado de ese torneo (tanda 970, PINGU: «los mismos permisos que el
organizador»; borrar el torneo no, y la mesa viva y la baja las sigue
haciendo por sus funciones de la 394). Si añades una
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

El PUENTE de los torneos ya no existe (tanda 786): el último trozo, el
reintento de `torneos_inscribirse` con tres parámetros, se quitó. Queda
`faltaLaRpc` en js/torneos/comun.js, que ya no escribe por ningún camino
viejo: solo reconoce «esa función no existe» para decir qué migración
falta en vez de un error de PostgREST.

Decisiones ya tomadas: sin pagos (fuera del porte), el chat de partida
va A LA VISTA en «Tu partida» (PINGU lo quiso primero en desplegable y
lo cambió el 2026-08-26 al probarlo; los chats de juez sí van plegados),
la cuenta de PokeDoc es la cuenta de torneos, tiempo real por websocket con
el sondeo de respaldo detrás (la ficha entera se refresca sola desde
torneo.js: cada 10 s, o cada minuto si el vivo está conectado) y cierres
automáticos con función programada por minuto.

**En una LIGA cada jornada se juega con SU lista** (tanda 635, que
sustituye a la 634): jugar la jornada N es tener fila en
`tournament_matchday_decklists` para N, escrita solo por la RPC
`torneos_lista_jornada` mientras la jornada esté abierta (sin cierre en
`tournament_matchday_closures` y sin pareos). Cada jornada se cierra por
separado y solo se empareja cerrada. Al motor le llega como retirado
justo antes de ESA ronda quien no tiene lista (`montarSnapshot`), así que
el motor no se toca; y al emparejar, esas listas pasan a
`tournament_decklists`, que sigue siendo «la» lista para todo lo demás.
Si añades otro camino que empareje, que pase por `montarSnapshot`.
Y desde la 971 **cada jornada se empareja de cero** (PINGU eligió la
opción A): al motor le llega solo lo de SU jornada, renumerado
(`snapshotDeJornada` en `js/torneos/rondas-jornada.js`), así que su ronda
1 va al azar con una semilla por jornada y las demás por los puntos y los
cruces de la jornada. La CLASIFICACIÓN no pasa por ahí: sigue sumando la
liga entera con `montarSnapshot`.

**Los arquetipos (tanda 230) NO se guardan**: se deducen de la decklist
al pintarla. Eso es lo que hace que la regla de visibilidad no se pueda
equivocar — se ve el mazo de alguien exactamente cuando la base deja ver
su lista (torneo terminado, o de lista abierta en juego). Si algún día
lo cacheas en una columna, te llevas esa garantía por delante.

El motor puro (pareos suizos,
desempates, top cut, decklists) está en `js/torneos/motor.js`,
traducido 1:1 de `libs/engine` de TrainerArena — si tocas su lógica,
respeta la SPEC de TrainerArena y anótalo.

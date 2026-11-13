# Catálogo y precios — normas de PokeDoc

> Capítulo de CLAUDE.md (tanda 1333, I4): Cartas, sets, eras, versiones, idiomas, TCGGO, TCGdex, Scrydex, Cardmarket, el japonés y las pasadas que lo llenan. Se lee ENTERO antes
> de tocar esta área. Una norma nueva de esta área va aquí; si vale para
> toda la web, en CLAUDE.md.

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
- **Un set puede no tener NÚMEROS, y la llave de una carta es su número**
  (tanda 1339): el 10th Movie Commemoration Set lleva «—» en «No.» y en la
  rareza, y «Pegar lista» lo rechazaba entero. Ahora se numeran por orden de
  la lista y el panel lo dice. Un lector nuevo de listas no da por hecho que
  hay número: que diga qué hace sin él, en vez de tirar la línea.
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
  a la principal (antes se borraban). Y por CUALQUIERA de los tres nombres
  (1037: `name`, `name_en`, `name_es`): el Zekrom de N de TCGdex se llama
  «Zekrom de N» en `name` y el de TCGGO «N's Zekrom», y no salían. Un arreglo
  de datos que junte cartas desde una migración llama a
  `catalogo_repetida_resolver` (con un admin prestado), no lo rehace a mano.
- **Los idiomas que se ofrecen para una carta son los de SU set** (tanda
  911): `idiomas_de_set` (la base) suma los anuncios de Cardmarket y la
  ficha de TCGdex, porque ninguna basta: TCGdex se queda corto en sets
  viejos (Gym Heroes «solo en inglés») y Cardmarket no tiene columna de
  portugués. En la web, `idiomasDeSet` + `idiomasParaAnadirEn`; si no se
  sabe, se ofrecen todos. Un camino nuevo para añadir o apuntar una carta
  pasa por ahí; editar una copia lleva siempre su idioma (472).
- **Una carta sin `regulation_mark` no es ilegal: es de TCGGO** (tanda
  633). Las `tcggo-*` (el 30 aniversario) nacen sin letra, y el filtro de
  Estándar por marca las escondía — en el constructor solo salía el Mew ex
  de 151. Cuenta como legal la que no tiene letra y es de una colección
  igual o más nueva que la primera con la marca legal más vieja
  (`coleccionesRecientes`).
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
  como respaldo de precio. Y si TCGGO CORRIGE un `cardmarket_id`, el nuestro lo
  sigue en la pasada de precios: el japonés siempre (830) y el occidental desde
  la 1280 (`cmQueCorregirWest`: misma carta por `tcggo_id`, mismo número, nada
  corregido a mano y el id nuevo sin otra carta nuestra que se quede con él).
  Lo que lo cambie por otro camino respeta esas cuatro cosas. El bloque de precio es UNO
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
  `sinBorrar` y `numeroComoElNuestro`, como `mep-promos`; y como un set de promos
  CRECE, con `cadaDias` (1151: se repasa cada semana; la 1000 la trajo una vez
  y la MEP 90 de Mega Darkrai salió después). Y lo que TCGGO NO tiene pero
  TCGdex sí (las MEP 89–92, 1158) entra por `tcgdex-rellenar-set` (lista
  `RELLENOS`, solo lo que falta por NÚMERO, `origen = 'relleno'`, con su id de
  Cardmarket sacado de los ficheros de TCGdex en `cm_id_product_propio`); lo
  que no tiene NADIE va a mano en `decks-jp-a-mano` (`soloAMano` si no es un
  deck, como el pack de McDonald's de 2002 o el de la película de 2009, 1247:
  sin PS ni ataques que no se sepan, la «M» de película en el nombre como la
  escribe Cardmarket, para que «Buscar en Cardmarket» la encuentre). El precio de esas cartas sale de
  la guía pública diaria de Cardmarket por ese id (`cardmarket-precios`; el
  japonés solo para `mano`/`relleno`, en `cardmarket-precios-jp`), y el id se
  pone en /admin → Colecciones → la carta, donde «Buscar en Cardmarket» (1159,
  `cardmarket-buscar`) lo busca por nombre en su catálogo abierto (sin nombre
  de expansión: cada resultado lleva su enlace por `?idProduct=` y su precio,
  y la expansión de las hermanas con id va delante). La lista de rellenos de
  TCGdex vive en `js/rellenos-tcgdex.js` (la leen la pasada y /admin); en un
  set suyo, «Traer ahora lo que falta» (`tcgdex-rellenar-ahora`) la pasa al
  momento y dice qué se saltó y dónde estaba; `rehacerDesde` la repite y
  olvida los intentos fallidos de antes. Lo que la API de TCGdex aún no da va
  en `FICHAS_DE_RESPALDO` (copiado de cards-database, sin foto), y una
  versión que no es otra carta (Staff, sellos de evento) en `VERSIONES_EXTRA`
  (1160: clase «sello», ids desde -900000, una vez por nombre). Y una
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
- **Una expansión sabe su EDICIÓN GEMELA en el otro catálogo** (tanda 1027,
  `related_episodes` de TCGGO): `tcg_sets.tcggo_gemelos` (ids de TCGGO del
  OTRO catálogo), que escribe `pasoDeGemelas` del calco japonés para los dos
  catálogos a la vez (solo pares en los que tenemos los dos sets) y se
  corrige en /admin → Colecciones. La cabecera pinta el chip
  (`pintarGemelaDeAlbum`) y lo pone en la línea del progreso (PC y móvil
  desde la 1051: al lado del nombre aplastaba el código y la fecha y pisaba
  los botones) con `colocarGemela`: antes de repintar el progreso con
  `innerHTML`, `colocarGemela({ aCasa: true })`, o el repintado se lo lleva.
  Y las columnas opcionales de la estantería (`symbol_tcggo`,
  `tcggo_gemelos`) se quitan de UNA en una cuando la base dice que no
  existen (`quitarOpcional`, en `sets.mjs` y `sets-catalogo.js`): una
  columna nueva de la estantería que llegue antes que su migración va ahí.
- **Una VERSIÓN de TCGGO llega con UN precio y sin producto, y su idioma se
  pide al ABRIR la ficha** (tanda 1028, el Lugia Reverse del foro). La pasada
  de precios trae cada versión «slim» (el mínimo de todos los idiomas) y la de
  idiomas solo visita las que alguien tiene apuntadas: la Reverse de Darkness
  Ablaze decía «0,10 €, cualquier idioma» con el español a 25 €. La ficha
  llama a `tcggo-versiones-ahora` (una petición por carta, una vez al día por
  versión, tope diario, parada por plan; estado `tcggo_versiones_ahora` en
  `PASADAS`) y repinta. Una fila por idioma lleva `cm_id_product`
  (`filaDeIdiomasDeVersion`): sin él no hay enlace exacto a Cardmarket, y
  mientras no llega, el botón va al `link_cm` de TCGGO a ESA versión, nunca a
  una búsqueda por nombre. Lo de pedir es `datos.pedirVersionesAhora` y lo
  llaman el pop-up y /carta (`carta-mercado.js`, que pinta por SU camino:
  la primera 1028 no le llegó). Si pintas el precio de una versión en otra
  pantalla, pasa por `precioDeLinea` con la fila entera, y pide igual.
  **Y el lote por ids (`/cards?ids=`) SE CALLA las versiones** (1028c,
  con la respuesta real): devuelve las cartas principales y no la Reverse
  39644, que «Get card» (`/cards/{id}`) sí da. Todo lo que pida versiones por
  lote pasa por `pedirCartasPorIds` (repesca una a una lo que no vuelve, cada
  una cuenta), y lo que no contesta NO se da por hecho: la 929 lo daba, y
  ninguna versión tuvo nunca precio por idioma, sin error.
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
  `tcggo_id`. Y una expansión NUEVA (1265) no espera a que la lista de TCGGO
  cuente sus cartas: en sus primeros 14 días se le piden cada tres horas como
  mucho (`esRecienSalida`, `estado.miradas`), y sin cartas sueltas sigue en
  las vacías; su set escondido (756) se enseña al llegar. Y sus PRECIOS (1274,
  Delta Reign: cartas sin precio, sin idiomas y «0 cartas»): la pasada de
  precios toma también los sets occidentales por su `tcggo_id` de fila cuando
  el emparejador no casó nada (sin veredicto o con cero pares), como el japonés
  de la 671, y el emparejador vuelve a mirar un set casado con su expansión
  vacía o reciente sin casar (cada 20 h; los sobres sin id de Cardmarket ya no
  lo paran). Un camino nuevo que meta sets antes de que salgan cuenta con eso.
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
- **La cadena de escaneos va TCGdex → TCGGO → Scrydex → Limitless →
  pokemontcg** (tanda 660; Scrydex iba primero desde la 509 y se dio de
  baja en la 641). Una fuente que ya no se paga no va delante de las que
  sí; pero no se borra mientras conteste (la 321). Y **la gráfica del
  histórico de una carta es `js/carta-historial.js`** (661): rangos, una
  línea por idioma, marcas de lanzamiento (quien monta le pasa
  `cargadorDeMarcas(supabase, mercado)`: el módulo no toca la base), chips
  y lectura. Si añades una línea, su color va por token en
  `css/cardmarket.css` y nunca verde ni rojo. Desde la 1062 cada raya es
  UNA serie con SUS datos (`valorDeFila` no cae al general: mezclar decía
  «+586 %» sin que nada subiera) y se enciende con su botón (`data-serie`:
  el mismo `--serie` en la raya, los puntos y el botón); de serie, tu
  idioma y «Cualquier idioma», y TCGplayer apagado. El inglés de TCGGO ES
  el general: no se ofrece aparte.
- **El calendario de lanzamientos sale del catálogo** (tanda 656):
  /lanzamientos y la miniatura de la portada leen `tcg_sets` (fecha,
  logo, código), por catálogo; la lista a mano (`site_settings.lanzamientos`)
  ya no se edita en /admin (1119): lo guardado se sigue fundiendo por nombre. Y
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
  Marcas legales → «Herramientas de diagnóstico» (la sonda de orígenes, que
  pregunta a cada sitio por una carta; desde la 1123 los importadores de
  TCGdex ya no están).
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

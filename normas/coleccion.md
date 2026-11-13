# Mi colección y las cartas — normas de PokeDoc

> Capítulo de CLAUDE.md (tanda 1333, I4): Mi colección y /cartas, la ficha de una carta, el buscador, deseos, álbumes, el Panel, modo evento y los tratos entre personas. Se lee ENTERO antes
> de tocar esta área. Una norma nueva de esta área va aquí; si vale para
> toda la web, en CLAUDE.md.

- **El buscador de cartas es UNO: `js/buscar-cartas.js`** (tanda 909).
  /cartas → Buscar y la barra de arriba (/buscar, la paleta) llaman a
  `buscarComoEnCartas`; la copia «con las mismas reglas» de /buscar tenía
  otro tope y otro orden (24 por orden alfabético) y el Zapdos ex de 151 no
  salía buscando «zapdos». Si una pantalla nueva busca cartas por lo que
  escribe alguien, pasa por ahí con sus columnas y sus filtros; no copies la
  consulta. Y trae TODAS las que casan (1113: con 120 por orden alfabético
  faltaban la mitad de los Pikachu): un tope de más de 1.000 va por páginas
  (`pedirHasta`). Y /buscar NO pinta su propia lista de cartas (972): la chapa
  «Cartas» y `?en=cartas` llevan a `/cartas?ver=buscar&q=`; lo puro de
  arriba (expansiones que casan, el mejor resultado, las cuentas, «@») vive
  en `js/buscador-puro.js`. En el PC ancho la caja de /buscar ES la de la barra
  (1147: se muda a `#navSearch`; no pongas una segunda). Lo de antes de escribir
  que pide a la red va en `js/buscar-antes.js` (la 909 vigila que `buscador.js`
  no pregunte a `tcg_cards`), y un ejemplo de «Prueba con» va en
  `EJEMPLOS_DE_BUSQUEDA`, que la 1147 pulsa entero: si no da nada, no va.
  **Lo que lleva dentro un producto y su PVP salen de TCGGO en el mismo
  listado** (1026, `include_contained_items=1` y `msrp`): tabla
  `tcg_product_contenido` (reescrita entera por producto en cada pasada) y
  `tcg_products.pvp_eur`; la ficha pinta «Qué lleva dentro» con
  `cuentaDelPack` (con algo sin precio, «orientativa», nunca «sale a
  cuenta») y «Viene en» (la misma tabla al revés). Un dato nuevo de un
  producto que TCGGO dé en el listado va en `filaDeProducto` con su columna
  sondeada en la pasada (como `COLUMNAS_1026`), no en otra petición.
  Los productos sellados, con `buscarProductos` (`js/productos-valor.js`,
  968): un `or` por palabra con su traducción (`terminosDeProducto`: «lata»
  es «tin»). Y desde fuera, un producto se abre en `/cartas?ver=productos&
  producto=<id>` (`rutaDeProducto`), que se ve sin cuenta. Lo que TCGGO no
  cuelga de ninguna expansión nuestra (su episodio 226, «Pokémon») entra por
  `EPISODIOS_SUELTOS` de `tcggo-productos` y sale en «Productos especiales».
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
  Desde la 1237 (PINGU: «más estilizado todo», con la carta, ♡ y compartir
  donde estaban) «− Tienes N +» es UNA pastilla redonda con los pasos en
  círculo y el «+» en `--acento` (sin copias, la pastilla entera dice «Añadir
  a mi colección»); en el PC del pop-up va debajo de la carta. El precio es
  una caja: tu idioma en grande y los demás en chips (`.pv-con-tarjetas`), en
  una fila en el PC para que quepa sin desplazarse (923). Un mando nuevo de la
  ficha sigue ese molde, no vuelve a las losetas cuadradas.
- **Una carta se abre en su pop-up, en toda la web** (tanda 1043, PINGU:
  «a la ficha completa solo si le das a ver ficha completa»): un oyente de
  `app.js` convierte cualquier clic en un enlace a `/carta/…` o
  `/cartas?…&carta=` en `js/ficha-rapida.js` (lo de /carta en un `dialog`);
  en Mi colección y /cartas, su `#mcEditor` por `window.pokedocAbrirCarta`.
  Una pantalla nueva solo enlaza con `rutaDeCarta`; lo que deba IR a la
  ficha lleva `data-ficha-completa` (el «Ficha completa» del pop-up de Mi
  colección no la llevaba y, hasta la 1237b, volvía a abrir el mismo pop-up).
- **/carta y el pop-up enseñan una carta con LO MISMO** (tanda 998, PINGU:
  «cojamos solo un sitio»): las versiones son las chapas del precio y salen de
  `versionesDeCartas` (con las de a mano), la rareza de `rarezaCrudaDeCarta`
  con `rarity_en` pedida también en el SERVIDOR (`meta-social.js`), y no hay
  un segundo bloque de versiones debajo. Y una carta del buscador se abre en el
  pop-up: la lupa de arriba lleva a `/cartas?ver=buscar&q=…&carta=<id>`
  (`rutaDeCartaEnBuscar`); /carta queda para Google y para los enlaces.
- **Un cambio entre dos personas es una PROPUESTA** (tanda 942): las cartas
  de cada lado (la copia concreta, con su línea), el dinero APUNTADO (quién,
  cuánto y cómo; PokeDoc no cobra ni comprueba) y su estado. Todo pasa por
  las funciones de `supabase-migration-942-propuestas-cambio.sql`; al
  cerrarse, `cambio_mover` mueve las líneas y lo apunta para deshacerlo un
  día. Un camino nuevo para proponer llama a `abrirPropuesta`
  (`js/cambio-propuesta.js`); lo que mueva o reserve cartas de un cambio
  respeta `cambio_reservadas_linea`. Cada uno confirma lo que LE llega (1098):
  el botón lo dice `textoDeRecibido(queRecibe(…))` y quien no recibe nada no
  confirma (`cambio_sin_esperar`); y el dinero se pinta DENTRO del lado de
  quien lo recibe, sumado a su total, nunca en una franja aparte (una venta
  decía «Recibes · 0,00 € — Nada»). Desde la 1099 una propuesta es Cambio,
  Le vendo o Le compro (`tipoDe`), cada carta lleva un precio editable sobre
  el de Cardmarket, y el envío (en mano o por correo) es AUTOMÁTICO desde la
  1108 con la tabla de Cardmarket España → España (PINGU: «hasta 25 €,
  ordinario; más de 25, certificado»): `envioAutomatico` / `enviosDe` en la
  web y `cambio_envio_tarifa` en la base, la MISMA tabla en los dos; quien la
  recibe solo elige eso o en mano al aceptar (`cambio_aceptar` lo calcula) y
  en una venta lo paga quien compra (`pagaElEnvio`). El total de una venta se
  escribe y se reparte entre las cartas (`repartirTotal`, 1106). Un trato se SIGUE en Cruces → «En curso» (1100,
  `#oferta-<id>`) y, desde la 1269 (PINGU eligió la recomendada), también se
  RESPONDE en Mensajes: arriba de la conversación va LA tarjeta de «En curso»
  (`tratosEnTarjetasHtml` con `conEstado`, desde `pintarPropuestasCon`) con su
  pop-up y sus botones, que se encoge a una tira al leer o escribir; no hay otra
  tarjeta ni otros botones. Lo que pasa en un trato llega a la conversación como
  UNA LÍNEA con «Ver» (1101, `propuestaDe`), que abre ese pop-up: un paso nuevo
  avisa por `cambio_avisar`, que le pone el adjunto `propuesta`. «Ya nos
  cambiamos» (795) ya no existe (1269: no movía cartas y cualquiera podía
  marcarse tratos): `cambio_marcar` no abre nada y nadie la llama; un trato se
  apunta SOLO al cerrarse su propuesta (también uno en mano). Lo que se marcó a
  mano antes sigue contando en la reputación; no vuelvas a poner un camino que
  apunte un trato sin propuesta. La dirección de un trato por correo (1102) la pone
  quien recibe cartas y va en `trade_offer_direcciones`, que solo se lee
  por `cambio_direcciones` (la del otro, con el trato aceptado): nunca en
  un mensaje, un perfil ni una consulta directa. Lo enviado y su número de
  seguimiento (1103) pasan por `cambio_enviado`, y las direcciones de un
  trato cerrado se borran a los 30 días (`cambio_direcciones_purgar`, desde
  `cambio_avisar`): lo que lea direcciones respeta ese plazo. Un trato hecho cuenta como cambio
  hecho (`trade_confirmations`): el sello del perfil (`ponerSello`) y
  «¿Qué tal fue?» (`valorarHtml`) salen de ahí (1105); con quién cambias
  solo lo ves tú. El Bizum o PayPal de quien cobra (1107) va como la
  dirección: `trade_offer_cobros` por `cambio_cobro_poner` / `cambio_cobros`,
  y se borra con ella. Lo que está en una propuesta enviada o aceptada no se
  ofrece (1109): lo que liste lo que da la gente cuenta con
  `cambio_libres_de`, nunca con `cambio` a secas. Y en Cruces (1241) lo que ya
  va en un trato vivo con esa persona, o tu carta ya prometida entera, lo quita
  `sinLoDeTratosVivos` (tablon.js): `intercambios_quien_busca` no lo descuenta. La etiqueta del sobre (1110) es
  `js/cambio-etiqueta.js` (por `import()`), con lo que ya trae el trato: nada
  de la dirección sale de ahí a otro sitio.
- **Cómo funciona un trato se cuenta en UN sitio: `js/cambio-ayuda.js`**
  (tanda 1238, PINGU: «me ha dicho: ¿cómo funciona esto? Soy nuevo»): los
  cuatro pasos de ESE trato (`pasosDeAyuda`, por tipo, envío y quién mira), el
  de ahora (`pasoDeAyuda`) y «Para ir seguro», en una hoja que abren «Cómo
  funciona» al proponer, el «?» del pop-up de un trato y «¿Primera vez?» del
  mensaje. Un paso nuevo de un trato cambia esos textos, no otra explicación
  suelta. La franja de la primera vez sale a quien no tiene ningún trato hecho
  (`tocaPrimeraVez`) hasta «Entendido». Y las tarjetas de «En curso» miden lo
  mismo: las cartas van en abanico (tres y «+N»), nunca en fila que crece.
- **La reputación de los cambios es UNA: `reputacionDe` + `nivelDe` +
  `textoDeConfianza`** (`js/cambios-hechos.js`, tanda 1224, PINGU: «que otros
  usuarios vean que has completado trades»): sale de `reputacion_de` (la
  base, con `cambiosDe` de respaldo) y los niveles son Nuevo / N tratos / De
  fiar (5, sin problemas) / Muy de fiar (20, 95 % bien). Los problemas no
  salen nunca como número, solo el tanto por ciento. Una pantalla nueva que
  enseñe a alguien de los cambios pone `data-confianza="<id>"` y llama a
  `ponerConfianza`. Un trato HECHO no está «en curso» (1225: `estaViva` es
  enviada o aceptada; su Deshacer va en el Historial). Y un trato se abre en su pop-up (`.cp-trato-dialogo`,
  1223, `engancharDialogos`): con `showModal` lo de fuera está INERTE, así que
  los avisos van dentro (`toast.js` busca `dialog:modal`). En el PC el
  selector de catálogo de una lista que crece va en la barra
  (`catalogoALaBarra`), movido, no duplicado.
- **Una carta pintada en cualquier pantalla lleva sus marcas** (tanda 943,
  PINGU: «debería estar en todos los lados de la web»): el ✓ de «la tienes»
  y el corazón de «La quiero». Dentro de /mi-coleccion, con
  `marcaDeTengoHtml` + `quieroHtml`, y la vista entra en
  `VISTAS_CON_CORAZON` para que el corazón puesto desde la ficha salga sin
  recargar. Fuera, `data-marca-carta` en la caja de la foto y
  `marcarCartas(raíz)` de `js/marcas-carta.js` (por `import()`), que solo
  pregunta por las cartas que hay en pantalla.
- **Un deseo lleva su VERSIÓN** (tanda 1047): `user_wants.variante` (null =
  cualquiera) casa como el idioma, con la copia sin versión como «normal»
  (`casaVersion`). Un camino nuevo que apunte un deseo pregunta con
  `preguntarDeseo` (`js/idioma-deseo.js`) y pasa por `anadirDeseo`; lo que
  lea deseos pide la columna con `conVariante` (`js/deseo-version.js`), que
  aguanta la base sin la migración; y lo que case deseos con copias (una
  función nueva de la base o del navegador) lleva la versión al lado del
  idioma. Y una versión se PINTA siempre con la chapa de la web
  (`chapaDeVersionHtml`, 1047c, PINGU: «tiene que ser consistente todo lo
  que hacemos»), también la Normal: nada de letras ni de otro dibujo.
  Y la que CONSIGUES sale de la lista (1063): `datos.anadir` y
  `anadirVarias` tachan el deseo que la copia cumple (`cumpleDeseo`, la regla
  de `cambio_mover`), con el aviso y Deshacer (`deseosTachadosPor`); un camino
  nuevo que meta cartas sin pasar por ahí se lo salta. El idioma se pregunta
  SIEMPRE (1064): apuntar varias va por `quererVarias` (una pregunta para
  todas, con lo último elegido), y lo apuntado se cambia desde la ficha
  (`#mcEdDeseos`), el Mercado («Cambiar») o «Idioma» en «La quiero». Y se
  marcan VARIOS (1128, Sergio.M del foro): la ventana devuelve `idiomas` y se
  apunta un deseo por idioma con `idiomasPara` (`js/deseo-idiomas.js`,
  «cualquiera» va solo); cambiar pasa por `planDeDeseos` (se quedan, se
  borran, se añaden). Y las VERSIONES igual (1129): cada pareja idioma ×
  versión es un deseo; la ventana devuelve `combos` (`combosDe`, sin las
  parejas que no existen) y cambiar pasa por `planDeCombos`. Un camino nuevo
  que apunte lee `r.combos`, no `r.idioma` ni `r.variante`. Con versiones la
  ventana es una TABLA idioma × versión, una casilla por deseo (1138, Sergio.M
  otra vez: cruzar todo con todo apuntaba lo que ya tenía), y cambiar toma
  TODOS los deseos de la carta (`usaTabla`), no los de una versión.
- **Cada «Ver todas» del Panel de Mi colección abre LO QUE DICE** (tanda
  1171, PINGU: «que me enseñe los movimientos y que no me lleve a la
  colección a secas»): «Las que más se mueven» abre `?ver=movimientos` y
  «Las que más valen» `?ver=ranking` (`js/mi-coleccion/movimientos.js`, por
  `import()` con `ctxPanel`). Una vista nueva del Panel va en `PESTANAS` y
  en `VISTAS_DEL_PANEL`, en el `data-tambien` del botón Panel, con su
  `<section class="mc-vista-panel">` en la plantilla (y `generar-cartas`),
  la miga «‹ Panel» (`mcVistaVolver`) y `engancharFicha` para sus filas. Y
  el histórico de un periodo se pide por sus EXTREMOS
  (`datos.historicoDeExtremos`): el periodo entero pasa de las 1.000 filas.
  Desde la 1172 son cuatro: «Últimas añadidas» abre `?ver=anadidas` (por
  días, con lo pagado a mano en `?sin=pagado`), «Estadísticas» abre
  `?ver=estadisticas` (`pintarEstadisticas` en panel.js, con idioma y era;
  nada se despliega en el Panel) y «Expansiones» abre la estantería con
  «Solo las empezadas». Una caja nueva de estadísticas va en esa vista.
  **El Panel es el «A · Cartera»** (tanda 1179, PINGU eligió la A de las
  tres propuestas: «muy visuales y que no tengan mucho texto»): la cartera
  a lo ancho (la cifra, cartas · distintas · expansiones, la chapa del mes,
  la gráfica a 140 px en el PC y 112 en el móvil, caja Y dibujo, 1181, y sus periodos; nada más: ni «Este mes / Esta
  semana», ni lo pagado, ni «N cartas no tienen precio») y debajo CUATRO
  bloques con el mismo molde, uno por fila: Movimientos (`fichaDeTiraHtml`,
  precio y % en verde o rojo), Ranking, Últimas añadidas (tiras de ocho en
  el PC, tres en el móvil) y Expansiones en BALDOSAS con el logo (las reglas
  al FINAL de `mi-coleccion.css`, que las filas de la estantería les ganaban
  por orden). Al final, los chips de «Más» (`vistazoDeAcciones`, 1176; lo
  que no es un bloque va ahí). Cambios, Tu mes y las alertas NO son bloques
  del Panel: cada cosa en su pestaña, y las alertas avisan por la campana.
  Lo pagado vive en la ficha de la carta y en Estadísticas (`diapoDelBalance`),
  no en el Panel. Con productos, lo de cartas y productos es una LEYENDA dentro
  de la gráfica (1278, `ponerLeyendaDeProductos`, PINGU: «son 2 líneas más»), no
  otra fila encima. Un bloque nuevo del Panel es una tira con ese molde, con su
  `order` y su «Ver todas» a su vista; una cifra suelta o una frase, no.
  Lo que no es un bloque (una acción, un ajuste) va como chip en «Más»
  (`vistazoDeAcciones`, 1176), no como bloque nuevo; y los bloques se
  llaman como la vista que abren (Movimientos, Ranking). La pantalla Cartas
  se abre solo desde el chip «Todas tus cartas» de «Más» (y por `?ver=cartas`).
- **«Repetida» no existe en la interfaz** (tanda 1179, PINGU: «tengo una
  normal y una reverse y pone que está repetida. No está repetida»): contar
  copias por id llamaba repetida a dos versiones, dos idiomas o dos estados.
  Lo que sobra es lo que TÚ marcas para cambio: Estadísticas enseña «Lo que
  das» (`loQueDas`), el filtro de una expansión es «Para cambio»
  (`album.paraCambio`, `#mcAlbumCambio`) y la línea de «Más» se fue. La
  función `repetidas()` de mi-coleccion.js se queda sin pintarse en ningún
  sitio; no la vuelvas a enseñar.
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
- **En el móvil, lo de arriba de una pantalla es UNA fila de mandos**
  (tandas 1034–1035, PINGU: «demasiados botones apilados», «¿qué pinta el
  título si ya sabes que estás ahí por el menú?»): el título de una
  pestaña que ya dice la burbuja se esconde (visualmente; el h2 queda para
  el lector), los botones de una acción van en una fila con textos cortos
  (`.mc-q-largo` / `.mc-q-corto`), y un selector de catálogo dice
  «Pokémon / Japón». Antes de añadir una fila de botones, mira con
  `herramientas/aud-apilados.mjs` (rama pruebas) que no caiga en dos. Y la
  sección es «Colección» (1036), no «Cartas»; su llave de color sigue
  siendo `data-seccion="cartas"` (`SLUG_DE_SECCION`).
- **Una pantalla de cartas lleva LA barra de la expansión** (tandas 1053 y
  1054, PINGU: «que sea todo consistente durante todos los sitios donde
  salgan cartas»): Todas/Tengo/Faltan · vista · Apilar · Orden · Filtros ·
  Seleccionar, y el catálogo al final, con las piezas que tengan sentido y
  en ese orden. «Seleccionar» lleva `data-seleccionar` (un oyente en el
  documento, visible solo con `html.mc-puede-marcar`) y marca por
  `seleccion.js`; una rejilla nueva en la que se marque va en sus `ZONAS`.
  Y su hoja de Filtros es LA COMÚN (1055): los grupos con `data-hoja` en el
  orden y con el nombre de `js/mi-coleccion/hoja-filtros.js` (lo que pinta
  la pantalla entra con `meterEnLaHoja`), lo propio detrás de la raya, y
  abajo «Limpiar» y «Ver N cartas».
- **Toda lista de cartas lleva «Seleccionar»** (tanda 1057, PINGU: «siempre
  que haya una lista de cartas, un botón para seleccionar cartas todas de
  golpe»): Cartas, expansiones, Pokédex, Buscar, álbumes y «La quiero» ya lo
  llevan; una pantalla nueva de cartas lo lleva en su barra, con la barra de
  abajo de siempre (`.mc-sel`). Y «La quiero» tiene LISTAS
  (`js/mi-coleccion/listas-deseo.js`, migración 1057), que ve solo su dueño:
  lo que enseñe una lista pasa por `cartasDe`. Una lista NO esconde nada
  (PINGU, 1058b: «si la quieres, la quieres»): lo que está en «La quiero»
  cuenta siempre para cruces, Mercado y perfil. El QR de una lista va por
  `evento_lista`.
- **Contenido primero en el teléfono** (tandas 1038–1040, PINGU: «haz todo
  lo recomendado»). Cinco reglas para cualquier pantalla de lista: (1) el
  título que ya dice la burbuja no ocupa sitio (recortado con `clip-path`,
  sigue para el lector), y si en su cabecera hay un botón, el botón se MUEVE a
  la fila de mandos antes de recortarla (`:has`, como `.ap-cab`); (2) lo de
  arriba es UNA fila que se desliza, con los iconos (calendario, «+», lápiz)
  delante de los chips; (3) chips, pestañas y segmentos miden 36 a la vista y
  44 al dedo con la franja `::after` de `movil.css` (iconos y campos, 44 de
  verdad), y una fila de chips que se desliza de lado entra en la lista de la
  1199 (`overflow-y: hidden` y su `padding-block`), o la franja la deja
  moverse en vertical y el iPhone la corta; (4) nada de párrafos de explicación encima: una línea y lo largo
  plegado (`<details>`) o al final; (5) lo que se viene a ver empieza antes de
  los 296 px de un iPhone de 844 (35 %). La 5 la vigila
  `test-tanda-1040-pantalla.mjs` en doce páginas: una página de lista nueva
  entra en su lista `LISTAS`. Aprender es la excepción (1227, PINGU: la banda
  «déjala, no ocupa tanto y queda bien»): su banda se ve en el móvil, y su
  buscador va detrás de una lupa en ella (1229, `ponerBuscador`), no en una fila.
- **En Deseos y cambios y el modo evento, occidental y japonés van cada
  uno en su tramo** (tanda 1033, PINGU: «separado está bien y está
  ordenado»): `porCatalogo` / `conRotulos` (deseos.js) ponen el rótulo como
  una fila más de la rejilla, que sigue siendo una; con un solo catálogo no
  hay rótulo. Una lista nueva de cartas tuyas que mezcle catálogos pasa por
  ahí. Y es UNA lista que crece sola al bajar (1125, PINGU: «mostrar todas
  hacia abajo»; antes, dos filas y «Ver las N» de la 1114): 48 por tanda (24
  en el móvil), occidental y luego japonés con el rótulo pegado arriba, «Los
  dos · Pokémon · Japón» encima, y la dirección guarda catálogo y cuántas
  (`tramo=<vista>:<cat>&hasta=N`, con `replaceState`). Todo en
  `js/mi-coleccion/tramos.js` (`listaQueCrece`, `listaLocalHtml`): una lista
  nueva de cartas tuyas que mezcle catálogos pasa por ahí. El Mercado pide a
  la base solo cada tanda; lo que repinta (un corazón, Seleccionar) rehace lo
  YA cargado, sin volver a pedirlo. Y en el móvil esas rejillas van a TRES por fila (PINGU: «con dos hay
  que bajar demasiado»): lo que se añada a una baldosa cabe en ~110 px.
- **Un álbum hecho desde una lista (La quiero, 1031) es una COPIA de ese
  día** (`crearBinderDeLaQuiero`, albumes.js): la lista y el binder no se
  tocan entre sí, a propósito (se hace para ordenarlo y quitar a mano). Un
  camino nuevo que cree un álbum con lo de otra pantalla pasa por
  `crearAlbum` con `tipo: 'binder'` y sus páginas calculadas, y entra por
  «Empezar un álbum» como un tipo más (`data-tipo`), no por otro diálogo.
- **Una carta se mete en un álbum desde su ficha con `js/en-tus-albumes.js`**
  (tanda 1052): «En tus álbumes» en la ficha de Mi colección, /cartas, /carta
  y el pop-up; la cuenta de dónde cae es `album-sitio.js` (primer hueco libre,
  lo que cabe, página y hueco) y se llega a un bolsillo con
  `enlaceAAlbum(id, pág, hueco)`. Un camino nuevo que meta cartas en un álbum
  desde fuera pasa por ahí, y lo que necesite la forma de un álbum fuera de Mi
  colección importa `album-forma.js`, nunca `archivador.js` (arrastra sus
  clases). Con el álbum CERRADO la cremallera no se ve (PINGU); dentro, sí.
- **Un álbum es un álbum moderno, sin anillas** (tanda 1048, PINGU con dos
  fotos: «un álbum moderno se ve así, y no usa anillas»): hojas cosidas a un
  lomo de tela, fundas de carga lateral con pespunte y la cremallera
  opcional, en `archivadorHtml` (álbumes Y vista «Archivador» de una
  expansión). Lo de dentro no cambia con el tema. En un álbum no hay modo de
  ordenar: se arrastra siempre, se quita soltando en la papelera o con
  «Seleccionar» (siempre con Deshacer), y nada se pinta encima del corazón.
  Fuera, en Mis álbumes (1049), un álbum es su TAPA CERRADA
  (`tapaCerradaHtml`: la misma de la cabecera) o su LOMO en una estantería;
  quien mira elige (`mc-albumes-vista`, en su navegador). Lo que se le añada
  a un álbum (color, acabado, cierre) se pinta en los dos.
  Dentro de un álbum tuyo lo que falta va en COLOR, sin ✓ y con su «+» (1180,
  PINGU: «para hacer álbumes queda feo» el gris); en el Archivador de una
  expansión sigue en gris. La regla va por `#mcAlbArchivador`, no por la clase.
  Su barra son pastillas `mc-chip-mando` (1182): un ciclo Todas → Tengo →
  Faltan, «En color / En gris», Seleccionar y «Personalizar» fuera; «Ocultar
  iconos» va en el ⋯ (PINGU). Gris e iconos son DEL ÁLBUM (`estilo.gris`,
  `estilo.sinIconos`, por `vistaDeAlbum` / `cambiarVista`): un campo nuevo de
  `estilo` se conserva en `estiloCompleto`, o Personalizar lo borra al guardar.
- **Un álbum se edita y se borra desde UN sitio: la hoja de
  `album-editar.js`** (tanda 1032), que abren el ⋯ de cada baldosa y
  «Editar álbum» dentro. Un campo nuevo de un álbum (nombre, tapa, portada,
  público…) va en esa hoja y en `cambiosDelEditor`, que escribe SOLO lo que
  cambia; no pongas otro botón suelto de borrar ni otro formulario. El
  menú va FUERA del botón de la baldosa (`.mc-albt-caja`): un botón no
  puede llevar otro dentro. Desde la 1050 la hoja tiene dos pestañas:
  Aspecto («Personalizar»: color, acabado, ventana y portada, hojas, cierre
  y bolsillos, con la vista previa pintada por `archivadorHtml` y
  `tapaCerradaHtml`, nunca una maqueta aparte) y Datos (el ⋯: nombre,
  descripción, público y borrar). El aspecto vive en `user_albums.estilo`
  (jsonb, migración 1050) y se ofrece solo si la fila trae la columna.
- **El modo evento es `/evento` y su QR lleva a `/evento/<usuario>`**
  (tandas 1029 y 1030; antes «feria», 794): la ficha de esa persona abierta
  por Cambios, que se ve SIN cuenta, con la puerta a registrarse arriba
  (`pintarCruce` sin sesión) y, con cuenta, el cruce de la pestaña. `/feria`
  es un 301 (hay QRs impresos). Las listas de la página van en CARTAS y se
  guardan CON sus fotos (`pd-evento-v2` + Cache API `pokedoc-evento-fotos`,
  que `sw.js` sirve solo a imágenes de otro origen cuando la red no
  contesta). Un botón nuevo de la página pasa por `datos[lista]`; y lo que
  importe `importar.js` desde una página sin `mi-coleccion.css` se lleva sus
  clases (299): `exportarCsv` vive en `importar-csv.js` por eso.
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
- **Lo que llega TARDE de una pintada vieja no se mete en la nueva**
  (tanda 663). `pintarVistazos` corre dos veces al abrir el Panel y el
  bloque de «las que más se mueven» —una consulta— aterrizaba después de
  la segunda: dos bloques iguales, sin error. Lo que se pinta por su
  cuenta lleva la versión de la pintada que lo pidió (`vistazosVersion`)
  y, antes de ponerse, quita al anterior por id. Es la misma forma que
  `cartaAbierta` en la ficha y que `album.set` en la expansión.
- **Un chip de «últimos N días» solo sale si el histórico CUBRE esos
  días** (tanda 653). Con tres fotos diarias, `diasDelRango(…, '1M')`
  devuelve las tres —tiene dos puntos y no se queja— y el chip habría
  dicho «30 d: +20 %» de un mes que no existe. Lo cazó la prueba en el
  primer verde. Es la 319 con el tiempo: «no se sabe» no se pinta como
  una cifra. Y de la misma tanda: **texto, cifras y marcas de una
  gráfica estirada van en HTML, no en el SVG** —con
  `preserveAspectRatio="none"` un `<text>` se deforma y un `<circle>`
  sale ovalado—, colocados en tanto por ciento del lienzo.
- **Buscar de Mi colección y Mensajes van como la maqueta** (tandas 1231 y
  1232, PINGU: «no como me habías propuesto»): antes de escribir, la caja a lo
  ancho, «Prueba con» en una fila y los sets de cuatro; los mandos de una lista
  (orden, filtros, Seleccionar) salen solo cuando hay lista. En Mensajes la
  lista es UNA caja con filas sin borde propio (no una tarjeta por
  conversación) y lo tuyo va teñido del acento con la letra de siempre. Un
  bloque nuevo en esas pantallas sigue el molde, no vuelve a las tarjetas.
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

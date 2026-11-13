# Comunidad y contenido — normas de PokeDoc

> Capítulo de CLAUDE.md (tanda 1333, I4): Portada, foro, mensajes, perfil, avisos, retos, redes, eventos, guías y noticias, logros, analítica, /admin y las fiestas. Se lee ENTERO antes
> de tocar esta área. Una norma nueva de esta área va aquí; si vale para
> toda la web, en CLAUDE.md.

- **La analítica cuenta PERSONAS y no páginas, y sin identificador** (tandas
  1065 y 1066): cada visita lleva `modo` (app instalada o web),
  `primera_del_dia`, `nueva_visita` y `primera_en_app` (una instalación), que
  salen de `pd-visto` en el navegador (solo fecha, hora y si ya fue app). Una
  cifra nueva del panel va en `admin_analitica_resumen` (o en
  `admin_analitica`), con su prueba contra PostgreSQL, y en la pestaña que le
  toque (`data-an-tab`). La frase del Resumen es `js/analitica-frase.js`, la
  misma que llega el lunes a la campanita del equipo. Y una cosa que la gente
  HACE (una tabla nueva de acciones) entra en `hechos` de esa función.
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
  AHORA se suma en el navegador por `valorComoElPanel` (`js/mi-coleccion/
  datos.js`, tanda 1179): tus líneas, los precios guardados y las versiones
  de las copias con versión, con `valorDeLineas`, en el Panel y en la
  portada. La base (`valor_de_copia`) suma la foto DIARIA y no mira las
  filas de versión, y PINGU vio 12.046 € arriba y 12.169 € dentro: una cifra
  nueva de «lo que vale AHORA» pasa por `valorComoElPanel`, no por otro
  camino; la de un día pasado, por la foto. Desde la 1206 el Panel TAMBIÉN
  enseña esa (su `valorDeAhora()`), sin los `vivos`, y el resultado se guarda
  10 minutos con la firma de tus líneas (`firmaDeLineas`): PINGU, «no puede
  haber variaciones» entre la portada y el Panel.
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
- **El cuadro de responder del foro es un editor COMPACTO que crece al
  tener el foco** (tanda 899): en una prueba, pulsar «Responder» sin haber
  tocado el cuadro lo enfoca con el `mousedown`, el editor crece y el botón
  se va de debajo del ratón, así que el clic cae en el formulario y no
  envía nada. Se escribe como la gente: enfocar el cuadro primero.
  Y la caja de un tema se queda ABIERTA (`.abierta`) hasta un clic fuera
  (964): con `:focus-within` a secas, en el iPhone tocar «Imagen» le quitaba
  el foco, la barra se escondía bajo el dedo y la galería no se abría.
  Abierta no tiene tope de alto ni scroll dentro (1115, PINGU: «que no haya
  scroll en ningún momento») y en el móvil deja de ir fija abajo. En el PC,
  con algo dentro no se recoge; en el MÓVIL se recoge siempre al salir (tocar
  fuera o subir por el hilo, 1132, PINGU: «se debería empequeñecer y
  mantenerse abajo»): una tira fija abajo con el principio de lo escrito, sin
  scroll, que al tocarla se abre con todo. Y lo que se escribe en el móvil
  mide 16 px (también `[contenteditable]`), o el iPhone hace zoom (1132). La primera cita va en la caja como `blockquote[data-ancla]`
  y se quita al enviar (`sinAncla`): sale enlazada por `reply_to_id`. Las demás
  se guardan con `citaDeMensaje` (`js/foro-citas.js`: un renglón con
  `#mensaje-<id>` y el contenido) y se visten como la primera al pintar
  (`enriquecerCitas`, 1116): una cita nueva pasa por ahí, nunca «Nombre: texto».
- **Cada sección se presenta con UNA ventana: `js/bienvenida-seccion.js`**
  (tanda 1239, PINGU: «que te explique todas las subcategorías… solo la primera
  vez», y «que le salga a todo el mundo»): las páginas de la sección con su
  frase (`BIENVENIDAS`), «Estás aquí» y cada fila a su página, una vez por
  sección y navegador (`pd-bienvenida-<sección>`), y de nuevo desde el avatar
  («Qué hay en esta sección»). Una página nueva en el desplegable de una sección
  lleva su fila ahí, con su frase; una pestaña nueva de Mi colección, también
  (`pestania`, y `soloCuenta` si /cartas no la tiene). Una ventana que se abra
  sola al cargar mira `dialog:modal`, no `dialog[open]`: los Filtros de Mi
  colección están siempre abiertos con `show()` en el PC.
- **El número de cada sección de la barra sale de `js/numeros-seccion.js`**
  (tanda 1139): no pregunta nada, lee lo que ya cuentan la campanita
  (`window.__pdAvisos`) y el sobre (`#navMsgBadge`), y se repinta con el
  evento `pd-avisos`. Los mensajes privados NO cuentan en Comunidad (1169b,
  PINGU: «tengo un mensaje privado y pone que tengo algo en comunidad»):
  Mensajes no está en su burbuja ni en su cajón, así que van solo en el sobre
  y en el avatar (y en la sección Mensajes de una tienda). Un tipo de aviso nuevo que sea de una sección va en
  `seccionDeAviso` (Comunidad el foro, Jugar los torneos, Colección los
  cambios, cruces, alertas de precio y «la tiene una tienda», 1142; lo que se
  habla con una tienda —ofertas, fotos— es de Mensajes, 1264: llega con su
  mensaje, lo cuenta el sobre y no suma en ninguna otra parte; y Deseos y
  cambios cuenta solo `cambio_*` y `trade_match*`), y en una fila de
  `SECCIONES_AVISOS` (`js/avisos-prefs.js`, 1149: la tabla de Ajustes; sin
  fila cae en «Otros»). Un aviso se cuenta en UN
  sitio (1142, PINGU: «la campana… ¿tiene sentido?»): la campana y el avatar
  del móvil cuentan solo lo que no es de ninguna sección (`avisosSinSeccion`),
  y su lista va en «Para ti» y «En tus secciones» con la etiqueta de color. Y un
  aviso se da por LEÍDO al abrir la página a la que apunta
  (`casaConLaPagina`: misma ruta y sus parámetros, el ancla no cuenta, la
  portada nunca): un tipo nuevo de aviso lleva un `link` a donde se lee. Y
  también al cambiar de vista SIN recargar (1262: un trato anulado dejaba el
  número porque Cruces se abre desde Mercado con `replaceState`): lo que cambie
  la dirección así lanza `pd-ruta-cambiada` después. Y
  TODOS los avisos, leídos también, están en `/avisos` (1168, `js/avisos.js`):
  la misma fila de la campana (`tramosHtml`), por días y meses, con chips por
  sección (`js/avisos-chips.js`); la campana sigue siendo solo lo sin leer y
  acaba en «Ver todos los avisos». Lo que marque leído desde fuera de la
  campana quita de `window.__pdAvisos` y lanza `pd-avisos-cambiados`, nunca
  `pd-avisos` a pelo. Y un aviso del foro se ve en la tarjeta de SU foro y en
  la fila de SU tema («N para ti», `js/foro-avisos.js`, 1183, PINGU: «no sabes
  dónde entrar»): un aviso nuevo del foro lleva un `link` a `/tema/<id>` o no
  sale ahí. Y la barra pegada (`js/barra-pegada.js`) lleva el índice
  de una guía (`indice`) y un botón a la derecha (`accion`, `ponerAccion`): un
  tema la monta UNA vez, no en cada repintado.
- **El perfil es una cabecera ANCHA con su franja, tres losas y, debajo, las
  pestañas con una columna a la derecha** (tandas 1270, 1271 y 1273, PINGU eligió
  lo recomendado): quién es a lo ancho (nombre con su rango al lado, «@ · En
  PokeDoc desde…» por `arrobaHtml`, la descripción en letra de lectura) y la
  FRANJA de progreso (`pintarFranja`, `ponerLogrosEnFranja`: nivel con la barra
  entera y lo que falta, racha, logros y seguidores en caras); las losas de
  colección, guías y torneos (`cifrasHtml`); y a la derecha, en 340 px quietos,
  la tarjeta de cambios (`js/perfil-trueque.js`) y la de seguidores
  (`pintarSocial` → `#perfilSeguidores`). Todo dentro de la columna de 1.160
  (1272, PINGU: «coge todo el ancho»), y en el PC a tamaño de PC (pestañas a 16,
  títulos del Resumen a 20). En el móvil, una columna: lo mismo sin la tarjeta
  de seguidores. Se entra por «Resumen» (`js/perfil-resumen.js`) y nada salta
  solo a otra pestaña; la Vitrina se llama «Colección». Algo nuevo de quién es
  va en la cabecera o en una celda de la franja, no en otra línea de chapas;
  algo de los cambios, en su tarjeta; y una pestaña nueva lleva su bloque en el
  Resumen con su «Ver ›».
- **El perfil tiene la pestaña «Cambios»** (tanda 887, pedida por
  soyfedeegb en el foro): lo que da y lo que busca una persona, con
  vuestro cruce arriba y la chapa «Cambia · da N · busca M» en la
  cabecera. Lo que da sale de `intercambios_de_persona` (migración 887,
  security definer: solo lo que se enseña); lo que busca, de `user_wants`.
  Una pestaña del perfil que llega tarde y puede no tener nada pasa por
  `pestaniaLista(nombre, visible)` (perfil-pestanias.js), no por tocar
  `hidden` a mano; «Su perfil» desde el Mercado y Cruces abre
  `?ver=cambios`.
- **El punto verde de «en línea» es UNO: `marcarEnLinea` de
  `js/en-linea.js`** (tanda 1140): un avatar con `data-en-linea="<id>"` lo
  lleva si esa persona latió en los últimos 15 minutos y no esconde su
  actividad. Una pantalla nueva con avatares pone el atributo y llama a la
  función, no otra consulta a `online_now`. Y lo que va de pestaña a pestaña
  sin guardarse («escribiendo…») va por `difundir` de `js/vivo.js` (nombre de
  canal fijo), nunca por una tabla. Una carta en un mensaje es el adjunto
  `carta`: de una tienda con `stock_id`, desde el clip con `de`. Responder,
  reacciones, fijar y archivar (1141) salen solo si la fila propia de la
  conversación (pedida con `*`) trae `fijada_at`; las reacciones son las del
  foro (`REACCIONES_MENSAJE`), una por persona y nunca a lo tuyo, y una
  respuesta solo cita un mensaje de su conversación (lo impone la base).
  En la app instalada, «tirar hacia abajo para recargar» (`js/tirar-refrescar.js`)
  no arranca dentro de una caja que se desliza por dentro y no está arriba
  (`dentroDeCajaQueSube`, 1259) ni en una página con `data-sin-refrescar`: una
  conversación lo lleva en el `<body>` (se actualiza sola). Una pantalla nueva
  que se actualice en tiempo real hace lo mismo.
  Cambiar de conversación (o volver a la bandeja) NO recarga (1267, PINGU:
  «te recarga toda la página. No debería»): `pintarDireccion` pinta lo que
  dice la dirección, un clic en captura a otra vista (`esOtraVistaDeMensajes`)
  hace `pushState` y `popstate` hace lo mismo. Lo que el hilo engancha FUERA de
  su caja (ventana, documento, sondeo, vivo) lleva el `signal` del hilo o va en
  `alSoltar`, o seguirá vivo en la conversación siguiente.
- **Las fotos de los mensajes privados van en un cubo PRIVADO y se piden
  FIRMADAS** (tanda 891). `mensajes-adjuntos` no es público: una carpeta
  por conversación y `mensajes_adjunto_es_mio(name)` en las tres políticas;
  el navegador pide `createSignedUrls` (`js/mensajes-adjuntos.js`, con
  caché) y nunca `getPublicUrl`. Lo que se sube se comprime antes en el
  navegador (`js/imagen-comprimir.js`, 1.600 px y WebP) — si añades otra
  subida de fotos de la gente, pasa por ahí. Borrar un mensaje es marcar
  `deleted_at` («Mensaje eliminado»), no quitar la fila; y lo puro del chat
  (días, visto, no leídos, resumen) vive en `js/mensajes-puro.js`.
- **La imagen que se comparte de un reto lleva siempre el marco** (tanda
  907): la marca y el número arriba, qué es (`lema`), la invitación con
  su enlace y la medalla y la racha (`pintarResultadoReto`), y la foto
  TAPADA (924: desenfocada y con «?», que es la respuesta; ni su nombre en
  `detalle`). Un reto nuevo
  le pasa su `numero` y su `lema`, no un «Reto #N» en el detalle. Lo que
  sale de las preguntas del día (la portada, la chapa) dice el TEMA y no
  el enunciado: el reto es el mismo para todos y no se destripa.
- **Un reto con cartas no sale con una carta sin foto** (tanda 1111, PINGU:
  «que no se pueda entrar al juego»): una COLUMNA de foto llena no es una
  foto que exista. Quien elige pasa por `conFoto` (`netlify/lib/fotos-reto.mjs`,
  que pregunta a la cadena de verdad), la función acepta `?revisar=1` (cambia
  lo que no tenga foto en el día guardado y lo reescribe) y la página entra
  por `traerRetoConFotos` (`js/reto-fotos.js`). Cierra el reto el SERVIDOR
  (`sinFoto`), nunca el navegador solo: lo que no carga aquí puede ser la red
  de quien juega. Un reto nuevo con cartas pasa por las tres cosas.
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
  arriba con `{ arriba: true }`. Su CSS es `css/paginacion.css` (1114): una página que lo
  pinte carga esa hoja. Y el foro ya
  no anuncia «[[Arven]]» en ninguna parte (PINGU: «yo lo obviaría»): el
  código de la 819 sigue, pero no se promete.
- **Los retos son seis y el sexto es «Parejas»** (tanda 989): «El reto de
  hoy» (el quiz) salió de `RETOS`, de la portada y del onboarding, y `/reto`
  es un 301 a `/retos`. Un reto nuevo es una entrada de `RETOS`
  (`js/retos-xp.js`), su rama en `retos_xp` (la base) y en la regla de
  `retos_resultados_juego`, en la MISMA migración, y su ficha en el menú.
  El menú de /retos cabe en una pantalla del móvil: lo que no es jugar va
  plegado en «Tu historial» y se carga al abrirlo; si añades algo, va ahí.
  En el PC (desde 1.000 px) la liga de la semana va AL LADO (1154,
  `js/retos-liga.js`: los cinco primeros y tú, de `portada_clasificacion`)
  y los retos a dos columnas; en el móvil esa columna no se pide.
  Y cada final con cuenta dice cómo te mueve en la liga (`data.liga` de
  `guardarResultado`, pintado por `premiosHtml`).
- **Una imagen para redes lleva EL MARCO: `js/redes-marco.js`** (tanda
  1156, PINGU: «que sea todo igual para mantener la concordancia»): el
  degradado de la web con el brillo del color de la SECCIÓN (`acentoDe`),
  arriba el logo y «PokeDoc» con una chapa de lo que es, el título en Outfit
  con lo destacado entre `*asteriscos*`, la pieza en la `caja` que devuelve
  `pintarMarco` y la dirección abajo, en tres tamaños («historia» es la
  publicación de 1080×1350, «larga» la historia de 1080×1920 con
  `historiaPropia`, y «apaisada»). Un generador nuevo pinta su pieza dentro de
  la caja, no otro fondo ni otra cabecera; los retos, la vitrina y las
  partidas ya llevan su fondo y su marca. Las letras y el logo se piden antes
  del primer trazo (`prepararMarco`, que llama la hoja de compartir): un
  lienzo con una fuente que no ha llegado pinta con otra sin avisar. Las
  piezas sueltas (un concurso, un carrusel) las hace Claude con esta misma
  plantilla; no hay generador en /admin (PINGU quitó el de Redes en la 991).
  La tarjeta del ENLACE de una noticia (1157) es la apaisada del marco: la
  dibuja el editor al publicar (`tarjetaDeEnlace`, en JPEG) y va en
  `guides.og_image`, que `meta-social.js` pone delante de la portada; las
  fijas de los retos y `og-default.png` salen de
  `herramientas/tarjetas-1157.mjs` (rama pruebas). Una destacada de
  /novedades se saca en imagen con «Imagen para redes» (solo el equipo,
  `js/novedad-imagen.js`).
- **Una fiesta (Halloween, 1134) la decide la línea de `data-temporada` de la
  cabecera** de las 52 páginas, por fecha y antes del primer pintado, con su
  hoja (`css/temporada.css`) escrita solo ese día; lo que se enseña de más va
  en `js/temporada.js` (el pop-up «¿Truco o trato?», 1136: una vez por persona,
  `pd-halloween-visto`, nunca encima de otra ventana ni preparando la página).
  Un navegador automático no la ve (`navigator.webdriver`) salvo con
  `?temporada=halloween`: una prueba de una fiesta la enciende así.
  Desde la 1285 esa línea la escribe `generar-temporada.mjs` (`LINEA`): una
  fiesta nueva se añade ahí y se corre el generador, nunca a mano en las
  páginas. El Calendario de Adviento (1285) va por `data-adviento` (sitio
  reservado en Inicio) y lo abre y lo paga la base (`adviento_abrir`, fecha de
  Madrid): la XP o un logro de una fiesta pasan por una función así, nunca por
  el navegador. El rojo de las fiestas es `--adv-*`/`--fiesta-*` (identidad).
  La Navidad (1286) va con los colores de cada uno (no fuerza el oscuro) y su
  decoración no tapa NADA: la nieve son `html::before/::after` con `z-index:
  -1` (detrás del contenido), la guirnalda y el gorro no se pulsan. Un pop-up
  de fiesta sale una vez por persona, nunca encima de otra ventana ni a una
  tienda, y una fiesta nueva con hoja va en `FIESTAS_CON_DECORACION`
  (`js/fiestas-puro.js`) para que el interruptor de Ajustes la apague. Una
  fiesta de UN día dentro de la Navidad es `data-fiesta` (1287), y su módulo se
  engancha en `js/fiestas.js` (app.js solo entra ahí). La broma de Inocentes
  cambia lo que `dittoDe` reconoce por su dirección: una carta, un precio o un
  texto no se tocan nunca. Una cuenta de una fiesta (Nochevieja, 1288) es en
  hora de ESPAÑA (`hoyEnEspana`), no la del aparato, y «Tu año» sale de tus
  filas (`datosDelAnio`): una cifra a cero no se enseña. Y lo que una fiesta
  REGALA sale de lo tuyo y con la regla de siempre (Reyes, 1289: tu «La quiero»
  al precio de la ficha, `valorDe`): nada inventado, sin precio no entra.
- **Lo que no existe se pinta CON SALIDA** (tanda 1149): una guía, noticia,
  tema o persona que no está pasa por `pintarNoEncontrado` (`js/no-encontrado.js`:
  la mascota de la 404, el buscador relleno con la dirección y las parecidas), y
  un error de la base que no sea «sin fila» por `pintarSinRespuesta`, que no es
  lo mismo (la 510). Una ficha nueva que pueda no existir hace igual.
- **Los eventos de la agenda (/eventos, 1192–1197) los da de alta el equipo
  en /admin → Eventos** y lo puro vive en `js/eventos-puro.js` (días con su
  horario en `horario`, entradas en `entradas`, el .ics, el título y el primer
  mensaje del hilo). Al publicar uno se abre su hilo en el foro «Eventos y
  quedadas» (slug `eventos`, solo el equipo abre temas) y se apunta en
  `eventos.hilo_id`; editar el evento pone al día el primer mensaje, que lleva
  el enlace «a pelo» a la ficha y el foro lo pinta como su tarjeta
  (`js/enlaces-internos.js`). «Voy» es una entrada (`voyHtml`), y la franja de
  arriba sale del logo difuminado (`.ev-ambiente`), no de un cartel que casi
  nunca habrá.
  El hilo lo firma PokeDoc (1198): lo abre `evento_hilo` sin autor y con
  `de_pokedoc`, y la web pinta «PokeDoc» con `firmaPokedoc` /
  `PERFIL_POKEDOC` (`js/foro-comun.js`). Algo nuevo que escriba en el foro
  como PokeDoc pasa por una función así, nunca por un insert del navegador.
- **Un reto diario no lleva su respuesta a la página: la corrige la base**
  (tanda 1268, PINGU: «para que ningún listillo haga trampa»). La función del
  día parte lo que elige con `netlify/lib/reto-mesa.mjs`: la MESA (sin ids,
  precios, la buena ni la foto nítida) va a la página y lo del árbitro a
  `retos_arbitro`; cada jugada pasa por `retos_jugar` (`js/reto-arbitro.js`,
  `partida(juego)`), que con cuenta guarda la partida en `retos_partidas` y
  apunta la XP al acabar (`retos_guardar` ya no se llama desde fuera), y sin
  cuenta la lleva en una ficha cifrada. Las fotos de un reto van por
  `/reto-foto` con la dirección cifrada y ya borrosas o en silueta
  (`urlDeFoto`), nunca la nítida con CSS encima. Lo que elige el día lleva la
  semilla del servidor (`semillaDelDia`). Un reto nuevo: su `partir…`, su rama
  en `retos_mover`/`retos_vista`/`retos_resultado` y su prueba en
  `test-tanda-1268`; y si cuenta algo que la web también cuenta (las casillas
  de la carta), la prueba compara las dos.
- **La entrada de /admin es «Hoy»** (tanda 1119, `admin/js/hoy.js`): lo que
  espera a alguien va en `ESPERAS` (tabla, filtro y fecha) y sale en tarjeta y
  con su número en el menú (`ponerContadorNav`); una cola nueva que espere al
  equipo es una entrada más ahí, no otra cifra suelta. Nada de cifras de
  adorno en «Hoy»: eso es Analítica.
- **Los avisos del equipo son la tabla `avisos`** (tanda 1260, PINGU: «los
  avisos eran un poco pochos»; antes, UN JSON en `site_settings.aviso_global`,
  que sigue saliendo solo sin la migración): varios a la vez, cada uno con sus
  `sitios` (pop-up una vez por persona, franja, tarjeta de Inicio y campanita),
  su imagen (cubo público `avisos`), su botón y sus fechas. El botón LLEVA a un
  enlace por defecto, también en un concurso (1260b, PINGU: «debería ser un
  enlace… apuntarme sería cuando hago un concurso para usuarios registrados»):
  la lista de «Me apunto» (`participar`) se elige a propósito en el editor. Las reglas y las CUATRO piezas que se pintan (`popHtml`,
  `franjaHtml`, `tarjetaHtml`, `campanitaHtml`) viven en `js/aviso-puro.js`:
  las pinta la web (`js/aviso-global.js`, `js/aviso-pop.js`) y la vista previa
  de /admin → Avisos, así que un campo nuevo va ahí, no en otra copia. Un sitio
  nuevo va en `SITIOS_DE_AVISO`, en el `check` de la base y en las dos
  pantallas; un tipo nuevo, en `TIPOS_DE_AVISO` y `PLANTILLAS`. Las cifras
  van por `aviso_contar` (sin quién, una vez por navegador), apuntarse por
  `aviso_apuntarme`, sortear por `admin_aviso_sortear`, y la campanita por
  `admin_aviso_avisar` (al publicar) o `avisos_al_dia` (cada hora, entre las
  10 y las 22): nunca un insert del navegador. `?aviso=<id>` abre su pop-up en
  cualquier página (el enlace de la campanita); una tienda solo ve el de
  mantenimiento.
- **En /admin, «Cartas» es «Marcas legales»** (tanda 1123): las marcas de
  la temporada y, plegadas, las herramientas de diagnóstico. El catálogo se
  llena solo (TCGGO); la marca de cada set y su código de TCG Live se corrigen
  en Colecciones. No vuelvas a poner un importador o un botón de pasada a mano
  en el panel: si una pasada falla, lo dice el semáforo de «Hoy».
  La excepción es «Actualizar desde TCGGO» en el editor de un set (1275, PINGU
  la pidió): las MISMAS pasadas para UNA expansión (`soloEpisodio` en catálogo y
  precios, `soloExpansion` en productos), paso a paso por `tcggo-set-ahora`. Lo
  nuevo que haya que traer de un set va como un paso más ahí (`PASOS`), no en
  otro botón.
  Y una expansión occidental que TCGGO da SIN `cardmarket_id` (Delta Reign,
  1275b: precios sí, ids no) no para el emparejador: se apunta `sinCm` y los
  precios casan por el `tcggo_id` de nuestras cartas, como el japonés. Nunca
  se inventa un id de Cardmarket para ella.
- **Los textos de los correos los cambia el equipo** (tanda 1122,
  `correo_textos`): asunto como plantilla con `{asunto}`, texto de arriba,
  botón y pie, por tipo. Lo que pinte un correo pasa por `renderFilaDeCola` /
  `renderEmail` con sus `textos` (send-emails los lee una vez por pasada); un
  tipo nuevo de correo va en `EJEMPLOS_DE_CORREO` para salir en el panel.
- **Silenciar y banear llevan motivo y duración** (tanda 1121): se hace por
  `admin_moderar` / `admin_moderar_quitar` (registro en `moderaciones`) y lo
  vencido lo levanta `moderacion_al_dia()` cada hora. Lo que se CUMPLE sigue
  siendo `is_muted` / `is_banned`: una política o pantalla nueva mira esas
  columnas, no la tabla. Un rol nuevo de una persona va en `ROLES` de
  `admin/js/usuarios-admin.js` (y su filtro en `FILTROS`), no en otro botón.
- **El nivel sale SIEMPRE, también «Novato»** (tanda 1137, PINGU: «los que no
  tienen experiencia deberían tener el nivel mínimo»), en Gente y en el foro.
  Y una cifra de «guías» cuenta `kind = 'guide'`: en `guides` viven también
  las noticias.
- **Los niveles de XP y los rangos de colaborador viven en `js/niveles.js`**
  (tanda 1124: diez niveles, de Novato a Maestro con 25.000; rangos Miembro,
  Colaborador, Destacado y Leyenda). Es puro: lo importan la web y la
  insignia de las firmas, sin copias. Un cambio de umbrales va ahí Y en
  `nivel_de_xp` (una migración que además recalcule `level`), y
  `test-tanda-387` compara los dos. Las cifras de XP se pintan con `milesXp`.
- **Lo que se gana en el perfil son «Logros»** (tanda 1117, PINGU: «vamos a
  escoger un nombre para todo»): ni medallas ni trofeos (la medalla de un
  curso es otra cosa). La pestaña es `logros` (`medallas` y `about`, alias), y
  un logro se abre con `abrirLogro` (`js/logro-ficha.js`): lo que hiciste o el
  objetivo (`objetivoDeLogro`, por su condición). Un tipo de condición nuevo
  lleva su frase en `FRASES` y su fila en `TIPOS` de `js/logro-objetivo.js`
  (de ahí sale el desplegable de /admin). Los logros se editan en /admin →
  Logros (`admin/js/logros-admin.js`, 1118), y se dan o quitan a mano solo
  por `admin_logro_dar` / `admin_logro_quitar`, que mueven su XP y lo apuntan
  en `logros_a_mano`: no escribas `achievements` de otra persona a pelo.
- **El Pokémon de un tema de Aprender sale de `pokemonDelTema`**
  (`js/temas-pokemon.js`, tanda 1226, PINGU: «unos Pokémon ahí random»):
  `categories.pokemon` y, sin ella, las palabras del nombre; lo que no casa
  lleva su icono. Nunca `pokemonDe` (una cuenta con el slug) para un tema.
- **«Leída» va en la ESQUINA de la portada de una guía, no debajo** (tanda
  1230, PINGU: «para que no haya cambio entre uno y otro»): `.guia-portada-leida`
  arriba a la izquierda en `--acento`; dentro de `.guia-portada-sobre` solo van
  tema, título y barra, para que nada suba ni baje entre una leída y una sin
  leer. Y Guardados es de guías y noticias: los temas del foro que sigues no
  salen ahí (PINGU: «ocupa demasiadísimo»).
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
- **Una guía o noticia abre con SU portada: `js/articulo-cabecera.js`**
  (tanda 1283, PINGU: «más moderno, más visual»), pura, y la pintan las dos
  mitades de abajo con la misma función; el servidor deja el hueco de la franja
  (`franjaReservadaHtml`). Lo nuevo de la cabecera va ahí, no en una copia. Una
  caja del texto (Consejo, Ojo, Dato) es una cita con su clase y el rótulo lo
  pone el CSS; un tipo nuevo va en `CAJAS` (richtext-editor), en
  `CLASES_PERMITIDAS` y en guia.css a la vez.
- **El texto del artículo lo pintan DOS mitades** y tienen que coincidir:
  `js/guia.js` en el navegador y `netlify/edge-functions/meta-social.js`
  en el servidor. Si cambias los envoltorios (`.article-header`,
  `.article-body`) en una, cámbialos en la otra — si no, lo primero que
  ve la gente es el texto sin formato y luego pega un salto.

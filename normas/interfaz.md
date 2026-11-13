# Interfaz y CSS — normas de PokeDoc

> Capítulo de CLAUDE.md (tanda 1333, I4): CSS y sus escalas, el móvil, botones, pop-ups, barras generadas, service worker, accesibilidad y SEO. Se lee ENTERO antes
> de tocar esta área. Una norma nueva de esta área va aquí; si vale para
> toda la web, en CLAUDE.md.

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
- **Un botón que escribe en la base cambia YA, confirma después y deshace
  si falla** (tanda 896, R6): el patrón de «Seguir» un hilo, aplicado a
  marcar leído, guardar una guía, «La quiero», el check-in y meter en un
  álbum. No se apaga a esperar: se pinta como queda, y si la base dice que
  no, se vuelve (o se recarga, cuando el estado de verdad es la página
  entera) con su aviso. Un botón nuevo que escriba algo va así.
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
- **Una página tiene UNA dirección para Google** (tanda 906). La canónica
  la arma `urlCanonica` (meta-social.js): sin `.html`, en pokedoc.es y solo
  con los parámetros que eligen el contenido (`PARAMETROS_CANONICOS`); la de
  un artículo es `rutaDeArticulo`. Una página fija nueva declara su
  canónica sin `.html` (lo vigila `test-tanda-906.mjs`), y lo que no debe
  salir en Google (entrar, buscar) va en `noindex,follow` y fuera del
  sitemap. Y antes de abrir miles de páginas a Google, mira en Search
  Console cuántas tiene «descubiertas sin indexar»: si la cola ya es
  larga, abrir más la alarga.
- **La imagen de un enlace la dibuja el servidor** (tanda 1201, PINGU: «para
  cualquier enlace… una imagen que tenga que ver con lo que compartes»):
  `meta-social.js` pone `meta.tarjeta` en cada página con datos y de og:image
  `/tarjeta/<ruta>.png?v=<huella>` (`urlDeTarjeta`); la función `tarjeta` la
  vuelve a calcular con `metaDeRuta` y la pinta (`netlify/lib/tarjeta-svg.mjs`,
  resvg + sharp). Una página nueva con datos pone `tarjeta` en su `metaDe*`;
  una fija, su entrada en `netlify/lib/tarjetas-fijas.mjs` y la dirección en su
  HTML. Y resvg-js en Node NO hace caso de `fontBuffers`: las letras van por
  `fontFiles` (escritas en `tmpdir()`), o sale todo en la letra del sistema.
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
- **La barra de abajo del móvil se GENERA** (tanda 753): va escrita en las
  36 páginas con barra de arriba, entre `<!-- barra-movil … -->` y
  `<!-- /barra-movil -->`, para estar en el primer pintado y en la
  transición entre páginas (`@view-transition`, solo móvil y sin «menos
  movimiento», en `style.css`). No la edites a mano: si cambias la barra de
  arriba o las secciones, `node generar-barra-movil.mjs && node
  generar-cartas.mjs`; `test-tanda-753-pantalla.mjs` comprueba que el repo
  lleva lo que sale del generador. Y tras tocar los `import` fijos de una
  página (o crear una), `node generar-precargas.mjs` (1315: sus
  `modulepreload`, nunca lo de `import()`; lo vigila `test-tanda-1315`). `js/barra-movil.js` la remata (Cartas →
  Mi colección con cuenta), no la crea.
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
  abrirse al momento, va en `SIN_PAGINA`. Desde la 1311 no pregunta fichero a
  fichero: el despliegue escribe `huellas.txt`/`huellas.json`
  (`herramientas/generar-huellas.mjs`, nunca a mano ni en el repo) y lo que
  no casa con su huella no se guarda. Y **`route` de Playwright NO
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
  mezcla, `js/error-log.js` recarga una vez (`tocaRecargar`). Y un `import()` que se ATRAPA en un `try` pasa
  el error por `recargarSiDesajuste` (1236b): si no, la pantalla pinta el
  «Importing binding name…» y la recarga no salta nunca. Un error de
  import en el panel justo después de un push es esto antes que un export
  que falta: `test-imports` lo distingue en un segundo.
- **Los botones son tres clases, y en pastilla** (tanda 917; pastilla de 44 px desde la 1225, PINGU: «los redondillos ocupan menos»): principal (`.btn-primary`),
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
  botón no pide letra (hereda). Fredoka ya no existe (1156): lo que se dibuja
  en un lienzo también va en Outfit. **Y cada sección tiene su color** (`--acento` /
  `--acento-texto`, por `data-seccion` en `<html>`, que escribe
  `generar-barra-movil.mjs`): la barra de abajo, la burbuja, la lateral y
  `.btn-primary` lo llevan solos. Un color nuevo va en los DOS temas con sus
  dos medidas de contraste (SCHEMA 1018) y `test-tanda-1018.mjs` lo mide.
  La burbuja flotante del móvil SE QUEDA (PINGU, 2026-10-26: «lo único que
  no me gusta es que me cambies la burbuja»): no la muevas arriba.
  En oscuro, el acento por defecto (Inicio, auth, ajustes) es `--navy`, el
  azul claro, con texto oscuro (1024, PINGU: el marino «parece
  deshabilitada»); y el cajón de Inicio en la lateral no repite la portada
  (`paginasDe`): la burbuja del móvil sí la lleva. La página activa dentro del
  cajón de la lateral también va en `--acento` (1025), no en `--navy`.
- **En el móvil nada flota sobre el contenido salvo la barra y la burbuja**
  (tanda 1023, regla 1 de «PokeDoc como app»): un botón «siempre a mano»
  va en la cabecera o pegado bajo las pestañas, no fijo sobre las
  tarjetas (el rosa del foro y la barra de Guardar del constructor ya se
  fueron). Lo vigila `test-tanda-1023-pantalla.mjs`: 34 páginas con los
  fixtures de `pruebas/fixtures-app.mjs`, como mucho dos fijos abajo y
  nada pulsable tapado al final. Una página nueva de lista va en su
  lista. Y una página de detalle (fuera de la lista de su sección) lleva
  `data-detalle` del generador: cabecera de app (1019) y transición
  deslizante (1023) solas. **La única excepción es el Modo evento de Deseos
  y cambios** (1041, PINGU: «como teníamos antes lo de escribir en el
  foro»): una burbuja encima de la de Mi colección, con un hueco al final de
  la lista, y la prueba la nombra (`EXCEPCION`). Otra no se añade sin que
  PINGU la pida.
- **Un pop-up va CENTRADO, con tope de alto, y se desliza su cuerpo**
  (tanda 1045, PINGU: «los pop-ups me gustan que estén centrados»): en el PC
  `inset: 0; margin: auto` y `max-height` (nunca `none`: un `dialog` es
  `fit-content` y sin tope crece más que la pantalla, y entonces la rueda
  mueve la página de detrás); el cuerpo con `overflow-y: auto` y
  `overscroll-behavior: contain`, y la página quieta con
  `html:has(.x[open]) { overflow: hidden }`. En el móvil, hoja desde abajo.
  Un panel al lado que no tapa la rejilla (filtros, ficha de producto) no es
  un pop-up. Mira `.cp-dialogo` o `.ficha-rapida`.
- **La web va en una columna de 1.160 px, y solo las rejillas de cartas
  crecen** (tanda 1161, PINGU eligió lo recomendado): desde 1.800 px de
  ventana, `.mc-pagina` sube a 1.440 (6 → 8 cartas por fila) salvo con el
  Panel a la vista. Lo que se lee (portada, foro, guías, noticias, perfiles) se
  queda en su columna. Una pantalla nueva que sea una rejilla de cartas fuera de
  Mi colección lleva la misma regla.
- **El hueco de abajo es `var(--seguro-abajo)`, nunca `env(safe-area-inset-bottom)`
  a pelo** (tanda 1135): iOS a veces lo deja con el alto del teclado y la barra
  de abajo crecía hasta media pantalla con la burbuja flotando. El token lleva
  tope (48 px) y lo vigila `test-tanda-1135.mjs`.
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
- **Nada se pisa, ni con textos largos** (tanda 1233, PINGU: «pisotones entre
  objetos»): `test-tanda-1233-pantalla.mjs` alarga los textos y falla si dos
  cosas pintadas se montan o dos cajas con borde quedan pegadas. Una línea con
  `nowrap` lleva su salida (`ellipsis` o que pueda partirse), una caja que
  estira su lista no la aplasta (`min-height: 0` con filas de contenido) y lo
  que se monta A PROPÓSITO va con margen negativo o posicionado. Una página
  nueva de lista entra en sus `RUTAS`.
- **Una tarjeta se mide a SÍ MISMA, no a la ventana** (tanda 316). Con la
  ventana en 960 px la misma tarjeta de guía mide 264 px en la portada y
  432 en /aprender; con la ventana en 600, 552. «Pantalla más grande»
  puede significar «tarjeta más pequeña», así que un `@media` es la
  herramienta equivocada: lo que responde al ancho de su caja va con
  `container-type: inline-size` + `@container`.
- **Miles de páginas casi vacías hunden el dominio, no lo suben** (tanda
  322). Es contenido escaso generado en masa, y castiga al sitio entero y
  no solo a esas páginas. Antes de generar una página por fila de una
  tabla, contesta qué tiene esa página que no tenga la de al lado — y si
  la respuesta no existe todavía, esa página nace en `noindex`.
- **Un `display` suelto en un `<dialog>` lo deja A LA VISTA SIEMPRE**
  (tanda 473). Lo que esconde un diálogo cerrado es una regla del
  NAVEGADOR —`dialog:not([open]) { display: none }`—, así que un
  `display: flex` en el selector a secas la pisa y el panel no se cierra
  nunca. No da ningún error y en una captura puede no notarse. Va siempre
  en `[open]`, y lo prueba una comprobación de que al cerrar deja de
  verse — no de que el atributo `open` sea false, que sí lo era.
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

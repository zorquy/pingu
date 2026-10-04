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
  CSS) debe caber en 170 KB gzip. **A 2026-10-02 van 169,9 y queda 0,1**
  (medido con `pesar-portada.mjs`; el 169,3 de la nota vieja se quedó
  atrás). O sea: CIEN BYTES. La próxima tanda que toque la portada no
  cabe, y punto —tiene que empezar por hacer sitio—. Historia: el pie de
  la tanda 312 está en las 22 páginas y suma, la 313 sacó el editor de
  texto rico a `css/editor-texto.css` para hacer sitio, y la 319 le metió
  a la portada la consulta del progreso. El candidato para hacer sitio es
  `components.css` (26 KB gzip, el mayor de los que baja todo el mundo). Antes de meter nada más en la portada, haz sitio —
  `pesar-portada.mjs` dice quién ocupa qué— y el camino es siempre el
  mismo: lo que solo usa una pantalla, a su hoja. `components.css` y `js/app.js` los
  baja TODO el mundo — el CSS o JS de una sola página va en su propio
  fichero (mira css/lanzamientos.css o css/curso.css como ejemplo).
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
- **Un `return` que esconde tres finales distintos es un SILENCIO** (tanda
  510). `/cartas` tenía `if (error || !data?.length) return`, así que si la
  consulta fallaba la página se quedaba con el título «Colecciones» y un
  hueco debajo, sin un solo aviso — y es la página PÚBLICA del catálogo, la
  primera que ve quien llega de fuera. Son tres estados y cada uno dice una
  cosa distinta: **no se ha podido preguntar** (nuestro, se reintenta), **no
  hay nada** (raro, pero es una respuesta) y **hay pero el filtro no deja
  pasar ninguna** (un fallo del filtro). Juntarlos en un `return` convierte
  los tres en «la página está en blanco y no sabrás por qué».
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

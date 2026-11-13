# Jugar y torneos — normas de PokeDoc

> Capítulo de CLAUDE.md (tanda 1333, I4): Torneos (el porte de TrainerArena), Mis partidas, mazos, el motor y el laboratorio. Se lee ENTERO antes
> de tocar esta área. Una norma nueva de esta área va aquí; si vale para
> toda la web, en CLAUDE.md.

- **Los dos Pokémon de un mazo salen de `js/sprites-de-mazo.js`** (tanda
  1221): `spritesDeMazoGuardado(cards, filaDe)` para uno guardado (de su lista,
  como el arquetipo de Mis partidas) y `spritesDeNombreDeMazo(nombre)` para uno
  del que solo se sabe el nombre (una repetición). Una pantalla nueva que
  pinte un mazo con sus Pokémon pasa por ahí. Y el dibujo oficial de un
  Pokémon (portadas de guía, Glosario, Novedades) es `js/arte-pokemon.js`:
  quien solo quiere el dibujo no importa `guia-portada.js`, que arrastra las
  clases de la portada (la 299 lo cuenta). El foro ya no tiene «Lo que se está
  hablando» (PINGU, 1221: «ya tienes a la derecha lo de lo último»): no lo
  vuelvas a poner, ni en el móvil.
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
  Desde la 1281 la ficha de las de TCGGO va EN LA BASE (migración desde
  tcgdex/cards-database y copiando la original de cada reimpresión), pero
  **una expansión nueva que llegue de TCGGO nace otra vez sin categoría**:
  hasta que se automatice, se le hace lo mismo (SCHEMA 1281).
- **Una partida o un torneo de /mis-partidas se comparte en una imagen**
  (tanda 997): `js/partida-imagen.js` (por `import()`) con la hoja de
  siempre y el marco de los retos (`cabecera` e `invitacionAbajo` de
  `reto-imagen.js`). Los sprites, los mismos de la tarjeta
  (`urlsDeSpritesDeMazo`), por `/sprite` y la cadena de respaldos, que un
  lienzo con una imagen sin permiso no se exporta. La historia la dibuja
  ella entera (`historiaPropia`, 997b) y abajo va la marca, sin «Apunta las
  tuyas» (PINGU: «muy cargante»). Desde la 1070 (Ibai: «varias opciones
  para todos los gustos») un torneo tiene cuatro DISEÑOS y los dos, tres
  FONDOS, más «Mi puesto»: los ofrece la hoja con `opciones` y recuerda lo
  elegido. Un diseño nuevo es una función más en `DIBUJO` que pinta en las
  tres formas (`larga`, `historia`, `apaisada`) y pide los colores a la
  paleta `P`, nunca un `#fff` suelto: en «Claro» el texto es oscuro, y en
  «Color» lo que iría del color del fondo va en blanco.
- **«Tu mazo» en /mis-partidas sale de tus mazos guardados o a mano, y es
  UNO: `js/partidas-elegir-mazo.js`** (tanda 1070), en el torneo y en la
  partida suelta. El arquetipo de un mazo guardado se DEDUCE de su lista y se
  enseña («Cuenta como…»); al EDITAR se respeta el que la fila ya tiene (que
  una partida cambie de casilla en la matriz por abrirla es lo que no puede
  pasar). Las rondas de un torneo copian su mazo guardado como copian el
  arquetipo, y lo arrastra el disparador. El mazo predeterminado vive en
  `match_log_ajustes`, privada: nada de lo que dice a qué juegas va en
  `user_profiles`.
  Las rondas de un torneo de PokeDoc se ordenan y se nombran por su
  `round_number` (1133: `ordenDeRondas`, `rotuloDeRonda`, «J4·R1» en una
  liga), nunca por su sitio en la lista; el bye va solo a la tarjeta.
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

**Las jornadas de una liga se cuentan en `js/torneos/liga-en-curso.js`**
(tandas 1302 y 1303, PINGU eligió la J1 y la T1): qué jornadas están hechas,
cuál es la siguiente, la víspera, la recién terminada y la clasificación. Lo
usan la franja «Ligas en curso» de /torneos (`js/torneos/ligas-franja.js`) y la
función `ligas-jornadas`, que avisa la víspera (Telegram y campanita
`torneo_jornada`) y los resultados, una vez cada uno por
`tournament_matchday_avisos`. Algo nuevo que hable de las jornadas de una liga
pasa por ahí, no por otra cuenta.

**Los arquetipos (tanda 230) NO se guardan**: se deducen de la decklist
al pintarla. Eso es lo que hace que la regla de visibilidad no se pueda
equivocar — se ve el mazo de alguien exactamente cuando la base deja ver
su lista (torneo terminado, o de lista abierta en juego). Si algún día
lo cacheas en una columna, te llevas esa garantía por delante.

El motor puro (pareos suizos,
desempates, top cut, decklists) está en `js/torneos/motor.js`,
traducido 1:1 de `libs/engine` de TrainerArena — si tocas su lógica,
respeta la SPEC de TrainerArena y anótalo.

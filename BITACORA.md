# Bitácora de cambios — PokeDoc

La entrada MÁS RECIENTE va ARRIBA. Cada sesión de Claude añade la suya
antes de cada push (ver CLAUDE.md). Formato:

```
## AAAA-MM-DD HH:MM — QUIÉN (PINGU-Claude / IBAI-Claude)
**Hecho**: qué se ha hecho, en una o dos frases.
**Ficheros**: los tocados (los nuevos, marcados).
**En curso / pendiente**: lo que queda a medias o para el siguiente.
```

---

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

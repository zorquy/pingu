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

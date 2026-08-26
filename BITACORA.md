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

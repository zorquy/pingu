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
  CSS) debe caber en 170 KB gzip. `components.css` y `js/app.js` los
  baja TODO el mundo — el CSS o JS de una sola página va en su propio
  fichero (mira css/lanzamientos.css o css/curso.css como ejemplo).
- **Iconos SVG de js/icons.js, nunca emojis sueltos en la interfaz**
  (única excepción deliberada: la banderita 🇪🇸).
- **Los tamaños de letra salen de la escala** (`--t-2xs`…`--t-3xl` en
  `:root`, tanda 305), nunca un número suelto — ni en las hojas ni en un
  `style="font-size:…"`. Si te hace falta uno que no está, casi siempre
  es que el sitio pide otro paso: mételo en `:root`. La única excepción
  es un avatar pintado a un tamaño concreto, donde la inicial crece con
  el diámetro del círculo y no con la escala.
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

**Estado a 2026-09-15**: cubiertos torneos (8 pruebas, más la de la
vista previa al compartir, las dos del registro de partidas y las de
permisos contra PostgreSQL de verdad), el foro —índice, lista de temas y
vista de un tema— (2), la PORTADA y /aprender (tanda 299), /usuarios
(301), la escala tipográfica y los esqueletos de artículo (305) y las
dos fichas de persona —/perfil y /usuario— con la lista de inscritos de
un torneo (306). El CONTENIDO de una guía y de un curso (más allá de su
esqueleto) y /noticias siguen SIN cobertura: un cambio ahí sale a
producción sin red debajo. Del foro faltan las piezas de alrededor
(encuestas, no leídos, suscripciones, búsqueda, menciones, moderación).

**El rigor rompe el repo a propósito: no commitees mientras corre.**
Un script de rigor muta un fichero de verdad, pasa las pruebas y lo
restaura. Si el contenedor se muere a mitad (pasó el 2026-09-15, y antes
el 2026-08-28), el fichero se queda ROTO en disco y el árbol tiene pinta
de estar listo para subir — y Netlify despliega esta rama en directo.
Desde la tanda 301 el andamio común (`rigor_comun.py`, en la rama
`pruebas`) guarda el original en disco antes de tocarlo y lo deshace solo
al arrancar la siguiente pasada. **Pasa `comprobar-arbol.sh` antes de
cada commit**: canta si quedó alguna mutación a medias.

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

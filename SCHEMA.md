# Esquema de Supabase (confirmado)

Este documento describe el esquema **real** de tu proyecto Supabase
(`zqamujmfavwrsqlgbead`), tal como lo confirmaste desde el SQL Editor. No se
ha modificado ninguna tabla, columna, dato ni política RLS — esto es
documentación de lo que el frontend (`js/*.js`, `admin/js/admin.js`) lee y
escribe.

## `categories`
`id` (uuid, PK) · `slug` (único) · `name` · `description` · `emoji` ·
`order_pos` · `guide_count` (mantenido por `/admin` tras crear/editar/borrar
guías — no hay trigger en la base de datos, así que si se edita `guides`
desde fuera de este panel, este contador puede desincronizarse) ·
`cover_image`.

## `guide_collections`
Agrupan guías dentro de una categoría (por ejemplo, una serie de artículos
relacionados). `id` · `title` · `slug` · `emoji` · `description` ·
`category_id` (FK → categories) · `created_at`. `categoria.html` las usa
para mostrar cabeceras de sección cuando una guía tiene `collection_id`.

## `guides`
`id` · `slug` · `title` · `description` · `category_id` (FK) · `blocks`
(jsonb, bloques del curso interactivo) · `is_pro` (bool) · `xp_reward`
(int, XP al completar el curso — **no** por bloque) · `estimated_mins` ·
`tags` (text[]) · `cover_emoji` · `cover_image` · `published_at` ·
`created_at` · `reference_blocks` (jsonb, artículo de referencia) ·
`reference_unlocked_by_default` (bool) · `has_reference_blocks` (bool,
**columna generada por Postgres** a partir de `reference_blocks` — el
cliente no debe enviar ningún valor para ella, ver más abajo) ·
`route_ids` (uuid[], copia
desnormalizada — la fuente de verdad para consultas es `guide_routes`) ·
`level` (`beginner`/`intermediate`/`advanced`) · `view_count` (se
incrementa desde `curso.html` y `guia.html`) · `collection_id` (FK) ·
`collection_order` · `guide_rarity` (`bronze`/`silver`/`gold`/`platinum`) ·
`search_content`.

**Bloques de curso** (`blocks`): `hook`, `concept`, `warning`, `tip`,
`example` (teoría — pensados para usarse con moderación, la teoría a fondo
va en `reference_blocks` de la guía), `quiz`, `truefalse`, `fillblank`,
`match`, `order` (práctica), `checklist`, `reward`. El XP de la recompensa
sale de `guides.xp_reward`, no del bloque `reward`.

Formato de los bloques de práctica nuevos:
- `truefalse`: `{ statement, is_true: boolean, explanation }`
- `fillblank`: `{ before, after, options: string[], correct_option }` — el
  hueco se rellena eligiendo entre `options`, no escribiendo texto libre.
- `match`: `{ title, pairs: [{ left, right }, ...] }` — relacionar cada
  término de la izquierda con su pareja de la derecha (se mezclan al
  mostrarse).
- `order`: `{ title, items: string[] }` — `items` debe estar en el orden
  correcto en la base de datos; se mezcla al mostrarse y el usuario
  reconstruye el orden tocando los pasos.

Recomendación de contenido: un curso no debería repetir la guía. Usa
`hook` para enganchar, como mucho un par de bloques de teoría si hace
falta un puente rápido, y el resto en dinámicas de práctica.

**Generador de cursos con IA**: en la pestaña "Bloques del curso" del editor
de guías hay un botón "✨ Generar con IA" que llama a la función de Netlify
`netlify/functions/generate-course.mjs`. Esa función envía a la API de
Anthropic (Claude) el título, la descripción y el texto de la guía de
referencia (aplanado desde `reference_blocks`), y le pide que proponga los
bloques del curso siguiendo exactamente estas reglas: 1 `hook` al principio,
como mucho 1 bloque de teoría puente, el resto mezclando dinámicas de
práctica (quiz/truefalse/fillblank/match/order) sin repetir el mismo tipo
más de 2 veces seguidas, y 1 `reward` al final. La función valida el JSON
devuelto (descarta bloques con campos obligatorios ausentes y fuerza el
`reward` final) antes de devolverlo al admin. Los bloques generados
sustituyen a los del editor solo tras confirmación y siguen siendo
completamente editables antes de guardar — no se guardan solos. Requiere la
variable de entorno `ANTHROPIC_API_KEY` en Netlify; sin ella, el resto del
panel funciona igual y solo ese botón devuelve un error explicando que falta
la clave.

**Bloques de referencia** (`reference_blocks`): `richtext` (el tipo actual —
ver más abajo), y los antiguos `heading`, `paragraph`, `image`, `list`,
`highlight` que siguen soportados en el render (`renderReferenceBlock` en
`js/block-editor.js`) para guías creadas antes de este cambio.

**Editor de Documentación (WYSIWYG)**: desde este cambio, la pestaña
"Documentación" de `editor-guia.html` (usuario) y `admin/editor-guia.html`
ya no es una lista de bloques — es un único editor de texto enriquecido a
página completa (`js/richtext-editor.js`), con una barra de herramientas
tipo Word (negrita/cursiva/subrayado/H2/H3/párrafo/listas/enlace/imagen)
sobre un `contenteditable` que ocupa toda la pantalla. Se guarda como un
único bloque `{ type: 'richtext', html }` en `reference_blocks`. Al abrir
una guía antigua con varios bloques del sistema previo, el editor los
convierte una vez a HTML (con `renderReferenceBlocksHtml`) para que se
sigan editando en la superficie continua nueva — al guardar, quedan ya
como un solo bloque `richtext`.

Sanitización: `sanitizeRichText` (en `richtext-editor.js`, con DOMPurify vía
CDN) limpia el HTML tanto al guardar como, crucialmente, **también en
`renderReferenceBlock`** al pintar la guía publicada (`guia.js`) — las
políticas RLS dejan que un autor escriba su propia fila de `guides`
directamente por la API saltándose el editor, así que sanear solo en el
editor no bastaría para evitar HTML/JS inyectado.

**Subida de imágenes en guías**: además de la imagen dentro del editor de
Documentación, los bloques de curso `concept`/`warning`/`tip`/`example` y
la portada de la guía (`cover_image`, solo en el editor de admin) tienen
un botón "Subir imagen" que usa `uploadGuideImage` (en `js/app.js`) contra
el bucket de Storage `guide-images` — ver
`supabase-migration-guide-images.sql` (política igual que `avatars`: cada
usuario solo puede escribir dentro de su propia carpeta
`guide-images/<user-id>/...`, lectura pública). Ya no hay ningún campo de
"URL de imagen" editable a mano en estos sitios.

**Curso: contención de scroll**: `.editor-block-list` (donde viven los
bloques del curso interactivo) tiene `max-height` + `overflow-y: auto`, así
que añadir muchos bloques ya no alarga infinitamente la página del editor —
el listado hace scroll dentro de su propio recuadro.

**Bug real encontrado y arreglado — toolbar del editor WYSIWYG tapada por
la navbar en móvil**: `.rte-wrap` tenía `overflow: hidden` solo para
recortar las esquinas redondeadas del recuadro. Pero eso convierte a
`.rte-wrap` en el "scrollport" de su hijo sticky (`.rte-toolbar`) en vez de
la página — al no poder desplazarse él mismo, el sticky se rompe y la
toolbar queda mal posicionada bajo la navbar (también sticky) al hacer
scroll. Arreglado quitando el `overflow: hidden` del wrapper y redondeando
las esquinas directamente en `.rte-toolbar` (arriba) y `.rte-surface`
(abajo) por separado; además se le da a la toolbar `top: 60px` (en vez de
`0`) para que se quede pegada justo debajo de la navbar, no debajo de ella.

**Contenido gated**: si `reference_unlocked_by_default` es `false`, el
artículo de referencia solo se muestra si el usuario tiene el `id` de la
guía en `user_profiles.unlocked_references` (se añade automáticamente al
completar el curso).

**Contenido Pro**: si `is_pro` es `true`, `curso.html`/`guia.html` ocultan
el contenido a quien no tenga `user_profiles.is_pro = true`. **Esto es solo
cosmético** — las políticas RLS de `guides` permiten `SELECT` público sin
distinguir `is_pro`, así que el JSON completo (incluidos los bloques) sigue
siendo accesible vía API a quien sepa consultarlo directamente. Si quieres
proteger el contenido Pro de verdad, hace falta una política RLS específica
o una Edge Function — no lo he tocado porque implica cambiar la base de
datos.

## `guide_routes` / `learning_paths` (rutas — retiradas de la navegación)
Tabla puente ruta ↔ guía (`guide_routes`: `guide_id`, `route_id`,
`position`) y las rutas en sí (`learning_paths`: `id`, `slug`, `title`,
`description`, `emoji`, `guide_ids`, `is_featured`). **Ya no aparecen en
ninguna página de cara al usuario** — se quitó la pestaña "Rutas" de
`aprender.html` y el modo `?path=` de `categoria.html` para simplificar el
modelo mental a "cada guía va a una única categoría, y punto". El panel
de administración conserva el CRUD de rutas por si se retoma la idea más
adelante, pero ninguna guía se organiza por rutas de cara al público.
`onboarding.html` recomendaba una ruta al final del asistente; ahora
recomienda una categoría (ver `user_profiles.recommended_path` abajo).

## `guide_reviews` (valoraciones y comentarios sobre la guía)
`id` · `guide_id` (FK → guides) · `reviewer_id` (FK → auth.users) ·
`rating` (1-5) · `body` (comentario opcional) · `created_at`. Única por
`(guide_id, reviewer_id)`. Lectura pública; solo el propio autor puede
borrar su reseña (o un admin). Migración:
`supabase-migration-guide-reviews.sql`.

Esto valora **la guía en general** (el concepto, no el curso interactivo
ni la documentación por separado) — se muestra en el modal ampliado que
abre `js/guide-modal.js` al hacer clic en la tarjeta de una guía (en
`categoria.html`, la página de inicio y `guardados.html`), junto con la
media de estrellas, quién la creó (enlace a su perfil), el estado de
"guardado" (`user_profiles.saved_guides`, que ya era compartido entre
curso y documentación al estar indexado por `guides.id`) y los botones
para entrar al Curso o a la Documentación (antes "Guía" — se renombró en
los botones para no confundirla con el concepto general de "guía").

La tarjeta pequeña (en `categoria.html`, la home y `guardados.html`) ya
muestra el botón de guardar y la valoración media **antes** de abrir el
modal — no hace falta clicar para verlos. `js/guide-modal.js` expone
`renderGuideCardHtml()` y `decorateGuideCards()` para que las tres
páginas pinten exactamente la misma tarjeta y no se dupliquen entre sí.

## `guide_comments` (comentarios sobre la guía, estilo foro)
`id` · `guide_id` (FK → guides) · `author_id` (FK → auth.users) · `body` ·
`reply_to_id` (FK → guide_comments, `on delete set null`) · `created_at`.
Lectura pública; solo el propio autor (o un admin) puede borrar su
comentario. Migraciones: `supabase-migration-guide-comments.sql` +
`supabase-migration-guide-forum.sql` (añade `reply_to_id`).

Es la conversación libre bajo una guía — **separada** de `guide_reviews`,
que es solo la puntuación de 1 a 5 estrellas. En `guia.html` se pinta como
un foro paginado (`js/guide-forum.js`, 10 comentarios por página vía
`.range()`), con la propia documentación de la guía haciendo de "post
principal" arriba (encabezado con avatar/nombre del autor, clase
`.guide-modal-author` reutilizada de `guide-modal.js`) y los comentarios
de los usuarios debajo, cada uno con avatar, autor, fecha y un botón
"↩ Responder" que cita el mensaje anterior (`reply_to_id`) mostrando un
`.forum-quote` con el autor y un fragmento del mensaje citado. La página
se recuerda en `?page=N` en la URL. `js/wall.js` (para
`profile_comments`) es un módulo aparte, no comparte código con
`guide-forum.js` — son dos estilos de conversación distintos (muro plano
vs. foro paginado con citas).

## `achievement_definitions`
Logros 100% configurables desde `/admin`. `id` (text, clave única elegida
a mano, ej. `first_course`) · `title` · `description` · `emoji` ·
`icon_url` · `condition` (jsonb: `{ type, count }`) · `rarity`
(`bronze`/`silver`/`gold`/`platinum`) · `xp_reward` · `is_active` ·
`cover_image`.

`condition.type` soportados por `js/gamification.js`:
- `completed_guides_count` — nº de guías con `user_progress.status = 'completed'`
- `total_xp` — `user_profiles.total_xp`
- `quiz_correct_count` — `user_profiles.quiz_correct_count`
- `approved_guides_count` — nº de guías con `guides.author_id = <usuario>`
  y `review_status = 'approved'` (logros por **aportar** contenido, no solo
  por aprenderlo — pensado para algo como "Primera guía aprobada")

Cualquier otro `type` simplemente nunca se desbloquea (no rompe nada, pero
tampoco hace nada). `checkAchievements()` ya se llama automáticamente al
dar XP (`addXP()`) cada vez que se aprueba una guía por primera vez
(`admin/js/editor-guia.js`), así que un logro de `approved_guides_count`
se desbloquea en el mismo momento en que el admin aprueba la guía que lo
cumple — sin ningún disparador nuevo que añadir.

Verificado con Playwright: crear un logro `approved_guides_count: 1` y
aprobar la primera guía de una autora sin guías aprobadas todavía hace
que se desbloquee en el acto (y suma su `xp_reward` de bonus, aparte del
`xp_reward` de la propia guía) — quitando el `case` de
`approved_guides_count` en `achievementValue()` se confirmó que sin él el
logro nunca se desbloquea.

## `home_config`
Fila única (`id = 1`) con `blocks` (jsonb) y `updated_at`. **No se usa**
desde el frontend actual — el home (`index.html`/`js/home.js`) sigue
teniendo secciones fijas (hero, continuar, categorías, recientes,
progreso, banner) tal como se especificó. Si esta tabla se usaba en la app
anterior para maquetar el home dinámicamente, dilo y lo conecto — de
momento sus datos no se leen ni se escriben desde ningún sitio.

## `notifications`
`id` · `title` · `body` · `data` (jsonb) · `target` · `status`
(`draft`/`sent`) · `scheduled_at` · `sent_at` · `sent_count` ·
`created_at`. **Sin panel de administración por ahora** — se quitó la
sección de `/admin` porque no había ningún servicio de push conectado
(necesitaría un backend con Expo/FCM/APNs u otro proveedor de web push) y
solo dejaba constancia en la base de datos sin llegar a ningún
dispositivo. La tabla sigue existiendo tal cual en Supabase por si en el
futuro se monta el envío real. `user_profiles.push_token` (del proyecto
Expo anterior) tampoco se usa ni se toca desde la web.

## `user_profiles`
`id` (= auth.users.id) · `username` (desde `supabase-migration-usernames.sql`,
único e insensible a mayúsculas — es el "handle" que se usa en las URLs
públicas, `/usuario/<username>`; se genera automáticamente en el
onboarding a partir del nombre, y se puede cambiar luego desde "Editar
perfil") · `display_name` (se usa para mostrar el nombre en toda la web;
`username` queda como respaldo) · `total_xp` ·
`level` · `is_pro` · `achievements` (text[], ids de `achievement_definitions`
desbloqueados) · `saved_guides` (uuid[], ids de guías guardadas — sin tabla
aparte) · `unlocked_references` (uuid[]) · `avatar_color` (color de fondo
del avatar, con fallback a navy) · `is_admin` · `quiz_correct_count` ·
`push_token` (no usado desde la web) · `onboarding_completed` · `interests`
(text[], slugs de categorías elegidas en el onboarding) · `recommended_path`
(text — el nombre de la columna quedó de cuando esto recomendaba una
`learning_path`; ahora que las rutas se quitaron de la navegación,
guarda el **slug de una categoría** de `categories`, no de una ruta) · `bio`
(texto libre, perfil público) · `banner_color` (color de fondo de la
cabecera del perfil público, se usa solo si no hay `banner_url`) ·
`showcase_achievement` (id de `achievement_definitions` que el usuario elige
destacar en su perfil) · `avatar_url` / `banner_url` (de la migración
`supabase-migration-avatars.sql` — foto y banner subidos por el propio
usuario al bucket de Storage `avatars`; si están rellenos, la web los usa
en vez de `avatar_color`/`banner_color`).

**Perfiles públicos**: desde la migración `supabase-migration-social.sql`,
cualquiera puede leer cualquier fila de `user_profiles` (antes solo se leía
la propia). Hace falta para que exista `usuario.html` (perfil público de
otro usuario con muro, reseñas y sus guías).

**Directorio de la comunidad / ranking por XP**: `usuarios.html` (enlace
"Comunidad" en el nav) ya pedía los perfiles ordenados por `total_xp`
descendente — ahora además se les asigna un `rank` (posición 1, 2, 3...)
en `js/usuarios.js` y se muestra como insignia en la tarjeta: medalla
🥇🥈🥉 para el top 3 (con un borde dorado sutil en la tarjeta) y `#N` para
el resto. El buscador filtra la lista pero conserva el rank global de cada
persona (no renumera al filtrar). Tiene un buscador por nombre/username en
el cliente.

**Enlaces de perfil legibles**: `netlify.toml` reescribe
`/usuario/:username` a `/usuario.html?u=:username` (regla que tiene que
ir antes del catch-all `/*` del SPA, si no nunca se llegaría a aplicar).
Como es una reescritura en el servidor, la barra de direcciones del
navegador se queda en `/usuario/<username>` y no aparece ningún `?u=` —
por eso `js/usuario.js` ya no lee solo `window.location.search`, sino
`profileParamsFromLocation()` (en `js/app.js`), que primero mira la ruta
(`/usuario/<username>`) y si no encuentra nada cae de vuelta a
`?u=<username>` o `?id=<uuid>` (por si se entra directo a
`usuario.html`, o en local, donde no hay redirects de Netlify). El
helper `profileUrl()` de `js/app.js` es quien decide qué generar al
crear un enlace — ahora mismo siempre `/usuario/<username>` si el
perfil tiene username, o el `?id=` antiguo como último recurso.

**Bug crítico corregido — rutas relativas rompían `/usuario/<username>`**:
como la reescritura de Netlify es del lado del servidor, la barra de
direcciones se queda en `/usuario/<username>` mientras sirve el contenido
de `usuario.html` — cualquier ruta relativa en ese documento (`css/...`,
`js/...`, `<a href="perfil.html">`, etc.) se resolvía entonces contra
`/usuario/` en vez de la raíz del sitio, así que el CSS y los enlaces
internos no cargaban y la página se veía completamente rota. Se corrigió
convirtiendo a rutas absolutas (con `/` inicial) todo lo que usa
`usuario.html`, `js/usuario.js` y `js/wall.js` (muro compartido con
`perfil.html`), y también `profileUrl()`, `signOut()`, `requireAuth()` y
`renderNavUser()` en `js/app.js` (usadas en todas las páginas, incluida
`usuario.html`). El resto de páginas del sitio no se sirven vía
reescritura, así que no les afectaba este problema.

**Toasts en vez de `alert()`**: `js/toast.js` (`showToast(mensaje, tipo)`)
sustituye a los `alert()` puramente informativos (errores de guardado, de
subida de imagen, validaciones de formulario) en ambos editores de guía,
`perfil.js`, `usuario.js`, `block-editor.js`, `richtext-editor.js` y
`admin.js`. Los diálogos que necesitan una respuesta síncrona del usuario
(`window.confirm`, `window.prompt`, como al rechazar una guía o generar el
curso con IA) se mantienen tal cual — un toast no sirve para eso.

**Validación de imágenes al subir**: `validateImageFile(file, maxMB=5)`
(en `js/app.js`) rechaza archivos que no sean `image/*` o que pesen más de
5 MB, con un mensaje claro vía toast en vez de dejar que la subida falle
en silencio o suba un archivo enorme. La usan `uploadProfileImage`,
`uploadGuideImage` y la subida directa del panel "Imágenes" de
`admin/js/admin.js` (bucket `images`, el único que no pasa por los
helpers de `app.js`).

**Autoguardado de borrador en los editores de guía**: `js/editor-autosave.js`
guarda cada 8s (y en `beforeunload`) un snapshot del formulario en
`localStorage`, con clave `pokedoc-editor-draft-<userId>:<guideId|'new'>`.
Al abrir el editor, si hay un borrador guardado se ofrece recuperarlo con
un `confirm()`. Al guardar con éxito se limpia el borrador — para eso hace
falta parar el autoguardado (`stopAutosave()`, la función que devuelve
`startAutosave`) **antes** de navegar fuera de la página: si no, el evento
`beforeunload` de esa misma navegación vuelve a escribir el borrador que se
acaba de borrar (bug real que apareció al probarlo con Playwright y que
quedó cubierto por ese mismo test).

## Contenido colaborativo (`guides.author_id` / `review_status`)
Cualquier usuario registrado puede crear guías desde "Mis guías" en su
perfil. Columnas nuevas en `guides`: `author_id` (uuid, autor; `null` =
contenido propio/admin, como hasta ahora) · `review_status`
(`draft`/`pending`/`approved`/`rejected`, default `'approved'` para no
afectar a lo ya publicado) · `rejection_reason` (motivo si se rechaza) ·
`submitted_at`.

Flujo: el autor crea/edita en `draft`, le da a "Enviar a revisión"
(`review_status = 'pending'`) y ya no puede tocarla. Un admin la revisa en
la pestaña "Pendientes" de `/admin`: al aprobar se le pone `published_at`
(igual que a cualquier guía) y `review_status = 'approved'`; al rechazar,
`review_status = 'rejected'` + `rejection_reason`, y el autor puede
editarla y reenviarla. Campos como XP, rareza, colección o rutas los deja
en su valor por defecto el autor y los ajusta el admin al aprobar — el
autor no elige eso él mismo.

RLS: la lectura pública de `guides` pasó de "todas las filas" a
`published_at IS NOT NULL` o `review_status = 'pending'` (o el propio
autor viendo lo suyo, o admin viendo todo — ver más abajo "Guías de
comunidad"). El autor puede insertar/editar/borrar sus propias filas solo
mientras están en `draft` o `rejected`.

## Guías de comunidad visibles antes de la aprobación
Hasta ahora una guía enviada a revisión quedaba invisible para todo el
mundo (excepto su autor y los admins) hasta que se aprobaba. Ahora,
según se pidió, el sitio distingue **guías oficiales** (las que crea el
equipo o las que ya aprobó un admin — siguen siendo las únicas que
aparecen en la home/categorías/buscador de siempre, sin ningún cambio
ahí) de **guías de comunidad** (cualquier guía con `author_id`, esté
`pending` o ya `approved`), que se listan en una pestaña nueva **"Guías
de la comunidad"** dentro de Comunidad (`usuarios.html`/`js/usuarios.js`,
junto a la pestaña "Usuarios" que ya existía), con su propio buscador de
texto (título/descripción/autor) — deliberadamente **sin mezclarse** con
el buscador o las categorías del sitio oficial, para no diluir esa
experiencia curada.

Migración: `supabase-migration-community-guides.sql` — amplía la
política `guides_select` para permitir también leer filas con
`review_status = 'pending'` (antes solo se podía leer lo publicado, o lo
propio, o siendo admin). Las guías en `draft` o `rejected` siguen sin
ser públicas.

Cada tarjeta (reutiliza `renderGuideCardHtml` de `guide-modal.js`, ahora
con los parámetros opcionales `reviewBadge` y `authorName`) muestra el
autor y un sello: "Pendiente de revisión" o "✓ Aprobada" — las aprobadas
se quedan también listadas aquí, a modo de "vitrina" de lo que ha
aportado la comunidad, aunque ya vivan además en el sitio oficial. Al
pinchar se abre el mismo modal de guía de siempre (`openGuideModal`),
que ahora muestra un aviso "🕓 Guía de la comunidad pendiente de
revisión..." cuando corresponde; `guia.js` (la página de documentación
completa) muestra el mismo aviso arriba del todo.

## Incentivos para publicar guías: rango de colaborador visible + XP al aprobar
Para que crear guías cuente tanto como aprender, sin montar un foro:

- **XP al autor cuando se aprueba su guía** (`admin/js/editor-guia.js`
  → `persistGuide()`): la primera vez que una guía pasa a
  `review_status = 'approved'` (no en guardados posteriores del mismo
  estado), se le da al autor el mismo XP que ya se lleva quien completa
  su curso (`payload.xp_reward`, el valor que el admin ajusta al
  aprobar) vía `addXP()`. Publicar una guía que se aprueba ahora suma
  progreso real, no solo reconocimiento.
- **Rango de colaborador visible**: `contributorTier()` (en
  `gamification.js`) ya existía pero no se mostraba en ningún sitio.
  Ahora aparece como una tarjeta más en las estadísticas del propio
  perfil (`perfil.js`, antes solo se veía en el perfil público de otra
  persona vía `usuario.js`) y como sello bajo el XP en cada tarjeta del
  directorio de "Comunidad" (`usuarios.js`, contando guías aprobadas por
  autor con una sola consulta agrupada) — solo se muestra si la persona
  tiene alguna guía aprobada, para no repetir "Miembro" en todas las
  tarjetas por defecto.

Deliberadamente **no** se mezcla este rango con el ranking de XP
(que sigue siendo solo sobre aprender/completar cursos) — son dos
señales distintas (quién estudia vs. quién aporta) para no confundir
ambas cosas en un solo número.

Verificado con Playwright: aprobar una guía pendiente aumenta el XP del
autor exactamente en su `xp_reward` (y volver a guardar una guía ya
aprobada NO vuelve a darlo); el rango de colaborador aparece en el
propio perfil y en las tarjetas de Comunidad de quien tiene guías
aprobadas. Para comprobar el efecto del `approve` sin que la navegación
posterior (`window.location.href`) reiniciase el estado del stub de
pruebas, se neutralizó esa navegación solo en la copia de prueba del
scratchpad — no es código del repo.

## El curso interactivo pasa a ser opcional al publicar una guía
Antes, el editor de "Mis guías" (`editor-guia.html`/`js/editor-guia.js`)
exigía que tanto la Documentación como el curso interactivo tuvieran al
menos un bloque antes de poder "Enviar a revisión". Se quitó esa segunda
condición: **solo la Documentación es obligatoria**, el curso interactivo
es opcional (la pestaña ahora dice "🎓 Curso interactivo (opcional)" con
una nota explicándolo). Así se baja la barrera de entrada para quien solo
quiere aportar documentación rápida, sin obligar a nadie a montar un
curso completo tipo Duolingo si no le apetece — quien sí quiera hacerlo
sigue pudiendo, y el curso se sigue construyendo a partir de la
Documentación como hasta ahora (el aviso de bloqueo de la pestaña de
curso no cambia).

Como una guía ahora puede quedarse sin bloques de curso (`blocks: []`),
el botón "🎓 Curso" de la tarjeta de guía (`renderGuideCardHtml` en
`guide-modal.js`, usado en home/categoría/guardados/Comunidad) y el del
modal ampliado (`openGuideModal`) se deshabilitan igual que ya hacía el
botón "📖 Documentación" cuando no hay contenido — para no dejar un
enlace muerto a "Este curso todavía no está disponible" (`curso.js` ya
manejaba ese caso, pero sin avisar antes de hacer clic).

Nota: esta relajación es solo para el editor de la comunidad
(`js/editor-guia.js`); el editor de `/admin` nunca tuvo esta validación,
así que no hizo falta tocarlo.

**Editor a página completa** (`editor-guia.html` / `js/editor-guia.js`
para "Mis guías" en el perfil; `admin/editor-guia.html` /
`admin/js/editor-guia.js` para `/admin`): crear o editar una guía ya no
abre un modal pequeño en ninguno de los dos sitios — navega a una página
dedicada (`?id=<guía>` para editar, sin parámetro para una nueva).
Ambas comparten la misma estructura de pestañas para no tener un scroll
kilométrico: **"General y Documentación"** y **"🎓 Curso interactivo"**;
la versión de admin añade una tercera pestaña **"⚙️ Avanzado"** con lo
que solo gestiona un moderador (rareza, XP, Pro, tags, contenido de
búsqueda, publicar, rutas) y conserva el generador con IA y los botones
Aprobar/Rechazar sobre guías pendientes. Ambas reutilizan
`js/block-editor.js` tal cual, con bloques más grandes y espaciosos.

Regla nueva en ambos editores: **el curso interactivo está bloqueado
hasta que la Documentación tenga al menos un bloque** — un
`MutationObserver` sobre la lista de bloques de referencia decide si
mostrar el aviso de bloqueo o el editor del curso, y mientras se edita el
curso hay un botón "Ver documentación" que muestra el texto de
referencia ya escrito (aplanado con `flattenReferenceBlocksToText`) para
no tener que ir y venir entre pestañas.

**BBCode** (`js/bbcode.js`): los campos de texto largo del editor de
bloques (párrafos de la documentación, cuerpo de los bloques de
concepto/aviso/consejo/ejemplo, subtexto del enganche) tienen una
pequeña barra de formato estilo foro antiguo — **B**, *I*, <u>U</u>,
enlace y lista — que inserta `[b]`, `[i]`, `[u]`, `[url=...]` y
`[list][*]...[/list]` en el textarea. `parseBBCode()` escapa el HTML
primero y solo después sustituye esas etiquetas por `<strong>`/`<em>`
/etc., así que no hay forma de inyectar HTML a través del texto del
usuario; los enlaces `[url=]` además se descartan si no empiezan por
`http(s)://`. Se aplica al renderizar en `guia.js` (párrafo/destacado) y
`curso.js` (cuerpo y subtexto de bloques tipo concepto).

**Vista previa en vivo de la Documentación**: la pestaña "General y
Documentación" de ambos editores va en dos columnas — el editor de
bloques a la izquierda y una tarjeta con pinta de artículo real
(`.article-body`) a la derecha, que se actualiza en cada tecla/click
dentro de la lista de bloques (delegación de `input`/`change`/`click`/
`drop` sobre el contenedor, más una llamada explícita al añadir o quitar
un bloque). Usa `renderReferenceBlocksHtml()` — la misma función que
pinta la guía de verdad en `guia.js` — para que la vista previa sea
exactamente lo que se va a publicar, no una aproximación. De paso se
corrigió que `.block-highlight` vivía en `css/curso.css`, que
`guia.html` no enlaza, así que el bloque "destacado" de la documentación
nunca había tenido estilo en la página real; ahora vive en
`css/components.css`, enlazado en todas partes.

## `profile_comments` (muro del perfil)
`id` · `profile_id` (de quién es el muro) · `author_id` (quién escribe) ·
`body` · `created_at`. Lectura pública; solo el propio autor del
comentario, el dueño del muro, o un admin pueden borrarlo.

## `profile_reviews` (reseñas entre usuarios)
`id` · `profile_id` (a quién se reseña) · `reviewer_id` (quién reseña) ·
`rating` (1-5) · `body` · `created_at`. Única por `(profile_id,
reviewer_id)` — puedes actualizar tu reseña pero no dejar dos. Lectura
pública. **A propósito, el reseñado no puede borrar reseñas que no le
gusten** — solo quien la escribió o un admin, para que la reputación
tenga peso real.

## `user_follows` (seguidores/seguidos)
`follower_id` · `following_id` · `created_at`. Clave primaria compuesta
`(follower_id, following_id)` — no se puede seguir dos veces a la misma
persona, y un check constraint impide `follower_id = following_id`
(seguirte a ti mismo). Lectura pública (para contar/listar seguidores de
cualquiera); solo `follower_id = auth.uid()` puede crear o borrar sus
propias filas (seguir/dejar de seguir). Migración:
`supabase-migration-follows.sql`.

En `perfil.html` los contadores de Siguiendo/Seguidores viven ahora en el
propio hero (junto al nombre y el XP), siempre visibles sin cambiar de
pestaña — clicarlos abre un popup con la lista de avatares (reutiliza el
modal `#profileModal`). El "🏆 Trofeos" del hero funciona igual: es un
recuento clicable que abre el mismo popup con la rejilla de logros; la
pestaña "Acerca" conserva la rejilla completa además, para quien prefiera
verla sin popups. En `usuario.html` (perfil de otra persona) esto sigue
en la pestaña "Acerca", junto con el botón "Seguir/Dejar de seguir"
(oculto si ves tu propio perfil).

## `user_progress`
`id` · `user_id` · `guide_id` · `status` (`started`/`completed`) ·
`xp_earned` · `started_at` · `completed_at` · `current_block` (posición
para reanudar el curso). Único por `(user_id, guide_id)`.

⚠️ **Limitación conocida de RLS**: la política `user_progress_own` solo
permite `auth.uid() = user_id`, sin excepción para admins. Por eso, en el
Dashboard de `/admin`, "Cursos completados" solo cuenta los del propio
admin que ha iniciado sesión, no el total de todos los usuarios. Para un
total real haría falta añadir una política de lectura para admins en esa
tabla (no lo he hecho porque implica tocar RLS).

## Supabase Storage
Bucket público `images`, usado por `/admin` para subir e insertar URLs de
imágenes en guías/categorías/logros.

Bucket público `avatars` (de `supabase-migration-avatars.sql`), usado desde
`perfil.html` para que cada usuario suba su propia foto y banner. Cada
usuario solo puede escribir dentro de su propia carpeta
(`avatars/<su-user-id>/...`) — la política RLS de `storage.objects` lo
fuerza comparando `(storage.foldername(name))[1]` con `auth.uid()`.

## RLS
No se ha tocado ninguna política. Resumen de lo que ya existía y que el
frontend asume:
- Lectura pública: `categories`, `guides`, `guide_collections`,
  `guide_routes`, `learning_paths`, `achievement_definitions`, `home_config`.
- Escritura solo admin (`is_admin()`): las mismas tablas, más `notifications`.
- `user_profiles`: cada usuario gestiona su propia fila
  (`auth.uid() = id`); los admins pueden leer/actualizar cualquier fila.
- `user_progress`: cada usuario solo ve/edita sus propias filas — sin
  excepción para admins (ver limitación arriba).
- `user_follows`, `profile_comments`, `profile_reviews`: lectura pública;
  cada usuario solo puede crear/borrar sus propias filas (ver detalle en
  cada tabla más arriba).

## Reportar contenido inapropiado (`content_reports`)
Migración: `supabase-migration-content-reports.sql`. Tabla `content_reports`
(`reporter_id`, `content_type` — `guide`/`profile_comment`/`guide_comment`/
`profile_review` —, `content_id`, `reason` opcional, `status`
`pending`/`reviewed`/`dismissed`, `created_at`). RLS: cualquier usuario
logueado puede insertar sus propios reportes (`auth.uid() = reporter_id`);
solo `is_admin()` puede leerlos y actualizarlos — un usuario normal no
puede ver reportes, ni siquiera los suyos.

`js/report.js` es el módulo compartido: `reportButtonHtml(tipo, id)` pinta
el botón 🚩, `wireReportButtons(containerEl, session)` engancha el click
(pide un motivo opcional con `prompt()` e inserta la fila). Está enganchado
en `js/wall.js` (así cubre de una vez comentarios de muro y de guía, ya
que `renderWall` se usa para ambos), en `js/usuario.js` (reseñas de
perfil) y en `js/guide-modal.js` (la guía en sí). En todos los sitios se
oculta el botón sobre tu propio contenido.

El panel de admin tiene una sección nueva "🚩 Reportes"
(`admin/index.html` + `loadReports()` en `admin/js/admin.js`) que lista
los reportes `pending` con quién reportó y por qué, y deja marcarlos como
revisados o descartarlos.

**Hueco real que se arregló: la tabla de reportes no mostraba QUÉ se
había reportado.** Solo se veía el tipo genérico ("💬 Comentario de
guía"), el motivo y quién reportó — para saber si el contenido era
realmente inapropiado, el admin tenía que ir a buscarlo a mano fila por
fila, sin ninguna pista de dónde. Se añadió `loadContentPreviews()`, que
agrupa los reportes por `content_type` y hace una consulta por tabla
(`guides`/`guide_comments`/`profile_comments`/`profile_reviews`) para
traer un fragmento del texto real (o el título, o ★+texto en el caso de
reseñas) y un enlace a dónde vive — la guía para `guide`/`guide_comment`,
el perfil del autor para `profile_comment`/`profile_review`. Si el
contenido ya se borró mientras tanto, se muestra "*Contenido eliminado*"
en vez de romperse.

**Segundo hueco relacionado: aunque el admin viera y siguiera el enlace,
no podía borrar el comentario/reseña de otra persona.** Las políticas RLS
de `guide_comments`/`profile_comments`/`profile_reviews`/`guide_reviews`
siempre permitieron `is_admin()` además del propio autor, pero ningún
sitio del cliente mostraba el botón "Eliminar" para un admin sobre
contenido ajeno — `js/wall.js` y `js/guide-forum.js` solo comprobaban
"eres el autor" (o, en el muro, "eres el dueño de ese muro"). Se añadió
un parámetro `isAdmin` a `renderWall()` y a `initGuideForum()` que amplía
esa condición; los que llaman a estas funciones con una sesión activa
(`js/guia.js`, `js/guide-modal.js`, `js/usuario.js`) ahora resuelven si
quien mira es admin (reutilizando el `profile` que ya tenían cargado, o
con una consulta a `user_profiles.is_admin` cuando no lo tenían) y se lo
pasan. `perfil.js` no necesitó cambios: como siempre muestra tu propio
muro, el autoborrado que ya tenía cubre el caso.

## Guía Pro (monetización)
Migración: `supabase-migration-guide-pro-content.sql`. Cada guía puede
tener, aparte de la Documentación y el Curso (que **siempre son
gratis**), una pestaña extra "🌟 Guía Pro" con contenido exclusivo — la
idea es que empiece como copia de la Documentación y el equipo de admin
le añada ejemplos, consejos y trucos avanzados antes de publicarla.

**Por qué una tabla aparte y no una columna más en `guides`**: `guides`
es de lectura pública (necesario para SEO/descubrimiento), así que
cualquier columna en esa tabla se sirve a cualquiera que consulte la API
directamente — es justo el gap de seguridad que ya había anotado (el
`is_pro` de toda la vida es solo cosmético). El contenido Pro de verdad
vive en `guide_pro_content` (`guide_id` PK/FK, `blocks` jsonb en el mismo
formato `richtext` que `reference_blocks`, `published_at`), con su propia
RLS: un usuario con `user_profiles.is_pro = true` solo puede leer filas
con `published_at` no nulo; el equipo de admin (`is_admin()`) tiene acceso
total para editar el borrador antes de publicar. A un usuario sin Pro,
Supabase directamente no le devuelve la fila — no hace falta fiarse de
que el frontend esconda nada.

`guides.has_pro_content` (booleano, público y cosmético) es la señal que
usa el frontend para saber si pintar la pestaña "Guía Pro" en `guia.html`
sin necesitar acceso al contenido real — se actualiza únicamente al
publicar/despublicar (no basta con "activarla" en el editor). En
`js/guia.js`, si `has_pro_content` es `true` se muestran pestañas
Documentación/Guía Pro; si la consulta a `guide_pro_content` devuelve fila
(usuario Pro o admin) se pinta el contenido, si no, un aviso de paywall
con CTA a iniciar sesión.

**Solo editable desde el panel de admin** (`admin/editor-guia.html`,
pestaña "🌟 Guía Pro"): botón "Activar Guía Pro" copia el HTML actual de
la Documentación como punto de partida (sin persistir todavía), después
el mismo editor WYSIWYG de `richtext-editor.js`. "Publicar Guía Pro" y
"Despublicar" son acciones inmediatas e independientes del botón
"Guardar" general — hacen su propio upsert/update y actualizan
`has_pro_content` en el momento, tal y como se pidió: la Guía Pro no se
hace visible hasta que se publica explícitamente, para poder seguir
editándola sin que se vea a medio hacer. El editor de guías de los
usuarios de la comunidad (`editor-guia.html` normal) no tiene esta
pestaña — la Guía Pro es contenido curado por el equipo de admin.

## Accesibilidad de los modales y toasts
Todos los modales del sitio (guía ampliada, perfil/trofeos/seguidores,
"Qué es PokeDoc", admin) tenían el botón de cerrar como un `<span>` —
nada de esto era alcanzable con teclado ni tenía nombre accesible, y
tampoco se podían cerrar con Escape. Se cambió `<span class="modal-close">`
por `<button aria-label="Cerrar">` en las seis páginas que lo usan
(`categoria.html`, `guardados.html`, `index.html` ×2, `perfil.html`,
`usuario.html`, `admin/index.html`), y se añadió un listener de `Escape`
en cada punto donde se abre/cierra un modal (`guide-modal.js`, `home.js`,
`perfil.js`, `usuario.js`, `admin/js/admin.js`). El reset global de
`button` en `style.css` ya deja el botón visualmente igual que el span.

De paso: `js/toast.js` marca su contenedor con `role="status"` y
`aria-live="polite"` para que un lector de pantalla anuncie los mensajes,
y los botones de guardar/quitar solo-icono (`.card-save-btn`,
`.unsave-btn`) llevan `aria-label` además del `title` que ya tenían.

## Dos bugs reales encontrados y arreglados (revisión de código)

**Condición de carrera en el buscador** (`js/search.js`): `runSearch()` no
tenía forma de saber si su propia respuesta seguía siendo la más
reciente. Si el usuario escribía rápido (o cambiaba de categoría), una
consulta más lenta lanzada antes podía resolver DESPUÉS de una más nueva
y pisar los resultados correctos con los antiguos. Se añadió un contador
`searchSeq`: cada `runSearch()` guarda su propio número de secuencia al
empezar, y si al resolver ya no coincide con el contador global (porque
se lanzó una búsqueda más nueva mientras tanto), descarta su resultado
sin pintarlo. Verificado con Playwright forzando artificialmente que la
consulta más vieja tardase más que la más nueva.

**Doble envío en los editores de guía** (`js/editor-guia.js` y
`admin/js/editor-guia.js`): al crear una guía nueva (sin `existingGuide.id`
todavía), un doble clic rápido en "Guardar borrador"/"Guardar" disparaba
dos `upsert` con slugs distintos (el slug se genera con un sufijo
aleatorio), creando dos filas duplicadas en vez de una. Se añadió una
variable `saving` que descarta cualquier llamada mientras la anterior
sigue en marcha, más deshabilitar los botones de guardar durante el
guardado (reactivándolos solo si falla). Verificado con Playwright
espiando las llamadas reales a `upsert` con un doble clic simultáneo.

## Adaptar guías antiguas al editor WYSIWYG (botón admin)
Las guías creadas con el sistema antiguo de bloques discretos
(`paragraph`/`heading`/`list`/`image`/`highlight`) siguen funcionando
(`renderReferenceBlocksHtml` las sabe pintar), pero para tenerlas "todas
enteras" en el mismo formato que el editor WYSIWYG nuevo, `/admin` →
Guías tiene un botón "🔄 Adaptar al editor nuevo"
(`admin/js/admin.js`, junto a `btnNewGuide`) que:
1. Lee `reference_blocks` de todas las guías.
2. Se salta las que ya están en formato richtext (`[{ type: 'richtext' }]`)
   o no tienen contenido de referencia (`[]`).
3. Al resto les pasa los bloques por `renderReferenceBlocksHtml` (la misma
   función que ya usa el sitio público, así que el resultado visual es
   idéntico) y guarda el HTML resultante como un único bloque
   `[{ type: 'richtext', html }]`.

Es una acción de admin mediada por el cliente de Supabase de la app (no
un script suelto contra la base de datos), así que respeta el mismo RLS
que cualquier otra escritura del panel.

## CTA de "Hacer el curso" quitado de la Documentación
`guia.html` ya no muestra el aviso "¿Quieres aprenderlo paso a paso? →
Hacer el curso" bajo el artículo — la página de Documentación es ahora
solo eso, documentación (más el foro de comentarios debajo). El curso
interactivo sigue existiendo y se accede igual desde las tarjetas de
guía en `categoria.html`/`index.html`/`guardados.html`.

## Responder a un comentario del muro te lleva al muro de esa persona
En `perfil.html`/`usuario.html`, cada comentario del muro (`profile_comments`,
no afecta a `guide_comments`) tiene un enlace "Responder" que lleva al
muro **del autor de ese comentario concreto** con `?reply_to=<id>` en la
URL (`js/wall.js`). Al llegar ahí se ve un aviso "Respondiendo a
X: '...'" sobre el textarea con un botón para cancelar, y al publicar la
respuesta se limpia el parámetro de la URL. Es la forma de que, si
alguien te escribe en tu muro, puedas ir a responderle directamente en
el suyo en vez de dejarle la respuesta enterrada en el tuyo.

## Bug real en el stub de pruebas: `.update(payload).eq(...)` mutaba toda la tabla
Al construir el foro de comentarios se detectó que el stub de Supabase
usado para las pruebas con Playwright (no es código del repo — vive en
el scratchpad de la sesión) ejecutaba `.update()` en cuanto se llamaba,
usando los filtros acumulados **hasta ese momento** — pero el patrón real
de Supabase siempre encadena `.eq()` DESPUÉS de `.update()`
(`supabase.from(t).update(payload).eq('id', x)`), así que el filtro
llegaba tarde y el `.update()` se aplicaba sin ningún filtro, es decir, a
todas las filas de la tabla. Se arregló haciendo que `.update()`/`.delete()`
/`.insert()`/`.upsert()` difieran la mutación hasta que la promesa
realmente se resuelve (cuando el código hace `await`), momento en el que
ya se han encadenado todos los `.eq()` posteriores. Se descubrió al
probar el botón de migración de guías: con una sola guía por migrar, el
stub (con el bug) marcaba erróneamente 3-4 guías como migradas con
contenido cruzado entre ellas.

## Bug real de seguridad: XSS almacenado vía `cover_emoji` (y el emoji de los bloques de curso)
`guides.cover_emoji` es un campo de texto libre sin ninguna validación
(`<input id="mgCoverEmoji">` en el editor de guías de cualquier usuario de
la comunidad, `editor-guia.html`) y se pintaba **sin escapar** en la
tarjeta de guía por todo el sitio: `js/home.js`, `js/search.js`,
`js/guardados.js`, `js/perfil.js`, `js/usuario.js`, `js/guia.js`,
`js/guide-modal.js` (×2) y las dos tablas de guías de `/admin`. Cualquier
usuario podía crear una guía con `cover_emoji` = un `<img onerror=...>` y
ese HTML se ejecutaba para cualquier visitante que viera la home, un
resultado de búsqueda, sus guardados o el propio panel de admin al
revisar guías pendientes — el caso más grave, porque ahí se ejecutaría
con la sesión de un admin. Lo mismo pasaba con el campo `emoji` (y
`image_url` como atributo `src`) de los bloques de curso `hook`/
`concept`/`warning`/`tip`/`example` en `js/curso.js`. Se arregló envolviendo
los ocho+dos sitios con `escapeHtml()` (incluido el helper compartido
`cardMediaHtml` de `js/app.js`). El resto de emojis sin escapar que
quedan en el código (categorías, colecciones, logros) los edita
únicamente un admin desde `/admin`, así que no son la misma clase de
vulnerabilidad (requieren que la cuenta de admin ya esté comprometida).

Verificado con Playwright: una guía de prueba con
`cover_emoji = '<img src=x onerror="window.__xssFired=...">'` visitando
home/búsqueda/categoría/guia.html/curso.html, confirmando `__xssFired`
en 0, y revirtiendo un punto a la vez para comprobar que la prueba SÍ
detecta la regresión (el `<img>` se parseaba de verdad y disparaba
`onerror`).

## Paridad de moderación en el foro de comentarios de guía
Al construir el foro paginado (`js/guide-forum.js`) se perdieron dos
cosas que sí tenía el hilo de comentarios anterior (el que usaba
`js/wall.js` dentro del popup de `guide-modal.js`): poder reportar el
comentario de otra persona y poder borrar el tuyo propio. Se añadieron
de vuelta — reportar con `reportButtonHtml`/`wireReportButtons` (mismo
sistema que el resto del sitio) y "Eliminar" (visible solo al autor del
comentario, coherente con la política RLS `guide_comments_delete`:
`auth.uid() = author_id or is_admin()`).

## Modal de logro desbloqueado sin cierre por Escape
`gamification.js` → `showAchievementModal()` crea su modal por JS en
vez de vivir en el HTML estático, así que se quedó fuera del barrido de
accesibilidad de modales de una ronda anterior (que buscaba
`<span class="modal-close">` en los archivos `.html`). Se le añadió el
mismo listener de `Escape` que tienen todos los demás modales del sitio.

## Bug real: el registro no generaba un username único/slugificado
`js/auth.js` (registro con contraseña) guardaba `username: name` — el
nombre tal cual lo escribe la persona, sin pasar por `slugify()` ni por
la comprobación de unicidad — a pesar de que `user_profiles` tiene un
índice único sobre `lower(username)` desde
`supabase-migration-usernames.sql`, y de que ya existía el helper
`uniqueUsername()` en `js/app.js` para esto exacto (usado en
`onboarding.js` y en el cambio de username desde `perfil.js`). Dos
personas registrándose con el mismo nombre (o el mismo nombre en
distinta mayúscula/minúscula) hacían que el `upsert` fallase por la
restricción única — y el error ni siquiera se comprobaba, así que la
persona seguía a onboarding sin enterarse de que su perfil no se había
guardado. Se arregló llamando a `uniqueUsername(name, data.user.id)`
igual que en el resto del código, y comprobando el error del `upsert`
para mostrarlo en el formulario en vez de ignorarlo en silencio.

## Bug real de seguridad: la función de IA para generar cursos no comprobaba quién la llamaba
`netlify/functions/generate-course.mjs` (el botón "Generar curso con IA"
del editor de admin) llamaba a la API de pago de Anthropic sin comprobar
en absoluto quién hacía la petición — cualquiera que descubriera la URL
(visible en las peticiones de red del propio panel de admin) podía
llamarla directamente y generar cursos gratis a costa de la cuenta de
Anthropic del proyecto, sin necesitar sesión ni ser admin. Se añadió
`requireAdminUserId()`: valida el token de sesión contra el propio
Supabase (`/auth/v1/user`, con la anon key pública — no hace falta la
service role key) y comprueba `user_profiles.is_admin` (de lectura
pública) antes de dejar pasar la petición; devuelve 401 si falta el
token, es inválido, o el usuario no es admin. `admin/js/editor-guia.js`
ahora manda `Authorization: Bearer <access_token>` de la sesión actual
al llamar a la función.

Verificado con una prueba unitaria en Node que simula `fetch` (sin
token / token inválido / válido pero no admin / admin válido), ya que
este sandbox no tiene acceso de red real a Supabase ni Anthropic —
revirtiendo la comprobación se confirmó que todas las peticiones pasaban
con 200 sin ningún control.

## Dar admin a alguien desde /admin no pedía confirmación
En la tabla de Usuarios de `/admin`, el botón "Hacer admin" cambiaba
`is_admin` al primer clic, sin ningún `confirm()` — a diferencia de
cualquier otra acción consecuente del sitio (borrar guía, borrar
comentario, etc.), que sí lo piden. Un clic accidentado en la fila
equivocada daba acceso total de admin (gestionar guías, usuarios,
reportes...) sin previo aviso. Se añadió un `confirm()` con un mensaje
distinto según se conceda o se quite el acceso.

## Bug real de seguridad: se podía farmear XP infinito en el curso yendo atrás
`js/curso.js` volvía a pintar cualquier bloque desde cero cada vez que se
visitaba (`renderBlock()` → `getBlockHTML(block)`, sin memoria de si ya
se había respondido). Como el botón "← Anterior" deja retroceder a
cualquier bloque ya visto, y `markPracticeCorrect()` daba +5 XP y sumaba
`quiz_correct_count` cada vez que se acertaba una pregunta sin ningún
control de si esa pregunta YA se había acertado antes, bastaba con ir
hacia atrás y hacia adelante por el mismo quiz/verdadero-falso/rellenar
hueco/relacionar/ordenar y volver a acertarlo para ganar XP sin límite —
rompiendo por completo el sentido del ranking por XP, los logros
(`total_xp`, `quiz_correct_count`) y el rango de colaborador. Se arregló
con un `Set` (`completedPracticeIndices`) que recuerda qué posiciones del
curso ya han dado su XP; `markPracticeCorrect()` ahora solo premia la
primera vez que se acierta cada bloque, pero sigue desbloqueando
"Continuar" todas las veces (no bloquea la navegación, solo el premio
duplicado).

Verificado con Playwright: contestar bien un quiz da +5 XP una vez;
retroceder y volver a contestarlo bien (repetido varias veces) ya no
suma nada más — revirtiendo el fix se confirmó que sin él el XP subía
+5 en cada repetición, sin límite.

## Campanita de notificaciones en la barra de navegación
Migración: `supabase-migration-user-notifications.sql` — nueva tabla
`user_notifications` (id, recipient_id, type, title, body, link,
read_at, created_at; índice por `(recipient_id, created_at desc)`).
RLS: cada persona solo ve y marca como leídas sus propias
notificaciones; cualquier persona logueada puede insertar una
notificación **para otra** (no para sí misma) como efecto de una acción
normal. Es una tabla nueva, distinta de la `notifications` ya
existente (esa sigue pensada para avisos globales de admin sin ningún
proveedor de push conectado — ver más arriba).

`js/notifications.js` expone `createNotification({recipientId, actorId,
type, title, body, link})` (con guarda de autonotificación: si
`recipientId === actorId` no hace nada) y `renderNotificationBell(session)`,
que inyecta la campanita por JS justo antes de `#nav-user` dentro de
`.nav-right` — así aparece en todas las páginas con navbar sin tocar
ningún HTML, porque `initNavbar()` (en `js/app.js`) la llama
automáticamente vía import dinámico (para evitar un import circular:
`notifications.js` importa `escapeHtml` de `app.js`). Muestra un
contador de no leídas, un desplegable con las 20 notificaciones más
recientes, marca como leída al pulsar una individual y tiene "Marcar
todas como leídas" (`.is('read_at', null)`).

Disparadores conectados: aprobar o rechazar una guía (con el motivo)
avisa al autor (`admin/js/editor-guia.js`, reutilizando el
`wasApproved`/`authorId` que ya rastreaba el XP al aprobar); una guía
nueva aprobada avisa además a quien sigue a su autor
(`user_follows`); comentar en una guía avisa a su autor, tanto desde
el foro principal de `guia.html` (`js/guide-forum.js`, con
`guideAuthorId` pasado desde `guia.js`) como desde el mini-muro de
comentarios del modal ampliado (`js/wall.js`, resolviendo primero el
`author_id` de la guía porque ese flujo solo tiene el id de la guía a
mano); comentar en el muro de un perfil avisa a quien es dueño de ese
muro (`js/wall.js`); seguir a alguien avisa a la persona seguida
(`js/usuario.js`, solo al seguir, no al dejar de seguir).

**Bug real encontrado al probarlo**: las notificaciones se pintan como
`<a href="...">` para poder llevar a la persona directamente al
contenido — pero al hacer clic el navegador empezaba a navegar
**antes** de que terminara la petición async que marca `read_at`, así
que casi nunca quedaba marcada como leída si tenía enlace (la
navegación cancela la petición en marcha). Se arregló con
`e.preventDefault()`, esperando a que el `update` termine, y solo
entonces navegando a mano con `window.location.href`.

Verificado con Playwright: la campanita se pinta con el contador de no
leídas correcto, el desplegable se abre y marca como leída al pulsar un
ítem (con el fix del `preventDefault`), y los disparadores de
comentario en guía, comentario en muro y nuevo seguidor crean la fila
correcta en `user_notifications` — revirtiendo a mano la notificación
del comentario de muro se confirmó que el test la detecta como
ausente, y restaurándola vuelve a pasar.

## Paginación en "Guías de la comunidad"
La pestaña "Guías de la comunidad" de `usuarios.html`/`js/usuarios.js`
seguía cargando y pintando TODAS las guías de comunidad de golpe (sin
`.range()` ni límite), a diferencia del foro de comentarios de guía
(`js/guide-forum.js`) que ya paginaba. Como esta pestaña además tiene un
buscador en el cliente que filtra sobre la lista ya cargada en memoria,
paginar la consulta a Supabase con `.range()` habría roto ese buscador
(dejaría de poder buscar entre guías que no están en la página actual).
Se optó por seguir cargando la lista completa una sola vez (igual que
antes) pero **paginar el pintado**: `renderCommunityGuides(list, session,
page)` trocea la lista ya filtrada en páginas de 12
(`COMMUNITY_GUIDES_PAGE_SIZE`) y añade los mismos controles "← Anterior /
Página N de M / Siguiente →" que ya existían en el foro de comentarios
(reutiliza la clase `.forum-pagination`). Escribir en el buscador
siempre vuelve a la página 1 del resultado filtrado.

Verificado con Playwright: con más de 12 guías de comunidad, la primera
página muestra exactamente 12 tarjetas y "Página 1 de 2", "Anterior"
está deshabilitado en la primera página y "Siguiente" en la última, y
buscar mientras se está en la página 2 vuelve correctamente a la
página 1 del resultado filtrado (en vez de intentar pintar una página 2
vacía de una lista filtrada más corta) — quitando el troceo por página
(pintando la lista entera siempre) se confirmó que el test detecta la
regresión: la página 1 pasa a mostrar las 16 guías en vez de 12.

## Rediseño de la barra de navegación (lupa + campanita + menú de cuenta)
Se sustituyó el enlace de texto "Buscar" de `.nav-links` (y el resto de
la barra de la derecha) por una fila de iconos estilo foro clásico:
🔍 lupa de búsqueda, 🔔 campanita de notificaciones (ya existía) y el
avatar, ahora con un menú desplegable en vez de ser un simple enlace a
`/perfil.html`. Todo se inyecta por JS desde `initNavbar()`
(`js/app.js`), igual que ya hacía la campanita — cero cambios de HTML
en las páginas. `hideBuscarNavLink()` quita el link "Buscar" de
`.nav-links` en tiempo de ejecución (se deja tal cual en el menú móvil,
donde el popup de búsqueda no encaja bien).

**Lupa de búsqueda** (`js/nav-search.js`): el primer clic abre un mini
popup con un input y un botón "Buscar" (además de un enlace "Búsqueda
avanzada…" directo a `/buscar.html`); si el popup ya está abierto, un
segundo clic en el icono navega directamente a
`/buscar.html?q=<lo escrito>` (lo mismo que el submit del formulario o
pulsar Enter). `js/search.js` ahora lee `?q=` de la URL al cargar para
precargar el input y lanzar la búsqueda automáticamente, así que un
enlace con query ya deja la página de búsqueda lista sin que haga falta
volver a escribir.

**Menú de cuenta** (avatar, dentro de `renderNavUser()` en `js/app.js`):
al pulsar el avatar se abre un mini perfil con avatar grande, nombre,
`@username`, una fila de estadísticas (XP total, nivel y, si tiene
alguna guía aprobada, su rango de colaborador vía `contributorTier()`
— importado con `import()` dinámico para no crear un ciclo con
`gamification.js`, que a su vez importa `burstConfetti` de `app.js`) y
enlaces a "Mi perfil", "Guardados" y "Cerrar sesión". No incluye
todavía "Firma", "Privacidad", "Ignorados" ni "Estado" — son conceptos
nuevos que no existen en el sitio, así que se han dejado fuera de esta
ronda a propósito en vez de montar páginas de relleno; se pueden añadir
más adelante si hacen falta de verdad.

**Ampliación de la campanita**: se añadieron dos disparadores nuevos —
valorar una guía con estrellas (`guide_rating`, en el widget de
valoración del modal ampliado, `js/guide-modal.js`) y dejar una reseña
en un perfil (`profile_rating`, `js/usuario.js`) — ambos solo avisan la
PRIMERA vez que alguien valora (cambiar una valoración ya puesta no
genera spam de notificaciones), cubriendo lo que se pidió como "likes"
y "ratings" ya que el sitio no tiene un sistema de "me gusta"
independiente, solo valoraciones de 1 a 5 estrellas sobre guías y
perfiles.

**Mensajería privada**: deliberadamente NO incluida en esta ronda — es
una función nueva de verdad (tablas, hilos, bandeja) que se decidió
tratar aparte para no mezclarla con este rediseño. El permiso ya
decidido para cuando se monte: cualquier usuario logueado podrá
escribirle a cualquier otro, sin restricción de seguimiento mutuo.

Verificado con Playwright: el link de texto "Buscar" desaparece de la
barra, la lupa abre el popup al primer clic y (comprobado interceptando
la petición real, ya que el servidor local de pruebas recorta la query
al redirigir `.html` con `?query` — algo que no pasa en Netlify, que no
tiene ninguna regla para `buscar.html`) el segundo clic pide
`/buscar.html?q=<lo escrito>` tal cual; `buscar.html` precarga el input
al abrir con `?q=` en la URL; el menú de cuenta muestra el nombre, el
XP y los enlaces reales; valorar una guía ajena y reseñar un perfil
ajeno crean sus notificaciones — quitando `hideBuscarNavLink()` y la
notificación de valoración de guía por separado se confirmó que el
test detecta ambas regresiones.

## Mensajería privada (conversaciones 1 a 1)
Migración: `supabase-migration-private-messages.sql` — tres tablas
nuevas (`conversations`, `conversation_participants` con
`last_read_at`, y `private_messages`) y una función auxiliar
`is_conversation_participant(conv_id)` (SECURITY DEFINER, como
`is_admin()`) que las políticas RLS usan para comprobar "¿formo parte
de esta conversación?" sin caer en recursión al consultar la propia
`conversation_participants` desde su propia política. Cualquier
usuario logueado puede escribirle a cualquier otro — sin restricción de
seguimiento mutuo, tal como se decidió — así que la única puerta de
entrada real es "eres participante o no". Insertar un participante
nuevo está permitido si la fila es la tuya propia, o si ya eres
participante de esa conversación (así, al crear una conversación:
primero te insertas a ti, y esa condición ya te deja añadir también a
la otra persona).

**Límite conocido y aceptado**: no hay ningún tope de 2 participantes
por conversación a nivel de base de datos (haría falta un trigger). El
cliente siempre inserta exactamente dos, así que en el uso normal del
sitio nunca pasa de ahí — igual que otros límites ya documentados en
este archivo (p. ej. `is_pro` es solo cosmético), se deja anotado en vez
de montar un trigger para un caso que requeriría llamar a la API a mano
con intención de saltárselo.

`js/messages.js` es la capa de datos compartida (usada por la
campanita de mensajes de la navbar y por `mensajes.html`):
`findOrCreateConversation()` reutiliza la conversación si ya existe
entre dos personas en vez de crear una duplicada cada vez; `sendMessage`
/`loadThreadMessages`/`markConversationRead`/`listConversations`
resuelven cada uno una petición sencilla; `isParticipant()` es una
comprobación extra en el cliente (aparte de lo que ya hace RLS en el
servidor) para no mostrar un hilo ajeno solo por adivinar su id, si
algo llegara a fallar en el lado del servidor.

**Campanita de mensajes** (`js/nav-messages.js`, ✉️, se inyecta igual
que la de notificaciones): contador de conversaciones con algo sin
leer, desplegable con las últimas conversaciones (nombre de la otra
persona + fragmento del último mensaje + fecha), "Ver todo…" a
`/mensajes.html` e "Iniciar una nueva conversación" a
`/mensajes.html?new=1`.

**`mensajes.html`** (`js/mensajes.js`) hace de bandeja y de hilo a la
vez, según la query string: sin parámetros, lista las conversaciones;
`?c=<id>` abre un hilo (marca como leído al abrirlo); `?with=<id de
usuario>` busca-o-crea la conversación con esa persona y redirige a su
`?c=`; `?new=1` muestra un buscador de usuarios para arrancar una
conversación nueva desde cero. En `usuario.html`, el perfil de
cualquier otra persona (no el tuyo) tiene un botón "✉️ Mensaje" junto a
"Seguir" que lleva a `?with=<su id>`.

Los mensajes privados **no** generan una fila en `user_notifications`
— tienen su propio sistema de no-leídos (la campanita de mensajes, con
`last_read_at` por participante), así que mezclarlos con la campanita
de notificaciones habría sido redundante.

Verificado con Playwright: la campanita de mensajes muestra el no
leído y el desplegable con la otra persona y el último mensaje; el
botón "Mensaje" del perfil ajeno reutiliza la conversación existente en
vez de crear una duplicada; enviar un mensaje lo guarda con el
`sender_id` correcto y aparece en el hilo; buscar a alguien sin
conversación previa crea una nueva (con un id distinto de una ya
existente) y esa persona también queda como participante y puede abrir
el hilo desde su lado. Al revisar esto último se encontró un hueco
real: `getOtherParticipant()` no comprobaba que quien mira el hilo
fuera realmente participante — así que se añadió `isParticipant()`
como comprobación extra en el cliente; comentando la inserción del
segundo participante se confirmó que, sin ese fix, el test lo detecta
(el destinatario no podía abrir su propio hilo — un efecto colateral
observable del hueco, ya que sin RLS real en el stub de pruebas no se
puede simular directamente "alguien ajeno cuela por el id").

## Repaso de la mensajería privada tras montarla: dos bugs reales más
Al revisar `js/mensajes.js` con la misma mirada que ya encontró el
"doble envío" en los editores de guía, aparecieron dos huecos del
mismo estilo, más uno menor de robustez:

- **Doble clic en "Enviar" podía duplicar el mensaje**: el botón no se
  desactivaba ni había ninguna bandera mientras la petición estaba en
  marcha, así que un doble clic rápido disparaba dos inserciones con el
  mismo texto. Se arregló con una bandera `sending` + `btn.disabled`
  mientras dura el envío, igual que la de los editores. **Nota sobre
  cómo se probó**: dos `page.click()` de Playwright por separado NO
  bastan para reproducir la carrera (el viaje de ida y vuelta entre uno
  y otro deja tiempo de sobra para que el primero termine contra un
  stub tan rápido) — hubo que disparar `btn.click(); btn.click()`
  seguidos y síncronos dentro de un único `page.evaluate()`, igual que
  se hizo para demostrar el bug de los editores.
- **Los mensajes propios no se podían borrar**: la migración ya daba
  permiso RLS para ello (`private_messages_delete`,
  `sender_id = auth.uid()`) pero ningún botón de la interfaz lo usaba.
  Se añadió "Eliminar" bajo cada mensaje propio (con `confirm()`, igual
  que el resto del sitio), usando `deleteMessage()` de
  `js/messages.js`.
- **Escribirte a ti mismo por URL a mano** (`/mensajes.html?with=<tu
  propio id>`) dejaba la página colgada en "Cargando…" para siempre,
  porque `findOrCreateConversation()` lanza un error que nadie
  capturaba. No es alcanzable desde ningún botón real del sitio (el
  botón "Mensaje" se oculta en tu propio perfil), pero como el arreglo
  es de una línea, se añadió un redirect a la bandeja en ese caso en
  vez de dejarlo así.

Verificado con Playwright: doble clic síncrono en "Enviar" guarda el
mensaje una sola vez (revirtiendo la bandera `sending` se confirmó que
sin ella se duplicaba); "Eliminar" no aparece en un mensaje ajeno, y en
uno propio lo borra tanto de la base como del hilo pintado (revirtiendo
`deleteMessage()` se confirmó que el test lo detecta); visitar
`?with=<tu propio id>` te devuelve a la bandeja de mensajes en vez de
quedarse cargando para siempre.

## Bug real: los desplegables de la navbar se salían de la pantalla en móvil
Con la lupa, los mensajes y la campanita apretados a la derecha (más el
avatar), cada desplegable se posicionaba con `right: 0` **relativo a su
propio icono**, no al borde de la pantalla. Como los desplegables miden
260-320px de ancho y solo el último icono de la fila (el avatar) está
cerca del borde derecho real, abrir la lupa, los mensajes o la
campanita en un móvil normal (375px) sacaba buena parte del
desplegable fuera de la pantalla por la izquierda — el texto quedaba
literalmente cortado ("...ones" en vez de "Conversaciones"). Se
arregló con una media query (`max-width: 899px`, el mismo punto en el
que la barra ya pasa a hamburguesa) que ancla estos tres desplegables
al viewport con `position: fixed; left: 12px; right: 12px;` en vez de
depender de dónde esté su icono.

Verificado con Playwright a 375px de ancho: los tres desplegables
(lupa, mensajes, campanita) quedan dentro de la pantalla al abrirse —
antes del fix, comprobando el `boundingBox()` de cada uno, el `x` daba
negativo (parte del desplegable literalmente fuera del viewport por la
izquierda).

## Iconos SVG en vez de emoji en la barra de navegación
Los emoji de la lupa (🔍), el sobre (✉️), la campanita (🔔) y el menú
de cuenta (👤/⭐/🚪) se sustituyeron por iconos SVG en línea, estilo
trazo fino (misma familia visual que Feather/Lucide — círculos y líneas
limpias, sin relleno) en vez de los emoji nativos del sistema
operativo, que se veían inconsistentes entre dispositivos y le daban un
aire más "cutre"/genérico a la barra.

`js/icons.js` es el módulo compartido: una función `icon(inner, size)`
que envuelve cualquier `<path>`/`<circle>`/etc. en un `<svg>` con
`stroke="currentColor"` (así hereda el color de texto de donde se
pinte, sin CSS aparte) y expone `icons.search/bell/mail/user/logOut/
star/edit`. Son SVG escritos a mano, **sin depender de ningún paquete
ni CDN externo** — no hace falta instalar nada ni cargar una fuente de
iconos por red (lo cual, de paso, evita el mismo tipo de lentitud/
inestabilidad de red ya vista con Google Fonts en este entorno).

Se usan en `js/nav-search.js` (lupa), `js/notifications.js`
(campanita), `js/nav-messages.js` (sobre + lápiz de "nueva
conversación") y `js/app.js` (👤 Mi perfil, ⭐ Guardados, 🚪 Cerrar
sesión del menú de cuenta). El resto de emoji del sitio (los de
categorías, logros, guías, bloques de curso, etc.) se dejan tal cual —
esos son "personalidad de marca" elegida por quien crea el contenido,
no elementos de interfaz, así que no es la misma categoría de cosa que
pedía cambiarse.

CSS: `.nav-bell-btn`/`.nav-search-btn` pasan de centrar un emoji por
`font-size` a centrar el SVG con flexbox y `color: var(--text-mid)`
(con hover a `var(--navy)`); `.nav-user-links a/button` ganan
`display:flex; align-items:center; gap:10px` para alinear el icono con
el texto de cada opción del menú.

Verificado con Playwright: se volvió a pasar toda la batería de tests
de la navbar/mensajería/notificaciones tras el cambio (búsqueda,
mensajes, campanita, valoraciones, doble envío, mobile) — todo sigue
pasando igual, confirmando que sustituir el emoji por el SVG dentro del
mismo botón no rompió ningún selector ni comportamiento.

## Reportar mensajes privados
Migración: `supabase-migration-report-messages.sql`. Los mensajes
privados eran el único tipo de contenido generado por usuarios sin
botón de reportar (guías, comentarios de muro/guía y reseñas de perfil
ya lo tenían desde antes). Se añade `'private_message'` a la lista de
`content_type` permitidos en `content_reports` (la migración busca y
sustituye el `check` existente por su nombre real en `pg_constraint`
en vez de asumir el nombre autogenerado, por si Supabase le puso uno
distinto al que genera Postgres por defecto).

**El hueco de RLS que hacía falta cerrar**: las políticas de
`private_messages` solo dejan leer un mensaje a quien es participante
de esa conversación (`is_conversation_participant()`) — ni siquiera un
admin podía ver el contenido de un mensaje reportado, porque nunca es
participante de conversaciones ajenas. Se añadió una política nueva,
deliberadamente estrecha: un admin puede leer un mensaje privado **si y
solo si ese mensaje concreto ya ha sido reportado**
(`exists (select 1 from content_reports where content_type =
'private_message' and content_id = private_messages.id)`) — no da
acceso a la conversación entera ni a mensajes no reportados, solo al
mensaje puntual que alguien ha señalado.

`js/mensajes.js` reutiliza `reportButtonHtml`/`wireReportButtons` de
`js/report.js` (mismo sistema que el resto del sitio): el botón 🚩
aparece en los mensajes ajenos del hilo, en el mismo sitio donde tus
propios mensajes muestran "Eliminar" (nunca los dos a la vez). En
`admin/js/admin.js`, `loadContentPreviews()` gana una rama para
`private_message` que muestra "De `<remitente>`: `<fragmento>`" sin
enlace (a diferencia del resto de tipos, que sí enlazan a la guía o el
perfil) — un admin no puede abrir el hilo completo aunque quisiera, así
que no tiene sentido ofrecer ese enlace.

Verificado con Playwright: el botón de reportar aparece en un mensaje
ajeno y no en el propio; reportar crea la fila
`content_reports` con `content_type = 'private_message'`; el panel de
reportes de `/admin` muestra "✉️ Mensaje privado" con quién lo envió y
un fragmento del texto — quitando la rama de `private_message` en
`loadContentPreviews()` se confirmó que el test detecta la regresión
(deja de aparecer el remitente/fragmento en la tabla).

## Racha diaria de XP
Migración: `supabase-migration-streak.sql` — dos columnas nuevas en
`user_profiles`: `current_streak` (int, días seguidos) y
`last_active_date` (date). `checkDailyStreak(userId)` en
`js/gamification.js` se llama una vez por carga de página desde
`initNavbar()` (sin esperar a que termine, para no frenar el resto de
la navbar — en el 99% de las cargas no hace nada porque ya se contó
hoy): si `last_active_date` es hoy, no hace nada; si es ayer, suma 1 a
la racha; en cualquier otro caso (primera vez, o dejó pasar un día) la
reinicia a 1. Cada vez que de verdad avanza la racha, da un bonus fijo
de +5 XP vía `addXP()` (que de paso ya recalcula el nivel y comprueba
logros, como cualquier otra fuente de XP del sitio).

Se muestra en dos sitios: la tarjeta de estadísticas del propio perfil
(`perfil.js`, "🔥 N — Racha (días)") y, para que se vea sin tener que
entrar al perfil cada vez (todo el sentido de una racha es que se vea a
menudo), como una estadística más del menú de cuenta de la navbar
(`js/app.js`) — esta última solo si la racha es mayor que 0, igual que
ya hacía el rango de colaborador.

Verificado con Playwright: la primera vez que alguien entra (sin
`last_active_date` previo) la racha pasa a 1 y suma exactamente +5 XP;
si ya estuvo activo ayer, la racha continúa (3 → 4) en vez de
reiniciarse; entrar dos veces el mismo día no vuelve a incrementar ni a
dar XP; aparece tanto en el perfil como en el menú de cuenta —
rompiendo a propósito la condición de "sigue si fue ayer" (forzando
que siempre reinicie a 1) se confirmó que el test detecta la
regresión.

**Nota sobre el stub de pruebas**: al dar XP en cada carga de página para
cualquier usuario cuyo `last_active_date` de seed no sea "hoy", esta
función empezó a alterar el `total_xp` de Ash en CUALQUIER test que lo
usara de actor genérico (la inmensa mayoría de los de esta sesión),
rompiendo aserciones de XP exacto que no tienen nada que ver con la
racha. Se corrigió dejando a Ash con `last_active_date` ya en "hoy" en
el seed (la racha no hace nada en su caso, como si ya hubiera entrado),
y dejando `null`/"ayer" solo en Brock y Misty, que son quienes usan los
tests dedicados a la racha. No es código del repo, vive en el stub del
scratchpad.

## Preferencias de notificaciones
Migración: `supabase-migration-notification-prefs.sql` — una columna
nueva en `user_profiles`, `notification_prefs_disabled` (text[],
`'{}'` por defecto — todo activado). `createNotification()` en
`js/notifications.js` consulta esa lista del destinatario antes de
insertar y no hace nada si el tipo está en ella; `NOTIFICATION_TYPES`
(el mismo módulo) es el mapa `tipo → etiqueta en español` que usa tanto
esta comprobación como el formulario de preferencias, para no tener la
lista de tipos duplicada en dos sitios.

La UI vive dentro del mismo modal "Editar perfil" de `perfil.js` (pestaña
"Acerca"): una casilla por tipo, todas marcadas por defecto, que se
guardan junto con el resto del formulario (bio, username, banner...) en
el mismo `update` a `user_profiles`.

Verificado con Playwright: todas las casillas empiezan marcadas:
desactivar "Nuevos seguidores" y guardar hace que `createNotification()`
para ese tipo no inserte nada, mientras que otros tipos no tocados
(`wall_comment`) siguen funcionando con normalidad — quitando la
comprobación de preferencias en `createNotification()` se confirmó que
el test detecta la regresión (la notificación desactivada vuelve a
crearse).

## Modo oscuro
Todo el diseño de la web ya salía de un único bloque `:root { --navy:
...; --bg: ...; --text: ...; ... }` en `css/style.css`, así que el modo
oscuro se implementó casi entero como un bloque de reemplazo,
`:root[data-theme='dark'] { ... }`, con los mismos nombres de variable
en tonos oscuros — sin tocar el resto de reglas CSS, que ya las usan
todas. Se encontró un bug real durante la verificación visual: `.navbar`
tenía el fondo escrito a mano (`rgba(255, 255, 255, 0.92)`) en vez de con
variable, así que se quedaba clara aunque el resto de la página pasara a
oscuro. Se corrigió añadiendo `--navbar-bg` (clara/oscura) y usando
`background: var(--navbar-bg)`.

`js/theme.js` añade el botón de sol/luna a la barra de navegación (junto
a la lupa de búsqueda, antes del menú de cuenta) usando los iconos
nuevos `sun`/`moon` de `js/icons.js`; al hacer clic alterna
`document.documentElement.dataset.theme` entre `'light'`/`'dark'` y lo
guarda en `localStorage` bajo la clave `pokedoc-theme`. Para evitar el
parpadeo de tema claro al cargar con el oscuro ya guardado, las 17
páginas HTML del sitio llevan un script en línea, síncrono, justo
después de `<meta charset="UTF-8" />` (antes de que se cargue ningún
CSS ni se pinte nada) que lee `localStorage` y, si no hay preferencia
guardada, cae a `matchMedia('(prefers-color-scheme: dark)')` (la
preferencia del sistema, que no se persiste — solo se usa como arranque
por defecto).

Verificado con Playwright: sin preferencia guardada arranca en claro con
el icono de luna; el clic cambia `data-theme` a `dark`, lo persiste en
`localStorage` y cambia el icono a sol; con `pokedoc-theme=dark` ya
guardado antes de cargar, `data-theme` ya vale `dark` nada más hacer
`goto` (sin esperar a que termine de cargar la página) y la navbar usa
el fondo oscuro; alternar de vuelta a claro también persiste. Deshacer
temporalmente el fix de `--navbar-bg` (volviendo al `rgba(255, 255,
255, 0.92)` fijo) hizo fallar la comprobación de la navbar en oscuro,
confirmando que el test detecta la regresión; se restauró el fix y
volvió a pasar.

## Feedback general (previo al lanzamiento a testers)
Migración: `supabase-migration-app-feedback.sql` — tabla `app_feedback`
(`user_id`, `body`, `page_url`, `status` con default `'new'`). Es
deliberadamente una tabla aparte de `content_reports`: esta última es
para denunciar contenido publicado por otro usuario (una guía, un
comentario...), mientras que `app_feedback` es para que cualquiera
mande sugerencias o avisos de bugs que no apuntan a ningún contenido
concreto.

`js/feedback.js` monta el modal bajo demanda (`openFeedbackModal()`) y
lo engancha desde el desplegable de cuenta en `js/app.js`
("💬 Enviar feedback", junto a "Cerrar sesión"). El admin tiene una
sección nueva ("💬 Feedback" en la barra lateral, `loadFeedback()` en
`admin/js/admin.js`) que lista el feedback con `status = 'new'` y
permite marcarlo como revisado o descartarlo, calcada de la sección de
Reportes que ya existía.

Verificado con Playwright: el botón aparece en el desplegable, abre el
modal, enviar vacío no hace nada, enviar con texto lo guarda y cierra
el modal, y el admin lo ve en su sección y puede marcarlo como
revisado (tras lo cual desaparece de la lista de "nuevo"). Se
comprobó el detector de regresiones cambiando el filtro de
`loadFeedback()` a `status = 'reviewed'`: el test detectó que el admin
dejaba de ver el feedback nuevo; se restauró y volvió a pasar.

## Páginas de Términos de uso y Privacidad
Dos páginas estáticas nuevas, `terminos.html` y `privacidad.html`, con
el mismo navbar/footer que el resto del sitio (clase `.legal-page`
nueva en `css/components.css` para el espaciado de títulos/párrafos/
listas). El footer de las 13 páginas públicas que ya tenían pie de
página (`index.html`, `aprender.html`, `buscar.html`, `categoria.html`,
`editor-guia.html`, `guardados.html`, `guia.html`, `mensajes.html`,
`perfil.html`, `usuario.html`, `usuarios.html`, además de las dos
nuevas) ahora enlaza a ambas.

El contenido cubre lo esencial para una beta cerrada en español: qué
es PokeDoc y el aviso de que no está afiliado a Nintendo/Game Freak/
The Pokémon Company (al tratarse de un sitio de fans sobre el TCG de
Pokémon), qué datos se guardan y para qué, con quién se comparten
(Supabase y Netlify, que son quienes alojan el sitio), moderación y
reportes, y cómo pedir que se borren los datos (a mano, vía el botón
de feedback, ya que todavía no hay autoservicio).

Verificado con Playwright: el footer de la home lleva a ambas
páginas, cada una carga con su título y su contenido clave (el aviso
de marcas en Términos, la mención a Supabase/Netlify en Privacidad).
Se rompió a propósito el texto de un enlace del footer para confirmar
que el test lo detecta; se restauró y volvió a pasar.

## Reenviar confirmación de email
`js/auth.js` ya avisaba de "Confirma tu cuenta desde el enlace que te
enviamos por email" al intentar iniciar sesión sin confirmar (y ya
mostraba "Revisa tu email" justo después de registrarse, si el
proyecto de Supabase tiene la confirmación por email activada), pero
no había forma de volver a pedir ese email si se perdía o caducaba.
Se añadió un botón "Reenviar email de confirmación" en `auth.html`
(oculto por defecto, dentro del paso de login), que aparece solo
cuando el error de login es justo ese ("Email not confirmed") y llama
a `supabase.auth.resend({ type: 'signup', email })` con el email que
se acaba de escribir.

**Importante:** esto depende de que el proyecto de Supabase tenga
activado "Confirm email" en Authentication → Settings del panel — es
un ajuste del dashboard, no algo que se pueda activar desde una
migración SQL ni desde el código del sitio.

Verificado con Playwright (con el stub simulando el error "Email not
confirmed" para una contraseña de prueba): el botón empieza oculto,
aparece solo tras ese error concreto (no con una contraseña
simplemente incorrecta), reenviar muestra un toast de éxito, y si el
reenvío falla se muestra el error real en vez de uno genérico. Se
rompió a propósito la condición que detecta el error para confirmar
que el test lo pilla; se restauró y volvió a pasar.

## Registro de errores de cliente
Migración: `supabase-migration-client-errors.sql` — tabla
`client_errors` (`user_id` nullable, `message`, `stack`, `page_url`,
`user_agent`, `status` con default `'new'`). El insert está abierto a
cualquiera (`with check (true)`), incluso sin sesión, porque muchos
errores pueden pasar antes de que exista una — es la única tabla del
proyecto con esa política tan abierta, a propósito, ya que solo
guarda telemetría de errores, no contenido de usuario.

Alternativa casera a un servicio externo tipo Sentry, ya que no hay
credenciales de ningún APM en este proyecto. `js/error-log.js`
engancha `window.addEventListener('error', ...)` y
`'unhandledrejection'` desde `initNavbar()` (`js/app.js`, muy al
principio, antes de cualquier otra cosa) y guarda mensaje, traza,
página y usuario (si hay sesión). Tiene un tope de 5 errores por
carga de página para no inundar la tabla si algo entra en bucle.

El admin tiene una sección nueva ("🐞 Errores"), calcada de Feedback y
Reportes: lista los errores con `status = 'new'` (los 50 más
recientes), con la traza completa en el `title` del mensaje, y permite
marcarlos como revisados o descartarlos.

Verificado con Playwright: un error sin capturar y una promesa
rechazada sin capturar se registran con el mensaje, la página y el
usuario correctos; lanzar 10 errores seguidos no registra más de 5
(el límite); el admin ve el error y puede marcarlo como revisado. Se
subió el límite a 50 para comprobar que el test de rate-limit lo
detecta; se restauró y volvió a pasar.

## Auditoría de datos de prueba (`supabase-audit-test-data.sql`)
Script de solo lectura (nada de código de la app, no aplica el
proceso de pruebas con Playwright) para repasar en el SQL Editor de
Supabase antes de invitar a testers: busca guías, categorías,
perfiles y comentarios con pinta de ser contenido de prueba (títulos
con "test", "prueba", "lorem ipsum", relleno numerado tipo
`g-page-*`...), y da un recuento general de cuánto contenido real hay
ya. No borra nada automáticamente — al final incluye, comentado, el
patrón de `delete ... where id in (...)` a rellenar a mano una vez
identificadas las filas concretas que sí sobran.

Aclaración importante: no tengo acceso a la base real desde este
entorno (solo al stub de pruebas), así que no puedo confirmar qué
contenido de prueba hay de verdad ahí — este script es para que tú
mismo lo compruebes, no una lista de cosas que ya sé que hay que
borrar.

## SEO mínimo
Favicon (`assets/favicon.svg`, un icono simple con la misma "P" en
navy que ya usa `.nav-logo::before`), enlazado desde las 19 páginas
HTML del sitio (públicas y de admin). Meta description añadida a las
páginas públicas que no la tenían (`aprender`, `buscar`, `categoria`,
`curso`, `guia`, `usuario`, `usuarios`) — `index`, `auth`, `terminos`
y `privacidad` ya la tenían de antes.

Las páginas que no tiene sentido que indexe un buscador (acciones
privadas de cuenta, o todo `/admin/`) llevan `<meta name="robots"
content="noindex" />`: `editor-guia.html`, `guardados.html`,
`mensajes.html`, `onboarding.html`, `perfil.html`,
`reset-password.html` y las dos páginas de `/admin/`.

`robots.txt` bloquea `/admin/` y apunta a `sitemap.xml`. El sitemap
solo lista páginas verdaderamente estáticas (`index`, `aprender`,
`buscar`, `usuarios`, `terminos`, `privacidad`) — las páginas de
contenido dinámico (`categoria.html`, `guia.html`, `usuario.html`...)
se quedan fuera a propósito, porque sus URLs dependen de datos que
viven en Supabase y generarlas necesitaría un paso de compilación en
el despliegue que este proyecto no tiene. **El sitemap usa
`https://tu-dominio.example/...` como placeholder — hay que
sustituirlo por el dominio real antes de que sirva de algo.**

Verificado con Playwright: el favicon aparece en el `<head>`, una
página pública tiene meta description y no tiene noindex, una página
privada (mensajes) y el admin sí llevan noindex, `robots.txt` bloquea
`/admin/` y `sitemap.xml` se sirve con `index.html` dentro. Se rompió
a propósito el `Disallow` de `robots.txt` para confirmar que el test
lo detecta; se restauró y volvió a pasar.

## Moderación: banear y silenciar usuarios
Migración: `supabase-migration-user-moderation.sql` — dos columnas
nuevas en `user_profiles` (`is_banned`, `is_muted`, ambas `boolean
not null default false`) y dos funciones auxiliares SECURITY DEFINER,
`is_banned()`/`is_muted()` (mismo patrón que `is_admin()` e
`is_conversation_participant()` de migraciones anteriores).

**Banear** cierra la sesión de esa persona en cuanto vuelve a cargar
cualquier página (comprobado en `initNavbar()`, `js/app.js`, justo
después de obtener la sesión) y la manda a `/auth.html?banned=1`, que
muestra "Esta cuenta ha sido suspendida...". **Silenciar** no la echa
ni le impide seguir navegando — solo evita que publique nada nuevo.
Ambos estados, además, quedan reforzados a nivel de RLS: las políticas
de inserción de `guides`, `profile_comments`, `profile_reviews`,
`guide_comments`, `guide_reviews` y `private_messages` ahora exigen
`not is_banned() and not is_muted()`, así que aunque alguien saltara
el aviso del cliente, la base de datos seguiría rechazando cualquier
intento de publicar.

El admin tiene dos botones nuevos por usuario en la sección
"Usuarios" ("Banear"/"Quitar baneo" y "Silenciar"/"Quitar silencio"),
con confirmación antes de banear (igual que ya pasaba con "Hacer
admin"), y una columna de estado que muestra "🚫 Baneado" o
"🔇 Silenciado" cuando aplica.

Verificado con Playwright: el admin puede banear/desbanear y
silenciar/dessilenciar desde la tabla de usuarios y el estado se
refleja al momento; un usuario baneado que vuelve a cargar la navbar
(`initNavbar()`) cierra sesión y acaba en la página de login, que
muestra el aviso de cuenta suspendida; un usuario solo silenciado NO
es expulsado. Lo que no se puede probar con Playwright contra el stub
(como con el resto de políticas de RLS de toda la sesión) es que la
base de datos real rechace el insert de un baneado/silenciado — el
stub no simula RLS, solo se puede confirmar en el SQL Editor de
Supabase tras aplicar la migración. Se rompió a propósito la
comprobación de `is_banned` en `initNavbar()` para confirmar que el
test lo detecta; se restauró y volvió a pasar.

**Corrección tras el primer intento real:** al ejecutarla en la base
real dio `ERROR: 42P01: relation "guide_comments" does not exist` —
esa tabla la crea `supabase-migration-guide-comments.sql`, de una
ronda anterior, que aparentemente no se había llegado a ejecutar (o
esa tabla se llama distinto en la base real). Se reescribió el bloque
de políticas envolviendo cada tabla en `if to_regclass(...) is not
null then ... end if;`, así que ahora la migración solo toca las
tablas que existen de verdad y no aborta entera por una que falte. El
propio script incluye, comentada al final, la consulta para comprobar
cuáles de las seis tablas afectadas existen en tu base.

## Retoques finales: menú, pestañas de Comunidad, icono de feedback y selector de emoji
Cuatro ajustes pedidos tras revisar el sitio:

**"Buscar" fuera del menú de texto.** Era redundante con la lupa de
búsqueda (que ya hace lo mismo con un popup + `/buscar.html` para la
búsqueda avanzada), así que se quitó el enlace de texto tanto del
menú de escritorio como del menú móvil (hamburguesa) en las 13
páginas que llevan navbar completa — antes solo se ocultaba con JS
(`hideBuscarNavLink()` en `js/app.js`, y solo en escritorio, no en
el menú móvil), así que en el hamburguesa seguía apareciendo. Ahora
está quitado directamente del HTML y esa función ya no existe.
`buscar.html` sigue siendo una página normal y funcional, solo que ya
no tiene un enlace de texto en el menú.

**Pestaña "Guías de la comunidad" primero.** En `usuarios.html`,
"Usuarios" era la pestaña por defecto; ahora "Guías de la comunidad"
es la primera y la que se ve al entrar, con "Usuarios" como
secundaria. Es solo un cambio de orden en el HTML (la lógica de
`usuarios.js` que engancha las pestañas ya era genérica por
`data-ctab`, no hacía falta tocarla).

**Icono en vez de emoji en "Enviar feedback".** El botón del
desplegable de cuenta llevaba el emoji 💬 mientras que el resto de
enlaces de ese menú (Mi perfil, Guardados, Cerrar sesión) usan los
iconos SVG en línea de `js/icons.js`. Se añadió `icons.messageSquare`
con el mismo estilo de trazo fino que el resto.

**Selector de emoji para la portada de las guías.** Antes el campo
"Emoji de portada" (`editor-guia.html`/`admin/editor-guia.html`) era
un input de texto donde había que pegar el emoji a mano. `js/
emoji-picker.js` (`attachEmojiPicker(input)`) añade un botón junto al
input que abre una rejilla de ~36 emojis pensados para el tema del
sitio (cartas, lupa, escudo, rareza, tipos...); al elegir uno se
rellena el input (que se deja editable por si alguien prefiere pegar
otro) y se dispara un evento `input` para que cualquier lógica que
esté escuchando (autoguardado, etc.) se entere del cambio.

Verificado con Playwright: "Buscar" ya no aparece ni en el menú de
escritorio ni en el móvil (y el resto de enlaces siguen ahí); la
pestaña de guías es la activa por defecto en Comunidad y cambiar a
Usuarios sigue funcionando; el botón de feedback usa un `<svg>` en
vez del emoji; el selector de emoji abre el panel, deja elegir una
opción, rellena el input y el botón, se cierra solo al elegir o al
hacer clic fuera, y funciona igual en el editor de usuario y en el
del admin. Se rompieron a propósito la marca de pestaña activa por
defecto y la asignación del emoji elegido al input, uno por uno, para
confirmar que los tests detectan cada regresión; se restauraron y
volvieron a pasar.

## Icono de categoría personalizado (dibujo en vez de emoji)
Migración: `supabase-migration-category-icon-image.sql` — columna
nueva `icon_image` en `categories` (separada de `cover_image`, que ya
existía y se usa para una foto de portada grande; `icon_image` es
para un dibujo pequeño en el cuadradito de icono, un uso distinto).

`categoryIconHtml(category, size)` en `js/app.js` es el punto único
que decide qué pintar: si la categoría tiene `icon_image`, un
`<img>`; si no, el emoji de siempre (que se queda como alternativa
automática mientras no haya dibujo). Se usa en los cuatro sitios
donde aparecía el emoji de categoría: la rejilla de la home
(`home.js`), el listado de "Aprender" (`aprender.js`), la cabecera de
`categoria.html` (`categoria.js`) y la categoría recomendada del
onboarding (`onboarding.js`) — antes cada uno repetía su propio
`cat.emoji || '📘'`.

El admin tiene un campo nuevo, "Icono personalizado (URL, opcional)",
en el formulario de categorías, con una miniatura en la tabla cuando
ya hay uno puesto. El flujo pensado es: subir el dibujo desde la
pestaña "Imágenes" del admin (ya sube a Supabase Storage y da una
URL pública) y pegar esa URL en el campo nuevo de la categoría —
sin tocar código para cada icono nuevo.

Verificado con Playwright: una categoría con `icon_image` muestra la
imagen en vez del emoji en las cuatro ubicaciones (home, aprender,
cabecera de categoría) y en la tabla del admin; una categoría sin
`icon_image` sigue mostrando el emoji con normalidad; el formulario
de edición carga el valor guardado. Se rompió a propósito la
condición que decide imagen-vs-emoji en `categoryIconHtml()` para
confirmar que el test lo detecta; se restauró y volvió a pasar.

## Bug real: tarjetas de guía de distinto alto en categoria.html
`#guidesList` (la rejilla de guías dentro de una categoría) tenía
`align-items: start` en su versión de escritorio (`display: grid`),
que anula el comportamiento por defecto de CSS Grid (`stretch`) y
hace que cada tarjeta ocupe solo la altura de su propio contenido en
vez de estirarse para igualar la fila — con eso, dos guías con
descripciones de distinta longitud quedaban con bordes a alturas
distintas, en vez de parejas. Se quitó esa línea; `.grid-guides` (la
rejilla que usan home/comunidad/guardados) nunca tuvo este problema
porque nunca tocaba `align-items`.

Verificado con Playwright: dos guías de la misma categoría con
descripciones de longitud muy distinta (g-xss y g-1 en el stub, ~60 y
~20 caracteres) quedan con exactamente la misma altura de tarjeta. Se
repuso a propósito el `align-items: start` para confirmar que el test
detecta la diferencia de alturas; se quitó de nuevo y volvió a pasar.

## Renombrar "Documentación" a "Guía", y priorizarla sobre el Curso
"Documentación" se cambió por "Guía" en los botones de la tarjeta y
el modal de guía, en las pestañas de ambos editores (usuario y
admin), y en los mensajes de aviso relacionados — el nombre no
gustaba y "Guía" es más natural para quien viene a leer. El botón
Guía (antes "🎓 Curso" primero, "📖 Documentación" después) ahora va
primero y lleva el estilo destacado (fondo navy); el Curso pasa a
segundo lugar con el estilo secundario, ya que es opcional y no todas
las guías lo tienen — se intercambiaron los colores de `.btn-guide` y
`.btn-course` en `css/components.css` en vez de solo el orden en el
HTML, para que el peso visual coincida con la importancia real.

Una excepción a propósito: en `guia.html`, cuando una guía tiene
contenido Pro aparecen dos pestañas, y la de pago ya se llama
"🌟 Guía Pro" — si la pestaña gratuita también pasara a llamarse
"Guía" quedarían dos pestañas empezando por la misma palabra, la
misma colisión de nombres que motivó llamarla "Documentación" en su
día. Ahí se dejó como "📖 Básico" en vez de "Guía", para distinguirla
claramente de "Guía Pro".

Verificado con Playwright: ni la tarjeta de guía ni el modal ni los
editores dicen ya "Documentación" en ningún sitio; el botón de Guía
aparece antes que el de Curso y con el fondo navy (destacado); en
`guia.html` con contenido Pro, la pestaña gratuita dice "Básico" y la
de pago sigue diciendo "Guía Pro". Se deshizo a propósito el
reordenado de los botones para confirmar que el test lo detecta; se
restauró y volvió a pasar.

## Icono personalizado en logros (icon_url ya existía, no se usaba)
`achievement_definitions.icon_url` ya existía en el esquema y el
formulario de admin ya lo dejaba rellenar ("Icono (URL, opcional)"),
pero nada en el sitio lo leía todavía — solo se pintaba `a.emoji`
siempre. Se añadió `achievementIconHtml(achievement, size)` en
`js/app.js` (mismo patrón que `categoryIconHtml`) y se enganchó en
los cuatro sitios donde se pintaba el emoji de un logro: el modal de
"¡logro desbloqueado!" (`gamification.js`), la rejilla de trofeos de
`perfil.js` y de `usuario.js`, y el logro destacado del perfil público
(`usuario.js`). Un logro bloqueado sigue mostrando el candado 🔒 pase
lo que pase, tenga o no `icon_url` — el dibujo solo se muestra cuando
ya está desbloqueado.

Verificado con Playwright: un logro desbloqueado con `icon_url`
muestra el dibujo; uno desbloqueado sin `icon_url` sigue mostrando el
emoji; uno bloqueado muestra el candado y nunca el dibujo aunque lo
tenga configurado; el perfil público (`usuario.html`) también lo
muestra. Se rompió a propósito la condición que decide dibujo-vs-
emoji para confirmar que el test lo detecta; se restauró y volvió a
pasar.

## Honeypot anti-bot en el registro
Campo trampa (`#registerWebsite`, en `auth.html`) que una persona
nunca ve — fuera de pantalla (`left: -9999px`) y con el contenedor a
`opacity: 0`, más `tabindex="-1"` y `aria-hidden` — pero que un bot
que rellena todos los campos de un formulario suele acabar rellenando
igualmente. Si llega relleno, `js/auth.js` ni siquiera llama a
`supabase.auth.signUp()`: directamente finge la misma pantalla de
éxito ("Revisa tu email") que ve alguien real tras registrarse, para
no delatarse ni gastar un intento real contra Supabase. Esa pantalla
de éxito se extrajo a una función compartida, `showFakeRegisterSuccess()`,
que ahora usan tanto el caso real (cuando el proyecto tiene activada
la confirmación por email) como el caso honeypot.

Nota de test: Playwright considera "visible" cualquier elemento con
caja no vacía y sin `visibility:hidden`, sin tener en cuenta la
posición fuera de pantalla ni la opacidad heredada del contenedor —
que es justo la técnica usada aquí a propósito, para despistar
también a bots que sí comprueban `display:none`/`visibility:hidden`.
Por eso el test no usa `isVisible()` de Playwright, sino que comprueba
directamente la posición y la opacidad del contenedor.

Verificado con Playwright: el campo existe pero queda fuera de
pantalla y con opacidad 0; rellenarlo hace que nunca se llegue a
llamar a `signUp()` de verdad (el botón nunca pasa por "Creando
cuenta...") y aun así se muestra la pantalla de éxito; un registro
normal, sin tocar el campo trampa, sigue funcionando igual que antes.
Se rompió a propósito la comprobación del honeypot para confirmar que
el test detecta que se cuela un registro real; se restauró y volvió
a pasar.

## Analítica básica autoalojada (sin servicio externo, sin cookies)
No tengo credenciales para dar de alta Plausible/Umami ni ningún
servicio de terceros, así que se implementó un recuento propio y
mínimo. Migración: `supabase-migration-page-views.sql` — tabla
`page_views` (`path`, `user_id` nullable, `created_at`), con el
mismo insert abierto a cualquiera que `client_errors` (solo hay dos
tablas así en todo el proyecto, a propósito: ninguna de las dos
guarda contenido de usuario, solo telemetría).

`js/analytics.js` (`logPageView(session)`) se llama desde
`initNavbar()` en cada carga de página, con el `path` y el `user_id`
si hay sesión (o `null` si no) — sin cookies, sin id de visitante,
sin nada persistido en el navegador; cada carga es una fila suelta.

El admin tiene una sección nueva ("📈 Analítica") con un desplegable
de periodo (7/30/90 días) que agrupa las visitas por página en el
propio JS del admin (no hay `group by` fácil desde el cliente de
Supabase) y muestra el total y el desglose por página.

Nota de test: el stub de pruebas no aplica de verdad los filtros
`.gte()`/`.lte()` por fecha (siempre devuelve todas las filas,
al igual que tampoco simula RLS) — el desplegable de periodo no se
pudo probar de forma realista con Playwright por esa limitación del
stub, no del código real. Sí se pudo comprobar todo lo demás:
registrar una visita real, que las filas con `user_id` nulo son
válidas (el stub tampoco permite simular una visita realmente
anónima, porque `getSession()` siempre devuelve una sesión, admin-1
por defecto), que el admin agrupa correctamente por página y suma
bien el total, y el estado vacío cuando no hay visitas. Se rompió a
propósito el agrupado por página en el admin para confirmar que el
test lo detecta; se restauró y volvió a pasar.

## Borrado de cuenta en autoservicio (solo solicitud, no ejecución directa)
No tengo acceso a la clave de servicio de Supabase desde el cliente
(ni debería exponerse nunca ahí) ni forma de comprobar contra el
esquema real qué pasaría con los `ON DELETE` en cascada de todas las
tablas relacionadas (guías, comentarios, mensajes, seguidores...) si
se borrara un usuario directamente. Por seguridad, en vez de un botón
que borre de verdad, se implementó un flujo de solicitud + revisión
manual, calcado del patrón ya existente de `content_reports`/
`app_feedback`.

Migración: `supabase-migration-account-deletion-requests.sql` — tabla
`account_deletion_requests` (`user_id`, `status` con
`check (status in ('pending', 'done', 'dismissed'))`, `created_at`),
con política de insertar solo la propia (`user_id = auth.uid()`),
política de leer solo la propia, y políticas de admin para leer/
actualizar cualquiera.

En `perfil.html`, dentro de la pestaña "Acerca", hay un botón
"Solicitar borrado de mi cuenta" (en rojo, para diferenciarlo de las
acciones normales). Al pulsarlo, tras un `confirm()`, `js/perfil.js`
inserta una fila con `status: 'pending'` explícito (no basta con
confiar en el valor por defecto de la columna: el stub de pruebas no
lo aplica, y además es más claro dejarlo explícito en el propio
código en vez de depender de un default invisible). Si ya existe una
solicitud pendiente propia, el botón se sustituye por un aviso de
"ya tienes una solicitud pendiente" en vez de dejar pedir otra.

El admin tiene una sección nueva ("🗑️ Bajas") que lista las
solicitudes pendientes con acciones "Marcar hecha" (pide una segunda
confirmación recordando que esto NO borra nada por sí solo, solo
marca que ya se gestionó a mano desde el panel de Supabase) y
"Descartar".

`privacidad.html`, sección "Tus derechos", se actualizó para señalar
este botón en vez del texto anterior que decía "usa el botón de
feedback... de momento a mano".

Nota de test: el stub de pruebas no persiste `account_deletion_requests`
entre cargas de página (se reinicia a la fila de seed en cada
`goto()`), y hacer clic en una pestaña del admin no vuelve a pedir
los datos (solo muestra la sección ya pintada al cargar la página).
Por eso el test del admin no crea una solicitud en vivo y navega,
sino que usa directamente la fila de seed (de Misty/user-2) presente
desde la carga inicial — mismo patrón ya usado para `content_reports`
antes en el proyecto. Se verificó: el botón solicita y crea la fila
con `status: 'pending'`, tras lo cual se oculta y aparece el aviso de
pendiente; cancelar el `confirm()` no crea nada ni oculta el botón;
el admin ve la solicitud de seed y "Marcar hecha" la quita de la
lista de pendientes. Se rompió a propósito la condición que detecta
una solicitud pendiente (`if (data)` → `if (false)`) para confirmar
que el test detecta que el botón nunca se oculta ni aparece el aviso;
se restauró y volvió a pasar.

## Bug real de móvil: el botón de menú de la navbar quedaba fuera de pantalla
Auditoría más profunda con Playwright emulando viewports estrechos
(375px, 390px, 360px) sobre `perfil.html`, `mensajes.html`,
`guia.html`, `editor-guia.html` y `auth.html` con sesión iniciada.
Con sesión, `.nav-right` acumula seis elementos — buscar, tema
claro/oscuro, mensajes, campana de notificaciones, avatar y el propio
botón ☰ de menú — que en total no caben junto al logo en una pantalla
de móvil normal: el contenido de la navbar se salía por la derecha
(`scrollWidth` de hasta 421px sobre un viewport de 375px), y como
nada limita ese desbordamiento, el botón de menú (el único
modo de llegar a Inicio/Aprender/Guardados/Comunidad en móvil, ya que
`.nav-links` está oculto ahí) quedaba literalmente fuera del área
visible en vez de solo apretado.

Arreglo en `css/style.css`, sin tocar ningún HTML: por debajo de
860px se reduce el hueco entre los iconos de `.nav-right` (14px →
6px), y por debajo de 480px se colapsa el logo a solo su icono
cuadrado (`font-size: 0` en `.nav-logo`, que también vacía el texto
plano "Poke" antes del `<span>Doc</span>` sin tener que tocar el
marcado de cada página) — el resultado es la misma navbar, con el
mismo icono reconocible, pero sin el nombre "PokeDoc" en texto en
pantallas muy estrechas.

Verificado con Playwright en los tres anchos de prueba y las cinco
páginas: ninguna combinación produce ya scroll horizontal
(`document.documentElement.scrollWidth` igual al ancho del viewport),
el botón de menú queda dentro del viewport y sigue abriendo
`#navMobileMenu` al pulsarlo, y el logo colapsado sigue siendo un
elemento visible y clicable (solo el icono). Se revirtió el CSS del
arreglo para confirmar que el mismo test detecta la regresión (el
botón de menú vuelve a quedar fuera de pantalla); se restauró y
volvió a pasar.

Nota: no se pudo probar con WebKit (para aproximar Safari de verdad)
porque este sandbox solo tiene Chromium preinstalado y no tiene
acceso de red para descargar el binario de WebKit — la auditoría se
hizo con la emulación de viewport de Chromium, que cubre el problema
real (es un desbordamiento de layout por ancho, no algo específico
del motor de render).

## Bug real (reportado en producción): no se podía guardar ninguna guía nueva
Error real que diste tú: `No se pudo guardar la guía: cannot insert a
non-DEFAULT value into column "has_reference_blocks"`. Ese mensaje es
el que da Postgres cuando una columna es **generada** (`GENERATED
ALWAYS AS (...) STORED`) y alguien intenta enviarle un valor a mano —
lo rechaza aunque el valor "calculado a mano" coincida con lo que la
propia base habría calculado.

En tu base real, `guides.has_reference_blocks` es justo eso: una
columna generada a partir de `reference_blocks`, no una columna
normal que el cliente rellena. Pero tanto `js/editor-guia.js`
(editor de la comunidad) como `admin/js/editor-guia.js` (editor de
admin) seguían calculando `has_reference_blocks: refBlocks.length >
0` en el propio JS y mandándolo en el `insert`/`upsert` — lo cual
bloqueaba **cualquier guardado de guía nueva o editada**, no solo un
caso concreto. Este documento tenía además la descripción antigua
("calculado en /admin al guardar"), que asumía que era una columna
normal — ya está corregida arriba.

Arreglo: se quitó `has_reference_blocks` del payload en los dos
editores. Ahora es Postgres quien la calcula sola en cada
insert/update, que es exactamente para lo que sirve una columna
generada — el frontend no tiene que tocarla ni mantenerla
sincronizada a mano, y sigue leyéndose igual en `js/guide-modal.js`
(para decidir si el botón de Documentación aparece habilitado).

No he podido reproducir el error exacto contra la base real (este
sandbox no tiene acceso de red a Supabase), pero el mensaje de
Postgres es inequívoco sobre la causa, y el fix es quitar el campo
del payload — no hay otra forma de que ese error concreto
desaparezca. Verifica guardando una guía nueva desde tu perfil o
desde `/admin` para confirmar que ya funciona.

## Guías de la comunidad: fila compacta en vez de tarjeta grande, y botón de crear
Pediste dos cosas tras ver la primera guía de comunidad guardada: que
la lista de "Guías de la comunidad" (pestaña de `usuarios.html`) no
use la misma tarjeta grande y vertical que una guía oficial —porque
aquí puede haber cientos de guías de calidad muy variable, y en
tarjeta grande no caben muchas de un vistazo—, y un botón para crear
una guía nueva directamente desde Comunidad, en vez de tener que ir a
Perfil → Guías.

**Fila compacta**: `renderCommunityGuideRowHtml()` (nuevo, en
`js/usuarios.js`) sustituye a `renderGuideCardHtml()` de
`guide-modal.js` **solo en esta pestaña** — a propósito no se tocó
`renderGuideCardHtml`, que se sigue usando tal cual en
`categoria.html`/la home/`guardados.html` para las guías oficiales.
La fila nueva es una línea horizontal fina: icono pequeño, título en
negrita con el sello (✓ Aprobada / Pendiente) pegado al lado, una
línea con el autor y la descripción truncada con `...` si no cabe, y
a la derecha la valoración media y los minutos estimados (esto último
se oculta en móvil por debajo de 640px para no romper la fila).
Sigue reutilizando `decorateGuideCards()` para rellenar la valoración
media (mismo dato, `data-card-rating`), pero sin el botón de guardar
en estrella — en una lista de exploración así no aporta tanto como en
las tarjetas grandes, y quitarlo deja la fila más fina.

CSS nuevo en `css/components.css`: `.community-guide-list` (columna
con poco espacio entre filas) y `.community-guide-row` y derivados —
ninguno reutiliza clases de `.guide-card`, para no arriesgarse a que
un cambio futuro en la tarjeta oficial afecte sin querer a esta lista
(y viceversa).

**Botón "+ Crear guía"**: en la pestaña de guías de Comunidad, junto
al buscador, un enlace directo a `/editor-guia.html` (el mismo editor
que ya usa "Mis guías" en el perfil). No hace falta comprobar sesión
aquí — `requireAuth()` dentro del propio editor ya redirige a
`auth.html` si no has iniciado sesión, igual que en cualquier otro
punto de entrada al editor.

Verificado con Playwright: se pintan varias filas compactas y hacer
clic en una abre el modal de guía de siempre (mismo `data-guide-id` +
`openGuideModal`); el botón "+ Crear guía" apunta a
`/editor-guia.html` y pulsarlo navega ahí de verdad; en móvil se
oculta el bloque de valoración/minutos y la página no tiene scroll
horizontal. Se rompieron a propósito el CSS que oculta ese bloque en
móvil y el `href` del botón para confirmar que el test detecta ambas
regresiones; se restauraron y volvió a pasar todo.

## Política de contraseñas actualizada (mín. 8, mayúscula+minúscula+número+símbolo)
Activaste en Supabase (Authentication → Providers → Email → Password
requirements) la opción "Lowercase, uppercase letters, digits and
symbols" y subiste el mínimo a 8 caracteres. El frontend seguía
validando en el cliente "al menos 6 caracteres" (registro y
recuperar contraseña), así que alguien podía rellenar una contraseña
que pasaba esa comprobación local pero que Supabase rechazaba igual
al llegar — y el mensaje que se veía entonces era el texto en inglés
de la API, o un genérico poco útil ("No se pudo guardar la
contraseña. Pide un enlace nuevo...") en el caso de recuperar
contraseña, que además da un consejo equivocado para este caso (el
enlace era válido, el problema era la contraseña).

Se añadió `passwordStrengthError(password)` (nuevo, en `js/app.js`),
compartido entre el registro (`js/auth.js`) y recuperar contraseña
(`js/reset-password.js`), que comprueba en el cliente exactamente lo
mismo que exige ahora Supabase — 8+ caracteres, con mayúscula,
minúscula, número y símbolo — antes de llamar a la API, mostrando
directamente el mensaje claro en español en vez de esperar el
rechazo del servidor. Como red de seguridad por si la política de
Supabase cambia otra vez sin actualizar este chequeo, `friendlyAuthError()`
(registro) y el manejo de error de `reset-password.js` también
reconocen la respuesta real de Supabase para contraseña débil/corta y
la traducen al mismo mensaje, en vez de mostrar el texto en inglés.
Los placeholders de `auth.html` y `reset-password.html` se
actualizaron para reflejar el requisito real.

Nota de test: el stub de pruebas no simula el rechazo de Supabase por
contraseña débil (`signUp()`/`updateUser()` siempre tienen éxito ahí
pase lo que pase), así que lo que se pudo verificar con Playwright es
la validación del lado del cliente — que es la que evita la llamada
en la inmensa mayoría de los casos: una contraseña débil no llega a
llamar a `signUp()`/`updateUser()` y muestra el mensaje nuevo, y una
contraseña que cumple los cuatro requisitos pasa sin error y el
registro continúa con normalidad. Se rompió a propósito el chequeo de
longitud (comprobando `< 100` en vez de `< 8`) para confirmar que el
test detecta que una contraseña válida quedaría rechazada; se
restauró y volvió a pasar.

## Icono de guardar (marcador) y de reportar (bandera) en vez de emoji/estrella
Detectaste dos iconos que no encajaban: el botón de "guardar" guía usaba
una estrella (☆/★) tanto en la tarjeta pequeña como en el modal
ampliado, que se confundía con la valoración de la guía (que también
usa estrellas, justo al lado); y el botón de reportar seguía usando el
emoji 🚩 en vez de un icono SVG, rompiendo la convención ya establecida
en el resto del sitio (navbar, menú de cuenta, tema, etc., todos con
`js/icons.js`).

Se añadieron dos iconos nuevos a `js/icons.js`: `bookmark(size, filled)`
(un marcador de página — el mismo icono en dos estados, relleno cuando
está guardado y solo el contorno cuando no, para no necesitar dos SVGs
distintos) y `flag(size)`. Se sustituyó:
- `.card-save-btn` (tarjeta pequeña de guía, usada en `guide-modal.js`
  y en la sección "Añadidas recientemente" de `js/home.js`) — ahora
  pinta `icons.bookmark()` en vez de ☆/★, y `decorateGuideCards()`
  alterna entre relleno/contorno igual que antes alternaba de estrella
  vacía a llena.
- El botón "Guardar"/"Guardado" del modal ampliado de guía
  (`guideModalSaveBtn`, en `js/guide-modal.js`) — mismo icono, ahora
  junto al texto en vez de sustituirlo por un asterisco de estrella.
- `reportButtonHtml()` (en `js/report.js`, compartido por
  `guide-modal.js`, `guide-forum.js`, `wall.js`, `usuario.js` y
  `mensajes.js`) — ahora pinta `icons.flag()` en vez del emoji 🚩.

Las estrellas de **valoración** (`starsHtml()`, el widget de puntuar
de 1 a 5, `card-rating`) se dejaron tal cual — ahí sí tiene sentido
usar estrellas, es justo lo que representan; el problema era solo que
el botón de guardar usaba el mismo símbolo al lado y parecía parte de
la valoración.

Verificado con Playwright: el botón de guardar de la tarjeta ya no
contiene ☆/★ sino un `<svg>`, y al guardar cambia a la versión
rellena (`fill="currentColor"`); el botón "Guardar" del modal grande
usa el mismo icono junto al texto; el botón de reportar ya no
contiene el emoji 🚩 sino un `<svg>`. Se rompieron a propósito ambos
cambios (report.js volviendo al emoji, y el botón del modal volviendo
a ☆/★) para confirmar que el test detecta las dos regresiones; se
restauraron y volvió a pasar todo.

## Barrido completo de emojis del sitio → iconos SVG, y botones Guardar/Guía/Curso del mismo tamaño
Señalaste dos cosas concretas sobre la ficha ampliada de guía —
"📖 Guía"/"🎓 Curso" seguían siendo emoji, y el botón "Guardar" se
veía más grande que "Guía"/"Curso" en la misma fila— y pediste
además un repaso de **todos** los emojis del sitio para sustituirlos
por iconos SVG, como ya se hizo en su día con la navbar.

**Qué se tocó y qué no.** Se repasaron los ~180 emoji que había
repartidos en 32 archivos (`.html`/`.js`) y se separaron en dos
grupos:
- **Decoración fija de interfaz** (botones, pestañas, cabeceras de
  sección, el menú del admin, insignias de estado como "Baneado"/
  "Publicada", el selector de tipo de bloque del editor de curso...):
  se sustituyó por iconos SVG nuevos en `js/icons.js` (bookOpen,
  graduationCap, clock, folder, layers, compass, trophy, users, bug,
  barChart, trash, image, refreshCw, flame, lock, sparkles, eye,
  upload, settings, link, listOrdered, checkSquare, helpCircle,
  checkCircle, xCircle, package, send, volumeX, ban, crown, sprout,
  trendingUp, shield, zap, lightbulb, triangleAlert, pin — sumados a
  los que ya existían de la navbar).
- **Emoji que es contenido, no icono**: el selector de emoji para
  portada de guía/categoría/logro (`js/emoji-picker.js`, con su
  paleta completa) y cualquier sitio donde se lee `guide.cover_emoji`,
  `category.emoji`, `achievement.emoji` o `block.emoji` — eso es una
  función deliberada (el admin o el autor elige su propio emoji, con
  la opción de subir un icono en su lugar, ver la sección de logros
  más arriba) y tocarlo habría roto esa función. Tampoco se tocaron
  las estrellas de valoración (`★`, que sí representan una puntuación
  de verdad) ni las flechas tipográficas (`→`/`←`/`↩`, que no son
  emoji ni se pintan en color).

**`contributorTier()`** (en `gamification.js`) devolvía un emoji
(👑/⭐/🌱/👤) en un campo llamado `emoji` — se cambió a `icon` con el
SVG ya renderizado (`icons.crown(16)`, etc.), y se actualizaron sus
4 usos (`perfil.js`, `usuario.js`, `usuarios.js`, `app.js`). Las
medallas 🥇🥈🥉 del ranking de la comunidad (`usuarios.js`) pasaron a
un icono de trofeo junto al número de puesto (`🏆 #1`), en vez de
buscar un emoji de medalla concreto para cada color.

**Botones "Guardar"/"Guía"/"Curso" del mismo tamaño.** En el modal
ampliado de guía, "Guardar" usa `.btn-outline` (más grande, con
borde) mientras que "Guía"/"Curso" usan `.btn-guide`/`.btn-course`
(pensados para la tarjeta pequeña, más compactos). Se añadió una
regla específica `.modal-actions .btn-guide, .modal-actions .btn-course`
que iguala el padding, el radio, el tamaño de letra y — el detalle
que costó encontrar— el `line-height` y un `border: 1px solid
transparent` a juego, porque `.btn-outline` sí tiene borde de 1px y
sin ese borde invisible los tres botones diferían en 2px de alto
aunque el resto de medidas coincidiera. Fuera del modal (tarjeta
pequeña de `categoria.html`/home/Comunidad) `.btn-guide`/`.btn-course`
se quedan con su tamaño compacto de siempre, que es lo que corresponde
a ese espacio más reducido.

Verificado con Playwright: ninguna tarjeta ni el modal contienen ya
emoji de interfaz (comprobado con una expresión regular sobre el
texto visible); los tres botones del modal miden exactamente lo
mismo de alto (44px). Se rompió a propósito el `border` invisible
añadido para confirmar que el test detecta que vuelven a medir
distinto (44 vs 42); se restauró y volvió a pasar.

Nota: no pude probar en vivo `admin/index.html` ni los dos editores
de guía (`editor-guia.html`, `admin/editor-guia.html`) porque en este
sandbox, justo durante esta tarea, dejó de haber salida de red hacia
`cdn.jsdelivr.net` (de donde `richtext-editor.js` importa DOMPurify)
— confirmado con un `curl` directo, que da timeout. Como es un
`import` estático que falla, bloquea la carga de todo el módulo
(incluida la comprobación de acceso del admin), así que esas páginas
se quedaban colgadas en "Comprobando acceso…" incluso sin tocar nada
mío. Esto es una limitación puntual de este sandbox, no de tu sitio
real (tus usuarios sí tienen acceso a internet) — lo comprobé
inspeccionando el HTML inyectado directamente (sin depender de que el
JS termine de cargar): el sidebar del admin tiene sus 14 iconos SVG
nuevos y ningún emoji en el texto visible.

## Botón "Editar perfil" más visible

Estaba escondido dentro de la pestaña "Acerca" del perfil, así que
había que hacer dos clics para encontrarlo. Se movió a la cabecera
del perfil (`.profile-hero-body`), como tercer elemento junto al
avatar y el nombre/nivel, visible siempre sin cambiar de pestaña. El
JS (`perfil.js`) no necesitó cambios porque localiza el botón por
`id`, no por su posición en el DOM.

## Bug real: "Editar perfil" no guardaba los cambios

El modal de edición de perfil llamaba a `supabase.from('user_profiles')
.update(...)` pero nunca comprobaba si Supabase devolvía un error: si
el `update` fallaba, el código seguía igual cerrando el modal y
actualizando el estado local como si hubiera ido bien, así que la
página parecía guardar el cambio pero al recargar volvía a los datos
de antes. Se corrigió comprobando el `error` de la respuesta: si hay
error, se muestra un toast ("No se pudo guardar el perfil: ...") y el
modal se queda abierto; solo se cierra y se actualiza el estado local
si el guardado fue de verdad correcto.

Este bug probablemente se manifestó en producción por la migración
`supabase-migration-notification-prefs.sql` (columna
`notification_prefs_disabled`): si no se ha ejecutado, cualquier
guardado que toque preferencias de notificación falla en la base
real con un error de columna inexistente, y antes de este arreglo esa
falla pasaba desapercibida.

Verificado con Playwright: el botón es visible sin cambiar de
pestaña y abre el modal; un guardado correcto sí persiste el cambio
en la base y cierra el modal; un guardado que falla (simulado en el
stub de pruebas) muestra el toast de error y mantiene el modal
abierto. Se rompió a propósito quitando la comprobación del error
para confirmar que los dos últimos tests fallan, se restauró y
volvieron a pasar los 6.

## Imagen de portada en el editor de guías de la comunidad

El editor de guías de la comunidad (`editor-guia.html`) solo dejaba
poner un emoji como portada; el editor del admin ya tenía subida de
imagen desde antes. Se igualó: nuevo campo "Imagen de portada
(opcional)" con vista previa, botón "Subir imagen" (usa
`uploadGuideImage()` de `app.js`, que valida el archivo y lo sube al
bucket `guide-images`) y botón "Quitar". El campo `cover_image` se
guarda en el payload final, se incluye en el autoguardado de
borrador y se recupera al editar una guía existente o al restaurar
un borrador.

Verificado con Playwright: el botón de subir imagen existe, subir un
archivo muestra la vista previa y el botón "Quitar", "Quitar" oculta
la vista previa otra vez, y la guía guardada de verdad lleva
`cover_image` relleno en el payload que se envía a Supabase (se
interceptó el `upsert` para comprobar el payload real, porque la
navegación a `perfil.html` tras guardar reinicia el stub de pruebas
en memoria). Se rompió a propósito el envío de `cover_image` en el
payload para confirmar que el test lo detecta, se restauró y volvió
a pasar.

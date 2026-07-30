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
calculado en `/admin` al guardar) · `route_ids` (uuid[], copia
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

## `guide_comments` (comentarios sobre la guía, estilo muro)
`id` · `guide_id` (FK → guides) · `author_id` (FK → auth.users) · `body` ·
`created_at`. Lectura pública; solo el propio autor (o un admin) puede
borrar su comentario. Migración: `supabase-migration-guide-comments.sql`.

Es la conversación libre bajo una guía (como el muro de un perfil, pero
para la guía) — **separada** de `guide_reviews`, que es solo la
puntuación de 1 a 5 estrellas. `js/wall.js` (antes solo para
`profile_comments`) se generalizó para poder pintar cualquiera de los
dos muros pasándole `table`/`idField`.

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

Cualquier otro `type` simplemente nunca se desbloquea (no rompe nada, pero
tampoco hace nada).

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

RLS: la lectura pública de `guides` pasó de "todas las filas" a solo
`published_at IS NOT NULL` (o el propio autor viendo lo suyo, o admin
viendo todo). El autor puede insertar/editar/borrar sus propias filas solo
mientras están en `draft` o `rejected`.

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

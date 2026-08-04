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
aparte) · `unlocked_references` (uuid[]) · `avatar_color` (**en desuso**:
la web ya no la lee. Nadie la escribía nunca, así que solo contenía su
valor por defecto y hacía que todo el mundo saliera del mismo azul; el
color de quien no tiene foto se deduce ahora del `id`, con
`avatarColorForKey` en `js/app.js`) · `is_admin` · `quiz_correct_count` ·
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
usuario al bucket de Storage `avatars`. `banner_url`, si está relleno,
manda sobre `banner_color`; `avatar_url`, si está relleno, manda sobre el
color deducido).

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

## Bug real: falta de espacio en los bordes en móvil

`.hero` y `.section` fijaban `padding: 52px 0 44px` / `padding: 44px
0` con la propiedad abreviada `padding`, que fija los cuatro lados a
la vez. Como esos elementos siempre se combinan con `.container`
(que pone `padding: 0 24px` a los lados), y las dos reglas tienen la
misma especificidad, ganaba la que aparece después en la hoja de
estilos — así que el `0` de los lados de `.hero`/`.section` anulaba
por completo el margen lateral de `.container` en todas las páginas.
El resultado: en el hero, "Explora por tema", "Añadidas
recientemente" y cualquier sección con esas dos clases, el contenido
tocaba literalmente el borde de la pantalla (0px de margen, no solo
"poco margen"). Se corrigió cambiando ambas reglas a
`padding-top`/`padding-bottom` sueltos, que no tocan los lados y
dejan que `.container` mande en el padding horizontal.

Verificado con Playwright en un viewport de móvil (390px): antes del
arreglo la cuadrícula de categorías empezaba exactamente en x=0
(pegada al borde); después empieza en x=24 (con el margen del
`.container`). Se rompió a propósito volviendo a la abreviatura
`padding: 52px 0 44px` para confirmar que el test lo detecta, se
restauró y volvió a pasar.

## Nombre visible editable (no solo nombre de usuario)

El perfil muestra `display_name` si existe (si no, cae a
`username`), pero el modal de "Editar perfil" solo dejaba cambiar el
`username` (el que forma parte del enlace público). Por eso cambiar
el nombre de usuario no cambiaba el nombre que se ve en la cabecera
del perfil — son dos campos distintos. Se añadió un campo "Nombre
visible" al modal que edita `display_name` directamente.

Verificado con Playwright: el campo aparece en el modal, y tras
guardar, tanto la cabecera del perfil como la fila guardada en
Supabase reflejan el nuevo nombre visible.

## Bug real: la guía no se podía leer sin completar el curso

`guia.html` ocultaba el artículo de referencia (documentación) de
cualquier guía a menos que `reference_unlocked_by_default` fuera
`true` en la base o el usuario ya hubiera completado el curso (lo
que añadía el id de la guía a `user_profiles.unlocked_references`).
El editor de guías de la comunidad nunca exponía ese campo (solo
existía como casilla oculta en el editor del admin), así que
absolutamente ninguna guía de la comunidad podía desbloquearse nunca
— y en general, guía (documentación) y curso son cosas distintas: no
tiene sentido bloquear la lectura de un artículo por no haber hecho
un curso interactivo aparte, que además puede ni existir. Se quitó
la restricción por completo: la documentación de una guía se
muestra siempre que tenga contenido, sin depender del curso. También
se quitó la casilla ahora inútil del editor del admin
("Guía desbloqueada por defecto...") y el código muerto asociado
(`unlockReference()`, `unlocked_references`) en `gamification.js`.

Verificado con Playwright: una guía con documentación pero sin
`reference_unlocked_by_default` (el caso de cualquier guía nueva)
muestra su contenido real en vez del aviso de "completa el curso".
Se rompió a propósito reintroduciendo la comprobación de
`isUnlocked` para confirmar que el test la detecta, se restauró y
volvió a pasar.

## Bug real: crear/editar categorías (y colecciones, rutas, logros) en `/admin` no avisaba si fallaba

Los formularios de "Categorías", "Colecciones", "Rutas" y "Logros" en
`/admin` guardaban con `supabase.from(tabla).upsert(payload)` sin
comprobar el `error` de la respuesta — el mismo patrón de bug ya
corregido antes en "Editar perfil" (`js/perfil.js`). Si el `upsert`
fallaba (RLS, restricción única en `slug`, columna obligatoria
vacía...), el código seguía igual cerrando el modal y recargando la
tabla como si hubiera ido bien, así que la nueva fila simplemente no
aparecía sin ningún aviso — justo el síntoma reportado ("le doy a
guardar y no hace nada"). Se corrigió en los cuatro formularios: si
`upsert` devuelve error, se muestra un toast con el mensaje real de
Supabase y el modal se queda abierto para poder corregir y
reintentar.

Verificado con Playwright: crear una categoría nueva se refleja en
la tabla y cierra el modal; un guardado que falla (simulado en el
stub de pruebas con un error de RLS) muestra el toast de error y
mantiene el modal abierto en vez de fingir éxito. Se rompió a
propósito quitando la comprobación del error para confirmar que los
dos últimos tests fallan, se restauró y volvieron a pasar los 4.

Nota para ti: ahora que esto está arreglado, si sigues sin poder
crear "Mazos & estrategia" el toast te dirá el motivo exacto (por
ejemplo, si el slug ya existe o si hay algún problema de permisos) —
avísame con el mensaje exacto que te salga y lo diagnosticamos.

## Migración pendiente: no se puede borrar un usuario desde Authentication

Migración: `supabase-migration-fix-user-delete-fks.sql`. Varias
tablas tienen una columna que apunta a `auth.users(id)` sin `ON
DELETE CASCADE` ni `SET NULL`: `user_profiles.id`,
`account_deletion_requests.user_id`, `app_feedback.user_id`,
`content_reports.reporter_id`, `client_errors.user_id`,
`page_views.user_id` y `guides.author_id`. En cuanto ese usuario
tiene una sola fila en cualquiera de esas tablas, Postgres bloquea el
`DELETE` de `auth.users` con una violación de clave foránea —
Supabase Studio no explica el motivo, solo muestra un `[]` vacío
("Failed to delete user").

La migración reconstruye esas restricciones con la regla correcta
para cada caso: `user_profiles`, `account_deletion_requests`,
`app_feedback` y `content_reports` se borran en cascada junto con el
usuario (no tienen sentido sin él); `client_errors.user_id`,
`page_views.user_id` y `guides.author_id` se ponen a `NULL` en vez de
borrarse (el registro de error o la vista de página sigue siendo útil
para analítica, y una guía no debería desaparecer porque su autor
borre la cuenta — con `author_id` a `null` ya se muestra como "Guía
oficial de PokeDoc", el mismo fallback que usa el código para guías
sin autor de la comunidad). Como `user_profiles` no se creó con
ningún script de este repo, la migración busca el nombre real de su
restricción en vez de asumirlo, por si se llama distinto a lo
habitual.

Al ejecutarla la primera vez saltó `ERROR: 42P01: relation
"content_reports" does not exist"` — esa migración en concreto no se
había llegado a ejecutar todavía. Se reescribió el script para que
compruebe con `to_regclass()` si cada tabla (y columna) existe antes
de tocarla, así que ahora se salta silenciosamente (con un `NOTICE`,
no un error) cualquier tabla que todavía no tengas creada, en vez de
abortar todo el script a la primera que falte. Probado de extremo a
extremo en una base Postgres local: creando un usuario con filas en
las siete tablas y borrándolo, las de cascada se vacían y las de
`SET NULL` conservan la fila con la referencia a `null`; también se
comprobó que el script se puede volver a ejecutar sin problema
(vuelve a dejar las restricciones igual) y que si `content_reports`
sí existe, la reconstruye con cascada con normalidad.

## Bug real: badge "EN PROGRESO" en una guía que ya no tiene curso

`renderGuideCardHtml()` (usada en categoría, home, guardados y
Comunidad) pintaba el badge "EN PROGRESO"/"COMPLETADO" mirando solo
`user_progress.status`, sin comprobar si la guía sigue teniendo
curso. Si una guía tenía curso, alguien lo empezaba (o lo
completaba) y luego se le quitaban los bloques de curso (por ejemplo,
al pasarla a ser solo documentación), la fila de `user_progress` de
esa persona seguía existiendo y el badge se quedaba mostrando "EN
PROGRESO" para siempre, aunque ya no hubiera ningún curso que hacer.
La función ya calculaba `hasCourse` (para decidir si el botón
"Curso" está activo o deshabilitado); solo faltaba usar esa misma
variable para condicionar también el badge.

Verificado con Playwright: una guía sin bloques de curso pero con una
fila de `user_progress` antigua en estado `started` no muestra "EN
PROGRESO". Se rompió a propósito quitando la condición `hasCourse &&`
para confirmar que el test lo detecta, se restauró y volvió a pasar.

## Bug real: guías creadas en /admin se atribuían a "PokeDoc oficial" en vez de a quien las creó

El editor de guías del admin nunca rellenaba `author_id` al crear una
guía nueva, así que siempre quedaba `null` — y `guia.html` muestra
"Guía oficial de PokeDoc" cuando no hay autor. Pero quien crea la
guía desde `/admin` sigue siendo una persona con su propia cuenta
(admin), así que debería aparecer como autor igual que pasa con las
guías enviadas desde la comunidad. Se corrigió para que `author_id`
se rellene con el id de la sesión de admin actual al crear una guía
nueva; al editar una ya existente se respeta el `author_id` que ya
tuviera (para no reasignar guías antiguas sin que se pida).

Verificado con Playwright: una guía nueva creada desde `/admin`
guarda `author_id` igual al id de la sesión de admin logueada. Se
rompió a propósito quitando ese campo del payload para confirmar que
el test lo detecta, se restauró y volvió a pasar.

## Comunidad: solo pendientes de revisión, no todo lo aprobado desde siempre

`loadCommunityGuides()` (en `usuarios.js`) mostraba tanto guías
`pending` como `approved`, ordenadas por fecha de envío descendente.
Eso significaba que una vez aprobada, una guía se quedaba en la
pestaña "Comunidad" para siempre — duplicando información, porque
una guía aprobada ya vive en su categoría normal (Aprender/categoría)
con su autor atribuido igual que cualquier guía oficial. Además,
al confirmarlo se vio que las guías creadas directamente desde
`/admin` (no enviadas a revisión) nunca llevan `review_status`
relleno, así que nunca aparecían ahí — no por ser del admin, sino
porque nunca pasaron por el flujo de envío/aprobación.

Se cambió a mostrar solo `review_status = 'pending'`, ordenadas por
fecha de envío **ascendente** (las más antiguas primero, para que
ninguna quede esperando revisión enterrada bajo envíos más nuevos).
Se quitó también el badge "✓ Aprobada" de la fila compacta, porque
ahora todo lo que aparece ahí es por definición pendiente.

Verificado con Playwright: una guía aprobada con autor de la
comunidad ya no aparece en Comunidad; una rechazada tampoco; una
creada desde `/admin` sin autor tampoco; las pendientes sí aparecen
con el badge "Pendiente", y la más antigua sale antes que la más
reciente. Se rompió a propósito volviendo al filtro y orden
anteriores para confirmar que el test detecta que la guía aprobada
reaparece, se restauró y volvió a pasar. (El test de paginación de
Comunidad, que usa 12 guías de relleno para probar la página 2 y la
búsqueda, se actualizó para que esas guías de relleno sean `pending`
en vez de `approved` — ya que su propósito es rellenar la lista que
ahora es solo de pendientes, no representar guías aprobadas reales.)

## Bug real: "Editar perfil" ilegible en modo oscuro, y mal repartido en móvil

Dos problemas en la cabecera de `perfil.html`:

1. **Contraste en oscuro.** `.profile-hero-edit-btn` (usado tanto por
   "Banner" como por "Editar perfil") tiene un fondo fijo
   (`rgba(13, 27, 42, 0.55)`, pensado para verse bien encima de
   cualquier foto de banner, en cualquier tema) pero el texto usaba
   `color: var(--white)` — y `--white` es un token semántico de
   "superficie/tarjeta" que en modo oscuro pasa a ser `#182430` (casi
   negro), no blanco de verdad. Resultado: texto casi invisible sobre
   un fondo también oscuro. Se cambió a `color: #fff` fijo, ya que el
   fondo del botón tampoco cambia con el tema.

2. **Reparto en móvil.** El botón "Editar perfil" se añadió como un
   tercer elemento en la fila flex junto al avatar (96px) y la
   columna de nombre/bio (`flex: 1`). En escritorio hay sitio de
   sobra, pero en un móvil normal (files disponibles ~290px sin
   padding) el avatar más el propio botón (que no se encoge, mide
   ~110px de ancho por el icono+texto) dejaban a la columna de
   nombre/bio con solo ~54px — forzando que "Coleccionista", la barra
   de XP y la bio se partieran en varias líneas apretadas mientras
   sobraba hueco vacío a la derecha del botón. Se añadió un punto de
   corte (`@media max-width: 640px`) que hace que la fila haga wrap y
   fuerza al botón a caer en su propia línea completa (con un
   separador invisible de `flex-basis: 100%` delante suyo, la técnica
   habitual para partir una fila flex sin que el elemento siguiente
   se estire), alineado a la derecha y con su tamaño natural — dejando
   toda la fila de arriba (avatar + nombre + bio) con el ancho que
   necesita.

Verificado con Playwright en tres escenarios: móvil + oscuro (el
texto de "Editar perfil" y "Banner" es blanco de verdad), móvil +
claro (la columna de nombre/bio mide más de 120px y el botón cae
debajo del avatar, sin estirarse a todo el ancho), y escritorio (el
botón se queda junto al nombre, sin romper el diseño ancho que ya
funcionaba). Se rompió a propósito cada arreglo por separado
(volviendo a `var(--white)`, y quitando el separador que fuerza el
salto de línea) para confirmar que el test detecta cada regresión,
se restauraron y volvió a pasar todo.

## Bug real: texto negro en modo oscuro en el buscador

`.search-input` (usado en `/buscar`, en el desplegable de búsqueda de
la navbar, y en los dos buscadores de la pestaña Comunidad) ponía
`background: var(--white)` — que en modo oscuro es un fondo casi
negro — pero nunca fijaba `color`, así que el texto escrito se
quedaba con el negro por defecto del navegador: negro sobre casi
negro, ilegible. Es el mismo patrón de bug que ya apareció antes con
`--white` mal usado como "blanco literal" en vez de como el token de
superficie que realmente es.

Antes de aplicar el arreglo se hizo una auditoría automática con
Playwright de todos los `<input>`/`<textarea>`/`<select>` visibles en
10 páginas del sitio en modo oscuro, comparando el contraste real
entre `color` y `background-color` calculados por el navegador (no
solo mirando el CSS a ojo). `.search-input` fue el único caso con
contraste roto en todo el sitio — se confirmó también revisando el
CSS entero en busca de cualquier otra regla de campo de formulario
que fije un fondo reactivo al tema (`var(--white)`/`var(--ice)`/
`var(--bg)`) sin fijar también el color del texto; no había ninguna
más. Se corrigió añadiendo `color: var(--text)`.

Verificado con Playwright: el texto escrito en el buscador usa el
color de texto correcto sobre el fondo oscuro. Se rompió a propósito
quitando el `color` para confirmar que el test detecta que vuelve a
ser negro, se restauró y volvió a pasar.

## Bug real: tarjetas de "Mis guías" de alturas distintas

En la pestaña "Guías" del perfil propio, cada guía se pintaba en una
fila `flex-wrap: wrap` sin límite de ancho para el título. Un título
largo (p. ej. "Cómo detectar una caja de Pokémon falsa (guía
visual)") se partía en dos líneas y encima empujaba el badge de
estado a una tercera línea, haciendo esa fila mucho más alta que las
de títulos cortos — rompiendo la sensación de lista uniforme.

Se corrigió en dos partes:
- El título ahora se recorta a una sola línea con "…" en vez de
  partirse (`text-overflow: ellipsis`), y el `<span>` lleva un
  atributo `title` con el texto completo para poder leerlo entero al
  pasar el cursor. La fila pasa a `flex-wrap: nowrap` y el badge/los
  botones se marcan `flex-shrink: 0` para que solo el título ceda
  espacio, nunca ellos.
- Un segundo desajuste de 6px: las guías aprobadas o pendientes no
  muestran los botones "Editar"/"Eliminar" (solo aplican a borrador y
  rechazada), así que ese hueco quedaba sin altura y esas filas
  salían más bajas que las que sí tienen botones. Se le puso una
  `min-height` a `.my-guide-actions` para reservar el espacio siempre,
  tengan botones o no.
- Se dejó aparte, a propósito, el caso de una guía rechazada: esa
  fila sí puede ser más alta que el resto, porque muestra el motivo
  real del rechazo (información necesaria, no solo un título largo).

Verificado con Playwright en móvil y escritorio: una guía con título
larguísimo y otra con título corto miden ahora exactamente lo mismo
de alto (antes: 80px vs 48px; ahora: 54px vs 54px), el título largo
se ve recortado con "…" y el tooltip conserva el texto completo. Se
rompió a propósito cada uno de los tres cambios por separado (volver
a `flex-wrap: wrap`, quitar el `min-height` de las acciones) para
confirmar que el test detecta cada regresión, se restauraron y
volvió a pasar todo.

## Perfil propio: quitar "Logros" de las estadísticas y ponerlas en una sola fila

Las 6 tarjetas de estadísticas del perfil (`#profileStats`) incluían
"Logros" (número de logros desbloqueados) — redundante, porque el
número de trofeos ya se muestra justo arriba, en la cabecera
("10 Trofeos"), y con el mismo nombre ("trofeos") que el que usa esa
sección para referirse a los logros. Se quitó esa tarjeta. Con 5
tarjetas en vez de 6, `.stats-row` (que reparte con
`grid-template-columns: repeat(auto-fit, minmax(110px, 1fr))`) seguía
partiéndolas en dos filas en pantallas estrechas. Se añadió una
variante `.stats-row-single` (solo en `perfil.html`, no toca
`usuario.html`, que comparte la misma clase base `.stats-row` pero
con solo 3 tarjetas distintas) que fuerza `repeat(5, 1fr)` — siempre
una sola fila, con las tarjetas encogiéndose si hace falta en vez de
saltar de línea.

Verificado con Playwright: quedan exactamente 5 tarjetas, "Logros" ya
no aparece, y las 5 están en la misma fila (mismo `top`). Se rompió a
propósito quitando la regla `.stats-row-single` para confirmar que
vuelven a partirse en varias filas, se restauró y volvió a pasar.

## Bug real: los datos del desplegable de cuenta se solapaban en la navbar

`.nav-user-stats` (XP, Nivel, y si aplican Racha y Colaborador, hasta
4 datos) era una fila `flex` sin `gap` dentro de un desplegable de
solo 260px — con 4 columnas repartiéndose ese ancho sin espacio
entre ellas, cada una tenía sitio real para menos de 21px de texto.
Un nombre de nivel largo como "Coleccionista" desbordaba visualmente
sobre la columna vecina.

Se cambió a una cuadrícula de 2 columnas (`display: grid;
grid-template-columns: repeat(2, 1fr); gap: 10px 8px`), así que con 2
datos queda en una fila de 2, y con 3 o 4 pasa a dos filas de 2 —
cada dato con el doble de ancho real que antes. Como red de
seguridad adicional se le puso `text-overflow: ellipsis` al valor,
por si algún nombre de nivel es incluso más largo que el espacio de
una columna del desplegable.

Verificado con Playwright: con los 4 datos presentes (XP, Nivel,
Racha, Colaborador, el caso exacto de la captura reportada), ninguno
mide menos de 90px de ancho (antes: ~21px) y ninguno se solapa con
otro. Se rompió a propósito volviendo al `flex` sin `gap` para
confirmar que el test detecta que el ancho vuelve a ser insuficiente,
se restauró y volvió a pasar.

## Bug real: "Racha" en la misma línea que el número, a diferencia del resto

En el mismo desplegable de cuenta, XP/Nivel/Colaborador pintan el
valor con `display: flex` (o el `display: block` por defecto de
`.nav-user-stats strong`), así que la etiqueta ("XP", "Nivel"...)
cae siempre debajo en su propia línea. El de Racha era el único que
usaba `display: inline-flex` para alinear el icono de fuego junto al
número — pero al ser un nivel "inline", el `<span>Racha</span>` que
va justo después no bajaba de línea y se quedaba pegado al lado
("🔥2 RACHA" en vez de "🔥2" arriba y "RACHA" debajo). Se cambió a
`display: flex` (como ya hacía el de Colaborador), que sí rompe línea
al ser un nivel de caja "block" por fuera aunque siga siendo flex por
dentro.

Verificado con Playwright: el `<span>Racha</span>` queda por debajo
del número/icono (no en la misma línea). Se rompió a propósito
volviendo a `inline-flex` para confirmar que el test detecta que
vuelven a quedar en la misma línea, se restauró y volvió a pasar.

## Niveles y rango de Colaborador consultables desde el perfil

El nivel ("Coleccionista", etc.) y el rango de Colaborador solo se
veían como texto — no había forma de saber qué niveles/rangos
existen ni qué hace falta para el siguiente. Ahora ambos son
clicables (en `perfil.html` **y** en `usuario.html`, el perfil
público de cualquiera, para que sea información consultable por
todo el mundo, no solo por el propio usuario) y abren un modal con
la escalera completa, resaltando en cuál estás:

- Clic en el nivel (bajo el nombre, "Coleccionista · 580 XP") → modal
  con los 5 niveles y su XP mínimo.
- Clic en la tarjeta de "Colaborador" (entre las estadísticas) →
  modal con los 4 rangos y cuántas guías aprobadas hace falta para
  cada uno.

Para no duplicar los umbrales en dos sitios, se extrajo
`CONTRIBUTOR_TIERS` (un array ordenado, igual que ya existía
`LEVEL_THRESHOLDS`) del que `contributorTier()` deriva el rango
actual — antes eran un `if/else` en cadena sin la lista expuesta.
Las dos funciones nuevas, `levelLadderHtml(xp)` y
`tierLadderHtml(approvedGuidesCount)` (en `gamification.js`),
generan el HTML del modal reutilizando el modal genérico
`#profileModal` que ya existe en ambas páginas (el mismo que usa
"Editar perfil" o "Siguiendo/Seguidores").

El nivel pasó de `<div class="profile-level">` a
`<button type="button">` (el reset global de `button` ya deja que
se vea igual que el div de antes) para que sea accesible por
teclado; la tarjeta de "Colaborador" también pasó de `<div
class="stat-card">` a `<button class="stat-card">`, mientras el
resto de tarjetas (Cursos completados, Preguntas, Valoración,
Racha) se quedan como `<div>` normales, sin clic, porque no tienen
una "escalera" de niveles que mostrar.

Verificado con Playwright en `perfil.html` (perfil propio) y en
`usuario.html` (perfil público de otra persona): ambos botones
existen, ambos modales listan los 5 niveles / 4 rangos completos,
marcan el actual con una etiqueta ("Tu nivel"/"Tu rango"), y se
cierran con el botón de cerrar o con Escape. Se rompió a propósito
quitando el `addEventListener` del nivel para confirmar que el test
detecta que el modal ya no se abre, se restauró y volvió a pasar.

## Tarjetas de guía siempre del mismo alto (categorías y "Añadidas recientemente")
Aunque una corrección anterior ya igualaba las tarjetas *dentro de
una misma fila* (quitando `align-items: start`, ver más arriba), el
problema seguía viéndose entre filas y en móvil (una sola columna,
donde cada tarjeta va sola en su fila y no tiene con quién
igualarse): una guía con una descripción de tres líneas era mucho
más alta que otra con una sola. Ahora el título y la descripción se
recortan a un número fijo de líneas en las dos rejillas que usan
tarjeta grande: `.guide-card-info` (categorías, vía
`renderGuideCardHtml`) y `.recent-card` (la home).

El detalle que costó encontrar: `-webkit-line-clamp` **solo pone un
máximo** de líneas para el contenido que se desborda, no reserva esa
altura para el contenido que ocupa menos. Con `line-clamp: 2` a
secas, una descripción de una línea seguía midiendo una línea y las
tarjetas seguían descuadradas. Hay que añadir además un `height`
explícito (`2.8em` en `.guide-card-info p` y `2.9em` en
`.recent-card p`, es decir `line-height` × 2) para que el hueco de
las dos líneas esté siempre reservado. El título se recorta a una
línea con `text-overflow: ellipsis`, y en las tarjetas de categoría
se añadió un `title=` con el texto completo del título y de la
descripción, para que al pasar el ratón se pueda leer lo que se ha
cortado.

De paso, `.recent-card .emoji` no tenía caja fija (a diferencia de
`.guide-card-icon`, que ya medía 46×46): si el `cover_emoji` era
raro o largo, se repartía en varias líneas y estiraba la tarjeta.
Se le puso `height: 34px` con `overflow: hidden`.

Nota sobre lo que **no** se ha igualado: en la home, una guía con
`cover_image` lleva a propósito una banda de imagen de 108px arriba
y es legítimamente más alta que una que solo tiene emoji. Eso es
diseño, no un fallo, así que el test compara solo tarjetas del mismo
tipo.

También se quitó la opción `authorName` de `renderGuideCardHtml`
(pintaba una línea "De <autor>" bajo la descripción). Se añadió en
d2bd991 para la sección de Comunidad y quedó huérfana en 936e729,
cuando esa sección pasó a usar `renderCommunityGuideRowHtml`: ningún
sitio la pasaba ya, y de haberse vuelto a usar habría descuadrado
las alturas otra vez.

Verificado con Playwright en `categoria.html` (17 tarjetas, todas a
176px) y en la home a 380px de ancho, una sola columna (todas a
217,7px). Se rompió a propósito cada mitad del arreglo por separado:
sin el `height` de la descripción la diferencia sube a 75px y la
descripción larga deja de recortarse; sin la caja del emoji sube a
62px. Se restauraron ambas y volvió a pasar.

## Las barras de progreso solo cuentan las guías que tienen curso

Una guía puede llevar dos cosas independientes: la **documentación**
(`reference_blocks`, para leer en `guia.html`) y el **curso**
(`blocks`, los pasos interactivos de `curso.html`). Hay guías que solo
tienen documentación, y esas no se pueden "completar" — no hay nada
que terminar.

El listado de "Aprender" usaba `categories.guide_count` como
denominador, que son **todas** las guías publicadas de la categoría.
Con una categoría de 1 curso y 2 guías de solo lectura decía "1 de 3
cursos completados" con la barra a un tercio, y por muchos cursos que
hicieras nunca llegaba al final. `categoria.html` tenía el mismo fallo
en su barra de cabecera, dividiendo entre `guideList.length`.

Ahora ambas dividen entre las guías que de verdad tienen curso.
`aprender.js` ya no puede usar el contador cacheado de la categoría, así
que pide `id, category_id, blocks` de las guías publicadas y las cuenta
en el cliente; `categoria.js` filtra la lista que ya tenía cargada.

La regla "esto tiene curso" estaba escrita a mano en tres sitios de
`guide-modal.js` y era justo lo que se había desincronizado, así que se
extrajo a `guideHasCourse(guide)` en `js/app.js` y los cuatro ficheros
la comparten.

Dos casos que se arreglaron de camino:

- Si una guía pierde su curso después de que alguien lo complete, el
  progreso guardado sigue en `user_progress`. El numerador se limita con
  `Math.min(...)` para no enseñar "2 de 1".
- Una categoría **sin ningún curso** ya no pinta una barra vacía al 0%.
  En su lugar dice cuántas guías hay para leer.

Verificado con Playwright montando el caso exacto: categoría con 1 curso
(completado) + 2 guías de solo lectura. Da "1 de 1 curso completado" y
las dos barras al 100%. Se revirtió el arreglo a propósito y la prueba
reprodujo el fallo original ("1 de 3 cursos completados", barras al 33%,
y la categoría sin cursos volviendo a pintar barra); se restauró y
volvió a pasar.

Aviso para futuros tests: sembrar `__FAKE_EXTRA_PROGRESS__` con
`user_id: 'admin-1'` **cuelga la página**. Es una limitación del stub,
no del sitio — el stub reconstruye el perfil de `admin-1` en cada
consulta, así que el `update` de logros nunca se queda guardado y
`addXP` → `checkAchievements` → `addXP` se llaman en bucle infinito. Hay
que usar un usuario de `USER_PROFILES` (p. ej. `user-1`, Ash) vía
`window.__FAKE_SESSION__`.

## Contenido inicial: `supabase-seed-contenido.sql`

13 guías oficiales escritas para arrancar la web, repartidas por las seis
categorías (cuatro estaban vacías del todo):

- **Primeros pasos** (2): empezar una colección sin arruinarte, y el
  glosario del vocabulario que se usa en los anuncios.
- **Comprar, vender & mercado** (2): tasar una carta de verdad (pedida
  contra ventas reales), y comprar seguro de segunda mano.
- **¿Es real o fake?** (4): los 6 chequeos, el test de la luz y el rip
  test, slabs falsos, y producto sellado resellado.
- **Identificar cartas** (2): leer la franja inferior de una carta, y el
  mapa de rarezas de normal a alt art.
- **Mazos & estrategia** (2): cómo se juega en 5 minutos, y la proporción
  de un primer mazo.
- **Historia & curiosidades** (1): 1999, el Set Base y sus variantes.

Cada guía lleva documentación completa (un bloque `richtext`) **y** curso
interactivo: 95 bloques en total, todos empezando por `hook` y acabando en
`reward`, encadenados entre sí con `next_guide_slug` para que al terminar
uno te proponga el siguiente.

Entran como guías oficiales: `author_id = null` (la web muestra "Guía
oficial" en vez de un autor), `review_status = 'approved'`, `is_pro =
false` y `reference_unlocked_by_default = true`, para que la documentación
se pueda leer sin completar antes el curso.

**Cómo está construido el fichero.** El `insert` no lleva `category_id`
a pelo: hace `join categories c on c.slug = s.category_slug`, así que se
engancha solo a las categorías por slug y no depende de ningún uuid. Al
final recalcula `categories.guide_count`, que no tiene trigger en la base
y si no se quedaría desincronizado.

Es **idempotente**: `on conflict (slug) do nothing`. Se puede ejecutar más
de una vez sin duplicar ni pisar nada, y no toca ninguna guía existente.

El SQL se genera desde un script (el contenido se define como estructuras
de datos y el fichero se escribe a partir de ellas) en vez de escribirse a
mano, porque meter el JSON de `blocks`/`reference_blocks` dentro de
literales SQL a mano es pedir un error de escapado.

El HTML de la documentación se limita a las etiquetas que deja pasar
`sanitizeRichText` (`p br strong b em i u h2 h3 ul ol li a img
blockquote`). Nada de tablas: DOMPurify las quitaría al pintar la guía y
el contenido se perdería.

**Verificación.** Se levantó un PostgreSQL 16 temporal con el esquema
mínimo (incluida la columna generada `has_reference_blocks`) y una guía
preexistente de control, y se ejecutó el fichero de verdad: entra sin
errores, deja las seis categorías con su recuento correcto, y al lanzarlo
por segunda vez no duplica nada (14 filas = 13 + la de control) ni altera
la guía que ya estaba. Se validó además que todos los bloques de práctica
son coherentes: ningún `correct_index` fuera de rango, ninguna
`correct_option` que no esté entre las opciones, ninguna opción repetida y
ningún `match` con dos respuestas idénticas. Por último se cargaron las 13
guías en el stub y se comprobó con Playwright que las 13 documentaciones se
pintan enteras (entre 2.400 y 3.700 caracteres cada una, con sus títulos,
listas y citas) y que los 13 cursos arrancan y avanzan sin errores de JS.

Alcance real de ese último test: el recorrido del curso se detiene en el
primer bloque de práctica que exige respuesta, porque el script no contesta
las preguntas — cubre las 3-4 primeras pantallas de cada curso, no las 95
en su totalidad. La corrección de los bloques que quedan más allá está
cubierta por la validación de campos descrita arriba, que sí los revisa
todos uno a uno.

## Bug real: los cursos completados no se guardaban

Al terminar un curso salía el confeti, el contador de XP y "¡Curso
completado!", pero la guía seguía sin aparecer como completada. El
progreso no se guardaba **y nadie se enteraba**.

**Causa raíz.** `markCourseCompleted()` (y `markCourseStarted()`) escriben
en `user_progress` con un upsert:

```
.upsert({ ... }, { onConflict: 'user_id,guide_id' })
```

PostgREST lo traduce a `INSERT ... ON CONFLICT (user_id, guide_id)`, y
Postgres solo acepta esa cláusula si existe un índice único o una
restricción única sobre **exactamente** esas dos columnas. Si no existe,
falla siempre con `42P10: there is no unique or exclusion constraint
matching the ON CONFLICT specification`.

**Por qué no se veía.** Ninguna de las tres funciones que escriben
progreso miraba el `{ error }` que devuelve Supabase — se hacía
`await supabase.from(...).upsert(...)` a secas. El fallo era del todo
silencioso: la interfaz celebraba el curso y la base no guardaba nada.

Este documento decía que `user_progress` era "único por (user_id,
guide_id)", pero eso venía de la descripción de la tabla, no de haber
comprobado que la restricción existiera de verdad.

**Arreglado en dos mitades.**

En el cliente, `markCourseStarted`, `markCourseCompleted` y `addXP` ahora
comprueban el error, lo registran con `logClientError()` (nuevo export de
`error-log.js`, para fallos que no lanzan excepción y por tanto no los
recogen los manejadores globales) y lo propagan. `curso.js` los captura:
si el guardado falla, la pantalla de recompensa muestra un aviso visible
(`.reward-save-warning`) y un toast, en vez de dar por bueno un progreso
que no se ha guardado.

En la base, `supabase-migration-user-progress-unique.sql` crea el índice
que falta. El fichero está dividido en bloques: primero diagnostica (¿hay
índice?, ¿hay filas duplicadas?, ¿qué políticas RLS hay?), luego repara, y
sólo si hay duplicados hace falta el bloque de limpieza — que conserva la
fila más avanzada de cada par (completed gana a started, y a igualdad la
más reciente).

De paso, `addXP` también corta si no puede guardar el XP: si el total no
se persiste y los logros tampoco, `addXP` → `checkAchievements` → `addXP`
se llamarían en bucle indefinidamente.

**Verificación.** Contra un PostgreSQL 16 temporal se reprodujo el fallo
exacto: el mismo upsert que hace la app devuelve `42P10` sin el índice, y
funciona en cuanto se crea. El índice es idempotente (`if not exists`) y
la limpieza de duplicados deja una sola fila conservando el estado
`completed`. En el cliente, con Playwright y un interruptor de prueba que
simula ese mismo error de Postgres: con la base sana el curso queda
guardado como `completed` y no se avisa de nada; con la base rechazando el
upsert aparece el aviso, sale el toast, y el fallo queda registrado en
`client_errors` con el mensaje de Postgres.

## El botón final del curso ahora lleva a Aprender

La pantalla de recompensa pintaba "Siguiente curso →" a partir de
`next_guide_slug` del bloque `reward`. Si ese slug apuntaba a un curso que
no existe (o que existe pero no tiene bloques), el botón dejaba al usuario
en una página vacía.

Se ha sustituido por "Seguir explorando →", que lleva siempre a
`aprender.html`. Es un destino que no puede romperse y encaja mejor con lo
que se quiere después de terminar un curso: ver qué más hay.

`next_guide_slug` sigue existiendo en los datos y en el editor, pero la
pantalla de recompensa ya no lo usa.

## El dominio bueno es pokedoc.es, no el subdominio de Netlify

Al iniciar sesión en `pokedoc.es` acababas en
`pokedocpingu.netlify.app`. Hay tres piezas, y **dos de ellas no están en
este repositorio** — son ajustes de paneles externos.

**En el código (arreglado aquí).**

`signInWithOAuth` y `resetPasswordForEmail` ya construían el destino con
`window.location.origin`, así que respetaban el dominio de origen. Pero
`signUp` y `auth.resend` **no pasaban `emailRedirectTo`**, y sin ese dato
el enlace del email de confirmación vuelve siempre al "Site URL" del
proyecto de Supabase. Ahora los cuatro flujos usan el origen actual.

`perfil.js` escribía `pokedocpingu.netlify.app` a mano en la vista previa
del nombre de usuario; ahora usa `window.location.host`.

`robots.txt` declaraba `Sitemap: /sitemap.xml` en relativo, que la
especificación no admite — tiene que ser una URL absoluta. Apunta ya a
`https://pokedoc.es/sitemap.xml`. El `sitemap.xml` ya usaba pokedoc.es.

**En `netlify.toml` (arreglado aquí).** Una regla nueva, la primera de
todas, manda `https://pokedocpingu.netlify.app/*` a
`https://pokedoc.es/:splat` con un 301 forzado. Es la red de seguridad:
aunque un redirect externo devuelva a alguien al subdominio, acaba en el
dominio bueno conservando la ruta. Solo coincide con el subdominio de
producción exacto, así que las previsualizaciones de despliegue
(`deploy-preview-N--…` y `rama--…`) siguen funcionando en su propia URL.

**En el panel de Supabase (hay que hacerlo a mano).** En Authentication →
URL Configuration: el **Site URL** debe ser `https://pokedoc.es`, y las
URLs de `pokedoc.es` tienen que estar en la lista de **Redirect URLs**
permitidas. Si un `redirectTo` no está en esa lista, Supabase lo descarta
y usa el Site URL en su lugar — que es exactamente el síntoma original.

**En el panel de Netlify (conviene).** Domain management → poner
`pokedoc.es` como dominio principal, para que Netlify mismo redirija los
alias en vez de depender de la regla del `netlify.toml`.

Verificado con Playwright: `signUp` manda `emailRedirectTo` con el origen
desde el que se navega y no queda ningún `netlify.app` escrito a mano en
las llamadas de auth; la vista previa del username usa el host actual. Se
revirtió el `emailRedirectTo` a propósito y la prueba lo detectó; se
restauró y volvió a pasar. La regla de `netlify.toml` no se puede probar
en local (la aplica el CDN de Netlify, no el sitio).

## Estadísticas de uso reales en /admin

La sección "Analítica" contaba solo visitas por ruta. Ahora es un panel
de uso con seis bloques:

- **Resumen del periodo**: visitas, usuarios activos (distintos, con
  sesión), altas nuevas, usuarios registrados, % de visitas con sesión
  iniciada y cuántas personas tienen una racha viva.
- **Visitas por día**: un gráfico de barras del periodo elegido. Está
  hecho con una rejilla CSS y divs de altura variable — no se ha traído
  ninguna librería de gráficos para cuatro barras.
- **Páginas más visitadas**, con barra comparativa.
- **Guías más vistas**, de `guides.view_count`. Ojo: ese contador es
  **acumulado desde siempre** y no distingue si la visita fue a la
  documentación o al curso, porque `guia.js` y `curso.js` incrementan el
  mismo campo. No se filtra por periodo.
- **Cursos**: cuánta gente ha empezado y completado cada uno, ordenados
  por uso, con el porcentaje que llega al final. Es la métrica más
  accionable: un curso con muchos empezados y pocos acabados señala dónde
  se atasca la gente.
- **Actividad de la comunidad**: comentarios en guías y mensajes en muros
  del periodo, más el reparto de guías con y sin curso.

**La migración que hace falta.** `supabase-migration-admin-analytics.sql`
añade una política de lectura de `user_progress` para admins. Sin ella la
única política era `auth.uid() = user_id`, así que el panel solo veía el
progreso del propio admin — y el "Cursos completados" del dashboard daba
una cifra equivocada sin decirlo. La migración no toca las políticas de
escritura: cada persona sigue escribiendo solo su propio progreso.

Siguiendo lo aprendido con el bug del progreso que fallaba en silencio,
aquí **no se enseña un cero como si fuera un dato**: si la consulta de
`user_progress` da error, se dice cuál es y qué migración aplicar; y si
devuelve un solo usuario habiendo varios registrados, se avisa de que
probablemente falte la política en vez de dar la cifra por buena. El
dashboard hace lo mismo: muestra "—" y el motivo en lugar de un 0.

**Limitación de `page_views`.** Solo guarda `path`, no la query string, y
las guías se ven en `/guia.html?slug=…`. Por eso "páginas más visitadas"
no puede desglosar por guía y esa parte se saca de `guides.view_count`.
Se dejó así a propósito: la tabla no guarda identificador de visitante ni
nada que permita perfilar a nadie.

**Verificación.** La migración se aplicó contra un PostgreSQL 16 temporal:
falla con un mensaje claro si no existe `is_admin()`, crea la política, se
puede relanzar sin error y deja intacta la de escritura. De paso se
corrigió la consulta de diagnóstico de políticas en esta migración y en
`supabase-migration-user-progress-unique.sql`: usaban `cmd` sobre la tabla
`pg_policy`, que no tiene esa columna — lo correcto es la vista
`pg_policies`. El fallo salió al ejecutarlas de verdad.

En el panel, con Playwright: se pintan los seis bloques, el gráfico saca
una barra por día (7 y 90), y el selector de periodo cambia los datos de
verdad — con 7 días salen 3 visitas y con 90 salen 5, porque el stub tiene
una visita de hace 40 días. Para que eso fuese comprobable hubo que
implementar `gte`/`lte` en el stub, que hasta ahora los ignoraba. Y
simulando que RLS rechaza `user_progress`, el panel avisa de la migración
que falta en vez de enseñar una tabla vacía.

## Nadie empieza llamándose "Usuario"

Quien entraba con Google se quedaba sin nombre y salía como "Usuario" por
toda la web (ese literal es el último recurso de una docena de sitios,
para cuando no hay ni `display_name` ni `username`).

**Por qué pasaba.** El onboarding ya pedía nombre y ya era obligatorio
(el botón de continuar exige 2 caracteres). El problema era quién llegaba
a él: `redirectAfterLogin` de `auth.js` comprueba `onboarding_completed`,
pero **solo se ejecuta en el login con contraseña**. El `redirectTo` de
`signInWithOAuth` apunta directo a `index.html`, así que quien entra con
Google se saltaba esa comprobación por completo y nunca veía el
onboarding.

Y encima el dato estaba a mano sin usar: Google manda el nombre de la
cuenta en `user_metadata` (por eso el panel de Supabase Auth sí muestra
"Denis", "Diego Mateo"...), pero nada lo leía.

**Arreglado así.** `initNavbar()` manda al onboarding a cualquier persona
con sesión que no tenga nombre, entre por donde entre. El onboarding
precarga el campo con `suggestedNameFromSession()`: el nombre del
proveedor si lo hay, y si no la parte del email antes de la arroba. Sigue
siendo obligatorio confirmarlo — solo se evita la pantalla en blanco.
`finishOnboarding` pasa a `upsert` porque quien llega por OAuth puede no
tener todavía fila en `user_profiles`, y un `update` no crearía ninguna.

**El detalle que casi provoca un bucle infinito.** La condición incluye
`document.getElementById('nav-user')`. No basta con que `onboarding.html`
no pinte navbar: `initNavbar()` se ejecuta **al importar `app.js`**, y
`onboarding.js` lo importa para usar `requireAuth`. Sin esa comprobación
el onboarding se redirigía a sí mismo sin parar y la página no llegaba a
cargar nunca. Se verificó quitándola a propósito: el test se queda colgado
en la carga, que es justo el síntoma.

La condición mira **si no hay nombre**, no solo `onboarding_completed`:
hay cuentas antiguas con esa columna a `null` que sí tienen nombre, y no
hay que mandarlas otra vez al onboarding.

## Los niveles de XP cuestan bastante más

Con ~55 XP por curso (5 por bloque de práctica más la recompensa) y +5 al
día por la racha, alguien recién registrado llegaba a "Experto" con
hacerse el contenido una vez. Los umbrales nuevos:

    Novato          0
    Entrenador    250
    Coleccionista 1.000
    Experto       3.000
    Maestro       8.000

Con las 13 guías publicadas hoy, hacérselas todas deja a alguien
alrededor de Entrenador. Los niveles altos piden constancia.

**Un fallo latente que salió al tocarlo**: `calculateLevel()` tenía los
umbrales **repetidos a mano** en una cadena de `if`, aparte de la tabla
`LEVEL_THRESHOLDS`. Cambiar solo la tabla no habría servido de nada — la
función habría seguido devolviendo los niveles viejos. Ahora deriva de la
tabla, que queda como única fuente.

**La columna `level` estaba desfasando la interfaz.** `user_profiles.level`
es un valor guardado que la app solo reescribe cuando alguien gana XP. El
perfil ya calculaba el nivel desde `total_xp`, pero la lista de Comunidad
y el desplegable de la navbar leían la columna, así que habrían seguido
enseñando el nivel viejo. Ahora los tres lo calculan.
`supabase-migration-recalcular-niveles.sql` pone además la columna al día
para que el dato de la base no se contradiga con lo que se ve.

**Verificación.** La migración contra un PostgreSQL 16 temporal con los
usuarios de la captura: 920 y 785 XP pasan de "Experto" a "Entrenador",
490 de "Coleccionista" a "Entrenador", y `total_xp` nulo cae en "Novato".
Es idempotente. Se comprobaron además las **12 fronteras** (0, 249, 250,
999, 1000, 2999, 3000, 7999, 8000...) contrastando el `case` del SQL con
la función de JavaScript una a una, porque son dos copias de los mismos
umbrales y podrían separarse.

Con Playwright: quien no tiene nombre acaba en el onboarding, el campo
viene relleno con el nombre de Google, sin nombre del proveedor cae al
email, el mínimo de 2 caracteres sigue bloqueando, quien ya tiene nombre
no es molestado, y la lista de Comunidad enseña 340 XP como "Entrenador"
en vez del "Coleccionista" que tiene guardado.

## Leer una guía cuenta

La gamificación premiaba lo complementario e ignoraba lo principal:
completar un curso daba 20-40 XP y quedaba marcado, mientras que leerse
una guía entera solo incrementaba `guides.view_count`. Alguien que se
hubiera leído toda la web seguía a 0 XP.

**Dónde se guarda.** Una columna `read_at` nueva en `user_progress`
(`supabase-migration-guias-leidas.sql`), no una tabla aparte: esa tabla ya
es "mi relación con esta guía", ya está indexada por `(user_id, guide_id)`
y ya tiene las políticas RLS correctas.

Consecuencia importante: **`status` pasa a admitir NULL**. Una guía que
solo se ha leído crea una fila con `read_at` puesto y `status` a null.
Todo lo que cuenta cursos filtra ahora `status is not null` — incluida la
analítica del panel, que si no habría contado esas filas como "cursos
empezados". El upsert de marcar como leída manda solo `read_at`, así que
no pisa el estado del curso si la guía tenía uno.

**Cuándo se marca.** No al abrir, que sería regalar el XP. Hay un
marcador invisible al final del artículo y se exige que **entre en
pantalla** y que hayan pasado **15 segundos** desde que se abrió. Si se
sube antes de tiempo, la cuenta atrás se cancela.

Detalle que costó ver: en una guía corta el marcador ya se ve nada más
abrir, y `IntersectionObserver` **no vuelve a dispararse** porque la
intersección nunca cambia. Sin un temporizador para el tiempo que falta,
esas guías no se marcarían nunca. Releer no vuelve a dar XP ni reescribe
la fecha original.

Son 10 XP, menos que un curso a propósito: leer cuesta menos que hacer
los ejercicios, pero tenía que valer algo.

**Las barras de progreso ahora miden lectura.** Tanto el listado de
Aprender como la cabecera de categoría dividen entre el total de guías, no
entre los cursos. Es la acción principal y la única que existe en todas
las categorías; los cursos pasan a una línea secundaria ("2 de 3 cursos
hechos") donde los haya. La barra de `categoria.html` además **no tenía
etiqueta**, así que no se sabía qué medía: ahora la lleva.

Esto no deshace el arreglo anterior de no contar guías sin curso como
cursos — ese fallo sigue vigilado en las pruebas, ahora sobre la línea de
cursos.

De paso, `aprender.js` dejó de pedir `guides(category_id)` anidado y mapea
por `guide_id` contra las guías que ya tenía cargadas: una consulta plana
es más predecible.

**Dos fallos de fidelidad del stub que salieron aquí**, ambos hacían
fallar código correcto:

- `maybeSingle()` devolvía error cuando no había filas. En Supabase real
  eso solo lo hace `single()`; `maybeSingle()` devuelve `data: null` sin
  error. Con el stub anterior, `markGuideRead` fallaba justo en el caso
  normal: la primera vez que alguien lee una guía.
- El mínimo de 15 segundos se deja configurable **solo en la copia de
  pruebas** para no esperar 15 s por caso. El valor del repo es fijo.

**Verificación.** La migración contra un PostgreSQL 16 temporal: añade la
columna, hace `status` nullable, es idempotente, y el upsert de lectura ni
pisa un `status = 'completed'` existente ni reinicia la fecha al releer.
Con Playwright, 15 comprobaciones: abrir sin leer no cuenta, llegar al
final y quedarse sí, da exactamente 10 XP, releer no vuelve a darlos,
marcar como leída conserva el curso completado, la tarjeta enseña "LEÍDA"
sin decir "COMPLETADO" en una guía sin curso, y Aprender mide lectura
manteniendo la línea de cursos.

## Móvil: nada se arrastra de lado

En el móvil se podía arrastrar el modal de una guía hacia los lados, lo
que rompe la sensación de app. Se arreglaron los casos concretos y se
dejó una **auditoría** (`audit-movil.mjs` en el scratchpad) que recorre 15
páginas y 5 popups a 360 y 390 px buscando desbordes horizontales.

**La trampa de CSS detrás.** `.modal-box-wide` tenía `max-height: 85vh` +
`overflow-y: auto`. Poner `overflow-y` distinto de `visible` hace que
`overflow-x` pase a `auto` **por especificación**, aunque no se escriba.
Así que cualquier contenedor con scroll vertical se convierte en un
carrusel horizontal en cuanto algo dentro no cabe.

**Los cuatro desbordes encontrados:**

1. La fila de acciones del modal (Guardar / Guía / Curso / reportar)
   llevaba `flex-direction: row` en un estilo en línea que pisaba el
   `column` del CSS, y **sin `flex-wrap`**: en un móvil estrecho el botón
   de Curso se salía. Ahora es una clase, `.modal-actions-row`, con
   `flex-wrap: wrap`. El estilo en línea desaparece.
2. `.modal-box-wide` lleva además `overflow-x: hidden` como red de
   seguridad, para que un desborde futuro no vuelva a hacerlo arrastrable.
3. Las 5 tarjetas de estadísticas del perfil (`.stats-row-single`) se
   salían a 360 px: un hijo de grid tiene `min-width: auto` y se niega a
   encoger por debajo de su contenido. Con `min-width: 0` la columna ya
   puede encoger y la etiqueta se recorta con "…".
4. `.profile-hero-social` (seguidores / siguiendo / trofeos) no envolvía y
   el tercer contador se salía del recuadro.

Y dos blindajes preventivos: el emoji de portada del banner del modal y el
de la tarjeta de la home. Ese campo lo escribe quien crea la guía, así que
si ahí acaba una cadena larga en vez de un emoji, estiraba el contenedor.
Ahora se recorta con "…".

**Lo que aprendió la auditoría por el camino** (dos veces estuvo a punto
de dar un aprobado falso):

- Mirar solo `document.scrollWidth` **no ve** el desborde de un modal, que
  scrollea por dentro sin ensanchar el documento — justo el caso que se
  reportó. Hay que recorrer los contenedores con scroll uno a uno.
- Mirar solo `overflow-x: auto/scroll` hace que **poner `overflow-x:
  hidden` "arregle" la auditoría sin arreglar nada**: el contenido sigue
  sin caber, solo que ahora se recorta invisible en vez de arrastrarse. Se
  comprobó midiendo los botones uno a uno: con `flex-wrap` ocupan 3 filas
  y ninguno queda cortado.
- Recortar a propósito con `text-overflow: ellipsis` o `line-clamp` **no
  es un fallo**, es lo correcto. Sin esa excepción la auditoría marcaba
  como problema justo lo que ya estaba bien resuelto.

**No se ha puesto `overflow-x: hidden` en el `body`.** Es el parche
habitual para esto y habría tapado los cuatro fallos de golpe, pero
también habría dejado la auditoría ciega para siempre. Se han arreglado
las causas.

Verificado: 0 desbordes en las 15 páginas y los 5 popups, a 360 y 390 px.
Se revirtieron los arreglos a propósito, uno a uno, y la auditoría los
volvió a detectar.

## Los "Failed to fetch" del panel de errores

El registro de errores se estaba llenando de "Failed to fetch": **dos por
cada carga de página, con el mismo segundo**. Ese patrón (dos entradas
idénticas y simultáneas) es la pista: no son dos fallos, es uno solo que
dispara los **dos** manejadores globales que registra `error-log.js`
(`error` y `unhandledrejection`).

**La causa.** El módulo se llamaba `js/analytics.js`. Los bloqueadores de
anuncios y de rastreo (uBlock, los escudos de Brave, los bloqueadores de
contenido de Safari en iPhone) bloquean por norma cualquier URL cuya ruta
contenga `analytics`. Con ese nombre, el `import()` dinámico fallaba en el
navegador de cualquiera que use uno.

Renombrado a **`js/page-views.js`**, que además describe mejor lo que hace
(escribe en la tabla `page_views`).

**Y el fallo de fondo, que era peor que el nombre.** Ninguno de los
`import()` dinámicos de `initNavbar()` tenía `.catch()`. Un módulo que no
carga —por un bloqueador o por red mala— no solo ensuciaba el registro:
podía cortar el resto de la navbar. Ahora los siete llevan `.catch()`, así
que lo que falle deja de funcionar solo eso.

`error-log.js` además no repite el mismo mensaje dos veces en la misma
carga.

## El SyntaxError de `guideHasCourse`

`Importing binding name 'guideHasCourse' is not found` es caché
desincronizada, no un fallo de código: el navegador tenía un `js/app.js`
viejo (sin ese export) y pidió un `js/guide-modal.js` nuevo (que sí lo
importa). Los ficheros no llevan huella en el nombre, así que un
despliegue puede dejar esa mezcla — y entonces la página **se queda en
blanco**, porque un módulo que no resuelve un import no ejecuta nada.

Mitigado con cabeceras en `netlify.toml`: `/js/*` y `/css/*` con
`max-age=0, must-revalidate`. El navegador pregunta siempre si su copia
vale; cuando el fichero no ha cambiado responde 304, así que no penaliza.
No lo elimina del todo (haría falta poner huella en los nombres, que pide
un paso de build), pero reduce mucho la ventana.

**Verificación.** Con Playwright, cortando la petición de un módulo igual
que haría un bloqueador: no se registra ningún error, la navbar se sigue
montando, la home sigue pintando y lo que va después del módulo caído
sigue cargando. Y lanzando el mismo error por las dos vías, se guarda una
sola vez.

Nota para futuros tests: el stub siembra una fila de ejemplo en
`client_errors` (`Cannot read properties of undefined (reading "map")`)
para poder probar la tabla del panel. Al contar errores hay que
descontarla — sin eso parece un fallo real de la web, y me costó un rato
descartarlo.

## Actividad reciente

Un hilo de "qué está pasando en PokeDoc": *Ash ha completado el curso X*,
*Misty se ha leído Y*, *alguien se ha unido*. Está en la pestaña
**Actividad** de Comunidad (`usuarios.html`) y como adelanto corto en la
home, solo con sesión iniciada.

### No hay tabla de eventos

Lo normal sería una tabla `activity_events` en la que cada acción escribe
una fila. Aquí no: el hilo se **arma leyendo lo que ya existe**, en
`js/activity.js`.

| Fuente | Tabla | Evento |
|---|---|---|
| Cursos terminados | `user_progress` (`status='completed'`) | ha completado el curso |
| Guías leídas | `user_progress` (`read_at`) | se ha leído |
| Guías publicadas | `guides` (`published_at`) | ha publicado la guía |
| Comentarios | `guide_comments` | ha comentado en |
| Altas | `user_profiles` (`created_at`) | se ha unido a PokeDoc |

Cuatro consultas en paralelo, se normalizan a `{tipo, userId, guideId,
fecha}`, se mezclan y se ordenan por fecha. La ventaja no es ahorrar una
tabla: es que **no hay nada que se pueda desincronizar**. Un registro de
eventos aparte se queda mintiendo en cuanto alguien borra una guía o se
deshace un progreso. Aquí, si el dato de origen cambia, el hilo cambia.
El coste es que no se pueden registrar acciones que no dejen rastro en
ninguna tabla; si algún día hacen falta (un "ha subido de nivel"), habrá
que replantearlo.

Se piden más eventos de los que se van a enseñar (`limite * 3`) porque
parte se cae al filtrar, y se recorta al final.

### El interruptor `hide_activity`

Para poder enseñar el progreso de otros, `user_progress` tiene que ser
legible públicamente. Hasta ahora solo lo leía su dueño (y los admins).
`supabase-migration-actividad.sql` añade una tercera política de lectura:

```sql
create policy "user_progress_public_activity" on user_progress
  for select using (
    exists (select 1 from user_profiles p
            where p.id = user_progress.user_id and p.hide_activity = false)
  );
```

**Esto es un cambio de privacidad y conviene tenerlo claro.** Qué guías
lee y qué cursos hace cada persona pasa a ser público — no solo en el
hilo, sino en la API para quien sepa consultarla. En un sitio de
aprendizaje es lo esperable (Duolingo enseña lo mismo), pero es una
decisión, no un detalle.

Por eso viene con salida: `user_profiles.hide_activity` (booleano, por
defecto `false`), con una casilla en Editar perfil. Quien lo active
desaparece del hilo **y sus filas de progreso vuelven a ser privadas**,
porque la propia política lo comprueba — no es solo un filtro de
pantalla. Las políticas se combinan con OR, así que no se le quita nada a
nadie: cada uno sigue leyendo lo suyo y los admins lo siguen viendo todo.

Las otras tres fuentes (guías, comentarios, altas) ya eran de lectura
pública, así que ahí el `hide_activity` se aplica en el cliente.

### Tope por persona

Con veinte usuarios, alguien que se lee cinco guías seguidas llena el
hilo él solo y **parece que no hay nadie más** — justo lo contrario de lo
que busca la función. `MAX_POR_PERSONA = 3` reparte el sitio. Se vio en
la salida de un test, no razonándolo: `{"Ash":3,"Misty":3}` después de
que uno solo ocupara todo.

### Detalles

- **Carga perezosa**: la pestaña no consulta nada hasta que se pincha.
  Son cuatro consultas y no tienen por qué pagarlas quienes entran a
  Comunidad a buscar gente.
- **La home solo con sesión**: sin sesión el adelanto no se pinta. A
  quien llega de fuera le interesa el contenido, no quién ha leído qué; y
  un hilo con dos líneas hace que el sitio parezca más vacío de lo que
  está.
- **Eventos huérfanos**: si la guía ya no existe o se despublicó, el
  evento se descarta — no se puede enlazar a ningún sitio.

### Verificación

18 comprobaciones con Playwright: la pestaña existe y no carga sola, al
pincharla salen eventos con enlaces vivos a perfil y guía, el interruptor
esconde a quien lo activa sin vaciar el hilo, el adelanto de la home
aparece solo con sesión y como mucho con 4, la casilla se guarda, y a 360
px no desborda.

La migración se ejecutó contra un Postgres 16 real con un `auth.uid()`
simulado antes de entregarla: un tercero solo ve las filas de quien no se
ha escondido, y quien se ha escondido sigue viendo las suyas.

El filtro de privacidad se rompió a propósito y el test lo detectó.

## Las rutas de la analítica estaban partidas

En "Páginas más visitadas" salían `/` con 263 y `/index.html` con 26.
Son la misma página. Igual `/aprender` (62) y `/aprender.html` (4),
`/admin/` (58) y `/admin/index.html` (18), `/usuario.html` (11) y
`/usuario/pingu` (6).

**La causa.** Se guardaba `location.pathname` en crudo. Netlify sirve la
misma página por varias URLs — con `.html` y sin él, `/` e `/index.html`,
y `/usuario/:username` reescrito a `/usuario.html?u=`. Según el enlace
que pinchara cada persona, la visita caía en una fila u otra. El ranking
no estaba solo feo: estaba **mal**, porque repartía el total de una
página entre dos o tres filas.

**Y lo que faltaba.** `/categoria.html` juntaba las seis categorías en
una fila de 133 visitas, y `/guia.html` todas las guías en 44. Justo lo
que se quiere saber —*cuál* se usa más— era lo único que no se veía,
porque la identidad de esas páginas está en la query, no en la ruta.

### `normalizePath()`

En `js/page-views.js`. Quita la barra final y el `.html`, colapsa
`/index` a su carpeta, y para las páginas que se identifican por la query
mete el slug en la ruta: `/categoria.html?slug=history` →
`/categoria/history`.

El slug se limpia antes (`[^a-zA-Z0-9_-]` fuera, 60 caracteres máximo):
cualquiera puede escribir lo que quiera en la query y eso acaba en una
tabla y luego en una pantalla del panel.

**Los perfiles se juntan a propósito.** `/usuario/pingu` y
`/usuario.html?u=pingu` van los dos a `/usuario`, sin el nombre. Guardar
a quién mira cada persona —y las filas llevan `user_id`— sería un
registro de quién vigila a quién. Para saber si la gente usa los perfiles
basta con el total.

### Se normaliza también AL LEER

`admin.js` vuelve a pasar `normalizePath()` sobre cada fila al pintar la
tabla, no solo al escribir. Sin eso, las filas ya guardadas seguirían
apareciendo sueltas durante meses y el arreglo no se notaría hasta que
caducaran — que es justo el problema que se estaba arreglando.

Lo que no se puede recuperar es el detalle de las visitas viejas a
categorías y guías: ese dato nunca se guardó. Esas filas se etiquetan
como "sin detalle (visitas antiguas)" en vez de mezclarlas con las
nuevas y fingir que se sabe algo que no se sabe.

### Nombres legibles

Cada fila enseña "Inicio" y, detrás y en gris, `/`. La ruta a secas no
dice nada de un vistazo, y la primera reacción a ver `/` en lo alto de la
tabla fue pensar que era un fallo.

### Verificación

30 comprobaciones con Playwright: la tabla de casos de `normalizePath`
(incluida basura y un slug de 500 caracteres), lo que se guarda de verdad
al visitar páginas reales, y la tabla del panel con filas "antiguas"
sembradas en el stub tal y como estaban en la base real.

Se quitó la normalización de lectura a propósito y saltaron 8
comprobaciones — reproduciendo exactamente la captura del problema.

Eso además destapó una comprobación floja mía: "la home sale una sola
vez" pasaba incluso con el fallo puesto, porque buscaba el texto
"Inicio" y la fila duplicada se llamaba `/index.html`. Se sustituyó por
una que normaliza las rutas mostradas y exige que no haya dos filas para
la misma página.

## El espejo de cartas (TCGdex)

Base para dos cosas: poder meter las cartas de un mazo en una guía de
"Mazos & estrategia", y más adelante el álbum de colección. Las dos
necesitan lo mismo — un catálogo de cartas consultable— así que se
construye una vez.

Los datos vienen de [TCGdex](https://tcgdex.dev): gratis, comunitario,
**sin clave de API** (por eso se llama desde el navegador, sin proxy) y
con más de 10 idiomas, español incluido.

### No se consulta en vivo: se copia

`supabase-migration-cartas.sql` crea `tcg_sets` y `tcg_cards`. La
importación se lanza desde **/admin → Cartas**.

Tres razones para copiar en vez de preguntar cada vez:

1. **La API no pagina por defecto.** `/cards?name=pika` devuelve *todas*
   las coincidencias. Para un buscador que consulta mientras escribes,
   no sirve.
2. **El álbum tendrá que cruzar cartas con datos de cada usuario.** Eso
   no se puede hacer si las cartas viven fuera.
3. Si TCGdex se cae o cambia de condiciones, la web sigue.

Son ~23.600 cartas en ~220 sets: unos 8 MB.

**Importar el catálogo entero son ~220 peticiones, no 23.000**, porque
`/sets/{id}` devuelve el set con todas sus cartas dentro.

Lo que trae ese listado es poco: `id`, `localId`, `name` e `image`.
Suficiente para el buscador. Las columnas de tipo, rareza y HP se quedan
a null a propósito — las necesitará el álbum para filtrar, y traerlas
exige una petición **por carta**.

### Las imágenes no se copian

Se guarda solo la ruta (`swsh/swsh3/136`) y se enlazan a su CDN. Las
cartas son de Nintendo/Creatures/GAME FREAK: enlazarlas es una cosa y
alojarlas es otra.

La ruta se guarda **sin el idioma delante**, porque la URL lo lleva
(`assets.tcgdex.net/es/swsh/swsh3/136/high.webp`) y el español no está
completo. Comprobado abriendo las dos: la carta de Sword & Shield existe
en español y la de Set Base no. Así se puede montar la URL en español y
caer a inglés sin volver a preguntar.

### La cobertura del español está partida por épocas

Medido carta a carta sobre la base de datos real (está en GitHub, y a
GitHub sí se llega desde el entorno de trabajo):

- **Sword & Shield, Scarlet & Violet, Mega Evolution: 98-100%.**
- Sun & Moon 93%, Black & White y XY ~80%.
- **Base, Gym, Neo, E-Card, EX, Diamond & Pearl, Platinum, HeartGold: 0%.**

En total, 15.438 de 23.599 cartas tienen nombre español (65%).

Pero el golpe es menor de lo que parece, y esto también se midió: de las
que sí lo tienen, **solo el 10% de los Pokémon cambia de nombre**
(Charizard es Charizard), frente al **94% de los entrenadores** (*Float
Stone* → *Piedra Pómez*) y el **100% de las energías**.

O sea: el hueco duele justo donde vive el constructor de mazos, que está
lleno de entrenadores y energías, y casi nada en el vintage. Se decidió
enseñar el inglés sin marcarlo: es como se llaman esas cartas en la vida
real y marcarlas ensuciaría sets enteros donde TODAS lo llevarían.

### Buscar sin tildes: dos bugs que solo salieron ejecutando

Se cargó el catálogo real (23.505 cartas) en un Postgres 16 de verdad
antes de entregar nada. Salieron dos fallos que una revisión a ojo no
habría visto:

**1. 1.159 cartas llevan tilde o eñe.** Con un `ILIKE` normal, quien
escriba "pomez" no encuentra "Piedra Pómez" — y aquí casi nadie va a
poner las tildes. Se arregló con una columna generada `name_search`
(`unaccent(lower(name))`) más un índice de trigramas, y normalizando en
JS lo que se teclea de la misma forma.

**2. JS y Postgres no normalizaban igual.** Comparando las 23.505
cartas una a una salieron 35 discrepancias: `unaccent()` de Postgres
también convierte la puntuación tipográfica (`Farfetch’d` → `farfetch'd`),
la ligadura `Æ` → `ae` y la `¿`/`¡` a `?`/`!`, y el `normalize('NFD')` de
JS no hace nada de eso. Una carta guardada de una forma y buscada de
otra es invisible. Tras arreglarlo: **0 discrepancias en las 23.505**.

El índice de trigramas se comprobó con `EXPLAIN ANALYZE`: 1,3 ms usando
el índice frente a 7 ms de recorrido completo. Con 23.000 filas Postgres
elige el recorrido completo porque le sale igual de barato; el índice
está para cuando eso deje de ser cierto.

### Verificación

33 comprobaciones con Playwright, con la API de TCGdex simulada
(interceptando sus URLs con respuestas que copian la forma exacta de su
documentación): traer la lista, importar, que un set que falla no tumbe a
los otros 219, que una carta sin escaneo entre igual con `image_path` a
null, que un 503 se cuente en vez de romper, el montaje de las URLs de
imagen y el filtro de sets.

La migración se ejecutó contra Postgres 16 real, con y sin `is_admin()`,
y dos veces seguidas para comprobar que es idempotente.

Se rompió a propósito la extracción de la ruta de imagen y las pruebas lo
detectaron.

**Lo que NO se ha podido probar:** el entorno de trabajo no tiene salida
a internet (la política de red solo deja pasar npm, pypi y GitHub), así
que nunca se ha hablado con la API de verdad. La forma de las respuestas
viene de su documentación. La primera prueba real es pulsar "Buscar sets
en TCGdex" en el panel.

## Meter cartas en una guía

Botón **Cartas** en la barra del editor de Documentación (`richTextToolbarHtml`).
Abre un buscador, eliges las que quieras y se insertan como una rejilla.

### Lo que se guarda son SOLO identificadores

Dentro de la guía queda esto y nada más:

```html
<tcg-deck data-cards="swsh3-136,base1-4"></tcg-deck>
```

Ni imágenes, ni nombres, ni maquetación. La rejilla la genera
`js/cards-block.js` leyendo `tcg_cards` en el momento de pintar. Tres
razones:

1. **Lo que escribe un autor nunca acaba siendo HTML de verdad.** Solo
   identificadores, y encima validados: `parseDeckIds` exige el formato
   `algo-algo` y descarta el resto, con tope de 60 cartas.
2. Si mañana cambia el diseño de las cartas, **cambian todas las guías ya
   escritas** sin tocarlas.
3. Si TCGdex corrige el nombre de una carta, la guía se corrige sola.

### El detalle que hacía falta resolver

En el editor, la lista **sí** se rellena con las cartas — si no, el autor
estaría escribiendo a ciegas. Pero esa superficie es `contenteditable`, o
sea que su `innerHTML` es exactamente lo que se guardaría.

Se resuelve en `sanitizeRichText`: **vacía siempre el contenido de
`<tcg-deck>`**. La vista previa vive en pantalla y muere al guardar. Un
`<tcg-deck>` sin identificadores válidos se elimina entero.

Al sanitizador se le añadió la etiqueta `tcg-deck` y el atributo
`data-cards`, y de paso se le puso **`ALLOW_DATA_ATTR: false`**: con
`ALLOWED_ATTR` explícito, DOMPurify seguía dejando pasar *cualquier*
`data-*`. Ahora pasa solo el nuestro.

La lista lleva `contenteditable="false"` (se pone al rellenarla, no al
guardarla) para que el cursor no se meta entre las cartas. Y al insertar
se añade un párrafo detrás: sin eso el cursor se queda atrapado al final y
no hay forma de seguir escribiendo debajo.

### Las imágenes, en español con vuelta a inglés

Cada `<img>` pide el escaneo español y, si no existe, reintenta en inglés
**una sola vez** (`data-r` marca que ya se intentó; sin ese freno, una
carta sin ninguna de las dos versiones entraría en bucle). Si tampoco
existe la inglesa, se sustituye por el nombre en un recuadro. Esto es lo
que hace que las cartas anteriores a 2011 se vean, porque en español no
hay escaneos de esa época.

### Detalles

- **Las cartas salen en el orden en que las eligió el autor**, no en el
  que las devuelva la base.
- **Una carta que ya no esté en el catálogo se dice, no se calla**: "1
  carta(s) de esta lista ya no están en el catálogo". Desaparecer en
  silencio dejaría un mazo incompleto sin que nadie se entere.
- **Si no encuentra nada, el buscador sugiere que falte importar el set**.
  Sin eso parece que la búsqueda está rota, cuando lo que pasa es que
  nadie ha pulsado el botón del panel.
- Búsquedas numeradas: si vuelve una respuesta vieja después de una nueva,
  se descarta. Es el mismo fallo que ya se arregló en `buscar.html`.
- Una sola consulta para todas las listas de la página, aunque haya
  varias.

### Verificación

32 comprobaciones con Playwright: el botón existe, el buscador encuentra
"Piedra Pómez" tecleando "pomez", se eligen cartas de sets distintos, se
insertan en el editor y **se ven** mientras editas, las imágenes se piden
en español, la guía publicada las pinta con nombre y set, y la carta que
ya no existe se avisa.

Sobre el saneado en concreto: una lista normal sobrevive, lo que le metan
dentro se tira, los identificadores inventados (`../../etc/passwd`,
`<script>`) se descartan uno a uno, una lista vacía se elimina entera,
otros `data-*` no pasan y el `<script>` se sigue yendo.

Se quitó a propósito el vaciado del contenido y saltaron las dos
comprobaciones que lo cubren, enseñando el HTML de las cartas guardado
dentro de la guía — que es justo lo que no debe pasar.

**Nota sobre el sustituto de DOMPurify en pruebas.** El entorno de trabajo
no llega a `cdn.jsdelivr.net`, así que la copia de pruebas usa
`dompurify-stub.js`. Tenía la lista de etiquetas escrita a mano e
**ignoraba la configuración que se le pasara**, con lo que las pruebas del
saneado comprobaban el sustituto y no el saneado de verdad. Se reescribió
para que respete `ALLOWED_TAGS`, `ALLOWED_ATTR` y `ALLOW_DATA_ATTR`. Vive
solo en el directorio de pruebas; el repositorio nunca lo toca.

## Nadie podía comentar: faltaba una migración

Un tester intentó comentar y le salió:

```
Could not find the 'reply_to_id' column of 'guide_comments'
in the schema cache
```

**No era un fallo del código.** `supabase-migration-guide-forum.sql`
—que añade esa columna— nunca se ejecutó en la base real. El código manda
`reply_to_id` en **todos** los comentarios, también en los que no
responden a nadie (va a `null`), así que sin la columna PostgREST rechaza
la fila entera. Resultado: comentar estaba roto para todo el mundo, en
todas las guías.

La migración era de una línea sin comentarios ni comprobación, fácil de
saltarse entre las otras treinta. Ahora explica qué se rompe si no se
ejecuta, va en una transacción, añade el índice que faltaba y termina
con una consulta que confirma que la columna existe.

El `on delete set null` (y no `cascade`) es a propósito: al borrar un
comentario, sus respuestas **no** desaparecen con él. Comprobado
ejecutándolo contra Postgres 16 real: se borra el padre y la respuesta
sigue ahí con `reply_to_id` a null.

## Comprobación del esquema en el panel

El problema de fondo no era esa columna: era que **una migración sin
ejecutar no se nota hasta que alguien usa la función que la necesita**, y
entonces revienta con un mensaje de PostgREST en inglés que no le sugiere
a nadie "ejecuta este fichero".

`js/schema-check.js` guarda una lista de 22 requisitos —tabla, columna,
qué fichero la crea y **qué se rompe si falta**— y los comprueba pidiendo
cada columna por la misma vía que usa la web. Si aquí falla, a un usuario
le falla igual.

Lo del "qué se rompe" es lo que lo hace útil. "Falta
`guide_comments.reply_to_id`" no le dice a nadie si corre prisa; "Nadie
puede comentar en las guías", sí.

Dos sitios:

- **Sección "Base de datos"**, con la lista completa y los ficheros
  pendientes agrupados. Se agrupa **por fichero**, no por columna, porque
  lo accionable es "ejecuta este .sql": dos columnas del mismo fichero
  son una sola tarea.
- **Aviso rojo en el Dashboard**, que es lo primero que se abre. Si solo
  estuviera en su pestaña habría que sospechar para ir a mirar, y el
  problema es justo que no se sospecha.

**Distingue "no existe" de "no puedo leerlo".** Solo cuenta como
migración pendiente si el error es de columna o tabla inexistente
(`42703`, `42P01`, `PGRST204`). Un fallo de permisos o de red se marca
aparte como "sin poder comprobar": decir "ejecuta este fichero" cuando el
problema es otro haría perder el tiempo.

### Verificación

22 comprobaciones con Playwright, incluido el caso real reproducido
—simulando que falta `guide_comments.reply_to_id` con el mismo error que
da PostgREST de verdad—: salta el aviso al abrir el panel, dice que nadie
puede comentar, nombra el fichero exacto y marca la fila. Con la base
completa no molesta con nada.

Durante la prueba salió un fallo mío: **el aviso del Dashboard no
aparecía**, porque el `<div>` donde se pinta nunca llegó a insertarse en
el HTML (mi reemplazo no encajaba con el marcado real). La sección sí
funcionaba, así que sin la comprobación del banner habría pasado por
buena — y el banner es justo la parte que hace que el problema no sea
silencioso.

## Los avisos de comentarios no llegaban a quien tocaba

Dos agujeros distintos, los dos de la misma pieza.

### 1. Comentar en una guía oficial no avisaba a NADIE

Las guías del equipo tienen `author_id` a **null**: se crearon con SQL,
no las escribió una cuenta. `createNotification` sale sin hacer nada si
no hay destinatario, así que un comentario en ellas no generaba ningún
aviso — ni al equipo ni a nadie.

Y son justamente las guías que más se comentan, porque son casi todo el
contenido del sitio.

Ahora, cuando la guía no tiene autor, el aviso va **a todos los
administradores** (`user_profiles.is_admin`). El texto cambia también:
"Nuevo comentario en una guía de PokeDoc" en vez de "en tu guía", que
sería mentira — la guía no es de nadie en concreto.

### 2. Responder a alguien avisaba al autor de la guía, no a esa persona

El botón "Responder" guardaba bien el `reply_to_id`, pero el aviso
seguía yendo al autor de la guía. Quien preguntaba algo **no se enteraba
de que le habían contestado**, que es lo único que le importa.

Ahora `notifyGuideComment` reparte así:

- **A quien respondes**, si respondes a alguien → `comment_reply`, "Te
  han respondido a un comentario".
- **Al autor de la guía** (o a los admins si es oficial) →
  `guide_comment`.

**El orden importa.** La respuesta se manda primero, y nadie recibe dos
avisos por el mismo comentario. Si alguien es a la vez el autor de la
guía y la persona a la que respondes, gana "te han respondido": es el
aviso concreto, el otro sobra.

`comment_reply` se añadió a `NOTIFICATION_TYPES`, así que sale en las
preferencias y se puede desactivar como los demás.

El aviso va con `.catch()`: el comentario ya está guardado cuando se
manda, y un fallo al avisar no puede hacer parecer que no se publicó.

### Verificación

16 comprobaciones con Playwright sobre el caso real —una guía oficial sin
autor y otra de un usuario—: el comentario en la oficial llega al equipo
con el texto correcto, el de una guía de usuario llega a su autora y no
al equipo, la respuesta llega a quien preguntó, nadie recibe dos avisos
por el mismo comentario, y quien comenta no se avisa a sí mismo.

Se rompieron los dos arreglos **por separado** y cada uno hizo saltar sus
propias comprobaciones (2 y 3 respectivamente), así que ninguno está
cubierto "de rebote" por el otro.

Nota de pruebas: el stub siembra avisos de ejemplo, y filtrarlos por el
prefijo del identificador no funcionaba. Hay que comparar qué avisos
existían **antes** de comentar. Sin eso, tres comprobaciones fallaban por
datos sembrados y no por el código — la misma trampa que ya pasó con la
fila de ejemplo de `client_errors`.

## El diagnóstico daba una falsa alarma

Recién estrenado, el panel decía que faltaba ejecutar
`supabase-migration-user-notifications.sql`. **Y ya estaba ejecutada.**

La lista de requisitos comprobaba `user_notifications.is_read`. Esa
columna no existe ni ha existido nunca: se llama **`read_at`**, como usa
el propio `notifications.js` en cinco sitios. Escribí la lista de memoria
en vez de contrastarla con las migraciones.

**Una falsa alarma es peor que no tener diagnóstico**: enseña a
ignorarlo, y el día que avise de algo real ya nadie lo mira.

### Ahora la lista se comprueba sola

`test-requisitos-reales.mjs` contrasta los 22 requisitos contra el
repositorio, sin tocar la base:

1. Que la columna y la tabla **aparecen de verdad en el fichero .sql**
   que el requisito dice que las crea.
2. Que la columna **la usa algún .js**. Si no la usa nadie, comprobarla
   es ruido que solo puede dar falsas alarmas.
3. Que las migraciones se pueden ejecutar dos veces.

## Todas las migraciones son ahora idempotentes

El otro problema del mismo día: al reejecutar la migración salía

```
ERROR: 42710: policy "user_notifications_select" ... already exists
```

`create policy` a secas falla si la política ya existe. Eso **hace
pensar que algo va mal cuando en realidad está todo bien**, y encima
deja la duda de si el resto del fichero se aplicó (no: la transacción
aborta ahí).

Se repasaron **las 30 migraciones**: cada `create policy` lleva su `drop
policy if exists` delante, y cada `create table`/`create index` su `if
not exists`. Trece ficheros retocados.

### Lo que solo salió ejecutando

El análisis estático dio 30 de 30 en verde, pero al ejecutar cada
migración **dos veces contra un Postgres 16 real** apareció una más:
`supabase-migration-report-messages.sql`. Su política se llamaba **sin
comillas** (`create policy nombre on tabla`) y mi patrón las exigía.

Es el mismo aprendizaje de siempre en este proyecto: revisar el SQL no
sustituye a ejecutarlo. Se arregló la migración **y el patrón de la
prueba**, que tenía el mismo punto ciego.

Verificación final: 20 migraciones aplicables ejecutadas dos veces
seguidas contra Postgres 16, **0 fallos**.

## Las cartas salían diminutas: choque de nombres de clase

Una lista de cartas en una guía se veía como **un recuadro de 58×80 px,
sin nombre ni set**.

La causa: **ya existía una clase `.tcg-card`** en `style.css` para la
baraja decorativa de la portada (las tres cartas inclinadas del hero).
Esa regla lleva `position: absolute; width: 58px; height: 80px`, y mis
elementos nuevos se llamaban igual, así que la heredaban entera.

Renombradas todas a `deck-*` (`deck-grid`, `deck-card`,
`deck-card-name`, `deck-card-set`, `deck-empty`…). La clase decorativa
estaba antes; la que se mueve es la nueva.

De paso, `.article-body ul` (dos partes de selector) le ganaba en
especificidad a `.deck-grid` (una), y volvía a meter sangría y viñetas
dentro de una guía. Se añadió `.article-body .deck-grid`.

### Ninguna prueba lo veía

Las pruebas contaban elementos: *"2 cartas, todo OK"*, mientras en
pantalla salían aplastadas. Contar nodos no dice nada del aspecto.

Ahora hay una prueba que **mide**: que la carta ocupa su columna entera
(±2 px de la pista del grid), que no está posicionada en absoluto, que
pasa de 100 px de ancho, que el nombre se ve y ocupa el ancho de la
carta, y que no hay sangría ni viñetas. Se volvió a poner el nombre
antiguo a propósito y saltaron tres comprobaciones.

Es la misma lección que con las tildes o con la idempotencia: si la
prueba no mide lo que el usuario ve, no prueba lo que importa.

## Faltaban cartas: la lista de sets se pedía solo en español

TCGdex sirve cada idioma por separado, y **el español no cubre las
épocas antiguas**. Pidiendo `/v2/es/sets` se quedaban fuera sets enteros
— con todas sus cartas. Por eso había cartas que no aparecían en el
buscador por mucho que se importara.

Ahora:

- **La lista de sets se pide en inglés**, que es la completa. Los
  identificadores de set no dependen del idioma.
- **De cada set se piden las DOS versiones y se mezclan**: el inglés
  manda la lista completa de cartas y el español pisa el nombre y la
  imagen cuando existen.

Así una carta sin traducir **sale en inglés en vez de no salir**. Son
~440 peticiones en vez de ~220 para el catálogo entero: sigue siendo
nada, y el español fallando en un set (responde 404 donde no existe) ya
no deja ese set fuera.

**Hay que reimportar** para que esto surta efecto: los sets que nunca
entraron siguen sin estar.

## Fuera el pop-up de la tarjeta

Pinchar una tarjeta de guía abría una ventana ampliada. Se ha quitado:
ahora lleva **directa a la guía** (o al curso, si la guía solo tiene
curso).

**Era un callejón sin salida.** Sus únicas salidas eran los botones
"Guía" y "Curso" — los mismos dos que la tarjeta ya tiene. Costaba un
clic y no acercaba al contenido.

Y tenía dos cosas dentro que estaban en el sitio equivocado:

- **Comentarios.** Era el mismo hilo que se pinta dentro de la guía,
  repetido en la pantalla de navegación. O sea que **se podía comentar
  una guía sin haberla abierto**. En una web sobre detectar
  falsificaciones, consejos escritos por quien solo ha visto el titular
  es lo último que interesa. Ahora los comentarios solo viven dentro de
  la guía.

- **La valoración, que solo existía ahí.** No se podía valorar ni desde
  la guía ni al terminar el curso: únicamente desde el pop-up, es decir
  **solo desde donde no habías leído nada**. El resultado se veía en la
  web: todas las guías con 5.0. Una estrella dada al hojear no distingue
  una guía buena de una mala.

  Se movió a `js/guide-rating.js` y ahora aparece **al final de la guía**
  (entre el texto y los comentarios) y **al terminar el curso**.

Lo que sí se rescató del pop-up es **quién ha escrito la guía**, que
ahora sale en la tarjeta pequeña. En esta web la autoría pesa: no es lo
mismo un consejo del equipo que uno de alguien que se registró ayer. El
nombre enlaza a su perfil, y ese enlace no abre la guía.

`js/guide-modal.js` pasó a `js/guide-card.js` — el nombre ya no describía
lo que hace.

### Verificación

26 comprobaciones con Playwright: la tarjeta navega a la guía correcta,
el pop-up no se pinta en ninguna de las tres páginas que lo usaban, la
autoría sale y enlaza al perfil sin abrir la guía, la valoración está
después del texto y antes de los comentarios, guarda la nota, y sin
sesión invita a entrar en vez de romperse.

### Un desborde de propina

Probando en móvil salió que la guía se arrastraba de lado: 499 px en una
pantalla de 360. El culpable era el **emoji de portada**, que es texto
libre escrito por el autor — nada impide meter ahí una cadena larga, y la
guía de pruebas XSS lo hace.

El primer arreglo (`max-width` + `overflow: hidden`) **empeoró la cosa**:
lo dejó en 1127 px, porque `overflow` no tiene ningún efecto sobre un
elemento en línea y el `white-space: nowrap` que le puse alargó todavía
más la línea. Con `display: inline-block` sí recorta.

Merece la pena anotarlo: el arreglo se dio por bueno con un número peor
que el de partida, y solo se vio porque la comprobación mide el ancho en
vez de dar por hecho que la regla CSS hace lo que parece.

## Las tarjetas de la home se quedaron sin clic

Al quitar el pop-up, las tarjetas de "Añadidas recientemente" dejaron de
hacer nada al pincharlas.

**La causa.** La home tiene maqueta propia (`.recent-card`, con portada
grande), no la tarjeta compartida. Solo llevaba `data-guide-id`, y el
manejador nuevo necesita `data-slug` y `data-has-guide` para saber a
dónde ir. Se quedó muda.

Lo mismo pasaba en las filas de Comunidad y en las de Guardados: cada una
tiene su propia maqueta.

Ahora las cuatro llevan los mismos datos y se comportan igual: **a la
guía si la tiene, al curso si solo tiene curso**. Y las de la home
enseñan también quién ha escrito cada guía, como las de categoría.

**Lo que falló fue la prueba, no solo el código.** Había una
comprobación de que el pop-up ya no se pintaba en la home… y pasaba.
Comprobar que algo *ya no está* no dice nada sobre si lo que lo
sustituye funciona. Ahora se comprueba que **al pinchar pasa algo**: que
la tarjeta sabe su destino y que se produce la navegación.

También se comprobó que el botón de guardar **no** navega: está dentro de
una tarjeta que ahora es clicable entera.

## `has_reference_blocks`: casi doy una falsa alarma

Buscando el fallo anterior salió que ningún fichero de la web calcula
`has_reference_blocks`, el campo del que dependía el botón "Guía" y ahora
el destino del clic. Estuve a punto de reportarlo como bug grave.

**No lo era.** Es una **columna GENERATED** de la base real (el stub de
pruebas ya simulaba su comportamiento: rechaza que se le escriba un valor
explícito). Existe, solo que no se ve en el código de la web.

Aun así se añadió `guideHasReference()` en `app.js`: usa el campo si la
consulta lo trae y, si no, lo deduce de `reference_blocks`. No arregla
nada roto — evita que una consulta que no seleccione esa columna deje
todas las tarjetas creyendo que no hay documentación.

Anotado porque el reflejo de "no lo calcula nadie → está roto" era
razonable y habría sido incorrecto. El stub guardaba la respuesta.

## Barra de navegación y avatares

Tres retoques pedidos, uno de ellos con un fallo de fondo.

**"Guardados" fuera de la barra de arriba.** Estaba repetido: en la barra
y en el menú de la cuenta. Se queda solo en el menú, con el **mismo icono
de marcador** que el botón de guardar de las tarjetas — antes era una
estrella, que ya significa otra cosa en esta web (la valoración).

**El color de fondo asomaba por detrás de la foto de perfil.**

Varias clases de avatar traen un `background-color` de fábrica en el CSS
(`.nav-user-avatar-lg`, por ejemplo, lleva `var(--navy)`). Al pintar el
avatar solo se ponía `background-image`, así que **el color seguía ahí
debajo** y se veía por los bordes redondeados o allí donde la imagen no
cubriera del todo.

No se podía arreglar solo en el CSS sin romper el caso sin foto, que
necesita ese color.

Ahora hay un único `avatarStyle(profile)` en `app.js`:

- **Con foto:** la imagen y `background-color: transparent`.
- **Sin foto:** el círculo del color del perfil, del mismo tamaño, con la
  inicial.

El patrón estaba **copiado en seis ficheros** (`app.js`, `activity.js`,
`guia.js`, `guide-forum.js`, `mensajes.js`, `perfil.js`) y todos tenían
el mismo fallo. Esa duplicación era la causa de que nadie lo viera: no
había un sitio donde estuviera mal, había seis donde estaba igual de mal.

### Verificación

17 comprobaciones con Playwright. La del color **mide el color calculado**
del elemento, no la regla CSS: con foto tiene que salir transparente, sin
foto el color del perfil, y en los dos casos 40×40. Además, un barrido
por todos los avatares de una página comprueba que ninguno pinta color
debajo de una foto.

Se quitó el `transparent` a propósito y saltaron 3 comprobaciones.

### Dos trampas de la prueba, anotadas

1. **La primera versión pasaba sin probar nada.** El perfil que inyectaba
   el test se *añadía* a la lista del stub en vez de sustituir al de ese
   id, así que ganaba el original y la página nunca veía los datos de
   prueba. Se vio porque la inicial que salía era la del usuario por
   defecto. Ahora el stub mezcla por id.

2. **El primer rigor check dio "TODO OK" sin haber roto nada**: el
   reemplazo que debía introducir el fallo no encajó con el texto. Un
   rigor check que pasa es una señal de alarma, no de tranquilidad —
   había que comprobar que el cambio se había aplicado antes de creerse
   el resultado.

Y un fallo real que salió del barrido posterior: `avatarStyle` se usaba
en `guia.js` y `activity.js` **sin importarlo**, lo que dejaba la página
de la guía en blanco. Se añadió una comprobación que recorre todos los
ficheros buscando ese descuido.

## Avatares y campanita

### Los colores de avatar eran todos el mismo

`user_profiles.avatar_color` existe en la base pero **no se le asignaba
nunca a nadie**, así que todo el mundo caía en el azul por defecto y las
listas de gente eran un muro de círculos idénticos.

No se ha rellenado la columna con una migración: el color se **deduce del
identificador**. Es estable (a cada persona le toca siempre el mismo), no
hay que escribir nada, y funciona desde ya para las cuentas que ya
existen.

**El hash importó más de lo esperado.** El primer intento reutilizaba
`tintIndexForKey`, que es polinómico (`h*31+c`): al aplicarle un módulo
pequeño, el resultado depende sobre todo de los últimos caracteres. Con
UUID —largos y parecidos entre sí— agrupaba a la gente en pocos colores:
**4 de 10 para 20 personas**. Con una mezcla final tipo avalancha
(FNV-1a + finalizador) sube a la media teórica.

### Y aun así seguían saliendo todos azules: dos causas

El usuario volvió a avisar de que la gente sin foto seguía teniendo el
mismo azul. Eran **dos fallos independientes**, y ninguno de los dos era
el que yo había documentado arriba.

**1. `COLORES_AVATAR[-3]` es `undefined`.** El finalizador del hash
acababa en `h ^= h >>> 16`, y en JavaScript el XOR devuelve un entero
**con signo**. Casi la mitad de las veces `h` quedaba negativo, `h % 10`
salía negativo y el índice caía fuera del array. El resultado era
`background-color: undefined`, que el navegador **descarta sin dar
error**, dejando el azul de la hoja de estilos. Medido sobre 10.000 UUID
reales: **el 44,8%**. Sumando el 10% al que le tocaba de verdad el azul
de la paleta, más de la mitad del censo salía azul. Se arregla con
`(h >>> 0) % COLORES_AVATAR.length`.

`tintIndexForKey` no tiene este fallo porque su `>>> 0` va dentro del
bucle, así que el valor ya llega sin signo al módulo.

**2. La columna de la base ganaba siempre.** `avatarStyle` hacía
`profile?.avatar_color || avatarColorForKey(...)`, con el comentario "si
alguien elige un color a mano, ese manda". Pero **nadie puede elegirlo**:
ni la web ni el admin escriben `avatar_color` en ningún sitio (se
comprobó buscando escrituras en todos los `.js` y `.html`). La columna
solo puede traer su valor por defecto, igual para todo el mundo. O sea
que esa condición no protegía ningún caso real y anulaba el reparto
entero. Ahora no se mira, y se ha quitado de los nueve `select` que la
pedían.

**Por qué la prueba anterior no lo vio.** Contaba `new Set(colores).size`
y exigía "al menos 5 colores distintos de 10". Con el 45% en `undefined`,
ese `undefined` **contaba como un color distinto más** y el recuento
cuadraba. Contar valores distintos no es comprobar que cada valor sea
válido. `test-color-avatar.mjs` ahora exige que todo resultado case con
`/^#[0-9a-f]{6}$/`, que se usen los 10 colores, que ninguno acapare más
del 14%, y mide el color **calculado** del círculo en pantalla — que es
lo único que detecta un `background-color` inválido, porque no da error:
simplemente se ignora.

Y una trampa de la propia prueba: su generador con semilla hacía
`semilla * 1103515245`, que se pasa de los 53 bits que JavaScript maneja
sin perder precisión. Repetía valores (949 distintos de 2000) y falseaba
el reparto medido —marcaba un 12,4% de sesgo donde el hash real da
10,12%—. Corregido con `Math.imul`. **Un generador roto en la prueba
parece un fallo en el código que se está probando.**

### La foto de Google

Quien entra con Google trae su foto en la sesión (`user_metadata`, con
dos nombres distintos según el proveedor). Se guarda **la primera vez que
se ve**, en `renderNavUser` y no en el onboarding: así las cuentas de
Google que se registraron **antes** de esto también la cogen, no solo las
nuevas.

Solo si no hay ya una foto propia — quien se haya subido la suya no debe
verla sustituida al volver a entrar. Y solo si la URL es `https://`.

### La campanita se quedaba con los mismos avisos

Listaba las 20 últimas notificaciones, leídas o no. Leías cinco "nuevo
comentario" y ahí seguían.

Ahora **la campanita solo enseña lo que no has leído**. Al leer una (o al
pulsar "marcar todas"), desaparece de la lista.

**No se borran de la base**: siguen ahí por si algún día hace falta un
historial. Lo que cambia es qué enseña la campanita. La prueba lo
comprueba explícitamente: la lista queda vacía **y** las filas siguen
existiendo, marcadas como leídas.

### Los mensajes NO se tocan, y es a propósito

Se revisaron y funcionan distinto porque **son otra cosa**: una lista de
conversaciones, no un buzón de avisos. Una conversación debe seguir ahí
después de leerla — lo que se limpia es el "no leído"
(`conversation_participants.last_read_at`), no la fila. Ya funcionaba
así; ahora hay una prueba que lo fija, para que a nadie (yo incluido) le
tiente "igualarlo" a la campanita.

### El umbral de una prueba, medido en vez de elegido a ojo

La comprobación del reparto de colores se puso primero en "≥7 colores
distintos para 20 personas". **Fallaba el 18% de las veces sin que nada
estuviera roto**: con 20 personas y 10 colores la media es 7,7, pero por
el problema del cumpleaños baja a 4 de vez en cuando.

Se midió sobre 5.000 muestras y se bajó a **≥5**, que da un 0,8% de falso
fallo. Una prueba que salta sin motivo es peor que no tenerla: enseña a
ignorar los fallos.

Y de paso quedó claro que el 6 que devolvía no era un hash malo, sino
azar — aunque el cambio de hash se mantiene porque el reparto sí era peor
de lo que debía.

## Los colores de avatar no llegaron a tres pantallas

El cambio anterior se dio por bueno y en la web seguía todo del mismo
azul. La causa: el patrón del avatar estaba copiado en **nueve**
ficheros y solo se arreglaron seis. Los tres que faltaban
—`usuarios.js`, `usuario.js` y `perfil.js`— son justo los del directorio
de Comunidad y los perfiles, o sea las pantallas donde más se nota.

**Cómo se me escaparon.** Busqué los ficheros con `grep ... | head -12`
y la salida se cortó antes de enseñarlos. Un recuento truncado no es un
recuento: el `head` estaba ahí para no llenar la pantalla y acabó
decidiendo qué se arreglaba.

Ahora hay una prueba que **recorre todos los `.js` del repositorio** y
falla si alguno vuelve a montar el estilo del avatar por su cuenta. No
depende de que yo busque bien.

De paso salió que dos ficheros seguían repartiendo a mano la decisión
"¿foto o color?" sobre un elemento del DOM. Se añadió `applyAvatarTo()`
para ese caso, así que ya solo hay dos funciones —una para plantillas,
otra para elementos— y ningún sitio decide por su cuenta.

## La foto de Google para las cuentas que ya existían

El código la guarda la primera vez que esa persona entra, pero eso
depende de que vuelva. `supabase-migration-avatares-google.sql` la copia
de golpe desde `auth.users.raw_user_meta_data`, que es donde Supabase
deja lo que manda el proveedor y de donde **no se copia solo** a
`user_profiles`.

No pisa a quien ya tenga foto propia, y exige `https://` — probado
contra Postgres 16 con un caso `javascript:` que se queda fuera.

Detalle de la comprobación: la consulta final marcaba como "pendiente"
justo el caso que la migración se salta a propósito, así que parecía que
no había funcionado. Se le puso el mismo filtro `https://`.

## El aro del avatar y el color de cabecera

- **Fuera el aro** del avatar del perfil: era un borde de 4 px que en
  modo oscuro se leía como un círculo raro alrededor de la foto, más
  visible desde que el color ya no se pinta debajo.
- **El selector de colores de "Editar perfil" es el de la CABECERA**, no
  el del avatar — solo se usa si no subes una imagen de cabecera. Se
  ocultaba mal: ahora no aparece si ya hay imagen, y cuando aparece lo
  dice.

## Avisos por correo

Solo dos cosas mandan correo: **un mensaje privado** y **una respuesta a
un comentario tuyo**. Es una lista corta a propósito — un correo se gana
cuando la cosa es personal, conversacional y se pierde si no la ves. Las
valoraciones, los seguidores y las guías nuevas son interesantes pero no
urgentes, y llenar la bandeja con eso es lo que hace que la gente se dé
de baja de todo, incluido lo que sí le importaba.

Piezas: `supabase-migration-correo-avisos.sql` (cola + disparadores),
`netlify/lib/email.mjs` (pintado y proveedores), `netlify/functions/
send-emails.mjs` (vacía la cola cada 5 min) y `netlify/functions/
baja-correo.mjs` (baja sin iniciar sesión).

### Los disparadores NO van sobre `user_notifications`

Que es donde parecía natural ponerlos, porque ahí ya llegan todos los
avisos. Su política de RLS es:

```sql
for insert with check (auth.uid() is not null and recipient_id <> auth.uid())
```

Cualquiera puede insertar una fila para cualquiera, **con el título y el
cuerpo que quiera**. Para la campanita eso es una molestia; colgando el
correo de ahí sería que cualquier miembro pudiera hacer que pokedoc.es
mande un correo con texto arbitrario a cualquier otro. Eso es phishing
con tu propio dominio, y quema la reputación de envío — que arrastra
también los correos de verificación y de recuperar contraseña.

Los disparadores van sobre las tablas de origen, donde la RLS ya
demuestra quién escribió qué: `private_messages` (obliga a ser
participante de la conversación) y `guide_comments` (obliga a ser el
autor). Destinatario y texto se deducen ahí.

### El agujero que abrí por el camino

Cerrada la tabla, la ataqué y **seguía entrando**: `enqueue_email` es
`SECURITY DEFINER`, y en PostgreSQL una función nueva es ejecutable por
`public` por defecto. PostgREST la exponía como RPC, así que
`set role authenticated; select enqueue_email(...)` insertaba la fila
igual. La puerta de atrás era la función, no la tabla.

Se arregla con `revoke all on function ... from public, anon,
authenticated` en las tres. Los disparadores siguen funcionando: una
función de disparador la invoca el motor y no comprueba el permiso
EXECUTE de quien hace el INSERT. Está comprobado ejecutándolo, en los dos
sentidos — que la llamada directa falla y que el disparador sigue
encolando.

La migración trae esa comprobación en su bloque final: las tres columnas
de permiso tienen que salir en `false`.

### Agrupar no es un detalle

Diez mensajes seguidos en la misma conversación son **un** correo, no
diez, y tras enviar uno de ese hilo se callan 30 minutos. Sin eso, una
conversación en directo se convierte en un correo por frase, que es
exactamente lo que provoca que te marquen como spam en vez de darte de
baja.

### Dos ejes de preferencias, no uno

`notification_prefs_disabled` (campanita) y `notification_email_disabled`
(correo) son columnas distintas. Reutilizar la primera habría sido más
corto, pero "quiero el aviso en la campanita pero no en el correo" es la
preferencia más común del mundo y con un solo array no se puede
expresar. Ese tipo de decisión duele mucho más migrarla después.

### `avatar_color` no, `email_unsubscribe_token` sí

La baja va con token en la URL, sin iniciar sesión. Obligar a entrar en
la web para dejar de recibir correo es de las cosas que hacen que la
gente le dé a "marcar como spam" en vez de a darse de baja, y eso hace
mucho más daño que perder un suscriptor. Se admiten GET (el enlace del
pie) y POST (la baja de un clic de RFC 8058, que es la que usa el botón
de Gmail). El redirect de `netlify.toml` es una reescritura 200 y no un
301 justamente por eso: un 301 convertiría ese POST en GET.

### Hostinger es un BUZÓN, no un servicio de envío

El proyecto usa el correo de Hostinger, que no tiene API HTTP: se envía
por SMTP de toda la vida. Por eso `EMAIL_PROVIDER=smtp` es el valor por
defecto y `netlify/lib/email-smtp.mjs` existe.

Eso trae la **primera y única dependencia del proyecto** (nodemailer) y,
con ella, el primer `package.json`. Va en un fichero aparte y se importa
con `await import()` solo cuando toca, para que ni las pruebas del
pintado ni los proveedores HTTP la carguen.

Dos cosas que cuestan de diagnosticar si no se avisan:

- **El puerto decide el cifrado.** El 465 va cifrado desde el primer
  byte (`secure: true`); el 587 empieza en claro y sube con STARTTLS
  (`secure: false`). Ponerlo al revés da un error de conexión que no
  menciona nada de esto.
- **El remitente tiene que ser el buzón autenticado.** Casi todos los
  servidores rechazan enviar en nombre de otra dirección con un 550
  mudo. `remitenteValido()` lo comprueba ANTES de conectar y dice qué
  poner en `EMAIL_FROM`.

Y lo que hace falta en el DNS del dominio, que es aparte del código: MX
(para recibir), SPF, DKIM y DMARC (para que lo que se envía no acabe en
spam). Sin eso, esto no sirve de nada — y arrastra también a los correos
de verificación y de recuperar contraseña.

### Una conexión por tanda, no una por correo

`sendViaSmtp` creaba su propio transporte en cada llamada, o sea un
TCP + TLS + autenticación **por cada correo**. Con 50 pendientes son 50
saludos seguidos contra el buzón, que es justo el patrón que dispara los
límites por hora de un servidor de correo normal (y además es lento).

Ahora `crearTransporteSmtp` monta uno con `pool: true` al principio de la
pasada y todos los mensajes van por ahí. `sendViaSmtp` acepta tanto un
transporte prestado como una función para crearlo, y solo cierra el que
ha abierto él. Comprobado contra el servidor de pruebas contando
conexiones: 10 correos → 1 conexión.

### La prueba de SMTP levanta un servidor SMTP de verdad

`test-correo-smtp.mjs` arranca un `smtp-server` en local y le envía. Con
un doble de nodemailer solo se comprobaría que llamo a la función con
los argumentos que yo mismo he elegido; un servidor real recibe el
mensaje **ya serializado**, así que comprueba que las cabeceras salgan,
que el multipart texto+HTML se monte y que las tildes sobrevivan.

De ahí salieron dos cosas:

- Las cabeceras van **plegadas** en varias líneas (RFC 5322), así que un
  `includes` sobre el crudo no encuentra la URL: hay que desplegarlas
  primero.
- `mailparser` no expone `list-unsubscribe` en su mapa de cabeceras. Mi
  primera aserción lo miraba ahí y decía que faltaba una cabecera que sí
  estaba. **Era la prueba la que estaba mal, no el código** — se
  comprueba contra el mensaje en crudo, que es lo que el servidor ha
  recibido de verdad.

### Lecciones de método de esta tanda

- **Un `SECURITY DEFINER` sin `revoke` es una API pública.** Cerrar la
  tabla y dar por cerrado el asunto habría dejado el agujero entero.
  Lo encontré porque probé a atacarlo, no porque lo leyera.
- **Escribir rangos de caracteres de control dentro de una expresión
  regular es frágil**: al editar el fichero se convirtieron en bytes
  literales y dejaron el módulo como binario. Filtrar por punto de código
  (`c.codePointAt(0) < 32`) se lee y no se rompe.
- Un `perl`/`python` con `s.index(...)` sobre un texto que aparece más de
  una vez machaca la ocurrencia equivocada: me borró `sanitizeHeader`
  entero y dejó `escapeHtml` con el cuerpo de otra función.

## El zoom de iOS al enfocar un campo

Safari en iOS **amplía la página entera** al enfocar un `input`,
`textarea` o `select` cuyo `font-size` sea menor de 16px. Al ampliar, la
maqueta se sale por la derecha: el usuario abría la lupa de la barra,
salía el teclado, y el botón "Buscar" y el título quedaban fuera de
pantalla.

No se puede desactivar. `user-scalable=no` lo evitaría en teoría, pero
iOS lo ignora desde hace años — a propósito, porque impedir hacer zoom
es una barrera para quien ve poco. La única solución es que el campo mida
16px o más.

**Es un problema de clase, no del buscador.** Se midieron todos los
campos de todas las páginas antes de tocar nada:

| Campo | Medía |
|---|---|
| `#navSearchInput` (sale en TODAS las páginas) | 13px |
| `.auth-input` × 4 (entrar y registrarse) | 14px |
| `#forumCommentBody`, `#wallCommentBody` | 14px |
| `#categorySelect`, `#mgTitle`, `#mgCategory`, `#mgCoverEmoji` | 14px |

Por eso el arreglo es una regla general al final de `css/style.css` y no
un retoque campo por campo: así cubre también los que se añadan mañana.

Las **dos** condiciones de la media query hacen falta, y está comprobado
rompiendo cada una por separado:

- `max-width: 900px` coge los móviles.
- `pointer: coarse` coge las tabletas, que son anchas pero amplían
  igual. Sin esta rama, los campos de `auth.html` seguían a 14px en un
  iPad en horizontal.

El `!important` es deliberado: `.auth-input { font-size: 14px }` tiene
más especificidad que un selector de etiqueta y ganaría. Esto no es una
preferencia de diseño que se pueda pisar, es una restricción de la
plataforma.

### Notas de la prueba

`test-zoom-movil.mjs` recorre nueve páginas midiendo **cada** campo, y
comprueba además que el viewport no traiga `user-scalable=no`.

Dos cosas que casi la dejan sin valor:

- Para probar la rama `pointer: coarse` hace falta `hasTouch: true` en
  Playwright. Sin eso la prueba caería en la rama del ancho y pasaría en
  verde **sin haber comprobado esa rama**.
- Mi primera comprobación de "en escritorio no cambia nada" afirmaba que
  el buscador de `/buscar` medía menos de 16px, y ya medía 17 desde
  antes: fallaba estando todo bien. Ahora mide `#navSearchInput`, que en
  móvil sube de 13 a 16 y en escritorio debe seguir en 13.

Y se comprobó que subir los campos a 16px **no crea desbordes nuevos**:
once páginas a 360px de ancho, más el buscador de la barra abierto.

## Imágenes dentro del texto de una guía

El reset global de `css/style.css` tiene `img { display: block }`, que
está bien en tarjetas y avatares (evita el hueco que deja el descendente
de la línea) pero dentro de un texto corrido **rompe la línea siempre**.

Al escribir una lista de rarezas —`<li><strong>Common</strong> <img> ·
círculo negro · …</li>`— el símbolo se iba a su propio renglón. Medido:
ese `<li>` pasaba de **28px de alto a 104px**, tres líneas para lo que es
una.

### Por qué no se arregla con una clase

Porque no se puede. El saneador (`ALLOWED_ATTR` en `richtext-editor.js`)
borra `class` y `style`, así que **no hay ninguna forma de que el autor
marque una imagen como "en línea"** al escribirla. Cualquier solución que
dependa de eso no funciona.

### La solución: que lo decida el tamaño

`.article-body img` pasa a `inline-block` con `vertical-align: middle`. A
partir de ahí no hace falta ninguna regla más:

- Un símbolo pequeño cabe al lado del texto y se queda ahí.
- Una imagen ancha no cabe en el hueco que queda, así que el navegador la
  baja sola a su propio renglón, como antes.

Y como la superficie del editor lleva `class="rte-surface article-body"`,
lo que ves al escribir es lo que sale publicado, sin duplicar nada.

Ninguna de las 13 guías publicadas usa `<img>`, así que este cambio no
podía alterar contenido existente. `test-imagenes-articulo.mjs` lo vigila
comparando contra la altura de **una línea real** en vez de contra un
número escrito a mano, y comprueba también que la imagen quede centrada
con el texto (±4px) y que una imagen ancha siga sin desbordar en móvil.

## Quién ha valorado una guía

El usuario vio aparecer una valoración, no reconoció a nadie en el hilo de
actividad y sospechó que se podía valorar sin cuenta.

**No se puede.** Se comprobó atacando las políticas reales cargadas en un
PostgreSQL: valorar sin sesión, valorar dejando el autor en blanco,
valorar firmando como otra persona, y modificar o borrar la nota de otro
— los cinco intentos rechazados. La política es
`with check (auth.uid() = reviewer_id)`, y sin sesión `auth.uid()` es
nulo, así que la comparación nunca es verdadera. Queda en
`prueba-rls-valoraciones.sql`.

*(La primera versión de ese ataque estaba mal: cambiaba de rol pero no
soltaba `request.jwt.claim.sub`, así que los casos "anónimos" seguían
siendo el usuario anterior — y por eso "anon" conseguía borrar una fila.
Volverse anónimo son DOS cosas.)*

Lo que sí faltaba era **poder mirarlo**: el resumen solo decía "5.0 · 1
valoración" y no había forma de saber de quién. Ahora ese resumen es un
botón que despliega la lista debajo: quién, su nota y cuándo.

### Por qué no va al hilo de actividad

Decisión explícita del usuario. Valorar es más delicado que comentar: si
alguien le pone 2 estrellas a una guía y eso se anuncia en Comunidad con
su nombre, deja de valorar con sinceridad. Consultarlo a propósito es
distinto de que se publique solo.

### `hide_activity` se respeta aquí también

Quien pidió no aparecer en los listados públicos sale como **"Un
usuario"**, sin enlace a su perfil. Pero **su nota sigue contando para la
media y su fila sigue apareciendo**, para que el número del resumen y las
filas de abajo cuadren siempre — un contador que no cuadra con la lista
es la clase de detalle que hace dudar de todo lo demás.

Nota de alcance: estos datos ya eran legibles por cualquiera vía la API
(`select using (true)`; la media se calcula en el navegador leyendo todas
las filas). Esto no destapa nada nuevo, pero sí lo hace visible, que
socialmente no es lo mismo.

### Dos trampas de la prueba

- **Contar `<span>` de estrellas no comprueba la nota.** Las estrellas
  vacías también son ★, solo cambia el color. La primera versión daba
  verde aunque la nota se pintara mal; ahora cuenta las encendidas de
  verdad mirando el color calculado, y verifica que a cada persona le
  corresponde SU nota (2, 3 y 5).
- El caso "sin valoraciones" tenía un `else` que pasaba siempre. Una
  prueba que no comprueba nada es peor que no tenerla, porque parece
  cobertura. Ahora usa una guía que de verdad no tiene ninguna.

## Hacer visible "escribir una guía"

Antes solo se llegaba desde dos sitios, y los dos **dentro de una
pestaña**: Comunidad → Guías de la comunidad, y perfil → Mis guías. Había
que saber que existía para encontrarlo.

Lo primero fue mirar si el problema era de fricción o de visibilidad: el
editor **solo exige un título** para guardar un borrador, y autoguarda.
O sea que llegar era el problema, no escribir.

Dos puertas nuevas:

- **En el menú de cuenta**, que está en todas las páginas y que la gente
  ya abre por otras cosas.
- **Al final de una guía**, después de valorar y antes de los
  comentarios. El momento importa: quien acaba de leerse una guía entera
  sobre un tema es justo quien puede pensar "de esto yo sé otra cosa". La
  misma frase en la home le llega a alguien que aún no sabe de qué va el
  sitio.

### Lo que NO se hizo, y por qué

**No va en la barra de navegación.** Se dejó en tres enlaces a propósito
— se quitó "Guardados" de ahí justamente para eso — y la inmensa mayoría
de las visitas vienen a leer, no a escribir. Hay una comprobación que
falla si alguien vuelve a llenarla.

**No se le enseña a quien no tiene sesión.** Pedirle que escriba una guía
antes de tener cuenta es pedirle dos cosas a la vez, y no hace ninguna.

**La invitación es deliberadamente sosa**, no un banner de colores: al
final de CADA guía, un reclamo llamativo cansa a la décima que lees.

## Fuera las reseñas de perfil; la nota pasa a ser la de tus guías

`profile_reviews` dejaba ponerle una nota de 1 a 5 **a una persona**. Se
quita, por tres motivos que se refuerzan entre sí:

1. **Duplica el muro.** Los dos son "dejar un mensaje público en el perfil
   de alguien".
2. **No se gana.** Podías puntuar a quien no habías leído nunca.
3. **Puntuar a una persona no es lo mismo que puntuar su trabajo.** Un 2
   a una guía es una crítica; un 2 a una persona es un insulto. En una
   comunidad de 20 conocidos eso genera roce, no información.

En su lugar, la estadística del perfil enseña la **media de las
valoraciones que han recibido SUS guías** (`authorRatingSummary` en
`js/guide-rating.js`). Esa se gana escribiendo, ya se estaba recogiendo,
y es la que sirve para lo único que importa aquí: decidir si te fías de
lo que escribe.

**La tabla `profile_reviews` NO se toca.** El código deja de leerla y de
escribirla, pero las filas siguen ahí y el panel de admin sigue sabiendo
mostrar los reportes antiguos de ese tipo. Borrar datos de gente por un
cambio de criterio de producto es irreversible; dejar una tabla huérfana,
no.

También se quitó `profile_rating` de `NOTIFICATION_TYPES`: era una
casilla de preferencias para un aviso que ya no puede ocurrir.

### Un `Promise.all` desalineado, casi

Al quitar la consulta de `profile_reviews` de `loadStats`, la
desestructuración quedó con **tres** variables para **dos** resultados.
Eso no da error: `approvedGuidesCount` pasa a ser `undefined` y el resto
de números salen mal en silencio. Se pilló al revisar el diff, y la
prueba lo cubre comprobando que ningún número del perfil salga como
`undefined`. Con el fallo puesto a mano, la página entera se queda en
blanco con `Cannot read properties of undefined`.

## Comentarios por página: de 10 a 20

Con 10, una guía con 12 comentarios ya se parte en dos páginas y los
**dos más nuevos** quedan en la segunda, que es la que nadie pincha —
justo lo contrario de lo que quieres en una comunidad que arranca. Con 20
y el volumen actual, casi nunca se pagina.

### Otra prueba que no comprobaba nada

La primera versión de la comprobación de `authorRatingSummary` miraba a
Ash y se conformaba con `typeof total === 'number'`. Ash no tiene notas,
así que daba verde con un 0 — habría pasado igual con la función
devolviendo siempre cero. Ahora mira a quien SÍ tiene notas y exige el
número exacto (media 4, total 1).

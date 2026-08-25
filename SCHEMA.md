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

> **Nota posterior.** Los dos "pero" de este párrafo ya no están: el
> dominio es `pokedoc.es`, y el sitemap **ya incluye las guías y las
> categorías** — lo genera una función en la petición, sin paso de
> compilación (ver *Sitemap generado en la petición*, al final del
> documento). Y las páginas públicas ya llevan etiquetas Open Graph, que
> aquí faltaban por completo (ver *Compartir un enlace: vista previa de
> verdad*).

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

## Los emojis de contenido pasan a ser iconos

El sitio ya usaba iconos SVG de trazo en la interfaz (barra de navegación,
botones, tipos de bloque). Lo que quedaba con emojis era **el contenido**:
portadas de guía, categorías, colecciones, rutas, logros y bloques de
curso. Mezclar las dos cosas se nota mucho, porque un emoji lo dibuja el
sistema operativo del que mira: el mismo `🔍` es gris y plano en Windows,
azul y redondo en un iPhone y otra cosa en Android.

### Esto NO era buscar y reemplazar

Los emojis de PokeDoc no están en el código. Son **datos**:

| Dónde | Columna |
|---|---|
| Guías | `guides.cover_emoji` |
| Categorías | `categories.emoji` |
| Colecciones | `guide_collections.emoji` |
| Rutas | `learning_paths.emoji` |
| Logros | `achievement_definitions.emoji` |
| Bloques de curso | la clave `emoji` dentro del JSON de `blocks` |

O sea que hay emojis dentro de contenido que ya escribió gente. Cambiar
los ficheros no cambia nada de eso, y migrar la base a lo bruto sería
reescribir el trabajo de otros por un cambio de estilo.

### La regla, en un solo sitio

Todo pasa por `contentIconHtml()` en `js/content-icon.js`, que mira el
valor guardado y decide, **en este orden**:

1. ¿Es el nombre de un icono nuestro (`'search'`, `'gem'`)? → ese icono.
2. ¿Es un emoji que sabemos traducir? → su icono equivalente.
3. ¿Ninguna de las dos? → **se pinta tal cual**, escapado.

El punto 3 es el importante y es deliberado. Si alguien puso un emoji que
no está en la tabla, sigue viéndose lo que puso. Nunca queda un hueco
vacío por no reconocer algo: perder contenido de otra persona sería mucho
peor que un emoji suelto. Y como pasa por `escapeHtml`, es también lo que
sigue conteniendo el XSS — la guía de prueba tiene como `cover_emoji` un
`<img onerror=...>` y se sigue viendo como texto.

Consecuencia práctica: **no hay migración SQL que ejecutar**. Lo viejo se
traduce al vuelo, lo nuevo se guarda ya como nombre de icono.

### El diccionario no es inventado

Los 61 emojis de la tabla salen de mirar lo que se usa de verdad: las
portadas de las 13 guías de la semilla, las categorías, los bloques de
curso, y los 36 del selector antiguo. Se comprobó con un barrido sobre
todos los `.sql` del repo que no quedara ninguno sin traducir.

Un caso que ilustra por qué el diccionario tiene que mirar el contenido y
no una lista genérica: el bloque `🥪` del curso del núcleo negro. Está ahí
porque una carta auténtica son varias capas pegadas "como un sándwich".
Traducirlo a comida habría sido literal y absurdo; le toca `layers`.

### La única excepción: la banderita

En la portada hay un `🇪🇸 En español`. Se queda, y es a conciencia: un
icono de un solo trazo no puede decir "España". El globo terráqueo, que
sería lo más parecido, diría justo lo contrario — "internacional". Es el
único sitio del proyecto donde el emoji lleva información que el icono
perdería. La prueba lo tiene en una lista blanca de un solo elemento, para
que si algún día se quiere quitar sea una decisión y no un descuido.

### El selector del editor

`js/emoji-picker.js` conserva su nombre y su función exportada a
propósito — lo importan los dos editores y renombrarlo por estética
habría sido tocar cuatro sitios sin ganar nada. Lo que cambia es que
ofrece 38 iconos agrupados por para qué sirven y guarda el **nombre**.

Sigue siendo un campo de texto por debajo, así que una guía guardada con
un emoji se abre en el editor mostrando ya su icono equivalente (se
entiende sin explicar nada que ese emoji ahora es ese dibujo), y quien
quiera poner algo que no esté en la lista puede escribirlo.

Detalle que solo se ve cuando lo pruebas: con emojis, cuál estaba elegido
se distinguía por el dibujo de colores. Con iconos de un solo trazo, no
hay forma de saberlo — hizo falta un `.selected` con fondo propio.

### El fallo que solo aparece al cambiar un emoji por un SVG

El botón del selector se repinta a sí mismo nada más entrar en su propio
manejador de click (por si el valor lo ha puesto otro código, como cargar
un borrador). Con un emoji dentro daba igual: al pulsar sobre un nodo de
texto, el `e.target` que llega es el propio botón.

Con un SVG dentro, `e.target` es el SVG. Y para cuando el evento sube
hasta el `document` — donde está el "si has pulsado fuera, cierra" — ese
SVG ya lo ha sustituido el repintado, así que `wrap.contains(e.target)`
da **falso**, se dispara el cierre, y el panel se abría y se cerraba en el
mismo click. El selector, sencillamente, no se abría.

La solución es `pointer-events: none` en el contenido del botón, para que
el objetivo del click sea siempre el botón. Vale la pena señalar cómo
apareció: no leyendo el código, sino haciendo que la prueba pulsara el
botón y mirara si el panel quedaba visible. Un cambio "solo de estilo" —
un carácter por un dibujo — rompió una interacción entera.

Ahora ese selector está también en los cuatro formularios de `/admin`
(categoría, colección, ruta, **logro**) y en cada bloque de curso, que
antes eran campos de texto pelados donde había que pegar un emoji a mano.

### El ciclo de importación que apareció por el camino

`content-icon.js` necesitaba `escapeHtml`, que vivía en `app.js`; y
`app.js` necesita el resolutor. Los módulos de JavaScript toleran los
ciclos porque las declaraciones de función se elevan, pero depender de esa
sutileza es frágil: basta con que alguien convierta la función en una
`const` para que deje de funcionar, y el síntoma es una página en blanco
sin explicación (ya pasó algo parecido con `avatarStyle`).

`escapeHtml` se sacó a `js/html.js` y `app.js` lo reexporta, así que los
treinta y pico ficheros que hacen `import { escapeHtml } from './app.js'`
siguen igual.

## El cursor de mano en las tarjetas de guía

Las tarjetas de guía son un `<div>` con un click encima, no un `<a>`. El
navegador no tiene forma de saberlo, así que aplicaba lo de siempre:
flecha sobre el hueco de la tarjeta y **barra de escribir sobre el título
y la descripción** — justo donde está el ratón cuando vas a pinchar, y
justo lo contrario de lo que pasa, porque seleccionar ese texto no sirve
de nada: el click abre la guía.

De las tres tarjetas clicables, dos (`.recent-card` de la home y
`.community-guide-row` del perfil) ya tenían `cursor: pointer` y la
principal (`.guide-card`, la de las listas de categoría y guardados) no.

La regla se engancha a `[role="link"]` y no a cada clase, porque ese
atributo es exactamente lo que marca "esto se comporta como un enlace":
lo llevan esas tres y nada más en todo `js/`. Si mañana aparece una
cuarta, hereda el cursor por llevar el rol correcto.

`cursor` se hereda, así que el texto de dentro lo coge solo — que es la
mitad del arreglo. Los enlaces y botones de dentro traen el suyo y siguen
mandando ellos: se comprobó que el botón de "Curso" desactivado sigue
enseñando el "no permitido".

## Ni "Gratis" ni "Pro" a la vista

La etiqueta "Gratis" en cada tarjeta de guía no informaba de nada: PokeDoc
es gratis entero. Lo único que conseguía era **sugerir que existe una
versión de pago** — nadie pone "Gratis" salvo cuando hay algo que no lo
es. Fuera, junto con todo lo demás que hablaba de planes.

### Un interruptor, no un borrado

`js/planes.js` exporta un solo `MOSTRAR_PLANES = false`. No se ha
eliminado nada: las columnas `is_pro` y `has_pro_content`, la tabla
`guide_pro_content` y el editor de contenido Pro del panel de admin siguen
donde estaban. Poniendo el interruptor a `true` vuelve todo.

Lo que apaga, en siete sitios:

| Dónde | Qué desaparece |
|---|---|
| Tarjeta de guía, home, cabecera de guía | la chapa "Gratis" / "Pro" |
| `guia.html` | la pestaña "Guía Pro" y el muro de pago |
| Perfil propio y ajeno | la chapa "Pro" junto al nombre |
| `curso.html` | el candado "Contenido Pro" |

Y de paso, la portada decía "Crear cuenta **gratis**" — mismo problema,
misma solución: ahora es "Crear cuenta".

### El candado también se quita, y es a propósito

Con el interruptor apagado, una guía marcada como Pro **se ve entera**.
Podría haberse dejado el candado puesto y quitarle solo la explicación,
pero eso es lo peor de las dos opciones: una puerta cerrada sin decir por
qué. Si el sitio es gratis, es gratis.

Efecto secundario que sale gratis: `guia.html` ya no consulta
`guide_pro_content` cuando no va a enseñarlo — una petición menos por
visita en las guías que lo tuvieran.

### La prueba no busca palabras

La primera versión escaneaba el texto de la página buscando "Pro" y
"Gratis". Mal: una guía puede llamarse "Guía con Pro anunciado" o decir
"gratis" en su cuerpo, y eso es **contenido**, no interfaz. Habría fallado
por lo que escribió alguien.

Lo que se mira son los elementos concretos: `.badge` cuyo texto sea
exactamente "Pro" o "Gratis", la clase `.badge-free`, el botón de pestaña
"Guía Pro", el `.pro-paywall` y el bloque del candado. 10 páginas × con
sesión y sin ella, porque el muro cambiaba de texto según estuvieras
dentro o fuera.

## La mascota y el pop-up de "¿Qué es PokeDoc?"

El texto anterior decía que PokeDoc era una "base de conocimiento
gamificada". Dos problemas: "gamificada" es palabra de folleto, no de
coleccionista; y no mencionaba lo único que de verdad define el sitio —
que es de la comunidad y que **cualquiera puede escribir**. El texto
nuevo lo dice en la primera frase y termina en "Crea y comparte".

### El pingüino cartero

`assets/images/mascota.png`. Llegó como PNG de 1077×1301 con casi la mitad
del lienzo vacío; recortado al contenido real queda en 523×791 y pasa de
234 KB a 115 KB. El `width`/`height` van puestos en el HTML **y**
`height: auto` en el CSS: así el navegador reserva el hueco con la
proporción correcta antes de descargar la imagen y el texto no pega un
salto al terminar de cargar.

Va con `alt=""` a propósito: es decorativa. Lo que cuenta qué es PokeDoc
es el texto de al lado, y un lector de pantalla que lea "ilustración de un
pingüino cartero" no aporta nada, solo estorba.

### El contraste en oscuro: medido, y descartado a propósito

El pingüino tiene el cuerpo y las alas **negras con contorno negro**. El
fondo del modal en tema oscuro es `#182430`, casi negro también. Medido
con la fórmula de luminancia de WCAG sobre la página real: el contraste
entre las alas y ese fondo es de **1,3:1** (en claro, 21:1).

Se probó a ponerle una chapa clara detrás, que lo subía a 18,9:1. **Se
descartó**: cantaba más de lo que arreglaba, y lo que se pierde son los
bordes de las alas, no el personaje — la cabeza, la panza y el buzón
siguen viéndose perfectamente. Decisión de producto, tomada mirando el
resultado.

La mascota va, entonces, sin fondo en los dos temas. La prueba no exige
ningún contraste mínimo, pero **sigue midiéndolo y lo imprime**: si algún
día alguien se replantea esto, tendrá el número delante en vez de
discutirlo a ojo.

## Compartir un enlace: vista previa de verdad (Open Graph)

**El problema.** WhatsApp, Twitter, Discord y Telegram **no ejecutan
JavaScript**. Cuando alguien pega `https://pokedoc.es/guia.html?slug=x`,
su robot descarga el HTML tal cual sale del servidor y lee el `<head>`.
El título y la descripción de una guía los ponía `js/guia.js` **después**,
ya en el navegador — así que el robot solo veía `Guía — PokeDoc` y la
descripción genérica. Todas las guías del sitio se veían **exactamente
iguales** al compartirlas, y encima no había ni una sola etiqueta `og:` en
todo el sitio.

**La solución, en dos capas.**

1. **Estática**: las once páginas públicas (`index`, `aprender`, `buscar`,
   `usuarios`, `terminos`, `privacidad`, `auth`, `guia`, `curso`,
   `categoria`, `usuario`) llevan un bloque de etiquetas entre marcadores:

   ```html
   <!-- meta-social:inicio -->
   ... og:title, og:description, og:image, twitter:card ...
   <!-- meta-social:fin -->
   ```

   Las páginas verdaderamente estáticas llevan además `<link
   rel="canonical">` y `og:url`. Las dinámicas **no**: sin el slug, todas
   apuntarían a la misma URL y le estaríamos diciendo a Google que una
   guía y otra son la misma página. Se las pone la Edge Function.

2. **Dinámica**: `netlify/edge-functions/meta-social.js`, registrada en
   `/guia.html`, `/curso.html`, `/categoria.html`, `/usuario.html` y
   `/usuario/*`. Se ejecuta **en el servidor, antes de entregar la
   página**: pide a Supabase los datos por el slug (o el nombre de
   usuario), y sustituye el bloque entre marcadores, el `<title>` y la
   `meta description`. El robot y la persona reciben el mismo documento;
   la persona además ejecuta el JS de siempre, que no ha cambiado.

**Por qué una Edge Function y no un paso de compilación.** El sitio es
HTML/CSS/JS a pelo, sin build. Generar una página por guía obligaría a
montar uno y a redesplegar cada vez que alguien publica algo. Esto se
resuelve en la petición y no añade ninguna pieza al proyecto.

**Regla de oro: esto no puede tumbar el sitio.** Si Supabase tarda, falla,
o devuelve algo que no es JSON, se sirve la página tal cual venía — peor
vista previa, nunca página en blanco. Hay un límite de 2,5 s
(`AbortSignal.timeout`) porque un robot de WhatsApp que espera se rinde y
no enseña nada, y una persona que espera se va. Solo se toca `text/html`
con respuesta correcta: un 404, un JSON o un recurso pasan intactos. Y se
quita el `content-length` original de las cabeceras, porque el HTML ya no
mide lo mismo y anunciar un tamaño que no cuadra corta la respuesta a
medias.

Usa la **clave publicable**, la misma que ya viaja en `js/supabase.js`:
aquí solo se leen filas públicas. La clave secreta no pinta nada.

**Detalles pensados:**

- Un perfil con avatar usa `twitter:card: summary` (tarjeta cuadrada): una
  foto cuadrada en una tarjeta panorámica sale recortada por arriba y por
  abajo. Sin avatar, tarjeta grande con la imagen de marca.
- `og:image:width/height` solo se declaran para la imagen por defecto, que
  es la única cuyas medidas conocemos. Mentir ahí hace que la red reserve
  un hueco que luego no encaja.
- Las descripciones se recortan a 180 caracteres **por un espacio**, para
  no dejar una palabra partida.
- Un título con `"` o `<script>` se escapa antes de meterlo en el
  atributo. Probado con una guía llamada `"><script>window.pwned=1</script>`.
- No se declara `cache` en la Edge Function a propósito: cachearla
  ahorraría una consulta, pero dejaría vistas previas viejas rondando
  después de editar una guía, que es justo lo que veníamos a arreglar.

### `assets/images/og-default.png`

La imagen que sale cuando la página no tiene portada propia. 1200×630 (la
medida que piden todas las redes), con el logotipo, el titular de la home,
la pastilla de "En español" y el pingüino cartero sobre el navy de la
marca. Hecha con las fuentes de verdad del sitio (Fredoka para el
logotipo, Inter para el resto), sacadas de los paquetes de `@fontsource`.

Se probó a poner detrás las tres cartas insinuadas del hero y se quitaron:
la mascota ocupa toda esa mitad, así que asomaban por los bordes como
rectángulos sueltos en vez de leerse como cartas.

## Sitemap generado en la petición

`sitemap.xml` era un fichero estático con seis URLs y un comentario que
explicaba por qué no estaban las guías. Resultado práctico: Google no
tenía forma de enterarse de que existe una guía nueva salvo rastreando
enlaces.

Ahora lo genera `netlify/functions/sitemap.mjs`, y `netlify.toml`
reescribe `/sitemap.xml` a esa función (`force = true`, para que si
alguien vuelve a añadir el fichero estático no gane silenciosamente y deje
el sitemap congelado sin que se note). **El fichero `sitemap.xml` ya no
existe en el repo.**

Lista: las seis páginas fijas + una entrada por categoría + una por guía
publicada (`published_at` no nulo), con `<lastmod>` sacado de la fecha de
publicación.

**Los perfiles de usuario NO se listan**, a propósito: la web todavía no
es pública, nadie ha pedido que su perfil salga en Google, y
`/usuarios.html` ya da acceso a todos desde dentro. El día que se quiera,
se añaden en esa función.

Si Supabase falla, devuelve **200 con las páginas fijas**, no un 500: un
sitemap que da error le dice a Google que el sitio está roto. Los slugs
van por `encodeURIComponent`, porque un `&` en un slug rompe el XML.

## Búsqueda que no distingue acentos

Migración: **`supabase-migration-busqueda-acentos.sql`** (hay que
ejecutarla a mano en el SQL Editor de Supabase; es idempotente).

**El problema.** `ilike` ignora las mayúsculas pero **no los acentos**: en
Postgres `'falsificacion'` no encuentra `'falsificación'`. En español eso
es medio buscador roto, porque nadie escribe los acentos al buscar.

Hasta ahora se esquivaba a mano: en `guides.search_content` el texto se
escribía **sin acentos** ("nucleo negro") para que el `ilike` lo pillara.
Eso funciona mientras las guías las escriba quien conoce el truco; en
cuanto las escribe la comunidad, deja de funcionar. Y obliga a que ese
campo esté mal escrito, así que tampoco vale para enseñarlo.

**La solución.** Una función `public.plegar_texto()` (quita acentos y pasa
a minúsculas) y dos columnas **generadas por Postgres**:

- `guides.search_norm` — `title` + `description` + `search_content`
- `user_profiles.search_norm` — `display_name` + `username`

Las dos son **GENERADAS**: el cliente no debe enviarlas nunca (igual que
`guides.has_reference_blocks`). Postgres las recalcula solo al guardar.
Las columnas originales no se tocan: se siguen enseñando con sus acentos.
Ambas llevan índice GIN de trigramas para que el `ilike '%algo%'` no acabe
leyendo la tabla entera.

**Por qué no búsqueda de texto completo (`to_tsvector`)**: cambiaría lo
que significa buscar. Hoy "falsi" encuentra "falsificación" porque busca
un trozo dentro de la palabra; el texto completo busca palabras enteras y
raíces, y dejaría de encontrarlo. Esto arregla los acentos sin cambiar
nada más.

**Detalle de Postgres**: una columna generada exige una función
`IMMUTABLE`, y `unaccent()` a secas es `STABLE` (depende del diccionario).
Se envuelve nombrando el diccionario explícitamente, que es la forma
habitual de dejarla inmutable de verdad. Consecuencia a tener presente: si
alguna vez se cambiara el diccionario `unaccent`, las columnas ya
calculadas no se recalcularían solas.

### El lado del navegador

- **`js/texto.js`** — `plegarTexto()` hace lo mismo que la función de
  Postgres (NFD + tirar las marcas diacríticas + minúsculas). **Los dos
  lados tienen que plegar igual**: si uno quita los acentos y el otro no,
  el buscador deja de encontrar cosas y no da ningún error que lo delate.
  `plegarConMapa()` devuelve además un mapa de posiciones, para poder
  resaltar en el texto original (con sus tildes) lo que se encontró en el
  plegado — la normalización cambia la longitud, así que las posiciones no
  coinciden por las bravas.
- **`js/busqueda.js`** — `conVueltaAtras()`. Entre que se despliega este
  código y se ejecuta la migración, la columna no existe. Sin esto el
  buscador diría "no se encontraron resultados" para todo: un fallo mudo,
  que es el peor tipo. Con esto, detecta el error `42703` de PostgREST,
  avisa por consola y **sigue buscando como antes** hasta que la migración
  esté puesta. Cuando lleve tiempo hecha, se puede quitar.
- **`js/search.js`** — busca contra `search_norm` (una sola columna: ya
  junta título, descripción y texto) y resalta usando el mapa. El `select`
  pasa a ser de columnas contadas en vez de `*`: `search_norm` repite el
  texto entero de la guía, y traerlo veinte veces por búsqueda para no
  usarlo es regalar megas al que busca desde el móvil.
- **`js/mensajes.js`** — buscar a quién escribirle, también contra
  `search_norm`.
- **`js/usuarios.js`** — los dos filtros del directorio se hacen sobre una
  lista ya cargada, así que ahí el plegado se hace en el navegador.

### Cómo se ha probado

- **La migración, contra un PostgreSQL 16 de verdad** con `unaccent` y
  `pg_trgm`: las columnas se calculan solas, `'falsificacion'` encuentra
  la guía acentuada, `'jesus'` encuentra a "Jesús", `'nino'` encuentra a
  "Niño", intentar escribir `search_norm` da error (es generada), y
  ejecutarla dos veces no rompe nada. También con las extensiones
  instaladas en `public` en vez de en `extensions`, por si el proyecto es
  antiguo.
- **La Edge Function y el sitemap, en Node** (`test-og-sitemap.mjs`, 72
  comprobaciones), con `fetch` sustituido por un Supabase de mentira y
  sirviendo los HTML de verdad del repo: incluye Supabase caído, lento,
  devolviendo 500 y devolviendo basura, un título con `<script>`, un `&`
  en un slug, y que el XML lo acepte un analizador de verdad.
- **La búsqueda, con Playwright** (`test-busqueda-acentos.mjs`) contra la
  copia de pruebas, cuyo Supabase de mentira calcula `search_norm` igual
  que la columna generada y sabe fingir el error `42703` para probar el
  hueco sin migrar.
- **Comprobación de rigor** en las dos: se deshace cada arreglo uno por
  uno (no escapar el título, añadir etiquetas en vez de sustituirlas,
  quitar el try/catch, quitar el límite de tiempo, no codificar el slug,
  plegar solo a minúsculas, quitar la vuelta atrás, resaltar sin traducir
  posiciones...) y se exige que la prueba se ponga en rojo **por lo que
  tiene que ponerse**. Si sigue en verde, esa comprobación no vale.

### Agujero que salió al revisar esto: el artículo no era buscable

Al comprobar si todo lo anterior valía también para el contenido nuevo
apareció un fallo anterior a todo esto: **el editor de la comunidad nunca
rellenaba `search_content`**.

El buscador busca en `search_content`, no dentro de `reference_blocks`
(que es JSON, y Postgres no lo recorre con un `ilike`). Como el editor de
usuario no tiene campo para eso — ni debe tenerlo, nadie va a escribir a
mano una copia en plano de su propio artículo —, de una guía escrita por
la comunidad solo se podían encontrar **el título y la descripción**. El
artículo entero era invisible.

Arreglado en los dos editores, con `flattenReferenceBlocksToText()`, que
ya existía:

- **`js/editor-guia.js`** (comunidad): siempre lo deduce del texto de la
  guía al guardar.
- **`admin/js/editor-guia.js`**: el campo manual sigue mandando cuando
  está relleno (a veces interesa afinar qué encuentra el buscador), pero
  si se deja vacío se deduce igual.

Como `search_norm` es una columna generada, en cuanto se guarda la guía
Postgres recalcula solo el texto plegado. No hay nada que ejecutar.

**Para las guías que ya existen**: las antiguas tienen `search_content`
escrito a mano y **sin acentos**, que era el truco de antes. Siguen
encontrándose, pero el fragmento que se enseña en los resultados sale sin
tildes. Si se quiere arreglar, basta con abrir cada guía en el editor de
admin, **vaciar el campo "Contenido de búsqueda"** y guardar: se vuelve a
deducir del artículo, esta vez bien escrito.

Probado escribiendo una guía de verdad en los dos editores y mirando qué
se guardó (no lo que dice el código): el texto entra, sin etiquetas HTML,
y plegado contiene "campeon" cuando el artículo dice "campeón". Y con el
campo de admin relleno, no se le pega el texto del artículo. Rigor:
deshaciendo cada uno de los dos arreglos la prueba se pone en rojo.

## El editor de guías: formato, imágenes y cartas

Cuatro cosas que faltaban o estaban mal, y el saneador nuevo que hace
falta para que todas ellas se puedan guardar sin abrir un agujero.

### `js/richtext-format.js` — qué se puede guardar

Antes, lo único que sobrevivía al guardar eran unas pocas etiquetas sin
ningún atributo: ni `class` ni `style`. Eso hacía imposible cualquier cosa
que no fuera negrita o cursiva.

**Por qué clases y no estilos.** Un editor con colores necesita guardar
"este trozo va en rojo". Lo fácil sería dejar pasar `style`, pero eso es
dejar pasar CSS arbitrario dentro de la página de otra persona:
posicionamiento encima de otras cosas, fondos que llaman a una URL
externa, texto invisible. Así que el color se guarda como una **clase de
una lista cerrada** (`rt-c-rojo`, `rt-h-amarillo`, `rt-al-c`,
`rt-fig-d`...), y el navegador puede escribir lo que quiera mientras
edita: al guardar se traduce a la clase y el `style` se tira.

La **única** excepción es la anchura de una imagen o de una lista de
cartas, y no se filtra: se descarta lo que venía y **se vuelve a
escribir** a partir de un número entre 10 y 100, así que no hay cadena
que colar. Una anchura del 2% sube a 10, una del 900% baja a 100, y un
`calc(...)` se tira entero.

El saneador además:

- Traduce `<font color>` (que generan algunos navegadores) y
  `style="color:…"` a la clase de la paleta. Un color que **no** está en
  la paleta se descarta.
- Traduce **el formato escrito como estilo a etiquetas**:
  `<span style="font-weight:700">` → `<strong>`, `font-style:italic` →
  `<em>`, `line-through` → `<s>`. Esto pasa por dos caminos y los dos son
  normales: `execCommand` con `styleWithCSS` encendido, y **pegar desde
  Word o Google Docs**. Sin esta traducción el formato se veía mientras
  escribías y desaparecía al guardar.
- Convierte `<div>` en `<p>` en vez de deshacerlo. Algunos navegadores
  usan `<div>` como separador de párrafo al pulsar Enter: deshacerlo
  pegaría todo el texto del artículo en un solo bloque.
- Le pone `target="_blank" rel="noopener noreferrer"` a los enlaces
  externos, y deja los internos en la misma pestaña.
- Quita los pies de foto vacíos, los `<span>` que no dicen nada y los
  `width="320"` en píxeles que deja Firefox al redimensionar por su
  cuenta.

Se llama en **dos** sitios, a propósito: al guardar (desde el editor) y al
pintar la guía publicada. Un autor puede escribir su fila de `guides`
directamente por la API saltándose el editor, así que sanear solo al
guardar no bastaría.

### La barra de herramientas

Lo que había: negrita, cursiva, subrayado, H2, H3, párrafo, dos listas y
enlace. Lo que hay ahora, agrupado con separadores: **tachado**, **color
de texto** (7 colores) y **resaltado** (4) en paletas desplegables,
**limpiar formato**, **cita**, **alineación** (izquierda/centro/derecha)
y **quitar enlace**.

`styleWithCSS` se enciende **solo** para la alineación y los colores. Con
él encendido para todo, la negrita se guardaba como
`<span style="font-weight:bold">` y el saneador la tiraba.

El enlace, además: si no hay nada seleccionado, antes no pasaba
absolutamente nada; ahora escribe la propia dirección y la enlaza. Y si
lo seleccionado ya parece una URL, se ofrece como sugerencia.

### Los enlaces se ven

El reset global pone `a { color: inherit; text-decoration: none }`, que
está bien en tarjetas y botones, pero dentro de un artículo dejaba los
enlaces **exactamente iguales que el resto del texto**: no había nada que
dijera que ahí había un enlace. Ahora van en color de marca y subrayados,
en el editor y en la guía publicada. En tema oscuro `--navy` ya es un azul
claro, así que la misma regla vale para los dos.

### Imágenes: tamaño, colocación y pie de foto

Al pinchar una imagen (o una lista de cartas) aparece **una segunda fila
en la barra de herramientas** con: un **deslizador de anchura** (10–100%)
más atajos de 25/50/100, **alineación** —izquierda y derecha hacen que el
texto la rodee, como en Word—, **pie de foto**, **subir/bajar** y
**quitar**.

Está en la barra y no flotando sobre la imagen a propósito: la barra es
pegajosa, así que no se va de sitio al hacer scroll, no tapa lo que estás
mirando y en el móvil se llega a ella igual. Un tirador en la esquina
sería más "de Word", pero en un móvil no hay forma de agarrarlo.

La imagen se envuelve en `<figure>` **la primera vez que se le toca algo**,
no al insertarla: hay guías que usan imágenes pequeñas como símbolos
dentro de una frase (⚪ de rareza, por ejemplo), y envolverlas las sacaría
de la línea.

En pantallas estrechas las figuras flotadas pasan a ancho completo: al 30%
en un móvil el texto quedaba en columnas de dos palabras.

### Las cartas se insertan donde está el cursor

Era el fallo más molesto: `openCardPicker()` añadía la lista **al final
del artículo**, siempre, sin forma de moverla.

La causa: pulsar un botón de la barra saca el foco de la superficie y
borra la selección, así que cuando se cerraba el selector ya no había
ningún sitio "donde estabas". Ahora se recuerda el cursor
(`selectionchange`) y la lista se inserta **justo debajo del párrafo donde
estaba**. Y se le puede cambiar el tamaño y moverla con la misma barra que
las imágenes.

### Una superficie vacía arranca con un párrafo

Sin esto, lo primero que escribías quedaba como texto suelto colgando de
la superficie, sin `<p>` alrededor. Se ve igual, pero no es un bloque: no
se puede alinear, y "subir/bajar" una imagen no tiene contra qué
intercambiarla. El primer párrafo del artículo se comportaba distinto a
todos los demás.

Como contrapartida hay que distinguir "vacío" de "un párrafo vacío": si
no, una guía sin escribir contaría como escrita y se podría enviar a
revisión. Al guardar, una superficie sin texto y sin imágenes emite
cadena vacía.

### Cómo se ha probado

`test-editor-formato.mjs`, en tres capas, porque cada una se rompe sola:

1. **El saneador**, llamándolo directamente con 26 casos: colores dentro
   y fuera de la paleta, `<font>`, formato pegado desde Word, `style` con
   `position:fixed` y `url()` externa, clases del sitio inyectadas,
   `data-*` ajenos, `<script>`, `onerror`, `javascript:` en un enlace,
   anchuras absurdas, `<div>`, pies vacíos, listas de cartas.
2. **El editor**, escribiendo de verdad con teclado y ratón en la página
   real: subir una imagen por el input de fichero, cambiarle la anchura y
   **medir que ocupa la mitad de verdad**, ponerle pie, moverla, borrarla;
   abrir el selector de cartas, buscar, elegir y comprobar **en qué
   posición** cae la lista.
3. **La guía publicada**, comprobando lo que se VE: que el enlace esté
   subrayado y de otro color que el texto (en los dos temas), que una
   figura al 40% mida el 40% del artículo, que el pie salga, que el rojo
   sea rojo y el resaltado tenga fondo.

**Aviso sobre DOMPurify**: en la copia de pruebas es un sustituto
(jsdelivr no es alcanzable desde el entorno de desarrollo). Se reescribió
para que respete la configuración que se le pasa — el anterior tenía la
lista de etiquetas escrita a mano y ni siquiera dejaba pasar `<tcg-deck>`,
así que las pruebas del contenido estaban midiendo el stub. Aun así, sirve
para comprobar la lógica **nuestra**, no la solidez de DOMPurify, que es
el que corre en producción.

**Rigor**: se deshace cada arreglo uno por uno (dejar pasar el `style`, no
filtrar las clases, no traducir el formato pegado, deshacer los `<div>`,
volver a soltar las cartas al final, quitar el párrafo semilla, que el
botón de anchura no haga nada, dejar los enlaces sin subrayar) y se exige
que la prueba se ponga en rojo **por lo que tiene que ponerse**.

## Recompensar a quien escribe guías (tanda 1)

Migración: **`supabase-migration-recompensas-autor.sql`** (hay que
ejecutarla a mano en el SQL Editor; es idempotente).

**El problema.** `guides.view_count` se llevaba incrementando en cada
visita desde siempre… y no se enseñaba en ningún sitio. El autor no sabía
si su guía la habían leído 3 personas o 300, ni cuánta gente la había
guardado, ni si alguien la había comentado. Se ganaba XP una vez, al
aprobarla, y a partir de ahí silencio. Eso es lo que hace que nadie
escriba la segunda.

### `guide_helpful` — "me ha servido"

Un clic, sin escribir. Es distinto de las estrellas **a propósito**: una
valoración es un juicio ("te pongo un 4"), cuesta pensarla, y mucha gente
no la deja porque no se ve con derecho a puntuar a nadie. Esto no juzga:
dice gracias. Y es el número que de verdad quiere ver quien escribe.

Clave primaria `(guide_id, user_id)`: una persona agradece una guía una
vez. RLS: el recuento es público, solo puedes agradecer en tu nombre, y
**no puedes agradecer tu propia guía** (aplaudirse a uno mismo no es
señal de nada). El autor sí ve el número — es justo el dato que le
interesa —, pero sin botón.

Con cero agradecimientos no se enseña un "0" pelado: un contador a cero
en una guía recién publicada desanima más que no poner nada.

### `guide_author_stats()` — cómo va mi guía

Lecturas, lectores identificados, guardados, comentarios,
agradecimientos, valoraciones y nota media, de una sola consulta, en el
panel "Mis guías" del perfil.

Va como **SECURITY DEFINER** por una razón concreta: los guardados viven
en `user_profiles.saved_guides` (un array por persona), así que contarlos
obliga a recorrer la tabla de perfiles entera — con los permisos de quien
llama eso sería, además de lento, una forma rara de pasearse por los
datos de los demás. Aquí dentro se cuenta y se devuelve solo el número. Y
como es SECURITY DEFINER, **lo primero que hace es comprobar que quien
pregunta es el autor** (o un admin).

Misma idea que con el contador: si una guía publicada no tiene todavía
ningún movimiento, en vez de "0 lecturas · 0 guardados" pone *"Publicada
hace poco — todavía no ha pasado nada por aquí"*.

### XP al autor por ser leído y por ser útil

+2 XP por cada lectura, +5 por cada agradecimiento, con **disparadores de
Postgres**.

**Por qué en la base y no en el navegador**: el XP del resto de la web lo
suma el cliente (lee `total_xp` y escribe `total_xp + n`). Para el XP
propio eso ya es flojo; para el XP que te dan **otros** sería regalado —
bastaría con llamar a la API a mano. Aquí lo suma Postgres cuando ocurre
el hecho.

**No hace falta un tope diario**: el tope natural es más fuerte. Una
persona solo puede marcar una guía como leída una vez (índice único de
`user_progress`) y solo puede agradecerla una vez (clave primaria de
`guide_helpful`). Para inflar el contador harían falta cuentas nuevas, no
clics. Y el XP **no se resta** al retirar un agradecimiento: quitarle
puntos a alguien por algo que hizo otro se vive como un castigo.

### El rango de colaborador, donde te lee la gente

`js/contributor-badge.js`. El rango ("Colaborador", "Leyenda de la
comunidad") solo se veía entrando a un perfil, y casi nadie entra a un
perfil. Ahora sale **junto al nombre en la guía y en cada comentario**:
las dos pantallas donde a alguien lo lee gente que no lo conoce.

Con 0 guías aprobadas no se pone nada — "Miembro" al lado de cada nombre
no dice nada y ensucia todas las líneas. Los recuentos se piden **todos
de una vez** por página y se recuerdan: una consulta por comentario sería
una barbaridad en un hilo largo.

### Cómo se ha probado

- **La migración, contra PostgreSQL 16 de verdad**, imitando lo justo de
  Supabase (`auth.uid()`, `is_admin()`): que la lectura suma +2 una sola
  vez aunque la fila se vuelva a tocar, que el agradecimiento suma +5,
  que agradecer dos veces lo rechaza la base, que una guía **sin autor**
  (las oficiales) no rompe el disparador, que el autor leyéndose a sí
  mismo no se da XP, y que las estadísticas devuelven 0 filas a quien no
  es el autor.
- **Las políticas RLS, dejando de ser superusuario** (si no, no se
  aplican): agradecer en nombre de otro → prohibido; agradecer tu propia
  guía → prohibido; agradecer la de otro → permitido; borrar el
  agradecimiento ajeno → prohibido; el tuyo → permitido.
- **La web, con Playwright**: el botón, el contador, que queda guardado
  de verdad, que **se avisa al autor**, que el autor no tiene botón pero
  sí número, que sin cuenta se invita a entrar en vez de tragarse el
  clic, los números en el perfil, y la chapita de rango en la guía y en
  los comentarios.
- **Y una comprobación al revés**: que el navegador **no** le suma XP al
  autor. Si algún día alguien lo "arregla" sumándolo desde el cliente,
  esa comprobación se pone en rojo.

### Dos agujeros del Supabase de mentira que salieron aquí

1. **No existía la tabla `user_notifications`**, así que todos los avisos
   que creaba la web en las pruebas se escribían en el vacío y ninguna
   prueba lo notaba.
2. **No existía el modo "sin sesión"**. Las pruebas que decían
   `(sin sesión)` simplemente no ponían `window.__FAKE_SESSION__`, y eso
   daba `admin-1`: comprobaban lo contrario de lo que decía su nombre.
   Ahora `'none'` hace que `auth.getSession()` devuelva null de verdad.

## Peticiones de guías (tanda 2)

Migración: **`supabase-migration-peticiones-guias.sql`** (hay que
ejecutarla a mano; es idempotente).

**La pregunta que bloquea a la mayoría** no es "¿me apetece escribir?",
es **"¿de qué escribo?"**. Alguien que sabe mucho de un tema no se pone a
escribir porque no sabe si le interesa a alguien.

Esto es una lista donde cualquiera pide un tema y los demás lo votan.
Quien se anima ve **cuánta gente lo está esperando** antes de empezar, y
al publicarla avisa de un clic a todos los que la pidieron.

**No es un foro**, y la diferencia importa: no hay conversación, ni
respuestas, ni temas sueltos. Es una lista de necesidades. Un foro habría
que moderarlo; esto se ordena solo — o se vota, o no.

### Dónde vive

Una **pestaña dentro de Comunidad** (`usuarios.html`), no una página
nueva en el menú. Con veinte personas, una entrada más en la barra que
lleva a una lista vacía canta mucho; ahí dentro convive con lo demás. Se
carga solo al abrir la pestaña, como la de Actividad.

Se llega también desde el panel "Mis guías" del perfil cuando está vacío
(*"¿No sabes de qué? Mira lo que está pidiendo la gente"*), con
`#peticiones` — que abre esa pestaña al llegar. Ese es el sitio exacto:
quien mira ese panel vacío es justo quien se ha planteado escribir algo y
no sabe de qué.

### Tablas y permisos

`guide_requests` (título, detalle, quién la pide, guía que la cumple) y
`guide_request_votes` (uno por persona y petición). Más una vista,
`guide_requests_con_votos`, que trae **el recuento ya hecho**: sin ella
habría que traerse todos los votos al navegador para contarlos.

La política interesante es la de marcar una petición como cumplida.
Pueden hacerlo quien la pidió, un admin, **y quien haya escrito la guía**
— ese último caso es el que hace que funcione: el que se anima marca él
mismo la petición y así avisa a los que la estaban esperando. El
`with check` impide apuntarse la guía de otro: solo se puede enlazar una
guía de la que eres autor.

### El puente entre pedir y escribir

"Escribir esta guía" abre el editor **con el título ya puesto** y un
aviso de que viene de una petición. Empezar con la página en blanco es
justo lo que frena a la gente.

### Cómo se ha probado

- **Los permisos, contra PostgreSQL 16 de verdad** y dejando de ser
  superusuario (si no, RLS no se aplica): pedir en nombre de otro →
  prohibido; votar dos veces → lo corta la clave primaria; marcar
  cumplida con **tu** guía → permitido; **apuntarse la guía de otro** →
  la base lo rechaza; borrar la petición de otro → prohibido. Y que la
  vista devuelve los votos contados.
- **La pantalla, con Playwright**: el orden por votos, votar y desvotar
  (y que quede guardado), pedir una guía, que lo ya escrito no se pueda
  votar, que el editor arranque con el título, que "Ya la he escrito"
  avise **a quien la pidió y a los que la votaron sin duplicar**, que sin
  cuenta se pueda mirar pero votar invite a entrar, y que "Retirar" solo
  salga en la tuya.

## Retoques: formularios, memoria de pestaña y carga

### Los campos de formulario tenían la forma que les daba el navegador

`css/style.css` solo les heredaba la tipografía. Un campo sin clase propia
salía como un rectángulo de sistema, con esquinas vivas y borde gris —
justo al lado del recuadro de comentarios de una guía, que sí está
redondeado. Ahora hay una regla base para todos: mismo redondeo, borde,
relleno y foco.

**El fondo se queda blanco también en tema oscuro**, a propósito y por
petición expresa: es como está el recuadro de comentarios y es la
referencia que se quería. Por eso son valores fijos y no `var(--white)`,
que en oscuro se volvería oscuro.

Los tipos se listan uno a uno (`text`, `email`, `password`…) en vez de
usar `input` a secas, que también pillaría casillas, botones de radio,
deslizadores y selectores de fichero.

La prueba no comprueba números escritos a mano: **mide el recuadro de
comentarios de una guía de verdad y compara**. Lo que se pedía era "que se
parezca a ese", no "que tenga 7px de radio".

### La pestaña abierta se recuerda

Abrías Usuarios en Comunidad, recargabas, y volvías a Guías de la
comunidad. Ahora la pestaña va en el ancla de la dirección
(`#peticiones`), así que recargar te deja donde estabas, el botón de atrás
funciona y se puede pasar el enlace de una pestaña concreta.

Se usa `replaceState` y no `pushState`: si cada clic dejara una entrada en
el historial, salir de la página a base de "atrás" obligaría a recorrer
todas las pestañas que hubieras mirado.

### Por qué cargaba lento

Dos cosas, y la segunda era la gorda.

**1. Los iconos de la barra se pedían en fila.** `renderNavbar` tenía un
`await` por icono: hasta que no bajaba y se ejecutaba el módulo de la lupa
no empezaba a pedirse el del tema, y así hasta la campana. Por eso
aparecían de izquierda a derecha y la campana siempre la última. Ahora se
descargan **a la vez** y se pintan en orden — el orden hay que forzarlo,
porque cada módulo se mete solo en la barra al terminar y si no los
iconos saldrían en el orden en que acabara de bajar cada uno, distinto en
cada carga.

**2. El SDK de Supabase se pedía a cdn.jsdelivr.net en cada carga.** Eso
significaba resolver un dominio nuevo, negociar TLS con él y bajar un
módulo que a su vez pedía más módulos encadenados, **antes de poder mirar
siquiera si había sesión iniciada**. Era lo primero de la cadena y lo
bloqueaba todo. Lo mismo con DOMPurify en las páginas de guía y editor.

Ahora los dos van empaquetados en `js/vendor/` y se sirven desde el propio
sitio. Tres cosas mejoran de golpe:

- Se acaba el viaje a un tercero antes de arrancar.
- **Se acaba un punto único de fallo**: hasta ahora, si jsdelivr estaba
  caído o bloqueado, PokeDoc no cargaba. Nada.
- Se acaba la dependencia sin fijar: se pedía "la última versión", que
  podía cambiar bajo los pies sin avisar. Ahora la versión está escrita en
  el fichero y solo cambia cuando se regenera a mano (las instrucciones
  están en la cabecera de cada uno).

`netlify.toml` les da caché de un año, al contrario que el resto de `/js/*`
(que se revalida en cada carga): son librerías que solo cambian cuando se
regeneran, y revalidar 210 KB en cada visita no tiene sentido.

**Efecto secundario bueno**: la copia de pruebas ya usa **DOMPurify de
verdad**. Antes había que sustituirlo por un remedo escrito a mano
(jsdelivr no es alcanzable desde el entorno de desarrollo), así que las
pruebas del saneador estaban midiendo el remedo.

**Y el menú de cuenta** ya no espera a una consulta para desplegarse: se
pinta al momento con lo que ya se sabe y el recuento de guías aprobadas se
rellena cuando llega.

### Un fallo real que salió al hacerlo

Al paralelizar los iconos puse un `try/catch` normal alrededor de unas
funciones `async`. Eso **no** atrapa una promesa rechazada: se convierte
en un error suelto de la página. Lo destapó la prueba, porque la campanita
fallaba (el Supabase de mentira no implementaba `.is()`, que es como pide
los avisos sin leer). Arreglado lo uno y lo otro — y ese fallo de la
campana llevaba ahí desde siempre, tapado por un `.catch()` del arranque.

### Pedir una guía sale en Actividad

El hilo de la comunidad contaba guías publicadas, comentarios, cursos y
altas. Pedir una guía también es actividad — de hecho es de las cosas más
baratas de hacer y de las que más ganas dan de entrar a ver qué han
pedido.

## Sugerir correcciones a la guía de otro (tanda 3)

Migración: **`supabase-migration-sugerencias.sql`** (hay que ejecutarla a
mano; es idempotente).

**Escribir una guía entera es un salto muy grande. Ver una errata no.**
Un dato que ya no es cierto, una explicación que no se entiende, un enlace
roto — eso lo puede detectar cualquiera desde el primer día, y es la única
forma de aportar que tiene quien todavía no se ve capaz de escribir nada.

Y arregla otra cosa distinta: **las guías envejecen**. El TCG cambia,
salen sets nuevos, y una guía escrita hace un año se queda coja sin que su
autor se entere. Quien lo nota es quien la está leyendo.

### Aceptar no edita nada

Esta es la decisión de diseño que sostiene todo lo demás. Aceptar una
sugerencia **no toca el texto de la guía**: quiere decir *"tienes razón y
ya lo he arreglado"*, y **acredita a quien avisó**. Por eso el botón dice
"Aceptar" y no "Aplicar".

Meterle mano al texto de otro automáticamente sería una wiki, que es otra
cosa y bastante peor para esto: nadie publicaría una guía sabiendo que
cualquiera se la puede reescribir. Así el autor sigue siendo el autor y
quien avisó se lleva el crédito, que era lo que se buscaba.

### `guide_suggestions`

| columna | para qué |
| --- | --- |
| `guide_id` | la guía |
| `author_id` | quien la sugiere (`on delete set null`: el crédito sobrevive a la baja) |
| `quote` | el trozo al que se refiere, copiado a mano. Opcional |
| `body` | qué está mal y qué debería decir |
| `status` | `pending` / `accepted` / `rejected` |
| `resolved_at` | cuándo se resolvió |

**Quién ve qué** es la política que más importa:

- Las **aceptadas son públicas**. Tienen que serlo: *son* el crédito, y
  sin poder leerlas no habría forma de pintar el "Con correcciones de…"
  bajo la firma.
- Las **pendientes y las rechazadas** solo las ven el autor de la guía,
  quien las escribió y los admins. Una lista pública de "fallos de esta
  guía" sería una picota — con eso nadie publica nada.

El resto:

- **Insert**: en tu nombre, y `auth.uid() is distinct from` el autor de la
  guía. Sugerirte correcciones a ti mismo no tiene sentido: edita la guía.
- **Update**: solo el autor de la guía (o un admin). Quien la sugirió
  **no** puede cambiarle el estado a la suya; si pudiera, cualquiera se
  acreditaría solo.
- **Delete**: la tuya, y solo mientras siga `pending`. Retirar una ya
  aceptada sería borrar un crédito que el autor ya ha reconocido.

### El XP lo da un disparador, no el navegador

`xp_por_sugerencia_aceptada()` da **+10 XP a quien sugirió, solo al pasar
a `accepted`, y solo la primera vez** (`old.status <> 'accepted'`). Por lo
mismo que el resto del XP que conceden otros: quien lo concede es el autor
de la guía, así que no puede depender del navegador de quien lo recibe.

Y solo al aceptarla: si diera XP al enviarla, esto se llenaría en dos días
de "buena guía :)".

### Dónde se ve

- **En la guía** (`js/guia.js`): la línea de créditos bajo la firma, y el
  botón *"¿Ves algo que no está bien?"* con un formulario en línea (trozo
  citado opcional + qué está mal). Al autor no le sale el botón. A quien
  no ha entrado le sale, pero al pulsarlo se le invita a entrar — es mejor
  que esconderlo, porque así se ve que la web acepta correcciones.
- **En el perfil** (`js/perfil.js`): cada guía propia con correcciones
  esperando lleva una chapa con el número, y al pulsarla se abre la lista
  con *Aceptar* / *Descartar*.
- **Solo se avisa al aceptar.** Un "te han rechazado la corrección" no le
  sirve a nadie y quita las ganas de volver a avisar.

## La guía destacada de la portada

**La elige una persona desde `/admin`, no un algoritmo.** Es la
recompensa más alta que se le puede dar a quien escribe: alguien ha leído
su guía y ha decidido ponerla en la portada, con una nota escrita a mano
diciendo por qué.

Un ranking automático por visitas premia lo que ya es popular; esto premia
lo que está bien hecho, que no es lo mismo — y con veinte personas, lo
automático se nota vacío enseguida.

Se guarda en **`home_config`**, la fila única que ya existía y que no
usaba nadie: leerla es público, escribirla solo un admin. Va dentro de
`blocks.destacada` (`{ guide_id, nota }`) para no añadir columnas a una
tabla que quizá algún día sirva para más cosas.

**Si no hay ninguna elegida, la sección no existe.** No hay hueco, ni
"próximamente", ni una guía puesta al azar para rellenar.

### Cómo se ha probado

- **Los permisos, contra PostgreSQL 16 de verdad** y dejando de ser
  superusuario (si no, RLS no se aplica): el autor no puede sugerirse en
  su propia guía; un desconocido no ve una pendiente; quien la sugirió no
  puede aceptársela; aceptarla da +10 XP **una sola vez**; una vez
  aceptada pasa a ser pública; y quien la sugirió ya no puede retirarla.
- **La pantalla, con Playwright**: que el crédito solo salga con las
  aceptadas, que a la autora no le salga el botón (pero sí los créditos),
  que sin cuenta se invite a entrar, que una sugerencia vacía no se envíe,
  que se avise al autor al enviarla y a quien la sugirió al aceptarla,
  que **el navegador no toque el XP**, y que la destacada se guarde desde
  el admin, salga en la portada con su nota y su autor, y que sin elegir
  ninguna no quede un hueco.
- **Y el rigor**: `rigor-tanda3.mjs` rompe a propósito cada una de esas
  diez cosas y exige que la prueba se ponga roja **por ese motivo** y no
  por otro.

### La barra de pestañas ya no arrastra la página en el móvil

Comunidad tiene cuatro pestañas desde que existen las peticiones, y a
360 px no caben. `.tabs` era un `flex` sin `wrap` ni desplazamiento, así
que lo que se desplazaba de lado era **la página entera** (396 px de
ancho en una pantalla de 360). Ahora la fila se desplaza sola, con la
barra escondida y las pestañas sin partir (`white-space: nowrap`).

### Cuatro agujeros del banco de pruebas que salieron aquí

El rigor sirvió para lo de siempre y para una cosa más: **una de las diez
roturas no ponía la prueba en rojo**. Repartir el XP desde el navegador
—que es justo lo que no se debe hacer— seguía en verde. El motivo no
estaba en el código:

1. **El Supabase de mentira devolvía copias** de las filas de `guides` y
   `user_profiles` (les añadía `search_norm` con un `map`). Cualquier
   `.update()` sobre esas dos tablas se aplicaba al clon y **se perdía sin
   dar error**. Eso deja sin valor toda prueba de guardar un perfil,
   publicar una guía o banear a alguien.
2. **`.order()` y `.limit()` no hacían nada.** El orden lo daba la
   casualidad del orden de inserción, así que ni "lo más nuevo primero"
   ni "lo más votado arriba" estaban comprobados. Al implementarlos salió
   que el desplegable de mensajes enseñaba el mensaje **más viejo** de la
   conversación en la copia de pruebas.
3. **`.or()` se dejaba por el camino los filtros `is null`** al encadenar.
4. Faltaban semillas enteras (mensajería, un aviso sin leer), y por eso
   tres pruebas antiguas llevaban tiempo sin llegar ni a arrancar — y otra
   comprobaba el interruptor de privacidad de Actividad **usando un gancho
   que el falso ya no entendía**, o sea sin comprobar nada.

Ninguno era un fallo de la web, pero los cuatro hacían que las pruebas
midieran menos de lo que parecía.

## El foro

Migración: **`supabase-migration-foro.sql`** (hay que ejecutarla a mano;
es idempotente).

**Las guías son un motivo para entrar una vez. El foro es un motivo para
entrar todos los días**, aunque no haya nada nuevo publicado. Es lo único
que mantiene viva una comunidad pequeña entre guía y guía.

La forma es la de un foro clásico —secciones › foros › (subforos) › temas
› mensajes— y está copiada a propósito: es una estructura que la gente ya
sabe leer sin que nadie se la explique.

### Lo que NO se ha copiado es el tamaño

El foro de referencia (Whack a Hack) tiene 22.000 miembros y 335.000
mensajes; con eso, veinte foros están todos vivos. Aquí somos veinte
personas, y **veinte cajas con "0 temas" comunican "aquí no hay nadie"
mucho más fuerte de lo que comunicaría no tener foro**.

Por eso la estructura vive en la **base de datos y no en el HTML**: se
arranca con pocos foros y se abren más desde `/admin`, sin desplegar, el
día que un tema ya no quepa en los que hay. Ese es el orden correcto —
un foro se abre cuando hace falta, nunca por si acaso.

Arranca con tres secciones y siete foros: Comunidad (Anuncios,
Presentaciones, Sugerencias y fallos + *Web* y *Contenido*), Colección
(*¿Es falsa? ¿Cuánto vale?*, Muestra tu colección + *Cartas del mes*, e
Intercambios **escondido**) y Café (General).

*Intercambios* nace oculto a propósito: con veinte personas no hay
mercado, y en cuanto hay dinero de por medio hay estafas y hay que
moderar de verdad. Se abre con un clic el día que tenga sentido.

### Las tablas

| tabla | qué guarda |
| --- | --- |
| `forum_sections` | las cabeceras del índice |
| `forum_boards` | foros **y subforos** — un subforo es un foro con `parent_id` |
| `forum_threads` | temas, con `prefix` (la etiqueta), `is_pinned`, `is_locked` |
| `forum_posts` | mensajes, con `reply_to_id` para las citas |
| `forum_post_likes` | "me gusta", uno por cabeza (clave primaria compuesta) |

Un subforo **no** tiene tabla propia porque es exactamente lo mismo que
un foro: tiene temas, permisos y puede tener hijos. Una tabla aparte
duplicaría todo eso para no ganar nada.

`forum_boards_resumen` es la vista del índice: cada foro con sus números
y su último mensaje ya resueltos, **incluyendo los de sus subforos** (si
no, un foro que solo hace de contenedor saldría con 0 temas y parecería
muerto). Lleva `security_invoker = true`, que **no es opcional**: por
defecto una vista se consulta con los permisos de quien la creó, así que
sin eso la vista se saltaría las políticas y enseñaría los foros
escondidos a cualquiera.

Los contadores del tema (`post_count`, `last_post_at`) los mantiene un
disparador que **recuenta entero** en vez de sumar y restar. Con este
volumen el coste no existe, y a cambio un borrado o un movimiento no
pueden dejar el contador mintiendo para siempre.

### XP por participar, con dos frenos

Abrir un tema da **5 XP**; responder, **2**. Lo concede un disparador y
no el navegador, por lo mismo que el resto del XP.

Aquí **no hay tope natural** (a diferencia de "me ha servido", que lo
topa una clave primaria), así que lleva dos:

1. **Menos de 80 caracteres de texto no dan nada.** Un "gracias" o un
   "+1" no es participar, y si diera XP el foro se llenaría de eso en una
   semana.
2. **Como mucho 10 mensajes al día cuentan.** Quien escribe de verdad no
   llega ahí casi nunca; quien quiera farmear, sí.

### Quién puede qué

- **Abrir tema**: en foros con `post_policy = 'todos'`, cualquiera que no
  esté baneado ni silenciado. Anuncios es `'staff'`: todo el mundo lo lee,
  solo el equipo escribe.
- **Editar**: el autor puede cambiar el título y la etiqueta de SU tema.
  **Fijar, cerrar, mover y las visitas son cosa del equipo**, y eso lo
  impone un disparador que revierte esos campos si quien escribe no es
  admin — la política de UPDATE por sí sola no bastaría, porque el autor
  sí puede tocar su fila.
- **Borrar un tema**: el equipo siempre; el autor solo mientras no haya
  contestado nadie. Borrar un tema con respuestas es borrar los mensajes
  de otros.
- **"Me gusta"**: en tu nombre, y no a ti mismo.

### La pantalla del tema

Columna del autor a la izquierda (avatar grande, nombre, título y chapas)
y el mensaje a la derecha con su número, su fecha, *Me gusta / Citar /
Reportar* y la fila de reacciones. Es la disposición clásica y se mantiene
porque hace que se vea de un golpe **quién** dice cada cosa, que en un
foro pesa tanto como lo que se dice.

El título bajo el nombre es el **rango de colaborador** si lo tiene (se
gana escribiendo guías) y, si no, el nivel — para que nadie se quede sin
nada debajo del nombre.

### Lo que se hereda ya hecho

El foro no arrancó de cero: enchufa en los avisos y la campanita, el XP y
los rangos, el hilo de Actividad (un tema nuevo sale ahí; las respuestas
**no**, o una conversación animada taparía todo lo demás), reportar
contenido, banear y silenciar, y el editor de texto con formato e
imágenes.

### Un fallo real que salió al probarlo

El disparador que impide que alguien se infle las visitas de su tema
**también frenaba a `forum_ver_tema()`**, que es la única función que las
cuenta. Resultado: el contador se habría quedado clavado en cero para
siempre. Se arregló con una marca de sesión que la función pone y el
disparador respeta; nadie puede ponérsela desde fuera, porque por la API
solo se llega a las funciones publicadas.

### Cómo se ha probado

- **Contra PostgreSQL 16 de verdad** (`prueba-foro.sql`, 35
  comprobaciones) y dejando de ser superusuario, si no RLS no se aplica:
  quién abre temas y dónde, que un silenciado no escribe, que el autor no
  se fija ni se mueve ni se infla las visitas, que un tema cerrado no
  admite respuestas salvo del equipo, los contadores al insertar y al
  borrar, el XP con sus dos frenos, que no puedes darte "me gusta" a ti
  mismo, y que un foro escondido no se cuela **ni por la tabla ni por la
  vista**. Más que la migración aguanta ejecutarse dos veces.
- **La pantalla, con Playwright** (`test-foro.mjs`): el índice con sus
  secciones, subforos y números; la lista de temas con el fijado arriba;
  abrir un tema; que sin cuenta se pueda leer pero no escribir; el tema
  con su columna de autor, sus citas y sus "me gusta"; responder citando;
  el tema cerrado; el panel de `/admin`; que un tema nuevo salga en
  Actividad; y que las tres pantallas quepan en 360 px.

## El foro, segunda vuelta: títulos, moderación y edición

Migración: **`supabase-migration-foro-titulos.sql`** (va DESPUÉS de
`supabase-migration-foro.sql`; es idempotente).

### El "me gusta" en tu propio mensaje

Daba un error de PostgreSQL en crudo por pantalla:
*new row violates row-level security policy for table "forum_post_likes"*.
La base hacía lo correcto —aplaudirse solo no es señal de nada— pero **el
botón se enseñaba igual**, así que la única forma de descubrir la regla
era chocarse con ella.

Ahora en tu propio mensaje no sale el botón. Y si el error llega por
cualquier otro camino, se traduce: *"No puedes darle a tu propio
mensaje"*. Un error de base de datos en la cara de alguien es siempre un
fallo de quien lo escribió, no de quien lo lee.

### Títulos de foro

`user_profiles.forum_title`: texto libre que un admin escribe desde
`/admin` y que se lee bajo el nombre de esa persona en cada mensaje. Es
**puro reconocimiento y no da ningún permiso**.

Manda sobre lo demás: si alguien tiene título, se lee ese; si no, el rango
de colaborador (que se gana escribiendo guías); y si tampoco, el nivel.

### Moderadores

`user_profiles.is_moderator` + `public.is_staff()` (= admin **o**
moderación). Todas las políticas del foro pasan a usar `is_staff()`, así
que un moderador **fija, cierra, mueve, edita y borra en el foro sin
entrar al panel de administración**. Los foros escondidos siguen siendo
cosa de administración: no abrir un foro es una decisión de producto, no
de moderación.

Ponerse un título o nombrarse moderador lo impide un disparador: la
política de `user_profiles` deja que cada cual edite su fila, así que sin
él cualquiera podría ascenderse solo.

### Editar mensajes

Se edita **en su sitio**, con el mismo editor con formato, en vez de en
una ventana aparte: así se ve el mensaje rodeado de la conversación a la
que contesta.

`edited_at` lo pone un **disparador**, no el navegador. Si dependiera del
cliente bastaría con no mandarlo para editar a escondidas. Y solo se marca
cuando cambia el texto: tocar otra columna no ensucia el mensaje con un
"editado" que nadie ha hecho.

### La trampa que destapó su propia prueba

El disparador que impide ascenderse revertía **también** lo que se escribe
sin sesión — es decir, desde el SQL Editor o con la clave de servicio.
Nombrar el primer moderador a mano no habría funcionado, **y sin dar
ningún error**. Ahora los dos disparadores de este tipo solo actúan cuando
hay alguien identificado: los frenos son para la API, no para la consola.

### Actividad del foro en el perfil

`js/foro-actividad.js`, compartido por el perfil propio y el público: los
temas que ha abierto esa persona y los mensajes que ha escrito, en **dos
listas y no una**. Son dos cosas distintas — abrir un tema es proponer
algo y responder es ayudar en lo de otro—, y mezcladas no se distingue
quién arranca conversaciones de quién las sostiene.

El primer mensaje de un tema **es** el tema, así que no se cuenta también
como mensaje. Se carga al abrir su pestaña, no al entrar al perfil.

### El foro en el sitemap y al compartirlo

Los temas son el contenido que más gente puede traer de fuera ("¿es falsa
esta carta?" es una búsqueda real). Ahora están en el sitemap, con
`lastmod` en la fecha del último mensaje, y los foros también. Los foros
escondidos no se listan.

### Sobre el tope de XP, que no es un tope de mensajes

Se puede escribir sin límite: no hay esperas ni máximos. Lo único topado
es el **XP** — a partir de 10 mensajes en un día los siguientes no suman,
y uno de menos de 80 caracteres tampoco. Es un freno al farmeo, no a la
participación: el mensaje se publica igual.

## El foro, tercera vuelta: la escala y un enlace que no era enlace

### Un `<a>` dentro de otro `<a>` no existe

En la columna «Lo último» del índice, la fila entera era un enlace al
tema y dentro llevaba el avatar, que **ya es** un enlace al perfil. Eso
no es HTML válido, y el navegador no avisa: el analizador **cierra el
enlace de fuera** en cuanto se topa con el de dentro. Resultado, el
título quedaba fuera de todo enlace y no se podía entrar en el tema
desde ahí, aunque el código pareciera decir lo contrario.

Arreglado poniendo los dos enlaces como **hermanos** — avatar al perfil,
título al tema —, que además es lo que hacía ya `ultimoHtml()` en la
columna del último mensaje de cada foro.

La prueba mira el `href` **de verdad** del título, no que exista una
etiqueta: con la fila rota, el `<strong>` seguía ahí y una comprobación
por texto habría pasado igual.

### La escala: un foro se barre, no se lee

El foro nació con la tipografía y los aires del resto de la web, que está
pensada para leer guías. Un índice de foros no se lee: se **barre** — se
busca dónde hay movimiento y se entra. Con filas de 16 px de aire y
títulos de 15,5 px cabían cuatro foros en pantalla.

Bajado un punto todo a la vez, que es la única forma de que siga
pareciendo una sola cosa: filas a 10 px, títulos a 14,5 px, la columna
del autor de 180 a 146 px, su avatar de 76 a 56 px, y el texto del
mensaje a 14,5 px/1,6 en vez de los 16 px/1,75 de una guía. Nada de esto
toca `.article-body`: las guías siguen con su tamaño de lectura larga.

### La caja de escribir tenía tamaño de guía

`.rte-surface` es la misma pieza en el editor de guías y en el foro, y
nace con `min-height: 60vh` porque una guía se escribe en una pantalla en
blanco. En un tema eso abría media pantalla vacía debajo del último
mensaje.

Se resuelve con un modificador, `.rte-compacta`, en el envoltorio: altura
mínima de 110 px, menos aire, botones de 28 px y la barra **sin**
`position: sticky` (en una caja baja, una barra pegajosa se despega de su
propia caja al hacer scroll y se queda flotando sobre el mensaje de al
lado). El editor de guías no se entera de nada.

De paso, el editor acepta ahora un `placeholder`. No se puede hacer con
`:empty` en CSS — una superficie «vacía» nunca lo está, lleva dentro el
`<p><br></p>` semilla —, así que la marca una clase (`rte-vacia`) que se
recalcula en cada cambio con la función que ya sabía distinguir vacío de
lleno. Y va como pseudoelemento: cualquier cosa de verdad metida en un
`contenteditable` se puede seleccionar, borrar o acabar guardada dentro
del mensaje.

# Los cursos dejan de ser un examen

Un tester lo dijo tal cual: «parecen las preguntas de un curso online, no
un curso gamificado». Mirando el código tenía toda la razón, y el motivo
no era el contenido:

- **Fallar no costaba nada.** Acertaras o fallaras, el botón de continuar
  se habilitaba igual (`else { btnContinue.disabled = false }`). Sin
  consecuencia no hay tensión, y sin tensión aquello es un formulario.
- **Todo valía +5 XP fijos**, y la etiqueta lo decía en cada bloque. Una
  recompensa constante y predecible deja de leerse como recompensa.
- **No había marcador.** Terminabas y te daban `guides.xp_reward`, un
  número que no dependía de lo bien que lo hubieras hecho: daba igual
  acertarlo todo que fallarlo todo.
- **Las preguntas eran texto**, en una web que tiene 23.600 cartas en su
  propia base de datos.
- **Se hacía una vez y ya.** Ningún motivo para volver.

Migración: `supabase-migration-cursos-juego.sql`.

## Las reglas, aparte de la pantalla

`js/curso-juego.js` no toca ni el DOM ni la red: son las reglas puras
(cuántos puntos, qué medalla, la clave de una pregunta). Está separado
por dos motivos. Uno, las necesitan también el reto diario y el repaso.
Dos, así se pueden probar sin navegador — `test-curso-reglas.mjs` corre
en un segundo.

**Puntuación.** 10 puntos por acierto, y el multiplicador sube con la
racha: ×2 a los 3 aciertos seguidos, ×3 a los 5. Fallar la rompe entera.
Lo que engancha no es el 10, es que el siguiente valga 20 — y por eso la
cabecera de cada pregunta dice lo que vale **antes** de responder.

**Medallas.** Oro al 100 %, plata al 80 %, bronce al 50 %. Repetir el
curso para mejorarla es lo que convierte «he terminado el curso» en
«quiero el oro».

⚠️ Esos tres umbrales están **repetidos** en el disparador
`course_attempt_medalla()` de la migración. Los de la base son los que
mandan: la medalla que se guarda la calcula Postgres, no el navegador.
Los de JavaScript solo sirven para pintarla antes de guardar nada. Si se
tocan en un sitio hay que tocarlos en el otro.

## Lo que fallas vuelve antes de terminar

Cada pregunta fallada se **reencola** justo antes de la pantalla final,
marcada como REPESCA. Es el truco que separa practicar de hacer un
examen: la que no te sabes te la vuelves a encontrar antes de salir.

La repesca da 3 puntos, no 10, y **no cuenta como acierto de la
partida**. Si contara, fallar no costaría nada y volveríamos al problema
de partida: la nota ya está puesta, la repesca es para aprendértela.

## Cómo se impide farmear XP

Esto era lo más delicado de todo el cambio, porque repetir un curso pasa
a ser algo que queremos que la gente haga.

| Qué | Antes | Ahora |
|---|---|---|
| +5 XP por bloque acertado | en cada partida | solo la **primera** partida de ese curso (`haJugadoAntes()`) |
| `quiz_correct_count` (alimenta un logro) | en cada partida | igual: solo la primera |
| XP del curso (`xp_reward`) | al completar | igual, solo la primera vez |
| Subir de medalla | no existía | +10 al llegar a plata, +25 a oro, **una sola vez** (`xpPorMejoraDeMedalla`) |

El techo por curso queda cerrado y no depende de cuántas veces se juegue.

## Siempre desde el principio

Antes se reanudaba por `user_progress.current_block`. Con puntuación eso
no se sostiene: quien entrara directo al último bloque haría un 1 de 1,
se llevaría el oro y su XP en diez segundos. Ahora una partida es una
partida — las mismas preguntas para todos. Los cursos son de cinco
minutos, así que no se pierde gran cosa. `current_block` se sigue
guardando porque es la posición por la que vas y no cuesta nada.

## Las tablas nuevas

- **`course_attempts`** — una fila por partida, con puntuación, aciertos,
  medalla y duración. Sin `update` ni `delete` en las políticas: una
  partida jugada es un hecho. Las puntuaciones imposibles las cortan
  restricciones `check` (`score <= total * 30 + 500`).
- **`question_stats`** — veces respondida y veces acertada cada pregunta,
  para el «solo la acierta el 43 % de la comunidad». **No tiene políticas
  de insert ni de update a propósito**: la única puerta es
  `record_question_answer()`, que es `security definer` y solo sabe sumar
  uno. Si la tabla fuera escribible, un `update ... set times_correct =
  99999` desde la consola del navegador se cargaría el dato para todos.
- **`course_review_queue`** — lo que fallaste, con **una copia del
  bloque** dentro. Copia y no referencia: el curso puede editarse o
  despublicarse entre que fallas y que repasas.
- **`daily_challenge_results`** — el resultado del reto del día. La clave
  primaria `(user_id, day)` es lo que impide repetirlo hasta que salga
  bien.
- **`course_leaderboard(guide_id, limite)`** — la mejor partida de cada
  persona, numerada. `distinct on (user_id)` para que quien juega diez
  veces no ocupe la tabla entera, y devuelve la clasificación completa
  con su puesto para poder decirte «vas el 14º» aunque no salgas en el
  top 10. Respeta `hide_activity` y esconde a los baneados.

### La clave de una pregunta

`claveDePregunta()` es un hash corto (FNV-1a) del **enunciado**, no la
posición del bloque. Con la posición, reordenar los bloques de un curso
mezclaría las estadísticas de unas preguntas con las de otras. Con el
enunciado, reordenar no afecta y **reescribir** la pregunta la convierte
en otra que empieza de cero — que es lo correcto: el «43 % la falló» de
la pregunta vieja no dice nada de la nueva.

## Preguntas con cartas de verdad

Tres tipos de bloque nuevos, todos con el mismo principio que ya seguían
las listas de cartas de las guías: **se guardan solo identificadores de
TCGdex**, y el dibujo lo monta la web leyendo `tcg_cards`.

- **`cartaquiz`** — varias cartas en pantalla, eliges una.
  `{ question, card_ids[], correct_id, explanation }`
- **`zonas`** — «encuentra el fallo»: una imagen y tocas dónde está.
  `{ question, image_url, zones: [{x, y, r}], explanation }`. Las
  coordenadas van en **tanto por ciento**, no en píxeles, porque la
  imagen se ve a otro tamaño en el móvil, en el editor y en el curso. Se
  enseña la zona buena se acierte o no: quien falla tiene que ver dónde
  estaba.
- **`clasifica`** — arrastrar (bueno, tocar) cada carta a su montón.
  `{ title, buckets[], cards: [{id, bucket}], explanation }`

En `match` y en `clasifica`, equivocarse **no impide** terminar el
bloque, pero cuenta como fallo. Si no, serían los dos únicos sitios donde
la racha no se puede perder y bastaría con ir a fuerza bruta.

Las cartas se piden al pintar el bloque, no al cargar el curso: no tiene
sentido bajarse veinte imágenes que a lo mejor no se ven. El bloque
aparece al instante con el hueco y las imágenes entran cuando llegan.

**Lo que no se ha hecho: ordenar cartas por precio.** `tcg_cards` no
tiene precio y no hay de dónde sacarlo sin otra fuente de datos. Meter
precios a mano en el bloque envejecería mal y encima parecería un dato
oficial de la web.

## El reto diario y el repaso

No son una página aparte: son el mismo `curso.html` con `?reto=hoy` o
`?reto=repaso` (`js/curso.js`, variable `modo`). Una partida es una
partida — marcador, racha y medalla funcionan igual — y así no hay un
segundo motor que mantener.

**Las cinco preguntas del día son las mismas para todo el mundo** y no
las prepara ningún proceso nocturno: se sortean en el cliente con la
fecha como semilla (`barajarConSemilla`, mulberry32). Antes de sortear
se ordenan por su clave, porque el orden en que Supabase devuelva los
cursos no está garantizado y si cambiara, cambiaría el reto del día.

El repaso saca las preguntas de `course_review_queue` cuyo `review_after`
ya pasó (dos días después de fallarlas). Acertarla la borra de la cola;
volver a fallarla la deja ahí.

XP: 15 por el reto del día (uno al día), 3 por cada pregunta recuperada
en el repaso. Ninguno de los dos reparte XP por bloque.

Las dos cosas se ofrecen desde la home (`#retoSeccion`), solo con la
sesión iniciada.

## Todo esto aguanta sin la migración aplicada

`js/curso-datos.js` **falla en silencio a propósito**, entera. Entre que
se sube el código y se ejecuta la migración en el SQL Editor hay un rato
en el que las tablas no existen; durante ese rato el curso se juega
igual, con marcador y medalla incluidos. Lo único que se pierde es
guardar la marca y enseñar los porcentajes. Ninguna función de ese
fichero lanza: devuelven `null`, `0` o lista vacía.

# Cuatro cosas del foro que solo se ven usándolo

## «hace 13 h · Alguien»

En la lista de temas, la columna de la derecha decía quién había escrito
el último mensaje… y decía **«Alguien»**, que es el texto de respaldo de
`nombreDe()` para cuando no se sabe de quién es un perfil.

No se sabía porque `forum_threads` guarda **cuándo** fue el último
mensaje (`last_post_at`) pero no **de quién**, así que la lista pasaba
`perfil: null` y se pintaba el respaldo. Salía hasta en los temas sin
respuestas, donde el último mensaje es el primero y su autor está a dos
centímetros en la misma fila.

Migración: `supabase-migration-foro-ultimo-autor.sql` añade
`forum_threads.last_post_author_id`, mantenido por el **mismo**
disparador que ya llevaba `post_count` y `last_post_at`, y rellena los
temas que ya existían. La alternativa era, al pintar la página, pedir el
último mensaje de cada uno de los veinte temas.

Si se borran todos los mensajes de un tema, la columna cae al autor del
tema en vez de quedarse en `null`: así no puede volver a aparecer un
«Alguien» por la puerta de atrás.

El cliente además tolera que la migración no esté aplicada:
`perfiles[t.last_post_author_id] || perfiles[t.author_id]`. Sin migración
enseña a quien abrió el tema, que en un tema sin respuestas es
exactamente el mismo, y en uno con respuestas sigue siendo mejor que
«Alguien».

## La barra de formato del foro no tenía estilo. Ninguno.

Se veía como un churro de símbolos pegados: `¶H2H3 B/US A▮Tx`. La causa
no era el espaciado: en el foro, el contenedor de la barra era

```html
<div id="respuestaBarra"></div>
```

**sin la clase `rte-toolbar`**, que es la que lleva todo el CSS de la
barra. Solo la tenía el editor de guías (`<div class="rte-toolbar"
id="refRteToolbar">`). Sin ella, los botones salían en crudo: 7 px de
ancho, 15 de alto y pegados unos a otros.

Estaba en los tres sitios del foro que montan un editor: la respuesta,
la edición en el sitio y el formulario de tema nuevo.

Con la clase puesta ya aplica la variante compacta, que además se ha
soltado un poco: hueco de 3 px entre botones, botones de 30 px, borde al
pasar por encima y separadores con 6 px de margen a cada lado.

⚠️ Una prueba que mida `.rte-toolbar button` a secas mide también los
botones de la **paleta de colores**, que están escondidos y valen 0 px.
Hay que medir hijos directos de `.rte-tools`.

## La chapa que se salía del cuadro

`.contributor-badge` («Colaborador destacado») nace para ir **en línea**,
al lado de un nombre en un comentario: por eso lleva `white-space:
nowrap` y un margen a la izquierda. Metida en la columna del autor de un
mensaje del foro, que mide 146 px y va centrada, ese `nowrap` la sacaba
por la derecha.

Se arregla solo dentro de `.foro-mensaje-autor`: sin margen, `max-width:
100%` y `white-space: normal` para que parta en dos líneas. Lo mismo para
`.foro-chapa` y `.foro-autor-titulo`, porque un título puesto a mano
desde /admin puede ser cualquier cosa.

⚠️ Al probarlo: con `max-width` puesto hay **dos** formas de salirse, y
mirar solo una no vale. La caja puede ser más ancha que la columna, o
puede caber y ser el TEXTO el que se derrama por dentro (`scrollWidth >
clientWidth`). Con `nowrap` pasa lo segundo, y la primera versión de la
prueba daba por bueno el fallo original.

## La lateral, ya no tan sosa

Debajo de «Lo último» van dos paneles más:

- **Por aquí hoy** — quién ha pasado, de `user_profiles.last_active_date`
  (la columna que ya mantiene la racha diaria). Respeta `hide_activity`.
- **El foro en números** — temas, mensajes, miembros y el último en
  registrarse.

Cuatro consultas de solo contar (`head: true`, sin traerse ni una fila)
más dos pequeñas, todas en paralelo y **todas tolerantes**: si una falla,
esa línea no sale y las demás sí. La del último en registrarse ordena por
`created_at`, que podría no existir en bases antiguas; si da error,
simplemente no se enseña esa línea.

Se pintan **después** de «Lo último» y en un segundo paso, para que la
parte importante de la columna esté en pantalla aunque los números
tarden.

Sigue sin haber «usuarios en línea»: con veinte miembros, un «en línea:
1» enseña soledad. «Por aquí hoy» es el mismo dato contado de una manera
que no deprime.

# Que la web cargue rápido

Antes de tocar nada, medir. Cada página se llevaba entre **425 y 550 KB
sin comprimir**, y hasta `terminos.html` —una página de texto legal—
bajaba 297 KB de JavaScript.

## Lo que de verdad pesaba

### El bundle de Supabase traía cosas que no se usan

`js/vendor/supabase-js.js` iba en las 19 páginas y ocupaba 210 KB (54,9
comprimido). Dentro venía **Realtime entero, con su cliente de
WebSocket** — y PokeDoc no tiene ni una suscripción en vivo: no hay un
solo `.channel()` ni `.subscribe()` en todo el código. También venía el
cliente de Edge Functions, que tampoco se usa (la única función de borde
la ejecuta Netlify, no el navegador).

Se regenera con esbuild sustituyendo esos dos paquetes por los
sustitutos de `herramientas/`, que avisan con un mensaje claro si algún
día alguien los llama:

    150,7 KB en vez de 209,5 (37,6 comprimido en vez de 54,9)

**−17,3 KB comprimidos en cada carga de cada página**, y 56 KB menos de
JavaScript que analizar.

⚠️ La suite de Playwright usa un Supabase falso, así que **el bundle de
verdad no se ejecuta en ninguna prueba de navegador**. Por eso hay una
aparte, `test-vendor-supabase.mjs`, que crea el cliente en Node y
comprueba una por una las piezas que el sitio usa (consultas, sesión,
storage, rpc). Sin ella, un recorte mal hecho no lo habría cazado nadie.

### Las fuentes venían de Google

Las 19 páginas pedían a `fonts.googleapis.com` una hoja de estilo **que
bloquea el pintado**, y esa hoja pedía a su vez las fuentes a
`fonts.gstatic.com` — un tercer dominio, y encima sin `preconnect`.
Cuatro viajes (DNS, TLS, la hoja, las fuentes) antes de poder pintar una
letra, y dos puntos de fallo ajenos.

Ahora se sirven desde el propio sitio, con `@font-face` en `style.css` y
cacheadas un año. Y son **variables**: un fichero por familia cubre todos
los pesos. Con las estáticas harían falta siete (400/500/600/800 de Inter
y 500/600/700 de Fredoka): 142 KB en siete peticiones, contra **76 KB en
dos**.

Se declaran como `Inter` y `Fredoka` a secas —sin el «Variable» que traen
los paquetes de fontsource— para que el resto del CSS siga valiendo tal
cual.

### La cascada de módulos

Los módulos se descubren en cadena: la página pide su `.js`, ese pide
`app.js`, `app.js` pide `supabase.js`, y ese el bundle. Medido: **siete
niveles**. Cada salto es un viaje de ida y vuelta más antes de empezar.

Ahora las 21 páginas llevan `modulepreload` de los seis módulos que
carga **toda** página (`vendor/supabase-js`, `supabase`, `app`, `icons`,
`content-icon`, `html`). Se piden los seis a la vez desde el primer
momento.

Van solo esos seis y no el grafo entero a propósito: son los que no
cambian de página a página, así que estos `<link>` no se quedan
obsoletos solos cuando alguien toca los imports de una página.

### 112 KB de mascota que casi nadie veía

`mascota.png` vive dentro del modal «¿Qué es PokeDoc?», que empieza
oculto — y aun así el navegador se bajaba sus 112 KB en cada visita a la
portada. Ahora es WebP (35 KB, un 69 % menos) y con `loading="lazy"`: no
se pide hasta que alguien abre el modal.

## Lo que se midió y se decidió NO hacer

**Partir `components.css` por páginas.** Parecía la mejora obvia: 95 KB
en todas las páginas con el foro, los editores y el resto dentro. Pero al
medirlo:

- comprimido son **20,7 KB**, no 95;
- la familia más grande (`.foro-*`) es el 13 % ≈ **2,7 KB comprimidos**;
- y sacarla fuera le añade **una petición más** a las páginas del foro.

Cambiar 2,7 KB por un fichero más, con el riesgo de que un selector se
quede en el fichero equivocado y algo se rompa en silencio, no sale a
cuenta. Si algún día el CSS se dobla, se revisa.

## El resultado

La portada, comprimida: **122 KB** (91 de JS en 24 módulos + 29 de CSS +
el HTML), sin una sola petición a un dominio ajeno.

`test-carga.mjs` fija todo esto: que ninguna página pida nada a Google ni
a un CDN, que las fuentes sean dos y nuestras, que el bundle siga por
debajo de 160 KB y sin WebSockets, que las precargas apunten a ficheros
que existen, que la mascota no se pida sola, y un techo de 150 KB
comprimidos para la portada. El techo no está para afinar: está para que
si alguien mete otra librería de 200 KB salte ahí y no en el móvil de
alguien.

# El foro, para usarlo a diario

Las seis cosas que separan un foro que se visita de uno que se USA. Todas
salieron de la misma frase: «al foro entro, miro y me voy».

Migración: `supabase-migration-foro-mejoras.sql`.

## Qué hay nuevo desde la última vez

Sin esto, volver al foro es comparar fechas a ojo.

```sql
create table public.forum_thread_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);
alter table public.user_profiles add column forum_read_all_at timestamptz;
```

Se guarda **la fecha, no un booleano**. Con un booleano, cada mensaje
nuevo obligaría a marcar como no leído a todo el mundo: una escritura por
persona y por mensaje. Con la fecha, escribe solo quien lee, y la
comparación la hace la consulta.

Y **«marcar todo como leído» es una sola fila en el perfil**
(`forum_read_all_at`), no una por tema. Con mil temas, lo segundo serían
mil escrituras por un clic.

Un tema está sin leer cuando su `last_post_at` es posterior a la más nueva
de las dos marcas. Se pinta con la clase `foro-tema-nuevo` (título en
negrita) y un punto delante: en una lista larga, el peso de la letra se ve
de un vistazo y un color no siempre.

Lo leído es **privado** — política `for all using (auth.uid() = user_id)`.
Sin sesión no se marca nada: poner media pantalla en negrita a quien acaba
de llegar no le dice nada.

### Un caso que la prueba destapó

`marcasDeLectura()` devuelve `hayDatos`, que **no** es lo mismo que «no
hay lecturas». Si la migración todavía no se ha ejecutado, la tabla no
existe, no llega ni una marca… y con la primera versión el foro entero
salía en negrita para siempre, sin forma de quitarlo. Ahora, mientras no
se pueda saber, no se marca nada.

### Lo que faltaba: el ÍNDICE no sabía nada de esto

Lo contó él después de usarlo: «cuando entras al foro está todo como no
leído, no hay un botón de leer todo, y no hay diferencia cuando ya tienes
un foro o un subforo completamente leído».

Las tres cosas eran verdad, y el motivo es el mismo: **todo lo de arriba
existía sólo en la lista de temas de dentro de un foro.** El índice
(`/foro`) pintaba nombre, descripción, dos contadores y el último mensaje.
Nada más. Consecuencias:

- Un foro con veinte mensajes nuevos se veía **exactamente igual** que uno
  leído de arriba abajo. Para saber si había algo había que entrar en los
  seis foros a mirar.
- Un **subforo** con novedades era invisible desde el índice: la fila del
  padre no contaba a sus hijos.
- El botón de «marcar todo como leído» estaba **dentro** de un foro. Para
  quitarte de encima el «todo sin leer» tenías que entrar en uno
  cualquiera y encontrarlo allí.

`sinLeerPorForo(marcas)` resuelve el dato con **una sola consulta** y no
una por foro: pide los temas con actividad y los cuenta por `board_id`
aquí. Cuando hay `forum_read_all_at`, la consulta lleva
`.gt('last_post_at', todoHasta)`, así que quien acaba de marcar todo como
leído no se trae ni una fila. Tiene tope (1.000, los de actividad más
reciente): si algún día se pasa, el contador se queda corto pero el aviso
de «aquí hay algo nuevo» sigue siendo cierto, que es lo que importa.

En el índice, la fila de un foro lleva ahora el **mismo lenguaje visual
que un tema** —punto delante, nombre en negrita— más una chapa con
**cuántos temas nuevos** tiene, y los nuevos de un foro **suman los de sus
subforos**. El botón de marcar todo pasa a estar también en el índice.

Y el estado leído se dice **en positivo**: nombre en color apagado e icono
al 30%. Si sólo se marcara lo nuevo, un foro leído se leería como «no sé»
en vez de como «esto ya está».

Dos cosas salieron de romper el código a propósito, y las dos cambiaron el
código en vez de la prueba:

- La chapa tenía un `if (!sesion)` que **no se ejecutaba nunca**: sin
  sesión no se piden las marcas, así que nunca le llega un número.
  Quitarlo no cambiaba ninguna comprobación. Fuera.
- La comprobación del icono apagado era `leído < nuevo`, y eso **ya se
  cumplía antes del arreglo** (0,55 contra 1). Una comparación relativa
  que pasa con el fallo puesto no prueba nada: ahora se exige `≤ 0,4`, que
  es la decisión de diseño de verdad.

Probado en `test-foro-leidos.mjs`: 36 comprobaciones (recién llegado, foro
leído contra foro con novedades, subforo que avisa al padre, la marca que
se guarda al pulsar el botón, el foro entero leído, y sin sesión no se
habla de lo leído). Rigor: **14 roturas, 14 pilladas**.

Y una del Supabase de mentira: le faltaban `.gt()` y `.lt()`. `sinLeerPorForo`
usa `.gt`, así que sin eso la prueba se caía con un TypeError en vez de
probar nada. Son estrictas, como en PostgREST: con `>=`, un mensaje escrito
en el mismo instante en que marcas todo como leído volvería a salir sin
leer.

## Que te avisen donde estabas hablando

```sql
create table public.forum_subscriptions (
  user_id uuid, thread_id uuid, created_at timestamptz,
  primary key (user_id, thread_id)
);
```

Quien escribe en un tema **queda suscrito solo** (disparador
`trg_forum_suscribir_al_escribir`): es lo que espera cualquiera, si has
hablado ahí quieres saber qué te contestan. Se deshace con el botón de
dejar de seguir, y el insert es `on conflict do nothing` — si te diste de
baja y vuelves a escribir, se te vuelve a suscribir, que es lo que
significa volver a participar.

La lista de suscritos **no es pública**: quién sigue qué es información
sobre a quién le interesa qué, y no aporta nada a cambio de enseñarla. La
política solo deja ver las propias. Por eso avisar no lo puede hacer el
navegador, y lo hace la base:

```sql
create function public.forum_avisar_suscritos(p_thread uuid, p_post uuid, p_titulo text)
returns integer language plpgsql security definer …
```

`security definer`, así que sí ve la lista — pero solo devuelve **cuántos
avisos ha creado**. Antes de crear ninguno comprueba que el mensaje
existe, es de ese tema y es de quien llama; sin esa guarda, cualquiera
podría llamarla con un tema al azar y llenarle la campanita a media web.
Respeta `notification_prefs_disabled` y nunca avisa a quien acaba de
escribir.

El botón de seguir se pinta **antes** de que conteste la base y se vuelve
atrás si falla: un botón que tarda medio segundo en reaccionar se pulsa
dos veces.

## Buscar dentro del foro

El buscador del sitio miraba guías y personas; los mensajes del foro no
los veía nadie.

Mismo método que el buscador de guías: una columna generada con el texto
plegado y un índice trigram encima.

```sql
alter table public.forum_threads add column search_norm text
  generated always as (public.plegar_texto(coalesce(title,'') || ' ' || coalesce(prefix,''))) stored;

alter table public.forum_posts add column search_norm text
  generated always as (
    public.plegar_texto(regexp_replace(coalesce(body_html,''), '<[^>]*>', ' ', 'g'))
  ) stored;
```

En los mensajes hay que **quitar las etiquetas antes de plegar**: el
cuerpo se guarda como HTML, y sin eso buscar «div» o «strong» encontraría
todos los mensajes del foro. Es una comprobación de la prueba, no una
suposición.

Al ser columnas *generadas*, no se pueden escribir a mano: nadie puede
colocarse en todas las búsquedas.

Los resultados salen en el propio `/foro?q=…`, no en una página nueva: la
misma cabecera, las mismas migas, y el botón de atrás hace lo que se
espera. Y si la columna no existe todavía se dice («el buscador todavía no
está activado») en vez de enseñar «no hay resultados», que sería mentira.

**Dónde va**: arriba del todo, encima del título, alineado a la derecha y
con 300 px de ancho. Es un `<form>` de verdad, así que funciona con Enter.
Quien viene a leer no lo necesita; quien viene a buscar algo lo encuentra
donde espera.

## Citar el trozo seleccionado

Al soltar el ratón sobre el texto de un mensaje sale un botón flotante
«Citar esto»; al pulsarlo, ese trozo entra en la caja como `<blockquote>`,
se marca el mensaje como citado (para que el aviso llegue a quien toca) y
el cursor queda debajo para seguir escribiendo.

Dos detalles que costaron:

- El navegador **encola los `selectionchange`**, así que uno de la propia
  selección que acabas de hacer llega *después* de haber puesto el botón y
  se lo llevaba por delante. Se compara el texto de la selección con el
  del botón: solo se quita si ha cambiado de verdad.
- Con el ratón encima no se quita nunca. Al pulsar, el navegador deshace
  la selección; si el botón desapareciera en ese momento, el clic no
  llegaría a producirse.

Menos de tres caracteres no sacan el botón: si no, sería un botón que
aparece cada vez que pinchas en un mensaje.

## Vista previa y borrador

La vista previa usa **el mismo saneador y las mismas clases** que un
mensaje publicado, para que lo que se ve ahí sea lo que se va a ver
luego. Se actualiza sola mientras se escribe.

El borrador vive en `sessionStorage`, no en la base: es para el accidente
de cerrar la pestaña o darle a atrás, no para escribir desde tres sitios
—guardarlo en la base costaría una escritura por tecla y no arregla nada
más. Va **por tema** (`pokedoc-borrador-tema-<id>`), para que dos
borradores no se pisen, se recupera avisando, y se borra al publicar. Un
cuerpo vacío no se guarda: si no, borrar lo escrito dejaría un borrador de
un párrafo en blanco que luego «se recupera».

## Menciones con @nombre

Dos mitades: al **publicar** se sacan los nombres y se avisa a esas
personas («Te han mencionado en el foro», no «te han respondido»); al
**leer**, los `@nombre` que corresponden a alguien de verdad se convierten
en enlace a su perfil.

Al enlazar se trabaja sobre el DOM y **solo en nodos de texto**, no con un
`replace` sobre la cadena: un replace tocaría también lo que hay dentro de
los atributos (un `href`, un `alt`) y podría partir el HTML por la mitad.
Tampoco se entra en `a`, `code` ni `pre` — un `@nombre` dentro de un `<a>`
sería un enlace dentro de otro, que no existe en HTML.

Como mucho **cinco menciones por mensaje**, y no es por rendimiento: un
mensaje con veinte menciones no es una conversación, es una lista de
correo.

### El correo que mencionaba a alguien

El patrón era `/@([a-z0-9][a-z0-9_-]{1,29})/gi`, y con él «escribe a
hola@pokedoc.es» mencionaba —y avisaba— a `@pokedoc`. Ahora el patrón se
come también el carácter de delante y exige que sea el principio del texto
o algo que no forme parte de una dirección.

No se usa un lookbehind (`(?<!…)`) a propósito: si un navegador viejo no
lo entiende, el error es **de sintaxis**, y un error de sintaxis tira el
módulo entero al cargarse — o sea que el tema no se vería.

## Cómo se ha probado

- `prueba-foro-mejoras.sql` — 23 comprobaciones contra PostgreSQL real:
  que quien escribe queda suscrito, que nadie ve las suscripciones ni las
  lecturas ajenas, que no se puede avisar en nombre de un mensaje ajeno,
  que quien apagó ese aviso no lo recibe, que el título se guarda plegado,
  que el cuerpo se guarda sin sus etiquetas y que la columna generada no
  se puede escribir a mano.
- `test-foro-mejoras.mjs` — 104 comprobaciones con Playwright sobre las
  seis funciones, incluido el hueco entre desplegar el código y ejecutar
  la migración (`__SIN_MIGRACION__`), donde el foro tiene que funcionar
  entero.
- `rigor-foro-mejoras.py` — rompe cada arreglo por separado y comprueba
  que la prueba se pone en rojo. **15 roturas, 15 pilladas** — pero solo
  a la segunda: la primera vuelta destapó que la comprobación del
  buscador por título miraba el texto de toda la página, y un tema
  encontrado por sus mensajes también enseña su título, así que daba por
  buena una búsqueda de títulos rota. Ahora mira solo la sección
  'Temas'.

Dos fallos de verdad que salieron de escribir la prueba, no de leerla: el
`mencionados` que `mensajeHtml()` usaba sin recibirlo (tiraba el tema
entero con un `ReferenceError`) y el correo que se leía como mención.

# El correo del foro

El foro entero se quedaba en la campanita, y la campanita solo la ve
quien entra. O sea: sigues un tema, te contestan, y no te enteras hasta
que vuelves por tu cuenta. Con una comunidad pequeña eso es lo que apaga
un foro.

Migración: `supabase-migration-correo-foro.sql`.

## A quién se le escribe

- A quien te **menciona** con @tunombre (`forum_mention`).
- A quien **sigue** el tema y a quien has **citado** (`forum_reply`).

No se escribe por cada mensaje a todo el mundo. La regla es la misma que
en `supabase-migration-correo-avisos.sql`: un correo se justifica cuando
alguien se dirige a ti, no cuando pasa algo cerca.

Quien abrió el tema no necesita caso aparte — el disparador
`trg_forum_suscribir_al_escribir` ya le suscribió al escribir el primer
mensaje.

## Por qué el disparador va sobre `forum_posts`

Por lo mismo que los otros dos no cuelgan de `user_notifications`: esa
tabla deja insertar a cualquiera una fila para cualquiera con el texto
que quiera, así que colgar el correo de ahí sería dejar que cualquier
miembro mandara un correo desde pokedoc.es con el asunto que le diera la
gana. En `forum_posts` la RLS ya demuestra quién escribió qué.

Y como en las otras, la función del disparador lleva su `revoke`: es
`security definer`, y sin eso PostgREST la expone como RPC.

## Dos tipos y no uno

`forum_reply` y `forum_mention` se pueden apagar por separado. «Avísame
solo si me llaman por mi nombre» es de las preferencias más pedidas y con
un solo tipo no se puede expresar.

Tienen además **claves de agrupación distintas**: `foro:<tema>` y
`foromen:<tema>`. Diez respuestas seguidas en un tema animado son un
correo (lo agrupa `enqueue_email`), pero una mención no se queda tragada
por ese correo — te están llamando por tu nombre, no es lo mismo.

Si algún día se añade un tipo hay que tocar **tres** sitios: la migración
que lo encola, `EMAIL_TYPES` en `js/notifications.js` y `NOMBRES` en
`netlify/functions/baja-correo.mjs`.

## Quitar las etiquetas: dos pasadas, no una

El cuerpo se guarda como HTML y hay que dejarlo en texto plano, tanto
para buscar las menciones como para la vista previa del correo. Y no vale
una sola pasada:

- Las etiquetas **de bloque** (`p`, `div`, `br`, `li`…) dejan un espacio.
  Sin él, `<p>hola</p><p>@ash</p>` es `hola@ash`, que por la regla de las
  direcciones de correo **deja de ser una mención**.
- Las **de dentro de una frase** (`b`, `i`, `a`, `code`…) no dejan nada.
  Con un espacio, `<b>@ash</b>,` se lee `@ash ,` y así sale en el correo.

## ⚠️ La regla de las menciones está duplicada

`menciones_de()` en la migración y `PATRON` + `BLOQUES` en
`js/menciones.js` tienen que decir lo mismo. No se puede compartir el
código —una vive en Postgres y la otra en el navegador—, así que lo que
se comparte son los casos de prueba: los mismos ocho casos están en
`prueba-correo-foro.sql` y en `test-foro-mejoras.mjs`. Si divergen,
alguien recibe el correo pero no ve el enlace en el mensaje, o al revés.

## Un fallo que venía de la tanda anterior

Escribir la versión SQL destapó que `textoPlano()` usaba `textContent` a
secas, que **pega los párrafos**. Empezar un párrafo con `@alguien` —lo
más normal del mundo— daba `hola@ash`, o sea una dirección de correo, y
no avisaba ni enlazaba a nadie. Con dos menciones en párrafos distintos
se perdía la segunda.

Estaba en producción desde la tanda de las mejoras del foro y ninguna
prueba lo miraba, porque todos los casos de prueba tenían la mención en
el mismo párrafo que el texto.

## Cómo se ha probado

- `prueba-correo-foro.sql` — 31 comprobaciones contra PostgreSQL real,
  ejecutando la migración de correo **de verdad** (no una copia de
  `enqueue_email`): lo que se prueba incluye la agrupación y las
  preferencias, que viven ahí dentro.
- `rigor-correo-foro.py` — 12 roturas, 12 pilladas. Más una en el lado
  JavaScript (volver a `textContent` a secas), también pillada.

Una comprobación que estaba mal planteada y pasaba en verde sin probar
nada: preguntaba si leer `email_outbox` desde la web daba error 42501. No
lo da — **la RLS filtra filas, no deniega el acceso**. Con RLS activada y
cero políticas la tabla se ve vacía, que es lo que hay que comprobar:
que hay filas y que desde la web no se ve ninguna.

# Que las menciones se noten

Las menciones funcionaban y aun así parecían rotas, por una razón simple:
**no había ninguna señal**. Escribías `@loquesea`, no pasaba nada, y no
tenías forma de saber si habías acertado hasta después de publicar.

Tres cosas, y solo la primera es nueva.

## La lista al escribir @

`js/mencion-autocompletar.js`. Escribes `@`, sale una lista con avatar,
nombre y **nombre de usuario** —que es lo que hay que escribir—, y se
elige con las flechas, con Enter, con Tab o con el ratón.

Busca por las dos cosas: por nombre de usuario y por el nombre que se ve,
este último contra `search_norm`, así que escribir `@jesus` encuentra a
«Jesús». Y con la arroba sola lista a los primeros: en una comunidad
pequeña, «¿quién hay?» es una pregunta razonable.

Lo que inserta es **texto plano** (`@nombre`), no un enlace. El enlace lo
pone `enlazarMenciones()` al pintar el mensaje publicado, así que el
cuerpo que se guarda es idéntico se haya escrito a mano o con la lista, y
el saneador no tiene que dejar pasar nada nuevo.

El patrón que decide si estás escribiendo una mención empieza **igual**
que `PATRON` en `js/menciones.js`. Tiene que ser así: si la lista
ofreciera algo que el patrón luego no reconoce, te dejaría elegir a
alguien a quien no se va a avisar. Por eso en «escribe a hola@» no sale
nada, igual que `hola@pokedoc` no es una mención.

### Tres cosas que solo se ven al probarlo

- **El espacio del final tiene que ser duro (` `).** Uno normal al
  final de un párrafo se colapsa: el navegador lo borra al escribir la
  letra siguiente, y `@misty mira` se convertía en `@mistymira`. Como no
  es ninguno de los caracteres que forman un nombre, el patrón lo trata
  como separador igual que un espacio normal.

- **El `keyup` deshacía lo que hacía el `keydown`.** Las teclas de la
  lista se manejan en `keydown`, pero su `keyup` llegaba después y volvía
  a buscar y repintar: la flecha abajo movía la marca y 120 ms más tarde
  volvía a la primera opción, y Escape cerraba la lista para que se
  abriera sola acto seguido. Ahora esas cinco teclas se ignoran en
  `keyup`, y Escape recuerda qué mención cerró para no reabrirla.

- **`mousedown` con `preventDefault`, no `click`.** Sin eso, pulsar en la
  lista le quita el foco a la caja de escribir, se pierde el cursor y ya
  no hay dónde insertar el nombre.

## La vista previa enseña las menciones

Prometía «lo que ves aquí es lo que se va a ver ahí» y era el único sitio
donde comprobar un `@nombre` antes de publicarlo — pero ahí salía en
texto plano existiera esa persona o no. Ahora se pinta dos veces: primero
el texto (inmediato, que es lo que se está escribiendo) y detrás con los
enlaces, cuando llega la consulta. Al revés se vería un parpadeo en cada
tecla.

## Mayúsculas: el navegador y el correo comparaban distinto

`perfilesMencionados()` buscaba con `in('username', …)`, o sea texto
exacto, mientras que el disparador del correo compara `lower(username)`.
Hoy coinciden porque todos los usernames son minúsculas desde la
migración de usernames, pero bastaba **un** username con una mayúscula
para que a esa persona le llegara el correo y en el mensaje no se le
viera el enlace. Ahora el navegador usa `ilike` sin comodines, que es una
igualdad insensible a mayúsculas — la misma comparación que hace la base.

## Cómo se ha probado

31 comprobaciones nuevas en `test-foro-mejoras.mjs`, incluida la de punta
a punta: elegir de la lista, publicar, y comprobar que sale el enlace
**y** que le llega el aviso a esa persona.

Rigor con `rigor-menciones.py`: 10 roturas, 10 pilladas — pero **tres solo
a la segunda**, y las tres por lo mismo: la prueba miraba que la cosa
pasara, no que pasara *por la razón correcta*.

- Escape: se comprobaba que la lista se cerraba, y se cerraba igual sin
  recordar que se había cerrado a mano, porque nada volvía a abrirla en
  esos 200 ms. Ahora se pulsa Shift después (una tecla que no escribe ni
  mueve el cursor, pero que sí vuelve a mirar si hay una mención) y se
  comprueba que sigue cerrada — y que escribir otra letra sí la reabre.
- Buscar por el nombre que se ve: se escribía `@je` para encontrar a
  «Jesús Martínez», pero su nombre de usuario ES `jesus`, así que lo
  encontraba por ahí y la parte de `search_norm` no se probaba. Ahora se
  le cambia el nombre a «Álex Ruiz» y se escribe `@alex`, que su nombre
  de usuario no puede encontrar.
- El `preventDefault` del `mousedown`: comprobar que al pinchar se
  inserta el nombre no distingue nada, porque el nombre se inserta en el
  propio `mousedown`, antes de que se pierda el foco. Lo que hay que
  comprobar es lo de después: que se puede **seguir escribiendo** donde
  estabas.

# La guía y su curso eran dos islas

Una guía tiene dos mitades —la teoría y el curso— que viven en páginas
distintas. Y no se enlazaban en ninguna dirección: leías la guía entera
sin enterarte de que existía un curso, y acababas el curso sin manera de
volver a la teoría más que buscando la guía otra vez por el catálogo.

## De la guía al curso: dos sitios, dos pesos

- **Arriba**, junto a Guardar, un botón pequeño. Quien ya sabe que quiere
  el curso lo encuentra sin leerse la teoría entera, y a quien viene a
  leer no le tapa nada.
- **Al final**, la llamada de verdad: «¿Te ha servido? Ponlo a prueba»,
  diciendo lo que hay al otro lado (preguntas, racha, medalla) y cuánto
  se tarda.

Los dos solo aparecen si esa guía **tiene** curso (`guideHasCourse`).

El de abajo va **antes** de «Me ha servido» y de las estrellas, y es a
propósito: acabas de leer y lo siguiente que quieres hacer es ponerlo a
prueba, no puntuar.

Nota histórica: aquí hubo un CTA de «Hacer el curso» que se quitó al
meter el foro de comentarios (commit `36b5c50`). No se quitó por malo —
lo desplazó otra cosa. Vuelve repartido en dos pesos para que no compita
con los comentarios.

## Del curso a la guía

En la pantalla final, «Repasar la teoría». Es lo que se pide justo
después de fallar algo: «vale, ¿y esto dónde lo explican?».

Solo en el curso de una guía (el reto diario y el repaso mezclan
preguntas de varias, así que no hay *una* teoría a la que volver) y solo
si esa guía tiene documentación (`guideHasReference`).

## La valoración era del curso pero puntuaba la guía

Al terminar el curso se pintaban las estrellas con el título «¿Qué te ha
parecido el curso?». Escribían en `guide_reviews`: **la nota era de la
guía**. Quien acababa el curso puntuaba una documentación que a lo mejor
ni había abierto, y esa nota es la que sale luego en las tarjetas, en el
buscador y en las estadísticas de autor.

Quitada del curso. La valoración vive en la guía, al terminar de leerla,
que es donde se tiene opinión sobre lo que se está puntuando.

La prueba comprueba las dos mitades: que al acabar el curso no se valora
nada **y** que las estrellas siguen estando en la guía. Sin lo segundo,
«quitar la valoración del curso» y «cargarse la valoración del sitio»
darían el mismo verde.

## Cómo se ha probado

`test-guia-curso.mjs`, 28 comprobaciones. Rigor: 7 roturas, 7 pilladas —
dos de ellas después de arreglar la prueba, y las dos por el mismo vicio
de siempre:

- `count()` en vez de `isVisible()`: esconder la llamada con CSS la
  dejaba en el DOM, así que contarla seguía dando 1.
- Buscar `#cursoRating` (el hueco donde iban las estrellas) en vez de las
  estrellas: quitar el contenedor no impide que alguien las pinte en otro
  sitio de la pantalla final. Ahora se buscan las clases del propio
  widget.

# Correo cuando alguien te sigue

Hasta ahora un seguidor nuevo solo llegaba a la campanita, o sea solo si
entrabas. Ahora también por correo.

Migración: `supabase-migration-correo-seguidores.sql`.

## Por qué este sí, si la norma era «solo lo que se pierde»

La regla de `supabase-migration-correo-avisos.sql` es que un correo se
justifica cuando alguien **se dirige a ti** y la cosa se pierde si no la
ves. Un seguidor no espera respuesta, así que en su día se dejó fuera a
propósito.

Entra ahora porque en una comunidad que arranca un seguidor nuevo **sí**
es una señal: es la prueba de que hay alguien al otro lado. Pero entra
con una condición.

## La condición: agrupado por destinatario

La clave de agrupación es `follow:<a-quien>`, **una por destinatario y no
una por pareja**. `enqueue_email` deja pasar como mucho un correo con la
misma clave cada media hora, así que cinco seguidores en diez minutos son
un correo, no cinco. Sin esa agrupación esto no estaría aquí.

Tiene una consecuencia que se acepta: el asunto nombra al primero de la
tanda, no a todos. Prometer «y 4 más» obligaría a contar al enviar y no
al encolar, y no compensa.

Y de paso cierra un agujero: sin agrupar, dejar de seguir y volver a
seguir en bucle sería un correo por vuelta. La prueba lo comprueba.

## Detalles

- El enlace lleva **al perfil de quien te sigue**, que es lo que quieres
  mirar para decidir si le devuelves el seguimiento.
- La vista previa es **su bio**, si la tiene: da contexto sin abrir nada.
  Sin bio se encola igual, solo que sin previa.
- No se avisa de un seguidor **baneado**, ni se escribe a una cuenta
  baneada.
- El nombre pasa por `email_preview`, que colapsa los espacios. Aquí eso
  importa más que en los otros dos avisos: el nombre lo elige **quien
  sigue**, o sea que es texto de un desconocido yendo a la cabecera
  `Subject` de un correo que mandamos nosotros. Un `\n` ahí permitiría
  inyectar cabeceras.

## Cómo se ha probado

`prueba-correo-seguidores.sql`, 18 comprobaciones contra PostgreSQL real
con la migración de correo de verdad. Rigor: 7 roturas, 7 pilladas — la
del salto de línea, solo después de añadir el caso, porque ningún usuario
de prueba tenía un nombre con `\n`.

Y un fallo de la propia prueba que apareció al pasarla dos veces: salía
en rojo la segunda vez. `base-foro.sql` no tira `user_follows` ni
`email_outbox` (esta última sobrevive incluso al `drop schema auth
cascade`: el CASCADE se lleva la clave ajena, no la tabla), así que la
segunda pasada chocaba con las filas de la primera y el disparador ni
llegaba a ejecutarse. **La prueba estaba en rojo por estar sucia, no por
estar mal** — que es el fallo más caro de diagnosticar de los dos.

# La analítica no estaba rota: es que no sabía decir si lo estaba

La pantalla de Analítica del panel funciona —está bien cableada y se
pinta sin errores—, pero tenía un defecto que la hacía indistinguible de
una pantalla muerta.

## Un cero y un error se veían igual

```js
const views = viewsRes.data || []      // ← y si viewsRes.error?
```

Nadie miraba `viewsRes.error`. Si la consulta se caía —la tabla no existe
porque falta la migración, la RLS no deja leerla, lo que sea— se cogía el
`|| []` y la pantalla enseñaba un tranquilo **«0 visitas»**. Exactamente
lo mismo que si de verdad no hubiera entrado nadie.

`user_progress` sí se contaba aparte (tiene su propia migración y su
propia nota). Ahora se comprueban **las seis** consultas y lo que falle
sale arriba en un aviso ámbar, con el mensaje de la base y, cuando se
sabe, la migración que probablemente falta.

El aviso es ámbar y no rojo a propósito: la pantalla sigue siendo útil
con lo que sí ha llegado, y pintarla entera de rojo haría pensar que no
vale nada.

## `gte` y `lte` eran no-ops en el doble de Supabase

Al ir a probar esto salió algo peor: el Supabase falso trataba `.gte()` y
`.lte()` como si no existieran.

```js
if (['select', 'gte', 'lte', 'textSearch', 'contains'].includes(prop)) {
  return (...args) => con({})     // no hacía nada
}
```

O sea que **ningún filtro por fechas del sitio se había probado nunca**.
«Los últimos 7 días» del panel devolvía la tabla entera y la prueba lo
daba por bueno. Ya están implementados, comparando fechas como fechas
(con cadenas, `'9'` sale mayor que `'10'`) y dejando fuera los nulos,
igual que SQL.

## Y `page_views` no estaba en el doble

Tampoco estaba la tabla, así que `matchTable` devolvía un array nuevo y
vacío en cada llamada: los insert se perdían y las lecturas daban cero.
La pantalla salía a cero **siempre**, con lo cual no había forma de ver
si estaba bien o rota — que era justo lo que había que mirar. Ahora tiene
nueve visitas sembradas, una de ellas fuera de la ventana de siete días
para que el filtro tenga algo que descartar.

## De paso: la tabla de páginas se lee

- Los temas del foro se juntan todos en `/tema`. Aquí la razón no es la
  privacidad (esa es la de `/usuario`) sino que **la ruta es un uuid**:
  cincuenta filas de `/tema/8f3a1c…` no le dicen nada a nadie. Para saber
  qué temas se leen ya está el contador de visitas de cada tema.
- `/foro/<slug>` sí se guarda entero: el slug se lee, y saber qué foro se
  usa es justo lo interesante.
- `/foro` y `/tema` tienen nombre legible en la tabla.

## Cómo se ha probado

`test-analitica.mjs`, 20 comprobaciones: con datos, con la tabla caída, y
las reglas de normalización de rutas (estas últimas sin navegador, que
son funciones puras). Rigor: 5 roturas, 5 pilladas.

Un detalle de la prueba que costó un rojo: abrir `/admin` **registra su
propia visita**, así que el total no es exactamente el sembrado. La
comprobación de los periodos compara los dos en la misma pestaña —la
ventana ancha tiene que ver más que la estrecha— en vez de esperar un
número fijo.

# El hilo de actividad tampoco sabía decir que estaba roto

Mismo fallo que el de la analítica, encontrado buscando el patrón a
propósito: `js/activity.js` hacía **seis consultas y no miraba ni un solo
`.error`**. Si fallaban, el hilo enseñaba «Todavía no hay actividad. ¡Sé
el primero!» — y eso en la pantalla donde se mira si la comunidad está
viva.

La regla ahora es una sola: **solo se dice que no hay actividad cuando
TODAS las fuentes han contestado.** Si alguna falló, se dice «no se ha
podido cargar» y ya.

Y con dos límites deliberados:

- **Sin detalles técnicos en pantalla.** Esto lo lee cualquiera que
  entre, no el equipo. El nombre de la tabla y el mensaje de la base van
  al registro de errores (`logClientError`), que es donde se ven.
- **Un fallo parcial no se anuncia.** Si cinco fuentes contestan y una
  no, se enseña lo que hay: el hilo es útil igual y el aviso sería ruido.
  Solo cambia lo que se dice cuando no hay NADA que enseñar.

`loadActivity()` devuelve ahora `{ eventos, fallos }` en vez de un array.
Son dos llamadas en todo el sitio (la home y `/usuarios`); en la home, si
no hay eventos el bloque no se abre — ni para decir que está vacío ni
para decir que falló, porque ahí es un extra de la portada.

# Escribir una guía no se veía por ninguna parte hasta aprobarla

Una guía tarda días en escribirse. Hasta ahora, durante todos esos días
—y durante los que la cola de revisión tardase en atenderse— **el hilo de
actividad no decía absolutamente nada**: quien la estaba escribiendo no
recibía ni una señal de que alguien se hubiera enterado, y el resto de la
comunidad no veía que hubiera nadie escribiendo. En una comunidad que
arranca y que necesita guías, eso es justo lo contrario de lo que hay que
premiar.

`loadActivity()` tiene ahora una **séptima fuente**: las guías en
revisión.

```js
supabase
  .from('guides')
  .select('id, title, slug, author_id, submitted_at')
  .eq('review_status', 'pending')
  .not('submitted_at', 'is', null)
  .not('author_id', 'is', null)
  .order('submitted_at', { ascending: false })
  .limit(POR_FUENTE)
```

Sale como «*Fulano* **ha enviado a revisión la guía** *Título*», con
verbo propio: decir «ha publicado» de algo que aún no lo está le
prometería a quien lo lee una guía terminada.

## Qué NO sale, y por qué

- **Los borradores no.** Enviar a revisión es un acto deliberado de «esto
  ya lo enseño»; un borrador a medias es privado, y anunciarlo sería
  publicarlo sin permiso.
- **Las rechazadas tampoco.** No es una noticia que se le quiera dar a la
  comunidad y menos a quien la escribió.

El detalle que hace falta saber para no equivocarse aquí:
`js/editor-guia.js` **conserva el `submitted_at` viejo** al volver a
guardar como borrador (`submitted_at: reviewStatus === 'pending' ? now :
existingGuide?.submitted_at || null`). O sea que una guía enviada,
rechazada y en proceso de reescritura es una fila con `review_status =
'draft'` y una **fecha de envío reciente** — iría directa a la cabecera
del hilo. Lo único que la mantiene fuera es el filtro por estado.

## Se puede enlazar

La política `guides_select` deja ver las `pending` **a propósito** (`using
(published_at is not null or review_status = 'pending' or auth.uid() =
author_id or is_admin())`, ver `supabase-migration-community-guides.sql`)
y `guia.html` ya pinta el aviso de «pendiente de revisión». El enlace del
hilo lleva ahí y no a un 404.

## Cómo se ha probado

Cinco comprobaciones más en `test-menciones-fuera.mjs`. Rigor: 4 roturas,
4 pilladas — pero la del borrador **estuvo verde por el motivo
equivocado** en la primera pasada. El doble de Supabase tenía el borrador
con `submitted_at: null`, así que al colarse se ordenaba por la época de
Unix, caía al fondo del hilo y se salía del recorte de 20. La prueba
decía «no aparece» y lo que estaba comprobando era que aparecía el
último. Poniéndole al doble la fecha reciente que tendría de verdad, la
rotura sale roja.

# Menciones fuera del foro

Las menciones solo existían en el foro. Los comentarios de guías, el muro
del perfil y los mensajes privados eran un `<textarea>` pelado: alguien
aprendía a mencionar en el foro, lo probaba ahí y no pasaba nada.

## La lista de @ ahora también funciona en un `<textarea>`

`js/mencion-autocompletar.js` solo sabía de `contenteditable` (nodos de
texto y rangos). Un textarea es otra cosa: una cadena y un número. Se ha
añadido una rama para eso, compartiendo lo único que importa que sea
igual — **el patrón**: si la lista ofreciera algo que `PATRON` luego no
reconoce, te dejaría elegir a alguien a quien no se va a avisar.

Dos diferencias que no son capricho:

- **Dónde se coloca.** En un textarea no hay forma barata de saber dónde
  está el cursor en pantalla (haría falta medir el texto con un div
  espejo). Se ancla debajo de la caja entera: predecible, sin duda de a
  qué pertenece, y en el móvil no se pelea con el teclado.
- **El espacio del final es uno normal**, no el duro. En un textarea el
  valor es texto plano y no lo colapsa nadie; el espacio duro del otro
  camino era por cómo pinta el navegador un `contenteditable`.

## En los mensajes privados se enlaza, pero NO se avisa

Esto es lo único con enjundia de la tanda. Mencionar a alguien en una
conversación privada **no puede mandarle un aviso**: le llegaría «te han
mencionado» por un mensaje que no puede leer, y de paso le diría que dos
personas están hablando de él.

El enlace sí se pone —«habla con @jesus» y lo abres— porque no sale de la
pantalla de quien ya podía leer el mensaje.

## Sin avisos duplicados

En el muro, quien recibe el «comentario en tu muro» no recibe además el
de mención si se le nombra en el mismo comentario. En los comentarios de
guías, el aviso de mención va aparte del que ya manda
`notifyGuideComment` (al autor de la guía y a quien se responde).

## Cómo se ha probado

`test-menciones-fuera.mjs`, 24 comprobaciones sobre las cuatro pantallas.
Rigor: 8 roturas, 8 pilladas — una a la segunda, y por el vicio de
siempre: la comprobación del aviso duplicado mencionaba a **un tercero**
en el muro de Misty, y así el duplicado no se puede dar por definición.
Ahora se menciona a la propia dueña del muro, que es el único caso donde
la regla hace algo.

Para poder probar el hilo de actividad caído hizo falta que el doble de
Supabase supiera fallar **una consulta concreta** y no todas las de una
tabla: `user_profiles` la usa media web, y tumbarla entera habría roto la
página en vez de vaciar el hilo. Se apuntan ahora las columnas que pide
cada `select` para poder distinguirlas.

# Mandar una guía a revisión la cerraba con llave

Lo contó alguien que estaba escribiendo una: le dio a **Enviar a
revisión**, y a partir de ahí ya no podía tocarla. Ni para corregir una
errata, ni para terminar lo que le faltaba. La única forma de recuperar
el control era que el equipo se la **rechazara**.

Escribir una guía lleva días, y no todo el mundo entiende que ese botón
es definitivo. El que la mandó a medias —para ver cómo quedaba, o sin
saberlo— se quedaba sin poder seguir.

## Lo impedían TRES capas, no una

Es lo que hace que este arreglo no sea de una línea. Cualquiera de las
tres por separado deja el problema en pie:

1. **La política de RLS** (`guides_author_update`): `using (… review_status
   in ('draft', 'rejected'))`. Sin tocar esto, el editor guarda y la base
   rechaza la fila **en silencio** — cero filas afectadas, sin error.
2. **El editor** (`js/editor-guia.js`): `loadExistingGuide()` te mandaba a
   `perfil.html` si el estado no era `draft` o `rejected`.
3. **El panel "Mis guías"** (`js/perfil.js`): sin botón de Editar.

Y encima faltaba lo que él pidió expresamente: poder llegar al editor
**desde la propia guía**, que es la pantalla donde el autor relee lo que
lleva escrito.

## Qué se ha abierto y qué no

Abierto: el autor edita su guía en `pending`. Cerrado, igual que antes:

- **Las `approved` siguen sin poder tocarse.** Esa ya la ha leído alguien
  del equipo y la está leyendo la comunidad; cambiarla por detrás sería
  publicar sin revisar. Para eso están las sugerencias de corrección.
- **Borrar en revisión, tampoco.** Está en la cola de alguien, y que
  desaparezca mientras la están leyendo es peor que pedir que la quiten.
  Por eso `canEdit` y `canDelete` dejaron de ser la misma variable.
- **El `with check` no se toca** (`draft`/`pending`): es lo que impide que
  un autor se apruebe a sí mismo la guía.

## Baneados y silenciados: la condición nueva

La política vieja no los miraba, y al ampliar a `pending` hay que
decirlo:

```sql
using (
  auth.uid() = author_id
  and (
    review_status in ('draft', 'rejected')
    or (review_status = 'pending' and not is_banned() and not is_muted())
  )
)
```

La condición va **solo en la rama nueva**, a propósito. Editar un
borrador es privado y no llega a nadie, así que quien pudiera hacerlo
antes lo sigue pudiendo hacer — sin regresiones. Pero una guía en
revisión está **a un clic de publicarse**: dejar que un baneado le siga
metiendo mano sería colarle contenido a la cola de publicación.

## Los dos botones del editor no valían

Una guía ya enviada no se puede guardar con los mismos botones que un
borrador, y esto es lo más fácil de hacer mal:

- **"Guardar borrador"** la habría sacado de la cola del equipo sin
  decírselo a nadie. El autor creería que guarda y lo que estaría
  haciendo es **retirarla de revisión**.
- **"Enviar a revisión"** no significa nada cuando ya está enviada.

Se deja un botón solo, **"Guardar cambios"**, y un aviso arriba diciendo
que el equipo revisará la última versión guardada.

## La trampa: `submitted_at`

Esta es la que se cuela sola. El hilo de actividad ordena por
`submitted_at` y anuncia *"ha enviado a revisión la guía X"*. Si guardar
pisara esa fecha, alguien que se pasa la tarde puliendo su guía **volvería
a la cabecera del hilo cada vez que le da a guardar**. La fecha se pone
solo en el salto de borrador a revisión:

```js
submitted_at:
  reviewStatus === 'pending' && existingGuide?.review_status !== 'pending'
    ? new Date().toISOString()
    : existingGuide?.submitted_at || null,
```

Y va con su comprobación en la prueba, porque el descuido no se ve
mirando el editor: se ve dos pantallas más allá.

## Cómo se ha probado

**SQL contra un PostgreSQL de verdad** (13 comprobaciones, con el rol
`webuser` que sí pasa por RLS), sobre las políticas copiadas tal cual de
producción. Dos rojos, los dos de la prueba y no del código, y los dos
instructivos:

- El "baneado" era el **usuario 3 de `base-foro.sql`, que es el ADMIN**.
  La política `guides_admin_all` le daba el permiso, así que la
  comprobación salía verde sin probar nada del baneo. Hizo falta un
  usuario nuevo.
- Editar una rechazada **dejándola en `rejected`** da 42501, porque el
  `with check` solo admite `draft`/`pending`. No es un fallo: el editor
  escribe siempre el `review_status` al guardar, así que una rechazada
  vuelve como borrador. La prueba estaba pidiendo algo que la app no
  hace.

**Navegador**: `test-editar-en-revision.mjs`, 26 comprobaciones sobre las
cuatro pantallas. Rigor: **9 roturas, 9 pilladas**.

Un tercer rojo que también era del doble de Supabase: la guía pendiente
de prueba tenía `reference_blocks: []`, y eso **es un estado que la app no
puede producir** — para llegar a `pending`, `save()` exige que haya
bloques. El guardián de contenido vacío bloqueaba el guardado y la prueba
salía roja por eso y no por lo que medía. De paso salió un detalle real:
ese guardián decía *"añade contenido antes de enviarla a revisión"* a
quien solo estaba guardando algo ya enviado. Ahora dice lo que pasa.

# Los legales ya dicen quién hay detrás

Faltaba lo básico: la política de privacidad explicaba bien el
tratamiento pero **no identificaba a un responsable ni daba una dirección
de contacto**, así que no había a quién escribir para ejercer derechos.
Con 20 invitados se aguanta; abriendo al público, no.

Lo que se ha añadido, en `privacidad.html`:

- **Responsable y contacto** (`info@pokedoc.es`), que es el art. 13.1.a
  del RGPD.
- **Base jurídica** de cada tratamiento: ejecución del servicio para la
  cuenta y lo que publicas, consentimiento para los correos, interés
  legítimo para moderar y para saber qué páginas se usan.
- **Plazos de conservación**, con 12 meses para visitas y errores.
- **Transferencias fuera del EEE**: Supabase, Netlify y Google pueden
  procesar fuera, amparado en cláusulas contractuales tipo.
- **Derechos completos** (acceso, rectificación, supresión, limitación,
  oposición, portabilidad, retirada del consentimiento) y la **AEPD** como
  vía de reclamación.
- **Edad mínima de 14 años** y aviso de cambios.

Y dos tratamientos que **estaban ocurriendo sin declararse**, encontrados
al repasar el esquema en vez de al leer la página:

- **`page_views`** guarda qué página se visita y cuándo, con `user_id` si
  hay sesión abierta.
- **`client_errors`** guarda el mensaje de error, la página y el
  navegador, también con `user_id`.

Ninguno de los dos aparecía en "qué datos guardamos". No son opcionales
de mencionar: llevan identificador de usuario, así que son datos
personales.

En `terminos.html`: titular y contacto, **edad mínima**, **ley aplicable**
(española, con los fueros del consumidor a salvo) y una cláusula de
**responsabilidad** que dice en voz alta lo que el sitio es — información
orientativa hecha por aficionados, no un peritaje; si hay dinero de por
medio, contrastar con un servicio de autentificación profesional.

El responsable es **Iker López**, persona física, en las dos páginas — si
cambia una tiene que cambiar la otra, y va dicho en el comentario de
ambas. No lleva NIF a propósito: eso lo pide el art. 10 de la LSSI para
quien ejerce **actividad económica**, y PokeDoc no vende, no intermedia y
no muestra publicidad. Lo que sí exige el RGPD (art. 13.1.a) es la
identidad del responsable y una vía de contacto, y eso está. El día que
haya una entidad detrás, ahí van la denominación social y el NIF en lugar
de la persona física.

# El foro y el editor no se encontraban desde la portada

Se lo dijeron a él: *«que sí, que está en el menú, pero para que sea más
visible»*. Y tenían razón — un menú hay que **abrirlo** para saber lo que
hay dentro. Quien llegaba a pokedoc.es veía guías, categorías y un reto
diario, y no tenía forma de enterarse de que esto es una **comunidad
donde se pregunta y se escribe**, no una web de leer artículos.

Dos tarjetas nuevas en la portada, justo debajo del reto del día:

- **Entra en el foro** → `foro.html`
- **Escribe una guía** → `editor-guia.html`

## Tres decisiones

**Van en HTML, no pintadas por JavaScript.** Son enlaces de navegación:
tienen que existir desde el primer instante, sin esperar a que cargue un
módulo, y poder rastrearse. Por eso los dos iconos van como SVG en línea
en vez de `icons.messageSquare(20)` — es la misma pareja de rutas
copiada de `js/icons.js`.

**Se le enseñan también a quien NO ha entrado.** Es el caso que importa:
alguien que llega desde una story y todavía no tiene cuenta. Si los
atajos solo salieran con sesión, no explicarían nada justo a quien hay
que convencer. Al pulsar «Escribe una guía» sin sesión, `requireAuth()`
lo manda a registrarse — que es exactamente lo que se busca.

**Reutilizan `.reto-tarjeta`**, la tarjeta del reto diario, en vez de
inventar un componente. Con un `margin-top` de 20 px en la sección, para
que cuando el reto también esté visible se lean como **dos grupos** y no
como una fila de cuatro cosas iguales.

## Cómo se ha probado

`test-atajos-portada.mjs`, 17 comprobaciones: que se ven (con `isVisible`
y no con `count`, porque un enlace tapado no lo encuentra nadie), que se
ven **sin cuenta**, que llevan a donde dicen, que sin sesión el de
escribir acaba en el registro, y que en el móvil no aparece scroll
horizontal.

Rigor: 6 roturas, 6 pilladas — **a la segunda**. Las dos primeras
escondían el enlace con el atributo `hidden`, y no pasaba nada: el
`[hidden] { display: none }` del navegador **pierde** contra el
`display: flex` de `.reto-tarjeta`, así que la "rotura" no rompía nada y
la prueba acertaba al decir que el enlace seguía a la vista. El fallo era
del script de rigor, no del test ni del sitio — el `.hidden` propio de
PokeDoc sí lleva `!important` y funciona. Cambiado a un `style` en línea,
las seis salen rojas.

# El spoiler

Faltaba poder plegar un trozo de texto. Sin eso, una guía larga o un tema
del foro se convierten en un muro: el que responde con la lista entera de
su colección, el que quiere destripar la respuesta de un acertijo sin
destripársela a quien todavía no ha mirado, el que mete cuatro párrafos
de contexto que la mayoría se va a saltar.

Es un **`<details>` con su `<summary>`**, nativo. Se pliega y se despliega
**sin una línea de JavaScript**, y el teclado lo abre igual que el ratón.
De ahí que sea esto y no un `div` con un `click`: no hay estado que
sincronizar, no hay nada que romper si falla un módulo, y sale accesible
de fábrica.

Como las guías y el foro comparten editor (`richtext-editor.js`) y
saneador (`richtext-format.js`), sale **en los dos sitios a la vez**.

## Abierto para quien escribe, cerrado para quien lee

La decisión que sostiene todo lo demás:

- **En el editor, siempre abierto.** No es capricho: dentro de un
  `contenteditable`, pulsar el resumen **coloca el cursor en vez de
  plegar**. Un spoiler cerrado sería contenido que el autor no puede ni
  ver ni tocar.
- **Publicado, siempre cerrado.** El atributo `open` **no está** en
  `ALLOWED_ATTR`, así que se cae al sanear. Deje el autor el editor como
  lo deje, el lector recibe el spoiler plegado — que es lo que se pide al
  ponerlo.

Son dos caminos distintos, y esto importó: el spoiler recién insertado
nace abierto por su cuenta (`det.open = true` en `ponerSpoiler`), pero el
que viene **guardado** llega cerrado y hay que abrirlo al cargar
(`abrirSpoilers()`). La primera versión de la prueba solo cubría el
primero.

## Lo que normaliza el saneador

Cuatro reglas, todas por el mismo motivo: que no se publique un spoiler
roto.

- Un `<details>` **sin `<summary>`** recibe uno que dice «Spoiler». Sin
  eso el navegador pinta un triángulo sin etiqueta.
- Un resumen **en blanco**, lo mismo.
- Un spoiler **sin nada dentro** se tira: es un botón que al pulsarlo no
  abre nada. Para saber si está vacío hay que mirar lo de fuera del
  resumen, porque el resumen también cuenta como texto del `<details>`.
- Un `<summary>` **suelto**, fuera de su `<details>`, se deshace: el
  navegador lo pinta como un párrafo con un triángulo delante que no
  hace nada.

## Cómo se ha probado

`test-spoiler.mjs`, 35 comprobaciones: ponerlo en el editor, meter dentro
lo que estaba seleccionado, reabrir una guía guardada, las cuatro
normalizaciones, que no se cuele un `onclick` ni un `<script>`, y que
quien lee —tanto una guía como un tema del foro— lo reciba cerrado, lo
abra al pulsar y **también con el teclado**.

Rigor: **9 roturas, 9 pilladas, a la segunda**. La que se escapó fue
apagar `abrirSpoilers()`, y el motivo es el de arriba: la prueba miraba
solo el spoiler recién puesto, que nace abierto solo. El caso que
faltaba —volver a abrir una guía que ya tenía uno guardado— es
precisamente el que deja al autor sin poder tocar su propio texto.

# Compartir una guía o un tema

Hasta ahora, pasarle una guía a alguien pedía ir a la barra del navegador
y copiar la dirección a mano. En el móvil eso es bastante trabajo, y el
móvil es donde está casi todo el mundo. Cada persona que comparte es
alcance que no cuesta nada.

Un botón en la guía (junto a Guardar) y otro en el tema del foro (junto a
Seguir), los dos desde `js/compartir.js`.

## Dos caminos, y el segundo no sobra

- **Si el navegador tiene `navigator.share`** —el móvil, y algún
  navegador de escritorio— se abre **la hoja de compartir del sistema**:
  WhatsApp, Telegram, el correo, lo que tenga instalado. Es lo que la
  gente espera al pulsar ese icono.
- **Si no la tiene**, se copia el enlace al portapapeles y se avisa. Sin
  ventanas propias que mantener.

Y dentro del segundo camino hay **otro repuesto**:
`navigator.clipboard` solo existe en contexto seguro (https o
localhost). Quien entre por http o con un navegador viejo se quedaría
con un botón que no hace nada, así que se cae a un `<textarea>` fuera de
pantalla con `execCommand('copy')`.

## Compartir NO pide cuenta

A diferencia de «Seguir», el botón se le enseña también a quien no ha
entrado. Es media gracia del asunto: alguien llega desde fuera, le
resuelve la duda, y se lo pasa a otro que tiene la misma.

## Cancelar no es fallar

El detalle que se suele hacer mal: abrir la hoja del sistema y cerrarla
sin elegir nada **lanza `AbortError`**. No es un error, es alguien que ha
cambiado de opinión — enseñarle «no se ha podido compartir» sería
mentirle. Se distingue por el nombre del error: `AbortError` se traga en
silencio, y cualquier otro sí cae al camino de copiar, para que el botón
nunca se quede sin hacer nada.

## Cómo se ha probado

`test-compartir.mjs`, 20 comprobaciones: el botón en las dos pantallas,
también sin cuenta, que copia **la dirección de lo que se está mirando** y
no otra, el repuesto sin portapapeles moderno, que con hoja del sistema
la usa **y no copia además** (si no, saldría un aviso por encima de la
hoja), que cancelar no dice nada, y que un fallo de verdad sí cae a
copiar.

Rigor: **8 roturas, 8 pilladas**.

## El botón se veía mal en el móvil

Lo cazó Iker en su teléfono, no la prueba. Compartir salía **en su propia
línea, pegado a la izquierda y con el botón grande**, mientras Guardar se
quedaba arriba a la derecha.

Dos causas encadenadas:

1. `#btnSave` llevaba su tamaño compacto en un `style=` **en línea**, y
   `.guia-compartir` no tenía ninguna regla. Uno compacto, otro no.
2. El `margin-left: auto` estaba en **Guardar**, no en un grupo. En cuanto
   la línea no cabía, Compartir se envolvía él solo.

Ahora los tres botones (Guardar, Compartir y, si la hay, ir al curso) van
en un `.guia-acciones` que se envuelve entero o no se envuelve, con el
tamaño en el CSS y no en un atributo. Debajo de 560 px baja completo y
pegado a la izquierda.

**La lección del rigor, otra vez la de siempre:** las dos primeras
comprobaciones que escribí eran **relativas** —«Compartir mide lo mismo
que Guardar»— y **pasaban con el fallo puesto**, porque al quitar la
regla los dos se hacían grandes a la vez. Con una medida absoluta (el
botón compacto mide 28 px, el grande 43) las tres roturas salen rojas.

Y el arreglo trajo su propia regresión, que pilló la suite: quité la
clase `guia-ir-al-curso` por redundante y `test-guia-curso.mjs` la usaba
como asidero. La clase se queda aunque no pinte nada.

# Cuando alguien envía una guía a revisión, no se enteraba nadie

El agujero, encontrado buscándolo: **no había ningún aviso**. La fila se
quedaba en la cola de `/admin` esperando a que alguien del equipo entrara
a mirar por su cuenta. Con veinte personas se aguanta; con el foro
abierto, una guía puede pasarse días muerta mientras su autor piensa que
le están ignorando — y escribir una guía cuesta días de trabajo.

`supabase-migration-aviso-guia-revision.sql`.

## Por qué un disparador y no el JavaScript del panel

Porque salta **venga el cambio de donde venga**: el editor del autor, el
panel de admin, o una consulta a mano en el editor SQL. Un aviso metido
en el `click` de un botón concreto solo funciona desde ese botón.

## El reparto con lo que ya había (para no duplicar)

Esto es lo que hay que tener presente si se toca:

| Qué pasa | Campanita | Correo |
|---|---|---|
| Enviada a revisión | **el disparador** (nadie lo hacía) | **el disparador** |
| Aprobada | `admin/js/editor-guia.js`, ya existía | **el disparador** |
| Rechazada | `admin/js/editor-guia.js`, ya existía | **el disparador** |

Las campanitas de aprobado y rechazado se quedan en el JavaScript porque
allí van acompañadas del XP y del aviso a los seguidores, que son cosa
suya. Si algún día se mueven aquí, **hay que quitarlas de allí en el
mismo cambio**, o llegarán dos.

## Lo que no puede volver a avisar

- **Cada guardado de una guía en revisión.** Desde que se puede seguir
  editándolas, alguien puliendo su guía una tarde llenaría la campanita
  de todo el equipo. Hay un guardián: si `review_status` no ha cambiado,
  se sale.
- **Una guía oficial**, sin autor: la escribe el propio equipo.
- **El admin que escribe su propia guía**, a sí mismo: acaba de darle al
  botón.

## Los TRES sitios de un tipo de correo nuevo

El propio `js/notifications.js` avisaba de esto, y aquí se ha cobrado la
pieza. Un tipo nuevo hay que darlo de alta en:

1. **La migración** que lo encola.
2. **`EMAIL_TYPES`** en `js/notifications.js`, para la casilla del perfil.
3. **`NOMBRES`** en `netlify/functions/baja-correo.mjs` — y este es el que
   duele si se olvida: un tipo que esa lista no reconoce **apaga TODOS los
   correos** de quien pulse «darse de baja». Un admin dándose de baja de
   «guías para revisar» se habría quedado sin mensajes privados.

`guide_submitted` va además en `EMAIL_TYPES_EQUIPO`, una lista aparte que
solo se le pinta a quien tiene `is_admin`: enseñarle a un miembro normal
una casilla para algo que no va a recibir nunca es ruido.

## Cómo se ha probado

**SQL contra un PostgreSQL de verdad**: 15 comprobaciones, incluida la
puerta de atrás (la función es `SECURITY DEFINER`, así que sin el
`revoke` PostgREST la expone como RPC y cualquiera con sesión podría
colar avisos al equipo).

Rigor: **10 roturas, 10 pilladas, a la segunda**. La que se escapó es
instructiva y es la misma trampa de siempre: para probar «editar una guía
en revisión no vuelve a avisar» hacía un `update ... set title = ...` a
secas, y **el disparador ni siquiera saltaba** — está declarado `update of
review_status`. Pero la app escribe `review_status` en **cada** guardado
(lo mete `buildPayload`), así que en producción sí salta y lo único que
para el aluvión es el guardián de dentro. Con el `update` que hace la app
de verdad, la rotura sale roja.

Navegador: `test-aviso-guia-ui.mjs`, 7 comprobaciones sobre quién ve qué
casilla.

# Encuestas en el foro

Abrir un tema con votación. `supabase-migration-encuestas-foro.sql`,
`js/encuesta.js`, enganchado en `js/foro.js` (crear) y `js/tema.js`
(pintar y votar).

Es lo que más movimiento genera en un foro que arranca, y por una razón
tonta: votar cuesta un clic y participar en un hilo cuesta escribir un
párrafo.

## Un voto por persona, impuesto donde no se puede esquivar

Tres tablas: `forum_polls` (una por tema, `thread_id` es la clave
primaria), `forum_poll_options` y `forum_poll_votes`.

La regla la impone **un índice único parcial**, no el navegador:

```sql
create unique index forum_poll_votes_una_por_persona
  on public.forum_poll_votes (thread_id, user_id)
  where multiple = false;
```

Sin él, dos pestañas abiertas son dos votos y ninguna comprobación del
cliente lo evita. Un disparador tampoco bastaría: dos inserciones a la
vez podrían pasarlo las dos.

## La trampa: el índice se esquiva mintiendo

El índice necesita saber si la encuesta es de respuesta única, y eso vive
en `forum_polls`. **Un índice parcial no puede llevar una subconsulta**
—Postgres no lo permite—, así que la condición tiene que salir de una
columna de la propia tabla de votos. De ahí `forum_poll_votes.multiple`,
que es un dato copiado.

Copiado y **clavado**: mandar `multiple = true` en una encuesta de
respuesta única dejaría el índice fuera de juego y permitiría votar
todas las opciones. Lo que lo impide es una clave ajena **compuesta**:

```sql
constraint forum_poll_votes_encuesta_fk
  foreign key (thread_id, multiple)
  references public.forum_polls (thread_id, multiple)
```

apuntando a un índice único `(thread_id, multiple)` de la encuesta. El
valor tiene que coincidir con el de la encuesta o salta un error de
integridad. Sin esta pieza, todo lo demás es decorado — y esa es
exactamente la segunda rotura del rigor.

## Los resultados no se ven antes de votar

`verResultados = heVotado || cerrada`. Ver por dónde va la votación
cambia lo que vota la gente, y en una comunidad pequeña se nota mucho.

Lo que **sí** se enseña antes de votar es el total del pie («7 votos»):
dice cuánta gente ha participado, no por dónde va la cosa. La distinción
está probada por separado, porque es fácil taparlo de más al arreglar
algo.

El recuento es `forum_poll_resultados(p_thread)`, con **left join**: una
opción con cero votos sigue en la lista. Con un join normal desaparece, y
desaparece justo la información de que nadie la ha votado.

## La encuesta se pone al abrir el tema, no después

La política de creación exige ser el autor **y** que el tema se haya
creado hace menos de 5 minutos. Colgarle una votación a un hilo que ya
lleva media conversación cambia de qué iba el hilo a mitad de camino, y
los que ya escribieron no contaban con ella.

Por eso el formulario de la encuesta vive en el formulario de tema nuevo
y en ningún otro sitio.

## El orden de las tres escrituras

Un tema con encuesta son tres filas en tres tablas, y el orden importa:

1. **Validar la encuesta ANTES de crear nada.** Si le falta la pregunta o
   tiene opciones repetidas, se avisa y no se publica. Al revés, quien se
   dejara la pregunta se encontraría el tema publicado y la votación no.
2. **Tema → primer mensaje.** Si el mensaje falla, el tema se borra: un
   tema vacío no sirve de nada.
3. **Encuesta al final, y si falla NO se deshace nada.** El tema y su
   mensaje ya están publicados y valen por sí solos. Tirarlos porque no se
   pudo crear la votación sería perder lo que la persona acaba de
   escribir; se avisa y se sigue.

## Solo en la primera página

En la página 3 de un hilo largo la votación ya no es de lo que se está
hablando, y repetirla arriba de cada página es ruido. `pintarEncuesta()`
se sale si `pagina !== 1`.

## Si la migración no está ejecutada

`cargarEncuesta` devuelve `null` en cuanto la consulta da error, y el
tema se pinta entero sin encuesta. Entre desplegar el código y ejecutar
el SQL a mano en el editor de Supabase pasa un rato, y durante ese rato
las tres tablas no existen. Un tema en blanco durante media hora es peor
que un tema sin votación.

## Cómo se ha probado

**SQL contra un PostgreSQL de verdad** (`prueba-encuestas.sql`): 17
comprobaciones. Rigor: **8 roturas, 8 pilladas**, incluidas las dos que
sostienen todo lo demás — «se puede votar dos veces» y «el índice se
esquiva mintiendo sobre el tipo de encuesta».

**Navegador** (`test-encuestas.mjs`): 72 comprobaciones — el formulario y
su tope de 8 opciones, las tres validaciones (y que el tema **no** llegue
a la base cuando fallan), lo que se guarda y en qué orden, los resultados
escondidos hasta votar, votar, cambiar el voto, las dos pestañas, sin
cuenta, la página 2, un tema sin encuesta, y la migración sin ejecutar.

Rigor: **18 roturas, 18 pilladas**. Dos que merecen quedarse escritas:

- **«cambiar mi voto se lleva por delante el de los demás».** Quitar
  `.eq('user_id', userId)` del borrado deja la pantalla igual de bien —
  las opciones vuelven, todo parece correcto— y por debajo ha borrado la
  votación entera. Lo pilla una comprobación aparte: tras retirar mi
  voto, el de la otra persona sigue contando.
- **«los votos de los demás salen marcados como míos».** El mismo `.eq`
  que falta, esta vez al leer: la pantalla decide que ya has votado
  porque ha votado alguien.

# El autor no podía editar su guía ya publicada

Lo avisó un usuario al que le habíamos aprobado la guía. Y no era «no
encuentro el botón»: **no había ningún camino**.

- **Editar**: la política sólo admitía `draft`, `rejected` y `pending`.
  `approved` estaba fuera, y lo había puesto yo así, razonando que
  cambiar por detrás una guía revisada es publicar sin revisar.
- **Sugerir una corrección**: `js/guide-suggestions.js:61` se sale si eres
  el autor — lo cual es correcto *si puedes editar*.

Las dos piezas por separado tenían sentido; juntas dejaban al autor sin
poder arreglar ni una errata en su propia guía. El único camino era
pedírselo al equipo.

Decisión tomada por Iker: **el autor edita y punto**, sin aviso ni vuelta
a revisión. `supabase-migration-editar-publicada.sql`.

## Meter `approved` en el `with check` ABRE UN AGUJERO

Esto es lo que hay que entender antes de tocar nada de esto.

Una política de RLS **no puede comparar la fila vieja con la nueva**: el
`using` ve cómo está y el `with check` ve cómo queda, pero nunca las dos.
Así que en cuanto el `with check` admite `approved` —y tiene que
admitirlo, porque el editor escribe `review_status` en cada guardado— el
autor de un borrador puede mandar `review_status = 'approved'` y
**publicarse la guía él mismo**, saltándose la revisión entera. No es
teórico: es una llamada a la API.

Se cierra donde sí existen las dos versiones de la fila: un disparador
`before update`. Y ya puesto, clava lo que decide quien revisa y no el
autor:

| Campo | Por qué |
|---|---|
| `review_status` | El autor sólo mueve draft ↔ pending. Ni se publica ni se rechaza. |
| `published_at` | Es lo que hace pública la guía (lo mira `guides_select`). Con fecha a mano, un borrador sale en la web sin tocar el estado. |
| `xp_reward`, `guide_rarity`, `is_pro` | Con la guía ya aprobada, subírselos es repartirse XP y rareza a placer. |

El disparador usa `is_admin()` y **no** `is_staff()`, a propósito: hoy las
guías las lleva sólo la administración (`guides_admin_all` es
`using (is_admin())`), y un moderador no las toca ni con el disparador
quitado. Si algún día se abren al equipo entero hay que cambiar **las dos
cosas a la vez**; hay una comprobación puesta para que salte.

## El orden de las migraciones importa, y no avisa

`editar-en-revision.sql` y `editar-publicada.sql` **reescriben la misma
política**. Manda la última que se ejecute. Ejecutar la anterior después
de esta —por repasar— deja la versión vieja y quita el permiso, mientras
el disparador se queda puesto: **no salta ningún error**, simplemente el
autor vuelve a no poder editar. Se arregla volviendo a ejecutar la
segunda.

Me pasó a mí en el propio banco de pruebas: el runner re-ejecutaba la
primera para comprobar idempotencia y deshacía la segunda en silencio.

## Lo que cambia en la pantalla

- **`js/editor-guia.js`**: `approved` entra en `loadExistingGuide`, hay un
  `marcarPublicada()` que esconde «Guardar borrador» —guardarla como
  borrador la **despublicaría** por corregir una errata— y
  `estadoDelBotonPrincipal()`, que escribe `approved` y no `pending`:
  volver a mandarla a la cola la sacaría de la web hasta que alguien la
  reaprobara.
- **`js/perfil.js`**: «Editar» en la fila de una publicada. «Eliminar»
  **no**: la gente la tiene guardada y puede estar enlazada desde fuera.
- **`js/guia.js`**: botón «Editar» en la propia guía si es tuya y está
  publicada. Es donde su autor la relee y donde ve la errata.

## `upsert` no vale aquí, y las pruebas no lo vieron

Lo destapó un usuario en producción, con el permiso ya abierto: guardar
seguía muriendo con **«new row violates row-level security policy»**.

El editor guardaba con `.upsert()`, que PostgREST manda como
`INSERT ... ON CONFLICT DO UPDATE`. Postgres le aplica **también la
política de INSERCIÓN** a la fila propuesta, y `guides_author_insert`
sólo admite `draft` y `pending`. Así que el guardado moría ahí, **sin
llegar nunca** a `guides_author_update`, que sí lo permite.

Y no se arregla abriendo la política de inserción: eso dejaría **crear de
cero** una guía ya publicada, que es el mismo agujero por otra puerta (el
disparador es `before update`, no ve un insert nuevo). Hay una rotura del
rigor puesta precisamente sobre ese arreglo tentador.

El arreglo es que el editor haga **`update` si la guía existe** e
**`insert` si es nueva**. Cada operación pasa por su política y la
inserción se queda cerrada.

**Por qué las pruebas no lo pillaron**: las de SQL usaban `update` a
secas y la app usaba `upsert` — caminos distintos en Postgres. Es la misma
trampa de siempre, la prueba no hacía lo que hace la app. Ahora se
comprueban las tres sentencias, y en el navegador se comprueba **qué tipo
de escritura manda el editor** (el doble de Supabase no aplica RLS, así
que el error no se puede reproducir allí, pero la sentencia sí se puede
mirar).

## Cómo se ha probado

**SQL contra un PostgreSQL de verdad** (`prueba-editar-publicada.sql`): 27
comprobaciones. Rigor: **12 roturas, 12 pilladas**, incluida «sin
disparador, un borrador se publica solo».

Una se escapó al principio y enseña algo: quitar `rejected` del permiso no
ponía nada en rojo, porque eso lo prueba **otro** fichero. Como esta
migración reescribe la misma política, el runner pasa ahora **las dos**
pruebas, cada una sobre una base recién sembrada.

**Navegador** (`test-editar-publicada.mjs`): 30 comprobaciones. Rigor:
**13 roturas, 13 pilladas**. Las dos que más importan son las que no dan
ningún error visible: guardar la publicada como `draft` (la saca de la
web) o como `pending` (la mete en una cola que nadie pidió).

`prueba-editar-revision.sql` y `test-editar-en-revision.mjs` tenían cada
uno una comprobación que afirmaba la regla vieja. Se han actualizado —el
cambio de regla es deliberado— dejando escrito qué cambió y cuándo. En la
de SQL cambió además el **código de error**: aprobarse la guía uno mismo
lo paraba la política (42501) y ahora lo para el disparador (23514). La
regla es la misma; el mecanismo, no.

# Vídeos de YouTube dentro de una guía o de un mensaje

Lo pidió Iker viendo una guía real: su autor había dejado el enlace a su
vídeo, y pulsarlo te saca de la guía justo cuando la estabas leyendo.

`js/video-youtube.js`, más un botón en la barra del editor. Funciona en
las guías **y en el foro**, porque los dos usan el mismo editor.

## El autor no escribe el iframe. Nunca

Es lo único que hay que entender de este trozo.

Dejar pasar un `<iframe>` del usuario en el saneador es abrir la puerta
de par en par: puede apuntar donde quiera, cargar lo que quiera y tapar
la página con algo transparente encima de un botón de verdad.

Lo que se guarda es `<yt-video data-yt="ID">`: once caracteres y nada
más. **El iframe lo monta nuestro código**, con una dirección que
escribimos nosotros y el identificador metido dentro. Es el mismo patrón
que `<tcg-deck>` — se guarda el dato, no el resultado.

La puerta la cierra el saneador, y por eso el filtro es tan estrecho:

```js
const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/
```

Lo que no pase, se cae la etiqueta entera. Sin eso, ese valor acabaría
dentro de un `src` — que es exactamente cómo se cuela una inyección.

`idDeYoutube()` entiende las formas en que la gente pega un enlace
(`youtu.be/ID`, `watch?v=ID`, `/shorts/`, `/embed/`, `/live/`) y compara
el **hostname exacto** contra una lista. Nada de `startsWith`:
`youtube.com.malo.es` empieza por `youtube.com` y no es YouTube. Hay una
rotura del rigor puesta justo sobre eso.

## Nada sale hacia Google hasta que alguien lo pulsa

Lo que se pinta de entrada es una portada **nuestra**, dibujada con un
SVG propio. Ni el reproductor, ni la miniatura de Google —que también
sería una visita contada—. Solo al pulsar se crea el iframe, contra
`youtube-nocookie.com`.

Son tres cosas a la vez, y la primera manda: la política de privacidad
dice que la web no lleva nada de terceros, y un iframe de YouTube en cada
visita la convertiría en mentira. Además una guía con cuatro vídeos
pesaría varios megas antes de leer la primera línea.

`privacidad.html` lo declara en el punto 6, incluida la parte buena: que
mientras no lo reproduzcas no se le pide nada a YouTube.

## Cómo se ha probado

`test-video-youtube.mjs`: 33 comprobaciones. La prueba **cuenta las
peticiones que salen del navegador** y comprueba que no hay ninguna a
Google antes del clic — es la única forma de comprobar de verdad la parte
de privacidad, porque el resto es mirar HTML.

Rigor: **11 roturas, 11 pilladas, a la segunda**. La que se escapó es la
misma trampa que ya salió con los spoilers: quitar el `contenteditable`
de `hydrateVideos` no ponía nada en rojo, porque **el vídeo recién
insertado lo trae puesto del propio editor**. Solo se nota al REABRIR una
guía guardada, donde ese atributo ya no está (el saneador no lo admite).
Con esa comprobación añadida, la rotura sale roja.

# El catálogo de cartas pasa a inglés, y se prepara para el japonés

Iker lo vio usándolo: «solo coge en español y lo coge mal», y las
japonesas no salían. Las dos cosas tenían la misma raíz.

## Por qué no salían las japonesas

No es que TCGdex no las tenga: **no se las pedíamos**. `fetchSets()`
pedía `/en/sets`, que es sólo el catálogo occidental. Los sets japoneses
no entraban nunca en el sistema, así que sus cartas tampoco.

## Por qué el catálogo estaba a medio traducir

Esto sí era una decisión mía, y era mala. `fetchSet()` pedía **las dos
versiones** del set y las mezclaba: el inglés daba la lista completa de
cartas y el español le pisaba nombre e imagen cuando existían.

Parecía lo amable. El resultado era un catálogo **partido por 2011**: el
español sólo cubre de Black & White en adelante, así que las cartas
modernas salían en español y las antiguas en inglés, en la misma lista y
en el mismo buscador. Quien buscaba «Cerdytoso» no encontraba nada de
antes de 2011; quien buscaba «Grumpig», nada de después.

Ahora es **inglés y sólo inglés**: `IDIOMA = 'en'`, una sola petición por
set, sin mezcla. Es el único catálogo completo, es como se nombran las
cartas en listas de torneo y tiendas, y es como busca la gente. De paso
desaparece `cardImageFallbackUrl` y el reintento de imagen en los tres
sitios que lo usaban: con un catálogo que tiene escaneo de todo, no hay a
qué caer.

**Las guías no se rompen**: guardan el *identificador* de la carta, no el
nombre. Un reimport cambia los nombres y las listas de cartas de las
guías siguen apuntando a lo mismo.

## Lo que decide el esquema del japonés, y por qué no se ha hecho todavía

Una Charizard japonesa no es la misma carta que la inglesa: para quien
colecciona son dos cosas, con precios distintos. Así que necesitan ser
dos filas.

`supabase-migration-cartas-mercado.sql` añade `market` ('WEST' | 'JP' |
'CN') a las dos tablas y marca lo existente como occidental. **No cambia
la clave primaria a propósito**, porque eso depende de una pregunta sin
responder:

> ¿Comparten los catálogos identificadores de set?

Hoy la clave de `tcg_cards` es el id de la carta a secas. Si el catálogo
japonés usa ids propios, la clave sigue valiendo. Si reutiliza los
mismos ids con cartas distintas dentro, **importar japonés pisaría las
occidentales en silencio** — sin error, sin aviso, y con la colección de
la gente ya metida encima.

No se puede averiguar desde el entorno de desarrollo: no hay salida a
internet hacia TCGdex. Y adivinarlo es exactamente el tipo de decisión
que no se adivina. De ahí el botón **«Diagnosticar catálogos»** del panel
de cartas: corre en el navegador, pregunta por 16 idiomas candidatos y
devuelve, en texto para pegar:

- qué idiomas responden y con cuántos sets y cartas declaradas,
- las **series** de cada uno (ahí se localiza TCG Pocket, que se queda
  fuera por decisión de Iker),
- y lo importante: **cuántos ids de set comparte cada catálogo con el
  inglés**, con ejemplos de los propios.

Si «compartidos» sale 0, la clave actual sirve y basta con importar
marcando el mercado. Si no, hay que pasar a `(id, market)` **antes** de
importar nada.

## Cómo se ha probado

`test-tcgdex-idioma.mjs`: 24 comprobaciones con un `fetch` de mentira —
no hay red hacia TCGdex ni la va a haber en las pruebas, así que lo que
se comprueba es **qué pide y cómo monta las URLs**, que es justo donde
estaba el fallo. Incluye que un set se pida **una sola vez** (la mezcla
eran dos) y que el diagnóstico detecte los ids compartidos.

Rigor: **9 roturas, 9 pilladas**, entre ellas volver al español, volver a
mezclar los dos idiomas, y que el diagnóstico deje de mirar los ids
compartidos — que es la que dejaría tomar la decisión del esquema a
ciegas.

# Los mercados: japonés y los dos chinos

Continuación de lo anterior, ya con los datos del diagnóstico en la mano.
Y trajo una sorpresa que no buscaba nadie.

## Lo que dijeron los datos

**Los idiomas occidentales son UN catálogo traducido.** El español
comparte sus 154 identificadores de set con el inglés. El alemán sus 153,
el italiano sus 190, el portugués sus 123, el ruso sus 9 — **todos**. Sólo
el francés tiene 3 sets propios (promos francesas). Así que importar el
inglés (218 sets, 23.746 cartas) es importar el occidental entero: pedir
los demás sería traer las mismas cartas con otro nombre.

**Los asiáticos son catálogos propios**: japonés 177 sets, coreano 95,
chino tradicional 98, chino simplificado 56, indonesio 70, tailandés 72.
Y ojo — **el chino son dos catálogos, no dos traducciones**.

## La sorpresa: los asiáticos se pisan ENTRE ELLOS

El diagnóstico comparaba cada idioma contra el inglés, y ahí el japonés
sólo comparte 4 ids. Parecía que no había problema.

Pero en los ejemplos se veía otra cosa: **`CS1a`, `CS1b`, `CS2.5` y
`CS4a` aparecen en chino tradicional, en indonesio Y en tailandés**, y
`SVDs` en indonesio y tailandés. Son sets **distintos** con el mismo
identificador.

Con la clave siendo sólo `id`, importar dos de esos catálogos habría hecho
que el segundo **pisara al primero sin dar ningún error**. Con colecciones
de gente encima.

**La limitación del diagnóstico queda escrita en el propio fichero**:
compara contra el inglés, no todos contra todos. Se vio de refilón. Si
hay que volver a decidir algo así, hay que mirar todos contra todos.

## La clave pasa a (id, market)

`supabase-migration-cartas-mercado.sql`. Las dos tablas, y la clave ajena
de las cartas pasa a `(set_id, market) → (id, market)` — que además impide
colgar una carta japonesa de un set occidental.

Con eso, un choque entre mercados es **imposible por construcción**, y los
4 ids que el japonés comparte con el inglés dejan de importar: son dos
filas, una por mercado, que es justo lo que quiere quien colecciona.

Mercados admitidos: `WEST JP KO CN TW ID TH`. Se importan cuatro
(`MERCADOS_A_IMPORTAR` en `js/tcgdex.js`); coreano, indonesio y tailandés
existen y están completos, y añadirlos es meterlos en esa lista.

## Referenciar una carta desde una guía, sin romper las escritas

Aquí había una trampa. Las guías guardan identificadores de carta en
`data-cards`, y **el identificador ya no es único**.

La referencia es **`id` a secas para el occidental** —igual que siempre, y
por eso ninguna guía antigua se rompe— y **`id@MERCADO`** para el resto
(`refCarta` / `parseRefCarta`). `parseDeckIds` acepta el sufijo opcional,
y `cardsByIds` agrupa por mercado y hace una consulta por cada uno: sin
eso, un `sv1-25` traería la carta cuatro veces.

`searchCards` **exige mercado** (por defecto el occidental): sin filtrar,
buscar «Charizard» devolvería la misma carta cuatro veces y quien monta
una guía tendría que adivinar cuál es cuál.

Y la imagen sale en el idioma **del mercado de la carta**, no en uno fijo:
`cardImageUrl(path, calidad, market)`.

## TCG Pocket, fuera

Es la serie `tcgp`, presente en los siete catálogos occidentales. Es un
juego de móvil: sus cartas no existen en papel, no se coleccionan y no se
juegan en torneo. `SERIES_EXCLUIDAS` la quita en `fetchSets`.

## Un detalle del panel que casi se cuela

La tabla de sets tenía el botón de importar con `data-import-set="<id>"`.
Con cuatro mercados, **un mismo id aparece hasta cuatro veces** y el botón
habría importado siempre el primero que encontrara — trayendo el set
equivocado y guardándolo encima del que toca. Ahora se importa por **par
(id, mercado)**, y la fila enseña el mercado en una etiqueta.

## El catálogo de TCGdex trae repetidos

Y esto reventó el import en producción, con el mensaje **«ON CONFLICT DO
UPDATE command cannot affect row a second time»** — que es Postgres
diciendo que una misma sentencia lleva dos filas con la misma clave y no
sabe cuál debe ganar. Consecuencia: no se importaba **nada**.

La causa estaba en los datos del diagnóstico y se me pasó por alto:

```
zh-cn    57 sets,   6962 cartas declaradas     ← sets.length
zh-cn    56 sets ·    0 compartidos ·   56 propios   ← identificadores únicos
```

**57 contra 56.** El chino simplificado devuelve un set dos veces. Los
otros quince idiomas cuadran; ése no. Los dos caían en el mismo lote de
100 y la sentencia entera se venía abajo.

`sinDuplicados(filas, claves)` limpia por clave dejando la primera, y
**dice cuántas ha quitado** — el panel lo enseña, para que un repetido
nuevo no pase desapercibido. Se aplica a los sets y a las cartas de cada
set: no hay motivo para suponer que sólo pasa en un sitio, el catálogo lo
mantiene gente y cambia.

Lo que **no** puede hacer es descartar el mismo id de otro mercado: eso
sería tirar catálogos enteros. Hay una rotura del rigor puesta ahí.

## Cómo se ha probado

**SQL contra un PostgreSQL de verdad** (`prueba-cartas-mercado.sql`): 19
comprobaciones, con el caso real como centro — meter el `CS1a` japonés y
el chino tradicional al lado del occidental y comprobar que **ninguno
pisa a los otros**. Rigor: **7 roturas, 7 pilladas**.

**Cliente** (`test-tcgdex-idioma.mjs`): 49 comprobaciones con un `fetch`
de mentira. Rigor: **13 roturas, 13 pilladas**. Suite completa: **37/37 en
verde**.

# El buscador de cartas del editor

Lo contó un usuario así: «busco mewtwo y sólo me salen 24 resultados. Y si
busco mewtwo espacio x, salen 14. No salen todas, y alguna sale sin
imagen». Tres fallos distintos con la misma cara.

## 1. El tope se hacía pasar por el total

`searchCards` traía 24 como máximo (su valor por defecto, y
`card-picker.js` no pedía otro) y la pantalla ponía **«24 resultado(s)»**.
Es decir: el número que se enseñaba era el tamaño de la página, presentado
como si fuera cuántas cartas hay. Con 80 Mewtwo en el catálogo, la web
decía 24 y no había nada que indicase que faltaban.

Ahora la consulta lleva `count: 'exact'` y `searchCards` devuelve
`{ cartas, total }` — el total lo cuenta Postgres, no nosotros. La
pantalla dice **«Se ven 48 de 132»** y, mientras queden, un botón de **Ver
más** que pide la página siguiente con `desde` y la **añade al final**
(`insertAdjacentHTML`), sin repintar: quien está mirando la carta 40 no
vuelve de golpe al principio.

Dos detalles que costaron una rotura del rigor cada uno:

- `desde: mas ? pintadas : 0`. Con `desde` fijo en 0, «Ver más» trae otra
  vez las mismas 48 y la lista pasa a tener 96 filas duplicadas.
- `if (btn.dataset.enganchado) return` al enganchar los resultados. Sin
  esa marca, los botones que ya estaban reciben el oyente **otra vez**, y
  pinchar una carta la añade y la quita en el mismo clic: no pasa nada, y
  no hay ningún error que lo delate.

## 2. Se buscaba la frase, no las palabras

`.like('name_search', '%mewtwo ex%')` exige esos ocho caracteres
**seguidos y en ese orden**. Así, «M Mewtwo EX» aparecía y «Mewtwo &
Mew-GX» no; y dar la vuelta a las palabras no encontraba nada.

Ahora se parte en palabras y se piden **todas**, en cualquier orden y en
cualquier sitio del nombre — un `.like` por palabra, que en PostgREST se
unen con AND. Las palabras de una letra **no se tiran**: quien escribe
«mewtwo x» busca la Mewtwo X, y quitarle la «x» le devuelve las 80
Mewtwo. Y el orden del resultado es `name_search`, para que las variantes
de una carta salgan juntas en vez de en orden arbitrario.

Aquí hubo que arreglar antes el **Supabase de mentira de las pruebas**:
guardaba los `like` en un mapa por columna, así que el segundo pisaba al
primero y buscar «mewtwo ex» valía por buscar «ex». La prueba habría dado
por bueno cualquier resultado. Ahora se acumulan, como hace PostgREST.

## 3. Las cartas sin escaneo dejaban un hueco invisible

El `onerror` de la imagen hacía `this.style.visibility = 'hidden'`: la
carta seguía ocupando su sitio, en blanco, sin decir nada. Ahora la
imagen se sustituye por un recuadro con «sin imagen» (`.cp-noimg`, que ya
existía para las cartas sin `image_path`).

La proporción (`aspect-ratio: 245 / 342`) es lo que le da altura; el ancho
lo estira `.cp-result`, que es una columna flex. Eso último **se comprobó
rompiéndolo**: quitar el `width: 100%` no cambiaba nada, así que la
declaración sobraba y se ha quitado en vez de dejarla ahí con un
comentario que decía lo contrario.

## De paso: elegir catálogo

El buscador filtraba siempre por el mercado occidental, así que las
japonesas y las chinas que se acaban de importar **no se podían meter en
una guía**. Ahora hay un selector con los cuatro catálogos
(`MERCADOS_A_IMPORTAR` + `NOMBRE_MERCADO`), y cambiarlo vuelve a buscar
desde el principio: lo pintado era de otro mercado y no se puede mezclar.

Lo que se guarda pasa a ser la **referencia** (`refCarta`), no el id: en el
catálogo chino tradicional `mw1-1` es otra carta que la occidental, y
`data-cards="mw1-1"` a secas significa la occidental. Con el selector
puesto, guardar el id pelado habría metido en la guía una carta distinta
de la que se eligió, sin error ninguno.

## Y un botón que no se veía: `.link-btn`

Al mirar la captura del buscador arreglado, el «Ver más» salía como texto
normal. La causa: **`.link-btn` no estaba definida en ningún CSS**, y se
usaba en cuatro sitios — aquí, «Editar» y «Borrar» de un mensaje del foro,
«Quitar la cita» y «Cambiar mi voto» de una encuesta. Con el reset de
`button` (sin borde, sin fondo, `color: inherit`) todos ellos se leían
como texto corriente: la única pista de que se podían pulsar era el cursor.

Ya está definida en `components.css`, como un enlace subrayado en el navy
de la casa. Arregla los cuatro sitios de una vez, no sólo el «Ver más» —
que era justo lo que hacía falta para que el arreglo del total sirviera de
algo: si el botón no se ve, la web sigue pareciendo que sólo tiene 48
cartas.

## Cómo se ha probado

`test-buscador-cartas.mjs` (ya en la suite; estaba fuera y se le habían
quedado tres expectativas de antes del cambio de idioma). 71
comprobaciones en el navegador, contra un catálogo de prueba grande
(`window.__FAKE_TCG_MUCHAS__`: 52 Mewtwo, una sin escaneo, señuelos con
«ex» que no son Mewtwo, y una del catálogo chino tradicional).

Lo que se mide: que se pinten 48 y el total diga 52; que «Ver más» sume
hasta 52 y desaparezca; que los resultados viejos sigan respondiendo
después de traer más; que «mewtwo ex» y «ex mewtwo» den lo mismo; que el
hueco sin imagen se vea y con qué tamaño; y que la referencia guardada de
una carta china lleve `@TW`.

Rigor: **13 roturas, 13 pilladas** (`rigor-buscador-cartas.py`).

# ¿Faltan cartas? Medirlo antes de cambiar de API

La pregunta llegó así: «faltan muchas cartas chinas y japonesas, algunas
imágenes no cargan; estoy mirando otras APIs». Es una pregunta razonable y
no se puede contestar de memoria, porque **"faltan cartas" son tres cosas
distintas** y sólo una es motivo para cambiar de proveedor:

1. **No se han traído.** La migración de mercados sin ejecutar, o el import
   cortado a medias. No falta nada en TCGdex: falta darle al botón.
2. **El set se quedó corto.** TCGdex declara 200 y guardamos 130.
3. **Están todas, sin escaneo.** La carta existe; la imagen no.

Y hay un cuarto caso que era **nuestro fallo y estaba escondido**: el botón
«Importar los que faltan» sólo miraba los sets con `imported_at` a null. Un
set que se quedó corto ya tiene fecha de importación, así que **no volvía a
mirarse jamás** — y en la tabla se veía igual que uno completo, con su
etiqueta verde de «Importado». Lo mismo pasa con un set al que TCGdex le
añade cartas después: nunca llegaban.

## Lo que se ha añadido para medirlo

**`diagnostico-cartas.sql`** (solo SELECT, se pega en el SQL Editor):
cobertura por mercado, sets sin importar, sets cortos ordenados por hueco,
cartas sin escaneo por mercado y por set, y las referencias de cartas de
las guías que ya no existen en el catálogo. La primera consulta dice si la
migración de mercados está aplicada, porque si no lo está la respuesta a
«faltan las japonesas» es simplemente que todavía no hay dónde ponerlas.

**En el panel**: una tarjeta de **Cobertura** (`262 de 466 declaradas`,
56%), un contador de **Sets cortos**, la etiqueta `Corto (faltan 81)` en la
fila —que antes decía «Importado»— y un botón **«Reimportar los cortos»**
que los pide del hueco más grande al más pequeño.

## El dato que decide si hay que cambiar de API

Al reimportar, el panel ahora dice **si ha servido de algo**:

> Importación terminada. 4 cartas en 2 sets. De los 2 que ya estaban: 0 han
> traído 0 cartas nuevas y 2 siguen igual (TCGdex declara más de lo que
> publica).

Eso es la prueba. Si al reimportar vienen cartas nuevas, el hueco era
nuestro. Si no vienen, el hueco es de los datos de TCGdex y no lo cierra
ningún botón: ahí es donde tiene sentido mirar otra fuente, y ya con un
número delante en vez de una impresión.

## Por qué no se cambia de API todavía

Desde aquí no hay red hacia ninguna de ellas, así que cualquier cosa que
dijera sobre su cobertura de hoy sería de oídas. Pero hay dos cosas que sí
se pueden afirmar:

- **La web no depende de TCGdex**, depende de `tcg_sets`/`tcg_cards`. Todo
  lo que lee el sitio son esas dos tablas; el único sitio que habla con
  TCGdex es `js/tcgdex.js` y el panel. Cambiar de fuente —o **combinar
  dos**, rellenando los huecos de una con otra sobre la misma clave
  `(id, market)`— es escribir otro importador, no rehacer nada.
- El requisito real es **cobertura en japonés y chino**, y ése es justo el
  punto donde las alternativas gratuitas flojean: las que van sobradas de
  metadatos y precios son de catálogo occidental.

## Y de paso: `test-cartas.mjs` vuelve a la suite

Estaba fuera desde el cambio a varios mercados, y en realidad se caía por
algo tonto: **el Supabase de mentira no tenía tabla `tcg_sets`**, y el
panel la ESCRIBE (upsert al traer la lista, update al importar), así que la
tabla salía siempre vacía y la prueba no podía comprobar nada del
importador. Con una tabla de verdad en el falso, más quitarle las
expectativas de cuando el catálogo era sólo occidental (nombres en español,
3 sets en vez de 3×4), vuelve a estar en verde: **43 comprobaciones** que
cubren el importador entero.

Una de esas expectativas se ha sustituido por otra cosa a propósito:
contaba el total de filas de `tcg_cards` después de importar. Ese número
depende de cuántas cartas trae sembradas el catálogo de prueba y de si
alguna coincide con las importadas, así que se rompía al tocar la semilla
sin que nada estuviera mal. Ahora se cuenta **por set y mercado**, que es
lo que la prueba quería decir.

Cobertura nueva: `test-cobertura-cartas.mjs`, 19 comprobaciones. Rigor:
**12 roturas, 12 pilladas** (`rigor-cobertura-cartas.py`). Y el SQL del
diagnóstico se ha probado contra un PostgreSQL de verdad con el caso
montado a mano (`prueba-diagnostico-cartas.sql`).

# El estado de una guía, dicho sin mentir

Lo contó él usándolo:

> «Tengo una guía escrita y pone que está aprobada, y no está aprobada, y no
> sale en ningún sitio, entonces no puedo previsualizarla.»

Las tres cosas eran ciertas a la vez, y salían de la misma grieta: **el
estado de una guía vive en DOS columnas** y la web las leía por separado.

- `review_status` — por dónde va la revisión. **Su valor por defecto es
  `'approved'`** (`supabase-migration-social.sql`), porque las guías
  oficiales del panel no pasan por revisión.
- `published_at` — si se ve o no.

El editor del panel sólo tenía una casilla de «Publicada», que escribía
`published_at`. **`review_status` no lo tocaba nunca.** Así que una guía
escrita ahí y no publicada nacía `approved` + `published_at` null:

- «Mis guías» leía sólo `review_status` y ponía **«Publicada»**.
- Toda la web filtra por `published_at`, así que no aparecía en ningún sitio.
- Y como no aparecía en ningún sitio, **no había ningún enlace desde el que
  abrirla** — de ahí el «no puedo previsualizarla».

## Lo que se ha hecho

**`js/guia-estado.js`**: el estado se calcula **en un solo sitio**, a partir
de los dos campos, y aparece un estado que antes no se podía nombrar:
`aprobada_sin_publicar` → **«Aprobada, sin publicar»**. Había dos tablas de
etiquetas duplicadas (perfil y panel) que decían cosas distintas; ahora hay
una. `laVeLaGente(guia)` es la otra pregunta, la de verdad: publicada, o
pendiente de revisión (esas se ven en Comunidad a propósito).

**El editor del panel** cambia la casilla por un **desplegable de estado**
con los cuatro que existen, y de él salen las dos columnas a la vez
(`columnasDelEstado`). Con eso él puede hacer lo que pedía: escribir una
guía y **mandarla a revisión** como cualquier otra de la comunidad, para que
se vea en Comunidad y se vaya construyendo, en vez de tener que elegir entre
publicada o invisible.

**La guía sin publicar avisa**: banda de aviso en color de advertencia con
el estado y «esto no lo ve nadie más que tú y el equipo». Antes se veía
idéntica a una publicada, que es lo que le hizo creer que tenía una guía
viva.

**Y «Mis guías» tiene enlace** («Ver» si está publicada, «Vista previa» si
no). Sin él, una guía sin publicar era literalmente inalcanzable desde la
web.

Un detalle del XP que cambió de sitio: la recompensa al autor cuando su
guía se aprueba se decidía mirando `extraFields` (o sea, sólo el botón de
Aprobar). Ahora se mira el payload final, porque aprobar ya se puede hacer
también desde el desplegable — y no se da cuando el autor eres tú, que
sería darte XP y mandarte un aviso a ti mismo.

# Imágenes en fila (cuatro cartas en la misma línea)

> «Imagínate que quiero poner cuatro cartas en la misma línea y las pongo
> pequeñas, pero no se puede porque salta a la siguiente línea.»

Cierto, y no era un fallo suelto sino el modelo: una figura es un **bloque**.
Centrada (`rt-fig-c`) se queda con la línea entera **midiera lo que
midiera** — hacerla pequeña no la acompaña de nada, sólo deja hueco al lado.
Lo único que juntaba dos imágenes era flotarlas (`rt-fig-i`/`rt-fig-d`), y
con pie de foto y tres o cuatro imágenes eso no hay quien lo prediga.

## La fila

```html
<div class="rt-fila" data-cols="4">
  <figure class="rt-fig"><img …><figcaption>…</figcaption></figure>
  …
</div>
```

Rejilla de **columnas iguales**: cuatro cartas salen las cuatro del mismo
tamaño sin tocar el ancho de ninguna. Dentro de la fila **el `width` de cada
figura se ignora** (`width: auto !important`) — lo que manda es en cuántas
columnas la has puesto; si no, una figura al 40% dejaba media columna vacía.
Y en el editor el control de anchura **se esconde** dentro de una fila, en
vez de quedarse ahí sin responder.

En el móvil, las filas de 3 o más bajan a **2 columnas**: cuatro imágenes en
360 px son cuatro sellos.

**Los botones**: «Fila de 2 / 3 / 4» = *esta imagen y las siguientes*. Sólo
agrupa figuras **hermanas y seguidas** — un párrafo en medio corta, porque
juntar dos imágenes separadas por texto movería el texto de sitio sin que
nadie lo haya pedido. Si ya estás dentro de una fila, el botón cambia sus
columnas. Y «Sacar de la fila» la deshace.

## El fallo que casi se cuela: `<p>` no puede contener `<figure>`

El saneador convierte todos los `<div>` en `<p>` (los navegadores usan divs
como separador de párrafo al pulsar Enter). Con la fila siendo un `div`, eso
la convertía en `<p class="rt-fila">`… y **un `<p>` no puede contener un
`<figure>`**: el HTML se guardaba tan campante y el navegador lo partía al
volver a leerlo, así que las figuras se escapaban de la fila y salían otra
vez una por línea. El fallo original de nuevo, en silencio y sólo al
recargar. La prueba del navegador lo pilló porque **mira la guía publicada,
no sólo lo que hace el editor**.

`data-cols` se fuerza a un número entre 2 y 6 al sanear: va directo a una
plantilla de rejilla de CSS y sale de algo que se puede pegar a mano.

## Cómo se ha probado

`test-estado-guia.mjs` (43 comprobaciones) y `test-filas-imagenes.mjs` (38),
las dos en el navegador y las dos mirando también **la guía publicada**, no
sólo el editor. Rigor de las dos juntas: **24 roturas, 24 pilladas**
(`rigor-estado-y-filas.py`).

Tres roturas escaparon en la primera pasada y las tres enseñaron algo:

- **Quitar `published_at` del `select` del perfil no se puede detectar desde
  el navegador**: el Supabase de mentira guarda la lista de columnas pero
  **no proyecta**, devuelve la fila entera. En producción PostgREST sí
  proyecta, y entonces el campo llegaría `undefined` — que es exactamente
  cómo nació este fallo. Esa rotura se ha sacado de la lista, con el motivo
  escrito, y en su lugar la prueba fija el contrato de `estadoDeGuia` a pelo,
  incluido el caso «falta el campo» («no se dice que está publicada»).
- **`laVeLaGente` sin el caso de las pendientes** no rompía nada porque no
  había ninguna guía pendiente en la prueba de la página. Con una guía en
  revisión saldrían LOS DOS avisos, y el de «esto no lo ve nadie» sería
  mentira. Caso añadido.
- **La regla `width: auto !important` de la fila** no la notaba nadie: al
  crear la fila el editor ya les quita el ancho. Sólo se nota con HTML
  **pegado a mano**, que el saneador admite. Caso añadido con una fila cuyas
  figuras traen 40%, 100%, 25% y 60%: las cuatro tienen que salir iguales.

# Una imagen de carta no es una imagen cualquiera

La fila de arriba resolvía «cuatro cartas en la misma línea», pero **había
que pedirla**. Y el caso que le importaba no era ese:

> «Si meto cinco imágenes así y van en vertical una debajo de otra, quedará
> demasiado espaciado y no quedará bien. (…) nadie va a querer leer una guía,
> está leyendo una guía y de repente hay cinco imágenes en fila hacia abajo
> en columna, no tiene sentido.»

Y lo que lo hace inevitable:

> «Estas cartas, intento insertarlas y no existen, no están. Entonces, es un
> problema para mí, porque si la carta no existe, tengo que meter imágenes, y
> si meto imágenes y pasa lo mismo, pues estamos en un problema.»

O sea: el catálogo no le sirve para esas cartas, así que va a meter imágenes,
y una imagen de carta a ancho de artículo mide **unos 950 × 1330 px**. Cinco
así son cinco pantallas de scroll. Que exista un botón para agruparlas no
arregla nada si el resultado por defecto ya es malo.

## Se mira la FORMA de la imagen

Al insertar, el editor mide la imagen y decide:

```js
const esFormaDeCarta = (m) => !!m && m.h >= m.w * 1.15 && m.h >= 200
```

Más alta que ancha **y** de al menos 200 px de alto. Las dos condiciones
hacen falta:

- Sin la proporción, una captura apaisada sería «carta» — y las genéricas
  horizontales sí las quiere a ancho de línea.
- Sin el mínimo de 200 px, un **icono** vertical de 24 × 32 (los que usan las
  guías de rarezas dentro de una frase) se saldría del renglón.

Si es carta, la imagen se envuelve en `<figure class="rt-fig rt-fig-c
rt-fig-carta">`, y `rt-fig-carta` la deja a **230 px** (`min(230px, 42%)`, el
tanto por ciento para el móvil): 320 px de alto en vez de 1330.

**Se mide después de insertar, no antes.** Al revés, una imagen lenta dejaba
al autor mirando una pantalla donde no pasaba nada. Y si no carga (o tarda
más de 4 s), se queda como imagen normal: lo que no puede pasar es que una
imagen que falla impida insertarla.

## Y se juntan solas

Si justo antes hay otra carta, se crea la fila; si ya hay una fila de cartas,
la nueva entra en ella (hasta 8). Nadie pulsa nada. Dos detalles que no son
obvios:

- Los párrafos **vacíos** en medio no cuentan: son el hueco que el propio
  editor deja detrás de cada imagen para poder seguir escribiendo. Un párrafo
  **con texto** sí corta, porque entonces el autor ha seguido escribiendo y
  la imagen nueva es otra cosa.
- El diálogo de imagen admite **varias de una vez** (`multiple`), y se suben
  y colocan de una en una: cuatro cartas son cuatro ficheros, y elegirlos de
  uno en uno era abrir el diálogo cuatro veces para acabar con cuatro
  imágenes en cuatro líneas.

**Las columnas se reparten** (`columnasParaCartas`): hasta cuatro cartas, una
columna cada una; con más, se eligen 3 o 4 según cuál deje la última línea
más llena — cinco cartas quedan **3+2** y no 4+1, seis **3+3** y no 4+2.

Dentro de la fila una carta tampoco crece sin límite (`max-width: 260px;
justify-self: center`). Sin ese tope, una fila de dos en un artículo de 950 px
daría dos columnas de 465, o sea dos cartas de 650 px de alto: el problema del
principio otra vez, con dos imágenes en vez de una.

## El interruptor de mano

«Tamaño carta» en la barra del bloque, con su estado en `aria-pressed`. Hace
falta para dos cosas: las guías **ya escritas** (sus imágenes no llevan la
clase) y las veces que la detección se equivoque — un póster vertical no es
una carta. Al activarlo se le **quita el ancho escrito a mano**; si no, un
`width: 100%` anterior seguiría ganando y el botón no haría nada visible.

La barra dice «Carta» en vez de «Imagen» cuando lo está: es la única pista de
que la imagen mide lo que mide por eso.

## Cómo se ha probado

`test-cartas-verticales.mjs` (72 comprobaciones) en el navegador, subiendo
ficheros **por el diálogo de verdad** y mirando también la guía publicada.
Rigor: **21 roturas, 21 pilladas** (`rigor-cartas-verticales.py`).

Dos cosas que hubo que arreglar del propio banco de pruebas:

- **El Supabase de mentira devolvía `https://example.com/…` como URL de lo
  subido**, y aquí eso no carga. Como el editor decide si algo es una carta
  **midiéndolo**, la prueba habría salido verde sin probar nada. Ahora guarda
  lo subido como `data:` URI y devuelve eso.
- **Una rotura escapó**: quitar el «saltarse los párrafos vacíos» al agrupar
  no rompía nada, porque en el camino normal ese párrafo lo borra
  `asegurarFigura` al meter la imagen dentro. Pero basta **dar un Enter**
  antes de poner la segunda carta para que queden dos huecos, y entonces sí
  se notaba. Caso añadido, y la prueba comprueba primero que hay dos párrafos
  vacíos — si no, no estaría probando lo que dice.

## Lo que se me escapó: la imagen no siempre entra por el diálogo

Con todo lo de arriba hecho, volvió con una captura de tres cartas chinas una
debajo de otra: «¿he hecho algo mal? se insertan en fila y queda horrible».
No había hecho nada mal — **las había pegado de un foro**, y todo el
tratamiento vivía dentro del manejador del `<input type="file">`. Una imagen
pegada llegaba como un `<img>` a pelo dentro de un párrafo y no pasaba por
ninguna de las reglas nuevas.

La forma de una imagen no depende de cómo llegó, así que el tratamiento
tampoco puede depender de eso:

- **Repaso de imágenes nuevas** (`repasarImagenesNuevas`), colgado de `paste`
  y de `input`. Lleva un `WeakSet` de las que ya ha visto, así que sólo mira
  las que acaban de aparecer, vengan de donde vengan (pegar con el menú del
  navegador, arrastrar, deshacer y rehacer).
- **Las que ya estaban en la guía al abrirla se marcan como vistas.**
  Reestructurar de golpe un artículo ya escrito sería cambiárselo a alguien
  sin que lo haya pedido.
- **Las imágenes de un `<tcg-deck>` o de un `<yt-video>` están excluidas.**
  Las pinta el propio editor y se tiran al guardar; envolverlas en una figura
  reventaría el bloque. Sin esa exclusión, insertar una lista de cartas
  convertía sus cartas en figuras.
- **Pegar o arrastrar un FICHERO de imagen** (una captura del portapapeles) se
  intercepta y se sube como si se hubiera elegido en el diálogo. El navegador
  la metía como `blob:` o como base64 gigante, y ninguna de las dos sobrevive
  a guardar: al recargar quedaba una imagen rota. Este era un fallo aparte, y
  llevaba ahí desde que existe el editor.
- **«Fila de N» ya cuenta las imágenes pegadas.** Sólo miraba figuras, y una
  imagen pegada es un `<img>` dentro de un párrafo: pulsar el botón no hacía
  nada. Ahora un párrafo cuyo único contenido es una imagen cuenta como
  imagen suelta (y si tiene forma de carta, entra con tamaño de carta).
- **«Tamaño carta» agrupa igual que al insertar.** Es lo que arregla una guía
  ya escrita: un clic por imagen y se van montando en la misma fila, sin tener
  que acordarse de pulsar además «Fila de 3». Y al quitárselo dentro de una
  fila, la figura sale de la fila — si se quedara dentro llenaría su columna y
  saldría más grande que sus vecinas.

Total tras esta segunda vuelta: **97 comprobaciones y 32 roturas, 32
pilladas**. Las dos de pegar y arrastrar un fichero se prueban lanzando un
`ClipboardEvent`/`DragEvent` con un `DataTransfer` de verdad, así que el
camino que corre es el mismo que con el ratón.

# Aterrizaje, 404 y datos estructurados

Tres cosas que hacían falta antes de abrir al público, y que van juntas
porque las tres son "qué le pasa a alguien que llega de fuera".

## /sobre — qué es PokeDoc

No existía. Lo único que explicaba el proyecto era un **modal de la
portada**, y un modal no tiene dirección propia: no se puede poner en la
biografía de Instagram, no se puede enlazar desde un vídeo y Google no lo
indexa. Ahora hay una página de verdad, en el pie de todas las páginas y en
el sitemap, y el modal enlaza a ella.

Dice lo que es, por qué existe, qué se puede hacer, que **cualquiera puede
escribir**, y —importante— lo que **NO es**: ni tienda, ni peritaje, ni
afiliada a Nintendo.

## La 404

La regla de Netlify mandaba **cualquier** dirección desconocida a la portada
**con un 200**. Dos consecuencias: un enlace mal copiado enseñaba la home
como si no hubiera pasado nada, y para Google cada dirección inventada era
una página más con el contenido de la portada.

Ahora hay una 404 con buscador y salidas, con `noindex` y **con su código
404**.

Lo delicado era que alguna dirección real dependiera de ese catch-all.
`test-rutas-404.mjs` lee `netlify.toml` y el árbol de ficheros y **resuelve
38 rutas como lo hace Netlify** —primero los ficheros, incluidas las
direcciones limpias sin `.html`; después la primera regla que coincida—:
las reales siguen dando 200 y solo lo inexistente cae en la 404. Y una
rotura de la lista del rigor es precisamente la peligrosa: poner `force` en
el catch-all se lleva por delante el sitio entero.

## Datos estructurados (schema.org)

El Open Graph que ya había es para WhatsApp; esto es para el buscador. La
misma Edge Function inyecta ahora, con los datos de la base: **Article** en
las guías (con fecha y migas Inicio › Categoría › Guía), **Course** en los
cursos (gratis, y con la forma de impartirse que Google exige o ignora la
ficha), **DiscussionForumPosting** con el número de respuestas en los temas,
**ProfilePage** en los perfiles y **CollectionPage** en categorías y foros.
La portada lleva escritos a mano **WebSite** (con el `SearchAction`, que es
lo que permite que Google enseñe una caja de búsqueda de PokeDoc dentro del
resultado) y **Organization**.

Dos cosas que estaban mal de antes:

- La función solo se registraba en `/guia.html`, `/curso.html`… y **media web
  enlaza las direcciones limpias** (`/guia?slug=…` sale de las tarjetas). Quien
  compartía una guía por ahí enseñaba la vista previa genérica.
- El título de una guía va dentro de un `<script>`: se escapa el `<` a
  `\u003c` en todo el JSON, o un título que contenga `</script>` cerraría la
  etiqueta y lo de después sería HTML de verdad. Hay prueba con una guía
  llamada literalmente así.

**Y el Supabase de mentira ahora PROYECTA las columnas del `select`**, como
PostgREST. Antes devolvía la fila entera: quitar una columna del `select` no
se notaba en las pruebas y en producción habría llegado `undefined`. Es el
mismo agujero que ya había mordido con `published_at`, ahora tapado para
todas las pruebas.

# Primeros pasos del recién llegado

Quien se registra desde un vídeo aterriza en la portada y ve una web con
muchas cosas y ninguna primera. La portada le pone delante **tres acciones**
—leer una guía, hacer un curso, presentarse en el foro—, una de cada pata de
PokeDoc: leer, jugar y hablar. Botón **solo en el siguiente**; al completar
los tres, trofeo y el panel desaparece para siempre. A quien ya lo tiene no
se le hace ni una consulta.

Tres cosas que costó dejar bien probadas:

- **La prueba miraba la portada a los 1,8 segundos**, que es una carrera:
  "el panel no está" podía ser que aún no había llegado, y así tres roturas
  pasaban por buenas. El panel marca `data-pasos="listo"` cuando ha decidido
  —con panel, sin panel o habiendo fallado— y la prueba espera esa marca.
- **El trofeo lo estaba concediendo la racha diaria.** `app.js` llama a
  `checkDailyStreak` en cada carga, y eso encadena `addXP` →
  `checkAchievements`, que llegaba antes que el panel. Con eso tapándolo,
  romper el panel no se notaba. Las pruebas fijan ahora la racha ya cobrada
  hoy.
- **Que la condición del trofeo cuente mal no se ve en pantalla**, porque el
  panel lleva su propia cuenta. Se comprueba llamando a `checkAchievements` a
  pelo con dos pasos hechos y exigiendo que NO caiga.

Fuera del rigor, con su motivo escrito: el guardia `!session`. Sin él la
excepción la traga el `try/catch` que protege la portada y el resultado en
pantalla es idéntico; se queda porque provocar una excepción en cada visita
anónima para luego tragársela es peor que comprobarlo.

# Copia de seguridad

`herramientas/copia-seguridad.sh` y `copia-imagenes.sh`, con
`COPIA-DE-SEGURIDAD.md`. Se ejecutan en su máquina y la contraseña de la base
no toca ningún fichero del proyecto.

El detalle que costó descubrir: **`--schema=public --table=auth.users` en la
misma orden no hace lo que parece**. Con `--table`, `pg_dump` se olvida del
esquema y copia solo esa tabla — la primera versión dejaba una copia con las
cuentas y nada más. Van dos volcados seguidos en el mismo fichero.

La copia se **comprueba a sí misma**: mira dentro qué tablas hay y cuántas
filas trae cada una, y si falta alguna de las que importan sale con error en
vez de dejar un fichero con pinta de copia. Probado contra un PostgreSQL 16
de verdad: copia, restauración en una base vacía, y comprobación de que las
guías y las cuentas llegan enteras.

# Separar las visitas de personas y de robots

Al arreglar el panel de visitas apareció el porqué de los números raros:
cientos de visitas al día, todas anónimas, recorriendo las guías con
segundos de diferencia. **Los buscadores ejecutan JavaScript al indexar**,
así que también disparan el registro de visitas. Sin separarlos, la tarjeta
de "Visitas" medía sobre todo cuánto te rastrean.

Migración: `supabase-migration-visitas-bots.sql` — columna
`page_views.is_bot boolean`, **nullable y sin default a propósito**: las
filas de antes de la migración no se pueden clasificar a posteriori, y un
`default false` las convertiría en "personas" mintiendo. `null` significa
"antigua, sin clasificar", y el panel lo dice tal cual.

Cómo se detecta (`pareceRobot()` en `js/page-views.js`): dos señales, las
dos del lado del cliente. `navigator.webdriver` (lo pone a `true` cualquier
navegador automatizado, los renderizadores de los buscadores incluidos) y el
user agent (los rastreadores se identifican a propósito: Googlebot, bingbot,
HeadlessChrome…). No es seguridad — quien quiera mentir, miente —, es
limpiar la estadística del 99% de robots, que son los educados.

En el panel: tarjetas separadas de "Visitas de personas" y "De robots" (con
el número de antiguas sin clasificar al lado si las hay); las visitas con
sesión y los usuarios activos se calculan solo sobre personas; la gráfica y
el ranking excluyen a los robots pero **conservan las antiguas sin
clasificar** — quitarlas vaciaría todo el histórico.

Dos detalles que importan:

- **Si la web se despliega antes de ejecutar la migración**, PostgREST
  contesta PGRST204 (columna desconocida) y la visita NO se pierde: se
  reintenta el insert sin `is_bot`, que la deja como quedaban todas hasta
  ahora. Hay prueba con la columna quitada del doble.
- **Playwright también es un robot** (`navigator.webdriver` a `true`), así
  que la propia visita de la prueba queda marcada `is_bot: true` — y eso se
  usa como comprobación de que la detección real funciona, no un mock.

# Tanda del foro: leídos, títulos, encuestas, etiquetas y en línea

Cinco cosas pedidas mirando el foro en producción.

## Los temas leídos se apagan

En el índice, un foro leído ya se veía apagado (`.foro-fila-leida`), pero
dentro de un foro los temas leídos solo perdían negrita: 700 frente a 800,
invisible. Las filas leídas llevan ahora `.foro-tema-leido` con el mismo
lenguaje del índice (título en `--text-mid`, icono tenue). La clase solo se
pone cuando hay sesión Y las marcas de lectura han contestado
(`marcas.hayDatos`): a quien llega sin cuenta no se le apaga la lista —
no hay nada que él haya leído. De paso, el índice tenía ese fallo (a un
anónimo se le apagaba TODO) y quedó igualado.

## Editar el título y la etiqueta del tema

Editar el primer mensaje no tocaba el título, que es columna del TEMA. La
política RLS ya dejaba al autor (y al staff) actualizarlo desde el primer
día — solo faltaba la pantalla: botón "Editar título" en la cabecera del
tema (autor o equipo), que también actualiza la pestaña del navegador y la
última miga de pan. `search_norm` es columna generada: se refresca sola.

## Editar (y quitar) la encuesta del propio tema

La migración original lo prohibía a propósito: cambiar una opción votada
convierte los votos en votos a otra cosa. Pero el admin creó una encuesta
de "varias respuestas" queriendo una, y no había vuelta atrás. La salida
honrada (`supabase-migration-editar-encuestas.sql`,
`forum_editar_encuesta` security definer): editar se puede, y **si el
cambio toca las opciones o el modo de voto, los votos se borran** y la
votación empieza de cero — la pantalla lo avisa antes y dice cuántos
después. Corregir solo la pregunta los conserva. Con opciones NULL se
retira la encuesta entera. Es función y no políticas porque borrar votos
ajenos no debe permitirlo ninguna política: la función es la única puerta.

El orden dentro de la función importa: los votos se borran ANTES de tocar
`multiple`, porque la clave ajena compuesta de los votos copia esa columna
con ON UPDATE CASCADE y pasar de "varias" a "una" con votos múltiples
vivos chocaría con el índice de un-voto-por-persona.

## Más etiquetas

La lista vive en `ETIQUETAS` (js/foro-comun.js) porque ahora se elige en
dos sitios: al abrir el tema y al editar su título. Se añadieron las de
una comunidad de TCG: Opinión, Noticia, Guía, Colección, Intercambio,
Compra/Venta, Mazo, Torneo, Encuesta y Off-topic. Al editar, una etiqueta
vieja que no esté en la lista (p. ej. "Oficial") se añade como opción para
no perderla al guardar.

## Usuarios en línea, invitados incluidos

El clásico "Total: 12 (miembros: 3, invitados: 9)" de los foros de
siempre, en el lateral (`supabase-migration-en-linea.sql`, js/en-linea.js).
Cómo funciona sin perfilar a nadie:

- Cada pestaña genera un token aleatorio en **sessionStorage** (muere al
  cerrar la pestaña — localStorage sería un rastreador que sobrevive días).
- En cada carga, `latido_en_linea(token)` lo apunta con la hora (y quién,
  si hay sesión). "En línea" = latido en los últimos 15 minutos.
- **La tabla `online_now` no la escribe nadie directamente**: sin políticas
  de insert/update/delete; la única puerta es la función, que valida la
  forma del token, pone ella la hora y borra los latidos de más de un día.
- **Los robots no laten**: el latido pasa por `pareceRobot()`. Sin eso,
  los "invitados en línea" serían el rastreador de Google dando vueltas.
  Y como Playwright también es webdriver, la propia visita de la prueba
  queda fuera — lo que hace los recuentos de la prueba deterministas y
  de paso comprueba el filtro con la detección real.
- Un miembro con tres pestañas cuenta como UNA persona (se juntan por
  user_id); un invitado no se puede juntar con nada, así que cada pestaña
  suya cuenta — igual que en cualquier foro. Quien esconde su actividad
  (`hide_activity`) se cuenta pero no se nombra.

# Colores en el foro: títulos de usuario y etiquetas de tema

## El título de cada persona, con su color

`supabase-migration-titulos-color.sql`: columna
`user_profiles.forum_title_color`, elegida desde /admin junto al título
(paleta cerrada con nombres: Dorado, Rojo, Verde…). El color pinta el
título bajo el nombre en cada mensaje del foro.

La parte que importa: **ese valor acaba dentro de un atributo `style`**,
así que no puede ser texto libre de nadie. Tres vallas, en orden:

1. `/admin` no deja escribir un color: se elige de la paleta.
2. La base solo acepta `#rrggbb` (restricción CHECK) — el único sitio que
   no se puede esquivar llamando a la API.
3. La pantalla (js/tema.js) valida el hex OTRA VEZ antes de pintarlo: si
   algún día se cuela un valor raro (dato de antes de la restricción, SQL
   a mano), el título sale sin color en vez de inyectar el valor. Hay
   prueba con un perfil sembrado con `red;} body{display:none`.

Guardar un título vacío borra también su color: un color sin título es un
dato huérfano esperando a confundir. Y /admin degrada por columnas: sin la
migración del color enseña títulos sin selector; sin la de títulos, la
tabla de usuarios básica — nunca en blanco.

## Cada etiqueta de tema con su color

Todas las etiquetas salían del mismo azul y no se distinguían. Ahora cada
una tiene el suyo (`COLORES_ETIQUETA` + `colorDeEtiqueta()` en
js/foro-comun.js): texto del color, fondo translúcido y borde, en las
cinco pantallas que pintan etiquetas (índice, lista, tema, sin responder
y buscador) porque todas pasan por `etiquetaHtml()`.

- Fijos por etiqueta, no aleatorios: [Torneo] tiene que verse igual hoy y
  mañana, en el índice y en el buscador.
- Una etiqueta que no está en la lista (una antigua, "Oficial", una puesta
  a mano) recibe color por un hash de su nombre: determinista.
- Es seguro interpolar el color en el style porque solo salen hex de la
  lista propia — nunca texto de un usuario.

## Y el error de la función que falta, traducido

"Could not find the function public.forum_editar_encuesta(...) in the
schema cache" es lo que vio el admin al editar una encuesta con la web
desplegada y el SQL sin ejecutar. Ahora ese error (PGRST202/42883) se
traduce a "Falta ejecutar supabase-migration-editar-encuestas.sql…". Las
tres migraciones nuevas llevan además `notify pgrst, 'reload schema'` al
final: Supabase suele recargar el esquema solo, pero a veces tarda, y
mientras tanto la función existe pero PostgREST no la ve.

# Extras del foro: resuelto, contador, firma, reacciones y quién lee

Cinco cosas de foro de toda la vida, en una sola migración
(`supabase-migration-foro-extras.sql`).

## Resuelto

`forum_threads.solved_post_id`. El autor del tema (o el equipo) marca la
respuesta que lo resolvió desde el pie del mensaje — nunca el primero: la
pregunta no puede ser su propia respuesta. La cabecera y las listas
enseñan la chapa ✓ (la de la cabecera lleva al mensaje) y la respuesta
queda enmarcada. La política de update ya dejaba al autor tocar su tema;
lo que la política no puede comprobar —que el mensaje sea de ESE tema— lo
impone un disparador (`forum_valida_resuelto`).

## Contador de mensajes

`user_profiles.forum_post_count`, mantenido por disparador en
forum_posts (insert/delete) con relleno inicial. Es columna y no cuenta
al vuelo porque sale en CADA mensaje de CADA tema: sería la consulta más
repetida de la web.

## Firma

`user_profiles.forum_signature`: texto plano, máx. 240 (restricción CHECK
— el límite del textarea es cortesía, el de la base es el de verdad). Se
edita en Editar perfil y se pinta ESCAPADA al pie de cada mensaje: hay
prueba con una firma sembrada con `<b>` comprobando que no se interpreta.
El guardado del perfil reintenta sin la columna si aún no existe, para no
bloquear el resto del formulario.

## Reacciones (sustituyen al "me gusta")

`forum_post_reactions`: (post_id, user_id) como clave — UNA reacción por
persona y mensaje; cambiar de emoji es un update, repetir la tuya la
quita. Sin esa clave, un mensaje se "auto-inflaría" reaccionando cuatro
veces. `kind` en ('like','love','laugh','wow') por CHECK. Reaccionarse a
uno mismo lo prohíbe la política (como el me gusta), y la pantalla ni
enseña botones en el mensaje propio. **Los me gusta existentes se migran
como 'like'**; la tabla vieja queda sin uso, no se borra.

## Quién está leyendo este tema

`online_now.thread_id`: el latido (js/en-linea.js) apunta en qué tema
estás; en cualquier otra página lo SOBRESCRIBE a null — salir de un tema
no puede dejarte "leyéndolo" un cuarto de hora. La función cambia de firma
a `latido_en_linea(p_token, p_thread default null)` (se retira la vieja
para que PostgREST no vea dos candidatas), y el cliente REINTENTA sin el
tema si la base aún tiene la firma vieja: entre desplegar y migrar, el
contador de en línea no se apaga. Un tema inexistente se ignora sin romper
el latido. En el tema: "Leyendo ahora: Ash y 2 invitados" — quien esconde
su actividad se cuenta pero no se nombra.

Detalle de las pruebas: Playwright es un robot de verdad
(navigator.webdriver + user agent Headless), así que para probar el
latido las pruebas lo "humanizan" desactivando LAS DOS señales — con una
sola no basta, que es justo lo que la detección promete.

## La firma, con el editor de los mensajes (y sus tres límites)

La primera versión era un textarea de texto plano y se quedó pocha: la
firma usa ahora el MISMO editor richtext que los mensajes (formato,
enlaces, imagen). Los límites, cada uno donde toca:

- **240 letras visibles y 1.000 de HTML**: los avisa la pantalla al
  guardar (sin recortar en silencio), y el de 1.000 lo impone también la
  restricción de la base (que pasó de 240 de texto plano a 1.000 de HTML
  — si ya ejecutaste foro-extras, re-ejecútala: es idempotente).
- **El tamaño EN pantalla lo impone el CSS**, que es el único límite que
  nadie esquiva escribiendo HTML raro: la caja de la firma tiene altura
  máxima con scroll propio (una firma enorme hace scroll DENTRO de su
  caja, nunca entierra el hilo) e imágenes a 64px de alto.
- Se guarda SANEADA con el saneador de los mensajes y se RE-sanea al
  pintarse: lo de la base no se pinta a ciegas. La semilla de las pruebas
  lleva un <script> colado que tiene que desaparecer.

# El spoiler, pulido: editar el título, seleccionar y copiar

Tres roces que tenía el spoiler por ser un <details> nativo, encontrados
usándolo:

- **En el editor, pulsar la pestaña para cambiar el título la plegaba.**
  El comentario del código prometía que dentro de un contenteditable el
  clic no pliega — mentira en la práctica. Ahora el editor escucha el
  evento `toggle` (en captura: no burbujea) y deshace cualquier plegado
  al instante: el clic solo coloca el cursor. Además `user-select: none`
  y el cursor de mano del CSS aplicaban también al editor: el título ni
  se podía seleccionar. En `.rte-surface` el resumen es texto
  (`user-select: text; cursor: text`).
- **Enter en el título partía el <summary> en dos.** Ahora baja el cursor
  al cuerpo del spoiler, que es lo que espera cualquiera al terminar de
  escribir un título.
- **En el lector (js/spoilers.js, escuchas delegadas en guia y tema):**
  (1) seleccionar texto que termina sobre la pestaña la plegaba — el
  navegador dispara un clic al soltar; si hay una selección sin colapsar,
  el clic no pliega. OJO: se mira `isCollapsed`, NO el texto de la
  selección — la pestaña lleva user-select:none y una selección sobre
  ella existe con toString() vacío (así se descubrió). (2) copiar una
  selección que atraviesa un spoiler CERRADO se llevaba su contenido
  oculto (está en el DOM aunque no se vea): ahora se copia lo visible —
  de un spoiler cerrado, solo su pestaña. Con el spoiler abierto no se
  interviene la copia.

# El editor: deshacer de verdad, spoiler en el cursor y aspa de borrar

Tres quejas reales del admin, con una causa común: el editor construye
cosas tocando el DOM (spoilers, imágenes-carta, filas, listas, bloques), y
para el Ctrl+Z NATIVO del navegador todo eso no existe — solo deshacía "el
texto".

- **Historial de deshacer propio.** No hay forma sana de mezclar la pila
  nativa con mutaciones de DOM, así que el editor lleva la suya:
  instantáneas del contenido en cada cambio (con el tecleo seguido
  fusionado en una entrada — y SOLO tecleo con tecleo: escribir justo
  después de poner un spoiler no puede fundirse con la entrada del
  spoiler). Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z se interceptan, y también el
  `beforeinput historyUndo/historyRedo` del menú contextual y el móvil.
  Tope de 100 entradas. Tras deshacer, el cursor va al final (guardar la
  posición exacta a través de innerHTML no compensa su complejidad).
- **El spoiler nace donde está el cursor.** Antes caía debajo del bloque
  entero ("se va para abajo"). Se probó execCommand('insertHTML') —
  habría dado el punto exacto y la pila nativa a la vez — y NO VALE:
  Chrome le arranca el <summary> al <details> y lo convierte en un span
  con estilos. Así que el párrafo (o título) se parte a mano por el
  cursor: lo de antes queda arriba, lo de después debajo del spoiler.
- **Aspa de borrar en cada pestaña (solo en el editor).** No había forma
  humana de quitar un spoiler: el <details> no se deja seleccionar como
  bloque. El aspa borra el spoiler entero y, como pasa por el historial,
  Ctrl+Z lo recupera — el foco vuelve al editor tras borrar justo para
  eso. El ✕ va en un ::before del CSS y NUNCA como texto del botón: el
  saneador tira los <button> pero CONSERVA su texto, y un aspa escrita
  dentro acabaría guardada en el título del spoiler.

# Insertar cartas, imágenes y vídeos DENTRO de un spoiler

La queja: «no puedo insertar cartas o imágenes dentro de spoilers, se va
para abajo». La causa estaba en dos sitios que subían por el DOM «hasta el
hijo directo de la superficie» para decidir dónde colgar un bloque: con el
cursor dentro de un spoiler, ese hijo directo es el `<details>` ENTERO, y
todo caía después de él — fuera.

- **`esContenedorDeBloques`**: los bloques cuelgan de la superficie o, si
  el cursor está en un spoiler, del `<details>`. `bloqueDelCursor` (listas
  de cartas, vídeos, spoilers nuevos) y `asegurarFigura` (imágenes con
  forma de carta, tamaño/colocación/pie) paran ahí en vez de seguir
  subiendo. Un `<figure>` o un `<tcg-deck>` dentro de un `<details>` es
  HTML válido y el saneador lo conserva tal cual.
- **Las flechas de mover bloque** también paran en el spoiler: dentro lo
  recorren, y en los bordes lo SACAN (subir con la pestaña justo encima lo
  deja delante del spoiler; bajar al final lo deja detrás). Es la manera
  de rescatar una imagen sin cortar y pegar. Desde fuera, subir/bajar
  SALTAN el spoiler por encima — meterse dentro sin querer sería peor.
- Detalles con dientes: la pestaña (`<summary>`) nunca se toca — al
  envolver en figura una imagen cuyo bloque queda vacío, ese bloque se
  quita, salvo si es la pestaña (un details sin summary deja de ser un
  spoiler); y `agruparConLaAnterior` ya era seguro porque una pestaña ni
  es figura de carta ni es fila.

# Depuración a fondo del editor: las fronteras del spoiler son paredes

La queja que lo destapó: «cuando doy Enter dentro del spoiler y después de
una fila de 4 cartas se abre eso que pone Detalles y no puedo hacer nada».
Lo que pasa por debajo: con el cursor "suelto" entre bloques de un
`<details>` (justo después de una fila, que es contenteditable=false),
el Enter nativo de Chrome PARTE el details en dos — y la segunda mitad
nace sin `<summary>`, así que el navegador le pinta su marcador por
defecto («Detalles»): un bloque fantasma imposible de seleccionar o
borrar. El arreglo va en dos capas que se refuerzan.

**Capa 1 — teclas en las fronteras** (una escucha de keydown para
Enter/Backspace/Supr):

- Enter con el cursor suelto sobre un contenedor (la superficie o un
  details), o dentro de un bloque que no es de texto (fila, figura — el
  pie de foto incluido): se inserta un `<p>` a mano donde está el cursor,
  nunca el Enter nativo que parte contenedores. De paso arregla otro
  latente: Enter en un pie de foto partía la figura en dos.
- Enter en el párrafo vacío del FINAL del spoiler = SALIR de él (como el
  doble Enter que cierra una lista). No había manera obvia de terminar
  un spoiler y seguir escribiendo debajo.
- El borrado nativo FUNDE bloques a través de cualquier borde. Ahora las
  fronteras del spoiler son paredes: Backspace al principio del cuerpo
  ya no mete el cuerpo en la pestaña; Supr al final de la pestaña ya no
  se traga el cuerpo; Backspace justo debajo de un spoiler ya no
  teletransporta el párrafo adentro (ni Supr justo encima saca la
  pestaña). El CURSOR sí cruza — se coloca al otro lado — pero el
  contenido no se arrastra. Ctrl+Enter y Shift+Enter se respetan.

**Capa 2 — red de seguridad estructural** (`sanearEstructura`, en cada
emit): venga por donde venga el estropicio (una tecla no prevista, un
pegado, un arrastre), se repara en el siguiente cambio, antes de que
entre al historial:

- `<details>` sin pestaña → se deshace, sacando su contenido fuera.
- Pestaña descolocada → vuelve la primera; pestañas de más o huérfanas
  (fuera de un details) → se vuelven párrafos.
- `.rt-fila` sin figuras → fuera; con una sola → se deshace la fila
  (coherente con sacarUnaDeLaFila).
- Superficie sin nada → repone el `<p><br></p>` semilla (pasaba al
  borrar con el aspa el único spoiler del texto; el cursor va a él).
- No toca nada dentro de `<tcg-deck>` ni `<yt-video>`: su interior es
  del pintado, no del autor.

Además, `bloqueDelCursor` entiende ahora el cursor suelto sobre un
contenedor (usa el offset del rango para dar con el bloque de al lado),
con lo que insertar cartas o vídeos con el cursor entre bloques cae en el
sitio exacto y no al final.

Nota de banco de pruebas: el Chromium del banco NO parte el details con
el cursor suelto (mete un `<p>` él solo) — el Chrome del admin sí. Por
eso la rotura de esa regla se comprueba con el pie de foto, que el Enter
nativo sí parte en dos `<figcaption>` en cualquier Chromium. Y ojo con
el pie recién creado: queda SELECCIONADO, y un Enter sobre esa selección
también partía el pie — la regla cubre el Enter con selección dentro de
bloques opacos (borra la selección y baja a un párrafo nuevo).

# Tanda visual: el nivel cobra vida y el editor gana emojis

El admin pidió «cositas para hacerla más bonita o agradable». Antes de
añadir nada se repasó lo que YA existía — y tres de las ideas propuestas
resultaron estar hechas: los avatares por defecto llevan color
determinista + inicial desde hace tiempo (avatarStyle), el hero del
perfil ya tiene su barra de XP, y «El foro en números» (temas, mensajes,
miembros, el último registrado, por aquí hoy, en línea) ya vive en la
lateral del foro. Lo que faltaba de verdad:

- **Chapa de nivel con color e icono** (`NIVEL_ESTILOS` +
  `levelBadgeHtml` en gamification.js): gris Novato 🌱, verde Entrenador
  🎮, azul Coleccionista 🃏, morado Experto ⭐, dorado Maestro 👑 —
  iconos SVG del juego propio, no emojis. Se pinta en el foro (columna
  del autor, donde SIGUE mandando el título del admin y el rango de
  colaborador), el hero del perfil propio y público, el directorio de la
  comunidad y el menú de cuenta. Colores de una lista cerrada del
  código, así que van al style inline con tranquilidad.
- **El modal de Niveles dice cuánto te falta**: en tu escalón, barra de
  progreso y «340 / 1000 XP — te faltan 660 para Coleccionista». Los
  umbrales ya estaban en LEVEL_THRESHOLDS; era solo pintarlos.
- **Subir de nivel se celebra**: addXP compara el nivel antes y después
  de guardar y, si se cruza un umbral, confeti + toast («¡Has subido de
  nivel! Ahora eres X»). Dentro de un try: la fiesta no puede tumbar
  jamás el guardado del XP.
- **Botón de emojis en el editor** (parrilla de 40, curada): se insertan
  como TEXTO con insertText — pasan por la pila de entrada normal, el
  historial los apunta y el saneador los deja pasar como cualquier
  letra. Vale en guías, foro y firma, y también en el título de un
  spoiler. Ojo con la escucha de las paletas de color: ahora selecciona
  `button[data-color]`, porque la parrilla de emojis comparte la clase
  rte-paleta (y el cierre al pinchar fuera) pero no es un color.

Sin ninguna migración: todo sale de columnas y tablas que ya existen.

# Tanda de comunidad: en línea, agradecimientos, PWA, tarjetitas, trofeos del foro, «/» y cumpleaños

Siete mejoras aprobadas de la segunda lista (dos de la lista resultaron
estar ya hechas y se descartaron a tiempo: fijar temas con chincheta
existía completo, y la actividad del foro del perfil ya tenía sus dos
listas — lo que le faltaba eran los TOTALES de verdad).

- **El puntito verde de «en línea ahora»** (tema.js `marcarConectados`):
  a los avatares de quien está ahora en la web se les pone la marca. El
  dato ya lo mantenía el latido de en-linea.js; quien esconde su
  actividad se cuenta pero no se señala. Va después del pintado y por su
  cuenta: si falla, el tema ya está en pantalla.
- **Los números de verdad en la actividad del foro del perfil**
  (foro-actividad.js): los contadores de cabecera eran el `length` de
  listas recortadas a 20 — a quien lleva 300 mensajes le ponía «20».
  Ahora son consultas de contar, más la tira nueva con las REACCIONES
  RECIBIDAS (los «agradecimientos» de los foros de toda la vida). Ese
  recuento va con un join embebido de PostgREST
  (`post:forum_posts!inner(author_id)` + `eq('post.author_id', …)`) —
  nunca un `.in()` con todos sus mensajes: a 300 mensajes la URL del
  filtro revienta.
- **PWA instalable**: manifest.webmanifest + iconos PNG (192/512,
  rasterizados del favicon.svg) + `<link rel="manifest">`, theme-color y
  apple-touch-icon en las 23 páginas. En el móvil, «Añadir a pantalla de
  inicio» abre PokeDoc como una app.
- **Tarjetitas de enlaces internos** (js/enlaces-internos.js): un enlace
  a un tema o una guía de PokeDoc pegado «a pelo» (el texto ES la
  dirección, o venía como texto plano) se pinta al LEER como tarjetita
  con su título real. Decoración de lectura, como las listas de cartas:
  lo guardado no cambia, y un enlace con texto puesto por el autor no se
  toca jamás. Cuidado aprendido: comparar texto y href pasándolos por
  `new URL` — uno puede venir relativo y el otro absoluto.
- **Trofeos del foro**: los logros de /admin entienden tres condiciones
  nuevas — mensajes escritos, temas abiertos y reacciones recibidas. Las
  consultas extra solo se hacen si algún logro activo las usa.
- **Buscador global**: la tecla «/» (fuera de un campo de texto) abre la
  lupa de la navbar, y el popup enseña resultados rápidos de guías y
  temas del foro (3 de cada, con la misma vuelta-atrás de acentos que
  buscar.html y número de secuencia contra la carrera de respuestas).
- **Cumpleaños** (supabase-migration-cumples.sql — LA ÚNICA MIGRACIÓN de
  la tanda): columna opcional `birthday` + generada `birthday_md`
  («08-21») con lpad/extract, porque una columna generada exige
  expresión inmutable y to_char no lo es. Campo en Editar perfil (con
  reintento sin la columna si la web se despliega antes que el SQL), y
  «🎂 Hoy cumple años @tal» en El foro en números — tolerante: sin la
  migración, la línea no sale.

# Tanda social: tarjetitas, avisos que faltaban, Gracias, aviso global, multicita y volver arriba

Siete aprobadas; DOS resultaron estar ya hechas al verificar (costumbre
que ya ha salvado cuatro duplicados): el Open Graph de los temas del
foro ya lo pintaba meta-social.js, y el aviso a quien citas ya salía en
avisar() — de ahí solo faltaba el matiz del título.

- **Tarjetita al posar el ratón sobre un nombre** (js/hovercard.js):
  avatar, chapa de nivel, XP, mensajes del foro, bio recortada y el
  botón de Seguir/Siguiendo, sin ir al perfil. Escucha delegada global
  (vale para todo lo que se pinte después), solo donde hay hover de
  verdad (`(hover: hover)`), con 350 ms de intención y caché por nombre.
- **Reaccionar avisa al autor** (tipo `forum_reaction`, con casilla
  propia en las preferencias): UNA vez por persona y mensaje — cambiar
  de 👍 a ❤️ no re-avisa (se mira si ya tenías `.foro-reaccion-mia`
  antes de tocar). El aviso lleva el emoji y el enlace al mensaje.
- **«Te han citado en el foro»**: el título del aviso ahora distingue
  mención > cita > respuesta.
- **«Gracias: N» bajo el avatar** en cada tema, pareja del clásico
  «Mensajes: N»: las reacciones recibidas EN TOTAL por cada autor de la
  página, en un solo viaje con el join embebido
  (`in('post.author_id', autores)`). El 0 también se dice.
- **Aviso global del admin** (supabase-migration-ajustes.sql, la única
  migración: tabla site_settings clave→valor, lectura pública y
  escritura solo admin): franja arriba de toda la web, escrita desde el
  Dashboard de /admin (texto, tono informativo/importante, activo).
  Cada cual la cierra, y el cierre se recuerda POR HUELLA del texto: un
  aviso nuevo vuelve a salir aunque cerraras el anterior.
- **Multicita**: con una cita ya anclada, «Citar» en otro mensaje lo
  añade como blockquote en la caja (autor delante, 400 letras máx.) y
  apunta a su autor para el aviso. El ancla (reply_to_id) sigue siendo
  la primera.
- **Volver arriba**: el botón flotante de toda la vida, global (app.js),
  a partir de 600 px de scroll.

## Tanda «al día» (agosto 2026): sin-leer honesto, contador en la pestaña y racha a la vista

Sin SQL: los tres cambios son de cliente.

### Tu propio mensaje ya no cuenta como "sin leer"

El fallo: respondías en un tema y el tema se te ponía en negrita — la
"novedad" era tu propio mensaje. Pasaba porque `marcarLeido` solo corría
al ABRIR el tema, y tu mensaje es posterior a esa marca.

Dos cinturones, en `js/foro-lecturas.js` y `js/tema.js`:

- **La excepción**: `estaSinLeer` devuelve `false` cuando
  `last_post_author_id` eres tú. Para escribir el último mensaje tuviste
  que abrir el tema, así que lo anterior ya lo viste. `marcasDeLectura`
  guarda ahora `mio` (el id de quien pregunta) dentro del objeto de
  marcas para no cambiar la firma en todos los que llaman; y la consulta
  de `sinLeerPorForo` pide también `last_post_author_id`, para que el
  contador del índice cuente igual que la lista.
- **La marca renovada**: al publicar una respuesta, `marcarLeido` se
  llama otra vez. Cubre además la carrera de que alguien conteste justo
  después de ti (ahí el último ya no eres tú y la excepción no vale).

### El contador en la pestaña del navegador (`js/pestania.js`)

`(3) PokeDoc — …` cuando hay avisos o mensajes privados sin leer. Cada
fuente anota su número (`anotarEnPestania('avisos', n)` desde la
campanita, `'mensajes'` desde el sobre) y el módulo suma: ninguna pisa a
la otra y el total cuadra con las burbujitas.

La trampa que hubo que sortear: tema.js, foro.js o guia.js reescriben
`document.title` cuando les llegan los datos, DESPUÉS de que las
burbujitas hayan puesto el `(N)` — y se lo comían. Hay un
`MutationObserver` sobre el `<title>`: si el cambio no es nuestro, se
toma como base nueva y se replanta el contador delante. Nuestro propio
cambio también dispara el observador; se reconoce comparando con lo
último que pusimos y se ignora.

### La racha diaria, a la vista en la barra

`checkDailyStreak` (que ya existía: +5 XP el primer login de cada día)
ahora DEVUELVE la racha vigente — la guardada si ya entraste hoy, la
recién avanzada si es tu primera visita del día — y `app.js` pinta con
ella un chip `🔥 N` (`.nav-racha`, enlaza al perfil). Con racha 0 no se
pinta nada: una llamita a cero desanima. Se PREPONE a `.nav-right`
porque los demás iconos se insertan de forma asíncrona y cualquier otro
sitio bailaría entre cargas; por debajo de 600 px se esconde (la barra
del móvil ya va justa).

### Cómo se probó

`test-tanda-183.mjs` (23 comprobaciones): la excepción con el banco
sembrado (t-1 acaba en mensaje de Ash → para Ash no está sin leer, para
otros sí; el índice cuenta 1 y no 2), la marca renovada mirando la BD
tras publicar (la marca tiene que quedar >= el created_at del mensaje
nuevo — la de abrir la página no vale), el contador (3 = 2 avisos + 1
conversación, baja a (1) al marcar leídos, sobrevive al título dinámico
del tema, sin pendientes no hay "(0)"), y la racha (se enseña la
guardada, suma al volver un día después, 0 no pinta, oculta a 420 px).
`rigor-183.py`: 11 roturas, todas detectadas. El stub emula ahora el
disparador de `last_post_author_id` en `recontarTema`.

## Tanda de pulido (agosto 2026): llegar al mensaje justo, visor de fotos y detalles modernos

Sin SQL: todo es de cliente.

### Ir al primer mensaje sin leer (`?nuevo=1`)

En la lista de temas, el título de un tema CON novedades (y su punto
azul, que ahora es un enlace con la zona de pulsado agrandada) apuntan a
`/tema/<id>?nuevo=1`. tema.js lee la marca de lectura VIEJA (antes de
renovarla al entrar), pide el primer mensaje posterior a ella, calcula
su página contando cuántos mensajes hay antes, repinta y lo ilumina.
Un tema ya leído sigue abriendo por el principio.

### Enlaces a mensajes que funcionan (`#mensaje-<id>`)

- **Botón de copiar enlace** junto al `#N` de cada mensaje: copia
  `/tema/<id>?p=<página>#mensaje-<id>` — la página se calcula del número
  del mensaje, sin consultas — y lo confirma con un toast.
- **Al llegar** por un enlace o aviso con `#mensaje-x`: si el mensaje no
  está en la página pintada, se calcula su página de verdad
  (`paginaDelMensaje`: cuántos mensajes hay antes de su created_at), se
  salta y se destella (`.foro-mensaje-destello`, animación de 2 s).
  Antes los avisos de la campanita apuntaban al hash sin página y en
  hilos largos te dejaban en la página 1 sin decir nada.
- `hashchange` también resuelve: pinchar un ancla de otra página (la
  chapa de Resuelto, el `#N`) salta y destella igual.

### El visor de imágenes (js/lightbox.js)

Clic en una foto del contenido (`.article-body`) → pantalla completa con
fondo oscuro, flechas (y ←/→) para pasar entre las fotos DEL MISMO
mensaje o guía, contador, pie (figcaption o alt), Escape/fondo para
cerrar. Excluye editores (`[contenteditable]`), imágenes-enlace,
`tcg-deck`/`yt-video` y firmas. Las fotos elegibles llevan cursor
zoom-in. Montado global desde app.js con escucha delegada.

### Transiciones de página y barra de progreso

- `@view-transition { navigation: auto }` en style.css: fundido suave al
  navegar en los navegadores que lo soportan; el resto lo ignora. Con
  `prefers-reduced-motion`, animación fuera.
- `.progreso-lectura`: línea de 3 px fija arriba que se llena con el
  scroll (scaleX). app.js la deja a 0 en páginas de menos de 2,5
  pantallas.

### La guía: minutos de verdad e índice vivo

- Los minutos de la etiqueta se calculan del texto real (~200 palabras
  por minuto) en vez del `estimated_mins` que puso el autor (se queda
  viejo). Sin contenido, vale el del autor.
- El índice lateral («En esta guía», que ya existía) marca la sección
  por la que vas: en scroll, el último título que pasó por debajo de la
  navbar lleva `.activo` (borde y color encendidos). A mano y no con
  IntersectionObserver: con secciones más altas que la pantalla el
  observador pierde el título y el índice se quedaba sin marca.

### Esqueletos de carga en el foro

Resultó que YA existían: foro.html y tema.html traen un `.skeleton`
estático dentro del contenedor, que el primer pintado sustituye (lo
descubrió el rigor de esta tanda: el "esqueleto por JavaScript" que se
añadió al principio era código muerto y se quitó). Lo que ganó la tanda
es la PRUEBA de que se ven y se van, y para poder escribirla el doble de
Supabase ganó `__FAKE_LENTO__` (ms de retardo en todas las respuestas) y
`__FAKE_MENSAJES_EXTRA__` (inflar un hilo a dos páginas).

### Cómo se probó

`test-tanda-184.mjs` (39 comprobaciones) y `rigor-184.py` (14 roturas).

## Tanda foro fino + push (agosto 2026)

### La cita enlaza al mensaje original

La cabecera del blockquote («Misty escribió:») es ahora un enlace a
`#mensaje-<id>`: el resolutor de páginas de la tanda anterior hace el
salto (a otra página si hace falta) y el destello. Solo la cita ancla
(reply_to_id) — las multicitas pegadas en el cuerpo no llevan id.

### Las reacciones dicen quién

`reaccionesHtml` recibe los perfiles y pone en el `title` de cada
reacción los nombres (hasta 8, luego «y N más»). Los perfiles de
reactores que no son autores de la página se piden en una segunda
`perfilesPorId` solo si faltan.

### Filtrar temas por etiqueta (`?et=`)

La chapa de etiqueta en la lista de temas es un enlace a
`?et=<etiqueta>`; con el filtro activo, la consulta (lista Y recuento de
páginas) añade `.eq('prefix', …)`, sale una banda con «quitar el
filtro», y el vacío tiene su propio mensaje.

### Borrador al abrir tema nuevo

Como el de la caja de responder: localStorage, por foro
(`pokedoc-borrador-tema-nuevo-<board>`), guarda {titulo, html} en cada
tecla, restaura al reabrir y se borra al publicar. Cancelar NO lo borra
(el borrador es para el accidente).

### Notificaciones push 🔔

Los avisos de la campanita, en el escritorio/móvil con la web cerrada.

- **supabase-migration-push.sql** (PENDIENTE de ejecutar):
  `push_subscriptions` (endpoint pk, user_id, p256dh, auth) con RLS de
  "solo lo mío", y `user_notifications.pushed_at` + índice parcial para
  el escaneo de la función. Validada contra PostgreSQL real, idempotente.
- **sw.js** (raíz): SOLO push y notificationclick — sin manejador de
  fetch a propósito: cero caché, cero riesgo de servir ficheros viejos.
  app.js lo registra en cada carga para que el navegador vea versiones
  nuevas.
- **js/push.js**: activar/desactivar ESTE navegador. La clave pública
  VAPID se lee de site_settings (`push_vapid_public`); la suscripción se
  guarda por endpoint (upsert). Sin migración ejecutada, deshace la
  suscripción del navegador y lo dice.
- **Perfil → Editar**: bloque «Avisos en este dispositivo» con el estado
  real (sin soporte / bloqueado / activar / desactivar).
- **/admin → Notificaciones push**: genera el par de claves VAPID con
  WebCrypto EN el navegador del admin. La pública se guarda en
  site_settings; la privada se enseña UNA vez para pegarla en Netlify
  como `PUSH_VAPID_PRIVATE`. Regenerar invalida las suscripciones y el
  panel lo avisa.
- **netlify/functions/enviar-push.mjs** (programada cada 5 min, como la
  de correo): lee los avisos con `pushed_at is null` de las últimas 24 h,
  los empuja cifrados (librería web-push, dependencia nueva del
  package.json) a las suscripciones de cada destinatario, borra las
  suscripciones muertas (404/410) y marca TODOS los revisados — también
  los de quien no tiene push, para no re-escanearlos eternamente. Sin
  claves configuradas no falla: no hace nada y lo dice.
- Enlaces del aviso SIEMPRE absolutos (SITE_URL); el clic en la
  notificación reutiliza una pestaña de PokeDoc si la hay.

Para encender el sistema, en orden: (1) ejecutar la migración, (2)
generar claves en /admin, (3) pegar la privada en Netlify
(PUSH_VAPID_PRIVATE) y redesplegar, (4) cada cual activa los suyos en
su perfil.

### Cómo se probó

`test-tanda-185.mjs` (36 comprobaciones Playwright: cita, quién, filtro,
borrador, interruptor con un navegador-doble de push, claves del admin
con WebCrypto real, sw.js servido y registrado) y
`test-push-funcion.mjs` (15 comprobaciones en node SIN red: la función
con base y push dobles, y la validación de que las claves generadas como
las genera /admin las acepta web-push y cifra de verdad —
generateRequestDetails hace VAPID + aes128gcm sin tocar la red).
`rigor-185.py`: 14 roturas. El doble de Supabase ganó push_subscriptions
y `__FAKE_CLAVE_PUSH__`. NOTA honesta: el autocompletado de @menciones
que se vendió en la lista ya existía (js/mencion-autocompletar.js) y se
descartó de la tanda.

## La columna del autor, ordenada (agosto 2026)

Lo destapó el propio admin: el foro enseñaba UNA sola etiqueta bajo el
nombre con un orden de mando (título de admin > rango de colaborador >
nivel), así que a quien tenía guías aprobadas el rango le TAPABA su
nivel de XP — unos parecían tener nivel y otros no.

Ahora (`tituloDe` en js/tema.js):

1. **El nivel sale SIEMPRE**, para todo el mundo — es la vara de medir
   común. Es un botón: al pincharlo se abre la escalera de niveles
   entera con el punto exacto de ESA persona (su XP, cuánto le falta).
2. **Debajo, UNA distinción como máximo**: el título puesto a mano por
   un admin — ahora como ETIQUETA con el color elegido (mismo truco
   color+fondo+borde que las etiquetas de tema; el hex se valida antes
   de entrar en el style, como siempre) — o, si no hay título, el rango
   de colaborador, también clicable (abre sus rangos).
3. El título de admin NO es clicable (no hay escalera que enseñar).

Las escaleras (`levelLadderHtml`/`tierLadderHtml` de gamification.js)
ganaron `{ ajeno: true }`: abiertas desde el foro hablan en tercera
persona («Su nivel», «le faltan…») en vez de tutear con datos de otro.
El modal del foro es propio (`.foro-modal-escalera`), con Escape/fondo/✕.

Probado con test-tanda-186.mjs (28 comprobaciones, incluida la de que un
forum_title_color malicioso sembrado no cuela en el style) y rigor de 9
roturas, todas detectadas. La prueba vieja de la precedencia
(test-tanda-visual) se actualizó a la realidad nueva.

## Tanda de crecimiento (agosto 2026): que la comunidad se traiga a la siguiente

Cinco piezas pensadas para atraer gente nueva y retener a la que hay.
Dos traen migración SQL (PENDIENTES de ejecutar en el SQL Editor):
`supabase-migration-referidos.sql` y `supabase-migration-top-mes.sql`,
ambas validadas dos pasadas (idempotencia) contra PostgreSQL real.

### 1. Presumir del reto diario (el bucle de Wordle)

En la pantalla final del reto (`?reto=hoy`, SOLO en modo diario) sale
`#btnPresumir` (js/curso.js): un texto listo para pegar —
«🎴 Reto Pokémon TCG de hoy en PokeDoc: 3/5 🥉 / ¿Puedes superarlo?» —
con el enlace al reto. En móvil abre la hoja de compartir del sistema
(navigator.share); sin ella, portapapeles + toast.

### 2. Enlaces de invitación (referidos)

- **supabase-migration-referidos.sql**: `user_profiles.referred_by uuid`
  (referencia a auth.users, `on delete set null`), índice parcial, y
  TRES trofeos nuevos en achievement_definitions: `embajador` (1 traído,
  plata, 50 XP), `embajador-oro` (5, oro, 150 XP) e `invitado-de-honor`
  (llegar invitado, bronce, 25 XP) — insertados con
  `insert…select…where not exists` para poder re-ejecutar.
- El flujo: la tarjeta «Invita a un amigo» del perfil (`#panelInvitar`,
  js/perfil.js) da tu enlace `/r/<usuario>` y cuenta a cuántos has
  traído. netlify.toml redirige `/r/:username` → `/auth.html?r=:username`
  (302). js/auth.js valida el valor (`/^[a-z0-9_-]{1,40}$/i`) y lo apunta
  en localStorage — así sobrevive al registro, la confirmación de correo
  y el OAuth, que pierden la query. Al TERMINAR el onboarding,
  `apuntarPadrino` (js/onboarding.js) lo consume (removeItem), resuelve
  el username, y hace `update({referred_by}).is('referred_by', null)`
  — una sola vez, nunca a uno mismo.
- **Sin escrituras cruzadas entre cuentas**: los premios los reparte el
  sistema de trofeos con su xp_reward. El invitado desbloquea el suyo en
  esa misma sesión (checkAchievements tras apuntar) y el padrino los de
  Embajador la próxima vez que entre (gamification.js ganó los tipos
  `referrals_count` y `was_referred`, con la consulta de conteo gated
  por tiposActivos: sin la migración no se consulta nada).

### 3. La insignia SVG para firmas de otros foros

`/insignia/<usuario>` (rewrite 200 en netlify.toml) →
netlify/functions/insignia.mjs: SVG 340×84 con inicial, nombre, nivel
con su color, XP, rango de colaborador si lo hay y pokedoc.es. Usa la
clave ANÓNIMA pública (solo lee lo que ya es público), valida el nombre
antes de consultar, escapa TODO lo que entra en el XML (`xml()`) y
cachea una hora. Los umbrales/colores de nivel van duplicados a
propósito (una función de Netlify no puede importar js/ del navegador);
el comentario del fichero avisa de mantenerlos a mano.

### 4. El top del mes en la portada

- **supabase-migration-top-mes.sql**: tabla `xp_mes (user_id, mes
  [día 1], xp_inicio, pk(user_id,mes))`, RLS de lectura pública y SIN
  políticas de escritura: solo escribe el service role.
- **netlify/functions/top-del-mes.mjs** (programada a diario, 03:43
  UTC): a quien no tenga foto ESTE mes se la toma (xp_inicio = su
  total_xp de ahora). Correr a diario mete a los recién registrados con
  foto 0 y auto-repara pasadas fallidas; `on_conflict` +
  `resolution=ignore-duplicates` la hace a prueba de carreras.
- **js/home.js** (`cargarTopDelMes`): pinta en `#topMesSeccion` los 5
  que más XP han ganado ESTE mes (total_xp − xp_inicio), con podio
  🥇🥈🥉 y enlaces al perfil. Es la liga que un recién llegado puede
  ganar. Sin migración o sin fotos, la sección ni sale.

### 5. El resumen semanal por correo

**netlify/functions/resumen-semanal.mjs** (lunes 08:10 UTC): junta los
3 temas con más mensajes de los últimos 7 días + la guía aprobada de la
semana y ENCOLA en email_outbox (tipo `weekly_digest`) — el envío real
lo hace send-emails, como siempre. Detalles que importan: semana sin
contenido = no se manda nada (ni se consultan destinatarios); respeta
`notification_email_disabled` (casilla nueva en Editar perfil vía
EMAIL_TYPES, y su nombre en baja-correo.mjs para la baja de un clic);
dedupe por `thread_key = digest:AAAA-SS` (semana ISO): correr dos veces
el mismo lunes no repite a nadie. Sin más variables de entorno que la
SUPABASE_SERVICE_ROLE_KEY ya existente.

### Cómo se probó

`test-tanda-187.mjs` (27 comprobaciones Playwright: jugar el reto hasta
el final y presumir, el apunte del padrino con basura rechazada, el
onboarding entero consumiendo el apunte + el trofeo cayendo en la misma
sesión, el top ordenado con el admin sin ganancia fuera, la casilla y
los redirects) y `test-crecimiento-funciones.mjs` (27 en node SIN red:
insignia con escape XML y validación, foto mensual solo-a-quien-falta y
a prueba de carreras, resumen con dedupe/preferencias/semana-vacía).
`rigor-187.py`: 16 roturas previstas, todas detectadas. El doble de
Supabase ganó la tabla xp_mes y el gancho `__FAKE_XP_MES__`.

## La portada viva (agosto 2026)

Un repaso a la home con una idea detrás: la portada enseñaba contenido
(guías, categorías) pero ninguna PRUEBA de que dentro hay gente. Cuatro
cambios, todos en index.html + js/home.js + CSS, sin migraciones:

1. **«Ahora en el foro», para todo el mundo** (`#foroVivoSeccion`,
   `cargarForoVivo`): los 4 temas con actividad más reciente
   (forum_threads por last_post_at), con quién habló último, hace cuánto
   y cuántos mensajes. Los temas son públicos, así que el visitante lo
   ve — es la prueba de vida. Reutiliza foro-comun.js (haceCuanto,
   nombreDe, perfilesPorId, urlTema). Foro vacío o error → no sale.
2. **El reto del día, a la vista del visitante**: antes `cargarReto`
   se iba sin sesión y la mecánica más enganchosa quedaba escondida.
   Ahora al visitante le sale la tarjeta con el clic hacia auth.html
   («Crea tu cuenta y juega») — el bucle de volver mañana empieza antes
   de que exista la cuenta. Con sesión, todo como estaba.
3. **Números de comunidad en el hero** (`cargarNumerosComunidad`):
   miembros (count de user_profiles) y mensajes de los últimos 7 días
   (count de forum_posts), junto a las guías. «6 categorías» no crece
   nunca; «67 miembros» sí. Si la consulta falla se quedan los guiones
   del HTML — mejor guion que cero mentiroso.
4. **La bienvenida del miembro** (`#bienvenidaSeccion`,
   `cargarBienvenida`): con sesión, el hero de marketing se oculta y en
   su lugar sale una barra compacta: nombre, chip de racha (solo si >0
   — nada de «0 días»), chapa de nivel (levelBadgeHtml) y enlace al
   perfil. El hero solo se esconde cuando la bienvenida está LISTA: si
   algo falla, la portada de siempre queda entera.

Probado con test-tanda-188.mjs (27 comprobaciones: la portada del
visitante y la del miembro por separado; ojo, «sin sesión» en el stub
es `__FAKE_SESSION__ = 'none'` — sin sembrar nada da la sesión del
admin) y rigor-188.py: 8 roturas, todas detectadas.

### Retoque tras verla en producción

El admin la vio desplegada y pidió dos cosas: aire entre los bloques
(iban pegados: `.container` no trae margen vertical — ahora las
secciones apiladas de la home llevan `margin-top`, en la SECCIÓN y no
en la tarjeta para que las ocultas no dejen hueco) y una portada del
miembro menos «de letra»: ahora hay CARAS — el avatar de quien habló
último en cada fila de «Ahora en el foro» (con título y meta en dos
líneas), el avatar de cada cual en el top del mes y el del propio
usuario en su bienvenida. Todo con el avatarHtml de foro-comun.

### El correo del resumen, con forma propia

El primer resumen real salió feo: un bloque de texto sin saltos ni
enlaces, con el pie genérico «alguien se ha dirigido a ti» (mentira
para un resumen). La causa: se encolaba texto plano y lo pintaba la
plantilla genérica de send-emails, que está pensada para UN aviso.

Ahora resumen-semanal.mjs encola el cuerpo ESTRUCTURADO (JSON en
`preview`: temas con id/título/conteo y la guía con su slug) y
lib/email.mjs gana `renderResumenSemanal` — cada tema es un enlace a su
hilo, la guía lleva el suyo, botón «Ver el foro» y un pie honesto («una
vez por semana…») — más `renderFilaDeCola`, el cruce que usa
send-emails: weekly_digest con JSON → plantilla propia; JSON que no
parsea (filas antiguas) o cualquier otro tipo → la genérica de siempre.
Sin migraciones ni columnas nuevas.

Probado en test-crecimiento-funciones (sección 4 nueva: enlaces por
tema, escapado de títulos, pie, baja de un clic con el & escapado en el
href, y el cruce con fila antigua y aviso normal) + las 4 pruebas del
sistema de correo de siempre en verde. rigor-187 subió a 20 roturas,
todas detectadas.

## Cursos A — los estímulos (agosto 2026)

Primera de tres tandas para que el curso se SIENTA como un juego (el
plan: A estímulos, B pantalla+bloques nuevos, C más bloques+mascota).
La mecánica ya existía (racha, multiplicador, medallas); lo que faltaba
era el feedback sensorial de cada respuesta — el 90 % de lo que hace
adictivo a un Duolingo.

- **js/curso-estimulos.js** (módulo nuevo, todo decorado y todo en
  try/catch — jamás puede romper el guardado de una respuesta):
  - Sonido SINTETIZADO con WebAudio (cero ficheros): nota doble de
    acierto, tono grave de fallo, arpegio de combo y fanfarria final.
    Botón de silencio en el marcador (icons.volume2/volumeX, icono
    nuevo) con memoria en localStorage (`pokedoc-curso-silencio`).
  - Vibración en móvil (corta al acertar, doble al fallar); se respeta
    prefers-reduced-motion no vibrando.
  - `estallido()`: partículas desde la respuesta buena (posicionadas en
    fixed, se limpian solas con red de setTimeout).
  - `comboGrande()`: el «×2/×3» en grande SOLO cuando el multiplicador
    acaba de subir — no en cada acierto, que lo gastaría.
- **js/curso.js**: todo engancha en `resolver()` (el corazón del juego,
  un solo sitio) + la fanfarria junto al confetti del final. La barra
  de progreso se tiñe de dorado mientras hay multiplicador.
- **css/curso.css** (ojo: el curso NO usa components.css): latido de la
  respuesta buena y sacudida de la mala colgados de las clases
  .correct/.incorrect que ya ponía cada bloque — los bloques nuevos lo
  heredarán gratis; partículas, combo, barra, entrada + barrido de
  brillo de la medalla, y un bloque prefers-reduced-motion que apaga
  TODO el movimiento.

Probado con test-cursos-estimulos.mjs (22 comprobaciones: el audio se
prueba sustituyendo AudioContext por un doble que apunta cada
frecuencia en __NOTAS__, y la vibración anotando patrones en __VIBRA__;
el curso semilla se responde a propósito bien-bien-bien/mal/bien, con
su repesca). rigor-cursos-a.py: 10 roturas, todas detectadas. Las 5
pruebas antiguas del curso siguen en verde.

## Cursos B — la pantalla de juego y tres bloques nuevos (agosto 2026)

Segunda tanda del plan A/B/C de los cursos.

**La pantalla, con look de juego** (css/curso.css): la pregunta más
grande, y botones «tecla» al estilo Duolingo — borde inferior gordo que
se hunde al pulsar — en todas las respuestas de texto.

**Tres tipos de bloque nuevos** (12 en total ya). Cada uno tocó los
CUATRO sitios de siempre: PRACTICE_TYPES + PREFIJO + enunciadoDe en
curso-juego.js (sin esto el reto diario y la repesca los ignorarían o
colisionarían sus claves), render + setup en curso.js, plantilla +
etiqueta + formulario en block-editor.js, y CSS en curso.css.

1. **El intruso** (`intruso`): 4 cartas y una NO encaja
   (`card_ids` + `intruso_id`). Misma rejilla y clases que el cartaquiz
   → hereda estímulos y estilos gratis.
2. **Desliza: ¿verdadero o falso?** (`desliza`): afirmaciones de una en
   una (`afirmaciones: [{text, es_verdad}]`), deslizando con Pointer
   Events (dedo y ratón) o con botones. El bloque entero cuenta como
   UNA pregunta: se acierta con pleno. En el editor se escriben
   `texto :: v` / `texto :: f` por línea.
3. **Memoria** (`memoria`): `card_ids` por parejas, boca abajo, con
   volteo 3D. Margen de fallos = nº de parejas; terminar dentro del
   margen es acierto. Las parejas acertadas sueltan partículas.

Ojo dos trampas descubiertas: el selector de tipos del editor sale de
COURSE_BLOCK_DEFAULTS con la etiqueta de COURSE_BLOCK_LABELS y el
nombre crudo como respaldo — la prueba exige la etiqueta EXACTA porque
«intruso» a secas colaría; y los bloques sin contenido (desliza sin
afirmaciones, memoria sin cartas) dejan pasar con desbloquearContinuar
para no atascar un curso por un bloque mal rellenado.

Probado con test-cursos-bloques.mjs (26 comprobaciones: los tres
bloques jugados enteros — incluido el gesto de arrastre real con el
ratón —, el camino del fallo del intruso, y el editor ofreciendo los
tres con su etiqueta) y rigor-cursos-b.py: 8 roturas, todas detectadas.

## Cursos C — escribe, las diferencias y la mascota (agosto 2026)

Tercera y última tanda del plan A/B/C (14 tipos de bloque ya). Igual
que la B: cada bloque tocó PRACTICE_TYPES + PREFIJO + enunciadoDe,
motor, editor y CSS.

1. **Escribe la respuesta** (`escribe`): campo libre contra una lista
   de `answers` aceptadas. La comparación (normalizaRespuesta) perdona
   acentos, mayúsculas y espacios de más. Al fallar se enseña la
   respuesta buena. Enter responde. Recordar > reconocer: es el
   ejercicio Duolingo que faltaba.
2. **Las diferencias** (`diferencias`): imagen A (original) y B (con
   las diferencias) lado a lado; se toca cada diferencia en la B. Las
   zonas van en porcentaje (como «encuentra el fallo») y el margen de
   fallos es el nº de diferencias. En el editor, la B reutiliza el
   widget de marcar zonas; la subida de imágenes del editor se
   generalizó con `data-campo` (retrocompatible: sin él sigue siendo
   image_url) para poder subir DOS imágenes en el mismo bloque.
3. **La mascota reactiva** (`mascotaDice` en curso-estimulos.js): asoma
   por la esquina con una burbuja y se va sola. Aparece POCO a
   propósito — solo en el combo gordo (×3), al romper una racha de ≥3
   («¡Vaya, llevabas N!») y con el oro («¡Pleno!»). Respeta
   prefers-reduced-motion no saliendo.

Lección de prueba que costó una tarde: el bloque entra con su animación
de deslizamiento, y medir el boundingBox de la imagen ANTES de que
termine da coordenadas a mitad de viaje (encima variables entre
corridas). Los tests de clics por coordenadas miden la caja justo antes
de CADA clic y esperan a que dos medidas seguidas coincidan
(estabiliza() en test-cursos-c.mjs).

Probado con test-cursos-c.mjs (21 comprobaciones: tolerancia real con
«NÉGRO», el camino del fallo con su solución, las diferencias jugadas
enteras con un fallo dentro del margen, la mascota en sus tres
momentos y el editor con las etiquetas exactas) y rigor-cursos-c.py:
9 roturas, todas detectadas.

## La portada en panel (agosto 2026)

La portada era una torre de secciones a ancho completo (destacada →
reto → top del mes → foro vivo → atajos) y cada tanda la alargaba un
poco más. Ahora, en escritorio (≥960px), es un panel de dos columnas:

- **Columna principal** (ancha): guía destacada, el reto del día y
  «Ahora en el foro».
- **Barra lateral** (320px, sticky bajo la navbar): top del mes y los
  atajos de foro/escribir guía. Es también la casa natural de lo que
  venga (liga semanal, carta de la semana) sin alargar la página.

En móvil las dos columnas se apilan y el orden queda prácticamente el
de siempre. Decisiones que conviene recordar:

- La estructura vive en `index.html` (`.panel-portada` >
  `.portada-principal` + `aside.portada-lateral`). Las secciones
  conservan sus ids y `js/home.js` no cambió: siguen apareciendo con
  `style.display = ''`.
- El aire entre bloques lo pone el `gap` de las columnas (flex), no un
  margen por sección: así las secciones con `display:none` no dejan
  hueco fantasma. La regla vieja de `margin-top` por id se retiró
  (queda solo para `#bienvenidaSeccion`, que va fuera del panel), y el
  `margin-top: 20px` propio de `#atajosSeccion` también.
- `grid-template-columns: minmax(0, 1fr) 320px` — el `minmax(0, …)` es
  obligatorio: con `1fr` a secas un contenido ancho no encogible
  empujaría la rejilla.
- La lateral es `position: sticky; top: 78px` (la navbar es sticky y
  hay que dejarle sitio).

### Cómo se probó

test-portada-panel.mjs (21 comprobaciones: geometría real de las dos
columnas con getBoundingClientRect, gap computado — la distancia a
secas no vale porque el margin-bottom de `.reto-tarjetas` deja 8px
residuales —, sticky, apilado en móvil sin desbordar, y el visitante).
rigor-portada-panel.py: 5 roturas (sin columnas, sin gap, sin sticky,
rejilla también en móvil, top del mes fugado de la lateral), todas
detectadas. Lección de banco de pruebas: la primera mutación del gap
«no se detectaba» porque el patrón `flex-direction: column; gap: 14px`
aparece 4 veces en components.css y el replace rompía otra regla —
las mutaciones de CSS deben llevar el selector en el patrón.

### Retoque tras verla en producción (panel)

Dos cosas cantaban en la web real:

- **El aire de arriba con sesión.** `.page-content` trae 76px de
  padding pensados para el hero de marketing; con la bienvenida como
  primer bloque quedaba un hueco enorme (sobre todo en móvil). Ahora
  `js/home.js` añade `body.portada-compacta` al enseñar la bienvenida
  y el padding baja a 18px. El visitante conserva sus 76px.
- **El agujero antes de «Explora por tema».** La lateral suele ser más
  alta que la principal y el panel dejaba un vacío bajo el foro vivo.
  La rejilla ya no lleva `align-items: start` (solo la lateral lleva
  `align-self: start`, imprescindible para que el sticky tenga
  recorrido) y la última sección de la principal lleva `flex: 1` con
  su tarjeta a `height: 100%`: las dos columnas terminan a la misma
  altura.

test-portada-panel sube a 28 comprobaciones (aire compacto del
miembro, aire intacto del visitante, columnas alineadas por abajo) y
el rigor a 8 roturas, todas detectadas.

### Segundo retoque: equilibrio por contenido, no por estirar

Estirar la última tarjeta de la principal (el primer intento) dejaba
el foro vivo hinchado y medio vacío cuando la lateral era más alta.
Fuera ese flex: el equilibrio ahora lo pone el reparto — los atajos
se mudan a la columna principal (en fila de dos, debajo del foro) y
la lateral queda con el top del mes. La principal pasa a ser casi
siempre la columna alta, y una lateral que termina antes es lo normal
en una barra lateral. Además, en móvil faltaba aire entre las dos
columnas apiladas (los gaps vivían DENTRO de cada columna): el
`.panel-portada` es ahora flex-column con gap 14 en base, y rejilla
solo a partir de 960px. test-portada-panel: 30 comprobaciones; rigor:
8 roturas, todas detectadas.

## El medallero, los oros del foro y el chequeo de cursos (agosto 2026)

Tres piezas que conectan el juego con el resto del sitio, sin tocar la
base (las partidas de `course_attempts` ya son públicas salvo actividad
oculta, y la medalla la pone el disparador de la base):

- **`js/medallero.js`** — `medallasPorCurso(userId)` (la mejor medalla
  por curso, reduciendo en cliente con `mejorMedalla`),
  `orosPorUsuario(userIds)` (cursos DISTINTOS en oro por persona, un
  solo viaje para toda la página) y `chipMedallaHtml`.
- **La medalla en su tarjeta**: `renderGuideCardHtml` deja un hueco
  `[data-card-medalla]` y `decorateGuideCards` lo rellena con la del
  que mira. Solo tarjetas con curso y solo si hay medalla: el hueco
  vacío ya invita a jugar. Sin sesión no hay álbum.
- **La tira de /aprender** (`#medallero`): oros/platas/bronces y
  cuántos cursos quedan por jugar. La pinta js/aprender.js aparte de la
  carga de categorías (si falla, la página sigue).
- **Los oros en el foro**: en la columna del autor, tras «Gracias:».
  Aquí el 0 NO se dice (a diferencia de mensajes y gracias): la medalla
  es un logro y «Oros: 0» en todo el mundo solo mete ruido.
- **El chequeo de cursos** (/admin → Guías → «Revisar cursos»):
  `js/curso-lint.js` repasa los bloques de todos los cursos publicados
  — índices fuera de rango, respuestas del hueco que no están entre las
  opciones, cartas correctas/intrusas fuera de la lista, montones
  inexistentes, memoria fuera de 3–6, slugs de «siguiente curso» que no
  existen, cursos sin Recompensa final — y pinta el informe con enlace
  directo a editar cada guía. Nació justo después de meter a mano los
  13 cursos: un despiste de esos no da error ruidoso en la web, la
  pregunta simplemente se comporta raro.

Banco de pruebas: el stub gana `window.__FAKE_PARTIDAS__` para sembrar
course_attempts. Ojo con las URLs en las pruebas: `serve` redirige
`categoria.html?slug=x` a `/categoria` PERDIENDO la query — hay que
navegar sin extensión, como la web real.

Probado con test-tanda-193 (26 comprobaciones) y rigor-193 (8 roturas).

## La liga de la semana (agosto 2026)

La clasificación del reto diario de lunes a domingo, en la lateral de
la portada, encima del top del mes (se mueve más rápido: cada reto
jugado la cambia). Decisiones:

- **Sin tabla propia.** `js/liga.js` agrega `daily_challenge_results`
  (pública salvo actividad oculta) en el navegador: a escala de esta
  comunidad son unas pocas filas por día. Si algún día pesa, se cambia
  por una RPC — la interfaz de `clasificacionSemanal()` no cambiaría.
- **El lunes se calcula en UTC**, porque el `day` del reto se guarda en
  UTC (js/reto-diario.js). Con el huso local, a medianoche se
  mezclarían las semanas.
- Desempate por días jugados: a igualdad de puntos gana la constancia.
- La tarjeta enseña el top 5 (con el podio del top del mes: mismas
  clases CSS) + «Tú vas N.º» si estás fuera + «ver todos» desplegable.
  Quien no ha puntuado esta semana recibe la invitación al reto. El
  visitante la ve entera (es la prueba de que aquí se juega), sin fila
  propia. Sin resultados esta semana, la sección no sale.
- El stub gana `window.__FAKE_RETO_SEMANA__` con días como
  desplazamientos desde hoy (dia: 0 = hoy), para que las semillas no
  caduquen. La prueba calcula la expectativa con getUTCDay, igual que
  la web: los lunes, la semilla de «ayer» queda fuera y eso ejercita el
  corte de semana de verdad.

Probado con test-liga.mjs (20 comprobaciones) y rigor-liga.py (6
roturas). Pendiente anotado: divisiones (bronce/plata/oro) cuando haya
volumen de jugadores, y enseñar el salto de puestos al terminar el
reto.

### El podio pierde los emojis (consecuencia de la liga)

Al aparecer la liga en la portada por defecto, test-iconos-contenido
por fin «vio» los 🥇🥈🥉 del top del mes (antes esa sección solo salía
con semillas y el vigilante nunca la pillaba). La norma de la casa es
iconos SVG, así que el podio de las dos tarjetas pasa a `icons.medal`
tintado (`.podio-1/2/3`, con su variante oscura). test-tanda-187
comprueba ahora el icono y acota sus selectores a `#topMes`, porque
`.top-mes-fila` ya no es único en la página (la liga reutiliza esas
clases a propósito).

## El protector de racha (agosto 2026)

Un comodín que salva la racha cuando se pierde UN día. Perder una
racha de 20 días por un despiste duele tanto que la gente abandona —
Duolingo lo tiene por eso mismo.

- **`supabase-migration-protector.sql`** (ejecutar en el SQL Editor):
  columna `streak_shields` en user_profiles, junto a current_streak.
  Registrada en js/schema-check.js.
- **Las reglas** (checkDailyStreak, js/gamification.js): se gana un
  protector cada 7 días de racha, con tope de 2; si la última visita
  fue anteayer y hay escudo, se gasta solo y la racha sigue (+1); dos
  o más días perdidos ya no los salva nadie y los escudos se quedan
  guardados. Todo en UTC, como la racha de siempre.
- **Repliegue pre-migración**: si el select de streak_shields falla
  (columna aún sin crear), se reintenta con las columnas de siempre y
  la racha funciona como antes, sin escudos. Sin esto, el despliegue
  rompería la racha hasta ejecutar la migración.
- **El aviso**: al gastarse, checkDailyStreak deja
  `pokedoc-racha-protegida` en sessionStorage; la bienvenida lo enseña
  UNA vez («Tu protector salvó la racha») y limpia la marca. Los
  escudos guardados se ven como chip junto a la llama, con consulta
  aparte y silenciosa para no tumbar la bienvenida pre-migración.

Probado con test-protector.mjs (18 comprobaciones: seis escenarios de
fechas parcheando el perfil del stub) y rigor-protector.py (6
roturas). Lección: en el stub no vale «recargar» para probar que el
aviso sale una vez — el estado en memoria se resetea y vuelve a gastar
el escudo; se comprueba la marca de sessionStorage, que es lo que de
verdad implementa el «una vez».

## Las preguntas más falladas (agosto 2026)

La herramienta de autor que faltaba con los 13 cursos recién metidos a
mano: /admin → Guías → «Preguntas más falladas» cruza `question_stats`
(el contador público de aciertos) con los bloques de los cursos
publicados, casando por la MISMA clave que usa el juego
(`claveDePregunta` de js/curso-juego.js — si la prueba o el panel
calcularan el hash por su cuenta, se desincronizarían). Peor % de
acierto primero, mínimo 3 respuestas para no enseñar ruido, el % por
debajo de 40 en rojo, y las estadísticas huérfanas (de preguntas ya
reescritas: al cambiar el enunciado cambia la clave) contadas aparte.
Cada fila enlaza a editar su guía.

Probado con test-falladas.mjs (10 comprobaciones; la semilla calcula
las claves DESDE la página con el módulo real del juego) y
rigor-falladas.py (5 roturas).

## El calendario de lanzamientos (agosto 2026)

Página nueva /lanzamientos.html: el siguiente set en grande con su
cuenta atrás («¡Sale hoy!», «Sale mañana», «Faltan N días»), el resto
de futuros en lista, y los recién salidos (últimos 6) apagados debajo.
Enlazada desde el pie y desde su miniatura en la lateral de la portada
(el set más cercano con los días, pintado por js/home.js con la cuenta
EN LÍNEA — importar js/lanzamientos.js metería el módulo en el grafo
de la portada y el presupuesto de peso anda justo).

- **Los datos**: site_settings, clave `lanzamientos`, valor
  { sets: [{ nombre, fecha AAAA-MM-DD, imagen?, notas? }] }. Sin
  migración nueva (la tabla es la de supabase-migration-ajustes.sql:
  lectura pública, escritura de admin). Fechas comparadas como texto
  contra hoy en UTC — el formato ordena solo.
- **El editor** (/admin → Dashboard → Lanzamientos): texto plano, una
  línea por set con campos separados por `|`. Para 5-10 sets al año,
  una tabla editable sería más aparato que ayuda. Una línea con mala
  fecha FRENA el guardado entero con su aviso: guardar «lo que se
  pueda» en silencio es como se pierden sets.
- El stub gana `window.__FAKE_LANZAMIENTOS__` con fechas como
  desplazamientos desde hoy, y icons.js gana el icono `calendar`.

Probado con test-lanzamientos.mjs (20 comprobaciones: página, vacío
digno, miniatura de portada y editor con su línea rota) y
rigor-lanzamientos.py (5 roturas).

### Aviso de presupuesto

Tras la tanda del calendario, la portada queda EXACTAMENTE en el techo
de peso (170/170 KB comprimidos). Lo siguiente que quiera entrar en la
home tiene que aligerar algo antes, o subir el techo con justificación
(precedentes: 150→160 en la tanda 183 y 160→170 en la 188).

## Importar lanzamientos desde TCGdex (agosto 2026)

El botón «Importar de TCGdex» del panel de Lanzamientos del /admin
rellena la caja solo, con los últimos sets, sus fechas de salida y sus
logos — en español. La fuente es el MISMO catálogo que ya usan las
cartas (js/tcgdex.js): sin clave, con CORS, llamado desde el navegador.

La historia de la fuente importa: el primer intento leía Bulbapedia a
través de una función de Netlify (su lista de expansiones anuncia sets
más lejanos), pero el muro anti-bots de su CDN respondió 403 a los
servidores de Netlify — a la página Y a su API de MediaWiki — y no hay
proxy que valga contra eso. WikiDex, igual. TCGdex es la fuente pensada
para leerse por programa; su pega es que los sets muy lejanos aún no
están (los añade según se acercan), que para una cuenta atrás es pega
pequeña.

- **Cómo lee** (admin.js): la lista breve de sets no trae fechas, así
  que pide los ÚLTIMOS 15 en detalle vía `fetchSetEnIdioma(id, 'es')`
  (export nuevo de tcgdex.js: un set en un IDIOMA, no en un mercado —
  para el calendario el nombre en español vale más que el catálogo
  completo en inglés), con caída a inglés si un set aún no está
  traducido. Filtra a releaseDate ≥ hoy−90 días, ordena por fecha y
  monta las líneas. El logo de TCGdex llega sin extensión: se le añade
  `.webp`. Pocket (serie tcgp) nunca entra — fetchSets ya lo excluye.
- **Solo rellena**: nada llega a la base hasta que el admin revisa y
  pulsa Guardar; las notas escritas a mano sobreviven casando por
  nombre (minúsculas). Si TCGdex falla, toast y la caja NI SE TOCA.
- Los logos de /lanzamientos llevan `referrerpolicy="no-referrer"`.
- En local no hay red hacia TCGdex (política del contenedor): el test
  intercepta `https://api.tcgdex.net/**` con Playwright.

Probado con test-importar-sets.mjs (15 comprobaciones: relleno, orden,
ventana, caída a inglés, exclusión de Pocket, notas, guardado y fallo)
y rigor-importar-sets.py (6 roturas, todas detectadas).

## El editor de lanzamientos, por filas (agosto 2026)

La caja de texto «fecha | nombre | …» del panel de Lanzamientos se
sustituye por FILAS — lo pidió el admin para meter la era actual a mano
sin pelearse con las barras. Cada fila: fecha (input date), nombre,
logo (URL pegada o botón de subir) y notas (opcional), con su botón de
quitar; «Añadir set» abre una fila nueva y siempre queda al menos una
vacía donde empezar.

- **La subida del logo** reutiliza `uploadGuideImage` (bucket
  guide-images, el de las imágenes de guías): ya existe, ya tiene la
  política de subida para sesiones y no hace falta ni migración ni
  bucket nuevo. La URL pública cae en el campo de la fila.
- **La validación**: una fila con algo escrito pero sin fecha o sin
  nombre FRENA el guardado entero con su aviso, como antes frenaba la
  línea rota. Las filas del todo vacías simplemente se ignoran. Al
  guardar, los sets se ordenan por fecha (las páginas ordenan igual,
  pero así el admin los ve ordenados al recargar).
- **Importar de TCGdex** ahora rellena las filas (mismas garantías:
  solo rellena, notas conservadas por nombre, y si falla no toca nada).
- Datos y páginas, sin cambios: el mismo { sets } en site_settings.
- Criterio de alcance hablado con el admin: la era actual + lo que
  venga; la página solo enseña los últimos 6 ya salidos, así que
  rellenar eras viejas no aportaría nada visible.

Probado con test-lanzamientos.mjs (sección 3 reescrita para filas:
fila vacía de partida, fila a medias frena, guardado, quitar, y la
subida de imagen de verdad vía filechooser contra el storage del stub)
y test-importar-sets.mjs (adaptado a filas); rigor-lanzamientos.py y
rigor-importar-sets.py al día (11 roturas, todas detectadas).

### Retoque: la miniatura de la portada enseña el logo

Pedido del admin: la tarjeta de la lateral era solo texto. Ahora, si el
set tiene `imagen`, el logo HACE de título y el icono del calendario
se retira — con logo sobra (máx. 44px de alto, PNG transparente que funciona sobre claro y oscuro) y el nombre se queda en
el `alt` — con un `onerror` que, si la imagen no carga, vuelve a poner
el nombre (`replaceWith` con string inserta un nodo de TEXTO, nunca
HTML). Sin imagen, todo sigue como estaba. El retoque rozó el techo de
peso: el CSS del editor de filas se movió a admin/css/admin.css (la
portada baja components.css) y la tarjeta perdió un `loading="lazy"`
que ahí era contraproducente — quedó 170 justo, sin subir el techo. La cuenta de días no se
mueve. Cubierto en test-lanzamientos.mjs (logo visible, alt, nombre no
duplicado, y el repuesto con URL rota).

## /lanzamientos, en formato agenda (agosto 2026)

Feedback del admin con una captura de otra web suya de eventos: la
página quedaba «pocha». Rediseñada como agenda, ADAPTANDO ese diseño a
los colores de la casa (no copiándolos): línea de tiempo vertical con
puntos (azul marino los futuros, apagado los pasados), cada set con su
BLOQUE DE FECHA a la izquierda (día en grande, mes corto, año) pegado a
la tarjeta, la pastilla de cuenta atrás a la derecha («Ya salió» en
gris para los pasados), títulos de sección en mayúsculas espaciadas y
el destacado con una banda de tinte degradado.

- **css/lanzamientos.css (hoja nueva, solo de esta página)**: los
  estilos de la página se MUDARON ahí desde components.css, que también
  la baja la portada — el rediseño cabía imposible en el presupuesto de
  peso y además ahí nunca pintaron nada. En components.css solo queda
  la miniatura (.lanzamiento-portada-*).
- **La miniatura de la home**: el logo pasa de encima del texto a la
  IZQUIERDA (donde iba el icono), con el texto al lado — feedback del
  admin («el logo deberia estar en un lado y el texto en otro»). Máx.
  42px de alto y 108px de ancho.
- js/lanzamientos.js: tarjetaHtml pasa a eventoHtml (bloque de fecha +
  tarjeta + pastilla). Clases lanzamiento-tarjeta/-pasado se conservan.

Cubierto en test-lanzamientos.mjs (los textos y el orden no cambian; se
añade la comprobación de que el logo queda a la izquierda del texto por
geometría real).

## Tanda 201: el salto de liga y los pushes que traen de vuelta (agosto 2026)

Tres piezas alrededor de jugar cada día, elegidas por el admin («dale
3 4 1»):

- **El salto de puestos al acabar el reto** (pantalla final del reto
  diario): antes de guardar la partida se toma la foto de la liga
  semanal, se guarda, se vuelve a calcular y se cuenta la diferencia —
  «¡Subes del 8.º al 5.º!», «Entras: vas 3.º» o «Sigues 4.º». La frase
  la fabrica `textoSaltoLiga(antes, despues)` (js/liga-salto.js, pura,
  junto a `puestoDe` — módulo APARTE de liga.js a propósito: liga.js lo
  baja la portada, que anda al límite del presupuesto, y esto solo lo
  usa curso.js); bajar sumando puntos no puede pasar, y si pasara por
  datos raros se calla. Todo el adorno es silencioso ante errores: no
  puede romper el cierre del reto. Estilo `.reward-liga` en curso.css
  (dorado, como lo que se celebra).
- **El push de la racha en peligro** (netlify/functions/racha-push.mjs,
  18:00 UTC): a quien tiene current_streak > 0 y last_active_date ==
  AYER (jugó ayer, hoy aún no) y suscripción push. Quien jugó hoy está
  a salvo y quien no jugó ayer ya la perdió: a esos no se les molesta.
  Días en UTC como toda la racha.
- **El push de «sale hoy»** (netlify/functions/lanzamiento-push.mjs,
  7:15 UTC): si un set del calendario tiene fecha == hoy, aviso a todas
  las suscripciones con el nombre (y las notas) y enlace a
  /lanzamientos. Cada set se avisa UNA vez: los avisados quedan en
  site_settings `lanzamientos_avisados` (últimos 20), así una doble
  ejecución no duplica.

Las dos funciones siguen el patrón inyectable de enviar-push.mjs
(mismas variables de entorno, misma limpieza de suscripciones 404/410,
mismo «sin claves no hago nada y lo digo») — YA CONFIGURADAS en
Netlify, no hay que tocar nada.

Probado con test-tanda-201.mjs (23 comprobaciones: las dos funciones
sin red con dobles, y el salto jugando el reto entero con dos rivales
insalvables sembrados) y rigor-tanda-201.py (7 roturas, todas
detectadas).

## Tanda 202: la gran limpieza (agosto 2026)

Repaso a fondo pedido por el admin: fuera lo que no se usa, más visual
lo que queda, y dos mejoras del foro que entraron en la misma tanda.

- **El /admin pierde peso muerto**: las secciones de Rutas (nada las
  usaba fuera del panel — las rutas públicas se retiraron hace meses),
  Colecciones (la gestión; la página de categoría las seguiría
  pintando si algún día vuelven a tener filas — solo se quita el
  panel) y el navegador de Imágenes (cada sitio que necesita imágenes
  ya tiene su propia subida). También el botón «Importar de TCGdex» de
  Lanzamientos: el admin los mete a mano y punto. Sus bloques de
  admin.js, admin/index.html y CSS van fuera, y `fetchSetEnIdioma`
  (tcgdex.js) con ellos.
- **El /admin, más visual**: el nav pasa de 17 botones planos a tres
  grupos rotulados (Contenido / Comunidad / Sistema), y las secciones
  con cola ganan un contador rojo en el propio nav
  (`ponerContadorNav`): Pendientes, Reportes, Feedback, Errores y
  Bajas dicen cuánto espera sin tener que entrar.
- **Código muerto de la web**: `medallaMejor` + `ORDEN_MEDALLA`
  (curso-juego.js, sin ningún uso) y 22 bloques de CSS huérfanos
  (perfil viejo pre-rediseño, follow-summary, learning paths,
  foro-megustas pre-reacciones…) detectados cruzando cada clase del
  CSS contra todo el html+js y verificando a mano los construidos
  dinámicamente (`toast-${'{'}tipo{'}'}`, `podio-${'{'}n{'}'}`…). La
  portada baja a 169 KB comprimidos: vuelve a haber margen bajo el
  techo de 170.
- **Foro**: «Ahora en el foro» (portada) enseña la etiqueta de color
  de cada hilo (etiquetaHtml ya estaba en el grafo de la portada:
  coste ~nada), y abrir un tema EXIGE etiqueta, igual que el título
  (el selector dice «Elige etiqueta…» y el submit frena con aviso).
  Los temas viejos sin etiqueta se quedan como están: el admin los
  editará a mano si quiere.

Probado con test-tanda-202.mjs (19 comprobaciones) y
rigor-tanda-202.py (5 roturas, todas detectadas); test-importar-sets y
su rigor se retiran con el botón que probaban.

## Tanda 203 — Torneos 1: arranca el porte de TrainerArena (agosto 2026)

PokeDoc se convierte en proyecto A DOS MANOS: Ibai Manso (autor de
TrainerArena) entra como colaborador y su plataforma de torneos se
porta a nuestro stack. Cada uno trabaja desde su propia sesión de
Claude; la coordinación vive en CLAUDE.md (normas, se carga sola en
cualquier sesión del repo) y BITACORA.md (registro de cambios, entrada
nueva ARRIBA antes de cada push — leerla es lo primero al empezar).

- **El motor** (js/torneos/motor.js): traducción 1:1 a JS plano de
  `libs/engine` de TrainerArena — azar sembrado xmur3/mulberry32,
  tabla oficial de estructura, SHA-256 puro para la moneda de
  desempate, puntuación 3/1/0 con byes y forfeits, OWP/OOWP, pareo de
  ronda 1 por sorteo reproducible, Monrad con float-down y backtracking
  8! (ManualPairingRequired con parciales cuando no sale), top cut con
  siembra 1v(S+1−i) y avance «fold», y parser+validador de decklists de
  TCG Live. Nombres de funciones en inglés A PROPÓSITO para cotejar con
  el original. Adaptación única: los ids de jugador son uuid (texto) en
  vez de enteros — comparadores genéricos donde su código restaba.
- **La migración** (supabase-migration-torneos.sql, SIN EJECUTAR aún):
  12 tablas del esquema de TrainerArena adaptadas — usuarios por uuid
  de user_profiles, enums como checks de texto, FUERA todo lo de pagos
  (decisión de los admins) y fuera email/teléfono de la inscripción (la
  cuenta ya identifica). RLS: TODO solo-admins mientras dure la prueba;
  abrir al público será otra migración.
- **La pestaña «Jugar»**: enlace en las 14 navbars con clase
  `.nav-jugar hidden`; app.js lo desvela solo si el perfil es admin.
  /torneos (noindex) rebota a la portada a quien no sea admin, y para
  el admin lista torneos y crea nuevos: el formulario rellena solo
  rondas suizas y top cut con la tabla oficial al cambiar las plazas,
  y cada torneo nace en borrador con su pairing_seed de 32 caracteres.
  CSS en css/torneos.css (hoja propia: presupuesto de portada).
- Decisiones del porte ya fijadas (ver CLAUDE.md): sin pagos, chat de
  partida en desplegable, cuenta única de PokeDoc, sondeo en vez de
  WebSockets, cierres automáticos con función programada por minuto.
- El stub de pruebas gana la tabla `tournaments` (vacía, escribible).

Plan de tandas del porte: 204 inscripciones+decklists · 205 ciclo de
ronda (pareos, check-in, auto-reporte con confirmación, clasificación)
· 206 top cut+timers+push · 207 jueces y disputas · 208 gamificación.

Probado con test-torneos-1.mjs (30 comprobaciones: 21 del motor contra
casos de las specs de TrainerArena + 9 de la puerta de admins y el
crear/listar) y rigor-torneos-1.py (6 roturas, todas detectadas).

## Tanda 204 — Torneos 2: inscripciones, bajas y decklists (agosto 2026)

La ficha del torneo: torneo.html + js/torneos/torneo.js leen
`/torneo?slug=…` (los enlaces de la lista ya apuntaban ahí) y montan el
ciclo completo de inscripción del porte, sin pagos: todo es gratis y la
plaza queda activa al momento.

- **Estados desde la ficha**: el admin abre (`draft →
  registration_open`) y cierra (`→ registration_closed`) las
  inscripciones con un botón en la propia ficha; la barra de plazas
  cuenta solo inscripciones `active` sobre `max_players`.
- **Inscribirse** pide únicamente el usuario de Pokémon TCG Live (la
  cuenta de PokeDoc ya identifica; sin full_name/email/teléfono).
  Comprobaciones del original: solo con inscripciones abiertas, cupo
  lleno ⇒ «Torneo lleno.», y una fila previa — aunque esté `dropped` —
  bloquea la reinscripción (el UNIQUE de la tabla es el candado real;
  el recuento fresco antes del insert es el amortiguador de la carrera,
  que sin lock de fila no se puede cerrar del todo desde el navegador).
- **La baja** (SPEC §6.9) confirma en el propio botón (dos toques):
  `status=dropped`, `dropped_at` y `dropped_after_round_id =
  current_round_id` — juega su ronda en curso y el pareo siguiente lo
  excluye. La plaza NO se libera y en la lista sale «(retirado)».
- **La decklist** usa el parser/validador ya portados y la política
  `canEditDecklist` traducida 1:1 de libs/shared a motor.js: edita el
  dueño con inscripción activa mientras las inscripciones estén
  abiertas o cerradas y la lista no esté sellada; la PRIMERA entrega
  con el torneo en juego se admite y se sella al guardarse (las demás
  se sellarán al arrancar la R1, tanda 205). Inválida (≠60 cartas, sin
  Pokémon) ⇒ errores en pantalla y no se guarda. Sellada ⇒ textarea en
  solo lectura con su distintivo.
- **Los inscritos**: nombre (enlazado al perfil), usuario de TCG Live y
  — solo para el admin — si la decklist está entregada; el texto de las
  listas ajenas no se pide nunca desde esta página (SPEC §9).
- js/torneos/comun.js (nuevo) comparte ESTADOS/fechas entre /torneos y
  /torneo. El stub gana `tournament_registrations` y
  `tournament_decklists` más los ganchos `__FAKE_TORNEOS__`,
  `__FAKE_INSCRIPCIONES__` y `__FAKE_DECKLISTS__` (cada navegación
  resetea el módulo: la ficha necesita llegar con el torneo sembrado).

Probado con test-torneos-2.mjs (38 comprobaciones: 8 de la política en
nodo + 30 de la ficha en navegador, incluido el ciclo entero en una
sola página) y rigor-torneos-2.py (7 roturas, todas detectadas).

## Tanda 205 — Torneos 3: el ciclo de ronda (agosto 2026)

js/torneos/ronda.js (nuevo, montado por torneo.js) porta el §6 del SPEC
de TrainerArena a la ficha del torneo. Sin colas ni WebSockets, como
manda CLAUDE.md: los relojes automáticos llegan con la función
programada (tanda 206) y el refresco es por sondeo (10 s con ronda viva
+ botón Actualizar).

- **Generar pareos** (admin): la ronda nace `pending`; R1 por sorteo
  sembrado y las demás por Monrad con el histórico de cruces
  (pairing_history, clave menor:mayor). El bye nace terminal con su
  resultado apuntado. Si el motor lanza ManualPairingRequired se
  aplican los parciales y sale el **pareo manual**: el admin sienta
  parejas (mesa siguiente + histórico; un recruce a sabiendas se admite
  y el UNIQUE del histórico lo ignora) o da byes. Iniciar con gente sin
  mesa se bloquea.
- **Iniciar ronda**: `active`, `started_at`, `ends_at = ahora +
  round_time_minutes` (null en top cut), mesas `pending → active`,
  `tournaments.current_round_id`, y el torneo pasa a `in_progress`. La
  R1 **sella todas las decklists** sin sellar (SPEC §6.3).
- **Check-in**: botón «Estoy listo» → `check_in_a/b_at` idempotente; el
  ✓ se ve en tu partida y en las mesas. Los forfeits por ventana
  expirada llegan con el barredor de la tanda 206.
- **Reportes** (SPEC §6.5): «He ganado / He perdido / Empate» (el
  empate se oculta en BO1); el primer reporte deja la mesa
  `awaiting_confirmation`; el reporte repetido igual es no-op y el
  distinto avisa; el segundo se concilia con `reconcileReports`
  (portada a motor.js): win+loss ⇒ a/b_wins, draw+draw ⇒ empate, y
  cualquier otra pareja ⇒ `disputed`. Sin servidor, la conciliación la
  hace el cliente del segundo reporte — y si el rival reportó desde su
  sesión, el primer cliente que refresca concilia las mesas
  `awaiting_confirmation` con dos reportes (el UNIQUE de match_results
  corta el doble).
- **Resolución del organizador** (SPEC §6.7): un select por mesa viva —
  gana A/B, empate, incomparecencias — con `resolutionWinnerSide`
  (motor.js) para el ganador y `resolved_by = admin`. Es también la
  salida de las disputas hasta que lleguen los jueces (tanda 207).
- **Cerrar ronda** (SPEC §6.8): solo con todas las mesas terminales.
  Última suiza sin corte ⇒ torneo `finished`; con corte configurado, la
  siembra queda para la tanda 206.
- **Clasificación**: computeStandings del motor — puntos, V-D-E (+
  byes), OWP y OOWP al 2 %, «(retirado)» marcado — en cuanto hay una
  partida terminal.
- El stub gana `rounds`, `tournament_matches`, `match_reports`,
  `match_results` y `pairing_history` (escribibles, sin semillas: el
  ciclo entero corre en una sola página).

Probado con test-torneos-3.mjs (41 comprobaciones: 8 de conciliación en
nodo + un torneo de 4 llevado por el organizador de punta a punta con
mesas deterministas por la semilla, el flujo del jugador con check-in y
confirmación del rival, la disputa con resolución firmada, y el atasco
con pareo manual) y rigor-torneos-3.py (9 roturas, todas detectadas).

## Tanda 206 — Torneos 4: top cut, barredor y push de ronda (agosto 2026)

- **Siembra automática** (SPEC §6.8 + §7): al cerrar la última suiza
  con corte configurado, ronda.js calcula el ranking final sin
  retirados, recorta a la mayor potencia de 2 que quepa (seedTopCut) y
  crea la ronda `top_cut` con cruces 1º-4º / 2º-3º (bracket_position =
  mesa). Con menos de 2 vivos, el torneo termina con las suizas.
- **Avance del bracket**: cerrar una ronda del cut pasa las mesas
  cerradas por advanceTopCut — cruce «fold» de ganadores, byes cuando
  falta gente — y crea la siguiente; al quedar K=1 el torneo pasa a
  `finished` y la clasificación luce el banner del campeón (deducido
  del bracket, no se guarda). En el cut **no hay empates**: el
  resolutor no lo ofrece y cerrar con un empate se bloquea; el botón de
  empate del jugador solo existe en suizas BO3. Iniciar una ronda del
  cut no exige mesa para todos (los eliminados no la tienen a posta) y
  el cut no escribe en pairing_history.
- **El barredor** (netlify/functions/torneos-barredor.mjs, cron
  `* * * * *`): el relevo de los jobs de BullMQ del original.
  Por cada ronda activa: (1) push «tu ronda ha empezado» a los
  jugadores con mesa, UNA vez — lo apunta en
  `rounds.players_notified_at`, columna añadida a la migración (aún sin
  ejecutar, por eso se puede editar); (2) pasada la ventana de
  `checkin_minutes`, las mesas activas con check-ins a medias caen en
  forfeit_b / forfeit_a / forfeit_both con su resultado (SPEC §6.4,
  motivo en `score`); (3) pasado `ends_at` (solo suizas), las mesas
  activas SIN reportes caen en forfeit_both (SPEC §6.6) — con reporte o
  esperando confirmación se respetan. `procesar({env, rest, enviar,
  ahora})` inyectable, mismo patrón que racha-push; suscripciones
  404/410 se borran.

Probado con test-torneos-4.mjs (30 comprobaciones: el barredor entero
contra un mundo en memoria con dos pasadas — forfeits de las tres
variantes, tiempo que respeta reportes, aviso único con limpieza de
suscripciones muertas — y el cut en navegador: siembra según ranking,
sin empate en el resolutor, final por «fold» y banner del campeón) y
rigor-torneos-4.py (7 roturas, todas detectadas).

## Tanda 207 — Torneos 5: jueces, llamadas y chats en desplegable (agosto 2026)

js/torneos/jueces.js (nuevo, montado por torneo.js tras el ciclo) porta
el §10 del SPEC. Todos los chats van EN DESPLEGABLE (`<details>`), no en
el recuadro principal: decisión de los admins fijada en CLAUDE.md.

- **Solicitudes de juez**: quien no organiza puede pedir serlo (una
  vez; con solicitud, el botón desaparece y se ve el estado). El
  organizador aprueba o rechaza con sello (`decided_at`/`decided_by`) y
  la ficha lista los jueces aprobados. Un juez aprobado ve la cola y
  puede resolver mesas igual que el organizador (ctx.esJuez llega desde
  torneo.js al resolutor de ronda.js).
- **Chat de la mesa** (match_messages): desplegable dentro de «Tu
  partida», plegado por defecto; se carga al abrirse y tras cada envío
  (Enter también envía). Sin mesa o con bye, no hay chat.
- **Llamar al juez** (judge_calls): idempotente por jugador y mesa (una
  llamada viva se reutiliza); el jugador queda «Esperando juez…» con la
  conversación (judge_messages) en desplegable.
- **La cola del juez**: llamadas con su estado (Atender bajo candado —
  el update filtra por `status=open`, si otro juez ganó la carrera se
  avisa —, Resolver deja el chat en solo lectura como registro) y las
  mesas en disputa señaladas hasta que alguien las resuelve. Reportar o
  resolver refresca la ficha ENTERA para que la disputa asome/desasome
  de la cola al momento; el botón Actualizar ahora también refresca
  todo.
- El stub gana judge_applications (+semilla `__FAKE_JUECES__`),
  judge_calls, judge_messages y match_messages.

Probado con test-torneos-5.mjs (23 comprobaciones: aprobación con
sello, chat de mesa plegado/firmado/con respuesta del rival, llamada
única con Atender/Resolver y chat cerrado al resolver, disputa que
entra y sale de la cola, y solicitud propia sin doble botón) y
rigor-torneos-5.py (7 roturas, todas detectadas).

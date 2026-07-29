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

**Bloques de referencia** (`reference_blocks`): `heading`, `paragraph`,
`image`, `list`, `highlight`.

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

## `guide_routes`
Tabla puente ruta ↔ guía: `guide_id` (FK) · `route_id` (FK →
learning_paths) · `position` (orden dentro de la ruta). Es la fuente de
verdad para "qué guías tiene esta ruta" — `route_ids` en `guides` es solo
una copia de conveniencia.

## `learning_paths`
`id` · `slug` · `title` · `description` · `emoji` · `guide_ids` (uuid[],
desnormalizado — no se mantiene desde este panel, usa `guide_routes` para
consultas fiables) · `is_featured` (bool, se usa para recomendar una ruta
en el onboarding).

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
`id` · `title` · `body` · `data` (jsonb) · `target` (siempre `'all'` por
ahora) · `status` (`draft`/`sent`) · `scheduled_at` · `sent_at` ·
`sent_count` · `created_at`. El admin puede crear notificaciones y
marcarlas como "enviadas", pero **no hay ningún servicio de push
conectado** (necesitaría un backend con Expo/FCM/APNs u otro proveedor de
web push) — esto solo deja constancia en la base de datos, no llega a los
dispositivos. `user_profiles.push_token` (del proyecto Expo anterior) no
se usa ni se toca desde la web.

## `user_profiles`
`id` (= auth.users.id) · `username` · `display_name` (se usa para mostrar
el nombre en toda la web; `username` queda como respaldo) · `total_xp` ·
`level` · `is_pro` · `achievements` (text[], ids de `achievement_definitions`
desbloqueados) · `saved_guides` (uuid[], ids de guías guardadas — sin tabla
aparte) · `unlocked_references` (uuid[]) · `avatar_color` (color de fondo
del avatar, con fallback a navy) · `is_admin` · `quiz_correct_count` ·
`push_token` (no usado desde la web) · `onboarding_completed` · `interests`
(text[], slugs de categorías elegidas en el onboarding) · `recommended_path`
(text, slug de `learning_paths` recomendado en el onboarding).

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

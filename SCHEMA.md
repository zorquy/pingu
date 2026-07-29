# Esquema de Supabase que espera PokeDoc

Este documento **no modifica tu base de datos** — solo describe las tablas y
columnas que el frontend (`js/*.js`, `admin/js/admin.js`) espera encontrar en
tu proyecto de Supabase. Compáralo con tu esquema real y ajusta lo que no
coincida (o crea las tablas que falten) antes de desplegar.

## `categories`
| columna | tipo | notas |
|---|---|---|
| id | uuid | PK |
| slug | text | único |
| name | text | |
| description | text | |
| emoji | text | usado en `categoria.html` |
| icon | text | clave para el SVG inline (`shield`, `search`, `tag`, `star`, `book`, `trophy`, `box`, `users`, `chart`) |
| order_pos | int | orden de aparición |

## `guides`
| columna | tipo | notas |
|---|---|---|
| id | uuid | PK |
| slug | text | único |
| title | text | |
| description | text | |
| category_id | uuid | FK → categories.id |
| emoji | text | |
| estimated_mins | int | |
| level | text | Básico / Intermedio / Avanzado |
| badge | text | "Gratis" / "Pro" |
| order_pos | int | |
| published_at | timestamptz \| null | null = borrador |
| tags | text[] | |
| search_content | text | usado por la búsqueda |
| blocks | jsonb | array de bloques del curso interactivo (ver abajo) |
| reference_blocks | jsonb | array de bloques del artículo de referencia |

**Tipos de bloque en `blocks`** (curso): `hook`, `concept`, `warning`, `tip`,
`example`, `quiz`, `checklist`, `reward`. Campos por tipo, ver
`admin/js/admin.js` (`COURSE_BLOCK_DEFAULTS`) o `js/curso.js`.

**Tipos de bloque en `reference_blocks`** (guía): `heading`, `paragraph`,
`image`, `list`, `highlight`. Ver `REFERENCE_BLOCK_DEFAULTS` en
`admin/js/admin.js`.

## `learning_paths`
| columna | tipo | notas |
|---|---|---|
| id | uuid | PK |
| slug | text | ideal: `beginner_path`, `anti_scam_path`, `smart_buying_path`, `card_value_path`, `collecting_mastery_path` (el CSS colorea la tarjeta según el slug) |
| name | text | |
| description | text | |
| emoji | text | |
| order_pos | int | |

## `path_guides`
Tabla puente ruta ↔ guía.
| columna | tipo |
|---|---|
| id | uuid |
| path_id | uuid FK → learning_paths.id |
| guide_id | uuid FK → guides.id |
| order_pos | int |

## `user_profiles`
| columna | tipo | notas |
|---|---|---|
| id | uuid | PK, = auth.users.id |
| username | text | |
| total_xp | int | default 0 |
| level | text | "Novato" / "Entrenador" / "Coleccionista" / "Experto" / "Maestro" |
| achievements | jsonb | array de `key`s de logros desbloqueados |
| is_admin | bool | acceso a `/admin` |
| onboarding_completed | bool | |
| experience_level | text | respuesta del onboarding (nuevo/intermedio/experimentado) |
| interests | jsonb | array de category ids elegidos en el onboarding |

## `user_progress`
| columna | tipo | notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid FK → auth.users.id | |
| guide_id | uuid FK → guides.id | |
| status | text | "started" / "completed" |
| current_block_index | int | posición para poder reanudar el curso |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| updated_at | timestamptz | |
| xp_earned | int | |

Necesita una restricción única en `(user_id, guide_id)` porque el código
hace `upsert(..., { onConflict: 'user_id,guide_id' })`.

## `saved_guides`
| columna | tipo |
|---|---|
| id | uuid PK |
| user_id | uuid FK → auth.users.id |
| guide_id | uuid FK → guides.id |
| created_at | timestamptz |

## `achievements`
Los logros son 100% gestionables desde `/admin` — no hay nada hardcodeado en
el JS salvo la comprobación genérica de la condición.
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| key | text | único, ej. `first_course` |
| name | text | |
| description | text | |
| icon | text | emoji |
| xp_reward | int | XP extra al desbloquearse |
| condition_type | text | "completed_count" o "total_xp" |
| condition_value | int | umbral |
| order_pos | int | |

## `notifications`
| columna | tipo |
|---|---|
| id | uuid PK |
| title | text |
| message | text |
| target | text (siempre "all" por ahora) |
| created_at | timestamptz |

## Supabase Storage
Bucket público llamado `images` (usado por `/admin` para subir e insertar
imágenes en guías/cursos).

## RLS (Row Level Security)
No he tocado tu configuración de RLS — solo indico lo que el frontend
necesita para funcionar:
- `categories`, `guides`, `learning_paths`, `path_guides`, `achievements`:
  lectura pública; escritura solo para `is_admin = true`.
- `user_profiles`, `user_progress`, `saved_guides`: lectura/escritura solo
  para `auth.uid() = user_id` (o `= id` en `user_profiles`); considera
  permitir lectura de `user_profiles.username` para mostrar nombres si lo
  necesitas en otras vistas.
- `notifications`: lectura pública, escritura solo `is_admin = true`.

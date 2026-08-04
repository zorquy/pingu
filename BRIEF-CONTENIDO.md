# PokeDoc — contexto para escribir guías

Este documento es para pegarlo entero en un chat nuevo (o en un proyecto de
Claude) y pedirle guías desde ahí. Está pensado para alguien que **no tiene
acceso al repositorio**: aquí está todo lo que necesita saber.

Todos los datos de formato salen de las 13 guías que ya están publicadas,
comprobados sobre el contenido real, no de memoria.

---

## 1. Qué es PokeDoc

Una web en español (de España) sobre coleccionismo de Pokémon TCG:
**pokedoc.es**. Guías prácticas y cursos interactivos para coleccionistas.

- **Público:** gente que colecciona cartas Pokémon. Desde quien acaba de
  empezar y no sabe leer el símbolo de rareza, hasta quien lleva años y
  quiere afinar en gradeo o en detectar resellados. La mayoría entra desde
  el móvil.
- **No vende nada.** No hay tienda, ni enlaces de afiliado, ni
  patrocinadores. Las guías no recomiendan tiendas concretas.
- **No está afiliada** a Nintendo, Game Freak, Creatures Inc. ni The Pokémon
  Company. Las marcas se mencionan solo de forma descriptiva.
- Es un proyecto pequeño, en beta, con unas 20 personas invitadas
  probándolo.

---

## 2. Una guía tiene DOS partes (y las dos importan)

### A) Documentación — el artículo

Un texto de lectura corrida, con subtítulos. Es lo que se lee. Va en la
columna `reference_blocks`.

### B) Curso — la práctica

Entre 6 y 8 bloques interactivos, estilo Duolingo: preguntas, verdadero o
falso, emparejar, ordenar pasos. Va en la columna `blocks`.

**El curso NO es un resumen del artículo.** Esa es la regla que más se
incumple. El artículo explica; el curso comprueba que lo has entendido,
con datos concretos del artículo (nombres, cifras, pasos), no con
generalidades. Si una pregunta se puede acertar sin haber leído nada, está
mal planteada.

Se puede entregar una guía **solo con artículo**, sin curso. Lo que no
tiene sentido es al revés.

---

## 3. Metadatos de una guía

| Campo | Qué es | Valores reales en uso |
|---|---|---|
| `slug` | La URL: `pokedoc.es/guia?slug=…` | minúsculas, guiones, sin tildes ni ñ. Ej: `6-chequeos-carta-falsa` |
| `title` | Título | 3–7 palabras. Ej: *"Cómo se juega, en 5 minutos"* |
| `description` | Una frase para la tarjeta | 1 frase, ~15 palabras |
| `category_slug` | Ver tabla de abajo | — |
| `cover_emoji` | Un emoji para la tarjeta | 🔍 🧪 🌱 📖 🔥 💶 🃏 … |
| `level` | Dificultad | `beginner` · `intermediate` · `advanced` |
| `guide_rarity` | Sello visual | `bronze` · `silver` · `gold` |
| `xp_reward` | XP al terminar el curso | 20–35 (20 fácil, 35 exigente) |
| `estimated_mins` | Minutos de lectura | 6–9 |
| `tags` | Etiquetas de búsqueda | 3 o 4, en minúscula. Ej: `{falsificaciones,básico,reverso}` |

### Categorías

Estas son las que usan las guías actuales:

| `category_slug` | De qué va |
|---|---|
| `fake_detection` | Detectar falsificaciones |
| `card_identification` | Leer e identificar cartas, rarezas, variantes |
| `market_and_trading` | Comprar, vender, precios, mercado de segunda mano |
| `play_pokemon` | Jugar: reglas, mazos, estrategia |
| `conceptos` | Primeros pasos, vocabulario, empezar a coleccionar |
| `history` | Historia del juego y de los sets |

⚠️ **Puede haber más categorías** que estas seis. La lista completa y al
día está en **pokedoc.es/admin → Categorías**. Antes de escribir una guía
para una categoría que no esté en esta tabla, confírmala ahí.

---

## 4. El artículo: HTML con etiquetas MUY limitadas

`reference_blocks` es siempre un array con **un** objeto:

```json
[{ "type": "richtext", "html": "<h2>…</h2><p>…</p>" }]
```

### Etiquetas permitidas — no hay más

```
p  br  strong  b  em  i  u  h2  h3  ul  ol  li  a  img  blockquote
```

Atributos permitidos: `href` `src` `alt` `target` `rel`

🔴 **Cualquier otra cosa se borra sin avisar.** El sitio pasa el HTML por un
saneador al guardar y al pintar. Nada de `<div>`, `<span>`, `<table>`,
`<h1>`, `<code>`, `class`, `style`, `id`. Si escribes una tabla, desaparece
y el lector ve un hueco. Cuando necesites una tabla, usa una lista.

`<h1>` tampoco: el título de la guía ya es el h1 de la página. Los
apartados van con `<h2>` y los subapartados con `<h3>`.

### Cómo está escrito de verdad

Ejemplo literal de una guía publicada:

```html
<h2>Antes de empezar</h2>
<p>Ninguna de estas señales es definitiva por sí sola. Una carta auténtica
puede fallar un chequeo por desgaste o por una tirada rara de impresión. Lo
que delata a una falsificación es <strong>acumular varias señales a la
vez</strong>. Ve marcándolas mentalmente y decide con el conjunto.</p>
<p>Si puedes, ten al lado una carta que sepas seguro que es auténtica, de la
misma época. Comparar es muchísimo más fiable que juzgar a ciegas.</p>

<h2>1. El reverso azul</h2>
<p>Es el chequeo más rentable porque el reverso es idéntico en millones de
cartas y cualquier desviación canta…</p>
```

Fíjate en el patrón: un apartado de contexto que avisa de los límites del
método, y luego apartados numerados. Los párrafos son cortos y cada uno
dice **una** cosa.

### Imágenes: el tamaño decide dónde van

No hay forma de marcar una imagen como "en línea" o "en bloque" — el
saneador borra `class` y `style`. Lo decide su tamaño, y funciona solo:

- **Una imagen pequeña** (un símbolo de rareza, un icono de energía) se
  queda **en la misma línea** que el texto. Es lo que hace falta para
  listas del tipo `<li><strong>Common</strong> <img …> · círculo negro
  · …</li>`.
- **Una imagen ancha** no cabe al lado del texto, así que el navegador la
  baja sola a su propio renglón, a lo ancho del artículo.

O sea: para que un símbolo salga junto al texto, basta con que la imagen
sea pequeña de verdad (15–20px de lado). Si subes un recorte de 400px
esperando que quede en línea, se irá a su propia fila.

### Cartas de Pokémon dentro del artículo

Se pueden incrustar cartas reales con una etiqueta propia:

```html
<tcg-deck data-cards="swsh3-136,base1-4"></tcg-deck>
```

Los identificadores son de **TCGdex** (`base1-4` = Charizard del Set Base).
El elemento va siempre vacío: la web pinta las cartas sola. Úsalo solo si
estás seguro del identificador; si no, mejor describir la carta con
palabras.

---

## 5. El curso: los 9 tipos de bloque

`blocks` es un array JSON. **Reglas de estructura:**

1. El primero es siempre **uno** `hook`.
2. El último es siempre **uno** `reward`.
3. Entre 6 y 8 bloques en total.
4. Como mucho **un** bloque de teoría (`concept`), y solo si hace falta.
   Puedes omitirlo.
5. El resto son de práctica, **mezclando tipos**. Nunca el mismo tipo más
   de dos veces seguidas.

Los ejemplos que siguen son literales de guías publicadas.

### `hook` — engancha, no explica

```json
{
  "type": "hook",
  "emoji": "🃏",
  "headline": "Tus 60 cartas favoritas no son un mazo",
  "subtext": "Un mazo es una máquina que hace una cosa de forma fiable. Vamos con la proporción que funciona."
}
```

### `concept` — el único bloque de teoría

También vale `tip`, `warning` o `example` en vez de `concept`: cambian solo
el color y el icono.

```json
{
  "type": "concept",
  "emoji": "⚠️",
  "title": "Dos fraudes distintos",
  "body": "Slab falso: carcasa y etiqueta imitadas con una carta falsa dentro. Slab manipulado: una carcasa auténtica que se abre con calor, se le cambia la carta por otra peor o falsa, y se vuelve a sellar.",
  "highlight": "El segundo es más difícil de ver, porque la carcasa sí es original."
}
```

### `quiz` — 2 a 4 opciones

```json
{
  "type": "quiz",
  "question": "¿Qué empresa distribuyó el primer set en Occidente, en 1999?",
  "options": ["Nintendo", "Media Factory", "Wizards of the Coast", "Creatures Inc."],
  "correct_index": 2,
  "explanation": "Wizards of the Coast, la misma empresa detrás de Magic. En Japón el juego había nacido en 1996 con Media Factory."
}
```

`correct_index` empieza en 0. Las opciones falsas tienen que ser
**plausibles**: si tres son absurdas, no se comprueba nada.

### `truefalse`

```json
{
  "type": "truefalse",
  "statement": "El rip test conviene hacerlo antes que los chequeos visuales, porque es el más concluyente.",
  "is_true": false,
  "explanation": "Es el más concluyente, pero destruye la carta. Va siempre el último: primero lo visual, luego la luz, y el rip test solo como último recurso."
}
```

Es el tipo más usado. Funciona bien cuando la afirmación es un error
**que la gente comete de verdad**, no un disparate.

### `fillblank` — rellenar el hueco

```json
{
  "type": "fillblank",
  "before": "Al recibir el paquete conviene",
  "after": "abriéndolo en un plano continuo, porque es la mejor prueba si hay problema.",
  "options": ["grabarte", "pesarlo", "abrirlo rápido", "confirmar la recepción"],
  "correct_option": "grabarte",
  "explanation": "Un vídeo continuo desde que el paquete está cerrado es la prueba más sólida en una reclamación."
}
```

`correct_option` debe coincidir **exactamente** con una de las `options`.

### `match` — emparejar, 3 a 5 parejas

```json
{
  "type": "match",
  "title": "Relaciona cada variante con cómo se reconoce",
  "pairs": [
    { "left": "Primera edición", "right": "Sello negro con un '1' junto a la ilustración" },
    { "left": "Shadowless", "right": "Sin sello y sin sombra a la derecha del recuadro" },
    { "left": "Unlimited", "right": "Con sombra y sin sello: la tirada masiva" }
  ]
}
```

### `order` — ordenar pasos, 3 a 5

```json
{
  "type": "order",
  "title": "Ordena los pasos para mejorar un mazo que ya has jugado",
  "items": [
    "Jugar varias partidas con él",
    "Apuntar qué carta te habría gustado tener en cada momento perdido",
    "Quitar las cartas que casi nunca has llegado a jugar",
    "Probar la mano inicial diez veces seguidas para ver si el plan arranca"
  ]
}
```

⚠️ Los `items` van en el **orden correcto**: la web los baraja sola al
mostrarlos.

### `checklist` — lista para marcar

```json
{
  "type": "checklist",
  "title": "Antes de hacer un rip test, confirma que",
  "items": [
    "La carta es tuya",
    "Ya no puedes devolverla ni reclamar al vendedor",
    "Estás casi seguro de que el lote es falso",
    "Vas a sacrificar solo una carta, no todas",
    "Asumes que si sale auténtica, la has roto para nada"
  ]
}
```

### `reward` — siempre el último

```json
{ "type": "reward", "next_guide_slug": "sellado-resellado" }
```

`next_guide_slug` puede ir vacío (`""`) o apuntar al slug de otra guía que
sea la continuación natural.

---

## 6. Tono y estilo

- **Español de España**, cercano pero sin pasarse de coleguismo. Se tutea.
- **Frases cortas.** Un párrafo, una idea.
- **Concreto antes que exhaustivo.** "El azul se va a morado y el amarillo
  del borde tira a mostaza" vale más que "los colores pueden variar".
- **Di cuándo un método falla.** Las guías buenas del sitio avisan de sus
  propios límites: *"Ninguna de estas señales es definitiva por sí sola"*.
  Eso genera confianza; el tono de manual infalible, no.
- **Nada de relleno.** Sin "en el apasionante mundo del coleccionismo", sin
  introducciones que no dicen nada, sin repetir el título en la primera
  frase.
- **Sin emojis dentro del texto del artículo.** Los emojis van en los
  metadatos (`cover_emoji`) y en los bloques del curso, no salpicando los
  párrafos.
- **Nada de precios concretos** salvo como orden de magnitud, y diciendo
  que cambian. Un precio exacto queda desfasado en semanas.

---

## 7. Lo más importante: los datos tienen que ser ciertos

Esto va sobre todo a quien lea este documento en el chat nuevo.

**Las 13 guías que ya están publicadas se escribieron sin poder consultar
internet.** Sirven como referencia de FORMATO y de TONO, pero **no las
tomes como fuente de datos**. Concretamente, las de *1999 / Set Base* y la
de *rarezas* están pendientes de que las relea un experto.

Si tienes acceso a la web, **úsalo**: fechas de sets, nombres de series,
números de cartas, cómo funciona una regla del juego. El público de PokeDoc
son coleccionistas, y un dato mal puesto en una guía de detección de falsas
se nota y hace perder la confianza en todo lo demás.

Si no estás seguro de un dato, hay dos salidas honestas: dejarlo fuera, o
escribirlo de forma que sea cierto sin precisar de más ("las primeras
ediciones occidentales" en vez de una fecha exacta que no puedes
confirmar).

---

## 8. Qué entregar

Para cada guía, tres cosas:

1. **Los metadatos** de la tabla del punto 3.
2. **El artículo** en HTML, con las etiquetas permitidas.
3. **El curso**, como array JSON de bloques.

### Y el formato para meterlo en la web

Lo más cómodo es un fichero SQL con esta forma, que se ejecuta en el SQL
Editor de Supabase (es exactamente como entraron las 13 guías actuales):

```sql
begin;

insert into guides (
  slug, title, description, category_id, cover_emoji, level, guide_rarity,
  xp_reward, estimated_mins, tags, search_content, blocks, reference_blocks,
  is_pro, reference_unlocked_by_default, review_status, author_id,
  collection_order, published_at, created_at
)
select
  s.slug, s.title, s.description, c.id, s.cover_emoji, s.level, s.guide_rarity,
  s.xp_reward, s.estimated_mins, s.tags, s.search_content,
  s.blocks::jsonb, s.reference_blocks::jsonb,
  false,    -- is_pro
  true,     -- la documentación se lee sin hacer el curso
  'approved',
  null,     -- author_id null = guía oficial
  0,
  now(),    -- publicada ya
  now()
from (values
  (
    'slug-de-la-guia',
    'Título de la guía',
    'Una frase de descripción.',
    'fake_detection',                      -- category_slug
    '🔍',                                  -- cover_emoji
    'beginner', 'bronze', 25, 7,
    array['etiqueta1','etiqueta2','etiqueta3'],
    'texto plano para el buscador',
    '[ … bloques del curso … ]',
    '[{"type":"richtext","html":"<h2>…</h2>"}]'
  )
) as s(
  slug, title, description, category_slug, cover_emoji, level, guide_rarity,
  xp_reward, estimated_mins, tags, search_content, blocks, reference_blocks
)
join categories c on c.slug = s.category_slug
on conflict (slug) do nothing;

update categories c set guide_count = (
  select count(*) from guides g where g.category_id = c.id and g.published_at is not null
);

commit;
```

Detalles de SQL que rompen esto si se pasan por alto:

- 🔴 **Si el `category_slug` no existe, no se inserta nada Y NO SALE NINGÚN
  ERROR.** El `join categories` descarta la fila en silencio: Supabase dice
  "Success" y la guía no aparece por ninguna parte. Es el fallo más
  desconcertante de los tres, está comprobado ejecutándolo. Por eso importa
  confirmar el slug de la categoría en `/admin → Categorías` antes.
  **Comprueba siempre después de ejecutar** con la consulta de abajo.
- **Los apóstrofos se duplican.** `d'un` se escribe `d''un` dentro de una
  cadena SQL. Es el fallo número uno al pegar texto en español.
- **`on conflict (slug) do nothing`** hace que se pueda ejecutar dos veces
  sin duplicar nada.
- **`search_content`** es el texto que usa el buscador: el artículo sin
  etiquetas HTML, en plano.

Después de ejecutar, pega esto para comprobar que ha entrado de verdad:

```sql
select g.slug, c.slug as categoria, g.level, g.xp_reward,
       jsonb_array_length(g.blocks) as bloques_curso,
       length(g.reference_blocks->0->>'html') as largo_articulo
from guides g join categories c on c.id = g.category_id
where g.slug in ('slug-de-la-guia')   -- pon aquí los slugs que has insertado
order by g.slug;
```

Si devuelve cero filas, la guía **no** se ha insertado.

La alternativa, si prefieres no tocar SQL, es meterla a mano desde
**pokedoc.es/admin → Guías → Crear guía**, con el editor de texto para el
artículo y el editor de bloques para el curso.

---

## 9. Guías que ya existen (no las repitas)

| Categoría | Guías publicadas |
|---|---|
| `fake_detection` | `6-chequeos-carta-falsa` · `test-luz-rip-test` · `slabs-falsos-verificar` · `sellado-resellado` |
| `card_identification` | `leer-una-carta` · `mapa-de-rarezas` |
| `market_and_trading` | `cuanto-vale-tu-carta` · `comprar-seguro-segunda-mano` |
| `play_pokemon` | `como-se-juega-en-5-minutos` · `tu-primer-mazo` |
| `conceptos` | `empezar-coleccion-sin-arruinarte` · `glosario-coleccionista` |
| `history` | `1999-como-empezo-todo` |

Huecos evidentes que nadie cubre todavía: conservar y proteger (fundas,
toploaders, humedad), el proceso de gradeo paso a paso (PSA, CGC, qué
compensa y qué no), álbumes y organización de la colección, y guías de
sets concretos.

---

## 10. Resumen para el chat nuevo

> Escribes guías para PokeDoc, una web en español de España sobre
> coleccionismo de Pokémon TCG. Cada guía tiene un artículo en HTML (solo
> `p, br, strong, b, em, i, u, h2, h3, ul, ol, li, a, img, blockquote` —
> todo lo demás se borra) y un curso de 6 a 8 bloques JSON que empieza por
> `hook` y acaba por `reward`. El curso no resume el artículo: comprueba
> que se ha entendido, con datos concretos. Tono cercano, frases cortas,
> nada de relleno, y di siempre cuándo un método falla. **Verifica los
> datos antes de escribirlos**: el público son coleccionistas y notan un
> dato mal.

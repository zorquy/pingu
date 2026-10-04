import { supabase } from './supabase.js'

// Cliente de TCGdex (https://tcgdex.dev) — catálogo de cartas Pokémon,
// gratis, comunitario y sin clave de API. Al no haber clave no hace falta
// proxy: se llama desde el navegador.
//
// Solo se usa para IMPORTAR al espejo de Supabase desde el panel. El
// resto de la web nunca habla con TCGdex: consulta `tcg_cards`, que es
// nuestra. Ver supabase-migration-cartas.sql para el porqué.

const API = 'https://api.tcgdex.net/v2'
const ASSETS = 'https://assets.tcgdex.net'

// Los mercados viven en `js/mercados.js` desde la tanda 438: los
// necesitan también `js/carta-ruta.js` —que monta las direcciones de las
// imágenes y no puede arrastrar Supabase— y la función de Netlify de la
// ficha, que hasta ahora llevaba una copia a mano. Se importan Y se
// reexportan: un `export … from` no crea el enlace local, y aquí dentro
// se usan.
import { MERCADOS, MERCADOS_A_IMPORTAR, MERCADOS_VISIBLES, MERCADO_POR_DEFECTO, NOMBRE_MERCADO, idiomaDeMercado, IDIOMA } from './mercados.js'
export { MERCADOS, MERCADOS_A_IMPORTAR, MERCADOS_VISIBLES, MERCADO_POR_DEFECTO, NOMBRE_MERCADO, idiomaDeMercado, IDIOMA }

// Series que NO se importan. `tcgp` es Pokémon TCG Pocket: es un juego de
// móvil, sus cartas no existen en papel y no se coleccionan ni se juegan
// en torneo. Aparece en los siete catálogos occidentales.
// La lista vive en `js/catalogo-series.js`: la necesitan también la
// función del borde y el sitemap, y este fichero importa `./supabase.js`
// y no se puede arrastrar a un servidor. Se importa Y se reexporta — un
// `export … from` no crea el enlace local y aquí se usa por dentro.
import { esDelTCG, SERIES_FUERA } from './catalogo-series.js'
export const SERIES_EXCLUIDAS = SERIES_FUERA


// Idiomas candidatos para el diagnóstico. No es la lista de lo que hay:
// es la lista de lo que se PREGUNTA, porque no sabemos de antemano qué
// sirve TCGdex. El diagnóstico dice cuáles responden de verdad.
export const IDIOMAS_CANDIDATOS = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'pt-br', 'nl', 'pl', 'ru',
  'ja', 'ko', 'zh-cn', 'zh-tw', 'id', 'th',
]

// Las imágenes llegan como URL completa y con el idioma dentro:
//   https://assets.tcgdex.net/es/swsh/swsh3/136
// Se guarda solo la parte de después del idioma para poder montarla
// luego en el idioma que toque. Las cartas antiguas no tienen escaneo en
// español (comprobado: la de Set Base no carga), así que hace falta
// poder caer a inglés sin volver a preguntarle a nadie.
// Vive en `js/carta-detalle.js` desde la tanda 348, que no importa nada:
// la función programada que engorda cartas también lo necesita, y este
// fichero importa `./supabase.js` y no se puede arrastrar a Netlify. Se
// reexporta para que nada de lo que ya lo pedía aquí se entere.
import { imagePathFromUrl } from './carta-detalle.js'
export { imagePathFromUrl }

// calidad: 'low' (miniatura, ~40 KB) o 'high' (lectura, ~400 KB).
//
// Ya no hay idioma de reserva: el catálogo inglés tiene escaneo de todas
// las cartas, así que no hace falta reintentar en otro idioma. Antes sí,
// porque las anteriores a 2011 no tienen escaneo en español y salían
// todas roras.
export function cardImageUrl(imagePath, calidad = 'low', market = MERCADO_POR_DEFECTO) {
  if (!imagePath) return null
  return `${ASSETS}/${idiomaDeMercado(market)}/${imagePath}/${calidad}.webp`
}

async function pedir(ruta, idioma = IDIOMA) {
  const res = await fetch(`${API}/${idioma}/${ruta}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`TCGdex respondió ${res.status} en /${idioma}/${ruta}`)
  return res.json()
}

// Los sets de un mercado, ya sin las series excluidas.
export async function fetchSets(market = MERCADO_POR_DEFECTO) {
  const sets = await pedir('sets', idiomaDeMercado(market))
  // Con `esDelTCG`, no con la serie a secas: el listado NO trae `serie`,
  // así que el filtro de antes —`!SERIES_EXCLUIDAS.includes(s.serie?.id)`—
  // no echó nunca a nadie. Por eso se colaron los catorce sets de
  // Pokémon TCG Pocket que hubo que borrar a mano el 2026-09-22. Lo que
  // sí llega siempre es el IDENTIFICADOR.
  return (sets || []).filter(esDelTCG)
}

// Devuelve el set CON todas sus cartas dentro: por eso importar el
// catálogo entero son ~220 sets y no 23.000 peticiones sueltas.
//
// Una sola petición, en inglés. Antes se pedían las dos versiones y se
// mezclaban; eso es justo lo que dejaba el catálogo a medio traducir.
export function fetchSet(setId, market = MERCADO_POR_DEFECTO) {
  return pedir(`sets/${encodeURIComponent(setId)}`, idiomaDeMercado(market))
}

// ── Los mapeos PUROS, en su propio fichero (tanda 471) ──
//
// `setToRow`, `cardToRow`, `fechaDeSet`, `codigoLiveDeSet` y
// `sinDuplicados` no tocan ni red ni base: son de la respuesta de
// TCGdex a una fila de la tabla. Viven en `js/catalogo-tcgdex.js`
// porque los necesita también el servidor —la función programada que
// completa el catálogo asiático— y este fichero importa
// `./supabase.js`, que es del navegador y no se puede arrastrar a
// Netlify. Hasta la 471 la salida era una COPIA A MANO vigilada por una
// prueba, y esa prueba se separó ella sola (se vio en la 447).
//
// Aquí va un `export … from` y no el import+reexport de los otros: ya
// no se usa ninguna de las cinco por dentro, así que no hace falta el
// enlace local —y pedirlo sería decir que sí se usa—.
export { setToRow, cardToRow, fechaDeSet, codigoLiveDeSet, sinDuplicados, porImagen } from './catalogo-tcgdex.js'


// ── El detalle de UNA carta (tanda 322) ──
//
// Esta es la petición cara que `cardToRow` evita a propósito: una por
// carta, ~23.000 contra un catálogo comunitario y gratuito. No se usa al
// importar un set; la usa la función programada `cartas-detalle`, que va
// por tandas y no corre nunca contra el catálogo entero de golpe.
export function fetchCard(cardId, market = MERCADO_POR_DEFECTO) {
  return pedir(`cards/${encodeURIComponent(cardId)}`, idiomaDeMercado(market))
}

// El mapeo de esa respuesta a las columnas de `tcg_cards` NO vive aquí:
// vive en `netlify/lib/carta-detalle.mjs`, porque quien lo usa es una
// función de servidor y este fichero importa `./supabase.js`, que es del
// navegador. Arrastrarlo entero a Netlify no funciona.

// `normalizeSearch` vive en `js/texto.js` desde la tanda 447 y se
// reexporta desde aquí porque la importan diez sitios. Se mudó porque la
// necesitaba el DOBLE de Supabase de las pruebas para generar
// `name_search`, y este fichero importa `./supabase.js` —que en las
// pruebas ES el doble—: arrastrarlo habría cerrado el círculo.
export { normalizeSearch } from './texto.js'

// Busca en NUESTRO espejo, no en TCGdex, y SIEMPRE dentro de un mercado.
//
// El mercado no es opcional a propósito: sin filtrar, buscar "Charizard"
// devolvería la misma carta cuatro veces —inglesa, japonesa y las dos
// chinas— y quien monta una guía tendría que adivinar cuál es cuál.
//
// ── Por palabras, no por la frase entera ──
//
// Antes se buscaba la cadena literal: "mewtwo ex" exigía esos ocho
// caracteres SEGUIDOS. Así, "M Mewtwo EX" aparecía y "Mewtwo & Mew-GX"
// no, sin ninguna razón que el que busca pueda entender. Ahora se parte
// en palabras y se piden TODAS, en cualquier orden y en cualquier sitio
// del nombre.
//
// ── Y devuelve el total ──
//
// Esto era lo que de verdad estaba mal. Devolvía 24 cartas y la pantalla
// decía "24 resultados", así que parecía que sólo había 24. No: 24 era el
// tope. Ahora se devuelve `total` (el de verdad, contado por Postgres) y
// `desde` para pedir la página siguiente.
export async function searchCards(
  consulta,
  { limite = 48, desde = 0, setId = null, market = MERCADO_POR_DEFECTO } = {}
) {
  const texto = normalizeSearch(consulta)
  if (texto.length < 2) return { cartas: [], total: 0 }
  // Las palabras de una letra se quedan: quien escribe "mewtwo x" está
  // buscando la Mewtwo X, y tirar la "x" le devolvería las 80 Mewtwo.
  const palabras = texto.split(/\s+/).filter(Boolean)

  let q = supabase
    .from('tcg_cards')
    .select('id, market, set_id, local_id, name, image_path,image_scrydex, regulation_mark, tcg_sets(name, release_date)', { count: 'exact' })
    .eq('market', market)
  // Encadenar varios `like` los une con AND, que es lo que se quiere:
  // todas las palabras presentes.
  for (const palabra of palabras) q = q.like('name_search', `%${palabra.replace(/[%_]/g, '')}%`)
  if (setId) q = q.eq('set_id', setId)

  // Alfabético: así las variantes de una misma carta salen juntas
  // ("Mewtwo", "Mewtwo ex", "Mewtwo V"...) en vez de en orden aleatorio,
  // que con 80 resultados es la diferencia entre buscar y rebuscar.
  const { data, error, count } = await q.order('name_search').range(desde, desde + limite - 1)
  if (error) throw error
  return { cartas: data || [], total: count ?? 0 }
}

// ── Referenciar una carta desde una guía ──
//
// Cuidado aquí: desde que hay varios mercados, el identificador de una
// carta YA NO ES ÚNICO. `CS1a-1` existe en chino tradicional, en
// indonesio y en tailandés, y son cartas distintas.
//
// Las guías ya escritas guardan el identificador a secas. Así que la
// referencia es "id" para el catálogo occidental —igual que siempre, y
// por eso ninguna guía antigua se rompe— y "id@MERCADO" para el resto.
export function refCarta(id, market = MERCADO_POR_DEFECTO) {
  return market && market !== MERCADO_POR_DEFECTO ? `${id}@${market}` : String(id)
}

export function parseRefCarta(ref) {
  const [id, market] = String(ref || '').split('@')
  return { id, market: MERCADOS[market] ? market : MERCADO_POR_DEFECTO }
}

export async function cardsByIds(refs) {
  const unicas = [...new Set((refs || []).filter(Boolean))].map(parseRefCarta)
  if (unicas.length === 0) return []

  // Una consulta por mercado. Son cuatro como máximo, y filtrar por
  // mercado es lo que evita traer la misma carta repetida.
  const porMercado = {}
  for (const { id, market } of unicas) (porMercado[market] ||= []).push(id)

  const tandas = await Promise.all(
    Object.entries(porMercado).map(([market, ids]) =>
      supabase
        .from('tcg_cards')
        // `name_es` viaja porque la dirección de la ficha se hace con el
        // nombre que se ENSEÑA (tanda 335), y sin él las cartas de una
        // guía enlazarían a la dirección inglesa mientras la ficha vive
        // en la española. Resolver, resuelven las dos —el identificador
        // va al final— pero serían dos direcciones para una página.
        // Y `tcg_online_code` desde la tanda 370: es lo que necesita el
        // segundo sitio donde buscar un escaneo cuando TCGdex no tiene
        // el de esa carta (ver js/escaneo-carta.js).
        .select('id, market, set_id, local_id, name, name_es, name_en, image_path,image_scrydex, tcg_sets(name, tcg_online_code)')
        .eq('market', market)
        .in('id', ids)
    )
  )
  const fallo = tandas.find((t) => t.error)
  if (fallo) throw fallo.error
  return tandas.flatMap((t) => t.data || [])
}

// ── Diagnóstico de catálogos ──
//
// No importa nada: sólo PREGUNTA. Se hizo para decidir el esquema de los
// mercados, y esa decisión ya está tomada — se queda porque el catálogo
// de TCGdex cambia (aparecen idiomas, aparecen series) y esto lo dice sin
// tener que abrir la API a mano.
//
// Lo que descubrió, y que motiva la clave (id, market): los catálogos
// asiáticos se pisan ENTRE ELLOS. `CS1a`, `CS1b`, `CS2.5` y `CS4a`
// existen en chino tradicional, en indonesio y en tailandés, y son sets
// distintos con el mismo identificador.
//
// Ojo con una limitación: compara cada idioma contra el INGLÉS, no unos
// contra otros. Aquello se vio de refilón, en los ejemplos. Si algún día
// hay que volver a decidir algo así, conviene mirar todos contra todos.
export async function diagnosticarCatalogos(alAvanzar = () => {}) {
  const filas = []
  for (const lang of IDIOMAS_CANDIDATOS) {
    alAvanzar(`Preguntando por ${lang}…`)
    const fila = { lang, sets: null, series: [], error: null, setIds: [] }
    try {
      const sets = await pedir('sets', lang)
      fila.sets = Array.isArray(sets) ? sets.length : 0
      fila.setIds = (sets || []).map((s) => s.id)
      fila.cartas = (sets || []).reduce((n, s) => n + (s.cardCount?.total || 0), 0)
    } catch (err) {
      fila.error = err.message
      filas.push(fila)
      continue
    }
    try {
      const series = await pedir('series', lang)
      fila.series = (series || []).map((s) => `${s.id}${s.name && s.name !== s.id ? ` (${s.name})` : ''}`)
    } catch (err) {
      fila.series = [`— no se pudo leer: ${err.message}`]
    }
    filas.push(fila)
  }

  const porLang = Object.fromEntries(filas.filter((f) => f.sets).map((f) => [f.lang, new Set(f.setIds)]))
  const base = porLang.en || new Set()
  const choques = {}
  for (const [lang, ids] of Object.entries(porLang)) {
    if (lang === 'en') continue
    const comunes = [...ids].filter((id) => base.has(id))
    choques[lang] = {
      total: ids.size,
      compartidos: comunes.length,
      propios: ids.size - comunes.length,
      ejemplosCompartidos: comunes.slice(0, 8),
      ejemplosPropios: [...ids].filter((id) => !base.has(id)).slice(0, 8),
    }
  }
  return { filas, choques }
}

export function diagnosticoComoTexto({ filas, choques }) {
  const l = []
  l.push('=== IDIOMAS ===')
  for (const f of filas) {
    l.push(
      f.error
        ? `${f.lang.padEnd(6)} —  NO responde (${f.error.slice(0, 60)})`
        : `${f.lang.padEnd(6)} ${String(f.sets).padStart(4)} sets, ${String(f.cartas).padStart(6)} cartas declaradas`
    )
  }
  l.push('')
  l.push('=== SETS PROPIOS vs COMPARTIDOS CON EL CATÁLOGO INGLÉS ===')
  for (const [lang, c] of Object.entries(choques)) {
    l.push(`${lang.padEnd(6)} ${String(c.total).padStart(4)} sets · ${String(c.compartidos).padStart(4)} compartidos · ${String(c.propios).padStart(4)} propios`)
    if (c.ejemplosCompartidos.length) l.push(`       compartidos p.ej.: ${c.ejemplosCompartidos.join(', ')}`)
    if (c.ejemplosPropios.length) l.push(`       propios p.ej.: ${c.ejemplosPropios.join(', ')}`)
  }
  l.push('')
  l.push('=== SERIES POR IDIOMA ===')
  for (const f of filas) {
    if (f.error || !f.series.length) continue
    l.push(`${f.lang}: ${f.series.join(' | ')}`)
  }
  return l.join('\n')
}

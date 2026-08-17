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

// ── Mercados ──
//
// Un "mercado" no es un idioma: es un catálogo distinto de cartas. Lo
// decidió el diagnóstico del panel contra la API de verdad:
//
//   - Los idiomas OCCIDENTALES son UN catálogo traducido. El español
//     comparte sus 154 identificadores de set con el inglés; el alemán
//     sus 153, el italiano sus 190, el portugués sus 123 — todos. Así que
//     el occidental se importa en INGLÉS, que es el superconjunto (218
//     sets, 23.746 cartas). Pedir los demás sería traer las mismas
//     cartas con otro nombre.
//
//   - Los ASIÁTICOS son catálogos propios, con sus sets y sus cartas.
//     Una Charizard japonesa no es la inglesa: son dos cosas para quien
//     colecciona. De ahí la columna `market` en la base.
//
// El inglés además es como se nombran las cartas en listas de torneo y
// en tiendas, y es como busca la gente. Antes se pedía en español y se
// mezclaba con el inglés, y salía un catálogo partido por 2011: las
// modernas en español y las antiguas en inglés, en la misma lista.
export const MERCADOS = {
  WEST: 'en',
  JP: 'ja',
  CN: 'zh-cn',   // chino simplificado (56 sets)
  TW: 'zh-tw',   // chino tradicional (98 sets) — catálogo aparte, no una traducción
  KO: 'ko',      // 95 sets
  ID: 'id',      // 70 sets
  TH: 'th',      // 72 sets
}

// Los que se importan hoy. Coreano, indonesio y tailandés existen y
// están completos; no entran porque no se han pedido. Añadirlos es meter
// el código en esta lista y reimportar, nada más.
export const MERCADOS_A_IMPORTAR = ['WEST', 'JP', 'CN', 'TW']

export const MERCADO_POR_DEFECTO = 'WEST'

// Series que NO se importan. `tcgp` es Pokémon TCG Pocket: es un juego de
// móvil, sus cartas no existen en papel y no se coleccionan ni se juegan
// en torneo. Aparece en los siete catálogos occidentales.
export const SERIES_EXCLUIDAS = ['tcgp']

export const idiomaDeMercado = (market) => MERCADOS[market] || MERCADOS[MERCADO_POR_DEFECTO]

// El idioma que se usa cuando no se dice otra cosa.
export const IDIOMA = MERCADOS[MERCADO_POR_DEFECTO]

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
export function imagePathFromUrl(url) {
  if (!url) return null
  const m = String(url).match(/^https?:\/\/[^/]+\/[a-z-]{2,5}\/(.+)$/i)
  return m ? m[1] : null
}

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
  return (sets || []).filter((s) => !SERIES_EXCLUIDAS.includes(s.serie?.id))
}

// Devuelve el set CON todas sus cartas dentro: por eso importar el
// catálogo entero son ~220 sets y no 23.000 peticiones sueltas.
//
// Una sola petición, en inglés. Antes se pedían las dos versiones y se
// mezclaban; eso es justo lo que dejaba el catálogo a medio traducir.
export function fetchSet(setId, market = MERCADO_POR_DEFECTO) {
  return pedir(`sets/${encodeURIComponent(setId)}`, idiomaDeMercado(market))
}

function fecha(valor) {
  // TCGdex las da como "2020-08-14"; algunas antiguas vienen vacías o a
  // medias y Postgres rechazaría la fila entera.
  return /^\d{4}-\d{2}-\d{2}$/.test(valor || '') ? valor : null
}

export function setToRow(set, market = MERCADO_POR_DEFECTO) {
  return {
    id: set.id,
    market,
    name: set.name || set.id,
    serie_id: set.serie?.id || null,
    serie_name: set.serie?.name || null,
    logo_path: imagePathFromUrl(set.logo),
    symbol_url: set.symbol || null,
    release_date: fecha(set.releaseDate),
    card_count_total: set.cardCount?.total ?? null,
    card_count_official: set.cardCount?.official ?? null,
  }
}

// El listado de cartas de un set trae poco: id, localId, name e image.
// Basta para el buscador del editor. Los campos de tipo/rareza se
// quedan a null a propósito — los necesitará el álbum, y traerlos exige
// una petición POR CARTA (23.000 en vez de 220).
export function cardToRow(card, setId, market = MERCADO_POR_DEFECTO) {
  return {
    id: card.id,
    set_id: setId,
    market,
    local_id: String(card.localId ?? ''),
    name: card.name || card.id,
    image_path: imagePathFromUrl(card.image),
  }
}

// Postgres guarda `name_search` en minúsculas y sin tildes (columna
// generada con unaccent). Aquí se hace lo mismo con lo que se teclea:
// si no, quien escriba "pomez" no encontraría "Piedra Pómez" — y con
// 1.159 cartas acentuadas en el catálogo, eso pasa constantemente.
export function normalizeSearch(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // unaccent() de Postgres tambien convierte la puntuacion tipografica
    // a su equivalente ASCII, y JS no. Sin esto, 31 cartas con apostrofo
    // curvo ("Farfetch\u2019d", "Rocket\u2019s Mewtwo") quedaban guardadas con
    // apostrofo recto e imposibles de encontrar. Se comprobo comparando
    // las 23.505 cartas reales contra un Postgres de verdad.
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    // Y las letras y signos que no son "letra + tilde" y por tanto NFD no
    // descompone: la ligadura de "Fundacion \u00c6ther" y la apertura de
    // interrogacion y exclamacion, que en espanol salen constantemente.
    .replace(/\u00e6/g, 'ae').replace(/\u00c6/g, 'AE')
    .replace(/\u0153/g, 'oe').replace(/\u0152/g, 'OE')
    .replace(/\u00df/g, 'ss')
    .replace(/\u00bf/g, '?').replace(/\u00a1/g, '!')
    .replace(/[\u00f8\u00d8]/g, 'o')
    .toLowerCase()
    .trim()
}

// Busca en NUESTRO espejo, no en TCGdex.
// Busca en NUESTRO espejo, no en TCGdex, y SIEMPRE dentro de un mercado.
//
// El mercado no es opcional a propósito: sin filtrar, buscar "Charizard"
// devolvería la misma carta cuatro veces —inglesa, japonesa y las dos
// chinas— y quien monta una guía tendría que adivinar cuál es cuál.
export async function searchCards(consulta, { limite = 24, setId = null, market = MERCADO_POR_DEFECTO } = {}) {
  const termino = normalizeSearch(consulta)
  if (termino.length < 2) return []
  let q = supabase
    .from('tcg_cards')
    .select('id, market, set_id, local_id, name, image_path, tcg_sets(name)')
    .eq('market', market)
    .like('name_search', `%${termino.replace(/[%_]/g, '')}%`)
    .limit(limite)
  if (setId) q = q.eq('set_id', setId)
  const { data, error } = await q
  if (error) throw error
  return data || []
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
        .select('id, market, set_id, local_id, name, image_path, tcg_sets(name)')
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

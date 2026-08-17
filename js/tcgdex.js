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

// El idioma del catálogo occidental: INGLÉS, y sólo inglés.
//
// Antes se pedía en español y se caía a inglés cuando no había
// traducción. Parecía lo amable y era lo peor de los dos mundos: el
// español sólo cubre de Black & White (2011) en adelante, así que el
// catálogo salía MEZCLADO — las cartas modernas en español y las
// antiguas en inglés, en la misma lista y en el mismo buscador. Quien
// buscaba "Cerdytoso" no encontraba nada de antes de 2011, y quien
// buscaba "Grumpig" no encontraba las de después.
//
// El inglés es el único catálogo COMPLETO, es como se nombran las cartas
// en las listas de torneo y en las tiendas, y es el idioma en el que la
// gente busca cuando busca una carta concreta. Un nombre por carta y se
// acabó el problema.
export const IDIOMA = 'en'

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
export function cardImageUrl(imagePath, calidad = 'low', idioma = IDIOMA) {
  if (!imagePath) return null
  return `${ASSETS}/${idioma}/${imagePath}/${calidad}.webp`
}

async function pedir(ruta, idioma = IDIOMA) {
  const res = await fetch(`${API}/${idioma}/${ruta}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`TCGdex respondió ${res.status} en /${idioma}/${ruta}`)
  return res.json()
}

export function fetchSets() {
  return pedir('sets', IDIOMA)
}

// Devuelve el set CON todas sus cartas dentro: por eso importar el
// catálogo entero son ~220 sets y no 23.000 peticiones sueltas.
//
// Una sola petición, en inglés. Antes se pedían las dos versiones y se
// mezclaban; eso es justo lo que dejaba el catálogo a medio traducir.
export function fetchSet(setId) {
  return pedir(`sets/${encodeURIComponent(setId)}`)
}

function fecha(valor) {
  // TCGdex las da como "2020-08-14"; algunas antiguas vienen vacías o a
  // medias y Postgres rechazaría la fila entera.
  return /^\d{4}-\d{2}-\d{2}$/.test(valor || '') ? valor : null
}

export function setToRow(set) {
  return {
    id: set.id,
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
export function cardToRow(card, setId) {
  return {
    id: card.id,
    set_id: setId,
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
export async function searchCards(consulta, { limite = 24, setId = null } = {}) {
  const termino = normalizeSearch(consulta)
  if (termino.length < 2) return []
  let q = supabase
    .from('tcg_cards')
    .select('id, set_id, local_id, name, image_path, tcg_sets(name)')
    .like('name_search', `%${termino.replace(/[%_]/g, '')}%`)
    .limit(limite)
  if (setId) q = q.eq('set_id', setId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function cardsByIds(ids) {
  const unicos = [...new Set((ids || []).filter(Boolean))]
  if (unicos.length === 0) return []
  const { data, error } = await supabase
    .from('tcg_cards')
    .select('id, set_id, local_id, name, image_path, tcg_sets(name)')
    .in('id', unicos)
  if (error) throw error
  return data || []
}

// ── Diagnóstico de catálogos ──
//
// Esto no importa nada: sólo PREGUNTA. Existe porque para meter las
// cartas japonesas y chinas hay que decidir cómo queda la tabla, y esa
// decisión depende de tres cosas que no se pueden adivinar:
//
//   1. Qué idiomas sirve TCGdex de verdad (¿hay chino? ¿simplificado o
//      tradicional? ¿está completo o son cuatro sets?).
//   2. Cómo se llama la serie de TCG Pocket, para dejarla fuera.
//   3. Y la que de verdad manda: SI LOS IDENTIFICADORES DE SET CHOCAN
//      entre catálogos.
//
// El punto 3 es el que decide la clave primaria de `tcg_cards`. Hoy la
// clave es el id de la carta a secas. Si el catálogo japonés usa ids
// propios, eso sigue valiendo y basta añadir una columna de mercado. Si
// reutiliza los mismos ids con otras cartas dentro, entonces importar
// japonés PISARÍA las occidentales en silencio, y la clave tiene que
// pasar a ser (id, mercado) antes de importar nada.
//
// Se ejecuta desde el panel, en el navegador de Iker, porque es el que
// tiene salida a internet.
export async function diagnosticarCatalogos(alAvanzar = () => {}) {
  const filas = []
  for (const lang of IDIOMAS_CANDIDATOS) {
    alAvanzar(`Preguntando por ${lang}…`)
    const fila = { lang, sets: null, series: [], error: null, setIds: [] }
    try {
      const sets = await pedir('sets', lang)
      fila.sets = Array.isArray(sets) ? sets.length : 0
      fila.setIds = (sets || []).map((s) => s.id)
      // El total de cartas que declara cada set, sin bajarlas: sirve para
      // saber el tamaño real del catálogo antes de comprometerse.
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

  // El choque de identificadores, que es la pregunta importante.
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
      ejemplosPropios: [...ids].filter((id) => !base.has(id)).slice(0, 8),
    }
  }
  return { filas, choques }
}

// Lo de arriba en texto plano, para pegarlo en el chat de una vez.
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
  l.push('(si "compartidos" es 0, los ids no chocan y la clave actual sirve)')
  for (const [lang, c] of Object.entries(choques)) {
    l.push(`${lang.padEnd(6)} ${String(c.total).padStart(4)} sets · ${String(c.compartidos).padStart(4)} compartidos · ${String(c.propios).padStart(4)} propios`)
    if (c.ejemplosPropios.length) l.push(`       propios p.ej.: ${c.ejemplosPropios.join(', ')}`)
  }
  l.push('')
  l.push('=== SERIES POR IDIOMA (para localizar TCG Pocket) ===')
  for (const f of filas) {
    if (f.error || !f.series.length) continue
    l.push(`${f.lang}: ${f.series.join(' | ')}`)
  }
  return l.join('\n')
}

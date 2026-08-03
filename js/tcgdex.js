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

// El idioma que se pide al importar. Ojo: la cobertura del español está
// partida por épocas — de Black & White (2011) en adelante está casi
// completo, y de ahí para atrás (Base, Gym, Neo, E-Card, EX, Diamond &
// Pearl, Platinum, HeartGold) no hay NADA traducido. La API devuelve el
// nombre inglés en esos casos, que es lo que queremos: un Charizard se
// llama Charizard en las dos.
export const IDIOMA = 'es'
export const IDIOMA_RESERVA = 'en'

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
export function cardImageUrl(imagePath, calidad = 'low', idioma = IDIOMA) {
  if (!imagePath) return null
  return `${ASSETS}/${idioma}/${imagePath}/${calidad}.webp`
}

// Para el `onerror` de la etiqueta <img>: si no existe el escaneo en
// español, se reintenta en inglés UNA vez. Sin esto, todas las cartas
// anteriores a 2011 saldrían rotas.
export function cardImageFallbackUrl(imagePath, calidad = 'low') {
  return cardImageUrl(imagePath, calidad, IDIOMA_RESERVA)
}

async function pedir(ruta, idioma = IDIOMA) {
  const res = await fetch(`${API}/${idioma}/${ruta}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`TCGdex respondió ${res.status} en /${idioma}/${ruta}`)
  return res.json()
}

// La lista de sets se pide en INGLÉS a propósito. El catálogo español no
// cubre las épocas antiguas (Base, Gym, Neo, EX, Diamond & Pearl...), y
// pidiéndola en español se quedaban fuera sets enteros — con sus cartas.
// Los identificadores de set no dependen del idioma, así que la lista
// inglesa es la completa y sirve igual.
export function fetchSets() {
  return pedir('sets', IDIOMA_RESERVA)
}

// Devuelve el set CON todas sus cartas dentro: por eso importar el
// catálogo entero son ~220 sets y no 23.000 peticiones sueltas.
//
// Se piden las DOS versiones y se mezclan:
//   - el inglés manda la lista completa de cartas (no falta ninguna),
//   - el español pisa el nombre y la imagen cuando existen.
//
// Así una carta sin traducir sale en inglés en vez de no salir.
export async function fetchSet(setId) {
  const ruta = `sets/${encodeURIComponent(setId)}`
  const [en, es] = await Promise.all([
    pedir(ruta, IDIOMA_RESERVA),
    // Que el español falle no puede dejarnos sin set: hay sets que solo
    // existen en inglés y ahí responde 404.
    pedir(ruta, IDIOMA).catch(() => null),
  ])

  const esPorId = Object.fromEntries((es?.cards || []).map((c) => [c.id, c]))
  return {
    ...en,
    // El nombre del set sí se prefiere en español cuando lo hay.
    name: es?.name || en.name,
    serie: es?.serie || en.serie,
    logo: es?.logo || en.logo,
    cards: (en.cards || []).map((c) => {
      const t = esPorId[c.id]
      return t ? { ...c, name: t.name || c.name, image: t.image || c.image } : c
    }),
  }
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

// La decklist con cartas de verdad: cada línea del export de TCG Live
// se busca en NUESTRO espejo de cartas (`tcg_cards`, el mismo que usa el
// buscador — a TCGdex no se le llama desde aquí) y se pinta con su
// imagen y su contador. Lo que el espejo no tenga se queda como línea de
// texto, que una lista nunca debe perder cartas por culpa del catálogo.
//
// La tabla de códigos de set de TCG Live vive en comun.js (sin DOM):
// con ella la carta se busca dentro de SU set y por su número — exacta,
// edición incluida — y sin correspondencia se cae al nombre.
import { supabase } from '../supabase.js'
import { searchCards, cardImageUrl, normalizeSearch } from '../tcgdex.js'
import { escapeHtml } from '../app.js'
import { nombreDeSetLive } from './comun.js'

const cache = new Map()
const setsPorCodigo = new Map() // código Live → set_id del espejo (o null)

async function setDeCodigo(codigo) {
  const nombre = nombreDeSetLive(codigo)
  if (!nombre) return null
  if (setsPorCodigo.has(codigo)) return setsPorCodigo.get(codigo)
  let setId = null
  try {
    const { data } = await supabase.from('tcg_sets').select('id').eq('market', 'WEST').eq('name', nombre).limit(1)
    setId = data?.[0]?.id || null
  } catch {
    setId = null
  }
  setsPorCodigo.set(codigo, setId)
  return setId
}

async function resolverCarta(linea) {
  const clave = `${normalizeSearch(linea.name)}|${linea.set}|${linea.number}`
  if (cache.has(clave)) return cache.get(clave)
  const nombreNorm = normalizeSearch(linea.name)
  let carta = null
  try {
    // Primero el tiro exacto: su set y su número de colección.
    const setId = await setDeCodigo(linea.set)
    if (setId) {
      const { cartas } = await searchCards(linea.name, { limite: 24, setId })
      carta = cartas.find((c) => c.local_id === String(linea.number)) || cartas[0] || null
    }
    // Sin set en el espejo (o carta que no aparece): por nombre, como antes.
    if (!carta) {
      const { cartas } = await searchCards(linea.name, { limite: 24 })
      const gemelas = cartas.filter((c) => normalizeSearch(c.name) === nombreNorm)
      carta = gemelas.find((c) => c.local_id === String(linea.number)) || gemelas[0] || cartas[0] || null
    }
  } catch {
    carta = null
  }
  cache.set(clave, carta)
  return carta
}

const SECCIONES = [
  { campo: 'pokemon', titulo: 'Pokémon' },
  { campo: 'trainer', titulo: 'Trainer' },
  { campo: 'energy', titulo: 'Energía' },
]

// Pinta la rejilla en `contenedor` y va rellenando las imágenes según se
// resuelven. Devuelve cuando todas las líneas están decididas.
export async function pintarDecklistVisual(contenedor, parsed) {
  if (!parsed || !SECCIONES.some((s) => parsed[s.campo]?.length)) {
    contenedor.innerHTML = ''
    return
  }
  contenedor.innerHTML = SECCIONES.filter((s) => parsed[s.campo]?.length)
    .map(
      (s) => `
      <h5 class="torneo-cartas-titulo">${s.titulo} <span class="subtext">(${parsed[s.campo].reduce((n, l) => n + l.quantity, 0)})</span></h5>
      <div class="torneo-cartas-rejilla">
        ${parsed[s.campo]
          .map(
            (l, i) => `
          <figure class="torneo-carta" data-linea="${s.campo}-${i}">
            <span class="torneo-carta-cuantas">×${l.quantity}</span>
            <figcaption>${escapeHtml(l.name)}</figcaption>
          </figure>`
          )
          .join('')}
      </div>`
    )
    .join('')

  await Promise.all(
    SECCIONES.flatMap((s) =>
      (parsed[s.campo] || []).map(async (linea, i) => {
        const carta = await resolverCarta(linea)
        const hueco = contenedor.querySelector(`[data-linea="${s.campo}-${i}"]`)
        if (!hueco || !carta) return
        hueco.insertAdjacentHTML(
          'afterbegin',
          `<img src="${cardImageUrl(carta.image_path, 'low')}" alt="${escapeHtml(linea.name)}" loading="lazy" onerror="this.remove()" />`
        )
      })
    )
  )
}

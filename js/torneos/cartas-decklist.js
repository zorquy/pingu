// La decklist con cartas de verdad: cada línea del export de TCG Live
// se busca en NUESTRO espejo de cartas (`tcg_cards`, el mismo que usa el
// buscador — a TCGdex no se le llama desde aquí) y se pinta con su
// imagen y su contador. Lo que el espejo no tenga se queda como línea de
// texto, que una lista nunca debe perder cartas por culpa del catálogo.
//
// La tabla de códigos de set de TCG Live vive en comun.js (sin DOM):
// con ella la carta se busca dentro de SU set y por su NÚMERO — sin
// pasar por el nombre, que el export viene en el idioma del jugador y
// el espejo guarda el español cuando existe: cruzar nombres entre
// idiomas era la causa de las cartas «sin imagen». Sin correspondencia
// de set, se cae a la búsqueda global por nombre de siempre.
//
// Además de la imagen, la carta trae su MARCA DE REGULACIÓN (D…J): con
// las marcas legales de la temporada (site_settings 'torneos_reglas',
// hoy H/I/J) la rejilla señala las cartas fuera del reglamento. Las
// energías básicas están exentas, como en el juego real. Una carta que
// el espejo aún no tenga marcada (columna a NULL) no se señala: sin
// dato no hay acusación.
import { supabase } from '../supabase.js'
import { searchCards, cardImageUrl, normalizeSearch } from '../tcgdex.js'
import { escapeHtml } from '../app.js'
import { nombreDeSetLive, MARCAS_LEGALES_DEFECTO } from './comun.js'

const cache = new Map()
const setsPorCodigo = new Map() // código Live → set_id del espejo (o null)
let marcasCache = null

// Las marcas legales de la temporada, una sola vez por página.
export async function marcasLegales() {
  if (marcasCache) return marcasCache
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'torneos_reglas').maybeSingle()
    const marcas = data?.value?.marcas_legales
    marcasCache = Array.isArray(marcas) && marcas.length ? marcas : MARCAS_LEGALES_DEFECTO
  } catch {
    marcasCache = MARCAS_LEGALES_DEFECTO
  }
  return marcasCache
}

// Una energía básica nunca está fuera de reglamento, lleve la marca que
// lleve (regla del juego real). Por nombre y no por categoría: la
// importación básica del espejo deja category a null.
function esEnergiaBasica(linea) {
  return /^basic\b|b[áa]sica/i.test(linea.name)
}

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
    // Primero el tiro exacto: su set y su número de colección, SIN el
    // nombre (los sets nuevos numeran con ceros por delante — 057 — y
    // el export dice 57, así que se prueban las dos formas).
    const setId = await setDeCodigo(linea.set)
    if (setId) {
      const numero = String(linea.number)
      const { data } = await supabase
        .from('tcg_cards')
        .select('id, set_id, local_id, name, image_path, regulation_mark')
        .eq('market', 'WEST')
        .eq('set_id', setId)
        .in('local_id', [numero, numero.padStart(3, '0')])
        .limit(1)
      carta = data?.[0] || null
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
  contenedor.innerHTML =
    '<p class="torneo-decklist-reglamento hidden" data-reglamento></p>' +
    SECCIONES.filter((s) => parsed[s.campo]?.length)
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

  const legales = await marcasLegales()
  let fuera = 0
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
        if (carta.regulation_mark && !legales.includes(carta.regulation_mark) && !esEnergiaBasica(linea)) {
          fuera += linea.quantity
          hueco.classList.add('torneo-carta-ilegal')
          hueco.insertAdjacentHTML(
            'beforeend',
            `<span class="torneo-carta-marca" title="Marca de regulación ${escapeHtml(carta.regulation_mark)}: fuera del reglamento (legales: ${legales.join(', ')})">${escapeHtml(carta.regulation_mark)}</span>`
          )
        }
      })
    )
  )
  const aviso = contenedor.querySelector('[data-reglamento]')
  if (aviso && fuera > 0) {
    aviso.textContent = `Fuera del reglamento: ${fuera} ${fuera === 1 ? 'carta' : 'cartas'} — esta temporada solo valen las marcas ${legales.join(', ')} (la letra pequeña de la esquina de la carta).`
    aviso.classList.remove('hidden')
  }
}

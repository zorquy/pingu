// TCGGO (tanda 588): el cruce carta → producto de Cardmarket, ya hecho.
//
// TCGGO (tcggo.com) sirve por RapidAPI un catálogo de Pokémon TCG donde
// cada carta trae `cardmarket_id` (el `idProduct` de Cardmarket: el
// Tropius 1 de Pitch Black es el 895789, y en el fichero abierto de
// Cardmarket el 895789 es «Tropius [Fruity Aroma | Solar Beam]» de la
// expansión 6569) y `tcgplayer_id`, además de los dos precios. Es el
// emparejamiento que la 587 intentaba deducir a ciegas por el orden de los
// productos y que en la vida real casaba un 15 %: aquí viene dado, carta
// por carta, y se cruza con una llave de verdad — el código del set y el
// NÚMERO —, no por nombres.
//
// Lo que se pide y lo que cuesta: el plan es de pago por peticiones, así
// que todo lo de aquí es puro (sin red) y la función que lo usa cuenta
// cada petición y para en un tope. Las expansiones («episodes») vienen
// de 20 en 20 (~9 páginas); las cartas de una expansión, de 100 en 100.
//
// VARIABLES DE ENTORNO (de la función, no de aquí): TCGGO_API_KEY.
import { numeroComparable } from './scrydex.mjs'
import { normalizeSearch } from '../../js/texto.js'

// El mismo proveedor tiene DOS puertas en RapidAPI, y se vio con dos
// respuestas: «Cardmarket API TCG» (cardmarket-api-tcg.p.rapidapi.com,
// rutas /v1/tcgapi/{game}/…, la del PDF) contestó 403 «no estás suscrito»;
// «Pokémon TCG API» (pokemon-tcg-api.p.rapidapi.com, las mismas rutas sin
// ese prefijo) contestó 404 a la ruta larga — y un 404 solo llega si la
// suscripción ha pasado. La base de serie es la segunda, que es a la que
// PINGU está suscrito; `TCGGO_BASE` en Netlify la cambia sin desplegar
// (por ejemplo https://cardmarket-api-tcg.p.rapidapi.com/v1/tcgapi/pokemon).
export const HOST = 'pokemon-tcg-api.p.rapidapi.com'
export const URL_BASE = `https://${HOST}`

// La base que manda: la variable de entorno si está, si no la de serie.
// Sin barra final, y el host de la cabecera sale de ella.
export function baseDe(env = {}) {
  const base = String(env?.TCGGO_BASE || URL_BASE).trim().replace(/\/+$/, '')
  let host = HOST
  try { host = new URL(base).host } catch { /* una base rota se queda con el host de serie */ }
  return { base, host }
}
export const POR_PAGINA_CARTAS = 100

export function cabeceras(clave, host = HOST) {
  return { 'x-rapidapi-key': clave, 'x-rapidapi-host': host, accept: 'application/json' }
}

export const urlEpisodios = (pagina = 1, base = URL_BASE) => `${base}/episodes?page=${pagina}`
// `/cards?episode_id=` y no `/episodes/{id}/cards`: en su documentación el
// primero es el que enseña `cardmarket_id` en la respuesta; el ejemplo del
// segundo no lo trae, y no se da por hecho lo que un ejemplo no enseña.
export const urlCartasDeEpisodio = (idEpisodio, pagina = 1, base = URL_BASE) => `${base}/cards?episode_id=${idEpisodio}&per_page=${POR_PAGINA_CARTAS}&page=${pagina}`

// ¿Quedan páginas? Su `paging` es { current, total, per_page }.
export function hayMasPaginas(respuesta) {
  const p = respuesta?.paging
  if (p && Number.isFinite(Number(p.total)) && Number.isFinite(Number(p.current))) return Number(p.current) < Number(p.total)
  return false
}

export const codigoComparable = (c) => String(c || '').trim().toUpperCase()
const nombreComparable = (n) => normalizeSearch(String(n || '').replace(/&/g, 'and')).replace(/\s+/g, ' ').trim()

// Lo que guardamos de cada expansión suya (de las ~170, solo lo que hace
// falta para reconocerla y pedir sus cartas).
export function resumirEpisodio(e) {
  return { id: e.id, nombre: e.name || '', codigo: e.code || null, cartas: e.cards_total ?? null, fecha: e.released_at || null }
}

// Qué expansión suya es un set nuestro. Primero por el CÓDIGO de TCG Live
// («PRE», «CRZ»), que es lo que llevan nuestro `tcg_online_code` y su
// `code`; si el código no está o no casa, por el nombre inglés. Varios sets
// nuestros pueden caer en la misma expansión (Crown Zenith y su Galarian
// Gallery llevan los dos «CRZ»): es lo esperado, porque allí las GG viven
// dentro de la expansión madre con su número «gg12», y el número las
// separa.
export function episodioDeSet(set, episodios) {
  const codigo = codigoComparable(set?.tcg_online_code)
  if (codigo) {
    const porCodigo = (episodios || []).filter((e) => codigoComparable(e.codigo) === codigo)
    if (porCodigo.length === 1) return { episodio: porCodigo[0], por: 'codigo' }
    if (porCodigo.length > 1) {
      const porNombre = porCodigo.filter((e) => nombreComparable(e.nombre) === nombreComparable(set.name_en || set.name))
      if (porNombre.length === 1) return { episodio: porNombre[0], por: 'codigo+nombre' }
      return { episodio: null, porque: `${porCodigo.length} expansiones suyas con el código ${codigo}: ${porCodigo.map((e) => `${e.id} ${e.nombre}`).join(', ')}` }
    }
  }
  const nombres = [set?.name_en, set?.name].map(nombreComparable).filter(Boolean)
  const porNombre = (episodios || []).filter((e) => nombres.includes(nombreComparable(e.nombre)))
  if (porNombre.length === 1) return { episodio: porNombre[0], por: 'nombre' }
  if (porNombre.length > 1) return { episodio: null, porque: `${porNombre.length} expansiones suyas con ese nombre` }
  return { episodio: null, porque: codigo ? `ninguna expansión suya con el código ${codigo} ni el nombre «${set.name_en || set.name}»` : `nuestro set no tiene código de TCG Live y ninguna expansión suya se llama «${set.name_en || set.name}»` }
}

// Empareja las cartas de UN set nuestro con las de SU expansión, por
// número. Devuelve pares (id nuestro → cardmarket_id y tcgplayer_id) y las
// que se quedan sin par, con el motivo: no hay carta suya con ese número,
// o la hay pero sin `cardmarket_id`.
export function emparejarPorNumero(cartas, suyas) {
  const porNumero = new Map()
  for (const s of suyas || []) {
    const n = numeroComparable(s.card_number)
    if (!n) continue
    if (!porNumero.has(n)) porNumero.set(n, [])
    porNumero.get(n).push(s)
  }
  const pares = []
  const sinPar = []
  const usados = new Set()
  for (const c of cartas || []) {
    const n = numeroComparable(c.local_id)
    const candidatas = porNumero.get(n) || []
    if (!candidatas.length) {
      sinPar.push({ id: c.id, numero: String(c.local_id ?? ''), porque: 'ninguna carta suya con ese número' })
      continue
    }
    if (candidatas.length > 1) {
      sinPar.push({ id: c.id, numero: String(c.local_id ?? ''), porque: `${candidatas.length} cartas suyas con ese número` })
      continue
    }
    const s = candidatas[0]
    const idProduct = Number(s.cardmarket_id)
    if (!Number.isInteger(idProduct) || idProduct <= 0) {
      sinPar.push({ id: c.id, numero: String(c.local_id ?? ''), porque: 'TCGGO no le da id de Cardmarket' })
      continue
    }
    usados.add(s.id)
    pares.push({ id: c.id, numero: String(c.local_id ?? ''), idProduct, tcgplayerId: Number(s.tcgplayer_id) || null, tcggoId: s.id ?? null, tcgid: s.tcgid || null })
  }
  return { pares, sinPar, sobran: (suyas || []).length - usados.size }
}

// Cómo contesta RapidAPI cuando se acaba el plan: 429 (límite por segundo
// o por mes) o 403 («You have exceeded the MONTHLY quota»). Con cualquiera
// de los dos la pasada PARA: seguir pidiendo es seguir gastando.
export function esLimiteDelPlan(estado, texto = '') {
  return estado === 429 || (estado === 403 && /quota|limit|exceeded/i.test(String(texto)))
}

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

// La puerta de RapidAPI, que costó cuatro peticiones de 404 encontrar: el
// PDF describe el servidor por dentro (/v1/tcgapi/{game}/…) y RapidAPI
// publica las rutas SIN ese prefijo: /pokemon/episodes, /pokemon/cards,
// /pokemon/episodes/{id}/cards (lo dice la ficha de la API en RapidAPI,
// «Getting Started», no el PDF). El mismo proveedor tiene otra puerta,
// «Pokémon TCG API» (pokemon-tcg-api.p.rapidapi.com, rutas sin /pokemon),
// que no es a la que está suscrito PINGU. `TCGGO_BASE` en Netlify cambia
// la base sin desplegar, y el host de la cabecera sale de ella.
export const HOST = 'cardmarket-api-tcg.p.rapidapi.com'
export const URL_BASE = `https://${HOST}/pokemon`

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
// Sin puntuación: «Celebrations: Classic Collection» es «Celebrations
// Classic Collection», y «HS—Triumphant» se compara como «hs triumphant».
const nombreComparable = (n) => normalizeSearch(String(n || '').replace(/&/g, 'and')).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
const palabrasDe = (n) => nombreComparable(n).split(' ').filter(Boolean)

// Lo que guardamos de cada expansión suya (de las ~170, solo lo que hace
// falta para reconocerla y pedir sus cartas).
export function resumirEpisodio(e) {
  return { id: e.id, nombre: e.name || '', codigo: e.code || null, cartas: e.cards_total ?? null, fecha: e.released_at || null }
}

// Qué expansión suya es un set nuestro. PRIMERO por el nombre inglés
// exacto (sin puntuación), y solo si ningún nombre casa, por el CÓDIGO de
// TCG Live («PRE», «CRZ»: nuestro `tcg_online_code` y su `code`). El orden
// importa y costó 111 pares mal escritos: nuestro «RR» de EX Team Rocket
// Returns es el «RR» de Rising Rivals en TCGGO (ellos abrevian el primero
// «TRR»), y por código la primera pasada mandó Team Rocket Returns a los
// productos de Rising Rivals. Un código es una convención (la 508); un
// nombre exacto no se confunde. Si dos expansiones comparten código,
// decide el nombre; y como último recurso, la única expansión cuyo nombre
// contiene todas las palabras del nuestro («30th Classic Collection» en
// «30th Celebration: Classic Collection»). Varios sets nuestros pueden
// caer en la misma expansión (Crown Zenith y su Galarian Gallery): allí
// las GG viven dentro de la madre con su número «gg12», y el número separa.
// Sets nuestros cuyo nombre no se parece al de la expansión suya donde
// viven sus cartas, uno a uno y con el porqué: en TCGGO las cartas de la
// Classic Collection del 30 aniversario están dentro de «30th Celebration»
// (no hay expansión aparte), igual que las Trainer Gallery dentro de su
// set madre — pero esas se resuelven solas por el código.
export const ALIAS_EPISODIO = {
  '30th-c': '30th Celebration',
}

// Las expansiones que se prueban DESPUÉS si la elegida viene vacía: en
// TCGGO «Astral Radiance Trainer Gallery» existe como expansión pero no
// tiene cartas (viven en «Astral Radiance» con su número TG01), y lo mismo
// las Shiny Vault. Son las del mismo código y las cuyo nombre es el
// principio del nuestro («Hidden Fates» para «Hidden Fates Shiny Vault»).
export function alternativasDe(set, episodios, elegida) {
  const codigo = codigoComparable(set?.tcg_online_code)
  const nuestro = nombreComparable(set?.name_en || set?.name)
  const vistas = new Set(elegida ? [elegida.id] : [])
  const fuera = []
  for (const e of episodios || []) {
    if (vistas.has(e.id)) continue
    const suyo = nombreComparable(e.nombre)
    const mismoCodigo = codigo && codigoComparable(e.codigo) === codigo
    const esPrefijo = suyo && nuestro.startsWith(suyo + ' ')
    if (mismoCodigo || esPrefijo) { vistas.add(e.id); fuera.push(e) }
  }
  // Las de nombre más largo primero (la más específica), y la madre al final.
  return fuera.sort((a, b) => nombreComparable(b.nombre).length - nombreComparable(a.nombre).length)
}

export function episodioDeSet(set, episodios) {
  const alias = ALIAS_EPISODIO[String(set?.id || '')]
  if (alias) {
    const porAlias = (episodios || []).filter((e) => nombreComparable(e.nombre) === nombreComparable(alias))
    if (porAlias.length === 1) return { episodio: porAlias[0], por: 'alias' }
  }
  const nombresNuestros = [set?.name_en, set?.name].map(nombreComparable).filter(Boolean)
  const porNombreExacto = (episodios || []).filter((e) => nombresNuestros.includes(nombreComparable(e.nombre)))
  if (porNombreExacto.length === 1) return { episodio: porNombreExacto[0], por: 'nombre' }
  if (porNombreExacto.length > 1) return { episodio: null, porque: `${porNombreExacto.length} expansiones suyas con ese nombre` }
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
  // Todas nuestras palabras dentro del nombre suyo, y solo una expansión.
  const palabras = palabrasDe(set?.name_en || set?.name)
  if (palabras.length >= 2) {
    const contienen = (episodios || []).filter((e) => { const suyas = palabrasDe(e.nombre); return palabras.every((p) => suyas.includes(p)) })
    if (contienen.length === 1) return { episodio: contienen[0], por: 'palabras' }
  }
  return { episodio: null, porque: codigo ? `ninguna expansión suya con el código ${codigo} ni el nombre «${set.name_en || set.name}»` : `nuestro set no tiene código de TCG Live y ninguna expansión suya se llama «${set.name_en || set.name}»` }
}

// Solo los dígitos de un número: «TG01» → «1», «SV001» → «1», «SWSH001» →
// «1». Para la segunda pasada, cuando los prefijos no coinciden.
const soloDigitos = (n) => numeroComparable(n).replace(/[^0-9]/g, '')
const prefijoDeTcgid = (t) => String(t || '').toLowerCase().replace(/-[^-]*$/, '')

// Empareja las cartas de UN set nuestro con las de SU expansión, en tres
// pasadas, de la llave más fuerte a la más floja, y cada carta se casa una
// sola vez:
//   1. Su `tcgid` es EXACTAMENTE nuestro id (base1-4 = base1-4). Es lo que
//      separa la ilimitada de la 1.ª edición en Base Set, Jungle, Fossil,
//      Team Rocket, Gym y Neo, donde las dos llevan el mismo número: solo
//      una de las dos lleva el id de pokemontcg.io.
//   2. El NÚMERO, cuando es único en los dos lados.
//   3. Solo los DÍGITOS del número, cuando es único en los dos lados entre
//      lo que queda: nuestras Trainer Gallery van «TG01» y las suyas, que
//      viven en una expansión aparte, «1»; las Shiny Vault «SV001» / «1».
// Lo que queda sin par lo dice con el motivo, y si había varias suyas con
// el mismo número, cuáles (para saber qué distingue a las que sobran).
export function emparejarPorNumero(cartas, suyas, { setId = '' } = {}) {
  const pares = []
  const sinPar = []
  const usados = new Set()
  const libres = () => (suyas || []).filter((s) => !usados.has(s.id))
  const casar = (c, s, por) => {
    const idProduct = Number(s.cardmarket_id)
    if (!Number.isInteger(idProduct) || idProduct <= 0) return false
    usados.add(s.id)
    pares.push({ id: c.id, numero: String(c.local_id ?? ''), idProduct, tcgplayerId: Number(s.tcgplayer_id) || null, tcggoId: s.id ?? null, tcgid: s.tcgid || null, por })
    return true
  }
  const pendientes = [...(cartas || [])]
  // 1. tcgid exacto.
  const porTcgid = new Map()
  for (const s of suyas || []) if (s.tcgid) porTcgid.set(String(s.tcgid).toLowerCase(), [...(porTcgid.get(String(s.tcgid).toLowerCase()) || []), s])
  for (let i = pendientes.length - 1; i >= 0; i--) {
    const c = pendientes[i]
    const candidatas = (porTcgid.get(String(c.id).toLowerCase()) || []).filter((s) => !usados.has(s.id))
    if (candidatas.length === 1 && casar(c, candidatas[0], 'tcgid')) pendientes.splice(i, 1)
  }
  // 2 y 3. Número entero; luego solo dígitos.
  for (const [clave, por] of [[numeroComparable, 'numero'], [soloDigitos, 'digitos']]) {
    const porClave = new Map()
    for (const s of libres()) {
      const n = clave(s.card_number)
      if (!n) continue
      porClave.set(n, [...(porClave.get(n) || []), s])
    }
    const nuestrasPorClave = new Map()
    for (const c of pendientes) {
      const n = clave(c.local_id)
      if (n) nuestrasPorClave.set(n, (nuestrasPorClave.get(n) || 0) + 1)
    }
    for (let i = pendientes.length - 1; i >= 0; i--) {
      const c = pendientes[i]
      const n = clave(c.local_id)
      const candidatas = (porClave.get(n) || []).filter((s) => !usados.has(s.id))
      if (candidatas.length !== 1 || nuestrasPorClave.get(n) !== 1) continue
      if (!casar(c, candidatas[0], por)) {
        sinPar.push({ id: c.id, numero: String(c.local_id ?? ''), porque: 'TCGGO no le da id de Cardmarket' })
        pendientes.splice(i, 1)
        continue
      }
      pendientes.splice(i, 1)
    }
  }
  // Lo que queda, con el motivo.
  const porNumeroLibre = new Map()
  const porDigitosLibre = new Map()
  for (const s of libres()) {
    const n = numeroComparable(s.card_number)
    if (n) porNumeroLibre.set(n, [...(porNumeroLibre.get(n) || []), s])
    const d = soloDigitos(s.card_number)
    if (d) porDigitosLibre.set(d, [...(porDigitosLibre.get(d) || []), s])
  }
  const describir = (lista) => lista.map((s) => `«${s.name_numbered || s.name}» ${s.tcgid || 'sin tcgid'}`).join(', ')
  for (const c of pendientes) {
    const exactas = porNumeroLibre.get(numeroComparable(c.local_id)) || []
    const porDigitos = exactas.length ? [] : porDigitosLibre.get(soloDigitos(c.local_id)) || []
    sinPar.push({
      id: c.id,
      numero: String(c.local_id ?? ''),
      porque: exactas.length > 1
        ? `${exactas.length} cartas suyas con ese número: ${describir(exactas)}`
        : porDigitos.length > 1
          ? `${porDigitos.length} cartas suyas con esos dígitos: ${describir(porDigitos)}`
          : porDigitos.length === 1
            ? `una suya con esos dígitos pero otra nuestra también los tiene: ${describir(porDigitos)}`
            : 'ninguna carta suya con ese número',
    })
  }
  pares.sort((a, b) => (/^\d+$/.test(a.numero) && /^\d+$/.test(b.numero) ? Number(a.numero) - Number(b.numero) : a.numero.localeCompare(b.numero)))
  // De qué set dicen ser las suyas, por el prefijo de su tcgid (pl2-12 →
  // «pl2»): el más repetido entre los pares. Sirve para la guarda de la
  // función: si es el id de OTRO set nuestro, la expansión no es esta.
  const cuenta = new Map()
  for (const p of pares) if (p.tcgid) { const pre = prefijoDeTcgid(p.tcgid); cuenta.set(pre, (cuenta.get(pre) || 0) + 1) }
  const [prefijoDominante] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] || [null]
  return { pares, sinPar, sobran: (suyas || []).length - usados.size, prefijoDominante, ejemplosSuyos: libres().slice(0, 6).map((s) => String(s.card_number ?? '')) }
}

// Cómo contesta RapidAPI cuando se acaba el plan: 429 (límite por segundo
// o por mes) o 403 («You have exceeded the MONTHLY quota»). Con cualquiera
// de los dos la pasada PARA: seguir pidiendo es seguir gastando.
export function esLimiteDelPlan(estado, texto = '') {
  return estado === 429 || (estado === 403 && /quota|limit|exceeded/i.test(String(texto)))
}

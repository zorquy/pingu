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
import { rarezaCanonica } from '../../js/rarezas-nombres.js'

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
export const nombreComparable = (n) => normalizeSearch(String(n || '').replace(/&/g, 'and')).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
const palabrasDe = (n) => nombreComparable(n).split(' ').filter(Boolean)

// Lo que guardamos de cada expansión suya (de las ~170, solo lo que hace
// falta para reconocerla y pedir sus cartas).
export function resumirEpisodio(e) {
  return {
    id: e.id, nombre: e.name || '', codigo: e.code || null, cartas: e.cards_total ?? null, fecha: e.released_at || null, logo: typeof e.logo === 'string' ? e.logo : null,
    // Lo IMPRESO en la carta («120» de «125/120») y la serie a la que
    // pertenece (tanda 644): sin la serie un set nuevo caía en «Sin
    // clasificar» en /cartas.
    impresas: Number.isInteger(e.cards_printed_total) ? e.cards_printed_total : null,
    serie: typeof e.series?.name === 'string' && e.series.name.trim() ? e.series.name.trim() : null,
    serieId: typeof e.series?.slug === 'string' && e.series.slug.trim() ? e.series.slug.trim() : null,
    // Lo que vale la expansión entera (646): la suma de sus mínimos en
    // Cardmarket y en TCGplayer, en euros. Es lo que su web enseña como
    // «Valor del set», y cambia cada día.
    valorCm: totalPositivo(e.prices?.cardmarket?.total),
    valorTp: totalPositivo(e.prices?.tcgplayer?.total),
  }
}

const totalPositivo = (x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : null)

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
  // Todas nuestras palabras dentro del nombre suyo, y solo una expansión:
  // «Team Rocket Returns» en «EX Team Rocket Returns». Va ANTES que el
  // código porque ex7 [RR] casó por código con Rising Rivals dos veces
  // seguidas (la guarda del tcgid lo paró la segunda); un nombre entero
  // dentro de otro dice más que una abreviatura que cada catálogo escribe
  // a su manera.
  const palabras = palabrasDe(set?.name_en || set?.name)
  if (palabras.length >= 2) {
    const contienen = (episodios || []).filter((e) => { const suyas = palabrasDe(e.nombre); return palabras.every((p) => suyas.includes(p)) })
    if (contienen.length === 1) return { episodio: contienen[0], por: 'palabras' }
  }
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
  return { episodio: null, porque: codigo ? `ninguna expansión suya con el código ${codigo} ni el nombre «${set.name_en || set.name}»` : `nuestro set no tiene código de TCG Live y ninguna expansión suya se llama «${set.name_en || set.name}»` }
}

// Solo los dígitos de un número: «TG01» → «1», «SV001» → «1», «SWSH001» →
// «1». Para la segunda pasada, cuando los prefijos no coinciden.
export const soloDigitos = (n) => numeroComparable(n).replace(/[^0-9]/g, '')
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
// Y en las pasadas 2 y 3, si hay VARIAS suyas con el mismo número, se queda
// la que tiene un tcgid que acaba en dígitos y las demás no: en las promos
// la sellada va «mepr-MEP001s» (o sin tcgid) y la normal «mepr-MEP001».
// Lo que queda sin par lo dice con el motivo, y si había varias suyas con
// el mismo número, cuáles (para saber qué distingue a las que sobran).
// TCGGO lista en `/cards` lo que VENDE de una expansión, y `type` dice
// qué es: «singles» son cartas sueltas; lo demás (sobres, cajas, lotes)
// no es una carta y no puede casar con ninguna nuestra ni crearse como
// tal (tanda 644). Sin `type` se toma por carta: el campo es suyo y puede
// no venir.
export function esCartaSuelta(c) {
  return !c?.type || String(c.type).toLowerCase() === 'singles'
}

export function emparejarPorNumero(cartas, todasSuyas, { setId = '' } = {}) {
  const suyas = (todasSuyas || []).filter(esCartaSuelta)
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
      let candidatas = (porClave.get(n) || []).filter((s) => !usados.has(s.id))
      if (candidatas.length > 1) {
        const normales = candidatas.filter((s) => /\d$/.test(String(s.tcgid || '')))
        if (normales.length === 1) candidatas = normales
      }
      if (candidatas.length !== 1 || nuestrasPorClave.get(n) !== 1) continue
      if (!casar(c, candidatas[0], por)) {
        sinPar.push({ id: c.id, numero: String(c.local_id ?? ''), porque: 'TCGGO no le da id de Cardmarket' })
        pendientes.splice(i, 1)
        continue
      }
      pendientes.splice(i, 1)
    }
  }
  // 4. Por NOMBRE, cuando el número no dice nada (652). El 30 aniversario
  // de TCGGO lleva dentro la Classic Collection, y sus números no son los
  // nuestros: TCGdex numera la Classic 001–030 y TCGGO la numera como la
  // carta original («Charizard 4/102», «Zacian V SSH138»). Por número no
  // casaba ni una, así que el catálogo las creó por SEGUNDA vez en el set
  // del Celebration —y las nuestras, sin foto, caían al respaldo de
  // Limitless por código + número, que con «30C» y «001» devuelve el
  // Exeggcute. Lo que queda sin casar por los tres pasos de arriba se casa
  // por el nombre inglés, solo cuando es ÚNICO en los dos lados entre lo
  // que queda: es la misma regla de unicidad que el número.
  const porNombre = new Map()
  for (const s of libres()) {
    const n = nombreComparable(s.name)
    if (n) porNombre.set(n, [...(porNombre.get(n) || []), s])
  }
  const nuestrasPorNombre = new Map()
  for (const c of pendientes) {
    const n = nombreComparable(c.name_en || c.name)
    if (n) nuestrasPorNombre.set(n, (nuestrasPorNombre.get(n) || 0) + 1)
  }
  for (let i = pendientes.length - 1; i >= 0; i--) {
    const c = pendientes[i]
    const n = nombreComparable(c.name_en || c.name)
    if (!n) continue
    const candidatas = (porNombre.get(n) || []).filter((s) => !usados.has(s.id))
    if (candidatas.length !== 1 || nuestrasPorNombre.get(n) !== 1) continue
    if (!casar(c, candidatas[0], 'nombre')) {
      sinPar.push({ id: c.id, numero: String(c.local_id ?? ''), porque: 'TCGGO no le da id de Cardmarket' })
      pendientes.splice(i, 1)
      continue
    }
    pendientes.splice(i, 1)
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
  return { pares, sinPar, sobran: suyas.length - usados.size, descartadas: (todasSuyas || []).length - suyas.length, prefijoDominante, ejemplosSuyos: libres().slice(0, 6).map((s) => String(s.card_number ?? '')) }
}

// Cómo contesta RapidAPI cuando se acaba el plan: 429 (límite por segundo
// o por mes) o 403 («You have exceeded the MONTHLY quota»). Con cualquiera
// de los dos la pasada PARA: seguir pidiendo es seguir gastando.
export function esLimiteDelPlan(estado, texto = '') {
  return estado === 429 || (estado === 403 && /quota|limit|exceeded/i.test(String(texto)))
}

// ── De una carta suya a nuestra fila de precios (tanda 589) ──
//
// Lo que TCGGO da por carta y NADIE más daba: el mínimo Near Mint de
// Cardmarket EN CADA IDIOMA (`lowest_near_mint` a secas es el general,
// que coincide con el inglés en su propia web; `_DE`, `_FR`, `_ES`, `_IT`
// los demás), las medias, cuántas hay a la venta, TCGplayer ya en euros,
// y las gradeadas (Cardmarket en euros, eBay en dólares). Un cero o un
// nulo se guarda como null: un precio que no está no vale cero.
const positivo = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
// `graded` viene como `[]` cuando no hay nada y como objeto cuando hay:
// solo el objeto con algo dentro se guarda.
const objetoOnull = (v) => (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length ? v : null)

export function filaDePreciosTcggo(cardId, carta, { ahora = new Date(), mercado = 'WEST' } = {}) {
  const cm = carta?.prices?.cardmarket || {}
  const tp = carta?.prices?.tcg_player || {}
  const ebay = carta?.prices?.ebay || {}
  const idProduct = Number(carta?.cardmarket_id)
  // El coreano y el chino (671): su catálogo japonés da los mínimos de las
  // impresiones coreana y china al lado de la japonesa (en su web, «Korean
  // 8,00 € · Chinese 8,50 €»). No tenemos su JSON delante —PINGU no pudo
  // pedirlo: su clave del playground es BASIC—, así que se leen las
  // grafías que un catálogo puede usar y la primera que traiga cifra vale.
  const primera = (claves) => { for (const k of claves) { const v = positivo(cm[k]); if (v != null) return v } return null }
  return {
    card_id: cardId,
    ...(Number.isInteger(idProduct) && idProduct > 0 ? { cm_id_product: idProduct } : {}),
    cm_low: positivo(cm.lowest_near_mint),
    // En el mercado JP el general ES el japonés (ver cm_low_ja): escribirlo
    // como inglés afirmaba un precio inglés de una impresión japonesa (671).
    cm_low_en: mercado === 'JP' ? primera(['lowest_near_mint_EN']) : positivo(cm.lowest_near_mint),
    cm_low_de: positivo(cm.lowest_near_mint_DE),
    cm_low_fr: positivo(cm.lowest_near_mint_FR),
    cm_low_es: positivo(cm.lowest_near_mint_ES),
    cm_low_it: positivo(cm.lowest_near_mint_IT),
    // El japonés (642): su catálogo japonés lo da como `_JP`; y si una carta
    // del mercado JP solo trae el general, ese general ES el japonés.
    cm_low_ja: positivo(cm.lowest_near_mint_JP) ?? (mercado === 'JP' ? positivo(cm.lowest_near_mint) : null),
    cm_low_ko: primera(['lowest_near_mint_KR', 'lowest_near_mint_KO', 'lowest_near_mint_KOR']),
    cm_low_zh: primera(['lowest_near_mint_CN', 'lowest_near_mint_ZH', 'lowest_near_mint_TW', 'lowest_near_mint_TC', 'lowest_near_mint_SC', 'lowest_near_mint_CHT', 'lowest_near_mint_CHS', 'lowest_near_mint_CH']),
    cm_avg30: positivo(cm['30d_average']),
    cm_avg7: positivo(cm['7d_average']),
    cm_disponibles: Number.isInteger(cm.available_items) ? cm.available_items : null,
    cm_gradeadas: objetoOnull(cm.graded),
    ebay_gradeadas: objetoOnull(ebay.graded),
    tp_market_eur: tp.currency === 'EUR' ? positivo(tp.market_price) : null,
    tp_mid_eur: tp.currency === 'EUR' ? positivo(tp.mid_price) : null,
    tcggo_id: Number.isInteger(carta?.id) ? carta.id : null,
    tcggo_updated: ahora.toISOString(),
    origen: 'tcggo',
    checked_at: ahora.toISOString(),
  }
}

// Lo que se escribe de un set a partir de SU expansión: el logo, su id, y
// la fecha y el total solo si los nuestros están vacíos (lo decide la
// función de la base).
export function filaDeSetTcggo(setId, episodio) {
  return {
    id: setId,
    tcggo_id: Number.isInteger(episodio?.id) ? episodio.id : null,
    logo: typeof episodio?.logo === 'string' && /^https?:\/\//.test(episodio.logo) ? episodio.logo : null,
    fecha: typeof episodio?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(episodio.fecha) ? episodio.fecha.slice(0, 10) : null,
    cartas: Number.isInteger(episodio?.cartas) && episodio.cartas > 0 ? episodio.cartas : null,
    impresas: Number.isInteger(episodio?.impresas) && episodio.impresas > 0 ? episodio.impresas : null,
    valor_cm: totalPositivo(episodio?.valorCm),
    valor_tp: totalPositivo(episodio?.valorTp),
  }
}

// ── El catálogo desde TCGGO (tanda 640) ──

// El catálogo japonés es otro «juego» en su API: `/pokemon-jp/…`. La base
// de serie acaba en `/pokemon`; la japonesa se saca de ella para que
// TCGGO_BASE siga valiendo para las dos.
export function baseJpDe(base) {
  return String(base || '').replace(/\/pokemon$/, '/pokemon-jp')
}

// Su «supertype» a nuestra categoría (la de TCGdex: Pokemon | Trainer | Energy).
export function categoriaDe(supertype) {
  const s = String(supertype || '').toLowerCase()
  if (/pok/.test(s)) return 'Pokemon'
  if (/trainer|entrenador/.test(s)) return 'Trainer'
  if (/energ/.test(s)) return 'Energy'
  return null
}

// El id de un set que TCGGO tiene y nosotros no: su código en minúsculas
// si lo tiene y no está cogido (es lo que más se parece a los ids de
// TCGdex: «sv1a», «pbl»), y si no, «tg-<id suyo>».
export function idDeSetNuevo(episodio, idsNuestros) {
  const cogidos = new Set([...(idsNuestros || [])].map((x) => String(x).toLowerCase()))
  const codigo = String(episodio?.codigo || '').trim().toLowerCase().replace(/[^a-z0-9.-]/g, '')
  if (codigo && !cogidos.has(codigo)) return codigo
  return `tg-${episodio?.id}`
}

// La serie (la «era» de /cartas) de una expansión suya, en NUESTROS
// términos: si ya tenemos un set cuya serie se llama igual en inglés —o
// en el nombre a secas—, la suya es esa misma (`serie_id` incluido, que es
// lo que cruza con `tcg_eras`). Si no, la serie es nueva y entra con su
// slug por id y su nombre como inglés: mejor una era nueva con nombre que
// «Sin clasificar».
export function serieDeEpisodio(episodio, sets) {
  const nombre = nombreComparable(episodio?.serie)
  if (!nombre) return null
  const nuestro = (sets || []).find((s) => [s.serie_name_en, s.serie_name].map(nombreComparable).includes(nombre) && s.serie_id)
  if (nuestro) return { serie_id: nuestro.serie_id, serie_name: nuestro.serie_name || null, serie_name_en: nuestro.serie_name_en || null, por: 'nuestra' }
  return { serie_id: episodio?.serieId || null, serie_name: null, serie_name_en: episodio.serie, por: 'nueva' }
}

export function filaDeSetNuevo(episodio, idsNuestros, serie = null) {
  return {
    id: idDeSetNuevo(episodio, idsNuestros),
    name: episodio?.nombre || `Expansión ${episodio?.id}`,
    name_en: episodio?.nombre || null,
    tcg_online_code: episodio?.codigo || null,
    release_date: typeof episodio?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(episodio.fecha) ? episodio.fecha.slice(0, 10) : null,
    card_count_total: Number.isInteger(episodio?.cartas) && episodio.cartas > 0 ? episodio.cartas : null,
    card_count_official: Number.isInteger(episodio?.impresas) && episodio.impresas > 0 ? episodio.impresas : null,
    serie_id: serie?.serie_id || null,
    serie_name: serie?.serie_name || null,
    serie_name_en: serie?.serie_name_en || null,
    logo_tcggo: typeof episodio?.logo === 'string' && /^https?:\/\//.test(episodio.logo) ? episodio.logo : null,
    tcggo_id: episodio?.id ?? null,
  }
}

// De una carta suya a la fila de `tcggo_guardar_cartas`. Con `nuestra`
// (la carta que ya tenemos) se conserva NUESTRO id, número y nombre —son
// la llave de las colecciones— y solo se añade lo de TCGGO; sin ella, la
// carta se crea con id «tcggo-<id suyo>».
export function filaDeCartaTcggo(carta, { setId, nuestra = null } = {}) {
  const cm = Number(carta?.cardmarket_id)
  const tp = Number(carta?.tcgplayer_id)
  const hp = Number(carta?.hp)
  return {
    id: nuestra?.id || `tcggo-${carta?.id}`,
    set_id: nuestra?.set_id || setId,
    local_id: nuestra?.local_id ?? String(carta?.card_number ?? ''),
    name: nuestra?.name || carta?.name || `tcggo-${carta?.id}`,
    name_en: carta?.name || null,
    tcggo_id: Number.isInteger(carta?.id) ? carta.id : null,
    image_tcggo: typeof carta?.image === 'string' && /^https?:\/\//.test(carta.image) ? carta.image : null,
    cm_id_product: Number.isInteger(cm) && cm > 0 ? cm : null,
    tp_id_product: Number.isInteger(tp) && tp > 0 ? tp : null,
    rarity_en: rarezaCanonica(carta?.rarity),
    hp: Number.isInteger(hp) && hp > 0 ? hp : null,
    illustrator: typeof carta?.artist?.name === 'string' && carta.artist.name.trim() ? carta.artist.name.trim() : null,
    category: categoriaDe(carta?.supertype),
  }
}

// Qué set nuestro es una expansión suya (al revés que `episodioDeSet`):
// por el código (sin caja), si no por el nombre inglés exacto, y solo si
// hay UNO. Es para el catálogo japonés, donde no hay pares de antes: allí
// nuestros ids de TCGdex («SV1a») SON sus códigos.
export function setDeEpisodio(episodio, sets) {
  const codigo = codigoComparable(episodio?.codigo)
  if (codigo) {
    const porCodigo = (sets || []).filter((s) => codigoComparable(s.tcg_online_code) === codigo || codigoComparable(s.id) === codigo)
    if (porCodigo.length === 1) return { set: porCodigo[0], por: 'codigo' }
    if (porCodigo.length > 1) return { set: null, porque: `${porCodigo.length} sets nuestros con el código ${codigo}` }
  }
  const nombre = nombreComparable(episodio?.nombre)
  if (nombre) {
    const porNombre = (sets || []).filter((s) => [s.name_en, s.name].map(nombreComparable).includes(nombre))
    if (porNombre.length === 1) return { set: porNombre[0], por: 'nombre' }
    if (porNombre.length > 1) return { set: null, porque: `${porNombre.length} sets nuestros con ese nombre` }
  }
  return { set: null, porque: 'ninguno nuestro con ese código ni ese nombre' }
}

// ── El histórico de precios de una carta (tanda 643) ──

// `/history-prices?cardmarket_id=…`: el histórico por el id de Cardmarket,
// que es el que decidimos nosotros. Del más antiguo al más nuevo; una
// página son 30 fechas, que son dos o tres meses de muestras.
export const urlHistorial = (idProduct, base = URL_BASE) => `${base}/history-prices?cardmarket_id=${idProduct}&sort=asc`

// Su respuesta es un objeto por fecha: { "2026-09-11": { cm_low, cm_low_de,
// cm_low_fr, cm_low_es, cm_low_it, tcg_player_market } }. No hay `_en`: el
// `cm_low` a secas es el general, que en su web es el inglés. Una fila por
// fecha, con lo que haya; una fecha sin ninguna cifra no se guarda.
export function filasDeHistorial(cardId, respuesta) {
  const datos = respuesta?.data && typeof respuesta.data === 'object' && !Array.isArray(respuesta.data) ? respuesta.data : {}
  const fuera = []
  for (const [dia, v] of Object.entries(datos)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !v || typeof v !== 'object') continue
    const fila = {
      card_id: cardId,
      dia,
      cm_low: positivo(v.cm_low),
      cm_low_en: positivo(v.cm_low),
      cm_low_es: positivo(v.cm_low_es),
      cm_low_de: positivo(v.cm_low_de),
      cm_low_fr: positivo(v.cm_low_fr),
      cm_low_it: positivo(v.cm_low_it),
      cm_low_ja: positivo(v.cm_low_jp ?? v.cm_low_ja),
      tp_market_eur: positivo(v.tcg_player_market),
      origen: 'tcggo',
    }
    if (fila.cm_low || fila.cm_low_es || fila.cm_low_de || fila.cm_low_fr || fila.cm_low_it || fila.cm_low_ja || fila.tp_market_eur) fuera.push(fila)
  }
  return fuera.sort((a, b) => a.dia.localeCompare(b.dia))
}

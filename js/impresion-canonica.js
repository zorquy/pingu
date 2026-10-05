// Qué impresión se ENSEÑA de cada carta de una lista (tanda 413).
//
// PINGU: «cuando enseñes las listas de los jugadores, que salgan las
// cartas con su rareza más baja y de la misma colección: que no salgan
// distintos reprints».
//
// Una lista de TCG Live trae la impresión que tiene cada jugador. Y la
// gente juega con lo que tiene: el «Mega-Lucario ex MEG 179» es la
// ilustración especial, y al lado el mismo Mega-Lucario de la promo
// MEP 33. En pantalla eran dos cartas distintas —dos dibujos— para lo que
// es UNA carta con cuatro copias.
//
// Dos reglas, y las dos con cuidado de no cambiar de carta:
//
//   1. LA RAREZA MÁS BAJA, DENTRO DE SU COLECCIÓN. Las rarezas altas de un
//      set (ilustración, ilustración especial, ultra, hiper) van numeradas
//      DESPUÉS de la colección oficial: MEG tiene 132 cartas y el
//      Mega-Lucario de ilustración especial es el 179. Así que si el número
//      pasa del oficial, se busca la misma carta en el mismo set DENTRO del
//      oficial (el 077, la Rara Doble). La rareza no se lee de la columna
//      `rarity`: viene mitad en inglés y mitad en español («Uncommon»,
//      «Común», «Rara Doble») y a medio rellenar; el número es fiable.
//      Un número DENTRO del oficial no se toca nunca: dos Pokémon distintos
//      con el mismo nombre en el mismo set existen, y los dos están dentro.
//
//   2. UNA SOLA COLECCIÓN POR CARTA. Si la lista trae la misma carta de dos
//      sets, se junta en una casilla con la impresión de un solo set. Para
//      un Entrenador o una Energía el nombre ES la carta (mismo texto); un
//      Pokémon con el mismo nombre puede tener otros ataques, así que solo
//      se junta si los ataques coinciden — y sin datos de ataques, no.
//
// Sin DOM y sin Supabase: se prueba en Node. Quien trae las cartas de la
// base es js/impresiones-del-set.js.
import { rangoDeCarta } from './rareza-escala.js'

// El orden de un número de colección: los numéricos primero y por valor
// («77» antes que «179»), los que llevan letras después («TG05», «GG10»).
export function ordenDeNumero(localId) {
  const s = String(localId ?? '').trim()
  return /^\d+$/.test(s) ? [0, Number(s), s] : [1, Number.POSITIVE_INFINITY, s.toUpperCase()]
}

function compararNumeros(a, b) {
  const [ga, na, sa] = ordenDeNumero(a)
  const [gb, nb, sb] = ordenDeNumero(b)
  if (ga !== gb) return ga - gb
  if (na !== nb) return na - nb
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

// ¿Está fuera de la colección oficial? Solo se sabe con un número a secas
// y una cuenta oficial conocida: sin ellos NO se afirma nada (un set con
// la cuenta a 0 —las promos, la Classic Collection— no tiene «fuera»).
export function fueraDeLaColeccion(carta, oficiales) {
  const [grupo, n] = ordenDeNumero(carta?.local_id)
  const tope = Number(oficiales) || 0
  if (!tope) return false
  return grupo === 1 || n > tope
}

const ataquesDe = (c) =>
  (Array.isArray(c?.attacks) ? c.attacks : [])
    .map((a) => String(a?.name || '').trim().toLowerCase())
    .filter(Boolean)
    .join('|')

const esPokemon = (c) => /^pok/i.test(String(c?.category || ''))

// ¿Son la misma carta? Mismo nombre canónico siempre. Un Pokémon, además,
// con los mismos ataques; y si a alguna de las dos no le sabemos los
// ataques, se dice que NO — juntar dos Pokémon distintos sería enseñar
// una lista que no es la que se jugó.
export function mismaCarta(a, b) {
  if (!a || !b || !a.name_key || a.name_key !== b.name_key) return false
  if (!esPokemon(a) && !esPokemon(b)) return true
  const [x, y] = [ataquesDe(a), ataquesDe(b)]
  return Boolean(x) && x === y
}

// Regla 1: la impresión base de `carta` entre las de su set (`delSet`,
// las que la base ha devuelto con su mismo nombre canónico).
export function impresionBase(carta, delSet, oficiales) {
  if (!carta || !fueraDeLaColeccion(carta, oficiales)) return carta
  const candidatas = (delSet || []).filter(
    (c) => c.set_id === carta.set_id && c.id !== carta.id && !fueraDeLaColeccion(c, oficiales) && mismaCarta(c, carta)
  )
  if (!candidatas.length) return carta
  return [...candidatas].sort((a, b) => compararNumeros(a.local_id, b.local_id))[0]
}

// Las promos no ganan a una colección: son la misma carta con otro sello,
// y casi siempre la que se ve en las listas de los demás es la del set.
export function esColeccionDePromos(setId, codigo = '') {
  const c = String(codigo || '').toUpperCase()
  return /^PR-/.test(c) || /^(SVP|MEP|SWSHP|SMP|XYP|BWP|SP)$/.test(c) || /(^|[a-z])p$/i.test(String(setId || ''))
}

// Regla 2: junta las entradas que son la misma carta en sets distintos.
//
// `entradas` = [{ carta, n, ... }] (lo que quiera llevar cada una viaja
// con ella). Devuelve otras tantas o menos, con `n` sumado y la carta de
// la colección elegida: no promo antes que promo, después la que más
// copias trae, y a igualdad la que aparecía antes en la lista.
export function juntarReimpresiones(entradas, codigoDeSet = () => '') {
  const grupos = []
  for (const e of entradas || []) {
    // La misma impresión (la regla 1 puede haber llevado dos líneas del
    // mismo set a la misma carta) es siempre la misma carta, sepamos o no
    // sus ataques.
    const g = e.carta ? grupos.find((x) => x.some((o) => o.carta && (o.carta.id === e.carta.id || mismaCarta(o.carta, e.carta)))) : null
    if (g) g.push(e)
    else grupos.push([e])
  }
  return grupos.map((g) => {
    if (g.length === 1) return g[0]
    const elegida = [...g].sort((a, b) => {
      const pa = esColeccionDePromos(a.carta?.set_id, codigoDeSet(a.carta?.set_id)) ? 1 : 0
      const pb = esColeccionDePromos(b.carta?.set_id, codigoDeSet(b.carta?.set_id)) ? 1 : 0
      if (pa !== pb) return pa - pb
      return (Number(b.n) || 0) - (Number(a.n) || 0) || g.indexOf(a) - g.indexOf(b)
    })[0]
    return { ...elegida, n: g.reduce((s, x) => s + (Number(x.n) || 0), 0), juntadas: g.length }
  })
}

// ════════════════════════════════════════════════════════════════════
// Regla 0: LA RAREZA MÁS BAJA, EN CUALQUIER COLECCIÓN (tanda 624)
// ════════════════════════════════════════════════════════════════════
//
// PINGU: «en las repeticiones no salen las cartas con su mínima rareza;
// deberíamos seguir un estándar para todas las cartas». La regla 1 mira
// dentro del set y por el número, y no basta: el «Interruptor de Energía»
// que se resolvía por el nombre era el de ME05 107, una Ultra Rara, con el
// de ME01 115 —Común, la misma carta— al lado. Y es la carta que se juega:
// el reglamento cuenta las reimpresiones como la misma.
//
// La escala es la de toda la web (js/rareza-escala.js), la misma que
// ordena una expansión en /mi-coleccion. La rareza se lee de `rarity_en`
// (el inglés exacto) y, si no, de `rarity` (mitad inglés, mitad español):
// «Ultra Rara» en español vale lo mismo para un GX normal («Rare Holo GX»)
// que para su arte completo («Rare Ultra»).
//
// Y una impresión cuya rareza NO se sabe no es «más baja» que nada: lo que
// no se sabe no se afirma. Así se quedan fuera, sin una regla aparte, las
// de TCG Pocket que hay en el catálogo («Poción» de P-A, sin rareza): no
// son del juego de cartas, y la escala no reconoce sus diamantes.
//
// La promo va entre la Rara y la Rara Holo: una línea que trae la promo de
// un objeto se enseña con su impresión común, pero la promo de un Pokémon
// ex no se cambia por su Rara Doble, que no es «más común».
const RANGO_DE_PROMO = 3.5
const limpio = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

// Las colecciones de TCG Pocket, por si un día la escala aprende sus
// rarezas: P-A, P-B y A1, A1a, A2b… No están en el juego de cartas.
const esDePocket = (c) => /^(P-[A-Z]|[AB]\d+[a-z]?)$/.test(String(c?.set_id || ''))

const esPromo = (c) => /^promo$/i.test(String(c?.rarity_en || c?.rarity || '').trim()) || esColeccionDePromos(c?.set_id)
const tieneImagen = (c) => Boolean(c?.image_path || c?.image_scrydex || c?.image_tcggo)
const nombresDe = (c) => new Set([c?.name_key, limpio(c?.name), limpio(c?.name_es)].filter(Boolean))

// La «forma» de juego de un Pokémon que no depende del idioma: los PS y,
// de cada ataque, cuántas energías cuesta y el número de su daño. Desde la
// 330 los ataques se guardan en español en las cartas engordadas y en
// inglés en las demás, así que por el nombre del ataque dos reimpresiones
// no casaban nunca.
function formaDeJuego(c) {
  const ataques = Array.isArray(c?.attacks) ? c.attacks : null
  if (!ataques?.length) return ''
  return `${Number(c.hp) || 0}·${ataques.map((a) => `${(a?.cost || []).length}:${String(a?.damage ?? '').replace(/\D/g, '')}`).join('|')}`
}

// ¿Son la misma carta, aunque cada fila esté en un idioma? Algún nombre en
// común (el inglés, el español, la clave); y un Pokémon, además, con los
// mismos ataques —por el nombre o por su forma—. Sin ataques no se afirma
// nada, y se dice que no: cambiar a OTRO Pokémon sería enseñar otra carta.
export function mismaCartaEntreIdiomas(a, b) {
  if (!a || !b) return false
  const A = nombresDe(a)
  if (![...nombresDe(b)].some((n) => A.has(n))) return false
  if (![a, b].some(esPokemon)) return true
  if (mismaCarta(a, b)) return true
  const forma = formaDeJuego(a)
  return forma !== '' && forma === formaDeJuego(b)
}

// La impresión de rareza más baja de `carta` entre `candidatas` (sus
// reimpresiones, de cualquier colección). Solo se cambia si hay una de
// rareza ESTRICTAMENTE más baja: a igualdad se queda la que venía, que es
// la que se ha elegido por algo —la que llevan los mazos del meta (tanda
// 590), la que casa con lo que se le ve hacer (481) o la que trae la lista—.
// Una promo no sustituye a una carta de colección (regla 2), y nunca se
// cambia a una sin imagen.
export function impresionMasComun(carta, candidatas, { legales = [], fechaDeSet = () => '' } = {}) {
  if (!carta) return carta
  const rango = (c) => (esPromo(c) ? RANGO_DE_PROMO : rangoDeCarta(c))
  const marca = (c) => String(c.regulation_mark || '')
  const legal = (c) => legales.includes(marca(c))
  const propia = rango(carta)
  const sinImagen = !tieneImagen(carta)
  const mejores = (candidatas || []).filter((c) => {
    if (!c || c.id === carta.id || !tieneImagen(c) || esDePocket(c)) return false
    if (esPromo(c) && !esPromo(carta)) return false
    // Una carta legal en Estándar no se enseña con una impresión que no lo
    // es: el constructor mira la marca DE LA IMPRESIÓN («Marca G: fuera de
    // Estándar»), así que el mazo pasaría a salir ilegal. Y una carta con
    // marca no se cambia por una de antes de las marcas: el «Cambio» de
    // Espada y Escudo (Infrecuente, D) no pasa a ser el de Base Set de 1999,
    // que es Común — pasa al Común de Escarlata y Púrpura.
    if (legal(carta) && !legal(c)) return false
    if (marca(carta) && !marca(c)) return false
    const r = rango(c)
    if (r == null || !mismaCartaEntreIdiomas(c, carta)) return false
    // Si la propia no se sabe, solo se cambia la que no tiene dibujo.
    return propia == null ? sinImagen : r < propia || (sinImagen && r <= propia)
  })
  if (!mejores.length) return carta
  return [...mejores].sort((a, b) => {
    if (rango(a) !== rango(b)) return rango(a) - rango(b)
    // A igual rareza, de su misma colección si la hay (la regla de la 413:
    // la Rara Doble del set de la ilustración especial que traía la lista).
    const sa = a.set_id === carta.set_id ? 0 : 1
    const sb = b.set_id === carta.set_id ? 0 : 1
    if (sa !== sb) return sa - sb
    const la = legal(a) ? 0 : 1
    const lb = legal(b) ? 0 : 1
    if (la !== lb) return la - lb
    if (marca(a) !== marca(b)) return marca(b).localeCompare(marca(a))
    const fa = String(fechaDeSet(a.set_id) || '')
    const fb = String(fechaDeSet(b.set_id) || '')
    if (fa !== fb) return fb.localeCompare(fa)
    return compararNumeros(a.local_id, b.local_id)
  })[0]
}

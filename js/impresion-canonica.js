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

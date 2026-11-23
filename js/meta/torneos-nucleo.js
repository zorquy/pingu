// Lo puro de «Por torneo» (tandas 1421 y 1422, PINGU eligió lo recomendado
// de «Los mazos, también por torneo»). Sin DOM y sin Supabase: se prueba en
// Node tal cual.
//
// Un torneo es una fila de `meta_torneos` y su clasificación las de
// `meta_resultados` (el mazo de cada jugador, su puesto y, de los de arriba,
// el nombre y la lista). No hay nada guardado aparte: el Top 8, el reparto y
// «el que más rindió» se cuentan al leer.

// Cuántos torneos trae cada página de la lista y cuántos puestos son «Top».
export const POR_PAGINA = 20
export const TOP = 8
// Por debajo de esto «el que más rindió» es ruido: en un torneo de 20, un
// mazo de dos personas con una en el Top «rinde» el triple sin decir nada.
export const MIN_PARA_RENDIMIENTO = 32

const DIA = 86_400_000

// El primer instante del periodo, con la MISMA cuenta que la base
// (`meta_listas` y compañía): el día del torneo en UTC posterior a «hoy menos
// N días». Con otra, la lista de torneos y el ranking dirían cosas distintas
// del mismo periodo (normas/jugar.md, «la misma definición»).
export function desdeDePeriodo(dias, ahora = new Date()) {
  const hoy = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())
  const n = Math.max(1, Math.min(Number(dias) || 14, 365))
  return new Date(hoy - (n - 1) * DIA).toISOString()
}

// La dirección de la ficha: /meta/torneo/<id>. Dos tramos, así que no choca
// con /meta/<arquetipo> (netlify.toml).
export function rutaDeTorneo(id) {
  return `/meta/torneo/${encodeURIComponent(String(id || ''))}`
}

export function idDeTorneoEnRuta(pathname, search = '') {
  const m = String(pathname || '').match(/^\/meta\/torneo\/([^/?#]+)/)
  if (m) {
    try { return decodeURIComponent(m[1]) } catch { return m[1] }
  }
  return new URLSearchParams(search).get('t') || ''
}

// El Top de cada torneo, de las filas con puesto (las de la lista llegan
// solo con `puesto <= TOP`). Un puesto repetido (dos 5.º) se queda: es como
// lo da Limitless con el Top 8 sin jugar los cruces.
export function topPorTorneo(filas, top = TOP) {
  const fuera = new Map()
  for (const f of filas || []) {
    const p = Number(f.puesto)
    if (!(p >= 1 && p <= top)) continue
    if (!fuera.has(f.torneo_id)) fuera.set(f.torneo_id, [])
    fuera.get(f.torneo_id).push(f)
  }
  for (const lista of fuera.values()) lista.sort((a, b) => Number(a.puesto) - Number(b.puesto))
  return fuera
}

// Qué se jugó: cuántos llevaban cada mazo, su cuota y cuántos entraron en el
// Top. Ordenado del más jugado al menos (a igualdad, el que más metió arriba).
export function repartoDe(filas, top = TOP) {
  const cuenta = new Map()
  let total = 0
  for (const f of filas || []) {
    if (!f.arquetipo) continue
    total++
    const c = cuenta.get(f.arquetipo) || { arquetipo: f.arquetipo, n: 0, top: 0 }
    c.n++
    const p = Number(f.puesto)
    if (p >= 1 && p <= top) c.top++
    cuenta.set(f.arquetipo, c)
  }
  return [...cuenta.values()]
    .map((c) => ({ ...c, cuota: total ? (c.n / total) * 100 : 0 }))
    .sort((a, b) => b.n - a.n || b.top - a.top || String(a.arquetipo).localeCompare(String(b.arquetipo)))
}

// «El que más rindió»: el mazo que metió en el Top mucho más de lo que pesaba
// en la sala. Rendimiento = (su parte del Top) / (su parte de la sala). Solo
// con muestra (MIN_PARA_RENDIMIENTO mazos conocidos) y si rinde al menos el
// doble: si no, no se dice nada (un «el que más rindió» de cada torneo, aunque
// sea por poco, sería un titular inventado).
export function elQueMasRindio(reparto, { top = TOP, minimo = MIN_PARA_RENDIMIENTO } = {}) {
  const total = (reparto || []).reduce((s, r) => s + r.n, 0)
  const enTop = (reparto || []).reduce((s, r) => s + r.top, 0)
  if (total < minimo || !enTop) return null
  let mejor = null
  for (const r of reparto) {
    if (!r.top) continue
    const rinde = (r.top / enTop) / (r.n / total)
    if (rinde < 2) continue
    if (!mejor || rinde > mejor.rinde || (rinde === mejor.rinde && r.top > mejor.top)) mejor = { ...r, rinde, enTop: Math.min(enTop, top) }
  }
  return mejor
}

// El récord, solo si lo hay: los oficiales llegan sin él (0-0-0), y un
// «0-0-0» diría que no jugó ninguna partida (lo mismo que la ficha del mazo).
export function resultadoDe(f) {
  const v = Number(f?.victorias) || 0
  const d = Number(f?.derrotas) || 0
  const e = Number(f?.empates) || 0
  return v + d + e > 0 ? `${v}-${d}-${e}` : ''
}

// La chapa de cada torneo: el tipo de los oficiales (Regional, Internacional,
// Especial, Mundial), PokeDoc o Online. `clase` elige el color en meta.css.
export function chapaDeTorneo(t) {
  if (t?.fuente === 'oficial') return { texto: t.tipo || 'Oficial', clase: 'oficial' }
  if (t?.fuente === 'pokedoc') return { texto: 'PokeDoc', clase: 'pokedoc' }
  return { texto: 'Online', clase: 'online' }
}

export function cejaDeTorneo(t) {
  if (t?.fuente === 'oficial') return 'Torneo oficial'
  if (t?.fuente === 'pokedoc') return 'Torneo de PokeDoc'
  return 'Torneo online'
}

// A dónde lleva «Ver el torneo»: la ficha en Limitless (oficiales y online)
// o la de La arena (los de PokeDoc, que guardan su `/torneo?slug=`).
export function enlaceDelTorneo(t) {
  if (!t) return null
  if (t.enlace) {
    const fuera = /^https?:/.test(t.enlace)
    return { url: t.enlace, texto: t.fuente === 'pokedoc' ? 'Ver en La arena' : 'Ver en Limitless', fuera }
  }
  if (t.fuente === 'online' && t.id) return { url: `https://play.limitlesstcg.com/tournament/${encodeURIComponent(t.id)}/standings`, texto: 'Ver en Limitless', fuera: true }
  return null
}

// El nombre que se enseña de un jugador: solo el que la base guarda (los de
// arriba con lista). `jugador` es un id interno («lista-123», «pokedoc-…»)
// y no se enseña nunca.
export function nombreDeJugador(f) {
  return f?.nombre_jugador ? String(f.nombre_jugador) : ''
}

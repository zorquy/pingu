// De un torneo de PokeDoc a la forma que ingiere /meta (tanda 366).
//
// PURO: entran las listas, las mesas con su resultado y el catálogo de
// arquetipos de Limitless, y sale la clasificación en la forma de la API
// de play.limitlesstcg.com. La red y la base van en la función
// (netlify/functions/meta-pokedoc.mjs).
import { dexDeCarta, urlDeSprite, POKEMON_POR_DEX, FORMAS_TCG } from '../../js/torneos/sprites-pokemon.js'
import { arquetipoDeMazo, dexesDeNombre } from '../../js/torneos/arquetipos.js'

// ── El resultado de cada jugador ──
//
// De las mesas y sus resultados (las mismas tablas que pinta la ficha
// del torneo). Un bye es una victoria, como en el motor.
export function resultados(mesas, resultadosPorMesa) {
  const r = new Map()
  const de = (id) => {
    if (!r.has(id)) r.set(id, { v: 0, d: 0, e: 0 })
    return r.get(id)
  }
  for (const m of mesas || []) {
    if (!m?.player_a_id) continue
    const res = resultadosPorMesa.get(m.id)?.result || (m.is_bye ? 'bye' : null)
    if (!res) continue
    const a = de(m.player_a_id)
    const b = m.player_b_id ? de(m.player_b_id) : null
    if (res === 'a_wins' || res === 'bye' || res === 'forfeit_b') {
      a.v++
      if (b) b.d++
    } else if (res === 'b_wins' || res === 'forfeit_a') {
      a.d++
      if (b) b.v++
    } else if (res === 'draw') {
      a.e++
      if (b) b.e++
    } else if (res === 'forfeit_both') {
      a.d++
      if (b) b.d++
    }
  }
  return r
}

// El puesto, por puntos (3 la victoria, 1 el empate) y, a igualdad, por
// victorias. No es el desempate oficial (el motor usa resistencia), pero
// para el meta basta: lo que se mira es quién llegó arriba, y las
// victorias del top cut ya ponen delante a quien lo ganó.
export function puestos(resultadosPorJugador) {
  return [...resultadosPorJugador.entries()]
    .sort(([, a], [, b]) => 3 * b.v + b.e - (3 * a.v + a.e) || b.v - a.v)
    .map(([id], i) => [id, i + 1])
}

// ── En qué arquetipo de Limitless cae un mazo de PokeDoc ──
//
// Por sus POKÉMON, no por el nombre de las cartas: el export de TCG Live
// llega en el idioma del jugador y «Dragapult ex» puede venir como tal o
// traducido. `dexDeCarta` entiende los dos, y los iconos de un arquetipo
// de Limitless («dragapult», «sharpedo-mega») son Pokémon con número.
// Un mazo es de un arquetipo si lleva TODOS sus Pokémon icono; de los que
// casen, gana el que tiene más iconos (el más concreto) y, a igualdad, el
// más jugado.
const DEX_DE_ICONO = new Map()
for (let dex = 1; dex <= POKEMON_POR_DEX.length; dex++) {
  const u = urlDeSprite(dex)
  if (u) DEX_DE_ICONO.set(u.split('/').pop().replace(/\.png$/, ''), dex)
}
for (const f of FORMAS_TCG) {
  const u = urlDeSprite(f.dex)
  if (u) DEX_DE_ICONO.set(u.split('/').pop().replace(/\.png$/, ''), f.dex)
}

export function dexDeIcono(icono) {
  return DEX_DE_ICONO.get(String(icono || '').toLowerCase()) || null
}

function dexesDelMazo(parsed) {
  const s = new Set()
  for (const l of parsed?.pokemon || []) {
    const d = dexDeCarta(l?.name)
    if (d) s.add(d)
  }
  return s
}

// `arquetipos`: [{ id, nombre, iconos: ['dragapult','dusknoir'], mazos }]
export function arquetipoDeLimitless(parsed, arquetipos) {
  const tiene = dexesDelMazo(parsed)
  if (!tiene.size) return null
  let mejor = null
  for (const a of arquetipos || []) {
    const dexes = (a.iconos || []).map(dexDeIcono)
    if (!dexes.length || dexes.some((d) => !d)) continue
    if (!dexes.every((d) => tiene.has(d))) continue
    const puntos = dexes.length * 1e6 + (a.mazos || 0)
    if (!mejor || puntos > mejor.puntos) mejor = { ...a, puntos }
  }
  return mejor
}

// El que no cae en ninguno: la deducción de siempre de PokeDoc (la de
// los torneos, js/torneos/arquetipos.js), con id propio y los iconos
// sacados de sus Pokémon.
export function arquetipoPropio(parsed, catalogo = []) {
  const arq = arquetipoDeMazo(parsed, catalogo)
  const dexes = dexesDeNombre(arq.nombre).slice(0, 2)
  const iconos = dexes.map((d) => urlDeSprite(d)?.split('/').pop().replace(/\.png$/, '')).filter(Boolean)
  const slug = String(arq.id || arq.nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return { id: `pokedoc-${slug || 'mazo'}`, nombre: arq.nombre, iconos }
}

// De { quantity, name, set, number } (parseDecklist del motor) a
// { count, name, set, number } (la forma de Limitless).
export function listaDeLimitless(parsed) {
  const fuera = {}
  for (const sec of ['pokemon', 'trainer', 'energy']) {
    fuera[sec] = (parsed?.[sec] || [])
      .filter((l) => Number(l?.quantity) > 0 && l?.name)
      .map((l) => ({ count: Number(l.quantity), name: String(l.name), set: String(l.set || ''), number: String(l.number || '') }))
  }
  return fuera
}

export function clasificacionDeTorneo({ torneo, listas, mesas, resultadosPorMesa, perfiles, arquetipos, catalogo = [] }) {
  const res = resultados(mesas, resultadosPorMesa)
  // Quien entregó lista pero no jugó ninguna mesa también cuenta (se
  // apuntó con ese mazo), al final.
  for (const l of listas) if (!res.has(l.user_id)) res.set(l.user_id, { v: 0, d: 0, e: 0 })
  const puesto = new Map(puestos(res))
  const conLista = new Map(listas.map((l) => [l.user_id, l]))
  const fuera = []
  for (const [id, p] of puesto) {
    const l = conLista.get(id)
    if (!l?.parsed_cards) continue
    const limitless = arquetipoDeLimitless(l.parsed_cards, arquetipos)
    const arq = limitless ? { id: limitless.id, nombre: limitless.nombre, iconos: limitless.iconos } : arquetipoPropio(l.parsed_cards, catalogo)
    const perfil = perfiles.get(id)
    const r = res.get(id)
    fuera.push({
      player: `pokedoc-${id}`,
      name: perfil?.display_name || perfil?.username || 'Jugador de PokeDoc',
      country: 'ES',
      placing: p,
      record: { wins: r.v, losses: r.d, ties: r.e },
      decklist: listaDeLimitless(l.parsed_cards),
      deck: { id: arq.id, name: arq.nombre, icons: arq.iconos },
      enlace: `/torneo?slug=${encodeURIComponent(torneo.slug)}`,
    })
  }
  return fuera.sort((a, b) => a.placing - b.placing)
}

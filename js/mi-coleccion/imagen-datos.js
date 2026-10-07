// Lo que CUENTAN las variantes de «Mi colección en una imagen» (tanda
// 689), sin DOM y sin Supabase: la pantalla le pasa las líneas y las
// cartas, y esto devuelve los números que cada dibujo pinta. Vive aparte
// de js/mi-coleccion.js para poder probarse en Node con una colección de
// mentira, igual que `variantes.js` o `pokedex.js`.
//
// Todo se cuenta por cartas DISTINTAS, no por copias (la regla del
// reparto de la 405): «tengo 40 de Agua» se entiende, «78 contando
// repetidas» no dice nada de la colección.
import { especiesDeCarta, especiePorDex } from '../pokedex-especies.js'
import { TIPOS_ES, familiaDeBrillo } from '../carta-traducciones.js'
import { rarezaDeCarta } from '../rarezas-nombres.js'

export const TOTAL_POKEDEX = 1025

// Las nueve regiones, con el nombre corto que cabe en una casilla. La
// última no tiene final, como en `pokedex.js`: el día que salga la décima
// cae ahí y no desaparece.
export const REGIONES = [
  { nombre: 'Kanto', desde: 1, hasta: 151 },
  { nombre: 'Johto', desde: 152, hasta: 251 },
  { nombre: 'Hoenn', desde: 252, hasta: 386 },
  { nombre: 'Sinnoh', desde: 387, hasta: 493 },
  { nombre: 'Teselia', desde: 494, hasta: 649 },
  { nombre: 'Kalos', desde: 650, hasta: 721 },
  { nombre: 'Alola', desde: 722, hasta: 809 },
  { nombre: 'Galar', desde: 810, hasta: 905 },
  { nombre: 'Paldea', desde: 906, hasta: Infinity },
]

const especiesDe = (carta) => {
  const dex = (carta?.dex_ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0)
  return dex.length ? dex : especiesDeCarta(carta?.name || carta?.name_es)
}

const fecha = (iso) => {
  const d = new Date(iso || '')
  return Number.isNaN(d.getTime()) ? null : d
}

// Las cartas distintas de la colección, cada una con la PRIMERA vez que
// entró (la línea más antigua) y cuántas copias suman sus líneas.
export function cartasDistintas(lineas, busca) {
  const porCarta = new Map()
  for (const l of lineas || []) {
    const carta = busca(l)
    if (!carta?.id) continue
    const k = `${carta.market || 'WEST'}|${carta.id}`
    const entro = fecha(l.created_at)
    const x = porCarta.get(k) || { carta, copias: 0, entro: null }
    x.copias += Number(l.cantidad) || 1
    if (entro && (!x.entro || entro < x.entro)) x.entro = entro
    porCarta.set(k, x)
  }
  return [...porCarta.values()]
}

// El Pokémon más repetido: la especie con más cartas DISTINTAS.
export function masRepetido(distintas) {
  const cuenta = new Map()
  const sets = new Map()
  for (const { carta } of distintas) {
    for (const dex of especiesDe(carta)) {
      cuenta.set(dex, (cuenta.get(dex) || 0) + 1)
      if (carta.set_id) sets.set(dex, (sets.get(dex) || new Set()).add(carta.set_id))
    }
  }
  const mejor = [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
  if (!mejor || mejor[1] < 2) return null
  return { dex: mejor[0], nombre: especiePorDex(mejor[0]) || `#${mejor[0]}`, veces: mejor[1], expansiones: sets.get(mejor[0])?.size || 0 }
}

// Tu mes: cuántas cartas distintas han entrado en los últimos 30 días,
// las tres últimas y qué expansiones son nuevas (su primera carta entró
// este mes). `nombreDeSet` lo pone quien llama: aquí no hay catálogo.
export function resumenDelMes(distintas, { ahora = new Date(), nombreDeSet = (c) => c?.tcg_sets?.name || c?.set_id || '' } = {}) {
  const desde = new Date(ahora.getTime() - 30 * 86_400_000)
  const conFecha = distintas.filter((x) => x.entro)
  const nuevas = conFecha.filter((x) => x.entro >= desde)
  const primeraPorSet = new Map()
  for (const x of conFecha) {
    const k = `${x.carta.market || 'WEST'}|${x.carta.set_id || ''}`
    if (!x.carta.set_id) continue
    const antes = primeraPorSet.get(k)
    if (!antes || x.entro < antes.entro) primeraPorSet.set(k, x)
  }
  const expansionesNuevas = [...primeraPorSet.values()].filter((x) => x.entro >= desde).sort((a, b) => b.entro - a.entro).map((x) => nombreDeSet(x.carta)).filter(Boolean)
  return {
    nuevas: nuevas.length,
    ultimas: [...nuevas].sort((a, b) => b.entro - a.entro).slice(0, 3).map((x) => x.carta),
    expansionesNuevas: [...new Set(expansionesNuevas)].slice(0, 3),
  }
}

// Tu Pokédex: especies distintas sobre las 1.025, lo que más coleccionas
// por tipo, cuántas por región y la carta más antigua (por la fecha de su
// expansión).
export function resumenDePokedex(distintas) {
  const especies = new Set()
  const tipos = new Map()
  const regiones = REGIONES.map((r) => ({ nombre: r.nombre, cuenta: 0 }))
  let masAntigua = null
  for (const { carta } of distintas) {
    const dex = especiesDe(carta)
    for (const d of dex) {
      especies.add(d)
    }
    // Una carta cuenta en la región de su PRIMERA especie, y una sola vez.
    if (dex[0]) {
      const i = REGIONES.findIndex((r) => dex[0] >= r.desde && dex[0] <= r.hasta)
      if (i >= 0) regiones[i].cuenta++
    }
    const tipo = String(carta.category || '').toLowerCase() === 'trainer' || /^entrenador$/i.test(carta.category || '')
      ? 'Entrenador'
      : String(carta.category || '').toLowerCase() === 'energy' || /^energ/i.test(carta.category || '')
        ? 'Energía'
        : TIPOS_ES[(carta.types || [])[0]] || null
    if (tipo) tipos.set(tipo, (tipos.get(tipo) || 0) + 1)
    const salida = fecha(carta?.tcg_sets?.release_date)
    if (salida && (!masAntigua || salida < masAntigua.salida)) masAntigua = { carta, salida }
  }
  return {
    especies: especies.size,
    total: TOTAL_POKEDEX,
    pct: Math.round((especies.size / TOTAL_POKEDEX) * 1000) / 10,
    tipos: [...tipos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 6).map(([nombre, cuenta]) => ({ nombre, cuenta })),
    regiones,
    masAntigua: masAntigua ? { carta: masAntigua.carta, anio: masAntigua.salida.getFullYear() } : null,
  }
}

// ── Las variantes de la cadena (691) ──
//
// PINGU: «no quiero centrarme en la pasta; que se centre en cuántos
// Pokémon, tu Pokémon, el que más tienes, datos sobre las cartas». Nada
// de aquí mira un precio.

const esPokemon = (c) => !/^(trainer|entrenador|energy|energ)/i.test(String(c?.category || '')) && !c?.trainer_type && !c?.energy_type
const esEntrenador = (c) => /^(trainer|entrenador)/i.test(String(c?.category || '')) || Boolean(c?.trainer_type)
const esEnergia = (c) => /^energ/i.test(String(c?.category || '')) || Boolean(c?.energy_type)

// El equipo de seis: las seis especies con más cartas distintas, cada una
// con en cuántas expansiones y desde qué año. La primera es el líder y
// lleva sus cartas (hasta `cartasDelLider`), para pintarlas debajo.
export function equipoDe6(distintas, { cartasDelLider = 5 } = {}) {
  const porDex = new Map()
  for (const { carta } of distintas) {
    for (const dex of especiesDe(carta)) {
      const x = porDex.get(dex) || { dex, cartas: [], sets: new Set(), desde: null }
      x.cartas.push(carta)
      if (carta.set_id) x.sets.add(carta.set_id)
      const anio = fecha(carta?.tcg_sets?.release_date)?.getFullYear() || null
      if (anio && (!x.desde || anio < x.desde)) x.desde = anio
      porDex.set(dex, x)
    }
  }
  const orden = [...porDex.values()].sort((a, b) => b.cartas.length - a.cartas.length || a.dex - b.dex).slice(0, 6)
  return orden.map((x, i) => ({
    dex: x.dex, nombre: especiePorDex(x.dex) || `#${x.dex}`, cartas: x.cartas.length, expansiones: x.sets.size, desde: x.desde,
    ejemplos: i === 0 ? x.cartas.slice(0, cartasDelLider) : [],
  }))
}

// El viaje en el tiempo: la carta más antigua y la más nueva (por la fecha
// de su expansión), los años entre ellas y cuántas cartas por época (la
// serie de su expansión, hasta `maximoEpocas` barras, en orden de fecha).
const EPOCAS = {
  base: 'Base', gym: 'Gym', neo: 'Neo', ecard: 'e-Card', ex: 'EX', dp: 'DP', pl: 'Platino', hgss: 'HGSS', col: 'CoL',
  bw: 'BW', xy: 'XY', sm: 'SM', swsh: 'SWSH', s: 'SWSH', sv: 'SV', me: 'Mega', pop: 'POP', np: 'Promos',
}
export function viajeEnElTiempo(distintas, { maximoEpocas = 8 } = {}) {
  const conFecha = distintas.map((x) => ({ ...x, salida: fecha(x.carta?.tcg_sets?.release_date) })).filter((x) => x.salida)
  if (!conFecha.length) return null
  const porFecha = [...conFecha].sort((a, b) => a.salida - b.salida)
  const antigua = porFecha[0]
  const nueva = porFecha[porFecha.length - 1]
  const epocas = new Map()
  for (const x of conFecha) {
    const serie = String(x.carta?.tcg_sets?.serie_id || '').toLowerCase()
    const k = serie || 'otras'
    const e = epocas.get(k) || { id: k, nombre: EPOCAS[k] || (serie ? serie.toUpperCase() : 'Otras'), cuenta: 0, desde: x.salida, hasta: x.salida }
    e.cuenta++
    if (x.salida < e.desde) e.desde = x.salida
    if (x.salida > e.hasta) e.hasta = x.salida
    epocas.set(k, e)
  }
  const lista = [...epocas.values()].sort((a, b) => b.cuenta - a.cuenta).slice(0, maximoEpocas).sort((a, b) => a.desde - b.desde)
    .map((e) => ({ id: e.id, nombre: e.nombre, cuenta: e.cuenta, anios: e.desde.getFullYear() === e.hasta.getFullYear() ? String(e.desde.getFullYear()) : `${e.desde.getFullYear()}–${String(e.hasta.getFullYear()).slice(-2)}` }))
  const mejor = [...lista].sort((a, b) => b.cuenta - a.cuenta)[0] || null
  return {
    antigua: { carta: antigua.carta, anio: antigua.salida.getFullYear() },
    nueva: { carta: nueva.carta, anio: nueva.salida.getFullYear() },
    anios: Math.max(0, nueva.salida.getFullYear() - antigua.salida.getFullYear()),
    epocas: lista,
    miEpoca: mejor ? mejor.nombre : null,
  }
}

// Qué coleccionista eres: los rasgos (brillo, reparto, región, tipo,
// fetiche) y UN perfil con nombre, por la primera regla que se cumpla.
// Las reglas están escritas en orden a propósito: la más específica gana.
export const PERFILES = [
  { id: 'completista', nombre: 'Completista', cuando: (r) => r.alCien >= 1 || r.mejorPct >= 0.9, frase: (r) => (r.alCien ? `Tengo ${r.alCien === 1 ? 'una expansión' : `${r.alCien} expansiones`} al 100 %` : `Mi expansión más completa va por el ${Math.round(r.mejorPct * 100)} %`) },
  { id: 'fan', nombre: (r) => `Fan de ${r.fetiche?.nombre || ''}`, cuando: (r) => r.fetiche && r.fetiche.veces >= 8 && r.fetiche.veces / r.total >= 0.1, frase: (r) => `${r.fetiche.veces} cartas distintas de ${r.fetiche.nombre}: una de cada ${Math.round(r.total / r.fetiche.veces)} de las mías` },
  { id: 'holos', nombre: 'Cazador de holos', cuando: (r) => r.brillo >= 0.5, frase: (r) => `El ${Math.round(r.brillo * 100)} % de mis cartas brillan` },
  { id: 'tipo', nombre: (r) => `Maestro de ${r.tipo?.nombre || ''}`, cuando: (r) => r.tipo && r.tipo.cuenta / Math.max(1, r.pokemon) >= 0.45, frase: (r) => `${r.tipo.cuenta} de mis ${r.pokemon} Pokémon son de ${r.tipo.nombre}` },
  { id: 'region', nombre: (r) => `Nostálgico de ${r.region?.nombre || ''}`, cuando: (r) => r.region && r.region.cuenta / Math.max(1, r.pokemon) >= 0.4 && r.region.nombre === 'Kanto', frase: (r) => `${r.region.cuenta} de mis ${r.pokemon} Pokémon son de Kanto` },
  { id: 'regional', nombre: (r) => `De ${r.region?.nombre || ''}`, cuando: (r) => r.region && r.region.cuenta / Math.max(1, r.pokemon) >= 0.5, frase: (r) => `La mitad de mis Pokémon son de ${r.region.nombre}` },
  { id: 'entrenador', nombre: 'Entrenador', cuando: (r) => r.entrenadores / r.total >= 0.3, frase: (r) => `${Math.round((r.entrenadores / r.total) * 100)} % de entrenadores: colecciono para jugar` },
  { id: 'variado', nombre: 'De todo un poco', cuando: () => true, frase: (r) => `${r.especies} Pokémon distintos en ${r.total} cartas` },
]

export function perfilDeColeccionista(distintas, { pokedex = null, mejorSet = null, alCien = 0 } = {}) {
  const total = distintas.length
  if (!total) return null
  let brillan = 0
  let pokemon = 0
  let entrenadores = 0
  let energias = 0
  for (const { carta } of distintas) {
    if (familiaDeBrillo(rarezaDeCarta(carta) || carta?.rarity_en || carta?.rarity)) brillan++
    if (esEntrenador(carta)) entrenadores++
    else if (esEnergia(carta)) energias++
    else if (esPokemon(carta)) pokemon++
  }
  const pd = pokedex || resumenDePokedex(distintas)
  const region = [...pd.regiones].sort((a, b) => b.cuenta - a.cuenta)[0] || null
  const tipo = pd.tipos.find((t) => t.nombre !== 'Entrenador' && t.nombre !== 'Energía') || null
  const rasgos = {
    total, pokemon, entrenadores, energias,
    brillo: brillan / total,
    region: region && region.cuenta ? region : null,
    tipo,
    fetiche: masRepetido(distintas),
    especies: pd.especies,
    alCien,
    mejorPct: mejorSet && mejorSet.total ? mejorSet.tengo / mejorSet.total : 0,
  }
  const regla = PERFILES.find((p) => p.cuando(rasgos)) || PERFILES[PERFILES.length - 1]
  return {
    perfil: { id: regla.id, nombre: typeof regla.nombre === 'function' ? regla.nombre(rasgos) : regla.nombre, frase: regla.frase(rasgos) },
    ...rasgos,
  }
}

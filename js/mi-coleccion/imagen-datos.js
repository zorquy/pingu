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
import { TIPOS_ES } from '../carta-traducciones.js'

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
  return dex.length ? dex : especiesDeCarta(carta?.name || carta?.name_es || '')
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

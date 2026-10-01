// La parte de BASE de js/impresion-canonica.js (tanda 413): trae lo
// que hace falta para elegir qué impresión se enseña de cada carta.
//
// Vive aparte porque la usan dos páginas que no comparten nada más —la
// rejilla de una lista (torneos y /meta) y la importación del
// constructor— y ninguna de las dos puede arrastrar a la otra: el barrido
// de la 299 sigue los imports, y el constructor «usaría» las clases de
// torneos solo por importar su módulo.
//
// Como mucho DOS consultas por colección distinta de la lista (la cuenta
// oficial de los sets, y las impresiones hermanas), y solo de las cartas
// que hacen falta: las que están fuera de la colección oficial, y los
// Pokémon que la lista trae de dos sets (para saber si son la misma).
import { supabase } from './supabase.js'
import { impresionBase, juntarReimpresiones, fueraDeLaColeccion } from './impresion-canonica.js'

const oficiales = new Map() // set_id → cartas de la colección oficial (0 = no se sabe)
const hermanas = new Map() // `${set_id}|${name_key}` → filas

// Las dos cachés guardan la PROMESA y no el resultado: la lista media de
// /meta pide carta a carta y a la vez, y sin esto cada casilla volvía a
// preguntar por el mismo set antes de que contestara el primero.
async function cuentasOficiales(setIds) {
  const faltan = [...new Set(setIds)].filter((s) => s && !oficiales.has(s))
  if (faltan.length) {
    const consulta = supabase
      .from('tcg_sets')
      .select('id,card_count_official')
      .in('id', faltan)
      .then(({ data }) => new Map((data || []).map((s) => [s.id, Number(s.card_count_official) || 0])))
      // Sin la cuenta, nada está «fuera de la colección»: se enseña lo
      // que trae la lista, que es lo que se hacía antes.
      .catch(() => new Map())
    for (const s of faltan) oficiales.set(s, consulta.then((m) => m.get(s) || 0))
  }
  const cuentas = new Map()
  for (const s of new Set(setIds)) if (s) cuentas.set(s, await oficiales.get(s))
  return cuentas
}

async function impresionesHermanas(setId, claves, columnas) {
  const faltan = claves.filter((k) => !hermanas.has(`${setId}|${k}`))
  if (faltan.length) {
    const consulta = supabase
      .from('tcg_cards')
      .select(`${columnas},attacks`)
      .eq('set_id', setId)
      .in('name_key', faltan)
      .limit(200)
      .then(({ data }) => data || [])
      .catch(() => [])
    for (const k of faltan) hermanas.set(`${setId}|${k}`, consulta.then((filas) => filas.filter((f) => f.name_key === k)))
  }
  return (await Promise.all(claves.map((k) => hermanas.get(`${setId}|${k}`)))).flat()
}

// Los ataques de unos cuantos Pokémon, para saber si dos con el mismo
// nombre en sets distintos son la misma carta.
async function conAtaques(cartas) {
  const sin = cartas.filter((c) => c && !Array.isArray(c.attacks))
  if (!sin.length) return
  try {
    const { data } = await supabase.from('tcg_cards').select('id,attacks').in('id', [...new Set(sin.map((c) => c.id))])
    const porId = new Map((data || []).map((f) => [f.id, f.attacks]))
    for (const c of sin) if (porId.has(c.id)) c.attacks = porId.get(c.id)
  } catch {
    // Sin ataques, mismaCarta() dice que no: no se junta, que es lo seguro.
  }
}

// Las dos reglas sobre una lista ya resuelta. `entradas` = [{ carta, n, … }]
// con `carta` traída del espejo (con set_id, local_id, name_key y
// category). `columnas` son las que necesita quien llama: la impresión
// base vuelve con esas mismas, para que pueda pintarla igual que la otra.
export async function canonizarEntradas(entradas, { columnas, codigoDeSet = () => '' } = {}) {
  const cartas = entradas.map((e) => e.carta).filter(Boolean)
  if (!cartas.length) return entradas
  const cuentas = await cuentasOficiales(cartas.map((c) => c.set_id))

  // Regla 1: las que están fuera de la colección oficial, a su base.
  const porSet = new Map()
  for (const c of cartas) {
    if (!c.name_key || !fueraDeLaColeccion(c, cuentas.get(c.set_id))) continue
    if (!porSet.has(c.set_id)) porSet.set(c.set_id, new Set())
    porSet.get(c.set_id).add(c.name_key)
  }
  const bases = new Map()
  await Promise.all(
    [...porSet].map(async ([setId, claves]) => {
      const filas = await impresionesHermanas(setId, [...claves], columnas)
      for (const c of cartas.filter((x) => x.set_id === setId && claves.has(x.name_key))) {
        const original = filas.find((f) => f.id === c.id) || c
        bases.set(c.id, impresionBase({ ...c, attacks: original.attacks }, filas, cuentas.get(setId)))
      }
    })
  )
  const conBase = entradas.map((e) => (e.carta && bases.has(e.carta.id) ? { ...e, carta: bases.get(e.carta.id) } : e))

  // Regla 2: antes de juntar, los ataques de los Pokémon que vienen de
  // más de un set con el mismo nombre (y solo de esos).
  const sets = new Map()
  for (const e of conBase) {
    if (!e.carta?.name_key) continue
    if (!sets.has(e.carta.name_key)) sets.set(e.carta.name_key, new Set())
    sets.get(e.carta.name_key).add(e.carta.set_id)
  }
  const repetidos = conBase.filter((e) => e.carta && (sets.get(e.carta.name_key)?.size || 0) > 1 && /^pok/i.test(String(e.carta.category || '')))
  await conAtaques(repetidos.map((e) => e.carta))
  return juntarReimpresiones(conBase, codigoDeSet)
}

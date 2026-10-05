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
import { marcasLegales } from './carta-legalidad.js'
import { normalizeSearch } from './texto.js'
import { esEnergiaBasica } from './constructor/nucleo.js'
import { impresionBase, impresionMasComun, juntarReimpresiones, fueraDeLaColeccion } from './impresion-canonica.js'

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

// ── Las reimpresiones de una carta, de CUALQUIER colección (tanda 624) ──
//
// Por la clave (el nombre inglés) y por el nombre español: desde la 330
// hay filas con el español metido en `name`, y de las doce impresiones del
// «Interruptor de Energía» tres tienen de clave «interruptor de energia» y
// nueve «energy switch» — solo el nombre español las cruza. Dos consultas
// por tanda de nombres, con la promesa en caché como las de arriba.
const reimpresiones = new Map() // `${columnas}|${nombre normalizado}` → filas
const fechas = new Map() // set_id → { fecha, codigo } (fecha de salida y código de TCG Live)
const COLUMNAS_DE_RAREZA = 'id,set_id,local_id,name,name_es,name_en,name_key,category,image_path,image_scrydex,image_tcggo,rarity,rarity_en,regulation_mark,hp,attacks'

function columnasCon(columnas) {
  const todas = new Set([...String(columnas || '').split(','), ...COLUMNAS_DE_RAREZA.split(',')].map((c) => c.trim()).filter(Boolean))
  return [...todas].join(',')
}

// De ocho en ocho nombres: hay cartas con decenas de reimpresiones (la
// Ultra Ball, el Pikachu), y con todos los nombres en una consulta las de
// uno se comerían el tope de filas de las demás sin decir nada.
const NOMBRES_POR_CONSULTA = 8

function consultaDeReimpresiones(claves, nombres, sel) {
  const pedir = () => supabase.from('tcg_cards').select(sel).eq('market', 'WEST')
  return Promise.all([
    pedir().in('name_key', claves).limit(1000),
    nombres.length ? pedir().in('name_es', nombres).limit(1000) : { data: [] },
  ]).then(([a, b]) => [...(a.data || []), ...(b.data || [])])
}

async function reimpresionesDe(cartas, columnas) {
  // Las energías básicas no: su dibujo lo pone js/imagen-carta.js por el
  // tipo, y tienen más impresiones que ninguna otra carta.
  const conReimpresiones = cartas.filter((c) => !esEnergiaBasica(c))
  const nombresDe = (c) => [...new Set([c.name_key, normalizeSearch(c.name), normalizeSearch(c.name_es)].filter(Boolean))]
  // Las columnas van en la clave de la caché: la fila que gana se enseña
  // EN LUGAR de la que traía quien llama, así que tiene que traer lo mismo
  // (el constructor necesita la fase y los tipos; la lista de un torneo, no).
  const sel = columnasCon(columnas)
  const llave = (k) => `${sel}|${k}`
  const pendientes = conReimpresiones.filter((c) => nombresDe(c).some((k) => !reimpresiones.has(llave(k))))
  for (let i = 0; i < pendientes.length; i += NOMBRES_POR_CONSULTA) {
    const tanda = pendientes.slice(i, i + NOMBRES_POR_CONSULTA)
    const claves = [...new Set(tanda.flatMap(nombresDe))].filter((k) => !reimpresiones.has(llave(k)))
    if (!claves.length) continue
    const nombres = [...new Set(tanda.flatMap((c) => [c.name_es, c.name]).filter(Boolean))]
    const consulta = consultaDeReimpresiones(claves, nombres, sel)
      .then((filas) => [...new Map(filas.map((f) => [f.id, f])).values()])
      // Sin ellas se queda la impresión que había: es lo que se hacía antes.
      .catch(() => [])
    for (const k of claves) {
      reimpresiones.set(
        llave(k),
        consulta.then((filas) => filas.filter((f) => [f.name_key, normalizeSearch(f.name), normalizeSearch(f.name_es)].includes(k)))
      )
    }
  }
  const claves = [...new Set(conReimpresiones.flatMap(nombresDe))]
  const filas = (await Promise.all(claves.map((k) => reimpresiones.get(llave(k))))).flat()
  return [...new Map(filas.map((f) => [f.id, f])).values()]
}

async function fechasDeSets(setIds) {
  const faltan = [...new Set(setIds)].filter((s) => s && !fechas.has(s))
  if (faltan.length) {
    const consulta = supabase
      .from('tcg_sets')
      .select('id,release_date,tcg_online_code')
      .in('id', faltan)
      .then(({ data }) => new Map((data || []).map((s) => [s.id, { fecha: s.release_date || '', codigo: s.tcg_online_code || '' }])))
      .catch(() => new Map())
    for (const s of faltan) fechas.set(s, consulta.then((m) => m.get(s) || { fecha: '', codigo: '' }))
  }
  const out = new Map()
  for (const s of new Set(setIds)) if (s) out.set(s, await fechas.get(s))
  return out
}

// Regla 0, sobre unas entradas: cada carta, a su reimpresión de rareza más
// baja (js/impresion-canonica.js, `impresionMasComun`).
async function aLaMasComun(entradas, columnas) {
  const cartas = entradas.map((e) => e.carta).filter(Boolean)
  if (!cartas.length) return entradas
  const [filas, legales] = await Promise.all([reimpresionesDe(cartas, columnas), marcasLegales().catch(() => [])])
  if (!filas.length) return entradas
  const deSet = await fechasDeSets(filas.map((f) => f.set_id))
  const porId = new Map(filas.map((f) => [f.id, f]))
  return entradas.map((e) => {
    if (!e.carta) return e
    // Su propia fila trae la rareza y los ataques, que la carta que llega
    // puede no traer (las columnas de quien llama).
    const propia = { ...(porId.get(e.carta.id) || {}), ...e.carta }
    for (const k of 'rarity,rarity_en,attacks,hp,name_es,image_path,image_scrydex,image_tcggo'.split(',')) if (propia[k] == null && porId.get(e.carta.id)?.[k] != null) propia[k] = porId.get(e.carta.id)[k]
    const mejor = impresionMasComun(propia, filas, { legales, fechaDeSet: (id) => deSet.get(id)?.fecha })
    if (mejor === propia) return e
    // Si cambia de colección, con su código: quien pinte una imagen de
    // respaldo por «código + número» (Limitless) no puede mezclar el código
    // de la línea con el número de otra colección.
    return { ...e, carta: mejor.set_id === propia.set_id ? mejor : { ...mejor, cambio_de_set: true, codigo_set: deSet.get(mejor.set_id)?.codigo || '' } }
  })
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
export async function canonizarEntradas(entradasDadas, { columnas, codigoDeSet = () => '' } = {}) {
  // Regla 0 (tanda 624): la reimpresión de rareza más baja, de cualquier
  // colección. Las reglas 1 y 2 siguen detrás: la 1 para cuando la rareza
  // no se sabe y el número dice que está fuera de su colección.
  const entradas = await aLaMasComun(entradasDadas, columnas).catch(() => entradasDadas)
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

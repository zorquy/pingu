// Lo que cuesta montarte un mazo (tanda 792, NU3): cruza una lista (del
// meta, de un torneo, tuya), tu colección y los precios. «Te faltan 14:
// unos 23 € en Cardmarket. Ya tienes 46.»
//
// Una lista nombra CARTAS, no impresiones (la 629): para «lo que tienes» se
// suman todas tus copias de cualquier impresión con ese nombre, y para «lo
// que cuesta» vale la impresión más barata. Las energías básicas no cuentan:
// las tiene todo el mundo y no se compran sueltas.
import { supabase } from './supabase.js'
import { esEnergiaBasica } from './carta-detalle.js'
import { nombreDeCarta } from './catalogo-series.js'

const TROZO = 150

async function enTrozos(valores, pedir) {
  const filas = []
  for (let i = 0; i < valores.length; i += TROZO) {
    const { data, error } = await pedir(valores.slice(i, i + TROZO))
    if (error) throw error
    filas.push(...(data || []))
  }
  return filas
}

// Puro: con lo que pide la lista por nombre, lo que tienes por nombre y la
// impresión más barata por nombre, el resumen. Lo que no tiene precio no
// suma a los euros, y se cuenta aparte para no afirmar una cifra que no es.
export function resumenDeCoste(pide, tengo, barata) {
  const filas = []
  let total = 0, tienes = 0, faltan = 0, euros = 0, sinPrecio = 0
  for (const [clave, { n, nombre, carta }] of pide) {
    const mias = Math.min(n, tengo.get(clave) || 0)
    const falta = n - mias
    const mejor = barata.get(clave) || null
    total += n
    tienes += mias
    faltan += falta
    if (falta && mejor?.precio) euros += falta * mejor.precio
    else if (falta) sinPrecio += falta
    filas.push({ clave, nombre, n, tengo: mias, falta, carta, barata: mejor })
  }
  return { total, tienes, faltan, euros: Math.round(euros * 100) / 100, sinPrecio, filas: filas.sort((a, b) => b.falta - a.falta) }
}

export async function costeDeLista(lista, userId) {
  const { lineasDeLista } = await import('./guardar-lista.js')
  const { resolverLineas } = await import('./constructor/datos.js')
  const { resueltas } = await resolverLineas(lineasDeLista(lista))
  return costeDeResueltas(resueltas, userId)
}

// Con las cartas ya en la mano ({ linea: { n }, carta }): el constructor no
// tiene que volver a resolver lo que ya resolvió.
export async function costeDeResueltas(resueltas, userId) {
  const pide = new Map()
  for (const { linea, carta } of resueltas) {
    if (!carta?.name_key || esEnergiaBasica(carta)) continue
    const antes = pide.get(carta.name_key)
    pide.set(carta.name_key, { n: (antes?.n || 0) + linea.n, nombre: nombreDeCarta(carta), carta: antes?.carta || carta })
  }
  const claves = [...pide.keys()]
  const impresiones = await enTrozos(claves, (t) => supabase.from('tcg_cards').select('id,name_key,market').eq('market', 'WEST').in('name_key', t).limit(3000))
  const claveDe = new Map(impresiones.map((c) => [c.id, c.name_key]))
  const ids = [...claveDe.keys()]
  const [precios, mias] = await Promise.all([
    enTrozos(ids, (t) => supabase.from('tcg_card_prices').select('card_id,cm_low,cm_trend').in('card_id', t)).catch(() => []),
    userId ? enTrozos(ids, (t) => supabase.from('user_collection').select('card_id,cantidad').eq('user_id', userId).in('card_id', t)) : [],
  ])
  const tengo = new Map()
  for (const f of mias) {
    const k = claveDe.get(f.card_id)
    if (k) tengo.set(k, (tengo.get(k) || 0) + (Number(f.cantidad) || 1))
  }
  const barata = new Map()
  for (const p of precios) {
    const k = claveDe.get(p.card_id)
    const precio = Number(p.cm_low || p.cm_trend) || 0
    if (!k || !precio) continue
    if (!barata.has(k) || precio < barata.get(k).precio) barata.set(k, { id: p.card_id, precio })
  }
  return resumenDeCoste(pide, tengo, barata)
}

// «Apuntar las que faltan en La quiero», de golpe: la impresión más barata
// (o la de la lista), idioma «me da igual». Las que ya estaban no son un error.
export async function apuntarLasQueFaltan(resumen) {
  const { anadirDeseo } = await import('./mi-coleccion/cambios.js')
  let nuevas = 0
  for (const f of resumen.filas.filter((x) => x.falta)) {
    try {
      await anadirDeseo({ card_id: f.barata?.id || f.carta.id, idioma: null })
      nuevas++
    } catch (e) {
      if (!e.yaEstaba) throw e
    }
  }
  return nuevas
}

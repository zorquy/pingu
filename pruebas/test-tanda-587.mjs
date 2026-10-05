// Tanda 587 — las dos funciones: emparejar (ensayo en seco y escritura, por
// tandas) y la guía diaria (por pasadas, con su estado). Y que TCGdex deje
// de pisar Cardmarket donde hay par propio.
import { readFileSync } from 'node:fs'
import { procesar as emparejar, CONFIANZA_MINIMA } from '/home/user/pingu/netlify/functions/cardmarket-emparejar.mjs'
import { procesar as precios, CLAVE_ESTADO } from '/home/user/pingu/netlify/functions/cardmarket-precios.mjs'
import { procesar as tcgdex } from '/home/user/pingu/netlify/functions/precios-coleccion.mjs'
import { porExpansion } from '/home/user/pingu/netlify/lib/cardmarket-catalogo.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const DIR = new URL('./fixtures/', import.meta.url)
const PRODUCTOS = JSON.parse(readFileSync(new URL('cardmarket-products-prc-pal.json', DIR), 'utf8')).products
const GUIA = JSON.parse(readFileSync(new URL('cardmarket-price-guide-prc-pal.json', DIR), 'utf8'))
const prc = porExpansion(PRODUCTOS).get(1585)
// Nuestro Primal Clash, 164 cartas, con TCGdex apuntando al producto MALO
// en la 150 (273615, el común) y sin par propio todavía.
const CARTAS = prc.slice(0, 164).map((p, i) => ({ id: `xy5-${i + 1}`, local_id: String(i + 1), name: p.nombre, attacks: p.ataques ? p.ataques.split('|').map((n) => ({ name: n })) : null, cm_id_product_propio: null }))
const SETS = [{ id: 'xy5', name: 'Primal Clash', name_en: 'Primal Clash', card_count_total: 164 }, { id: 'A1', name: 'Pocket', card_count_total: 10 }, { id: 'zzz', name: 'Vacío', card_count_total: 0 }]
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's' }

console.log('── 1. Emparejar: ensayo en seco ──')
{
  const escrituras = []
  const restImpl = async (ruta) => {
    if (ruta.startsWith('tcg_sets?')) return SETS
    if (/set_id=eq\.xy5/.test(ruta)) return CARTAS
    if (/set_id=eq\./.test(ruta)) return []
    throw new Error(`ruta inesperada ${ruta}`)
  }
  const r = await emparejar({ env: ENV, restImpl, guardarImpl: async (p) => { escrituras.push(p); return p.length }, productos: PRODUCTOS })
  check('contesta 200 en ensayo', r.estado === 200 && r.cuerpo.ensayoEnSeco === true, JSON.stringify(r.cuerpo).slice(0, 200))
  check('Pocket se queda fuera y se recorren los demás', r.cuerpo.nuestrosSets === 2 && r.cuerpo.siguienteDesde === null, JSON.stringify([r.cuerpo.nuestrosSets, r.cuerpo.siguienteDesde]))
  const f = r.cuerpo.informe.find((x) => x.set === 'xy5')
  check('Primal Clash → su expansión 1585, 164 pares por orden', f?.idExpansion === 1585 && f.pares === 164 && f.porOrden === 164 && f.sinPar === 0, JSON.stringify(f))
  check('el set vacío se apunta como tal', r.cuerpo.informe.find((x) => x.set === 'zzz')?.porque === 'sin cartas en nuestro catálogo')
  check('164 a escribir, y NO se ha escrito nada', r.cuerpo.aEscribir === 164 && r.cuerpo.escritas === 0 && escrituras.length === 0)

  console.log('── 2. Emparejar: escribir ──')
  const w = await emparejar({ env: ENV, restImpl, guardarImpl: async (p) => { escrituras.push(p); return p.length }, productos: PRODUCTOS, escribir: true })
  check('escribe los 164 por la función de la base', w.cuerpo.escritas === 164 && escrituras.length === 1 && escrituras[0].length === 164)
  const groudon = escrituras[0].find((p) => p.id === 'xy5-150')
  check('  …y el Groudon 150 va al 273681 (no al 273615 de TCGdex)', groudon?.id_product === 273681 && groudon.por === 'orden', JSON.stringify(groudon))
  // Segunda vez: ya iguales, nada que escribir.
  const yaConPar = CARTAS.map((c) => ({ ...c, cm_id_product_propio: escrituras[0].find((p) => p.id === c.id)?.id_product ?? null }))
  const r2 = await emparejar({ env: ENV, restImpl: async (ruta) => (ruta.startsWith('tcg_sets?') ? SETS : /set_id=eq\.xy5/.test(ruta) ? yaConPar : []), productos: PRODUCTOS })
  check('con los pares ya puestos no queda nada que escribir', r2.cuerpo.aEscribir === 0 && r2.cuerpo.informe.find((x) => x.set === 'xy5').yaIguales === 164)

  console.log('── 3. Lo que no se escribe ──')
  // Un set cuyas cartas no se parecen a nada: sin expansión.
  const raras = CARTAS.slice(0, 20).map((c, i) => ({ ...c, name: `Inventada ${i}` }))
  const r3 = await emparejar({ env: ENV, restImpl: async (ruta) => (ruta.startsWith('tcg_sets?') ? [SETS[0]] : raras), productos: PRODUCTOS })
  check('un set sin nombres en común se queda sin expansión y sin escribir', r3.cuerpo.setsSinExpansion === 1 && r3.cuerpo.aEscribir === 0, JSON.stringify(r3.cuerpo.informe[0]))
  // Una expansión que se parece pero cuyo orden no casa: sospechoso.
  const desordenadas = CARTAS.map((c, i) => ({ ...c, local_id: String(164 - i) }))
  const r4 = await emparejar({ env: ENV, restImpl: async (ruta) => (ruta.startsWith('tcg_sets?') ? [SETS[0]] : desordenadas), productos: PRODUCTOS })
  const f4 = r4.cuerpo.informe[0]
  check(`con el orden al revés casa menos del ${CONFIANZA_MINIMA * 100} % por orden → sospechoso, no se escribe`, !!f4.SOSPECHOSO && r4.cuerpo.aEscribir === 0, JSON.stringify(f4).slice(0, 200))
  // Sin tiempo: se devuelve por dónde seguir.
  let t = 0
  const r5 = await emparejar({ env: ENV, restImpl, productos: PRODUCTOS, reloj: () => (t += 4000) })
  check('sin tiempo, devuelve `siguienteDesde` para seguir', r5.cuerpo.siguienteDesde !== null && r5.cuerpo.setsMirados < 2, JSON.stringify([r5.cuerpo.siguienteDesde, r5.cuerpo.setsMirados]))
  // Sin la migración: 409 que lo dice.
  const r6 = await emparejar({ env: ENV, restImpl: async (ruta) => { if (ruta.startsWith('tcg_sets?')) return SETS; throw new Error('column tcg_cards.cm_id_product_propio does not exist (42703)') }, productos: PRODUCTOS })
  check('sin la migración, 409 y el nombre del fichero', r6.estado === 409 && /cardmarket-propio/.test(r6.cuerpo.error))
}

console.log('── 4. La guía diaria, por pasadas ──')
{
  const estado = { valor: {} }
  const escritas = []
  const conPar = CARTAS.map((c, i) => ({ id: c.id, cm_id_product_propio: 273532 + i }))
  conPar.push({ id: 'xy5-900', cm_id_product_propio: 999999999 }) // sin entrada en la guía
  const restImpl = async (ruta) => {
    const m = ruta.match(/limit=(\d+)&offset=(\d+)/)
    const [lim, off] = [Number(m[1]), Number(m[2])]
    return conPar.slice(off, off + lim)
  }
  const r = await precios({ env: ENV, restImpl, guardarImpl: async (f) => { escritas.push(...f) }, estadoImpl: async () => estado.valor, guardarEstadoImpl: async (v) => { estado.valor = v }, guia: GUIA.priceGuides, hoy: '2026-10-05' })
  check('escribe una fila por carta con par y entrada', r.ok && r.hecho === true && escritas.length === 164 && r.sinEntrada === 1, JSON.stringify(r))
  const g = escritas.find((f) => f.card_id === 'xy5-150')
  check('el Groudon 150 lleva el producto bueno y sus cifras de verdad', g?.cm_id_product === 273681 && g.cm_trend > 50 && g.origen === 'cardmarket-guia', JSON.stringify(g))
  check('  …y no lleva columnas de TCGplayer (esas son de TCGdex)', !Object.keys(g).some((k) => k.startsWith('tp_')))
  check('el estado queda hecho para hoy', estado.valor.dia === '2026-10-05' && estado.valor.hecho === true, JSON.stringify(estado.valor))
  const r2 = await precios({ env: ENV, restImpl, guardarImpl: async () => { throw new Error('no debería escribir') }, estadoImpl: async () => estado.valor, guardarEstadoImpl: async () => {}, guia: GUIA.priceGuides, hoy: '2026-10-05' })
  check('la segunda pasada del día no hace nada', r2.ok && /ya está puesta/.test(r2.saltado))
  // Sin tiempo: se corta tras una página y apunta por dónde va.
  let t = 0
  const estado2 = { valor: {} }
  // Con más de una página (2.500 cartas con par) y un reloj que gasta el
  // presupuesto en la primera.
  const muchas = Array.from({ length: 2500 }, (_, i) => ({ id: `m-${i}`, cm_id_product_propio: 273532 + (i % 164) }))
  const r3 = await precios({ env: ENV, restImpl: async (ruta) => { const m = ruta.match(/offset=(\d+)/); const off = Number(m[1]); return muchas.slice(off, off + 1000) }, guardarImpl: async () => {}, estadoImpl: async () => estado2.valor, guardarEstadoImpl: async (v) => { estado2.valor = v }, guia: GUIA.priceGuides, hoy: '2026-10-06', reloj: () => (t += 11000) })
  check('sin tiempo, apunta `desde` y no marca el día', r3.ok && r3.hecho === false && estado2.valor.hecho === false && estado2.valor.desde > 0, JSON.stringify(estado2.valor))
  check('sin la migración, se salta sin gritar', (await precios({ env: ENV, restImpl: async () => { throw new Error('column cm_id_product_propio does not exist') }, estadoImpl: async () => ({}), guardarEstadoImpl: async () => {}, guia: [] })).saltado?.includes('cardmarket-propio'))
}

console.log('── 5. TCGdex ya no pisa Cardmarket donde hay par propio ──')
{
  const cuerpos = []
  const fetchImpl = async (url, opciones = {}) => {
    const json = (datos, status = 200) => ({ ok: status < 300, status, json: async () => datos, text: async () => JSON.stringify(datos) })
    if (/rpc\/precios_pendientes/.test(url)) return json([{ card_id: 'xy5-150' }, { card_id: 'xy5-1' }])
    if (/cards\/xy5-150/.test(url)) return json({ id: 'xy5-150', pricing: { cardmarket: { idProduct: 273615, low: 0.15, trend: 2.06, avg30: 1.34 }, tcgplayer: { holofoil: { marketPrice: 171.08, lowPrice: 95 } } } })
    if (/cards\/xy5-1$/.test(url)) return json({ id: 'xy5-1', pricing: { cardmarket: { idProduct: 273532, low: 0.02, trend: 0.05 }, tcgplayer: { normal: { marketPrice: 0.04 } } } })
    if (/tcg_cards\?select=id&market=eq\.WEST&cm_id_product_propio=not\.is\.null/.test(url)) return json([{ id: 'xy5-150' }])
    if (/rest\/v1\/tcg_card_prices$/.test(url)) {
      cuerpos.push(JSON.parse(opciones.body))
      return { ok: true, status: 201, text: async () => '' }
    }
    return json({ error: `inesperada ${url}` }, 500)
  }
  const r = await tcgdex({ env: ENV, fetchImpl, pausa: 0 })
  check('la pasada guarda las dos y cuenta una con par propio', r.ok && r.guardados === 2 && r.conParPropio === 1, JSON.stringify(r))
  const todas = cuerpos.flat()
  const groudon = todas.find((f) => f.card_id === 'xy5-150')
  const weedle = todas.find((f) => f.card_id === 'xy5-1')
  check('el Groudon (con par propio) llega SIN cm_*: solo TCGplayer', groudon && !Object.keys(groudon).some((k) => k.startsWith('cm_')) && groudon.tp_holo_market === 171.08, JSON.stringify(groudon))
  check('la otra sigue llevando Cardmarket de TCGdex', weedle?.cm_trend === 0.05 && weedle.cm_id_product === 273532)
  check('  …en dos sentencias distintas (claves distintas)', cuerpos.length === 2)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

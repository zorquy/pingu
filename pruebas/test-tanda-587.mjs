// Tanda 587 — la guía diaria de precios de Cardmarket (por pasadas, con su
// estado) y que TCGdex deje de pisar Cardmarket donde hay par propio. El
// emparejador por orden y nombres que también traía la 587 se quitó en la
// 588 (lo hace TCGGO: test-tanda-588.mjs); el fixture de la guía es un
// trozo REAL de price_guide_6.json (2026-10-04) y la fila de salida la
// prueba aquí `filaDeGuia`.
import { readFileSync } from 'node:fs'
import { procesar as precios, CLAVE_ESTADO } from '/home/user/pingu/netlify/functions/cardmarket-precios.mjs'
import { procesar as tcgdex } from '/home/user/pingu/netlify/functions/precios-coleccion.mjs'
import { filaDeGuia } from '/home/user/pingu/netlify/lib/cardmarket-catalogo.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const DIR = new URL('./fixtures/', import.meta.url)
const GUIA = JSON.parse(readFileSync(new URL('cardmarket-price-guide-prc-pal.json', DIR), 'utf8'))
// Nuestro Primal Clash: 164 cartas con su par propio (los ids de esa
// expansión van seguidos desde el 273532, y la 150 es el 273681).
const CARTAS = Array.from({ length: 164 }, (_, i) => ({ id: `xy5-${i + 1}`, local_id: String(i + 1), name: `Carta ${i + 1}`, cm_id_product_propio: 273532 + i }))
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's' }

console.log('── 1. De la guía a nuestra fila ──')
{
  const g = GUIA.priceGuides.find((x) => x.idProduct === 273681)
  check('la guía trae el Groudon EX de verdad', !!g && g.trend > 50, JSON.stringify(g))
  const f = filaDeGuia('xy5-150', 273681, g, { creada: '2026-10-04T02:40:55+0200', ahora: new Date('2026-10-05T07:00:00Z') })
  check('la fila lleva su idProduct y sus cifras', f.cm_id_product === 273681 && f.cm_trend === g.trend && f.cm_low === g.low && f.origen === 'cardmarket-guia', JSON.stringify(f))
  check('  …y la fecha del fichero', f.cm_updated === '2026-10-04T00:40:55.000Z', f.cm_updated)
  const comun = GUIA.priceGuides.find((x) => x.idProduct === 273615)
  check('y el común sigue valiendo 2,06 (es otro producto, no otro número)', comun?.trend === 2.06 && comun.low === 0.15)
}

console.log('── 2. La guía diaria, por pasadas ──')
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

console.log('── 3. TCGdex ya no pisa Cardmarket donde hay par propio ──')
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

// Tanda 1026 — Qué lleva dentro un producto sellado, y su PVP (lo nuevo de
// la API de TCGGO del 25 de octubre). Lo puro de js/productos.js y la pasada
// `tcggo-productos` con el flag `include_contained_items=1`.
//
// Los fixtures son los EJEMPLOS DE SU ESPECIFICACIÓN (pruebas/fixtures/
// tcggo-producto-1026.json, pegados tal cual de api-1_5.json): el producto
// 48447 con `include_contained_items` (su `found_in` real, 28 packs) y la
// lista del episodio 431 (con `msrp`). De un PACK con cosas dentro no hay
// ejemplo: la fila de `contained_items` se monta con la MISMA forma que las
// de `found_in` (id, type, name, quantity, image, prices «slim»), que es lo
// que dice la descripción del parámetro. Es lo que PINGU confirma con la
// sonda de /admin («un producto, con lo que lleva dentro») sobre el 48449.
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const REAL = JSON.parse(readFileSync(new URL('./fixtures/tcggo-producto-1026.json', import.meta.url), 'utf8'))
const { filaDeProducto, filasDeContenido, cuentaDelPack, porUnidad, relacionConPvp, COLUMNAS_1026 } = await import(`${RAIZ}/js/productos.js`)
const SOBRE = REAL.producto.data // 48447, con found_in
const BUNDLE_LISTA = REAL.lista.data.find((p) => p.id === 48449) // con msrp
const enBundle = SOBRE.found_in.find((x) => x.id === 48449)
// El bundle como lo daría el listado con el flag: lo de la lista más
// `contained_items` con la forma de las filas de `found_in`.
const BUNDLE = { ...BUNDLE_LISTA, contained_items: [{ id: SOBRE.id, type: 'product', name: SOBRE.name, slug: SOBRE.slug, quantity: enBundle.quantity, image: SOBRE.image, tcggo_url: SOBRE.tcggo_url, prices: { cardmarket: { currency: 'EUR', lowest: SOBRE.prices.cardmarket.lowest }, tcg_player: { currency: 'EUR', market_price: 11.2 } }, episode: enBundle.episode }], found_in: [] }

console.log('── 1. Lo puro ──')
{
  const f = filaDeProducto(BUNDLE)
  check('el PVP de Europa va en pvp_eur (29,99 €), y es la única columna nueva', f.pvp_eur === 29.99 && JSON.stringify(COLUMNAS_1026) === '["pvp_eur"]', JSON.stringify(f.pvp_eur))
  check('  …un msrp en otra moneda o sin «eu» no es un PVP en euros', filaDeProducto({ ...BUNDLE, msrp: { us: { price: 26.94, currency: 'USD' } } }).pvp_eur === null && filaDeProducto({ ...BUNDLE, msrp: null }).pvp_eur === null && filaDeProducto({ ...BUNDLE, msrp: { eu: { price: 29.99, currency: 'GBP' } } }).pvp_eur === null)
  check('  …y el sobre, con msrp null, lo mismo', filaDeProducto(SOBRE).pvp_eur === null)
  const filas = filasDeContenido(BUNDLE, { productId: 48449, ahora: new Date('2026-10-26T10:00:00Z') })
  check('lo de dentro: una fila por cosa, colgada del pack, con cantidad, nombre, foto y los dos precios', filas.length === 1 && filas[0].product_id === 48449 && filas[0].contenido_tipo === 'product' && filas[0].contenido_id === 48447 && filas[0].cantidad === 6 && filas[0].nombre === '30th Celebration Booster' && filas[0].image === SOBRE.image && filas[0].cm_lowest === 10.5 && filas[0].tp_market === 11.2, JSON.stringify(filas))
  check('  …el id de un producto contenido pasa por idDe (el japonés va desplazado)', filasDeContenido(BUNDLE, { productId: 1_000_048_449, idDe: (id) => 1_000_000_000 + id })[0].contenido_id === 1_000_048_447)
  const conCarta = filasDeContenido({ ...BUNDLE, contained_items: [...BUNDLE.contained_items, { id: 31799, type: 'card', name: 'Spinarak', quantity: 1, prices: { cardmarket: { currency: 'EUR', lowest_near_mint: 0.03 } } }, { id: 7, type: 'accessory', name: 'Dado' }, { id: 48447, type: 'product', name: 'Repetido', quantity: 2 }] }, { productId: 48449 })
  check('  …una carta entra con su mínimo NM, lo que no es producto ni carta no, y un repetido no se cuenta dos veces', conCarta.length === 2 && conCarta[1].contenido_tipo === 'card' && conCarta[1].contenido_id === 31799 && conCarta[1].cm_lowest === 0.03 && conCarta[0].cantidad === 6, JSON.stringify(conCarta))
  check('  …sin contained_items (el flag apagado o sin plan), ninguna fila y sin error', filasDeContenido(SOBRE, { productId: 48447 }).length === 0 && filasDeContenido(null, { productId: 1 }).length === 0)

  const cuenta = cuentaDelPack(59.99, filas)
  check('la cuenta del pack: 6 × 10,50 = 63,00 suelto contra 59,99, el pack sale 3,01 mejor', cuenta && cuenta.suelto === 63 && cuenta.pack === 59.99 && cuenta.diferencia === 3.01 && cuenta.veredicto === 'mejor' && cuenta.sinPrecio === 0, JSON.stringify(cuenta))
  check('  …más caro que lo suelto, «peor»; igual, «igual»', cuentaDelPack(70, filas).veredicto === 'peor' && cuentaDelPack(63, filas).veredicto === 'igual')
  const parcial = cuentaDelPack(64.99, [...filas, { contenido_tipo: 'product', cantidad: 1, nombre: 'Accesorios', cm_lowest: null, tp_market: null }])
  check('  …con algo sin precio, solo la cuenta de lo que lo tiene y «parcial» (no se afirma de más)', parcial.veredicto === 'parcial' && parcial.sinPrecio === 1 && parcial.conPrecio === 6 && parcial.suelto === 63, JSON.stringify(parcial))
  check('  …y sin precio del pack o sin nada con precio, null (no se sabe, la 319)', cuentaDelPack(null, filas) === null && cuentaDelPack(59.99, [{ cantidad: 1, cm_lowest: null }]) === null && cuentaDelPack(59.99, []) === null)
  check('lo que sale cada uno dentro: 59,99 / 6 = 10,00', porUnidad(59.99, 6) === 10 && porUnidad(null, 6) === null && porUnidad(10, 0) === null)
  check('el precio contra el PVP: 47,95 contra 29,99 es «hoy un 60 % por encima»', relacionConPvp(47.95, 29.99)?.texto === 'hoy un 60 % por encima' && relacionConPvp(47.95, 29.99).tanto === 60, JSON.stringify(relacionConPvp(47.95, 29.99)))
  check('  …59,99 es «hoy al doble», 95 «hoy a 3,2×», 24 «un 20 % por debajo», 30,5 «en el PVP»', relacionConPvp(59.99, 29.99).texto === 'hoy al doble' && relacionConPvp(95, 29.99).texto === 'hoy a 3,2×' && relacionConPvp(24, 29.99).texto === 'hoy un 20 % por debajo' && relacionConPvp(30.5, 29.99).texto === 'hoy en el PVP', [59.99, 95, 24, 30.5].map((x) => relacionConPvp(x, 29.99).texto).join(' | '))
  check('  …y sin uno de los dos, null', relacionConPvp(null, 29.99) === null && relacionConPvp(47.95, null) === null && relacionConPvp(47.95, 0) === null)
}

console.log('\n── 2. La pasada ──')
{
  const fn = await import(`${RAIZ}/netlify/functions/tcggo-productos.mjs`)
  const montar = ({ conTabla = true, conPvp = true } = {}) => {
    const llamadas = []
    const escritas = { productos: [], contenido: [], borrados: [] }
    let guardado = { revision: fn.REVISION }
    const restImpl = async (ruta, o) => {
      if (ruta.startsWith('tcg_products?select=pvp_eur')) { if (!conPvp) throw new Error('Supabase 400: column pvp_eur does not exist'); return [] }
      if (ruta.startsWith('tcg_product_contenido?select=')) { if (!conTabla) throw new Error('Supabase 404: relation does not exist'); return [] }
      if (ruta.startsWith('tcg_products?select=')) return []
      if (ruta.startsWith('scrydex_estado?select')) return [{ valor: guardado }]
      if (ruta === 'scrydex_estado') { guardado = JSON.parse(o.body)[0].valor; return null }
      if (ruta.startsWith('tcg_sets?')) return [{ id: 'me30', market: 'WEST', tcggo_id: 431, release_date: '2026-09-16' }]
      if (ruta === 'tcg_products') { escritas.productos.push(...JSON.parse(o.body)); return null }
      if (ruta.startsWith('tcg_product_contenido?product_id=in.') && o?.method === 'DELETE') { escritas.borrados.push(ruta); return null }
      if (ruta === 'tcg_product_contenido') { escritas.contenido.push(...JSON.parse(o.body)); return null }
      throw new Error(`ruta inesperada ${ruta}`)
    }
    const fetchImpl = async (url) => {
      llamadas.push(url)
      if (!/\/episodes\/431\/products\?page=1/.test(url)) return new Response('Not found', { status: 404 })
      return new Response(JSON.stringify({ data: [SOBRE, BUNDLE], paging: { current: 1, total: 1 } }), { status: 200 })
    }
    return { llamadas, escritas, restImpl, fetchImpl, estado: () => guardado }
  }
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k' }
  const ahora = new Date('2026-10-26T10:00:00Z')

  const a = montar()
  const r = await fn.procesar({ env, ahora, restImpl: a.restImpl, fetchImpl: a.fetchImpl })
  // El 226 (los sueltos, 968) se pide antes y da 404: lo que se mira es la del 431.
  const del431 = (m) => m.llamadas.filter((u) => /\/episodes\/431\/products/.test(u))
  check('con la migración, el listado se pide con include_contained_items=1 (la misma petición de siempre)', del431(a).length === 1 && /\/episodes\/431\/products\?page=1&include_contained_items=1$/.test(del431(a)[0]), a.llamadas.join(' '))
  check('  …los productos se escriben con su PVP', a.escritas.productos.length === 2 && a.escritas.productos.find((p) => p.id === 48449)?.pvp_eur === 29.99 && a.escritas.productos.find((p) => p.id === 48447)?.pvp_eur === null, JSON.stringify(a.escritas.productos.map((p) => [p.id, p.pvp_eur])))
  check('  …y lo de dentro: antes se borra lo de esos productos, luego se escribe lo de ahora', a.escritas.borrados.length === 1 && /product_id=in\.\(48447,48449\)/.test(a.escritas.borrados[0]) && a.escritas.contenido.length === 1 && a.escritas.contenido[0].product_id === 48449 && a.escritas.contenido[0].contenido_id === 48447 && a.escritas.contenido[0].cantidad === 6, JSON.stringify(a.escritas))
  check('  …y el resumen lo cuenta', r.contenidos === 1 && r.productos === 2, JSON.stringify(r))

  const b = montar({ conTabla: false, conPvp: false })
  await fn.procesar({ env, ahora, restImpl: b.restImpl, fetchImpl: b.fetchImpl })
  check('sin la migración 1026: ni flag en la petición, ni pvp_eur en la fila, ni nada en la tabla (un upsert con una columna que no existe se rechaza entero)', del431(b).length === 1 && !/include_contained_items/.test(del431(b)[0]) && b.escritas.productos.length === 2 && b.escritas.productos.every((p) => !('pvp_eur' in p)) && b.escritas.contenido.length === 0 && b.escritas.borrados.length === 0, `${del431(b)[0]} · ${JSON.stringify(Object.keys(b.escritas.productos[0] || {}))}`)
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

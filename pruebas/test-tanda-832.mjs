// Tanda 832 — las japonesas que TCGGO da SIN id de Cardmarket también tienen precio.
//
// PINGU pegó la pasada con la 831 puesta: de la #610 hacia atrás, «0 de 0
// nuestras» igual. TCGGO da precio a esas cartas (el Gengar de Lost Link,
// 1.300 €) pero muchas sin `cardmarket_id`, y la pasada se saltaba toda
// entrada sin él antes de buscar nada. Lost Link «10 de 40»: diez lo traen.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`)
}
const { procesar, porColumnas } = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
const AHORA = new Date('2026-10-14T12:00:00Z')
// El Gengar SIN `cardmarket_id` (como lo da TCGGO en su ficha: precio sí,
// producto no), una con producto, y una VERSIÓN del Gengar sin foto.
const GENGAR = { id: 69408, card_number: '015', image: 'https://x/g.png', attacks: [{}], prices: { cardmarket: { lowest_near_mint: 1300 } } }
const VERSION = { id: 69499, card_number: '015', prices: { cardmarket: { lowest_near_mint: 900 } } }
const CON_CM = { id: 69409, card_number: '016', cardmarket_id: 512346, image: 'https://x/o.png', prices: { cardmarket: { lowest_near_mint: 5 } } }
const montar = (pagina, cartas = null) => {
  const estados = {
    [CLAVE_PARES]: { hechos: { sv1: { episodio: 10 } }, episodios: { lista: [{ id: 10, nombre: 'SV', cartas: 1, logo: 'https://x/l.png', valorCm: 1 }] } },
    tcggo_catalogo: { setsPorEpisodio: { JP: {} }, episodiosJp: { lista: [{ id: 647, nombre: 'Lost Link', cartas: 3, logo: 'https://x/e.png', valorCm: 1 }] } },
    tcggo_precios: {},
  }
  const CARTAS = cartas || [
    // El Gengar con el id de Cardmarket de antes (el occidental del espejo).
    { id: 'tcggo-69408', set_id: 'll1_ja', local_id: '015', name: 'ゲンガー', cm_id_product_propio: 99999, tcggo_id: 69408 },
    { id: 'tcggo-69409', set_id: 'll1_ja', local_id: '016', name: 'X', cm_id_product_propio: 512346, tcggo_id: 69409 },
  ]
  const precios = []
  const lotes = []
  const corregidas = []
  const fetchImpl = async (url) => {
    const u = new URL(url)
    const ep = Number(u.searchParams.get('episode_id'))
    if (/pokemon-jp/.test(u.pathname) && ep === 647) return { ok: true, status: 200, text: async () => JSON.stringify({ data: pagina, paging: { current: 1, total: 1, per_page: 100 } }) }
    if (ep === 10) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 1, card_number: '1', cardmarket_id: 500, prices: { cardmarket: { lowest_near_mint: 2 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }
    return { ok: false, status: 404, text: async () => 'no' }
  }
  const restImpl = async (ruta) => {
    const r = decodeURIComponent(ruta)
    if (/^tcg_sets\?select=id,tcggo_id,oculto&market=eq\.JP/.test(r)) return [{ id: 'll1_ja', tcggo_id: 647, oculto: false }]
    if (/^tcg_cards\?.*market=eq\.JP/.test(r)) {
      const porTcggo = /tcggo_id(?:=in|\.in)\.\(([^)]*)\)/.exec(r)?.[1].split(',').map(Number) || []
      const porCm = /cm_id_product_propio(?:=in|\.in)\.\(([^)]*)\)/.exec(r)?.[1].split(',').map(Number) || []
      if (/tcggo_id=is\.null/.test(r)) return []
      return CARTAS.filter((c) => porTcggo.includes(c.tcggo_id) || porCm.includes(c.cm_id_product_propio)).map((c) => ({ ...c }))
    }
    return [{ id: 'sv1-1', cm_id_product_propio: 500 }]
  }
  return {
    estados, precios, lotes, corregidas,
    base: {
      env: ENV, fetchImpl, restImpl, pausa: async () => {}, ahora: AHORA,
      // Como PostgREST: un lote con filas de columnas distintas se rechaza ENTERO.
      guardarImpl: async (f) => {
        if (new Set(f.map((x) => Object.keys(x).sort().join())).size > 1) throw new Error('Supabase 400: {"code":"PGRST102","message":"All object keys must match"}')
        lotes.push(f.length); precios.push(...f)
      },
      corregirImpl: async (f) => {
        if (new Set(f.map((x) => Object.keys(x).sort().join())).size > 1) throw new Error('Supabase 400: {"code":"PGRST102","message":"All object keys must match"}')
        corregidas.push(...f)
      },
      guardarSetsImpl: async (f) => f.length, fotoImpl: async () => 0,
      estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    },
  }
}
{
  const b = montar([GENGAR, VERSION, CON_CM])
  const r = await procesar(b.base)
  const gengar = b.precios.filter((f) => f.card_id === 'tcggo-69408')
  check('va bien (sin «All object keys must match»)', r.ok, JSON.stringify(r).slice(0, 300))
  check('el Gengar, sin id de Cardmarket en TCGGO, tiene su precio: 1.300 € (el de la principal, no los 900 de la versión)', gengar.length === 1 && gengar[0].cm_low_ja === 1300, JSON.stringify(gengar))
  check('  …y su fila de precio va SIN el producto de antes (vacío, no el occidental)', gengar[0] && 'cm_id_product' in gengar[0] && gengar[0].cm_id_product === null)
  check('  …y su id de Cardmarket de la carta no se toca (TCGGO no da otro)', !b.corregidas.some((c) => c.id === 'tcggo-69408'), JSON.stringify(b.corregidas))
  check('la que trae producto, con el suyo', b.precios.find((f) => f.card_id === 'tcggo-69409')?.cm_id_product === 512346)
  const res = b.estados.tcggo_precios.resumenJp?.[647]
  check('/admin: 3 suyas, 1 con id de Cardmarket, 2 nuestras, 2 escritas', res?.suyas === 3 && res.conCm === 1 && res.nuestras === 2 && res.escritas === 2, JSON.stringify(res))
}
{
  // Una expansión ENTERA sin ids de Cardmarket ya no se salta: se casa por tcggo_id.
  const b = montar([GENGAR])
  const r = await procesar(b.base)
  check('una expansión sin un solo id de Cardmarket no se salta: el Gengar tiene precio', !r.saltadasSinCm && b.precios.some((f) => f.card_id === 'tcggo-69408' && f.cm_low_ja === 1300), JSON.stringify(r).slice(0, 300))
}
{
  // Mezcla en las correcciones: el Gengar (sin producto) vive en otro set y
  // se trae; la otra cambia de producto. Las dos filas tienen forma distinta.
  const b = montar([GENGAR, CON_CM], [
    { id: 'tcggo-69408', set_id: 'tg-647', local_id: '015', name: 'ゲンガー', cm_id_product_propio: null, tcggo_id: 69408 },
    { id: 'tcggo-69409', set_id: 'll1_ja', local_id: '016', name: 'X', cm_id_product_propio: 1, tcggo_id: 69409 },
  ])
  const r = await procesar(b.base)
  const g = b.corregidas.find((c) => c.id === 'tcggo-69408')
  const o = b.corregidas.find((c) => c.id === 'tcggo-69409')
  check('correcciones de dos formas en la misma página: van en lotes separados y las dos llegan', r.ok && g?.set_id === 'll1_ja' && !('cm_id_product_propio' in g) && o?.cm_id_product_propio === 512346, JSON.stringify({ r: JSON.stringify(r).slice(0, 160), c: b.corregidas }))
}
check('porColumnas: un lote por forma de fila', porColumnas([{ a: 1, b: 2 }, { b: 3, a: 4 }, { a: 5 }]).map((g) => g.length).join() === '2,1')
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)

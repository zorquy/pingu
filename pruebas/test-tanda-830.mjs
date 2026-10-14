// Tanda 830 — una japonesa con el id de Cardmarket de ANTES recibe el de TCGGO.
//
// PINGU, con el Gengar de Lost Link (LL 015): TCGGO le da 1.300 € y nosotros
// nada. La carta es la de TCGGO (lleva su `tcggo_id`), pero su
// `cm_id_product_propio` es uno de antes (Scrydex, o el que copió el espejo
// occidental) y la RPC no lo pisa: por producto no casaba nunca.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { procesar, CLAVE_ESTADO, VERSION_JP } = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
const AHORA = new Date('2026-10-14T12:00:00Z')
const GENGAR = { id: 69408, card_number: '015', cardmarket_id: 512345, image: 'https://x/g.png', prices: { cardmarket: { lowest_near_mint: 1300 } } }
const OTRA = { id: 69409, card_number: '016', cardmarket_id: 512346, image: 'https://x/o.png', prices: { cardmarket: { lowest_near_mint: 5 } } }
const montar = (estado = {}) => {
  const estados = {
    [CLAVE_PARES]: { hechos: { sv1: { episodio: 10 } }, episodios: { lista: [{ id: 10, nombre: 'SV', cartas: 1, logo: 'https://x/l.png', valorCm: 1 }] } },
    tcggo_catalogo: { setsPorEpisodio: { JP: {} }, episodiosJp: { lista: [{ id: 647, nombre: 'Lost Link', cartas: 2, logo: 'https://x/e.png', valorCm: 1 }] } },
    [CLAVE_ESTADO]: estado,
  }
  const precios = []
  const corregidas = []
  const rutas = []
  const fetchImpl = async (url) => {
    const u = new URL(url)
    const ep = Number(u.searchParams.get('episode_id'))
    if (/pokemon-jp/.test(u.pathname) && ep === 647) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [GENGAR, OTRA], paging: { current: 1, total: 1, per_page: 100 } }) }
    if (ep === 10) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 1, card_number: '1', cardmarket_id: 500, tcgid: 'x', prices: { cardmarket: { lowest_near_mint: 2 } } }], paging: { current: 1, total: 1, per_page: 100 } }) }
    return { ok: false, status: 404, text: async () => 'no' }
  }
  const restImpl = async (ruta) => {
    const r = decodeURIComponent(ruta)
    rutas.push(r)
    if (/^tcg_sets\?select=id,tcggo_id&market=eq\.JP/.test(r)) return [{ id: 'll1_ja', tcggo_id: 647 }]
    if (/market=eq\.JP/.test(r)) {
      // El Gengar es suyo (tcggo_id 69408) con el id de Cardmarket de ANTES
      // (el occidental, 99999); la otra ya estaba bien.
      const filas = [
        { id: 'tcggo-69408', set_id: 'll1_ja', local_id: '015', name: 'ゲンガー', cm_id_product_propio: 99999, tcggo_id: 69408 },
        { id: 'tcggo-69409', set_id: 'll1_ja', local_id: '016', name: 'X', cm_id_product_propio: 512346, tcggo_id: 69409 },
      ]
      const porTcggo = /tcggo_id\.in\.\(([^)]*)\)/.exec(r)?.[1].split(',').map(Number) || []
      const porCm = /cm_id_product_propio(?:=in|\.in)\.\(([^)]*)\)/.exec(r)?.[1].split(',').map(Number) || []
      return filas.filter((c) => porTcggo.includes(c.tcggo_id) || porCm.includes(c.cm_id_product_propio))
    }
    return [{ id: 'sv1-1', cm_id_product_propio: 777, tcggo_id: 1 }]
  }
  return {
    estados, precios, corregidas, rutas,
    base: {
      env: ENV, fetchImpl, restImpl, pausa: async () => {}, ahora: AHORA,
      guardarImpl: async (f) => { precios.push(...f) }, corregirImpl: async (f) => { corregidas.push(...f) },
      guardarSetsImpl: async (f) => f.length, fotoImpl: async () => 0,
      estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    },
  }
}
const b = montar()
const r = await procesar(b.base)
const gengar = b.precios.find((f) => f.card_id === 'tcggo-69408')
check('el Gengar tiene precio: 1.300 € en japonés, con el producto de TCGGO', r.ok && gengar?.cm_low_ja === 1300 && gengar.cm_id_product === 512345, JSON.stringify({ r: JSON.stringify(r).slice(0, 160), gengar }))
check('  …y su id de Cardmarket pasa del de antes al de TCGGO, con las obligatorias repetidas (la 526)', b.corregidas.length === 1 && b.corregidas[0].id === 'tcggo-69408' && b.corregidas[0].cm_id_product_propio === 512345 && b.corregidas[0].set_id === 'll1_ja' && b.corregidas[0].local_id === '015' && b.corregidas[0].name && b.corregidas[0].market === 'JP', JSON.stringify(b.corregidas))
check('  …la que ya estaba bien, con su precio y sin tocarla', b.precios.some((f) => f.card_id === 'tcggo-69409' && f.cm_low_ja === 5) && !b.corregidas.some((c) => c.id === 'tcggo-69409'))
check('  …cada carta una vez (aunque case por las dos llaves)', b.precios.filter((f) => f.card_id === 'tcggo-69409').length === 1)
check('el occidental no se toca: ni se busca por tcggo_id ni se corrige nada', !b.rutas.some((x) => /market=eq\.WEST/.test(x) && /tcggo_id/.test(x)) && !b.corregidas.some((c) => c.market === 'WEST'))
check('/admin cuenta las corregidas', b.estados[CLAVE_ESTADO].resumenJp?.[647]?.corregidas === 1, JSON.stringify(b.estados[CLAVE_ESTADO].resumenJp))
// Lo japonés hecho HOY con la regla de antes se rehace una vez.
const b2 = montar({ dia: '2026-10-14', hechos: [10], hechosJp: [647], versionJp: 829, gasto: { dia: '2026-10-14', peticiones: 5 }, setsApuntados: true, setsJpApuntados: true, setsConValor: true })
const r2 = await procesar(b2.base)
check('con la regla nueva, lo japonés de hoy se rehace (una vez)', b2.precios.some((f) => f.card_id === 'tcggo-69408') && b2.estados[CLAVE_ESTADO].versionJp === VERSION_JP && b2.estados[CLAVE_ESTADO].hechos.includes(10), JSON.stringify(r2).slice(0, 200))
const antes = b2.precios.length
await procesar(b2.base)
check('  …y la pasada siguiente ya no', b2.precios.length === antes)
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)

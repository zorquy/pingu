// Tanda 1280 — el occidental sigue al id de Cardmarket que corrige TCGGO.
//
// TCGGO anunció (9 de noviembre) que está limpiando `cardmarket_id` mal
// puestos. El japonés ya cambiaba el nuestro por el suyo (830); el occidental
// casaba solo por el que guardamos, así que una carta corregida por ellos se
// quedaba sin precio nuevo, o con el de otra carta. Ahora se corrige si es la
// misma carta (su `tcggo_id`), el número coincide, nadie lo puso a mano y el
// id nuevo no se lo queda otra nuestra.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { cmQueCorregirWest } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const { procesar, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)

console.log('── 1. La regla, a pelo ──')
{
  const c = (id, n, cm, t) => ({ id, local_id: n, cm_id_product_propio: cm, tcggo_id: t })
  const s = (id, n, cm) => ({ id, card_number: n, cardmarket_id: cm })
  const r = cmQueCorregirWest([c('a', '1', 500, 1)], [s(1, '001', 501)])
  check('la suya cambió de id: la nuestra lo sigue (con el número escrito de otra forma)', r.corregir.length === 1 && r.corregir[0].de === 500 && r.corregir[0].a === 501)
  check('si ya coincide, nada', !cmQueCorregirWest([c('a', '1', 501, 1)], [s(1, '1', 501)]).corregir.length)
  check('sin id suyo, nada', !cmQueCorregirWest([c('a', '1', 500, 1)], [s(1, '1', null)]).corregir.length)
  const n = cmQueCorregirWest([c('a', '9', 500, 1)], [s(1, '1', 501)])
  check('otro número: se deja y se cuenta como dudosa', !n.corregir.length && n.dudosas === 1)
  check('corregida a mano en /admin: no se toca (ni cuenta)', !cmQueCorregirWest([c('a', '1', 500, 1)], [s(1, '1', 501)], { aMano: new Set(['a']) }).corregir.length)
  const sw = cmQueCorregirWest([c('a', '5', 950, 5), c('b', '6', 951, 6)], [s(5, '5', 951), s(6, '6', 950)])
  check('dos que se intercambian el id: se corrigen las dos', sw.corregir.length === 2 && !sw.dudosas)
  const ocupado = cmQueCorregirWest([c('a', '7', 960, 7), c('b', '8', 970, 8)], [s(7, '7', 970)])
  check('el id nuevo lo tiene otra nuestra que se queda con él: dudosa', !ocupado.corregir.length && ocupado.dudosas === 1)
  const sinPar = cmQueCorregirWest([c('a', '1', null, 1)], [s(1, '1', 501)])
  check('una sin id todavía lo recibe', sinPar.corregir.length === 1 && sinPar.corregir[0].de === null)
}

console.log('── 2. En la pasada de precios ──')
{
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
  const AHORA = new Date('2026-11-10T12:00:00Z')
  const suya = (id, n, cm, p) => ({ id, card_number: n, cardmarket_id: cm, tcgid: `sv1-${n}`, prices: { cardmarket: { lowest_near_mint: p } } })
  const PAGINA = [suya(1, '1', 501, 3), suya(2, '2', 600, 4), suya(3, '3', 700, 5), suya(4, '4', 800, 6), suya(5, '5', 951, 7), suya(6, '6', 950, 8), suya(7, '7', 970, 9)]
  const NUESTRAS = [
    { id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Uno', cm_id_product_propio: 500, tcggo_id: 1 },
    { id: 'sv1-2', set_id: 'sv1', local_id: '2', name: 'Dos', cm_id_product_propio: 600, tcggo_id: 2 },
    { id: 'sv1-3', set_id: 'sv1', local_id: '9', name: 'Tres', cm_id_product_propio: 690, tcggo_id: 3 },
    { id: 'sv1-4', set_id: 'sv1', local_id: '4', name: 'Cuatro', cm_id_product_propio: 801, tcggo_id: 4 },
    { id: 'sv1-5', set_id: 'sv1', local_id: '5', name: 'Cinco', cm_id_product_propio: 950, tcggo_id: 5 },
    { id: 'sv1-6', set_id: 'sv1', local_id: '6', name: 'Seis', cm_id_product_propio: 951, tcggo_id: 6 },
    { id: 'sv1-7', set_id: 'sv1', local_id: '7', name: 'Siete', cm_id_product_propio: 960, tcggo_id: 7 },
    { id: 'sv1-8', set_id: 'sv1', local_id: '8', name: 'Ocho', cm_id_product_propio: 970, tcggo_id: 8 },
  ]
  const estados = {
    [CLAVE_PARES]: { hechos: { sv1: { episodio: 10 } }, episodios: { lista: [{ id: 10, nombre: 'SV', cartas: 8, logo: 'https://x/l.png', valorCm: 1 }] } },
    tcggo_catalogo: { setsPorEpisodio: { JP: {} }, episodiosJp: { lista: [] } },
    [CLAVE_ESTADO]: {},
  }
  const precios = []
  const corregidas = []
  const rutas = []
  const fetchImpl = async (url) => {
    const ep = Number(new URL(url).searchParams.get('episode_id'))
    if (ep === 10) return { ok: true, status: 200, text: async () => JSON.stringify({ data: PAGINA, paging: { current: 1, total: 1, per_page: 100 } }) }
    return { ok: false, status: 404, text: async () => 'no' }
  }
  const restImpl = async (ruta) => {
    const r = decodeURIComponent(ruta)
    rutas.push(r)
    if (/^tcg_correcciones\?/.test(r)) return [{ id: 'sv1-4' }]
    if (/^tcg_sets\?/.test(r)) return []
    if (/^tcg_cards\?/.test(r) && /market=eq\.WEST/.test(r)) {
      // Como la base: devuelve SOLO las columnas que se piden.
      const cols = /select=([^&]*)/.exec(r)[1].split(',')
      const porTcggo = /tcggo_id(?:=in|\.in)\.\(([^)]*)\)/.exec(r)?.[1].split(',').map(Number) || []
      const porCm = /cm_id_product_propio(?:=in|\.in)\.\(([^)]*)\)/.exec(r)?.[1].split(',').map(Number) || []
      return NUESTRAS.filter((c) => porTcggo.includes(c.tcggo_id) || porCm.includes(c.cm_id_product_propio))
        .map((c) => Object.fromEntries(cols.map((k) => [k, c[k]])))
    }
    return []
  }
  const r = await procesar({
    env: ENV, fetchImpl, restImpl, pausa: async () => {}, ahora: AHORA,
    guardarImpl: async (f) => { precios.push(...f) }, corregirImpl: async (f) => { corregidas.push(...f) },
    guardarSetsImpl: async (f) => f.length, fotoImpl: async () => 0, guardarVersionesImpl: async () => {},
    estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
  })
  const cor = Object.fromEntries(corregidas.map((x) => [x.id, x]))
  check('se corrigen la del id cambiado y las dos del intercambio', r.ok !== false && Object.keys(cor).sort().join() === 'sv1-1,sv1-5,sv1-6' && cor['sv1-1'].cm_id_product_propio === 501 && cor['sv1-5'].cm_id_product_propio === 951 && cor['sv1-6'].cm_id_product_propio === 950, JSON.stringify(corregidas))
  check('  …con las obligatorias repetidas (la 526) y marcadas como de TCGGO', corregidas.every((x) => x.market === 'WEST' && x.set_id === 'sv1' && x.local_id && x.name && x.cm_por === 'tcggo'), JSON.stringify(corregidas[0]))
  check('  …y todas con las mismas columnas', new Set(corregidas.map((x) => Object.keys(x).sort().join())).size === 1)
  const precio = (id) => precios.find((f) => f.card_id === id)?.cm_low_en
  check('el precio de esta misma pasada ya es el de su producto bueno', precio('sv1-1') === 3 && precio('sv1-5') === 7 && precio('sv1-6') === 8, JSON.stringify(precios.map((f) => [f.card_id, f.cm_low_en])))
  check('la que estaba bien, con su precio y sin tocar', precio('sv1-2') === 4 && !cor['sv1-2'])
  check('la de otro número no se corrige', !cor['sv1-3'])
  check('la corregida a mano no se toca', !cor['sv1-4'])
  check('la que pedía un id que tiene otra nuestra no se corrige', !cor['sv1-7'])
  const w = estados[CLAVE_ESTADO].cmWest
  check('el estado lo cuenta para /admin: 3 corregidas, 2 dudosas, y cuáles', w?.dia === '2026-11-10' && w.corregidas === 3 && w.dudosas === 2 && w.ultimas.some((x) => x.id === 'sv1-1' && x.de === 500 && x.a === 501), JSON.stringify(w))
  check('las búsquedas por tcggo_id, dentro de sus sets', rutas.filter((x) => /^tcg_cards\?/.test(x) && /tcggo_id=in/.test(x)).every((x) => /set_id=in\./.test(x)))
  check('las correcciones a mano se preguntan una vez por pasada', rutas.filter((x) => /^tcg_correcciones/.test(x)).length === 1)
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

// Tanda 1195 — las latas de Mega Forces que no salían (foro: «las latas de
// Mega Forces como la de Dragonite, Darkrai… ¿están en el catálogo?»). TCGGO
// las cuelga de su episodio 226, «Pokémon», que tiene 40 páginas ordenadas de
// lo más viejo a lo más nuevo; la pasada se paraba en la 30 y volvía a la 1
// cada día, así que lo nuevo no entraba nunca. La respuesta de TCGGO pegada
// por PINGU (la lata, id 78965) es el fixture: tal cual, campo a campo.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const fn = await import(`${RAIZ}/netlify/functions/tcggo-productos.mjs`)
const { filaDeProducto } = await import(`${RAIZ}/js/productos.js`)

const EPISODIO = { id: 226, name: 'Pokémon', slug: 'pokemon', lang: 'en', released_at: '2000-01-01', logo: null, symbol: null, code: null, cards_total: 0, cards_printed_total: 0, prices: { cardmarket: { total: 0, currency: 'EUR' }, tcgplayer: { total: 0, currency: 'EUR' } }, game: { name: 'Pokémon', slug: 'pokemon' }, series: null }
const DRAGONITE = {
  id: 78965, name: 'Mega Forces Tins: Mega Dragonite ex Tin', slug: 'mega-forces-tins-mega-dragonite-ex-tin', lang: 'en',
  prices: { cardmarket: { currency: 'EUR', lowest: 39.75, lowest_EU_only: 39.75, lowest_DE: 23.99, lowest_DE_EU_only: 23.99, lowest_FR: 24.49, lowest_FR_EU_only: 24.49, lowest_ES: 26.99, lowest_ES_EU_only: 26.99, lowest_IT: 21, lowest_IT_EU_only: 21, '30d_average': 24.7, available_items: 486, '7d_average': 26.77 }, tcg_player: { currency: 'EUR', market_price: null } },
  msrp: null, episode: EPISODIO,
  image: 'https://images.tcggo.com/tcggo/storage/71011/mega-forces-tins-mega-dragonite-ex-tin.png',
  tcggo_url: 'https://www.tcggo.com/pokemon/pokemon/mega-forces-tins-mega-dragonite-ex-tin',
  links: { cardmarket: 'https://www.tcggo.com/external/cm/78965', tcgplayer: 'https://www.tcggo.com/external/tcgplayer/78965' },
  cardmarket_id: 894473, tcgplayer_id: 702505,
}

console.log('── 1. La lata, tal como la da TCGGO, se guarda ──')
{
  const f = filaDeProducto(DRAGONITE, { ahora: new Date('2026-11-03T10:00:00Z') })
  check('es una fila de producto con su id, su nombre y su foto', f && f.id === 78965 && /Mega Dragonite ex Tin/.test(f.name) && /images\.tcggo\.com/.test(f.image || f.image_url || JSON.stringify(f)), JSON.stringify(f))
  check('  …con el precio en español', f.cm_lowest_es === 26.99, f.cm_lowest_es)
}

console.log('── 2. Con 40 páginas, la pasada llega a la última ──')
const montar = ({ paginas = 40, estado = {} } = {}) => {
  const llamadas = []
  const escritas = []
  let guardado = estado
  const restImpl = async (ruta, o) => {
    if (ruta.startsWith('tcg_products?select=')) return []
    if (ruta.startsWith('scrydex_estado?select')) return [{ valor: guardado }]
    if (ruta === 'scrydex_estado') { guardado = JSON.parse(o.body)[0].valor; return null }
    if (ruta.startsWith('tcg_sets?')) return []
    if (ruta === 'tcg_products') { escritas.push(...JSON.parse(o.body)); return null }
    if (ruta.startsWith('tcg_product_contenido')) return null
    throw new Error(`ruta inesperada ${ruta}`)
  }
  const fetchImpl = async (url) => {
    llamadas.push(url)
    const m = /\/episodes\/226\/products\?page=(\d+)/.exec(url)
    if (!m) return new Response('Not found', { status: 404 })
    const p = Number(m[1])
    // La lata nueva, en la última página (lo más nuevo va al final).
    const data = p === paginas ? [DRAGONITE] : [{ ...DRAGONITE, id: 20000 + p, name: `Producto viejo ${p}`, cardmarket_id: 500000 + p }]
    return new Response(JSON.stringify({ data, paging: { current: p, total: paginas, per_page: 20 }, results: paginas * 20 }), { status: 200 })
  }
  return { llamadas, escritas, restImpl, fetchImpl, estado: () => guardado }
}
const env = { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k' }
{
  const a = montar({ estado: { revision: fn.REVISION, revisionSueltos: fn.REVISION_SUELTOS } })
  for (let h = 0; h < 10; h++) await fn.procesar({ env, ahora: new Date(Date.UTC(2026, 10, 3, h)), restImpl: a.restImpl, fetchImpl: a.fetchImpl })
  const pags = a.llamadas.filter((u) => /episodes\/226/.test(u)).map((u) => Number(/page=(\d+)/.exec(u)[1]))
  check('pide las 40 páginas en un día, una vez cada una', pags.length === 40 && new Set(pags).size === 40 && Math.max(...pags) === 40, `${pags.length} peticiones, hasta la ${Math.max(...pags)}`)
  check('  …y la lata de Mega Dragonite (última página) se escribe', a.escritas.some((f) => f.id === 78965 && f.episode_id === 226), a.escritas.length)
  check('  …y entonces está hecho por hoy', a.estado().hechos['226'] === '2026-11-03' && !a.estado().sigue['226'])
}

console.log('── 3. Lo que hoy se dio por hecho con el tope viejo, se recupera ya ──')
{
  // El estado de producción de hoy: hecho tras 30 páginas, sin la revisión.
  const b = montar({ estado: { revision: fn.REVISION, dia: '2026-11-03', peticiones: 120, hechos: { 226: '2026-11-03' }, sigue: {} } })
  for (let h = 12; h < 15; h++) await fn.procesar({ env, ahora: new Date(Date.UTC(2026, 10, 3, h)), restImpl: b.restImpl, fetchImpl: b.fetchImpl })
  const pags = b.llamadas.filter((u) => /episodes\/226/.test(u)).map((u) => Number(/page=(\d+)/.exec(u)[1]))
  check('sigue desde la 31 (no repite las 30 de esta mañana) hasta la 40', pags[0] === 31 && pags.at(-1) === 40 && pags.length === 10, JSON.stringify(pags))
  check('  …y entra la lata', b.escritas.some((f) => f.id === 78965))
  check('  …una sola vez: la revisión queda apuntada', b.estado().revisionSueltos === fn.REVISION_SUELTOS && b.estado().hechos['226'] === '2026-11-03')
}
{
  const c = montar({ paginas: 1000, estado: { revision: fn.REVISION, revisionSueltos: fn.REVISION_SUELTOS } })
  for (let h = 0; h < 24; h++) await fn.procesar({ env, ahora: new Date(Date.UTC(2026, 10, 3, h)), restImpl: c.restImpl, fetchImpl: c.fetchImpl })
  const n = c.llamadas.filter((u) => /episodes\/226/.test(u)).length
  check(`una paginación que no acaba sigue teniendo tope: ${fn.MAX_PAGINAS_SUELTOS} páginas al día como mucho (la 510)`, n <= fn.MAX_PAGINAS_SUELTOS + fn.MAX_PAGINAS && c.estado().hechos['226'] === '2026-11-03', `${n}`)
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

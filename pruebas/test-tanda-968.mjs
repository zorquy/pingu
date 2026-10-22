// Tanda 968 — los productos que no son de ninguna expansión, y buscarlos.
//
// Sergio.M: «faltan las latas de Mega Charizard X y Mega Charizard Y»; TCGGO
// las cuelga de su episodio 226, «Pokémon», que no es ningún set nuestro. Y
// PINGU: «en el buscador general también debería salirte productos; en el
// apartado de productos también tendríamos que tener un buscador».
//
// Aquí lo puro (cómo se parte lo escrito, español contra inglés), la
// consulta que se arma, y la función programada: pide el 226, por tandas,
// sin pasarse del tope, y sin contar sus 404 como «la ruta es otra».
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { terminosDeProducto, filtroDeTermino, rutaDeProducto } = await import(`${RAIZ}/js/productos.js`)
const fn = await import(`${RAIZ}/netlify/functions/tcggo-productos.mjs`)

console.log('── 1. Lo escrito, partido ──')
{
  const t = terminosDeProducto('Lata  Charizard')
  check('«lata charizard»: dos condiciones, la lata vale como «tin»', JSON.stringify(t) === JSON.stringify([['lata', 'tin'], ['charizard']]), JSON.stringify(t))
  check('sin acentos ni mayúsculas, y «pokemon» casa con «Pokémon»', JSON.stringify(terminosDeProducto('Colección POKÉMON')) === JSON.stringify([['coleccion', 'collection'], ['pokemon', 'pokémon']]), JSON.stringify(terminosDeProducto('Colección POKÉMON')))
  check('los signos fuera (en un `or` de PostgREST una coma o un paréntesis lo romperían)', JSON.stringify(terminosDeProducto('ETB, (151)*%')) === JSON.stringify([['etb'], ['151']]))
  check('una palabra repetida, una vez; vacío, nada', terminosDeProducto('tin tin').length === 1 && terminosDeProducto('  ').length === 0)
  check('el filtro de una palabra: sus alternativas en el nombre', filtroDeTermino(['lata', 'tin']) === 'name.ilike.*lata*,name.ilike.*tin*')
  check('un producto lleva a /cartas › Productos con su id (se ve sin cuenta)', rutaDeProducto({ id: 31415 }) === '/cartas?ver=productos&producto=31415')
}

console.log('\n── 2. La consulta ──')
{
  const { buscarProductos } = await import(`${RAIZ}/js/productos-valor.js`)
  const llamadas = []
  const q = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : (...a) => { llamadas.push([k, ...a]); return q }) })
  const cliente = { from: (t) => { llamadas.push(['from', t]); return q } }
  await buscarProductos('lata charizard', { mercado: 'WEST', limite: 5, cliente })
  const ors = llamadas.filter(([k]) => k === 'or').map(([, x]) => x)
  check('un `or` por palabra (PostgREST los junta con AND)', JSON.stringify(ors) === JSON.stringify(['name.ilike.*lata*,name.ilike.*tin*', 'name.ilike.*charizard*']), JSON.stringify(ors))
  check('  …del catálogo pedido', llamadas.some(([k, c, v]) => k === 'eq' && c === 'market' && v === 'WEST'))
  check('  …los que salen antes primero, con los sin fecha al final', llamadas.some(([k, c, o]) => k === 'order' && c === 'release_date' && o?.ascending === false && o?.nullsFirst === false))
  check('  …y con su tope', llamadas.some(([k, n]) => k === 'limit' && n === 5))
  llamadas.length = 0
  const r = await buscarProductos(' , ', { cliente })
  check('sin palabras, ni se pregunta', llamadas.length === 0 && r.data.length === 0 && r.error === null)
}

console.log('\n── 3. La función: el episodio «Pokémon» (226) ──')
{
  check('por defecto, el 226 occidental', JSON.stringify(fn.episodiosSueltos({})) === JSON.stringify([{ id: 226, mercado: 'WEST' }]))
  check('  …y la variable lo sustituye (con «JP:» para el japonés)', JSON.stringify(fn.episodiosSueltos({ TCGGO_EPISODIOS_SUELTOS: '226, JP:12, raro' })) === JSON.stringify([{ id: 226, mercado: 'WEST' }, { id: 12, mercado: 'JP' }]))
  const LATA = (id, nombre) => ({ id, name: nombre, lang: 'en', episode: { id: 226, name: 'Pokémon', released_at: null }, prices: { cardmarket: { lowest: 30, lowest_EU_only: 30, lowest_ES: 28 } } })
  const montar = ({ paginas = 1, estado = {}, sets = [] } = {}) => {
    const llamadas = []
    const escritas = []
    let guardado = estado
    const restImpl = async (ruta, o) => {
      if (ruta.startsWith('tcg_products?select=')) return []
      if (ruta.startsWith('scrydex_estado?select')) return [{ valor: guardado }]
      if (ruta === 'scrydex_estado') { guardado = JSON.parse(o.body)[0].valor; return null }
      if (ruta.startsWith('tcg_sets?')) return sets
      if (ruta === 'tcg_products') { escritas.push(...JSON.parse(o.body)); return null }
      throw new Error(`ruta inesperada ${ruta}`)
    }
    const fetchImpl = async (url) => {
      llamadas.push(url)
      const m = /\/episodes\/226\/products\?page=(\d+)/.exec(url)
      if (!m) return new Response('Not found', { status: 404 })
      const p = Number(m[1])
      return new Response(JSON.stringify({ data: [LATA(31415 + p * 10, `Mega Charizard X ex Tin ${p}`), LATA(31416 + p * 10, `Mega Charizard Y ex Tin ${p}`)], paging: { current: p, total: paginas } }), { status: 200 })
    }
    return { llamadas, escritas, restImpl, fetchImpl, estado: () => guardado }
  }
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k' }
  const ahora = new Date('2026-10-22T10:00:00Z')

  const a = montar({ estado: { revision: fn.REVISION } })
  await fn.procesar({ env, ahora, restImpl: a.restImpl, fetchImpl: a.fetchImpl })
  check('sin ningún set nuestro con ese id, el 226 se pide', a.llamadas.some((u) => /\/episodes\/226\/products\?page=1/.test(u)), a.llamadas.join(' '))
  check('  …y sus latas se escriben como del 226, occidentales', a.escritas.length === 2 && a.escritas.every((f) => f.episode_id === 226 && f.market === 'WEST') && /Mega Charizard X ex Tin/.test(a.escritas[0].name), JSON.stringify(a.escritas.map((f) => [f.id, f.episode_id, f.market])))
  check('  …con el precio en español', a.escritas[0].cm_lowest_es === 28)
  check('  …y queda hecho por hoy', a.estado().hechos['226'] === '2026-10-22' && !a.estado().sigue?.['226'])
  await fn.procesar({ env, ahora: new Date('2026-10-22T11:00:00Z'), restImpl: a.restImpl, fetchImpl: a.fetchImpl })
  check('la pasada de una hora después no lo vuelve a pedir', a.llamadas.filter((u) => /episodes\/226/.test(u)).length === 1)
  await fn.procesar({ env, ahora: new Date('2026-10-23T10:00:00Z'), restImpl: a.restImpl, fetchImpl: a.fetchImpl })
  check('  …y al día siguiente, sí (lo nuevo sale ahí)', a.llamadas.filter((u) => /episodes\/226/.test(u)).length === 2)

  const b = montar({ paginas: 15, estado: { revision: fn.REVISION } })
  await fn.procesar({ env, ahora, restImpl: b.restImpl, fetchImpl: b.fetchImpl })
  const pag = () => b.llamadas.filter((u) => /episodes\/226/.test(u)).map((u) => Number(/page=(\d+)/.exec(u)[1]))
  check(`con 15 páginas, la primera pasada pide ${fn.MAX_PAGINAS} y apunta por dónde va`, JSON.stringify(pag()) === JSON.stringify([1, 2, 3, 4, 5, 6]) && b.estado().sigue['226'] === 7 && !b.estado().hechos['226'], `${pag()} sigue=${b.estado().sigue?.['226']}`)
  await fn.procesar({ env, ahora: new Date('2026-10-22T11:00:00Z'), restImpl: b.restImpl, fetchImpl: b.fetchImpl })
  await fn.procesar({ env, ahora: new Date('2026-10-22T12:00:00Z'), restImpl: b.restImpl, fetchImpl: b.fetchImpl })
  check('  …las siguientes siguen por ahí hasta la última, y entonces está hecho', pag().length === 15 && pag().at(-1) === 15 && b.estado().hechos['226'] === '2026-10-22' && !b.estado().sigue['226'], `${pag()}`)

  const c = montar({ paginas: 1000, estado: { revision: fn.REVISION } })
  for (let h = 0; h < 12; h++) await fn.procesar({ env, ahora: new Date(Date.UTC(2026, 9, 22, h)), restImpl: c.restImpl, fetchImpl: c.fetchImpl })
  const n = c.llamadas.filter((u) => /episodes\/226/.test(u)).length
  check(`una paginación que no acaba: como mucho ${fn.MAX_PAGINAS_SUELTOS} páginas al día (la 510)`, n <= fn.MAX_PAGINAS_SUELTOS + fn.MAX_PAGINAS && c.estado().hechos['226'] === '2026-10-22', `${n} páginas`)

  const d = montar({ estado: { revision: fn.REVISION } })
  const fetch404 = async (url) => { d.llamadas.push(url); return new Response('Not found', { status: 404 }) }
  await fn.procesar({ env, ahora, restImpl: d.restImpl, fetchImpl: fetch404 })
  check('si el 226 da 404, no cuenta como «ninguna ruta contesta»', !d.estado().sinRuta && !d.estado().parado, JSON.stringify(d.estado()))

  const e = montar({ estado: { revision: fn.REVISION }, sets: [{ id: 'x', market: 'WEST', tcggo_id: 226, release_date: '2020-01-01' }] })
  await fn.procesar({ env, ahora, restImpl: e.restImpl, fetchImpl: e.fetchImpl })
  check('si un set nuestro ya fuera el 226, se pide como ese set (una vez)', e.llamadas.filter((u) => /episodes\/226\/products\?page=1/.test(u)).length === 1)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

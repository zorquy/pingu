// Tanda 813 (VE1) — la lista de expansiones, desde la CDN.
//   1. La función: solo mercados que existen, a trozos (Supabase corta a
//      1.000), cabeceras de CDN en la buena y NINGUNA en la mala.
//   2. El ayudante: CDN primero, Supabase si no contesta, una sola petición
//      para dos llamadas, y un fallo que no se queda guardado.
//   3. /mi-coleccion lo usa para la estantería y para el Panel.
import { readFileSync } from 'node:fs'
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const fn = await import(`${RAIZ}/netlify/functions/sets.mjs`)
const ayu = await import(`${RAIZ}/js/sets-catalogo.js`)

console.log('── 1. La función ──')
{
  check('market=JP vale, «todos» vale, uno inventado no', fn.mercadoDePeticion('https://x/f?market=JP') === 'JP' && fn.mercadoDePeticion('https://x/f?market=todos') === 'todos' && fn.mercadoDePeticion('https://x/f?market=XX') === null && fn.mercadoDePeticion('https://x/f') === null)
  const r400 = await fn.responder(new Request('https://x/f?market=XX'), { fetchImpl: async () => { throw new Error('no se pide') } })
  check('  …y el inventado es un 400 sin preguntar a nadie', r400.status === 400)
  const pedidas = []
  const fila = (i) => ({ id: `s${i}`, market: 'WEST' })
  const fetchImpl = async (u) => {
    pedidas.push(decodeURIComponent(u))
    const off = Number(u.match(/offset=(\d+)/)[1])
    const n = off === 0 ? 1000 : 230
    return { ok: true, json: async () => Array.from({ length: n }, (_, k) => fila(off + k)) }
  }
  const r = await fn.responder(new Request('https://x/f?market=WEST'), { fetchImpl })
  const cuerpo = await r.json()
  check('a trozos: 1.230 sets en dos peticiones (con .limit(2000) venían 1.000)', cuerpo.sets.length === 1230 && pedidas.length === 2, `${cuerpo.sets.length} en ${pedidas.length}`)
  check('  …del mercado, sin los escondidos y con las columnas de la estantería', /market=eq\.WEST/.test(pedidas[0]) && /oculto=not\.is\.true/.test(pedidas[0]) && pedidas[0].includes(fn.COLUMNAS) && /order=release_date\.desc\.nullslast,id\.asc/.test(pedidas[0]))
  check('  …y la CDN la guarda (durable, con stale-while-revalidate y su etiqueta; el navegador no, desde la 908)', /durable/.test(r.headers.get('netlify-cdn-cache-control') || '') && /stale-while-revalidate/.test(r.headers.get('netlify-cdn-cache-control') || '') && /max-age=0, must-revalidate/.test(r.headers.get('cache-control') || '') && r.headers.get('netlify-cache-tag') === 'sets')
  pedidas.length = 0
  await fn.responder(new Request('https://x/f?market=todos'), { fetchImpl })
  check('«todos» no filtra por mercado', !/market=eq/.test(pedidas[0]))
  const mala = await fn.responder(new Request('https://x/f?market=JP'), { fetchImpl: async () => ({ ok: false, status: 503 }) })
  check('si Supabase falla: 502 y SIN caché de CDN (no se guarda un fallo diez minutos)', mala.status === 502 && !mala.headers.get('netlify-cdn-cache-control') && /no-store/.test(mala.headers.get('cache-control') || ''))
  const ayuJs = readFileSync(`${RAIZ}/js/sets-catalogo.js`, 'utf8')
  const colsAyu = (ayuJs.match(/const COLUMNAS = '([^']+)'/) || [])[1]
  check('el respaldo pide LAS MISMAS columnas que la función', colsAyu === fn.COLUMNAS)
}

console.log('\n── 2. El ayudante ──')
{
  // Un cliente de mentira que registra lo que se le pide.
  const llamadas = []
  const cliente = (filas) => ({
    from: (t) => {
      const q = { t, eq: [], rango: null }
      const api = {
        select: () => api,
        eq: (c, v) => { q.eq.push([c, v]); return api },
        order: () => api,
        range: (a, b) => { q.rango = [a, b]; llamadas.push(q); return Promise.resolve({ data: filas.slice(a, b + 1), error: null }) },
      }
      return api
    },
  })
  ayu.olvidarSets()
  let veces = 0
  const cdn = async () => { veces++; return { ok: true, json: async () => ({ sets: [{ id: 'a' }] }) } }
  const [x, y] = await Promise.all([ayu.setsDelCatalogo('WEST', { fetchImpl: cdn }), ayu.setsDelCatalogo('WEST', { fetchImpl: cdn })])
  check('de la CDN, y dos llamadas a la vez comparten una petición', x[0].id === 'a' && x === y && veces === 1, veces)
  ayu.olvidarSets()
  const filas = [{ id: 'v1' }, { id: 'esc', oculto: true }, { id: 'v2' }]
  const z = await ayu.setsDelCatalogo('JP', { fetchImpl: async () => ({ ok: false, status: 404 }), cliente: cliente(filas) })
  check('si la CDN da 404 (o no existe, como en las pruebas), de Supabase', z.map((s) => s.id).join() === 'v1,v2', JSON.stringify(z))
  check('  …filtrando por mercado y con .range()', llamadas[0].eq.some(([c, v]) => c === 'market' && v === 'JP') && llamadas[0].rango[0] === 0)
  ayu.olvidarSets()
  const grandes = Array.from({ length: 1500 }, (_, i) => ({ id: `g${i}` }))
  llamadas.length = 0
  const g = await ayu.setsDelCatalogo('todos', { fetchImpl: async () => { throw new Error('red') }, cliente: cliente(grandes) })
  check('  …a trozos: 1.500 en dos, y «todos» sin filtro', g.length === 1500 && llamadas.length === 2 && llamadas[0].eq.length === 0, `${g.length} / ${llamadas.length}`)
  ayu.olvidarSets()
  const roto = { from: () => { const a = { select: () => a, eq: () => a, order: () => a, range: () => Promise.resolve({ data: null, error: { message: 'x' } }) }; return a } }
  let fallo = false
  await ayu.setsDelCatalogo('CN', { fetchImpl: async () => ({ ok: false, status: 500 }), cliente: roto }).catch(() => { fallo = true })
  const otra = await ayu.setsDelCatalogo('CN', { fetchImpl: cdn })
  check('si fallan las dos, rechaza… y la siguiente vuelve a preguntar', fallo && otra[0].id === 'a')
}

console.log('\n── 3. /mi-coleccion ──')
{
  const mc = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  const tramo = (n) => mc.slice(mc.indexOf(`async function ${n}() {`), mc.indexOf('\n}\n', mc.indexOf(`async function ${n}() {`)))
  check('la estantería sale del ayudante', /setsDelCatalogo\(mercado/.test(tramo('cargarSets')) && !/from\('tcg_sets'\)/.test(tramo('cargarSets')))
  check('  …y el Panel también, con «todos»', /setsDelCatalogo\('todos'/.test(tramo('cargarSetsDeTodos')) && !/limit\(2000\)/.test(tramo('cargarSetsDeTodos')))
  check('  …y un fallo de las dos no se guarda como estantería vacía', /if \(!sets\) return \[\]/.test(tramo('cargarSets')) && /if \(!sets\) return \[\]/.test(tramo('cargarSetsDeTodos')))
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

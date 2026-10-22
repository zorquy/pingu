// Tanda 808 — los productos que no salían.
//
// PINGU: «no están todos: solo hasta Stellar Crown, y hacia abajo solo
// hasta Evolutions; y el catálogo japonés de productos está vacío».
//   1. La estantería contaba con una consulta que Supabase corta a 1.000
//      filas sin error: la cuenta la hace ahora la base, y sin la migración
//      se cuenta a trozos.
//   2. La función pedía los productos de los sets japoneses a la puerta
//      OCCIDENTAL, y la tabla no decía de qué catálogo es cada producto.
//   3. La migración, contra PostgreSQL, con más de 1.000 productos.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const pestana = await import(`${RAIZ}/js/mi-coleccion/productos.js`)
const fn = await import(`${RAIZ}/netlify/functions/tcggo-productos.mjs`)

// Un cliente de Supabase de mentira que CORTA a 1.000 filas, como el de
// verdad (y sin decir nada), con o sin la migración de la 808.
const TOPE = 1000
const clienteDe = (filas, { migrado = true } = {}) => {
  const llamadas = []
  const consulta = (st) => {
    const resolver = async () => {
      if (!migrado && st.filtros.some(([c]) => c === 'market')) return { data: null, error: { code: '42703', message: 'column tcg_products.market does not exist' } }
      let r = filas.filter((f) => st.filtros.every(([c, v]) => String(c === 'market' ? f.market || 'WEST' : f[c]) === String(v)))
      if (st.orden) r = [...r].sort((a, b) => (a[st.orden] > b[st.orden] ? 1 : -1))
      if (st.rango) r = r.slice(st.rango[0], st.rango[1] + 1)
      r = r.slice(0, Math.min(st.limite ?? TOPE, TOPE))
      return { data: r.map((f) => ({ ...f })), error: null }
    }
    return {
      select: (c) => consulta({ ...st, cols: c }),
      eq: (c, v) => consulta({ ...st, filtros: [...st.filtros, [c, v]] }),
      order: (c) => consulta({ ...st, orden: c }),
      limit: (n) => consulta({ ...st, limite: n }),
      range: (a, b) => consulta({ ...st, rango: [a, b] }),
      then: (ok, ko) => resolver().then(ok, ko),
    }
  }
  return {
    llamadas,
    from: (t) => { llamadas.push(`from:${t}`); return consulta({ filtros: [] }) },
    rpc: async (nombre, args) => {
      llamadas.push(`rpc:${nombre}`)
      if (!migrado) return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${nombre}` } }
      const cuenta = new Map()
      for (const f of filas) if ((f.market || 'WEST') === args.p_market && f.episode_id != null) cuenta.set(f.episode_id, (cuenta.get(f.episode_id) || 0) + 1)
      return { data: [...cuenta].map(([episode_id, productos]) => ({ episode_id, productos })), error: null }
    },
  }
}
// 2.500 productos occidentales en 50 expansiones (50 por expansión) y 40
// japoneses en 2: lo bastante para que 1.000 filas dejen fuera a la mitad.
const OCC = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1, episode_id: 100 + Math.floor(i / 50), market: 'WEST', name: `P${i}` }))
const JP = Array.from({ length: 40 }, (_, i) => ({ id: fn.ID_JP + i + 1, episode_id: 100 + (i % 2), market: 'JP', name: `J${i}` }))

console.log('── 1. La cuenta de la estantería ──')
{
  const viejo = new Set(OCC.slice(0, TOPE).map((f) => f.episode_id))
  check('el problema, medido: con 1.000 filas solo salen 20 de las 50 expansiones', viejo.size === 20)
  const c = await pestana.cuentaDeProductos(clienteDe([...OCC, ...JP]), 'WEST')
  check('con la migración: las 50 occidentales, con 50 cada una', c.size === 50 && [...c.values()].every((n) => n === 50), `${c.size}`)
  const j = await pestana.cuentaDeProductos(clienteDe([...OCC, ...JP]), 'JP')
  check('  …y el japonés, solo lo japonés (el 100 japonés no es el 100 occidental)', j.size === 2 && j.get(100) === 20 && j.get(101) === 20, JSON.stringify([...j]))
  const sin = clienteDe(OCC.map(({ market, ...f }) => f), { migrado: false })
  const s = await pestana.cuentaDeProductos(sin, 'WEST')
  check('sin la migración: a trozos de 1.000, también salen las 50', s.size === 50 && [...s.values()].every((n) => n === 50), `${s?.size}`)
  check('  …y el japonés, vacío (sin la columna no hay productos japoneses)', (await pestana.cuentaDeProductos(sin, 'JP')).size === 0)
  // Nadie más cuenta productos pidiendo la tabla entera.
  const malos = []
  const recorrer = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) recorrer(p); else if (/\.m?js$/.test(n)) readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/from\('tcg_products'\)\.select\('episode_id'\)\.limit\(/.test(l)) malos.push(`${p}:${i + 1}`) }) } }
  recorrer(join(RAIZ, 'js'))
  check('ninguna consulta de productos fía la cuenta a un `.limit()`', malos.length === 0, malos.join(', '))
}

console.log('\n── 1b. Los productos de una expansión, por catálogo ──')
{
  const r = await pestana.productosDeExpansion(clienteDe([...OCC, ...JP]), 100, 'JP')
  check('la expansión 100 japonesa: sus 20, ninguno occidental', r.data.length === 20 && r.data.every((f) => f.market === 'JP'), r.data.length)
  const w = await pestana.productosDeExpansion(clienteDe([...OCC, ...JP]), 100, 'WEST')
  check('  …y la occidental, sus 50', w.data.length === 50 && w.data.every((f) => f.market === 'WEST'))
  const sin = clienteDe(OCC.map(({ market, ...f }) => f), { migrado: false })
  const v = await pestana.productosDeExpansion(sin, 100, 'WEST')
  check('sin la migración, lo de antes (todo occidental), sin romper', !v.error && v.data.length === 50)
  check('  …y el japonés vacío, sin error', (await pestana.productosDeExpansion(sin, 100, 'JP')).data.length === 0)
  const lanz = readFileSync(join(RAIZ, 'js/lanzamientos-productos.js'), 'utf8')
  check('/lanzamientos filtra por el catálogo de su expansión', /\.eq\('market', siguiente\.mercado/.test(lanz))
}

console.log('\n── 2. La función: cada catálogo por su puerta ──')
{
  const PROD = (id, ep, lang = 'en') => ({ id, name: `Producto ${id}`, lang, episode: { id: ep, released_at: '2024-01-01' }, prices: { cardmarket: { lowest: 10 } } })
  const montar = ({ conMercado = true, jpContesta = true, estado = {} } = {}) => {
    const llamadas = []
    const escritas = []
    let guardado = estado
    const restImpl = async (ruta, o) => {
      if (ruta.startsWith('tcg_products?select=id')) return []
      if (ruta.startsWith('tcg_products?select=market')) { if (!conMercado) throw new Error('Supabase 400: column tcg_products.market does not exist'); return [] }
      if (ruta.startsWith('tcg_products?select=')) return []
      if (ruta.startsWith('scrydex_estado?select')) return [{ valor: guardado }]
      if (ruta === 'scrydex_estado') { guardado = JSON.parse(o.body)[0].valor; return null }
      if (ruta.startsWith('tcg_sets?')) return [
        { id: 'sv7', market: 'WEST', tcggo_id: 93, release_date: '2024-09-13' },
        { id: 'SV7', market: 'JP', tcggo_id: 93, release_date: '2024-07-19' },
      ]
      if (ruta === 'tcg_products') { escritas.push(...JSON.parse(o.body)); return null }
      throw new Error(`ruta inesperada ${ruta}`)
    }
    const fetchImpl = async (url) => {
      llamadas.push(url)
      const jp = /\/pokemon-jp\//.test(url)
      if (jp && !jpContesta) return new Response('Not found', { status: 404 })
      if (!/\/episodes\/93\/products/.test(url)) return new Response('Not found', { status: 404 })
      return new Response(JSON.stringify({ data: jp ? [PROD(7, 93, 'ja'), PROD(8, 93, 'ja')] : [PROD(7, 93)], paging: { current: 1, total: 1 } }), { status: 200 })
    }
    return { llamadas, escritas, restImpl, fetchImpl, estado: () => guardado }
  }
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k', TCGGO_EPISODIOS_SUELTOS: '' }
  const ahora = new Date('2026-10-13T10:00:00Z')
  const m = montar()
  await fn.procesar({ env, ahora, restImpl: m.restImpl, fetchImpl: m.fetchImpl })
  check('el set japonés se pide a la puerta japonesa', m.llamadas.some((u) => /\/pokemon-jp\/episodes\/93\/products/.test(u)) && m.llamadas.some((u) => /\/pokemon\/episodes\/93\/products/.test(u)), JSON.stringify(m.llamadas))
  const jp = m.escritas.filter((f) => f.market === 'JP')
  const occ = m.escritas.filter((f) => f.market === 'WEST')
  check('  …y lo japonés se escribe como japonés, con su id desplazado', jp.length === 2 && jp.every((f) => f.id > fn.ID_JP && f.episode_id === 93), JSON.stringify(jp.map((f) => [f.id, f.market])))
  check('  …sin pisar al occidental del mismo número (el 7)', occ.length === 1 && occ[0].id === 7 && jp.some((f) => f.id === fn.ID_JP + 7))
  check('  …y cada uno apuntado por separado en `hechos`', m.estado().hechos['93'] && m.estado().hechos['JP:93'] && m.estado().revision === fn.REVISION, JSON.stringify(m.estado().hechos))

  const s = montar({ conMercado: false })
  await fn.procesar({ env, ahora, restImpl: s.restImpl, fetchImpl: s.fetchImpl })
  check('sin la migración: lo japonés NO se pide (no se podría guardar como japonés)', !s.llamadas.some((u) => /pokemon-jp/.test(u)) && s.escritas.every((f) => !('market' in f)), JSON.stringify(s.llamadas))

  // El japonés sin ruta que conteste: se aparta una semana, lo occidental sigue.
  const sets = Array.from({ length: 7 }, (_, i) => ({ id: `J${i}`, market: 'JP', tcggo_id: 500 + i, release_date: '2024-01-01' }))
  const n = montar({ jpContesta: false })
  const restNo = async (ruta, o) => (ruta.startsWith('tcg_sets?') ? sets : n.restImpl(ruta, o))
  await fn.procesar({ env, ahora, restImpl: restNo, fetchImpl: n.fetchImpl })
  await fn.procesar({ env, ahora: new Date('2026-10-13T11:00:00Z'), restImpl: restNo, fetchImpl: n.fetchImpl })
  check('seis japonesas sin ninguna ruta: el japonés se aparta una semana', n.estado().jpSinRuta?.hasta === '2026-10-20' && !n.estado().parado, JSON.stringify({ jp: n.estado().jpSinRuta, parado: n.estado().parado }))
  const antes = n.llamadas.length
  await fn.procesar({ env, ahora: new Date('2026-10-13T12:00:00Z'), restImpl: restNo, fetchImpl: n.fetchImpl })
  check('  …y mientras tanto no se le pide nada', n.llamadas.length === antes)

  check(`lo que cuesta: ${fn.MAX_EXPANSIONES} × ${fn.MAX_PAGINAS} por pasada × 24 = ${fn.MAX_EXPANSIONES * fn.MAX_PAGINAS * 24} al día, con el tope (${fn.TOPE_DIARIO}) delante`, fn.TOPE_DIARIO <= 1000 && fn.MAX_EXPANSIONES * fn.MAX_PAGINAS <= 40)
}

console.log('\n── 3. La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_808'])
    psql(['-c', 'create database prueba_808'])
    // La tabla de la 762, tal cual (sin `user_products`, que pide auth).
    const sql = readFileSync(join(RAIZ, 'supabase-migration-productos.sql'), 'utf8')
    const tabla = sql.slice(sql.indexOf('create table if not exists public.tcg_products'), sql.indexOf(');', sql.indexOf('create table if not exists public.tcg_products')) + 2)
    const prep = psql(['-d', 'prueba_808', '-c', `${tabla} alter table public.tcg_products enable row level security; create policy tcg_products_ver on public.tcg_products for select to anon, authenticated using (true); grant select on public.tcg_products to anon, authenticated;`])
    check('la tabla de la 762', prep.status === 0, prep.stderr)
    const mig = join(RAIZ, 'supabase-migration-productos-mercado.sql')
    for (let i = 0; i < 2; i++) {
      const r = psql(['-d', 'prueba_808', '-f', mig])
      check(`la migración carga${i ? ' otra vez' : ''}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    psql(['-d', 'prueba_808', '-c', "insert into public.tcg_products (id, episode_id, name) select g, 100 + g / 50, 'P' || g from generate_series(0, 2499) g; insert into public.tcg_products (id, episode_id, name, market) select 1000000000 + g, 100 + g % 2, 'J' || g, 'JP' from generate_series(1, 40) g;"])
    const w = psql(['-t', '-A', '-d', 'prueba_808', '-c', "set role anon; select count(*) || ' ' || sum(productos) from public.productos_por_expansion('WEST')"]).stdout.trim()
    check('sin cuenta: 50 expansiones occidentales y los 2.500 productos (los de antes, occidentales por defecto)', w === '50 2500', w)
    const j = psql(['-t', '-A', '-d', 'prueba_808', '-c', "set role anon; select string_agg(episode_id || ':' || productos, ',' order by episode_id) from public.productos_por_expansion('JP')"]).stdout.trim()
    check('  …y el japonés, aparte', j === '100:20,101:20', j)
    psql(['-c', 'drop database if exists prueba_808'])
  }
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

// Tanda 820 (VE4) — las guías y noticias aunque la red vaya mal. Se ejecuta
// el sw.js DE VERDAD en una caja con la red y las cachés de mentira.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ORIGEN = 'https://pokedoc.es'
function montar({ red }) {
  const almacen = new Map()
  const abrir = (n) => {
    if (!almacen.has(n)) almacen.set(n, new Map())
    const m = almacen.get(n)
    const clave = (r) => (typeof r === 'string' ? new URL(r, ORIGEN).href : r.url)
    return { match: async (r) => m.get(clave(r))?.clone(), put: async (r, res) => { m.set(clave(r), res) }, keys: async () => [...m.keys()].map((u) => new Request(u)), delete: async (r) => m.delete(clave(r)), add: async () => {} }
  }
  const caches = {
    open: async (n) => abrir(n),
    keys: async () => [...almacen.keys()],
    delete: async (n) => almacen.delete(n),
    match: async (r, o = {}) => { for (const [n] of almacen) { if (o.cacheName && n !== o.cacheName) continue; const x = await abrir(n).match(r); if (x) return x } return undefined },
  }
  const oyentes = {}
  const self = { location: new URL(ORIGEN), addEventListener: (t, f) => { oyentes[t] = f }, skipWaiting: () => {}, clients: { claim: async () => {} } }
  const ctx = vm.createContext({ self, caches, fetch: (...a) => red(...a), URL, Request, Response, setTimeout, clearTimeout, Promise, console })
  vm.runInContext(readFileSync(`${RAIZ}/sw.js`, 'utf8'), ctx)
  const navegar = async (ruta, { esperarTodo = true } = {}) => {
    let respuesta
    const pendientes = []
    const req = new Request(`${ORIGEN}${ruta}`)
    Object.defineProperty(req, 'mode', { value: 'navigate' })
    oyentes.fetch({ request: req, respondWith: (p) => { respuesta = p }, waitUntil: (p) => pendientes.push(p) })
    const r = await respuesta
    if (esperarTodo) await Promise.allSettled(pendientes)
    return r
  }
  return { navegar, caches, almacen, oyentes }
}
const tras = (ms, valor) => new Promise((ok) => setTimeout(() => ok(valor), ms))
const pagina = (t) => new Response(`<html>${t}</html>`, { status: 200, headers: { 'content-type': 'text/html' } })
// Una Response construida a mano es de tipo «default»; la de la red, «basic».
const basica = (t) => { const r = pagina(t); Object.defineProperty(r, 'type', { value: 'basic' }); return r }

{
  let veces = 0
  const caja = montar({ red: async () => { veces++; return basica(`guia v${veces}`) } })
  const r1 = await caja.navegar('/guia/como-empezar')
  check('red rápida: se sirve la red', (await r1.text()) === '<html>guia v1</html>')
  const guardada = await caja.caches.match(`${ORIGEN}/guia/como-empezar`, { cacheName: 'pokedoc-lectura-1' })
  check('  …y se guarda una copia', guardada && (await guardada.text()) === '<html>guia v1</html>')
  // Ahora la red va lentísima: sale la copia a los 2,5 s.
  const lenta = montar({ red: async () => tras(6000, basica('nueva')) })
  await (await lenta.caches.open('pokedoc-lectura-1')).put(`${ORIGEN}/noticias/regional`, pagina('copia'))
  const t0 = Date.now()
  const r2 = await Promise.race([lenta.navegar('/noticias/regional', { esperarTodo: false }), tras(4500, null)])
  const ms = Date.now() - t0
  check('red lenta con copia: la copia, a los ~2,5 s', r2 && (await r2.clone().text()) === '<html>copia</html>' && ms >= 2300 && ms < 4400, `${ms} ms`)
}
{
  const caja = montar({ red: async () => tras(3200, basica('tarde')) })
  const t0 = Date.now()
  const r = await caja.navegar('/guia/sin-copia')
  check('red lenta SIN copia: se espera a la red', (await r.text()) === '<html>tarde</html>' && Date.now() - t0 >= 3100)
}
{
  const caja = montar({ red: async () => { throw new TypeError('sin red') } })
  await (await caja.caches.open('pokedoc-sin-conexion-1')).put(`${ORIGEN}/sin-conexion.html`, pagina('sin conexión'))
  const r = await caja.navegar('/guia/otra')
  check('sin red y sin copia: «Sin conexión»', (await r.text()) === '<html>sin conexión</html>')
  await (await caja.caches.open('pokedoc-lectura-1')).put(`${ORIGEN}/guia/otra`, pagina('copia vieja'))
  const r2 = await caja.navegar('/guia/otra')
  check('sin red con copia: la copia, sin esperar', (await r2.text()) === '<html>copia vieja</html>')
}
{
  let n = 0
  const caja = montar({ red: async () => basica(`p${n++}`) })
  for (let i = 0; i < 35; i++) await caja.navegar(`/guia/g${i}`)
  const claves = await (await caja.caches.open('pokedoc-lectura-1')).keys()
  check('se guardan las 30 últimas, no todas', claves.length === 30 && claves.some((k) => k.url.endsWith('/guia/g34')) && !claves.some((k) => k.url.endsWith('/guia/g0')), claves.length)
  const otra = montar({ red: async () => basica('x') })
  await otra.navegar('/torneos')
  check('una página que no es de leer no se guarda', !(await otra.caches.keys()).includes('pokedoc-lectura-1'))
}
{
  const caja = montar({ red: async () => basica('x') })
  for (const n of ['pokedoc-lectura-1', 'pokedoc-ficheros-1', 'pokedoc-sin-conexion-1', 'pokedoc-viejo-0']) await caja.caches.open(n)
  let p
  caja.oyentes.activate({ waitUntil: (x) => { p = x } })
  await p
  const quedan = (await caja.caches.keys()).sort().join()
  check('al activarse, la copia de leer NO se borra (y la vieja sí)', quedan === 'pokedoc-ficheros-1,pokedoc-lectura-1,pokedoc-sin-conexion-1', quedan)
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

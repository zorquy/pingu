// Tanda 1311 — Las huellas (C4): el service worker deja de preguntar fichero a
// fichero. Con huellas.txt (la versión) y huellas.json (la de cada fichero),
// una visita sin despliegue no pregunta por ningún fichero; tras un despliegue
// se baja solo lo que ha cambiado, y lo que no casa con su huella no se guarda.
// Se ejecuta el sw.js de verdad en una caja (como la 982) con un reloj propio.
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { huella, huellasDe } = await import(`${RAIZ}/herramientas/generar-huellas.mjs`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const sw = readFileSync(`${RAIZ}/sw.js`, 'utf8')
const ORIGEN = 'https://pokedoc.es'

console.log('── 0. El generador ──')
{
  const d = mkdtempSync(join(tmpdir(), 'huellas-'))
  mkdirSync(join(d, 'js')); mkdirSync(join(d, 'css'))
  writeFileSync(join(d, 'js', 'a.js'), 'a'); writeFileSync(join(d, 'css', 'b.css'), 'b'); writeFileSync(join(d, 'index.html'), 'no')
  const h = huellasDe(d)
  check('una huella por fichero de css/, js/ y assets/ (las páginas no)', Object.keys(h.f).sort().join() === '/css/b.css,/js/a.js', Object.keys(h.f).join())
  check('doce cifras, la de su contenido', h.f['/js/a.js'] === huella('a') && /^[0-9a-f]{12}$/.test(h.v))
  writeFileSync(join(d, 'js', 'a.js'), 'a2')
  check('cambia un fichero, cambia la versión', huellasDe(d).v !== h.v)
  const toml = readFileSync(`${RAIZ}/netlify.toml`, 'utf8')
  check('se escriben al desplegar, detrás de antes-de-salir', /command = "node herramientas\/antes-de-salir\.mjs && node herramientas\/generar-huellas\.mjs"/.test(toml))
  check('y no van en el repo', /^huellas\.json$/m.test(readFileSync(`${RAIZ}/.gitignore`, 'utf8')) && /^huellas\.txt$/m.test(readFileSync(`${RAIZ}/.gitignore`, 'utf8')))
}

const basica = (texto, etag, tipo = 'text/javascript') => {
  const r = new Response(texto, { status: 200, headers: { 'content-type': tipo, etag } })
  Object.defineProperty(r, 'type', { value: 'basic' })
  return r
}
// El sitio: ruta → texto. La prueba «despliega» cambiando textos y huellas.
function montar(sitio, { conHuellas = true } = {}) {
  const almacen = new Map()
  const pedidas = []
  let reloj = 1_000_000
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
    match: async (r) => { for (const [n] of almacen) { const x = await abrir(n).match(r); if (x) return x } return undefined },
  }
  // Las huellas que «publica» el despliegue (las de lo que hay en el sitio), o
  // las que la prueba fuerce.
  let huellasForzadas = null
  const mapa = () => {
    if (huellasForzadas) return huellasForzadas
    const f = {}
    for (const [ruta, texto] of Object.entries(sitio)) if (/^\/(js|css|assets)\//.test(ruta)) f[ruta] = huella(texto)
    return { v: huella(JSON.stringify(f)), f }
  }
  const red = async (req) => {
    const url = new URL(typeof req === 'string' ? req : req.url, ORIGEN)
    const ruta = url.pathname
    const etag = `"${huella(sitio[ruta] ?? '?')}"`
    const condicional = typeof req !== 'string' && req.headers?.get('if-none-match')
    pedidas.push({ ruta, condicional: !!condicional, cuerpo: !(condicional && condicional === etag) })
    if (ruta === '/huellas.txt') return conHuellas ? basica(mapa().v, `"${mapa().v}"`, 'text/plain') : new Response('No', { status: 404 })
    if (ruta === '/huellas.json') return conHuellas ? basica(JSON.stringify(mapa()), '"j"', 'application/json') : new Response('No', { status: 404 })
    if (condicional && condicional === etag) return new Response(null, { status: 304 })
    return basica(sitio[ruta] ?? '?', etag, ruta.endsWith('.html') || !/\./.test(ruta) ? 'text/html' : 'text/javascript')
  }
  class Reloj extends Date { static now() { return reloj } }
  const oyentes = {}
  const self = { location: new URL(ORIGEN), addEventListener: (t, f) => { oyentes[t] = f }, skipWaiting: () => {}, clients: { claim: async () => {} } }
  vm.runInContext(sw, vm.createContext({ self, caches, fetch: red, URL, Request, Response, setTimeout, clearTimeout, Promise, console, crypto: webcrypto, Uint8Array, JSON, Date: Reloj }))
  const pedir = async (ruta, extra = {}) => {
    let respuesta
    const pendientes = []
    const req = extra.navegar ? { url: `${ORIGEN}${ruta}`, mode: 'navigate', method: 'GET' } : new Request(`${ORIGEN}${ruta}`)
    oyentes.fetch({ request: req, clientId: extra.cliente || '', resultingClientId: extra.nuevo || '', respondWith: (p) => { respuesta = p }, waitUntil: (p) => pendientes.push(p) })
    const r = await respuesta
    return { texto: await r.text(), detras: Promise.allSettled(pendientes) }
  }
  const gen = async () => { const r = await abrir('pokedoc-estado-1').match(`${ORIGEN}/__generacion`); return r ? Number(await r.text()) : 1 }
  const textoEn = async (cache, ruta) => { const r = almacen.get(cache)?.get(`${ORIGEN}${ruta}`); return r ? r.clone().text() : null }
  const pasar = (ms) => { reloj += ms }
  const forzar = (h) => { huellasForzadas = h }
  return { pedir, almacen, gen, textoEn, pedidas, pasar, forzar, mapa }
}
const MODULOS = ['/js/a.js', '/js/b.js', '/js/c.js']
const visita = async (caja, cliente, nuevo = cliente) => {
  await (await caja.pedir('/foro', { navegar: true, nuevo })).detras
  for (const f of MODULOS) await (await caja.pedir(f, { cliente })).detras
}
const deFicheros = (caja) => caja.pedidas.filter((p) => /^\/(js|css|assets)\//.test(p.ruta)).map((p) => p.ruta)

console.log('\n── 1. Sin despliegue, ni una pregunta por fichero ──')
{
  const sitio = { '/foro': 'foro A', '/js/a.js': 'a A', '/js/b.js': 'b A', '/js/c.js': 'c A' }
  const caja = montar(sitio)
  await visita(caja, 'p1')
  // La segunda visita pone las huellas a la generación (una vez, preguntando todo).
  caja.pasar(61_000)
  await visita(caja, 'p2')
  check('la primera vez con huellas se renueva una vez y guarda el mapa', (await caja.gen()) === 2 && caja.almacen.get('pokedoc-estado-1').has(`${ORIGEN}/__huellas-2`), await caja.gen())
  caja.pedidas.length = 0
  caja.pasar(61_000)
  await visita(caja, 'p3')
  check('otra visita sin despliegue: ningún fichero preguntado', deFicheros(caja).length === 0, JSON.stringify(caja.pedidas))
  check('  …solo huellas.txt (una vez) y la página', caja.pedidas.map((p) => p.ruta).sort().join() === '/foro,/huellas.txt', JSON.stringify(caja.pedidas.map((p) => p.ruta)))
  caja.pedidas.length = 0
  await visita(caja, 'p4')
  check('dentro del minuto, ni siquiera huellas.txt', !caja.pedidas.some((p) => p.ruta === '/huellas.txt'), JSON.stringify(caja.pedidas.map((p) => p.ruta)))
}

console.log('\n── 2. Tras un despliegue, solo lo que ha cambiado ──')
{
  const sitio = { '/foro': 'foro A', '/js/a.js': 'a A', '/js/b.js': 'b A', '/js/c.js': 'c A' }
  const caja = montar(sitio)
  await visita(caja, 'p1')
  caja.pasar(61_000)
  await visita(caja, 'p2')
  // Una pestaña abierta ya con la generación de ahora (la p2 se quedó en la de antes).
  await visita(caja, 'p3')
  const antes = await caja.gen()
  sitio['/js/b.js'] = 'b B'
  caja.pedidas.length = 0
  caja.pasar(61_000)
  const a = await caja.pedir('/js/a.js', { cliente: 'p3' })
  check('la pestaña recibe lo suyo mientras tanto', a.texto === 'a A')
  await a.detras
  check('cambia de generación', (await caja.gen()) === antes + 1, await caja.gen())
  check('  …con b.js nuevo', (await caja.textoEn(`pokedoc-ficheros-${antes + 1}`, '/js/b.js')) === 'b B')
  check('  …y a.js y c.js copiados sin preguntar', (await caja.textoEn(`pokedoc-ficheros-${antes + 1}`, '/js/a.js')) === 'a A' && (await caja.textoEn(`pokedoc-ficheros-${antes + 1}`, '/js/c.js')) === 'c A')
  check('  …el único fichero pedido a la red es b.js', deFicheros(caja).join() === '/js/b.js', JSON.stringify(deFicheros(caja)))
  check('  …y huellas.json, una vez', caja.pedidas.filter((p) => p.ruta === '/huellas.json').length === 1)
  const n = await (await caja.pedir('/foro', { navegar: true, nuevo: 'p5' }))
  await n.detras
  check('una pestaña nueva ve b de B', (await caja.pedir('/js/b.js', { cliente: 'p5' })).texto === 'b B')
  check('el mapa de la generación anterior a la anterior se borra con ella', !caja.almacen.get('pokedoc-estado-1').has(`${ORIGEN}/__huellas-${antes - 1}`))
}

console.log('\n── 3. Lo que no casa con su huella no se guarda ──')
{
  const sitio = { '/foro': 'foro A', '/js/a.js': 'a A', '/js/b.js': 'b A', '/js/c.js': 'c A' }
  const caja = montar(sitio)
  await visita(caja, 'p1')
  caja.pasar(61_000)
  await visita(caja, 'p2')
  await visita(caja, 'p3')
  const g = await caja.gen()
  // Las huellas ya dicen c de C, pero la red aún da c de A (un despliegue a medias).
  const m = caja.mapa()
  caja.forzar({ v: 'aaaaaaaaaaaa', f: { ...m.f, '/js/c.js': huella('c C') } })
  caja.pasar(61_000)
  await (await caja.pedir('/js/a.js', { cliente: 'p3' })).detras
  check('cambia de generación', (await caja.gen()) === g + 1)
  check('  …pero el c.js viejo NO entra en ella', (await caja.textoEn(`pokedoc-ficheros-${g + 1}`, '/js/c.js')) === null)
  await (await caja.pedir('/foro', { navegar: true, nuevo: 'p6' })).detras
  const c = await caja.pedir('/js/c.js', { cliente: 'p6' })
  await c.detras
  check('  …se pide a la red al usarlo, y sigue sin guardarse', c.texto === 'c A' && (await caja.textoEn(`pokedoc-ficheros-${g + 1}`, '/js/c.js')) === null)
  sitio['/js/c.js'] = 'c C'
  const c2 = await caja.pedir('/js/c.js', { cliente: 'p6' })
  await c2.detras
  check('  …y cuando la red da el bueno, entra', c2.texto === 'c C' && (await caja.textoEn(`pokedoc-ficheros-${g + 1}`, '/js/c.js')) === 'c C')
}

console.log('\n── 4. Sin huellas, como antes ──')
{
  const sitio = { '/foro': 'foro A', '/js/a.js': 'a A', '/js/b.js': 'b A', '/js/c.js': 'c A' }
  const caja = montar(sitio, { conHuellas: false })
  await visita(caja, 'p1')
  caja.pedidas.length = 0
  caja.pasar(61_000)
  await visita(caja, 'p2')
  check('cada fichero se revisa por detrás, como hasta ahora', deFicheros(caja).sort().join() === MODULOS.join(), JSON.stringify(deFicheros(caja)))
  sitio['/js/a.js'] = 'a B'
  caja.pasar(61_000)
  await (await caja.pedir('/js/a.js', { cliente: 'p2' })).detras
  check('  …y un despliegue se nota igual', (await caja.gen()) === 2 && (await caja.textoEn('pokedoc-ficheros-2', '/js/a.js')) === 'a B')
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

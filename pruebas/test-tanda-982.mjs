// Tanda 982 — Un despliegue no tira la caché (propuesta «Rápida al volver», A).
//
// Con ~20 despliegues al día, vaciar las dos cachés al primer cambio visto
// (la 897/910) era bajarlo todo casi en cada visita: la segunda página de Mi
// colección pasaba de 0,4 a 2,2 s. Ahora el service worker llena la
// generación siguiente por detrás, preguntando «¿ha cambiado?» fichero a
// fichero (un 304 no baja nada), y cambia el puntero de una vez. Se ejecuta el
// sw.js de verdad en una caja, con pestañas que tienen su id (clientId).
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const sw = readFileSync(`${RAIZ}/sw.js`, 'utf8')

const ORIGEN = 'https://pokedoc.es'
const basica = (texto, etag, tipo = 'text/javascript') => {
  const r = new Response(texto, { status: 200, headers: { 'content-type': tipo, etag } })
  Object.defineProperty(r, 'type', { value: 'basic' })
  return r
}
// La red: un mapa ruta → [texto, etag] que la prueba cambia («despliega»).
function montar(sitio, { lenta = null, caida = () => false } = {}) {
  const almacen = new Map()
  const pedidas = []
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
  const red = async (req) => {
    const url = new URL(typeof req === 'string' ? req : req.url, ORIGEN)
    const ruta = url.pathname
    if (caida(ruta)) throw new TypeError('Failed to fetch')
    if (lenta && lenta.ruta === ruta) await lenta.espera
    const [texto, etag] = sitio[ruta] || ['?', '"?"']
    const condicional = typeof req !== 'string' && req.headers?.get('if-none-match')
    pedidas.push({ ruta, condicional: !!condicional, cuerpo: !(condicional && condicional === etag) })
    if (condicional && condicional === etag) return new Response(null, { status: 304 })
    return basica(texto, etag, ruta.endsWith('.html') || !/\./.test(ruta) ? 'text/html' : 'text/javascript')
  }
  const oyentes = {}
  const self = { location: new URL(ORIGEN), addEventListener: (t, f) => { oyentes[t] = f }, skipWaiting: () => {}, clients: { claim: async () => {} } }
  vm.runInContext(sw, vm.createContext({ self, caches, fetch: red, URL, Request, Response, setTimeout, clearTimeout, Promise, console }))
  const evento = (ruta, extra) => {
    let respuesta
    const pendientes = []
    const req = extra.navegar ? { url: `${ORIGEN}${ruta}`, mode: 'navigate', method: 'GET' } : new Request(`${ORIGEN}${ruta}`)
    oyentes.fetch({ request: req, clientId: extra.cliente || '', resultingClientId: extra.nuevo || '', respondWith: (p) => { respuesta = p }, waitUntil: (p) => pendientes.push(p) })
    return { respuesta, pendientes }
  }
  const pedir = async (ruta, extra = {}) => {
    const { respuesta, pendientes } = evento(ruta, extra)
    const r = await respuesta
    return { texto: await r.text(), detras: Promise.allSettled(pendientes) }
  }
  const gen = async () => { const r = await abrir('pokedoc-estado-1').match(`${ORIGEN}/__generacion`); return r ? Number(await r.text()) : 1 }
  const textoEn = async (cache, ruta) => { const r = almacen.get(cache)?.get(`${ORIGEN}${ruta}`); return r ? r.clone().text() : null }
  return { pedir, almacen, gen, textoEn, pedidas }
}
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))

console.log('── 1. Un cambio llena la generación siguiente y cambia de golpe ──')
{
  const sitio = { '/foro': ['foro A', '"f-A"'], '/js/a.js': ['a A', '"a-A"'], '/js/b.js': ['b A', '"b-A"'], '/js/c.js': ['c A', '"c-A"'] }
  const caja = montar(sitio)
  // Ayer: la pestaña 1 abre el foro y sus tres módulos; todo entra en la generación 1.
  await (await caja.pedir('/foro', { navegar: true, nuevo: 'p1' })).detras
  for (const f of ['/js/a.js', '/js/b.js', '/js/c.js']) await (await caja.pedir(f, { cliente: 'p1' })).detras
  check('lo de ayer está en la generación 1', (await caja.textoEn('pokedoc-ficheros-1', '/js/c.js')) === 'c A' && (await caja.gen()) === 1)
  // Despliegue: cambia SOLO a.js.
  sitio['/js/a.js'] = ['a B', '"a-B"']
  caja.pedidas.length = 0
  const pa = await caja.pedir('/js/a.js', { cliente: 'p1' })
  check('la pestaña que lo pide sigue recibiendo lo suyo (a de A)', pa.texto === 'a A')
  await pa.detras
  check('al acabar, el puntero va a la generación 2', (await caja.gen()) === 2, await caja.gen())
  check('  …con el a.js nuevo', (await caja.textoEn('pokedoc-ficheros-2', '/js/a.js')) === 'a B')
  check('  …y b.js, c.js y la página copiados SIN bajarlos (304)', (await caja.textoEn('pokedoc-ficheros-2', '/js/b.js')) === 'b A' && (await caja.textoEn('pokedoc-ficheros-2', '/js/c.js')) === 'c A' && (await caja.textoEn('pokedoc-paginas-2', '/foro')) === 'foro A',
    JSON.stringify(caja.pedidas))
  const conCuerpo = caja.pedidas.filter((p) => p.cuerpo).map((p) => p.ruta)
  check('  …la única que se bajó entera es la que cambió', conCuerpo.length === 1 && conCuerpo[0] === '/js/a.js', JSON.stringify(conCuerpo))
  check('la generación 1 se queda (la pestaña 1 aún la usa)', caja.almacen.has('pokedoc-ficheros-1'))
  const p1 = await caja.pedir('/js/a.js', { cliente: 'p1' })
  check('  …y la pestaña 1 sigue con lo de su despliegue: no se mezclan', p1.texto === 'a A', p1.texto)
  const p2 = await (await caja.pedir('/foro', { navegar: true, nuevo: 'p2' }))
  await p2.detras
  const a2 = await caja.pedir('/js/a.js', { cliente: 'p2' })
  check('una pestaña nueva abre la generación 2 (a de B)', a2.texto === 'a B', a2.texto)
  // Otro despliegue: la 1 ya no la usa nadie y se va.
  sitio['/js/b.js'] = ['b C', '"b-C"']
  await (await caja.pedir('/js/b.js', { cliente: 'p2' })).detras
  check('tras otro despliegue, generación 3 y fuera la 1 (la 2 se queda)', (await caja.gen()) === 3 && !caja.almacen.has('pokedoc-ficheros-1') && caja.almacen.has('pokedoc-ficheros-2'), [...caja.almacen.keys()].join())
}

console.log('\n── 2. Mientras se llena, nada se mezcla ──')
{
  const sitio = { '/foro': ['foro A', '"f-A"'], '/torneos': ['torneos A', '"t-A"'], '/js/a.js': ['a A', '"a-A"'], '/js/b.js': ['b A', '"b-A"'] }
  let soltar
  const lenta = { ruta: '/js/b.js', espera: Promise.resolve() }
  const caja = montar(sitio, { lenta })
  await (await caja.pedir('/foro', { navegar: true, nuevo: 'p1' })).detras
  for (const f of ['/js/a.js', '/js/b.js']) await (await caja.pedir(f, { cliente: 'p1' })).detras
  sitio['/js/a.js'] = ['a B', '"a-B"']
  lenta.espera = new Promise((ok) => { soltar = ok })
  const pa = await caja.pedir('/js/a.js', { cliente: 'p1' })
  await esperar(20)
  check('la renovación está a medias (b.js tarda): el puntero sigue en la 1', (await caja.gen()) === 1)
  const b1 = await caja.pedir('/js/b.js', { cliente: 'p1' })
  check('la pestaña vieja recibe lo viejo entero', b1.texto === 'b A')
  // Una página que NO estaba guardada llega de la red: ya es del despliegue nuevo.
  const t = await caja.pedir('/torneos', { navegar: true, nuevo: 'p3' })
  check('una página sin copia llega de la red (nueva)', t.texto === 'torneos A')
  const a3 = await caja.pedir('/js/a.js', { cliente: 'p3' })
  check('  …y sus módulos NO salen de la caché vieja (a de B)', a3.texto === 'a B', a3.texto)
  soltar()
  await pa.detras
  check('al soltar, cambio de generación', (await caja.gen()) === 2)
}

console.log('\n── 3. Si se va la red a mitad, se queda la de antes ──')
{
  const sitio = { '/foro': ['foro A', '"f-A"'], '/js/a.js': ['a A', '"a-A"'], '/js/b.js': ['b A', '"b-A"'], '/js/c.js': ['c A', '"c-A"'], '/js/d.js': ['d A', '"d-A"'] }
  let sinRed = false
  const caja = montar(sitio, { caida: (r) => sinRed && r !== '/js/a.js' })
  await (await caja.pedir('/foro', { navegar: true, nuevo: 'p1' })).detras
  for (const f of ['/js/a.js', '/js/b.js', '/js/c.js', '/js/d.js']) await (await caja.pedir(f, { cliente: 'p1' })).detras
  sitio['/js/a.js'] = ['a B', '"a-B"']
  sinRed = true
  await (await caja.pedir('/js/a.js', { cliente: 'p1' })).detras
  check('sin respuesta para casi nada, no se cambia de generación', (await caja.gen()) === 1)
  check('  …la de antes sigue entera', (await caja.textoEn('pokedoc-ficheros-1', '/js/d.js')) === 'd A')
  check('  …y la a medias se tira', !caja.almacen.has('pokedoc-ficheros-2'), [...caja.almacen.keys()].join())
}

console.log('\n── 4. En el código ──')
check('ya no se vacía todo al primer cambio', !/vaciarTodo/.test(sw))
check('la pestaña lleva su generación (clientId / resultingClientId)', /genDelCliente\(e\.clientId\)/.test(sw) && /apuntar\(e\.resultingClientId/.test(sw))
check('el cambio de generación es UNA escritura (el puntero)', /put\('\/__generacion'/.test(sw))
check('al activarse no se borran las cachés de las generaciones', /!DE_GENERACION\.test\(k\)/.test(sw) && /k !== ESTADO/.test(sw))
check('error-log sigue pudiendo vaciarlas todas', /pokedoc-\(ficheros\|paginas\)-/.test(readFileSync(`${RAIZ}/js/error-log.js`, 'utf8')))

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

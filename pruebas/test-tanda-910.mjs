// Tanda 910 — los errores del panel de /admin, uno a uno.
//
// PINGU, con la lista de «Errores»: «mira todos estos errores, seguro que
// puedes revisar más tú y ver por qué pasa». Lo que se mira:
//   1. Módulos de dos despliegues («Importing binding name 'TOPE_CARTAS' is
//      not found», «…'deDondeSaleElValor'…»): el service worker vacía sus
//      cachés DE UNA VEZ, y una revisión que empezó antes de un vaciado no
//      guarda lo suyo. Se ejecuta el sw.js de verdad en una caja (como la 820).
//   2. Y si aun así pasa, la página vacía las cachés y se recarga una vez.
//   3. El registro: «Revisa tu email» petaba al escribir en un párrafo que la
//      790 cambió por la lista de ventajas, y el formulario se quedaba a la vista.
//   4. Lo que no se apunta: «Script error.» sin traza y las transiciones entre
//      páginas que cancela el navegador. Y un «Failed to fetch» lleva contexto.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// ── La caja del service worker ──
const ORIGEN = 'https://pokedoc.es'
function montar(red) {
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
    match: async (r) => { for (const [n] of almacen) { const x = await abrir(n).match(r); if (x) return x } return undefined },
  }
  const oyentes = {}
  const self = { location: new URL(ORIGEN), addEventListener: (t, f) => { oyentes[t] = f }, skipWaiting: () => {}, clients: { claim: async () => {} } }
  vm.runInContext(readFileSync(`${RAIZ}/sw.js`, 'utf8'), vm.createContext({ self, caches, fetch: (...a) => red(...a), URL, Request, Response, setTimeout, clearTimeout, Promise, console }))
  const pedir = async (ruta) => {
    let respuesta
    const pendientes = []
    oyentes.fetch({ request: new Request(`${ORIGEN}${ruta}`), respondWith: (p) => { respuesta = p }, waitUntil: (p) => pendientes.push(p) })
    const r = await respuesta
    return { r, detras: Promise.allSettled(pendientes) }
  }
  return { pedir, abrir, almacen }
}
const fichero = (texto, etag) => {
  const r = new Response(texto, { status: 200, headers: { 'content-type': 'text/javascript', etag } })
  Object.defineProperty(r, 'type', { value: 'basic' })
  return r
}
const ASSETS = 'pokedoc-ficheros-1'

console.log('── 1. El service worker no mezcla dos despliegues ──')
{
  // Lo guardado es del despliegue A. La red ya da el B, pero b.js tarda: su
  // revisión empezó ANTES del despliegue y vuelve con lo viejo de A.
  let soltarB
  const bLento = new Promise((ok) => { soltarB = ok })
  const caja = montar(async (req) => {
    const u = new URL(typeof req === 'string' ? req : req.url).pathname
    if (u === '/js/a.js') return fichero('a de B', '"a-B"')
    if (u === '/js/b.js') return bLento
    return fichero('?', '"x"')
  })
  const c = await caja.abrir(ASSETS)
  await c.put(`${ORIGEN}/js/a.js`, fichero('a de A', '"a-A"'))
  await c.put(`${ORIGEN}/js/b.js`, fichero('b de A', '"b-A"'))
  await c.put(`${ORIGEN}/js/c.js`, fichero('c de A', '"c-A"'))
  const pb = await caja.pedir('/js/b.js')
  check('b.js sale de la caché (A) y se revisa por detrás', (await pb.r.text()) === 'b de A')
  const pa = await caja.pedir('/js/a.js')
  check('a.js sale de la caché (A)', (await pa.r.text()) === 'a de A')
  await pa.detras
  const tras = caja.almacen.get(ASSETS)
  check('al ver que a.js cambió, la caché se vacía ENTERA de una vez (no queda c.js de A)', !tras?.has(`${ORIGEN}/js/c.js`), JSON.stringify([...(tras?.keys() || [])]))
  check('  …y entra el a.js nuevo', tras?.has(`${ORIGEN}/js/a.js`) && (await tras.get(`${ORIGEN}/js/a.js`).clone().text()) === 'a de B')
  soltarB(fichero('b de A', '"b-A"'))
  await pb.detras
  const fin = caja.almacen.get(ASSETS)
  check('la revisión de b.js que empezó ANTES del vaciado no mete lo viejo en la caché nueva', !fin?.has(`${ORIGEN}/js/b.js`), JSON.stringify([...(fin?.keys() || [])]))
  const pc = await caja.pedir('/js/c.js')
  check('c.js, sin copia, va a la red', (await pc.r.text()) === '?')
}

console.log('\n── 2. Si aun así llega una mezcla, una recarga ──')
{
  const { esRuido, tocaRecargar, DESAJUSTE } = await import(`${RAIZ}/js/error-log.js`)
  const caja = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }
  for (const m of ["Importing binding name 'TOPE_CARTAS' is not found.", "The requested module './buscador.js' does not provide an export named 'TOPE_CARTAS'", 'Failed to fetch dynamically imported module: https://pokedoc.es/js/x.js', 'Importing a module script failed.']) check(`«${m.slice(0, 50)}…» es una mezcla`, DESAJUSTE.test(m))
  check('«Failed to fetch» a secas no lo es', !DESAJUSTE.test('Failed to fetch'))
  const a = caja()
  check('la primera vez, recarga', tocaRecargar("Importing binding name 'X' is not found.", { ahora: 1e6, almacen: a, enLinea: true }))
  check('  …y no otra vez en cinco minutos (si vuelve, es un fallo de verdad)', !tocaRecargar("Importing binding name 'X' is not found.", { ahora: 1e6 + 60_000, almacen: a, enLinea: true }))
  check('  …pasados, sí', tocaRecargar("Importing binding name 'X' is not found.", { ahora: 1e6 + 6 * 60_000, almacen: a, enLinea: true }))
  check('sin red no recarga (llevaría a «Sin conexión»)', !tocaRecargar('Failed to fetch dynamically imported module: x', { ahora: 1, almacen: caja(), enLinea: false }))
  check('un error cualquiera no recarga', !tocaRecargar('Cannot read properties of null', { ahora: 1, almacen: caja(), enLinea: true }))
  const src = readFileSync(`${RAIZ}/js/error-log.js`, 'utf8')
  check('al recargar vacía las cachés de la casa y lo apunta', /\.finally\(vaciarYRecargar\)/.test(src) && /pokedoc-\(ficheros\|paginas\)-/.test(src) && /se ha recargado sola/.test(src))

  console.log('\n── 4. Lo que no se apunta, y el contexto de la red ──')
  check('«Script error.» sin traza, fuera', esRuido('Script error.', null) && esRuido('Script error', undefined))
  check('  …con traza sí se apunta', !esRuido('Script error.', { stack: 'at x' }))
  check('las transiciones que cancela el navegador, fuera', esRuido('Transition was aborted because of invalid state. Viewport size changed', {}) && esRuido('Transition was aborted because of invalid state. Page already revealed', {}) && esRuido('Transition was skipped', {}))
  check('un error de verdad se apunta', !esRuido("Cannot set properties of null (setting 'textContent')", {}) && !esRuido('Failed to fetch', {}))
  check('«Failed to fetch» lleva si había red, si se veía la pestaña y a los cuántos segundos', /en línea: \$\{navigator\.onLine/.test(src) && /pestaña: \$\{document\.visibilityState\}/.test(src))
  for (const [f, re] of [['js/theme.js', /t\.ready\.catch\(\(\) => \{\}\)/], ['js/mi-coleccion/gestos-ficha.js', /t\.ready\.catch\(\(\) => \{\}\)[\s\S]*t\.ready\.catch\(\(\) => \{\}\)/]]) check(`${f}: la transición saltada no deja una promesa sin mirar`, re.test(readFileSync(`${RAIZ}/${f}`, 'utf8')))
}

console.log('\n── 3. El registro: «Revisa tu email» sin petar ──')
{
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/auth.html?registro=1`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  await p.fill('#registerName', 'Sergio')
  await p.fill('#registerEmail', 'sergio@ejemplo.es')
  await p.fill('#registerPassword', 'Zapdos-151!')
  // El camino del cebo (un bot) pinta la MISMA pantalla que el registro de
  // verdad cuando falta confirmar el email, y no toca la base.
  await p.$eval('#registerWebsite', (i) => { i.value = 'x' })
  await p.click('#btnRegister')
  await p.waitForTimeout(500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const vista = await p.$eval('#stepRegister', (s) => ({
    titulo: s.querySelector('h2')?.textContent.trim(),
    aviso: s.querySelector('.subtext')?.textContent.trim() || '',
    avisoVisible: !!s.querySelector('.subtext')?.offsetParent,
    form: [...s.querySelectorAll('#registerName, #registerEmail, #registerPassword, #btnRegister, #btnGoogleRegister, .auth-ventajas, .auth-o')].filter((e) => e.offsetParent).map((e) => e.id || e.className),
  }))
  check('el título dice «Revisa tu email»', vista.titulo === 'Revisa tu email', vista.titulo)
  check('  …y debajo, el aviso del enlace, a la vista', /Te hemos enviado un enlace/.test(vista.aviso) && vista.avisoVisible, vista.aviso)
  check('  …y el formulario, la lista de ventajas y el «o con tu email», fuera', vista.form.length === 0, JSON.stringify(vista.form))
  await b.close()
}

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

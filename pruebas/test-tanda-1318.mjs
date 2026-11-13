// Tanda 1318 — A4 (tu colección sin cobertura) y D3 (la página sin
// conexión con salidas). Lo que carga Mi colección se guarda en IndexedDB al
// llegar de la red y, si la red no contesta, se pinta la copia diciendo de
// cuándo es. Red primero: un error de la base no se tapa con datos viejos.
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. La regla: red primero, copia solo si falla la red ──')
{
  const m = await import(`${RAIZ}/js/mi-coleccion/sin-red.js`)
  const guardadas = new Map()
  const guardar = async (k, v) => { guardadas.set(k, { valor: v, en: 1_700_000_000_000 }) }
  const leerC = async (k) => guardadas.get(k) || null
  const conRed = { onLine: true }
  const sinRedNav = { onLine: false }
  const red = (v) => async () => v
  const caida = async () => { throw new Error('TypeError: Failed to fetch') }
  let v = await m.conCopia('u:lineas', red([{ id: 1 }]), { guardar, leer: leerC, nav: conRed })
  check('con red: lo de la red, y se guarda la copia', v.length === 1 && guardadas.get('u:lineas')?.valor.length === 1)
  check('  …y no se dice que sea una copia', m.fechaDeLaCopia() === null)
  v = await m.conCopia('u:lineas', caida, { guardar, leer: leerC, nav: conRed })
  check('la red no llega: la copia, con su fecha', v.length === 1 && m.fechaDeLaCopia() === 1_700_000_000_000)
  let lanzo = null
  try { await m.conCopia('u:lineas', async () => { throw new Error('Falta ejecutar supabase-migration-mi-coleccion.sql en Supabase.') }, { guardar, leer: leerC, nav: conRed }) } catch (e) { lanzo = e }
  check('un error de la BASE no se tapa con la copia', lanzo && /Falta ejecutar/.test(lanzo.message))
  lanzo = null
  try { await m.conCopia('u:otra', caida, { guardar, leer: leerC, nav: conRed }) } catch (e) { lanzo = e }
  check('sin red y sin copia: el error de siempre', lanzo && /Failed to fetch/.test(lanzo.message))
  const antes = JSON.stringify([...guardadas])
  v = await m.conCopia('u:lineas', red([]), { guardar, leer: leerC, nav: sinRedNav })
  check('sin conexión, una lista vacía (alguien se tragó su error) mira la copia…', v.length === 1)
  check('  …y sin conexión no se guarda nada (no pisa la buena)', JSON.stringify([...guardadas]) === antes)
  await m.conCopia('u:precios', red(new Map([['a', { cm: 1 }]])), { esMapa: true, guardar, leer: leerC, nav: conRed })
  const mapa = await m.conCopia('u:precios', caida, { esMapa: true, guardar, leer: leerC, nav: conRed })
  check('un Map va y vuelve como Map', mapa instanceof Map && mapa.get('a')?.cm === 1)
  check('qué es «fallo de red»: sin conexión o el fetch que no llega', m.esFalloDeRed(new Error('x'), sinRedNav) && m.esFalloDeRed(new Error('TypeError: Load failed'), conRed) && m.esFalloDeRed({ message: 'TypeError: NetworkError when attempting to fetch resource.' }, conRed) && !m.esFalloDeRed(new Error('permission denied'), conRed))
  const ls = new Map(); const alm = { getItem: (k) => ls.get(k) ?? null, setItem: (k, x) => ls.set(k, x), removeItem: (k) => ls.delete(k) }
  m.recordarQuienSoy('u1', alm)
  check('quién eras solo cuenta sin conexión', m.quienEraSinRed(alm, sinRedNav) === 'u1' && m.quienEraSinRed(alm, conRed) === null)
  m.olvidarQuienSoy(alm)
  check('  …y se olvida', m.quienEraSinRed(alm, sinRedNav) === null)
  const ahora = new Date(2026, 10, 13, 20, 0)
  check('el aviso dice de cuándo es', /hoy a las 18:02/.test(m.textoDeLaCopia(new Date(2026, 10, 13, 18, 2), ahora)) && /el 2 de noviembre a las/.test(m.textoDeLaCopia(new Date(2026, 10, 2, 9, 5), ahora)) && /se guarda al volver la red/.test(m.textoDeLaCopia(Date.now())))
  const mc = leer('js/mi-coleccion.js')
  check('Mi colección pide así sus líneas, cartas, precios y versiones (solo lo tuyo)', /const copiable = esMia && !modoTienda/.test(mc) && ['`lineas:${mercado}`', "'lineas:todo'", '`cartas:${mercado}`', "'cartas:todo'", "'precios'", '`versiones:${mercado}`'].every((k) => mc.includes(`cc(${k}`)))
  check('«La quiero» también', /conCopia\(`\$\{ctx\.sesion\.user\.id\}:deseos`/.test(leer('js/mi-coleccion/deseos.js')))
  check('al salir de la cuenta se borra la copia', /olvidarQuienSoy\(\); return m\.olvidarCopias\(\)/.test(leer('js/app.js')))
}

console.log('── 2. En el navegador: con red se guarda, sin red se ve ──')
const browser = await chromium.launch()
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
  const fixtures = () => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Scarlet & Violet', serie_id: 'sv', serie_name: 'EP', market: 'WEST', card_count_official: 30, card_count_total: 30, release_date: '2023-03-31', logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 6 }, (_, i) => ({ id: 'sv1-' + (i + 1), set_id: 'sv1', local_id: String(i + 1), name: ['Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander', 'Charmeleon', 'Charizard'][i], image_path: 'x/' + i, market: 'WEST', rarity: 'Common', category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 3).map((c, i) => ({ id: 'l' + i, card_id: c.id, cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
  }
  await ctx.addInitScript(fixtures)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const guardado = await p.evaluate(() => new Promise((ok) => { const r = indexedDB.open('pokedoc-sin-red', 1); r.onsuccess = () => { const q = r.result.transaction('copias').objectStore('copias').getAllKeys(); q.onsuccess = () => ok(q.result) }; r.onerror = () => ok([]) }))
  check('con red, se guardan las líneas, las cartas y los precios', ['lineas:WEST', 'lineas:todo', 'cartas:WEST', 'precios'].every((k) => guardado.some((x) => x.endsWith(':' + k))), JSON.stringify(guardado))
  check('  …y no hay aviso de copia', (await p.locator('#sinRedAviso').count()) === 0)
  await p.close()

  // Sin red: la base no contesta (el doble falla como un fetch sin cobertura).
  await ctx.addInitScript(() => { window.__FAKE_SIN_RED__ = true })
  const q = await ctx.newPage()
  q.on('pageerror', (e) => errores.push(e.message))
  await q.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await q.waitForTimeout(2500)
  const texto = await q.evaluate(() => document.getElementById('mcContenido')?.innerHTML || '')
  const tiles = await q.evaluate(() => document.querySelectorAll('#mcContenido [data-id], #mcContenido .mc-carta').length)
  check('sin red, tus cartas se ven igual (las tres)', /Bulbasaur/.test(texto) && /Venusaur/.test(texto) && tiles === 3, `${tiles} cartas`)
  check('  …con el aviso de cuándo es la copia', /Sin cobertura: tu colección tal como estaba hoy a las/.test((await q.locator('#sinRedAviso').textContent().catch(() => '')) || ''))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. D3: la página sin conexión ──')
{
  const html = leer('sin-conexion.html')
  check('va entera dentro (sin pedir nada a la red): la mascota incrustada', /<img src="data:image\/webp;base64,/.test(html) && !/<link rel="stylesheet"/.test(html) && !/<script[^>]+src=/.test(html))
  check('«Sin cobertura» y las salidas a lo que funciona: tu colección, el modo evento y las guías leídas', /<h1>Sin cobertura<\/h1>/.test(html) && /id="irColeccion" href="\/mi-coleccion"/.test(html) && /id="irEvento" href="\/evento"/.test(html) && /pokedoc-lectura-1/.test(html))
  check('se reintenta sola', /setInterval\(function \(\) \{\s*fetch\('\/huellas\.txt\?sin-red=/.test(html) && /addEventListener\('online'/.test(html))
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.evaluate(async () => {
    localStorage.setItem('pokedoc-sin-red-yo', 'u1')
    const c = await caches.open('pokedoc-lectura-1')
    await c.put('/guia/como-empezar', new Response('<html><head><title>Cómo empezar a jugar — PokeDoc</title></head></html>', { headers: { 'content-type': 'text/html' } }))
    await (await caches.open('pokedoc-x')).put('/evento', new Response('evento'))
  })
  await p.route('**/huellas.txt*', (r) => r.abort())
  await p.goto(`${BASE}/sin-conexion.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  check('con copia, el botón a tu colección', await p.locator('#irColeccion').isVisible())
  check('con el modo evento guardado, su botón', await p.locator('#irEvento').isVisible())
  check('las guías leídas, con su título', (await p.locator('#guiasLista a').first().textContent().catch(() => '')) === 'Cómo empezar a jugar' && (await p.locator('#guiasLista a').first().getAttribute('href')) === '/guia/como-empezar')
  check('nada se sale por los lados', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  check('los botones miden 44 px o más', await p.evaluate(() => [...document.querySelectorAll('.salida, button')].filter((b) => b.offsetParent).every((b) => b.getBoundingClientRect().height >= 44)))
  await ctx.close()
}

console.log('── 4. El worker abre la página pelada sin red ──')
{
  const ORIGEN = 'https://pokedoc.es'
  const almacen = new Map()
  const abrir = (n) => {
    if (!almacen.has(n)) almacen.set(n, new Map())
    const mm = almacen.get(n)
    const clave = (r) => (typeof r === 'string' ? new URL(r, ORIGEN).href : r.url)
    return { match: async (r) => mm.get(clave(r))?.clone(), put: async (r, res) => { mm.set(clave(r), res) }, keys: async () => [], delete: async (r) => mm.delete(clave(r)) }
  }
  const caches = { open: async (n) => abrir(n), keys: async () => [...almacen.keys()], delete: async (n) => almacen.delete(n), match: async (r) => { for (const [n] of almacen) { const x = await abrir(n).match(r); if (x) return x } return undefined } }
  const oyentes = {}
  const self = { location: new URL(ORIGEN), addEventListener: (t, f) => { oyentes[t] = f }, skipWaiting: () => {}, clients: { claim: async () => {} }, navigator: {} }
  vm.runInContext(leer('sw.js'), vm.createContext({ self, caches, fetch: async () => { throw new TypeError('Failed to fetch') }, URL, URLSearchParams, Request, Response, setTimeout, clearTimeout, Promise, console, crypto: webcrypto, Uint8Array, JSON, Date }))
  await (await caches.open('pokedoc-paginas-1')).put(`${ORIGEN}/mi-coleccion`, new Response('la página de Mi colección'))
  await (await caches.open('pokedoc-v1')).put(`${ORIGEN}/sin-conexion.html`, new Response('sin conexión'))
  const navegar = async (ruta) => {
    let r
    oyentes.fetch({ request: { url: `${ORIGEN}${ruta}`, mode: 'navigate', method: 'GET' }, clientId: '', resultingClientId: 'x', respondWith: (p) => { r = p }, waitUntil: () => {} })
    return (await r).text()
  }
  const nombres = [...almacen.keys()].join()
  check('/mi-coleccion?ver=quiero sin red: la página guardada (lee la consulta ella)', (await navegar('/mi-coleccion?ver=quiero')) === 'la página de Mi colección', nombres)
  check('una página que no se guarda, sin red: «sin conexión»', (await navegar('/torneo?id=3')) === 'sin conexión')
}
await browser.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

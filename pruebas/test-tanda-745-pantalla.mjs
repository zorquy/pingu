// Tanda 745 — sin conexión (V7 de la lista de propuestas; PINGU: «lo que
// creas mejor»).
//
// Lo que se mira:
//   · la cola pura: cada entrada con su dueño, en orden, lo que falla se
//     queda con un intento más y a la quinta se aparta; y la copia de la
//     colección (agrupada, las que más copias primero, con tope);
//   · en Mi colección: al cargar se guarda la copia; sin red, añadir una
//     carta la mete en la cola (sin escribir nada) y sale el aviso de
//     arriba; al volver la red se guarda sola —una escritura— y el aviso se
//     va;
//   · el worker: con red, una navegación es la página de verdad; sin red,
//     la página «Sin conexión», con tu colección guardada y lo que queda
//     en cola.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { encolar, leerCola, vaciarCola, copiaDeColeccion } = await import(`${RAIZ}/js/mi-coleccion/cola.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La cola y la copia ──')
{
  const mem = new Map()
  const almacen = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
  encolar({ userId: 'u1', linea: { card_id: 'a' }, nombre: 'A' }, almacen)
  encolar({ userId: 'u2', linea: { card_id: 'b' }, nombre: 'B' }, almacen)
  encolar({ userId: 'u1', linea: { card_id: 'c' }, nombre: 'C' }, almacen)
  const mandadas = []
  const r = await vaciarCola('u1', async (e) => { if (e.linea.card_id === 'c') throw new Error('red'); mandadas.push(e.linea.card_id) }, almacen)
  check('manda solo lo tuyo, en orden; lo que falla se queda', JSON.stringify(mandadas) === '["a"]' && r.enviadas === 1 && r.quedan === 1 && leerCola(almacen).length === 2, JSON.stringify(r))
  check('  …y lo de otra persona no se toca', leerCola(almacen).some((e) => e.userId === 'u2'))
  for (let i = 0; i < 4; i++) await vaciarCola('u1', async () => { throw new Error('x') }, almacen)
  check('a la quinta, lo que falla siempre se aparta (no se repite para siempre)', !leerCola(almacen).some((e) => e.userId === 'u1'))
  const copia = copiaDeColeccion([{ card_id: 'x', cantidad: 1 }, { card_id: 'y', cantidad: 3 }, { card_id: 'x', cantidad: 2 }], (l) => l.card_id.toUpperCase(), () => 'Set')
  check('la copia agrupa por carta, con las que más copias primero', JSON.stringify(copia.cartas.map((c) => `${c.n}${c.c}`)) === JSON.stringify(['X3', 'Y3']) && copia.total === 6 && copia.distintas === 2, JSON.stringify(copia))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 3, card_count_total: 3 }]
  window.__FAKE_CARTAS__ = [1, 2, 3].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = [1, 2].map((n) => ({ id: `l${n}`, user_id: 'admin-1', card_id: `xy5-${n}`, market: 'WEST', cantidad: n, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
}
const escrituras = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'user_collection'))

console.log('── 2. Añadir sin red ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=xy5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const copia = await page.evaluate(() => JSON.parse(localStorage.getItem('pokedoc-coleccion-guardada') || 'null'))
  check('al cargar se guarda la copia de tu colección', copia?.distintas === 2 && copia.total === 3 && copia.cartas[0].n === 'Carta 2', JSON.stringify(copia))
  await ctx.setOffline(true)
  await page.waitForTimeout(300)
  check('al irse la red sale el aviso de arriba', await page.evaluate(() => /Sin conexión/.test(document.getElementById('sinRedAviso')?.textContent || '')))
  const antes = (await escrituras(page)).length
  await page.locator('#mcAlbum .mc-mas[data-anadir="xy5-3"]').first().click()
  await page.waitForTimeout(500)
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(800)
  const cola = await page.evaluate(() => JSON.parse(localStorage.getItem('pokedoc-cola-anadir') || '[]'))
  check('añadir sin red la mete en la cola y no escribe nada', cola.length === 1 && cola[0].linea.card_id === 'xy5-3' && (await escrituras(page)).length === antes, JSON.stringify(cola))
  check('  …y lo dice', await page.evaluate(() => [...document.querySelectorAll('.toast')].some((t) => /se añadirá en cuanto vuelva la red/.test(t.textContent))))
  await ctx.setOffline(false)
  await page.waitForTimeout(2500)
  const despues = await escrituras(page)
  check('al volver la red se guarda sola (una escritura, la de la cola)', despues.length === antes + 1 && despues[despues.length - 1].filas[0]?.card_id === 'xy5-3', JSON.stringify(despues.slice(-1)).slice(0, 200))
  check('  …la cola queda vacía y el aviso se va', (await page.evaluate(() => JSON.parse(localStorage.getItem('pokedoc-cola-anadir') || '[]').length)) === 0 && !(await page.evaluate(() => !!document.getElementById('sinRedAviso'))))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. La página «Sin conexión» ──')
{
  // Un servidor PROPIO con el repo tal cual, y se apaga a mitad: así la red
  // se cae de verdad. `setOffline` de Playwright no corta lo que pide el
  // worker, que es quien va a la red en una navegación, y las rutas de
  // Playwright tampoco lo ven.
  const { spawn } = await import('node:child_process')
  const PUERTO = 8800 + Math.floor(Math.random() * 90)
  const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1', '--directory', RAIZ], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 1200))
  const ORIGEN = `http://127.0.0.1:${PUERTO}`
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('pokedoc-coleccion-guardada', JSON.stringify({ cuando: '2026-10-07T10:00:00Z', total: 5, distintas: 2, cartas: [{ n: 'Charizard', s: 'Set Básico', c: 3 }, { n: 'Pikachu', s: 'Set Básico', c: 2 }] }))
      localStorage.setItem('pokedoc-cola-anadir', JSON.stringify([{ userId: 'u1', nombre: 'Mewtwo', linea: { card_id: 'm', cantidad: 1 } }]))
    } catch {}
  })
  const page = await ctx.newPage()
  try {
    await page.goto(`${ORIGEN}/index.html`, { waitUntil: 'domcontentloaded' })
    const listo = await page.evaluate(async () => { try { await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 8000))]); return !!(await navigator.serviceWorker.getRegistration())?.active } catch { return false } })
    await page.waitForTimeout(800)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    check('el worker se instala, controla la página y guarda la de «Sin conexión»', listo && (await page.evaluate(async () => !!navigator.serviceWorker.controller && !!(await caches.match('/sin-conexion.html')))))
    await page.goto(`${ORIGEN}/aprender.html`, { waitUntil: 'domcontentloaded' })
    check('con red, una navegación es la página de verdad', !/Sin conexión/.test(await page.title()), await page.title())
    servidor.kill()
    await new Promise((r) => setTimeout(r, 500))
    await page.goto(`${ORIGEN}/torneos.html`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(500)
    const s = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, copia: [...document.querySelectorAll('#copiaLista li')].map((l) => l.textContent), cola: [...document.querySelectorAll('#colaLista li')].map((l) => l.textContent) }))
    check('sin red, la página «Sin conexión»', s.h1 === 'Sin conexión', JSON.stringify(s))
    check('  …con tu colección guardada', s.copia.length === 2 && /Charizard · Set Básico×3/.test(s.copia[0]), JSON.stringify(s.copia))
    check('  …y lo que queda por guardar', s.cola.length === 1 && /Mewtwo×1/.test(s.cola[0]), JSON.stringify(s.cola))
  } finally {
    servidor.kill()
    await ctx.close()
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

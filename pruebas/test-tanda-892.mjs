// Tanda 892 — que cada toque responda ya (R1) y la banda de instalar (I3).
//
// PINGU: «clicas en algo y la respuesta tiene que ser inmediata, porque si
// no la gente se cree que ha clicado y no ha hecho nada». Lo que se mira:
// lo puro (qué clic es una navegación); que al tocar un enlace salga la
// barra de progreso y el contenido se atenúe ANTES de que llegue la página
// nueva; que al tocar otra sección en la barra del móvil el icono se marque
// en el instante; que un clic que un script se queda no deje la barra
// puesta; que los botones se hundan al pulsarlos; y que la hoja de
// instalar sea ahora una banda de una línea, una vez por sesión, que abre
// la hoja al tocarla.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const { esNavegacion, MS_DE_RENDICION } = await import(`${RAIZ}/js/progreso.js`)
  const aqui = 'https://pokedoc.es/foro.html?q=x'
  const a = (href, extra = {}) => ({ href, target: '', hasAttribute: () => false, ...extra })
  const ev = (extra = {}) => ({ defaultPrevented: false, button: 0, ...extra })
  check('un enlace de la casa, sin más, navega', esNavegacion(a('https://pokedoc.es/meta.html'), ev(), aqui, 'https://pokedoc.es'))
  check('con Ctrl/Cmd (otra pestaña), no', !esNavegacion(a('https://pokedoc.es/meta.html'), ev({ ctrlKey: true }), aqui, 'https://pokedoc.es') && !esNavegacion(a('https://pokedoc.es/meta.html'), ev({ metaKey: true }), aqui, 'https://pokedoc.es'))
  check('si un script ya se quedó el clic, no', !esNavegacion(a('https://pokedoc.es/meta.html'), ev({ defaultPrevented: true }), aqui, 'https://pokedoc.es'))
  check('target=_blank, descarga y otro dominio, no', !esNavegacion(a('https://pokedoc.es/x', { target: '_blank' }), ev(), aqui, 'https://pokedoc.es') && !esNavegacion(a('https://pokedoc.es/x', { hasAttribute: () => true }), ev(), aqui, 'https://pokedoc.es') && !esNavegacion(a('https://otro.es/x'), ev(), aqui, 'https://pokedoc.es'))
  check('la misma página con otra almohadilla, no; otra consulta, sí', !esNavegacion(a('https://pokedoc.es/foro.html?q=x#arriba'), ev(), aqui, 'https://pokedoc.es') && esNavegacion(a('https://pokedoc.es/foro.html?q=y'), ev(), aqui, 'https://pokedoc.es'))
  check('se rinde a los seis segundos si la página no se va', MS_DE_RENDICION === 6000)
}

console.log('\n── 2. Lo estático ──')
{
  const css = leer('css/style.css')
  check('botones y enlaces con clase se hunden al pulsar', /a\[class\]:active, button:active, \[role='button'\]:active \{ transform: scale\(0\.97\)/.test(css))
  check('  …y sin el resaltado gris del móvil', /-webkit-tap-highlight-color: transparent/.test(css))
  check('la barra de progreso existe y respeta «menos movimiento»', /@keyframes progreso-avanza \{ from \{ width: 0; \} to \{ width: 82%/.test(css) && /prefers-reduced-motion: reduce\)[\s\S]*\.progreso-pagina\.andando i, \.progreso-pagina\.lista i \{ animation: none/.test(css))
  check('app.js la monta para todo el mundo', /import\('\.\/progreso\.js'\)/.test(leer('js/app.js')))
  check('la barra del móvil marca la sección tocada al instante', /EL ICONO SE MARCA YA \(892\)/.test(leer('js/barra-movil.js')))
  check('instalar: una banda, una vez por sesión, que abre la hoja', /bandaDeInstalar\(doc, callar\)/.test(leer('js/instalar.js')) && /sessionStorage\.getItem\(BANDA\)/.test(leer('js/instalar.js')))
}

console.log('\n── 3. En el iPhone ──')
const b = await chromium.launch()
{
  // Sin Service Worker ni precarga: lo que sirven ellos no pasa por `route`
  // (la precarga de la 812 trae la página al tocar, antes del clic), y
  // entonces la página de destino llega al instante y no hay «mientras» que
  // mirar. `saveData` es el interruptor con el que la precarga se calla.
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })
  })
  // La página de destino tarda: así se ve lo que pasa MIENTRAS llega.
  await ctx.route(/\/aprender\.html/, async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); r.continue() })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  check('la barra de progreso está montada y escondida', await p.$eval('.progreso-pagina', (x) => x.hidden))
  // Tocar «Aprender» en la barra de abajo. Mientras la navegación está
  // pendiente, `evaluate` no contesta («execution context was destroyed»),
  // así que lo que pasa a los 250 ms lo apunta LA PÁGINA y lo manda fuera.
  let enElToque = null
  await p.exposeFunction('__anota892', (x) => { enElToque = x })
  await p.evaluate(() => document.addEventListener('click', () => setTimeout(() => {
    const barra = document.querySelector('.progreso-pagina')
    const i = barra?.querySelector('i')
    const activo = document.querySelector('.bm a[aria-current="page"]')
    window.__anota892({ barraVisible: !!barra && !barra.hidden && getComputedStyle(barra).display !== 'none', ancho: i ? i.getBoundingClientRect().width : 0, atenuada: parseFloat(getComputedStyle(document.querySelector('.page-content')).opacity) < 1, activo: activo?.textContent.trim() })
  }, 250), { once: true }))
  const nav = p.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => null)
  // `noWaitAfter`: si no, el propio `click` espera a que la navegación que
  // provoca termine, y lo que se quiere mirar es justo lo de ANTES.
  await p.click('.bm a:has-text("Aprender")', { noWaitAfter: true })
  await p.waitForTimeout(600)
  check('a los 250 ms del toque, sin haber llegado la página: barra avanzando, contenido atenuado e icono «Aprender» marcado', enElToque && enElToque.barraVisible && enElToque.ancho > 0 && enElToque.atenuada && enElToque.activo === 'Aprender', JSON.stringify(enElToque))
  await nav
  await p.waitForTimeout(600)
  check('…y al llegar, la página nueva es Aprender y sin barra puesta', /aprender/.test(p.url()) && (await p.$eval('.progreso-pagina', (x) => x.hidden)))

  // Pulsado: con el dedo abajo, la pestaña se pinta pulsada (antes de tocar
  // nada que haga bajar la página, que la barra se esconde al bajar).
  const boton = await p.$('.bm a:has-text("Colección")')
  const caja = await boton.boundingBox()
  await p.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)
  await p.mouse.down()
  await p.waitForTimeout(120)
  const pulsado = await p.$eval('.bm a:has-text("Colección")', (x) => getComputedStyle(x).backgroundColor)
  // El dedo se va antes de soltar: así no hay clic y la página sigue aquí.
  await p.mouse.move(10, 10)
  await p.mouse.up()
  await p.waitForTimeout(200)
  check('con el dedo abajo, la pestaña se pinta pulsada', pulsado !== 'rgba(0, 0, 0, 0)', pulsado)

  // Un clic que un script se queda (la burbuja «subir», misma sección): no navega y la barra no sale.
  await p.evaluate(() => { const a = document.createElement('a'); a.href = '/meta.html'; a.id = 'noNavega'; a.textContent = 'x'; a.addEventListener('click', (e) => e.preventDefault()); document.body.appendChild(a) })
  await p.click('#noNavega')
  await p.waitForTimeout(200)
  check('un clic que un script se queda no enciende la barra', await p.$eval('.progreso-pagina', (x) => x.hidden))
  await ctx.close()
}

console.log('\n── 4. La banda de instalar (iPhone, tercera página vista) ──')
{
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; try { localStorage.setItem('pokedoc-visitas', '4') } catch {} })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  const banda = await p.evaluate(() => { const b = document.querySelector('.bm-instalar-banda'); if (!b) return null; const r = b.getBoundingClientRect(); const main = document.getElementById('contenido').getBoundingClientRect(); return { texto: b.textContent.replace(/\s+/g, ' ').trim(), alto: r.height, arriba: r.top <= main.top + 40, hoja: !!document.querySelector('.bm-instalar-hoja') } })
  check('sale una banda de una línea encima del contenido, no la hoja', banda && /Ten PokeDoc como una app/.test(banda.texto) && banda.alto <= 56 && banda.arriba && !banda.hoja, JSON.stringify(banda))
  await p.click('.bm-instalar-banda [data-instalar="abrir"]')
  await p.waitForTimeout(300)
  check('al tocarla se abre la hoja con los tres pasos', (await p.$$eval('.bm-instalar-pasos li', (li) => li.length)) === 3)
  await p.click('.bm-instalar [data-instalar="no"]')
  await p.waitForTimeout(200)
  check('«Ahora no» cierra la hoja y quita la banda', (await p.locator('.bm-instalar-hoja').count()) === 0 && (await p.locator('.bm-instalar-banda').count()) === 0)
  await ctx.close()

  const ctx2 = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx2.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; try { localStorage.setItem('pokedoc-visitas', '4') } catch {} })
  const q = await ctx2.newPage()
  await q.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await q.waitForTimeout(1500)
  check('sin contestar, en la primera página de la sesión sale', (await q.locator('.bm-instalar-banda').count()) === 1)
  await q.goto(`${BASE}/torneos.html`, { waitUntil: 'domcontentloaded' })
  await q.waitForTimeout(1500)
  check('…y en la siguiente de la MISMA sesión ya no (una vez por sesión)', (await q.locator('.bm-instalar-banda').count()) === 0)
  await ctx2.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

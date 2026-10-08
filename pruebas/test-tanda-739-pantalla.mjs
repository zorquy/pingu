// Tanda 739 — la barra lateral del ordenador (D1 de la lista de propuestas,
// elegidas por PINGU).
//
// Lo que se mira: el HTML puro (las cinco secciones, las páginas SOLO de la
// activa, «estás aquí» en la página y no en la sección); y en el navegador,
// que a 1.440 con ratón salga fija a la izquierda, que arriba queden solo
// el buscador, los avisos y el avatar, que lleve a cada sitio, que vaya
// la primera en el orden de tabulación tras el salto al contenido, que
// nada se salga de lado en cinco páginas, y que a 1.280 y en el móvil no
// salga.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { lateralHtml } = await import(`${RAIZ}/js/barra-lateral.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. El HTML ──')
{
  const secciones = [
    { nombre: 'Inicio', enlaces: [{ href: '/index.html', texto: 'Inicio' }, { href: '/noticias', texto: 'Noticias' }] },
    { nombre: 'Cartas', enlaces: [{ href: '/cartas', texto: 'Catálogo' }, { href: '/mi-coleccion', texto: 'Mi colección' }] },
    { nombre: 'Comunidad', enlaces: [{ href: '/foro.html', texto: 'Foro' }, { href: '/usuarios.html', texto: 'Gente' }] },
  ]
  const html = lateralHtml(secciones, 'Comunidad', 'foro', { conSesion: true })
  check('una entrada por sección', (html.match(/<li class="lat-seccion( lat-activa)?">/g) || []).length === 3)
  // Desde la 633 cada sección lleva su cajón; abierto, solo el de la activa
  // (los demás, cerrados e `inert`).
  check('las páginas: el cajón de la activa abierto y los demás cerrados', /class="lat-cajon lat-abierto" id="lat-cajon-\d+"><ul class="lat-paginas"><li><a href="\/foro.html"/.test(html) && /class="lat-cajon" id="lat-cajon-\d+" inert><ul class="lat-paginas"><li><a href="\/index.html"/.test(html))
  check('«estás aquí» en la página, una vez', (html.match(/aria-current="page"/g) || []).length === 1 && /href="\/foro.html" aria-current="page"/.test(html))
  check('Cartas lleva a Mi colección con cuenta', /class="lat-seccion-enlace" href="\/mi-coleccion"/.test(html))
  check('  …y al catálogo sin ella', /class="lat-seccion-enlace" href="\/cartas"/.test(lateralHtml(secciones, 'Inicio', 'index')))
}

const browser = await chromium.launch()
async function abrir(ruta, opciones = { viewport: { width: 1440, height: 900 } }) {
  const ctx = await browser.newContext({ locale: 'es-ES', ...opciones })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { page, ctx, errores }
}
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' }, sel)

console.log('── 2. A 1.440 con ratón ──')
{
  const { page, ctx, errores } = await abrir('/foro.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const lat = await page.evaluate(() => { const l = document.querySelector('.lat'); const r = l?.getBoundingClientRect(); return l ? { pos: getComputedStyle(l).position, x: r.left, w: Math.round(r.width), h: Math.round(r.height), secciones: [...l.querySelectorAll('.lat-seccion-enlace span')].map((s) => s.textContent), paginas: [...l.querySelectorAll('.lat-paginas a span')].map((s) => s.textContent), aqui: l.querySelector('[aria-current="page"]')?.textContent.trim(), cuerpo: getComputedStyle(document.body).paddingLeft } : null })
  check('fija a la izquierda, de arriba abajo, con las cinco secciones', lat?.pos === 'fixed' && lat.x === 0 && lat.w === 240 && lat.h === 900 && JSON.stringify(lat.secciones) === JSON.stringify(['Inicio', 'Aprender', 'Cartas', 'Comunidad', 'Jugar']), JSON.stringify(lat))
  check('  …con las páginas de Comunidad y el foro marcado', lat?.paginas.includes('Foro') && lat.paginas.includes('Gente') && lat.aqui === 'Foro', JSON.stringify(lat))
  check('  …y el contenido se aparta (no queda debajo)', lat?.cuerpo === '240px')
  check('arriba ya no están el logo ni los desplegables', !(await visible(page, '.navbar .nav-logo')) && !(await visible(page, '.navbar .nav-links')))
  check('  …y sí el buscador, los avisos y el avatar', (await visible(page, '#navSearchBtn')) && (await visible(page, '#navBellBtn')) && (await visible(page, '#navUserBtn')))
  check('cada enlace mide 44 de alto', await page.$$eval('.lat a', (as) => as.every((a) => a.getBoundingClientRect().height >= 44)))
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  check('en el orden de tabulación va primero, tras el salto al contenido', await page.evaluate(() => !!document.activeElement?.closest('.lat')), await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)))
  await Promise.all([page.waitForURL(/aprender/, { timeout: 4000 }).catch(() => null), page.click('.lat-seccion-enlace[href*="aprender"]')])
  await page.waitForTimeout(1500)
  check('lleva a la sección, y allí se abren sus páginas', /aprender/.test(page.url()) && (await page.$$eval('.lat-paginas a span', (s) => s.map((x) => x.textContent))).includes('Retos'), page.url())
  await ctx.close()
}

console.log('── 3. Nada se sale de lado ──')
for (const ruta of ['/index.html', '/mi-coleccion.html?ver=cartas', '/torneos.html', '/carta.html?id=base1-4', '/noticias']) {
  const { page, ctx, errores } = await abrir(ruta)
  const m = await page.evaluate(() => ({ lat: !!document.querySelector('.lat'), ancho: document.documentElement.scrollWidth, ventana: innerWidth }))
  check(`${ruta}: con la barra y sin desbordar`, m.lat && m.ancho <= m.ventana && errores.length === 0, JSON.stringify(m) + errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Donde no toca ──')
{
  const a = await abrir('/foro.html', { viewport: { width: 1280, height: 900 } })
  check('a 1.280, no sale y arriba sigue todo', (await a.page.locator('.lat').count()) === 0 && (await visible(a.page, '.navbar .nav-links')))
  await a.ctx.close()
  const b = await abrir('/foro.html', { ...devices['iPad Pro 11 landscape'] })
  check('en una tableta (dedo) tampoco', (await b.page.locator('.lat').count()) === 0)
  await b.ctx.close()
  const c = await abrir('/foro.html', { ...devices['iPhone 13'] })
  check('en el móvil, la barra de abajo y no esta', (await c.page.locator('.lat').count()) === 0 && (await c.page.locator('.bm').count()) === 1)
  await c.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

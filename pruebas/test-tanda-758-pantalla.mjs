// Tanda 758 — el menú corto (M1, M2 y M3 de la ronda 3, elegidas por PINGU
// con un «todo»).
//
// PINGU: «el catálogo es demasiado: quítalo del menú, pero que la página
// siga» y «Lanzamientos en Inicio, como Noticias». Arriba queda Noticias ·
// Lanzamientos · Aprender ▾ · Mi colección · Comunidad ▾ · Jugar ▾. El
// escáner se esconde EN TODAS PARTES («ocúltalo, que no funciona muy
// bien»): burbuja, paleta, atajo del icono, /buscar y el estado vacío; su
// código sigue. Y «Apoyar PokeDoc» (Ko-fi) en la hoja Tú y en el pie.
//
// Lo que se mira: el orden de la barra de arriba y del cajón; que /cartas
// no salga en ningún menú pero sí en el pie (SEO) y siga viva; que la
// burbuja de Inicio lleve Lanzamientos; que en Mi colección no quede nada
// del escáner ni ajenas; que /carta marque Mi colección; que el pie de las
// páginas lleve Ko-fi en pestaña nueva; que la hoja Tú lo lleve antes de
// Ajustes; que ni la paleta ni el manifiesto ofrezcan escanear.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { seccionesDe, SECCION_DE } from '/home/user/pingu/js/barra-movil.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const KOFI = 'https://ko-fi.com/pingucollects'

console.log('── 1. Las páginas, leídas tal cual ──')
{
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && /class="nav-links"/.test(readFileSync(`${RAIZ}/${f}`, 'utf8')))
  const malas = []
  const sinKofi = []
  for (const f of paginas) {
    const h = readFileSync(`${RAIZ}/${f}`, 'utf8')
    const links = h.slice(h.indexOf('class="nav-links"'), h.indexOf('class="nav-menu-mobile"'))
    // Lo de primer nivel, en orden: enlaces sueltos y los botones de grupo.
    const arriba = [...links.replace(/<div class="nav-sub">[\s\S]*?<\/div>/g, '').matchAll(/<a href="([^"]+)">([^<]+)<\/a>|class="nav-grupo-btn"[^>]*>([^<]+)</g)].map((m) => m[3] ? `${m[3]}▾` : m[2])
    if (arriba.join() !== 'Noticias,Lanzamientos,Aprender▾,Mi colección,Comunidad▾,Jugar▾') malas.push(`${f}: ${arriba.join()}`)
    if (/href="\/cartas"/.test(links) || /Catálogo de cartas/.test(h.slice(h.indexOf('class="nav-menu-mobile"'), h.indexOf('</nav>', h.indexOf('class="nav-menu-mobile"'))))) malas.push(`${f}: catálogo en el menú`)
    const pie = h.match(/<p class="footer-links">[\s\S]*?<\/p>/)?.[0]
    if (pie && !pie.includes(`<a href="${KOFI}" target="_blank" rel="noopener">Apoyar PokeDoc</a>`)) sinKofi.push(f)
  }
  check(`la barra de arriba de las ${paginas.length} páginas: Noticias · Lanzamientos · Aprender ▾ · Mi colección · Comunidad ▾ · Jugar ▾, sin el catálogo`, paginas.length >= 36 && malas.length === 0, malas.join(' | '))
  check('el pie lleva «Apoyar PokeDoc» a Ko-fi, en pestaña nueva', sinKofi.length === 0, sinKofi.join())
  const pie = readFileSync(`${RAIZ}/index.html`, 'utf8')
  check('  …y el catálogo sigue en el pie, que es lo que recorre Google', /<footer[\s\S]*href="\/cartas"[\s\S]*<\/footer>/.test(pie))
  const m = JSON.parse(readFileSync(`${RAIZ}/manifest.webmanifest`, 'utf8'))
  check('el icono instalado ya no ofrece escanear', !(m.shortcuts || []).some((a) => /escan/i.test(a.name + a.url)), JSON.stringify((m.shortcuts || []).map((a) => a.name)))
  check('/buscar no lleva el botón de escanear', !/bsEscanear|escanear=1/.test(readFileSync(`${RAIZ}/buscar.html`, 'utf8')))
  check('el estado vacío de Mi colección no ofrece escanear', !/data-vacio-escanear|Escanea la primera/.test(readFileSync(`${RAIZ}/mi-coleccion.html`, 'utf8')))
  check('  …y el escáner sigue en el código, escondido', /id="mcEscanerCaja"/.test(readFileSync(`${RAIZ}/mi-coleccion.html`, 'utf8')))
}

console.log('── 2. Las secciones del móvil, sin desplegable de Cartas ──')
{
  const s = seccionesDe(
    [{ nombre: 'Aprender', enlaces: [{ href: '/aprender.html', texto: 'Guías y cursos' }] }],
    [{ href: '/noticias', texto: 'Noticias' }, { href: '/lanzamientos.html', texto: 'Lanzamientos' }, { href: '/mi-coleccion', texto: 'Mi colección' }],
  )
  const por = Object.fromEntries(s.map((x) => [x.nombre, x.enlaces.map((e) => e.texto).join()]))
  check('lo suelto va a Inicio, y «Mi colección» ES la sección Cartas', por.Inicio === 'Inicio,Noticias,Lanzamientos' && por.Cartas === 'Mi colección', JSON.stringify(por))
  check('/carta y /cartas siguen siendo de Cartas, y Lanzamientos de Inicio', SECCION_DE.Cartas.includes('carta') && SECCION_DE.Cartas.includes('cartas') && SECCION_DE.Inicio.includes('lanzamientos'))
}

const browser = await chromium.launch()
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion ? 'admin-1' : 'none'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164 }]
  window.__FAKE_CARTAS__ = [{ id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', dex_ids: [13], tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
}
async function abrir(ruta, { movil = true, sesion = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx, errores }
}
const barra = (page) => page.$$eval('.bm a', (as) => as.map((a) => `${a.textContent.trim()}${a.getAttribute('aria-current') ? '*' : ''}:${a.getAttribute('href')}`))
const burbuja = (page) => page.$$eval('.bm-burbuja a', (as) => as.map((a) => `${a.textContent.trim()}${a.getAttribute('aria-current') ? '*' : ''}`))

console.log('── 3. En el iPhone ──')
{
  const l = await abrir('/lanzamientos.html')
  check('sin errores', l.errores.length === 0, l.errores.join(' | '))
  check('en Lanzamientos, Inicio activa', (await barra(l.page)).some((x) => x.startsWith('Inicio*:')), (await barra(l.page)).join(' | '))
  check('  …y su burbuja: Inicio, Noticias y Lanzamientos (activa)', (await burbuja(l.page)).join() === 'Inicio,Noticias,Lanzamientos*', (await burbuja(l.page)).join())
  await l.ctx.close()

  const m = await abrir('/mi-coleccion.html?ver=album')
  check('en Mi colección: Cartas activa, sin segunda burbuja, sin escanear ni ajenas', (await barra(m.page)).some((x) => x.startsWith('Cartas*:')) && (await m.page.locator('.bm-burbuja, .bm-escanear, .bm-ajena').count()) === 0, (await barra(m.page)).join(' | '))
  const pest = await m.page.$$eval('.mc-pestanias > *', (as) => as.map((a) => a.textContent.trim()).filter(Boolean))
  check('  …y su burbuja propia no lleva «Escanear» ni «Catálogo»', pest.length > 0 && !pest.some((t) => /Escanear|Catálogo/.test(t)), pest.join())
  await m.ctx.close()

  const c = await abrir('/cartas.html')
  check('/cartas sigue viva: Cartas activa y sin burbuja', (await barra(c.page)).some((x) => x.startsWith('Cartas*:')) && (await c.page.locator('.bm-burbuja').count()) === 0 && c.errores.length === 0, c.errores.join(' | '))
  await c.ctx.close()

  const t = await abrir('/index.html')
  await t.page.click('#navUserBtn')
  await t.page.waitForTimeout(900)
  const filas = await t.page.$$eval('#navUserDropdown .tu-lista a', (as) => as.map((a) => ({ t: a.textContent.trim(), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), alto: a.getBoundingClientRect().height, svg: !!a.querySelector('svg') })))
  const i = filas.findIndex((f) => f.href === KOFI)
  check('la hoja Tú lleva «Apoyar PokeDoc» justo antes de Ajustes', i >= 0 && filas[i + 1]?.t === 'Ajustes' && /^Apoyar PokeDoc/.test(filas[i].t) && /Ko-fi/.test(filas[i].t), JSON.stringify(filas.map((f) => f.t)))
  check('  …en pestaña nueva, con su icono y sus 44', filas[i]?.target === '_blank' && /noopener/.test(filas[i]?.rel) && filas[i].svg && filas[i].alto >= 44, JSON.stringify(filas[i]))
  await t.ctx.close()
}

console.log('── 4. En el ordenador ──')
{
  const d = await abrir('/carta.html?id=xy5-1', { movil: false })
  const activos = await d.page.$$eval('.nav-links a.active', (as) => as.map((a) => a.textContent.trim()))
  check('en la ficha de una carta, «Mi colección» sale marcada arriba', activos.join() === 'Mi colección', activos.join())
  const acciones = await d.page.evaluate(async () => (await import('/js/paleta.js')).accionesDisponibles('')).catch(() => null)
  check('la paleta (Ctrl+K) ya no ofrece escanear', acciones && acciones.length > 0 && !acciones.some((a) => /Escanear/.test(a.nombre)), JSON.stringify(acciones?.map((a) => a.nombre)))
  await d.ctx.close()
  const n = await abrir('/noticias.html', { movil: false })
  const ancho = await n.page.evaluate(() => { const l = document.querySelector('.nav-links'); return { cabe: l.scrollWidth <= l.clientWidth + 1, logo: Math.round(document.querySelector('.nav-logo').getBoundingClientRect().width) } })
  check('los seis caben en la barra de un portátil, sin apretar el logo', ancho.cabe && ancho.logo >= 100, JSON.stringify(ancho))
  await n.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

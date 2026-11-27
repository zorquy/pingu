// Tanda 1482 — Tiendas, de Comunidad a Colección (PINGU: «las tiendas en
// comunidad igual mejor quedarían en colección… van de la mano con las cartas,
// con deseos y cambios»; con la propuesta delante: «al final y todo lo de
// tiendas en amarillo»). Se mira:
//   · las páginas: «Tiendas» detrás de «Mi colección» arriba y en el menú, y
//     Comunidad en Foro, Eventos y Gente; /tiendas, /tienda y /para-tiendas
//     son de Colección (`cartas`), y la ficha de una tienda (/tiendas/<tienda>,
//     que es usuario.html) se pinta de Colección antes del primer pintado;
//   · lo puro: las secciones salen así de la barra y Tiendas es de Colección;
//   · el móvil: en /tiendas la burbuja es la de Colección (Panel, Cartas,
//     Deseos y cambios, Buscar y Tiendas marcada), en amarillo; en el foro,
//     Comunidad sin Tiendas;
//   · el PC: en la lateral, el cajón de Colección lleva las cuatro partes y
//     Tiendas al final, en /tiendas y dentro de Mi colección (alineada con
//     las pestañas).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readdirSync, readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Las páginas ──')
{
  const html = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const conBarra = html.filter((f) => readFileSync(`${RAIZ}/${f}`, 'utf8').includes('<a href="/eventos">Eventos</a>'))
  const mal = conBarra.filter((f) => {
    const s = readFileSync(`${RAIZ}/${f}`, 'utf8')
    return (s.match(/<a href="\/mi-coleccion">Mi colección<\/a>\n\s*<a href="\/tiendas">Tiendas<\/a>/g) || []).length !== 2 ||
      /<a href="\/eventos">Eventos<\/a>\n\s*<a href="\/tiendas">/.test(s)
  })
  check(`las ${conBarra.length} páginas: Tiendas detrás de Mi colección, arriba y en el menú; Comunidad sin ella`, conBarra.length >= 45 && !mal.length, mal.join(', '))
  const seccion = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8').match(/<html[^>]*>/)[0]
  check('/tiendas, /tienda y /para-tiendas son de Colección', ['tiendas.html', 'tienda.html', 'para-tiendas.html'].every((f) => seccion(f).includes('data-seccion="cartas"')), ['tiendas.html', 'tienda.html', 'para-tiendas.html'].map(seccion).join(' '))
  check('el rótulo de /tiendas dice «Colección · Tiendas»', readFileSync(`${RAIZ}/tiendas.html`, 'utf8').includes('<small class="tag-ante">Colección · Tiendas</small>'))
  const u = readFileSync(`${RAIZ}/usuario.html`, 'utf8')
  check('usuario.html sigue siendo de Comunidad y la ficha de una tienda se pinta de Colección en la cabecera', seccion('usuario.html').includes('data-seccion="comunidad"') && /<head>\s*<meta charset="UTF-8" \/>\s*<script>[^\n]*\^\\\/tiendas\\\/[^\n]*dataset\.seccion='cartas'<\/script>/.test(u))
}

console.log('── 2. Lo puro ──')
{
  const { SECCION_DE, seccionesDe, seccionActual, PARTES_DE_LA_COLECCION } = await import(`${RAIZ}/js/barra-movil.js`)
  const L = await import(`${RAIZ}/js/barra-lateral.js`)
  check('tiendas, tienda y para-tiendas son de Colección, no de Comunidad', ['tiendas', 'tienda', 'para-tiendas'].every((k) => SECCION_DE['Colección'].includes(k) && !SECCION_DE.Comunidad.includes(k)))
  const secciones = seccionesDe(
    [{ nombre: 'Comunidad', enlaces: [{ href: '/foro.html', texto: 'Foro' }, { href: '/eventos', texto: 'Eventos' }, { href: '/usuarios.html', texto: 'Gente' }] }],
    [{ href: '/noticias', texto: 'Noticias' }, { href: '/mi-coleccion', texto: 'Mi colección' }, { href: '/tiendas', texto: 'Tiendas' }],
  )
  const col = secciones.find((s) => s.nombre === 'Colección')
  check('de la barra sale Colección = Mi colección + Tiendas', col?.enlaces.map((e) => e.href).join() === '/mi-coleccion,/tiendas', JSON.stringify(col))
  check('/tiendas es de Colección', seccionActual(secciones, 'tiendas') === 'Colección')
  check('la lateral sigue ofreciendo las partes (las mismas que la burbuja)', L.PARTES_DE_LA_COLECCION === PARTES_DE_LA_COLECCION && PARTES_DE_LA_COLECCION.map((p) => p.texto).join() === 'Panel,Cartas,Deseos y cambios,Buscar')
  const lat = L.lateralHtml(secciones, 'Colección', 'tiendas')
  check('la lateral en /tiendas: las cuatro partes y Tiendas al final, marcada', /Panel[\s\S]*Cartas[\s\S]*Deseos y cambios[\s\S]*Buscar[\s\S]*href="\/tiendas" aria-current="page"/.test(lat))
}

const browser = await chromium.launch()
async function abrir({ movil = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block', colorScheme: 'dark' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { for (const s of ['cartas', 'comunidad']) localStorage.setItem(`pd-bienvenida-${s}`, '1') } catch {}
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
// El amarillo de Colección en oscuro (style.css).
const AMARILLO = 'rgb(228, 180, 74)'

console.log('── 3. El móvil ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await page.goto(`${BASE}/tiendas`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bm-burbuja-item[href="/tiendas"]', { timeout: 8000 }).catch(() => {})
  const r = await page.evaluate(() => ({
    seccion: document.documentElement.dataset.seccion,
    burbuja: [...document.querySelectorAll('.bm-burbuja-item')].map((a) => `${a.querySelector('.bm-texto')?.textContent}${a.getAttribute('aria-current') ? '*' : ''}>${a.getAttribute('href')}`).join('|'),
    abajo: document.querySelector('.bm a[aria-current="page"] span')?.textContent,
    color: getComputedStyle(document.querySelector('.bm-burbuja-item[aria-current="page"]') || document.body).backgroundColor,
  }))
  check('/tiendas: la burbuja de Colección con Tiendas al final y marcada', r.burbuja === 'Panel>/mi-coleccion?ver=resumen|Cartas>/mi-coleccion?ver=album|Deseos y cambios>/mi-coleccion?ver=mercado|Buscar>/mi-coleccion?ver=buscar|Tiendas*>/tiendas', r.burbuja)
  check('/tiendas: abajo, Colección; y en amarillo', r.seccion === 'cartas' && r.abajo === 'Colección' && r.color === AMARILLO, JSON.stringify(r))
  await page.goto(`${BASE}/foro`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bm-burbuja-item', { timeout: 8000 }).catch(() => {})
  const f = await page.evaluate(() => [...document.querySelectorAll('.bm-burbuja-item')].map((a) => a.getAttribute('href')).join('|'))
  check('el foro: Comunidad es Foro, Eventos y Gente', f === '/foro.html|/eventos|/usuarios.html', f)
  await page.goto(`${BASE}/mi-coleccion?ver=mercado`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.mc-pestanias .bm-ajena', { timeout: 8000 }).catch(() => {})
  const m = await page.evaluate(() => [...document.querySelectorAll('.mc-pestanias > a, .mc-pestanias > button')].map((a) => a.textContent.trim().replace(/Nuevo$/, '')).filter(Boolean).join('|'))
  check('Mi colección: Tiendas al final de su burbuja', /Buscar\|Tiendas$/.test(m), m)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // La ficha de una tienda: la cabecera la pinta de Colección antes que nada.
  const { ctx, page } = await abrir({ movil: true })
  await page.goto(`${BASE}/tiendas/ryu`, { waitUntil: 'commit' })
  await page.waitForSelector('html[data-seccion]', { timeout: 8000 }).catch(() => {})
  const s = await page.evaluate(() => document.documentElement.dataset.seccion)
  check('/tiendas/<tienda>: de Colección desde la cabecera', s === 'cartas' || s === 'tienda', s)
  await page.goto(`${BASE}/usuario/lucia`, { waitUntil: 'commit' })
  await page.waitForSelector('html[data-seccion]', { timeout: 8000 }).catch(() => {})
  check('/usuario/<persona>: sigue de Comunidad', (await page.evaluate(() => document.documentElement.dataset.seccion)) === 'comunidad')
  await ctx.close()
}

console.log('── 4. El PC ──')
{
  const { ctx, page, errores } = await abrir()
  const cajon = () => page.evaluate(() => {
    const c = [...document.querySelectorAll('.lat-seccion')].find((x) => x.querySelector('.lat-seccion-enlace span')?.textContent === 'Colección')
    const com = [...document.querySelectorAll('.lat-seccion')].find((x) => x.querySelector('.lat-seccion-enlace span')?.textContent === 'Comunidad')
    return {
      activa: c?.classList.contains('lat-activa'),
      enlaces: [...(c?.querySelectorAll('.lat-paginas a, .lat-paginas .mc-pestania') || [])].map((a) => `${(a.querySelector('span')?.textContent || a.textContent).trim()}${a.getAttribute('aria-current') ? '*' : ''}`).join('|'),
      comunidad: [...(com?.querySelectorAll('.lat-paginas a') || [])].map((a) => a.getAttribute('href')).join('|'),
    }
  })
  await page.goto(`${BASE}/tiendas`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.lat-paginas a[href="/tiendas"]', { timeout: 8000 }).catch(() => {})
  const t = await cajon()
  check('/tiendas: Colección activa, con sus cuatro partes y Tiendas marcada al final', t.activa && t.enlaces === 'Panel|Cartas|Deseos y cambios|Buscar|Tiendas*', JSON.stringify(t))
  check('/tiendas: Comunidad es Foro, Eventos y Gente', t.comunidad === '/foro.html|/eventos|/usuarios.html', t.comunidad)
  await page.goto(`${BASE}/mi-coleccion?ver=mercado`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.lat .lat-menu-sitio ~ li a[href="/tiendas"]', { timeout: 8000 }).catch(() => {})
  const a = await page.evaluate(() => {
    const x = (el) => { const i = el?.querySelector('svg')?.getBoundingClientRect(); return i ? Math.round(i.left) : null }
    return { pestania: x(document.querySelector('.lat .mc-pestania')), tiendas: x(document.querySelector('.lat .lat-menu-sitio ~ li a[href="/tiendas"]')) }
  })
  check('Mi colección: Tiendas debajo de las pestañas, alineada con ellas', a.pestania !== null && a.pestania === a.tiendas, JSON.stringify(a))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

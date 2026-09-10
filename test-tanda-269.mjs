import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 269: la sección de Noticias.
//
// PokeDoc empieza a publicar noticias en español. La decisión de fondo:
// una noticia NO es una cosa nueva, es un artículo de `guides` con
// `kind = 'news'`. Mismo editor, misma página de lectura, mismo índice.
// Lo que cambia es dónde se lista, con qué dirección y qué datos
// estructurados lleva.
//
// Lo que estas pruebas vigilan, por orden de lo que dolería:
//
//  1. QUE EL DESPLIEGUE NO APAGUE EL SITIO. Netlify publica al empujar y
//     la migración la ejecuta una persona a mano, después. En ese hueco
//     la columna `kind` NO EXISTE, y una consulta que la filtre no
//     devuelve cero filas: devuelve un error. Sin puente, la portada,
//     /aprender y las categorías se quedan vacías hasta que alguien se
//     acuerde del SQL.
//  2. Que las noticias no tapen las guías. Se publican mucho más a
//     menudo: sin filtro, tres noticias de una tarde barren de la
//     portada guías que han costado una semana.
//  3. Que cada noticia tenga UNA dirección. Se llega por dos caminos
//     (/noticias/<slug> y el de guía), y dos direcciones con el mismo
//     texto reparten entre las dos lo que debería ir a una.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const GUIAS = [
  { title: 'Cómo saber si una carta es falsa', category_id: 'cat-1' },
  { title: 'Empezar en el TCG', category_id: 'cat-1' },
]
// Con categoría A PROPÓSITO: una noticia puede llevarla (para la
// búsqueda), y es justo el caso en el que podría colarse en el temario.
const NOTICIAS = [
  { title: 'Reveladas las cartas del 30 aniversario', description: 'Todas las cartas, una por una.', category_id: 'cat-1' },
  { title: 'Rotación de septiembre', description: 'Qué sets se van.', category_id: 'cat-1' },
  { title: 'La Copa de España abre inscripciones', category_id: 'cat-1' },
]

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage({ viewport: { width: 1150, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: 'none', __FAKE_GUIAS__: GUIAS, __FAKE_NOTICIAS__: NOTICIAS, __FAKE_CATEGORIAS__: [{}, {}], ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1600)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La portada de noticias ──')
{
  const { page, errores } = await abrir('/noticias')
  check('sin errores', errores.length === 0, errores[0] || '')
  const titular = await page.locator('.noticia-titular h2').textContent()
  check('la más reciente va de titular', titular === NOTICIAS[0].title, String(titular))
  check('y el resto en la rejilla', (await page.locator('.noticia-tarjeta').count()) === NOTICIAS.length - 1)
  // Lo que NO puede salir aquí.
  const textos = await page.locator('.noticia-tarjeta h3, .noticia-titular h2').allTextContents()
  check('ninguna guía se cuela entre las noticias', !textos.some((t) => GUIAS.some((g) => g.title === t)), textos.join(' | '))
  check('el titular enlaza a su dirección limpia',
    (await page.locator('.noticia-titular').getAttribute('href')) === '/noticias/noticia-1')
  // La rejilla, de verdad: que la regla de CSS exista no basta.
  check('tres columnas en escritorio',
    (await page.locator('.noticias-rejilla').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 3)
  await page.setViewportSize({ width: 420, height: 900 })
  await page.waitForTimeout(250)
  check('una sola en el móvil',
    (await page.locator('.noticias-rejilla').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 1)
  await page.close()
}

console.log('\n── 2. La fecha, que es media noticia ──')
{
  const { page } = await abrir('/noticias')
  const legible = await page.locator('.noticia-titular .noticia-fecha').textContent()
  check('se dice cuándo fue, en cristiano', /hace \d+ (minuto|hora)/.test(legible), String(legible))
  // El atributo NO es decoración: es de donde sale la fecha para Google.
  const maquina = await page.locator('.noticia-titular .noticia-fecha').getAttribute('datetime')
  check('y en formato de máquina', !Number.isNaN(Date.parse(maquina || '')), String(maquina))
  // Y en TODAS, no solo en la grande: cada tarjeta es un enlace que
  // Google va a rastrear, y la fecha de cada una sale de su atributo.
  const todas = await page.locator('.noticia-tarjeta .noticia-fecha').evaluateAll((ts) =>
    ts.map((t) => t.getAttribute('datetime'))
  )
  check('en todas las tarjetas también',
    todas.length > 0 && todas.every((d) => !Number.isNaN(Date.parse(d || ''))), JSON.stringify(todas))
  await page.close()
}

console.log('\n── 3. Las noticias NO tapan las guías ──')
{
  const { page, errores } = await abrir('/')
  const recientes = await page.locator('#recentGrid .recent-card h3').allTextContents()
  check('sin errores', errores.length === 0, errores[0] || '')
  check('la portada solo enseña guías', recientes.every((t) => GUIAS.some((g) => g.title === t)), recientes.join(' | '))
  check('y las enseña todas', recientes.length === GUIAS.length, String(recientes.length))
  check('el contador cuenta guías, no filas', (await page.locator('#heroStatGuides').textContent()) === String(GUIAS.length))
  await page.close()
}

console.log('\n── 4. El puente: desplegar ANTES de ejecutar el SQL ──')
{
  // Es el caso que de verdad puede tumbar el sitio: Netlify publica al
  // empujar, y la migración la ejecuta una persona más tarde.
  const { page, errores } = await abrir('/', { __COLUMNAS_QUE_FALTAN__: ['kind'] })
  check('la portada no se cae', errores.length === 0, errores[0] || '')
  const recientes = await page.locator('#recentGrid .recent-card h3').allTextContents()
  check('y sigue enseñando artículos', recientes.length > 0, String(recientes.length))
  check('el contador no se queda en cero', (await page.locator('#heroStatGuides').textContent()) !== '0')
  await page.close()

  const conMigracion = await abrir('/aprender')
  const etiqueta = await conMigracion.page.locator('.category-row .progress-label').first().textContent()
  // Dos guías y tres noticias en la misma categoría: el temario cuenta 2.
  check('«Aprender» cuenta guías, no filas', /^2 guías/.test(etiqueta.trim()), etiqueta.trim())
  await conMigracion.page.close()

  const r = await abrir('/aprender', { __COLUMNAS_QUE_FALTAN__: ['kind'] })
  check('«Aprender» tampoco', r.errores.length === 0, r.errores[0] || '')
  check('y no se queda sin categorías', (await r.page.locator('.category-row').count()) > 0)
  await r.page.close()

  // Y /noticias, sin columna, no puede enseñar un error: es que todavía
  // no hay noticias.
  const n = await abrir('/noticias', { __COLUMNAS_QUE_FALTAN__: ['kind'] })
  check('/noticias avisa de que no hay, no de que ha fallado',
    (await n.page.locator('#noticiasRejilla').textContent()).includes('Todavía no hay noticias'))
  check('sin errores', n.errores.length === 0, n.errores[0] || '')
  await n.page.close()
}

console.log('\n── 5. La noticia, leída ──')
{
  const { page, errores } = await abrir('/guia?slug=noticia-1')
  check('sin errores', errores.length === 0, errores[0] || '')
  check('la chapa dice Noticia', (await page.locator('.guide-label').textContent()) === 'Noticia')
  const migas = await page.locator('.breadcrumb').textContent()
  check('las migas pasan por Noticias', migas.includes('Noticias'), migas.replace(/\s+/g, ' ').trim())
  check('sale la fecha de publicación', (await page.locator('.article-meta time').count()) === 1)
  // Ni nivel ni rareza: una noticia no es «básica» ni «de bronce».
  check('sin chapa de rareza', (await page.locator('.article-meta .rarity-chip').count()) === 0)
  // UNA dirección por artículo.
  check('la barra de direcciones se corrige sola',
    new URL(page.url()).pathname === '/noticias/noticia-1', page.url())
  const canonica = await page.locator('link[rel="canonical"]').getAttribute('href')
  check('y la canónica apunta ahí', canonica === 'https://pokedoc.es/noticias/noticia-1', String(canonica))
  await page.close()
}

console.log('\n── 6. Una guía sigue siendo una guía ──')
{
  const { page, errores } = await abrir('/guia?slug=guia-1')
  check('sin errores', errores.length === 0, errores[0] || '')
  check('no la disfraza de noticia', (await page.locator('.guide-label').textContent()) !== 'Noticia')
  check('conserva su chapa de rareza', (await page.locator('.article-meta .rarity-chip').count()) === 1)
  check('y su dirección no se toca', page.url().includes('slug=guia-1') && !page.url().includes('/noticias/'), page.url())
  await page.close()
}

console.log('\n── 7. La navegación ──')
{
  const { page } = await abrir('/')
  const enlace = page.locator('.nav-links a[href="/noticias"]')
  check('«Noticias» está en la barra', (await enlace.count()) === 1)
  check('y va la segunda, después de Inicio',
    (await page.locator('.nav-links a').nth(1).getAttribute('href')) === '/noticias')
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)

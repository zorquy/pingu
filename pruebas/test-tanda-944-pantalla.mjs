// Tanda 944 — «Colección de @usuario» en el perfil.
//
// PINGU: «tú cuando entras al perfil de alguien no ves su colección…
// debajo de la vitrina, un título que sea "Colección de" y el arroba de ese
// usuario, y que salgan las cartas, y que yo le dé a "Ver más" y me abra una
// página con su colección, con búsqueda, con filtros, con todo».
//
// Lo que se mira:
//   1. El perfil de alguien con la colección pública: el título con su
//      arroba, cuántas, sus cartas (lo último, sin repetir), tus marcas
//      encima, «Ver su colección» y la cifra «Cartas» que llevan a su vista
//      de Cartas; y la pestaña Vitrina sale aunque la vitrina esté vacía.
//   2. Con la colección privada: nada, y «Cartas» no es un enlace.
//   3. Su vista de Cartas dice de quién es y trae buscador y filtros.
//   4. Tu perfil: «Tu colección»; si es privada lo dice y deja hacerla
//      pública ahí mismo.
//   5. Lo puro.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const SETS = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160 }]
const carta = (n, nombre) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } })
const CARTAS = [carta(1, 'Weedle'), carta(2, 'Kakuna'), carta(3, 'Beedrill'), carta(4, 'Pidgey')]
const linea = (id, user, card, h, o = {}) => ({ id, user_id: user, card_id: card, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: new Date(Date.UTC(2026, 9, 1, h)).toISOString(), updated_at: '2026-10-01T10:00:00Z', ...o })
const COLECCION = [
  // Dani: el Kakuna lo más nuevo y dos veces (otra versión): sale una vez.
  linea('d1', 'user-2', 'xy5-1', 1), linea('d2', 'user-2', 'xy5-2', 5), linea('d3', 'user-2', 'xy5-2', 4, { variante: 'reverse' }), linea('d4', 'user-2', 'xy5-3', 3),
  // Marta (privada) tiene una.
  linea('m1', 'user-3', 'xy5-4', 1),
  // Yo tengo el Weedle; quiero el Beedrill.
  linea('y1', 'admin-1', 'xy5-1', 2),
]
const DESEOS = [{ id: 'w1', user_id: 'admin-1', card_id: 'xy5-3', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
const PERFILES = (yoPublica) => [
  { id: 'admin-1', username: 'pingu', display_name: 'PINGU', coleccion_publica: yoPublica },
  { id: 'user-2', username: 'danipoke', display_name: 'Dani', coleccion_publica: true },
  { id: 'user-3', username: 'marta', display_name: 'Marta', coleccion_publica: false },
]

const browser = await chromium.launch()
async function abrir({ yoPublica = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.perfiles
    window.__FAKE_VITRINA__ = []
    window.__FAKE_PRECIOS__ = []
  }, { SETS, CARTAS, COLECCION, DESEOS, perfiles: PERFILES(yoPublica) })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
}
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !e.closest('[hidden], .hidden') && e.getBoundingClientRect().height > 0 }, sel)

console.log('── 1. El perfil de alguien con la colección pública ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/usuario.html?id=user-2')
  check('la pestaña Vitrina sale (y abierta) aunque su vitrina esté vacía', (await page.locator('#profileTabs [data-ptab="vitrina"]').isVisible()) && (await page.locator('#profileTabs [data-ptab="vitrina"]').getAttribute('class')).includes('active'))
  check('debajo, «Colección de @danipoke»', (await visible(page, '#perfilColeccion')) && (await page.locator('#perfilColeccion .section-title').innerText()) === 'Colección de @danipoke')
  check('  …con cuántas tiene', /4 cartas/.test(await page.locator('#perfilColeccion .pcol-cuantas').innerText()))
  const ids = await page.$$eval('#perfilColeccion .pcol-foto', (as) => as.map((a) => a.dataset.marcaCarta).join())
  check('  …lo último que ha añadido primero, y cada carta una vez', ids === 'xy5-2,xy5-3,xy5-1', ids)
  const marcas = await page.$$eval('#perfilColeccion .pcol-foto', (as) => as.map((a) => `${a.dataset.marcaCarta}:${a.querySelector('.mk-tengo') ? '✓' : ''}${a.querySelector('.mk-quiero') ? '♥' : ''}`).join(' '))
  check('  …con tus marcas: el ✓ en la que tienes y el corazón en la que quieres', marcas === 'xy5-2: xy5-3:♥ xy5-1:✓', marcas)
  const ver = await page.getAttribute('#perfilColeccion .pcol-ver', 'href')
  check('«Ver su colección» abre sus Cartas', ver === '/mi-coleccion?u=danipoke&ver=cartas', ver)
  const cifra = await page.$eval('#profileStats .perfil-cifra', (a) => ({ tag: a.tagName, href: a.getAttribute('href') }))
  check('  …y la cifra «Cartas» también', cifra.tag === 'A' && cifra.href === '/mi-coleccion?u=danipoke&ver=cartas', JSON.stringify(cifra))
  const fila = await page.$eval('#perfilColeccion .pcol-fila', (f) => ({ ancho: f.scrollWidth <= f.clientWidth + 1 || getComputedStyle(f).overflowX === 'auto', una: new Set([...f.children].map((c) => Math.round(c.getBoundingClientRect().top))).size }))
  check('  …en UNA fila que se desliza', fila.una === 1 && fila.ancho, JSON.stringify(fila))
  check('sin errores', errores.length === 0, errores.join(' | '))

  console.log('── 3. Su vista de Cartas ──')
  await page.click('#perfilColeccion .pcol-ver')
  await page.waitForTimeout(2600)
  check('dice de quién es', (await visible(page, '#mcTitulo')) && /Colección de Dani/.test(await page.locator('#mcTitulo').innerText()), await page.locator('#mcTitulo').innerText().catch(() => ''))
  check('  …con su buscador, que dice que es SU colección', (await visible(page, '#mcBuscar')) && (await page.getAttribute('#mcBuscar', 'placeholder')) === 'Buscar en la colección de Dani', await page.getAttribute('#mcBuscar', 'placeholder'))
  check('  …sus filtros', await visible(page, '#mcFiltrosAbrir, [aria-controls="mcFiltros"], .mc-filtros-boton').catch(() => false) || (await page.locator('text=Filtros').count()) > 0)
  const suyas = await page.$$eval('#mcCartas .mc-carta[data-linea]', (as) => as.map((a) => a.dataset.linea).sort().join())
  check('  …y sus cartas (sus líneas, no las tuyas)', suyas === 'd1,d2,d3,d4', suyas || 'vacío')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Con la colección privada ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/usuario.html?id=user-3')
  check('no sale nada de su colección', !(await visible(page, '#perfilColeccion')) && (await page.locator('#perfilColeccion .pcol-carta').count()) === 0)
  const cifra = await page.$eval('#profileStats .perfil-cifra', (a) => a.tagName)
  check('  …y «Cartas» no es un enlace', cifra === 'DIV', cifra)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Tu perfil ──')
{
  const { ctx, page, errores } = await abrir({ yoPublica: false })
  await ir(page, '/perfil.html')
  check('«Tu colección» con lo tuyo', (await visible(page, '#perfilColeccion')) && (await page.locator('#perfilColeccion .section-title').innerText()) === 'Tu colección' && (await page.locator('#perfilColeccion .pcol-carta').count()) === 1)
  check('  …sin marcas (todo es tuyo)', (await page.locator('#perfilColeccion .mk-tengo, #perfilColeccion .mk-quiero').count()) === 0)
  check('  …y como es privada, lo dice', /Solo la ves tú/.test(await page.locator('#perfilColeccion .pcol-privada').innerText().catch(() => '')))
  await page.click('#perfilColeccion [data-pcol-publica]')
  await page.waitForTimeout(900)
  const publica = await page.evaluate(() => window.__TABLAS__.user_profiles.find((p) => p.id === 'admin-1').coleccion_publica)
  check('«Hacerla pública» la hace pública y el aviso se va', publica === true && (await page.locator('#perfilColeccion .pcol-privada').count()) === 0, String(publica))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ yoPublica: true })
  await ir(page, '/perfil.html')
  check('pública: sin el aviso', (await visible(page, '#perfilColeccion')) && (await page.locator('#perfilColeccion .pcol-privada').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Lo puro ──')
{
  const { ultimasDistintas, tituloDeColeccion, cabeceraHtml } = await import(`${RAIZ}/js/perfil-coleccion.js`).catch(async () => {
    // Importa supabase.js, que en Node no carga: lo puro se prueba igual
    // leyendo las funciones del fichero.
    return import(`data:text/javascript,${encodeURIComponent((await import('node:fs')).readFileSync(`${RAIZ}/js/perfil-coleccion.js`, 'utf8').replace(/^import .*$/gm, '').replace(/urlDeColeccion\(username\)/g, '`/mi-coleccion?u=${username}&ver=cartas`').replace(/escapeHtml\(/g, 'String(').replace(/\bescapeHtml\b/g, 'String'))}`)
  })
  const l = (id, m = 'WEST') => ({ card_id: id, market: m })
  check('sin repetir y en el orden en que llegan', ultimasDistintas([l('a'), l('b'), l('a'), l('c')]).map((x) => x.card_id).join() === 'a,b,c')
  check('  …el mismo id en otro catálogo es otra carta', ultimasDistintas([l('a'), l('a', 'JP')]).length === 2)
  check('  …y con tope', ultimasDistintas([l('a'), l('b'), l('c')], 2).length === 2)
  check('el título: «Colección de @x» o «Tu colección»', tituloDeColeccion({ username: 'x' }) === 'Colección de @x' && tituloDeColeccion({ username: 'x', propia: true }) === 'Tu colección')
  check('sin cuenta sabida, no dice «0 cartas»', !/pcol-cuantas/.test(cabeceraHtml({ username: 'x', total: null })) && /1 carta</.test(cabeceraHtml({ username: 'x', total: 1 })))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

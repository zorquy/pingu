// Tanda 860 — los tres pequeños de la segunda propuesta (punto 5):
//  · al acabar un reto, «Siguiente: <el que te quede> →» y «Volver a los
//    retos» (antes te quedabas en el resultado);
//  · el constructor con «‹ Mis mazos» como todas las fichas (857), a la
//    izquierda, en vez de un enlace a la derecha;
//  · tocar en la barra de abajo la sección en la que ya estás, con un filtro
//    puesto, te lleva a la lista limpia (antes solo subía y parecía que no
//    hacía nada); en Mi colección sube un nivel o quita los filtros sin
//    recargar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. El siguiente reto, sin navegador ──')
const { siguienteReto, siguienteRetoHtml } = await import(`${RAIZ}/js/retos-siguiente.js`)
const { RETOS } = await import(`${RAIZ}/js/retos-xp.js`)
{
  const hechos = (lista) => (j) => lista.includes(j)
  check('tras la silueta, con «ordena» hecho, toca la expansión', siguienteReto('silueta', hechos(['ordena']))?.juego === 'expansion', siguienteReto('silueta', hechos(['ordena']))?.juego)
  check('da la vuelta: tras la expansión con todo lo de después hecho, el primero de la lista', siguienteReto('expansion', hechos(['reto']))?.juego === 'carta')
  check('nunca el mismo; y con todos hechos, nada', siguienteReto('carta', hechos(RETOS.map((r) => r.juego).filter((j) => j !== 'carta'))) === null)
  const html = siguienteRetoHtml(RETOS[3])
  check('el HTML: el grande con el título y su ruta, y la vuelta a /retos', /class="btn-primary rj-siguiente" href="\/quien-es">Siguiente: ¿Quién es ese Pokémon\? →/.test(html) && /class="btn-secondary rj-volver-retos" href="\/retos">Volver a los retos</.test(html), html)
  check('  …y sin siguiente, solo la vuelta, diciendo que están todos', !/rj-siguiente/.test(siguienteRetoHtml(null)) && /Todos hechos por hoy/.test(siguienteRetoHtml(null)))
}

const browser = await chromium.launch()
const hoy = new Date().toISOString().slice(0, 10)
const { pokemonDelDia } = await import(`${RAIZ}/js/quien-es.js`)
const buena = pokemonDelDia(hoy)
const semilla = ({ hoy, buena }) => {
  window.__FAKE_SESSION__ = 'user-1'
  try {
    localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
    // La silueta de hoy acertada a la primera, y «Ordena por precio» hecho:
    // el siguiente tiene que saltárselo.
    localStorage.setItem('pokedoc-quien-es', JSON.stringify({ dia: hoy, elegidos: [buena], acertada: true }))
    localStorage.setItem('pokedoc-ordena-precio', JSON.stringify({ dia: hoy, intentos: [[1, 2, 3, 4]], acertada: true }))
  } catch { /* sin memoria */ }
  window.__FAKE_CATEGORIAS__ = [{ id: 'cat-mazos', name: 'Mazos', slug: 'mazos' }]
  window.__FAKE_GUIAS__ = [{ slug: 'guia-charizard', title: 'Cómo jugar Charizard ex', description: 'Lista', published_at: '2026-10-01T10:00:00Z', content: '<p>Un párrafo.</p>', category_id: 'cat-mazos' }]
  window.__FAKE_SETS__ = [
    { id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST', release_date: '2025-09-26', card_count_official: 120, card_count_total: 120 },
    { id: 'sv7', name: 'Pitch Black', serie_id: 'sv', market: 'WEST', release_date: '2025-07-18', card_count_official: 100, card_count_total: 100 },
  ]
  const c = (set, n, nombre, dex) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${set}/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [dex], tcg_sets: { id: set, name: set === 'sv8' ? 'Mega Evolution' : 'Pitch Black', serie_id: 'sv' } })
  window.__FAKE_CARTAS__ = Array.from({ length: 60 }, (_, i) => c('sv8', i + 1, `Carta ${i + 1}`, (i % 4) + 1)).concat([c('sv7', 1, 'Bulbasaur', 1)])
  window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'user-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }]
}
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { hoy, buena })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|pokeapi|jsdelivr/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}
const caja = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { texto: el.textContent.trim(), href: el.getAttribute('href'), x: Math.round(r.left), alto: Math.round(r.height), ancho: Math.round(r.width), visible: getComputedStyle(el).display !== 'none' && r.height > 0 }
}, sel)

console.log('── 2. Al acabar la silueta de hoy ──')
{
  const { page, ctx, errores } = await abrir('/quien-es.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Desde la 988, las salidas son tres (`salidasHtml`): el siguiente grande,
  // Compartir y «Jugar otra vez»; la vuelta va en la flecha de arriba.
  const sig = await caja(page, '#qeFinal .rj-salidas .rj-siguiente')
  check('«Siguiente: ¿De qué expansión es? →» (se salta el de ordenar, que está hecho), de 44 px y a lo ancho', sig?.visible && sig.texto === 'Siguiente: ¿De qué expansión es? →' && sig.href === '/que-expansion' && sig.alto >= 44 && sig.ancho > 300, JSON.stringify(sig))
  const otra = await caja(page, '#qeFinal .rj-salidas .rj-otra')
  check('  …y debajo «Jugar otra vez», a una partida libre', otra?.visible && /^\/quien-es\?libre=\d+$/.test(otra.href) && otra.texto === 'Jugar otra vez' && otra.alto >= 44, JSON.stringify(otra))
  check('  …sin «Volver a los retos» (988)', (await page.locator('#qeFinal .rj-volver-retos').count()) === 0)
  check('  …y Compartir ya no es el botón grande', (await page.locator('#qeCompartir.btn-secondary').count()) === 1)
  await ctx.close()
}

console.log('── 3. El constructor ──')
{
  const { page, ctx, errores } = await abrir('/constructor.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await caja(page, '.breadcrumb a:last-of-type')
  const h1 = await caja(page, '.cm-cabecera-pagina h1')
  check('en el iPhone, «‹ Mis mazos» de 44 px, pegado a la izquierda y encima del título', m?.visible && m.texto === 'Mis mazos' && m.href === '/mazos' && m.alto >= 44 && m.x <= 24 && h1 && m.x <= h1.x + 4, JSON.stringify({ m, h1 }))
  check('  …y ya no está el enlace de la derecha', (await page.locator('.cm-enlace-mazos').count()) === 0)
  await ctx.close()
  const pc = await abrir('/constructor.html', { movil: false })
  const migas = await pc.page.evaluate(() => document.querySelector('.breadcrumb')?.textContent.replace(/\s+/g, ' ').trim())
  check('en el PC, «Inicio › Mis mazos»', migas === 'Inicio › Mis mazos', migas)
  await pc.ctx.close()
}

console.log('── 4. La barra de abajo con un filtro puesto ──')
{
  const { page, ctx } = await abrir('/aprender.html?tema=mazos')
  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(300)
  await page.evaluate(() => document.querySelector('nav.bm a[href="/aprender.html"]').click())
  await page.waitForTimeout(1500)
  const donde = await page.evaluate(() => ({ ruta: location.pathname, busca: location.search, y: Math.round(window.scrollY) }))
  check('en /aprender?tema=mazos, tocar Aprender va a la lista limpia, arriba', donde.ruta === '/aprender.html' && donde.busca === '' && donde.y === 0, JSON.stringify(donde))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=album&set=sv8')
  await page.evaluate(() => { window.__marca = 1; window.scrollTo(0, 600) })
  await page.waitForTimeout(300)
  const dentro = await page.evaluate(() => /set=sv8/.test(location.search))
  await page.evaluate(() => document.querySelector('nav.bm a[href*="mi-coleccion"]').click())
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => ({ marca: window.__marca, busca: location.search }))
  check('dentro de una expansión, tocar Cartas sube a Expansiones sin recargar', dentro && r.marca === 1 && !/set=/.test(r.busca) && /ver=album/.test(r.busca), JSON.stringify(r))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=cartas')
  await page.fill('#mcBuscar', 'Carta 1')
  await page.waitForTimeout(500)
  await page.evaluate(() => { window.__marca = 1 })
  await page.evaluate(() => document.querySelector('nav.bm a[href*="mi-coleccion"]').click())
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => ({ marca: window.__marca, buscado: document.getElementById('mcBuscar').value, busca: location.search }))
  check('en Cartas con algo buscado, tocar Cartas lo quita y se queda en la pestaña', r.marca === 1 && r.buscado === '' && /ver=cartas/.test(r.busca), JSON.stringify(r))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

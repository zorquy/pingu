// Tanda 704 — la barra inferior del móvil y las píldoras de sección.
//
// PINGU: «la interfaz de móvil, ¿cómo podríamos mejorar?» y, con las
// maquetas delante, «adelante». Tres niveles: abajo la sección (fija,
// la misma en todas las páginas), arriba las páginas de esa sección (lo
// que vive en cada desplegable de escritorio) y dentro lo de cada
// página. Lo que se mira: que la barra salga en el móvil y no en el
// escritorio, que la sección activa sea la buena también en una página
// que no está en ningún desplegable (la ficha de una carta), que las
// píldoras sean los enlaces del desplegable, que Cartas lleve a Mi
// colección con cuenta y al catálogo sin ella, que la burbuja de Mi
// colección deje de flotar, y que todo mida 44.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { claveDePagina, SECCION_DE, ORDEN } from '/home/user/pingu/js/barra-movil.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('── 1. La clave de una página y su sección ──')
check('«/mi-coleccion», «/mi-coleccion.html?ver=panel» y «mi-coleccion.html» son la misma clave', ['/mi-coleccion', '/mi-coleccion.html?ver=panel', 'mi-coleccion.html', '/mi-coleccion/'].every((h) => claveDePagina(h) === 'mi-coleccion'))
check('la raíz es «index», y una guía por ruta bonita es «guia»', claveDePagina('/') === 'index' && claveDePagina('/index.html') === 'index' && claveDePagina('/guia/falsificaciones') === 'guia')
check('las cinco secciones en su orden, y cada página de detalle tiene la suya', ORDEN.join() === 'Inicio,Aprender,Cartas,Comunidad,Jugar' && SECCION_DE.Cartas.includes('carta') && SECCION_DE.Comunidad.includes('tema') && SECCION_DE.Jugar.includes('torneo') && SECCION_DE.Aprender.includes('guia'))

const browser = await chromium.launch()
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion ? 'admin-1' : 'none'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164 }]
  window.__FAKE_CARTAS__ = [{ id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', dex_ids: [13], tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
}
async function abrir(ruta, { movil = true, sesion = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1200, height: 900 }, locale: 'es-ES' })
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
const barra = async (page) => page.$$eval('.bm a', (as) => as.map((a) => `${a.textContent.trim()}${a.getAttribute('aria-current') ? '*' : ''}:${a.getAttribute('href')}`))
const pildoras = async (page) => page.$$eval('.bm-secc a', (as) => as.map((a) => `${a.textContent.trim()}${a.getAttribute('aria-current') ? '*' : ''}`))

console.log('── 2. La portada en un iPhone ──')
{
  const { page, ctx, errores } = await abrir('/index.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await barra(page)
  check('la barra de abajo: cinco secciones en su orden, Inicio activa, y Cartas lleva a Mi colección (hay cuenta)', b.length === 5 && b[0] === 'Inicio*:/index.html' && b[1].startsWith('Aprender:') && b[2] === 'Cartas:/mi-coleccion' && b[3].startsWith('Comunidad:') && b[4].startsWith('Jugar:'), b.join(' | '))
  const caja = await page.$eval('.bm', (e) => { const r = e.getBoundingClientRect(); return { bottom: Math.round(r.bottom), alto: Math.round(r.height), vh: window.innerHeight, fija: getComputedStyle(e).position } })
  check('  …fija y pegada al borde de abajo', caja.fija === 'fixed' && caja.bottom === caja.vh && caja.alto >= 56, JSON.stringify(caja))
  check('  …cada hueco mide 44 o más', (await page.$$eval('.bm a', (as) => as.every((a) => a.getBoundingClientRect().height >= 44 && a.getBoundingClientRect().width >= 44))))
  check('  …la página reserva sitio debajo para que la barra no tape el final', (await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom))) >= 72)
  check('  …y la hamburguesa se va: todo lo suyo está en la barra y las píldoras', !(await page.locator('.nav-toggle').isVisible()))
  check('las píldoras de Inicio: Inicio (activa) y Noticias', (await pildoras(page)).join() === 'Inicio*,Noticias', (await pildoras(page)).join())
  check('la hoja se inyecta sola', (await page.locator('link[href="css/movil.css"]').count()) === 1)
  await ctx.close()
}

console.log('── 3. Mi colección: Cartas activa, sus páginas arriba, y la burbuja deja de flotar ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const b = await barra(page)
  check('Cartas activa', b.some((x) => x.startsWith('Cartas*:')), b.join(' | '))
  check('las píldoras son los enlaces del desplegable «Cartas», con Mi colección activa', (await pildoras(page)).join() === 'Catálogo de cartas,Lanzamientos,Mi colección*', (await pildoras(page)).join())
  check('  …y van ANTES de todo lo de la página', (await page.$eval('main', (m) => m.firstElementChild?.className)) === 'bm-secc')
  const mc = await page.$eval('.mc-pestanias', (e) => ({ pos: getComputedStyle(e).position, visible: e.getBoundingClientRect().height > 0 }))
  check('las pestañas de Mi colección ya no flotan: fila normal bajo la cabecera', mc.pos === 'static' && mc.visible, JSON.stringify(mc))
  check('  …y cada pestaña mide 44', (await page.$$eval('.mc-pestania', (as) => as.every((a) => a.getBoundingClientRect().height >= 44))))
  await ctx.close()
}

console.log('── 4. Las demás secciones, y una página que no está en ningún desplegable ──')
{
  const { page, ctx } = await abrir('/torneos.html')
  check('Torneos: Jugar activa y sus páginas arriba, con Torneos activa', (await barra(page)).some((x) => x.startsWith('Jugar*:')) && (await pildoras(page))[0] === 'Torneos*' && (await pildoras(page)).includes('Mazos del meta'), (await pildoras(page)).join())
  await ctx.close()
  const f = await abrir('/foro.html')
  check('Foro: Comunidad activa, píldoras Foro (activa) y Gente', (await barra(f.page)).some((x) => x.startsWith('Comunidad*:')) && (await pildoras(f.page)).join() === 'Foro*,Gente', (await pildoras(f.page)).join())
  await f.ctx.close()
  const c = await abrir('/carta.html?id=xy5-1')
  check('la ficha de una carta no está en ningún desplegable y aun así Cartas sale activa, con sus píldoras sin ninguna encendida', (await barra(c.page)).some((x) => x.startsWith('Cartas*:')) && (await pildoras(c.page)).length === 3 && !(await pildoras(c.page)).some((x) => x.endsWith('*')), (await pildoras(c.page)).join())
  await c.ctx.close()
}

console.log('── 5. Sin cuenta, y en el escritorio ──')
{
  const { page, ctx } = await abrir('/index.html', { sesion: false })
  check('sin cuenta, Cartas lleva al catálogo', (await barra(page)).some((x) => x === 'Cartas:/cartas'), (await barra(page)).join(' | '))
  await ctx.close()
  const d = await abrir('/index.html', { movil: false })
  check('en el escritorio no hay barra, ni píldoras, ni se descarga su hoja', (await d.page.locator('.bm').count()) === 0 && (await d.page.locator('.bm-secc').count()) === 0 && (await d.page.locator('link[href="css/movil.css"]').count()) === 0)
  check('  …y la barra de arriba sigue con sus desplegables', (await d.page.locator('.nav-links .nav-grupo-btn').count()) === 4)
  await d.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

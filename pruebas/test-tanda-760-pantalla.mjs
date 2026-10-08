// Tanda 760 — el archivador abierto (AL4, AL5 y AL6 de la ronda 3).
//
// PINGU, viendo Holonook: el binder abierto con sus dos hojas y las
// anillas, lo tuyo a color con ✓ y lo que falta en gris con su número, una
// cabecera con el logo, lo que falta y lo que cuesta; pasar páginas con las
// flechas, el «Ir a…», la esquina, el teclado y el dedo; en el móvil una
// hoja a la vez con puntos; tocar un bolsillo vacío abre el buscador y la
// carta va A ESE bolsillo; y mantener pulsado para mover una carta.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { sinHuecosAlFinal, ponerEnBolsillo, cambiarBolsillos } from '/home/user/pingu/js/mi-coleccion/albumes.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

console.log('── 1. Los huecos, puros ──')
check('los huecos del final no se guardan', JSON.stringify(sinHuecosAlFinal([{ id: 'a' }, {}, { id: 'b' }, {}, {}])) === '[{"id":"a"},{},{"id":"b"}]')
check('poner en el bolsillo 4 rellena con huecos hasta él', JSON.stringify(ponerEnBolsillo([{ id: 'a' }], 3, 'z')) === '[{"id":"a"},{},{},{"id":"z"}]')
check('cambiar con un bolsillo más allá del final lo lleva AHÍ', JSON.stringify(cambiarBolsillos([{ id: 'a' }, { id: 'b' }], 0, 4)) === '[{},{"id":"b"},{},{},{"id":"a"}]')

const browser = await chromium.launch()
const N = 30
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, logo_tcggo: 'https://images.tcggo.com/logo-sv8.png' }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
const ALBUMES = [
  { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', cartas: CARTAS.map((c) => ({ id: c.id })), updated_at: '2026-10-05T10:00:00Z' },
  { id: 'alb-bin', user_id: 'admin-1', nombre: 'Mis favoritas', tipo: 'binder', rejilla: '2x2', paginas: 10, tapa: 'verde', cartas: [{ id: 'sv8-2' }, {}, { id: 'sv8-5' }], updated_at: '2026-10-04T10:00:00Z' },
]
async function abrir(album, { movil = false, ancho = 1280 } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: ancho, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
      { id: 'l2', card_id: 'sv8-5', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
    ]
    window.__FAKE_ALBUMES__ = ALBUMES
  }, { SETS, CARTAS, ALBUMES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /logo/.test(r.request().url()) ? '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=carpetas&album=${album}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-hoja', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}
const paginas = (page) => page.textContent('#mcAlbPaginas')
const guardado = (page, id) => page.evaluate((id) => (window.__TABLAS__.user_albums.find((a) => a.id === id)?.cartas || []).map((c) => c.id || '·').join(), id)

console.log('── 2. Un álbum de set, abierto en el ordenador ──')
{
  const { ctx, page, errores } = await abrir('alb-set')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const cab = await page.evaluate(() => ({ logo: !!document.querySelector('#mcAlbCabeceraLogo img') && !document.getElementById('mcAlbCabeceraLogo').classList.contains('hidden'), clase: document.getElementById('mcAlbCabecera').className, progreso: document.getElementById('mcAlbProgreso').textContent.replace(/\s+/g, ' ').trim() }))
  check('la cabecera lleva el logo del set y cuántas tienes', cab.logo && /mc-alb-cabecera-set/.test(cab.clase) && /2 de 30/.test(cab.progreso), JSON.stringify(cab))
  await page.waitForTimeout(800)
  check('  …y lo que te falta y lo que costaría', /Te faltan 28/.test(await page.textContent('#mcAlbFalta')), await page.textContent('#mcAlbFalta'))
  const hojas = await page.evaluate(() => ({ hojas: document.querySelectorAll('#mcAlbArchivador .mc-hoja:not(.mc-hoja-fantasma)').length, anillas: document.querySelectorAll('#mcAlbArchivador .mc-anillas i').length, tengo: document.querySelectorAll('#mcAlbArchivador .mc-bolsillo.tengo .mc-tengo-marca').length, gris: [...document.querySelectorAll('#mcAlbArchivador .mc-bolsillo:not(.tengo) img')].every((i) => /grayscale/.test(getComputedStyle(i).filter)) }))
  check('dos hojas frente a frente con sus anillas; lo tuyo con ✓ y lo demás en gris', hojas.hojas === 2 && hojas.anillas === 3 && hojas.tengo === 2 && hojas.gris, JSON.stringify(hojas))
  check('una esquina para pasar, y no la de volver en la primera', (await page.locator('[data-esquina="despues"]').count()) === 1 && (await page.locator('[data-esquina="antes"]').count()) === 0)
  if (CAPS) await page.screenshot({ path: `${CAPS}/760-set.png` })
  await page.click('[data-esquina="despues"]')
  await page.waitForTimeout(400)
  check('la esquina pasa el pliego', /^Página 3-4 de 4/.test(await paginas(page)), await paginas(page))
  check('  …con la hoja entrando por su lado', await page.evaluate(() => document.querySelector('#mcAlbArchivador .mc-archivador').classList.contains('mc-pasa-adelante')))
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)
  check('← vuelve atrás', /^Página 1-2 de 4/.test(await paginas(page)), await paginas(page))
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  check('→ pasa', /^Página 3-4 de 4/.test(await paginas(page)), await paginas(page))
  await page.focus('#mcAlbTitulo')
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)
  check('  …pero no mientras escribes', /^Página 3-4 de 4/.test(await paginas(page)), await paginas(page))
  check('los bolsillos de un set no son huecos para elegir', (await page.locator('#mcAlbArchivador [data-hueco]').count()) === 0)
  await ctx.close()
}

console.log('── 3. En el iPhone: una hoja, deslizar y puntos ──')
{
  const { ctx, page, errores } = await abrir('alb-set', { movil: true })
  const puntos = await page.$$eval('#mcAlbPuntos i', (is) => is.map((i) => i.classList.contains('activo')))
  check('una hoja a la vez, con un punto por hoja y el primero encendido', (await page.locator('#mcAlbArchivador .mc-hoja:not(.mc-hoja-fantasma)').count()) === 1 && puntos.length === 4 && puntos[0] && puntos.filter(Boolean).length === 1, JSON.stringify(puntos))
  const caja = await page.$eval('#mcAlbArchivador', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 120 } })
  const deslizar = (dx) => page.evaluate(({ x, y, dx }) => {
    const el = document.getElementById('mcAlbArchivador')
    const t = (cx) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x)], changedTouches: [t(x)], bubbles: true }))
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x + dx)], bubbles: true }))
  }, { ...caja, dx })
  await deslizar(-120)
  await page.waitForTimeout(400)
  check('deslizar hacia la izquierda pasa la hoja', /^Página 2 de 4/.test(await paginas(page)), await paginas(page))
  check('  …y el punto se mueve', (await page.$$eval('#mcAlbPuntos i', (is) => is.findIndex((i) => i.classList.contains('activo')))) === 1)
  await deslizar(120)
  await page.waitForTimeout(400)
  check('y a la derecha, vuelve', /^Página 1 de 4/.test(await paginas(page)), await paginas(page))
  if (CAPS) await page.screenshot({ path: `${CAPS}/760-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Un binder: tocar un bolsillo vacío y elegir la carta ──')
{
  const { ctx, page, errores } = await abrir('alb-bin')
  const vista = await page.evaluate(() => ({ cab: document.getElementById('mcAlbCabecera').className, tapa: document.getElementById('mcAlbCabecera').dataset.tapa, huecos: [...document.querySelectorAll('#mcAlbArchivador [data-hueco]')].map((b) => b.dataset.hueco), cols: getComputedStyle(document.querySelector('#mcAlbArchivador .mc-hoja')).gridTemplateColumns.split(' ').length }))
  check('la cabecera del binder lleva su tapa, sin logo', /mc-alb-cabecera-binder/.test(vista.cab) && vista.tapa === 'verde' && (await page.locator('#mcAlbCabeceraLogo img').count()) === 0, JSON.stringify(vista))
  check('los bolsillos vacíos —el del medio y los del final— se tocan', vista.huecos.join() === '1,3,4,5,6,7' && vista.cols === 2, JSON.stringify(vista))
  const medida = await page.$eval('#mcAlbArchivador [data-hueco="1"]', (b) => Math.round(Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)))
  check('  …y miden 44 o más', medida >= 44, String(medida))
  await page.click('#mcAlbArchivador [data-hueco="1"]')
  await page.waitForTimeout(300)
  // Desde la 765 es LA hoja «Añadir carta» de la pantalla, con su título.
  check('tocar el bolsillo 2 abre la hoja de elegir', (await page.locator('#mcPanelBuscar').isVisible()) && /Bolsillo 2/.test(await page.textContent('#mcHojaTitulo')))
  await page.fill('#mcBuscarTodo', 'chispa 9')
  await page.waitForTimeout(900)
  if (CAPS) await page.screenshot({ path: `${CAPS}/760-elegir.png` })
  await page.locator('#mcBuscarResultados [data-carta="sv8-9"]').click()
  await page.waitForTimeout(900)
  check('la carta va A ESE bolsillo, y se guarda', (await guardado(page, 'alb-bin')) === 'sv8-2,sv8-9,sv8-5', await guardado(page, 'alb-bin'))
  check('  …y la hoja se cierra', !(await page.locator('#mcPanelBuscar').isVisible()))
  await page.click('#mcAlbArchivador [data-hueco="6"]')
  await page.waitForTimeout(300)
  await page.fill('#mcBuscarTodo', 'chispa 7')
  await page.waitForTimeout(900)
  await page.locator('#mcBuscarResultados [data-carta="sv8-7"]').click()
  await page.waitForTimeout(900)
  check('en el bolsillo 7, con huecos en medio', (await guardado(page, 'alb-bin')) === 'sv8-2,sv8-9,sv8-5,·,·,·,sv8-7', await guardado(page, 'alb-bin'))
  check('  …y salta a su página', /^Página 1-2 de 10/.test(await paginas(page)), await paginas(page))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Mantener pulsado con el dedo y soltar en un hueco ──')
{
  const { ctx, page, errores } = await abrir('alb-bin', { movil: true })
  await page.$eval('#mcAlbArchivador', (e) => e.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(300)
  const centro = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })
  const de = await centro('#mcAlbArchivador .mc-bolsillo[data-indice="0"]')
  const a = await centro('#mcAlbArchivador [data-hueco="3"]')
  const dedo = (tipo, p) => page.evaluate(([tipo, p]) => {
    const el = document.elementFromPoint(p.x, p.y)
    el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0 }))
  }, [tipo, p])
  // Un toque corto que se mueve es desplazar: no coge nada.
  await dedo('pointerdown', de)
  await dedo('pointermove', { x: de.x, y: de.y + 30 })
  await page.waitForTimeout(600)
  check('mover el dedo enseguida no coge la carta (es desplazar)', (await page.locator('.mc-arrastre').count()) === 0)
  await dedo('pointercancel', de)
  // Quieto medio segundo: la coge.
  await dedo('pointerdown', de)
  await page.waitForTimeout(650)
  check('quieto medio segundo, la coge', (await page.locator('.mc-arrastre').count()) === 1)
  await dedo('pointermove', { x: a.x, y: a.y })
  await page.waitForTimeout(100)
  await dedo('pointerup', a)
  await page.waitForTimeout(900)
  check('  …y soltada en el bolsillo 4 se queda en el 4', (await guardado(page, 'alb-bin')) === '·,·,sv8-5,sv8-2', await guardado(page, 'alb-bin'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

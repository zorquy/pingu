// Tanda 964, en pantalla: dos arreglos del foro que pidió PINGU.
//   1. Citar a VARIOS: «el botón de citar creo que solo cita a una persona».
//      Un mensaje que solo era una imagen pasaba a ser la cita principal (la
//      primera se perdía); el aviso solo nombraba a la primera; y en el móvil
//      «Citar» enfocaba la caja, el teclado tapaba el hilo y no se podía tocar
//      el siguiente.
//   2. Adjuntar imágenes desde el móvil: «no te lo abre». La barra se veía
//      solo con `:focus-within`; en el iPhone tocar un botón le quita el foco
//      al cuadro y la barra se escondía bajo el dedo. Aquí se imita Safari:
//      al tocar un botón, el foco se va (Chrome se lo daría al botón).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const MUNDO = {
  __FAKE_SESSION__: 'user-1',
  __FAKE_SECCIONES__: [{ id: 'sec-1', name: 'General', slug: 'general' }],
  __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Dudas', slug: 'dudas' }],
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Hilo de prueba', author_id: 'user-2', post_count: 3 }],
  __FAKE_MENSAJES__: [
    { id: 'post-1', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>Primer mensaje.</p>', created_at: '2026-10-20T10:00:00Z' },
    { id: 'post-2', thread_id: 'tema-1', author_id: 'user-3', body_html: '<p>Segundo mensaje.</p>', created_at: '2026-10-20T11:00:00Z' },
    { id: 'post-3', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p><img src="https://fotos.test/a.png" width="10" height="10"></p>', created_at: '2026-10-20T12:00:00Z' },
  ],
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const browser = await chromium.launch()
async function abrir({ movil, safari = false }) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1100, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
  if (safari) {
    await ctx.addInitScript(() => {
      // Safari de iOS: tocar un botón no lo enfoca; el foco se va del cuadro.
      // En el mismo instante del toque, como Safari: la barra que solo se ve
      // con el foco dentro se esconde antes de que llegue el clic.
      for (const tipo of ['touchstart', 'pointerdown', 'mousedown']) {
        document.addEventListener(tipo, (e) => {
          if (e.target.closest?.('button')) document.activeElement?.blur?.()
        }, true)
      }
      document.addEventListener('focusin', (e) => { if (e.target.tagName === 'BUTTON') e.target.blur() }, true)
    })
  }
  await ctx.route(/fotos\.test/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { ctx, page, errores }
}
const citar = async (page, id, movil) => {
  const b = page.locator(`[data-citar="${id}"]`)
  await b.scrollIntoViewIfNeeded()
  if (movil) await b.tap(); else await b.click()
  await page.waitForTimeout(350)
}
const estado = (page) => page.evaluate(() => ({
  aviso: document.getElementById('respondiendoA')?.innerText.replace(/\s+/g, ' ').trim(),
  avisoVisible: !document.getElementById('respondiendoA')?.classList.contains('hidden'),
  citas: [...document.querySelectorAll('#respuestaCuerpo blockquote')].map((q) => q.textContent),
  foco: document.activeElement?.id || document.activeElement?.tagName,
}))

for (const movil of process.env.SOLO_IMAGEN ? [] : [false, true]) {
  console.log(`── Citar a varios (${movil ? 'móvil' : 'ordenador'}) ──`)
  const { ctx, page, errores } = await abrir({ movil })
  const nombres = await page.$$eval('[data-mensaje]', (ms) => ms.map((m) => m.querySelector('.foro-autor-nombre')?.textContent.trim()))
  await citar(page, 'post-1', movil)
  const e1 = await estado(page)
  check('la primera cita sale en el aviso', e1.avisoVisible && e1.aviso.includes(nombres[0]), JSON.stringify(e1))
  if (movil) check('  …y en el móvil no se enfoca la caja (el teclado taparía el hilo)', e1.foco !== 'respuestaCuerpo', e1.foco)
  await citar(page, 'post-2', movil)
  await citar(page, 'post-3', movil)
  const e3 = await estado(page)
  // Desde la 1115 la primera también va en la caja («la primera nunca está
  // citada»); al publicar se quita, porque sale enlazada arriba.
  check('las tres entran en la caja, en el orden en que se pulsan', e3.citas.length === 3 && /Primer mensaje/.test(e3.citas[0]) && /Segundo mensaje/.test(e3.citas[1]) && /\[imagen\]/.test(e3.citas[2]), JSON.stringify(e3.citas))
  check('  …la que solo era una imagen no sustituye a la primera', e3.aviso.startsWith(`Citando a ${nombres[0]}`), e3.aviso)
  check('  …y el aviso nombra a todos', e3.aviso.includes(nombres[1]) && (e3.aviso.match(new RegExp(nombres[0], 'g')) || []).length === 2, e3.aviso)
  if (movil) check('  …sin abrir el teclado en ningún momento', e3.foco !== 'respuestaCuerpo', e3.foco)
  await citar(page, 'post-2', movil)
  await citar(page, 'post-1', movil)
  check('citar otra vez una ya citada (también la primera) no la repite', (await estado(page)).citas.length === 3)
  await page.locator('#respuestaCuerpo').click()
  await page.evaluate(() => { const c = document.getElementById('respuestaCuerpo'); c.insertAdjacentHTML('beforeend', '<p>Os contesto a los tres.</p>'); c.dispatchEvent(new Event('input', { bubbles: true })) })
  await page.waitForTimeout(200)
  await page.click('#btnResponder', { noWaitAfter: true })
  await page.waitForTimeout(3500)
  const guardado = await page.evaluate(() => window.__TABLAS__.forum_posts.find((m) => m.author_id === 'user-1'))
  check('al publicar: responde al primero y lleva las otras dos citas', guardado?.reply_to_id === 'post-1' && /Segundo mensaje/.test(guardado?.body_html) && /\[imagen\]/.test(guardado?.body_html), JSON.stringify(guardado).slice(0, 200))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Adjuntar una imagen desde el iPhone ──')
{
  const { ctx, page, errores } = await abrir({ movil: true, safari: true })
  await page.locator('#respuestaCuerpo').tap()
  await page.waitForTimeout(300)
  const boton = page.locator('#respuestaBarra [data-action="image"]')
  check('con el cuadro tocado, la barra está a la vista', await boton.isVisible())
  const elegir = page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null)
  await boton.tap()
  const selector = await elegir
  check('tocar «Imagen» abre el selector de fotos aunque el cuadro pierda el foco', !!selector)
  if (selector) {
    await selector.setFiles({ name: 'carta.png', mimeType: 'image/png', buffer: PNG })
    await page.waitForTimeout(1200)
    check('  …y la foto entra en el mensaje', await page.locator('#respuestaCuerpo img').count() === 1)
  }
  check('la caja sigue abierta mientras se usa', await page.locator('#respuestaForm.abierta').count() === 1)
  await page.locator('.foro-mensaje').first().tap({ position: { x: 20, y: 20 } })
  await page.waitForTimeout(300)
  check('  …y se recoge al tocar fuera', await page.locator('#respuestaForm.abierta').count() === 0 && !(await boton.isVisible()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

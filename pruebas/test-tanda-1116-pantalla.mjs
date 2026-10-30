// Tanda 1116 — las citas del foro, todas como la primera (PINGU, con una
// captura: «la primera funciona porque puedo ir al mensaje clicando arriba…
// pero los otros, mira cómo se muestran»: «Nombre: texto» cortado, sin foto
// ni enlace).
//   · Citar tres: al publicar, las tres salen con «X escribió: ↩», el enlace
//     a su mensaje y su contenido (la foto también).
//   · El texto se recorta por LETRAS, no partiendo el HTML.
//   · Una cita vieja («Nombre: texto») se viste igual si su mensaje está en
//     la página; si no, se queda como estaba.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const largo = 'Soy coleccionista de Magmortars y Magmars, de pequeño en el Pokémon Plata siempre llevé un Magmar. '.repeat(8)
const MUNDO = {
  __FAKE_SESSION__: 'user-1',
  __FAKE_SECCIONES__: [{ id: 'sec-1', name: 'General', slug: 'general' }],
  __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Dudas', slug: 'dudas' }],
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Vuestra carta favorita', author_id: 'user-2', post_count: 4 }],
  __FAKE_MENSAJES__: [
    { id: 'post-1', thread_id: 'tema-1', author_id: 'user-2', body_html: `<p>${largo}</p>`, created_at: '2026-10-20T10:00:00Z' },
    { id: 'post-2', thread_id: 'tema-1', author_id: 'user-3', body_html: `<p><img src="https://fotos.test/magmar.png" width="300" height="400"></p><p>Sin duda esta es mi favorita.</p>`, created_at: '2026-10-20T11:00:00Z' },
    { id: 'post-3', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>Un Scyther primera edición Jungle, castellano y en perfecto estado.</p>', created_at: '2026-10-20T12:00:00Z' },
    // Una respuesta de antes de la 1116, con la cita vieja.
    { id: 'post-4', thread_id: 'tema-1', author_id: 'user-3', body_html: '<blockquote>Misty: Un Scyther primera edición Jungle, castellano y en perfecto estado.</blockquote><p>¡Qué cartón!</p><blockquote>Nadie: esto no es de ningún mensaje</blockquote>', created_at: '2026-10-20T13:00:00Z' },
  ],
}

console.log('── Lo puro ──')
{
  const { JSDOM } = await import('/opt/node22/lib/node_modules/jsdom/lib/api.js').catch(() => ({}))
  if (JSDOM) {
    const dom = new JSDOM('<div id="x"><p><img src="a.png"></p><p>' + 'abcde '.repeat(100) + '</p><p>fuera</p></div>')
    globalThis.document = dom.window.document
    const { recortarNodo } = await import(`${RAIZ}/js/foro-citas.js`)
    const x = recortarNodo(dom.window.document.getElementById('x'), 50)
    check('recortar por letras deja la foto y corta el texto con «…»', x.querySelector('img') && /…$/.test(x.textContent) && x.textContent.length <= 52 && !/fuera/.test(x.textContent), x.innerHTML.slice(0, 120))
  } else console.log('  (sin jsdom: lo puro se mira en el navegador)')
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
await ctx.route(/fotos\.test/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2600)

console.log('── La cita vieja ──')
{
  const viejas = await page.$$eval('[data-texto="post-4"] blockquote', (qs) => qs.map((q) => ({ clase: q.className, enlace: q.querySelector('a.foro-cita-quien')?.getAttribute('href') || null, texto: q.textContent.slice(0, 60) })))
  check('una cita vieja de un mensaje de la página se viste como la primera', viejas[0]?.clase === 'foro-cita' && viejas[0]?.enlace === '#mensaje-post-3', JSON.stringify(viejas))
  check('  …y una que no casa con ningún mensaje se queda como estaba', viejas.some((v) => /Nadie: esto/.test(v.texto) && !v.clase), JSON.stringify(viejas))
}

console.log('── Citar tres y publicar ──')
for (const id of ['post-1', 'post-2', 'post-3']) {
  await page.locator(`[data-citar="${id}"]`).scrollIntoViewIfNeeded()
  await page.click(`[data-citar="${id}"]`)
  await page.waitForTimeout(250)
}
const enLaCaja = await page.$$eval('#respuestaCuerpo blockquote', (qs) => qs.map((q) => ({ enlace: q.querySelector('a')?.getAttribute('href'), foto: !!q.querySelector('img'), letras: q.textContent.length })))
check('en la caja, las tres con el enlace a su mensaje', enLaCaja.length === 3 && enLaCaja.every((c, i) => c.enlace === `#mensaje-post-${i + 1}`), JSON.stringify(enLaCaja))
check('  …la de la foto, con la foto', enLaCaja[1]?.foto === true)
check('  …y la larga recortada por letras (no 800)', enLaCaja[0]?.letras < 460, String(enLaCaja[0]?.letras))
await page.click('#respuestaCuerpo')
await page.keyboard.press('Control+End')
await page.keyboard.type('Qué buenas cartas todas.')
await page.click('#btnResponder')
await page.waitForTimeout(2500)
const guardado = await page.evaluate(() => window.__TABLAS__.forum_posts.find((m) => m.author_id === 'user-1'))
check('se guarda enlazada a la primera, con las otras dos con su enlace', guardado?.reply_to_id === 'post-1' && /href="#mensaje-post-2"/.test(guardado.body_html) && /href="#mensaje-post-3"/.test(guardado.body_html) && !/href="#mensaje-post-1"/.test(guardado.body_html), guardado?.body_html?.slice(0, 300))
check('  …y la foto citada va dentro', /fotos\.test\/magmar\.png/.test(guardado?.body_html || ''))

// Sin recargar: el doble guarda lo publicado solo en esta página.
const mio = await page.$$eval('[data-mensaje]', (arts) => {
  const a = arts.find((x) => /Qué buenas cartas/.test(x.textContent))
  return a ? [...a.querySelectorAll('blockquote.foro-cita')].map((q) => ({ quien: q.querySelector('.foro-cita-quien')?.textContent.trim(), href: q.querySelector('.foro-cita-quien')?.getAttribute('href'), foto: !!q.querySelector('.article-body img') })) : null
})
check('al leerla, las tres citas son iguales: «X escribió: ↩» con su enlace', mio?.length === 3 && mio.every((c, i) => /escribió:\s*↩$/.test(c.quien) && c.href === `#mensaje-post-${i + 1}`), JSON.stringify(mio))
check('  …y la de la foto la enseña', mio?.[1]?.foto === true)
const estilos = await page.$$eval('[data-mensaje] blockquote.foro-cita', (qs) => qs.map((q) => getComputedStyle(q).paddingLeft))
check('  …con el mismo hueco por dentro que la de arriba', new Set(estilos).size === 1, JSON.stringify(estilos))
await page.click('[data-mensaje] .foro-mensaje-texto a.foro-cita-quien[href="#mensaje-post-3"]')
await page.waitForTimeout(800)
check('pinchar la cabecera lleva a su mensaje', /#mensaje-post-3$/.test(page.url()))
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

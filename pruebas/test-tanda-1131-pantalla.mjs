// Tanda 1131 — pegar en el foro no trae la letra de otra parte (PINGU: «se
// pega con una letra y tamaño distintos en el foro»). Lo pegado de otra app o
// página llega con sus estilos sueltos; el editor lo pega YA saneado: sin
// letra, tamaño ni colores de fuera, pero con negritas, listas y enlaces.
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
  __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Colección', slug: 'coleccion' }],
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Cartas que faltan', author_id: 'user-2', post_count: 1 }],
  __FAKE_MENSAJES__: [{ id: 'post-1', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>Hola</p>', created_at: '2026-10-20T10:00:00Z' }],
}
// Como llega del portapapeles al copiar de una app de chat: todo con estilos.
const PEGADO = `<meta charset="utf-8"><div style="font-family: 'Tiempos Text', Georgia, serif; font-size: 19px; color: rgb(31, 30, 29); line-height: 1.7"><p style="margin: 0 0 12px; font-size: 19px">¡Buenas, <strong style="font-weight: 600">Sergio</strong>! Tenías toda la razón.</p><ul style="padding-left: 24px"><li style="font-size: 19px">Idiomas: marca todos.</li><li>Versiones: también varias.</li></ul><p><span style="font-family: Arial; font-size: 24px; background-color: rgb(250, 249, 245)">¡Gracias por avisar!</span> <a href="https://pokedoc.es/foro" style="color: rgb(0, 100, 200)">El foro</a></p></div>`

const browser = await chromium.launch()
for (const movil of [false, true]) {
  console.log(`── ${movil ? 'Móvil' : 'PC'} ──`)
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.click('#respuestaCuerpo')
  await page.evaluate((html) => {
    const dt = new DataTransfer()
    dt.setData('text/html', html)
    dt.setData('text/plain', '¡Buenas, Sergio! Tenías toda la razón.')
    document.getElementById('respuestaCuerpo').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, PEGADO)
  await page.waitForTimeout(300)
  const r = await page.$eval('#respuestaCuerpo', (c) => {
    const base = getComputedStyle(c)
    const textos = [...c.querySelectorAll('p, li, span, strong, a')]
    return {
      html: c.innerHTML,
      estilos: [...c.querySelectorAll('[style]')].map((e) => e.getAttribute('style')),
      letras: [...new Set(textos.map((e) => getComputedStyle(e).fontFamily))],
      tamanos: [...new Set([...c.querySelectorAll('p, li')].map((e) => getComputedStyle(e).fontSize))],
      base: { letra: base.fontFamily, tamano: base.fontSize },
    }
  })
  check('lo pegado no trae estilos sueltos', r.estilos.length === 0, JSON.stringify(r.estilos))
  check('  …se ve con la letra del foro, no con la de fuera', r.letras.length === 1 && r.letras[0] === r.base.letra && !/Tiempos|Georgia|Arial/.test(r.letras[0]), JSON.stringify(r.letras))
  check('  …y con su tamaño', r.tamanos.length === 1 && r.tamanos[0] === r.base.tamano, JSON.stringify(r.tamanos) + ' ' + r.base.tamano)
  check('  …pero conserva la negrita (una), la lista y el enlace, sin párrafos dentro de párrafos', /<strong>Sergio<\/strong>/.test(r.html) && !/<strong><strong>/.test(r.html) && !/<p>\s*<p>/.test(r.html) && /<li>Idiomas: marca todos\.<\/li>/.test(r.html) && /<a [^>]*href="https:\/\/pokedoc\.es\/foro"/.test(r.html), r.html.slice(0, 300))
  check('  …y el cuadro ya no está vacío', !(await page.$eval('#respuestaCuerpo', (c) => c.classList.contains('rte-vacia'))))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

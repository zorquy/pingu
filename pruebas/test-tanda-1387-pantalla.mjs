// Tanda 1387 — imágenes en fila dentro de un spoiler (un usuario, vía PINGU:
// «en los spoilers no se pueden poner imágenes en fila como se puede fuera…
// solo funciona una debajo de otra»). Meterlas en un spoiler ya hecho iba
// bien; lo que fallaba era ENVOLVER con el botón Spoiler lo ya escrito: todo
// iba a UN párrafo (un <p> con párrafos dentro), «Fila de 2» decía «hace falta
// otra imagen justo detrás» y, si solo había imágenes seleccionadas, se
// perdían.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import zlib from 'zlib'
const png = (w, h, [r, g, bl]) => {
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } let x = 0xffffffff; for (const b of buf) x = t[(x ^ b) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0 }
  const chunk = (tipo, datos) => { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const td = Buffer.concat([Buffer.from(tipo), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const fila = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, bl]).flat())])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(fila)))), chunk('IEND', Buffer.alloc(0))])
}

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
  __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Hilo', author_id: 'user-2', post_count: 1 }],
  __FAKE_MENSAJES__: [{ id: 'post-1', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>Hola</p>', created_at: '2026-10-20T10:00:00Z' }],
}
const browser = await chromium.launch()
async function abrir(movil, [w, h]) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, MUNDO)
  await ctx.route(/ejemplo\.supabase\.co\/storage/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png(w, h, [200, 40, 40]) }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#respuestaCuerpo', { timeout: 15000 })
  await page.waitForTimeout(1200)
  await page.locator('#respuestaCuerpo').click()
  return { ctx, page, errores }
}
async function subirDos(page, [w, h]) {
  const input = page.locator('.rte-image-input').first()
  for (const c of [[200, 40, 40], [40, 40, 200]]) {
    await input.setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: png(w, h, c) })
    await page.waitForTimeout(1800)
  }
}
const envolverTodo = async (page) => {
  await page.evaluate(() => { const s = document.getElementById('respuestaCuerpo'); const r = document.createRange(); r.selectNodeContents(s); const x = getSelection(); x.removeAllRanges(); x.addRange(r) })
  await page.click('#respuestaBarra .rte-btn-spoiler')
  await page.waitForTimeout(500)
}
const guardado = (page) => page.evaluate(async () => {
  const { sanitizeRichText } = await import('/js/richtext-format.js')
  const d = document.createElement('div')
  d.innerHTML = sanitizeRichText(document.getElementById('respuestaCuerpo').innerHTML)
  return { imgs: d.querySelectorAll('details img').length, enFila: d.querySelectorAll('details .rt-fila > figure').length, pEnP: d.querySelectorAll('p p').length, vacios: [...d.querySelectorAll('details > p')].filter((p) => !p.textContent.trim() && !p.querySelector('img, br')).length }
})
const enElEditor = (page) => page.evaluate(() => ({ pEnP: document.querySelectorAll('#respuestaCuerpo p p').length, enFila: document.querySelectorAll('#respuestaCuerpo details .rt-fila > figure').length }))

for (const movil of [false, true]) {
  const quien = movil ? 'móvil' : 'PC'
  console.log(`── ${quien}: fotos y texto, envolver y «Fila de 2» ──`)
  {
    const { ctx, page, errores } = await abrir(movil, [400, 300])
    await subirDos(page, [400, 300])
    await page.keyboard.press('Enter')
    await page.keyboard.type('Mis cartas favoritas')
    await envolverTodo(page)
    check(`${quien}: al envolver, ningún párrafo dentro de otro`, (await enElEditor(page)).pEnP === 0)
    const img = page.locator('#respuestaCuerpo details img').first()
    if (movil) await img.tap(); else await img.click()
    await page.waitForTimeout(400)
    await page.locator('button[data-bloque="fila-2"]:visible').first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(500)
    const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join('|'))
    check(`${quien}: «Fila de 2» dentro del spoiler las pone en fila`, (await enElEditor(page)).enFila === 2 && !/hace falta/.test(toast), toast)
    const g = await guardado(page)
    check(`${quien}:   …y se guarda en fila, con el texto aparte`, g.enFila === 2 && g.pEnP === 0, JSON.stringify(g))
    check(`${quien}: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}

console.log('── Envolver solo imágenes ──')
for (const [nombre, medida] of [['cartas', [245, 342]], ['fotos', [400, 300]]]) {
  const { ctx, page, errores } = await abrir(false, medida)
  await subirDos(page, medida)
  await envolverTodo(page)
  const g = await guardado(page)
  check(`dos ${nombre} solas, envueltas: siguen las dos dentro del spoiler`, g.imgs === 2, JSON.stringify(g))
  if (nombre === 'cartas') check('  …y las cartas, en su fila', g.enFila === 2, JSON.stringify(g))
  check('  …sin párrafos vacíos', g.vacios === 0, JSON.stringify(g))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Lo de siempre sigue igual ──')
{
  const { ctx, page, errores } = await abrir(false, [245, 342])
  await page.keyboard.type('hola mundo')
  await page.keyboard.press('Shift+Home')
  await page.click('#respuestaBarra .rte-btn-spoiler')
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => { const d = document.querySelector('#respuestaCuerpo details'); return d && [...d.children].slice(1).map((c) => c.tagName + ':' + c.textContent).join(',') })
  check('envolver una frase la deja en un párrafo dentro', r === 'P:hola mundo', r)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

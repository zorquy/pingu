// Tanda 1268 — en pantalla: ninguna página de los retos lleva la respuesta.
//
// PINGU: «haciendo un F12… el de ordena por precio te puede salir el precio
// de las cartas en algún sitio». Se abre cada reto SIN jugar y se mira todo
// lo que tiene a mano un listillo: el HTML entero (atributos incluidos), lo
// que ha llegado por la red y las fotos que se han pedido. Ni nombres de la
// buena, ni precios, ni la foto nítida, ni el número del Pokémon. Y Parejas:
// boca abajo no hay ni una cara en la página.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { instalarRetos } from './retos-falsos.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hoy = new Date().toISOString().slice(0, 10)
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c33"/></svg>'
const carta = (id, n, name, extra = {}) => ({ id, market: 'WEST', set_id: 'sv8', local_id: String(n), name, name_es: name, image_path: `sv/sv8/${n}`, category: 'Pokemon', rarity: 'Rare', types: ['Fire'], tcg_sets: { name: 'Surging Sparks', tcg_online_code: 'SSP', serie_id: 'sv', release_date: '2024-11-08' }, ...extra })
const PRECIOS = [13.37, 42.42, 7.77, 99.99, 21.21, 3.33]
const SEIS = PRECIOS.map((p, i) => carta(`sv8-${i + 1}`, i + 1, `Carta ${i + 1}`, { precio: p }))
const set = (id, name) => ({ id, market: 'WEST', name, serie_id: 'sv', release_date: '2024-01-01' })
const OPC = [set('s1', 'Uno'), set('s2', 'Dos'), set('s3', 'Tres'), set('s4', 'Cuatro')]
const RETOS = {
  carta: { dia: hoy, numero: 1, carta: carta('sv8-99', 99, 'Zekromius'), ayer: null },
  caro: { dia: hoy, numero: 1, cartas: SEIS },
  ordena: { dia: hoy, numero: 1, cartas: SEIS.slice(0, 4) },
  expansion: { dia: hoy, numero: 1, rondas: [0, 1, 2, 3, 4].map((i) => ({ carta: carta(`x${i}`, 50 + i, `Ronda ${i}`, { set_id: 'secretset', image_path: `sv/secretset/${i}` }), set_id: 's3', opciones: OPC })) },
  silueta: { dia: hoy, numero: 1, buena: 445, opciones: [1, 445, 7, 133] },
  parejas: { dia: hoy, numero: 1, cartas: SEIS.slice(0, 6), mesa: [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0] },
}
const PAGINAS = [['carta-del-dia', 'carta', ['Zekromius', 'sv8-99', 'sv/sv8/99']], ['mas-caro', 'caro', ['42,42', '42.42', '99,99', '99.99', 'sv8-1', 'sv/sv8/2']], ['ordena-precio', 'ordena', ['13,37', '13.37', '42.42', 'sv8-1', 'sv/sv8/1']], ['que-expansion', 'expansion', ['secretset', '"buena"', 'set_id']], ['quien-es', 'silueta', ['/445.png', 'official-artwork/445', '"buena"']]]

const browser = await chromium.launch()
for (const [pagina, juego, prohibido] of PAGINAS) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' })
  await ctx.route(/assets\.tcgdex\.net|limitlesstcg|pokemontcg|official-artwork|jsdelivr|githubusercontent/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: SVG }))
  await instalarRetos(ctx, { [juego]: RETOS[juego] })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const red = []
  ctx.on('response', async (r) => { red.push(r.url()); if (/functions\//.test(r.url()) && !/reto-foto/.test(r.url())) red.push(await r.text().catch(() => '')) })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/${pagina}.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const html = await page.content()
  const rpc = await page.evaluate(() => JSON.stringify(window.__RPCS__ || []))
  const todo = [html, ...red].join('\n')
  const encontrado = prohibido.filter((x) => todo.includes(x))
  check(`${pagina}: sin jugar, ni el HTML ni la red llevan la respuesta`, encontrado.length === 0, encontrado.join(', '))
  check(`  …y las fotos del juego son de /reto-foto (no dicen de qué son)`, (await page.$$eval('main img, .page-content img', (is) => is.filter((i) => i.src && !/\/(assets|icons|img)\//.test(i.src) && !i.closest('header, nav, footer, .bm')).map((i) => i.src))).every((u) => /reto-foto/.test(u)))
  check('  …se abre con el árbitro', /retos_jugar/.test(rpc))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Parejas: boca abajo no hay caras ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' })
  await ctx.route(/assets\.tcgdex\.net|limitlesstcg|pokemontcg/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: SVG }))
  await instalarRetos(ctx, { parejas: RETOS.parejas })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/parejas.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  check('doce boca abajo y ninguna lleva su cara en la página', (await page.locator('.pa-carta').count()) === 12 && (await page.locator('.pa-carta .pa-cara img').count()) === 0)
  await page.click('[data-hueco="0"]')
  await page.waitForTimeout(400)
  check('  …dar la vuelta a una trae SU cara (la dice la base)', (await page.locator('.pa-carta .pa-cara img').count()) === 1 && (await page.locator('[data-hueco="0"] .pa-cara img').count()) === 1)
  await page.click('[data-hueco="11"]')
  await page.waitForTimeout(400)
  check('  …y su pareja, hecha', (await page.locator('.pa-carta.hecha').count()) === 2)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

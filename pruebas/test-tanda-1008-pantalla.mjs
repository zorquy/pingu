// Tanda 1008 — «Posibles repetidas»: el enlace a Cardmarket de cada carta y
// juntar de una vez las del mismo producto.
//
// PINGU, con las SWSH Black Star Promos: «pon el enlace a Cardmarket… si son
// el mismo producto damos por hecho que es la misma carta, ¿no puedes unir
// todos?». Solo las que tienen además el mismo precio y nada en contra: TCGGO
// da a veces a una versión el id de Cardmarket de la carta (la 806).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const SETS = [{ id: 'swshp', name: 'SWSH Black Star Promos', name_en: 'SWSH Black Star Promos', serie_id: 'swsh', market: 'WEST', release_date: '2019-11-15', card_count_official: 307, card_count_total: 307, tcg_online_code: 'PR-SW' }]
const set = { id: 'swshp', name: 'SWSH Black Star Promos' }
const ts = { serie_id: 'swsh', tcg_online_code: 'PR-SW', release_date: '2019-11-15' }
const c = (id, n, nombre, prod, precio, extra = {}) => ({ id, market: 'WEST', set_id: 'swshp', local_id: n, name: nombre, illustrator: 'Kagemaru Himeno', origen: id.startsWith('tcggo') ? 'tcggo' : null, cm_id_product_propio: prod, precio: precio == null ? null : { cm_id_product: prod, cm_low: precio }, personas: 1, tcg_sets: ts, ...extra })
const g = (n, nombre, cartas) => ({ market: 'WEST', set_id: 'swshp', numero: n, nombre, set, cartas })
const R = { grupos: [
  // El Professor Burnet: mismo producto, mismo precio → se junta.
  g('swsh167', 'professorburnet', [c('swshp-SWSH167', 'SWSH167', 'Professor Burnet', 500167, 0.02), c('tcggo-48308', 'SWSH167', 'Professor Burnet', 500167, 0.02)]),
  // El Professor's Research: otro producto y otro precio → no.
  g('swsh178', 'professorsresearch', [c('swshp-SWSH178', 'SWSH178', "Professor's Research", 500178, 0.5), c('tcggo-48310', 'SWSH178', "Professor's Research", 600178, 2.99)]),
  // El mismo producto con OTRO precio: la versión que TCGGO cuelga del id de la carta → no.
  g('swsh028', 'duraludon', [c('swshp-SWSH028', 'SWSH028', 'Duraludon', 500028, 0.49), c('tcggo-48269', 'SWSH028', 'Duraludon', 500028, 3.1)]),
  // El mismo producto y precio pero otro ilustrador → no.
  g('swsh050', 'eevee', [c('swshp-SWSH050', 'SWSH050', 'Eevee', 500050, 0.3), c('tcggo-48100', 'SWSH050', 'Eevee', 500050, 0.3, { illustrator: 'Otro' })]),
  // Sin producto → no, y sin enlace.
  g('swsh060', 'pikachu', [c('swshp-SWSH060', 'SWSH060', 'Pikachu', null, 0.3), c('tcggo-48200', 'SWSH060', 'Pikachu', null, 0.3)]),
] }

console.log('── 1. Lo puro ──')
const m = await import(`${RAIZ}/admin/js/repetidas-puro.js`)
check('el enlace al producto', m.enlaceDeProducto(R.grupos[0].cartas[0]) === 'https://www.cardmarket.com/es/Pokemon/Products?idProduct=500167' && m.enlaceDeProducto(R.grupos[4].cartas[0]) === null)
const ids = (g, p) => m.mismasSeguras(g, p).map((x) => `${x.carta.id}→${x.destino}`).join()
check('Burnet: se junta con la principal', ids(R.grupos[0]) === 'tcggo-48308→swshp-SWSH167', ids(R.grupos[0]))
check('  …y con la otra de principal, al revés', ids(R.grupos[0], 'tcggo-48308') === 'swshp-SWSH167→tcggo-48308')
check("Professor's Research (otro producto), Duraludon (otro precio), Eevee (otro ilustrador) y Pikachu (sin producto): no", [1, 2, 3, 4].every((i) => !m.mismasSeguras(R.grupos[i]).length))
check('  …ni el Prize Pack (tiene su botón)', !m.mismasSeguras({ ...R.grupos[0], set: { name: 'Play! Pokémon Prize Pack Series Two' } }).length)
check('  …ni un grupo de tres si una no cuadra', !m.mismasSeguras(g('x', 'x', [...R.grupos[0].cartas, c('tcggo-9', 'SWSH167', 'Professor Burnet', 500167, 0.5)])).length)

console.log('── 2. En /admin ──')
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
await ctx.addInitScript((d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: [], __FAKE_ERAS__: [], __FAKE_REPETIDAS__: d.R })
}, { SETS, R })
await ctx.route(/images\.tcggo\.com|assets\.tcgdex\.net|limitlesstcg/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
const rpcs = (n) => p.evaluate((x) => (window.__RPCS__ || []).filter((r) => r.nombre === x), n)
await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(1800)
await p.locator('[data-section="colecciones"]').click()
await p.waitForTimeout(1200)
await p.locator('#repetidasCaja > summary').click()
await p.waitForTimeout(400)
const burnet = p.locator('.rep-grupo', { hasText: 'Professor Burnet' })
const enlaces = await burnet.locator('a.rep-cm').evaluateAll((as) => as.map((a) => `${a.getAttribute('href')}|${a.target}|${a.textContent.trim()}`))
check('cada carta lleva su «Ver en Cardmarket», en otra pestaña', enlaces.length === 2 && enlaces.every((e) => /idProduct=500167\|_blank\|Ver en Cardmarket/.test(e)), enlaces.join(' · '))
check('  …y la que no tiene producto lo dice', (await p.locator('.rep-grupo', { hasText: 'Pikachu' }).locator('.rep-cm-no').count()) === 2)
const boton = p.locator('#repetidasMismas')
check('el botón cuenta solo la del Burnet', (await boton.innerText()) === 'Mismo producto y precio: juntar (1)', await boton.innerText())
await boton.click()
check('  …el primer toque pregunta', (await boton.innerText()) === '¿Juntar 1? Pulsa otra vez' && !(await rpcs('catalogo_repetida_resolver')).length)
await boton.click()
await p.waitForTimeout(1500)
const ll = (await rpcs('catalogo_repetida_resolver')).map((x) => `${x.args.p_carta}→${x.args.p_destino}:${x.args.p_decision}`)
check('  …y el segundo hace «Es la misma carta» con la principal', ll.join() === 'tcggo-48308→swshp-SWSH167:misma', ll.join())
const quedan = await p.locator('.rep-grupo h3').allInnerTexts()
check('  …y las otras cuatro se quedan para ti', quedan.length === 4 && !quedan.some((x) => /Burnet/.test(x)), quedan.join(' | '))
check('  …y ya no se ofrece', await boton.isHidden())
check('sin errores', !errores.length, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

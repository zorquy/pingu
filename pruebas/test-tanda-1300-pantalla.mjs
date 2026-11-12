// Tanda 1300 — «Pegar lista» en /admin → Colecciones → un set → sus cartas: se
// pega la lista, sale la tabla (nueva / completa lo vacío / ya está, y lo que
// no se entiende aparte), el botón dice lo que va a hacer, y al pulsarlo crea
// por `catalogo_corregir` con `p_crear` y completa SOLO lo vacío de las que
// hay. Y la captura: su texto (de leer-lista) cae en la caja de texto.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const SETS = [{ id: 'base1', name: 'Base Set', name_en: 'Base Set', serie_id: 'base', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102 }]
const SET = { id: 'base1', name: 'Base Set', serie_id: 'base', release_date: '1999-01-09', card_count_official: 102 }
const CARTAS = [
  { id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', image_path: 'base/base1/4', rarity: 'Rare Holo', category: 'Pokemon', types: ['Fire'], origen: null, tcg_sets: SET },
  { id: 'base1-58', market: 'WEST', set_id: 'base1', local_id: '58', name: 'Pikachu', image_path: 'base/base1/58', rarity: null, category: 'Pokemon', types: [], origen: null, tcg_sets: SET },
]
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
await ctx.addInitScript((d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_ERAS__: [] })
}, { SETS, CARTAS })
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net|ejemplo\.supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
let pedidoOcr = null
await ctx.route(/\/\.netlify\/functions\/leer-lista/, async (r) => { pedidoOcr = JSON.parse(r.request().postData() || '{}'); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ texto: '3\tBlastoise\tWater\tRare Holo' }) }) })
await ctx.route(/\/\.netlify\/functions\/(?!leer-lista)/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(1800)
await p.locator('[data-section="colecciones"]').click()
await p.waitForTimeout(500)
await p.locator('#coleccionesMercado').selectOption('WEST').catch(() => {})
await p.waitForTimeout(500)
await p.locator('#coleccionesDesplegar').click()
await p.locator('[data-editar="base1"]').click()
await p.waitForTimeout(300)
await p.locator('#colCartas').click()
await p.waitForTimeout(800)
check('el editor de cartas tiene «Pegar lista»', await p.locator('#catPegarLista').isVisible())
await p.locator('#catPegarLista').click()
await p.waitForTimeout(400)
await p.fill('#plTexto', `No.\tName\tType\tRarity
4/102\tCharizard\tFire\tRare Holo
58/102\tPikachu\tLightning\tCommon
1/102\tAlakazam\tPsychic\tRare Holo
esto no es una carta`)
await p.waitForTimeout(300)
const t = await p.evaluate(() => ({
  resumen: document.getElementById('plResumen').textContent,
  estados: [...document.querySelectorAll('#plTabla tbody tr')].map((tr) => `${tr.querySelector('[data-pl="local_id"]').value}:${tr.querySelector('.pl-estado').textContent}`),
  raras: document.getElementById('plRaras').textContent,
  boton: document.getElementById('plCrear').textContent,
}))
check('la tabla: la 4 ya está, la 58 se completa y la 1 es nueva', t.estados.join('|') === '4:Ya está|58:Completa lo vacío|1:Nueva', t.estados.join('|'))
check('  …el resumen lo cuenta', /3 cartas leídas: 1 nueva, 1 que se completa y 1 que ya está/.test(t.resumen), t.resumen)
check('  …la línea que no se entiende, aparte', /1 línea no se entiende/.test(t.raras), t.raras)
check('  …y el botón dice «Crear 1 y completar 1»', t.boton === 'Crear 1 y completar 1', t.boton)
await p.locator('#plCrear').click()
await p.waitForTimeout(1200)
const rpcs = await p.evaluate(() => (window.__RPCS__ || []).filter((r) => r.nombre === 'catalogo_corregir').map((r) => r.args))
const crear = rpcs.find((a) => a.p_crear)
const completar = rpcs.find((a) => a.p_id === 'base1-58')
check('crea la 1 por catalogo_corregir con p_crear', crear?.p_id === 'mano-base1-1' && crear.p_cambios.name === 'Alakazam' && crear.p_cambios.rarity === 'Rare Holo' && crear.p_cambios.types?.join() === 'Psychic' && crear.p_cambios.set_id === 'base1', JSON.stringify(crear))
check('completa la 58 SOLO en lo vacío (rareza y tipo), sin tocar el nombre', completar && JSON.stringify(completar.p_cambios) === JSON.stringify({ rarity: 'Common', types: ['Lightning'] }), JSON.stringify(completar))
check('la 4 no se toca', !rpcs.some((a) => a.p_id === 'base1-4'))
check('vuelve a la lista con la nueva dentro', await p.locator('[data-editar-carta="mano-base1-1"]').count() === 1)

console.log('── La captura ──')
await p.locator('#catPegarLista').click()
await p.waitForTimeout(300)
await p.locator('[data-pl-modo="captura"]').click()
await p.setInputFiles('#plFichero', { name: 'lista.png', mimeType: 'image/png', buffer: PNG })
await p.waitForTimeout(1200)
check('manda la captura a leer-lista, en JPEG', /^data:image\/jpeg;base64,/.test(pedidoOcr?.imagen || ''), String(pedidoOcr?.imagen).slice(0, 40))
check('  …y su texto cae en la caja, y en la tabla', (await p.inputValue('#plTexto')).includes('Blastoise') && (await p.evaluate(() => document.querySelector('#plTabla tbody tr [data-pl="name"]')?.value)) === 'Blastoise')
check('sin errores', !errores.length, errores.join(' | '))
await p.screenshot({ path: '/tmp/1300.png', fullPage: true })
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

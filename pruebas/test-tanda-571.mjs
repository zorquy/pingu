// Tanda 571 — «Mi colección en una imagen».
//
// PINGU quería cosas que se compartan, y esta es la que SOLO podemos hacer
// nosotros: las cuatro cifras de tu colección, las tres que más valen con
// su foto, la expansión más completa y desde cuándo coleccionas, en una
// imagen de 1080 × 1350 con pokedoc.es. Lo que se mira: que sale del
// Panel, que se pinta con los números de VERDAD de la colección, que el
// canvas se exporta y que compartir recibe el fichero.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'

const SETS = [{ id: 'sv8', name: 'Surging Sparks', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, logo_path: 'x/l', release_date: '2024-11-08', tcg_online_code: 'SSP' }]
const CARTAS = [1, 2, 3, 4].map((n) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `sv/sv8/${n}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
const COL = [
  { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 50, created_at: '2026-08-10T10:00:00Z' },
  { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 20, created_at: '2026-09-01T10:00:00Z' },
  { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 5, created_at: '2026-09-02T10:00:00Z' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: CARTA }))
await page.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => r.abort())
await page.route('**/images.pokemontcg.io/**', (r) => r.abort())
await page.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
await page.addInitScript(([sets, cartas, col]) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = sets
  window.__FAKE_CARTAS__ = cartas
  window.__FAKE_COLECCION__ = col
  navigator.canShare = () => true
  navigator.share = async (d) => { window.__compartido = { texto: d.text, ficheros: (d.files || []).map((f) => ({ nombre: f.name, tipo: f.type, bytes: f.size })) }; return true }
}, [SETS, CARTAS, COL])
await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3200)

console.log('── 1. La tarjeta del Panel ──')
{
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el Panel tiene la tarjeta', (await page.locator('.mc-vistazo-imagen').count()) === 1)
  await page.locator('#mcImagenCrear').click()
  await page.waitForTimeout(2500)
  check('se abre el diálogo con la imagen', await page.evaluate(() => document.getElementById('mcImagenDialogo').open))
}

console.log('── 2. Con los números de verdad ──')
{
  // Se lee lo que se le dio al dibujo, no el píxel: la página lo deja a
  // mano para esto (y para depurar).
  const datos = await page.evaluate(() => window.__mcImagenDatos || null)
  check('4 cartas (copias), 3 distintas, 1 colección', datos?.copias === 4 && datos?.distintas === 3 && datos?.sets === 1, JSON.stringify(datos))
  // 50 × 2 copias + 20 + 5: el valor manual es POR COPIA, como en la cabecera.
  check('  …con el valor de la cabecera', /125,00/.test(datos?.valor || ''), datos?.valor)
  check('  …las tres que más valen, de más a menos', (datos?.valiosas || []).map((v) => v.nombre).join(',') === 'Carta 1,Carta 2,Carta 3', JSON.stringify(datos?.valiosas))
  check('  …la expansión más completa: 3 de 4', datos?.mejorSet?.nombre === 'Surging Sparks' && datos?.mejorSet?.tengo === 3 && datos?.mejorSet?.total === 4, JSON.stringify(datos?.mejorSet))
  check('  …y desde cuándo', /agosto de 2026/.test(datos?.desde || ''), datos?.desde)
  check('  …y de quién', datos?.quien === 'Admin' || typeof datos?.quien === 'string', String(datos?.quien))
}

console.log('── 3. Se exporta y se comparte ──')
{
  const exporta = await page.evaluate(() => {
    try {
      const c = document.getElementById('mcImagenLienzo')
      return c.width === 1080 && c.height === 1350 && c.toDataURL('image/png').length > 1000
    } catch (e) {
      return String(e)
    }
  })
  check('el canvas mide 1080 × 1350 y se exporta', exporta === true, String(exporta))
  await page.locator('#mcImagenCompartir').click()
  await page.waitForTimeout(800)
  const c = await page.evaluate(() => window.__compartido)
  check('compartir recibe un PNG', c?.ficheros?.[0]?.tipo === 'image/png' && c.ficheros[0].bytes > 1000, JSON.stringify(c))
  check('  …con un texto que lleva el enlace', /pokedoc\.es\/mi-coleccion/.test(c?.texto || ''), c?.texto)
}

console.log('── 4. El código ──')
{
  const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
  check('/nueve usa la máquina compartida', /from '\.\/imagen-compartir\.js'/.test(leer('js/nueve.js')))
  check('  …y no conserva su copia', !/function cargarImagen|function redondeado|function comoBlob/.test(leer('js/nueve.js')))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

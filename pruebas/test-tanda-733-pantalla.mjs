// Tanda 733 — una imagen para compartir una carta (X7 de la lista de
// propuestas, elegida por PINGU): su foto, el precio y «La tengo».
//
// Lo que se mira: lo que dice la imagen (nombre, set y número, «Desde» con
// el precio de siempre, «La tengo» solo si es tuya y con cuántas); que la
// loseta «Compartir» esté en la ficha con y sin cuenta; que al pulsarla
// salga un PNG vertical de 1080 × 1350 con ese nombre de fichero; y que sin
// cuenta no reviente (ni diga «La tengo» de nadie).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Lo que dice ──')
{
  const { textosDeLaImagen } = await import(`${RAIZ}/js/carta-imagen.js`)
  const carta = { id: 'base1-4', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', tcg_sets: { name: 'Set Básico' } }
  const t = textosDeLaImagen({ carta, valor: 240.5, tengo: 2 })
  check('nombre, set y número', t.nombre === 'Charizard' && t.detalle === 'Set Básico · 4', JSON.stringify(t))
  check('el precio con «Desde»', /^Desde 240,50\s?€$/.test(t.precio), t.precio)
  check('«La tengo» con cuántas', t.tengo === 'La tengo · 2 copias')
  check('sin copias (o sin cuenta), no dice que la tienes', textosDeLaImagen({ carta, tengo: 0 }).tengo === null && textosDeLaImagen({ carta, tengo: null }).tengo === null)
  check('sin precio, no se inventa uno', textosDeLaImagen({ carta }).precio === null)
  check('el fichero lleva el nombre de la carta', t.fichero === 'pokedoc-charizard-base1-4.png', t.fichero)
}

const browser = await chromium.launch()
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion ? 'user-1' : 'none'
  window.__FAKE_SETS__ = [{ id: 'base1', name: 'Set Básico', serie_id: 'base', market: 'WEST' }]
  window.__FAKE_CARTAS__ = [{ id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: 'base/base1/4', tcg_sets: { id: 'base1', name: 'Set Básico', serie_id: 'base' } }]
  window.__FAKE_PRECIOS__ = [{ card_id: 'base1-4', cm_low: 240.5, checked_at: new Date().toISOString() }]
  window.__FAKE_COLECCION__ = sesion ? [{ id: 'l1', user_id: 'user-1', card_id: 'base1-4', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }] : []
  // El menú del sistema, de mentira: se apunta qué se compartiría.
  navigator.canShare = () => true
  navigator.share = async (d) => { window.__COMPARTIDO__ = { n: d.files?.length, nombre: d.files?.[0]?.name, tipo: d.files?.[0]?.type, texto: d.text } ; const b = await createImageBitmap(d.files[0]); window.__COMPARTIDO__.w = b.width; window.__COMPARTIDO__.h = b.height }
}
for (const sesion of [true, false]) {
  console.log(`── ${sesion ? '2. Con cuenta' : '3. Sin cuenta'} ──`)
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  await ctx.addInitScript(semilla, { sesion })
  await ctx.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#e8564a"/></svg>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/carta.html?id=base1-4`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  check('la ficha lleva la loseta «Compartir»', (await page.locator('#cmCompartir').count()) === 1)
  await page.click('#cmCompartir')
  await page.waitForTimeout(2500)
  const c = await page.evaluate(() => window.__COMPARTIDO__ || null)
  check('al pulsarla se comparte UNA imagen PNG, vertical, de 1080 × 1350', c?.n === 1 && c.tipo === 'image/png' && c.w === 1080 && c.h === 1350 && c.nombre === 'pokedoc-charizard-base1-4.png', JSON.stringify(c))
  check('  …con el texto de la carta y su precio', /Charizard — Desde 240,50/.test(c?.texto || ''), c?.texto)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

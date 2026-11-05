// Tanda 1240 — una tienda con una carta en PSA 9 y otra en PSA 10 (un amigo de
// PINGU, en su tienda: «si tengo una PSA 9 me deja añadir otra, pero se pone
// automático en PSA 9; no me deja tener una PSA 9 y una PSA 10»). Se mira:
//   · en su Colección, el «+» de una gradeada abre la hoja de añadir con su casa
//     y su nota puestas, y con otra nota entra como línea APARTE; el «+» de una
//     sin gradear sigue sumando una igual, sin preguntar;
//   · en el Stock, editar una línea ofrece «Añádela aparte»: la misma carta con
//     su casa puesta, una unidad y sin precios, que se INSERTA sin tocar la otra;
//     y avisa de que lo que cambies al editar cambia todas sus unidades.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const OUT = process.env.PD_CAPS || ''
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const b = await chromium.launch()
const rutas = async (ctx) => {
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
}

console.log('── La Colección de la tienda: el «+» de una gradeada ──')
{
  const N = 4
  const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, tcg_online_code: 'SSP', tcggo_id: 300 }]
  const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Pikachu ${i + 1}`, name_es: `Pikachu ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
  const linea = (id, card, gradeo, estado, unidades) => ({ id, tienda_id: 'user-2', card_id: card, market: 'WEST', idioma: 'es', estado, variante: 'normal', gradeo, unidades, coste: 50, precio: 90, visible: true, created_at: hace(2), updated_at: hace(2) })
  const STOCK = [linea('st-psa9', 'sv8-2', 'PSA 9', 'NM', 1), linea('st-nm', 'sv8-3', null, 'NM', 1)]
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Cartas de Ane', username: 'cartas-ane' }
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_FILAS__ = { tienda_stock: d.STOCK }
    if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('pd-tienda', JSON.stringify({ u: 'cartas-ane', id: 'user-2' })) }
  }, { SETS, CARTAS, STOCK })
  await rutas(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/cartas?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  await p.click('#mcAlbum [data-carta="sv8-2"]'); await p.waitForTimeout(1200)
  const ficha = await p.evaluate(() => ({ linea: document.getElementById('mcEditor')?.dataset.linea, mas: document.getElementById('mcEdMas')?.getAttribute('aria-label') }))
  check('la ficha abre la PSA 9 y su «+» dice que elige nota', ficha.linea === 'st-psa9' && /elige su nota/.test(ficha.mas || ''), JSON.stringify(ficha))
  await p.click('#mcEdMas'); await p.waitForTimeout(900)
  const hoja = await p.evaluate(() => ({
    abierta: document.getElementById('mcAnadirDialogo')?.open,
    casa: document.querySelector('#mcAdGradeoCaja .ge-casa[aria-pressed="true"]')?.dataset.geCasa,
    nota: document.querySelector('#mcAdGradeoCaja [data-ge-nota]')?.value,
    estadoVisto: !!document.getElementById('mcAdEstado')?.closest('.mc-ad-campo')?.getClientRects().length,
  }))
  check('el «+» abre la hoja con «PSA» y la nota 9 puestas, sin estado', hoja.abierta && hoja.casa === 'PSA' && hoja.nota === '9' && !hoja.estadoVisto, JSON.stringify(hoja))
  check('  …y no ha sumado una PSA 9 por su cuenta', await p.evaluate(() => window.__TABLAS__.tienda_stock.find((f) => f.id === 'st-psa9')?.unidades === 1))
  await p.selectOption('#mcAdGradeoCaja [data-ge-nota]', '10')
  if (OUT) await (await p.$('#mcAnadirDialogo'))?.screenshot({ path: `${OUT}/1240-anadir.png` })
  await p.click('#mcAdGuardar'); await p.waitForTimeout(1500)
  const st = await p.evaluate(() => window.__TABLAS__.tienda_stock.filter((f) => f.card_id === 'sv8-2').map((f) => `${f.gradeo}|${f.unidades}|${f.estado}`).sort())
  check('con la nota 10 entra APARTE: una PSA 9 y una PSA 10', JSON.stringify(st) === '["PSA 10|1|NM","PSA 9|1|NM"]', JSON.stringify(st))
  // Una sin gradear: el «+» sigue sumando una igual.
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  await p.click('#mcAlbum [data-carta="sv8-3"]'); await p.waitForTimeout(1200)
  await p.click('#mcEdMas'); await p.waitForTimeout(1200)
  const nm = await p.evaluate(() => ({ hoja: document.getElementById('mcAnadirDialogo')?.open, uds: window.__TABLAS__.tienda_stock.find((f) => f.id === 'st-nm')?.unidades }))
  check('una sin gradear: el «+» suma otra igual, sin hoja', !nm.hoja && nm.uds === 2, JSON.stringify(nm))
  check('sin errores', errs.length === 0, errs.join(' | '))
  await ctx.close()
}

console.log('── El Stock: «Añádela aparte» ──')
{
  const FILAS = [
    { id: 'st-0', card_id: 'carta-0', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '0', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: 'PSA 9', unidades: 1, coste: 50, precio: 95, cm: 90, visible: true, entro_el: hace(3), destacada: false },
    { id: 'st-3', card_id: 'carta-3', market: 'WEST', nombre: 'Eevee', set_id: 'set-0', numero: '3', idioma: 'es', estado: 'EX', variante: 'normal', gradeo: null, unidades: 4, coste: 1, precio: 2, cm: 2, visible: true, entro_el: hace(3), destacada: false },
  ]
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, serviceWorkers: 'block', locale: 'es-ES' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}')
    localStorage.setItem('pd-tienda-stock-vista', 'tabla')
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', precio_visible: true }], tienda_stock: d.FILAS.map((f) => ({ ...f, tienda_id: 'user-2' })) }
    window.__FAKE_CARTAS__ = d.FILAS.map((f) => ({ id: f.card_id, set_id: 'set-0', market: 'WEST', local_id: f.numero, name: f.nombre }))
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: { total: 2, en_stock: 2, destacadas: 0, sumas: { unidades: 5, coste: 54, precio: 103, cm: 98 }, facetas: {}, filas: d.FILAS },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
    }
  }, { FILAS })
  await rutas(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/tienda.html?ver=stock`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  await p.click('[data-fila="st-3"] .tds-c-uds'); await p.waitForTimeout(1200)
  const sin = await p.evaluate(() => document.querySelector('.tds-form .tds-otra-copia')?.textContent.replace(/\s+/g, ' ').trim())
  check('una sin gradear de 4: «¿otra en otro estado o idioma?» y que el cambio afecta a las 4', /otro estado o idioma/.test(sin || '') && /cambia las 4/.test(sin || ''), sin)
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  await p.click('[data-fila="st-0"] .tds-c-uds'); await p.waitForTimeout(1200)
  const con = await p.evaluate(() => document.querySelector('.tds-form .tds-otra-copia')?.textContent.replace(/\s+/g, ' ').trim())
  check('la PSA 9: «¿Tienes otra con otra nota? Añádela aparte»', /otra con otra nota/.test(con || '') && /Añádela aparte/.test(con || ''), con)
  await p.click('.tds-form [data-otra-copia]'); await p.waitForTimeout(1200)
  const f = await p.evaluate(() => ({
    titulo: document.querySelector('dialog[open] .tds-dialogo-cab h2')?.textContent,
    casa: document.querySelector('.tds-form .ge-casa[aria-pressed="true"]')?.dataset.geCasa,
    nota: document.querySelector('.tds-form [data-ge-nota]')?.value,
    uds: document.querySelector('.tds-form [name="unidades"]')?.value,
    coste: document.querySelector('.tds-form [name="coste"]')?.value,
    precio: document.querySelector('.tds-form [name="precio"]')?.value,
    botones: [...document.querySelectorAll('.tds-form .tds-form-pie button')].map((x) => x.textContent.trim()),
  }))
  check('«Añadir otra» con PSA 9 puesta, 1 unidad y sin precios', f.titulo === 'Añadir otra' && f.casa === 'PSA' && f.nota === '9' && f.uds === '1' && f.coste === '' && f.precio === '', JSON.stringify(f))
  check('  …con Cancelar y Añadir (sin «← Otra» ni «Añadir y seguir», que aquí no tienen lista)', JSON.stringify(f.botones) === '["Cancelar","Añadir"]', JSON.stringify(f.botones))
  await p.selectOption('.tds-form [data-ge-nota]', '10')
  await p.fill('.tds-form [name="precio"]', '140')
  if (OUT) await (await p.$('dialog[open]'))?.screenshot({ path: `${OUT}/1240-stock.png` })
  await p.click('.tds-form button[type="submit"].btn-primary'); await p.waitForTimeout(1500)
  const filas = await p.evaluate(() => window.__TABLAS__.tienda_stock.filter((x) => x.card_id === 'carta-0').map((x) => `${x.id === 'st-0' ? 'vieja' : 'nueva'}|${x.gradeo}|${x.unidades}|${x.precio}`).sort())
  check('se INSERTA la PSA 10 y la PSA 9 sigue como estaba', JSON.stringify(filas) === '["nueva|PSA 10|1|140","vieja|PSA 9|1|95"]', JSON.stringify(filas))
  check('sin errores', errs.length === 0, errs.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

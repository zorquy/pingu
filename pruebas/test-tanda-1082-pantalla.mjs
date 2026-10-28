// Tanda 1082 — las ofertas de una tienda: lo puro (`ofertaDe`, el precio que
// cuenta, la rebaja) y la pantalla: en el Stock, el precio rebajado con el de
// siempre tachado (y «Oferta acabada» si ya pasó); la oferta en bloque, con
// un tanto por ciento sobre el precio de CADA una o un precio para todas, y
// quitarla; la ficha de una línea con su oferta; Vender cobra la oferta; y
// «En tiendas» de una carta tacha el de antes.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Desde la 1086, «Seleccionar» está en «⋯» y la barra de abajo lo apaga con «Hecho».
const seleccionar = async (p) => ((await p.isVisible('.tds-sel')) ? p.click('.tds-sel-fin') : (await p.click('[data-tds-menu="mas"]'), p.click('.tds-menu [data-tds="seleccionar"]')))

console.log('── Lo puro ──')
{
  const P = await import(`${REPO}/js/tiendas-puro.js`)
  const ahora = Date.parse('2026-10-28T12:00:00Z')
  check('sin oferta, null; y el precio que cuenta es el suyo', P.ofertaDe({ precio: 10 }, ahora) === null && P.precioQueCuenta({ precio: 10 }, ahora) === 10)
  const o = P.ofertaDe({ precio: 20, oferta_precio: 15, oferta_hasta: '2026-11-02T22:59:59Z' }, ahora)
  check('con oferta: 15, 20 de antes, −25 % y su fecha', o.precio === 15 && o.antes === 20 && o.pct === 25 && o.hasta === '2026-11-02T22:59:59Z' && P.precioQueCuenta({ precio: 20, oferta_precio: '15' }, ahora) === 15)
  check('acabada: como si no hubiera', P.ofertaDe({ precio: 20, oferta_precio: 15, oferta_hasta: '2026-10-28T11:59:59Z' }, ahora) === null && P.precioQueCuenta({ precio: 20, oferta_precio: 15, oferta_hasta: '2026-10-28T11:59:59Z' }, ahora) === 20)
  check('una «oferta» por encima del precio no dice que baja', P.ofertaDe({ precio: 10, oferta_precio: 12 }, ahora).pct === null)
  check('una oferta a 0 € es una oferta (el cero es un valor, la 508)', P.ofertaDe({ precio: 10, oferta_precio: 0 }, ahora)?.precio === 0)
  check('sin precio, la oferta sin «antes»; y sin nada, null', P.ofertaDe({ precio: null, oferta_precio: 5 }, ahora).antes === null && P.precioQueCuenta({ precio: null }, ahora) === null)
  check('la rebaja: −10 % de 95 = 85,50; sin precio, null', P.precioRebajado(95, 10) === 85.5 && P.precioRebajado(null, 10) === null && P.precioRebajado(0.99, 50) === 0.5)
}

const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const FILAS = [
  { id: 'st-0', card_id: 'carta-0', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '0', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 50, precio: 95, cm: 90, visible: true, entro_el: hace(3), destacada: false, oferta_precio: 80, oferta_hasta: new Date(Date.now() + 3 * 864e5).toISOString() },
  { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 10, precio: 20, cm: 22, visible: true, entro_el: hace(3), destacada: false, oferta_precio: 15, oferta_hasta: hace(1) },
  { id: 'st-2', card_id: 'carta-0', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '0', idioma: 'en', estado: 'NM', variante: 'normal', unidades: 1, coste: 5, precio: 30, cm: 31, visible: true, entro_el: hace(3), destacada: false, oferta_precio: null, oferta_hasta: null },
  { id: 'st-3', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', idioma: 'en', estado: 'NM', variante: 'normal', unidades: 1, coste: 5, precio: null, cm: 3, visible: true, entro_el: hace(3), destacada: false, oferta_precio: null, oferta_hasta: null },
]
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2' } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.sesion === 'user-2') { window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }; localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}') }
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', precio_visible: true }], tienda_stock: d.FILAS.map((f) => ({ ...f, tienda_id: 'user-2' })) }
    window.__FAKE_CARTAS__ = [{ id: 'carta-0', set_id: 'set-0', market: 'WEST', local_id: '0', name: 'Pikachu ex' }, { id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '1', name: 'Mew ex' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: { total: d.FILAS.length, en_stock: d.FILAS.length, destacadas: 0, sumas: {}, facetas: {}, filas: d.FILAS },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
      tiendas_que_tienen: [{ tienda_id: 'user-2', username: 'rincon', display_name: 'El Rincón', ciudad: 'Bilbao', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, precio: 80, precio_antes: 95, de_tu_lista: false }],
    }
  }, { sesion, FILAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}
const fila = (p, id) => p.evaluate((id) => window.__TABLAS__.tienda_stock.find((f) => f.id === id), id)

console.log('── El Stock ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock')
  const celda = (id) => p.textContent(`[data-fila="${id}"] .tds-c-precio`)
  check('en oferta: 80 en rojo, 95 tachado, −16 % y hasta cuándo', !errs.length && (await p.locator('[data-fila="st-0"] .tds-oferta s').textContent()).includes('95') && /80,00/.test(await celda('st-0')) && /−16 %.*hasta el/.test(await celda('st-0')), errs.join(' | ') || await celda('st-0'))
  check('  …la acabada se dice, con su precio de siempre', /20,00.*Oferta acabada/.test(await celda('st-1')) && (await p.locator('[data-fila="st-1"] .tds-oferta').count()) === 0)
  await seleccionar(p)
  for (const id of ['st-0', 'st-2', 'st-3']) await p.click(`[data-fila="${id}"] .tds-c-uds`)
  await p.click('[data-bloque="oferta"]'); await p.waitForTimeout(400)
  check('la oferta en bloque: en %, con el ejemplo y avisando de la que no tiene precio', (await p.isVisible('#tdsOferta [name="pct"]')) && (await p.isHidden('#tdsOferta [name="fijo"]')) && /95,00\s€ a 85,50\s€/.test(await p.textContent('#tdsOferta [data-ejemplo]')) && /Una no tiene precio/.test(await p.textContent('#tdsOferta [data-ejemplo]')))
  await p.click('#tdsOferta button[type="submit"]'); await p.waitForTimeout(800)
  check('  …−10 % sobre el precio de CADA una (85,50 y 27,00), sin tocar la que no tiene precio', (await fila(p, 'st-0')).oferta_precio === 85.5 && (await fila(p, 'st-2')).oferta_precio === 27 && (await fila(p, 'st-3')).oferta_precio == null && (await fila(p, 'st-0')).oferta_hasta == null, JSON.stringify(await fila(p, 'st-2')))
  await seleccionar(p); await seleccionar(p)
  for (const id of ['st-0', 'st-2']) await p.click(`[data-fila="${id}"] .tds-c-uds`)
  await p.click('[data-bloque="oferta"]'); await p.waitForTimeout(400)
  await p.click('#tdsOferta label:has([value="fijo"])')
  await p.fill('#tdsOferta [name="fijo"]', '9.99')
  await p.fill('#tdsOferta [name="hasta"]', '2030-01-15')
  await p.click('#tdsOferta button[type="submit"]'); await p.waitForTimeout(800)
  const f0 = await fila(p, 'st-0')
  check('un precio para todas, hasta el final del día que se dice', f0.oferta_precio === 9.99 && (await fila(p, 'st-2')).oferta_precio === 9.99 && new Date(f0.oferta_hasta).toLocaleDateString('sv') === '2030-01-15' && new Date(f0.oferta_hasta).getHours() === 23, JSON.stringify(f0))
  await seleccionar(p); await seleccionar(p)
  await p.click('[data-fila="st-0"] .tds-c-uds')
  await p.click('[data-bloque="oferta"]'); await p.waitForTimeout(400)
  await p.click('#tdsOferta [data-quitar-oferta]'); await p.waitForTimeout(800)
  check('quitar la oferta la quita', (await fila(p, 'st-0')).oferta_precio == null && (await fila(p, 'st-0')).oferta_hasta == null)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock')
  await p.click('[data-fila="st-2"] .tds-c-uds'); await p.waitForTimeout(1200)
  check('la ficha de una línea lleva su oferta (plegada si no tiene)', (await p.locator('#tdsEditar .tds-oferta-form').count()) === 1 && !(await p.locator('#tdsEditar .tds-oferta-form').evaluate((d) => d.open)))
  await p.click('#tdsEditar .tds-oferta-form summary')
  await p.fill('#tdsEditar [name="oferta_precio"]', '25')
  await p.click('#tdsEditar button[type="submit"].btn-primary'); await p.waitForTimeout(800)
  check('  …y se guarda, sin fecha', (await fila(p, 'st-2')).oferta_precio === 25 && (await fila(p, 'st-2')).oferta_hasta == null)
  await ctx.close()
}

console.log('── Vender cobra la oferta ──')
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock')
  await seleccionar(p)
  for (const id of ['st-0', 'st-1']) await p.click(`[data-fila="${id}"] .tds-c-uds`)
  await p.click('[data-bloque="vender"]'); await p.waitForTimeout(1200)
  const precios = await p.locator('[data-precio]').evaluateAll((xs) => xs.map((x) => x.value))
  check('la de oferta a 80; la de la oferta acabada, a su precio (20)', precios.join('|') === '80|20', precios.join('|'))
  await ctx.close()
}

console.log('── «En tiendas» ──')
{
  const { p, ctx, errs } = await abrir('/cartas', { sesion: 'user-1' })
  const html = await p.evaluate(async () => {
    const m = await import('/js/en-tiendas.js')
    return m.enTiendasHtml([{ username: 'rincon', display_name: 'El Rincón', idioma: 'es', estado: 'NM', precio: 80, precio_antes: 95 }, { username: 'norte', idioma: 'es', estado: 'NM', precio: 30, precio_antes: null }], 'carta-0')
  })
  check('el precio de la tienda en oferta con el de antes tachado; la otra, sin', !errs.length && /<s class="ent-antes">95,00\s€<\/s> 80,00\s€/.test(html) && (html.match(/ent-antes/g) || []).length === 1, html.slice(0, 300))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

// Tanda 1081 — el stock en rejilla: «Tabla / Rejilla» (se recuerda en el
// navegador), la carta grande y las unidades y tu precio para cambiarlos ahí
// mismo: cambia ya, se guarda al salir del campo (o con Intro), vuelve si la
// base dice que no o si lo escrito no vale, y las sumas de abajo se ajustan.
// Seleccionar y la estrella siguen funcionando en la rejilla.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Desde la 1086, «Seleccionar» está en «⋯» y la barra de abajo lo apaga con «Hecho».
const seleccionar = async (p) => ((await p.isVisible('.tds-sel')) ? p.click('.tds-sel-fin') : (await p.click('[data-tds-menu="mas"]'), p.click('.tds-menu [data-tds="seleccionar"]')))
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const FILAS = [
  { id: 'st-0', card_id: 'carta-0', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '0', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 50, precio: 95, cm: 90, visible: true, entro_el: hace(3), destacada: false, oferta_precio: 80, oferta_hasta: null },
  { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', idioma: 'en', estado: 'EX', variante: 'normal', unidades: 1, coste: 10, precio: 20, cm: 22, visible: false, entro_el: hace(3), destacada: true, oferta_precio: null, oferta_hasta: null },
]
const b = await chromium.launch()
async function abrir({ vista = null, sinFilas = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}')
    if (d.vista && !sessionStorage.getItem('puesta')) { localStorage.setItem('pd-tienda-stock-vista', d.vista); sessionStorage.setItem('puesta', '1') }
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', precio_visible: true }], tienda_stock: d.sinFilas ? [] : d.FILAS.map((f) => ({ ...f, tienda_id: 'user-2' })) }
    window.__FAKE_CARTAS__ = [{ id: 'carta-0', set_id: 'set-0', market: 'WEST', local_id: '0', name: 'Pikachu ex' }, { id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '1', name: 'Mew ex' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: { total: 2, en_stock: 2, destacadas: 1, sumas: { unidades: 3, coste: 110, precio: 210, cm: 202 }, facetas: {}, filas: d.FILAS },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
    }
  }, { vista, sinFilas, FILAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/tienda.html?ver=stock`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}
const fila = (p, id) => p.evaluate((id) => window.__TABLAS__.tienda_stock.find((f) => f.id === id), id)
const pie = (p) => p.textContent('.tds-pie')

{
  const { p, ctx, errs } = await abrir()
  check('de serie, la tabla (con «Tabla» marcado)', !errs.length && (await p.locator('.tds-tabla').count()) === 1 && (await p.getAttribute('[data-tds-vista="tabla"]', 'aria-pressed')) === 'true', errs.join(' | '))
  await p.click('[data-tds-menu="mas"]'); await p.click('[data-tds-vista="rejilla"]'); await p.waitForTimeout(300)
  check('«Rejilla»: una baldosa por línea, con la foto, la estrella y los dos campos', (await p.locator('.tds-baldosa').count()) === 2 && (await p.locator('.tds-baldosa .tds-foto-caja').count()) === 2 && (await p.locator('.tds-baldosa .tds-estrella').count()) === 2 && (await p.locator('[data-en-linea]').count()) === 4)
  check('  …la de oferta con su chapa y su precio rebajado; la oculta, dicho', /−16 %/.test(await p.textContent('[data-fila="st-0"] .tds-baldosa-chapas')) && /Oferta 80,00/.test(await p.textContent('[data-cm-de="st-0"]')) && /Oculta/.test(await p.textContent('[data-fila="st-1"]')))
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  check('se recuerda al volver', (await p.locator('.tds-rejilla').count()) === 1 && (await p.getAttribute('[data-tds-vista="rejilla"]', 'aria-pressed')) === 'true')

  await p.fill('[data-en-linea="unidades"][data-id="st-0"]', '5')
  await p.press('[data-en-linea="unidades"][data-id="st-0"]', 'Enter'); await p.waitForTimeout(700)
  check('unidades con Intro: se guarda, sin abrir la ficha', (await fila(p, 'st-0')).unidades === 5 && !(await p.locator('#tdsEditar[open]').count()))
  check('  …y las sumas de abajo cuentan las 3 nuevas (6 unidades, 495 € a tu precio)', /6 unidades/.test(await pie(p)) && /495,00/.test(await pie(p)), await pie(p))
  await p.fill('[data-en-linea="precio"][data-id="st-1"]', '24.5')
  await p.click('h2, body', { position: { x: 5, y: 5 } }); await p.waitForTimeout(700)
  check('el precio, al salir del campo', (await fila(p, 'st-1')).precio === 24.5)
  await p.fill('[data-en-linea="unidades"][data-id="st-1"]', '-3')
  await p.press('[data-en-linea="unidades"][data-id="st-1"]', 'Enter'); await p.waitForTimeout(500)
  check('lo que no vale vuelve, con su aviso, y no se pide', (await p.inputValue('[data-en-linea="unidades"][data-id="st-1"]')) === '1' && (await fila(p, 'st-1')).unidades === 1 && /de 0 a 99\.999/.test(await p.textContent('body')))
  await p.fill('[data-en-linea="precio"][data-id="st-0"]', '')
  await p.press('[data-en-linea="precio"][data-id="st-0"]', 'Enter'); await p.waitForTimeout(600)
  check('dejar el precio vacío lo quita (sin precio, no un cero)', (await fila(p, 'st-0')).precio === null)

  await p.click('[data-fila="st-1"] .tds-baldosa-nombre'); await p.waitForTimeout(1000)
  check('tocar la carta abre su ficha', (await p.locator('#tdsEditar[open]').count()) === 1)
  await p.keyboard.press('Escape')
  await seleccionar(p)
  await p.click('[data-fila="st-0"] .tds-baldosa-nombre'); await p.waitForTimeout(300)
  check('con «Seleccionar», tocarla la marca (casilla y borde)', (await p.locator('[data-fila="st-0"].tds-marcada').count()) === 1 && (await p.isChecked('[data-fila="st-0"] .tds-baldosa-check')) && /1 marcada/.test(await p.textContent('.tds-sel-n')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir({ vista: 'rejilla', sinFilas: true })
  await p.fill('[data-en-linea="unidades"][data-id="st-1"]', '7')
  await p.press('[data-en-linea="unidades"][data-id="st-1"]', 'Enter'); await p.waitForTimeout(700)
  check('si la base no lo guarda, vuelve lo de antes, con su aviso', (await p.inputValue('[data-en-linea="unidades"][data-id="st-1"]')) === '1' && /No se ha podido guardar/.test(await p.textContent('body')) && /3 unidades/.test(await pie(p)))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

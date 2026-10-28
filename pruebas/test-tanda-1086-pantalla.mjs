// Tanda 1086 — la barra del Stock de una tienda en una fila (PINGU:
// «demasiados botones»): «+ Añadir» con su menú (buscar una carta, la
// Colección, importar un CSV), Filtros (en el móvil, con cuántos hay
// puestos), el orden (un icono en el móvil, que abre el desplegable del
// sistema) y «⋯» (Seleccionar, tabla o rejilla, exportar). Los menús se
// cierran al elegir, al tocar fuera o con Escape. En el móvil, una sola lupa
// (la de arriba no se repite en el Stock) y nada se sale de ancho. Las vistas
// solo salen si hay alguna guardada o un filtro que guardar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const FILAS = [
  { id: 'st-0', card_id: 'carta-0', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '0', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 50, precio: 95, cm: 90, visible: true, entro_el: hace(3) },
  { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', idioma: 'en', estado: 'EX', variante: 'normal', unidades: 1, coste: 10, precio: 20, cm: 22, visible: true, entro_el: hace(3) },
]
const b = await chromium.launch()
async function abrir(ruta, { movil = false, vistas = [] } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1500, height: 950 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}')
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2' }], tienda_vistas: d.vistas }
    window.__FAKE_CARTAS__ = [{ id: 'carta-0', set_id: 'set-0', market: 'WEST', local_id: '0', name: 'Pikachu ex' }, { id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '1', name: 'Mew ex' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__PEDIDAS__ = []
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: (a) => { window.__PEDIDAS__.push(a); return { total: 2, en_stock: 2, sumas: {}, facetas: { idioma: { es: 1, en: 1 } }, filas: d.FILAS } },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
    }
  }, { FILAS, vistas })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}
const visibles = (p, sel) => p.$$eval(sel, (xs) => xs.filter((x) => x.getBoundingClientRect().width > 0).length)

console.log('── En el móvil ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock', { movil: true })
  check('una fila: Añadir, Filtros, el orden y «⋯», sin salirse', !errs.length && (await visibles(p, '.tds-barra > *')) === 4 && (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390 && (await p.evaluate(() => { const r = [...document.querySelectorAll('.tds-barra > *')].map((x) => x.getBoundingClientRect()); return r.every((x) => Math.abs(x.top - r[0].top) < 4 && x.right <= 390) })), errs.join(' | '))
  check('  …y una sola lupa: la de arriba no se repite en el Stock', await p.evaluate(() => { const b = document.querySelector('.bm-pastilla'); return !b || getComputedStyle(b).display === 'none' }) && (await p.isVisible('[data-tds-q]')))
  check('  …sin «Todo» suelto (no hay vistas guardadas ni filtros)', (await p.locator('.tds-vistas [data-vista]').count()) === 0)
  check('el orden es un icono, con el desplegable del sistema encima', (await p.isVisible('.tds-orden-icono')) && (await p.evaluate(() => getComputedStyle(document.querySelector('[data-tds-orden]')).opacity)) === '0')
  await p.selectOption('[data-tds-orden]', 'precio_desc'); await p.waitForTimeout(500)
  check('  …y ordena', (await p.evaluate(() => window.__PEDIDAS__.at(-1).p_orden)) === 'precio_desc')
  await p.click('[data-tds-menu="anadir"]')
  check('«+ Añadir» abre su menú: buscar una carta, la Colección e importar', (await p.isVisible('.tds-menu[data-menu="anadir"]')) && (await p.locator('.tds-menu[data-menu="anadir"] [role="menuitem"]').allTextContents()).map((t) => t.split(/(?=[A-Z])/)[0]).join('|').includes('Buscar una carta') && (await p.getAttribute('[data-tds-menu="anadir"]', 'aria-expanded')) === 'true')
  check('  …dentro de la pantalla', await p.evaluate(() => document.querySelector('.tds-menu[data-menu="anadir"]').getBoundingClientRect().right <= 390))
  await p.click('[data-tds-menu="mas"]')
  check('abrir «⋯» cierra el otro', (await p.isHidden('.tds-menu[data-menu="anadir"]')) && (await p.isVisible('.tds-menu[data-menu="mas"]')) && (await p.evaluate(() => document.querySelector('.tds-menu[data-menu="mas"]').getBoundingClientRect().left >= 0)))
  await p.keyboard.press('Escape')
  check('  …Escape lo cierra', await p.isHidden('.tds-menu[data-menu="mas"]'))
  await p.click('[data-tds-menu="mas"]'); await p.click('.tds-pie', { force: true })
  check('  …y tocar fuera también', await p.isHidden('.tds-menu[data-menu="mas"]'))
  await p.click('[data-tds-menu="mas"]'); await p.click('.tds-menu [data-tds="seleccionar"]'); await p.waitForTimeout(300)
  check('«Seleccionar» desde «⋯»: la barra de abajo con «Hecho», y el menú cerrado', (await p.isVisible('.tds-sel')) && (await p.isVisible('.tds-sel-fin')) && (await p.isHidden('.tds-menu[data-menu="mas"]')) && (await p.locator('[data-marcar]').count()) === 2)
  await p.click('.tds-sel-fin'); await p.waitForTimeout(300)
  check('  …«Hecho» lo apaga', (await p.isHidden('.tds-sel')) && (await p.locator('[data-marcar]').count()) === 0)
  await p.click('[data-tds-menu="mas"]'); await p.click('[data-tds-vista="rejilla"]'); await p.waitForTimeout(300)
  check('la rejilla desde «⋯», marcada como la elegida', (await p.locator('.tds-rejilla').count()) === 1 && (await p.getAttribute('[data-tds-vista="rejilla"]', 'aria-pressed')) === 'true')
  await p.click('[data-tds="abrir-filtros"]'); await p.waitForTimeout(300)
  await p.click('.tds-filtros [data-filtro="idioma"][data-valor="es"]'); await p.waitForTimeout(600)
  check('Filtros dice cuántos hay puestos', /· 1/.test(await p.textContent('[data-tds-n-filtros]')))
  await ctx.close()
}

console.log('── En el PC ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock')
  check('Añadir, el orden con su texto y «⋯»; Filtros no (el panel ya está a la vista)', !errs.length && (await p.isVisible('[data-tds-menu="anadir"]')) && (await p.isVisible('[data-tds-orden]')) && (await p.isHidden('.tds-orden-icono')) && (await p.isVisible('[data-tds-menu="mas"]')) && (await p.isHidden('.tds-ver-filtros')), errs.join(' | '))
  await p.click('[data-tds-menu="anadir"]'); await p.click('.tds-menu [data-tds="anadir"]'); await p.waitForTimeout(500)
  check('«Buscar una carta» abre el diálogo de añadir y cierra el menú', (await p.locator('dialog[open]').count()) === 1 && (await p.isHidden('.tds-menu[data-menu="anadir"]')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock', { vistas: [{ id: 'v1', tienda_id: 'user-2', nombre: 'Vitrina', filtros: { ubicacion: ['Vitrina'] }, orden: 0 }] })
  check('con una vista guardada, «Todo» y la suya', (await p.locator('.tds-vistas [data-vista]').allTextContents()).join('|') === 'Todo|Vitrina')
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

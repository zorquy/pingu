// Tanda 1234 — cartas gradeadas en las tiendas (PINGU: «las tiendas venden
// cartas gradeadas… PSA, Beckett y CGC»; «si es PSA, roja con las letras
// blancas; Beckett, negra con las letras blancas; CGC, blanca con las letras
// negras»).
//   · el stock pinta la etiqueta de la cápsula con esos colores, en la tabla
//     (en lugar del estado) y en la rejilla;
//   · el formulario del stock: «Gradeada» con No / PSA / Beckett / CGC y la
//     nota de cada casa; con cápsula el estado se esconde y se guarda NM;
//     editar una gradeada la abre con su casa y su nota;
//   · la Colección de la tienda (/cartas): «Gradeada» arriba del «añadir», y
//     lo añadido va al stock con su etiqueta;
//   · `chapaDeGradeoHtml` y `gradeoHtml` (puros): una casa que no es de las tres
//     no se pierde al editar.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const FILAS = [
  { id: 'st-0', card_id: 'carta-0', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '0', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: 'PSA 10', unidades: 1, coste: 50, precio: 95, cm: 90, visible: true, entro_el: hace(3), destacada: false },
  { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', idioma: 'en', estado: 'NM', variante: 'normal', gradeo: 'BGS 9.5', unidades: 1, coste: 10, precio: 20, cm: 22, visible: true, entro_el: hace(3), destacada: false },
  { id: 'st-2', card_id: 'carta-2', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '2', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: 'CGC 10', unidades: 1, coste: 10, precio: 20, cm: 22, visible: true, entro_el: hace(3), destacada: false },
  { id: 'st-3', card_id: 'carta-3', market: 'WEST', nombre: 'Eevee', set_id: 'set-0', numero: '3', idioma: 'es', estado: 'EX', variante: 'normal', gradeo: null, unidades: 4, coste: 1, precio: 2, cm: 2, visible: true, entro_el: hace(3), destacada: false },
]
const b = await chromium.launch()
async function abrirStock(vista = 'tabla') {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, serviceWorkers: 'block', locale: 'es-ES' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}')
    localStorage.setItem('pd-tienda-stock-vista', d.vista)
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', precio_visible: true }], tienda_stock: d.FILAS.map((f) => ({ ...f, tienda_id: 'user-2' })) }
    window.__FAKE_CARTAS__ = d.FILAS.map((f) => ({ id: f.card_id, set_id: 'set-0', market: 'WEST', local_id: f.numero, name: f.nombre }))
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: { total: 4, en_stock: 4, destacadas: 0, sumas: { unidades: 7, coste: 71, precio: 137, cm: 136 }, facetas: {}, filas: d.FILAS },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
    }
  }, { FILAS, vista })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/tienda.html?ver=stock`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}
const colores = (p, sel) => p.$$eval(sel, (xs) => xs.map((x) => `${x.dataset.casa || '-'}|${x.textContent.trim()}|${getComputedStyle(x).backgroundColor}|${getComputedStyle(x).color}`))

console.log('── El stock: la etiqueta con su color ──')
{
  const { p, ctx, errs } = await abrirStock('tabla')
  const c = await colores(p, '.tds-c-estado .chapa-gradeo')
  check('tabla: la columna de estado lleva la etiqueta de la cápsula en las tres gradeadas', c.length === 3, JSON.stringify(c))
  check('  …PSA roja con letras blancas', c.some((x) => x === 'PSA|PSA 10|rgb(200, 16, 46)|rgb(255, 255, 255)'), JSON.stringify(c))
  check('  …Beckett negra con letras blancas', c.some((x) => x === 'BGS|BGS 9.5|rgb(17, 17, 17)|rgb(255, 255, 255)'), JSON.stringify(c))
  check('  …CGC blanca con letras negras', c.some((x) => x === 'CGC|CGC 10|rgb(255, 255, 255)|rgb(17, 17, 17)'), JSON.stringify(c))
  check('  …la sin gradear sigue con su estado (EX)', /EX/.test(await p.textContent('[data-fila="st-3"] .tds-c-estado')) && !(await p.$('[data-fila="st-3"] .chapa-gradeo')))
  // Editar una gradeada: abre con su casa y su nota, sin estado.
  await p.click('[data-fila="st-1"] .tds-c-uds'); await p.waitForTimeout(1200)
  const ed = await p.evaluate(() => ({ casa: document.querySelector('.tds-form .ge-casa[aria-pressed="true"]')?.dataset.geCasa, nota: document.querySelector('.tds-form [data-ge-nota]')?.value, estadoVisto: !!document.querySelector('.tds-form .tds-estado-campo')?.getClientRects().length }))
  check('editar la Beckett: «Beckett» marcado, nota 9.5 y sin estado', ed.casa === 'BGS' && ed.nota === '9.5' && !ed.estadoVisto, JSON.stringify(ed))
  if (process.env.OUT) await (await p.$('.tds-editar[open], dialog[open]'))?.screenshot({ path: `${process.env.OUT}/1234-form.png` })
  await p.click('.tds-form .ge-casa[data-ge-casa="PSA"]'); await p.waitForTimeout(200)
  const psa = await p.evaluate(() => ({ notas: [...document.querySelectorAll('.tds-form [data-ge-nota] option')].map((o) => o.value), nota: document.querySelector('.tds-form [data-ge-nota]').value }))
  check('  …PSA trae SUS notas (enteras, 1.5 y Authentic; sin 9.5) y se queda en 10', psa.notas.includes('Authentic') && !psa.notas.includes('9.5') && psa.nota === '10', JSON.stringify(psa))
  await p.selectOption('.tds-form [data-ge-nota]', '9'); await p.click('.tds-form button[type="submit"].btn-primary'); await p.waitForTimeout(1200)
  const fila = await p.evaluate(() => window.__TABLAS__.tienda_stock.find((f) => f.id === 'st-1'))
  check('  …se guarda «PSA 9» con estado NM', fila.gradeo === 'PSA 9' && fila.estado === 'NM', JSON.stringify({ g: fila.gradeo, e: fila.estado }))
  // Quitarle la cápsula: vuelve el estado.
  await p.click('[data-fila="st-0"] .tds-c-uds'); await p.waitForTimeout(1200)
  await p.click('.tds-form .ge-casa[data-ge-casa=""]'); await p.waitForTimeout(200)
  check('«No» vuelve a enseñar el estado', !!(await p.evaluate(() => document.querySelector('.tds-form .tds-estado-campo')?.getClientRects().length)))
  await p.selectOption('.tds-form [name="estado"]', 'EX'); await p.click('.tds-form button[type="submit"].btn-primary'); await p.waitForTimeout(1200)
  const f0 = await p.evaluate(() => window.__TABLAS__.tienda_stock.find((f) => f.id === 'st-0'))
  check('  …y se guarda sin gradeo y con su estado', f0.gradeo === null && f0.estado === 'EX', JSON.stringify({ g: f0.gradeo, e: f0.estado }))
  check('sin errores', errs.length === 0, errs.join(' | '))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1234-tabla.png` })
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrirStock('rejilla')
  const c = await colores(p, '.tds-baldosa .chapa-gradeo')
  check('rejilla: las tres gradeadas con su etiqueta sobre la foto', c.length === 3 && c.some((x) => x.startsWith('PSA|PSA 10|rgb(200, 16, 46)')), JSON.stringify(c))
  check('  …y su detalle ya no repite «NM»', !/NM/.test(await p.textContent('[data-fila="st-0"] .tds-baldosa-detalle')), await p.textContent('[data-fila="st-0"] .tds-baldosa-detalle'))
  check('sin errores', errs.length === 0, errs.join(' | '))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1234-rejilla.png` })
  await ctx.close()
}

console.log('── La Colección de la tienda: «Gradeada» al añadir ──')
{
  const N = 4
  const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, tcg_online_code: 'SSP', tcggo_id: 300 }]
  const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Pikachu ${i + 1}`, name_es: `Pikachu ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Cartas de Ane', username: 'cartas-ane' }
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_FILAS__ = { tienda_stock: [] }
    if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); localStorage.setItem('pd-tienda', JSON.stringify({ u: 'cartas-ane', id: 'user-2' })) }
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/cartas?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  await p.click('#mcAlbum [data-carta="sv8-2"]'); await p.waitForTimeout(1200)
  await p.click('#mcEdMas'); await p.waitForTimeout(800)
  const orden = await p.evaluate(() => {
    const y = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? null
    return { gradeo: y('#mcAdGradeoCaja .ge'), idioma: y('#mcAdIdiomas'), estado: y('#mcAdEstado') ?? y('.mc-ad-campo') }
  })
  check('el «añadir» de la tienda: «Gradeada» lo primero, luego el idioma', orden.gradeo != null && orden.idioma != null && orden.gradeo < orden.idioma, JSON.stringify(orden))
  await p.click('#mcAdGradeoCaja .ge-casa[data-ge-casa="CGC"]'); await p.waitForTimeout(200)
  check('  …con una casa, el estado se esconde', !(await p.evaluate(() => document.getElementById('mcAdEstado').closest('.mc-ad-campo').getClientRects().length)))
  await p.selectOption('#mcAdGradeoCaja [data-ge-nota]', '9.5')
  if (process.env.OUT) await (await p.$('#mcAnadirDialogo'))?.screenshot({ path: `${process.env.OUT}/1234-anadir.png` })
  await p.fill('#mcAdPrecio', '40')
  await p.click('#mcAdGuardar'); await p.waitForTimeout(1500)
  const st = await p.evaluate(() => (window.__TABLAS__.tienda_stock || []).map((f) => `${f.card_id}|${f.gradeo}|${f.estado}|${f.precio}`))
  check('  …va al stock como «CGC 9.5», estado NM y su precio', st.includes('sv8-2|CGC 9.5|NM|40'), JSON.stringify(st))
  check('sin errores', errs.length === 0, errs.join(' | '))
  await ctx.close()
}

console.log('── Lo puro ──')
{
  const ctx = await b.newContext(); const p = await ctx.newPage()
  await p.goto(`${BASE}/404.html`).catch(() => {})
  const r = await p.evaluate(async () => {
    const m = await import('/js/gradeo-elegir.js')
    const caja = document.createElement('div'); caja.innerHTML = m.gradeoHtml('SGC 9.5'); document.body.append(caja)
    const lector = m.engancharGradeo(caja)
    return { chapa: m.chapaDeGradeoHtml('PSA 10'), vacia: m.chapaDeGradeoHtml(''), ajena: lector.valor(), boton: caja.querySelector('.ge-casa[aria-pressed="true"]')?.textContent }
  })
  check('chapa: PSA con su casa', /data-casa="PSA"/.test(r.chapa) && /<b>PSA<\/b> 10/.test(r.chapa), r.chapa)
  check('  …sin gradeo, nada', r.vacia === '')
  check('una casa que no es de las tres (SGC) se ofrece tal cual y no se pierde', r.ajena === 'SGC 9.5' && r.boton === 'SGC 9.5', JSON.stringify(r))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

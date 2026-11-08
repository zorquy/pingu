// Tanda 1238 — Los tratos: «Cómo funciona» y tarjetas iguales (PINGU: «le he
// hecho una propuesta a un chico y me ha dicho ¿cómo funciona esto?», y «la
// que tiene tres cartas está más ancha que las otras»). Se mira:
//   · las tarjetas de «En curso» con la caja de las cartas del MISMO alto y el
//     pie en la misma línea, aunque una lleve tres cartas (en abanico, una fila);
//   · la franja «Es tu primera propuesta» en el trato recibido de quien no ha
//     cerrado ninguno, con su paso marcado, y «Entendido» la quita para siempre;
//   · el «?» del trato abre «Así funciona un trato» de ESE trato (Venta, paso 2);
//   · «Cómo funciona» en la hoja de proponer, y «¿Primera vez?» en Mensajes.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', market: 'WEST', release_date: '2021-08-27', card_count_official: 203 },
  { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, tcg_online_code: 'MEW' },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
  { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', release_date: '2023-06-09', card_count_official: 193 },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, extra = {}) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const CARTAS = [carta('swsh7-215', 'swsh7', 215, 'Umbreon VMAX'), carta('sv3pt5-199', 'sv3pt5', 199, 'Charizard ex'), carta('sv8-238', 'sv8', 238, 'Pikachu ex'), carta('sv2-269', 'sv2', 269, 'Iono'), carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'), carta('swsh7-1', 'swsh7', 1, 'Mew'), carta('SV2a-201', 'SV2a', 201, 'リザードン', { name_en: 'Charizard' })]
const U = (n) => `user-${n}`
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: U(1), username: 'lucia_tcg', display_name: 'Lucía' }, { id: U(2), username: 'danipoke', display_name: 'Dani' }, { id: U(3), username: 'marta.jp', display_name: 'Marta' }, { id: U(4), username: 'iker_ex', display_name: 'Íker' }, { id: U(5), username: 'malo', is_banned: true }]
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
const linea = (id, user, card, idioma, cambio, h, o = {}) => ({ id, user_id: user, card_id: card, market: card.startsWith('SV2a') ? 'JP' : 'WEST', cantidad: Math.max(1, cambio), cambio, idioma, estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(h), ...o })
// Yo (admin-1) doy Mew ex; Lucía busca Mew ex, así que con ella hay cruce.
const COLECCION = [
  linea('m1', 'admin-1', 'sv3pt5-151', 'es', 1, 1),
  linea('o1', U(1), 'swsh7-215', 'es', 1, 2), linea('o2', U(4), 'swsh7-215', 'en', 1, 3), linea('o3', U(2), 'sv3pt5-199', 'es', 1, 5),
  linea('o4', U(2), 'sv2-269', 'es', 1, 6), linea('o5', U(3), 'sv2-269', 'fr', 2, 7), linea('o6', U(1), 'sv2-269', 'es', 1, 8),
  linea('o7', U(4), 'sv8-238', 'es', 1, 9), linea('o8', U(3), 'SV2a-201', 'ja', 1, 1),
  // La da un baneado y otra con cambio 0: ninguna de las dos sale.
  linea('o9', U(5), 'swsh7-1', 'es', 1, 1), linea('o10', U(4), 'swsh7-1', 'es', 0, 1),
]
const DESEOS = [{ id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }, { id: 'd2', user_id: U(1), card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
const PRECIOS = [{ card_id: 'sv3pt5-151', cm_low: 38 }, { card_id: 'swsh7-215', cm_low: 612 }, { card_id: 'sv3pt5-199', cm_low: 118.5 }, { card_id: 'sv8-238', cm_low: 84.9 }, { card_id: 'sv2-269', cm_low: 42 }]

const browser = await chromium.launch()
async function abrir({ movil = false, sesion = true, ancho = 1440, extra = {} } = {}) {
  // Sin service worker: el de la web (745) contesta antes que `route` y la
  // prueba no vería a dónde se va al escribir.
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion ? 'admin-1' : 'none'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = d.PRECIOS
    Object.assign(window, d.extra)
  }, { SETS, CARTAS, COLECCION, DESEOS, PERFILES, PRECIOS, sesion, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // A dónde se va al escribir o al registrarse, sin irse de verdad.
  await ctx.route(/\/auth\.html/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fuera</title>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta = '/mi-coleccion.html?ver=mercado') => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
}
const baldosas = (page) => page.$$eval('#mcMercadoRejilla .mc-merc', (as) => as.map((a) => a.dataset.merc))
const textoDe = (page, id) => page.$eval(`#mcMercadoRejilla [data-merc="${id}"]`, (a) => a.innerText.replace(/\s+/g, ' ').trim())
const visible = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return !!e && !e.closest('.hidden') && e.getBoundingClientRect().height > 0 }, sel)


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}





console.log('── 0. Preparar: una propuesta mía a Lucía y una de Íker a mí ──')
let tablas
{
  const { ctx, page } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
  await page.waitForTimeout(1800)
  // «Cómo funciona» en la hoja de proponer.
  check('la hoja de proponer lleva «Cómo funciona»', await page.locator('#cpDialogo [data-cp="ayuda"]').isVisible())
  await page.click('#cpDialogo [data-cp="ayuda"]')
  await page.waitForTimeout(500)
  const hoja = await page.evaluate(() => { const d = document.getElementById('cayDialogo'); return d && { open: d.open, modal: d.matches(':modal'), pasos: d.querySelectorAll('.cay-paso').length, primero: d.querySelector('.cay-paso b')?.textContent, tipo: d.querySelector('[data-cay-tipo][aria-pressed="true"]')?.textContent, seguro: d.querySelectorAll('.cay-seguro li').length } })
  check('  …y abre «Así funciona un trato» con cuatro pasos de quien propone', hoja?.open && hoja.modal && hoja.pasos === 4 && /Propones/.test(hoja.primero) && hoja.tipo === 'Cambio' && hoja.seguro === 3, JSON.stringify(hoja))
  await page.click('#cayDialogo [data-cay-tipo="compro"]')
  await page.waitForTimeout(200)
  check('  …y los chips cuentan otro tipo', /le compras/.test(await page.locator('#cayDialogo .cay-paso p').first().innerText()), await page.locator('#cayDialogo .cay-paso p').first().innerText())
  await page.click('#cayDialogo [data-cay-cerrar]')
  await page.waitForTimeout(200)
  check('  …y se cierra sin cerrar la propuesta', !(await page.evaluate(() => document.getElementById('cayDialogo').open)) && (await page.evaluate(() => document.getElementById('cpDialogo')?.open)))
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  await ctx.close()
}
{
  const { ctx, page } = await abrirCon(tablas, 'user-4', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.evaluate(async () => {
    const m = await import('/js/cambio-propuesta.js')
    const { getSession } = await import('/js/app.js')
    await m.abrirPropuesta({ sesion: await getSession(), otro: { id: 'admin-1', username: 'pingu' }, prefill: { suyas: [{ card_id: 'sv3pt5-151', idioma: 'es' }] } })
  })
  await page.waitForTimeout(1800)
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  await ctx.close()
}
// La de Lucía con tres cartas que recibo (el caso de KaruMi en la captura).
{
  const deLucia = tablas.trade_offers.find((o) => o.para === 'user-1')
  const suya = tablas.trade_offer_items.find((it) => it.oferta === deLucia.id && it.quien === 'user-1') || tablas.trade_offer_items.find((it) => it.oferta === deLucia.id)
  check('preparado: la propuesta a Lucía tiene una carta suya', Boolean(suya), JSON.stringify(tablas.trade_offer_items).slice(0, 300))
  if (suya) for (const [n, card] of [[2, 'sv2-269'], [3, 'sv8-238']]) tablas.trade_offer_items.push({ ...suya, id: `${suya.id}-${n}`, card_id: card })
}

console.log('── 1. Las tarjetas de «En curso», iguales ──')
for (const movil of [false, true]) {
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', movil ? { movil: true } : { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.click('[data-cruces-filtro="curso"]')
  await page.waitForTimeout(900)
  const m = await page.$$eval('#mcMisCambios details.cp-trato', (ts) => ts.map((t) => {
    const r = (s) => t.querySelector(s)?.getBoundingClientRect()
    // El lado con más cartas: sus miniaturas, en una sola fila.
    const abanicos = [...t.querySelectorAll('.cp-trato-abanico')].map((a) => [...a.querySelectorAll('.cp-mini')].map((x) => Math.round(x.getBoundingClientRect().top)))
    const minis = abanicos.sort((a, b) => b.length - a.length)[0] || []
    return { lados: Math.round(r('.cp-trato-lados').height), pieAbajo: Math.round(r('.cp-trato-pie').bottom - t.getBoundingClientRect().top), alto: Math.round(t.getBoundingClientRect().height), minis: minis.length, filas: new Set(minis.map((y) => Math.round(y / 12))).size }
  }))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1238-tarjetas-${movil ? 'm' : 'pc'}.png` })
  const tres = m.find((x) => x.minis === 3)
  check(`[${movil ? 'móvil' : 'PC'}] la de tres cartas, en una fila (abanico)`, tres && tres.filas === 1, JSON.stringify(m))
  check(`[${movil ? 'móvil' : 'PC'}]   …y la caja de las cartas del mismo alto en todas`, m.length === 2 && new Set(m.map((x) => x.lados)).size === 1, JSON.stringify(m))
  if (!movil) check('[PC]   …y el pie en la misma línea (las tarjetas, del mismo alto)', new Set(m.map((x) => x.pieAbajo)).size === 1 && new Set(m.map((x) => x.alto)).size === 1, JSON.stringify(m))
  check(`[${movil ? 'móvil' : 'PC'}] sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. La primera vez y el «?» ──')
{
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.click('[data-cruces-filtro="curso"]')
  await page.waitForTimeout(900)
  const iker = page.locator('#mcMisCambios details.cp-trato', { hasText: 'Íker' })
  await iker.locator('summary').click()
  await page.waitForTimeout(500)
  const dlg = iker.locator('dialog.cp-trato-dialogo')
  const f = await dlg.evaluate((d) => { const x = d.querySelector('[data-cay-franja]'); return x && { titulo: x.querySelector('b')?.textContent, ahora: x.querySelector('.cay-mini .ahora')?.textContent, texto: x.querySelector('p')?.textContent, fondo: getComputedStyle(x).backgroundColor } })
  check('la propuesta recibida, con «Es tu primera propuesta» y el paso «Aceptar» marcado', f?.titulo === 'Es tu primera propuesta' && f.ahora === 'Aceptar' && /te toca a ti/.test(f.texto) && f.fondo !== 'rgba(0, 0, 0, 0)', JSON.stringify(f))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1238-franja.png` })
  await dlg.locator('[data-cp-ayuda]').click()
  await page.waitForTimeout(500)
  if (CAPS) await page.screenshot({ path: `${CAPS}/1238-ayuda.png` })
  const h = await page.evaluate(() => { const d = document.getElementById('cayDialogo'); return d && { open: d.open, encima: d.matches(':modal'), tipo: d.querySelector('[data-cay-tipo][aria-pressed="true"]')?.textContent, ahora: d.querySelector('.cay-paso.ahora b')?.textContent, primero: d.querySelector('.cay-paso b')?.textContent } })
  check('el «?» abre «Así funciona un trato» de ESE trato: Venta, «Aceptas» ahora', h?.open && h.encima && h.tipo === 'Venta' && /Aceptas/.test(h.ahora || '') && /Te hacen una propuesta/.test(h.primero), JSON.stringify(h))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('  …Esc cierra la ayuda y deja el trato abierto', !(await page.evaluate(() => document.getElementById('cayDialogo').open)) && (await dlg.evaluate((d) => d.open)))
  await dlg.locator('[data-cay-entendido]').click()
  await page.waitForTimeout(300)
  check('«Entendido» quita la franja', (await page.locator('[data-cay-franja]').count()) === 0 && (await page.evaluate(() => Boolean(localStorage.getItem('pd-trato-ayuda-vista')))))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.click('[data-cruces-filtro="curso"]')
  await page.waitForTimeout(900)
  await page.locator('#mcMisCambios details.cp-trato', { hasText: 'Íker' }).locator('summary').click()
  await page.waitForTimeout(400)
  check('  …y no vuelve a salir', (await page.locator('[data-cay-franja]').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  // Con un trato ya hecho, la franja no sale.
  const hechas = { ...tablas, trade_offers: [...tablas.trade_offers, { ...tablas.trade_offers[0], id: 'hecha-1', estado: 'hecha' }] }
  const { ctx, page } = await abrirCon(hechas, 'admin-1', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.click('[data-cruces-filtro="curso"]')
  await page.waitForTimeout(900)
  await page.locator('#mcMisCambios details.cp-trato', { hasText: 'Íker' }).locator('summary').click()
  await page.waitForTimeout(400)
  check('quien ya ha cerrado un trato no ve la franja (sí el «?»)', (await page.locator('[data-cay-franja]').count()) === 0 && (await page.locator('dialog[open] [data-cp-ayuda]').count()) === 1)
  await ctx.close()
}

console.log('── 3. En Mensajes ──')
{
  const conv = tablas.trade_offers.find((o) => o.de === 'user-4')?.conversacion
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', { movil: true })
  await page.goto(`${BASE}/mensajes.html?c=${conv}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // Desde la 1269 el trato vivo está arriba (la tarjeta de «En curso») y la
  // ayuda es su «?», en el pop-up que se abre ahí mismo.
  await page.locator('#msgPropuestas details.cp-trato summary').click().catch(() => {})
  await page.waitForTimeout(500)
  const b = page.locator('#msgPropuestas dialog[open] [data-cp-ayuda]')
  check('el trato recibido abre aquí su pop-up, con el «?» de cómo funciona', (await b.count()) === 1, String(await b.count()))
  if (await b.count()) {
    if (CAPS) await page.screenshot({ path: `${CAPS}/1238-mensajes.png` })
    await b.click()
    await page.waitForTimeout(800)
    if (CAPS) await page.screenshot({ path: `${CAPS}/1238-mensajes-ayuda.png` })
    check('  …y abre la hoja de los pasos', await page.evaluate(() => Boolean(document.getElementById('cayDialogo')?.open)))
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `❌ ${fails} FALLA(S)` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)

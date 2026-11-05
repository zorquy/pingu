// Tanda 1241 — Cruces no vuelve a ofrecer lo que ya va en un trato (PINGU: «sale
// uno de los que está en curso… si está en curso, no debería salir»: Lauyks
// salía en Todos con «Ofrecer en venta» de la carta que ya le estaba vendiendo).
// Se prepara como la 1238 (una propuesta mía a Lucía con el Mew ex que busca, y
// una de Íker a mí) y se mira:
//   · Lucía, cuyo único cruce es el Mew ex que ya va en el trato, no sale;
//   · Dani, que también busca el Mew ex, tampoco: tu única copia ya está
//     prometida (la regla de la 1109);
//   · Íker sí (te da el Umbreon, que no va en vuestro trato);
//   · el número de «Todos» cuenta los que salen y «En curso» sigue con los dos;
//   · `sinLoDeTratosVivos` (pura): solo tratos vivos, por persona y por lado.
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
const DESEOS = [{ id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }, { id: 'd2', user_id: U(1), card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }, { id: 'd3', user_id: U(2), card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
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

console.log('── 1. Cruces, sin lo que ya va en un trato ──')
for (const movil of [false, true]) {
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', movil ? { movil: true } : { ancho: 1280 })
  // Se entra por el Mercado y se toca «Cruces», como la gente: abrir Cruces
  // directo pide la lista antes de que el doble tenga la sesión y la deja vacía.
  await ir(page, '/mi-coleccion.html?ver=mercado')
  await page.waitForTimeout(1500)
  await page.evaluate(() => [...document.querySelectorAll('[data-deseos-vista="cruces"]')].find((b) => b.getClientRects().length)?.click())
  await page.waitForTimeout(2500)
  const d = await page.evaluate(() => ({
    quien: [...document.querySelectorAll('#mcCambiosPanel [data-cruce]')].map((x) => x.dataset.cruce),
    todos: document.querySelector('[data-cruces-filtro="todos"] .mc-deseos-n')?.textContent.trim(),
    curso: document.querySelector('[data-cruces-filtro="curso"] .mc-deseos-n')?.textContent.trim(),
  }))
  const donde = movil ? 'móvil' : 'PC'
  check(`${donde}: Lucía (su Mew ex ya va en vuestro trato) no sale en Todos`, !d.quien.includes('user-1'), JSON.stringify(d))
  check(`${donde}: Dani tampoco: busca tu Mew ex, y tu única copia ya está prometida`, !d.quien.includes('user-2'), JSON.stringify(d))
  check(`${donde}: Íker sí, por el Umbreon que te da`, d.quien.includes('user-4'), JSON.stringify(d))
  check(`${donde}: «Todos» cuenta los que salen`, d.todos === String(new Set(d.quien).size), JSON.stringify(d))
  check(`${donde}: «En curso» sigue con los dos tratos`, d.curso === '2', JSON.stringify(d))
  check(`${donde}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. La regla, pura ──')
{
  const { ctx, page } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const r = await page.evaluate(async () => {
    const m = await import('/js/mi-coleccion/tablon.js')
    const tiene = [{ user_id: 'b', card_id: 'x' }, { user_id: 'b', card_id: 'y' }, { user_id: 'c', card_id: 'x' }]
    const busca = [{ user_id: 'b', card_id: 'mia', cambio: 2 }, { user_id: 'c', card_id: 'mia', cambio: 2 }]
    const vivo = [{ de: 'yo', para: 'b', estado: 'enviada', items: [{ quien: 'b', card_id: 'x' }, { quien: 'yo', card_id: 'mia' }] }]
    const [t1, b1] = m.sinLoDeTratosVivos(tiene, busca, vivo, 'yo')
    const [t2, b2] = m.sinLoDeTratosVivos(tiene, busca, [{ ...vivo[0], estado: 'rechazada' }], 'yo')
    const [t3] = m.sinLoDeTratosVivos(tiene, busca, [{ de: 'b', para: 'yo', estado: 'aceptada', items: [{ quien: 'yo', card_id: 'x' }] }], 'yo')
    const [, b4] = m.sinLoDeTratosVivos(tiene, busca.map((f) => ({ ...f, cambio: 1 })), vivo, 'yo')
    return { t1: t1.map((f) => f.user_id + f.card_id), b1: b1.map((f) => f.user_id + f.card_id), t2: t2.length, b2: b2.length, t3: t3.length, b4: b4.length }
  })
  check('con b en un trato vivo: se quitan su «x» y mi «mia» con él, y nada de c', JSON.stringify(r.t1) === '["by","cx"]' && JSON.stringify(r.b1) === '["cmia"]', JSON.stringify(r))
  check('un trato rechazado no quita nada', r.t2 === 3 && r.b2 === 2, JSON.stringify(r))
  check('lo que doy YO no quita lo que me da él (es otro lado)', r.t3 === 3, JSON.stringify(r))
  check('con una sola copia para cambio, ya prometida a b, tampoco se le ofrece a c', r.b4 === 0, JSON.stringify(r))
  await ctx.close()
}
await browser.close()
console.log(fails ? `❌ ${fails} FALLA(S)` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)

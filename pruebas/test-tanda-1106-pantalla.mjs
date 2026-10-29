// Tanda 1106 — el total de una venta o compra se escribe (PINGU: «que sea
// editable… si estoy vendiendo un lote, abaratarlo un poco, o redondear:
// sale 4,99 y digo 5 euros»).
//
// Lo que se mira:
//   · lo puro: repartir un total entre las cartas al céntimo y redondear;
//   · en «Le vendo» con un lote de tres: el total es un campo; poner 150 lo
//     reparte (cada carta con su Cardmarket tachado) y la suma es 150;
//     «Redondear a …» sale con un total con céntimos y lo deja en euros;
//   · lo que se manda lleva esos precios y ese total.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  linea('m2', 'admin-1', 'sv2-269', 'es', 1, 1), linea('m3', 'admin-1', 'sv8-238', 'es', 1, 1),
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
    window.__FAKE_FILAS__ = { user_direcciones: [['admin-1', 'Pingu Admin', 'Av. Libertad 3', '41002', 'Sevilla'], ['user-1', 'Lucía Pérez Gil', 'C/ Mayor 12, 3.º B', '28013', 'Madrid']].map(([user_id, nombre, calle, cp, ciudad]) => ({ user_id, nombre, calle, cp, ciudad })), ...(window.__FAKE_FILAS__ || {}) }
  }, { SETS, CARTAS, COLECCION, DESEOS, PERFILES, PRECIOS, sesion, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // A dónde se va al escribir o al registrarse, sin irse de verdad.
  await ctx.route(/\/(mensajes|auth)\.html/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fuera</title>' }))
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


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones', 'user_direcciones']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}








const OUT = process.env.PD_CAPS || ''
console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/cambio-propuesta-puro.js`)
  const r = m.repartirTotal([{ precio: 4.99 }, { precio: 12.4 }, { precio: 6 }], 20)
  check('20 € entre tres, en proporción y al céntimo', Math.round(r.reduce((a, b) => a + b, 0) * 100) === 2000 && r[1] > r[2] && r[2] > r[0], JSON.stringify(r))
  check('con varias copias, el total cuadra igual', (() => { const x = m.repartirTotal([{ precio: 1, cantidad: 3 }, { precio: 2, cantidad: 2 }], 10.01); return Math.round((x[0] * 3 + x[1] * 2) * 100) === 1001 })())
  check('sin precios, a partes iguales', JSON.stringify(m.repartirTotal([{ precio: null }, { precio: null }], 7)) === '[3.5,3.5]')
  check('redondear: 4,99 → 5, 0,30 → 1, 0 → 0', m.totalRedondo(4.99) === 5 && m.totalRedondo(0.3) === 1 && m.totalRedondo(0) === 0)
}

console.log('── 2. Un lote en «Le vendo» ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const { data } = await supabase.auth.getSession()
    const m = await import('/js/cambio-propuesta.js')
    m.abrirPropuesta({ sesion: data.session, otro: { id: 'user-1', display_name: 'Lucía' }, prefill: { modo: 'vendo', mias: [{ card_id: 'sv3pt5-151' }, { card_id: 'sv2-269' }, { card_id: 'sv8-238' }] } })
  })
  await page.waitForTimeout(2000)
  const total = page.locator('#cpTotal')
  const precios = () => page.$$eval('#cpDialogo [data-cp-precio]', (is) => is.map((i) => Number(i.value)))
  check('el total es un campo y vale lo de Cardmarket (38 + 42 + 84,90)', (await total.inputValue()) === '164.9', await total.inputValue())
  check('sale «Cambia el total y se reparte…»', await page.locator('#cpDialogo .cp-total-ayuda').isVisible())
  await total.fill('150')
  await total.dispatchEvent('change')
  await page.waitForTimeout(400)
  const p = await precios()
  check('150 € repartidos: cada carta baja en proporción y suman 150', Math.round(p.reduce((a, b) => a + b, 0) * 100) === 15000 && p[0] < 38 && p[2] < 84.9, JSON.stringify(p))
  check('cada carta enseña su Cardmarket tachado', (await page.locator('#cpDialogo .cp-precio-caja s').count()) === 3)
  check('el total dice 150 y el de Cardmarket tachado', (await total.inputValue()) === '150' && /164,90 € en Cardmarket/.test(await page.locator('#cpDialogo .cp-importe').innerText()))
  await total.fill('149.99')
  await total.dispatchEvent('change')
  await page.waitForTimeout(400)
  const redondear = page.locator('#cpDialogo [data-cp-redondear]')
  check('con céntimos sale «Redondear a 150,00 €»', /Redondear a 150,00 €/.test(await redondear.innerText().catch(() => '')))
  if (OUT) await page.screenshot({ path: `${OUT}/total-lote.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await redondear.click()
  await page.waitForTimeout(400)
  check('al tocarlo, 150 y el botón se va', (await total.inputValue()) === '150' && (await redondear.count()) === 0)
  // Una carta a mano: 4,99 → 5 en el campo de la carta, y el total la sigue.
  const campo = page.locator('#cpDialogo [data-cp-precio]').first()
  await campo.fill('40')
  await campo.dispatchEvent('change')
  await page.waitForTimeout(400)
  const q = await precios()
  check('tocar el precio de una carta mueve el total', Math.abs(Number(await total.inputValue()) - q.reduce((a, b) => a + b, 0)) < 0.005 && q[0] === 40, JSON.stringify(q))
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  const t = await page.evaluate(() => ({ o: window.__TABLAS__.trade_offers.at(-1), its: window.__TABLAS__.trade_offer_items }))
  const suma = t.its.filter((i) => i.oferta === t.o.id).reduce((a, i) => a + Number(i.precio) * i.cantidad, 0)
  check('lo que se manda: esos precios y ese total', Math.abs(Number(t.o.dinero) - suma) < 0.005 && Math.abs(Number(t.o.dinero) - q.reduce((a, b) => a + b, 0)) < 0.005, JSON.stringify({ dinero: t.o.dinero, suma }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

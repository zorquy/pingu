// Tanda 1098 — en una venta (das cartas y te pagan) el dinero sale donde
// toca, y cada uno confirma lo que le llega.
//
// PINGU: «le voy a dar unas cartas que hacen 20 € en total, no le doy cartas
// [él a mí] y marco que me paga… luego en el cambio no pone que él me debe
// nada». La propuesta guardaba bien el dinero, pero la tarjeta decía
// «Recibes · 0,00 € — Nada» y el dinero iba en una franja aparte. Lo que se
// mira:
//   · el editor: «Te da» lleva «Te paga 20,00 €» y su total, 20 €;
//   · «Tus cambios»: «Das 1 carta · recibes 20,00 €»; la tarjeta, «Recibes ·
//     20,00 €» con «20,00 € · Bizum» dentro y sin «Nada»;
//   · Lucía: «Das · 20,00 €» con el dinero dentro; al aceptar, «Carta
//     recibida»; y yo, «Dinero recibido»; al confirmarlo los dos, hecha.
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
    // Desde la 1102 (y la 1107) hacen falta la dirección y el Bizum o PayPal: cada uno tiene los suyos guardados.
    window.__FAKE_FILAS__ = { user_direcciones: ['admin-1', 'user-1', 'user-2', 'user-3', 'user-4'].map((u) => ({ user_id: u, nombre: `Persona ${u}`, calle: 'C/ Mayor 1', cp: '28013', ciudad: 'Madrid' })), user_cobros: ['admin-1', 'user-1', 'user-2', 'user-3', 'user-4'].map((u, i) => ({ user_id: u, bizum: `60011223${i}`, paypal: `${u}@pokedoc.es` })), ...(window.__FAKE_FILAS__ || {}) }
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


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones', 'trade_offer_cobros']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}


console.log('── 1. La propongo ──')
let tablas
{
  const { ctx, page, errores } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
  await page.waitForTimeout(1800)
  await page.locator('#cpDialogo .cp-lado').nth(1).locator('[data-cp-quitar]').first().click()
  await page.waitForTimeout(300)
  await page.click('#cpDialogo [data-cp-paga="otro"]')
  await page.fill('#cpDinero', '20')
  await page.locator('#cpDinero').dispatchEvent('change')
  await page.click('#cpDialogo [data-cp-como="bizum"]')
  await page.waitForTimeout(300)
  const suyo = (await page.locator('#cpDialogo .cp-lado').nth(1).innerText()).replace(/\s+/g, ' ')
  check('en el editor, «Te da» lleva el dinero y su total', /te da 20,00 €/i.test(suyo) && /Te paga 20,00 €/.test(suyo) && !/Todavía nada/.test(suyo), suyo)
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  const o = tablas.trade_offers[0]
  check('se guarda: 20 €, paga ella, por Bizum', o.dinero === 20 && o.dinero_paga === 'para' && o.dinero_como === 'bizum', JSON.stringify(o))
  await page.waitForTimeout(800)
  await page.locator('#mcMisCambios details').first().evaluate((d) => { d.open = true })
  const mis = (await page.locator('#mcMisCambios').innerText()).replace(/\s+/g, ' ')
  check('«Tus cambios»: «Das 1 carta · recibes 20,00 €»', /Das 1 carta · recibes 20,00 €/.test(mis), mis)
  const recibes = (await page.locator('#mcMisCambios .cp-t-lado').nth(1).innerText()).replace(/\s+/g, ' ')
  check('  …y en la tarjeta, «Recibes · 20,00 €» con el dinero dentro y sin «Nada»', /Recibes · 20,00 €/.test(recibes) && /20,00 € · Bizum/.test(recibes) && !/Nada/.test(recibes), recibes)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Lucía la acepta y confirma la carta ──')
{
  const conv = tablas.trade_offers[0].conversacion
  const { ctx, page, errores } = await abrirCon(tablas, 'user-1', { movil: true })
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  // Desde la 1100 el trato se sigue en Cruces → «En curso»; en Mensajes
  // queda una tira que lleva allí.
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const caja = page.locator('#mcMisCambios')
  const das = (await caja.locator('.cp-t-lado').first().innerText()).replace(/\s+/g, ' ')
  check('desde su lado: «Das · 20,00 €» con el dinero dentro', /Das · 20,00 €/.test(das) && /20,00 € · Bizum/.test(das) && !/Nada/.test(das), das)
  await caja.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1500)
  const boton = (await caja.locator('[data-cp-accion="lo-tengo"]').innerText()).trim()
  check('aceptada: su botón dice «Carta recibida»', boton === 'Carta recibida', boton)
  await caja.locator('[data-cp-accion="lo-tengo"]').click()
  await page.waitForTimeout(1200)
  tablas = await foto(page)
  check('  …y se apunta', Boolean(tablas.trade_offers[0].recibido_para_at))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Yo confirmo el dinero ──')
{
  const conv = tablas.trade_offers[0].conversacion
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', { movil: true })
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  // Desde la 1100 el trato se sigue en Cruces → «En curso»; en Mensajes
  // queda una tira que lleva allí.
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const caja = page.locator('#mcMisCambios')
  const boton = (await caja.locator('[data-cp-accion="lo-tengo"]').innerText()).trim()
  const quien = (await caja.locator('.cp-quien').innerText()).replace(/\s+/g, ' ')
  // Desde la 1099 va por correo y ella aceptó con el normal (2 €), que paga
  // quien compra: a mí me llegan 22 €.
  check('mi botón dice «Dinero recibido» (20 € y 2 € de envío), y ella ya confirmó su carta', boton === 'Dinero recibido' && /Lucía · 1 carta Carta recibida ✓/.test(quien) && /Tú · 22,00 € Pendiente/.test(quien), `${boton} | ${quien}`)
  await caja.locator('[data-cp-accion="lo-tengo"]').click()
  await page.waitForTimeout(600)
  await page.locator('#cpCerrar [data-r="si"]').click()
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  check('hecha: el Mew ex pasa a Lucía', tablas.trade_offers[0].estado === 'hecha' && tablas.user_collection.some((l) => l.user_id === 'user-1' && l.card_id === 'sv3pt5-151'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

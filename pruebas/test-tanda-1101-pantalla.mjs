// Tanda 1101 — el mensaje automático de un cambio, como una tarjeta (PINGU:
// «en vez de texto plano, algo más interactivo, con un botón de propuesta»).
//
// Lo que se mira:
//   · lo puro (`propuestaDe`): con el adjunto de la 1101 y, sin él, por el
//     texto de siempre; la contraoferta se distingue por su texto;
//   · en la conversación: «Propuesta de cambio» con «Ver propuesta» que lleva
//     a ese trato en «En curso», sin el texto plano debajo; al aceptarla,
//     «Propuesta aceptada»;
//   · sin la migración: el mensaje de texto se reconoce y sale igual de
//     tarjeta (el botón, a «En curso»).
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


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}





const OUT = process.env.PD_CAPS || ''
console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/mensajes-puro.js`)
  const a = m.propuestaDe({ body: 'Te he mandado una propuesta de cambio: doy 1 carta y recibo 0 cartas y me pagas 20,00 €.', adjuntos: [{ tipo: 'propuesta', oferta: 'o1', evento: 'cambio_propuesta' }] })
  check('con adjunto: título, texto y enlace al trato', a.titulo === 'Propuesta de cambio' && a.enlace === '/mi-coleccion?ver=cambios#oferta-o1' && /me pagas 20,00 €/.test(a.texto), JSON.stringify(a))
  const b = m.propuestaDe({ body: 'Te he mandado una propuesta de cambio: doy 1 carta y recibo 2 cartas. La tienes arriba de la conversación.', adjuntos: [] })
  check('sin adjunto (antes de la 1101): por el texto, sin «La tienes arriba»', b.titulo === 'Propuesta de cambio' && b.enlace === '/mi-coleccion?ver=cambios' && !/arriba/.test(b.texto), JSON.stringify(b))
  check('contraoferta, aceptada y hecha, por su texto', m.propuestaDe({ body: 'He cambiado la propuesta de cambio: doy 1 carta', adjuntos: [{ tipo: 'propuesta', oferta: 'x', evento: 'cambio_propuesta' }] }).titulo === 'Contraoferta' && m.propuestaDe({ body: 'He aceptado tu propuesta. Cuando te llegue…' }).titulo === 'Propuesta aceptada' && m.propuestaDe({ body: 'Cambio hecho: las cartas…' }).titulo === 'Cambio hecho')
  check('un mensaje normal no es una propuesta', m.propuestaDe({ body: 'Hola, ¿qué tal?' }) === null && m.propuestaDe({ body: 'He visto tu propuesta' }) === null)
}

for (const sin of [false, true]) {
  console.log(sin ? '── 3. Sin la migración ──' : '── 2. En la conversación ──')
  let tablas
  {
    const { ctx, page } = await abrir({ ancho: 1280, extra: { __SIN_1101__: sin } })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
    await page.waitForTimeout(1800)
    await page.click('#cpEnviar')
    await page.waitForTimeout(1500)
    tablas = await foto(page)
    await ctx.close()
  }
  const o = tablas.trade_offers[0]
  const { ctx, page, errores } = await abrirCon(tablas, 'user-1', { movil: true, extra: { __SIN_1101__: sin } })
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  await ir(page, `/mensajes.html?c=${o.conversacion}`)
  const tarjeta = page.locator('#threadMessages .msg-propuesta').first()
  const t = (await tarjeta.innerText().catch(() => '')).replace(/\s+/g, ' ')
  check('el mensaje es una tarjeta: «Propuesta de cambio», lo que lleva y «Ver propuesta»', /Propuesta de cambio/.test(t) && /doy 1 carta y recibo 1 carta/.test(t) && /Ver propuesta/.test(t), t)
  check('  …sin el texto plano debajo', (await page.locator('#threadMessages .msg-burbuja.con-propuesta p').count()) === 0)
  check(`  …y el botón lleva ${sin ? 'a «En curso»' : 'a ese trato en «En curso»'}`, (await tarjeta.locator('.msg-propuesta-ver').getAttribute('href')) === (sin ? '/mi-coleccion?ver=cambios' : `/mi-coleccion?ver=cambios#oferta-${o.id}`))
  if (!sin && OUT) await page.screenshot({ path: `${OUT}/msg-propuesta.jpg`, type: 'jpeg', quality: 72 })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
  if (!sin) {
    // Lucía la acepta: el mensaje nuevo es «Propuesta aceptada».
    const r = await abrirCon(tablas, 'user-1', { ancho: 1280 })
    await ir(r.page, '/mi-coleccion.html?ver=cambios')
    await r.page.locator('#mcMisCambios [data-cp-accion="aceptar"]').click()
    await r.page.waitForTimeout(1500)
    tablas = await foto(r.page)
    await r.ctx.close()
    const y = await abrirCon(tablas, 'admin-1', { movil: true })
    await y.page.route(/\/mensajes\.html/, (q) => q.continue())
    await ir(y.page, `/mensajes.html?c=${o.conversacion}`)
    const titulos = await y.page.locator('#threadMessages .msg-propuesta b').allInnerTexts()
    check('al aceptarla, la siguiente dice «Propuesta aceptada»', titulos.join('|') === 'Propuesta de cambio|Propuesta aceptada', titulos.join('|'))
    if (OUT) await y.page.screenshot({ path: `${OUT}/msg-aceptada.jpg`, type: 'jpeg', quality: 72 })
    await y.ctx.close()
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

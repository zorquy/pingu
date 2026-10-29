// Tanda 1100 — «En curso» en Cruces, la tira en Mensajes y los cruces con
// las cartas por su nombre (de «Cambios más claros», 2.ª vuelta).
//
// Lo que se mira:
//   · el cruce perfecto enseña cada carta con su nombre y su precio, y su
//     botón dice «Proponer cambio»; quien solo tiene lo que buscas, «Comprar»;
//   · «En curso»: con dos tratos, el que espera algo de ti va primero y
//     abierto, con su frase; llegar con `#oferta-<id>` abre ese;
//   · en Mensajes, la tira (y sin «Otra propuesta» con un trato vivo).
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




console.log('── 1. Los cruces ──')
{
  const { ctx, page, errores } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const lucia = page.locator('#mcCambiosPanel [data-cruce="user-1"]')
  const t = (await lucia.innerText()).replace(/\s+/g, ' ')
  check('el cruce perfecto: cada carta con su nombre y su precio', /Umbreon VMAX/.test(t) && /612,00 €/.test(t) && /Mew ex/.test(t) && /38,00 €/.test(t) && (await lucia.locator('.mc-cruce-nombre').count()) === 2, t)
  check('  …y «Proponer cambio»', /Proponer cambio/.test(await lucia.locator('[data-proponer]').innerText()))
  check('quien solo tiene lo que buscas: «Comprar»', (await page.locator('#mcCambiosPanel [data-cruce="user-4"] [data-proponer]').innerText()).trim() === 'Comprar')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. En curso ──')
let tablas
{
  // Dos propuestas: una mía a Lucía (espero) y una de Íker a mí (me toca).
  const { ctx, page } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
  await page.waitForTimeout(1800)
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  await ctx.close()
}
{
  const { ctx, page } = await abrirCon(tablas, 'user-4', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  // Íker me pide mi Mew ex (una compra suya: para mí, «Le vendes a Íker»).
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
{
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const lineas = page.locator('#mcMisCambios .cp-linea')
  const quien = await lineas.evaluateAll((ls) => ls.map((l) => ({ t: l.querySelector('summary b').textContent, abierta: l.open, frase: l.querySelector('.cp-linea-frase')?.textContent || '' })))
  check('«En curso · 2»: primero lo que te toca (Íker), abierto', /En curso · 2/.test(await page.locator('#mcMisCambios h2').innerText()) && quien[0]?.t === 'Le vendes a Íker' && quien[0].abierta && quien[1]?.t === 'Cambio con Lucía' && !quien[1].abierta, JSON.stringify(quien))
  check('  …cada uno con su frase', /Te toca/.test(quien[0].frase) && /Esperando a que Lucía/.test(quien[1].frase), JSON.stringify(quien))
  check('sin errores', errores.length === 0, errores.join(' | '))
  const deLucia = tablas.trade_offers.find((o) => o.para === 'user-1')
  // Con la página ya abierta, cambiar el `#` no recarga: lo escucha.
  await page.evaluate((id) => { location.hash = `oferta-${id}` }, deLucia.id)
  await page.waitForTimeout(400)
  check('con #oferta-<id> se abre ese (también con la página ya abierta)', await page.$eval(`[id="oferta-${deLucia.id}"]`, (d) => d.open))
  await ctx.close()
}

console.log('── 3. En Mensajes ──')
{
  const deLucia = tablas.trade_offers.find((o) => o.para === 'user-1')
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', { movil: true })
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  await ir(page, `/mensajes.html?c=${deLucia.conversacion}`)
  const caja = page.locator('#msgPropuestas')
  check('la tira, sin la tarjeta entera ni «Otra propuesta»', (await caja.locator('.cp-tira').count()) === 1 && (await caja.locator('.cp-tarjeta').count()) === 0 && (await caja.locator('[data-cp-nueva]').count()) === 0)
  check('  …y lleva a ese trato en «En curso»', (await caja.locator('.cp-tira').getAttribute('href')) === `/mi-coleccion?ver=cambios#oferta-${deLucia.id}`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

// Tanda 1269 — el trato en Mensajes y sin «Ya nos cambiamos».
//
// PINGU: «el botón de ya nos cambiamos creo que da pie a confusión… ¿es
// necesario?» y «me acaba de llegar una propuesta y no sé si se puede mejorar
// esto». Lo que se mira, con la conversación de un trato vivo:
//   · arriba, LA tarjeta de «En curso» (la misma de Cruces) con «Te toca» y
//     las cartas de cada lado; sin «Ya nos cambiamos» en ningún sitio;
//   · «Proponer cambio» y la caja de lo que os podéis cambiar no salen;
//   · tocarla abre su pop-up AQUÍ (sin irse a Cruces), con sus botones y su
//     «?»; y el «Ver» de la línea de la conversación abre el mismo;
//   · en la conversación, el mensaje del trato es una línea, no una tarjeta;
//   · al ponerse a leer (rueda) o a escribir, la tarjeta se encoge;
//   · sin trato vivo, nada arriba y «Proponer cambio» en la cabecera.
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


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}




console.log('── 0. Dos propuestas: una mía a Lucía y una de Íker a mí ──')
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

const conDe = (de) => tablas.trade_offers.find((o) => o.de === de)?.conversacion
for (const movil of [true, false]) {
  console.log(`── 1. Mensajes con Íker (me toca), ${movil ? 'móvil' : 'PC'} ──`)
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', movil ? { movil: true } : { ancho: 1280 })
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  await page.goto(`${BASE}/mensajes.html?c=${conDe('user-4')}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#msgPropuestas details.cp-trato', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  const tarjeta = page.locator('#msgPropuestas details.cp-trato')
  const t = (await tarjeta.innerText().catch(() => '')).replace(/\s+/g, ' ')
  check('arriba, la tarjeta del trato con «Te toca» y lo de cada lado', (await tarjeta.count()) === 1 && /Te toca/i.test(t) && /das/i.test(t) && /recibes/i.test(t), t)
  check('  …sin su cara ni su nombre (ya se sabe con quién)', !(await tarjeta.locator('.cp-trato-cab .mini-avatar').isVisible()))
  check('sin «Ya nos cambiamos» en ningún sitio', !(await page.locator('body').innerText()).includes('Ya nos cambiamos') && (await page.locator('[data-cambio]').count()) === 0)
  check('sin «Proponer cambio» ni la caja del cruce con un trato vivo', !(await page.locator('#msgProponer').isVisible()) && !(await page.locator('#msgCruce').isVisible()))
  const linea = page.locator('#threadMessages .msg-propuesta').first()
  check('en la conversación, el trato es una línea (no una tarjeta)', (await linea.count()) === 1 && (await linea.evaluate((x) => x.getBoundingClientRect().height)) <= 44, String(await linea.evaluate((x) => x.getBoundingClientRect().height).catch(() => '—')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1269-${movil ? 'movil' : 'pc'}.png` })
  // Tocar la tarjeta abre su pop-up aquí, con los botones de responder.
  await tarjeta.locator('summary').click()
  await page.waitForTimeout(500)
  const dlg = page.locator('#msgPropuestas dialog.cp-trato-dialogo[open]')
  check('tocarla abre su pop-up aquí mismo, con los botones y el «?»', (await dlg.count()) === 1 && (await dlg.locator('[data-cp-ayuda]').count()) === 1 && (await dlg.locator('.cp-t-acciones button').count()) >= 1 && page.url().includes('/mensajes'), page.url())
  if (CAPS) await page.screenshot({ path: `${CAPS}/1269-${movil ? 'movil' : 'pc'}-popup.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('  …y se cierra con Esc', (await dlg.count()) === 0)
  // El «Ver» de la línea abre el mismo pop-up.
  await linea.locator('[data-trato-ver]').click()
  await page.waitForTimeout(400)
  check('el «Ver» de la línea abre el mismo pop-up, sin irse', (await dlg.count()) === 1 && page.url().includes('/mensajes'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Al leer, se encoge.
  const alto = () => page.$eval('.msg-trato', (x) => Math.round(x.getBoundingClientRect().height))
  const antes = await alto()
  await page.locator('#msgScroll').hover().catch(() => {})
  await page.mouse.wheel(0, -200)
  await page.waitForTimeout(300)
  const despues = await alto()
  check('al ponerse a leer, la tarjeta se encoge a una tira', despues < antes && despues <= 96, `${antes} → ${despues}`)
  if (CAPS) await page.screenshot({ path: `${CAPS}/1269-${movil ? 'movil' : 'pc'}-encogida.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Sin trato vivo ──')
{
  const vacias = { ...tablas, trade_offers: tablas.trade_offers.map((o) => ({ ...o, estado: 'rechazada' })) }
  const { ctx, page, errores } = await abrirCon(vacias, 'admin-1', { movil: true })
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  await page.goto(`${BASE}/mensajes.html?c=${conDe('user-4')}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('nada arriba y «Proponer cambio» en la cabecera', (await page.locator('#msgPropuestas details.cp-trato').count()) === 0 && (await page.$eval('.msg-trato', (x) => getComputedStyle(x).display)) === 'none' && (await page.locator('#msgProponer').isVisible()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. La migración ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-1269-sin-cambio-a-mano.sql`, 'utf8')
  check('cambio_marcar ya no abre ni completa nada', /raise exception/.test(sql) && !/insert into/i.test(sql) && !/update public/i.test(sql))
  check('  …y nadie la puede llamar', ['public', 'anon', 'authenticated'].every((r) => new RegExp(`revoke execute on function public\\.cambio_marcar\\(uuid\\) from ${r};`).test(sql)))
  check('  …sin tablas temporales (631)', !/temp(orary)? table/i.test(sql))
  check('la web ya no tiene el botón', !existsSync(`${RAIZ}/js/cambio-boton.js`) && !/cambio-boton|marcarCambio/.test(readFileSync(`${RAIZ}/js/mensajes.js`, 'utf8') + readFileSync(`${RAIZ}/js/cambios-hechos.js`, 'utf8')))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

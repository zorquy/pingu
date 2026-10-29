// Tanda 1105 — los cambios hechos en el perfil y «¿Qué tal fue?» en el trato
// (PINGU: «dale» a lo recomendado).
//
// Lo que se mira:
//   · el sello «N cambios · todos bien» debajo del nombre, en el perfil de
//     otra persona y en el tuyo, que abre la pestaña Cambios;
//   · en tu perfil, «Tus últimos cambios» (con quién y cuándo) con «¿Qué tal
//     fue?» en los que no has valorado, y valorar funciona;
//   · en el de otra persona, esa lista no sale;
//   · un trato que se cierra pregunta «¿Qué tal fue?» en «En curso».
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


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones', 'user_direcciones', 'trade_confirmations']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}








const OUT = process.env.PD_CAPS || ''
const texto = (loc) => loc.textContent().then((t) => t.replace(/\s+/g, ' ')).catch(() => '')
const CONFS = [
  // Admin con Lucía (sin valorar) y con Dani (Dani dijo que fue bien).
  { id: 'c1', user_a: 'admin-1', user_b: 'user-1', hecho_a_at: '2026-10-20T10:00:00Z', hecho_b_at: '2026-10-20T11:00:00Z', valoracion_a: null, valoracion_b: null, created_at: '2026-10-20T10:00:00Z' },
  { id: 'c2', user_a: 'admin-1', user_b: 'user-2', hecho_a_at: '2026-10-12T10:00:00Z', hecho_b_at: '2026-10-12T11:00:00Z', valoracion_a: 'bien', valoracion_b: 'bien', created_at: '2026-10-12T10:00:00Z' },
]

console.log('── 2. El perfil de otra persona: el sello ──')
{
  const { ctx, page, errores } = await abrir({ movil: true, extra: { __FAKE_FILAS__: { trade_confirmations: CONFS } } })
  await ir(page, '/usuario.html?id=user-2')
  const sello = page.locator('#heroInfo .perfil-confianza')
  check('Dani: «1 cambio · todos bien», en un sello', /1 cambio · todos bien/.test(await texto(sello)))
  await sello.click()
  await page.waitForTimeout(500)
  check('al tocarlo, abre la pestaña Cambios', await page.locator('#ptab-cambios').evaluate((p) => p.classList.contains('active')))
  check('en su perfil no salen «Tus últimos cambios»', (await page.locator('.pc-hechos').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Tu perfil: el sello y tus últimos cambios ──')
{
  const { ctx, page, errores } = await abrir({ movil: true, extra: { __FAKE_FILAS__: { trade_confirmations: CONFS } } })
  await ir(page, '/perfil.html')
  check('tu sello: «2 cambios · 1 dijo que fue bien»', /2 cambios · 1 dijo que fue bien/.test(await texto(page.locator('#heroInfo .perfil-confianza'))))
  await page.locator('#heroInfo .perfil-confianza').click()
  await page.waitForTimeout(800)
  const hechos = page.locator('#perfilCambios .pc-hechos')
  const t = await texto(hechos)
  check('«Tus últimos cambios»: con Lucía (por valorar) y con Dani (fue bien)', /Con Lucía/.test(t) && /Con Dani/.test(t) && /Fue bien/.test(t) && (await hechos.locator('[data-cv-conf="c1"]').count()) === 1, t)
  if (OUT) await page.screenshot({ path: `${OUT}/perfil-hechos.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await hechos.locator('[data-cv-conf="c1"] [data-cv="bien"]').click()
  await page.waitForTimeout(800)
  const c1 = await page.evaluate(() => window.__TABLAS__.trade_confirmations.find((f) => f.id === 'c1'))
  check('valorar «Todo bien» lo apunta', c1.valoracion_a === 'bien' && /Gracias/.test(await texto(hechos)))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Un trato que se cierra pregunta «¿Qué tal fue?» ──')
{
  // Una venta en mano de Admin a Lucía, aceptada y con lo de los dos confirmado.
  let t
  {
    const { ctx, page } = await abrir({ ancho: 1280 })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
    await page.waitForTimeout(1800)
    await page.click('#cpDialogo [data-cp-envio="mano"]')
    await page.click('#cpEnviar')
    await page.waitForTimeout(1500)
    t = await foto(page)
    await ctx.close()
  }
  for (const [quien, accion] of [['user-1', 'aceptar'], ['user-1', 'lo-tengo'], ['admin-1', 'lo-tengo']]) {
    const { ctx, page } = await abrirCon(t, quien, { ancho: 1280 })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator(`#mcMisCambios [data-cp-accion="${accion}"]`).first().click()
    await page.waitForTimeout(600)
    const si = page.locator('#cpCerrar [data-r="si"]')
    if (await si.isVisible().catch(() => false)) await si.click()
    await page.waitForTimeout(1500)
    t = await foto(page)
    t.trade_confirmations = await page.evaluate(() => window.__TABLAS__.trade_confirmations || [])
    await ctx.close()
  }
  check('el trato está hecho y apuntado como cambio', t.trade_offers[0].estado === 'hecha' && t.trade_confirmations.length === 1, t.trade_offers[0].estado)
  const { ctx, page, errores } = await abrirCon(t, 'admin-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const linea = page.locator('#mcMisCambios details.cp-linea').first()
  check('«¿Qué tal fue con Lucía?», con el trato abierto', await linea.evaluate((d) => d.open) && /¿Qué tal fue con Lucía\?/.test(await texto(linea)))
  if (OUT) await page.screenshot({ path: `${OUT}/trato-valorar.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await linea.locator('[data-cv="bien"]').click()
  await page.waitForTimeout(800)
  const c = await page.evaluate(() => window.__TABLAS__.trade_confirmations[0])
  check('«Todo bien» se apunta en su cambio hecho', c.valoracion_a === 'bien' || c.valoracion_b === 'bien', JSON.stringify(c))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

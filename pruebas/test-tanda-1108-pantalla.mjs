// Tanda 1108 — el envío, automático con la tabla de Cardmarket (PINGU: «lo
// normal es ordinario, con un valor máximo de 25; más de 25, certificado y ya
// está… que te diga automáticamente qué tipo de envío escoger»).
//
// Lo que se mira:
//   · lo puro: el peso por cartas y la tarifa de Cardmarket (España → España);
//   · una venta de 38 €: certificado (Paq Ligero) 7,06 € en el editor y en el
//     botón; bajada a 20 €, ordinario 1,45 €;
//   · quien acepta ve «Por correo · Ordinario · 1,45 €» o «En mano», el total
//     se mueve con lo que elige, y la base guarda el ordinario a 1,45 €;
//   · un cambio: cada uno con el suyo («Tú mandas… · Admin te manda…») y el
//     número de seguimiento solo para quien manda certificado.
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


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones', 'user_direcciones', 'trade_offer_cobros', 'user_cobros']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}









const OUT = process.env.PD_CAPS || ''
const texto = (loc) => loc.textContent().then((t) => t.replace(/\s+/g, ' ')).catch(() => '')

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/cambio-propuesta-puro.js`)
  check('el peso: 4 cartas 20 g, 17 en 50, 40 en 100, 41 en 200', m.pesoDeCartas(4) === 20 && m.pesoDeCartas(5) === 50 && m.pesoDeCartas(17) === 50 && m.pesoDeCartas(40) === 100 && m.pesoDeCartas(41) === 200)
  const e = (v, c) => { const x = m.envioAutomatico(v, c); return `${x.tipo}:${x.precio}` }
  check('hasta 25 €: ordinaria a 1,45 / 2,25 / 4,20 según el peso', e(25, 1) === 'normal:1.45' && e(10, 30) === 'normal:2.25' && e(10, 120) === 'normal:4.2')
  check('más de 25 €: certificado (Paq Ligero 7,06 hasta 250 g)', e(25.01, 1) === 'certificado:7.06' && e(150, 3) === 'certificado:7.06')
  check('y por encima, con valor declarado o mensajería', e(180, 1) === 'certificado:26.65' && e(450, 1) === 'certificado:60.1' && e(900, 1) === 'certificado:125.95' && e(5000, 1) === 'certificado:150')
  check('barato pero pesado (más de 500 g): certificado', e(10, 300) === 'certificado:11.61')
  const envs = m.enviosDe([{ quien: 'a', precio: 38, cantidad: 1 }, { quien: 'b', precio: 4, cantidad: 2 }])
  check('un cambio: un envío por cada uno', envs.length === 2 && envs[0].tipo === 'certificado' && envs[1].tipo === 'normal')
}

console.log('── 2. Una venta: lo calcula solo ──')
let tablas
{
  const { ctx, page, errores } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
  await page.waitForTimeout(1800)
  await page.click('#cpDialogo [data-cp-modo="vendo"]')
  const ayuda = () => texto(page.locator('#cpDialogo .cp-envio .subtext').first())
  check('38 €: «Certificado · 7,06 € (… más de 25 €: Paq Ligero). Lo paga Lucía.»', /Certificado · 7,06 €/.test(await ayuda()) && /más de 25 €: Paq Ligero/.test(await ayuda()) && /Lo paga Lucía/.test(await ayuda()), await ayuda())
  check('el botón: «Ofrecer por 38,00 € + 7,06 € de envío»', /Ofrecer por 38,00 € \+ 7,06 € de envío/.test(await page.locator('#cpEnviar').innerText()))
  await page.locator('#cpTotal').fill('20')
  await page.locator('#cpTotal').dispatchEvent('change')
  await page.waitForTimeout(300)
  check('a 20 €: «Ordinario · 1,45 € (vale 20,00 €: carta ordinaria)»', /Ordinario · 1,45 €/.test(await ayuda()) && /carta ordinaria/.test(await ayuda()), await ayuda())
  if (OUT) await page.screenshot({ path: `${OUT}/envio-editor.jpg`, type: 'jpeg', quality: 72 })
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrirCon(tablas, 'user-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
  const chips = await tj.locator('[data-cp-envio-elegir]').allInnerTexts()
  check('quien acepta: «Por correo · Ordinario · 1,45 €» o «En mano»', chips.join('|') === 'Por correo · Ordinario · 1,45 €|En mano', chips.join('|'))
  const aceptar = tj.locator('[data-cp-accion="aceptar"]')
  check('«Aceptar · 21,45 €»', (await aceptar.innerText()).trim() === 'Aceptar · 21,45 €')
  await tj.locator('[data-cp-envio-elegir="mano"]').click()
  check('en mano: «Aceptar · 20,00 €»', (await aceptar.innerText()).trim() === 'Aceptar · 20,00 €')
  await tj.locator('[data-cp-envio-elegir="normal"]').click()
  if (OUT) await page.screenshot({ path: `${OUT}/envio-aceptar.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await aceptar.click()
  await page.waitForTimeout(1800)
  const o = (await foto(page)).trade_offers[0]
  check('la base guarda ordinario a 1,45 €', o.estado === 'aceptada' && o.envio_tipo === 'normal' && Number(o.envio_precio) === 1.45, JSON.stringify({ t: o.envio_tipo, p: o.envio_precio }))
  check('y la tarjeta: «Envío: Ordinario · 1,45 €, lo paga quien compra (tú)»', /Envío: Ordinario · 1,45 €, lo paga quien compra \(tú\)/.test(await texto(page.locator('#mcMisCambios .cp-tarjeta').first())))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Un cambio: cada uno el suyo ──')
{
  let t
  {
    const { ctx, page } = await abrir({ ancho: 1280 })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
    await page.waitForTimeout(1800)
    check('el editor: «Tú mandas certificado · 7,06 € · Lucía te manda certificado · 125,95 €»', /Tú mandas certificado · 7,06 € · Lucía te manda certificado · 125,95 €/.test(await texto(page.locator('#cpDialogo .cp-envio .subtext').first())), await texto(page.locator('#cpDialogo .cp-envio .subtext').first()))
    await page.click('#cpEnviar')
    await page.waitForTimeout(1500)
    t = await foto(page)
    await ctx.close()
  }
  {
    const { ctx, page } = await abrirCon(t, 'user-1', { ancho: 1280 })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
    check('Lucía: «Tú mandas certificado · 125,95 € · Admin te manda certificado · 7,06 €»', /Tú mandas certificado · 125,95 € · Admin te manda certificado · 7,06 €\. Cada uno paga lo que manda/.test(await texto(tj)))
    await tj.locator('[data-cp-accion="aceptar"]').click()
    await page.waitForTimeout(1800)
    t = await foto(page)
    check('aceptado: certificado, a 0 (cada uno el suyo)', t.trade_offers[0].envio_tipo === 'certificado' && Number(t.trade_offers[0].envio_precio) === 0)
    await ctx.close()
  }
  const { ctx, page, errores } = await abrirCon(t, 'admin-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const envia = page.locator('#mcMisCambios .cp-t-envia').first()
  check('Admin: «Envía a Lucía · certificado · 7,06 €» con el número de seguimiento', /Envía a Lucía · certificado · 7,06 €/.test(await texto(envia)) && (await envia.locator('[data-cp-seguimiento]').count()) === 1, await texto(envia))
  if (OUT) await page.screenshot({ path: `${OUT}/envio-cambio.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

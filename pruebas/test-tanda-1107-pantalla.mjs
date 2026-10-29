// Tanda 1107 — el Bizum o el PayPal de quien cobra, en el trato (PINGU: «si
// elijo Bizum, que yo también tenga el número metido, y si es PayPal, el
// email o el arroba de PayPal»).
//
// Lo que se mira:
//   · lo puro: validar, «600 11 22 33», quién cobra y el estado;
//   · Admin le vende a Lucía por Bizum con su Bizum guardado: va adjunto y
//     Lucía, al aceptar, ve «Págale 38,00 € por Bizum» con el número y Copiar;
//   · Admin le compra a Lucía por PayPal: Lucía lo pone al aceptar (sin él no
//     acepta), se le guarda, y Admin ve «Págale … por PayPal»;
//   · sin dato al aceptar (un cambio en el que cobra quien propone): «Pon tu
//     Bizum» y, al ponerlo, la tarjeta «Datos de pago» en Mensajes;
//   · Ajustes → Envío y pagos: guardar el Bizum y el PayPal;
//   · sin la migración, nada de esto y el trato sigue.
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
const COBRO_ADMIN = { user_cobros: [{ user_id: 'admin-1', bizum: '600112233', paypal: null }] }
// Admin propone en un modo, por un pago y en mano; devuelve las tablas.
async function proponer({ modo, como, extra = {} }) {
  const { ctx, page } = await abrir({ ancho: 1280, extra })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
  await page.waitForTimeout(1800)
  if (modo) await page.click(`#cpDialogo [data-cp-modo="${modo}"]`)
  if (modo === 'cambio') {
    // Sin lo de Lucía, la diferencia la paga ella: cobra quien propone.
    await page.locator('#cpDialogo .cp-lado').nth(1).locator('[data-cp-quitar]').first().click()
    await page.click('#cpDialogo [data-cp-paga="otro"]')
    await page.waitForTimeout(300)
  }
  await page.click(`#cpDialogo [data-cp-como="${como}"]`)
  await page.click('#cpDialogo [data-cp-envio="mano"]')
  const adjunto = await texto(page.locator('#cpDialogo .cp-adjuntar, #cpDialogo .cp-adjuntar-no').last())
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  const t = await foto(page)
  await ctx.close()
  return { t, adjunto }
}

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/cambio-propuesta-puro.js`)
  check('Bizum: limpio, y uno corto no vale', m.validarCobro('bizum', '600 11 22 33').dato === '600112233' && m.validarCobro('bizum', '12').error)
  check('PayPal: email, @usuario y paypal.me valen; una frase no', !m.validarCobro('paypal', 'a@b.es').error && !m.validarCobro('paypal', '@pingu').error && !m.validarCobro('paypal', 'paypal.me/pingu').error && m.validarCobro('paypal', 'hola que tal').error)
  check('«600 11 22 33»', m.datoBonito('bizum', '600112233') === '600 11 22 33' && m.datoBonito('bizum', '+34600112233') === '+34 600 11 22 33')
  const o = { estado: 'aceptada', de: 'a', para: 'b', dinero: 20, dinero_paga: 'para', dinero_como: 'bizum', items: [{ quien: 'a' }], cobros: {} }
  check('cobra quien no paga; le toca ponerlo y el otro espera', m.quienCobra(o) === 'a' && /pon tu Bizum para que Beto te pague/.test(m.estadoDe(o, 'a', 'Beto').frase) && m.estadoDe(o, 'b', 'Ana').texto === 'Falta su Bizum')
  check('en mano, o sin saberse (null), no se pide', !m.faltaCobro({ ...o, dinero_como: 'mano' }, 'a') && !m.faltaCobro({ ...o, cobros: null }, 'a'))
}

console.log('── 2. Le vende por Bizum, con el suyo guardado ──')
{
  const { t, adjunto } = await proponer({ modo: 'vendo', como: 'bizum', extra: { __FAKE_FILAS__: COBRO_ADMIN } })
  check('«Adjuntar mi Bizum 600 11 22 33»', /Adjuntar mi Bizum/.test(adjunto) && /600 11 22 33/.test(adjunto), adjunto)
  check('va con la propuesta', t.trade_offer_cobros.length === 1 && t.trade_offer_cobros[0].dato === '600112233')
  const { ctx, page, errores } = await abrirCon(t, 'user-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
  check('antes de aceptar, Lucía no lo ve', !/600 11 22 33/.test(await texto(tj)))
  await tj.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1800)
  const paga = page.locator('#mcMisCambios .cp-t-paga').first()
  const tp = await texto(paga)
  check('aceptada: «Págale 38,00 € por Bizum», el número y Copiar', /Págale 38,00 € por Bizum/.test(tp) && /600 11 22 33/.test(tp) && (await paga.locator('[data-cp-copiar="600112233"]').count()) === 1, tp)
  if (OUT) await page.screenshot({ path: `${OUT}/cobro-paga.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Le compra por PayPal: Lucía lo pone al aceptar ──')
{
  const { t, adjunto } = await proponer({ modo: 'compro', como: 'paypal' })
  check('quien paga no adjunta nada', adjunto === '' || !/Adjuntar/.test(adjunto), adjunto)
  const { ctx, page, errores } = await abrirCon(t, 'user-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
  const caja = tj.locator('[data-cp-cobro-aceptar]')
  check('«¿A qué PayPal te paga?» con su campo', /¿A qué PayPal te paga\?/.test(await texto(caja)) && (await caja.locator('[data-cobro]').count()) === 1)
  await tj.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(600)
  check('vacío no acepta y lo dice', /Pon el email o el usuario de PayPal/.test(await texto(caja.locator('.cp-dir-error'))) && (await foto(page)).trade_offers[0].estado === 'enviada')
  await caja.locator('[data-cobro]').fill('@lucia_tcg')
  if (OUT) await page.screenshot({ path: `${OUT}/cobro-aceptar.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await tj.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1800)
  const t2 = await page.evaluate(() => ({ o: window.__TABLAS__.trade_offers[0], c: window.__TABLAS__.trade_offer_cobros, u: window.__TABLAS__.user_cobros || [] }))
  check('aceptada, con su PayPal en el trato y guardado', t2.o.estado === 'aceptada' && t2.c.some((c) => c.quien === 'user-1' && c.dato === '@lucia_tcg') && t2.u.some((u) => u.user_id === 'user-1' && u.paypal === '@lucia_tcg'), JSON.stringify(t2.u))
  check('y ella ve «Admin te paga por PayPal: @lucia_tcg»', /te paga por PayPal: @lucia_tcg/.test(await texto(page.locator('#mcMisCambios .cp-tarjeta').first())))
  check('sin errores', errores.length === 0, errores.join(' | '))
  const tablas = await foto(page)
  await ctx.close()
  const a = await abrirCon(tablas, 'admin-1', { ancho: 1280 })
  await ir(a.page, '/mi-coleccion.html?ver=cambios')
  check('Admin ve «Págale 612,00 € por PayPal» con @lucia_tcg', /Págale 612,00 € por PayPal/.test(await texto(a.page.locator('#mcMisCambios .cp-t-paga').first())) && /@lucia_tcg/.test(await texto(a.page.locator('#mcMisCambios .cp-t-paga').first())))
  await a.ctx.close()
}

console.log('── 4. Un cambio en el que cobra quien propone, sin dato guardado ──')
{
  const { t, adjunto } = await proponer({ modo: 'cambio', como: 'bizum' })
  check('«Cuando acepte, te pediremos tu Bizum»', /te pediremos tu Bizum/.test(adjunto), adjunto)
  let t4
  {
    const { ctx, page } = await abrirCon(t, 'user-1', { ancho: 1280 })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator('#mcMisCambios [data-cp-accion="aceptar"]').first().click()
    await page.waitForTimeout(1800)
    t4 = await foto(page)
    check('Lucía (paga) espera: «todavía no ha puesto su Bizum»', /todavía no ha puesto su Bizum/.test(await texto(page.locator('#mcMisCambios .cp-tarjeta').first())))
    await ctx.close()
  }
  const { ctx, page, errores } = await abrirCon(t4, 'admin-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const linea = page.locator('#mcMisCambios details.cp-linea').first()
  check('a Admin le toca: «pon tu Bizum para que Lucía te pague»', await linea.evaluate((d) => d.open) && /pon tu Bizum para que Lucía te pague/.test(await texto(linea)))
  const caja = linea.locator('[data-cp-cobro-poner]')
  await caja.locator('[data-cobro]').fill('600 99 88 77')
  await caja.locator('[data-cp-accion="cobro"]').click()
  await page.waitForTimeout(1800)
  const t5 = await foto(page)
  check('puesto, y a Lucía le llega «Ya tienes mi Bizum para pagarme.»', t5.trade_offer_cobros.some((c) => c.quien === 'admin-1' && c.dato === '600998877') && t5.private_messages.at(-1).adjuntos[0].evento === 'cambio_cobro')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Ajustes → Envío y pagos ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await ir(page, '/ajustes.html?ver=direccion')
  check('el apartado se llama «Envío y pagos»', /Envío y pagos/.test(await texto(page.locator('#ajLista a[data-ver="direccion"]'))))
  await page.locator('#ajCobroForm [data-cobro-ajuste="bizum"]').fill('600 11 22 33')
  await page.locator('#ajCobroForm [data-cobro-ajuste="paypal"]').fill('no vale esto')
  await page.click('#ajCobroForm button[type="submit"]')
  await page.waitForTimeout(500)
  check('un PayPal que no vale no se guarda y lo dice', /PayPal/.test(await texto(page.locator('#ajCobroError'))) && !(await page.evaluate(() => (window.__TABLAS__.user_cobros || []).length)))
  await page.locator('#ajCobroForm [data-cobro-ajuste="paypal"]').fill('pingu@pokedoc.es')
  if (OUT) await page.screenshot({ path: `${OUT}/cobro-ajustes.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await page.click('#ajCobroForm button[type="submit"]')
  await page.waitForTimeout(800)
  const u = await page.evaluate(() => window.__TABLAS__.user_cobros || [])
  check('guardados: el Bizum limpio y el PayPal', u.length === 1 && u[0].bizum === '600112233' && u[0].paypal === 'pingu@pokedoc.es', JSON.stringify(u))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. Sin la migración ──')
{
  const SIN = { __SIN_1107__: true, __SIN_TABLAS__: ['user_cobros'] }
  const { t, adjunto } = await proponer({ modo: 'vendo', como: 'bizum', extra: SIN })
  check('el editor no habla del Bizum', adjunto === '' || !/Bizum/.test(adjunto), adjunto)
  const { ctx, page, errores } = await abrirCon(t, 'user-1', { ancho: 1280, extra: SIN })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.locator('#mcMisCambios [data-cp-accion="aceptar"]').first().click()
  await page.waitForTimeout(1500)
  check('aceptar funciona como antes, sin «Págale»', (await foto(page)).trade_offers[0].estado === 'aceptada' && (await page.locator('.cp-t-paga').count()) === 0)
  await ir(page, '/ajustes.html?ver=direccion')
  check('Ajustes dice que falta la migración 1107', /falta ejecutar supabase-migration-1107/.test(await texto(page.locator('#ajCobro'))))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

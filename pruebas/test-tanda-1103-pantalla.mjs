// Tanda 1103 — «Ya lo he enviado» con el número de seguimiento (PINGU: «si es
// un envío certificado, deberíamos poder poner el número de seguimiento»).
//
// Lo que se mira:
//   · lo puro: a quién le falta mandar, «En camino» y el paso «Enviado»;
//   · un cambio por certificado: a los dos les toca mandarlo; Lucía pone el
//     número y lo da por enviado; Admin lo ve (con Copiar) y a él le llega la
//     tarjeta «Enviado» en Mensajes; cuando Admin manda lo suyo, Lucía lo ve
//     «En camino»;
//   · por correo normal no se pide número;
//   · sin la migración, nada de esto y el trato sigue como antes.
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


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones', 'user_direcciones']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}







const OUT = process.env.PD_CAPS || ''
const texto = (loc) => loc.textContent().then((t) => t.replace(/\s+/g, ' ')).catch(() => '')
async function proponerYAceptar(envio, extra = {}) {
  let t
  {
    const { ctx, page } = await abrir({ ancho: 1280, extra })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
    await page.waitForTimeout(1800)
    await page.click('#cpEnviar')
    await page.waitForTimeout(1500)
    t = await foto(page)
    await ctx.close()
  }
  const { ctx, page } = await abrirCon(t, 'user-1', { ancho: 1280, extra })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
  await tj.locator(`[data-cp-envio-elegir="${envio}"]`).click()
  await tj.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1800)
  t = await foto(page)
  await ctx.close()
  return t
}

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/cambio-propuesta-puro.js`)
  const o = { estado: 'aceptada', de: 'a', para: 'b', envio: 'correo', envio_tipo: 'certificado', items: [{ quien: 'a' }, { quien: 'b' }], direcciones: { a: {}, b: {} }, enviado_de_at: null, enviado_para_at: null, recibido_de_at: null, recibido_para_at: null }
  check('a los dos les falta mandar: «Te toca: mándaselo»', m.faltaMandar(o, 'a') && m.faltaMandar(o, 'b') && /mándaselo a Beto/.test(m.estadoDe(o, 'a', 'Beto').frase))
  check('los pasos: Dirección hecha, va por Enviado', m.pasosDe(o).nombres.join() === 'Propuesta,Aceptada,Dirección,Enviado,Recibido,Hecho' && m.pasosDe(o).paso === 3)
  const e = { ...o, enviado_de_at: 'x', enviado_para_at: 'y', seguimiento_de: 'PK1' }
  check('enviado por los dos: «En camino» con el número, y el paso «Enviado»', m.estadoDe(e, 'b', 'Ana').texto === 'En camino' && /seguimiento PK1/.test(m.estadoDe(e, 'b', 'Ana').frase) && m.pasosDe(e).paso === 4)
  check('si ya le llegó, no le falta mandar aunque no lo dijera', !m.faltaMandar({ ...o, recibido_para_at: 'z' }, 'a'))
  check('sin la columna (sin la migración) no se sabe: no falta', !m.faltaMandar((({ enviado_de_at, enviado_para_at, ...r }) => r)(o), 'a'))
}

console.log('── 2. Por certificado, con el número ──')
let tablas = await proponerYAceptar('certificado')
check('aceptado por certificado, con las dos direcciones', tablas.trade_offers[0].estado === 'aceptada' && tablas.trade_offers[0].envio_tipo === 'certificado' && tablas.trade_offer_direcciones.length === 2, JSON.stringify(tablas.trade_offer_direcciones.map((d) => d.quien)))
{
  const { ctx, page, errores } = await abrirCon(tablas, 'user-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const linea = page.locator('#mcMisCambios details.cp-linea').first()
  check('a Lucía le toca: «mándaselo y pulsa Ya lo he enviado»', await linea.evaluate((d) => d.open) && /mándaselo a Admin y pulsa «Ya lo he enviado»/.test(await texto(linea)))
  const envia = linea.locator('.cp-t-envia')
  check('debajo de la dirección, el número y el botón', (await envia.locator('[data-cp-seguimiento]').count()) === 1 && (await envia.locator('[data-cp-accion="enviado"]').count()) === 1)
  await envia.locator('[data-cp-seguimiento]').fill('  PK123456789ES ')
  if (OUT) await page.screenshot({ path: `${OUT}/env-poner.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await envia.locator('[data-cp-accion="enviado"]').click()
  await page.waitForTimeout(1800)
  tablas = await foto(page)
  const o = tablas.trade_offers[0]
  check('apuntado, con el número limpio', o.enviado_para_at && o.seguimiento_para === 'PK123456789ES', JSON.stringify({ e: o.enviado_para_at, s: o.seguimiento_para }))
  const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
  check('ahora dice «Enviado · seguimiento PK123456789ES» y no el botón', /Enviado · seguimiento PK123456789ES/.test(await texto(tj)) && (await tj.locator('[data-cp-accion="enviado"]').count()) === 0)
  check('el último mensaje es «Te lo he mandado por certificado. Seguimiento: …»', tablas.private_messages.at(-1).body === 'Te lo he mandado por certificado. Seguimiento: PK123456789ES.' && tablas.private_messages.at(-1).adjuntos[0].evento === 'cambio_enviado')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
  const t = await texto(tj)
  check('Admin ve que Lucía se lo ha enviado, con el número y Copiar', /Lucía te lo ha enviado a Av\. Libertad 3 · 41002 Sevilla\. Seguimiento: PK123456789ES/.test(t) && (await tj.locator('.cp-t-enviado [data-cp-copiar="PK123456789ES"]').count()) === 1, t)
  check('y a él todavía le toca mandar lo suyo', /mándaselo a Lucía/.test(await texto(page.locator('#mcMisCambios details.cp-linea').first())))
  if (OUT) await page.screenshot({ path: `${OUT}/env-recibe.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await tj.locator('[data-cp-accion="enviado"]').click()
  await page.waitForTimeout(1800)
  tablas = await foto(page)
  check('Admin lo manda sin número: vale', tablas.trade_offers[0].enviado_de_at && tablas.trade_offers[0].seguimiento_de == null)
  check('los pasos: «Enviado»', (await page.locator('#mcMisCambios .cp-pasos li.ahora').first().innerText()) === 'Enviado')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const o = tablas.trade_offers[0]
  const { ctx, page } = await abrirCon(tablas, 'user-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  check('Lucía lo ve «En camino»', /En camino/.test(await texto(page.locator('#mcMisCambios details.cp-linea').first())))
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  await ir(page, `/mensajes.html?c=${o.conversacion}`)
  const ultima = page.locator('#threadMessages .msg-propuesta').last()
  check('en Mensajes, la tarjeta «Enviado»', (await ultima.locator('b').innerText()) === 'Enviado' && /por certificado/.test(await texto(ultima)))
  if (OUT) await page.screenshot({ path: `${OUT}/env-mensaje.jpg`, type: 'jpeg', quality: 72 })
  await ctx.close()
}

console.log('── 3. Por correo normal, sin número ──')
{
  const t = await proponerYAceptar('normal')
  const { ctx, page } = await abrirCon(t, 'user-1', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const envia = page.locator('#mcMisCambios .cp-t-envia').first()
  check('«Ya lo he enviado» sin campo de número', (await envia.locator('[data-cp-accion="enviado"]').count()) === 1 && (await envia.locator('[data-cp-seguimiento]').count()) === 0)
  await ctx.close()
}

console.log('── 4. Sin la migración ──')
{
  const t = await proponerYAceptar('certificado', { __SIN_1103__: true })
  const { ctx, page, errores } = await abrirCon(t, 'user-1', { ancho: 1280, extra: { __SIN_1103__: true } })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
  check('sin «Ya lo he enviado» y sin el paso «Enviado»', (await tj.locator('[data-cp-accion="enviado"]').count()) === 0 && !(await tj.locator('.cp-pasos').innerText()).includes('Enviado'))
  check('pero la dirección sigue ahí', /Envía a Admin/.test(await texto(tj)))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

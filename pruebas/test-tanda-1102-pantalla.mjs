// Tanda 1102 — la dirección en los cambios por correo (PINGU: «que alguien
// cuando acepta el envío también pueda meter su dirección… en el caso de
// cambio, que los dos»).
//
// Lo que se mira:
//   · lo puro: validar, quién la necesita, el estado y los pasos;
//   · Admin propone por correo con su dirección guardada: va adjunta;
//   · Lucía acepta: sin dirección no se puede; con ella (y «Guardarla»),
//     se acepta, queda en el trato y en sus Ajustes; ve «Envía a Admin»;
//   · Admin ve «Envía a Lucía» con Copiar;
//   · sin dirección guardada, Admin la pone después y a Lucía le llega
//     «Dirección lista»; en mano no se pide;
//   · Ajustes → Dirección de envío: guardar y borrar;
//   · sin la migración: nada de dirección y aceptar sigue funcionando.
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


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones', 'user_direcciones']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}






const OUT = process.env.PD_CAPS || ''
const DIR_ADMIN = { user_id: 'admin-1', nombre: 'Pingu Admin', calle: 'Av. de la Constitución 4, 1.º', cp: '41001', ciudad: 'Sevilla', provincia: null, telefono: null }
const texto = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, ' ')).catch(() => '')

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/cambio-propuesta-puro.js`)
  const v = m.validarDireccion({ nombre: ' Lucía ', calle: 'C/ Mayor 12', cp: '28013', ciudad: '' })
  check('validar: limpia y dice lo que falta', v.dir.nombre === 'Lucía' && v.error === 'Falta ciudad.', JSON.stringify(v))
  const o = { estado: 'aceptada', de: 'a', para: 'b', envio: 'correo', envio_tipo: 'normal', items: [{ quien: 'a' }, { quien: 'b' }], direcciones: { a: { calle: 'x' } } }
  check('cambio por correo: los dos la necesitan; falta la de b', m.necesitaDireccion(o, 'a') && m.necesitaDireccion(o, 'b') && !m.faltaDireccion(o, 'a') && m.faltaDireccion(o, 'b'))
  check('a b le toca ponerla; a espera', /pon tu dirección/.test(m.estadoDe(o, 'b', 'Ana').frase) && m.estadoDe(o, 'a', 'Beto').texto === 'Falta su dirección')
  check('los pasos llevan «Dirección» y va por ella', m.pasosDe(o).nombres.join() === 'Propuesta,Aceptada,Dirección,Recibido,Hecho' && m.pasosDe(o).paso === 2)
  check('en mano, sin direcciones sabidas o solo dinero: no se pide', !m.necesitaDireccion({ ...o, envio_tipo: 'mano' }, 'a') && !m.faltaDireccion({ ...o, direcciones: null }, 'b') && !m.necesitaDireccion({ ...o, items: [{ quien: 'a' }] }, 'a'))
}

console.log('── 2. Admin propone con su dirección guardada ──')
let tablas
{
  const { ctx, page, errores } = await abrir({ ancho: 1280, extra: { __FAKE_FILAS__: { user_direcciones: [DIR_ADMIN] } } })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
  await page.waitForTimeout(1800)
  const adj = page.locator('#cpDialogo [data-cp-adjuntar]')
  check('«Adjuntar mi dirección», marcado y con la línea de la guardada', (await adj.isChecked().catch(() => false)) && /Constitución 4, 1\.º · 41001 Sevilla/.test(await texto(page.locator('#cpDialogo .cp-adjuntar'))))
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  const d = tablas.trade_offer_direcciones
  check('va con la propuesta (la de Admin, en el trato)', d.length === 1 && d[0].quien === 'admin-1' && d[0].cp === '41001', JSON.stringify(d))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Lucía acepta poniendo la suya ──')
{
  const { ctx, page, errores } = await abrirCon(tablas, 'user-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const t = page.locator('#mcMisCambios .cp-tarjeta').first()
  const caja = t.locator('[data-cp-dir-aceptar]')
  check('«¿A dónde te lo manda?» con el formulario (no tiene guardada)', await caja.isVisible() && (await caja.locator('[data-dir="nombre"]').count()) === 1)
  check('la de Admin no la ve todavía', !/Constitución/.test(await texto(t)))
  await t.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(600)
  check('sin dirección no acepta: lo dice ahí mismo', /Falta nombre y apellidos/.test(await texto(caja.locator('.cp-dir-error'))) && (await foto(page)).trade_offers[0].estado === 'enviada')
  await t.locator('[data-cp-envio-elegir="mano"]').click()
  check('en mano, la dirección se esconde', await caja.isHidden())
  await t.locator('[data-cp-envio-elegir="certificado"]').click()
  for (const [k, v] of [['nombre', 'Lucía Pérez Gil'], ['calle', 'C/ Mayor 12, 3.º B'], ['cp', '28013'], ['ciudad', 'Madrid']]) await caja.locator(`[data-dir="${k}"]`).fill(v)
  if (OUT) await page.screenshot({ path: `${OUT}/dir-aceptar.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await t.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1800)
  tablas = await foto(page)
  const o = tablas.trade_offers[0]
  check('aceptada, por certificado', o.estado === 'aceptada' && o.envio_tipo === 'certificado', o.estado)
  check('su dirección, en el trato y guardada en su cuenta', tablas.trade_offer_direcciones.some((d) => d.quien === 'user-1' && d.ciudad === 'Madrid') && tablas.user_direcciones.some((d) => d.user_id === 'user-1' && d.cp === '28013'))
  const t2 = page.locator('#mcMisCambios .cp-tarjeta').first()
  const envia = await texto(t2.locator('.cp-t-envia'))
  check('ve «Envía a Admin · certificado» con la de Admin y Copiar', /Envía a Admin · certificado/.test(envia) && /Pingu Admin/.test(envia) && /41001 Sevilla/.test(envia) && /Copiar/.test(envia), envia)
  check('y «Te lo manda a» con la suya', /Te lo manda a: C\/ Mayor 12, 3\.º B · 28013 Madrid/.test(await texto(t2)))
  check('los pasos: Dirección hecha', (await t2.locator('.cp-pasos li.ahora').innerText()) === 'Dirección')
  if (OUT) await page.screenshot({ path: `${OUT}/dir-envia.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrirCon(tablas, 'admin-1', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const envia = await texto(page.locator('#mcMisCambios .cp-t-envia').first())
  check('Admin ve «Envía a Lucía» con su dirección', /Envía a Lucía/.test(envia) && /Lucía Pérez Gil/.test(envia) && /28013 Madrid/.test(envia), envia)
  await ctx.close()
}

console.log('── 4. Sin guardada: Admin la pone después ──')
{
  let t4
  {
    const { ctx, page } = await abrir({ ancho: 1280 })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
    await page.waitForTimeout(1800)
    check('sin guardada: «te pediremos tu dirección»', /te pediremos tu dirección/.test(await texto(page.locator('#cpDialogo .cp-envio'))))
    await page.click('#cpEnviar')
    await page.waitForTimeout(1500)
    t4 = await foto(page)
    await ctx.close()
  }
  {
    const { ctx, page } = await abrirCon({ ...t4, user_direcciones: [{ ...DIR_ADMIN, user_id: 'user-1', nombre: 'Lucía Pérez Gil', calle: 'C/ Mayor 12', cp: '28013', ciudad: 'Madrid' }] }, 'user-1', { ancho: 1280 })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    const t = page.locator('#mcMisCambios .cp-tarjeta').first()
    check('Lucía con guardada: sale puesta, con «Cambiar»', /C\/ Mayor 12/.test(await texto(t.locator('.cp-dir-guardada'))) && await t.locator('.cp-dir-form').isHidden())
    await t.locator('[data-cp-accion="aceptar"]').click()
    await page.waitForTimeout(1800)
    t4 = await foto(page)
    const t2 = page.locator('#mcMisCambios .cp-tarjeta').first()
    check('aceptada; y a Admin le falta: «todavía no ha puesto su dirección»', t4.trade_offers.find((o) => o.estado === 'aceptada') && /todavía no ha puesto su dirección/.test(await t2.textContent()), t4.trade_offers.map((o) => o.estado).join())
    await ctx.close()
  }
  {
    const { ctx, page, errores } = await abrirCon(t4, 'admin-1', { movil: true })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    const linea = page.locator('#mcMisCambios details.cp-linea').first()
    check('a Admin le toca: abierta y con la frase', await linea.evaluate((d) => d.open) && /pon tu dirección para que Lucía te lo envíe/.test(await texto(linea)))
    const caja = linea.locator('[data-cp-dir-poner]')
    for (const [k, v] of [['nombre', 'Pingu Admin'], ['calle', 'Av. Libertad 3'], ['cp', '41002'], ['ciudad', 'Sevilla']]) await caja.locator(`[data-dir="${k}"]`).fill(v)
    if (OUT) await page.screenshot({ path: `${OUT}/dir-falta.jpg`, type: 'jpeg', quality: 72, fullPage: true })
    await caja.locator('[data-cp-accion="direccion"]').click()
    await page.waitForTimeout(1800)
    t4 = await foto(page)
    check('puesta en el trato', t4.trade_offer_direcciones.some((d) => d.quien === 'admin-1' && d.calle === 'Av. Libertad 3'))
    const ultimo = t4.private_messages.at(-1)
    check('y a Lucía le llega «Dirección lista»', ultimo.sender_id === 'admin-1' && ultimo.adjuntos?.[0]?.evento === 'cambio_direccion', JSON.stringify(ultimo))
    check('sin errores', errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  {
    const o = t4.trade_offers.find((x) => x.estado === 'aceptada')
    const { ctx, page } = await abrirCon(t4, 'user-1', { movil: true })
    await page.route(/\/mensajes\.html/, (r) => r.continue())
    await ir(page, `/mensajes.html?c=${o.conversacion}`)
    const titulos = await page.locator('#threadMessages .msg-propuesta b').allInnerTexts()
    check('en Mensajes, la tarjeta «Dirección lista»', titulos.at(-1) === 'Dirección lista', titulos.join('|'))
    await ctx.close()
  }
}

console.log('── 5. Ajustes → Dirección de envío ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await ir(page, '/ajustes.html?ver=direccion')
  check('el apartado está en la lista', (await page.locator('#ajLista a[data-ver="direccion"]').count()) === 1)
  await page.click('#ajDirForm button[type="submit"]')
  await page.waitForTimeout(400)
  check('vacía no se guarda: dice lo que falta', /Falta nombre y apellidos/.test(await texto(page.locator('#ajDirError'))))
  for (const [k, v] of [['nombre', 'Pingu Admin'], ['calle', 'Av. Libertad 3'], ['cp', '41002'], ['ciudad', 'Sevilla'], ['telefono', '600111222']]) await page.locator(`#ajDirForm [data-dir="${k}"]`).fill(v)
  if (OUT) await page.screenshot({ path: `${OUT}/dir-ajustes.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await page.click('#ajDirForm button[type="submit"]')
  await page.waitForTimeout(800)
  let filas = await page.evaluate(() => window.__TABLAS__.user_direcciones || [])
  check('guardada', filas.length === 1 && filas[0].telefono === '600111222' && filas[0].user_id === 'admin-1', JSON.stringify(filas))
  await page.click('#ajDirBorrar')
  check('borrar pide otra pulsación', /otra vez/.test(await page.locator('#ajDirBorrar').innerText()))
  await page.click('#ajDirBorrar')
  await page.waitForTimeout(800)
  filas = await page.evaluate(() => window.__TABLAS__.user_direcciones || [])
  check('borrada', filas.length === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. Sin la migración ──')
{
  const SIN = { __SIN_1102__: true, __SIN_TABLAS__: ['user_direcciones'] }
  let t6
  {
    const { ctx, page } = await abrir({ ancho: 1280, extra: SIN })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
    await page.waitForTimeout(1800)
    check('el editor no habla de la dirección', (await page.locator('#cpDialogo .cp-adjuntar, #cpDialogo .cp-adjuntar-no').count()) === 0)
    await page.click('#cpEnviar')
    await page.waitForTimeout(1500)
    t6 = await foto(page)
    await ctx.close()
  }
  const { ctx, page, errores } = await abrirCon(t6, 'user-1', { ancho: 1280, extra: SIN })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const t = page.locator('#mcMisCambios .cp-tarjeta').first()
  check('la tarjeta sin bloque de dirección', (await t.locator('.cp-t-dir').count()) === 0)
  await t.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1500)
  check('aceptar funciona como antes', (await foto(page)).trade_offers[0].estado === 'aceptada')
  await ir(page, '/ajustes.html?ver=direccion')
  check('Ajustes dice que falta la migración', /falta ejecutar supabase-migration-1102/.test(await texto(page.locator('#ajDireccion'))))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

// Tanda 1099 — cambio, venta o compra; precios que se tocan y el envío.
//
// PINGU: «que te meta los precios de Cardmarket de cada carta, pero que sean
// editables… y envío: que le dejes a él decidir si es normal o certificado,
// normal 2 € y certificado 7 €». Lo que se mira:
//   · lo puro: el tipo (cambio, vendo, compro), el título, quién paga el
//     envío y que el envío cuente en lo que recibe quien vende;
//   · le vendo a Lucía: «Le vendo» deja solo lo mío, el 90 % pone 34,20 € al
//     Mew de 38, escribo 30 a mano (y el de Cardmarket sale tachado), «Por
//     correo», Bizum; se guarda 30 € que paga ella, por correo;
//   · Lucía: «Admin te vende», hace contraoferta a 25 €; yo la veo como 2.ª
//     versión y elijo… no: la elige quien la recibe (yo, ahora), y como
//     quien compra es ella, el botón no suma el envío;
//   · otra venta en la que ella la recibe: elige certificado y el botón dice
//     «Aceptar · 37,00 €»; se guarda certificado y 7 €.
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
    // Desde la 1102, por correo hace falta la dirección: cada uno tiene la suya guardada.
    window.__FAKE_FILAS__ = { user_direcciones: ['admin-1', 'user-1', 'user-2', 'user-3', 'user-4'].map((u) => ({ user_id: u, nombre: `Persona ${u}`, calle: 'C/ Mayor 1', cp: '28013', ciudad: 'Madrid' })), ...(window.__FAKE_FILAS__ || {}) }
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



console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/cambio-propuesta-puro.js`)
  check('tipo: solo das, «vendo»; solo te dan, «compro»; las dos, «cambio»', m.tipoDe([{ mia: true }]) === 'vendo' && m.tipoDe([{ mia: false }]) === 'compro' && m.tipoDe([{ mia: true }, { mia: false }]) === 'cambio')
  const o = { de: 'a', para: 'b', dinero: 30, dinero_paga: 'para', envio_precio: 7, items: [{ quien: 'a', cantidad: 1 }] }
  check('título desde cada lado: «Venta a Lucía» y «Ana te vende»', m.tituloDe(o, 'a', 'Lucía') === 'Venta a Lucía' && m.tituloDe(o, 'b', 'Ana') === 'Ana te vende')
  check('el envío lo paga quien compra; en un cambio, nadie', m.pagaElEnvio(o) === 'b' && m.pagaElEnvio({ ...o, items: [{ quien: 'a' }, { quien: 'b' }] }) === null)
  check('a quien vende le llegan 30 € y 7 € de envío; a quien compra, la carta', m.queRecibe(o, 'a').dinero === 37 && m.queRecibe(o, 'b').cartas === 1 && m.queRecibe(o, 'b').dinero === 0)
  check('los envíos: normal 2 €, certificado 7 €', m.envioDe('normal').precio === 2 && m.envioDe('certificado').precio === 7 && m.envioDe('mano').precio === 0)
}

let tablas
console.log('── 2. Le vendo a Lucía, con el precio tocado ──')
{
  const { ctx, page, errores } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
  await page.waitForTimeout(1800)
  check('con un cruce perfecto se abre en «Cambio»', (await page.locator('#cpDialogo [data-cp-modo="cambio"][aria-pressed="true"]').count()) === 1)
  await page.click('#cpDialogo [data-cp-modo="vendo"]')
  await page.waitForTimeout(300)
  check('«Le vendo»: un lado, solo el Mew ex', (await page.locator('#cpDialogo .cp-lado').count()) === 1 && /Mew ex/.test(await page.locator('#cpDialogo .cp-lado').innerText()) && !/Umbreon/.test(await page.locator('#cpDialogo').innerText()))
  const campo = page.locator('#cpDialogo [data-cp-precio]').first()
  check('el precio de Cardmarket, en un campo', (await campo.inputValue()) === '38', await campo.inputValue())
  await page.click('#cpDialogo [data-cp-pct="90"]')
  await page.waitForTimeout(300)
  check('90 %: 34,20 €', (await page.locator('#cpDialogo [data-cp-precio]').first().inputValue()) === '34.2' && /34,20 €/.test(await page.locator('#cpDialogo .cp-importe').innerText()), await page.locator('#cpDialogo .cp-importe').innerText())
  await page.locator('#cpDialogo [data-cp-precio]').first().fill('30')
  await page.locator('#cpDialogo [data-cp-precio]').first().dispatchEvent('change')
  await page.waitForTimeout(300)
  const importe = (await page.locator('#cpDialogo .cp-importe').innerText()).replace(/\s+/g, ' ')
  check('a mano, 30 €: el total y el de Cardmarket tachado', /30,00 €/.test(importe) && /38,00 € en Cardmarket/.test(importe) && (await page.locator('#cpDialogo .cp-precio-caja s').count()) === 1, importe)
  check('por correo de entrada, y lo dice', (await page.locator('#cpDialogo [data-cp-envio="correo"][aria-pressed="true"]').count()) === 1 && /lo paga Lucía/.test(await page.locator('#cpDialogo .cp-envio').innerText()))
  await page.click('#cpDialogo [data-cp-como="bizum"]')
  await page.waitForTimeout(200)
  check('el botón dice el precio: «Ofrecer por 30,00 € + envío»', (await page.locator('#cpEnviar').innerText()).trim() === 'Ofrecer por 30,00 € + envío', await page.locator('#cpEnviar').innerText())
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  const o = tablas.trade_offers[0]
  const its = tablas.trade_offer_items.filter((i) => i.oferta === o.id)
  check('se guarda: 30 € que paga ella, por Bizum, por correo, y el Mew a 30', o.dinero === 30 && o.dinero_paga === 'para' && o.dinero_como === 'bizum' && o.envio === 'correo' && its.length === 1 && its[0].precio === 30, JSON.stringify({ o, its }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Lucía hace una contraoferta ──')
{
  const conv = tablas.trade_offers[0].conversacion
  const { ctx, page, errores } = await abrirCon(tablas, 'user-1', { movil: true })
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  // Desde la 1100 el trato se sigue en Cruces → «En curso»; en Mensajes
  // queda una tira que lleva allí.
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const caja = page.locator('#mcMisCambios')
  const t = (await caja.innerText()).replace(/\s+/g, ' ')
  check('«Admin te vende», con el envío por elegir y el total en el botón', /Admin te vende/.test(t) && (await caja.locator('[data-cp-envio-elegir]').count()) === 3 && (await caja.locator('[data-cp-accion="aceptar"]').innerText()).trim() === 'Aceptar · 32,00 €', t)
  await caja.locator('[data-cp-envio-elegir="certificado"]').click()
  check('  …certificado: «Aceptar · 37,00 €»', (await caja.locator('[data-cp-accion="aceptar"]').innerText()).trim() === 'Aceptar · 37,00 €')
  await caja.locator('[data-cp-accion="editar"]').click()
  await page.waitForTimeout(1800)
  check('la contraoferta se abre en «Le compro», con el precio que se propuso', (await page.locator('#cpDialogo [data-cp-modo="compro"][aria-pressed="true"]').count()) === 1 && (await page.locator('#cpDialogo [data-cp-precio]').first().inputValue()) === '30')
  await page.locator('#cpDialogo [data-cp-precio]').first().fill('25')
  await page.locator('#cpDialogo [data-cp-precio]').first().dispatchEvent('change')
  await page.waitForTimeout(300)
  check('el botón: «Mandar la contraoferta · 25,00 € + envío»', (await page.locator('#cpEnviar').innerText()).trim() === 'Mandar la contraoferta · 25,00 € + envío', await page.locator('#cpEnviar').innerText())
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  const nueva = tablas.trade_offers.find((o) => o.version === 2)
  check('2.ª versión: 25 € que paga ella, por correo; la 1.ª, cambiada', nueva && nueva.de === 'user-1' && nueva.dinero === 25 && nueva.dinero_paga === 'de' && nueva.envio === 'correo' && tablas.trade_offers.find((o) => o.version === 1).estado === 'cambiada', JSON.stringify(tablas.trade_offers.map((o) => [o.version, o.de, o.dinero, o.dinero_paga, o.envio, o.estado])))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Yo la acepto: el envío lo elijo yo y lo paga ella ──')
{
  const conv = tablas.trade_offers[0].conversacion
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', { movil: true })
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  // Desde la 1100 el trato se sigue en Cruces → «En curso»; en Mensajes
  // queda una tira que lleva allí.
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const caja = page.locator('#mcMisCambios')
  const t = (await caja.innerText()).replace(/\s+/g, ' ')
  check('«Le vendes a Lucía · 2.ª versión», con «Lo paga Lucía» y el botón sin sumar', /Le vendes a Lucía · 2\.ª versión/.test(t) && /Lo paga Lucía/.test(t) && (await caja.locator('[data-cp-accion="aceptar"]').innerText()).trim() === 'Aceptar', t)
  await caja.locator('[data-cp-envio-elegir="certificado"]').click()
  await caja.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  const o = tablas.trade_offers.find((x) => x.version === 2)
  check('aceptada con certificado, 7 €', o.estado === 'aceptada' && o.envio_tipo === 'certificado' && o.envio_precio === 7, JSON.stringify(o))
  const t2 = (await caja.innerText()).replace(/\s+/g, ' ')
  check('mi lado: 25 € + 7 € de envío, y «Dinero recibido»', /Recibes · 32,00 €/.test(t2) && /25,00 € \+ 7,00 € de envío/.test(t2) && (await caja.locator('[data-cp-accion="lo-tengo"]').innerText()).trim() === 'Dinero recibido', t2)
  check('  …y dice el envío elegido', /Envío: Certificado · 7,00 €, lo paga Lucía/.test(t2), t2)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

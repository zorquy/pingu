// Tandas 942 y 943 — la propuesta de cambio, de punta a punta.
//
// PINGU: «si yo tengo una carta de 70 € y quiero dos de 3 € de él, la
// diferencia me la tendría que dar por Bizum… pero si el cambio se hace
// efectivo, que unas cartas pasen a la colección del otro y viceversa».
// Lo que se mira:
//   1. Lo puro: el balance con el dinero, la diferencia propuesta, el
//      estado y lo que se puede hacer desde cada lado.
//   2. Desde Cruces: «Proponer cambio» abre el editor relleno con lo que os
//      cruzáis; el dinero (quién, cuánto y cómo), «Pedirle otra», y al
//      enviar: la propuesta en la base, el mensaje y «Tus cambios».
//   3. Lucía, en Mensajes: la tarjeta «Te toca», Aceptar y «Lo tengo».
//   4. Yo, en Mensajes: «Lo tengo» enseña lo que se mueve; al confirmarlo
//      las cartas cambian de colección, se tacha el deseo, y Deshacer lo
//      devuelve todo.
//   5. El Mercado: «Proponer cambio» en la ficha, y «Reservada».
//   6. Sin la migración: nada se rompe.
//   7. En el iPhone: el editor es una hoja desde abajo.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
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

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/cambio-propuesta-puro.js`)
  const items = [{ mia: true, precio: 70, cantidad: 1 }, { mia: false, precio: 3, cantidad: 2 }]
  const b = m.balanceDe(items, { cantidad: 64, pagaYo: false })
  check('70 € por dos de 3 € y te paga 64 €: cuadra', b.das === 70 && b.recibes === 70 && b.cuadra, JSON.stringify(b))
  check('  …sin el dinero no cuadra y la diferencia que se propone es 64 € que te paga', !m.balanceDe(items, {}).cuadra && JSON.stringify(m.dineroQueCuadra(items)) === JSON.stringify({ cantidad: 64, pagaYo: false }))
  check('  …y al revés, le pagas tú', m.dineroQueCuadra([{ mia: false, precio: 50 }, { mia: true, precio: 20 }]).pagaYo === true)
  check('una carta sin precio no cuenta y se dice', m.balanceDe([{ mia: true, precio: null }, { mia: false, precio: 5 }], {}).sinPrecio === 1)
  const o = { de: 'a', para: 'b', estado: 'enviada', dinero: 64, dinero_paga: 'para', dinero_como: 'bizum' }
  check('el dinero de una guardada, desde cada lado', m.textoDeDinero(m.dineroDeOferta(o, 'a'), 'Lucía') === 'Lucía te paga 64,00 € · Bizum' && m.textoDeDinero(m.dineroDeOferta(o, 'b'), 'Ana') === 'Le pagas 64,00 € · Bizum')
  check('enviada: quien la manda espera; quien la recibe, «Te toca» con aceptar, cambiar y rechazar', m.estadoDe(o, 'a', 'Lucía').texto === 'Esperando a Lucía' && m.estadoDe(o, 'b').acciones.join() === 'aceptar,editar,rechazar')
  // 1098: el texto del botón según lo que te llega.
  const oc = { de: 'a', para: 'b', dinero: 20, dinero_paga: 'para', items: [{ quien: 'a', cantidad: 2 }] }
  check('venta: quien da recibe dinero («Dinero recibido»); quien paga, cartas («Cartas recibidas»)', m.textoDeRecibido(m.queRecibe(oc, 'a')) === 'Dinero recibido' && m.textoDeRecibido(m.queRecibe(oc, 'b')) === 'Cartas recibidas')
  check('  …una sola carta: «Carta recibida»; carta y dinero: «Recibido»; nada: null', m.textoDeRecibido({ cartas: 1 }) === 'Carta recibida' && m.textoDeRecibido({ cartas: 1, dinero: 5 }) === 'Recibido' && m.textoDeRecibido({}) === null)
  check('  …y lo que es, en palabras', m.loQueEs({ cartas: 2, dinero: 30 }) === '2 cartas y 30,00 €' && m.loQueEs({}) === 'nada')
  check('aceptada: «Lo tengo»; con el tuyo dado, a esperar', m.estadoDe({ ...o, estado: 'aceptada' }, 'a').acciones.join() === 'lo-tengo,anular' && m.estadoDe({ ...o, estado: 'aceptada', recibido_de_at: 'x' }, 'a').acciones.join() === 'anular')
  check('hecha: deshacer solo dentro del día', m.estadoDe({ ...o, estado: 'hecha', deshacer_hasta: new Date(Date.now() + 1e6).toISOString() }, 'a').acciones.join() === 'deshacer' && !m.estadoDe({ ...o, estado: 'hecha', deshacer_hasta: '2020-01-01' }, 'a').acciones.length)
  const rpc = m.itemsParaRpc([{ mia: true, linea: 'l1', cantidad: 1, precio: 70 }, { mia: false, card_id: 'c9', idioma: 'en', cantidad: 1, precio: null }])
  check('para la RPC: lo tuyo con su línea, lo que pides con la carta', rpc[0].de === 'yo' && rpc[0].linea === 'l1' && rpc[1].de === 'otro' && rpc[1].card_id === 'c9' && rpc[1].idioma === 'en' && !rpc[1].linea)
}

let tablas
console.log('\n── 2. Desde Cruces ──')
{
  const { ctx, page, errores } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const tarjeta = page.locator('#mcCambiosPanel [data-cruce="user-1"]')
  check('la tarjeta de Lucía tiene «Proponer cambio»', (await tarjeta.locator('[data-proponer]').count()) === 1)
  await tarjeta.locator('[data-proponer]').click()
  await page.waitForTimeout(1800)
  const d = page.locator('#cpDialogo')
  check('se abre el editor, a un lado en el PC', await d.evaluate((x) => x.open))
  const ladoMio = () => page.locator('#cpDialogo .cp-lado').nth(0).innerText()
  const ladoSuyo = () => page.locator('#cpDialogo .cp-lado').nth(1).innerText()
  check('  …relleno: das tu Mew ex y te da su Umbreon', /Mew ex/.test(await ladoMio()) && /Umbreon VMAX/.test(await ladoSuyo()), `${await ladoMio()} | ${await ladoSuyo()}`)
  check('  …con los precios de hoy (38 € y 612 €)', /38,00/.test(await ladoMio()) && /612,00/.test(await ladoSuyo()))
  check('  …y la sugerencia de la diferencia: que le pagues 574 €', /le pagues la diferencia: 574,00/.test(await page.locator('#cpDialogo').innerText()))
  // Pedirle otra: el Pikachu ex que no da.
  await page.click('#cpDialogo [data-cp-elegir="pedir"]')
  await page.fill('#cpBuscar', 'pikachu')
  await page.waitForTimeout(1200)
  await page.click('#cpDialogo [data-cp-pedir="sv8-238"]')
  await page.waitForTimeout(800)
  check('«Pedirle otra»: Pikachu ex, marcada «Se la pides»', /Pikachu ex/.test(await ladoSuyo()) && /Se la pides/.test(await ladoSuyo()), await ladoSuyo())
  await page.click('#cpDialogo [data-cp-paga="yo"]')
  await page.waitForTimeout(300)
  check('«Le pagas»: pone la diferencia con los precios de hoy', Number(await page.inputValue('#cpDinero')) === Math.round((612 + 84.9 - 38) * 100) / 100, await page.inputValue('#cpDinero'))
  await page.fill('#cpDinero', '600')
  await page.locator('#cpDinero').dispatchEvent('change')
  await page.click('#cpDialogo [data-cp-como="bizum"]')
  await page.waitForTimeout(300)
  check('  …y la balanza lo cuenta', /Das 638,00 € · recibes 696,90 €/.test(await page.locator('.cp-balanza').innerText()), await page.locator('.cp-balanza').innerText())
  check('  …y avisa de que el pago es cosa vuestra', /no se cobra ni se comprueba/.test(await page.locator('.cp-dinero').innerText()))
  await page.fill('#cpNota', 'Te la mando certificada')
  await page.click('#cpEnviar')
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  const o = tablas.trade_offers[0]
  const its = tablas.trade_offer_items
  check('enviada: la propuesta en la base, con el dinero, quién paga y cómo', tablas.trade_offers.length === 1 && o.estado === 'enviada' && o.dinero === 600 && o.dinero_paga === 'de' && o.dinero_como === 'bizum' && o.nota === 'Te la mando certificada', JSON.stringify(o))
  check('  …tres cartas: la tuya con su línea, la suya con la suya y la pedida', its.length === 3 && its.some((i) => i.quien === 'admin-1' && i.linea === 'm1') && its.some((i) => i.quien === 'user-1' && i.linea === 'o1') && its.some((i) => i.pedida && i.card_id === 'sv8-238'), JSON.stringify(its.map((i) => [i.quien, i.linea, i.card_id])))
  check('  …y el mensaje en vuestra conversación', tablas.private_messages.some((m) => /Te he mandado una propuesta de cambio: doy 1 carta y recibo 2 cartas y te pago 600,00 €/.test(m.body)), JSON.stringify(tablas.private_messages.map((m) => m.body)))
  check('  …y el aviso a Lucía', tablas.user_notifications.some((n) => n.recipient_id === 'user-1' && n.type === 'cambio_propuesta'))
  check('el editor se cierra', !(await d.evaluate((x) => x.open)))
  await page.waitForTimeout(800)
  // «En curso» desde la 1100 (era «Tus cambios · 1 en curso»).
  check('«En curso» arriba de los cruces: «Esperando a Lucía»', /En curso · 1/.test(await page.locator('#mcMisCambios').innerText()) && /Esperando a Lucía/.test(await page.locator('#mcMisCambios').innerText()), await page.locator('#mcMisCambios').innerText().catch(() => ''))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Lucía, en Mensajes ──')
{
  const conv = tablas.trade_offers[0].conversacion
  const { ctx, page, errores } = await abrirCon(tablas, 'user-1')
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  await ir(page, `/mensajes.html?c=${conv}`)
  const tira = page.locator('#msgPropuestas .cp-tira')
  check('en Mensajes, una tira: qué es, «Te toca» y a «En curso»', (await tira.count()) === 1 && /Cambio con Admin/.test(await tira.innerText()) && /Te toca/.test(await tira.innerText()) && /ver=cambios#oferta-/.test(await tira.getAttribute('href')), await tira.innerText().catch(() => ''))
  check('  …y se queda arriba de la conversación al bajar', (await page.$eval('#msgPropuestas', (e) => getComputedStyle(e).position)) === 'sticky')
  // Desde la 1100 el trato se sigue en Cruces → «En curso»; en Mensajes
  // queda una tira que lleva allí.
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const caja = page.locator('#mcMisCambios')
  const t3 = (await caja.innerText().catch(() => '')).replace(/\s+/g, ' ')
  check('la tarjeta encima de la conversación: «Te toca»', /Te toca/.test(t3), t3)
  // Desde la 1098 el dinero va DENTRO del lado de quien lo recibe y suma en
  // su total: 38 € del Mew y 600 € por Bizum.
  check('  …desde su lado: da 696,90 € (Umbreon y Pikachu) y recibe 638,00 € (el Mew y 600 € por Bizum)', /Das · 696,90 €/.test(t3) && /Recibes · 638,00 €/.test(t3) && /600,00 € · Bizum/.test(t3) && /«Te la mando certificada»/.test(t3), t3)
  // «Cambiar algo» es «Contraoferta» desde la 1099.
  check('  …con Aceptar, Contraoferta y Rechazar', (await caja.locator('[data-cp-accion]').allInnerTexts()).join() === 'Aceptar,Contraoferta,Rechazar', (await caja.locator('[data-cp-accion]').allInnerTexts()).join())
  await caja.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  check('aceptada', tablas.trade_offers[0].estado === 'aceptada')
  // Lucía no tiene ningún Pikachu ex apuntado: la pedida se queda sin línea
  // (al cerrar le entra a quien la pide igual, y a ella no le sale nada).
  check('  …la pedida, que no tiene apuntada, se queda sin línea', tablas.trade_offer_items.find((i) => i.pedida)?.linea === null, JSON.stringify(tablas.trade_offer_items.find((i) => i.pedida)))
  // 1098: el botón dice lo que le llega (la carta y el dinero: «Recibido»)
  // y la tarjeta, quién ha confirmado ya.
  check('  …y la tarjeta pide «Recibido» (le llegan una carta y dinero)', (await caja.locator('[data-cp-accion="lo-tengo"]').innerText()).trim() === 'Recibido', await caja.innerText())
  const quien = (await caja.locator('.cp-quien').innerText().catch(() => '')).replace(/\s+/g, ' ')
  check('  …y quién confirma qué: Admin dos cartas, ella una carta y 600 €, los dos pendientes', /Admin · 2 cartas Pendiente/.test(quien) && /Tú · 1 carta y 600,00 € Pendiente/.test(quien), quien)
  await caja.locator('[data-cp-accion="lo-tengo"]').click()
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  // Desde la 1103, si va por correo y no ha dicho que mandó lo suyo, le toca mandarlo.
  check('su «Lo tengo» se apunta, sin mover nada todavía', tablas.trade_offers[0].recibido_para_at && tablas.trade_offers[0].estado === 'aceptada' && /Esperando a que Admin lo confirme|mándaselo a Admin/.test(await caja.innerText()) && /Tú · 1 carta y 600,00 €\s*Recibido ✓/.test((await caja.textContent()).replace(/\s+/g, ' ')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. Yo cierro el cambio, y lo deshago ──')
{
  const conv = tablas.trade_offers[0].conversacion
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1')
  await page.route(/\/mensajes\.html/, (r) => r.continue())
  // Desde la 1100 el trato se sigue en Cruces → «En curso»; en Mensajes
  // queda una tira que lleva allí.
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const caja = page.locator('#mcMisCambios')
  check('«Lucía ya tiene lo tuyo»', /Lucía ya tiene lo tuyo/.test(await caja.innerText()), await caja.innerText())
  check('  …y el botón dice «Cartas recibidas» (te llegan dos)', (await caja.locator('[data-cp-accion="lo-tengo"]').innerText()).trim() === 'Cartas recibidas')
  await caja.locator('[data-cp-accion="lo-tengo"]').click()
  await page.waitForTimeout(600)
  const conf = page.locator('#cpCerrar')
  const texto = await conf.innerText().catch(() => '')
  check('antes de mover: lo que sale, lo que entra y el dinero', (await conf.evaluate((x) => x.open)) && /Mew ex.*sale de tu colección/s.test(texto) && /Umbreon VMAX.*entra en tu colección/s.test(texto) && /Le pagas 600,00 € · Bizum: es cosa vuestra/.test(texto), texto)
  await conf.locator('[data-r="si"]').click()
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  const col = tablas.user_collection
  check('hecha', tablas.trade_offers[0].estado === 'hecha')
  check('  …tu Mew ex sale de tu colección', !col.some((l) => l.user_id === 'admin-1' && l.card_id === 'sv3pt5-151'), JSON.stringify(col.filter((l) => l.user_id === 'admin-1')))
  check('  …y entra en la de Lucía', col.some((l) => l.user_id === 'user-1' && l.card_id === 'sv3pt5-151'))
  check('  …su Umbreon entra en la tuya, en español', col.some((l) => l.user_id === 'admin-1' && l.card_id === 'swsh7-215' && l.idioma === 'es'))
  check('  …y sale de la suya', !col.some((l) => l.id === 'o1'))
  check('  …y el Pikachu ex que le pedías, también es tuyo', col.some((l) => l.user_id === 'admin-1' && l.card_id === 'sv8-238'))
  check('  …el Umbreon, tachado de tu La quiero; el Mew, del suyo', !tablas.user_wants.some((w) => w.id === 'd1') && !tablas.user_wants.some((w) => w.id === 'd2'))
  check('  …y cuenta para la confianza', tablas.trade_confirmations.length === 1)
  const aviso = page.locator('.toast', { hasText: 'Cambio hecho' })
  check('el aviso «Cambio hecho» lleva Deshacer', (await aviso.count()) === 1 && (await aviso.locator('.toast-accion').innerText()) === 'Deshacer', await page.locator('.toast').allInnerTexts().then((t) => t.join(' | ')))
  await aviso.locator('.toast-accion').click()
  await page.waitForTimeout(1500)
  tablas = await foto(page)
  check('Deshacer: todo vuelve a donde estaba', tablas.trade_offers[0].estado === 'aceptada' && tablas.user_collection.some((l) => l.id === 'm1' && l.user_id === 'admin-1') && tablas.user_collection.some((l) => l.id === 'o1') && !tablas.user_collection.some((l) => l.user_id === 'admin-1' && l.card_id === 'swsh7-215') && tablas.user_wants.some((w) => w.id === 'd1') && !tablas.trade_confirmations.length)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. El Mercado ──')
{
  const { ctx, page, errores } = await abrirCon(tablas, 'admin-1', { ancho: 1280 })
  await ir(page)
  await page.click('[data-merc-ficha="swsh7-215"]')
  await page.waitForTimeout(1400)
  const lucia = page.locator('#mcMercadoFichaCuerpo .mc-merf-persona', { hasText: 'Lucía' })
  check('el Umbreon de Lucía, en un cambio aceptado: «Reservada» y sin proponer', /Reservada/.test(await lucia.innerText()) && (await lucia.locator('[data-merf-proponer]').count()) === 0, await lucia.innerText())
  const iker = page.locator('#mcMercadoFichaCuerpo .mc-merf-persona', { hasText: 'Íker' })
  check('el de Íker sí: «Proponer cambio»', (await iker.locator('[data-merf-proponer]').count()) === 1)
  await iker.locator('[data-merf-proponer]').click()
  await page.waitForTimeout(1800)
  // Íker da y tú no le das nada: desde la 1099 se abre en «Le compro», con
  // un lado (el suyo).
  const ladoIker = await page.locator('#cpDialogo .cp-lado').last().innerText().catch(() => '')
  check('  …y abre el editor en «Le compro» con su Umbreon (en inglés) ya puesto', (await page.$eval('#cpDialogo', (x) => x.open)) && (await page.locator('#cpDialogo [data-cp-modo="compro"][aria-pressed="true"]').count()) === 1 && /Umbreon VMAX/.test(ladoIker) && /Inglés/.test(ladoIker), ladoIker)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 6. Sin la migración ──')
{
  const { ctx, page, errores } = await abrir({ ancho: 1280, extra: { __SIN_942__: true } })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  check('Cruces se pinta igual, sin «Tus cambios»', (await page.locator('#mcCambiosPanel .mc-cruce').count()) > 0 && await page.$eval('#mcMisCambios', (x) => x.hidden))
  await page.click('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]')
  await page.waitForTimeout(1500)
  check('«Proponer cambio» dice qué migración falta', /supabase-migration-942-propuestas-cambio\.sql/.test(await page.locator('#cpDialogo').innerText()), await page.locator('#cpDialogo').innerText())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 7. En el iPhone ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.click('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]')
  await page.waitForTimeout(1800)
  const caja = await page.locator('#cpDialogo').boundingBox()
  const alto = await page.evaluate(() => innerHeight)
  check('el editor sale desde abajo, a lo ancho', caja && caja.width >= 380 && Math.abs(caja.y + caja.height - alto) < 4, `${JSON.stringify(caja)} · ${alto}`)
  check('  …con los dos lados uno encima del otro', await page.evaluate(() => { const l = document.querySelectorAll('#cpDialogo .cp-lado'); return l.length === 2 && l[1].getBoundingClientRect().top > l[0].getBoundingClientRect().bottom - 1 }))
  check('la página no se sale de lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

// Tanda 1250 — comprarle a una tienda, en el navegador. El pop-up de la carta
// lleva su precio puesto y editable («Pedir por 40,00 €» / «Ofrecer 35,00 €»),
// el mínimo de la tienda, en mano o por correo (la tabla de los cambios), cómo
// pagar (lo que acepta, el efectivo solo en mano) y el total; manda
// `tienda_oferta_enviar` y enseña lo que ya ofreciste; sin cuenta pide cuenta,
// y sin la migración se queda el «Me interesa» de antes. En Mensajes, la
// tarjeta viva en el ÚLTIMO mensaje de cada oferta (los de antes, una línea),
// con sus botones según a quién le toque, y el Bizum solo aceptada. Y la
// pestaña Ofertas del panel (montones, contraoferta con el coste, «Ir al
// chat») y «Cómo cobras» en Datos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── Lo puro ──')
{
  const P = await import(`${REPO}/js/tiendas-puro.js`)
  check('el mínimo (80 % de 40 = 32) y sin mínimo, nada', P.minimoDeOferta(40, 80) === 32 && P.minimoDeOferta(40, null) === null && P.minimoDeOferta(null, 80) === null)
  check('«pide» a su precio, «ofrece» por debajo', P.queEsLaOferta(40, 40) === 'pide' && P.queEsLaOferta(35, 40) === 'ofrece' && P.queEsLaOferta(35, null) === 'ofrece')
  check('el total: cartas y envío', P.totalDeOferta({ precio: 38, unidades: 2, envio_precio: 7.06 }) === 83.06)
  check('a quién le toca, dicho para cada uno', P.puntoDeOferta({ estado: 'abierta', turno: 'tienda' }, 'tienda').chapa === 'Te toca' && P.puntoDeOferta({ estado: 'abierta', turno: 'tienda' }, 'comprador').chapa === 'Esperando a la tienda' && P.puntoDeOferta({ estado: 'abierta', turno: 'comprador' }, 'comprador').clase === 'toca')
  check('los pasos, en tu boca y en la del otro', P.textoDePaso({ quien: 'comprador', que: 'ofrece', precio: 35 }, { soy: 'comprador' }) === 'Ofreciste · 35,00 €' && P.textoDePaso({ quien: 'tienda', que: 'contraoferta', precio: 38 }, { soy: 'comprador', nombreTienda: 'RyuCards' }) === 'RyuCards contraofertó · 38,00 €' && P.textoDePaso({ quien: 'nadie', que: 'caducada' }, { soy: 'tienda' }) === 'Caducó sin respuesta')
  check('lo vendido por una oferta dice «PokeDoc», y no se elige en Vender', P.DONDE_NOMBRE.pokedoc === 'PokeDoc' && !P.DONDE_VENTA.some(([v]) => v === 'pokedoc'))
  const M = await import(`${REPO}/js/mensajes-puro.js`)
  const ms = [{ id: 'a', adjuntos: [{ tipo: 'oferta_tienda', oferta: 'o1', evento: 'oferta_nueva' }] }, { id: 'b', adjuntos: [] }, { id: 'c', adjuntos: [{ tipo: 'oferta_tienda', oferta: 'o1', evento: 'oferta_contraoferta' }] }, { id: 'd', adjuntos: [{ tipo: 'oferta_tienda', oferta: 'o2', evento: 'oferta_nueva' }] }]
  check('de cada oferta, su último mensaje', [...M.ultimosDeOfertas(ms)].join() === 'c,d' && M.ofertaTiendaDe(ms[0]).evento === 'oferta_nueva' && M.ofertaTiendaDe(ms[1]) === null)
}

const TIENDA = { id: 'tienda-1', username: 'ryu', display_name: 'RyuCards', tipo: 'tienda', avatar_url: null }
const FILAS = [{ id: 'e1', card_id: 'carta-1', market: 'WEST', product_id: null, nombre: 'Carta 1', set_id: 'set-0', numero: '1', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 2, precio: 40, de_tu_lista: false }]
const CARTAS = [{ id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '1', name: 'Pikachu ex', image_path: 'sv/sv3/1' }]
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF' }]
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-1', rpc = {}, sinMig = false, filas = {}, perfil = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.perfil) { window.__FAKE_PERFIL__ = d.perfil; localStorage.setItem('pd-tienda', '{"u":"ryu","id":"tienda-1"}') }
    window.__FAKE_PERFILES__ = [d.TIENDA, { id: 'user-1', username: 'ane', display_name: 'Ane', tipo: 'persona' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'tienda-1', precio_visible: true }], tienda_stock: [], ...d.filas }
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_SETS__ = d.SETS
    const r = {
      tienda_escaparate: (a) => {
        const f = a.p_filtros || {}
        const sale = d.FILAS.filter((x) => (!f.carta || x.card_id === f.carta) && (!f.id || x.id === f.id))
        return { total: sale.length, en_escaparate: d.FILAS.length, de_tu_lista: 0, precios: true, facetas: {}, filas: sale }
      },
      tienda_oferta_enviar: (a) => ({ id: 'of-9', precio: a.p_precio, que: a.p_precio >= 40 ? 'pide' : 'ofrece', envio_precio: 0 }),
      ...d.rpc,
    }
    if (!d.sinMig) r.tienda_condiciones = { pagos: ['bizum', 'efectivo'], minimo: 80 }
    window.__RPC_RESPUESTAS__ = r
  }, { sesion, rpc, sinMig, filas, perfil, TIENDA, FILAS, CARTAS, SETS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)

console.log('── El pop-up de compra ──')
{
  const { p, ctx, errs } = await abrir('/usuario.html?u=ryu&carta=carta-1')
  check('sin errores y abierto', !errs.length && (await p.isVisible('dialog.ptc[open]')), errs.join(' | '))
  check('el precio de la tienda puesto y «Pedir por 40,00 €»', (await p.inputValue('#ptcPrecio')) === '40.00' && /Pedir por 40,00\s€/.test(await p.textContent('[data-ptc="enviar"]')))
  check('  …pago: solo lo que acepta (Bizum y Efectivo), y el total', (await p.locator('[data-ptc-pago]').count()) === 2 && /40,00\s€/.test(await p.textContent('.ptc-total b')))
  await p.fill('#ptcPrecio', '35'); await p.waitForTimeout(150)
  check('bajarlo: «Ofrecer 35,00 €» y dice que es una oferta', /Ofrecer 35,00\s€/.test(await p.textContent('[data-ptc="enviar"]')) && /Es una oferta/.test(await p.textContent('#ptcAviso')) && (await p.inputValue('#ptcPrecio')) === '35')
  await p.fill('#ptcPrecio', '30'); await p.waitForTimeout(150)
  check('por debajo del mínimo (32): avisa y no deja enviar', /por debajo de 32,00\s€/.test(await p.textContent('#ptcAviso')) && (await p.isDisabled('[data-ptc="enviar"]')))
  await p.fill('#ptcPrecio', '35,5'); await p.waitForTimeout(150)
  check('con coma también vale', /Ofrecer 35,50\s€/.test(await p.textContent('[data-ptc="enviar"]')) && !(await p.isDisabled('[data-ptc="enviar"]')))
  await p.click('[data-ptc-pago="efectivo"]')
  await p.click('[data-ptc-envio="correo"]'); await p.waitForTimeout(150)
  check('por correo: el certificado de la tabla (7,06 €), el total y el efectivo fuera', /7,06\s€/.test(await p.textContent('.ptc-envio-precio')) && /42,56\s€/.test(await p.textContent('.ptc-total b')) && (await p.isDisabled('[data-ptc-pago="efectivo"]')) && (await p.getAttribute('[data-ptc-pago="bizum"]', 'aria-pressed')) === 'true')
  await p.selectOption('#ptcUnidades', '2'); await p.waitForTimeout(150)
  await p.click('[data-ptc="enviar"]'); await p.waitForTimeout(900)
  const env = (await llamadas(p, 'tienda_oferta_enviar'))[0]
  check('manda la oferta: la línea, el precio, correo, Bizum y dos', env?.p_stock === 'e1' && env.p_precio === 35.5 && env.p_envio === 'correo' && env.p_pago === 'bizum' && env.p_unidades === 2, JSON.stringify(env))
  check('  …lo dice con «Ver en Mensajes» y enseña tu oferta', (await p.locator('.toast', { hasText: 'Oferta enviada a RyuCards' }).count()) === 1 && /Esperando a la tienda/.test(await p.textContent('.ptc-viva')) && /Otra oferta/.test(await p.textContent('.ptc-campo')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=ryu&carta=carta-1', { filas: { tienda_ofertas: [{ id: 'of-1', comprador_id: 'user-1', stock_id: 'e1', estado: 'aceptada', turno: 'tienda', precio: 38, unidades: 1, envio: 'mano' }] } })
  check('con una oferta ya aceptada: «Aceptada» y a Mensajes, sin formulario', /Aceptada/.test(await p.textContent('.ptc-viva')) && (await p.locator('#ptcPrecio').count()) === 0 && (await p.getAttribute('.ptc-viva a', 'href')) === '/mensajes.html?with=tienda-1')
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=ryu&carta=carta-1', { sesion: 'none' })
  check('sin cuenta: se ve el precio y el botón pide cuenta y vuelve aquí', (await p.locator('#ptcPrecio').count()) === 1 && /^\/auth\.html\?registro=1&volver=%2F(usuario|tiendas)/.test(await p.getAttribute('.ptc-acciones a.btn-primary', 'href')) && (await p.locator('[data-ptc="enviar"]').count()) === 0)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=ryu&carta=carta-1', { sinMig: true })
  check('sin la migración: el «Me interesa» de antes', (await p.locator('#ptcPrecio').count()) === 0 && (await p.getAttribute('.ptc-acciones a.btn-primary', 'href')) === '/mensajes.html?with=tienda-1&carta=e1')
  await ctx.close()
}

console.log('── En Mensajes ──')
const ahora = Date.now()
const msg = (id, de, body, evento, min) => ({ id, conversation_id: 'c1', sender_id: de, body, created_at: new Date(ahora - min * 6e4).toISOString(), deleted_at: null, adjuntos: [{ tipo: 'oferta_tienda', oferta: 'of-1', evento }] })
const MENSAJES = [msg('m1', 'user-1', 'Te ofrezco 35.00 €.', 'oferta_nueva', 30), msg('m2', 'tienda-1', 'Te la dejo en 38.00 €.', 'oferta_contraoferta', 10)]
const OFERTA = { id: 'of-1', tienda_id: 'tienda-1', comprador_id: 'user-1', stock_id: 'e1', card_id: 'carta-1', market: 'WEST', idioma: 'es', estado_carta: 'NM', variante: 'normal', unidades: 1, precio_tienda: 40, precio: 38, turno: 'comprador', estado: 'abierta', envio: 'mano', envio_precio: 0, pago: 'bizum',
  pasos: [{ quien: 'comprador', que: 'ofrece', precio: 35 }, { quien: 'tienda', que: 'contraoferta', precio: 38 }], tienda: { nombre: 'RyuCards', username: 'ryu' }, comprador: { nombre: 'Ane', username: 'ane' }, cobro: null, coste: null }
const conConversacion = { conversations: [{ id: 'c1' }], conversation_participants: [{ conversation_id: 'c1', user_id: 'user-1' }, { conversation_id: 'c1', user_id: 'tienda-1' }], private_messages: MENSAJES }
{
  const { p, ctx, errs } = await abrir('/mensajes.html?c=c1', { filas: conConversacion, rpc: { tienda_oferta_ver: { ...OFERTA, soy: 'comprador' }, tienda_oferta_responder: { ...OFERTA, estado: 'aceptada' } } })
  check('una tarjeta viva (en el último mensaje) y una línea para el de antes', !errs.length && (await p.locator('.msg-oft').count()) === 1 && (await p.locator('#msg-m2 .msg-oft').count()) === 1 && (await p.locator('#msg-m1 .msg-oft-linea').count()) === 1, errs.join(' | '))
  check('  …con la carta del catálogo, su estado y los pasos en tu boca', /Pikachu ex/.test(await p.textContent('.msg-oft-que')) && (await p.getAttribute('.msg-oft .chapa-estado', 'data-estado')) === 'NM' && /Ofreciste · 35,00 €/.test(await p.textContent('.msg-oft-pasos')) && /RyuCards contraofertó · 38,00 €/.test(await p.textContent('.msg-oft-pasos')))
  check('  …te toca: «Aceptar 38,00 €», «Ofrecer otro» y «Retirar»; sin el Bizum todavía', /Te contraofertan/.test(await p.textContent('.msg-oft-chapa')) && /Aceptar 38,00\s€/.test(await p.textContent('.msg-oft-acciones')) && (await p.locator('[data-oferta-accion="contra"]').count()) === 1 && (await p.locator('[data-oferta-accion="retirar"]').count()) === 1 && (await p.locator('.msg-oft-cobro').count()) === 0)
  await p.click('[data-oferta-accion="contra"]'); await p.waitForTimeout(200)
  await p.fill('.msg-oft-mas input', '36,5')
  await p.click('[data-oferta-accion="contra-ok"]'); await p.waitForTimeout(800)
  const r1 = (await llamadas(p, 'tienda_oferta_responder'))[0]
  check('«Ofrecer otro» se escribe debajo y manda la contraoferta', r1?.p_oferta === 'of-1' && r1.p_accion === 'contraoferta' && r1.p_precio === 36.5, JSON.stringify(r1))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes.html?c=c1', { filas: conConversacion, rpc: { tienda_oferta_ver: { ...OFERTA, soy: 'comprador', estado: 'aceptada', cobro: '600 11 22 33', reservada_hasta: new Date(ahora + 7 * 864e5).toISOString() } } })
  check('aceptada: «Págale 38,00 € por Bizum» con el número y «Copiar»; ya sin botones', /Págale\s*38,00\s€\s*por Bizum/.test(await p.textContent('.msg-oft-cobro')) && /600 11 22 33/.test(await p.textContent('.msg-oft-dato')) && (await p.locator('.msg-oft [data-oferta-accion]').count()) === 0)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes.html?c=c1', { sesion: 'tienda-1', perfil: { tipo: 'tienda', display_name: 'RyuCards', username: 'ryu' }, filas: conConversacion, rpc: { tienda_oferta_ver: { ...OFERTA, soy: 'tienda', turno: 'comprador', estado: 'aceptada', coste: 25, reservada_hasta: new Date(ahora + 7 * 864e5).toISOString() }, tienda_oferta_paso: { id: 'of-1', estado: 'pagada' } } })
  check('la tienda, aceptada: «Ya me ha pagado», «Entregada», «+7 días» y «Cancelar», y lo que le deja', (await p.locator('[data-oferta-accion="pagada"]').count()) === 1 && (await p.locator('[data-oferta-accion="hecha"]').count()) === 1 && (await p.locator('[data-oferta-accion="alargar"]').count()) === 1 && /te deja 13,00\s€/.test(await p.textContent('.msg-oft-resumen')))
  await p.click('[data-oferta-accion="pagada"]'); await p.waitForTimeout(800)
  check('  …«Ya me ha pagado» marca el paso', (await llamadas(p, 'tienda_oferta_paso'))[0]?.p_paso === 'pagada')
  await p.click('[data-oferta-accion="cancelar"]'); await p.waitForTimeout(200)
  check('  …cancelar pide confirmarlo debajo (sin confirm() del navegador)', /vuelve a tu stock/.test(await p.textContent('.msg-oft-mas')) && (await p.locator('[data-oferta-accion="cancelar-ok"]').count()) === 1)
  await ctx.close()
}

console.log('── La pestaña Ofertas y Cómo cobras ──')
const FILA = { ...OFERTA, turno: 'tienda', precio: 35, pasos: [{ quien: 'comprador', que: 'ofrece', precio: 35 }], coste: 25, nombre: 'Pikachu ex', caduca_at: new Date(ahora + 46 * 36e5).toISOString(), comprador: { id: 'user-1', username: 'ane', nombre: 'Ane' } }
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=ofertas', { sesion: 'tienda-1', perfil: { tipo: 'tienda', display_name: 'RyuCards', username: 'ryu' }, filas: { tiendas: [{ user_id: 'tienda-1', precio_visible: true }], tienda_stock: [{ id: 'e1', tienda_id: 'tienda-1' }] }, rpc: { tienda_ofertas_lista: { cuentas: { responder: 1, esperando: 0, reservadas: 2 }, filas: [FILA] }, tienda_oferta_responder: { ...FILA, turno: 'comprador', precio: 38 }, tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] }, tienda_hoy: {} } })
  check('sin errores: la pestaña con sus montones y cuántas', !errs.length && (await p.isVisible('#tdOfertas .tof')) && (await p.getAttribute('[data-tof="responder"]', 'aria-pressed')) === 'true' && (await p.textContent('[data-tof="responder"] .tof-n')) === '1' && (await p.textContent('[data-tof="reservadas"] .tof-n')) === '2', errs.join(' | '))
  check('  …la fila: «Te toca», @ane ofrece 35,00 € · pides 40,00 €, caduca y lo que te deja', /Te toca/.test(await p.textContent('.tof-fila')) && /@ane ofrece 35,00\s€/.test(await p.textContent('.tof-fila')) && /pides 40,00\s€/.test(await p.textContent('.tof-fila')) && /caduca en 46 h/.test(await p.textContent('.tof-fila')) && /te deja 10,00\s€/.test(await p.textContent('.tof-fila')))
  check('  …Aceptar, Contraoferta, Rechazar e «Ir al chat»', (await p.locator('.tof-fila [data-oferta-accion="aceptar"]').count()) === 1 && (await p.locator('.tof-fila [data-oferta-accion="rechazar"]').count()) === 1 && (await p.getAttribute('.tof-fila a[href^="/mensajes"]', 'href')) === '/mensajes.html?with=user-1')
  await p.click('.tof-fila [data-oferta-accion="contra"]'); await p.waitForTimeout(200)
  check('contraoferta: el precio y, al lado, lo que te costó', (await p.inputValue('.tof-fila .msg-oft-mas input')) === '35.00' && /Te costó 25,00\s€/.test(await p.textContent('.tof-fila .msg-oft-mas')))
  await p.fill('.tof-fila .msg-oft-mas input', '38')
  await p.click('.tof-fila [data-oferta-accion="contra-ok"]'); await p.waitForTimeout(800)
  const r = (await llamadas(p, 'tienda_oferta_responder'))[0]
  check('  …y la manda y vuelve a pedir la lista', r?.p_accion === 'contraoferta' && r.p_precio === 38 && (await llamadas(p, 'tienda_ofertas_lista')).length >= 2)
  await p.click('[data-tof="reservadas"]'); await p.waitForTimeout(500)
  check('cambiar de montón lo pide', (await llamadas(p, 'tienda_ofertas_lista')).at(-1).p_que === 'reservadas')
  check('Ofertas está en las barras de la tienda', (await p.locator('.nav-links a[data-ver="ofertas"]').count()) === 1)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=datos', { sesion: 'tienda-1', perfil: { tipo: 'tienda', display_name: 'RyuCards', username: 'ryu' }, rpc: { tienda_cobros_mios: { pagos: ['bizum', 'efectivo'], bizum: '600', paypal: null, minimo: 80 }, tienda_cobros_poner: { pagos: ['bizum'], minimo: null }, tienda_hoy: {} } })
  check('Datos: «Cómo cobras» con lo que tiene', (await p.isVisible('#tdCobrosForm')) && (await p.isChecked('[name="pago"][value="bizum"]')) && !(await p.isChecked('[name="pago"][value="paypal"]')) && (await p.inputValue('#tdCobroBizum')) === '600' && (await p.inputValue('#tdCobroMinimo')) === '80')
  await p.uncheck('[name="pago"][value="bizum"]'); await p.uncheck('[name="pago"][value="efectivo"]')
  await p.click('#tdCobrosForm [type="submit"]'); await p.waitForTimeout(300)
  check('  …sin ninguna forma, no guarda y lo dice', /al menos una/.test(await p.textContent('#tdCobrosError')) && (await llamadas(p, 'tienda_cobros_poner')).length === 0)
  await p.check('[name="pago"][value="paypal"]'); await p.fill('#tdCobroPaypal', 'paypal.me/ryu'); await p.selectOption('#tdCobroMinimo', '')
  await p.click('#tdCobrosForm [type="submit"]'); await p.waitForTimeout(600)
  const g = (await llamadas(p, 'tienda_cobros_poner'))[0]
  check('  …guarda lo elegido', JSON.stringify(g?.p_pagos) === '["paypal"]' && g.p_paypal === 'paypal.me/ryu' && g.p_minimo === null, JSON.stringify(g))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

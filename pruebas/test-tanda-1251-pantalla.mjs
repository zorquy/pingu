// Tanda 1251 — «Pedir fotos», en el navegador: en el pop-up de una copia sin
// fotos de verdad, «Pedir fotos de esta carta» (manda `tienda_pedir_fotos` y
// se queda en «Fotos pedidas»; si ya las pediste, sale así de entrada; con
// fotos, ni se ofrece; sin cuenta, a registrarse). En Mensajes, la línea con
// «Subir fotos» para la tienda (abre la hoja de frente y dorso) y «Ver las
// fotos» para quien las pidió. Y en la pestaña Ofertas, «Te piden fotos» con
// Subir, Ir al chat y Quitar.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
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


console.log('── En el pop-up ──')
{
  const M = await import(`${REPO}/js/mensajes-puro.js`)
  check('lo puro: el adjunto de las fotos', M.fotosTiendaDe({ adjuntos: [{ tipo: 'fotos_tienda', stock_id: 'e1', evento: 'fotos_pedidas' }] })?.evento === 'fotos_pedidas' && M.fotosTiendaDe({ adjuntos: [{ tipo: 'carta' }] }) === null)
}
{
  const { p, ctx, errs } = await abrir('/usuario.html?u=ryu&carta=carta-1', { rpc: { tienda_pedir_fotos: { id: 'fp-1' } } })
  check('una copia sin fotos: «Pedir fotos de esta carta»', !errs.length && (await p.locator('[data-ptc="pedir-fotos"]').count()) === 1, errs.join(' | '))
  await p.click('[data-ptc="pedir-fotos"]'); await p.waitForTimeout(700)
  const r = (await llamadas(p, 'tienda_pedir_fotos'))[0]
  check('  …las pide de ESA copia, lo dice y se queda en «Fotos pedidas»', r?.p_stock === 'e1' && (await p.locator('.toast', { hasText: 'Te avisamos' }).count()) === 1 && /Fotos pedidas/.test(await p.textContent('.ptc-pedidas')) && (await p.locator('[data-ptc="pedir-fotos"]').count()) === 0)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=ryu&carta=carta-1', { filas: { tienda_fotos_pedidas: [{ comprador_id: 'user-1', stock_id: 'e1', atendida_at: null }] } })
  check('si ya las pediste, sale «Fotos pedidas» de entrada', (await p.locator('.ptc-pedidas').count()) === 1 && (await p.locator('[data-ptc="pedir-fotos"]').count()) === 0)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=ryu&carta=carta-1', { filas: { tienda_stock_fotos: [{ stock_id: 'e1', frente: 'tienda-1/a.webp', dorso: 'tienda-1/b.webp' }] } })
  check('con fotos, se ven y no se ofrece pedirlas', (await p.locator('.ptc-fotos img').count()) === 2 && (await p.locator('.ptc-pedir').count()) === 0)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=ryu&carta=carta-1', { sesion: 'none' })
  check('sin cuenta: «Pedir fotos» lleva a crear cuenta', /^\/auth\.html\?registro=1/.test(await p.getAttribute('a.ptc-pedir', 'href')))
  await ctx.close()
}

console.log('── En Mensajes ──')
const ahora = Date.now()
const conFotos = (evento, de, body) => ({ conversations: [{ id: 'c1' }], conversation_participants: [{ conversation_id: 'c1', user_id: 'user-1' }, { conversation_id: 'c1', user_id: 'tienda-1' }],
  private_messages: [{ id: 'm1', conversation_id: 'c1', sender_id: de, body, created_at: new Date(ahora - 6e4).toISOString(), deleted_at: null, adjuntos: [{ tipo: 'fotos_tienda', stock_id: 'e1', evento }] }],
  tienda_stock_fotos: [{ stock_id: 'e1', frente: 'tienda-1/a.webp', dorso: null }] })
{
  const { p, ctx, errs } = await abrir('/mensajes.html?c=c1', { sesion: 'tienda-1', perfil: { tipo: 'tienda', display_name: 'RyuCards', username: 'ryu' }, filas: conFotos('fotos_pedidas', 'user-1', '¿Me enseñas fotos de Pikachu ex (ES · NM)?') })
  check('la tienda: «Te piden fotos» con «Subir fotos»', !errs.length && /Te piden fotos/.test(await p.textContent('.msg-oft-fotos')) && (await p.locator('[data-fotos-subir="e1"]').count()) === 1, errs.join(' | '))
  await p.click('[data-fotos-subir="e1"]'); await p.waitForTimeout(900)
  check('  …que abre la hoja de frente y dorso', await p.isVisible('#tdfDialogo[open]'))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes.html?c=c1', { filas: conFotos('fotos_subidas', 'tienda-1', 'Ya están las fotos que me pediste.') })
  check('quien las pidió: «Ya están las fotos» con «Ver las fotos»', /Ya están las fotos/.test(await p.textContent('.msg-oft-fotos')) && (await p.locator('[data-fotos-ver="e1"]').count()) === 1)
  await p.click('[data-fotos-ver="e1"]'); await p.waitForTimeout(900)
  check('  …que las enseña', await p.isVisible('#tdfVer[open]'))
  await ctx.close()
}

console.log('── La pestaña Ofertas ──')
{
  const PEDIDA = { id: 'fp-1', stock_id: 'e1', created_at: new Date(ahora - 36e5).toISOString(), comprador: { id: 'user-1', username: 'ane', nombre: 'Ane' }, card_id: 'carta-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, precio: 40, nombre: 'Pikachu ex' }
  const { p, ctx, errs } = await abrir('/tienda.html?ver=ofertas', { sesion: 'tienda-1', perfil: { tipo: 'tienda', display_name: 'RyuCards', username: 'ryu' }, filas: { tiendas: [{ user_id: 'tienda-1', precio_visible: true }], tienda_stock: [{ id: 'e1', tienda_id: 'tienda-1' }] }, rpc: { tienda_ofertas_lista: { cuentas: {}, filas: [] }, tienda_fotos_pedidas_lista: [PEDIDA], tienda_fotos_quitar: null, tienda_hoy: {} } })
  check('«Te piden fotos» arriba, con quién y la carta', !errs.length && /Te piden fotos/.test(await p.textContent('.tof-fotos h3')) && /@ane quiere verla/.test(await p.textContent('.tof-foto-fila')) && (await p.getAttribute('.tof-foto-fila .chapa-estado', 'data-estado')) === 'NM', errs.join(' | '))
  check('  …«Ir al chat» a su conversación', (await p.getAttribute('.tof-foto-fila a[href^="/mensajes"]', 'href')) === '/mensajes.html?with=user-1')
  await p.click('[data-tof-subir="fp-1"]'); await p.waitForTimeout(900)
  check('  …«Subir fotos» abre la hoja', await p.isVisible('#tdfDialogo[open]'))
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  await p.click('[data-tof-quitar="fp-1"]'); await p.waitForTimeout(600)
  check('  …«Quitar» la da por vista', (await llamadas(p, 'tienda_fotos_quitar'))[0]?.p_id === 'fp-1' && (await llamadas(p, 'tienda_fotos_pedidas_lista')).length >= 2)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

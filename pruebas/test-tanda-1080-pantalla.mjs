// Tanda 1080 — «Me interesa»: desde el escaparate de una tienda, una
// conversación con la carta dentro. Lo puro (las cartas de un mensaje, el
// adjunto sin el coste, la línea de la bandeja); el botón de cada carta (y a
// registrarse sin cuenta, ni en la previa ni para la propia tienda); el
// cuadro de escribir con la carta puesta y su «quitar»; el mensaje la lleva
// y la pinta con la foto del CATÁLOGO (no la que diga el adjunto) y todo
// escapado; y la tienda ve «Vender esta carta», que abre Vender con la
// línea de su stock (o dice que ya no está).
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
  const P = await import(`${REPO}/js/mensajes-puro.js`)
  const a = P.adjuntoDeCarta({ id: 'st-1', card_id: 'sv3-1', market: 'WEST', nombre: 'Pikachu ex', idioma: 'es', estado: 'NM', variante: 'normal', precio: '12.5', coste: 3, unidades: 4 }, 'tienda-1')
  check('el adjunto: lo que hace falta, el precio en número y nada del coste ni las unidades', a.tipo === 'carta' && a.stock_id === 'st-1' && a.tienda === 'tienda-1' && a.precio === 12.5 && !('coste' in a) && !('unidades' in a))
  const m = { body: 'hola', adjuntos: [a, { ruta: 'c1/x.webp', w: 1, h: 1 }, { tipo: 'carta' }] }
  check('las cartas de un mensaje (sin las mal formadas) y las fotos, cada una por su lado', P.cartasDe(m).length === 1 && P.adjuntosDe(m).length === 1)
  check('la bandeja: «Tú: Carta: Pikachu ex · Foto · hola»', P.resumenDeUltimo(m, true).texto === 'Tú: Carta: Pikachu ex · Foto · hola')
}

const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const LINEA = { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, precio: 30, entro_el: hace(1) }
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-1', mensajes = [], stock = [LINEA] } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.sesion === 'user-2') { window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }; localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}') }
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = {
      tiendas: [{ user_id: 'user-2', precio_visible: true }],
      tienda_stock: d.stock.map((f) => ({ ...f, tienda_id: 'user-2', coste: 10, visible: true })),
      conversations: [{ id: 'c1' }],
      conversation_participants: [{ conversation_id: 'c1', user_id: 'user-1' }, { conversation_id: 'c1', user_id: 'user-2' }],
      private_messages: d.mensajes,
    }
    window.__FAKE_CARTAS__ = [{ id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '1', name: 'Mew ex', image_path: 'sv/sv3/1' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = {
      tienda_escaparate: (a) => {
        const filas = [d.LINEA, { ...d.LINEA, id: 'st-2', card_id: 'carta-1', idioma: 'en' }]
        const v = a.p_filtros?.id ? filas.filter((f) => f.id === a.p_filtros.id) : filas
        return { total: v.length, en_escaparate: 2, de_tu_lista: 0, precios: true, facetas: {}, filas: v }
      },
      tienda_stock_lista: { total: 0, en_stock: 0, sumas: {}, facetas: {}, filas: [] },
    }
  }, { sesion, mensajes, stock, LINEA })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex|malo\.example/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}

console.log('── El botón del escaparate ──')
{
  const { p, ctx, errs } = await abrir('/usuario/rincon')
  const href = await p.getAttribute('.pt-rejilla .pt-carta:first-child .pt-interesa', 'href')
  check('cada carta lleva «Me interesa», a la conversación con esa línea', !errs.length && (await p.locator('.pt-rejilla .pt-interesa').count()) === 2 && href === '/mensajes.html?with=user-2&carta=st-1', errs.join(' | ') || href)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario/rincon', { sesion: 'none' })
  const href = await p.getAttribute('.pt-rejilla .pt-interesa', 'href')
  check('sin cuenta, a registrarse y de vuelta a la conversación', /^\/auth\.html\?registro=1&volver=%2Fmensajes\.html%3Fwith%3Duser-2%26carta%3Dst-1$/.test(href), href)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=escaparate', { sesion: 'user-2' })
  await p.waitForTimeout(800)
  check('en la previa de la propia tienda, no', (await p.locator('.pt-carta').count()) > 0 && (await p.locator('.pt-interesa').count()) === 0)
  await ctx.close()
}

console.log('── Quien pregunta ──')
{
  const { p, ctx, errs } = await abrir('/mensajes.html?with=user-2&carta=st-1')
  await p.waitForTimeout(800)
  check('la carta puesta en el cuadro (con la foto del catálogo) y el saludo escrito', !errs.length && (await p.isVisible('#msgCartaPendiente .msg-carta')) && /Mew ex/.test(await p.textContent('#msgCartaPendiente')) && (await p.locator('#msgCartaPendiente img').count()) === 1 && /Me interesa esta carta/.test(await p.inputValue('#msgBody')), errs.join(' | '))
  await p.click('#msgCartaPendiente [data-quitar-carta]')
  check('  …se puede quitar', await p.isHidden('#msgCartaPendiente'))
  await p.goto(`${BASE}/mensajes.html?with=user-2&carta=st-1`); await p.waitForTimeout(3000)
  await p.fill('#msgBody', '')
  await p.click('#btnSendMsg'); await p.waitForTimeout(1200)
  const m = await p.evaluate(() => window.__TABLAS__.private_messages.at(-1))
  check('se manda sin texto: el mensaje es la carta (sin coste)', m?.body === '' && m.adjuntos?.length === 1 && m.adjuntos[0].stock_id === 'st-1' && m.adjuntos[0].precio === 30 && !('coste' in m.adjuntos[0]), JSON.stringify(m))
  check('  …y sale en tu burbuja, «Te interesa», sin «Vender»', (await p.locator('.msg-burbuja.mia .msg-carta').count()) === 1 && /Te interesa/.test(await p.textContent('.msg-burbuja.mia .msg-carta')) && (await p.locator('[data-vender-carta]').count()) === 0 && (await p.isHidden('#msgCartaPendiente')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes.html?with=user-2&carta=st-9')
  await p.waitForTimeout(800)
  check('una línea que ya no está en el escaparate: nada puesto, y se dice', (await p.isHidden('#msgCartaPendiente')) && /ya no está en su escaparate/.test(await p.textContent('body')))
  await ctx.close()
}

console.log('── La tienda ──')
const MENSAJE = { id: 'm1', conversation_id: 'c1', sender_id: 'user-1', body: 'hola', created_at: new Date().toISOString(), deleted_at: null,
  adjuntos: [{ tipo: 'carta', stock_id: 'st-1', tienda: 'user-2', card_id: 'carta-1', market: 'WEST', nombre: '<img src=x onerror=window.__XSS__=1>', idioma: 'es', estado: 'NM', variante: 'normal', precio: 30, imagen: 'https://malo.example/x.png' }] }
{
  const { p, ctx, errs } = await abrir('/mensajes.html?c=c1', { sesion: 'user-2', mensajes: [MENSAJE] })
  await p.waitForTimeout(800)
  check('«Le interesa», con el precio de cuando escribió y «Vender esta carta»', !errs.length && /Le interesa/.test(await p.textContent('.msg-carta')) && /30,00\s€\s*cuando escribió/.test(await p.textContent('.msg-carta')) && (await p.isVisible('[data-vender-carta="st-1"]')), errs.join(' | '))
  check('  …la foto es la del catálogo y lo escrito no se ejecuta', !(await p.evaluate(() => window.__XSS__)) && !(await p.locator('.msg-carta img[src*="malo.example"]').count()) && (await p.locator('.msg-carta img').count()) === 1)
  await p.click('[data-vender-carta="st-1"]'); await p.waitForTimeout(1500)
  check('Vender se abre con esa línea y su precio', (await p.locator('dialog.tdv[open]').count()) === 1 && (await p.inputValue('dialog.tdv [data-precio]')) === '30', await p.textContent('body').then((t) => t.slice(0, 0)))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes.html?c=c1', { sesion: 'user-2', mensajes: [MENSAJE], stock: [] })
  await p.waitForTimeout(800)
  await p.click('[data-vender-carta="st-1"]'); await p.waitForTimeout(1200)
  check('si la línea ya no está en su stock, lo dice y no abre Vender', /ya no está en tu stock/.test(await p.textContent('body')) && (await p.locator('dialog.tdv[open]').count()) === 0)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes.html?c=c1', { sesion: 'user-1', mensajes: [MENSAJE] })
  await p.waitForTimeout(800)
  check('a la persona no le sale «Vender» en un mensaje de otro con su carta', (await p.locator('[data-vender-carta]').count()) === 0)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

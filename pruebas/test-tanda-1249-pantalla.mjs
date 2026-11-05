// Tanda 1249 — comprar a una tienda empieza en SU escaparate: «Me interesa»,
// «En tiendas», /tiendas y el QR de una etiqueta abren la tienda ENTERA con el
// pop-up de la carta encima (ya no «Solo la carta que buscabas»); tocar una
// carta del escaparate abre ese pop-up (no la ficha de la colección), con sus
// copias, su estado, su precio, su SKU y «Me interesa». Y los siete estados de
// Cardmarket con su color en una chapa común; «Apartar» pasa a «Reservar».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const TIENDA = { id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda', avatar_url: null }
const FILAS = [
  { id: 'e1', card_id: 'carta-1', market: 'WEST', product_id: null, nombre: 'Carta 1', set_id: 'set-0', numero: '1', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, precio: 95, de_tu_lista: false },
  { id: 'e2', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', idioma: 'en', estado: 'EX', variante: 'reverse', gradeo: null, unidades: 2, precio: 30, de_tu_lista: false },
  { id: 'e2b', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, precio: 40, precio_antes: 50, oferta_hasta: '2026-12-01T00:00:00Z', de_tu_lista: false },
  { id: 'e3', card_id: 'carta-3', market: 'WEST', product_id: null, nombre: 'Carta 3', set_id: 'set-0', numero: '3', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: 'PSA 10', unidades: 1, precio: 300, de_tu_lista: false },
]
const CARTAS = Array.from({ length: 4 }, (_, i) => ({ id: `carta-${i}`, set_id: 'set-0', local_id: String(i), name: `Carta ${i}` }))
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF' }]

const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', movil = false, fotos = [] } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1360, height: 900 } })
  await ctx.addInitScript(([s, filas, cartas, sets, tienda, fotos]) => {
    window.__FAKE_SESSION__ = s
    // El escaparate filtra como la base: por carta y por línea (`carta`, `id`).
    window.__RPC_RESPUESTAS__ = {
      tienda_escaparate: (a) => {
        const f = a.p_filtros || {}
        const sale = filas.filter((x) => (!f.carta || x.card_id === f.carta) && (!f.id || x.id === f.id))
        return { total: sale.length, en_escaparate: filas.length, de_tu_lista: 0, precios: true, facetas: { catalogo: { WEST: filas.length }, idioma: { es: 3, en: 1 }, sets: { 'set-0': 4 } }, filas: sale }
      },
    }
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'tienda-1', ciudad: 'Bilbao', precio_visible: true }], tienda_stock_fotos: fotos }
    window.__FAKE_PERFILES__ = [tienda]
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_SETS__ = sets
  }, [sesion, FILAS, CARTAS, SETS, TIENDA, fotos])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2400)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)

console.log('── 1. Llegar con ?carta= abre la tienda entera y el pop-up ──')
{
  const { p, ctx, errs } = await abrir('/usuario.html?u=rincon&carta=carta-2&linea=e2b')
  check('sin errores', !errs.length, errs.join(' | '))
  const ls = await llamadas(p, 'tienda_escaparate')
  check('la rejilla es la tienda entera (sin filtro de carta)', JSON.stringify(ls[0].p_filtros) === '{}' && (await p.locator('.pt-rejilla .pt-carta').count()) === 4)
  check('ni rastro de «Solo la carta que buscabas»', (await p.locator('.pt-solo').count()) === 0 && !/Solo la carta que buscabas/.test(await p.textContent('body')))
  check('el pop-up de la tienda, abierto con esa carta', (await p.isVisible('dialog.ptc[open]')) && (await p.textContent('#ptcTitulo')) === 'Carta 2' && /El Rincón/.test(await p.textContent('.ptc-tienda')))
  check('  …con sus DOS copias para elegir, la del enlace elegida', (await p.locator('.ptc-op').count()) === 2 && (await p.getAttribute('[data-ptc-linea="e2b"]', 'aria-pressed')) === 'true')
  check('  …su estado en la chapa de color, idioma y «Queda 1»', (await p.getAttribute('.ptc-chapas .chapa-estado', 'data-estado')) === 'NM' && /Español/.test(await p.textContent('.ptc-chapas')) && /Queda 1/.test(await p.textContent('.ptc-chapas')))
  check('  …el precio de la oferta con el de antes tachado', /40,00\s€/.test(await p.textContent('.ptc-precio b')) && /50,00\s€/.test(await p.textContent('.ptc-precio s')) && /−20 %/.test(await p.textContent('.ptc-rebaja')))
  check('  …su SKU (colección, número, idioma, estado)', (await p.textContent('.ptc-sku span')) === 'OBF-2-ES-NM', await p.textContent('.ptc-sku span'))
  check('  …«Me interesa» a la conversación con ESA copia', (await p.getAttribute('.ptc-acciones a.btn-primary', 'href')) === '/mensajes.html?with=tienda-1&carta=e2b')
  check('  …y «Ficha completa» va a la ficha sin volver a abrir un pop-up', (await p.getAttribute('.ptc-ficha', 'data-ficha-completa')) !== null && /^\/carta\//.test(await p.getAttribute('.ptc-ficha', 'href')))
  check('ni el coste ni el beneficio en ningún sitio', !/coste|beneficio|margen/i.test(await p.textContent('dialog.ptc')))
  await p.click('[data-ptc-linea="e2"]'); await p.waitForTimeout(200)
  check('cambiar de copia: la inglesa EX reverse, a su precio y su SKU', (await p.getAttribute('.ptc-chapas .chapa-estado', 'data-estado')) === 'EX' && /30,00\s€/.test(await p.textContent('.ptc-precio')) && (await p.textContent('.ptc-sku span')) === 'OBF-2-EN-EX-R' && (await p.getAttribute('.ptc-acciones a.btn-primary', 'href')) === '/mensajes.html?with=tienda-1&carta=e2')
  await p.click('.ptc-cerrar'); await p.waitForTimeout(300)
  const url = new URL(p.url())
  check('al cerrar, la dirección se queda sin la carta (recargar no lo reabre)', !(await p.isVisible('dialog.ptc[open]')) && !url.searchParams.has('carta') && !url.searchParams.has('linea'), p.url())
  await ctx.close()
}

console.log('── 2. Tocar una carta del escaparate ──')
{
  const { p, ctx, errs } = await abrir('/usuario.html?u=rincon')
  check('sin pop-up al llegar', !(await p.isVisible('dialog.ptc[open]')))
  await p.click('.pt-rejilla .pt-carta:nth-child(4) .pt-foto'); await p.waitForTimeout(900)
  check('abre el pop-up de la TIENDA, no la ficha de la colección', (await p.isVisible('dialog.ptc[open]')) && !(await p.isVisible('#fichaRapida[open]')) && /\/(usuario|tiendas)/.test(p.url()) && !errs.length, errs.join(' | '))
  check('  …la gradeada con su cápsula y sin estado, y su SKU con la nota', (await p.locator('.ptc-chapas .chapa-gradeo[data-casa="PSA"]').count()) === 1 && (await p.locator('.ptc-chapas .chapa-estado').count()) === 0 && (await p.textContent('.ptc-sku span')) === 'OBF-3-ES-PSA10')
  check('  …una sola copia: sin opciones que elegir', (await p.locator('.ptc-op').count()) === 0)
  check('  …y la dirección dice qué carta está abierta', new URL(p.url()).searchParams.get('carta') === 'carta-3' && new URL(p.url()).searchParams.get('linea') === 'e3')
  await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  await p.click('.pt-rejilla .pt-carta:first-child .pt-interesa'); await p.waitForTimeout(900)
  check('«Me interesa» de la baldosa también abre el pop-up', (await p.isVisible('dialog.ptc[open]')) && (await p.textContent('#ptcTitulo')) === 'Carta 1')
  check('las baldosas llevan el estado en su chapa', (await p.locator('.pt-rejilla .pt-detalle .chapa-estado').count()) === 3)
  await ctx.close()
}

console.log('── 3. Una carta que ya no tiene, sin cuenta y en el móvil ──')
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon&carta=carta-9')
  check('una que ya no está: lo dice y enseña la tienda', !(await p.isVisible('dialog.ptc[open]')) && (await p.locator('.toast', { hasText: 'ya no está' }).count()) === 1 && !new URL(p.url()).searchParams.has('carta'))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon&carta=carta-1', { sesion: 'none' })
  check('sin cuenta: el pop-up se ve, y «Me interesa» pide cuenta y vuelve a la conversación', (await p.isVisible('dialog.ptc[open]')) && /^\/auth\.html\?registro=1&volver=%2Fmensajes\.html%3Fwith%3Dtienda-1%26carta%3De1$/.test(await p.getAttribute('.ptc-acciones a.btn-primary', 'href')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon&carta=carta-1', { sesion: 'tienda-1' })
  check('la propia tienda: sin «Me interesa»', (await p.isVisible('dialog.ptc[open]')) && (await p.locator('.ptc-acciones').count()) === 0 && /tu Stock/.test(await p.textContent('.ptc-nota')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon&carta=carta-2', { movil: true, fotos: [{ stock_id: 'e2', frente: 't/a.webp', dorso: 't/b.webp' }] })
  const caja = await p.locator('dialog.ptc').boundingBox()
  const vista = p.viewportSize()
  check('móvil: hoja pegada abajo y a lo ancho', caja && Math.abs(caja.y + caja.height - vista.height) < 2 && Math.abs(caja.width - vista.width) < 2, JSON.stringify(caja))
  check('  …la copia con fotos lleva sus miniaturas y se abren', (await p.locator('.ptc-fotos img').count()) === 2)
  await p.click('.ptc-fotos'); await p.waitForTimeout(600)
  check('  …encima del pop-up', await p.isVisible('#tdfVer[open]'))
  await ctx.close()
}

console.log('── 4. Los estados de Cardmarket ──')
{
  const { p, ctx } = await abrir('/usuario.html?u=rincon')
  const m = await p.evaluate(async () => {
    const { chapaDeEstadoHtml, textoDeEstado } = await import('/js/estado-chapa.js')
    const caja = document.createElement('div')
    caja.innerHTML = ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO', 'nm', 'XX'].map((e) => chapaDeEstadoHtml(e)).join('')
    document.body.append(caja)
    const lum = (rgb) => { const c = rgb.match(/\d+/g).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
    const contraste = (a, b2) => { const x = lum(a), y = lum(b2); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const chapas = [...caja.querySelectorAll('.chapa-estado')].map((c) => ({ e: c.dataset.estado, fondo: getComputedStyle(c).backgroundColor, c: contraste(getComputedStyle(c).color, getComputedStyle(c).backgroundColor), t: c.title }))
    return { chapas, texto: textoDeEstado('LP') }
  })
  check('siete chapas (y la minúscula vale; lo que no es un estado, nada)', m.chapas.length === 8 && m.chapas[7].e === 'NM', JSON.stringify(m.chapas.map((c) => c.e)))
  check('siete colores distintos', new Set(m.chapas.slice(0, 7).map((c) => c.fondo)).size === 7)
  check('la letra se lee en las siete (4,5:1 o más)', m.chapas.every((c) => c.c >= 4.5), m.chapas.map((c) => `${c.e} ${c.c.toFixed(2)}`).join(', '))
  check('el título dice el nombre y lo que significa', m.texto === 'Light Played · Desgaste severo' && m.chapas[0].t === 'Mint · Perfecta')
  await ctx.close()
}

console.log('── 5. Lo puro y los textos ──')
{
  const { skuDe, versionCorta } = await import(`${RAIZ}/js/tiendas-puro.js`)
  check('SKU: holo, gradeada, sin código de set, una Ball y lo sellado', skuDe({ numero: '276/217', idioma: 'es', estado: 'NM', variante: 'holo' }, 'asc') === 'ASC-276-ES-NM-H' && skuDe({ numero: '076', idioma: 'es', gradeo: 'PSA 10' }, 'ASC') === 'ASC-76-ES-PSA10' && skuDe({ numero: 'TG01', idioma: 'en', estado: 'EX', set_id: 'swsh12tg' }) === 'SWSH12TG-TG01-EN-EX' && versionCorta('master-ball') === 'MB' && skuDe({ product_id: 501, idioma: 'ja' }) === 'SEL-501-JA')
  const apartar = readFileSync(`${RAIZ}/js/tienda-apartar.js`, 'utf8')
  const stock = readFileSync(`${RAIZ}/js/tienda-stock.js`, 'utf8')
  const hoy = readFileSync(`${RAIZ}/js/tienda-hoy.js`, 'utf8')
  const msg = readFileSync(`${RAIZ}/js/mensajes-carta.js`, 'utf8')
  check('«Reservar» en la hoja, el Stock, el Panel y la conversación; ningún «Apartar» a la vista', /<h2 id="tdaTitulo">Reservar<\/h2>/.test(apartar) && /data-apartar-esta>Reservar</.test(stock) && /Reservadas <small/.test(hoy) && /data-apartar-carta="[^"]*">Reservar</.test(msg.replace(/\$\{[^}]*\}/g, '')) && ![apartar, stock, hoy, msg].some((t) => />Apartar<|'Apartad|`Apartad|> Apartadas/.test(t)))
  const perfil = readFileSync(`${RAIZ}/js/perfil-tienda.js`, 'utf8')
  check('el escaparate ya no filtra «solo esa carta»', !/pt-solo/.test(perfil) && !/filtros\.carta\s*=/.test(perfil))
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

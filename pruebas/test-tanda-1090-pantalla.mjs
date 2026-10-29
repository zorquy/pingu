// Tanda 1090 — la ficha de una línea del stock: la foto de la carta (o del
// producto) debajo de su nombre, y «Ver en Cardmarket» para comprobar el
// precio, que es orientativo: con el id del producto, el idioma, el estado y
// la versión que tenga el formulario, y que cambia al cambiarlos.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const LISTA = {
  total: 4, en_stock: 5,
  sumas: { unidades: 10, coste: 752, precio: 1046.7, cm: 1099.4, sin_coste: 1, sin_precio: 1 },
  facetas: {
    catalogo: { WEST: 4, sellado: 1 },
    sets: { 'set-0': 3, 'set-1': 1 },
    idioma: { es: 3, en: 2 },
    estado: { NM: 3, EX: 1, sellado: 1 },
    variante: { normal: 4, reverse: 1 },
    rareza: { 'Special Illustration Rare': 2, Common: 1 },
    ubicacion: { Vitrina: 2, 'Caja comunes': 1 },
  },
  filas: [
    { id: 'st-1', card_id: 'carta-1', market: 'WEST', product_id: null, nombre: 'Carta 1', set_id: 'set-0', numero: '1', rareza: 'Special Illustration Rare', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, coste: 62, precio: 95, cm: 88.4, ubicacion: 'Vitrina', visible: true, notas: null, entro_el: hace(12) },
    { id: 'st-2', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', rareza: 'Special Illustration Rare', idioma: 'en', estado: 'NM', variante: 'reverse', gradeo: 'PSA 10', unidades: 2, coste: 210, precio: 279, cm: 301.5, ubicacion: 'Vitrina', visible: true, notas: null, entro_el: hace(34) },
    { id: 'st-3', card_id: 'carta-3', market: 'WEST', product_id: null, nombre: 'Carta 3', set_id: 'set-0', numero: '3', rareza: 'Common', idioma: 'es', estado: 'EX', variante: 'normal', gradeo: null, unidades: 1, coste: 18, precio: 16, cm: 21, ubicacion: null, visible: true, notas: null, entro_el: hace(128) },
    { id: 'st-4', card_id: null, market: 'WEST', product_id: 501, nombre: 'ETB de prueba', set_id: null, numero: null, rareza: null, idioma: 'en', estado: 'sellado', variante: 'normal', gradeo: null, unidades: 6, coste: 44, precio: null, cm: 71, ubicacion: null, visible: false, notas: null, entro_el: hace(9) },
  ],
}
const VACIA = { total: 0, en_stock: 0, sumas: { unidades: 0, coste: 0, precio: 0, cm: 0, sin_coste: 0, sin_precio: 0 }, facetas: {}, filas: [] }
const CARTAS = Array.from({ length: 6 }, (_, i) => ({ id: `carta-${i}`, set_id: i < 5 ? 'set-0' : 'set-1', local_id: String(i), name: i === 4 ? 'Pikachu ex' : `Carta ${i}`, rarity: 'Common', variants: { normal: true, reverse: true } }))
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF', release_date: '2023-08-11' }, { id: 'set-1', name: 'Surging Sparks', market: 'WEST', tcg_online_code: 'SSP', release_date: '2024-11-08' }]

const b = await chromium.launch()
async function abrir({ lista = LISTA, ruta = '/tienda.html?ver=stock', movil = false, vistas = [], precios = [] } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], acceptDownloads: true, serviceWorkers: 'block' } : { viewport: { width: 1360, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' })
  await ctx.addInitScript(([l, v, c, s, pr]) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1', precio_visible: true }], tienda_vistas: v, tcg_products: [{ id: 501, name: 'ETB de prueba', image: 'https://ejemplo.test/etb.png', cardmarket_id: 777001, lang: 'en', market: 'WEST', cm_lowest: 70, cm_lowest_eu: 71 }] }
    window.__FAKE_CARTAS__ = c
    window.__FAKE_SETS__ = s
    window.__FAKE_PRECIOS__ = pr
    window.__FAKE_IDIOMAS_SET__ = { 'set-0': ['de', 'en', 'es', 'fr', 'it'] }
    window.__RPC_RESPUESTAS__ = { tienda_stock_lista: l, tienda_stock_precio_bloque: { cambiadas: 2, sin_cardmarket: 1 }, idiomas_de_set: ['es', 'en', 'fr', 'de', 'it'] }
  }, [lista, vistas, CARTAS, SETS, precios])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)

const PRECIOS = [{ card_id: 'carta-2', cm_id_product: 654321, cm_low: 290, cm_low_es: 301.5, cm_low_en: 290 }]

for (const movil of [false, true]) {
  const donde = movil ? 'móvil' : 'PC'
  console.log(`── ${donde} ──`)
  const { p, ctx, errs } = await abrir({ precios: PRECIOS, movil })
  // Las fotos de fuera, servidas aquí (la red del contenedor no llega): si
  // no, la cadena de escaneos se rinde y quita la imagen (la 441).
  await p.route((u) => !String(u).startsWith(BASE) && /^https?:/.test(String(u)), (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#0b7285"/></svg>' }))
  await p.click('tr[data-fila="st-2"] .tds-c-nombre strong'); await p.waitForTimeout(900)
  check(`${donde}: sin errores`, !errs.length, errs.join(' | '))
  const r = await p.evaluate(() => {
    const d = document.querySelector('#tdsEditar')
    const t = d.querySelector('.tds-form-titulo').getBoundingClientRect()
    const f = d.querySelector('.tds-form-foto')
    const fr = f?.getBoundingClientRect()
    return { foto: !!f?.querySelector('img'), debajo: fr ? fr.top >= t.bottom - 1 : false, ancho: fr ? Math.round(fr.width) : 0, alto: fr ? Math.round(fr.height) : 0, sale: document.documentElement.scrollWidth <= innerWidth }
  })
  await p.screenshot({ path: `/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/vis/visual/1090-carta-${movil ? 'm' : 'pc'}.png` })
  check(`${donde}: la carta, debajo de su nombre y con su forma`, r.foto && r.debajo && r.ancho >= 100 && r.alto > r.ancho, JSON.stringify(r))
  const href = await p.getAttribute('#tdsEditar .tds-cm-ver', 'href')
  check(`${donde}: «Ver en Cardmarket» a ESA carta, en su idioma, estado y versión`, /idProduct=654321/.test(href || '') && /language=1\b/.test(href) && /isReverseHolo=Y/.test(href) && (await p.getAttribute('#tdsEditar .tds-cm-ver', 'target')) === '_blank', href)
  check(`${donde}: dice que el precio es orientativo`, /orientativo/.test(await p.textContent('#tdsEditar [data-cm]')))
  await p.selectOption('#tdsEditar [name="idioma"]', 'es'); await p.waitForTimeout(200)
  const href2 = await p.getAttribute('#tdsEditar .tds-cm-ver', 'href')
  check(`${donde}: al cambiar el idioma, el enlace cambia con él`, /language=4\b/.test(href2 || '') && href2 !== href, href2)
  await p.selectOption('#tdsEditar [name="estado"]', 'EX'); await p.waitForTimeout(200)
  check(`${donde}: y con el estado`, (await p.getAttribute('#tdsEditar .tds-cm-ver', 'href')) !== href2)
  check(`${donde}: sin salirse de ancho`, r.sale)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  await p.click('tr[data-fila="st-4"] .tds-c-nombre strong'); await p.waitForTimeout(900)
  const pr = await p.evaluate(() => { const f = document.querySelector('#tdsEditar .tds-form-foto-producto'); const r = f?.getBoundingClientRect(); return { img: f?.querySelector('img')?.getAttribute('src'), ancho: Math.round(r?.width || 0), alto: Math.round(r?.height || 0) } })
  check(`${donde}: un producto, con su foto cuadrada`, pr.img === 'https://ejemplo.test/etb.png' && pr.ancho === pr.alto && pr.ancho >= 120, JSON.stringify(pr))
  check(`${donde}: y su enlace a Cardmarket`, /idProduct=777001/.test((await p.getAttribute('#tdsEditar .tds-cm-ver', 'href')) || ''))
  if (!movil) await p.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/vis/visual/1090-producto.png' })
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

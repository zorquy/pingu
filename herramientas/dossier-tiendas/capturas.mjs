// Capturas reales del panel de una tienda para el dossier y /para-tiendas
// (1281). Con las cuatro cartas reales de PINGU y una tienda de ejemplo.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const SAL = process.argv[2]
const SOLO = process.argv[3] ? process.argv[3].split(',') : null
const img = (n) => 'http://localhost:8892/carrusel-arte/real-' + n + '.webp'
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const hoy = new Date().toISOString()
const CARTAS = [
  { id: 'carta-1', set_id: 'obf', market: 'WEST', local_id: '223', name: 'Charizard ex', image_path: img('charizard'), rarity: 'Special Illustration Rare' },
  { id: 'carta-2', set_id: 'ssp', market: 'WEST', local_id: '238', name: 'Pikachu ex', image_path: img('pikachu'), rarity: 'Special Illustration Rare' },
  { id: 'carta-3', set_id: 'pre', market: 'WEST', local_id: '161', name: 'Umbreon ex', image_path: img('umbreon'), rarity: 'Special Illustration Rare' },
  { id: 'carta-4', set_id: 'svp', market: 'WEST', local_id: '53', name: 'Mew ex', image_path: img('mew'), rarity: 'Promo' },
]
const SETS = [
  { id: 'obf', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF' }, { id: 'ssp', name: 'Surging Sparks', market: 'WEST', tcg_online_code: 'SSP' },
  { id: 'pre', name: 'Prismatic Evolutions', market: 'WEST', tcg_online_code: 'PRE' }, { id: 'svp', name: 'SV Black Star Promos', market: 'WEST', tcg_online_code: 'SVP' },
]
const NOM = { 'carta-1': ['Charizard ex', 'obf', '223'], 'carta-2': ['Pikachu ex', 'ssp', '238'], 'carta-3': ['Umbreon ex', 'pre', '161'], 'carta-4': ['Mew ex', 'svp', '53'] }
const S = (id, card, o) => ({ id, card_id: card, market: 'WEST', nombre: NOM[card][0], set_id: NOM[card][1], numero: NOM[card][2], rareza: 'Special Illustration Rare', idioma: 'en', estado: 'NM', variante: 'holo', unidades: 1, visible: true, entro_el: hace(4), ...o })
const STOCK = [
  S('st-1', 'carta-3', { coste: 820, precio: 1150, cm: 1120, ubicacion: 'Vitrina 1', entro_el: hace(12) }),
  S('st-2', 'carta-3', { gradeo: 'PSA 10', coste: 1700, precio: 2400, cm: 2350, ubicacion: 'Vitrina 1', entro_el: hace(30) }),
  S('st-3', 'carta-2', { unidades: 2, coste: 290, precio: 420, cm: 395, ubicacion: 'Vitrina 2', entro_el: hace(6) }),
  S('st-4', 'carta-2', { idioma: 'es', estado: 'EX', coste: 240, precio: 360, cm: 350, ubicacion: 'Carpeta A', entro_el: hace(2) }),
  S('st-5', 'carta-1', { unidades: 3, coste: 52, precio: 79.9, precio_antes: 95, oferta_hasta: hace(-14), cm: 72, ubicacion: 'Carpeta A', entro_el: hace(20) }),
  S('st-6', 'carta-1', { idioma: 'es', coste: 50, precio: 84, cm: 80, ubicacion: 'Carpeta A', entro_el: hace(100) }),
  S('st-7', 'carta-4', { rareza: 'Promo', unidades: 6, coste: 6, precio: 14.9, cm: 12, ubicacion: 'Caja promos', entro_el: hace(9) }),
  S('st-8', 'carta-4', { rareza: 'Promo', idioma: 'es', unidades: 4, coste: 5, precio: 13.5, cm: 11, ubicacion: 'Caja promos', visible: false, entro_el: hace(1) }),
]
const sumas = { unidades: STOCK.reduce((a, s) => a + s.unidades, 0), coste: STOCK.reduce((a, s) => a + s.unidades * s.coste, 0), valor: STOCK.reduce((a, s) => a + s.unidades * s.precio, 0), cm: STOCK.reduce((a, s) => a + s.unidades * s.cm, 0) }
const LISTA = { total: STOCK.length, en_stock: sumas.unidades, sumas, facetas: { catalogo: { WEST: 8 }, sets: { pre: 2, ssp: 2, obf: 2, svp: 2 }, idioma: { en: 5, es: 3 }, estado: { NM: 7, EX: 1 }, rareza: { 'Special Illustration Rare': 6, Promo: 2 }, ubicacion: { 'Vitrina 1': 2, 'Vitrina 2': 1, 'Carpeta A': 3, 'Caja promos': 2 } }, filas: STOCK }
const TS = STOCK.map((s) => ({ id: s.id, tienda_id: 'user-2', card_id: s.card_id, market: 'WEST', idioma: s.idioma, estado: s.estado, variante: s.variante, gradeo: s.gradeo || null, unidades: s.unidades, coste: s.coste, precio: s.precio, por_poner: false, visible: s.visible, ubicacion: s.ubicacion, entro_el: s.entro_el }))
TS.push({ id: 'pp1', tienda_id: 'user-2', card_id: 'carta-4', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'holo', unidades: 2, coste: 8, valorado: 12, precio: null, por_poner: true, visible: false, entro_el: hoy })
const VENTAS = [['a', 'carta-3', 1150, 'bizum', 820], ['b', 'carta-2', 420, 'efectivo', 290], ['c', 'carta-1', 79.9, 'tarjeta', 52], ['d', 'carta-4', 14.9, 'efectivo', 6]]
  .map(([t, id, pr, pago, co], i) => ({ ticket: t, tienda_id: 'user-2', card_id: id, market: 'WEST', idioma: 'en', estado: 'NM', variante: 'holo', unidades: 1, precio: pr, coste: co, pago, precio_lista: pr, donde: i === 0 ? 'pokedoc' : 'mostrador', vendida_el: new Date(Date.now() - i * 2400000).toISOString(), created_at: hoy }))
const COMPRAS = [{ ticket: 'e', tienda_id: 'user-2', card_id: 'carta-4', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'holo', unidades: 2, coste: 8, pago: 'efectivo', comprada_el: hoy, created_at: hoy }]
const HOY = { actual: { importe: 1664.8, ventas: 4, beneficio: 496.7, coste: 1168, sin_coste: 0 }, anterior: { importe: 980, ventas: 3, beneficio: 300 }, serie: [0, 0, 79.9, 0, 14.9, 420, 0, 1150, 0, 0].map((v, i) => ({ t: new Date().toISOString().slice(0, 10) + 'T' + String(10 + i).padStart(2, '0') + ':00:00', importe: v })), paso: 'hour', stock: { valor: 18450, unidades: 312, lineas: 248, coste: 12900 }, visitas: { actual: 86, anterior: 61 }, avisos: { bajo_cm: 1, viejas: 1 },
  demanda: [{ card_id: 'carta-3', market: 'WEST', nombre: 'Umbreon ex', set_id: 'pre', numero: '161', quieren: 14, tienes: 2 }, { card_id: 'carta-2', market: 'WEST', nombre: 'Pikachu ex', set_id: 'ssp', numero: '238', quieren: 9, tienes: 3 }, { card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'obf', numero: '223', quieren: 6, tienes: 4 }] }
const PRECIOS = [['carta-3', 1120, 1180], ['carta-2', 395, 410], ['carta-1', 72, 78], ['carta-4', 12, 13.5]].map(([id, lo, tr]) => ({ card_id: id, market: 'WEST', cm_low: lo, cm_trend: tr, cm_avg30: tr, cm_low_holo: lo, cm_trend_holo: tr, updated_at: hoy }))

const b = await chromium.launch()
async function abrir(ruta, { movil = false, oscuro = false, ancho = 1280, alto = 800 } = {}) {
  const base = movil ? { ...devices['iPhone 13'], viewport: { width: 390, height: 797 } } : { viewport: { width: ancho, height: alto }, deviceScaleFactor: 2 }
  const ctx = await b.newContext({ ...base, colorScheme: oscuro ? 'dark' : 'light', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Tu tienda', username: 'tutienda' }
    try { localStorage.setItem('pd-tienda', '{"u":"tutienda","id":"user-2"}'); localStorage.setItem('pokedoc-theme', d.oscuro ? 'dark' : 'light') } catch {}
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'tutienda', display_name: 'Tu tienda', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle Mayor 12', con_local: true, precio_visible: true }], tienda_stock: d.TS, tienda_ventas: d.VENTAS, tienda_compras: d.COMPRAS, tcg_card_prices: d.PRECIOS }
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_SETS__ = d.SETS
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: d.LISTA, tienda_hoy: d.HOY, tienda_reservas_al_dia: 0,
      tienda_vender: { ticket: 'z', lineas: 1, total: 1150, beneficio: 330, sin_coste: 0, rebaja: 0, pago: 'bizum' },
    }
  }, { TS, VENTAS, COMPRAS, PRECIOS, CARTAS, SETS, LISTA, HOY, oscuro })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('E', ruta, e.message))
  await p.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  await p.addStyleTag({ content: '.progreso-pagina{display:none!important} .toast-container,.toast{display:none!important}' })
  return { p, ctx }
}
const toca = (n) => !SOLO || SOLO.includes(n)
const foto = async (p, n, opc = {}) => { await p.waitForTimeout(400); await p.screenshot({ path: `${SAL}/${n}.png`, ...opc }); console.log(n) }

if (toca('pc-panel')) { const { p, ctx } = await abrir('/tienda'); await foto(p, 'pc-panel'); await ctx.close() }
if (toca('pc-stock')) { const { p, ctx } = await abrir('/tienda?ver=stock'); await foto(p, 'pc-stock'); await ctx.close() }
if (toca('pc-vender')) {
  const { p, ctx } = await abrir('/tienda')
  await p.click('.tdm-p-vender'); await p.waitForTimeout(700)
  await p.fill('#tdvBusca', 'umbreon'); await p.waitForTimeout(1000)
  await p.click('.tdv-resultado').catch(() => {}); await p.waitForTimeout(600)
  await foto(p, 'pc-vender'); await ctx.close()
}
if (toca('pc-comprar')) {
  const { p, ctx } = await abrir('/tienda')
  await p.click('.tdm-p-comprar'); await p.waitForTimeout(900)
  await foto(p, 'pc-comprar'); await ctx.close()
}
if (toca('pc-caja')) {
  const { p, ctx } = await abrir('/tienda')
  await p.click('.tdh-pendientes a:has-text("Caja de hoy")').catch(() => {}); await p.waitForTimeout(1000)
  await foto(p, 'pc-caja'); await ctx.close()
}
if (toca('pc-comprar2')) {
  const { p, ctx } = await abrir('/tienda')
  await p.click('.tdm-p-comprar'); await p.waitForTimeout(900)
  await p.fill('#tdcBusca', 'charizard').catch(() => {}); await p.waitForTimeout(1500)
  await p.click('.tdc .tdv-resultado, .tdc [data-resultado]').catch((e) => console.log('sin resultado', e.message.slice(0, 80))); await p.waitForTimeout(800)
  await foto(p, 'pc-comprar2'); await ctx.close()
}
if (toca('pc-etiquetas')) {
  const { p, ctx } = await abrir('/tienda?ver=stock')
  await p.click('[data-tds-menu="mas"]'); await p.click('.tds-menu [data-tds="etiquetas"]'); await p.waitForTimeout(300)
  for (const id of ['st-1', 'st-3', 'st-5', 'st-7']) await p.click(`[data-fila="${id}"]`, { position: { x: 30, y: 30 } }).catch(() => {})
  await p.waitForTimeout(300)
  await p.click('.tds-sel [data-bloque="etiquetas"]').catch((e) => console.log('etq', e.message.slice(0, 80))); await p.waitForTimeout(1800)
  await foto(p, 'pc-etiquetas'); await ctx.close()
}
if (toca('pc-anadir')) {
  const { p, ctx } = await abrir('/tienda?ver=stock')
  await p.click('.tds-anadir, [data-tds-menu="anadir"]').catch((e) => console.log('anadir', e.message.slice(0, 80))); await p.waitForTimeout(600)
  await foto(p, 'pc-anadir'); await ctx.close()
}
if (toca('m-stock')) { const { p, ctx } = await abrir('/tienda?ver=stock', { movil: true, oscuro: true }); await foto(p, 'm-stock'); await ctx.close() }
if (toca('m-panel')) { const { p, ctx } = await abrir('/tienda', { movil: true, oscuro: true }); await foto(p, 'm-panel'); await ctx.close() }
await b.close()

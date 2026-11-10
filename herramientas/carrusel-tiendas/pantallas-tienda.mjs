// Capturas reales del escaparate de una tienda y del Mercado (iPhone, oscuro).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const SAL = process.argv[2]
const img = (n) => 'http://localhost:8892/carrusel-arte/real-' + n + '.webp'
const CARTAS = [
  { id: 'carta-1', set_id: 'obf', local_id: '223', name: 'Charizard ex', image_path: img('charizard'), rarity: 'Special Illustration Rare' },
  { id: 'carta-2', set_id: 'ssp', local_id: '238', name: 'Pikachu ex', image_path: img('pikachu'), rarity: 'Special Illustration Rare' },
  { id: 'carta-3', set_id: 'pre', local_id: '161', name: 'Umbreon ex', image_path: img('umbreon'), rarity: 'Special Illustration Rare' },
  { id: 'carta-4', set_id: 'svp', local_id: '53', name: 'Mew ex', image_path: img('mew'), rarity: 'Promo' },
]
const SETS = [
  { id: 'obf', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF' }, { id: 'ssp', name: 'Surging Sparks', market: 'WEST', tcg_online_code: 'SSP' },
  { id: 'pre', name: 'Prismatic Evolutions', market: 'WEST', tcg_online_code: 'PRE' }, { id: 'svp', name: 'SV Black Star Promos', market: 'WEST', tcg_online_code: 'SVP' },
]
const L = (id, card, nombre, set, num, precio, extra = {}) => ({ id, card_id: card, market: 'WEST', product_id: null, nombre, set_id: set, numero: num, idioma: 'en', estado: 'NM', variante: 'holo', gradeo: null, unidades: 1, precio, de_tu_lista: false, destacada: true, ...extra })
const ESCAPARATE = [
  L('e1', 'carta-1', 'Charizard ex', 'obf', '223', 79.9, { precio_antes: 95, oferta_hasta: '2026-12-01T00:00:00Z' }),
  L('e3', 'carta-3', 'Umbreon ex', 'pre', '161', 1150),
  L('e2', 'carta-2', 'Pikachu ex', 'ssp', '238', 420, { unidades: 2 }),
  L('e4', 'carta-4', 'Mew ex', 'svp', '53', 14.9, { unidades: 3 }),
]
const T = (id, username, display_name, extra = {}) => ({ user_id: id, username, display_name, tienda: true, ...extra })
const MERCADO = [
  { card_id: 'carta-3', market: 'WEST', personas: 1, tiendas: 3, copias: 4, idiomas: ['en'], dan: ['user-1'], gente: [T('t1', 'tutienda', 'Tu tienda', { precio: 1150 }), T('t2', 'cartasdelsur', 'Cartas del Sur', { precio: 1190 })], desde: 1150, ultima: new Date().toISOString(), total: 4 },
  { card_id: 'carta-2', market: 'WEST', personas: 2, tiendas: 2, copias: 4, idiomas: ['en', 'es'], dan: null, gente: [T('t1', 'tutienda', 'Tu tienda', { precio: 420 })], desde: 420, ultima: new Date().toISOString(), total: 4 },
  { card_id: 'carta-1', market: 'WEST', personas: 3, tiendas: 2, copias: 5, idiomas: ['en'], dan: null, gente: [T('t1', 'tutienda', 'Tu tienda', { precio: 79.9 })], desde: 79.9, ultima: new Date().toISOString(), total: 4 },
  { card_id: 'carta-4', market: 'WEST', personas: 4, tiendas: 1, copias: 6, idiomas: ['en'], dan: null, gente: [T('t1', 'tutienda', 'Tu tienda', { precio: 14.9 })], desde: 14.9, ultima: new Date().toISOString(), total: 4 },
]
const CON_LA_CARTA = [
  { stock_id: 'st-1', tienda_id: 't1', username: 'tutienda', display_name: 'Tu tienda', avatar_url: null, ciudad: 'Bilbao', con_local: true, idioma: 'en', estado: 'NM', variante: 'holo', gradeo: null, unidades: 1, precio: 1150, de_tu_lista: true, precio_antes: null },
  { stock_id: 'st-2', tienda_id: 't2', username: 'cartasdelsur', display_name: 'Cartas del Sur', avatar_url: null, ciudad: 'Sevilla', con_local: true, idioma: 'en', estado: 'NM', variante: 'holo', gradeo: null, unidades: 1, precio: 1190, de_tu_lista: false, precio_antes: null },
  { stock_id: 'st-3', tienda_id: 't3', username: 'elrincon', display_name: 'El Rincón', avatar_url: null, ciudad: 'Madrid', con_local: false, idioma: 'en', estado: 'NM', variante: 'holo', gradeo: 'PSA 10', unidades: 1, precio: 2400, de_tu_lista: false, precio_antes: null },
]
const b = await chromium.launch()
async function abrir(ruta, { sesion, rpc, filas, perfiles }) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 797 }, colorScheme: 'dark' })
  await ctx.addInitScript(([s, r, f, c, st, pf]) => {
    window.__FAKE_SESSION__ = s
    const resp = {}
    for (const [k, v] of Object.entries(r)) resp[k] = v === '__ESC__' ? (a) => { const fl = a.p_filtros || {}; const sale = window.__ESC__.filter((x) => (!fl.carta || x.card_id === fl.carta) && (!fl.id || x.id === fl.id)); return { total: sale.length, en_escaparate: window.__ESC__.length, de_tu_lista: 0, precios: true, facetas: { catalogo: { WEST: sale.length }, idioma: { en: sale.length }, sets: {} }, filas: sale } } : v
    window.__RPC_RESPUESTAS__ = resp
    window.__FAKE_FILAS__ = f; window.__FAKE_CARTAS__ = c; window.__FAKE_SETS__ = st; window.__FAKE_PERFILES__ = pf
  }, [sesion, rpc, filas, CARTAS, SETS, perfiles])
  await ctx.addInitScript((e) => { window.__ESC__ = e }, ESCAPARATE)
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('E', e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('C', m.text().slice(0, 300)) })
  await p.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  await p.addStyleTag({ content: '.progreso-pagina{display:none!important}' })
  return { p, ctx }
}
const TIENDA = { id: 't1', username: 'tutienda', display_name: 'Tu tienda', tipo: 'tienda', avatar_url: null, bio: 'Cartas sueltas, sellado y gradeadas. Compramos tu colección.' }
{
  const { p, ctx } = await abrir('/usuario?u=tutienda', { sesion: 'user-2', rpc: { tienda_escaparate: '__ESC__', tienda_reservas_al_dia: 0 }, filas: { tiendas: [{ user_id: 't1', ciudad: 'Bilbao', precio_visible: true, con_local: true, nombre: 'Tu tienda' }] }, perfiles: [TIENDA] })
  await p.screenshot({ path: SAL + '-escaparate.png' })
  await p.evaluate(() => window.scrollTo(0, 260)); await p.waitForTimeout(500)
  await p.screenshot({ path: SAL + '-escaparate2.png' })
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mi-coleccion?ver=mercado', { sesion: 'user-2', rpc: { mercado_con_tiendas: MERCADO, tiendas_con_la_carta: CON_LA_CARTA, tiendas_con_mis_deseos: [] }, filas: { tiendas: [{ user_id: 't1' }], tcg_card_prices: [['carta-3', 1120, 1180], ['carta-2', 395, 410], ['carta-1', 72, 78], ['carta-4', 12, 13.5]].map(([id, lo, tr]) => ({ card_id: id, market: 'WEST', cm_low: lo, cm_trend: tr, cm_avg30: tr, cm_low_holo: lo, cm_trend_holo: tr, updated_at: new Date().toISOString() })) }, perfiles: [{ ...TIENDA }, { id: 'user-1', username: 'Ash', display_name: 'Ash' }] })
  await p.screenshot({ path: SAL + '-mercado.png' })
  await p.locator('[data-merc="carta-3"] [data-merc-ficha]').first().click(); await p.waitForTimeout(2500)
  await p.screenshot({ path: SAL + '-mercado-ficha.png' })
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario?u=tutienda&carta=carta-3&linea=e3', { sesion: 'user-2', rpc: { tienda_escaparate: '__ESC__', tienda_reservas_al_dia: 0 }, filas: { tiendas: [{ user_id: 't1', ciudad: 'Bilbao', precio_visible: true, con_local: true, nombre: 'Tu tienda' }] }, perfiles: [TIENDA] })
  await p.waitForTimeout(800)
  await p.screenshot({ path: SAL + '-popup.png' })
  await ctx.close()
}
await b.close()

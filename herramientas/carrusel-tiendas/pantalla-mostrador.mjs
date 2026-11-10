import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const hoy = new Date().toISOString()
const FILAS = {
  tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1' }],
  tienda_stock: [],
  tienda_ventas: [
    ['a', 'carta-3', 1150, 'bizum'], ['b', 'carta-2', 420, 'efectivo'], ['c', 'carta-1', 79.9, 'tarjeta'], ['d', 'carta-4', 14.9, 'efectivo'],
  ].map(([t, id, pr, pago], i) => ({ ticket: t, tienda_id: 'user-2', card_id: id, market: 'WEST', idioma: 'en', estado: 'NM', variante: 'holo', unidades: 1, precio: pr, coste: pr * 0.7, pago, precio_lista: pr, donde: 'mostrador', vendida_el: new Date(Date.now() - i * 2400000).toISOString(), created_at: hoy })),
  tienda_compras: [{ ticket: 'e', tienda_id: 'user-2', card_id: 'carta-4', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'holo', unidades: 2, coste: 8, pago: 'efectivo', comprada_el: hoy, created_at: hoy }],
}
const img = (n) => 'http://localhost:8892/carrusel-arte/real-' + n + '.webp'
const CARTAS = [
  { id: 'carta-1', set_id: 'set-0', local_id: '223', name: 'Charizard ex', image_path: img('charizard'), rarity: 'Special Illustration Rare' },
  { id: 'carta-2', set_id: 'set-0', local_id: '238', name: 'Pikachu ex', image_path: img('pikachu'), rarity: 'Special Illustration Rare' },
  { id: 'carta-3', set_id: 'set-0', local_id: '161', name: 'Umbreon ex', image_path: img('umbreon'), rarity: 'Special Illustration Rare' },
  { id: 'carta-4', set_id: 'set-0', local_id: '53', name: 'Mew ex', image_path: img('mew'), rarity: 'Promo' },
]
const HOY = { actual: { importe: 1664.8, ventas: 4, beneficio: 412.5, coste: 1250, sin_coste: 0 }, anterior: { importe: 980 }, serie: [0, 0, 79.9, 0, 14.9, 420, 0, 1150, 0, 0].map((v, i) => ({ t: '2026-11-10T' + String(10 + i).padStart(2, '0') + ':00:00', importe: v })), paso: 'hour', stock: { valor: 18450, unidades: 312, lineas: 248 }, demanda: [
    { card_id: 'carta-3', market: 'WEST', nombre: 'Umbreon ex', set_id: 'set-0', numero: '161', quieren: 14, tienes: 1 },
    { card_id: 'carta-2', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '238', quieren: 9, tienes: 2 },
  ], visitas: { actual: 86 } }
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 797 }, colorScheme: process.argv[2] || 'dark' })
await ctx.addInitScript(([f, c, h]) => {
  window.__FAKE_SESSION__ = 'user-2'
  window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Tu tienda', username: 'tutienda' }
  window.__FAKE_FILAS__ = f; window.__FAKE_CARTAS__ = c
  window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
  window.__RPC_RESPUESTAS__ = { tienda_stock_lista: { total: 248, en_stock: 312, filas: [] }, tienda_hoy: h, tienda_reservas_al_dia: 0 }
}, [FILAS, CARTAS, HOY])
const p = await ctx.newPage()
p.on('pageerror', e => console.log('E', e.message))
await p.goto('http://localhost:8892/tienda.html', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2500)
await p.screenshot({ path: process.argv[3] + '-panel.png' })
await p.tap('.bm a[data-ver="mostrador"]'); await p.waitForTimeout(2500)
await p.addStyleTag({ content: '.progreso-pagina{display:none!important}' }); await p.waitForTimeout(200)
await p.screenshot({ path: process.argv[3] + '-abanico.png' })
await b.close()

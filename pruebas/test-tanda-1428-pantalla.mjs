// Tanda 1428 — «C» de «Modo evento y QR»: el QR de la tienda, grande en el
// móvil (el cartel entero, como en el PC, con el enlace partido por las barras
// y no a media palabra), y el cartel del modo evento para imprimir desde
// /admin → Eventos (genérico o con el evento), en PDF A4 y en imagen.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync } from 'node:fs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const b = await chromium.launch()

console.log('── El QR de la tienda en el móvil ──')
{
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Cartas Bilbao', username: 'cartasbilbao' }
    try { localStorage.setItem('pd-tienda', '{"u":"cartasbilbao","id":"user-2"}'); localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'cartasbilbao', display_name: 'Cartas Bilbao', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', con_local: true, precio_visible: true }] }
    window.__RPC_RESPUESTAS__ = { tienda_reservas_al_dia: 0, tienda_escaparate: { total: 0, en_escaparate: 0, de_tu_lista: 0, precios: true, facetas: {}, filas: [] } }
  })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}/tienda?ver=escaparate`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#tdQr svg', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => {
    const svg = document.querySelector('#tdQr svg')?.getBoundingClientRect()
    const titulo = document.querySelector('.td-esc-cab .td-cartel-titulo')
    const enlace = document.getElementById('tdEnlace')
    return {
      qr: Math.round(svg?.width || 0), titulo: titulo && getComputedStyle(titulo).display !== 'none' ? titulo.textContent : null,
      texto: enlace?.textContent, cortes: enlace?.querySelectorAll('wbr').length || 0,
      anchoDePagina: document.documentElement.scrollWidth, ventana: innerWidth,
    }
  })
  check('sin errores', !errores.length, errores.join(' | '))
  check('el QR, a 200 px (antes 88)', r.qr >= 200, r.qr)
  check('con el cartel entero: «Mira nuestro stock en el móvil»', r.titulo === 'Mira nuestro stock en el móvil', r.titulo)
  check('el enlace se parte por las barras, y el texto sigue siendo la dirección', r.texto === 'pokedoc.es/tiendas/cartasbilbao' && r.cortes === 2, JSON.stringify(r))
  check('nada se sale por los lados', r.anchoDePagina <= r.ventana, `${r.anchoDePagina} > ${r.ventana}`)
  // «Copiar» copia la dirección entera.
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  await page.click('#tdCopiar')
  await page.waitForTimeout(300)
  const copiado = await page.evaluate(() => navigator.clipboard.readText().catch(() => null))
  check('«Copiar» copia https://pokedoc.es/tiendas/cartasbilbao', copiado === 'https://pokedoc.es/tiendas/cartasbilbao', copiado)
  await ctx.close()
}

console.log('\n── El cartel del modo evento ──')
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const r = await page.evaluate(async () => {
    const m = await import('/js/cartel-modo-evento.js')
    const ev = { nombre: 'Iberian Card Show', slug: 'iberian-2026', ciudad: 'Madrid', empieza: '2026-12-20T09:00:00Z' }
    const c = await m.dibujarCartel({ evento: ev })
    const { pdf } = await m.pdfDelCartel({})
    return {
      ancho: c.width, alto: c.height, png: c.toDataURL('image/png'),
      pdf: String.fromCharCode(...pdf.slice(0, 8)), fin: String.fromCharCode(...pdf.slice(-6)).trim(), kb: Math.round(pdf.length / 1024),
      enlace: m.enlaceDelCartel(ev), enlaceGen: m.enlaceDelCartel(), linea: m.lineaDelEvento(ev), lineaGen: m.lineaDelEvento(null),
    }
  })
  writeFileSync(process.env.CARTEL || '/tmp/cartel-1428.png', Buffer.from(r.png.split(',')[1], 'base64'))
  check('sin errores', !errores.length, errores.join(' | '))
  check('un A4 a 150 ppp', r.ancho === 1240 && r.alto === 1754, `${r.ancho}×${r.alto}`)
  check('el PDF empieza y acaba como un PDF, y pesa poco', r.pdf.startsWith('%PDF-1.4') && r.fin === '%%EOF' && r.kb < 1500, `${r.pdf} … ${r.fin} · ${r.kb} KB`)
  check('el QR lleva a /evento con la campaña del cartel (y la del evento)', r.enlace === 'https://pokedoc.es/evento?utm_source=cartel&utm_campaign=iberian-2026' && r.enlaceGen === 'https://pokedoc.es/evento?utm_source=cartel', `${r.enlace} | ${r.enlaceGen}`)
  check('la línea del evento: nombre, fecha y ciudad; sin evento, nada', r.linea === 'IBERIAN CARD SHOW · 20 DIC · MADRID' && r.lineaGen === '', r.linea)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

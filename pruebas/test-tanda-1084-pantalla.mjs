// Tanda 1084 — el recibo de una venta: lo puro (el PDF de una página con la
// imagen dentro, con su tabla de posiciones bien; las cuentas del recibo) y
// la pantalla: «Recibo» en Ventas y en el aviso de una venta, la imagen con
// la tienda, lo vendido y el total —y NADA del coste ni del beneficio—, y la
// descarga en imagen y en PDF.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

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
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9])
  const pdf = P.pdfDeJpeg(jpeg, 1080, 1620)
  const t = Buffer.from(pdf).toString('latin1')
  const xref = Number(t.match(/startxref\n(\d+)\n%%EOF\n$/)?.[1])
  const posiciones = [...t.matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]))
  check('un PDF: cabecera, cinco objetos y su final', t.startsWith('%PDF-1.4\n') && posiciones.length === 5 && t.slice(xref, xref + 4) === 'xref')
  check('  …cada posición de la tabla apunta a su objeto', posiciones.every((p, i) => t.slice(p, p + 8) === `${i + 1} 0 obj\n`), posiciones.join())
  check('  …con el JPEG tal cual dentro y su largo', t.includes('/Filter /DCTDecode /Length 10') && Buffer.from(pdf).indexOf(Buffer.from(jpeg)) > 0 && /\/Width 1080 \/Height 1620/.test(t))
  check('  …y la página a 80 mm de ancho, con la proporción de la imagen', /\/MediaBox \[0 0 226\.77 340\.16\]/.test(t), t.match(/MediaBox[^\]]*\]/)?.[0])
  const c = P.cuentaDeRecibo([{ unidades: 2, precio: '64.95', coste: 40 }, { unidades: 1, precio: 179 }])
  check('las cuentas: 308,90 € de 3 artículos, cada línea con su importe', c.total === 308.9 && c.unidades === 3 && c.filas[0].importe === 129.9)
}

const hoy = new Date().toISOString()
const VENTAS = [
  { id: 'v1', ticket: 'tk1', tienda_id: 'user-2', card_id: 'carta-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, precio: 179, coste: 125, donde: 'mostrador', vendida_el: hoy, created_at: hoy },
  { id: 'v2', ticket: 'tk1', tienda_id: 'user-2', product_id: 501, market: 'WEST', idioma: 'en', estado: 'sellado', variante: 'normal', unidades: 2, precio: 64.95, coste: 44, donde: 'mostrador', vendida_el: hoy, created_at: hoy },
]
const b = await chromium.launch()
async function abrir(ruta) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: 'block', acceptDownloads: true })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}')
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle Mayor 12' }], tienda_ventas: d.VENTAS, tcg_products: [{ id: 501, name: 'ETB de prueba' }] }
    window.__FAKE_CARTAS__ = [{ id: 'carta-1', set_id: 'set-0', market: 'WEST', local_id: '199', name: 'Charizard ex' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    // Lo que se escribe en el lienzo, para ver qué dice el recibo.
    window.__TEXTOS__ = []
    const fill = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__TEXTOS__.push(String(t)); return fill.call(this, t, ...r) }
    window.__RPC_RESPUESTAS__ = {
      tienda_ventas_lista: { total: 2, tickets: 1, sumas: {}, por_donde: {}, filas: d.VENTAS.map((v) => ({ ...v, nombre: v.card_id ? 'Charizard ex' : 'ETB de prueba', set_id: v.card_id ? 'set-0' : null })) },
      tienda_stock_lista: { total: 1, en_stock: 1, sumas: {}, facetas: {}, filas: [{ id: 's1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 2, coste: 125, precio: 179, entro_el: d.hoy }] },
      tienda_vender: { ticket: 'tk1', lineas: 1, total: 179, beneficio: 54, sin_coste: 0 },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
    }
  }, { VENTAS, hoy })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}

console.log('── Desde Ventas ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=ventas')
  check('cada venta lleva «Recibo» junto a Deshacer', !errs.length && (await p.locator('[data-recibo="tk1"]').count()) === 2, errs.join(' | '))
  await p.click('[data-recibo="tk1"] >> nth=0'); await p.waitForTimeout(2000)
  check('el recibo se abre con su imagen y el total en el título', (await p.isVisible('dialog.tdr[open]')) && /^blob:/.test(await p.getAttribute('.tdr-vista img', 'src')) && /308,90/.test(await p.textContent('#tdrTitulo')))
  const textos = await p.evaluate(() => window.__TEXTOS__.join(' | '))
  check('dice la tienda, dónde, lo vendido y el total', /El Rincón/.test(textos) && /Calle Mayor 12, Bilbao/.test(textos) && /Charizard ex/.test(textos) && /Obsidian Flames · 199 · ES · NM/.test(textos) && /2 × 64,95/.test(textos) && /308,90/.test(textos) && /pokedoc\.es\/usuario\/rincon/.test(textos), textos)
  check('  …y NADA de lo que costó ni de lo que se gana', !/125|44,00|costó|benefic|margen/i.test(textos), textos)
  const [png] = await Promise.all([p.waitForEvent('download'), p.click('[data-tdr="imagen"]')])
  check('«Descargar imagen»: un PNG con su nombre', png.suggestedFilename() === 'recibo-tk1.png')
  const [pdf] = await Promise.all([p.waitForEvent('download'), p.click('[data-tdr="pdf"]')])
  const contenido = readFileSync(await pdf.path()).toString('latin1')
  check('«PDF para imprimir»: un PDF de verdad, con la imagen dentro', pdf.suggestedFilename() === 'recibo-tk1.pdf' && contenido.startsWith('%PDF-1.4') && contenido.includes('/DCTDecode') && contenido.trimEnd().endsWith('%%EOF'))
  await p.click('dialog.tdr [data-tdr="cerrar"]')
  check('  …y se cierra', !(await p.locator('dialog.tdr[open]').count()))
  await ctx.close()
}

console.log('── Desde el aviso de una venta ──')
{
  const { p, ctx } = await abrir('/tienda.html')
  await p.click('.tdm-vender'); await p.waitForTimeout(500)
  await p.fill('#tdvBusca', 'char'); await p.waitForTimeout(800)
  await p.click('.tdv-resultado >> nth=0'); await p.click('#tdvVendida'); await p.waitForTimeout(800)
  const acciones = await p.locator('.toast .toast-accion').allTextContents()
  check('el aviso lleva Deshacer y Recibo', acciones.join('|') === 'Deshacer|Recibo', acciones.join('|'))
  await p.click('.toast-accion:has-text("Recibo")'); await p.waitForTimeout(2000)
  check('  …y «Recibo» lo abre', await p.isVisible('dialog.tdr[open]'))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

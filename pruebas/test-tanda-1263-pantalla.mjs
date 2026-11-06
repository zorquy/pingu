// Tanda 1263 — el idioma de una carta en el escaparate de una tienda va con su
// BANDERA, como el estado va con su chapa (PINGU: «el idioma no se ve con
// banderas, quizá mejor para hacerlo más visual»). Y la hoja de las banderas
// (cardmarket.css) entra en /tiendas/<usuario>, que no la cargaba: las del
// pop-up de la carta tampoco se veían.
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

console.log('── 1. Las tarjetas del escaparate ──')
for (const movil of [false, true]) {
  const { p, ctx, errs } = await abrir('/usuario.html?u=rincon', { movil })
  check(`${movil ? 'móvil' : 'PC'}: sin errores`, !errs.length, errs.join(' | '))
  const filas = await p.$$eval('.pt-rejilla .pt-carta .pt-detalle', (es) => es.map((e) => {
    const b = e.querySelector('.pv-bandera')
    const r = b?.getBoundingClientRect()
    const cs = b && getComputedStyle(b)
    const c = e.cloneNode(true); c.querySelector('.chapa-estado')?.remove()
    return { texto: c.textContent.trim(), idioma: b?.dataset.idioma || null, ancho: r?.width || 0, fondo: cs?.backgroundImage || '' }
  }))
  check('  cada carta lleva la bandera de su idioma', filas.filter((f) => f.idioma).map((f) => f.idioma).join() === 'es,en,es,es', JSON.stringify(filas.map((f) => f.idioma)))
  check('  …y se DIBUJA (la hoja de las banderas ha llegado)', filas.every((f) => !f.idioma || (f.ancho >= 16 && f.fondo !== 'none')), JSON.stringify(filas.map((f) => [f.ancho, f.fondo.slice(0, 20)])))
  check('  …con la sigla al lado y lo demás detrás', filas.some((f) => /^EN · Reverse holo · 2 uds\.$/.test(f.texto)), JSON.stringify(filas.map((f) => f.texto)))
  check('  …y una línea sin nada más no lleva « · » colgando', filas.some((f) => /^ES$/.test(f.texto)), JSON.stringify(filas.map((f) => f.texto)))
  await p.screenshot({ path: `/tmp/1263-${movil ? 'movil' : 'pc'}.png` })
  if (!movil) {
    await p.click('.pt-rejilla .pt-carta >> nth=1 >> .pt-foto'); await p.waitForTimeout(800)
    const w = await p.$eval('dialog.ptc .ptc-op .pv-bandera', (b) => b.getBoundingClientRect().width).catch(() => 0)
    check('  el pop-up de la carta también dibuja sus banderas', w >= 16, w)
  }
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)

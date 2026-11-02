// Tanda 1178 → 1179 — El Panel «A · Cartera» en el móvil y en el PC: la
// cartera sin lado ni lo pagado, Movimientos como tira de cartas con su
// tanto por ciento (ocho por fila en el PC, tres en el móvil), ninguna
// tarjeta de reojo ni bloque de Cambios, Tu mes o alertas, y las expansiones
// en baldosas con el logo (dos en el móvil, en una fila; cuatro en el PC).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }, { id: 'sv9', name: 'Evoluciones Prismáticas', serie_id: 'sv', market: 'WEST', release_date: '2025-01-17', card_count_official: 131, card_count_total: 180 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu', 'Snorlax', 'Eevee', 'Dragonite', 'Gyarados']
const setDe = (i) => (i < 5 ? 'sv8' : i < 10 ? 'sv3pt5' : 'sv9')
const CARTAS = nombres.map((n, i) => ({ id: `${setDe(i)}-${i + 1}`, market: 'WEST', set_id: setDe(i), local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25 + i], tcg_sets: { id: setDe(i), name: SETS.find((s) => s.id === setDe(i)).name, serie_id: 'sv' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5, 0.9, 22, 15, 5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), checked_at: '2026-10-19T10:00:00Z' }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 + (i % 3), created_at: `2026-10-${String(1 + i).padStart(2, '0')}T10:00:00Z` }))
const hoy = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
const VALOR = Array.from({ length: 30 }, (_, d) => ({ user_id: 'admin-1', dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), valor: 610 - d * 3 + (d % 4) * 5 }))
const HIST = []
CARTAS.forEach((c, i) => { for (let d = 0; d < 10; d++) { const v = precio(i) * (1 + (i % 2 ? -1 : 1) * 0.01 * d); HIST.push({ card_id: c.id, dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), cm_low: v, cm_low_es: v, origen: 'tcggo' }) } })
// Charizard sube de 100 con 96,50 hoy: a 3,50 €, CERCA. Las otras dos, lejos.
const AVISOS = [{ id: 'av1', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 150, activo: true }, { id: 'av2', user_id: 'admin-1', card_id: 'sv8-2', market: 'WEST', idioma: 'es', tipo: 'sube', umbral: 100, activo: true }, { id: 'av3', user_id: 'admin-1', card_id: 'sv3pt5-7', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 1, activo: true }]

const browser = await chromium.launch()
async function abrir(opts) {
  const ctx = await browser.newContext({ ...opts, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: d.VALOR, __FAKE_HISTORIAL__: d.HIST, __FAKE_AVISOS__: d.AVISOS, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
  }, { SETS, CARTAS, PRECIOS, COLECCION, VALOR, HIST, AVISOS })
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  return { ctx, page, err }
}
const medir = (page) => page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }
  const vis = (s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 }
  const visibles = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length)
  const porFila = (s) => { const f = visibles(s); if (!f.length) return 0; const top = Math.round(f[0].getBoundingClientRect().top); return f.filter((e) => Math.round(e.getBoundingClientRect().top) === top).length }
  const logo = document.querySelector('#mcVistazoSets .mc-set-fila-logo')
  return {
    tarjetas: visibles('.mc-reojo-tarjeta').length,
    fuera: { al: vis('#mcAlertas'), cam: vis('#mcCambios'), mes: vis('#mcMes'), balance: vis('#mcBalance'), lado: vis('.mc-cartera-lado'), nota: /no tiene(n)? precio/.test(document.getElementById('mcValorCaja')?.textContent || ''), fuente: vis('#mcFuente') },
    cartera: r('#mcValorCaja'), mov: r('#mcMovidas'), valiosas: r('#mcValiosas'),
    movFichas: visibles('#mcMovidas .mc-vistazo-ficha').length,
    movPorFila: porFila('#mcMovidas .mc-vistazo-ficha'),
    movPcts: [...document.querySelectorAll('#mcMovidas .mc-ficha-cambio')].map((e) => e.textContent.replace(/[  ]/g, ' ')),
    movSube: [...document.querySelectorAll('#mcMovidas .mc-vistazo-ficha')].map((e) => e.classList.contains('sube') ? '+' : e.classList.contains('baja') ? '−' : '?').join(''),
    rankPorFila: porFila('#mcValiosas .mc-vistazo-ficha'),
    setsVisibles: visibles('#mcVistazoSets .mc-set-fila').length,
    setsFilas: new Set(visibles('#mcVistazoSets .mc-set-fila').map((e) => Math.round(e.getBoundingClientRect().top))).size,
    logoAlto: logo ? Math.round(logo.getBoundingClientRect().height) : 0,
    ancho: document.documentElement.scrollWidth <= innerWidth,
  }
})
const sinReojo = (m) => m.tarjetas === 0 && !m.fuera.al && !m.fuera.cam && !m.fuera.mes && !m.fuera.balance && !m.fuera.lado && !m.fuera.nota && !m.fuera.fuente

console.log('── Móvil ──')
{
  const { ctx, page, err } = await abrir({ ...devices['iPhone 13'] })
  const m = await medir(page)
  check('ni tarjetas de reojo, ni Cambios, Tu mes, alertas, lo pagado, el lado ni la nota de «sin precio»', sinReojo(m), JSON.stringify({ t: m.tarjetas, ...m.fuera }))
  check('Movimientos es una tira de cartas bajo la cartera, de tres por fila', m.mov && m.cartera && m.mov[1] >= m.cartera[1] + m.cartera[3] - 4 && m.movFichas >= 3 && m.movPorFila === 3, JSON.stringify([m.cartera, m.mov, m.movFichas, m.movPorFila]))
  check('  …cada carta con su tanto por ciento, en verde o en rojo', m.movPcts.length >= 3 && m.movPcts.every((p) => /^[+−]\d+ %$/.test(p)) && /^[+−]+$/.test(m.movSube), JSON.stringify([m.movPcts, m.movSube]))
  check('la primera carta tuya (Movimientos) está antes de los 900 px', m.mov && m.mov[1] < 900, JSON.stringify(m.mov))
  check('Ranking a tres por fila', m.rankPorFila === 3, String(m.rankPorFila))
  check('Expansiones: dos baldosas en una fila, con el logo grande', m.setsVisibles === 2 && m.setsFilas === 1 && m.logoAlto >= 60, JSON.stringify([m.setsVisibles, m.setsFilas, m.logoAlto]))
  check('la página no se sale', m.ancho)
  // «Ver todas» de Movimientos abre su vista.
  await page.click('#mcMovidas .ver-todo')
  await page.waitForTimeout(800)
  const v = await page.evaluate(() => ({ vista: document.querySelector('#mcPanelMovimientos')?.getClientRects().length > 0, ver: new URL(location.href).searchParams.get('ver') }))
  check('«Ver todas» de Movimientos abre la vista Movimientos', v.vista && v.ver === 'movimientos', JSON.stringify(v))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
console.log('── PC ──')
{
  const { ctx, page, err } = await abrir({ viewport: { width: 1280, height: 900 } })
  const m = await medir(page)
  check('en el PC tampoco hay reojo, Cambios, Tu mes, alertas ni lo pagado', sinReojo(m), JSON.stringify({ t: m.tarjetas, ...m.fuera }))
  check('la cartera a lo ancho y Movimientos debajo, a lo ancho, de ocho por fila', m.mov && m.cartera && Math.abs(m.mov[2] - m.cartera[2]) < 4 && m.mov[1] >= m.cartera[1] + m.cartera[3] - 4 && m.movPorFila === Math.min(8, m.movFichas), JSON.stringify([m.cartera, m.mov, m.movFichas, m.movPorFila]))
  check('Ranking de ocho por fila', m.rankPorFila === 8, String(m.rankPorFila))
  check('  …con las expansiones en baldosas, en una fila', m.setsVisibles >= 3 && m.setsFilas === 1 && m.logoAlto >= 60, JSON.stringify([m.setsVisibles, m.setsFilas, m.logoAlto]))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

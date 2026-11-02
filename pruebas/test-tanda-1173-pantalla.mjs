// Tanda 1173 — Pagaste · Valen · Vas bajo la gráfica, Tus alertas y Tu mes
// (P5, P6 y P7 de la propuesta del Panel).
//   · La tira del balance (la regla de la 428: solo sobre lo apuntado) y «N
//     cartas sin apuntar lo que pagaste» → Añadidas con ?sin=pagado.
//   · «Tus alertas»: las activas con el umbral, el precio de hoy y a cuánto
//     están, las más cerca primero; la campanita de Movimientos abre el aviso.
//   · «Tu mes»: cartas, expansiones nuevas, cambios y valor; la mejor compra;
//     Compartir abre la hoja con la imagen.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const sinNbsp = (x) => String(x ?? '').replace(/\u00a0/g, ' ')
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const browser = await chromium.launch()

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }, { id: 'sv9', name: 'Evoluciones Prismáticas', serie_id: 'sv', market: 'WEST', release_date: '2025-01-17', card_count_official: 131, card_count_total: 180 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu']
const setDe = (i) => (i === 2 ? 'sv9' : i < 5 ? 'sv8' : 'sv3pt5')
const CARTAS = nombres.map((n, i) => ({ id: `${setDe(i)}-${i + 1}`, market: 'WEST', set_id: setDe(i), local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25 + i], tcg_sets: { id: setDe(i), name: SETS.find((s) => s.id === setDe(i)).name, serie_id: 'sv' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), checked_at: '2026-10-19T10:00:00Z' }))
const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
const hace = (d) => new Date(hoy.getTime() - d * 864e5).toISOString()
// Tres de hoy (Pikachu, Charizard ×3 pagando 40, Mew en un set NUEVO), el
// resto de hace mes y medio. Lo pagado solo en Pikachu (150), Charizard (40) y
// Gengar (3).
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: i === 1 ? 3 : 1, precio_compra: i === 0 ? 150 : i === 1 ? 40 : i === 6 ? 3 : null, created_at: hace(i < 3 ? 0 : 45) }))
const hoyUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
const VALOR = Array.from({ length: 40 }, (_, d) => ({ user_id: 'admin-1', dia: new Date(hoyUtc - d * 864e5).toISOString().slice(0, 10), valor: 400 - d * 2 }))
const HIST = []
CARTAS.forEach((c, i) => { for (let d = 0; d < 10; d++) { const v = precio(i) * (1 + (i % 2 ? -1 : 1) * 0.01 * d); HIST.push({ card_id: c.id, dia: new Date(hoyUtc - d * 864e5).toISOString().slice(0, 10), cm_low: v, cm_low_es: v, origen: 'tcggo' }) } })
// Tres alertas: Gengar (baja de 1 €, hoy 3,10 → a 2,10 €), Charizard (sube de
// 100, hoy 96,50 → a 3,50 €, CERCA), Pikachu (baja de 150, hoy 182 → a 32 €).
const AVISOS = [{ id: 'av1', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 150, activo: true }, { id: 'av2', user_id: 'admin-1', card_id: 'sv8-2', market: 'WEST', idioma: 'es', tipo: 'sube', umbral: 100, activo: true }, { id: 'av3', user_id: 'admin-1', card_id: 'sv3pt5-7', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 1, activo: true }, { id: 'av4', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 170, activo: false }]
const sembrar = (d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('mc-mov-periodo') } catch {}
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: d.VALOR, __FAKE_HISTORIAL__: d.HIST, __FAKE_AVISOS__: d.AVISOS, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
}
const datos = { SETS, CARTAS, PRECIOS, COLECCION, VALOR, HIST, AVISOS }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

console.log('── PC: lo pagado en Estadísticas; alertas y Tu mes fuera del Panel (1179) ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcMovidas .mc-vistazo-ficha', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  const t = await page.evaluate(() => ({
    balance: !!document.getElementById('mcBalance'), alertas: !!document.getElementById('mcAlertas'), mes: !!document.getElementById('mcMes'), cambios: !!document.getElementById('mcCambios'),
    lado: !!document.querySelector('.mc-cartera-lado'),
  }))
  check('el Panel A no lleva Pagaste · valen · vas, ni alertas, ni Tu mes, ni Cambios, ni el lado', !t.balance && !t.alertas && !t.mes && !t.cambios && !t.lado, JSON.stringify(t))
  // Lo pagado vive en Estadísticas (`diapoDelBalance`, la cuenta de la 428).
  await page.click('#mcVerTodo')
  await page.waitForSelector('#mcPanelEstadisticas .mc-diapo', { timeout: 8000 }).catch(() => {})
  const e = await page.evaluate(() => ({ ver: new URL(location.href).searchParams.get('ver'), texto: document.getElementById('mcPanelEstadisticas')?.textContent.replace(/\s+/g, ' ').replace(/[  ]/g, ' ') || '' }))
  check('Estadísticas lleva lo pagado (273,00 € en 5 copias, valen 474,60 €)', e.ver === 'estadisticas' && /273,00 €/.test(e.texto) && /474,60 €/.test(e.texto), e.texto.slice(0, 300))
  await page.click('#mcVistaVolver')
  await page.waitForTimeout(400)
  // La campanita de Movimientos.
  await page.click('#mcMovidas .ver-todo')
  await page.waitForSelector('#mcMovLista a.mc-movida', { timeout: 8000 }).catch(() => {})
  const campanas = await page.locator('#mcMovLista [data-alerta-de]').count()
  check('cada fila de Movimientos lleva su campanita', campanas > 0 && campanas === (await page.locator('#mcMovLista a.mc-movida').count()), String(campanas))
  await page.locator('#mcMovLista [data-alerta-de]').first().click()
  await page.waitForTimeout(600)
  const aviso = await page.evaluate(() => ({ abierto: !!document.getElementById('pvAvisoDialogo')?.open, ahora: document.getElementById('pvAvisoAhora')?.textContent, url: location.pathname }))
  check('  …que abre «Avísame de esta carta» con el precio de hoy, sin salir', aviso.abierto && /Ahora está a/.test(aviso.ahora || '') && /mi-coleccion/.test(aviso.url), JSON.stringify(aviso))
  check('PC: sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── Móvil: nada se sale ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcMovidas .mc-vistazo-ficha', { timeout: 15000 }).catch(() => {})
  const m = await page.evaluate(() => ({ mov: document.querySelectorAll('#mcMovidas .mc-vistazo-ficha').length, balance: !!document.getElementById('mcBalance'), mes: !!document.getElementById('mcMes'), ancho: document.documentElement.scrollWidth <= innerWidth }))
  check('Movimientos en tira, sin balance ni Tu mes', m.mov >= 3 && !m.balance && !m.mes, JSON.stringify(m))
  check('  …sin salirse de la pantalla', m.ancho, JSON.stringify(m))
  check('móvil: sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

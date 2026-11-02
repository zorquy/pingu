// Tanda 1171 — Movimientos y Ranking (P1 y P2 de la propuesta del Panel).
// PINGU: «si le doy a las que más se mueven, que me enseñe los movimientos y
// que no me lleve a la colección a secas; lo mismo con lo demás».
//   · «Las que más se mueven → Ver todas» abre ?ver=movimientos: periodo,
//     Todas/Suben/Bajan, Por %/Por €, la línea del total y una fila por carta.
//   · «Las que más valen → Ver todas» abre ?ver=ranking: puesto, copias, parte
//     de la colección y acumulado; Por copia / Por línea.
//   · «‹ Panel» vuelve; una fila abre el pop-up; abrir por dirección funciona.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const browser = await chromium.launch()

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu', 'Snorlax', 'Eevee', 'Dragonite', 'Gyarados']
const CARTAS = nombres.map((n, i) => ({ id: `${i < 6 ? 'sv8' : 'sv3pt5'}-${i + 1}`, market: 'WEST', set_id: i < 6 ? 'sv8' : 'sv3pt5', local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25 + i], tcg_sets: { id: i < 6 ? 'sv8' : 'sv3pt5', name: i < 6 ? 'Chispas Fulgurantes' : '151', serie_id: 'sv' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5, 0.9, 22, 15, 5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), checked_at: '2026-10-19T10:00:00Z' }))
// Charizard ex (i=1) con 3 copias: por línea vale 289,5 y pasa por delante
// del Pikachu ex (182, una copia).
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: i === 1 ? 3 : 1, created_at: `2026-10-${String(1 + i).padStart(2, '0')}T10:00:00Z` }))
const hoy = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
const VALOR = Array.from({ length: 30 }, (_, d) => ({ user_id: 'admin-1', dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), valor: 610 - d * 3 }))
// Histórico de 40 días: los pares suben, los impares bajan (también el
// Snorlax de 0,9 €: 11 céntimos en un mes, que pasan de los 5 mínimos).
const HIST = []
CARTAS.forEach((c, i) => { for (let d = 0; d < 40; d++) { const v = precio(i) * (1 + (i % 2 ? -1 : 1) * 0.004 * d); HIST.push({ card_id: c.id, dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), cm_low: v, cm_low_es: v, origen: 'tcggo' }) } })
const sembrar = (d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('mc-mov-periodo'); localStorage.removeItem('mc-rank-modo') } catch {}
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: d.VALOR, __FAKE_HISTORIAL__: d.HIST, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
}
const datos = { SETS, CARTAS, PRECIOS, COLECCION, VALOR, HIST }
const ve = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0 }, sel)

console.log('── PC: del Panel a Movimientos y a Ranking ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcMovidas .ver-todo', { timeout: 15000 }).catch(() => {})
  check('el Panel pinta «Las que más se mueven» con su Ver todas', await ve(page, '#mcMovidas .ver-todo'))
  await page.click('#mcMovidas .ver-todo')
  await page.waitForSelector('#mcPanelMovimientos .mc-movidas a.mc-movida', { timeout: 8000 }).catch(() => {})
  const mov = await page.evaluate(() => ({
    ver: new URL(location.href).searchParams.get('ver'),
    panel: !document.getElementById('mcPanelMovimientos').classList.contains('hidden'),
    cartas: document.getElementById('mcPanelCartas')?.classList.contains('hidden'),
    filas: [...document.querySelectorAll('#mcMovLista a.mc-movida')].map((a) => `${a.classList.contains('sube') ? '+' : '-'}${a.querySelector('.mc-movida-nombre b').textContent}`),
    resumen: document.getElementById('mcMovResumen').textContent.trim(),
    periodo: document.querySelector('#mcPanelMovimientos [data-periodo][aria-pressed="true"]')?.dataset.periodo,
    panelLit: document.querySelector('[data-pestania="resumen"]').classList.contains('activa'),
    volver: !!document.querySelector('#mcVistaVolver'),
  }))
  check('«Ver todas» abre ?ver=movimientos, no Cartas', mov.ver === 'movimientos' && mov.panel && mov.cartas, JSON.stringify(mov))
  check('  …con 1M puesto, el botón Panel encendido y la miga «‹ Panel»', mov.periodo === '1M' && mov.panelLit && mov.volver, JSON.stringify(mov))
  check('  …una fila por carta que se mueve (las 12)', mov.filas.length === 12 && mov.filas[0].startsWith('+') && mov.filas[11].startsWith('-'), mov.filas.join(','))
  check('  …ordenadas por % y con la línea del total (suben · bajan)', /este mes en lo que tienes/.test(mov.resumen) && /6 suben/.test(mov.resumen) && /6 bajan/.test(mov.resumen), mov.resumen)
  await page.click('#mcPanelMovimientos [data-filtro="bajan"]')
  await page.waitForTimeout(300)
  const bajan = await page.evaluate(() => [...document.querySelectorAll('#mcMovLista a.mc-movida')].map((a) => a.classList.contains('baja')))
  check('«Bajan» deja solo las que bajan', bajan.length === 6 && bajan.every(Boolean), JSON.stringify(bajan))
  await page.click('#mcPanelMovimientos [data-filtro="todas"]')
  await page.click('#mcPanelMovimientos [data-orden="eur"]')
  await page.waitForTimeout(300)
  const porEur = await page.evaluate(() => [...document.querySelectorAll('#mcMovLista a.mc-movida .mc-movida-nombre b')].map((b) => b.textContent))
  check('«Por €» pone primero la que más euros se mueve (Pikachu ex, 182 €)', porEur[0] === 'Pikachu ex', porEur.join(','))
  await page.click('#mcPanelMovimientos [data-periodo="7D"]')
  await page.waitForTimeout(1200)
  const semana = await page.evaluate(() => ({ periodo: document.querySelector('#mcPanelMovimientos [data-periodo][aria-pressed="true"]')?.dataset.periodo, filas: document.querySelectorAll('#mcMovLista a.mc-movida').length, resumen: document.getElementById('mcMovResumen').textContent, antes: document.querySelector('#mcMovLista a.mc-movida .mc-movida-precio small')?.textContent }))
  check('7D cambia el periodo y vuelve a calcular («esta semana», con el precio de antes)', semana.periodo === '7D' && semana.filas > 0 && /esta semana/.test(semana.resumen) && /antes /.test(semana.antes || ''), JSON.stringify(semana))
  // Una fila abre el pop-up, no la ficha entera.
  await page.click('#mcMovLista a.mc-movida')
  await page.waitForTimeout(600)
  check('una fila abre el pop-up de la carta sin salir de la página', await page.evaluate(() => document.getElementById('mcEditor')?.open && location.pathname.includes('mi-coleccion')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.click('#mcVistaVolver')
  await page.waitForTimeout(500)
  check('«‹ Panel» vuelve al Panel', await page.evaluate(() => !document.getElementById('mcPanelResumen').classList.contains('hidden') && !new URL(location.href).searchParams.get('ver')))
  // Ranking.
  await page.click('#mcValiosas .ver-todo')
  await page.waitForSelector('#mcRankLista a.mc-movida', { timeout: 8000 }).catch(() => {})
  const rk = await page.evaluate(() => ({
    ver: new URL(location.href).searchParams.get('ver'),
    filas: [...document.querySelectorAll('#mcRankLista a.mc-movida')].map((a) => `${a.querySelector('.mc-rank-puesto').textContent}.${a.querySelector('.mc-movida-nombre b').textContent}`),
    resumen: document.getElementById('mcRankResumen').textContent,
    acum: [...document.querySelectorAll('#mcRankLista .mc-rank-acum i')].map((i) => parseFloat(i.style.width)),
    modo: document.querySelector('#mcPanelRanking [data-modo][aria-pressed="true"]')?.dataset.modo,
  }))
  check('«Las que más valen → Ver todas» abre ?ver=ranking', rk.ver === 'ranking' && rk.modo === 'copia', JSON.stringify(rk))
  check('  …las 12 con precio por lo que vale UNA copia, con puesto', rk.filas.length === 12 && rk.filas[0] === '1.Pikachu ex' && rk.filas[1] === '2.Charizard ex' && rk.filas[11] === '12.Snorlax', rk.filas.join(','))
  check('  …la raya acumula hasta el 100 % y el resumen dice cuánto son las cinco primeras', rk.acum.every((v, i) => i === 0 || v >= rk.acum[i - 1]) && Math.round(rk.acum[11]) === 100 && /las cinco primeras son el/.test(rk.resumen), JSON.stringify(rk))
  await page.click('#mcPanelRanking [data-modo="linea"]')
  await page.waitForTimeout(300)
  const linea = await page.evaluate(() => [...document.querySelectorAll('#mcRankLista a.mc-movida')].slice(0, 2).map((a) => `${a.querySelector('.mc-movida-nombre b').textContent}|${a.querySelector('.mc-movida-precio b').textContent}`))
  check('«Por línea» pone primero el Charizard ex (3 copias, 289,50 €)', linea[0]?.startsWith('Charizard ex|289,50') && linea[1]?.startsWith('Pikachu ex'), linea.join(','))
  check('PC: sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── Móvil: por dirección y sin salirse ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=movimientos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcMovLista a.mc-movida', { timeout: 15000 }).catch(() => {})
  const m = await page.evaluate(() => ({ filas: document.querySelectorAll('#mcMovLista a.mc-movida').length, ancho: document.documentElement.scrollWidth <= innerWidth, cab: document.querySelector('.mc-vista-cab')?.getBoundingClientRect().height, lit: document.querySelector('[data-pestania="resumen"]')?.classList.contains('activa') }))
  check('?ver=movimientos abre la lista en el móvil, con el Panel encendido', m.filas === 12 && m.lit, JSON.stringify(m))
  check('  …sin salirse de la pantalla', m.ancho, JSON.stringify(m))
  await page.goto(`${BASE}/mi-coleccion.html?ver=ranking`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcRankLista a.mc-movida', { timeout: 15000 }).catch(() => {})
  const r = await page.evaluate(() => ({ filas: document.querySelectorAll('#mcRankLista a.mc-movida').length, ancho: document.documentElement.scrollWidth <= innerWidth }))
  check('?ver=ranking igual', r.filas === 12 && r.ancho, JSON.stringify(r))
  check('móvil: sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

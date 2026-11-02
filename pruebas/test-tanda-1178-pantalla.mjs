// Tanda 1178 — El móvil de un vistazo (decisiones 3 y 4 de «Estructura del
// Panel»): en el móvil, la fila de reojo son cuatro tarjetas en 2 × 2 con un
// titular (Movimientos, Alertas, Cambios, Tu mes) que se pulsan, los bloques
// enteros no se pintan (el de alertas se despliega al pulsar su tarjeta),
// las expansiones son dos filas y la primera carta tuya está cerca. En el
// PC, nada de esto: los bloques de siempre y ninguna tarjeta.
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
  const txt = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() || ''
  return {
    tarjetas: [...document.querySelectorAll('.mc-reojo-tarjeta')].filter((e) => e.getClientRects().length).map((e) => e.id),
    mov: r('#mcReojoMovidas'), al: r('#mcReojoAlertas'), cam: r('#mcReojoCambios'), mes: r('#mcReojoMes'), reojo: r('.mc-panel-reojo'),
    tMov: txt('#mcReojoMovidas'), tAl: txt('#mcReojoAlertas'), tCam: txt('#mcReojoCambios'), tMes: txt('#mcReojoMes'),
    bloques: { mov: vis('#mcMovidas'), al: vis('#mcAlertas'), cam: vis('#mcCambios'), mes: vis('#mcMes') },
    valiosas: r('#mcValiosas'),
    setsVisibles: [...document.querySelectorAll('#mcVistazoSets .mc-set-fila')].filter((e) => e.getClientRects().length).length,
    ancho: document.documentElement.scrollWidth <= innerWidth,
  }
})

console.log('── Móvil ──')
{
  const { ctx, page, err } = await abrir({ ...devices['iPhone 13'] })
  const m = await medir(page)
  check('cuatro tarjetas de reojo a la vista', m.tarjetas.length === 4 && ['mcReojoMovidas', 'mcReojoAlertas', 'mcReojoCambios', 'mcReojoMes'].every((id) => m.tarjetas.includes(id)), JSON.stringify(m.tarjetas))
  check('  …en 2 × 2: Movimientos y Alertas arriba, Cambios y Tu mes debajo', m.mov && m.al && m.cam && m.mes && Math.abs(m.mov[1] - m.al[1]) < 4 && m.al[0] > m.mov[0] + m.mov[2] - 4 && Math.abs(m.cam[1] - m.mes[1]) < 4 && m.cam[1] >= m.mov[1] + m.mov[3] - 4 && Math.abs(m.mov[2] - m.al[2]) < 4, JSON.stringify([m.mov, m.al, m.cam, m.mes]))
  check('  …Movimientos con la que más se mueve y «N suben · M bajan»', /esta semana/.test(m.tMov) && /\d+ suben · \d+ bajan/.test(m.tMov), m.tMov)
  check('  …Alertas: «1 a punto de saltar», Charizard a 3,50 € y «3 activas»', /1 a punto de saltar/.test(m.tAl) && /Charizard ex, a 3,50/.test(m.tAl) && /3 activas/.test(m.tAl), m.tAl)
  check('  …Cambios: «0 das · 0 quieres»', /0 das · 0 quieres/.test(m.tCam), m.tCam)
  check('  …Tu mes: el valor del mes de titular y las cartas debajo', /€/.test(m.tMes) && /cartas/.test(m.tMes), m.tMes)
  check('los bloques enteros no se pintan en el móvil', !m.bloques.mov && !m.bloques.al && !m.bloques.cam && !m.bloques.mes, JSON.stringify(m.bloques))
  check('la primera carta tuya (Ranking) está antes de los 900 px', m.valiosas && m.valiosas[1] < 900, JSON.stringify(m.valiosas))
  check('Expansiones: dos filas, no cuatro', m.setsVisibles === 2, String(m.setsVisibles))
  check('la página no se sale', m.ancho)
  // Pulsar Alertas despliega la lista entera, a lo ancho.
  await page.click('#mcReojoAlertas')
  await page.waitForTimeout(300)
  const d = await page.evaluate(() => { const e = document.querySelector('#mcAlertas'); const g = document.querySelector('.mc-panel-reojo').getBoundingClientRect(); const b = e.getBoundingClientRect(); return { visible: e.getClientRects().length > 0, ancho: Math.round(b.width), anchoReojo: Math.round(g.width), filas: e.querySelectorAll('.mc-alerta').length, expandida: document.querySelector('#mcReojoAlertas').getAttribute('aria-expanded') } })
  check('al pulsar Alertas se despliega la lista entera, a lo ancho', d.visible && Math.abs(d.ancho - d.anchoReojo) < 4 && d.filas === 3 && d.expandida === 'true', JSON.stringify(d))
  await page.click('#mcReojoAlertas')
  await page.waitForTimeout(200)
  check('  …y al volver a pulsar se recoge', !(await page.evaluate(() => document.querySelector('#mcAlertas').getClientRects().length > 0)))
  // Pulsar Movimientos abre su vista.
  await page.click('#mcReojoMovidas')
  await page.waitForTimeout(800)
  const v = await page.evaluate(() => ({ vista: document.querySelector('#mcPanelMovimientos')?.getClientRects().length > 0, ver: new URL(location.href).searchParams.get('ver') }))
  check('al pulsar Movimientos se abre la vista Movimientos', v.vista && v.ver === 'movimientos', JSON.stringify(v))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
console.log('── PC ──')
{
  const { ctx, page, err } = await abrir({ viewport: { width: 1280, height: 900 } })
  const m = await medir(page)
  check('en el PC no hay tarjetas de reojo', m.tarjetas.length === 0, JSON.stringify(m.tarjetas))
  check('  …y los bloques de siempre están', m.bloques.mov && m.bloques.al && m.bloques.cam && m.bloques.mes, JSON.stringify(m.bloques))
  check('  …con las cuatro expansiones', m.setsVisibles >= 3, String(m.setsVisibles))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

// Tanda 1044 — los cruces plegados (PINGU: «el primero que aparezca
// desplegado está bien, pero los siguientes que estén plegados… si tú le
// clicas dentro del rectángulo, se despliegue el cruce entero… porque si no,
// no lo ves hasta que tú le propones el cambio»). Solo el primero de todos
// va en la tarjeta grande; los demás son filas que, tocadas en cualquier
// sitio que no sea un botón o un enlace, enseñan debajo lo mismo que la
// tarjeta (las dos mitades y la balanza). Datos: los de la 1042.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const SETS = [
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', market: 'WEST', release_date: '2021-08-27', card_count_official: 203 },
  { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, tcg_online_code: 'MEW' },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
  { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', release_date: '2023-06-09', card_count_official: 193 },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, extra = {}) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const CARTAS = [carta('swsh7-215', 'swsh7', 215, 'Umbreon VMAX'), carta('sv3pt5-199', 'sv3pt5', 199, 'Charizard ex'), carta('sv8-238', 'sv8', 238, 'Pikachu ex'), carta('sv2-269', 'sv2', 269, 'Iono'), carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'), carta('swsh7-1', 'swsh7', 1, 'Mew'), carta('SV2a-201', 'SV2a', 201, 'リザードン', { name_en: 'Charizard' })]
const U = (n) => `user-${n}`
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: U(1), username: 'lucia_tcg', display_name: 'Lucía' }, { id: U(2), username: 'danipoke', display_name: 'Dani' }, { id: U(3), username: 'marta.jp', display_name: 'Marta' }, { id: U(4), username: 'iker_ex', display_name: 'Íker' }, { id: U(5), username: 'malo', is_banned: true }]
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
const linea = (id, user, card, idioma, cambio, h, o = {}) => ({ id, user_id: user, card_id: card, market: card.startsWith('SV2a') ? 'JP' : 'WEST', cantidad: Math.max(1, cambio), cambio, idioma, estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(h), ...o })
// Yo (admin-1) doy Mew ex; Lucía busca Mew ex, así que con ella hay cruce.
const COLECCION = [
  linea('m1', 'admin-1', 'sv3pt5-151', 'es', 1, 1),
  linea('o1', U(1), 'swsh7-215', 'es', 1, 2), linea('o2', U(4), 'swsh7-215', 'en', 1, 3), linea('o3', U(2), 'sv3pt5-199', 'es', 1, 5),
  linea('o4', U(2), 'sv2-269', 'es', 1, 6), linea('o5', U(3), 'sv2-269', 'fr', 2, 7), linea('o6', U(1), 'sv2-269', 'es', 1, 8),
  linea('o7', U(4), 'sv8-238', 'es', 1, 9), linea('o8', U(3), 'SV2a-201', 'ja', 1, 1),
  // La da un baneado y otra con cambio 0: ninguna de las dos sale.
  linea('o9', U(5), 'swsh7-1', 'es', 1, 1), linea('o10', U(4), 'swsh7-1', 'es', 0, 1),
]
const DESEOS = [{ id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }, { id: 'd2', user_id: U(1), card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
const PRECIOS = [{ card_id: 'swsh7-215', cm_low: 612 }, { card_id: 'sv3pt5-199', cm_low: 118.5 }, { card_id: 'sv8-238', cm_low: 84.9 }, { card_id: 'sv2-269', cm_low: 42 }]

const browser = await chromium.launch()
async function abrir({ movil = false, sesion = true, ancho = 1440, extra = {} } = {}) {
  // Sin service worker: el de la web (745) contesta antes que `route` y la
  // prueba no vería a dónde se va al escribir.
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion ? 'admin-1' : 'none'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = d.PRECIOS
    Object.assign(window, d.extra)
  }, { SETS, CARTAS, COLECCION, DESEOS, PERFILES, PRECIOS, sesion, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // A dónde se va al escribir o al registrarse, sin irse de verdad.
  await ctx.route(/\/(mensajes|auth)\.html/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fuera</title>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta = '/mi-coleccion.html?ver=mercado') => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
}

const MIA = [
  { id: 'm1', user_id: 'admin-1', card_id: 'sv3pt5-151', market: 'WEST', cantidad: 1, cambio: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T10:00:00Z' },
  { id: 'm2', user_id: 'admin-1', card_id: 'sv2-269', market: 'WEST', cantidad: 3, cambio: 1, idioma: 'es', estado: 'EX', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T09:00:00Z' },
  { id: 'm3', user_id: 'admin-1', card_id: 'sv8-238', market: 'WEST', cantidad: 2, cambio: 0, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T09:00:00Z' },
]
const OTRAS = COLECCION.filter((l) => l.user_id !== 'admin-1')
const BUSCAN = [
  { id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
  { id: 'd2', user_id: 'user-1', card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
  { id: 'd3', user_id: 'user-2', card_id: 'sv2-269', idioma: 'es', prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
]
const extra = { __FAKE_PRECIOS__: [...PRECIOS, { card_id: 'sv3pt5-151', cm_low: 21.4 }], __FAKE_COLECCION__: [...MIA, ...OTRAS], __FAKE_DESEOS__: BUSCAN, __FAKE_SEGUIDOS__: [{ following_id: 'user-2' }] }

const estado = (page) => page.evaluate(() => [...document.querySelectorAll('#mcCambiosPanel [data-cruce]')].map((c) => {
  const d = c.querySelector('.mc-cruce-detalle')
  return { quien: c.dataset.cruce, forma: c.classList.contains('mc-cruce-fila') ? 'fila' : 'tarjeta', abierta: d ? !d.hidden && d.getBoundingClientRect().height > 40 : null, flecha: c.querySelector('[data-desplegar]')?.getAttribute('aria-expanded') ?? null }
}))

for (const movil of [false, true]) {
  const lado = movil ? 'móvil' : 'PC'
  console.log(`── 1. ${lado}: el primero abierto, los demás plegados ──`)
  const { ctx, page, errores } = await abrir({ movil, extra })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.waitForTimeout(1200)
  const antes = page.url()
  const e0 = await estado(page)
  check(`${lado}: Lucía (el primero) en tarjeta; Íker y Dani en filas plegadas`, JSON.stringify(e0) === JSON.stringify([{ quien: 'user-1', forma: 'tarjeta', abierta: null, flecha: null }, { quien: 'user-4', forma: 'fila', abierta: false, flecha: 'false' }, { quien: 'user-2', forma: 'fila', abierta: false, flecha: 'false' }]), JSON.stringify(e0))

  // Tocar la fila en su texto (no en un enlace ni en un botón).
  await page.click('[data-cruce="user-4"] .mc-cruce-quien .subtext')
  await page.waitForTimeout(300)
  const d = await page.evaluate(() => {
    const f = document.querySelector('[data-cruce="user-4"]')
    const det = f.querySelector('.mc-cruce-detalle')
    return { abierta: !det.hidden, lados: [...det.querySelectorAll('.mc-cruce-lado .mc-cruce-titulo')].map((t) => t.textContent.trim()), cartas: det.querySelectorAll('.mc-cruce-carta').length, total: det.querySelector('[data-cruce-lado="da"] .mc-cruce-total')?.textContent.replace(/\s+/g, ' ').trim(), balanza: det.querySelector('.mc-cruce-balanza')?.getAttribute('aria-label'), flecha: f.querySelector('[data-desplegar]').getAttribute('aria-expanded'), ancho: Math.round(det.getBoundingClientRect().width), fila: Math.round(f.getBoundingClientRect().width), sinLado: document.documentElement.scrollWidth <= innerWidth + 1 }
  })
  check('tocar la fila la despliega, sin irse de la página', d.abierta && d.flecha === 'true' && page.url() === antes, JSON.stringify(d))
  check('  …con lo mismo que la tarjeta grande: Te da / Le das, sus cartas y su total', d.lados.join('|') === 'Te da|Le das' && d.cartas >= 1 && /^1 carta · ≈ 612,00\s€$/.test(d.total || ''), JSON.stringify(d))
  check('  …y la balanza', /^Te da 612,00\s€ más$/.test(d.balanza || ''), d.balanza)
  check('  …a lo ancho de la fila y sin desplazamiento de lado', d.ancho >= d.fila - 2 * 16 - 2 && d.sinLado, JSON.stringify(d))
  if (process.env.CAPTURA) await page.locator('#mcCambiosPanel .mc-cruces-bandas').screenshot({ path: `${process.env.CAPTURA}/cruces-${movil ? 'movil' : 'pc'}.png` })
  const e1 = await estado(page)
  check('  …y las otras siguen como estaban', e1[2].abierta === false && e1[0].forma === 'tarjeta', JSON.stringify(e1))

  // Tocar dentro de lo desplegado no lo pliega; tocar la fila otra vez, sí.
  await page.click('[data-cruce="user-4"] .mc-cruce-detalle .mc-cruce-total')
  await page.waitForTimeout(200)
  check('tocar lo desplegado no lo pliega', (await estado(page))[1].abierta === true)
  await page.click('[data-cruce="user-4"] .mc-cruce-quien .subtext')
  await page.waitForTimeout(200)
  check('tocar la fila otra vez la pliega', (await estado(page))[1].abierta === false)

  // La flecha (teclado y lector) hace lo mismo y mide 44.
  const flecha = await page.evaluate(() => { const b = document.querySelector('[data-cruce="user-2"] [data-desplegar]'); const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), et: b.getAttribute('aria-label'), ctl: Boolean(document.getElementById(b.getAttribute('aria-controls'))) } })
  check('la flecha es un botón de 44 con su nombre y lo que controla', flecha.w === 44 && flecha.h === 44 && /Dani/.test(flecha.et || '') && flecha.ctl, JSON.stringify(flecha))
  await page.focus('[data-cruce="user-2"] [data-desplegar]')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  check('  …y con Intro despliega la de Dani', (await estado(page))[2].abierta === true)

  // «Proponer» sigue proponiendo, no despliega.
  await page.click('[data-cruce="user-4"] [data-proponer]')
  await page.waitForTimeout(800)
  check('«Proponer» de una fila plegada no la despliega', (await estado(page))[1].abierta === false)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Sin cruce perfecto, el primero de «Tienen lo que buscas» va abierto ──')
{
  const sinPerfecto = { ...extra, __FAKE_DESEOS__: BUSCAN.filter((d) => d.id !== 'd2') }
  const { ctx, page, errores } = await abrir({ movil: true, extra: sinPerfecto })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.waitForTimeout(1200)
  const e = await estado(page)
  const formas = e.map((x) => `${x.quien}:${x.forma}`)
  check('una tarjeta, la primera, y el resto en filas', formas[0]?.endsWith(':tarjeta') && formas.slice(1).every((f) => f.endsWith(':fila')) && formas.length >= 2, JSON.stringify(formas))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

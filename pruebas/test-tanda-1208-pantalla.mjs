// Tanda 1208 — Cruces en tarjetas por persona (de «Lo de la portada en el
// resto de la web»; PINGU: «el tema de cruces está muy anticuado»). Arriba la
// banda de Colección con cuántas personas encajan, lo que buscas y das (cada
// cifra lleva a su lista) y los perfectos; debajo los filtros y una rejilla de
// tarjetas IGUALES (dos columnas en el PC, una en el móvil), cada una con las
// dos mitades del trato, la balanza y «Proponer». Sustituye a la 1044 (el
// primero en grande y los demás plegados). Datos: los de la 1042/1044.
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


const estado = (page) => page.evaluate(() => {
  const panel = document.getElementById('mcCambiosPanel')
  const banda = panel.querySelector('.banda-s')
  const tarjetas = [...panel.querySelectorAll('.mc-cruces-rejilla > [data-cruce]')]
  const r = (x) => x.getBoundingClientRect()
  return {
    titulo: banda?.querySelector('h2')?.textContent.trim(),
    cifras: banda ? [...banda.querySelectorAll('.banda-s-cifra')].map((c) => ({ t: c.textContent.replace(/\s+/g, ' ').trim(), boton: c.tagName === 'BUTTON', ir: c.getAttribute('data-deseos-vista') || (c.hasAttribute('data-ir-quiero') ? 'quiero' : '') })) : [],
    tarjetas: tarjetas.map((c) => ({ quien: c.dataset.cruce, t: c.classList.contains('mc-cruce-t'), lados: c.querySelectorAll('.mc-cruce-lado').length, nombres: [...c.querySelectorAll('.mc-cruce-fotos .mc-cruce-carta')].filter((a) => /\S/.test(a.getAttribute('aria-label') || '')).length, encaje: c.querySelector('.mc-cruce-encaje b')?.textContent, chapa: Boolean(c.querySelector('.mc-chapa-reciproco')), top: Math.round(r(c).top), h: Math.round(r(c).height) })),
    filas: panel.querySelectorAll('.mc-cruce-fila').length,
    cascada: tarjetas[0] ? getComputedStyle(tarjetas[0]).animationName : '',
    ancho: document.documentElement.scrollWidth <= innerWidth + 1,
  }
})

for (const movil of [false, true]) {
  const lado = movil ? 'móvil' : 'PC'
  console.log(`── ${lado} ──`)
  const { ctx, page, errores } = await abrir({ movil, extra })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.waitForTimeout(1200)
  const e = await estado(page)
  check('la banda: «3 personas encajan contigo»', e.titulo === '3 personas encajan contigo' || movil, JSON.stringify(e.titulo))
  // Desde la 1213, también los tratos en curso (lleva a «Tus cambios»).
  check('  …con lo que buscas y das (que llevan a su lista), los perfectos y los tratos en curso', e.cifras.length === 4 && /^1\s*carta buscas$/.test(e.cifras[0]?.t) && e.cifras[0].ir === 'quiero' && /^2\s*cartas das$/.test(e.cifras[1]?.t) && e.cifras[1].ir === 'doy' && /^1\s*cruce perfecto$/.test(e.cifras[2]?.t) && !e.cifras[2].boton && /^\d+\s*tratos en curso$/.test(e.cifras[3]?.t) && e.cifras[3].boton, JSON.stringify(e.cifras))
  check('tres tarjetas iguales y ninguna fila plegada', e.tarjetas.length === 3 && e.tarjetas.every((x) => x.t && x.lados === 2) && e.filas === 0, JSON.stringify(e.tarjetas))
  check('  …la primera, Lucía, con su chapa de cruce perfecto y «2 encajan»', e.tarjetas[0]?.quien === 'user-1' && e.tarjetas[0].chapa && e.tarjetas[0].encaje === '2', JSON.stringify(e.tarjetas[0]))
  check('  …cada carta en foto, con su nombre en la etiqueta (1213)', e.tarjetas.every((x) => x.nombres >= 1), JSON.stringify(e.tarjetas))
  check(movil ? '  …en una columna' : '  …en dos columnas (las dos primeras a la misma altura)', movil ? e.tarjetas[1].top > e.tarjetas[0].top : e.tarjetas[0].top === e.tarjetas[1].top, JSON.stringify(e.tarjetas.map((x) => x.top)))
  check('  …y entran en cascada', e.cascada === 'seccion-entra', e.cascada)
  await page.waitForTimeout(700)
  await page.screenshot({ path: `/tmp/1208-cruces-${movil ? 'movil' : 'pc'}.png`, fullPage: true })
  await page.click('[data-cruces-filtro="perfectos"]')
  await page.waitForTimeout(400)
  check('«Perfectos» deja solo a Lucía', (await estado(page)).tarjetas.map((x) => x.quien).join() === 'user-1')
  // «Gente que sigo» se fue en la 1217: Todos · Perfectos · En curso.
  check('  …y los filtros son Todos · Perfectos · En curso', (await page.$$eval('[data-cruces-filtro]', (bs) => bs.map((b) => b.dataset.crucesFiltro))).join() === 'todos,perfectos,curso')
  const pestana = await page.evaluate(() => { const b = document.querySelector('#mcBloqueCambios .mc-deseos-seg [data-deseos-vista="cruces"]'); const a = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim(); const tmp = document.createElement('i'); tmp.style.color = a; document.body.appendChild(tmp); const c = getComputedStyle(tmp).color; tmp.remove(); return { fondo: getComputedStyle(b).backgroundColor, acento: c } })
  check('la pestaña de Cruces, en el color de Colección', pestana.fondo === pestana.acento, JSON.stringify(pestana))
  check('sin desplazamiento de lado', e.ancho)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Menos movimiento: sin cascada ──')
{
  const { ctx, page } = await abrir({ extra })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.waitForTimeout(1200)
  check('las tarjetas no se mueven', (await estado(page)).cascada === 'none')
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)

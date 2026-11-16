// Tanda 1371 — «86/25 · Completa» (David García en el foro, el 30th
// Celebration japonés). El total de una expansión lo escribe la pasada del
// catálogo con lo que dice TCGGO y puede quedarse corto. Si tienes MÁS cartas
// distintas que ese total, la cifra es falsa: la estantería no la enseña
// («4 cartas», sin anillo), nada sale como completo, el filtro «Completas» no
// la cuenta y el logro de expansiones completas tampoco. La pasada del calco
// japonés, además, solo sube la cuenta (`cuentaQueSube`).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

// Lo puro, primero.
const { statsDeColeccion } = await import(`${RAIZ}/js/logros-coleccion.js`)
const st = statsDeColeccion({ lineas: [], cartaDe: () => null, cuantasPorSet: new Map([['buena', 4], ['corta', 4]]), totalDeSet: (id) => (id === 'buena' ? 4 : 2), unidad: () => 0 })
check('el logro cuenta la completa de verdad y no la de total corto', st.setsCompletos === 1, st.setsCompletos)
const { cuentaQueSube } = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
check('el calco sube 25 → 86 y no baja 90 → 86', cuentaQueSube({ card_count_total: 25 }, 86) === 86 && cuentaQueSube({ card_count_total: 90 }, 86) === null && cuentaQueSube({ card_count_total: 5 }, 0) === null)

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [
    // La de total corto: dice 2 y tienes 4.
    { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 2, card_count_total: 2, tcg_online_code: 'PRC' },
    { id: 'xy6', name: 'Cielos Rugientes', serie_id: 'xy', market: 'WEST', release_date: '2015-05-06', card_count_official: 4, card_count_total: 4, tcg_online_code: 'ROS' },
  ]
  const carta = (set, n, nombre) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${set}/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], tcg_sets: { id: set, name: set, serie_id: 'xy' } })
  window.__FAKE_CARTAS__ = [1, 2, 3, 4].flatMap((n) => [carta('xy5', n, `Uno ${n}`), carta('xy6', n, `Dos ${n}`)])
  window.__FAKE_COLECCION__ = [
    ...[1, 2, 3, 4].map((n) => ({ id: `a${n}`, card_id: `xy5-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' })),
    ...[1, 2, 3, 4].map((n) => ({ id: `b${n}`, card_id: `xy6-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' })),
  ]
}
for (const movil of [true, false]) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const t = await page.$$eval('[data-set]', (ts) => ts.filter((x) => x.closest('#mcEstanteria, #mcPanelAlbum, main')).map((x) => ({ set: x.dataset.set, texto: x.textContent.replace(/\s+/g, ' ').trim(), anillo: x.querySelector('.mc-set-anillo')?.getAttribute('aria-label') || null, completo: x.classList.contains('completo') || Boolean(x.querySelector('.mc-set-anillo.completo')) })))
  const corta = t.find((x) => x.set === 'xy5')
  const buena = t.find((x) => x.set === 'xy6')
  const quien = movil ? 'móvil' : 'PC'
  check(`${quien}: la de total corto no dice «4/2» ni «4 de 2»`, corta && !/4\s*\/\s*2|4 de 2/.test(corta.texto) && !/4 de 2/.test(corta.anillo || ''), JSON.stringify(corta))
  check(`${quien}: …ni sale completa`, corta && !corta.completo, JSON.stringify(corta))
  check(`${quien}: la completa de verdad, sí`, buena && buena.completo, JSON.stringify(buena))
  check(`${quien}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(N)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
